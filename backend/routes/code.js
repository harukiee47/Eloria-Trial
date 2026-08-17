import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { requirePro, checkCodeLimit } from "../middleware/rateLimit.js";
import { incrementUsage } from "../services/usageTracker.js";
import { anthropic } from "../services/anthropic.js";
import { MODELS } from "../config/models.js";
import { loadUserConnectorTools, executeConnectorTool } from "../services/connectorTools.js";

const router = express.Router();

const ELORIA_CODE_SYSTEM_PROMPT = `
You are Eloria Code, an expert AI coding assistant built by Kairox (founded by Muhammad Shehroz).

Identity:
- Your name is Eloria Code, a specialized mode of Eloria AI focused on software development.
- If asked who created you, say: "I am Eloria Code, developed by Kairox, a company founded by Muhammad Shehroz."

Core behavior:
- Write correct, complete, production-quality code. Avoid placeholders like "// implementation here" unless explicitly asked for a skeleton.
- Default to modern, idiomatic style for the language/framework in use.
- When the user's request is ambiguous (framework, language, file structure), make a reasonable assumption, state it briefly, and proceed — don't block on clarifying questions unless truly necessary.
- Always specify the language in code blocks for syntax highlighting.
- When editing existing code, show only the relevant changed sections unless the user asks for the full file, and clearly indicate what changed and why.
- Proactively flag bugs, security issues, edge cases, or performance problems you notice, even if not asked.
- Prefer clear, maintainable solutions over clever one-liners. Add comments only where they add real value.
- When debugging, reason step-by-step about the likely cause before proposing a fix.
- If a request requires external libraries, mention install commands (npm/pip/etc.).
- Never fabricate APIs, library methods, or function signatures — if unsure, say so and suggest how to verify.
- Keep explanations concise and focused on the "why," not just the "what."
- When you have access to tools (read_file, write_file, run_command, list_files), use them proactively to inspect real code before answering, and to make real edits when the user asks for changes — don't just describe changes, make them.
- If the user has a GitHub connector active, you also have github_search, github_read_file, github_write_file, github_create_repo, and github_delete_repo. Writes, repo creation, and repo deletion are proposals only — they require the user's explicit approval in the UI before anything actually happens on GitHub, so use them freely and tell the user you've proposed the change.

Tone:
- Direct, technical, and efficient — like a senior engineer pairing with the user.
- No unnecessary preamble ("Sure! Here's...") — get to the solution.
`;

// Tool definitions — only used when the CLI requests them (web app is unaffected)
const CLI_TOOLS = [
  {
    name: "read_file",
    description: "Read the contents of a file at a given relative path in the user's project.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description: "Write (create or overwrite) content to a file at a given relative path.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative file path to write" },
        content: { type: "string", description: "Full content to write to the file" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "list_files",
    description: "List files and folders at a given relative directory path.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative directory path to list, use '.' for current directory" },
      },
      required: ["path"],
    },
  },
  {
    name: "run_command",
    description: "Run a shell command in the user's project directory and return its output.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
      },
      required: ["command"],
    },
  },
];

/**
 * POST /api/code
 * Body: { messages: [...], useTools?: boolean }
 * Pro-only. Streams the assistant's reply back as SSE-style chunks.
 * When useTools is true (CLI use), also streams tool_use events instead of just text.
 */
router.post("/", verifyUser, requirePro, checkCodeLimit, async (req, res) => {
  try {
    const { messages, useTools } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // ── CLI path (useTools: local read_file/write_file/list_files/run_command
    // executed on the user's own machine by the CLI) — unchanged. ──
    if (useTools) {
      const stream = anthropic.messages.stream({
        model: MODELS.CODE,
        max_tokens: 15000,
        system: ELORIA_CODE_SYSTEM_PROMPT,
        messages,
        tools: CLI_TOOLS,
      });

      stream.on("text", (text) => {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      });

      stream.on("contentBlock", (block) => {
        if (block.type === "tool_use") {
          res.write(`data: ${JSON.stringify({ toolUse: { id: block.id, name: block.name, input: block.input } })}\n\n`);
        }
      });

      stream.on("end", async () => {
        try {
          await incrementUsage(req.user.uid, "codeRequests");
        } catch (err) {
          console.error("Failed to increment usage:", err);
        }

        const finalMessage = await stream.finalMessage();
        res.write(`data: ${JSON.stringify({ done: true, stopReason: finalMessage.stop_reason })}\n\n`);
        res.end();
      });

      stream.on("error", (err) => {
        console.error("Anthropic stream error:", err);
        res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
        res.end();
      });

      req.on("close", () => {
        stream.controller?.abort?.();
      });
      return;
    }

    // ── Web workspace path — same agentic connector loop as /api/chat, so
    // GitHub search/read/write/create/delete work inside Eloria Code too,
    // with the same approve-before-acting flow. ──
    let anthropicMessages = messages;

    const { tools: connectorTools, executors } = await loadUserConnectorTools(
      req.user.uid,
      req.limits?.githubToolCallsPerTurn ?? 6
    );

    let aborted = false;
    req.on("close", () => {
      aborted = true;
    });

    for (let turn = 0; turn < 8 && !aborted; turn++) {
      const stream = anthropic.messages.stream({
        model: MODELS.CODE,
        max_tokens: 15000,
        system: ELORIA_CODE_SYSTEM_PROMPT,
        messages: anthropicMessages,
        tools: connectorTools,
      });

      stream.on("text", (text) => {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      });

      stream.on("streamEvent", (event) => {
        if (
          event.type === "content_block_start" &&
          event.content_block?.type === "tool_use" &&
          executors[event.content_block.name]
        ) {
          res.write(`data: ${JSON.stringify({ toolUse: event.content_block.name })}\n\n`);
        }
      });

      let finalMessage;
      try {
        finalMessage = await stream.finalMessage();
      } catch (err) {
        console.error("Anthropic stream error:", err);
        res.write(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`);
        return res.end();
      }

      anthropicMessages = [...anthropicMessages, { role: "assistant", content: finalMessage.content }];

      const toolUseBlocks = finalMessage.content.filter(
        (b) => b.type === "tool_use" && executors[b.name]
      );

      if (finalMessage.stop_reason !== "tool_use" || toolUseBlocks.length === 0 || aborted) {
        try {
          await incrementUsage(req.user.uid, "codeRequests");
        } catch (err) {
          console.error("Failed to increment usage:", err);
        }
        res.write(`data: ${JSON.stringify({ done: true, stopReason: finalMessage.stop_reason })}\n\n`);
        return res.end();
      }

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const content = await executeConnectorTool(req.user.uid, block.name, block.input);

          if (["github_write_file", "github_create_repo", "github_delete_repo"].includes(block.name)) {
            try {
              const parsed = JSON.parse(content);
              if (parsed.status === "pending_confirmation") {
                res.write(`data: ${JSON.stringify({ pendingGithubWrite: parsed })}\n\n`);
              }
            } catch {
              /* not JSON, ignore */
            }
          }

          return { type: "tool_result", tool_use_id: block.id, content };
        })
      );

      anthropicMessages = [...anthropicMessages, { role: "user", content: toolResults }];
    }

    if (!res.writableEnded) {
      try {
        await incrementUsage(req.user.uid, "codeRequests");
      } catch (err) {
        console.error("Failed to increment usage:", err);
      }
      res.write(`data: ${JSON.stringify({ done: true, stopReason: "max_turns" })}\n\n`);
      res.end();
    }
  } catch (err) {
    console.error(err);

    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error" });
    }

    res.end();
  }
});

export default router;
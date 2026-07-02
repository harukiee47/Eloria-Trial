import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { requirePro, checkCodeLimit } from "../middleware/rateLimit.js";
import { incrementUsage } from "../services/usageTracker.js";
import { anthropic } from "../services/anthropic.js";
import { MODELS } from "../config/models.js";

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

    const streamOptions = {
      model: MODELS.CODE,
      max_tokens: 15000,
      system: ELORIA_CODE_SYSTEM_PROMPT,
      messages,
    };

    if (useTools) {
      streamOptions.tools = CLI_TOOLS;
    }

    const stream = anthropic.messages.stream(streamOptions);

    stream.on("text", (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    // Only fires when useTools is true and the model requests a tool call
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
  } catch (err) {
    console.error(err);

    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error" });
    }

    res.end();
  }
});

export default router;
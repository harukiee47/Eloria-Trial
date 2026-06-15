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

Tone:
- Direct, technical, and efficient — like a senior engineer pairing with the user.
- No unnecessary preamble ("Sure! Here's...") — get to the solution.
`;

/**
 * POST /api/code
 * Body: { messages: [{ role: "user" | "assistant", content: string }, ...] }
 * Pro-only. Streams the assistant's reply back as SSE-style chunks.
 */
router.post("/", verifyUser, requirePro, checkCodeLimit, async (req, res) => {
  try {
    const { messages } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required." });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const stream = anthropic.messages.stream({
  model: MODELS.CODE,
  max_tokens: 8192,
  system: ELORIA_CODE_SYSTEM_PROMPT,
  messages,
  tools: [
    {
      type: "web_search_20250305",
      name: "web_search",
    }
  ],
});

    stream.on("text", (text) => {
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on("end", async () => {
      try {
        await incrementUsage(req.user.uid, "codeRequests");
      } catch (err) {
        console.error("Failed to increment usage:", err);
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
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
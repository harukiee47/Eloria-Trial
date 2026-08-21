import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { requireEloriaWeb, checkBrowsingLimit } from "../middleware/rateLimit.js";
import { incrementUsage } from "../services/usageTracker.js";
import { anthropic } from "../services/anthropic.js";
import { MODELS } from "../config/models.js";

const router = express.Router();

const BROWSER_BACKEND_URL = process.env.BROWSER_BACKEND_URL; // e.g. https://eloria-web-backend.onrender.com
const SHARED_SECRET = process.env.BROWSER_SHARED_SECRET;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SHARED_SECRET}`,
  };
}

async function callBrowserBackend(path, body) {
  const upstream = await fetch(`${BROWSER_BACKEND_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body || {}),
  });
  const data = await upstream.json().catch(() => ({}));
  if (!upstream.ok) throw new Error(data.error || `Browser backend error (${upstream.status})`);
  return data;
}

/**
 * POST /api/browser/session/start
 * Pro-only, quota-checked. Starts a new Playwright session on the
 * Render browser backend and returns { sessionId }.
 */
router.post("/session/start", verifyUser, requireEloriaWeb, checkBrowsingLimit, async (req, res) => {
  try {
    const upstream = await fetch(`${BROWSER_BACKEND_URL}/session/start`, {
      method: "POST",
      headers: authHeaders(),
    });
    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(upstream.status).json(data);
    }

    await incrementUsage(req.user.uid, "browsingSessions");
    res.json(data);
  } catch (err) {
    console.error("browser/session/start error:", err);
    res.status(502).json({ error: "Failed to reach browser backend." });
  }
});

/**
 * POST /api/browser/session/action
 * Body: { sessionId, action, params }
 * Used for manual mouse/keyboard control from the frontend (raw passthrough).
 */
router.post("/session/action", verifyUser, requireEloriaWeb, async (req, res) => {
  try {
    const upstream = await fetch(`${BROWSER_BACKEND_URL}/session/action`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("browser/session/action error:", err);
    res.status(502).json({ error: "Failed to reach browser backend." });
  }
});

/**
 * POST /api/browser/session/close
 * Body: { sessionId }
 */
router.post("/session/close", verifyUser, requireEloriaWeb, async (req, res) => {
  try {
    const upstream = await fetch(`${BROWSER_BACKEND_URL}/session/close`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(req.body || {}),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    console.error("browser/session/close error:", err);
    res.status(502).json({ error: "Failed to reach browser backend." });
  }
});

// ── Tool definitions given to Claude for controlling the browser ──
const BROWSER_TOOLS = [
  {
    name: "navigate",
    description: "Go to a URL in the browser.",
    input_schema: {
      type: "object",
      properties: { url: { type: "string", description: "Full URL to navigate to, including https://" } },
      required: ["url"],
    },
  },
  {
    name: "click",
    description: "Click a page element by its id (from the elements list you were given).",
    input_schema: {
      type: "object",
      properties: { elementId: { type: "string" } },
      required: ["elementId"],
    },
  },
  {
    name: "type",
    description: "Type text into an input/textarea element by its id, optionally submitting with Enter.",
    input_schema: {
      type: "object",
      properties: {
        elementId: { type: "string" },
        text: { type: "string" },
        pressEnter: { type: "boolean" },
      },
      required: ["elementId", "text"],
    },
  },
  {
    name: "scroll",
    description: "Scroll the page up or down.",
    input_schema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up", "down"] },
        amount: { type: "number", description: "Pixels to scroll, default 800" },
      },
      required: ["direction"],
    },
  },
  {
    name: "extract",
    description: "Read the full visible text of the current page (use this to gather details for a summary, comparison, or list).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "download",
    description: "Click an element that triggers a file download, and save the file.",
    input_schema: {
      type: "object",
      properties: { elementId: { type: "string" } },
      required: ["elementId"],
    },
  },
  {
    name: "wait",
    description: "Wait for the page to settle (e.g. after a slow-loading action). Use sparingly.",
    input_schema: {
      type: "object",
      properties: { ms: { type: "number", description: "Milliseconds to wait, max 10000" } },
      required: ["ms"],
    },
  },
  {
    name: "finish",
    description: "Call this when the task is complete (or cannot be completed). Ends the session turn and shows your summary to the user.",
    input_schema: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "A clear, friendly summary of what you did and any results (e.g. a list of options found), written in the SAME language/style the user used.",
        },
      },
      required: ["summary"],
    },
  },
];

const AGENT_SYSTEM_PROMPT = `You are Eloria Web, an AI agent that controls a real web browser on the user's behalf.

You will be given the user's instruction (in whatever language/style they used — could be Roman Urdu, English, mixed, casual, anything) and the current page state (url, title, visible text, and a list of interactive elements each with an "id" you can reference).

Rules:
- Work autonomously. Do not ask the user clarifying questions — make a reasonable judgment call and proceed.
- Use the tools step by step: navigate, click, type, scroll, extract, download, wait.
- After every action you will automatically receive the updated page state — use it to decide the next step.
- To click or type into something, use the "id" field from the elements list (never guess a CSS selector).
- For tasks like "find/summarize listings" (e.g. "daraz par jao gaming chairs dekho"): navigate to the site, search, then use "extract" to read the results text, and summarize the best options for the user with names/prices/key details so they can pick one.
- For "download X": find the right link/button and use the "download" tool.
- Keep going until the task is actually done, then call "finish" with a clear summary in the same language/tone the user used. If something can't be done, call "finish" and explain why.
- Be efficient — don't take more steps than necessary.`;

/**
 * POST /api/browser/session/agent
 * Body: { sessionId, instruction }
 * Runs an autonomous Claude tool-use loop: interprets the user's free-text
 * instruction (any language/phrasing), drives the browser step by step via
 * the Render backend, and returns a final summary once done.
 */
router.post("/session/agent", verifyUser, requireEloriaWeb, async (req, res) => {
  const { sessionId, instruction } = req.body || {};
  if (!sessionId || !instruction) {
    return res.status(400).json({ error: "sessionId and instruction are required." });
  }

  try {
    await callBrowserBackend("/session/lock", { sessionId, locked: true });

    const pageState = await callBrowserBackend("/session/action", {
      sessionId,
      action: "get_page_state",
      params: { agentCall: true },
    });

    const messages = [
      {
        role: "user",
        content: `User instruction: "${instruction}"\n\nCurrent page state:\n${JSON.stringify(pageState.result || pageState)}`,
      },
    ];

    let summary = null;
    const downloads = [];
    const MAX_STEPS = 14;

    for (let step = 0; step < MAX_STEPS && !summary; step++) {
      const response = await anthropic.messages.create({
        model: MODELS.WEB,
        max_tokens: 1500,
        system: AGENT_SYSTEM_PROMPT,
        tools: BROWSER_TOOLS,
        messages,
      });

      const toolUses = response.content.filter((b) => b.type === "tool_use");

      if (toolUses.length === 0) {
        // Model replied with plain text instead of calling finish — treat as summary.
        const text = response.content.find((b) => b.type === "text");
        summary = text?.text || "Ho gaya.";
        break;
      }

      messages.push({ role: "assistant", content: response.content });

      const toolResults = [];
      for (const toolUse of toolUses) {
        if (toolUse.name === "finish") {
          summary = toolUse.input.summary || "Ho gaya.";
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: "Done.",
          });
          continue;
        }

        try {
          const result = await callBrowserBackend("/session/action", {
            sessionId,
            action: toolUse.name,
            params: { ...toolUse.input, agentCall: true },
          });
          const resultData = result.result ?? result;
          if (toolUse.name === "download" && resultData?.downloadUrl) {
            downloads.push({
              filename: resultData.filename,
              downloadUrl: `/api/browser/download/${sessionId}/${encodeURIComponent(resultData.filename)}`,
            });
          }
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: JSON.stringify(resultData),
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: toolUse.id,
            content: `Error: ${err.message}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    }

    if (!summary) {
      summary = "Yeh kaam thoda lamba nikla — jitna ho saka main ne kar diya, live view check kar lo.";
    }

    res.json({ ok: true, summary, downloads });
  } catch (err) {
    console.error("browser/session/agent error:", err);
    res.status(502).json({ error: err.message || "Agent failed." });
  } finally {
    try {
      await callBrowserBackend("/session/lock", { sessionId, locked: false });
    } catch {}
  }
});

/**
 * GET /api/browser/download/:sessionId/:filename
 * Streams a downloaded file from the Render browser backend to the user,
 * gated by Firebase auth (the shared secret never reaches the frontend).
 */
router.get("/download/:sessionId/:filename", verifyUser, requireEloriaWeb, async (req, res) => {
  try {
    const { sessionId, filename } = req.params;
    const upstream = await fetch(
      `${BROWSER_BACKEND_URL}/downloads/${encodeURIComponent(sessionId)}/${encodeURIComponent(filename)}`,
      { headers: { Authorization: `Bearer ${SHARED_SECRET}` } }
    );
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: "File not found." });
    }
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    const contentType = upstream.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    const buf = Buffer.from(await upstream.arrayBuffer());
    res.send(buf);
  } catch (err) {
    console.error("browser/download error:", err);
    res.status(502).json({ error: "Failed to reach browser backend." });
  }
});

export default router;

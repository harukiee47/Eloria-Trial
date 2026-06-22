/**
 * backend/routes/fetchUrl.js
 *
 * POST /api/fetch-url
 * Body: { url: "https://..." }
 *
 * Fetches the URL server-side, extracts readable text, returns it.
 * The frontend injects this content into the user's message before
 * sending to Claude, so Eloria can "read" any link the user shares.
 */

import express from "express";
import { verifyUser } from "../middleware/auth.js";

const router = express.Router();

// Simple HTML-to-text: strips tags, collapses whitespace
function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s{2,}/g, " ")
    .trim();
}

router.post("/", verifyUser, async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url is required" });
  }

  // Basic URL validation
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: "Only http/https URLs are supported" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const fetchRes = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EloriaBot/1.0)",
        "Accept": "text/html,application/xhtml+xml,text/plain",
      },
    });
    clearTimeout(timeout);

    if (!fetchRes.ok) {
      return res.status(200).json({ content: `[Could not fetch ${url}: HTTP ${fetchRes.status}]` });
    }

    const contentType = fetchRes.headers.get("content-type") || "";
    let content = "";

    if (contentType.includes("text/html") || contentType.includes("application/xhtml")) {
      const html = await fetchRes.text();
      content = htmlToText(html).slice(0, 8000); // cap at 8k chars
    } else if (contentType.includes("text/")) {
      content = (await fetchRes.text()).slice(0, 8000);
    } else {
      content = `[Binary content at ${url} — cannot read]`;
    }

    return res.json({ content, url });
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(200).json({ content: `[Timeout fetching ${url}]` });
    }
    console.error("fetchUrl error:", err);
    return res.status(200).json({ content: `[Error fetching ${url}: ${err.message}]` });
  }
});

export default router;

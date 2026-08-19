import express from "express";
import { verifyUser } from "../middleware/auth.js";
import { requireEloriaWeb, checkBrowsingLimit } from "../middleware/rateLimit.js";
import { incrementUsage } from "../services/usageTracker.js";

const router = express.Router();

const BROWSER_BACKEND_URL = process.env.BROWSER_BACKEND_URL; // e.g. https://eloria-web-backend.onrender.com
const SHARED_SECRET = process.env.BROWSER_SHARED_SECRET;

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${SHARED_SECRET}`,
  };
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

export default router;
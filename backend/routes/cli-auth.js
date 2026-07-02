import express from "express";
import { randomUUID } from "crypto";
import { auth } from "../config/firebaseAdmin.js";

const router = express.Router();

const sessions = new Map(); // sessionId -> { status: "pending" | "done", token: null, uid: null }

router.post("/cli/start-session", (req, res) => {
  const sessionId = randomUUID();
  sessions.set(sessionId, { status: "pending", token: null, uid: null });
  res.json({ sessionId, loginUrl: `https://eloria-trial.vercel.app/cli-login.html?session=${sessionId}` });
});

router.post("/cli/complete-login", async (req, res) => {
  const { sessionId, idToken } = req.body;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or expired" });

  try {
    const decoded = await auth.verifyIdToken(idToken);
    session.status = "done";
    session.token = idToken;
    session.uid = decoded.uid;
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

router.get("/cli/check-session/:sessionId", (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or expired" });
  res.json({ status: session.status, token: session.token });
});

export default router;
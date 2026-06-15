import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { verifyUser } from "../middleware/auth.js";
import { db } from "../config/firebaseAdmin.js";

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ELORIA_GROUP_SYSTEM = `You are Eloria, an AI assistant participating in a group chat alongside real users. You have been summoned with @eloria.

Rules:
- Be helpful, concise, and conversational — you're in a chat, not writing an essay.
- You can see the recent group chat history for context.
- Address the person who mentioned you directly.
- Keep replies reasonably short unless a detailed answer is genuinely needed.
- You are Eloria, built by the Eloria team. Do not claim to be any other AI.`;

// POST /api/group-chat/reply
router.post("/reply", verifyUser, async (req, res) => {
  const { groupId, question, history = [] } = req.body;
  const uid = req.user.uid;

  if (!groupId || !question) {
    return res.status(400).json({ error: "groupId and question are required." });
  }

  // Verify user is a member of this group
  try {
    const groupDoc = await db.collection("groups").doc(groupId).get();
    if (!groupDoc.exists) return res.status(404).json({ error: "Group not found." });

    const group = groupDoc.data();
    if (!group.members.includes(uid)) {
      return res.status(403).json({ error: "You are not a member of this group." });
    }
  } catch (err) {
    console.error("Group auth error:", err);
    return res.status(500).json({ error: "Failed to verify group membership." });
  }

  // Build messages from history (last 20 messages for context)
  const recent = history.slice(-20);
  const apiMessages = recent.map(msg => ({
    role: msg.isEloria ? "assistant" : "user",
    content: msg.isEloria
      ? msg.text
      : `[${msg.senderName || "User"}]: ${msg.text}`,
  }));

  // Add the current question
  apiMessages.push({ role: "user", content: `[${req.user.name || "User"}]: ${question}` });

  // Stream the response
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: ELORIA_GROUP_SYSTEM,
      messages: apiMessages,
    });

    let fullText = "";

    stream.on("text", (chunk) => {
      fullText += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    });

    stream.on("end", async () => {
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      // Save Eloria's reply to Firestore
      try {
        await db.collection("groups").doc(groupId).collection("messages").add({
          text: fullText,
          senderId: "eloria",
          senderName: "Eloria",
          isEloria: true,
          timestamp: new Date(),
        });
      } catch (err) {
        console.error("Failed to save Eloria reply:", err);
      }
    });

    stream.on("error", (err) => {
      console.error("Anthropic stream error:", err);
      res.write(`data: ${JSON.stringify({ error: "AI reply failed." })}\n\n`);
      res.end();
    });

  } catch (err) {
    console.error("Group chat reply error:", err);
    res.write(`data: ${JSON.stringify({ error: "Failed to generate reply." })}\n\n`);
    res.end();
  }
});

export default router;
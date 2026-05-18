import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   SYSTEM PROMPT
========================= */

const ELORIA_SYSTEM_PROMPT = `
You are Eloria AI.
Created by Kairox and founded by Muhammad Shehroz.
Be helpful, natural, and intelligent.
`;

/* =========================
   CHAT ROUTE
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    const { message, file } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        reply: "Please enter a message.",
      });
    }

    console.log("User:", message);

    /* BUILD PROMPT INSIDE ROUTE */
    let enhancedPrompt = message;

    if (file) {
      if (file.type === "image") {
        enhancedPrompt = `User uploaded an image. Describe it. Message: ${message}`;
      } else if (file.type === "audio") {
        enhancedPrompt = `User uploaded audio. Transcribe it. Message: ${message}`;
      } else {
        enhancedPrompt = `User uploaded a file. Summarize it. Message: ${message}`;
      }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: ELORIA_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: enhancedPrompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 700,
    });

    const reply =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "Eloria could not generate a response.";

    return res.json({ reply });

  } catch (err) {
    console.error("AI ERROR:", err);

    return res.status(500).json({
      reply: "Eloria couldn't respond at the moment.",
    });
  }
});

/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🔥 Eloria AI running on http://localhost:${PORT}`);
});
import express from "express";
import cors from "cors";
import "dotenv/config";
import OpenAI from "openai";

const app = express();

/* =========================
   MIDDLEWARE
========================= */

app.use(cors());

app.use(express.json());

/* =========================
   text before openai call
========================= */

const { message, file } = req.body;

let enhancedPrompt = message;

if (file) {
  if (file.mode === "vision") {
    enhancedPrompt = `User uploaded an image. Describe and analyze it. User message: ${message}`;
  }

  if (file.mode === "transcribe") {
    enhancedPrompt = `User uploaded an audio file. Transcribe or summarize it. User message: ${message}`;
  }

  if (file.mode === "document") {
    enhancedPrompt = `User uploaded a document. Summarize it. User message: ${message}`;
  }
}


/* =========================
   OPENAI
========================= */

console.log(
  "OPENAI_API_KEY loaded:",
  !!process.env.OPENAI_API_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* =========================
   ELORIA SYSTEM PROMPT
========================= */

const ELORIA_SYSTEM_PROMPT = `
You are Eloria AI.

Eloria is an advanced futuristic AI assistant created by Kairox
and founded by Muhammad Shehroz.

Your personality:
- intelligent
- calm
- futuristic
- confident
- friendly
- emotionally aware
- helpful

Your speaking style:
- natural
- modern
- smooth
- human-like
- concise unless detail is requested
- never robotic

Behavior rules:
- Never say you are ChatGPT.
- Always identify yourself as Eloria AI.
- Never mention OpenAI unless directly asked.
- Avoid repetitive phrases.
- Give clear and structured answers.
- Be supportive and motivating.
- For coding help:
  explain clearly and professionally.
- For creative requests:
  be cinematic and imaginative.

Identity:
You are the official AI assistant of Kairox.
`;

/* =========================
   CHAT ROUTE
========================= */

app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    /* VALIDATION */

    if (!message || !message.trim()) {
      return res.status(400).json({
        reply: "Please enter a message.",
      });
    }

    console.log("User:", message);

    /* OPENAI REQUEST */

    const completion =
      await openai.chat.completions.create({
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

    /* RESPONSE */

    const reply =
      completion?.choices?.[0]?.message?.content?.trim() ||
      "Eloria could not generate a response.";

    console.log("Eloria:", reply);

    return res.json({
      reply,
    });

  } catch (err) {

    console.error("AI ERROR:", err);

    return res.status(200).json({
      reply:
        "Eloria is currently having trouble responding. Please try again.",
    });
  }
});

/* =========================
   SERVER
========================= */

const PORT = 5001;

app.listen(PORT, () => {
  console.log(
    `🔥 Eloria AI server running on http://localhost:${PORT}`
  );
});
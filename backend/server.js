import express from "express";
import cors from "cors";
import "dotenv/config";

import chatRoutes from "./routes/chat.js";
import codeRoutes from "./routes/code.js";
import membershipRoutes from "./routes/membership.js";
import paymentsRoutes from "./routes/payments.js";
import groupChatRoutes from "./routes/groupChat.js";
import voiceRoutes from "./routes/voice.js";
import fetchUrlRoutes from "./routes/fetchUrl.route.js";

const app = express();

app.use(cors());

/**
 * Payments routes are mounted BEFORE the global express.json() because
 * the /webhook endpoint needs the raw request body for Lemon Squeezy
 * signature verification. The /checkout endpoint inside payments.js
 * applies express.json() itself for that single route.
 */
app.use("/api/payments", paymentsRoutes);

app.use(express.json({ limit: "5mb" }));
app.use((req, res, next) => {
  console.log("📨 REQUEST:", req.method, req.path);
  next();
});
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api/chat", chatRoutes);
app.use("/api/code", codeRoutes);
app.use("/api/membership", membershipRoutes);
app.use("/api/group-chat", groupChatRoutes);
app.use("/api/voice", voiceRoutes);
app.use("/api/fetch-url", fetchUrlRoutes);

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`🔥 Eloria AI running on http://localhost:${PORT}`);
});
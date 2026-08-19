import express from "express";
import cors from "cors";
import http from "http";
import "dotenv/config";

import chatRoutes from "./routes/chat.js";
import codeRoutes from "./routes/code.js";
import membershipRoutes from "./routes/membership.js";
import paymentsRoutes from "./routes/payments.js";
import groupChatRoutes from "./routes/groupChat.js";
import voiceRoutes from "./routes/voice.js";
import fetchUrlRoutes from "./routes/fetchUrl.route.js";
import docsRoutes from "./routes/docs.js";
import authRoutes from "./routes/auth.js";
import cliAuthRoutes from "./routes/cli-auth.js";
import connectorsRoutes from "./routes/connectors.js";
import browserRoutes from "./routes/browser.js";
import { startSubscriptionCron } from "./services/subscriptionCron.js";
import { attachBrowserScreencastProxy } from "./services/browserWsProxy.js";

const app = express();

app.use(cors());

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
app.use("/api/docs", docsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", cliAuthRoutes);
app.use("/api/connectors", connectorsRoutes);
app.use("/api/browser", browserRoutes);

const PORT = process.env.PORT || 5001;

// Raw HTTP server (instead of app.listen) so we can also handle the
// WebSocket upgrade for the live browser screencast proxy.
const server = http.createServer(app);
attachBrowserScreencastProxy(server);

server.listen(PORT, () => {
  console.log(`🔥 Eloria AI running on http://localhost:${PORT}`);
  startSubscriptionCron();
});
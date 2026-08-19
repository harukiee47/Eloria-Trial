import { WebSocketServer, WebSocket } from "ws";
import { auth } from "../config/firebaseAdmin.js";

const BROWSER_BACKEND_WS_URL = process.env.BROWSER_BACKEND_WS_URL; // e.g. wss://eloria-web-backend.onrender.com
const SHARED_SECRET = process.env.BROWSER_SHARED_SECRET;

/**
 * Attaches a WS endpoint at /api/browser/screencast on the given HTTP server.
 * Frontend connects with: wss://<main-backend>/api/browser/screencast?sessionId=...&token=<firebaseIdToken>
 *
 * The main backend verifies the Firebase token itself (so the frontend never
 * sees BROWSER_SHARED_SECRET), then opens its own upstream WS connection to
 * the Render browser backend using the shared secret, and pipes frames through.
 */
export function attachBrowserScreencastProxy(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/api/browser/screencast") return; // let other upgrade handlers deal with it

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req, url);
    });
  });

  wss.on("connection", async (clientWs, req, url) => {
    const sessionId = url.searchParams.get("sessionId");
    const token = url.searchParams.get("token");

    if (!sessionId || !token) {
      clientWs.close(4000, "sessionId and token are required");
      return;
    }

    let uid;
    try {
      const decoded = await auth.verifyIdToken(token);
      uid = decoded.uid;
    } catch (err) {
      clientWs.close(4001, "Invalid or expired token");
      return;
    }

    const upstreamUrl = `${BROWSER_BACKEND_WS_URL}/session/screencast?sessionId=${encodeURIComponent(
      sessionId
    )}&secret=${encodeURIComponent(SHARED_SECRET)}`;

    const upstreamWs = new WebSocket(upstreamUrl);

    upstreamWs.on("open", () => {
      console.log(`🎥 Browser screencast proxy opened for uid=${uid} session=${sessionId}`);
    });

    upstreamWs.on("message", (data) => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.send(data.toString());
      }
    });

    upstreamWs.on("close", (code, reason) => {
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.close(4002, "Upstream closed");
      }
    });

    upstreamWs.on("error", (err) => {
      console.error("Upstream screencast WS error:", err.message);
      if (clientWs.readyState === clientWs.OPEN) {
        clientWs.close(4003, "Upstream error");
      }
    });

    clientWs.on("close", () => {
      try {
        upstreamWs.close();
      } catch {}
    });

    clientWs.on("error", () => {
      try {
        upstreamWs.close();
      } catch {}
    });
  });
}
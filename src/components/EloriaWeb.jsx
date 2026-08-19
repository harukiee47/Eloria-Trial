import React, { useState, useRef, useEffect, useCallback } from "react";
import { auth } from "../services/firebase";

const MAIN_BACKEND_URL = "https://eloria-trial.onrender.com";
const MAIN_BACKEND_WS_URL = "wss://eloria-trial.onrender.com";

async function authedFetch(path, opts = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${MAIN_BACKEND_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export default function EloriaWeb({ onBack }) {
  const [sessionId, setSessionId] = useState(null);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | starting | live | error | closed
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Session start karo, phir mujhe batao kya karna hai — main browser control karunga aur yahin live dikhega." },
  ]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);

  const closeWs = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.close(); } catch {}
      wsRef.current = null;
    }
  }, []);

  const connectScreencast = useCallback(async (sid) => {
    const token = await auth.currentUser.getIdToken();
    const ws = new WebSocket(
      `${MAIN_BACKEND_WS_URL}/api/browser/screencast?sessionId=${encodeURIComponent(sid)}&token=${encodeURIComponent(token)}`
    );
    wsRef.current = ws;

    ws.onopen = () => setStatus("live");
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "frame" && msg.data) {
          setFrame(`data:image/jpeg;base64,${msg.data}`);
        }
      } catch {}
    };
    ws.onerror = () => setError("Live view connection error.");
    ws.onclose = () => {
      if (wsRef.current === ws) wsRef.current = null;
    };
  }, []);

  const startSession = async () => {
    setStatus("starting");
    setError("");
    try {
      const data = await authedFetch("/api/browser/session/start", { method: "POST" });
      setSessionId(data.sessionId);
      await connectScreencast(data.sessionId);
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  const closeSession = async () => {
    closeWs();
    if (sessionId) {
      try {
        await authedFetch("/api/browser/session/close", {
          method: "POST",
          body: JSON.stringify({ sessionId }),
        });
      } catch {}
    }
    setSessionId(null);
    setFrame(null);
    setStatus("closed");
  };

  useEffect(() => {
    return () => closeWs();
  }, [closeWs]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    if (!sessionId) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Pehle \"Start Session\" dabao, phir main is instruction pe act karunga." }]);
      return;
    }

    try {
      await authedFetch("/api/browser/session/action", {
        method: "POST",
        body: JSON.stringify({ sessionId, action: "instruct", params: { text } }),
      });
      setMessages((prev) => [...prev, { role: "assistant", text: "Samajh gaya, kar raha hoon — live view mein dekho." }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err.message}` }]);
    }
  };

  return (
    <div className="eweb-shell">
      <style>{`
        .eweb-shell { display: flex; height: 100vh; width: 100vw; background: #0f0f0f; color: #eee; font-family: inherit; }
        .eweb-chat { width: 360px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #2a2a2a; background: #161616; }
        .eweb-chat-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2a2a2a; }
        .eweb-chat-hdr h3 { margin: 0; font-size: 15px; }
        .eweb-back { background: none; border: none; color: #999; cursor: pointer; font-size: 13px; }
        .eweb-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .eweb-msg { max-width: 88%; padding: 8px 12px; border-radius: 10px; font-size: 13.5px; line-height: 1.4; }
        .eweb-msg.user { align-self: flex-end; background: #2563eb; color: #fff; }
        .eweb-msg.assistant { align-self: flex-start; background: #232323; color: #ddd; }
        .eweb-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #2a2a2a; }
        .eweb-input-row input { flex: 1; background: #1f1f1f; border: 1px solid #333; border-radius: 8px; padding: 9px 12px; color: #eee; font-size: 13.5px; outline: none; }
        .eweb-input-row button { background: #2563eb; border: none; border-radius: 8px; padding: 0 14px; color: #fff; cursor: pointer; font-size: 13px; }
        .eweb-view { flex: 1; display: flex; flex-direction: column; }
        .eweb-toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #2a2a2a; background: #161616; }
        .eweb-status { font-size: 12px; color: #999; }
        .eweb-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .eweb-dot.live { background: #22c55e; }
        .eweb-dot.idle { background: #666; }
        .eweb-dot.error { background: #ef4444; }
        .eweb-btn { background: #2563eb; border: none; border-radius: 6px; padding: 6px 12px; color: #fff; cursor: pointer; font-size: 12.5px; }
        .eweb-btn.danger { background: #7f1d1d; }
        .eweb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .eweb-canvas { flex: 1; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; }
        .eweb-canvas img { max-width: 100%; max-height: 100%; }
        .eweb-placeholder { color: #666; font-size: 13.5px; text-align: center; }
        .eweb-error { color: #f87171; font-size: 12.5px; padding: 8px 16px; }
      `}</style>

      <div className="eweb-chat">
        <div className="eweb-chat-hdr">
          <h3>Eloria Web</h3>
          {onBack && <button className="eweb-back" onClick={onBack}>← Back</button>}
        </div>
        <div className="eweb-msgs">
          {messages.map((m, i) => (
            <div key={i} className={`eweb-msg ${m.role}`}>{m.text}</div>
          ))}
        </div>
        <div className="eweb-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
            placeholder="Browser ko kya karna hai bolo..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>

      <div className="eweb-view">
        <div className="eweb-toolbar">
          <span className="eweb-status">
            <span className={`eweb-dot ${status === "live" ? "live" : status === "error" ? "error" : "idle"}`} />
            {status === "idle" && "Not started"}
            {status === "starting" && "Starting session..."}
            {status === "live" && "Live"}
            {status === "closed" && "Closed"}
            {status === "error" && "Error"}
          </span>
          {status !== "live" && status !== "starting" && (
            <button className="eweb-btn" onClick={startSession}>Start Session</button>
          )}
          {(status === "live" || status === "starting") && (
            <button className="eweb-btn danger" onClick={closeSession}>Close Session</button>
          )}
        </div>
        {error && <div className="eweb-error">{error}</div>}
        <div className="eweb-canvas">
          {frame ? (
            <img src={frame} alt="Live browser view" />
          ) : (
            <div className="eweb-placeholder">
              {status === "starting" ? "Connecting to browser..." : "Start a session to see the live browser view here."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

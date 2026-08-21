import React, { useState, useRef, useEffect, useCallback } from "react";
import { auth } from "../services/firebase";

const MAIN_BACKEND_URL = "https://eloria-trial.onrender.com";
const MAIN_BACKEND_WS_URL = "wss://eloria-trial.onrender.com";

// Must match the viewport size used by the Playwright session (browserSession.js).
const VIEWPORT_W = 1280;
const VIEWPORT_H = 800;

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
  const [agentRunning, setAgentRunning] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Session start karo — uske baad browser khud google.com pe khul jayega. Phir mujhe koi bhi kaam bolo (kisi bhi zubaan mein), main karke dikha dunga. Jab main busy na hoon, tum khud bhi mouse/keyboard se browser control kar sakte ho." },
  ]);
  const [input, setInput] = useState("");
  const wsRef = useRef(null);
  const imgRef = useRef(null);
  const mouseDownRef = useRef(false);
  const msgsEndRef = useRef(null);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    setAgentRunning(false);
  };

  useEffect(() => {
    return () => closeWs();
  }, [closeWs]);

  // ── AI agent instruction ──────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    if (!sessionId) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Pehle \"Start Session\" dabao, phir is instruction pe act karunga." }]);
      return;
    }

    setAgentRunning(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "Kar raha hoon...", pending: true }]);

    try {
      const data = await authedFetch("/api/browser/session/agent", {
        method: "POST",
        body: JSON.stringify({ sessionId, instruction: text }),
      });

      setMessages((prev) => {
        const withoutPending = prev.filter((m) => !m.pending);
        return [
          ...withoutPending,
          { role: "assistant", text: data.summary || "Ho gaya.", downloads: data.downloads || [] },
        ];
      });
    } catch (err) {
      setMessages((prev) => {
        const withoutPending = prev.filter((m) => !m.pending);
        return [...withoutPending, { role: "assistant", text: `Error: ${err.message}` }];
      });
    } finally {
      setAgentRunning(false);
    }
  };

  // ── Manual mouse/keyboard control (only when agent isn't running) ─────
  const toPageCoords = (e) => {
    const el = imgRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const scaleX = VIEWPORT_W / rect.width;
    const scaleY = VIEWPORT_H / rect.height;
    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);
    return { x, y };
  };

  const manualAction = async (action, params) => {
    if (!sessionId || agentRunning) return;
    try {
      await authedFetch("/api/browser/session/action", {
        method: "POST",
        body: JSON.stringify({ sessionId, action, params }),
      });
    } catch {
      // Silently ignore — likely locked by the agent, or a transient error.
    }
  };

  const handleMouseDown = (e) => {
    if (agentRunning) return;
    mouseDownRef.current = true;
    const pos = toPageCoords(e);
    if (pos) manualAction("mouse_down", pos);
  };

  const handleMouseUp = (e) => {
    if (agentRunning) return;
    mouseDownRef.current = false;
    const pos = toPageCoords(e);
    if (pos) manualAction("mouse_up", pos);
  };

  const handleClick = (e) => {
    if (agentRunning) return;
    const pos = toPageCoords(e);
    if (pos) manualAction("mouse_click", pos);
  };

  const lastMoveRef = useRef(0);
  const handleMouseMove = (e) => {
    if (agentRunning) return;
    const now = Date.now();
    if (now - lastMoveRef.current < 60) return; // throttle
    lastMoveRef.current = now;
    const pos = toPageCoords(e);
    if (pos) manualAction("mouse_move", pos);
  };

  const handleWheel = (e) => {
    if (agentRunning) return;
    e.preventDefault();
    manualAction("mouse_wheel", { deltaY: e.deltaY });
  };

  const handleKeyDown = (e) => {
    if (agentRunning || !sessionId) return;
    const specialKeys = ["Enter", "Backspace", "Tab", "Escape", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Delete"];
    if (specialKeys.includes(e.key)) {
      e.preventDefault();
      manualAction("key", { press: e.key });
    } else if (e.key.length === 1) {
      e.preventDefault();
      manualAction("key", { text: e.key });
    }
  };

  const canControl = status === "live" && !agentRunning;

  return (
    <div className="eweb-shell">
      <style>{`
        .eweb-shell { display: flex; height: 100vh; width: 100vw; background: #0f0f0f; color: #eee; font-family: inherit; }
        .eweb-chat { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid #2a2a2a; background: #161616; }
        .eweb-chat-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #2a2a2a; }
        .eweb-chat-hdr h3 { margin: 0; font-size: 15px; }
        .eweb-back { background: none; border: none; color: #999; cursor: pointer; font-size: 13px; }
        .eweb-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .eweb-msg { max-width: 92%; padding: 8px 12px; border-radius: 10px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; }
        .eweb-msg.user { align-self: flex-end; background: #2563eb; color: #fff; }
        .eweb-msg.assistant { align-self: flex-start; background: #232323; color: #ddd; }
        .eweb-msg.pending { opacity: 0.6; font-style: italic; }
        .eweb-dl { display: block; margin-top: 6px; font-size: 12.5px; color: #60a5fa; text-decoration: underline; }
        .eweb-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #2a2a2a; }
        .eweb-input-row input { flex: 1; background: #1f1f1f; border: 1px solid #333; border-radius: 8px; padding: 9px 12px; color: #eee; font-size: 13.5px; outline: none; }
        .eweb-input-row input:disabled { opacity: 0.5; }
        .eweb-input-row button { background: #2563eb; border: none; border-radius: 8px; padding: 0 14px; color: #fff; cursor: pointer; font-size: 13px; }
        .eweb-input-row button:disabled { opacity: 0.5; cursor: not-allowed; }
        .eweb-view { flex: 1; display: flex; flex-direction: column; }
        .eweb-toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid #2a2a2a; background: #161616; }
        .eweb-status { font-size: 12px; color: #999; display: flex; align-items: center; }
        .eweb-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .eweb-dot.live { background: #22c55e; }
        .eweb-dot.idle { background: #666; }
        .eweb-dot.error { background: #ef4444; }
        .eweb-mode { font-size: 11.5px; padding: 3px 9px; border-radius: 12px; margin-left: 10px; }
        .eweb-mode.agent { background: #7c3aed33; color: #a78bfa; }
        .eweb-mode.manual { background: #16a34a33; color: #4ade80; }
        .eweb-btn { background: #2563eb; border: none; border-radius: 6px; padding: 6px 12px; color: #fff; cursor: pointer; font-size: 12.5px; }
        .eweb-btn.danger { background: #7f1d1d; }
        .eweb-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .eweb-canvas { flex: 1; display: flex; align-items: center; justify-content: center; background: #000; overflow: hidden; position: relative; }
        .eweb-canvas img { max-width: 100%; max-height: 100%; cursor: default; }
        .eweb-canvas img.controllable { cursor: pointer; }
        .eweb-placeholder { color: #666; font-size: 13.5px; text-align: center; }
        .eweb-error { color: #f87171; font-size: 12.5px; padding: 8px 16px; }
        .eweb-locked-badge { position: absolute; top: 12px; right: 12px; background: #7c3aed; color: #fff; font-size: 11.5px; padding: 4px 10px; border-radius: 12px; }
      `}</style>

      <div className="eweb-chat">
        <div className="eweb-chat-hdr">
          <h3>Eloria Web</h3>
          {onBack && <button className="eweb-back" onClick={onBack}>← Back</button>}
        </div>
        <div className="eweb-msgs">
          {messages.map((m, i) => (
            <div key={i} className={`eweb-msg ${m.role}${m.pending ? " pending" : ""}`}>
              {m.text}
              {m.downloads && m.downloads.length > 0 && m.downloads.map((d, j) => (
                <a key={j} className="eweb-dl" href={`${MAIN_BACKEND_URL}${d.downloadUrl}`} target="_blank" rel="noopener noreferrer">
                  ⬇ {d.filename}
                </a>
              ))}
            </div>
          ))}
          <div ref={msgsEndRef} />
        </div>
        <div className="eweb-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !agentRunning) sendMessage(); }}
            placeholder={agentRunning ? "Kaam ho raha hai..." : "Browser ko kya karna hai bolo..."}
            disabled={agentRunning}
          />
          <button onClick={sendMessage} disabled={agentRunning}>Send</button>
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
            {status === "live" && (
              <span className={`eweb-mode ${agentRunning ? "agent" : "manual"}`}>
                {agentRunning ? "AI is in control" : "Manual control (you)"}
              </span>
            )}
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
            <img
              ref={imgRef}
              src={frame}
              alt="Live browser view"
              className={canControl ? "controllable" : ""}
              tabIndex={0}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              onWheel={handleWheel}
              onKeyDown={handleKeyDown}
            />
          ) : (
            <div className="eweb-placeholder">
              {status === "starting" ? "Connecting to browser..." : "Start a session to see the live browser view here."}
            </div>
          )}
          {agentRunning && <div className="eweb-locked-badge">AI busy — click to control after it finishes</div>}
        </div>
      </div>
    </div>
  );
}

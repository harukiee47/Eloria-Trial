import React, { useState, useRef, useEffect, useCallback } from "react";
import { auth } from "../services/firebase";
import { applyStoredTheme } from "./SettingsModal";

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

const WELCOME_TEXT =
  "Start a session and the browser will open google.com for you. Then just tell me what to do, in any language, and I'll carry it out. When I'm not busy, you can also control the browser yourself with your mouse and keyboard.";

export default function EloriaWeb({ onBack }) {
  const [sessionId, setSessionId] = useState(null);
  const [frame, setFrame] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | starting | live | error | closed
  const [error, setError] = useState("");
  const [agentRunning, setAgentRunning] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", text: WELCOME_TEXT },
  ]);
  const [input, setInput] = useState("");
  const [tabs, setTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(0);
  const wsRef = useRef(null);
  const imgRef = useRef(null);
  const mouseDownRef = useRef(false);
  const msgsEndRef = useRef(null);

  useEffect(() => {
    applyStoredTheme();
  }, []);

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

  const applyPageState = (state) => {
    if (!state) return;
    if (Array.isArray(state.tabs)) setTabs(state.tabs);
    if (typeof state.activeTab === "number") setActiveTab(state.activeTab);
  };

  const startSession = async () => {
    setStatus("starting");
    setError("");
    try {
      const data = await authedFetch("/api/browser/session/start", { method: "POST" });
      setSessionId(data.sessionId);
      await connectScreencast(data.sessionId);
      setTabs([{ index: 0, url: "https://www.google.com", title: "Google", active: true }]);
      setActiveTab(0);
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
    setTabs([]);
  };

  useEffect(() => {
    return () => closeWs();
  }, [closeWs]);

  // ── Tabs ────────────────────────────────────────────────────────────
  const switchTab = async (index) => {
    if (!sessionId || agentRunning || index === activeTab) return;
    try {
      const data = await authedFetch("/api/browser/session/action", {
        method: "POST",
        body: JSON.stringify({ sessionId, action: "switch_tab", params: { index } }),
      });
      applyPageState(data.result || data);
    } catch {}
  };

  const openNewTab = async () => {
    if (!sessionId || agentRunning) return;
    try {
      const data = await authedFetch("/api/browser/session/action", {
        method: "POST",
        body: JSON.stringify({ sessionId, action: "open_tab", params: {} }),
      });
      applyPageState(data.result || data);
    } catch {}
  };

  const closeTab = async (index, e) => {
    e.stopPropagation();
    if (!sessionId || agentRunning) return;
    try {
      const data = await authedFetch("/api/browser/session/action", {
        method: "POST",
        body: JSON.stringify({ sessionId, action: "close_tab", params: { index } }),
      });
      applyPageState(data.result || data);
    } catch {}
  };

  // ── AI agent instruction ──────────────────────────────────────────────
  const sendMessage = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);

    if (!sessionId) {
      setMessages((prev) => [...prev, { role: "assistant", text: "Start a session first, then I can act on this." }]);
      return;
    }

    setAgentRunning(true);
    setMessages((prev) => [...prev, { role: "assistant", text: "Working on it...", pending: true, trail: [] }]);

    try {
      const data = await authedFetch("/api/browser/session/agent", {
        method: "POST",
        body: JSON.stringify({ sessionId, instruction: text }),
      });

      setMessages((prev) => {
        const withoutPending = prev.filter((m) => !m.pending);
        return [
          ...withoutPending,
          {
            role: "assistant",
            text: data.summary || "Done.",
            downloads: data.downloads || [],
            trail: data.steps || [],
          },
        ];
      });

      try {
        const state = await authedFetch("/api/browser/session/action", {
          method: "POST",
          body: JSON.stringify({ sessionId, action: "list_tabs", params: {} }),
        });
        applyPageState(state.result || state);
      } catch {}
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
        :root {
          --font: 'DM Sans', system-ui, sans-serif;
          --bg-app:      #f5f0ea;
          --bg-strip:    #ede8e1;
          --bg-panel:    #fdfaf6;
          --bg-chat:     #FBF6F0;
          --bg-card:     #ffffff;
          --bg-card-2:   #faf7f2;
          --border:      #cdd0c9;
          --border-soft: #dde0d9;
          --t1: #0D3A35;
          --t2: #3a5a55;
          --t3: #7a8a84;
          --accent:      #276152;
          --accent-bg:   #eaf2ef;
          --accent-deep: #1a4a3d;
          --accent-fg:   #ffffff;
          --danger:      #c04040;
          --danger-bg:   #fdf0f0;
        }
        [data-theme="dark"] {
          --bg-app:      #0e0f0e;
          --bg-strip:    #161716;
          --bg-panel:    #1a1b1a;
          --bg-chat:     #0e0f0e;
          --bg-card:     #212221;
          --bg-card-2:   #262726;
          --border:      #333433;
          --border-soft: #2a2b2a;
          --t1: #f2f2f0;
          --t2: #c7c8c5;
          --t3: #8c8d8a;
          --accent:      #3fb083;
          --accent-bg:   #17251f;
          --accent-deep: #57c797;
          --accent-fg:   #06110c;
          --danger:      #e5787a;
          --danger-bg:   #2a1717;
        }
        * { box-sizing: border-box; }
        .eweb-shell { display: flex; height: 100vh; width: 100vw; background: var(--bg-app); color: var(--t1); font-family: var(--font); }

        .eweb-chat { width: 380px; flex-shrink: 0; display: flex; flex-direction: column; border-right: 1px solid var(--border); background: var(--bg-panel); }
        .eweb-chat-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
        .eweb-chat-hdr h3 { margin: 0; font-size: 15px; color: var(--t1); }
        .eweb-back { background: none; border: none; color: var(--t3); cursor: pointer; font-size: 13px; }
        .eweb-back:hover { color: var(--accent); }

        .eweb-msgs { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
        .eweb-msg { max-width: 92%; padding: 9px 13px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; }
        .eweb-msg.user { align-self: flex-end; background: var(--accent); color: var(--accent-fg); }
        .eweb-msg.assistant { align-self: flex-start; background: var(--bg-card); color: var(--t1); border: 1px solid var(--border-soft); }
        .eweb-msg.pending { opacity: 0.75; font-style: italic; }
        .eweb-dl { display: block; margin-top: 6px; font-size: 12.5px; color: var(--accent); text-decoration: underline; }

        .eweb-trail { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-soft); display: flex; flex-direction: column; gap: 4px; }
        .eweb-trail-item { display: flex; align-items: center; gap: 7px; font-size: 12px; color: var(--t2); }
        .eweb-trail-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .eweb-trail-dot.done { background: var(--accent); }
        .eweb-trail-dot.error { background: var(--danger); }
        .eweb-trail-dot.pending { background: var(--t3); }

        .eweb-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border); }
        .eweb-input-row input { flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 13px; color: var(--t1); font-size: 13.5px; outline: none; font-family: var(--font); }
        .eweb-input-row input::placeholder { color: var(--t3); }
        .eweb-input-row input:focus { border-color: var(--accent); }
        .eweb-input-row input:disabled { opacity: 0.6; }
        .eweb-send-btn { background: var(--accent); border: none; border-radius: 10px; width: 40px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: var(--accent-fg); cursor: pointer; transition: background .14s; }
        .eweb-send-btn:hover:not(:disabled) { background: var(--accent-deep); }
        .eweb-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .eweb-view { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .eweb-toolbar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); background: var(--bg-panel); }
        .eweb-status { font-size: 12px; color: var(--t3); display: flex; align-items: center; }
        .eweb-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
        .eweb-dot.live { background: var(--accent); }
        .eweb-dot.idle { background: var(--t3); }
        .eweb-dot.error { background: var(--danger); }
        .eweb-mode { font-size: 11.5px; padding: 3px 9px; border-radius: 12px; margin-left: 10px; }
        .eweb-mode.agent { background: var(--accent-bg); color: var(--accent); }
        .eweb-mode.manual { background: var(--border-soft); color: var(--t2); }
        .eweb-btn { background: var(--accent); border: none; border-radius: 8px; padding: 7px 14px; color: var(--accent-fg); cursor: pointer; font-size: 12.5px; font-weight: 600; }
        .eweb-btn:hover:not(:disabled) { background: var(--accent-deep); }
        .eweb-btn.danger { background: var(--danger); }
        .eweb-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .eweb-tabbar { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg-app); overflow-x: auto; }
        .eweb-tab { display: flex; align-items: center; gap: 6px; max-width: 180px; padding: 6px 10px; border-radius: 8px; background: var(--bg-card-2); border: 1px solid var(--border-soft); font-size: 12px; color: var(--t2); cursor: pointer; white-space: nowrap; }
        .eweb-tab.active { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); font-weight: 600; }
        .eweb-tab span.eweb-tab-title { overflow: hidden; text-overflow: ellipsis; max-width: 130px; }
        .eweb-tab-close { opacity: 0.6; cursor: pointer; font-size: 13px; line-height: 1; }
        .eweb-tab-close:hover { opacity: 1; }
        .eweb-tab-add { flex-shrink: 0; width: 26px; height: 26px; border-radius: 8px; border: 1px dashed var(--border); background: none; color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 15px; }
        .eweb-tab-add:hover:not(:disabled) { color: var(--accent); border-color: var(--accent); }
        .eweb-tab-add:disabled { opacity: 0.4; cursor: not-allowed; }

        .eweb-canvas { flex: 1; display: flex; align-items: center; justify-content: center; background: var(--bg-card); overflow: hidden; position: relative; }
        .eweb-canvas img { max-width: 100%; max-height: 100%; cursor: default; }
        .eweb-canvas img.controllable { cursor: pointer; }
        .eweb-placeholder { color: var(--t3); font-size: 13.5px; text-align: center; }
        .eweb-error { color: var(--danger); font-size: 12.5px; padding: 8px 16px; background: var(--danger-bg); }
        .eweb-locked-badge { position: absolute; top: 12px; right: 12px; background: var(--accent); color: var(--accent-fg); font-size: 11.5px; padding: 4px 10px; border-radius: 12px; }
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
              {m.trail && m.trail.length > 0 && (
                <div className="eweb-trail">
                  {m.trail.map((s, j) => (
                    <div key={j} className="eweb-trail-item">
                      <span className={`eweb-trail-dot ${s.status || "done"}`} />
                      {s.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={msgsEndRef} />
        </div>
        <div className="eweb-input-row">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !agentRunning) sendMessage(); }}
            placeholder={agentRunning ? "Working on it..." : "Tell me what to do in the browser..."}
            disabled={agentRunning}
          />
          <button className="eweb-send-btn" onClick={sendMessage} disabled={agentRunning} aria-label="Send" title="Send">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
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

        {status === "live" && tabs.length > 0 && (
          <div className="eweb-tabbar">
            {tabs.map((t) => (
              <div
                key={t.index}
                className={`eweb-tab${t.index === activeTab ? " active" : ""}`}
                onClick={() => switchTab(t.index)}
                title={t.url}
              >
                <span className="eweb-tab-title">{t.title || t.url || "New tab"}</span>
                {tabs.length > 1 && (
                  <span className="eweb-tab-close" onClick={(e) => closeTab(t.index, e)}>×</span>
                )}
              </div>
            ))}
            <button className="eweb-tab-add" onClick={openNewTab} disabled={agentRunning} title="New tab">+</button>
          </div>
        )}

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

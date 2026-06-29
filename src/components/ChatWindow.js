import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import logo from "../assets/logo.png";
import { auth } from "../services/firebase";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";

const GREETINGS = [
  { label: "Good to have you back.", name: true,  sub: "What can I help you with today?" },
  { label: "What are you working on?", name: false, sub: "I'm ready whenever you are." },
  { label: "Eloria is ready.",         name: false, sub: "Ask me anything — I'll do my best." },
];

const ATTACH_TYPES = {
  image: {
    accept: "image/jpeg,image/png,image/gif,image/webp",
    exts: ["jpg","jpeg","png","gif","webp"],
    label: "Image",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  document: {
    accept: ".pdf,.doc,.docx,.txt",
    exts: ["pdf","doc","docx","txt"],
    label: "Document",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
};

function getAttachKind(file) {
  if (file.type.startsWith("image/")) return "image";
  if (
    file.type === "application/pdf" ||
    file.type === "application/msword" ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.type === "text/plain" ||
    file.name.endsWith(".pdf") ||
    file.name.endsWith(".docx") ||
    file.name.endsWith(".doc") ||
    file.name.endsWith(".txt")
  ) return "document";
  return null;
}

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function docIcon(ext) {
  const map = {
    PDF:  { bg: "#fff1f1", color: "#e53e3e", char: "PDF" },
    TXT:  { bg: "#f0f4ff", color: "#4a6cf7", char: "TXT" },
    DOC:  { bg: "#eff6ff", color: "#2563eb", char: "DOC" },
    DOCX: { bg: "#eff6ff", color: "#2563eb", char: "DOC" },
  };
  return map[ext] || { bg: "#f5f5f0", color: "#888", char: ext.slice(0,3) };
}

function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
  return (text.match(urlRegex) || []).filter(u => {
    try { new URL(u); return true; } catch { return false; }
  });
}

function detectCodeBlocks(text) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1] || "txt";
    const code = match[2];
    if (code.trim().length > 50) {
      const extMap = {
        javascript: "js", js: "js", typescript: "ts", ts: "ts",
        python: "py", py: "py", css: "css", html: "html",
        jsx: "jsx", tsx: "tsx", json: "json", bash: "sh",
        sh: "sh", sql: "sql", java: "java", cpp: "cpp", c: "c",
      };
      blocks.push({ lang, code, ext: extMap[lang.toLowerCase()] || "txt" });
    }
  }
  return blocks;
}

function detectDocBlocks(text) {
  const regex = /```document\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) blocks.push(match[1].trim());
  return blocks;
}

function detectPresentationBlocks(text) {
  const regex = /```presentation\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  while ((match = regex.exec(text)) !== null) blocks.push(match[1].trim());
  return blocks;
}

async function generateDocx(rawText, filename) {
  const res = await fetch("/api/docs/generate-doc", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: rawText, filename }),
  });
  if (!res.ok) { alert("Failed to generate document"); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function generatePptx(rawText, filename) {
  const res = await fetch("/api/docs/generate-pptx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: rawText, filename }),
  });
  if (!res.ok) { alert("Failed to generate presentation"); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function classifyMessage({ text, hasFiles }) {
  const t = (text || "").toLowerCase();
  const hasCode = /```|function |const |let |var |def |class |import |require|<[a-z]+>/.test(text);
  const hasUrl = /https?:\/\//.test(text);
  const isSearch = /search|look up|find|latest|news|current|today|who is|what is the price|weather|stock/.test(t);
  const isLong = text.length > 200 || t.split(" ").length > 40;
  const isSimple = !hasCode && !hasUrl && !isSearch && !hasFiles && !isLong && text.length < 120;
  return { hasCode, hasUrl, isSearch, isLong, isSimple };
}

function buildActivitySteps({ text = "", hasFiles = false }) {
  const { hasCode, hasUrl, isSearch, isLong, isSimple } = classifyMessage({ text, hasFiles });
  const t = (text || "").toLowerCase();
  if (isSimple) return [];
  const steps = [];
  if (hasFiles) steps.push({ icon: "file", text: "Reading your file", badge: "Script", badgeType: "code" });
  if (hasCode) {
    steps.push({ icon: "code", text: "Reading your code", badge: "Script", badgeType: "code" });
    steps.push({ icon: "zoom", text: "Analyzing the logic", badge: "Script", badgeType: "code" });
    if (t.includes("fix") || t.includes("bug") || t.includes("error") || t.includes("broken"))
      steps.push({ icon: "tool", text: "Identifying the issue", badge: "Script", badgeType: "code" });
  }
  if (hasUrl) steps.push({ icon: "world", text: "Fetching the link", badge: "Web", badgeType: "web" });
  if (isSearch) {
    steps.push({ icon: "search", text: "Searching the web", badge: "Web", badgeType: "web" });
    steps.push({ icon: "news", text: "Reading results", badge: "Web", badgeType: "web" });
  }
  if (isLong) steps.push({ icon: "list", text: "Breaking down your question", badge: null, badgeType: null });
  steps.push({ icon: "sparkles", text: "Writing response", badge: null, badgeType: null });
  return steps;
}

function TrailBadge({ label, type }) {
  if (!label) return null;
  const styles = {
    code: { background: "rgba(0,0,0,0.06)", color: "#666", border: "0.5px solid rgba(0,0,0,0.12)" },
    web:  { background: "rgba(24,95,165,0.1)", color: "#185fa5", border: "0.5px solid rgba(24,95,165,0.2)" },
  };
  const s = styles[type] || styles.code;
  return (
    <span style={{
      display: "inline-block", fontSize: 11, fontWeight: 500,
      padding: "2px 9px", borderRadius: 4,
      fontFamily: "var(--font)", letterSpacing: "0.02em", ...s,
    }}>{label}</span>
  );
}

function ActivityBar({ step, steps }) {
  if (!steps || steps.length === 0) return (
    <div className="cw-activity-bar">
      <span className="cw-activity-icon">✦</span>
      <span className="cw-activity-text">Thinking…</span>
      <div className="cw-activity-dots"><span/><span/><span/></div>
    </div>
  );

  const current = steps[Math.min(step, steps.length - 1)];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {steps.slice(0, step).map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(34,134,58,0.08)", border: "0.5px solid rgba(34,134,58,0.2)",
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#22863a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <span style={{ fontSize: 12, color: "var(--t3)", fontFamily: "var(--font)" }}>{s.text}</span>
          {s.badge && <TrailBadge label={s.badge} type={s.badgeType} />}
        </div>
      ))}
      {current && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: step > 0 ? 2 : 0 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, flexShrink: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "#faf8f4", border: "1px solid rgba(193,127,42,.25)",
          }}>
            <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
              {[0,1,2].map(i => (
                <span key={i} style={{
                  width: 3, height: 3, borderRadius: "50%", display: "inline-block",
                  background: "var(--accent)", opacity: 0.6,
                  animation: `cwDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                }}/>
              ))}
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", fontFamily: "var(--font)" }}>{current.text}</span>
          {current.badge && <TrailBadge label={current.badge} type={current.badgeType} />}
        </div>
      )}
    </div>
  );
}

function ActivityTrail({ steps, isOpen, onToggle }) {
  if (!steps || steps.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={onToggle}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", cursor: "pointer",
          padding: "4px 0", fontFamily: "var(--font)",
          color: "var(--t3)", fontSize: 12,
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          width="13" height="13"
          style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform .2s", flexShrink: 0 }}
        >
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span>{steps.length} reasoning {steps.length === 1 ? "step" : "steps"}</span>
      </button>

      {isOpen && (
        <div style={{
          marginTop: 6, paddingLeft: 2,
          display: "flex", flexDirection: "column", gap: 0,
        }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 10, position: "relative" }}>
              {i < steps.length - 1 && (
                <div style={{
                  position: "absolute", left: 11, top: 26, bottom: -2,
                  width: 1, background: "rgba(0,0,0,0.09)",
                }} />
              )}
              <div style={{
                width: 22, height: 22, borderRadius: 6, flexShrink: 0, marginTop: 3,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(34,134,58,0.08)", border: "0.5px solid rgba(34,134,58,0.2)",
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#22863a" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <div style={{ paddingBottom: i < steps.length - 1 ? 12 : 4 }}>
                <div style={{
                  fontSize: 12, color: "var(--t2)",
                  fontFamily: "var(--font)", marginBottom: s.badge ? 4 : 0,
                }}>
                  {s.text}
                </div>
                {s.badge && <TrailBadge label={s.badge} type={s.badgeType} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DownloadCodeButton({ text }) {
  const blocks = detectCodeBlocks(text);
  if (blocks.length === 0) return null;
  const { lang, code, ext } = blocks[0];
  if (code.split("\n").length <= 50) return null;
  const filename = `eloria-output.${ext}`;
  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
return (
  <button 
    className="cw-download-btn" 
    onClick={handleDownload} 
    title={`Download ${filename}`}
  >
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2.2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <span className="cw-download-text">Download {lang}</span>
  </button>
);
}

function DownloadDocButton({ text }) {
  const blocks = detectDocBlocks(text);
  if (blocks.length === 0) return null;
  const handleDownload = () => generateDocx(blocks[0], "eloria-document.docx");
  return (
    <button className="cw-download-btn" onClick={handleDownload} title="Download Word document">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span className="cw-download-text">Download Word doc</span>
    </button>
  );
}

function DownloadPptxButton({ text }) {
  const blocks = detectPresentationBlocks(text);
  if (blocks.length === 0) return null;
  const handleDownload = () => generatePptx(blocks[0], "eloria-presentation.pptx");
  return (
    <button className="cw-download-btn" onClick={handleDownload} title="Download PowerPoint">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      <span className="cw-download-text">Download slides</span>
    </button>
  );
}

function UrlFetchChip({ url, status }) {
  const hostname = (() => { try { return new URL(url).hostname.replace("www.", ""); } catch { return url; } })();
  return (
    <div className="cw-url-chip">
      {status === "loading" ? (
        <><span className="cw-url-spinner"/><span>Reading {hostname}…</span></>
      ) : status === "done" ? (
        <><span className="cw-url-ok">✓</span><span>Read {hostname}</span></>
      ) : (
        <><span className="cw-url-err">✗</span><span>Couldn't read {hostname}</span></>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VOICE MODAL — Gemini-inspired, Eloria dark green + cream theme
// Replace the entire VoiceModal function in ChatWindow.js with this
// ─────────────────────────────────────────────────────────────────────────────

const VOICE_OPTIONS = [
  { id: "aura-asteria-en", label: "Asteria", gender: "Female", tone: "Warm",  greeting: "Hey, I'm Asteria — warm and ready. What's on your mind?" },
  { id: "aura-luna-en",    label: "Luna",    gender: "Female", tone: "Soft",  greeting: "Hi there, I'm Luna — soft and calm. Let's talk." },
  { id: "aura-orion-en",   label: "Orion",   gender: "Male",   tone: "Clear", greeting: "Hey, I'm Orion — clear and focused. Ask me anything." },
  { id: "aura-zeus-en",    label: "Zeus",    gender: "Male",   tone: "Deep",  greeting: "I'm Zeus — deep and direct. What do you need?" },
];

const OPEN_GREETINGS = [
  "Hey, good to hear from you.",
  "Hello! Ready to listen.",
  "Hi there — I'm all ears.",
  "Hey — what's on your mind?",
];

function hexRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

const WAVE_COLORS = {
    idle:       ["#0d3a35","#1a5a52","#0a2e29"],
    listening:  ["#0d6a5e","#00b894","#055a52"],
    processing: ["#2d6a4f","#52b788","#1b4332"],
    speaking:   ["#00b894","#55efc4","#0d6a5e"],
  };


  function getSupportedMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || "";
}


function VoiceModal({ isOpen, onClose, getAuthToken, getMessages, onTranscript, onReply, apiBase }) {
  const pendingScreenshotRef = useRef(null);
  const canvasRef      = useRef(null);
  const animIdRef      = useRef(null);
  const analyserRef    = useRef(null);
  const recorderRef    = useRef(null);
  const streamRef      = useRef(null);
  const audioRef       = useRef(null);
  const chunksRef      = useRef([]);
  const phaseRef       = useRef(0);
  const voiceStateRef  = useRef("idle");
  const selectedVoiceRef = useRef(localStorage.getItem("eloria_voice") || "aura-asteria-en");

  const [screen,        setScreen]        = useState("greet"); // greet | main
  const [voiceState,    setVoiceState]    = useState("idle");
  const [transcript,    setTranscript]    = useState("");
  const [errorMsg,      setErrorMsg]      = useState("");
  const [minimized,     setMinimized]     = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem("eloria_voice") || "aura-asteria-en");
  const [previewingId,  setPreviewingId]  = useState(null);
  const [timerSecs,     setTimerSecs]     = useState(0);
  const timerIntervalRef = useRef(null);

useEffect(() => {
  if (!isOpen) return;

  let activeNotif = null;

  const showNotif = () => {
    if (!document.hidden) return;
    if (Notification.permission !== "granted") return;
    const label = voiceStateRef.current === "listening" ? " Listening to you…"
                : voiceStateRef.current === "speaking"  ? " Speaking…"
                : voiceStateRef.current === "processing"? " Thinking…"
                : "Voice active";
    activeNotif = new Notification("Eloria Voice is active", {
      body: label,
      icon: "/logo.png",
      tag: "eloria-voice-active",
      renotify: true,
      silent: true,
      requireInteraction: true,
    });
    activeNotif.onclick = () => {
      window.focus();
      activeNotif.close();
    };
  };

  const handleVisibility = () => {
    if (document.hidden) {
      if (Notification.permission === "default") {
        Notification.requestPermission().then(p => {
          if (p === "granted") showNotif();
        });
      } else {
        showNotif();
      }
    } else {
      if (activeNotif) { activeNotif.close(); activeNotif = null; }
    }
  };

  // Update notification when voice state changes
  const interval = setInterval(() => {
    if (document.hidden && voiceStateRef.current !== "idle") showNotif();
  }, 2000);

  document.addEventListener("visibilitychange", handleVisibility);
  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
    clearInterval(interval);
    if (activeNotif) activeNotif.close();
  };
}, [isOpen]);

  const STATE_LABELS = {
    idle: "tap to speak", listening: "listening…", processing: "thinking…", speaking: "speaking…",
  };

  const setState = useCallback((s) => {
    voiceStateRef.current = s;
    setVoiceState(s);
  }, []);

  // ── Canvas wave drawing ────────────────────────────────────────────────────
  const drawWaves = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    ctx.clearRect(0, 0, W, H);

    const state = voiceStateRef.current;
    const colors = WAVE_COLORS[state] || WAVE_COLORS.idle;

    let volume = 0;
    if (analyserRef.current) {
      const d = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(d);
      volume = Math.min(1, d.reduce((a,b)=>a+b,0) / d.length / 65);
    }

    const amp = state === "idle"       ? 0.035 + 0.015 * Math.sin(phaseRef.current * 0.8)
              : state === "processing" ? 0.055 + 0.025 * Math.sin(phaseRef.current * 1.4)
              : 0.07 + volume * 0.18;

    // Draw 4 layered waves
    for (let layer = 0; layer < 4; layer++) {
      const freq   = 1.2 + layer * 0.7;
      const offset = layer * (Math.PI * 2 / 4);
      const yAmp   = H * amp * (1 - layer * 0.15);
      const alpha  = state === "idle" ? 0.12 + layer * 0.04 : 0.2 + layer * 0.08;
      const color  = colors[layer % colors.length];

      ctx.beginPath();
      ctx.moveTo(0, cy);
      for (let x = 0; x <= W; x += 3) {
        const t = (x / W) * Math.PI * 2 * freq + phaseRef.current + offset;
        const y = cy + Math.sin(t) * yAmp * (0.6 + 0.4 * Math.sin(phaseRef.current * 0.5 + layer));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      const grad = ctx.createLinearGradient(0, cy - yAmp, 0, H);
      grad.addColorStop(0,   hexRgba(color, alpha));
      grad.addColorStop(0.6, hexRgba(color, alpha * 0.5));
      grad.addColorStop(1,   hexRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Center orb glow
    const orbR = 48 + (state !== "idle" ? volume * 28 + 10 * Math.sin(phaseRef.current * 2) : 6 * Math.sin(phaseRef.current));
    const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 2.2);
    orbGrad.addColorStop(0,   hexRgba(colors[1], state === "idle" ? 0.18 : 0.32));
    orbGrad.addColorStop(0.5, hexRgba(colors[0], 0.1));
    orbGrad.addColorStop(1,   "transparent");
    ctx.fillStyle = orbGrad;
    ctx.fillRect(0, 0, W, H);

    // Orb dot
    const dotR = 28 + (state !== "idle" ? volume * 14 + 3 * Math.sin(phaseRef.current * 2.5) : 3 * Math.sin(phaseRef.current * 1.2));
    const dotGrad = ctx.createRadialGradient(cx - dotR*0.2, cy - dotR*0.2, 0, cx, cy, dotR);
    dotGrad.addColorStop(0,   hexRgba(colors[1], state === "idle" ? 0.55 : 0.9));
    dotGrad.addColorStop(0.7, hexRgba(colors[0], 0.7));
    dotGrad.addColorStop(1,   hexRgba(colors[0], 0));
    ctx.fillStyle = dotGrad;
    ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill();

    const speed = state === "idle" ? 0.01 : state === "processing" ? 0.022 : 0.032 + volume * 0.03;
    phaseRef.current += speed;
  }, []);

  const startAnim = useCallback(() => {
    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    const loop = () => { drawWaves(); animIdRef.current = requestAnimationFrame(loop); };
    loop();
  }, [drawWaves]);

  const stopAnim = useCallback(() => {
    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    animIdRef.current = null;
  }, []);

  // ── Canvas resize ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || screen !== "main") return;
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width  = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isOpen, screen]);

  // ── Open/close ────────────────────────────────────────────────────────────
useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem("eloria_voice");
      if (saved) {
        setScreen("main");
        setTimeout(() => handleContinue(), 100);
      } else {
        setScreen("greet");
      }
      setTranscript(""); setErrorMsg(""); setMinimized(false);
      setTimerSecs(0); setState("idle"); phaseRef.current = 0;
    } else {
      stopAll(); stopAnim(); setState("idle");
      clearInterval(timerIntervalRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && screen === "main" && !minimized) {
      setTimeout(() => {
        const c = canvasRef.current;
        if (c) { c.width = c.offsetWidth; c.height = c.offsetHeight; }
        startAnim();
      }, 50);
    } else if (screen !== "main") {
      stopAnim();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, minimized, isOpen]);

  // ── Recording helpers ──────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioRef.current)  { audioRef.current.pause(); audioRef.current = null; }
    analyserRef.current = null;
  }, []);

  const setupSilence = useCallback((audioCtx, micStream) => {
    const sa = audioCtx.createAnalyser(); sa.fftSize = 512;
    audioCtx.createMediaStreamSource(micStream).connect(sa);
    let silStart = null;
    const t0 = Date.now();
    const check = () => {
      if (!recorderRef.current || recorderRef.current.state === "inactive") return;
      if (!recorderRef.current || recorderRef.current.state === "inactive") return;
if (voiceStateRef.current === "processing") return;
      if (Date.now() - t0 > 30000) { recorderRef.current.stop(); return; }
      const d = new Uint8Array(sa.frequencyBinCount);
      sa.getByteFrequencyData(d);
      const avg = d.reduce((a,b)=>a+b,0)/d.length;
      if (avg < 12) {
        if (!silStart) silStart = Date.now();
        else if (Date.now() - silStart > 900) { recorderRef.current.stop(); return; }
      } else silStart = null;
      setTimeout(check, 100);
    };
    setTimeout(check, 800);
  }, []);

  const captureScreen = useCallback(async () => {
  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { mediaSource: "screen", width: 1280, height: 720 },
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    await video.play();
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    stream.getTracks().forEach(t => t.stop());
    const base64 = canvas.toDataURL("image/png").split(",")[1];
    return base64;
  } catch {
    return null;
  }
}, []);

  const startListening = useCallback(async () => {
   if (voiceStateRef.current === "processing") return;
if (audioRef.current) {
  audioRef.current.pause();
  audioRef.current = null;
  analyserRef.current = null;
  setState("idle");
}
    let micStream;
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setErrorMsg("Microphone access denied."); return; }
    streamRef.current = micStream;
    const audioCtx = new AudioContext();
    const an = audioCtx.createAnalyser(); an.fftSize = 256;
    audioCtx.createMediaStreamSource(micStream).connect(an);
    analyserRef.current = an;
    setState("listening"); setErrorMsg(""); setTranscript("");
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
const recorder = new MediaRecorder(micStream, mimeType ? { mimeType } : {});
    recorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
  recorder.onstop = async () => {
  if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current = null; }
  analyserRef.current = null;
  submitAudio(mimeType);
};
    recorder.start();
    setupSilence(audioCtx, micStream);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupSilence]);

  const submitAudio = useCallback(async (mimeType) => {
  if (chunksRef.current.length === 0) { setState("idle"); return; }
  setState("processing");
  const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
  const fd = new FormData();
  fd.append("audio", blob, "recording.webm");
  fd.append("messages", JSON.stringify(getMessages()));
  fd.append("voice", selectedVoiceRef.current);

  if (pendingScreenshotRef.current) {
    fd.append("screenshot", pendingScreenshotRef.current);
    pendingScreenshotRef.current = null;
  }

  let token;
  try { token = await getAuthToken(); }
  catch { setErrorMsg("Auth error."); setState("idle"); return; }
  let data;
  try {
    const res = await fetch(`${apiBase}/api/voice/turn`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    if (res.status === 429) { setErrorMsg("Daily limit reached."); setState("idle"); return; }
    if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || `Error ${res.status}`); }
    data = await res.json();
  } catch(err) { setErrorMsg(err.message || "Something went wrong."); setState("idle"); return; }
  if (data.transcript) { setTranscript(`"${data.transcript}"`); if (onTranscript) onTranscript(data.transcript); }
if (data.replyText && onReply) onReply(data.replyText);

if (data.needsScreen) {
  setTranscript("Tap to share your screen…");
  setState("idle");
  const screenshot = await captureScreen();
  if (screenshot) {
    pendingScreenshotRef.current = screenshot;
    setTranscript("Got it! Ask your question…");
    setTimeout(startListening, 600);
  } else {
    setTranscript("Screen share cancelled.");
    setTimeout(() => setState("idle"), 2000);
  }
  return;
}

if (data.audioBase64) playAudio(data.audioBase64); else setState("idle");
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [getAuthToken, getMessages, onTranscript, onReply, apiBase]);

  const playAudio = useCallback((base64) => {
    setState("speaking");
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audioRef.current = audio;
    try {
      const actx = new AudioContext();
      const an = actx.createAnalyser(); an.fftSize = 256;
      const src = actx.createMediaElementSource(audio);
      src.connect(an); an.connect(actx.destination);
      analyserRef.current = an;
    } catch {}
    audio.onended = () => { analyserRef.current = null; audioRef.current = null; setState("idle"); setTimeout(startListening, 400); };
    audio.onerror = () => { analyserRef.current = null; audioRef.current = null; setState("idle"); };
    audio.play().catch(() => setState("idle"));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  // ── Voice preview ──────────────────────────────────────────────────────────
  const previewVoice = useCallback(async (voiceId) => {
    if (previewingId) return;
    setPreviewingId(voiceId);
    const v = VOICE_OPTIONS.find(v => v.id === voiceId);
    if (!v) { setPreviewingId(null); return; }
    try {
      const token = await getAuthToken();
      const res = await fetch(`${apiBase}/api/voice/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: v.greeting, voice: voiceId }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          const audio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
          audioRef.current = audio;
          audio.onended = () => { audioRef.current = null; };
          audio.play().catch(() => {});
        }
      }
    } catch {}
    setPreviewingId(null);
  }, [getAuthToken, apiBase, previewingId]);

  // ── Continue from greeting ─────────────────────────────────────────────────
  const handleContinue = useCallback(async () => {
    setScreen("main");
    timerIntervalRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000);
    // Greet user
    setTimeout(async () => {
      const greeting = OPEN_GREETINGS[Math.floor(Math.random() * OPEN_GREETINGS.length)];
      try {
        const token = await getAuthToken();
        const res = await fetch(`${apiBase}/api/voice/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: greeting, voice: selectedVoiceRef.current }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioBase64) { playAudio(data.audioBase64); return; }
        }
      } catch {}
      setState("idle");
      startListening();
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAuthToken, apiBase, playAudio, startListening]);

const endCall = useCallback(() => {
    stopAll(); stopAnim();
    clearInterval(timerIntervalRef.current);
    const mins = String(Math.floor(timerSecs/60)).padStart(2,"0");
    const secs = String(timerSecs%60).padStart(2,"0");
    if (onReply) onReply(` Voice call ended · ${mins}:${secs}`);
    setState("idle"); setScreen("greet");
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll, stopAnim, onClose, timerSecs, onReply]);

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;

  if (!isOpen) return null;

  // ── MINIMIZED PILL ────────────────────────────────────────────────────────
  if (minimized) {
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 9999, display: "flex", alignItems: "center", gap: 12,
      background: "rgba(13,58,53,0.96)", backdropFilter: "blur(20px)",
      borderRadius: 50, padding: "10px 14px 10px 12px",
      boxShadow: "0 8px 40px rgba(13,58,53,0.35), 0 2px 12px rgba(0,0,0,0.2)",
      border: "1px solid rgba(255,255,255,0.1)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      minWidth: 220,
    }}>
      <style>{`
        @keyframes vmSlideUp { from{opacity:0;transform:translateX(-50%) translateY(14px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
        @keyframes vmBarBounce { 0%,100%{transform:scaleY(0.4)} 50%{transform:scaleY(1)} }
        @keyframes vmPulseRing { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.5);opacity:0} }
      `}</style>

      {/* Animated waveform bars */}
      <div style={{ display:"flex", alignItems:"center", gap:2, padding:"0 4px" }}>
        {[0.4,0.7,1,0.6,0.9,0.5,0.8].map((h, i) => (
          <div key={i} style={{
            width: 3, borderRadius: 2,
            background: voiceState === "speaking" ? "#00b894"
                      : voiceState === "listening" ? "#55efc4"
                      : "rgba(255,255,255,0.4)",
            height: voiceState === "idle" ? 4 : undefined,
            animation: voiceState !== "idle" ? `vmBarBounce ${0.6 + i * 0.1}s ease-in-out ${i * 0.08}s infinite` : "none",
            transformOrigin: "center",
            minHeight: 4,
            maxHeight: 20,
            ...(voiceState !== "idle" ? { height: `${10 + h * 14}px` } : {}),
          }} />
        ))}
      </div>

      {/* Label + timer */}
      <div style={{ display:"flex", flexDirection:"column", gap:1, flex:1 }}>
        <span style={{ color:"#fff", fontSize:12.5, fontWeight:600, letterSpacing:"0.01em", lineHeight:1.2 }}>
          Eloria Voice
        </span>
        <span style={{ color:"rgba(255,255,255,0.5)", fontSize:10.5, fontVariantNumeric:"tabular-nums" }}>
          {voiceState === "listening" ? "Listening…"
         : voiceState === "speaking"  ? "Speaking…"
         : voiceState === "processing"? "Thinking…"
         : formatTime(timerSecs)}
        </span>
      </div>

      {/* Restore button */}
      <button
        onClick={() => setMinimized(false)}
        title="Expand"
        style={{
          width:32, height:32, borderRadius:"50%",
          background:"rgba(255,255,255,0.1)",
          border:"1px solid rgba(255,255,255,0.15)",
          color:"rgba(255,255,255,0.8)", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all .15s", flexShrink:0,
        }}
        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.2)"}
        onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.1)"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>

      {/* End button */}
      <button
        onClick={endCall}
        title="End"
        style={{
          width:32, height:32, borderRadius:"50%",
          background:"rgba(229,62,62,0.25)",
          border:"1px solid rgba(229,62,62,0.4)",
          color:"#ff6b6b", cursor:"pointer",
          display:"flex", alignItems:"center", justifyContent:"center",
          transition:"all .15s", flexShrink:0,
        }}
        onMouseEnter={e => e.currentTarget.style.background="rgba(229,62,62,0.45)"}
        onMouseLeave={e => e.currentTarget.style.background="rgba(229,62,62,0.25)"}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

  // ── GREETING SCREEN ───────────────────────────────────────────────────────
  if (screen === "greet") {
    return (
      <div style={{
        position:"fixed", inset:0, zIndex:9999,
        background:"#f5f0e8",
        display:"flex", alignItems:"center", justifyContent:"center",
        fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        overflow:"hidden",
         animation:"vmFadeScale .25s ease",
      }}>
        <style>{`
          @keyframes vmFadeUp { from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)} }
          @keyframes vmPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
          @keyframes vmBg { 0%{opacity:0.7} 100%{opacity:1} }
          @keyframes vmFadeScale { from{opacity:0;transform:scale(0.97)} to{opacity:1;transform:scale(1)} }
          .vm-voice-card:hover { border-color: rgba(13,58,53,0.4) !important; transform: translateY(-2px); box-shadow: 0 6px 20px rgba(13,58,53,0.12) !important; }
        `}</style>

        {/* Soft background blobs */}
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 25% 25%, rgba(13,58,53,0.07) 0%, transparent 55%), radial-gradient(ellipse at 75% 75%, rgba(0,184,148,0.06) 0%, transparent 55%)", animation:"vmBg 6s ease-in-out infinite alternate", pointerEvents:"none" }} />

        <div style={{ position:"relative", zIndex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:24, padding:"32px 20px", width:"100%", maxWidth:500, animation:"vmFadeUp .4s ease" }}>

    

          {/* Big greeting */}
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"Georgia, 'Times New Roman', serif", fontSize:"clamp(44px,10vw,68px)", fontWeight:300, color:"#0d3a35", letterSpacing:"-0.03em", lineHeight:1.05 }}>
              Hello!
            </div>
            <div style={{ fontSize:14, color:"#7a9e8a", marginTop:8 }}>Choose a voice to get started</div>
          </div>

          {/* Voice grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, width:"100%" }}>
            {VOICE_OPTIONS.map(v => (
              <div
                key={v.id}
                className="vm-voice-card"
                onClick={() => { setSelectedVoice(v.id); selectedVoiceRef.current = v.id; localStorage.setItem("eloria_voice", v.id); previewVoice(v.id); }}
                style={{
                  display:"flex", flexDirection:"column", alignItems:"center", gap:8,
                  padding:"18px 12px", cursor:"pointer", textAlign:"center",
                  background: selectedVoice === v.id ? "rgba(13,58,53,0.06)" : "#fff",
                  border: selectedVoice === v.id ? "2px solid #0d3a35" : "1.5px solid rgba(13,58,53,0.12)",
                  borderRadius:16, transition:"all .2s", position:"relative",
                  boxShadow: selectedVoice === v.id ? "0 0 0 3px rgba(13,58,53,0.1), 0 4px 16px rgba(13,58,53,0.1)" : "0 2px 10px rgba(13,58,53,0.05)",
                }}
              >
                {selectedVoice === v.id && (
                  <div style={{ position:"absolute", top:8, right:10, fontSize:11, fontWeight:700, color:"#0d3a35" }}>✓</div>
                )}
                {previewingId === v.id && (
                  <div style={{ position:"absolute", top:8, left:10 }}>
                    <div style={{ width:6, height:6, borderRadius:"50%", background:"#00b894", animation:"vmPulse .8s ease-in-out infinite" }} />
                  </div>
                )}
                <div style={{
                  width:44, height:44, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:18, fontWeight:700, fontFamily:"Georgia, serif",
                  background: v.gender === "Female" ? "rgba(108,92,231,0.1)" : "rgba(13,58,53,0.1)",
                  color: v.gender === "Female" ? "#6C5CE7" : "#0d3a35",
                }}>
                  {v.label[0]}
                </div>
                <div style={{ fontSize:13.5, fontWeight:700, color:"#1a2e20" }}>{v.label}</div>
                <div style={{ fontSize:11, color:"#8a9e8e" }}>{v.gender} · {v.tone}</div>
              </div>
            ))}
          </div>

          <div style={{ fontSize:11, color:"#a0b0a8" }}>Tap a voice to preview it</div>

          {/* Continue */}
          <button
            onClick={handleContinue}
            style={{
              padding:"14px 52px", background:"#0d3a35", color:"#f5f0e8",
              border:"none", borderRadius:40, fontSize:15, fontWeight:600,
              cursor:"pointer", letterSpacing:"0.02em",
              boxShadow:"0 4px 20px rgba(13,58,53,0.35)", transition:"all .2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background="#1a5a52"; e.currentTarget.style.transform="translateY(-1px)"; }}
            onMouseLeave={e => { e.currentTarget.style.background="#0d3a35"; e.currentTarget.style.transform="translateY(0)"; }}
          >
            Continue
          </button>
        </div>
      </div>
    );
  }

  // ── MAIN SCREEN ───────────────────────────────────────────────────────────
  const stateColor = voiceState === "listening" ? "#0d6a5e" : voiceState === "speaking" ? "#00b894" : voiceState === "processing" ? "#2d6a4f" : "rgba(13,58,53,0.4)";

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"#f5f0e8",
      display:"flex", flexDirection:"column",
      fontFamily:"-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      animation:"vmFadeScale .25s ease",
    }}>
      <style>{`
        @keyframes vmFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes vmPulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.85)} }
        @keyframes vmStatusPulse { from{opacity:0.6} to{opacity:1} }
        .vm-ctrl-btn:hover { background: rgba(13,58,53,0.14) !important; }
        .vm-end-btn:hover { background: #c0392b !important; transform: scale(1.05); }
      `}</style>

      {/* Top bar */}
<div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 20px", flexShrink:0 }}>
  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
    <div style={{ width:8, height:8, borderRadius:"50%", background:stateColor, transition:"background .4s", boxShadow: voiceState !== "idle" ? `0 0 8px ${stateColor}` : "none" }} />
    <span style={{ fontSize:12, fontWeight:700, color:"#0d3a35", letterSpacing:"0.06em", textTransform:"uppercase" }}>Eloria Voice</span>
    <span style={{ fontSize:11, color:"rgba(13,58,53,0.4)", fontVariantNumeric:"tabular-nums" }}>{formatTime(timerSecs)}</span>
  </div>
  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
    <button
      onClick={() => { stopAll(); clearInterval(timerIntervalRef.current); setTimerSecs(0); setState("idle"); setScreen("greet"); }}
      title="Change voice"
      style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 12px 5px 8px", borderRadius:20, background:"rgba(13,58,53,0.07)", border:"1px solid rgba(13,58,53,0.13)", color:"#0d3a35", cursor:"pointer", fontSize:11, fontWeight:600, transition:"all .15s" }}
      onMouseEnter={e => e.currentTarget.style.background="rgba(13,58,53,0.13)"}
      onMouseLeave={e => e.currentTarget.style.background="rgba(13,58,53,0.07)"}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
        <path d="M19 10v2a7 7 0 01-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.label || "Voice"}
    </button>
    <button
      onClick={() => setMinimized(true)}
      title="Minimize"
      style={{ width:32, height:32, borderRadius:"50%", background:"rgba(13,58,53,0.07)", border:"1px solid rgba(13,58,53,0.13)", color:"#0d3a35", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .15s" }}
      onMouseEnter={e => e.currentTarget.style.background="rgba(13,58,53,0.13)"}
      onMouseLeave={e => e.currentTarget.style.background="rgba(13,58,53,0.07)"}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  </div>
</div>
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        style={{ flex:1, width:"100%", display:"block", cursor:"pointer", minHeight:0 }}
        onClick={() => {
          if (voiceState === "idle") startListening();
          else if (voiceState === "listening" && recorderRef.current?.state !== "inactive") recorderRef.current.stop();
          else if (voiceState === "speaking") { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } analyserRef.current = null; setState("idle"); }
        }}
      />

      {/* Center overlay text */}
      <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", pointerEvents:"none", width:"100%" }}>
        <div style={{ fontSize:14, fontWeight:600, color: stateColor, letterSpacing:"0.06em", textTransform:"lowercase", transition:"color .4s", animation: voiceState === "processing" ? "vmStatusPulse 1s ease-in-out infinite alternate" : "none" }}>
          {STATE_LABELS[voiceState]}
        </div>
        {(transcript || errorMsg) && (
          <div style={{ fontSize:13, color: errorMsg ? "rgba(220,80,80,0.8)" : "rgba(13,58,53,0.5)", fontStyle:"italic", marginTop:8, padding:"0 32px", lineHeight:1.55 }}>
            {errorMsg || transcript}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:16, padding:"20px 0 32px", flexShrink:0 }}>
        {/* Voice label */}
        <div style={{ fontSize:11, color:"rgba(13,58,53,0.45)", letterSpacing:"0.04em" }}>
          {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.label} · {VOICE_OPTIONS.find(v => v.id === selectedVoice)?.tone}
        </div>

        {/* Control buttons */}
        <div style={{ display:"flex", alignItems:"center", gap:24 }}>
          {/* Back to voice select */}
          <button
            className="vm-ctrl-btn"
            onClick={() => { stopAll(); clearInterval(timerIntervalRef.current); setTimerSecs(0); setState("idle"); setScreen("greet"); }}
            title="Change voice"
            style={{ width:52, height:52, borderRadius:"50%", background:"rgba(13,58,53,0.08)", border:"1.5px solid rgba(13,58,53,0.15)", color:"#0d3a35", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
              <path d="M19 10v2a7 7 0 01-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="23"/>
              <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
          </button>

          {/* End call */}
          <button
            className="vm-end-btn"
            onClick={endCall}
            title="End"
            style={{ width:68, height:68, borderRadius:"50%", background:"#e53e3e", border:"none", color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 0 0 10px rgba(229,62,62,0.12)", transition:"all .2s" }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" transform="rotate(135 12 12)"/>
            </svg>
          </button>

          {/* Stop AI */}
          <button
            className="vm-ctrl-btn"
            onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } analyserRef.current = null; setState("idle"); setTimeout(startListening, 400); }}
            title="Stop & re-listen"
            style={{ width:52, height:52, borderRadius:"50%", background: voiceState === "speaking" ? "rgba(0,184,148,0.12)" : "rgba(13,58,53,0.08)", border:`1.5px solid ${voiceState === "speaking" ? "rgba(0,184,148,0.4)" : "rgba(13,58,53,0.15)"}`, color: voiceState === "speaking" ? "#00b894" : "#0d3a35", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/></svg>
          </button>
        </div>

        <div style={{ fontSize:11, color:"rgba(13,58,53,0.28)", letterSpacing:"0.03em" }}>
          tap the wave to speak · tap again to stop
        </div>
      </div>
    </div>
  );
}
const CW_STYLE = `
  /* ── SHELL ───────────────────────────────────────────── */
  .cw-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    background: var(--bg-chat);
    overflow: hidden;
    position: relative;
  }

  /* ── HEADER ──────────────────────────────────────────── */
  .cw-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 16px;
    height: 56px;
    min-height: 56px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border-soft);
    background: var(--bg-chat);
    position: relative;
    z-index: 10;
    gap: 10px;
  }

  .cw-header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    flex: 1;
  }

  .cw-hamburger {
    display: none;
    background: none; border: none;
    color: var(--t2); cursor: pointer;
    width: 34px; height: 34px;
    border-radius: var(--r-sm);
    align-items: center; justify-content: center;
    flex-shrink: 0;
    transition: background .12s;
  }
  .cw-hamburger:hover { background: #f0f0ec; }
  .cw-hamburger svg { width: 18px; height: 18px; }

  @media(max-width: 640px) {
    .cw-header {
      position: sticky; top: 0; z-index: 50;
      background: var(--bg-chat);
      height: 50px; min-height: 50px;
      padding: 0 12px;
    }
    .cw-root { height: 100dvh; overflow: hidden; }
    .cw-body { overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .cw-hamburger { display: flex; }
  }

  .cw-logo { width: 26px; height: 26px; border-radius: 6px; overflow:hidden; flex-shrink:0; }
  .cw-logo img { width:100%; height:100%; object-fit:contain; }

  .cw-brand { min-width: 0; }
  .cw-brand h2  { font-size:15px; font-weight:600; color:var(--t1); line-height:1.2; white-space:nowrap; }
  .cw-brand sub { font-size:11px; color:var(--t3); font-weight:400; display:block; line-height:1; }
  @media(max-width: 640px) {
    .cw-brand h2 { font-size: 14px; }
    .cw-brand sub { font-size: 10px; }
  }

  .cw-upgrade {
    padding: 6px 14px;
    background: var(--accent); color: #fff;
    border: none; border-radius: 20px;
    font-size: 12.5px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    white-space: nowrap; flex-shrink: 0;
    transition: opacity .12s, box-shadow .12s;
    letter-spacing: .01em;
  }
  .cw-upgrade:hover { opacity:.88; box-shadow:0 2px 12px rgba(0,0,0,.25); }
  @media(max-width: 640px) {
    .cw-upgrade { padding: 5px 10px; font-size: 11px; }
  }

  .cw-header-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    min-width: 0;
  }
  @media(max-width: 400px) {
    .cw-header-right { gap: 5px; }
  }

  .cw-plan-badge {
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    flex-shrink: 0;
  }
  @media(max-width: 400px) {
    .cw-plan-badge { display: none; }
  }

  /* ── BODY ────────────────────────────────────────────── */
  .cw-body {
    flex: 1; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #e0e0da transparent;
    position: relative;
  }
  @media(max-width: 640px) { .cw-body { padding-bottom: 120px; } }
  .cw-body::-webkit-scrollbar       { width: 5px; }
  .cw-body::-webkit-scrollbar-thumb { background: #ddddd8; border-radius: 3px; }

  /* ── CENTERED EMPTY STATE ───────────────────────────── */
  .cw-welcome-greeting {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
  }

  .cw-welcome-label {
    font-size: 13px;
    font-weight: 500;
    color: #b1b7ab;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .cw-welcome-name {
    font-size: clamp(22px, 4.5vw, 32px);
    font-weight: 700;
    color: #0d3a35;
    letter-spacing: -0.03em;
    line-height: 1.15;
  }

  .cw-welcome-sub {
    font-size: 13.5px;
    color: #b1b7ab;
    margin-top: 4px;
    line-height: 1.5;
  }

  @media(max-width: 640px) {
    .cw-empty-state { padding: 20px 16px 0; }
    .cw-welcome-name { font-size: 22px; }
  }

  /* ── CENTERED INPUT WRAP (empty state) ──────────────── */

  @media(max-width: 640px) {
    .cw-input-wrap-centered { padding: 0 10px; }
  }

  @keyframes cwFadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }

  /* ── MESSAGES ────────────────────────────────────────── */
  .cw-messages {
    flex: 1; padding: 12px 0 8px;
    display: flex; flex-direction: column; gap: 2px;
  }

  /* ── MESSAGE ROW ─────────────────────────────────────── */
  .cw-msg-row {
    display: flex; padding: 5px 20px;
    max-width: 780px; width: 100%; margin: 0 auto;
    animation: cwFadeUp .2s ease;
  }
  .cw-msg-row.user { justify-content: flex-end; }
  .cw-msg-row.ai   { justify-content: flex-start; align-items: flex-end; gap: 8px; }
  @media(max-width: 640px) {
    .cw-msg-row { padding: 4px 12px; }
    .cw-msg-row.ai { gap: 6px; }
  }

  .cw-ai-avatar {
    width: 28px; height: 28px; border-radius: 8px; overflow: hidden;
    flex-shrink: 0; border: 1.5px solid rgba(193,127,42,.2);
    background: #faf8f4; margin-bottom: 2px;
  }
  .cw-ai-avatar img { width:100%; height:100%; object-fit:contain; }
  @media(max-width: 640px) {
    .cw-ai-avatar { width: 24px; height: 24px; border-radius: 6px; }
  }

  .cw-bubble-stack {
    display: flex; flex-direction: column; gap: 4px;
    max-width: min(88%, 720px);
    align-items: flex-end;
  }
  .cw-bubble-stack.ai { align-items: flex-start; }
  @media(max-width: 640px) {
    .cw-bubble-stack { max-width: min(92%, 100%); }
  }

.cw-bubble {
  padding: 11px 16px;
  font-size: 16px;
  line-height: 1.55;
  word-break: break-word;
  border-radius: 18px;
  font-family: 'Tiempos Text', 'Charter', Georgia, ui-serif, serif; /* Claude's user-message serif */
  letter-spacing: -0.003em;
}
.cw-msg-row.ai .cw-bubble {
  font-family: 'Tiempos Text', 'Charter', Georgia, ui-serif, serif;
  font-size: 16px;
}
@media(max-width: 640px) {
  .cw-bubble { font-size: 16px; padding: 10px 14px; }
  .cw-msg-row.ai .cw-bubble { font-size: 14.5px; }
}
  .cw-msg-row.user .cw-bubble {
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 5px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  }
  .cw-msg-row.ai .cw-bubble {
    background: transparent;
    color: var(--t1);
    border: 1px solid #ececea;
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }

  .cw-msg-time {
    font-size: 10px; color: var(--t3);
    padding: 0 4px;
    letter-spacing: .02em;
  }
  .cw-msg-row.user .cw-msg-time { text-align: right; }

  .cw-msg-divider {
    display: flex; align-items: center; gap: 8px;
    margin: 6px 0 2px; max-width: 100%;
  }
  @media(max-width: 640px) {
    .cw-msg-divider { gap: 6px; margin: 4px 0 1px; }
  }

  /* ── ATTACHMENT BUBBLE ───────────────────────────────── */
  .cw-attach-img-bubble {
    border-radius: 16px; overflow: hidden;
    border: 1.5px solid rgba(0,0,0,.08);
    max-width: 240px; min-width: 120px;
    box-shadow: 0 2px 12px rgba(0,0,0,.1);
    cursor: pointer;
    transition: transform .15s, box-shadow .15s;
  }
  .cw-attach-img-bubble:hover { transform: scale(1.02); box-shadow: 0 4px 20px rgba(0,0,0,.15); }
  .cw-attach-img-bubble img { width: 100%; display: block; max-height: 220px; object-fit: cover; }
  .cw-attach-img-bubble.ai { border-bottom-left-radius: 5px; }
  .cw-attach-img-bubble.user { border-bottom-right-radius: 5px; }
  @media(max-width: 640px) {
    .cw-attach-img-bubble { max-width: 200px; }
    .cw-attach-img-bubble img { max-height: 180px; }
  }

  .cw-attach-doc-bubble {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    border-radius: 16px;
    max-width: 280px; min-width: 180px;
    transition: box-shadow .14s;
  }
  @media(max-width: 640px) {
    .cw-attach-doc-bubble { min-width: 150px; max-width: 240px; padding: 8px 12px; }
  }
  .cw-msg-row.user .cw-attach-doc-bubble {
    background: rgba(255,255,255,.18);
    border: 1.5px solid rgba(255,255,255,.3);
    border-bottom-right-radius: 5px;
  }
  .cw-msg-row.ai .cw-attach-doc-bubble {
    background: #faf9f6;
    border: 1.5px solid #ececea;
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .cw-doc-icon-box {
    width: 38px; height: 38px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; letter-spacing: -.01em; flex-shrink: 0;
  }
  .cw-doc-info { flex: 1; min-width: 0; }
  .cw-doc-name {
    font-size: 12.5px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
  }
  .cw-msg-row.user .cw-doc-name { color: #fff; }
  .cw-msg-row.ai  .cw-doc-name  { color: var(--t1); }
  .cw-doc-meta { font-size: 10.5px; margin-top: 2px; }
  .cw-msg-row.user .cw-doc-meta { color: rgba(255,255,255,.65); }
  .cw-msg-row.ai  .cw-doc-meta  { color: var(--t3); }

  /* ── ATTACH PREVIEW STRIP ──────────────────────────────── */
  .cw-pending-strip {
    display: flex; gap: 8px; flex-wrap: wrap;
    padding: 8px 16px 2px;
    max-width: 720px; margin: 0 auto; width: 100%;
    animation: cwFadeUp .15s ease;
  }
  @media(max-width: 640px) { .cw-pending-strip { padding: 6px 12px 2px; gap: 6px; } }

  .cw-pending-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 6px 10px 6px 8px;
    background: #faf8f3;
    border: 1.5px solid rgba(193,127,42,.25);
    border-radius: 10px; max-width: 200px;
    transition: box-shadow .12s;
  }
  .cw-pending-chip:hover { box-shadow: 0 2px 8px rgba(193,127,42,.1); }
  .cw-pending-thumb {
    width: 32px; height: 32px; border-radius: 6px;
    object-fit: cover; flex-shrink: 0; border: 1px solid rgba(0,0,0,.06);
  }
  .cw-pending-doc-icon {
    width: 32px; height: 32px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 800; flex-shrink: 0;
  }
  .cw-pending-chip-info { flex: 1; min-width: 0; }
  .cw-pending-chip-name {
    font-size: 11.5px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cw-pending-chip-meta { font-size: 10px; color: var(--t3); margin-top: 1px; }
  .cw-pending-remove {
    width: 18px; height: 18px; border: none; background: none;
    border-radius: 50%; cursor: pointer; color: var(--t3);
    font-size: 11px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: color .1s, background .1s; padding: 0;
  }
  .cw-pending-remove:hover { color: #e05252; background: #fef2f2; }
  .cw-pending-limit {
    font-size: 10.5px; color: var(--t3);
    padding: 0 16px 4px; max-width: 720px; margin: 0 auto; width: 100%;
  }

  /* ── ACTIVITY BAR ──────────────────────────────────────── */
  .cw-activity-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 14px 6px 12px;
    background: #faf8f4;
    border: 1px solid rgba(193,127,42,.18);
    border-radius: 20px;
    font-size: 12.5px; color: var(--t2);
    font-family: var(--font);
    animation: cwFadeUp .2s ease;
    width: fit-content;
    max-width: calc(100vw - 100px);
    overflow: hidden;
  }
  .cw-activity-text {
    color: var(--t2); font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  @media(max-width: 640px) {
    .cw-activity-bar { font-size: 11.5px; padding: 5px 10px 5px 9px; gap: 6px; }
  }
  .cw-activity-icon { font-size: 14px; flex-shrink: 0; }
  .cw-activity-dots { display: flex; gap: 3px; align-items: center; margin-left: 2px; }
  .cw-activity-dots span {
    width: 4px; height: 4px; border-radius: 50%;
    background: var(--accent); opacity: .4;
    animation: cwDot 1.2s ease-in-out infinite;
  }
  .cw-activity-dots span:nth-child(2) { animation-delay: .2s; }
  .cw-activity-dots span:nth-child(3) { animation-delay: .4s; }

  /* ── URL CHIP ────────────────────────────────────────── */
  .cw-url-chip {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 12px;
    font-size: 11.5px; font-family: var(--font);
    background: #f5f4f0; border: 1px solid var(--border);
    color: var(--t2);
    animation: cwFadeUp .15s ease;
  }
  .cw-url-spinner {
    width: 10px; height: 10px; border-radius: 50%;
    border: 1.5px solid rgba(193,127,42,.3);
    border-top-color: var(--accent);
    animation: cwSpin .7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes cwSpin { to { transform: rotate(360deg); } }
  .cw-url-ok  { color: #22863a; font-size: 12px; }
  .cw-url-err { color: #e05252; font-size: 12px; }

  /* ── ACTIVITY TRAIL ──────────────────────────────────── */
  .cw-activity-trail {
    display: flex; flex-direction: column; gap: 4px;
    margin-top: 6px; margin-bottom: 2px;
  }
  .cw-trail-pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 12px;
    font-size: 11.5px; font-family: var(--font);
    background: rgba(193,127,42,.07);
    border: 1px solid rgba(193,127,42,.15);
    color: var(--t2);
    width: fit-content;
  }

  /* ── DOWNLOAD BUTTON ─────────────────────────────────── */
  .cw-download-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 18px;
  margin-top: 12px;
  background: linear-gradient(135deg, #fffbf6 0%, #fff9ef 100%);
  color: #3d3d3d;
  border: 1px solid rgba(210, 190, 165, 0.4);
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  font-family: 'DM Sans', system-ui, sans-serif;
  cursor: pointer;
  outline: none;
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
  box-shadow: 0 6px 20px rgba(210, 190, 165, 0.2);
  letter-spacing: 0.01em;
  position: relative;
  overflow: hidden;
}

/* Shimmer effect on hover */
.cw-download-btn::before {
  content: "";
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  transition: left 0.5s ease;
}

.cw-download-btn:hover::before {
  left: 100%;
}

.cw-download-btn:hover {
  background: linear-gradient(135deg, #fcf7ef 0%, #fff8f0 100%);
  transform: translateY(-2px);
  box-shadow: 0 10px 30px rgba(210, 190, 165, 0.3);
  border-color: rgba(210, 190, 165, 0.6);
}

.cw-download-btn:active {
  transform: translateY(0);
  box-shadow: 0 4px 12px rgba(210, 190, 165, 0.2);
}

.cw-download-btn svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  transition: transform 0.3s ease;
}

.cw-download-btn:hover svg {
  transform: translateY(2px);
  animation: downloadPulse 0.6s ease;
}

@keyframes downloadPulse {
  0%, 100% { transform: translateY(2px); }
  50% { transform: translateY(6px); }
}

.cw-download-text {
  display: inline-block;
  font-weight: 600;
}

@media (max-width: 480px) {
  .cw-download-btn {
    padding: 9px 14px;
    font-size: 12.5px;
    gap: 6px;
  }
  .cw-download-btn svg {
    width: 16px;
    height: 16px;
  }
}

@media (prefers-color-scheme: dark) {
  .cw-download-btn {
    background: linear-gradient(135deg, #fffee8f8 0%, #fffee8f8 100%);
    box-shadow: 0 6px 20px rgba(210, 190, 165, 0.3);
  }
  .cw-download-btn:hover {
    background: linear-gradient(135deg, #fffee8f8 0%, #fffee8f8 100%);
    box-shadow: 0 10px 30px rgba(210, 190, 165, 0.4);
  }
}

  /* ── THINKING ────────────────────────────────────────── */
  .cw-thinking {
    display:flex; align-items:center; gap:10px;
    padding: 5px 20px; max-width:780px; width:100%; margin:0 auto;
  }
  @media(max-width: 640px) {
    .cw-thinking { padding: 4px 12px; gap: 6px; }
    .cw-thinking .cw-thinking-label { font-size: 12px; }
  }
  .cw-thinking-dots { display:flex; gap:4px; align-items:center; }
  .cw-thinking-dots span {
    width:6px; height:6px; border-radius:50%;
    background:var(--accent); opacity:.4;
    animation:cwDot 1.2s ease-in-out infinite;
  }
  .cw-thinking-dots span:nth-child(2) { animation-delay:.2s; }
  .cw-thinking-dots span:nth-child(3) { animation-delay:.4s; }
  @keyframes cwDot {
    0%,80%,100% { opacity:.25; transform:scale(.85); }
    40%          { opacity:1;   transform:scale(1); }
  }
  .cw-thinking-label { font-size:13px; color:var(--t3); font-style:italic; }

  /* ── INPUT WRAP (bottom, normal state) ───────────────── */
  .cw-input-wrap {
    flex-shrink: 0;
    padding: 8px 16px 14px;
    background: var(--bg-chat);
    border-top: 1px solid var(--border-soft);
  }
  @media(max-width: 640px) {
    .cw-input-wrap {
      position: fixed; bottom: 0; left: 0; right: 0;
      padding: 6px 10px max(16px, env(safe-area-inset-bottom, 16px));
      background: var(--bg-chat);
      border-top: 1px solid var(--border-soft);
      z-index: 20;
    }
  }

  /* ── INPUT BOX (shared between centered and bottom) ──── */
  .cw-input-box {
    max-width: 720px; margin: 0 auto;
    background: #fafaf8; border: 1.5px solid var(--border);
    border-radius: 18px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }
  .cw-input-box:focus-within {
    border-color: rgba(13,58,53,.35);
    box-shadow: 0 0 0 3px rgba(13,58,53,.07), 0 2px 12px rgba(0,0,0,.06);
    background: #fff;
  }
  @media(max-width: 640px) {
    .cw-input-box { border-radius: 16px; padding: 8px 10px; }
  }

  /* Centered input box gets a slightly elevated look */
  .cw-input-wrap-centered .cw-input-box {
    box-shadow: 0 4px 24px rgba(13,58,53,.1), 0 1px 6px rgba(0,0,0,.04);
    border-color: rgba(13,58,53,.18);
  }
  .cw-input-wrap-centered .cw-input-box:focus-within {
    border-color: rgba(13,58,53,.4);
    box-shadow: 0 0 0 3px rgba(13,58,53,.08), 0 6px 28px rgba(13,58,53,.12);
  }

  .cw-textarea-row { display:flex; align-items:flex-end; gap:8px; }

  .cw-textarea {
    flex:1; border:none; background:none; outline:none;
    font-family:var(--font); font-size:14px; color:var(--t1);
    resize:none; min-height:22px; max-height:120px;
    line-height:1.55; overflow-y:auto; scrollbar-width:thin;
    caret-color: #0d3a35;
  }
  .cw-textarea::placeholder { color:var(--t3); }
  @media(max-width: 640px) {
    .cw-textarea { font-size: 16px; }
  }

  .cw-attach { position:relative; flex-shrink:0; }
  .cw-attach-btn {
    width:32px; height:32px; border:none; border-radius:50%;
    background: none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:var(--t3); transition:background .12s, color .12s;
  }
  .cw-attach-btn:hover { background:#f0ede6; color:var(--accent); }
  .cw-attach-btn.has-files { color: var(--accent); }
  .cw-attach-btn svg  { width:17px; height:17px; }

  .cw-attach-menu {
    position:absolute; bottom:calc(100% + 8px); left:0;
    background:#fff; border:1px solid #e8e6e0;
    border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.12);
    padding:5px; min-width:160px; z-index:200;
    animation:cwMenuIn .12s ease;
  }
  @media(max-width: 640px) {
    .cw-attach-menu { left: 0; right: auto; min-width: 150px; }
  }
  @keyframes cwMenuIn {
    from { opacity:0; transform:translateY(6px) scale(.97); }
    to   { opacity:1; transform:translateY(0) scale(1); }
  }
  .cw-attach-menu-item {
    display:flex; align-items:center; gap:10px;
    padding:9px 12px; font-size:13px; color:var(--t1);
    border-radius:10px; cursor:pointer;
    transition:background .11s; font-family:var(--font); font-weight: 500;
  }
  .cw-attach-menu-item:hover { background:#faf7f2; color: var(--accent); }
  .cw-attach-menu-item svg { width:15px; height:15px; flex-shrink:0; }
  .cw-attach-menu-sep { height:1px; background:#f0ede8; margin:3px 8px; }
  .cw-attach-menu-limit { font-size:10px; color:var(--t3); padding:4px 12px 5px; font-family:var(--font); }

  /* send button */
  .cw-send {
    width:34px; height:34px; border-radius:50%;
    background:#0d3a35; border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; color:#fff;
    transition:opacity .13s, box-shadow .13s, transform .1s;
  }
  .cw-send:hover:not(:disabled) {
    opacity:.88; box-shadow:0 3px 14px rgba(13,58,53,.35); transform: scale(1.05);
  }
  .cw-send:disabled { opacity:.3; cursor:default; }
  .cw-send svg { width:15px; height:15px; }
  @media(max-width: 640px) {
    .cw-send { width: 36px; height: 36px; }
  }

  /* ── MIC BUTTON ──────────────────────────────────────── */
  .cw-mic-btn {
    width: 32px; height: 32px; border-radius: 50%;
    background: none; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--t3); flex-shrink: 0;
    transition: background .12s, color .12s, transform .12s;
  }
  .cw-mic-btn:hover {
    background: rgba(13,58,53,0.08);
    color: #0d3a35;
    transform: scale(1.08);
  }
  .cw-mic-btn.active {
    color: #0d3a35;
    background: rgba(13,58,53,0.1);
  }

  .cw-hint {
    text-align:center; font-size:11px; color:var(--t3);
    margin-top:6px; max-width:720px; margin-left:auto; margin-right:auto;
  }
  @media(max-width: 640px) { .cw-hint { font-size: 10px; margin-top: 4px; } }

  /* ── IMAGE LIGHTBOX ──────────────────────────────────── */
  .cw-lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.85);
    display: flex; align-items: center; justify-content: center;
    animation: cwFadeIn .18s ease; cursor: zoom-out;
  }
  @keyframes cwFadeIn { from { opacity:0; } to { opacity:1; } }
  .cw-lightbox img {
    max-width: 90vw; max-height: 88vh;
    border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.5);
    object-fit: contain; cursor: default;
  }
  @media(max-width: 640px) {
    .cw-lightbox img { max-width: 95vw; max-height: 80vh; border-radius: 8px; }
  }
  .cw-lightbox-close {
    position:absolute; top:20px; right:20px;
    background:rgba(255,255,255,.12); border:none; border-radius:50%;
    width:38px; height:38px; cursor:pointer; color:#fff;
    display:flex; align-items:center; justify-content:center;
    font-size:18px; transition:background .12s;
  }
  .cw-lightbox-close:hover { background:rgba(255,255,255,.22); }
  @media(max-width: 640px) {
    .cw-lightbox-close { top: 14px; right: 14px; width: 34px; height: 34px; }
  }

  /* ── LIMIT MODAL ─────────────────────────────────────── */
  .cw-limit-modal-back {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(13,58,53,.18);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: cwFadeIn .18s ease;
    padding: 16px;
  }
  .cw-limit-modal {
    background: #fff; border-radius: 22px; padding: 0;
    width: 340px; max-width: 100%;
    box-shadow: 0 32px 80px rgba(13,58,53,.18), 0 2px 8px rgba(0,0,0,.06);
    animation: cwFadeUp .2s ease; overflow: hidden;
  }
  .cw-limit-modal-top {
    background: linear-gradient(135deg, #0d3a35 0%, #1a5a52 100%);
    padding: 28px 24px 24px; text-align: center; position: relative;
  }
  @media(max-width: 640px) { .cw-limit-modal-top { padding: 22px 18px 20px; } }
  .cw-limit-modal-icon {
    width: 52px; height: 52px; border-radius: 16px;
    background: rgba(255,255,255,.12); border: 1.5px solid rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 24px; margin: 0 auto 14px;
  }
  .cw-limit-modal-title { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 6px; line-height: 1.2; }
  .cw-limit-modal-sub { font-size: 13px; color: rgba(255,255,255,.65); line-height: 1.5; }
  .cw-limit-modal-body { padding: 20px 24px 24px; }
  @media(max-width: 640px) { .cw-limit-modal-body { padding: 16px 18px 20px; } }
  .cw-limit-modal-desc { font-size: 13.5px; color: var(--t2); line-height: 1.65; margin-bottom: 18px; text-align: center; }
  .cw-limit-modal-actions { display: flex; gap: 8px; }
  .cw-limit-btn-cancel {
    flex: 1; padding: 11px; background: none; border: 1px solid var(--border);
    border-radius: 11px; font-size: 13px; color: var(--t2);
    cursor: pointer; font-family: var(--font); transition: background .12s; font-weight: 500;
  }
  .cw-limit-btn-cancel:hover { background: #f5f5f2; }
  .cw-limit-btn-upgrade {
    flex: 2; padding: 11px;
    background: linear-gradient(135deg, #0d3a35, #1a5a52);
    border: none; border-radius: 11px; font-size: 13px; font-weight: 600;
    color: #fff; cursor: pointer; font-family: var(--font);
    transition: opacity .12s; letter-spacing: .01em;
  }
  .cw-limit-btn-upgrade:hover { opacity: .88; }
  .cw-limit-btn-close {
    position: absolute; top: 12px; right: 12px;
    width: 28px; height: 28px; border-radius: 50%;
    background: rgba(255,255,255,.12); border: none;
    color: rgba(255,255,255,.7); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; transition: background .12s;
  }
  .cw-limit-btn-close:hover { background: rgba(255,255,255,.22); color: #fff; }

  /* ── SELECTION REPLY BUTTON ──────────────────────────── */
  .cw-selection-btn {
    position: fixed;
    z-index: 500;
    background: var(--t1);
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 5px;
    box-shadow: 0 4px 16px rgba(13,58,53,.25);
    white-space: nowrap;
    animation: selBtnIn .12s ease;
    transform: translateX(-50%);
  }
  @keyframes selBtnIn {
    from { opacity: 0; transform: translateX(-50%) translateY(4px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  .cw-selection-btn:hover { background: #0d3a35; }
  .cw-selection-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
`;


function PasteViewerModal({ data, onClose, onSave }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(data?.textContent || "");
  const [copied, setCopied] = useState(false);

  useEffect(() => { setText(data?.textContent || ""); setEditing(false); }, [data]);

  if (!data) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="cw-limit-modal-back" onClick={onClose}>
      <div className="cw-limit-modal" style={{ width: 560, maxWidth: "92vw" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px", borderBottom:"1px solid var(--border-soft)" }}>
          <div style={{ fontSize:13, fontWeight:600, color:"var(--t1)", fontFamily:"var(--font)" }}>{data.name}</div>
          <button onClick={onClose} style={{ border:"none", background:"none", cursor:"pointer", color:"var(--t3)", fontSize:16 }}>✕</button>
        </div>
        <div style={{ padding:"14px 18px" }}>
          {editing ? (
            <textarea
              autoFocus
              value={text}
              onChange={e => setText(e.target.value)}
              style={{
                width:"100%", minHeight:300, maxHeight:"55vh",
                fontFamily:"ui-monospace, monospace", fontSize:12.5,
                border:"1px solid var(--border)", borderRadius:10,
                padding:12, resize:"vertical", outline:"none", boxSizing:"border-box",
                color:"var(--t1)",
              }}
            />
          ) : (
            <pre style={{
              margin:0, maxHeight:"55vh", overflow:"auto",
              fontFamily:"ui-monospace, monospace", fontSize:12.5,
              background:"#faf9f6", border:"1px solid var(--border-soft)",
              borderRadius:10, padding:12, whiteSpace:"pre-wrap", wordBreak:"break-word",
              color:"var(--t1)",
            }}>{text}</pre>
          )}
        </div>
        <div style={{ display:"flex", gap:8, padding:"0 18px 16px", justifyContent:"flex-end" }}>
          <button className="cw-limit-btn-cancel" onClick={handleCopy} style={{ flex:"none", padding:"8px 14px" }}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
          {editing ? (
            <button className="cw-limit-btn-upgrade" style={{ flex:"none", padding:"8px 14px" }} onClick={() => { onSave(text); setEditing(false); }}>
              Save
            </button>
          ) : (
            <button className="cw-limit-btn-upgrade" style={{ flex:"none", padding:"8px 14px" }} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

  function PendingChip({ file, onRemove, onView }) {
  if (file.kind === "paste") {
    return (
      <div className="cw-pending-chip" onClick={() => onView && onView(file)} style={{ cursor: "pointer" }}>
        <div className="cw-pending-doc-icon" style={{ background: "#eef0ea", color: "#5b6b56" }}>
          {file.isCode ? "</>" : "TXT"}
        </div>
        <div className="cw-pending-chip-info">
          <div className="cw-pending-chip-name">{file.name}</div>
          <div className="cw-pending-chip-meta">{file.lineCount} lines</div>
        </div>
        <button className="cw-pending-remove" onClick={e => { e.stopPropagation(); onRemove(); }}>✕</button>
      </div>
    );
  }
  const isImage = file.kind === "image";
  const ext = getExt(file.name);
  const di = docIcon(ext);
  return (
    <div className="cw-pending-chip">
      {isImage ? (
        <img className="cw-pending-thumb" src={file.previewUrl} alt={file.name} />
      ) : (
        <div className="cw-pending-doc-icon" style={{ background: di.bg, color: di.color }}>{di.char}</div>
      )}
      <div className="cw-pending-chip-info">
        <div className="cw-pending-chip-name">{file.name}</div>
        <div className="cw-pending-chip-meta">{formatBytes(file.size)} · {ext}</div>
      </div>
      <button className="cw-pending-remove" onClick={onRemove}>✕</button>
    </div>
  );
}

function AttachBubble({ file, sender, onImageClick, onPasteClick }) {
  if (file.kind === "paste") {
    return (
      <div className="cw-attach-doc-bubble" onClick={() => onPasteClick && onPasteClick(file)} style={{ cursor: "pointer" }}>
        <div className="cw-doc-icon-box" style={{ background: "#eef0ea", color: "#5b6b56" }}>
          {file.isCode ? "</>" : "TXT"}
        </div>
        <div className="cw-doc-info">
          <div className="cw-doc-name">{file.name}</div>
          <div className="cw-doc-meta">{file.lineCount} lines</div>
        </div>
      </div>
    );
  }
  const isImage = file.kind === "image";
  const ext = getExt(file.name);
  const di = docIcon(ext);
  if (isImage) {
    return (
      <div
        className={`cw-attach-img-bubble ${sender}`}
        onClick={() => onImageClick && onImageClick(file.previewUrl)}
      >
        <img src={file.previewUrl} alt={file.name} />
      </div>
    );
  }
  return (
    <div className="cw-attach-doc-bubble">
      <div className="cw-doc-icon-box" style={{ background: di.bg, color: di.color }}>{di.char}</div>
      <div className="cw-doc-info">
        <div className="cw-doc-name">{file.name}</div>
        <div className="cw-doc-meta">{formatBytes(file.size)} · {ext} document</div>
      </div>
    </div>
  );
}

// ── Shared InputBox component used in both centered and bottom positions ──────
function InputBox({
  input, setInput, isThinking, isStreaming, pendingFiles, setPendingFiles,
  showAttach, setShowAttach, attachRef, fileInputRef, canAddMore,
  textareaRef, voiceOpen, setVoiceOpen, sendMessage, abortControllerRef,
  setIsThinking, setIsStreaming, isCentered, handleTextareaPaste,
}) {
  return (
    <div className={`cw-input-box${isCentered ? " cw-input-box-centered" : ""}`}>
      <div className="cw-textarea-row">
        <div className="cw-attach" ref={attachRef}>
          <button
            className={`cw-attach-btn${pendingFiles.length > 0 ? " has-files" : ""}`}
            onClick={() => setShowAttach(v => !v)}
            title="Attach file"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
            </svg>
          </button>
          {showAttach && (
            <div className="cw-attach-menu">
              {!canAddMore && <div className="cw-attach-menu-limit">Max 2 files per message</div>}
              {canAddMore && (
                <>
                  <div className="cw-attach-menu-item" onClick={() => {
                    if (!canAddMore) return;
                    setShowAttach(false);
                    fileInputRef.current.value = "";
                    fileInputRef.current.setAttribute("accept", ATTACH_TYPES.image.accept);
                    fileInputRef.current.click();
                  }}>
                    {ATTACH_TYPES.image.icon}
                    <span>Image</span>
                    <span style={{ marginLeft:"auto", fontSize:10, color:"var(--t3)" }}>jpg · png · gif</span>
                  </div>
                  <div className="cw-attach-menu-sep" />
                  <div className="cw-attach-menu-item" onClick={() => {
                    if (!canAddMore) return;
                    setShowAttach(false);
                    fileInputRef.current.value = "";
                    fileInputRef.current.setAttribute("accept", ATTACH_TYPES.document.accept);
                    fileInputRef.current.click();
                  }}>
                    {ATTACH_TYPES.document.icon}
                    <span>Document</span>
                    <span style={{ marginLeft:"auto", fontSize:10, color:"var(--t3)" }}>pdf · doc · txt</span>
                  </div>
                </>
              )}
              {pendingFiles.length > 0 && canAddMore && (
                <>
                  <div className="cw-attach-menu-sep" />
                  <div className="cw-attach-menu-limit">{pendingFiles.length}/2 attached</div>
                </>
              )}
            </div>
          )}
        </div>

         <textarea
          ref={textareaRef}
          className="cw-textarea"
          rows={1}
          value={input}
          placeholder={pendingFiles.length > 0 ? "Add a message about your files…" : "Message Eloria…"}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          onPaste={handleTextareaPaste}
        />

        <button
          className={`cw-mic-btn${voiceOpen ? " active" : ""}`}
          onClick={() => setVoiceOpen(true)}
          title="Voice mode"
          aria-label="Open voice mode"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
  <line x1="12" y1="19" x2="12" y2="23"/>
  <line x1="8" y1="23" x2="16" y2="23"/>
</svg>
        </button>

        <button
          className="cw-send"
          onClick={(isThinking || isStreaming)
            ? () => { abortControllerRef.current?.abort(); setIsThinking(false); setIsStreaming(false); }
            : sendMessage
          }
          disabled={!isThinking && !isStreaming && (!input.trim() && pendingFiles.length === 0)}
          title={(isThinking || isStreaming) ? "Stop" : "Send"}
          style={(isThinking || isStreaming) ? { background: "#0d3a35" } : {}}
        >
          {(isThinking || isStreaming) ? (
            <svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}


export default function ChatWindow({ chat, setChats, setSidebarOpen, setShowPricing, userPlan, setShowNotifPanel, totalBadgeCount, allChats }) {
  const [input,          setInput]          = useState("");
  const [isThinking,     setIsThinking]     = useState(false);
  const [isStreaming,    setIsStreaming]     = useState(false);
  const [activityStep,   setActivityStep]   = useState(0);
  const [activitySteps,  setActivitySteps]  = useState([]);
  const [showAttach,     setShowAttach]     = useState(false);
  const [pendingFiles,   setPendingFiles]   = useState([]);
  const [lightboxSrc,    setLightboxSrc]    = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectionBtn,   setSelectionBtn]   = useState(null);
  const [voiceOpen,      setVoiceOpen]      = useState(false);
  const [pasteViewer,    setPasteViewer]    = useState(null);
  const [openTrails, setOpenTrails] = useState({});

  const fileInputRef       = useRef(null);
  const fileAcceptRef      = useRef("");   
  const bodyRef            = useRef(null);
  const textareaRef        = useRef(null);
  const attachRef          = useRef(null);
  const messagesEndRef     = useRef(null);
  const abortControllerRef = useRef(null);
  const activityTimerRef   = useRef(null);

  const messagesRef = useRef([]);

  const messages  = useMemo(() => chat?.messages || [], [chat]);
  const showIntro = messages.length === 0;
  const canAddMore = pendingFiles.length < 2;
const [interruptedMsgId, setInterruptedMsgId] = useState(null);
const [editingMsgId,     setEditingMsgId]     = useState(null);
const [editInput,        setEditInput]         = useState("");
const [copiedMsgId,      setCopiedMsgId]       = useState(null);

const greetingIdx = useMemo(
  () => Math.floor(Math.random() * GREETINGS.length),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [chat?.id ?? ""]
);
const greeting = GREETINGS[greetingIdx];

  const displayName = auth.currentUser?.displayName
    ? auth.currentUser.displayName.split(" ")[0]   // first name only
    : null;

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    if (!document.getElementById("eloria-cw-v4")) {
      const tag = document.createElement("style");
      tag.id = "eloria-cw-v4";
      tag.textContent = CW_STYLE;
      document.head.appendChild(tag);
    }
    const old = document.getElementById("eloria-cw-v3");
    if (old) old.remove();
    const older = document.getElementById("eloria-cw");
    if (older) older.remove();
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, isThinking, activityStep]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    const h = e => { if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttach(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    const h = e => { if (e.key === "Escape") setLightboxSrc(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  useEffect(() => {
    const handleMouseUp = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();
        if (!text || text.length < 2) { setSelectionBtn(null); return; }
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const bubble = container.nodeType === 3
          ? container.parentElement?.closest(".cw-bubble")
          : container.closest?.(".cw-bubble");
        const msgRow = bubble?.closest(".cw-msg-row");
        if (!bubble || !msgRow?.classList.contains("ai")) { setSelectionBtn(null); return; }
        const rect = range.getBoundingClientRect();
        setSelectionBtn({ x: rect.left + rect.width / 2, y: rect.top - 8, text });
      }, 10);
    };
    const handleMouseDown = (e) => {
      if (!e.target.closest(".cw-selection-btn")) setSelectionBtn(null);
    };
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  useEffect(() => {
    if (isThinking) {
      setActivityStep(0);
      activityTimerRef.current = setInterval(() => {
        setActivityStep(s => Math.min(s + 1, Math.max(activitySteps.length - 1, 0)));
      }, 1800);
    } else {
      clearInterval(activityTimerRef.current);
      setActivityStep(0);
    }
    return () => clearInterval(activityTimerRef.current);
  }, [isThinking, activitySteps]);

  if (!chat) {
    return (
      <main className="cw-root" style={{ alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:"var(--t3)", fontSize:14 }}>Select or create a chat to get started.</p>
      </main>
    );
  }

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const slots = 2 - pendingFiles.length;
    const toAdd = files.slice(0, slots);
    toAdd.forEach(f => {
      const kind = getAttachKind(f);
      if (!kind) return;
      const maxSize = kind === "image" ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
      if (f.size > maxSize) {
        alert(`"${f.name}" is too large. Max size is ${kind === "image" ? "5MB for images" : "10MB for documents"}.`);
        return;
      }
      const reader = new FileReader();
      if (kind === "image") {
        reader.onload = (ev) => {
          setPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), name: f.name, size: f.size, kind, previewUrl: ev.target.result }]);
        };
        reader.readAsDataURL(f);
      } else {
        reader.onload = (ev) => {
          setPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), name: f.name, size: f.size, kind, previewUrl: null, base64: ev.target.result, textContent: null }]);
        };
        reader.readAsDataURL(f);
      }
    });
  };

  const handleQuoteReply = () => {
    if (!selectionBtn) return;
    const quoted = selectionBtn.text.split("\n").map(line => `> ${line}`).join("\n");
    setInput(prev => prev ? `${quoted}\n\n${prev}` : `${quoted}\n\n`);
    setSelectionBtn(null);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const openPasteViewer = (file, source) => setPasteViewer({ file, source });

  const savePasteEdit = (newText) => {
    if (!pasteViewer) return;
    const { file, source } = pasteViewer;
    const updated = { ...file, textContent: newText, lineCount: newText.split("\n").length, size: newText.length };
    if (source === "pending") {
      setPendingFiles(prev => prev.map(f => f.id === file.id ? updated : f));
    } else {
      setChats(prev => prev.map(c => c.id === chat.id
        ? { ...c, messages: c.messages.map(m => m.id === source
            ? { ...m, files: (m.files || []).map(f => f.id === file.id ? updated : f) }
            : m) }
        : c));
    }
    setPasteViewer(prev => prev ? { ...prev, file: updated } : prev);
  };

  const PASTE_THRESHOLD = 50;

  const detectPasteLang = (text) => {
    if (/def\s+\w+\(|import\s+\w+|print\(/.test(text)) return "python";
    if (/<\/?[a-z][\s\S]*>/i.test(text) && /<html|<div|<span|<body/i.test(text)) return "html";
    if (/function\s|=>|const\s|let\s|var\s|console\.log/.test(text)) return "javascript";
    if (/#include|std::|->/.test(text)) return "cpp";
    return "";
  };

  const handleTextareaPaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (!text) return;
    const isCode = /```|function |const |let |def |class |import |<\/?[a-z]+>/i.test(text);

    if (text.length < PASTE_THRESHOLD) {
      if (!isCode) return; // plain short text — let normal paste happen
      e.preventDefault();
      const lang = detectPasteLang(text);
      const fenced = "```" + lang + "\n" + text + "\n```";
      const ta = e.target;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const newValue = input.slice(0, start) + fenced + input.slice(end);
      setInput(newValue);
      setTimeout(() => {
        ta.focus();
        const pos = start + fenced.length;
        ta.setSelectionRange(pos, pos);
      }, 0);
      return;
    }

    e.preventDefault();
    if (pendingFiles.length >= 2) return;
    setPendingFiles(prev => [...prev, {
      id: Date.now() + Math.random(),
      name: isCode ? "Pasted code" : "Pasted text",
      size: text.length,
      kind: "paste",
      isCode,
      textContent: text,
      lineCount: text.split("\n").length,
    }]);
  };

  const openFilePicker = (kind) => {
  if (!canAddMore) return;
  setShowAttach(false);
  fileAcceptRef.current = ATTACH_TYPES[kind].accept;
  if (fileInputRef.current) {
    fileInputRef.current.value = "";
    fileInputRef.current.setAttribute("accept", fileAcceptRef.current);
    fileInputRef.current.click();
  }
};

  const generateChatTitle = text => {
    const stop = ["how","to","the","a","an","and","or","for","with","of","in","on","is","are","can","i","you","me","my","what","why","when","make","fix","create","write","about"];
    return text.toLowerCase().replace(/[^a-z0-9\s]/g,"").split(" ")
      .filter(w => w && !stop.includes(w)).slice(0,4).join(" ")
      .replace(/\b\w/g,c=>c.toUpperCase()) || "New Chat";
  };

  const getTimestamp = () =>
    new Date().toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });

  const sanitizeForFirestore = (obj) =>
    JSON.parse(JSON.stringify(obj, (_, v) => {
      if (v === undefined) return null;
      if (typeof v === "string" && v.startsWith("data:") && v.length > 10000) return "[file-stripped]";
      return v;
    }));

  const fetchUrlContent = async (url, token) => {
    try {
      const res = await fetch("https://eloria-trial.onrender.com/api/fetch-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      return { content: data.content || "", status: "done" };
    } catch {
      return { content: "", status: "error" };
    }
  };

  const sendMessage = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;
    if (isThinking) return;
    if (!auth.currentUser) { console.error("User not logged in"); return; }
    setInterruptedMsgId(null);

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    const urls = extractUrls(input.trim());
    const hasFiles = pendingFiles.length > 0;

    const steps = buildActivitySteps({ text: input.trim(), hasFiles });
    setActivitySteps(steps);
    let enrichedText = input.trim();

    const initialUrlStatuses = urls.length > 0
      ? Object.fromEntries(urls.map(u => [u, "loading"]))
      : undefined;

    const userMsgId = Date.now();
    const userMsg = {
      id: userMsgId,
      sender: "user",
      text: input.trim(),
      urlStatuses: initialUrlStatuses,
      files: pendingFiles.length > 0 ? [...pendingFiles] : [],
      time: getTimestamp(),
    };

    const newMessages = [...messages, userMsg];
    setInput("");
    setPendingFiles([]);

    const firestoreMessages = sanitizeForFirestore(newMessages);
    setChats(prev =>
      prev.map(c => {
        if (c.id !== chat.id) return c;
        const first = !c.messages || c.messages.length === 0;
        return {
          ...c,
          messages: firestoreMessages,
          title: first ? generateChatTitle(userMsg.text || userMsg.files?.[0]?.name || "Chat") : c.title,
        };
      })
    );

    if (urls.length > 0) {
      const results = await Promise.all(urls.map(url => fetchUrlContent(url, token)));
      const finalStatuses = Object.fromEntries(urls.map((u, i) => [u, results[i].status]));
      setChats(prev => prev.map(c =>
        c.id === chat.id
          ? { ...c, messages: c.messages.map(m => m.id === userMsgId ? { ...m, urlStatuses: finalStatuses } : m) }
          : c
      ));
      const urlContents = results.map((r, i) =>
        r.content ? `\n\n[Content from ${urls[i]}]:\n${r.content.slice(0, 4000)}` : ""
      );
      enrichedText = input.trim() + urlContents.join("");
    }

    const pasteContents = pendingFiles
      .filter(f => f.kind === "paste")
      .map(f => `\n\n[${f.name}]:\n${f.textContent}`)
      .join("");
    enrichedText = enrichedText + pasteContents;

const apiMessages = newMessages.map((m, idx) => {
      const isLast = idx === newMessages.length - 1;
      const baseText = isLast ? enrichedText : (m.text || "");
      const filePasteContents = (m.files || [])
        .filter(f => f.kind === "paste")
        .map(f => `\n\n[${f.name}]:\n${f.textContent}`)
        .join("");
      return {
        role: m.sender === "user" ? "user" : "assistant",
        content: isLast ? baseText : (baseText + filePasteContents),
        files: m.files || [],
      };
    });

    try {
      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      });

      if (res.status === 429) { setShowLimitModal(true); setIsThinking(false); return; }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiMsgId = Date.now() + 1;

      setChats(prev =>
        prev.map(c =>
          c.id === chat.id
            ? { ...c, messages: [...newMessages, { id: aiMsgId, sender: "ai", text: "", activityTrail: steps, time: getTimestamp() }] }
            : c
        )
      );
      setIsThinking(false);
      setIsStreaming(true);

      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done) break;
            if (json.error) throw new Error(json.error);
            if (json.text) {
              aiText += json.text;
              const snapshot = aiText;
              setChats(prev =>
                prev.map(c =>
                  c.id === chat.id
                    ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, text: snapshot } : m) }
                    : c
                )
              );
            }
          } catch {}
        }
      }
      setIsStreaming(false);
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error(err);
        setChats(prev =>
          prev.map(c =>
            c.id === chat.id
              ? { ...c, messages: [...newMessages, { id: Date.now() + 2, sender: "ai", text: "Eloria couldn't respond. Check your connection.", time: getTimestamp() }] }
              : c
          )
        );
      }
      setIsThinking(false);
      setIsStreaming(false);
    }
  };

  const regenerateMessage = async (messageId) => {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const prevMsgs = messages.slice(0, idx);
    const lastUser = [...prevMsgs].reverse().find(m => m.sender === "user");
    if (!lastUser) return;
    if (!auth.currentUser) return;
    setInterruptedMsgId(null);

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

   const apiMessages = prevMsgs
      .filter(m => m.text || (m.files && m.files.some(f => f.kind === "paste")))
      .map(m => {
        const pasteContents = (m.files || [])
          .filter(f => f.kind === "paste")
          .map(f => `\n\n[${f.name}]:\n${f.textContent}`)
          .join("");
        return {
          role: m.sender === "user" ? "user" : "assistant",
          content: (m.text || "") + pasteContents,
        };
      });

    try {
      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (res.status === 429) { setShowLimitModal(true); setIsThinking(false); return; }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiMsgId = Date.now();

      setChats(p => p.map(c => c.id === chat.id
        ? { ...c, messages: [...prevMsgs, { id: aiMsgId, sender: "ai", text: "", time: getTimestamp() }] }
        : c
      ));
      setIsThinking(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done || json.error) break;
            if (json.text) {
              aiText += json.text;
              const snapshot = aiText;
              setChats(p => p.map(c => c.id === chat.id
                ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, text: snapshot } : m) }
                : c
              ));
            }
          } catch {}
        }
      }
    } catch { setIsThinking(false); }
  };

  const submitEdit = async (originalMsgId) => {
  if (!editInput.trim()) return;
  const idx = messages.findIndex(m => m.id === originalMsgId);
  if (idx === -1) return;
  const prevMsgs = messages.slice(0, idx);
  if (!auth.currentUser) return;
  const token = await auth.currentUser.getIdToken();

  const editedMsg = {
    id: Date.now(),
    sender: "user",
    text: editInput.trim(),
    files: [],
    time: getTimestamp(),
  };

  const newMessages = [...prevMsgs, editedMsg];
  setEditingMsgId(null);
  setEditInput("");
  setInterruptedMsgId(null);
  setIsThinking(true);

  setChats(prev => prev.map(c =>
    c.id === chat.id ? { ...c, messages: sanitizeForFirestore(newMessages) } : c
  ));

  const apiMessages = newMessages.map(m => {
    const pasteContents = (m.files || [])
      .filter(f => f.kind === "paste")
      .map(f => `\n\n[${f.name}]:\n${f.textContent}`)
      .join("");
    return {
      role: m.sender === "user" ? "user" : "assistant",
      content: (m.text || "") + pasteContents,
    };
  });

  if (abortControllerRef.current) abortControllerRef.current.abort();
  abortControllerRef.current = new AbortController();
  const signal = abortControllerRef.current.signal;

  try {
    const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messages: apiMessages }),
      signal,
    });

    if (res.status === 429) { setShowLimitModal(true); setIsThinking(false); return; }
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let aiText = "";
    const aiMsgId = Date.now() + 1;

    setChats(prev => prev.map(c =>
      c.id === chat.id
        ? { ...c, messages: [...newMessages, { id: aiMsgId, sender: "ai", text: "", time: getTimestamp() }] }
        : c
    ));
    setIsThinking(false);
    setIsStreaming(true);

    while (true) {
      if (signal.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.done) break;
          if (json.error) throw new Error(json.error);
          if (json.text) {
            aiText += json.text;
            const snapshot = aiText;
            setChats(prev => prev.map(c =>
              c.id === chat.id
                ? { ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, text: snapshot } : m) }
                : c
            ));
          }
        } catch {}
      }
    }
    setIsStreaming(false);
  } catch (err) {
    if (err.name !== "AbortError") {
      setChats(prev => prev.map(c =>
        c.id === chat.id
          ? { ...c, messages: [...newMessages, { id: Date.now() + 2, sender: "ai", text: "Eloria couldn't respond. Check your connection.", time: getTimestamp() }] }
          : c
      ));
    }
    setIsThinking(false);
    setIsStreaming(false);
  }
};

  // ── Voice helpers ─────────────────────────────────────────────────────────────
  const getVoiceMessages = () =>
    messagesRef.current.map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text || "",
    }));

  const handleVoiceTranscript = (text) => {
    const userMsg = { id: Date.now(), sender: "user", text, files: [], time: getTimestamp() };
    setChats(prev => prev.map(c => {
      if (c.id !== chat.id) return c;
      const first = !c.messages || c.messages.length === 0;
      return {
        ...c,
        messages: sanitizeForFirestore([...(c.messages || []), userMsg]),
        title: first ? generateChatTitle(text) : c.title,
      };
    }));
  };

  const handleVoiceReply = (text) => {
    const aiMsg = { id: Date.now() + 1, sender: "ai", text, files: [], time: getTimestamp() };
    setChats(prev => prev.map(c =>
      c.id === chat.id
        ? { ...c, messages: sanitizeForFirestore([...(c.messages || []), aiMsg]) }
        : c
    ));
  };

  // Shared input props object
  const inputProps = {
    input, setInput, isThinking, isStreaming,
    pendingFiles, setPendingFiles,
    showAttach, setShowAttach,
    attachRef, fileInputRef, canAddMore,
    textareaRef, voiceOpen, setVoiceOpen,
    sendMessage, abortControllerRef,
    setIsThinking, setIsStreaming,
    handleTextareaPaste,
  };

  const renderMessage = (msg) => {
  const isUser = msg.sender === "user";
  const msgUrlStatuses = msg.urlStatuses || {};
  const urlEntries = Object.entries(msgUrlStatuses);

  return (
    <div key={msg.id} className={`cw-msg-row ${msg.sender}`}>
      {!isUser && (
        <div className="cw-ai-avatar"><img src={logo} alt="Eloria" /></div>
      )}
      <div className={`cw-bubble-stack ${isUser ? "user" : "ai"}`}>

        {/* ── USER MESSAGE ── */}
        {isUser && (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}
            onMouseEnter={e => { const b = e.currentTarget.querySelector(".cw-edit-btn"); if (b) b.style.opacity = "1"; }}
            onMouseLeave={e => { const b = e.currentTarget.querySelector(".cw-edit-btn"); if (b) b.style.opacity = "0"; }}
          >
            {editingMsgId === msg.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%", maxWidth: 420 }}>
                <textarea
                  autoFocus
                  value={editInput}
                  onChange={e => setEditInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitEdit(msg.id); } }}
                  style={{
                    width: "100%", padding: "10px 13px", borderRadius: 14,
                    border: "1.5px solid rgba(13,58,53,.35)", fontFamily: "var(--font)",
                    fontSize: 13, color: "var(--t1)", background: "#fff", outline: "none",
                    resize: "none", minHeight: 72, lineHeight: 1.5, boxSizing: "border-box",
                    boxShadow: "0 0 0 3px rgba(13,58,53,.07)",
                  }}
                />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => { setEditingMsgId(null); setEditInput(""); }}
                    style={{
                      padding: "5px 12px", borderRadius: 8, border: "1px solid var(--border)",
                      background: "none", fontSize: 12, color: "var(--t2)",
                      cursor: "pointer", fontFamily: "var(--font)", fontWeight: 500,
                    }}
                  >Cancel</button>
                  <button
                    onClick={() => submitEdit(msg.id)}
                    style={{
                      padding: "5px 12px", borderRadius: 8, border: "none",
                      background: "#0d3a35", fontSize: 12, color: "#fff",
                      cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600,
                    }}
                  >Send</button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <button
                    className="cw-edit-btn"
                    onClick={() => { setEditingMsgId(msg.id); setEditInput(msg.text); }}
                    title="Edit message"
                    style={{
                      opacity: 0, transition: "opacity .15s",
                      width: 26, height: 26, borderRadius: "50%",
                      background: "none", border: "1px solid rgba(13,58,53,.15)",
                      color: "var(--t3)", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 12, height: 12 }}>
                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  {msg.files?.map(f => (
                    <AttachBubble
                      key={f.id}
                      file={f}
                      sender={msg.sender}
                      onImageClick={setLightboxSrc}
                      onPasteClick={(file) => openPasteViewer(file, msg.id)}
                    />
                  ))}
                  {msg.text && (
  <div className="cw-bubble">
    {msg.text.includes("```")
      ? <MarkdownMessage content={msg.text} />
      : msg.text
    }
  </div>
)}
                </div>
                {urlEntries.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                    {urlEntries.map(([url, status]) => (
                      <UrlFetchChip key={url} url={url} status={status} />
                    ))}
                  </div>
                )}
                <div className="cw-msg-time">{msg.time}</div>
              </>
            )}
          </div>
        )}

        {/* ── AI MESSAGE ── */}
        {!isUser && (
          <>
            {msg.activityTrail && msg.activityTrail.length > 0 && msg.text && (
  <ActivityTrail
    steps={msg.activityTrail}
    isOpen={openTrails[msg.id] !== false}
    onToggle={() => setOpenTrails(prev => ({
      ...prev,
      [msg.id]: prev[msg.id] === false ? true : false,
    }))}
  />
)}

            {msg.text && (
              <div className="cw-bubble">
                <MarkdownMessage content={
                  msg.text
                    .replace(/```document\n[\s\S]*?```/g, "_ Document ready below_")
                    .replace(/```presentation\n[\s\S]*?```/g, "_ Slides ready below_")
                } />
              </div>
            )}

            {msg.text && <DownloadCodeButton text={msg.text} />}
            {msg.text && <DownloadDocButton text={msg.text} />}
            {msg.text && <DownloadPptxButton text={msg.text} />}

            {/* Interrupted notice */}
            {msg.id === interruptedMsgId && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 10px", background: "#fff8f0",
                border: "1px solid rgba(193,127,42,.25)",
                borderRadius: 10, marginTop: 2, width: "fit-content",
              }}>
                <span style={{ fontSize: 11.5, color: "#a07040", fontFamily: "var(--font)" }}>
                  Eloria was interrupted
                </span>
                <button
                  onClick={() => { setInterruptedMsgId(null); regenerateMessage(msg.id); }}
                  style={{
                    fontSize: 11, fontWeight: 600, color: "#0d3a35",
                    background: "#f0ede6", border: "1px solid rgba(13,58,53,.2)",
                    borderRadius: 7, padding: "3px 9px", cursor: "pointer",
                    fontFamily: "var(--font)", transition: "background .12s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#e4dfd6"}
                  onMouseLeave={e => e.currentTarget.style.background = "#f0ede6"}
                >Try again</button>
              </div>
            )}

            <div className="cw-msg-divider">
              <div style={{ flex:1, height:1, background:"linear-gradient(to right, rgba(13,58,53,.12), transparent)" }} />
              <span style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--font)", letterSpacing:".03em" }}>{msg.time}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(msg.text || "");
                  setCopiedMsgId(msg.id);
                  setTimeout(() => setCopiedMsgId(null), 2000);
                }}
                style={{ border:"none", background:"none", color:"var(--t3)", cursor:"pointer", fontSize:10, padding:0, fontFamily:"var(--font)", transition:"color .12s", display:"flex", alignItems:"center", gap:3 }}
                onMouseEnter={e => e.currentTarget.style.color="#0d3a35"}
                onMouseLeave={e => e.currentTarget.style.color="var(--t3)"}
              >
                {copiedMsgId === msg.id ? "✓ copied" : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:10, height:10 }}>
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    copy
                  </>
                )}
              </button>
              <button
                onClick={() => regenerateMessage(msg.id)}
                style={{ border:"none", background:"none", color:"var(--t3)", cursor:"pointer", fontSize:10, padding:0, fontFamily:"var(--font)", transition:"color .12s" }}
                onMouseEnter={e => e.target.style.color="#0d3a35"}
                onMouseLeave={e => e.target.style.color="var(--t3)"}
              >↻ regenerate</button>
              <div style={{ flex:1, height:1, background:"linear-gradient(to left, rgba(13,58,53,.12), transparent)" }} />
            </div>
          </>
        )}

      </div>
    </div>
  );
};

  return (
    <main className="cw-root">
      <input ref={fileInputRef} type="file" style={{ display:"none" }} onChange={onFileChange} />

      <VoiceModal
        isOpen={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        getAuthToken={() => auth.currentUser.getIdToken()}
        getMessages={getVoiceMessages}
        onTranscript={handleVoiceTranscript}
        onReply={handleVoiceReply}
        apiBase="https://eloria-trial.onrender.com"
      />

      {selectionBtn && (
        <button
          className="cw-selection-btn"
          style={{ left: selectionBtn.x, top: selectionBtn.y }}
          onMouseDown={e => e.preventDefault()}
          onClick={handleQuoteReply}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 14 4 9 9 4"/>
            <path d="M20 20v-7a4 4 0 00-4-4H4"/>
          </svg>
          Reply with quote
        </button>
      )}

      <PasteViewerModal
        data={pasteViewer?.file}
        onClose={() => setPasteViewer(null)}
        onSave={savePasteEdit}
      />

      {lightboxSrc && (
        <div className="cw-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="preview" onClick={e => e.stopPropagation()} />
          <button className="cw-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
        </div>
      )}

      <header className="cw-header">
        <div className="cw-header-left">
          <button className="cw-hamburger" onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="cw-logo"><img src={logo} alt="Eloria" /></div>
          <div className="cw-brand">
            <h2>Eloria AI</h2>
            <sub>By Kairox</sub>
          </div>
        </div>
        <div className="cw-header-right">
          <div
            className="cw-plan-badge"
            style={{
              background: userPlan === "pro" || userPlan === "admin" ? "rgba(39,97,82,0.12)" : "rgba(193,127,42,.1)",
              color: "var(--accent)",
              border: userPlan === "pro" || userPlan === "admin" ? "1px solid rgba(39,97,82,.25)" : "1px solid rgba(193,127,42,.25)",
            }}
          >
            {userPlan === "admin" ? "Admin" : userPlan === "pro" ? "Pro ✦" : "Free"}
          </div>
          {userPlan !== "pro" && userPlan !== "admin" && (
            <button className="cw-upgrade" onClick={() => setShowPricing(true)}>Upgrade</button>
          )}
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="cw-body" ref={bodyRef}>
        {showIntro ? (
  <div style={{
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px 40px",
    gap: "32px",
  }}>
    {/* Welcome greeting */}
    <div style={{
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  textAlign: "center",
  animation: "cwFadeUp .45s ease",
}}>
  {greeting.name && displayName ? (
    <>
      <span style={{
        fontSize: 11,
        fontWeight: 500,
        color: "#a8b0a8",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontFamily: "'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}>
        {greeting.label}
      </span>
      <span style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        fontSize: "clamp(38px, 7vw, 58px)",
        fontWeight: 400,
        color: "#0d3a35",
        letterSpacing: "-0.02em",
        lineHeight: 1.08,
      }}>
        {displayName}
      </span>
    </>
  ) : (
    <span style={{
      fontFamily: "'Georgia', 'Times New Roman', serif",
      fontSize: "clamp(32px, 5.5vw, 48px)",
      fontWeight: 400,
      color: "#0d3a35",
      letterSpacing: "-0.02em",
      lineHeight: 1.1,
    }}>
      {greeting.label}
    </span>
  )}
  <span style={{
    fontSize: 13.5,
    color: "#a8b0a8",
    marginTop: 2,
    lineHeight: 1.6,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontWeight: 400,
  }}>
    {greeting.sub}
  </span>
</div>

    {/* Input box */}
    <div style={{ width: "100%", maxWidth: 680 }}>
      {pendingFiles.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div className="cw-pending-strip" style={{ padding: "6px 0 4px" }}>
            {pendingFiles.map(f => (
              <PendingChip
  key={f.id}
  file={f}
  onRemove={() => setPendingFiles(prev => prev.filter(item => item.id !== f.id))}
  onView={(file) => openPasteViewer(file, "pending")}
/>
            ))}
          </div>
          {pendingFiles.length >= 2 && (
            <div className="cw-pending-limit">Max 2 attachments per message</div>
          )}
        </div>
      )}
      <div className="cw-input-box" style={{
        boxShadow: "0 4px 28px rgba(13,58,53,.12), 0 1px 6px rgba(0,0,0,.04)",
        borderColor: "rgba(13,58,53,.18)",
      }}>
        <div className="cw-textarea-row">
          <div className="cw-attach" ref={attachRef}>
            <button
              className={`cw-attach-btn${pendingFiles.length > 0 ? " has-files" : ""}`}
              onClick={() => setShowAttach(v => !v)}
              title="Attach file"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            {showAttach && (
              <div className="cw-attach-menu">
                {!canAddMore && <div className="cw-attach-menu-limit">Max 2 files per message</div>}
                {canAddMore && (
                  <>
                    <div className="cw-attach-menu-item" onClick={() => openFilePicker("image")}>
                      {ATTACH_TYPES.image.icon}<span>Image</span>
                      <span style={{ marginLeft:"auto", fontSize:10, color:"var(--t3)" }}>jpg · png · gif</span>
                    </div>
                    <div className="cw-attach-menu-sep" />
                    <div className="cw-attach-menu-item" onClick={() => openFilePicker("document")}>
                      {ATTACH_TYPES.document.icon}<span>Document</span>
                      <span style={{ marginLeft:"auto", fontSize:10, color:"var(--t3)" }}>pdf · doc · txt</span>
                    </div>
                  </>
                )}
                {pendingFiles.length > 0 && canAddMore && (
                  <><div className="cw-attach-menu-sep" /><div className="cw-attach-menu-limit">{pendingFiles.length}/2 attached</div></>
                )}
              </div>
            )}
          </div>
          <textarea
            ref={textareaRef}
            className="cw-textarea"
            rows={1}
            value={input}
            placeholder="Message Eloria…"
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            onPaste={handleTextareaPaste}
          />
          <button className={`cw-mic-btn${voiceOpen ? " active" : ""}`} onClick={() => setVoiceOpen(true)} title="Voice mode">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
  <line x1="12" y1="19" x2="12" y2="23"/>
  <line x1="8" y1="23" x2="16" y2="23"/>
</svg>
          </button>
          <button
            className="cw-send"
            onClick={sendMessage}
            disabled={!input.trim() && pendingFiles.length === 0}
            title="Send"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </button>
        </div>
      </div>
      <p className="cw-hint" style={{ marginTop: 8 }}>Eloria can make mistakes. Verify important information.</p>
    </div>
  </div>
        ) : (
          <div className="cw-messages">
            {messages.map(renderMessage)}
            {(isThinking || isStreaming) && (
              <div className="cw-thinking">
                <div className="cw-ai-avatar" style={{ width:28, height:28, borderRadius:8, overflow:"hidden", border:"1.5px solid rgba(193,127,42,.2)", background:"#faf8f4", flexShrink:0 }}>
                  <img src={logo} alt="Eloria" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                </div>
                {isThinking && (
  activitySteps.length === 0
    ? <span className="cw-thinking-label">Thinking…</span>
    : <ActivityBar step={activityStep} steps={activitySteps} />
)}
                {isStreaming && <span className="cw-thinking-label">Eloria is responding…</span>}
                <button
                  onClick={() => {
  abortControllerRef.current?.abort();
  setIsThinking(false);
  setIsStreaming(false);
  setChats(prev => {
    const c = prev.find(ch => ch.id === chat.id);
    const lastAi = [...(c?.messages || [])].reverse().find(m => m.sender === "ai");
    if (lastAi) setInterruptedMsgId(lastAi.id);
    return prev;
  });
}}
                  title="Stop"
                  style={{
                    marginLeft: "auto", padding: "4px 8px",
                    background: "#fdf0f0", border: "1px solid rgba(224,82,82,.3)",
                    borderRadius: 8, color: "#0d3a35", fontSize: 11,
                    fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
                    display: "flex", alignItems: "center", gap: 4, flexShrink: 0,
                    transition: "background .12s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fce8e8"}
                  onMouseLeave={e => e.currentTarget.style.background = "#fdf0f0"}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="10" height="10"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                  Stop
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {showLimitModal && (
        <div className="cw-limit-modal-back" onClick={() => setShowLimitModal(false)}>
          <div className="cw-limit-modal" onClick={e => e.stopPropagation()}>
            <div className="cw-limit-modal-top">
              <button className="cw-limit-btn-close" onClick={() => setShowLimitModal(false)}>✕</button>
              <div className="cw-limit-modal-icon">
                {userPlan === "pro" || userPlan === "admin" ? "" : "✦"}
              </div>
              <div className="cw-limit-modal-title">
                {userPlan === "pro" || userPlan === "admin" ? "You're all caught up for today" : "You've hit your daily limit"}
              </div>
              <div className="cw-limit-modal-sub">
                {userPlan === "pro" || userPlan === "admin" ? "Your limits reset at midnight" : "Free plan · resets every day at midnight"}
              </div>
            </div>
            <div className="cw-limit-modal-body">
              <div className="cw-limit-modal-desc">
                {userPlan === "pro" || userPlan === "admin"
                  ? "You've used all your messages for today. Come back tomorrow — your limits reset at midnight."
                  : "You've used all your free messages for today. Upgrade to Pro for double the limits and access to Eloria Code."
                }
              </div>
              <div className="cw-limit-modal-actions">
                <button className="cw-limit-btn-cancel" onClick={() => setShowLimitModal(false)}>
                  {userPlan === "pro" || userPlan === "admin" ? "Got it" : "Later"}
                </button>
                {userPlan !== "pro" && userPlan !== "admin" && (
                  <button className="cw-limit-btn-upgrade" onClick={() => { setShowLimitModal(false); setShowPricing(true); }}>
                    Upgrade to Pro →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM INPUT (only shown when there are messages) ── */}
      {!showIntro && (
        <>
          {pendingFiles.length > 0 && (
            <div style={{ background:"var(--bg-chat)", borderTop:"1px solid var(--border-soft)", paddingTop:2 }}>
              <div className="cw-pending-strip">
                {pendingFiles.map(f => (
                 <PendingChip
  key={f.id}
  file={f}
  onRemove={() => setPendingFiles(prev => prev.filter(item => item.id !== f.id))}
  onView={(file) => openPasteViewer(file, "pending")}
/>
                ))}
              </div>
              {pendingFiles.length >= 2 && (
                <div className="cw-pending-limit">Max 2 attachments per message</div>
              )}
            </div>
          )}
          <div className="cw-input-wrap">
            <InputBox {...inputProps} isCentered={false} />
            <p className="cw-hint">Eloria can make mistakes. Verify important information.</p>
          </div>
        </>
      )}
    </main>
  );
}
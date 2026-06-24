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

// ── Voice state config (molecule orb) ────────────────────────────────────────
const VOICE_STATE_CFG = {
  idle:       { label: "idle",       dotColor: "rgba(255,255,255,0.2)", colors: ["#2d2b55","#3b2d6b","#1e1b4b","#312e81","#2d2b55","#1e1b4b","#3b2d6b"] },
  listening:  { label: "listening",  dotColor: "#00ff88",               colors: ["#6C5CE7","#a78bfa","#4c3fa0","#8b5cf6","#7c3aed","#5b21b6","#4338ca"] },
  processing: { label: "thinking…",  dotColor: "#f59e0b",               colors: ["#6b7280","#9ca3af","#4b5563","#d1d5db","#6b7280","#374151","#9ca3af"] },
  speaking:   { label: "speaking",   dotColor: "#00D9C0",               colors: ["#00D9C0","#06b6d4","#0891b2","#22d3ee","#0e7490","#00b4d8","#48cae4"] },
};

function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) };
}
function lerpC(a, b, t) { return { r: a.r+(b.r-a.r)*t, g: a.g+(b.g-a.g)*t, b: a.b+(b.b-a.b)*t }; }
function rgbaStr(c, a) { return `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`; }

const NUM_MOLS = 52;
function buildMolecules() {
  const mols = [];
  for (let i = 0; i < NUM_MOLS; i++) {
    mols.push({
      angle:      Math.random() * Math.PI * 2,
      baseRadius: 20 + Math.random() * 115,
      size:       2.5 + Math.random() * 4.5,
      speed:      (0.003 + Math.random() * 0.009) * (Math.random() > 0.5 ? 1 : -1),
      phaseOff:   Math.random() * Math.PI * 2,
      pSpeed:     0.02 + Math.random() * 0.05,
      colorIdx:   Math.floor(Math.random() * 7),
      bondTo:     [],
    });
  }
  for (let i = 0; i < mols.length; i++) {
    for (let j = i+1; j < mols.length; j++) {
      if (mols[i].bondTo.length >= 3 || mols[j].bondTo.length >= 3) continue;
      const xi = Math.cos(mols[i].angle)*mols[i].baseRadius;
      const yi = Math.sin(mols[i].angle)*mols[i].baseRadius;
      const xj = Math.cos(mols[j].angle)*mols[j].baseRadius;
      const yj = Math.sin(mols[j].angle)*mols[j].baseRadius;
      if (Math.hypot(xj-xi, yj-yi) < 55) mols[i].bondTo.push(j);
    }
  }
  return mols;
}

function getSupportedMimeType() {
  const types = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"];
  return types.find(t => MediaRecorder.isTypeSupported(t)) || "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Voice Modal
// ─────────────────────────────────────────────────────────────────────────────
function VoiceModal({ isOpen, onClose, getAuthToken, getMessages, onTranscript, onReply, apiBase }) {
  const canvasRef     = useRef(null);
  const miniCanvasRef = useRef(null);
  const animIdRef     = useRef(null);
  const analyserRef   = useRef(null);
  const recorderRef   = useRef(null);
  const streamRef     = useRef(null);
  const audioRef      = useRef(null);
  const chunksRef     = useRef([]);
  const molsRef       = useRef(buildMolecules());
  const phaseRef      = useRef(0);
  const curColorsRef  = useRef(VOICE_STATE_CFG.idle.colors.map(hexToRgb));
  const tgtColorsRef  = useRef(VOICE_STATE_CFG.idle.colors.map(hexToRgb));
  const voiceStateRef = useRef("idle");
  const timerRef      = useRef(null);

  const [voiceState,  setVoiceState]  = useState("idle");
  const [transcript,  setTranscript]  = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [micMuted,    setMicMuted]    = useState(false);
  const [minimized,   setMinimized]   = useState(false);
  const [timerSecs,   setTimerSecs]   = useState(0);

  const setState = useCallback((s) => {
    voiceStateRef.current = s;
    setVoiceState(s);
    tgtColorsRef.current = VOICE_STATE_CFG[s].colors.map(hexToRgb);
  }, []);

  const drawOrb = useCallback((canvasEl, ctxEl) => {
    if (!canvasEl) return;
    const W = canvasEl.width, H = canvasEl.height;
    const cx = W/2, cy = H/2;
    const scale = W / 320;
    const state = voiceStateRef.current;
    const cols  = curColorsRef.current;
    const phase = phaseRef.current;

    ctxEl.clearRect(0, 0, W, H);

    const glowA = state === "speaking" ? 0.12 + 0.05*Math.sin(phase*2)
                : state === "listening" ? 0.08 + 0.04*Math.sin(phase*1.5)
                : state === "processing" ? 0.04 + 0.03*Math.sin(phase*0.8) : 0.02;
    const bg = ctxEl.createRadialGradient(cx, cy, 0, cx, cy, 130*scale);
    bg.addColorStop(0, rgbaStr(cols[0], glowA));
    bg.addColorStop(1, "transparent");
    ctxEl.fillStyle = bg;
    ctxEl.fillRect(0, 0, W, H);

    const speed = state === "speaking" ? 1.8 : state === "listening" ? 1.2 : state === "processing" ? 0.5 : 0.15;
    const mols  = molsRef.current;
    const positions = [];

    for (let i = 0; i < mols.length; i++) {
      mols[i].angle += mols[i].speed * speed;
      const breathe = 1 + 0.12*Math.sin(phase * mols[i].pSpeed * 20 + mols[i].phaseOff);
      const r = mols[i].baseRadius * breathe * scale;
      positions.push({ x: cx + Math.cos(mols[i].angle)*r, y: cy + Math.sin(mols[i].angle)*r });
    }

    for (let i = 0; i < mols.length; i++) {
      for (const j of mols[i].bondTo) {
        const pi = positions[i], pj = positions[j];
        const dist = Math.hypot(pj.x-pi.x, pj.y-pi.y);
        const alpha = Math.max(0, 1 - dist/(55*scale)) * 0.32;
        const c = cols[mols[i].colorIdx % cols.length];
        ctxEl.beginPath();
        ctxEl.moveTo(pi.x, pi.y);
        ctxEl.lineTo(pj.x, pj.y);
        ctxEl.strokeStyle = rgbaStr(c, alpha);
        ctxEl.lineWidth = 0.8 * scale;
        ctxEl.stroke();
      }
    }

    const idleA = state === "idle" ? 0.35 : 0.88;
    for (let i = 0; i < mols.length; i++) {
      const m = mols[i], pos = positions[i];
      const sz = m.size * (1 + 0.15*Math.sin(phase * m.pSpeed * 25 + m.phaseOff)) * scale;
      const c  = cols[m.colorIdx % cols.length];
      ctxEl.beginPath();
      ctxEl.arc(pos.x, pos.y, sz, 0, Math.PI*2);
      ctxEl.fillStyle = rgbaStr(c, idleA);
      ctxEl.fill();
      ctxEl.beginPath();
      ctxEl.arc(pos.x - sz*0.25, pos.y - sz*0.25, sz*0.35, 0, Math.PI*2);
      ctxEl.fillStyle = "rgba(255,255,255,0.22)";
      ctxEl.fill();
    }

    const cg = ctxEl.createRadialGradient(cx, cy, 0, cx, cy, 28*scale);
    cg.addColorStop(0, rgbaStr(cols[0], state === "idle" ? 0.12 : 0.4));
    cg.addColorStop(1, "transparent");
    ctxEl.fillStyle = cg;
    ctxEl.fillRect(0, 0, W, H);
  }, []);

  const startAnimation = useCallback(() => {
    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    const loop = () => {
      phaseRef.current += 0.018;
      const cc = curColorsRef.current, tc = tgtColorsRef.current;
      for (let i = 0; i < cc.length; i++) cc[i] = lerpC(cc[i], tc[i], 0.04);
      const c = canvasRef.current;
      if (c) drawOrb(c, c.getContext("2d"));
      if (minimized) {
        const mc = miniCanvasRef.current;
        if (mc) drawOrb(mc, mc.getContext("2d"));
      }
      animIdRef.current = requestAnimationFrame(loop);
    };
    loop();
  }, [drawOrb, minimized]);

  const stopAnimation = useCallback(() => {
    if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
    animIdRef.current = null;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const resize = () => {
      const c = canvasRef.current;
      if (!c) return;
      c.width  = c.offsetWidth;
      c.height = c.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setState("idle");
      setTranscript(""); setErrorMsg(""); setMicMuted(false);
      setMinimized(false); setTimerSecs(0);
      molsRef.current = buildMolecules();
      timerRef.current = setInterval(() => setTimerSecs(s => s + 1), 1000);
      startAnimation();
      setTimeout(startListening, 350);
    } else {
      stopAll();
      stopAnimation();
      setState("idle");
      clearInterval(timerRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => { startAnimation(); }, [minimized, startAnimation]);

  const stopAll = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (audioRef.current)  { audioRef.current.pause(); audioRef.current = null; }
    analyserRef.current = null;
  }, []);

  const setupSilenceDetection = useCallback((audioCtx, micStream) => {
    const sa = audioCtx.createAnalyser(); sa.fftSize = 512;
    audioCtx.createMediaStreamSource(micStream).connect(sa);
    let silenceStart = null;
    const t0 = Date.now();
    const check = () => {
      if (!recorderRef.current || recorderRef.current.state === "inactive") return;
      if (Date.now() - t0 > 30000) { recorderRef.current.stop(); return; }
      const d = new Uint8Array(sa.frequencyBinCount);
      sa.getByteFrequencyData(d);
      const avg = d.reduce((a,b)=>a+b,0)/d.length;
      if (avg < 8) { if (!silenceStart) silenceStart = Date.now(); else if (Date.now()-silenceStart > 2000) { recorderRef.current.stop(); return; } }
      else silenceStart = null;
      setTimeout(check, 100);
    };
    setTimeout(check, 800);
  }, []);

  const startListening = useCallback(async () => {
    if (voiceStateRef.current !== "idle" && voiceStateRef.current !== "speaking") return;
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    let micStream;
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { setErrorMsg("Microphone access denied."); return; }
    streamRef.current = micStream;
    const audioCtx = new AudioContext();
    const an = audioCtx.createAnalyser(); an.fftSize = 256;
    audioCtx.createMediaStreamSource(micStream).connect(an);
    analyserRef.current = an;
    setState("listening"); setErrorMsg("");
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(micStream, mimeType ? { mimeType } : {});
    recorderRef.current = recorder;
    recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current = null; }
      analyserRef.current = null;
      submitAudio(mimeType);
    };
    recorder.start();
    setupSilenceDetection(audioCtx, micStream);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupSilenceDetection]);

  const submitAudio = useCallback(async (mimeType) => {
    if (chunksRef.current.length === 0) { setState("idle"); return; }
    setState("processing");
    const blob = new Blob(chunksRef.current, { type: mimeType || "audio/webm" });
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("messages", JSON.stringify(getMessages()));
    let token;
    try { token = await getAuthToken(); }
    catch { setErrorMsg("Auth error."); setState("idle"); return; }
    let data;
    try {
      const res = await fetch(`${apiBase}/api/voice/turn`, {
        method:"POST", headers:{ Authorization:`Bearer ${token}` }, body:formData,
      });
      if (res.status === 429) { setErrorMsg("Daily voice limit reached."); setState("idle"); return; }
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error||`Error ${res.status}`); }
      data = await res.json();
    } catch(err) { setErrorMsg(err.message||"Something went wrong."); setState("idle"); return; }
    if (data.transcript) { setTranscript(`"${data.transcript}"`); if (onTranscript) onTranscript(data.transcript); }
    if (data.replyText && onReply) onReply(data.replyText);
    if (data.audioBase64) playAudio(data.audioBase64); else setState("idle");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAuthToken, getMessages, onTranscript, onReply, apiBase]);

  const playAudio = useCallback((base64) => {
    setState("speaking");
    const audio = new Audio(`data:audio/mpeg;base64,${base64}`);
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

  const stopAI = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    analyserRef.current = null;
    setState("idle");
    setTimeout(startListening, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startListening]);

  const toggleMic = useCallback(() => {
    setMicMuted(m => {
      const next = !m;
      if (streamRef.current) streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
      return next;
    });
  }, []);

  const endCall = useCallback(() => {
    stopAll(); stopAnimation();
    clearInterval(timerRef.current);
    setState("idle");
    onClose();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopAll, stopAnimation, onClose]);

  const formatTime = (s) => `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`;
  const cfg = VOICE_STATE_CFG[voiceState] || VOICE_STATE_CFG.idle;

  if (!isOpen) return null;

  if (minimized) {
    return (
      <div
        onClick={() => setMinimized(false)}
        title="Tap to restore"
        style={{
          position:"fixed", bottom:90, right:20, zIndex:9999,
          width:72, height:72, borderRadius:"50%",
          background:"#0d1117",
          border:`1.5px solid ${cfg.dotColor}40`,
          boxShadow:`0 8px 32px rgba(0,0,0,0.6), 0 0 0 4px ${cfg.dotColor}15`,
          cursor:"pointer", overflow:"hidden",
          animation:"evFadeIn .2s ease",
        }}
      >
        <canvas ref={miniCanvasRef} width={72} height={72} style={{ width:"100%", height:"100%" }} />
      </div>
    );
  }

  return (
    <div style={{
      position:"fixed", inset:0, zIndex:9999,
      background:"#080a10",
      display:"flex", flexDirection:"column",
      alignItems:"center", justifyContent:"space-between",
      padding:"32px 0 40px",
      fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
      animation:"evFadeIn .2s ease",
    }}>
      <style>{`
        @keyframes evFadeIn { from{opacity:0} to{opacity:1} }
        @keyframes evPulse  { 0%,100%{transform:scale(1)} 50%{transform:scale(1.06)} }
      `}</style>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"0 28px", boxSizing:"border-box" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:cfg.dotColor, boxShadow:`0 0 8px ${cfg.dotColor}`, flexShrink:0 }} />
          <span style={{ color:"rgba(255,255,255,0.5)", fontSize:13, letterSpacing:"0.04em" }}>{formatTime(timerSecs)}</span>
        </div>
        <span style={{ color:"rgba(255,255,255,0.3)", fontSize:12, letterSpacing:"0.08em" }}>{cfg.label}</span>
        <button
          onClick={() => setMinimized(true)}
          title="Minimize"
          style={{ width:34, height:34, borderRadius:"50%", background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.1)", color:"rgba(255,255,255,0.55)", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </button>
      </div>

      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:20, width:"100%" }}>
        <canvas
          ref={canvasRef}
          style={{ width:"min(320px, 80vw)", height:"min(320px, 80vw)", cursor:"pointer", display:"block" }}
          onClick={() => {
            if (voiceState === "idle") startListening();
            else if (voiceState === "listening" && recorderRef.current?.state !== "inactive") recorderRef.current.stop();
          }}
          title={voiceState === "idle" ? "Tap to speak" : voiceState === "listening" ? "Tap to stop" : ""}
        />
        <div style={{ textAlign:"center", minHeight:36, padding:"0 32px" }}>
          {errorMsg ? (
            <p style={{ margin:0, color:"rgba(230,100,100,0.85)", fontSize:13 }}>{errorMsg}</p>
          ) : transcript ? (
            <p style={{ margin:0, color:"rgba(255,255,255,0.3)", fontSize:13, fontStyle:"italic", lineHeight:1.5 }}>{transcript}</p>
          ) : (
            <p style={{ margin:0, color:"rgba(255,255,255,0.15)", fontSize:12, letterSpacing:"0.05em" }}>
              {voiceState === "idle" ? "tap the orb to speak" : voiceState === "listening" ? "tap orb to stop early" : ""}
            </p>
          )}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:24, width:"100%" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:28 }}>
          <button
            onClick={toggleMic}
            title={micMuted ? "Unmute" : "Mute"}
            style={{
              width:54, height:54, borderRadius:"50%",
              background: micMuted ? "rgba(229,62,62,0.15)" : "rgba(255,255,255,0.07)",
              border: `1.5px solid ${micMuted ? "rgba(229,62,62,0.4)" : "rgba(255,255,255,0.13)"}`,
              color: micMuted ? "#fc8181" : "rgba(255,255,255,0.7)",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s",
            }}
          >
            {micMuted ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="1" y1="1" x2="23" y2="23"/>
                <path d="M9 9v3a3 3 0 005.12 2.12M15 9.34V4a3 3 0 00-5.94-.6"/>
                <path d="M17 16.95A7 7 0 015 12v-2m14 0v2a7 7 0 01-.11 1.23"/>
                <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
              </svg>
            )}
          </button>

          <button
            onClick={endCall}
            title="End call"
            style={{
              width:70, height:70, borderRadius:"50%",
              background:"#e53e3e", border:"none", color:"#fff",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
              boxShadow:"0 0 0 10px rgba(229,62,62,0.13)", transition:"all .2s",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.63A2 2 0 012 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" transform="rotate(135 12 12)"/>
            </svg>
          </button>

          <button
            onClick={stopAI}
            title="Stop AI reply"
            style={{
              width:54, height:54, borderRadius:"50%",
              background: voiceState === "speaking" ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.07)",
              border: `1.5px solid ${voiceState === "speaking" ? "rgba(245,158,11,0.45)" : "rgba(255,255,255,0.13)"}`,
              color: voiceState === "speaking" ? "#fbbf24" : "rgba(255,255,255,0.7)",
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all .2s",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width:16, height:16 }}>
      <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
      <path d="M19 10v2a7 7 0 01-14 0v-2"/>
      <line x1="12" y1="19" x2="12" y2="23"/>
      <line x1="8"  y1="23" x2="16" y2="23"/>
    </svg>
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
  font-family: var(--font); /* keep AI replies in your sans font */
  font-size: 15px;
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
  background: linear-gradient(135deg, #f5ede0 0%, #ede5d8 100%);
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
  background: linear-gradient(135deg, #ede5d8 0%, #e5dcd0 100%);
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


function PendingChip({ file, onRemove }) {
  if (file.kind === "paste") {
    return (
      <div className="cw-pending-chip">
        <div className="cw-pending-doc-icon" style={{ background: "#eef0ea", color: "#5b6b56" }}>
          {file.isCode ? "</>" : "TXT"}
        </div>
        <div className="cw-pending-chip-info">
          <div className="cw-pending-chip-name">{file.name}</div>
          <div className="cw-pending-chip-meta">{file.lineCount} lines</div>
        </div>
        <button className="cw-pending-remove" onClick={onRemove}>✕</button>
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

function AttachBubble({ file, sender, onImageClick }) {
  if (file.kind === "paste") {
    return (
      <div className="cw-attach-doc-bubble">
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
          <MicIcon />
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

  const PASTE_THRESHOLD = 200;

  const handleTextareaPaste = (e) => {
    const text = e.clipboardData.getData("text");
    if (!text || text.length < PASTE_THRESHOLD) return;
    e.preventDefault();
    if (pendingFiles.length >= 2) return;
    const isCode = /```|function |const |let |def |class |import |<\/?[a-z]+>/i.test(text);
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

    const apiMessages = newMessages.map((m, idx) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: idx === newMessages.length - 1 ? enrichedText : (m.text || ""),
      files: m.files || [],
    }));

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
      .filter(m => m.text)
      .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

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

  const apiMessages = newMessages.map(m => ({
    role: m.sender === "user" ? "user" : "assistant",
    content: m.text || "",
  }));

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
                    <AttachBubble key={f.id} file={f} sender={msg.sender} onImageClick={setLightboxSrc} />
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
                <MarkdownMessage content={msg.text} />
              </div>
            )}

            {msg.text && <DownloadCodeButton text={msg.text} />}

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
              <PendingChip key={f.id} file={f} onRemove={() => setPendingFiles(prev => prev.filter(item => item.id !== f.id))} />
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
            <MicIcon />
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
                  <PendingChip key={f.id} file={f} onRemove={() => setPendingFiles(prev => prev.filter(item => item.id !== f.id))} />
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
import React, { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { auth } from "../services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import logo from "../assets/logo.png";
import { convertFileSrc } from "@tauri-apps/api/core";

// ─── STYLES ──────────────────────────────────────────────────────────────────
const HF_STYLE = `
  .hf-root {
    display: flex; flex-direction: column; height: 100dvh; overflow: hidden;
    background: #FBF6F0;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0D3A35; font-size: 13px;
  }

  /* TOPBAR */
  .hf-topbar {
    height: 48px; min-height: 48px;
    display: flex; align-items: center; padding: 0 16px; gap: 10px;
    background: #FBF6F0; border-bottom: 1px solid #dde0d9;
    flex-shrink: 0; z-index: 10;
  }
  .hf-topbar-logo { width: 22px; height: 22px; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
  .hf-topbar-logo img { width: 100%; height: 100%; object-fit: contain; }
  .hf-topbar-title { font-size: 13.5px; font-weight: 600; color: #0D3A35; letter-spacing: -.01em; }
  .hf-topbar-sep { width: 1px; height: 16px; background: #dde0d9; }
  .hf-topbar-badge {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,0.25);
    font-size: 11px; font-weight: 600; color: #276152; letter-spacing: .04em;
  }
  .hf-topbar-spacer { flex: 1; }
  .hf-back-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 8px;
    background: none; border: 1px solid #cdd0c9;
    font-size: 12px; font-weight: 600; color: #3a5a55;
    cursor: pointer; font-family: inherit; transition: all .13s;
  }
  .hf-back-btn:hover { background: #eaf2ef; border-color: rgba(39,97,82,0.3); color: #276152; }
  .hf-back-btn svg { width: 13px; height: 13px; }

  /* BODY SHELL */
  .hf-shell {
    flex: 1; display: flex; overflow: hidden; min-height: 0;
  }

  /* LEFT — preview + timeline */
  .hf-left {
    flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0;
    border-right: 1px solid #dde0d9;
  }

  /* VIDEO PREVIEW */
  .hf-preview {
    flex: 1; min-height: 0; background: #0d0d0d;
    display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
  }
  .hf-preview video {
    max-width: 100%; max-height: 100%; display: block;
  }
  .hf-preview-empty {
    display: flex; flex-direction: column; align-items: center; gap: 16px;
    color: rgba(255,255,255,0.35); text-align: center;
  }
  .hf-preview-empty-icon {
    width: 56px; height: 56px; border-radius: 16px;
    background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
    display: flex; align-items: center; justify-content: center;
  }
  .hf-preview-empty-icon svg { width: 22px; height: 22px; color: rgba(255,255,255,0.3); }
  .hf-preview-empty-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.5); }
  .hf-preview-empty-sub { font-size: 12px; color: rgba(255,255,255,0.25); line-height: 1.6; }
  .hf-open-btn {
    padding: 9px 20px; border-radius: 10px;
    background: #276152; border: none;
    font-size: 13px; font-weight: 600; color: #fff;
    cursor: pointer; font-family: inherit; transition: opacity .13s;
  }
  .hf-open-btn:hover { opacity: .85; }

  /* video overlay controls */
  .hf-vid-controls {
    position: absolute; bottom: 0; left: 0; right: 0;
    padding: 12px 16px;
    background: linear-gradient(transparent, rgba(0,0,0,0.6));
    display: flex; align-items: center; gap: 10px;
  }
  .hf-vid-btn {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.15);
    color: #fff; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s; flex-shrink: 0;
  }
  .hf-vid-btn:hover { background: rgba(255,255,255,0.2); }
  .hf-vid-btn svg { width: 13px; height: 13px; }
  .hf-vid-time { font-size: 11px; color: rgba(255,255,255,0.7); font-variant-numeric: tabular-nums; flex-shrink: 0; }
  .hf-vid-progress {
    flex: 1; height: 3px; background: rgba(255,255,255,0.2);
    border-radius: 2px; cursor: pointer; position: relative;
  }
  .hf-vid-progress-fill { height: 100%; background: #276152; border-radius: 2px; pointer-events: none; }

  /* TIMELINE */
  .hf-timeline {
    flex-shrink: 0; height: 110px; background: #fdfaf6;
    border-top: 1px solid #dde0d9; padding: 12px 16px;
    display: flex; flex-direction: column; gap: 8px;
  }
  .hf-timeline-label {
    font-size: 10.5px; font-weight: 600; color: #7a8a84; letter-spacing: .05em; text-transform: uppercase;
    display: flex; align-items: center; justify-content: space-between;
  }
  .hf-timeline-track {
    position: relative; height: 36px; background: #f0ede8;
    border-radius: 8px; overflow: visible; cursor: pointer;
    border: 1px solid #dde0d9;
  }
  .hf-timeline-fill {
    position: absolute; top: 0; bottom: 0;
    background: rgba(39,97,82,0.15); border: 1.5px solid rgba(39,97,82,0.4);
    border-radius: 6px; pointer-events: none;
  }
  .hf-trim-handle {
    position: absolute; top: 0; bottom: 0; width: 10px;
    background: #276152; border-radius: 4px;
    cursor: ew-resize; z-index: 2;
    display: flex; align-items: center; justify-content: center;
  }
  .hf-trim-handle::after {
    content: ''; width: 2px; height: 14px;
    background: rgba(255,255,255,0.6); border-radius: 1px;
  }
  .hf-playhead {
    position: absolute; top: -4px; bottom: -4px; width: 2px;
    background: #c04040; border-radius: 1px; pointer-events: none; z-index: 3;
  }
  .hf-playhead::before {
    content: ''; position: absolute; top: 0; left: 50%;
    transform: translateX(-50%);
    width: 8px; height: 8px; background: #c04040; border-radius: 50%;
  }
  .hf-timeline-info {
    display: flex; gap: 16px; align-items: center;
  }
  .hf-timeline-chip {
    font-size: 11px; color: #3a5a55; background: #eaf2ef;
    border: 1px solid rgba(39,97,82,0.2); border-radius: 6px;
    padding: 3px 9px; font-variant-numeric: tabular-nums;
  }
  .hf-timeline-chip span { color: #7a8a84; margin-right: 4px; }

  /* PROGRESS BAR */
  .hf-progress-wrap {
    flex-shrink: 0; padding: 0 16px 10px; background: #fdfaf6;
  }
  .hf-progress-bar {
    height: 4px; background: #e8e4de; border-radius: 2px; overflow: hidden;
  }
  .hf-progress-fill {
    height: 100%; background: #276152; border-radius: 2px;
    transition: width .3s ease;
  }
  .hf-progress-label {
    font-size: 10.5px; color: #7a8a84; margin-top: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* RIGHT — AI chat */
  .hf-right {
    flex: 0 0 320px; display: flex; flex-direction: column; overflow: hidden;
    background: #FBF6F0;
  }
  .hf-chat-header {
    height: 50px; min-height: 50px; padding: 0 16px;
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #dde0d9; flex-shrink: 0;
  }
  .hf-chat-header-icon {
    width: 26px; height: 26px; border-radius: 7px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,0.2);
    display: flex; align-items: center; justify-content: center; color: #276152;
  }
  .hf-chat-header-icon svg { width: 13px; height: 13px; }
  .hf-chat-header-title { font-size: 13px; font-weight: 600; color: #0D3A35; }
  .hf-chat-header-sub { font-size: 11px; color: #7a8a84; }

  .hf-chat-body {
    flex: 1; min-height: 0; overflow-y: auto; padding: 12px 14px;
    scrollbar-width: thin; scrollbar-color: #d8d4cc transparent;
    display: flex; flex-direction: column; gap: 2px;
  }
  .hf-chat-body::-webkit-scrollbar { width: 3px; }
  .hf-chat-body::-webkit-scrollbar-thumb { background: #d2cec8; border-radius: 2px; }

  .hf-chat-empty {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 10px; text-align: center; padding: 24px;
    color: #7a8a84;
  }
  .hf-chat-empty-title { font-size: 13px; font-weight: 600; color: #3a5a55; }
  .hf-chat-empty-sub { font-size: 12px; line-height: 1.6; }
  .hf-suggestions { display: flex; flex-direction: column; gap: 6px; width: 100%; margin-top: 4px; }
  .hf-suggestion {
    padding: 8px 12px; border-radius: 8px; text-align: left;
    background: #fff; border: 1px solid #dde0d9;
    font-size: 12px; color: #3a5a55; cursor: pointer; font-family: inherit;
    transition: all .12s;
  }
  .hf-suggestion:hover { background: #eaf2ef; border-color: rgba(39,97,82,0.3); color: #276152; }

  @keyframes hfFadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }

  .hf-msg-row { display: flex; flex-direction: column; animation: hfFadeUp .18s ease; margin-bottom: 6px; }
  .hf-msg-row.user { align-items: flex-end; }
  .hf-msg-row.ai { align-items: flex-start; gap: 4px; }
  .hf-msg-ai-inner { display: flex; align-items: flex-end; gap: 7px; }

  .hf-avatar {
    width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0; overflow: hidden;
    border: 1.5px solid rgba(39,97,82,0.2); background: #faf8f4;
  }
  .hf-avatar img { width: 100%; height: 100%; object-fit: contain; }

  .hf-bubble {
    padding: 9px 13px; border-radius: 14px;
    font-size: 13px; line-height: 1.55; word-break: break-word;
    max-width: 240px;
  }
  .hf-msg-row.user .hf-bubble {
    background: #276152; color: #fff; border-bottom-right-radius: 4px;
  }
  .hf-msg-row.ai .hf-bubble {
    background: #fff; color: #0D3A35;
    border: 1px solid #e8e4de; border-bottom-left-radius: 4px;
  }
  .hf-msg-time { font-size: 10px; color: #7a8a84; margin-top: 2px; padding: 0 2px; }

  /* run button inside AI bubble */
  .hf-run-btn {
    margin-top: 8px; padding: 6px 14px; border-radius: 7px;
    background: #0d3a35; border: none; color: #fff;
    font-size: 12px; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: opacity .12s; display: flex; align-items: center; gap: 6px;
  }
  .hf-run-btn:hover { opacity: .85; }
  .hf-run-btn:disabled { opacity: .4; cursor: default; }
  .hf-run-btn svg { width: 11px; height: 11px; }

  /* thinking dots */
  .hf-thinking { display: flex; align-items: center; gap: 8px; padding: 4px 0; }
  .hf-thinking-dots { display: flex; gap: 4px; }
  .hf-thinking-dots span {
    width: 5px; height: 5px; border-radius: 50%; background: #276152;
    opacity: .4; animation: hfDot 1.2s ease-in-out infinite;
  }
  .hf-thinking-dots span:nth-child(2) { animation-delay: .2s; }
  .hf-thinking-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes hfDot { 0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)} }

  /* INPUT */
  .hf-input-wrap {
    flex-shrink: 0; padding: 8px 14px 14px;
    border-top: 1px solid #dde0d9; background: #FBF6F0;
  }
  .hf-input-box {
    background: #fafaf8; border: 1.5px solid #cdd0c9;
    border-radius: 14px; padding: 9px 10px;
    display: flex; align-items: flex-end; gap: 8px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 4px rgba(0,0,0,.04);
  }
  .hf-input-box:focus-within {
    border-color: rgba(13,58,53,.35);
    box-shadow: 0 0 0 3px rgba(13,58,53,.07);
    background: #fff;
  }
  .hf-textarea {
    flex: 1; border: none; background: none; outline: none;
    font-family: inherit; font-size: 13px; color: #0D3A35;
    resize: none; min-height: 20px; max-height: 100px; line-height: 1.5;
    overflow-y: auto; caret-color: #276152;
  }
  .hf-textarea::placeholder { color: #7a8a84; }
  .hf-send {
    width: 30px; height: 30px; border-radius: 50%;
    background: #0d3a35; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff; transition: opacity .13s, transform .1s;
  }
  .hf-send:hover:not(:disabled) { opacity: .85; transform: scale(1.05); }
  .hf-send:disabled { opacity: .3; cursor: default; }
  .hf-send svg { width: 13px; height: 13px; }
  .hf-hint { font-size: 10.5px; color: #7a8a84; text-align: center; margin-top: 6px; }

  /* output result */
  .hf-result {
    margin-top: 8px; padding: 9px 12px; border-radius: 9px;
    background: #f0faf5; border: 1px solid rgba(39,97,82,0.25);
    font-size: 12px; color: #276152; line-height: 1.5;
  }
  .hf-result.error {
    background: #fff5f5; border-color: rgba(192,64,64,0.25); color: #c04040;
  }
  .hf-result-label { font-weight: 600; margin-bottom: 3px; }
  .hf-result-path {
    font-family: 'SF Mono', Consolas, monospace; font-size: 11px;
    word-break: break-all; color: #3a5a55;
  }
`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(secs) {
  if (!secs || isNaN(secs)) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

// Convert local file path to Tauri asset URL for video preview
function toAssetUrl(filePath) {
  if (!filePath) return null;
  return convertFileSrc(filePath);
}

// Extract ffmpeg args from AI response robustly
function extractFfmpegArgs(text) {
  const clean = text
    .replace(/```[\w\s]*\n?/g, "")
    .replace(/```/g, "")
    .replace(/\bCopy\b/g, "")
    .trim();

  try {
    const parsed = JSON.parse(clean);
    if (parsed.args && Array.isArray(parsed.args)) return parsed.args;
  } catch {}

  const match = clean.match(/"args"\s*:\s*(\[[\s\S]*?\])/);
  if (match) {
    try { return JSON.parse(match[1]); } catch {}
  }

  const objMatch = clean.match(/\{[\s\S]*?"args"\s*:[\s\S]*?\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      if (parsed.args) return parsed.args;
    } catch {}
  }

  return null;
}

// Parse progress percentage from ffmpeg output lines
function parseProgress(line, duration) {
  // ffmpeg -progress pipe:1 outputs key=value pairs
  const outTimeMatch = line.match(/out_time_ms=(\d+)/);
  if (outTimeMatch && duration) {
    const ms = parseInt(outTimeMatch[1], 10) / 1000000;
    return Math.min(99, Math.round((ms / duration) * 100));
  }
  // fallback: parse "time=HH:MM:SS" from stderr
  const timeMatch = line.match(/time=(\d+):(\d+):([\d.]+)/);
  if (timeMatch && duration) {
    const secs = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3]);
    return Math.min(99, Math.round((secs / duration) * 100));
  }
  return null;
}

const norm = (p) => p && p.replace(/\\/g, "/");

const SUGGESTIONS = [
  "Trim to the first 30 seconds",
  "Extract audio as MP3",
  "Compress for sharing (smaller file)",
  "Convert to MP4",
  "Speed up 2x",
  "Slow down to 0.5x",
];

// ─── COMPONENT ────────────────────────────────────────────────────────────────
export default function HyperFrame({ onBack }) {
  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  // Video state
  const [videoPath, setVideoPath] = useState(null);   // local path
  const [videoUrl, setVideoUrl] = useState(null);     // asset:// URL
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [trimIn, setTrimIn] = useState(0);
  const [trimOut, setTrimOut] = useState(0);

  // FFmpeg state
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [lastResult, setLastResult] = useState(null); // { ok, path, error }

  // Chat state
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [, setPendingArgs] = useState(null);

  const [ytUrl, setYtUrl] = useState("");
const [isDownloading, setIsDownloading] = useState(false);
const [downloadResult, setDownloadResult] = useState(null);
const [voiceoverPath, setVoiceoverPath] = useState(null);
const [transcript, setTranscript] = useState(null);
const [isBuildingVideo, setIsBuildingVideo] = useState(false);

  const videoRef = useRef(null);
  const trackRef = useRef(null);
  const chatBodyRef = useRef(null);
  const textareaRef = useRef(null);
  const abortRef = useRef(null);
  const unlistenRef = useRef(null);
  const voiceInputRef = useRef(null);


  const PEXELS_KEY = process.env.REACT_APP_PEXELS_KEY;

async function searchPexelsVideo(query) {
  const res = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`, {
    headers: { Authorization: PEXELS_KEY }
  });
  const data = await res.json();
  const video = data.videos?.[0];
  if (!video) return null;
  // Get highest quality file
  const file = video.video_files?.sort((a, b) => b.width - a.width)[0];
  return { url: file?.link, id: video.id };
}

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  // ── Style injection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!document.getElementById("hf-style-v1")) {
      const tag = document.createElement("style");
      tag.id = "hf-style-v1";
      tag.textContent = HF_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  // ── Scroll chat to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    if (chatBodyRef.current) chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
  }, [messages, isThinking]);

  // ── Textarea auto-resize ──────────────────────────────────────────────────
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 100) + "px";
  }, [input]);

  // ── Cleanup ffmpeg listener on unmount ────────────────────────────────────
  useEffect(() => {
    return () => {
      if (unlistenRef.current) unlistenRef.current();
    };
  }, []);

  // ── Video events ──────────────────────────────────────────────────────────
  const onLoadedMetadata = () => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setTrimIn(0);
    setTrimOut(d);
    setCurrentTime(0);
  };

  const onTimeUpdate = () => {
    setCurrentTime(videoRef.current?.currentTime || 0);
  };

  const onEnded = () => setIsPlaying(false);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (isPlaying) { v.pause(); setIsPlaying(false); }
    else { v.play(); setIsPlaying(true); }
  };

  // Seek on progress bar click
  const onProgressClick = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    v.currentTime = ratio * duration;
  };

  // ── Timeline drag ─────────────────────────────────────────────────────────
  const startDrag = useCallback((e, handle) => {
    e.preventDefault();
    const track = trackRef.current;
    if (!track || !duration) return;

    const onMove = (ev) => {
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const t = ratio * duration;
      if (handle === "in") setTrimIn(Math.min(t, trimOut - 0.5));
      else setTrimOut(Math.max(t, trimIn + 0.5));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [duration, trimIn, trimOut]);

  // ── Open video via Tauri file picker ─────────────────────────────────────
  const openVideo = async () => {
    try {
      const path = await invoke("pick_file");
      if (!path) return;
      setVideoPath(path);
      setVideoUrl(toAssetUrl(path));
      setLastResult(null);
      setPendingArgs(null);
      setProgress(0);
      setProgressLabel("");
    } catch (err) {
      console.error("pick_file error:", err);
    }
  };

  // ── Run ffmpeg ─────────────────────────────────────────────────────────────
  const runFfmpeg = async (args, outputPath) => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setProgressLabel("Starting…");
    setLastResult(null);

    // Listen for progress events
    if (unlistenRef.current) unlistenRef.current();
    unlistenRef.current = await listen("ffmpeg-progress", (event) => {
      const line = event.payload;
      const pct = parseProgress(line, duration);
      if (pct !== null) setProgress(pct);
      // Show last meaningful stderr line
      if (line && !line.startsWith("out_time") && !line.startsWith("frame=") && line.trim()) {
        setProgressLabel(line.trim().slice(0, 80));
      }
    });

    try {
      await invoke("run_ffmpeg", { args });
      setProgress(100);
      setProgressLabel("Done");
      setLastResult({ ok: true, path: outputPath });
    } catch (err) {
      setProgressLabel("Error");
      setLastResult({ ok: false, error: String(err) });
    } finally {
      setIsRunning(false);
      if (unlistenRef.current) { unlistenRef.current(); unlistenRef.current = null; }
    }
  };

  // Ask user to pick output path then run
  const runWithOutputPicker = async (args) => {
    // The last arg in ffmpeg args is always the output file
    // We invoke pick_file but actually we need a save dialog.
    // For simplicity: derive output path from input path + suffix, show it to user.
    // Replace the last arg (output) with a path next to the input
    const outputArg = args[args.length - 1];
    const inputDir = videoPath.replace(/[\\/][^\\/]+$/, "");
    const outputPath = `${inputDir}/${outputArg}`;
    const finalArgs = [...args.slice(0, -1), outputPath];
    await runFfmpeg(finalArgs, outputPath);
  };



// Download from YouTube/TikTok via yt-dlp
const downloadFromUrl = async () => {
  if (!ytUrl.trim() || isDownloading) return;
  setIsDownloading(true);
  setDownloadResult(null);
  try {
    const outputDir = videoPath
      ? videoPath.replace(/[\\/][^\\/]+$/, "")
      : "C:/Users/Public/Videos";
    await invoke("run_ytdlp", {
  args: [
        ytUrl.trim(),
        "-o", `${outputDir}/%(title)s.%(ext)s`,
        "--merge-output-format", "mp4",
        "--no-playlist",
      ]
    });
    setDownloadResult({ ok: true, msg: "Downloaded successfully", dir: outputDir });
  } catch (err) {
    setDownloadResult({ ok: false, msg: String(err).slice(0, 150) });
  } finally {
    setIsDownloading(false);
    setYtUrl("");
  }
};

// Pick voiceover audio file
const openVoiceover = async () => {
  try {
    const path = await invoke("pick_audio_file");
    if (!path) return;
    setVoiceoverPath(path);
    setTranscript(null);
  } catch (err) {
    console.error("pick_audio_file error:", err);
  }
};

// Transcribe voiceover with Whisper then build video
const buildAiVideo = async () => {
  if (!voiceoverPath || isBuildingVideo) return;
  setIsBuildingVideo(true);
  const unlisten = await listen("ffmpeg-progress", (event) => {
  const pct = parseProgress(event.payload, null);
  if (pct !== null) setProgress(prev => Math.max(prev, pct));
});
  setProgressLabel("Transcribing voiceover with Whisper…");
  setProgress(5);

  try {
   // Step 1: Whisper transcription
    const outputDir = norm(voiceoverPath.replace(/[\\/][^\\/]+$/, ""));
    const escapedPath = norm(voiceoverPath).replace(/"/g, '\\"');
    const scriptPath = `${outputDir}/whisper_run.py`;
    const scriptContent = `import whisper, json, os
cache_dir = os.environ.get("WHISPER_CACHE", None)
model = whisper.load_model("base", download_root=cache_dir)
result = model.transcribe(r"${escapedPath}", word_timestamps=True)
segments = [{"start": s["start"], "end": s["end"], "text": s["text"].strip()} for s in result["segments"]]
print(json.dumps(segments))
`;
    await invoke("write_text_file", { path: scriptPath, content: scriptContent });
    const whisperResult = await invoke("run_python", {
  args: [scriptPath]
});

    const segments = JSON.parse(whisperResult);
    setTranscript(segments);
    setProgress(20);
    setProgressLabel(`Got ${segments.length} segments — searching Pexels for clips…`);

    // Step 2: Search Pexels for each segment
    const clipPaths = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const query = seg.text.replace(/[^a-zA-Z0-9 ]/g, "").trim().slice(0, 50);
      setProgressLabel(`Searching clip ${i + 1}/${segments.length}: "${query}"`);
      setProgress(20 + Math.round((i / segments.length) * 40));

      try {
        const pexels = await searchPexelsVideo(query);
        if (pexels?.url) {
          // Download clip via yt-dlp (works for direct video URLs too)
          const clipPath = norm(`${outputDir}/clip_${i}.mp4`);
await invoke("run_shell_command", {
  program: "curl",
  args: ["-L", pexels.url, "-o", clipPath, "--silent", "--fail"]
});
          // Trim clip to segment duration
          const segDur = seg.end - seg.start;
          const trimmedPath = norm(`${outputDir}/clip_trimmed_${i}.mp4`);
          await invoke("run_ffmpeg", {
            args: ["-i", clipPath, "-t", String(segDur), "-c:v", "libx264", "-an", trimmedPath]
          });
          clipPaths.push(trimmedPath);
        }
      } catch (e) {
        console.warn(`Clip ${i} failed:`, e);
      }
    }

    if (clipPaths.length === 0) {
      throw new Error("No clips could be downloaded from Pexels.");
    }

    setProgress(65);
    setProgressLabel("Assembling clips with voiceover…");

    // Step 3: Generate SRT captions from transcript
    const srtPath = `${outputDir}/captions.srt`;
    const srtContent = segments.map((s, i) => {
      const toSrtTime = (t) => {
        const h = Math.floor(t / 3600).toString().padStart(2, "0");
        const m = Math.floor((t % 3600) / 60).toString().padStart(2, "0");
        const sec = Math.floor(t % 60).toString().padStart(2, "0");
        const ms = Math.round((t % 1) * 1000).toString().padStart(3, "0");
        return `${h}:${m}:${sec},${ms}`;
      };
      return `${i + 1}\n${toSrtTime(s.start)} --> ${toSrtTime(s.end)}\n${s.text}\n`;
    }).join("\n");

    await invoke("write_text_file", { path: srtPath, content: srtContent });

    // Step 4: Build concat list for ffmpeg
    const concatPath = `${outputDir}/concat.txt`;
    const concatContent = clipPaths.map(p => `file '${p.replace(/\\/g, "/")}'`).join("\n");
    await invoke("write_text_file", { path: concatPath, content: concatContent });

    // Step 5: Concatenate clips
    const concatVideoPath = `${outputDir}/clips_joined.mp4`;
    await invoke("run_ffmpeg", {
      args: ["-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", concatVideoPath]
    });

    setProgress(80);
    setProgressLabel("Adding voiceover and captions…");

    // Step 6: Final assembly — clips + voiceover + captions + fade transitions
    const finalPath = `${outputDir}/hyperframe_output.mp4`;
    await invoke("run_ffmpeg", {
      args: [
        "-i", concatVideoPath,
        "-i", voiceoverPath,
        "-vf", `subtitles='${norm(srtPath).replace(/^([A-Za-z]):/, "$1\\:")}'`,
        "-c:v", "libx264",
        "-c:a", "aac",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-shortest",
        finalPath
      ]
    });

    setProgress(100);
    setProgressLabel("Done");
    setLastResult({ ok: true, path: finalPath });

  } catch (err) {
    setProgressLabel("Error");
    setLastResult({ ok: false, error: String(err) });
  } finally {
  setIsBuildingVideo(false);
  unlisten();
}
};


  // ── AI chat ────────────────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const msg = (text || input).trim();
    if (!msg || isThinking) return;
    if (!auth.currentUser) return;

    setInput("");
    const userMsg = { id: Date.now(), sender: "user", text: msg, time: getTimestamp() };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);
    setPendingArgs(null);

    try {
      const token = await auth.currentUser.getIdToken();

      const videoName = videoPath ? videoPath.split(/[\\/]/).pop() : "video.mp4";
      const trimCtx = duration > 0
        ? `Current trim: ${fmt(trimIn)} to ${fmt(trimOut)} (duration ${fmt(trimOut - trimIn)}). Full video duration: ${fmt(duration)}.`
        : "";

      const systemPrompt = `You are HyperFrame, an AI video editing assistant inside the Eloria desktop app.
The user has loaded a video file: "${videoName}". ${trimCtx}
When the user describes a video edit, respond with:
1. A brief plain-text explanation of what you will do (1-2 sentences).
2. On a new line, the ffmpeg command as a raw JSON object (no markdown fences): {"args": ["-i", "${videoName}", ...other_args..., "output_filename.mp4"]}
Use the exact input filename. For the output filename, use a descriptive name based on the operation.
If the user asks something that is not a video edit, answer helpfully in plain text without JSON.`;

      const apiMessages = [
        { role: "user", content: systemPrompt },
        { role: "assistant", content: "Understood. I will help edit videos and respond with ffmpeg JSON when needed." },
        ...messages.map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text })),
        { role: "user", content: msg },
      ];

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiId = Date.now() + 1;

      setMessages(prev => [...prev, { id: aiId, sender: "ai", text: "", time: getTimestamp() }]);
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
              const snap = aiText;
              setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: snap } : m));
            }
          } catch {}
        }
      }

      // Extract args if present
      const args = extractFfmpegArgs(aiText);
      if (args) {
        setPendingArgs(args);
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, args } : m));
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setIsThinking(false);
        setMessages(prev => [...prev, { id: Date.now() + 2, sender: "ai", text: `Error: ${err.message}`, time: getTimestamp() }]);
      }
      setIsThinking(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!authReady) return null;
  if (!uid) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100dvh", background: "#FBF6F0", fontSize: 13, color: "#7a8a84" }}>
      Please log in to use HyperFrame.
    </div>
  );

  const inPct = duration > 0 ? (trimIn / duration) * 100 : 0;
  const outPct = duration > 0 ? (trimOut / duration) * 100 : 100;
  const playPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="hf-root">
      {/* Topbar */}
      <div className="hf-topbar">
        <div className="hf-topbar-logo"><img src={logo} alt="Eloria" /></div>
        <span className="hf-topbar-title">Eloria</span>
        <div className="hf-topbar-sep" />
        <div className="hf-topbar-badge">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
          HyperFrame
        </div>
        <div className="hf-topbar-spacer" />
        {onBack && (
          <button className="hf-back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Code
          </button>
        )}
      </div>

      <div className="hf-shell">
        {/* LEFT */}
        <div className="hf-left">
          {/* Preview */}
          <div className="hf-preview">
            {videoUrl ? (
              <>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  onLoadedMetadata={onLoadedMetadata}
                  onTimeUpdate={onTimeUpdate}
                  onEnded={onEnded}
                  style={{ maxWidth: "100%", maxHeight: "100%" }}
                />
                <div className="hf-vid-controls">
                  <button className="hf-vid-btn" onClick={togglePlay}>
                    {isPlaying
                      ? <svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                      : <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                    }
                  </button>
                  <span className="hf-vid-time">{fmt(currentTime)} / {fmt(duration)}</span>
                  <div className="hf-vid-progress" onClick={onProgressClick}>
                    <div className="hf-vid-progress-fill" style={{ width: `${playPct}%` }} />
                  </div>
                  <button className="hf-vid-btn" onClick={openVideo} title="Open different video">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  </button>
                </div>
              </>
            ) : (
              <div className="hf-preview-empty">
                <div className="hf-preview-empty-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                </div>
                <div className="hf-preview-empty-title">No video loaded</div>
                <div className="hf-preview-empty-sub">Open a video file to start editing.<br />Describe what you want in the chat.</div>
                <button className="hf-open-btn" onClick={openVideo}>Open video</button>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="hf-timeline">
            <div className="hf-timeline-label">
              <span>Timeline</span>
              {videoPath && <span style={{ fontWeight: 400, color: "#7a8a84", fontSize: 10, textTransform: "none" }}>{videoPath.split(/[\\/]/).pop()}</span>}
            </div>
            <div
              className="hf-timeline-track"
              ref={trackRef}
              onClick={(e) => {
                if (!duration) return;
                const rect = trackRef.current.getBoundingClientRect();
                const ratio = (e.clientX - rect.left) / rect.width;
                if (videoRef.current) videoRef.current.currentTime = ratio * duration;
              }}
            >
              {/* trim fill */}
              <div className="hf-timeline-fill" style={{ left: `${inPct}%`, width: `${outPct - inPct}%` }} />
              {/* in handle */}
              <div
                className="hf-trim-handle"
                style={{ left: `calc(${inPct}% - 5px)` }}
                onMouseDown={(e) => startDrag(e, "in")}
                onClick={(e) => e.stopPropagation()}
              />
              {/* out handle */}
              <div
                className="hf-trim-handle"
                style={{ left: `calc(${outPct}% - 5px)` }}
                onMouseDown={(e) => startDrag(e, "out")}
                onClick={(e) => e.stopPropagation()}
              />
              {/* playhead */}
              {duration > 0 && (
                <div className="hf-playhead" style={{ left: `${playPct}%` }} />
              )}
            </div>
            <div className="hf-timeline-info">
              <div className="hf-timeline-chip"><span>In</span>{fmt(trimIn)}</div>
              <div className="hf-timeline-chip"><span>Out</span>{fmt(trimOut)}</div>
              <div className="hf-timeline-chip"><span>Len</span>{fmt(trimOut - trimIn)}</div>
            </div>
          </div>

          {/* FFmpeg progress */}
          {(isRunning || progress > 0) && (
            <div className="hf-progress-wrap">
              <div className="hf-progress-bar">
                <div className="hf-progress-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="hf-progress-label">{progressLabel || `${progress}%`}</div>
            </div>
          )}

          {/* Result */}
          {lastResult && (
            <div style={{ padding: "0 16px 12px" }}>
              {lastResult.ok ? (
                <div className="hf-result">
                  <div className="hf-result-label">Output saved</div>
                  <div className="hf-result-path">{lastResult.path}</div>
                </div>
              ) : (
                <div className="hf-result error">
                  <div className="hf-result-label">ffmpeg error</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>{lastResult.error?.slice(0, 200)}</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT — AI chat */}
        <div className="hf-right">
          <div className="hf-chat-header">
            <div className="hf-chat-header-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
            </div>
            <div>
              <div className="hf-chat-header-title">AI Editor</div>
              <div className="hf-chat-header-sub">Describe your edit</div>
            </div>
          </div>

          <div className="hf-chat-body" ref={chatBodyRef}>
            {messages.length === 0 ? (
              <div className="hf-chat-empty">
                <div className="hf-chat-empty-title">What do you want to do?</div>
                <div className="hf-chat-empty-sub">Describe any edit in plain language. HyperFrame will generate and run the ffmpeg command for you.</div>
                <div className="hf-suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="hf-suggestion" onClick={() => sendMessage(s)}>{s}</button>
                  ))}
                  <button
                    className="hf-suggestion"
                    style={{ background: "#fff3cd", borderColor: "#e0c068" }}
                    onClick={() => {
                      if (!videoPath) { alert("Open a video first"); return; }
                      const videoName = videoPath.split(/[\\/]/).pop();
                      runWithOutputPicker(["-i", videoName, "-t", "5", "-c", "copy", "test_trim_output.mp4"]);
                    }}
                  >
                    🧪 TEST: Trim first 5 sec (no AI)
                  </button>
                </div>
              </div>
            ) : (
              <>
                {messages.map(msg => (
                  <div key={msg.id} className={`hf-msg-row ${msg.sender}`}>
                    {msg.sender === "ai" ? (
                      <div className="hf-msg-ai-inner">
                        <div className="hf-avatar"><img src={logo} alt="Eloria" /></div>
                        <div>
                          <div className="hf-bubble">
                            {/* Show text without the raw JSON */}
                            {msg.text.replace(/\{[\s\S]*?"args"[\s\S]*?\}/, "").trim() || msg.text}
                            {/* Run button if args present */}
                            {msg.args && (
                              <button
                                className="hf-run-btn"
                                disabled={isRunning || !videoPath}
                                onClick={() => runWithOutputPicker(msg.args)}
                              >
                                <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                {isRunning ? `Running… ${progress}%` : "Run this edit"}
                              </button>
                            )}
                          </div>
                          <div className="hf-msg-time">{msg.time}</div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="hf-bubble">{msg.text}</div>
                        <div className="hf-msg-time">{msg.time}</div>
                      </>
                    )}
                  </div>
                ))}
                {isThinking && (
                  <div className="hf-msg-row ai">
                    <div className="hf-msg-ai-inner">
                      <div className="hf-avatar"><img src={logo} alt="Eloria" /></div>
                      <div className="hf-thinking">
                        <div className="hf-thinking-dots"><span/><span/><span/></div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* YouTube/TikTok downloader */}
<div style={{ padding: "10px 14px", borderTop: "1px solid #dde0d9", background: "#fdfaf6" }}>
  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a8a84", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Download from URL</div>
  <div style={{ display: "flex", gap: 6 }}>
    <input
      value={ytUrl}
      onChange={e => setYtUrl(e.target.value)}
      placeholder="YouTube or TikTok URL…"
      style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #cdd0c9", background: "#fff", fontSize: 12, color: "#0D3A35", outline: "none", fontFamily: "inherit" }}
      onKeyDown={e => { if (e.key === "Enter") downloadFromUrl(); }}
    />
    <button
      onClick={downloadFromUrl}
      disabled={!ytUrl.trim() || isDownloading}
      style={{ padding: "7px 12px", borderRadius: 8, background: "#0d3a35", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!ytUrl.trim() || isDownloading) ? .4 : 1, fontFamily: "inherit" }}
    >
      {isDownloading ? "…" : "Get"}
    </button>
  </div>
  {downloadResult && (
    <div style={{ marginTop: 6, fontSize: 11, color: downloadResult.ok ? "#276152" : "#c04040" }}>
      {downloadResult.ok ? `Saved to: ${downloadResult.dir}` : downloadResult.msg}
    </div>
  )}
</div>

{/* AI Video Builder */}
<div style={{ padding: "10px 14px", borderTop: "1px solid #dde0d9", background: "#fdfaf6" }}>
  <div style={{ fontSize: 11, fontWeight: 600, color: "#7a8a84", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>AI Video from Voiceover</div>
  <input ref={voiceInputRef} type="file" accept=".mp3,.wav,.m4a,.aac" style={{ display: "none" }} />
  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
    <button
      onClick={openVoiceover}
      style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "1.5px solid #cdd0c9", background: "#fff", fontSize: 12, color: voiceoverPath ? "#276152" : "#7a8a84", cursor: "pointer", fontFamily: "inherit", textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {voiceoverPath ? voiceoverPath.split(/[\\/]/).pop() : "Pick voiceover audio…"}
    </button>
    <button
      onClick={buildAiVideo}
      disabled={!voiceoverPath || isBuildingVideo}
      style={{ padding: "7px 12px", borderRadius: 8, background: "#276152", border: "none", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: (!voiceoverPath || isBuildingVideo) ? .4 : 1, fontFamily: "inherit", whiteSpace: "nowrap" }}
    >
      {isBuildingVideo ? "Building…" : "Build video"}
    </button>
  </div>
  {transcript && (
    <div style={{ marginTop: 6, fontSize: 11, color: "#276152" }}>
      {transcript.length} segments transcribed
    </div>
  )}
</div>

          <div className="hf-input-wrap">
            <div className="hf-input-box">
              <textarea
                ref={textareaRef}
                className="hf-textarea"
                rows={1}
                value={input}
                placeholder={videoPath ? "Describe your edit…" : "Open a video first, then describe your edit…"}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                disabled={isThinking}
              />
              <button
                className="hf-send"
                onClick={() => sendMessage()}
                disabled={!input.trim() || isThinking}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
              </button>
            </div>
            <p className="hf-hint">HyperFrame — powered by ffmpeg</p>
          </div>
        </div>
      </div>
    </div>
  );
}
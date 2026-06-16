// src/components/DMWindow.jsx
import React, { useState, useEffect, useRef } from "react";
import { getOrCreateDM, sendDM, subscribeToDMMessages } from "../services/dmService";
import { formatLastSeen } from "../services/friendService";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

// ── Attach type definitions (mirrors ChatWindow) ──────────────────────────────
const ATTACH_TYPES = {
  image: {
    accept: "image/jpeg,image/png,image/gif,image/webp",
    label: "Image",
    hint: "jpg · png · gif",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  document: {
    accept: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar",
    label: "Document",
    hint: "pdf · doc · zip",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
  },
};

const MAX_FILES = 2;

function getAttachKind(file) {
  if (file.type.startsWith("image/")) return "image";
  return "document";
}

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType) {
  if (mimeType?.startsWith("image/")) return "🖼️";
  if (mimeType?.includes("pdf")) return "📄";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "📝";
  if (mimeType?.includes("sheet") || mimeType?.includes("excel") || mimeType?.includes("csv")) return "📊";
  if (mimeType?.includes("zip") || mimeType?.includes("rar")) return "🗜️";
  return "📎";
}

function docIconStyle(ext) {
  const map = {
    PDF:  { bg: "#fff1f1", color: "#e53e3e" },
    TXT:  { bg: "#f0f4ff", color: "#4a6cf7" },
    DOC:  { bg: "#eff6ff", color: "#2563eb" },
    DOCX: { bg: "#eff6ff", color: "#2563eb" },
    XLS:  { bg: "#f0fdf4", color: "#16a34a" },
    XLSX: { bg: "#f0fdf4", color: "#16a34a" },
    CSV:  { bg: "#f0fdf4", color: "#16a34a" },
    ZIP:  { bg: "#faf5ff", color: "#7c3aed" },
    RAR:  { bg: "#faf5ff", color: "#7c3aed" },
  };
  return map[ext] || { bg: "#f5f5f0", color: "#888" };
}

// ── Styles ────────────────────────────────────────────────────────────────────
const DM_STYLE = `
  /* ── MOUNT ANIMATION ── */
  @keyframes dmFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .dm-shell {
    display: flex; width: 100%; height: 100vh; overflow: hidden;
    background: var(--bg-app);
    animation: dmFadeUp .28s ease;
  }

  /* ── DM LEFT SIDEBAR ── */
  .dm-sidebar {
    width: 280px; flex-shrink: 0;
    background: var(--bg-strip);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    height: 100%; overflow: hidden;
  }
  @media(max-width: 640px) {
    .dm-sidebar { width: 72px; }
    .dm-sidebar .dm-friend-name,
    .dm-sidebar .dm-friend-status,
    .dm-sidebar .dm-section-label,
    .dm-sidebar .dm-my-name,
    .dm-sidebar .dm-my-username { display: none; }
    .dm-sidebar .dm-friend-row { justify-content: center; padding: 8px 0; }
    .dm-sidebar .dm-my-profile { justify-content: center; padding: 12px 0; }
    .dm-back-btn span { display: none; }
    .dm-back-btn { justify-content: center; padding: 10px 0; width: 100%; }
  }

  .dm-back-btn {
    display: flex; align-items: center; gap: 8px;
    margin: 0; padding: 12px 14px;
    border: none; background: none; cursor: pointer;
    color: var(--t2); font-size: 13px; font-weight: 500;
    font-family: var(--font); transition: background 0.12s;
    width: 100%; box-sizing: border-box;
  }
  .dm-back-btn:hover { background: var(--bg-panel); color: var(--t1); }

  .dm-my-profile {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .dm-my-name {
    font-size: 13px; font-weight: 700; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-my-username { font-size: 11px; color: var(--t3); }

  .dm-section-label {
    padding: 10px 14px 6px; font-size: 10px; font-weight: 700;
    color: var(--t3); text-transform: uppercase; letter-spacing: 0.07em; flex-shrink: 0;
  }

  .dm-friends-list { flex: 1; overflow-y: auto; padding: 0 0 12px; }

  .dm-friend-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; cursor: pointer;
    margin-bottom: 1px; transition: background 0.12s;
  }
  .dm-friend-row:hover { background: var(--bg-panel); }
  .dm-friend-row.active { background: var(--accent-bg); }

  .dm-friend-name {
    font-size: 13px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-friend-status { font-size: 11px; color: var(--t3); margin-top: 1px; }
  .dm-no-friends { font-size: 12px; color: var(--t3); padding: 16px 14px; line-height: 1.6; }

  /* ── DM CHAT AREA ── */
  .dm-chat {
    flex: 1; display: flex; flex-direction: column;
    height: 100%; overflow: hidden; background: var(--bg-chat);
  }
  .dm-chat-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    background: var(--bg-panel);
  }
  .dm-messages {
    flex: 1; overflow-y: auto; padding: 12px 0 8px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .dm-start-notice {
    text-align: center; margin-bottom: 28px; padding: 0 16px;
  }

  /* ── INPUT AREA (mirrors ChatWindow .cw-input-wrap / .cw-input-box) ── */
  .dm-input-wrap {
    flex-shrink: 0;
    padding: 8px 16px 14px;
    background: var(--bg-chat);
    border-top: 1px solid var(--border);
  }
  .dm-input-box {
    max-width: 720px; margin: 0 auto;
    background: #fafaf8; border: 1.5px solid var(--border);
    border-radius: 18px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }
  .dm-input-box:focus-within {
    border-color: rgba(193,127,42,.45);
    box-shadow: 0 0 0 3px rgba(193,127,42,.08), 0 1px 6px rgba(0,0,0,.04);
    background: #fff;
  }
  .dm-textarea-row { display: flex; align-items: flex-end; gap: 8px; }
  .dm-textarea {
    flex: 1; border: none; background: none; outline: none;
    font-family: var(--font); font-size: 14px; color: var(--t1);
    resize: none; min-height: 22px; max-height: 120px;
    line-height: 1.55; overflow-y: auto; scrollbar-width: thin;
    caret-color: var(--accent);
  }
  .dm-textarea::placeholder { color: var(--t3); }

  /* Attach button */
  .dm-attach { position: relative; flex-shrink: 0; }
  .dm-attach-btn {
    width: 32px; height: 32px; border: none; border-radius: 50%;
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--t3); transition: background .12s, color .12s;
  }
  .dm-attach-btn:hover { background: #f0ede6; color: var(--accent); }
  .dm-attach-btn.has-files { color: var(--accent); }
  .dm-attach-btn svg { width: 17px; height: 17px; }
  .dm-attach-btn:disabled { opacity: 0.4; cursor: default; }

  /* Attach dropdown — opens upward */
  .dm-attach-menu {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    background: #fff; border: 1px solid #e8e6e0;
    border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.12);
    padding: 5px; min-width: 165px; z-index: 200;
    animation: dmMenuIn .12s ease;
  }
  @keyframes dmMenuIn {
    from { opacity: 0; transform: translateY(6px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .dm-attach-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; font-size: 13px; color: var(--t1);
    border-radius: 10px; cursor: pointer;
    transition: background .11s; font-family: var(--font); font-weight: 500;
  }
  .dm-attach-menu-item:hover { background: #faf7f2; color: var(--accent); }
  .dm-attach-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
  .dm-attach-menu-sep { height: 1px; background: #f0ede8; margin: 3px 8px; }
  .dm-attach-menu-limit { font-size: 10px; color: var(--t3); padding: 4px 12px 5px; font-family: var(--font); }

  /* Send button */
  .dm-send-btn {
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--accent); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff;
    transition: opacity .13s, box-shadow .13s, transform .1s;
  }
  .dm-send-btn:hover:not(:disabled) {
    opacity: .9; box-shadow: 0 3px 14px rgba(193,127,42,.4); transform: scale(1.05);
  }
  .dm-send-btn:disabled { opacity: .3; cursor: default; }
  .dm-send-btn svg { width: 15px; height: 15px; }

  /* ── PENDING STRIP ── */
  .dm-pending-strip {
    display: flex; gap: 8px; flex-wrap: wrap;
    padding: 8px 16px 2px;
    max-width: 720px; margin: 0 auto; width: 100%;
    animation: dmFadeUp .15s ease;
  }
  .dm-pending-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 6px 10px 6px 8px;
    background: #faf8f3;
    border: 1.5px solid rgba(193,127,42,.25);
    border-radius: 10px; max-width: 200px;
    transition: box-shadow .12s;
  }
  .dm-pending-chip:hover { box-shadow: 0 2px 8px rgba(193,127,42,.1); }
  .dm-pending-thumb {
    width: 32px; height: 32px; border-radius: 6px;
    object-fit: cover; flex-shrink: 0; border: 1px solid rgba(0,0,0,.06);
  }
  .dm-pending-doc-icon {
    width: 32px; height: 32px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; font-weight: 800; flex-shrink: 0;
  }
  .dm-pending-chip-info { flex: 1; min-width: 0; }
  .dm-pending-chip-name {
    font-size: 11.5px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-pending-chip-meta { font-size: 10px; color: var(--t3); margin-top: 1px; }
  .dm-pending-remove {
    width: 18px; height: 18px; border: none; background: none;
    border-radius: 50%; cursor: pointer; color: var(--t3);
    font-size: 11px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; transition: color .1s, background .1s; padding: 0;
  }
  .dm-pending-remove:hover { color: #e05252; background: #fef2f2; }
  .dm-pending-limit {
    font-size: 10.5px; color: var(--t3);
    padding: 0 16px 4px; max-width: 720px; margin: 0 auto; width: 100%;
  }

  /* ── UPLOAD PROGRESS BAR ── */
  .dm-upload-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: var(--accent-bg);
    border-radius: 10px; margin: 0 auto 4px; max-width: 720px; width: calc(100% - 32px);
    font-size: 12px; color: var(--t2);
  }
  .dm-upload-progress {
    flex: 1; height: 4px; background: var(--border);
    border-radius: 2px; overflow: hidden;
  }
  .dm-upload-fill {
    height: 100%; background: var(--accent); transition: width 0.2s;
  }

  /* ── MESSAGE ROW ── */
  .dm-msg-row {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 0 20px;
    max-width: 780px; width: 100%; margin: 0 auto;
    animation: dmFadeUp .2s ease;
  }
  .dm-msg-row.mine { flex-direction: row-reverse; }
  .dm-msg-row.new-group { margin-top: 10px; }

  /* ── AVATAR ── */
  .dm-msg-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    align-self: flex-end;
  }
  .dm-msg-avatar.hidden { visibility: hidden; }

  /* ── BUBBLE STACK (mirrors .cw-bubble-stack) ── */
  .dm-bubble-stack {
    display: flex; flex-direction: column; gap: 4px;
    max-width: min(68%, 520px);
    align-items: flex-end;
  }
  .dm-bubble-stack.theirs { align-items: flex-start; }

  /* ── TEXT BUBBLE (mirrors .cw-bubble exactly) ── */
  .dm-bubble {
    padding: 10px 15px;
    font-size: 13px; line-height: 1.5;
    word-break: break-word; white-space: pre-wrap;
    border-radius: 18px;
    font-family: var(--font);
  }
  .dm-bubble.mine {
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,.25);
  }
  .dm-bubble.theirs {
    background: transparent;
    color: var(--t1);
    border: 1px solid #ececea;
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }

  /* ── IMAGE BUBBLE ── */
  .dm-img-bubble {
    border-radius: 16px; overflow: hidden;
    border: 1.5px solid rgba(0,0,0,.08);
    max-width: 240px; min-width: 120px;
    box-shadow: 0 2px 12px rgba(0,0,0,.1);
    cursor: pointer;
    transition: transform .15s, box-shadow .15s;
  }
  .dm-img-bubble:hover { transform: scale(1.02); box-shadow: 0 4px 20px rgba(0,0,0,.15); }
  .dm-img-bubble img { width: 100%; display: block; max-height: 220px; object-fit: cover; }
  .dm-img-bubble.mine { border-bottom-right-radius: 5px; }
  .dm-img-bubble.theirs { border-bottom-left-radius: 5px; }

  /* ── DOCUMENT BUBBLE ── */
  .dm-doc-bubble {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    border-radius: 16px;
    max-width: 280px; min-width: 180px;
    transition: box-shadow .14s;
  }
  .dm-doc-bubble.mine {
    background: rgba(255,255,255,.18);
    border: 1.5px solid rgba(255,255,255,.3);
    border-bottom-right-radius: 5px;
  }
  .dm-doc-bubble.theirs {
    background: #faf9f6;
    border: 1.5px solid #ececea;
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .dm-doc-icon-box {
    width: 38px; height: 38px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; letter-spacing: -.01em; flex-shrink: 0;
  }
  .dm-doc-info { flex: 1; min-width: 0; }
  .dm-doc-name {
    font-size: 12.5px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
  }
  .dm-doc-bubble.mine .dm-doc-name { color: #fff; }
  .dm-doc-bubble.theirs .dm-doc-name { color: var(--t1); }
  .dm-doc-meta { font-size: 10.5px; margin-top: 2px; }
  .dm-doc-bubble.mine .dm-doc-meta { color: rgba(255,255,255,.65); }
  .dm-doc-bubble.theirs .dm-doc-meta { color: var(--t3); }
  .dm-doc-dl {
    display: inline-block; margin-top: 6px;
    font-size: 11px; font-weight: 600; padding: 4px 10px;
    border-radius: 6px; border: none; cursor: pointer;
    font-family: var(--font); text-decoration: none;
  }
  .dm-doc-bubble.mine .dm-doc-dl { background: rgba(255,255,255,.22); color: #fff; }
  .dm-doc-bubble.theirs .dm-doc-dl { background: var(--accent); color: #fff; }

  /* ── LIGHTBOX ── */
  .dm-lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.85);
    display: flex; align-items: center; justify-content: center;
    animation: dmFadeIn .18s ease; cursor: zoom-out;
  }
  @keyframes dmFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .dm-lightbox img {
    max-width: 90vw; max-height: 88vh;
    border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.5);
    object-fit: contain; cursor: default;
  }
  .dm-lightbox-close {
    position: absolute; top: 20px; right: 20px;
    background: rgba(255,255,255,.12); border: none; border-radius: 50%;
    width: 38px; height: 38px; cursor: pointer; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; transition: background .12s;
  }
  .dm-lightbox-close:hover { background: rgba(255,255,255,.22); }

  @media(max-width: 640px) {
    .dm-messages { padding: 10px 0; }
    .dm-msg-row { padding: 0 12px; }
    .dm-input-wrap { padding: 6px 10px 12px; }
    .dm-bubble { font-size: 13px; }
    .dm-bubble-stack { max-width: min(82%, 100%); }
    .dm-img-bubble { max-width: 200px; }
    .dm-img-bubble img { max-height: 180px; }
    .dm-doc-bubble { min-width: 150px; max-width: 240px; }
  }
`;

// ── PendingChip component ─────────────────────────────────────────────────────
function PendingChip({ file, onRemove }) {
  const ext = getExt(file.name);
  const di = docIconStyle(ext);
  return (
    <div className="dm-pending-chip">
      {file.kind === "image" ? (
        <img className="dm-pending-thumb" src={file.previewUrl} alt={file.name} />
      ) : (
        <div className="dm-pending-doc-icon" style={{ background: di.bg, color: di.color }}>
          {ext.slice(0, 3)}
        </div>
      )}
      <div className="dm-pending-chip-info">
        <div className="dm-pending-chip-name">{file.name}</div>
        <div className="dm-pending-chip-meta">{formatBytes(file.size)} · {ext}</div>
      </div>
      <button className="dm-pending-remove" onClick={onRemove}>✕</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DMWindow({ user, friend, friends = [], onSelectFriend, onBack }) {
  const [dmId, setDmId]                   = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { name, pct }
  const [pendingFiles, setPendingFiles]   = useState([]);     // local attach chips
  const [showAttach, setShowAttach]       = useState(false);
  const [lightboxSrc, setLightboxSrc]     = useState(null);

  const bottomRef    = useRef(null);
  const unsubRef     = useRef(() => {});
  const fileInputRef = useRef(null);
  const fileAcceptRef = useRef("");
  const textareaRef  = useRef(null);
  const attachRef    = useRef(null);

  const canAddMore = pendingFiles.length < MAX_FILES;

  // Inject styles once
  useEffect(() => {
    if (!document.getElementById("dm-style-v2")) {
      const tag = document.createElement("style");
      tag.id = "dm-style-v2";
      tag.textContent = DM_STYLE;
      document.head.appendChild(tag);
    }
    // Remove old style tag if present
    const old = document.getElementById("dm-style");
    if (old) old.remove();
  }, []);

  // Subscribe to messages when friend changes
  useEffect(() => {
    if (!friend?.uid) return;
    setMessages([]);
    setDmId(null);
    setPendingFiles([]);
    unsubRef.current();

    let cancelled = false;
    getOrCreateDM(user.uid, friend.uid).then((id) => {
      if (cancelled) return;
      setDmId(id);
      unsubRef.current = subscribeToDMMessages(id, (msgs) => {
        if (!cancelled) setMessages(msgs);
      });
    }).catch(console.error);

    return () => {
      cancelled = true;
      unsubRef.current();
    };
  }, [user.uid, friend?.uid]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Close attach menu on outside click
  useEffect(() => {
    const h = (e) => {
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttach(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Escape closes lightbox
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Auto-resize textarea
  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
  };

  // Open file picker for a given kind (image | document)
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

  // Handle local file selection → add to pending chips
  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const slots = MAX_FILES - pendingFiles.length;
    files.slice(0, slots).forEach((f) => {
      const kind = getAttachKind(f);
      const reader = new FileReader();
      if (kind === "image") {
        reader.onload = (ev) => {
          setPendingFiles((prev) => [...prev, {
            id: Date.now() + Math.random(),
            name: f.name, size: f.size, kind,
            previewUrl: ev.target.result,
            raw: f,
          }]);
        };
        reader.readAsDataURL(f);
      } else {
        setPendingFiles((prev) => [...prev, {
          id: Date.now() + Math.random(),
          name: f.name, size: f.size, kind,
          previewUrl: null,
          raw: f,
        }]);
      }
    });
  };

  // Upload one file to Firebase Storage and send as DM
  const uploadAndSend = async (fileEntry) => {
    const storage = getStorage();
    const path = `dms/${dmId}/${Date.now()}_${fileEntry.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, fileEntry.raw);

    return new Promise((resolve, reject) => {
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadProgress({ name: fileEntry.name, pct });
        },
        (err) => { setUploadProgress(null); reject(err); },
        async () => {
          const url = await getDownloadURL(task.snapshot.ref);
          setUploadProgress(null);
          resolve({ url, kind: fileEntry.kind });
        }
      );
    });
  };

  const handleSend = async () => {
    const text = input.trim();
    if ((!text && pendingFiles.length === 0) || !dmId || sending) return;

    setSending(true);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "22px";

    const filesToSend = [...pendingFiles];
    setPendingFiles([]);

    try {
      // Send text first (if any)
      if (text) {
        await sendDM(dmId, user.uid, text);
      }
      // Upload and send each file sequentially
      for (const fileEntry of filesToSend) {
        const { url, kind } = await uploadAndSend(fileEntry);
        await sendDM(dmId, user.uid, null, {
          type: kind === "image" ? "image" : "file",
          url,
          name: fileEntry.name,
          size: fileEntry.size,
          mimeType: fileEntry.raw?.type || "",
        });
      }
    } catch (e) {
      console.error("DM send error:", e);
    } finally {
      setSending(false);
    }
  };

  // ── Sub-components ──────────────────────────────────────────────────────────

  const SidebarAvatar = ({ name, size = 36, online }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, position: "relative",
      background: "linear-gradient(135deg, var(--accent), #e8a84a)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {name?.[0]?.toUpperCase() || "?"}
      {online !== undefined && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.27, height: size * 0.27, borderRadius: "50%",
          background: online ? "#22c55e" : "#9ca3af",
          border: `2px solid var(--bg-strip)`,
        }} />
      )}
    </div>
  );

  const MsgAvatar = ({ name, hidden }) => (
    <div className={`dm-msg-avatar${hidden ? " hidden" : ""}`}>
      {hidden ? null : name?.[0]?.toUpperCase() || "?"}
    </div>
  );

  // ── Render a received/sent firebase file message ────────────────────────────
  const renderFileBubble = (m, isMe) => {
    const side = isMe ? "mine" : "theirs";

    if (m.fileType === "image") {
      return (
        <div
          className={`dm-img-bubble ${side}`}
          onClick={() => setLightboxSrc(m.fileUrl)}
        >
          <img src={m.fileUrl} alt={m.fileName || "image"} />
        </div>
      );
    }

    // document
    const ext = getExt(m.fileName || "");
    const di = docIconStyle(ext);
    return (
      <div className={`dm-doc-bubble ${side}`}>
        <div className="dm-doc-icon-box" style={{ background: isMe ? "rgba(255,255,255,.2)" : di.bg, color: isMe ? "#fff" : di.color }}>
          {ext.slice(0, 3) || fileIcon(m.fileMimeType)}
        </div>
        <div className="dm-doc-info">
          <div className="dm-doc-name">{m.fileName}</div>
          <div className="dm-doc-meta">{formatBytes(m.fileSize)} · {ext}</div>
          <a
            href={m.fileUrl}
            target="_blank"
            rel="noreferrer"
            download={m.fileName}
            className={`dm-doc-dl ${side}`}
          >
            Download
          </a>
        </div>
      </div>
    );
  };

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <div className="dm-shell">

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="dm-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="preview" onClick={(e) => e.stopPropagation()} />
          <button className="dm-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={onFileChange}
      />

      {/* ── LEFT SIDEBAR ── */}
      <div className="dm-sidebar">
        <button className="dm-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>

        <div className="dm-my-profile">
          <SidebarAvatar name={user.displayName || user.username} size={38} />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="dm-my-name">{user.displayName || user.username}</div>
            <div className="dm-my-username">@{user.username}</div>
          </div>
        </div>

        <div className="dm-section-label">Friends</div>

        <div className="dm-friends-list">
          {friends.length === 0 ? (
            <div className="dm-no-friends">
              Add friends from the notifications panel to start messaging.
            </div>
          ) : friends.map((f) => (
            <div
              key={f.uid}
              className={`dm-friend-row${friend?.uid === f.uid ? " active" : ""}`}
              onClick={() => onSelectFriend(f)}
            >
              <SidebarAvatar name={f.username} size={34} online={f.online} />
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div className="dm-friend-name">@{f.username}</div>
                <div className="dm-friend-status">
                  {f.online ? "Active now" : formatLastSeen(f.online, f.lastSeen)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div className="dm-chat">

        {/* Header */}
        <div className="dm-chat-header">
          <SidebarAvatar name={friend?.username} size={34} online={friend?.online} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
              @{friend?.username}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              {friend?.online ? "Active now" : formatLastSeen(friend?.online, friend?.lastSeen)}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="dm-messages">
          {messages.length === 0 && (
            <div className="dm-start-notice">
              <div style={{
                width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px",
                background: "linear-gradient(135deg, var(--accent), #e8a84a)",
                color: "#fff", fontSize: 22, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {friend?.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)", marginBottom: 4 }}>
                @{friend?.username}
              </div>
              <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 280, margin: "0 auto" }}>
                This is the beginning of your conversation with @{friend?.username}. Say hi! 👋
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isMe = m.senderId === user.uid;
            const senderName = isMe
              ? (user.displayName || user.username)
              : (friend?.username || "?");

            const nextMsg = messages[i + 1];
            const prevMsg = messages[i - 1];
            const isLastInGroup  = !nextMsg || nextMsg.senderId !== m.senderId;
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== m.senderId;

            return (
              <div
                key={m.id}
                className={`dm-msg-row${isMe ? " mine" : ""}${isFirstInGroup ? " new-group" : ""}`}
              >
                <MsgAvatar name={senderName} hidden={!isLastInGroup} />

                <div className={`dm-bubble-stack ${isMe ? "mine" : "theirs"}`}>
                  {m.fileType === "image" || m.fileType === "file"
                    ? renderFileBubble(m, isMe)
                    : (
                      <div className={`dm-bubble ${isMe ? "mine" : "theirs"}`}>
                        {m.text}
                      </div>
                    )
                  }
                </div>
              </div>
            );
          })}

          <div ref={bottomRef} />
        </div>

        {/* Upload progress */}
        {uploadProgress && (
          <div style={{ padding: "0 16px 4px" }}>
            <div className="dm-upload-bar">
              <span style={{ flexShrink: 0 }}>📎 {uploadProgress.name}</span>
              <div className="dm-upload-progress">
                <div className="dm-upload-fill" style={{ width: `${uploadProgress.pct}%` }} />
              </div>
              <span style={{ flexShrink: 0 }}>{uploadProgress.pct}%</span>
            </div>
          </div>
        )}

        {/* Pending chips strip */}
        {pendingFiles.length > 0 && (
          <div style={{ background: "var(--bg-chat)", borderTop: "1px solid var(--border)", paddingTop: 2 }}>
            <div className="dm-pending-strip">
              {pendingFiles.map((f) => (
                <PendingChip
                  key={f.id}
                  file={f}
                  onRemove={() => setPendingFiles((prev) => prev.filter((x) => x.id !== f.id))}
                />
              ))}
            </div>
            {pendingFiles.length >= MAX_FILES && (
              <div className="dm-pending-limit">Max 2 attachments per message</div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="dm-input-wrap">
          <div className="dm-input-box">
            <div className="dm-textarea-row">

              {/* Attach button + dropdown */}
              <div className="dm-attach" ref={attachRef}>
                <button
                  className={`dm-attach-btn${pendingFiles.length > 0 ? " has-files" : ""}`}
                  onClick={() => setShowAttach((v) => !v)}
                  title="Attach file"
                  disabled={!dmId}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>

                {showAttach && (
                  <div className="dm-attach-menu">
                    {!canAddMore && (
                      <div className="dm-attach-menu-limit">Max 2 files per message</div>
                    )}
                    {canAddMore && (
                      <>
                        <div className="dm-attach-menu-item" onClick={() => openFilePicker("image")}>
                          {ATTACH_TYPES.image.icon}
                          <span>Image</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>
                            {ATTACH_TYPES.image.hint}
                          </span>
                        </div>
                        <div className="dm-attach-menu-sep" />
                        <div className="dm-attach-menu-item" onClick={() => openFilePicker("document")}>
                          {ATTACH_TYPES.document.icon}
                          <span>Document</span>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>
                            {ATTACH_TYPES.document.hint}
                          </span>
                        </div>
                      </>
                    )}
                    {pendingFiles.length > 0 && canAddMore && (
                      <>
                        <div className="dm-attach-menu-sep" />
                        <div className="dm-attach-menu-limit">{pendingFiles.length}/2 attached</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              <textarea
                ref={textareaRef}
                className="dm-textarea"
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={
                  pendingFiles.length > 0
                    ? "Add a message about your files…"
                    : `Message @${friend?.username}…`
                }
                rows={1}
              />

              <button
                className="dm-send-btn"
                onClick={handleSend}
                disabled={(!input.trim() && pendingFiles.length === 0) || sending || !dmId}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/>
                  <polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
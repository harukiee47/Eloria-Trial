// src/components/DMWindow.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import { getOrCreateDM, sendDM, subscribeToDMMessages, editDM, deleteDM } from "../services/dmService";
import { formatLastSeen } from "../services/friendService";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getApp } from "firebase/app"; // ← FIX: import getApp to pass the initialized instance

// ── Attach type definitions ────────────────────────────────────────────────────
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

// ── Time helpers ──────────────────────────────────────────────────────────────
function formatMsgTime(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  }
  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" }) + " " +
      date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatDateDivider(ts) {
  if (!ts) return "";
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function sameDay(ts1, ts2) {
  if (!ts1 || !ts2) return false;
  const d1 = ts1?.toDate ? ts1.toDate() : new Date(ts1);
  const d2 = ts2?.toDate ? ts2.toDate() : new Date(ts2);
  return d1.toDateString() === d2.toDateString();
}

// ── Styles ────────────────────────────────────────────────────────────────────
const DM_STYLE = `
  @keyframes dmFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dmPop {
    0%   { transform: scale(.92); opacity: 0; }
    60%  { transform: scale(1.03); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes dmTyping {
    0%, 80%, 100% { transform: scale(0.7); opacity: .4; }
    40%           { transform: scale(1); opacity: 1; }
  }

  .dm-shell {
    display: flex; width: 100%; height: 100vh; overflow: hidden;
    background: var(--bg-app);
    animation: dmFadeUp .28s ease;
  }

  /* ── SIDEBAR ── */
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
    font-family: var(--font); transition: background 0.12s, color 0.12s;
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
    padding: 14px 14px 6px; font-size: 10px; font-weight: 700;
    color: var(--t3); text-transform: uppercase; letter-spacing: 0.1em; flex-shrink: 0;
  }

  .dm-friends-list { flex: 1; overflow-y: auto; padding: 0 6px 12px; }
  .dm-friends-list::-webkit-scrollbar { width: 4px; }
  .dm-friends-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }

  .dm-friend-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; cursor: pointer;
    border-radius: 10px; margin-bottom: 2px;
    transition: background 0.12s;
  }
  .dm-friend-row:hover { background: var(--bg-panel); }
  .dm-friend-row.active {
    background: var(--accent-bg);
    box-shadow: inset 3px 0 0 var(--accent);
  }

  .dm-friend-name {
    font-size: 13px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-friend-status { font-size: 11px; color: var(--t3); margin-top: 1px; }
  .dm-friend-unread {
    margin-left: auto; min-width: 18px; height: 18px; padding: 0 5px;
    border-radius: 9px; background: var(--accent); color: #fff;
    font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .dm-no-friends { font-size: 12px; color: var(--t3); padding: 16px 14px; line-height: 1.6; }

  /* ── CHAT AREA ── */
  .dm-chat {
    flex: 1; display: flex; flex-direction: column;
    height: 100%; overflow: hidden; background: var(--bg-chat);
  }

  .dm-chat-header {
    display: flex; align-items: center; gap: 12px;
    padding: 13px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    background: var(--bg-panel);
    box-shadow: 0 1px 0 var(--border);
  }
  .dm-header-info { flex: 1; min-width: 0; }
  .dm-header-name { font-size: 14px; font-weight: 700; color: var(--t1); }
  .dm-header-status {
    font-size: 11px; color: var(--t3);
    display: flex; align-items: center; gap: 4px; margin-top: 1px;
  }
  .dm-header-status-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .dm-header-actions { display: flex; gap: 4px; }
  .dm-header-btn {
    width: 32px; height: 32px; border: none; background: none;
    border-radius: 8px; cursor: pointer; color: var(--t3);
    display: flex; align-items: center; justify-content: center;
    transition: background .12s, color .12s;
  }
  .dm-header-btn:hover { background: var(--bg-app); color: var(--t1); }
  .dm-header-btn svg { width: 16px; height: 16px; }

  /* ── MESSAGES ── */
  .dm-messages {
    flex: 1; overflow-y: auto; padding: 16px 0 8px;
    display: flex; flex-direction: column; gap: 1px;
  }
  .dm-messages::-webkit-scrollbar { width: 5px; }
  .dm-messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }

  .dm-start-notice {
    text-align: center; margin-bottom: 32px; padding: 24px 16px;
  }
  .dm-start-avatar-ring {
    width: 72px; height: 72px; border-radius: 50%; margin: 0 auto 12px;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff; font-size: 28px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 4px var(--accent-bg), 0 4px 20px rgba(193,127,42,.25);
  }

  /* ── DATE DIVIDER ── */
  .dm-date-divider {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 24px; margin: 4px 0;
    max-width: 780px; width: 100%; margin: 8px auto;
  }
  .dm-date-divider-line { flex: 1; height: 1px; background: var(--border); }
  .dm-date-divider-label {
    font-size: 11px; color: var(--t3); font-weight: 600;
    white-space: nowrap; padding: 2px 8px;
    background: var(--bg-chat); border-radius: 20px;
    border: 1px solid var(--border);
  }

  /* ── MESSAGE ROW ── */
  .dm-msg-row {
    display: flex; align-items: flex-end; gap: 8px;
    padding: 1px 20px;
    max-width: 780px; width: 100%; margin: 0 auto;
    animation: dmFadeUp .18s ease;
  }
  .dm-msg-row.mine { flex-direction: row-reverse; }
  .dm-msg-row.new-group { margin-top: 8px; }

  /* Hover reveals timestamp */
  .dm-msg-row:hover .dm-bubble-time { opacity: 1; }
  .dm-msg-row:hover .dm-file-time    { opacity: 1; }

  /* ── AVATAR ── */
  .dm-msg-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    align-self: flex-end; flex-shrink: 0;
  }
  .dm-msg-avatar.hidden { visibility: hidden; }

  /* ── BUBBLE STACK ── */
  .dm-bubble-stack {
    display: flex; flex-direction: column; gap: 3px;
    max-width: min(68%, 520px);
    align-items: flex-end;
  }
  .dm-bubble-stack.theirs { align-items: flex-start; }

  /* Sender label on first bubble of group */
  .dm-sender-label {
    font-size: 10.5px; font-weight: 600; color: var(--t3);
    padding: 0 4px; margin-bottom: 1px;
  }

  /* ── TEXT BUBBLE ── */
  .dm-bubble {
    padding: 9px 14px;
    font-size: 13.5px; line-height: 1.5;
    word-break: break-word; white-space: pre-wrap;
    border-radius: 18px;
    font-family: var(--font);
    position: relative;
  }
  .dm-bubble.mine {
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 5px;
    box-shadow: 0 2px 10px rgba(193,127,42,.3);
  }
  .dm-bubble.theirs {
    background: var(--bg-panel);
    color: var(--t1);
    border: 1px solid var(--border);
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }

  /* Timestamp on hover */
  .dm-bubble-time {
    font-size: 10px; color: var(--t3); opacity: 0;
    transition: opacity .15s; white-space: nowrap;
    align-self: flex-end; padding-bottom: 3px; flex-shrink: 0;
    pointer-events: none;
  }
  .dm-bubble-time.mine { margin-right: 4px; }
  .dm-bubble-time.theirs { margin-left: 4px; }

  /* Timestamp row under file bubbles */
  .dm-file-time {
    font-size: 10px; color: var(--t3); opacity: 0;
    transition: opacity .15s; white-space: nowrap;
    display: block; margin-top: 3px;
  }
  .dm-bubble-stack.mine .dm-file-time { text-align: right; }
  .dm-bubble-stack.theirs .dm-file-time { text-align: left; }

  /* ── READ RECEIPT / STATUS ── */
  .dm-receipt {
    font-size: 10px; color: rgba(255,255,255,.6);
    display: block; text-align: right; margin-top: 2px; padding-right: 2px;
  }
  .dm-receipt.seen { color: rgba(255,255,255,.8); }

  /* ── IMAGE BUBBLE ── */
  .dm-img-bubble {
    border-radius: 16px; overflow: hidden;
    border: 2px solid rgba(0,0,0,.06);
    max-width: 260px; min-width: 140px;
    box-shadow: 0 2px 14px rgba(0,0,0,.1);
    cursor: zoom-in;
    transition: transform .15s, box-shadow .15s;
    animation: dmPop .25s ease;
  }
  .dm-img-bubble:hover { transform: scale(1.02); box-shadow: 0 6px 24px rgba(0,0,0,.16); }
  .dm-img-bubble img { width: 100%; display: block; max-height: 240px; object-fit: cover; }
  .dm-img-bubble.mine { border-bottom-right-radius: 5px; border-color: rgba(255,255,255,.15); }
  .dm-img-bubble.theirs { border-bottom-left-radius: 5px; }

  /* ── DOCUMENT BUBBLE ── */
  .dm-doc-bubble {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 16px;
    max-width: 290px; min-width: 180px;
    transition: box-shadow .14s, transform .14s;
    animation: dmPop .25s ease;
  }
  .dm-doc-bubble:hover { transform: translateY(-1px); }
  .dm-doc-bubble.mine {
    background: rgba(255,255,255,.18);
    border: 1.5px solid rgba(255,255,255,.3);
    border-bottom-right-radius: 5px;
    box-shadow: 0 2px 8px rgba(0,0,0,.15);
  }
  .dm-doc-bubble.theirs {
    background: var(--bg-panel);
    border: 1.5px solid var(--border);
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .dm-doc-icon-box {
    width: 40px; height: 40px; border-radius: 10px;
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
    display: inline-flex; align-items: center; gap: 4px; margin-top: 7px;
    font-size: 11px; font-weight: 600; padding: 4px 10px;
    border-radius: 6px; border: none; cursor: pointer;
    font-family: var(--font); text-decoration: none; transition: opacity .1s;
  }
  .dm-doc-dl:hover { opacity: .85; }
  .dm-doc-bubble.mine .dm-doc-dl { background: rgba(255,255,255,.22); color: #fff; }
  .dm-doc-bubble.theirs .dm-doc-dl { background: var(--accent); color: #fff; }

  /* ── INPUT AREA ── */
  .dm-input-wrap {
    flex-shrink: 0;
    padding: 8px 16px 14px;
    background: var(--bg-chat);
    border-top: 1px solid var(--border);
  }
  .dm-input-box {
    max-width: 720px; margin: 0 auto;
    background: var(--bg-panel); border: 1.5px solid var(--border);
    border-radius: 20px; padding: 8px 10px;
    display: flex; flex-direction: column; gap: 6px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }
  .dm-input-box:focus-within {
    border-color: rgba(193,127,42,.5);
    box-shadow: 0 0 0 3px rgba(193,127,42,.09), 0 1px 6px rgba(0,0,0,.04);
    background: #fff;
  }
  .dm-textarea-row { display: flex; align-items: flex-end; gap: 6px; }
  .dm-textarea {
    flex: 1; border: none; background: none; outline: none;
    font-family: var(--font); font-size: 14px; color: var(--t1);
    resize: none; min-height: 22px; max-height: 120px;
    line-height: 1.55; overflow-y: auto; scrollbar-width: thin;
    caret-color: var(--accent); padding: 2px 0;
  }
  .dm-textarea::placeholder { color: var(--t3); }

  /* Char counter */
  .dm-char-hint {
    font-size: 10px; color: var(--t3); padding: 0 2px 2px;
    text-align: right; max-width: 720px; margin: 0 auto;
  }
  .dm-char-hint.warn { color: #e05252; }

  /* Attach */
  .dm-attach { position: relative; flex-shrink: 0; }
  .dm-attach-btn {
    width: 32px; height: 32px; border: none; border-radius: 50%;
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--t3); transition: background .12s, color .12s;
  }
  .dm-attach-btn:hover { background: var(--bg-app); color: var(--accent); }
  .dm-attach-btn.has-files { color: var(--accent); }
  .dm-attach-btn svg { width: 17px; height: 17px; }
  .dm-attach-btn:disabled { opacity: 0.35; cursor: default; }

  .dm-attach-menu {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    background: #fff; border: 1px solid #e8e6e0;
    border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.13);
    padding: 5px; min-width: 170px; z-index: 200;
    animation: dmFadeUp .12s ease;
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

  /* Emoji btn */
  .dm-emoji-btn {
    width: 32px; height: 32px; border: none; border-radius: 50%;
    background: none; cursor: pointer; font-size: 17px;
    display: flex; align-items: center; justify-content: center;
    transition: transform .12s; flex-shrink: 0;
  }
  .dm-emoji-btn:hover { transform: scale(1.2); }

  /* Send */
  .dm-send-btn {
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--accent); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff;
    transition: opacity .13s, box-shadow .13s, transform .1s;
    box-shadow: 0 2px 8px rgba(193,127,42,.35);
  }
  .dm-send-btn:hover:not(:disabled) {
    opacity: .9; box-shadow: 0 4px 16px rgba(193,127,42,.45); transform: scale(1.06);
  }
  .dm-send-btn:disabled { opacity: .3; cursor: default; box-shadow: none; }
  .dm-send-btn svg { width: 15px; height: 15px; }

  /* ── PENDING STRIP ── */
  .dm-pending-strip {
    display: flex; gap: 8px; flex-wrap: wrap;
    padding: 8px 16px 4px;
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
  .dm-pending-chip:hover { box-shadow: 0 2px 8px rgba(193,127,42,.12); }
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
    padding: 0 16px 6px; max-width: 720px; margin: 0 auto; width: 100%;
  }

  /* ── UPLOAD PROGRESS ── */
  .dm-upload-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: var(--accent-bg);
    border-radius: 10px; margin: 0 auto 4px; max-width: 720px;
    width: calc(100% - 32px); font-size: 12px; color: var(--t2);
    border: 1px solid rgba(193,127,42,.18);
    animation: dmFadeUp .15s ease;
  }
  .dm-upload-progress {
    flex: 1; height: 5px; background: var(--border);
    border-radius: 3px; overflow: hidden;
  }
  .dm-upload-fill {
    height: 100%; background: var(--accent);
    border-radius: 3px; transition: width 0.2s ease;
  }

  /* ── LIGHTBOX ── */
  .dm-lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.88);
    display: flex; align-items: center; justify-content: center;
    animation: dmFadeIn .18s ease; cursor: zoom-out;
  }
  @keyframes dmFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .dm-lightbox img {
    max-width: 90vw; max-height: 88vh;
    border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.6);
    object-fit: contain; cursor: default;
    animation: dmPop .2s ease;
  }
  .dm-lightbox-close {
    position: absolute; top: 20px; right: 20px;
    background: rgba(255,255,255,.12); border: none; border-radius: 50%;
    width: 40px; height: 40px; cursor: pointer; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; transition: background .12s;
  }
  .dm-lightbox-close:hover { background: rgba(255,255,255,.24); }
  .dm-lightbox-hint {
    position: absolute; bottom: 20px;
    font-size: 12px; color: rgba(255,255,255,.4);
    pointer-events: none;
  }

  /* ── EMPTY STATE ── */
  .dm-empty-chat {
    flex: 1; display: flex; align-items: center; justify-content: center;
    flex-direction: column; gap: 10px; color: var(--t3);
    text-align: center; padding: 24px;
  }
  .dm-empty-icon { font-size: 40px; margin-bottom: 4px; opacity: .5; }

  /* ── MOBILE ── */
  @media(max-width: 640px) {
    .dm-messages { padding: 10px 0; }
    .dm-msg-row { padding: 0 12px; }
    .dm-input-wrap { padding: 6px 10px 12px; }
    .dm-bubble { font-size: 13px; }
    .dm-bubble-stack { max-width: min(82%, 100%); }
    .dm-img-bubble { max-width: 200px; }
    .dm-img-bubble img { max-height: 180px; }
    .dm-doc-bubble { min-width: 150px; max-width: 240px; }
    .dm-chat-header { padding: 10px 14px; }
    .dm-header-actions { display: none; }
  }
`;

// ── PendingChip ───────────────────────────────────────────────────────────────
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
      <button className="dm-pending-remove" onClick={onRemove} title="Remove">✕</button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function DMWindow({ user, friend, friends = [], onSelectFriend, onBack }) {
  const [dmId, setDmId]                     = useState(null);
  const [messages, setMessages]             = useState([]);
  const [input, setInput]                   = useState("");
  const [sending, setSending]               = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { name, pct }
  const [pendingFiles, setPendingFiles]     = useState([]);
  const [showAttach, setShowAttach]         = useState(false);
  const [lightboxSrc, setLightboxSrc]       = useState(null);
  const [searchQuery, setSearchQuery]       = useState("");
  const [sendError, setSendError] = useState(null);
  const [contextMenu, setContextMenu]       = useState(null);
const [editingId, setEditingId]           = useState(null);
const [replyTarget, setReplyTarget]       = useState(null);

  const bottomRef     = useRef(null);
  const unsubRef      = useRef(() => {});
  const fileInputRef  = useRef(null);
  const fileAcceptRef = useRef("");
  const textareaRef   = useRef(null);
  const attachRef     = useRef(null);

  const canAddMore = pendingFiles.length < MAX_FILES;
  const MAX_CHARS  = 2000;
  const overLimit  = input.length > MAX_CHARS;

  // Inject styles once
  useEffect(() => {
    if (!document.getElementById("dm-style-v3")) {
      const tag = document.createElement("style");
      tag.id = "dm-style-v3";
      tag.textContent = DM_STYLE;
      document.head.appendChild(tag);
    }
    ["dm-style", "dm-style-v2"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }, []);

  // Subscribe to messages
  useEffect(() => {
    if (!friend?.uid) return;
    setMessages([]);
    setDmId(null);
    setPendingFiles([]);
    unsubRef.current();

    let cancelled = false;
    getOrCreateDM(user.uid, friend.uid)
      .then((id) => {
        if (cancelled) return;
        setDmId(id);
        unsubRef.current = subscribeToDMMessages(id, (msgs) => {
          if (!cancelled) setMessages(msgs);
        });
      })
      .catch(console.error);

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

  // Close right-click context menu on any click/scroll elsewhere
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener("click", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

// Escape closes lightbox / cancels edit / cancels reply
  useEffect(() => {
    const h = (e) => {
      if (e.key !== "Escape") return;
      if (lightboxSrc) return setLightboxSrc(null);
      if (editingId) { setEditingId(null); setInput(""); return; }
      if (replyTarget) return setReplyTarget(null);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [lightboxSrc, editingId, replyTarget]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 120) + "px";
    }
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

  const onFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const slots = MAX_FILES - pendingFiles.length;
    files.slice(0, slots).forEach((f) => {
      const kind = getAttachKind(f);
      if (kind === "image") {
        const reader = new FileReader();
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

  // ── FIX: pass the initialized Firebase app to getStorage ──────────────────
  const uploadAndSend = useCallback(async (fileEntry) => {
    let storage;
    try {
      // getApp() throws if no app is initialized — surface that clearly
      storage = getStorage(getApp());
    } catch (e) {
      throw new Error("Firebase not initialized: " + e.message);
    }

    const path = `dms/${dmId}/${Date.now()}_${fileEntry.name}`;
    const storageRef = ref(storage, path);

    // ── FIX: pass fileEntry.raw (the actual File object) directly ─────────
    // Previously this was fine but let's also guard against undefined raw
    if (!fileEntry.raw) throw new Error("File data missing");

    const task = uploadBytesResumable(storageRef, fileEntry.raw, {
      contentType: fileEntry.raw.type || "application/octet-stream",
    });

    return new Promise((resolve, reject) => {
      // ── FIX: handle the error case explicitly and clear progress ─────────
      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
          setUploadProgress({ name: fileEntry.name, pct });
        },
        (err) => {
          // This was silently swallowing errors before — now we surface them
          console.error("Upload error:", err.code, err.message);
          setUploadProgress(null);
          reject(new Error(`Upload failed: ${err.code ?? err.message}`));
        },
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            setUploadProgress(null);
            resolve({ url, kind: fileEntry.kind });
          } catch (e) {
            setUploadProgress(null);
            reject(e);
          }
        }
      );
    });
  }, [dmId]);

const isReallyOnline = (f) => {
    if (!f?.online) return false;
    if (!f?.lastSeen) return true;
    const last = f.lastSeen?.toDate ? f.lastSeen.toDate() : new Date(f.lastSeen);
    return Date.now() - last.getTime() < 60000; // stale after 60s with no heartbeat
  };

  const handleContextMenu = (e, m, isMe) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message: m, isMe });
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setInput(m.text || "");
    setReplyTarget(null);
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelEdit = () => { setEditingId(null); setInput(""); };

  const handleDelete = async (m) => {
    setContextMenu(null);
    if (!window.confirm("Delete this message?")) return;
    try {
      await deleteDM(dmId, m.id);
    } catch (e) {
      console.error("Delete failed:", e);
      setSendError("Failed to delete message");
    }
  };

  const startReply = (m) => {
    setReplyTarget(m);
    setEditingId(null);
    setContextMenu(null);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const cancelReply = () => setReplyTarget(null);

  const handleSend = async () => {
    const text = input.trim();

    if (editingId) {
      if (!text) return;
      try {
        await editDM(dmId, editingId, text);
      } catch (e) {
        console.error("Edit failed:", e);
        setSendError(e?.message || "Failed to edit message");
      }
      setEditingId(null);
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "22px";
      return;
    }

    if ((!text && pendingFiles.length === 0) || !dmId || sending || overLimit) return;

    setSending(true);
    setSendError(null);
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "22px";

    const filesToSend = [...pendingFiles];
    setPendingFiles([]);
    const replyTo = replyTarget;
    setReplyTarget(null);

    try {
      if (text) await sendDM(dmId, user.uid, text, null, replyTo);

      for (const fileEntry of filesToSend) {
        const { url, kind } = await uploadAndSend(fileEntry);
        await sendDM(dmId, user.uid, null, {
          type: kind === "image" ? "image" : "file",
          url,
          name: fileEntry.name,
          size: fileEntry.size,
          mimeType: fileEntry.raw?.type || "",
        }, replyTo);
      }
    } catch (e) {
      console.error("DM send error:", e);
      setSendError(e?.code || e?.message || "Failed to send");
      setPendingFiles(filesToSend);
    } finally {
      setSending(false);
    }
  };
  // ── Sub-components ──────────────────────────────────────────────────────────
  const Avatar = ({ name, size = 36, online, style: extraStyle }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, position: "relative",
      background: "linear-gradient(135deg, var(--accent), #e8a84a)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
      ...extraStyle,
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

  const renderFileBubble = (m, isMe) => {
    const side = isMe ? "mine" : "theirs";
    const time = formatMsgTime(m.createdAt);

    if (m.fileType === "image") {
      return (
        <>
          <div className={`dm-img-bubble ${side}`} onClick={() => setLightboxSrc(m.fileUrl)}>
            <img src={m.fileUrl} alt={m.fileName || "image"} loading="lazy" />
          </div>
          <span className="dm-file-time">{time}</span>
        </>
      );
    }

    const ext = getExt(m.fileName || "");
    const di  = docIconStyle(ext);
    return (
      <>
        <div className={`dm-doc-bubble ${side}`}>
          <div className="dm-doc-icon-box"
            style={{ background: isMe ? "rgba(255,255,255,.2)" : di.bg, color: isMe ? "#fff" : di.color }}>
            {ext.slice(0, 3) || fileIcon(m.fileMimeType)}
          </div>
          <div className="dm-doc-info">
            <div className="dm-doc-name">{m.fileName}</div>
            <div className="dm-doc-meta">{formatBytes(m.fileSize)} · {ext}</div>
            <a href={m.fileUrl} target="_blank" rel="noreferrer" download={m.fileName}
              className={`dm-doc-dl ${side}`}>
              ↓ Download
            </a>
          </div>
        </div>
        <span className="dm-file-time">{time}</span>
      </>
    );
  };

  // Filter friends by search
  const filteredFriends = friends.filter((f) =>
    f.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="dm-shell">

      {/* Lightbox */}
      {lightboxSrc && (
        <div className="dm-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="preview" onClick={(e) => e.stopPropagation()} />
          <button className="dm-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
          <span className="dm-lightbox-hint">Press Esc or click outside to close</span>
        </div>
      )}

      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed", top: contextMenu.y, left: contextMenu.x,
            background: "#fff", border: "1px solid #e8e6e0", borderRadius: 12,
            boxShadow: "0 8px 30px rgba(0,0,0,.15)", padding: 5, minWidth: 160, zIndex: 500,
          }}
        >
          {contextMenu.isMe ? (
            <>
              {!contextMenu.message.fileType && (
                <div className="dm-attach-menu-item" onClick={() => startEdit(contextMenu.message)}>
                  <span></span><span>Edit message</span>
                </div>
              )}
              <div className="dm-attach-menu-item" onClick={() => handleDelete(contextMenu.message)}>
                <span></span><span style={{ color: "#e05252" }}>Delete message</span>
              </div>
            </>
          ) : (
            <div className="dm-attach-menu-item" onClick={() => startReply(contextMenu.message)}>
              <span></span><span>Reply</span>
            </div>
          )}
        </div>
      )}

      <input ref={fileInputRef} type="file" style={{ display: "none" }} onChange={onFileChange} />

      {/* ── SIDEBAR ── */}
      <div className="dm-sidebar">
        <button className="dm-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12"/>
            <polyline points="12 19 5 12 12 5"/>
          </svg>
          <span>Back</span>
        </button>

        <div className="dm-my-profile">
          <Avatar name={user.displayName || user.username} size={38} />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="dm-my-name">{user.displayName || user.username}</div>
            <div className="dm-my-username">@{user.username}</div>
          </div>
        </div>

        <div className="dm-section-label">Direct Messages</div>

        {/* Friend search */}
        {friends.length > 4 && (
          <div style={{ padding: "0 10px 6px" }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search friends…"
              style={{
                width: "100%", boxSizing: "border-box",
                padding: "6px 10px", border: "1px solid var(--border)",
                borderRadius: "8px", background: "var(--bg-app)",
                fontSize: "12px", color: "var(--t1)", outline: "none",
                fontFamily: "var(--font)",
              }}
            />
          </div>
        )}

        <div className="dm-friends-list">
          {filteredFriends.length === 0 ? (
            <div className="dm-no-friends">
              {friends.length === 0
                ? "Add friends from the notifications panel to start messaging."
                : "No friends match your search."}
            </div>
          ) : filteredFriends.map((f) => (
            <div
              key={f.uid}
              className={`dm-friend-row${friend?.uid === f.uid ? " active" : ""}`}
              onClick={() => onSelectFriend(f)}
            >
<Avatar name={f.username} size={34} online={isReallyOnline(f)} />
              <div style={{ overflow: "hidden", flex: 1, minWidth: 0 }}>
                <div className="dm-friend-name">@{f.username}</div>
                <div className="dm-friend-status">
                  {isReallyOnline(f) ? "Active now" : formatLastSeen(f.online, f.lastSeen)}
                </div>
              </div>
              {/* Unread badge placeholder — wire to real unread count if available */}
              {f.unreadCount > 0 && (
                <span className="dm-friend-unread">{f.unreadCount}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div className="dm-chat">

        {!friend ? (
          <div className="dm-empty-chat">
            <div className="dm-empty-icon">💬</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--t2)" }}>
              Select a conversation
            </div>
            <div style={{ fontSize: 13, maxWidth: 240 }}>
              Pick a friend from the sidebar to start chatting.
            </div>
          </div>
        ) : (
          <>
{/* Header */}
            <div className="dm-chat-header">
              <Avatar name={friend?.username} size={36} online={isReallyOnline(friend)} />
              <div className="dm-header-info">
                <div className="dm-header-name">@{friend?.username}</div>
                <div className="dm-header-status">
                  <span className="dm-header-status-dot"
                    style={{ background: isReallyOnline(friend) ? "#082b1c" : "#9ca3af" }} />
                  {isReallyOnline(friend) ? "Active now" : formatLastSeen(friend?.online, friend?.lastSeen)}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="dm-messages">
              {messages.length === 0 && (
                <div className="dm-start-notice">
                  <div className="dm-start-avatar-ring">
                    {friend?.username?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 16, color: "var(--t1)", marginBottom: 6 }}>
                    @{friend?.username}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 260, margin: "0 auto", lineHeight: 1.6 }}>
                    This is the beginning of your conversation. Say hi 👋
                  </div>
                </div>
              )}

              {messages.map((m, i) => {
                const isMe       = m.senderId === user.uid;
                const senderName = isMe ? (user.displayName || user.username) : (friend?.username || "?");
                const nextMsg    = messages[i + 1];
                const prevMsg    = messages[i - 1];
                const isLastInGroup  = !nextMsg || nextMsg.senderId !== m.senderId;
                const isFirstInGroup = !prevMsg || prevMsg.senderId !== m.senderId;
                const showDivider    = !prevMsg || !sameDay(prevMsg.createdAt, m.createdAt);
                const time           = formatMsgTime(m.createdAt);
                const isFile         = m.fileType === "image" || m.fileType === "file";

                return (
                  <React.Fragment key={m.id}>
                    {/* Date divider */}
                    {showDivider && (
                      <div className="dm-date-divider">
                        <div className="dm-date-divider-line" />
                        <span className="dm-date-divider-label">
                          {formatDateDivider(m.createdAt)}
                        </span>
                        <div className="dm-date-divider-line" />
                      </div>
                    )}

                    <div
                      className={`dm-msg-row${isMe ? " mine" : ""}${isFirstInGroup ? " new-group" : ""}`}
                      onContextMenu={(e) => handleContextMenu(e, m, isMe)}
                    >
                      <MsgAvatar name={senderName} hidden={!isLastInGroup} />

                      <div className={`dm-bubble-stack ${isMe ? "mine" : "theirs"}`}>
                        {isFirstInGroup && !isMe && (
                          <div className="dm-sender-label">@{senderName}</div>
                        )}

                        {isFile ? (
                          renderFileBubble(m, isMe)
                        ) : (
                          <>
                            {/* Timestamp appears beside bubble on hover */}
                            <div style={{ display: "flex", alignItems: "flex-end",
                              flexDirection: isMe ? "row" : "row-reverse", gap: 0 }}>
                              <span className={`dm-bubble-time ${isMe ? "mine" : "theirs"}`}>
                                {time}
                              </span>
                            <div className={`dm-bubble ${isMe ? "mine" : "theirs"}`}>
                                {m.replyTo && (
                                  <div style={{
                                    fontSize: 11.5, opacity: .75, marginBottom: 5,
                                    paddingLeft: 7, borderLeft: "2px solid currentColor",
                                  }}>
                                    {m.replyTo.text}
                                  </div>
                                )}
                                {m.text}
                                {m.edited && (
                                  <span style={{ fontSize: 10, opacity: .6, marginLeft: 6 }}>(edited)</span>
                                )}
                                {isMe && isLastInGroup && (
                                  <span className="dm-receipt">✓✓</span>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}

              <div ref={bottomRef} />
            </div>

            {/* Upload progress */}
            {uploadProgress && (
              <div style={{ padding: "0 16px 4px" }}>
                <div className="dm-upload-bar">
                  <span style={{ flexShrink: 0, fontSize: 13 }}>📎 {uploadProgress.name}</span>
                  <div className="dm-upload-progress">
                    <div className="dm-upload-fill" style={{ width: `${uploadProgress.pct}%` }} />
                  </div>
                  <span style={{ flexShrink: 0, fontWeight: 600 }}>{uploadProgress.pct}%</span>
                </div>
              </div>
            )}

            {(replyTarget || editingId) && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 16px 0", maxWidth: 720, margin: "0 auto", width: "100%",
              }}>
                <div style={{
                  flex: 1, fontSize: 12, color: "var(--t2)",
                  background: "var(--bg-panel)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "6px 10px", overflow: "hidden",
                  whiteSpace: "nowrap", textOverflow: "ellipsis",
                }}>
                  {editingId ? "Editing message" : (
                    `Replying to ${replyTarget.senderId === user.uid ? "yourself" : "@" + friend?.username}: ${
                      replyTarget.fileType
                        ? (replyTarget.fileType === "image" ? "📷 Photo" : `📎 ${replyTarget.fileName}`)
                        : replyTarget.text
                    }`
                  )}
                </div>
                <button
                  onClick={editingId ? cancelEdit : cancelReply}
                  style={{ border: "none", background: "none", cursor: "pointer", color: "var(--t3)", fontSize: 14 }}
                >✕</button>
              </div>
            )}

            {/* Pending chips */}
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

            {sendError && (
  <div style={{ color: "#e05252", fontSize: 12, padding: "4px 16px", textAlign: "center" }}>
    ⚠ {sendError}
  </div>
)}

            {/* Input */}
            <div className="dm-input-wrap">
              <div className="dm-input-box">
                <div className="dm-textarea-row">

                  {/* Attach */}
                  <div className="dm-attach" ref={attachRef}>
                    <button
                      className={`dm-attach-btn${pendingFiles.length > 0 ? " has-files" : ""}`}
                      onClick={() => setShowAttach((v) => !v)}
                      title="Attach file"
                      disabled={!dmId || !!editingId}
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
                      editingId
                        ? "Edit your message…"
                        : pendingFiles.length > 0
                          ? "Add a caption…"
                          : `Message @${friend?.username}…`
                    }
                    rows={1}
                    maxLength={MAX_CHARS + 50} // soft limit in UI, hard-stop in handleSend
                  />

                  <button
                    className="dm-send-btn"
                    onClick={handleSend}
                    disabled={
                      (!input.trim() && pendingFiles.length === 0) ||
                      sending || !dmId || overLimit
                    }
                    title="Send (Enter)"
                  >
                    {sending ? (
                      // Spinner while sending
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        style={{ animation: "spin 1s linear infinite" }}
                        strokeLinecap="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                        strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="19" x2="12" y2="5"/>
                        <polyline points="5 12 12 5 19 12"/>
                      </svg>
                    )}
                  </button>
                </div>

                {/* Char counter — only show near limit */}
                {input.length > MAX_CHARS * 0.85 && (
                  <div className={`dm-char-hint${overLimit ? " warn" : ""}`}>
                    {input.length}/{MAX_CHARS}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Spinner keyframe injected inline to avoid dependency */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
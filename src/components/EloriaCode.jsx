import React, { useState, useEffect, useRef, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import logo from "../assets/logo.png";
import EloriaCodeWelcome from "./EloriaCodeWelcome";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";

// ─── SUPPORTED EXTENSIONS ─────────────────────────────────────────────────────
const SUPPORTED_EXTS = new Set([
  "js","jsx","ts","tsx","mjs","cjs",
  "html","htm","css","scss","sass","less",
  "json","jsonc","json5",
  "py","rb","php","go","rs","java","kt","swift","c","cpp","cc","h","hpp",
  "cs","vb","fs","fsx",
  "sh","bash","zsh","fish","ps1",
  "sql","graphql","gql",
  "md","mdx","txt","yaml","yml","toml","env","ini","conf","config",
  "vue","svelte","astro",
  "xml","svg","wasm",
  "dockerfile","makefile","gitignore","editorconfig","prettierrc","eslintrc","babelrc",
]);

function isSupportedFile(name) {
  const lower = name.toLowerCase();
  const knownNames = ["dockerfile","makefile",".gitignore",".editorconfig",".prettierrc",".eslintrc",".babelrc",".env"];
  if (knownNames.some(n => lower === n || lower.endsWith("/" + n))) return true;
  const parts = lower.split(".");
  if (parts.length < 2) return false;
  return SUPPORTED_EXTS.has(parts[parts.length - 1]);
}

function getExtLabel(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1] : "file";
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    js:"⬡",jsx:"⬡",ts:"⬡",tsx:"⬡",
    html:"◈",htm:"◈",
    css:"◉",scss:"◉",sass:"◉",less:"◉",
    json:"⊞",yaml:"⊞",yml:"⊞",toml:"⊞",
    py:"◆",rb:"◆",php:"◆",go:"◆",rs:"◆",
    md:"≡",mdx:"≡",txt:"≡",
    sql:"⊕",graphql:"⊕",
    sh:"▸",bash:"▸",zsh:"▸",
  };
  return map[ext] || "◇";
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const EC_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }

  .ec-root {
    --bg:          #16161a;
    --bg-sidebar:  #111114;
    --bg-panel:    #1c1c20;
    --bg-hi:       #242428;
    --bg-input:    #1c1c20;
    --border:      rgba(255,255,255,.07);
    --border-hi:   rgba(255,255,255,.13);
    --t1:          #e8e8ec;
    --t2:          #8c8c96;
    --t3:          #50505a;
    --accent:      #5b8def;
    --accent2:     #89aaff;
    --accent-rgb:  91,141,239;
    --danger:      #e05c5c;
    --success:     #4caf82;
    --warning:     #e8a838;
    --mono:        'SF Mono','JetBrains Mono','Fira Code',Consolas,monospace;
    --ui:          var(--font,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif);
    --radius:      8px;
    --radius-lg:   11px;
  }

  .ec-root {
    display: flex; height: 100dvh; overflow: hidden;
    background: var(--bg);
    font-family: var(--ui);
    color: var(--t1);
  }

  /* ── LEFT SIDEBAR (task list) ── */
  .ec-sidebar {
    width: 240px; min-width: 240px;
    background: var(--bg-sidebar);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow: hidden;
  }

  .ec-sidebar-top {
    padding: 0 14px;
    height: 48px; min-height: 48px;
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ec-logo-wrap {
    width: 22px; height: 22px; border-radius: 6px;
    overflow: hidden; flex-shrink: 0;
  }
  .ec-logo-wrap img { width: 100%; height: 100%; object-fit: contain; }
  .ec-app-name {
    font-size: 13px; font-weight: 600;
    color: var(--t1); letter-spacing: -.01em;
    flex: 1;
  }

  .ec-new-task-btn {
    width: 26px; height: 26px; border-radius: 7px;
    background: rgba(var(--accent-rgb),.14);
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--accent2); flex-shrink: 0;
    transition: background .12s;
  }
  .ec-new-task-btn:hover { background: rgba(var(--accent-rgb),.24); }
  .ec-new-task-btn svg { width: 13px; height: 13px; }

  .ec-section-label {
    padding: 14px 14px 5px;
    font-size: 10px; color: var(--t3);
    letter-spacing: .08em; text-transform: uppercase;
    font-weight: 600; flex-shrink: 0;
  }

  .ec-task-list { flex: 1; overflow-y: auto; padding: 0 6px 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent; }
  .ec-task-list::-webkit-scrollbar { width: 3px; }
  .ec-task-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

  .ec-task-section-title {
    padding: 10px 8px 4px;
    font-size: 10px; font-weight: 600;
    color: var(--t3); letter-spacing: .06em;
    text-transform: uppercase;
    display: flex; align-items: center; gap: 6px;
  }
  .ec-task-section-title .ec-count {
    background: rgba(255,255,255,.06);
    border-radius: 10px; padding: 1px 6px;
    font-size: 9.5px; color: var(--t3);
    font-weight: 600;
  }

  .ec-task-item {
    display: flex; align-items: flex-start; gap: 9px;
    padding: 9px 9px 9px 10px;
    border-radius: var(--radius);
    cursor: pointer;
    transition: background .1s;
    margin-bottom: 2px;
    position: relative;
  }
  .ec-task-item:hover { background: var(--bg-panel); }
  .ec-task-item.active { background: rgba(var(--accent-rgb),.1); }
  .ec-task-item.active::before {
    content: '';
    position: absolute; left: 0; top: 6px; bottom: 6px;
    width: 2px; border-radius: 2px;
    background: var(--accent);
  }

  .ec-task-dot {
    width: 7px; height: 7px; border-radius: 50%;
    flex-shrink: 0; margin-top: 5px;
  }
  .ec-task-dot.in_progress { background: var(--warning); box-shadow: 0 0 0 2px rgba(232,168,56,.15); }
  .ec-task-dot.ready_for_review { background: var(--accent); box-shadow: 0 0 0 2px rgba(var(--accent-rgb),.15); }
  .ec-task-dot.done { background: var(--success); box-shadow: 0 0 0 2px rgba(76,175,130,.15); }

  .ec-task-info { flex: 1; min-width: 0; }
  .ec-task-title {
    font-size: 12.5px; font-weight: 500;
    color: var(--t1); white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
    line-height: 1.4;
  }
  .ec-task-item.active .ec-task-title { color: var(--t1); }
  .ec-task-sub {
    font-size: 11px; color: var(--t3);
    margin-top: 2px; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis;
  }

  .ec-task-del {
    width: 18px; height: 18px; border: none; background: none;
    border-radius: 4px; cursor: pointer; color: var(--t3);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity .1s, color .1s; flex-shrink: 0;
    font-size: 10px; padding: 0; margin-top: 2px;
  }
  .ec-task-item:hover .ec-task-del { opacity: 1; }
  .ec-task-del:hover { color: var(--danger); }

  .ec-empty-tasks {
    padding: 24px 14px;
    font-size: 12px; color: var(--t3);
    line-height: 1.7; text-align: center;
  }

  /* ── MIDDLE (chat) ── */
  .ec-chat {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column;
    background: var(--bg);
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .ec-chat-header {
    height: 48px; min-height: 48px;
    display: flex; align-items: center;
    padding: 0 18px; gap: 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ec-chat-header-title {
    font-size: 13px; font-weight: 500; color: var(--t1);
    flex: 1; min-width: 0;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ec-chat-header-badge {
    font-size: 10px; font-weight: 600;
    padding: 2px 8px; border-radius: 20px;
    letter-spacing: .03em; flex-shrink: 0;
  }
  .ec-chat-header-badge.in_progress {
    background: rgba(232,168,56,.12); color: var(--warning);
  }
  .ec-chat-header-badge.ready_for_review {
    background: rgba(var(--accent-rgb),.12); color: var(--accent2);
  }
  .ec-chat-header-badge.done {
    background: rgba(76,175,130,.12); color: var(--success);
  }

  .ec-status-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 10px; border-radius: 6px;
    background: none; border: 1px solid var(--border);
    font-size: 11px; color: var(--t2); cursor: pointer;
    transition: all .12s; flex-shrink: 0;
  }
  .ec-status-btn:hover { background: var(--bg-hi); border-color: var(--border-hi); color: var(--t1); }
  .ec-status-btn svg { width: 11px; height: 11px; }

  .ec-body {
    flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent;
  }
  .ec-body::-webkit-scrollbar { width: 4px; }
  .ec-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

  .ec-task-intro {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 40px 24px 20px; gap: 16px;
    animation: ecFadeUp .25s ease;
  }
  @keyframes ecFadeUp { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; } }

  .ec-task-intro-icon {
    width: 40px; height: 40px; border-radius: 11px;
    background: rgba(var(--accent-rgb),.1);
    display: flex; align-items: center; justify-content: center;
    font-size: 18px;
  }
  .ec-task-intro-name {
    font-size: 15px; font-weight: 600; color: var(--t1);
    text-align: center;
  }
  .ec-task-intro-meta {
    font-size: 11.5px; color: var(--t3); text-align: center;
  }
  .ec-chips {
    display: flex; flex-wrap: wrap; gap: 7px;
    justify-content: center; max-width: 500px; width: 100%;
    margin-top: 4px;
  }
  .ec-chip {
    padding: 7px 13px;
    background: var(--bg-panel); border: 1px solid var(--border);
    border-radius: 7px; font-size: 12px; color: var(--t2);
    cursor: pointer; transition: all .11s; line-height: 1.4;
  }
  .ec-chip:hover { background: var(--bg-hi); border-color: var(--border-hi); color: var(--t1); }

  .ec-messages { flex: 1; padding: 18px 0 6px; display: flex; flex-direction: column; }
  .ec-msg-wrap { display: flex; padding: 4px 20px; max-width: 740px; width: 100%; margin: 0 auto; }
  .ec-msg-wrap.user { justify-content: flex-end; }
  .ec-msg-wrap.ai { justify-content: flex-start; align-items: flex-start; gap: 9px; }
  .ec-ai-avatar { width: 22px; height: 22px; border-radius: 6px; overflow: hidden; flex-shrink: 0; margin-top: 3px; }
  .ec-ai-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .ec-bubble {
    max-width: 90%; padding: 8px 13px;
    font-size: 13.5px; line-height: 1.55;
    word-break: break-word; border-radius: 10px;
  }
  .ec-msg-wrap.user .ec-bubble {
    background: rgba(var(--accent-rgb),.14);
    color: var(--t1);
    border: 1px solid rgba(var(--accent-rgb),.2);
    border-bottom-right-radius: 3px;
  }
  .ec-msg-wrap.ai .ec-bubble {
    background: var(--bg-panel); border: 1px solid var(--border);
    color: var(--t1); border-bottom-left-radius: 3px;
  }

  /* ── Attachment bubble ── */
  .ec-attach-bubble-solo {
    max-width: 80%; border-bottom-right-radius: 3px;
    background: rgba(var(--accent-rgb),.1);
    border: 1px solid rgba(var(--accent-rgb),.18);
    border-radius: 10px; overflow: hidden;
  }
  .ec-attach-header {
    display: flex; align-items: center; gap: 7px;
    padding: 8px 12px 7px;
    border-bottom: 1px solid rgba(var(--accent-rgb),.12);
  }
  .ec-attach-header-icon {
    width: 24px; height: 24px; background: rgba(var(--accent-rgb),.14);
    border-radius: 5px; display: flex; align-items: center; justify-content: center;
    font-size: 11px; flex-shrink: 0;
  }
  .ec-attach-header-info { flex: 1; min-width: 0; }
  .ec-attach-header-name { font-size: 12px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-header-meta { font-size: 10px; color: var(--t3); margin-top: 1px; }
  .ec-attach-file-row { display: flex; align-items: center; gap: 7px; padding: 5px 12px; border-bottom: 1px solid rgba(255,255,255,.04); }
  .ec-attach-file-row:last-child { border-bottom: none; }
  .ec-attach-file-icon { font-size: 10px; width: 16px; text-align: center; flex-shrink: 0; color: var(--accent2); }
  .ec-attach-file-name { flex: 1; min-width: 0; font-size: 11px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-file-ext { font-size: 9px; font-family: var(--mono); color: var(--t3); background: rgba(255,255,255,.05); border-radius: 3px; padding: 1px 4px; flex-shrink: 0; }
  .ec-attach-file-size { font-size: 9.5px; color: var(--t3); flex-shrink: 0; min-width: 34px; text-align: right; }
  .ec-attach-text { padding: 7px 12px; font-size: 13px; line-height: 1.6; color: var(--t1); white-space: pre-wrap; word-break: break-word; }

  /* ── Attach strip above input ── */
  .ec-attach-strip { display: flex; gap: 5px; flex-wrap: wrap; padding: 7px 14px 0; max-width: 740px; margin: 0 auto; width: 100%; }
  .ec-attach-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 7px 3px 5px;
    background: var(--bg-panel); border: 1px solid var(--border);
    border-radius: 5px; font-size: 10.5px; color: var(--t2);
    max-width: 150px; animation: ecFadeUp .15s ease;
  }
  .ec-attach-chip-icon { font-size: 10px; color: var(--accent2); flex-shrink: 0; }
  .ec-attach-chip-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-chip-remove { width: 13px; height: 13px; border: none; background: none; color: var(--t3); cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; border-radius: 3px; flex-shrink: 0; transition: color .1s; padding: 0; }
  .ec-attach-chip-remove:hover { color: var(--danger); }
  .ec-attach-limit-note { font-size: 10px; color: var(--t3); padding: 3px 14px 0; max-width: 740px; margin: 0 auto; width: 100%; }

  /* ── Thinking ── */
  .ec-thinking { display: flex; align-items: center; gap: 9px; padding: 6px 20px; max-width: 740px; width: 100%; margin: 0 auto; }
  .ec-thinking-avatar { width: 22px; height: 22px; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
  .ec-thinking-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .ec-thinking-dots { display: flex; gap: 4px; align-items: center; }
  .ec-thinking-dots span { width: 4px; height: 4px; border-radius: 50%; background: var(--accent2); opacity: .3; animation: ecDot 1.2s ease-in-out infinite; }
  .ec-thinking-dots span:nth-child(2) { animation-delay: .18s; }
  .ec-thinking-dots span:nth-child(3) { animation-delay: .36s; }
  @keyframes ecDot { 0%,80%,100% { opacity: .2; transform: scale(.8); } 40% { opacity: 1; transform: scale(1); } }

  /* ── Input ── */
  .ec-input-wrap { flex-shrink: 0; padding: 10px 16px 14px; background: var(--bg); }
  .ec-input-box {
    max-width: 740px; margin: 0 auto;
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: var(--radius-lg); padding: 9px 11px;
    display: flex; flex-direction: column; gap: 7px;
    transition: border-color .15s, box-shadow .15s;
  }
  .ec-input-box:focus-within {
    border-color: rgba(var(--accent-rgb),.4);
    box-shadow: 0 0 0 3px rgba(var(--accent-rgb),.07);
  }
  .ec-input-toolbar {
    display: flex; align-items: center; gap: 5px;
    padding-bottom: 6px; border-bottom: 1px solid var(--border);
  }
  .ec-toolbar-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px; background: none; border: 1px solid transparent;
    border-radius: 5px; cursor: pointer; font-size: 11px;
    color: var(--t3); transition: all .12s;
  }
  .ec-toolbar-btn:hover { background: var(--bg-hi); border-color: var(--border); color: var(--t1); }
  .ec-toolbar-btn svg { width: 11px; height: 11px; flex-shrink: 0; }
  .ec-toolbar-btn.disabled { opacity: .3; pointer-events: none; }
  .ec-toolbar-sep { width: 1px; height: 13px; background: var(--border); flex-shrink: 0; }

  .ec-textarea-row { display: flex; align-items: flex-end; gap: 8px; }
  .ec-input-prefix { font-family: var(--mono); font-size: 12px; color: var(--t3); flex-shrink: 0; user-select: none; line-height: 22px; padding-top: 1px; }
  .ec-textarea {
    flex: 1; border: none; background: none; outline: none;
    font-family: var(--ui); font-size: 13.5px; color: var(--t1);
    resize: none; min-height: 22px; max-height: 160px;
    line-height: 1.55; overflow-y: auto; scrollbar-width: thin;
    caret-color: var(--accent2);
  }
  .ec-textarea::placeholder { color: var(--t3); }
  .ec-send {
    width: 28px; height: 28px; border-radius: 7px;
    background: var(--accent); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff; transition: opacity .13s, background .13s;
  }
  .ec-send:hover:not(:disabled) { background: var(--accent2); }
  .ec-send:disabled { opacity: .25; cursor: default; }
  .ec-send svg { width: 13px; height: 13px; }
  .ec-hint { text-align: center; font-size: 10.5px; color: var(--t3); margin-top: 7px; max-width: 740px; margin-left: auto; margin-right: auto; opacity: .7; }

  /* ── RIGHT PANEL (task details) ── */
  .ec-right {
    width: 260px; min-width: 260px;
    background: var(--bg-sidebar);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ec-right-header {
    height: 48px; min-height: 48px;
    display: flex; align-items: center;
    padding: 0 14px; gap: 8px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ec-right-header-title { font-size: 12px; font-weight: 600; color: var(--t2); letter-spacing: .03em; text-transform: uppercase; }

  .ec-right-tabs {
    display: flex; border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ec-right-tab {
    flex: 1; padding: 9px 0; font-size: 11.5px; font-weight: 500;
    text-align: center; color: var(--t3); cursor: pointer;
    border-bottom: 2px solid transparent; transition: all .12s;
    background: none; border-top: none; border-left: none; border-right: none;
    border-bottom: 2px solid transparent;
  }
  .ec-right-tab:hover { color: var(--t2); }
  .ec-right-tab.active { color: var(--t1); border-bottom-color: var(--accent); }

  .ec-right-body { flex: 1; overflow-y: auto; padding: 14px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent; }
  .ec-right-body::-webkit-scrollbar { width: 3px; }
  .ec-right-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.08); border-radius: 2px; }

  .ec-detail-section { margin-bottom: 20px; }
  .ec-detail-label {
    font-size: 10px; color: var(--t3); font-weight: 600;
    letter-spacing: .07em; text-transform: uppercase;
    margin-bottom: 7px;
  }
  .ec-detail-value { font-size: 12.5px; color: var(--t1); line-height: 1.55; }
  .ec-detail-meta { font-size: 11px; color: var(--t3); }

  .ec-status-pills { display: flex; flex-direction: column; gap: 5px; }
  .ec-status-pill {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 10px; border-radius: 7px;
    border: 1px solid var(--border); cursor: pointer;
    background: none; text-align: left;
    transition: background .11s, border-color .11s;
    font-size: 12px; color: var(--t2); font-family: var(--ui);
  }
  .ec-status-pill:hover { background: var(--bg-hi); border-color: var(--border-hi); color: var(--t1); }
  .ec-status-pill.selected { border-color: rgba(var(--accent-rgb),.35); background: rgba(var(--accent-rgb),.07); color: var(--t1); }
  .ec-status-pill-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .ec-status-pill-dot.in_progress { background: var(--warning); }
  .ec-status-pill-dot.ready_for_review { background: var(--accent); }
  .ec-status-pill-dot.done { background: var(--success); }

  .ec-files-section { display: flex; flex-direction: column; gap: 4px; }
  .ec-right-file-row {
    display: flex; align-items: center; gap: 7px;
    padding: 6px 8px; border-radius: 6px;
    background: var(--bg-panel); border: 1px solid var(--border);
  }
  .ec-right-file-icon { font-size: 11px; color: var(--accent2); flex-shrink: 0; }
  .ec-right-file-name { flex: 1; min-width: 0; font-size: 11.5px; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-right-file-ext { font-size: 9px; font-family: var(--mono); color: var(--t3); background: rgba(255,255,255,.05); border-radius: 3px; padding: 1px 4px; flex-shrink: 0; }
  .ec-right-file-size { font-size: 9.5px; color: var(--t3); flex-shrink: 0; }

  .ec-no-detail {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100%; gap: 10px;
    padding: 40px 16px; text-align: center;
  }
  .ec-no-detail-icon { font-size: 22px; opacity: .4; }
  .ec-no-detail-text { font-size: 12px; color: var(--t3); line-height: 1.6; }

  /* ── Status bar ── */
  .ec-statusbar {
    display: flex; align-items: center; gap: 16px;
    padding: 0 14px; height: 25px; min-height: 25px;
    background: var(--bg-sidebar); border-top: 1px solid var(--border);
    flex-shrink: 0; font-size: 10.5px; color: var(--t3);
  }
  .ec-statusbar-item { display: flex; align-items: center; gap: 4px; }
  .ec-statusbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }

  /* ── Modals ── */
  .ec-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.55); display: flex; align-items: center; justify-content: center; z-index: 500; animation: ecFadeIn .14s ease; }
  @keyframes ecFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .ec-modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 22px; width: 360px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.55); display: flex; flex-direction: column; gap: 16px; animation: ecSlideUp .16s ease; }
  @keyframes ecSlideUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .ec-modal-title { font-size: 14px; font-weight: 600; color: var(--t1); display: flex; align-items: center; gap: 8px; }
  .ec-modal-title-icon { width: 26px; height: 26px; background: rgba(var(--accent-rgb),.12); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 13px; }
  .ec-modal-field { display: flex; flex-direction: column; gap: 5px; }
  .ec-modal-label { font-size: 10px; color: var(--t3); font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
  .ec-modal-input { padding: 8px 11px; font-size: 13px; color: var(--t1); background: var(--bg); border: 1px solid var(--border); border-radius: 7px; outline: none; transition: border-color .15s; font-family: var(--ui); }
  .ec-modal-input::placeholder { color: var(--t3); }
  .ec-modal-input:focus { border-color: rgba(var(--accent-rgb),.4); }
  .ec-modal-actions { display: flex; gap: 7px; justify-content: flex-end; }
  .ec-modal-cancel { padding: 7px 13px; background: none; border: 1px solid var(--border); border-radius: 7px; font-size: 12px; color: var(--t2); cursor: pointer; transition: background .12s; font-family: var(--ui); }
  .ec-modal-cancel:hover { background: var(--bg-hi); }
  .ec-modal-create { padding: 7px 16px; background: var(--accent); border: none; border-radius: 7px; font-size: 12px; font-weight: 600; color: #fff; cursor: pointer; transition: opacity .12s; font-family: var(--ui); }
  .ec-modal-create:hover:not(:disabled) { opacity: .88; }
  .ec-modal-create:disabled { opacity: .3; cursor: default; }

  /* ── Limit modal ── */
  .ec-limit-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.6); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; animation: ecFadeIn .15s ease; }
  .ec-limit-box { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 320px; margin: 0 16px; overflow: hidden; box-shadow: 0 28px 70px rgba(0,0,0,.55); animation: ecSlideUp .18s ease; }
  .ec-limit-top { border-bottom: 1px solid var(--border); padding: 24px 18px 18px; text-align: center; position: relative; }
  .ec-limit-close { position: absolute; top: 9px; right: 9px; width: 24px; height: 24px; border-radius: 50%; background: var(--bg-hi); border: none; color: var(--t3); cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; transition: all .12s; }
  .ec-limit-close:hover { background: rgba(255,255,255,.1); color: var(--t1); }
  .ec-limit-icon { width: 42px; height: 42px; border-radius: 11px; background: rgba(var(--accent-rgb),.12); display: flex; align-items: center; justify-content: center; font-size: 19px; margin: 0 auto 12px; }
  .ec-limit-title { font-size: 14px; font-weight: 600; color: var(--t1); margin-bottom: 4px; }
  .ec-limit-sub { font-size: 11px; color: var(--t3); }
  .ec-limit-body { padding: 16px 18px 18px; }
  .ec-limit-desc { font-size: 12.5px; color: var(--t2); line-height: 1.65; margin-bottom: 14px; text-align: center; }
  .ec-limit-actions { display: flex; gap: 7px; }
  .ec-limit-cancel { flex: 1; padding: 9px; background: none; border: 1px solid var(--border); border-radius: 7px; font-size: 12px; color: var(--t2); cursor: pointer; transition: background .12s; font-weight: 500; font-family: var(--ui); }
  .ec-limit-cancel:hover { background: var(--bg-hi); }
  .ec-limit-upgrade { flex: 2; padding: 9px; background: var(--accent); border: none; border-radius: 7px; font-size: 12px; font-weight: 600; color: #fff; cursor: pointer; transition: opacity .12s; font-family: var(--ui); }
  .ec-limit-upgrade:hover { opacity: .88; }

  /* ── Status dropdown ── */
  .ec-status-dropdown {
    position: absolute; top: calc(100% + 6px); right: 0;
    background: var(--bg-panel); border: 1px solid var(--border-hi);
    border-radius: var(--radius-lg); padding: 5px;
    width: 200px; z-index: 200;
    box-shadow: 0 12px 36px rgba(0,0,0,.45);
    animation: ecFadeUp .14s ease;
  }
  .ec-status-option {
    display: flex; align-items: center; gap: 8px;
    padding: 7px 9px; border-radius: 6px; cursor: pointer;
    font-size: 12px; color: var(--t2); transition: all .1s;
    background: none; border: none; width: 100%; text-align: left;
    font-family: var(--ui);
  }
  .ec-status-option:hover { background: var(--bg-hi); color: var(--t1); }
`;

// ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────
async function loadTasks(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().codeTasks || [];
}

async function saveTasks(uid, tasks) {
  const clean = JSON.parse(JSON.stringify(tasks));
  await setDoc(doc(db, "users", uid), { codeTasks: clean }, { merge: true });
}

async function loadTaskMessages(uid, taskId) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return ((snap.data().codeHistories || {})[taskId]) || [];
}

async function saveTaskMessages(uid, taskId, messages) {
  const clean = JSON.parse(JSON.stringify(messages));
  await setDoc(doc(db, "users", uid), {
    codeHistories: { [taskId]: clean }
  }, { merge: true });
}

async function deleteTaskMessages(uid, taskId) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const histories = snap.data().codeHistories || {};
  delete histories[taskId];
  await setDoc(ref, { codeHistories: histories }, { merge: true });
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  in_progress:      "In progress",
  ready_for_review: "Ready for review",
  done:             "Done",
};

function getTaskChips(taskTitle) {
  return [
    { label: "Plan the approach",    q: `Help me plan how to approach this task: "${taskTitle}"` },
    { label: "Write starter code",   q: `Write clean starter code for this task: "${taskTitle}"` },
    { label: "Review my code",       q: "I'll paste my code — please review it and suggest improvements." },
    { label: "Best practices",       q: `What best practices should I follow for: "${taskTitle}"?` },
  ];
}

// ─── ATTACHMENT BUBBLE ────────────────────────────────────────────────────────
function AttachmentBubble({ attachment }) {
  const isFolder = attachment.type === "folder";
  return (
    <div className="ec-attach-bubble-solo">
      <div className="ec-attach-header">
        <div className="ec-attach-header-icon">
          {isFolder ? "📁" : getFileIcon(attachment.files[0]?.name || "")}
        </div>
        <div className="ec-attach-header-info">
          <div className="ec-attach-header-name">{attachment.name}</div>
          <div className="ec-attach-header-meta">
            {isFolder
              ? `${attachment.files.length} file${attachment.files.length !== 1 ? "s" : ""} · folder`
              : `${formatBytes(attachment.files[0]?.size || 0)} · ${getExtLabel(attachment.name)}`
            }
          </div>
        </div>
      </div>
      <div>
        {attachment.files.map((f, i) => (
          <div key={i} className="ec-attach-file-row">
            <span className="ec-attach-file-icon">{getFileIcon(f.name)}</span>
            <span className="ec-attach-file-name">{isFolder ? f.relativePath || f.name : f.name}</span>
            <span className="ec-attach-file-ext">{getExtLabel(f.name)}</span>
            <span className="ec-attach-file-size">{formatBytes(f.size)}</span>
          </div>
        ))}
      </div>
      {attachment.userText && (
        <div className="ec-attach-text">{attachment.userText}</div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function EloriaCode() {
  const [uid,          setUid]          = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [userName,     setUserName]     = useState("");
  const [tasks,        setTasks]        = useState([]);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [isThinking,   setIsThinking]   = useState(false);
  const [userPlan,     setUserPlan]     = useState("free");

  const [showTaskModal,  setShowTaskModal]  = useState(false);
  const [newTaskTitle,   setNewTaskTitle]   = useState("");
  const [newTaskDesc,    setNewTaskDesc]    = useState("");

  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showWelcome,    setShowWelcome]    = useState(
    () => !localStorage.getItem("eloria_code_welcomed")
  );

  const [rightTab,        setRightTab]        = useState("details"); // "details" | "files"
  const [showStatusMenu,  setShowStatusMenu]  = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);

  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);
  const bodyRef        = useRef(null);
  const textareaRef    = useRef(null);
  const abortControllerRef = useRef(null);
  const statusBtnRef   = useRef(null);

  const activeTask = useMemo(
    () => tasks.find(t => t.id === activeTaskId) || null,
    [tasks, activeTaskId]
  );

  // All attachments across messages for the "Files" tab
  const allFiles = useMemo(() => {
    const seen = new Set();
    const files = [];
    messages.forEach(m => {
      if (m.attachments) {
        m.attachments.forEach(att => {
          att.files.forEach(f => {
            if (!seen.has(f.name)) { seen.add(f.name); files.push(f); }
          });
        });
      }
    });
    return files;
  }, [messages]);

  const folderCount = pendingAttachments.filter(a => a.type === "folder").length;
  const fileCount   = pendingAttachments.filter(a => a.type === "file").length;
  const canAddFolder = folderCount < 1;
  const canAddFile   = fileCount < 2;

  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const reviewTasks     = tasks.filter(t => t.status === "ready_for_review");
  const doneTasks       = tasks.filter(t => t.status === "done");

  // ── Inject styles ──
  useEffect(() => {
    if (!document.getElementById("eloria-ec-v3")) {
      const tag = document.createElement("style");
      tag.id = "eloria-ec-v3";
      tag.textContent = EC_STYLE;
      document.head.appendChild(tag);
    }
    ["eloria-ec","eloria-ec-v2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.remove();
    });
  }, []);

  // ── Auth ──
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid);
        setUserName(u.displayName || "");
        try {
          const token = await u.getIdToken();
          const res = await fetch("https://eloria-trial.onrender.com/api/membership/status", {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          setUserPlan(data.plan || "free");
        } catch {}
        const t = await loadTasks(u.uid);
        setTasks(t);
        if (t.length > 0) {
          setActiveTaskId(t[0].id);
          setMessages(await loadTaskMessages(u.uid, t[0].id));
        }
      } else {
        setUid(null); setTasks([]); setActiveTaskId(null); setMessages([]);
      }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, isThinking]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    if (uid && activeTaskId && messages.length > 0) {
      saveTaskMessages(uid, activeTaskId, messages);
    }
  }, [messages, activeTaskId, uid]);

  // Close status menu on outside click
  useEffect(() => {
    if (!showStatusMenu) return;
    const handler = (e) => {
      if (statusBtnRef.current && !statusBtnRef.current.contains(e.target)) {
        setShowStatusMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showStatusMenu]);

  // ── File reading ──
  const readFileAsText = (file) => new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => resolve("[could not read file]");
    reader.readAsText(file);
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const supported = files.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported code files found."); return; }
    const toAdd = supported.slice(0, 2 - fileCount);
    const attachFiles = await Promise.all(toAdd.map(async (f) => ({
      name: f.name, size: f.size, content: await readFileAsText(f),
    })));
    setPendingAttachments(prev => [...prev, ...attachFiles.map(f => ({
      id: Date.now() + Math.random(), type: "file", name: f.name, files: [f],
    }))]);
  };

  const handleFolderSelect = async (e) => {
    const all = Array.from(e.target.files || []);
    e.target.value = "";
    if (!all.length) return;
    const supported = all.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported code files found in this folder."); return; }
    const folderName = (supported[0].webkitRelativePath || supported[0].name).split("/")[0] || "folder";
    const attachFiles = await Promise.all(supported.map(async (f) => ({
      name: f.name, relativePath: f.webkitRelativePath || f.name,
      size: f.size, content: await readFileAsText(f),
    })));
    setPendingAttachments(prev => [...prev, {
      id: Date.now() + Math.random(), type: "folder", name: folderName, files: attachFiles,
    }]);
  };

  const removeAttachment = (id) => setPendingAttachments(prev => prev.filter(a => a.id !== id));

  // ── Task actions ──
  const switchTask = async (taskId) => {
    if (uid && activeTaskId) {
      await saveTaskMessages(uid, activeTaskId, messages);
    }
    setActiveTaskId(taskId);
    setMessages(uid ? await loadTaskMessages(uid, taskId) : []);
    setInput("");
    setPendingAttachments([]);
  };

  const createTask = async () => {
    if (!newTaskTitle.trim() || !uid) return;
    const task = {
      id: Date.now(),
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || "",
      status: "in_progress",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [task, ...tasks];
    setTasks(updated);
    await saveTasks(uid, updated);
    setNewTaskTitle(""); setNewTaskDesc(""); setShowTaskModal(false);
    await switchTask(task.id);
  };

  const deleteTask = async (e, taskId) => {
    e.stopPropagation();
    await deleteTaskMessages(uid, taskId);
    const updated = tasks.filter(t => t.id !== taskId);
    setTasks(updated);
    await saveTasks(uid, updated);
    if (activeTaskId === taskId) {
      if (updated.length > 0) {
        await switchTask(updated[0].id);
      } else {
        setActiveTaskId(null); setMessages([]);
      }
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    const updated = tasks.map(t =>
      t.id === taskId ? { ...t, status, updatedAt: new Date().toISOString() } : t
    );
    setTasks(updated);
    await saveTasks(uid, updated);
    setShowStatusMenu(false);
  };

  // ── Send message ──
  const sendMessage = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const hasText = input.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || isThinking || !activeTask) return;
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    let attachmentContext = "";
    if (hasAttachments) {
      attachmentContext = pendingAttachments.map(att => {
        const header = att.type === "folder"
          ? `\n\n[FOLDER ATTACHED: "${att.name}" — ${att.files.length} files]\n`
          : `\n\n[FILE ATTACHED: "${att.name}"]\n`;
        return header + att.files.map(f => `--- ${f.relativePath || f.name} ---\n${f.content}\n`).join("\n");
      }).join("\n");
    }

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: hasText ? input : "",
      attachments: hasAttachments ? [...pendingAttachments] : undefined,
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setPendingAttachments([]);

    const apiMessages = newMessages
      .filter(m => m.text || m.attachments)
      .map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.sender === "user"
          ? (m.attachments?.length
            ? `${attachmentContext}\n\n${m.text || ""}`.trim()
            : m.text)
          : m.text,
      }));

    try {
      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      });

      if (res.status === 403) { setIsThinking(false); alert("Eloria Code requires a Pro plan."); return; }
      if (res.status === 429) { setShowLimitModal(true); setIsThinking(false); return; }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiMsgId = Date.now() + 1;

      setMessages(prev => [...prev, { id: aiMsgId, sender: "ai", text: "" }]);
      setIsThinking(false);

      while (true) {
        if (signal.aborted) break;
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
              setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: snapshot } : m));
            }
          } catch {}
        }
      }

      // Auto-progress task to "ready_for_review" after first AI response
      if (activeTask?.status === "in_progress" && aiText.length > 50) {
        const updatedTasks = tasks.map(t =>
          t.id === activeTaskId ? { ...t, status: "ready_for_review", updatedAt: new Date().toISOString() } : t
        );
        setTasks(updatedTasks);
        saveTasks(uid, updatedTasks);
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setIsThinking(false);
        setMessages(prev => [...prev, {
          id: Date.now() + 2, sender: "ai",
          text: "Eloria Code couldn't respond. Check your connection.",
        }]);
      }
      setIsThinking(false);
    }
  };

  const stopMessage = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsThinking(false);
  };

  const limitHint = (() => {
    const parts = [];
    if (folderCount >= 1) parts.push("1 folder max");
    if (fileCount >= 2) parts.push("2 files max");
    return parts.length ? `Limit reached — ${parts.join(", ")} per message` : null;
  })();

  if (!authReady) return null;
  if (!uid) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", fontFamily:"var(--font, sans-serif)", fontSize:13, color:"#50505a", background:"#16161a" }}>
      Please log in to use Eloria Code.
    </div>
  );

  if (window.innerWidth <= 768) {
    return (
      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100dvh", background:"#16161a", padding:"32px 24px", textAlign:"center", gap:20, fontFamily:"var(--font, sans-serif)" }}>
        <div style={{ width:56, height:56, borderRadius:15, background:"rgba(91,141,239,.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>💻</div>
        <div>
          <div style={{ fontSize:18, fontWeight:600, color:"#e8e8ec", marginBottom:8, letterSpacing:"-.01em" }}>Desktop only</div>
          <div style={{ fontSize:13, color:"#8c8c96", lineHeight:1.65, maxWidth:260 }}>Eloria Code is designed for desktop. Please open it on a laptop or desktop.</div>
        </div>
      </div>
    );
  }

  // ── Task list section renderer ──
  const renderTaskSection = (sectionTasks, label, status) => {
    if (sectionTasks.length === 0) return null;
    return (
      <div key={status}>
        <div className="ec-task-section-title">
          {label}
          <span className="ec-count">{sectionTasks.length}</span>
        </div>
        {sectionTasks.map(task => (
          <div
            key={task.id}
            className={`ec-task-item${task.id === activeTaskId ? " active" : ""}`}
            onClick={() => switchTask(task.id)}
          >
            <span className={`ec-task-dot ${task.status}`} />
            <div className="ec-task-info">
              <div className="ec-task-title">{task.title}</div>
              <div className="ec-task-sub">{timeAgo(task.updatedAt)}{task.description ? ` · ${task.description.slice(0, 30)}${task.description.length > 30 ? "…" : ""}` : ""}</div>
            </div>
            <button className="ec-task-del" onClick={e => deleteTask(e, task.id)} title="Delete task">✕</button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="ec-root">
      <input ref={fileInputRef} type="file" multiple accept={[...SUPPORTED_EXTS].map(e => `.${e}`).join(",")} style={{ display:"none" }} onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple style={{ display:"none" }} onChange={handleFolderSelect} />

      {showWelcome && <EloriaCodeWelcome onDismiss={() => setShowWelcome(false)} userName={userName} />}

      {/* ── LEFT: Task list ── */}
      <aside className="ec-sidebar">
        <div className="ec-sidebar-top">
          <div className="ec-logo-wrap"><img src={logo} alt="Eloria" /></div>
          <span className="ec-app-name">Eloria Code</span>
          <button className="ec-new-task-btn" onClick={() => setShowTaskModal(true)} title="New task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </div>

        <div className="ec-task-list">
          {tasks.length === 0 ? (
            <div className="ec-empty-tasks">
              No tasks yet.<br />Create one to get started.
            </div>
          ) : (
            <>
              {renderTaskSection(inProgressTasks, "In Progress", "in_progress")}
              {renderTaskSection(reviewTasks, "Ready for Review", "ready_for_review")}
              {renderTaskSection(doneTasks, "Done", "done")}
            </>
          )}
        </div>
      </aside>

      {/* ── MIDDLE: Chat ── */}
      <main className="ec-chat">
        {/* Header */}
        <div className="ec-chat-header">
          {activeTask ? (
            <>
              <span className="ec-chat-header-title">{activeTask.title}</span>
              <div style={{ position:"relative" }} ref={statusBtnRef}>
                <button className="ec-status-btn" onClick={() => setShowStatusMenu(v => !v)}>
                  <span className={`ec-task-dot ${activeTask.status}`} style={{ width:6, height:6 }} />
                  {STATUS_LABELS[activeTask.status]}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>
                {showStatusMenu && (
                  <div className="ec-status-dropdown">
                    {Object.entries(STATUS_LABELS).map(([key, label]) => (
                      <button
                        key={key}
                        className="ec-status-option"
                        onClick={() => updateTaskStatus(activeTask.id, key)}
                      >
                        <span className={`ec-task-dot ${key}`} />
                        {label}
                        {activeTask.status === key && (
                          <svg style={{ marginLeft:"auto", width:11, height:11 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <span className="ec-chat-header-title" style={{ color:"var(--t3)" }}>No task selected</span>
          )}
        </div>

        {/* Messages */}
        <div className="ec-body" ref={bodyRef}>
          {!activeTask ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
              <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center" }}>Select a task or create a new one.</div>
              <button
                onClick={() => setShowTaskModal(true)}
                style={{ padding:"7px 16px", background:"rgba(91,141,239,.12)", border:"1px solid rgba(91,141,239,.25)", borderRadius:7, fontSize:12, color:"var(--accent2)", cursor:"pointer", fontFamily:"var(--ui)" }}
              >
                New task
              </button>
            </div>
          ) : messages.length === 0 && !isThinking ? (
            <div className="ec-task-intro">
              <div className="ec-task-intro-icon">⚡</div>
              <div className="ec-task-intro-name">{activeTask.title}</div>
              {activeTask.description && (
                <div className="ec-task-intro-meta">{activeTask.description}</div>
              )}
              <div className="ec-task-intro-meta">
                Created {new Date(activeTask.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric" })} · no messages yet
              </div>
              <div className="ec-chips">
                {getTaskChips(activeTask.title).map(c => (
                  <button key={c.q} className="ec-chip" onClick={() => setInput(c.q)}>{c.label}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="ec-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`ec-msg-wrap ${msg.sender}`}>
                  {msg.sender === "ai" && <div className="ec-ai-avatar"><img src={logo} alt="Eloria" /></div>}
                  {msg.sender === "user" && msg.attachments?.length > 0 ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", maxWidth:"80%" }}>
                      {msg.attachments.map(att => (
                        <AttachmentBubble key={att.id} attachment={{ ...att, userText: msg.attachments.length === 1 ? msg.text : undefined }} />
                      ))}
                      {msg.attachments.length > 1 && msg.text && (
                        <div className="ec-bubble" style={{ background:"rgba(91,141,239,.14)", border:"1px solid rgba(91,141,239,.2)", borderBottomRightRadius:3 }}>{msg.text}</div>
                      )}
                    </div>
                  ) : (
                    <div className="ec-bubble">
                      {msg.sender === "ai" ? <MarkdownMessage content={msg.text} /> : msg.text}
                    </div>
                  )}
                </div>
              ))}
              {isThinking && (
                <div className="ec-thinking">
                  <div className="ec-thinking-avatar"><img src={logo} alt="Eloria" /></div>
                  <div className="ec-thinking-dots"><span/><span/><span/></div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Attachment strip */}
        {pendingAttachments.length > 0 && (
          <div style={{ background:"var(--bg)", borderTop:"1px solid var(--border)", paddingTop:5, paddingBottom:2 }}>
            <div className="ec-attach-strip">
              {pendingAttachments.map(att => (
                <div key={att.id} className="ec-attach-chip">
                  <span className="ec-attach-chip-icon">{att.type === "folder" ? "📁" : getFileIcon(att.files[0]?.name || "")}</span>
                  <span className="ec-attach-chip-name">{att.name}</span>
                  <span style={{ fontSize:9.5, color:"var(--t3)", flexShrink:0 }}>
                    {att.type === "folder" ? `${att.files.length}f` : formatBytes(att.files[0]?.size || 0)}
                  </span>
                  <button className="ec-attach-chip-remove" onClick={() => removeAttachment(att.id)}>✕</button>
                </div>
              ))}
            </div>
            {limitHint && <div className="ec-attach-limit-note">{limitHint}</div>}
          </div>
        )}

        {/* Input */}
        <div className="ec-input-wrap">
          <div className="ec-input-box">
            <div className="ec-input-toolbar">
              <button
                className={`ec-toolbar-btn${!canAddFile || !activeTask ? " disabled" : ""}`}
                onClick={() => canAddFile && activeTask && fileInputRef.current?.click()}
                title="Attach files (max 2)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                Attach file
                {fileCount > 0 && <span style={{ background:"rgba(91,141,239,.16)", color:"var(--accent2)", borderRadius:4, padding:"0 4px", fontSize:9.5 }}>{fileCount}/2</span>}
              </button>
              <div className="ec-toolbar-sep" />
              <button
                className={`ec-toolbar-btn${!canAddFolder || !activeTask ? " disabled" : ""}`}
                onClick={() => canAddFolder && activeTask && folderInputRef.current?.click()}
                title="Attach folder (max 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                Attach folder
                {folderCount > 0 && <span style={{ background:"rgba(91,141,239,.16)", color:"var(--accent2)", borderRadius:4, padding:"0 4px", fontSize:9.5 }}>1/1</span>}
              </button>
              <div style={{ flex:1 }} />
              <span style={{ fontSize:10, color:"var(--t3)", opacity:.7 }}>js · ts · html · css · py · +more</span>
            </div>

            <div className="ec-textarea-row">
              <span className="ec-input-prefix">›</span>
              <textarea
                ref={textareaRef}
                className="ec-textarea"
                rows={1}
                value={input}
                placeholder={
                  pendingAttachments.length > 0
                    ? "Describe what to do with the attached files…"
                    : activeTask
                      ? `Ask about "${activeTask.title}"…`
                      : "Select a task to start…"
                }
                disabled={!activeTask}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button
                className="ec-send"
                onClick={isThinking ? stopMessage : sendMessage}
                disabled={(!isThinking && (!input.trim() && pendingAttachments.length === 0)) || !activeTask}
                title={isThinking ? "Stop" : "Send"}
                style={isThinking ? { background:"var(--danger)" } : {}}
              >
                {isThinking ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
          <p className="ec-hint">Verify generated code before use · max 1 folder or 2 files per message</p>
        </div>

        {/* Status bar */}
        <div className="ec-statusbar">
          <div className="ec-statusbar-item">
            <svg style={{ width:10, height:10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Eloria Code
          </div>
          {activeTask && (
            <>
              <div className="ec-statusbar-item">
                <span className={`ec-task-dot ${activeTask.status}`} style={{ width:5, height:5 }} />
                {STATUS_LABELS[activeTask.status]}
              </div>
              <div className="ec-statusbar-item">{activeTask.title.length > 28 ? activeTask.title.slice(0, 28) + "…" : activeTask.title}</div>
            </>
          )}
          <div className="ec-statusbar-right">
            <div className="ec-statusbar-item">By Kairox</div>
          </div>
        </div>
      </main>

      {/* ── RIGHT: Task details ── */}
      <aside className="ec-right">
        <div className="ec-right-header">
          <span className="ec-right-header-title">Task Details</span>
        </div>

        <div className="ec-right-tabs">
          <button className={`ec-right-tab${rightTab === "details" ? " active" : ""}`} onClick={() => setRightTab("details")}>Details</button>
          <button className={`ec-right-tab${rightTab === "files" ? " active" : ""}`} onClick={() => setRightTab("files")}>
            Files {allFiles.length > 0 ? `(${allFiles.length})` : ""}
          </button>
        </div>

        <div className="ec-right-body">
          {!activeTask ? (
            <div className="ec-no-detail">
              <div className="ec-no-detail-icon">⚡</div>
              <div className="ec-no-detail-text">Select a task to see its details here.</div>
            </div>
          ) : rightTab === "details" ? (
            <>
              <div className="ec-detail-section">
                <div className="ec-detail-label">Title</div>
                <div className="ec-detail-value">{activeTask.title}</div>
              </div>

              {activeTask.description && (
                <div className="ec-detail-section">
                  <div className="ec-detail-label">Description</div>
                  <div className="ec-detail-value" style={{ color:"var(--t2)" }}>{activeTask.description}</div>
                </div>
              )}

              <div className="ec-detail-section">
                <div className="ec-detail-label">Status</div>
                <div className="ec-status-pills">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      className={`ec-status-pill${activeTask.status === key ? " selected" : ""}`}
                      onClick={() => updateTaskStatus(activeTask.id, key)}
                    >
                      <span className={`ec-status-pill-dot ${key}`} />
                      {label}
                      {activeTask.status === key && (
                        <svg style={{ marginLeft:"auto", width:11, height:11 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ec-detail-section">
                <div className="ec-detail-label">Timeline</div>
                <div className="ec-detail-meta" style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  <div>Created {new Date(activeTask.createdAt).toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" })}</div>
                  <div>Updated {timeAgo(activeTask.updatedAt)}</div>
                  <div>{messages.length} message{messages.length !== 1 ? "s" : ""}</div>
                </div>
              </div>
            </>
          ) : (
            // Files tab
            allFiles.length === 0 ? (
              <div className="ec-no-detail">
                <div className="ec-no-detail-icon">📎</div>
                <div className="ec-no-detail-text">Files attached in this conversation will appear here.</div>
              </div>
            ) : (
              <div className="ec-detail-section">
                <div className="ec-detail-label">{allFiles.length} file{allFiles.length !== 1 ? "s" : ""} attached</div>
                <div className="ec-files-section">
                  {allFiles.map((f, i) => (
                    <div key={i} className="ec-right-file-row">
                      <span className="ec-right-file-icon">{getFileIcon(f.name)}</span>
                      <span className="ec-right-file-name">{f.name}</span>
                      <span className="ec-right-file-ext">{getExtLabel(f.name)}</span>
                      <span className="ec-right-file-size">{formatBytes(f.size)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      </aside>

      {/* Limit modal */}
      {showLimitModal && (
        <div className="ec-limit-backdrop" onClick={() => setShowLimitModal(false)}>
          <div className="ec-limit-box" onClick={e => e.stopPropagation()}>
            <div className="ec-limit-top">
              <button className="ec-limit-close" onClick={() => setShowLimitModal(false)}>✕</button>
              <div className="ec-limit-icon">⏰</div>
              <div className="ec-limit-title">
                {userPlan === "pro" || userPlan === "admin" ? "Daily limit reached" : "Upgrade required"}
              </div>
              <div className="ec-limit-sub">
                {userPlan === "pro" || userPlan === "admin" ? "Resets at midnight · Pro plan" : "Eloria Code · Pro only"}
              </div>
            </div>
            <div className="ec-limit-body">
              <div className="ec-limit-desc">
                {userPlan === "pro" || userPlan === "admin"
                  ? "You've used all your Eloria Code requests for today. Come back tomorrow — your limits reset at midnight."
                  : "You've used all your free requests. Upgrade to Pro for 25 requests per day."
                }
              </div>
              <div className="ec-limit-actions">
                <button className="ec-limit-cancel" onClick={() => setShowLimitModal(false)}>
                  {userPlan === "pro" || userPlan === "admin" ? "Got it" : "Later"}
                </button>
                {userPlan !== "pro" && userPlan !== "admin" && (
                  <button className="ec-limit-upgrade" onClick={() => { setShowLimitModal(false); window.close(); }}>
                    Upgrade to Pro
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New task modal */}
      {showTaskModal && (
        <div className="ec-modal-backdrop" onClick={() => setShowTaskModal(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <div className="ec-modal-title">
              <div className="ec-modal-title-icon">⚡</div>
              New task
            </div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Task name</label>
              <input
                className="ec-modal-input"
                placeholder="e.g. Build auth flow, Fix login bug"
                value={newTaskTitle}
                autoFocus
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createTask(); }}
              />
            </div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Description (optional)</label>
              <input
                className="ec-modal-input"
                placeholder="What needs to be done?"
                value={newTaskDesc}
                onChange={e => setNewTaskDesc(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") createTask(); }}
              />
            </div>
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setShowTaskModal(false)}>Cancel</button>
              <button className="ec-modal-create" onClick={createTask} disabled={!newTaskTitle.trim()}>Create task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
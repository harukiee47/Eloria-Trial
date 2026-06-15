import React, { useState, useEffect, useRef, useMemo } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import logo from "../assets/logo.png";
import EloriaCodeWelcome from "./EloriaCodeWelcome";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";
import { API_BASE } from "../apiConfig";

// ─── SUPPORTED CODE EXTENSIONS ────────────────────────────────────────────────
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
    js: "⬡", jsx: "⬡", ts: "⬡", tsx: "⬡",
    html: "◈", htm: "◈",
    css: "◉", scss: "◉", sass: "◉", less: "◉",
    json: "⊞", yaml: "⊞", yml: "⊞", toml: "⊞",
    py: "◆", rb: "◆", php: "◆", go: "◆", rs: "◆",
    md: "≡", mdx: "≡", txt: "≡",
    sql: "⊕", graphql: "⊕",
    sh: "▸", bash: "▸", zsh: "▸",
  };
  return map[ext] || "◇";
}

// ─── STYLES ──────────────────────────────────────────────────────────────────
const EC_STYLE = `
  *, *::before, *::after { box-sizing: border-box; }

  .ec-root {
    --ide-bg:        #16181d;
    --ide-sidebar:   #1c1e24;
    --ide-panel:     #21242b;
    --ide-border:    rgba(255,255,255,.07);
    --ide-border-hi: rgba(193,127,42,.4);
    --ide-t1:        #e8e8e2;
    --ide-t2:        #a0a096;
    --ide-t3:        #5a5a52;
    --ide-accent:    #c17f2a;
    --ide-accent2:   #e0a84a;
    --ide-mono:      'SF Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace;
  }

  .ec-root {
    display: flex;
    height: 100dvh;
    overflow: hidden;
    background: var(--ide-bg);
    font-family: var(--font);
    color: var(--ide-t1);
  }

  .ec-sidebar {
    width: 240px; min-width: 240px;
    background: var(--ide-sidebar);
    border-right: 1px solid var(--ide-border);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .ec-sidebar-header {
    padding: 0 14px; height: 48px; min-height: 48px;
    border-bottom: 1px solid var(--ide-border);
    display: flex; align-items: center; gap: 9px; flex-shrink: 0;
  }
  .ec-sidebar-logo { width: 22px; height: 22px; border-radius: 6px; overflow: hidden; flex-shrink: 0; border: 1px solid rgba(193,127,42,.2); }
  .ec-sidebar-logo img { width: 100%; height: 100%; object-fit: contain; }
  .ec-sidebar-title { font-size: 12px; font-weight: 700; color: var(--ide-t1); letter-spacing: .06em; text-transform: uppercase; flex: 1; }
  .ec-sidebar-badge { font-size: 9px; font-family: var(--ide-mono); background: rgba(193,127,42,.15); color: var(--ide-accent2); border: 1px solid rgba(193,127,42,.2); border-radius: 4px; padding: 2px 6px; letter-spacing: .05em; font-weight: 600; }
  .ec-explorer-label { padding: 10px 14px 5px; font-size: 10px; font-family: var(--ide-mono); color: var(--ide-t3); letter-spacing: .1em; text-transform: uppercase; font-weight: 600; flex-shrink: 0; }
  .ec-sidebar-scroll { flex: 1; overflow-y: auto; padding: 2px 0 12px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.08) transparent; }
  .ec-sidebar-scroll::-webkit-scrollbar { width: 3px; }
  .ec-sidebar-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }

  .ec-proj-group { margin-bottom: 1px; }
  .ec-proj-header { display: flex; align-items: center; gap: 5px; padding: 5px 8px 5px 10px; cursor: pointer; user-select: none; transition: background .1s; }
  .ec-proj-header:hover { background: rgba(255,255,255,.04); }
  .ec-proj-header:hover .ec-proj-actions { opacity: 1; }
  .ec-proj-chevron { width: 12px; height: 12px; flex-shrink: 0; color: var(--ide-t3); transition: transform .16s ease; }
  .ec-proj-chevron.open { transform: rotate(90deg); }
  .ec-proj-icon { font-size: 12px; flex-shrink: 0; }
  .ec-proj-name { flex: 1; min-width: 0; font-size: 11.5px; font-family: var(--ide-mono); font-weight: 600; color: var(--ide-t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: .04em; text-transform: uppercase; }
  .ec-proj-actions { display: flex; gap: 1px; opacity: 0; transition: opacity .12s; flex-shrink: 0; }
  .ec-proj-act-btn { width: 20px; height: 20px; border: none; background: none; border-radius: 3px; cursor: pointer; color: var(--ide-t3); display: flex; align-items: center; justify-content: center; transition: background .1s, color .1s; }
  .ec-proj-act-btn:hover { background: rgba(255,255,255,.08); color: var(--ide-t1); }
  .ec-proj-act-btn.danger:hover { color: #e05252; }
  .ec-proj-act-btn svg { width: 11px; height: 11px; }

  .ec-files-list { padding: 0 0 3px 20px; }
  .ec-file-item { display: flex; align-items: center; gap: 6px; padding: 5px 8px 5px 10px; cursor: pointer; border-radius: 4px; margin: 0 4px; transition: background .1s; position: relative; }
  .ec-file-item:hover { background: rgba(255,255,255,.05); }
  .ec-file-item.active { background: rgba(193,127,42,.12); }
  .ec-file-item:hover .ec-file-del { opacity: 1; }
  .ec-file-ext { font-size: 9.5px; font-family: var(--ide-mono); color: var(--ide-t3); background: rgba(255,255,255,.06); border-radius: 3px; padding: 1px 4px; flex-shrink: 0; letter-spacing: .02em; }
  .ec-file-item.active .ec-file-ext { background: rgba(193,127,42,.2); color: var(--ide-accent2); }
  .ec-file-name { flex: 1; min-width: 0; font-size: 12.5px; font-family: var(--ide-mono); color: var(--ide-t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-file-item.active .ec-file-name { color: var(--ide-t1); }
  .ec-file-del { width: 16px; height: 16px; border: none; background: none; border-radius: 3px; cursor: pointer; color: var(--ide-t3); font-size: 10px; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .1s, color .1s; flex-shrink: 0; }
  .ec-file-del:hover { color: #e05252; }
  .ec-new-file-btn { display: flex; align-items: center; gap: 5px; padding: 4px 8px 4px 10px; border-radius: 4px; margin: 0 4px; border: none; background: none; font-size: 11.5px; font-family: var(--ide-mono); color: var(--ide-t3); cursor: pointer; transition: color .1s, background .1s; width: calc(100% - 8px); }
  .ec-new-file-btn:hover { color: var(--ide-accent2); background: rgba(255,255,255,.04); }
  .ec-new-file-btn svg { width: 10px; height: 10px; flex-shrink: 0; }
  .ec-file-rename { flex: 1; min-width: 0; font-size: 12px; font-family: var(--ide-mono); color: var(--ide-t1); background: rgba(255,255,255,.08); border: 1px solid rgba(193,127,42,.4); border-radius: 3px; outline: none; padding: 1px 5px; }

  .ec-new-proj-row { padding: 8px 10px; border-top: 1px solid var(--ide-border); flex-shrink: 0; }
  .ec-new-proj-btn { width: 100%; padding: 7px 10px; background: rgba(193,127,42,.12); color: var(--ide-accent2); border: 1px solid rgba(193,127,42,.2); border-radius: 5px; font-size: 12px; font-weight: 600; font-family: var(--ide-mono); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: background .12s, border-color .12s; letter-spacing: .02em; }
  .ec-new-proj-btn:hover { background: rgba(193,127,42,.2); border-color: rgba(193,127,42,.4); }
  .ec-new-proj-btn svg { width: 12px; height: 12px; }

  .ec-main { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--ide-bg); overflow: hidden; }

  .ec-tabbar { display: flex; align-items: stretch; background: var(--ide-panel); border-bottom: 1px solid var(--ide-border); height: 38px; min-height: 38px; flex-shrink: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: none; }
  .ec-tabbar::-webkit-scrollbar { display: none; }
  .ec-tab { display: flex; align-items: center; gap: 6px; padding: 0 14px; height: 100%; flex-shrink: 0; cursor: pointer; border-right: 1px solid var(--ide-border); font-size: 12px; font-family: var(--ide-mono); color: var(--ide-t3); background: transparent; border-top: 2px solid transparent; transition: color .12s, background .12s; white-space: nowrap; user-select: none; }
  .ec-tab:hover { color: var(--ide-t2); background: rgba(255,255,255,.03); }
  .ec-tab.active { color: var(--ide-t1); background: var(--ide-bg); border-top-color: var(--ide-accent); }
  .ec-tab-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ide-t3); flex-shrink: 0; transition: background .12s; }
  .ec-tab.active .ec-tab-dot { background: var(--ide-accent2); }
  .ec-tab-proj { font-size: 9.5px; color: var(--ide-t3); opacity: .7; }

  .ec-statusbar { display: flex; align-items: center; gap: 16px; padding: 0 16px; height: 24px; min-height: 24px; background: var(--ide-accent); flex-shrink: 0; font-size: 10.5px; font-family: var(--ide-mono); color: rgba(255,255,255,.85); letter-spacing: .02em; }
  .ec-statusbar-item { display: flex; align-items: center; gap: 4px; }
  .ec-statusbar-item svg { width: 10px; height: 10px; opacity: .8; }
  .ec-statusbar-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }

  .ec-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.08) transparent; }
  .ec-body::-webkit-scrollbar { width: 4px; }
  .ec-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }

  .ec-file-intro { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px 20px; gap: 18px; animation: ecFadeUp .3s ease; }
  @keyframes ecFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .ec-file-intro-badge { display: inline-flex; align-items: center; gap: 7px; padding: 8px 16px; background: rgba(255,255,255,.04); border: 1px solid var(--ide-border); border-radius: 8px; font-family: var(--ide-mono); font-size: 13px; color: var(--ide-t2); }
  .ec-file-intro-badge span { color: var(--ide-accent2); }
  .ec-file-intro-path { font-family: var(--ide-mono); font-size: 11px; color: var(--ide-t3); letter-spacing: .04em; }
  .ec-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; max-width: 580px; width: 100%; margin-top: 4px; }
  .ec-chip { padding: 7px 14px; background: rgba(255,255,255,.04); border: 1px solid var(--ide-border); border-radius: 6px; font-size: 12.5px; font-family: var(--ide-mono); color: var(--ide-t2); cursor: pointer; transition: background .11s, border-color .11s, color .11s, transform .11s; line-height: 1.4; }
  .ec-chip:hover { background: rgba(193,127,42,.1); border-color: rgba(193,127,42,.35); transform: translateY(-1px); color: var(--ide-t1); }

  .ec-messages { flex: 1; padding: 20px 0 8px; display: flex; flex-direction: column; }
  .ec-msg-wrap { display: flex; padding: 4px 24px; max-width: 800px; width: 100%; margin: 0 auto; }
  .ec-msg-wrap.user { justify-content: flex-end; }
  .ec-msg-wrap.ai { justify-content: flex-start; align-items: flex-start; gap: 10px; }
  .ec-ai-avatar { width: 26px; height: 26px; border-radius: 7px; overflow: hidden; flex-shrink: 0; margin-top: 3px; border: 1px solid rgba(193,127,42,.25); }
  .ec-ai-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .ec-bubble { max-width: 92%; padding: 9px 14px; font-size: 13.5px; line-height: 1.5; word-break: break-word; border-radius: 10px; }
  .ec-msg-wrap.user .ec-bubble { background: rgba(193,127,42,.18); color: var(--ide-t1); border: 1px solid rgba(193,127,42,.25); border-bottom-right-radius: 3px; font-family: var(--font); }
  .ec-msg-wrap.ai .ec-bubble { background: var(--ide-panel); border: 1px solid var(--ide-border); color: var(--ide-t1); border-bottom-left-radius: 3px; font-family: var(--font); }

  /* ── ATTACHMENT BUBBLE ─────────────────────────────────────── */
  .ec-attach-bubble {
    max-width: 80%;
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-bottom-right-radius: 3px;
  }
  .ec-attach-header {
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 8px 12px 7px;
    background: rgba(193,127,42,.13);
    border: 1px solid rgba(193,127,42,.28);
    border-radius: 10px 10px 0 0;
    font-family: var(--ide-mono);
  }
  .ec-attach-header-icon {
    width: 28px; height: 28px;
    background: rgba(193,127,42,.18);
    border: 1px solid rgba(193,127,42,.3);
    border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; flex-shrink: 0;
  }
  .ec-attach-header-info { flex: 1; min-width: 0; }
  .ec-attach-header-name {
    font-size: 12.5px; font-weight: 700;
    color: var(--ide-t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    letter-spacing: .02em;
  }
  .ec-attach-header-meta {
    font-size: 10px; color: var(--ide-t3);
    margin-top: 1px; letter-spacing: .03em;
  }
  .ec-attach-files {
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(193,127,42,.15);
    border-top: none;
    border-radius: 0 0 10px 10px;
    overflow: hidden;
  }
  .ec-attach-file-row {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 12px;
    border-bottom: 1px solid rgba(255,255,255,.04);
    font-family: var(--ide-mono);
  }
  .ec-attach-file-row:last-child { border-bottom: none; }
  .ec-attach-file-icon {
    font-size: 11px; width: 18px; text-align: center;
    flex-shrink: 0; color: var(--ide-accent2);
  }
  .ec-attach-file-name {
    flex: 1; min-width: 0;
    font-size: 11.5px; color: var(--ide-t2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .ec-attach-file-ext {
    font-size: 9px; color: var(--ide-t3);
    background: rgba(255,255,255,.05);
    border-radius: 3px; padding: 1px 5px;
    flex-shrink: 0; letter-spacing: .03em;
  }
  .ec-attach-file-size {
    font-size: 9.5px; color: var(--ide-t3);
    flex-shrink: 0; min-width: 36px; text-align: right;
  }
  .ec-attach-text {
    padding: 8px 12px;
    font-size: 13.5px; line-height: 1.65;
    color: var(--ide-t1); white-space: pre-wrap; word-break: break-word;
    font-family: var(--font);
  }
  .ec-attach-bubble-solo {
    background: rgba(193,127,42,.18);
    border: 1px solid rgba(193,127,42,.25);
    border-radius: 10px;
    border-bottom-right-radius: 3px;
    overflow: hidden;
  }

  /* ── ATTACHMENT PREVIEW STRIP (above input) ──────────────────── */
  .ec-attach-strip {
    display: flex; gap: 6px; flex-wrap: wrap;
    padding: 8px 12px 0;
    max-width: 800px; margin: 0 auto; width: 100%;
  }
  .ec-attach-chip {
    display: flex; align-items: center; gap: 5px;
    padding: 4px 8px 4px 6px;
    background: rgba(193,127,42,.1);
    border: 1px solid rgba(193,127,42,.25);
    border-radius: 6px;
    font-family: var(--ide-mono); font-size: 11px;
    color: var(--ide-t2); max-width: 160px;
    animation: ecFadeUp .15s ease;
  }
  .ec-attach-chip-icon { font-size: 11px; color: var(--ide-accent2); flex-shrink: 0; }
  .ec-attach-chip-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-chip-remove {
    width: 14px; height: 14px; border: none; background: none;
    color: var(--ide-t3); cursor: pointer; font-size: 10px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 3px; flex-shrink: 0; transition: color .1s;
    padding: 0;
  }
  .ec-attach-chip-remove:hover { color: #e05252; }
  .ec-attach-limit-note {
    font-size: 10px; font-family: var(--ide-mono); color: var(--ide-t3);
    padding: 4px 12px 0;
    max-width: 800px; margin: 0 auto; width: 100%;
    letter-spacing: .02em;
  }

  /* ── INPUT TOOLBAR ──────────────────────────────────────────── */
  .ec-input-toolbar {
    display: flex; align-items: center; gap: 6px;
    padding-bottom: 2px;
    border-bottom: 1px solid var(--ide-border);
    margin-bottom: 6px;
  }
  .ec-toolbar-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    background: none; border: 1px solid transparent;
    border-radius: 5px; cursor: pointer;
    font-family: var(--ide-mono); font-size: 11px;
    color: var(--ide-t3); transition: all .12s;
  }
  .ec-toolbar-btn:hover { background: rgba(193,127,42,.08); border-color: rgba(193,127,42,.2); color: var(--ide-accent2); }
  .ec-toolbar-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
  .ec-toolbar-btn.disabled { opacity: .3; pointer-events: none; }
  .ec-toolbar-sep { width: 1px; height: 14px; background: var(--ide-border); flex-shrink: 0; }

  .ec-thinking { display: flex; align-items: center; gap: 10px; padding: 8px 24px; max-width: 800px; width: 100%; margin: 0 auto; }
  .ec-thinking-avatar { width: 26px; height: 26px; border-radius: 7px; overflow: hidden; flex-shrink: 0; border: 1px solid rgba(193,127,42,.25); }
  .ec-thinking-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .ec-thinking-dots { display: flex; gap: 4px; align-items: center; }
  .ec-thinking-dots span { width: 5px; height: 5px; border-radius: 50%; background: var(--ide-accent2); opacity: .35; animation: ecDot 1.2s ease-in-out infinite; }
  .ec-thinking-dots span:nth-child(2) { animation-delay: .18s; }
  .ec-thinking-dots span:nth-child(3) { animation-delay: .36s; }
  @keyframes ecDot { 0%,80%,100% { opacity: .2; transform: scale(.8); } 40% { opacity: 1; transform: scale(1); } }

  .ec-input-wrap { flex-shrink: 0; padding: 10px 20px 14px; background: var(--ide-bg); border-top: 1px solid var(--ide-border); }
  .ec-input-box { max-width: 800px; margin: 0 auto; background: var(--ide-panel); border: 1px solid var(--ide-border); border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; transition: border-color .15s, box-shadow .15s; }
  .ec-input-box:focus-within { border-color: rgba(193,127,42,.4); box-shadow: 0 0 0 3px rgba(193,127,42,.07); }
  .ec-input-prefix { font-family: var(--ide-mono); font-size: 13px; color: var(--ide-accent2); flex-shrink: 0; user-select: none; line-height: 22px; padding-top: 1px; }
  .ec-textarea-row { display: flex; align-items: flex-end; gap: 8px; }
  .ec-textarea { flex: 1; border: none; background: none; outline: none; font-family: var(--ide-mono); font-size: 13px; color: var(--ide-t1); resize: none; min-height: 22px; max-height: 160px; line-height: 1.55; overflow-y: auto; scrollbar-width: thin; caret-color: var(--ide-accent2); }
  .ec-textarea::placeholder { color: var(--ide-t3); }
  .ec-send { width: 32px; height: 32px; border-radius: 7px; background: var(--ide-accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #fff; transition: opacity .13s, background .13s; }
  .ec-send:hover:not(:disabled) { background: var(--ide-accent2); }
  .ec-send:disabled { opacity: .25; cursor: default; }
  .ec-send svg { width: 14px; height: 14px; }
  .ec-hint { text-align: center; font-size: 10.5px; font-family: var(--ide-mono); color: var(--ide-t3); margin-top: 6px; max-width: 800px; margin-left: auto; margin-right: auto; opacity: .7; }

  .ec-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 500; animation: ecFadeIn .15s ease; }
  @keyframes ecFadeIn { from { opacity: 0; } to { opacity: 1; } }
  .ec-modal { background: var(--ide-panel); border: 1px solid var(--ide-border); border-radius: 10px; padding: 24px; width: 380px; max-width: 90vw; box-shadow: 0 16px 56px rgba(0,0,0,.5); display: flex; flex-direction: column; gap: 18px; animation: ecSlideUp .18s ease; }
  @keyframes ecSlideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .ec-modal-title { font-size: 15px; font-weight: 600; color: var(--ide-t1); display: flex; align-items: center; gap: 8px; font-family: var(--ide-mono); }
  .ec-modal-title-icon { width: 28px; height: 28px; background: rgba(193,127,42,.12); border: 1px solid rgba(193,127,42,.2); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .ec-modal-field { display: flex; flex-direction: column; gap: 6px; }
  .ec-modal-label { font-size: 10px; color: var(--ide-t3); font-family: var(--ide-mono); font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
  .ec-modal-input { padding: 9px 12px; font-size: 13px; font-family: var(--ide-mono); color: var(--ide-t1); background: var(--ide-bg); border: 1px solid var(--ide-border); border-radius: 6px; outline: none; transition: border-color .15s; }
  .ec-modal-input::placeholder { color: var(--ide-t3); }
  .ec-modal-input:focus { border-color: rgba(193,127,42,.4); }
  .ec-modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
  .ec-modal-cancel { padding: 7px 14px; background: none; border: 1px solid var(--ide-border); border-radius: 6px; font-size: 12px; font-family: var(--ide-mono); color: var(--ide-t2); cursor: pointer; transition: background .12s; }
  .ec-modal-cancel:hover { background: rgba(255,255,255,.05); }
  .ec-modal-create { padding: 7px 18px; background: var(--ide-accent); border: none; border-radius: 6px; font-size: 12px; font-weight: 600; font-family: var(--ide-mono); color: #fff; cursor: pointer; transition: opacity .12s; letter-spacing: .02em; }
  .ec-modal-create:hover:not(:disabled) { opacity: .88; }
  .ec-modal-create:disabled { opacity: .3; cursor: default; }

@media (max-width: 640px) {
    .ec-sidebar { display: none; }
    .ec-input-wrap { position: fixed; bottom: 0; left: 0; right: 0; padding-bottom: max(12px, env(safe-area-inset-bottom, 12px)); z-index: 20; }
    .ec-body { padding-bottom: 100px; }
    .ec-statusbar { display: none; }
    .ec-msg-wrap { padding: 4px 12px; }
    .ec-input-toolbar { flex-wrap: wrap; gap: 4px; }
    .ec-toolbar-btn { font-size: 10px; padding: 3px 6px; }
    .ec-chips { gap: 6px; }
    .ec-chip { font-size: 11.5px; padding: 6px 12px; }
    .ec-attach-strip { padding: 6px 10px 0; }
    .ec-tab { padding: 0 10px; font-size: 11px; }
    .ec-tab-proj { display: none; }
    .ec-textarea { font-size: 16px; }
    .ec-send { width: 36px; height: 36px; }
  }

  /* ── LIMIT MODAL ─────────────────────────────────────── */
  .ec-limit-backdrop {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.55);
    backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: ecFadeIn .18s ease;
  }
  .ec-limit-box {
    background: var(--ide-panel);
    border: 1px solid var(--ide-border);
    border-radius: 16px;
    width: 340px; margin: 0 16px;
    overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,.5);
    animation: ecSlideUp .2s ease;
  }
  .ec-limit-top {
    background: linear-gradient(135deg, rgba(193,127,42,.18), rgba(193,127,42,.06));
    border-bottom: 1px solid var(--ide-border);
    padding: 24px 20px 20px;
    text-align: center;
    position: relative;
  }
  .ec-limit-close {
    position: absolute; top: 10px; right: 10px;
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(255,255,255,.06); border: none;
    color: var(--ide-t3); cursor: pointer; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s, color .12s;
  }
  .ec-limit-close:hover { background: rgba(255,255,255,.12); color: var(--ide-t1); }
  .ec-limit-icon {
    width: 48px; height: 48px; border-radius: 14px;
    background: rgba(193,127,42,.14);
    border: 1px solid rgba(193,127,42,.25);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; margin: 0 auto 12px;
  }
  .ec-limit-title {
    font-size: 15px; font-weight: 700;
    color: var(--ide-t1); margin-bottom: 5px;
    font-family: var(--ide-mono); letter-spacing: .02em;
  }
  .ec-limit-sub {
    font-size: 11px; color: var(--ide-t3);
    font-family: var(--ide-mono); letter-spacing: .03em;
  }
  .ec-limit-body { padding: 18px 20px 20px; }
  .ec-limit-desc {
    font-size: 13px; color: var(--ide-t2);
    line-height: 1.65; margin-bottom: 16px;
    text-align: center; font-family: var(--font);
  }
  .ec-limit-actions { display: flex; gap: 8px; }
  .ec-limit-cancel {
    flex: 1; padding: 10px;
    background: none; border: 1px solid var(--ide-border);
    border-radius: 8px; font-size: 12px;
    font-family: var(--ide-mono); color: var(--ide-t2);
    cursor: pointer; transition: background .12s; font-weight: 500;
  }
  .ec-limit-cancel:hover { background: rgba(255,255,255,.05); }
  .ec-limit-upgrade {
    flex: 2; padding: 10px;
    background: var(--ide-accent); border: none;
    border-radius: 8px; font-size: 12px; font-weight: 700;
    font-family: var(--ide-mono); color: #fff;
    cursor: pointer; transition: opacity .12s; letter-spacing: .03em;
  }
  .ec-limit-upgrade:hover { opacity: .88; }
`;

// ─── FIRESTORE HELPERS ────────────────────────────────────────────────────────
async function loadProjects(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().codeProjects || [];
}
async function saveProjects(uid, projects) {
  const clean = JSON.parse(JSON.stringify(projects));
  await setDoc(doc(db, "users", uid), { codeProjects: clean }, { merge: true });
}
async function loadFileMessages(uid, projectId, fileId) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return ((snap.data().codeHistories || {})[`${projectId}_${fileId}`]) || [];
}
async function saveFileMessages(uid, projectId, fileId, messages) {
  const clean = JSON.parse(JSON.stringify(messages));
  await setDoc(doc(db, "users", uid), {
    codeHistories: { [`${projectId}_${fileId}`]: clean }
  }, { merge: true });
}
async function deleteFileMessages(uid, projectId, fileId) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const histories = snap.data().codeHistories || {};
  delete histories[`${projectId}_${fileId}`];
  await setDoc(ref, { codeHistories: histories }, { merge: true });
}

function getChips(projectName, fileName) {
  return [
    { label: `> plan ${fileName}`,  q: `Help me plan what to build in "${fileName}" for the ${projectName} project.` },
    { label: `> write starter`,     q: `Write clean starter code for "${fileName}" in the ${projectName} project.` },
    { label: `> best practices`,    q: `What are the best practices I should follow for "${fileName}"?` },
    { label: `> review my code`,    q: "I'll paste my code — please review it and suggest improvements." },
  ];
}

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1] : "file";
}

// ─── ATTACHMENT BUBBLE ────────────────────────────────────────────────────────
function AttachmentBubble({ attachment }) {
  const isFolder = attachment.type === "folder";

  return (
    <div className="ec-attach-bubble-solo">
      <div className="ec-attach-header" style={{ borderRadius: 0, background: "rgba(193,127,42,.13)", border: "none", borderBottom: "1px solid rgba(193,127,42,.18)" }}>
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
        {isFolder && (
          <div style={{ fontFamily: "var(--ide-mono)", fontSize: 9, color: "var(--ide-t3)", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 4, padding: "2px 6px", flexShrink: 0 }}>
            FOLDER
          </div>
        )}
      </div>

      <div className="ec-attach-files" style={{ borderRadius: 0, border: "none" }}>
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

// ─── COMPONENT ───────────────────────────────────────────────────────────────
export default function EloriaCode() {
  const [uid,          setUid]          = useState(null);
  const [authReady,    setAuthReady]    = useState(false);
  const [userName,     setUserName]     = useState("");
  const [projects,     setProjects]     = useState([]);
  const [expandedIds,  setExpandedIds]  = useState({});
  const [activeRef,    setActiveRef]    = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [input,        setInput]        = useState("");
  const [isThinking,   setIsThinking]   = useState(false);

  const [showProjModal, setShowProjModal] = useState(false);
  const [newProjName,   setNewProjName]   = useState("");
  const [newProjDesc,   setNewProjDesc]   = useState("");

  const [renamingFile, setRenamingFile] = useState(null);
  const [renameVal,    setRenameVal]    = useState("");
  const [addingFileTo, setAddingFileTo] = useState(null);
  const [newFileName,  setNewFileName]  = useState("");

  const [pendingAttachments, setPendingAttachments] = useState([]);
  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);

  const [showWelcome, setShowWelcome] = useState(
    () => !localStorage.getItem("eloria_code_welcomed")
  );

  const bodyRef     = useRef(null);
  const textareaRef = useRef(null);
  const renameRef   = useRef(null);
  const newFileRef  = useRef(null);
  const abortControllerRef = useRef(null);
  const [userPlan, setUserPlan] = useState("free");
  const [showLimitModal, setShowLimitModal] = useState(false);

  const activeProject = useMemo(
    () => projects.find(p => p.id === activeRef?.projectId) || null,
    [projects, activeRef]
  );
  const activeFile = useMemo(
    () => activeProject?.files?.find(f => f.id === activeRef?.fileId) || null,
    [activeProject, activeRef]
  );

  const folderCount = pendingAttachments.filter(a => a.type === "folder").length;
  const fileCount   = pendingAttachments.filter(a => a.type === "file").length;
  const canAddFolder = folderCount < 1;
  const canAddFile   = fileCount < 2;

  useEffect(() => {
    if (!document.getElementById("eloria-ec-v2")) {
      const tag = document.createElement("style");
      tag.id = "eloria-ec-v2";
      tag.textContent = EC_STYLE;
      document.head.appendChild(tag);
    }
    const old = document.getElementById("eloria-ec");
    if (old) old.remove();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid);
        setUserName(u.displayName || "");

        try {
          const token = await u.getIdToken();
          const res = await fetch(`${API_BASE}/api/membership/status`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          setUserPlan(data.plan || "free");
        } catch (err) {
          console.error("Failed to fetch plan:", err);
        }
        const p = await loadProjects(u.uid);
        setProjects(p);
        const exp = {};
        p.forEach(proj => { exp[proj.id] = true; });
        setExpandedIds(exp);
        if (p.length > 0 && p[0].files?.length > 0) {
          const ref = { projectId: p[0].id, fileId: p[0].files[0].id };
          setActiveRef(ref);
          setMessages(await loadFileMessages(u.uid, ref.projectId, ref.fileId));
        }
      } else {
        setUid(null); setProjects([]); setActiveRef(null); setMessages([]);
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

  useEffect(() => { if (renamingFile && renameRef.current) renameRef.current.focus(); }, [renamingFile]);
  useEffect(() => { if (addingFileTo && newFileRef.current) newFileRef.current.focus(); }, [addingFileTo]);

  useEffect(() => {
    if (uid && activeRef && messages.length > 0) {
      saveFileMessages(uid, activeRef.projectId, activeRef.fileId, messages);
    }
  }, [messages, activeRef, uid]);

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
    if (!supported.length) {
      alert("No supported code files found. Supported: JS, TS, HTML, CSS, JSON, PY, and other code files.");
      return;
    }

    const slots = 2 - fileCount;
    const toAdd = supported.slice(0, slots);

    const attachFiles = await Promise.all(toAdd.map(async (f) => ({
      name: f.name,
      size: f.size,
      content: await readFileAsText(f),
    })));

    const attachments = attachFiles.map(f => ({
      id: Date.now() + Math.random(),
      type: "file",
      name: f.name,
      files: [f],
    }));

    setPendingAttachments(prev => [...prev, ...attachments]);
  };

  const handleFolderSelect = async (e) => {
    const all = Array.from(e.target.files || []);
    e.target.value = "";
    if (!all.length) return;

    const supported = all.filter(f => isSupportedFile(f.name));
    if (!supported.length) {
      alert("No supported code files found in this folder.");
      return;
    }

    const folderName = (supported[0].webkitRelativePath || supported[0].name).split("/")[0] || "folder";

    const attachFiles = await Promise.all(supported.map(async (f) => ({
      name: f.name,
      relativePath: f.webkitRelativePath || f.name,
      size: f.size,
      content: await readFileAsText(f),
    })));

    setPendingAttachments(prev => [...prev, {
      id: Date.now() + Math.random(),
      type: "folder",
      name: folderName,
      files: attachFiles,
    }]);
  };

  const removeAttachment = (id) => {
    setPendingAttachments(prev => prev.filter(a => a.id !== id));
  };

  const switchFile = async (projectId, fileId) => {
    if (uid && activeRef) {
      await saveFileMessages(uid, activeRef.projectId, activeRef.fileId, messages);
    }
    const ref = { projectId, fileId };
    setActiveRef(ref);
    setMessages(uid ? await loadFileMessages(uid, projectId, fileId) : []);
    setInput("");
  };

  const toggleExpand = (projectId) => {
    setExpandedIds(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const createProject = async () => {
    if (!newProjName.trim() || !uid) return;
    const firstFile = { id: Date.now() + 1, name: "main" };
    const project = {
      id: Date.now(),
      name: newProjName.trim(),
      description: newProjDesc.trim() || "A new Eloria Code project.",
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      files: [firstFile],
    };
    const updated = [project, ...projects];
    setProjects(updated);
    await saveProjects(uid, updated);
    setExpandedIds(prev => ({ ...prev, [project.id]: true }));
    await switchFile(project.id, firstFile.id);
    setNewProjName(""); setNewProjDesc(""); setShowProjModal(false);
  };

  const deleteProject = async (e, projectId) => {
    e.stopPropagation();
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      for (const f of (proj.files || [])) {
        await deleteFileMessages(uid, projectId, f.id);
      }
    }
    const updated = projects.filter(p => p.id !== projectId);
    setProjects(updated);
    await saveProjects(uid, updated);
    if (activeRef?.projectId === projectId) {
      if (updated.length > 0 && updated[0].files?.length > 0) {
        await switchFile(updated[0].id, updated[0].files[0].id);
      } else {
        setActiveRef(null); setMessages([]);
      }
    }
  };

  const commitAddFile = async (projectId) => {
    const name = newFileName.trim() || `file${(projects.find(p=>p.id===projectId)?.files?.length||0)+1}`;
    const newFile = { id: Date.now(), name };
    const updated = projects.map(p =>
      p.id === projectId ? { ...p, files: [...(p.files||[]), newFile] } : p
    );
    setProjects(updated);
    await saveProjects(uid, updated);
    setAddingFileTo(null); setNewFileName("");
    await switchFile(projectId, newFile.id);
  };

  const deleteFile = async (e, projectId, fileId) => {
    e.stopPropagation();
    await deleteFileMessages(uid, projectId, fileId);
    const updated = projects.map(p =>
      p.id === projectId ? { ...p, files: (p.files||[]).filter(f => f.id !== fileId) } : p
    );
    setProjects(updated);
    await saveProjects(uid, updated);
    if (activeRef?.projectId === projectId && activeRef?.fileId === fileId) {
      const proj = updated.find(p => p.id === projectId);
      if (proj?.files?.length > 0) {
        await switchFile(projectId, proj.files[0].id);
      } else {
        setActiveRef(null); setMessages([]);
      }
    }
  };

  const commitRenameFile = async () => {
    if (!renameVal.trim() || !renamingFile) { setRenamingFile(null); return; }
    const updated = projects.map(p =>
      p.id === renamingFile.projectId
        ? { ...p, files: p.files.map(f => f.id === renamingFile.fileId ? { ...f, name: renameVal.trim() } : f) }
        : p
    );
    setProjects(updated);
    await saveProjects(uid, updated);
    setRenamingFile(null);
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const hasText = input.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || isThinking || !activeFile || !activeProject) return;
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    let attachmentContext = "";
    if (hasAttachments) {
      attachmentContext = pendingAttachments.map(att => {
        const header = att.type === "folder"
          ? `\n\n[FOLDER ATTACHED: "${att.name}" — ${att.files.length} files]\n`
          : `\n\n[FILE ATTACHED: "${att.name}"]\n`;
        const fileContents = att.files.map(f =>
          `--- ${f.relativePath || f.name} ---\n${f.content}\n`
        ).join("\n");
        return header + fileContents;
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

    // Build conversation history for backend
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
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      });

      if (res.status === 403) {
        setIsThinking(false);
        alert("Eloria Code requires a Pro plan. Upgrade from the main chat.");
        return;
      }

      if (res.status === 429) {
        setShowLimitModal(true);
        setIsThinking(false);
        return;
      }

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
              setMessages(prev =>
                prev.map(m => m.id === aiMsgId ? { ...m, text: snapshot } : m)
              );
            }
          } catch {}
        }
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

  if (!authReady) return null;
  if (!uid) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", fontFamily:"monospace", fontSize:13, color:"#5a5a52", background:"#16181d" }}>
      Please log in to use Eloria Code.
    </div>
  );

  const stopMessage = () => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    setIsThinking(false);
  };

  const limitHint = (() => {
    const parts = [];
    if (folderCount >= 1) parts.push("1 folder max");
    if (fileCount >= 2) parts.push("2 files max");
    return parts.length ? `// limit reached: ${parts.join(", ")} per message` : null;
  })();

  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    return (
      <div style={{
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        height: "100dvh", background: "#16181d",
        padding: "32px 24px", textAlign: "center", gap: 20,
        fontFamily: "var(--font)",
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 18,
          background: "rgba(193,127,42,.12)",
          border: "1.5px solid rgba(193,127,42,.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28,
        }}>
          💻
        </div>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e8e8e2", marginBottom: 10, letterSpacing: "-.01em" }}>
            Desktop Only
          </div>
          <div style={{ fontSize: 14, color: "#a0a096", lineHeight: 1.65, maxWidth: 280 }}>
            Eloria Code is designed for desktop use. Please open it on a laptop or desktop for the best experience.
          </div>
        </div>
        <div style={{
          marginTop: 8, padding: "10px 20px",
          background: "rgba(193,127,42,.1)",
          border: "1px solid rgba(193,127,42,.25)",
          borderRadius: 10, fontSize: 12,
          fontFamily: "'SF Mono', 'Fira Code', monospace",
          color: "#c17f2a", letterSpacing: ".03em",
        }}>
          {"// use a desktop browser"}
        </div>
      </div>
    );
  }

  return (
    <div className="ec-root">

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={[...SUPPORTED_EXTS].map(e => `.${e}`).join(",")}
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />
      <input
        ref={folderInputRef}
        type="file"
        // eslint-disable-next-line react/no-unknown-property
        webkitdirectory="true"
        directory="true"
        multiple
        style={{ display: "none" }}
        onChange={handleFolderSelect}
      />

      {showWelcome && (
        <EloriaCodeWelcome
          onDismiss={() => setShowWelcome(false)}
          userName={userName}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside className="ec-sidebar">
        <div className="ec-sidebar-header">
          <div className="ec-sidebar-logo"><img src={logo} alt="Eloria" /></div>
          <span className="ec-sidebar-title">Eloria Code</span>
          <span className="ec-sidebar-badge">v2</span>
        </div>

        <div className="ec-explorer-label">Explorer</div>

        <div className="ec-sidebar-scroll">
          {projects.length === 0 && (
            <div style={{ padding: "20px 14px", textAlign: "center", fontSize: 11, fontFamily: "var(--ide-mono)", color: "var(--ide-t3)", lineHeight: 1.8 }}>
              {"// no projects yet"}<br/>
              {"// create one below"}
            </div>
          )}
          {projects.map(proj => (
            <div key={proj.id} className="ec-proj-group">
              <div className="ec-proj-header" onClick={() => toggleExpand(proj.id)}>
                <svg className={`ec-proj-chevron${expandedIds[proj.id] ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
                <span className="ec-proj-icon">📁</span>
                <span className="ec-proj-name">{proj.name}</span>
                <div className="ec-proj-actions" onClick={e => e.stopPropagation()}>
                  <button className="ec-proj-act-btn" title="New file"
                    onClick={() => { setExpandedIds(p=>({...p,[proj.id]:true})); setAddingFileTo(proj.id); setNewFileName(""); }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                  </button>
                  <button className="ec-proj-act-btn danger" title="Delete project" onClick={e => deleteProject(e, proj.id)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
              {expandedIds[proj.id] && (
                <div className="ec-files-list">
                  {(proj.files || []).map(file => (
                    <div
                      key={file.id}
                      className={`ec-file-item${activeRef?.projectId === proj.id && activeRef?.fileId === file.id ? " active" : ""}`}
                      onClick={() => switchFile(proj.id, file.id)}
                    >
                      <span className="ec-file-ext">{getExt(file.name)}</span>
                      {renamingFile?.projectId === proj.id && renamingFile?.fileId === file.id ? (
                        <input
                          ref={renameRef}
                          className="ec-file-rename"
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                          onBlur={commitRenameFile}
                          onKeyDown={e => { if (e.key === "Enter") commitRenameFile(); if (e.key === "Escape") setRenamingFile(null); }}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          className="ec-file-name"
                          onDoubleClick={e => { e.stopPropagation(); setRenamingFile({ projectId: proj.id, fileId: file.id }); setRenameVal(file.name); }}
                        >{file.name}</span>
                      )}
                      <button className="ec-file-del" onClick={e => deleteFile(e, proj.id, file.id)} title="Delete file">✕</button>
                    </div>
                  ))}
                  {addingFileTo === proj.id ? (
                    <div className="ec-file-item" style={{ paddingLeft: 8 }}>
                      <span className="ec-file-ext">new</span>
                      <input
                        ref={newFileRef}
                        className="ec-file-rename"
                        placeholder="filename"
                        value={newFileName}
                        onChange={e => setNewFileName(e.target.value)}
                        onBlur={() => commitAddFile(proj.id)}
                        onKeyDown={e => { if (e.key === "Enter") commitAddFile(proj.id); if (e.key === "Escape") { setAddingFileTo(null); setNewFileName(""); } }}
                        style={{ flex: 1 }}
                      />
                    </div>
                  ) : (
                    <button className="ec-new-file-btn" onClick={() => { setAddingFileTo(proj.id); setNewFileName(""); }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                      new file
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="ec-new-proj-row">
          <button className="ec-new-proj-btn" onClick={() => setShowProjModal(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            new project
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="ec-main">
        <div className="ec-tabbar">
          {projects.flatMap(proj =>
            (proj.files || []).map(file => (
              <div
                key={`${proj.id}_${file.id}`}
                className={`ec-tab${activeRef?.projectId === proj.id && activeRef?.fileId === file.id ? " active" : ""}`}
                onClick={() => switchFile(proj.id, file.id)}
              >
                <span className="ec-tab-dot" />
                <span className="ec-tab-proj">{proj.name}/</span>
                {file.name}
              </div>
            ))
          )}
          {projects.length === 0 && (
            <div style={{ padding: "0 16px", fontSize: 11, fontFamily: "var(--ide-mono)", color: "var(--ide-t3)", display: "flex", alignItems: "center" }}>
              no open files
            </div>
          )}
        </div>

        <div className="ec-body" ref={bodyRef}>
          {!activeProject && (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
              <div style={{ fontSize:11, fontFamily:"var(--ide-mono)", color:"var(--ide-t3)", lineHeight:1.8, textAlign:"center" }}>
                {"// no project selected"}<br/>
                {"// create one to get started"}
              </div>
              <button className="ec-new-proj-btn" style={{ width:"auto", padding:"7px 18px" }} onClick={() => setShowProjModal(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:12,height:12}}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                new project
              </button>
            </div>
          )}

          {activeFile && messages.length === 0 && !isThinking && (
            <div className="ec-file-intro">
              <div className="ec-file-intro-badge">
                <span>~/</span>{activeProject.name}/<span style={{ color: "var(--ide-accent2)" }}>{activeFile.name}</span>
              </div>
              <p className="ec-file-intro-path">created {activeProject.createdAt} · no messages yet</p>
              <div className="ec-chips">
                {getChips(activeProject.name, activeFile.name).map(c => (
                  <button key={c.q} className="ec-chip" onClick={() => setInput(c.q)}>{c.label}</button>
                ))}
              </div>
            </div>
          )}

          {activeFile && (messages.length > 0 || isThinking) && (
            <div className="ec-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`ec-msg-wrap ${msg.sender}`}>
                  {msg.sender === "ai" && <div className="ec-ai-avatar"><img src={logo} alt="Eloria" /></div>}

                  {msg.sender === "user" && msg.attachments?.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", maxWidth: "80%" }}>
                      {msg.attachments.map(att => (
                        <AttachmentBubble key={att.id} attachment={{ ...att, userText: msg.attachments.length === 1 ? msg.text : undefined }} />
                      ))}
                      {msg.attachments.length > 1 && msg.text && (
                        <div className="ec-bubble" style={{ background: "rgba(193,127,42,.18)", border: "1px solid rgba(193,127,42,.25)", borderBottomRightRadius: 3 }}>
                          {msg.text}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="ec-bubble">
                      {msg.sender === "ai"
                        ? <MarkdownMessage content={msg.text} />
                        : msg.text
                      }
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

        {/* ── Attachment preview strip above input ── */}
        {pendingAttachments.length > 0 && (
          <div style={{ background: "var(--ide-bg)", borderTop: "1px solid var(--ide-border)", paddingTop: 6, paddingBottom: 2 }}>
            <div className="ec-attach-strip">
              {pendingAttachments.map(att => (
                <div key={att.id} className="ec-attach-chip">
                  <span className="ec-attach-chip-icon">{att.type === "folder" ? "📁" : getFileIcon(att.files[0]?.name || "")}</span>
                  <span className="ec-attach-chip-name">{att.name}</span>
                  <span style={{ fontSize: 9, color: "var(--ide-t3)", fontFamily: "var(--ide-mono)", flexShrink: 0 }}>
                    {att.type === "folder" ? `${att.files.length}f` : formatBytes(att.files[0]?.size || 0)}
                  </span>
                  <button className="ec-attach-chip-remove" onClick={() => removeAttachment(att.id)}>✕</button>
                </div>
              ))}
            </div>
            {limitHint && <div className="ec-attach-limit-note">{limitHint}</div>}
          </div>
        )}

        <div className="ec-input-wrap">
          <div className="ec-input-box">
            {/* ── Toolbar ── */}
            <div className="ec-input-toolbar">
              <button
                className={`ec-toolbar-btn${!canAddFile || !activeFile ? " disabled" : ""}`}
                onClick={() => canAddFile && activeFile && fileInputRef.current?.click()}
                title="Attach files (max 2)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
                attach file
                {fileCount > 0 && <span style={{ background: "rgba(193,127,42,.25)", color: "var(--ide-accent2)", borderRadius: 4, padding: "0 5px", fontSize: 9 }}>{fileCount}/2</span>}
              </button>

              <div className="ec-toolbar-sep" />

              <button
                className={`ec-toolbar-btn${!canAddFolder || !activeFile ? " disabled" : ""}`}
                onClick={() => canAddFolder && activeFile && folderInputRef.current?.click()}
                title="Attach folder (max 1)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
                </svg>
                attach folder
                {folderCount > 0 && <span style={{ background: "rgba(193,127,42,.25)", color: "var(--ide-accent2)", borderRadius: 4, padding: "0 5px", fontSize: 9 }}>1/1</span>}
              </button>

              <div style={{ flex: 1 }} />
              <span style={{ fontFamily: "var(--ide-mono)", fontSize: 9.5, color: "var(--ide-t3)", opacity: .7 }}>
                js · ts · html · css · py · +more
              </span>
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
                    ? "describe what to do with the attached files…"
                    : activeFile
                      ? `ask about ${activeFile.name}…`
                      : "select a file to start…"
                }
                disabled={!activeFile}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              />
              <button
                className="ec-send"
                onClick={isThinking ? stopMessage : sendMessage}
                disabled={(!isThinking && (!input.trim() && pendingAttachments.length === 0)) || !activeFile}
                title={isThinking ? "Stop" : "Send"}
                style={isThinking ? { background: "#e05252" } : {}}
              >
                {isThinking ? (
                  <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
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
          <p className="ec-hint">{"// verify all generated code before production use · max 1 folder or 2 files per message"}</p>
        </div>

        <div className="ec-statusbar">
          <div className="ec-statusbar-item">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            Eloria Code
          </div>
          {activeProject && <div className="ec-statusbar-item">📁 {activeProject.name}</div>}
          {activeFile    && <div className="ec-statusbar-item">{activeFile.name}</div>}
          <div className="ec-statusbar-right">
            <div className="ec-statusbar-item">By Kairox</div>
          </div>
        </div>
      </main>

      {/* LIMIT MODAL */}
      {showLimitModal && (
        <div className="ec-limit-backdrop" onClick={() => setShowLimitModal(false)}>
          <div className="ec-limit-box" onClick={e => e.stopPropagation()}>
            <div className="ec-limit-top">
              <button className="ec-limit-close" onClick={() => setShowLimitModal(false)}>✕</button>
              <div className="ec-limit-icon">⏰</div>
              <div className="ec-limit-title">
                {userPlan === "pro" || userPlan === "admin"
                  ? "// daily limit reached"
                  : "// upgrade required"
                }
              </div>
              <div className="ec-limit-sub">
                {userPlan === "pro" || userPlan === "admin"
                  ? "resets at midnight · pro plan"
                  : "eloria code · pro only"
                }
              </div>
            </div>
            <div className="ec-limit-body">
              <div className="ec-limit-desc">
                {userPlan === "pro" || userPlan === "admin"
                  ? "You've used all your Eloria Code requests for today. Come back tomorrow — your limits reset at midnight."
                  : "You've used all your free Eloria Code requests. Upgrade to Pro for 25 requests per day."
                }
              </div>
              <div className="ec-limit-actions">
                <button className="ec-limit-cancel" onClick={() => setShowLimitModal(false)}>
                  {userPlan === "pro" || userPlan === "admin" ? "got it" : "later"}
                </button>
                {userPlan !== "pro" && userPlan !== "admin" && (
                  <button className="ec-limit-upgrade" onClick={() => {
                    setShowLimitModal(false);
                    window.close();
                  }}>
                    upgrade → pro
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showProjModal && (
        <div className="ec-modal-backdrop" onClick={() => setShowProjModal(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <div className="ec-modal-title">
              <div className="ec-modal-title-icon">📁</div>
              new_project
            </div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">project_name</label>
              <input className="ec-modal-input" placeholder="e.g. MyApp, Portfolio, API server" value={newProjName} autoFocus onChange={e => setNewProjName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createProject(); }} />
            </div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">{"description // optional"}</label>
              <input className="ec-modal-input" placeholder="What are you building?" value={newProjDesc} onChange={e => setNewProjDesc(e.target.value)} onKeyDown={e => { if (e.key === "Enter") createProject(); }} />
            </div>
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setShowProjModal(false)}>cancel</button>
              <button className="ec-modal-create" onClick={createProject} disabled={!newProjName.trim()}>create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
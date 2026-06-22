import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
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

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function formatBytes(bytes) {
  if (!bytes) return "0B";
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

// MIME map for downloads
function getMime(ext) {
  const map = {
    html:"text/html", htm:"text/html", css:"text/css", js:"text/javascript",
    jsx:"text/javascript", ts:"text/typescript", tsx:"text/typescript",
    json:"application/json", py:"text/x-python", md:"text/markdown",
  };
  return map[ext] || "text/plain";
}

function downloadFile(filename, code) {
  if (!code) return;
  const ext = getExt(filename);
  const blob = new Blob([code], { type: getMime(ext) + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

// ─── SYNTAX HIGHLIGHTING ──────────────────────────────────────────────────────
function syntaxHighlight(code, ext) {
  if (!code) return "";
  const escape = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let html = escape(code);
  const jsFamily = ["js","jsx","ts","tsx","mjs","cjs"];
  const kwJS = /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|from|async|await|new|this|typeof|instanceof|try|catch|throw|null|undefined|true|false|interface|type|enum|extends|implements|readonly|public|private|protected)\b/g;
  const kwPy = /\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|pass|break|continue|True|False|None|and|or|not|in|is|lambda|yield|raise|global|nonlocal)\b/g;
  const kw = jsFamily.includes(ext) ? kwJS : ext === "py" ? kwPy : null;
  // strings
  html = html.replace(/(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;|`[^`]*?`)/g, m => `<span style="color:#c98a7d">${m}</span>`);
  // comments
  html = html.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, m => `<span style="color:#6a6a6a;font-style:italic">${m}</span>`);
  // keywords
  if (kw) html = html.replace(kw, m => `<span style="color:#cc9b5e">${m}</span>`);
  // numbers
  html = html.replace(/\b(\d+\.?\d*)\b/g, m => `<span style="color:#9fc88f">${m}</span>`);
  // CSS props
  if (ext === "css" || ext === "scss") html = html.replace(/([a-z-]+)(\s*:)/g, (_, p, c) => `<span style="color:#7fb3d5">${p}</span>${c}`);
  return html;
}

// ─── FILE PARSER ──────────────────────────────────────────────────────────────
function parseFilesFromAI(text) {
  const files = [];
  const seen = new Set();
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    const meta = m[1].trim();
    const code = m[2];
    const fnMatch = meta.match(/([^\s]+\.[a-zA-Z0-9]+)/);
    if (fnMatch && !seen.has(fnMatch[1].toLowerCase())) {
      files.push({ name: fnMatch[1], code, lang: meta.split(/\s/)[0] || "" });
      seen.add(fnMatch[1].toLowerCase());
      continue;
    }
    const firstLine = code.split("\n")[0].trim();
    const commentFile = firstLine.match(/(?:\/\/|#|<!--|\/\*)\s*([^\s*]+\.[a-zA-Z0-9]+)/);
    if (commentFile && !seen.has(commentFile[1].toLowerCase())) {
      files.push({ name: commentFile[1], code, lang: meta });
      seen.add(commentFile[1].toLowerCase());
      continue;
    }
    if (meta && !fnMatch) {
      const ext = meta.toLowerCase().replace(/[^a-z]/g,"");
      const extMap = { javascript:"app.js", typescript:"app.ts", python:"main.py", css:"styles.css", html:"index.html", jsx:"app.jsx", tsx:"app.tsx" };
      if (extMap[ext] && !seen.has(extMap[ext])) {
        files.push({ name: extMap[ext], code, lang: meta });
        seen.add(extMap[ext]);
      }
    }
  }
  return files;
}

// ─── STYLES (Cursor Desktop theme) ───────────────────────────────────────────
const EC_STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .ec-root {
    /* Cursor-like warm dark palette */
    --bg: #1a1a1a; --bg-sidebar: #181818; --bg-panel: #202020;
    --bg-hi: #2a2a2a; --bg-input: #1e1e1e;
    --border: rgba(255,255,255,.07); --border-hi: rgba(255,255,255,.13);
    --t1: #e4e4e4; --t2: #9a9a9a; --t3: #6b6b6b;
    --accent: #d99a4e; --accent2: #e8b06f; --accent-rgb: 217,154,78;
    --danger: #e0625c; --success: #6cb46c; --warning: #d99a4e;
    --mono: 'SF Mono','JetBrains Mono','Fira Code',Consolas,monospace;
    --ui: var(--font,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif);
    --radius: 6px; --radius-lg: 8px;
    display: flex; height: 100dvh; overflow: hidden;
    background: var(--bg); font-family: var(--ui); color: var(--t1); font-size: 13px;
  }

  /* PROJECTS SCREEN */
  .ec-projects-screen { flex: 1; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
  .ec-projects-topbar { height: 44px; display: flex; align-items: center; padding: 0 18px; gap: 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg-sidebar); }
  .ec-projects-logo { width: 20px; height: 20px; border-radius: 5px; overflow: hidden; flex-shrink: 0; }
  .ec-projects-logo img { width: 100%; height: 100%; object-fit: contain; }
  .ec-projects-appname { font-size: 12.5px; font-weight: 600; color: var(--t1); letter-spacing: -.01em; }
  .ec-projects-spacer { flex: 1; }
  .ec-projects-new-btn { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: var(--radius); background: var(--accent); border: none; font-size: 12px; font-weight: 600; color: #1a1208; cursor: pointer; transition: all .12s; font-family: var(--ui); }
  .ec-projects-new-btn:hover { background: var(--accent2); }
  .ec-projects-body { flex: 1; overflow-y: auto; padding: 28px 36px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.07) transparent; }
  .ec-projects-heading { font-size: 17px; font-weight: 600; color: var(--t1); margin-bottom: 4px; letter-spacing: -.02em; }
  .ec-projects-subheading { font-size: 12px; color: var(--t3); margin-bottom: 26px; }
  .ec-projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .ec-project-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; cursor: pointer; transition: all .14s; display: flex; flex-direction: column; gap: 9px; position: relative; }
  .ec-project-card:hover { border-color: var(--border-hi); background: var(--bg-hi); }
  .ec-project-card-icon { width: 32px; height: 32px; border-radius: 7px; background: rgba(var(--accent-rgb),.12); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--accent2); }
  .ec-project-card-title { font-size: 12.5px; font-weight: 600; color: var(--t1); }
  .ec-project-card-meta { font-size: 10.5px; color: var(--t3); display: flex; gap: 8px; align-items: center; }
  .ec-project-file-chip { font-size: 9.5px; font-family: var(--mono); padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,.05); color: var(--t3); }
  .ec-project-card-del { position: absolute; top: 9px; right: 9px; width: 20px; height: 20px; border-radius: 5px; background: none; border: none; color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; opacity: 0; transition: opacity .1s, color .1s; }
  .ec-project-card:hover .ec-project-card-del { opacity: 1; }
  .ec-project-card-del:hover { color: var(--danger); }
  .ec-projects-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 70px 24px; text-align: center; }
  .ec-projects-empty-icon { font-size: 28px; opacity: .3; }
  .ec-projects-empty-text { font-size: 12.5px; color: var(--t3); line-height: 1.7; }

  /* WORKSPACE */
  .ec-workspace { flex: 1; display: flex; overflow: hidden; }

  /* LEFT — Cursor task list panel (~260px) */
  .ec-sidebar { width: 260px; min-width: 260px; background: var(--bg-sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
  .ec-sidebar-top { padding: 0 8px 0 12px; height: 44px; min-height: 44px; display: flex; align-items: center; gap: 7px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-back-btn { width: 22px; height: 22px; border-radius: 5px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--t3); transition: color .1s, background .1s; flex-shrink: 0; }
  .ec-back-btn:hover { background: var(--bg-hi); color: var(--t1); }
  .ec-sidebar-project-name { font-size: 12px; font-weight: 600; color: var(--t1); letter-spacing: -.01em; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-new-file-btn { width: 22px; height: 22px; border-radius: 5px; background: rgba(var(--accent-rgb),.12); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--accent2); flex-shrink: 0; transition: background .12s; }
  .ec-new-file-btn:hover { background: rgba(var(--accent-rgb),.22); }
  .ec-sidebar-section-label { padding: 12px 14px 6px; font-size: 10px; color: var(--t3); letter-spacing: .07em; text-transform: uppercase; font-weight: 700; flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
  .ec-sidebar-section-label .ec-count { background: rgba(255,255,255,.06); border-radius: 8px; padding: 0 5px; font-size: 9px; color: var(--t3); }
  .ec-file-list { flex: 1; overflow-y: auto; padding: 2px 6px 10px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent; }
  .ec-file-list::-webkit-scrollbar { width: 3px; }
  .ec-file-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 2px; }
  .ec-file-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 8px; border-radius: var(--radius); cursor: pointer; transition: background .1s; margin-bottom: 1px; position: relative; }
  .ec-file-item:hover { background: var(--bg-panel); }
  .ec-file-item.active { background: var(--bg-hi); }
  .ec-file-status-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .ec-file-status-dot.done { background: var(--success); }
  .ec-file-status-dot.pending { border: 1.5px solid var(--t3); background: transparent; }
  .ec-file-status-dot.in_progress { background: var(--warning); box-shadow: 0 0 0 2px rgba(217,154,78,.18); }
  .ec-file-icon { font-size: 11px; color: var(--accent2); flex-shrink: 0; margin-top: 1px; }
  .ec-file-info { flex: 1; min-width: 0; }
  .ec-file-name { font-size: 12px; font-weight: 500; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--mono); }
  .ec-file-item.pending .ec-file-name { color: var(--t2); }
  .ec-file-sub { font-size: 10px; color: var(--t3); margin-top: 2px; }
  .ec-file-del { width: 16px; height: 16px; border: none; background: none; border-radius: 3px; cursor: pointer; color: var(--t3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .1s, color .1s; flex-shrink: 0; font-size: 9px; padding: 0; margin-top: 2px; }
  .ec-file-item:hover .ec-file-del { opacity: 1; }
  .ec-file-del:hover { color: var(--danger); }
  .ec-sidebar-bottom { border-top: 1px solid var(--border); padding: 10px; flex-shrink: 0; }
  .ec-ask-eloria-btn { width: 100%; display: flex; align-items: center; gap: 7px; padding: 8px 10px; border-radius: var(--radius); background: rgba(var(--accent-rgb),.08); border: 1px solid rgba(var(--accent-rgb),.18); font-size: 12px; color: var(--accent2); cursor: pointer; font-family: var(--ui); transition: all .12s; font-weight: 500; }
  .ec-ask-eloria-btn:hover { background: rgba(var(--accent-rgb),.15); }

  /* MIDDLE — Cursor plan / chat panel */
  .ec-chat { flex: 1; min-width: 0; display: flex; flex-direction: column; background: var(--bg); border-right: 1px solid var(--border); overflow: hidden; }
  .ec-chat-header { height: 44px; min-height: 44px; display: flex; align-items: center; padding: 0 16px; gap: 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-chat-file-icon { font-size: 13px; flex-shrink: 0; }
  .ec-chat-header-title { font-size: 13px; font-weight: 600; color: var(--t1); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--mono); }
  .ec-status-btn { display: flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 6px; background: none; border: 1px solid var(--border); font-size: 11px; color: var(--t2); cursor: pointer; transition: all .12s; flex-shrink: 0; font-family: var(--ui); }
  .ec-status-btn:hover { background: var(--bg-hi); border-color: var(--border-hi); color: var(--t1); }
  .ec-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent; }
  .ec-body::-webkit-scrollbar { width: 4px; }
  .ec-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 2px; }

  @keyframes ecFadeUp { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; } }

  /* File ready card */
  .ec-file-view { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 32px 28px; gap: 20px; animation: ecFadeUp .2s ease; }
  .ec-file-ready-card { width: 100%; max-width: 520px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .ec-file-ready-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); background: rgba(108,180,108,.05); }
  .ec-file-ready-icon-wrap { width: 32px; height: 32px; border-radius: 8px; background: rgba(108,180,108,.12); display: flex; align-items: center; justify-content: center; font-size: 14px; }
  .ec-file-ready-info { flex: 1; }
  .ec-file-ready-name { font-size: 13px; font-weight: 600; color: var(--t1); font-family: var(--mono); }
  .ec-file-ready-meta { font-size: 10.5px; color: var(--t3); margin-top: 2px; }
  .ec-file-ready-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; background: rgba(108,180,108,.12); color: var(--success); }
  .ec-file-code-preview { padding: 14px 16px; max-height: 220px; overflow: hidden; position: relative; }
  .ec-file-code-preview pre { font-family: var(--mono); font-size: 11px; line-height: 1.6; color: var(--t2); overflow: hidden; }
  .ec-file-code-preview::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 60px; background: linear-gradient(transparent, var(--bg-panel)); }
  .ec-file-actions { display: flex; gap: 8px; padding: 11px 16px; border-top: 1px solid var(--border); }
  .ec-file-action-btn { display: flex; align-items: center; gap: 6px; padding: 6px 13px; border-radius: var(--radius); font-size: 11.5px; font-weight: 500; cursor: pointer; font-family: var(--ui); transition: all .12s; border: 1px solid var(--border); background: none; color: var(--t2); }
  .ec-file-action-btn:hover { background: var(--bg-hi); color: var(--t1); }
  .ec-file-action-btn.primary { background: var(--accent); border-color: var(--accent); color: #1a1208; font-weight: 600; }
  .ec-file-action-btn.primary:hover { background: var(--accent2); }

  /* Pending view */
  .ec-pending-view { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 24px; gap: 14px; animation: ecFadeUp .2s ease; }
  .ec-pending-icon { font-size: 28px; opacity: .35; }
  .ec-pending-title { font-size: 14px; font-weight: 600; color: var(--t1); font-family: var(--mono); }
  .ec-pending-sub { font-size: 12px; color: var(--t3); text-align: center; line-height: 1.7; max-width: 300px; }
  .ec-pending-bar { width: 160px; height: 2px; background: var(--bg-hi); border-radius: 2px; overflow: hidden; margin-top: 4px; }
  .ec-pending-bar-fill { height: 100%; width: 40%; background: var(--accent); border-radius: 2px; animation: ecSlide 1.6s ease-in-out infinite; }
  @keyframes ecSlide { 0%{transform:translateX(-100%)}100%{transform:translateX(350%)} }

  /* Messages */
  .ec-messages { flex: 1; padding: 16px 0 6px; display: flex; flex-direction: column; }
  .ec-msg-wrap { display: flex; padding: 4px 18px; max-width: 720px; width: 100%; margin: 0 auto; }
  .ec-msg-wrap.user { justify-content: flex-end; }
  .ec-msg-wrap.ai { justify-content: flex-start; align-items: flex-start; gap: 8px; }
  .ec-ai-avatar { width: 20px; height: 20px; border-radius: 5px; overflow: hidden; flex-shrink: 0; margin-top: 4px; }
  .ec-ai-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .ec-bubble { max-width: 88%; padding: 7px 12px; font-size: 13px; line-height: 1.55; word-break: break-word; border-radius: 8px; }
  .ec-msg-wrap.user .ec-bubble { background: rgba(var(--accent-rgb),.13); color: var(--t1); border: 1px solid rgba(var(--accent-rgb),.2); border-bottom-right-radius: 3px; }
  .ec-msg-wrap.ai .ec-bubble { background: var(--bg-panel); border: 1px solid var(--border); color: var(--t1); border-bottom-left-radius: 3px; }

  /* Attach */
  .ec-attach-bubble-solo { max-width: 78%; background: rgba(var(--accent-rgb),.09); border: 1px solid rgba(var(--accent-rgb),.17); border-radius: 8px; overflow: hidden; border-bottom-right-radius: 3px; }
  .ec-attach-header { display: flex; align-items: center; gap: 7px; padding: 8px 11px 7px; border-bottom: 1px solid rgba(var(--accent-rgb),.1); }
  .ec-attach-header-icon { width: 22px; height: 22px; background: rgba(var(--accent-rgb),.13); border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .ec-attach-header-info { flex: 1; min-width: 0; }
  .ec-attach-header-name { font-size: 11.5px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-header-meta { font-size: 10px; color: var(--t3); margin-top: 1px; }
  .ec-attach-file-row { display: flex; align-items: center; gap: 6px; padding: 4px 11px; border-bottom: 1px solid rgba(255,255,255,.03); }
  .ec-attach-file-row:last-child { border-bottom: none; }
  .ec-attach-file-icon { font-size: 10px; width: 14px; text-align: center; flex-shrink: 0; color: var(--accent2); }
  .ec-attach-file-name { flex: 1; min-width: 0; font-size: 10.5px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-file-ext { font-size: 9px; font-family: var(--mono); color: var(--t3); background: rgba(255,255,255,.05); border-radius: 3px; padding: 1px 4px; flex-shrink: 0; }
  .ec-attach-file-size { font-size: 9px; color: var(--t3); flex-shrink: 0; }
  .ec-attach-text { padding: 6px 11px; font-size: 12.5px; line-height: 1.6; color: var(--t1); white-space: pre-wrap; word-break: break-word; }
  .ec-attach-strip { display: flex; gap: 5px; flex-wrap: wrap; padding: 6px 14px 0; max-width: 720px; margin: 0 auto; width: 100%; }
  .ec-attach-chip { display: flex; align-items: center; gap: 5px; padding: 3px 7px 3px 5px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 5px; font-size: 10px; color: var(--t2); max-width: 140px; animation: ecFadeUp .15s ease; }
  .ec-attach-chip-icon { font-size: 9.5px; color: var(--accent2); flex-shrink: 0; }
  .ec-attach-chip-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-chip-remove { width: 12px; height: 12px; border: none; background: none; color: var(--t3); cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; border-radius: 3px; flex-shrink: 0; transition: color .1s; padding: 0; }
  .ec-attach-chip-remove:hover { color: var(--danger); }
  .ec-attach-limit-note { font-size: 10px; color: var(--t3); padding: 2px 14px 0; max-width: 720px; margin: 0 auto; width: 100%; }

  /* Thinking */
  .ec-thinking { display: flex; align-items: center; gap: 8px; padding: 5px 18px; max-width: 720px; width: 100%; margin: 0 auto; }
  .ec-thinking-avatar { width: 20px; height: 20px; border-radius: 5px; overflow: hidden; flex-shrink: 0; }
  .ec-thinking-avatar img { width: 100%; height: 100%; object-fit: contain; }
  .ec-thinking-dots { display: flex; gap: 4px; align-items: center; }
  .ec-thinking-dots span { width: 4px; height: 4px; border-radius: 50%; background: var(--accent2); opacity: .3; animation: ecDot 1.2s ease-in-out infinite; }
  .ec-thinking-dots span:nth-child(2) { animation-delay: .18s; }
  .ec-thinking-dots span:nth-child(3) { animation-delay: .36s; }
  @keyframes ecDot { 0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)} }

  /* Input */
  .ec-input-wrap { flex-shrink: 0; padding: 8px 14px 12px; background: var(--bg); }
  .ec-input-box { max-width: 720px; margin: 0 auto; background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 8px 10px; display: flex; flex-direction: column; gap: 6px; transition: border-color .15s, box-shadow .15s; }
  .ec-input-box:focus-within { border-color: rgba(var(--accent-rgb),.45); box-shadow: 0 0 0 3px rgba(var(--accent-rgb),.08); }
  .ec-input-toolbar { display: flex; align-items: center; gap: 4px; padding-bottom: 5px; border-bottom: 1px solid var(--border); }
  .ec-toolbar-btn { display: flex; align-items: center; gap: 5px; padding: 3px 7px; background: none; border: 1px solid transparent; border-radius: 5px; cursor: pointer; font-size: 11px; color: var(--t3); transition: all .12s; font-family: var(--ui); }
  .ec-toolbar-btn:hover { background: var(--bg-hi); border-color: var(--border); color: var(--t1); }
  .ec-toolbar-btn svg { width: 10px; height: 10px; flex-shrink: 0; }
  .ec-toolbar-btn.disabled { opacity: .3; pointer-events: none; }
  .ec-toolbar-sep { width: 1px; height: 12px; background: var(--border); flex-shrink: 0; }
  .ec-textarea-row { display: flex; align-items: flex-end; gap: 7px; }
  .ec-input-prefix { font-family: var(--mono); font-size: 12px; color: var(--t3); flex-shrink: 0; user-select: none; line-height: 22px; }
  .ec-textarea { flex: 1; border: none; background: none; outline: none; font-family: var(--ui); font-size: 13px; color: var(--t1); resize: none; min-height: 22px; max-height: 140px; line-height: 1.55; overflow-y: auto; scrollbar-width: thin; caret-color: var(--accent2); }
  .ec-textarea::placeholder { color: var(--t3); }
  .ec-send { width: 26px; height: 26px; border-radius: 6px; background: var(--accent); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #1a1208; transition: opacity .13s, background .13s; }
  .ec-send:hover:not(:disabled) { background: var(--accent2); }
  .ec-send:disabled { opacity: .22; cursor: default; }
  .ec-send svg { width: 12px; height: 12px; }
  .ec-hint { text-align: center; font-size: 10px; color: var(--t3); margin-top: 5px; max-width: 720px; margin-left: auto; margin-right: auto; opacity: .65; }

  /* RIGHT — Cursor file/code/preview panel (~400px) */
  .ec-right { width: 400px; min-width: 400px; background: var(--bg-sidebar); display: flex; flex-direction: column; overflow: hidden; }
  .ec-right-header { height: 44px; min-height: 44px; display: flex; align-items: stretch; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-right-tabs { display: flex; flex: 1; }
  .ec-right-tab { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 500; color: var(--t3); cursor: pointer; border-bottom: 2px solid transparent; transition: all .12s; background: none; border-top: none; border-left: none; border-right: none; font-family: var(--ui); }
  .ec-right-tab:hover { color: var(--t2); }
  .ec-right-tab.active { color: var(--t1); border-bottom-color: var(--accent); }
  .ec-right-body { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent; display: flex; flex-direction: column; }
  .ec-right-body::-webkit-scrollbar { width: 3px; }
  .ec-right-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 2px; }

  /* Preview */
  .ec-preview-frame { width: 100%; height: 100%; border: none; background: #fff; flex: 1; }
  .ec-preview-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 12px; padding: 32px; text-align: center; }
  .ec-preview-placeholder-icon { font-size: 24px; opacity: .3; }
  .ec-preview-placeholder-text { font-size: 11.5px; color: var(--t3); line-height: 1.7; }

  /* Code viewer */
  .ec-code-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg-sidebar); position: sticky; top: 0; z-index: 1; }
  .ec-code-filename { font-size: 11px; font-family: var(--mono); color: var(--t2); flex: 1; }
  .ec-copy-btn { display: flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 5px; background: var(--bg-panel); border: 1px solid var(--border); font-size: 10.5px; color: var(--t2); cursor: pointer; transition: all .12s; font-family: var(--ui); }
  .ec-copy-btn:hover { border-color: var(--border-hi); color: var(--t1); }
  .ec-copy-btn.copied { color: var(--success); border-color: rgba(108,180,108,.35); }
  .ec-download-btn { display: flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 5px; background: rgba(var(--accent-rgb),.12); border: 1px solid rgba(var(--accent-rgb),.25); font-size: 10.5px; color: var(--accent2); cursor: pointer; transition: all .12s; font-family: var(--ui); }
  .ec-download-btn:hover { background: rgba(var(--accent-rgb),.22); }
  .ec-line-nums { display: flex; flex: 1; overflow: auto; }
  .ec-line-num-col { padding: 14px 10px 14px 14px; font-size: 11px; line-height: 1.65; color: var(--t3); font-family: var(--mono); text-align: right; user-select: none; border-right: 1px solid var(--border); flex-shrink: 0; min-width: 36px; }
  .ec-code-main { flex: 1; padding: 14px 14px; font-family: var(--mono); font-size: 11.5px; line-height: 1.65; color: var(--t2); overflow-x: auto; white-space: pre; }

  /* Files tab */
  .ec-files-tab-body { padding: 12px; display: flex; flex-direction: column; gap: 5px; }
  .ec-files-tab-section-label { font-size: 9.5px; color: var(--t3); font-weight: 600; letter-spacing: .07em; text-transform: uppercase; padding: 8px 0 3px; }
  .ec-files-tab-file { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius); background: var(--bg-panel); border: 1px solid var(--border); cursor: pointer; transition: all .12s; }
  .ec-files-tab-file:hover { border-color: var(--border-hi); }
  .ec-files-tab-file.active { border-color: rgba(var(--accent-rgb),.3); background: rgba(var(--accent-rgb),.06); }
  .ec-files-tab-icon { font-size: 12px; color: var(--accent2); flex-shrink: 0; }
  .ec-files-tab-info { flex: 1; min-width: 0; }
  .ec-files-tab-name { font-size: 11.5px; font-weight: 500; color: var(--t1); font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-files-tab-meta { font-size: 10px; color: var(--t3); margin-top: 2px; }
  .ec-files-tab-status { font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 10px; flex-shrink: 0; }
  .ec-files-tab-status.done { background: rgba(108,180,108,.12); color: var(--success); }
  .ec-files-tab-status.pending { background: rgba(107,114,128,.1); color: var(--t3); }
  .ec-files-tab-status.in_progress { background: rgba(217,154,78,.14); color: var(--warning); }
  .ec-files-tab-dl { width: 22px; height: 22px; border-radius: 5px; background: none; border: 1px solid var(--border); color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all .12s; }
  .ec-files-tab-dl:hover { color: var(--accent2); border-color: rgba(var(--accent-rgb),.3); }

  /* Empty states */
  .ec-no-content { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 10px; padding: 40px 16px; text-align: center; }
  .ec-no-content-icon { font-size: 22px; opacity: .3; }
  .ec-no-content-text { font-size: 11.5px; color: var(--t3); line-height: 1.65; }

  /* Status dropdown */
  .ec-status-dropdown { position: absolute; top: calc(100% + 5px); right: 0; background: var(--bg-panel); border: 1px solid var(--border-hi); border-radius: var(--radius-lg); padding: 4px; width: 190px; z-index: 200; box-shadow: 0 12px 36px rgba(0,0,0,.5); animation: ecFadeUp .14s ease; }
  .ec-status-option { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 11.5px; color: var(--t2); transition: all .1s; background: none; border: none; width: 100%; text-align: left; font-family: var(--ui); }
  .ec-status-option:hover { background: var(--bg-hi); color: var(--t1); }

  /* Statusbar */
  .ec-statusbar { display: flex; align-items: center; gap: 14px; padding: 0 12px; height: 24px; min-height: 24px; background: var(--bg-sidebar); border-top: 1px solid var(--border); flex-shrink: 0; font-size: 10px; color: var(--t3); }
  .ec-statusbar-item { display: flex; align-items: center; gap: 4px; }
  .ec-statusbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

  /* Modals */
  .ec-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.6); display: flex; align-items: center; justify-content: center; z-index: 500; animation: ecFadeIn .14s ease; }
  @keyframes ecFadeIn { from{opacity:0}to{opacity:1} }
  .ec-modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; width: 340px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.55); display: flex; flex-direction: column; gap: 14px; animation: ecSlideUp .16s ease; }
  @keyframes ecSlideUp { from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)} }
  .ec-modal-title { font-size: 13.5px; font-weight: 600; color: var(--t1); display: flex; align-items: center; gap: 8px; }
  .ec-modal-title-icon { width: 24px; height: 24px; background: rgba(var(--accent-rgb),.12); border-radius: 7px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .ec-modal-field { display: flex; flex-direction: column; gap: 5px; }
  .ec-modal-label { font-size: 9.5px; color: var(--t3); font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
  .ec-modal-input { padding: 8px 10px; font-size: 12.5px; color: var(--t1); background: var(--bg); border: 1px solid var(--border); border-radius: 7px; outline: none; transition: border-color .15s; font-family: var(--ui); }
  .ec-modal-input::placeholder { color: var(--t3); }
  .ec-modal-input:focus { border-color: rgba(var(--accent-rgb),.45); }
  .ec-modal-actions { display: flex; gap: 7px; justify-content: flex-end; }
  .ec-modal-cancel { padding: 7px 12px; background: none; border: 1px solid var(--border); border-radius: 7px; font-size: 12px; color: var(--t2); cursor: pointer; transition: background .12s; font-family: var(--ui); }
  .ec-modal-cancel:hover { background: var(--bg-hi); }
  .ec-modal-create { padding: 7px 14px; background: var(--accent); border: none; border-radius: 7px; font-size: 12px; font-weight: 700; color: #1a1208; cursor: pointer; transition: opacity .12s; font-family: var(--ui); }
  .ec-modal-create:hover:not(:disabled) { opacity: .88; }
  .ec-modal-create:disabled { opacity: .3; cursor: default; }

  /* Limit modal */
  .ec-limit-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.65); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; animation: ecFadeIn .15s ease; }
  .ec-limit-box { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 310px; margin: 0 16px; overflow: hidden; box-shadow: 0 28px 70px rgba(0,0,0,.55); animation: ecSlideUp .18s ease; }
  .ec-limit-top { border-bottom: 1px solid var(--border); padding: 22px 16px 16px; text-align: center; position: relative; }
  .ec-limit-close { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: var(--bg-hi); border: none; color: var(--t3); cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; transition: all .12s; }
  .ec-limit-close:hover { color: var(--t1); }
  .ec-limit-icon { width: 38px; height: 38px; border-radius: 10px; background: rgba(var(--accent-rgb),.12); display: flex; align-items: center; justify-content: center; font-size: 17px; margin: 0 auto 10px; }
  .ec-limit-title { font-size: 13.5px; font-weight: 600; color: var(--t1); margin-bottom: 3px; }
  .ec-limit-sub { font-size: 11px; color: var(--t3); }
  .ec-limit-body { padding: 14px 16px 16px; }
  .ec-limit-desc { font-size: 12px; color: var(--t2); line-height: 1.65; margin-bottom: 12px; text-align: center; }
  .ec-limit-actions { display: flex; gap: 6px; }
  .ec-limit-cancel { flex: 1; padding: 8px; background: none; border: 1px solid var(--border); border-radius: 7px; font-size: 11.5px; color: var(--t2); cursor: pointer; font-weight: 500; font-family: var(--ui); }
  .ec-limit-cancel:hover { background: var(--bg-hi); }
  .ec-limit-upgrade { flex: 2; padding: 8px; background: var(--accent); border: none; border-radius: 7px; font-size: 11.5px; font-weight: 700; color: #1a1208; cursor: pointer; font-family: var(--ui); }
  .ec-limit-upgrade:hover { opacity: .88; }
`;

// ─── FIRESTORE HELPERS ─────────────────────────────────────────────────────
async function loadProjects(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().codeProjects || [];
}
async function saveProjects(uid, projects) {
  await setDoc(doc(db, "users", uid), { codeProjects: JSON.parse(JSON.stringify(projects)) }, { merge: true });
}
async function loadFileMessages(uid, fileId) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return ((snap.data().codeFileMessages || {})[String(fileId)]) || [];
}
async function saveFileMessages(uid, fileId, messages) {
  await setDoc(doc(db, "users", uid), { codeFileMessages: { [String(fileId)]: JSON.parse(JSON.stringify(messages)) } }, { merge: true });
}
async function deleteFileMessages(uid, fileId) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const map = snap.data().codeFileMessages || {};
  delete map[String(fileId)];
  await setDoc(ref, { codeFileMessages: map }, { merge: true });
}

const FILE_STATUS_LABELS = { done: "Ready", pending: "Pending", in_progress: "In Progress" };

// ─── ATTACHMENT BUBBLE ─────────────────────────────────────────────────────
function AttachmentBubble({ attachment }) {
  const isFolder = attachment.type === "folder";
  return (
    <div className="ec-attach-bubble-solo">
      <div className="ec-attach-header">
        <div className="ec-attach-header-icon">{isFolder ? "📁" : getFileIcon(attachment.files[0]?.name || "")}</div>
        <div className="ec-attach-header-info">
          <div className="ec-attach-header-name">{attachment.name}</div>
          <div className="ec-attach-header-meta">{isFolder ? `${attachment.files.length} files · folder` : `${formatBytes(attachment.files[0]?.size)} · ${getExtLabel(attachment.name)}`}</div>
        </div>
      </div>
      {attachment.files.map((f, i) => (
        <div key={i} className="ec-attach-file-row">
          <span className="ec-attach-file-icon">{getFileIcon(f.name)}</span>
          <span className="ec-attach-file-name">{isFolder ? f.relativePath || f.name : f.name}</span>
          <span className="ec-attach-file-ext">{getExtLabel(f.name)}</span>
          <span className="ec-attach-file-size">{formatBytes(f.size)}</span>
        </div>
      ))}
      {attachment.userText && <div className="ec-attach-text">{attachment.userText}</div>}
    </div>
  );
}

// ─── CODE VIEWER ────────────────────────────────────────────────────────────
function CodeViewer({ code, filename }) {
  const [copied, setCopied] = useState(false);
  const ext = getExt(filename || "");
  const lines = (code || "").split("\n");
  const highlighted = syntaxHighlight(code || "", ext).split("\n");

  const copy = () => {
    navigator.clipboard.writeText(code || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
      <div className="ec-code-header">
        <span className="ec-code-filename">{filename || "code"}</span>
        <button className="ec-download-btn" onClick={() => downloadFile(filename, code)} title="Download file">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
        <button className={`ec-copy-btn${copied ? " copied" : ""}`} onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>
      <div className="ec-line-nums" style={{ flex:1 }}>
        <div className="ec-line-num-col">{lines.map((_, i) => <div key={i}>{i + 1}</div>)}</div>
        <div className="ec-code-main" dangerouslySetInnerHTML={{ __html: highlighted.join("\n") }} />
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function EloriaCode() {
  const [uid,            setUid]           = useState(null);
  const [authReady,      setAuthReady]     = useState(false);
  const [userName,       setUserName]      = useState("");
  const [userPlan,       setUserPlan]      = useState("free");
  const [projects,       setProjects]      = useState([]);
  const [activeProject,  setActiveProject] = useState(null);
  const [activeFileId,   setActiveFileId]  = useState(null);
  const [messages,       setMessages]      = useState([]);
  const [input,          setInput]         = useState("");
  const [isThinking,     setIsThinking]    = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [rightTab,       setRightTab]      = useState("preview");
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showFileModal,  setShowFileModal]  = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newFileName,    setNewFileName]    = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showWelcome,    setShowWelcome]    = useState(() => !localStorage.getItem("eloria_code_welcomed"));

  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);
  const bodyRef        = useRef(null);
  const textareaRef    = useRef(null);
  const abortRef       = useRef(null);
  const statusBtnRef   = useRef(null);

  const activeFile = useMemo(() => {
    if (!activeProject || !activeFileId) return null;
    return (activeProject.files || []).find(f => f.id === activeFileId) || null;
  }, [activeProject, activeFileId]);

  const doneFiles  = useMemo(() => (activeProject?.files || []).filter(f => f.status === "done"),       [activeProject]);
  const wipFiles   = useMemo(() => (activeProject?.files || []).filter(f => f.status === "in_progress"), [activeProject]);
  const pendFiles  = useMemo(() => (activeProject?.files || []).filter(f => f.status === "pending"),    [activeProject]);

  const folderCount  = pendingAttachments.filter(a => a.type === "folder").length;
  const fileCount    = pendingAttachments.filter(a => a.type === "file").length;
  const canAddFolder = folderCount < 1;
  const canAddFile   = fileCount < 2;

  // Styles
  useEffect(() => {
    if (!document.getElementById("eloria-ec-v5")) {
      const tag = document.createElement("style");
      tag.id = "eloria-ec-v5";
      tag.textContent = EC_STYLE;
      document.head.appendChild(tag);
    }
    ["eloria-ec","eloria-ec-v2","eloria-ec-v3","eloria-ec-v4"].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  }, []);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid); setUserName(u.displayName || "");
        try {
          const token = await u.getIdToken();
          const res = await fetch("https://eloria-trial.onrender.com/api/membership/status", { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          setUserPlan(data.plan || "free");
        } catch {}
        const p = await loadProjects(u.uid);
        setProjects(p);
      } else { setUid(null); setProjects([]); setActiveProject(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages, isThinking]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  useEffect(() => {
    if (uid && activeFileId && messages.length > 0) saveFileMessages(uid, activeFileId, messages);
  }, [messages, activeFileId, uid]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const h = (e) => { if (statusBtnRef.current && !statusBtnRef.current.contains(e.target)) setShowStatusMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showStatusMenu]);

  // Project updater — keeps activeProject in sync
  const updateProjects = useCallback(async (updated) => {
    setProjects(updated);
    if (uid) await saveProjects(uid, updated);
    if (activeProject) {
      const found = updated.find(p => p.id === activeProject.id);
      if (found) setActiveProject(found);
    }
  }, [uid, activeProject]);

  const updateActiveProject = useCallback(async (updater) => {
    const updated = projects.map(p => p.id === activeProject?.id ? updater(p) : p);
    await updateProjects(updated);
  }, [projects, activeProject, updateProjects]);

  // Project actions
  const createProject = async () => {
    if (!newProjectName.trim() || !uid) return;
    const project = { id: Date.now(), name: newProjectName.trim(), description: newProjectDesc.trim() || "", files: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    const updated = [project, ...projects];
    await updateProjects(updated);
    setNewProjectName(""); setNewProjectDesc(""); setShowProjectModal(false);
    setActiveProject(project); setActiveFileId(null); setMessages([]);
  };

  const deleteProject = async (e, projectId) => {
    e.stopPropagation();
    const project = projects.find(p => p.id === projectId);
    if (project) for (const f of (project.files || [])) await deleteFileMessages(uid, f.id);
    const updated = projects.filter(p => p.id !== projectId);
    setProjects(updated);
    if (uid) await saveProjects(uid, updated);
    if (activeProject?.id === projectId) { setActiveProject(null); setActiveFileId(null); setMessages([]); }
  };

  const enterProject = async (project) => {
    setActiveProject(project);
    setActiveFileId(null); setMessages([]); setInput(""); setPendingAttachments([]);
    if (project.files?.length > 0) {
      const first = project.files[0];
      setActiveFileId(first.id);
      setMessages(uid ? await loadFileMessages(uid, first.id) : []);
    }
  };

  // File actions
  const createFile = async () => {
    if (!newFileName.trim() || !activeProject) return;
    const file = { id: Date.now(), name: newFileName.trim(), status: "pending", code: null, lines: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await updateActiveProject(p => ({ ...p, files: [...(p.files || []), file], updatedAt: new Date().toISOString() }));
    setNewFileName(""); setShowFileModal(false);
    switchFile(file.id);
  };

  const deleteFile = async (e, fileId) => {
    e.stopPropagation();
    await deleteFileMessages(uid, fileId);
    await updateActiveProject(p => ({ ...p, files: (p.files || []).filter(f => f.id !== fileId), updatedAt: new Date().toISOString() }));
    if (activeFileId === fileId) {
      const remaining = (activeProject?.files || []).filter(f => f.id !== fileId);
      if (remaining.length > 0) switchFile(remaining[0].id);
      else { setActiveFileId(null); setMessages([]); }
    }
  };

  const switchFile = async (fileId) => {
    if (uid && activeFileId) await saveFileMessages(uid, activeFileId, messages);
    setActiveFileId(fileId);
    setMessages(uid ? await loadFileMessages(uid, fileId) : []);
    setInput(""); setPendingAttachments([]);
  };

  const updateFileStatus = async (fileId, status) => {
    await updateActiveProject(p => ({ ...p, files: (p.files || []).map(f => f.id === fileId ? { ...f, status, updatedAt: new Date().toISOString() } : f), updatedAt: new Date().toISOString() }));
    setShowStatusMenu(false);
  };

  // File reading
  const readFileAsText = (file) => new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => resolve("[could not read]"); r.readAsText(file); });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    const supported = files.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported code files found."); return; }
    const toAdd = supported.slice(0, 2 - fileCount);
    const af = await Promise.all(toAdd.map(async f => ({ name: f.name, size: f.size, content: await readFileAsText(f) })));
    setPendingAttachments(prev => [...prev, ...af.map(f => ({ id: Date.now() + Math.random(), type: "file", name: f.name, files: [f] }))]);
  };

  const handleFolderSelect = async (e) => {
    const all = Array.from(e.target.files || []); e.target.value = "";
    const supported = all.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported files found."); return; }
    const folderName = (supported[0].webkitRelativePath || supported[0].name).split("/")[0] || "folder";
    const af = await Promise.all(supported.map(async f => ({ name: f.name, relativePath: f.webkitRelativePath || f.name, size: f.size, content: await readFileAsText(f) })));
    setPendingAttachments(prev => [...prev, { id: Date.now() + Math.random(), type: "folder", name: folderName, files: af }]);
  };

  // Send message
  const sendMessage = async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const hasText = input.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || isThinking || !activeFile) return;
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    let attachCtx = "";
    if (hasAttachments) {
      attachCtx = pendingAttachments.map(att => {
        const h = att.type === "folder" ? `\n\n[FOLDER: "${att.name}" — ${att.files.length} files]\n` : `\n\n[FILE: "${att.name}"]\n`;
        return h + att.files.map(f => `--- ${f.relativePath || f.name} ---\n${f.content}\n`).join("\n");
      }).join("\n");
    }

    const sysCtx = activeProject
      ? `You are Eloria Code, an expert coding agent. Project: "${activeProject.name}". Current file: "${activeFile.name}". All project files: ${(activeProject.files || []).map(f => `${f.name}(${f.status})`).join(", ")}. When you produce the complete code for "${activeFile.name}", use a fenced block like: \`\`\`${getExt(activeFile.name)} ${activeFile.name}\n...\n\`\`\`. If this project needs additional files not yet created, list them at end as: FILES_NEEDED: file1.ext, file2.ext`
      : "";

    const userMsg = { id: Date.now(), sender: "user", text: hasText ? input : "", attachments: hasAttachments ? [...pendingAttachments] : undefined };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setPendingAttachments([]);

    const apiMessages = [
      ...(sysCtx ? [{ role: "user", content: sysCtx }, { role: "assistant", content: "Understood. I'll build this project file by file." }] : []),
      ...newMsgs.filter(m => m.text || m.attachments).map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.sender === "user" ? (m.attachments?.length ? `${attachCtx}\n\n${m.text || ""}`.trim() : m.text) : m.text,
      }))
    ];

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
            if (json.text) { aiText += json.text; const snap = aiText; setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: snap } : m)); }
          } catch {}
        }
      }

      // Parse files
      const parsedFiles = parseFilesFromAI(aiText);
      const filesNeededMatch = aiText.match(/FILES_NEEDED:\s*([^\n]+)/i);
      const filesNeeded = filesNeededMatch ? filesNeededMatch[1].split(",").map(f => f.trim()).filter(Boolean) : [];

      if (parsedFiles.length > 0 && activeProject) {
        const currentParsed = parsedFiles.find(f => f.name.toLowerCase() === activeFile.name.toLowerCase()) || parsedFiles[0];
        await updateActiveProject(p => {
          let files = [...(p.files || [])];
          const existingNames = new Set(files.map(f => f.name.toLowerCase()));

          // Mark current file done
          files = files.map(f => f.id === activeFileId
            ? { ...f, status: "done", code: currentParsed.code, lines: currentParsed.code.split("\n").length, updatedAt: new Date().toISOString() }
            : f
          );

          // Add other parsed files
          for (const pf of parsedFiles) {
            if (pf.name.toLowerCase() !== activeFile.name.toLowerCase() && !existingNames.has(pf.name.toLowerCase())) {
              files.push({ id: Date.now() + Math.random(), name: pf.name, status: "done", code: pf.code, lines: pf.code.split("\n").length, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
              existingNames.add(pf.name.toLowerCase());
            }
          }

          // Add pending files from FILES_NEEDED
          for (const fn of filesNeeded) {
            if (!existingNames.has(fn.toLowerCase())) {
              files.push({ id: Date.now() + Math.random(), name: fn, status: "pending", code: null, lines: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
              existingNames.add(fn.toLowerCase());
            }
          }

          return { ...p, files, updatedAt: new Date().toISOString() };
        });
      } else if (aiText.length > 60 && activeFile?.status === "pending") {
        await updateActiveProject(p => ({ ...p, files: (p.files || []).map(f => f.id === activeFileId ? { ...f, status: "in_progress", updatedAt: new Date().toISOString() } : f), updatedAt: new Date().toISOString() }));
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setIsThinking(false);
        setMessages(prev => [...prev, { id: Date.now() + 2, sender: "ai", text: "Eloria Code couldn't respond. Check your connection." }]);
      }
      setIsThinking(false);
    }
  };

  const stopMessage = () => { if (abortRef.current) abortRef.current.abort(); setIsThinking(false); };

  const limitHint = (() => {
    const parts = [];
    if (folderCount >= 1) parts.push("1 folder max");
    if (fileCount >= 2) parts.push("2 files max");
    return parts.length ? `Limit reached — ${parts.join(", ")} per message` : null;
  })();

  if (!authReady) return null;
  if (!uid) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", fontFamily:"var(--font,sans-serif)", fontSize:13, color:"#50505a", background:"#1a1a1a" }}>Please log in to use Eloria Code.</div>;
  if (window.innerWidth <= 768) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100dvh", background:"#1a1a1a", padding:"32px 24px", textAlign:"center", gap:20, fontFamily:"var(--font,sans-serif)" }}>
      <div style={{ width:56, height:56, borderRadius:15, background:"rgba(217,154,78,.1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>💻</div>
      <div>
        <div style={{ fontSize:18, fontWeight:600, color:"#e4e4e4", marginBottom:8 }}>Desktop only</div>
        <div style={{ fontSize:13, color:"#9a9a9a", lineHeight:1.65, maxWidth:260 }}>Eloria Code is designed for desktop.</div>
      </div>
    </div>
  );

  // ── PROJECTS SCREEN ──────────────────────────────────────────────────────
  if (!activeProject) return (
    <div className="ec-root">
      <input ref={fileInputRef} type="file" multiple style={{ display:"none" }} onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple style={{ display:"none" }} onChange={handleFolderSelect} />
      {showWelcome && <EloriaCodeWelcome onDismiss={() => setShowWelcome(false)} userName={userName} />}

      <div className="ec-projects-screen">
        <div className="ec-projects-topbar">
          <div className="ec-projects-logo"><img src={logo} alt="Eloria" /></div>
          <span className="ec-projects-appname">Eloria Code</span>
          <div className="ec-projects-spacer" />
          <button className="ec-projects-new-btn" onClick={() => setShowProjectModal(true)}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Project
          </button>
        </div>

        <div className="ec-projects-body">
          <div className="ec-projects-heading">Projects</div>
          <div className="ec-projects-subheading">Select a project or create a new one to start coding.</div>
          {projects.length === 0 ? (
            <div className="ec-projects-empty">
              <div className="ec-projects-empty-icon">⚡</div>
              <div className="ec-projects-empty-text">No projects yet.<br />Create one to get started.</div>
            </div>
          ) : (
            <div className="ec-projects-grid">
              {projects.map(project => (
                <div key={project.id} className="ec-project-card" onClick={() => enterProject(project)}>
                  <button className="ec-project-card-del" onClick={e => deleteProject(e, project.id)}>✕</button>
                  <div className="ec-project-card-icon">⚡</div>
                  <div>
                    <div className="ec-project-card-title">{project.name}</div>
                    {project.description && <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>{project.description}</div>}
                  </div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {(project.files || []).slice(0, 5).map(f => <span key={f.id} className="ec-project-file-chip">{f.name}</span>)}
                    {(project.files || []).length > 5 && <span className="ec-project-file-chip">+{(project.files || []).length - 5}</span>}
                  </div>
                  <div className="ec-project-card-meta">
                    <span>{(project.files || []).length} file{(project.files || []).length !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{timeAgo(project.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showProjectModal && (
        <div className="ec-modal-backdrop" onClick={() => setShowProjectModal(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <div className="ec-modal-title"><div className="ec-modal-title-icon">⚡</div>New Project</div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Project name</label>
              <input className="ec-modal-input" placeholder="e.g. Portfolio Website, Chat App" value={newProjectName} autoFocus onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} />
            </div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Description (optional)</label>
              <input className="ec-modal-input" placeholder="What are you building?" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} />
            </div>
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setShowProjectModal(false)}>Cancel</button>
              <button className="ec-modal-create" onClick={createProject} disabled={!newProjectName.trim()}>Create Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── WORKSPACE ────────────────────────────────────────────────────────────
  const renderFileSection = (sectionFiles, label, status) => {
    if (!sectionFiles.length) return null;
    return (
      <div key={status}>
        <div className="ec-sidebar-section-label">{label}<span className="ec-count">{sectionFiles.length}</span></div>
        {sectionFiles.map(file => (
          <div key={file.id} className={`ec-file-item${file.status === "pending" ? " pending" : ""}${file.id === activeFileId ? " active" : ""}`} onClick={() => switchFile(file.id)}>
            <span className={`ec-file-status-dot ${file.status}`} />
            <span className="ec-file-icon">{getFileIcon(file.name)}</span>
            <div className="ec-file-info">
              <div className="ec-file-name">{file.name}</div>
              {file.lines > 0 && <div className="ec-file-sub">{file.lines} lines</div>}
            </div>
            <button className="ec-file-del" onClick={e => deleteFile(e, file.id)}>✕</button>
          </div>
        ))}
      </div>
    );
  };

  // Right panel content
  const rightContent = () => {
    if (!activeFile) return <div className="ec-no-content"><div className="ec-no-content-icon">⚡</div><div className="ec-no-content-text">Select a file to see preview, code, and project files.</div></div>;

    if (rightTab === "preview") {
      const ext = getExt(activeFile.name);
      if (!activeFile.code) return <div className="ec-preview-placeholder"><div className="ec-preview-placeholder-icon">👁</div><div className="ec-preview-placeholder-text">{activeFile.status === "pending" ? "File hasn't been generated yet." : "No code yet. Ask Eloria to build this file."}</div></div>;
      if (!["html","htm","css"].includes(ext)) return <div className="ec-preview-placeholder"><div className="ec-preview-placeholder-icon">👁</div><div className="ec-preview-placeholder-text">Live preview is available for HTML and CSS files only — other file types can't be rendered in a browser.</div></div>;

      // For a standalone CSS file, wrap it in a minimal HTML doc so something is visible.
      let previewDoc = activeFile.code;
      if (ext === "css") {
        previewDoc = `<!doctype html><html><head><style>${activeFile.code}</style></head><body><div style="padding:24px;font-family:sans-serif;color:#111"><h1>Heading</h1><p>This preview wraps your CSS in a basic page so you can see how the styles render.</p><button>Button</button></div></body></html>`;
      }
      const blob = new Blob([previewDoc], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      return <iframe className="ec-preview-frame" src={url} title="Preview" sandbox="allow-scripts allow-same-origin" />;
    }

    if (rightTab === "code") {
      if (!activeFile.code) return <div className="ec-no-content"><div className="ec-no-content-icon">{activeFile.status === "pending" ? "⏳" : "💬"}</div><div className="ec-no-content-text">{activeFile.status === "pending" ? "Pending generation." : "No code yet."}</div></div>;
      return <CodeViewer code={activeFile.code} filename={activeFile.name} />;
    }

    if (rightTab === "files") {
      const allFiles = activeProject?.files || [];
      if (!allFiles.length) return <div className="ec-no-content"><div className="ec-no-content-icon">📁</div><div className="ec-no-content-text">No files yet.</div></div>;
      return (
        <div className="ec-files-tab-body">
          {allFiles.map(f => (
            <div key={f.id} className={`ec-files-tab-file${f.id === activeFileId ? " active" : ""}`} onClick={() => switchFile(f.id)}>
              <span className="ec-files-tab-icon">{getFileIcon(f.name)}</span>
              <div className="ec-files-tab-info">
                <div className="ec-files-tab-name">{f.name}</div>
                <div className="ec-files-tab-meta">{f.lines > 0 ? `${f.lines} lines` : "No code"} · {timeAgo(f.updatedAt)}</div>
              </div>
              <span className={`ec-files-tab-status ${f.status}`}>{FILE_STATUS_LABELS[f.status]}</span>
              {f.code && (
                <button className="ec-files-tab-dl" title="Download" onClick={(e) => { e.stopPropagation(); downloadFile(f.name, f.code); }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      );
    }
  };

  // Middle content
  const middleContent = () => {
    if (!activeFile) return (
      <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12 }}>
        <div style={{ fontSize:22, opacity:.25 }}>📁</div>
        <div style={{ fontSize:13, color:"var(--t3)", textAlign:"center", lineHeight:1.7 }}>Select a file or add a new one.</div>
        <button onClick={() => setShowFileModal(true)} style={{ padding:"6px 14px", background:"rgba(217,154,78,.12)", border:"1px solid rgba(217,154,78,.25)", borderRadius:7, fontSize:12, color:"var(--accent2)", cursor:"pointer", fontFamily:"var(--ui)" }}>Add file</button>
      </div>
    );

    if (activeFile.status === "pending" && !messages.length) return (
      <div className="ec-pending-view">
        <div className="ec-pending-icon">⏳</div>
        <div className="ec-pending-title">{activeFile.name}</div>
        <div className="ec-pending-sub">This file is pending. Describe what it should do and Eloria will generate the code.</div>
        <div className="ec-pending-bar"><div className="ec-pending-bar-fill" /></div>
      </div>
    );

    if (activeFile.status === "done" && activeFile.code && !messages.length) return (
      <div className="ec-file-view">
        <div className="ec-file-ready-card">
          <div className="ec-file-ready-header">
            <div className="ec-file-ready-icon-wrap">{getFileIcon(activeFile.name)}</div>
            <div className="ec-file-ready-info">
              <div className="ec-file-ready-name">{activeFile.name}</div>
              <div className="ec-file-ready-meta">{activeFile.lines} lines · generated by Eloria</div>
            </div>
            <span className="ec-file-ready-badge">Ready</span>
          </div>
          <div className="ec-file-code-preview">
            <pre dangerouslySetInnerHTML={{ __html: syntaxHighlight((activeFile.code || "").slice(0, 800), getExt(activeFile.name)) }} />
          </div>
          <div className="ec-file-actions">
            <button className="ec-file-action-btn primary" onClick={() => setRightTab("code")}>View full code →</button>
            <button className="ec-file-action-btn" onClick={() => navigator.clipboard.writeText(activeFile.code)}>Copy</button>
            <button className="ec-file-action-btn" onClick={() => downloadFile(activeFile.name, activeFile.code)}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
          </div>
        </div>
      </div>
    );

    return (
      <div className="ec-messages">
        {messages.map(msg => (
          <div key={msg.id} className={`ec-msg-wrap ${msg.sender}`}>
            {msg.sender === "ai" && <div className="ec-ai-avatar"><img src={logo} alt="Eloria" /></div>}
            {msg.sender === "user" && msg.attachments?.length > 0 ? (
              <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end", maxWidth:"78%" }}>
                {msg.attachments.map(att => <AttachmentBubble key={att.id} attachment={{ ...att, userText: msg.attachments.length === 1 ? msg.text : undefined }} />)}
                {msg.attachments.length > 1 && msg.text && <div className="ec-bubble" style={{ background:"rgba(217,154,78,.13)", border:"1px solid rgba(217,154,78,.2)", borderBottomRightRadius:3 }}>{msg.text}</div>}
              </div>
            ) : (
              <div className="ec-bubble">{msg.sender === "ai" ? <MarkdownMessage content={msg.text} /> : msg.text}</div>
            )}
          </div>
        ))}
        {isThinking && <div className="ec-thinking"><div className="ec-thinking-avatar"><img src={logo} alt="Eloria" /></div><div className="ec-thinking-dots"><span/><span/><span/></div></div>}
      </div>
    );
  };

  return (
    <div className="ec-root">
      <input ref={fileInputRef} type="file" multiple accept={[...SUPPORTED_EXTS].map(e => `.${e}`).join(",")} style={{ display:"none" }} onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple style={{ display:"none" }} onChange={handleFolderSelect} />
      {showWelcome && <EloriaCodeWelcome onDismiss={() => setShowWelcome(false)} userName={userName} />}

      <div className="ec-workspace">
        {/* LEFT — task/file list */}
        <aside className="ec-sidebar">
          <div className="ec-sidebar-top">
            <button className="ec-back-btn" onClick={() => { setActiveProject(null); setActiveFileId(null); setMessages([]); }} title="All projects">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="ec-sidebar-project-name">{activeProject.name}</span>
            <button className="ec-new-file-btn" onClick={() => setShowFileModal(true)} title="Add file">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>

          <div className="ec-file-list">
            {(activeProject.files || []).length === 0 ? (
              <div style={{ padding:"20px 12px", fontSize:11.5, color:"var(--t3)", textAlign:"center", lineHeight:1.7 }}>No files yet.<br />Add one to get started.</div>
            ) : (
              <>
                {renderFileSection(wipFiles, "In Progress", "in_progress")}
                {renderFileSection(doneFiles, "Ready", "done")}
                {renderFileSection(pendFiles, "Pending", "pending")}
              </>
            )}
          </div>

          <div className="ec-sidebar-bottom">
            <button className="ec-ask-eloria-btn" onClick={() => textareaRef.current?.focus()}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Ask Eloria
            </button>
          </div>
        </aside>

        {/* MIDDLE — plan / chat */}
        <main className="ec-chat">
          <div className="ec-chat-header">
            {activeFile ? (
              <>
                <span className="ec-chat-file-icon">{getFileIcon(activeFile.name)}</span>
                <span className="ec-chat-header-title">{activeFile.name}</span>
                <div style={{ position:"relative" }} ref={statusBtnRef}>
                  <button className="ec-status-btn" onClick={() => setShowStatusMenu(v => !v)}>
                    <span className={`ec-file-status-dot ${activeFile.status}`} style={{ width:5, height:5, marginTop:0 }} />
                    {FILE_STATUS_LABELS[activeFile.status]}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                  </button>
                  {showStatusMenu && (
                    <div className="ec-status-dropdown">
                      {Object.entries(FILE_STATUS_LABELS).map(([key, label]) => (
                        <button key={key} className="ec-status-option" onClick={() => updateFileStatus(activeFile.id, key)}>
                          <span className={`ec-file-status-dot ${key}`} style={{ marginTop:0 }} />
                          {label}
                          {activeFile.status === key && <svg style={{ marginLeft:"auto", width:10, height:10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {activeFile.code && (
                  <button className="ec-status-btn" onClick={() => downloadFile(activeFile.name, activeFile.code)} title="Download this file">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                )}
              </>
            ) : (
              <span className="ec-chat-header-title" style={{ color:"var(--t3)", fontFamily:"var(--ui)" }}>{activeProject.name}</span>
            )}
          </div>

          <div className="ec-body" ref={bodyRef}>{middleContent()}</div>

          {pendingAttachments.length > 0 && (
            <div style={{ background:"var(--bg)", borderTop:"1px solid var(--border)", paddingTop:4, paddingBottom:2 }}>
              <div className="ec-attach-strip">
                {pendingAttachments.map(att => (
                  <div key={att.id} className="ec-attach-chip">
                    <span className="ec-attach-chip-icon">{att.type === "folder" ? "📁" : getFileIcon(att.files[0]?.name || "")}</span>
                    <span className="ec-attach-chip-name">{att.name}</span>
                    <span style={{ fontSize:9.5, color:"var(--t3)", flexShrink:0 }}>{att.type === "folder" ? `${att.files.length}f` : formatBytes(att.files[0]?.size)}</span>
                    <button className="ec-attach-chip-remove" onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))}>✕</button>
                  </div>
                ))}
              </div>
              {limitHint && <div className="ec-attach-limit-note">{limitHint}</div>}
            </div>
          )}

          <div className="ec-input-wrap">
            <div className="ec-input-box">
              <div className="ec-input-toolbar">
                <button className={`ec-toolbar-btn${!canAddFile || !activeFile ? " disabled" : ""}`} onClick={() => canAddFile && activeFile && fileInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  Attach file {fileCount > 0 && <span style={{ background:"rgba(217,154,78,.15)", color:"var(--accent2)", borderRadius:4, padding:"0 4px", fontSize:9.5 }}>{fileCount}/2</span>}
                </button>
                <div className="ec-toolbar-sep" />
                <button className={`ec-toolbar-btn${!canAddFolder || !activeFile ? " disabled" : ""}`} onClick={() => canAddFolder && activeFile && folderInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  Attach folder
                </button>
                <div style={{ flex:1 }} />
                <span style={{ fontSize:9.5, color:"var(--t3)", opacity:.7 }}>js · ts · html · css · py · +more</span>
              </div>
              <div className="ec-textarea-row">
                <span className="ec-input-prefix">›</span>
                <textarea
                  ref={textareaRef}
                  className="ec-textarea"
                  rows={1}
                  value={input}
                  placeholder={
                    !activeFile ? "Select a file to start…" :
                    activeFile.status === "pending" ? `Build ${activeFile.name}…` :
                    pendingAttachments.length > 0 ? "Describe what to do with attached files…" :
                    `Ask about ${activeFile.name}…`
                  }
                  disabled={!activeFile}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                />
                <button
                  className="ec-send"
                  onClick={isThinking ? stopMessage : sendMessage}
                  disabled={(!isThinking && (!input.trim() && !pendingAttachments.length)) || !activeFile}
                  style={isThinking ? { background:"var(--danger)" } : {}}
                >
                  {isThinking
                    ? <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  }
                </button>
              </div>
            </div>
            <p className="ec-hint">Verify generated code before use · max 1 folder or 2 files per message</p>
          </div>

          <div className="ec-statusbar">
            <div className="ec-statusbar-item">
              <svg style={{ width:9, height:9 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              Eloria Code
            </div>
            {activeProject && <div className="ec-statusbar-item">⚡ {activeProject.name}</div>}
            {activeFile && <div className="ec-statusbar-item"><span className={`ec-file-status-dot ${activeFile.status}`} style={{ width:5, height:5, marginTop:0 }} />{activeFile.name}</div>}
            <div className="ec-statusbar-right">
              <div className="ec-statusbar-item">{doneFiles.length}/{(activeProject.files || []).length} ready</div>
              <div className="ec-statusbar-item">By Kairox</div>
            </div>
          </div>
        </main>

        {/* RIGHT — preview / code / files */}
        <aside className="ec-right">
          <div className="ec-right-header">
            <div className="ec-right-tabs">
              {[["preview","Preview"],["code","Code"],["files",`Files${activeProject?.files?.length ? ` (${activeProject.files.length})` : ""}`]].map(([tab, label]) => (
                <button key={tab} className={`ec-right-tab${rightTab === tab ? " active" : ""}`} onClick={() => setRightTab(tab)}>{label}</button>
              ))}
            </div>
          </div>
          <div className="ec-right-body">{rightContent()}</div>
        </aside>
      </div>

      {/* Limit modal */}
      {showLimitModal && (
        <div className="ec-limit-backdrop" onClick={() => setShowLimitModal(false)}>
          <div className="ec-limit-box" onClick={e => e.stopPropagation()}>
            <div className="ec-limit-top">
              <button className="ec-limit-close" onClick={() => setShowLimitModal(false)}>✕</button>
              <div className="ec-limit-icon">⏰</div>
              <div className="ec-limit-title">{userPlan === "pro" || userPlan === "admin" ? "Daily limit reached" : "Upgrade required"}</div>
              <div className="ec-limit-sub">{userPlan === "pro" || userPlan === "admin" ? "Resets at midnight · Pro plan" : "Eloria Code · Pro only"}</div>
            </div>
            <div className="ec-limit-body">
              <div className="ec-limit-desc">{userPlan === "pro" || userPlan === "admin" ? "You've used all your requests for today. Come back tomorrow." : "You've used all free requests. Upgrade to Pro for 25/day."}</div>
              <div className="ec-limit-actions">
                <button className="ec-limit-cancel" onClick={() => setShowLimitModal(false)}>{userPlan === "pro" || userPlan === "admin" ? "Got it" : "Later"}</button>
                {userPlan !== "pro" && userPlan !== "admin" && <button className="ec-limit-upgrade" onClick={() => { setShowLimitModal(false); window.close(); }}>Upgrade to Pro</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add file modal */}
      {showFileModal && (
        <div className="ec-modal-backdrop" onClick={() => setShowFileModal(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <div className="ec-modal-title"><div className="ec-modal-title-icon">📄</div>Add File</div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Filename</label>
              <input className="ec-modal-input" placeholder="e.g. index.html, styles.css, app.js" value={newFileName} autoFocus onChange={e => setNewFileName(e.target.value)} onKeyDown={e => e.key === "Enter" && createFile()} />
            </div>
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setShowFileModal(false)}>Cancel</button>
              <button className="ec-modal-create" onClick={createFile} disabled={!newFileName.trim()}>Add File</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
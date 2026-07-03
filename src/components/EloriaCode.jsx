import React, { useState, useEffect, useRef } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import logo from "../assets/logo.png";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";
import { invoke } from "@tauri-apps/api/core";

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const SUPPORTED_EXTS = new Set([
  "js","jsx","ts","tsx","mjs","cjs","html","htm","css","scss","sass","less",
  "json","jsonc","py","rb","php","go","rs","java","kt","swift","c","cpp","h","hpp",
  "cs","sh","bash","zsh","sql","graphql","md","mdx","txt","yaml","yml","toml",
  "env","ini","conf","vue","svelte","astro","xml","svg","dockerfile","makefile",
]);

function isSupportedFile(name) {
  const lower = name.toLowerCase();
  const knownNames = ["dockerfile","makefile",".gitignore",".env",".prettierrc",".eslintrc",".babelrc"];
  if (knownNames.some(n => lower === n || lower.endsWith("/" + n))) return true;
  const parts = lower.split(".");
  return parts.length >= 2 && SUPPORTED_EXTS.has(parts[parts.length - 1]);
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
  const ext = getExt(name);
  const map = { js:"⬡",jsx:"⬡",ts:"⬡",tsx:"⬡",html:"◈",htm:"◈",css:"◉",scss:"◉",
    json:"⊞",yaml:"⊞",yml:"⊞",py:"◆",rb:"◆",go:"◆",rs:"◆",md:"≡",txt:"≡",sql:"⊕",sh:"▸",bash:"▸" };
  return map[ext] || "◇";
}

function getMime(ext) {
  const map = { html:"text/html",css:"text/css",js:"text/javascript",jsx:"text/javascript",
    ts:"text/typescript",tsx:"text/typescript",json:"application/json",py:"text/x-python",md:"text/markdown" };
  return map[ext] || "text/plain";
}

function downloadFile(filename, code) {
  if (!code) return;
  const blob = new Blob([code], { type: getMime(getExt(filename)) + ";charset=utf-8" });
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
    }
  }
  return files;
}

function detectCodeBlocks(text) {
  const blocks = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const lang = match[1] || "txt";
    const code = match[2];
    const extMap = { javascript:"js",js:"js",typescript:"ts",python:"py",py:"py",
      css:"css",html:"html",jsx:"jsx",tsx:"tsx",bash:"sh",sh:"sh" };
    blocks.push({ lang, code, ext: extMap[lang.toLowerCase()] || "txt" });
  }
  return blocks;
}

// ─── FIRESTORE ─────────────────────────────────────────────────────────────
async function loadCodeChats(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().eloriaCodeChats || [];
}
async function saveCodeChats(uid, chats) {
  await setDoc(doc(db, "users", uid), { eloriaCodeChats: JSON.parse(JSON.stringify(chats)) }, { merge: true });
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const EC_STYLE = `
  .ecw-root {
    display: flex; flex-direction: column; height: 100dvh; overflow: hidden;
    background: #FBF6F0;
    font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0D3A35; font-size: 13px;
  }

  .ecw-topbar {
    height: 48px; min-height: 48px;
    display: flex; align-items: center; padding: 0 16px; gap: 10px;
    background: #FBF6F0; border-bottom: 1px solid #dde0d9;
    flex-shrink: 0; position: relative; z-index: 10;
  }
  .ecw-topbar-logo { width: 22px; height: 22px; border-radius: 6px; overflow: hidden; flex-shrink: 0; }
  .ecw-topbar-logo img { width: 100%; height: 100%; object-fit: contain; }
  .ecw-topbar-title { font-size: 13.5px; font-weight: 600; color: #0D3A35; letter-spacing: -.01em; }
  .ecw-topbar-sep { width: 1px; height: 16px; background: #dde0d9; }
  .ecw-topbar-badge {
    display: flex; align-items: center; gap: 5px;
    padding: 3px 10px; border-radius: 20px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,0.25);
    font-size: 11px; font-weight: 600; color: #276152; letter-spacing: .04em;
  }
  .ecw-topbar-badge svg { width: 9px; height: 9px; }
  .ecw-topbar-spacer { flex: 1; }

  .ecw-back-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 12px; border-radius: 8px;
    background: none; border: 1px solid #cdd0c9;
    font-size: 12px; font-weight: 600; color: #3a5a55;
    cursor: pointer; font-family: inherit; transition: all .13s;
  }
  .ecw-back-btn:hover { background: #eaf2ef; border-color: rgba(39,97,82,0.3); color: #276152; }
  .ecw-back-btn svg { width: 13px; height: 13px; flex-shrink: 0; }

  /* SHELL */
  .ecw-shell { flex: 1; display: flex; overflow: hidden; min-height: 0; }

  /* SIDEBAR */
  .ecw-sidebar {
    flex: 0 0 248px; max-width: 248px;
    background: #fdfaf6; border-right: 1px solid #dde0d9;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .ecw-sidebar-top {
    height: 54px; min-height: 54px; padding: 0 14px;
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #dde0d9; flex-shrink: 0;
  }
  .ecw-sidebar-title { font-size: 14px; font-weight: 600; color: #0D3A35; flex: 1; letter-spacing: -.01em; }
  .ecw-new-btn {
    width: 28px; height: 28px; border-radius: 8px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,0.25);
    color: #276152; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s; flex-shrink: 0;
  }
  .ecw-new-btn:hover { background: #d6ebe3; }

  .ecw-chat-list { flex: 1; overflow-y: auto; padding: 6px 8px; scrollbar-width: thin; scrollbar-color: #d8d4cc transparent; }
  .ecw-chat-list::-webkit-scrollbar { width: 3px; }
  .ecw-chat-list::-webkit-scrollbar-thumb { background: #d2cec8; border-radius: 2px; }

  .ecw-empty { padding: 28px 12px; font-size: 12.5px; color: #7a8a84; line-height: 1.7; text-align: center; }

  .ecw-chat-row {
    display: flex; align-items: center; gap: 6px;
    padding: 2px 4px 2px 8px; border-radius: 6px; margin-bottom: 1px;
    cursor: pointer; transition: background .12s;
    border-left: 2px solid transparent; position: relative;
  }
  .ecw-chat-row:hover { background: #f2ede7; }
  .ecw-chat-row.active { background: #eaf2ef; border-left-color: #276152; }
  .ecw-chat-row-icon { color: #7a8a84; flex-shrink: 0; display: flex; width: 22px; height: 22px; align-items: center; justify-content: center; }
  .ecw-chat-row-icon svg { width: 13px; height: 13px; }
  .ecw-chat-row.active .ecw-chat-row-icon { color: #276152; }
  .ecw-chat-row-info { flex: 1; min-width: 0; }
  .ecw-chat-row-title {
    font-size: 13px; color: #0D3A35; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; line-height: 1.4;
    padding: 7px 0;
  }
  .ecw-chat-row.active .ecw-chat-row-title { font-weight: 500; color: #1a4a3d; }
  .ecw-chat-row-sub { font-size: 10.5px; color: #7a8a84; margin-top: 1px; }

  /* row menu */
  .ecw-row-menu-btn {
    background: none; border: none; cursor: pointer; color: #7a8a84;
    font-size: 15px; padding: 3px 5px; border-radius: 4px; line-height: 1;
    opacity: 0; transition: opacity .12s, background .12s; flex-shrink: 0;
  }
  .ecw-chat-row:hover .ecw-row-menu-btn { opacity: 1; }
  .ecw-row-menu-btn:hover { background: #e8e4de; color: #0D3A35; }

  .ecw-row-dropdown {
    position: absolute; right: 0; top: calc(100% + 2px);
    background: #fdfaf6; border: 1px solid #cdd0c9;
    border-radius: 10px; box-shadow: 0 8px 32px rgba(13,58,53,0.14);
    z-index: 200; min-width: 140px; padding: 4px;
    animation: ecwDdIn .12s ease;
  }
  @keyframes ecwDdIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .ecw-row-dropdown button {
    display: flex; align-items: center; gap: 8px;
    width: 100%; text-align: left; padding: 7px 10px;
    font-size: 13px; color: #0D3A35; background: none; border: none;
    border-radius: 6px; cursor: pointer; font-family: inherit; transition: background .11s;
  }
  .ecw-row-dropdown button svg { width: 13px; height: 13px; flex-shrink: 0; color: #7a8a84; }
  .ecw-row-dropdown button:hover { background: #f0ece6; }
  .ecw-row-dropdown button.del { color: #c04040; }
  .ecw-row-dropdown button.del:hover { background: #fdf0f0; }
  .ecw-row-dropdown button.del svg { color: #c04040; }
  .ecw-row-dropdown-div { height: 1px; background: #dde0d9; margin: 3px 0; }

  .ecw-rename-input {
    flex: 1; font-size: 13px; padding: 4px 8px;
    border: 1.5px solid #276152; border-radius: 6px;
    background: #fff; color: #0D3A35; outline: none; font-family: inherit; margin: 4px 0;
  }

  /* MAIN */
  .ecw-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #FBF6F0; }

  .ecw-chat-header {
    height: 52px; min-height: 52px; padding: 0 20px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid #dde0d9; background: #FBF6F0; flex-shrink: 0;
  }
  .ecw-header-icon {
    width: 28px; height: 28px; border-radius: 8px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,0.2);
    display: flex; align-items: center; justify-content: center; color: #276152; flex-shrink: 0;
  }
  .ecw-header-title { font-size: 13.5px; font-weight: 600; color: #0D3A35; }
  .ecw-header-sub { font-size: 11px; color: #7a8a84; }

  /* BODY */
  .ecw-body {
    flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
    scrollbar-width: thin; scrollbar-color: #d8d4cc transparent;
    padding: 12px 0 8px;
  }
  .ecw-body::-webkit-scrollbar { width: 4px; }
  .ecw-body::-webkit-scrollbar-thumb { background: #d2cec8; border-radius: 2px; }

  @keyframes ecwFadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }

  /* WELCOME */
  .ecw-welcome {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 24px; padding: 40px 24px; text-align: center;
  }
  .ecw-welcome-emblem {
    width: 58px; height: 58px; border-radius: 17px;
    background: linear-gradient(145deg, #0d3a35 0%, #1d6152 100%);
    display: flex; align-items: center; justify-content: center; color: #fff;
    box-shadow: 0 4px 24px rgba(13,58,53,0.18);
  }
  .ecw-welcome-title { font-size: 21px; font-weight: 700; color: #0D3A35; letter-spacing: -.03em; line-height: 1.2; }
  .ecw-welcome-sub { font-size: 13px; color: #7a8a84; line-height: 1.65; max-width: 320px; }
  .ecw-welcome-chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 4px; }
  .ecw-welcome-chip {
    padding: 7px 14px; border-radius: 20px;
    background: #fff; border: 1px solid #cdd0c9;
    font-size: 12px; color: #3a5a55; cursor: pointer; transition: all .15s; font-family: inherit;
  }
  .ecw-welcome-chip:hover { background: #eaf2ef; border-color: rgba(39,97,82,0.35); color: #276152; }

  /* MESSAGES */
  .ecw-msg-row {
    display: flex; padding: 5px 20px; max-width: 780px; width: 100%; margin: 0 auto;
    animation: ecwFadeUp .2s ease;
  }
  .ecw-msg-row.user { justify-content: flex-end; }
  .ecw-msg-row.ai { justify-content: flex-start; gap: 8px; align-items: flex-end; }

  .ecw-avatar {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0; overflow: hidden;
    border: 1.5px solid rgba(39,97,82,0.2);
    background: #faf8f4; margin-bottom: 2px;
    display: flex; align-items: center; justify-content: center;
  }
  .ecw-avatar img { width: 100%; height: 100%; object-fit: contain; }

  .ecw-bubble-stack { display: flex; flex-direction: column; gap: 4px; max-width: min(82%, 680px); }
  .ecw-bubble-stack.user { align-items: flex-end; }
  .ecw-bubble-stack.ai { align-items: flex-start; }

  .ecw-bubble {
    padding: 10px 15px; border-radius: 18px;
    font-size: 13.5px; line-height: 1.6; word-break: break-word;
  }
  .ecw-msg-row.user .ecw-bubble {
    background: #276152; color: #fff; border-bottom-right-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,.15);
  }
  .ecw-msg-row.ai .ecw-bubble {
    background: transparent; color: #0D3A35;
    border: 1px solid #ececea; border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.05);
  }

  /* attached file chips on user messages */
  .ecw-file-chips { display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end; margin-bottom: 4px; }
  .ecw-file-chip {
    display: flex; align-items: center; gap: 5px; padding: 4px 9px 4px 7px;
    background: rgba(255,255,255,0.18); border: 1.5px solid rgba(255,255,255,0.3);
    border-radius: 8px; font-size: 11px; color: #fff; max-width: 180px;
  }
  .ecw-file-chip-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  /* generated file cards */
  .ecw-file-card {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px;
    background: #faf9f6; border: 1.5px solid #ececea;
    border-radius: 10px; margin-top: 6px; transition: border-color .15s;
  }
  .ecw-file-card:hover { border-color: rgba(39,97,82,0.35); }
  .ecw-file-card-icon {
    width: 28px; height: 28px; border-radius: 7px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,0.2);
    display: flex; align-items: center; justify-content: center; font-size: 11px; flex-shrink: 0;
    color: #276152;
  }
  .ecw-file-card-info { flex: 1; min-width: 0; }
  .ecw-file-card-name { font-size: 12px; font-weight: 600; color: #0D3A35; font-family: 'SF Mono',Consolas,monospace; }
  .ecw-file-card-meta { font-size: 10px; color: #7a8a84; margin-top: 1px; }
  .ecw-file-card-actions { display: flex; gap: 5px; flex-shrink: 0; }
  .ecw-file-card-btn {
    padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: all .15s; border: 1px solid;
  }
  .ecw-file-card-btn.copy { background: none; border-color: #cdd0c9; color: #7a8a84; }
  .ecw-file-card-btn.copy:hover { background: #f0ece6; color: #0D3A35; }
  .ecw-file-card-btn.dl { background: #eaf2ef; border-color: rgba(39,97,82,0.3); color: #276152; }
  .ecw-file-card-btn.dl:hover { background: #d6ebe3; }

  /* divider under AI messages */
  .ecw-msg-divider {
    display: flex; align-items: center; gap: 8px;
    padding: 0 20px; max-width: 780px; width: 100%; margin: 2px auto;
  }
  .ecw-msg-divider-line { flex: 1; height: 1px; background: linear-gradient(to right, rgba(13,58,53,0.12), transparent); }
  .ecw-msg-divider-line.rev { background: linear-gradient(to left, rgba(13,58,53,0.12), transparent); }
  .ecw-msg-divider-btn {
    font-size: 10px; color: #7a8a84; background: none; border: none;
    cursor: pointer; padding: 0 2px; font-family: inherit; transition: color .12s;
    display: flex; align-items: center; gap: 3px;
  }
  .ecw-msg-divider-btn:hover { color: #0D3A35; }
  .ecw-msg-time { font-size: 10px; color: #7a8a84; letter-spacing: .02em; }

  /* thinking */
  .ecw-thinking {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 20px; max-width: 780px; width: 100%; margin: 0 auto;
  }
  .ecw-thinking-dots { display: flex; gap: 4px; }
  .ecw-thinking-dots span {
    width: 6px; height: 6px; border-radius: 50%; background: #276152;
    opacity: .4; animation: ecwDot 1.2s ease-in-out infinite;
  }
  .ecw-thinking-dots span:nth-child(2) { animation-delay: .2s; }
  .ecw-thinking-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes ecwDot { 0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)} }
  .ecw-thinking-label { font-size: 13px; color: #7a8a84; font-style: italic; }

  /* pending attach strip */
  .ecw-pending-strip {
    display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 16px 4px;
    max-width: 720px; margin: 0 auto; width: 100%;
  }
  .ecw-pending-chip {
    display: flex; align-items: center; gap: 6px; padding: 6px 10px 6px 8px;
    background: #faf8f3; border: 1.5px solid rgba(39,97,82,0.2);
    border-radius: 10px; font-size: 11px; color: #3a5a55; max-width: 200px;
    animation: ecwFadeUp .15s ease;
  }
  .ecw-pending-chip-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; font-weight: 600; color: #0D3A35; }
  .ecw-pending-chip-meta { font-size: 9.5px; color: #7a8a84; flex-shrink: 0; }
  .ecw-pending-chip-remove {
    width: 16px; height: 16px; border: none; background: none;
    color: #7a8a84; cursor: pointer; font-size: 10px;
    display: flex; align-items: center; justify-content: center; border-radius: 50%; padding: 0;
    transition: color .1s, background .1s; flex-shrink: 0;
  }
  .ecw-pending-chip-remove:hover { color: #c04040; background: #fef2f2; }

  /* desktop warning banner */
  .ecw-desktop-banner {
    margin: 8px 16px 0; padding: 10px 14px; border-radius: 10px;
    background: #fff8f0; border: 1px solid rgba(193,127,42,.25);
    font-size: 12px; color: #a07040; display: flex; align-items: center; gap: 8px;
    max-width: 720px; margin-left: auto; margin-right: auto; width: calc(100% - 32px);
  }
  .ecw-desktop-banner svg { flex-shrink: 0; width: 14px; height: 14px; }

  /* INPUT */
  .ecw-input-wrap {
    flex-shrink: 0; padding: 8px 16px 14px; background: #FBF6F0;
    border-top: 1px solid #dde0d9;
  }
  .ecw-input-box {
    max-width: 720px; margin: 0 auto;
    background: #fafaf8; border: 1.5px solid #cdd0c9;
    border-radius: 18px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }
  .ecw-input-box:focus-within {
    border-color: rgba(13,58,53,.35);
    box-shadow: 0 0 0 3px rgba(13,58,53,.07), 0 2px 12px rgba(0,0,0,.06);
    background: #fff;
  }
  .ecw-textarea-row { display: flex; align-items: flex-end; gap: 8px; }
  .ecw-textarea {
    flex: 1; border: none; background: none; outline: none;
    font-family: inherit; font-size: 14px; color: #0D3A35;
    resize: none; min-height: 22px; max-height: 120px; line-height: 1.55;
    overflow-y: auto; scrollbar-width: thin; caret-color: #276152;
  }
  .ecw-textarea::placeholder { color: #7a8a84; }

  /* attach */
  .ecw-attach { position: relative; flex-shrink: 0; }
  .ecw-attach-btn {
    width: 32px; height: 32px; border: none; border-radius: 50%;
    background: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #7a8a84; transition: background .12s, color .12s;
  }
  .ecw-attach-btn:hover { background: #f0ede6; color: #276152; }
  .ecw-attach-btn.has-files { color: #276152; }
  .ecw-attach-btn svg { width: 17px; height: 17px; }

  .ecw-attach-menu {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    background: #fff; border: 1px solid #e8e6e0;
    border-radius: 14px; box-shadow: 0 8px 30px rgba(13,58,53,0.12);
    padding: 5px; min-width: 168px; z-index: 200;
    animation: ecwMenuIn .12s ease;
  }
  @keyframes ecwMenuIn { from{opacity:0;transform:translateY(6px) scale(.97)} to{opacity:1;transform:translateY(0) scale(1)} }
  .ecw-attach-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; font-size: 13px; color: #0D3A35;
    border-radius: 10px; cursor: pointer;
    transition: background .11s; font-family: inherit; font-weight: 500;
  }
  .ecw-attach-menu-item:hover { background: #faf7f2; color: #276152; }
  .ecw-attach-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
  .ecw-attach-menu-sep { height: 1px; background: #f0ede8; margin: 3px 8px; }
  .ecw-attach-menu-limit { font-size: 10px; color: #7a8a84; padding: 4px 12px 5px; }

  .ecw-send {
    width: 34px; height: 34px; border-radius: 50%;
    background: #0d3a35; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff; transition: opacity .13s, box-shadow .13s, transform .1s;
  }
  .ecw-send:hover:not(:disabled) { opacity: .88; box-shadow: 0 3px 14px rgba(13,58,53,.35); transform: scale(1.05); }
  .ecw-send:disabled { opacity: .3; cursor: default; }
  .ecw-send svg { width: 15px; height: 15px; }
  .ecw-hint { text-align: center; font-size: 11px; color: #7a8a84; margin-top: 6px; max-width: 720px; margin-left: auto; margin-right: auto; }
`;

// ─── ROOT ─────────────────────────────────────────────────────────────────────
function getTimestamp() {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function EloriaCode({ onBack }) {
  const [uid, setUid] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const isDesktopApp = typeof window !== "undefined" && !!window.__TAURI__;

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [copiedId, setCopiedId] = useState(null);
  const [showAttach, setShowAttach] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);

  const bodyRef = useRef(null);
  const textareaRef = useRef(null);
  const attachRef = useRef(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUid(u?.uid || null);
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!document.getElementById("eloria-ecw-v2")) {
      const tag = document.createElement("style");
      tag.id = "eloria-ecw-v2";
      tag.textContent = EC_STYLE;
      document.head.appendChild(tag);
    }
    ["eloria-ecw-v1"].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  }, []);

  useEffect(() => {
    if (!uid) { setLoaded(true); return; }
    loadCodeChats(uid).then(c => {
      setChats(c);
      if (c.length > 0) setActiveChatId(c[0].id);
      setLoaded(true);
    });
  }, [uid]);

  useEffect(() => {
    if (!uid || !loaded) return;
    saveCodeChats(uid, chats);
  }, [chats, uid, loaded]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [chats, activeChatId, isThinking]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    const h = e => {
      if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttach(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Close row menu on outside click — but NOT if clicking a button inside the row
  useEffect(() => {
    const h = e => {
      if (!e.target.closest(".ecw-row-dropdown") && !e.target.closest(".ecw-row-menu-btn")) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const activeChat = chats.find(c => c.id === activeChatId) || null;
  const hasVideo = pendingFiles.some(f => f.kind === "video");
  const canAddMore = pendingFiles.length < 4;

  const newChat = () => {
    const chat = { id: Date.now(), title: "New Chat", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setChats(prev => [chat, ...prev]);
    setActiveChatId(chat.id);
    setInput(""); setPendingFiles([]);
  };

  const deleteChat = (chatId) => {
    setOpenMenuId(null);
    const remaining = chats.filter(c => c.id !== chatId);
    setChats(remaining);
    if (activeChatId === chatId) setActiveChatId(remaining[0]?.id || null);
  };

  const renameChat = (chatId, val) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: val || c.title, renameOpen: false } : c));
  };

  const readAsText = (file) => new Promise(resolve => {
    const r = new FileReader();
    r.onload = e => resolve(e.target.result);
    r.onerror = () => resolve("[could not read]");
    r.readAsText(file);
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    const toAdd = files.slice(0, 4 - pendingFiles.length);
    const added = await Promise.all(toAdd.map(async f => ({
      id: Date.now() + Math.random(), kind: "file", name: f.name, size: f.size,
      content: await readAsText(f),
    })));
    setPendingFiles(prev => [...prev, ...added]);
    setShowAttach(false);
  };

  const handleFolderSelect = async (e) => {
    const all = Array.from(e.target.files || []); e.target.value = "";
    const supported = all.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported code files found."); return; }
    const folderName = (supported[0].webkitRelativePath || supported[0].name).split("/")[0];
    const af = await Promise.all(supported.map(async f => ({
      name: f.name, relativePath: f.webkitRelativePath || f.name, size: f.size,
      content: await readAsText(f),
    })));
    setPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), kind: "folder", name: folderName, files: af }]);
    setShowAttach(false);
  };

  const handleVideoSelect = (e) => {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    setPendingFiles(prev => [...prev, { id: Date.now() + Math.random(), kind: "video", name: file.name, size: file.size, file }]);
    setShowAttach(false);
  };

  const handleDocSelect = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    const toAdd = files.slice(0, 4 - pendingFiles.length);
    const added = toAdd.map(f => ({ id: Date.now() + Math.random(), kind: "doc", name: f.name, size: f.size }));
    setPendingFiles(prev => [...prev, ...added]);
    setShowAttach(false);
  };

  // ── Robust ffmpeg args extractor ──────────────────────────────────────────
  const extractFfmpegArgs = (text) => {
    // Strip all markdown fences and "Copy" artifacts first
    const clean = text
      .replace(/```[\w\s]*\n?/g, "")   // opening fences
      .replace(/```/g, "")              // closing fences
      .replace(/\bCopy\b/g, "")        // stray "Copy" text
      .trim();

    // Try parsing entire cleaned text as JSON
    try {
      const parsed = JSON.parse(clean);
      if (parsed.args && Array.isArray(parsed.args)) return parsed.args;
    } catch {}

    // Find the args array directly via regex (most reliable)
    const match = clean.match(/"args"\s*:\s*(\[[\s\S]*?\])/);
    if (match) {
      try { return JSON.parse(match[1]); } catch {}
    }

    // Find any JSON object containing "args"
    const objMatch = clean.match(/\{[\s\S]*?"args"\s*:[\s\S]*?\}/);
    if (objMatch) {
      try {
        const parsed = JSON.parse(objMatch[0]);
        if (parsed.args) return parsed.args;
      } catch {}
    }

    return null;
  };

  const sendMessage = async () => {
    const hasText = input.trim().length > 0;
    if (!hasText && pendingFiles.length === 0) return;
    if (isThinking) return;
    if (!auth.currentUser) return;

    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const token = await auth.currentUser.getIdToken();

    let chatId = activeChatId;
    let workingChats = chats;
    if (!chatId) {
      const chat = { id: Date.now(), title: input.trim().slice(0, 40) || pendingFiles[0]?.name || "New Chat", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      workingChats = [chat, ...chats];
      chatId = chat.id;
      setActiveChatId(chatId);
      setChats(workingChats);
    }

    const userText = input.trim();
    const capturedFiles = [...pendingFiles];
    const videoFile = capturedFiles.find(f => f.kind === "video");

    // Block video editing in browser
    if (videoFile && !isDesktopApp) {
      // Still send to AI for a general response, but won't run ffmpeg
    }

    let attachCtx = "";
    for (const f of capturedFiles) {
      if (f.kind === "folder") {
        attachCtx += `\n\n[FOLDER: "${f.name}" — ${f.files.length} files]\n`;
        attachCtx += f.files.map(ff => `--- ${ff.relativePath || ff.name} ---\n${ff.content}\n`).join("\n");
      } else if (f.kind === "file") {
        attachCtx += `\n\n[FILE: "${f.name}"]\n${f.content}\n`;
      } else if (f.kind === "video") {
        attachCtx += `\n\n[VIDEO FILE: "${f.name}" — user wants to edit this video]`;
      } else if (f.kind === "doc") {
        attachCtx += `\n\n[DOCUMENT: "${f.name}"]`;
      }
    }

    const userMsg = {
      id: Date.now() + 1, sender: "user",
      text: userText,
      files: capturedFiles.map(f => ({ id: f.id, name: f.name, kind: f.kind, size: f.size })),
      time: getTimestamp(),
    };

    const prevMsgs = workingChats.find(c => c.id === chatId)?.messages || [];
    const newMsgs = [...prevMsgs, userMsg];
    const isFirst = prevMsgs.length === 0;

    setChats(prev => prev.map(c => c.id !== chatId ? c : {
      ...c,
      title: isFirst ? (userText || capturedFiles[0]?.name || "New Chat").slice(0, 40) : c.title,
      messages: newMsgs, updatedAt: new Date().toISOString(),
    }));
    setInput(""); setPendingFiles([]);
    setIsThinking(true);

    const finalPrompt = videoFile && !userText
      ? `[VIDEO FILE: "${videoFile.name}" attached]\nThe user has attached a video but hasn't described what they want to do with it yet. Ask them what edit or operation they'd like — e.g. trim, compress, extract audio, add subtitles, convert format, speed up, slow down, add watermark. Be brief and friendly.`
      : (attachCtx + (userText ? `\n\n${userText}` : "")).trim();

    const sysCtx = videoFile
      ? `You are Eloria Code, an AI video editing assistant. When the user describes a video edit, respond ONLY with a raw JSON object on a single line, no markdown fences, no explanation before it: {"args": ["-i", "input.mp4", ...other_args..., "output.mp4"]}. The args array contains ffmpeg arguments without the "ffmpeg" prefix. After the JSON, you may add a brief plain-text explanation.`
      : `You are Eloria Code, an expert coding AI. When generating code files, always wrap each in a fenced block with the filename: \`\`\`lang filename.ext\n...\n\`\`\`. Be concise and generate complete, production-ready code.`;

    const apiMessages = [
      { role: "user", content: sysCtx },
      { role: "assistant", content: "Understood." },
      ...newMsgs.slice(0, -1).map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text || "" })),
      { role: "user", content: finalPrompt },
    ];

    try {
      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      });

      if (res.status === 429) {
        setChats(prev => prev.map(c => c.id !== chatId ? c : {
          ...c, messages: [...c.messages, { id: Date.now()+2, sender: "ai", text: "You've hit your daily limit. Come back tomorrow or upgrade to Pro.", time: getTimestamp() }],
          updatedAt: new Date().toISOString(),
        }));
        setIsThinking(false); return;
      }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiMsgId = Date.now() + 2;

      setChats(prev => prev.map(c => c.id !== chatId ? c : {
        ...c, messages: [...c.messages, { id: aiMsgId, sender: "ai", text: "", time: getTimestamp() }],
        updatedAt: new Date().toISOString(),
      }));
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
              const snap = aiText;
              setChats(prev => prev.map(c => c.id !== chatId ? c : {
                ...c, messages: c.messages.map(m => m.id === aiMsgId ? { ...m, text: snap } : m),
              }));
            }
          } catch {}
        }
      }

      // Run ffmpeg only on desktop
      if (videoFile && isDesktopApp) {
        const args = extractFfmpegArgs(aiText);
        if (args && Array.isArray(args)) {
          try {
            const output = await invoke("run_ffmpeg", { args });
            const outputPath = args[args.length - 1];
            setChats(prev => prev.map(c => c.id !== chatId ? c : {
              ...c, messages: [...c.messages, { id: Date.now()+3, sender: "ai", text: `✓ Done! Output saved to:\n\`\`\`\n${outputPath || output}\n\`\`\``, time: getTimestamp() }],
              updatedAt: new Date().toISOString(),
            }));
          } catch (ffErr) {
            setChats(prev => prev.map(c => c.id !== chatId ? c : {
              ...c, messages: [...c.messages, { id: Date.now()+3, sender: "ai", text: `ffmpeg error: ${ffErr}`, time: getTimestamp() }],
              updatedAt: new Date().toISOString(),
            }));
          }
        }
      }

      // Parse generated code files
      const parsedFiles = parseFilesFromAI(aiText);
      if (parsedFiles.length > 0) {
        setChats(prev => prev.map(c => c.id !== chatId ? c : {
          ...c, messages: c.messages.map(m => m.id === aiMsgId
            ? { ...m, generatedFiles: parsedFiles.map(f => ({ name: f.name, code: f.code, lines: f.code.split("\n").length })) }
            : m),
        }));
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setIsThinking(false);
        setChats(prev => prev.map(c => c.id !== chatId ? c : {
          ...c, messages: [...c.messages, { id: Date.now()+2, sender: "ai", text: `Error: ${err.message}`, time: getTimestamp() }],
          updatedAt: new Date().toISOString(),
        }));
      }
      setIsThinking(false);
    }
  };

  const IconCode = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );

  const WELCOME_PROMPTS = [
    "Build a landing page", "Write a Python script", "Create a REST API",
    "Trim a video to 30s", "Fix bugs in my code", "Convert video to GIF",
  ];

  if (!authReady) return null;
  if (!uid) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", background:"#FBF6F0", fontFamily:"sans-serif", fontSize:13, color:"#7a8a84" }}>
      Please log in to use Eloria Code.
    </div>
  );

  return (
    <div className="ecw-root">
      <input ref={fileInputRef} type="file" multiple accept={[...SUPPORTED_EXTS].map(e => `.${e}`).join(",")} style={{ display:"none" }} onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple style={{ display:"none" }} onChange={handleFolderSelect} />
      <input ref={videoInputRef} type="file" accept="video/mp4,video/mov,video/avi,video/mkv,video/webm,video/m4v,video/x-flv,video/wmv,video/mp2t" style={{ display:"none" }} onChange={handleVideoSelect} />
      <input ref={docInputRef} type="file" multiple accept=".pdf,.doc,.docx,.txt" style={{ display:"none" }} onChange={handleDocSelect} />

      {/* Topbar */}
      <div className="ecw-topbar">
        <div className="ecw-topbar-logo"><img src={logo} alt="Eloria" /></div>
        <span className="ecw-topbar-title">Eloria</span>
        <div className="ecw-topbar-sep" />
        <div className="ecw-topbar-badge"><IconCode />Code</div>
        <div className="ecw-topbar-spacer" />
        {onBack && (
          <button className="ecw-back-btn" onClick={onBack}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Chat
          </button>
        )}
      </div>

      <div className="ecw-shell">
        {/* Sidebar */}
        <aside className="ecw-sidebar">
          <div className="ecw-sidebar-top">
            <span className="ecw-sidebar-title">Chats</span>
            <button className="ecw-new-btn" onClick={newChat} title="New chat">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>
          <div className="ecw-chat-list">
            {chats.length === 0
              ? <div className="ecw-empty">No chats yet.<br/>Start one below.</div>
              : chats.map(chat => (
                <div
                  key={chat.id}
                  className={`ecw-chat-row${chat.id === activeChatId ? " active" : ""}`}
                  onClick={() => { setActiveChatId(chat.id); setOpenMenuId(null); }}
                >
                  <span className="ecw-chat-row-icon"><IconCode /></span>
                  <div className="ecw-chat-row-info">
                    {chat.renameOpen ? (
                      <input
                        className="ecw-rename-input"
                        defaultValue={chat.title}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                        onBlur={e => renameChat(chat.id, e.target.value.trim())}
                        onKeyDown={e => {
                          if (e.key === "Enter") renameChat(chat.id, e.target.value.trim());
                          if (e.key === "Escape") setChats(prev => prev.map(c => c.id === chat.id ? { ...c, renameOpen: false } : c));
                        }}
                      />
                    ) : (
                      <div className="ecw-chat-row-title">{chat.title || "New Chat"}</div>
                    )}
                  </div>
                  <button
                    className="ecw-row-menu-btn"
                    onClick={e => { e.stopPropagation(); setOpenMenuId(prev => prev === chat.id ? null : chat.id); }}
                  >⋯</button>
                  {openMenuId === chat.id && (
                    <div className="ecw-row-dropdown" onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); setChats(prev => prev.map(c => c.id === chat.id ? { ...c, renameOpen: true } : c)); setOpenMenuId(null); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Rename
                      </button>
                      <div className="ecw-row-dropdown-div" />
                      <button className="del" onClick={e => { e.stopPropagation(); deleteChat(chat.id); }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))
            }
          </div>
        </aside>

        {/* Main */}
        <main className="ecw-main">
          <div className="ecw-chat-header">
            <div className="ecw-header-icon"><IconCode /></div>
            <div>
              <div className="ecw-header-title">{activeChat?.title || "Eloria Code"}</div>
              <div className="ecw-header-sub">Code · Video · General — attach files to get started</div>
            </div>
          </div>

          <div className="ecw-body" ref={bodyRef}>
            {!activeChat || activeChat.messages.length === 0 ? (
              <div className="ecw-welcome">
                <div className="ecw-welcome-emblem"><IconCode /></div>
                <div>
                  <div className="ecw-welcome-title">What are we building?</div>
                  <div className="ecw-welcome-sub" style={{ marginTop: 8 }}>
                    Ask anything, generate code, or attach a video to edit it. One window, everything.
                  </div>
                </div>
                <div className="ecw-welcome-chips">
                  {WELCOME_PROMPTS.map(p => (
                    <button key={p} className="ecw-welcome-chip" onClick={() => {
                      if (!activeChatId) newChat();
                      setTimeout(() => { setInput(p); textareaRef.current?.focus(); }, 50);
                    }}>{p}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {activeChat.messages.map(msg => {
                  if (msg.sender === "user") {
                    return (
                      <div key={msg.id} className="ecw-msg-row user">
                        <div className="ecw-bubble-stack user">
                          {msg.files?.length > 0 && (
                            <div className="ecw-file-chips">
                              {msg.files.map(f => (
                                <div key={f.id} className="ecw-file-chip">
                                  <span>{f.kind === "folder" ? "" : f.kind === "video" ? "" : f.kind === "doc" ? "" : getFileIcon(f.name)}</span>
                                  <span className="ecw-file-chip-name">{f.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {msg.text && <div className="ecw-bubble">{msg.text}</div>}
                        </div>
                      </div>
                    );
                  }
                  const blocks = detectCodeBlocks(msg.text || "");
                  return (
                    <React.Fragment key={msg.id}>
                      <div className="ecw-msg-row ai">
                        <div className="ecw-avatar"><img src={logo} alt="Eloria" /></div>
                        <div className="ecw-bubble-stack ai">
                          <div className="ecw-bubble"><MarkdownMessage content={msg.text || ""} /></div>
                          {msg.generatedFiles?.map((file, fi) => (
                            <div key={fi} className="ecw-file-card">
                              <div className="ecw-file-card-icon">{getFileIcon(file.name)}</div>
                              <div className="ecw-file-card-info">
                                <div className="ecw-file-card-name">{file.name}</div>
                                <div className="ecw-file-card-meta">{file.lines} lines · {getExt(file.name).toUpperCase()}</div>
                              </div>
                              <div className="ecw-file-card-actions">
                                <button className="ecw-file-card-btn copy" onClick={() => { navigator.clipboard.writeText(file.code); setCopiedId(`${msg.id}-${fi}`); setTimeout(() => setCopiedId(null), 2000); }}>
                                  {copiedId === `${msg.id}-${fi}` ? "✓" : "Copy"}
                                </button>
                                <button className="ecw-file-card-btn dl" onClick={() => downloadFile(file.name, file.code)}>↓ Download</button>
                              </div>
                            </div>
                          ))}
                          {!msg.generatedFiles?.length && blocks.map((block, i) => (
                            <div key={i} style={{ display:"flex", gap:6, marginTop:4 }}>
                              <button onClick={() => { navigator.clipboard.writeText(block.code); setCopiedId(`${msg.id}-b${i}`); setTimeout(() => setCopiedId(null), 2000); }}
                                style={{ padding:"5px 12px", background:"none", border:"1px solid #cdd0c9", borderRadius:8, fontSize:11.5, fontWeight:600, cursor:"pointer", color:"#7a8a84", fontFamily:"inherit", transition:"all .12s" }}>
                                {copiedId === `${msg.id}-b${i}` ? "✓ Copied" : "Copy"}
                              </button>
                              <button onClick={() => { const blob = new Blob([block.code], {type:"text/plain"}); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href=u; a.download=`eloria-code.${block.ext}`; a.click(); URL.revokeObjectURL(u); }}
                                style={{ padding:"5px 12px", background:"#eaf2ef", border:"1px solid rgba(39,97,82,0.3)", borderRadius:8, fontSize:11.5, fontWeight:600, cursor:"pointer", color:"#276152", fontFamily:"inherit" }}>
                                ↓ {block.lang}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="ecw-msg-divider">
                        <div className="ecw-msg-divider-line" />
                        <span className="ecw-msg-time">{msg.time}</span>
                        <button className="ecw-msg-divider-btn" onClick={() => { navigator.clipboard.writeText(msg.text || ""); setCopiedId(msg.id); setTimeout(() => setCopiedId(null), 2000); }}>
                          {copiedId === msg.id ? "✓ copied" : (
                            <><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{width:10,height:10}}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>copy</>
                          )}
                        </button>
                        <div className="ecw-msg-divider-line rev" />
                      </div>
                    </React.Fragment>
                  );
                })}
                {isThinking && (
                  <div className="ecw-thinking">
                    <div className="ecw-avatar"><img src={logo} alt="Eloria" /></div>
                    <div className="ecw-thinking-dots"><span/><span/><span/></div>
                    <span className="ecw-thinking-label">thinking…</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Desktop-only banner for video in browser */}
          {hasVideo && !isDesktopApp && (
            <div className="ecw-desktop-banner">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Video editing runs shell commands and requires the Eloria desktop app. You'll get the ffmpeg command but it won't execute here.
            </div>
          )}

          {pendingFiles.length > 0 && (
            <div style={{ background:"#FBF6F0", borderTop:"1px solid #dde0d9", paddingTop:4, paddingBottom:2 }}>
              <div className="ecw-pending-strip">
                {pendingFiles.map(f => (
                  <div key={f.id} className="ecw-pending-chip">
                    <span style={{ fontSize:12 }}>{f.kind === "folder" ? "📁" : f.kind === "video" ? "🎬" : f.kind === "doc" ? "📄" : getFileIcon(f.name)}</span>
                    <span className="ecw-pending-chip-name">{f.name}</span>
                    <span className="ecw-pending-chip-meta">{f.kind === "folder" ? `${f.files?.length}f` : formatBytes(f.size)}</span>
                    <button className="ecw-pending-chip-remove" onClick={() => setPendingFiles(prev => prev.filter(x => x.id !== f.id))}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="ecw-input-wrap">
            <div className="ecw-input-box">
              <div className="ecw-textarea-row">
                <div className="ecw-attach" ref={attachRef}>
                  <button className={`ecw-attach-btn${pendingFiles.length > 0 ? " has-files" : ""}`} onClick={() => setShowAttach(v => !v)} title="Attach">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                    </svg>
                  </button>
                  {showAttach && (
                    <div className="ecw-attach-menu">
                      {!canAddMore && <div className="ecw-attach-menu-limit">Max 4 attachments</div>}
                      {canAddMore && (<>
                        <div className="ecw-attach-menu-item" onClick={() => fileInputRef.current?.click()}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                          Code File
                          <span style={{marginLeft:"auto",fontSize:10,color:"#7a8a84"}}>js · py · html</span>
                        </div>
                        <div className="ecw-attach-menu-item" onClick={() => folderInputRef.current?.click()}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                          Folder
                        </div>
                        <div className="ecw-attach-menu-sep" />
                        <div className="ecw-attach-menu-item" onClick={() => videoInputRef.current?.click()}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
                          Video
                          <span style={{marginLeft:"auto",fontSize:10,color:"#7a8a84"}}>mp4 · mov</span>
                        </div>
                        <div className="ecw-attach-menu-item" onClick={() => docInputRef.current?.click()}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          Document
                          <span style={{marginLeft:"auto",fontSize:10,color:"#7a8a84"}}>pdf · doc</span>
                        </div>
                      </>)}
                    </div>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  className="ecw-textarea"
                  rows={1}
                  value={input}
                  placeholder={
                    hasVideo
                      ? `What do you want to do with ${pendingFiles.find(f => f.kind === "video")?.name}?`
                      : pendingFiles.length > 0
                      ? "Describe what to do with these files…"
                      : "Message Eloria Code…"
                  }
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={isThinking}
                />
                <button
                  className="ecw-send"
                  onClick={isThinking ? () => { abortRef.current?.abort(); setIsThinking(false); } : sendMessage}
                  disabled={!isThinking && !input.trim() && pendingFiles.length === 0}
                  style={isThinking ? { background:"rgba(192,64,64,0.15)", color:"#c04040", border:"1px solid rgba(192,64,64,0.3)" } : {}}
                >
                  {isThinking
                    ? <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  }
                </button>
              </div>
            </div>
            <p className="ecw-hint">Eloria Code · verify generated code before use</p>
          </div>
        </main>
      </div>
    </div>
  );
}
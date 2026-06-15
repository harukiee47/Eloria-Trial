import React, { useState, useEffect, useRef, useMemo } from "react";
import logo from "../assets/logo.png";
import { auth } from "../services/firebase";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";


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
    PDF: { bg: "#fff1f1", color: "#e53e3e", char: "PDF" },
    TXT: { bg: "#f0f4ff", color: "#4a6cf7", char: "TXT" },
    DOC: { bg: "#eff6ff", color: "#2563eb", char: "DOC" },
    DOCX: { bg: "#eff6ff", color: "#2563eb", char: "DOC" },
  };
  return map[ext] || { bg: "#f5f5f0", color: "#888", char: ext.slice(0,3) };
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

  /* ── BODY ────────────────────────────────────────────── */
  .cw-body {
    flex: 1; min-height: 0;
    overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #e0e0da transparent;
  }
  @media(max-width: 640px) { .cw-body { padding-bottom: 120px; } }
  .cw-body::-webkit-scrollbar       { width: 5px; }
  .cw-body::-webkit-scrollbar-thumb { background: #ddddd8; border-radius: 3px; }

  /* ── INTRO ───────────────────────────────────────────── */
  .cw-intro {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 40px 24px 20px; gap: 28px;
    animation: cwFadeUp .35s ease;
  }
  @keyframes cwFadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @media(max-width: 640px) { .cw-intro { padding: 24px 14px 14px; gap: 18px; } }

  .cw-intro-logo {
    width:52px; height:52px; border-radius:14px; overflow:hidden;
    box-shadow:0 4px 20px rgba(193,127,42,.2); flex-shrink:0;
  }
  .cw-intro-logo img { width:100%; height:100%; object-fit:contain; }

  .cw-intro-text { display:flex; flex-direction:column; align-items:center; gap:10px; }
  .cw-intro-headline {
    font-size: clamp(18px, 4vw, 28px);
    font-weight: 700; color: var(--t1);
    text-align: center; line-height: 1.3; letter-spacing:-.025em;
  }
  .cw-intro-sub { font-size: 13px; color: var(--t3); text-align: center; line-height: 1.5; }

  .cw-cards {
    display: flex; flex-wrap: wrap; gap: 8px;
    justify-content: center; max-width: 560px; width: 100%;
  }
  .cw-card {
    flex: 1 1 140px; max-width: 210px;
    padding: 11px 13px;
    background: #faf9f6; border: 1px solid var(--border);
    border-radius: var(--r-md);
    font-size: 13px; color: var(--t2); cursor: pointer;
    line-height: 1.4;
    transition: background .13s, border-color .13s, transform .13s, box-shadow .13s;
    font-family: var(--font); text-align: left;
  }
  .cw-card:hover {
    background:#fff; border-color:rgba(193,127,42,.4);
    transform:translateY(-2px); color:var(--t1);
    box-shadow: 0 4px 16px rgba(193,127,42,.1);
  }
  .cw-card-icon { font-size:16px; margin-bottom:6px; display:block; }
  @media(max-width: 640px) {
    .cw-card { flex: 1 1 calc(50% - 4px); max-width: none; font-size: 12px; padding: 10px 12px; }
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

  /* AI avatar */
  .cw-ai-avatar {
    width: 28px; height: 28px; border-radius: 8px; overflow: hidden;
    flex-shrink: 0; border: 1.5px solid rgba(193,127,42,.2);
    background: #faf8f4; margin-bottom: 2px;
  }
  .cw-ai-avatar img { width:100%; height:100%; object-fit:contain; }
  @media(max-width: 640px) {
    .cw-ai-avatar { width: 24px; height: 24px; border-radius: 6px; }
  }

  /* Bubble wrapper */
  .cw-bubble-stack {
    display: flex; flex-direction: column; gap: 4px;
    max-width: min(88%, 720px);
    align-items: flex-end;
  }
  .cw-bubble-stack.ai { align-items: flex-start; }
  @media(max-width: 640px) {
    .cw-bubble-stack { max-width: min(92%, 100%); }
  }

  /* Text bubble */
  .cw-bubble {
    padding: 10px 15px;
    font-size: 14px; line-height: 1.5;
    word-break: break-word;
    border-radius: 18px;
    font-family: var(--font);
  }
  @media(max-width: 640px) {
    .cw-bubble { font-size: 13.5px; padding: 9px 13px; }
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

  /* Timestamp */
  .cw-msg-time {
    font-size: 10px; color: var(--t3);
    padding: 0 4px;
    letter-spacing: .02em;
  }
  .cw-msg-row.user .cw-msg-time { text-align: right; }

  /* AI message divider row */
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

  /* ── THINKING ────────────────────────────────────────── */
  .cw-thinking {
    display:flex; align-items:center; gap:10px;
    padding: 5px 20px; max-width:780px; width:100%; margin:0 auto;
  }
  @media(max-width: 640px) { .cw-thinking { padding: 4px 12px; gap: 8px; } }
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

  /* ── INPUT ───────────────────────────────────────────── */
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

  .cw-input-box {
    max-width: 720px; margin: 0 auto;
    background: #fafaf8; border: 1.5px solid var(--border);
    border-radius: 18px; padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    transition: border-color .15s, box-shadow .15s;
    box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }
  .cw-input-box:focus-within {
    border-color: rgba(193,127,42,.45);
    box-shadow: 0 0 0 3px rgba(193,127,42,.08), 0 1px 6px rgba(0,0,0,.04);
    background: #fff;
  }
  @media(max-width: 640px) {
    .cw-input-box { border-radius: 16px; padding: 8px 10px; }
  }

  .cw-textarea-row { display:flex; align-items:flex-end; gap:8px; }

  .cw-textarea {
    flex:1; border:none; background:none; outline:none;
    font-family:var(--font); font-size:14px; color:var(--t1);
    resize:none; min-height:22px; max-height:120px;
    line-height:1.55; overflow-y:auto; scrollbar-width:thin;
    caret-color: var(--accent);
  }
  .cw-textarea::placeholder { color:var(--t3); }
  @media(max-width: 640px) {
    .cw-textarea { font-size: 16px; } /* prevents iOS zoom */
  }

  /* attach button */
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

  /* attach dropdown — opens upward, stays in viewport on mobile */
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
    background:var(--accent); border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; color:#fff;
    transition:opacity .13s, box-shadow .13s, transform .1s;
  }
  .cw-send:hover:not(:disabled) {
    opacity:.9; box-shadow:0 3px 14px rgba(193,127,42,.4); transform: scale(1.05);
  }
  .cw-send:disabled { opacity:.3; cursor:default; }
  .cw-send svg { width:15px; height:15px; }
  @media(max-width: 640px) {
    .cw-send { width: 36px; height: 36px; } /* bigger tap target */
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
  .cw-selection-btn:hover { background: var(--accent); }
  .cw-selection-btn svg { width: 12px; height: 12px; flex-shrink: 0; }
`;


function PendingChip({ file, onRemove }) {
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


export default function ChatWindow({ chat, setChats, setSidebarOpen, setShowPricing, userPlan }) {
  const [input,          setInput]          = useState("");
  const [isThinking,     setIsThinking]     = useState(false);
  const [showAttach,     setShowAttach]     = useState(false);
  const [pendingFiles,   setPendingFiles]   = useState([]);
  const [lightboxSrc,    setLightboxSrc]    = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [selectionBtn,   setSelectionBtn]   = useState(null);

  const fileInputRef       = useRef(null);
  const fileAcceptRef      = useRef("");
  const bodyRef            = useRef(null);
  const textareaRef        = useRef(null);
  const attachRef          = useRef(null);
  const messagesEndRef     = useRef(null);
  const abortControllerRef = useRef(null);

  const messages  = useMemo(() => chat?.messages || [], [chat]);
  const showIntro = messages.length === 0;
  const canAddMore = pendingFiles.length < 2;

  useEffect(() => {
    if (!document.getElementById("eloria-cw-v3")) {
      const tag = document.createElement("style");
      tag.id = "eloria-cw-v3";
      tag.textContent = CW_STYLE;
      document.head.appendChild(tag);
    }
    const old = document.getElementById("eloria-cw");
    if (old) old.remove();
  }, []);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, isThinking]);

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

        if (!text || text.length < 2) {
          setSelectionBtn(null);
          return;
        }

        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        const bubble = container.nodeType === 3
          ? container.parentElement?.closest(".cw-bubble")
          : container.closest?.(".cw-bubble");

        const msgRow = bubble?.closest(".cw-msg-row");
        if (!bubble || !msgRow?.classList.contains("ai")) {
          setSelectionBtn(null);
          return;
        }

        const rect = range.getBoundingClientRect();
        setSelectionBtn({
          x: rect.left + rect.width / 2,
          y: rect.top - 8,
          text,
        });
      }, 10);
    };

    const handleMouseDown = (e) => {
      if (!e.target.closest(".cw-selection-btn")) {
        setSelectionBtn(null);
      }
    };

    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, []);

  if (!chat) {
    return (
      <main className="cw-root" style={{ alignItems:"center", justifyContent:"center" }}>
        <p style={{ color:"var(--t3)", fontSize:14 }}>Select or create a chat to get started.</p>
      </main>
    );
  }

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
          setPendingFiles(prev => [...prev, {
            id: Date.now() + Math.random(),
            name: f.name, size: f.size, kind,
            previewUrl: ev.target.result,
          }]);
        };
        reader.readAsDataURL(f);
      } else {
        reader.onload = (ev) => {
          setPendingFiles(prev => [...prev, {
            id: Date.now() + Math.random(),
            name: f.name, size: f.size, kind,
            previewUrl: null,
            base64: ev.target.result,
            textContent: null,
          }]);
        };
        reader.readAsDataURL(f);
      }
    });
  };

  const handleQuoteReply = () => {
    if (!selectionBtn) return;
    const quoted = selectionBtn.text
      .split("\n")
      .map(line => `> ${line}`)
      .join("\n");
    setInput(prev => prev ? `${quoted}\n\n${prev}` : `${quoted}\n\n`);
    setSelectionBtn(null);
    window.getSelection()?.removeAllRanges();
    setTimeout(() => textareaRef.current?.focus(), 50);
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

  const sendMessage = async () => {
    if (!input.trim() && pendingFiles.length === 0) return;
    if (isThinking) return;
    if (!auth.currentUser) { console.error("User not logged in"); return; }

    if (abortControllerRef.current) abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    const userMsg = {
      id: Date.now(),
      sender: "user",
      text: input.trim(),
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

    const apiMessages = newMessages.map(m => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text || "",
      files: m.files || [],
    }));

    try {
      const res = await fetch("http://localhost:5001/api/chat", {
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
            ? { ...c, messages: [...newMessages, { id: aiMsgId, sender: "ai", text: "", time: getTimestamp() }] }
            : c
        )
      );
      setIsThinking(false);

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
    }
  };

  const regenerateMessage = async (messageId) => {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const prevMsgs = messages.slice(0, idx);
    const lastUser = [...prevMsgs].reverse().find(m => m.sender === "user");
    if (!lastUser) return;
    if (!auth.currentUser) return;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    const apiMessages = prevMsgs
      .filter(m => m.text)
      .map(m => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

    try {
      const res = await fetch("http://localhost:5001/api/chat", {
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

  const renderMessage = (msg) => {
    const isUser = msg.sender === "user";
    return (
      <div key={msg.id} className={`cw-msg-row ${msg.sender}`}>
        {!isUser && (
          <div className="cw-ai-avatar"><img src={logo} alt="Eloria" /></div>
        )}
        <div className={`cw-bubble-stack ${isUser ? "user" : "ai"}`}>
          {msg.files?.map(f => (
            <AttachBubble key={f.id} file={f} sender={msg.sender} onImageClick={setLightboxSrc} />
          ))}
          {msg.text && (
            <div className="cw-bubble">
              {msg.sender === "ai"
                ? <MarkdownMessage content={msg.text} />
                : msg.text
              }
            </div>
          )}
          {!isUser && (
            <div className="cw-msg-divider">
              <div style={{ flex:1, height:1, background:"linear-gradient(to right, rgba(13,58,53,.12), transparent)" }} />
              <span style={{ fontSize:10, color:"var(--t3)", fontFamily:"var(--font)", letterSpacing:".03em" }}>{msg.time}</span>
              <button
                onClick={() => regenerateMessage(msg.id)}
                style={{ border:"none", background:"none", color:"var(--t3)", cursor:"pointer", fontSize:10, padding:0, fontFamily:"var(--font)", transition:"color .12s" }}
                onMouseEnter={e => e.target.style.color="var(--accent)"}
                onMouseLeave={e => e.target.style.color="var(--t3)"}
              >
                ↻ regenerate
              </button>
              <div style={{ flex:1, height:1, background:"linear-gradient(to left, rgba(13,58,53,.12), transparent)" }} />
            </div>
          )}
          {isUser && <div className="cw-msg-time">{msg.time}</div>}
        </div>
      </div>
    );
  };

  return (
    <main className="cw-root">
      <input ref={fileInputRef} type="file" style={{ display:"none" }} onChange={onFileChange} />

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
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{
            padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
            fontFamily: "var(--font)", letterSpacing: "0.04em", textTransform: "uppercase",
            background: userPlan === "pro" || userPlan === "admin" ? "rgba(39,97,82,0.12)" : "rgba(193,127,42,.1)",
            color: "var(--accent)",
            border: userPlan === "pro" || userPlan === "admin" ? "1px solid rgba(39,97,82,.25)" : "1px solid rgba(193,127,42,.25)",
          }}>
            {userPlan === "admin" ? "Admin" : userPlan === "pro" ? "Pro ✦" : "Free"}
          </div>
          {userPlan !== "pro" && userPlan !== "admin" && (
            <button className="cw-upgrade" onClick={() => setShowPricing(true)}>Upgrade</button>
          )}
        </div>
      </header>

      <div className="cw-body" ref={bodyRef}>
        {showIntro ? (
          <div className="cw-intro">
            <div className="cw-intro-logo"><img src={logo} alt="Eloria" /></div>
            <div className="cw-intro-text">
              <div className="cw-intro-headline">What can I help with?</div>
              <div className="cw-intro-sub">Ask anything — Eloria is ready.</div>
            </div>
            <div className="cw-cards">
              {[
                { icon:"", label:"Make me an assignment",        q:"Make me an assignment" },
                { icon:"", label:"Business idea for students",   q:"Business idea for students" },
                { icon:"", label:"Write a viral YouTube script", q:"Write a viral YouTube script" },
                { icon:"", label:"Explain a complex topic",      q:"Explain quantum computing simply" },
              ].map(c => (
                <div key={c.q} className="cw-card" onClick={() => setInput(c.q)}>
                  <span className="cw-card-icon">{c.icon}</span>
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="cw-messages">
            {messages.map(renderMessage)}
            {isThinking && (
              <div className="cw-thinking">
                <div className="cw-ai-avatar" style={{ width:28, height:28, borderRadius:8, overflow:"hidden", border:"1.5px solid rgba(193,127,42,.2)", background:"#faf8f4", flexShrink:0 }}>
                  <img src={logo} alt="Eloria" style={{ width:"100%", height:"100%", objectFit:"contain" }} />
                </div>
                <div className="cw-thinking-dots"><span/><span/><span/></div>
                <span className="cw-thinking-label">Eloria is thinking…</span>
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
                {userPlan === "pro" || userPlan === "admin" ? "⏰" : "✦"}
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
        <div className="cw-input-box">
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
                        {ATTACH_TYPES.image.icon}
                        <span>Image</span>
                        <span style={{ marginLeft:"auto", fontSize:10, color:"var(--t3)" }}>jpg · png · gif</span>
                      </div>
                      <div className="cw-attach-menu-sep" />
                      <div className="cw-attach-menu-item" onClick={() => openFilePicker("document")}>
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
            />

            <button
              className="cw-send"
              onClick={isThinking ? () => { abortControllerRef.current?.abort(); setIsThinking(false); } : sendMessage}
              disabled={!isThinking && (!input.trim() && pendingFiles.length === 0)}
              title={isThinking ? "Stop" : "Send"}
              style={isThinking ? { background: "#e05252" } : {}}
            >
              {isThinking ? (
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
        <p className="cw-hint">Eloria can make mistakes. Verify important information.</p>
      </div>
    </main>
  );
}
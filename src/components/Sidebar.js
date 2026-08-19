import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import { shareChat, shareProject } from "../services/shareService";

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --font: 'DM Sans', system-ui, sans-serif;
  --bg-app:      #f5f0ea;
  --bg-strip:    #ede8e1;
  --bg-panel:    #fdfaf6;
  --bg-chat:     #FBF6F0;
  --bg-card:     #ffffff;
  --bg-card-2:   #faf7f2;
  --border:      #cdd0c9;
  --border-soft: #dde0d9;
  --t1: #0D3A35;
  --t2: #3a5a55;
  --t3: #7a8a84;
  --accent:      #276152;
  --accent-bg:   #eaf2ef;
  --accent-deep: #1a4a3d;
  --accent-fg:   #ffffff;
  --danger:      #c04040;
  --danger-bg:   #fdf0f0;
  --strip-w:     64px;
  --panel-w:     272px;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
  --shadow-panel: 2px 0 24px rgba(13,58,53,0.10);
  --shadow-pop:   0 8px 32px rgba(13,58,53,0.14);
  color-scheme: light;
}
/* Dark theme: neutral black/white surfaces, green reserved for primary actions —
   matches the Claude / ChatGPT dark-mode convention. */
[data-theme="dark"] {
  --bg-app:      #0e0f0e;
  --bg-strip:    #161716;
  --bg-panel:    #1a1b1a;
  --bg-chat:     #0e0f0e;
  --bg-card:     #212221;
  --bg-card-2:   #262726;
  --border:      #333433;
  --border-soft: #2a2b2a;
  --t1: #f2f2f0;
  --t2: #c7c8c5;
  --t3: #8c8d8a;
  --accent:      #3fb083;
  --accent-bg:   #17251f;
  --accent-deep: #57c797;
  --accent-fg:   #06110c;
  --danger:      #e5787a;
  --danger-bg:   #2a1717;
  --shadow-panel: 2px 0 24px rgba(0,0,0,0.45);
  --shadow-pop:   0 8px 32px rgba(0,0,0,0.55);
  color-scheme: dark;
}
  html, body, #root {
    height: 100%;
    font-family: var(--font);
    background: var(--bg-app);
    color: var(--t1);
    transition: background .18s ease, color .18s ease;
  }
  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }
  .app-main {
    flex: 1;
    min-width: 0;
    margin-left: var(--strip-w);
    display: flex;
    flex-direction: column;
    height: 100vh;
    overflow: hidden;
    transition: margin-left 0.22s cubic-bezier(.4,0,.2,1);
  }
  @media(max-width: 640px) {
    .app-main { margin-left: 0; }
  }
`;

const SIDEBAR_STYLE = `
  /* ── STRIP ─────────────────────────────────────────────── */
  .sb-strip {
    position: fixed;
    top: 0; left: 0;
    width: var(--strip-w);
    height: 100vh;
    background: var(--bg-strip);
    border-right: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 14px 0 16px;
    gap: 2px;
    z-index: 300;
    user-select: none;
  }
  @media(max-width: 640px) {
    .sb-strip { display: none; }
  }

  .sb-logo {
    width: 32px; height: 32px;
    border-radius: 8px; overflow: hidden;
    margin-bottom: 12px; flex-shrink: 0;
  }
  .sb-logo img { width: 100%; height: 100%; object-fit: contain; }

  .sb-btn {
    width: 48px; height: 52px;
    border: none; background: none;
    border-radius: var(--r-md);
    cursor: pointer;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 3px; color: var(--t2);
    font-family: var(--font);
    transition: background .14s, color .14s;
    position: relative;
  }
  .sb-btn:hover  { background: #e9e8e4; color: var(--t1); }
  .sb-btn.active { background: #e3e2de; color: var(--t1); }
  .sb-btn svg  { width: 19px; height: 19px; flex-shrink: 0; }
  .sb-btn span { font-size: 9px; font-weight: 500; letter-spacing:.02em; line-height:1; }

  .sb-spacer { flex: 1; }

  /* ── ACCOUNT AVATAR ─────────────────────────────────────── */
  .sb-avatar-wrap { position: relative; }
  .sb-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff; font-size: 13px; font-weight: 600;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font); transition: box-shadow .14s;
  }
  .sb-avatar:hover { box-shadow: 0 0 0 3px rgba(193,127,42,.22); }

  .acct-popup {
    position: fixed;
    bottom: 16px;
    left: calc(var(--strip-w) + 8px);
    width: 220px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-pop);
    padding: 12px;
    z-index: 500;
    animation: popIn .15s ease;
  }
  @keyframes popIn {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @media(max-width: 640px) {
    .acct-popup {
      position: absolute;
      bottom: calc(100% + 8px);
      left: 8px;
      width: calc(var(--panel-w) - 16px);
    }
  }
  .acct-head { display:flex; align-items:center; gap:10px; padding-bottom:10px; }
  .acct-av {
    width:36px; height:36px; border-radius:50%;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color:#fff; font-size:14px; font-weight:600;
    display:flex; align-items:center; justify-content:center; flex-shrink:0;
  }
  .acct-name  { font-size:13px; font-weight:600; color:var(--t1); line-height:1.3; }
  .acct-email { font-size:11px; color:var(--t3); word-break:break-all; line-height:1.3; }
  .acct-div   { height:1px; background:var(--border); margin:4px 0 8px; }
  .acct-download {
    width:100%; display:flex; align-items:center; gap:8px;
    padding:7px 8px; border:none; background:none;
    color:var(--accent); font-size:13px; font-weight:500;
    border-radius:var(--r-sm); cursor:pointer; font-family:var(--font);
    transition: background .12s;
    margin-bottom: 2px;
  }
  .acct-download:hover { background: var(--accent-bg); }
  .acct-download svg { width:15px; height:15px; flex-shrink:0; }
  .acct-manage {
    width:100%; display:flex; align-items:center; gap:8px;
    padding:7px 8px; border:none; background:none;
    color:var(--t1); font-size:13px; font-weight:500;
    border-radius:var(--r-sm); cursor:pointer; font-family:var(--font);
    transition: background .12s;
    margin-bottom: 2px;
  }
  .acct-manage:hover { background: var(--accent-bg); }
  .acct-manage svg { width:15px; height:15px; flex-shrink:0; }
  .acct-logout {
    width:100%; display:flex; align-items:center; gap:8px;
    padding:7px 8px; border:none; background:none;
    color:var(--danger); font-size:13px; font-weight:500;
    border-radius:var(--r-sm); cursor:pointer; font-family:var(--font);
    transition: background .12s;
  }
  .acct-logout:hover { background: var(--danger-bg); }
  .acct-logout svg { width:15px; height:15px; flex-shrink:0; }

  /* ── SLIDE PANEL ──────────────────────────────────────── */
  .sb-panel {
    position: fixed;
    top: 0;
    left: var(--strip-w);
    width: 0;
    height: 100vh;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    box-shadow: var(--shadow-panel);
    overflow: hidden;
    transition: width .22s cubic-bezier(.4,0,.2,1);
    z-index: 290;
    display: flex; flex-direction: column;
  }
  .sb-panel.open { width: var(--panel-w); }

  /* ── QUICK MODAL variant (desktop): Chats / Projects open as a centered
     popup in the middle of the chat window — Claude-style command palette ── */
  @media(min-width: 641px) {
    .sb-panel--quick {
      top: 50%;
      left: calc(50% + var(--strip-w) / 2);
      height: auto;
      width: 0;
      max-height: min(80vh, 720px);
      border: 1px solid var(--border);
      border-radius: var(--r-lg);
      box-shadow: 0 30px 80px rgba(13,58,53,.22), 0 4px 18px rgba(13,58,53,.10);
      transform: translate(-50%, -46%) scale(.97);
      opacity: 0;
      pointer-events: none;
      transition: transform .22s cubic-bezier(.16,1,.3,1), opacity .16s ease, width 0s linear .22s;
    }
    .sb-panel--quick.open {
      width: min(760px, 92vw);
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
      pointer-events: auto;
      transition: transform .24s cubic-bezier(.16,1,.3,1), opacity .18s ease;
    }
    .sb-panel--quick .panel-inner {
      width: min(760px, 92vw);
      height: auto;
      max-height: min(80vh, 720px);
      border-radius: var(--r-lg);
    }
  }
  @keyframes qpIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── DARKER, BLURRED BACKDROP FOR THE CENTERED QUICK MODAL ───────── */
  .sb-overlay--quick {
    background: rgba(9, 22, 19, 0.46);
    backdrop-filter: blur(7px);
  }

  /* ── STAGGERED ENTRANCE FOR LIST ROWS (chats / projects) ─────────── */
  @keyframes rowIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .panel-list .chat-row,
  .panel-list .cat-row,
  .panel-list .proj-block {
    animation: rowIn .28s cubic-bezier(.16,1,.3,1) both;
  }
  .panel-list .chat-row:nth-child(1),  .panel-list .cat-row:nth-child(1),  .panel-list .proj-block:nth-child(1)  { animation-delay: .01s; }
  .panel-list .chat-row:nth-child(2),  .panel-list .cat-row:nth-child(2),  .panel-list .proj-block:nth-child(2)  { animation-delay: .03s; }
  .panel-list .chat-row:nth-child(3),  .panel-list .cat-row:nth-child(3),  .panel-list .proj-block:nth-child(3)  { animation-delay: .05s; }
  .panel-list .chat-row:nth-child(4),  .panel-list .cat-row:nth-child(4),  .panel-list .proj-block:nth-child(4)  { animation-delay: .07s; }
  .panel-list .chat-row:nth-child(5),  .panel-list .cat-row:nth-child(5),  .panel-list .proj-block:nth-child(5)  { animation-delay: .09s; }
  .panel-list .chat-row:nth-child(6),  .panel-list .cat-row:nth-child(6),  .panel-list .proj-block:nth-child(6)  { animation-delay: .11s; }
  .panel-list .chat-row:nth-child(7),  .panel-list .cat-row:nth-child(7),  .panel-list .proj-block:nth-child(7)  { animation-delay: .13s; }
  .panel-list .chat-row:nth-child(8),  .panel-list .cat-row:nth-child(8),  .panel-list .proj-block:nth-child(8)  { animation-delay: .15s; }
  .panel-list .chat-row:nth-child(n+9),.panel-list .cat-row:nth-child(n+9),.panel-list .proj-block:nth-child(n+9){ animation-delay: .16s; }

  /* smooth momentum-style scroll inside the popup list */
  .sb-panel--quick .panel-list { scroll-behavior: smooth; }

  /* ── "CHATS AND TASKS" STYLE HEADER (matches app cream / dark-green theme) ── */
  .cat-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 22px 26px 16px; flex-shrink: 0;
    border-bottom: 1px solid var(--border-soft);
  }
  .cat-title {
    font-size: 20px; font-weight: 600; color: var(--t1); letter-spacing: -.02em;
  }
  .cat-actions { display: flex; align-items: center; gap: 8px; }
  .cat-icon-btn {
    width: 34px; height: 34px; border-radius: var(--r-md);
    border: none; background: var(--accent-bg); color: var(--t2);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: background .12s, color .12s; flex-shrink: 0;
  }
  .cat-icon-btn svg { width: 15px; height: 15px; }
  .cat-icon-btn:hover, .cat-icon-btn.active { background: var(--accent); color: var(--accent-fg); }

  .cat-filter-wrap { position: relative; }
  .cat-filter-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 12px; border-radius: var(--r-md);
    border: none; background: var(--accent-bg); color: var(--t2);
    font-size: 13px; font-family: var(--font); cursor: pointer;
    transition: background .12s;
  }
  .cat-filter-btn strong { color: var(--t1); font-weight: 600; }
  .cat-filter-btn svg { width: 13px; height: 13px; }
  .cat-filter-btn:hover { background: #e6e1d9; }
  .cat-filter-menu {
    position: absolute; top: calc(100% + 4px); right: 0; left: auto;
    min-width: 120px;
  }

  .cat-btn-select {
    padding: 8px 14px; border-radius: var(--r-md);
    border: none; background: var(--accent-bg); color: var(--t1);
    font-size: 13px; font-weight: 500; font-family: var(--font); cursor: pointer;
    transition: background .12s;
  }
  .cat-btn-select:hover { background: #e6e1d9; }

  .cat-btn-new {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: var(--r-md);
    border: none; background: var(--accent); color: var(--accent-fg);
    font-size: 13px; font-weight: 600; font-family: var(--font); cursor: pointer;
    transition: background .12s, transform .1s;
  }
  .cat-btn-new svg { width: 13px; height: 13px; }
  .cat-btn-new:hover { background: var(--accent-deep); }
  .cat-btn-new:active { transform: scale(.97); }

  .cat-search { margin: 14px 26px 4px; }

  .cat-list { padding: 8px 12px 20px; }
  .cat-row {
    display: flex; align-items: center; gap: 12px;
    padding: 14px 14px; border-radius: var(--r-md);
    border-bottom: 1px solid var(--border-soft);
    position: relative; cursor: pointer;
    transition: background .12s;
  }
  .cat-row:last-child { border-bottom: none; }
  .cat-row:hover { background: #f2ede7; }
  .cat-row.selected { background: var(--accent-bg); }
  .cat-row.selected .cat-row-title { color: var(--accent-deep); font-weight: 600; }
    .cat-row-checkbox { width: 15px; height: 15px; accent-color: var(--accent); cursor: pointer; flex-shrink: 0; }
  .cat-row-title {
    flex: 1; font-size: 14.5px; color: var(--t1); font-weight: 500;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .cat-row-time {
    font-size: 12.5px; color: var(--t3); flex-shrink: 0;
    transition: opacity .12s;
  }
  .cat-row-menu {
    opacity: 0; font-size: 17px; flex-shrink: 0;
  }
  .cat-row:hover .cat-row-menu { opacity: 1; }
  .cat-row:hover .cat-row-time { opacity: .7; }
  .qp-filter-row {
    display: flex; gap: 6px; padding: 0 14px 8px;
  }
  .qp-filter-chip {
    padding: 5px 10px; font-size: 11.5px; font-weight: 600;
    border-radius: 999px; border: 1px solid var(--border);
    background: var(--bg-card, transparent); color: var(--t2);
    cursor: pointer; font-family: var(--font);
    transition: background .12s, color .12s, border-color .12s;
  }
  .qp-filter-chip.active {
    background: var(--accent); color: #fff; border-color: var(--accent);
  }
  .qp-filter-chip:hover:not(.active) { background: var(--accent-bg); }

  @media(max-width: 640px) {
    .sb-panel {
      left: 0;
      width: 0;
      border-right: none;
      box-shadow: 4px 0 24px rgba(0,0,0,0.15);
    }
    .sb-panel.open { width: min(300px, 85vw); }
  }

  .panel-inner {
    width: var(--panel-w);
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  @media(max-width: 640px) {
    .panel-inner {
      width: min(300px, 85vw);
    }
  }

  .panel-hdr {
    display:flex; align-items:center; justify-content:space-between;
    padding: 20px 16px 12px; flex-shrink: 0;
    border-bottom: 1px solid var(--border-soft);
    margin-bottom: 2px;
  }
  .panel-title {
    font-size:15px; font-weight:600; color:var(--t1);
    letter-spacing:-.02em;
    display: flex; align-items: center; gap: 8px;
  }
  .panel-title-icon {
    width: 28px; height: 28px; border-radius: 8px;
    background: var(--accent-bg);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .panel-title-icon svg { width: 14px; height: 14px; color: var(--accent); }
  .panel-x {
    width: 28px; height: 28px; border: none;
    background: none; border-radius: var(--r-sm); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--t3); transition: background .12s, color .12s;
  }
  .panel-x:hover { background: #eeece8; color: var(--t1); }
  .panel-x svg  { width: 14px; height: 14px; }

  /* ── SEARCH BAR ──────────────────────────────────────── */
  .panel-search {
    display:flex; align-items:center; gap:8px;
    margin: 8px 14px 6px; padding: 8px 12px;
    background: #f0ece6;
    border-radius: var(--r-md);
    border: 1px solid transparent;
    transition: border-color .13s, background .13s;
    flex-shrink: 0;
  }
  .panel-search:focus-within {
    border-color: rgba(39,97,82,.35);
    background: #fdfbf8;
    box-shadow: 0 0 0 3px rgba(39,97,82,.06);
  }
  .panel-search svg   { width:13px; height:13px; color:var(--t3); flex-shrink:0; }
  .panel-search input {
    border:none; background:none; outline:none;
    font-size:13px; color:var(--t1); width:100%; font-family:var(--font);
  }
  .panel-search input::placeholder { color:var(--t3); }

  /* ── PANEL LIST ──────────────────────────────────────── */
  .panel-list {
    flex:1; overflow-y:auto; overflow-x:visible; padding: 6px 8px 16px;
    scrollbar-width:thin; scrollbar-color:#d8d4cc transparent;
  }
  .cat-row:last-child, .chat-row:last-child { margin-bottom: 60px; }
  .panel-list::-webkit-scrollbar       { width:3px; }
  .panel-list::-webkit-scrollbar-thumb { background:#d2cec8; border-radius:2px; }

  .panel-section-label {
    font-size: 10px; font-weight: 700; color: var(--t3);
    text-transform: uppercase; letter-spacing: .07em;
    padding: 8px 6px 4px; margin: 0 2px;
  }

  .panel-empty {
    font-size:13px; color:var(--t3); text-align:center;
    padding:36px 16px 24px; line-height:1.7;
  }
  .panel-empty-icon { font-size: 28px; display: block; margin-bottom: 10px; }
  .panel-empty strong { display: block; font-size: 13px; font-weight: 600; color: var(--t2); margin-bottom: 4px; }

  /* ── CHAT ROW ─────────────────────────────────────────── */
  .chat-row {
    display: flex; align-items: center;
    padding: 2px 4px 2px 8px;
    border-radius: var(--r-sm); margin-bottom: 1px;
    position: relative; transition: background .12s; gap: 4px;
    border-left: 2px solid transparent;
  }
  .chat-row:hover { background: #f2ede7; }
  .chat-row.selected {
    background: var(--accent-bg);
    border-left-color: var(--accent);
  }
  .chat-row-icon {
    width: 26px; height: 26px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--t3);
  }
  .chat-row-icon svg { width: 13px; height: 13px; }
  .chat-row.selected .chat-row-icon { color: var(--accent); }

  .chat-row-label {
    flex:1; font-size:13px; color:var(--t1); cursor:pointer;
    padding:7px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    line-height:1.4;
  }
  .chat-row.selected .chat-row-label { font-weight:500; color: var(--accent-deep); }

  .row-menu-btn {
    background:none; border:none; cursor:pointer;
    color:var(--t3); font-size:15px;
    padding:3px 5px; border-radius:4px; line-height:1;
    opacity:0; transition:opacity .12s, background .12s; flex-shrink:0;
  }
  .chat-row:hover .row-menu-btn,
  .proj-row:hover .row-menu-btn { opacity:1; }
  .row-menu-btn:hover { background:#e8e4de; color:var(--t1); }

  .row-dropdown {
    position:absolute; right:0; top:calc(100% + 2px);
    background:var(--bg-panel); border:1px solid var(--border);
    border-radius:var(--r-md); box-shadow:var(--shadow-pop);
    z-index:1000; min-width:140px; padding:4px;
    animation: ddIn .12s ease;
  }
  @keyframes ddIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .row-dropdown button {
    display:flex; align-items:center; gap:8px;
    width:100%; text-align:left;
    padding:7px 10px; font-size:13px; color:var(--t1);
    background:none; border:none; border-radius:var(--r-sm);
    cursor:pointer; font-family:var(--font); transition:background .11s;
  }
  .row-dropdown button svg { width: 13px; height: 13px; flex-shrink: 0; color: var(--t3); }
  .row-dropdown button:hover { background:#f0ece6; }
  .row-dropdown button.del   { color:var(--danger); }
  .row-dropdown button.del:hover { background:var(--danger-bg); }
  .row-dropdown button.del svg { color: var(--danger); }

  .row-dropdown-div { height: 1px; background: var(--border-soft); margin: 4px 0; }

  .rename-input-row {
    flex:1; font-size:13px; padding:4px 8px;
    border:1.5px solid var(--accent); border-radius:var(--r-sm);
    background:#fff; color:var(--t1); outline:none; font-family:var(--font);
    margin:4px 0;
  }

  /* ── DELETE CONFIRM DIALOG ─────────────────────────────── */
  .del-confirm-backdrop {
    position: fixed; inset: 0; z-index: 700;
    background: rgba(13,40,35,.28);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .del-confirm-box {
    background: var(--bg-panel);
    border-radius: var(--r-lg);
    padding: 0;
    width: 320px; margin: 0 16px;
    box-shadow: 0 24px 60px rgba(13,58,53,.18);
    animation: slideUp .17s ease;
    overflow: hidden;
  }
  .del-confirm-top {
    padding: 24px 24px 16px;
  }
  .del-confirm-icon {
    width: 40px; height: 40px; border-radius: 12px;
    background: var(--danger-bg); border: 1px solid #f5cece;
    display: flex; align-items: center; justify-content: center; margin-bottom: 14px;
  }
  .del-confirm-icon svg { width: 18px; height: 18px; color: var(--danger); }
  .del-confirm-box h4 { margin:0 0 6px; font-size:15px; font-weight:600; color:var(--t1); }
  .del-confirm-box p  { margin:0; font-size:13px; color:var(--t3); line-height:1.55; }
  .del-confirm-footer {
    display: flex; gap: 8px;
    padding: 16px 24px;
    background: #f8f4ee;
    border-top: 1px solid var(--border-soft);
  }
  .del-confirm-cancel {
    flex: 1; padding: 8px 16px; background: #fff;
    border: 1px solid var(--border); border-radius: var(--r-sm);
    font-size: 13px; font-weight: 500; color: var(--t2);
    cursor: pointer; font-family: var(--font); transition: background .12s;
  }
  .del-confirm-cancel:hover { background: #f4f4f0; }
  .del-confirm-ok {
    flex: 1; padding: 8px 16px; background: var(--danger); border: none;
    border-radius: var(--r-sm); font-size: 13px; font-weight: 600;
    color: #fff; cursor: pointer; font-family: var(--font); transition: opacity .12s;
  }
  .del-confirm-ok:hover { opacity: .87; }

  /* ── PROJECTS ───────────────────────────────────────────── */
  .new-proj-btn {
    margin: 10px 14px 8px;
    padding: 8px 14px;
    background: #fff;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--accent); font-size: 13px; font-weight: 600;
    cursor: pointer; text-align: left; font-family: var(--font);
    transition: background .12s, border-color .12s; flex-shrink: 0;
    width: calc(100% - 28px);
    display: flex; align-items: center; gap: 7px;
  }
  .new-proj-btn:hover { background: var(--accent-bg); border-color: rgba(39,97,82,.3); }
  .new-proj-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

  .new-proj-form {
    margin: 0 14px 10px; background: #fafaf8;
    border: 1px solid var(--border); border-radius: var(--r-md);
    padding: 12px; flex-shrink: 0;
  }
  .new-proj-form input {
    width: 100%; padding: 7px 10px; font-size: 13px;
    border: 1.5px solid var(--accent); border-radius: var(--r-sm);
    font-family: var(--font); color: var(--t1); outline: none;
    background: #fff; margin-bottom: 10px;
  }
  .npf-actions { display:flex; gap:6px; }
  .btn-create {
    padding: 6px 16px; background: var(--accent); color: #fff;
    border: none; border-radius: var(--r-sm); font-size: 13px;
    font-weight: 600; cursor: pointer; font-family: var(--font); transition: opacity .12s;
  }
  .btn-create:hover { opacity: .87; }
  .btn-cancel {
    padding: 6px 12px; background: none; color: var(--t2);
    border: 1px solid var(--border); border-radius: var(--r-sm);
    font-size: 13px; cursor: pointer; font-family: var(--font); transition: background .12s;
  }
  .btn-cancel:hover { background: #f4f4f0; }

  .proj-block { margin-bottom: 2px; }
  .proj-row {
    display: flex; align-items: center; gap: 4px;
    padding: 2px 4px; border-radius: var(--r-sm);
    position: relative; transition: background .12s;
    border-left: 2px solid transparent;
  }
  .proj-row:hover { background: #f2ede7; }
  .proj-toggle {
    flex: 1; display: flex; align-items: center; gap: 7px;
    background: none; border: none; cursor: pointer;
    padding: 7px 4px; font-size: 13px; font-weight: 600; color: var(--t1);
    font-family: var(--font); text-align: left; min-width: 0;
  }
  .proj-toggle span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .chevron {
    width: 12px; height: 12px; color: var(--t3); flex-shrink: 0;
    transition: transform .17s ease;
  }
  .chevron.open { transform: rotate(90deg); }
  .folder-ic { width: 15px; height: 15px; color: var(--accent); flex-shrink: 0; }

  .proj-chats {
    padding-left: 14px; border-left: 2px solid #e4ddd5;
    margin: 2px 0 4px 20px;
  }
  .proj-chat-item { padding-left: 4px !important; }
  .proj-chat-remove {
    background: none; border: none; cursor: pointer;
    color: var(--t3); font-size: 12px; padding: 2px 5px;
    border-radius: 4px; opacity: 0; transition: opacity .12s, color .12s; flex-shrink: 0;
  }
  .chat-row:hover .proj-chat-remove { opacity: 1; }
  .proj-chat-remove:hover { color: var(--danger); }

  .add-chat-picker {
    background: #fafaf8; border: 1px solid var(--border);
    border-radius: var(--r-md); margin: 4px 4px 8px; padding: 8px;
  }
  .picker-lbl {
    font-size: 10px; color: var(--t3); margin: 0 0 6px;
    font-weight: 700; text-transform: uppercase; letter-spacing: .07em;
  }
  .picker-item {
    display: block; width: 100%; text-align: left;
    padding: 6px 8px; font-size: 12.5px; color: var(--t1);
    background: none; border: none; border-radius: var(--r-sm);
    cursor: pointer; font-family: var(--font); transition: background .11s;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .picker-item:hover { background: #f0ece6; }

  /* ── ELORIA CODE PANEL ── new splash style ──────────────── */
  .code-splash {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    padding: 24px 20px 32px;
    text-align: center;
    gap: 0;
  }
  .code-splash-emblem {
    width: 64px; height: 64px;
    border-radius: 18px;
    background: linear-gradient(145deg, #0d3a35 0%, #1d6152 100%);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 18px;
    box-shadow: 0 4px 20px rgba(13,58,53,.18);
    flex-shrink: 0;
  }
  .code-splash-emblem svg { width: 30px; height: 30px; color: #fff; opacity: .92; }

  .code-splash h3 {
    font-size: 16px; font-weight: 700; color: var(--t1);
    letter-spacing: -.02em; margin-bottom: 8px;
  }
  .code-splash p {
    font-size: 13px; color: var(--t3); line-height: 1.65;
    margin-bottom: 24px; max-width: 220px;
  }
  .code-splash-open {
    display: flex; align-items: center; gap: 9px;
    padding: 11px 22px;
    background: linear-gradient(135deg, #0d3a35 0%, #1d6152 100%);
    border: none; border-radius: 10px;
    color: #fff; font-size: 13px; font-weight: 700;
    font-family: var(--font); cursor: pointer;
    transition: opacity .13s, transform .13s;
    box-shadow: 0 4px 16px rgba(13,58,53,.22);
    text-decoration: none;
  }
  .code-splash-open:hover { opacity: .88; transform: translateY(-1px); }
  .code-splash-open:active { transform: translateY(0); }
  .code-splash-open svg { width: 15px; height: 15px; flex-shrink: 0; }

  .code-splash-note {
    margin-top: 16px;
    font-size: 11px; color: var(--t3);
    display: flex; align-items: center; gap: 5px;
  }
  .code-splash-note svg { width: 12px; height: 12px; flex-shrink: 0; }

.code-tabs {
  display: flex;
  background: #f5f0ea;
  border: 1px solid var(--border-soft);
  border-radius: var(--r-sm);
  padding: 3px;
  margin-bottom: 20px;
  width: 100%;
  max-width: 260px;
}
.code-tab {
  flex: 1;
  display: flex; align-items: center; justify-content: center; gap: 6px;
  background: none; border: none; cursor: pointer;
  font-size: 12px; font-weight: 600; color: var(--t3);
  font-family: var(--font);
  padding: 8px 10px;
  border-radius: 6px;
  transition: all .15s;
}
.code-tab svg { width: 13px; height: 13px; }
.code-tab.active {
  background: #fff;
  color: var(--t1);
  box-shadow: 0 1px 3px rgba(0,0,0,.08);
}
.code-tab:not(.active):hover { color: var(--t2); }

.code-cli-cmd {
  display: flex; align-items: center; gap: 8px;
  background: #f5f0ea; border: 1px solid var(--border-soft);
  border-radius: var(--r-sm); padding: 9px 12px;
  width: 100%; max-width: 260px;
  margin-top: 4px;
}
.code-cli-cmd code {
  flex: 1; font-family: 'SF Mono', Consolas, monospace;
  font-size: 11px; color: var(--t1); white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; text-align: left;
}
.code-cli-copy {
  background: none; border: none; cursor: pointer;
  color: var(--t3); padding: 4px; display: flex;
  align-items: center; justify-content: center;
  border-radius: 4px; transition: color .12s, background .12s;
  flex-shrink: 0;
}
.code-cli-copy:hover { color: var(--t1); background: #e9e4dc; }
.code-cli-copy svg { width: 12px; height: 12px; }
.code-cli-copy.copied { color: var(--accent); }

@media(max-width: 640px) {
  .code-tabs .code-tab[data-tab="terminal"] { display: none; }
}

  .code-proj-list {
    flex: 1; overflow-y: auto; padding: 4px 8px 16px;
    scrollbar-width: thin; scrollbar-color: #d8d4cc transparent;
  }
  .code-proj-list::-webkit-scrollbar { width: 3px; }
  .code-proj-list::-webkit-scrollbar-thumb { background: #d2cec8; border-radius: 2px; }

  .code-proj-item {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: var(--r-md);
    margin-bottom: 2px; cursor: pointer;
    transition: background .12s; position: relative;
    border-left: 2px solid transparent;
  }
  .code-proj-item:hover { background: #f2ede7; border-left-color: rgba(39,97,82,.25); }

  .code-proj-icon {
    width: 30px; height: 30px; background: #e8e4da;
    border-radius: 9px; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .code-proj-icon svg { width: 13px; height: 13px; color: var(--t2); }

  .code-proj-info { flex: 1; min-width: 0; }
  .code-proj-name {
    font-size: 13px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
  }
  .code-proj-desc {
    font-size: 11px; color: var(--t3); margin-top: 1px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  .code-proj-open {
    background: none; border: none; color: var(--accent);
    font-size: 11px; font-weight: 700; font-family: var(--font);
    cursor: pointer; padding: 3px 7px; border-radius: var(--r-sm);
    opacity: 0; transition: opacity .12s, background .12s;
    flex-shrink: 0; display: flex; align-items: center; gap: 3px;
    white-space: nowrap;
  }
  .code-proj-item:hover .code-proj-open { opacity: 1; }
  .code-proj-open:hover { background: var(--accent-bg); }
  .code-proj-open svg { width: 11px; height: 11px; }

  .code-proj-del {
    background: none; border: none; color: var(--t3);
    cursor: pointer; padding: 3px 5px; border-radius: 4px;
    opacity: 0; transition: opacity .12s, color .12s; flex-shrink: 0;
    font-size: 12px;
  }
  .code-proj-item:hover .code-proj-del { opacity: 1; }
  .code-proj-del:hover { color: var(--danger); }

  .code-open-all {
    margin: 10px 14px 0;
    padding: 8px 14px;
    background: none; border: 1px solid var(--border);
    border-radius: var(--r-md); color: var(--t2);
    font-size: 13px; font-weight: 500; font-family: var(--font);
    cursor: pointer; display: flex; align-items: center; gap: 6px;
    width: calc(100% - 28px); transition: background .12s, border-color .12s, color .12s;
    flex-shrink: 0;
  }
  .code-open-all:hover { background: var(--accent-bg); border-color: rgba(39,97,82,.35); color: var(--accent); }
  .code-open-all svg { width: 13px; height: 13px; }

  /* ── MOBILE CODE TAKEOVER ──────────────────────────────── */
  .mobile-code-screen {
    position: fixed; inset: 0; z-index: 800;
    background: var(--bg-app);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 32px 24px;
    text-align: center;
    animation: fadeIn .2s ease;
  }
  .mcs-emblem {
    width: 80px; height: 80px; border-radius: 22px;
    background: linear-gradient(145deg, #0d3a35 0%, #1d6152 100%);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 24px;
    box-shadow: 0 8px 32px rgba(13,58,53,.22);
  }
  .mcs-emblem svg { width: 38px; height: 38px; color: #fff; opacity: .9; }
  .mcs-tag {
    display: inline-flex; align-items: center; gap: 5px;
    background: var(--accent-bg); border: 1px solid rgba(39,97,82,.2);
    border-radius: 20px; padding: 4px 12px;
    font-size: 11px; font-weight: 700; color: var(--accent);
    letter-spacing: .05em; text-transform: uppercase;
    margin-bottom: 16px;
  }
  .mcs-tag svg { width: 11px; height: 11px; }
  .mcs-title {
    font-size: 22px; font-weight: 700; color: var(--t1);
    letter-spacing: -.03em; margin-bottom: 12px; line-height: 1.2;
  }
  .mcs-desc {
    font-size: 14px; color: var(--t3); line-height: 1.7;
    max-width: 280px; margin: 0 auto 32px;
  }
  .mcs-features {
    display: flex; flex-direction: column; gap: 10px;
    width: 100%; max-width: 280px; margin-bottom: 32px;
  }
  .mcs-feature {
    display: flex; align-items: center; gap: 12px;
    background: #fff; border: 1px solid var(--border-soft);
    border-radius: var(--r-md); padding: 12px 14px; text-align: left;
  }
  .mcs-feature-ic {
    width: 32px; height: 32px; border-radius: 9px;
    background: var(--accent-bg);
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .mcs-feature-ic svg { width: 15px; height: 15px; color: var(--accent); }
  .mcs-feature-text { font-size: 13px; color: var(--t2); line-height: 1.4; }
  .mcs-feature-text strong { display: block; font-size: 13px; font-weight: 600; color: var(--t1); margin-bottom: 2px; }
  .mcs-close {
    position: absolute; top: 16px; right: 16px;
    width: 36px; height: 36px; border-radius: 50%;
    background: rgba(255,255,255,.8); border: 1px solid var(--border-soft);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    color: var(--t2); font-size: 14px; backdrop-filter: blur(4px);
    transition: background .12s;
  }
  .mcs-close:hover { background: #fff; }
  .mcs-close svg { width: 14px; height: 14px; }

  /* ── OVERLAY ────────────────────────────────────────────── */
  .sb-overlay {
    position: fixed; inset: 0; z-index: 280;
    background: rgba(0,0,0,.18); backdrop-filter: blur(1px);
    animation: fadeIn .15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  /* ── LOGOUT / GENERIC MODAL ─────────────────────────────── */
  .modal-back {
    position: fixed; inset: 0; z-index: 600;
    background: rgba(0,0,0,.28);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .modal-box {
    background: var(--bg-panel); border-radius: var(--r-lg);
    padding: 24px; width: 300px; box-shadow: 0 24px 60px rgba(0,0,0,.18);
    animation: slideUp .17s ease; margin: 0 16px;
  }
  @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .modal-box h4 { margin: 0 0 8px; font-size: 16px; font-weight: 600; color: var(--t1); }
  .modal-box p  { margin: 0 0 20px; font-size: 13px; color: var(--t2); line-height: 1.5; }
  .modal-acts   { display: flex; gap: 8px; justify-content: flex-end; }
  .m-cancel {
    padding: 7px 16px; background: none; border: 1px solid var(--border);
    border-radius: var(--r-sm); font-size: 13px; color: var(--t2);
    cursor: pointer; font-family: var(--font); transition: background .12s;
  }
  .m-cancel:hover { background: #f4f4f0; }
  .m-confirm {
    padding: 7px 16px; background: var(--danger); border: none;
    border-radius: var(--r-sm); font-size: 13px; font-weight: 500;
    color: #fff; cursor: pointer; font-family: var(--font); transition: opacity .12s;
  }
  .m-confirm:hover { opacity: .87; }

  @keyframes chatSlide {
    from{opacity:0;transform:translateX(-8px)}
    to  {opacity:1;transform:translateX(0)}
  }
  .new-chat-anim { animation: chatSlide .2s ease; }

  /* ── MOBILE NAV ─────────────────────────────────────────── */
  .sb-mobile-nav {
    display: none; flex-shrink: 0;
    padding: 14px 10px 6px; gap: 3px;
    border-bottom: 1px solid var(--border);
  }
  @media(max-width: 640px) {
    .sb-mobile-nav { display: flex; flex-direction: column; }
  }

  .sb-mobile-nav-btn {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 10px 12px;
    border: none; background: none; border-radius: var(--r-md);
    font-family: var(--font); font-size: 14px; font-weight: 500;
    color: var(--t2); cursor: pointer;
    transition: background .13s, color .13s; text-align: left;
    border-left: 2px solid transparent;
  }
  .sb-mobile-nav-btn:hover { background: #f2ede7; color: var(--t1); }
  .sb-mobile-nav-btn.active { background: var(--accent-bg); color: var(--accent); border-left-color: var(--accent); }
  .sb-mobile-nav-btn svg { width: 18px; height: 18px; flex-shrink: 0; }

  .sb-mobile-new-chat {
    display: flex; align-items: center; gap: 10px;
    width: 100%; padding: 11px 14px;
    border: none;
    background: linear-gradient(135deg, #0d3a35, #1d6152);
    border-radius: var(--r-md);
    font-family: var(--font); font-size: 14px; font-weight: 700;
    color: #fff; cursor: pointer; transition: opacity .13s;
    margin-bottom: 6px; box-shadow: 0 2px 10px rgba(13,58,53,.18);
  }
  .sb-mobile-new-chat:hover { opacity: .88; }
  .sb-mobile-new-chat svg { width: 17px; height: 17px; flex-shrink: 0; }

  /* ── MOBILE ACCOUNT ─────────────────────────────────────── */
  .sb-mobile-acct {
    flex-shrink: 0; padding: 12px;
    border-top: 1px solid var(--border); display: none;
  }
  @media(max-width: 640px) {
    .sb-mobile-acct {
      display: flex; flex-shrink: 0; margin-top: auto;
      position: sticky; bottom: 0;
      background: var(--bg-panel); z-index: 10;
    }
  }

  /* ── CODE LOCK MODAL ────────────────────────────────────── */
  .sb-lock-backdrop {
    position: fixed; inset: 0; z-index: 600;
    background: rgba(0,0,0,.28); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .sb-lock-modal {
    background: var(--bg-panel); border-radius: var(--r-lg);
    width: 300px; margin: 0 16px; overflow: hidden;
    box-shadow: 0 24px 60px rgba(13,58,53,.18); animation: slideUp .17s ease;
  }
  .sb-lock-top {
    background: linear-gradient(135deg, #0d3a35, #1a5a52);
    padding: 24px 20px 20px; text-align: center; position: relative;
  }
  .sb-lock-close {
    position: absolute; top: 10px; right: 10px;
    width: 26px; height: 26px; border-radius: 50%;
    background: rgba(255,255,255,.1); border: none;
    color: rgba(255,255,255,.7); cursor: pointer; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
  }
  .sb-lock-close:hover { background: rgba(255,255,255,.2); color: #fff; }
  .sb-lock-icon {
    width: 48px; height: 48px; border-radius: 14px;
    background: rgba(255,255,255,.1);
    border: 1.5px solid rgba(255,255,255,.2);
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; margin: 0 auto 12px;
  }
  .sb-lock-title { font-size: 16px; font-weight: 700; color: #fff; margin-bottom: 5px; }
  .sb-lock-sub   { font-size: 12px; color: rgba(255,255,255,.6); line-height: 1.5; }
  .sb-lock-body  { padding: 18px 20px 20px; }
  .sb-lock-desc  {
    font-size: 13px; color: var(--t2); line-height: 1.65;
    margin-bottom: 16px; text-align: center;
  }
  .sb-lock-actions { display: flex; gap: 8px; }
  .sb-lock-cancel {
    flex: 1; padding: 10px; background: none;
    border: 1px solid var(--border); border-radius: var(--r-md);
    font-size: 13px; color: var(--t2); cursor: pointer;
    font-family: var(--font); transition: background .12s;
  }
  .sb-lock-cancel:hover { background: #f4f4f0; }
  .sb-lock-upgrade {
    flex: 2; padding: 10px;
    background: linear-gradient(135deg, #0d3a35, #1a5a52);
    border: none; border-radius: var(--r-md);
    font-size: 13px; font-weight: 600; color: #fff; cursor: pointer;
    font-family: var(--font); transition: opacity .12s;
  }
  .sb-lock-upgrade:hover { opacity: .88; }

  /* ── SHARE TOAST ─────────────────────────────────────── */
  .sb-toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%);
    background: var(--t1); color: #fff;
    font-size: 13px; font-weight: 500; padding: 10px 18px;
    border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,.18);
    z-index: 9999; white-space: nowrap;
    animation: toastIn .18s ease; font-family: var(--font);
    display: flex; align-items: center; gap: 8px;
  }
  .sb-toast svg { width: 15px; height: 15px; flex-shrink: 0; color: #86d4b8; }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── GROUPS PANEL ───────────────────────────────────────── */
  .grp-new-btn {
    margin: 10px 14px 8px; padding: 8px 14px;
    background: #fff; border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--accent); font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    display: flex; align-items: center; gap: 7px;
    width: calc(100% - 28px); transition: background .12s, border-color .12s;
    flex-shrink: 0;
  }
  .grp-new-btn:hover { background: var(--accent-bg); border-color: rgba(39,97,82,.3); }
  .grp-new-btn:disabled { opacity: .4; cursor: not-allowed; }
  .grp-new-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

  .grp-form {
    margin: 0 14px 10px; background: #f5f2ed;
    border: 1px solid var(--border-soft); border-radius: var(--r-md);
    padding: 10px; flex-shrink: 0;
  }
  .grp-form input {
    width: 100%; padding: 7px 10px; font-size: 13px;
    border: 1.5px solid var(--accent); border-radius: var(--r-sm);
    font-family: var(--font); color: var(--t1); outline: none;
    background: #fff; margin-bottom: 8px;
  }

  .grp-section-label {
    font-size: 10px; font-weight: 700; color: var(--t3);
    text-transform: uppercase; letter-spacing: .07em;
    padding: 6px 6px 4px; margin: 0 4px;
  }

  .grp-row {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 10px 7px 8px; border-radius: var(--r-md);
    cursor: pointer; transition: background .12s; margin-bottom: 2px;
    position: relative; border-left: 3px solid transparent;
  }
  .grp-row:hover { background: #f0f5f3; }
  .grp-row.active { background: var(--accent-bg); border-left-color: var(--accent); }

  .grp-avatar {
    width: 36px; height: 36px; border-radius: 10px;
    background: linear-gradient(135deg, var(--accent) 0%, #1a5a42 100%);
    color: #fff; font-size: 14px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; letter-spacing: -.01em;
    box-shadow: 0 2px 6px rgba(39,97,82,.22);
  }

  .grp-info { flex: 1; min-width: 0; }
  .grp-name { font-size: 13px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
  .grp-preview { font-size: 11px; color: var(--t3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .grp-row.active .grp-name { color: var(--accent-deep); }

  .grp-badge {
    min-width: 20px; height: 20px; border-radius: 10px;
    background: var(--accent); color: #fff;
    font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 6px;
  }

  .sb-btn .notif-dot {
    position: absolute; top: 7px; right: 7px;
    width: 8px; height: 8px; border-radius: 50%;
    background: #e05050; border: 1.5px solid var(--bg-strip);
  }

  .grp-empty {
    text-align: center; padding: 32px 16px 24px; color: var(--t3);
  }
  .grp-empty-icon { font-size: 28px; margin-bottom: 10px; display: block; }
  .grp-empty-title { font-size: 13px; font-weight: 600; color: var(--t2); margin-bottom: 5px; }
  .grp-empty p { font-size: 12px; line-height: 1.6; }
`;

// ── true when running inside the Tauri desktop wrapper ──
const IS_TAURI = typeof window !== "undefined" && !!window.__TAURI__;

export default function Sidebar({
  user, chats, setChats,
  activeChatId, setActiveChatId,
  onLogout, sidebarOpen, setSidebarOpen,
  userPlan, setShowPricing, setShowBilling, setShowSettings,
  mode, setMode,
}) {
    const [panel, setPanel]           = useState(null);
  const [renderedPanel, setRenderedPanel] = useState(null);
  const [search, setSearch]         = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showAcct, setShowAcct]     = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showMobileCode, setShowMobileCode] = useState(false);

  const [projects, setProjects]       = useState(() => {
    try { return JSON.parse(localStorage.getItem("eloria_projects") || "[]"); } catch { return []; }
  });
  const [openProjId, setOpenProjId]   = useState(null);
  const [projMenuId, setProjMenuId]   = useState(null);
  const [newProjName, setNewProjName] = useState("");
  const [showNewProj, setShowNewProj] = useState(false);
  const [addChatProj, setAddChatProj] = useState(null);
  const [addToProjectMenuId, setAddToProjectMenuId] = useState(null);

  const [codeProjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem("eloria_code_projects") || "[]"); } catch { return []; }
  });

  const desktopAcctRef = useRef(null);
  const [showCodeLockModal, setShowCodeLockModal] = useState(false);
  const [shareToast, setShareToast] = useState("");

  const isMobile = () => window.innerWidth <= 640;

  const [cliCopied, setCliCopied] = useState(false);
  const [codeTab, setCodeTab] = useState("browser");

  const copyCliCommand = () => {
    navigator.clipboard.writeText("npm install -g eloria-cli");
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 1800);
  };

  // ── open download page in a new window ──
const openDownloadPage = () => {
  setShowAcct(false);
  window.location.href = "/download";
};

  useEffect(() => {
    if (!document.getElementById("eloria-global")) {
      const tag = document.createElement("style");
      tag.id = "eloria-global";
      tag.textContent = GLOBAL_STYLE + SIDEBAR_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

    useEffect(() => {
    if (panel) { setRenderedPanel(panel); }
    else { const t = setTimeout(() => setRenderedPanel(null), 240); return () => clearTimeout(t); }
  }, [panel]);

  useEffect(() => {
    localStorage.setItem("eloria_projects", JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem("eloria_code_projects", JSON.stringify(codeProjects));
  }, [codeProjects]);

  useEffect(() => {
    if (chats.some(c => c.animate))
      setChats(chats.map(c => c.animate ? { ...c, animate: false } : c));
  }, [chats, setChats]);

  useEffect(() => {
    const h = e => {
      if (desktopAcctRef.current && !desktopAcctRef.current.contains(e.target))
        setShowAcct(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const quickPanelRef = useRef(null);
  useEffect(() => {
    if (!(panel === "chats" || panel === "projects")) return;
    if (isMobile()) return;
    const h = e => {
      if (quickPanelRef.current && !quickPanelRef.current.contains(e.target)
          && !e.target.closest(".sb-btn")) {
        setPanel(null);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [panel]);

  useEffect(() => {
    if (sidebarOpen) { setPanel("chats"); setSidebarOpen(false); }
  }, [sidebarOpen, setSidebarOpen]);

  /* ── helpers ── */
  const addChat = () => {
    const nc = { id: Date.now(), title: "New Chat", messages: [], animate: true };
    setChats(p => [...p, nc]);
    setActiveChatId(nc.id);
    setPanel(null);
  };

  const requestDeleteChat = (id, title) => {
    setOpenMenuId(null);
    setDeleteConfirm({ id, title });
  };

  const confirmDeleteChat = () => {
    if (!deleteConfirm) return;
    const f = chats.filter(c => c.id !== deleteConfirm.id);
    setChats(f);
    if (activeChatId === deleteConfirm.id) setActiveChatId(f[0]?.id || null);
    setProjects(p => p.map(proj => ({ ...proj, chatIds: (proj.chatIds || []).filter(cid => cid !== deleteConfirm.id) })));
    setDeleteConfirm(null);
  };

  const renameChat = (id, val) => {
    setChats(p => p.map(c => c.id === id ? { ...c, title: val || c.title, renameOpen: false } : c));
  };

  const createProject = () => {
    const name = newProjName.trim() || "New Project";
    setProjects(p => [...p, { id: Date.now(), name, chatIds: [] }]);
    setNewProjName(""); setShowNewProj(false);
  };

  const deleteProject = id => {
    setProjects(p => p.filter(pr => pr.id !== id));
    if (openProjId === id) setOpenProjId(null);
    setProjMenuId(null);
  };

  const renameProject = (id, val) => {
    setProjects(p => p.map(pr => pr.id === id ? { ...pr, name: val || pr.name, renameOpen: false } : pr));
  };

  const addChatToProject = (projId, chatId) => {
    setProjects(p => p.map(pr => pr.id === projId
      ? { ...pr, chatIds: pr.chatIds.includes(chatId) ? pr.chatIds : [...pr.chatIds, chatId] }
      : pr
    ));
    setAddChatProj(null);
  };

  const removeChatFromProject = (projId, chatId) => {
    setProjects(p => p.map(pr => pr.id === projId
      ? { ...pr, chatIds: (pr.chatIds || []).filter(id => id !== chatId) }
      : pr
    ));
  };

  const handleShareChat = async (chat) => {
    setOpenMenuId(null);
    try {
      const url = await shareChat(chat, user);
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied to clipboard");
      setTimeout(() => setShareToast(""), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to create share link.");
    }
  };

  const handleShareProject = async (proj) => {
    setProjMenuId(null);
    try {
      const url = await shareProject(proj, chats, user);
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied to clipboard");
      setTimeout(() => setShareToast(""), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to create share link.");
    }
  };

  const openCodeWorkspace = (projectId) => {
    const url = projectId ? `/code?project=${projectId}` : "/code";
    if (window.__TAURI__) {
      window.location.href = url;
    } else {
      window.open(url, "_blank");
    }
  };

  const handleCodeClick = () => {
    if (userPlan !== "pro" && userPlan !== "admin") {
      setShowCodeLockModal(true);
      return;
    }
    if (isMobile()) {
      setPanel(null);
      setShowMobileCode(true);
    } else {
      togglePanel("code");
    }
  };

  const togglePanel = name => {
    setPanel(p => p === name ? null : name);
    setSearch(""); setOpenMenuId(null); setProjMenuId(null);
  };

  const selectChat = id => { setActiveChatId(id); setPanel(null); };

  const confirmLogout = () => {
    setShowLogout(false); setShowAcct(false); setSidebarOpen(false);
    if (onLogout) onLogout();
  };

  const [chatFilter, setChatFilter] = useState("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const toggleSelectMode = () => { setSelectMode(s => !s); setSelectedIds([]); };
  const toggleSelectOne = id => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);
  const selectAllChats = () => setSelectedIds(filtered.map(c => c.id));
  const deselectAllChats = () => setSelectedIds([]);
  const deleteSelectedChats = () => {
    setChats(p => p.filter(c => !selectedIds.includes(c.id)));
    setSelectedIds([]); setSelectMode(false);
  };
  const [showChatSearch, setShowChatSearch] = useState(false);
  const [showChatFilterMenu, setShowChatFilterMenu] = useState(false);

  const formatRelativeTime = idOrMs => {
    const ms = Number(idOrMs) || 0;
    if (!ms) return "";
    const diff = Date.now() - ms;
    const min = Math.floor(diff / 60000);
    const hr  = Math.floor(diff / 3600000);
    const day = Math.floor(diff / 86400000);
    if (min < 1)  return "Just now";
    if (min < 60) return `${min} minute${min !== 1 ? "s" : ""} ago`;
    if (hr  < 24) return `${hr} hour${hr !== 1 ? "s" : ""} ago`;
    if (day < 2)  return "Yesterday";
    if (day < 7)  return `${day} days ago`;
    const d = new Date(ms);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const filtered = chats
    .filter(c => c.title?.toLowerCase().includes(search.toLowerCase()))
    .filter(c => {
      if (chatFilter === "all") return true;
      const ageMs = Date.now() - (Number(c.id) || 0);
      const days = ageMs / 86400000;
      if (chatFilter === "recent") return days <= 7;
      if (chatFilter === "older") return days > 7;
      return true;
    });
  const initials  = user?.displayName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  /* ── shared snippet: "Download desktop app" button (hidden in Tauri) ── */
  const DownloadDesktopBtn = () => IS_TAURI ? null : (
    <button className="acct-download" onClick={openDownloadPage}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="20" height="14" rx="2"/>
        <line x1="8" y1="21" x2="16" y2="21"/>
        <line x1="12" y1="17" x2="12" y2="21"/>
        <polyline points="8 11 12 15 16 11"/>
        <line x1="12" y1="7" x2="12" y2="15"/>
      </svg>
      Download desktop app
    </button>
  );

  /* ── shared snippet: "Manage subscription" button (opens Billing page) ── */
  const ManageSubscriptionBtn = () => (
    <button
      className="acct-manage"
      onClick={() => { setShowAcct(false); setShowBilling?.(true); }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2"/>
        <line x1="1" y1="10" x2="23" y2="10"/>
      </svg>
      Manage subscription
    </button>
  );

  /* ── shared snippet: "Settings" button (opens Settings popup) ── */
  const SettingsBtn = () => (
    <button
      className="acct-manage"
      onClick={() => { setShowAcct(false); setShowSettings?.(true); }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
      </svg>
      Settings
    </button>
  );

  const CloseX = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );

  const IconPlus = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );

  const IconCode = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );

  const IconChat = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  );

  const IconFolder = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
    </svg>
  );

  const IconExternal = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );

  const IconMonitor = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );

  const IconTerminal = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
    </svg>
  );

  const IconZap = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );

  return (
    <>
      {panel && (
        <div
          className={`sb-overlay${(panel === "chats" || panel === "projects") ? " sb-overlay--quick" : ""}`}
          onClick={() => setPanel(null)}
        />
      )}

      {/* ── MOBILE CODE TAKEOVER ── */}
      {showMobileCode && (
        <div className="mobile-code-screen">
          <button className="mcs-close" onClick={() => setShowMobileCode(false)}><CloseX /></button>
          <div className="mcs-emblem"><IconCode /></div>
          <div className="mcs-tag">
            <IconMonitor />
            Desktop only
          </div>
          <h3 className="mcs-title">Eloria Code is built for your desktop</h3>
          <p className="mcs-desc">
            The full-featured code workspace needs a larger screen and keyboard. Open it on your laptop or desktop to get started.
          </p>
          <div className="mcs-features">
            <div className="mcs-feature">
              <div className="mcs-feature-ic"><IconTerminal /></div>
              <div className="mcs-feature-text">
                <strong>Live editor & Terminal</strong>
                Multi-file editing with an integrated shell
              </div>
            </div>
            <div className="mcs-feature">
              <div className="mcs-feature-ic"><IconZap /></div>
              <div className="mcs-feature-text">
                <strong>AI-powered completions</strong>
                Inline suggestions tuned for software development
              </div>
            </div>
            <div className="mcs-feature">
              <div className="mcs-feature-ic"><IconMonitor /></div>
              <div className="mcs-feature-text">
                <strong>Optimised for large screens</strong>
                Side-by-side layout needs at least 768px to shine
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: "var(--t3)", lineHeight: 1.6 }}>
            Visit <strong style={{ color: "var(--accent)" }}>domain/code</strong> on your computer to begin.
          </p>
        </div>
      )}

      {/* ── STRIP (desktop only) ── */}
      <aside className="sb-strip">
        <div className="sb-logo"><img src={logo} alt="Eloria" /></div>

        <button className="sb-btn" title="New Chat" onClick={addChat}>
          <IconPlus />
          <span>New</span>
        </button>

        <button className={`sb-btn${panel === "chats" ? " active" : ""}`} title="Chats" onClick={() => togglePanel("chats")}>
          <IconChat />
          <span>Chats</span>
        </button>

        <button className={`sb-btn${panel === "projects" ? " active" : ""}`} title="Projects" onClick={() => togglePanel("projects")}>
          <IconFolder />
          <span>Projects</span>
        </button>

        <button
          className={`sb-btn${panel === "code" ? " active" : ""}`}
          title={userPlan === "pro" || userPlan === "admin" ? "Eloria Code" : "Eloria Code — Pro only"}
          onClick={handleCodeClick}
          style={userPlan !== "pro" && userPlan !== "admin" ? { opacity: 0.45 } : {}}
        >
          <IconCode />
          <span>Code</span>
        </button>

        <div className="sb-spacer" />

        {/* ── DESKTOP ACCOUNT AVATAR ── */}
        <div className="sb-avatar-wrap" ref={desktopAcctRef}>
          <button className="sb-avatar" onClick={() => setShowAcct(v => !v)} title="Account">
            {initials}
          </button>
          {showAcct && (
            <div className="acct-popup">
              <div className="acct-head">
                <div className="acct-av">{initials}</div>
                <div>
                  <div className="acct-name">{user?.displayName || "Account"}</div>
                  <div className="acct-email">{user?.email || "guest@eloria.ai"}</div>
                </div>
              </div>
              <div className="acct-div" />
              {/* Download button — hidden inside Tauri */}
              <DownloadDesktopBtn />
              <ManageSubscriptionBtn />
              <SettingsBtn />
              <button className="acct-logout" onClick={(e) => {
                e.stopPropagation();
                setShowAcct(false);
                setTimeout(() => setShowLogout(true), 0);
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── SLIDE PANEL (mobile) / QUICK POPOVER (desktop, chats & projects) ── */}
      <div
        ref={quickPanelRef}
                className={`sb-panel${panel ? " open" : ""}${(renderedPanel === "chats" || renderedPanel === "projects") ? " sb-panel--quick" : ""}`}
      >
        <div className="panel-inner">

          {/* ── MOBILE NAV ── */}
          <div className="sb-mobile-nav">
            <button className="sb-mobile-new-chat" onClick={addChat}>
              <IconPlus /> New Chat
            </button>
            <button className={`sb-mobile-nav-btn${panel === "chats" ? " active" : ""}`} onClick={() => togglePanel("chats")}>
              <IconChat /> Chats
            </button>
            <button className={`sb-mobile-nav-btn${panel === "projects" ? " active" : ""}`} onClick={() => togglePanel("projects")}>
              <IconFolder /> Projects
            </button>
            <button
              className="sb-mobile-nav-btn"
              onClick={() => {
                if (userPlan !== "pro" && userPlan !== "admin") {
                  setPanel(null); setShowCodeLockModal(true);
                } else {
                  setPanel(null); setShowMobileCode(true);
                }
              }}
              style={userPlan !== "pro" && userPlan !== "admin" ? { opacity: 0.45 } : {}}
            >
              <IconCode /> Eloria Code
            </button>
          </div>

          {/* ── CHATS PANEL ── */}
                    {renderedPanel === "chats" && <>
            <div className="cat-hdr">
              <span className="cat-title">Chats and tasks</span>
              <div className="cat-actions">
                <button
                  className={`cat-icon-btn${showChatSearch ? " active" : ""}`}
                  onClick={() => setShowChatSearch(s => !s)}
                  aria-label="Search chats"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </button>
                <div className="cat-filter-wrap">
                  <button className="cat-filter-btn" onClick={() => setShowChatFilterMenu(s => !s)}>
                    Filter by <strong>{chatFilter === "all" ? "All" : chatFilter === "recent" ? "Recent" : "Older"}</strong>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {showChatFilterMenu && (
                    <div className="row-dropdown cat-filter-menu">
                      <button onClick={() => { setChatFilter("all"); setShowChatFilterMenu(false); }}>All</button>
                      <button onClick={() => { setChatFilter("recent"); setShowChatFilterMenu(false); }}>Recent</button>
                      <button onClick={() => { setChatFilter("older"); setShowChatFilterMenu(false); }}>Older</button>
                    </div>
                  )}
                </div>
                <button className="cat-btn-select" onClick={toggleSelectMode}>
                  {selectMode ? "Cancel" : "Select"}
                </button>
                {selectMode && (
                  <>
                    <button className="cat-btn-select" onClick={selectedIds.length === filtered.length ? deselectAllChats : selectAllChats}>
                      {selectedIds.length === filtered.length ? "Deselect all" : "Select all"}
                    </button>
                    <button className="cat-btn-select" style={{ color: "var(--danger)" }} onClick={deleteSelectedChats}>
                      Delete{selectedIds.length ? ` (${selectedIds.length})` : ""}
                    </button>
                  </>
                )}
                <button className="cat-btn-new" onClick={addChat}>New</button>
                <button className="panel-x" onClick={() => setPanel(null)}><CloseX /></button>
              </div>
            </div>
            {showChatSearch && (
              <div className="panel-search cat-search">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input autoFocus placeholder="Search chats…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            )}
            <div className="panel-list cat-list">
              {filtered.length === 0
                ? <div className="panel-empty">
                    <span className="panel-empty-icon"></span>
                    <strong>No chats yet</strong>
                    Hit New above to start your first conversation.
                  </div>
                : filtered.map(chat => (
                      <div key={chat.id} className={`cat-row${activeChatId === chat.id ? " selected" : ""}${chat.animate ? " new-chat-anim" : ""}`}>
                        {chat.renameOpen
                          ? <input className="rename-input-row" defaultValue={chat.title} autoFocus
                              onBlur={e => renameChat(chat.id, e.target.value.trim())}
                              onKeyDown={e => {
                                if (e.key === "Enter") renameChat(chat.id, e.target.value.trim());
                                if (e.key === "Escape") setChats(p => p.map(c => c.id === chat.id ? { ...c, renameOpen: false } : c));
                              }} />
                                                    : <>
                              {selectMode && (
                                <input type="checkbox" className="cat-row-checkbox"
                                  checked={selectedIds.includes(chat.id)}
                                  onChange={() => toggleSelectOne(chat.id)}
                                  onClick={e => e.stopPropagation()} />
                              )}
                              <span className="cat-row-title" onClick={() => selectMode ? toggleSelectOne(chat.id) : selectChat(chat.id)}>{chat.title}</span>
                            </>
                        }
                        <span className="cat-row-time">{formatRelativeTime(chat.id)}</span>
                        <button className="row-menu-btn cat-row-menu" onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === chat.id ? null : chat.id); }}>⋯</button>
                        {openMenuId === chat.id && (
                          <div className="row-dropdown">
                            <button onClick={() => { setChats(p => p.map(c => c.id === chat.id ? { ...c, renameOpen: true } : c)); setOpenMenuId(null); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                              </svg>
                              Rename
                            </button>
                            <button onClick={() => handleShareChat(chat)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                              </svg>
                              Share
                            </button>
                            <button onClick={() => { setAddToProjectMenuId(addToProjectMenuId === chat.id ? null : chat.id); }}>
                              <IconFolder />
                              Add to project
                            </button>
                            {addToProjectMenuId === chat.id && (
                              <div className="row-dropdown row-dropdown-sub">
                                {projects.length === 0
                                  ? <div className="picker-lbl" style={{ padding: "6px 10px" }}>No projects yet.</div>
                                  : projects.map(proj => (
                                      <button key={proj.id} onClick={() => {
                                        addChatToProject(proj.id, chat.id);
                                        setAddToProjectMenuId(null);
                                        setOpenMenuId(null);
                                      }}>
                                        <IconFolder />
                                        {proj.name}
                                        {(proj.chatIds || []).includes(chat.id) ? " ✓" : ""}
                                      </button>
                                    ))
                                }
                              </div>
                            )}
                            <div className="row-dropdown-div" />
                            <button className="del" onClick={() => requestDeleteChat(chat.id, chat.title)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                                <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                              </svg>
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))
              }
            </div>
          </>}

          {/* ── PROJECTS PANEL ── */}
                    {renderedPanel === "projects" && <>
            <div className="cat-hdr">
              <span className="cat-title">Projects</span>
              <div className="cat-actions">
                <button className="cat-btn-new" onClick={() => setShowNewProj(true)}><IconPlus /> New</button>
                <button className="panel-x" onClick={() => setPanel(null)}><CloseX /></button>
              </div>
            </div>
            {showNewProj && (
              <div className="new-proj-form">
                <input autoFocus placeholder="Project name…" value={newProjName}
                  onChange={e => setNewProjName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createProject(); if (e.key === "Escape") { setShowNewProj(false); setNewProjName(""); } }} />
                <div className="npf-actions">
                  <button className="btn-create" onClick={createProject}>Create</button>
                  <button className="btn-cancel" onClick={() => { setShowNewProj(false); setNewProjName(""); }}>Cancel</button>
                </div>
              </div>
            )}
            <div className="panel-list">
              {projects.length === 0
                ? <div className="panel-empty">
                    <span className="panel-empty-icon"></span>
                    <strong>No projects yet</strong>
                    Organise your chats into projects to keep things tidy.
                  </div>
                : <>
                    <div className="panel-section-label">{projects.length} project{projects.length !== 1 ? "s" : ""}</div>
                    {projects.map(proj => (
                      <div key={proj.id} className="proj-block">
                        <div className="proj-row">
                          {proj.renameOpen
                            ? <input className="rename-input-row" defaultValue={proj.name} autoFocus
                                onBlur={e => renameProject(proj.id, e.target.value.trim())}
                                onKeyDown={e => {
                                  if (e.key === "Enter") renameProject(proj.id, e.target.value.trim());
                                  if (e.key === "Escape") setProjects(p => p.map(pr => pr.id === proj.id ? { ...pr, renameOpen: false } : pr));
                                }} />
                            : <button className="proj-toggle" onClick={() => setOpenProjId(openProjId === proj.id ? null : proj.id)}>
                                <svg className={`chevron${openProjId === proj.id ? " open" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="9 18 15 12 9 6"/>
                                </svg>
                                <svg className="folder-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                                </svg>
                                <span>{proj.name}</span>
                              </button>
                          }
                          <button className="row-menu-btn" onClick={e => { e.stopPropagation(); setProjMenuId(projMenuId === proj.id ? null : proj.id); }}>⋯</button>
                          {projMenuId === proj.id && (
                            <div className="row-dropdown">
                              <button onClick={() => { setProjects(p => p.map(pr => pr.id === proj.id ? { ...pr, renameOpen: true } : pr)); setProjMenuId(null); }}>Rename</button>
                              <button onClick={() => { setAddChatProj(proj.id); setProjMenuId(null); }}>Add Chat</button>
                              <button onClick={() => handleShareProject(proj)}>Share</button>
                              <div className="row-dropdown-div" />
                              <button className="del" onClick={() => deleteProject(proj.id)}>Delete</button>
                            </div>
                          )}
                        </div>
                        {addChatProj === proj.id && (
                          <div className="add-chat-picker">
                            <p className="picker-lbl">Add a chat</p>
                            {chats.filter(c => !(proj.chatIds || []).includes(c.id)).length === 0
                              && <p className="panel-empty" style={{ fontSize: "11px", padding: "8px 0" }}>All chats already added.</p>}
                            {chats.filter(c => !(proj.chatIds || []).includes(c.id)).map(c => (
                              <button key={c.id} className="picker-item" onClick={() => addChatToProject(proj.id, c.id)}>{c.title}</button>
                            ))}
                            <button className="btn-cancel" style={{ marginTop: 6 }} onClick={() => setAddChatProj(null)}>Cancel</button>
                          </div>
                        )}
                        {openProjId === proj.id && (
                          <div className="proj-chats">
                            {(proj.chatIds || []).length === 0 && <p className="panel-empty" style={{ fontSize: "11px", paddingLeft: 0 }}>No chats — use ⋯ → Add Chat.</p>}
                            {(proj.chatIds || []).map(cid => {
                              const chat = chats.find(c => c.id === cid);
                              if (!chat) return null;
                              return (
                                <div key={cid} className={`chat-row proj-chat-item${activeChatId === cid ? " selected" : ""}`}>
                                  <span className="chat-row-label" onClick={() => selectChat(cid)}>{chat.title}</span>
                                  <button className="proj-chat-remove" onClick={() => removeChatFromProject(proj.id, cid)}>✕</button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
              }
            </div>
          </>}

          {/* ── CODE PANEL ── */}
                    {panel === "code" && <>
            <div className="panel-hdr">
              <span className="panel-title">
                <span className="panel-title-icon"><IconCode /></span>
                Eloria Code
              </span>
              <button className="panel-x" onClick={() => setPanel(null)}><CloseX /></button>
            </div>

            <div className="code-splash">
              <div className="code-splash-emblem"><IconCode /></div>
              <h3>Your AI code workspace</h3>
              <p>A full-featured development environment with AI completions, multi-file editing, and an integrated terminal.</p>

              <div className="code-tabs">
                <button
                  className={`code-tab${codeTab === "browser" ? " active" : ""}`}
                  onClick={() => setCodeTab("browser")}
                >
                  <IconExternal /> Browser
                </button>
                <button
                  className={`code-tab${codeTab === "terminal" ? " active" : ""}`}
                  data-tab="terminal"
                  onClick={() => setCodeTab("terminal")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                  </svg>
                  Terminal
                </button>
              </div>

              {codeTab === "browser" ? (
                <>
                  <a
                    className="code-splash-open"
                    href="/code"
                    target={window.__TAURI__ ? undefined : "_blank"}
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (window.__TAURI__) {
                        e.preventDefault();
                        openCodeWorkspace(null);
                      }
                    }}
                  >
                    <IconExternal /> Open Eloria Code
                  </a>
                  <p className="code-splash-note">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                    Opens in a new tab
                  </p>
                </>
              ) : (
                <>
                  <div className="code-cli-cmd">
                    <code>npm install -g eloria-cli</code>
                    <button className={`code-cli-copy${cliCopied ? " copied" : ""}`} onClick={copyCliCommand} title="Copy command">
                      {cliCopied ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                      )}
                    </button>
                  </div>
                  <p className="code-splash-note">Run this in your terminal to get started</p>
                </>
              )}
            </div>
          </>}

          {/* ── MOBILE ACCOUNT ── */}
          <div className="sb-mobile-acct">
            <div style={{ position: "relative", width: "100%", display: "flex", alignItems: "center", gap: "10px" }}>
              <button className="sb-avatar" onClick={() => setShowAcct(v => !v)} style={{ flexShrink: 0 }}>
                {initials}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--t1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.displayName || "Account"}</div>
                <div style={{ fontSize: "11px", color: "var(--t3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user?.email || ""}</div>
              </div>
              <button
                onClick={() => setShowLogout(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--danger)", padding: "6px", borderRadius: "var(--r-sm)", display: "flex", alignItems: "center" }}
                title="Log out"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </button>
              {showAcct && (
                <div className="acct-popup">
                  <div className="acct-head">
                    <div className="acct-av">{initials}</div>
                    <div>
                      <div className="acct-name">{user?.displayName || "Account"}</div>
                      <div className="acct-email">{user?.email || "guest@eloria.ai"}</div>
                    </div>
                  </div>
                  <div className="acct-div" />
                  {/* Download button — hidden inside Tauri */}
                  <DownloadDesktopBtn />
                  <ManageSubscriptionBtn />
                  <SettingsBtn />
                  <button className="acct-logout" onClick={(e) => {
                    e.stopPropagation(); setShowAcct(false);
                    setTimeout(() => setShowLogout(true), 0);
                  }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
                      <polyline points="16 17 21 12 16 7"/>
                      <line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── DELETE CONFIRMATION ── */}
      {deleteConfirm && (
        <div className="del-confirm-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="del-confirm-box" onClick={e => e.stopPropagation()}>
            <div className="del-confirm-top">
              <div className="del-confirm-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </div>
              <h4>Delete this chat?</h4>
              <p>
                <strong style={{ color: "var(--t2)", fontWeight: 600 }}>"{deleteConfirm.title}"</strong>
                {" "}will be permanently deleted. This cannot be undone.
              </p>
            </div>
            <div className="del-confirm-footer">
              <button className="del-confirm-cancel" onClick={() => setDeleteConfirm(null)}>Keep it</button>
              <button className="del-confirm-ok" onClick={confirmDeleteChat}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* CODE LOCK MODAL */}
      {showCodeLockModal && (
        <div className="sb-lock-backdrop" onClick={() => setShowCodeLockModal(false)}>
          <div className="sb-lock-modal" onClick={e => e.stopPropagation()}>
            <div className="sb-lock-top">
              <button className="sb-lock-close" onClick={() => setShowCodeLockModal(false)}>✕</button>
              <div className="sb-lock-icon">
                <IconCode />
              </div>
              <div className="sb-lock-title">Eloria Code</div>
              <div className="sb-lock-sub">Available on the Pro plan</div>
            </div>
            <div className="sb-lock-body">
              <div className="sb-lock-desc">
                Eloria Code is a specialist AI workspace tuned for software development. Upgrade to Pro to unlock it.
              </div>
              <div className="sb-lock-actions">
                <button className="sb-lock-cancel" onClick={() => setShowCodeLockModal(false)}>Later</button>
                <button className="sb-lock-upgrade" onClick={() => { setShowCodeLockModal(false); setPanel(null); setShowPricing(true); }}>
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareToast && (
        <div className="sb-toast">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {shareToast}
        </div>
      )}

      {/* LOGOUT MODAL */}
      {showLogout && (
        <div className="modal-back">
          <div className="modal-box">
            <h4>Log out?</h4>
            <p>Are you sure you want to log out of your Eloria account?</p>
            <div className="modal-acts">
              <button className="m-cancel" onClick={() => setShowLogout(false)}>Cancel</button>
              <button className="m-confirm" onClick={confirmLogout}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
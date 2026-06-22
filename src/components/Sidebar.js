import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";
import { shareChat, shareProject } from "../services/shareService";
import { BellButton } from "./NotificationsPanel";

const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --font: 'DM Sans', system-ui, sans-serif;
  --bg-app:      #f5f0ea;
  --bg-strip:    #ede8e1;
  --bg-panel:    #fdfaf6;
  --bg-chat:     #FBF6F0;
  --border:      #cdd0c9;
  --border-soft: #dde0d9;
  --t1: #0D3A35;
  --t2: #3a5a55;
  --t3: #7a8a84;
  --accent:      #276152;
  --accent-bg:   #eaf2ef;
  --accent-deep: #1a4a3d;
  --danger:      #c04040;
  --danger-bg:   #fdf0f0;
  --strip-w:     64px;
  --panel-w:     264px;
  --r-sm: 6px;
  --r-md: 10px;
  --r-lg: 16px;
  --shadow-panel: 2px 0 20px rgba(13,58,53,0.08);
  --shadow-pop:   0 8px 32px rgba(13,58,53,0.14);
}
  html, body, #root {
    height: 100%;
    font-family: var(--font);
    background: var(--bg-app);
    color: var(--t1);
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
      height: 100%;
      display: flex;
      flex-direction: column;
    }
  }

  .panel-hdr {
    display:flex; align-items:center; justify-content:space-between;
    padding: 18px 14px 10px; flex-shrink: 0;
  }
  .panel-title { font-size:14px; font-weight:600; color:var(--t1); letter-spacing:-.01em; }
  .panel-x {
    width:26px; height:26px; border:none; background:none;
    border-radius:var(--r-sm); cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:var(--t3); transition: background .12s, color .12s;
  }
  .panel-x:hover { background:#f0f0ec; color:var(--t1); }
  .panel-x svg  { width:14px; height:14px; }

  .panel-search {
    display:flex; align-items:center; gap:8px;
    margin: 0 12px 10px; padding: 7px 10px;
    background:#f5f5f2; border-radius:var(--r-md);
    border:1px solid transparent; transition: border-color .13s, background .13s;
    flex-shrink:0;
  }
  .panel-search:focus-within { border-color:var(--accent); background:#fff; }
  .panel-search svg   { width:13px; height:13px; color:var(--t3); flex-shrink:0; }
  .panel-search input {
    border:none; background:none; outline:none;
    font-size:13px; color:var(--t1); width:100%; font-family:var(--font);
  }
  .panel-search input::placeholder { color:var(--t3); }

  .panel-list {
    flex:1; overflow-y:auto; padding:0 8px 16px;
    scrollbar-width:thin; scrollbar-color:#e0e0da transparent;
  }
  .panel-list::-webkit-scrollbar       { width:4px; }
  .panel-list::-webkit-scrollbar-thumb { background:#ddddd8; border-radius:2px; }

  .panel-empty { font-size:12px; color:var(--t3); text-align:center; padding:28px 12px; line-height:1.6; }

  .chat-row {
    display:flex; align-items:center;
    padding: 2px 4px 2px 10px;
    border-radius:var(--r-sm); margin-bottom:1px;
    position:relative; transition:background .12s; gap:4px;
  }
  .chat-row:hover { background:#f4f4f0; }
  .chat-row.selected {
    background: var(--accent-bg);
    border-left: 2px solid rgba(193,127,42,.5);
  }
  .chat-row-label {
    flex:1; font-size:13px; color:var(--t1); cursor:pointer;
    padding:7px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    line-height:1.4;
  }
  .chat-row.selected .chat-row-label { font-weight:500; }

  .row-menu-btn {
    background:none; border:none; cursor:pointer;
    color:var(--t3); font-size:15px;
    padding:3px 5px; border-radius:4px; line-height:1;
    opacity:0; transition:opacity .12s, background .12s; flex-shrink:0;
  }
  .chat-row:hover .row-menu-btn,
  .proj-row:hover .row-menu-btn { opacity:1; }
  .row-menu-btn:hover { background:#ebebE7; color:var(--t1); }

  .row-dropdown {
    position:absolute; right:0; top:calc(100% + 2px);
    background:var(--bg-panel); border:1px solid var(--border);
    border-radius:var(--r-md); box-shadow:var(--shadow-pop);
    z-index:100; min-width:130px; padding:4px;
    animation: ddIn .12s ease;
  }
  @keyframes ddIn { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
  .row-dropdown button {
    display:block; width:100%; text-align:left;
    padding:7px 10px; font-size:13px; color:var(--t1);
    background:none; border:none; border-radius:var(--r-sm);
    cursor:pointer; font-family:var(--font); transition:background .11s;
  }
  .row-dropdown button:hover { background:#f4f4f0; }
  .row-dropdown button.del   { color:var(--danger); }
  .row-dropdown button.del:hover { background:var(--danger-bg); }

  .rename-input-row {
    flex:1; font-size:13px; padding:4px 6px;
    border:1px solid var(--accent); border-radius:var(--r-sm);
    background:#fff; color:var(--t1); outline:none; font-family:var(--font);
    margin:4px 0;
  }

  /* ── PROJECTS ───────────────────────────────────────────── */
  .new-proj-btn {
    margin: 0 12px 10px; padding: 7px 12px;
    background: var(--accent-bg);
    border: 1px dashed rgba(193,127,42,.4);
    border-radius: var(--r-md);
    color: var(--accent); font-size:13px; font-weight:500;
    cursor:pointer; text-align:left; font-family:var(--font);
    transition:background .12s; flex-shrink:0; width:calc(100% - 24px);
  }
  .new-proj-btn:hover { background:#f0e4c8; }

  .new-proj-form {
    margin:0 12px 10px; background:#fafaf8;
    border:1px solid var(--border); border-radius:var(--r-md);
    padding:10px; flex-shrink:0;
  }
  .new-proj-form input {
    width:100%; padding:6px 10px; font-size:13px;
    border:1px solid var(--accent); border-radius:var(--r-sm);
    font-family:var(--font); color:var(--t1); outline:none;
    background:#fff; margin-bottom:8px;
  }
  .npf-actions { display:flex; gap:6px; }
  .btn-create {
    padding:5px 14px; background:var(--accent); color:#fff;
    border:none; border-radius:var(--r-sm); font-size:12px;
    font-weight:500; cursor:pointer; font-family:var(--font); transition:opacity .12s;
  }
  .btn-create:hover { opacity:.87; }
  .btn-cancel {
    padding:5px 10px; background:none; color:var(--t2);
    border:1px solid var(--border); border-radius:var(--r-sm);
    font-size:12px; cursor:pointer; font-family:var(--font); transition:background .12s;
  }
  .btn-cancel:hover { background:#f4f4f0; }

  .proj-block { margin-bottom:2px; }
  .proj-row {
    display:flex; align-items:center; gap:4px;
    padding:2px 4px; border-radius:var(--r-sm);
    position:relative; transition:background .12s;
  }
  .proj-row:hover { background:#f4f4f0; }
  .proj-toggle {
    flex:1; display:flex; align-items:center; gap:6px;
    background:none; border:none; cursor:pointer;
    padding:7px 2px; font-size:13px; font-weight:500; color:var(--t1);
    font-family:var(--font); text-align:left; min-width:0;
  }
  .proj-toggle span { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .chevron {
    width:12px; height:12px; color:var(--t3); flex-shrink:0;
    transition:transform .17s ease;
  }
  .chevron.open { transform:rotate(90deg); }
  .folder-ic { width:14px; height:14px; color:var(--accent); flex-shrink:0; }

  .proj-chats {
    padding-left:12px; border-left:2px solid #e8e4da;
    margin:2px 0 4px 18px;
  }
  .proj-chat-item { padding-left:4px !important; }
  .proj-chat-remove {
    background:none; border:none; cursor:pointer;
    color:var(--t3); font-size:12px; padding:2px 5px;
    border-radius:4px; opacity:0; transition:opacity .12s, color .12s; flex-shrink:0;
  }
  .chat-row:hover .proj-chat-remove { opacity:1; }
  .proj-chat-remove:hover { color:var(--danger); }

  .add-chat-picker {
    background:#fafaf8; border:1px solid var(--border);
    border-radius:var(--r-md); margin:4px 4px 8px; padding:8px;
  }
  .picker-lbl {
    font-size:11px; color:var(--t3); margin:0 0 6px;
    font-weight:500; text-transform:uppercase; letter-spacing:.04em;
  }
  .picker-item {
    display:block; width:100%; text-align:left;
    padding:5px 8px; font-size:12.5px; color:var(--t1);
    background:none; border:none; border-radius:var(--r-sm);
    cursor:pointer; font-family:var(--font); transition:background .11s;
    white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
  }
  .picker-item:hover { background:#f0f0ec; }

  /* ── ELORIA CODE PANEL ──────────────────────────────────── */
  .code-panel-new {
    margin: 0 12px 10px;
    padding: 8px 14px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: var(--r-md);
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 7px;
    width: calc(100% - 24px);
    transition: opacity .13s;
    flex-shrink: 0;
  }
  .code-panel-new:hover { opacity: .87; }
  .code-panel-new svg { width: 15px; height: 15px; flex-shrink: 0; }

  .code-proj-form {
    margin: 0 12px 10px;
    background: #fafaf8;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    padding: 10px;
    flex-shrink: 0;
  }
  .code-proj-form input,
  .code-proj-form textarea {
    width: 100%;
    padding: 6px 10px;
    font-size: 13px;
    border: 1px solid var(--accent);
    border-radius: var(--r-sm);
    font-family: var(--font);
    color: var(--t1);
    outline: none;
    background: #fff;
    margin-bottom: 8px;
  }
  .code-proj-form textarea {
    resize: none;
    min-height: 60px;
    line-height: 1.5;
  }
  .code-proj-form input::placeholder,
  .code-proj-form textarea::placeholder { color: var(--t3); }

  .code-proj-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: var(--r-sm);
    margin-bottom: 1px;
    cursor: pointer;
    transition: background .12s;
    position: relative;
  }
  .code-proj-item:hover { background: #f4f4f0; }

  .code-proj-icon {
    width: 28px; height: 28px;
    background: #e8e4da;
    border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .code-proj-icon svg { width: 13px; height: 13px; color: var(--t2); }

  .code-proj-info { flex: 1; min-width: 0; }
  .code-proj-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--t1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .code-proj-desc {
    font-size: 11px;
    color: var(--t3);
    margin-top: 1px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .code-proj-open {
    background: none;
    border: none;
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    padding: 3px 7px;
    border-radius: var(--r-sm);
    opacity: 0;
    transition: opacity .12s, background .12s;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 3px;
    white-space: nowrap;
  }
  .code-proj-item:hover .code-proj-open { opacity: 1; }
  .code-proj-open:hover { background: var(--accent-bg); }
  .code-proj-open svg { width: 11px; height: 11px; }

  .code-proj-del {
    background: none;
    border: none;
    color: var(--t3);
    font-size: 12px;
    cursor: pointer;
    padding: 3px 5px;
    border-radius: 4px;
    opacity: 0;
    transition: opacity .12s, color .12s;
    flex-shrink: 0;
  }
  .code-proj-item:hover .code-proj-del { opacity: 1; }
  .code-proj-del:hover { color: var(--danger); }

  .code-panel-empty {
    font-size: 12px;
    color: var(--t3);
    text-align: center;
    padding: 28px 16px;
    line-height: 1.7;
  }
  .code-panel-empty strong { color: var(--t2); font-weight: 500; display: block; margin-bottom: 4px; }

  .code-open-all {
    margin: 8px 12px 0;
    padding: 7px 12px;
    background: none;
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    color: var(--t2);
    font-size: 12px;
    font-weight: 500;
    font-family: var(--font);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    width: calc(100% - 24px);
    transition: background .12s, border-color .12s;
    flex-shrink: 0;
  }
  .code-open-all:hover { background: var(--accent-bg); border-color: var(--accent); color: var(--accent); }
  .code-open-all svg { width: 13px; height: 13px; }

  /* ── OVERLAY ────────────────────────────────────────────── */
  .sb-overlay {
    position:fixed; inset:0; z-index:280;
    background:rgba(0,0,0,.18); backdrop-filter:blur(1px);
    animation:fadeIn .15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }

  /* ── LOGOUT MODAL ───────────────────────────────────────── */
  .modal-back {
    position:fixed; inset:0; z-index:600;
    background:rgba(0,0,0,.28);
    display:flex; align-items:center; justify-content:center;
    animation:fadeIn .15s ease;
  }
  .modal-box {
    background:var(--bg-panel); border-radius:var(--r-lg);
    padding:24px; width:300px; box-shadow:0 24px 60px rgba(0,0,0,.18);
    animation:slideUp .17s ease; margin: 0 16px;
  }
  @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .modal-box h4 { margin:0 0 8px; font-size:16px; font-weight:600; color:var(--t1); }
  .modal-box p  { margin:0 0 20px; font-size:13px; color:var(--t2); line-height:1.5; }
  .modal-acts   { display:flex; gap:8px; justify-content:flex-end; }
  .m-cancel {
    padding:7px 16px; background:none; border:1px solid var(--border);
    border-radius:var(--r-sm); font-size:13px; color:var(--t2);
    cursor:pointer; font-family:var(--font); transition:background .12s;
  }
  .m-cancel:hover { background:#f4f4f0; }
  .m-confirm {
    padding:7px 16px; background:var(--danger); border:none;
    border-radius:var(--r-sm); font-size:13px; font-weight:500;
    color:#fff; cursor:pointer; font-family:var(--font); transition:opacity .12s;
  }
  .m-confirm:hover { opacity:.87; }

  @keyframes chatSlide {
    from{opacity:0;transform:translateX(-8px)}
    to  {opacity:1;transform:translateX(0)}
  }
  .new-chat-anim { animation:chatSlide .2s ease; }

  /* ── MOBILE NAV ─────────────────────────────────────────── */
  .sb-mobile-nav {
    display: none;
    flex-shrink: 0;
    padding: 12px 10px 4px;
    gap: 4px;
    border-bottom: 1px solid var(--border);
  }
  @media(max-width: 640px) {
    .sb-mobile-nav { display: flex; flex-direction: column; }
  }

  .sb-mobile-nav-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: none;
    border-radius: var(--r-md);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 500;
    color: var(--t2);
    cursor: pointer;
    transition: background .13s, color .13s;
    text-align: left;
  }
  .sb-mobile-nav-btn:hover { background: #f4f4f0; color: var(--t1); }
  .sb-mobile-nav-btn.active { background: var(--accent-bg); color: var(--accent); }
  .sb-mobile-nav-btn svg { width: 18px; height: 18px; flex-shrink: 0; }

  .sb-mobile-new-chat {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border: none;
    background: var(--accent);
    border-radius: var(--r-md);
    font-family: var(--font);
    font-size: 14px;
    font-weight: 600;
    color: #fff;
    cursor: pointer;
    transition: opacity .13s;
    margin-bottom: 4px;
  }
  .sb-mobile-new-chat:hover { opacity: .88; }
  .sb-mobile-new-chat svg { width: 17px; height: 17px; flex-shrink: 0; }

  /* ── MOBILE ACCOUNT ─────────────────────────────────────── */
  .sb-mobile-acct {
    flex-shrink: 0;
    padding: 12px;
    border-top: 1px solid var(--border);
    display: none;
  }
  @media(max-width: 640px) {
    .sb-mobile-acct {
      display: flex;
      flex-shrink: 0;
      margin-top: auto;
      position: sticky;
      bottom: 0;
      background: var(--bg-panel);
      z-index: 10;
    }
  }

  /* ── CODE LOCK MODAL ────────────────────────────────────── */
  .sb-lock-backdrop {
    position: fixed; inset: 0; z-index: 600;
    background: rgba(0,0,0,.28);
    backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .sb-lock-modal {
    background: var(--bg-panel);
    border-radius: var(--r-lg);
    width: 300px; margin: 0 16px;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(13,58,53,.18);
    animation: slideUp .17s ease;
  }
  .sb-lock-top {
    background: linear-gradient(135deg, #0d3a35, #1a5a52);
    padding: 24px 20px 20px;
    text-align: center;
    position: relative;
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
  .sb-lock-title {
    font-size: 16px; font-weight: 700;
    color: #fff; margin-bottom: 5px;
  }
  .sb-lock-sub {
    font-size: 12px; color: rgba(255,255,255,.6); line-height: 1.5;
  }
  .sb-lock-body { padding: 18px 20px 20px; }
  .sb-lock-desc {
    font-size: 13px; color: var(--t2);
    line-height: 1.65; margin-bottom: 16px;
    text-align: center;
  }
  .sb-lock-actions { display: flex; gap: 8px; }
  .sb-lock-cancel {
    flex: 1; padding: 10px;
    background: none; border: 1px solid var(--border);
    border-radius: var(--r-md); font-size: 13px;
    color: var(--t2); cursor: pointer;
    font-family: var(--font); transition: background .12s;
  }
  .sb-lock-cancel:hover { background: #f4f4f0; }
  .sb-lock-upgrade {
    flex: 2; padding: 10px;
    background: linear-gradient(135deg, #0d3a35, #1a5a52);
    border: none; border-radius: var(--r-md);
    font-size: 13px; font-weight: 600;
    color: #fff; cursor: pointer;
    font-family: var(--font); transition: opacity .12s;
  }
  .sb-lock-upgrade:hover { opacity: .88; }

  /* ── SHARE TOAST ─────────────────────────────────────── */
  .sb-toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--t1);
    color: #fff;
    font-size: 13px;
    font-weight: 500;
    padding: 10px 18px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(0,0,0,.18);
    z-index: 9999;
    white-space: nowrap;
    animation: toastIn .18s ease;
    font-family: var(--font);
  }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(8px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  /* ── GROUPS PANEL (distinct from Projects) ───────────────── */

  /* Solid filled button — not dashed like Projects */
  .grp-new-btn {
    margin: 0 12px 12px;
    padding: 8px 14px;
    background: var(--accent);
    border: none;
    border-radius: var(--r-md);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font);
    display: flex;
    align-items: center;
    gap: 7px;
    width: calc(100% - 24px);
    transition: opacity .13s;
    flex-shrink: 0;
  }
  .grp-new-btn:hover { opacity: .87; }
  .grp-new-btn:disabled { opacity: .4; cursor: not-allowed; }
  .grp-new-btn svg { width: 14px; height: 14px; flex-shrink: 0; }

  /* Inline creation form — same structure, slightly tinted */
  .grp-form {
    margin: 0 12px 12px;
    background: #f2f7f5;
    border: 1px solid #c5dcd6;
    border-radius: var(--r-md);
    padding: 10px;
    flex-shrink: 0;
  }
  .grp-form input {
    width: 100%;
    padding: 7px 10px;
    font-size: 13px;
    border: 1.5px solid var(--accent);
    border-radius: var(--r-sm);
    font-family: var(--font);
    color: var(--t1);
    outline: none;
    background: #fff;
    margin-bottom: 8px;
  }

  /* Section label above the list */
  .grp-section-label {
    font-size: 10px;
    font-weight: 700;
    color: var(--t3);
    text-transform: uppercase;
    letter-spacing: .07em;
    padding: 2px 4px 6px;
    margin: 0 4px;
  }

  /* Group row — wider, two-line, rounded-square avatar */
  .grp-row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 10px 7px 8px;
    border-radius: var(--r-md);
    cursor: pointer;
    transition: background .12s;
    margin-bottom: 2px;
    position: relative;
    border-left: 3px solid transparent;
  }
  .grp-row:hover { background: #f0f5f3; }
  .grp-row.active {
    background: var(--accent-bg);
    border-left-color: var(--accent);
  }

  /* Rounded-square avatar — distinct from Projects' folder icon
     and Chats' circular avatars */
  .grp-avatar {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, var(--accent) 0%, #1a5a42 100%);
    color: #fff;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    letter-spacing: -.01em;
    box-shadow: 0 2px 6px rgba(39,97,82,.22);
  }
  .grp-row.active .grp-avatar {
    box-shadow: 0 2px 8px rgba(39,97,82,.35);
  }

  .grp-info { flex: 1; min-width: 0; }
  .grp-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--t1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .grp-preview {
    font-size: 11px;
    color: var(--t3);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-top: 2px;
    line-height: 1.3;
  }
  .grp-row.active .grp-name { color: var(--accent-deep); }

  .grp-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }

  /* Unread badge — pill shape */
  .grp-badge {
    min-width: 20px;
    height: 20px;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 6px;
  }

  /* Notification dot on the strip icon */
  .sb-btn .notif-dot {
    position: absolute; top: 7px; right: 7px;
    width: 8px; height: 8px; border-radius: 50%;
    background: #e05050; border: 1.5px solid var(--bg-strip);
  }

  /* Empty state inside groups list */
  .grp-empty {
    text-align: center;
    padding: 32px 16px 24px;
    color: var(--t3);
  }
  .grp-empty-icon {
    font-size: 28px;
    margin-bottom: 10px;
    display: block;
  }
  .grp-empty-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--t2);
    margin-bottom: 5px;
  }
  .grp-empty p {
    font-size: 12px;
    line-height: 1.6;
  }
`;

export default function Sidebar({
  user, chats, setChats,
  activeChatId, setActiveChatId,
  onLogout, sidebarOpen, setSidebarOpen,
  userPlan, setShowPricing,
  groups = [], activeGroupId, setActiveGroupId,
  pendingInviteCount = 0, setShowGroupNotifs,
  mode, setMode, createGroup, showNotifPanel, setShowNotifPanel, totalBadgeCount,
}) {
  const [panel, setPanel]           = useState(null);
  const [search, setSearch]         = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showAcct, setShowAcct]     = useState(false);
  const [showLogout, setShowLogout] = useState(false);


  const [projects, setProjects]       = useState(() => {
    try { return JSON.parse(localStorage.getItem("eloria_projects") || "[]"); } catch { return []; }
  });
  const [openProjId, setOpenProjId]   = useState(null);
  const [projMenuId, setProjMenuId]   = useState(null);
  const [newProjName, setNewProjName] = useState("");
  const [showNewProj, setShowNewProj] = useState(false);
  const [addChatProj, setAddChatProj] = useState(null);


  const [codeProjects, setCodeProjects]   = useState(() => {
    try { return JSON.parse(localStorage.getItem("eloria_code_projects") || "[]"); } catch { return []; }
  });
  const [showCodeForm, setShowCodeForm]   = useState(false);
  const [codeForm, setCodeForm]           = useState({ name: "", description: "" });

  const desktopAcctRef = useRef(null);
  const mobileAcctRef  = useRef(null);
  const [showCodeLockModal, setShowCodeLockModal] = useState(false);
  const [showGroupLockModal, setShowGroupLockModal] = useState(false);
  const [shareToast, setShareToast] = useState("");
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);

  useEffect(() => {
    if (!document.getElementById("eloria-global")) {
      const tag = document.createElement("style");
      tag.id = "eloria-global";
      tag.textContent = GLOBAL_STYLE + SIDEBAR_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

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

  const deleteChat = id => {
    const f = chats.filter(c => c.id !== id);
    setChats(f);
    if (activeChatId === id) setActiveChatId(f[0]?.id || null);
    setOpenMenuId(null);
    setProjects(p => p.map(proj => ({ ...proj, chatIds: (proj.chatIds||[]).filter(cid=>cid!==id) })));
  };

  const renameChat = (id, val) => {
    setChats(p => p.map(c => c.id===id ? { ...c, title: val||c.title, renameOpen:false } : c));
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
    setProjects(p => p.map(pr => pr.id===id ? { ...pr, name: val||pr.name, renameOpen:false } : pr));
  };

  const addChatToProject = (projId, chatId) => {
    setProjects(p => p.map(pr => pr.id===projId
      ? { ...pr, chatIds: pr.chatIds.includes(chatId) ? pr.chatIds : [...pr.chatIds, chatId] }
      : pr
    ));
    setAddChatProj(null);
  };

  const removeChatFromProject = (projId, chatId) => {
    setProjects(p => p.map(pr => pr.id===projId
      ? { ...pr, chatIds: (pr.chatIds||[]).filter(id=>id!==chatId) }
      : pr
    ));
  };


  const createCodeProject = () => {
    if (!codeForm.name.trim()) return;
    const proj = {
      id: Date.now(),
      name: codeForm.name.trim(),
      description: codeForm.description.trim(),
      createdAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    };
    setCodeProjects(p => [...p, proj]);
    setCodeForm({ name: "", description: "" });
    setShowCodeForm(false);
    openCodeWorkspace(proj.id);
  };

  const deleteCodeProject = (e, id) => {
    e.stopPropagation();
    setCodeProjects(p => p.filter(pr => pr.id !== id));
  };

  const handleShareChat = async (chat) => {
    setOpenMenuId(null);
    try {
      const url = await shareChat(chat, user);
      await navigator.clipboard.writeText(url);
      setShareToast("Link copied to clipboard!");
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
      setShareToast("Link copied to clipboard!");
      setTimeout(() => setShareToast(""), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to create share link.");
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const groupId = await createGroup(user, groupName.trim(), userPlan);
      setGroupName("");
      setShowGroupForm(false);
      setActiveGroupId(groupId);
      setMode("group");
      setPanel(null);
    } catch (err) {
      // Do NOT alert here — App.jsx's handleCreateGroup catches
      // the error and shows the styled limit modal instead.
      // Just close the form so the user sees the popup cleanly.
      setShowGroupForm(false);
      setGroupName("");
    } finally {
      setCreatingGroup(false);
    }
  };

  const openCodeWorkspace = (projectId) => {
    window.open(`/code?project=${projectId}`, "_blank");
  };

  const togglePanel = name => {
    setPanel(p => p===name ? null : name);
    setSearch(""); setOpenMenuId(null); setProjMenuId(null);
  };

  const selectChat = id => { setActiveChatId(id); setPanel(null); };

  const confirmLogout = () => {
    setShowLogout(false); setShowAcct(false); setSidebarOpen(false);
    if (onLogout) onLogout();
  };

  const filtered = chats.filter(c => c.title?.toLowerCase().includes(search.toLowerCase()));
  const initials  = user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

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

  const IconArrow = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
    </svg>
  );

  const IconFolder = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
    </svg>
  );

  return (
    <>
      {panel && <div className="sb-overlay" onClick={() => setPanel(null)} />}

      {/* ── STRIP (desktop only) ── */}
      <aside className="sb-strip">
        <div className="sb-logo"><img src={logo} alt="Eloria" /></div>

        <button className="sb-btn" title="New Chat" onClick={addChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New</span>
        </button>

        <button className={`sb-btn${panel==="chats"?" active":""}`} title="Chats" onClick={()=>togglePanel("chats")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>Chats</span>
        </button>

        <button className={`sb-btn${panel==="projects"?" active":""}`} title="Projects" onClick={()=>togglePanel("projects")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
          </svg>
          <span>Projects</span>
        </button>

        <button
          className={`sb-btn${panel === "groups" ? " active" : ""}`}
          title={userPlan === "pro" || userPlan === "admin" ? "Groups" : "Groups — Pro only"}
          onClick={() => {
            if (userPlan !== "pro" && userPlan !== "admin") {
              setShowGroupLockModal(true);
            } else {
              togglePanel("groups");
            }
          }}
          style={{ position: "relative", ...(userPlan !== "pro" && userPlan !== "admin" ? { opacity: 0.45 } : {}) }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 00-3-3.87"/>
            <path d="M16 3.13a4 4 0 010 7.75"/>
          </svg>
          <span>Groups</span>
        </button>


        <button
          className={`sb-btn${panel==="code" ? " active" : ""}`}
          title={userPlan === "pro" || userPlan === "admin" ? "Eloria Code" : "Eloria Code — Pro only"}
          onClick={() => {
            if (userPlan !== "pro" && userPlan !== "admin") {
              setShowCodeLockModal(true);
            } else {
              togglePanel("code");
            }
          }}
          style={userPlan !== "pro" && userPlan !== "admin" ? { opacity: 0.45 } : {}}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>{userPlan !== "pro" && userPlan !== "admin" ? "Code " : "Code"}</span>
        </button>

<BellButton
  count={totalBadgeCount}
  active={showNotifPanel}
  onClick={() => setShowNotifPanel(v => !v)}
/>

        <div className="sb-spacer" />

        <div className="sb-avatar-wrap" ref={desktopAcctRef}>
          <button className="sb-avatar" onClick={()=>setShowAcct(v=>!v)} title="Account">
            {initials}
          </button>
          {showAcct && (
            <div className="acct-popup">
              <div className="acct-head">
                <div className="acct-av">{initials}</div>
                <div>
                  <div className="acct-name">{user?.username||"Account"}</div>
                  <div className="acct-email">{user?.email||"guest@eloria.ai"}</div>
                </div>
              </div>
              <div className="acct-div" />
              <button className="acct-logout" onClick={(e)=>{
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

      {/* ── SLIDE PANEL ── */}
      <div className={`sb-panel${panel?" open":""}`}>
        <div className="panel-inner">

          {/* ── MOBILE NAV ── */}
          <div className="sb-mobile-nav">
            <button className="sb-mobile-new-chat" onClick={addChat}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Chat
            </button>
            <button className={`sb-mobile-nav-btn${panel==="chats"?" active":""}`} onClick={() => togglePanel("chats")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              Chats
            </button>
            <button className={`sb-mobile-nav-btn${panel==="projects"?" active":""}`} onClick={() => togglePanel("projects")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
              </svg>
              Projects
            </button>

            <button
              className={`sb-mobile-nav-btn${panel === "groups" ? " active" : ""}`}
              onClick={() => {
                if (userPlan !== "pro" && userPlan !== "admin") {
                  setPanel(null);
                  setShowGroupLockModal(true);
                } else {
                  togglePanel("groups");
                }
              }}
              style={{ position: "relative", ...(userPlan !== "pro" && userPlan !== "admin" ? { opacity: 0.45 } : {}) }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                <path d="M16 3.13a4 4 0 010 7.75"/>
              </svg>
              Groups
            </button>

        <button
              className={`sb-mobile-nav-btn${panel==="code" ? " active" : ""}`}
              onClick={() => {
                if (userPlan !== "pro" && userPlan !== "admin") {
                  setPanel(null);
                  setShowCodeLockModal(true);
                } else {
                  togglePanel("code");
                }
              }}
              style={userPlan !== "pro" && userPlan !== "admin" ? { opacity: 0.45 } : {}}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              Eloria Code {userPlan !== "pro" && userPlan !== "admin" ? "🔒" : ""}
            </button>

            {/* Bell button visible on mobile */}
            <button
              className={`sb-mobile-nav-btn${showNotifPanel ? " active" : ""}`}
              onClick={() => setShowNotifPanel(v => !v)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "relative" }}>
                <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 01-3.46 0"/>
              </svg>
              Notifications
              {totalBadgeCount > 0 && (
                <span style={{
                  marginLeft: "auto",
                  minWidth: 18, height: 18, borderRadius: 9,
                  background: "#e05050", color: "#fff",
                  fontSize: 10, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 5px",
                }}>
                  {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
                </span>
              )}
            </button>
          </div>

          {/* ── CHATS PANEL ── */}
          {panel==="chats" && <>
            <div className="panel-hdr">
              <span className="panel-title">Chats</span>
              <button className="panel-x" onClick={()=>setPanel(null)}><CloseX/></button>
            </div>
            <div className="panel-search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input placeholder="Search chats…" value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
            <div className="panel-list">
              {filtered.length===0 && <p className="panel-empty">No chats yet — hit New to start one.</p>}
              {filtered.map(chat => (
                <div key={chat.id} className={`chat-row${activeChatId===chat.id?" selected":""}${chat.animate?" new-chat-anim":""}`}>
                  {chat.renameOpen
                    ? <input className="rename-input-row" defaultValue={chat.title} autoFocus
                        onBlur={e=>renameChat(chat.id, e.target.value.trim())}
                        onKeyDown={e=>{
                          if(e.key==="Enter") renameChat(chat.id, e.target.value.trim());
                          if(e.key==="Escape") setChats(p=>p.map(c=>c.id===chat.id?{...c,renameOpen:false}:c));
                        }} />
                    : <span className="chat-row-label" onClick={()=>selectChat(chat.id)}>{chat.title}</span>
                  }
                  <button className="row-menu-btn" onClick={e=>{e.stopPropagation();setOpenMenuId(openMenuId===chat.id?null:chat.id);}}>⋯</button>
                  {openMenuId===chat.id && (
                    <div className="row-dropdown">
                      <button onClick={()=>{setChats(p=>p.map(c=>c.id===chat.id?{...c,renameOpen:true}:c));setOpenMenuId(null);}}>Rename</button>
                      <button onClick={() => handleShareChat(chat)}>Share</button>
                      <button className="del" onClick={()=>deleteChat(chat.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>}

          {/* ── PROJECTS PANEL ── */}
          {panel==="projects" && <>
            <div className="panel-hdr">
              <span className="panel-title">Projects</span>
              <button className="panel-x" onClick={()=>setPanel(null)}><CloseX/></button>
            </div>
            <button className="new-proj-btn" onClick={()=>setShowNewProj(true)}>+ New Project</button>
            {showNewProj && (
              <div className="new-proj-form">
                <input autoFocus placeholder="Project name…" value={newProjName}
                  onChange={e=>setNewProjName(e.target.value)}
                  onKeyDown={e=>{if(e.key==="Enter")createProject();if(e.key==="Escape"){setShowNewProj(false);setNewProjName("");}}} />
                <div className="npf-actions">
                  <button className="btn-create" onClick={createProject}>Create</button>
                  <button className="btn-cancel" onClick={()=>{setShowNewProj(false);setNewProjName("");}}>Cancel</button>
                </div>
              </div>
            )}
            <div className="panel-list">
              {projects.length===0 && <p className="panel-empty">No projects yet — organize your chats into projects.</p>}
              {projects.map(proj => (
                <div key={proj.id} className="proj-block">
                  <div className="proj-row">
                    {proj.renameOpen
                      ? <input className="rename-input-row" defaultValue={proj.name} autoFocus
                          onBlur={e=>renameProject(proj.id, e.target.value.trim())}
                          onKeyDown={e=>{
                            if(e.key==="Enter") renameProject(proj.id,e.target.value.trim());
                            if(e.key==="Escape") setProjects(p=>p.map(pr=>pr.id===proj.id?{...pr,renameOpen:false}:pr));
                          }} />
                      : <button className="proj-toggle" onClick={()=>setOpenProjId(openProjId===proj.id?null:proj.id)}>
                          <svg className={`chevron${openProjId===proj.id?" open":""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                          <svg className="folder-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
                          </svg>
                          <span>{proj.name}</span>
                        </button>
                    }
                    <button className="row-menu-btn" onClick={e=>{e.stopPropagation();setProjMenuId(projMenuId===proj.id?null:proj.id);}}>⋯</button>
                    {projMenuId===proj.id && (
                      <div className="row-dropdown">
                        <button onClick={()=>{setProjects(p=>p.map(pr=>pr.id===proj.id?{...pr,renameOpen:true}:pr));setProjMenuId(null);}}>Rename</button>
                        <button onClick={()=>{setAddChatProj(proj.id);setProjMenuId(null);}}>Add Chat</button>
                        <button onClick={() => handleShareProject(proj)}>Share</button>
                        <button className="del" onClick={()=>deleteProject(proj.id)}>Delete</button>
                      </div>
                    )}
                  </div>
                  {addChatProj===proj.id && (
                    <div className="add-chat-picker">
                      <p className="picker-lbl">Add a chat</p>
                      {chats.filter(c=>!(proj.chatIds||[]).includes(c.id)).length===0
                        && <p className="panel-empty" style={{fontSize:"11px",padding:"8px 0"}}>All chats already added.</p>}
                      {chats.filter(c=>!(proj.chatIds||[]).includes(c.id)).map(c=>(
                        <button key={c.id} className="picker-item" onClick={()=>addChatToProject(proj.id,c.id)}>{c.title}</button>
                      ))}
                      <button className="btn-cancel" style={{marginTop:6}} onClick={()=>setAddChatProj(null)}>Cancel</button>
                    </div>
                  )}
                  {openProjId===proj.id && (
                    <div className="proj-chats">
                      {(proj.chatIds||[]).length===0 && <p className="panel-empty" style={{fontSize:"11px",paddingLeft:0}}>No chats — use ⋯ → Add Chat.</p>}
                      {(proj.chatIds||[]).map(cid=>{
                        const chat=chats.find(c=>c.id===cid);
                        if(!chat) return null;
                        return (
                          <div key={cid} className={`chat-row proj-chat-item${activeChatId===cid?" selected":""}`}>
                            <span className="chat-row-label" onClick={()=>selectChat(cid)}>{chat.title}</span>
                            <button className="proj-chat-remove" onClick={()=>removeChatFromProject(proj.id,cid)}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>}

          {/* ── GROUPS PANEL ── */}
          {panel === "groups" && <>
            <div className="panel-hdr">
              <span className="panel-title">Groups</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="panel-x" onClick={() => setPanel(null)}><CloseX /></button>
              </div>
            </div>

            {/* Solid filled "New Group" button — distinct from dashed Projects btn */}
            <button
              className="grp-new-btn"
              onClick={() => setShowGroupForm(v => !v)}
              disabled={creatingGroup}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Group
            </button>

            {showGroupForm && (
              <div className="grp-form">
                <input
                  autoFocus
                  placeholder="Group name…"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleCreateGroup();
                    if (e.key === "Escape") { setShowGroupForm(false); setGroupName(""); }
                  }}
                />
                <div className="npf-actions">
                  <button
                    className="btn-create"
                    onClick={handleCreateGroup}
                    disabled={!groupName.trim() || creatingGroup}
                    style={{ opacity: groupName.trim() && !creatingGroup ? 1 : .45 }}
                  >
                    {creatingGroup ? "Creating…" : "Create"}
                  </button>
                  <button className="btn-cancel" onClick={() => { setShowGroupForm(false); setGroupName(""); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="panel-list">
              {groups.length === 0 ? (
                <div className="grp-empty">
                  <span className="grp-empty-icon">💬</span>
                  <div className="grp-empty-title">No groups yet</div>
                  <p>Create one above or wait for an invite from someone.</p>
                </div>
              ) : (
                <>
                  {groups.length > 0 && (
                    <div className="grp-section-label">
                      {groups.length} group{groups.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  {groups
                    .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
                    .map(group => {
                      const unread = group.unreadCounts?.[user?.uid] || 0;
                      return (
                        <div
                          key={group.id}
                          className={`grp-row${activeGroupId === group.id ? " active" : ""}`}
                          onClick={() => {
                            setActiveGroupId(group.id);
                            setMode("group");
                            setPanel(null);
                          }}
                        >
                          {/* Rounded-square avatar — visually distinct from circular chat avatars */}
                          <div className="grp-avatar">
                            {group.name?.[0]?.toUpperCase() || "G"}
                          </div>
                          <div className="grp-info">
                            <div className="grp-name">{group.name}</div>
                            <div className="grp-preview">
                              {group.lastMessage
                                ? `${group.lastMessage.senderName?.split(" ")[0]}: ${group.lastMessage.text?.slice(0, 28)}…`
                                : `${group.members?.length || 1} member${group.members?.length !== 1 ? "s" : ""}`}
                            </div>
                          </div>
                          {unread > 0 && (
                            <div className="grp-meta">
                              <div className="grp-badge">{unread > 99 ? "99+" : unread}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </>
              )}
            </div>
          </>}

          {/* ── ELORIA CODE PANEL ── */}
          {panel==="code" && <>
            <div className="panel-hdr">
              <span className="panel-title">Eloria Code</span>
              <button className="panel-x" onClick={()=>setPanel(null)}><CloseX/></button>
            </div>
            <button className="code-panel-new" onClick={()=>setShowCodeForm(v=>!v)}>
              <IconPlus /> New project
            </button>
            {showCodeForm && (
              <div className="code-proj-form">
                <input
                  autoFocus
                  placeholder="Project name…"
                  value={codeForm.name}
                  onChange={e => setCodeForm(f => ({ ...f, name: e.target.value }))}
                  onKeyDown={e => { if (e.key === "Escape") { setShowCodeForm(false); setCodeForm({ name: "", description: "" }); } }}
                />
                <textarea
                  placeholder="Description (optional)…"
                  value={codeForm.description}
                  onChange={e => setCodeForm(f => ({ ...f, description: e.target.value }))}
                />
                <div className="npf-actions">
                  <button
                    className="btn-create"
                    disabled={!codeForm.name.trim()}
                    onClick={createCodeProject}
                    style={{ opacity: codeForm.name.trim() ? 1 : 0.45, cursor: codeForm.name.trim() ? "pointer" : "not-allowed" }}
                  >
                    Create &amp; open
                  </button>
                  <button className="btn-cancel" onClick={() => { setShowCodeForm(false); setCodeForm({ name: "", description: "" }); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            <div className="panel-list">
              {codeProjects.length === 0
                ? <div className="code-panel-empty">
                    <strong>No code projects yet</strong>
                    Create a project to open the Eloria Code workspace in a new tab.
                  </div>
                : <>
                    {codeProjects.map(proj => (
                      <div key={proj.id} className="code-proj-item" onClick={() => openCodeWorkspace(proj.id)}>
                        <div className="code-proj-icon"><IconFolder /></div>
                        <div className="code-proj-info">
                          <div className="code-proj-name">{proj.name}</div>
                          <div className="code-proj-desc">{proj.description || proj.createdAt}</div>
                        </div>
                        <button className="code-proj-open" onClick={e => { e.stopPropagation(); openCodeWorkspace(proj.id); }} title="Open workspace">
                          Open <IconArrow />
                        </button>
                        <button className="code-proj-del" onClick={e => deleteCodeProject(e, proj.id)} title="Delete">✕</button>
                      </div>
                    ))}
                    <button className="code-open-all" onClick={() => window.open("/code", "_blank")}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:13,height:13}}>
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
                        <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                      </svg>
                      Open Eloria Code workspace
                    </button>
                  </>
              }
            </div>
          </>}

          {/* ── MOBILE ACCOUNT ── */}
          <div className="sb-mobile-acct" ref={mobileAcctRef}>
            <div style={{position:"relative", width:"100%", display:"flex", alignItems:"center", gap:"10px"}}>
              <button className="sb-avatar" onClick={()=>setShowAcct(v=>!v)} style={{flexShrink:0}}>
                {initials}
              </button>
              <div style={{flex:1, minWidth:0}}>
                <div style={{fontSize:"13px", fontWeight:600, color:"var(--t1)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{user?.username||"Account"}</div>
                <div style={{fontSize:"11px", color:"var(--t3)", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>{user?.email||""}</div>
              </div>
              <button
                onClick={()=>{ setShowLogout(true); }}
                style={{background:"none",border:"none",cursor:"pointer",color:"var(--danger)",padding:"6px",borderRadius:"var(--r-sm)",display:"flex",alignItems:"center"}}
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
                      <div className="acct-name">{user?.username||"Account"}</div>
                      <div className="acct-email">{user?.email||"guest@eloria.ai"}</div>
                    </div>
                  </div>
                  <div className="acct-div" />
                  <button className="acct-logout" onClick={(e)=>{
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
          </div>

        </div>
      </div>


      {/* GROUP LOCK MODAL */}
      {showGroupLockModal && (
        <div className="sb-lock-backdrop" onClick={() => setShowGroupLockModal(false)}>
          <div className="sb-lock-modal" onClick={e => e.stopPropagation()}>
            <div className="sb-lock-top">
              <button className="sb-lock-close" onClick={() => setShowGroupLockModal(false)}>✕</button>
              <div className="sb-lock-icon"></div>
              <div className="sb-lock-title">Groups</div>
              <div className="sb-lock-sub">Available on the Pro plan</div>
            </div>
            <div className="sb-lock-body">
              <div className="sb-lock-desc">
                Create group chats with up to 6 members and 4 groups. Upgrade to Pro to unlock Groups.
              </div>
              <div className="sb-lock-actions">
                <button className="sb-lock-cancel" onClick={() => setShowGroupLockModal(false)}>
                  Later
                </button>
                <button className="sb-lock-upgrade" onClick={() => {
                  setShowGroupLockModal(false);
                  setPanel(null);
                  setShowPricing(true);
                }}>
                  Upgrade to Pro →
                </button>
              </div>
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
              <div className="sb-lock-icon"></div>
              <div className="sb-lock-title">Eloria Code</div>
              <div className="sb-lock-sub">Available on the Pro plan</div>
            </div>
            <div className="sb-lock-body">
              <div className="sb-lock-desc">
                Eloria Code is a specialist AI workspace tuned for software development. Upgrade to Pro to unlock it.
              </div>
              <div className="sb-lock-actions">
                <button className="sb-lock-cancel" onClick={() => setShowCodeLockModal(false)}>
                  Later
                </button>
                <button className="sb-lock-upgrade" onClick={() => {
                  setShowCodeLockModal(false);
                  setPanel(null);
                  setShowPricing(true);
                }}>
                  Upgrade to Pro →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {shareToast && (
        <div className="sb-toast">{shareToast}</div>
      )}

      {/* LOGOUT MODAL */}
      {showLogout && (
        <div className="modal-back">
          <div className="modal-box">
            <h4>Log out?</h4>
            <p>Are you sure you want to log out of your Eloria account?</p>
            <div className="modal-acts">
              <button className="m-cancel" onClick={()=>setShowLogout(false)}>Cancel</button>
              <button className="m-confirm" onClick={confirmLogout}>Log out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
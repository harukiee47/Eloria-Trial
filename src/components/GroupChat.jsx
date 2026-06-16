import React, { useState, useEffect, useRef, useCallback } from "react";
import { auth } from "../services/firebase";
import {
  subscribeToMessages, sendGroupMessage, clearUnread,
  inviteToGroup, kickMember, leaveGroup, deleteGroup, renameGroup,
  deleteGroupMessage,
} from "../services/groupService";

const GC_STYLE = `
  /* ── GROUP CHAT WRAPPER ─────────────────────────────────── */
  .gc-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--bg-chat);
    font-family: var(--font);
  }

  /* ── TOUCH / MOBILE BASE TWEAKS ─────────────────────────── */
  .gc-header-back, .gc-icon-btn, .gc-send-btn, .gc-info-close,
  .gc-reply-bar-close, .gc-rename-save, .gc-invite-btn,
  .gc-kick-btn, .gc-danger-btn, .gc-ctx-item {
    -webkit-tap-highlight-color: transparent;
  }

  /* ── HEADER ─────────────────────────────────────────────── */
  .gc-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    background: var(--bg-panel);
    flex-shrink: 0;
  }
  .gc-header-back {
    background: none; border: none; cursor: pointer;
    color: var(--t3); padding: 4px; border-radius: 6px;
    display: flex; align-items: center; transition: color .12s, background .12s;
  }
  .gc-header-back:hover { color: var(--t1); background: #f0f0ec; }
  .gc-header-back svg { width: 18px; height: 18px; }
  .gc-header-avatar {
    width: 34px; height: 34px; border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #276152);
    color: #fff; font-size: 13px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; letter-spacing: -.01em;
  }
  .gc-header-info { flex: 1; min-width: 0; }
  .gc-header-name {
    font-size: 14px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .gc-header-members { font-size: 11px; color: var(--t3); margin-top: 1px; }
  .gc-header-actions { display: flex; gap: 4px; }
  .gc-icon-btn {
    background: none; border: none; cursor: pointer;
    color: var(--t3); padding: 6px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    transition: color .12s, background .12s;
  }
  .gc-icon-btn:hover { color: var(--t1); background: #f0f0ec; }
  .gc-icon-btn svg { width: 17px; height: 17px; }

  /* ── MESSAGES ────────────────────────────────────────────── */
  .gc-messages {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 16px 16px 8px;
    display: flex; flex-direction: column; gap: 2px;
    scrollbar-width: thin; scrollbar-color: #e0e0da transparent;
    -webkit-overflow-scrolling: touch;
  }
  .gc-messages::-webkit-scrollbar { width: 4px; }
  .gc-messages::-webkit-scrollbar-thumb { background: #ddddd8; border-radius: 2px; }

  .gc-empty {
    flex: 1; display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    color: var(--t3); text-align: center; padding: 32px;
  }
  .gc-empty-icon { font-size: 32px; margin-bottom: 10px; }
  .gc-empty-title { font-size: 14px; font-weight: 600; color: var(--t2); margin-bottom: 5px; }
  .gc-empty p { font-size: 13px; line-height: 1.6; }
  .gc-empty code {
    background: var(--accent-bg); color: var(--accent);
    padding: 1px 6px; border-radius: 5px; font-size: 12px;
    font-family: monospace;
  }

  .gc-day-divider {
    text-align: center; font-size: 11px; color: var(--t3);
    margin: 12px 0 6px; position: relative;
  }
  .gc-day-divider::before {
    content: ""; position: absolute; top: 50%; left: 0; right: 0;
    height: 1px; background: var(--border);
  }
  .gc-day-divider span {
    position: relative; background: var(--bg-chat);
    padding: 0 10px;
  }

  .gc-msg-group { margin-bottom: 10px; }

  .gc-msg-row {
    display: flex; gap: 8px; align-items: flex-end;
    margin-bottom: 2px; position: relative;
  }
  .gc-msg-row.self { flex-direction: row-reverse; }
  .gc-msg-row.pressing .gc-bubble {
    opacity: .6;
    transform: scale(.985);
  }

  .gc-msg-avatar {
    width: 28px; height: 28px; border-radius: 50%;
    background: linear-gradient(135deg, #6a9a94, #3a7a6a);
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; margin-bottom: 2px;
  }
  .gc-msg-avatar.eloria-av {
    background: linear-gradient(135deg, var(--accent), #1a5a52);
  }
  .gc-msg-avatar.placeholder { background: transparent; }

  .gc-msg-content { max-width: 72%; display: flex; flex-direction: column; }
  .gc-msg-row.self .gc-msg-content { align-items: flex-end; }

  .gc-sender-name {
    font-size: 10px; font-weight: 600; color: var(--t3);
    margin-bottom: 3px; padding-left: 2px;
  }
  .gc-msg-row.self .gc-sender-name { display: none; }

  /* ── REPLY QUOTE inside a bubble ─────────────────────────── */
  .gc-reply-quote {
    display: flex; gap: 6px; margin-bottom: 6px;
    padding: 5px 8px; border-radius: 8px;
    background: rgba(0,0,0,.08);
    border-left: 3px solid rgba(255,255,255,.5);
    cursor: default;
  }
  .gc-bubble.other .gc-reply-quote {
    background: #f0f0ec;
    border-left-color: var(--accent);
  }
  .gc-reply-quote-name {
    font-size: 10px; font-weight: 700; color: var(--accent);
    white-space: nowrap; flex-shrink: 0;
  }
  .gc-bubble.other .gc-reply-quote-name { color: var(--accent); }
  .gc-bubble.self .gc-reply-quote-name,
  .gc-bubble.eloria .gc-reply-quote-name { color: rgba(255,255,255,.75); }
  .gc-reply-quote-text {
    font-size: 11px; color: var(--t2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex: 1; min-width: 0;
  }
  .gc-bubble.self .gc-reply-quote-text,
  .gc-bubble.eloria .gc-reply-quote-text { color: rgba(255,255,255,.65); }

  .gc-bubble {
    padding: 9px 13px; border-radius: 16px;
    font-size: 13.5px; line-height: 1.55; color: var(--t1);
    word-break: break-word; cursor: default;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    transition: opacity .12s, transform .12s;
  }
  .gc-bubble.other {
    background: #fff;
    border: 1px solid var(--border-soft);
    border-bottom-left-radius: 5px;
  }
  .gc-bubble.self {
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 5px;
  }
  .gc-bubble.eloria {
    background: linear-gradient(135deg, #0d3a35 0%, #1a5a52 100%);
    color: #fff;
    border-bottom-left-radius: 5px;
    border: none;
  }
  .gc-bubble .eloria-tag {
    font-size: 10px; font-weight: 700; letter-spacing: .05em;
    opacity: .7; margin-bottom: 4px; text-transform: uppercase;
  }

  /* ── DELETED message placeholder ───────────────────────── */
  .gc-bubble.deleted {
    background: transparent !important;
    border: 1px dashed var(--border);
    color: var(--t3) !important;
    font-style: italic;
    font-size: 12px;
  }

  /* ── @MENTION highlight ──────────────────────────────────── */
  .gc-mention {
    background: var(--accent-bg);
    color: var(--accent);
    border-radius: 4px;
    padding: 0 3px;
    font-weight: 600;
    font-size: 0.95em;
  }

  .gc-msg-time {
    font-size: 10px; color: var(--t3);
    margin-top: 3px; padding: 0 3px;
  }

  .gc-typing {
    display: flex; align-items: center; gap: 6px;
    padding: 6px 0 4px;
  }
  .gc-typing-dots { display: flex; gap: 4px; }
  .gc-typing-dots span {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--t3); animation: typingPulse 1.2s infinite;
  }
  .gc-typing-dots span:nth-child(2) { animation-delay: .2s; }
  .gc-typing-dots span:nth-child(3) { animation-delay: .4s; }
  @keyframes typingPulse {
    0%, 80%, 100% { opacity: .3; transform: scale(.85); }
    40% { opacity: 1; transform: scale(1); }
  }
  .gc-typing-label { font-size: 12px; color: var(--t3); font-style: italic; }

  /* ── CONTEXT MENU ────────────────────────────────────────── */
  .gc-ctx-backdrop { display: none; }
  .gc-ctx-menu {
    position: fixed;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    box-shadow: 0 8px 28px rgba(13,58,53,.16);
    z-index: 800;
    min-width: 150px;
    padding: 4px;
    animation: ctxIn .12s ease;
  }
  @keyframes ctxIn {
    from { opacity: 0; transform: scale(.95); }
    to   { opacity: 1; transform: scale(1); }
  }
  @keyframes ctxSheetIn {
    from { opacity: 0; transform: translateY(100%); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .gc-ctx-item {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 8px 11px;
    border: none; background: none;
    border-radius: var(--r-sm);
    font-size: 13px; color: var(--t1);
    cursor: pointer; font-family: var(--font);
    text-align: left; transition: background .11s;
  }
  .gc-ctx-item:hover { background: #f4f4f0; }
  .gc-ctx-item.danger { color: var(--danger); }
  .gc-ctx-item.danger:hover { background: var(--danger-bg); }
  .gc-ctx-item svg { width: 14px; height: 14px; flex-shrink: 0; }
  .gc-ctx-divider { height: 1px; background: var(--border-soft); margin: 3px 6px; }

  /* ── BOTTOM-SHEET DRAG HANDLE (mobile only) ─────────────── */
  .gc-sheet-handle { display: none; }

  /* ── REPLY PREVIEW BAR (above input) ────────────────────── */
  .gc-reply-bar {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 14px;
    background: var(--accent-bg);
    border-top: 1px solid #c8e0d8;
    flex-shrink: 0;
    animation: replyBarIn .13s ease;
  }
  @keyframes replyBarIn {
    from { opacity: 0; transform: translateY(4px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .gc-reply-bar-line {
    width: 3px; height: 32px; border-radius: 2px;
    background: var(--accent); flex-shrink: 0;
  }
  .gc-reply-bar-body { flex: 1; min-width: 0; }
  .gc-reply-bar-label {
    font-size: 10px; font-weight: 700; color: var(--accent);
    text-transform: uppercase; letter-spacing: .05em; margin-bottom: 2px;
  }
  .gc-reply-bar-text {
    font-size: 12px; color: var(--t2);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .gc-reply-bar-close {
    background: none; border: none; cursor: pointer;
    color: var(--t3); padding: 4px; border-radius: 5px;
    display: flex; align-items: center; transition: color .12s, background .12s;
    flex-shrink: 0;
  }
  .gc-reply-bar-close:hover { color: var(--t1); background: #deeee8; }
  .gc-reply-bar-close svg { width: 13px; height: 13px; }

  /* ── INPUT ───────────────────────────────────────────────── */
  .gc-input-bar {
    padding: 10px 14px 14px;
    background: var(--bg-panel);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    position: relative;
  }
  .gc-eloria-note {
    font-size: 11px; color: var(--t3); text-align: center;
    margin-bottom: 7px; line-height: 1.5;
  }
  .gc-eloria-note code {
    background: var(--accent-bg); color: var(--accent);
    padding: 1px 5px; border-radius: 4px; font-family: monospace; font-size: 11px;
  }
  .gc-input-row {
    display: flex; gap: 8px; align-items: flex-end;
  }
  .gc-textarea {
    flex: 1; resize: none; border: 1.5px solid var(--border);
    border-radius: 14px; padding: 10px 14px;
    font-size: 14px; font-family: var(--font); color: var(--t1);
    background: #fff; outline: none; min-height: 44px; max-height: 140px;
    line-height: 1.5; transition: border-color .13s;
    scrollbar-width: thin;
  }
  .gc-textarea:focus { border-color: var(--accent); }
  .gc-textarea::placeholder { color: var(--t3); }
  .gc-send-btn {
    width: 42px; height: 42px; border-radius: 12px;
    background: var(--accent); border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: #fff; flex-shrink: 0; transition: opacity .13s;
  }
  .gc-send-btn:hover { opacity: .87; }
  .gc-send-btn:disabled { opacity: .4; cursor: not-allowed; }
  .gc-send-btn svg { width: 17px; height: 17px; }

  /* ── @MENTION DROPDOWN ───────────────────────────────────── */
  .gc-mention-dropdown {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 14px; right: 14px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--r-md);
    box-shadow: 0 4px 20px rgba(13,58,53,.14);
    z-index: 700;
    overflow: hidden;
    max-height: 180px;
    overflow-y: auto;
  }
  .gc-mention-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px;
    cursor: pointer;
    transition: background .1s;
    font-size: 13px; color: var(--t1);
  }
  .gc-mention-item:hover, .gc-mention-item.active {
    background: var(--accent-bg);
  }
  .gc-mention-av {
    width: 26px; height: 26px; border-radius: 50%;
    background: linear-gradient(135deg, #6a9a94, #3a7a6a);
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .gc-mention-email { font-size: 12px; color: var(--t3); }

  /* ── LIMIT MODAL ─────────────────────────────────────────── */
  .gc-limit-backdrop {
    position: fixed; inset: 0; z-index: 900;
    background: rgba(0,0,0,.35); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .gc-limit-modal {
    background: var(--bg-panel);
    border-radius: var(--r-lg);
    width: 320px; margin: 0 20px;
    box-shadow: 0 24px 60px rgba(13,58,53,.2);
    animation: slideUp .17s ease;
    overflow: hidden;
  }
  .gc-limit-icon {
    font-size: 36px; text-align: center;
    padding: 24px 24px 8px;
  }
  .gc-limit-title {
    font-size: 16px; font-weight: 700; color: var(--t1);
    text-align: center; padding: 0 24px 8px;
  }
  .gc-limit-msg {
    font-size: 13px; color: var(--t2); line-height: 1.6;
    text-align: center; padding: 0 24px 20px;
  }
  .gc-limit-close {
    display: block; width: calc(100% - 32px);
    margin: 0 16px 20px;
    padding: 10px;
    background: var(--accent); border: none; border-radius: var(--r-md);
    color: #fff; font-size: 14px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    transition: opacity .12s;
  }
  .gc-limit-close:hover { opacity: .87; }


  /* ── CONFIRM MODAL ───────────────────────────────────────── */
  .gc-confirm-backdrop {
    position: fixed; inset: 0; z-index: 950;
    background: rgba(0,0,0,.4); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .gc-confirm-modal {
    background: var(--bg-panel);
    border-radius: var(--r-lg);
    width: 300px; margin: 0 20px;
    box-shadow: 0 24px 60px rgba(13,58,53,.22);
    animation: slideUp .17s ease;
    overflow: hidden;
    padding: 24px;
  }
  .gc-confirm-title {
    font-size: 15px; font-weight: 700; color: var(--t1);
    margin-bottom: 10px;
  }
  .gc-confirm-msg {
    font-size: 13px; color: var(--t2); line-height: 1.6;
    margin-bottom: 20px;
  }
  .gc-confirm-btns {
    display: flex; gap: 8px; justify-content: flex-end;
  }
  .gc-confirm-cancel {
    padding: 8px 16px;
    background: none; border: 1px solid var(--border);
    border-radius: var(--r-sm); color: var(--t2);
    font-size: 13px; font-weight: 500;
    cursor: pointer; font-family: var(--font);
    transition: background .12s;
  }
  .gc-confirm-cancel:hover { background: #f0f0ec; }
  .gc-confirm-ok {
    padding: 8px 16px;
    background: var(--danger); border: none;
    border-radius: var(--r-sm); color: #fff;
    font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    transition: opacity .12s;
  }
  .gc-confirm-ok:hover { opacity: .87; }

  /* ── INFO PANEL ──────────────────────────────────────────── */
  .gc-info-backdrop {
    position: fixed; inset: 0; z-index: 600;
    background: rgba(0,0,0,.28); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .gc-info-panel {
    background: var(--bg-panel); border-radius: var(--r-lg);
    width: 320px; max-height: 80vh; overflow-y: auto;
    margin: 0 16px; box-shadow: 0 24px 60px rgba(13,58,53,.18);
    animation: slideUp .17s ease;
  }
  .gc-info-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 18px 12px;
    border-bottom: 1px solid var(--border);
  }
  .gc-info-hdr h3 { font-size: 15px; font-weight: 600; color: var(--t1); margin: 0; }
  .gc-info-close {
    background: none; border: none; cursor: pointer; color: var(--t3);
    width: 28px; height: 28px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s; font-size: 14px;
  }
  .gc-info-close:hover { background: #f0f0ec; color: var(--t1); }
  .gc-info-section { padding: 14px 18px; }
  .gc-info-section + .gc-info-section { border-top: 1px solid var(--border-soft); }
  .gc-info-label {
    font-size: 10px; font-weight: 700; color: var(--t3);
    text-transform: uppercase; letter-spacing: .06em; margin-bottom: 10px;
  }
  .gc-rename-row { display: flex; gap: 8px; }
  .gc-rename-input {
    flex: 1; padding: 7px 10px; border: 1.5px solid var(--accent);
    border-radius: var(--r-sm); font-size: 13px; font-family: var(--font);
    color: var(--t1); outline: none; background: #fff;
  }
  .gc-rename-save {
    padding: 7px 14px; background: var(--accent); border: none;
    border-radius: var(--r-sm); color: #fff; font-size: 13px;
    font-weight: 500; cursor: pointer; font-family: var(--font);
    transition: opacity .12s;
  }
  .gc-rename-save:hover { opacity: .87; }
  .gc-member-row {
    display: flex; align-items: center; gap: 10px;
    padding: 6px 0; border-radius: var(--r-sm);
  }
  .gc-member-av {
    width: 30px; height: 30px; border-radius: 50%;
    background: linear-gradient(135deg, #6a9a94, #3a7a6a);
    color: #fff; font-size: 12px; font-weight: 600;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .gc-member-name { flex: 1; font-size: 13px; color: var(--t1); }
  .gc-member-tag {
    font-size: 10px; font-weight: 600; color: var(--t3);
    background: #f0f0ec; border-radius: 4px; padding: 2px 6px;
  }
  .gc-kick-btn {
    background: none; border: none; cursor: pointer; color: var(--t3);
    font-size: 12px; padding: 3px 7px; border-radius: 4px;
    transition: color .12s, background .12s; font-family: var(--font);
  }
  .gc-kick-btn:hover { color: var(--danger); background: var(--danger-bg); }
  .gc-invite-row { display: flex; gap: 8px; margin-top: 8px; }
  .gc-invite-input {
    flex: 1; padding: 7px 10px; border: 1.5px solid var(--border);
    border-radius: var(--r-sm); font-size: 13px; font-family: var(--font);
    color: var(--t1); outline: none; background: #fff;
    transition: border-color .13s;
  }
  .gc-invite-input:focus { border-color: var(--accent); }
  .gc-invite-input::placeholder { color: var(--t3); }
  .gc-invite-btn {
    padding: 7px 14px; background: var(--accent); border: none;
    border-radius: var(--r-sm); color: #fff; font-size: 13px;
    font-weight: 500; cursor: pointer; font-family: var(--font);
    white-space: nowrap; transition: opacity .12s;
  }
  .gc-invite-btn:hover { opacity: .87; }
  .gc-invite-btn:disabled { opacity: .4; cursor: not-allowed; }
  .gc-invite-feedback { font-size: 12px; margin-top: 6px; padding: 0 2px; }
  .gc-invite-feedback.ok { color: #2a7a52; }
  .gc-invite-feedback.err { color: var(--danger); }
  .gc-danger-btn {
    width: 100%; padding: 9px; background: none;
    border: 1px solid var(--danger); border-radius: var(--r-md);
    color: var(--danger); font-size: 13px; font-weight: 500;
    cursor: pointer; font-family: var(--font); transition: background .12s;
  }
  .gc-danger-btn:hover { background: var(--danger-bg); }

  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  @keyframes slideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes slideUpSheet { from{transform:translateY(100%)} to{transform:translateY(0)} }

  /* ══════════════════════════════════════════════════════════
     MOBILE OPTIMIZATIONS
     ══════════════════════════════════════════════════════════ */
  @media (max-width: 640px) {
    .gc-header { padding: 10px 12px; gap: 8px; }
    .gc-header-back, .gc-icon-btn {
      padding: 9px; min-width: 40px; min-height: 40px; touch-action: manipulation;
    }
    .gc-header-back svg, .gc-icon-btn svg { width: 19px; height: 19px; }
    .gc-header-avatar { width: 32px; height: 32px; font-size: 12px; }
    .gc-header-name { font-size: 14px; }
    .gc-header-members { font-size: 10.5px; }
    .gc-messages { padding: 12px 10px 6px; }
    .gc-msg-content { max-width: 84%; }
    .gc-msg-avatar { width: 26px; height: 26px; font-size: 10.5px; }
    .gc-bubble { font-size: 14.5px; padding: 9px 12px; }
    .gc-reply-bar { padding: 8px 10px; }
    .gc-input-bar {
      padding: 8px 10px calc(10px + env(safe-area-inset-bottom, 0px));
    }
    .gc-eloria-note { font-size: 10.5px; margin-bottom: 6px; }
    .gc-textarea { font-size: 16px; padding: 10px 12px; border-radius: 18px; }
    .gc-send-btn { width: 44px; height: 44px; border-radius: 14px; touch-action: manipulation; }
    .gc-ctx-backdrop {
      display: block; position: fixed; inset: 0;
      background: rgba(0,0,0,.25); z-index: 799;
      animation: fadeIn .12s ease;
    }
    .gc-ctx-menu {
      left: 0 !important; right: 0 !important;
      bottom: 0 !important; top: auto !important;
      width: 100%; min-width: 0;
      border-radius: 16px 16px 0 0; padding: 6px;
      padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
      box-shadow: 0 -8px 28px rgba(13,58,53,.16);
      animation: ctxSheetIn .16s ease;
    }
    .gc-ctx-item { padding: 14px 14px; font-size: 15px; }
    .gc-sheet-handle {
      display: block; width: 36px; height: 4px;
      border-radius: 2px; background: var(--border);
      margin: 8px auto 4px;
    }
    .gc-info-backdrop { align-items: flex-end; }
    .gc-info-panel {
      width: 100%; max-width: 100%; margin: 0;
      max-height: 88vh; border-radius: 18px 18px 0 0;
      padding-bottom: env(safe-area-inset-bottom, 0px);
      animation: slideUpSheet .2s ease;
    }
    .gc-info-hdr { padding: 8px 16px 12px; }
    .gc-info-close { width: 34px; height: 34px; touch-action: manipulation; }
    .gc-member-row { padding: 9px 0; }
    .gc-member-av { width: 32px; height: 32px; }
    .gc-kick-btn { padding: 6px 10px; font-size: 12.5px; touch-action: manipulation; }
    .gc-invite-input, .gc-invite-btn,
    .gc-rename-input, .gc-rename-save { font-size: 14px; padding: 9px 12px; }
    .gc-danger-btn { padding: 12px; font-size: 14px; touch-action: manipulation; }
    .gc-limit-modal { width: calc(100% - 32px); }
    .gc-mention-dropdown { left: 10px; right: 10px; }
  }
`;

function formatTime(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(ts) {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Render message text with @email mentions highlighted
function renderTextWithMentions(text) {
  if (!text) return text;
  const parts = text.split(/(@[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,})/g);
  return parts.map((part, i) =>
    /^@[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(part)
      ? <span key={i} className="gc-mention">{part}</span>
      : part
  );
}

export default function GroupChat({ group, user, userPlan, onBack }) {
  const [messages, setMessages]         = useState([]);
  const [input, setInput]               = useState("");
  const [sending, setSending]           = useState(false);
  const [eloriaTyping, setEloriaTyping] = useState(false);
  const [showInfo, setShowInfo]         = useState(false);
  const [renameVal, setRenameVal]       = useState(group.name);
  const [inviteEmail, setInviteEmail]   = useState("");
  const [inviteFeedback, setInviteFeedback] = useState(null);
  const [inviting, setInviting]         = useState(false);

  // ── Limit modal (replaces alert() for group/member limits) ──
  const [limitModal, setLimitModal]     = useState(null); // { message: string }

  // ── Confirm modal (replaces window.confirm for destructive actions) ──
  const [confirmModal, setConfirmModal] = useState(null); // { message, onConfirm }

  // ── @mention dropdown ────────────────────────────────────────
  const [mentionResults, setMentionResults] = useState([]); // filtered members
  const [mentionActive, setMentionActive]   = useState(-1); // keyboard nav index

  const [ctxMenu, setCtxMenu]   = useState(null);
  const ctxRef = useRef(null);

  const [replyTo, setReplyTo]   = useState(null);

  const [pressedMsgId, setPressedMsgId]   = useState(null);
  const longPressTimer = useRef(null);
  const longPressPos   = useRef(null);

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const uid       = user?.uid;
  const isCreator = group.creatorId === uid;

  // All member emails for @mention
  const memberEmails = group.memberEmails || [];
  const memberNames  = group.memberNames  || {};

  useEffect(() => {
    if (!document.getElementById("gc-style")) {
      const tag = document.createElement("style");
      tag.id = "gc-style";
      tag.textContent = GC_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    const joinedAt = group.memberJoinedAt?.[uid]
      ? new Date(group.memberJoinedAt[uid])
      : null;
    const unsub = subscribeToMessages(group.id, joinedAt, setMessages);
    return () => unsub();
  }, [group.id, uid, group.memberJoinedAt]);

  useEffect(() => {
    if (uid && group.id) clearUnread(group.id, uid);
  }, [group.id, uid, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, eloriaTyping]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
  }, [input]);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = (e) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target)) setCtxMenu(null);
    };
    const onKey = (e) => { if (e.key === "Escape") setCtxMenu(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [ctxMenu]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && replyTo) setReplyTo(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [replyTo]);

  // ── @mention: update dropdown when input changes ─────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    // Find @ that isn't preceded by a word character (fresh @)
    const cursorPos = e.target.selectionStart;
    const textToCursor = val.slice(0, cursorPos);
    const mentionMatch = textToCursor.match(/@([\w.@-]*)$/);

    if (mentionMatch) {
      const query = mentionMatch[1].toLowerCase();
      // Only show if query doesn't already look like a full email (no second @)
      if (!query.includes("@")) {
            const filtered = memberEmails.filter(email => {
          if (!email || email === user.email) return false;
          return email.toLowerCase().includes(query);
        });
        setMentionResults(filtered);
        setMentionActive(-1);
        return;
      }
    }
    setMentionResults([]);
  };

  const insertMention = (email) => {
    const cursorPos = textareaRef.current?.selectionStart ?? input.length;
    const textToCursor = input.slice(0, cursorPos);
    // Replace the @query part with @email
    const replaced = textToCursor.replace(/@[\w.@-]*$/, `@${email} `);
    const newVal = replaced + input.slice(cursorPos);
    setInput(newVal);
    setMentionResults([]);
    setMentionActive(-1);
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) { ta.focus(); ta.selectionStart = ta.selectionEnd = replaced.length; }
    }, 0);
  };

  const handleContextMenu = useCallback((e, msg) => {
    e.preventDefault();
    if (msg.deleted) return;
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
    longPressPos.current = null;
    setPressedMsgId(null);
  }, []);

  const handleTouchStart = useCallback((e, msg) => {
    if (msg.deleted) return;
    const touch = e.touches[0];
    if (!touch) return;
    longPressPos.current = { x: touch.clientX, y: touch.clientY };
    setPressedMsgId(msg.id || null);
    longPressTimer.current = setTimeout(() => {
      setCtxMenu({ x: touch.clientX, y: touch.clientY, msg });
      setPressedMsgId(null);
      longPressTimer.current = null;
    }, 480);
  }, []);

  const handleTouchMove = useCallback((e) => {
    if (!longPressPos.current) return;
    const touch = e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - longPressPos.current.x);
    const dy = Math.abs(touch.clientY - longPressPos.current.y);
    if (dx > 10 || dy > 10) clearLongPress();
  }, [clearLongPress]);

  const handleTouchEnd = useCallback(() => { clearLongPress(); }, [clearLongPress]);

  const handleReply = () => {
    if (!ctxMenu) return;
    const { msg } = ctxMenu;
    setReplyTo({ id: msg.id, senderName: msg.isEloria ? "Eloria" : msg.senderName, text: msg.text });
    setCtxMenu(null);
    textareaRef.current?.focus();
  };

  const handleCopyMsg = async () => {
    if (!ctxMenu) return;
    const { msg } = ctxMenu;
    setCtxMenu(null);
    try { await navigator.clipboard.writeText(msg.text || ""); }
    catch (err) { console.error("Copy error:", err); }
  };

  const handleDeleteMsg = async () => {
    if (!ctxMenu) return;
    const { msg } = ctxMenu;
    setCtxMenu(null);
    try { await deleteGroupMessage(group.id, msg.id); }
    catch (err) { console.error("Delete error:", err); }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMentionResults([]);
    const currentReply = replyTo;
    setReplyTo(null);
    setSending(true);
    try {
      await sendGroupMessage(group.id, user, text, currentReply || null);
      if (text.toLowerCase().includes("@eloria")) {
        const question = text.replace(/@eloria/gi, "").trim();
        setEloriaTyping(true);
        await callEloriaReply(question);
      }
    } catch (err) {
      console.error("Send error:", err);
    } finally {
      setSending(false);
    }
  };

  const callEloriaReply = async (question) => {
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("https://eloria-trial.onrender.com/api/group-chat/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ groupId: group.id, question, history: messages.slice(-20) }),
      });
      if (!res.ok) { setEloriaTyping(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          try {
            const parsed = JSON.parse(line.slice(5).trim());
            if (parsed.done) setEloriaTyping(false);
          } catch {}
        }
      }
    } catch (err) {
      console.error("Eloria reply error:", err);
      setEloriaTyping(false);
    }
  };

  const isCoarsePointer =
    typeof window !== "undefined" && window.matchMedia &&
    window.matchMedia("(pointer: coarse)").matches;

  const handleKeyDown = (e) => {
    // Navigate mention dropdown
    if (mentionResults.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionActive(i => Math.min(i + 1, mentionResults.length - 1)); return; }
      if (e.key === "ArrowUp")   { e.preventDefault(); setMentionActive(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const idx = mentionActive >= 0 ? mentionActive : 0;
        insertMention(mentionResults[idx]);
        return;
      }
      if (e.key === "Escape") { setMentionResults([]); return; }
    }
    if (e.key === "Enter" && !e.shiftKey && !isCoarsePointer) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteFeedback(null);
    try {
      await inviteToGroup(group.id, user.displayName || user.email, inviteEmail.trim(), userPlan);
      setInviteFeedback({ msg: `Invite sent to ${inviteEmail.trim()}!`, ok: true });
      setInviteEmail("");
    } catch (err) {
      // Show limit errors as modal popup, other errors inline
      if (err.message.toLowerCase().includes("full") || err.message.toLowerCase().includes("max")) {
        setLimitModal({ message: err.message });
      } else {
        setInviteFeedback({ msg: err.message, ok: false });
      }
    } finally {
      setInviting(false);
    }
  };

  const handleKick = (targetUid, targetEmail, targetName) => {
    setConfirmModal({
      message: `Remove ${targetName} from the group?`,
      onConfirm: async () => {
        setConfirmModal(null);
        try { await kickMember(group.id, targetUid, targetEmail); }
        catch (err) { setLimitModal({ message: err.message }); }
      }
    });
  };

  const handleLeave = () => {
    setConfirmModal({
      message: "Leave this group? You'll need a new invite to rejoin.",
      onConfirm: async () => {
        setConfirmModal(null);
        try { await leaveGroup(group.id, user); onBack(); }
        catch (err) { setLimitModal({ message: err.message }); }
      }
    });
  };

  // FIX 5: After delete, call onBack() so user goes to normal chat, not blank screen
  const handleDelete = () => {
    setConfirmModal({
      message: `Delete "${group.name}"? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteGroup(group.id);
          onBack();
        } catch (err) {
          setLimitModal({ message: err.message });
        }
      }
    });
  };

  const handleRename = async () => {
    if (!renameVal.trim() || renameVal.trim() === group.name) return;
    try { await renameGroup(group.id, renameVal.trim()); }
    catch (err) { setLimitModal({ message: err.message }); }
  };

  const grouped = [];
  let lastDay = null;
  messages.forEach((msg, i) => {
    const day = msg.timestamp ? formatDay(msg.timestamp) : null;
    if (day && day !== lastDay) {
      grouped.push({ type: "divider", day, key: `d-${i}` });
      lastDay = day;
    }
    grouped.push({ type: "msg", msg, key: msg.id || i });
  });

  const ctxStyle = ctxMenu ? (() => {
    const menuW = 160, menuH = 110;
    const x = Math.min(ctxMenu.x, window.innerWidth  - menuW - 8);
    const y = Math.min(ctxMenu.y, window.innerHeight - menuH - 8);
    return { top: y, left: x };
  })() : {};

  return (
    <div className="gc-wrap">
      {/* Header */}
      <div className="gc-header">
        <button className="gc-header-back" onClick={onBack} title="Back to groups">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="gc-header-avatar">{group.name?.[0]?.toUpperCase() || "G"}</div>
        <div className="gc-header-info">
          <div className="gc-header-name">{group.name}</div>
          <div className="gc-header-members">
            {group.members?.length || 0} member{group.members?.length !== 1 ? "s" : ""}
          </div>
        </div>
        <div className="gc-header-actions">
          <button className="gc-icon-btn" title="Group info" onClick={() => setShowInfo(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="gc-messages">
        {messages.length === 0 ? (
          <div className="gc-empty">
            <div className="gc-empty-icon">💬</div>
            <div className="gc-empty-title">Start the conversation</div>
            <p>Say hi to the group. Mention <code>@eloria</code> anywhere in a message to get an AI reply.</p>
          </div>
        ) : (
          grouped.map(item => {
            if (item.type === "divider") {
              return <div key={item.key} className="gc-day-divider"><span>{item.day}</span></div>;
            }
            const { msg } = item;
            const isSelf   = msg.senderId === uid;
            const isEloria = msg.isEloria;
            return (
              <div
                key={item.key}
                className={`gc-msg-row${isSelf ? " self" : ""}${pressedMsgId && pressedMsgId === msg.id ? " pressing" : ""}`}
                onContextMenu={(e) => handleContextMenu(e, msg)}
                onTouchStart={(e) => handleTouchStart(e, msg)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
              >
                {!isSelf && (
                  <div className={`gc-msg-avatar${isEloria ? " eloria-av" : ""}`}>
                    {isEloria ? "E" : (msg.senderInitial || msg.senderName?.[0]?.toUpperCase() || "?")}
                  </div>
                )}
                <div className="gc-msg-content">
                  {!isSelf && (
                    <div className="gc-sender-name">{isEloria ? "Eloria" : msg.senderName}</div>
                  )}
                  <div className={`gc-bubble${isSelf ? " self" : isEloria ? " eloria" : " other"}${msg.deleted ? " deleted" : ""}`}>
                    {isEloria && !msg.deleted && <div className="eloria-tag">Eloria AI</div>}
                    {!msg.deleted && msg.replyTo && (
                      <div className="gc-reply-quote">
                        <span className="gc-reply-quote-name">{msg.replyTo.senderName}</span>
                        <span className="gc-reply-quote-text">{msg.replyTo.text}</span>
                      </div>
                    )}
                    {msg.deleted ? "This message was deleted" : renderTextWithMentions(msg.text)}
                  </div>
                  <div className="gc-msg-time">{formatTime(msg.timestamp)}</div>
                </div>
                {isSelf && <div className="gc-msg-avatar placeholder" />}
              </div>
            );
          })
        )}
        {eloriaTyping && (
          <div className="gc-msg-row">
            <div className="gc-msg-avatar eloria-av">E</div>
            <div className="gc-msg-content">
              <div className="gc-sender-name">Eloria</div>
              <div className="gc-bubble eloria">
                <div className="gc-typing">
                  <div className="gc-typing-dots"><span/><span/><span/></div>
                  <div className="gc-typing-label">Eloria is thinking…</div>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply preview bar */}
      {replyTo && (
        <div className="gc-reply-bar">
          <div className="gc-reply-bar-line" />
          <div className="gc-reply-bar-body">
            <div className="gc-reply-bar-label">Replying to {replyTo.senderName}</div>
            <div className="gc-reply-bar-text">{replyTo.text}</div>
          </div>
          <button className="gc-reply-bar-close" onClick={() => setReplyTo(null)} title="Cancel reply">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* Input */}
      <div className="gc-input-bar">
        {/* @mention dropdown */}
        {mentionResults.length > 0 && (
          <div className="gc-mention-dropdown">
            {mentionResults.map((email, i) => (
              <div
                key={email}
                className={`gc-mention-item${i === mentionActive ? " active" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); insertMention(email); }}
              >
                <div className="gc-mention-av">{email[0].toUpperCase()}</div>
                <div>
                  <div>{email}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="gc-eloria-note">
          Type <code>@eloria</code> to get an AI reply · Type <code>@email</code> to mention someone
        </div>
        <div className="gc-input-row">
          <textarea
            ref={textareaRef}
            className="gc-textarea"
            placeholder={replyTo ? `Reply to ${replyTo.senderName}…` : "Message the group…"}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button className="gc-send-btn" onClick={handleSend} disabled={!input.trim() || sending}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <>
          <div className="gc-ctx-backdrop" onClick={() => setCtxMenu(null)} />
          <div className="gc-ctx-menu" style={ctxStyle} ref={ctxRef}>
            <div className="gc-sheet-handle" />
            <button className="gc-ctx-item" onClick={handleReply}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 17 4 12 9 7"/>
                <path d="M20 18v-2a4 4 0 00-4-4H4"/>
              </svg>
              Reply
            </button>
            <button className="gc-ctx-item" onClick={handleCopyMsg}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
              Copy
            </button>
            {ctxMenu.msg.senderId === uid && !ctxMenu.msg.deleted && (
              <>
                <div className="gc-ctx-divider" />
                <button className="gc-ctx-item danger" onClick={handleDeleteMsg}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                  </svg>
                  Delete message
                </button>
              </>
            )}
          </div>
        </>
      )}

      {/* Info panel */}
      {showInfo && (
        <div className="gc-info-backdrop" onClick={() => setShowInfo(false)}>
          <div className="gc-info-panel" onClick={e => e.stopPropagation()}>
            <div className="gc-sheet-handle" />
            <div className="gc-info-hdr">
              <h3>Group Info</h3>
              <button className="gc-info-close" onClick={() => setShowInfo(false)}>✕</button>
            </div>
            {isCreator && (
              <div className="gc-info-section">
                <div className="gc-info-label">Group Name</div>
                <div className="gc-rename-row">
                  <input
                    className="gc-rename-input"
                    value={renameVal}
                    onChange={e => setRenameVal(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleRename()}
                    placeholder="Group name…"
                  />
                  <button className="gc-rename-save" onClick={handleRename}>Save</button>
                </div>
              </div>
            )}
            <div className="gc-info-section">
              <div className="gc-info-label">Members ({group.members?.length || 0})</div>
              {(group.members || []).map(memberUid => {
                const name    = memberNames[memberUid] || "Unknown";
                const email   = memberEmails.find(e => e) || "";
                const isMe    = memberUid === uid;
                const isOwner = memberUid === group.creatorId;
                return (
                  <div key={memberUid} className="gc-member-row">
                    <div className="gc-member-av">{name[0]?.toUpperCase()}</div>
                    <div className="gc-member-name">{name} {isMe ? "(you)" : ""}</div>
                    {isOwner && <div className="gc-member-tag">Creator</div>}
                    {isCreator && !isMe && !isOwner && (
                      <button className="gc-kick-btn" onClick={() => handleKick(memberUid, email, name)}>Remove</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="gc-info-section">
              <div className="gc-info-label">Invite by Email</div>
              <div className="gc-invite-row">
                <input
                  className="gc-invite-input"
                  type="email"
                  placeholder="friend@email.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleInvite()}
                />
                <button className="gc-invite-btn" onClick={handleInvite} disabled={!inviteEmail.trim() || inviting}>
                  {inviting ? "…" : "Invite"}
                </button>
              </div>
              {inviteFeedback && (
                <div className={`gc-invite-feedback ${inviteFeedback.ok ? "ok" : "err"}`}>
                  {inviteFeedback.msg}
                </div>
              )}
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 8 }}>
                They'll see a notification next time they open Eloria.
              </div>
            </div>
            <div className="gc-info-section">
              {!isCreator && <button className="gc-danger-btn" onClick={handleLeave}>Leave Group</button>}
              {isCreator  && <button className="gc-danger-btn" onClick={handleDelete}>Delete Group</button>}
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRM MODAL (replaces window.confirm for destructive actions) ── */}
      {confirmModal && (
        <div className="gc-confirm-backdrop" onClick={() => setConfirmModal(null)}>
          <div className="gc-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="gc-confirm-title">Are you sure?</div>
            <div className="gc-confirm-msg">{confirmModal.message}</div>
            <div className="gc-confirm-btns">
              <button className="gc-confirm-cancel" onClick={() => setConfirmModal(null)}>Cancel</button>
              <button className="gc-confirm-ok" onClick={confirmModal.onConfirm}>Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIMIT MODAL (replaces browser alert for group/member limits) ── */}
      {limitModal && (
        <div className="gc-limit-backdrop" onClick={() => setLimitModal(null)}>
          <div className="gc-limit-modal" onClick={e => e.stopPropagation()}>
            <div className="gc-limit-icon"></div>
            <div className="gc-limit-title">Limit Reached</div>
            <div className="gc-limit-msg">{limitModal.message}</div>
            <button className="gc-limit-close" onClick={() => setLimitModal(null)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
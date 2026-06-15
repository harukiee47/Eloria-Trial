import React, { useState, useEffect, useRef, useCallback } from "react";
import { auth } from "../services/firebase";
import {
  subscribeToMessages, sendGroupMessage, clearUnread,
  inviteToGroup, kickMember, leaveGroup, deleteGroup, renameGroup,
  deleteGroupMessage,
} from "../services/groupService";
import { API_BASE } from "./config";

const GC_STYLE = `
  /* ── GROUP CHAT WRAPPER ─────────────────────────────────── */
  .gc-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--bg-chat);
    font-family: var(--font);
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
    flex: 1; overflow-y: auto; padding: 16px 16px 8px;
    display: flex; flex-direction: column; gap: 2px;
    scrollbar-width: thin; scrollbar-color: #e0e0da transparent;
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
    display: flex;
    gap: 6px;
    margin-bottom: 6px;
    padding: 5px 8px;
    border-radius: 8px;
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
  .gc-ctx-item {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 8px 11px;
    border: none;
    background: none;
    border-radius: var(--r-sm);
    font-size: 13px;
    color: var(--t1);
    cursor: pointer;
    font-family: var(--font);
    text-align: left;
    transition: background .11s;
  }
  .gc-ctx-item:hover { background: #f4f4f0; }
  .gc-ctx-item.danger { color: var(--danger); }
  .gc-ctx-item.danger:hover { background: var(--danger-bg); }
  .gc-ctx-item svg { width: 14px; height: 14px; flex-shrink: 0; }
  .gc-ctx-divider { height: 1px; background: var(--border-soft); margin: 3px 6px; }

  /* ── REPLY PREVIEW BAR (above input) ────────────────────── */
  .gc-reply-bar {
    display: flex;
    align-items: center;
    gap: 8px;
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
  .gc-invite-feedback {
    font-size: 12px; margin-top: 6px; padding: 0 2px;
  }
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

export default function GroupChat({ group, user, userPlan, onBack }) {
  const [messages, setMessages]       = useState([]);
  const [input, setInput]             = useState("");
  const [sending, setSending]         = useState(false);
  const [eloriaTyping, setEloriaTyping] = useState(false);
  const [showInfo, setShowInfo]       = useState(false);
  const [renameVal, setRenameVal]     = useState(group.name);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFeedback, setInviteFeedback] = useState(null);
  const [inviting, setInviting]       = useState(false);


  const [ctxMenu, setCtxMenu] = useState(null); 
  const ctxRef = useRef(null);


  const [replyTo, setReplyTo] = useState(null); 

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const uid = user?.uid;
  const isCreator = group.creatorId === uid;


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
    const onKey = (e) => { if (e.key === "Escape") { setCtxMenu(null); } };
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

  const handleContextMenu = useCallback((e, msg) => {
    e.preventDefault();

    if (msg.deleted) return;
    setCtxMenu({ x: e.clientX, y: e.clientY, msg });
  }, []);


  const handleReply = () => {
    if (!ctxMenu) return;
    const { msg } = ctxMenu;
    setReplyTo({
      id: msg.id,
      senderName: msg.isEloria ? "Eloria" : msg.senderName,
      text: msg.text,
    });
    setCtxMenu(null);
    textareaRef.current?.focus();
  };


  const handleDeleteMsg = async () => {
    if (!ctxMenu) return;
    const { msg } = ctxMenu;
    setCtxMenu(null);
    try {
      await deleteGroupMessage(group.id, msg.id);
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
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
      const res = await fetch(`${API_BASE}/api/group-chat/reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          groupId: group.id,
          question,
          history: messages.slice(-20),
        }),
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

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
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
      setInviteFeedback({ msg: err.message, ok: false });
    } finally {
      setInviting(false);
    }
  };

  const handleKick = async (targetUid, targetEmail, targetName) => {
    if (!window.confirm(`Remove ${targetName} from the group?`)) return;
    try { await kickMember(group.id, targetUid, targetEmail); }
    catch (err) { alert(err.message); }
  };

  const handleLeave = async () => {
    if (!window.confirm("Leave this group?")) return;
    try { await leaveGroup(group.id, user); onBack(); }
    catch (err) { alert(err.message); }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${group.name}"? This is permanent.`)) return;
    try { await deleteGroup(group.id); onBack(); }
    catch (err) { alert(err.message); }
  };

  const handleRename = async () => {
    if (!renameVal.trim() || renameVal.trim() === group.name) return;
    try { await renameGroup(group.id, renameVal.trim()); }
    catch (err) { alert(err.message); }
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

  const memberNames  = group.memberNames  || {};
  const memberEmails = group.memberEmails || [];


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
        <div className="gc-header-avatar">
          {group.name?.[0]?.toUpperCase() || "G"}
        </div>
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
              return (
                <div key={item.key} className="gc-day-divider">
                  <span>{item.day}</span>
                </div>
              );
            }
            const { msg } = item;
            const isSelf   = msg.senderId === uid;
            const isEloria = msg.isEloria;

            return (
              <div
                key={item.key}
                className={`gc-msg-row${isSelf ? " self" : ""}`}
                onContextMenu={(e) => handleContextMenu(e, msg)}
              >
                {!isSelf && (
                  <div className={`gc-msg-avatar${isEloria ? " eloria-av" : ""}`}>
                    {isEloria ? "E" : (msg.senderInitial || msg.senderName?.[0]?.toUpperCase() || "?")}
                  </div>
                )}
                <div className="gc-msg-content">
                  {!isSelf && (
                    <div className="gc-sender-name">
                      {isEloria ? "Eloria" : msg.senderName}
                    </div>
                  )}
                  <div className={`gc-bubble${isSelf ? " self" : isEloria ? " eloria" : " other"}${msg.deleted ? " deleted" : ""}`}>
                    {isEloria && !msg.deleted && <div className="eloria-tag">Eloria AI</div>}

                    {/* Reply quote */}
                    {!msg.deleted && msg.replyTo && (
                      <div className="gc-reply-quote">
                        <span className="gc-reply-quote-name">
                          {msg.replyTo.senderName}
                        </span>
                        <span className="gc-reply-quote-text">
                          {msg.replyTo.text}
                        </span>
                      </div>
                    )}

                    {msg.deleted
                      ? "This message was deleted"
                      : msg.text
                    }
                  </div>
                  <div className="gc-msg-time">{formatTime(msg.timestamp)}</div>
                </div>
                {isSelf && <div className="gc-msg-avatar placeholder" />}
              </div>
            );
          })
        )}

        {/* Eloria typing indicator */}
        {eloriaTyping && (
          <div className="gc-msg-row">
            <div className="gc-msg-avatar eloria-av">E</div>
            <div className="gc-msg-content">
              <div className="gc-sender-name">Eloria</div>
              <div className="gc-bubble eloria">
                <div className="gc-typing">
                  <div className="gc-typing-dots">
                    <span/><span/><span/>
                  </div>
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
        <div className="gc-eloria-note">
          Type <code>@eloria</code> in any message to get an AI reply
        </div>
        <div className="gc-input-row">
          <textarea
            ref={textareaRef}
            className="gc-textarea"
            placeholder={replyTo ? `Reply to ${replyTo.senderName}…` : "Message the group…"}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            className="gc-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || sending}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── CONTEXT MENU ── */}
      {ctxMenu && (
        <div className="gc-ctx-menu" style={ctxStyle} ref={ctxRef}>
          {/* Reply — available on any non-deleted message */}
          <button className="gc-ctx-item" onClick={handleReply}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 17 4 12 9 7"/>
              <path d="M20 18v-2a4 4 0 00-4-4H4"/>
            </svg>
            Reply
          </button>

          {/* Delete — only own messages, only if not already deleted */}
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
      )}

      {/* Info / Settings panel */}
      {showInfo && (
        <div className="gc-info-backdrop" onClick={() => setShowInfo(false)}>
          <div className="gc-info-panel" onClick={e => e.stopPropagation()}>
            <div className="gc-info-hdr">
              <h3>Group Info</h3>
              <button className="gc-info-close" onClick={() => setShowInfo(false)}>✕</button>
            </div>

            {/* Rename (creator only) */}
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

            {/* Members */}
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
                      <button className="gc-kick-btn" onClick={() => handleKick(memberUid, email, name)}>
                        Remove
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Invite */}
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
                <button
                  className="gc-invite-btn"
                  onClick={handleInvite}
                  disabled={!inviteEmail.trim() || inviting}
                >
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

            {/* Leave / Delete */}
            <div className="gc-info-section">
              {!isCreator && (
                <button className="gc-danger-btn" onClick={handleLeave}>Leave Group</button>
              )}
              {isCreator && (
                <button className="gc-danger-btn" onClick={handleDelete}>Delete Group</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
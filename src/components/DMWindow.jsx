// src/components/DMWindow.jsx
import React, { useState, useEffect, useRef } from "react";
import { getOrCreateDM, sendDM, subscribeToDMMessages } from "../services/dmService";
import { formatLastSeen } from "../services/friendService";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const MAX_FILES = 2;

const ATTACH_TYPES = {
  image: {
    accept: "image/jpeg,image/png,image/gif,image/webp",
    label: "Image",
    hint: "jpg · png · gif",
    maxSize: 5 * 1024 * 1024,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
  },
  document: {
    accept: ".pdf,.doc,.docx,.txt,.xls,.xlsx,.csv,.zip,.rar",
    label: "Document",
    hint: "pdf · doc · txt",
    maxSize: 10 * 1024 * 1024,
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

const DM_STYLE = `
  @keyframes dmFadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dmFadeUp {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes dmMenuIn {
    from { opacity: 0; transform: translateY(6px) scale(.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes dmFadeInPlain { from { opacity: 0; } to { opacity: 1; } }

  .dm-shell {
    display: flex; width: 100%; height: 100vh; overflow: hidden;
    background: var(--bg-app);
    animation: dmFadeIn .3s ease;
  }

  /* ── DM LEFT SIDEBAR ── */
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

  /* Back button — flush to sidebar edges */
  .dm-back-btn {
    display: flex; align-items: center; gap: 8px;
    margin: 0; padding: 12px 14px;
    border: none; background: none; cursor: pointer;
    color: var(--t2); font-size: 13px; font-weight: 500;
    font-family: var(--font); transition: background 0.12s;
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
    padding: 10px 14px 6px; font-size: 10px; font-weight: 700;
    color: var(--t3); text-transform: uppercase; letter-spacing: 0.07em; flex-shrink: 0;
  }

  /* Friends list — no side padding so rows go edge-to-edge */
  .dm-friends-list { flex: 1; overflow-y: auto; padding: 0 0 12px; }

  .dm-friend-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 14px; cursor: pointer;
    margin-bottom: 1px; transition: background 0.12s;
  }
  .dm-friend-row:hover { background: var(--bg-panel); }
  .dm-friend-row.active { background: var(--accent-bg); }

  .dm-friend-name {
    font-size: 13px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .dm-friend-status { font-size: 11px; color: var(--t3); margin-top: 1px; }
  .dm-no-friends { font-size: 12px; color: var(--t3); padding: 16px 14px; line-height: 1.6; }

  /* ── DM CHAT AREA ── */
  .dm-chat {
    flex: 1; display: flex; flex-direction: column;
    height: 100%; overflow: hidden; background: var(--bg-chat);
    animation: dmFadeIn .25s ease;
  }
  .dm-chat-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    background: var(--bg-panel);
  }
  .dm-messages {
    flex: 1; overflow-y: auto; padding: 20px 18px;
    display: flex; flex-direction: column; gap: 2px;
  }
  .dm-start-notice {
    text-align: center; margin-bottom: 28px; padding: 0 16px;
  }
  .dm-input-area {
    padding: 10px 16px 16px; border-top: 1px solid var(--border);
    flex-shrink: 0; background: var(--bg-panel);
  }
  .dm-input-row {
    display: flex; gap: 8px; max-width: 800px; margin: 0 auto;
    align-items: flex-end;
  }
  .dm-input {
    flex: 1; padding: 10px 14px; border-radius: 22px;
    border: 1px solid var(--border); outline: none;
    font-size: 13.5px; font-family: var(--font);
    background: var(--bg-app); color: var(--t1);
    resize: none; min-height: 42px; max-height: 120px;
    line-height: 1.45; overflow-y: auto;
    transition: border-color 0.13s;
    display: block;
  }
  .dm-input:focus { border-color: var(--accent); }
  .dm-send-btn {
    width: 42px; height: 42px; border-radius: 50%; border: none;
    background: var(--accent); color: #fff;
    cursor: pointer; transition: opacity 0.13s;
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .dm-send-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── ATTACH BUTTON + DROPDOWN (mirrors ChatWindow) ── */
  .dm-attach { position: relative; flex-shrink: 0; }
  .dm-attach-btn {
    width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--border);
    background: var(--bg-app); cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--t2); transition: background 0.12s, color 0.12s;
  }
  .dm-attach-btn:hover { background: var(--accent-bg); color: var(--accent); }
  .dm-attach-btn:disabled { opacity: 0.4; cursor: default; }
  .dm-attach-btn.has-files { color: var(--accent); }
  .dm-attach-btn svg { width: 18px; height: 18px; }

  .dm-attach-menu {
    position: absolute; bottom: calc(100% + 8px); left: 0;
    background: var(--bg-panel); border: 1px solid var(--border);
    border-radius: 14px; box-shadow: 0 8px 30px rgba(0,0,0,.16);
    padding: 5px; min-width: 170px; z-index: 200;
    animation: dmMenuIn .12s ease;
  }
  .dm-attach-menu-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; font-size: 13px; color: var(--t1);
    border-radius: 10px; cursor: pointer;
    transition: background .11s; font-family: var(--font); font-weight: 500;
  }
  .dm-attach-menu-item:hover { background: var(--accent-bg); color: var(--accent); }
  .dm-attach-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
  .dm-attach-menu-sep { height: 1px; background: var(--border); margin: 3px 8px; }
  .dm-attach-menu-limit { font-size: 10px; color: var(--t3); padding: 4px 12px 5px; font-family: var(--font); }

  /* ── PENDING ATTACHMENT STRIP ── */
  .dm-pending-strip {
    display: flex; gap: 8px; flex-wrap: wrap;
    padding: 8px 16px 2px; max-width: 800px; margin: 0 auto; width: 100%;
    animation: dmFadeUp .15s ease;
  }
  .dm-pending-chip {
    display: flex; align-items: center; gap: 7px;
    padding: 6px 10px 6px 8px;
    background: var(--bg-app);
    border: 1.5px solid var(--accent);
    border-radius: 10px; max-width: 200px;
  }
  .dm-pending-thumb {
    width: 32px; height: 32px; border-radius: 6px;
    object-fit: cover; flex-shrink: 0; border: 1px solid var(--border);
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
  .dm-pending-remove:hover { color: #e05252; background: rgba(224,82,82,0.1); }
  .dm-pending-limit {
    font-size: 10.5px; color: var(--t3);
    padding: 0 16px 4px; max-width: 800px; margin: 0 auto; width: 100%;
  }

  /* ── MESSAGE BUBBLES ── */
  .dm-msg-row {
    display: flex; align-items: flex-end; gap: 8px;
    animation: dmFadeUp .2s ease;
  }
  .dm-msg-row.mine { flex-direction: row-reverse; }
  .dm-msg-row + .dm-msg-row { margin-top: 2px; }
  .dm-msg-row.new-group { margin-top: 10px; }

  .dm-msg-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    align-self: flex-end;
  }
  .dm-msg-avatar.hidden { visibility: hidden; }

  .dm-bubble {
    max-width: 65%;
    padding: 10px 15px;
    border-radius: 18px;
    font-size: 13px;
    line-height: 1.5;
    word-break: break-word;
    white-space: pre-wrap;
    font-family: var(--font);
  }
  .dm-bubble.theirs {
    background: transparent; color: var(--t1);
    border: 1px solid #ececea;
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .dm-bubble.mine {
    background: var(--accent); color: #fff;
    border-bottom-right-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,.25);
  }

  /* ── FILE UPLOAD PROGRESS (shown while sending) ── */
  .dm-upload-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: var(--accent-bg);
    border-radius: 10px; margin: 0 auto 8px; max-width: 800px;
    font-size: 12px; color: var(--t2);
  }
  .dm-upload-progress {
    flex: 1; height: 4px; background: var(--border);
    border-radius: 2px; overflow: hidden;
  }
  .dm-upload-fill {
    height: 100%; background: var(--accent);
    transition: width 0.2s;
  }

  /* ── SENT IMAGE/DOC BUBBLES (mirrors ChatWindow attach bubbles) ── */
  .dm-attach-img-bubble {
    border-radius: 16px; overflow: hidden;
    border: 1.5px solid rgba(0,0,0,.08);
    max-width: 240px; min-width: 120px;
    box-shadow: 0 2px 12px rgba(0,0,0,.1);
    cursor: pointer; position: relative;
    transition: transform .15s, box-shadow .15s;
  }
  .dm-attach-img-bubble:hover { transform: scale(1.02); box-shadow: 0 4px 20px rgba(0,0,0,.15); }
  .dm-attach-img-bubble img { width: 100%; display: block; max-height: 220px; object-fit: cover; }
  .dm-attach-img-bubble.theirs { border-bottom-left-radius: 5px; }
  .dm-attach-img-bubble.mine { border-bottom-right-radius: 5px; }

  .dm-attach-doc-bubble {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px;
    border-radius: 16px;
    max-width: 280px; min-width: 200px;
    transition: box-shadow .14s;
  }
  .dm-attach-doc-bubble.mine {
    background: rgba(255,255,255,.18);
    border: 1.5px solid rgba(255,255,255,.3);
    border-bottom-right-radius: 5px;
  }
  .dm-attach-doc-bubble.theirs {
    background: var(--bg-panel);
    border: 1.5px solid var(--border);
    border-bottom-left-radius: 5px;
    box-shadow: 0 1px 6px rgba(0,0,0,.06);
  }
  .dm-doc-icon-box {
    width: 38px; height: 38px; border-radius: 9px;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; letter-spacing: -.01em; flex-shrink: 0;
  }
  .dm-doc-info { flex: 1; min-width: 0; }
  .dm-doc-name {
    font-size: 12.5px; font-weight: 600;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3;
  }
  .dm-attach-doc-bubble.mine .dm-doc-name { color: #fff; }
  .dm-attach-doc-bubble.theirs .dm-doc-name { color: var(--t1); }
  .dm-doc-meta { font-size: 10.5px; margin-top: 2px; }
  .dm-attach-doc-bubble.mine .dm-doc-meta { color: rgba(255,255,255,.65); }
  .dm-attach-doc-bubble.theirs .dm-doc-meta { color: var(--t3); }
  .dm-doc-download {
    width: 30px; height: 30px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    text-decoration: none; transition: background .12s;
  }
  .dm-attach-doc-bubble.mine .dm-doc-download { background: rgba(255,255,255,.2); color: #fff; }
  .dm-attach-doc-bubble.mine .dm-doc-download:hover { background: rgba(255,255,255,.32); }
  .dm-attach-doc-bubble.theirs .dm-doc-download { background: var(--accent); color: #fff; }
  .dm-attach-doc-bubble.theirs .dm-doc-download:hover { opacity: .85; }
  .dm-doc-download svg { width: 14px; height: 14px; }

  /* ── IMAGE LIGHTBOX ── */
  .dm-lightbox {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,.85);
    display: flex; align-items: center; justify-content: center;
    animation: dmFadeInPlain .18s ease; cursor: zoom-out;
  }
  .dm-lightbox img {
    max-width: 90vw; max-height: 88vh;
    border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.5);
    object-fit: contain; cursor: default;
  }
  .dm-lightbox-close, .dm-lightbox-download {
    position: absolute; top: 20px;
    background: rgba(255,255,255,.12); border: none; border-radius: 50%;
    width: 38px; height: 38px; cursor: pointer; color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; transition: background .12s; text-decoration: none;
  }
  .dm-lightbox-close { right: 20px; }
  .dm-lightbox-download { right: 68px; }
  .dm-lightbox-close:hover, .dm-lightbox-download:hover { background: rgba(255,255,255,.22); }
  .dm-lightbox-download svg { width: 17px; height: 17px; }

  @media(max-width: 640px) {
    .dm-messages { padding: 14px 10px; }
    .dm-input-area { padding: 8px 10px 12px; }
    .dm-bubble { max-width: 80%; font-size: 13px; }
    .dm-attach-img-bubble { max-width: 200px; }
    .dm-attach-doc-bubble { max-width: 220px; min-width: 0; }
    .dm-lightbox-close { top: 14px; right: 14px; width: 34px; height: 34px; }
    .dm-lightbox-download { top: 14px; right: 56px; width: 34px; height: 34px; }
  }
`;

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : "FILE";
}

function docIcon(ext) {
  const map = {
    PDF: { bg: "#fff1f1", color: "#e53e3e", char: "PDF" },
    TXT: { bg: "#f0f4ff", color: "#4a6cf7", char: "TXT" },
    DOC: { bg: "#eff6ff", color: "#2563eb", char: "DOC" },
    DOCX: { bg: "#eff6ff", color: "#2563eb", char: "DOC" },
    XLS: { bg: "#effaf0", color: "#16a34a", char: "XLS" },
    XLSX: { bg: "#effaf0", color: "#16a34a", char: "XLS" },
    CSV: { bg: "#effaf0", color: "#16a34a", char: "CSV" },
    ZIP: { bg: "#f5f0fa", color: "#7c3aed", char: "ZIP" },
    RAR: { bg: "#f5f0fa", color: "#7c3aed", char: "RAR" },
  };
  return map[ext] || { bg: "var(--accent-bg)", color: "var(--accent)", char: ext.slice(0, 3) };
}

export default function DMWindow({ user, friend, friends = [], onSelectFriend, onBack }) {
  const [dmId, setDmId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { name, pct }
  const [pendingFiles, setPendingFiles] = useState([]); // [{ id, name, size, kind, file, previewUrl }]
  const [showAttach, setShowAttach] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const bottomRef = useRef(null);
  const unsubRef = useRef(() => {});
  const fileInputRef = useRef(null);
  const pickKindRef = useRef("document");
  const attachRef = useRef(null);
  const textareaRef = useRef(null);

  const canAddMore = pendingFiles.length < MAX_FILES;

  // Inject styles once
  useEffect(() => {
    if (!document.getElementById("dm-style")) {
      const tag = document.createElement("style");
      tag.id = "dm-style";
      tag.textContent = DM_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  // Subscribe to messages whenever friend changes
  useEffect(() => {
    if (!friend?.uid) return;
    setMessages([]);
    setDmId(null);
    setPendingFiles([]);
    setInput("");
    unsubRef.current();

    let cancelled = false;
    getOrCreateDM(user.uid, friend.uid).then((id) => {
      if (cancelled) return;
      setDmId(id);
      unsubRef.current = subscribeToDMMessages(id, (msgs) => {
        if (!cancelled) setMessages(msgs);
      });
    }).catch(console.error);

    return () => {
      cancelled = true;
      unsubRef.current();
    };
  }, [user.uid, friend?.uid]);

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

  // Close lightbox on Escape
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") setLightboxSrc(null); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Auto-resize textarea
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
    pickKindRef.current = kind;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.setAttribute("accept", ATTACH_TYPES[kind].accept);
      fileInputRef.current.click();
    }
  };

  const onFileChange = (e) => {
    const kind = pickKindRef.current;
    const files = Array.from(e.target.files || []);
    const slots = MAX_FILES - pendingFiles.length;
    const toAdd = files.slice(0, slots);

    toAdd.forEach((f) => {
      const maxSize = ATTACH_TYPES[kind].maxSize;
      if (f.size > maxSize) {
        alert(`"${f.name}" is too large. Max size is ${formatBytes(maxSize)}.`);
        return;
      }

      const id = Date.now() + Math.random();
      setPendingFiles((prev) => [...prev, { id, name: f.name, size: f.size, kind, file: f, previewUrl: null }]);

      if (kind === "image") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setPendingFiles((prev) => prev.map((p) => (p.id === id ? { ...p, previewUrl: ev.target.result } : p)));
        };
        reader.readAsDataURL(f);
      }
    });
  };

  const removePendingFile = (id) => setPendingFiles((prev) => prev.filter((p) => p.id !== id));

  const handleSend = async () => {
    const text = input.trim();
    const files = pendingFiles;
    if ((!text && files.length === 0) || !dmId || sending) return;

    setSending(true);
    setInput("");
    setPendingFiles([]);
    if (textareaRef.current) textareaRef.current.style.height = "42px";

    try {
      const storage = getStorage();

      // Files go out first so they render above the caption, like ChatWindow's stack
      for (const f of files) {
        setUploadProgress({ name: f.name, pct: 0 });
        const path = `dms/${dmId}/${Date.now()}_${f.name}`;
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, f.file);

        await new Promise((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploadProgress({ name: f.name, pct });
            },
            reject,
            async () => {
              try {
                const url = await getDownloadURL(task.snapshot.ref);
                await sendDM(dmId, user.uid, null, {
                  type: f.kind === "image" ? "image" : "file",
                  url,
                  name: f.name,
                  size: f.size,
                  mimeType: f.file.type,
                });
                resolve();
              } catch (err) {
                reject(err);
              }
            }
          );
        });
      }
      setUploadProgress(null);

      if (text) {
        await sendDM(dmId, user.uid, text);
      }
    } catch (e) {
      console.error("DM send failed:", e);
      setUploadProgress(null);
    } finally {
      setSending(false);
    }
  };

  const Avatar = ({ name, hidden = false }) => (
    <div className={`dm-msg-avatar${hidden ? " hidden" : ""}`}>
      {hidden ? null : name?.[0]?.toUpperCase() || "?"}
    </div>
  );

  const SidebarAvatar = ({ name, size = 36, online }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, position: "relative",
      background: "linear-gradient(135deg, var(--accent), #e8a84a)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
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

  const showBeginning = messages.length === 0;

  return (
    <div className="dm-shell">

      {lightboxSrc && (
        <div className="dm-lightbox" onClick={() => setLightboxSrc(null)}>
          <img src={lightboxSrc} alt="preview" onClick={(e) => e.stopPropagation()} />
          <a
            href={lightboxSrc}
            download
            target="_blank"
            rel="noreferrer"
            className="dm-lightbox-download"
            onClick={(e) => e.stopPropagation()}
            title="Download"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </a>
          <button className="dm-lightbox-close" onClick={() => setLightboxSrc(null)}>✕</button>
        </div>
      )}

      {/* ── LEFT SIDEBAR ── */}
      <div className="dm-sidebar">
        <button className="dm-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>

        {/* My profile */}
        <div className="dm-my-profile">
          <SidebarAvatar name={user.displayName || user.username} size={38} />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="dm-my-name">{user.displayName || user.username}</div>
            <div className="dm-my-username">@{user.username}</div>
          </div>
        </div>

        <div className="dm-section-label">Friends</div>

        <div className="dm-friends-list">
          {friends.length === 0 ? (
            <div className="dm-no-friends">
              Add friends from the notifications panel to start messaging.
            </div>
          ) : friends.map(f => (
            <div
              key={f.uid}
              className={`dm-friend-row${friend?.uid === f.uid ? " active" : ""}`}
              onClick={() => onSelectFriend(f)}
            >
              <SidebarAvatar name={f.username} size={34} online={f.online} />
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div className="dm-friend-name">@{f.username}</div>
                <div className="dm-friend-status">
                  {f.online ? "Active now" : formatLastSeen(f.online, f.lastSeen)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHAT AREA (keyed so it fades in fresh on every conversation switch) ── */}
      <div className="dm-chat" key={friend?.uid || "none"}>

        {/* Header */}
        <div className="dm-chat-header">
          <SidebarAvatar name={friend?.username} size={34} online={friend?.online} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
              @{friend?.username}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              {friend?.online ? "Active now" : formatLastSeen(friend?.online, friend?.lastSeen)}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="dm-messages">
          {showBeginning && (
            <div className="dm-start-notice">
              <div style={{
                width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px",
                background: "linear-gradient(135deg, var(--accent), #e8a84a)",
                color: "#fff", fontSize: 22, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {friend?.username?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)", marginBottom: 4 }}>
                @{friend?.username}
              </div>
              <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 280, margin: "0 auto" }}>
                This is the beginning of your conversation with @{friend?.username}. Say hi! 👋
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isMe = m.senderId === user.uid;
            const senderName = isMe
              ? (user.displayName || user.username)
              : (friend?.username || "?");

            // Group consecutive messages from same sender — hide avatar on non-last in group
            const nextMsg = messages[i + 1];
            const isLastInGroup = !nextMsg || nextMsg.senderId !== m.senderId;
            const prevMsg = messages[i - 1];
            const isFirstInGroup = !prevMsg || prevMsg.senderId !== m.senderId;

            return (
              <div
                key={m.id}
                className={`dm-msg-row${isMe ? " mine" : ""}${isFirstInGroup ? " new-group" : ""}`}
              >
                {/* Avatar only on last bubble in a group */}
                <Avatar name={senderName} hidden={!isLastInGroup} />

                <div>
                  {m.fileType === "image" ? (
                    <div
                      className={`dm-attach-img-bubble ${isMe ? "mine" : "theirs"}`}
                      onClick={() => setLightboxSrc(m.fileUrl)}
                    >
                      <img src={m.fileUrl} alt={m.fileName || "image"} />
                    </div>
                  ) : m.fileType === "file" ? (
                    (() => {
                      const ext = getExt(m.fileName);
                      const di = docIcon(ext);
                      return (
                        <div className={`dm-attach-doc-bubble ${isMe ? "mine" : "theirs"}`}>
                          <div className="dm-doc-icon-box" style={{ background: di.bg, color: di.color }}>{di.char}</div>
                          <div className="dm-doc-info">
                            <div className="dm-doc-name">{m.fileName}</div>
                            <div className="dm-doc-meta">{formatBytes(m.fileSize)} · {ext}</div>
                          </div>
                          <a
                            href={m.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={m.fileName}
                            className="dm-doc-download"
                            title="Download"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                              <polyline points="7 10 12 15 17 10"/>
                              <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </a>
                        </div>
                      );
                    })()
                  ) : (
                    <div className={`dm-bubble ${isMe ? "mine" : "theirs"}`}>
                      {m.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Upload progress bar */}
        {uploadProgress && (
          <div style={{ padding: "0 16px 4px" }}>
            <div className="dm-upload-bar">
              <span style={{ flexShrink: 0 }}>📎 {uploadProgress.name}</span>
              <div className="dm-upload-progress">
                <div className="dm-upload-fill" style={{ width: `${uploadProgress.pct}%` }} />
              </div>
              <span style={{ flexShrink: 0 }}>{uploadProgress.pct}%</span>
            </div>
          </div>
        )}

        {/* Pending attachment chips */}
        {pendingFiles.length > 0 && (
          <div style={{ background: "var(--bg-panel)" }}>
            <div className="dm-pending-strip">
              {pendingFiles.map((f) => {
                const ext = getExt(f.name);
                const di = docIcon(ext);
                return (
                  <div key={f.id} className="dm-pending-chip">
                    {f.kind === "image" ? (
                      f.previewUrl
                        ? <img className="dm-pending-thumb" src={f.previewUrl} alt={f.name} />
                        : <div className="dm-pending-thumb" style={{ background: "var(--border)" }} />
                    ) : (
                      <div className="dm-pending-doc-icon" style={{ background: di.bg, color: di.color }}>{di.char}</div>
                    )}
                    <div className="dm-pending-chip-info">
                      <div className="dm-pending-chip-name">{f.name}</div>
                      <div className="dm-pending-chip-meta">{formatBytes(f.size)} · {ext}</div>
                    </div>
                    <button className="dm-pending-remove" onClick={() => removePendingFile(f.id)}>✕</button>
                  </div>
                );
              })}
            </div>
            {pendingFiles.length >= MAX_FILES && (
              <div className="dm-pending-limit">Max {MAX_FILES} attachments per message</div>
            )}
          </div>
        )}

        {/* Input */}
        <div className="dm-input-area">
          <div className="dm-input-row">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={onFileChange}
            />

            <div className="dm-attach" ref={attachRef}>
              <button
                className={`dm-attach-btn${pendingFiles.length > 0 ? " has-files" : ""}`}
                onClick={() => setShowAttach((v) => !v)}
                title="Attach file"
                disabled={!dmId}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 16.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>

              {showAttach && (
                <div className="dm-attach-menu">
                  {!canAddMore && <div className="dm-attach-menu-limit">Max {MAX_FILES} files per message</div>}
                  {canAddMore && (
                    <>
                      <div className="dm-attach-menu-item" onClick={() => openFilePicker("image")}>
                        {ATTACH_TYPES.image.icon}
                        <span>Image</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>{ATTACH_TYPES.image.hint}</span>
                      </div>
                      <div className="dm-attach-menu-sep" />
                      <div className="dm-attach-menu-item" onClick={() => openFilePicker("document")}>
                        {ATTACH_TYPES.document.icon}
                        <span>Document</span>
                        <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--t3)" }}>{ATTACH_TYPES.document.hint}</span>
                      </div>
                    </>
                  )}
                  {pendingFiles.length > 0 && canAddMore && (
                    <>
                      <div className="dm-attach-menu-sep" />
                      <div className="dm-attach-menu-limit">{pendingFiles.length}/{MAX_FILES} attached</div>
                    </>
                  )}
                </div>
              )}
            </div>

            <textarea
              ref={textareaRef}
              className="dm-input"
              value={input}
              onChange={handleInputChange}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={pendingFiles.length > 0 ? "Add a message about your files…" : `Message @${friend?.username}…`}
              rows={1}
            />
            <button
              className="dm-send-btn"
              onClick={handleSend}
              disabled={(!input.trim() && pendingFiles.length === 0) || sending || !dmId}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
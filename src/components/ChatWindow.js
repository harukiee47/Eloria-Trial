import React, { useState, useEffect, useRef, useMemo } from "react";
import Message from "./Message";
import logo from "../assets/logo.png";

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
    flex-shrink: 0;          /* NEVER shrink — always visible */
    border-bottom: 1px solid var(--border-soft);
    background: var(--bg-chat);
    /* sit above messages on mobile so it's never obscured */
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

  /* hamburger — mobile only */
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
    position: sticky;
    top: 0;
    z-index: 50;
    background: var(--bg-chat);
  }

  .cw-root {
    height: 100dvh;
    overflow: hidden;
  }

  .cw-body {
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

    .cw-hamburger { display: flex; }
    .cw-header    { padding: 0 12px; }
  }

  .cw-logo { width: 26px; height: 26px; border-radius: 6px; overflow:hidden; flex-shrink:0; }
  .cw-logo img { width:100%; height:100%; object-fit:contain; }

  .cw-brand { min-width: 0; }
  .cw-brand h2  { font-size:15px; font-weight:600; color:var(--t1); line-height:1.2; white-space:nowrap; }
  .cw-brand sub { font-size:11px; color:var(--t3); font-weight:400; display:block; line-height:1; }

  /* upgrade — always visible */
  .cw-upgrade {
    padding: 6px 14px;
    background: var(--accent);
    color: #fff;
    border: none; border-radius: 20px;
    font-size: 12.5px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    white-space: nowrap; flex-shrink: 0;
    transition: opacity .12s, box-shadow .12s;
    letter-spacing: .01em;
  }
  .cw-upgrade:hover { opacity:.88; box-shadow:0 2px 12px rgba(193,127,42,.35); }
  @media(max-width: 640px) {
    .cw-upgrade { padding: 5px 11px; font-size: 11.5px; }
  }

  /* ── BODY (scrollable area) ──────────────────────────── */
  .cw-body {
    flex: 1;
    min-height: 0;           /* essential — lets flex child scroll */
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
    scrollbar-color: #e0e0da transparent;
    /* leave room for input bar on mobile */
  }
  @media(max-width: 640px) {
    .cw-body {
      padding-bottom: 90px;  /* prevent last message hiding behind fixed input */
    }
  }
  .cw-body::-webkit-scrollbar       { width: 5px; }
  .cw-body::-webkit-scrollbar-thumb { background: #ddddd8; border-radius: 3px; }

  /* ── INTRO ───────────────────────────────────────────── */
  .cw-intro {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px 20px;
    gap: 28px;
    animation: fadeUp .35s ease;
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(14px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @media(max-width: 640px) {
    .cw-intro { padding: 28px 16px 16px; gap: 20px; }
  }

  .cw-intro-logo {
    width:52px; height:52px; border-radius:14px; overflow:hidden;
    box-shadow:0 4px 20px rgba(193,127,42,.2); flex-shrink:0;
  }
  .cw-intro-logo img { width:100%; height:100%; object-fit:contain; }

  .cw-intro-text { display:flex; flex-direction:column; align-items:center; gap:10px; }
  .cw-intro-headline {
    font-size: clamp(20px, 4vw, 28px);
    font-weight: 600; color: var(--t1);
    text-align: center; line-height: 1.3; letter-spacing:-.02em;
  }
  .cw-intro-sub {
    font-size: 14px; color: var(--t3);
    text-align: center; line-height: 1.5;
  }

  .cw-cards {
    display: flex; flex-wrap: wrap; gap: 10px;
    justify-content: center; max-width: 560px; width: 100%;
  }
  .cw-card {
    flex: 1 1 150px; max-width: 210px;
    padding: 12px 14px;
    background: #faf9f6; border: 1px solid var(--border);
    border-radius: var(--r-md);
    font-size: 13px; color: var(--t2); cursor: pointer;
    line-height: 1.4; transition: background .13s, border-color .13s, transform .13s;
    font-family: var(--font); text-align: left;
  }
  .cw-card:hover {
    background:#fff; border-color:rgba(193,127,42,.4);
    transform:translateY(-1px); color:var(--t1);
  }
  .cw-card-icon { font-size:16px; margin-bottom:6px; display:block; }
  @media(max-width: 640px) {
    .cw-card { flex: 1 1 130px; }
  }

  /* ── MESSAGES ────────────────────────────────────────── */
  .cw-messages {
    flex: 1;
    padding: 24px 0 8px;
    display: flex;
    flex-direction: column;
  }

  .cw-thinking {
    display:flex; align-items:center; gap:10px;
    padding:12px 24px; max-width:720px; width:100%; margin:0 auto;
  }
  .cw-thinking-dots { display:flex; gap:4px; align-items:center; }
  .cw-thinking-dots span {
    width:6px; height:6px; border-radius:50%;
    background:var(--accent); opacity:.4;
    animation:dotPulse 1.2s ease-in-out infinite;
  }
  .cw-thinking-dots span:nth-child(2) { animation-delay:.2s; }
  .cw-thinking-dots span:nth-child(3) { animation-delay:.4s; }
  @keyframes dotPulse {
    0%,80%,100% { opacity:.25; transform:scale(.85); }
    40%          { opacity:1;   transform:scale(1); }
  }
  .cw-thinking-label { font-size:13px; color:var(--t3); font-style:italic; }

  /* ── INPUT ───────────────────────────────────────────── */
  .cw-input-wrap {
    flex-shrink: 0;
    padding: 10px 16px 14px;
    background: var(--bg-chat);
  }

  /* On mobile: fix input to bottom of viewport so it's always reachable */
  @media(max-width: 640px) {
    .cw-input-wrap {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 10px 16px;  /* extra bottom padding for home indicator */
      background: var(--bg-chat);
      border-top: 1px solid var(--border-soft);
      z-index: 20;
      /* safe area for notched iPhones */
      padding-bottom: max(16px, env(safe-area-inset-bottom, 16px));
    }
  }

  .cw-input-box {
    max-width: 720px; margin: 0 auto;
    background: #fafaf8; border: 1.5px solid var(--border);
    border-radius: var(--r-lg); padding: 10px 12px;
    display: flex; flex-direction: column; gap: 8px;
    transition: border-color .15s, box-shadow .15s;
  }
  .cw-input-box:focus-within {
    border-color: rgba(193,127,42,.5);
    box-shadow: 0 0 0 3px rgba(193,127,42,.08);
    background: #fff;
  }

  .cw-file-preview {
    display:flex; align-items:center; gap:8px;
    padding:6px 8px; background:var(--accent-bg);
    border-radius:var(--r-sm); border:1px solid rgba(193,127,42,.2);
  }
  .cw-file-preview img { height:48px; border-radius:4px; object-fit:cover; }
  .cw-file-chip { font-size:12px; color:var(--t2); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cw-file-remove {
    background:none; border:none; cursor:pointer;
    color:var(--t3); font-size:13px; padding:2px 4px;
    border-radius:4px; transition:color .12s; flex-shrink:0;
  }
  .cw-file-remove:hover { color:var(--danger); }

  .cw-textarea-row { display:flex; align-items:flex-end; gap:8px; }

  .cw-textarea {
    flex:1; border:none; background:none; outline:none;
    font-family:var(--font); font-size:14px; color:var(--t1);
    resize:none; min-height:22px; max-height:160px;
    line-height:1.55; overflow-y:auto; scrollbar-width:thin;
  }
  .cw-textarea::placeholder { color:var(--t3); }

  .cw-attach { position:relative; flex-shrink:0; }
  .cw-attach-btn {
    width:30px; height:30px; border:none; border-radius:var(--r-sm);
    background:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    color:var(--t3); transition:background .12s, color .12s;
  }
  .cw-attach-btn:hover { background:#f0f0ec; color:var(--t1); }
  .cw-attach-btn svg  { width:17px; height:17px; }

  .cw-attach-menu {
    position:absolute; bottom:calc(100% + 8px); left:0;
    background:var(--bg-panel); border:1px solid var(--border);
    border-radius:var(--r-md); box-shadow:var(--shadow-pop);
    padding:4px; min-width:140px; z-index:200;
    animation:ddIn .12s ease;
  }
  .cw-attach-menu-item {
    display:flex; align-items:center; gap:9px;
    padding:8px 10px; font-size:13px; color:var(--t1);
    border-radius:var(--r-sm); cursor:pointer;
    transition:background .11s; font-family:var(--font);
  }
  .cw-attach-menu-item:hover { background:#f4f4f0; }
  .cw-attach-menu-item svg { width:14px; height:14px; color:var(--t3); flex-shrink:0; }

  .cw-send {
    width:32px; height:32px; border-radius:50%;
    background:var(--accent); border:none; cursor:pointer;
    display:flex; align-items:center; justify-content:center;
    flex-shrink:0; color:#fff;
    transition:opacity .13s, box-shadow .13s;
  }
  .cw-send:hover:not(:disabled) { opacity:.88; box-shadow:0 2px 10px rgba(193,127,42,.4); }
  .cw-send:disabled { opacity:.35; cursor:default; }
  .cw-send svg { width:15px; height:15px; }

  .cw-hint {
    text-align:center; font-size:11px; color:var(--t3);
    margin-top:6px; max-width:720px; margin-left:auto; margin-right:auto;
  }
`;

export default function ChatWindow({ chat, setChats, setSidebarOpen }) {
  const [input, setInput]             = useState("");
  const [isThinking, setIsThinking]   = useState(false);
  const [showAttach, setShowAttach]   = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const fileInputRef   = useRef(null);
const messagesEndRef = useRef(null);
const bodyRef = useRef(null);
  const textareaRef    = useRef(null);
  const attachRef      = useRef(null);

  const messages = useMemo(() => chat?.messages || [], [chat]);
  const showIntro = messages.length === 0;

  useEffect(() => {
    if (!document.getElementById("eloria-cw")) {
      const tag = document.createElement("style");
      tag.id = "eloria-cw";
      tag.textContent = CW_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
  if (bodyRef.current) {
    bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }
}, [messages, isThinking]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [input]);

  useEffect(() => {
    const h = e => { if (attachRef.current && !attachRef.current.contains(e.target)) setShowAttach(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!chat) {
    return (
      <main className="cw-root" style={{alignItems:"center",justifyContent:"center"}}>
        <p style={{color:"var(--t3)",fontSize:14}}>Select or create a chat to get started.</p>
      </main>
    );
  }

  const handleFileUpload = accept => {
    if (!fileInputRef.current) return;
    fileInputRef.current.value = "";
    fileInputRef.current.setAttribute("accept", accept);
    fileInputRef.current.click();
    setShowAttach(false);
  };

  const onFileChange = e => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile({ name: file.name, type: file.type, url: URL.createObjectURL(file) });
  };

  const generateChatTitle = text => {
    const stop = ["how","to","the","a","an","and","or","for","with","of","in","on","is","are","can","i","you","me","my","what","why","when","make","fix","create","write","about"];
    return text.toLowerCase().replace(/[^a-z0-9\s]/g,"").split(" ")
      .filter(w => w && !stop.includes(w)).slice(0,4).join(" ")
      .replace(/\b\w/g,c=>c.toUpperCase()) || "New Chat";
  };

  const sendMessage = async () => {
    if (!input.trim() && !pendingFile) return;
    if (isThinking) return;
    setIsThinking(true);

    const userMsg = {
      id: Date.now(), sender: "user", text: input,
      file: pendingFile ? {
        name: pendingFile.name,
        type: pendingFile.type.startsWith("image") ? "image"
            : pendingFile.type.startsWith("audio") ? "audio" : "file",
        url: pendingFile.url,
      } : null,
    };

    const newMessages = [...messages, userMsg];
    setInput(""); setPendingFile(null);

    setChats(prev => prev.map(c => {
      if (c.id !== chat.id) return c;
      const first = !c.messages || c.messages.length === 0;
      return { ...c, messages: newMessages, title: first ? generateChatTitle(userMsg.text) : c.title };
    }));

    try {
      const res = await fetch("https://eloria-trial.onrender.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, file: pendingFile }),
      });
      const data = await res.json();
      const aiMsg = { id: Date.now()+1, sender:"ai", text: data?.reply||"Eloria couldn't respond." };
      setChats(prev => prev.map(c => c.id===chat.id ? { ...c, messages:[...newMessages,aiMsg] } : c));
    } catch {
      setChats(prev => prev.map(c => c.id===chat.id
        ? { ...c, messages:[...newMessages,{id:Date.now()+2,sender:"ai",text:"Eloria couldn't respond."}] }
        : c));
    }
    setIsThinking(false);
  };

  const regenerateMessage = async messageId => {
    const idx = messages.findIndex(m => m.id === messageId);
    if (idx === -1) return;
    const prev = messages.slice(0, idx);
    const lastUser = [...prev].reverse().find(m => m.sender === "user");
    if (!lastUser) return;
    setIsThinking(true);
    try {
      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: lastUser.text }),
      });
      const data = await res.json();
      setChats(p => p.map(c => c.id===chat.id
        ? { ...c, messages:[...prev,{id:Date.now(),sender:"ai",text:data?.reply||"No response"}] }
        : c));
    } catch { /* silent */ }
    setIsThinking(false);
  };

  return (
    <main className="cw-root">

      {/* HEADER — flex-shrink:0, always on top, never disappears */}
      <header className="cw-header">
        <div className="cw-header-left">
          <button className="cw-hamburger" onClick={() => setSidebarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6"  x2="21" y2="6"/>
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
        <button className="cw-upgrade">Upgrade</button>
      </header>

      {/* BODY — scrollable, never overlaps header */}
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
                {icon:"📝",label:"Make me an assignment",    q:"Make me an assignment"},
                {icon:"💡",label:"Business idea for students",q:"Business idea for students"},
                {icon:"🎬",label:"Write a viral YouTube script",q:"Write viral YouTube script"},
                {icon:"🧠",label:"Explain a complex topic",   q:"Explain quantum computing simply"},
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
            {messages.map(msg => (
              <Message
                key={msg.id}
                sender={msg.sender}
                text={msg.text}
                file={msg.file}
                onCopy={() => navigator.clipboard.writeText(msg.text)}
                onRegenerate={() => regenerateMessage(msg.id)}
              />
            ))}
            {isThinking && (
              <div className="cw-thinking">
                <div className="cw-thinking-dots"><span/><span/><span/></div>
                <span className="cw-thinking-label">Eloria is thinking…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* INPUT — fixed to bottom on mobile, normal flow on desktop */}
      <div className="cw-input-wrap">
        <div className="cw-input-box">
          {pendingFile && (
            <div className="cw-file-preview">
              {pendingFile.type.startsWith("image")
                ? <img src={pendingFile.url} alt="preview"/>
                : <span className="cw-file-chip">📎 {pendingFile.name}</span>
              }
              <button className="cw-file-remove" onClick={()=>setPendingFile(null)}>✕</button>
            </div>
          )}
          <div className="cw-textarea-row">
            <div className="cw-attach" ref={attachRef}>
              <button className="cw-attach-btn" onClick={()=>setShowAttach(v=>!v)} title="Attach">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                </svg>
              </button>
              {showAttach && (
                <div className="cw-attach-menu">
                  {[
                    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,label:"Image",accept:"image/*"},
                    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,label:"Audio",accept:"audio/*"},
                    {icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,label:"File",accept:"*"},
                  ].map(item=>(
                    <div key={item.label} className="cw-attach-menu-item" onClick={()=>handleFileUpload(item.accept)}>
                      {item.icon}{item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <textarea
              ref={textareaRef}
              className="cw-textarea"
              rows={1}
              value={input}
              placeholder="Message Eloria…"
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();}}}
            />
            <button className="cw-send" onClick={sendMessage} disabled={!input.trim()&&!pendingFile}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
        </div>
        <p className="cw-hint">Eloria can make mistakes. Verify important information.</p>
      </div>

      <input type="file" ref={fileInputRef} style={{display:"none"}} onChange={onFileChange}/>
    </main>
  );
}
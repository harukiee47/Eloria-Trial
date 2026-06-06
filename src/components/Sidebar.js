import React, { useState, useEffect, useRef } from "react";
import logo from "../assets/logo.png";

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS  (shared with ChatWindow via CSS custom props
   injected on :root — ChatWindow reads the same vars)
───────────────────────────────────────────────────────────── */
const GLOBAL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --font: 'DM Sans', system-ui, sans-serif;

    /* surfaces */
    --bg-app:      #f9f9f7;
    --bg-strip:    #f2f1ee;
    --bg-panel:    #ffffff;
    --bg-chat:     #ffffff;

    /* borders */
    --border:      #e5e4e0;
    --border-soft: #eeede9;

    /* text */
    --t1: #1c1c1a;
    --t2: #5a5a57;
    --t3: #9a9a97;

    /* accent — warm amber */
    --accent:      #c17f2a;
    --accent-bg:   #fdf3e3;
    --accent-deep: #a8691e;

    /* danger */
    --danger:      #d64242;
    --danger-bg:   #fff1f1;

    /* strip */
    --strip-w:     64px;
    --panel-w:     264px;

    /* radii */
    --r-sm: 6px;
    --r-md: 10px;
    --r-lg: 16px;

    /* shadows */
    --shadow-panel: 2px 0 20px rgba(0,0,0,0.07);
    --shadow-pop:   0 8px 32px rgba(0,0,0,0.13);
  }

  html, body, #root {
    height: 100%;
    font-family: var(--font);
    background: var(--bg-app);
    color: var(--t1);
  }

  /* app shell */
  .app-shell {
    display: flex;
    height: 100vh;
    overflow: hidden;
  }

  /* main area shifts right by strip width */
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
`;

/* ─────────────────────────────────────────────────────────────
   COMPONENT STYLES
───────────────────────────────────────────────────────────── */
const SIDEBAR_STYLE = `
  /* ── STRIP ───────────────────────────────────────────── */
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

  .sb-logo {
    width: 32px; height: 32px;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 12px;
    flex-shrink: 0;
  }
  .sb-logo img { width: 100%; height: 100%; object-fit: contain; }

  .sb-btn {
    width: 48px; height: 52px;
    border: none; background: none;
    border-radius: var(--r-md);
    cursor: pointer;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 3px;
    color: var(--t2);
    font-family: var(--font);
    transition: background .14s, color .14s;
    position: relative;
  }
  .sb-btn:hover  { background: #e9e8e4; color: var(--t1); }
  .sb-btn.active { background: #e3e2de; color: var(--t1); }
  .sb-btn svg   { width: 19px; height: 19px; flex-shrink: 0; }
  .sb-btn span  { font-size: 9px; font-weight: 500; letter-spacing:.02em; line-height:1; }

  .sb-spacer { flex: 1; }

  /* ── ACCOUNT AVATAR ───────────────────────────────────── */
  .sb-avatar-wrap { position: relative; }
  .sb-avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff;
    font-size: 13px; font-weight: 600;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-family: var(--font);
    transition: box-shadow .14s;
  }
  .sb-avatar:hover { box-shadow: 0 0 0 3px rgba(193,127,42,.22); }

  /* account popup */
  .acct-popup {
    position: absolute;
    bottom: calc(100% + 10px);
    left: 50%; transform: translateX(-50%);
    width: 224px;
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: var(--r-lg);
    box-shadow: var(--shadow-pop);
    padding: 12px;
    z-index: 500;
    animation: popIn .15s ease;
  }
  @keyframes popIn {
    from { opacity:0; transform: translateX(-50%) translateY(6px); }
    to   { opacity:1; transform: translateX(-50%) translateY(0); }
  }
  .acct-head { display:flex; align-items:center; gap:10px; padding-bottom:10px; }
  .acct-av   {
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
  .acct-logout svg   { width:15px; height:15px; flex-shrink:0; }

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

  .panel-inner {
    width: var(--panel-w);
    height: 100%;
    display: flex; flex-direction: column;
    overflow: hidden;
  }

  /* panel header */
  .panel-hdr {
    display:flex; align-items:center; justify-content:space-between;
    padding: 18px 14px 10px;
    flex-shrink: 0;
  }
  .panel-title { font-size:14px; font-weight:600; color:var(--t1); letter-spacing:-.01em; }
  .panel-x {
    width:26px; height:26px;
    border:none; background:none; border-radius:var(--r-sm);
    cursor:pointer; display:flex; align-items:center; justify-content:center;
    color:var(--t3); transition: background .12s, color .12s;
  }
  .panel-x:hover { background:#f0f0ec; color:var(--t1); }
  .panel-x svg  { width:14px; height:14px; }

  /* search bar */
  .panel-search {
    display:flex; align-items:center; gap:8px;
    margin: 0 12px 10px;
    padding: 7px 10px;
    background:#f5f5f2; border-radius:var(--r-md);
    border:1px solid transparent; transition: border-color .13s, background .13s;
    flex-shrink:0;
  }
  .panel-search:focus-within { border-color:var(--accent); background:#fff; }
  .panel-search svg { width:13px; height:13px; color:var(--t3); flex-shrink:0; }
  .panel-search input {
    border:none; background:none; outline:none;
    font-size:13px; color:var(--t1); width:100%; font-family:var(--font);
  }
  .panel-search input::placeholder { color:var(--t3); }

  /* scroll list */
  .panel-list {
    flex:1; overflow-y:auto; padding:0 8px 16px;
    scrollbar-width:thin; scrollbar-color:#e0e0da transparent;
  }
  .panel-list::-webkit-scrollbar { width:4px; }
  .panel-list::-webkit-scrollbar-thumb { background:#ddddd8; border-radius:2px; }

  .panel-empty { font-size:12px; color:var(--t3); text-align:center; padding:28px 12px; line-height:1.6; }

  /* chat row */
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
  .proj-row:hover .row-menu-btn  { opacity:1; }
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
  .row-dropdown button.del    { color:var(--danger); }
  .row-dropdown button.del:hover { background:var(--danger-bg); }

  .rename-input-row {
    flex:1; font-size:13px; padding:4px 6px;
    border:1px solid var(--accent); border-radius:var(--r-sm);
    background:#fff; color:var(--t1); outline:none; font-family:var(--font);
    margin:4px 0;
  }

  /* ── PROJECTS ─────────────────────────────────────────── */
  .new-proj-btn {
    margin: 0 12px 10px;
    padding: 7px 12px;
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
    padding:2px 4px 2px 4px; border-radius:var(--r-sm);
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
    border-radius:4px; opacity:0; transition:opacity .12s, color .12s;
    flex-shrink:0;
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

  /* ── CODE PLACEHOLDER ─────────────────────────────────── */
  .code-ph {
    flex:1; display:flex; flex-direction:column;
    align-items:center; justify-content:center;
    gap:12px; padding:32px 24px; text-align:center; color:var(--t3);
  }
  .code-ph svg  { width:42px; height:42px; color:#ccc8be; }
  .code-ph h3   { margin:0; font-size:15px; font-weight:600; color:var(--t2); }
  .code-ph p    { margin:0; font-size:13px; line-height:1.6; }
  .code-badge   {
    display:inline-block; background:var(--accent-bg); color:var(--accent);
    font-size:10px; font-weight:600; padding:2px 8px; border-radius:20px;
    letter-spacing:.05em; text-transform:uppercase;
  }

  /* ── OVERLAY ──────────────────────────────────────────── */
  .sb-overlay {
    position:fixed; inset:0; z-index:280;
    background:rgba(0,0,0,.12); backdrop-filter:blur(1px);
    animation:fadeIn .15s ease;
  }

  /* ── LOGOUT MODAL ─────────────────────────────────────── */
  .modal-back {
    position:fixed; inset:0; z-index:600;
    background:rgba(0,0,0,.28);
    display:flex; align-items:center; justify-content:center;
    animation:fadeIn .15s ease;
  }
  @keyframes fadeIn { from{opacity:0} to{opacity:1} }
  .modal-box {
    background:var(--bg-panel); border-radius:var(--r-lg);
    padding:24px; width:300px; box-shadow:0 24px 60px rgba(0,0,0,.18);
    animation:slideUp .17s ease;
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

  /* new chat flash */
  @keyframes chatSlide {
    from{opacity:0;transform:translateX(-8px)}
    to  {opacity:1;transform:translateX(0)}
  }
  .new-chat-anim { animation:chatSlide .2s ease; }

  /* mobile strip collapse */
  @media(max-width:640px){
    .sb-panel.open { width:min(var(--panel-w), calc(100vw - var(--strip-w))); }
  }
`;

/* ═══════════════════════════════════════════════════════════
   SIDEBAR COMPONENT
═══════════════════════════════════════════════════════════ */
export default function Sidebar({
  user, chats, setChats,
  activeChatId, setActiveChatId,
  onLogout, sidebarOpen, setSidebarOpen,
}) {
  const [panel, setPanel]           = useState(null); // "chats"|"projects"|"code"
  const [search, setSearch]         = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showAcct, setShowAcct]     = useState(false);
  const [showLogout, setShowLogout] = useState(false);

  // projects
  const [projects, setProjects]           = useState(() => {
    try { return JSON.parse(localStorage.getItem("eloria_projects") || "[]"); } catch { return []; }
  });
  const [openProjId, setOpenProjId]       = useState(null);
  const [projMenuId, setProjMenuId]       = useState(null);
  const [newProjName, setNewProjName]     = useState("");
  const [showNewProj, setShowNewProj]     = useState(false);
  const [addChatProj, setAddChatProj]     = useState(null);

  const acctRef = useRef(null);

  // inject styles once
  useEffect(() => {
    if (!document.getElementById("eloria-global")) {
      const tag = document.createElement("style");
      tag.id = "eloria-global";
      tag.textContent = GLOBAL_STYLE + SIDEBAR_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  // persist projects
  useEffect(() => {
    localStorage.setItem("eloria_projects", JSON.stringify(projects));
    // Firestore: projects.forEach(p => setDoc(doc(db,"users",user.uid,"projects",String(p.id)),p));
  }, [projects]);

  // clear animate flag
  useEffect(() => {
    if (chats.some(c => c.animate))
      setChats(chats.map(c => c.animate ? { ...c, animate: false } : c));
  }, [chats, setChats]);

  // close account popup on outside click
  useEffect(() => {
    const h = e => { if (acctRef.current && !acctRef.current.contains(e.target)) setShowAcct(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* actions */
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
  const initials = user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U";

  return (
    <>
      {/* overlay when panel open */}
      {panel && <div className="sb-overlay" onClick={() => setPanel(null)} />}

      {/* ── STRIP ── */}
      <aside className="sb-strip">
        <div className="sb-logo"><img src={logo} alt="Eloria" /></div>

        {/* New Chat */}
        <button className="sb-btn" title="New Chat" onClick={addChat}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          <span>New</span>
        </button>

        {/* Chats */}
        <button className={`sb-btn${panel==="chats"?" active":""}`} title="Chats" onClick={()=>togglePanel("chats")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
          <span>Chats</span>
        </button>

        {/* Projects */}
        <button className={`sb-btn${panel==="projects"?" active":""}`} title="Projects" onClick={()=>togglePanel("projects")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
          </svg>
          <span>Projects</span>
        </button>

        {/* Eloria Code */}
        <button className={`sb-btn${panel==="code"?" active":""}`} title="Eloria Code" onClick={()=>togglePanel("code")}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span>Code</span>
        </button>

        <div className="sb-spacer" />

        {/* Account */}
        <div className="sb-avatar-wrap" ref={acctRef}>
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
              <button className="acct-logout" onClick={()=>{setShowAcct(false);setShowLogout(true);}}>
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

      {/* ── PANEL ── */}
      <div className={`sb-panel${panel?" open":""}`}>
        <div className="panel-inner">

          {/* ── CHATS ── */}
          {panel==="chats" && <>
            <div className="panel-hdr">
              <span className="panel-title">Chats</span>
              <button className="panel-x" onClick={()=>setPanel(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
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
                      <button className="del" onClick={()=>deleteChat(chat.id)}>Delete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>}

          {/* ── PROJECTS ── */}
          {panel==="projects" && <>
            <div className="panel-hdr">
              <span className="panel-title">Projects</span>
              <button className="panel-x" onClick={()=>setPanel(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
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

          {/* ── ELORIA CODE ── */}
          {panel==="code" && <>
            <div className="panel-hdr">
              <span className="panel-title">Eloria Code</span>
              <button className="panel-x" onClick={()=>setPanel(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
            <div className="code-ph">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
              </svg>
              <span className="code-badge">Coming soon</span>
              <h3>Eloria Code</h3>
              <p>Your AI-powered coding environment is on its way.</p>
            </div>
          </>}

        </div>
      </div>

      {/* ── LOGOUT MODAL ── */}
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
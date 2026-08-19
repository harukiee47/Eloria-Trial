import React, { useEffect, useState } from "react";
import ConnectorsModal from "./ConnectorsModal";

const THEME_KEY = "eloria-theme";
const DEFAULT_THEME = "light"; // Eloria defaults to light regardless of OS preference

export function applyStoredTheme() {
  const saved = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  const resolved =
    saved === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : saved;
  document.documentElement.setAttribute("data-theme", resolved);
}

export default function SettingsModal({ open, onClose, user }) {
  const [tab, setTab] = useState("appearance");
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || DEFAULT_THEME);
  const [connectorsOpen, setConnectorsOpen] = useState(false);

  useEffect(() => {
    applyStoredTheme();
  }, []);

  function chooseTheme(value) {
    setTheme(value);
    localStorage.setItem(THEME_KEY, value);
    applyStoredTheme();
  }

  if (!open) return null;

  return (
    <div className="stg-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="stg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="stg-sidebar">
          <div className="stg-title">Settings</div>
          <button className={`stg-navitem${tab === "appearance" ? " active" : ""}`} onClick={() => setTab("appearance")}>
            <IconSun /> Appearance
          </button>
          <button className={`stg-navitem${tab === "connectors" ? " active" : ""}`} onClick={() => setTab("connectors")}>
            <IconPlug /> Connectors
          </button>
          <button className={`stg-navitem${tab === "general" ? " active" : ""}`} onClick={() => setTab("general")}>
            <IconUser /> General
          </button>
        </div>

        <div className="stg-panel">
          <button className="stg-close" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>

          {tab === "appearance" && (
            <div>
              <h3 className="stg-h">Appearance</h3>
              <p className="stg-sub">Choose how Eloria looks on this device.</p>
              <div className="stg-theme-row">
                {[
                  { id: "light", label: "Light" },
                  { id: "dark", label: "Dark" },
                  { id: "system", label: "System" },
                ].map((t) => (
                  <button
                    key={t.id}
                    className={`stg-theme-card${theme === t.id ? " active" : ""}`}
                    onClick={() => chooseTheme(t.id)}
                  >
                    <span className={`stg-swatch stg-swatch-${t.id}`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === "connectors" && (
            <div>
              <h3 className="stg-h">Connectors</h3>
              <p className="stg-sub">Let Eloria access GitHub, Gmail, Drive, and any custom API you connect.</p>
              <button className="stg-btn" onClick={() => setConnectorsOpen(true)}>
                Manage connectors
              </button>
            </div>
          )}

          {tab === "general" && (
            <div>
              <h3 className="stg-h">General</h3>
              <p className="stg-sub">Basic account info.</p>
              <div className="stg-field">
                <span className="stg-field-label">Name</span>
                <span className="stg-field-value">{user?.displayName || "—"}</span>
              </div>
              <div className="stg-field">
                <span className="stg-field-label">Email</span>
                <span className="stg-field-value">{user?.email || "—"}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConnectorsModal open={connectorsOpen} onClose={() => setConnectorsOpen(false)} initialView="browse" />
    </div>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>
    </svg>
  );
}
function IconPlug() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 2v6M15 2v6M6 9h12l-1 6a5 5 0 01-10 0L6 9zM12 19v3"/>
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

const CSS = `
.stg-overlay {
  position: fixed; inset: 0; background: rgba(6,14,12,.45);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display:flex; align-items:center; justify-content:center;
  z-index: 850; animation: stgFadeIn .18s ease;
}
@keyframes stgFadeIn { from { opacity:0; } to { opacity:1; } }
.stg-modal {
  width: min(660px, 92vw); height: min(480px, 82vh); display:flex;
  background: var(--bg-panel); border-radius: 20px; overflow:hidden;
  border: 1px solid var(--border-soft);
  box-shadow: 0 30px 80px rgba(0,0,0,.30), 0 2px 8px rgba(0,0,0,.10);
  font-family: var(--font);
  animation: stgPopIn .22s cubic-bezier(.2,.8,.2,1);
}
@keyframes stgPopIn { from { opacity:0; transform: translateY(14px) scale(.96); } to { opacity:1; transform: translateY(0) scale(1); } }

.stg-sidebar { width: 178px; flex-shrink:0; background: var(--bg-card-2); border-right: 1px solid var(--border-soft); padding: 18px 10px; display:flex; flex-direction:column; gap:2px; }
.stg-title { font-size: 13px; font-weight:700; color: var(--t1); padding: 4px 10px 16px; letter-spacing:.01em; }
.stg-navitem {
  display:flex; align-items:center; gap:9px; border:none; background:none; text-align:left;
  padding:9px 10px; border-radius:10px; font-size:13px; font-weight:600; color: var(--t2);
  cursor:pointer; transition: background .16s ease, color .16s ease, transform .12s ease;
}
.stg-navitem svg { width:15px; height:15px; flex-shrink:0; transition: transform .16s ease; }
.stg-navitem:hover { background: var(--accent-bg); color: var(--t1); }
.stg-navitem:hover svg { transform: scale(1.08); }
.stg-navitem.active { background: var(--bg-card); color: var(--accent); box-shadow: 0 1px 3px rgba(0,0,0,.08), inset 0 0 0 1px var(--border-soft); }
.stg-navitem.active svg { color: var(--accent); }

.stg-panel { flex:1; padding: 26px 28px; position:relative; overflow-y:auto; animation: stgTabIn .18s ease; }
@keyframes stgTabIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
.stg-close { position:absolute; top:14px; right:14px; border:none; background:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; color: var(--t3); cursor:pointer; transition: background .14s, color .14s, transform .12s; }
.stg-close:hover { background: var(--accent-bg); color: var(--accent); transform: rotate(90deg); }
.stg-close svg { width:15px; height:15px; }
.stg-h { font-size:16.5px; font-weight:700; color: var(--t1); margin-bottom:4px; letter-spacing:-.01em; }
.stg-sub { font-size:12.5px; color: var(--t3); margin-bottom:20px; line-height:1.5; }

.stg-theme-row { display:flex; gap:10px; }
.stg-theme-card {
  display:flex; flex-direction:column; align-items:center; gap:8px;
  border:1.5px solid var(--border); background: var(--bg-card);
  padding:12px 18px; border-radius:14px; cursor:pointer; font-size:12px; font-weight:600; color: var(--t2);
  transition: border-color .14s ease, color .14s ease, transform .12s ease, box-shadow .14s ease;
}
.stg-theme-card:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,.08); }
.stg-theme-card.active { border-color: var(--accent); color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.stg-swatch { width:48px; height:32px; border-radius:8px; display:block; border:1px solid rgba(0,0,0,.08); transition: transform .12s ease; }
.stg-theme-card:hover .stg-swatch { transform: scale(1.04); }
.stg-swatch-light { background: linear-gradient(135deg, #fdfaf6, #eaf2ef); }
.stg-swatch-dark { background: linear-gradient(135deg, #1a1b1a, #0e0f0e); }
.stg-swatch-system { background: linear-gradient(135deg, #fdfaf6 50%, #0e0f0e 50%); }

.stg-btn { border:none; background: var(--accent); color: var(--accent-fg); font-family:var(--font); font-weight:600; font-size:13px; padding:9px 18px; border-radius:10px; cursor:pointer; transition: background .14s, transform .12s, box-shadow .14s; }
.stg-btn:hover { background: var(--accent-deep); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.12); }
.stg-btn:active { transform: translateY(0); }
.stg-field { display:flex; justify-content:space-between; padding:11px 0; border-bottom:1px solid var(--border-soft); font-size:13px; }
.stg-field-label { color: var(--t3); }
.stg-field-value { color: var(--t1); font-weight:600; }
`;
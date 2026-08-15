import React, { useEffect, useState } from "react";
import ConnectorsModal from "./ConnectorsModal";

const THEME_KEY = "eloria-theme";

export function applyStoredTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "system";
  const resolved =
    saved === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : saved;
  document.documentElement.setAttribute("data-theme", resolved);
}

export default function SettingsModal({ open, onClose, user }) {
  const [tab, setTab] = useState("appearance");
  const [theme, setTheme] = useState(localStorage.getItem(THEME_KEY) || "system");
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
                <span className="stg-field-value">{user?.username || "—"}</span>
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
  position: fixed; inset: 0; background: rgba(13,58,53,.35);
  backdrop-filter: blur(3px);
  display:flex; align-items:center; justify-content:center;
  z-index: 850; animation: stgFadeIn .15s ease;
}
@keyframes stgFadeIn { from { opacity:0; } to { opacity:1; } }
.stg-modal {
  width: min(620px, 92vw); height: min(460px, 80vh); display:flex;
  background: var(--bg-panel, #fdfaf6); border-radius: 20px; overflow:hidden;
  box-shadow: 0 24px 70px rgba(13,58,53,.28); font-family: var(--font);
  animation: stgPopIn .16s ease;
}
@keyframes stgPopIn { from { opacity:0; transform: translateY(10px) scale(.97); } to { opacity:1; transform: translateY(0) scale(1); } }
.stg-sidebar { width: 170px; flex-shrink:0; background: var(--accent-bg,#eaf2ef); padding: 18px 10px; display:flex; flex-direction:column; gap:2px; }
.stg-title { font-size: 13px; font-weight:700; color: var(--t1,#0D3A35); padding: 4px 10px 14px; }
.stg-navitem { display:flex; align-items:center; gap:9px; border:none; background:none; text-align:left; padding:9px 10px; border-radius:10px; font-size:13px; font-weight:600; color: var(--t2,#3a5a55); cursor:pointer; transition: background .12s, color .12s; }
.stg-navitem svg { width:15px; height:15px; flex-shrink:0; }
.stg-navitem:hover { background: rgba(255,255,255,.5); }
.stg-navitem.active { background:#fff; color: var(--accent,#276152); box-shadow: 0 1px 4px rgba(13,58,53,.10); }
.stg-panel { flex:1; padding: 24px 26px; position:relative; overflow-y:auto; }
.stg-close { position:absolute; top:14px; right:14px; border:none; background:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; color: var(--t3,#7a8a84); cursor:pointer; }
.stg-close:hover { background: var(--accent-bg,#eaf2ef); color: var(--accent,#276152); }
.stg-close svg { width:15px; height:15px; }
.stg-h { font-size:16px; font-weight:700; color: var(--t1,#0D3A35); margin-bottom:4px; }
.stg-sub { font-size:12.5px; color: var(--t3,#7a8a84); margin-bottom:18px; }
.stg-theme-row { display:flex; gap:10px; }
.stg-theme-card { display:flex; flex-direction:column; align-items:center; gap:8px; border:1.5px solid var(--border,#cdd0c9); background:#fff; padding:12px 16px; border-radius:14px; cursor:pointer; font-size:12px; font-weight:600; color: var(--t2,#3a5a55); }
.stg-theme-card.active { border-color: var(--accent,#276152); color: var(--accent,#276152); }
.stg-swatch { width:44px; height:30px; border-radius:8px; display:block; border:1px solid rgba(0,0,0,.06); }
.stg-swatch-light { background: linear-gradient(135deg, #fdfaf6, #eaf2ef); }
.stg-swatch-dark { background: linear-gradient(135deg, #14201d, #1f3630); }
.stg-swatch-system { background: linear-gradient(135deg, #fdfaf6 50%, #14201d 50%); }
.stg-btn { border:none; background: var(--accent,#276152); color:#fff; font-family:var(--font); font-weight:600; font-size:13px; padding:9px 18px; border-radius:10px; cursor:pointer; }
.stg-btn:hover { background: var(--accent-deep,#1a4a3d); }
.stg-field { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border-soft,#dde0d9); font-size:13px; }
.stg-field-label { color: var(--t3,#7a8a84); }
.stg-field-value { color: var(--t1,#0D3A35); font-weight:600; }
`;
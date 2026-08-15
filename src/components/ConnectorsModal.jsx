import React, { useEffect, useState } from "react";
import {
  listConnectors,
  startConnectorOAuth,
  disconnectConnector,
  createCustomConnector,
  updateCustomConnector,
  deleteCustomConnector,
} from "../services/connectorService";

const PROVIDER_ICON = {
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A10.51 10.51 0 0023.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>
  ),
  gmail: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm2 0v.4l8 5.6 8-5.6V6H4zm16 2.3l-7.4 5.2a1 1 0 01-1.2 0L4 8.3V18h16V8.3z"/></svg>
  ),
  drive: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7.7 2h8.6l7.7 13.3-4.3 7.4H4.3L0 15.3 7.7 2zm.9 1.7L2.2 15h6.9l6.4-11.1v-.2H8.6zm7.2 0l6.4 11.1h-6.9L8.9 3.7h6.9zM4.3 16.7l3.3 5.6h11.8l3.3-5.6H4.3z"/></svg>
  ),
  notion: (
    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 3.5l11 -.8c1.3 -.1 1.7 .3 2.6 1l3.4 2.7c.6.5.8.7.8 1.2V19c0 .9-.3 1.4-1.5 1.5l-12.8.8c-.8 0-1.2-.1-1.6-.7L2.7 17c-.5-.6-.7-1.1-.7-1.7V5.3c0-.7.3-1.3 1.1-1.4z"/></svg>
  ),
  slack: (
    <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="6.5" cy="10" r="2.5"/><circle cx="17.5" cy="6.5" r="2.5"/><circle cx="10" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>
  ),
  custom: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h6v6H4zM14 4h6v6h-6zM14 14h6v6h-6zM4 14h6v6H4z"/></svg>
  ),
};

const AUTH_TYPES = [
  { id: "none", label: "No authentication" },
  { id: "api_key", label: "API key (custom header)" },
  { id: "bearer", label: "Bearer token" },
  { id: "basic", label: "Basic auth" },
];

export default function ConnectorsModal({ open, onClose, initialView = "browse" }) {
  const [view, setView] = useState(initialView);
  const [loading, setLoading] = useState(true);
  const [builtin, setBuiltin] = useState([]);
  const [custom, setCustom] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [editingCustom, setEditingCustom] = useState(null); // custom connector being edited, or null = new

  useEffect(() => {
    if (open) {
      setView(initialView);
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialView]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const data = await listConnectors();
      setBuiltin(data.builtin || []);
      setCustom(data.custom || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect(provider) {
    setBusyId(provider.id);
    setError("");
    try {
      await startConnectorOAuth(provider.id);
      // page will redirect to the provider; nothing else to do here
    } catch (err) {
      setError(err.message);
      setBusyId(null);
    }
  }

  async function handleDisconnect(provider) {
    setBusyId(provider.id);
    try {
      await disconnectConnector(provider.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteCustom(id) {
    setBusyId(id);
    try {
      await deleteCustomConnector(id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (!open) return null;

  return (
    <div className="cnx-overlay" onClick={onClose}>
      <style>{CSS}</style>
      <div className="cnx-modal" onClick={(e) => e.stopPropagation()}>
        <div className="cnx-head">
          <div className="cnx-tabs">
            <button className={`cnx-tab${view === "browse" ? " active" : ""}`} onClick={() => setView("browse")}>
              Browse connectors
            </button>
            <button className={`cnx-tab${view === "custom" ? " active" : ""}`} onClick={() => { setEditingCustom(null); setView("custom"); }}>
              Add custom connector
            </button>
          </div>
          <button className="cnx-close" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {error && <div className="cnx-error">{error}</div>}

        <div className="cnx-body">
          {loading ? (
            <div className="cnx-loading">Loading connectors…</div>
          ) : view === "browse" ? (
            <BrowseView
              builtin={builtin}
              custom={custom}
              busyId={busyId}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onEditCustom={(c) => { setEditingCustom(c); setView("custom"); }}
              onDeleteCustom={handleDeleteCustom}
            />
          ) : (
            <CustomConnectorForm
              editing={editingCustom}
              onSaved={async () => { setEditingCustom(null); await refresh(); setView("browse"); }}
              onCancel={() => { setEditingCustom(null); setView("browse"); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function BrowseView({ builtin, custom, busyId, onConnect, onDisconnect, onEditCustom, onDeleteCustom }) {
  return (
    <>
      <p className="cnx-section-label">Built-in connectors</p>
      <div className="cnx-grid">
        {builtin.map((p) => (
          <div key={p.id} className="cnx-card">
            <div className="cnx-card-icon">{PROVIDER_ICON[p.icon] || PROVIDER_ICON.custom}</div>
            <div className="cnx-card-body">
              <div className="cnx-card-name">{p.name}</div>
              <div className="cnx-card-desc">{p.description}</div>
              {!p.configured && <div className="cnx-card-note">Not configured yet by the app owner</div>}
            </div>
            {p.connected ? (
              <button
                className="cnx-btn cnx-btn-outline"
                disabled={busyId === p.id}
                onClick={() => onDisconnect(p)}
              >
                {busyId === p.id ? "…" : "Disconnect"}
              </button>
            ) : (
              <button
                className="cnx-btn"
                disabled={!p.configured || busyId === p.id}
                onClick={() => onConnect(p)}
              >
                {busyId === p.id ? "…" : "Connect"}
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="cnx-section-label" style={{ marginTop: 22 }}>Your custom connectors</p>
      {custom.length === 0 ? (
        <div className="cnx-empty">
          No custom connectors yet. Switch to <b>Add custom connector</b> to connect any API.
        </div>
      ) : (
        <div className="cnx-grid">
          {custom.map((c) => (
            <div key={c.id} className="cnx-card">
              <div className="cnx-card-icon">{PROVIDER_ICON.custom}</div>
              <div className="cnx-card-body">
                <div className="cnx-card-name">{c.name}</div>
                <div className="cnx-card-desc">{c.description || c.baseUrl}</div>
              </div>
              <div className="cnx-card-actions">
                <button className="cnx-btn-icon" title="Edit" onClick={() => onEditCustom(c)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>
                </button>
                <button className="cnx-btn-icon danger" title="Delete" disabled={busyId === c.id} onClick={() => onDeleteCustom(c.id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CustomConnectorForm({ editing, onSaved, onCancel }) {
  const [name, setName] = useState(editing?.name || "");
  const [description, setDescription] = useState(editing?.description || "");
  const [baseUrl, setBaseUrl] = useState(editing?.baseUrl || "");
  const [authType, setAuthType] = useState(editing?.authType || "none");
  const [headerName, setHeaderName] = useState(editing?.headerName || "x-api-key");
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    if (!name.trim() || !baseUrl.trim()) {
      setErr("Name and base URL are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        baseUrl: baseUrl.trim(),
        authType,
        headerName: authType === "api_key" ? headerName.trim() || "x-api-key" : null,
        secret: secret || undefined,
      };
      if (editing) {
        await updateCustomConnector(editing.id, payload);
      } else {
        await createCustomConnector(payload);
      }
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="cnx-form" onSubmit={handleSubmit}>
      <p className="cnx-section-label">
        {editing ? "Edit custom connector" : "Connect any API"}
      </p>
      <p className="cnx-form-hint">
        Give the AI access to any HTTP API — internal tools, a REST service, anything with a base URL.
      </p>

      {err && <div className="cnx-error">{err}</div>}

      <label className="cnx-label">Name</label>
      <input className="cnx-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Internal Ticketing API" />

      <label className="cnx-label">Description</label>
      <textarea className="cnx-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What can this connector do? Helps the AI decide when to use it." rows={2} />

      <label className="cnx-label">Base URL</label>
      <input className="cnx-input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com" />

      <label className="cnx-label">Authentication</label>
      <div className="cnx-authtype-row">
        {AUTH_TYPES.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`cnx-chip${authType === t.id ? " active" : ""}`}
            onClick={() => setAuthType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {authType === "api_key" && (
        <>
          <label className="cnx-label">Header name</label>
          <input className="cnx-input" value={headerName} onChange={(e) => setHeaderName(e.target.value)} placeholder="x-api-key" />
        </>
      )}

      {authType !== "none" && (
        <>
          <label className="cnx-label">
            {authType === "basic" ? "Credentials (user:pass)" : authType === "bearer" ? "Bearer token" : "API key"}
          </label>
          <input
            className="cnx-input"
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={editing ? "Leave blank to keep the existing value" : "Paste your key or token"}
          />
        </>
      )}

      <div className="cnx-form-actions">
        <button type="button" className="cnx-btn cnx-btn-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cnx-btn" disabled={saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add connector"}
        </button>
      </div>
    </form>
  );
}

const CSS = `
.cnx-overlay {
  position: fixed; inset: 0; background: rgba(6,14,12,.45);
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  display: flex; align-items: center; justify-content: center;
  z-index: 900; animation: cnxFadeIn .18s ease;
}
@keyframes cnxFadeIn { from { opacity: 0; } to { opacity: 1; } }
.cnx-modal {
  width: min(640px, 92vw); max-height: 82vh; display: flex; flex-direction: column;
  background: var(--bg-panel); border-radius: 20px;
  border: 1px solid var(--border-soft);
  box-shadow: 0 30px 80px rgba(0,0,0,.30), 0 2px 8px rgba(0,0,0,.10);
  animation: cnxPopIn .22s cubic-bezier(.2,.8,.2,1);
  font-family: var(--font);
}
@keyframes cnxPopIn { from { opacity:0; transform: translateY(14px) scale(.96); } to { opacity:1; transform: translateY(0) scale(1); } }
.cnx-head { display:flex; align-items:center; justify-content:space-between; padding: 16px 16px 0 22px; }
.cnx-tabs { display:flex; gap: 4px; background: var(--bg-card-2); padding: 4px; border-radius: 12px; border: 1px solid var(--border-soft); }
.cnx-tab { border:none; background:none; padding:8px 14px; font-size:13px; font-weight:600; color: var(--t2); border-radius: 9px; cursor:pointer; transition: background .16s ease, color .16s ease; }
.cnx-tab:hover:not(.active) { color: var(--t1); }
.cnx-tab.active { background: var(--bg-card); color: var(--accent); box-shadow: 0 1px 4px rgba(0,0,0,.10); }
.cnx-close { border:none; background:none; width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; color: var(--t3); cursor:pointer; transition: background .14s, color .14s, transform .12s; }
.cnx-close:hover { background: var(--accent-bg); color: var(--accent); transform: rotate(90deg); }
.cnx-close svg { width:16px; height:16px; }
.cnx-body { overflow-y:auto; padding: 18px 22px 24px; animation: cnxTabIn .18s ease; }
@keyframes cnxTabIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
.cnx-section-label { font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; color: var(--t3); margin: 4px 0 12px; }
.cnx-grid { display:flex; flex-direction:column; gap:8px; }
.cnx-card {
  display:flex; align-items:center; gap:12px; padding:13px 15px;
  border:1px solid var(--border-soft); border-radius:14px; background: var(--bg-card);
  transition: border-color .16s ease, box-shadow .16s ease, transform .12s ease;
}
.cnx-card:hover { border-color: var(--border); box-shadow: 0 4px 14px rgba(0,0,0,.06); transform: translateY(-1px); }
.cnx-card-icon { width:38px; height:38px; border-radius:10px; background: var(--accent-bg); color: var(--accent); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.cnx-card-icon svg { width:19px; height:19px; }
.cnx-card-body { flex:1; min-width:0; }
.cnx-card-name { font-size:13.5px; font-weight:600; color: var(--t1); }
.cnx-card-desc { font-size:12px; color: var(--t3); margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cnx-card-note { font-size:10.5px; color:#c99a4a; margin-top:3px; }
.cnx-card-actions { display:flex; gap:6px; }
.cnx-btn { border:none; background: var(--accent); color: var(--accent-fg); font-family:var(--font); font-weight:600; font-size:12.5px; padding:8px 16px; border-radius:10px; cursor:pointer; transition: background .14s, transform .12s, box-shadow .14s; white-space:nowrap; }
.cnx-btn:hover:not(:disabled) { background: var(--accent-deep); transform: translateY(-1px); box-shadow: 0 6px 16px rgba(0,0,0,.14); }
.cnx-btn:active:not(:disabled) { transform: translateY(0); }
.cnx-btn:disabled { opacity:.45; cursor:not-allowed; }
.cnx-btn-outline { background:none; color: var(--t1); border:1px solid var(--border); }
.cnx-btn-outline:hover:not(:disabled) { background: var(--bg-card-2); box-shadow:none; transform:none; }
.cnx-btn-icon { border:none; background:none; width:30px; height:30px; border-radius:8px; display:flex; align-items:center; justify-content:center; color: var(--t3); cursor:pointer; transition: background .14s, color .14s; }
.cnx-btn-icon svg { width:15px; height:15px; }
.cnx-btn-icon:hover { background: var(--accent-bg); color: var(--accent); }
.cnx-btn-icon.danger:hover { background:var(--danger-bg); color:var(--danger); }
.cnx-empty { font-size:12.5px; color: var(--t3); background: var(--bg-card-2); border:1px dashed var(--border); border-radius:14px; padding:20px; text-align:center; }
.cnx-error { margin: 0 22px 10px; background:var(--danger-bg); color:var(--danger); font-size:12.5px; padding:9px 12px; border-radius:10px; }
.cnx-loading { font-size:13px; color: var(--t3); padding: 34px 0; text-align:center; }

.cnx-form { display:flex; flex-direction:column; }
.cnx-form-hint { font-size:12.5px; color: var(--t2); margin: -6px 0 16px; line-height:1.5; }
.cnx-label { font-size:12px; font-weight:600; color: var(--t1); margin: 12px 0 6px; }
.cnx-input, .cnx-textarea { font-family: var(--font); font-size:13px; border:1px solid var(--border); border-radius:10px; padding:10px 12px; background: var(--bg-card); color: var(--t1); resize: vertical; transition: border-color .14s ease, box-shadow .14s ease; }
.cnx-input:focus, .cnx-textarea:focus { outline:none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.cnx-authtype-row { display:flex; flex-wrap:wrap; gap:6px; }
.cnx-chip { border:1px solid var(--border); background: var(--bg-card); color: var(--t2); font-family:var(--font); font-size:11.5px; font-weight:600; padding:7px 12px; border-radius:20px; cursor:pointer; transition: all .14s ease; }
.cnx-chip:hover:not(.active) { border-color: var(--accent); color: var(--t1); }
.cnx-chip.active { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
.cnx-form-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:20px; }
`;
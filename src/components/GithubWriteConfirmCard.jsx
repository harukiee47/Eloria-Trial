import React, { useState } from "react";
import { auth } from "../services/firebase";

function GithubWriteConfirmCard({ proposal, onResolved }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const status = proposal.resolved; // undefined | "approved" | "rejected" | "error"
  const action = proposal.action || "write_file";

  async function respond(act) {
    setBusy(true);
    setErr("");
    try {
      const token = await auth.currentUser.getIdToken();
      const res = await fetch(
        `https://eloria-trial.onrender.com/api/connectors/github/pending/${proposal.pendingId}/${act}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed.");
      onResolved(act === "approve" ? "approved" : "rejected");
    } catch (e) {
      setErr(e.message);
      onResolved("error");
    } finally {
      setBusy(false);
    }
  }

  if (status === "approved") {
    const doneLabel =
      action === "create_repo" ? <>Created repo <code>{proposal.name}</code></> :
      action === "delete_repo" ? <>Deleted <code>{proposal.owner}/{proposal.repo}</code></> :
      <>Committed <code>{proposal.path}</code> to {proposal.owner}/{proposal.repo}</>;
    return <div className="cw-gh-card cw-gh-card-done"><style>{GH_CARD_CSS}</style><IconCheckCircle /> {doneLabel}</div>;
  }
  if (status === "rejected") {
    return (
      <div className="cw-gh-card cw-gh-card-done cw-gh-card-rejected">
        <style>{GH_CARD_CSS}</style>
        {action === "create_repo" && <>Creating <code>{proposal.name}</code> was rejected.</>}
        {action === "delete_repo" && <>Deleting <code>{proposal.owner}/{proposal.repo}</code> was rejected.</>}
        {action === "write_file" && <>Change to <code>{proposal.path}</code> was rejected.</>}
      </div>
    );
  }

  if (action === "create_repo") {
    return (
      <div className="cw-gh-card">
        <style>{GH_CARD_CSS}</style>
        <div className="cw-gh-card-head">
          <IconGithubSmall />
          <div className="cw-gh-card-title">
            Wants to create repo <code>{proposal.name}</code>
            <span className="cw-gh-card-repo">
              {proposal.private ? "Private" : "Public"}{proposal.description ? ` · ${proposal.description}` : ""}
            </span>
          </div>
        </div>
        {err && <div className="cw-gh-card-error">{err}</div>}
        <div className="cw-gh-card-actions">
          <button className="cw-gh-btn cw-gh-btn-outline" disabled={busy} onClick={() => respond("reject")}>Reject</button>
          <button className="cw-gh-btn" disabled={busy} onClick={() => respond("approve")}>{busy ? "Working…" : "Approve & create"}</button>
        </div>
      </div>
    );
  }

  if (action === "delete_repo") {
    return (
      <div className="cw-gh-card cw-gh-card-danger">
        <style>{GH_CARD_CSS}</style>
        <div className="cw-gh-card-head">
          <IconGithubSmall />
          <div className="cw-gh-card-title">
            Wants to <span style={{ color: "var(--danger)" }}>delete</span> <code>{proposal.owner}/{proposal.repo}</code>
            <span className="cw-gh-card-repo">This is permanent and cannot be undone.</span>
          </div>
        </div>
        {err && <div className="cw-gh-card-error">{err}</div>}
        <div className="cw-gh-card-actions">
          <button className="cw-gh-btn cw-gh-btn-outline" disabled={busy} onClick={() => respond("reject")}>Reject</button>
          <button className="cw-gh-btn cw-gh-btn-danger" disabled={busy} onClick={() => respond("approve")}>{busy ? "Working…" : "Delete permanently"}</button>
        </div>
      </div>
    );
  }

  // write_file (default)
  return (
    <div className="cw-gh-card">
      <style>{GH_CARD_CSS}</style>
      <div className="cw-gh-card-head">
        <IconGithubSmall />
        <div className="cw-gh-card-title">
          {proposal.isNewFile ? "Wants to create " : "Wants to update "}<code>{proposal.path}</code>
          <span className="cw-gh-card-repo">
            {proposal.owner}/{proposal.repo} · {proposal.branch}
            {typeof proposal.linesAdded === "number" && (
              <>
                {" · "}
                <span className="cw-gh-diff-add">+{proposal.linesAdded}</span>{" "}
                <span className="cw-gh-diff-del">-{proposal.linesRemoved}</span>
              </>
            )}
          </span>
        </div>
      </div>

      {Array.isArray(proposal.diff) && proposal.diff.length > 0 && (
        <pre className="cw-gh-diff">
          {proposal.diff.map((h, i) => (
            <div key={i} className={`cw-gh-diff-line cw-gh-diff-${h.type}`}>
              <span className="cw-gh-diff-marker">{h.type === "add" ? "+" : h.type === "del" ? "-" : " "}</span>
              {h.line || " "}
            </div>
          ))}
        </pre>
      )}

      {err && <div className="cw-gh-card-error">{err}</div>}
      <div className="cw-gh-card-actions">
        <button className="cw-gh-btn cw-gh-btn-outline" disabled={busy} onClick={() => respond("reject")}>Reject</button>
        <button className="cw-gh-btn" disabled={busy} onClick={() => respond("approve")}>
          {busy ? "Working…" : "Approve & commit"}
        </button>
      </div>
    </div>
  );
}

function IconGithubSmall() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16, flexShrink: 0 }}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56 0-.27-.01-1.17-.02-2.12-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.51-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 015.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.8 1.19 1.83 1.19 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15 0 1.55-.01 2.8-.01 3.18 0 .31.21.67.8.56A10.51 10.51 0 0023.5 12C23.5 5.65 18.35.5 12 .5z"/>
    </svg>
  );
}
function IconCheckCircle() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15, flexShrink: 0 }}>
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
    </svg>
  );
}

const GH_CARD_CSS = `
.cw-gh-card {
  background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 14px;
  padding: 12px 14px; margin-top: 6px; max-width: 460px; font-family: var(--font);
  animation: cwGhIn .18s ease;
}
@keyframes cwGhIn { from { opacity:0; transform: translateY(4px); } to { opacity:1; transform: translateY(0); } }
.cw-gh-card-head { display:flex; align-items:flex-start; gap:9px; color: var(--t1); }
.cw-gh-card-title { font-size: 13px; font-weight:600; line-height:1.4; }
.cw-gh-card-title code { background: var(--bg-card-2); padding: 1px 5px; border-radius: 5px; font-size: 12px; }
.cw-gh-card-repo { display:block; font-size: 11px; font-weight:400; color: var(--t3); margin-top: 2px; }
.cw-gh-diff-add { color: #2fa860; font-weight: 600; }
.cw-gh-diff-del { color: var(--danger); font-weight: 600; }
.cw-gh-diff {
  margin: 10px 0 0; padding: 8px 0; max-height: 220px; overflow-y: auto;
  background: var(--bg-card-2); border: 1px solid var(--border-soft); border-radius: 10px;
  font-family: 'SF Mono', Consolas, monospace; font-size: 11.5px; line-height: 1.55;
}
.cw-gh-diff-line { padding: 0 10px; white-space: pre-wrap; word-break: break-all; color: var(--t2); }
.cw-gh-diff-marker { display:inline-block; width: 12px; opacity: .6; user-select: none; }
.cw-gh-diff-add { background: rgba(47,168,96,.12); }
.cw-gh-diff-del { background: rgba(192,64,64,.12); }
.cw-gh-diff-add .cw-gh-diff-marker, .cw-gh-diff-add { color: #2fa860; }
.cw-gh-diff-del .cw-gh-diff-marker, .cw-gh-diff-del { color: var(--danger); }
.cw-gh-card-error { font-size: 11.5px; color: var(--danger); margin-top: 8px; }
.cw-gh-card-actions { display:flex; gap: 8px; margin-top: 10px; }
.cw-gh-btn { border:none; background: var(--accent); color: var(--accent-fg); font-family:var(--font); font-weight:600; font-size:12.5px; padding:7px 14px; border-radius:9px; cursor:pointer; transition: background .14s, transform .12s; }
.cw-gh-btn:hover:not(:disabled) { background: var(--accent-deep); transform: translateY(-1px); }
.cw-gh-btn:disabled { opacity:.5; cursor:default; }
.cw-gh-btn-outline { background:none; color: var(--t2); border: 1px solid var(--border); }
.cw-gh-btn-outline:hover:not(:disabled) { background: var(--bg-card-2); }
.cw-gh-btn-danger { background: var(--danger); }
.cw-gh-btn-danger:hover:not(:disabled) { background: var(--danger); opacity: .88; }
.cw-gh-card-danger { border-color: var(--danger-bg); }
.cw-gh-card-done { display:flex; align-items:center; gap:7px; font-size:12.5px; color: var(--t2); }
.cw-gh-card-done code { background: var(--bg-card-2); padding: 1px 5px; border-radius: 5px; }
.cw-gh-card-rejected { color: var(--t3); }
`;

export default GithubWriteConfirmCard;

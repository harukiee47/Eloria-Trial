// src/components/ProfileSetupModal.jsx
import React, { useState } from "react";
import { db } from "../services/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { claimUsername, validateUsernameFormat } from "../services/usernameService";

const STYLE = `
  .psm-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.45); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
  }
  .psm-modal {
    background: var(--bg-card, #fdfaf6); border-radius: 18px;
    width: 340px; margin: 0 16px;
    padding: 28px 26px 24px;
    box-shadow: 0 24px 60px rgba(0,0,0,.22);
    font-family: var(--font, system-ui, sans-serif);
  }
  .psm-title { font-size: 18px; font-weight: 700; color: var(--t1, #0d3a35); margin-bottom: 6px; }
  .psm-sub   { font-size: 13px; color: #5a6b66; margin-bottom: 20px; line-height: 1.5; }
  .psm-label { font-size: 12px; font-weight: 600; color: var(--t2, #3a5a55); margin-bottom: 6px; display: block; }
  .psm-input {
    width: 100%; padding: 10px 12px; font-size: 14px;
    border: 1.5px solid var(--border-soft, #cdd0c9); border-radius: 10px;
    outline: none; font-family: inherit; color: var(--t1, #0d3a35);
    margin-bottom: 4px; background: var(--bg-card, #fff);
    transition: border-color .12s;
  }
  .psm-input:focus { border-color: var(--accent, #276152); }
  .psm-input.error { border-color: var(--danger, #c04040); }
  .psm-field { margin-bottom: 16px; }
  .psm-error { font-size: 11.5px; color: var(--danger, #c04040); margin-top: 4px; min-height: 14px; }
  .psm-hint  { font-size: 11px; color: var(--t3, #7a8a84); margin-top: 4px; }
  .psm-submit {
    width: 100%; padding: 11px; margin-top: 6px;
    background: var(--accent, #276152); border: none; border-radius: 10px;
    color: #fff; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: opacity .12s;
  }
  .psm-submit:disabled { opacity: .5; cursor: not-allowed; }
  .psm-submit:not(:disabled):hover { opacity: .88; }
`;

export default function ProfileSetupModal({ user, onComplete }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [username, setUsername]       = useState("");
  const [error, setError]             = useState("");
  const [saving, setSaving]           = useState(false);

  React.useEffect(() => {
    if (!document.getElementById("psm-style")) {
      const tag = document.createElement("style");
      tag.id = "psm-style";
      tag.textContent = STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  const formatError = username ? validateUsernameFormat(username) : null;

  const handleSubmit = async () => {
    if (saving) return;
    if (!displayName.trim()) {
      setError("Display name is required.");
      return;
    }
    const fmtErr = validateUsernameFormat(username);
    if (fmtErr) {
      setError(fmtErr);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const claimedUsername = await claimUsername(user.uid, username);
     await updateDoc(doc(db, "users", user.uid), {
        displayName: displayName.trim(),
        username: claimedUsername,
        usernameLower: claimedUsername.toLowerCase(),
        usernameSet: true,
      });
      onComplete({ displayName: displayName.trim(), username: claimedUsername });
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="psm-backdrop">
      <div className="psm-modal">
        <div className="psm-title">Set up your profile</div>
        <div className="psm-sub">Choose a display name and a unique username before you start chatting.</div>

        <div className="psm-field">
          <label className="psm-label">Display name</label>
          <input
            className="psm-input"
            placeholder="e.g. Ahmed"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={40}
          />
          <div className="psm-hint">Doesn't need to be unique — others can share this name.</div>
        </div>

        <div className="psm-field">
          <label className="psm-label">Username</label>
          <input
            className={`psm-input${formatError ? " error" : ""}`}
            placeholder="e.g. ahmed_ali.99"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={24}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <div className="psm-hint">Letters, numbers, and . , _ ! @ only. Must be unique.</div>
        </div>

        <div className="psm-error">{error}</div>

        <button className="psm-submit" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
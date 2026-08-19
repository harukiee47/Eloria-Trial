// src/components/ProfileSetupModal.jsx
import React, { useState } from "react";
import { db } from "../services/firebase";
import { doc, updateDoc } from "firebase/firestore";

const STYLE = `
  .psm-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.45); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: psmFadeIn .15s ease;
  }
  @keyframes psmFadeIn { from{opacity:0} to{opacity:1} }
  .psm-modal {
    background: var(--bg-card, #fdfaf6); border-radius: 20px;
    width: 380px; margin: 0 16px;
    padding: 36px 32px 28px;
    box-shadow: 0 24px 60px rgba(0,0,0,.22);
    font-family: var(--font, system-ui, sans-serif);
    animation: psmSlideUp .18s ease;
    text-align: center;
  }
  @keyframes psmSlideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  .psm-avatar {
    width: 56px; height: 56px; border-radius: 50%;
    background: var(--accent, #276152);
    display: flex; align-items: center; justify-content: center;
    color: #fff; font-size: 22px; font-weight: 700;
    margin: 0 auto 18px;
    text-transform: uppercase;
    transition: background .15s;
  }
  .psm-title { font-size: 19px; font-weight: 700; color: var(--t1, #0d3a35); margin-bottom: 6px; }
  .psm-sub   { font-size: 13px; color: var(--t3, #5a6b66); margin-bottom: 24px; line-height: 1.5; }
  .psm-field { margin-bottom: 8px; text-align: left; }
  .psm-input {
    width: 100%; padding: 13px 14px; font-size: 15px; text-align: center;
    border: 1.5px solid var(--border-soft, #cdd0c9); border-radius: 12px;
    outline: none; font-family: inherit; color: var(--t1, #0d3a35);
    background: var(--bg-card, #fff);
    transition: border-color .12s, box-shadow .12s;
    box-sizing: border-box;
  }
  .psm-input:focus { border-color: var(--accent, #276152); box-shadow: 0 0 0 3px var(--accent-soft, rgba(39,97,82,.12)); }
  .psm-input.error { border-color: var(--danger, #c04040); }
  .psm-error { font-size: 12px; color: var(--danger, #c04040); margin-top: 8px; min-height: 14px; }
  .psm-submit {
    width: 100%; padding: 13px; margin-top: 18px;
    background: var(--accent, #276152); border: none; border-radius: 12px;
    color: #fff; font-size: 14.5px; font-weight: 600;
    cursor: pointer; transition: opacity .12s, transform .08s;
  }
  .psm-submit:disabled { opacity: .5; cursor: not-allowed; }
  .psm-submit:not(:disabled):hover { opacity: .9; }
  .psm-submit:not(:disabled):active { transform: scale(.98); }
`;

export default function ProfileSetupModal({ user, onComplete }) {
  const [displayName, setDisplayName] = useState(user?.displayName || "");
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

  const initial = displayName.trim().charAt(0) || "?";

  const handleSubmit = async () => {
    if (saving) return;
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError("Display name is required.");
      return;
    }
    if (trimmed.length > 40) {
      setError("Display name must be 40 characters or fewer.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        displayName: trimmed,
        usernameSet: true,
      });
      onComplete({ displayName: trimmed });
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      setSaving(false);
    }
  };

  return (
    <div className="psm-backdrop">
      <div className="psm-modal">
        <div className="psm-avatar">{initial}</div>
        <div className="psm-title">Welcome to Eloria</div>
        <div className="psm-sub">What should we call you?</div>

        <div className="psm-field">
          <input
            className={`psm-input${error ? " error" : ""}`}
            placeholder="Your name"
            value={displayName}
            onChange={(e) => { setDisplayName(e.target.value); if (error) setError(""); }}
            maxLength={40}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          />
          <div className="psm-error">{error}</div>
        </div>

        <button className="psm-submit" onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import logo from "../assets/logo.png";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";

const STYLE = `
  .scv-backdrop {
    position: fixed; inset: 0; z-index: 900;
    background: rgba(13,58,53,.22);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 16px;
    animation: scvFadeIn .2s ease;
  }
  @keyframes scvFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .scv-modal {
    background: var(--bg-panel);
    border-radius: 20px;
    width: 560px; max-width: 100%;
    max-height: 85vh;
    display: flex; flex-direction: column;
    box-shadow: 0 32px 80px rgba(13,58,53,.2), 0 2px 8px rgba(0,0,0,.06);
    animation: scvSlideUp .22s ease;
    overflow: hidden;
  }
  @keyframes scvSlideUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .scv-header {
    padding: 20px 20px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    display: flex; align-items: flex-start; gap: 12px;
  }
  .scv-header-logo {
    width: 36px; height: 36px; border-radius: 10px; overflow: hidden;
    border: 1.5px solid rgba(193,127,42,.2); flex-shrink: 0;
  }
  .scv-header-logo img { width: 100%; height: 100%; object-fit: contain; }
  .scv-header-info { flex: 1; min-width: 0; }
  .scv-header-tag {
    font-size: 10px; font-weight: 600; letter-spacing: .1em;
    text-transform: uppercase; color: var(--accent); margin-bottom: 3px;
  }
  .scv-header-title {
    font-size: 16px; font-weight: 700; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.3;
  }
  .scv-header-meta { font-size: 12px; color: var(--t3); margin-top: 3px; }
  .scv-header-close {
    width: 28px; height: 28px; border: none; background: none;
    border-radius: 50%; cursor: pointer; color: var(--t3);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; flex-shrink: 0; transition: background .12s, color .12s;
  }
  .scv-header-close:hover { background: var(--bg-card, #f0f0ec); color: var(--t1); }

  .scv-messages {
    flex: 1; overflow-y: auto; padding: 16px 20px;
    display: flex; flex-direction: column; gap: 12px;
    scrollbar-width: thin; scrollbar-color: #e0e0da transparent;
  }
  .scv-messages::-webkit-scrollbar { width: 4px; }
  .scv-messages::-webkit-scrollbar-thumb { background: #ddddd8; border-radius: 2px; }

  .scv-msg { display: flex; gap: 8px; }
  .scv-msg.user { justify-content: flex-end; }
  .scv-msg.ai { justify-content: flex-start; align-items: flex-end; }

  .scv-avatar {
    width: 24px; height: 24px; border-radius: 7px; overflow: hidden;
    flex-shrink: 0; border: 1.5px solid rgba(193,127,42,.2); background: var(--bg-card, #faf8f4);
  }
  .scv-avatar img { width: 100%; height: 100%; object-fit: contain; }

  .scv-bubble {
    max-width: min(80%, 400px);
    padding: 9px 13px;
    font-size: 13.5px; line-height: 1.6;
    border-radius: 16px; word-break: break-word;
    font-family: var(--font);
  }
  .scv-msg.user .scv-bubble {
    background: var(--accent); color: #fff;
    border-bottom-right-radius: 4px;
  }
  .scv-msg.ai .scv-bubble {
    background: var(--bg-card, #fff); color: var(--t1);
    border: 1px solid #ececea; border-bottom-left-radius: 4px;
    box-shadow: 0 1px 4px rgba(0,0,0,.05);
  }

  .scv-project-section { margin-bottom: 8px; }
  .scv-project-tab {
    font-size: 11px; font-weight: 600; color: var(--t3);
    letter-spacing: .06em; text-transform: uppercase;
    padding: 6px 0 8px; border-bottom: 1px solid var(--border-soft); margin-bottom: 8px;
  }

  .scv-footer {
    padding: 14px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    display: flex; gap: 8px; align-items: center;
  }
  .scv-footer-note {
    flex: 1; font-size: 12px; color: var(--t3); line-height: 1.4;
  }
  .scv-btn-dismiss {
    padding: 9px 16px; background: none;
    border: 1px solid var(--border); border-radius: 10px;
    font-size: 13px; color: var(--t2); cursor: pointer;
    font-family: var(--font); transition: background .12s; white-space: nowrap;
  }
  .scv-btn-dismiss:hover { background: var(--bg-card, #f4f4f0); }
  .scv-btn-save {
    padding: 9px 18px;
    background: linear-gradient(135deg, var(--t1, #0d3a35), var(--accent, #1a5a52));
    border: none; border-radius: 10px;
    font-size: 13px; font-weight: 600; color: #fff;
    cursor: pointer; font-family: var(--font);
    transition: opacity .12s; white-space: nowrap;
  }
  .scv-btn-save:hover { opacity: .88; }
  .scv-btn-save:disabled { opacity: .5; cursor: default; }

  .scv-saved-note {
    font-size: 12px; color: var(--accent); font-weight: 500;
    text-align: center; padding: 4px 0;
  }

  .scv-empty {
    text-align: center; padding: 32px 16px;
    font-size: 13px; color: var(--t3); line-height: 1.7;
  }
`;

export default function SharedChatViewer({ sharedData, onDismiss, onSave, isLoggedIn }) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  if (!document.getElementById("eloria-scv")) {
    const tag = document.createElement("style");
    tag.id = "eloria-scv";
    tag.textContent = STYLE;
    document.head.appendChild(tag);
  }

  const isProject = sharedData.type === "project";
  const allMessages = isProject
    ? (sharedData.projectChats || []).flatMap(c => c.messages || [])
    : (sharedData.messages || []);

  async function handleSave() {
    if (!isLoggedIn) {
      alert("Please sign in to save this chat to your account.");
      return;
    }
    setSaving(true);
    try {
      await onSave(sharedData);
      setSaved(true);
    } catch (err) {
      console.error(err);
      alert("Failed to save. Please try again.");
    }
    setSaving(false);
  }

  const renderMessages = (messages) =>
    messages.map((msg, i) => (
      <div key={i} className={`scv-msg ${msg.sender}`}>
        {msg.sender === "ai" && (
          <div className="scv-avatar"><img src={logo} alt="Eloria" /></div>
        )}
        <div className="scv-bubble">
          {msg.sender === "ai"
            ? <MarkdownMessage content={msg.text || ""} />
            : (msg.text || "")
          }
        </div>
      </div>
    ));

  return (
    <div className="scv-backdrop" onClick={onDismiss}>
      <div className="scv-modal" onClick={e => e.stopPropagation()}>
        <div className="scv-header">
          <div className="scv-header-logo"><img src={logo} alt="Eloria" /></div>
          <div className="scv-header-info">
            <div className="scv-header-tag">
              {isProject ? "Shared Project" : "Shared Chat"} · Eloria AI
            </div>
            <div className="scv-header-title">{sharedData.title}</div>
            <div className="scv-header-meta">
              Shared by {sharedData.ownerName} · {allMessages.length} messages
            </div>
          </div>
          <button className="scv-header-close" onClick={onDismiss}>✕</button>
        </div>

        <div className="scv-messages">
          {isProject ? (
            (sharedData.projectChats || []).map((chat, ci) => (
              <div key={ci} className="scv-project-section">
                <div className="scv-project-tab">📁 {chat.title || `Chat ${ci + 1}`}</div>
                {renderMessages(chat.messages || [])}
              </div>
            ))
          ) : allMessages.length === 0 ? (
            <div className="scv-empty">This chat has no messages yet.</div>
          ) : (
            renderMessages(allMessages)
          )}
        </div>

        <div className="scv-footer">
          {saved ? (
            <div className="scv-saved-note" style={{ flex: 1, textAlign: "center" }}>
              ✓ Saved to your chats! Close this and find it in your sidebar.
            </div>
          ) : (
            <>
              <div className="scv-footer-note">
                {isLoggedIn
                  ? "Save this to your account to keep chatting from where it left off."
                  : "Sign in to Eloria to save this chat and continue the conversation."
                }
              </div>
              <button className="scv-btn-dismiss" onClick={onDismiss}>Dismiss</button>
              <button className="scv-btn-save" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save to my chats"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
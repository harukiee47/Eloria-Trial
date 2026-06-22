// src/components/NotificationsPanel.jsx
import React from "react";
import { acceptInvite } from "../services/groupService";
import { markRead, markAllRead } from "../services/notificationService";

const PANEL_STYLE = `
  .np-backdrop {
    position: fixed; inset: 0; z-index: 700;
    background: rgba(0,0,0,.15);
  }
  .np-panel {
    position: fixed; top: 0; right: 0;
    width: 340px; max-width: 92vw; height: 100vh;
    background: var(--bg-panel, #fdfaf6);
    border-left: 1px solid var(--border, #cdd0c9);
    box-shadow: -4px 0 24px rgba(0,0,0,.12);
    z-index: 701;
    display: flex; flex-direction: column;
    font-family: var(--font, system-ui, sans-serif);
  }
  .np-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 14px 10px; flex-shrink: 0;
  }
  .np-title { font-size: 15px; font-weight: 700; color: var(--t1, #0D3A35); }
  .np-close {
    width: 28px; height: 28px; border: none; background: none;
    border-radius: 8px; cursor: pointer; color: var(--t3, #7a8a84);
    display: flex; align-items: center; justify-content: center;
  }
  .np-close:hover { background: #f0f0ec; }
  .np-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
  .np-notif-list { flex: 1; overflow-y: auto; padding: 0 10px 16px; }
  .np-notif-item {
    display: flex; gap: 10px; padding: 10px 8px; border-radius: 10px;
    margin-bottom: 2px; align-items: flex-start;
  }
  .np-notif-item.unread { background: var(--accent-bg, #eaf2ef); }
  .np-notif-icon {
    width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center; font-size: 14px;
    background: #fff;
  }
  .np-notif-text { font-size: 12.5px; color: var(--t1, #0D3A35); line-height: 1.4; flex: 1; }
  .np-notif-text b { font-weight: 700; }
  .np-notif-time { font-size: 10.5px; color: var(--t3, #7a8a84); margin-top: 2px; }
  .np-notif-actions { display: flex; gap: 5px; margin-top: 6px; }
  .np-notif-btn {
    padding: 4px 9px; font-size: 11px; font-weight: 600;
    border: none; border-radius: 6px; cursor: pointer;
    font-family: var(--font, system-ui, sans-serif);
  }
  .np-notif-btn.accept { background: var(--accent, #276152); color: #fff; }
  .np-notif-btn.decline { background: #ece9e3; color: var(--t2, #3a5a55); }

  /* ── Bell button (strip + chat header) ── */
  .nb-bell-btn {
    width: 48px; height: 52px;
    border: none; background: none;
    border-radius: 10px;
    cursor: pointer;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 3px; color: var(--t2, #3a5a55);
    font-family: var(--font, system-ui, sans-serif);
    transition: background .14s, color .14s;
    position: relative;
  }
  .nb-bell-btn:hover { background: #e9e8e4; color: var(--t1, #0D3A35); }
  .nb-bell-btn.active { background: #e3e2de; color: var(--t1, #0D3A35); }
  .nb-bell-btn svg { width: 19px; height: 19px; flex-shrink: 0; }
  .nb-bell-label { font-size: 9px; font-weight: 500; letter-spacing: .02em; line-height: 1; }
  .nb-bell-badge {
    position: absolute; top: 4px; right: 6px;
    min-width: 16px; height: 16px; border-radius: 8px;
    background: #e05050; color: #fff;
    font-size: 9.5px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px; border: 1.5px solid var(--bg-strip, #ede8e1);
  }

  /* ── Floating badge (mobile fallback) ── */
  .nb-floating {
    position: fixed; bottom: 20px; right: 20px; z-index: 600;
    width: 48px; height: 48px; border-radius: 50%;
    background: var(--accent, #276152); color: #fff;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 8px 24px rgba(0,0,0,.2);
  }
  .nb-floating-badge {
    position: absolute; top: -4px; right: -4px;
    min-width: 20px; height: 20px; border-radius: 10px;
    background: #e05050; color: #fff;
    font-size: 10px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; padding: 0 5px;
    border: 2px solid var(--bg-app, #f5f0ea);
  }
  @media(min-width: 641px) {
    .nb-floating { display: none; }
  }
`;

if (typeof document !== "undefined" && !document.getElementById("notif-panel-style")) {
  const tag = document.createElement("style");
  tag.id = "notif-panel-style";
  tag.textContent = PANEL_STYLE;
  document.head.appendChild(tag);
}

const BellIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 01-3.46 0" />
  </svg>
);

export function BellButton({ count, active, onClick }) {
  return (
    <button className={`nb-bell-btn${active ? " active" : ""}`} onClick={onClick} title="Inbox">
      <BellIcon />
      <span className="nb-bell-label">Inbox</span>
      {count > 0 && <span className="nb-bell-badge">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}

export function FloatingBadge({ count, onClick }) {
  return (
    <button className="nb-floating" onClick={onClick} title="Inbox">
      <BellIcon />
      {count > 0 && <span className="nb-floating-badge">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}

function timeAgo(ts) {
  if (!ts) return "";
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export default function NotificationsPanel({
  user, notifications = [], groupInvites = [],
  onClose, onGroupAccepted,
}) {
  const handleOpenPanel = () => {
    markAllRead(notifications.map(n => n.id)).catch(() => {});
  };

  const handleAcceptInvite = async (invite) => {
    try {
      const groupId = await acceptInvite(invite.id, user);
      onGroupAccepted(groupId);
    } catch (err) {
      console.error(err);
    }
  };

  const renderNotifText = (n) => {
    if (n.type === "mention") {
      return <>@<b>{n.fromUsername}</b> mentioned you in <b>{n.groupName}</b></>;
    }
    return "New notification";
  };

  const renderNotifIcon = (n) => {
    if (n.type === "mention") return "💬";
    return "🔔";
  };

  return (
    <>
      <div className="np-backdrop" onClick={onClose} />
      <div className="np-panel" onClick={handleOpenPanel}>
        <div className="np-hdr">
          <span className="np-title">Inbox</span>
          <button className="np-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="np-body">
          <div className="np-notif-list">
            {groupInvites.map(invite => (
              <div key={invite.id} className="np-notif-item unread">
                <div className="np-notif-icon">👥</div>
                <div className="np-notif-text">
                  <div>You were invited to join <b>{invite.groupName}</b></div>
                  <div className="np-notif-time">{timeAgo(invite.createdAt)} ago</div>
                  <div className="np-notif-actions">
                    <button className="np-notif-btn accept" onClick={() => handleAcceptInvite(invite)}>Accept</button>
                  </div>
                </div>
              </div>
            ))}

            {notifications.map(n => (
              <div key={n.id} className={`np-notif-item${n.read ? "" : " unread"}`} onClick={() => markRead(n.id)}>
                <div className="np-notif-icon">{renderNotifIcon(n)}</div>
                <div className="np-notif-text">
                  <div>{renderNotifText(n)}</div>
                  <div className="np-notif-time">{timeAgo(n.createdAt)} ago</div>
                </div>
              </div>
            ))}

            {groupInvites.length === 0 && notifications.length === 0 && (
              <p style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", padding: "28px 12px", lineHeight: 1.6 }}>
                No notifications yet.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

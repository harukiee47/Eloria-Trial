import React, { useState, useEffect } from "react";
import { subscribeToInvites, acceptInvite, declineInvite } from "../services/groupService";

const NOTIF_STYLE = `
  .gn-backdrop {
    position: fixed; inset: 0; z-index: 700;
    background: rgba(0,0,0,.28); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: fadeIn .15s ease;
  }
  .gn-panel {
    background: var(--bg-panel); border-radius: var(--r-lg);
    width: 340px; max-height: 70vh; overflow-y: auto;
    margin: 0 16px; box-shadow: 0 24px 60px rgba(13,58,53,.18);
    animation: slideUp .17s ease;
  }
  .gn-hdr {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 18px 12px; border-bottom: 1px solid var(--border);
    position: sticky; top: 0; background: var(--bg-panel); z-index: 1;
  }
  .gn-hdr h3 { font-size: 15px; font-weight: 600; color: var(--t1); margin: 0; }
  .gn-hdr-close {
    background: none; border: none; cursor: pointer; color: var(--t3);
    width: 28px; height: 28px; border-radius: 6px;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s; font-size: 14px;
  }
  .gn-hdr-close:hover { background: var(--bg-card, #f0f0ec); color: var(--t1); }

  .gn-invite {
    display: flex; flex-direction: column; gap: 10px;
    padding: 14px 18px; border-bottom: 1px solid var(--border-soft);
  }
  .gn-invite-top { display: flex; align-items: center; gap: 10px; }
  .gn-invite-icon {
    width: 38px; height: 38px; border-radius: 11px;
    background: linear-gradient(135deg, var(--accent), var(--accent, #1a5a52));
    color: #fff; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .gn-invite-info { flex: 1; }
  .gn-invite-title { font-size: 13px; font-weight: 600; color: var(--t1); line-height: 1.3; }
  .gn-invite-sub { font-size: 12px; color: var(--t3); margin-top: 2px; }
  .gn-invite-actions { display: flex; gap: 8px; }
  .gn-accept {
    flex: 1; padding: 8px; background: var(--accent);
    border: none; border-radius: var(--r-sm); color: #fff;
    font-size: 13px; font-weight: 500; cursor: pointer;
    font-family: var(--font); transition: opacity .12s;
  }
  .gn-accept:hover { opacity: .87; }
  .gn-accept:disabled { opacity: .5; cursor: not-allowed; }
  .gn-decline {
    padding: 8px 14px; background: none;
    border: 1px solid var(--border); border-radius: var(--r-sm);
    color: var(--t2); font-size: 13px; cursor: pointer;
    font-family: var(--font); transition: background .12s;
  }
  .gn-decline:hover { background: var(--bg-card, #f4f4f0); }

  .gn-empty {
    padding: 32px 18px; text-align: center;
    font-size: 13px; color: var(--t3); line-height: 1.6;
  }
`;

export default function GroupNotifications({ user, onAccepted, onClose }) {
  const [invites, setInvites] = useState([]);
  const [processing, setProcessing] = useState({});

  useEffect(() => {
    if (!document.getElementById("gn-style")) {
      const tag = document.createElement("style");
      tag.id = "gn-style";
      tag.textContent = NOTIF_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    const unsub = subscribeToInvites(user.email, setInvites);
    return () => unsub();
  }, [user?.email]);

  const handleAccept = async (invite) => {
    setProcessing(p => ({ ...p, [invite.id]: "accepting" }));
    try {
      const groupId = await acceptInvite(invite.id, user);
      onAccepted(groupId);
    } catch (err) {
      alert(err.message);
    } finally {
      setProcessing(p => ({ ...p, [invite.id]: null }));
    }
  };

  const handleDecline = async (invite) => {
    setProcessing(p => ({ ...p, [invite.id]: "declining" }));
    try {
      await declineInvite(invite.id, user.email);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(p => ({ ...p, [invite.id]: null }));
    }
  };

  return (
    <div className="gn-backdrop" onClick={onClose}>
      <div className="gn-panel" onClick={e => e.stopPropagation()}>
        <div className="gn-hdr">
          <h3>Group Invites</h3>
          <button className="gn-hdr-close" onClick={onClose}>✕</button>
        </div>

        {invites.length === 0 ? (
          <div className="gn-empty">No pending group invites.</div>
        ) : (
          invites.map(invite => (
            <div key={invite.id} className="gn-invite">
              <div className="gn-invite-top">
                <div className="gn-invite-icon">
                  {invite.groupName?.[0]?.toUpperCase() || "G"}
                </div>
                <div className="gn-invite-info">
                  <div className="gn-invite-title">{invite.groupName}</div>
                  <div className="gn-invite-sub">
                    Invited by {invite.inviterName}
                  </div>
                </div>
              </div>
              <div className="gn-invite-actions">
                <button
                  className="gn-accept"
                  onClick={() => handleAccept(invite)}
                  disabled={!!processing[invite.id]}
                >
                  {processing[invite.id] === "accepting" ? "Joining…" : "Accept"}
                </button>
                <button
                  className="gn-decline"
                  onClick={() => handleDecline(invite)}
                  disabled={!!processing[invite.id]}
                >
                  {processing[invite.id] === "declining" ? "…" : "Decline"}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
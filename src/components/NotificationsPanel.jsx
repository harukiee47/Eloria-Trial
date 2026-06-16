import React, { useState, useEffect, useRef } from "react";
import {
  acceptFriendRequest, declineFriendRequest,
  sendFriendRequest, markNotificationRead,
  subscribeToUsers, formatLastSeen,
} from "../services/userService";
import { acceptInvite, declineInvite } from "../services/groupService";

const PANEL_STYLE = `
  /* ── BELL BUTTON (strip) ──────────────────────────────── */
  .notif-bell-btn {
    width: 48px; height: 52px;
    border: none; background: none;
    border-radius: var(--r-md);
    cursor: pointer;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    gap: 3px; color: var(--t2);
    font-family: var(--font);
    transition: background .14s, color .14s;
    position: relative;
  }
  .notif-bell-btn:hover  { background: #e9e8e4; color: var(--t1); }
  .notif-bell-btn.active { background: #e3e2de; color: var(--t1); }
  .notif-bell-btn svg    { width: 19px; height: 19px; flex-shrink: 0; }
  .notif-bell-btn span   { font-size: 9px; font-weight: 500; letter-spacing:.02em; line-height:1; }

  /* ── FLOATING BADGE (bottom-right, always visible) ────── */
  .notif-floating-badge {
    position: fixed;
    bottom: 28px;
    right: 28px;
    width: 54px;
    height: 54px;
    border-radius: 50%;
    background: linear-gradient(135deg, #0d3a35, #1a5a52);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 6px 24px rgba(13,58,53,.32), 0 2px 8px rgba(0,0,0,.12);
    z-index: 400;
    transition: transform .15s, box-shadow .15s;
    font-family: var(--font);
  }
  .notif-floating-badge:hover {
    transform: scale(1.08);
    box-shadow: 0 8px 32px rgba(13,58,53,.4), 0 2px 8px rgba(0,0,0,.16);
  }
  .notif-floating-badge svg { width: 22px; height: 22px; color: #fff; flex-shrink: 0; }

  /* ── BADGE COUNT ─────────────────────────────────────── */
  .notif-count-dot {
    position: absolute;
    top: 6px; right: 6px;
    min-width: 18px; height: 18px;
    border-radius: 9px;
    background: #e04040;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    font-family: var(--font);
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px;
    border: 2px solid var(--bg-strip);
    line-height: 1;
  }
  .notif-floating-badge .notif-count-dot {
    top: 2px; right: 2px;
    border-color: transparent;
    box-shadow: 0 2px 6px rgba(0,0,0,.2);
  }

  /* ── PANEL BACKDROP ──────────────────────────────────── */
  .notif-panel-backdrop {
    position: fixed; inset: 0;
    z-index: 490;
    background: rgba(0,0,0,.15);
    backdrop-filter: blur(2px);
    animation: notifFadeIn .15s ease;
  }
  @keyframes notifFadeIn { from{opacity:0} to{opacity:1} }

  /* ── PANEL ────────────────────────────────────────────── */
  .notif-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    height: 100vh;
    background: var(--bg-panel);
    border-left: 1px solid var(--border);
    box-shadow: -8px 0 40px rgba(13,58,53,.12);
    z-index: 495;
    display: flex;
    flex-direction: column;
    animation: notifSlideIn .2s cubic-bezier(.4,0,.2,1);
    font-family: var(--font);
  }
  @keyframes notifSlideIn {
    from { opacity:0; transform: translateX(24px); }
    to   { opacity:1; transform: translateX(0); }
  }
  @media(max-width: 640px) {
    .notif-panel {
      width: 100vw;
      border-left: none;
      animation: notifSlideUp .22s cubic-bezier(.4,0,.2,1);
    }
    @keyframes notifSlideUp {
      from { opacity:0; transform: translateY(20px); }
      to   { opacity:1; transform: translateY(0); }
    }
  }

  /* ── PANEL HEADER ─────────────────────────────────────── */
  .notif-panel-hdr {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 18px 0;
    flex-shrink: 0;
  }
  .notif-panel-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--t1);
    letter-spacing: -.02em;
  }
  .notif-panel-close {
    width: 30px; height: 30px;
    background: none; border: none;
    border-radius: var(--r-sm);
    cursor: pointer; color: var(--t3);
    display: flex; align-items: center; justify-content: center;
    transition: background .12s, color .12s;
  }
  .notif-panel-close:hover { background: #f0f0ec; color: var(--t1); }
  .notif-panel-close svg { width: 15px; height: 15px; }

  /* ── TABS ─────────────────────────────────────────────── */
  .notif-tabs {
    display: flex;
    gap: 0;
    padding: 14px 18px 0;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
  }
  .notif-tab {
    padding: 8px 14px 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--t3);
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    font-family: var(--font);
    transition: color .12s, border-color .12s;
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: -1px;
  }
  .notif-tab.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
    font-weight: 600;
  }
  .notif-tab-badge {
    min-width: 18px; height: 18px;
    border-radius: 9px;
    background: #e04040;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    padding: 0 4px;
    line-height: 1;
  }

  /* ── SCROLL BODY ──────────────────────────────────────── */
  .notif-panel-body {
    flex: 1;
    overflow-y: auto;
    padding: 12px 0 20px;
    scrollbar-width: thin;
    scrollbar-color: #e0e0da transparent;
  }
  .notif-panel-body::-webkit-scrollbar { width: 4px; }
  .notif-panel-body::-webkit-scrollbar-thumb { background: #ddddd8; border-radius: 2px; }

  /* ── EMPTY STATE ──────────────────────────────────────── */
  .notif-empty {
    text-align: center;
    padding: 48px 24px;
    color: var(--t3);
  }
  .notif-empty-icon { font-size: 32px; margin-bottom: 10px; display: block; }
  .notif-empty-title {
    font-size: 14px; font-weight: 600; color: var(--t2); margin-bottom: 6px;
  }
  .notif-empty p { font-size: 13px; line-height: 1.6; }

  /* ── SECTION LABEL ────────────────────────────────────── */
  .notif-section-label {
    font-size: 10px; font-weight: 700; color: var(--t3);
    text-transform: uppercase; letter-spacing: .07em;
    padding: 8px 18px 6px;
  }

  /* ── NOTIFICATION ITEM ────────────────────────────────── */
  .notif-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 18px;
    transition: background .12s;
    position: relative;
  }
  .notif-item:hover { background: #f7f6f3; }
  .notif-item.unread::before {
    content: "";
    position: absolute;
    left: 6px; top: 50%; transform: translateY(-50%);
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--accent);
  }

  .notif-av {
    width: 38px; height: 38px;
    border-radius: 11px;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 700; color: #fff;
    flex-shrink: 0;
  }
  .notif-av.invite  { background: linear-gradient(135deg, #276152, #1a5a42); }
  .notif-av.mention { background: linear-gradient(135deg, #4a72e8, #2a52c8); }
  .notif-av.friend  { background: linear-gradient(135deg, #e8a020, #c07820); }

  .notif-body { flex: 1; min-width: 0; }
  .notif-body-title {
    font-size: 13px; font-weight: 600; color: var(--t1);
    line-height: 1.35; margin-bottom: 2px;
  }
  .notif-body-sub {
    font-size: 12px; color: var(--t2); line-height: 1.5;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .notif-body-time { font-size: 11px; color: var(--t3); margin-top: 3px; }

  .notif-actions {
    display: flex; gap: 6px; margin-top: 8px;
  }
  .notif-btn-accept {
    padding: 5px 14px;
    background: var(--accent); border: none;
    border-radius: 8px; color: #fff;
    font-size: 12px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    transition: opacity .12s;
  }
  .notif-btn-accept:hover { opacity: .85; }
  .notif-btn-decline {
    padding: 5px 12px;
    background: none; border: 1px solid var(--border);
    border-radius: 8px; color: var(--t2);
    font-size: 12px; font-weight: 500;
    cursor: pointer; font-family: var(--font);
    transition: background .12s;
  }
  .notif-btn-decline:hover { background: #f0f0ec; }

  /* ── DIVIDER ─────────────────────────────────────────── */
  .notif-divider { height: 1px; background: var(--border-soft); margin: 4px 0; }

  /* ── FRIENDS SECTION ─────────────────────────────────── */
  .friend-add-row {
    display: flex;
    gap: 8px;
    padding: 12px 18px 8px;
    flex-shrink: 0;
  }
  .friend-add-input {
    flex: 1;
    padding: 8px 12px;
    border: 1.5px solid var(--border);
    border-radius: var(--r-md);
    font-size: 13px;
    font-family: var(--font);
    color: var(--t1);
    outline: none;
    background: #fff;
    transition: border-color .13s;
  }
  .friend-add-input:focus { border-color: var(--accent); }
  .friend-add-input::placeholder { color: var(--t3); }
  .friend-add-btn {
    padding: 8px 16px;
    background: var(--accent); border: none;
    border-radius: var(--r-md); color: #fff;
    font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    white-space: nowrap; transition: opacity .12s;
    flex-shrink: 0;
  }
  .friend-add-btn:hover { opacity: .87; }
  .friend-add-btn:disabled { opacity: .45; cursor: not-allowed; }

  .friend-add-feedback {
    font-size: 12px; padding: 0 18px 8px; line-height: 1.5;
  }
  .friend-add-feedback.ok  { color: #2a7a52; }
  .friend-add-feedback.err { color: var(--danger); }

  /* ── FRIEND ROW ──────────────────────────────────────── */
  .friend-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    transition: background .12s;
  }
  .friend-row:hover { background: #f7f6f3; }

  .friend-av {
    width: 38px; height: 38px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6a9a94, #3a7a6a);
    color: #fff; font-size: 15px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; position: relative;
  }

  /* Online dot */
  .friend-online-dot {
    position: absolute;
    bottom: 1px; right: 1px;
    width: 11px; height: 11px;
    border-radius: 50%;
    border: 2px solid var(--bg-panel);
  }
  .friend-online-dot.online  { background: #2ecc71; }
  .friend-online-dot.offline { background: #aaa; }

  .friend-info { flex: 1; min-width: 0; }
  .friend-name {
    font-size: 13px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    line-height: 1.3;
  }
  .friend-status {
    font-size: 11px; margin-top: 2px; line-height: 1.3;
  }
  .friend-status.online  { color: #2ecc71; }
  .friend-status.offline { color: var(--t3); }

  /* ── PENDING REQUEST ROW ─────────────────────────────── */
  .pending-req-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 18px;
    transition: background .12s;
  }
  .pending-req-row:hover { background: #f7f6f3; }
  .pending-req-info { flex: 1; min-width: 0; }
  .pending-req-name { font-size: 13px; font-weight: 600; color: var(--t1); }
  .pending-req-email { font-size: 11px; color: var(--t3); margin-top: 1px; }
  .pending-req-actions { display: flex; gap: 5px; }
  .pending-req-accept {
    padding: 4px 12px;
    background: var(--accent); border: none;
    border-radius: 7px; color: #fff;
    font-size: 11px; font-weight: 600;
    cursor: pointer; font-family: var(--font);
    transition: opacity .12s;
  }
  .pending-req-accept:hover { opacity: .85; }
  .pending-req-decline {
    padding: 4px 10px;
    background: none; border: 1px solid var(--border);
    border-radius: 7px; color: var(--t3);
    font-size: 11px;
    cursor: pointer; font-family: var(--font);
    transition: background .12s;
  }
  .pending-req-decline:hover { background: #f0f0ec; color: var(--t1); }
`;

export default function NotificationsPanel({
  user,
  myProfile,
  notifications = [],     // from subscribeToNotifications
  groupInvites  = [],     // from subscribeToInvites (existing)
  onClose,
  onGroupAccepted,
}) {
  const [tab, setTab]               = useState("notifications");
  const [friendEmail, setFriendEmail] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [friendFeedback, setFriendFeedback] = useState(null);
  const [friendProfiles, setFriendProfiles] = useState([]);
  const [pendingProfiles, setPendingProfiles] = useState([]);

  // Inject styles once
  useEffect(() => {
    if (!document.getElementById("notif-panel-style")) {
      const tag = document.createElement("style");
      tag.id = "notif-panel-style";
      tag.textContent = PANEL_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  // Subscribe to friend profiles
  useEffect(() => {
    if (!myProfile?.friends?.length) { setFriendProfiles([]); return; }
    const unsub = subscribeToUsers(myProfile.friends, setFriendProfiles);
    return () => unsub();
  }, [myProfile?.friends]);

  // Load pending request profiles
  useEffect(() => {
    if (!myProfile?.pendingFriendRequests?.length) { setPendingProfiles([]); return; }
    const unsub = subscribeToUsers(myProfile.pendingFriendRequests, setPendingProfiles);
    return () => unsub();
  }, [myProfile?.pendingFriendRequests]);

  const totalNotifCount =
    notifications.length +
    groupInvites.length;

  const friendRequestNotifs = notifications.filter(n => n.type === "friend_request");
  const mentionNotifs       = notifications.filter(n => n.type === "mention");

  const handleAddFriend = async () => {
    if (!friendEmail.trim() || addingFriend) return;
    setAddingFriend(true);
    setFriendFeedback(null);
    try {
      const result = await sendFriendRequest(user.uid, friendEmail.trim());
      setFriendFeedback({
        ok: true,
        msg: result.autoAccepted
          ? "You're now friends! (they had already sent you a request)"
          : `Friend request sent to ${friendEmail.trim()}`,
      });
      setFriendEmail("");
    } catch (err) {
      setFriendFeedback({ ok: false, msg: err.message });
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptFriend = async (fromUid) => {
    try {
      await acceptFriendRequest(user.uid, fromUid);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineFriend = async (fromUid) => {
    try {
      await declineFriendRequest(user.uid, fromUid);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAcceptInvite = async (invite) => {
    try {
      const groupId = await acceptInvite(invite.id, user);
      await markNotificationRead(invite.id).catch(() => {});
      onGroupAccepted(groupId);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeclineInvite = async (invite) => {
    try {
      const { declineInvite: di } = await import("../services/groupService");
      await di(invite.id, user.email);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkRead = async (notifId) => {
    try { await markNotificationRead(notifId); } catch {}
  };

  function formatNotifTime(ts) {
    if (!ts) return "";
    const d = ts?.toDate ? ts.toDate() : new Date(ts);
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60)   return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  const notifTabCount = groupInvites.length + mentionNotifs.length + friendRequestNotifs.length;
  const friendTabCount = (myProfile?.pendingFriendRequests?.length || 0);

  return (
    <>
      <div className="notif-panel-backdrop" onClick={onClose} />
      <div className="notif-panel">
        {/* Header */}
        <div className="notif-panel-hdr">
          <div className="notif-panel-title">Inbox</div>
          <button className="notif-panel-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="notif-tabs">
          <button
            className={`notif-tab${tab === "notifications" ? " active" : ""}`}
            onClick={() => setTab("notifications")}
          >
            Notifications
            {notifTabCount > 0 && (
              <span className="notif-tab-badge">{notifTabCount > 99 ? "99+" : notifTabCount}</span>
            )}
          </button>
          <button
            className={`notif-tab${tab === "friends" ? " active" : ""}`}
            onClick={() => setTab("friends")}
          >
            Friends
            {friendTabCount > 0 && (
              <span className="notif-tab-badge">{friendTabCount}</span>
            )}
          </button>
        </div>

        {/* Body */}
        <div className="notif-panel-body">

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === "notifications" && (
            <>
              {groupInvites.length === 0 && mentionNotifs.length === 0 && friendRequestNotifs.length === 0 ? (
                <div className="notif-empty">
                  <span className="notif-empty-icon">🔔</span>
                  <div className="notif-empty-title">All caught up</div>
                  <p>Group invites, mentions, and friend requests will appear here.</p>
                </div>
              ) : (
                <>
                  {/* Group invites */}
                  {groupInvites.length > 0 && (
                    <>
                      <div className="notif-section-label">Group Invites</div>
                      {groupInvites.map(invite => (
                        <div key={invite.id} className="notif-item unread">
                          <div className="notif-av invite">
                            {invite.groupName?.[0]?.toUpperCase() || "G"}
                          </div>
                          <div className="notif-body">
                            <div className="notif-body-title">
                              Invite to <strong>{invite.groupName}</strong>
                            </div>
                            <div className="notif-body-sub">
                              From {invite.inviterName}
                            </div>
                            <div className="notif-actions">
                              <button className="notif-btn-accept" onClick={() => handleAcceptInvite(invite)}>
                                Accept
                              </button>
                              <button className="notif-btn-decline" onClick={() => handleDeclineInvite(invite)}>
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(mentionNotifs.length > 0 || friendRequestNotifs.length > 0) && (
                        <div className="notif-divider" />
                      )}
                    </>
                  )}

                  {/* Mentions */}
                  {mentionNotifs.length > 0 && (
                    <>
                      <div className="notif-section-label">Mentions</div>
                      {mentionNotifs.map(n => (
                        <div key={n.id} className="notif-item unread">
                          <div className="notif-av mention">@</div>
                          <div className="notif-body">
                            <div className="notif-body-title">
                              <strong>@{n.fromUsername}</strong> mentioned you in <strong>{n.groupName}</strong>
                            </div>
                            <div className="notif-body-sub">"{n.messageText}"</div>
                            <div className="notif-body-time">{formatNotifTime(n.createdAt)}</div>
                          </div>
                          <button
                            onClick={() => handleMarkRead(n.id)}
                            style={{ background: "none", border: "none", color: "var(--t3)", cursor: "pointer", fontSize: 11, flexShrink: 0, padding: 4 }}
                            title="Mark as read"
                          >
                            ✓
                          </button>
                        </div>
                      ))}
                      {friendRequestNotifs.length > 0 && <div className="notif-divider" />}
                    </>
                  )}

                  {/* Friend requests (in-notification-tab as well) */}
                  {friendRequestNotifs.length > 0 && (
                    <>
                      <div className="notif-section-label">Friend Requests</div>
                      {friendRequestNotifs.map(n => (
                        <div key={n.id} className="notif-item unread">
                          <div className="notif-av friend">
                            {n.fromUsername?.[0]?.toUpperCase() || "?"}
                          </div>
                          <div className="notif-body">
                            <div className="notif-body-title">
                              <strong>{n.fromUsername}</strong> sent you a friend request
                            </div>
                            <div className="notif-body-sub">{n.fromEmail}</div>
                            <div className="notif-body-time">{formatNotifTime(n.createdAt)}</div>
                            <div className="notif-actions">
                              <button className="notif-btn-accept" onClick={() => handleAcceptFriend(n.fromUid)}>
                                Accept
                              </button>
                              <button className="notif-btn-decline" onClick={() => handleDeclineFriend(n.fromUid)}>
                                Decline
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              )}
            </>
          )}

          {/* ── FRIENDS TAB ── */}
          {tab === "friends" && (
            <>
              {/* Add friend input */}
              <div className="friend-add-row">
                <input
                  className="friend-add-input"
                  type="email"
                  placeholder="Add by email address…"
                  value={friendEmail}
                  onChange={e => setFriendEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddFriend()}
                />
                <button
                  className="friend-add-btn"
                  onClick={handleAddFriend}
                  disabled={!friendEmail.trim() || addingFriend}
                >
                  {addingFriend ? "…" : "Add"}
                </button>
              </div>
              {friendFeedback && (
                <div className={`friend-add-feedback ${friendFeedback.ok ? "ok" : "err"}`}>
                  {friendFeedback.msg}
                </div>
              )}

              {/* Pending incoming requests */}
              {(myProfile?.pendingFriendRequests?.length > 0) && (
                <>
                  <div className="notif-section-label">Pending Requests</div>
                  {pendingProfiles.map(p => (
                    <div key={p.uid} className="pending-req-row">
                      <div className="friend-av" style={{ position: "relative" }}>
                        {p.username?.[0]?.toUpperCase() || "?"}
                      </div>
                      <div className="pending-req-info">
                        <div className="pending-req-name">{p.username}</div>
                        <div className="pending-req-email">{p.email}</div>
                      </div>
                      <div className="pending-req-actions">
                        <button className="pending-req-accept" onClick={() => handleAcceptFriend(p.uid)}>
                          Accept
                        </button>
                        <button className="pending-req-decline" onClick={() => handleDeclineFriend(p.uid)}>
                          Decline
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="notif-divider" />
                </>
              )}

              {/* Sent requests */}
              {(myProfile?.sentFriendRequests?.length > 0) && (
                <>
                  <div className="notif-section-label">Sent Requests</div>
                  {myProfile.sentFriendRequests.map(uid => (
                    <div key={uid} className="friend-row" style={{ opacity: .6 }}>
                      <div className="friend-av">?</div>
                      <div className="friend-info">
                        <div className="friend-name" style={{ fontSize: 12, color: "var(--t3)" }}>
                          Request pending
                        </div>
                      </div>
                    </div>
                  ))}
                  <div className="notif-divider" />
                </>
              )}

              {/* Friends list */}
              {friendProfiles.length > 0 ? (
                <>
                  <div className="notif-section-label">
                    Friends · {friendProfiles.length}
                  </div>
                  {friendProfiles
                    .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
                    .map(friend => (
                      <div key={friend.uid} className="friend-row">
                        <div className="friend-av">
                          {friend.username?.[0]?.toUpperCase() || "?"}
                          <span className={`friend-online-dot ${friend.online ? "online" : "offline"}`} />
                        </div>
                        <div className="friend-info">
                          <div className="friend-name">{friend.username}</div>
                          <div className={`friend-status ${friend.online ? "online" : "offline"}`}>
                            {friend.online ? "Online now" : `Last seen ${formatLastSeen(friend.lastSeen)}`}
                          </div>
                        </div>
                      </div>
                    ))}
                </>
              ) : (
                myProfile?.pendingFriendRequests?.length === 0 &&
                myProfile?.sentFriendRequests?.length === 0 && (
                  <div className="notif-empty">
                    <span className="notif-empty-icon">👥</span>
                    <div className="notif-empty-title">No friends yet</div>
                    <p>Add friends by email above. They'll see your request in their inbox.</p>
                  </div>
                )
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ── Bell button for the sidebar strip ───────────────────────────────────────
export function BellButton({ count, active, onClick }) {
  return (
    <button
      className={`notif-bell-btn${active ? " active" : ""}`}
      onClick={onClick}
      title="Notifications & Friends"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      <span>Inbox</span>
      {count > 0 && (
        <span className="notif-count-dot">{count > 99 ? "99+" : count}</span>
      )}
    </button>
  );
}

// ── Floating badge button (bottom-right of screen) ──────────────────────────
export function FloatingBadge({ count, onClick }) {
  return (
    <button className="notif-floating-badge" onClick={onClick} title="Open Inbox">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      {count > 0 && (
        <span className="notif-count-dot">{count > 99 ? "99+" : count}</span>
      )}
    </button>
  );
}
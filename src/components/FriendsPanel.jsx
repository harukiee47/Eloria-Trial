// src/components/FriendsPanel.jsx
import React, { useState } from "react";
import {
  searchUsersByUsername, sendFriendRequest, acceptFriendRequest,
  declineFriendRequest, removeFriend, cancelSentRequest, formatLastSeen,
} from "../services/friendService";

export default function FriendsPanel({ user, friendsData, onOpenDM }) {
  const [tab, setTab] = useState("friends"); // friends | received | sent | search
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [actionError, setActionError] = useState("");

  const { friends = [], received = [], sent = [] } = friendsData || {};

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setActionError("");
    try {
      const results = await searchUsersByUsername(searchTerm, user.uid);
      setSearchResults(results);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = async (target) => {
    try {
      await sendFriendRequest(user.uid, user.username, target.uid);
      setSearchResults(prev => prev.map(r => r.uid === target.uid ? { ...r, _requested: true } : r));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const isAlreadyFriend = (uid) => friends.some(f => f.uid === uid);
  const isAlreadySent = (uid) => sent.some(s => s.uid === uid);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", gap: 6, padding: "0 12px 10px" }}>
        {["friends", "received", "sent", "search"].map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setActionError(""); }}
            style={{
              flex: 1, padding: "6px 4px", fontSize: 11.5, fontWeight: 600,
              border: "none", borderRadius: 8, cursor: "pointer",
              background: tab === t ? "var(--accent-bg)" : "transparent",
              color: tab === t ? "var(--accent)" : "var(--t3)",
              fontFamily: "var(--font)", textTransform: "capitalize",
            }}
          >
            {t === "received" ? `Requests${received.length ? ` (${received.length})` : ""}` : t}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <div style={{ padding: "0 12px 8px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              placeholder="Search by username…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
              style={{
                flex: 1, padding: "8px 10px", fontSize: 13, borderRadius: 8,
                border: "1px solid var(--border)", outline: "none", fontFamily: "var(--font)",
              }}
            />
            <button
              onClick={handleSearch}
              disabled={searching}
              style={{
                padding: "8px 14px", borderRadius: 8, border: "none",
                background: "var(--accent)", color: "#fff", fontSize: 12.5,
                fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
              }}
            >
              {searching ? "…" : "Search"}
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <div style={{ padding: "0 12px 8px", fontSize: 12, color: "var(--danger)" }}>{actionError}</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 16px" }}>
        {tab === "search" && searchResults.map(r => (
          <UserRow key={r.uid} u={r}>
            {isAlreadyFriend(r.uid) ? (
              <Tag>Friends</Tag>
            ) : isAlreadySent(r.uid) || r._requested ? (
              <Tag>Requested</Tag>
            ) : (
              <SmallBtn onClick={() => handleAdd(r)}>Add Friend</SmallBtn>
            )}
          </UserRow>
        ))}
        {tab === "search" && searchTerm && searchResults.length === 0 && !searching && (
          <Empty>No users found with that username.</Empty>
        )}

        {tab === "friends" && friends.length === 0 && <Empty>No friends yet — search by username to add some.</Empty>}
        {tab === "friends" && friends.map(f => (
          <UserRow key={f.uid} u={f}>
            <SmallBtn onClick={() => onOpenDM(f)}>Message</SmallBtn>
            <SmallBtn danger onClick={() => removeFriend(user.uid, f.uid)}>Remove</SmallBtn>
          </UserRow>
        ))}

        {tab === "received" && received.length === 0 && <Empty>No incoming friend requests.</Empty>}
        {tab === "received" && received.map(r => (
          <UserRow key={r.uid} u={r}>
            <SmallBtn onClick={() => acceptFriendRequest(user.uid, user.username, r.uid)}>Accept</SmallBtn>
            <SmallBtn danger onClick={() => declineFriendRequest(user.uid, r.uid)}>Decline</SmallBtn>
          </UserRow>
        ))}

        {tab === "sent" && sent.length === 0 && <Empty>No pending sent requests.</Empty>}
        {tab === "sent" && sent.map(s => (
          <UserRow key={s.uid} u={s}>
            <SmallBtn danger onClick={() => cancelSentRequest(user.uid, s.uid)}>Cancel</SmallBtn>
          </UserRow>
        ))}
      </div>
    </div>
  );
}

function UserRow({ u, children }) {
  const initials = u.username?.[0]?.toUpperCase() || "U";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 8px", borderRadius: 10, marginBottom: 2,
    }}>
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          width: 34, height: 34, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #e8a84a)",
          color: "#fff", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{initials}</div>
        {u.online && (
          <span style={{
            position: "absolute", bottom: -1, right: -1,
            width: 9, height: 9, borderRadius: "50%",
            background: "#3fb96f", border: "2px solid var(--bg-panel)",
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @{u.username}
        </div>
        <div style={{ fontSize: 11, color: "var(--t3)" }}>
          {formatLastSeen(u.online, u.lastSeen)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>{children}</div>
    </div>
  );
}

function SmallBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "5px 10px", fontSize: 11.5, fontWeight: 600,
        borderRadius: 7, border: "none", cursor: "pointer",
        fontFamily: "var(--font)",
        background: danger ? "var(--danger-bg)" : "var(--accent-bg)",
        color: danger ? "var(--danger)" : "var(--accent)",
      }}
    >
      {children}
    </button>
  );
}

function Tag({ children }) {
  return (
    <span style={{ fontSize: 11, color: "var(--t3)", padding: "5px 8px" }}>{children}</span>
  );
}

function Empty({ children }) {
  return (
    <p style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", padding: "28px 12px", lineHeight: 1.6 }}>
      {children}
    </p>
  );
}
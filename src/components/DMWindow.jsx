// src/components/DMWindow.jsx
import React, { useState, useEffect, useRef } from "react";
import { getOrCreateDM, sendDM, subscribeToDMMessages } from "../services/dmService";
import { formatLastSeen } from "../services/friendService";

export default function DMWindow({ user, friend, onBack }) {
  const [dmId, setDmId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    let unsub = () => {};
    (async () => {
      const id = await getOrCreateDM(user.uid, friend.uid);
      setDmId(id);
      unsub = subscribeToDMMessages(id, setMessages);
    })();
    return () => unsub();
  }, [user.uid, friend.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !dmId) return;
    setInput("");
    await sendDM(dmId, user.uid, text);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--bg-chat)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--t2)" }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="18" height="18">
            <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #e8a84a)",
          color: "#fff", fontSize: 13, fontWeight: 600,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>{friend.username?.[0]?.toUpperCase() || "U"}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t1)" }}>@{friend.username}</div>
          <div style={{ fontSize: 11, color: "var(--t3)" }}>{formatLastSeen(friend.online, friend.lastSeen)}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
        {messages.map(m => (
          <div key={m.id} style={{
            display: "flex",
            justifyContent: m.senderId === user.uid ? "flex-end" : "flex-start",
            marginBottom: 8,
          }}>
            <div style={{
              maxWidth: "70%", padding: "8px 12px", borderRadius: 14,
              background: m.senderId === user.uid ? "var(--accent)" : "#fff",
              color: m.senderId === user.uid ? "#fff" : "var(--t1)",
              fontSize: 13.5, lineHeight: 1.4,
              border: m.senderId === user.uid ? "none" : "1px solid var(--border)",
            }}>
              {m.text}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8, maxWidth: 760, margin: "0 auto" }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleSend(); }}
            placeholder={`Message @${friend.username}…`}
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 20,
              border: "1px solid var(--border)", outline: "none",
              fontSize: 13.5, fontFamily: "var(--font)",
            }}
          />
          <button
            onClick={handleSend}
            style={{
              padding: "10px 18px", borderRadius: 20, border: "none",
              background: "var(--accent)", color: "#fff", fontWeight: 600,
              cursor: "pointer", fontFamily: "var(--font)",
            }}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
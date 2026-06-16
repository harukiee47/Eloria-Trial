// src/components/DMWindow.jsx
import React, { useState, useEffect, useRef } from "react";
import { getOrCreateDM, sendDM, subscribeToDMMessages } from "../services/dmService";
import { formatLastSeen } from "../services/friendService";

export default function DMWindow({ user, friend, friends = [], onSelectFriend, onBack }) {
  const [dmId, setDmId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const unsubRef = useRef(() => {});

  // Re-run whenever the friend changes
  useEffect(() => {
    if (!friend?.uid) return;
    setMessages([]);
    setDmId(null);
    unsubRef.current();

    let cancelled = false;
    getOrCreateDM(user.uid, friend.uid).then((id) => {
      if (cancelled) return;
      setDmId(id);
      unsubRef.current = subscribeToDMMessages(id, (msgs) => {
        if (!cancelled) setMessages(msgs);
      });
    });

    return () => {
      cancelled = true;
      unsubRef.current();
    };
  }, [user.uid, friend?.uid]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !dmId || sending) return;
    setSending(true);
    setInput("");
    try {
      await sendDM(dmId, user.uid, text);
    } catch (e) {
      console.error("sendDM failed:", e);
    } finally {
      setSending(false);
    }
  };

  const avatar = (name, size = 36) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      background: "linear-gradient(135deg, var(--accent), #e8a84a)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden" }}>

      {/* ── LEFT SIDEBAR ── */}
      <div style={{
        width: 240, flexShrink: 0, borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", background: "var(--bg-sidebar, #f7f8fa)",
        height: "100%", overflow: "hidden",
      }}>

        {/* Back button */}
        <button onClick={onBack} style={{
          display: "flex", alignItems: "center", gap: 8,
          margin: "14px 12px 0", padding: "8px 10px", borderRadius: 10,
          border: "none", background: "none", cursor: "pointer",
          color: "var(--t2)", fontSize: 13, fontWeight: 500,
        }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>

        {/* My profile */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "16px 14px 12px", borderBottom: "1px solid var(--border)",
        }}>
          {avatar(user.displayName || user.username, 40)}
          <div style={{ overflow: "hidden" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--t1)",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.displayName || user.username}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>@{user.username}</div>
          </div>
        </div>

        {/* Section label */}
        <div style={{ padding: "12px 14px 6px", fontSize: 11, fontWeight: 600,
          color: "var(--t3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Friends
        </div>

        {/* Friends list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {friends.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--t3)", padding: "0 14px" }}>
              No friends yet. Add some from the notifications panel.
            </p>
          ) : (
            friends.map(f => {
              const isActive = friend?.uid === f.uid;
              return (
                <div key={f.uid} onClick={() => onSelectFriend(f)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "8px 14px", cursor: "pointer", borderRadius: 10,
                    margin: "2px 6px",
                    background: isActive ? "var(--accent-soft, rgba(13,106,94,0.1))" : "none",
                    transition: "background 0.12s",
                  }}>
                  <div style={{ position: "relative" }}>
                    {avatar(f.username, 32)}
                    {/* online dot */}
                    <span style={{
                      position: "absolute", bottom: 1, right: 1,
                      width: 8, height: 8, borderRadius: "50%",
                      background: f.online ? "#22c55e" : "#9ca3af",
                      border: "2px solid var(--bg-sidebar, #f7f8fa)",
                    }} />
                  </div>
                  <div style={{ overflow: "hidden", flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1)",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      @{f.username}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--t3)" }}>
                      {f.online ? "Active now" : formatLastSeen(f.online, f.lastSeen)}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT CHAT AREA ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%",
        overflow: "hidden", background: "var(--bg-chat)" }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 18px", borderBottom: "1px solid var(--border)", flexShrink: 0,
        }}>
          {avatar(friend?.username, 34)}
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--t1)" }}>
              @{friend?.username}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)" }}>
              {friend?.online ? "Active now" : formatLastSeen(friend?.online, friend?.lastSeen)}
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 18px", display: "flex",
          flexDirection: "column" }}>
          {/* Beginning of chat notice */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%", margin: "0 auto 10px",
              background: "linear-gradient(135deg, var(--accent), #e8a84a)",
              color: "#fff", fontSize: 22, fontWeight: 700,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {friend?.username?.[0]?.toUpperCase() || "?"}
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--t1)", marginBottom: 4 }}>
              @{friend?.username}
            </div>
            <div style={{ fontSize: 13, color: "var(--t3)" }}>
              This is the beginning of your conversation with @{friend?.username}. Say hi!
            </div>
          </div>

          {messages.map((m) => {
            const isMe = m.senderId === user.uid;
            return (
              <div key={m.id} style={{
                display: "flex", justifyContent: isMe ? "flex-end" : "flex-start",
                marginBottom: 6,
              }}>
                <div style={{
                  maxWidth: "70%", padding: "9px 14px", borderRadius: 18,
                  borderBottomRightRadius: isMe ? 4 : 18,
                  borderBottomLeftRadius: isMe ? 18 : 4,
                  background: isMe ? "var(--accent)" : "var(--bg-msg, #fff)",
                  color: isMe ? "#fff" : "var(--t1)",
                  fontSize: 13.5, lineHeight: 1.5,
                  border: isMe ? "none" : "1px solid var(--border)",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{ padding: "10px 16px 16px", borderTop: "1px solid var(--border)",
          flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, maxWidth: 800, margin: "0 auto" }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleSend(); }}
              placeholder={`Message @${friend?.username}…`}
              style={{
                flex: 1, padding: "10px 16px", borderRadius: 22,
                border: "1px solid var(--border)", outline: "none",
                fontSize: 13.5, fontFamily: "var(--font)",
                background: "var(--bg-input, #fff)", color: "var(--t1)",
              }}
            />
            <button onClick={handleSend} disabled={!input.trim() || sending} style={{
              padding: "10px 20px", borderRadius: 22, border: "none",
              background: input.trim() ? "var(--accent)" : "var(--border)",
              color: input.trim() ? "#fff" : "var(--t3)",
              fontWeight: 600, cursor: input.trim() ? "pointer" : "default",
              fontFamily: "var(--font)", transition: "background 0.15s",
            }}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
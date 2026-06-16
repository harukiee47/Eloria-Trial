// src/components/DMWindow.jsx
import React, { useState, useEffect, useRef } from "react";
import { getOrCreateDM, sendDM, subscribeToDMMessages } from "../services/dmService";
import { formatLastSeen } from "../services/friendService";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const DM_STYLE = `
  .dm-shell {
    display: flex; width: 100%; height: 100vh; overflow: hidden;
    background: var(--bg-app);
  }
  /* ── DM LEFT SIDEBAR ── */
  .dm-sidebar {
    width: 240px; flex-shrink: 0;
    background: var(--bg-strip);
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    height: 100%; overflow: hidden;
  }
  @media(max-width: 640px) {
    .dm-sidebar { width: 72px; }
    .dm-sidebar .dm-friend-name,
    .dm-sidebar .dm-friend-status,
    .dm-sidebar .dm-section-label,
    .dm-sidebar .dm-my-name,
    .dm-sidebar .dm-my-username { display: none; }
    .dm-sidebar .dm-friend-row { justify-content: center; padding: 8px 0; }
    .dm-sidebar .dm-my-profile { justify-content: center; padding: 12px 0; }
    .dm-back-btn span { display: none; }
    .dm-back-btn { justify-content: center; padding: 8px 0; width: 100%; }
  }
  .dm-back-btn {
    display: flex; align-items: center; gap: 8px;
    margin: 12px 10px 4px; padding: 8px 10px; border-radius: 10px;
    border: none; background: none; cursor: pointer;
    color: var(--t2); font-size: 13px; font-weight: 500;
    font-family: var(--font); transition: background 0.12s;
    width: calc(100% - 20px);
  }
  .dm-back-btn:hover { background: var(--bg-panel); color: var(--t1); }
  .dm-my-profile {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  .dm-my-name { font-size: 13px; font-weight: 700; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dm-my-username { font-size: 11px; color: var(--t3); }
  .dm-section-label {
    padding: 12px 14px 6px; font-size: 10px; font-weight: 700;
    color: var(--t3); text-transform: uppercase; letter-spacing: 0.07em; flex-shrink: 0;
  }
  .dm-friends-list { flex: 1; overflow-y: auto; padding: 0 6px 12px; }
  .dm-friend-row {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 10px; border-radius: 10px; cursor: pointer;
    margin-bottom: 2px; transition: background 0.12s;
  }
  .dm-friend-row:hover { background: var(--bg-panel); }
  .dm-friend-row.active { background: var(--accent-bg); }
  .dm-friend-name { font-size: 13px; font-weight: 600; color: var(--t1);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .dm-friend-status { font-size: 11px; color: var(--t3); margin-top: 1px; }
  .dm-no-friends { font-size: 12px; color: var(--t3); padding: 16px 14px; line-height: 1.6; }

  /* ── DM CHAT AREA ── */
  .dm-chat {
    flex: 1; display: flex; flex-direction: column;
    height: 100%; overflow: hidden; background: var(--bg-chat);
  }
  .dm-chat-header {
    display: flex; align-items: center; gap: 10px;
    padding: 14px 18px; border-bottom: 1px solid var(--border); flex-shrink: 0;
    background: var(--bg-panel);
  }
  .dm-messages {
    flex: 1; overflow-y: auto; padding: 20px 18px;
    display: flex; flex-direction: column; gap: 4px;
  }
  .dm-start-notice {
    text-align: center; margin-bottom: 28px; padding: 0 16px;
  }
  .dm-input-area {
    padding: 10px 16px 16px; border-top: 1px solid var(--border);
    flex-shrink: 0; background: var(--bg-panel);
  }
  .dm-input-row {
    display: flex; gap: 8px; max-width: 800px; margin: 0 auto;
    align-items: flex-end;
  }
  .dm-input {
    flex: 1; padding: 10px 14px; border-radius: 22px;
    border: 1px solid var(--border); outline: none;
    font-size: 13.5px; font-family: var(--font);
    background: var(--bg-app); color: var(--t1);
    resize: none; min-height: 42px; max-height: 120px;
    line-height: 1.4; overflow-y: auto;
    transition: border-color 0.13s;
  }
  .dm-input:focus { border-color: var(--accent); }
 .dm-send-btn {
  width: 42px; height: 42px; border-radius: 50%; border: none;
  background: var(--accent); color: #fff;
  cursor: pointer; transition: opacity 0.13s;
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.dm-send-btn:disabled { opacity: 0.4; cursor: default; }
  .dm-send-btn:disabled { opacity: 0.4; cursor: default; }
  .dm-attach-btn {
    width: 42px; height: 42px; border-radius: 50%; border: 1px solid var(--border);
    background: var(--bg-app); cursor: pointer; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    color: var(--t2); transition: background 0.12s, color 0.12s;
  }
  .dm-attach-btn:hover { background: var(--accent-bg); color: var(--accent); }

  /* ── MESSAGE BUBBLES ── */
  .dm-msg-row {
    display: flex; align-items: flex-end; gap: 8px; margin-bottom: 2px;
  }
  .dm-msg-row.mine { flex-direction: row-reverse; }
  .dm-msg-avatar {
    width: 28px; height: 28px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, var(--accent), #e8a84a);
    color: #fff; font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 2px;
  }
  .dm-bubble {
    max-width: 65%; padding: 9px 13px; border-radius: 18px;
    font-size: 13.5px; line-height: 1.5; word-break: break-word;
  }
  .dm-bubble.theirs {
    background: var(--bg-panel); color: var(--t1);
    border: 1px solid var(--border);
    border-bottom-left-radius: 4px;
  }
  .dm-bubble.mine {
    background: var(--accent); color: #fff;
    border-bottom-right-radius: 4px;
  }

  /* ── FILE UPLOAD ── */
  .dm-upload-bar {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; background: var(--accent-bg);
    border-radius: 10px; margin: 0 auto 8px; max-width: 800px;
    font-size: 12px; color: var(--t2);
  }
  .dm-upload-progress {
    flex: 1; height: 4px; background: var(--border);
    border-radius: 2px; overflow: hidden;
  }
  .dm-upload-fill {
    height: 100%; background: var(--accent);
    transition: width 0.2s;
  }
  .dm-file-bubble {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: 12px;
    border: 1px solid; max-width: 65%;
  }
  .dm-file-bubble.mine { background: rgba(255,255,255,0.15); border-color: rgba(255,255,255,0.25); }
  .dm-file-bubble.theirs { background: var(--accent-bg); border-color: var(--border); }
  .dm-file-icon { font-size: 22px; flex-shrink: 0; }
  .dm-file-name { font-size: 12px; font-weight: 600; word-break: break-all; }
  .dm-file-size { font-size: 11px; opacity: 0.7; margin-top: 2px; }
  .dm-file-dl {
    font-size: 11px; font-weight: 600; padding: 4px 10px;
    border-radius: 6px; border: none; cursor: pointer;
    font-family: var(--font); margin-top: 6px; display: inline-block;
    text-decoration: none;
  }
  .dm-file-dl.mine { background: rgba(255,255,255,0.2); color: #fff; }
  .dm-file-dl.theirs { background: var(--accent); color: #fff; }

  @media(max-width: 640px) {
    .dm-messages { padding: 14px 10px; }
    .dm-input-area { padding: 8px 10px 12px; }
    .dm-bubble { max-width: 80%; font-size: 13px; }
    .dm-file-bubble { max-width: 80%; }
  }
`;

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type) {
  if (type?.startsWith("image/")) return "🖼️";
  if (type?.includes("pdf")) return "📄";
  if (type?.includes("word") || type?.includes("document")) return "📝";
  if (type?.includes("sheet") || type?.includes("excel") || type?.includes("csv")) return "📊";
  if (type?.includes("zip") || type?.includes("rar")) return "🗜️";
  return "📎";
}

export default function DMWindow({ user, friend, friends = [], onSelectFriend, onBack }) {
  const [dmId, setDmId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null); // { name, pct }
  const bottomRef = useRef(null);
  const unsubRef = useRef(() => {});
  const fileInputRef = useRef(null);

  // Inject styles once
  useEffect(() => {
    if (!document.getElementById("dm-style")) {
      const tag = document.createElement("style");
      tag.id = "dm-style";
      tag.textContent = DM_STYLE;
      document.head.appendChild(tag);
    }
  }, []);

  // Subscribe to messages whenever friend changes
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
    }).catch(console.error);

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

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file || !dmId) return;
    e.target.value = "";

    const storage = getStorage();
    const path = `dms/${dmId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    setUploadProgress({ name: file.name, pct: 0 });

    task.on("state_changed",
      (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setUploadProgress({ name: file.name, pct });
      },
      (err) => { console.error(err); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await sendDM(dmId, user.uid, null, {
          type: file.type?.startsWith("image/") ? "image" : "file",
          url,
          name: file.name,
          size: file.size,
          mimeType: file.type,
        });
        setUploadProgress(null);
      }
    );
  };

  const Avatar = ({ name, size = 28 }) => (
    <div className="dm-msg-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );

  const SidebarAvatar = ({ name, size = 36, online }) => (
    <div style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, position: "relative",
      background: "linear-gradient(135deg, var(--accent), #e8a84a)",
      color: "#fff", fontSize: size * 0.38, fontWeight: 700,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {name?.[0]?.toUpperCase() || "?"}
      {online !== undefined && (
        <span style={{
          position: "absolute", bottom: 1, right: 1,
          width: size * 0.27, height: size * 0.27, borderRadius: "50%",
          background: online ? "#22c55e" : "#9ca3af",
          border: `2px solid var(--bg-strip)`,
        }} />
      )}
    </div>
  );

  const showBeginning = messages.length === 0;

  return (
    <div className="dm-shell">

      {/* ── LEFT SIDEBAR ── */}
      <div className="dm-sidebar">
        <button className="dm-back-btn" onClick={onBack}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" width="16" height="16">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>

        {/* My profile */}
        <div className="dm-my-profile">
          <SidebarAvatar name={user.displayName || user.username} size={38} />
          <div style={{ overflow: "hidden", flex: 1 }}>
            <div className="dm-my-name">{user.displayName || user.username}</div>
            <div className="dm-my-username">@{user.username}</div>
          </div>
        </div>

        <div className="dm-section-label">Friends</div>

        <div className="dm-friends-list">
          {friends.length === 0 ? (
            <div className="dm-no-friends">
              Add friends from the notifications panel to start messaging.
            </div>
          ) : friends.map(f => (
            <div
              key={f.uid}
              className={`dm-friend-row${friend?.uid === f.uid ? " active" : ""}`}
              onClick={() => onSelectFriend(f)}
            >
              <SidebarAvatar name={f.username} size={34} online={f.online} />
              <div style={{ overflow: "hidden", flex: 1 }}>
                <div className="dm-friend-name">@{f.username}</div>
                <div className="dm-friend-status">
                  {f.online ? "Active now" : formatLastSeen(f.online, f.lastSeen)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div className="dm-chat">

        {/* Header */}
        <div className="dm-chat-header">
          <SidebarAvatar name={friend?.username} size={34} online={friend?.online} />
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
        <div className="dm-messages">

          {/* Beginning notice — only when no messages */}
          {showBeginning && (
            <div className="dm-start-notice">
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
              <div style={{ fontSize: 13, color: "var(--t3)", maxWidth: 280, margin: "0 auto" }}>
                This is the beginning of your conversation with @{friend?.username}. Say hi! 👋
              </div>
            </div>
          )}

          {messages.map((m) => {
            const isMe = m.senderId === user.uid;
            const senderName = isMe
              ? (user.displayName || user.username)
              : (friend?.username || "?");

            return (
              <div key={m.id} className={`dm-msg-row${isMe ? " mine" : ""}`}>
                <Avatar name={senderName} />
                <div>
                  {/* Image message */}
                  {m.fileType === "image" ? (
                    <div className={`dm-bubble ${isMe ? "mine" : "theirs"}`} style={{ padding: 4 }}>
                      <img
                        src={m.fileUrl}
                        alt={m.fileName || "image"}
                        style={{ maxWidth: "100%", maxHeight: 240, borderRadius: 12,
                          display: "block", cursor: "pointer" }}
                        onClick={() => window.open(m.fileUrl, "_blank")}
                      />
                    </div>
                  ) : m.fileType === "file" ? (
                    /* File message */
                    <div className={`dm-file-bubble ${isMe ? "mine" : "theirs"}`}>
                      <div className="dm-file-icon">{fileIcon(m.fileMimeType)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className={`dm-file-name`} style={{ color: isMe ? "#fff" : "var(--t1)" }}>
                          {m.fileName}
                        </div>
                        <div className="dm-file-size">{formatBytes(m.fileSize)}</div>
                        <a href={m.fileUrl} target="_blank" rel="noreferrer"
                          download={m.fileName}
                          className={`dm-file-dl ${isMe ? "mine" : "theirs"}`}>
                          Download
                        </a>
                      </div>
                    </div>
                  ) : (
                    /* Text message */
                    <div className={`dm-bubble ${isMe ? "mine" : "theirs"}`}>
                      {m.text}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Upload progress bar */}
        {uploadProgress && (
          <div style={{ padding: "0 16px 4px" }}>
            <div className="dm-upload-bar">
              <span style={{ flexShrink: 0 }}>📎 {uploadProgress.name}</span>
              <div className="dm-upload-progress">
                <div className="dm-upload-fill" style={{ width: `${uploadProgress.pct}%` }} />
              </div>
              <span style={{ flexShrink: 0 }}>{uploadProgress.pct}%</span>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="dm-input-area">
          <div className="dm-input-row">
            <input type="file" ref={fileInputRef} style={{ display: "none" }}
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar" />
            <button className="dm-attach-btn" onClick={() => fileInputRef.current?.click()}
              title="Attach file" disabled={!dmId}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66L9.41 16.41a2 2 0 01-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input
              className="dm-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder={`Message @${friend?.username}…`}
            />
            <button className="dm-send-btn" onClick={handleSend}
  disabled={!input.trim() || sending || !dmId}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <line x1="22" y1="2" x2="11" y2="13"/>
    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
</button>
          </div>
        </div>
      </div>
    </div>
  );
}
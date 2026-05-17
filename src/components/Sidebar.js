import React, { useState, useEffect } from "react";
import "./Sidebar.css";
import logo from "../assets/logo.png";
export default function Sidebar({
  user,
  chats,
  setChats,
  activeChatId,
  setActiveChatId,
  onLogout,
  sidebarOpen,
  setSidebarOpen
}) {
  const [openMenuId, setOpenMenuId] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [search, setSearch] = useState("");

  const addChat = () => {
    const newChat = {
      id: Date.now(),
      title: "New Chat",
      messages: [],
      animate: true,
    };

    setChats((prev) => [...prev, newChat]);
    setActiveChatId(newChat.id);
  };

  const deleteChat = (id) => {
    const filtered = chats.filter((c) => c.id !== id);
    setChats(filtered);
    if (activeChatId === id) setActiveChatId(filtered[0]?.id || null);
    setOpenMenuId(null);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
  setShowLogoutConfirm(false);
  setSidebarOpen(false);   // ADD THIS
  if (onLogout) onLogout();
};

useEffect(() => {
  const updated = chats.map((c) =>
    c.animate ? { ...c, animate: false } : c
  );

  if (chats.some((c) => c.animate)) {
    setChats(updated);
  }
}, [chats]);

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <img src={logo} alt="Eloria" className="sidebar-logo" />

          <div className="sidebar-brand-text">
            <h2>Eloria</h2>
            <span>AI Assistant</span>
          </div>
        </div>

        {/* SEARCH */}
        <div className="sidebar-search">
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sidebar-search-input"
          />
        </div>

        <button className="new-chat-btn glow-sweep" onClick={addChat}>
          + New chat
        </button>
      </div>

      {/* Chat list */}
      <div className="chat-list">
        {chats
          .filter((chat) =>
            chat.title?.toLowerCase().includes(search.toLowerCase())
          )
          .map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${chat.animate ? "new-chat-anim" : ""}`}
            >
              <div
                className="chat-top-row"
                onClick={() => {
                  setActiveChatId(chat.id);
                  setSidebarOpen(false); // IMPORTANT
                  }}
              >
                <span className="chat-title">{chat.title}</span>

                {/* 3 DOT MENU */}
                <span
                  className="chat-menu"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === chat.id ? null : chat.id);
                  }}
                >
                  ⋮
                </span>
              </div>

              {/* Dropdown menu */}
              {openMenuId === chat.id && (
                <div className="chat-dropdown" onClick={(e) => e.stopPropagation()}>
                  {chat.renameOpen ? (
                    <div className="rename-box">
                      <input
                        type="text"
                        defaultValue={chat.title}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const newTitle = e.target.value.trim();
                            if (newTitle) {
                              setChats((prev) =>
                                prev.map((c) =>
                                  c.id === chat.id
                                    ? { ...c, title: newTitle, renameOpen: false }
                                    : c
                                )
                              );
                            } else {
                              setChats((prev) =>
                                prev.map((c) =>
                                  c.id === chat.id ? { ...c, renameOpen: false } : c
                                )
                              );
                            }
                          }
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        className="dropdown-item"
                        onClick={() =>
                          setChats((prev) =>
                            prev.map((c) =>
                              c.id === chat.id ? { ...c, renameOpen: true } : c
                            )
                          )
                        }
                      >
                        Rename
                      </div>
                      <div className="dropdown-item delete" onClick={() => deleteChat(chat.id)}>
                        Delete
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-avatar">
          {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
        </div>
        <div className="user-info">
          <div className="user-name">{user?.username || "Account"}</div>
          <div className="user-email">{user?.email || "Guest"}</div>
        </div>
        <button className="logout-btn" onClick={handleLogout}>
          Logout
        </button>
      </div>

      {/* Logout confirmation */}
      {showLogoutConfirm && (
        <div className="logout-confirm">
          <div className="logout-box">
            <p>Are you sure you want to logout?</p>
            <div className="logout-actions">
              <button
              onClick={() => {
           confirmLogout();
              setSidebarOpen(false); // IMPORTANT for mobile
             }}
             >
              Yes
              </button>
              <button onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

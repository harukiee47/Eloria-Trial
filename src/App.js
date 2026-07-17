import React, { useState, useEffect } from "react";
import "./App.css";
import "./mobile.css";

import EloriaCode from "./components/EloriaCode";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { loadChats, saveChats } from "./services/chatService";
import { checkAuth, logout } from "./services/auth";
import Pricing from "./components/Pricing";
import { auth } from "./services/firebase";
import SharedChatViewer from "./components/SharedChatViewer";
import { loadShared } from "./services/shareService";
import GroupChat from "./components/GroupChat";
import { subscribeToGroups, subscribeToInvites, createGroup } from "./services/groupService";
import { subscribeToMyProfile, setOnlineStatus } from "./services/userService";
import { subscribeToNotifications } from "./services/notificationService";
import NotificationsPanel from "./components/NotificationsPanel";
import ProfileSetupModal from "./components/ProfileSetupModal";
import AuthCallback from "./components/AuthCallback";
import HyperFrame from "./components/HyperFrame";
import DownloadPage from "./components/Downloadpage";

if (window.location.pathname === "/code") {
  import("react-dom/client").then(({ createRoot }) => {
    const root = createRoot(document.getElementById("root"));
    
    function CodeApp() {
      const [showHF, setShowHF] = React.useState(false);
      return showHF
        ? <HyperFrame onBack={() => setShowHF(false)} />
        : <EloriaCode onBack={() => { window.location.href = "/"; }} onOpenEditor={() => setShowHF(true)} />;
    }

    root.render(<CodeApp />);
  });
}

/* ── inline styles for the group-limit popup ── */
const limitModalStyles = `
  .app-limit-backdrop {
    position: fixed; inset: 0; z-index: 9999;
    background: rgba(0,0,0,.4); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: appFadeIn .15s ease;
  }
  @keyframes appFadeIn { from{opacity:0} to{opacity:1} }
  .app-limit-modal {
    background: #fff; border-radius: 16px;
    width: 300px; margin: 0 20px;
    box-shadow: 0 24px 60px rgba(0,0,0,.18);
    animation: appSlideUp .17s ease;
    overflow: hidden; padding: 28px 24px 20px;
    font-family: var(--font, system-ui, sans-serif);
    text-align: center;
  }
  @keyframes appSlideUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
  .app-limit-icon  { font-size: 36px; margin-bottom: 10px; }
  .app-limit-title { font-size: 16px; font-weight: 700; color: #111; margin-bottom: 8px; }
  .app-limit-msg   { font-size: 13px; color: #555; line-height: 1.6; margin-bottom: 20px; }
  .app-limit-close {
    display: block; width: 100%; padding: 10px;
    background: #0d6a5e; border: none; border-radius: 10px;
    color: #fff; font-size: 14px; font-weight: 600;
    cursor: pointer; transition: opacity .12s;
  }
  .app-limit-close:hover { opacity: .87; }
`;

export default function App() {
  const [stage, setStage]               = useState("splash");
  const [user, setUser]                 = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [chats, setChats]               = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [codeProjects, setCodeProjects]     = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [showPricing, setShowPricing]   = useState(false);
  const [userPlan, setUserPlan]         = useState("free");
  const [sharedData, setSharedData]     = useState(null);
  const [groups, setGroups]             = useState([]);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [pendingInviteCount, setPendingInviteCount] = useState(0);
  const [mode, setMode]                 = useState("chat");
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [myProfile, setMyProfile]           = useState(null);
  const [notifications, setNotifications]   = useState([]);
  const totalBadgeCount = pendingInviteCount + notifications.length;
  const [groupInvites, setGroupInvites] = useState([]);
  const [groupLimitModal, setGroupLimitModal] = useState(null);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToMyProfile(user.uid, setMyProfile);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToNotifications(user.uid, setNotifications);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;
    setOnlineStatus(user.uid, true).catch(console.error);
    const heartbeat = setInterval(() => {
      setOnlineStatus(user.uid, true).catch(() => {});
    }, 30000);
    const handleUnload = () => setOnlineStatus(user.uid, false).catch(() => {});
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", handleUnload);
      setOnlineStatus(user.uid, false).catch(() => {});
    };
  }, [user]);

  useEffect(() => {
    if (!document.getElementById("app-limit-style")) {
      const tag = document.createElement("style");
      tag.id = "app-limit-style";
      tag.textContent = limitModalStyles;
      document.head.appendChild(tag);
    }
  }, []);

  // ── Deep link handler for Google login (Tauri only) ──────────────────────
useEffect(() => {
  if (!window.__TAURI__) return;
  import("@tauri-apps/api/event").then(({ listen }) => {
    listen("deep-link", async (event) => {
      try {
        const url = event.payload.replace(/"/g, "");
        const params = new URL(url).searchParams;
        const error = params.get("error");
        if (error) return;

        const customToken = decodeURIComponent(params.get("customToken") || "");
        const uid         = params.get("uid");
        const email       = decodeURIComponent(params.get("email") || "");
        const displayName = decodeURIComponent(params.get("displayName") || "");
        if (!customToken || !uid) return;

        const { loginWithDeepLinkToken } = await import("./services/auth");
        const u = await loginWithDeepLinkToken(customToken, uid, email, displayName);
        setUser(u);
        setStage(u.usernameSet ? "chat" : "profileSetup");
      } catch (err) {
        alert("Login failed: " + err.message);
      }
    });
  });
}, []);

  const activeGroup = groups.find(g => g.id === activeGroupId) ?? null;

  useEffect(() => {
    if (mode === "group" && activeGroupId && !activeGroup) {
      setMode("chat");
      setActiveGroupId(null);
    }
  }, [groups, activeGroupId, activeGroup, mode]);

  const handleCreateGroup = async (user, groupName, userPlan) => {
    try {
      const id = await createGroup(user, groupName, userPlan);
      return id;
    } catch (err) {
      setGroupLimitModal({ message: err.message });
      throw err;
    }
  };

  useEffect(() => {
    if (!activeChatId && chats.length > 0) setActiveChatId(chats[0].id);
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!user?.uid) return;
    const fetchChats = async () => {
      try {
        const data = await loadChats(user.uid);
        if (Array.isArray(data) && data.length > 0) {
          setChats(data);
          setActiveChatId(data[0].id);
        } else {
          const firstChat = { id: Date.now(), title: "New Chat", messages: [] };
          setChats([firstChat]);
          setActiveChatId(firstChat.id);
          await saveChats(user.uid, [firstChat]);
        }
      } catch (err) {
        console.error("Failed to load chats:", err);
        const firstChat = { id: Date.now(), title: "New Chat", messages: [] };
        setChats([firstChat]);
        setActiveChatId(firstChat.id);
      }
    };
    fetchChats();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchPlan = async () => {
      try {
        const token = await auth.currentUser.getIdToken();
        const res = await fetch("https://eloria-trial.onrender.com/api/membership/status", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setUserPlan(data.plan || "free");
      } catch (err) {
        console.error("Failed to fetch plan:", err);
      }
    };
    fetchPlan();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = subscribeToGroups(user.uid, setGroups);
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user?.email) return;
    const unsub = subscribeToInvites(user.email, (invites) => {
      setPendingInviteCount(invites.length);
      setGroupInvites(invites);
    });
    return () => unsub();
  }, [user]);

  async function handleSaveShared(data) {
    if (!user) return;
    if (data.type === "chat") {
      const newChat = { id: Date.now(), title: `${data.title} (shared)`, messages: data.messages || [] };
      const updated = [...chats, newChat];
      setChats(updated);
      setActiveChatId(newChat.id);
      await saveChats(user.uid, updated);
    } else if (data.type === "project") {
      const newChats = (data.projectChats || []).map((c, i) => ({
        id: Date.now() + i + 1,
        title: `${c.title || "Chat"} (from ${data.title})`,
        messages: c.messages || [],
      }));
      const updated = [...chats, ...newChats];
      setChats(updated);
      if (newChats.length > 0) setActiveChatId(newChats[0].id);
      await saveChats(user.uid, updated);
    }
    window.history.replaceState({}, "", window.location.pathname);
  }

  const createNewProject = () => {
    const project = { id: Date.now(), name: "New Project", files: [] };
    setCodeProjects(prev => [...prev, project]);
    setActiveProjectId(project.id);
    setMode("codeWorkspace");
  };

  useEffect(() => {
    if (!chats.find(c => c.id === activeChatId)) {
      setActiveChatId(chats[0]?.id || null);
    }
  }, [chats, activeChatId]);

  useEffect(() => {
    if (window.innerWidth < 768) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shareId = params.get("share");
    if (!shareId) return;
    loadShared(shareId)
      .then(data => {
        if (data) setSharedData(data);
        else alert("This share link is invalid or has expired.");
      })
      .catch(() => alert("Failed to load shared content."));
  }, []);

  useEffect(() => {
    const unsubscribe = checkAuth((u) => {
      setUser(u);
      if (!u) {
        setStage("login");
        setChats([]);
        setActiveChatId(null);
      } else if (!u.usernameSet) {
        setStage("profileSetup");
      } else {
        setStage("chat");
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    if (!chats || chats.length === 0) return;
    const timeout = setTimeout(() => {
      saveChats(user.uid, chats).catch(err =>
        console.error("Failed to save chats:", err)
      );
    }, 600);
    return () => clearTimeout(timeout);
  }, [chats, user]);

  useEffect(() => {
    localStorage.setItem("activeChatId", JSON.stringify(activeChatId));
  }, [activeChatId]);

  const activeChat = React.useMemo(() => {
    return chats.find(c => c.id === activeChatId) || null;
  }, [chats, activeChatId]);

  if (window.location.pathname === "/auth/callback") {
    return <AuthCallback />;
  }

  if (window.location.pathname === "/download") {
  return <DownloadPage />;
}

  if (stage === "login") {
    return (
      <Login
        onLogin={(u) => {
          setUser(u);
          setStage("chat");
          setChats((prev) => {
            if (prev.length > 0) return prev;
            const firstChat = { id: Date.now(), title: "New Chat", messages: [] };
            setActiveChatId(firstChat.id);
            return [firstChat];
          });
        }}
      />
    );
  }

  if (stage === "profileSetup") {
    return (
      <ProfileSetupModal
        user={user}
        onComplete={({ displayName, username }) => {
          setUser(prev => ({ ...prev, displayName, username, usernameSet: true }));
          setStage("chat");
        }}
      />
    );
  }

  if (showPricing) {
    return <Pricing onBack={() => setShowPricing(false)} />;
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        user={user}
        chats={chats}
        setChats={setChats}
        activeChatId={activeChatId}
        setActiveChatId={setActiveChatId}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        onLogout={async () => {
          await logout(user?.uid);
          setUser(null);
          setChats([]);
          setActiveChatId(null);
          setMode("chat");
          setStage("login");
        }}
        groups={groups}
        activeGroupId={activeGroupId}
        setActiveGroupId={setActiveGroupId}
        pendingInviteCount={pendingInviteCount}
        userPlan={userPlan}
        mode={mode}
        setMode={setMode}
        createGroup={handleCreateGroup}
        setShowPricing={setShowPricing}
        createNewProject={createNewProject}
        codeProjects={codeProjects}
        activeProjectId={activeProjectId}
        showNotifPanel={showNotifPanel}
        setShowNotifPanel={setShowNotifPanel}
        totalBadgeCount={totalBadgeCount}
      />

      <div className="app-main">
        {mode === "group" && activeGroup ? (
          <GroupChat
            group={activeGroup}
            user={user}
            userPlan={userPlan}
            onBack={() => { setMode("chat"); setActiveGroupId(null); }}
          />
        ) : (
          <ChatWindow
            user={user}
            chat={activeChat}
            setChats={setChats}
            setSidebarOpen={setSidebarOpen}
            setShowPricing={setShowPricing}
            userPlan={userPlan}
            allChats={chats}
          />
        )}

        {sharedData && (
          <SharedChatViewer
            sharedData={sharedData}
            onDismiss={() => {
              setSharedData(null);
              window.history.replaceState({}, "", window.location.pathname);
            }}
            onSave={handleSaveShared}
            isLoggedIn={!!user}
          />
        )}
      </div>

      {showNotifPanel && (
        <NotificationsPanel
          user={user}
          myProfile={myProfile}
          notifications={notifications}
          groupInvites={groupInvites}
          onClose={() => setShowNotifPanel(false)}
          onGroupAccepted={(groupId) => {
            setActiveGroupId(groupId);
            setMode("group");
            setShowNotifPanel(false);
          }}
        />
      )}

      {groupLimitModal && (
        <div className="app-limit-backdrop" onClick={() => setGroupLimitModal(null)}>
          <div className="app-limit-modal" onClick={e => e.stopPropagation()}>
            <div className="app-limit-icon"></div>
            <div className="app-limit-title">Group Limit Reached</div>
            <div className="app-limit-msg">{groupLimitModal.message}</div>
            <button className="app-limit-close" onClick={() => setGroupLimitModal(null)}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
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
import { subscribeToMyProfile, subscribeToNotifications, setOnlineStatus } from "./services/userService";
import NotificationsPanel, { FloatingBadge } from "./components/NotificationsPanel";
import { subscribeToFriendsData } from "./services/friendService";
import DMWindow from "./components/DMWindow";
import ProfileSetupModal from "./components/ProfileSetupModal";

if (window.location.pathname === "/code") {
  const root = document.getElementById("root");
  import("react-dom/client").then(({ createRoot }) => {
    createRoot(root).render(<EloriaCode />);
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
const [friendsData, setFriendsData] = useState({ friends: [], received: [], sent: [] });
const [activeDM, setActiveDM] = useState(null);

  // ── Group creation limit modal ───────────────────────────────
  const [groupLimitModal, setGroupLimitModal] = useState(null); // { message }

  useEffect(() => {
  if (!user?.uid) return;
  const unsub = subscribeToMyProfile(user.uid, setMyProfile);
  return () => unsub();
}, [user]);

useEffect(() => {
  if (!user?.uid) return;
  const unsub = subscribeToFriendsData(user.uid, setFriendsData);
  return () => unsub();
}, [user]);

useEffect(() => {
  if (!user?.uid) return;
  const unsub = subscribeToNotifications(user.uid, user.email, setNotifications);
  return () => unsub();
}, [user]);

useEffect(() => {
  if (!user?.uid) return;
  setOnlineStatus(user.uid, true).catch(console.error);
  const handleUnload = () => setOnlineStatus(user.uid, false).catch(() => {});
  window.addEventListener("beforeunload", handleUnload);
  return () => {
    window.removeEventListener("beforeunload", handleUnload);
    setOnlineStatus(user.uid, false).catch(() => {});
  };
}, [user]);

  // Inject limit modal CSS once
  useEffect(() => {
    if (!document.getElementById("app-limit-style")) {
      const tag = document.createElement("style");
      tag.id = "app-limit-style";
      tag.textContent = limitModalStyles;
      document.head.appendChild(tag);
    }
  }, []);

  // ── FIX: safe group lookup — fall back to null, never undefined ──
  const activeGroup = groups.find(g => g.id === activeGroupId) ?? null;

  // ── FIX: when the active group disappears (deleted), go back to chat ──
  useEffect(() => {
    if (mode === "group" && activeGroupId && !activeGroup) {
      setMode("chat");
      setActiveGroupId(null);
    }
  }, [groups, activeGroupId, activeGroup, mode]);

  // ── FIX: wrapped createGroup that shows modal instead of alert ──
  const handleCreateGroup = async (user, groupName, userPlan) => {
    try {
      const id = await createGroup(user, groupName, userPlan);
      return id;
    } catch (err) {
      setGroupLimitModal({ message: err.message });
      throw err; // re-throw so Sidebar knows it failed
    }
  };

  useEffect(() => {
    if (!activeChatId && chats.length > 0) setActiveChatId(chats[0].id);
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!user) return;
    const fetchChats = async () => {
      if (!user?.uid) return;
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
  setGroupInvites(invites);  // ← add this
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
    if (!user) return;
    if (chats === null || chats === undefined) return;
    const timeout = setTimeout(() => { saveChats(user.uid, chats); }, 600);
    return () => clearTimeout(timeout);
  }, [chats, user]);

  useEffect(() => {
    localStorage.setItem("activeChatId", JSON.stringify(activeChatId));
  }, [activeChatId]);

  const activeChat = React.useMemo(() => {
    return chats.find(c => c.id === activeChatId) || null;
  }, [chats, activeChatId]);

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
friendsData={friendsData}
activeDM={activeDM}
setActiveDM={setActiveDM}
      />

      <div className="app-main">
        {/* FIX: only render GroupChat when activeGroup actually exists */}
        {mode === "group" && activeGroup ? (
          <GroupChat
            group={activeGroup}
            user={user}
            userPlan={userPlan}
            onBack={() => { setMode("chat"); setActiveGroupId(null); }}
          />
        ) : mode === "dm" && activeDM ? (
          <DMWindow
            user={user}
            friend={activeDM}
            onBack={() => { setMode("chat"); setActiveDM(null); }}
          />
        ) : (
          <ChatWindow
            user={user}
            chat={activeChat}
            setChats={setChats}
            setSidebarOpen={setSidebarOpen}
            setShowPricing={setShowPricing}
            userPlan={userPlan}
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
    friendsData={friendsData}
    onClose={() => setShowNotifPanel(false)}
    onGroupAccepted={(groupId) => {
      setActiveGroupId(groupId);
      setMode("group");
      setShowNotifPanel(false);
    }}
    onOpenDM={(friend) => {
      setActiveDM(friend);
      setMode("dm");
      setShowNotifPanel(false);
    }}
  />
)}

<FloatingBadge
  count={totalBadgeCount}
  onClick={() => setShowNotifPanel(v => !v)}
/>

      {/* ── Group creation limit modal ── */}
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
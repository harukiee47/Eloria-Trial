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
import GroupNotifications from "./components/GroupNotifications";
import { subscribeToGroups, subscribeToInvites, createGroup } from "./services/groupService";
import { API_BASE } from "../config";


if (window.location.pathname === "/code") {
  const root = document.getElementById("root");
  import("react-dom/client").then(({ createRoot }) => {
    createRoot(root).render(<EloriaCode />);
  });
}

export default function App() {
  const [stage, setStage] = useState("splash");
  const [user, setUser] = useState(null);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [chats, setChats] = useState([]);
const [activeChatId, setActiveChatId] = useState(null);
const [codeProjects, setCodeProjects] = useState([]);
const [activeProjectId, setActiveProjectId] = useState(null);

const [showPricing, setShowPricing] = useState(false);
const [userPlan, setUserPlan] = useState("free");
const [sharedData, setSharedData] = useState(null);
const [groups, setGroups] = useState([]);
const [activeGroupId, setActiveGroupId] = useState(null);
const [showGroupNotifs, setShowGroupNotifs] = useState(false);
const [pendingInviteCount, setPendingInviteCount] = useState(0);
const [mode, setMode] = useState("chat");

useEffect(() => {
  if (!activeChatId && chats.length > 0) {
    setActiveChatId(chats[0].id);
  }
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
    const firstChat = {
      id: Date.now(),
      title: "New Chat",
      messages: []
    };

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
      const res = await fetch(`${API_BASE}/api/membership/status`, {
        headers: { Authorization: `Bearer ${token}` }
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
  });

  return () => unsub();
}, [user]);

async function handleSaveShared(data) {
  if (!user) return;

  if (data.type === "chat") {
    const newChat = {
      id: Date.now(),
      title: `${data.title} (shared)`,
      messages: data.messages || [],
    };
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
  const project = {
    id: Date.now(),
    name: "New Project",
    files: []
  };

  setCodeProjects(prev => [...prev, project]);
  setActiveProjectId(project.id);
  setMode("codeWorkspace");
};

useEffect(() => {
  console.log("USER:", user);
}, [user]);

useEffect(() => {
  if (!chats.find(c => c.id === activeChatId)) {
    setActiveChatId(chats[0]?.id || null);
  }
}, [chats, activeChatId]);

useEffect(() => {
  if (window.innerWidth < 768) {
  setSidebarOpen(false);
}
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
  console.log("SIDEBAR STATE:", sidebarOpen);
}, [sidebarOpen]);

  // AUTH CHECK
  useEffect(() => {
const unsubscribe = checkAuth((u) => {
  setUser(u);

  if (!u) {
    setStage("login");
    setChats([]);
    setActiveChatId(null);
  } else {
    setStage("chat");
  }
});

  return unsubscribe;
}, []);

  // SAVE DATA
useEffect(() => {
  if (!user) return;

  // only save if chats are actually loaded
  if (chats === null || chats === undefined) return;

  saveChats(user.uid, chats);
}, [chats, user]);

  useEffect(() => {
    localStorage.setItem(
      "activeChatId",
      JSON.stringify(activeChatId)
    );
  }, [activeChatId]);


const activeChat = React.useMemo(() => {
  return chats.find(c => c.id === activeChatId) || null;
}, [chats, activeChatId]);


  // LOGIN SCREEN
  if (stage === "login") {
    return (
      <Login
        onLogin={(u) => {
  setUser(u);
  setStage("chat");

  setChats((prev) => {
    if (prev.length > 0) return prev;

    const firstChat = {
  id: Date.now(),
  title: "New Chat",
  messages: []
};

    setActiveChatId(firstChat.id);
    return [firstChat];
  });
}}
      />
    );
  }

  

  // CHAT SCREEN
 
if (showPricing) {
  return <Pricing onBack={() => setShowPricing(false)} />;
}

return (
  <div className="app-shell">

    {sidebarOpen && (
      <div
        className="mobile-overlay"
        onClick={() => setSidebarOpen(false)}
      />
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
  await logout();
  setUser(null);
  setChats([]);
  setActiveChatId(null);
  setMode("chat"); // ✅ FIXED HERE
  setStage("login");
}}
        groups={groups}
  activeGroupId={activeGroupId}
  setActiveGroupId={setActiveGroupId}
  pendingInviteCount={pendingInviteCount}
  setShowGroupNotifs={setShowGroupNotifs}
  userPlan={userPlan}
  mode={mode}
  setMode={setMode}
  createGroup={createGroup}
  setShowPricing={setShowPricing}
  createNewProject={createNewProject}
   codeProjects={codeProjects}
  activeProjectId={activeProjectId}
    />

<div className="app-main">
  {mode === "group" && activeGroupId ? (
    <GroupChat
      group={groups.find(g => g.id === activeGroupId)}
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
    />
  )}

  {showGroupNotifs && (
  <GroupNotifications
    user={user}
    onAccepted={(groupId) => {
      setActiveGroupId(groupId);
      setMode("group");
      setShowGroupNotifs(false);
    }}
    onClose={() => setShowGroupNotifs(false)}
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

  </div>
);
}
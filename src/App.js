import React, { useState, useEffect } from "react";
import "./App.css";
import "./mobile.css";

import EloriaCode from "./components/EloriaCode";
import EloriaWeb from "./components/EloriaWeb";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { loadChats, saveChats } from "./services/chatService";
import { checkAuth, logout } from "./services/auth";
import Pricing from "./components/Pricing";
import { auth } from "./services/firebase";
import { setOnlineStatus } from "./services/userService";
import SharedChatViewer from "./components/SharedChatViewer";
import { loadShared } from "./services/shareService";
import ProfileSetupModal from "./components/ProfileSetupModal";
import AuthCallback from "./components/AuthCallback";
import HyperFrame from "./components/HyperFrame";
import DownloadPage from "./components/Downloadpage";
import Billing from "./components/Billing";
import SettingsModal, { applyStoredTheme } from "./components/SettingsModal";
import AppSkeleton from "./components/AppSkeleton";

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

if (window.location.pathname === "/web") {
  import("react-dom/client").then(({ createRoot }) => {
    const root = createRoot(document.getElementById("root"));
    root.render(<EloriaWeb onBack={() => { window.location.href = "/"; }} />);
  });
}

export default function App() {
  const [stage, setStage]               = useState("splash");
  const [user, setUser]                 = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [chats, setChats]               = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [codeProjects, setCodeProjects]     = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [showPricing, setShowPricing]   = useState(false);
  const [showBilling, setShowBilling] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userPlan, setUserPlan]         = useState("free");
  const [sharedData, setSharedData]     = useState(null);
  const [mode, setMode]                 = useState("chat");
  const [chatsLoading, setChatsLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(true);

  useEffect(() => {
    applyStoredTheme();
  }, []);

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

  useEffect(() => {
    if (!activeChatId && chats.length > 0) setActiveChatId(chats[0].id);
  }, [chats, activeChatId]);

  useEffect(() => {
    if (!user?.uid) return;
    setChatsLoading(true);
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
      } finally {
        setChatsLoading(false);
      }
    };
    fetchChats();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setPlanLoading(true);
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
      } finally {
        setPlanLoading(false);
      }
    };
    fetchPlan();
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

  if (stage === "splash") {
    return <AppSkeleton />;
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
        onComplete={({ displayName }) => {
          setUser(prev => ({ ...prev, displayName, usernameSet: true }));
          setStage("chat");
        }}
      />
    );
  }

  if (showPricing) {
    return <Pricing onBack={() => setShowPricing(false)} />;
  }

  if (showBilling) {
  return <Billing onBack={() => setShowBilling(false)} />;
}

  if (stage === "chat" && chatsLoading) {
    return <AppSkeleton />;
  }

  return (
    <div className="app-shell">
      {sidebarOpen && (
        <div className="mobile-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} user={user} />

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
        userPlan={userPlan}
        mode={mode}
        setMode={setMode}
        setShowPricing={setShowPricing}
        setShowBilling={setShowBilling}
        setShowSettings={setShowSettings}
        createNewProject={createNewProject}
        codeProjects={codeProjects}
        activeProjectId={activeProjectId}
      />

      <div className="app-main">
        <ChatWindow
            user={user}
            chat={activeChat}
            setChats={setChats}
            setSidebarOpen={setSidebarOpen}
            setShowPricing={setShowPricing}
            setShowBilling={setShowBilling}
            setShowSettings={setShowSettings}
            userPlan={userPlan}
            planLoading={planLoading}
            allChats={chats}
          />

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
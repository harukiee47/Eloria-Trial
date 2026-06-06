import React, { useState, useEffect } from "react";
import "./App.css";
import "./mobile.css";

import SplashScreen from "./components/SplashScreen";
import Login from "./components/Login";
import Sidebar from "./components/Sidebar";
import ChatWindow from "./components/ChatWindow";
import { loadChats, saveChats } from "./services/chatService";


import { checkAuth } from "./services/auth";

export default function App() {
  const [stage, setStage] = useState("splash");
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // MOBILE SIDEBAR
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [chats, setChats] = useState([]);
const [activeChatId, setActiveChatId] = useState(null);

useEffect(() => {
  if (!activeChatId && chats.length > 0) {
    setActiveChatId(chats[0].id);
  }
}, [chats, activeChatId]);

  useEffect(() => {
  if (!user) return;

  const fetchChats = async () => {
    const data = await loadChats(user.uid);

    if (data && data.length > 0) {
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
  console.log("SIDEBAR STATE:", sidebarOpen);
}, [sidebarOpen]);

  // AUTH CHECK
  useEffect(() => {
  const unsubscribe = checkAuth((u) => {
    setUser(u);
    setLoading(false);
  });

  return unsubscribe;
}, []);

  // SAVE DATA
useEffect(() => {
  if (!user) return;
  if (!chats.length) return;

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


  // LOADING SCREEN
 if (loading && stage !== "splash") {
  return <div className="loading">Loading...</div>;
}
  // SPLASH SCREEN
  if (stage === "splash") {
    return (
      <SplashScreen
        onFinish={() => {
          setStage(user ? "chat" : "login");
        }}
      />
    );
  }

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
      onLogout={() => {
        setUser(null);
        setActiveChatId(null);
        setStage("login");
      }}
    />

    <div className="app-main">
      <ChatWindow
        user={user}
        chat={activeChat}
        setChats={setChats}
        setSidebarOpen={setSidebarOpen}
      />
    </div>

  </div>
);
}
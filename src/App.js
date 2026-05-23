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

useEffect(() => {
  if (!user) return;

  const fetchChats = async () => {
    const data = await loadChats(user.uid);

    if (data && data.length > 0) {
      setChats(data);
      setActiveChatId(data[0].id);
    } else {
      // create default chat if nothing exists
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
  if (!user || !chats) return;

  const save = async () => {
    await saveChats(user.uid, chats);
  };

  save();
}, [chats, user]);

  useEffect(() => {
    localStorage.setItem(
      "activeChatId",
      JSON.stringify(activeChatId)
    );
  }, [activeChatId]);

  const activeChat =
  chats.find((c) => c.id === activeChatId) ||
  chats[0] ||
  null;
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

  // AUTO CREATE FIRST CHAT IF EMPTY
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
  <div className="app-root">

      {/* MOBILE OVERLAY */}
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

<ChatWindow
  user={user}
  chat={activeChat}
  setChats={setChats}
  setSidebarOpen={setSidebarOpen}
/>

    </div>
  );
}
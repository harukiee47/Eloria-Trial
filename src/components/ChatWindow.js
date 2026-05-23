import React, { useState, useEffect, useRef } from "react";
import Message from "./Message";
import "../App.css";
import "../mobile.css";
import logo from "../assets/logo.png";
import { FaImage, FaMicrophone, FaFileAlt } from "react-icons/fa";

export default function ChatWindow({
  chat,
  setChats,
  setSidebarOpen,
}) {
  const [input, setInput] = useState("");
  const [showIntro, setShowIntro] = useState(true);
  const [isThinking, setIsThinking] = useState(false);

  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);

  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messages = chat?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);


useEffect(() => {
  setShowIntro(messages.length === 0);
}, [messages]);



  if (!chat) {
  return (
    <main className="chat-main">
      <div style={{ padding: 20, color: "white" }}>
        No chat selected
      </div>
    </main>
  );
}

  const handleFileUpload = (type) => {
  if (!fileInputRef.current) return;

  fileInputRef.current.value = ""; // IMPORTANT reset

  fileInputRef.current.setAttribute("accept", type);
  fileInputRef.current.click();
};

  const onFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setPendingFile({
      name: file.name,
      type: file.type,
      url: URL.createObjectURL(file),
    });

    setShowAttachMenu(false);
  };

  const sendMessage = async () => {
    if (!input.trim() && !pendingFile) return;
    if (isThinking) return;

    setIsThinking(true);

    const userMsg = {
  id: Date.now(),
  sender: "user",
  text: input,
  file: pendingFile ? {
    name: pendingFile.name,
    type: pendingFile.type.startsWith("image")
      ? "image"
      : pendingFile.type.startsWith("audio")
      ? "audio"
      : "file",
    url: pendingFile.url,
  } : null,
};

    const newMessages = [...messages, userMsg];

    setMessages(newMessages);
    setInput("");
    setPendingFile(null);

    setChats((prev) =>
  prev.map((c) => {
    if (c.id !== chat.id) return c;

    const isFirstMessage = !c.messages || c.messages.length === 0;

    return {
      ...c,
      messages: newMessages,
      title: isFirstMessage
        ? generateChatTitle(userMsg.text)
        : c.title,
    };
  })
);

    try {
      const res = await fetch("https://eloria-trial.onrender.com", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          file: pendingFile,
        }),
      });

      const data = await res.json();

      const aiMsg = {
        id: Date.now() + 1,
        sender: "ai",
        text: data?.reply || "Eloria couldn't respond.",
      };

      const finalMessages = [...newMessages, aiMsg];

      setMessages(finalMessages);

      setChats((prev) =>
  prev.map((c) => {
    if (c.id !== chat.id) return c;

    const isFirstMessage = !c.messages || c.messages.length === 0;

    return {
      ...c,
      messages: finalMessages,
      title: isFirstMessage
        ? generateChatTitle(userMsg.text)
        : c.title,
    };
  })
);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          id: Date.now() + 2,
          sender: "ai",
          text: "Eloria couldn't respond.",
        },
      ]);
    }

    setIsThinking(false);
  };
const generateChatTitle = (text) => {
  const stopWords = [
    "how","to","the","a","an","and","or","for","with",
    "of","in","on","is","are","can","i","you","me","my",
    "what","why","when","make","fix","create","write","about"
  ];

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(" ")
    .filter(word => word && !stopWords.includes(word))
    .slice(0, 4)
    .join(" ")
    .replace(/\b\w/g, c => c.toUpperCase());
};
 
const regenerateMessage = async (messageId) => {
  const msgIndex = messages.findIndex(m => m.id === messageId);
  if (msgIndex === -1) return;

  const previousMessages = messages.slice(0, msgIndex);

  const lastUserMsg = [...previousMessages]
    .reverse()
    .find(m => m.sender === "user");

  if (!lastUserMsg) return;

  setIsThinking(true);

  try {
    const res = await fetch("http://localhost:5001/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: lastUserMsg.text,
      }),
    });

    const data = await res.json();

    const newMessages = [
      ...previousMessages,
      {
        id: Date.now(),
        sender: "ai",
        text: data?.reply || "No response",
      },
    ];

    setMessages(newMessages);

    setChats(prev =>
      prev.map(c =>
        c.id === chat.id
          ? { ...c, messages: newMessages }
          : c
      )
    );

  } catch (err) {
    console.log("Regenerate error:", err);
  }

  setIsThinking(false);
};

return (
  <main
  className="chat-main"
>

    <header className="chat-header">

  {/* LEFT SIDE */}
  <div className="header-left">

  <button
  className="mobile-menu-btn"
  onClick={() => setSidebarOpen(true)}
>
  ☰
</button>
    <img src={logo} alt="Eloria" className="header-logo" />

    <div className="header-title">
      <h2>Eloria AI</h2>
      <span>By Kairox</span>
    </div>
  </div>

  {/* RIGHT SIDE */}
  <button className="upgrade-btn glow-sweep">
    Upgrade
  </button>

</header>

    {/* CHAT AREA */}
{showIntro ? (
  <div className="intro-wrapper">
    <div className="intro-content">
      
      <img src={logo} className="intro-logo" alt="logo" />

      <div className="intro-cards">
        <div className="intro-card" onClick={() => setInput("Make me an assignment")}>
          Make me an assignment
        </div>

        <div className="intro-card" onClick={() => setInput("Business idea for students")}>
          Business idea for students
        </div>

        <div className="intro-card" onClick={() => setInput("Write viral YouTube script")}>
          Viral YouTube script idea
        </div>
      </div>

    </div>
  </div>
) : (
  <div className="messages">
    {messages.map((msg) => (
      <Message
  key={msg.id}
  sender={msg.sender}
  text={msg.text}
  file={msg.file}
  onCopy={() => navigator.clipboard.writeText(msg.text)}
  onRegenerate={() => regenerateMessage(msg.id)}
/>
    ))}

    {isThinking && (
      <div className="thinking-text">Eloria is thinking...</div>
    )}

    <div ref={messagesEndRef} />
  </div>
)}
    {/* INPUT (ALWAYS OUTSIDE chat-body) */}
    <div className="chat-input-row">

  {/* LEFT: ATTACH BUTTON */}
  <div className="attach-wrapper">
    <button
      className="plus-btn"
      onClick={() => setShowAttachMenu(!showAttachMenu)}
    >
      +
    </button>

    {showAttachMenu && (
      <div className="attach-menu">
        <div onClick={() => handleFileUpload("image/*")}>
          <FaImage /> Image
        </div>

        <div onClick={() => handleFileUpload("audio/*")}>
          <FaMicrophone /> Audio
        </div>

        <div onClick={() => handleFileUpload("*")}>
          <FaFileAlt /> File
        </div>
      </div>
    )}

  </div>

  {/* FILE PREVIEW */}
  {pendingFile && (
    <div className="file-preview">
      {pendingFile.type.startsWith("image") ? (
        <img src={pendingFile.url} alt="preview" />
      ) : (
        <div className="file-chip">
          📎 {pendingFile.name}
        </div>
      )}

      <button
        className="remove-file"
        onClick={() => setPendingFile(null)}
      >
        ✕
      </button>
    </div>
  )}

  {/* CENTER INPUT */}
  <textarea
  className="chat-input"
  value={input}
  placeholder="Message Eloria..."
  onChange={(e) => setInput(e.target.value)}
  onKeyDown={(e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }}
/>

  {/* RIGHT SEND BUTTON */}
  <button className="send-btn" onClick={sendMessage}>
    ➤
  </button>

</div>

<input
  type="file"
  ref={fileInputRef}
  style={{ display: "none" }}
  onChange={onFileChange}
/>

</main>
  );
}


import React from "react";
import { FaImage, FaMicrophone, FaFileAlt } from "react-icons/fa";

export default function Message({
  sender,
  text,
  file,
  typing,
  onCopy,
  onRegenerate
}) {
  const isUser = sender === "user";

  return (
    <div className={`msg-row ${isUser ? "right" : "left"}`}>

      <div className={`bubble ${isUser ? "user" : "ai"}`}>

        {/* FILES */}
        {file?.type === "image" && (
          <img src={file.url} alt={file.name} className="msg-img" />
        )}

        {file?.type === "audio" && (
          <audio controls src={file.url} />
        )}

        {file?.type === "file" && (
          <a href={file.url} target="_blank" rel="noreferrer">
            {file.name}
          </a>
        )}

        {/* TEXT */}
        {typing ? (
          <div className="typing-dots">
            <span></span><span></span><span></span>
          </div>
        ) : (
          text && <div className="msg-text">{text}</div>
        )}

        {/* ACTIONS (ONLY AI) */}
        {!isUser && !typing && (
          <div className="msg-actions">

            <button className="icon-btn" onClick={onCopy} title="Copy">
              <FiCopy />
            </button>

            <button className="icon-btn" onClick={onRegenerate} title="Regenerate">
              <FiRefreshCw />
            </button>

          </div>
        )}

      </div>
    </div>
  );
}
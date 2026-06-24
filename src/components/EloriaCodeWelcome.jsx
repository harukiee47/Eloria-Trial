import React, { useState, useEffect } from "react";

const STORAGE_KEY = "eloria_code_welcomed";

const bootLines = [
  "Initializing Eloria Code...",
  "Loading workspace environment...",
  "Mounting file system...",
  "Ready.",
];

export default function EloriaCodeWelcome({ onDismiss, userName }) {
  const [visibleLines, setVisibleLines] = useState([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [fading, setFading] = useState(false);

  const firstName = userName ? userName.split(" ")[0] : null;

  // Boot sequence: reveal lines one by one
  useEffect(() => {
    let i = 0;
    const next = () => {
      if (i < bootLines.length) {
        const line = bootLines[i];
        i++;
        setVisibleLines((prev) => [...prev, line]);
        setTimeout(next, line === "Ready." ? 600 : 480);
      } else {
        setTimeout(() => setShowPrompt(true), 300);
      }
    };
    const t = setTimeout(next, 300);
    return () => clearTimeout(t);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setFading(true);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#0c0c0c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
        opacity: fading ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
    >
      {/* Terminal window */}
      <div
        style={{
          width: "min(600px, 90vw)",
          border: "1px solid #2a2a2a",
          borderRadius: 6,
          overflow: "hidden",
          background: "#111",
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: "#1a1a1a",
            borderBottom: "1px solid #2a2a2a",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a", display: "inline-block" }} />
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a", display: "inline-block" }} />
          <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#3a3a3a", display: "inline-block" }} />
          <span style={{ marginLeft: 8, color: "#444", fontSize: 12, letterSpacing: 1 }}>
            eloria-code — bash
          </span>
        </div>

        {/* Terminal body */}
        <div style={{ padding: "24px 28px 28px", minHeight: 240 }}>
          {/* Boot lines */}
          {visibleLines.map((line, i) => (
            <div key={i} style={{ marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ color: "#fffaec", fontSize: 13 }}>
                {line === "Ready." ? "✓" : "›"}
              </span>
              <span
                style={{
                  color: line === "Ready." ? "#fffaec" : "#888",
                  fontSize: 13,
                  letterSpacing: 0.3,
                }}
              >
                {line}
              </span>
            </div>
          ))}

          {/* Main prompt block */}
          {showPrompt && (
            <div style={{ marginTop: 28 }}>
              {/* Greeting */}
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#555", fontSize: 13 }}>$ </span>
                <span style={{ color: "#ccc", fontSize: 13 }}>
                  whoami
                </span>
              </div>
              <div style={{ marginBottom: 20, paddingLeft: 16 }}>
                <span style={{ color: "#fffaec", fontSize: 13 }}>
                  {firstName ? firstName : "developer"}
                </span>
              </div>

              {/* Welcome message */}
              <div style={{ marginBottom: 4 }}>
                <span style={{ color: "#555", fontSize: 13 }}>$ </span>
                <span style={{ color: "#ccc", fontSize: 13 }}>echo "Welcome"</span>
              </div>
              <div style={{ marginBottom: 28, paddingLeft: 16 }}>
                <p style={{ margin: 0, color: "#eee", fontSize: 15, fontWeight: 600 }}>
                  Welcome to <span style={{ color: "#fffaec" }}>Eloria Code.</span>
                </p>
                <p style={{ margin: "4px 0 0", color: "#666", fontSize: 12 }}>
                  Your coding journey begins here.
                </p>
              </div>

              {/* Action prompt */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: "#555", fontSize: 13 }}>$ </span>
                <span style={{ color: "#ccc", fontSize: 13 }}>eloria start</span>
              </div>

              <button
                onClick={handleDismiss}
                style={{
                  marginLeft: 16,
                  background: "none",
                  border: "1px solid #333",
                  borderRadius: 4,
                  padding: "8px 20px",
                  color: "#fffaec",
                  fontSize: 13,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  letterSpacing: 0.5,
                  transition: "border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = "#fffaec";
                  e.target.style.background = "rgba(212,175,55,0.06)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = "#333";
                  e.target.style.background = "none";
                }}
              >
                [ enter ]
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
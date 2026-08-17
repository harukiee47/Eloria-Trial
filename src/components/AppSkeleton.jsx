import React from "react";

/*
  Shown while auth/session is resolving and while the user's chats are
  being fetched from the server. Mirrors the real app-shell layout
  (icon strip + chat list panel + chat window) so there's no layout
  jump when the real content pops in — and it reads as "app is loading",
  not "you have no chats" or "server is slow".
*/

const styleTag = `
  @keyframes skShimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .sk-shimmer {
    background: linear-gradient(
      90deg,
      var(--border-soft, #dde0d9) 0%,
      var(--bg-card, #fff) 50%,
      var(--border-soft, #dde0d9) 100%
    );
    background-size: 800px 100%;
    animation: skShimmer 1.4s ease-in-out infinite;
    border-radius: 8px;
  }
  .sk-shell {
    display: flex;
    height: 100vh;
    width: 100vw;
    background: var(--bg-app, #f5f0ea);
    overflow: hidden;
  }
  .sk-strip {
    width: var(--strip-w, 64px);
    flex-shrink: 0;
    background: var(--bg-strip, #ede8e1);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    gap: 20px;
  }
  .sk-panel {
    width: var(--panel-w, 272px);
    flex-shrink: 0;
    background: var(--bg-panel, #fdfaf6);
    border-right: 1px solid var(--border-soft, #dde0d9);
    padding: 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .sk-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--bg-chat, #FBF6F0);
  }
  .sk-header {
    height: 56px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    border-bottom: 1px solid var(--border-soft, #dde0d9);
  }
  .sk-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 14px;
  }
  @media (max-width: 767px) {
    .sk-panel { display: none; }
  }
`;

export default function AppSkeleton() {
  return (
    <div className="sk-shell">
      <style>{styleTag}</style>

      <div className="sk-strip">
        <div className="sk-shimmer" style={{ width: 32, height: 32, borderRadius: 10 }} />
        <div className="sk-shimmer" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div className="sk-shimmer" style={{ width: 28, height: 28, borderRadius: 8 }} />
        <div style={{ flex: 1 }} />
        <div className="sk-shimmer" style={{ width: 30, height: 30, borderRadius: "50%" }} />
      </div>

      <div className="sk-panel">
        <div className="sk-shimmer" style={{ width: "100%", height: 36, borderRadius: 10, marginBottom: 8 }} />
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="sk-shimmer"
            style={{ width: `${85 - (i % 3) * 12}%`, height: 16 }}
          />
        ))}
      </div>

      <div className="sk-main">
        <div className="sk-header">
          <div className="sk-shimmer" style={{ width: 120, height: 20 }} />
          <div className="sk-shimmer" style={{ width: 70, height: 26, borderRadius: 20 }} />
        </div>
        <div className="sk-body">
          <div className="sk-shimmer" style={{ width: 44, height: 44, borderRadius: 12 }} />
          <div className="sk-shimmer" style={{ width: 180, height: 12 }} />
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --font: 'DM Sans', system-ui, sans-serif;
    --bg:          #f5f0ea;
    --bg-card:     #fdfaf6;
    --border:      var(--border-soft, #cdd0c9);
    --border-soft: var(--border-soft, #dde0d9);
    --t1: var(--t1, #0d3a35);
    --t2: var(--t2, #3a5a55);
    --t3: var(--t3, #7a8a84);
    --green-dark:  var(--t1, #0d3a35);
    --green-mid:   var(--accent, #1d6152);
    --r-md: 10px;
    --r-lg: 16px;
    --r-xl: 24px;
  }

  html, body, #root {
    min-height: 100vh;
    font-family: var(--font);
    background: var(--bg);
    color: var(--t1);
  }

  .dl-shell {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  /* TOPBAR */
  .dl-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 40px;
    height: 56px;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-soft);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  .dl-brand {
    display: flex;
    align-items: center;
    gap: 9px;
    text-decoration: none;
  }
  .dl-brand-logo {
    width: 28px; height: 28px;
    border-radius: 7px;
    background: linear-gradient(145deg, var(--green-dark), var(--green-mid));
    display: flex; align-items: center; justify-content: center;
  }
  .dl-brand-logo svg { width: 14px; height: 14px; color: #fff; }
  .dl-brand-name { font-size: 14px; font-weight: 700; color: var(--t1); letter-spacing: -.02em; }
  .dl-back {
    display: flex; align-items: center; gap: 5px;
    font-size: 13px; font-weight: 500; color: var(--t3);
    background: none; border: none; cursor: pointer;
    font-family: var(--font);
    padding: 5px 8px; border-radius: 6px;
    transition: background .12s, color .12s;
    text-decoration: none;
  }
  .dl-back:hover { background: var(--bg-card, #eeece8); color: var(--t1); }
  .dl-back svg { width: 14px; height: 14px; }

  /* PAGE */
  .dl-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 64px 24px 72px;
  }

  /* EMBLEM */
  .dl-emblem {
    width: 68px; height: 68px;
    border-radius: 18px;
    background: linear-gradient(145deg, var(--green-dark), var(--green-mid));
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 22px;
    position: relative;
  }
  .dl-emblem svg { width: 32px; height: 32px; color: #fff; opacity: .9; }
  .dl-emblem-ring {
    position: absolute;
    inset: -5px;
    border-radius: 23px;
    border: 1.5px solid rgba(39,97,82,.15);
  }

  /* HEADING */
  .dl-heading { text-align: center; margin-bottom: 40px; }
  .dl-heading h1 {
    font-size: 34px; font-weight: 700; letter-spacing: -.03em;
    color: var(--t1); line-height: 1.15; margin-bottom: 10px;
  }
  .dl-heading h1 span {
    background: linear-gradient(135deg, var(--green-dark), var(--green-mid));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .dl-heading p { font-size: 15px; color: var(--t2); line-height: 1.6; }

  /* CARD */
  .dl-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--r-xl);
    width: 100%;
    max-width: 400px;
    overflow: hidden;
    box-shadow: 0 2px 20px rgba(13,58,53,.07);
  }

  .dl-card-header {
    background: linear-gradient(135deg, var(--green-dark), var(--green-mid));
    padding: 22px 24px 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    position: relative;
    overflow: hidden;
  }
  .dl-card-header::before {
    content: "";
    position: absolute;
    top: -30px; right: -30px;
    width: 120px; height: 120px;
    border-radius: 50%;
    background: rgba(255,255,255,.05);
    pointer-events: none;
  }
  .dl-os-icon {
    width: 40px; height: 40px;
    background: rgba(255,255,255,.12);
    border: 1px solid rgba(255,255,255,.16);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .dl-os-icon svg { width: 20px; height: 20px; color: #fff; }
  .dl-os-name { font-size: 16px; font-weight: 700; color: #fff; letter-spacing: -.02em; line-height: 1.2; }
  .dl-os-ver { font-size: 11.5px; color: rgba(255,255,255,.55); margin-top: 2px; }

  .dl-card-body { padding: 22px 24px 26px; }

  /* DOWNLOAD BUTTON */
  .dl-btn {
    width: 100%;
    display: flex; align-items: center;
    gap: 10px;
    padding: 11px 14px;
    background: linear-gradient(135deg, var(--green-dark), var(--green-mid));
    border: none; border-radius: var(--r-md);
    color: #fff; cursor: pointer;
    font-family: var(--font);
    box-shadow: 0 3px 14px rgba(13,58,53,.20);
    transition: opacity .14s, transform .14s;
    text-decoration: none;
    position: relative;
    overflow: hidden;
  }
  .dl-btn::before {
    content: "";
    position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.07) 0%, transparent 60%);
    pointer-events: none;
  }
  .dl-btn:hover { opacity: .87; transform: translateY(-1px); }
  .dl-btn:active { transform: translateY(0); }
  .dl-btn-icon {
    width: 32px; height: 32px;
    background: rgba(255,255,255,.12);
    border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
    border: 1px solid rgba(255,255,255,.13);
  }
  .dl-btn-icon svg { width: 15px; height: 15px; color: #fff; }
  .dl-btn-text { flex: 1; text-align: left; }
  .dl-btn-label { font-size: 13.5px; font-weight: 700; color: #fff; display: block; letter-spacing: -.01em; }
  .dl-btn-sub { font-size: 11px; color: rgba(255,255,255,.58); display: block; margin-top: 1px; }
  .dl-btn-arrow { flex-shrink: 0; }
  .dl-btn-arrow svg { width: 15px; height: 15px; color: rgba(255,255,255,.65); }

  @media (max-width: 520px) {
    .dl-topbar { padding: 0 16px; }
    .dl-page { padding: 48px 16px 56px; }
    .dl-card-header { padding: 18px 18px 16px; }
    .dl-card-body { padding: 18px 18px 22px; }
  }
`;

export default function DownloadPage() {
  const [clicked, setClicked] = useState(false);

  // ── Replace this with your real .exe download URL ──
  const DOWNLOAD_URL = "https://PLACEHOLDER_WINDOWS_DOWNLOAD_URL";

  const handleDownload = (e) => {
    e.preventDefault();
    setClicked(true);
    window.location.href = DOWNLOAD_URL;
    setTimeout(() => setClicked(false), 3000);
  };

  const IconCode = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  );
  const IconWindows = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-13.051-1.801"/>
    </svg>
  );
  const IconDownload = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  );
  const IconCheck = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  const IconArrow = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
  const IconChevronLeft = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6"/>
    </svg>
  );

  return (
    <>
      <style>{STYLE}</style>
      <div className="dl-shell">

        <header className="dl-topbar">
          <a className="dl-brand" href="/">
            <div className="dl-brand-logo"><IconCode /></div>
            <span className="dl-brand-name">Eloria AI</span>
          </a>
          <a className="dl-back" href="/">
            <IconChevronLeft /> Back to app
          </a>
        </header>

        <main className="dl-page">
          <div className="dl-emblem">
            <div className="dl-emblem-ring" />
            <IconCode />
          </div>

          <div className="dl-heading">
            <h1>Eloria AI for <span>Windows</span></h1>
            <p>The full Eloria experience as a native desktop app.<br />Faster, always on hand, out of your browser's way.</p>
          </div>

          <div className="dl-card">
            <div className="dl-card-header">
              <div className="dl-os-icon"><IconWindows /></div>
              <div>
                <div className="dl-os-name">Windows</div>
                <div className="dl-os-ver">Version 1.0 · 64-bit installer</div>
              </div>
            </div>

            <div className="dl-card-body">
              <a
                className="dl-btn"
                href={DOWNLOAD_URL}
                onClick={handleDownload}
                aria-label="Download Eloria AI for Windows"
              >
                <div className="dl-btn-icon">
                  {clicked ? <IconCheck /> : <IconDownload />}
                </div>
                <div className="dl-btn-text">
                  <span className="dl-btn-label">
                    {clicked ? "Starting download…" : "Download for Windows"}
                  </span>
                  <span className="dl-btn-sub">
                    {clicked ? "Check your Downloads folder" : "EloriaSetup-1.0.0.exe"}
                  </span>
                </div>
                {!clicked && (
                  <div className="dl-btn-arrow"><IconArrow /></div>
                )}
              </a>
            </div>
          </div>
        </main>

      </div>
    </>
  );
}
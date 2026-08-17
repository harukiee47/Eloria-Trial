import React, { useState, useMemo } from "react";

/**
 * Slide-in panel (from the right) for viewing/downloading code the AI generated.
 * - If the file set includes an .html file, shows a live iframe Preview tab that
 *   inlines any .css/.js files from the same set.
 * - Otherwise Preview is unavailable and it opens straight to Code, same as
 *   Claude's artifact panel behavior for non-renderable languages.
 * - Single file -> "Download" button. Multiple files -> "Download all (.zip)"
 *   using JSZip, generated client-side.
 *
 * Props:
 *   files: [{ name, code, ext, lang }]
 *   onClose: () => void
 */
export default function CodeFilesPanel({ files, onClose }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const hasHtml = useMemo(() => files.some(f => f.ext === "html"), [files]);
  const [tab, setTab] = useState(hasHtml ? "preview" : "code");
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  const active = files[activeIdx] || files[0];

  const previewSrcDoc = useMemo(() => {
    if (!hasHtml) return "";
    const htmlFile = files.find(f => f.ext === "html");
    let html = htmlFile.code;
    const cssBlock = files.filter(f => f.ext === "css").map(f => f.code).join("\n");
    const jsBlock = files.filter(f => f.ext === "js").map(f => f.code).join("\n");
    if (cssBlock) {
      html = html.includes("</head>")
        ? html.replace("</head>", `<style>${cssBlock}</style></head>`)
        : `<style>${cssBlock}</style>${html}`;
    }
    if (jsBlock) {
      html = html.includes("</body>")
        ? html.replace("</body>", `<script>${jsBlock}</script></body>`)
        : `${html}<script>${jsBlock}</script>`;
    }
    return html;
  }, [files, hasHtml]);

  async function handleCopy() {
    await navigator.clipboard.writeText(active.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function downloadSingle(f) {
    const blob = new Blob([f.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = f.name; a.click();
    URL.revokeObjectURL(url);
  }

  async function handleDownload() {
    if (files.length === 1) {
      downloadSingle(files[0]);
      return;
    }
    setZipping(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      files.forEach(f => zip.file(f.name, f.code));
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "eloria-files.zip"; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Zip failed:", e);
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="cfp-overlay" onClick={onClose}>
      <style>{CFP_CSS}</style>
      <div className="cfp-panel" onClick={(e) => e.stopPropagation()}>
        <div className="cfp-header">
          <div className="cfp-tabs">
            <button className={`cfp-tab ${tab === "preview" ? "active" : ""}`} disabled={!hasHtml} onClick={() => setTab("preview")}>
              Preview
            </button>
            <button className={`cfp-tab ${tab === "code" ? "active" : ""}`} onClick={() => setTab("code")}>
              Code
            </button>
          </div>
          <button className="cfp-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {tab === "code" && files.length > 1 && (
          <div className="cfp-filetabs">
            {files.map((f, i) => (
              <button key={i} className={`cfp-filetab ${i === activeIdx ? "active" : ""}`} onClick={() => setActiveIdx(i)}>
                {f.name}
              </button>
            ))}
          </div>
        )}

        <div className="cfp-body">
          {tab === "preview" && hasHtml && (
            <iframe title="preview" className="cfp-iframe" srcDoc={previewSrcDoc} sandbox="allow-scripts allow-forms" />
          )}
          {tab === "code" && (
            <pre className="cfp-code"><code>{active.code}</code></pre>
          )}
        </div>

        <div className="cfp-footer">
          <span className="cfp-filename">{files.length > 1 ? `${files.length} files` : active.name}</span>
          <div className="cfp-actions">
            {tab === "code" && (
              <button className="cfp-btn cfp-btn-outline" onClick={handleCopy}>{copied ? "Copied" : "Copy"}</button>
            )}
            <button className="cfp-btn" onClick={handleDownload} disabled={zipping}>
              {zipping ? "Zipping…" : files.length > 1 ? "Download all (.zip)" : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const CFP_CSS = `
.cfp-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,.25); z-index: 950;
  display: flex; justify-content: flex-end;
  animation: cfpFade .16s ease;
}
@keyframes cfpFade { from { opacity: 0; } to { opacity: 1; } }
.cfp-panel {
  width: min(560px, 92vw); height: 100%; background: var(--bg-panel);
  border-left: 1px solid var(--border-soft); display: flex; flex-direction: column;
  box-shadow: -16px 0 40px rgba(0,0,0,.18);
  animation: cfpSlide .22s cubic-bezier(.2,.8,.2,1);
}
@keyframes cfpSlide { from { transform: translateX(100%); } to { transform: translateX(0); } }
.cfp-header { display:flex; align-items:center; justify-content:space-between; padding: 12px 14px; border-bottom: 1px solid var(--border-soft); }
.cfp-tabs { display:flex; gap: 4px; background: var(--bg-card-2); padding: 4px; border-radius: 10px; border: 1px solid var(--border-soft); }
.cfp-tab { border:none; background:none; padding: 6px 14px; font-size: 12.5px; font-weight:600; color: var(--t2); border-radius: 7px; cursor: pointer; font-family: var(--font); transition: background .14s, color .14s; }
.cfp-tab:hover:not(:disabled):not(.active) { color: var(--t1); }
.cfp-tab.active { background: var(--bg-card); color: var(--accent); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
.cfp-tab:disabled { opacity: .4; cursor: not-allowed; }
.cfp-close { border:none; background:none; width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; color: var(--t3); cursor:pointer; transition: background .14s, color .14s; }
.cfp-close:hover { background: var(--accent-bg); color: var(--accent); }
.cfp-close svg { width: 15px; height: 15px; }
.cfp-filetabs { display:flex; gap: 4px; padding: 8px 14px 0; overflow-x: auto; flex-shrink: 0; }
.cfp-filetab { border: 1px solid var(--border-soft); background: var(--bg-card); color: var(--t2); font-family: var(--font); font-size: 11.5px; font-weight: 600; padding: 6px 11px; border-radius: 8px 8px 0 0; cursor: pointer; white-space: nowrap; }
.cfp-filetab.active { background: var(--bg-card-2); color: var(--t1); border-bottom-color: transparent; }
.cfp-body { flex: 1; overflow: hidden; display: flex; }
.cfp-iframe { flex: 1; border: none; background: #fff; }
.cfp-code { flex: 1; margin: 0; padding: 16px; overflow: auto; font-family: 'SF Mono', Consolas, monospace; font-size: 12.5px; line-height: 1.6; color: var(--t1); background: var(--bg-card-2); }
.cfp-footer { display:flex; align-items:center; justify-content: space-between; padding: 10px 14px; border-top: 1px solid var(--border-soft); }
.cfp-filename { font-size: 12px; color: var(--t3); font-family: var(--font); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cfp-actions { display: flex; gap: 8px; flex-shrink: 0; }
.cfp-btn { border:none; background: var(--accent); color: var(--accent-fg); font-family:var(--font); font-weight:600; font-size:12.5px; padding:7px 14px; border-radius:9px; cursor:pointer; transition: background .14s, transform .12s; }
.cfp-btn:hover:not(:disabled) { background: var(--accent-deep); transform: translateY(-1px); }
.cfp-btn:disabled { opacity: .6; cursor: default; }
.cfp-btn-outline { background: none; color: var(--t2); border: 1px solid var(--border); }
.cfp-btn-outline:hover:not(:disabled) { background: var(--bg-card-2); transform: none; }
@media (max-width: 640px) {
  .cfp-panel { width: 100vw; }
}
`;

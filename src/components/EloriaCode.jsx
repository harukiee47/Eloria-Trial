import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../services/firebase";
import logo from "../assets/logo.png";
import EloriaCodeWelcome from "./EloriaCodeWelcome";
import MarkdownMessage from "./MarkdownMessage";
import "./MarkdownMessage.css";
import { invoke } from "@tauri-apps/api/core";

// ─── SUPPORTED EXTENSIONS ─────────────────────────────────────────────────────
const SUPPORTED_EXTS = new Set([
  "js","jsx","ts","tsx","mjs","cjs",
  "html","htm","css","scss","sass","less",
  "json","jsonc","json5",
  "py","rb","php","go","rs","java","kt","swift","c","cpp","cc","h","hpp",
  "cs","vb","fs","fsx",
  "sh","bash","zsh","fish","ps1",
  "sql","graphql","gql",
  "md","mdx","txt","yaml","yml","toml","env","ini","conf","config",
  "vue","svelte","astro",
  "xml","svg","wasm",
  "dockerfile","makefile","gitignore","editorconfig","prettierrc","eslintrc","babelrc",
]);

function isSupportedFile(name) {
  const lower = name.toLowerCase();
  const knownNames = ["dockerfile","makefile",".gitignore",".editorconfig",".prettierrc",".eslintrc",".babelrc",".env"];
  if (knownNames.some(n => lower === n || lower.endsWith("/" + n))) return true;
  const parts = lower.split(".");
  if (parts.length < 2) return false;
  return SUPPORTED_EXTS.has(parts[parts.length - 1]);
}

function getExtLabel(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? "." + parts[parts.length - 1] : "file";
}

function getExt(name) {
  const parts = (name || "").split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function formatBytes(bytes) {
  if (!bytes) return "0B";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFileIcon(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  const map = {
    js:"⬡",jsx:"⬡",ts:"⬡",tsx:"⬡",
    html:"◈",htm:"◈",
    css:"◉",scss:"◉",sass:"◉",less:"◉",
    json:"⊞",yaml:"⊞",yml:"⊞",toml:"⊞",
    py:"◆",rb:"◆",php:"◆",go:"◆",rs:"◆",
    md:"≡",mdx:"≡",txt:"≡",
    sql:"⊕",graphql:"⊕",
    sh:"▸",bash:"▸",zsh:"▸",
  };
  return map[ext] || "◇";
}

function getMime(ext) {
  const map = {
    html:"text/html", htm:"text/html", css:"text/css", js:"text/javascript",
    jsx:"text/javascript", ts:"text/typescript", tsx:"text/typescript",
    json:"application/json", py:"text/x-python", md:"text/markdown",
  };
  return map[ext] || "text/plain";
}

function downloadFile(filename, code) {
  if (!code) return;
  const ext = getExt(filename);
  const blob = new Blob([code], { type: getMime(ext) + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function titleCaseFromName(filename) {
  const base = (filename || "").split("/").pop().split(".")[0];
  const spaced = base.replace(/[-_]+/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  return spaced.split(" ").filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(" ");
}
function taskTitleForFile(filename) {
  if (!filename) return "Untitled task";
  if (filename.toLowerCase().includes("prd")) return "Create Implementation Plan";
  const title = titleCaseFromName(filename);
  return `Build ${title}`;
}
const TASK_STATUS_LABEL = { pending: "Pending", in_progress: "In Progress", done: "Ready for Review" };

function generatePRDMarkdown(project, requestText) {
  const name = project?.name || "this project";
  const desc = project?.description ? `\n\n${project.description}` : "";
  const ask = requestText ? `\n\n**Request:** ${requestText}` : "";
  return `# ${name}\n\nImplementation plan for ${name}.${desc}${ask}\n\n## Tasks\n\n- Set up base structure\n- Build core files\n- Wire up styling and behavior\n- Review and polish\n\n## Status\n\nDrafted — ready to start building.`;
}

// ─── SYNTAX HIGHLIGHTING ──────────────────────────────────────────────────────
function syntaxHighlight(code, ext) {
  if (!code) return "";
  const escape = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  let html = escape(code);
  const jsFamily = ["js","jsx","ts","tsx","mjs","cjs"];
  const kwJS = /\b(const|let|var|function|return|if|else|for|while|class|import|export|default|from|async|await|new|this|typeof|instanceof|try|catch|throw|null|undefined|true|false|interface|type|enum|extends|implements|readonly|public|private|protected)\b/g;
  const kwPy = /\b(def|class|import|from|return|if|elif|else|for|while|try|except|with|as|pass|break|continue|True|False|None|and|or|not|in|is|lambda|yield|raise|global|nonlocal)\b/g;
  const kw = jsFamily.includes(ext) ? kwJS : ext === "py" ? kwPy : null;
  html = html.replace(/(&quot;[^&]*?&quot;|&#x27;[^&]*?&#x27;|`[^`]*?`)/g, m => `<span style="color:#aaa">${m}</span>`);
  html = html.replace(/(\/\/[^\n]*|\/\*[\s\S]*?\*\/|#[^\n]*)/g, m => `<span style="color:#555;font-style:italic">${m}</span>`);
  if (kw) html = html.replace(kw, m => `<span style="color:#e4e4e4;font-weight:600">${m}</span>`);
  html = html.replace(/\b(\d+\.?\d*)\b/g, m => `<span style="color:#ccc">${m}</span>`);
  if (ext === "css" || ext === "scss") html = html.replace(/([a-z-]+)(\s*:)/g, (_, p, c) => `<span style="color:#ddd">${p}</span>${c}`);
  return html;
}

// ─── FILE PARSER ──────────────────────────────────────────────────────────────
function parseFilesFromAI(text) {
  const files = [];
  const seen = new Set();
  const fenceRe = /```([^\n]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = fenceRe.exec(text)) !== null) {
    const meta = m[1].trim();
    const code = m[2];
    const fnMatch = meta.match(/([^\s]+\.[a-zA-Z0-9]+)/);
    if (fnMatch && !seen.has(fnMatch[1].toLowerCase())) {
      files.push({ name: fnMatch[1], code, lang: meta.split(/\s/)[0] || "" });
      seen.add(fnMatch[1].toLowerCase());
      continue;
    }
    const firstLine = code.split("\n")[0].trim();
    const commentFile = firstLine.match(/(?:\/\/|#|<!--|\/\*)\s*([^\s*]+\.[a-zA-Z0-9]+)/);
    if (commentFile && !seen.has(commentFile[1].toLowerCase())) {
      files.push({ name: commentFile[1], code, lang: meta });
      seen.add(commentFile[1].toLowerCase());
      continue;
    }
    if (meta && !fnMatch) {
      const ext = meta.toLowerCase().replace(/[^a-z]/g,"");
      const extMap = { javascript:"app.js", typescript:"app.ts", python:"main.py", css:"styles.css", html:"index.html", jsx:"app.jsx", tsx:"app.tsx" };
      if (extMap[ext] && !seen.has(extMap[ext])) {
        files.push({ name: extMap[ext], code, lang: meta });
        seen.add(extMap[ext]);
      }
    }
  }
  return files;
}

// ─── FINAL PREVIEW BUILDER ───────────────────────────────────────────────────
function buildFinalPreviewDoc(files) {
  const codeFiles = (files || []).filter(f => !f.isPlan && f.code);
  const htmlFile = codeFiles.find(f => ["html", "htm"].includes(getExt(f.name)));
  if (!htmlFile) return null;

  const cssFiles = codeFiles.filter(f => ["css", "scss", "sass", "less"].includes(getExt(f.name)));
  const jsFiles  = codeFiles.filter(f => ["js", "mjs", "cjs"].includes(getExt(f.name)));

  let doc = htmlFile.code;

  // Strip any <link> tags pointing at our own css files so they don't 404 / double-load
  cssFiles.forEach(f => {
    const safeName = f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`<link[^>]*href=["'][^"']*${safeName}["'][^>]*>`, "gi");
    doc = doc.replace(re, "");
  });

  // Strip any <script src="..."> tags pointing at our own js files
  jsFiles.forEach(f => {
    const safeName = f.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`<script[^>]*src=["'][^"']*${safeName}["'][^>]*></script>`, "gi");
    doc = doc.replace(re, "");
  });

  const styleTags  = cssFiles.map(f => `<style data-file="${f.name}">\n${f.code}\n</style>`).join("\n");
  const scriptTags = jsFiles.map(f => `<script data-file="${f.name}">\n${f.code}\n</script>`).join("\n");

  if (doc.includes("</head>")) {
    doc = doc.replace("</head>", `${styleTags}\n</head>`);
  } else if (doc.includes("<head>")) {
    doc = doc.replace("<head>", `<head>\n${styleTags}`);
  } else {
    doc = `<!doctype html><html><head>${styleTags}</head><body>${doc}</body></html>`;
  }

  if (doc.includes("</body>")) {
    doc = doc.replace("</body>", `${scriptTags}\n</body>`);
  } else {
    doc += scriptTags;
  }

  return doc;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const EC_STYLE = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .ec-root {
    --bg: #111111;
    --bg-sidebar: #161616;
    --bg-panel: #1c1c1c;
    --bg-hi: #242424;
    --bg-input: #181818;
    --border: rgba(255,255,255,0.07);
    --border-hi: rgba(255,255,255,0.13);
    --t1: #e8e8e8;
    --t2: #a0a0a0;
    --t3: #555555;
    --accent: #e8e8e8;
    --accent2: #c0c0c0;
    --danger: #cc4444;
    --success: #5a9a5a;
    --warning: #999;
    --mono: 'SF Mono','JetBrains Mono','Fira Code',Consolas,monospace;
    --ui: var(--font,-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif);
    --radius: 5px;
    --radius-lg: 7px;
    display: flex; flex-direction: column; height: 100dvh; overflow: hidden;
    background: var(--bg); font-family: var(--ui); color: var(--t1); font-size: 13px;
  }

  /* TOP HEADER */
  .ec-topbar { height: 42px; min-height: 42px; display: flex; align-items: center; padding: 0 14px; gap: 10px; background: var(--bg-sidebar); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-topbar-logo { width: 18px; height: 18px; border-radius: 4px; overflow: hidden; flex-shrink: 0; }
  .ec-topbar-logo img { width: 100%; height: 100%; object-fit: contain; }
  .ec-topbar-title { font-size: 12.5px; font-weight: 600; color: var(--t1); letter-spacing: -.01em; }
  .ec-topbar-sep { width: 1px; height: 16px; background: var(--border); margin: 0 2px; }
  .ec-topbar-badge { display: flex; align-items: center; gap: 5px; padding: 4px 9px; border-radius: 5px; background: var(--bg-hi); border: 1px solid var(--border); font-size: 11px; color: var(--t3); font-family: var(--ui); letter-spacing: .04em; }
  .ec-topbar-spacer { flex: 1; }
  .ec-topbar-btn { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 5px; font-size: 11.5px; font-weight: 600; cursor: pointer; font-family: var(--ui); transition: all .15s; border: 1px solid var(--border); }
  .ec-topbar-btn.ghost { background: none; color: var(--t2); }
  .ec-topbar-btn.ghost:hover { background: var(--bg-hi); color: var(--t1); }
  .ec-topbar-btn.solid { background: var(--t1); border-color: var(--t1); color: #111; }
  .ec-topbar-btn.solid:hover { background: var(--accent2); border-color: var(--accent2); }

  /* PROJECTS SCREEN */
  .ec-projects-screen { flex: 1; display: flex; flex-direction: column; background: var(--bg); overflow: hidden; }
  .ec-projects-body { flex: 1; overflow-y: auto; padding: 28px 36px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.05) transparent; }
  .ec-projects-heading { font-size: 17px; font-weight: 600; color: var(--t1); margin-bottom: 4px; letter-spacing: -.02em; }
  .ec-projects-subheading { font-size: 12px; color: var(--t3); margin-bottom: 26px; }
  .ec-projects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
  .ec-project-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 14px; cursor: pointer; transition: all .15s; display: flex; flex-direction: column; gap: 9px; position: relative; }
  .ec-project-card:hover { border-color: var(--border-hi); background: var(--bg-hi); }
  .ec-project-card-icon { width: 32px; height: 32px; border-radius: 7px; background: rgba(255,255,255,.04); display: flex; align-items: center; justify-content: center; font-size: 14px; color: var(--t2); }
  .ec-project-card-title { font-size: 12.5px; font-weight: 600; color: var(--t1); }
  .ec-project-card-meta { font-size: 10.5px; color: var(--t3); display: flex; gap: 8px; align-items: center; }
  .ec-project-file-chip { font-size: 9.5px; font-family: var(--mono); padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,.05); color: var(--t3); }
  .ec-project-card-del { position: absolute; top: 9px; right: 9px; width: 20px; height: 20px; border-radius: 4px; background: none; border: none; color: var(--t3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 10px; opacity: 0; transition: opacity .1s, color .1s; }
  .ec-project-card:hover .ec-project-card-del { opacity: 1; }
  .ec-project-card-del:hover { color: var(--danger); }
  .ec-projects-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; padding: 70px 24px; text-align: center; }
  .ec-projects-empty-icon { font-size: 28px; opacity: .2; }
  .ec-projects-empty-text { font-size: 12.5px; color: var(--t3); line-height: 1.7; }

  /* WORKSPACE */
  .ec-workspace { flex: 1; display: flex; overflow: hidden; min-height: 0; }

  /* LEFT — task timeline (22%) */
  .ec-sidebar { flex: 0 0 22%; max-width: 22%; min-width: 200px; background: var(--bg-sidebar); border-right: 1px solid var(--border); display: flex; flex-direction: column; overflow: hidden; }
  .ec-sidebar-top { padding: 0 8px 0 12px; height: 40px; min-height: 40px; display: flex; align-items: center; gap: 7px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-back-btn { width: 22px; height: 22px; border-radius: 4px; background: none; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--t3); transition: color .15s, background .15s; flex-shrink: 0; }
  .ec-back-btn:hover { background: var(--bg-hi); color: var(--t1); }
  .ec-sidebar-project-name { font-size: 12px; font-weight: 600; color: var(--t1); letter-spacing: -.01em; flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-new-file-btn { width: 22px; height: 22px; border-radius: 4px; background: rgba(255,255,255,.06); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--t2); flex-shrink: 0; transition: background .15s; }
  .ec-new-file-btn:hover { background: rgba(255,255,255,.12); }
  .ec-task-list { flex: 1; overflow-y: auto; padding: 4px 6px 10px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.05) transparent; }
  .ec-task-list::-webkit-scrollbar { width: 3px; }
  .ec-task-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 2px; }
  .ec-task-section-label { padding: 12px 8px 6px; font-size: 10px; color: var(--t3); letter-spacing: .07em; text-transform: uppercase; font-weight: 700; flex-shrink: 0; display: flex; align-items: center; gap: 6px; }
  .ec-task-section-label .ec-count { color: var(--t2); font-weight: 700; }

  .ec-task-item { display: flex; align-items: flex-start; gap: 8px; padding: 8px 8px; border-radius: var(--radius); cursor: pointer; transition: background .15s; margin-bottom: 1px; position: relative; }
  .ec-task-item:hover { background: var(--bg-hi); }
  .ec-task-item.active { background: var(--bg-panel); }
  .ec-task-item.main-chat .ec-task-title { color: var(--t1); font-weight: 600; }

  .ec-task-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; margin-top: 4px; }
  .ec-task-dot.done { background: var(--success); }
  .ec-task-dot.pending { border: 1.5px solid var(--t3); background: transparent; }
  .ec-task-dot.in_progress { background: var(--t2); }
  .ec-task-dot.main { width: 7px; height: 7px; background: var(--t1); border-radius: 2px; }
  .ec-task-info { flex: 1; min-width: 0; }
  .ec-task-title { font-size: 12px; font-weight: 500; color: var(--t1); line-height: 1.4; }
  .ec-task-item.pending .ec-task-title { color: var(--t2); }
  .ec-task-sub { font-size: 10px; color: var(--t3); margin-top: 2px; }
  .ec-task-del { width: 16px; height: 16px; border: none; background: none; border-radius: 3px; cursor: pointer; color: var(--t3); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity .1s, color .1s; flex-shrink: 0; font-size: 9px; padding: 0; margin-top: 2px; }
  .ec-task-item:hover .ec-task-del { opacity: 1; }
  .ec-task-del:hover { color: var(--danger); }
  .ec-sidebar-bottom { border-top: 1px solid var(--border); padding: 10px; flex-shrink: 0; }
  .ec-ask-eloria-btn { width: 100%; display: flex; align-items: center; gap: 7px; padding: 8px 10px; border-radius: var(--radius); background: rgba(255,255,255,.05); border: 1px solid var(--border); font-size: 12px; color: var(--t2); cursor: pointer; font-family: var(--ui); transition: all .15s; font-weight: 500; }
  .ec-ask-eloria-btn:hover { background: var(--bg-hi); color: var(--t1); }

  /* MIDDLE — chat/feed (30%) */
  .ec-chat { flex: 0 0 30%; max-width: 30%; min-width: 260px; display: flex; flex-direction: column; background: var(--bg); border-right: 1px solid var(--border); overflow: hidden; }
  .ec-chat-header { height: 40px; min-height: 40px; display: flex; align-items: center; padding: 0 14px; gap: 10px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-chat-file-icon { font-size: 12px; flex-shrink: 0; }
  .ec-chat-header-title { font-size: 12.5px; font-weight: 600; color: var(--t1); flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-status-btn { display: flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 5px; background: none; border: 1px solid var(--border); font-size: 10.5px; color: var(--t2); cursor: pointer; transition: all .15s; flex-shrink: 0; font-family: var(--ui); }
  .ec-status-btn:hover { background: var(--bg-hi); border-color: var(--border-hi); color: var(--t1); }
  .ec-body { flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.05) transparent; }
  .ec-body::-webkit-scrollbar { width: 4px; }
  .ec-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 2px; }

  @keyframes ecFadeUp { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; } }

  /* Plan doc card */
  .ec-plan-view { flex: 1; padding: 14px; animation: ecFadeUp .15s ease; }
  .ec-plan-card { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .ec-plan-card-header { display: flex; align-items: center; gap: 8px; padding: 10px 13px; border-bottom: 1px solid var(--border); }
  .ec-plan-card-icon { font-size: 13px; }
  .ec-plan-card-name { font-size: 12px; font-weight: 600; color: var(--t1); font-family: var(--mono); flex: 1; }
  .ec-plan-card-badge { font-size: 9.5px; font-weight: 600; padding: 2px 7px; border-radius: 20px; background: rgba(255,255,255,.07); color: var(--t2); }
  .ec-plan-card-body { padding: 13px; font-size: 12.5px; line-height: 1.7; color: var(--t2); }

  /* Activity feed */
  .ec-feed { flex: 1; padding: 10px 0; display: flex; flex-direction: column; gap: 2px; }
  .ec-log-row { display: flex; align-items: flex-start; gap: 8px; padding: 5px 14px; font-size: 11.5px; color: var(--t3); }
  .ec-log-row-icon { width: 13px; flex-shrink: 0; text-align: center; margin-top: 1px; color: var(--t3); }
  .ec-log-row-text { flex: 1; color: var(--t2); line-height: 1.5; }
  .ec-log-card { margin: 4px 10px; padding: 10px 12px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); animation: ecFadeUp .15s ease; }
  .ec-log-card-head { display: flex; align-items: center; gap: 7px; margin-bottom: 2px; }
  .ec-log-card-icon { width: 16px; height: 16px; border-radius: 4px; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
  .ec-log-card-title { font-size: 12px; font-weight: 600; color: var(--t1); flex: 1; }
  .ec-log-card-time { font-size: 9.5px; color: var(--t3); }
  .ec-log-card-body { font-size: 12px; line-height: 1.6; color: var(--t2); }
  .ec-log-diff { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; font-size: 10.5px; font-family: var(--mono); }
  .ec-log-diff .add { color: var(--success); }
  .ec-log-diff .file-chip { background: var(--bg-hi); border: 1px solid var(--border); border-radius: 4px; padding: 1px 6px; color: var(--t2); }

  /* File created trail card */
  .ec-file-created-card { margin: 4px 10px; padding: 9px 12px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); animation: ecFadeUp .15s ease; display: flex; align-items: center; gap: 9px; }
  .ec-file-created-icon { width: 20px; height: 20px; border-radius: 4px; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 10px; flex-shrink: 0; }
  .ec-file-created-info { flex: 1; min-width: 0; }
  .ec-file-created-label { font-size: 11px; color: var(--t3); margin-bottom: 1px; }
  .ec-file-created-name { font-size: 12px; font-weight: 600; color: var(--t1); font-family: var(--mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-file-created-lines { font-size: 10px; color: var(--t3); margin-top: 1px; }
  .ec-file-created-view { padding: 3px 8px; border-radius: 4px; background: none; border: 1px solid var(--border); font-size: 10.5px; color: var(--t2); cursor: pointer; font-family: var(--ui); transition: all .15s; }
  .ec-file-created-view:hover { background: var(--bg-hi); color: var(--t1); }

  .ec-user-row { display: flex; padding: 6px 14px; }
  .ec-user-bubble { background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.09); border-radius: 7px; padding: 6px 10px; font-size: 12px; color: var(--t1); max-width: 90%; }

  /* Pending view */
  .ec-pending-view { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 36px 22px; gap: 12px; animation: ecFadeUp .15s ease; }
  .ec-pending-icon { font-size: 26px; opacity: .2; }
  .ec-pending-title { font-size: 13.5px; font-weight: 600; color: var(--t1); }
  .ec-pending-sub { font-size: 11.5px; color: var(--t3); text-align: center; line-height: 1.7; max-width: 280px; }

  /* Thinking */
  .ec-thinking { display: flex; align-items: center; gap: 8px; padding: 5px 16px; }
  .ec-thinking-dots { display: flex; gap: 4px; align-items: center; }
  .ec-thinking-dots span { width: 4px; height: 4px; border-radius: 50%; background: var(--t2); opacity: .3; animation: ecDot 1.2s ease-in-out infinite; }
  .ec-thinking-dots span:nth-child(2) { animation-delay: .18s; }
  .ec-thinking-dots span:nth-child(3) { animation-delay: .36s; }
  @keyframes ecDot { 0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)} }

  /* Auto-build progress bar */
  .ec-build-progress { margin: 4px 10px; padding: 10px 12px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius); animation: ecFadeUp .15s ease; }
  .ec-build-progress-header { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; }
  .ec-build-progress-title { font-size: 12px; font-weight: 600; color: var(--t1); flex: 1; }
  .ec-build-progress-count { font-size: 10px; color: var(--t3); font-family: var(--mono); }
  .ec-build-progress-track { height: 2px; background: rgba(255,255,255,.07); border-radius: 1px; overflow: hidden; }
  .ec-build-progress-fill { height: 100%; background: var(--t2); border-radius: 1px; transition: width .4s ease; }
  .ec-build-progress-files { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
  .ec-build-file-row { display: flex; align-items: center; gap: 7px; font-size: 11px; color: var(--t3); }
  .ec-build-file-row.done { color: var(--t2); }
  .ec-build-file-row.active { color: var(--t1); }
  .ec-build-file-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; background: var(--t3); }
  .ec-build-file-dot.done { background: var(--success); }
  .ec-build-file-dot.active { background: var(--t2); animation: ecDot 1s infinite; }

  /* Attach */
  .ec-attach-bubble-solo { max-width: 92%; background: rgba(255,255,255,.04); border: 1px solid var(--border); border-radius: 7px; overflow: hidden; }
  .ec-attach-header { display: flex; align-items: center; gap: 7px; padding: 7px 10px 6px; border-bottom: 1px solid rgba(255,255,255,.05); }
  .ec-attach-header-icon { width: 20px; height: 20px; background: rgba(255,255,255,.06); border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
  .ec-attach-header-info { flex: 1; min-width: 0; }
  .ec-attach-header-name { font-size: 11px; font-weight: 600; color: var(--t1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-header-meta { font-size: 9.5px; color: var(--t3); margin-top: 1px; }
  .ec-attach-file-row { display: flex; align-items: center; gap: 6px; padding: 4px 10px; border-bottom: 1px solid rgba(255,255,255,.03); }
  .ec-attach-file-row:last-child { border-bottom: none; }
  .ec-attach-file-icon { font-size: 9.5px; width: 13px; text-align: center; flex-shrink: 0; color: var(--t2); }
  .ec-attach-file-name { flex: 1; min-width: 0; font-size: 10px; color: var(--t2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-file-ext { font-size: 8.5px; font-family: var(--mono); color: var(--t3); background: rgba(255,255,255,.05); border-radius: 3px; padding: 1px 4px; flex-shrink: 0; }
  .ec-attach-file-size { font-size: 8.5px; color: var(--t3); flex-shrink: 0; }
  .ec-attach-text { padding: 6px 10px; font-size: 11.5px; line-height: 1.6; color: var(--t1); white-space: pre-wrap; word-break: break-word; }
  .ec-attach-strip { display: flex; gap: 5px; flex-wrap: wrap; padding: 6px 14px 0; }
  .ec-attach-chip { display: flex; align-items: center; gap: 5px; padding: 3px 7px 3px 5px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 5px; font-size: 10px; color: var(--t2); max-width: 160px; animation: ecFadeUp .15s ease; }
  .ec-attach-chip-icon { font-size: 9.5px; color: var(--t2); flex-shrink: 0; }
  .ec-attach-chip-name { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ec-attach-chip-remove { width: 12px; height: 12px; border: none; background: none; color: var(--t3); cursor: pointer; font-size: 9px; display: flex; align-items: center; justify-content: center; border-radius: 3px; flex-shrink: 0; transition: color .1s; padding: 0; }
  .ec-attach-chip-remove:hover { color: var(--danger); }
  .ec-attach-limit-note { font-size: 10px; color: var(--t3); padding: 2px 14px 0; }

  /* Input */
  .ec-input-wrap { flex-shrink: 0; padding: 8px 12px 10px; background: var(--bg); }
  .ec-input-box { background: var(--bg-input); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 7px 9px; display: flex; flex-direction: column; gap: 6px; transition: border-color .15s, box-shadow .15s; }
  .ec-input-box:focus-within { border-color: rgba(255,255,255,.18); box-shadow: 0 0 0 3px rgba(255,255,255,.03); }
  .ec-input-toolbar { display: flex; align-items: center; gap: 4px; padding-bottom: 5px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
  .ec-toolbar-btn { display: flex; align-items: center; gap: 5px; padding: 3px 6px; background: none; border: 1px solid transparent; border-radius: 5px; cursor: pointer; font-size: 10.5px; color: var(--t3); transition: all .15s; font-family: var(--ui); }
  .ec-toolbar-btn:hover { background: var(--bg-hi); border-color: var(--border); color: var(--t1); }
  .ec-toolbar-btn svg { width: 10px; height: 10px; flex-shrink: 0; }
  .ec-toolbar-btn.disabled { opacity: .3; pointer-events: none; }
  .ec-toolbar-sep { width: 1px; height: 12px; background: var(--border); flex-shrink: 0; }
  .ec-textarea-row { display: flex; align-items: flex-end; gap: 7px; }
  .ec-input-prefix { font-family: var(--mono); font-size: 12px; color: var(--t3); flex-shrink: 0; user-select: none; line-height: 22px; }
  .ec-textarea { flex: 1; border: none; background: none; outline: none; font-family: var(--ui); font-size: 12.5px; color: var(--t1); resize: none; min-height: 20px; max-height: 120px; line-height: 1.55; overflow-y: auto; scrollbar-width: thin; caret-color: var(--t1); }
  .ec-textarea::placeholder { color: var(--t3); }
  .ec-send { width: 24px; height: 24px; border-radius: 5px; background: var(--t1); border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: #111; transition: opacity .15s, background .15s; }
  .ec-send:hover:not(:disabled) { background: var(--accent2); }
  .ec-send:disabled { opacity: .18; cursor: default; }
  .ec-send svg { width: 11px; height: 11px; }
  .ec-hint { text-align: center; font-size: 9.5px; color: var(--t3); margin-top: 5px; opacity: .6; }

  /* RIGHT panel */
  .ec-right { flex: 1 1 48%; min-width: 320px; background: var(--bg-sidebar); display: flex; flex-direction: column; overflow: hidden; }
  .ec-right-header { height: 40px; min-height: 40px; display: flex; align-items: stretch; border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .ec-right-tabs { display: flex; flex: 1; }
  .ec-right-tab { flex: 1; display: flex; align-items: center; justify-content: center; font-size: 11.5px; font-weight: 500; color: var(--t3); cursor: pointer; border-bottom: 2px solid transparent; transition: all .15s; background: none; border-top: none; border-left: none; border-right: none; font-family: var(--ui); }
  .ec-right-tab:hover { color: var(--t2); }
  .ec-right-tab.active { color: var(--t1); border-bottom-color: var(--t1); }
  .ec-right-body { flex: 1; overflow-y: auto; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.05) transparent; display: flex; flex-direction: column; }
  .ec-right-body::-webkit-scrollbar { width: 3px; }
  .ec-right-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.07); border-radius: 2px; }

  /* Preview */
  .ec-preview-frame { width: 100%; height: 100%; border: none; background: #fff; flex: 1; }
  .ec-preview-placeholder { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 12px; padding: 32px; text-align: center; }
  .ec-preview-placeholder-icon { font-size: 22px; opacity: .2; }
  .ec-preview-placeholder-text { font-size: 11.5px; color: var(--t3); line-height: 1.7; }

  /* Code viewer */
  .ec-code-header { display: flex; align-items: center; gap: 8px; padding: 7px 12px; border-bottom: 1px solid var(--border); flex-shrink: 0; background: var(--bg-sidebar); position: sticky; top: 0; z-index: 1; }
  .ec-code-filename { font-size: 11px; font-family: var(--mono); color: var(--t2); flex: 1; }
  .ec-copy-btn { display: flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 5px; background: var(--bg-panel); border: 1px solid var(--border); font-size: 10.5px; color: var(--t2); cursor: pointer; transition: all .15s; font-family: var(--ui); }
  .ec-copy-btn:hover { border-color: var(--border-hi); color: var(--t1); }
  .ec-copy-btn.copied { color: var(--success); border-color: rgba(90,154,90,.35); }
  .ec-download-btn { display: flex; align-items: center; gap: 5px; padding: 3px 9px; border-radius: 5px; background: rgba(255,255,255,.06); border: 1px solid var(--border); font-size: 10.5px; color: var(--t2); cursor: pointer; transition: all .15s; font-family: var(--ui); }
  .ec-download-btn:hover { background: rgba(255,255,255,.1); color: var(--t1); }
  .ec-line-nums { display: flex; flex: 1; overflow: auto; }
  .ec-line-num-col { padding: 14px 10px 14px 14px; font-size: 11px; line-height: 1.65; color: var(--t3); font-family: var(--mono); text-align: right; user-select: none; border-right: 1px solid var(--border); flex-shrink: 0; min-width: 36px; }
  .ec-code-main { flex: 1; padding: 14px 14px; font-family: var(--mono); font-size: 11.5px; line-height: 1.65; color: var(--t2); overflow-x: auto; white-space: pre; }

  /* Summary tab */
  .ec-summary-body { padding: 16px; display: flex; flex-direction: column; gap: 16px; }
  .ec-summary-block-label { font-size: 10px; color: var(--t3); font-weight: 700; letter-spacing: .07em; text-transform: uppercase; margin-bottom: 8px; }
  .ec-summary-list { display: flex; flex-direction: column; gap: 6px; }
  .ec-summary-list-item { display: flex; align-items: flex-start; gap: 7px; font-size: 12.5px; color: var(--t2); line-height: 1.5; }
  .ec-summary-list-item svg { flex-shrink: 0; color: var(--success); margin-top: 2px; }
  .ec-summary-chip-row { display: flex; flex-wrap: wrap; gap: 6px; }
  .ec-summary-file-chip { display: flex; align-items: center; gap: 6px; padding: 5px 10px; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 5px; font-size: 11.5px; color: var(--t1); font-family: var(--mono); cursor: pointer; transition: all .15s; }
  .ec-summary-file-chip:hover { border-color: var(--border-hi); }
  .ec-summary-status-badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 11px; border-radius: 20px; font-size: 11.5px; font-weight: 600; }
  .ec-summary-status-badge.ready { background: rgba(90,154,90,.12); color: var(--success); }
  .ec-summary-status-badge.progress { background: rgba(255,255,255,.06); color: var(--t2); }

  /* AI Summary card */
  .ec-ai-summary { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .ec-ai-summary-header { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border-bottom: 1px solid var(--border); }
  .ec-ai-summary-icon { width: 18px; height: 18px; border-radius: 4px; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 9px; flex-shrink: 0; }
  .ec-ai-summary-label { font-size: 11px; font-weight: 600; color: var(--t1); flex: 1; }
  .ec-ai-summary-ts { font-size: 9.5px; color: var(--t3); }
  .ec-ai-summary-body { padding: 12px; font-size: 12px; line-height: 1.7; color: var(--t2); }
  .ec-ai-summary-generating { display: flex; align-items: center; gap: 8px; padding: 12px; font-size: 11.5px; color: var(--t3); }
  .ec-ai-summary-regen { display: flex; align-items: center; gap: 5px; padding: 3px 8px; border-radius: 4px; background: none; border: 1px solid var(--border); font-size: 10px; color: var(--t3); cursor: pointer; font-family: var(--ui); transition: all .15s; }
  .ec-ai-summary-regen:hover { background: var(--bg-hi); color: var(--t1); }

  /* Caution / notes block in summary */
  .ec-summary-notes { background: rgba(255,255,255,.03); border: 1px solid var(--border); border-left: 2px solid var(--t3); border-radius: var(--radius); padding: 10px 12px; }
  .ec-summary-notes-label { font-size: 9.5px; font-weight: 700; color: var(--t3); letter-spacing: .07em; text-transform: uppercase; margin-bottom: 6px; }
  .ec-summary-notes-list { display: flex; flex-direction: column; gap: 5px; }
  .ec-summary-notes-item { font-size: 12px; color: var(--t2); line-height: 1.55; display: flex; align-items: flex-start; gap: 6px; }
  .ec-summary-notes-item::before { content: "·"; color: var(--t3); flex-shrink: 0; }

  /* Empty states */
  .ec-no-content { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 10px; padding: 40px 16px; text-align: center; }
  .ec-no-content-icon { font-size: 22px; opacity: .2; }
  .ec-no-content-text { font-size: 11.5px; color: var(--t3); line-height: 1.65; }

  /* Status dropdown */
  .ec-status-dropdown { position: absolute; top: calc(100% + 5px); right: 0; background: var(--bg-panel); border: 1px solid var(--border-hi); border-radius: var(--radius-lg); padding: 4px; width: 190px; z-index: 200; box-shadow: 0 12px 36px rgba(0,0,0,.6); animation: ecFadeUp .15s ease; }
  .ec-status-option { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 5px; cursor: pointer; font-size: 11.5px; color: var(--t2); transition: all .12s; background: none; border: none; width: 100%; text-align: left; font-family: var(--ui); }
  .ec-status-option:hover { background: var(--bg-hi); color: var(--t1); }

  /* Statusbar */
  .ec-statusbar { display: flex; align-items: center; gap: 14px; padding: 0 12px; height: 22px; min-height: 22px; background: var(--bg-sidebar); border-top: 1px solid var(--border); flex-shrink: 0; font-size: 9.5px; color: var(--t3); }
  .ec-statusbar-item { display: flex; align-items: center; gap: 4px; }
  .ec-statusbar-right { margin-left: auto; display: flex; align-items: center; gap: 10px; }

  /* Modals */
  .ec-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.7); display: flex; align-items: center; justify-content: center; z-index: 500; animation: ecFadeIn .15s ease; }
  @keyframes ecFadeIn { from{opacity:0}to{opacity:1} }
  .ec-modal { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; width: 340px; max-width: 90vw; box-shadow: 0 20px 60px rgba(0,0,0,.6); display: flex; flex-direction: column; gap: 14px; animation: ecSlideUp .15s ease; }
  @keyframes ecSlideUp { from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)} }
  .ec-modal-title { font-size: 13.5px; font-weight: 600; color: var(--t1); display: flex; align-items: center; gap: 8px; }
  .ec-modal-title-icon { width: 24px; height: 24px; background: rgba(255,255,255,.06); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 12px; }
  .ec-modal-field { display: flex; flex-direction: column; gap: 5px; }
  .ec-modal-label { font-size: 9.5px; color: var(--t3); font-weight: 600; letter-spacing: .05em; text-transform: uppercase; }
  .ec-modal-input { padding: 8px 10px; font-size: 12.5px; color: var(--t1); background: var(--bg); border: 1px solid var(--border); border-radius: 6px; outline: none; transition: border-color .15s; font-family: var(--ui); }
  .ec-modal-input::placeholder { color: var(--t3); }
  .ec-modal-input:focus { border-color: rgba(255,255,255,.2); }
  .ec-modal-actions { display: flex; gap: 7px; justify-content: flex-end; }
  .ec-modal-cancel { padding: 7px 12px; background: none; border: 1px solid var(--border); border-radius: 6px; font-size: 12px; color: var(--t2); cursor: pointer; transition: background .15s; font-family: var(--ui); }
  .ec-modal-cancel:hover { background: var(--bg-hi); }
  .ec-modal-create { padding: 7px 14px; background: var(--t1); border: none; border-radius: 6px; font-size: 12px; font-weight: 700; color: #111; cursor: pointer; transition: opacity .15s; font-family: var(--ui); }
  .ec-modal-create:hover:not(:disabled) { opacity: .85; }
  .ec-modal-create:disabled { opacity: .25; cursor: default; }

  /* Limit modal */
  .ec-limit-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; animation: ecFadeIn .15s ease; }
  .ec-limit-box { background: var(--bg-panel); border: 1px solid var(--border); border-radius: var(--radius-lg); width: 310px; margin: 0 16px; overflow: hidden; box-shadow: 0 28px 70px rgba(0,0,0,.6); animation: ecSlideUp .18s ease; }
  .ec-limit-top { border-bottom: 1px solid var(--border); padding: 22px 16px 16px; text-align: center; position: relative; }
  .ec-limit-close { position: absolute; top: 8px; right: 8px; width: 22px; height: 22px; border-radius: 50%; background: var(--bg-hi); border: none; color: var(--t3); cursor: pointer; font-size: 10px; display: flex; align-items: center; justify-content: center; transition: all .15s; }
  .ec-limit-close:hover { color: var(--t1); }
  .ec-limit-icon { width: 38px; height: 38px; border-radius: 10px; background: rgba(255,255,255,.06); display: flex; align-items: center; justify-content: center; font-size: 17px; margin: 0 auto 10px; }
  .ec-limit-title { font-size: 13.5px; font-weight: 600; color: var(--t1); margin-bottom: 3px; }
  .ec-limit-sub { font-size: 11px; color: var(--t3); }
  .ec-limit-body { padding: 14px 16px 16px; }
  .ec-limit-desc { font-size: 12px; color: var(--t2); line-height: 1.65; margin-bottom: 12px; text-align: center; }
  .ec-limit-actions { display: flex; gap: 6px; }
  .ec-limit-cancel { flex: 1; padding: 8px; background: none; border: 1px solid var(--border); border-radius: 6px; font-size: 11.5px; color: var(--t2); cursor: pointer; font-weight: 500; font-family: var(--ui); }
  .ec-limit-cancel:hover { background: var(--bg-hi); }
  .ec-limit-upgrade { flex: 2; padding: 8px; background: var(--t1); border: none; border-radius: 6px; font-size: 11.5px; font-weight: 700; color: #111; cursor: pointer; font-family: var(--ui); }
  .ec-limit-upgrade:hover { opacity: .88; }

  /* Main chat indicator */
  .ec-main-chat-badge { font-size: 9px; padding: 1px 5px; border-radius: 3px; background: rgba(255,255,255,.08); color: var(--t3); margin-left: 4px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
  
  /* Mode tabs (Code / Tasks) */
  .ec-mode-tabs { display: flex; background: var(--bg-hi); border: 1px solid var(--border); border-radius: 6px; padding: 2px; gap: 2px; }
  .ec-mode-tab { padding: 4px 12px; border-radius: 4px; background: none; border: none; cursor: pointer; font-size: 11.5px; font-weight: 600; color: var(--t3); font-family: var(--ui); transition: all .15s; }
  .ec-mode-tab:hover { color: var(--t2); }
  .ec-mode-tab.active { background: var(--t1); color: #111; }

/* ── TASKS PANEL — light theme, matches main chat ─────────────── */
  .ec-tasks-workspace {
    flex: 1; display: flex; overflow: hidden; min-height: 0;
    background: #FBF6F0; font-family: 'DM Sans', -apple-system, sans-serif;
  }

  /* sidebar */
  .ect-sidebar {
    flex: 0 0 240px; max-width: 240px;
    background: #fdfaf6; border-right: 1px solid #dde0d9;
    display: flex; flex-direction: column; overflow: hidden;
  }
  .ect-sidebar-top {
    height: 48px; min-height: 48px; padding: 0 12px;
    display: flex; align-items: center; gap: 8px;
    border-bottom: 1px solid #dde0d9; flex-shrink: 0;
  }
  .ect-sidebar-title { font-size: 13px; font-weight: 600; color: #0D3A35; flex: 1; }
  .ect-new-btn {
    width: 26px; height: 26px; border-radius: 7px;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,.18);
    color: #276152; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background .12s;
  }
  .ect-new-btn:hover { background: #dcece5; }
  .ect-chat-list { flex: 1; overflow-y: auto; padding: 6px 8px; scrollbar-width: thin; }
  .ect-empty { padding: 20px 10px; font-size: 12px; color: #7a8a84; line-height: 1.7; text-align: center; }

  .ect-chat-row {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 8px; border-radius: 8px; margin-bottom: 2px;
    cursor: pointer; transition: background .12s;
    border-left: 2px solid transparent;
  }
  .ect-chat-row:hover { background: #f2ede7; }
  .ect-chat-row.active { background: #eaf2ef; border-left-color: #276152; }
  .ect-chat-row-icon { color: #7a8a84; flex-shrink: 0; display: flex; }
  .ect-chat-row.active .ect-chat-row-icon { color: #276152; }
  .ect-chat-row-info { flex: 1; min-width: 0; }
  .ect-chat-row-title {
    font-size: 12.5px; color: #0D3A35; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; line-height: 1.4;
  }
  .ect-chat-row.active .ect-chat-row-title { font-weight: 600; color: #1a4a3d; }
  .ect-chat-row-sub { font-size: 10.5px; color: #7a8a84; margin-top: 1px; }
  .ect-chat-row-del {
    background: none; border: none; cursor: pointer; color: #7a8a84;
    font-size: 12px; padding: 3px 5px; border-radius: 4px;
    opacity: 0; transition: opacity .12s, color .12s; flex-shrink: 0;
  }
  .ect-chat-row:hover .ect-chat-row-del { opacity: 1; }
  .ect-chat-row-del:hover { color: #c04040; }

  /* main column */
  .ect-main { flex: 1; display: flex; flex-direction: column; overflow: hidden; background: #FBF6F0; }
  .ect-header {
    height: 56px; min-height: 56px; padding: 0 18px;
    display: flex; align-items: center; gap: 10px;
    border-bottom: 1px solid #dde0d9; background: #FBF6F0; flex-shrink: 0;
  }
  .ect-header-icon {
    width: 30px; height: 30px; border-radius: 9px;
    background: #eaf2ef; display: flex; align-items: center; justify-content: center;
    color: #276152; flex-shrink: 0;
  }
  .ect-header-title { font-size: 14.5px; font-weight: 600; color: #0D3A35; }
  .ect-header-sub { font-size: 11px; color: #7a8a84; }

  .ect-body {
    flex: 1; min-height: 0; overflow-y: auto; overflow-x: hidden;
    display: flex; flex-direction: column; scrollbar-width: thin;
    scrollbar-color: #e0e0da transparent; padding: 12px 0 8px;
  }

  .ect-pending {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 10px; padding: 40px 24px; text-align: center;
  }
  .ect-pending-icon {
    width: 52px; height: 52px; border-radius: 14px;
    background: #eaf2ef; display: flex; align-items: center; justify-content: center;
    color: #276152; margin-bottom: 4px;
  }
  .ect-pending-title { font-size: 15px; font-weight: 600; color: #0D3A35; }
  .ect-pending-sub { font-size: 12.5px; color: #7a8a84; line-height: 1.65; max-width: 300px; }

  /* message rows — mirrors cw-msg-row / cw-bubble */
  .ect-msg-row { display: flex; padding: 5px 18px; max-width: 720px; width: 100%; margin: 0 auto; }
  .ect-msg-row.user { justify-content: flex-end; }
  .ect-msg-row.ai { justify-content: flex-start; gap: 8px; align-items: flex-end; }
  .ect-avatar {
    width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
    background: #eaf2ef; border: 1px solid rgba(39,97,82,.18);
    display: flex; align-items: center; justify-content: center;
    color: #276152; margin-bottom: 2px;
  }
  .ect-bubble {
    max-width: 78%; padding: 10px 15px; border-radius: 18px;
    font-size: 14.5px; line-height: 1.55; word-break: break-word;
  }
  .ect-msg-row.user .ect-bubble {
    background: #276152; color: #fff; border-bottom-right-radius: 5px;
    box-shadow: 0 2px 10px rgba(0,0,0,.12);
  }
  .ect-msg-row.ai .ect-bubble {
    background: #fff; color: #0D3A35; border: 1px solid #ececea;
    border-bottom-left-radius: 5px; box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }

  .ect-log-row {
    display: flex; align-items: center; gap: 8px;
    padding: 4px 18px; max-width: 720px; width: 100%; margin: 0 auto;
    font-size: 11.5px; color: #7a8a84;
  }

  .ect-thinking {
    display: flex; align-items: center; gap: 8px;
    padding: 6px 18px; max-width: 720px; width: 100%; margin: 0 auto;
  }
  .ect-thinking-dots { display: flex; gap: 4px; }
  .ect-thinking-dots span {
    width: 5px; height: 5px; border-radius: 50%; background: #276152;
    opacity: .4; animation: cwDot 1.2s ease-in-out infinite;
  }
  .ect-thinking-dots span:nth-child(2) { animation-delay: .2s; }
  .ect-thinking-dots span:nth-child(3) { animation-delay: .4s; }

  /* input — mirrors cw-input-wrap / cw-input-box */
  .ect-input-wrap { flex-shrink: 0; padding: 8px 16px 14px; background: #FBF6F0; border-top: 1px solid #dde0d9; }
  .ect-input-box {
    max-width: 720px; margin: 0 auto;
    background: #fafaf8; border: 1.5px solid #cdd0c9; border-radius: 18px;
    padding: 10px 12px; display: flex; flex-direction: column; gap: 8px;
    transition: border-color .15s, box-shadow .15s; box-shadow: 0 1px 6px rgba(0,0,0,.04);
  }
  .ect-input-box:focus-within {
    border-color: rgba(13,58,53,.35); box-shadow: 0 0 0 3px rgba(13,58,53,.07);
    background: #fff;
  }
  .ect-textarea-row { display: flex; align-items: flex-end; gap: 8px; }
  .ect-textarea {
    flex: 1; border: none; background: none; outline: none;
    font-family: 'DM Sans', sans-serif; font-size: 14px; color: #0D3A35;
    resize: none; min-height: 22px; max-height: 120px; line-height: 1.55;
    overflow-y: auto; caret-color: #0d3a35;
  }
  .ect-textarea::placeholder { color: #7a8a84; }
  .ect-send {
    width: 34px; height: 34px; border-radius: 50%;
    background: #0d3a35; border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; color: #fff; transition: opacity .13s, transform .1s;
  }
  .ect-send:hover:not(:disabled) { opacity: .88; transform: scale(1.05); }
  .ect-send:disabled { opacity: .3; cursor: default; }
  .ect-hint { text-align: center; font-size: 11px; color: #7a8a84; margin-top: 6px; }

  /* locked (browser) state */
  .ect-locked {
    flex: 1; display: flex; flex-direction: column; align-items: center;
    justify-content: center; gap: 14px; padding: 40px; text-align: center;
    background: #FBF6F0;
  }
  .ect-locked-icon {
    width: 56px; height: 56px; border-radius: 16px;
    background: linear-gradient(145deg, #0d3a35 0%, #1d6152 100%);
    display: flex; align-items: center; justify-content: center;
    color: #fff; box-shadow: 0 4px 20px rgba(13,58,53,.2);
  }
  .ect-locked-title { font-size: 16px; font-weight: 700; color: #0D3A35; }
  .ect-locked-sub { font-size: 12.5px; color: #7a8a84; line-height: 1.7; max-width: 320px; }
`;

// ─── FIRESTORE HELPERS ─────────────────────────────────────────────────────
async function loadProjects(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().codeProjects || [];
}
async function saveProjects(uid, projects) {
  await setDoc(doc(db, "users", uid), { codeProjects: JSON.parse(JSON.stringify(projects)) }, { merge: true });
}
async function loadFileMessages(uid, fileId) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return ((snap.data().codeFileMessages || {})[String(fileId)]) || [];
}
async function saveFileMessages(uid, fileId, messages) {
  await setDoc(doc(db, "users", uid), { codeFileMessages: { [String(fileId)]: JSON.parse(JSON.stringify(messages)) } }, { merge: true });
}
async function deleteFileMessages(uid, fileId) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const map = snap.data().codeFileMessages || {};
  delete map[String(fileId)];
  await setDoc(ref, { codeFileMessages: map }, { merge: true });
}
async function loadProjectSummary(uid, projectId) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return ((snap.data().codeProjectSummaries || {})[String(projectId)]) || null;
}
async function saveProjectSummary(uid, projectId, summary) {
  await setDoc(doc(db, "users", uid), { codeProjectSummaries: { [String(projectId)]: JSON.parse(JSON.stringify(summary)) } }, { merge: true });
}

async function loadTaskChats(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return [];
  return snap.data().eloriaTaskChats || [];
}
async function saveTaskChats(uid, chats) {
  await setDoc(doc(db, "users", uid), { eloriaTaskChats: JSON.parse(JSON.stringify(chats)) }, { merge: true });
}

// ─── ATTACHMENT BUBBLE ─────────────────────────────────────────────────────
function AttachmentBubble({ attachment }) {
  const isFolder = attachment.type === "folder";
  return (
    <div className="ec-attach-bubble-solo">
      <div className="ec-attach-header">
        <div className="ec-attach-header-icon">{isFolder ? "" : getFileIcon(attachment.files[0]?.name || "")}</div>
        <div className="ec-attach-header-info">
          <div className="ec-attach-header-name">{attachment.name}</div>
          <div className="ec-attach-header-meta">{isFolder ? `${attachment.files.length} files · folder` : `${formatBytes(attachment.files[0]?.size)} · ${getExtLabel(attachment.name)}`}</div>
        </div>
      </div>
      {attachment.files.map((f, i) => (
        <div key={i} className="ec-attach-file-row">
          <span className="ec-attach-file-icon">{getFileIcon(f.name)}</span>
          <span className="ec-attach-file-name">{isFolder ? f.relativePath || f.name : f.name}</span>
          <span className="ec-attach-file-ext">{getExtLabel(f.name)}</span>
          <span className="ec-attach-file-size">{formatBytes(f.size)}</span>
        </div>
      ))}
      {attachment.userText && <div className="ec-attach-text">{attachment.userText}</div>}
    </div>
  );
}

// ─── CODE VIEWER ────────────────────────────────────────────────────────────
function CodeViewer({ code, filename }) {
  const [copied, setCopied] = useState(false);
  const ext = getExt(filename || "");
  const lines = (code || "").split("\n");
  const highlighted = syntaxHighlight(code || "", ext).split("\n");

  const copy = () => {
    navigator.clipboard.writeText(code || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", flex:1, overflow:"hidden" }}>
      <div className="ec-code-header">
        <span className="ec-code-filename">{filename || "code"}</span>
        <button className="ec-download-btn" onClick={() => downloadFile(filename, code)} title="Download file">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Download
        </button>
        <button className={`ec-copy-btn${copied ? " copied" : ""}`} onClick={copy}>{copied ? "✓ Copied" : "Copy"}</button>
      </div>
      <div className="ec-line-nums" style={{ flex:1 }}>
        <div className="ec-line-num-col">{lines.map((_, i) => <div key={i}>{i + 1}</div>)}</div>
        <div className="ec-code-main" dangerouslySetInnerHTML={{ __html: highlighted.join("\n") }} />
      </div>
    </div>
  );
}

// ─── FILE CREATED TRAIL CARD ─────────────────────────────────────────────────
function FileCreatedCard({ file, onView }) {
  return (
    <div className="ec-file-created-card">
      <div className="ec-file-created-icon">{getFileIcon(file.name)}</div>
      <div className="ec-file-created-info">
        <div className="ec-file-created-label">Created file</div>
        <div className="ec-file-created-name">{file.name}</div>
        {file.lines > 0 && <div className="ec-file-created-lines">+{file.lines} lines</div>}
      </div>
      <button className="ec-file-created-view" onClick={() => onView(file.id)}>View →</button>
    </div>
  );
}

// ─── AUTO-BUILD PROGRESS CARD ──────────────────────────────────────────────
function AutoBuildProgress({ files, doneCount, activeIdx }) {
  const pct = files.length > 0 ? Math.round((doneCount / files.length) * 100) : 0;
  return (
    <div className="ec-build-progress">
      <div className="ec-build-progress-header">
        <span className="ec-build-progress-title">Building project files…</span>
        <span className="ec-build-progress-count">{doneCount}/{files.length}</span>
      </div>
      <div className="ec-build-progress-track">
        <div className="ec-build-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="ec-build-progress-files">
        {files.map((f, i) => {
          const isDone = i < doneCount;
          const isActive = i === activeIdx;
          return (
            <div key={f.id || i} className={`ec-build-file-row${isDone ? " done" : isActive ? " active" : ""}`}>
              <span className={`ec-build-file-dot${isDone ? " done" : isActive ? " active" : ""}`} />
              {f.name}
              {isDone && <span style={{ marginLeft:"auto", fontSize:10, color:"var(--success)" }}>✓</span>}
              {isActive && <span style={{ marginLeft:"auto", fontSize:10, color:"var(--t3)" }}>building…</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── TASKS PANEL (video editing, file tasks, etc — desktop only) ───────────
function EloriaTasks({ isDesktopApp, uid }) {
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const bodyRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!uid || !isDesktopApp) { setLoaded(true); return; }
    loadTaskChats(uid).then(loadedChats => {
      setChats(loadedChats);
      if (loadedChats.length > 0) setActiveChatId(loadedChats[0].id);
      setLoaded(true);
    });
  }, [uid, isDesktopApp]);

  useEffect(() => {
    if (!uid || !loaded) return;
    saveTaskChats(uid, chats);
  }, [chats, uid, loaded]);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [chats, activeChatId, isRunning]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  const activeChat = chats.find(c => c.id === activeChatId) || null;

  const newChat = () => {
    const chat = { id: Date.now(), title: "New Task", messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    setChats(prev => [chat, ...prev]);
    setActiveChatId(chat.id);
    setInput("");
  };

  const deleteChat = (e, chatId) => {
    e.stopPropagation();
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChatId === chatId) {
      const remaining = chats.filter(c => c.id !== chatId);
      setActiveChatId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

const handleRun = async () => {
  if (!input.trim() || isRunning) return;
  let chatId = activeChatId;
  let workingChats = chats;

  if (!chatId) {
    const chat = { id: Date.now(), title: input.trim().slice(0, 40), messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    workingChats = [chat, ...chats];
    chatId = chat.id;
    setActiveChatId(chatId);
  }

  const userText = input.trim();
  const userMsg = { id: Date.now() + 1, sender: "user", text: userText };
  const now = new Date().toISOString();

  setChats(workingChats.map(c => {
    if (c.id !== chatId) return c;
    const isFirstMsg = c.messages.length === 0;
    return {
      ...c,
      title: isFirstMsg ? userText.slice(0, 40) : c.title,
      messages: [...c.messages, userMsg],
      updatedAt: now,
    };
  }));

  setInput("");
  setIsRunning(true);

  // TEMP: hardcoded test args — replace with AI-generated args once that layer is wired
  const testArgs = ["-version"];

  try {
    const result = await invoke("run_ffmpeg", { args: testArgs });
    setChats(prev => prev.map(c => c.id !== chatId ? c : {
      ...c,
      messages: [...c.messages, { id: Date.now() + 2, sender: "ai", text: "```\n" + result + "\n```" }],
      updatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    setChats(prev => prev.map(c => c.id !== chatId ? c : {
      ...c,
      messages: [...c.messages, { id: Date.now() + 2, sender: "ai", text: `ffmpeg failed:\n\`\`\`\n${err}\n\`\`\`` }],
      updatedAt: new Date().toISOString(),
    }));
  } finally {
    setIsRunning(false);
  }
};

  const IconZap = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  );
  const IconPlus = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
  const IconMonitor = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );

  if (!isDesktopApp) {
    return (
      <div className="ec-tasks-workspace">
        <div className="ect-locked">
          <div className="ect-locked-icon"><IconMonitor /></div>
          <div className="ect-locked-title">Desktop app required</div>
          <div className="ect-locked-sub">
            Tasks runs real commands on your machine — video editing, file conversion, and more.
            This needs the Eloria desktop app, not the browser.
          </div>
          <button className="ec-topbar-btn solid" onClick={() => window.open("https://your-download-page", "_blank")}>
            Download Eloria Desktop
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ec-tasks-workspace">
      {/* LEFT — chat list */}
      <aside className="ect-sidebar">
        <div className="ect-sidebar-top">
          <span className="ect-sidebar-title">Tasks</span>
          <button className="ect-new-btn" onClick={newChat} title="New task"><IconPlus /></button>
        </div>
        <div className="ect-chat-list">
          {chats.length === 0 ? (
            <div className="ect-empty">No tasks yet.<br/>Start a new one below.</div>
          ) : (
            chats.map(chat => (
              <div
                key={chat.id}
                className={`ect-chat-row${chat.id === activeChatId ? " active" : ""}`}
                onClick={() => setActiveChatId(chat.id)}
              >
                <span className="ect-chat-row-icon"><IconZap /></span>
                <div className="ect-chat-row-info">
                  <div className="ect-chat-row-title">{chat.title || "New Task"}</div>
                  <div className="ect-chat-row-sub">{timeAgo(chat.updatedAt)}</div>
                </div>
                <button className="ect-chat-row-del" onClick={e => deleteChat(e, chat.id)}>✕</button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* RIGHT — conversation */}
      <main className="ect-main">
        <div className="ect-header">
          <div className="ect-header-icon"><IconZap /></div>
          <div>
            <div className="ect-header-title">{activeChat?.title || "Tasks"}</div>
            <div className="ect-header-sub">Runs directly on your machine</div>
          </div>
        </div>

        <div className="ect-body" ref={bodyRef}>
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="ect-pending">
              <div className="ect-pending-icon"><IconZap /></div>
              <div className="ect-pending-title">What do you need done?</div>
              <div className="ect-pending-sub">
                Describe a task — trim a video, convert a file, run a script — and Eloria will handle it directly on your machine.
              </div>
            </div>
          ) : (
            activeChat.messages.map(msg => {
              if (msg.sender === "user") {
                return (
                  <div key={msg.id} className="ect-msg-row user">
                    <div className="ect-bubble">{msg.text}</div>
                  </div>
                );
              }
              if (msg.sender === "log") {
                return (
                  <div key={msg.id} className="ect-log-row">
                    <span>{msg.icon || "·"}</span>
                    <span>{msg.text}</span>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="ect-msg-row ai">
                  <div className="ect-avatar"><IconZap /></div>
                  <div className="ect-bubble">{msg.text}</div>
                </div>
              );
            })
          )}
          {isRunning && (
            <div className="ect-thinking">
              <div className="ect-avatar" style={{ margin: 0 }}><IconZap /></div>
              <div className="ect-thinking-dots"><span/><span/><span/></div>
            </div>
          )}
        </div>

        <div className="ect-input-wrap">
          <div className="ect-input-box">
            <div className="ect-textarea-row">
              <textarea
                ref={textareaRef}
                className="ect-textarea"
                rows={1}
                value={input}
                placeholder="e.g. Trim my_video.mp4 to the first 30 seconds"
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
                disabled={isRunning}
              />
              <button className="ect-send" onClick={handleRun} disabled={isRunning || !input.trim()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="15" height="15">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            </div>
          </div>
          <p className="ect-hint">Tasks run directly on your machine · verify results before relying on them</p>
        </div>
      </main>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
export default function EloriaCode() {
  const MAIN_CHAT_ID = "main";

  const [uid,            setUid]           = useState(null);
  const [authReady,      setAuthReady]     = useState(false);
  const [userName,       setUserName]      = useState("");
  const [userPlan,       setUserPlan]      = useState("free");
  const [projects,       setProjects]      = useState([]);
  const [activeProject,  setActiveProject] = useState(null);
  const [activeFileId,   setActiveFileId]  = useState(MAIN_CHAT_ID);
  const [messages,       setMessages]      = useState([]);
  const [input,          setInput]         = useState("");
  const [isThinking,     setIsThinking]    = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [rightTab,       setRightTab]      = useState("preview");
  const [rightFileId,    setRightFileId]   = useState(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showFileModal,  setShowFileModal]  = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newFileName,    setNewFileName]    = useState("");
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showWelcome,    setShowWelcome]    = useState(() => !localStorage.getItem("eloria_code_welcomed"));
  const [appMode, setAppMode] = useState("code"); // "code" or "tasks"
const isDesktopApp = typeof window !== "undefined" && !!window.__TAURI__;

  // Auto-build state
  const [autoBuildQueue,   setAutoBuildQueue]   = useState([]); // [{id, name}]
  const [autoBuildDone,    setAutoBuildDone]    = useState(0);  // count built
  const [autoBuildActive,  setAutoBuildActive]  = useState(-1); // current index
  const [isAutoBuild,      setIsAutoBuild]      = useState(false);
  const autoBuildRef = useRef(false); // guard against re-entry

  // Summary state
  const [projectSummary,     setProjectSummary]     = useState(null);  // { text, notes, ts, files }
  const [summaryGenerating,  setSummaryGenerating]  = useState(false);

  const fileInputRef   = useRef(null);
  const folderInputRef = useRef(null);
  const bodyRef        = useRef(null);
  const textareaRef    = useRef(null);
  const abortRef       = useRef(null);
  const statusBtnRef   = useRef(null);

  // Keep a ref to the latest project so the auto-build loop can always read current state
  const projectRef = useRef(null);
  useEffect(() => { projectRef.current = activeProject; }, [activeProject]);

  const isMainChat = activeFileId === MAIN_CHAT_ID;

  const activeFile = useMemo(() => {
    if (!activeProject || isMainChat) return null;
    return (activeProject.files || []).find(f => f.id === activeFileId) || null;
  }, [activeProject, activeFileId, isMainChat]);

  const rightFile = useMemo(() => {
    if (!activeProject) return null;
    if (rightFileId) return (activeProject.files || []).find(f => f.id === rightFileId) || null;
    return activeFile;
  }, [activeProject, rightFileId, activeFile]);

  const codeFiles = useMemo(() => (activeProject?.files || []).filter(f => !f.isPlan), [activeProject]);
  const finalPreviewDoc = useMemo(() => buildFinalPreviewDoc(activeProject?.files), [activeProject?.files]);
  const doneFiles  = useMemo(() => (activeProject?.files || []).filter(f => f.status === "done"),       [activeProject]);
  const wipFiles   = useMemo(() => (activeProject?.files || []).filter(f => f.status === "in_progress"), [activeProject]);
  const pendFiles  = useMemo(() => (activeProject?.files || []).filter(f => f.status === "pending"),    [activeProject]);

  const folderCount = pendingAttachments.filter(a => a.type === "folder").length;
  const fileCount   = pendingAttachments.filter(a => a.type === "file").length;
  const canAddFolder = folderCount < 1;
  const canAddFile   = fileCount < 2;

  // Inject styles
  useEffect(() => {
    if (!document.getElementById("eloria-ec-v7")) {
      const tag = document.createElement("style");
      tag.id = "eloria-ec-v7";
      tag.textContent = EC_STYLE;
      document.head.appendChild(tag);
    }
    ["eloria-ec","eloria-ec-v2","eloria-ec-v3","eloria-ec-v4","eloria-ec-v5","eloria-ec-v6"].forEach(id => { const el = document.getElementById(id); if (el) el.remove(); });
  }, []);

  // Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUid(u.uid); setUserName(u.displayName || "");
        try {
          const token = await u.getIdToken();
          const res = await fetch("https://eloria-trial.onrender.com/api/membership/status", { headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          setUserPlan(data.plan || "free");
        } catch {}
        const p = await loadProjects(u.uid);
        setProjects(p);
      } else { setUid(null); setProjects([]); setActiveProject(null); }
      setAuthReady(true);
    });
    return unsub;
  }, []);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [messages, isThinking, autoBuildQueue, autoBuildDone]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 120) + "px";
  }, [input]);

  useEffect(() => {
    if (uid && activeFileId && messages.length > 0) saveFileMessages(uid, activeFileId, messages);
  }, [messages, activeFileId, uid]);

  useEffect(() => {
    if (!showStatusMenu) return;
    const h = (e) => { if (statusBtnRef.current && !statusBtnRef.current.contains(e.target)) setShowStatusMenu(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [showStatusMenu]);

  // Load summary when entering a project
  useEffect(() => {
  const projectId = activeProject?.id;        
  if (!uid || !projectId) {                   
    setProjectSummary(null);
    return;
  }
  loadProjectSummary(uid, projectId).then(s => setProjectSummary(s));
}, [uid, activeProject?.id]);                  

  const updateProjects = useCallback(async (updated) => {
    setProjects(updated);
    if (uid) await saveProjects(uid, updated);
    if (activeProject) {
      const found = updated.find(p => p.id === activeProject.id);
      if (found) setActiveProject(found);
    }
  }, [uid, activeProject]);

  const updateActiveProject = useCallback(async (updater) => {
    const updated = projects.map(p => p.id === activeProject?.id ? updater(p) : p);
    await updateProjects(updated);
  }, [projects, activeProject, updateProjects]);

  // ─── GENERATE AI SUMMARY ───────────────────────────────────────────────────
  const generateSummary = useCallback(async (project, userRequest, builtFiles) => {
    if (!auth.currentUser || !project) return;
    setSummaryGenerating(true);
    try {
      const token = await auth.currentUser.getIdToken();
      const filesSummary = builtFiles.map(f => `${f.name} (${f.lines} lines, status: ${f.status})`).join(", ");
      const allFiles = (project.files || []).filter(f => !f.isPlan);

      const prompt = `You are a concise technical assistant summarizing what was just built in a coding project.

Project: "${project.name}"
User request: "${userRequest}"
Files built/updated: ${filesSummary}
All project files: ${allFiles.map(f => f.name).join(", ") || "none"}

Write a project summary with these two sections:
1. WHAT CHANGED: 3-5 bullet points describing what was actually built or changed — be specific about what each file does and how they connect.
2. KEEP IN MIND: 3-4 bullet points of important technical notes, gotchas, or things the user should know (e.g. dependencies, browser compatibility, next steps, potential issues).

Format your response as JSON exactly like this (no markdown fences, just raw JSON):
{
  "changes": ["point 1", "point 2", "point 3"],
  "notes": ["note 1", "note 2", "note 3"]
}`;

      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [
            { role: "user", content: "You are a JSON-only responder. Never add markdown fences or extra text." },
            { role: "assistant", content: "Understood. I will respond with raw JSON only." },
            { role: "user", content: prompt }
          ]
        }),
      });

      if (!res.ok) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let raw = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done || json.error) break;
            if (json.text) raw += json.text;
          } catch {}
        }
      }

      // Parse JSON from response, stripping any accidental fences
      const cleaned = raw.replace(/```json|```/g, "").trim();
      let parsed = { changes: [], notes: [] };
      try { parsed = JSON.parse(cleaned); } catch {}

      const summary = {
        changes: parsed.changes || [],
        notes: parsed.notes || [],
        request: userRequest,
        files: builtFiles.map(f => f.name),
        ts: new Date().toISOString(),
      };
      setProjectSummary(summary);
      if (uid) await saveProjectSummary(uid, project.id, summary);
    } catch (err) {
      console.error("Summary generation failed", err);
    } finally {
      setSummaryGenerating(false);
    }
  }, [uid]);

  // ─── BUILD A SINGLE FILE (used in auto-build loop) ─────────────────────────
  const buildSingleFile = useCallback(async (file, project, token, userRequest, allFilesContext) => {
    const sysCtx = `You are Eloria Code, an expert coding agent. Project: "${project.name}". 
Current task file: "${file.name}". 
All project files: ${allFilesContext}. 
The user's original request was: "${userRequest}".
Generate complete, production-ready code for "${file.name}". 
Wrap it in a fenced block: \`\`\`${getExt(file.name)} ${file.name}\n...\n\`\`\`
Do NOT explain at length — just generate the code.`;

    const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages: [
          { role: "user", content: sysCtx },
          { role: "assistant", content: "Understood. Generating the file now." },
          { role: "user", content: `Build ${file.name} for the project "${project.name}". Request: ${userRequest}` }
        ]
      }),
    });

    if (!res.ok) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let aiText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.done || json.error) break;
          if (json.text) aiText += json.text;
        } catch {}
      }
    }

    const parsed = parseFilesFromAI(aiText);
    const match = parsed.find(f => f.name.toLowerCase() === file.name.toLowerCase()) || parsed[0];
    return match ? match.code : null;
  }, []);

  // ─── AUTO-BUILD RUNNER ─────────────────────────────────────────────────────
  const runAutoBuild = useCallback(async (filesToBuild, project, userRequest) => {
    if (autoBuildRef.current) return;
    autoBuildRef.current = true;
    setIsAutoBuild(true);
    setAutoBuildQueue(filesToBuild);
    setAutoBuildDone(0);
    setAutoBuildActive(0);

    let token;
    try { token = await auth.currentUser.getIdToken(); } catch { autoBuildRef.current = false; setIsAutoBuild(false); return; }

    const allFilesContext = filesToBuild.map(f => `${f.name}(pending)`).join(", ");
    let builtResults = [];

    for (let i = 0; i < filesToBuild.length; i++) {
      const file = filesToBuild[i];
      setAutoBuildActive(i);

      // Mark file as in_progress in project state
      setProjects(prev => {
        const updated = prev.map(p => p.id === project.id
          ? { ...p, files: (p.files || []).map(f => f.id === file.id ? { ...f, status: "in_progress" } : f) }
          : p
        );
        // also update activeProject ref
        const found = updated.find(p => p.id === project.id);
        if (found) { setActiveProject(found); projectRef.current = found; }
        return updated;
      });

      let code = null;
      try {
        code = await buildSingleFile(file, project, token, userRequest, allFilesContext);
      } catch {}

      if (code) {
        const lines = code.split("\n").length;
        const now = new Date().toISOString();

        // Persist code into project
        setProjects(prev => {
          const updated = prev.map(p => p.id === project.id
            ? {
                ...p,
                files: (p.files || []).map(f =>
                  f.id === file.id
                    ? { ...f, status: "done", code, lines, updatedAt: now }
                    : f
                ),
                updatedAt: now,
              }
            : p
          );
          const found = updated.find(p => p.id === project.id);
          if (found) { setActiveProject(found); projectRef.current = found; }
          // save to Firestore
          if (uid) saveProjects(uid, updated);
          return updated;
        });

        builtResults.push({ ...file, code, lines, status: "done" });

        // Show file-created card in main chat
        setMessages(prev => [
          ...prev.filter(m => m.id !== "auto-build-progress"),
          {
            id: Date.now() + Math.random(),
            sender: "file_created",
            file: { id: file.id, name: file.name, lines },
          }
        ]);
      } else {
        // Mark back to pending on failure
        setProjects(prev => {
          const updated = prev.map(p => p.id === project.id
            ? { ...p, files: (p.files || []).map(f => f.id === file.id ? { ...f, status: "pending" } : f) }
            : p
          );
          const found = updated.find(p => p.id === project.id);
          if (found) { setActiveProject(found); projectRef.current = found; }
          return updated;
        });
        setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: "log", icon: "!", text: `Failed to build ${file.name} — you can retry from its task.` }]);
      }

      setAutoBuildDone(i + 1);
      setAutoBuildActive(i + 1 < filesToBuild.length ? i + 1 : -1);
    }

    // All done — remove progress card, generate summary
    setMessages(prev => [
      ...prev.filter(m => m.id !== "auto-build-progress"),
      { id: Date.now() + Math.random(), sender: "log", icon: "✓", text: `All ${filesToBuild.length} file${filesToBuild.length > 1 ? "s" : ""} built. Opening Summary tab…` }
    ]);

    setIsAutoBuild(false);
    autoBuildRef.current = false;
    setAutoBuildQueue([]);
    setAutoBuildDone(0);
    setAutoBuildActive(-1);

    // Switch right panel to summary and generate summary
    setRightTab("summary");
    const currentProject = projectRef.current || project;
    await generateSummary(currentProject, userRequest, builtResults);
  }, [uid, buildSingleFile, generateSummary]);

  // Project actions
  const createProject = async () => {
    if (!newProjectName.trim() || !uid) return;
    const now = new Date().toISOString();
    const prdFile = {
      id: Date.now(), name: "feature-prd.md", status: "done", isPlan: true,
      code: generatePRDMarkdown({ name: newProjectName.trim(), description: newProjectDesc.trim() }),
      lines: 8, createdAt: now, updatedAt: now,
    };
    const project = { id: Date.now() + 1, name: newProjectName.trim(), description: newProjectDesc.trim() || "", files: [prdFile], createdAt: now, updatedAt: now };
    const updated = [project, ...projects];
    await updateProjects(updated);
    setNewProjectName(""); setNewProjectDesc(""); setShowProjectModal(false);
    setActiveProject(project);
    setActiveFileId(MAIN_CHAT_ID);
    setMessages([]);
    setRightFileId(prdFile.id);
  };

  const deleteProject = async (e, projectId) => {
    e.stopPropagation();
    const project = projects.find(p => p.id === projectId);
    if (project) {
      for (const f of (project.files || [])) await deleteFileMessages(uid, f.id);
      await deleteFileMessages(uid, MAIN_CHAT_ID + "_" + projectId);
    }
    const updated = projects.filter(p => p.id !== projectId);
    setProjects(updated);
    if (uid) await saveProjects(uid, updated);
    if (activeProject?.id === projectId) { setActiveProject(null); setActiveFileId(MAIN_CHAT_ID); setMessages([]); }
  };

  const enterProject = async (project) => {
    setActiveProject(project);
    setInput(""); setPendingAttachments([]);
    setRightFileId(null);
    setActiveFileId(MAIN_CHAT_ID);
    const mainKey = MAIN_CHAT_ID + "_" + project.id;
    setMessages(uid ? await loadFileMessages(uid, mainKey) : []);
  };

  useEffect(() => {
    if (!uid || !activeProject) return;
    if (activeFileId === MAIN_CHAT_ID && messages.length > 0) {
      saveFileMessages(uid, MAIN_CHAT_ID + "_" + activeProject.id, messages);
    }
  }, [messages, activeFileId, uid, activeProject]);

  const createFile = async () => {
    if (!newFileName.trim() || !activeProject) return;
    const file = { id: Date.now(), name: newFileName.trim(), status: "pending", code: null, lines: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await updateActiveProject(p => ({ ...p, files: [...(p.files || []), file], updatedAt: new Date().toISOString() }));
    setNewFileName(""); setShowFileModal(false);
    switchToTask(file.id);
  };

  const deleteFile = async (e, fileId) => {
    e.stopPropagation();
    await deleteFileMessages(uid, fileId);
    await updateActiveProject(p => ({ ...p, files: (p.files || []).filter(f => f.id !== fileId), updatedAt: new Date().toISOString() }));
    if (activeFileId === fileId) {
      setActiveFileId(MAIN_CHAT_ID);
      const mainKey = MAIN_CHAT_ID + "_" + activeProject.id;
      setMessages(uid ? await loadFileMessages(uid, mainKey) : []);
    }
    if (rightFileId === fileId) setRightFileId(null);
  };

  const switchToMain = async () => {
    if (uid && activeFileId && activeFileId !== MAIN_CHAT_ID) {
      await saveFileMessages(uid, activeFileId, messages);
    }
    setActiveFileId(MAIN_CHAT_ID);
    setInput(""); setPendingAttachments([]);
    const mainKey = MAIN_CHAT_ID + "_" + activeProject.id;
    setMessages(uid ? await loadFileMessages(uid, mainKey) : []);
  };

  const switchToTask = async (fileId) => {
    if (uid && activeFileId) {
      if (activeFileId === MAIN_CHAT_ID) {
        await saveFileMessages(uid, MAIN_CHAT_ID + "_" + activeProject.id, messages);
      } else {
        await saveFileMessages(uid, activeFileId, messages);
      }
    }
    setActiveFileId(fileId);
    setRightFileId(fileId);
    setInput(""); setPendingAttachments([]);
    setMessages(uid ? await loadFileMessages(uid, fileId) : []);
  };

  const updateFileStatus = async (fileId, status) => {
    await updateActiveProject(p => ({ ...p, files: (p.files || []).map(f => f.id === fileId ? { ...f, status, updatedAt: new Date().toISOString() } : f), updatedAt: new Date().toISOString() }));
    setShowStatusMenu(false);
  };

  const pushLog = (text, extra = {}) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: "log", text, ...extra }]);
  };

  const runShellCommand = async (program, args) => {
  if (!isDesktopApp) {
    pushLog(`Can't run "${program}" — this feature requires the desktop app.`, { icon: "!" });
    return null;
  }
  pushLog(`Running: ${program} ${args.join(" ")}`, { icon: "▸" });
  try {
    const output = await invoke("run_shell_command", { program, args });
    pushLog(`✓ ${program} finished`, { icon: "✓", kind: "build", diff: null });
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: "ai", text: "```\n" + output + "\n```" }]);
    return output;
  } catch (err) {
    pushLog(`✗ ${program} failed`, { icon: "!" });
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), sender: "ai", text: `Command failed:\n\`\`\`\n${err}\n\`\`\`` }]);
    return null;
  }
};

  const readFileAsText = (file) => new Promise(resolve => { const r = new FileReader(); r.onload = e => resolve(e.target.result); r.onerror = () => resolve("[could not read]"); r.readAsText(file); });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = "";
    const supported = files.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported code files found."); return; }
    const toAdd = supported.slice(0, 2 - fileCount);
    const af = await Promise.all(toAdd.map(async f => ({ name: f.name, size: f.size, content: await readFileAsText(f) })));
    setPendingAttachments(prev => [...prev, ...af.map(f => ({ id: Date.now() + Math.random(), type: "file", name: f.name, files: [f] }))]);
  };

  const handleFolderSelect = async (e) => {
    const all = Array.from(e.target.files || []); e.target.value = "";
    const supported = all.filter(f => isSupportedFile(f.name));
    if (!supported.length) { alert("No supported files found."); return; }
    const folderName = (supported[0].webkitRelativePath || supported[0].name).split("/")[0] || "folder";
    const af = await Promise.all(supported.map(async f => ({ name: f.name, relativePath: f.webkitRelativePath || f.name, size: f.size, content: await readFileAsText(f) })));
    setPendingAttachments(prev => [...prev, { id: Date.now() + Math.random(), type: "folder", name: folderName, files: af }]);
  };

  // ─── SEND MESSAGE ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const hasText = input.trim().length > 0;
    const hasAttachments = pendingAttachments.length > 0;
    if ((!hasText && !hasAttachments) || isThinking || isAutoBuild) return;
    if (!auth.currentUser) return;
    if (!isMainChat && !activeFile) return;

    const token = await auth.currentUser.getIdToken();
    setIsThinking(true);

    let attachCtx = "";
    if (hasAttachments) {
      attachCtx = pendingAttachments.map(att => {
        const h = att.type === "folder" ? `\n\n[FOLDER: "${att.name}" — ${att.files.length} files]\n` : `\n\n[FILE: "${att.name}"]\n`;
        return h + att.files.map(f => `--- ${f.relativePath || f.name} ---\n${f.content}\n`).join("\n");
      }).join("\n");
    }

    // System context for main chat — instruct AI to list FILES_TO_BUILD when it's a code request
    const sysCtx = isMainChat
      ? `You are Eloria Code, an expert coding AI assistant. Project: "${activeProject.name}". 
This is the main project chat. You help the user plan, coordinate, and build their project.
Project files: ${(activeProject.files || []).map(f => `${f.name}(${f.status})`).join(", ") || "none yet"}.

IMPORTANT INSTRUCTIONS:
- When the user asks you to build something (a website, app, script, or any code), respond with:
  1. A brief plan (2-3 sentences max) of what you'll build.
  2. A list of files you'll create using this exact format on its own line:
     FILES_TO_BUILD: filename1.ext, filename2.ext, filename3.ext
  3. Do NOT write code in the main chat. The files will be auto-built as separate tasks.
- Split code logically: HTML in its own file, CSS in its own file, JS in its own file (etc).
- For non-code questions (planning, advice), just answer conversationally without FILES_TO_BUILD.`
      : `You are Eloria Code, an expert coding agent. Project: "${activeProject.name}". Current task file: "${activeFile.name}". All project files: ${(activeProject.files || []).map(f => `${f.name}(${f.status})`).join(", ")}. When you produce code for "${activeFile.name}", use a fenced block: \`\`\`${getExt(activeFile.name)} ${activeFile.name}\n...\n\`\`\`. Do NOT explain the code at length in chat — just generate it. If additional files are needed list them as: FILES_NEEDED: file1.ext, file2.ext`;

    const capturedInput = input.trim();
    const userMsg = { id: Date.now(), sender: "user", text: hasText ? capturedInput : "", attachments: hasAttachments ? [...pendingAttachments] : undefined };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs); setInput(""); setPendingAttachments([]);

    const apiMessages = [
      { role: "user", content: sysCtx },
      { role: "assistant", content: "Understood." },
      ...newMsgs.filter(m => m.text || m.attachments).map(m => ({
        role: m.sender === "user" ? "user" : "assistant",
        content: m.sender === "user" ? (m.attachments?.length ? `${attachCtx}\n\n${m.text || ""}`.trim() : m.text) : (m.text || ""),
      }))
    ];

    try {
      if (!isMainChat) pushLog(`Working on ${activeFile.name}…`, { icon: "⚙" });
      else pushLog(`Thinking…`, { icon: "⚙", id: "thinking-log" });

      const res = await fetch("https://eloria-trial.onrender.com/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: apiMessages }),
        signal,
      });

      if (res.status === 403) { setIsThinking(false); alert("Eloria Code requires a Pro plan."); return; }
      if (res.status === 429) { setShowLimitModal(true); setIsThinking(false); return; }
      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let aiText = "";
      const aiMsgId = Date.now() + 1;

      if (isMainChat) {
        setMessages(prev => [...prev.filter(m => m.id !== "thinking-log"), { id: aiMsgId, sender: "ai", text: "" }]);
      }
      setIsThinking(false);

      while (true) {
        if (signal.aborted) break;
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const json = JSON.parse(line.slice(6));
            if (json.done || json.error) break;
            if (json.text) {
              aiText += json.text;
              if (isMainChat) {
                const snap = aiText;
                setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: snap } : m));
              }
            }
          } catch {}
        }
      }

      // ── MAIN CHAT: detect FILES_TO_BUILD ───────────────────────────────────
      if (isMainChat) {
        const filesToBuildMatch = aiText.match(/FILES_TO_BUILD:\s*([^\n]+)/i);
        if (filesToBuildMatch) {
          const fileNames = filesToBuildMatch[1].split(",").map(f => f.trim()).filter(Boolean);
          if (fileNames.length > 0) {
            const now = new Date().toISOString();

            // Strip FILES_TO_BUILD line from displayed text
            const cleanText = aiText.replace(/FILES_TO_BUILD:[^\n]*/i, "").trim();

            // Replace streaming ai bubble with clean text
            setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: cleanText } : m));

            // Create task files in the project
            let newFiles = [];
            setProjects(prev => {
              const updated = prev.map(p => {
                if (p.id !== activeProject.id) return p;
                const existingNames = new Set((p.files || []).map(f => f.name.toLowerCase()));
                const toAdd = [];
                for (const name of fileNames) {
                  if (!existingNames.has(name.toLowerCase())) {
                    const nf = { id: Date.now() + Math.random(), name, status: "pending", code: null, lines: 0, createdAt: now, updatedAt: now };
                    toAdd.push(nf);
                    existingNames.add(name.toLowerCase());
                    newFiles.push(nf);
                  }
                }
                return { ...p, files: [...(p.files || []), ...toAdd], updatedAt: now };
              });
              const found = updated.find(p => p.id === activeProject.id);
              if (found) { setActiveProject(found); projectRef.current = found; }
              if (uid) saveProjects(uid, updated);
              return updated;
            });

            // Add a build-progress sentinel message
            setMessages(prev => [...prev, { id: "auto-build-progress", sender: "auto_build_start", files: newFiles }]);

            // Kick off auto-build after a short delay so state settles
            setTimeout(() => {
              const currentProject = projectRef.current;
              runAutoBuild(newFiles, currentProject, capturedInput);
            }, 300);

            return; // done for this send
          }
        }

        // No FILES_TO_BUILD — handle regular code or conversation reply
        const parsedFiles = parseFilesFromAI(aiText);
        if (parsedFiles.length > 0) {
          let builtFiles = [];
          const now = new Date().toISOString();
          setProjects(prev => {
            const updated = prev.map(p => {
              if (p.id !== activeProject.id) return p;
              let files = [...(p.files || [])];
              const existingNames = new Set(files.map(f => f.name.toLowerCase()));
              for (const pf of parsedFiles) {
                const idx = files.findIndex(f => f.name.toLowerCase() === pf.name.toLowerCase());
                if (idx >= 0) {
                  files[idx] = { ...files[idx], status: "done", code: pf.code, lines: pf.code.split("\n").length, updatedAt: now };
                  builtFiles.push(files[idx]);
                } else {
                  const nf = { id: Date.now() + Math.random(), name: pf.name, status: "done", code: pf.code, lines: pf.code.split("\n").length, createdAt: now, updatedAt: now };
                  files.push(nf);
                  builtFiles.push(nf);
                  existingNames.add(pf.name.toLowerCase());
                }
              }
              return { ...p, files, updatedAt: now };
            });
            const found = updated.find(p => p.id === activeProject.id);
            if (found) { setActiveProject(found); projectRef.current = found; }
            if (uid) saveProjects(uid, updated);
            return updated;
          });

          setMessages(prev => {
            const filtered = prev.filter(m => m.id !== aiMsgId);
            const cards = builtFiles.map(f => ({ id: Date.now() + Math.random(), sender: "file_created", file: { id: f.id, name: f.name, lines: f.lines } }));
            return [...filtered, ...cards];
          });

          setRightTab("summary");
          generateSummary(projectRef.current || activeProject, capturedInput, builtFiles);
        }
        // else: just a conversational reply, already streamed in
        return;
      }

      // ── TASK CHAT: existing logic ──────────────────────────────────────────
      const parsedFiles = parseFilesFromAI(aiText);
      const filesNeededMatch = aiText.match(/FILES_NEEDED:\s*([^\n]+)/i);
      const filesNeeded = filesNeededMatch ? filesNeededMatch[1].split(",").map(f => f.trim()).filter(Boolean) : [];

      if (parsedFiles.length > 0 && activeProject) {
        let builtFiles = [];
        await updateActiveProject(p => {
          let files = [...(p.files || [])];
          const existingNames = new Set(files.map(f => f.name.toLowerCase()));
          const currentParsed = parsedFiles.find(f => f.name.toLowerCase() === activeFile.name.toLowerCase()) || parsedFiles[0];
          files = files.map(f => f.id === activeFileId
            ? { ...f, status: "done", code: currentParsed.code, lines: currentParsed.code.split("\n").length, updatedAt: new Date().toISOString() }
            : f
          );
          builtFiles.push({ ...activeFile, code: currentParsed.code, lines: currentParsed.code.split("\n").length });
          for (const fn of filesNeeded) {
            if (!existingNames.has(fn.toLowerCase())) {
              files.push({ id: Date.now() + Math.random(), name: fn, status: "pending", code: null, lines: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
              existingNames.add(fn.toLowerCase());
            }
          }
          return { ...p, files, updatedAt: new Date().toISOString() };
        });

        setMessages(prev => {
          const filtered = prev.filter(m => !(m.sender === "log" && m.icon === "⚙"));
          return [...filtered, {
            id: Date.now() + Math.random(),
            sender: "log",
            kind: "build",
            icon: "✓",
            text: `Built ${activeFile?.name || builtFiles[0]?.name}`,
            diff: `+${builtFiles[0]?.lines || 0} lines`,
            file: activeFile?.name || builtFiles[0]?.name,
          }];
        });
        setRightTab("code");
        setRightFileId(activeFileId);

        // Also generate summary for task builds
        generateSummary(projectRef.current || activeProject, capturedInput, builtFiles);

      } else if (!isMainChat && aiText.length > 60 && activeFile?.status === "pending") {
        setMessages(prev => {
          const filtered = prev.filter(m => !(m.sender === "log" && m.icon === "⚙"));
          return [...filtered, { id: aiMsgId, sender: "ai", text: aiText }];
        });
        await updateActiveProject(p => ({ ...p, files: (p.files || []).map(f => f.id === activeFileId ? { ...f, status: "in_progress", updatedAt: new Date().toISOString() } : f), updatedAt: new Date().toISOString() }));
      } else if (!isMainChat && aiText.length > 0 && parsedFiles.length === 0) {
        setMessages(prev => {
          const filtered = prev.filter(m => !(m.sender === "log" && m.icon === "⚙"));
          return [...filtered, { id: aiMsgId, sender: "ai", text: aiText }];
        });
      }

    } catch (err) {
      if (err.name !== "AbortError") {
        setIsThinking(false);
        setMessages(prev => [...prev, { id: Date.now() + 2, sender: "ai", text: "Eloria Code couldn't respond. Check your connection." }]);
      }
      setIsThinking(false);
    }
  };

  const stopMessage = () => { if (abortRef.current) abortRef.current.abort(); setIsThinking(false); };

  const limitHint = (() => {
    const parts = [];
    if (folderCount >= 1) parts.push("1 folder max");
    if (fileCount >= 2) parts.push("2 files max");
    return parts.length ? `Limit reached — ${parts.join(", ")} per message` : null;
  })();

  if (!authReady) return null;
  if (!uid) return <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100dvh", fontFamily:"var(--font,sans-serif)", fontSize:13, color:"#555", background:"#111" }}>Please log in to use Eloria Code.</div>;
  if (window.innerWidth <= 768) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100dvh", background:"#111", padding:"32px 24px", textAlign:"center", gap:20, fontFamily:"var(--font,sans-serif)" }}>
      <div style={{ width:56, height:56, borderRadius:15, background:"rgba(255,255,255,.06)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>💻</div>
      <div>
        <div style={{ fontSize:18, fontWeight:600, color:"#e8e8e8", marginBottom:8 }}>Desktop only</div>
        <div style={{ fontSize:13, color:"#a0a0a0", lineHeight:1.65, maxWidth:260 }}>Eloria Code is designed for desktop.</div>
      </div>
    </div>
  );

  // ── PROJECTS SCREEN ──────────────────────────────────────────────────────
  if (!activeProject) return (
    <div className="ec-root">
      <input ref={fileInputRef} type="file" multiple style={{ display:"none" }} onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple style={{ display:"none" }} onChange={handleFolderSelect} />
      {showWelcome && <EloriaCodeWelcome onDismiss={() => setShowWelcome(false)} userName={userName} />}

      <div className="ec-topbar">
        <div className="ec-topbar-logo"><img src={logo} alt="Eloria" /></div>
        <span className="ec-topbar-title">Eloria Workspace</span>
        <div className="ec-topbar-sep" />
        <div className="ec-mode-tabs">
          <button className={`ec-mode-tab${appMode === "code" ? " active" : ""}`} onClick={() => setAppMode("code")}>Code</button>
          <button className={`ec-mode-tab${appMode === "tasks" ? " active" : ""}`} onClick={() => setAppMode("tasks")}>Tasks</button>
        </div>
        <div className="ec-topbar-spacer" />
        <button className="ec-topbar-btn solid" onClick={() => setShowProjectModal(true)}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Project
        </button>
      </div>

      {appMode === "tasks" ? (
  <EloriaTasks isDesktopApp={isDesktopApp} uid={uid} />
) : (

      <div className="ec-projects-screen">
        <div className="ec-projects-body">
          <div className="ec-projects-heading">Projects</div>
          <div className="ec-projects-subheading">Select a project or create a new one to start coding.</div>
          {projects.length === 0 ? (
            <div className="ec-projects-empty">
              <div className="ec-projects-empty-icon"></div>
              <div className="ec-projects-empty-text">No projects yet.<br />Create one to get started.</div>
            </div>
          ) : (
            <div className="ec-projects-grid">
              {projects.map(project => (
                <div key={project.id} className="ec-project-card" onClick={() => enterProject(project)}>
                  <button className="ec-project-card-del" onClick={e => deleteProject(e, project.id)}>✕</button>
                  <div className="ec-project-card-icon"></div>
                  <div>
                    <div className="ec-project-card-title">{project.name}</div>
                    {project.description && <div style={{ fontSize:11, color:"var(--t3)", marginTop:3 }}>{project.description}</div>}
                  </div>
                  <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                    {(project.files || []).filter(f => !f.isPlan).slice(0, 5).map(f => <span key={f.id} className="ec-project-file-chip">{f.name}</span>)}
                    {(project.files || []).filter(f => !f.isPlan).length > 5 && <span className="ec-project-file-chip">+{(project.files || []).filter(f => !f.isPlan).length - 5}</span>}
                  </div>
                  <div className="ec-project-card-meta">
                    <span>{(project.files || []).filter(f => !f.isPlan).length} file{(project.files || []).filter(f => !f.isPlan).length !== 1 ? "s" : ""}</span>
                    <span>·</span>
                    <span>{timeAgo(project.updatedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      )}

      {showProjectModal && (
        <div className="ec-modal-backdrop" onClick={() => setShowProjectModal(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <div className="ec-modal-title"><div className="ec-modal-title-icon"></div>New Project</div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Project name</label>
              <input className="ec-modal-input" placeholder="e.g. Portfolio Website, Chat App" value={newProjectName} autoFocus onChange={e => setNewProjectName(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} />
            </div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Description (optional)</label>
              <input className="ec-modal-input" placeholder="What are you building?" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && createProject()} />
            </div>
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setShowProjectModal(false)}>Cancel</button>
              <button className="ec-modal-create" onClick={createProject} disabled={!newProjectName.trim()}>Create Project</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── WORKSPACE ────────────────────────────────────────────────────────────
  const renderTaskSection = (sectionFiles, label, status) => {
    if (!sectionFiles.length) return null;
    return (
      <div key={status}>
        <div className="ec-task-section-label">{label.toUpperCase()} <span className="ec-count">{sectionFiles.length}</span></div>
        {sectionFiles.map(file => (
          <div
            key={file.id}
            className={`ec-task-item${file.status === "pending" ? " pending" : ""}${file.id === activeFileId ? " active" : ""}`}
            onClick={() => switchToTask(file.id)}
          >
            <span className={`ec-task-dot ${file.status}`} />
            <div className="ec-task-info">
              <div className="ec-task-title">{taskTitleForFile(file.name)}</div>
              <div className="ec-task-sub">{file.isPlan ? "Plan document" : file.name}{file.lines > 0 && !file.isPlan ? ` · ${file.lines} lines` : ""}</div>
            </div>
            {!file.isPlan && <button className="ec-task-del" onClick={e => deleteFile(e, file.id)}>✕</button>}
          </div>
        ))}
      </div>
    );
  };

  // ── RIGHT PANEL CONTENT ───────────────────────────────────────────────────
  const rightContent = () => {
    const rf = rightFile;

    if (rightTab === "summary") {
      return (
        <div className="ec-summary-body">
          {/* AI-generated living summary */}
          <div className="ec-ai-summary">
            <div className="ec-ai-summary-header">
              <div className="ec-ai-summary-icon">✦</div>
              <span className="ec-ai-summary-label">Build Summary</span>
              {projectSummary?.ts && <span className="ec-ai-summary-ts">{timeAgo(projectSummary.ts)}</span>}
              {projectSummary && !summaryGenerating && (
                <button className="ec-ai-summary-regen" onClick={() => {
                  const allBuilt = (activeProject?.files || []).filter(f => !f.isPlan && f.status === "done" && f.code);
                  generateSummary(activeProject, projectSummary.request || "latest build", allBuilt);
                }}>↻ Refresh</button>
              )}
            </div>
            {summaryGenerating ? (
              <div className="ec-ai-summary-generating">
                <div className="ec-thinking-dots"><span/><span/><span/></div>
                Generating summary…
              </div>
            ) : projectSummary ? (
              <div className="ec-ai-summary-body">
                {projectSummary.changes?.length > 0 && (
                  <div style={{ marginBottom: 12 }}>
                    <div className="ec-summary-block-label">What Changed</div>
                    <div className="ec-summary-list">
                      {projectSummary.changes.map((c, i) => (
                        <div key={i} className="ec-summary-list-item">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {projectSummary.notes?.length > 0 && (
                  <div className="ec-summary-notes">
                    <div className="ec-summary-notes-label">Keep in Mind</div>
                    <div className="ec-summary-notes-list">
                      {projectSummary.notes.map((n, i) => (
                        <div key={i} className="ec-summary-notes-item">{n}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding:"14px 12px", fontSize:11.5, color:"var(--t3)", lineHeight:1.6 }}>
                No summary yet. Ask Eloria to build something and a summary will appear here automatically.
              </div>
            )}
          </div>

          {/* Files built */}
          <div>
            <div className="ec-summary-block-label">Files in Project</div>
            <div className="ec-summary-chip-row">
              {codeFiles.length === 0 && <div style={{ fontSize:12, color:"var(--t3)" }}>No files yet.</div>}
              {codeFiles.map(f => (
                <div key={f.id} className="ec-summary-file-chip" onClick={() => { setRightFileId(f.id); setRightTab("code"); }}>
                  {getFileIcon(f.name)} {f.name}
                  <span style={{ fontSize:9, color: f.status === "done" ? "var(--success)" : "var(--t3)", marginLeft:2 }}>{f.status === "done" ? "✓" : f.status === "in_progress" ? "…" : "○"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Overall status */}
          <div>
            <div className="ec-summary-block-label">Status</div>
            {(() => {
              const allReady = codeFiles.length > 0 && codeFiles.every(f => f.status === "done");
              return (
                <span className={`ec-summary-status-badge ${allReady ? "ready" : "progress"}`}>
                  {isAutoBuild
                    ? `● Building ${autoBuildDone}/${autoBuildQueue.length}…`
                    : allReady
                      ? "✓ Ready for review"
                      : "● In progress"}
                </span>
              );
            })()}
          </div>
        </div>
      );
    }

    if (rightTab === "final") {
      if (!finalPreviewDoc) {
        return (
          <div className="ec-preview-placeholder">
            <div className="ec-preview-placeholder-icon">🖥</div>
            <div className="ec-preview-placeholder-text">
              Final Preview needs a built HTML file.<br/>
              Build your HTML (and any CSS/JS) first — they'll combine here automatically.
            </div>
          </div>
        );
      }
      return <iframe className="ec-preview-frame" srcDoc={finalPreviewDoc} title="Final Preview" sandbox="allow-scripts allow-same-origin" />;
    }

    if (!rf) return <div className="ec-no-content"><div className="ec-no-content-icon"></div><div className="ec-no-content-text">Select a task to view code or preview.</div></div>;

    if (rightTab === "preview") {
      const ext = getExt(rf.name);
      if (rf.isPlan) return <div className="ec-preview-placeholder"><div className="ec-preview-placeholder-icon"></div><div className="ec-preview-placeholder-text">Plan document has no live preview.<br/>Open the Code tab to read it.</div></div>;
      if (!rf.code) return <div className="ec-preview-placeholder"><div className="ec-preview-placeholder-icon">👁</div><div className="ec-preview-placeholder-text">{rf.status === "pending" ? "File hasn't been generated yet." : "No code yet."}</div></div>;

      if (["html","htm"].includes(ext)) {
        const blob = new Blob([rf.code], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        return <iframe className="ec-preview-frame" src={url} title="Preview" sandbox="allow-scripts allow-same-origin" />;
      }

      if (ext === "css") {
        const htmlFile = (activeProject?.files || []).find(f => ["html","htm"].includes(getExt(f.name)) && f.code);
        let previewDoc;
        if (htmlFile) {
          const cssTag = `<style>\n${rf.code}\n</style>`;
          if (htmlFile.code.includes("</head>")) {
            previewDoc = htmlFile.code.replace("</head>", `${cssTag}\n</head>`);
          } else if (htmlFile.code.includes("<head>")) {
            previewDoc = htmlFile.code.replace("<head>", `<head>\n${cssTag}`);
          } else {
            previewDoc = `<!doctype html><html><head>${cssTag}</head><body>${htmlFile.code}</body></html>`;
          }
        } else {
          previewDoc = `<!doctype html><html><head><meta charset="utf-8"><style>${rf.code}</style></head><body>
<div class="container">
  <header class="header"><nav class="nav"><a class="nav-link" href="#">Home</a><a class="nav-link" href="#">About</a><a class="nav-link" href="#">Contact</a></nav></header>
  <main class="main">
    <section class="hero"><h1 class="title">CSS Preview</h1><p class="subtitle">Your styles applied to a sample page.</p><button class="btn">Get Started</button></section>
    <section class="section"><div class="card"><h2 class="card-title">Card Component</h2><p class="card-text">This shows how your styles render on common elements like cards, buttons, and typography.</p></div></section>
  </main>
  <footer class="footer"><p>&copy; 2024 Preview</p></footer>
</div>
</body></html>`;
        }
        const blob = new Blob([previewDoc], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        return <iframe className="ec-preview-frame" src={url} title="CSS Preview" sandbox="allow-scripts allow-same-origin" />;
      }

      return <div className="ec-preview-placeholder"><div className="ec-preview-placeholder-icon">👁</div><div className="ec-preview-placeholder-text">Live preview is available for HTML and CSS files only.</div></div>;
    }

    if (rightTab === "code") {
      if (!rf.code) return <div className="ec-no-content"><div className="ec-no-content-icon">{rf.status === "pending" ? "" : ""}</div><div className="ec-no-content-text">{rf.status === "pending" ? "Pending generation." : "No code yet."}</div></div>;
      return <CodeViewer code={rf.code} filename={rf.name} />;
    }
  };

  // ── MIDDLE PANEL CONTENT ─────────────────────────────────────────────────
  const middleContent = () => {
    if (isMainChat) {
      if (!messages.length) return (
        <div className="ec-pending-view">
          <div className="ec-pending-icon"></div>
          <div className="ec-pending-title">{activeProject.name}</div>
          <div className="ec-pending-sub">This is the main chat. Ask Eloria to build your project and files will be created and built automatically.</div>
        </div>
      );
      return (
        <div className="ec-feed">
          {messages.map(msg => {
            // Auto-build progress sentinel
            if (msg.sender === "auto_build_start") {
              return (
                <AutoBuildProgress
                  key={msg.id}
                  files={autoBuildQueue.length > 0 ? autoBuildQueue : msg.files}
                  doneCount={autoBuildDone}
                  activeIdx={autoBuildActive}
                />
              );
            }
            if (msg.sender === "file_created") {
              return (
                <FileCreatedCard
                  key={msg.id}
                  file={msg.file}
                  onView={(fid) => { setRightFileId(fid); setRightTab("code"); }}
                />
              );
            }
            if (msg.sender === "log") {
              if (msg.kind === "build") {
                return (
                  <div key={msg.id} className="ec-log-card">
                    <div className="ec-log-card-head">
                      <span className="ec-log-card-icon">{msg.icon || "✓"}</span>
                      <span className="ec-log-card-title">{msg.text}</span>
                    </div>
                    {msg.diff && (
                      <div className="ec-log-diff">
                        <span className="add">{msg.diff}</span>
                        {msg.file && <span className="file-chip">{msg.file}</span>}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <div key={msg.id} className="ec-log-row">
                  <span className="ec-log-row-icon">{msg.icon || "·"}</span>
                  <span className="ec-log-row-text">{msg.text}</span>
                </div>
              );
            }
            if (msg.sender === "user") {
              return (
                <div key={msg.id} className="ec-user-row">
                  {msg.attachments?.length > 0 ? (
                    <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                      {msg.attachments.map(att => <AttachmentBubble key={att.id} attachment={{ ...att, userText: msg.attachments.length === 1 ? msg.text : undefined }} />)}
                      {msg.attachments.length > 1 && msg.text && <div className="ec-user-bubble">{msg.text}</div>}
                    </div>
                  ) : (
                    <div className="ec-user-bubble">{msg.text}</div>
                  )}
                </div>
              );
            }
            // ai message
            return (
              <div key={msg.id} className="ec-log-card">
                <div className="ec-log-card-head">
                  <span className="ec-log-card-icon"></span>
                  <span className="ec-log-card-title">Eloria</span>
                </div>
                <div className="ec-log-card-body"><MarkdownMessage content={msg.text} /></div>
              </div>
            );
          })}
          {isThinking && <div className="ec-thinking"><div className="ec-thinking-dots"><span/><span/><span/></div></div>}
        </div>
      );
    }

    // Task chat
    if (!activeFile) return null;

    if (activeFile.isPlan) return (
      <div className="ec-plan-view">
        <div className="ec-plan-card">
          <div className="ec-plan-card-header">
            <span className="ec-plan-card-icon">≡</span>
            <span className="ec-plan-card-name">{activeFile.name}</span>
            <span className="ec-plan-card-badge">Drafted</span>
          </div>
          <div className="ec-plan-card-body">
            <MarkdownMessage content={activeFile.code} />
          </div>
        </div>
      </div>
    );

    if (activeFile.status === "pending" && !messages.length) return (
      <div className="ec-pending-view">
        <div className="ec-pending-icon"></div>
        <div className="ec-pending-title">{taskTitleForFile(activeFile.name)}</div>
        <div className="ec-pending-sub">This task is pending. Describe what {activeFile.name} should do and Eloria will build it.</div>
      </div>
    );

    return (
      <div className="ec-feed">
        {messages.map(msg => {
          if (msg.sender === "log") {
            if (msg.kind === "build") {
              return (
                <div key={msg.id} className="ec-log-card">
                  <div className="ec-log-card-head">
                    <span className="ec-log-card-icon">{msg.icon || "✓"}</span>
                    <span className="ec-log-card-title">{msg.text}</span>
                  </div>
                  {msg.diff && (
                    <div className="ec-log-diff">
                      <span className="add">{msg.diff}</span>
                      {msg.file && <span className="file-chip">{msg.file}</span>}
                    </div>
                  )}
                </div>
              );
            }
            return (
              <div key={msg.id} className="ec-log-row">
                <span className="ec-log-row-icon">{msg.icon || "·"}</span>
                <span className="ec-log-row-text">{msg.text}</span>
              </div>
            );
          }
          if (msg.sender === "user") {
            return (
              <div key={msg.id} className="ec-user-row">
                {msg.attachments?.length > 0 ? (
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {msg.attachments.map(att => <AttachmentBubble key={att.id} attachment={{ ...att, userText: msg.attachments.length === 1 ? msg.text : undefined }} />)}
                    {msg.attachments.length > 1 && msg.text && <div className="ec-user-bubble">{msg.text}</div>}
                  </div>
                ) : (
                  <div className="ec-user-bubble">{msg.text}</div>
                )}
              </div>
            );
          }
          return (
            <div key={msg.id} className="ec-log-card">
              <div className="ec-log-card-head">
                <span className="ec-log-card-icon"></span>
                <span className="ec-log-card-title">Eloria</span>
              </div>
              <div className="ec-log-card-body"><MarkdownMessage content={msg.text} /></div>
            </div>
          );
        })}
        {isThinking && <div className="ec-thinking"><div className="ec-thinking-dots"><span/><span/><span/></div></div>}
      </div>
    );
  };

  return (
    <div className="ec-root">
      <input ref={fileInputRef} type="file" multiple accept={[...SUPPORTED_EXTS].map(e => `.${e}`).join(",")} style={{ display:"none" }} onChange={handleFileSelect} />
      <input ref={folderInputRef} type="file" webkitdirectory="true" directory="true" multiple style={{ display:"none" }} onChange={handleFolderSelect} />
      {showWelcome && <EloriaCodeWelcome onDismiss={() => setShowWelcome(false)} userName={userName} />}

    <div className="ec-topbar">
        <div className="ec-topbar-logo"><img src={logo} alt="Eloria" /></div>
        <span className="ec-topbar-title">Eloria Workspace</span>
        <div className="ec-topbar-sep" />
        <div className="ec-mode-tabs">
          <button className={`ec-mode-tab${appMode === "code" ? " active" : ""}`} onClick={() => setAppMode("code")}>Code</button>
          <button className={`ec-mode-tab${appMode === "tasks" ? " active" : ""}`} onClick={() => setAppMode("tasks")}>Tasks</button>
        </div>
        <div className="ec-topbar-badge">Eloria Code</div>
        <div className="ec-topbar-spacer" />
        <button className="ec-topbar-btn ghost" onClick={() => setShowFileModal(true)}>Add File</button>
        <button className="ec-topbar-btn solid" onClick={() => { switchToMain(); textareaRef.current?.focus(); }}>Main Chat</button>
      </div>

       {appMode === "tasks" ? (
        <EloriaTasks isDesktopApp={isDesktopApp} uid={uid} />
      ) : (

      <div className="ec-workspace">
        {/* LEFT — task sidebar */}
        <aside className="ec-sidebar">
          <div className="ec-sidebar-top">
            <button className="ec-back-btn" onClick={() => { setActiveProject(null); setActiveFileId(MAIN_CHAT_ID); setMessages([]); }} title="All projects">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <span className="ec-sidebar-project-name">{activeProject.name}</span>
            <button className="ec-new-file-btn" onClick={() => setShowFileModal(true)} title="Add file">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          </div>

          <div className="ec-task-list">
            <div className="ec-task-section-label">PROJECT</div>
            <div
              className={`ec-task-item main-chat${isMainChat ? " active" : ""}`}
              onClick={switchToMain}
            >
              <span className="ec-task-dot main" />
              <div className="ec-task-info">
                <div className="ec-task-title">Main Chat</div>
                <div className="ec-task-sub">Project conversation</div>
              </div>
            </div>

            {(activeProject.files || []).length === 0 ? (
              <div style={{ padding:"12px 8px", fontSize:11, color:"var(--t3)", lineHeight:1.65 }}>No tasks yet.<br/>Ask Eloria in Main Chat to build something.</div>
            ) : (
              <>
                {renderTaskSection(wipFiles, "In Progress", "in_progress")}
                {renderTaskSection(doneFiles, "Ready for Review", "done")}
                {renderTaskSection(pendFiles, "Pending", "pending")}
              </>
            )}
          </div>

          <div className="ec-sidebar-bottom">
            <button className="ec-ask-eloria-btn" onClick={() => textareaRef.current?.focus()}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Ask Eloria
            </button>
          </div>
        </aside>

        {/* MIDDLE — chat/activity */}
        <main className="ec-chat">
          <div className="ec-chat-header">
            {isMainChat ? (
              <>
                <span className="ec-chat-file-icon"></span>
                <span className="ec-chat-header-title">{activeProject.name}</span>
                <span className="ec-main-chat-badge">Main</span>
                {isAutoBuild && (
                  <span style={{ fontSize:10, color:"var(--t3)", marginLeft:4 }}>
                    Building {autoBuildDone}/{autoBuildQueue.length}…
                  </span>
                )}
              </>
            ) : activeFile ? (
              <>
                <span className="ec-chat-file-icon">{activeFile.isPlan ? "≡" : getFileIcon(activeFile.name)}</span>
                <span className="ec-chat-header-title">{taskTitleForFile(activeFile.name)}</span>
                {!activeFile.isPlan && (
                  <div style={{ position:"relative" }} ref={statusBtnRef}>
                    <button className="ec-status-btn" onClick={() => setShowStatusMenu(v => !v)}>
                      <span className={`ec-task-dot ${activeFile.status}`} style={{ width:5, height:5, marginTop:0 }} />
                      {TASK_STATUS_LABEL[activeFile.status]}
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    {showStatusMenu && (
                      <div className="ec-status-dropdown">
                        {Object.entries(TASK_STATUS_LABEL).map(([key, label]) => (
                          <button key={key} className="ec-status-option" onClick={() => updateFileStatus(activeFile.id, key)}>
                            <span className={`ec-task-dot ${key}`} style={{ marginTop:0 }} />
                            {label}
                            {activeFile.status === key && <svg style={{ marginLeft:"auto", width:10, height:10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {activeFile.code && (
                  <button className="ec-status-btn" onClick={() => downloadFile(activeFile.name, activeFile.code)} title="Download">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </button>
                )}
              </>
            ) : (
              <span className="ec-chat-header-title" style={{ color:"var(--t3)" }}>{activeProject.name}</span>
            )}
          </div>

          <div className="ec-body" ref={bodyRef}>{middleContent()}</div>

          {pendingAttachments.length > 0 && (
            <div style={{ background:"var(--bg)", borderTop:"1px solid var(--border)", paddingTop:4, paddingBottom:2 }}>
              <div className="ec-attach-strip">
                {pendingAttachments.map(att => (
                  <div key={att.id} className="ec-attach-chip">
                    <span className="ec-attach-chip-icon">{att.type === "folder" ? "📁" : getFileIcon(att.files[0]?.name || "")}</span>
                    <span className="ec-attach-chip-name">{att.name}</span>
                    <span style={{ fontSize:9.5, color:"var(--t3)", flexShrink:0 }}>{att.type === "folder" ? `${att.files.length}f` : formatBytes(att.files[0]?.size)}</span>
                    <button className="ec-attach-chip-remove" onClick={() => setPendingAttachments(prev => prev.filter(a => a.id !== att.id))}>✕</button>
                  </div>
                ))}
              </div>
              {limitHint && <div className="ec-attach-limit-note">{limitHint}</div>}
            </div>
          )}

          <div className="ec-input-wrap">
            <div className="ec-input-box">
              <div className="ec-input-toolbar">
                <button className={`ec-toolbar-btn${!canAddFile ? " disabled" : ""}`} onClick={() => canAddFile && fileInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
                  Attach {fileCount > 0 && <span style={{ background:"rgba(255,255,255,.08)", color:"var(--t2)", borderRadius:4, padding:"0 4px", fontSize:9.5 }}>{fileCount}/2</span>}
                </button>
                <div className="ec-toolbar-sep" />
                <button className={`ec-toolbar-btn${!canAddFolder ? " disabled" : ""}`} onClick={() => canAddFolder && folderInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>
                  Folder
                </button>
              </div>
              <div className="ec-textarea-row">
                <span className="ec-input-prefix">›</span>
                <textarea
                  ref={textareaRef}
                  className="ec-textarea"
                  rows={1}
                  value={input}
                  placeholder={
                    isAutoBuild ? "Building files… please wait" :
                    isMainChat ? `Ask Eloria to build something for ${activeProject.name}…` :
                    !activeFile ? "Select a task to start…" :
                    activeFile.isPlan ? "Ask about the plan…" :
                    activeFile.status === "pending" ? `Build ${activeFile.name}…` :
                    pendingAttachments.length > 0 ? "Describe what to do with attached files…" :
                    `Ask about ${activeFile.name}…`
                  }
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  disabled={isAutoBuild}
                />
                <button
                  className="ec-send"
                  onClick={isThinking ? stopMessage : sendMessage}
                  disabled={isAutoBuild || (!isThinking && !input.trim() && !pendingAttachments.length)}
                  style={isThinking ? { background:"var(--danger)" } : {}}
                >
                  {isThinking
                    ? <svg viewBox="0 0 24 24" fill="currentColor" width="12" height="12"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                  }
                </button>
              </div>
            </div>
            <p className="ec-hint">
              {isAutoBuild
                ? `Auto-building ${autoBuildDone}/${autoBuildQueue.length} files — sit tight`
                : "Verify generated code before use · max 1 folder or 2 files per message"}
            </p>
          </div>

          <div className="ec-statusbar">
            <div className="ec-statusbar-item">Eloria Code</div>
            {activeProject && <div className="ec-statusbar-item"> {activeProject.name}</div>}
            <div className="ec-statusbar-right">
              {isAutoBuild
                ? <div className="ec-statusbar-item">⚙ Auto-building {autoBuildDone}/{autoBuildQueue.length}</div>
                : <div className="ec-statusbar-item">{doneFiles.filter(f=>!f.isPlan).length}/{codeFiles.length} ready</div>
              }
            </div>
          </div>
        </main>

        {/* RIGHT — Code / Preview / Summary */}
        <aside className="ec-right">
          <div className="ec-right-header">
            <div className="ec-right-tabs">
              {[["preview","Preview"],["code","Code"],["final","Final Preview"],["summary","Summary"]].map(([tab, label]) => (
                <button key={tab} className={`ec-right-tab${rightTab === tab ? " active" : ""}`} onClick={() => setRightTab(tab)}>
                  {label}
                  {tab === "summary" && summaryGenerating && <span style={{ marginLeft:4, fontSize:9, color:"var(--t3)" }}>●</span>}
                </button>
              ))}
            </div>
            {rightFile && rightFile.code && rightTab !== "summary" && rightTab !== "final" && (
              <button className="ec-download-btn" style={{ margin:"0 10px", fontSize:10.5 }} onClick={() => downloadFile(rightFile.name, rightFile.code)}>↓ {rightFile.name}</button>
            )}
          </div>
          <div className="ec-right-body">{rightContent()}</div>
        </aside>
      </div>
      )}

      {/* Limit modal */}
      {showLimitModal && (
        <div className="ec-limit-backdrop" onClick={() => setShowLimitModal(false)}>
          <div className="ec-limit-box" onClick={e => e.stopPropagation()}>
            <div className="ec-limit-top">
              <button className="ec-limit-close" onClick={() => setShowLimitModal(false)}>✕</button>
              <div className="ec-limit-icon"></div>
              <div className="ec-limit-title">{userPlan === "pro" || userPlan === "admin" ? "Daily limit reached" : "Upgrade required"}</div>
              <div className="ec-limit-sub">{userPlan === "pro" || userPlan === "admin" ? "Resets at midnight · Pro plan" : "Eloria Code · Pro only"}</div>
            </div>
            <div className="ec-limit-body">
              <div className="ec-limit-desc">{userPlan === "pro" || userPlan === "admin" ? "You've used all your requests for today. Come back tomorrow." : "You've used all free requests. Upgrade to Pro for 25/day."}</div>
              <div className="ec-limit-actions">
                <button className="ec-limit-cancel" onClick={() => setShowLimitModal(false)}>{userPlan === "pro" || userPlan === "admin" ? "Got it" : "Later"}</button>
                {userPlan !== "pro" && userPlan !== "admin" && <button className="ec-limit-upgrade" onClick={() => { setShowLimitModal(false); window.close(); }}>Upgrade to Pro</button>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add file modal */}
      {showFileModal && (
        <div className="ec-modal-backdrop" onClick={() => setShowFileModal(false)}>
          <div className="ec-modal" onClick={e => e.stopPropagation()}>
            <div className="ec-modal-title"><div className="ec-modal-title-icon"></div>Add File</div>
            <div className="ec-modal-field">
              <label className="ec-modal-label">Filename</label>
              <input className="ec-modal-input" placeholder="e.g. index.html, styles.css, app.js" value={newFileName} autoFocus onChange={e => setNewFileName(e.target.value)} onKeyDown={e => e.key === "Enter" && createFile()} />
            </div>
            <div className="ec-modal-actions">
              <button className="ec-modal-cancel" onClick={() => setShowFileModal(false)}>Cancel</button>
              <button className="ec-modal-create" onClick={createFile} disabled={!newFileName.trim()}>Add File</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
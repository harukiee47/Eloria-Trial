import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  FiArrowLeft,
  FiGlobe,
  FiClock,
  FiSquare,
  FiChevronLeft,
  FiChevronRight,
  FiChevronUp,
  FiChevronDown,
  FiExternalLink,
  FiX,
  FiSend,
  FiCheck,
  FiGrid,
  FiBarChart2,
  FiSearch,
  FiFileText,
  FiZap,
  FiLayers,
  FiMoreVertical,
} from "react-icons/fi";
import { auth } from "../services/firebase";
import { applyStoredTheme } from "./SettingsModal";

const MAIN_BACKEND_URL = "https://eloria-trial.onrender.com";

async function authedFetch(path, opts = {}) {
  const token = await auth.currentUser.getIdToken();
  const res = await fetch(`${MAIN_BACKEND_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const WELCOME_TEXT =
  "Tell me what you'd like me to research — e.g. \"best laptops under 150k\" — and I'll read across trusted sources and bring back a decision-ready report.";

// Static shape of the activity trail. Index 2's label is patched at render
// time once we know how many sources were actually found.
const ACTIVITY_STEPS = [
  { key: "understand", label: "Understanding request", sub: "Analyzing your research goal" },
  { key: "search", label: "Searching web", sub: "Scanning trusted sources" },
  { key: "found", label: "results found", sub: "Filtering high-relevance results" },
  { key: "read", label: "Reading relevant sources", sub: "Extracting key information" },
  { key: "compare", label: "Comparing specifications", sub: "Evaluating products side-by-side" },
  { key: "synthesize", label: "Synthesizing findings", sub: "Creating final summary" },
];

function formatElapsed(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function initials(domain) {
  return (domain || "?").replace(/^www\./, "").charAt(0).toUpperCase();
}

function Favicon({ src, domain, size = 28 }) {
  const [broken, setBroken] = useState(!src);
  if (broken) {
    return (
      <span className="erc-favicon erc-favicon-fallback" style={{ width: size, height: size, fontSize: size * 0.42 }}>
        {initials(domain)}
      </span>
    );
  }
  return (
    <img
      className="erc-favicon"
      style={{ width: size, height: size }}
      src={src}
      alt={domain}
      onError={() => setBroken(true)}
    />
  );
}

export default function EloriaWeb({ onBack }) {
  const [messages, setMessages] = useState([{ role: "assistant", text: WELCOME_TEXT }]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [query, setQuery] = useState("");
  const [report, setReport] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [activityIdx, setActivityIdx] = useState(-1);
  const [stepTimes, setStepTimes] = useState({});
  const [selectedSource, setSelectedSource] = useState(null);
  const [view, setView] = useState("overview"); // overview | compare
  const [compareSet, setCompareSet] = useState(new Set());
  const [factsExpanded, setFactsExpanded] = useState(false);

  const timerRef = useRef(null);
  const stepTimerRef = useRef(null);
  const abortRef = useRef(null);
  const cardsRef = useRef(null);
  const msgsEndRef = useRef(null);
  const startedAtRef = useRef(0);

  useEffect(() => {
    applyStoredTheme();
  }, []);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);
    timerRef.current = null;
    stepTimerRef.current = null;
  }, []);

  useEffect(() => () => {
    clearTimers();
    if (abortRef.current) abortRef.current.abort();
  }, [clearTimers]);

  const markStepTime = (idx) => {
    setStepTimes((prev) => ({ ...prev, [idx]: formatElapsed((Date.now() - startedAtRef.current) / 1000) }));
  };

  const runResearch = async (q) => {
    setQuery(q);
    setStatus("running");
    setReport(null);
    setElapsed(0);
    setActivityIdx(0);
    setStepTimes({});
    setSelectedSource(null);
    setView("overview");
    setCompareSet(new Set());
    setFactsExpanded(false);

    startedAtRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 1000);

    markStepTime(0);
    let idx = 0;
    stepTimerRef.current = setInterval(() => {
      if (idx < 4) {
        idx += 1;
        setActivityIdx(idx);
        markStepTime(idx);
      }
    }, 1700);

    const controller = new AbortController();
    abortRef.current = controller;

    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: "Got it! I'll research that and share my findings." },
      { role: "assistant", text: "Searching trusted sources...", trailStep: true },
    ]);

    try {
      const data = await authedFetch("/api/browser/research", {
        method: "POST",
        body: JSON.stringify({ query: q }),
        signal: controller.signal,
      });

      clearTimers();
      setActivityIdx(5);
      markStepTime(5);
      setStatus("done");
      setReport(data);

      const findingsCount = (data.results || []).length + (data.keyFacts || []).length;
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: `Found ${(data.results || []).length} relevant results.`, trailStep: true },
        { role: "assistant", text: "Extracting specs, prices and key details...", trailStep: true },
        {
          role: "assistant",
          kind: "complete",
          sourcesCount: (data.sourcesAnalyzed || []).length,
          findingsCount,
          summary: data.summary,
          recommendations: data.recommendations || [],
        },
      ]);
    } catch (err) {
      clearTimers();
      if (err.name === "AbortError") {
        setStatus("idle");
        setMessages((prev) => [...prev, { role: "assistant", text: "Research stopped." }]);
      } else {
        setStatus("error");
        setMessages((prev) => [...prev, { role: "assistant", text: `Error: ${err.message}` }]);
      }
    } finally {
      abortRef.current = null;
    }
  };

  const sendMessage = () => {
    const text = input.trim();
    if (!text || status === "running") return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text }]);
    runResearch(text);
  };

  const stopResearch = () => {
    if (abortRef.current) abortRef.current.abort();
    clearTimers();
  };

  const scrollCards = (dir) => {
    cardsRef.current?.scrollBy({ left: dir * 300, behavior: "smooth" });
  };

  const openSourceFromResult = (r) => {
    const chip = (report?.sourcesAnalyzed || []).find((s) => s.domain === r.domain);
    setSelectedSource({
      domain: r.domain,
      url: r.sourceUrl,
      title: r.title,
      favicon: chip?.favicon,
      type: r.type,
      published: chip?.published,
      bullets: r.bullets || Object.entries(r.specs || {}).map(([k, v]) => `${k}: ${v}`),
    });
  };

  const openSourceFromChip = (s) => {
    const matched = (report?.results || []).find((r) => r.domain === s.domain);
    setSelectedSource({
      domain: s.domain,
      url: s.url,
      title: s.title,
      favicon: s.favicon,
      type: matched?.type,
      bullets: matched ? matched.bullets || Object.entries(matched.specs || {}).map(([k, v]) => `${k}: ${v}`) : [],
    });
  };

  const toggleCompare = (idx) => {
    setCompareSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const results = report?.results || [];
  const keyFacts = report?.keyFacts || [];
  const comparisonTable = report?.comparisonTable || null;
  const sourcesAnalyzed = report?.sourcesAnalyzed || [];
  const compareItems = results.filter((_, i) => compareSet.has(i));
  const compareSpecKeys = Array.from(new Set(compareItems.flatMap((it) => Object.keys(it.specs || {}))));

  const running = status === "running";
  const hasReport = status === "done" && report;

  return (
    <div className="erc-shell">
      <style>{`
        :root {
          --font: 'DM Sans', system-ui, sans-serif;
          --bg-app:      #f5f0ea;
          --bg-strip:    #ede8e1;
          --bg-panel:    #fdfaf6;
          --bg-card:     #ffffff;
          --bg-card-2:   #faf7f2;
          --border:      #dcdfd8;
          --border-soft: #e5e7e0;
          --t1: #0D3A35;
          --t2: #3a5a55;
          --t3: #7a8a84;
          --accent:      #276152;
          --accent-bg:   #eaf2ef;
          --accent-deep: #1a4a3d;
          --accent-fg:   #ffffff;
          --danger:      #c04040;
          --danger-bg:   #fdf0f0;
        }
        [data-theme="dark"] {
          --bg-app:      #0e0f0e;
          --bg-strip:    #161716;
          --bg-panel:    #1a1b1a;
          --bg-card:     #212221;
          --bg-card-2:   #262726;
          --border:      #333433;
          --border-soft: #2a2b2a;
          --t1: #f2f2f0;
          --t2: #c7c8c5;
          --t3: #8c8d8a;
          --accent:      #3fb083;
          --accent-bg:   #17251f;
          --accent-deep: #57c797;
          --accent-fg:   #06110c;
          --danger:      #e5787a;
          --danger-bg:   #2a1717;
        }
        * { box-sizing: border-box; }
        .erc-shell { display: flex; flex-direction: column; height: 100vh; width: 100vw; background: var(--bg-app); color: var(--t1); font-family: var(--font); }

        /* Top bar */
        .erc-topbar { display: flex; align-items: center; gap: 18px; padding: 12px 20px; border-bottom: 1px solid var(--border); background: var(--bg-panel); flex-shrink: 0; }
        .erc-brand { display: flex; align-items: center; gap: 8px; font-size: 16px; font-weight: 700; color: var(--t1); flex-shrink: 0; }
        .erc-brand-icon { color: var(--accent); font-size: 19px; }
        .erc-back { background: none; border: none; color: var(--t3); cursor: pointer; display: flex; align-items: center; margin-right: 4px; }
        .erc-back:hover { color: var(--accent); }
        .erc-topbar-query { display: flex; align-items: baseline; gap: 6px; font-size: 14px; color: var(--t2); overflow: hidden; }
        .erc-topbar-query b { color: var(--t1); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 420px; }
        .erc-topbar-spacer { flex: 1; }
        .erc-stat { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: var(--t3); }
        .erc-stat b { color: var(--t1); font-size: 13.5px; display: block; }
        .erc-stat-icon { color: var(--accent); font-size: 15px; }
        .erc-stop-btn { display: flex; align-items: center; gap: 6px; background: var(--danger-bg); color: var(--danger); border: 1px solid var(--danger); border-radius: 8px; padding: 7px 13px; font-size: 12.5px; font-weight: 600; cursor: pointer; }
        .erc-stop-btn:hover { background: var(--danger); color: #fff; }

        /* Three-column body */
        .erc-body { flex: 1; display: flex; min-height: 0; }

        /* Left: activity trail */
        .erc-trail-panel { width: 270px; flex-shrink: 0; border-right: 1px solid var(--border); background: var(--bg-panel); display: flex; flex-direction: column; overflow-y: auto; }
        .erc-trail-hdr { display: flex; align-items: center; justify-content: space-between; padding: 16px 16px 4px; }
        .erc-trail-hdr h4 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 7px; }
        .erc-trail-sub { padding: 0 16px 14px; font-size: 12px; color: var(--t3); }
        .erc-trail-list { padding: 4px 16px 16px; position: relative; }
        .erc-trail-item { position: relative; display: flex; gap: 12px; padding: 10px 8px; border-radius: 10px; }
        .erc-trail-item.active { background: var(--accent); color: var(--accent-fg); }
        .erc-trail-line { position: absolute; left: 24px; top: 44px; bottom: -6px; width: 2px; background: var(--border-soft); }
        .erc-trail-item:last-child .erc-trail-line { display: none; }
        .erc-trail-dot { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 13px; background: var(--bg-card-2); border: 1px solid var(--border-soft); color: var(--t3); z-index: 1; }
        .erc-trail-item.done .erc-trail-dot { background: var(--accent-bg); color: var(--accent); border-color: var(--accent); }
        .erc-trail-item.active .erc-trail-dot { background: rgba(255,255,255,0.18); color: #fff; border-color: transparent; }
        .erc-trail-body b { display: block; font-size: 13px; margin-bottom: 2px; }
        .erc-trail-body span.erc-trail-desc { display: block; font-size: 11.5px; opacity: 0.8; }
        .erc-trail-item.active .erc-trail-desc { opacity: 0.85; }
        .erc-trail-time { font-size: 10.5px; opacity: 0.65; margin-top: 3px; display: block; }
        .erc-agent-card { margin: auto 16px 16px; padding: 14px; border-radius: 12px; background: var(--bg-card); border: 1px solid var(--border-soft); display: flex; gap: 10px; align-items: flex-start; }
        .erc-agent-icon { width: 32px; height: 32px; border-radius: 9px; background: var(--accent); color: var(--accent-fg); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .erc-agent-card b { display: block; font-size: 12.5px; }
        .erc-agent-card span { font-size: 11px; color: var(--t3); }

        /* Center: canvas */
        .erc-canvas-panel { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow-y: auto; padding: 18px 22px 28px; }
        .erc-canvas-hdr { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
        .erc-canvas-title { display: flex; align-items: center; gap: 9px; font-size: 16px; font-weight: 700; }
        .erc-live-badge { font-size: 10.5px; font-weight: 700; background: var(--accent-bg); color: var(--accent); padding: 2px 9px; border-radius: 10px; }
        .erc-live-badge.dot::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); margin-right: 5px; }
        .erc-canvas-desc { font-size: 12.5px; color: var(--t3); margin-top: 3px; }
        .erc-view-toggle { display: flex; background: var(--bg-card-2); border: 1px solid var(--border-soft); border-radius: 10px; padding: 3px; flex-shrink: 0; }
        .erc-view-toggle button { display: flex; align-items: center; gap: 6px; border: none; background: none; padding: 7px 13px; border-radius: 8px; font-size: 12.5px; font-weight: 600; color: var(--t3); cursor: pointer; }
        .erc-view-toggle button.active { background: var(--bg-card); color: var(--t1); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }

        .erc-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--t3); text-align: center; gap: 8px; }
        .erc-empty svg { font-size: 34px; color: var(--border); }

        .erc-section { margin-bottom: 22px; }
        .erc-section-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .erc-section-hdr h5 { margin: 0; font-size: 13.5px; font-weight: 700; }
        .erc-sort { font-size: 12px; color: var(--t3); }

        .erc-cards-row-wrap { position: relative; }
        .erc-cards-row { display: flex; gap: 14px; overflow-x: auto; scroll-behavior: smooth; padding-bottom: 4px; }
        .erc-cards-row::-webkit-scrollbar { height: 0; }
        .erc-nav-btn { position: absolute; top: 40%; width: 30px; height: 30px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.08); color: var(--t2); z-index: 2; }
        .erc-nav-btn.left { left: -6px; } .erc-nav-btn.right { right: -6px; }

        .erc-card { flex: 0 0 210px; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 8px; position: relative; }
        .erc-card-badge { position: absolute; top: 10px; left: 10px; width: 20px; height: 20px; border-radius: 6px; background: var(--accent); color: var(--accent-fg); font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; z-index: 1; }
        .erc-card-compare { position: absolute; top: 10px; right: 10px; width: 20px; height: 20px; border-radius: 5px; border: 1.5px solid var(--border); background: var(--bg-card); cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--accent); z-index: 1; }
        .erc-card-compare.checked { background: var(--accent); border-color: var(--accent); color: #fff; }
        .erc-card-img { height: 96px; border-radius: 9px; background: var(--bg-card-2); display: flex; align-items: center; justify-content: center; color: var(--border); font-size: 30px; }
        .erc-card-title { font-size: 13px; font-weight: 700; line-height: 1.3; }
        .erc-card-price { font-size: 14px; font-weight: 700; color: var(--accent); }
        .erc-card-price small { font-weight: 500; color: var(--t3); font-size: 11px; margin-left: 4px; }
        .erc-card-specs { display: flex; flex-direction: column; gap: 2px; font-size: 11px; color: var(--t2); }
        .erc-card-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
        .erc-card-src { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--t3); overflow: hidden; }
        .erc-card-src span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 90px; }
        .erc-src-link { display: flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: var(--accent); background: var(--accent-bg); border: none; border-radius: 7px; padding: 5px 8px; cursor: pointer; white-space: nowrap; }
        .erc-src-link:hover { background: var(--accent); color: #fff; }

        .erc-two-col { display: grid; grid-template-columns: 1fr 1.3fr; gap: 16px; align-items: start; }
        @media (max-width: 980px) { .erc-two-col { grid-template-columns: 1fr; } }

        .erc-facts-card, .erc-compare-card { background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 14px; padding: 14px; }
        .erc-facts-list { display: flex; flex-direction: column; gap: 12px; }
        .erc-fact { display: flex; gap: 10px; align-items: flex-start; }
        .erc-fact-icon { width: 26px; height: 26px; border-radius: 7px; background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 12px; }
        .erc-fact span { font-size: 12.5px; color: var(--t2); line-height: 1.4; }
        .erc-more-btn { background: none; border: none; color: var(--accent); font-size: 12px; font-weight: 600; cursor: pointer; padding: 10px 0 0; }

        .erc-table-wrap { overflow-x: auto; }
        table.erc-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.erc-table th { text-align: left; color: var(--t3); font-weight: 600; padding: 6px 10px; border-bottom: 1px solid var(--border-soft); white-space: nowrap; }
        table.erc-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-soft); color: var(--t2); white-space: nowrap; }
        table.erc-table td:first-child, table.erc-table th:first-child { color: var(--t1); font-weight: 600; }

        .erc-sources-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
        .erc-source-chip { display: flex; align-items: center; gap: 9px; border: 1px solid var(--border-soft); border-radius: 11px; padding: 9px 10px; cursor: pointer; background: var(--bg-card); text-align: left; }
        .erc-source-chip:hover { border-color: var(--accent); }
        .erc-source-chip b { display: block; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .erc-source-chip span { font-size: 10.5px; color: var(--t3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
        .erc-source-chip.more { align-items: center; justify-content: center; color: var(--t3); font-weight: 600; font-size: 12px; }

        .erc-favicon { border-radius: 7px; object-fit: cover; flex-shrink: 0; }
        .erc-favicon-fallback { display: flex; align-items: center; justify-content: center; background: var(--accent); color: var(--accent-fg); font-weight: 700; }

        .erc-detail-panel { position: sticky; bottom: 0; margin-top: 18px; background: var(--accent-bg); border: 1.5px solid var(--accent); border-radius: 16px; padding: 16px; }
        [data-theme="dark"] .erc-detail-panel { background: var(--bg-card); }
        .erc-detail-hdr { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .erc-detail-hdr-left { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; }
        .erc-detail-close { background: none; border: none; color: var(--t2); cursor: pointer; display: flex; }
        .erc-detail-body { display: grid; grid-template-columns: 1.1fr 1fr; gap: 18px; }
        @media (max-width: 720px) { .erc-detail-body { grid-template-columns: 1fr; } }
        .erc-detail-src { display: flex; gap: 10px; align-items: flex-start; }
        .erc-detail-src-name { font-size: 13.5px; font-weight: 700; }
        .erc-detail-src-url { font-size: 11.5px; color: var(--accent); word-break: break-all; }
        .erc-detail-title { font-size: 12.5px; margin-top: 8px; color: var(--t2); line-height: 1.4; }
        .erc-detail-meta { font-size: 11px; color: var(--t3); margin-top: 8px; }
        .erc-detail-info h6 { margin: 0 0 8px; font-size: 12.5px; font-weight: 700; }
        .erc-detail-bullets { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 12px; color: var(--t2); list-style: none; padding: 0; margin: 0 0 12px; }
        .erc-detail-bullets li::before { content: '•'; color: var(--accent); margin-right: 6px; }
        .erc-open-src-btn { display: inline-flex; align-items: center; gap: 6px; background: var(--accent); color: var(--accent-fg); border: none; border-radius: 8px; padding: 8px 14px; font-size: 12px; font-weight: 600; cursor: pointer; text-decoration: none; }

        /* Right: chat */
        .erc-chat-panel { width: 350px; flex-shrink: 0; border-left: 1px solid var(--border); background: var(--bg-panel); display: flex; flex-direction: column; }
        .erc-chat-hdr { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
        .erc-chat-hdr h4 { margin: 0; font-size: 14px; display: flex; align-items: center; gap: 7px; }
        .erc-chat-msgs { flex: 1; overflow-y: auto; padding: 14px 16px; display: flex; flex-direction: column; gap: 10px; }
        .erc-msg { max-width: 94%; font-size: 13px; line-height: 1.45; }
        .erc-msg.user { align-self: flex-end; background: var(--accent); color: var(--accent-fg); padding: 9px 13px; border-radius: 12px; }
        .erc-msg.assistant { align-self: flex-start; background: var(--bg-card); color: var(--t1); border: 1px solid var(--border-soft); padding: 9px 13px; border-radius: 12px; }
        .erc-msg.trail { align-self: flex-start; background: none; border: none; padding: 0 2px; display: flex; align-items: center; gap: 8px; color: var(--t2); font-size: 12px; }
        .erc-msg.trail .erc-msg-dot { width: 22px; height: 22px; border-radius: 50%; background: var(--accent-bg); color: var(--accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-size: 11px; }

        .erc-complete-card { align-self: stretch; background: var(--bg-card-2); border: 1px solid var(--border-soft); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 4px; }
        .erc-complete-top { display: flex; align-items: center; gap: 10px; }
        .erc-complete-check { width: 32px; height: 32px; border-radius: 50%; background: var(--accent); color: #fff; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .erc-complete-top b { font-size: 13.5px; display: block; }
        .erc-complete-top span { font-size: 11.5px; color: var(--t3); }
        .erc-report-card { align-self: stretch; background: var(--bg-card); border: 1px solid var(--border-soft); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 12px; }
        .erc-report-card h6 { margin: 0 0 6px; font-size: 12.5px; font-weight: 700; }
        .erc-report-card p { margin: 0; font-size: 12.5px; color: var(--t2); line-height: 1.5; }
        .erc-rec-list { display: flex; flex-direction: column; gap: 7px; padding: 0; margin: 0; list-style: none; }
        .erc-rec-list li { display: flex; gap: 8px; font-size: 12.5px; color: var(--t2); }
        .erc-rec-num { width: 17px; height: 17px; border-radius: 50%; background: var(--accent-bg); color: var(--accent); font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
        .erc-view-report-btn { display: flex; align-items: center; justify-content: center; gap: 7px; border: 1px solid var(--border); background: var(--bg-card-2); border-radius: 9px; padding: 9px; font-size: 12px; font-weight: 600; color: var(--t2); cursor: pointer; }
        .erc-view-report-btn:hover { border-color: var(--accent); color: var(--accent); }
        .erc-used-sources { display: flex; align-items: center; gap: -4px; margin-top: 2px; }
        .erc-used-sources .erc-favicon { margin-right: -6px; border: 2px solid var(--bg-panel); }

        .erc-chat-input-row { display: flex; gap: 8px; padding: 12px; border-top: 1px solid var(--border); }
        .erc-chat-input-row input { flex: 1; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 10px 13px; color: var(--t1); font-size: 13px; outline: none; font-family: var(--font); }
        .erc-chat-input-row input::placeholder { color: var(--t3); }
        .erc-chat-input-row input:focus { border-color: var(--accent); }
        .erc-chat-send { background: var(--accent); border: none; border-radius: 10px; width: 38px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #fff; cursor: pointer; }
        .erc-chat-send:hover:not(:disabled) { background: var(--accent-deep); }
        .erc-chat-send:disabled { opacity: 0.5; cursor: not-allowed; }
        .erc-chat-disclaimer { text-align: center; font-size: 10.5px; color: var(--t3); padding: 0 12px 10px; }
      `}</style>

      {/* ── Top bar ───────────────────────────────────────────────── */}
      <div className="erc-topbar">
        {onBack && (
          <button className="erc-back" onClick={onBack} title="Back">
            <FiArrowLeft size={18} />
          </button>
        )}
        <div className="erc-brand">
          <FiLayers className="erc-brand-icon" />
          Eloria Web
        </div>
        {(running || hasReport) && (
          <div className="erc-topbar-query">
            {running ? "Researching:" : "Research:"} <b title={query}>{query}</b>
          </div>
        )}
        <div className="erc-topbar-spacer" />
        {(running || hasReport) && (
          <>
            <div className="erc-stat">
              <FiGlobe className="erc-stat-icon" />
              <span>Sources found<b>{hasReport ? sourcesAnalyzed.length : "…"}</b></span>
            </div>
            <div className="erc-stat">
              <FiClock className="erc-stat-icon" />
              <span>Elapsed time<b>{formatElapsed(elapsed)}</b></span>
            </div>
          </>
        )}
        {running && (
          <button className="erc-stop-btn" onClick={stopResearch}>
            <FiSquare /> Stop research
          </button>
        )}
      </div>

      <div className="erc-body">
        {/* ── Left: activity trail ───────────────────────────────── */}
        <div className="erc-trail-panel">
          <div className="erc-trail-hdr">
            <h4><FiZap /> Activity Trail</h4>
          </div>
          <div className="erc-trail-sub">Live steps of Eloria's autonomous research</div>
          {(running || hasReport) && (
            <div className="erc-trail-list">
              {ACTIVITY_STEPS.map((step, i) => {
                const state = i < activityIdx ? "done" : i === activityIdx ? "active" : "pending";
                const label = i === 2 && hasReport ? `${sourcesAnalyzed.length} ${step.label}` : i === 2 ? "Finding sources" : step.label;
                return (
                  <div key={step.key} className={`erc-trail-item ${state}`}>
                    <div className="erc-trail-line" />
                    <div className="erc-trail-dot">
                      {state === "done" ? <FiCheck /> : state === "active" ? "●" : ""}
                    </div>
                    <div className="erc-trail-body">
                      <b>{label}</b>
                      <span className="erc-trail-desc">{step.sub}</span>
                      {stepTimes[i] && <span className="erc-trail-time">{stepTimes[i]}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <div className="erc-agent-card">
            <div className="erc-agent-icon"><FiSearch /></div>
            <div>
              <b>Research agent</b>
              <span>Autonomous web researcher — Gathering • Analyzing • Synthesizing</span>
            </div>
          </div>
        </div>

        {/* ── Center: research canvas ────────────────────────────── */}
        <div className="erc-canvas-panel">
          {status === "idle" && (
            <div className="erc-empty">
              <FiSearch />
              <div>Ask Eloria to research something in the chat panel to see results here.</div>
            </div>
          )}

          {(running || hasReport) && (
            <>
              <div className="erc-canvas-hdr">
                <div>
                  <div className="erc-canvas-title">
                    Eloria Research Canvas
                    <span className={`erc-live-badge${running ? " dot" : ""}`}>{running ? "Live" : "Complete"}</span>
                  </div>
                  <div className="erc-canvas-desc">
                    {running ? "Eloria is reading sources and extracting relevant information…" : `Report ready for "${query}"`}
                  </div>
                </div>
                {hasReport && (
                  <div className="erc-view-toggle">
                    <button className={view === "overview" ? "active" : ""} onClick={() => setView("overview")}>
                      <FiGrid /> Overview
                    </button>
                    <button className={view === "compare" ? "active" : ""} onClick={() => setView("compare")}>
                      <FiBarChart2 /> Compare ({compareSet.size})
                    </button>
                  </div>
                )}
              </div>

              {running && !hasReport && (
                <div className="erc-empty" style={{ flex: "unset", padding: "40px 0" }}>
                  <FiSearch />
                  <div>Gathering and reading sources — results will appear here shortly.</div>
                </div>
              )}

              {hasReport && view === "overview" && (
                <>
                  {results.length > 0 && (
                    <div className="erc-section">
                      <div className="erc-section-hdr">
                        <h5>Top options identified ({results.length} results)</h5>
                        <span className="erc-sort">Sort by: Relevance</span>
                      </div>
                      <div className="erc-cards-row-wrap">
                        {results.length > 3 && (
                          <>
                            <button className="erc-nav-btn left" onClick={() => scrollCards(-1)}><FiChevronLeft /></button>
                            <button className="erc-nav-btn right" onClick={() => scrollCards(1)}><FiChevronRight /></button>
                          </>
                        )}
                        <div className="erc-cards-row" ref={cardsRef}>
                          {results.map((r, i) => (
                            <div className="erc-card" key={i}>
                              <span className="erc-card-badge">{i + 1}</span>
                              <button
                                className={`erc-card-compare${compareSet.has(i) ? " checked" : ""}`}
                                onClick={() => toggleCompare(i)}
                                title="Add to compare"
                              >
                                {compareSet.has(i) ? <FiCheck size={12} /> : ""}
                              </button>
                              <div className="erc-card-img"><FiFileText /></div>
                              <div className="erc-card-title">{r.title}</div>
                              {r.price && (r.price.pkr || r.price.usd) && (
                                <div className="erc-card-price">
                                  {r.price.pkr ? `PKR ${r.price.pkr}` : `$${r.price.usd}`}
                                  {r.price.pkr && r.price.usd && <small>~${r.price.usd}</small>}
                                </div>
                              )}
                              {r.specs && Object.keys(r.specs).length > 0 && (
                                <div className="erc-card-specs">
                                  {Object.entries(r.specs).slice(0, 3).map(([k, v]) => (
                                    <span key={k}>{v}</span>
                                  ))}
                                </div>
                              )}
                              <div className="erc-card-footer">
                                <div className="erc-card-src">
                                  <Favicon src={sourcesAnalyzed.find((s) => s.domain === r.domain)?.favicon} domain={r.domain} size={16} />
                                  <span>{r.domain}</span>
                                </div>
                                <button className="erc-src-link" onClick={() => openSourceFromResult(r)}>
                                  Source <FiExternalLink size={11} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="erc-two-col">
                    {keyFacts.length > 0 && (
                      <div className="erc-facts-card">
                        <h5 style={{ margin: "0 0 12px", fontSize: 13.5 }}>Extracted key facts</h5>
                        <div className="erc-facts-list">
                          {(factsExpanded ? keyFacts : keyFacts.slice(0, 4)).map((f, i) => (
                            <div className="erc-fact" key={i}>
                              <div className="erc-fact-icon"><FiZap size={12} /></div>
                              <span>{f}</span>
                            </div>
                          ))}
                        </div>
                        {keyFacts.length > 4 && (
                          <button className="erc-more-btn" onClick={() => setFactsExpanded((v) => !v)}>
                            {factsExpanded ? "Show less" : `+${keyFacts.length - 4} more insights`}
                          </button>
                        )}
                      </div>
                    )}

                    {comparisonTable && comparisonTable.rows && comparisonTable.rows.length > 0 && (
                      <div className="erc-compare-card">
                        <h5 style={{ margin: "0 0 12px", fontSize: 13.5 }}>
                          Specification comparison (Top {comparisonTable.rows.length})
                        </h5>
                        <div className="erc-table-wrap">
                          <table className="erc-table">
                            <thead>
                              <tr>
                                <th>Model</th>
                                {(comparisonTable.columns || []).map((c) => <th key={c}>{c}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {comparisonTable.rows.map((row, i) => (
                                <tr key={i}>
                                  <td>{row.model}</td>
                                  {row.values.map((v, j) => <td key={j}>{v}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>

                  {sourcesAnalyzed.length > 0 && (
                    <div className="erc-section">
                      <div className="erc-section-hdr">
                        <h5>Top sources analyzed ({sourcesAnalyzed.length})</h5>
                      </div>
                      <div className="erc-sources-grid">
                        {sourcesAnalyzed.slice(0, 7).map((s, i) => (
                          <button className="erc-source-chip" key={i} onClick={() => openSourceFromChip(s)}>
                            <Favicon src={s.favicon} domain={s.domain} size={26} />
                            <div style={{ minWidth: 0 }}>
                              <b>{s.domain}</b>
                              <span>{s.title}</span>
                            </div>
                          </button>
                        ))}
                        {sourcesAnalyzed.length > 7 && (
                          <div className="erc-source-chip more">+{sourcesAnalyzed.length - 7} more sources</div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedSource && (
                    <div className="erc-detail-panel">
                      <div className="erc-detail-hdr">
                        <div className="erc-detail-hdr-left"><FiChevronUp /> Source details</div>
                        <button className="erc-detail-close" onClick={() => setSelectedSource(null)}><FiX /></button>
                      </div>
                      <div className="erc-detail-body">
                        <div className="erc-detail-src">
                          <Favicon src={selectedSource.favicon} domain={selectedSource.domain} size={38} />
                          <div>
                            <div className="erc-detail-src-name">{selectedSource.domain}</div>
                            <div className="erc-detail-src-url">{selectedSource.url}</div>
                            <div className="erc-detail-title">{selectedSource.title}</div>
                            {selectedSource.type && (
                              <div className="erc-detail-meta">Type: {selectedSource.type}</div>
                            )}
                          </div>
                        </div>
                        <div className="erc-detail-info">
                          <h6>Extracted information</h6>
                          {selectedSource.bullets && selectedSource.bullets.length > 0 ? (
                            <ul className="erc-detail-bullets">
                              {selectedSource.bullets.map((b, i) => <li key={i}>{b}</li>)}
                            </ul>
                          ) : (
                            <p style={{ fontSize: 12, color: "var(--t3)", margin: "0 0 12px" }}>No extracted details captured for this source.</p>
                          )}
                          <a className="erc-open-src-btn" href={selectedSource.url} target="_blank" rel="noopener noreferrer">
                            Open source <FiExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {hasReport && view === "compare" && (
                <div className="erc-compare-card">
                  {compareItems.length === 0 ? (
                    <div className="erc-empty" style={{ flex: "unset", padding: "30px 0" }}>
                      <FiBarChart2 />
                      <div>Select items with the checkbox on each card to compare them here.</div>
                    </div>
                  ) : (
                    <div className="erc-table-wrap">
                      <table className="erc-table">
                        <thead>
                          <tr>
                            <th>Spec</th>
                            {compareItems.map((it, i) => <th key={i}>{it.title}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td>Price</td>
                            {compareItems.map((it, i) => (
                              <td key={i}>{it.price?.pkr ? `PKR ${it.price.pkr}` : it.price?.usd ? `$${it.price.usd}` : "—"}</td>
                            ))}
                          </tr>
                          {compareSpecKeys.map((key) => (
                            <tr key={key}>
                              <td>{key}</td>
                              {compareItems.map((it, i) => <td key={i}>{it.specs?.[key] || "—"}</td>)}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Right: chat ─────────────────────────────────────────── */}
        <div className="erc-chat-panel">
          <div className="erc-chat-hdr">
            <h4><FiSearch /> Eloria Chat</h4>
            <FiMoreVertical color="var(--t3)" />
          </div>
          <div className="erc-chat-msgs">
            {messages.map((m, i) => {
              if (m.kind === "complete") {
                return (
                  <React.Fragment key={i}>
                    <div className="erc-complete-card">
                      <div className="erc-complete-top">
                        <div className="erc-complete-check"><FiCheck /></div>
                        <div>
                          <b>Research complete</b>
                          <span>{m.sourcesCount} sources analyzed • {m.findingsCount} findings</span>
                        </div>
                      </div>
                    </div>
                    <div className="erc-report-card">
                      <div>
                        <h6>Summary</h6>
                        <p>{m.summary}</p>
                      </div>
                      {m.recommendations.length > 0 && (
                        <div>
                          <h6>Top recommendations</h6>
                          <ul className="erc-rec-list">
                            {m.recommendations.map((r, j) => (
                              <li key={j}>
                                <span className="erc-rec-num">{j + 1}</span>
                                <span><b>{r.title}</b> — {r.reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <button className="erc-view-report-btn" onClick={() => setView("overview")}>
                        <FiFileText /> View full report
                      </button>
                      {sourcesAnalyzed.length > 0 && (
                        <div>
                          <h6 style={{ marginBottom: 8 }}>Sources used</h6>
                          <div className="erc-used-sources">
                            {sourcesAnalyzed.slice(0, 5).map((s, j) => (
                              <Favicon key={j} src={s.favicon} domain={s.domain} size={26} />
                            ))}
                            {sourcesAnalyzed.length > 5 && (
                              <span className="erc-favicon erc-favicon-fallback" style={{ width: 26, height: 26, fontSize: 10 }}>
                                +{sourcesAnalyzed.length - 5}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </React.Fragment>
                );
              }
              if (m.trailStep) {
                return (
                  <div className="erc-msg trail" key={i}>
                    <span className="erc-msg-dot"><FiZap size={11} /></span>
                    {m.text}
                  </div>
                );
              }
              return (
                <div className={`erc-msg ${m.role}`} key={i}>
                  {m.text}
                </div>
              );
            })}
            <div ref={msgsEndRef} />
          </div>
          <div className="erc-chat-input-row">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !running) sendMessage(); }}
              placeholder={running ? "Researching…" : hasReport ? "Ask a follow-up question…" : "What should I research?"}
              disabled={running}
            />
            <button className="erc-chat-send" onClick={sendMessage} disabled={running} aria-label="Send">
              <FiSend size={16} />
            </button>
          </div>
          <div className="erc-chat-disclaimer">Eloria can make mistakes. Verify important info.</div>
        </div>
      </div>
    </div>
  );
}
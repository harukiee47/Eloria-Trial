// ActivityTimeline.jsx
// Drop-in above AI bubble. Uses no external deps.
// Props:
//   steps       — array of { text: string } built by buildActivitySteps()
//   activeIndex — current step index (driven by parent timer)
//   done        — bool: all steps finished, show collapsed summary
//   durationMs  — how long it took (shown in summary line)

import React, { useEffect, useRef, useState } from "react";

// ─── Inline styles (no className conflicts) ──────────────────────────────────

const S = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
    marginBottom: 6,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },

  // each row
  row: (visible) => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "3px 0",
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(5px)",
    transition: "opacity .22s ease, transform .22s ease",
  }),

  // spinner circle
  spinner: {
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "1.5px solid rgba(0,0,0,0.12)",
    borderTopColor: "#0d3a35",
    animation: "at_spin .65s linear infinite",
    flexShrink: 0,
  },

  // checkmark icon
  check: {
    width: 14,
    height: 14,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },

  // step text — active
  textActive: {
    fontSize: 13,
    color: "#1a1a18",
    fontWeight: 500,
    lineHeight: 1.4,
  },

  // step text — done
  textDone: {
    fontSize: 13,
    color: "#999",
    fontWeight: 400,
    lineHeight: 1.4,
  },

  // collapsed summary line
  summary: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    cursor: "pointer",
    padding: "2px 0",
    userSelect: "none",
  },

  summaryChevron: (open) => ({
    width: 13,
    height: 13,
    color: "#aaa",
    flexShrink: 0,
    transform: open ? "rotate(90deg)" : "rotate(0deg)",
    transition: "transform .18s ease",
  }),

  summaryText: {
    fontSize: 12.5,
    color: "#aaa",
    fontWeight: 400,
  },
};

// ─── Keyframes injected once ─────────────────────────────────────────────────
let _injected = false;
function injectKeyframes() {
  if (_injected || typeof document === "undefined") return;
  _injected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes at_spin { to { transform: rotate(360deg); } }
    @keyframes at_fadein {
      from { opacity: 0; transform: translateY(5px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ─── SVG checkmark ───────────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <polyline
        points="2.5,7 5.5,10 11.5,4"
        stroke="#aaa"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Chevron ─────────────────────────────────────────────────────────────────
function ChevronIcon({ open }) {
  return (
    <svg
      style={S.summaryChevron(open)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ActivityTimeline({
  steps = [],
  activeIndex = 0,
  done = false,
  durationMs = null,
}) {
  injectKeyframes();
  const [expanded, setExpanded] = useState(false);
  const [visibleRows, setVisibleRows] = useState([]);
  const timerRef = useRef(null);

  // Stagger row visibility so each item fades in sequentially
  useEffect(() => {
    setVisibleRows([]);
    if (!steps.length) return;
    steps.forEach((_, i) => {
      timerRef.current = setTimeout(() => {
        setVisibleRows((prev) => [...prev, i]);
      }, i * 160);
    });
    return () => clearTimeout(timerRef.current);
  }, [steps]);

  if (!steps || steps.length === 0) return null;

  const durationLabel =
    durationMs != null
      ? durationMs < 1000
        ? `${durationMs}ms`
        : `${(durationMs / 1000).toFixed(1)}s`
      : null;

  // ── DONE: collapsed summary with expand toggle ─────────────────────────────
  if (done) {
    return (
      <div style={S.wrap}>
        <div style={S.summary} onClick={() => setExpanded((v) => !v)}>
          <ChevronIcon open={expanded} />
          <span style={S.summaryText}>
            Completed {steps.length} {steps.length === 1 ? "step" : "steps"}
            {durationLabel ? ` in ${durationLabel}` : ""}
          </span>
        </div>

        {expanded && (
          <div style={{ paddingLeft: 2, marginTop: 4 }}>
            {steps.map((s, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "3px 0",
                  animation: "at_fadein .18s ease",
                }}
              >
                <div style={S.check}>
                  <CheckIcon />
                </div>
                <span style={S.textDone}>{s.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── IN PROGRESS: live list ─────────────────────────────────────────────────
  return (
    <div style={S.wrap}>
      {steps.map((s, i) => {
        const isVisible = visibleRows.includes(i) || i < activeIndex;
        if (!isVisible) return null;

        const isDone = i < activeIndex;
        const isActive = i === activeIndex;

        return (
          <div key={i} style={S.row(true)}>
            {isDone ? (
              <div style={S.check}>
                <CheckIcon />
              </div>
            ) : isActive ? (
              <div style={S.spinner} />
            ) : (
              // upcoming — faint dot
              <div
                style={{
                  width: 14,
                  height: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: "50%",
                    background: "#ccc",
                  }}
                />
              </div>
            )}
            <span style={isDone ? S.textDone : isActive ? S.textActive : { ...S.textDone, color: "#ccc" }}>
              {s.text}
            </span>
          </div>
        );
      })}
    </div>
  );
}
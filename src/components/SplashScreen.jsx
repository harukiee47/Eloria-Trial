import { useEffect, useRef, useState } from "react";
import logo from "../assets/logo.png";
import "./SplashScreen.css";

const STEPS = [
  { label: "Loading core modules",       duration: 600 },
  { label: "Connecting knowledge base",  duration: 700 },
  { label: "Calibrating language model", duration: 800 },
  { label: "Preparing your workspace",   duration: 500 },
];

export default function SplashScreen({ onFinish }) {
  const [fadeOut, setFadeOut]     = useState(false);
  const [progress, setProgress]   = useState(0);
  const [topProgress, setTop]     = useState(0);
  const [status, setStatus]       = useState("");
  const [stepStates, setSteps]    = useState(
    STEPS.map(() => ({ dot: "idle", fill: 0, labelState: "idle" }))
  );

  const stepsRef = useRef(stepStates);
  stepsRef.current = stepStates;

  useEffect(() => {
    let cancelled = false;

    const delay = (ms) => new Promise((r) => setTimeout(r, ms));

    const animateProgress = (from, to, duration) =>
      new Promise((resolve) => {
        const start = performance.now();
        const tick = (now) => {
          if (cancelled) return resolve();
          const p = Math.min((now - start) / duration, 1);
          const val = from + (to - from) * p;
          setProgress(val);
          setTop(val);
          if (p < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });

    const runSteps = async () => {
      await delay(400);

      for (let i = 0; i < STEPS.length; i++) {
        if (cancelled) return;

        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, dot: "active", labelState: "active" } : s
          )
        );
        setStatus(STEPS[i].label + "...");

        setTimeout(() => {
          setSteps((prev) =>
            prev.map((s, idx) => (idx === i ? { ...s, fill: 100 } : s))
          );
        }, 20);

        const from = (i / STEPS.length) * 100;
        const to   = ((i + 1) / STEPS.length) * 100;
        await animateProgress(from, to, STEPS[i].duration);

        if (cancelled) return;
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i ? { ...s, dot: "done", labelState: "done" } : s
          )
        );
        await delay(80);
      }

      setProgress(100);
      setTop(100);
      setStatus("Ready");

      await delay(400);
      if (!cancelled) {
        setFadeOut(true);
        setTimeout(onFinish, 520);
      }
    };

    runSteps();
    return () => { cancelled = true; };
  }, [onFinish]);

  return (
    <div className={`splash-root${fadeOut ? " fade-out" : ""}`}>
      <div className="splash-topbar">
        <div className="splash-topbar-fill" style={{ width: `${topProgress}%` }} />
      </div>

      <div className="splash-logo-wrap">
        <img src={logo} className="splash-logo" alt="Eloria" />
      </div>

      <div className="splash-brand">Eloria</div>
      <div className="splash-tagline">Your intelligent assistant</div>

      <div className="splash-steps">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className="splash-step"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <div className={`splash-step-dot ${stepStates[i].dot}`} />
            <div className="splash-step-track">
              <div
                className="splash-step-fill"
                style={{ width: `${stepStates[i].fill}%` }}
              />
            </div>
            <div className={`splash-step-label ${stepStates[i].labelState}`}>
              {step.label}
            </div>
          </div>
        ))}
      </div>

      <div className="splash-progress-track">
        <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className={`splash-status${status === "Ready" ? " ready" : ""}`}>
        {status}
      </div>
    </div>
  );
}
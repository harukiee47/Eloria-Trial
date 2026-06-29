/**
 * eloria-voice.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Drop this file into your frontend project and import/call initVoiceModal().
 *
 * DEPENDENCIES: none (vanilla JS, uses Web Audio API + MediaRecorder)
 *
 * USAGE:
 *   import { initVoiceModal } from "./eloria-voice.js";
 *
 *   // Call once after your page loads:
 *   initVoiceModal({
 *     micButtonId: "mic-btn",          // ID of your existing mic button in the chat UI
 *     getAuthToken: () => yourApp.getFirebaseIdToken(), // async fn → Firebase ID token
 *     getMessages:  () => yourApp.conversationHistory, // fn → current messages array
 *     onTranscript: (text) => yourApp.appendUserMessage(text),  // optional: show user text in chat
 *     onReply:      (text) => yourApp.appendAssistantMessage(text), // optional: show reply in chat
 *     apiBase:      "https://your-backend.onrender.com", // no trailing slash
 *   });
 *
 * The modal is injected into document.body automatically.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function initVoiceModal({
  micButtonId = "mic-btn",
  getAuthToken,
  getMessages = () => [],
  onTranscript = null,
  onReply = null,
  apiBase = "",
} = {}) {
  // ── Inject styles ────────────────────────────────────────────────────────────
  injectStyles();

  // ── Inject modal HTML ────────────────────────────────────────────────────────
  const modal = createModal();
  document.body.appendChild(modal);

  // ── DOM refs ─────────────────────────────────────────────────────────────────
  const overlay      = modal;
  const closeBtn     = modal.querySelector(".ev-close");
  const statusText   = modal.querySelector(".ev-status");
  const transcriptEl = modal.querySelector(".ev-transcript");
  const canvas       = modal.querySelector(".ev-canvas");
  const ctx          = canvas.getContext("2d");

  // ── State ────────────────────────────────────────────────────────────────────
  let voiceState = "idle"; // idle | listening | processing | speaking
  let mediaRecorder = null;
  let audioChunks   = [];
  let stream        = null;
  let analyser      = null;
  let animationId   = null;
  let currentAudio  = null; // HTMLAudioElement for TTS playback

  // ── Orb colours per state ────────────────────────────────────────────────────
  const STATE_CONFIG = {
    idle:       { inner: "#6C5CE7", outer: "#2d2b55", label: "Tap to speak"  },
    listening:  { inner: "#6C5CE7", outer: "#3b1f8c", label: "Listening…"    },
    processing: { inner: "#8888aa", outer: "#2a2a3a", label: "Thinking…"     },
    speaking:   { inner: "#00D9C0", outer: "#003d38", label: "Speaking…"     },
  };

  // ── Canvas / orb drawing ─────────────────────────────────────────────────────
  function resizeCanvas() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  let synthPhase = 0; // fallback synthetic animation phase

  function drawOrb(volume = 0) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const cfg    = STATE_CONFIG[voiceState] || STATE_CONFIG.idle;
    const cx     = w / 2;
    const cy     = h / 2;
    const baseR  = Math.min(w, h) * 0.22;
    const pulse  = voiceState === "listening" || voiceState === "speaking"
      ? baseR * 0.18 * volume
      : voiceState === "processing"
        ? baseR * 0.06 * Math.sin(synthPhase * 1.5)
        : 0;
    const r = baseR + pulse;

    // Outer glow rings
    [2.2, 1.7, 1.3].forEach((mult, i) => {
      const alpha = [0.06, 0.1, 0.16][i];
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * mult);
      grad.addColorStop(0,   hexToRgba(cfg.inner, alpha));
      grad.addColorStop(1,   hexToRgba(cfg.inner, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, r * mult, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // Core orb
    const orbGrad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
    orbGrad.addColorStop(0,   hexToRgba(cfg.inner, 0.95));
    orbGrad.addColorStop(0.6, hexToRgba(cfg.inner, 0.75));
    orbGrad.addColorStop(1,   hexToRgba(cfg.outer, 0.9));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = orbGrad;
    ctx.fill();

    // Waveform bars (listening + speaking only)
    if ((voiceState === "listening" || voiceState === "speaking") && volume > 0.01) {
      const bars    = 32;
      const barMaxH = r * 0.7;
      ctx.save();
      ctx.translate(cx, cy + r + 18);
      for (let i = 0; i < bars; i++) {
        const angle   = (i / bars) * Math.PI; // semicircle
        const bh      = barMaxH * volume * (0.4 + 0.6 * Math.abs(Math.sin(synthPhase * 3 + i)));
        const x       = (i - bars / 2) * 5;
        const barGrad = ctx.createLinearGradient(0, 0, 0, -bh);
        barGrad.addColorStop(0, hexToRgba(cfg.inner, 0.8));
        barGrad.addColorStop(1, hexToRgba(cfg.inner, 0));
        ctx.fillStyle = barGrad;
        ctx.fillRect(x, 0, 3, -bh);
      }
      ctx.restore();
    }

    synthPhase += 0.04;
  }

  function getVolume() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const sum = data.reduce((a, b) => a + b, 0);
    return Math.min(1, (sum / data.length) / 80);
  }

  function startAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    function loop() {
      drawOrb(getVolume());
      animationId = requestAnimationFrame(loop);
    }
    loop();
  }

  function stopAnimation() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // ── State machine ─────────────────────────────────────────────────────────────
  function setState(state) {
    voiceState = state;
    const cfg = STATE_CONFIG[state] || STATE_CONFIG.idle;
    statusText.textContent = cfg.label;
    statusText.className = `ev-status ev-status--${state}`;
  }

  // ── Open / close modal ────────────────────────────────────────────────────────
  function openModal() {
    overlay.classList.add("ev-open");
    transcriptEl.textContent = "";
    setState("idle");
    startAnimation();

    // Auto-start listening immediately when modal opens
    setTimeout(startListening, 300);
  }

  function closeModal() {
    stopListening();
    stopAudio();
    overlay.classList.remove("ev-open");
    stopAnimation();
    setState("idle");
  }

  // ── Mic / recording ───────────────────────────────────────────────────────────
  async function startListening() {
    if (voiceState !== "idle" && voiceState !== "speaking") return;
    stopAudio();

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      statusText.textContent = "Microphone access denied.";
      return;
    }

    // Hook analyser to the live mic stream
    const audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);

    setState("listening");

    audioChunks = [];
    const mimeType = getSupportedMimeType();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stopStream();
      analyser = null;
      await submitAudio(mimeType);
    };

    // Auto-stop after silence or 30 s max
    mediaRecorder.start();
    setupSilenceDetection(audioCtx, stream);
  }

  function stopListening() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    } else {
      stopStream();
    }
  }

  function stopStream() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
  }

  // ── Silence detection (stops recording after ~2 s of quiet) ───────────────────
  function setupSilenceDetection(audioCtx, micStream) {
    const silenceAnalyser = audioCtx.createAnalyser();
    silenceAnalyser.fftSize = 512;
    audioCtx.createMediaStreamSource(micStream).connect(silenceAnalyser);

    let silenceStart = null;
    const SILENCE_THRESHOLD = 8;   // out of 255
    const SILENCE_DURATION  = 2000; // ms
    const MAX_DURATION      = 30000; // ms hard cap
    const startTime = Date.now();

    function check() {
      if (!mediaRecorder || mediaRecorder.state === "inactive") return;
      if (Date.now() - startTime > MAX_DURATION) {
        mediaRecorder.stop();
        return;
      }

      const data = new Uint8Array(silenceAnalyser.frequencyBinCount);
      silenceAnalyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;

      if (avg < SILENCE_THRESHOLD) {
        if (!silenceStart) silenceStart = Date.now();
        else if (Date.now() - silenceStart > SILENCE_DURATION) {
          mediaRecorder.stop();
          return;
        }
      } else {
        silenceStart = null;
      }
      setTimeout(check, 100);
    }
    setTimeout(check, 800); // give user a moment to start speaking
  }

  // ── Submit audio to backend ───────────────────────────────────────────────────
  async function submitAudio(mimeType) {
    if (audioChunks.length === 0) {
      setState("idle");
      return;
    }

    setState("processing");
    analyser = null;

    const blob     = new Blob(audioChunks, { type: mimeType || "audio/webm" });
    const formData = new FormData();
    formData.append("audio", blob, "recording.webm");
    formData.append("messages", JSON.stringify(getMessages()));

    let token;
    try {
      token = await getAuthToken();
    } catch {
      statusText.textContent = "Auth error. Please refresh.";
      setState("idle");
      return;
    }

    let data;
    try {
      const res = await fetch(`${apiBase}/api/voice/turn`, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}` },
        body:    formData,
      });

      if (res.status === 429) {
        statusText.textContent = "Daily voice limit reached.";
        setTimeout(() => setState("idle"), 3000);
        return;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      data = await res.json();
    } catch (err) {
      console.error("Voice turn error:", err);
      statusText.textContent = err.message || "Something went wrong.";
      setTimeout(() => setState("idle"), 3000);
      return;
    }

    // Show transcript
    if (data.transcript) {
      transcriptEl.textContent = `"${data.transcript}"`;
      if (onTranscript) onTranscript(data.transcript);
    }

    // Optionally surface reply text in the chat UI
    if (data.replyText && onReply) {
      onReply(data.replyText);
    }

    // Play TTS audio
    if (data.audioBase64) {
      playAudio(data.audioBase64);
    } else {
      setState("idle");
    }
  }

  // ── TTS playback ──────────────────────────────────────────────────────────────
  function playAudio(base64) {
    setState("speaking");

    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    currentAudio = audio;

    // Hook analyser to TTS output so the orb reacts
    const audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    audio.onended = () => {
      analyser = null;
      currentAudio = null;
      setState("idle");
      // Auto-restart listening for the next turn
      setTimeout(startListening, 400);
    };

    audio.onerror = () => {
      analyser = null;
      currentAudio = null;
      setState("idle");
    };

    audio.play().catch((err) => {
      console.error("Audio playback error:", err);
      setState("idle");
    });
  }

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    analyser = null;
  }

  // ── Util: MIME type ───────────────────────────────────────────────────────────
  function getSupportedMimeType() {
    const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
    return types.find((t) => MediaRecorder.isTypeSupported(t)) || "";
  }

  // ── Event wiring ──────────────────────────────────────────────────────────────
  const micBtn = document.getElementById(micButtonId);
  if (micBtn) {
    micBtn.addEventListener("click", openModal);
  } else {
    console.warn(`[EloriaVoice] No element found with id="${micButtonId}"`);
  }

  closeBtn.addEventListener("click", closeModal);

  // Tap anywhere on the idle orb area to start/stop
  canvas.addEventListener("click", () => {
    if (voiceState === "idle")      startListening();
    else if (voiceState === "listening") stopListening();
  });

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });

  // Keyboard: Escape closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("ev-open")) closeModal();
  });

  // Expose for external control if needed
  return { openModal, closeModal, setState };
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function createModal() {
  const el = document.createElement("div");
  el.className = "ev-overlay";
  el.innerHTML = `
    <div class="ev-modal">
      <button class="ev-close" aria-label="Close voice mode">✕</button>
      <div class="ev-orb-wrap">
        <canvas class="ev-canvas"></canvas>
      </div>
      <p class="ev-status ev-status--idle">Tap to speak</p>
      <p class="ev-transcript"></p>
    </div>
  `;
  return el;
}

function injectStyles() {
  if (document.getElementById("ev-styles")) return;
  const style = document.createElement("style");
  style.id = "ev-styles";
  style.textContent = `
    .ev-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(5, 5, 10, 0.82);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      align-items: center;
      justify-content: center;
    }
    .ev-overlay.ev-open { display: flex; }

    .ev-modal {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      padding: 48px 40px 40px;
      background: rgba(14, 14, 22, 0.95);
      border: 1px solid rgba(108, 92, 231, 0.25);
      border-radius: 28px;
      box-shadow: 0 0 80px rgba(108, 92, 231, 0.15), 0 24px 60px rgba(0,0,0,0.6);
      width: min(420px, 90vw);
    }

    .ev-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255,255,255,0.07);
      border: none;
      color: rgba(255,255,255,0.6);
      font-size: 15px;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s, color 0.2s;
    }
    .ev-close:hover { background: rgba(255,255,255,0.14); color: #fff; }

    .ev-orb-wrap {
      width: 220px;
      height: 220px;
      cursor: pointer;
    }
    .ev-canvas {
      width: 100%;
      height: 100%;
      display: block;
    }

    .ev-status {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.08em;
      text-transform: lowercase;
      margin: 0;
      transition: color 0.4s;
    }
    .ev-status--idle       { color: rgba(255,255,255,0.45); }
    .ev-status--listening  { color: #a78bfa; }
    .ev-status--processing { color: rgba(200,200,220,0.6); }
    .ev-status--speaking   { color: #00D9C0; }

    .ev-transcript {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      color: rgba(255,255,255,0.35);
      text-align: center;
      margin: 0;
      min-height: 18px;
      font-style: italic;
      max-width: 320px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);
}

// ── Colour helpers ─────────────────────────────────────────────────────────────
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
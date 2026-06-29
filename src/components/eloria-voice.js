/**
 * eloria-voice.js — Eloria AI Voice Modal
 * Gemini-inspired, Eloria-themed: dark green + cream palette
 * Fullscreen with greeting screen, voice selection, and live waveform
 */

export function initVoiceModal({
  micButtonId = "mic-btn",
  getAuthToken,
  getMessages = () => [],
  onTranscript = null,
  onReply = null,
  apiBase = "",
} = {}) {
  injectStyles();
  const modal = createModal();
  document.body.appendChild(modal);

  const overlay       = modal;
  const greetScreen   = modal.querySelector(".ev-greet-screen");
  const mainScreen    = modal.querySelector(".ev-main-screen");
  const continueBtn   = modal.querySelector(".ev-continue-btn");
  const closeBtn      = modal.querySelector(".ev-close-btn");
  const minimizeBtn   = modal.querySelector(".ev-minimize-btn");
  const miniPill      = modal.querySelector(".ev-mini-pill");
  const miniRestoreBtn= modal.querySelector(".ev-mini-restore");
  const miniCloseBtn  = modal.querySelector(".ev-mini-close");
  const statusEl      = modal.querySelector(".ev-status");
  const transcriptEl  = modal.querySelector(".ev-transcript-text");
  const canvas        = modal.querySelector(".ev-canvas");
  const voiceCards    = modal.querySelectorAll(".ev-voice-card");
  const greetText     = modal.querySelector(".ev-greet-text");
  const ctx           = canvas.getContext("2d");

  // ── State ─────────────────────────────────────────────────────────────
  let voiceState    = "idle";
  let selectedVoice = localStorage.getItem("eloria_voice") || "aura-asteria-en";
  let mediaRecorder = null;
  let audioChunks   = [];
  let stream        = null;
  let analyser      = null;
  let animId        = null;
  let currentAudio  = null;
  let minimized     = false;
  let phase         = 0;

  const VOICES = [
    { id: "aura-asteria-en", name: "Asteria", desc: "Warm · Female", greeting: "Hi, I'm Asteria — warm and friendly. Ready when you are." },
    { id: "aura-luna-en",    name: "Luna",    desc: "Soft · Female", greeting: "Hello, I'm Luna — soft and calm. Let's talk." },
    { id: "aura-orion-en",   name: "Orion",   desc: "Clear · Male",  greeting: "Hey, I'm Orion — clear and confident. Ask me anything." },
    { id: "aura-zeus-en",    name: "Zeus",    desc: "Deep · Male",   greeting: "I'm Zeus — deep and assured. Let's get to it." },
  ];

  const OPEN_GREETINGS = [
    "Hey, good to hear from you.",
    "Hello! Ready to listen.",
    "Hi there — I'm all ears.",
    "Hey — what's on your mind?",
  ];

  // ── Colors per state ──────────────────────────────────────────────────
  const STATE = {
    idle:       { label: "Tap to speak",  colors: ["#0d3a35","#1a5a52","#0a2e29"] },
    listening:  { label: "Listening…",    colors: ["#0d6a5e","#00b894","#0d3a35"] },
    processing: { label: "Thinking…",     colors: ["#2d6a4f","#74c69d","#1b4332"] },
    speaking:   { label: "Speaking…",     colors: ["#00b894","#55efc4","#0d3a35"] },
  };

  // ── Canvas resize ──────────────────────────────────────────────────────
  function resizeCanvas() {
    canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  }
  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // ── Wave drawing ───────────────────────────────────────────────────────
  function drawWaves(volume = 0) {
    const w  = canvas.offsetWidth;
    const h  = canvas.offsetHeight;
    const cx = w / 2;
    const cy = h / 2;
    ctx.clearRect(0, 0, w, h);

    const colors = STATE[voiceState]?.colors || STATE.idle.colors;
    const amp = voiceState === "idle" ? 0.04
              : voiceState === "processing" ? 0.06 + 0.04 * Math.sin(phase * 1.2)
              : 0.08 + volume * 0.22;

    // Draw 3 layered sine waves
    for (let layer = 0; layer < 3; layer++) {
      const freq    = 1.5 + layer * 0.8;
      const offset  = layer * (Math.PI * 2 / 3);
      const opacity = voiceState === "idle" ? 0.18 + layer * 0.06
                    : 0.28 + layer * 0.12;
      const yAmp    = (h * amp) * (1 - layer * 0.18);
      const color   = colors[layer] || colors[0];

      ctx.beginPath();
      ctx.moveTo(0, cy);
      for (let x = 0; x <= w; x += 2) {
        const t = (x / w) * Math.PI * 2 * freq + phase + offset;
        const y = cy + Math.sin(t) * yAmp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, cy - yAmp, 0, h);
      grad.addColorStop(0,   hexRgba(color, opacity));
      grad.addColorStop(0.5, hexRgba(color, opacity * 0.6));
      grad.addColorStop(1,   hexRgba(color, 0));
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Center orb glow
    const orbR = 60 + (voiceState !== "idle" ? volume * 30 : 8 * Math.sin(phase));
    const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, orbR * 2.5);
    orbGrad.addColorStop(0,   hexRgba(colors[0], voiceState === "idle" ? 0.12 : 0.22));
    orbGrad.addColorStop(0.5, hexRgba(colors[1], 0.08));
    orbGrad.addColorStop(1,   hexRgba(colors[0], 0));
    ctx.fillStyle = orbGrad;
    ctx.fillRect(0, 0, w, h);

    // Orb dot
    const dotR = 36 + (voiceState !== "idle" ? volume * 18 : 4 * Math.sin(phase * 1.3));
    const dotGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, dotR);
    dotGrad.addColorStop(0,   hexRgba(colors[1], voiceState === "idle" ? 0.5 : 0.85));
    dotGrad.addColorStop(0.6, hexRgba(colors[0], 0.6));
    dotGrad.addColorStop(1,   hexRgba(colors[0], 0));
    ctx.fillStyle = dotGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
    ctx.fill();

    phase += voiceState === "idle" ? 0.012 : voiceState === "processing" ? 0.025 : 0.035 + volume * 0.04;
  }

  function getVolume() {
    if (!analyser) return 0;
    const d = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(d);
    return Math.min(1, d.reduce((a,b)=>a+b,0) / d.length / 70);
  }

  function startAnim() {
    if (animId) cancelAnimationFrame(animId);
    const loop = () => { drawWaves(getVolume()); animId = requestAnimationFrame(loop); };
    loop();
  }

  function stopAnim() {
    if (animId) cancelAnimationFrame(animId);
    animId = null;
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
  }

  // ── State ─────────────────────────────────────────────────────────────
  function setState(s) {
    voiceState = s;
    statusEl.textContent = STATE[s]?.label || "";
    statusEl.className = `ev-status ev-status--${s}`;
  }

  // ── Voice card selection + preview ────────────────────────────────────
  voiceCards.forEach(card => {
    card.addEventListener("click", async () => {
      voiceCards.forEach(c => c.classList.remove("ev-voice-card--selected"));
      card.classList.add("ev-voice-card--selected");
      selectedVoice = card.dataset.voice;
      localStorage.setItem("eloria_voice", selectedVoice);

      // Preview the voice
      const v = VOICES.find(v => v.id === selectedVoice);
      if (!v) return;
      card.classList.add("ev-voice-card--loading");
      try {
        const token = await getAuthToken();
        const res = await fetch(`${apiBase}/api/voice/preview`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ text: v.greeting, voice: selectedVoice }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.audioBase64) {
            if (currentAudio) { currentAudio.pause(); currentAudio = null; }
            currentAudio = new Audio(`data:audio/wav;base64,${data.audioBase64}`);
            currentAudio.play().catch(() => {});
          }
        }
      } catch {}
      card.classList.remove("ev-voice-card--loading");
    });
  });

  // Mark saved voice
  voiceCards.forEach(c => {
    if (c.dataset.voice === selectedVoice) c.classList.add("ev-voice-card--selected");
  });

  // ── Open/close ────────────────────────────────────────────────────────
  function openModal() {
    overlay.classList.add("ev-open");
    greetScreen.style.display = "flex";
    mainScreen.style.display  = "none";
    minimized = false;
    overlay.querySelector(".ev-mini-pill").style.display = "none";

    // Animate greeting text
    const greets = ["Hello!", "Hey there!", "Hi!", "Good to see you!"];
    greetText.textContent = greets[Math.floor(Math.random() * greets.length)];
  }

  function closeModal() {
    stopListening();
    stopCurrentAudio();
    stopAnim();
    setState("idle");
    minimized = false;
    overlay.classList.remove("ev-open");
    overlay.querySelector(".ev-mini-pill").style.display = "none";
    greetScreen.style.display = "flex";
    mainScreen.style.display  = "none";
  }

  function minimizeModal() {
    minimized = true;
    greetScreen.style.display = "none";
    mainScreen.style.display  = "none";
    miniPill.style.display    = "flex";
  }

  function restoreModal() {
    minimized = false;
    miniPill.style.display   = "none";
    mainScreen.style.display = "flex";
  }

  // ── Continue from greeting ────────────────────────────────────────────
  continueBtn.addEventListener("click", () => {
    greetScreen.style.display = "none";
    mainScreen.style.display  = "flex";
    startAnim();
    // Greet user with selected voice
    greetUser();
  });

  async function greetUser() {
    const greeting = OPEN_GREETINGS[Math.floor(Math.random() * OPEN_GREETINGS.length)];
    setState("processing");
    try {
      const token = await getAuthToken();
      const res = await fetch(`${apiBase}/api/voice/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: greeting, voice: selectedVoice }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.audioBase64) {
          playAudio(data.audioBase64, () => startListening());
          return;
        }
      }
    } catch {}
    // If preview fails, just start listening
    setState("idle");
    startListening();
  }

  // ── Recording ─────────────────────────────────────────────────────────
  async function startListening() {
    if (voiceState !== "idle" && voiceState !== "speaking") return;
    stopCurrentAudio();
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      statusEl.textContent = "Microphone access denied.";
      return;
    }
    const audioCtx = new AudioContext();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    setState("listening");
    transcriptEl.textContent = "";
    audioChunks = [];
    const mimeType = getSupportedMime();
    mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = async () => {
      stopStream();
      analyser = null;
      await submitAudio(mimeType);
    };
    mediaRecorder.start();
    setupSilence(audioCtx, stream);
  }

  function stopListening() {
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    else stopStream();
  }

  function stopStream() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
  }

  function setupSilence(audioCtx, micStream) {
    const sa = audioCtx.createAnalyser(); sa.fftSize = 512;
    audioCtx.createMediaStreamSource(micStream).connect(sa);
    let silStart = null;
    const t0 = Date.now();
    const check = () => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") return;
      if (Date.now() - t0 > 30000) { mediaRecorder.stop(); return; }
      const d = new Uint8Array(sa.frequencyBinCount);
      sa.getByteFrequencyData(d);
      const avg = d.reduce((a,b)=>a+b,0)/d.length;
      if (avg < 12) {
        if (!silStart) silStart = Date.now();
        else if (Date.now() - silStart > 1500) { mediaRecorder.stop(); return; }
      } else silStart = null;
      setTimeout(check, 100);
    };
    setTimeout(check, 800);
  }

  // ── Submit ────────────────────────────────────────────────────────────
  async function submitAudio(mimeType) {
    if (!audioChunks.length) { setState("idle"); return; }
    setState("processing");
    analyser = null;
    const blob = new Blob(audioChunks, { type: mimeType || "audio/webm" });
    const fd = new FormData();
    fd.append("audio", blob, "recording.webm");
    fd.append("messages", JSON.stringify(getMessages()));
    fd.append("voice", selectedVoice);
    let token;
    try { token = await getAuthToken(); }
    catch { statusEl.textContent = "Auth error."; setState("idle"); return; }
    let data;
    try {
      const res = await fetch(`${apiBase}/api/voice/turn`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      if (res.status === 429) { statusEl.textContent = "Daily limit reached."; setTimeout(() => setState("idle"), 3000); return; }
      if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || `Error ${res.status}`); }
      data = await res.json();
    } catch(err) {
      statusEl.textContent = err.message || "Something went wrong.";
      setTimeout(() => setState("idle"), 3000);
      return;
    }
    if (data.transcript) {
      transcriptEl.textContent = `"${data.transcript}"`;
      if (onTranscript) onTranscript(data.transcript);
    }
    if (data.replyText && onReply) onReply(data.replyText);
    if (data.audioBase64) playAudio(data.audioBase64, () => setTimeout(startListening, 400));
    else setState("idle");
  }

  // ── Audio playback ────────────────────────────────────────────────────
  function playAudio(base64, onEnd) {
    setState("speaking");
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    currentAudio = audio;
    try {
      const actx = new AudioContext();
      analyser = actx.createAnalyser(); analyser.fftSize = 256;
      const src = actx.createMediaElementSource(audio);
      src.connect(analyser); analyser.connect(actx.destination);
    } catch {}
    audio.onended = () => { analyser = null; currentAudio = null; setState("idle"); if (onEnd) onEnd(); };
    audio.onerror = () => { analyser = null; currentAudio = null; setState("idle"); };
    audio.play().catch(() => setState("idle"));
  }

  function stopCurrentAudio() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    analyser = null;
  }

  function getSupportedMime() {
    const types = ["audio/webm;codecs=opus","audio/webm","audio/ogg;codecs=opus","audio/mp4"];
    return types.find(t => MediaRecorder.isTypeSupported(t)) || "";
  }

  // ── Events ────────────────────────────────────────────────────────────
  const micBtn = document.getElementById(micButtonId);
  if (micBtn) micBtn.addEventListener("click", openModal);

  closeBtn.addEventListener("click", closeModal);
  minimizeBtn.addEventListener("click", minimizeModal);
  miniRestoreBtn.addEventListener("click", restoreModal);
  miniCloseBtn.addEventListener("click", closeModal);

  canvas.addEventListener("click", () => {
    if (voiceState === "idle") startListening();
    else if (voiceState === "listening") stopListening();
    else if (voiceState === "speaking") { stopCurrentAudio(); setState("idle"); }
  });

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && overlay.classList.contains("ev-open")) {
      if (minimized) closeModal(); else minimizeModal();
    }
  });

  return { openModal, closeModal };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function hexRgba(hex, a) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── HTML ──────────────────────────────────────────────────────────────────────
function createModal() {
  const el = document.createElement("div");
  el.className = "ev-overlay";
  el.innerHTML = `
    <!-- Mini pill (minimized state) -->
    <div class="ev-mini-pill" style="display:none">
      <div class="ev-mini-dot"></div>
      <span class="ev-mini-label">Eloria Voice</span>
      <button class="ev-mini-restore" title="Restore">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
      </button>
      <button class="ev-mini-close" title="Close">✕</button>
    </div>

    <!-- Greeting screen -->
    <div class="ev-greet-screen">
      <div class="ev-greet-bg"></div>
      <div class="ev-greet-content">
        <div class="ev-greet-badge">Eloria Voice</div>
        <h1 class="ev-greet-text">Hello!</h1>
        <p class="ev-greet-sub">Choose a voice to get started</p>
        <div class="ev-voice-grid">
          <div class="ev-voice-card" data-voice="aura-asteria-en">
            <div class="ev-voice-avatar ev-voice-avatar--f">A</div>
            <div class="ev-voice-name">Asteria</div>
            <div class="ev-voice-desc">Warm · Female</div>
            <div class="ev-voice-loading-dot"></div>
          </div>
          <div class="ev-voice-card" data-voice="aura-luna-en">
            <div class="ev-voice-avatar ev-voice-avatar--f">L</div>
            <div class="ev-voice-name">Luna</div>
            <div class="ev-voice-desc">Soft · Female</div>
            <div class="ev-voice-loading-dot"></div>
          </div>
          <div class="ev-voice-card" data-voice="aura-orion-en">
            <div class="ev-voice-avatar ev-voice-avatar--m">O</div>
            <div class="ev-voice-name">Orion</div>
            <div class="ev-voice-desc">Clear · Male</div>
            <div class="ev-voice-loading-dot"></div>
          </div>
          <div class="ev-voice-card" data-voice="aura-zeus-en">
            <div class="ev-voice-avatar ev-voice-avatar--m">Z</div>
            <div class="ev-voice-name">Zeus</div>
            <div class="ev-voice-desc">Deep · Male</div>
            <div class="ev-voice-loading-dot"></div>
          </div>
        </div>
        <button class="ev-continue-btn">Continue</button>
      </div>
    </div>

    <!-- Main screen -->
    <div class="ev-main-screen" style="display:none">
      <div class="ev-topbar">
        <span class="ev-topbar-label">Eloria Voice</span>
        <div class="ev-topbar-actions">
          <button class="ev-minimize-btn" title="Minimize">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <button class="ev-close-btn" title="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <canvas class="ev-canvas"></canvas>
      <div class="ev-center-content">
        <p class="ev-status ev-status--idle">Tap to speak</p>
        <p class="ev-transcript-text"></p>
      </div>
      <div class="ev-hint">Tap the wave to speak · tap again to stop</div>
    </div>
  `;
  return el;
}

// ── CSS ───────────────────────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById("ev-styles-v2")) return;
  const s = document.createElement("style");
  s.id = "ev-styles-v2";
  s.textContent = `
    /* ── OVERLAY ── */
    .ev-overlay {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .ev-overlay.ev-open { display: block; }

    /* ── MINI PILL ── */
    .ev-mini-pill {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      background: #0d3a35;
      border-radius: 40px;
      padding: 10px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 32px rgba(13,58,53,0.4);
      z-index: 10000;
      animation: evSlideUp .2s ease;
    }
    .ev-mini-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #00b894;
      box-shadow: 0 0 8px #00b894;
      animation: evPulse 1.5s ease-in-out infinite;
    }
    .ev-mini-label { color: #f5f0e8; font-size: 13px; font-weight: 600; }
    .ev-mini-restore, .ev-mini-close {
      background: rgba(255,255,255,0.12); border: none;
      color: rgba(255,255,255,0.7); cursor: pointer;
      width: 26px; height: 26px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .ev-mini-restore:hover, .ev-mini-close:hover { background: rgba(255,255,255,0.22); color: #fff; }

    /* ── GREETING SCREEN ── */
    .ev-greet-screen {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      background: #f5f0e8;
      overflow: hidden;
    }
    .ev-greet-bg {
      position: absolute; inset: 0;
      background: radial-gradient(ellipse at 30% 20%, rgba(13,58,53,0.08) 0%, transparent 60%),
                  radial-gradient(ellipse at 70% 80%, rgba(0,184,148,0.07) 0%, transparent 60%);
      animation: evBgShift 8s ease-in-out infinite alternate;
    }
    .ev-greet-content {
      position: relative; z-index: 1;
      display: flex; flex-direction: column;
      align-items: center; gap: 20px;
      padding: 32px 24px;
      width: 100%; max-width: 480px;
      animation: evFadeUp .4s ease;
    }
    .ev-greet-badge {
      font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: #0d3a35;
      background: rgba(13,58,53,0.1);
      border: 1px solid rgba(13,58,53,0.2);
      padding: 5px 14px; border-radius: 20px;
    }
    .ev-greet-text {
      font-size: clamp(40px, 10vw, 64px);
      font-weight: 300; color: #0d3a35;
      margin: 0; letter-spacing: -0.03em;
      line-height: 1.05;
      font-family: Georgia, 'Times New Roman', serif;
    }
    .ev-greet-sub {
      font-size: 14px; color: #6b7c6e; margin: 0;
    }

    /* ── VOICE GRID ── */
    .ev-voice-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 10px; width: 100%;
    }
    @media(min-width: 480px) {
      .ev-voice-grid { grid-template-columns: repeat(4, 1fr); }
    }
    .ev-voice-card {
      position: relative;
      display: flex; flex-direction: column; align-items: center;
      gap: 8px; padding: 18px 12px;
      background: #fff;
      border: 1.5px solid rgba(13,58,53,0.12);
      border-radius: 16px; cursor: pointer;
      transition: all .2s; text-align: center;
      box-shadow: 0 2px 12px rgba(13,58,53,0.06);
    }
    .ev-voice-card:hover {
      border-color: rgba(13,58,53,0.35);
      box-shadow: 0 4px 20px rgba(13,58,53,0.12);
      transform: translateY(-2px);
    }
    .ev-voice-card--selected {
      border-color: #0d3a35 !important;
      background: rgba(13,58,53,0.04) !important;
      box-shadow: 0 0 0 3px rgba(13,58,53,0.12), 0 4px 20px rgba(13,58,53,0.1) !important;
    }
    .ev-voice-card--selected::after {
      content: "✓";
      position: absolute; top: 8px; right: 10px;
      font-size: 11px; color: #0d3a35; font-weight: 700;
    }
    .ev-voice-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px; font-weight: 700;
      font-family: Georgia, serif;
    }
    .ev-voice-avatar--f { background: rgba(108,92,231,0.12); color: #6C5CE7; }
    .ev-voice-avatar--m { background: rgba(13,58,53,0.12); color: #0d3a35; }
    .ev-voice-name { font-size: 13px; font-weight: 700; color: #1a2e20; }
    .ev-voice-desc { font-size: 10.5px; color: #8a9e8e; }
    .ev-voice-loading-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: #0d3a35; opacity: 0;
      transition: opacity .2s;
    }
    .ev-voice-card--loading .ev-voice-loading-dot {
      opacity: 1; animation: evPulse .8s ease-in-out infinite;
    }

    /* ── CONTINUE BUTTON ── */
    .ev-continue-btn {
      padding: 14px 48px;
      background: #0d3a35; color: #f5f0e8;
      border: none; border-radius: 40px;
      font-size: 15px; font-weight: 600;
      cursor: pointer; letter-spacing: 0.02em;
      transition: all .2s;
      box-shadow: 0 4px 20px rgba(13,58,53,0.3);
      margin-top: 4px;
    }
    .ev-continue-btn:hover {
      background: #1a5a52;
      box-shadow: 0 6px 28px rgba(13,58,53,0.4);
      transform: translateY(-1px);
    }

    /* ── MAIN SCREEN ── */
    .ev-main-screen {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      background: #f5f0e8;
      overflow: hidden;
    }

    /* ── TOPBAR ── */
    .ev-topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px 20px; flex-shrink: 0; z-index: 10;
    }
    .ev-topbar-label {
      font-size: 13px; font-weight: 700; color: #0d3a35;
      letter-spacing: 0.04em; text-transform: uppercase;
    }
    .ev-topbar-actions { display: flex; gap: 8px; }
    .ev-minimize-btn, .ev-close-btn {
      width: 34px; height: 34px; border-radius: 50%;
      background: rgba(13,58,53,0.08);
      border: 1px solid rgba(13,58,53,0.15);
      color: #0d3a35; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s;
    }
    .ev-minimize-btn:hover, .ev-close-btn:hover {
      background: rgba(13,58,53,0.16);
    }

    /* ── CANVAS ── */
    .ev-canvas {
      flex: 1; width: 100%; display: block; cursor: pointer;
      min-height: 0;
    }

    /* ── CENTER CONTENT ── */
    .ev-center-content {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      display: flex; flex-direction: column;
      align-items: center; gap: 12px;
      pointer-events: none; text-align: center;
      padding: 0 24px; width: 100%; box-sizing: border-box;
    }
    .ev-status {
      font-size: 15px; font-weight: 600; margin: 0;
      letter-spacing: 0.06em; text-transform: lowercase;
      transition: color .4s, opacity .3s;
    }
    .ev-status--idle       { color: rgba(13,58,53,0.4); }
    .ev-status--listening  { color: #0d6a5e; }
    .ev-status--processing { color: #2d6a4f; animation: evFade 1.2s ease-in-out infinite alternate; }
    .ev-status--speaking   { color: #00b894; }

    .ev-transcript-text {
      font-size: 14px; color: rgba(13,58,53,0.55);
      font-style: italic; margin: 0; max-width: 320px;
      line-height: 1.55; min-height: 20px;
      transition: opacity .3s;
    }

    /* ── HINT ── */
    .ev-hint {
      text-align: center; font-size: 11px;
      color: rgba(13,58,53,0.3); padding: 12px 0 20px;
      flex-shrink: 0; letter-spacing: 0.03em;
    }

    /* ── ANIMATIONS ── */
    @keyframes evFadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes evSlideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(12px); }
      to   { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    @keyframes evPulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50%       { opacity: 0.5; transform: scale(0.85); }
    }
    @keyframes evFade {
      from { opacity: 0.5; } to { opacity: 1; }
    }
    @keyframes evBgShift {
      from { opacity: 0.8; } to { opacity: 1; }
    }

    /* ── MOBILE ── */
    @media(max-width: 480px) {
      .ev-greet-content { padding: 24px 16px; gap: 16px; }
      .ev-continue-btn { padding: 13px 36px; font-size: 14px; }
      .ev-topbar { padding: 12px 16px; }
    }
  `;
  document.head.appendChild(s);
}
'use strict';

/* ---------- helpers ---------- */
const $ = (id) => document.getElementById(id);
const RING_R = 100;
const RING_C = 2 * Math.PI * RING_R;

function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

/* ---------- phase color gradient (ring + credit fade from a start color to an end color as a phase progresses) ---------- */
function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function hexToRgb(hex) {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return [37, 99, 235]; // fallback: primary blue
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function lerpColor(hex1, hex2, t) {
  const a = hexToRgb(hex1);
  const b = hexToRgb(hex2);
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(a[0] + (b[0] - a[0]) * clamped);
  const g = Math.round(a[1] + (b[1] - a[1]) * clamped);
  const bl = Math.round(a[2] + (b[2] - a[2]) * clamped);
  return `rgb(${r}, ${g}, ${bl})`;
}

const PHASE_COLOR_PAIRS = {
  prep: ['--accent', '--primary'],
  warmup: ['--accent', '--warning'],
  work: ['--primary-light', '--primary-dark'],
  rest: ['--warning', '--warning'],
  amrap: ['--primary-light', '--primary-dark'],
  fortime: ['--accent', '--primary-dark'],
};

function applyPhaseColor(phase, frac) {
  let color;
  if (phase.type === 'fortime' && !phase.capped) {
    color = cssVar('--accent');
  } else {
    const pair = PHASE_COLOR_PAIRS[phase.type] || ['--primary', '--primary'];
    color = lerpColor(cssVar(pair[0]), cssVar(pair[1]), frac);
  }
  $('ringFg').style.stroke = color;
}

/* ---------- fixed settings & theme persistence ---------- */
const THEME_KEY = 'wt.theme';

// No settings UI: no prep countdown, audio/vibration/wake-lock always on.
const settings = { prep: 0, sound: true, vibrate: true, wake: true };

/* ---------- last-used config persistence (per mode) ---------- */
const CONFIGS_KEY = 'wt.configs';

function loadConfigs() {
  try {
    const raw = localStorage.getItem(CONFIGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt storage */ }
  return {};
}

function saveConfig(mode, cfg) {
  const all = loadConfigs();
  all[mode] = cfg;
  try { localStorage.setItem(CONFIGS_KEY, JSON.stringify(all)); } catch (e) { /* storage unavailable */ }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    $('themeIcon').textContent = '☀️';
  } else {
    document.documentElement.removeAttribute('data-theme');
    $('themeIcon').textContent = '🌙';
  }
}

function initTheme() {
  let theme = localStorage.getItem(THEME_KEY);
  if (!theme) {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(theme);
  $('themeToggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(THEME_KEY, next);
  });
}

/* ---------- background radio (Antenne Workout Hits) ---------- */
const RADIO_STREAM_URL = 'https://mp3channels.webradio.antenne.de/workout-hits';
const RADIO_CHECKBOX_ID = { hiit: 'hiitRadio', amrap: 'amrapRadio', fortime: 'ftRadio', custom: 'customRadio' };
let radioAudio = null;

function startRadio() {
  if (!radioAudio) {
    radioAudio = new Audio(RADIO_STREAM_URL);
    radioAudio.preload = 'none';
  }
  radioAudio.play().catch(() => { /* autoplay blocked or stream unavailable */ });
}

function stopRadio() {
  if (radioAudio) { radioAudio.pause(); }
}

/* ---------- silent keep-alive ----------
   Phones (mainly iOS) only keep the device's audio session -- and with it
   the Web Audio AudioContext used for beeps -- active while an <audio>
   element is actually playing. With the radio stream on, that's a side
   effect of the radio itself; with it off, cues would eventually go silent
   after the screen dims or the app is backgrounded. A tiny looping silent
   clip keeps the session alive either way, at zero audible cost. */
const SILENT_AUDIO_SRC = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

/* ---------- audio cues ---------- */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

let keepAliveAudio = null;
function startKeepAliveAudio() {
  if (!settings.sound) return;
  if (!keepAliveAudio) {
    keepAliveAudio = new Audio(SILENT_AUDIO_SRC);
    keepAliveAudio.loop = true;
  }
  keepAliveAudio.play().catch(() => { /* will retry on the next real user gesture */ });
}
function stopKeepAliveAudio() {
  if (keepAliveAudio) keepAliveAudio.pause();
}

function beep(freq, durationMs, type = 'sine', gainVal = 0.22) {
  if (!settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const play = () => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  };
  if (ctx.state === 'running') {
    play();
  } else {
    // Phones (mainly iOS) suspend the AudioContext after the screen dims or
    // the tab is backgrounded; starting an oscillator while still suspended
    // produces no sound at all. Resume first and only play once it settles
    // (resume() silently no-ops without a real user gesture, but this still
    // catches every case where one is available -- e.g. a tap on pause).
    ctx.resume().then(play).catch(() => {});
  }
}

function cueTick(remaining) {
  beep(880, 100, 'square', 0.16);
  vibrate(30);
}
function cuePhaseStart(type) {
  if (type === 'work') { beep(988, 220, 'sine'); vibrate([0, 80, 40, 80]); }
  else if (type === 'rest') { beep(523, 220, 'sine'); vibrate(60); }
  else if (type === 'prep' || type === 'warmup') { beep(660, 150, 'sine'); vibrate(40); }
  else { beep(784, 220, 'sine'); vibrate(60); }
}
function cueFinish() {
  beep(523, 150); setTimeout(() => beep(659, 150), 150); setTimeout(() => beep(784, 300), 300);
  vibrate([0, 120, 60, 120, 60, 200]);
}
function cueCapReached() {
  beep(392, 180, 'sawtooth'); setTimeout(() => beep(392, 180, 'sawtooth'), 220);
  vibrate([0, 150, 80, 150]);
}

function vibrate(pattern) {
  if (!settings.vibrate) return;
  if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* unsupported */ } }
}

/* ---------- wake lock ---------- */
let wakeLock = null;
async function acquireWakeLock() {
  if (!settings.wake) return;
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (e) { wakeLock = null; }
}
async function releaseWakeLock() {
  if (wakeLock) { try { await wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && session && !session.finished) {
    acquireWakeLock();
    ensureAudio();
    startKeepAliveAudio();
  }
});

/* ---------- phase builders ---------- */
function buildHiitPhases(cfg) {
  const phases = [];
  if (settings.prep > 0) phases.push({ type: 'prep', label: 'Pregătire', duration: settings.prep });
  if (cfg.warmup > 0) phases.push({ type: 'warmup', label: 'Încălzire', duration: cfg.warmup });
  const names = cfg.names.length ? cfg.names : null;
  for (let s = 1; s <= cfg.sets; s++) {
    const exName = names ? names[(s - 1) % names.length] : 'Exercițiu';
    for (let r = 1; r <= cfg.reps; r++) {
      const isLastOverall = s === cfg.sets && r === cfg.reps;
      phases.push({
        type: 'work', label: exName, duration: cfg.work,
        set: s, totalSets: cfg.sets, rep: r, totalReps: cfg.reps,
      });
      if (!isLastOverall) {
        phases.push({
          type: 'rest', label: 'Pauză', duration: cfg.rest,
          set: s, totalSets: cfg.sets, rep: r, totalReps: cfg.reps,
        });
      }
    }
  }
  return phases;
}

function buildAmrapPhases(cfg) {
  const phases = [];
  if (settings.prep > 0) phases.push({ type: 'prep', label: 'Pregătire', duration: settings.prep });
  phases.push({ type: 'amrap', label: 'AMRAP', duration: cfg.duration });
  return phases;
}

function buildCustomPhases(cfg) {
  const phases = [];
  if (settings.prep > 0) phases.push({ type: 'prep', label: 'Pregătire', duration: settings.prep });
  const rounds = Math.max(1, cfg.rounds || 1);
  const totalSets = cfg.items.length * rounds;
  let count = 0;
  for (let r = 0; r < rounds; r++) {
    cfg.items.forEach((item) => {
      count += 1;
      phases.push({
        type: item.rest ? 'rest' : 'work',
        label: item.name || (item.rest ? 'Pauză' : 'Exercițiu'),
        duration: item.duration,
        set: count,
        totalSets,
      });
    });
  }
  return phases;
}

function buildForTimePhases(cfg) {
  const phases = [];
  if (settings.prep > 0) phases.push({ type: 'prep', label: 'Pregătire', duration: settings.prep });
  phases.push({
    type: 'fortime',
    label: cfg.capped ? 'For Time' : 'Cronometru',
    duration: cfg.capped ? cfg.cap : Infinity,
    countUp: true,
    capped: cfg.capped,
  });
  return phases;
}

/* ---------- session engine ---------- */
let session = null;
let tickHandle = null;
let lastConfig = null; // { mode, cfg } for "Repeat"

function startSession(mode, phases, meta) {
  ensureAudio();
  startKeepAliveAudio();
  session = {
    mode,
    phases,
    index: 0,
    phaseStartTs: Date.now(),
    pausedAccum: 0,
    pauseStartTs: null,
    isPaused: false,
    finished: false,
    lastTickSecond: null,
    meta: meta || {},
    sessionStartTs: Date.now(),
    rounds: 0,
  };
  acquireWakeLock();
  showTimerOverlay();
  cuePhaseStart(phases[0].type);
  renderPhaseChrome();
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = setInterval(tick, 200);
  tick();
}

function currentPhase() { return session.phases[session.index]; }

function phaseElapsedSeconds() {
  const now = Date.now();
  const pausedExtra = session.isPaused ? (now - session.pauseStartTs) : 0;
  return (now - session.phaseStartTs - session.pausedAccum - pausedExtra) / 1000;
}

function advancePhase() {
  session.index += 1;
  session.lastTickSecond = null;
  if (session.index >= session.phases.length) {
    finishSession('completed');
    return;
  }
  session.phaseStartTs = Date.now();
  session.pausedAccum = 0;
  const phase = currentPhase();
  cuePhaseStart(phase.type);
  renderPhaseChrome();
}

function tick() {
  if (!session || session.finished || session.isPaused) return;
  const phase = currentPhase();
  const elapsed = phaseElapsedSeconds();

  if (phase.countUp) {
    const capped = phase.capped && isFinite(phase.duration);
    if (capped && elapsed >= phase.duration) {
      finishSession('cap-reached');
      return;
    }
    updateRingCountUp(elapsed, phase);
    if (capped) {
      const remaining = phase.duration - elapsed;
      maybeTick(remaining);
    }
  } else {
    const remaining = phase.duration - elapsed;
    if (remaining <= 0) { advancePhase(); return; }
    updateRingCountDown(remaining, phase);
    maybeTick(remaining);
  }
}

function maybeTick(remaining) {
  const sec = Math.ceil(remaining - 0.05);
  if (sec !== session.lastTickSecond && sec >= 0 && sec <= 3) {
    session.lastTickSecond = sec;
    if (sec > 0) cueTick(sec);
  } else if (sec > 3) {
    session.lastTickSecond = sec;
  }
}

function pauseSession() {
  if (!session || session.isPaused || session.finished) return;
  session.isPaused = true;
  session.pauseStartTs = Date.now();
  $('pauseBtn').innerHTML = '<span aria-hidden="true">▶</span> Reia';
}

function resumeSession() {
  if (!session || !session.isPaused) return;
  ensureAudio(); // a real tap: a good chance to recover an AudioContext a backgrounded phone suspended
  startKeepAliveAudio();
  session.pausedAccum += Date.now() - session.pauseStartTs;
  session.isPaused = false;
  session.pauseStartTs = null;
  $('pauseBtn').innerHTML = '<span aria-hidden="true">⏸</span> Pauză';
}

function skipPhase() {
  if (!session || session.finished) return;
  ensureAudio();
  advancePhase();
}

function incrementRound() {
  if (!session || session.finished || session.mode !== 'amrap') return;
  session.rounds += 1;
  $('roundsCount').textContent = String(session.rounds);
  vibrate(25);
}

function decrementRound() {
  if (!session || session.finished || session.mode !== 'amrap') return;
  session.rounds = Math.max(0, session.rounds - 1);
  $('roundsCount').textContent = String(session.rounds);
  vibrate(25);
}

function abortSession() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  session = null;
  releaseWakeLock();
  stopRadio();
  stopKeepAliveAudio();
  hideTimerOverlay();
}

function finishSession(reason) {
  if (!session || session.finished) return;
  session.finished = true;
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  releaseWakeLock();
  stopRadio();
  stopKeepAliveAudio();

  const totalElapsed = (Date.now() - session.sessionStartTs) / 1000;
  const mode = session.mode;
  const meta = session.meta;

  hideTimerOverlay();

  if (reason === 'cap-reached') cueCapReached(); else cueFinish();

  let title = randomCelebration();
  let bigTime = formatTime(totalElapsed);
  let detail = '';

  if (mode === 'hiit') {
    detail = meta.reps > 1
      ? `${meta.sets} seturi × ${meta.reps} repetări · ${meta.work}s lucru / ${meta.rest}s pauză`
      : `${meta.sets} seturi · ${meta.work}s lucru / ${meta.rest}s pauză`;
  } else if (mode === 'custom') {
    detail = meta.rounds > 1
      ? `${meta.items.length} intervale × ${meta.rounds} runde`
      : `${meta.items.length} intervale · circuit personalizat`;
  } else if (mode === 'amrap') {
    bigTime = `${session.rounds} runde`;
    detail = `Timp alocat: ${formatTime(meta.duration)}`;
  } else if (mode === 'fortime') {
    const elapsed = reason === 'cap-reached' ? meta.cap : phaseElapsedSeconds();
    bigTime = formatTime(elapsed);
    if (reason === 'cap-reached') {
      detail = `Limită: ${formatTime(meta.cap)}`;
    } else {
      detail = meta.capped ? `Time cap: ${formatTime(meta.cap)}` : 'Fără limită de timp';
    }
  }

  showResult(title, bigTime, detail);
}

/* ---------- rendering ---------- */
function setRingClass(type, urgent) {
  const card = $('timerOverlay').querySelector('.timer-card');
  card.className = 'modal-card timer-card phase-' + type + (urgent ? ' phase-urgent' : '');
}

function updateRingCountDown(remaining, phase) {
  const frac = phase.duration > 0 ? 1 - Math.max(0, remaining) / phase.duration : 1;
  const offset = RING_C * (1 - frac);
  $('ringFg').style.strokeDashoffset = String(offset);
  $('ringTime').textContent = formatTime(remaining);
  const urgent = remaining <= 3 && remaining > 0 && (phase.type === 'work' || phase.type === 'amrap');
  setRingClass(phase.type, urgent);
  applyPhaseColor(phase, frac);
}

function updateRingCountUp(elapsed, phase) {
  let frac;
  if (phase.capped && isFinite(phase.duration)) {
    frac = Math.min(1, elapsed / phase.duration);
    $('ringFg').style.strokeDashoffset = String(RING_C * (1 - frac));
    const remaining = phase.duration - elapsed;
    setRingClass(phase.type, remaining <= 3);
  } else {
    frac = (elapsed % 60) / 60;
    $('ringFg').style.strokeDashoffset = String(RING_C * (1 - frac));
    setRingClass(phase.type, false);
  }
  $('ringTime').textContent = formatTime(elapsed);
  applyPhaseColor(phase, frac);
}

function renderPhaseChrome() {
  const phase = currentPhase();
  $('ringPhase').textContent = phase.type === 'work' ? 'LUCRU'
    : phase.type === 'rest' ? 'PAUZĂ'
    : phase.type === 'prep' ? 'PREGĂTIRE'
    : phase.type === 'warmup' ? 'ÎNCĂLZIRE'
    : phase.type === 'amrap' ? 'AMRAP'
    : (phase.capped ? 'FOR TIME' : 'CRONOMETRU');
  $('timerTitle').textContent = phase.label;

  const isListMode = session.mode === 'hiit' || session.mode === 'custom';

  if (isListMode && phase.set) {
    $('timerSet').textContent = phase.totalReps > 1
      ? `Set ${phase.set} / ${phase.totalSets} · Rep ${phase.rep} / ${phase.totalReps}`
      : `Set ${phase.set} / ${phase.totalSets}`;
  } else {
    $('timerSet').textContent = '';
  }

  const next = session.phases[session.index + 1];
  if (isListMode && next) {
    $('timerNext').textContent = `Urmează: ${next.label}`;
  } else {
    $('timerNext').textContent = '';
  }

  $('skipBtn').hidden = !(isListMode && next);
  $('finishBtn').hidden = session.mode !== 'fortime';
  $('roundsBox').hidden = session.mode !== 'amrap';
  $('roundsCount').textContent = String(session.rounds);
  $('pauseBtn').innerHTML = '<span aria-hidden="true">⏸</span> Pauză';
  setRingClass(phase.type, false);
  resetRingInstantly(phase);
}

// Snap the ring back to empty and its new phase's start color without
// animating through the previous phase's end state (would otherwise show
// a visible sweep/jump as one phase's ring hands off to the next).
function resetRingInstantly(phase) {
  const ringFg = $('ringFg');
  ringFg.style.transition = 'none';
  ringFg.style.strokeDashoffset = String(RING_C);
  applyPhaseColor(phase, 0);
  void ringFg.offsetWidth; // force reflow so the reset above is committed before re-enabling the transition
  ringFg.style.transition = '';
}

function showTimerOverlay() { $('timerOverlay').hidden = false; }
function hideTimerOverlay() { $('timerOverlay').hidden = true; }

const CELEBRATION_MESSAGES = [
  'You rock! 🔥',
  'Beast mode! 💪',
  'Crushed it! 🙌',
  'That\'s a wrap! 🎉',
  'Legend status! 🏆',
  'Unstoppable! ⚡',
  'Nailed it! 🎯',
  'T GYM energy! 💙',
];

function randomCelebration() {
  return CELEBRATION_MESSAGES[Math.floor(Math.random() * CELEBRATION_MESSAGES.length)];
}

const CONFETTI_COLORS = ['#00b0f7', '#2563eb', '#7dd3fc', '#1e3a8a', '#eab308', '#ffffff'];

function launchConfetti() {
  const container = $('confetti');
  container.innerHTML = '';
  const count = 60;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.setProperty('--drift', String(Math.round(Math.random() * 160 - 80)));
    piece.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    piece.style.animationDelay = `${Math.random() * 0.4}s`;
    if (Math.random() < 0.5) piece.style.borderRadius = '50%';
    container.appendChild(piece);
  }
}

function clearConfetti() { $('confetti').innerHTML = ''; }

function showResult(title, time, detail) {
  $('resultTitle').textContent = title;
  $('resultTime').textContent = time;
  $('resultDetail').textContent = detail;
  $('resultOverlay').hidden = false;
  launchConfetti();
}
function hideResult() { $('resultOverlay').hidden = true; clearConfetti(); }

/* ---------- config readers ---------- */
function parseNames(raw) {
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

function readHiitConfig() {
  return {
    sets: Math.max(1, parseInt($('hiitSets').value, 10) || 1),
    reps: Math.max(1, parseInt($('hiitReps').value, 10) || 1),
    work: Math.max(1, parseInt($('hiitWork').value, 10) || 1),
    rest: Math.max(0, parseInt($('hiitRest').value, 10) || 0),
    warmup: Math.max(0, parseInt($('hiitWarmup').value, 10) || 0),
    names: parseNames($('hiitNames').value),
  };
}

function readAmrapConfig() {
  const min = Math.max(0, parseInt($('amrapMin').value, 10) || 0);
  const sec = Math.max(0, parseInt($('amrapSec').value, 10) || 0);
  return { duration: Math.max(1, min * 60 + sec) };
}

function readForTimeConfig() {
  const capped = $('ftTimeCap').checked;
  const min = Math.max(0, parseInt($('ftCapMin').value, 10) || 0);
  const sec = Math.max(0, parseInt($('ftCapSec').value, 10) || 0);
  return { capped, cap: Math.max(1, min * 60 + sec) };
}

function readCustomConfig() {
  const items = Array.from($('customList').querySelectorAll('.interval-row')).map((row) => ({
    name: row.querySelector('.interval-name').value.trim(),
    duration: Math.max(1, parseInt(row.querySelector('.interval-duration').value, 10) || 0),
    rest: row.querySelector('.interval-rest').checked,
  }));
  const rounds = Math.max(1, parseInt($('customRounds').value, 10) || 1);
  return { items, rounds };
}

function launch(mode) {
  const radioCheckbox = $(RADIO_CHECKBOX_ID[mode]);
  if (radioCheckbox && radioCheckbox.checked) startRadio(); else stopRadio();

  if (mode === 'hiit') {
    const cfg = readHiitConfig();
    lastConfig = { mode, cfg };
    saveConfig(mode, cfg);
    startSession('hiit', buildHiitPhases(cfg), cfg);
  } else if (mode === 'custom') {
    const cfg = readCustomConfig();
    if (!cfg.items.length) return;
    lastConfig = { mode, cfg };
    saveConfig(mode, cfg);
    startSession('custom', buildCustomPhases(cfg), cfg);
  } else if (mode === 'amrap') {
    const cfg = readAmrapConfig();
    lastConfig = { mode, cfg };
    saveConfig(mode, cfg);
    startSession('amrap', buildAmrapPhases(cfg), cfg);
  } else if (mode === 'fortime') {
    const cfg = readForTimeConfig();
    lastConfig = { mode, cfg };
    saveConfig(mode, cfg);
    startSession('fortime', buildForTimePhases(cfg), cfg);
  }
}

/* ---------- UI wiring ---------- */
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.panel');
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
      panels.forEach((p) => { p.classList.remove('active'); p.hidden = true; });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const panel = $('panel-' + btn.dataset.mode);
      panel.classList.add('active');
      panel.hidden = false;
    });
  });

  document.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => launch(btn.dataset.start));
  });

  $('ftTimeCap').addEventListener('change', (e) => {
    $('ftCapFields').hidden = !e.target.checked;
  });
}

function formatIntervalTotal() {
  const rows = Array.from($('customList').querySelectorAll('.interval-row'));
  const rounds = Math.max(1, parseInt($('customRounds').value, 10) || 1);
  const sum = rows.reduce((acc, row) => acc + (Math.max(0, parseInt(row.querySelector('.interval-duration').value, 10) || 0)), 0);
  const total = sum * rounds + (settings.prep > 0 ? settings.prep : 0);
  return formatTime(total);
}

function updateCustomListState() {
  const rows = Array.from($('customList').querySelectorAll('.interval-row'));
  $('customEmptyWarning').hidden = rows.length > 0;
  const startBtn = document.querySelector('[data-start="custom"]');
  if (startBtn) startBtn.disabled = rows.length === 0;
  rows.forEach((row, i) => {
    row.querySelector('.interval-move[data-dir="-1"]').disabled = i === 0;
    row.querySelector('.interval-move[data-dir="1"]').disabled = i === rows.length - 1;
  });
  $('customTotal').textContent = `Timp total: ≈ ${formatIntervalTotal()}`;
}

function addIntervalRow(name, duration, rest) {
  const row = document.createElement('div');
  row.className = 'interval-row' + (rest ? ' is-rest' : '');

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.className = 'interval-name';
  nameInput.placeholder = rest ? 'Pauză (opțional)' : 'Exercițiu (opțional)';
  let restNameAutoFilled = false;
  if (!name && rest) {
    nameInput.value = 'Pauză';
    restNameAutoFilled = true;
  } else {
    nameInput.value = name || '';
  }
  nameInput.addEventListener('input', () => { restNameAutoFilled = false; });

  const durationWrap = document.createElement('div');
  durationWrap.className = 'interval-duration-wrap';
  const durationInput = document.createElement('input');
  durationInput.type = 'number';
  durationInput.className = 'interval-duration';
  durationInput.min = '1';
  durationInput.max = '3600';
  durationInput.inputMode = 'numeric';
  durationInput.value = String(duration || 30);
  durationInput.addEventListener('input', updateCustomListState);
  const unit = document.createElement('span');
  unit.className = 'interval-duration-unit';
  unit.textContent = 's';
  durationWrap.append(durationInput, unit);

  const restLabel = document.createElement('label');
  restLabel.className = 'interval-rest-toggle';
  const restInput = document.createElement('input');
  restInput.type = 'checkbox';
  restInput.className = 'interval-rest';
  restInput.checked = !!rest;
  restInput.addEventListener('change', () => {
    const checked = restInput.checked;
    row.classList.toggle('is-rest', checked);
    nameInput.placeholder = checked ? 'Pauză (opțional)' : 'Exercițiu (opțional)';
    if (checked && !nameInput.value.trim()) {
      nameInput.value = 'Pauză';
      restNameAutoFilled = true;
    } else if (!checked && restNameAutoFilled) {
      nameInput.value = '';
      restNameAutoFilled = false;
    }
  });
  restLabel.append(restInput, document.createTextNode(' Pauză'));

  const actions = document.createElement('div');
  actions.className = 'interval-row-actions';

  const moveUpBtn = document.createElement('button');
  moveUpBtn.type = 'button';
  moveUpBtn.className = 'interval-move';
  moveUpBtn.dataset.dir = '-1';
  moveUpBtn.setAttribute('aria-label', 'Mută mai sus');
  moveUpBtn.textContent = '↑';
  moveUpBtn.addEventListener('click', () => {
    if (row.previousElementSibling) {
      $('customList').insertBefore(row, row.previousElementSibling);
      updateCustomListState();
    }
    moveUpBtn.blur();
  });

  const moveDownBtn = document.createElement('button');
  moveDownBtn.type = 'button';
  moveDownBtn.className = 'interval-move';
  moveDownBtn.dataset.dir = '1';
  moveDownBtn.setAttribute('aria-label', 'Mută mai jos');
  moveDownBtn.textContent = '↓';
  moveDownBtn.addEventListener('click', () => {
    if (row.nextElementSibling) {
      $('customList').insertBefore(row.nextElementSibling, row);
      updateCustomListState();
    }
    moveDownBtn.blur();
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'interval-remove';
  removeBtn.setAttribute('aria-label', 'Șterge interval');
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', () => { row.remove(); updateCustomListState(); });

  actions.append(moveUpBtn, moveDownBtn, removeBtn);
  row.append(nameInput, durationWrap, restLabel, actions);
  $('customList').appendChild(row);
  updateCustomListState();
}

function populateCustomList(items) {
  $('customList').innerHTML = '';
  (items && items.length ? items : [{ name: '', duration: 30, rest: false }, { name: '', duration: 30, rest: false }])
    .forEach((item) => addIntervalRow(item.name, item.duration, item.rest));
}

function initCustomList() {
  populateCustomList(null);
  $('addIntervalBtn').addEventListener('click', () => addIntervalRow('', 30, false));
  $('customRounds').addEventListener('input', updateCustomListState);
}

function initSteppers() {
  document.querySelectorAll('.stepper').forEach((wrap) => {
    const input = wrap.querySelector('input[type="number"]');
    const step = parseInt(wrap.dataset.step, 10) || 1;

    const clamp = (val) => {
      const min = input.min !== '' ? parseInt(input.min, 10) : -Infinity;
      const max = input.max !== '' ? parseInt(input.max, 10) : Infinity;
      return Math.min(max, Math.max(min, val));
    };

    const syncButtons = () => {
      const val = parseInt(input.value, 10) || 0;
      const min = input.min !== '' ? parseInt(input.min, 10) : -Infinity;
      const max = input.max !== '' ? parseInt(input.max, 10) : Infinity;
      wrap.querySelector('[data-dir="-1"]').disabled = val <= min;
      wrap.querySelector('[data-dir="1"]').disabled = val >= max;
    };

    wrap.querySelectorAll('.stepper-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir, 10);
        const current = parseInt(input.value, 10) || 0;
        input.value = String(clamp(current + dir * step));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        syncButtons();
      });
    });

    input.addEventListener('input', syncButtons);
    input.addEventListener('change', () => {
      input.value = String(clamp(parseInt(input.value, 10) || 0));
      syncButtons();
    });
    syncButtons();
  });
}

function initTimerControls() {
  $('pauseBtn').addEventListener('click', () => {
    if (!session) return;
    if (session.isPaused) resumeSession(); else pauseSession();
  });
  $('skipBtn').addEventListener('click', skipPhase);
  $('finishBtn').addEventListener('click', () => finishSession('finished'));
  $('timerClose').addEventListener('click', abortSession);
  $('roundsPlus').addEventListener('click', incrementRound);
  $('roundsMinus').addEventListener('click', decrementRound);
}

function initResultControls() {
  $('resultClose').addEventListener('click', hideResult);
  $('resultRepeat').addEventListener('click', () => {
    hideResult();
    if (lastConfig) launch(lastConfig.mode);
  });
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
    });
  }
}

function restoreConfigs() {
  const saved = loadConfigs();

  if (saved.hiit) {
    const c = saved.hiit;
    if (c.sets != null) $('hiitSets').value = String(c.sets);
    if (c.reps != null) $('hiitReps').value = String(c.reps);
    if (c.work != null) $('hiitWork').value = String(c.work);
    if (c.rest != null) $('hiitRest').value = String(c.rest);
    if (c.warmup != null) $('hiitWarmup').value = String(c.warmup);
    if (c.names) $('hiitNames').value = c.names.join('\n');
    ['hiitSets', 'hiitReps', 'hiitWork', 'hiitRest', 'hiitWarmup'].forEach((id) => $(id).dispatchEvent(new Event('change', { bubbles: true })));
  }

  if (saved.amrap) {
    const totalSec = Math.max(0, saved.amrap.duration || 0);
    $('amrapMin').value = String(Math.floor(totalSec / 60));
    $('amrapSec').value = String(totalSec % 60);
    ['amrapMin', 'amrapSec'].forEach((id) => $(id).dispatchEvent(new Event('change', { bubbles: true })));
  }

  if (saved.fortime) {
    $('ftTimeCap').checked = !!saved.fortime.capped;
    $('ftCapFields').hidden = !saved.fortime.capped;
    const capSec = Math.max(0, saved.fortime.cap || 0);
    $('ftCapMin').value = String(Math.floor(capSec / 60));
    $('ftCapSec').value = String(capSec % 60);
    ['ftCapMin', 'ftCapSec'].forEach((id) => $(id).dispatchEvent(new Event('change', { bubbles: true })));
  }

  if (saved.custom && saved.custom.items && saved.custom.items.length) {
    populateCustomList(saved.custom.items);
    $('customRounds').value = String(saved.custom.rounds || 1);
    $('customRounds').dispatchEvent(new Event('change', { bubbles: true }));
    updateCustomListState();
  }
}

function init() {
  initTheme();
  initTabs();
  initCustomList();
  initSteppers();
  restoreConfigs();
  initTimerControls();
  initResultControls();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);

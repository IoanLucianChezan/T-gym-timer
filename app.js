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
  if (!m) return [22, 163, 74]; // fallback: primary green
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
  work: ['--primary', '--danger'],
  rest: ['--warning', '--primary'],
  amrap: ['--primary', '--danger'],
  fortime: ['--accent', '--danger'],
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
  const credit = document.querySelector('.timer-credit');
  if (credit) credit.style.color = color;
}

/* ---------- settings & theme persistence ---------- */
const SETTINGS_KEY = 'wt.settings';
const THEME_KEY = 'wt.theme';

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { prep: 5, sound: true, vibrate: true, wake: true, ...JSON.parse(raw) };
  } catch (e) { /* ignore corrupt storage */ }
  return { prep: 5, sound: true, vibrate: true, wake: true };
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

let settings = loadSettings();

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
const RADIO_CHECKBOX_ID = { hiit: 'hiitRadio', amrap: 'amrapRadio', fortime: 'ftRadio' };
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

function beep(freq, durationMs, type = 'sine', gainVal = 0.18) {
  if (!settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
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
}

function cueTick(remaining) {
  beep(880, 100, 'square', 0.12);
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
  if (document.visibilityState === 'visible' && session && !session.finished) acquireWakeLock();
});

/* ---------- phase builders ---------- */
function buildHiitPhases(cfg) {
  const phases = [];
  if (settings.prep > 0) phases.push({ type: 'prep', label: 'Pregătire', duration: settings.prep });
  if (cfg.warmup > 0) phases.push({ type: 'warmup', label: 'Încălzire', duration: cfg.warmup });
  const names = cfg.names.length ? cfg.names : null;
  for (let i = 1; i <= cfg.sets; i++) {
    const exName = names ? names[(i - 1) % names.length] : 'Exercițiu';
    phases.push({ type: 'work', label: exName, duration: cfg.work, set: i, totalSets: cfg.sets });
    if (i < cfg.sets) phases.push({ type: 'rest', label: 'Pauză', duration: cfg.rest, set: i, totalSets: cfg.sets });
  }
  return phases;
}

function buildAmrapPhases(cfg) {
  const phases = [];
  if (settings.prep > 0) phases.push({ type: 'prep', label: 'Pregătire', duration: settings.prep });
  phases.push({ type: 'amrap', label: 'AMRAP', duration: cfg.duration });
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
  session.pausedAccum += Date.now() - session.pauseStartTs;
  session.isPaused = false;
  session.pauseStartTs = null;
  $('pauseBtn').innerHTML = '<span aria-hidden="true">⏸</span> Pauză';
}

function skipPhase() {
  if (!session || session.finished) return;
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
  hideTimerOverlay();
}

function finishSession(reason) {
  if (!session || session.finished) return;
  session.finished = true;
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
  releaseWakeLock();
  stopRadio();

  const totalElapsed = (Date.now() - session.sessionStartTs) / 1000;
  const mode = session.mode;
  const meta = session.meta;

  hideTimerOverlay();

  if (reason === 'cap-reached') cueCapReached(); else cueFinish();

  let title = 'Antrenament finalizat!';
  let bigTime = formatTime(totalElapsed);
  let detail = '';

  if (mode === 'hiit') {
    title = 'HIIT finalizat! 🎉';
    detail = `${meta.sets} seturi · ${meta.work}s lucru / ${meta.rest}s pauză`;
  } else if (mode === 'amrap') {
    title = 'AMRAP finalizat! 🎉';
    bigTime = `${session.rounds} runde`;
    detail = `Timp alocat: ${formatTime(meta.duration)}`;
  } else if (mode === 'fortime') {
    const elapsed = reason === 'cap-reached' ? meta.cap : phaseElapsedSeconds();
    bigTime = formatTime(elapsed);
    if (reason === 'cap-reached') {
      title = 'Time cap atins!';
      detail = `Limită: ${formatTime(meta.cap)}`;
    } else {
      title = 'Timp final!';
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

  if (session.mode === 'hiit' && phase.set) {
    $('timerSet').textContent = `Set ${phase.set} / ${phase.totalSets}`;
  } else {
    $('timerSet').textContent = '';
  }

  const next = session.phases[session.index + 1];
  if (session.mode === 'hiit' && next) {
    $('timerNext').textContent = `Urmează: ${next.label}`;
  } else {
    $('timerNext').textContent = '';
  }

  $('skipBtn').hidden = !(session.mode === 'hiit' && next);
  $('finishBtn').hidden = session.mode !== 'fortime';
  $('roundsBox').hidden = session.mode !== 'amrap';
  $('roundsCount').textContent = String(session.rounds);
  $('pauseBtn').innerHTML = '<span aria-hidden="true">⏸</span> Pauză';
  setRingClass(phase.type, false);
  $('ringFg').style.strokeDashoffset = String(RING_C);
  applyPhaseColor(phase, 0);
}

function showTimerOverlay() { $('timerOverlay').hidden = false; }
function hideTimerOverlay() { $('timerOverlay').hidden = true; }

function showResult(title, time, detail) {
  $('resultTitle').textContent = title;
  $('resultTime').textContent = time;
  $('resultDetail').textContent = detail;
  $('resultOverlay').hidden = false;
}
function hideResult() { $('resultOverlay').hidden = true; }

/* ---------- config readers ---------- */
function parseNames(raw) {
  return raw.split('\n').map((s) => s.trim()).filter(Boolean);
}

function readHiitConfig() {
  return {
    sets: Math.max(1, parseInt($('hiitSets').value, 10) || 1),
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

function launch(mode) {
  const radioCheckbox = $(RADIO_CHECKBOX_ID[mode]);
  if (radioCheckbox && radioCheckbox.checked) startRadio(); else stopRadio();

  if (mode === 'hiit') {
    const cfg = readHiitConfig();
    lastConfig = { mode, cfg };
    startSession('hiit', buildHiitPhases(cfg), cfg);
  } else if (mode === 'amrap') {
    const cfg = readAmrapConfig();
    lastConfig = { mode, cfg };
    startSession('amrap', buildAmrapPhases(cfg), cfg);
  } else if (mode === 'fortime') {
    const cfg = readForTimeConfig();
    lastConfig = { mode, cfg };
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

function initSettingsModal() {
  const modal = $('settingsModal');
  $('settingsBtn').addEventListener('click', () => {
    document.querySelectorAll('#prepRadioGroup input[name="prep"]').forEach((r) => {
      r.checked = String(settings.prep) === r.value;
    });
    $('soundToggle').checked = settings.sound;
    $('vibrateToggle').checked = settings.vibrate;
    $('wakeToggle').checked = settings.wake;
    updateInstallRow();
    modal.hidden = false;
  });
  $('settingsClose').addEventListener('click', () => { modal.hidden = true; });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

  document.querySelectorAll('#prepRadioGroup input[name="prep"]').forEach((r) => {
    r.addEventListener('change', () => {
      settings.prep = parseInt(r.value, 10);
      saveSettings(settings);
    });
  });
  $('soundToggle').addEventListener('change', (e) => { settings.sound = e.target.checked; saveSettings(settings); });
  $('vibrateToggle').addEventListener('change', (e) => { settings.vibrate = e.target.checked; saveSettings(settings); });
  $('wakeToggle').addEventListener('change', (e) => { settings.wake = e.target.checked; saveSettings(settings); });
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

/* ---------- custom install prompt ---------- */
let deferredInstallPrompt = null;

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function updateInstallRow() {
  const row = $('installRow');
  const btn = $('installBtn');
  const hint = $('installHint');
  if (isStandalone()) { row.hidden = true; return; }
  if (deferredInstallPrompt) {
    row.hidden = false;
    btn.hidden = false;
    hint.hidden = true;
  } else if (isIosDevice()) {
    row.hidden = false;
    btn.hidden = true;
    hint.hidden = false;
  } else {
    row.hidden = true;
  }
}

function initInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    updateInstallRow();
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    updateInstallRow();
  });
  $('installBtn').addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    updateInstallRow();
  });
  updateInstallRow();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline support optional */ });
    });
  }
}

function init() {
  initTheme();
  initTabs();
  initSteppers();
  initSettingsModal();
  initTimerControls();
  initResultControls();
  initInstallPrompt();
  registerServiceWorker();
}

document.addEventListener('DOMContentLoaded', init);

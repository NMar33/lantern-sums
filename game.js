import { TARGET, checkSelection, scoreFor } from './logic.js';

const LIVES = 3;
const STAR_COUNT = 160;

const SPAWN_INTERVAL = 1.2; // seconds
const RISE_SPEED = 40; // px per second
const LANTERN_RADIUS = 24;
const LANTERN_GAP = 8; // minimum space between two lanterns
const SPAWN_TRIES = 20;
const FLOAT_TIME = 0.8; // seconds a matched lantern takes to float away
const SHAKE_TIME = 0.4;
const SHAKE_AMPLITUDE = 3; // px, at most half of LANTERN_GAP
const MAX_STEP = 0.1; // seconds; longer frames (a hidden tab) are clamped

const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const targetEl = document.getElementById('target');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');

let stars = [];
let lanterns = [];
let score = 0;
let spawnTimer = 0;
let running = false;
let lastTime = 0;
let nextId = 1;

function lanternIcon() {
  return `<svg viewBox="0 0 22 32" aria-hidden="true">
    <rect x="8" y="0" width="6" height="3" rx="1" fill="#8a5a2b"/>
    <rect x="3" y="3" width="16" height="24" rx="7" fill="#ffb347"/>
    <rect x="6" y="6" width="10" height="18" rx="5" fill="#ffe08a"/>
    <rect x="8" y="27" width="6" height="4" rx="1" fill="#8a5a2b"/>
  </svg>`;
}

function renderLives(count) {
  livesEl.innerHTML = lanternIcon().repeat(count);
  livesEl.setAttribute('aria-label', `${count} lives left`);
}

function renderScore() {
  scoreEl.textContent = score;
}

function makeStars(width, height) {
  stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.4 + 0.3,
    alpha: Math.random() * 0.6 + 0.4,
  }));
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  makeStars(window.innerWidth, window.innerHeight);
  draw();
}

// Lanterns in play: rising, not floating away.
function activeLanterns() {
  return lanterns.filter((l) => !l.floating);
}

function selectedLanterns() {
  return lanterns.filter((l) => l.selected && !l.floating);
}

function overlapsAny(x, y) {
  const minDistance = 2 * LANTERN_RADIUS + LANTERN_GAP;
  return lanterns.some((l) => Math.hypot(l.x - x, l.y - y) < minDistance);
}

// All lanterns rise at the same speed, so two that do not overlap when the
// newer one appears never overlap later.
function spawnLantern() {
  const w = window.innerWidth;
  const y = window.innerHeight + LANTERN_RADIUS;
  const margin = LANTERN_RADIUS + LANTERN_GAP;
  if (w <= 2 * margin) return;

  for (let i = 0; i < SPAWN_TRIES; i++) {
    const x = margin + Math.random() * (w - 2 * margin);
    if (!overlapsAny(x, y)) {
      lanterns.push({
        id: nextId++,
        x,
        y,
        value: 1 + Math.floor(Math.random() * 9),
        selected: false,
        floating: false,
        floatT: 0,
        shakeT: 0,
      });
      return;
    }
  }
  // No free spot this time: skip this spawn.
}

function resolveSelection() {
  const selected = selectedLanterns();
  const result = checkSelection(selected.map((l) => l.value));
  if (result === 'match') {
    score += scoreFor(selected.length);
    renderScore();
    for (const l of selected) {
      l.selected = false;
      l.floating = true;
    }
  } else if (result === 'over') {
    for (const l of selected) {
      l.selected = false;
      l.shakeT = SHAKE_TIME;
    }
  }
}

function lanternAt(x, y) {
  return activeLanterns().find(
    (l) => Math.hypot(l.x - x, l.y - y) <= LANTERN_RADIUS,
  );
}

function onPointerDown(event) {
  if (!running) return;
  const rect = canvas.getBoundingClientRect();
  const lantern = lanternAt(event.clientX - rect.left, event.clientY - rect.top);
  if (!lantern) return;
  lantern.selected = !lantern.selected;
  if (lantern.selected) resolveSelection();
}

function update(dt) {
  spawnTimer += dt;
  while (spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer -= SPAWN_INTERVAL;
    spawnLantern();
  }

  for (const l of lanterns) {
    l.y -= RISE_SPEED * dt;
    if (l.floating) l.floatT += dt;
    if (l.shakeT > 0) l.shakeT = Math.max(0, l.shakeT - dt);
  }

  // Lanterns that left the sky or finished floating away are dropped;
  // a selected one that leaves the top is dropped from the selection too.
  lanterns = lanterns.filter(
    (l) => l.y + LANTERN_RADIUS > 0 && l.floatT < FLOAT_TIME,
  );
}

function drawSky() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#050d24');
  gradient.addColorStop(0.6, '#0b1a3a');
  gradient.addColorStop(1, '#16295a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  for (const star of stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLantern(l) {
  let r = LANTERN_RADIUS;
  let y = l.y;
  let x = l.x;
  let alpha = 1;

  if (l.floating) {
    // Shrink and rise by the amount it shrinks: the top edge stays on its
    // usual track, so a floating lantern cannot run into the one above.
    const t = Math.min(1, l.floatT / FLOAT_TIME);
    r = LANTERN_RADIUS * (1 - 0.7 * t);
    y -= LANTERN_RADIUS - r;
    alpha = 1 - t;
  }
  if (l.shakeT > 0) {
    x += Math.sin(l.shakeT * 60) * SHAKE_AMPLITUDE * (l.shakeT / SHAKE_TIME);
  }

  ctx.save();
  ctx.globalAlpha = alpha;

  if (l.selected) {
    ctx.shadowColor = 'rgba(255, 220, 120, 0.9)';
    ctx.shadowBlur = 18;
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, r + 2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  const body = ctx.createRadialGradient(x, y - r * 0.2, r * 0.1, x, y, r);
  body.addColorStop(0, '#ffe08a');
  body.addColorStop(1, '#f08a24');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3a1d00';
  ctx.font = `700 ${Math.round(r * 0.95)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(l.value), x, y + 1);

  ctx.restore();
}

function draw() {
  drawSky();
  for (const l of lanterns) drawLantern(l);
}

function frame(time) {
  const dt = Math.min(MAX_STEP, (time - lastTime) / 1000);
  lastTime = time;
  update(dt);
  draw();
  if (running) requestAnimationFrame(frame);
}

function startGame() {
  overlay.hidden = true;
  lanterns = [];
  score = 0;
  spawnTimer = SPAWN_INTERVAL; // first lantern right away
  renderScore();
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(frame);
}

startButton.addEventListener('click', startGame);
canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('resize', resize);

targetEl.textContent = TARGET;
renderLives(LIVES);
renderScore();
resize();

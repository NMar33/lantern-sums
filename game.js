import {
  ADVANCE_POINTS,
  escapeCost,
  halloweenOn,
  levelSettings,
  selectionOutcome,
  unlockedAfter,
} from './logic.js';

const LIVES = 3;
const STAR_COUNT = 160;

const LANTERN_SIZE = 1.5; // drawing scale of the paper lantern
const LANTERN_RADIUS = 30 * LANTERN_SIZE; // the whole lantern fits in this circle
const LANTERN_GAP = 8; // minimum space between two lanterns
const SPAWN_TRIES = 20;
const FLOAT_TIME = 0.8; // seconds a matched lantern takes to float away
const SHAKE_TIME = 0.4;
const SHAKE_AMPLITUDE = 3; // px, at most half of LANTERN_GAP
// Never two ghosts in a row: a 1 in 7 chance after a normal lantern makes
// about 1 lantern in 8 a ghost.
const GHOST_CHANCE = 1 / 7;
const GHOST_FLASH_TIME = 0.6;
const BAT_COUNT = 4;
const BAT_SPEED = [50, 90]; // px per second, slowest and fastest
const BAT_FLAP = 9; // wing beats per second
const MAX_STEP = 0.1; // seconds; longer frames (a hidden tab) are clamped
const BEST_KEY = 'lantern-sums-best';
const UNLOCKED_KEY = 'lantern-sums-unlocked';
const BANNER_TIME = 1800; // ms the level banner stays up
const HALLOWEEN_KEY = 'lantern-sums-halloween'; // 'on' or 'off', set by the toggle
const DEMO_PICK_DELAY = 0.5; // seconds between two picks in attract mode
const DEMO_REST = 0.8; // seconds after a match before the next group
const DEMO_RETRY = 0.3; // seconds before looking again when no group adds up
const DEMO_MAX_GROUP = 4;
const DEMO_CANDIDATES = 16;
const DEMO_WARMUP = 8; // seconds simulated so the sky is not empty at first

const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const hudEl = document.querySelector('.hud');
const scoreEl = document.getElementById('score');
const targetEl = document.getElementById('target');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');
const pauseOverlay = document.getElementById('pause-overlay');
const gameOverOverlay = document.getElementById('gameover-overlay');
const finalScoreEl = document.getElementById('final-score');
const bestScoreEl = document.getElementById('best-score');
const againButton = document.getElementById('again-button');
const nextButton = document.getElementById('next-button');
const levelEl = document.getElementById('level');
const progressFillEl = document.getElementById('progress-fill');
const progressEl = document.querySelector('.hud-progress');
const finalLevelEl = document.getElementById('final-level');
const startLevelEl = document.getElementById('start-level');
const bannerEl = document.getElementById('level-banner');
const halloweenToggle = document.getElementById('halloween-toggle');
const titleEl = document.getElementById('title');

let stars = [];
let bats = [];
let lanterns = [];
let score = 0;
let lives = LIVES;
let level = 1;
let settings = levelSettings(1); // speed, spawn interval and target
let unlocked = 1; // highest level the player may start
let bannerTimer = 0;
let spawnTimer = 0;
let running = false;
let demo = false; // attract mode behind the start overlay
let demoPlan = []; // ids of the lanterns the demo will pick next
let demoTimer = 0;
let paused = false;
let lastTime = 0;
let frameId = 0;
let nextId = 1;
let halloween = false;
let lastWasGhost = false;

function lanternIcon() {
  return `<svg viewBox="0 0 22 32" aria-hidden="true">
    <rect x="8" y="0" width="6" height="3" rx="1" fill="#8a5a2b"/>
    <rect x="3" y="3" width="16" height="24" rx="7" fill="#ffb347"/>
    <rect x="6" y="6" width="10" height="18" rx="5" fill="#ffe08a"/>
    <rect x="8" y="27" width="6" height="4" rx="1" fill="#8a5a2b"/>
  </svg>`;
}

function pumpkinIcon() {
  return `<svg viewBox="0 0 22 32" aria-hidden="true">
    <rect x="10" y="5" width="3" height="5" rx="1" fill="#4f6b22"/>
    <ellipse cx="6.5" cy="19" rx="5.5" ry="8" fill="#e06a14"/>
    <ellipse cx="15.5" cy="19" rx="5.5" ry="8" fill="#e06a14"/>
    <ellipse cx="11" cy="19" rx="6" ry="9" fill="#ff8c1a"/>
    <path d="M6 16 l3 2.5 h-3 z M16 16 l-3 2.5 h3 z" fill="#ffe08a"/>
    <path d="M6.5 22 q4.5 3 9 0 q-4.5 1.5 -9 0 z" fill="#ffe08a"/>
  </svg>`;
}

function buildLives() {
  livesEl.innerHTML = (halloween ? pumpkinIcon() : lanternIcon()).repeat(LIVES);
  renderLives();
}

// Lost lives stay in the bar, faded.
function renderLives() {
  livesEl.querySelectorAll('svg').forEach((icon, i) => {
    icon.classList.toggle('lost', i >= lives);
  });
  livesEl.setAttribute('aria-label', `${lives} lives left`);
}

// localStorage can be missing or throw (private windows, blocked storage).
function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // The best score is then kept for this page only.
  }
}

function readUnlocked() {
  try {
    return Math.max(1, Math.floor(Number(localStorage.getItem(UNLOCKED_KEY))) || 1);
  } catch {
    return 1;
  }
}

function writeUnlocked(value) {
  try {
    localStorage.setItem(UNLOCKED_KEY, String(value));
  } catch {
    // The unlocked level is then kept for this page only.
  }
}

function unlock(value) {
  if (value <= unlocked) return;
  unlocked = value;
  writeUnlocked(unlocked);
}

// The bar runs from 0 to ADVANCE_POINTS; its marks at 100 and 200 are CSS.
// The toggle's remembered choice: true, false, or null when never set.
function readHalloweenChoice() {
  try {
    const value = localStorage.getItem(HALLOWEEN_KEY);
    return value === 'on' ? true : value === 'off' ? false : null;
  } catch {
    return null;
  }
}

function writeHalloweenChoice(on) {
  try {
    localStorage.setItem(HALLOWEEN_KEY, on ? 'on' : 'off');
  } catch {
    // The choice is then kept for this page only.
  }
}

function setHalloween(on) {
  halloween = on;
  // Ghosts exist only in Halloween mode.
  if (!on) lanterns = lanterns.filter((l) => !l.ghost);
  document.body.classList.toggle('halloween', on);
  halloweenToggle.setAttribute('aria-checked', String(on));
  titleEl.textContent = on ? 'Pumpkin Sums' : 'Lantern Sums';
  document.title = titleEl.textContent;
  buildLives();
}

// The toggle is the player's own choice, so it is remembered; a ?theme=
// link only sets the mode for the visit and is not saved.
function onHalloweenToggle() {
  setHalloween(!halloween);
  writeHalloweenChoice(halloween);
  draw();
}

function renderScore() {
  scoreEl.textContent = score;
  const shown = Math.min(score, ADVANCE_POINTS);
  progressFillEl.style.width = `${(100 * shown) / ADVANCE_POINTS}%`;
  progressEl.setAttribute('aria-valuenow', String(shown));
}

function renderLevel() {
  levelEl.textContent = level;
  targetEl.textContent = settings.target;
}

function renderStartLevel() {
  startLevelEl.textContent = `Starts at level ${unlocked}`;
  startLevelEl.hidden = unlocked === 1;
}

function makeStars(width, height) {
  stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 1.4 + 0.3,
    alpha: Math.random() * 0.6 + 0.4,
  }));
}

// Bats are scenery: drawn behind the pumpkins and never hit by a click, so
// they cannot hide a number or catch a tap.
function makeBat(width, height, offscreen) {
  const dir = Math.random() < 0.5 ? 1 : -1;
  const speed = BAT_SPEED[0] + Math.random() * (BAT_SPEED[1] - BAT_SPEED[0]);
  return {
    x: offscreen ? (dir > 0 ? -40 : width + 40) : Math.random() * width,
    y: height * (0.15 + Math.random() * 0.6),
    dir,
    speed,
    size: 0.7 + Math.random() * 0.6,
    phase: Math.random() * Math.PI * 2,
  };
}

function makeBats(width, height) {
  bats = Array.from({ length: BAT_COUNT }, () => makeBat(width, height, false));
}

function updateBats(dt) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  bats = bats.map((bat) => {
    bat.x += bat.dir * bat.speed * dt;
    bat.y += Math.sin(bat.phase * 0.3) * 12 * dt;
    bat.phase += BAT_FLAP * dt;
    const gone = bat.dir > 0 ? bat.x > w + 40 : bat.x < -40;
    return gone ? makeBat(w, h, true) : bat;
  });
}

function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  makeStars(window.innerWidth, window.innerHeight);
  makeBats(window.innerWidth, window.innerHeight);
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
      const ghost = halloween && !lastWasGhost && Math.random() < GHOST_CHANCE;
      lastWasGhost = ghost;
      lanterns.push({
        id: nextId++,
        x,
        y,
        value: 1 + Math.floor(Math.random() * 9),
        ghost,
        selected: false,
        floating: false,
        floatT: 0,
        shakeT: 0,
        flashT: 0,
      });
      return;
    }
  }
  // No free spot this time: skip this spawn.
}

function loseLives(count) {
  if (!running || count === 0) return;
  lives = Math.max(0, lives - count);
  renderLives();
  if (lives === 0) gameOver();
}

function resolveSelection() {
  const selected = selectedLanterns();
  const { result, points, livesLost } = selectionOutcome(selected, settings.target);
  if (livesLost > 0) {
    // A ghost sprang the trap: it flashes and the selection clears.
    for (const l of selected) {
      l.selected = false;
      if (l.ghost) l.flashT = GHOST_FLASH_TIME;
    }
    loseLives(livesLost);
  } else if (result === 'match') {
    if (running) {
      score += points;
      renderScore();
    }
    for (const l of selected) {
      l.selected = false;
      l.floating = true;
    }
    if (running) {
      unlock(unlockedAfter(level, score, unlocked));
      if (score >= ADVANCE_POINTS) advanceLevel();
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
  if (!running || paused) return;
  const rect = canvas.getBoundingClientRect();
  const lantern = lanternAt(event.clientX - rect.left, event.clientY - rect.top);
  if (!lantern) return;
  lantern.selected = !lantern.selected;
  if (lantern.selected) resolveSelection();
}

// Groups of 2 to DEMO_MAX_GROUP lanterns that add up to the target, among
// the highest fully visible ones. The group whose top lantern is highest
// wins, so the demo saves the lanterns closest to escaping.
function findDemoGroup() {
  // Picks stay below the top bar and fully on screen.
  const top = hudEl.getBoundingClientRect().bottom + LANTERN_RADIUS;
  const bottom = window.innerHeight - LANTERN_RADIUS;
  const candidates = activeLanterns()
    .filter((l) => !l.ghost && l.y >= top && l.y <= bottom)
    .sort((a, b) => a.y - b.y)
    .slice(0, DEMO_CANDIDATES);

  let best = null;
  const group = [];
  function search(start, total) {
    if (total === settings.target && group.length >= 2) {
      if (!best || group[0].y < best[0].y) best = [...group];
      return;
    }
    if (total >= settings.target || group.length === DEMO_MAX_GROUP) return;
    for (let i = start; i < candidates.length; i++) {
      group.push(candidates[i]);
      search(i + 1, total + candidates[i].value);
      group.pop();
    }
  }
  search(0, 0);
  return best ? best.map((l) => l.id) : [];
}

function runDemo(dt) {
  demoTimer -= dt;
  if (demoTimer > 0) return;

  if (demoPlan.length === 0) {
    demoPlan = findDemoGroup();
    demoTimer = demoPlan.length ? DEMO_PICK_DELAY : DEMO_RETRY;
    return;
  }

  const lantern = activeLanterns().find((l) => l.id === demoPlan[0]);
  if (!lantern) {
    // A planned lantern escaped: drop the half-made selection and replan.
    for (const l of selectedLanterns()) l.selected = false;
    demoPlan = [];
    demoTimer = DEMO_RETRY;
    return;
  }
  demoPlan.shift();
  lantern.selected = true;
  resolveSelection();
  demoTimer = demoPlan.length ? DEMO_PICK_DELAY : DEMO_REST;
}

function update(dt) {
  spawnTimer += dt;
  while (spawnTimer >= settings.interval) {
    spawnTimer -= settings.interval;
    spawnLantern();
  }

  for (const l of lanterns) {
    l.y -= settings.speed * dt;
    if (l.floating) l.floatT += dt;
    if (l.shakeT > 0) l.shakeT = Math.max(0, l.shakeT - dt);
    if (l.flashT > 0) l.flashT = Math.max(0, l.flashT - dt);
  }

  if (halloween) updateBats(dt);
  if (demo) runDemo(dt);

  // A lantern whose top edge reaches the top of the sky costs a life and is
  // dropped (from the selection too). A ghost there fades out for free, like
  // matched lanterns floating away; both are dropped once faded. In attract
  // mode no life is lost.
  let escaped = 0;
  lanterns = lanterns.filter((l) => {
    if (l.floating) return l.floatT < FLOAT_TIME;
    if (l.y - LANTERN_RADIUS <= 0) {
      escaped += escapeCost(l);
      if (l.ghost) {
        l.selected = false;
        l.floating = true;
        return true;
      }
      return false;
    }
    return true;
  });

  loseLives(escaped);
}

function drawSky() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  if (halloween) {
    gradient.addColorStop(0, '#1a0b2e');
    gradient.addColorStop(0.45, '#4a1b5e');
    gradient.addColorStop(0.8, '#a83f4a');
    gradient.addColorStop(1, '#f07b2a');
  } else {
    gradient.addColorStop(0, '#050d24');
    gradient.addColorStop(0.6, '#0b1a3a');
    gradient.addColorStop(1, '#16295a');
  }
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

  if (halloween) {
    drawMoon(w, h);
    for (const bat of bats) drawBat(bat);
  }
}

function drawMoon(w, h) {
  const r = Math.min(w, h) * 0.11;
  const x = w * 0.8;
  const y = Math.max(h * 0.25, hudEl.getBoundingClientRect().bottom + r);
  ctx.save();
  ctx.shadowColor = 'rgba(255, 236, 190, 0.6)';
  ctx.shadowBlur = r * 0.8;
  ctx.fillStyle = '#fff1cf';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(210, 180, 140, 0.35)';
  for (const [dx, dy, cr] of [[-0.3, -0.2, 0.18], [0.25, 0.1, 0.13], [-0.05, 0.4, 0.1]]) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, cr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBat(bat) {
  const flap = Math.sin(bat.phase); // -1 wings down, 1 wings up
  ctx.save();
  ctx.translate(bat.x, bat.y);
  ctx.scale(bat.size * bat.dir, bat.size);
  ctx.fillStyle = '#1a0f1f';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(side * 10, -12 * flap - 4, side * 22, -10 * flap);
    ctx.quadraticCurveTo(side * 16, -4 * flap + 2, side * 14, 2);
    ctx.quadraticCurveTo(side * 9, -2 * flap + 1, side * 6, 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.ellipse(0, 1, 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-3, -3);
  ctx.lineTo(-2, -7);
  ctx.lineTo(0, -4);
  ctx.lineTo(2, -7);
  ctx.lineTo(3, -3);
  ctx.fill();
  ctx.restore();
}

// Paper lantern, drawn around (0, 0) in units where it fits a circle of 30;
// drawLantern scales it by LANTERN_SIZE to LANTERN_RADIUS, the circle used
// for spacing and clicks.
const BODY_RADIUS = 21;
const CAP_HALF_WIDTH = 9;
const RIBS = [-0.66, -0.33, 0.33, 0.66];

function lanternPath(rx, ry) {
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
}

function drawPaperLantern(value, selected) {
  // Hook and top cap
  ctx.strokeStyle = '#3a1a0a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.lineTo(0, -26);
  ctx.stroke();
  ctx.fillStyle = '#5a2a12';
  ctx.beginPath();
  ctx.roundRect(-CAP_HALF_WIDTH, -26, 2 * CAP_HALF_WIDTH, 6, 2);
  ctx.fill();

  // Tassel
  ctx.strokeStyle = '#c23a22';
  ctx.lineWidth = 1.5;
  for (const dx of [-2.5, 0, 2.5]) {
    ctx.beginPath();
    ctx.moveTo(dx * 0.4, 25);
    ctx.lineTo(dx, 29);
    ctx.stroke();
  }

  // Paper body, lit from inside
  if (selected) {
    ctx.shadowColor = 'rgba(255, 225, 130, 0.95)';
    ctx.shadowBlur = 22;
  }
  const paper = ctx.createRadialGradient(0, -2, 3, 0, 0, BODY_RADIUS + 1);
  paper.addColorStop(0, '#fff1b8');
  paper.addColorStop(0.45, '#ffb347');
  paper.addColorStop(1, '#d9481c');
  ctx.fillStyle = paper;
  lanternPath(BODY_RADIUS, BODY_RADIUS);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Ribs of the paper
  ctx.save();
  lanternPath(BODY_RADIUS, BODY_RADIUS);
  ctx.clip();
  ctx.strokeStyle = 'rgba(120, 30, 10, 0.35)';
  ctx.lineWidth = 1.2;
  for (const f of RIBS) {
    lanternPath(BODY_RADIUS * Math.abs(f), BODY_RADIUS);
    ctx.stroke();
  }
  for (const y of [-14, 14]) {
    ctx.beginPath();
    ctx.moveTo(-BODY_RADIUS, y);
    ctx.lineTo(BODY_RADIUS, y);
    ctx.stroke();
  }
  ctx.restore();

  // Bottom cap
  ctx.fillStyle = '#5a2a12';
  ctx.beginPath();
  ctx.roundRect(-CAP_HALF_WIDTH * 0.8, 20, 1.6 * CAP_HALF_WIDTH, 5, 2);
  ctx.fill();

  if (selected) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    lanternPath(BODY_RADIUS + 2, BODY_RADIUS + 2);
    ctx.stroke();
  }

  drawNumber(value);
}

// Jack-o'-lantern in the same units as the paper lantern, so it is the same
// size on screen and uses the same circle for spacing and clicks.
const PUMPKIN_RX = 27;
const PUMPKIN_RY = 22;
const PUMPKIN_LOBES = [
  { x: -15, rx: 13, shade: '#c9520e' },
  { x: 15, rx: 13, shade: '#c9520e' },
  { x: -7, rx: 14, shade: '#e8650f' },
  { x: 7, rx: 14, shade: '#e8650f' },
  { x: 0, rx: 13, shade: '#f57a14' },
];

function pumpkinBodyPath() {
  ctx.beginPath();
  ctx.ellipse(0, 3, PUMPKIN_RX, PUMPKIN_RY, 0, 0, Math.PI * 2);
}

function drawPumpkin(value, selected) {
  // Stem and leaf
  ctx.fillStyle = '#4f6b22';
  ctx.beginPath();
  ctx.roundRect(-3, -27, 6, 10, 2);
  ctx.fill();
  ctx.strokeStyle = '#6d8f2c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(2, -22);
  ctx.quadraticCurveTo(10, -28, 14, -21);
  ctx.stroke();

  // Lobes, lit from inside
  if (selected) {
    ctx.shadowColor = 'rgba(255, 225, 130, 0.95)';
    ctx.shadowBlur = 22;
  }
  for (const lobe of PUMPKIN_LOBES) {
    const g = ctx.createRadialGradient(lobe.x * 0.4, 3, 2, lobe.x, 3, PUMPKIN_RY);
    g.addColorStop(0, '#ffcf6a');
    g.addColorStop(0.5, lobe.shade);
    g.addColorStop(1, '#8f3307');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(lobe.x, 3, lobe.rx, PUMPKIN_RY, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.shadowBlur = 0;

  // Candle glow through the shell
  ctx.save();
  pumpkinBodyPath();
  ctx.clip();
  const glow = ctx.createRadialGradient(0, 2, 2, 0, 2, 20);
  glow.addColorStop(0, 'rgba(255, 236, 150, 0.85)');
  glow.addColorStop(1, 'rgba(255, 180, 60, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-PUMPKIN_RX, -PUMPKIN_RY, 2 * PUMPKIN_RX, 2 * PUMPKIN_RY + 6);
  ctx.restore();

  // Carved eyes and grin, clear of the number
  ctx.fillStyle = '#ffe48a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 11, -10);
    ctx.lineTo(side * 20, -12);
    ctx.lineTo(side * 17, -4);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-15, 15);
  ctx.quadraticCurveTo(0, 25, 15, 15);
  ctx.quadraticCurveTo(0, 20, -15, 15);
  ctx.fill();

  if (selected) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(0, 3, PUMPKIN_RX + 2, PUMPKIN_RY + 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawNumber(value);
}

// Ghost: a pale sheet with a wavy hem, in the same units as the lantern.
function ghostPath() {
  ctx.beginPath();
  ctx.moveTo(-20, 22);
  ctx.lineTo(-20, -6);
  ctx.arc(0, -6, 20, Math.PI, 0);
  ctx.lineTo(20, 22);
  for (let i = 0; i < 4; i++) {
    const x = 20 - i * 10;
    ctx.quadraticCurveTo(x - 2.5, 28, x - 5, 22);
    ctx.quadraticCurveTo(x - 7.5, 16, x - 10, 22);
  }
  ctx.closePath();
}

function drawGhost(value, selected, flashT) {
  const flash = flashT > 0 ? Math.abs(Math.sin((flashT / GHOST_FLASH_TIME) * Math.PI * 3)) : 0;
  ctx.save();
  ctx.globalAlpha *= 0.6 + 0.4 * flash;
  if (selected || flash > 0) {
    ctx.shadowColor = flash > 0 ? 'rgba(190, 255, 220, 1)' : 'rgba(255, 225, 130, 0.95)';
    ctx.shadowBlur = 22 + 20 * flash;
  }
  const sheet = ctx.createLinearGradient(0, -26, 0, 26);
  sheet.addColorStop(0, '#f4f7ff');
  sheet.addColorStop(1, flash > 0 ? '#d9fff0' : '#b9c3e6');
  ctx.fillStyle = sheet;
  ghostPath();
  ctx.fill();
  ctx.shadowBlur = 0;

  // Hollow eyes, above the number
  ctx.fillStyle = '#2a2f4a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * 9, -14, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  if (selected) {
    ctx.strokeStyle = '#ffe9a8';
    ctx.lineWidth = 3;
    ghostPath();
    ctx.stroke();
  }
  ctx.restore();

  drawNumber(value);
}

// A light halo keeps the number readable over the drawing.
function drawNumber(value) {
  ctx.font = '800 27px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(255, 241, 184, 0.9)';
  ctx.lineWidth = 5;
  ctx.strokeText(String(value), 0, 1);
  ctx.fillStyle = '#4a1a00';
  ctx.fillText(String(value), 0, 1);
}

function drawLantern(l) {
  let scale = 1;
  let y = l.y;
  let x = l.x;
  let alpha = 1;

  if (l.floating) {
    // Shrink and rise by the amount it shrinks: the top edge stays on its
    // usual track, so a floating lantern cannot run into the one above.
    const t = Math.min(1, l.floatT / FLOAT_TIME);
    scale = 1 - 0.7 * t;
    y -= LANTERN_RADIUS * (1 - scale);
    alpha = 1 - t;
  }
  if (l.shakeT > 0) {
    x += Math.sin(l.shakeT * 60) * SHAKE_AMPLITUDE * (l.shakeT / SHAKE_TIME);
  }

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale * LANTERN_SIZE, scale * LANTERN_SIZE);
  if (l.ghost) drawGhost(l.value, l.selected, l.flashT);
  else if (halloween) drawPumpkin(l.value, l.selected);
  else drawPaperLantern(l.value, l.selected);
  ctx.restore();
}

function draw() {
  drawSky();
  for (const l of lanterns) drawLantern(l);
}

function frame(time) {
  if ((!running && !demo) || paused) return;
  const dt = Math.min(MAX_STEP, (time - lastTime) / 1000);
  lastTime = time;
  update(dt);
  draw();
  if ((running || demo) && !paused) frameId = requestAnimationFrame(frame);
}

// Cancelling first keeps one loop even if pause is toggled twice in a frame.
function startLoop() {
  cancelAnimationFrame(frameId);
  lastTime = performance.now();
  frameId = requestAnimationFrame(frame);
}

function startDemo() {
  demo = true;
  demoPlan = [];
  demoTimer = DEMO_REST;
  settings = levelSettings(1);
  lanterns = [];
  spawnTimer = settings.interval;
  for (let t = 0; t < DEMO_WARMUP; t += MAX_STEP) update(MAX_STEP);
  startLoop();
}

function showBanner() {
  clearTimeout(bannerTimer);
  bannerEl.textContent = `Level ${level}`;
  bannerEl.hidden = false;
  // Restart the animation when the banner shows twice in a row.
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
  bannerTimer = setTimeout(() => {
    bannerEl.hidden = true;
  }, BANNER_TIME);
}

function hideBanner() {
  clearTimeout(bannerTimer);
  bannerEl.hidden = true;
}

// Each level starts with an empty sky, 0 points and full lives.
function enterLevel(n) {
  level = n;
  settings = levelSettings(level);
  lanterns = [];
  lastWasGhost = false;
  score = 0;
  lives = LIVES;
  spawnTimer = settings.interval; // first lantern right away
  renderLevel();
  renderScore();
  renderLives();
}

function advanceLevel() {
  enterLevel(level + 1);
  unlock(level);
  showBanner();
}

function startGame(startLevel) {
  demo = false;
  demoPlan = [];
  overlay.hidden = true;
  gameOverOverlay.hidden = true;
  pauseOverlay.hidden = true;
  // Space must not press a focused button while the game runs.
  document.activeElement?.blur();
  enterLevel(startLevel);
  hideBanner();
  running = true;
  paused = false;
  startLoop();
}

function gameOver() {
  running = false;
  const best = Math.max(score, readBest());
  writeBest(best);
  unlock(unlockedAfter(level, score, unlocked));
  finalLevelEl.textContent = level;
  finalScoreEl.textContent = score;
  bestScoreEl.textContent = best;
  nextButton.hidden = level + 1 > unlocked;
  hideBanner();
  gameOverOverlay.hidden = false;
  againButton.focus();
}

function togglePause() {
  paused = !paused;
  pauseOverlay.hidden = !paused;
  if (!paused) startLoop();
}

function onKeyDown(event) {
  if (event.code !== 'Space' || !running) return;
  event.preventDefault();
  if (!event.repeat) togglePause();
}

startButton.addEventListener('click', () => startGame(unlocked));
againButton.addEventListener('click', () => startGame(level));
nextButton.addEventListener('click', () => startGame(level + 1));
halloweenToggle.addEventListener('click', onHalloweenToggle);
canvas.addEventListener('pointerdown', onPointerDown);
window.addEventListener('keydown', onKeyDown);
window.addEventListener('resize', resize);

unlocked = readUnlocked();
renderStartLevel();
renderLevel();
setHalloween(
  halloweenOn({
    date: new Date(),
    search: location.search,
    remembered: readHalloweenChoice(),
  }),
);
renderScore();
resize();
startDemo();

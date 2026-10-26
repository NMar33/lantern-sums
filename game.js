const LIVES = 3;
const STAR_COUNT = 160;

const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('start-overlay');
const startButton = document.getElementById('start-button');

let stars = [];

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
  drawSky();
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

startButton.addEventListener('click', () => {
  overlay.hidden = true;
});

window.addEventListener('resize', resize);

renderLives(LIVES);
resize();

'use strict';

// ─── Canvas setup ────────────────────────────────────────────────────────────

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800;
canvas.height = 600;

// ─── Constants ───────────────────────────────────────────────────────────────

const W = canvas.width;
const H = canvas.height;

const BRICK_COLS    = 10;
const BRICK_ROWS    = 7;
const BRICK_W       = 66;
const BRICK_H       = 22;
const BRICK_GAP     = 8;
const BRICK_OFF_X   = (W - (BRICK_COLS * (BRICK_W + BRICK_GAP) - BRICK_GAP)) / 2;
const BRICK_OFF_Y   = 58;

// Row themes: top gradient color, bottom gradient color, shadow glow, points
const ROW_THEMES = [
  { c1: '#ff00ff', c2: '#aa0088', glow: '#ff00ff', pts: 70 },
  { c1: '#ff2255', c2: '#cc0033', glow: '#ff2255', pts: 60 },
  { c1: '#ff8800', c2: '#cc4400', glow: '#ff8800', pts: 50 },
  { c1: '#ffee00', c2: '#ccaa00', glow: '#ffee00', pts: 40 },
  { c1: '#44ff66', c2: '#008833', glow: '#44ff66', pts: 30 },
  { c1: '#00ffff', c2: '#006699', glow: '#00ffff', pts: 20 },
  { c1: '#9900ff', c2: '#5500bb', glow: '#9900ff', pts: 10 },
];

const BALL_RADIUS   = 8;
const PADDLE_W      = 120;
const PADDLE_H      = 14;
const PADDLE_Y      = H - 32;
const PADDLE_SPEED  = 9;
const TRAIL_LENGTH  = 10;

// Precomputed static star field
const STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: 0.3 + Math.random() * 1.2,
  a: 0.2 + Math.random() * 0.6,
}));

// ─── Game state ──────────────────────────────────────────────────────────────

let state            = 'waiting'; // waiting | playing | dead | gameover | win
let score            = 0;
let lives            = 3;
let bgImage          = null;
let showingNameInput = false;
let hiScore          = 0;

const paddle = { x: (W - PADDLE_W) / 2, dx: 0 };

const ball = {
  x: W / 2, y: PADDLE_Y - BALL_RADIUS - 2,
  dx: 0, dy: 0,
  trail: [],
};

let bricks    = [];
let particles = [];

// ─── Brick initialisation ────────────────────────────────────────────────────

function buildBricks() {
  bricks = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      bricks.push({
        x: BRICK_OFF_X + c * (BRICK_W + BRICK_GAP),
        y: BRICK_OFF_Y + r * (BRICK_H + BRICK_GAP),
        row: r,
        alive: true,
      });
    }
  }
}

// ─── Particles ───────────────────────────────────────────────────────────────

function spawnParticles(brick) {
  const theme = ROW_THEMES[brick.row];
  const cx = brick.x + BRICK_W / 2;
  const cy = brick.y + BRICK_H / 2;
  const count = 8 + Math.floor(Math.random() * 5); // 8–12

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
    const spd   = 1.5 + Math.random() * 4;
    particles.push({
      x:     cx,
      y:     cy,
      dx:    Math.cos(angle) * spd,
      dy:    Math.sin(angle) * spd - 1,
      size:  2 + Math.random() * 3,
      alpha: 1,
      decay: 0.038 + Math.random() * 0.025,
      color: Math.random() > 0.5 ? theme.c1 : theme.c2,
      glow:  theme.glow,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x    += p.dx;
    p.y    += p.dy;
    p.dy   += 0.12;
    p.alpha -= p.decay;
    p.size *= 0.97;
    if (p.alpha <= 0) particles.splice(i, 1);
  }
}

// ─── Physics ─────────────────────────────────────────────────────────────────

function launchBall() {
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * (Math.PI / 4);
  const spd   = 5;
  ball.dx = Math.cos(angle) * spd;
  ball.dy = Math.sin(angle) * spd;
}

function resetBallToPaddle() {
  ball.x  = paddle.x + PADDLE_W / 2;
  ball.y  = PADDLE_Y - BALL_RADIUS - 2;
  ball.dx = 0;
  ball.dy = 0;
  ball.trail = [];
  state = 'waiting';
}

function update() {
  if (state === 'waiting') {
    ball.x = paddle.x + PADDLE_W / 2;
    movePaddle();
    return;
  }
  if (state !== 'playing') return;

  movePaddle();

  // Trail
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > TRAIL_LENGTH) ball.trail.shift();

  ball.x += ball.dx;
  ball.y += ball.dy;

  // Wall collisions
  if (ball.x - BALL_RADIUS <= 0) {
    ball.x  = BALL_RADIUS;
    ball.dx = Math.abs(ball.dx);
  }
  if (ball.x + BALL_RADIUS >= W) {
    ball.x  = W - BALL_RADIUS;
    ball.dx = -Math.abs(ball.dx);
  }
  if (ball.y - BALL_RADIUS <= 0) {
    ball.y  = BALL_RADIUS;
    ball.dy = Math.abs(ball.dy);
  }

  // Lost
  if (ball.y > H + 30) {
    lives -= 1;
    if (lives <= 0) {
      state = 'gameover';
      showNameInput('GAME OVER');
    } else {
      state = 'dead';
      setTimeout(() => { resetBallToPaddle(); }, 800);
    }
    return;
  }

  // Paddle collision
  if (
    ball.dy > 0 &&
    ball.y + BALL_RADIUS >= PADDLE_Y &&
    ball.y - BALL_RADIUS <= PADDLE_Y + PADDLE_H &&
    ball.x >= paddle.x - 4 &&
    ball.x <= paddle.x + PADDLE_W + 4
  ) {
    const hit = (ball.x - paddle.x) / PADDLE_W; // 0–1
    const maxAngle = Math.PI * 0.62;             // ~112° spread
    const angle    = (hit - 0.5) * maxAngle - Math.PI / 2;
    const spd      = Math.hypot(ball.dx, ball.dy);
    ball.dx = Math.cos(angle) * spd;
    ball.dy = Math.sin(angle) * spd;
    ball.y  = PADDLE_Y - BALL_RADIUS;
  }

  // Brick collisions
  for (const b of bricks) {
    if (!b.alive) continue;
    if (!aabbOverlap(b)) continue;

    b.alive = false;
    score  += ROW_THEMES[b.row].pts;
    spawnParticles(b);
    resolveAABB(b);
    break; // one brick per frame prevents tunnelling artifacts
  }

  // Win check
  if (bricks.every(b => !b.alive)) {
    state = 'win';
    showNameInput('YOU WIN!');
  }

  updateParticles();
}

function movePaddle() {
  paddle.x += paddle.dx;
  if (paddle.x < 0) paddle.x = 0;
  if (paddle.x + PADDLE_W > W) paddle.x = W - PADDLE_W;
}

function aabbOverlap(b) {
  return (
    ball.x + BALL_RADIUS > b.x &&
    ball.x - BALL_RADIUS < b.x + BRICK_W &&
    ball.y + BALL_RADIUS > b.y &&
    ball.y - BALL_RADIUS < b.y + BRICK_H
  );
}

function resolveAABB(b) {
  const bcx = b.x + BRICK_W / 2;
  const bcy = b.y + BRICK_H / 2;
  const dx  = ball.x - bcx;
  const dy  = ball.y - bcy;
  const ox  = (BRICK_W / 2 + BALL_RADIUS) - Math.abs(dx);
  const oy  = (BRICK_H / 2 + BALL_RADIUS) - Math.abs(dy);

  if (ox < oy) {
    ball.dx = dx < 0 ? -Math.abs(ball.dx) : Math.abs(ball.dx);
  } else {
    ball.dy = dy < 0 ? -Math.abs(ball.dy) : Math.abs(ball.dy);
  }
}

// ─── Rendering ───────────────────────────────────────────────────────────────

function drawBackground() {
  if (bgImage) {
    ctx.globalAlpha = 0.35;
    ctx.drawImage(bgImage, 0, 0, W, H);
    ctx.globalAlpha = 1;
    // Dark vignette over image
    const vig = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.8);
    vig.addColorStop(0, 'rgba(0,0,12,0.45)');
    vig.addColorStop(1, 'rgba(0,0,5,0.88)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
  } else {
    // Deep space radial gradient
    const bg = ctx.createRadialGradient(W / 2, H * 0.35, 0, W / 2, H * 0.35, H * 1.1);
    bg.addColorStop(0,   '#0d0030');
    bg.addColorStop(0.5, '#05001a');
    bg.addColorStop(1,   '#000008');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
  }

  // Stars
  for (const s of STARS) {
    ctx.globalAlpha = s.a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Neon grid — vertical lines
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 40) {
    const alpha = 0.035 + (x / W) * 0.01;
    ctx.strokeStyle = `rgba(0,60,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  // Horizontal lines — brighter toward bottom (floor feel)
  for (let y = 0; y <= H; y += 40) {
    const alpha = 0.02 + (y / H) * 0.07;
    ctx.strokeStyle = `rgba(0,180,255,${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Subtle perspective rays from horizon
  ctx.strokeStyle = 'rgba(0,80,200,0.018)';
  for (let i = 0; i <= 20; i++) {
    const tx = (W / 20) * i;
    ctx.beginPath();
    ctx.moveTo(W / 2, H * 0.6);
    ctx.lineTo(tx, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(W / 2, H * 0.6);
    ctx.lineTo(tx, H);
    ctx.stroke();
  }
}

function drawPaddle() {
  ctx.save();

  // Outer glow
  ctx.shadowBlur  = 22;
  ctx.shadowColor = '#00ffff';

  // Body gradient (top: bright cyan → bottom: deep blue)
  const grad = ctx.createLinearGradient(paddle.x, PADDLE_Y, paddle.x, PADDLE_Y + PADDLE_H);
  grad.addColorStop(0,    '#00ffff');
  grad.addColorStop(0.45, '#0099ff');
  grad.addColorStop(1,    '#003388');
  ctx.fillStyle = grad;
  roundRect(paddle.x, PADDLE_Y, PADDLE_W, PADDLE_H, 7);
  ctx.fill();

  // Top shine
  ctx.shadowBlur = 0;
  const shine = ctx.createLinearGradient(paddle.x, PADDLE_Y, paddle.x, PADDLE_Y + PADDLE_H * 0.5);
  shine.addColorStop(0, 'rgba(255,255,255,0.45)');
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  roundRect(paddle.x + 3, PADDLE_Y + 2, PADDLE_W - 6, PADDLE_H * 0.45, 4);
  ctx.fill();

  ctx.restore();
}

function drawBall() {
  ctx.save();

  // Motion trail
  for (let i = 0; i < ball.trail.length; i++) {
    const t    = ball.trail[i];
    const frac = (i + 1) / ball.trail.length;
    ctx.globalAlpha  = frac * 0.35;
    ctx.shadowBlur   = 6;
    ctx.shadowColor  = '#00ffff';
    ctx.fillStyle    = '#00ccff';
    ctx.beginPath();
    ctx.arc(t.x, t.y, BALL_RADIUS * frac * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Main ball — outer glow
  ctx.shadowBlur  = 28;
  ctx.shadowColor = '#ffffff';

  // Radial gradient: bright white core → cyan edge
  const bgrad = ctx.createRadialGradient(
    ball.x - BALL_RADIUS * 0.3,
    ball.y - BALL_RADIUS * 0.35,
    1,
    ball.x, ball.y, BALL_RADIUS
  );
  bgrad.addColorStop(0,   '#ffffff');
  bgrad.addColorStop(0.45, '#bbffff');
  bgrad.addColorStop(1,    '#0099dd');
  ctx.fillStyle = bgrad;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, BALL_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawBricks() {
  for (const b of bricks) {
    if (!b.alive) continue;
    const t = ROW_THEMES[b.row];

    ctx.save();
    ctx.shadowBlur  = 14;
    ctx.shadowColor = t.glow;

    // Body
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H);
    grad.addColorStop(0,   t.c1);
    grad.addColorStop(0.6, t.c2);
    grad.addColorStop(1,   shadeHex(t.c2, -30));
    ctx.fillStyle = grad;
    roundRect(b.x, b.y, BRICK_W, BRICK_H, 5);
    ctx.fill();

    // Highlight strip
    ctx.shadowBlur = 0;
    const hi = ctx.createLinearGradient(b.x, b.y, b.x, b.y + BRICK_H * 0.55);
    hi.addColorStop(0, 'rgba(255,255,255,0.28)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    roundRect(b.x + 3, b.y + 2, BRICK_W - 6, BRICK_H * 0.48, 3);
    ctx.fill();

    // Edge outline
    ctx.strokeStyle = `rgba(255,255,255,0.12)`;
    ctx.lineWidth   = 1;
    roundRect(b.x, b.y, BRICK_W, BRICK_H, 5);
    ctx.stroke();

    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha  = p.alpha;
    ctx.shadowBlur   = 10;
    ctx.shadowColor  = p.glow;
    ctx.fillStyle    = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawHUD() {
  ctx.save();
  ctx.font      = 'bold 15px "Courier New", monospace';
  ctx.fillStyle = '#00ffff';
  ctx.shadowBlur  = 10;
  ctx.shadowColor = '#00ffff';

  ctx.textAlign = 'left';
  ctx.fillText(`SCORE  ${String(score).padStart(6, '0')}`, 16, 28);

  // Lives as circles
  ctx.fillText('LIVES', 16, 50);
  for (let i = 0; i < 3; i++) {
    const alive = i < lives;
    ctx.globalAlpha  = alive ? 1 : 0.2;
    ctx.shadowBlur   = alive ? 12 : 0;
    ctx.shadowColor  = '#00ffff';
    ctx.fillStyle    = '#00ffff';
    ctx.beginPath();
    ctx.arc(82 + i * 20, 45, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign   = 'right';
  ctx.fillStyle   = '#ff00ff';
  ctx.shadowColor = '#ff00ff';
  ctx.fillText(`HI  ${String(Math.max(hiScore, score)).padStart(6, '0')}`, W - 16, 28);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawOverlay(line1, line2, line3 = '') {
  // Dim overlay
  ctx.fillStyle = 'rgba(0,0,15,0.6)';
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.textAlign = 'center';

  // Title
  ctx.font      = 'bold 52px "Courier New", monospace';
  ctx.shadowBlur  = 30;
  ctx.shadowColor = '#ff00ff';
  ctx.fillStyle   = '#ff00ff';
  ctx.fillText(line1, W / 2, H / 2 - 28);

  // Subtitle
  ctx.font      = '16px "Courier New", monospace';
  ctx.shadowBlur  = 12;
  ctx.shadowColor = '#00ffff';
  ctx.fillStyle   = '#00ffff';
  ctx.fillText(line2, W / 2, H / 2 + 16);

  if (line3) {
    ctx.font      = '13px "Courier New", monospace';
    ctx.fillStyle = 'rgba(0,255,255,0.55)';
    ctx.shadowBlur = 0;
    ctx.fillText(line3, W / 2, H / 2 + 42);
  }

  ctx.restore();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x,     y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}

function shadeHex(hex, amount) {
  const n = Number.parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount));
  return `rgb(${r},${g},${b})`;
}

// ─── Game loop ───────────────────────────────────────────────────────────────

function gameLoop() {
  update();

  drawBackground();
  drawBricks();
  drawPaddle();
  drawBall();
  drawParticles();
  drawHUD();

  if (state === 'waiting') {
    drawOverlay('BREAKOUT', 'CLICK OR PRESS SPACE TO LAUNCH', 'Mouse or ← → to move');
  } else if (state === 'dead') {
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 28px "Courier New", monospace';
    ctx.fillStyle   = 'rgba(255,80,80,0.85)';
    ctx.shadowBlur  = 16;
    ctx.shadowColor = '#ff3333';
    ctx.fillText('BALL LOST', W / 2, H / 2);
    ctx.restore();
  } else if (state === 'gameover') {
    drawOverlay('GAME OVER', `FINAL SCORE  ${String(score).padStart(6, '0')}`, 'CLICK OR SPACE TO RETRY');
  } else if (state === 'win') {
    drawOverlay('YOU WIN!', `SCORE  ${String(score).padStart(6, '0')}`, 'CLICK OR SPACE TO PLAY AGAIN');
  }

  requestAnimationFrame(gameLoop);
}

// ─── Input ───────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  { paddle.dx = -PADDLE_SPEED; e.preventDefault(); }
  if (e.key === 'ArrowRight') { paddle.dx =  PADDLE_SPEED; e.preventDefault(); }
  if (e.key === ' ') {
    e.preventDefault();
    handleAction();
  }
});

document.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft'  && paddle.dx < 0) paddle.dx = 0;
  if (e.key === 'ArrowRight' && paddle.dx > 0) paddle.dx = 0;
});

canvas.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  const mx   = (e.clientX - rect.left) * (W / rect.width);
  paddle.x   = mx - PADDLE_W / 2;
});

canvas.addEventListener('click', () => { handleAction(); });

function handleAction() {
  if (showingNameInput) return;
  if (state === 'waiting') {
    launchBall();
    state = 'playing';
  } else if (state === 'gameover' || state === 'win') {
    score  = 0;
    lives  = 3;
    paddle.x = (W - PADDLE_W) / 2;
    paddle.dx = 0;
    particles = [];
    buildBricks();
    resetBallToPaddle();
  }
}

// ─── Highscore ───────────────────────────────────────────────────────────────

function renderLeaderboard(scores) {
  if (scores.length > 0) hiScore = Math.max(hiScore, scores[0].score);
  const list = document.getElementById('scoreList');
  if (!scores.length) {
    list.innerHTML = '<div class="lb-empty">NO SCORES YET<br>BE THE FIRST!</div>';
    return;
  }
  list.innerHTML = scores.map((s, i) => `
    <li class="score-entry ${i === 0 ? 'rank-1' : ''}">
      <span class="entry-rank">${String(i + 1).padStart(2, '0')}</span>
      <span class="entry-name">${s.name.slice(0, 8)}</span>
      <span class="entry-pts">${String(s.score).padStart(6, '0')}</span>
    </li>
  `).join('');
}

async function loadScores() {
  try {
    const res    = await fetch('/scores');
    const scores = await res.json();
    renderLeaderboard(scores);
  } catch {}
}

async function saveScore(name, sc) {
  try {
    const res    = await fetch('/scores', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name, score: sc }),
    });
    const scores = await res.json();
    renderLeaderboard(scores);
  } catch {}
}

function showNameInput(resultText) {
  showingNameInput = true;
  document.getElementById('nameResult').textContent      = resultText;
  document.getElementById('nameScoreDisplay').textContent = String(score).padStart(6, '0');
  document.getElementById('nameOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('nameInput').focus(), 60);
}

function hideNameInput() {
  document.getElementById('nameOverlay').classList.add('hidden');
  document.getElementById('nameInput').value = '';
  showingNameInput = false;
}

document.getElementById('nameSubmit').addEventListener('click', async () => {
  const raw  = document.getElementById('nameInput').value.trim().toUpperCase();
  const name = raw || 'PLAYER';
  document.getElementById('nameSubmit').textContent = 'SAVING…';
  await saveScore(name, score);
  document.getElementById('nameSubmit').textContent = 'SAVE SCORE';
  hideNameInput();
});

document.getElementById('nameSkip').addEventListener('click', () => {
  hideNameInput();
});

document.getElementById('nameInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('nameSubmit').click();
  e.stopPropagation(); // prevent game keys firing while typing
});

// ─── Background image upload ─────────────────────────────────────────────────

document.getElementById('bgUpload').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;

  const label = document.getElementById('uploadLabel');
  label.querySelector('span').textContent = 'Uploading…';

  try {
    const fd = new FormData();
    fd.append('background', file);
    const res  = await fetch('/upload-bg', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.error) throw new Error(data.error);

    const img     = new Image();
    img.onload    = () => {
      bgImage = img;
      label.querySelector('span').textContent = 'BG Active ✓';
      label.classList.add('loaded');
    };
    img.onerror   = () => { label.querySelector('span').textContent = 'Load failed'; };
    img.src       = data.path;
  } catch (err) {
    label.querySelector('span').textContent = 'Upload failed';
    console.error(err);
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

buildBricks();
resetBallToPaddle();
loadScores();
gameLoop();

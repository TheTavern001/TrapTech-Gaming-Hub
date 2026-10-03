import { ls } from './store.js';
import { Telemetry, loadAtlas, loadLayers, spr, sprC, coinFrame, drawFlame, reducedMotion } from './games/engine.js';
// Jetpack Dash - original HTML5 canvas side-scroller for The Gaming Hub.
// Code: original. Sounds: Kenney (CC0). v6 art: original Blender-rendered astronaut (run/fly/hit/idle frames), saw blades, zapper
// emitters, rocket, shield orb and 3D gold coins; 4-layer seamless parallax night city (original procedural). See /CREDITS.md.
const H = 540;              // logical world height
const FLOOR = 70;           // floor thickness
const CEIL = 34;            // ceiling thickness
const PX_PER_M = 30;
const GRAVITY = 2300, THRUST = 3900, MAX_UP = -620, MAX_DOWN = 900;
const START_MPS = 11, MAX_MPS = 24, ACCEL_MPS = 0.12;

const IMG = {};
const IMG_LIST = []; // v6: the Kenney sprites were replaced by the v6 atlases below
// v5 realistic art: night-city panorama cut from a Poly Haven CC0 HDRI (Shanghai Bund), photo gold coin (Wikimedia, public domain),
// brushed-metal floor (Poly Haven CC0 metal_plate). Hero/saws/flames stay Kenney CC0. See /CREDITS.md
const V5_IMG = { metal: 'metal-plate.webp' };
const V6 = {};
let assetsPromise = null;
function loadAssets(base) {
  if (assetsPromise) return assetsPromise;
  assetsPromise = Promise.all(IMG_LIST.map(n => new Promise(res => {
    const im = new Image(); im.onload = () => { IMG[n] = im; res(); }; im.onerror = () => res(); im.src = `${base}/game/${n}.png`;
  })).concat(Object.entries(V5_IMG).map(([k, f]) => new Promise(res => { const im = new Image(); im.onload = () => { IMG[k] = im; res(); }; im.onerror = () => res(); im.src = `/assets/v5/${f}`; })))
    .concat([loadAtlas('astro').then(a => { V6.astro = a; }), loadAtlas('props').then(a => { V6.props = a; }),
      loadLayers({ sky: 'px-sky.webp', far: 'px-far.webp', mid: 'px-mid.webp', near: 'px-near-lab.webp' }).then(l => { V6.L = l; })]));
  return assetsPromise;
}

class Sfx {
  constructor(base) {
    this.base = base; this.muted = ls.getItem('jd_muted') === '1'; this.pool = {};
    for (const n of ['sfx_coin', 'sfx_hurt', 'sfx_shieldUp', 'sfx_zap', 'sfx_lose', 'sfx_gem']) {
      this.pool[n] = Array.from({ length: n === 'sfx_coin' ? 6 : 2 }, () => { const a = new Audio(`${base}/sfx/${n}.mp3`); a.preload = 'auto'; a.volume = n === 'sfx_coin' ? 0.35 : 0.6; return a; });
    }
    this.i = {};
  }
  play(n) {
    if (this.muted || !this.pool[n]) return;
    const arr = this.pool[n]; const k = (this.i[n] = ((this.i[n] || 0) + 1) % arr.length);
    try { arr[k].currentTime = 0; const p = arr[k].play(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }
  toggle() { this.muted = !this.muted; ls.setItem('jd_muted', this.muted ? '1' : '0'); return this.muted; }
}

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay; const l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  const cx = ax + t * dx, cy = ay + t * dy; return Math.hypot(px - cx, py - cy);
}

export class JetpackDash {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.base = opts.assetsBase || '/assets';
    this.onEnd = opts.onEnd || (() => {});
    this.onState = opts.onState || (() => {});
    this.best = opts.best || 0;
    this.sfx = new Sfx(this.base); this.tel = new Telemetry();
    this.input = false; this.running = false; this.paused = false; this.destroyed = false;
    this._bind();
    this.resize();
    this.reset();
    this.ready = loadAssets(this.base).then(() => { this._buildCity(); this.draw(); });
  }

  // ---------- setup ----------
  _bind() {
    const down = (e) => { if (e.target === this.c) e.preventDefault(); this.input = true; if (this.state === 'ready') this.begin(); else if (this.state === 'play') this.tel.hit(); };
    const up = () => { this.input = false; };
    this._h = {
      pd: (e) => down(e), pu: up,
      kd: (e) => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) { e.preventDefault(); if (!e.repeat) down(e); } if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause(); },
      ku: (e) => { if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) up(); },
      vis: () => { if (document.hidden && this.state === 'play') this.pause(true); },
      rs: () => this.resize(),
      blur: up,
    };
    this.c.addEventListener('pointerdown', this._h.pd);
    window.addEventListener('pointerup', this._h.pu); window.addEventListener('pointercancel', this._h.pu);
    window.addEventListener('keydown', this._h.kd); window.addEventListener('keyup', this._h.ku);
    document.addEventListener('visibilitychange', this._h.vis);
    window.addEventListener('resize', this._h.rs); window.addEventListener('blur', this._h.blur);
    this.c.style.touchAction = 'none';
  }
  destroy() {
    this.destroyed = true; this.running = false; cancelAnimationFrame(this.raf);
    this.c.removeEventListener('pointerdown', this._h.pd);
    window.removeEventListener('pointerup', this._h.pu); window.removeEventListener('pointercancel', this._h.pu);
    window.removeEventListener('keydown', this._h.kd); window.removeEventListener('keyup', this._h.ku);
    document.removeEventListener('visibilitychange', this._h.vis);
    window.removeEventListener('resize', this._h.rs); window.removeEventListener('blur', this._h.blur);
  }
  resize() {
    const r = this.c.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = Math.max(1, Math.round(r.width * dpr)); this.c.height = Math.max(1, Math.round(r.height * dpr));
    const cw = this.c.width, ch = this.c.height;
    this.W = Math.max(cw < ch ? 560 : 720, Math.min(1400, H * cw / ch));
    this.scale = Math.min(cw / this.W, ch / H);
    this.ox = (cw - this.W * this.scale) / 2; this.oy = (ch - H * this.scale) / 2;
    if (this.state && this.state !== 'play') this.draw();
  }
  _buildCity() {
    // procedural skyline layers (original art)
    const mk = (n, minH, maxH, wMin, wMax) => { const arr = []; let x = 0; while (x < 1600) { const w = rnd(wMin, wMax); arr.push({ x, w, h: rnd(minH, maxH), lit: Math.random() }); x += w + rnd(4, 18); } return arr; };
    this.cityFar = mk(0, 120, 260, 40, 90); this.cityNear = mk(0, 160, 330, 60, 120);
  }
  reset() {
    this.state = 'ready';
    this.t = 0; this.dist = 0; this.mps = START_MPS; this.coins = 0;
    this.p = { x: 170, y: H - FLOOR - 40, vy: 0, r: 22, onFloor: true, anim: 0, shield: false, inv: 0 };
    this.obs = []; this.coinsArr = []; this.parts = []; this.missiles = []; this.pickups = [];
    this.nextSpawnAt = 18; this.nextCoinAt = 8; this.nextShieldAt = 450;
    this.bgX = 0; this.deathT = 0; this.flash = 0; this.shake = 0;
    this.onState(this.state);
  }

  // ---------- control ----------
  start() { // show ready screen + loop
    if (this.running) return; this.running = true; this.last = performance.now(); this.acc = 0;
    const loop = (now) => { if (!this.running) return; this.raf = requestAnimationFrame(loop); this.frame(now); };
    this.raf = requestAnimationFrame(loop);
  }
  begin() { if (this.state !== 'ready') return; this.state = 'play'; this.startedAt = performance.now(); this.onState('play'); }
  pause(v = true) { if (this.state !== 'play' && this.state !== 'paused') return; this.state = v ? 'paused' : 'play'; this.input = false; this.last = performance.now(); this.onState(this.state); this.draw(); }
  togglePause() { if (this.state === 'play') this.pause(true); else if (this.state === 'paused') this.pause(false); }
  restart() { this.tel.reset(); this.reset(); this.draw(); }
  setSeed() {}
  get score() { return Math.floor(this.dist); }

  frame(now) {
    let dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (this.state === 'play' || this.state === 'dying') {
      this.acc += dt; const step = 1 / 120;
      while (this.acc >= step) { this.update(step); this.acc -= step; }
    } else if (this.state === 'ready') { this.t += dt; this.p.anim += dt; this.bgX += 40 * dt; }
    this.draw();
  }

  // ---------- simulation ----------
  update(dt) {
    const p = this.p;
    this.t += dt;
    if (this.state === 'play') this.mps = Math.min(MAX_MPS, START_MPS + this.t * ACCEL_MPS);
    else this.mps = Math.max(0, this.mps - 14 * dt); // dying: slide to a stop
    const vx = this.mps * PX_PER_M; const dx = vx * dt;
    this.dist += this.state === 'play' ? this.mps * dt : 0;
    this.bgX += dx;

    // player physics
    const floorY = H - FLOOR - p.r - 14, ceilY = CEIL + p.r + 6;
    if (this.state === 'play' && this.input) { p.vy -= THRUST * dt; this._jetParticles(); }
    p.vy += GRAVITY * dt; p.vy = clamp(p.vy, MAX_UP, MAX_DOWN);
    p.y += p.vy * dt;
    if (p.y > floorY) { p.y = floorY; p.vy = this.state === 'dying' && Math.abs(p.vy) > 200 ? -p.vy * 0.45 : 0; p.onFloor = true; } else p.onFloor = false;
    if (p.y < ceilY) { p.y = ceilY; p.vy = Math.max(0, p.vy); }
    p.anim += dt * (p.onFloor ? this.mps / 6 : 1);
    if (p.inv > 0) p.inv -= dt;

    // spawning (by distance)
    if (this.state === 'play') {
      if (this.dist >= this.nextSpawnAt) this._spawnObstacle();
      if (this.dist >= this.nextCoinAt) this._spawnCoins();
      if (this.dist >= this.nextShieldAt) { this.pickups.push({ x: this.W + 40, y: rnd(CEIL + 80, H - FLOOR - 80), t: 0 }); this.nextShieldAt += rnd(700, 1100); }
    }

    // obstacles
    for (const o of this.obs) {
      o.x -= dx; o.t += dt;
      if (o.type === 'zap' && o.spin) o.ang += o.spin * dt;
      if (o.type === 'saw') { o.rot += dt * 9; if (o.bob) o.y = o.y0 + Math.sin(o.t * o.bobSpeed) * o.bob; }
    }
    this.obs = this.obs.filter(o => o.x > -400);
    // missiles: warn -> lock -> fly
    for (const m of this.missiles) {
      m.t += dt;
      if (m.phase === 'warn') { if (m.t < m.warn - 0.45) m.y += (p.y - m.y) * Math.min(1, dt * 4); if (m.t >= m.warn) { m.phase = 'fly'; m.x = this.W + 60; this.sfx.play('sfx_zap'); } }
      else { m.x -= (vx + 620) * dt; if (Math.random() < 0.6) this.parts.push({ x: m.x + 34, y: m.y + rnd(-3, 3), vx: rnd(40, 120), vy: rnd(-30, 30), life: 0.35, max: 0.35, c: Math.random() < 0.5 ? '#ffb347' : '#ff5e3a', s: rnd(3, 6) }); }
    }
    this.missiles = this.missiles.filter(m => m.phase === 'warn' || m.x > -120);
    // coins
    for (const c of this.coinsArr) {
      c.x -= dx;
      if (this.state === 'play' && !c.got && Math.hypot(c.x - p.x, c.y - p.y) < p.r + 14) {
        c.got = true; this.coins++; this.sfx.play('sfx_coin');
        for (let i = 0; i < 6; i++) this.parts.push({ x: c.x, y: c.y, vx: rnd(-160, 160), vy: rnd(-160, 160), life: 0.4, max: 0.4, c: '#ffe066', s: rnd(2, 4) });
      }
    }
    this.coinsArr = this.coinsArr.filter(c => c.x > -30 && !c.got);
    for (const k of this.pickups) {
      k.x -= dx; k.t += dt;
      if (this.state === 'play' && !k.got && Math.hypot(k.x - p.x, k.y + Math.sin(k.t * 3) * 10 - p.y) < p.r + 20) { k.got = true; p.shield = true; this.sfx.play('sfx_shieldUp'); }
    }
    this.pickups = this.pickups.filter(k => k.x > -40 && !k.got);
    // particles
    for (const q of this.parts) { q.x += (q.vx - (q.world ? vx : 0)) * dt; q.y += q.vy * dt; q.life -= dt; }
    this.parts = this.parts.filter(q => q.life > 0);
    if (this.flash > 0) this.flash -= dt; if (this.shake > 0) this.shake -= dt;

    if (this.state === 'play') this._collide();
    if (this.state === 'dying') {
      this.deathT += dt;
      if (this.deathT > 1.4 && this.mps <= 0.5 && p.onFloor) this._finish();
      else if (this.deathT > 3) this._finish();
    }
  }
  _hit() {
    const p = this.p; if (p.inv > 0) return;
    if (p.shield) { p.shield = false; p.inv = 1.0; this.flash = 0.25; this.shake = 0.25; this.sfx.play('sfx_gem'); return; }
    this.state = 'dying'; this.deathT = 0; this.input = false; this.flash = 0.35; this.shake = 0.45;
    this.finalScore = this.score; this.finalMs = Math.round(performance.now() - this.startedAt);
    p.vy = -380; this.sfx.play('sfx_hurt');
    for (let i = 0; i < 28; i++) this.parts.push({ x: p.x, y: p.y, vx: rnd(-320, 320), vy: rnd(-320, 320), life: 0.7, max: 0.7, c: ['#b388ff', '#7c4dff', '#00e5ff', '#ffffff'][i % 4], s: rnd(2, 6) });
    this.onState('dying');
  }
  endNow() { // "End run & save score" from the pause menu
    if (this.state !== 'play' && this.state !== 'paused' && this.state !== 'dying') return;
    if (this.state !== 'dying') { this.finalScore = this.score; this.finalMs = Math.round(performance.now() - this.startedAt); }
    this._finish();
  }
  _finish() {
    if (this.state === 'over') return;
    this.state = 'over'; this.sfx.play('sfx_lose');
    if (this.finalScore > this.best) this.best = this.finalScore;
    this.onState('over');
    this.onEnd({ score: this.finalScore, coins: this.coins, duration_ms: this.finalMs, tel: this.tel.out() });
  }
  _collide() {
    const p = this.p; const r = p.r - 4;
    for (const o of this.obs) {
      if (o.type === 'zap') {
        const [a, b] = this._zapEnds(o);
        if (Math.abs(o.x - p.x) < o.len + 60 && distToSeg(p.x, p.y, a[0], a[1], b[0], b[1]) < r + 9) return this._hit();
      } else if (o.type === 'saw') {
        if (Math.hypot(o.x - p.x, o.y - p.y) < r + o.r * 0.82) return this._hit();
      }
    }
    for (const m of this.missiles) if (m.phase === 'fly' && Math.abs(m.x - p.x) < r + 26 && Math.abs(m.y - p.y) < r + 8) return this._hit();
  }
  _zapEnds(o) { const hx = Math.cos(o.ang) * o.len / 2, hy = Math.sin(o.ang) * o.len / 2; return [[o.x - hx, o.y - hy], [o.x + hx, o.y + hy]]; }
  _spawnObstacle() {
    const d = this.dist; const x = this.W + 120;
    const top = CEIL + 40, bot = H - FLOOR - 40;
    const roll = Math.random();
    const diff = Math.min(1, d / 2500);
    if (d > 180 && roll < 0.16 + diff * 0.1) {
      // missile (1 or 2)
      const n = d > 900 && Math.random() < 0.35 ? 2 : 1;
      for (let i = 0; i < n; i++) this.missiles.push({ phase: 'warn', t: -i * 0.5, warn: 1.25, x: this.W - 30, y: this.p.y + (i ? rnd(-120, 120) : 0) });
    } else if (roll < 0.45) {
      const n = d > 600 && Math.random() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const rr = rnd(30, 42); const y = rnd(top + rr, bot - rr);
        this.obs.push({ type: 'saw', x: x + i * 170, y, y0: y, r: rr, rot: 0, t: 0, bob: d > 400 && Math.random() < 0.5 ? rnd(40, 110) : 0, bobSpeed: rnd(1.5, 3) });
      }
    } else {
      const len = rnd(130, 120 + diff * 150);
      const kinds = ['v', 'h', 'd1', 'd2']; if (d > 350) kinds.push('spin');
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      const ang = { v: Math.PI / 2, h: 0, d1: Math.PI / 4, d2: -Math.PI / 4, spin: rnd(0, Math.PI) }[k];
      const ext = Math.abs(Math.sin(ang)) * len / 2 + 20;
      const y = k === 'spin' ? rnd(top + len / 2, bot - len / 2) : rnd(top + ext, bot - ext);
      this.obs.push({ type: 'zap', x, y: clamp(y, top + 20, bot - 20), len, ang, spin: k === 'spin' ? (Math.random() < 0.5 ? -1 : 1) * rnd(1.2, 2.2) : 0, t: 0 });
    }
    // distance until next obstacle shrinks with difficulty
    this.nextSpawnAt = d + rnd(17, 26) - diff * 6;
  }
  _spawnCoins() {
    const x0 = this.W + 60; const top = CEIL + 50, bot = H - FLOOR - 50;
    const shape = Math.floor(Math.random() * 3);
    const y0 = rnd(top + 40, bot - 40); const out = [];
    if (shape === 0) { for (let i = 0; i < 4; i++) for (let j = 0; j < 8; j++) out.push([x0 + j * 30, y0 - 45 + i * 30]); }
    else if (shape === 1) { for (let j = 0; j < 14; j++) out.push([x0 + j * 30, y0 + Math.sin(j / 2) * 60]); }
    else { for (let j = 0; j < 7; j++) { out.push([x0 + j * 30, y0 - j * 18]); out.push([x0 + j * 30, y0 + j * 18]); } }
    // keep coins out of obstacles
    for (const [x, y] of out) {
      const yy = clamp(y, top, bot);
      if (this.obs.some(o => o.type === 'saw' ? Math.hypot(o.x - x, o.y - yy) < o.r + 30 : (() => { const [a, b] = this._zapEnds(o); return distToSeg(x, yy, a[0], a[1], b[0], b[1]) < 34; })())) continue;
      this.coinsArr.push({ x, y: yy, ph: Math.random() * 6 });
    }
    this.nextCoinAt = this.dist + rnd(28, 55);
  }
  _jetParticles() {
    const p = this.p; if (Math.random() < 0.7)
      this.parts.push({ x: p.x - 22, y: p.y + 26, vx: rnd(-60, 0) - 160, vy: rnd(160, 320), life: 0.35, max: 0.35, c: Math.random() < 0.5 ? '#ffd166' : '#ff7a3d', s: rnd(3, 6) });
  }

  // ---------- rendering ----------
  draw() {
    const ctx = this.ctx; const s = this.scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05060f'; ctx.fillRect(0, 0, this.c.width, this.c.height);
    let sx = 0, sy = 0; if (this.shake > 0) { sx = rnd(-6, 6); sy = rnd(-6, 6); }
    ctx.setTransform(s, 0, 0, s, this.ox + sx * s, this.oy + sy * s);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.W, H); ctx.clip();
    this._drawBg(ctx);
    for (const c of this.coinsArr) this._drawCoin(ctx, c);
    for (const k of this.pickups) this._drawPickup(ctx, k);
    for (const o of this.obs) o.type === 'zap' ? this._drawZap(ctx, o) : this._drawSaw(ctx, o);
    this._drawPlayer(ctx);
    for (const m of this.missiles) this._drawMissile(ctx, m);
    for (const q of this.parts) { ctx.globalAlpha = Math.max(0, q.life / q.max); ctx.fillStyle = q.c; ctx.fillRect(q.x - q.s / 2, q.y - q.s / 2, q.s, q.s); }
    ctx.globalAlpha = 1;
    this._drawHud(ctx);
    if (this.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${this.flash})`; ctx.fillRect(0, 0, this.W, H); }
    if (this.state === 'ready') this._drawCenterText(ctx, 'HOLD TO FLY', 'Tap / click / hold Space to fire your jetpack');
    if (this.state === 'paused') this._drawCenterText(ctx, 'PAUSED', 'Tap Resume to keep flying');
    ctx.restore();
  }
  _drawBg(ctx) {
    const W = this.W; const L = V6.L || {}; const X = reducedMotion() ? 0 : this.bgX; const top = CEIL, bot = H - FLOOR, span = bot - top;
    // v6 seamless parallax: sky (0.02) -> far skyline (0.06) -> mid towers with neon signs (0.16) -> lab glass-wall columns (0.55) -> floor (1.0)
    if (L.sky) L.sky.draw(ctx, X * 0.02, 0, 0, W, H); else { ctx.fillStyle = '#0a0628'; ctx.fillRect(0, 0, W, H); }
    if (L.far) L.far.draw(ctx, X * 0.06, 0, bot - span * 0.72, W, span * 0.72);
    if (L.mid) L.mid.draw(ctx, X * 0.16, 0, bot - span * 0.9, W, span * 0.9);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(8,6,30,0.35)'); g.addColorStop(0.6, 'rgba(24,8,60,0.12)'); g.addColorStop(1, 'rgba(5,6,24,0.5)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (L.near) L.near.draw(ctx, X * 0.55, 0, 0, W, H);
    // ceiling
    ctx.fillStyle = '#0a0a22'; ctx.fillRect(0, 0, W, CEIL);
    ctx.fillStyle = '#3b2bd9'; ctx.fillRect(0, CEIL - 3, W, 3);
    const lo = -((this.bgX) % 120);
    for (let x = lo; x < W; x += 120) { ctx.fillStyle = '#00e5ff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 10; ctx.fillRect(x + 40, CEIL - 9, 40, 4); ctx.shadowBlur = 0; }
    // floor
    const fy = H - FLOOR;
    const fg = ctx.createLinearGradient(0, fy, 0, H); fg.addColorStop(0, '#1b1748'); fg.addColorStop(1, '#07061a');
    ctx.fillStyle = fg; ctx.fillRect(0, fy, W, FLOOR);
    if (IMG.metal) { ctx.save(); ctx.globalAlpha = 0.55; ctx.translate(-(this.bgX % 256), fy); ctx.fillStyle = ctx.createPattern(IMG.metal, 'repeat'); ctx.fillRect(0, 0, W + 256, FLOOR); ctx.restore(); ctx.fillStyle = 'rgba(7,6,26,0.45)'; ctx.fillRect(0, fy, W, FLOOR); }
    ctx.fillStyle = '#7c4dff'; ctx.shadowColor = '#9f6bff'; ctx.shadowBlur = 14; ctx.fillRect(0, fy, W, 3); ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(124,77,255,0.25)'; ctx.lineWidth = 2;
    const to = -((this.bgX) % 80);
    for (let x = to; x < W + 80; x += 80) { ctx.beginPath(); ctx.moveTo(x, fy + 4); ctx.lineTo(x - 30, H); ctx.stroke(); }
    // distance markers every 100m on the floor
    const mpx = 100 * PX_PER_M; const startM = Math.floor(this.dist / 100) * 100;
    for (let m = startM; m <= startM + 200; m += 100) {
      if (m <= 0) continue; const x = this.p.x + (m - this.dist) * PX_PER_M; if (x < -60 || x > W + 60) continue;
      ctx.fillStyle = 'rgba(0,229,255,0.7)'; ctx.font = '700 16px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`${m}m`, x, fy + 40);
    }
  }
  _drawPlayer(ctx) {
    const p = this.p; const dying = this.state === 'dying' || this.state === 'over'; const A = V6.astro;
    ctx.save(); ctx.translate(p.x, p.y);
    if (dying) ctx.rotate(Math.min(1.1, this.deathT * 2.2)); else ctx.rotate(clamp(p.vy / 2600, -0.18, 0.22));
    if (p.inv > 0 && Math.floor(p.inv * 20) % 2) ctx.globalAlpha = 0.4;
    const thrust = !dying && this.state === 'play' && this.input;
    if (thrust) { drawFlame(ctx, -22, 6, 54 + Math.random() * 10, 18, 0.12, this.t); drawFlame(ctx, -14, 6, 44 + Math.random() * 8, 14, 0.12, this.t + 1); }
    let fn;
    if (dying) fn = 'hit_' + Math.min(5, Math.floor(this.deathT * 9));
    else if (this.state === 'ready') fn = 'idle_' + Math.floor(this.t * 6) % 6;
    else if (p.onFloor) fn = 'run_' + Math.floor(p.anim * 2.6) % 8;
    else fn = 'fly_' + Math.floor(this.t * (thrust ? 14 : 7)) % 6;
    if (A) { const m = A.meta; const dw = m.cell[0] * 0.46, dh = m.cell[1] * 0.46; spr(ctx, A, fn, -m.anchor[0] * dw, -m.anchor[1] * dh, dw, dh); }
    else { ctx.fillStyle = '#b388ff'; ctx.beginPath(); ctx.arc(0, 0, p.r, 0, 7); ctx.fill(); }
    if (p.shield) {
      ctx.globalAlpha = 0.55 + Math.sin(this.t * 6) * 0.15; ctx.strokeStyle = '#4fc3ff'; ctx.lineWidth = 3; ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.globalAlpha = 0.12; ctx.fillStyle = '#4fc3ff'; ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  _drawZap(ctx, o) {
    const [a, b] = this._zapEnds(o);
    ctx.save();
    // beam
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,230,90,0.35)'; ctx.lineWidth = 20; ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 24;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#fff6c2'; ctx.lineWidth = 3; ctx.beginPath();
    const n = 10; ctx.moveTo(a[0], a[1]);
    for (let i = 1; i < n; i++) { const t = i / n; const nx = -(b[1] - a[1]), ny = b[0] - a[0]; const L = Math.hypot(nx, ny) || 1; const j = rnd(-7, 7); ctx.lineTo(a[0] + (b[0] - a[0]) * t + nx / L * j, a[1] + (b[1] - a[1]) * t + ny / L * j); }
    ctx.lineTo(b[0], b[1]); ctx.stroke();
    // nodes
    for (const e of [a, b]) {
      if (V6.props && sprC(ctx, V6.props, 'zapnode', e[0], e[1], 34, 34)) continue;
      ctx.fillStyle = '#2b2f4a'; ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(e[0], e[1], 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff9f1c'; ctx.beginPath(); ctx.arc(e[0], e[1], 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
  _drawSaw(ctx, o) {
    ctx.save(); ctx.translate(o.x, o.y); ctx.rotate(o.rot);
    ctx.shadowColor = 'rgba(255,61,113,0.75)'; ctx.shadowBlur = 16;
    if (V6.props && V6.props.f.saw) sprC(ctx, V6.props, 'saw', 0, 0, o.r * 2.05, o.r * 2.05); else { ctx.fillStyle = '#aaa'; ctx.beginPath(); ctx.arc(0, 0, o.r, 0, 7); ctx.fill(); }
    ctx.restore();
    if (o.bob) { ctx.strokeStyle = 'rgba(255,61,113,0.25)'; ctx.setLineDash([4, 6]); ctx.beginPath(); ctx.moveTo(o.x, o.y0 - o.bob); ctx.lineTo(o.x, o.y0 + o.bob); ctx.stroke(); ctx.setLineDash([]); }
  }
  _drawMissile(ctx, m) {
    if (m.phase === 'warn') {
      if (m.t < 0) return;
      const blink = Math.floor(m.t * (m.t > m.warn - 0.45 ? 14 : 6)) % 2;
      ctx.save(); ctx.translate(this.W - 34, m.y);
      ctx.fillStyle = blink ? '#ff3d3d' : '#ffb03d'; ctx.shadowColor = '#ff3d3d'; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(18, 14); ctx.lineTo(-18, 14); ctx.closePath(); ctx.fill();
      ctx.shadowBlur = 0; ctx.fillStyle = '#1a0a0a'; ctx.font = '900 18px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('!', 0, 11);
      ctx.restore(); return;
    }
    ctx.save(); ctx.translate(m.x, m.y);
    if (V6.props && V6.props.f.rocket) { drawFlame(ctx, 30, 0, 40 + Math.random() * 10, 14, -Math.PI / 2, this.t); sprC(ctx, V6.props, 'rocket', 0, 0, 84); ctx.restore(); return; }
    ctx.fillStyle = '#dfe6ff'; roundRect(ctx, -26, -8, 46, 16, 8); ctx.fill();
    ctx.fillStyle = '#ff3d71'; ctx.beginPath(); ctx.moveTo(-26, -8); ctx.lineTo(-38, 0); ctx.lineTo(-26, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7c4dff'; ctx.beginPath(); ctx.moveTo(14, -8); ctx.lineTo(26, -16); ctx.lineTo(22, -6); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(14, 8); ctx.lineTo(26, 16); ctx.lineTo(22, 6); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  _drawCoin(ctx, c) {
    if (V6.props && sprC(ctx, V6.props, coinFrame(this.t, c.ph), c.x, c.y, 30, 30)) return;
    const sx = Math.abs(Math.cos(this.t * 4 + c.ph)) * 0.8 + 0.2;
    ctx.save(); ctx.translate(c.x, c.y); ctx.scale(sx, 1);
    if (IMG.coin_v5) ctx.drawImage(IMG.coin_v5, -14, -14, 28, 28); else if (IMG.coin) ctx.drawImage(IMG.coin, -13, -14, 26, 28); else { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(0, 0, 12, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  _drawPickup(ctx, k) {
    const y = k.y + Math.sin(k.t * 3) * 10;
    ctx.save(); ctx.translate(k.x, y); ctx.shadowColor = '#4fc3ff'; ctx.shadowBlur = 20;
    ctx.strokeStyle = '#4fc3ff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.stroke();
    if (V6.props) sprC(ctx, V6.props, 'shield', 0, 0, 40, 40);
    ctx.restore();
  }
  _drawHud(ctx) {
    ctx.save();
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#7c4dff'; ctx.shadowBlur = 10;
    ctx.font = '900 34px Orbitron, sans-serif';
    const sc = this.state === 'dying' || this.state === 'over' ? this.finalScore : this.score;
    ctx.fillText(`${sc.toLocaleString('en-US')}m`, 18, CEIL + 42);
    ctx.shadowBlur = 0; ctx.font = '600 15px "Exo 2", sans-serif'; ctx.fillStyle = '#b9b3ff';
    ctx.fillText(`BEST ${Math.max(this.best, sc).toLocaleString('en-US')}m`, 20, CEIL + 64);
    if (V6.props && V6.props.f.coin_0) spr(ctx, V6.props, 'coin_0', 16, CEIL + 73, 22, 22); else if (IMG.coin) ctx.drawImage(IMG.coin, 18, CEIL + 74, 18, 20);
    ctx.fillStyle = '#ffe066'; ctx.font = '700 17px Orbitron, sans-serif'; ctx.fillText(String(this.coins), 42, CEIL + 91);
    if (this.p.shield) { ctx.fillStyle = '#4fc3ff'; ctx.font = '700 13px Orbitron, sans-serif'; ctx.fillText('SHIELD', 20, CEIL + 114); }
    ctx.restore();
  }
  _drawCenterText(ctx, title, sub) {
    ctx.save(); ctx.fillStyle = 'rgba(5,6,20,0.45)'; ctx.fillRect(0, 0, this.W, H);
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 18;
    ctx.font = '900 44px Orbitron, sans-serif'; ctx.fillText(title, this.W / 2, H / 2 - 8);
    ctx.shadowBlur = 0; ctx.fillStyle = '#c9c4ff'; ctx.font = '600 18px "Exo 2", sans-serif'; ctx.fillText(sub, this.W / 2, H / 2 + 26);
    ctx.restore();
  }
}
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

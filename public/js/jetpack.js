// Jetpack Dash v9 - 2D side-scrolling jetpack runner (original code, MIT). Reference gameplay: Jetpack Joyride.
// Hold anywhere to fire the jetpack and rise, let go to fall. Fly through a research lab: dodge zappers (some rotate), homing
// missiles (a red ! marks their height) and charging lasers; grab coin trails and shields. Classic flat side view with parallax
// layers. Turned sideways the corridor fills the screen; held upright it plays in a wide band (~12 m visible ahead).
// Art: the pilot is pre-rendered from the Quaternius Universal Base Character (CC0) into sprites (tools/jetpack-sprites/,
// public/assets/jetpack/pilot.webp); everything else is drawn in code.
// SCORING (points, v9): every 25 m pays 625 x multiplier ('m'), coin trails pay 25 per coin x multiplier ('c'), a zapper close
// call pays 250 x multiplier ('n'). The multiplier rises by 1 (to x10) after every 10 distance payouts (250 m) without a hit and
// drops by 3 when a shield breaks ('x' marks). src/ac-levels.js checks every event against these rules.
// Fairness: all gameplay randomness comes from the run seed (this.r) in distance order; visuals use their own RNG.
import { Game8, PAL, TAU, clamp, lerp, fmt, roundRect } from './games/kit.js';

const CH = 9;                 // corridor height (m)
const HERO_H = 1.8;           // hero height (m)
const VMAX = 22;              // top speed (m/s); server bound is 25
const MSTEP = 25;             // metres per distance payout
const PAY_M = 625, PAY_C = 25, PAY_N = 250;
const ROOM = 30;              // background repeat (m)
function vrng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function leaf(x, cx, cy, r, col) { x.save(); x.translate(cx, cy); x.fillStyle = col; for (const [a, l] of [[0, 1], [-0.45, 0.85], [0.45, 0.85], [-0.9, 0.6], [0.9, 0.6], [-1.3, 0.36], [1.3, 0.36]]) { x.save(); x.rotate(a); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(r * 0.16 * l, -r * 0.55 * l, 0, -r * l); x.quadraticCurveTo(-r * 0.16 * l, -r * 0.55 * l, 0, 0); x.fill(); x.restore(); } x.restore(); }

export class JetpackDash extends Game8 {
  get title() { return 'JETPACK DASH'; }
  get hint() { return 'Hold anywhere to fire your jetpack and rise; let go to fall. Dodge zappers, missiles (watch the ! warning) and lasers. Fly 250 m without a hit to raise your multiplier (up to x10). Coins and close calls score big. A shield saves you once.'; }
  get accent() { return '#22d3ee'; }
  get musicOpts() { return { root: 50, bpm: 128, mode: 'minor', seed: 71, vol: 0.26 }; }
  get settingsSchema() { return [
    { key: 'detail', label: 'Graphics detail', def: 'high', options: [['high', 'High'], ['performance', 'Performance (battery saver)']] },
    { key: 'fx', label: 'Screen shake', def: 'on', options: [['on', 'On'], ['off', 'Off']] }]; }
  applySettings(x) { this.opt = { detail: 'high', fx: 'on', ...x }; }
  constructor(c, o) { super(c, o); const r = document.getElementById('rot'); if (r) r.style.display = 'none'; }
  async load() {
    const img = new Image(); img.src = '/assets/jetpack/pilot.webp';
    const [meta] = await Promise.all([fetch('/assets/jetpack/pilot.json').then(r => r.json()).catch(() => null), img.decode().catch(() => null)]);
    this.pilot = meta && img.naturalWidth ? { img, meta } : null; this.bake();
  }
  // ---- view: metres -> logical pixels. Landscape: corridor fills the height; portrait: a wide band with ~12 m visible. ----
  layout() {
    const W = this.W, H = this.H; this.ppm = Math.min(H / 10.4, W / 14.5); const bandH = (CH + 1.2) * this.ppm; // ~12 m visible ahead, like the reference
    this.bandY = this.portrait ? Math.max(150, Math.round((H - bandH) * 0.5)) : Math.round((H - bandH) / 2);
    this.floorY = this.bandY + (CH + 0.7) * this.ppm; this.ceilY = this.floorY - CH * this.ppm; this.heroX = W * (this.portrait ? 0.15 : 0.2);
    if (this._baked) this.bake();
  }
  sx(x) { return this.heroX + (x - this.dist) * this.ppm; } sy(y) { return this.floorY - y * this.ppm; }
  screen(x, y) { return [this.sx(x), this.sy(y)]; }
  // ---- pre-drawn background tiles (one 30 m room, three parallax layers), rebuilt when the view size changes ----
  bake() {
    if (!this.ppm) return; this._baked = true; const p = this.ppm, k = Math.min(2, this.scale || 1) * 1.0, vr = vrng(0x7e57);
    const RW = ROOM * p, H = (CH + 1.2) * p, top = 0.5 * p; // tile coordinates: ceiling at y=top, floor at y=top+CH*p
    // far layer: lab hall seen through the wall gaps (parallax 0.35)
    const far = canvas(RW * k, H * k), f = far.getContext('2d'); f.scale(k, k);
    let g = f.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1022'); g.addColorStop(1, '#151b33'); f.fillStyle = g; f.fillRect(0, 0, RW, H);
    // a continuous grow room: lamp bars with a magenta glow, benches with rows of plants
    g = f.createLinearGradient(0, top + 1.4 * p, 0, top + 6 * p); g.addColorStop(0, 'rgba(217,70,239,.5)'); g.addColorStop(0.55, 'rgba(126,34,206,.28)'); g.addColorStop(1, 'rgba(30,27,75,0)'); f.fillStyle = g; f.fillRect(0, top + 1.4 * p, RW, 4.6 * p);
    for (let x = 0; x < RW; x += 3.2 * p) { f.fillStyle = '#3b2a4f'; f.fillRect(x + 0.2 * p, top + 1.75 * p, 2.6 * p, 0.14 * p); f.fillStyle = '#f5d0fe'; f.fillRect(x + 0.3 * p, top + 1.89 * p, 2.4 * p, 0.06 * p); }
    for (const [row, by, sz, col, bench] of [[0, 4.6, 0.62, '#1f4d1a', '#3a2f2a'], [1, 5.6, 0.8, '#2f6b22', '#4a3a30']]) {
      for (let x = row * 0.5 * p; x < RW; x += 1.05 * p) { const s = sz * (0.85 + vr() * 0.3); leaf(f, x, top + by * p, s * p, col); f.fillStyle = '#5b4636'; f.fillRect(x - 0.16 * p, top + by * p, 0.32 * p, 0.22 * p); }
      f.fillStyle = bench; f.fillRect(0, top + (by + 0.2) * p, RW, 0.22 * p); }
    f.fillStyle = 'rgba(11,16,34,.25)'; f.fillRect(0, top + 1.4 * p, RW, 4.6 * p);
    // wall layer (parallax 1): panels, pillars, pipes, ceiling lights with light cones, grow-room window, floor
    const wall = canvas(RW * k, H * k), w = wall.getContext('2d'); w.scale(k, k);
    g = w.createLinearGradient(0, top, 0, top + CH * p); g.addColorStop(0, '#29324a'); g.addColorStop(1, '#202739'); w.fillStyle = g; w.fillRect(0, top, RW, CH * p);
    const pw = 2.5 * p; for (let x = 0; x < RW; x += pw) { w.fillStyle = 'rgba(255,255,255,.035)'; w.fillRect(x + 3, top + 0.4 * p, pw - 6, CH * p - 0.8 * p); w.strokeStyle = 'rgba(0,0,0,.35)'; w.lineWidth = 2; w.strokeRect(x + 3, top + 0.4 * p, pw - 6, CH * p - 0.8 * p); w.fillStyle = '#5b6584'; for (const [ox, oy] of [[8, 0.55], [pw - 8, 0.55], [8, CH - 0.55], [pw - 8, CH - 0.55]]) { w.beginPath(); w.arc(x + ox, top + oy * p, 2.2, 0, TAU); w.fill(); } }
    // grow-room window (cut through to the far layer later) + frame
    this.win = { x: 9 * p, y: top + 1.6 * p, w: 11 * p, h: 4.4 * p };
    w.clearRect(this.win.x, this.win.y, this.win.w, this.win.h); w.strokeStyle = '#7b86a3'; w.lineWidth = 0.22 * p; w.strokeRect(this.win.x, this.win.y, this.win.w, this.win.h);
    for (let i = 1; i < 3; i++) { w.fillStyle = '#7b86a3'; w.fillRect(this.win.x + i * this.win.w / 3 - 0.06 * p, this.win.y, 0.12 * p, this.win.h); }
    w.fillStyle = '#1b2232'; w.fillRect(this.win.x - 0.3 * p, this.win.y + this.win.h, this.win.w + 0.6 * p, 0.35 * p);
    // pillars
    for (const px of [0.4, 15.4]) { const x = px * p; g = w.createLinearGradient(x, 0, x + 0.9 * p, 0); g.addColorStop(0, '#3b4560'); g.addColorStop(0.5, '#56617f'); g.addColorStop(1, '#2b3347'); w.fillStyle = g; w.fillRect(x, top, 0.9 * p, CH * p); w.fillStyle = '#facc15'; for (let j = 0; j < 6; j++) w.fillRect(x, top + CH * p - 1.2 * p + j * 0.2 * p, 0.9 * p, 0.08 * p); }
    // pipes
    for (const [y, r, c1, c2] of [[0.55, 0.22, '#9aa3b5', '#4b5366'], [1.0, 0.13, '#d97706', '#78350f'], [CH - 0.45, 0.17, '#9aa3b5', '#4b5366']]) { const yy = top + y * p; g = w.createLinearGradient(0, yy - r * p, 0, yy + r * p); g.addColorStop(0, c2); g.addColorStop(0.45, c1); g.addColorStop(1, c2); w.fillStyle = g; w.fillRect(0, yy - r * p, RW, 2 * r * p); for (let x = 0; x < RW; x += 4 * p) { w.fillStyle = 'rgba(0,0,0,.35)'; w.fillRect(x, yy - r * p - 2, 0.25 * p, 2 * r * p + 4); } }
    // signs / screens
    w.fillStyle = '#0ea5e9'; w.fillRect(3.2 * p, top + 2.2 * p, 1.6 * p, 0.9 * p); w.fillStyle = '#e0f2fe'; w.font = `700 ${Math.round(0.28 * p)}px "Exo 2",sans-serif`; w.fillText('LAB 07', 3.35 * p, top + 2.75 * p);
    w.fillStyle = '#22c55e'; w.fillRect(24 * p, top + 3 * p, 1.1 * p, 0.6 * p); w.fillStyle = '#052e16'; w.font = `800 ${Math.round(0.24 * p)}px "Exo 2",sans-serif`; w.fillText('GROW', 24.1 * p, top + 3.42 * p);
    // ceiling (above the corridor) with light strips and soft light cones
    w.fillStyle = '#121725'; w.fillRect(0, 0, RW, top); for (let i = 0; i < 3; i++) { const x = (4 + i * 10) * p; w.fillStyle = '#e0f2fe'; w.fillRect(x, top - 0.12 * p, 3.6 * p, 0.12 * p); g = w.createLinearGradient(0, top, 0, top + 5 * p); g.addColorStop(0, 'rgba(191,232,255,.22)'); g.addColorStop(1, 'rgba(191,232,255,0)'); w.fillStyle = g; w.beginPath(); w.moveTo(x, top); w.lineTo(x + 3.6 * p, top); w.lineTo(x + 5 * p, top + 5 * p); w.lineTo(x - 1.4 * p, top + 5 * p); w.fill(); }
    // floor: tiles + hazard stripe + sheen
    const fy = top + CH * p; g = w.createLinearGradient(0, fy, 0, H); g.addColorStop(0, '#3a4255'); g.addColorStop(1, '#141924'); w.fillStyle = g; w.fillRect(0, fy, RW, H - fy);
    for (let x = 0; x < RW; x += 1.2 * p) { w.fillStyle = 'rgba(0,0,0,.25)'; w.fillRect(x, fy, 2, H - fy); }
    for (let x = -1; x < RW; x += 0.6 * p) { w.fillStyle = '#facc15'; w.beginPath(); w.moveTo(x, fy + 0.08 * p); w.lineTo(x + 0.3 * p, fy + 0.08 * p); w.lineTo(x + 0.15 * p, fy + 0.3 * p); w.lineTo(x - 0.15 * p, fy + 0.3 * p); w.fill(); }
    w.fillStyle = 'rgba(255,255,255,.12)'; w.fillRect(0, fy, RW, 0.05 * p);
    this.tiles = { far, wall, RW, H, top, k };
  }
  // ---------- game state ----------
  reset() {
    super.reset(); this.score = 0; this.coins = 0; this.dist = 0; this.v = 9; this.y = 0; this.vy = 0; this.hold = false; this.kh = 0; this.mult = 1; this.mSince = 0; this.paid = 0;
    this.shield = false; this.inv = 0; this.zaps = []; this.missiles = []; this.lasers = []; this.trails = []; this.pickups = []; this.nextHaz = 40; this.nextCoin = 22; this.nextMis = 160; this.nextLaser = 900; this.nextShield = 380; this.dead = 0; this.near = 0;
    this._died = false; this.dieT = 0;
  }
  onDown() { this.hold = true; } onUp() { this.hold = false; }
  onKey(c, d) { if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') this.kh = d ? 1 : 0; }
  diff() { return clamp(this.dist / 3000, 0, 1); }
  rr(a, b) { return a + this.r() * (b - a); }
  // ---- seeded world generation (in distance order) ----
  spawnHaz() {
    const d = this.nextHaz, df = this.diff();
    const n = df > 0.35 && this.r() < 0.35 + df * 0.25 ? 2 : 1;
    for (let i = 0; i < n; i++) { const L = this.rr(2.4, 3.2 + df * 2.4), kind = this.r(), ang = kind < 0.32 ? 0 : kind < 0.62 ? Math.PI / 2 : kind < 0.81 ? Math.PI / 4 : -Math.PI / 4;
      const rot = this.dist > 500 && this.r() < 0.18 + df * 0.25 ? (this.r() < 0.5 ? -1 : 1) * this.rr(0.8, 1.6) : 0; const half = Math.abs(Math.sin(ang)) * L / 2 + 0.3;
      const cy = rot ? this.rr(L / 2 + 0.4, CH - L / 2 - 0.4) : this.rr(half + 0.2, CH - half - 0.2); this.zaps.push({ x: d + i * this.rr(7, 11), cy, L, ang, rot, near: false, hit: false, o: null }); }
    this.nextHaz = d + Math.max(11, 24 - df * 11) + this.r() * 10;
  }
  spawnCoins() { const d = this.nextCoin, kind = Math.floor(this.r() * 4), cy = this.rr(1.2, CH - 2.2), n = 8 + Math.floor(this.r() * 8), pts = [];
    for (let i = 0; i < n; i++) { const x = d + i * 0.75; let y = cy; if (kind === 1) y = cy + Math.sin(i / (n - 1) * Math.PI) * 1.8; else if (kind === 2) y = cy + Math.sin(i * 0.7) * 1.1; else if (kind === 3) y = cy + (i % 2) * 0.7; pts.push({ x, y: clamp(y, 0.5, CH - 0.6), got: false }); }
    this.trails.push({ pts, end: pts[pts.length - 1].x, n: 0, paid: false }); this.nextCoin = d + n * 0.75 + this.rr(14, 34); }
  spawnMissile() { const n = this.dist > 900 && this.r() < 0.3 + this.diff() * 0.3 ? 2 : 1; for (let i = 0; i < n; i++) this.missiles.push({ ph: 'warn', t: 1.3 + i * 0.55, y: clamp(this.y + 0.9 + (i ? this.rr(-2, 2) : 0), 0.6, CH - 0.6), x: 0, o: null }); this.nextMis = this.nextMis + Math.max(70, 190 - this.diff() * 110) + this.r() * 90; }
  spawnLaser() { const rows = this.r() < 0.5 ? [this.rr(1, CH - 1)] : [this.rr(1, CH / 2 - 0.5), this.rr(CH / 2 + 0.5, CH - 1)]; for (const y of rows) this.lasers.push({ y, ph: 'warn', t: 1.5, o: null }); this.nextLaser += Math.max(220, 520 - this.diff() * 250) + this.r() * 200; }
  hit(why) {
    if (this.inv > 0 || this._died) return;
    if (this.shield) { this.shield = false; this.inv = 1.4; const m0 = this.mult; this.mult = Math.max(1, this.mult - 3); if (this.mult !== m0) this.mark('x', this.mult); this.mSince = 0; /* only log real changes: the server rejects repeated marks */ this.fx.shake(12); this.hitstop(0.06); this.sfx.noise(0.25, { vol: 0.4, freq: 600 }); const [sx, sy] = this.screen(this.dist, this.y + 1); this.pop(sx, sy - 70, 'SHIELD BROKEN', '#67e8f9', 22); return; }
    this._died = true; this.fx.shake(16); this.hitstop(0.08); this.sfx.noise(0.4, { vol: 0.5, freq: 400 }); const [sx, sy] = this.screen(this.dist, this.y + 1); this.fx.burst(sx, sy, ['#fff', '#fde047', '#fb923c'], 26, 420, 0.7, 12); this.pop(sx, sy - 80, why, '#f87171', 26);
    this.kill(1.4, '#fca5a5');
  }
  heroHits(px, py, r) { for (const k of [0.45, 0.95, 1.45]) if (Math.hypot(px - this.dist, py - (this.y + k)) < r + 0.36) return true; return false; }
  update(dt) {
    if (this._died) return;
    const T = this.playT, df = this.diff(), hold = this.hold || this.kh;
    this.v = Math.min(VMAX, 9 + T * 0.11); const dx = this.v * dt; this.dist += dx;
    this.vy += (hold ? 36 : 0) * dt - 27 * dt; this.vy = clamp(this.vy, -15, 11); this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; if (this.vy < 0) this.vy = 0; } if (this.y >= CH - HERO_H - 0.05) { this.y = CH - HERO_H - 0.05; if (this.vy > 0) this.vy = 0; }
    this.thrust = hold; if (this.inv > 0) this.inv -= dt;
    // distance payouts + multiplier
    while (this.dist >= (this.paid + 1) * MSTEP) { this.paid++; this.award(PAY_M * this.mult, 'm'); this.mSince++; if (this.mSince >= 10 && this.mult < 10) { this.mult++; this.mSince = 0; this.mark('x', this.mult); const [sx, sy] = this.screen(this.dist, this.y + 1.5); this.pop(sx, sy - 90, `MULTIPLIER x${this.mult}`, '#facc15', 24); this.sfx.chord([523, 659, 784, 1047], 0.14, { type: 'triangle', vol: 0.14 }); } }
    // world spawning
    const ahead = this.dist + 60; while (this.nextHaz < ahead) this.spawnHaz(); while (this.nextCoin < ahead) this.spawnCoins();
    while (this.nextMis < this.dist && this.dist > 150) this.spawnMissile(); while (this.nextLaser < this.dist) this.spawnLaser();
    while (this.nextShield < ahead) { this.pickups.push({ x: this.nextShield, y: this.rr(2, CH - 2.5), got: false, o: null }); this.nextShield += this.rr(600, 1100); }
    // zappers
    for (const z of this.zaps) { if (z.rot) z.ang += z.rot * dt; if (z.hit || z.x < this.dist - 12) continue; const hx = Math.cos(z.ang) * z.L / 2, hy = Math.sin(z.ang) * z.L / 2;
      const ax = z.x - hx, ay = z.cy - hy, bx = z.x + hx, by = z.cy + hy; let md = Infinity; for (const k of [0.45, 0.95, 1.45]) md = Math.min(md, segDist(this.dist, this.y + k, ax, ay, bx, by));
      if (md < 0.36 + 0.2) { z.hit = true; this.hit('ZAPPED'); }
      else if (!z.near && md < 1.15 && Math.abs(this.dist - z.x) < Math.abs(hx) + 0.6) z.close = true;
      if (!z.near && z.close && this.dist > Math.max(ax, bx) + 0.5 && this.inv <= 0) { z.near = true; this.award(PAY_N * this.mult, 'n'); const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 110, `CLOSE CALL +${fmt(PAY_N * this.mult)}`, '#a5f3fc', 18); this.sfx.tone(1250, 0.07, { type: 'square', vol: 0.07, slide: 1.4 }); } }
    this.zaps = this.zaps.filter(z => z.x > this.dist - 14);
    // coins (trail payout once the trail is passed)
    for (const t of this.trails) { if (t.paid) continue; for (const p of t.pts) if (!p.got && Math.abs(p.x - this.dist) < 0.7 && Math.abs(p.y - (this.y + 0.95)) < 1.05) { p.got = true; t.n++; this.coins++; this.sfx.tone(988 + t.n * 30, 0.05, { type: 'square', vol: 0.05 }); }
      if (this.dist > t.end + 0.8) { t.paid = true; if (t.n) { this.award(PAY_C * t.n * this.mult, 'c'); const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 60, `+${fmt(PAY_C * t.n * this.mult)}`, '#fde047', 17); } } }
    this.trails = this.trails.filter(t => !t.paid || t.end > this.dist - 10);
    // missiles: warn (tracks your height) then fly in from the right
    for (const m of this.missiles) { if (m.ph === 'warn') { m.t -= dt; if (m.t > 0.45) m.y = lerp(m.y, clamp(this.y + 0.95, 0.6, CH - 0.6), Math.min(1, dt * 4)); if (m.t <= 0) { m.ph = 'fly'; m.x = this.dist + 34; this.sfx.noise(0.3, { vol: 0.2, freq: 1800 }); } }
      else if (m.ph === 'fly') { m.x -= (18) * dt; if (this.heroHits(m.x, m.y, 0.4)) { m.ph = 'done'; this.hit('MISSILE'); } if (m.x < this.dist - 12) m.ph = 'done'; } }
    this.missiles = this.missiles.filter(m => m.ph !== 'done');
    // lasers: charge, fire, fade
    for (const l of this.lasers) { l.t -= dt; if (l.ph === 'warn' && l.t <= 0) { l.ph = 'fire'; l.t = 1.1; this.sfx.noise(0.5, { vol: 0.25, freq: 900 }); } else if (l.ph === 'fire') { if (Math.abs(this.y + 0.95 - l.y) < 1.0) this.hit('LASER'); if (l.t <= 0) l.ph = 'done'; } }
    this.lasers = this.lasers.filter(l => l.ph !== 'done');
    // shield pickups
    for (const p of this.pickups) if (!p.got && Math.abs(p.x - this.dist) < 0.9 && Math.abs(p.y - (this.y + 0.95)) < 1.2) { p.got = true; this.shield = true; const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 90, 'SHIELD', '#67e8f9', 22); this.sfx.chord([660, 990], 0.12, { type: 'square', vol: 0.1 }); }
    this.pickups = this.pickups.filter(p => p.x > this.dist - 10 && !p.got);
    this.setLevel(0.4 + Math.min(0.6, this.mult / 12));
  }
  dyingUpdate(dt) { this.vy -= 27 * dt; this.y = Math.max(0, this.y + this.vy * dt); this.dist += this.v * 0.3 * dt; }
  // ---------- drawing (plain 2D canvas, flat side view) ----------
  frame(dt) { this._dt = dt; super.frame(dt); }
  draw() {
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#05070f'; ctx.fillRect(0, 0, this.c.width, this.c.height);
    const sm = this.opt && this.opt.fx === 'off' ? 0 : this.fx.shakeM, sx = sm ? (Math.random() - 0.5) * sm * 0.5 : 0, sy = sm ? (Math.random() - 0.5) * sm * 0.5 : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    this.world(ctx); this.fx.draw(ctx);
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); const k = 1 + Math.max(0, p.life - 0.7) * 1.5; this.text(ctx, p.text, p.x, p.y, { size: p.size * k, color: p.color, align: 'center', glow: p.color }); }
    ctx.globalAlpha = 1; if (this.fx.flashA > 0.01) { ctx.globalAlpha = this.fx.flashA; ctx.fillStyle = this.fx.flashC; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
    this.render(ctx); ctx.restore();
    if (this.state === 'ready') this.center(ctx, this.title, this.hint, 'TAP TO START'); if (this.state === 'paused') this.center(ctx, 'PAUSED', 'Tap Resume to keep playing');
  }
  hi() { return !this.opt || this.opt.detail !== 'performance'; }
  // repeat a pre-drawn tile across the screen; par = parallax factor (1 = moves with the floor)
  tile(ctx, img, par, y) { const t = this.tiles, off = ((this.dist * this.ppm * par) % t.RW + t.RW) % t.RW; for (let x = this.heroX - off - t.RW; x < this.W; x += t.RW) ctx.drawImage(img, Math.floor(x), y, Math.ceil(t.RW) + 1, t.H); }
  world(ctx) {
    const W = this.W, H = this.H, p = this.ppm, t = this.tiles; if (!t) return;
    const tY = this.ceilY - t.top, bandTop = this.bandY, bandBot = tY + t.H;
    // above / below the corridor (portrait): dark service levels that scroll with the corridor
    if (bandTop > 0) this.service(ctx, 0, bandTop, true);
    if (bandBot < H) this.service(ctx, bandBot - 1, H, false);
    // corridor: far hall (seen through the windows) then the wall/floor tile
    this.tile(ctx, t.far, 0.35, tY); this.tile(ctx, t.wall, 1, tY);
    // distance markers painted on the wall every 100 m
    ctx.font = `900 ${Math.round(0.7 * p)}px Orbitron,"Exo 2",sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(250,204,21,.28)';
    for (let m = Math.ceil((this.dist - 6) / 100) * 100; m < this.dist + W / p; m += 100) if (m > 0) ctx.fillText(`${m} M`, this.sx(m), this.sy(1.4));
    ctx.textAlign = 'left';
    const hi = this.hi(), T = this.t;
    // shield pickups
    for (const k of this.pickups) { const [x, y] = this.screen(k.x, k.y), r = 0.45 * p * (1 + Math.sin(T * 5) * 0.06);
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); g.addColorStop(0, '#ecfeff'); g.addColorStop(0.5, '#22d3ee'); g.addColorStop(1, 'rgba(8,145,178,.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(207,250,254,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4 + Math.sin(T * 6) * 2, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#083344'; ctx.beginPath(); ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x + r * 0.42, y - r * 0.3); ctx.lineTo(x + r * 0.32, y + r * 0.2); ctx.lineTo(x, y + r * 0.5); ctx.lineTo(x - r * 0.32, y + r * 0.2); ctx.lineTo(x - r * 0.42, y - r * 0.3); ctx.closePath(); ctx.fill(); }
    // coins
    const cs = this.coinImg(), cr = 0.27 * p;
    for (const tr of this.trails) for (const c of tr.pts) { if (c.got) continue; const x = this.sx(c.x); if (x < -cr || x > W + cr) continue; const y = this.sy(c.y), w = Math.max(0.18, Math.abs(Math.cos(T * 4 + c.x * 0.6))) * cr; ctx.drawImage(cs, x - w, y - cr, w * 2, cr * 2); }
    // zappers: two emitter nodes with an electric arc between them
    for (const z of this.zaps) { const x = this.sx(z.x); if (x < -4 * p || x > W + 4 * p) continue; const hx = Math.cos(z.ang) * z.L / 2, hy = Math.sin(z.ang) * z.L / 2;
      const [ax, ay] = this.screen(z.x - hx, z.cy - hy), [bx, by] = this.screen(z.x + hx, z.cy + hy); this.bolt(ctx, ax, ay, bx, by, hi);
      for (const [nx, ny] of [[ax, ay], [bx, by]]) { const g = ctx.createRadialGradient(nx - 4, ny - 4, 2, nx, ny, 0.34 * p); g.addColorStop(0, '#e5e7eb'); g.addColorStop(0.6, '#6b7280'); g.addColorStop(1, '#1f2937'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, 0.34 * p, 0, TAU); ctx.fill(); ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 0.08 * p; ctx.beginPath(); ctx.arc(nx, ny, 0.24 * p, 0, TAU); ctx.stroke(); ctx.fillStyle = '#fef9c3'; ctx.beginPath(); ctx.arc(nx, ny, 0.09 * p, 0, TAU); ctx.fill(); } }
    // lasers: emitters slide in and charge (warning), then a full-width beam
    for (const l of this.lasers) { const y = this.sy(l.y), fire = l.ph === 'fire', ch = fire ? 1 : clamp(1 - l.t / 1.5, 0, 1);
      if (!fire) { ctx.strokeStyle = `rgba(248,113,113,${0.25 + 0.35 * (((T * 10) | 0) % 2)})`; ctx.lineWidth = 2; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.moveTo(0.9 * p, y); ctx.lineTo(W - 0.9 * p, y); ctx.stroke(); ctx.setLineDash([]); }
      else { const fade = Math.min(1, l.t / 0.25), hw = 0.32 * p * (0.85 + Math.random() * 0.3) * fade; ctx.save(); if (hi) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(239,68,68,.35)'; ctx.fillRect(0, y - hw * 2.2, W, hw * 4.4); ctx.fillStyle = 'rgba(248,113,113,.85)'; ctx.fillRect(0, y - hw, W, hw * 2); ctx.fillStyle = '#fff1f2'; ctx.fillRect(0, y - hw * 0.35, W, hw * 0.7); ctx.restore(); }
      for (const ex of [0, W]) { const dir = ex ? -1 : 1, x0 = ex + dir * (0.9 * p - (1 - Math.min(1, ch * 3)) * 0.9 * p); ctx.fillStyle = '#374151'; roundRect(ctx, Math.min(ex, x0), y - 0.38 * p, Math.abs(x0 - ex) + 2, 0.76 * p, 6); ctx.fill();
        ctx.fillStyle = `rgba(239,68,68,${0.4 + 0.6 * ch})`; ctx.beginPath(); ctx.arc(x0, y, 0.2 * p * (0.6 + 0.4 * ch), 0, TAU); ctx.fill(); } }
    // missiles in flight (the warning is drawn by the HUD)
    for (const m of this.missiles) if (m.ph === 'fly') { const [x, y] = this.screen(m.x, m.y); if (x > W + 2 * p) continue; this.missile(ctx, x, y, p); if (Math.random() < 0.7) this.fx.smoke(x + 0.9 * p, y, 'rgba(203,213,225,.55)', 1, 0.6, 0.35 * p); }
    this.hero(ctx);
  }
  // portrait only: the service levels above the ceiling and below the floor (ducts, struts, cable trays, status lights)
  service(ctx, y0, y1, up) {
    const W = this.W, p = this.ppm, h = y1 - y0; let g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, up ? '#03050b' : '#0c1120'); g.addColorStop(1, up ? '#0e1426' : '#03050b'); ctx.fillStyle = g; ctx.fillRect(0, y0, W, h + 1);
    const edge = up ? y1 : y0, dir = up ? -1 : 1, sc = this.dist * p, SP = 7 * p;
    for (const [d, r, c1, c2] of [[1.1, 0.42, '#3b4560', '#151b2b'], [2.4, 0.2, '#b45309', '#3f1d06'], [3.2, 0.3, '#334155', '#0f172a']]) { const yy = edge + dir * d * p; if (yy < y0 || yy > y1) continue; g = ctx.createLinearGradient(0, yy - r * p, 0, yy + r * p); g.addColorStop(0, c2); g.addColorStop(0.45, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, yy - r * p, W, 2 * r * p); }
    for (let x = -(sc % SP); x < W + SP; x += SP) { ctx.fillStyle = '#1a2236'; ctx.fillRect(x, y0, 0.45 * p, h); ctx.fillStyle = '#273049'; ctx.fillRect(x + 0.08 * p, y0, 0.08 * p, h);
      const k = Math.floor((x + sc) / SP); ctx.fillStyle = (k + Math.floor(this.t * 2)) % 3 ? 'rgba(34,197,94,.75)' : 'rgba(250,204,21,.85)'; ctx.fillRect(x + 0.7 * p, edge + dir * 0.55 * p - 0.08 * p, 0.16 * p, 0.16 * p);
      if (h > 4.5 * p) { ctx.fillStyle = '#121a2b'; roundRect(ctx, x + 2 * p, edge + dir * 4.6 * p - 0.7 * p, 2.6 * p, 1.4 * p, 6); ctx.fill(); ctx.fillStyle = 'rgba(34,211,238,.18)'; ctx.fillRect(x + 2.2 * p, edge + dir * 4.6 * p - 0.5 * p, 2.2 * p, 1.0 * p); } }
    ctx.fillStyle = '#1c2438'; ctx.fillRect(0, up ? y1 - 0.3 * p : y0, W, 0.3 * p);
    g = ctx.createLinearGradient(0, edge, 0, edge + dir * 2 * p); g.addColorStop(0, 'rgba(0,0,0,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, Math.min(edge, edge + dir * 2 * p), W, 2 * p);
  }
  bolt(ctx, ax, ay, bx, by, hi) {
    const n = 9, dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, pts = [];
    for (let i = 0; i <= n; i++) { const j = i === 0 || i === n ? 0 : (Math.random() - 0.5) * 0.36 * this.ppm; pts.push([ax + dx * i / n + nx * j, ay + dy * i / n + ny * j]); }
    ctx.save(); if (hi) ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, c] of [[0.5, 'rgba(250,204,21,.22)'], [0.22, 'rgba(253,224,71,.75)'], [0.07, '#fffbeb']]) { ctx.strokeStyle = c; ctx.lineWidth = w * this.ppm; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (const q of pts) ctx.lineTo(q[0], q[1]); ctx.stroke(); }
    ctx.restore();
  }
  missile(ctx, x, y, p) {
    ctx.save(); ctx.translate(x, y); const fl = 0.5 + Math.random() * 0.4; let g = ctx.createLinearGradient(0.7 * p, 0, (0.7 + fl) * p, 0); g.addColorStop(0, '#fde68a'); g.addColorStop(0.4, '#f97316'); g.addColorStop(1, 'rgba(239,68,68,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0.65 * p, -0.13 * p); ctx.lineTo((0.7 + fl) * p, 0); ctx.lineTo(0.65 * p, 0.13 * p); ctx.fill();
    g = ctx.createLinearGradient(0, -0.18 * p, 0, 0.18 * p); g.addColorStop(0, '#f1f5f9'); g.addColorStop(0.5, '#94a3b8'); g.addColorStop(1, '#475569'); ctx.fillStyle = g; roundRect(ctx, -0.45 * p, -0.17 * p, 1.1 * p, 0.34 * p, 0.17 * p); ctx.fill();
    ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.moveTo(-0.7 * p, 0); ctx.quadraticCurveTo(-0.55 * p, -0.17 * p, -0.35 * p, -0.17 * p); ctx.lineTo(-0.35 * p, 0.17 * p); ctx.quadraticCurveTo(-0.55 * p, 0.17 * p, -0.7 * p, 0); ctx.fill();
    ctx.fillStyle = '#b91c1c'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0.3 * p, s * 0.15 * p); ctx.lineTo(0.68 * p, s * 0.38 * p); ctx.lineTo(0.68 * p, s * 0.15 * p); ctx.fill(); }
    ctx.fillStyle = '#fbbf24'; ctx.fillRect(-0.12 * p, -0.17 * p, 0.08 * p, 0.34 * p); ctx.restore();
  }
  coinImg() {
    if (this._coin) return this._coin; const c = canvas(64, 64), x = c.getContext('2d'); let g = x.createRadialGradient(24, 22, 4, 32, 32, 31); g.addColorStop(0, '#fff7c2'); g.addColorStop(0.45, '#facc15'); g.addColorStop(1, '#a16207');
    x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, TAU); x.fill(); x.strokeStyle = '#854d0e'; x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 22, 0, TAU); x.stroke(); x.fillStyle = 'rgba(133,77,14,.85)'; leaf(x, 32, 44, 20, 'rgba(133,77,14,.85)');
    return (this._coin = c);
  }
  hero(ctx) {
    const p = this.ppm, hx = this.heroX, fy = this.sy(this.y), dt = this.state === 'paused' ? 0 : (this._dt || 0);
    const air = this.y > 0.02 || this.vy > 0, firing = this.thrust && !this._died && this.state === 'play';
    // jetpack exhaust (behind the pilot): flame cone + bullet-like sparks that bounce off the floor
    const nx = hx - 0.3 * p, ny = fy - 0.88 * p;
    if (firing) { const L = (1.15 + Math.random() * 0.5) * p; ctx.save(); if (this.hi()) ctx.globalCompositeOperation = 'lighter'; const g = ctx.createLinearGradient(0, ny, 0, ny + L); g.addColorStop(0, '#fff7ed'); g.addColorStop(0.25, '#fdba74'); g.addColorStop(0.7, 'rgba(249,115,22,.55)'); g.addColorStop(1, 'rgba(239,68,68,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(nx - 0.16 * p, ny); ctx.quadraticCurveTo(nx - 0.3 * p, ny + L * 0.45, nx, ny + L); ctx.quadraticCurveTo(nx + 0.3 * p, ny + L * 0.45, nx + 0.16 * p, ny); ctx.fill();
      const gl = ctx.createRadialGradient(nx, ny + 0.2 * p, 0, nx, ny + 0.2 * p, 0.7 * p); gl.addColorStop(0, 'rgba(253,186,116,.55)'); gl.addColorStop(1, 'rgba(249,115,22,0)'); ctx.fillStyle = gl; ctx.fillRect(nx - 0.7 * p, ny - 0.5 * p, 1.4 * p, 1.4 * p); ctx.restore();
      this._spk = (this._spk || 0) + dt * 30; while (this._spk > 1) { this._spk--; this.fx.sparks(nx, ny + 0.3 * p, ['#fde047', '#fb923c'], 1, 900, 0.22, 0.32 * p, Math.PI / 2, 0.35); }
      if (this.y < 3 && Math.random() < dt * 20) this.fx.sparks(nx - (this.y * 0.2) * p, this.floorY, ['#fde047', '#fff'], 3, 260, 0.25, 0.15 * p, -Math.PI / 2, 1.6); }
    else if (air && !this._died && Math.random() < dt * 12) this.fx.smoke(nx, ny + 0.1 * p, 'rgba(148,163,184,.35)', 1, 0.5, 0.25 * p);
    // ground shadow
    const sh = clamp(1 - this.y / 6, 0.15, 1); ctx.fillStyle = `rgba(0,0,0,${0.35 * sh})`; ctx.beginPath(); ctx.ellipse(hx, this.floorY + 0.06 * p, 0.55 * p * sh, 0.11 * p * sh, 0, 0, TAU); ctx.fill();
    // pilot sprite (or a simple silhouette until it loads)
    const blink = this.inv > 0 && !this._died && ((this.t * 14) | 0) % 2;
    if (blink) ctx.globalAlpha = 0.4;
    if (this.pilot) { const { img, meta } = this.pilot; let a, i;
      if (this._died) { a = meta.anims.die; i = Math.min(a.frames.length - 1, Math.floor((1.4 - Math.max(0, this.dead)) * 7)); if (this.dead < 0) i = a.frames.length - 1; }
      else if (air) { a = meta.anims.fly; i = Math.floor(this.t * 10) % a.frames.length; }
      else { a = meta.anims.run; i = Math.floor(this.dist * 1.25) % a.frames.length; }
      const [fx, fy0, fw, fh] = a.frames[i], s = p / meta.ppm; ctx.drawImage(img, fx, fy0, fw, fh, hx - a.ax * s, fy - a.ay * s, fw * s, fh * s); }
    else { ctx.fillStyle = '#e2e8f0'; roundRect(ctx, hx - 0.25 * p, fy - HERO_H * p, 0.5 * p, HERO_H * p, 0.2 * p); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (this.shield && !this._died) { const cy = fy - 0.95 * p, r = 1.15 * p; const g = ctx.createRadialGradient(hx, cy, r * 0.6, hx, cy, r); g.addColorStop(0, 'rgba(34,211,238,0)'); g.addColorStop(1, 'rgba(103,232,249,.35)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, cy, r, 0, TAU); ctx.fill(); ctx.strokeStyle = `rgba(165,243,252,${0.55 + Math.sin(this.t * 6) * 0.2})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(hx, cy, r, 0, TAU); ctx.stroke(); }
  }
  // ---------- HUD ----------
  panel(ctx, x, y, w, h, r = 14) { roundRect(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(6,9,22,.66)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1; ctx.stroke(); }
  render(ctx) {
    const W = this.W, H = this.H; if (this.state === 'ready') { if (this.portrait) this.text(ctx, 'Turn your phone sideways for full screen', W / 2, Math.min(H - 24, this.bandY + (CH + 1.2) * this.ppm + 34), { size: 13, color: '#94a3b8', align: 'center', font: 'Exo' }); return; }
    const X = this.portrait ? 12 : W - 344; // landscape: keep the score clear of the pilot's flight column
    this.panel(ctx, X, 12, 236, 64); this.text(ctx, 'SCORE', X + 14, 32, { size: 10, color: '#cbd5e1', font: 'Exo' }); this.text(ctx, fmt(this.dispScore), X + 14, 64, { size: 28, weight: 900, color: '#fff' });
    this.text(ctx, 'BEST ' + fmt(Math.max(this.best || 0, this.score || 0)), X + 222, 32, { size: 10, color: '#fcd34d', align: 'right', font: 'Exo' });
    // multiplier badge with progress ring to the next step
    const cx = W - 52, cy = 46; this.panel(ctx, W - 96, 12, 84, 70, 18); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(cx, cy, 25, 0, TAU); ctx.stroke();
    if (this.mult < 10) { ctx.strokeStyle = '#facc15'; ctx.beginPath(); ctx.arc(cx, cy, 25, -Math.PI / 2, -Math.PI / 2 + TAU * (this.mSince / 10)); ctx.stroke(); }
    this.text(ctx, 'x' + this.mult, cx, cy + 8, { size: 22, weight: 900, color: this.mult >= 10 ? '#facc15' : '#fff', align: 'center' });
    this.panel(ctx, X, 84, 236, 30, 12); this.text(ctx, `${fmt(Math.floor(this.dist))} m   ·   ${fmt(this.coins)} coins${this.shield ? '   ·   SHIELD' : ''}`, X + 14, 104, { size: 12, color: '#e2e8f0', font: 'Exo' });
    // missile warnings at the right edge of the corridor, at the missile's height
    const lo = this.ceilY + 22, hiY = this.floorY - 22;
    for (const m of this.missiles) if (m.ph === 'warn') { const y = clamp(this.sy(m.y), lo, hiY), blink = ((this.t * 8) | 0) % 2, r = m.t < 0.45 ? 21 : 17; ctx.fillStyle = blink ? '#ef4444' : '#fca5a5'; ctx.beginPath(); ctx.arc(W - 30, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); this.text(ctx, '!', W - 30, y + 8, { size: 22, weight: 900, color: '#fff', align: 'center' }); }
    if (this.state === 'play' && this.playT < 4) { const y = this.ceilY + CH * this.ppm * 0.42; ctx.globalAlpha = 0.6 * Math.min(1, 4 - this.playT); this.text(ctx, 'HOLD TO FLY', W / 2, y, { size: 24, color: '#fff', align: 'center', glow: '#22d3ee' }); this.text(ctx, 'let go to fall', W / 2, y + 30, { size: 14, color: '#cbd5e1', align: 'center', font: 'Exo' }); ctx.globalAlpha = 1; }
  }
}

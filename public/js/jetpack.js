// Bud Escape (game id jetpack-dash) - 2D side-scrolling escape runner (original code, MIT). Reference loop: Jetpack Joyride.
// Cash Green has stolen the government's best cannabis seeds and escapes a federal grow warehouse on a stolen hover-dolly.
// Hold anywhere to fire the thrusters and rise, let go to fall. Dodge grow-light zappers (some rotate), security drones (they
// lock on to your height, then fire), UV lasers and harvest arms. Rainbow strain crates give a vehicle that takes one hit.
// Warehouse staff walk the floor: fly low past them for a high five. Three daily missions are the same for every player.
// Art: Kenney (CC0) Toon Characters, Platformer Pack Industrial, Robot Pack, New Platformer Pack, Smoke Particles, Particle
// Pack, Space Shooter; Openclipart (public domain) cannabis plant, leaf and bong. Packed by tools/bud-escape-assets/.
// SCORING: score = meters travelled (10 per 10 m, 'm') + 200 per completed mission ('q', max 3). Nothing else scores, nothing
// carries over between runs, and every player gets the same dolly, spawn rules, vehicle pool and missions.
// Fairness: all gameplay randomness comes from the run seed (this.r) in distance order; visuals use Math.random / their own RNG.
import { Game8, TAU, clamp, lerp, fmt, roundRect } from './games/kit.js';

const CH = 9;                 // corridor height (m)
const HERO_H = 1.8;           // hitbox height (m)
const VMAX = 22;              // top speed (m/s); the server allows 25
const STEP = 10;              // meters per distance event
const MISSION_PTS = 200;
const VEH = ['blunt', 'walker', 'glider', 'sled', 'bong', 'cannon', 'board'];
const VEH_NAME = { blunt: 'ROLLING BLUNT', walker: 'HYDROPONIC WALKER', glider: 'TRICHOME GLIDER', sled: 'RESIN ROCKET SLED', bong: 'BONG HOVER', cannon: 'SEED POD CANNON CART', board: 'SMOKE CLOUD BOARD' };
const VEH_H = { blunt: 2.6, walker: HERO_H, glider: 3.2, sled: 3.1, bong: 3.3, cannon: 3.0, board: 2.0 }; // art height incl. Cash (ceiling limit)
const VEH_HINT = { blunt: 'Tap to jump, hold to float', walker: 'Tap to stomp up, hold to grip the ceiling', glider: 'Hold to rise, release to dive', sled: 'Tap for resin bursts', bong: 'Hold to climb the bubbles', cannon: 'Tap to fire pods, the recoil lifts you', board: 'Fly level in your smoke to shake drones' };
// Missions: the same three for everyone on a given UTC day; they only add a flat bonus.
const MISSIONS = [
  { id: 'hi5', txt: (n) => `High-five ${n} workers`, t: [3, 5, 8] },
  { id: 'near', txt: (n) => `Near-miss ${n} grow lights`, t: [5, 10, 16] },
  { id: 'nug', txt: (n) => `Collect ${n} nugs`, t: [80, 150, 250] },
  { id: 'air', txt: (n) => `Stay airborne ${n} s`, t: [30, 60, 100] },
  { id: 'veh', txt: (n) => `Ride ${n} vehicle${n > 1 ? 's' : ''}`, t: [1, 2, 3] },
  { id: 'dodge', txt: (n) => `Dodge ${n} drone shots`, t: [3, 6, 10] },
  { id: 'smash', txt: (n) => `Shockwave ${n} hazards`, t: [4, 8, 14] },
];
function dailyMissions(day) {
  const ids = [...MISSIONS.keys()]; let a = (day * 2654435761) >>> 0; const pick = [];
  while (pick.length < 3) { a = (Math.imul(a, 1103515245) + 12345) >>> 0; pick.push(ids.splice(a % ids.length, 1)[0]); }
  return pick.map((i, k) => { const m = MISSIONS[i], n = m.t[(day + k) % 3]; return { id: m.id, n, txt: m.txt(n), have: 0, done: false }; });
}
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1e-6; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function vrng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rnd6 = () => (Math.random() * 6) | 0;
const INK = '#1f1828';

export class JetpackDash extends Game8 {
  get title() { return 'BUD ESCAPE'; }
  get hint() { const m = this.ms || dailyMissions(this.day()); return `Hold to fire the hover-dolly, let go to fall. Dodge grow lights, drones, lasers and harvest arms. Rainbow crates give a vehicle that takes one hit. Today's missions: ${m.map(x => x.txt).join(' / ')}.`; }
  get accent() { return '#4ade80'; }
  get musicOpts() { return { root: 52, bpm: 126, mode: 'minor', seed: 420, vol: 0.26 }; }
  get settingsSchema() { return [
    { key: 'detail', label: 'Graphics detail', def: 'high', options: [['high', 'High'], ['performance', 'Performance (battery saver)']] },
    { key: 'fx', label: 'Screen shake', def: 'on', options: [['on', 'On'], ['off', 'Off']] }]; }
  applySettings(x) { this.opt = { detail: 'high', fx: 'on', ...x }; if (this._baked) this.bake(); }
  constructor(c, o) { super(c, o); const r = document.getElementById('rot'); if (r) r.style.display = 'none'; }
  day() { return Math.floor(Date.now() / 864e5); }
  hi() { return !this.opt || this.opt.detail !== 'performance'; }
  async load() {
    const img = new Image(); img.src = '/assets/bud-escape/atlas.webp';
    const [A] = await Promise.all([fetch('/assets/bud-escape/atlas.json').then(r => r.json()).catch(() => null), img.decode().catch(() => null)]);
    this.atlas = A && img.naturalWidth ? { img, A } : null; this.bake();
  }
  // draw atlas sprite n with height h (px) at (x, y); ax/ay = anchor fraction; w overrides the width (stretch)
  spr(ctx, n, x, y, h, o = {}) {
    const at = this.atlas; if (!at) return; const f = at.A[n]; if (!f) return; const w = o.w || h * f[2] / f[3];
    const ax = o.ax == null ? 0.5 : o.ax, ay = o.ay == null ? 1 : o.ay;
    if (!o.rot && !o.flip && o.a == null && !o.add) { ctx.drawImage(at.img, f[0], f[1], f[2], f[3], x - w * ax, y - h * ay, w, h); return; }
    ctx.save(); if (o.a != null) ctx.globalAlpha *= o.a; if (o.add) ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); if (o.rot) ctx.rotate(o.rot); if (o.flip) ctx.scale(-1, 1);
    ctx.drawImage(at.img, f[0], f[1], f[2], f[3], -w * ax, -h * ay, w, h); ctx.restore();
  }
  // ---- view: metres -> logical pixels. Landscape: the corridor fills the height; portrait: ~12 m visible ahead. ----
  layout() {
    const W = this.W, H = this.H; this.ppm = Math.min(H / 10.6, W / 14.5); const bandH = (CH + 1.6) * this.ppm;
    const top = Math.round((H - bandH) / 2);
    this.ceilY = top + 0.8 * this.ppm; this.floorY = this.ceilY + CH * this.ppm; this.heroX = W * (this.portrait ? 0.16 : 0.2);
    this.ahead = (W - this.heroX) / this.ppm; if (this._baked) this.bake();
  }
  sx(x) { return this.heroX + (x - this.dist) * this.ppm; } sy(y) { return this.floorY - y * this.ppm; }
  screen(x, y) { return [this.sx(x), this.sy(y)]; }
  // ---- background, baked once per view size: grow room seen through the lab windows (parallax 0.4), the lab wall with its
  // machines (parallax 1) and hanging chains in front (parallax 1.25). Walls, props and plants are toon renders (models.json).
  bake() {
    if (!this.ppm || !this.atlas) return; this._baked = true; const p = this.ppm, H = this.H, k = Math.min(1.5, this.scale || 1), cY = this.ceilY, fY = this.floorY, hi = this.hi(), vr = vrng(0xb0d);
    const M = CH * p / 2, COLS = [['w_window', 'w_window'], ['w_pillar', 'w_pillar'], ['w_window', 'w_display'], ['w_detail', 'w_window'], ['w_window', 'w_door'], ['w_pillar', 'w_pillar'], ['w_window', 'w_window'], ['w_wall', 'w_detail']];
    const RW = M * COLS.length, mk = () => { const c = canvas(RW * k, H * k), x = c.getContext('2d'); x.scale(k, k); return [c, x]; };
    // grow room: violet hall, two levels of cannabis plants under magenta LED bars
    const [far, f] = mk(); let g = f.createLinearGradient(0, cY, 0, fY); g.addColorStop(0, '#3b0764'); g.addColorStop(0.55, '#581c87'); g.addColorStop(1, '#1e1b4b'); f.fillStyle = g; f.fillRect(0, 0, RW, H);
    for (const [shelfY, ledY] of [[0.3, 4.0], [4.7, 8.4]]) {
      const sy = fY - shelfY * p, ly = fY - ledY * p;
      g = f.createLinearGradient(0, ly, 0, sy); g.addColorStop(0, 'rgba(244,114,182,.6)'); g.addColorStop(1, 'rgba(192,38,211,.1)'); f.fillStyle = g; f.fillRect(0, ly, RW, sy - ly);
      for (let x = 0.4 * p; x < RW; x += 0.95 * p) this.spr(f, 'p_plant' + (1 + Math.floor(vr() * 3)), x + vr() * 0.2 * p, sy + 0.05 * p, (2.6 + vr() * 0.6) * p);
      f.fillStyle = '#2e1a47'; f.fillRect(0, sy, RW, 0.3 * p); f.fillStyle = '#7e5bb0'; f.fillRect(0, sy, RW, 0.06 * p);
      f.fillStyle = '#2e1a47'; f.fillRect(0, ly - 0.2 * p, RW, 0.24 * p); f.fillStyle = '#fbcfe8'; f.fillRect(0, ly + 0.02 * p, RW, 0.08 * p);
      if (hi) for (let x = 0.6 * p; x < RW; x += 1.8 * p) this.spr(f, 'light_01', x, ly + 0.4 * p, 2 * p, { ay: 0.5, add: true, a: 0.6 });
    }
    // lab wall: space-station wall modules (windows open onto the grow room), metal ceiling and floor, machines along the wall
    const [wall, w] = mk(); COLS.forEach((col, i) => { this.spr(w, col[0], i * M + M / 2, cY + M, M, { w: M + 1 }); this.spr(w, col[1], i * M + M / 2, fY, M, { w: M + 1 }); });
    const T1 = 1.2 * p; for (let x = 0; x < RW; x += T1) { for (let y = cY; y > -T1; y -= T1) this.spr(w, 'f_metal', x, y, T1, { ax: 0, ay: 1, w: T1 + 0.5 }); for (let y = fY + 0.45 * p; y < H + T1; y += T1) this.spr(w, 'f_metal', x, y, T1, { ax: 0, ay: 0, w: T1 + 0.5 }); }
    for (let x = 0; x < RW; x += 2.4 * p) this.spr(w, 'f_floor', x, fY - 0.05 * p, 0.6 * p, { ax: 0, ay: 0, w: 2.4 * p + 0.5 });
    for (let x = 0; x < RW; x += 3 * p) this.spr(w, 's_pipe', x, cY + 0.1 * p, 0.42 * p, { ax: 0, ay: 1, w: 3 * p + 0.5 });
    if (cY - 1.2 * p > 0) { w.fillStyle = 'rgba(12,10,30,.55)'; w.fillRect(0, 0, RW, cY - 1.2 * p); } if (fY + 1.6 * p < H) { w.fillStyle = 'rgba(12,10,30,.55)'; w.fillRect(0, fY + 1.6 * p, RW, H - fY - 1.6 * p); }
    const prop = (n, x, h) => this.spr(w, n, x * M, fY + 0.06 * p, h * p);
    prop('s_machine', 1.5, 2.2); prop('s_barrel', 2.25, 1.5); prop('s_cone', 2.75, 0.9); prop('s_tank', 3.5, 1.9); prop('s_computer', 4.45, 1.4); prop('s_hopper', 5.6, 2.3);
    prop('s_containertall', 6.3, 1.7); prop('barrel_red', 6.62, 1.1); prop('s_generator', 7.3, 1.3); prop('s_box', 7.75, 0.9); prop('s_cone', 0.35, 0.9);
    for (const x of [1.5, 5.5]) { this.spr(w, 's_screen', x * M, cY + 0.25 * p, 1.4 * p, { ay: 0 }); this.spr(w, 'camera', (x + 0.02) * M, cY + 2 * p, 0.55 * p, { ay: 0, flip: true }); }
    for (const x of [3.5, 7.5]) { this.spr(w, (x | 0) % 2 ? 'i039' : 'i040', x * M, cY + 0.3 * p, 0.55 * p, { ay: 0, rot: Math.PI }); }
    w.fillStyle = 'rgba(0,0,0,.2)'; w.fillRect(0, fY + 0.5 * p, RW, 0.08 * p);
    // foreground: chains hanging from the ceiling
    const [fg, q] = mk(); for (const x of [3, 15, 27]) { const n = 2 + Math.floor(vr() * 3); for (let i = 0; i < n; i++) this.spr(q, 'chain', x * p, cY + i * 0.55 * p, 0.58 * p, { ay: 0 }); }
    this.tiles = { far, wall, fg, RW, H };
  }
  // ---------- game state ----------
  reset() {
    super.reset(); this.score = 0; this.coins = 0; this.dist = 0; this.v = 8; this.y = 0; this.vy = 0; this.hold = false; this.kh = 0; this.paid = 0; this.prevHold = false;
    this.veh = null; this.zaps = []; this.drones = []; this.shots = []; this.lasers = []; this.arms = []; this.trails = []; this.crates = []; this.workers = []; this.pods = []; this.sp = []; this.ring = [];
    this.nextHaz = 45; this.nextCoin = 20; this.nextDrone = 170; this.nextLaser = 700; this.nextArm = 900; this.nextCrate = 320; this.nextWorker = 25;
    this._died = false; this.rag = null; this.mT = -9; this.slowT = 0; this.ts = 1; this.airT = 0; this.yHist = []; this.flash = null;
    this.ms = dailyMissions(this.day());
  }
  onDown() { this.hold = true; } onUp() { this.hold = false; }
  onKey(c, d) { if (c === 'Space' || c === 'ArrowUp' || c === 'KeyW') this.kh = d ? 1 : 0; }
  diff() { return clamp(this.dist / 3200, 0, 1); }
  rr(a, b) { return a + this.r() * (b - a); }
  bump(id, n = 1) {
    for (const m of this.ms) if (m.id === id && !m.done) { if (id !== 'air' && id !== 'nug') this.mT = this.playT; m.have = Math.min(m.n, m.have + n); if (m.have >= m.n) { m.done = true; this.award(MISSION_PTS, 'q'); this.pop(this.W / 2, this.ceilY + 2.2 * this.ppm, 'MISSION COMPLETE +' + MISSION_PTS, '#86efac', 22); this.sfx.chord([523, 659, 784, 1047], 0.16, { type: 'triangle', vol: 0.14 }); } }
  }
  // ---- seeded world generation (in distance order) ----
  spawnHaz() {
    const d = this.nextHaz, df = this.diff(); const n = df > 0.3 && this.r() < 0.3 + df * 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) { const L = this.rr(2.4, 3.2 + df * 2.4), kind = this.r(), ang = kind < 0.32 ? 0 : kind < 0.62 ? Math.PI / 2 : kind < 0.81 ? Math.PI / 4 : -Math.PI / 4;
      const rot = this.dist > 500 && this.r() < 0.18 + df * 0.25 ? (this.r() < 0.5 ? -1 : 1) * this.rr(0.8, 1.6) : 0; const half = Math.abs(Math.sin(ang)) * L / 2 + 0.3;
      const cy = rot ? this.rr(L / 2 + 0.4, CH - L / 2 - 0.4) : this.rr(half + 0.2, CH - half - 0.2); this.zaps.push({ x: d + i * this.rr(7, 11), cy, L, ang, rot, near: false, close: false }); }
    this.nextHaz = d + Math.max(11, 24 - df * 11) + this.r() * 10;
  }
  spawnCoins() { const d = this.nextCoin, kind = Math.floor(this.r() * 4), cy = this.rr(1.2, CH - 2.2), n = 8 + Math.floor(this.r() * 10), pts = [];
    for (let i = 0; i < n; i++) { const x = d + i * 0.7; let y = cy; if (kind === 1) y = cy + Math.sin(i / (n - 1) * Math.PI) * 1.8; else if (kind === 2) y = cy + Math.sin(i * 0.7) * 1.1; else if (kind === 3) y = cy + (i % 2) * 0.7; pts.push({ x, y: clamp(y, 0.5, CH - 0.6), got: false }); }
    this.trails.push({ pts, end: pts[pts.length - 1].x }); this.nextCoin = d + n * 0.7 + this.rr(12, 30); }
  spawnDrone() { const n = this.dist > 900 && this.r() < 0.25 + this.diff() * 0.3 ? 2 : 1;
    for (let i = 0; i < n; i++) this.drones.push({ ph: 'in', t: 0.5, lock: 1.5 + i * 0.6, y: clamp(this.y + 0.95 + (i ? this.rr(-2.5, 2.5) : 0), 0.7, CH - 0.7), up: 0, beep: 0 });
    this.nextDrone += Math.max(80, 200 - this.diff() * 110) + this.r() * 90; }
  spawnLaser() { const rows = this.r() < 0.5 ? [this.rr(1, CH - 1)] : [this.rr(1, CH / 2 - 0.5), this.rr(CH / 2 + 0.5, CH - 1)]; for (const y of rows) this.lasers.push({ y, ph: 'warn', t: 1.6 }); this.nextLaser += Math.max(220, 520 - this.diff() * 250) + this.r() * 200; }
  spawnArm() { const top = this.r() < 0.5, L = this.rr(4.2, 5.6), sp = this.rr(0.9, 1.5) * (this.r() < 0.5 ? -1 : 1); this.arms.push({ x: this.nextArm, top, L, ph: this.r() * TAU, sp, amp: this.rr(0.6, 0.95) }); this.nextArm += this.rr(260, 520) - this.diff() * 120; }
  armTip(a) { const base = a.top ? CH : 0, ang = (a.top ? -Math.PI / 2 : Math.PI / 2) + Math.sin(this.playT * a.sp + a.ph) * a.amp; return [a.x, base, a.x + Math.cos(ang) * a.L, base + Math.sin(ang) * a.L]; }
  // ---- hits, vehicles, shockwaves ----
  shock(reach) {
    const lo = this.dist - 4, hi = this.dist + reach; let n = 0; const keep = (x) => x < lo || x > hi;
    const z0 = this.zaps.length; this.zaps = this.zaps.filter(z => keep(z.x)); n += z0 - this.zaps.length;
    const a0 = this.arms.length; this.arms = this.arms.filter(a => keep(a.x)); n += a0 - this.arms.length;
    n += this.shots.length; this.shots = []; for (const d of this.drones) if (d.ph !== 'out') { d.ph = 'out'; n++; } for (const l of this.lasers) { l.ph = 'done'; n++; }
    this.ring.push({ x: this.dist, y: this.y + 1, t: 0 }); this.fx.shake(10); if (n) this.bump('smash', n);
  }
  enterVehicle(k) {
    this.veh = { k, t: 0, float: 0, grip: 0 }; this.vy = 4; this.shock(18); this.ts = 0.55; this.slowT = 1.1; this.bump('veh'); this.mark('#v', VEH.indexOf(k) + 1);
    this.sfx.chord([392, 523, 659, 784], 0.18, { type: 'square', vol: 0.12 }); this.flash = { name: VEH_NAME[k], hint: VEH_HINT[k], t: 2.2 };
    for (let i = 0; i < 8; i++) this.puff('puff' + 4 * rnd6(), this.dist + (Math.random() - 0.5) * 2, this.y + Math.random() * 1.6, 1.3, 0.6, (Math.random() - 0.5) * 4, Math.random() * 2);
  }
  hit(why) {
    if (this._died) return;
    if (this.veh) { const k = this.veh.k; this.veh = null; this.shock(16); this.vy = 7; this.hitstop(0.06); this.sfx.noise(0.35, { vol: 0.45, freq: 500 }); this.mark('#x', 1);
      for (let i = 0; i < 6; i++) this.puff('boom' + i, this.dist + (Math.random() - 0.5) * 1.6, this.y + 0.6 + Math.random() * 1.2, 1.6 + Math.random(), 0.55, (Math.random() - 0.5) * 6, Math.random() * 3);
      const [sx, sy] = this.screen(this.dist, this.y + 1); this.fx.sparks(sx, sy, ['#fde047', '#fb923c', '#fff'], 22, 520, 0.5, 14); this.pop(sx + 60, sy - 80, VEH_NAME[k] + ' DESTROYED', '#fca5a5', 16); return; }
    this._died = true; this.deathDist = this.dist; this.fx.shake(16); this.hitstop(0.08); this.sfx.noise(0.4, { vol: 0.5, freq: 400 }); const [sx, sy] = this.screen(this.dist, this.y + 1);
    this.fx.burst(sx, sy, ['#fff', '#fde047', '#fb923c'], 22, 380, 0.6, 10); this.pop(sx + 40, sy - 80, why, '#f87171', 26);
    this.rag = { x: this.dist, y: this.y + 0.3, vx: Math.max(6, this.v * 0.7), vy: Math.max(3, this.vy * 0.4 + 4), rot: 0, vr: 9, dx: this.dist, dy: this.y, dvx: this.v * 0.9, dvy: 6, drot: 0 };
    this.kill(2.4, '#fca5a5');
  }
  heroHits(px, py, r) { for (const k of [0.45, 0.95, 1.45]) if (Math.hypot(px - this.dist, py - (this.y + k)) < r + 0.36) return true; return false; }
  // ---- vehicle controls (replace the dolly while riding) ----
  vehicle(dt, hold, tap) {
    const V = this.veh; V.t += dt; const onF = this.y <= 0.001, top = CH - HERO_H - 0.05, onC = this.y >= top - 0.001;
    switch (V.k) {
      case 'blunt': if (tap && onF) { this.vy = 12.5; V.float = 0.8; } if (hold && !onF && V.float > 0) { V.float -= dt; this.vy -= 13 * dt; } else this.vy -= 38 * dt; break;
      case 'walker':
        if (V.grip > 0) { V.grip -= dt; this.vy = 0; this.y = top; if (!hold || V.grip <= 0) { V.grip = 0; this.vy = -2; } if (tap) { V.grip = 0; this.vy = -12; } break; }
        if (tap && (onF || this.vy < 2)) { this.vy = 15.5; this.sfx.noise(0.12, { vol: 0.2, freq: 220 }); } this.vy -= 34 * dt; if (onC && hold && this.vy >= 0) V.grip = 1.4; break;
      case 'glider': this.vy += (hold ? 15 : -20) * dt; this.vy = clamp(this.vy, -9, 6); break;
      case 'sled': if (tap) { this.vy = Math.max(this.vy, 0) + 9.5; this.burst(); } this.vy -= 26 * dt; break;
      case 'bong': this.vy = lerp(this.vy, hold ? 7 : -9, Math.min(1, dt * (hold ? 3.5 : 2.5))); if (hold && Math.random() < dt * 14) this.puff('trace_06', this.dist - 0.3 + Math.random() * 0.4, this.y + 0.3, 0.3, 0.8, -this.v * 0.2, 2.5, { bubble: 1 }); break;
      case 'cannon': if (tap) { this.vy = Math.max(this.vy, 0) + 11; this.pods.push({ x: this.dist + 0.2, y: this.y + 0.3, vy: -14 }); this.sfx.noise(0.18, { vol: 0.3, freq: 300 }); } this.vy -= 30 * dt; break;
      case 'board': this.vy += (hold ? 30 : 0) * dt - 22 * dt; this.vy = clamp(this.vy, -12, 9); if (Math.random() < dt * 30) this.puff('puff' + 4 * rnd6(), this.dist - 0.7, this.y + 0.25 + Math.random() * 0.3, 0.9 + Math.random() * 0.4, 1.4, -1, 0.3, { tint: 1 }); break;
    }
  }
  burst() { // resin sled: clears a small area around the sled
    const lo = this.dist - 1.5, hi = this.dist + 3.5; let n = 0; const near = (x, y) => x > lo && x < hi && Math.abs(y - this.y - 0.9) < 3.2;
    const z0 = this.zaps.length; this.zaps = this.zaps.filter(z => !near(z.x, z.cy)); n += z0 - this.zaps.length; const s0 = this.shots.length; this.shots = this.shots.filter(s => !near(s.x, s.y)); n += s0 - this.shots.length;
    if (n) this.bump('smash', n); this.ring.push({ x: this.dist + 0.8, y: this.y + 0.6, t: 0, small: 1 }); this.sfx.noise(0.15, { vol: 0.25, freq: 900 });
    for (let i = 0; i < 3; i++) this.puff('puff' + 4 * i, this.dist - 0.5, this.y + 0.2, 0.9, 0.45, -3, -1);
  }
  puff(img, x, y, size, life, vx = 0, vy = 0, o = {}) { if (this.sp.length > 140) this.sp.shift(); this.sp.push({ img, x, y, size, life, max: life, vx, vy, rot: Math.random() * TAU, vr: (Math.random() - 0.5) * 2, ...o }); }
  update(dt) {
    if (this._died) return;
    if (this.slowT > 0) { this.slowT -= dt / this.ts; if (this.slowT <= 0) this.ts = 1; }
    const hold = !!(this.hold || this.kh), tap = hold && !this.prevHold; this.prevHold = hold;
    this.v = Math.min(VMAX, 8 + this.dist * 0.0042); this.dist += this.v * dt;
    if (this.veh) this.vehicle(dt, hold, tap);
    else { this.vy += (hold ? 36 : 0) * dt - 27 * dt; this.vy = clamp(this.vy, -15, 11); }
    this.y += this.vy * dt; const top = CH - (this.veh ? VEH_H[this.veh.k] : HERO_H) - 0.05;
    if (this.y <= 0) { this.y = 0; if (this.vy < 0) this.vy = 0; } if (this.y >= top) { this.y = top; if (this.vy > 0) this.vy = 0; }
    this.thrust = hold && !this.veh; if (this.y > 0.05) { this.airT += dt; if (this.airT >= 1) { this.airT -= 1; this.bump('air'); } }
    this.yHist.push([this.playT, this.y]); while (this.yHist.length && this.yHist[0][0] < this.playT - 0.7) this.yHist.shift();
    // distance payouts (the score)
    while (this.dist >= (this.paid + 1) * STEP) { this.paid++; this.award(STEP, 'm'); }
    // world spawning
    const ahead = this.dist + 60; while (this.nextHaz < ahead) this.spawnHaz(); while (this.nextCoin < ahead) this.spawnCoins();
    while (this.nextDrone < this.dist) this.spawnDrone();
    while (this.nextLaser < this.dist) { if (this.veh) this.nextLaser = this.dist + 60; else this.spawnLaser(); }
    while (this.nextArm < ahead) this.spawnArm();
    while (this.nextCrate < ahead) { if (this.veh) { this.nextCrate = this.dist + 80; break; } this.crates.push({ x: this.nextCrate, y: this.rr(1.5, CH - 2.5), got: false }); this.nextCrate += this.rr(480, 760); }
    while (this.nextWorker < ahead) { const r = this.r(); this.workers.push({ x: this.nextWorker, k: r < 0.5 ? 'fw' : 'ma', hi5: 0, ph: this.r() * 8 }); this.nextWorker += this.rr(35, 85); }
    // grow-light zappers
    for (const z of this.zaps) { if (z.rot) z.ang += z.rot * dt; if (z.x < this.dist - 12) continue; const hx = Math.cos(z.ang) * z.L / 2, hy = Math.sin(z.ang) * z.L / 2;
      const ax = z.x - hx, ay = z.cy - hy, bx = z.x + hx, by = z.cy + hy; let md = Infinity; for (const k of [0.45, 0.95, 1.45]) md = Math.min(md, segDist(this.dist, this.y + k, ax, ay, bx, by));
      if (md < 0.56) { z.hit = true; this.hit('ZAPPED'); if (this._died) return; }
      else if (!z.near && md < 1.15 && Math.abs(this.dist - z.x) < Math.abs(hx) + 0.6) z.close = true;
      if (!z.near && !z.hit && z.close && this.dist > Math.max(ax, bx) + 0.5) { z.near = true; this.bump('near'); const [sx, sy] = this.screen(this.dist, this.y + 1.2); this.pop(sx, sy - 100, 'CLOSE CALL', '#a5f3fc', 16); this.sfx.tone(1250, 0.07, { type: 'square', vol: 0.07, slide: 1.4 }); } }
    this.zaps = this.zaps.filter(z => z.x > this.dist - 14);
    // harvest arms
    for (const a of this.arms) { if (a.x > this.dist + 8 || a.x < this.dist - 8) continue; const [ax, ay, bx, by] = this.armTip(a); let md = Infinity;
      for (const k of [0.45, 0.95, 1.45]) md = Math.min(md, segDist(this.dist, this.y + k, ax, ay, bx, by) - 0.05, Math.hypot(this.dist - bx, this.y + k - by) - 0.35);
      if (md < 0.36) { this.hit('HARVESTED'); if (this._died) return; } }
    this.arms = this.arms.filter(a => a.x > this.dist - 10);
    // nugs
    for (const t of this.trails) for (const c of t.pts) if (!c.got && Math.abs(c.x - this.dist) < 0.7 && Math.abs(c.y - (this.y + 0.95)) < 1.05) { c.got = true; this.coins++; this.bump('nug'); this.sfx.tone(1046 + (this.coins % 8) * 40, 0.04, { type: 'square', vol: 0.045 }); }
    this.trails = this.trails.filter(t => t.end > this.dist - 10);
    // vehicle crates
    for (const c of this.crates) if (!c.got && !this.veh && Math.abs(c.x - this.dist) < 1 && Math.abs(c.y - (this.y + 0.95)) < 1.3) { c.got = true; this.enterVehicle(VEH[Math.floor(this.r() * VEH.length)]); }
    this.crates = this.crates.filter(c => !c.got && c.x > this.dist - 10);
    // warehouse staff: fly low past them for a high five (the security robot doesn't high-five)
    for (const w of this.workers) { w.x -= (w.k === 'rb' ? 0.7 : 1.1) * dt; if (w.k !== 'rb' && !w.hi5 && this.y < 1.1 && Math.abs(w.x - this.dist) < 0.8) { w.hi5 = 1.2; this.bump('hi5'); const [sx, sy] = this.screen(this.dist, 2.4); this.pop(sx + 20, sy - 30, 'HIGH FIVE!', '#fde047', 18); this.sfx.noise(0.06, { vol: 0.3, freq: 2400 }); } if (w.hi5 > 0) w.hi5 = Math.max(0.0001, w.hi5 - dt); }
    this.workers = this.workers.filter(w => w.x > this.dist - 12);
    // drones: fly in, lock on to your height (red reticle + beeps), fire one shot straight left, then leave
    const edge = this.dist + this.ahead - 1.6, ys = this.yHist.length ? this.yHist[0][1] : this.y, smoke = this.veh && this.veh.k === 'board' && Math.abs(this.y - ys) < 0.7;
    for (const d of this.drones) { d.t -= dt;
      if (d.ph === 'in') { if (d.t <= 0) { d.ph = 'lock'; d.t = d.lock; } }
      else if (d.ph === 'lock') { if (smoke && d.t < d.lock - 0.3) { d.ph = 'out'; const [sx, sy] = this.screen(edge, d.y); this.pop(sx - 40, sy - 30, 'LOCK LOST', '#cbd5e1', 14); continue; }
        if (d.t > 0.4) d.y = lerp(d.y, clamp(this.y + 0.95, 0.7, CH - 0.7), Math.min(1, dt * 3.2)); d.beep -= dt; if (d.beep <= 0) { d.beep = d.t < 0.6 ? 0.09 : 0.22; this.sfx.tone(d.t < 0.6 ? 1320 : 990, 0.04, { type: 'square', vol: 0.05 }); }
        if (d.t <= 0) { d.ph = 'out'; this.shots.push({ x: edge - 0.6, y: d.y, passed: false }); this.sfx.noise(0.2, { vol: 0.25, freq: 1600 }); } }
      if (d.ph === 'out') d.up += dt * 9; }
    this.drones = this.drones.filter(d => d.up < 12);
    for (const s of this.shots) { s.x -= 20 * dt; if (this.heroHits(s.x, s.y, 0.25)) { s.dead = true; this.hit('SHOT DOWN'); if (this._died) return; } else if (!s.passed && s.x < this.dist - 1) { s.passed = true; this.bump('dodge'); } }
    this.shots = this.shots.filter(s => !s.dead && s.x > this.dist - 14);
    // UV lasers: charge, fire, fade
    for (const l of this.lasers) { l.t -= dt; if (l.ph === 'warn' && l.t <= 0) { l.ph = 'fire'; l.t = 1.1; this.sfx.noise(0.5, { vol: 0.25, freq: 900 }); } else if (l.ph === 'fire') { if (Math.abs(this.y + 0.95 - l.y) < 1.0) { this.hit('UV BURN'); if (this._died) return; } if (l.t <= 0) l.ph = 'done'; } }
    this.lasers = this.lasers.filter(l => l.ph !== 'done');
    // cannon pods
    for (const pd of this.pods) { pd.vy -= 20 * dt; pd.y += pd.vy * dt; if (pd.y <= 0.2) { pd.dead = true; for (let i = 0; i < 3; i++) this.puff('boom' + ((Math.random() * 9) | 0), pd.x + (Math.random() - 0.5), 0.5 + Math.random() * 0.6, 1.2, 0.5, (Math.random() - 0.5) * 3, 1.5); this.fx.shake(4); } }
    this.pods = this.pods.filter(p => !p.dead);
    this.setLevel(0.35 + this.diff() * 0.6);
  }
  dyingUpdate(dt) { // ragdoll: Cash tumbles and slides along the floor, the dolly skids away
    const R = this.rag; if (!R) return; dt *= 2.5;
    R.vy -= 30 * dt; R.x += R.vx * dt; R.y += R.vy * dt; R.rot += R.vr * dt;
    if (R.y <= 0) { R.y = 0; if (R.vy < -3) { R.vy = -R.vy * 0.35; this.fx.shake(5); for (let i = 0; i < 3; i++) this.puff('dirt_01', R.x, 0.1, 0.8, 0.6, (Math.random() - 0.3) * 3, 1.2); } else R.vy = 0;
      R.vx *= Math.pow(0.18, dt); R.vr = lerp(R.vr, 0, Math.min(1, dt * 3)); R.rot = lerp(R.rot, Math.round(R.rot / TAU) * TAU, Math.min(1, dt * 2)); if (Math.random() < dt * 20 && R.vx > 1) this.puff('dirt_01', R.x - 0.2, 0.1, 0.6, 0.5, -1, 0.8); }
    R.dvy -= 30 * dt; R.dx += R.dvx * dt; R.dy = Math.max(0, R.dy + R.dvy * dt); R.drot += 5 * dt * (R.dy > 0 ? 1 : 0.2); if (R.dy <= 0) { R.dvx *= Math.pow(0.3, dt); R.dvy = R.dvy < -3 ? -R.dvy * 0.3 : 0; }
    this.dist = lerp(this.dist, R.x - 1.5, Math.min(1, dt * 2)); for (const s of this.sp) { s.life -= dt * 0.6; s.x += s.vx * dt * 0.6; s.y += s.vy * dt * 0.6; }
  }
  // ---------- drawing ----------
  frame(dt) { this._dt = dt; super.frame(dt); }
  draw() {
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#3b4658'; ctx.fillRect(0, 0, this.c.width, this.c.height);
    const sm = this.opt && this.opt.fx === 'off' ? 0 : this.fx.shakeM, sx = sm ? (Math.random() - 0.5) * sm * 0.5 : 0, sy = sm ? (Math.random() - 0.5) * sm * 0.5 : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    this.world(ctx); this.fx.draw(ctx);
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); const k = 1 + Math.max(0, p.life - 0.7) * 1.5; this.text(ctx, p.text, p.x, p.y, { size: p.size * k, color: p.color, align: 'center', glow: p.color }); }
    ctx.globalAlpha = 1; if (this.fx.flashA > 0.01) { ctx.globalAlpha = this.fx.flashA; ctx.fillStyle = this.fx.flashC; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
    this.render(ctx); ctx.restore();
    if (this.state === 'ready') this.center(ctx, this.title, this.hint, 'TAP TO START'); if (this.state === 'paused') this.center(ctx, 'PAUSED', 'Tap Resume to keep playing');
  }
  tile(ctx, img, par) { const t = this.tiles, off = ((this.dist * this.ppm * par) % t.RW + t.RW) % t.RW; for (let x = -off; x < this.W; x += t.RW) ctx.drawImage(img, Math.floor(x), 0, Math.ceil(t.RW) + 1, t.H); }
  world(ctx) {
    const W = this.W, p = this.ppm, t = this.tiles, T = this.t, hi = this.hi(), dt = this.state === 'play' ? (this._dt || 0) : 0;
    if (!t) { ctx.fillStyle = '#6a7b91'; ctx.fillRect(0, 0, W, this.H); return; }
    this.tile(ctx, t.far, 0.4); this.tile(ctx, t.wall, 1);
    // painted distance markers every 100 m (on the floor edge)
    ctx.font = `900 ${Math.round(0.5 * p)}px Orbitron,"Exo 2",sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(30,41,59,.7)';
    for (let m = Math.ceil((this.dist - 6) / 100) * 100; m < this.dist + this.ahead + 4; m += 100) if (m > 0) ctx.fillText(`${m} M`, this.sx(m), this.sy(-0.62));
    ctx.textAlign = 'left';
    // warehouse staff (walking toward Cash)
    for (const w of this.workers) { const x = this.sx(w.x); if (x < -2 * p || x > W + 2 * p) continue;
      const fr = w.k === 'rb' ? `rb_walk${((T * 8 + w.ph) | 0) % 8}` : w.hi5 > 0 ? `${w.k}_cheer${((T * 6) | 0) % 2}` : `${w.k}_walk${((T * 9 + w.ph) | 0) % 8}`;
      this.spr(ctx, fr, x, this.floorY + 0.04 * p, 1.55 * p, { flip: !(w.hi5 > 0) }); }
    // vehicle crates: rainbow strain-sample crates
    for (const c of this.crates) { const [x, y0] = this.screen(c.x, c.y); if (x > W + 2 * p) continue; const y = y0 + Math.sin(T * 3 + c.x) * 0.15 * p, s = 1.05 * p;
      if (hi) this.spr(ctx, 'light_02', x, y, 2.4 * p, { ay: 0.5, add: true, a: 0.5 });
      this.spr(ctx, 'obj_crate002', x, y, s, { ay: 0.5 }); ctx.save(); ctx.globalAlpha = 0.5;
      const g = ctx.createLinearGradient(x - s / 2, y - s / 2, x + s / 2, y + s / 2); const h0 = (T * 120) % 360; for (let i = 0; i <= 5; i++) g.addColorStop(i / 5, `hsl(${(h0 + i * 60) % 360},95%,60%)`);
      ctx.fillStyle = g; roundRect(ctx, x - s * 0.44, y - s * 0.44, s * 0.88, s * 0.88, s * 0.12); ctx.fill(); ctx.restore(); this.spr(ctx, 'leaf', x, y, s * 0.55, { ay: 0.5 }); }
    // nugs
    for (const tr of this.trails) for (const c of tr.pts) { if (c.got) continue; const x = this.sx(c.x); if (x < -p || x > W + p) continue; this.spr(ctx, 'gem_green', x, this.sy(c.y) + Math.sin(T * 4 + c.x * 1.3) * 0.06 * p, 0.5 * p, { ay: 0.5 }); }
    // grow-light zappers
    for (const z of this.zaps) { const x = this.sx(z.x); if (x < -4 * p || x > W + 4 * p) continue; this.zapper(ctx, x, this.sy(z.cy), z.L * p, -z.ang, hi); }
    // harvest arms: hazard-striped arm with a spinning saw
    for (const a of this.arms) { const x = this.sx(a.x); if (x < -7 * p || x > W + 7 * p) continue; const [ax, ay, bx, by] = this.armTip(a); const [X0, Y0] = this.screen(ax, ay), [X1, Y1] = this.screen(bx, by), ang = Math.atan2(Y1 - Y0, X1 - X0), L = Math.hypot(X1 - X0, Y1 - Y0);
      ctx.save(); ctx.translate(X0, Y0); ctx.rotate(ang + Math.PI / 2); this.spr(ctx, 'o_arm', 0, 0, L, { ay: 0 }); ctx.restore(); this.spr(ctx, 'saw', X1, Y1, 1.3 * p, { ay: 0.5, rot: T * 14 }); this.spr(ctx, 'o_cog', X0, Y0, 1.1 * p, { ay: 0.5, rot: T * 2 }); }
    // UV lasers: emitters slide in and charge (warning), then a full-width beam
    for (const l of this.lasers) { const y = this.sy(l.y), fire = l.ph === 'fire', ch = fire ? 1 : clamp(1 - l.t / 1.6, 0, 1);
      if (!fire) { ctx.strokeStyle = `rgba(232,121,249,${0.25 + 0.45 * (((T * 10) | 0) % 2)})`; ctx.lineWidth = 2; ctx.setLineDash([12, 9]); ctx.beginPath(); ctx.moveTo(0.9 * p, y); ctx.lineTo(W - 0.9 * p, y); ctx.stroke(); ctx.setLineDash([]); }
      else { const fade = Math.min(1, l.t / 0.25), hw = 0.32 * p * (0.85 + Math.random() * 0.3) * fade; ctx.save(); if (hi) ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(192,38,211,.35)'; ctx.fillRect(0, y - hw * 2.2, W, hw * 4.4); ctx.fillStyle = 'rgba(232,121,249,.9)'; ctx.fillRect(0, y - hw, W, hw * 2); ctx.fillStyle = '#fdf4ff'; ctx.fillRect(0, y - hw * 0.35, W, hw * 0.7); ctx.restore(); }
      for (const ex of [0, W]) { const dir = ex ? -1 : 1, x0 = ex + dir * (Math.min(1, ch * 3) * 1.1 - 0.4) * p; this.spr(ctx, 'o_emitter', x0 - dir * 0.25 * p, y, 0.9 * p, { ay: 0.5, flip: !!ex });
        this.spr(ctx, 'light_01', x0 + dir * 0.45 * p, y, (0.5 + ch * 0.9) * p, { ay: 0.5, add: true }); } }
    // security drones + their shots
    const edge = this.sx(this.dist + this.ahead - 1.6);
    for (const d of this.drones) { const x = edge + (d.ph === 'in' ? d.t * 3 * p : 0), y = this.sy(d.y) - d.up * p; this.drone(ctx, x, y, p, d);
      if (d.ph === 'lock') { const ry = this.sy(d.y), rx = this.heroX + 0.4 * p, k = clamp(d.t / d.lock, 0, 1), r = (0.45 + k * 0.9) * p; ctx.strokeStyle = d.t < 0.6 && ((T * 12) | 0) % 2 ? '#fecaca' : '#ef4444'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(rx, ry, r, 0, TAU); ctx.stroke(); ctx.beginPath(); for (let a = 0; a < 4; a++) { const c = Math.cos(a * Math.PI / 2), s = Math.sin(a * Math.PI / 2); ctx.moveTo(rx + c * r * 0.6, ry + s * r * 0.6); ctx.lineTo(rx + c * r * 1.3, ry + s * r * 1.3); } ctx.stroke();
        ctx.strokeStyle = 'rgba(239,68,68,.35)'; ctx.setLineDash([6, 8]); ctx.beginPath(); ctx.moveTo(rx + 1.1 * p, ry); ctx.lineTo(x - 0.8 * p, ry); ctx.stroke(); ctx.setLineDash([]); } }
    for (const s of this.shots) { const [x, y] = this.screen(s.x, s.y); if (hi) this.spr(ctx, 'light_02', x, y, 0.9 * p, { ay: 0.5, add: true, a: 0.6 }); this.spr(ctx, 'muzzle_02', x + 0.25 * p, y, 1.1 * p, { ay: 0.5, w: 0.4 * p, rot: Math.PI / 2, add: true }); this.spr(ctx, 'o_bullet', x, y, 0.45 * p, { ay: 0.5, rot: T * 10 }); }
    for (const pd of this.pods) { const [x, y] = this.screen(pd.x, pd.y); this.spr(ctx, 'bomb_active', x, y, 0.45 * p, { ay: 0.5, rot: T * 8 }); }
    // shockwave rings
    for (const r of this.ring) { r.t += dt; const [x, y] = this.screen(r.x, r.y), k = r.t / 0.5; if (k < 1) this.spr(ctx, 'circle_03', x, y, (r.small ? 3 : 9) * p * k, { ay: 0.5, add: true, a: 1 - k }); } this.ring = this.ring.filter(r => r.t < 0.5);
    this.hero(ctx, dt);
    // sprite particles (world space)
    for (const s of this.sp) { if (this.state === 'play' && !this._died) { s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt; } if (s.life <= 0) continue; const k = s.life / s.max, [x, y] = this.screen(s.x, s.y);
      if (s.bubble) { ctx.strokeStyle = `rgba(186,230,253,${k})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, (0.12 + (1 - k) * 0.12) * p, 0, TAU); ctx.stroke(); continue; }
      const boom = s.img.startsWith('boom'); this.spr(ctx, s.img, x, y, s.size * p * (1 + (1 - k) * (boom ? 0.6 : 0.8)), { ay: 0.5, rot: s.rot, a: boom ? Math.min(1, k * 1.6) : k * (s.tint ? 0.75 : 0.6) }); }
    this.sp = this.sp.filter(s => s.life > 0);
    if (hi) this.tile(ctx, t.fg, 1.25);
  }
  zapper(ctx, x, y, L, ang, hi) { // grow-light zapper: inked LED bar between two powered nodes, crackling electric arcs
    const p = this.ppm, fl = 0.75 + Math.random() * 0.25; ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
    if (hi) this.spr(ctx, 'light_03', 0, 0, 1.6 * p * fl, { ay: 0.5, w: L + 1.2 * p, add: true, a: 0.45 });
    ctx.lineJoin = 'round'; ctx.fillStyle = '#334155'; ctx.strokeStyle = INK; ctx.lineWidth = 0.07 * p; roundRect(ctx, -L / 2, -0.13 * p, L, 0.26 * p, 0.12 * p); ctx.fill(); ctx.stroke();
    const n = Math.max(3, Math.round(L / (0.32 * p))); for (let i = 0; i < n; i++) { const lx = -L / 2 + 0.3 * p + i * (L - 0.6 * p) / (n - 1); ctx.fillStyle = i % 2 ? '#f0abfc' : '#fb7185'; ctx.beginPath(); ctx.arc(lx, 0, 0.075 * p, 0, TAU); ctx.fill(); }
    for (let j = 0; j < 2; j++) this.spr(ctx, j ? 'spark_05' : 'spark_06', 0, (Math.random() - 0.5) * 0.15 * p, L, { ay: 0.5, w: 0.9 * p, rot: Math.PI / 2 + (Math.random() < 0.5 ? 0 : Math.PI), add: true, a: 0.9 });
    for (const sd of [-1, 1]) { const cx = sd * L / 2; this.spr(ctx, 'o_node', cx, 0, 0.85 * p, { ay: 0.5 }); ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(cx, 0, 0.14 * p, 0, TAU); ctx.fill(); ctx.lineWidth = 0.05 * p; ctx.stroke(); ctx.lineWidth = 0.07 * p;
      if (hi) this.spr(ctx, 'light_03', cx, 0, 1.2 * p * fl, { ay: 0.5, add: true, a: 0.8 }); }
    ctx.restore();
  }
  drone(ctx, x, y, p, d) { // security drone: toon-rendered hover UFO with a gun turret
    y += Math.sin(this.t * 6 + d.y) * 0.08 * p; const out = d.ph === 'out';
    if (d.ph === 'lock' && this.hi()) this.spr(ctx, 'light_02', x - 0.3 * p, y, 1.6 * p, { ay: 0.5, add: true, a: 0.3 + 0.3 * Math.sin(this.t * 20) });
    this.spr(ctx, d.y > 4.5 ? 'o_drone_b' : 'o_drone_a', x, y, 1.5 * p, { ay: 0.5, rot: out ? d.up * 0.5 : Math.sin(this.t * 3 + d.y) * 0.1 });
    if (out) this.spr(ctx, 'puff' + 4 * ((this.t * 8 | 0) % 6), x, y + 0.3 * p, 0.8 * p, { ay: 0.5, a: 0.5 });
  }
  cash(ctx, fr, x, y, k = 1) { // Cash Green sprite, feet at (x, y)
    const at = this.atlas; if (!at) return; const f = at.A['cash_' + fr]; if (!f) return; const an = (at.A._anchor || {}).cash || [f[2] / 2, f[3]], s = k * 1.5 * this.ppm / 186;
    ctx.drawImage(at.img, f[0], f[1], f[2], f[3], x - an[0] * s, y - an[1] * s, f[2] * s, f[3] * s);
  }
  // Cash on the hover-dolly (or in a vehicle), seed pack on his back
  hero(ctx, dt) {
    const p = this.ppm, T = this.t;
    if (this._died && this.rag) { const R = this.rag; const [dx, dy] = this.screen(R.dx, R.dy); this.dolly(ctx, dx, dy, p, false, R.drot);
      const [x, y] = this.screen(R.x, R.y), rest = R.y < 0.05 && Math.abs(R.vx) < 2.5; ctx.save(); ctx.translate(x, y - 0.7 * p); ctx.rotate(rest ? 0 : R.rot);
      this.cash(ctx, rest ? 'dead' + Math.min(9, 5 + ((this.restT = (this.restT || 0) + dt) * 10 | 0)) : 'hurt' + ((T * 12 | 0) % 8), 0, 0.7 * p, 1.25); ctx.restore(); return; }
    this.restT = 0; const hx = this.heroX, fy = this.sy(this.y), air = this.y > 0.02;
    const sh = clamp(1 - this.y / 6, 0.15, 1); ctx.fillStyle = `rgba(0,0,0,${0.3 * sh})`; ctx.beginPath(); ctx.ellipse(hx, this.floorY + 0.05 * p, 0.85 * p * sh, 0.13 * p * sh, 0, 0, TAU); ctx.fill();
    if (this.veh) { this.vehicleArt(ctx, hx, fy, p, this.veh); return; }
    const tilt = clamp(-this.vy * 0.012, -0.12, 0.12) + (this.thrust ? -0.05 : 0); ctx.save(); ctx.translate(hx, fy); ctx.rotate(tilt);
    const fr = !air ? 'idle' + ((T * 10 | 0) % 10) : this.thrust ? 'jump' + (3 + (T * 10 | 0) % 4) : 'jump' + (8 + (T * 6 | 0) % 3);
    this.seedPack(ctx, -0.5 * p, -1.55 * p, p); this.cash(ctx, fr, 0.05 * p, -0.4 * p + (air ? 0 : Math.sin(T * 9) * 0.02 * p), 1.25); this.dolly(ctx, 0, 0, p, this.thrust); ctx.restore();
    if (this.thrust && this.state === 'play' && Math.random() < dt * 30) this.fx.sparks(hx - 0.1 * p, fy + 0.2 * p, ['#fde047', '#fb923c'], 1, 600, 0.2, 0.25 * p, Math.PI / 2 + 0.2, 0.5);
    if (air && !this.thrust && this.state === 'play' && Math.random() < dt * 10) this.puff('puff' + 4 * rnd6(), this.dist - 0.4, this.y - 0.1, 0.35, 0.5, -2, -0.5);
  }
  // the hover-dolly: toon-rendered inspection cart (hazard stripes, push handle with beacon) with two thrusters underneath
  dolly(ctx, x, y, p, fire, rot = 0) {
    ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot);
    if (fire) for (const nx of [-0.52, 0.52]) { const L = (1.0 + Math.random() * 0.5) * p; this.spr(ctx, 'muzzle_02', nx * p, 0.05 * p, L, { ay: 0, w: 0.5 * p, rot: Math.PI, add: true }); this.spr(ctx, 'muzzle_04', nx * p, 0.05 * p, L * 0.6, { ay: 0, w: 0.3 * p, rot: Math.PI, add: true }); }
    this.spr(ctx, 'd_dolly', -0.15 * p, 0.12 * p, 2.1 * p); if (this.hi() && ((this.t * 3) | 0) % 2) this.spr(ctx, 'light_02', -1.0 * p, -1.85 * p, 0.8 * p, { ay: 0.5, add: true, a: 0.5 });
    ctx.restore();
  }
  seedPack(ctx, x, y, p) { // canvas sack with labelled seed pouches sticking out
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = INK; ctx.lineWidth = 0.05 * p; ctx.lineJoin = 'round';
    for (const [ox, oy, r] of [[-0.12, -0.42, -0.25], [0.04, -0.47, 0.05], [0.16, -0.4, 0.3]]) { ctx.save(); ctx.translate(ox * p, oy * p); ctx.rotate(r); ctx.fillStyle = '#f8fafc'; roundRect(ctx, -0.08 * p, -0.14 * p, 0.16 * p, 0.28 * p, 0.03 * p); ctx.fill(); ctx.stroke(); ctx.restore(); this.spr(ctx, 'leaf', ox * p, oy * p + 0.05 * p, 0.13 * p); }
    ctx.fillStyle = '#b45309'; roundRect(ctx, -0.28 * p, -0.38 * p, 0.56 * p, 0.74 * p, 0.14 * p); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#d97706'; roundRect(ctx, -0.2 * p, -0.3 * p, 0.4 * p, 0.3 * p, 0.08 * p); ctx.fill();
    ctx.fillStyle = '#78350f'; ctx.fillRect(-0.26 * p, 0.02 * p, 0.52 * p, 0.07 * p); ctx.restore();
  }
  vehicleArt(ctx, x, y, p, V) {
    ctx.save(); ctx.translate(x, y); ctx.scale(1.3, 1.3); ctx.translate(-x, -y); this.vehicleArt1(ctx, x, y, p, V); ctx.restore();
  }
  vehicleArt1(ctx, x, y, p, V) { // toon-rendered vehicles (models.json); Cash rides on top
    const T = this.t, play = this.state === 'play', puffs = (n, ox, oy, sz, vx, vy) => { if (play && Math.random() < n) this.puff('puff' + 4 * rnd6(), this.dist + ox, this.y + oy, sz, 1.0, vx, vy, { tint: 1 }); };
    switch (V.k) {
      case 'blunt': this.spr(ctx, 'v_blunt', x + 0.2 * p, y + 0.05 * p, 0.9 * p); if (this.hi()) this.spr(ctx, 'light_03', x + 1.55 * p, y - 0.4 * p, 1.2 * p, { ay: 0.5, add: true, a: 0.6 }); puffs(0.3, 1.4, 0.5, 0.5, -this.v * 0.15, 1.6);
        this.cash(ctx, 'idle' + ((T * 10 | 0) % 10), x - 0.1 * p, y - 0.72 * p, 0.95); break;
      case 'walker': { const up = V.grip > 0, gait = up ? 0 : this.dist * 2.2; ctx.save(); ctx.translate(x, up ? y - HERO_H * p : y); if (up) ctx.scale(1, -1);
        ctx.strokeStyle = INK; ctx.lineCap = 'round'; for (let i = 0; i < 4; i++) { const hx = (-0.6 + i * 0.4) * p, ph = gait + i * Math.PI / 2, kx = hx + Math.cos(ph) * 0.2 * p, fx = hx + Math.sin(ph) * 0.28 * p, fy = -0.02 * p - Math.max(0, Math.sin(ph)) * 0.14 * p;
          for (const [lw, c] of [[0.24 * p, INK], [0.14 * p, '#facc15']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(hx, -0.75 * p); ctx.lineTo(kx + 0.14 * p, -0.4 * p); ctx.lineTo(fx, fy); ctx.stroke(); } }
        this.spr(ctx, 'v_walker', 0, -0.55 * p, 1.6 * p); ctx.restore(); this.cash(ctx, 'jump2', x - 0.1 * p, up ? y - 0.1 * p : y - 1.95 * p, 0.85); break; }
      case 'glider': this.cash(ctx, 'jump5', x, y + 0.05 * p, 0.95); ctx.save(); ctx.translate(x, y - 1.2 * p); ctx.rotate(clamp(-this.vy * 0.05, -0.35, 0.35)); this.spr(ctx, 'v_glider', 0, 0.2 * p, 2.3 * p); ctx.restore();
        if (play && Math.random() < 0.4) this.puff('star_06', this.dist + (Math.random() - 0.6) * 2, this.y + 1.6 + Math.random() * 0.5, 0.35, 0.5, -2, 0); break;
      case 'sled': this.spr(ctx, 'muzzle_02', x - 1.1 * p, y - 0.5 * p, (1.0 + Math.random() * 0.4) * p, { ay: 0, w: 0.55 * p, rot: Math.PI / 2, add: true }); this.spr(ctx, 'v_sled', x + 0.1 * p, y + 0.05 * p, 1.05 * p); this.cash(ctx, 'idle0', x - 0.05 * p, y - 0.75 * p, 0.85); break;
      case 'bong': this.spr(ctx, 'v_bong', x, y + 0.05 * p, 2.3 * p); this.cash(ctx, 'idle' + ((T * 10 | 0) % 10), x - 0.15 * p, y - 2.15 * p, 0.85); break;
      case 'cannon': this.spr(ctx, 'v_cannon', x, y + 0.05 * p, 1.7 * p); this.cash(ctx, 'idle0', x - 0.25 * p, y - 1.45 * p, 0.8); break;
      case 'board': if (this.hi()) this.spr(ctx, 'magic_05', x, y + 0.1 * p, 1.2 * p, { ay: 0.5, w: 2.6 * p, add: true, a: 0.6 }); this.spr(ctx, 'v_board', x, y + 0.08 * p, 0.55 * p); this.cash(ctx, 'idle' + ((T * 10 | 0) % 10), x, y - 0.3 * p, 0.95); break;
    }
  }
  // ---------- HUD ----------
  panel(ctx, x, y, w, h, r = 14) { roundRect(ctx, x, y, w, h, r); ctx.fillStyle = 'rgba(15,23,42,.62)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1; ctx.stroke(); }
  render(ctx) {
    const W = this.W, H = this.H; if (this.state === 'ready') { if (this.portrait) this.text(ctx, 'Turn your phone sideways for full screen', W / 2, Math.min(H - 24, this.floorY + 1.6 * this.ppm), { size: 13, color: '#e2e8f0', align: 'center', font: 'Exo' }); return; }
    // distance (the score) top centre, nugs top right, missions top left
    const cx = W / 2, py = this.portrait ? Math.max(10, this.ceilY - 0.8 * this.ppm - 172) : 10;
    this.panel(ctx, cx - 92, py, 184, 56, 16); this.text(ctx, fmt(Math.floor(this._died ? this.deathDist : this.dist)) + ' m', cx, py + 37, { size: 28, weight: 900, color: '#fff', align: 'center' });
    this.text(ctx, 'BEST ' + fmt(Math.max(this.best || 0, this.score || 0)), cx, py + 72, { size: 10, color: '#fde68a', align: 'center', font: 'Exo' });
    this.panel(ctx, W - 104, py, 92, 36, 14); this.spr(ctx, 'gem_green', W - 84, py + 18, 20, { ay: 0.5 }); this.text(ctx, fmt(this.coins), W - 66, py + 25, { size: 16, weight: 900, color: '#bbf7d0' });
    const my = this.portrait ? py + 86 : py, mw = this.portrait ? W - 20 : Math.min(250, cx - 112), showM = this.portrait || this.playT < 6 || this.playT - (this.mT || -9) < 3;
    this.mA = lerp(this.mA == null ? 1 : this.mA, showM ? 1 : 0, Math.min(1, (this._dt || 0) * 6)); if (this.mA < 0.02) return this.hudTail(ctx, cx);
    ctx.globalAlpha = this.mA; this.panel(ctx, 10, my, mw, 70, 14);
    this.ms.forEach((m, i) => { const y = my + 19 + i * 20; ctx.fillStyle = m.done ? '#4ade80' : 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.arc(24, y - 4, 6, 0, TAU); ctx.fill();
      this.text(ctx, m.txt, 36, y, { size: 11, color: m.done ? '#bbf7d0' : '#e2e8f0', font: 'Exo' }); this.text(ctx, m.done ? 'DONE' : `${m.have}/${m.n}`, 10 + mw - 12, y, { size: 11, weight: 800, color: m.done ? '#4ade80' : '#fde68a', align: 'right', font: 'Exo' }); });
    ctx.globalAlpha = 1; this.hudTail(ctx, cx);
  }
  hudTail(ctx, cx) {
    if (this.flash && this.flash.t > 0) { if (this.state === 'play') this.flash.t -= this._dt || 0; const a = Math.min(1, this.flash.t * 2), y = this.ceilY + 2.8 * this.ppm; ctx.globalAlpha = a; this.text(ctx, this.flash.name, cx, y, { size: 24, weight: 900, color: '#fde047', align: 'center', glow: '#f59e0b' }); this.text(ctx, this.flash.hint, cx, y + 28, { size: 14, color: '#fff', align: 'center', font: 'Exo' }); ctx.globalAlpha = 1; }
    if (this.state === 'play' && this.playT < 4) { const y = this.ceilY + CH * this.ppm * 0.42; ctx.globalAlpha = 0.75 * Math.min(1, 4 - this.playT); this.text(ctx, 'HOLD TO FLY', cx, y, { size: 24, color: '#fff', align: 'center', glow: '#22c55e' }); this.text(ctx, 'let go to fall', cx, y + 30, { size: 14, color: '#f1f5f9', align: 'center', font: 'Exo' }); ctx.globalAlpha = 1; }
  }
}

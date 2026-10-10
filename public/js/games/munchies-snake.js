// Neon Munchies (id munchies-snake) - v7: a true infinite snake arena (original code and art).
// Slither-style: a huge circular arena, the snake follows your finger, grows by eating, and AI rival snakes roam, hunt food and
// try to cut you off. A rival whose head hits your body bursts into glowing orbs for you; your head hitting a rival or the wall
// ends the run. No win state: rivals keep respawning and get bigger over time, so the score can climb forever.
// Snacks are Blender Cycles renders (original models, PBR, HDRI); snakes are drawn as continuous glossy tubes with scale bands.
import { Game, TAU, rnd, clamp, lerp, fmt, loadAtlas, sprC, softShadow, reducedMotion } from './engine.js';
const ARENA = 1700, SEG = 9, CELL = 120;
const SNACKS = ['donut', 'cookie', 'pizza'];
const SKINS = [['#22d3ee', '#ec4899', '#7c3aed'], ['#fde047', '#f97316', '#dc2626'], ['#a3e635', '#10b981', '#065f46'], ['#f0abfc', '#a855f7', '#4c1d95'], ['#93c5fd', '#3b82f6', '#1e3a8a'], ['#fca5a5', '#ef4444', '#7f1d1d'], ['#fef08a', '#84cc16', '#365314']];
const NAMES = ['Zig', 'Noodle', 'Viper', 'Mamba', 'Slinky', 'Coil', 'Fang', 'Hiss', 'Glowworm', 'Twister', 'Ribbon', 'Sidewinder'];
const glowDot = (col, r) => { const c = document.createElement('canvas'); c.width = c.height = r * 4; const g = c.getContext('2d'); const gr = g.createRadialGradient(r * 2, r * 2, 0, r * 2, r * 2, r * 2); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(0.6, col + '55'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, r * 4, r * 4); return c; };
const PCOL = ['#22d3ee', '#f472b6', '#a3e635', '#fde047', '#c084fc', '#fb923c'];
export class MunchiesSnake extends Game {
  get title() { return 'NEON MUNCHIES'; }
  get hint() { return 'Drag anywhere to steer; the snake follows your finger. Hold a second finger or Space to boost. Eat to grow, and make rival snakes crash into your body to steal their glow. Avoid rival bodies and the arena wall.'; }
  async load() { this.A = await loadAtlas('/assets/v7/snacks'); }
  layout() { }
  reset() {
    this.score = 0; this.coins = 0; this.kills = 0; this.dead = 0; this.boostKey = false; this.ptr = null; this.ptrs = {}; this.magnet = 0; this.nextCoin = 1000;
    this.dots = PCOL.map(c => glowDot(c, 8)); this.food = []; this.snakes = [];
    this.player = this.makeSnake(0, 0, this.r() * TAU, 16, 0, true); this.snakes.push(this.player);
    for (let i = 0; i < 480; i++) this.spawnFood(); for (let i = 0; i < 22; i++) this.spawnSnack(); this.gold = 0;
    for (let i = 0; i < 6; i++) this.spawnRival(); this.cam = { x: 0, y: 0, z: 1 }; this.respawnT = 0;
    // old field names kept for tests and tools
    this.body = this.player.pts; this.q = []; this.dir = 0;
  }
  makeSnake(x, y, a, len, skin, me = false) { const pts = []; for (let i = 0; i < len; i++) pts.push([x - Math.cos(a) * i * SEG, y - Math.sin(a) * i * SEG]); return { pts, a, len, mass: len * 1.0, skin: SKINS[skin % SKINS.length], me, alive: true, boost: false, ai: { t: 0, target: null, agg: this.r() }, name: me ? 'YOU' : NAMES[Math.floor(this.r() * NAMES.length)], drop: 0 }; }
  width(s) { return 18 + Math.min(26, Math.sqrt(s.len) * 1.5); }
  randIn(r = ARENA - 60) { const a = this.r() * TAU, d = Math.sqrt(this.r()) * r; return [Math.cos(a) * d, Math.sin(a) * d]; }
  spawnFood(x, y, v = 10, m = 1, c) { if (x === undefined) [x, y] = this.randIn(); this.food.push({ x, y, v, m, c: c ?? Math.floor(this.r() * PCOL.length), k: 'p', ph: this.r() * TAU }); }
  spawnSnack(kind) { const [x, y] = this.randIn(); const k = kind || SNACKS[Math.floor(this.r() * 3)]; this.food.push({ x, y, v: k === 'brownie' ? 250 : k === 'mint' ? 50 : 50, m: k === 'brownie' ? 10 : 4, k, ph: this.r() * TAU }); }
  spawnRival() {
    const p = this.player.pts[0]; let x, y; for (let k = 0; k < 30; k++) { [x, y] = this.randIn(ARENA - 200); if (Math.hypot(x - p[0], y - p[1]) > 650) break; }
    const t = this.playT || 0; const len = Math.floor(12 + this.r() * 18 + t / 5 + (this.r() < 0.25 ? t / 3 : 0)); this.snakes.push(this.makeSnake(x, y, this.r() * TAU, Math.min(len, 260), 1 + Math.floor(this.r() * 6)));
  }
  // ---- input: steer toward the finger (relative to the head on screen); a second finger or Space boosts
  onDown(x, y, e) { this.ptrs[e.pointerId] = [x, y]; this.ptr = [x, y]; }
  onMove(x, y, e) { if (this.ptrs[e.pointerId]) { this.ptrs[e.pointerId] = [x, y]; this.ptr = [x, y]; } }
  onUp(x, y, e) { delete this.ptrs[e.pointerId]; }
  onKey(code, down) { if (code === 'Space' || code === 'ShiftLeft') this.boostKey = down; if (code === 'ArrowLeft' || code === 'KeyA') this.kL = down; if (code === 'ArrowRight' || code === 'KeyD') this.kR = down;
    const m = { ArrowUp: -Math.PI / 2, KeyW: -Math.PI / 2, ArrowDown: Math.PI / 2, KeyS: Math.PI / 2 }[code]; if (down && m !== undefined) this.kAim = m; }
  // ---- simulation
  grid() { const G = new Map(); for (const s of this.snakes) { if (!s.alive) continue; for (let i = 3; i < s.pts.length; i += 2) { const p = s.pts[i]; const k = Math.floor(p[0] / CELL) + ',' + Math.floor(p[1] / CELL); let b = G.get(k); if (!b) G.set(k, b = []); b.push(s, p); } } return G; }
  hitsBody(s, G, x, y, r) { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = G.get((cx + i) + ',' + (cy + j)); if (!b) continue; for (let k = 0; k < b.length; k += 2) { const o = b[k]; if (o === s) continue; const p = b[k + 1]; const rr = r + this.width(o) * 0.5; if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < rr * rr) return o; } } return null; }
  steerAI(s, G, dt) {
    const h = s.pts[0], ai = s.ai; ai.t -= dt; const P = this.player.pts[0];
    if (ai.t <= 0) { ai.t = 0.25 + this.r() * 0.35; let best = null, bd = 1e9;
      for (const f of this.food) { const d = (f.x - h[0]) ** 2 + (f.y - h[1]) ** 2 - (f.v > 10 ? 60000 : 0); if (d < bd && d < 400 * 400) { bd = d; best = f; } }
      const dp = Math.hypot(P[0] - h[0], P[1] - h[1]);
      if (this.player.alive && dp < 420 && s.len > this.player.len * 0.7 && ai.agg > 0.45) ai.target = [P[0] + Math.cos(this.player.a) * 150, P[1] + Math.sin(this.player.a) * 150]; // try to cut you off
      else ai.target = best ? [best.x, best.y] : this.randIn(ARENA * 0.7);
      s.boost = this.player.alive && dp < 300 && ai.agg > 0.7 && s.len > 25; }
    let want = Math.atan2(ai.target[1] - h[1], ai.target[0] - h[0]);
    const dc = Math.hypot(h[0], h[1]); if (dc > ARENA - 220) want = Math.atan2(-h[1], -h[0]);
    // look ahead and dodge bodies
    for (const off of [0, 0.5, -0.5]) { const a = s.a + off, la = 60 + this.width(s); if (this.hitsBody(s, G, h[0] + Math.cos(a) * la, h[1] + Math.sin(a) * la, this.width(s) * 0.5)) { want = s.a + (off >= 0 ? -1.4 : 1.4); break; } }
    return want;
  }
  update(dt) {
    if (this.dead) { this.dead -= dt; this.zoomTo(dt); if (this.dead <= 0) this.finish(); return; }
    if (this.magnet > 0) this.magnet -= dt; const G = this.grid(); const pl = this.player;
    // player steering target
    let want = pl.a; const h = pl.pts[0];
    if (this.ptr) { const sx = (h[0] - this.cam.x) * this.cam.z + this.W / 2, sy = (h[1] - this.cam.y) * this.cam.z + this.H / 2; if (Math.hypot(this.ptr[0] - sx, this.ptr[1] - sy) > 12) want = Math.atan2(this.ptr[1] - sy, this.ptr[0] - sx); }
    if (this.kL) want = pl.a - 1; if (this.kR) want = pl.a + 1; if (this.kAim !== undefined && !this.kL && !this.kR) { want = this.kAim; }
    pl.boost = (this.boostKey || Object.keys(this.ptrs).length >= 2) && pl.len > 14;
    for (const s of this.snakes) { if (!s.alive) continue; const w = s.me ? want : this.steerAI(s, G, dt); this.move(s, w, dt); }
    // collisions
    for (const s of this.snakes) { if (!s.alive) continue; const hd = s.pts[0]; const r = this.width(s) * 0.42;
      if (Math.hypot(hd[0], hd[1]) > ARENA - r) { this.kill(s, null); continue; }
      const o = this.hitsBody(s, G, hd[0], hd[1], r); if (o) this.kill(s, o); }
    // eat
    for (const s of this.snakes) { if (!s.alive) continue; const hd = s.pts[0]; const rr = this.width(s) * 0.5 + 16; const mag = s.me && this.magnet > 0 ? 160 : 0;
      for (const f of this.food) { if (f.gone) continue; const dx = f.x - hd[0], dy = f.y - hd[1]; const d2 = dx * dx + dy * dy;
        if (mag && d2 < (rr + mag) ** 2) { const d = Math.sqrt(d2) || 1; f.x -= dx / d * 420 * dt; f.y -= dy / d * 420 * dt; }
        if (d2 < rr * rr) { f.gone = true; s.mass += f.m; if (s.me) this.eat(f); } } }
    const before = this.food.length; this.food = this.food.filter(f => !f.gone);
    let np = 0; for (const f of this.food) if (f.k === 'p') np++; while (np++ < 480) this.spawnFood();
    const snacks = this.food.filter(f => f.k !== 'p'); if (snacks.length < 22) this.spawnSnack(this.r() < 0.12 ? 'mint' : null);
    if (!this.food.some(f => f.k === 'brownie') && this.r() < dt / 12) this.spawnSnack('brownie');
    for (const s of this.snakes) s.len = Math.max(8, Math.floor(s.mass));
    this.snakes = this.snakes.filter(s => s.alive);
    this.respawnT -= dt; const want2 = 6 + Math.min(8, Math.floor((this.playT || 0) / 30));
    if (this.snakes.length - 1 < want2 && this.respawnT <= 0) { this.spawnRival(); this.respawnT = 2.5; }
    this.zoomTo(dt);
    if (this.score >= this.nextCoin) { this.coins++; this.nextCoin += 1000; }
    this.body = pl.pts;
  }
  move(s, want, dt) {
    let d = ((want - s.a + Math.PI) % TAU + TAU) % TAU - Math.PI; const turn = (s.me ? 5.2 : 3.6) / (1 + s.len / 180); s.a += clamp(d, -turn * dt, turn * dt);
    const sp = (s.boost ? 330 : 185) * (s.me ? 1 : 0.92); const h = s.pts[0]; const nx = h[0] + Math.cos(s.a) * sp * dt, ny = h[1] + Math.sin(s.a) * sp * dt;
    // keep points SEG apart: add a new head point when far enough, trim the tail to length
    if (Math.hypot(nx - s.pts[1][0], ny - s.pts[1][1]) >= SEG) s.pts.unshift([nx, ny]); else s.pts[0] = [nx, ny];
    while (s.pts.length > s.len) s.pts.pop();
    if (s.boost) { s.drop += dt; if (s.drop > 0.14) { s.drop = 0; s.mass -= 1; const t = s.pts[s.pts.length - 1]; this.spawnFood(t[0], t[1], 10, 0.8); } }
  }
  eat(f) { this.award(f.v, 'f'); const hd = this.player.pts[0];
    if (f.k === 'p') { if (this.r() < 0.25) this.sfx.tone(700 + this.r() * 300, 0.04, { type: 'sine', vol: 0.12 }); }
    else { const [sx, sy] = this.toScreen(hd[0], hd[1]); this.pop(sx, sy - 24, f.k === 'brownie' ? '+250 GOLDEN' : f.k === 'mint' ? 'MAGNET' : '+' + f.v, f.k === 'brownie' ? '#fbbf24' : f.k === 'mint' ? '#67e8f9' : '#a3e635', f.k === 'brownie' ? 24 : 18);
      this.burst(sx, sy, f.k === 'brownie' ? ['#fbbf24', '#fde68a'] : ['#f9a8d4', '#fcd34d', '#fb923c'], 12, 160, 0.45, 4); this.sfx.tone(f.k === 'brownie' ? 990 : 620, 0.1, { type: 'triangle', vol: 0.28 }); if (f.k === 'mint') this.magnet = 6; if (f.k === 'brownie') this.coins++; } }
  kill(s, by) {
    if (!s.alive) return; s.alive = false;
    for (let i = 0; i < s.pts.length; i += 2) { const p = s.pts[i]; this.spawnFood(p[0] + rnd(-6, 6), p[1] + rnd(-6, 6), 20, 1.6, s.me ? 1 : PCOL.indexOf(s.skin[0]) >= 0 ? PCOL.indexOf(s.skin[0]) : Math.floor(this.r() * PCOL.length)); }
    const [sx, sy] = this.toScreen(s.pts[0][0], s.pts[0][1]);
    if (s.me) { this.dead = 1.4; this.sfx.lose(); this.burst(sx, sy, s.skin, 40, 320, 0.8, 6); return; }
    if (by === this.player) { this.kills++; this.pop(sx, sy - 20, `CUT OFF ${s.name}!`, '#fde047', 22); this.sfx.chord([523, 784, 1047], 0.18, { type: 'triangle', vol: 0.3 }); }
    if (Math.abs(sx - this.W / 2) < this.W && Math.abs(sy - this.H / 2) < this.H) this.burst(sx, sy, s.skin, 18, 240, 0.6, 5);
  }
  zoomTo(dt) { const h = this.player.pts[0]; const z = clamp(1.25 - Math.sqrt(this.player.len) * 0.025, 0.6, 1.15); this.cam.x = lerp(this.cam.x, h[0], Math.min(1, dt * 6)); this.cam.y = lerp(this.cam.y, h[1], Math.min(1, dt * 6)); this.cam.z = lerp(this.cam.z, z, Math.min(1, dt)); }
  toScreen(x, y) { return [(x - this.cam.x) * this.cam.z + this.W / 2, (y - this.cam.y) * this.cam.z + this.H / 2]; }
  floor() { // pre-rendered hex floor tile (dark glass with faint neon seams)
    if (this._floor) return this._floor; const s = 28, w = Math.sqrt(3) * s, c = document.createElement('canvas'); c.width = Math.round(w * 2); c.height = Math.round(s * 3); const g = c.getContext('2d');
    g.fillStyle = '#070912'; g.fillRect(0, 0, c.width, c.height);
    const hex = (cx, cy) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(cx + Math.cos(a) * (s - 1.5), cy + Math.sin(a) * (s - 1.5)); } g.closePath(); const gr = g.createLinearGradient(cx - s, cy - s, cx + s, cy + s); gr.addColorStop(0, '#171c38'); gr.addColorStop(1, '#0b0d1c'); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(129,140,248,0.32)'; g.lineWidth = 1; g.stroke(); };
    for (const [x, y] of [[0, 0], [w, 0], [w * 2, 0], [w / 2, s * 1.5], [w * 1.5, s * 1.5], [0, s * 3], [w, s * 3], [w * 2, s * 3]]) hex(x, y);
    return (this._floor = c);
  }
  drawSnake(ctx, s) {
    const z = this.cam.z, P = s.pts; const n = P.length; if (n < 2) return; const W = this.width(s) * z;
    const x0 = this.cam.x - this.W / 2 / z - 60, x1 = this.cam.x + this.W / 2 / z + 60, y0 = this.cam.y - this.H / 2 / z - 60, y1 = this.cam.y + this.H / 2 / z + 60;
    if (!P.some((p, i) => i % 6 === 0 && p[0] > x0 && p[0] < x1 && p[1] > y0 && p[1] < y1)) return;
    const path = () => { ctx.beginPath(); const [ax, ay] = this.toScreen(P[n - 1][0], P[n - 1][1]); ctx.moveTo(ax, ay); for (let i = n - 2; i >= 0; i--) { const [bx, by] = this.toScreen(P[i][0], P[i][1]); ctx.lineTo(bx, by); } };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.save(); ctx.translate(3, 5); path(); ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = W; ctx.stroke(); ctx.restore();
    path(); ctx.strokeStyle = s.skin[2]; ctx.lineWidth = W * 1.06; ctx.stroke();
    const [hx, hy] = this.toScreen(P[0][0], P[0][1]), [tx, ty] = this.toScreen(P[n - 1][0], P[n - 1][1]);
    const g = ctx.createLinearGradient(tx, ty, hx, hy); g.addColorStop(0, s.skin[2]); g.addColorStop(0.5, s.skin[1]); g.addColorStop(1, s.skin[0]);
    if (s.boost || s.me) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = s.boost ? 0.35 : 0.16; path(); ctx.strokeStyle = s.skin[0]; ctx.lineWidth = W * 1.7; ctx.stroke(); ctx.restore(); }
    path(); ctx.strokeStyle = g; ctx.lineWidth = W * 0.86; ctx.stroke();
    ctx.save(); path(); ctx.setLineDash([2.5 * z, W * 0.42]); ctx.strokeStyle = 'rgba(10,0,30,0.35)'; ctx.lineWidth = W * 0.78; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(-W * 0.12, -W * 0.16); path(); ctx.strokeStyle = 'rgba(255,255,255,0.36)'; ctx.lineWidth = W * 0.2; ctx.stroke(); ctx.restore();
    // head with eyes that look where it is going
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(s.a); const r = W * 0.58;
    const hg = ctx.createRadialGradient(-r * 0.2, -r * 0.3, 1, 0, 0, r * 1.2); hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.25, s.skin[0]); hg.addColorStop(1, s.skin[1]);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(r * 0.15, 0, r * 1.05, r * 0.92, 0, 0, TAU); ctx.fill();
    for (const k of [-1, 1]) { const ex = r * 0.45, ey = k * r * 0.45; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, ey, r * 0.34, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(ex + r * 0.12, ey, r * 0.18, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + r * 0.06, ey - r * 0.08, r * 0.06, 0, TAU); ctx.fill(); }
    ctx.restore();
    if (!s.me && z > 0.6) this.text(ctx, s.name, hx, hy - W - 6, { size: 11, weight: 700, align: 'center', color: 'rgba(255,255,255,0.65)', font: 'Exo' });
  }
  render(ctx) {
    const W = this.W, H = this.H, z = this.cam.z; const F = this.floor();
    ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, W, H);
    // floor pattern locked to world coords (parallax-free, so it reads as the ground)
    ctx.save(); const [ox, oy] = this.toScreen(0, 0); ctx.beginPath(); ctx.arc(ox, oy, ARENA * z, 0, TAU); ctx.clip(); ctx.translate(ox, oy); ctx.scale(z, z); if (!this._pat) this._pat = ctx.createPattern(F, 'repeat'); ctx.fillStyle = this._pat; const vx = this.cam.x - W / 2 / z, vy = this.cam.y - H / 2 / z; ctx.fillRect(vx - 60, vy - 60, W / z + 120, H / z + 120); ctx.restore();
    // vignette light pool around the player
    const [px, py] = this.toScreen(this.player.pts[0][0], this.player.pts[0][1]); const lg = ctx.createRadialGradient(px, py, 20, px, py, Math.max(W, H) * 0.7); lg.addColorStop(0, 'rgba(124,77,255,0.10)'); lg.addColorStop(1, 'rgba(0,0,0,0.45)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    // arena wall
    ctx.save(); ctx.strokeStyle = 'rgba(255,79,216,0.25)'; ctx.lineWidth = 26 * z; ctx.beginPath(); ctx.arc(ox, oy, ARENA * z, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ff7ae6'; ctx.lineWidth = 5 * z; ctx.stroke(); ctx.restore();
    // food
    const t = this.t; const x0 = -30, x1 = W + 30, y0 = -30, y1 = H + 30;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const f of this.food) { if (f.k !== 'p') continue; const [sx, sy] = this.toScreen(f.x, f.y); if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue; const s = (f.v > 10 ? 26 : 19) * z * (1 + 0.15 * Math.sin(t * 4 + f.ph)); ctx.drawImage(this.dots[f.c], sx - s, sy - s, s * 2, s * 2); }
    ctx.restore();
    for (const f of this.food) { if (f.k === 'p') continue; const [sx, sy] = this.toScreen(f.x, f.y); if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue; const s = (f.k === 'brownie' ? 58 : 48) * z; const b = Math.sin(t * 3 + f.ph) * 3 * z;
      if (f.k === 'brownie' || f.k === 'mint') { const gg = ctx.createRadialGradient(sx, sy, 2, sx, sy, s); gg.addColorStop(0, f.k === 'brownie' ? 'rgba(255,200,60,0.5)' : 'rgba(120,240,255,0.45)'); gg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = gg; ctx.fillRect(sx - s, sy - s, s * 2, s * 2); }
      softShadow(ctx, sx + 2, sy + s * 0.3, s * 0.45, s * 0.25, 0.6); if (!sprC(ctx, this.A, f.k, sx, sy + b, s)) { ctx.fillStyle = '#f472b6'; ctx.beginPath(); ctx.arc(sx, sy, s * 0.35, 0, TAU); ctx.fill(); } }
    // snakes: rivals first, player on top
    for (const s of this.snakes) if (!s.me) this.drawSnake(ctx, s);
    if (this.player.alive) this.drawSnake(ctx, this.player);
    if (this.magnet > 0) { ctx.strokeStyle = `rgba(103,232,249,${0.25 + 0.15 * Math.sin(t * 8)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 160 * z, 0, TAU); ctx.stroke(); }
    // HUD
    this.hudScore(ctx);
    this.text(ctx, 'LENGTH', W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, fmt(this.player.len), W - 18, 62, { size: 28, weight: 900, align: 'right', glow: '#22d3ee' });
    this.text(ctx, `CUT OFFS ${this.kills}`, W - 18, 82, { size: 12, weight: 700, align: 'right', color: '#fde047', font: 'Exo' });
    // minimap
    const mr = 34, mx = W - mr - 14, my = H - mr - 14; ctx.fillStyle = 'rgba(10,12,30,0.65)'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,79,216,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    for (const s of this.snakes) { const h = s.pts[0]; ctx.fillStyle = s.me ? '#fff' : s.skin[1]; ctx.beginPath(); ctx.arc(mx + h[0] / ARENA * mr, my + h[1] / ARENA * mr, s.me ? 3 : 2, 0, TAU); ctx.fill(); }
    if (this.state === 'play' && this.playT < 4) this.text(ctx, 'DRAG TO STEER  •  2 FINGERS / SPACE TO BOOST', W / 2, H - 70, { size: 12, weight: 800, align: 'center', color: '#c4b5fd' });
  }
}

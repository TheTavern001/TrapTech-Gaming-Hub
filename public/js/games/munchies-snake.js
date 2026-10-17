// Neon Munchies v8 - fully rebuilt. Endless round arena, you vs. AI rival snakes (original code; Kenney Donuts CC0 snacks; procedural WebAudio).
// New in v8: ring-buffer snake bodies on a spatial hash, three rival personalities (forager / hunter / coward) that scale up over time,
// boost with a visible energy cost, a thumb boost button for portrait, orbit-magnet golden donuts, cut-off bounties and a live rank readout.
// Scoring contract unchanged (src/ac-levels.js): every point is a food event worth 10 / 20 / 50 / 250.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, loadPack, spr, halo, bake, roundRect } from './kit.js';
const R_ARENA = 1450, SEG = 9, CELL = 110;
const COL = ['#22d3ee', '#f472b6', '#a3e635', '#fde047', '#c084fc', '#fb923c'];
const SKINS = [['#22d3ee', '#6d28d9'], ['#fde047', '#ea580c'], ['#a3e635', '#047857'], ['#f0abfc', '#7e22ce'], ['#93c5fd', '#1d4ed8'], ['#fca5a5', '#b91c1c'], ['#fef08a', '#4d7c0f']];
const NAMES = ['Zig', 'Noodle', 'Viper', 'Mamba', 'Slinky', 'Coil', 'Fang', 'Hiss', 'Glowworm', 'Twister', 'Ribbon', 'Sidewinder', 'Bolt', 'Pixel'];
export class MunchiesSnake extends Game8 {
  get title() { return 'NEON MUNCHIES'; }
  get hint() { return 'Drag to steer, the snake chases your finger. Hold the BOOST button (or a second finger / Space) to sprint at the cost of length. Eat orbs and donuts to grow, make rivals crash into your body, and stay clear of rival bodies and the wall.'; }
  get accent() { return '#22d3ee'; }
  get musicOpts() { return { root: 55, bpm: 118, mode: 'minor', seed: 5, vol: 0.28 }; }
  async load() { this.P = await loadPack('snack'); }
  layout() { this.btn = { x: 58, y: this.H - 70, r: 38 }; this.bg = null; }
  reset() {
    super.reset(); this.layout(); this.score = 0; this.coins = 0; this.kills = 0; this.nextCoin = 1000; this.boost = false; this.btnDown = false; this.ptr = null; this.ptrs = new Map(); this.kBoost = false; this.magnet = 0;
    this.food = []; this.snakes = []; this.you = this.mk(0, 0, this.r() * TAU, 14, 0, true); this.snakes.push(this.you); this.cam = { x: 0, y: 0, z: 1 }; this.respawn = 0;
    for (let i = 0; i < 380; i++) this.orb(); for (let i = 0; i < 14; i++) this.donut(); for (let i = 0; i < 5; i++) this.rival();
  }
  mk(x, y, a, len, skin, me = false) { const pts = []; for (let i = 0; i < len; i++) pts.push([x - Math.cos(a) * i * SEG, y - Math.sin(a) * i * SEG]); return { pts, a, mass: len, len, sk: SKINS[skin % SKINS.length], me, alive: true, boost: false, drop: 0, name: me ? 'YOU' : NAMES[Math.floor(this.r() * NAMES.length)], ai: { t: 0, tx: 0, ty: 0, kind: Math.floor(this.r() * 3), want: a } }; }
  wid(s) { return 17 + Math.min(24, Math.sqrt(s.len) * 1.4); }
  rin(rad = R_ARENA - 50) { const a = this.r() * TAU, d = Math.sqrt(this.r()) * rad; return [Math.cos(a) * d, Math.sin(a) * d]; }
  orb(x, y, v = 10, m = 1) { if (x === undefined) [x, y] = this.rin(); this.food.push({ x, y, v, m, c: Math.floor(this.r() * COL.length), k: 'o', ph: this.r() * TAU }); }
  donut() { const [x, y] = this.rin(); this.food.push({ x, y, v: 50, m: 4, k: 'dn' + (1 + Math.floor(this.r() * 3)), ph: this.r() * TAU }); }
  rival() {
    const me = this.you.pts[0]; let x, y; for (let i = 0; i < 30; i++) { [x, y] = this.rin(R_ARENA - 200); if (Math.hypot(x - me[0], y - me[1]) > 700) break; }
    const T = this.playT || 0, len = Math.min(280, Math.floor(12 + this.r() * 16 + T / 4 + (this.r() < 0.2 ? T / 2.5 : 0))); this.snakes.push(this.mk(x, y, this.r() * TAU, len, 1 + Math.floor(this.r() * 6)));
  }
  // input: drag steers, 2nd finger / button / Space boosts
  inBtn(x, y) { return Math.hypot(x - this.btn.x, y - this.btn.y) < this.btn.r + 14; }
  onDown(x, y, e) { const id = e.pointerId; if (this.inBtn(x, y)) { this.btnDown = true; this.btnId = id; return; } this.ptrs.set(id, [x, y]); this.ptr = [x, y]; }
  onMove(x, y, e) { const id = e.pointerId; if (this.ptrs.has(id)) { this.ptrs.set(id, [x, y]); this.ptr = [x, y]; } }
  onUp(x, y, e) { const id = e.pointerId; if (id === this.btnId) this.btnDown = false; this.ptrs.delete(id); if (!this.ptrs.size) this.ptr = null; }
  onKey(c, d) { if (c === 'Space' || c === 'ShiftLeft') this.kBoost = d; if (c === 'ArrowLeft' || c === 'KeyA') this.kL = d; if (c === 'ArrowRight' || c === 'KeyD') this.kR = d; }
  grid() { const G = new Map(); for (const s of this.snakes) { if (!s.alive) continue; for (let i = 3; i < s.pts.length; i += 2) { const p = s.pts[i], k = ((p[0] / CELL) | 0) * 4096 + ((p[1] / CELL) | 0); let b = G.get(k); if (!b) G.set(k, b = []); b.push(s, p); } } return G; }
  bodyAt(s, G, x, y, r) { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const b = G.get(((cx + i) | 0) * 4096 + ((cy + j) | 0)); if (!b) continue; for (let k = 0; k < b.length; k += 2) { const o = b[k]; if (o === s) continue; const p = b[k + 1], rr = r + this.wid(o) * 0.45; if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < rr * rr) return o; } } return null; }
  think(s, G, dt) {
    const h = s.pts[0], ai = s.ai, me = this.you; ai.t -= dt;
    if (ai.t <= 0) { ai.t = 0.2 + this.r() * 0.3; let best = null, bd = 1e9; for (const f of this.food) { const dx = f.x - h[0], dy = f.y - h[1], d = dx * dx + dy * dy - (f.v > 10 ? 40000 : 0); if (d < bd && d < 380 * 380) { bd = d; best = f; } }
      const dm = Math.hypot(me.pts[0][0] - h[0], me.pts[0][1] - h[1]); s.boost = false;
      if (me.alive && ai.kind === 1 && dm < 460 && s.len > me.len * 0.6) { ai.tx = me.pts[0][0] + Math.cos(me.a) * 170; ai.ty = me.pts[0][1] + Math.sin(me.a) * 170; s.boost = dm < 300 && s.len > 30; }
      else if (me.alive && ai.kind === 2 && dm < 300 && me.len > s.len) { ai.tx = h[0] - (me.pts[0][0] - h[0]); ai.ty = h[1] - (me.pts[0][1] - h[1]); }
      else if (best) { ai.tx = best.x; ai.ty = best.y; } else { [ai.tx, ai.ty] = this.rin(R_ARENA * 0.7); } }
    let want = Math.atan2(ai.ty - h[1], ai.tx - h[0]); if (Math.hypot(h[0], h[1]) > R_ARENA - 230) want = Math.atan2(-h[1], -h[0]);
    for (const off of [0, 0.55, -0.55]) { const a = s.a + off, la = 56 + this.wid(s); if (this.bodyAt(s, G, h[0] + Math.cos(a) * la, h[1] + Math.sin(a) * la, this.wid(s) * 0.4)) { want = s.a + (off >= 0 ? -1.5 : 1.5); break; } }
    return want;
  }
  move(s, want, dt) {
    let d = ((want - s.a + Math.PI) % TAU + TAU) % TAU - Math.PI; const turn = (s.me ? 5.4 : 3.7) / (1 + s.len / 200); s.a += clamp(d, -turn * dt, turn * dt);
    const sp = (s.boost ? 340 : 190) * (s.me ? 1 : 0.93), h = s.pts[0], nx = h[0] + Math.cos(s.a) * sp * dt, ny = h[1] + Math.sin(s.a) * sp * dt;
    if (Math.hypot(nx - s.pts[1][0], ny - s.pts[1][1]) >= SEG) s.pts.unshift([nx, ny]); else s.pts[0] = [nx, ny];
    while (s.pts.length > s.len) s.pts.pop();
    if (s.boost) { s.drop += dt; if (s.drop > 0.13) { s.drop = 0; s.mass -= 1; const t = s.pts[s.pts.length - 1]; this.orb(t[0], t[1], 10, 0.8); if (s.me) this.fx.add({ k: 0, x: this.sx(t[0]), y: this.sy(t[1]), vx: 0, vy: 0, g: 0, life: 0.3, max: 0.3, c: s.sk[0], s: 14 }); } }
  }
  sx(x) { return (x - this.cam.x) * this.cam.z + this.W / 2; } sy(y) { return (y - this.cam.y) * this.cam.z + this.H / 2; }
  eat(f) {
    const v = f.v; this.award(v, 'f'); const [sx, sy] = [this.sx(this.you.pts[0][0]), this.sy(this.you.pts[0][1])];
    if (f.k === 'o') { if (this.r() < 0.3) this.sfx.tone(700 + this.r() * 300, 0.035, { type: 'sine', vol: 0.1 }); return; }
    this.pop(sx, sy - 26, f.k === 'gold' ? '+250 GOLDEN' : '+' + v, f.k === 'gold' ? '#fbbf24' : '#a3e635', f.k === 'gold' ? 24 : 18); this.fx.burst(sx, sy, f.k === 'gold' ? ['#fbbf24', '#fde68a', '#fff'] : ['#f9a8d4', '#fcd34d', '#fb923c'], 12, 220, 0.5, 10);
    this.sfx.tone(f.k === 'gold' ? 990 : 620, 0.1, { type: 'triangle', vol: 0.28 }); if (f.k === 'gold') { this.coins++; this.magnet = 6; this.fx.ring(sx, sy, '#fbbf24', 8, 120, 0.5, 5); this.fx.shake(4); }
  }
  die(s, by) {
    if (!s.alive) return; s.alive = false;
    for (let i = 0; i < s.pts.length; i += 2) { const p = s.pts[i]; this.orb(p[0] + rnd(-6, 6), p[1] + rnd(-6, 6), 20, 1.6); }
    const x = this.sx(s.pts[0][0]), y = this.sy(s.pts[0][1]);
    if (s.me) { this.fx.burst(x, y, s.sk, 40, 360, 0.9, 14); this.fx.ring(x, y, s.sk[0], 10, 160, 0.6, 6); this.kill(1.3, '#22d3ee'); return; }
    if (by === this.you) { this.kills++; this.pop(x, y - 20, `CUT OFF ${s.name}!`, '#fde047', 22); this.sfx.chord([523, 784, 1047], 0.18, { type: 'triangle', vol: 0.3 }); this.fx.shake(7); this.fx.ring(x, y, '#fde047', 8, 100, 0.45, 4); this.hitstop(0.05); }
    if (Math.abs(x - this.W / 2) < this.W && Math.abs(y - this.H / 2) < this.H) this.fx.burst(x, y, s.sk, 18, 260, 0.6, 10);
  }
  update(dt) {
    const you = this.you, G = this.grid(); if (this.magnet > 0) this.magnet -= dt;
    let want = you.a; const h = you.pts[0];
    if (this.ptr) { const sx = this.sx(h[0]), sy = this.sy(h[1]); if (Math.hypot(this.ptr[0] - sx, this.ptr[1] - sy) > 14) want = Math.atan2(this.ptr[1] - sy, this.ptr[0] - sx); }
    if (this.kL) want = you.a - 1; if (this.kR) want = you.a + 1;
    you.boost = (this.btnDown || this.kBoost || this.ptrs.size >= 2) && you.len > 14;
    for (const s of this.snakes) if (s.alive) this.move(s, s.me ? want : this.think(s, G, dt), dt);
    for (const s of this.snakes) { if (!s.alive) continue; const hd = s.pts[0], r = this.wid(s) * 0.4; if (Math.hypot(hd[0], hd[1]) > R_ARENA - r) { this.die(s, null); continue; } const o = this.bodyAt(s, G, hd[0], hd[1], r); if (o) this.die(s, o); }
    for (const s of this.snakes) { if (!s.alive) continue; const hd = s.pts[0], rr = this.wid(s) * 0.5 + 16, mg = s.me && this.magnet > 0 ? 180 : 0;
      for (const f of this.food) { if (f.gone) continue; const dx = f.x - hd[0], dy = f.y - hd[1], d2 = dx * dx + dy * dy; if (mg && d2 < (rr + mg) ** 2) { const d = Math.sqrt(d2) || 1; f.x -= dx / d * 460 * dt; f.y -= dy / d * 460 * dt; } if (d2 < rr * rr) { f.gone = true; s.mass += f.m; if (s.me) this.eat(f); } } }
    let no = 0, nd = 0, ng = 0; this.food = this.food.filter(f => !f.gone); for (const f of this.food) { if (f.k === 'o') no++; else if (f.k === 'gold') ng++; else nd++; }
    while (no++ < 380) this.orb(); if (nd < 14) this.donut(); if (!ng && this.r() < dt / 14) { const [x, y] = this.rin(); this.food.push({ x, y, v: 250, m: 10, k: 'gold', ph: 0 }); }
    for (const s of this.snakes) s.len = Math.max(9, Math.floor(s.mass)); this.snakes = this.snakes.filter(s => s.alive);
    this.respawn -= dt; if (this.snakes.length - 1 < 6 + Math.min(8, Math.floor(this.playT / 30)) && this.respawn <= 0) { this.rival(); this.respawn = 2.2; }
    this.zoom(dt); if (this.score >= this.nextCoin) { this.coins++; this.nextCoin += 1000; } this.setLevel(you.len / 120);
  }
  dyingUpdate(dt) { this.zoom(dt * 2); }
  zoom(dt) { const h = this.you.pts[0], z = clamp(1.2 - Math.sqrt(this.you.len) * 0.024, 0.58, 1.1), c = this.cam; c.x = lerp(c.x, h[0], Math.min(1, dt * 7)); c.y = lerp(c.y, h[1], Math.min(1, dt * 7)); c.z = lerp(c.z, z, Math.min(1, dt)); }
  floor() { return this.fl || (this.fl = bake(140, 242, (g) => { g.fillStyle = '#080a1c'; g.fillRect(0, 0, 140, 242); const hx = (cx, cy) => { g.beginPath(); for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; g.lineTo(cx + Math.cos(a) * 38, cy + Math.sin(a) * 38); } g.closePath(); g.fillStyle = '#0e1230'; g.fill(); g.strokeStyle = 'rgba(99,102,241,.4)'; g.lineWidth = 1.5; g.stroke(); }; const w = 70, h = 40.4 * 1.5; for (const [x, y] of [[0, 0], [70, 0], [140, 0], [35, 60.6], [105, 60.6], [0, 121.2], [70, 121.2], [140, 121.2], [35, 181.8], [105, 181.8], [0, 242.4], [70, 242.4]]) hx(x, y); })); }
  body(ctx, s) {
    const z = this.cam.z, P = s.pts, n = P.length, W = this.wid(s) * z; if (n < 2) return;
    const hx = this.sx(P[0][0]), hy = this.sy(P[0][1]); if (hx < -160 || hx > this.W + 160 || hy < -160 || hy > this.H + 160) { let any = false; for (let i = 0; i < n; i += 8) { const x = this.sx(P[i][0]), y = this.sy(P[i][1]); if (x > -60 && x < this.W + 60 && y > -60 && y < this.H + 60) { any = true; break; } } if (!any) return; }
    const path = () => { ctx.beginPath(); ctx.moveTo(this.sx(P[n - 1][0]), this.sy(P[n - 1][1])); for (let i = n - 2; i >= 0; i -= 1) ctx.lineTo(this.sx(P[i][0]), this.sy(P[i][1])); };
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (s.boost || s.me) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = s.boost ? 0.3 : 0.13; path(); ctx.strokeStyle = s.sk[0]; ctx.lineWidth = W * 1.7; ctx.stroke(); ctx.restore(); }
    path(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = W * 1.12; ctx.stroke();
    path(); ctx.strokeStyle = s.sk[1]; ctx.lineWidth = W; ctx.stroke();
    ctx.save(); path(); ctx.setLineDash([SEG * 1.6 * z, SEG * 1.6 * z]); ctx.strokeStyle = s.sk[0]; ctx.lineWidth = W * 0.8; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(-W * 0.1, -W * 0.16); path(); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = W * 0.18; ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(s.a); const r = W * 0.6; ctx.fillStyle = s.sk[0]; ctx.beginPath(); ctx.ellipse(r * 0.15, 0, r * 1.05, r * 0.95, 0, 0, TAU); ctx.fill();
    for (const k of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(r * 0.45, k * r * 0.45, r * 0.33, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b1020'; ctx.beginPath(); ctx.arc(r * 0.57, k * r * 0.45, r * 0.17, 0, TAU); ctx.fill(); } ctx.restore();
    if (!s.me && z > 0.62) this.text(ctx, s.name, hx, hy - W - 6, { size: 11, weight: 700, align: 'center', color: 'rgba(255,255,255,.65)', font: 'Exo' });
  }
  render(ctx) {
    const W = this.W, H = this.H, z = this.cam.z, c = this.cam; ctx.fillStyle = '#04050b'; ctx.fillRect(0, 0, W, H);
    const ox = this.sx(0), oy = this.sy(0); ctx.save(); ctx.beginPath(); ctx.arc(ox, oy, R_ARENA * z, 0, TAU); ctx.clip(); ctx.translate(ox, oy); ctx.scale(z, z); if (!this.pat) this.pat = ctx.createPattern(this.floor(), 'repeat'); ctx.fillStyle = this.pat; ctx.fillRect(c.x - W / 2 / z - 5, c.y - H / 2 / z - 5, W / z + 10, H / z + 10); ctx.restore();
    const me = this.you.pts[0], px = this.sx(me[0]), py = this.sy(me[1]); const lg = ctx.createRadialGradient(px, py, 30, px, py, Math.max(W, H) * 0.7); lg.addColorStop(0, 'rgba(124,77,255,.12)'); lg.addColorStop(1, 'rgba(0,0,0,.5)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,79,216,.25)'; ctx.lineWidth = 28 * z; ctx.beginPath(); ctx.arc(ox, oy, R_ARENA * z, 0, TAU); ctx.stroke(); ctx.strokeStyle = '#ff7ae6'; ctx.lineWidth = 5 * z; ctx.stroke();
    const t = this.t;
    for (const f of this.food) { const x = this.sx(f.x), y = this.sy(f.y); if (x < -40 || x > W + 40 || y < -40 || y > H + 40) continue;
      if (f.k === 'o') { const s = (f.v > 10 ? 24 : 18) * z * (1 + 0.15 * Math.sin(t * 4 + f.ph)); halo(ctx, COL[f.c], x, y, s, 1); }
      else { const s = (f.k === 'gold' ? 54 : 44) * z, b = Math.sin(t * 3 + f.ph) * 3 * z; if (f.k === 'gold') halo(ctx, '#fbbf24', x, y, s * 1.2, 0.6); spr(ctx, this.P, f.k, x, y + b, s, 0, Math.sin(t + f.ph) * 0.2); } }
    for (const s of this.snakes) if (!s.me) this.body(ctx, s); if (this.you.alive) this.body(ctx, this.you);
    if (this.magnet > 0) { ctx.strokeStyle = `rgba(251,191,36,${0.25 + 0.15 * Math.sin(t * 8)})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 180 * z, 0, TAU); ctx.stroke(); }
    // rank
    let rank = 1; for (const s of this.snakes) if (!s.me && s.len > this.you.len) rank++;
    this.hud(ctx, { best: this.best, chip: 'LEN ' + this.you.len, chipColor: 'rgba(34,211,238,.4)' }); this.text(ctx, `RANK #${rank}/${this.snakes.length}  ·  CUT OFFS ${this.kills}`, W / 2, 80, { size: 11, weight: 800, align: 'center', color: '#fde047', font: 'Exo' });
    // boost button + minimap
    const b = this.btn, on = this.btnDown || this.you.boost; ctx.fillStyle = on ? 'rgba(34,211,238,.4)' : 'rgba(20,24,60,.6)'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill(); ctx.strokeStyle = on ? '#67e8f9' : 'rgba(167,139,250,.6)'; ctx.lineWidth = 2.5; ctx.stroke(); this.text(ctx, 'BOOST', b.x, b.y + 5, { size: 12, color: '#fff', align: 'center' });
    const mr = 34, mx = W - mr - 14, my = H - mr - 14; ctx.fillStyle = 'rgba(10,12,30,.65)'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,79,216,.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    for (const s of this.snakes) { const h = s.pts[0]; ctx.fillStyle = s.me ? '#fff' : s.sk[0]; ctx.beginPath(); ctx.arc(mx + h[0] / R_ARENA * mr, my + h[1] / R_ARENA * mr, s.me ? 3 : 2, 0, TAU); ctx.fill(); }
  }
}

// Stack v8 - endless tower-stacking timing game. Rebuilt presentation: neon-edged isometric glass slabs with studio lighting, altitude-driven
// sky (dusk -> night -> aurora + stars), drifting clouds, bokeh, perfect-drop shockwaves + sparks, falling cut-offs, camera shake.
// Rules are the shared stack-core.js (the server replays the logged drop times), so the scoring and anti-cheat are unchanged.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, halo, bake, mix } from './kit.js';
import { H0, BASE, RANGE, speedAt, posAt, newState, drop as coreDrop } from './stack-core.js';
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
export class Stack extends Game8 {
  get title() { return 'STACK'; }
  get hint() { return 'Tap (or Space) to drop the sliding slab. Whatever overhangs is sliced off. Perfect drops keep the slab whole and 3 in a row grow it back. How high can you build?'; }
  get startOnTapOnly() { return true; }
  get accent() { return '#a78bfa'; }
  get musicOpts() { return { root: 52, bpm: 100, mode: 'minor', seed: 4, vol: 0.34 }; }
  layout() { this.S = Math.min(this.W * 0.27, this.H * 0.17); this.cx = this.W / 2; this.baseY = this.H * 0.62; this.cloudsK = null; }
  reset() {
    super.reset(); this.score = 0; this.coins = 0; this.n = 0; this.streak = 0; this.bestStreak = 0; this.hue = this.r() * 360;
    this.slabs = [{ x: 0, z: 0, w: BASE, d: BASE, y: 0, hue: this.hue, t: 0 }];
    for (let i = 1; i <= 6; i++) this.slabs.unshift({ x: 0, z: 0, w: BASE, d: BASE, y: -i * H0, hue: this.hue - i * 8, t: 0 });
    this.core = newState(); this.debris = []; this.rings = []; this.camY = 0; this.flashT = 0; this.crashed = false; this.spawn();
  }
  top() { return this.slabs[this.slabs.length - 1]; }
  spawn() {
    const p = this.top(), axis = this.n % 2 === 0 ? 'x' : 'z', range = RANGE;
    this.cur = { x: axis === 'x' ? p.x - range : p.x, z: axis === 'z' ? p.z - range : p.z, w: p.w, d: p.d, y: p.y + H0, hue: p.hue + 8, axis, range, t: 0 };
  }
  onDown() { this.drop(); }
  onKey(c, d) { if (d && (c === 'Space' || c === 'Enter' || c === 'ArrowDown')) this.drop(); }
  drop() {
    if (this.dead > 0 || !this.cur || this.state !== 'play') return;
    const c = this.cur, ms = Math.round(c.t * 1000); this.log.push(ms); const r = coreDrop(this.core, ms), ax = r.axis, delta = r.delta;
    const tp = this.P(c.x, c.y, c.z);
    if (r.miss) {
      c[ax] = r.slab[ax]; this.debris.push({ ...c, vy: 0, vx: (ax === 'x' ? Math.sign(delta) : 0) * 0.6, vz: (ax === 'z' ? Math.sign(delta) : 0) * 0.6, rot: 0, vr: rnd(-2, 2), life: 2.5 });
      this.cur = null; this.crashed = true; const q = this.P(c.x, c.y, c.z); this.fx.debris(q[0], q[1], '#fff', 12, 300, 1, 8); this.kill(1.1, '#a78bfa'); return;
    }
    this.n = this.core.n; this.streak = this.core.streak; this.bestStreak = Math.max(this.bestStreak, this.streak); this.award(r.pts, 's'); this.setLevel(this.n / 90);
    const h = ((c.hue % 360) + 360) % 360, col = `hsl(${Math.round(h / 8) * 8},90%,65%)`;
    if (r.perfect) {
      Object.assign(c, { x: r.slab.x, z: r.slab.z, w: r.slab.w, d: r.slab.d }); this.rings.push({ x: c.x, z: c.z, w: c.w, d: c.d, y: c.y + H0, life: 0.7 });
      const q = this.P(c.x, c.y + H0, c.z); this.fx.sparks(q[0], q[1], ['#fff', '#fde047', '#7dd3fc'], 16, 420, 0.55, 18); this.fx.ring(q[0], q[1], '#fde047', 10, 110, 0.5, 4); this.fx.shake(2 + Math.min(8, this.streak)); this.hitstop(0.035);
      this.pop(this.W / 2, this.H * 0.28, this.streak >= 3 ? `PERFECT x${this.streak}  +${r.pts}` : `PERFECT +${r.pts}`, '#fde047', this.streak >= 3 ? 28 : 24);
      this.sfx.tone(523 * Math.pow(2, Math.min(12, this.streak) / 12), 0.2, { type: 'triangle', vol: 0.3 }); this.sfx.tone(1046 * Math.pow(2, Math.min(12, this.streak) / 12), 0.15, { type: 'sine', vol: 0.12, delay: 0.05 }); this.flashT = 0.3;
    } else {
      const s = Math.sign(delta), cut = r.cut, keep = ax === 'x' ? r.slab.w : r.slab.d;
      if (ax === 'x') this.debris.push({ ...c, x: r.slab.x + s * (keep / 2 + cut / 2), w: cut, vy: 0, vx: s * 0.5, vz: 0, rot: 0, vr: s * rnd(1.5, 3), life: 2.2 });
      else this.debris.push({ ...c, z: r.slab.z + s * (keep / 2 + cut / 2), d: cut, vy: 0, vx: 0, vz: s * 0.5, rot: 0, vr: s * rnd(1.5, 3), life: 2.2 });
      Object.assign(c, { x: r.slab.x, z: r.slab.z, w: r.slab.w, d: r.slab.d }); const q = this.P(c.x, c.y, c.z); this.fx.shake(2); this.fx.sparks(q[0], q[1], col, 5, 240, 0.3, 12);
      this.sfx.tone(300 + Math.min(40, this.n) * 8, 0.08, { type: 'square', vol: 0.16 }); this.sfx.noise(0.08, { vol: 0.1, freq: 3000 });
    }
    if (this.n % 20 === 0) { this.coins++; this.pop(this.W / 2, this.H * 0.36, '+1 COIN', '#fbbf24', 18); }
    this.slabs.push({ x: c.x, z: c.z, w: c.w, d: c.d, y: c.y, hue: c.hue, t: 0 }); if (this.slabs.length > 40) this.slabs.splice(0, this.slabs.length - 40); this.spawn();
  }
  update(dt) {
    if (this.flashT > 0) this.flashT -= dt; for (const s of this.slabs) s.t += dt;
    for (const d of this.debris) { d.vy -= 9 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.rot += d.vr * dt; d.life -= dt; } this.debris = this.debris.filter(d => d.life > 0);
    for (const r of this.rings) r.life -= dt; this.rings = this.rings.filter(r => r.life > 0);
    this.camY = lerp(this.camY, Math.max(0, this.top().y - H0 * 2), Math.min(1, dt * 4));
    const c = this.cur; if (!c) return; const p = this.top(), v = speedAt(this.n), k = c.axis, center = p[k]; c.t += dt; c[k] = posAt(center, c.range, v, c.t * 1000);
  }
  dyingUpdate(dt) { for (const d of this.debris) { d.vy -= 9 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.rot += d.vr * dt; } }
  P(x, y, z) { const S = this.S; return [this.cx + (x - z) * C30 * S, this.baseY + (x + z) * S30 * S - (y - this.camY) * S * 1.15]; }
  slab(ctx, s, alpha = 1, glow = 0, full = true) {
    const { x, z, w, d, y } = s, hx = w / 2, hz = d / 2, y1 = y + H0, P = (a, b, c) => this.P(a, b, c);
    const t0 = P(x - hx, y1, z - hz), t1 = P(x + hx, y1, z - hz), t2 = P(x + hx, y1, z + hz), t3 = P(x - hx, y1, z + hz), b1 = P(x + hx, y, z - hz), b2 = P(x + hx, y, z + hz), b3 = P(x - hx, y, z + hz);
    if (t2[1] < -40 || t0[1] > this.H + 60) return; const h = ((s.hue % 360) + 360) % 360; ctx.globalAlpha = alpha;
    ctx.fillStyle = `hsl(${h},70%,${40 + glow * 12}%)`; ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b1[0], b1[1]); ctx.closePath(); ctx.fill();
    ctx.fillStyle = `hsl(${h},68%,${27 + glow * 10}%)`; ctx.beginPath(); ctx.moveTo(t3[0], t3[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b3[0], b3[1]); ctx.closePath(); ctx.fill();
    let g; if (!full) g = `hsl(${h},82%,${60 + glow * 12}%)`; else { g = ctx.createLinearGradient(t0[0], t0[1], t2[0], t2[1]); g.addColorStop(0, `hsl(${h},90%,${74 + glow * 10}%)`); g.addColorStop(0.46, `hsl(${h},85%,${60 + glow * 12}%)`); g.addColorStop(0.5, `hsl(${h},95%,84%)`); g.addColorStop(0.58, `hsl(${h},85%,58%)`); g.addColorStop(1, `hsl(${h},80%,${50 + glow * 10}%)`); }
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.closePath(); ctx.fill();
    if (!full) { ctx.globalAlpha = 1; return; }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(t3[0], t3[1]); ctx.lineTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
    ctx.strokeStyle = `hsla(${h},100%,80%,.7)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(t3[0], t3[1]); ctx.lineTo(b3[0], b3[1]); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(b1[0], b1[1]); ctx.moveTo(t2[0], t2[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  initBg() {
    const W = this.W; this.cl = bake(256, 96, (g) => { for (let i = 0; i < 9; i++) { const x = 30 + i * 24 + Math.random() * 10, y = 48 + Math.random() * 14, r = 18 + Math.random() * 20; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); } });
    this.sstars = Array.from({ length: 70 }, () => ({ x: Math.random() * W, y: Math.random() * this.H, r: Math.random() * 1.6 + 0.4, tw: Math.random() * 6 })); this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * W, y: 100 + i * 150 + Math.random() * 60, s: 0.8 + Math.random() * 1.2, v: 3 + Math.random() * 6 }));
  }
  paintSky(ctx, W, H, hh, alt, climb) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${(hh + 240) % 360},60%,${lerp(14, 3, alt)}%)`); g.addColorStop(0.6, `hsl(${(hh + 280) % 360},55%,${lerp(24, 10, alt)}%)`); g.addColorStop(1, `hsl(${hh},65%,${lerp(34, 18, alt)}%)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff'; for (const s of this.sstars) { ctx.globalAlpha = (0.15 + alt * 0.7) * (0.5 + 0.5 * Math.sin(this.t * 1.7 + s.tw)); ctx.fillRect(s.x, s.y, s.r, s.r); } ctx.globalAlpha = 1;
    if (alt > 0.3) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = (alt - 0.3) * 0.5; const ag = ctx.createLinearGradient(0, H * 0.1, W, H * 0.4); ag.addColorStop(0, 'rgba(34,211,238,0)'); ag.addColorStop(0.4 + 0.1 * Math.sin(this.t * 0.4), 'rgba(52,211,153,.5)'); ag.addColorStop(0.7, 'rgba(168,85,247,.5)'); ag.addColorStop(1, 'rgba(168,85,247,0)'); ctx.fillStyle = ag; ctx.beginPath(); ctx.moveTo(0, H * 0.2); ctx.bezierCurveTo(W * 0.3, H * 0.05 + Math.sin(this.t * 0.5) * 20, W * 0.6, H * 0.35, W, H * 0.15); ctx.lineTo(W, H * 0.4); ctx.bezierCurveTo(W * 0.6, H * 0.55, W * 0.3, H * 0.25, 0, H * 0.45); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    for (const c of this.clouds) { c.x += c.v * 0.016; if (c.x > W + 120) c.x = -260 * c.s; const y = ((c.y + climb * 55 * c.s) % (H + 200)) - 100; ctx.globalAlpha = 0.5 - alt * 0.3; ctx.drawImage(this.cl, c.x, y, 256 * c.s, 96 * c.s); } ctx.globalAlpha = 1;
  }
  render(ctx) {
    if (!this.cl) this.initBg(); const W = this.W, H = this.H, climb = this.camY, hh = (this.hue + climb * 5) % 360, alt = clamp(climb / 18, 0, 1);
    this._bgN = (this._bgN || 0) + 1;
    if (!this._bgc || this._bgc.width !== Math.round(W / 2) || this._bgN % 3 === 0) {
      if (!this._bgc || this._bgc.width !== Math.round(W / 2)) { this._bgc = document.createElement('canvas'); this._bgc.width = Math.round(W / 2); this._bgc.height = Math.round(H / 2); }
      const bctx = this._bgc.getContext('2d'); bctx.setTransform(0.5, 0, 0, 0.5, 0, 0); this.paintSky(bctx, W, H, hh, alt, climb);
    }
    ctx.drawImage(this._bgc, 0, 0, W, H);
    const tp = this.P(this.top().x, this.top().y + H0, this.top().z); halo(ctx, `hsl(${Math.round(((this.top().hue % 360) + 360) % 360 / 8) * 8},90%,65%)`, tp[0], tp[1], this.S * 2.2, 0.3 + (this.flashT > 0 ? 0.4 : 0));
    // base shadow on the floor (hides as the camera climbs)
    if (climb < 6) { ctx.globalAlpha = clamp(1 - climb / 6, 0, 1) * 0.45; const b = this.P(0, -6 * H0, 0); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(b[0], b[1] + 8, this.S * 1.5, this.S * 0.6, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    const nS = this.slabs.length; this.slabs.forEach((s, i) => this.slab(ctx, s, 1, s.t < 0.25 ? 1 - s.t * 4 : 0, i >= nS - 3));
    for (const r of this.rings) { const k = 1 - r.life / 0.7, e = 0.05 + k * 0.3; ctx.strokeStyle = `rgba(255,255,255,${r.life})`; ctx.lineWidth = 3; const a = this.P(r.x - r.w / 2 - e, r.y, r.z - r.d / 2 - e), b = this.P(r.x + r.w / 2 + e, r.y, r.z - r.d / 2 - e), c = this.P(r.x + r.w / 2 + e, r.y, r.z + r.d / 2 + e), d = this.P(r.x - r.w / 2 - e, r.y, r.z + r.d / 2 + e); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.stroke(); }
    if (this.cur) { // landing guide: faint outline of the tower top so alignment is a pure skill read
      const p = this.top(), a = this.P(p.x - p.w / 2, p.y + H0 * 2, p.z - p.d / 2), b = this.P(p.x + p.w / 2, p.y + H0 * 2, p.z - p.d / 2), c2 = this.P(p.x + p.w / 2, p.y + H0 * 2, p.z + p.d / 2), d2 = this.P(p.x - p.w / 2, p.y + H0 * 2, p.z + p.d / 2); ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.setLineDash([5, 6]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]); this.slab(ctx, this.cur); }
    for (const d of this.debris) { const pp = this.P(d.x, d.y, d.z); ctx.save(); ctx.translate(pp[0], pp[1]); ctx.rotate(d.rot * 0.25); ctx.translate(-pp[0], -pp[1]); this.slab(ctx, d, Math.min(1, d.life)); ctx.restore(); }
    this.text(ctx, String(this.n), W / 2, 150, { size: 64, align: 'center', color: '#fff', glow: `hsl(${this.top().hue % 360},90%,60%)` });
    this.hud(ctx, { best: this.best, chip: this.streak >= 2 ? '★ x' + this.streak : '', chipColor: 'rgba(251,191,36,.5)' });
    if (this.state === 'play' && this.n === 0 && this.t % 1.2 < 0.8) this.text(ctx, 'TAP TO DROP', W / 2, H - 60, { size: 18, color: '#c4b5fd', align: 'center', glow: '#8b5cf6' });
  }
}

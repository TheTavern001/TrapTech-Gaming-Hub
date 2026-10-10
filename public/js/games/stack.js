// Stack - endless tower-stacking timing game (original code and art, v7). Replaces Stack 2048.
// A glass slab slides across the top of the tower; tap to drop it. The overhang is sliced off and falls away, perfect drops
// (within a few pixels) keep the slab whole and 3+ perfects in a row grow it back. The camera climbs and the slabs speed up forever.
// Art: slabs are drawn as lit glass blocks in isometric 3D (canvas, original), backdrop = v6 night-sky + skyline layers (original renders).
import { Game, TAU, rnd, clamp, lerp, fmt, loadLayers, reducedMotion } from './engine.js';
import { H0, BASE, RANGE, speedAt, posAt, newState, drop as coreDrop } from './stack-core.js'; // shared with the server replay
const C30 = Math.cos(Math.PI / 6), S30 = 0.5;
export class Stack extends Game {
  get title() { return 'STACK'; }
  get hint() { return 'Tap (or Space) to drop the sliding slab onto the tower. The overhang gets sliced off. Perfect drops keep it whole, and 3 in a row grow it back. How high can you go?'; }
  get startOnTapOnly() { return true; }
  async load() { this.L = await loadLayers({ sky: 'px-sky.webp', far: 'px-far.webp' }); }
  layout() { this.S = Math.min(this.W * 0.27, this.H * 0.17); this.cx = this.W / 2; this.baseY = this.H * 0.62; }
  reset() {
    this.score = 0; this.coins = 0; this.n = 0; this.streak = 0; this.bestStreak = 0; this.hue = this.r() * 360;
    this.slabs = [{ x: 0, z: 0, w: BASE, d: BASE, y: 0, hue: this.hue, t: 0 }]; // base (y = bottom of slab)
    for (let i = 1; i <= 6; i++) this.slabs.unshift({ x: 0, z: 0, w: BASE, d: BASE, y: -i * H0, hue: this.hue - i * 8, t: 0, under: true });
    this.core = newState(); this.debris = []; this.rings = []; this.camY = 0; this.dead = 0; this.flash = 0; this.shake = 0; this.spawn();
  }
  top() { return this.slabs[this.slabs.length - 1]; }
  speed() { return speedAt(this.n); }
  spawn() {
    const p = this.top(); const axis = this.n % 2 === 0 ? 'x' : 'z'; const range = RANGE;
    this.cur = { x: axis === 'x' ? -range : p.x, z: axis === 'z' ? -range : p.z, w: p.w, d: p.d, y: p.y + H0, hue: p.hue + 8, axis, dir: 1, range, t: 0 };
    if (axis === 'x') this.cur.x = p.x - range; else this.cur.z = p.z - range;
  }
  onDown() { this.drop(); }
  onKey(code, down) { if (down && (code === 'Space' || code === 'Enter' || code === 'ArrowDown')) this.drop(); }
  drop() {
    if (this.dead || !this.cur || this.state !== 'play') return;
    // v7 anti-cheat level 4: the outcome comes from the shared rules core using the drop time in whole ms (logged), so the
    // server can replay the exact run (src/ac-levels.js)
    const c = this.cur; const ms = Math.round(c.t * 1000); this.log.push(ms); const r = coreDrop(this.core, ms); const ax = r.axis; const delta = r.delta;
    if (r.miss) { // missed the tower completely
      c[ax] = r.slab[ax];
      this.debris.push({ ...c, vy: 0, vx: (ax === 'x' ? Math.sign(delta) : 0) * 0.6, vz: (ax === 'z' ? Math.sign(delta) : 0) * 0.6, rot: 0, vr: rnd(-2, 2), life: 2.5 });
      this.cur = null; this.dead = 1.1; this.sfx.lose(); this.shake = 0.4; return;
    }
    this.n = this.core.n; this.streak = this.core.streak; this.bestStreak = Math.max(this.bestStreak, this.streak); this.award(r.pts, 's');
    if (r.perfect) {
      Object.assign(c, { x: r.slab.x, z: r.slab.z, w: r.slab.w, d: r.slab.d });
      this.rings.push({ x: c.x, z: c.z, w: c.w, d: c.d, y: c.y + H0, life: 0.7 });
      this.pop(this.W / 2, this.H * 0.3, this.streak >= 3 ? `PERFECT x${this.streak}  +${r.pts}` : `PERFECT +${r.pts}`, '#fde047', this.streak >= 3 ? 28 : 24);
      this.sfx.tone(523 * Math.pow(2, Math.min(12, this.streak) / 12), 0.18, { type: 'triangle', vol: 0.32 }); this.flash = 0.25;
    } else {
      const s = Math.sign(delta); const cut = r.cut; const keep = (ax === 'x' ? r.slab.w : r.slab.d);
      if (ax === 'x') this.debris.push({ ...c, x: r.slab.x + s * (keep / 2 + cut / 2), w: cut, vy: 0, vx: s * 0.5, vz: 0, rot: 0, vr: s * rnd(1.5, 3), life: 2.2 });
      else this.debris.push({ ...c, z: r.slab.z + s * (keep / 2 + cut / 2), d: cut, vy: 0, vx: 0, vz: s * 0.5, rot: 0, vr: s * rnd(1.5, 3), life: 2.2 });
      Object.assign(c, { x: r.slab.x, z: r.slab.z, w: r.slab.w, d: r.slab.d });
      this.sfx.tone(300 + Math.min(40, this.n) * 8, 0.08, { type: 'square', vol: 0.18 }); this.sfx.noise(0.08, { vol: 0.12, freq: 3000 });
    }
    if (this.n % 20 === 0) { this.coins++; this.pop(this.W / 2, this.H * 0.36, '+1 COIN', '#fbbf24', 18); }
    this.slabs.push({ x: c.x, z: c.z, w: c.w, d: c.d, y: c.y, hue: c.hue, t: 0 }); if (this.slabs.length > 40) this.slabs.splice(0, this.slabs.length - 40);
    this.spawn();
  }
  update(dt) {
    if (this.flash > 0) this.flash -= dt; if (this.shake > 0) this.shake -= dt;
    for (const s of this.slabs) s.t += dt;
    for (const d of this.debris) { d.vy -= 9 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.z += d.vz * dt; d.rot += d.vr * dt; d.life -= dt; }
    this.debris = this.debris.filter(d => d.life > 0);
    for (const r of this.rings) r.life -= dt; this.rings = this.rings.filter(r => r.life > 0);
    this.camY = lerp(this.camY, Math.max(0, this.top().y - H0 * 2), Math.min(1, dt * 4));
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.finish(); return; }
    const c = this.cur; if (!c) return; const p = this.top(); const v = this.speed();
    const k = c.axis === 'x' ? 'x' : 'z'; const center = c.axis === 'x' ? p.x : p.z;
    c.t += dt; c[k] = posAt(center, c.range, v, c.t * 1000); // analytic ping-pong (same formula the server replays)
  }
  // isometric projection: X -> screen right-down, Z -> screen left-down, Y -> up
  P(x, y, z) { const S = this.S; return [this.cx + (x - z) * C30 * S, this.baseY + (x + z) * S30 * S - (y - this.camY) * S * 1.15]; }
  slab(ctx, s, alpha = 1) {
    const { x, z, w, d, y } = s; const hx = w / 2, hz = d / 2; const y1 = y + H0; const P = (a, b, c) => this.P(a, b, c);
    const t0 = P(x - hx, y1, z - hz), t1 = P(x + hx, y1, z - hz), t2 = P(x + hx, y1, z + hz), t3 = P(x - hx, y1, z + hz);
    const b1 = P(x + hx, y, z - hz), b2 = P(x + hx, y, z + hz), b3 = P(x - hx, y, z + hz);
    if (t2[1] < -40 || t0[1] > this.H + 60) return;
    const h = ((s.hue % 360) + 360) % 360; ctx.globalAlpha = alpha;
    // right face (x = +hx)
    let g = ctx.createLinearGradient(t1[0], t1[1], b2[0], b2[1]); g.addColorStop(0, `hsla(${h},75%,46%,0.95)`); g.addColorStop(1, `hsla(${h},80%,24%,0.95)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b1[0], b1[1]); ctx.closePath(); ctx.fill();
    // left face (z = +hz)
    g = ctx.createLinearGradient(t3[0], t3[1], b2[0], b2[1]); g.addColorStop(0, `hsla(${h},70%,38%,0.95)`); g.addColorStop(1, `hsla(${h},75%,18%,0.95)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(t3[0], t3[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(b2[0], b2[1]); ctx.lineTo(b3[0], b3[1]); ctx.closePath(); ctx.fill();
    // top face: glossy glass with a diagonal reflection band
    g = ctx.createLinearGradient(t0[0], t0[1], t2[0], t2[1]); g.addColorStop(0, `hsla(${h},90%,76%,1)`); g.addColorStop(0.45, `hsla(${h},85%,62%,1)`); g.addColorStop(0.5, `hsla(${h},95%,82%,1)`); g.addColorStop(0.56, `hsla(${h},85%,60%,1)`); g.addColorStop(1, `hsla(${h},80%,52%,1)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.closePath(); ctx.fill();
    // specular rims
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(t3[0], t3[1]); ctx.lineTo(t0[0], t0[1]); ctx.lineTo(t1[0], t1[1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.moveTo(t1[0], t1[1]); ctx.lineTo(t2[0], t2[1]); ctx.lineTo(t3[0], t3[1]); ctx.moveTo(t2[0], t2[1]); ctx.lineTo(b2[0], b2[1]); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  render(ctx) {
    const W = this.W, H = this.H; const L = this.L || {}; const climb = this.camY;
    // sky that deepens as you climb, plus the v6 night layers sinking away below
    const hh = (this.hue + climb * 6) % 360; const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, `hsl(${hh},55%,${Math.max(4, 10 - climb * 0.05)}%)`); g.addColorStop(1, `hsl(${(hh + 40) % 360},60%,16%)`); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (L.sky) { ctx.globalAlpha = 0.55; L.sky.draw(ctx, this.t * 4, 0, 0, W, H * 0.7); ctx.globalAlpha = 1; }
    if (L.far) { const fy = H * 0.52 + climb * 60; if (fy < H) L.far.draw(ctx, this.t * 6, 0, fy, W, H * 0.5); }
    ctx.save(); if (this.shake > 0 && !reducedMotion()) ctx.translate(rnd(-4, 4) * this.shake * 2, rnd(-4, 4) * this.shake * 2);
    // soft light pool under the top of the tower
    const tp = this.P(this.top().x, this.top().y + H0, this.top().z); const rg = ctx.createRadialGradient(tp[0], tp[1], 4, tp[0], tp[1], this.S * 1.4); rg.addColorStop(0, `hsla(${this.top().hue % 360},90%,70%,${0.22 + (this.flash > 0 ? 0.3 : 0)})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    for (const s of this.slabs) this.slab(ctx, s);
    for (const r of this.rings) { const k = 1 - r.life / 0.7; const e = 0.08 + k * 0.25; ctx.strokeStyle = `rgba(255,255,255,${r.life})`; ctx.lineWidth = 3; const a = this.P(r.x - r.w / 2 - e, r.y, r.z - r.d / 2 - e), b = this.P(r.x + r.w / 2 + e, r.y, r.z - r.d / 2 - e), c = this.P(r.x + r.w / 2 + e, r.y, r.z + r.d / 2 + e), d = this.P(r.x - r.w / 2 - e, r.y, r.z + r.d / 2 + e); ctx.beginPath(); ctx.moveTo(...a); ctx.lineTo(...b); ctx.lineTo(...c); ctx.lineTo(...d); ctx.closePath(); ctx.stroke(); }
    if (this.cur) this.slab(ctx, this.cur);
    for (const d of this.debris) { const pp = this.P(d.x, d.y, d.z); ctx.save(); ctx.translate(pp[0], pp[1]); ctx.rotate(d.rot * 0.25); ctx.translate(-pp[0], -pp[1]); this.slab(ctx, d, Math.min(1, d.life)); ctx.restore(); }
    ctx.restore();
    // HUD: big centred height counter like a real stacking game, plus score
    this.text(ctx, String(this.n), W / 2, 150, { size: 64, weight: 900, align: 'center', color: '#fff', glow: `hsl(${this.top().hue % 360},90%,60%)` });
    this.hudScore(ctx);
    if (this.streak >= 2) this.text(ctx, `PERFECT STREAK ${this.streak}`, W - 18, 30, { size: 12, weight: 800, color: '#fde047', align: 'right' });
    if (this.state === 'play' && this.n === 0 && this.t % 1.2 < 0.8) this.text(ctx, 'TAP TO DROP', W / 2, H - 60, { size: 18, weight: 800, align: 'center', color: '#c4b5fd' });
  }
}

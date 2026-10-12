// Sky Hopper - tap-to-fly gap runner (original code).
import { Game, TAU, clamp, roundRect, fmt, loadArt, pattern, cover, loadAtlas, loadLayers, spr, sprC, coinFrame, drawFlame, reducedMotion } from './engine.js';
// v6: 4-layer seamless parallax night city (original procedural art), glass curtain-wall towers, original Blender-rendered astronaut (fly/hit frames), 3D gold coin spin frames.
export class SkyHopper extends Game {
  get title() { return 'SKY HOPPER'; }
  get hint() { return 'Tap (or press Space) to boost up, let go to fall. Fly through the gaps between the towers. Every tower passed is +1, coins in the gaps are a bonus. One hit ends the run. After tower 30 the gaps start sliding.'; }
  async load() { const [a, L, astro, P] = await Promise.all([loadArt({ metal: 'metal-plate.webp', tower: '/assets/v6/sh-tower.webp' }), loadLayers({ sky: 'px-sky.webp', far: 'px-far.webp', mid: 'px-mid.webp', near: 'px-near-roofs.webp' }), loadAtlas('astro'), loadAtlas('props')]); this.art = a; this.L = L; this.AS = astro; this.P = P; }
  layout() { this.hx = Math.min(this.W * 0.3, 160); this.ground = this.H - 40; }
  reset() { this.score = 0; this.coins = 0; this.y = this.H * 0.45; this.vy = 0; this.x = 0; this.pipes = []; this.next = 420; this.dead = 0; this.layout(); }
  gap() { return Math.max(150, 215 - this.score * 2.2); }
  spd() { return this.score <= 38 ? 185 + this.score * 3 : Math.min(360, 299 + (this.score - 38) * 0.6); } // v7 endless: keeps ramping to 360
  flap() { if (this.dead) return; this.vy = -430; this.sfx.tone(520, 0.07, { type: 'triangle', vol: 0.22, slide: 1.4 }); }
  onDown() { this.flap(); }
  onKey(code, down) { if (down && (code === 'Space' || code === 'ArrowUp' || code === 'KeyW')) this.flap(); }
  update(dt) {
    this.vy = Math.min(900, this.vy + 1450 * dt); this.y += this.vy * dt;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.finish(); return; }
    const v = this.spd(); this.x += v * dt;
    while (this.next < this.x + this.W + 80) { const g = this.gap(); const lo = 130, hi = this.ground - g - 60; const prevPipe = this.pipes.length ? this.pipes[this.pipes.length - 1] : null; const prev = prevPipe ? prevPipe.top0 : null; const maxShift = prevPipe ? Math.min(72, Math.max(34, Math.min(g, prevPipe.g) * 0.38)) : 0; const top = prev == null ? lo + this.r() * (hi - lo) : Math.max(lo, Math.min(hi, prev + (this.r() * 2 - 1) * maxShift)); /* Keep successive gap centers within a bounded, gap-scaled shift; 240px jumps could make a valid-looking layout physically unreadable or unreachable. */ const amp = this.score >= 30 ? Math.min(70, 12 + (this.score - 30) * 1.5) : 0; this.pipes.push({ x: this.next, top, top0: top, g, amp, ph: this.r() * 6.28, passed: false, coin: this.r() < 0.55, got: false }); this.next += 270 + this.r() * 60; }
    const r = 18; const hx = this.hx; this.tt = (this.tt || 0) + dt;
    for (const p of this.pipes) if (p.amp) { const lo = 130, hi = this.ground - 60 - p.g; p.top = Math.max(lo, Math.min(hi, p.top0 + Math.sin(this.tt * 1.3 + p.ph) * p.amp)); } // sliding gaps after tower 30
    for (const p of this.pipes) {
      const sx = p.x - this.x; const w = 74;
      if (!p.passed && sx + w < hx - r) { p.passed = true; this.score++; this.sfx.tone(880, 0.06, { type: 'sine', vol: 0.25 }); }
      if (p.coin && !p.got && Math.hypot(sx + w / 2 - hx, p.top + p.g / 2 - this.y) < r + 16) { p.got = true; this.coins++; this.pop(hx, this.y - 30, '+1 coin', '#fde047', 18); this.sfx.chord([988, 1318], 0.1, { type: 'triangle', vol: 0.2 }); }
      if (hx + r > sx && hx - r < sx + w && (this.y - r < p.top || this.y + r > p.top + p.g)) return this.crash();
    }
    if (this.y + r > this.ground || this.y - r < 96) return this.crash();
    this.pipes = this.pipes.filter(p => p.x - this.x > -120);
  }
  crash() { this.dead = 0.9; this.vy = -200; this.sfx.lose(); this.burst(this.hx, this.y, ['#f472b6', '#fde047', '#fff'], 22, 260, 0.6, 5); }
  render(ctx) {
    const A = this.art || {};
    const L = this.L || {}; const rm = reducedMotion(); const X = rm ? 0 : this.x; const W = this.W, G = this.ground; const k = Math.max(1, this.H / 800);
    if (L.sky) L.sky.draw(ctx, X * 0.03, 0, 0, W, this.H); else this.bg(ctx);
    if (L.far) L.far.draw(ctx, X * 0.1, 0, G - 360 * k, W, 360 * k);
    if (L.mid) L.mid.draw(ctx, X * 0.25, 0, G - 460 * k, W, 460 * k);
    if (L.near) L.near.draw(ctx, X * 0.55, 0, G - 220 * k, W, 260 * k);
    ctx.fillStyle = 'rgba(8,6,30,0.22)'; ctx.fillRect(0, 0, W, this.H);
    const mp = pattern(ctx, A.metal); const tp = pattern(ctx, A.tower);
    for (const p of this.pipes) {
      const sx = p.x - this.x, w = 74; if (sx > this.W || sx + w < 0) continue;
      for (const [y0, y1] of [[0, p.top], [p.top + p.g, this.ground]]) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; if (tp) { ctx.translate(sx, 0); ctx.scale(0.5, 0.5); ctx.fillStyle = tp; ctx.fillRect(0, y0 * 2, w * 2, (y1 - y0) * 2); } else { ctx.fillStyle = mp || '#475569'; ctx.fillRect(sx, y0, w, y1 - y0); } ctx.restore(); const g = ctx.createLinearGradient(sx, 0, sx + w, 0); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.4, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(sx, y0, w, y1 - y0); }
      ctx.fillStyle = '#f472b6'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 12; ctx.fillRect(sx - 4, p.top - 10, w + 8, 10); ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.fillRect(sx - 4, p.top + p.g, w + 8, 10); ctx.shadowBlur = 0;
      if (p.coin && !p.got) { ctx.save(); ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 14; sprC(ctx, this.P, coinFrame(this.t, p.x * 0.001), sx + w / 2, p.top + p.g / 2, 32, 32); ctx.restore(); }
    }
    ctx.fillStyle = 'rgba(5,6,20,0.9)'; ctx.fillRect(0, this.ground, this.W, this.H - this.ground); ctx.fillStyle = '#7c4dff'; ctx.fillRect(0, this.ground, this.W, 3);
    ctx.save(); ctx.translate(this.hx, this.y); ctx.rotate(clamp(this.vy / 900, -0.5, 0.9));
    const AS = this.AS; const boost = this.vy < -100 && !this.dead;
    if (boost) drawFlame(ctx, -15, 14, 46, 16, 0.25, this.t);
    if (AS) { const m = AS.meta; const dw = m.cell[0] * 0.56, dh = m.cell[1] * 0.56; const fn = this.dead ? 'hit_' + Math.min(5, Math.floor((0.9 - this.dead) * 8)) : 'fly_' + Math.floor(this.t * (boost ? 14 : 8)) % 6; spr(ctx, AS, fn, -m.anchor[0] * dw, -m.anchor[1] * dh, dw, dh); }
    else { ctx.fillStyle = '#c4b5fd'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); }
    ctx.restore();
    this.text(ctx, String(this.score), this.W / 2, 150, { size: 54, weight: 900, align: 'center', glow: '#7c4dff' });
    this.text(ctx, `BEST ${fmt(Math.max(this.best, this.score))}`, 18, 30, { size: 12, weight: 700, color: '#b9b3ff', font: 'Exo' });
    this.text(ctx, `COINS ${this.coins}`, this.W - 18, 30, { size: 12, weight: 700, color: '#fde047', align: 'right' });
  }
}

// Sky Hopper v8 - one-tap night-city flyer. Rebuilt: Kenney Tappy Plane biplane + star coins (CC0), baked glass towers with lit windows
// and neon caps, 3-layer parallax skyline, moon + stars, prop wash / smoke trail, tilt, camera shake on impact.
// Rules unchanged: score = towers passed, gaps tighten, speed rises, after tower 30 gaps slide. One hit ends the run.
import { Game8, PAL, TAU, rnd, clamp, lerp, loadPack, spr, halo, bake, vgrad, roundRect, mix } from './kit.js';
const TW = 78;
export class SkyHopper extends Game8 {
  get title() { return 'SKY HOPPER'; }
  get hint() { return 'Tap (or press Space) to climb, let go to fall. Fly through the gaps between the towers: every tower passed is +1, stars in the gaps are bonus coins. One hit ends the run. After tower 30 the gaps start to slide.'; }
  get accent() { return '#a78bfa'; }
  get musicOpts() { return { root: 58, bpm: 104, mode: 'major', seed: 9, vol: 0.32 }; }
  async load() { this.P = await loadPack('sky-hopper'); }
  layout() { this.hx = Math.min(this.W * 0.3, 150); this.ground = this.H - 46; this.ceil = 74; this.bgk = null; }
  reset() { super.reset(); this.layout(); this.score = 0; this.coins = 0; this.y = this.H * 0.45; this.vy = 0; this.x = 0; this.pipes = []; this.next = 420; this.tt = 0; this.tilt = 0; this.cnt = 0; this.crashed = false; }
  gap() { return Math.max(150, 215 - this.score * 2.2); }
  spd() { return this.score <= 38 ? 185 + this.score * 3 : Math.min(360, 299 + (this.score - 38) * 0.6); }
  flap() { if (this.crashed || this.state !== 'play') return; this.vy = -430; this.sfx.tone(520, 0.07, { type: 'triangle', vol: 0.2, slide: 1.4 }); this.fx.smoke(this.hx - 30, this.y + 8, '#c7d2fe', 2, 0.5, 14); this.fx.ring(this.hx - 18, this.y + 12, '#a5b4fc', 3, 16, 0.25, 2); }
  onDown() { this.flap(); }
  onKey(c, d) { if (d && (c === 'Space' || c === 'ArrowUp' || c === 'KeyW')) this.flap(); }
  mkTower(i) {
    const H = this.ground, hue = ['#22d3ee', '#a855f7', '#f472b6'][i % 3]; return bake(TW * 2, Math.round(H) * 2, (g, w, h) => {
      g.scale(2, 2); const gr = g.createLinearGradient(0, 0, TW, 0); gr.addColorStop(0, '#16224f'); gr.addColorStop(0.5, '#243273'); gr.addColorStop(1, '#0e1636'); g.fillStyle = gr; g.fillRect(0, 0, TW, H);
      let s = i * 977 + 13; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let y = 22; y < H - 6; y += 16) for (let x = 8; x < TW - 12; x += 14) { const lit = rr(); g.fillStyle = lit < 0.38 ? (lit < 0.18 ? '#fde68a' : '#7dd3fc') : 'rgba(10,16,48,.9)'; g.globalAlpha = lit < 0.38 ? 0.85 : 1; g.fillRect(x, y, 8, 9); } g.globalAlpha = 1;
      g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(0, 0, 5, H); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(TW - 6, 0, 6, H);
      const cap = g.createLinearGradient(0, 0, 0, 16); cap.addColorStop(0, '#475569'); cap.addColorStop(1, '#1e293b'); g.fillStyle = cap; g.fillRect(-2, 0, TW + 4, 14); g.fillStyle = hue; g.shadowColor = hue; g.shadowBlur = 10; g.fillRect(-2, 12, TW + 4, 3.5); g.shadowBlur = 0;
    });
  }
  mkLayer(seed, col, minH, maxH, win) {
    const tw = 540, h = 300; return bake(tw, h, (g) => { let s = seed; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647; let x = 0; while (x < tw) { const bw = Math.min(tw - x, 30 + rr() * 40), bh = minH + rr() * (maxH - minH); g.fillStyle = col; g.fillRect(x, h - bh, bw, bh); if (win) { g.fillStyle = win; for (let y = h - bh + 8; y < h - 6; y += 12) for (let xx = x + 5; xx < x + bw - 6; xx += 10) if (rr() < 0.22) g.fillRect(xx, y, 4, 5); } x += bw + (rr() < 0.3 ? 4 : 0); } });
  }
  initBg() {
    const W = this.W, H = this.H; this.bgk = { sky: vgrad([[0, '#05061f'], [0.45, '#14104a'], [0.8, '#35176b'], [1, '#6d28a8']], 4, 256), far: this.mkLayer(11, '#1b1650', 90, 190, 'rgba(165,180,252,.35)'), mid: this.mkLayer(23, '#241a66', 60, 150, 'rgba(253,230,138,.55)'), towers: [0, 1, 2].map(i => this.mkTower(i)) };
    this.stars = Array.from({ length: 50 }, () => ({ x: Math.random() * W, y: Math.random() * H * 0.55, r: Math.random() * 1.4 + 0.4, tw: Math.random() * 6 }));
  }
  update(dt) {
    if (!this.bgk) this.initBg(); this.tt += dt; this.vy = Math.min(900, this.vy + 1450 * dt); this.y += this.vy * dt; this.tilt = lerp(this.tilt, clamp(this.vy / 700, -0.45, 0.9), Math.min(1, dt * 10)); this.cnt += dt * 28;
    const v = this.spd(); this.x += v * dt; this.setLevel(this.score / 80);
    while (this.next < this.x + this.W + 80) {
      const g = this.gap(), lo = this.ceil + 60, hi = this.ground - g - 60, prev = this.pipes.length ? this.pipes[this.pipes.length - 1] : null; const ps = prev ? prev.top0 : null; const reach = prev ? Math.min(210, 90 + this.spd() * 0.45) : 0;
      let top = lo + this.r() * Math.max(10, hi - lo); if (ps != null) top = clamp(top, ps - reach, ps + reach); top = clamp(top, lo, hi);
      const amp = this.score >= 30 ? Math.min(56, 14 + (this.score - 30) * 1.5) : 0;
      this.pipes.push({ x: this.next, top, top0: top, g, passed: false, amp, ph: this.r() * TAU, coin: this.r() < 0.5, got: false, v: this.pipes.length % 3 }); this.next += Math.max(250, 330 - this.score * 0.9);
    }
    const r = 17, hx = this.hx;
    for (const p of this.pipes) {
      if (p.amp) { const lo = this.ceil + 60, hi = this.ground - 60 - p.g; p.top = clamp(p.top0 + Math.sin(this.tt * 1.3 + p.ph) * p.amp, lo, hi); }
      const sx = p.x - this.x;
      if (!p.passed && sx + TW < hx - r) { p.passed = true; this.score++; this.sfx.tone(880, 0.06, { vol: 0.22 }); this.fx.ring(hx, this.y, '#c4b5fd', 6, 34, 0.3, 2); }
      if (p.coin && !p.got && Math.hypot(sx + TW / 2 - hx, p.top + p.g / 2 - this.y) < r + 18) { p.got = true; this.coins++; this.pop(hx, this.y - 30, '+1 coin', '#fde047', 18); this.sfx.chord([988, 1318], 0.1, { type: 'triangle', vol: 0.2 }); this.fx.burst(sx + TW / 2, p.top + p.g / 2, ['#fde047', '#fff'], 8, 200, 0.5, 14); }
      if (hx + r - 4 > sx && hx - r + 4 < sx + TW && (this.y - r + 4 < p.top || this.y + r - 4 > p.top + p.g)) return this.crash();
    }
    if (this.y + r > this.ground || this.y - r < this.ceil - 20) return this.crash();
    this.pipes = this.pipes.filter(p => p.x - this.x > -120);
    if (Math.random() < 0.5) this.fx.add({ k: 4, x: hx - 34, y: this.y + 6, vx: -v * 0.6, vy: rnd(-10, 10), g: 0, life: 0.5, max: 0.5, c: '#c7d2fe', s: 9 });
  }
  dyingUpdate(dt) { this.vy = Math.min(900, this.vy + 1450 * dt); this.y = Math.min(this.ground - 14, this.y + this.vy * dt); this.tilt += dt * 6; }
  crash() { if (this.crashed) return; this.crashed = true; this.fx.burst(this.hx, this.y, ['#fde68a', '#fb923c', '#fff'], 18, 320, 0.7, 20); this.fx.debris(this.hx, this.y, '#93c5fd', 8, 300, 1, 8); this.fx.ring(this.hx, this.y, '#fff', 8, 80, 0.45, 5); this.hitstop(0.1); this.vy = -200; this.kill(0.9, '#a78bfa'); }
  render(ctx) {
    if (!this.bgk) this.initBg(); const K = this.bgk, P = this.P, W = this.W, H = this.H, hx = this.hx; ctx.drawImage(K.sky, 0, 0, W, H);
    ctx.fillStyle = '#e0e7ff'; for (const s of this.stars) { ctx.globalAlpha = 0.4 + 0.5 * Math.sin(this.t * 1.6 + s.tw) ** 2; ctx.fillRect(s.x, s.y, s.r, s.r); } ctx.globalAlpha = 1;
    halo(ctx, '#c7d2fe', W * 0.78, 150, 110, 0.35); ctx.fillStyle = '#eef2ff'; ctx.beginPath(); ctx.arc(W * 0.78, 150, 30, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(165,180,252,.35)'; ctx.beginPath(); ctx.arc(W * 0.78 - 8, 144, 8, 0, TAU); ctx.arc(W * 0.78 + 9, 158, 5, 0, TAU); ctx.fill();
    const lay = (img, sp, y, a) => { const off = (this.x * sp) % 540; ctx.globalAlpha = a; for (let ox = -off; ox < W; ox += 540) ctx.drawImage(img, ox, y - 300 + 0, 540, 300); ctx.globalAlpha = 1; };
    lay(K.far, 0.1, this.ground - 6, 1); lay(K.mid, 0.25, this.ground, 1);
    for (const p of this.pipes) {
      const sx = p.x - this.x, tex = K.towers[p.v], bh = this.ground - (p.top + p.g);
      ctx.drawImage(tex, 0, 0, TW * 2, bh * 2, sx, p.top + p.g, TW, bh);
      ctx.save(); ctx.translate(sx, p.top); ctx.scale(1, -1); ctx.drawImage(tex, 0, 0, TW * 2, Math.min(this.ground, p.top + 20) * 2, 0, 0, TW, Math.min(this.ground, p.top + 20)); ctx.restore();
      ctx.globalAlpha = 0.2; const hue = ['#22d3ee', '#a855f7', '#f472b6'][p.v]; ctx.fillStyle = hue; ctx.fillRect(sx - 2, p.top - 3, TW + 4, 3); ctx.fillRect(sx - 2, p.top + p.g, TW + 4, 3); ctx.globalAlpha = 1;
      if (p.coin && !p.got) { const cy = p.top + p.g / 2, bob = Math.sin(this.t * 4 + p.x) * 4; halo(ctx, '#fde047', sx + TW / 2, cy + bob, 30, 0.6); spr(ctx, P, 'star', sx + TW / 2, cy + bob, 26, 0, Math.sin(this.t * 3 + p.x) * 0.25); }
    }
    const gg = ctx.createLinearGradient(0, this.ground, 0, H); gg.addColorStop(0, '#2a1a6a'); gg.addColorStop(1, '#0a0824'); ctx.fillStyle = gg; ctx.fillRect(0, this.ground, W, H - this.ground); ctx.fillStyle = '#22d3ee'; ctx.globalAlpha = 0.8; ctx.fillRect(0, this.ground, W, 2); ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(167,139,250,.35)'; ctx.lineWidth = 2; ctx.beginPath(); for (let i = 0; i < 12; i++) { const gx = ((i * 54 - this.x * 1.0) % (W + 54) + W + 54) % (W + 54) - 54; ctx.moveTo(gx, this.ground + 2); ctx.lineTo(gx - 20, H); } ctx.stroke();
    // plane
    const fr = ['p1', 'p2', 'p3', 'p2'][Math.floor(this.cnt) % 4]; halo(ctx, '#a5b4fc', hx, this.y, 40, 0.18); spr(ctx, P, fr, hx, this.y, 54, 0, this.tilt);
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(hx, this.ground + 10, 20 * clamp(1 - (this.ground - this.y) / 700, 0.3, 1), 4, 0, 0, TAU); ctx.fill();
    this.hud(ctx, { best: this.best, label: 'TOWERS', chip: this.coins ? '★ ' + this.coins : '', chipColor: 'rgba(251,191,36,.45)' });
    if (this.score >= 30 && this.score < 33) this.text(ctx, 'GAPS ARE SLIDING!', W / 2, H * 0.3, { size: 22, color: '#f0abfc', align: 'center', glow: '#a855f7' });
    if (this.state === 'play' && this.playT < 2.2) this.text(ctx, 'TAP TO FLY', W / 2, H * 0.62, { size: 20, color: '#fff', align: 'center', glow: '#a78bfa' });
  }
}

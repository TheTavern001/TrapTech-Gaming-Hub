// Sky Hopper - tap-to-fly gap runner (original code). v5 art: night-city panorama (Poly Haven CC0 HDRI), brushed-metal towers (Poly Haven CC0), Kenney CC0 astronaut + gold-coin photo (public domain).
import { Game, TAU, clamp, roundRect, fmt, loadArt, pattern, cover } from './engine.js';
export class SkyHopper extends Game {
  get title() { return 'SKY HOPPER'; }
  get hint() { return 'Tap (or press Space) to boost up, let go to fall. Fly through the gaps between the towers. Every tower passed is +1, coins in the gaps are a bonus. One hit ends the run.'; }
  async load() { this.art = await loadArt({ city: 'jp-city.webp', metal: 'metal-plate.webp', hero: '/assets/game/hero_fly.png', coin: 'coin.webp' }); }
  layout() { this.hx = Math.min(this.W * 0.3, 160); this.ground = this.H - 40; }
  reset() { this.score = 0; this.coins = 0; this.y = this.H * 0.45; this.vy = 0; this.x = 0; this.pipes = []; this.next = 420; this.dead = 0; this.layout(); }
  gap() { return Math.max(150, 215 - this.score * 2.2); }
  spd() { return Math.min(300, 185 + this.score * 3); }
  flap() { if (this.dead) return; this.vy = -430; this.sfx.tone(520, 0.07, { type: 'triangle', vol: 0.22, slide: 1.4 }); }
  onDown() { this.flap(); }
  onKey(code, down) { if (down && (code === 'Space' || code === 'ArrowUp' || code === 'KeyW')) this.flap(); }
  update(dt) {
    this.vy = Math.min(900, this.vy + 1450 * dt); this.y += this.vy * dt;
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.finish(); return; }
    const v = this.spd(); this.x += v * dt;
    while (this.next < this.x + this.W + 80) { const g = this.gap(); const top = 130 + this.r() * (this.ground - 130 - g - 60); this.pipes.push({ x: this.next, top, g, passed: false, coin: this.r() < 0.55, got: false }); this.next += 270 + this.r() * 60; }
    const r = 18; const hx = this.hx;
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
    if (A.city) { const ih = this.H, iw = A.city.width * ih / A.city.height; for (let x = -((this.x * 0.15) % iw); x < this.W; x += iw) ctx.drawImage(A.city, x, 0, iw, ih); ctx.fillStyle = 'rgba(8,6,30,0.45)'; ctx.fillRect(0, 0, this.W, this.H); } else this.bg(ctx);
    const mp = pattern(ctx, A.metal);
    for (const p of this.pipes) {
      const sx = p.x - this.x, w = 74; if (sx > this.W || sx + w < 0) continue;
      for (const [y0, y1] of [[0, p.top], [p.top + p.g, this.ground]]) { ctx.save(); ctx.fillStyle = mp || '#475569'; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 12; ctx.fillRect(sx, y0, w, y1 - y0); ctx.restore(); const g = ctx.createLinearGradient(sx, 0, sx + w, 0); g.addColorStop(0, 'rgba(0,0,0,0.45)'); g.addColorStop(0.4, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(sx, y0, w, y1 - y0); }
      ctx.fillStyle = '#f472b6'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = 12; ctx.fillRect(sx - 4, p.top - 10, w + 8, 10); ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.fillRect(sx - 4, p.top + p.g, w + 8, 10); ctx.shadowBlur = 0;
      if (p.coin && !p.got && A.coin) { const s = 30 * (0.8 + 0.2 * Math.abs(Math.sin(this.t * 4))); ctx.drawImage(A.coin, sx + w / 2 - s / 2, p.top + p.g / 2 - 15, s, 30); }
    }
    ctx.fillStyle = 'rgba(5,6,20,0.9)'; ctx.fillRect(0, this.ground, this.W, this.H - this.ground); ctx.fillStyle = '#7c4dff'; ctx.fillRect(0, this.ground, this.W, 3);
    ctx.save(); ctx.translate(this.hx, this.y); ctx.rotate(clamp(this.vy / 900, -0.5, 0.9)); if (A.hero) ctx.drawImage(A.hero, -26, -26, 52, 52); else { ctx.fillStyle = '#c4b5fd'; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); }
    if (this.vy < -100 && !this.dead) { ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(-20, 8); ctx.lineTo(-34 - Math.random() * 10, 16); ctx.lineTo(-20, 22); ctx.fill(); }
    ctx.restore();
    this.text(ctx, String(this.score), this.W / 2, 150, { size: 54, weight: 900, align: 'center', glow: '#7c4dff' });
    this.text(ctx, `BEST ${fmt(Math.max(this.best, this.score))}`, 18, 30, { size: 12, weight: 700, color: '#b9b3ff', font: 'Exo' });
    this.text(ctx, `COINS ${this.coins}`, this.W - 18, 30, { size: 12, weight: 700, color: '#fde047', align: 'right' });
  }
}

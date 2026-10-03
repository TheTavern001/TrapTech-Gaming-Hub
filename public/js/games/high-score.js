// High Score - neon reflex target game. Original code/art.
// v5 art: brick wall (Poly Haven CC0 brick_wall_02), real archery-target photo (rawpixel, public domain), gold-coin bonus targets (Wikimedia, public domain). See /CREDITS.md
import { Game, TAU, rnd, clamp, fmt, loadArt } from './engine.js';
export class HighScore extends Game {
  get title() { return 'HIGH SCORE'; }
  get hint() { return 'Tap targets before they vanish. Dead-center hits score more, gold = x2, never tap red bombs. 3 lives.'; }
  get startOnTapOnly() { return true; }
  reset() { this.score = 0; this.coins = 0; this.lives = 3; this.combo = 0; this.targets = []; this.spawnT = 0.5; this.hits = 0; this.rings = []; this.hurt = 0; this.endT = 0; this.dead = false; }
  diff() { return clamp(this.playT / 90, 0, 1); }
  mult() { return Math.min(5, 1 + Math.floor(this.combo / 5)); }
  spawn() {
    const d = this.diff(); const R = 48 - d * 16; const top = 110, pad = R + 12;
    let x, y, tries = 0;
    do { x = rnd(pad, this.W - pad); y = rnd(top + pad, this.H - pad); tries++; } while (tries < 20 && this.targets.some(t => Math.hypot(t.x - x, t.y - y) < t.R + R + 16));
    const roll = Math.random(); const type = this.playT > 8 && roll < 0.13 + d * 0.07 ? 'bomb' : roll > 0.9 ? 'gold' : 'norm';
    this.targets.push({ x, y, R, life: 1.85 - d * 0.9, age: 0, type, hue: rnd(0, 1) });
  }
  onDown(x, y) {
    let best = null, bd = 1e9;
    for (const t of this.targets) { const r = t.R * (1 - t.age / t.life * 0.75); const d = Math.hypot(t.x - x, t.y - y); if (d < r + 10 && d < bd) { best = t; bd = d; } }
    if (!best) { if (this.combo > 0) this.pop(x, y, 'COMBO LOST', '#94a3b8', 16); this.combo = 0; this.rings.push({ x, y, r: 4, life: 0.3, c: '#64748b' }); this.sfx.tone(160, 0.06, { type: 'square', vol: 0.08 }); return; }
    this.targets = this.targets.filter(t => t !== best);
    if (best.type === 'bomb') { this.loseLife(best.x, best.y, 'BOOM'); this.burst(best.x, best.y, ['#ef4444', '#f97316', '#fde047'], 30, 380, 0.7, 5); this.sfx.noise(0.35, { vol: 0.5, freq: 300 }); return; }
    const r = best.R * (1 - best.age / best.life * 0.75); const acc = clamp(Math.round(15 * (1 - bd / r)), 0, 15);
    this.combo++; this.hits++; const pts = (10 + acc) * this.mult() * (best.type === 'gold' ? 2 : 1); this.score += pts; if (best.type === 'gold') this.coins++;
    this.pop(best.x, best.y - best.R, `+${pts}${acc >= 13 ? ' BULLSEYE' : ''}`, best.type === 'gold' ? '#fde047' : acc >= 13 ? '#34d399' : '#22d3ee', acc >= 13 ? 24 : 20);
    this.burst(best.x, best.y, best.type === 'gold' ? ['#fde047', '#fbbf24'] : ['#22d3ee', '#a855f7', '#f0abfc'], 16, 260, 0.5, 4);
    this.rings.push({ x: best.x, y: best.y, r: r, life: 0.35, c: best.type === 'gold' ? '#fde047' : '#22d3ee' });
    this.sfx.tone(520 + Math.min(12, this.combo) * 45, 0.07, { type: 'triangle', vol: 0.3 });
  }
  loseLife(x, y, msg) { this.lives--; this.combo = 0; this.hurt = 0.35; this.pop(x, y, msg, '#f87171', 22); this.sfx.tone(180, 0.25, { type: 'sawtooth', vol: 0.2, slide: 0.5 }); if (this.lives <= 0) { this.lives = 0; this.dead = true; } }
  update(dt) {
    if (this.hurt > 0) this.hurt -= dt;
    for (const r of this.rings) { r.r += 140 * dt; r.life -= dt; } this.rings = this.rings.filter(r => r.life > 0);
    if (this.dead) { this.endT += dt; if (this.endT > 0.8) { this.sfx.lose(); this.finish(); } return; }
    const d = this.diff(); this.spawnT -= dt;
    if (this.spawnT <= 0 && this.targets.length < 5) { this.spawn(); this.spawnT = rnd(0.95, 1.15) - d * 0.55; }
    for (const t of this.targets) t.age += dt;
    for (const t of this.targets.filter(t => t.age >= t.life)) { if (t.type !== 'bomb') this.loseLife(t.x, t.y, 'MISS'); }
    this.targets = this.targets.filter(t => t.age < t.life);
  }
  async load() { this.art = await loadArt({ wall: 'hs-wall.webp', target: 'hs-target.webp', coin: 'coin-lg.webp' }); }
  render(ctx) {
    const A = this.art || {}; this.photoBg(ctx, A.wall, 'rgba(8,6,16,0.55)');
    if (A.wall) { const v = ctx.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.2, this.W / 2, this.H / 2, this.H * 0.75); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = v; ctx.fillRect(0, 0, this.W, this.H); }
    if (this.hurt > 0) { ctx.fillStyle = `rgba(239,68,68,${this.hurt * 0.5})`; ctx.fillRect(0, 0, this.W, this.H); }
    for (const r of this.rings) { ctx.globalAlpha = Math.max(0, r.life / 0.35); ctx.strokeStyle = r.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1;
    for (const t of this.targets) {
      const k = t.age / t.life; const r = t.R * (1 - k * 0.75); const pulse = 1 + Math.sin(this.t * 10) * 0.04;
      ctx.save(); ctx.translate(t.x, t.y);
      if (t.type === 'bomb') {
        ctx.beginPath(); ctx.arc(0, 0, r * pulse, 0, TAU); ctx.fillStyle = '#7f1d1d'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 20; ctx.fill(); ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.4); ctx.moveTo(r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.4, r * 0.4); ctx.stroke();
      } else if ((t.type === 'gold' ? A.coin : A.target)) {
        const im = t.type === 'gold' ? A.coin : A.target; ctx.shadowColor = t.type === 'gold' ? '#fbbf24' : 'rgba(0,0,0,0.7)'; ctx.shadowBlur = t.type === 'gold' ? 22 : 12; ctx.drawImage(im, -r * pulse, -r * pulse, r * 2 * pulse, r * 2 * pulse); ctx.shadowBlur = 0;
        if (t.type === 'gold') this.text(ctx, 'x2', 0, r * 0.25, { size: Math.max(10, r * 0.6), weight: 900, align: 'center', color: '#fff', glow: '#b45309' });
        ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, t.R + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.stroke();
      } else {
        const c1 = t.type === 'gold' ? '#fde047' : t.hue < 0.5 ? '#22d3ee' : '#c084fc'; const c2 = t.type === 'gold' ? '#b45309' : '#4c1d95';
        ctx.shadowColor = c1; ctx.shadowBlur = 22;
        for (let i = 3; i >= 1; i--) { ctx.beginPath(); ctx.arc(0, 0, r * i / 3, 0, TAU); ctx.fillStyle = i % 2 ? c1 : c2; ctx.fill(); }
        ctx.shadowBlur = 0; ctx.beginPath(); ctx.arc(0, 0, Math.max(2, r * 0.12), 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        // countdown ring
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, t.R + 6, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.stroke();
      }
      ctx.restore();
    }
    this.hudScore(ctx);
    this.text(ctx, 'LIVES', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(this.W - 26 - i * 24, 50, 8, 0, TAU); ctx.fillStyle = i < this.lives ? '#f472b6' : 'rgba(148,163,184,0.25)'; ctx.shadowColor = '#f472b6'; ctx.shadowBlur = i < this.lives ? 10 : 0; ctx.fill(); } ctx.shadowBlur = 0;
    this.text(ctx, `x${this.mult()}  COMBO ${this.combo}`, this.W - 18, 82, { size: 13, weight: 800, align: 'right', color: this.mult() > 1 ? '#fde047' : '#c4b5fd' });
  }
}

// High Score v8 - neon funfair shooting gallery reflex game. Rebuilt: Kenney Shooting Gallery ducks + crosshairs (CC0) under neon string lights,
// purple stage curtain, glowing bullseye rings, drifting targets, feather bursts, combo fire, bombs with lit fuse. Rules unchanged
// (src/ac-levels.js 'high-score'): (10 + accuracy 0..15) x combo multiplier x gold, 3 lives, a heart every 100 hits, endless ramp.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, loadPack, spr, halo, bake, roundRect, mix } from './kit.js';
export class HighScore extends Game8 {
  get title() { return 'HIGH SCORE'; }
  get hint() { return 'Tap the bullseyes before the ducks fly off. Dead-center hits score more, golden ducks are worth double, never tap a bomb. 3 lives, a heart every 100 hits. It only gets faster.'; }
  get startOnTapOnly() { return true; }
  get accent() { return '#fbbf24'; }
  get musicOpts() { return { root: 65, bpm: 126, mode: 'major', seed: 11, vol: 0.3 }; }
  async load() { this.P = await loadPack('high-score'); }
  layout() { this.bgc = null; }
  reset() { super.reset(); this.score = 0; this.coins = 0; this.lives = 3; this.combo = 0; this.targets = []; this.spawnT = 0.5; this.hits = 0; this.hurt = 0; this.shots = []; this.feathers = []; }
  diff() { return clamp(this.playT / 90, 0, 1); }
  over() { return clamp((this.playT - 90) / 240, 0, 1); }
  mult() { return Math.min(5, 1 + Math.floor(this.combo / 5)); }
  range(a, b) { return a + this.r() * (b - a); }
  spawn() {
    const d = this.diff(), o = this.over(), R = 46 - d * 15 - o * 8, top = 124, pad = R + 12; let x, y, tries = 0;
    do { x = this.range(pad, this.W - pad); y = this.range(top + pad, this.H - pad - 20); tries++; } while (tries < 20 && this.targets.some(t => Math.hypot(t.x - x, t.y - y) < t.R + R + 16));
    const roll = this.r(), type = this.playT > 8 && roll < 0.13 + d * 0.07 ? 'bomb' : roll > 0.9 ? 'gold' : 'norm';
    this.targets.push({ x, y, x0: x, R, life: Math.max(0.6, 1.85 - d * 0.9 - o * 0.3), age: 0, type, skin: Math.floor(this.r() * 3), ph: this.r() * TAU, dir: this.r() < 0.5 ? -1 : 1 });
  }
  cur(t) { return { x: t.x0 + Math.sin(t.age * 2.4 + t.ph) * 10 * (1 + this.diff()), r: t.R * (1 - t.age / t.life * 0.75) }; }
  onDown(x, y) {
    this.shots.push({ x, y, t: 0.3 }); let best = null, bd = 1e9;
    for (const t of this.targets) { const c = this.cur(t), d = Math.hypot(c.x - x, t.x === undefined ? 0 : t.y - y); if (d < c.r + 10 && d < bd) { best = t; bd = d; } }
    if (!best) { if (this.combo > 0) this.pop(x, y, 'COMBO LOST', '#94a3b8', 16); if (this.combo) this.mark('x'); this.combo = 0; this.fx.ring(x, y, '#64748b', 4, 26, 0.3, 2); this.sfx.tone(160, 0.06, { type: 'square', vol: 0.08 }); return; }
    const c = this.cur(best); this.targets = this.targets.filter(t => t !== best);
    if (best.type === 'bomb') { this.loseLife(c.x, best.y, 'BOOM'); this.fx.burst(c.x, best.y, ['#ef4444', '#f97316', '#fde047'], 20, 420, 0.7, 20); this.fx.ring(c.x, best.y, '#f97316', 10, 120, 0.5, 6); this.fx.shake(14); this.sfx.noise(0.35, { vol: 0.45, freq: 300 }); return; }
    const acc = clamp(Math.round(15 * (1 - bd / c.r)), 0, 15); this.combo++; this.hits++; if (this.hits % 100 === 0 && this.lives < 5) { this.lives++; this.pop(this.W / 2, 150, '+1 LIFE', '#f472b6', 26); }
    const pts = this.award((10 + acc) * this.mult() * (best.type === 'gold' ? 2 : 1), 'h'); if (best.type === 'gold') this.coins++; this.setLevel(this.combo / 40);
    const gold = best.type === 'gold', col = gold ? '#fde047' : '#22d3ee'; this.pop(c.x, best.y - c.r, `+${pts}${acc >= 13 ? ' BULLSEYE' : ''}`, gold ? '#fde047' : acc >= 13 ? '#34d399' : '#67e8f9', acc >= 13 ? 24 : 20);
    this.fx.sparks(c.x, best.y, [col, '#fff'], 10, 380, 0.45, 16); this.fx.ring(c.x, best.y, col, 6, c.r * 1.8, 0.4, 4); this.fx.shake(acc >= 13 ? 4 : 1.5); if (acc >= 13) this.hitstop(0.03);
    for (let i = 0; i < 9; i++) this.feathers.push({ x: c.x, y: best.y, vx: rnd(-160, 160), vy: rnd(-260, -40), r: Math.random() * TAU, vr: rnd(-6, 6), life: 1, c: gold ? '#fde047' : ['#fff', '#fde68a', '#fed7aa'][i % 3] });
    this.sfx.tone(520 + Math.min(12, this.combo) * 45, 0.07, { type: 'triangle', vol: 0.28 }); if (gold) this.sfx.chord([880, 1320], 0.12, { type: 'triangle', vol: 0.18 });
  }
  loseLife(x, y, msg) { this.lives--; this.combo = 0; this.mark('x'); this.hurt = 0.35; this.pop(x, y, msg, '#f87171', 22); this.sfx.tone(180, 0.25, { type: 'sawtooth', vol: 0.18, slide: 0.5 }); this.fx.flash('#ef4444', 0.2); if (this.lives <= 0) { this.lives = 0; this.kill(0.8, '#fbbf24'); } }
  update(dt) {
    if (this.hurt > 0) this.hurt -= dt; for (const s of this.shots) s.t -= dt; this.shots = this.shots.filter(s => s.t > 0);
    for (const f of this.feathers) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 520 * dt; f.vx *= 0.99; f.r += f.vr * dt; f.life -= dt * 0.9; } this.feathers = this.feathers.filter(f => f.life > 0);
    const d = this.diff(); this.spawnT -= dt; if (this.spawnT <= 0 && this.targets.length < 5 + Math.round(this.over() * 2)) { this.spawn(); this.spawnT = Math.max(0.32, this.range(0.95, 1.15) - d * 0.55 - this.over() * 0.12); }
    for (const t of this.targets) t.age += dt; for (const t of this.targets.filter(t => t.age >= t.life)) if (t.type !== 'bomb') this.loseLife(this.cur(t).x, t.y, 'MISS'); this.targets = this.targets.filter(t => t.age < t.life);
  }
  initBg() {
    const W = this.W, H = this.H, P = this.P; this.bgc = bake(Math.round(W / 2), Math.round(H / 2), (g, w, h) => {
      g.scale(0.5, 0.5); if (P && P.f.wood) { const f = P.f.wood; for (let y = 0; y < H; y += 256) for (let x = 0; x < W; x += 256) g.drawImage(P.img, f[0], f[1], f[2], f[3], x, y, 256, 256); } g.fillStyle = 'rgba(10,6,34,.82)'; g.fillRect(0, 0, W, H);
      const rg = g.createRadialGradient(W / 2, H * 0.5, 0, W / 2, H * 0.5, H * 0.7); rg.addColorStop(0, 'rgba(139,92,246,.35)'); rg.addColorStop(1, 'rgba(10,6,34,0)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(167,139,250,.07)'; for (let x = 0; x < W; x += 54) g.fillRect(x, 0, 2, H);
    });
  }
  bomb(ctx, x, y, r) {
    halo(ctx, '#ef4444', x, y, r * 2.2, 0.55 + 0.3 * Math.sin(this.t * 12)); const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); g.addColorStop(0, '#64748b'); g.addColorStop(0.5, '#1e293b'); g.addColorStop(1, '#020617'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y + r * 0.1, r * 0.9, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#a16207'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + r * 0.2, y - r * 0.75); ctx.quadraticCurveTo(x + r * 0.7, y - r * 1.1, x + r * 0.6, y - r * 1.3); ctx.stroke();
    halo(ctx, '#fde047', x + r * 0.6, y - r * 1.3, r * 0.8, 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + r * 0.6, y - r * 1.3, r * 0.12, 0, TAU); ctx.fill(); this.text(ctx, '!', x, y + r * 0.45, { size: r * 1.1, color: '#ef4444', align: 'center' });
  }
  render(ctx) {
    if (!this.bgc) this.initBg(); const W = this.W, H = this.H, P = this.P; ctx.drawImage(this.bgc, 0, 0, W, H);
    // curtain + string lights
    if (P && P.f.curtain) { const f = P.f.curtain, h = 270 * f[3] / f[2] * 2.0; ctx.drawImage(P.img, f[0], f[1], f[2], f[3], 0, 62, W, Math.min(h, 110)); }
    const LC = ['#f472b6', '#22d3ee', '#fde047', '#a3e635']; for (let i = 0; i < 12; i++) { const x = 20 + i * ((W - 40) / 11), y = 150 + Math.sin(i * 0.9) * 6 + Math.abs(i - 5.5) * 1.2; halo(ctx, LC[i % 4], x, y, 22, 0.5 + 0.35 * Math.sin(this.t * 3 + i)); ctx.fillStyle = LC[i % 4]; ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 12; i++) { const x = 20 + i * ((W - 40) / 11), y = 150 + Math.sin(i * 0.9) * 6 + Math.abs(i - 5.5) * 1.2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
    if (this.hurt > 0) { ctx.fillStyle = `rgba(239,68,68,${this.hurt * 0.45})`; ctx.fillRect(0, 0, W, H); }
    for (const t of this.targets) {
      const c = this.cur(t), k = t.age / t.life, r = c.r, x = c.x, y = t.y, pulse = 1 + Math.sin(this.t * 10 + t.ph) * 0.03;
      if (t.type === 'bomb') { this.bomb(ctx, x, y, r * pulse); continue; }
      const gold = t.type === 'gold'; halo(ctx, gold ? '#fbbf24' : '#a78bfa', x, y, r * 2.1, gold ? 0.7 : 0.35);
      const nm = gold ? 'duck_y' : ['duck_b', 'duck_w', 'duck_y'][t.skin], w = r * 2.7 * pulse, h = w * (P && P.f[nm] ? P.f[nm][3] / P.f[nm][2] : 1);
      if (!spr(ctx, P, nm, x + w * 0.02, y - h * 0.2, w, 0, 0, 1, t.dir < 0)) { ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
      // neon bullseye (the exact hit centre)
      const br = r * 0.62; ctx.fillStyle = 'rgba(8,6,28,.82)'; ctx.beginPath(); ctx.arc(x, y, br, 0, TAU); ctx.fill(); ctx.lineWidth = Math.max(2, br * 0.16); for (let i = 0; i < 3; i++) { ctx.strokeStyle = [gold ? '#fde047' : '#22d3ee', '#fff', gold ? '#f59e0b' : '#a855f7'][i]; ctx.beginPath(); ctx.arc(x, y, br * (1 - i * 0.32), 0, TAU); ctx.stroke(); } ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(x, y, br * 0.16, 0, TAU); ctx.fill();
      if (gold) this.text(ctx, 'x2', x + r * 0.9, y - r * 0.9, { size: Math.max(11, r * 0.5), color: '#fde047', align: 'center', glow: '#b45309' });
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, r + 8, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - k)); ctx.stroke();
    }
    for (const f of this.feathers) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.globalAlpha = Math.min(1, f.life * 1.5); ctx.fillStyle = f.c; ctx.beginPath(); ctx.ellipse(0, 0, 5, 2, 0, 0, TAU); ctx.fill(); ctx.restore(); } ctx.globalAlpha = 1;
    for (const s of this.shots) { ctx.globalAlpha = s.t / 0.3; spr(ctx, P, 'cross', s.x, s.y, 30 + (0.3 - s.t) * 60); } ctx.globalAlpha = 1;
    this.hud(ctx, { best: this.best, lives: this.lives, maxLives: 5, chip: 'x' + this.mult(), chipColor: this.mult() >= 4 ? 'rgba(251,191,36,.6)' : 'rgba(139,92,246,.45)' });
    if (this.combo >= 5) this.text(ctx, this.combo + ' COMBO', W / 2, H - 22, { size: 18, color: '#fde047', align: 'center', glow: '#f59e0b' });
  }
}

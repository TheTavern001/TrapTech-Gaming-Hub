// Terp Tapper v8 - four-lane rhythm tapper on a perspective neon highway. Rebuilt: baked citrus-slice orbs, depth-scaled note highway, beat-reactive
// skyline + grid, lane beams and hit shockwaves, fever glow at big combos, synthesized live backing track that locks to the note beat.
// Rules unchanged (src/ac-levels.js 'terp-tapper'): 100 / 60 / 30 x combo multiplier (up to x4), 5 lives, tempo keeps rising.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, halo, bake, roundRect, mix, lighten, shade } from './kit.js';
const LANE_COL = ['#a3e635', '#fde047', '#fb923c', '#f472b6'];
const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const SCALE = [261.6, 311.1, 349.2, 392.0, 466.2, 523.3, 622.3, 698.5];
const WIN = { perfect: 0.06, great: 0.12, good: 0.18 };
const TOP = 104;
function orb(col) {
  return bake(128, 128, (g) => {
    g.translate(64, 64); const rg = g.createRadialGradient(-16, -18, 4, 0, 0, 58); rg.addColorStop(0, lighten(col, 0.7)); rg.addColorStop(0.55, col); rg.addColorStop(1, shade(col, 0.5)); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 56, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 50, 0, TAU); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * TAU / 8 + 0.2; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); g.lineTo(Math.cos(a) * 44, Math.sin(a) * 44); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-20, -26, 16, 9, -0.6, 0, TAU); g.fill();
  });
}
export class TerpTapper extends Game8 {
  get title() { return 'TERP TAPPER'; }
  get hint() { return 'Tap a lane (or D F J K) as each orb crosses the line. Perfect timing and long combos earn the big points. 5 lives, every 100-note combo heals one, and the tempo never stops climbing.'; }
  get startOnTapOnly() { return true; }
  get accent() { return '#f472b6'; }
  async load() { this.orbs = LANE_COL.map(orb); }
  layout() { this.hitY = this.H - 118; this.laneBot = Math.min(118, (this.W - 30) / 4); this.cxm = this.W / 2; this.bgc = null; }
  reset() { super.reset(); this.score = 0; this.coins = 0; this.lives = 5; this.combo = 0; this.maxCombo = 0; this.notes = []; this.nextBeat = 2.0; this.beatN = 0; this.press = [0, 0, 0, 0]; this.judge = null; this.lastLane = -1; this.beams = [0, 0, 0, 0]; this.lastBeat = -1; this.pulse = 0; }
  bpm() { const t = this.playT || 0; return t <= 120 ? 96 + t * 0.6 : Math.min(220, 168 + (t - 120) * 0.15); }
  speed() { return 470 + clamp((this.playT || 0) / 120, 0, 1) * 380; }
  mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }
  lane() { let l; do { l = Math.floor(this.r() * 4); } while (l === this.lastLane && this.r() < 0.6); this.lastLane = l; return l; }
  schedule() {
    while (this.nextBeat < this.playT + 3) {
      const beat = 60 / this.bpm(), t = this.nextBeat, r = this.r();
      if (this.beatN % 16 === 15) { /* breath */ } else if (r < 0.1 && this.playT > 10) { const a = this.lane(); let b; do { b = Math.floor(this.r() * 4); } while (b === a); this.notes.push({ lane: a, t }, { lane: b, t }); }
      else if (r < 0.82) this.notes.push({ lane: this.lane(), t });
      if (this.r() < 0.18 && this.bpm() < 150 && this.playT > 6) this.notes.push({ lane: this.lane(), t: t + beat / 2 });
      this.nextBeat += beat; this.beatN++;
    }
  }
  // perspective: depth d in [0 (far) .. 1 (hit line and below)]
  proj(l, y) { const d = clamp((y - TOP) / (this.hitY - TOP), -0.2, 1.4), sc = lerp(0.34, 1, d); const w = this.laneBot * sc; return { x: this.cxm + (l - 1.5) * w, s: sc, w }; }
  onDown(x) { const l = Math.floor((x - (this.cxm - this.laneBot * 2)) / this.laneBot); if (l >= 0 && l < 4) this.hit(l); }
  onKey(c, d, e) { if (d && !e.repeat && KEYS[c] !== undefined) this.hit(KEYS[c]); }
  hit(l) {
    this.press[l] = 0.15; this.beams[l] = 0.3; const now = this.playT; let best = null, bd = 1;
    for (const n of this.notes) if (n.lane === l && !n.done) { const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > WIN.good) { if (this.combo >= 5) this.pop(this.W / 2, this.hitY - 90, 'COMBO BREAK', '#94a3b8', 16); if (this.combo) this.mark('x'); this.combo = 0; this.sfx.tone(140, 0.05, { type: 'square', vol: 0.06 }); return; }
    best.done = true; const q = bd <= WIN.perfect ? 'PERFECT' : bd <= WIN.great ? 'GREAT' : 'GOOD', base = q === 'PERFECT' ? 100 : q === 'GREAT' ? 60 : 30;
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); if (this.combo % 50 === 0) this.coins++; if (this.combo % 100 === 0 && this.lives < 5) { this.lives++; this.pop(this.W / 2, this.hitY - 130, '+1 LIFE', '#a3e635', 24); }
    this.award(base * this.mult(), 'n'); this.judge = { q, life: 0.5, col: q === 'PERFECT' ? '#fde047' : q === 'GREAT' ? '#34d399' : '#22d3ee' };
    const P = this.proj(l, this.hitY); this.fx.sparks(P.x, this.hitY, [LANE_COL[l], '#fff'], q === 'PERFECT' ? 14 : 7, 360, 0.45, 16, -Math.PI / 2, 2.4); this.fx.ring(P.x, this.hitY, LANE_COL[l], 8, 64, 0.35, 4); if (q === 'PERFECT') this.fx.shake(2.2);
    this.sfx.tone(SCALE[(l * 2 + (this.beatN % 3)) % SCALE.length], 0.16, { type: 'triangle', vol: 0.3 }); this.setLevel(this.combo / 80);
  }
  update(dt) {
    for (let i = 0; i < 4; i++) { if (this.press[i] > 0) this.press[i] -= dt; if (this.beams[i] > 0) this.beams[i] -= dt; } if (this.judge) { this.judge.life -= dt; if (this.judge.life <= 0) this.judge = null; }
    const bf = this.playT * this.bpm() / 60, bi = Math.floor(bf); this.pulse = 1 - (bf - bi);
    if (bi !== this.lastBeat && this.playT > 1.5) { this.lastBeat = bi; this.sfx.tone(62, 0.14, { type: 'sine', vol: 0.4, slide: 0.5 }); if (bi % 2 === 0) this.sfx.tone(SCALE[(bi >> 1) % 4] / 4, 0.3, { type: 'sawtooth', vol: 0.06 }); else this.sfx.noise(0.05, { vol: 0.05, freq: 6000 }); }
    this.schedule();
    for (const n of this.notes) if (!n.done && this.playT - n.t > WIN.good) { n.done = true; n.miss = true; this.lives--; this.combo = 0; this.mark('x'); const P = this.proj(n.lane, this.hitY); this.pop(P.x, this.hitY - 40, 'MISS', '#f87171', 20); this.fx.shake(5); this.fx.flash('#ef4444', 0.1); this.sfx.tone(200, 0.12, { type: 'sawtooth', vol: 0.12, slide: 0.6 }); if (this.lives <= 0) { this.lives = 0; this.kill(0.8, '#f472b6'); break; } }
    this.notes = this.notes.filter(n => !n.done || this.playT - n.t < 0.4);
  }
  initBg() {
    const W = this.W, H = this.H; this.bgc = bake(Math.round(W / 2), Math.round(H / 2), (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0624'); gr.addColorStop(0.5, '#1a0b45'); gr.addColorStop(1, '#10072e'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const sg = g.createRadialGradient(w / 2, h * 0.28, 0, w / 2, h * 0.28, w * 0.7); sg.addColorStop(0, 'rgba(244,114,182,.5)'); sg.addColorStop(1, 'rgba(244,114,182,0)'); g.fillStyle = sg; g.fillRect(0, 0, w, h);
      g.fillStyle = '#12082e'; let s = 5; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let x = 0; x < w;) { const bw = 12 + rr() * 22, bh = 30 + rr() * 80; g.fillRect(x, h * 0.3 - bh * 0.4, bw, bh + h * 0.3); x += bw + 2; }
      g.fillStyle = 'rgba(253,224,71,.5)'; for (let i = 0; i < 70; i++) g.fillRect(rr() * w, h * 0.12 + rr() * h * 0.22, 1.5, 2);
    });
  }
  render(ctx) {
    if (!this.bgc) this.initBg(); const W = this.W, H = this.H, hy = this.hitY, pulse = this.state === 'play' ? Math.pow(this.pulse, 3) : 0, fever = clamp((this.combo - 20) / 40, 0, 1);
    ctx.drawImage(this.bgc, 0, 0, W, H); halo(ctx, '#f472b6', W / 2, H * 0.2, W * 0.55, 0.25 + pulse * 0.3 + fever * 0.3);
    // highway trapezoid
    const tl = this.proj(0, TOP), tr = this.proj(3, TOP), bl = this.proj(0, H + 40), br = this.proj(3, H + 40);
    const x0 = (P) => P.x - P.w / 2, x1 = (P) => P.x + P.w / 2;
    ctx.beginPath(); ctx.moveTo(x0(tl), TOP); ctx.lineTo(x1(tr), TOP); ctx.lineTo(x1(br), H + 40); ctx.lineTo(x0(bl), H + 40); ctx.closePath(); const hg = ctx.createLinearGradient(0, TOP, 0, H); hg.addColorStop(0, 'rgba(10,6,36,.2)'); hg.addColorStop(1, 'rgba(24,12,62,.8)'); ctx.fillStyle = hg; ctx.fill(); ctx.strokeStyle = `rgba(167,139,250,${0.5 + pulse * 0.4})`; ctx.lineWidth = 2; ctx.stroke();
    for (let l = 0; l < 4; l++) { // lane tint + beam
      const a = this.proj(l, TOP), b = this.proj(l, H + 40), c = this.proj(l + 1, H + 40), d = this.proj(l + 1, TOP); const lx = (P, k) => P.x - P.w / 2 + 0; void lx;
      const xa = this.cxm + (l - 2) * this.proj(0, TOP).w, xb = this.cxm + (l - 1) * this.proj(0, TOP).w, xc = this.cxm + (l - 2) * this.proj(0, H + 40).w, xd = this.cxm + (l - 1) * this.proj(0, H + 40).w;
      const beam = this.beams[l] > 0 ? this.beams[l] / 0.3 : 0; ctx.beginPath(); ctx.moveTo(xa, TOP); ctx.lineTo(xb, TOP); ctx.lineTo(xd, H + 40); ctx.lineTo(xc, H + 40); ctx.closePath(); ctx.fillStyle = LANE_COL[l]; ctx.globalAlpha = 0.07 + beam * 0.3 + (this.press[l] > 0 ? 0.1 : 0); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(165,180,252,.28)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xa, TOP); ctx.lineTo(xc, H + 40); ctx.stroke(); void a; void b; void c; void d;
    }
    ctx.strokeStyle = 'rgba(165,180,252,.28)'; ctx.beginPath(); ctx.moveTo(x1(tr), TOP); ctx.lineTo(x1(br), H + 40); ctx.stroke();
    for (let k = 0; k < 9; k++) { const y = TOP + Math.pow(((k + (this.playT || 0) * 0.9 * this.bpm() / 60 % 1)) / 9, 2) * (H - TOP) * 1.0 + 0; const P = this.proj(0, y); ctx.strokeStyle = 'rgba(103,232,249,.12)'; ctx.beginPath(); ctx.moveTo(this.cxm - P.w * 2, y); ctx.lineTo(this.cxm + P.w * 2, y); ctx.stroke(); }
    // hit line
    const hl = this.proj(0, hy); ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14 + pulse * 16; ctx.fillRect(this.cxm - hl.w * 2, hy - 2, hl.w * 4, 4); ctx.restore();
    const keys = ['D', 'F', 'J', 'K'];
    for (let l = 0; l < 4; l++) { const P = this.proj(l, hy), pr = this.press[l] > 0, r = P.w * 0.34 * (pr ? 1.14 : 1); halo(ctx, LANE_COL[l], P.x, hy, r * 2.2, pr ? 0.8 : 0.3 + pulse * 0.15); ctx.beginPath(); ctx.arc(P.x, hy, r, 0, TAU); ctx.strokeStyle = LANE_COL[l]; ctx.lineWidth = 4; ctx.stroke(); this.text(ctx, keys[l], P.x, hy + P.w * 0.34 + 30, { size: 14, color: 'rgba(196,181,253,.6)', align: 'center' }); }
    // notes (far first)
    const sp = this.speed(); const now = this.playT || 0;
    for (const n of this.notes) { if (n.done && !n.miss && now - n.t > 0.05) continue; const y = hy - (n.t - now) * sp; if (y < TOP - 30 || y > H + 60) continue; const P = this.proj(n.lane, y), r = P.w * 0.36; if (n.miss) ctx.globalAlpha = 0.3; halo(ctx, LANE_COL[n.lane], P.x, y, r * 2, 0.55); ctx.drawImage(this.orbs[n.lane], P.x - r, y - r, r * 2, r * 2); ctx.globalAlpha = 1; }
    if (fever > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = fever * 0.25 * (0.6 + pulse * 0.4); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, W - 8, H - 8); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }
    this.hud(ctx, { best: this.best, lives: this.lives, maxLives: 5, chip: 'x' + this.mult(), chipColor: this.mult() >= 3 ? 'rgba(251,191,36,.6)' : 'rgba(139,92,246,.45)' });
    if (this.combo >= 3) { this.text(ctx, String(this.combo), W / 2, H * 0.36, { size: 54 + pulse * 6, color: '#fff', align: 'center', glow: '#f472b6' }); this.text(ctx, 'COMBO', W / 2, H * 0.36 + 22, { size: 13, color: '#f9a8d4', align: 'center' }); }
    if (this.judge) { ctx.globalAlpha = Math.min(1, this.judge.life * 3); this.text(ctx, this.judge.q, W / 2, hy - 64, { size: 26, color: this.judge.col, align: 'center', glow: this.judge.col }); ctx.globalAlpha = 1; }
    if (this.state === 'play' && this.playT < 2.4) this.text(ctx, 'GET READY', W / 2, H * 0.4, { size: 24, color: '#fff', align: 'center', glow: '#8b5cf6' });
  }
}

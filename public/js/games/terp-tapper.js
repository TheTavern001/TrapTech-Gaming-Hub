// Terp Tapper - four-lane neon rhythm tapper. Original code/art; music is synthesized live (WebAudio).
import { Game, TAU, rnd, clamp, roundRect, fmt } from './engine.js';
const LANE_COL = ['#a3e635', '#22d3ee', '#c084fc', '#f472b6'];
const KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3, ArrowLeft: 0, ArrowDown: 1, ArrowUp: 2, ArrowRight: 3 };
const SCALE = [261.6, 311.1, 349.2, 392.0, 466.2, 523.3, 622.3, 698.5];
const WIN = { perfect: 0.06, great: 0.12, good: 0.18 };
export class TerpTapper extends Game {
  get title() { return 'TERP TAPPER'; }
  get hint() { return 'Tap a lane (or D F J K) as each orb crosses the line. Perfect timing + long combos = big points. 5 lives.'; }
  get startOnTapOnly() { return true; }
  layout() { this.laneW = Math.min(118, (this.W - 30) / 4); this.lx = (this.W - this.laneW * 4) / 2; this.hitY = this.H - 120; }
  reset() { this.score = 0; this.coins = 0; this.lives = 5; this.combo = 0; this.maxCombo = 0; this.notes = []; this.nextBeat = 2.0; this.beatN = 0; this.press = [0, 0, 0, 0]; this.judge = null; this.endT = 0; this.dead = false; this.lastLane = -1; }
  bpm() { return Math.min(168, 96 + (this.playT || 0) * 0.6); }
  speed() { return 470 + clamp((this.playT || 0) / 120, 0, 1) * 380; }
  mult() { return Math.min(4, 1 + Math.floor(this.combo / 10)); }
  lane() { let l; do { l = Math.floor(Math.random() * 4); } while (l === this.lastLane && Math.random() < 0.6); this.lastLane = l; return l; }
  schedule() {
    while (this.nextBeat < this.playT + 3) {
      const beat = 60 / this.bpm(); const t = this.nextBeat; const r = Math.random();
      if (this.beatN % 16 === 15) { /* breath */ } else if (r < 0.1 && this.playT > 10) { const a = this.lane(); let b; do { b = Math.floor(Math.random() * 4); } while (b === a); this.notes.push({ lane: a, t }, { lane: b, t }); }
      else if (r < 0.82) this.notes.push({ lane: this.lane(), t });
      if (Math.random() < 0.18 && this.bpm() < 150 && this.playT > 6) this.notes.push({ lane: this.lane(), t: t + beat / 2 });
      this.nextBeat += beat; this.beatN++;
    }
  }
  onDown(x) { const l = Math.floor((x - this.lx) / this.laneW); if (l >= 0 && l < 4) this.hit(l); }
  onKey(code, down, e) { if (down && !e.repeat && KEYS[code] !== undefined) this.hit(KEYS[code]); }
  hit(l) {
    this.press[l] = 0.15; const now = this.playT; let best = null, bd = 1;
    for (const n of this.notes) if (n.lane === l && !n.done) { const d = Math.abs(n.t - now); if (d < bd) { bd = d; best = n; } }
    if (!best || bd > WIN.good) { if (this.combo >= 5) this.pop(this.lx + this.laneW * (l + 0.5), this.hitY - 40, 'COMBO BREAK', '#94a3b8', 16); this.combo = 0; this.sfx.tone(140, 0.05, { type: 'square', vol: 0.06 }); return; }
    best.done = true; const q = bd <= WIN.perfect ? 'PERFECT' : bd <= WIN.great ? 'GREAT' : 'GOOD'; const base = q === 'PERFECT' ? 100 : q === 'GREAT' ? 60 : 30;
    this.combo++; this.maxCombo = Math.max(this.maxCombo, this.combo); if (this.combo % 50 === 0) this.coins++;
    const pts = base * this.mult(); this.score += pts;
    this.judge = { q, life: 0.5, col: q === 'PERFECT' ? '#fde047' : q === 'GREAT' ? '#34d399' : '#22d3ee' };
    const x = this.lx + this.laneW * (l + 0.5); this.burst(x, this.hitY, [LANE_COL[l], '#fff'], q === 'PERFECT' ? 18 : 10, 260, 0.45, 4);
    this.sfx.tone(SCALE[(l * 2 + (this.beatN % 3)) % SCALE.length], 0.16, { type: 'triangle', vol: 0.32 });
  }
  update(dt) {
    for (let i = 0; i < 4; i++) if (this.press[i] > 0) this.press[i] -= dt;
    if (this.judge) { this.judge.life -= dt; if (this.judge.life <= 0) this.judge = null; }
    if (this.dead) { this.endT += dt; if (this.endT > 0.8) { this.sfx.lose(); this.finish(); } return; }
    const prevBeat = Math.floor((this.playT - dt) * this.bpm() / 60); if (Math.floor(this.playT * this.bpm() / 60) !== prevBeat && this.playT > 2) this.sfx.tone(70, 0.12, { type: 'sine', vol: 0.35, slide: 0.5 });
    this.schedule();
    for (const n of this.notes) if (!n.done && this.playT - n.t > WIN.good) { n.done = true; n.miss = true; this.lives--; this.combo = 0; this.pop(this.lx + this.laneW * (n.lane + 0.5), this.hitY - 30, 'MISS', '#f87171', 20); this.sfx.tone(200, 0.12, { type: 'sawtooth', vol: 0.12, slide: 0.6 }); if (this.lives <= 0) { this.lives = 0; this.dead = true; break; } }
    this.notes = this.notes.filter(n => !n.done || this.playT - n.t < 0.4);
  }
  render(ctx) {
    this.bg(ctx, '#0d0626', '#04030c');
    const beatPh = ((this.playT || 0) * this.bpm() / 60) % 1; const pulse = this.state === 'play' ? Math.pow(1 - beatPh, 3) : 0;
    // lanes
    for (let l = 0; l < 4; l++) {
      const x = this.lx + l * this.laneW; const g = ctx.createLinearGradient(0, 0, 0, this.H);
      g.addColorStop(0, 'rgba(15,10,40,0.2)'); g.addColorStop(1, `rgba(${l % 2 ? '59,130,246' : '168,85,247'},${0.14 + pulse * 0.08 + (this.press[l] > 0 ? 0.25 : 0)})`);
      ctx.fillStyle = g; ctx.fillRect(x + 3, 96, this.laneW - 6, this.H - 96);
      ctx.strokeStyle = 'rgba(99,102,241,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(x + 3, 96, this.laneW - 6, this.H - 96);
    }
    // hit line + pads
    ctx.save(); ctx.fillStyle = '#fff'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16 + pulse * 14; ctx.fillRect(this.lx, this.hitY - 2, this.laneW * 4, 4); ctx.restore();
    const keys = ['D', 'F', 'J', 'K'];
    for (let l = 0; l < 4; l++) {
      const x = this.lx + this.laneW * (l + 0.5); const pr = this.press[l] > 0;
      ctx.beginPath(); ctx.arc(x, this.hitY, this.laneW * 0.3 * (pr ? 1.12 : 1), 0, TAU); ctx.strokeStyle = LANE_COL[l]; ctx.lineWidth = 4; ctx.shadowColor = LANE_COL[l]; ctx.shadowBlur = pr ? 22 : 8; ctx.stroke(); ctx.shadowBlur = 0;
      this.text(ctx, keys[l], x, this.hitY + this.laneW * 0.3 + 30, { size: 14, weight: 800, align: 'center', color: 'rgba(196,181,253,0.6)' });
    }
    // notes
    const v = this.speed();
    for (const n of this.notes) {
      if (n.done && !n.miss) continue; const y = this.hitY - (n.t - (this.playT || 0)) * v; if (y < 70 || y > this.H + 30) continue;
      const x = this.lx + this.laneW * (n.lane + 0.5); const r = this.laneW * 0.26;
      ctx.save(); ctx.globalAlpha = n.miss ? 0.3 : 1; const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); g.addColorStop(0, '#fff'); g.addColorStop(0.35, LANE_COL[n.lane]); g.addColorStop(1, 'rgba(0,0,0,0.2)');
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = g; ctx.shadowColor = LANE_COL[n.lane]; ctx.shadowBlur = 18; ctx.fill(); ctx.restore();
    }
    if (this.judge) { ctx.globalAlpha = Math.min(1, this.judge.life * 3); this.text(ctx, this.judge.q, this.W / 2, this.hitY - 90, { size: 30, weight: 900, align: 'center', color: this.judge.col, glow: this.judge.col }); ctx.globalAlpha = 1; }
    if (this.combo >= 5) this.text(ctx, `${this.combo} COMBO`, this.W / 2, this.hitY - 56, { size: 18, weight: 800, align: 'center', color: '#c4b5fd' });
    this.hudScore(ctx);
    this.text(ctx, 'LIVES', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(this.W - 24 - i * 20, 50, 7, 0, TAU); ctx.fillStyle = i < this.lives ? '#a3e635' : 'rgba(148,163,184,0.25)'; ctx.fill(); }
    this.text(ctx, `x${this.mult()}  ${Math.round(this.bpm())} BPM`, this.W - 18, 82, { size: 13, weight: 800, align: 'right', color: this.mult() > 1 ? '#fde047' : '#c4b5fd' });
  }
}

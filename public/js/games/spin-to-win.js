// Spin to Win - timing wheel. Original code/art. Points only: no money, nothing to buy.
// The wheel always travels the same distance for the same power, so skill (timing the release) decides the segment.
import { Game, TAU, rnd, clamp, roundRect, fmt } from './engine.js';
const SEG = [100, 20, 250, 10, 'x2', 50, 500, 20, 'BUST', 100, 50, 1000, 10, 'BONUS', 25, 200];
const COLORS = ['#7c3aed', '#2563eb', '#db2777', '#0891b2'];
const BASE_SPINS = 5, MAX_SPINS = 8, PERIOD = 1.4;
export class SpinToWin extends Game {
  get title() { return 'SPIN TO WIN'; }
  get hint() { return 'Hold to charge the power meter, release to spin. Same power = same landing spot, so learn the timing. 5 free spins.'; }
  get startOnTapOnly() { return true; }
  layout() { const m = Math.min(this.W, this.H - 200); this.R = clamp(m * 0.42, 140, 260); this.cx = this.W / 2; this.cy = 120 + this.R + 20; this.meterY = Math.min(this.H - 70, this.cy + this.R + 70); }
  reset() {
    this.score = 0; this.coins = 0; this.spins = BASE_SPINS; this.used = 0; this.ang = rnd(0, TAU); this.spin = null; this.charging = false; this.chargeT = 0; this.power = 0;
    this.double = false; this.lastRes = null; this.resultT = 0; this.endT = 0; this.history = [];
  }
  onDown() { if (!this.spin && this.used < this.spins) { this.charging = true; this.chargeT = 0; } }
  onUp() { if (this.charging) this.release(); }
  onKey(code, down) { if (code !== 'Space' && code !== 'Enter') return; if (down && !this.charging) this.onDown(); if (!down && this.charging) this.release(); }
  meter(t) { const u = (t % PERIOD) / PERIOD; return u < 0.5 ? u * 2 : 2 - u * 2; }
  release() {
    this.charging = false; const p = this.meter(this.chargeT); this.power = p;
    const travel = TAU * (2 + 3 * p); const dur = 3.2 + p * 1.2;
    this.spin = { a0: this.ang, travel, dur, t: 0 }; this.used++; this.sfx.noise(0.25, { vol: 0.2, freq: 900 });
  }
  segAt(angle) { // pointer at top (-PI/2)
    const n = SEG.length; const rel = ((-Math.PI / 2 - angle) % TAU + TAU) % TAU; return Math.floor(rel / (TAU / n)) % n;
  }
  update(dt) {
    if (this.charging) this.chargeT += dt;
    if (this.resultT > 0) this.resultT -= dt;
    if (this.spin) {
      const s = this.spin; s.t += dt; const u = Math.min(1, s.t / s.dur); const e = 1 - Math.pow(1 - u, 3);
      const prevSeg = this.segAt(this.ang); this.ang = s.a0 + s.travel * e; if (this.segAt(this.ang) !== prevSeg) this.sfx.click();
      if (u >= 1) { this.spin = null; this.resolve(); }
    }
    if (!this.spin && this.used >= this.spins && this.resultT <= 0) { this.endT += dt; if (this.endT > 0.6) this.finish(); }
  }
  resolve() {
    const v = SEG[this.segAt(this.ang)]; let msg, col = '#22d3ee';
    if (v === 'x2') { this.double = true; msg = 'x2 NEXT SPIN!'; col = '#fde047'; this.sfx.chord([523, 784], 0.25, { type: 'triangle', vol: 0.3 }); }
    else if (v === 'BUST') { msg = 'BUST'; col = '#f87171'; this.double = false; this.sfx.lose(); }
    else if (v === 'BONUS') { if (this.spins < MAX_SPINS) this.spins++; msg = 'BONUS SPIN!'; col = '#34d399'; this.coins++; this.sfx.win(); }
    else { const pts = v * (this.double ? 2 : 1); this.score += pts; msg = `+${fmt(pts)}${this.double ? ' (x2)' : ''}`; this.double = false; col = v >= 500 ? '#fde047' : '#22d3ee';
      if (v >= 250) { this.sfx.win(); this.burst(this.cx, this.cy - this.R, ['#fde047', '#f472b6', '#22d3ee', '#a855f7'], 40, 420, 1, 5); } else this.sfx.tone(660, 0.2, { type: 'triangle', vol: 0.3 }); }
    this.lastRes = { msg, col }; this.resultT = 1.1; this.history.push(v);
    this.pop(this.cx, this.cy - 10, msg, col, 32);
  }
  render(ctx) {
    this.bg(ctx, '#160a3a', '#05060f'); const { cx, cy, R } = this; const n = SEG.length; const seg = TAU / n;
    // rim lights
    for (let i = 0; i < 24; i++) { const a = i / 24 * TAU + this.t * 0.4; const on = (Math.floor(this.t * 6) + i) % 2 === 0; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (R + 18), cy + Math.sin(a) * (R + 18), 5, 0, TAU); ctx.fillStyle = on ? '#fde047' : '#7c3aed'; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = on ? 12 : 4; ctx.fill(); }
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(cx, cy, R + 10, 0, TAU); ctx.fillStyle = '#1e1b4b'; ctx.fill(); ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < n; i++) {
      const a0 = this.ang + i * seg, a1 = a0 + seg; const v = SEG[i];
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
      ctx.fillStyle = v === 1000 ? '#f59e0b' : v === 'BUST' ? '#111827' : v === 'x2' ? '#16a34a' : v === 'BONUS' ? '#0d9488' : COLORS[i % 4]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(a0 + seg / 2); const label = String(v);
      this.text(ctx, label, R * 0.92, 6, { size: label.length > 3 ? Math.min(15, R * 0.075) : Math.min(20, R * 0.1), weight: 900, align: 'right', color: v === 'BUST' ? '#f87171' : '#fff' }); ctx.restore();
    }
    const hub = ctx.createRadialGradient(cx, cy, 4, cx, cy, R * 0.2); hub.addColorStop(0, '#f0abfc'); hub.addColorStop(1, '#4c1d95');
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.18, 0, TAU); ctx.fillStyle = hub; ctx.fill(); ctx.strokeStyle = '#fde047'; ctx.lineWidth = 3; ctx.stroke();
    this.text(ctx, 'SPIN', cx, cy + 6, { size: Math.max(12, R * 0.07), weight: 900, align: 'center' });
    // pointer
    ctx.save(); ctx.translate(cx, cy - R - 6); ctx.beginPath(); ctx.moveTo(-16, -22); ctx.lineTo(16, -22); ctx.lineTo(0, 12); ctx.closePath(); ctx.fillStyle = '#fde047'; ctx.shadowColor = '#fde047'; ctx.shadowBlur = 16; ctx.fill(); ctx.restore();
    // power meter
    const mw = Math.min(this.W - 60, 420), mx = (this.W - mw) / 2, my = this.meterY;
    roundRect(ctx, mx, my, mw, 22, 11); ctx.fillStyle = 'rgba(15,23,42,0.9)'; ctx.fill(); ctx.strokeStyle = 'rgba(99,102,241,0.6)'; ctx.lineWidth = 2; ctx.stroke();
    const p = this.charging ? this.meter(this.chargeT) : this.spin ? this.power : 0;
    const gr = ctx.createLinearGradient(mx, 0, mx + mw, 0); gr.addColorStop(0, '#22d3ee'); gr.addColorStop(0.6, '#a855f7'); gr.addColorStop(1, '#f43f5e');
    if (p > 0) { roundRect(ctx, mx + 3, my + 3, (mw - 6) * p, 16, 8); ctx.fillStyle = gr; ctx.fill(); }
    for (let i = 1; i < 10; i++) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(mx + mw * i / 10, my + 4, 1, 14); }
    this.text(ctx, this.spin ? `POWER ${Math.round(p * 100)}%` : this.charging ? `${Math.round(p * 100)}% - RELEASE TO SPIN` : this.used < this.spins ? 'HOLD TO CHARGE' : 'NO SPINS LEFT', this.W / 2, my + 48, { size: 14, weight: 800, align: 'center', color: '#c4b5fd' });
    // HUD
    this.hudScore(ctx);
    this.text(ctx, 'SPINS', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, `${Math.max(0, this.spins - this.used)} / ${this.spins}`, this.W - 18, 60, { size: 26, weight: 900, align: 'right', glow: '#22d3ee' });
    if (this.double) this.text(ctx, 'x2 ACTIVE', this.W - 18, 82, { size: 13, weight: 800, align: 'right', color: '#fde047', glow: '#fde047' });
  }
}

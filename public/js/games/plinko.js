// Plinko - skill drop. Original code/art. 10 free chips per run, aim + nudge, golden multiplier pegs.
// Points only: no money, nothing to buy.
import { Game, TAU, rnd, clamp, roundRect, fmt } from './engine.js';
const VALUES = [200, 50, 20, 5, 100, 5, 20, 50, 200];
const CHIPS = 10, NUDGES = 3, ROWS = 10;
export class Plinko extends Game {
  get title() { return 'PLINKO'; }
  get hint() { return 'Drag along the top to aim, release to drop. Tap beside a falling chip to nudge it (3 per chip). Golden pegs multiply!'; }
  layout() {
    const top = 120, bot = this.H - 26;
    const bw = Math.min(this.W - 24, (bot - top) * 0.82); const bx = (this.W - bw) / 2;
    const dx = bw / 9; const slotH = Math.max(70, (bot - top) * 0.14); const slotTop = bot - slotH;
    const pegTop = top + 60; const dy = (slotTop - 26 - pegTop) / (ROWS - 1);
    this.g = { top, bot, bw, bx, dx, dy, slotTop, slotH, pegTop, r: dx * 0.2, pr: Math.max(4, dx * 0.075) };
    const pegs = [];
    for (let row = 0; row < ROWS; row++) {
      const y = pegTop + row * dy;
      if (row % 2 === 0) for (let i = 0; i <= 9; i++) pegs.push({ x: bx + dx * i, y, row, flash: 0 });
      else for (let i = 0; i < 9; i++) pegs.push({ x: bx + dx * (i + 0.5), y, row, flash: 0 });
    }
    this.pegs = pegs;
    if (this.aimX === undefined) this.aimX = this.W / 2;
  }
  reset() {
    this.score = 0; this.coins = 0; this.left = CHIPS; this.chip = null; this.aiming = false; this.aimX = this.W / 2;
    this.golden = [{ row: 3, ph: rnd(0, TAU), sp: 0.9 }, { row: 6, ph: rnd(0, TAU), sp: 1.25 }]; this.results = []; this.endT = 0; this.flashSlot = -1; this.flashT = 0;
  }
  goldenPos(gp) { const g = this.g; const y = g.pegTop + gp.row * g.dy; const x = g.bx + g.bw / 2 + Math.sin(this.t * gp.sp + gp.ph) * (g.bw / 2 - g.dx * 0.7); return [x, y]; }
  onDown(x, y) {
    if (this.chip) { this.nudge(x); return; }
    if (this.left > 0) { this.aiming = true; this.aimX = clamp(x, this.g.bx + this.g.r + 2, this.g.bx + this.g.bw - this.g.r - 2); }
  }
  onMove(x) { if (this.aiming) this.aimX = clamp(x, this.g.bx + this.g.r + 2, this.g.bx + this.g.bw - this.g.r - 2); }
  onUp() { if (this.aiming) { this.aiming = false; this.drop(); } }
  onKey(code, down) {
    if (!down) return;
    if (code === 'ArrowLeft' || code === 'KeyA') { if (this.chip) this.nudge(this.chip.x - 1); else this.aimX = clamp(this.aimX - this.g.dx / 2, this.g.bx + this.g.r, this.g.bx + this.g.bw - this.g.r); }
    if (code === 'ArrowRight' || code === 'KeyD') { if (this.chip) this.nudge(this.chip.x + 1); else this.aimX = clamp(this.aimX + this.g.dx / 2, this.g.bx + this.g.r, this.g.bx + this.g.bw - this.g.r); }
    if ((code === 'Space' || code === 'ArrowDown') && !this.chip) this.drop();
  }
  drop() {
    if (this.chip || this.left <= 0) return;
    this.left--; this.chip = { x: this.aimX + rnd(-0.5, 0.5), y: this.g.top + 20, vx: 0, vy: 40, mult: 1, nudges: NUDGES, trail: [], hit: new Set() };
    this.sfx.tone(520, 0.08, { type: 'triangle', vol: 0.3 });
  }
  nudge(x) {
    const c = this.chip; if (!c || c.nudges <= 0 || c.y > this.g.slotTop) return;
    c.nudges--; c.vx += (x < c.x ? -1 : 1) * 170; c.vy -= 40; this.sfx.tone(880, 0.06, { type: 'square', vol: 0.15 });
    this.burst(c.x, c.y, '#22d3ee', 6, 120, 0.3, 3);
  }
  update(dt) {
    for (const p of this.pegs) if (p.flash > 0) p.flash -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    const c = this.chip; const g = this.g;
    if (c) {
      const steps = 4; const h = dt / steps;
      for (let s = 0; s < steps; s++) {
        c.vy += 1500 * h; c.vx *= 0.999;
        const sp = Math.hypot(c.vx, c.vy); if (sp > 950) { c.vx *= 950 / sp; c.vy *= 950 / sp; }
        c.x += c.vx * h; c.y += c.vy * h;
        // walls
        if (c.x < g.bx + g.r || c.x > g.bx + g.bw - g.r) { c.x = clamp(c.x, g.bx + g.r, g.bx + g.bw - g.r); c.vx = -c.vx * 0.5; }
        // pegs
        for (const p of this.pegs) {
          const dx = c.x - p.x, dy = c.y - p.y; const d = Math.hypot(dx, dy); const min = g.r + g.pr;
          if (d < min && d > 0.001) {
            const nx = dx / d, ny = dy / d; c.x = p.x + nx * min; c.y = p.y + ny * min;
            const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; c.vx += rnd(-25, 25); }
            if (p.flash <= 0.05) this.sfx.tone(700 + p.row * 60, 0.04, { type: 'sine', vol: 0.12 }); p.flash = 0.25;
          }
        }
        // golden multiplier pegs
        this.golden.forEach((gp, i) => {
          const [px, py] = this.goldenPos(gp); const dx = c.x - px, dy = c.y - py; const d = Math.hypot(dx, dy); const min = g.r + g.pr * 1.8;
          if (d < min && d > 0.001) {
            const nx = dx / d, ny = dy / d; c.x = px + nx * min; c.y = py + ny * min; const vn = c.vx * nx + c.vy * ny; if (vn < 0) { c.vx -= 1.5 * vn * nx; c.vy -= 1.5 * vn * ny; }
            if (!c.hit.has(i)) { c.hit.add(i); c.mult = Math.min(4, c.mult * 2); this.pop(px, py - 20, `x${c.mult}`, '#fde047', 28); this.burst(px, py, ['#fde047', '#f59e0b'], 18, 260, 0.6, 4); this.sfx.chord([660, 880, 1320], 0.2, { type: 'triangle', vol: 0.25 }); }
          }
        });
        // slot dividers
        if (c.y > g.slotTop - g.r) for (let i = 1; i < 9; i++) { const xx = g.bx + g.dx * i; if (Math.abs(c.x - xx) < g.r + 2) { c.x = xx + (c.x < xx ? -1 : 1) * (g.r + 2); c.vx = -c.vx * 0.4; } }
        if (c.y > g.bot - g.r) { this.land(); break; }
      }
      if (this.chip) { c.trail.push([c.x, c.y]); if (c.trail.length > 12) c.trail.shift(); }
    }
    if (!this.chip && this.left <= 0) { this.endT += dt; if (this.endT > 0.9) this.finish(); }
  }
  land() {
    const c = this.chip; const g = this.g; const i = clamp(Math.floor((c.x - g.bx) / g.dx), 0, 8);
    const pts = VALUES[i] * c.mult; this.score += pts; this.results.push(pts); if (VALUES[i] === 200) this.coins++;
    this.flashSlot = i; this.flashT = 0.8; this.chip = null;
    this.pop(g.bx + g.dx * (i + 0.5), g.slotTop - 10, `+${pts}`, pts >= 200 ? '#fde047' : '#22d3ee', pts >= 200 ? 34 : 26);
    this.burst(g.bx + g.dx * (i + 0.5), g.bot - 20, pts >= 100 ? ['#fde047', '#f472b6', '#22d3ee'] : '#22d3ee', pts >= 100 ? 26 : 10, 280, 0.7, 4);
    if (pts >= 100) this.sfx.win(); else this.sfx.tone(440, 0.15, { type: 'triangle', vol: 0.3 });
  }
  render(ctx) {
    this.bg(ctx, '#140a35', '#05060f'); const g = this.g;
    // board
    ctx.save(); roundRect(ctx, g.bx - 10, g.top - 4, g.bw + 20, g.bot - g.top + 12, 18); ctx.fillStyle = 'rgba(20,14,60,0.75)'; ctx.fill();
    ctx.strokeStyle = 'rgba(168,85,247,0.6)'; ctx.lineWidth = 2; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 16; ctx.stroke(); ctx.restore();
    // slots
    for (let i = 0; i < 9; i++) {
      const x = g.bx + g.dx * i; const v = VALUES[i]; const hot = this.flashSlot === i && this.flashT > 0;
      const col = v >= 200 ? '#fde047' : v >= 100 ? '#f472b6' : v >= 50 ? '#a855f7' : v >= 20 ? '#3b82f6' : '#334155';
      ctx.save(); ctx.globalAlpha = hot ? 0.95 : 0.55; ctx.fillStyle = col; roundRect(ctx, x + 3, g.slotTop + 8, g.dx - 6, g.slotH - 12, 8); ctx.fill(); ctx.restore();
      this.text(ctx, String(v), x + g.dx / 2, g.slotTop + g.slotH / 2 + 10, { size: Math.min(18, g.dx * 0.32), weight: 900, align: 'center', color: v >= 100 ? '#1a0b2e' : '#fff' });
      if (i) { ctx.fillStyle = '#c4b5fd'; ctx.fillRect(x - 1.5, g.slotTop - 6, 3, g.slotH + 2); }
    }
    // pegs
    for (const p of this.pegs) { ctx.beginPath(); ctx.arc(p.x, p.y, g.pr * (p.flash > 0 ? 1.4 : 1), 0, TAU); ctx.fillStyle = p.flash > 0 ? '#22d3ee' : '#e0e7ff'; ctx.shadowColor = '#818cf8'; ctx.shadowBlur = p.flash > 0 ? 14 : 6; ctx.fill(); }
    ctx.shadowBlur = 0;
    for (const gp of this.golden) { const [x, y] = this.goldenPos(gp); ctx.save(); ctx.beginPath(); ctx.arc(x, y, g.pr * 1.8, 0, TAU); ctx.fillStyle = '#fde047'; ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 18; ctx.fill(); ctx.restore(); this.text(ctx, 'x2', x, y + 4, { size: 10, weight: 900, align: 'center', color: '#78350f' }); }
    // aim guide
    if (!this.chip && this.left > 0 && this.state !== 'over') {
      ctx.save(); ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(34,211,238,0.45)'; ctx.beginPath(); ctx.moveTo(this.aimX, g.top + 20); ctx.lineTo(this.aimX, g.pegTop - 10); ctx.stroke(); ctx.restore();
      this.drawChip(ctx, this.aimX, g.top + 20, 1, 0.9);
    }
    if (this.chip) {
      const c = this.chip; c.trail.forEach(([x, y], i) => { ctx.globalAlpha = i / c.trail.length * 0.4; ctx.beginPath(); ctx.arc(x, y, g.r * 0.8, 0, TAU); ctx.fillStyle = '#a855f7'; ctx.fill(); }); ctx.globalAlpha = 1;
      this.drawChip(ctx, c.x, c.y, c.mult, 1);
      for (let i = 0; i < c.nudges; i++) { ctx.beginPath(); ctx.arc(c.x - 10 + i * 10, c.y - g.r - 10, 3, 0, TAU); ctx.fillStyle = '#22d3ee'; ctx.fill(); }
    }
    // HUD
    this.hudScore(ctx);
    this.text(ctx, 'CHIPS', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < CHIPS; i++) { const x = this.W - 22 - i * 16; ctx.beginPath(); ctx.arc(x, 48, 6, 0, TAU); ctx.fillStyle = i < this.left ? '#a855f7' : 'rgba(148,163,184,0.25)'; ctx.fill(); }
    if (this.results.length) this.text(ctx, `LAST +${this.results[this.results.length - 1]}`, this.W - 18, 82, { size: 13, weight: 700, color: '#22d3ee', align: 'right' });
  }
  drawChip(ctx, x, y, mult, a) {
    const r = this.g.r; ctx.save(); ctx.globalAlpha = a;
    const gr = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); gr.addColorStop(0, mult > 1 ? '#fef08a' : '#f0abfc'); gr.addColorStop(1, mult > 1 ? '#d97706' : '#7c3aed');
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = gr; ctx.shadowColor = mult > 1 ? '#fde047' : '#a855f7'; ctx.shadowBlur = 16; ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 0.62, 0, TAU); ctx.stroke();
    if (mult > 1) this.text(ctx, `x${mult}`, x, y + 4, { size: 11, weight: 900, align: 'center', color: '#422006' });
    ctx.restore();
  }
}

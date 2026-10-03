// Stack 2048 - slide-and-merge chip puzzle (original code). v5 art: walnut table + velour felt (Poly Haven CC0). Points only.
import { Game, TAU, clamp, roundRect, fmt, loadArt, pattern, loadAtlas, spr, Ambient, softShadow } from './engine.js';
// v6: Blender-rendered clay casino chips (original renders) per value, animated casino ambience.
const N = 4;
const CHIPN = { 2: 'white', 4: 'lime', 8: 'cyan', 16: 'blue', 32: 'purple', 64: 'pink', 128: 'orange', 256: 'yellow', 512: 'amber', 1024: 'red', 2048: 'gold' };
const COL = { 2: '#e2e8f0', 4: '#a3e635', 8: '#22d3ee', 16: '#60a5fa', 32: '#a78bfa', 64: '#f472b6', 128: '#fb923c', 256: '#facc15', 512: '#f59e0b', 1024: '#ef4444', 2048: '#fde047' };
export class Stack2048 extends Game {
  get title() { return 'STACK 2048'; }
  get hint() { return 'Swipe (or use the arrow keys) to slide every chip. Two chips with the same value merge into one worth double. Reach 2048, then keep stacking. No moves left ends the run.'; }
  async load() { this.amb = new Ambient('casino', 3); const [a, p] = await Promise.all([loadArt({ bg: 'wood-dark.webp', felt: 'rl-felt.webp' }), loadAtlas('props')]); this.art = a; this.P = p; }
  reset() { this.score = 0; this.coins = 0; this.g = Array(N * N).fill(0); this.fx = {}; this.top = 0; this.overT = 0; this.sw = null; this.add(); this.add(); }
  layout() { const s = Math.min(this.W - 36, this.H - 230, 620); this.bs = s; this.bx = (this.W - s) / 2; this.by = Math.max(120, (this.H - s) / 2 + 20); this.cs = s / N; }
  add() { const e = []; this.g.forEach((v, i) => { if (!v) e.push(i); }); if (!e.length) return; const i = e[Math.floor(this.r() * e.length)]; this.g[i] = this.r() < 0.9 ? 2 : 4; this.fx[i] = { t: 0, k: 'new' }; }
  canMove() { const g = this.g; for (let i = 0; i < N * N; i++) { if (!g[i]) return true; const r = Math.floor(i / N), c = i % N; if (c < N - 1 && g[i] === g[i + 1]) return true; if (r < N - 1 && g[i] === g[i + N]) return true; } return false; }
  move(dir) { // 0 left, 1 right, 2 up, 3 down
    if (this.overT) return; const g = this.g; let moved = false, gained = 0; this.fx = {};
    for (let k = 0; k < N; k++) {
      const idx = []; for (let j = 0; j < N; j++) { let r, c; if (dir < 2) { r = k; c = dir === 0 ? j : N - 1 - j; } else { c = k; r = dir === 2 ? j : N - 1 - j; } idx.push(r * N + c); }
      const vals = idx.map(i => g[i]).filter(Boolean); const out = [], merged = [];
      for (let j = 0; j < vals.length; j++) { if (j + 1 < vals.length && vals[j] === vals[j + 1]) { merged.push(out.length); out.push(vals[j] * 2); gained += vals[j] * 2; j++; } else out.push(vals[j]); }
      while (out.length < N) out.push(0);
      idx.forEach((i, j) => { if (g[i] !== out[j]) moved = true; g[i] = out[j]; });
      for (const p of merged) { const i = idx[p]; this.fx[i] = { t: 0, k: 'merge' }; if (g[i] >= 256) this.coins++; if (g[i] > this.top) { this.top = g[i]; if (g[i] >= 512) { const [x, y] = this.cell(i); this.pop(x + this.cs / 2, y, `${g[i]}!`, COL[Math.min(2048, g[i])] || '#fde047', 30); this.sfx.win(); } } }
    }
    if (!moved) { this.sfx.tone(160, 0.06, { type: 'square', vol: 0.12 }); return; }
    this.score += gained; if (gained) { this.sfx.tone(380 + Math.min(900, Math.log2(gained) * 60), 0.09, { type: 'triangle', vol: 0.3 }); } else this.sfx.click();
    this.add(); if (!this.canMove()) this.overT = 0.9;
  }
  cell(i) { return [this.bx + (i % N) * this.cs, this.by + Math.floor(i / N) * this.cs]; }
  onDown(x, y) { this.sw = [x, y]; }
  onUp(x, y) { if (!this.sw) return; const dx = x - this.sw[0], dy = y - this.sw[1]; this.sw = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; if (Math.abs(dx) > Math.abs(dy)) this.move(dx < 0 ? 0 : 1); else this.move(dy < 0 ? 2 : 3); }
  onKey(code, down) { if (!down) return; const m = { ArrowLeft: 0, KeyA: 0, ArrowRight: 1, KeyD: 1, ArrowUp: 2, KeyW: 2, ArrowDown: 3, KeyS: 3 }[code]; if (m !== undefined) this.move(m); }
  update(dt) { for (const k in this.fx) this.fx[k].t += dt; if (this.overT) { this.overT -= dt; if (this.overT <= 0) { this.sfx.lose(); this.finish(); } } }
  chip(ctx, x, y, s, v, sc) {
    const cx = x + s / 2, cy = y + s / 2, r = s * 0.42 * sc; const col = COL[Math.min(2048, v)] || '#fde047';
    const cn = 'chip_' + (CHIPN[Math.min(2048, v)] || 'black');
    if (this.P && this.P.f[cn]) { softShadow(ctx, cx, cy + r * 0.18, r * 1.2, r * 1.1, 0.6); spr(ctx, this.P, cn, cx - r * 1.04, cy - r * 1.06, r * 2.08, r * 2.12); const t = String(v); this.text(ctx, t, cx, cy + r * 0.12, { size: r * (t.length > 3 ? 0.4 : t.length > 2 ? 0.5 : 0.6), weight: 900, align: 'center', color: v === 2 ? '#1e293b' : '#fff', glow: v >= 128 ? col : 'rgba(0,0,0,0.6)' }); return; }
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = r * 0.16; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.beginPath(); ctx.arc(cx, cy, r * 0.9, a - 0.13, a + 0.13); ctx.stroke(); } ctx.restore();
    const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 1, cx, cy, r * 0.7); g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.68, 0, TAU); ctx.fillStyle = col; ctx.fill(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.stroke();
    const t = String(v); this.text(ctx, t, cx, cy + r * 0.16, { size: r * (t.length > 3 ? 0.42 : t.length > 2 ? 0.52 : 0.62), weight: 900, align: 'center', color: v <= 4 ? '#1e293b' : '#fff', glow: v >= 128 ? col : null });
  }
  render(ctx) {
    const A = this.art || {}; this.photoBg(ctx, A.bg, 'rgba(8,5,4,0.4)');
    ctx.save(); roundRect(ctx, this.bx - 12, this.by - 12, this.bs + 24, this.bs + 24, 20); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.fillStyle = pattern(ctx, A.felt) || '#0b3b24'; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 4; ctx.stroke(); ctx.restore();
    for (let i = 0; i < N * N; i++) { const [x, y] = this.cell(i); ctx.beginPath(); ctx.arc(x + this.cs / 2, y + this.cs / 2, this.cs * 0.42, 0, TAU); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(); }
    for (let i = 0; i < N * N; i++) { const v = this.g[i]; if (!v) continue; const [x, y] = this.cell(i); const f = this.fx[i]; let sc = 1; if (f && f.t < 0.16) sc = f.k === 'new' ? f.t / 0.16 : 1 + Math.sin(f.t / 0.16 * Math.PI) * 0.14; this.chip(ctx, x, y, this.cs, v, Math.max(0.05, sc)); }
    this.hudScore(ctx);
    this.text(ctx, 'TOP CHIP', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, fmt(this.top || Math.max(...this.g)), this.W - 18, 62, { size: 28, weight: 900, align: 'right', color: '#fde047', glow: '#f59e0b' });
    if (this.overT) this.text(ctx, 'NO MOVES LEFT', this.W / 2, this.by - 26, { size: 22, weight: 900, align: 'center', color: '#f87171', glow: '#ef4444' });
    else if (this.state === 'play' && this.playT < 4) this.text(ctx, 'SWIPE TO SLIDE', this.W / 2, this.by + this.bs + 44, { size: 15, weight: 800, align: 'center', color: 'rgba(196,181,253,0.7)' });
  }
}

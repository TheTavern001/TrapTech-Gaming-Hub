// Blazed Roulette - points-only European roulette with a timed drop. No real money, no purchases.
// v5 art: casino-lounge photo backdrop (Poly Haven CC0 HDRI), green velour felt + cherry-wood wheel rim (Poly Haven CC0). See /CREDITS.md
import { Game, TAU, rnd, clamp, roundRect, fmt, loadArt, pattern, loadAtlas, sprC, Ambient, softShadow } from './engine.js';
// v6: ivory roulette ball + clay casino chips on the chip selectors + stake markers (original Blender renders), animated casino ambience.
const CHIPART = { 10: 'chip_blue', 25: 'chip_green', 50: 'chip_red', 100: 'chip_black' };
const ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const STEP = TAU / 37; const MARK = -Math.PI / 2; const WHEEL_SPEED = 0.6;
const BETS = {
  red: { label: 'RED', pay: 1, win: n => RED.has(n), col: '#dc2626' }, black: { label: 'BLACK', pay: 1, win: n => n > 0 && !RED.has(n), col: '#1f2937' },
  odd: { label: 'ODD', pay: 1, win: n => n > 0 && n % 2 === 1 }, even: { label: 'EVEN', pay: 1, win: n => n > 0 && n % 2 === 0 },
  low: { label: '1-18', pay: 1, win: n => n >= 1 && n <= 18 }, high: { label: '19-36', pay: 1, win: n => n >= 19 },
  d1: { label: '1-12', pay: 2, win: n => n >= 1 && n <= 12 }, d2: { label: '13-24', pay: 2, win: n => n >= 13 && n <= 24 }, d3: { label: '25-36', pay: 2, win: n => n >= 25 },
  zero: { label: '0', pay: 35, win: n => n === 0, col: '#059669' },
};
export const colorOf = n => n === 0 ? 'green' : RED.has(n) ? 'red' : 'black';
export class BlazedRoulette extends Game {
  get title() { return 'BLAZED ROULETTE'; }
  get hint() { return 'Points only - no real money. 1,000 chips, 8 spins, max 100 per spin. Place bets, then time your DROP: the ball lands within 2 pockets of the marker.'; }
  get startOnTapOnly() { return true; }
  reset() { this.score = 1000; this.coins = 0; this.spins = 8; this.bets = {}; this.chip = 25; this.ang = 0; this.ball = null; this.hold = 0; this.lastN = null; this.history = []; this.msg = 'Place your bets'; this.endT = 0; this.over = false; this.layout(); }
  total() { return Object.values(this.bets || {}).reduce((a, b) => a + b, 0); }
  layout() {
    if (!this.W) return; const W = this.W, H = this.H; this.btns = [];
    let board;
    if (this.portrait) { const R = clamp((H - 520) / 2, 95, 170); this.wc = { x: W / 2, y: 112 + R, R }; board = { x: 16, y: 112 + 2 * R + 26, w: W - 32, h: H - (112 + 2 * R + 26) - 16 }; }
    else { const R = Math.min(190, H / 2 - 70); this.wc = { x: R + 50, y: H / 2 + 28, R }; board = { x: 2 * R + 100, y: 100, w: W - (2 * R + 100) - 20, h: H - 116 }; }
    const g = 8, rows = 7, rh = Math.min(64, (board.h - g * (rows - 1)) / rows); const add = (id, kind, r, i, n, label) => { const w = (board.w - g * (n - 1)) / n; this.btns.push({ id, kind, label, x: board.x + i * (w + g), y: board.y + r * (rh + g), w, h: rh }); };
    add('red', 'bet', 0, 0, 2); add('black', 'bet', 0, 1, 2); add('odd', 'bet', 1, 0, 2); add('even', 'bet', 1, 1, 2); add('low', 'bet', 2, 0, 2); add('high', 'bet', 2, 1, 2);
    add('d1', 'bet', 3, 0, 3); add('d2', 'bet', 3, 1, 3); add('d3', 'bet', 3, 2, 3); add('zero', 'bet', 4, 0, 1);
    [10, 25, 50, 100].forEach((v, i) => add('c' + v, 'chip', 5, i, 4, String(v))); add('clear', 'clear', 6, 0, 2, 'CLEAR'); add('drop', 'drop', 6, 1, 2, 'DROP BALL');
  }
  placeBet(id) {
    if (this.ball || this.over) return false; const tot = this.total(); const cur = this.bets[id] || 0;
    let amt = Math.min(this.chip, 100 - tot, this.score); if (id === 'zero') amt = Math.min(amt, 10 - cur);
    if (amt <= 0) { this.msg = id === 'zero' ? 'Max 10 on green 0' : tot >= 100 ? 'Max 100 per spin' : 'Not enough chips'; this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return false; }
    this.bets[id] = cur + amt; this.score -= amt; this.msg = `Bet ${fmt(this.total())} / 100`; this.sfx.click(); return true;
  }
  clearBets() { if (this.ball) return; this.score += this.total(); this.bets = {}; this.msg = 'Bets cleared'; }
  underMarker() { const a = ((MARK - this.ang) % TAU + TAU) % TAU; return Math.round(a / STEP) % 37; }
  drop() {
    if (this.ball || this.over) return false; if (this.total() <= 0) { this.msg = 'Place a bet first'; return false; }
    const i0 = this.underMarker(); const idx = ((i0 + Math.floor(rnd(-2, 3))) % 37 + 37) % 37;
    const relStart = MARK - this.ang; const relEnd = idx * STEP - TAU * 3; // ball counter-rotates ~3 turns
    let rs = relStart; while (rs < relEnd + TAU * 2.2) rs += TAU; while (rs > relEnd + TAU * 3.2) rs -= TAU;
    this.ball = { t: 0, dur: 2.6, rs, re: relEnd, idx, done: false }; this.msg = 'No more bets'; this.sfx.noise(0.2, { vol: 0.15, freq: 2400 }); return true;
  }
  resolve(idx) {
    const n = ORDER[idx]; let won = 0, staked = this.total();
    for (const [k, v] of Object.entries(this.bets)) if (BETS[k].win(n)) won += v * (BETS[k].pay + 1);
    this.score += won; if (n === 0 && this.bets.zero) this.coins++;
    this.lastN = n; this.history.unshift(n); this.history = this.history.slice(0, 8); this.bets = {}; this.spins--;
    const net = won - staked; this.msg = net > 0 ? `${n} ${colorOf(n).toUpperCase()} - WIN +${fmt(net)}` : `${n} ${colorOf(n).toUpperCase()} - no win`;
    const b = this.ballPos(); this.pop(b.x, b.y - 26, String(n), n === 0 ? '#34d399' : RED.has(n) ? '#f87171' : '#e5e7eb', 30);
    if (net > 0) { this.sfx.win(); this.burst(this.wc.x, this.wc.y, ['#fde047', '#a855f7', '#22d3ee'], 30, 320, 0.8, 5); } else this.sfx.tone(220, 0.2, { type: 'triangle', vol: 0.2, slide: 0.7 });
    if (this.spins <= 0 || this.score < 10) { this.over = true; this.msg += this.spins <= 0 ? ' - last spin!' : ' - out of chips'; }
  }
  ballPos() { const b = this.ball; if (!b) return { x: this.wc.x, y: this.wc.y - this.wc.R * 0.95 }; const k = Math.min(1, b.t / b.dur); const e = 1 - Math.pow(1 - k, 3); const rel = b.rs + (b.re - b.rs) * e; const a = this.ang + rel; const r = this.wc.R * (0.93 - 0.2 * Math.min(1, Math.max(0, (k - 0.55) / 0.45))) + (k > 0.55 && k < 0.95 ? Math.sin(k * 60) * 3 * (1 - k) : 0); return { x: this.wc.x + Math.cos(a) * r, y: this.wc.y + Math.sin(a) * r }; }
  onDown(x, y) {
    const b = this.btns.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h); if (!b) return;
    if (b.kind === 'bet') this.placeBet(b.id); else if (b.kind === 'chip') { this.chip = +b.label; this.sfx.click(); } else if (b.kind === 'clear') this.clearBets(); else if (b.kind === 'drop') this.drop();
  }
  onKey(code, down) { if (!down) return; if (code === 'Space' || code === 'Enter') this.drop(); if (code === 'KeyR') this.placeBet('red'); if (code === 'KeyB') this.placeBet('black'); if (code === 'KeyC') this.clearBets(); }
  update(dt) {
    this.ang = (this.ang + WHEEL_SPEED * dt) % TAU;
    if (this.ball && !this.ball.done) { this.ball.t += dt; if (Math.random() < dt * 8 && this.ball.t < this.ball.dur * 0.9) this.sfx.tone(rnd(1800, 2600), 0.015, { type: 'square', vol: 0.04 }); if (this.ball.t >= this.ball.dur) { this.ball.done = true; this.hold = 1.3; this.resolve(this.ball.idx); } }
    else if (this.ball && this.ball.done) { this.hold -= dt; if (this.hold <= 0) { this.ball = null; if (this.over) { this.finish(); } } }
  }
  async load() { this.amb = new Ambient('casino', 13); const [a, p] = await Promise.all([loadArt({ bg: 'rl-bg.webp', felt: 'rl-felt.webp', wood: 'wood-cherry.webp' }), loadAtlas('props')]); this.art = a; this.P = p; }
  render(ctx) {
    const A = this.art || {}; this.photoBg(ctx, A.bg, 'rgba(8,6,14,0.45)'); const { x: cx, y: cy, R } = this.wc;
    if (A.felt && this.btns && this.btns.length) { const top = Math.min(...this.btns.map(b => b.y)) - 12; ctx.save(); ctx.fillStyle = pattern(ctx, A.felt); roundRect(ctx, 6, top, this.W - 12, this.H - top - 6, 18); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#d4a373'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore(); }
    // wheel
    ctx.save(); ctx.translate(cx, cy); ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 30; ctx.beginPath(); ctx.arc(0, 0, R + 16, 0, TAU); ctx.fillStyle = pattern(ctx, A.wood) || '#2a1650'; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#fcd34d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R + 3, 0, TAU); ctx.stroke();
    const under = this.underMarker();
    for (let i = 0; i < 37; i++) {
      const n = ORDER[i]; const a0 = this.ang + i * STEP - STEP / 2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a0 + STEP); ctx.closePath();
      ctx.fillStyle = n === 0 ? '#059669' : RED.has(n) ? '#b91c1c' : '#111827'; ctx.fill(); ctx.strokeStyle = 'rgba(253,224,71,0.35)'; ctx.lineWidth = 1; ctx.stroke();
      const d = Math.min(Math.abs(i - under), 37 - Math.abs(i - under)); if (d <= 2 && !this.ball) { ctx.fillStyle = 'rgba(34,211,238,0.16)'; ctx.fill(); }
      ctx.save(); ctx.rotate(this.ang + i * STEP); ctx.translate(R * 0.86, 0); ctx.rotate(Math.PI / 2); ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.max(9, R * 0.085)}px Orbitron, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n), 0, 0); ctx.restore();
    }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.7, 0, TAU); ctx.fillStyle = pattern(ctx, A.wood) || '#1a0f3a'; ctx.fill(); ctx.strokeStyle = '#fcd34d'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, TAU); const g = ctx.createRadialGradient(-R * 0.15, -R * 0.15, 4, 0, 0, R * 0.62); g.addColorStop(0, '#e5e7eb'); g.addColorStop(0.5, '#9ca3af'); g.addColorStop(1, '#374151'); ctx.fillStyle = g; ctx.fill();
    for (let k = 0; k < 7; k++) { ctx.save(); ctx.rotate(this.ang * 1 + k * TAU / 7); ctx.fillStyle = k % 2 ? '#84cc16' : '#a3e635'; ctx.beginPath(); ctx.ellipse(0, -R * 0.3, R * 0.07, R * 0.26, 0, 0, TAU); ctx.globalAlpha = 0.8; ctx.fill(); ctx.restore(); }
    ctx.beginPath(); ctx.arc(0, 0, R * 0.1, 0, TAU); ctx.fillStyle = '#fde047'; ctx.fill();
    ctx.restore();
    // marker
    ctx.save(); ctx.translate(cx, cy - R - 12); ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(11, -14); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    // ball
    const bp = this.ballPos(); const br = Math.max(6, R * 0.05); ctx.save(); if (!sprC(ctx, this.P, 'ball_ivory', bp.x, bp.y, br * 2.2, br * 2.2)) { ctx.beginPath(); ctx.arc(bp.x, bp.y, br, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); } ctx.restore();
    // board
    for (const b of this.btns) {
      const bet = BETS[b.id]; const sel = (b.kind === 'chip' && +b.label === this.chip); const stake = bet ? this.bets[b.id] || 0 : 0;
      roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = b.kind === 'drop' ? (this.ball ? '#334155' : '#7c3aed') : bet && bet.col ? bet.col : sel ? '#0e7490' : 'rgba(6,30,18,0.72)'; ctx.fill();
      ctx.strokeStyle = stake ? '#fde047' : sel ? '#22d3ee' : 'rgba(129,140,248,0.45)'; ctx.lineWidth = stake || sel ? 3 : 1.5; ctx.stroke();
      if (b.kind === 'chip' && this.P && CHIPART[+b.label]) { const s = Math.min(b.h * 0.86, b.w * 0.9); softShadow(ctx, b.x + b.w / 2, b.y + b.h / 2 + 3, s * 0.6, s * 0.55, 0.5); sprC(ctx, this.P, CHIPART[+b.label], b.x + b.w / 2, b.y + b.h / 2, s, s); this.text(ctx, b.label, b.x + b.w / 2, b.y + b.h / 2 + 5, { size: Math.min(15, s * 0.3), weight: 900, align: 'center', glow: 'rgba(0,0,0,0.9)' }); continue; }
      if (stake && this.P) sprC(ctx, this.P, 'chip_gold', b.x + b.w - 14, b.y + 14, 20, 20);
      const lbl = bet ? bet.label : b.label; const fs = Math.min(18, b.h * 0.36);
      this.text(ctx, lbl, b.x + b.w / 2, b.y + b.h / 2 + (bet ? -2 : fs * 0.35), { size: fs, weight: 800, align: 'center', glow: b.kind === 'drop' ? '#a855f7' : null });
      if (bet) this.text(ctx, stake ? `${stake} on  -  pays ${bet.pay}:1` : `pays ${bet.pay}:1${b.id === 'zero' ? ' (max 10)' : ''}`, b.x + b.w / 2, b.y + b.h / 2 + fs * 0.85, { size: Math.max(10, fs * 0.6), weight: 600, align: 'center', color: stake ? '#fde047' : '#c4b5fd', font: 'Exo' });
    }
    // HUD
    this.hudScore(ctx, 'CHIPS');
    this.text(ctx, 'SPINS', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, String(this.spins), this.W - 18, 62, { size: 30, weight: 900, align: 'right', glow: '#22d3ee' });
    this.text(ctx, this.msg, this.W / 2, 98, { size: 14, weight: 700, align: 'center', color: '#fde68a', font: 'Exo' });
    this.history.forEach((n, i) => { const x = this.W - 18 - i * 22; ctx.beginPath(); ctx.arc(x - 8, 80, 9, 0, TAU); ctx.fillStyle = n === 0 ? '#059669' : RED.has(n) ? '#b91c1c' : '#111827'; ctx.fill(); this.text(ctx, String(n), x - 8, 84, { size: 9, weight: 700, align: 'center' }); });
  }
}

// Blazed Roulette - points-only European roulette with a timed drop. No real money, no purchases.
// v5 art: casino-lounge photo backdrop (Poly Haven CC0 HDRI), green velour felt + cherry-wood wheel rim (Poly Haven CC0). See /CREDITS.md
import { Game, TAU, rnd, clamp, roundRect, fmt, loadArt, pattern, loadAtlas, sprC, Ambient, softShadow } from './engine.js';
// v7: endless, and the room is now a Blender-rendered 3D grow room (rows of plants under LED bars, haze, mylar, fans) with a
// parallax camera sway; the wheel is a rendered top-down rotor (real-time rotation) under a static wood bowl, chrome turret and ivory ball.
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
  get hint() { return 'Points only, no real money. You start with 1,000 chips and there is no spin limit. Place bets, then time your DROP: the ball lands near the marker. Table limits rise every spin, and the run ends when you can no longer cover the table minimum.'; }
  get startOnTapOnly() { return true; }
  reset() { this.score = 0; this.bank = 1000; this.n = 0; this.coins = 0; this.spins = 0; this.bets = {}; this.chip = 25; this.ang = 0; this.ball = null; this.hold = 0; this.lastN = null; this.history = []; this.msg = 'Place your bets'; this.endT = 0; this.over = false; this.layout(); }
  tmin() { return 10 + 5 * this.n; } tmax() { return 100 + 50 * this.n; } zone() { return 2 + Math.floor(this.n / 6); } chipMul() { return 1 + Math.floor(this.n / 8); }
  total() { return Object.values(this.bets || {}).reduce((a, b) => a + b, 0); }
  layout() {
    if (!this.W) return; const W = this.W, H = this.H; this.btns = [];
    let board;
    if (this.portrait) { const bh = 7 * 48 + 6 * 7; const by = H - bh - 18; const R = clamp((by - 150) / 2.9, 80, 135); this.wc = { x: W / 2, y: 132 + (by - 150) / 2, R }; board = { x: 16, y: by, w: W - 32, h: bh }; }
    else { const R = Math.min(150, H / 2 - 90); this.wc = { x: R * 1.4 + 30, y: H / 2 + 28, R }; board = { x: 2.8 * R + 70, y: 100, w: W - (2.8 * R + 70) - 20, h: H - 116 }; }
    const g = 7, rows = 7, rh = Math.min(this.portrait ? 48 : 64, (board.h - g * (rows - 1)) / rows); const add = (id, kind, r, i, n, label) => { const w = (board.w - g * (n - 1)) / n; this.btns.push({ id, kind, label, x: board.x + i * (w + g), y: board.y + r * (rh + g), w, h: rh }); };
    add('red', 'bet', 0, 0, 2); add('black', 'bet', 0, 1, 2); add('odd', 'bet', 1, 0, 2); add('even', 'bet', 1, 1, 2); add('low', 'bet', 2, 0, 2); add('high', 'bet', 2, 1, 2);
    add('d1', 'bet', 3, 0, 3); add('d2', 'bet', 3, 1, 3); add('d3', 'bet', 3, 2, 3); add('zero', 'bet', 4, 0, 1);
    [10, 25, 50, 100].forEach((v, i) => add('c' + v, 'chip', 5, i, 4, String(v))); add('clear', 'clear', 6, 0, 2, 'CLEAR'); add('drop', 'drop', 6, 1, 2, 'DROP BALL');
  }
  placeBet(id) {
    if (this.ball || this.over) return false; const tot = this.total(); const cur = this.bets[id] || 0;
    const chip = this.chip * this.chipMul(); let amt = Math.min(chip, this.tmax() - tot, this.bank); if (id === 'zero') amt = Math.min(amt, Math.floor(this.tmax() / 10) - cur);
    if (amt <= 0) { this.msg = id === 'zero' ? `Max ${Math.floor(this.tmax() / 10)} on green 0` : tot >= this.tmax() ? `Table max ${fmt(this.tmax())}` : 'Not enough chips'; this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return false; }
    this.bets[id] = cur + amt; this.bank -= amt; this.msg = `Bet ${fmt(this.total())} (min ${fmt(this.tmin())}, max ${fmt(this.tmax())})`; this.sfx.click(); return true;
  }
  clearBets() { if (this.ball) return; this.bank += this.total(); this.bets = {}; this.msg = 'Bets cleared'; }
  underMarker() { const a = ((MARK - this.ang) % TAU + TAU) % TAU; return Math.round(a / STEP) % 37; }
  drop() {
    if (this.ball || this.over) return false; if (this.total() < this.tmin()) { this.msg = `Table minimum is ${fmt(this.tmin())}`; this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return false; }
    const i0 = this.underMarker(); const z = this.zone(); const idx = ((i0 + Math.floor(rnd(-z, z + 1))) % 37 + 37) % 37;
    const relStart = MARK - this.ang; const relEnd = idx * STEP - TAU * 3; // ball counter-rotates ~3 turns
    let rs = relStart; while (rs < relEnd + TAU * 2.2) rs += TAU; while (rs > relEnd + TAU * 3.2) rs -= TAU;
    this.ball = { t: 0, dur: 2.6, rs, re: relEnd, idx, done: false }; this.msg = 'No more bets'; this.sfx.noise(0.2, { vol: 0.15, freq: 2400 }); return true;
  }
  resolve(idx) {
    const n = ORDER[idx]; let won = 0, staked = this.total(); this.mark('n', staked);
    for (const [k, v] of Object.entries(this.bets)) if (BETS[k].win(n)) won += v * (BETS[k].pay + 1);
    this.bank += won; if (won > 0) this.award(won, 'win'); if (n === 0 && this.bets.zero) this.coins++;
    this.lastN = n; this.history.unshift(n); this.history = this.history.slice(0, 8); this.bets = {}; this.spins++; this.n++;
    const net = won - staked; this.msg = net > 0 ? `${n} ${colorOf(n).toUpperCase()} - WIN +${fmt(net)}` : `${n} ${colorOf(n).toUpperCase()} - no win`;
    const b = this.ballPos(); this.pop(b.x, b.y - 26, String(n), n === 0 ? '#34d399' : RED.has(n) ? '#f87171' : '#e5e7eb', 30);
    if (net > 0) { this.sfx.win(); this.burst(this.wc.x, this.wc.y, ['#fde047', '#a855f7', '#22d3ee'], 30, 320, 0.8, 5); } else this.sfx.tone(220, 0.2, { type: 'triangle', vol: 0.2, slide: 0.7 });
    if (this.bank < this.tmin()) { this.over = true; this.msg += ' - can\'t cover the table minimum'; } else if (this.n % 6 === 0) this.pop(this.W / 2, this.wc.y, `LIMITS UP: ${fmt(this.tmin())}-${fmt(this.tmax())}`, '#fde68a', 18);
  }
  ballPos() { const { x, y, R } = this.wc; const T = 0.86; const b = this.ball; if (!b) { const a = MARK - 0.6; return { x: x + Math.cos(a) * R * 1.07, y: y + Math.sin(a) * R * 1.07 * T }; }
    const k = Math.min(1, b.t / b.dur); const e = 1 - Math.pow(1 - k, 3); const rel = b.rs + (b.re - b.rs) * e; const a = this.ang + rel;
    const drop = Math.min(1, Math.max(0, (k - 0.55) / 0.4)); const r = R * (1.07 - 0.34 * drop * drop) + (k > 0.6 && k < 0.95 ? Math.abs(Math.sin(k * 70)) * R * 0.05 * (1 - k) : 0);
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * T }; }
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
  async load() { this.amb = new Ambient({ fog: '#ffe2c0', fogA: 0.14, cols: ['#ffd27a', '#ff9ad5', '#b5ff9a'], rays: '#ffe0b0', raysA: 0.10, bokeh: 10, dust: 26 }, 13); const [a, p, w] = await Promise.all([loadArt({ bg: '/assets/v7/growroom.webp', fg: '/assets/v7/growroom-fg.webp', rotor: '/assets/v7/wheel-rotor.webp', bowl: '/assets/v7/wheel-bowl.webp', felt: 'rl-felt.webp', wood: 'wood-cherry.webp' }), loadAtlas('props'), loadAtlas('/assets/v7/wheelparts')]); this.art = a; this.P = p; this.WP = w; }
  render(ctx) {
    const A = this.art || {}; const W = this.W, H = this.H; const { x: cx, y: cy, R } = this.wc;
    // 3D grow room: rendered backdrop + foreground plants on a slow camera sway (two depths = parallax), warm haze + light rays
    const sw = Math.sin(this.t * 0.35), sv = Math.sin(this.t * 0.23 + 1);
    if (A.bg) { const s0 = Math.max(W / A.bg.width, H / A.bg.height) * 1.06; const bw = A.bg.width * s0, bh = A.bg.height * s0; ctx.drawImage(A.bg, (W - bw) / 2 + sw * 6, (H - bh) / 2 + sv * 4, bw, bh); } else this.bg(ctx);
    if (this.amb) this.amb.draw(ctx, W, H);
    ctx.fillStyle = 'rgba(10,6,4,0.18)'; ctx.fillRect(0, 0, W, H);
    if (A.felt && this.btns && this.btns.length) { const top = Math.min(...this.btns.map(b => b.y)) - 12; ctx.save(); ctx.fillStyle = pattern(ctx, A.wood) || '#3b1d0e'; roundRect(ctx, 2, top - 6, W - 4, H - top + 2, 22); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 24; ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = pattern(ctx, A.felt); roundRect(ctx, 10, top + 2, W - 20, H - top - 14, 16); ctx.fill(); const lg = ctx.createLinearGradient(0, top, 0, H); lg.addColorStop(0, 'rgba(255,220,170,0.16)'); lg.addColorStop(1, 'rgba(0,0,0,0.25)'); ctx.fillStyle = lg; ctx.fill(); ctx.restore(); }
    // wheel: tilted table view (y squashed), contact shadow, static bowl, rotating rotor + turret, ball
    const T = 0.86; ctx.save(); ctx.translate(cx, cy); ctx.scale(1, T);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.ellipse(6, R * 0.12, R * 1.42, R * 1.42, 0, 0, TAU); ctx.fill();
    const under = this.underMarker();
    if (A.rotor && A.bowl) {
      ctx.save(); ctx.rotate(this.ang); ctx.drawImage(A.rotor, -R * 1.1, -R * 1.1, R * 2.2, R * 2.2); ctx.restore();
      if (!this.ball) { const z = this.zone(); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(34,211,238,0.22)'; ctx.beginPath(); const a0 = this.ang + (under - z - 0.5) * STEP, a1 = this.ang + (under + z + 0.5) * STEP; ctx.arc(0, 0, R, a0, a1); ctx.arc(0, 0, R * 0.66, a1, a0, true); ctx.closePath(); ctx.fill(); ctx.restore(); }
      ctx.save(); ctx.rotate(this.ang); sprC(ctx, this.WP, 'turret', 0, 0, R * 0.9); ctx.restore();
      ctx.drawImage(A.bowl, -R * 1.35, -R * 1.35, R * 2.7, R * 2.7);
      // moving glint on the lacquered rim
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,230,190,0.25)'; ctx.lineWidth = R * 0.05; ctx.beginPath(); ctx.arc(0, 0, R * 1.17, -2.3 + sw * 0.2, -1.6 + sw * 0.2); ctx.stroke(); ctx.restore();
    } else { ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fillStyle = '#3b1d0e'; ctx.fill(); }
    ctx.restore();
    // marker
    ctx.save(); ctx.translate(cx, cy - R * 1.32 * T - 6); ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(-11, -14); ctx.lineTo(11, -14); ctx.lineTo(0, 6); ctx.closePath(); ctx.fill(); ctx.restore();
    // ball (with a soft contact shadow)
    const bp = this.ballPos(); const br = Math.max(6, R * 0.055); softShadow(ctx, bp.x + 2, bp.y + 3, br * 1.3, br, 0.6); if (!sprC(ctx, this.WP, 'ball', bp.x, bp.y, br * 2.2) && !sprC(ctx, this.P, 'ball_ivory', bp.x, bp.y, br * 2.2, br * 2.2)) { ctx.beginPath(); ctx.arc(bp.x, bp.y, br, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); }
    // foreground plants (closest layer, moves the most) framing the table
    if (A.fg) { const s0 = Math.max(W / A.fg.width, H / A.fg.height) * 1.1; const fw = A.fg.width * s0, fh = A.fg.height * s0; ctx.save(); ctx.globalAlpha = 0.92; ctx.drawImage(A.fg, (W - fw) / 2 - sw * 16, H - fh * 0.62 + sv * 6, fw, fh); ctx.restore(); }
    // board
    for (const b of this.btns) {
      const bet = BETS[b.id]; const sel = (b.kind === 'chip' && +b.label === this.chip); const stake = bet ? this.bets[b.id] || 0 : 0;
      roundRect(ctx, b.x, b.y, b.w, b.h, 10);
      ctx.fillStyle = b.kind === 'drop' ? (this.ball ? '#334155' : '#7c3aed') : bet && bet.col ? bet.col : sel ? '#0e7490' : 'rgba(6,30,18,0.72)'; ctx.fill();
      ctx.strokeStyle = stake ? '#fde047' : sel ? '#22d3ee' : 'rgba(129,140,248,0.45)'; ctx.lineWidth = stake || sel ? 3 : 1.5; ctx.stroke();
      if (b.kind === 'chip' && this.P && CHIPART[+b.label]) { const s = Math.min(b.h * 0.86, b.w * 0.9); softShadow(ctx, b.x + b.w / 2, b.y + b.h / 2 + 3, s * 0.6, s * 0.55, 0.5); sprC(ctx, this.P, CHIPART[+b.label], b.x + b.w / 2, b.y + b.h / 2, s, s); this.text(ctx, fmt(+b.label * this.chipMul()), b.x + b.w / 2, b.y + b.h / 2 + 5, { size: Math.min(15, s * 0.3), weight: 900, align: 'center', glow: 'rgba(0,0,0,0.9)' }); continue; }
      if (stake && this.P) sprC(ctx, this.P, 'chip_gold', b.x + b.w - 14, b.y + 14, 20, 20);
      const lbl = bet ? bet.label : b.label; const fs = Math.min(18, b.h * 0.36);
      this.text(ctx, lbl, b.x + b.w / 2, b.y + b.h / 2 + (bet ? -2 : fs * 0.35), { size: fs, weight: 800, align: 'center', glow: b.kind === 'drop' ? '#a855f7' : null });
      if (bet) this.text(ctx, stake ? `${stake} on  -  pays ${bet.pay}:1` : `pays ${bet.pay}:1${b.id === 'zero' ? ` (max ${Math.floor(this.tmax() / 10)})` : ''}`, b.x + b.w / 2, b.y + b.h / 2 + fs * 0.85, { size: Math.max(10, fs * 0.6), weight: 600, align: 'center', color: stake ? '#fde047' : '#c4b5fd', font: 'Exo' });
    }
    // HUD
    this.hudScore(ctx, 'WINNINGS'); this.text(ctx, `BANK ${fmt(this.bank)}`, 18, 100, { size: 12, weight: 800, color: '#fde68a', font: 'Exo' });
    this.text(ctx, 'SPINS', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, String(this.spins + (this.ball && !this.ball.done ? 1 : 0)), this.W - 18, 62, { size: 30, weight: 900, align: 'right', glow: '#22d3ee' });
    this.text(ctx, `TABLE ${fmt(this.tmin())}-${fmt(this.tmax())}`, this.W / 2, 30, { size: 11, weight: 800, align: 'center', color: '#c4b5fd', font: 'Exo' }); this.text(ctx, this.msg, this.W / 2, 118, { size: 14, weight: 700, align: 'center', color: '#fde68a', font: 'Exo' });
    this.history.forEach((n, i) => { const x = this.W - 18 - i * 22; ctx.beginPath(); ctx.arc(x - 8, 80, 9, 0, TAU); ctx.fillStyle = n === 0 ? '#059669' : RED.has(n) ? '#b91c1c' : '#111827'; ctx.fill(); this.text(ctx, String(n), x - 8, 84, { size: 9, weight: 700, align: 'center' }); });
  }
}

// Munchies Snake - classic grid snake (original code). v5 art: real citrus-slice + gold-coin photos (public domain), grass texture (Poly Haven CC0).
import { Game, TAU, roundRect, fmt, loadArt, pattern } from './engine.js';
const FRUIT = ['tt-lime.webp', 'tt-lemon.webp', 'tt-orange.webp', 'tt-grapefruit.webp'];
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export class MunchiesSnake extends Game {
  get title() { return 'MUNCHIES SNAKE'; }
  get hint() { return 'Swipe, use the arrow keys, or tap beside the head to turn. Eat citrus to grow (+10, more as you get longer). Gold coins are +50 but vanish fast. Hit a wall or yourself and the run ends.'; }
  async load() { const m = { grass: 'dr-grass.webp', coin: 'coin.webp' }; FRUIT.forEach((f, i) => { m['f' + i] = f; }); this.art = await loadArt(m); }
  layout() { this.cols = 15; this.cell = Math.floor((this.W - 24) / this.cols); this.rows = (this.state === 'play' && this.rows) ? this.rows : Math.max(12, Math.floor((this.H - 150) / this.cell)); this.gx = Math.floor((this.W - this.cols * this.cell) / 2); this.gy = Math.max(110, Math.floor((this.H - this.rows * this.cell) / 2) + 20); }
  reset() { this.layout(); const cx = Math.floor(this.cols / 2), cy = Math.floor(this.rows / 2); this.body = [[cx, cy], [cx - 1, cy], [cx - 2, cy]]; this.dir = 0; this.q = []; this.acc = 0; this.score = 0; this.coins = 0; this.eaten = 0; this.food = null; this.gold = null; this.dead = 0; this.sw = null; this.place(); }
  step() { return Math.max(0.065, 0.15 - this.eaten * 0.003); }
  free() { for (let k = 0; k < 200; k++) { const p = [Math.floor(this.r() * this.cols), Math.floor(this.r() * this.rows)]; if (!this.body.some(b => b[0] === p[0] && b[1] === p[1]) && !(this.food && this.food[0] === p[0] && this.food[1] === p[1])) return p; } return [0, 0]; }
  place() { const p = this.free(); this.food = [p[0], p[1], Math.floor(this.r() * 4)]; }
  turn(d) { const last = this.q.length ? this.q[this.q.length - 1] : this.dir; if (d === last || (d + 2) % 4 === last || this.q.length > 2) return; this.q.push(d); }
  onDown(x, y) { this.sw = [x, y]; }
  onUp(x, y) {
    if (!this.sw) return; const dx = x - this.sw[0], dy = y - this.sw[1]; this.sw = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= 22) { this.turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : (dy > 0 ? 1 : 3)); return; }
    const [hx, hy] = this.body[0]; const px = this.gx + (hx + 0.5) * this.cell, py = this.gy + (hy + 0.5) * this.cell; const cur = this.q.length ? this.q[this.q.length - 1] : this.dir;
    if (cur % 2 === 0) this.turn(y < py ? 3 : 1); else this.turn(x < px ? 2 : 0);
  }
  onKey(code, down) { if (!down) return; const m = { ArrowRight: 0, KeyD: 0, ArrowDown: 1, KeyS: 1, ArrowLeft: 2, KeyA: 2, ArrowUp: 3, KeyW: 3 }[code]; if (m !== undefined) this.turn(m); }
  update(dt) {
    if (this.dead) { this.dead -= dt; if (this.dead <= 0) this.finish(); return; }
    if (this.gold) { this.gold[2] -= dt; if (this.gold[2] <= 0) this.gold = null; }
    this.acc += dt; while (this.acc >= this.step()) { this.acc -= this.step(); this.tick(); if (this.dead) return; }
  }
  tick() {
    if (this.q.length) this.dir = this.q.shift(); const [hx, hy] = this.body[0]; const n = [hx + DIRS[this.dir][0], hy + DIRS[this.dir][1]];
    if (n[0] < 0 || n[1] < 0 || n[0] >= this.cols || n[1] >= this.rows || this.body.slice(0, -1).some(b => b[0] === n[0] && b[1] === n[1])) { this.dead = 0.8; this.sfx.lose(); const [x, y] = this.px(this.body[0]); this.burst(x, y, ['#f87171', '#fde047'], 24, 260, 0.6, 5); return; }
    this.body.unshift(n); let grow = false;
    if (this.food && n[0] === this.food[0] && n[1] === this.food[1]) { grow = true; this.eaten++; const pts = 10 + Math.floor(this.body.length / 10) * 5; this.score += pts; const [x, y] = this.px(n); this.pop(x, y - 10, `+${pts}`, '#a3e635', 20); this.burst(x, y, ['#a3e635', '#fde047', '#fb923c'], 10, 160, 0.4, 4); this.sfx.tone(520 + this.eaten * 6, 0.08, { type: 'triangle', vol: 0.3 }); this.place(); if (!this.gold && this.eaten % 5 === 0) { const p = this.free(); this.gold = [p[0], p[1], 5]; } }
    if (this.gold && n[0] === this.gold[0] && n[1] === this.gold[1]) { this.score += 50; this.coins++; const [x, y] = this.px(n); this.pop(x, y - 10, '+50', '#fde047', 24); this.sfx.chord([784, 988], 0.15, { type: 'triangle', vol: 0.3 }); this.gold = null; }
    if (!grow) this.body.pop();
  }
  px(p) { return [this.gx + (p[0] + 0.5) * this.cell, this.gy + (p[1] + 0.5) * this.cell]; }
  render(ctx) {
    const A = this.art || {}; ctx.fillStyle = '#05070a'; ctx.fillRect(0, 0, this.W, this.H);
    const W = this.cols * this.cell, H = this.rows * this.cell;
    ctx.save(); roundRect(ctx, this.gx - 6, this.gy - 6, W + 12, H + 12, 14); ctx.fillStyle = pattern(ctx, A.grass) || '#14301c'; ctx.fill(); ctx.fillStyle = 'rgba(30,60,20,0.08)'; ctx.fill(); ctx.strokeStyle = '#a3e635'; ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 1; i < this.cols; i++) { ctx.moveTo(this.gx + i * this.cell, this.gy); ctx.lineTo(this.gx + i * this.cell, this.gy + H); } for (let j = 1; j < this.rows; j++) { ctx.moveTo(this.gx, this.gy + j * this.cell); ctx.lineTo(this.gx + W, this.gy + j * this.cell); } ctx.stroke();
    if (this.food) { const [x, y] = this.px(this.food); const im = A['f' + this.food[2]]; const s = this.cell * (1.05 + Math.sin(this.t * 6) * 0.06); if (im) ctx.drawImage(im, x - s / 2, y - s / 2, s, s); else { ctx.fillStyle = '#a3e635'; ctx.beginPath(); ctx.arc(x, y, s / 2.4, 0, TAU); ctx.fill(); } }
    if (this.gold) { const [x, y] = this.px(this.gold); const s = this.cell * 1.1; ctx.save(); ctx.globalAlpha = this.gold[2] < 1.5 ? 0.5 + 0.5 * Math.sin(this.t * 20) : 1; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 16; if (A.coin) ctx.drawImage(A.coin, x - s / 2, y - s / 2, s, s); ctx.restore(); }
    const n = this.body.length;
    for (let i = n - 1; i >= 0; i--) { const [x, y] = this.px(this.body[i]); const k = i / Math.max(1, n - 1); const r = this.cell * (i === 0 ? 0.5 : 0.44 - k * 0.1); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = `hsl(${280 - k * 140} 85% ${i === 0 ? 62 : 55}%)`; ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = i === 0 ? 14 : 6; ctx.fill(); }
    ctx.shadowBlur = 0; const [hx, hy] = this.px(this.body[0]); const [dx, dy] = DIRS[this.dir];
    for (const s of [-1, 1]) { const ex = hx + dx * this.cell * 0.18 + -dy * s * this.cell * 0.2, ey = hy + dy * this.cell * 0.18 + dx * s * this.cell * 0.2; ctx.beginPath(); ctx.arc(ex, ey, this.cell * 0.11, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.beginPath(); ctx.arc(ex + dx * 2, ey + dy * 2, this.cell * 0.05, 0, TAU); ctx.fillStyle = '#111'; ctx.fill(); }
    this.hudScore(ctx);
    this.text(ctx, 'LENGTH', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, String(n), this.W - 18, 62, { size: 28, weight: 900, align: 'right', glow: '#a3e635' });
  }
}

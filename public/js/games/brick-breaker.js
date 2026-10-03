// Brick Breaker - paddle + ball arcade (original code). v5 art: brick-wall photo backdrop (Poly Haven CC0), brushed-metal paddle (Poly Haven CC0), gold-coin bricks (public domain photo).
import { Game, TAU, clamp, roundRect, fmt, loadArt, pattern, loadAtlas, spr, sprC, Ambient } from './engine.js';
// v6: Blender-rendered glossy acrylic bricks, steel 2-hit bricks, gold star bricks, chrome capsule paddle + chrome ball (original renders), animated arcade ambience.
const ROWC = ['#ef4444', '#f97316', '#facc15', '#a3e635', '#22d3ee', '#a78bfa', '#f472b6'];
const ROWN = ['red', 'orange', 'yellow', 'lime', 'cyan', 'violet', 'pink'];
export class BrickBreaker extends Game {
  get title() { return 'BRICK BREAKER'; }
  get hint() { return 'Drag (or use the arrow keys) to move the paddle and tap to launch. Where the ball hits the paddle sets its angle. Clear every brick to level up. Gold bricks are worth 5x. 3 lives.'; }
  async load() { this.amb = new Ambient('arcade', 5); const [a, p] = await Promise.all([loadArt({ bg: 'hs-wall.webp', metal: 'metal-plate.webp', coin: 'coin.webp' }), loadAtlas('props')]); this.art = a; this.P = p; }
  layout() { this.pw = Math.max(90, this.W * 0.2); this.py = this.H - 70; this.br = 9; if (this.bricks && this.state !== 'play') this.build(); }
  reset() { this.score = 0; this.coins = 0; this.level = 1; this.lives = 3; this.px = this.W / 2; this.keyL = this.keyR = false; this.combo = 0; this.build(); this.serve(); }
  build() {
    const cols = 8, rows = Math.min(7, 4 + this.level); const m = 16, gap = 6, top = 120; const bw = (this.W - m * 2 - gap * (cols - 1)) / cols, bh = 24; this.bricks = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const gold = this.r() < 0.07; const hp = !gold && r < Math.min(3, this.level - 1) ? 2 : 1; this.bricks.push({ x: m + c * (bw + gap), y: top + r * (bh + gap), w: bw, h: bh, col: ROWC[r % ROWC.length], cn: ROWN[r % ROWN.length], gold, hp }); }
  }
  serve() { this.ball = { x: this.px, y: this.py - 20, vx: 0, vy: 0, stuck: true }; this.combo = 0; }
  speed() { return Math.min(760, 400 + (this.level - 1) * 45 + this.playT * 1.5); }
  launch() { if (!this.ball.stuck) return; const a = -Math.PI / 2 + (this.r() - 0.5) * 0.6; const v = this.speed(); this.ball.vx = Math.cos(a) * v; this.ball.vy = Math.sin(a) * v; this.ball.stuck = false; this.sfx.click(); }
  onDown(x) { this.px = clamp(x, this.pw / 2, this.W - this.pw / 2); this.launch(); }
  onMove(x) { this.px = clamp(x, this.pw / 2, this.W - this.pw / 2); }
  onKey(code, down) { if (code === 'ArrowLeft' || code === 'KeyA') this.keyL = down; if (code === 'ArrowRight' || code === 'KeyD') this.keyR = down; if (down && (code === 'Space' || code === 'ArrowUp')) this.launch(); }
  update(dt) {
    if (this.keyL) this.px -= 620 * dt; if (this.keyR) this.px += 620 * dt; this.px = clamp(this.px, this.pw / 2, this.W - this.pw / 2);
    const b = this.ball; if (b.stuck) { b.x = this.px; b.y = this.py - 20; return; }
    const steps = Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6); const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      b.x += b.vx * h; b.y += b.vy * h; const r = this.br;
      if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); } if (b.x > this.W - r) { b.x = this.W - r; b.vx = -Math.abs(b.vx); } if (b.y < 100 + r) { b.y = 100 + r; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && b.y + r >= this.py - 8 && b.y + r <= this.py + 14 && Math.abs(b.x - this.px) <= this.pw / 2 + r) {
        const off = clamp((b.x - this.px) / (this.pw / 2), -1, 1); const a = -Math.PI / 2 + off * 1.05; const v = this.speed(); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = this.py - 8 - r; this.combo = 0; this.sfx.tone(300, 0.05, { type: 'square', vol: 0.15 });
      }
      for (const k of this.bricks) {
        if (k.dead || b.x + r < k.x || b.x - r > k.x + k.w || b.y + r < k.y || b.y - r > k.y + k.h) continue;
        const ox = Math.min(b.x + r - k.x, k.x + k.w - (b.x - r)), oy = Math.min(b.y + r - k.y, k.y + k.h - (b.y - r)); if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
        k.hp--; if (k.hp > 0) { this.sfx.tone(700, 0.04, { type: 'square', vol: 0.12 }); break; }
        k.dead = true; this.combo++; const pts = (k.gold ? 50 : 10) * this.level * Math.min(4, 1 + Math.floor(this.combo / 4)); this.score += pts; if (k.gold) this.coins++;
        this.burst(k.x + k.w / 2, k.y + k.h / 2, k.gold ? ['#fde047', '#fff'] : [k.col, '#fff'], 10, 200, 0.45, 4); this.pop(k.x + k.w / 2, k.y, `+${pts}`, k.gold ? '#fde047' : '#fff', 16); this.sfx.tone(500 + this.combo * 40, 0.06, { type: 'triangle', vol: 0.25 });
        break;
      }
    }
    if (b.y > this.H + 20) { this.lives--; this.sfx.lose(); if (this.lives <= 0) { this.finish(); return; } this.pop(this.W / 2, this.H / 2, 'BALL LOST', '#f87171', 26); this.serve(); }
    if (this.bricks.every(k => k.dead)) { this.level++; this.score += 250 * (this.level - 1); this.pop(this.W / 2, this.H / 2, `LEVEL ${this.level}`, '#22d3ee', 32); this.sfx.win(); this.build(); this.serve(); }
  }
  render(ctx) {
    const A = this.art || {}; this.photoBg(ctx, A.bg, 'rgba(6,5,14,0.62)');
    for (const k of this.bricks) {
      if (k.dead) continue;
      if (this.P) { const n = k.gold ? 'brick_gold' : k.hp > 1 ? 'brick_steel' : 'brick_' + k.cn; ctx.save(); ctx.shadowColor = k.gold ? 'rgba(251,191,36,0.6)' : 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; spr(ctx, this.P, n, k.x - 2, k.y - 3, k.w + 4, k.h + 7); ctx.restore(); continue; }
      ctx.save(); roundRect(ctx, k.x, k.y, k.w, k.h, 5); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 3;
      const g = ctx.createLinearGradient(0, k.y, 0, k.y + k.h); const c = k.gold ? '#fbbf24' : k.col; g.addColorStop(0, '#ffffff'); g.addColorStop(0.18, c); g.addColorStop(1, k.gold ? '#92400e' : 'rgba(0,0,0,0.55)');
      ctx.fillStyle = c; ctx.fill(); ctx.shadowColor = 'transparent'; ctx.globalAlpha = 0.65; ctx.fillStyle = g; ctx.fill(); ctx.globalAlpha = 1; if (k.hp > 1) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore(); if (k.gold && A.coin) ctx.drawImage(A.coin, k.x + k.w / 2 - 10, k.y + k.h / 2 - 10, 20, 20);
    }
    if (this.P && this.P.f.paddle) { ctx.save(); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 14; spr(ctx, this.P, 'paddle', this.px - this.pw / 2 - 4, this.py - 12, this.pw + 8, 26); ctx.restore(); } else { ctx.save(); roundRect(ctx, this.px - this.pw / 2, this.py - 8, this.pw, 16, 8); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16; ctx.fillStyle = pattern(ctx, A.metal) || '#cbd5e1'; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore(); }
    const b = this.ball; const g = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, this.br); g.addColorStop(0, '#fff'); g.addColorStop(1, '#94a3b8'); ctx.save(); ctx.shadowColor = 'rgba(200,240,255,0.9)'; ctx.shadowBlur = 12; if (!sprC(ctx, this.P, 'ball_chrome', b.x, b.y, this.br * 2.3, this.br * 2.3)) { ctx.beginPath(); ctx.arc(b.x, b.y, this.br, 0, TAU); ctx.fillStyle = g; ctx.fill(); } ctx.restore();
    this.hudScore(ctx);
    this.text(ctx, `LEVEL ${this.level}`, this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(this.W - 26 - i * 24, 52, 8, 0, TAU); ctx.fillStyle = i < this.lives ? '#22d3ee' : 'rgba(148,163,184,0.25)'; ctx.fill(); }
    if (b.stuck && this.state === 'play') this.text(ctx, 'TAP TO LAUNCH', this.W / 2, this.py - 50, { size: 16, weight: 800, align: 'center', color: '#c4b5fd' });
  }
}

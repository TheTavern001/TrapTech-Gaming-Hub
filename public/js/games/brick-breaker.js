// Brick Breaker - v7: truly endless (original code). The wall never clears: it creeps down continuously and a new procedurally
// generated row slides in at the top, faster and tougher over time. If the wall reaches the red line, or you run out of balls,
// the run ends. Art: Blender Cycles glass bricks (6 hues), riveted steel bricks (2 hits, cracked state), chrome paddle with a neon
// strip and a chrome ball (original renders, v7 atlas), photo backdrop (Poly Haven CC0) + arcade ambience; shard bursts, flash
// glints and a motion-blur trail on the ball.
import { Game, TAU, rnd, clamp, roundRect, fmt, loadArt, loadAtlas, sprC, spr, Ambient, reducedMotion } from './engine.js';
const HUES = ['red', 'orange', 'yellow', 'green', 'cyan', 'violet'];
const HCOL = { red: '#fb7185', orange: '#fb923c', yellow: '#fde047', green: '#4ade80', cyan: '#22d3ee', violet: '#a78bfa', steel: '#cbd5e1', gold: '#fbbf24' };
const PUS = { multi: { c: '#22d3ee', t: 'MULTIBALL' }, wide: { c: '#4ade80', t: 'WIDE PADDLE' }, laser: { c: '#fb7185', t: 'LASERS' }, slow: { c: '#a78bfa', t: 'SLOW BALL' } };
const COLS = 8, BH = 26, GAP = 5;
export class BrickBreaker extends Game {
  get title() { return 'BRICK BREAKER'; }
  get hint() { return 'Drag (or use the arrow keys) to move the paddle, tap to launch. The wall never ends: it keeps sliding down with new rows. Break it back before it reaches the red line. Catch capsules for multiball, a wide paddle, lasers and slow-mo.'; }
  async load() { this.amb = new Ambient('arcade', 5); const [a, B] = await Promise.all([loadArt({ bg: 'hs-wall.webp', coin: 'coin.webp' }), loadAtlas('/assets/v7/brick')]); this.art = a; this.B = B; }
  layout() { this.bw = (this.W - 16 * 2 - GAP * (COLS - 1)) / COLS; this.py = this.H - 80; this.dangerY = this.py - 70; this.br = 9; }
  reset() {
    this.layout(); this.score = 0; this.coins = 0; this.lives = 3; this.rows = 0; this.px = this.W / 2; this.keyL = this.keyR = false; this.combo = 0;
    this.bricks = []; this.creep = 0; this.pu = []; this.lasers = []; this.eff = { wide: 0, laser: 0, slow: 0 }; this.laserT = 0; this.over = 0; this.flash = [];
    for (let i = 0; i < 6; i++) this.addRow(120 + (5 - i) * (BH + GAP)); this.balls = []; this.serve();
  }
  get level() { return 1 + Math.floor(this.rows / 10); } // kept for tests/HUD: one "wave" per 10 rows
  mult() { return Math.min(5, 1 + 0.2 * Math.floor(this.rows / 10)); }
  addRow(y) {
    const r = this.rows++; this.mark('r', this.rows); const pat = Math.floor(this.r() * 5); const hue = HUES[r % HUES.length]; const steelP = Math.min(0.35, Math.max(0, (r - 8) * 0.01)); const gapP = r < 6 ? 0 : 0.12;
    for (let c = 0; c < COLS; c++) {
      if (pat === 1 && (c + r) % 2 === 0 && r > 4) continue; if (pat === 2 && (c === 3 || c === 4) && r > 4) continue; if (this.r() < gapP) continue;
      const gold = this.r() < 0.06, steel = !gold && this.r() < steelP;
      this.bricks.push({ x: 16 + c * (this.bw + GAP), y, w: this.bw, h: BH, kind: gold ? 'gold' : steel ? 'steel' : hue, hp: steel ? 2 : 1 });
    }
  }
  pw() { return Math.max(70, this.W * 0.2 - Math.min(30, this.rows * 0.25)) * (this.eff.wide > 0 ? 1.5 : 1); }
  serve() { this.balls = [{ x: this.px, y: this.py - 20, vx: 0, vy: 0, stuck: true, trail: [] }]; this.combo = 0; }
  speed() { return Math.min(760, 420 + this.rows * 2.2) * (this.eff.slow > 0 ? 0.65 : 1); }
  creepSpeed() { const left = this.bricks.length; return (BH + GAP) / Math.max(2.6, 8 - this.rows * 0.04) * (left < 10 ? 3 : 1); } // px/s; much faster when the wall is nearly gone
  launch() { const b = this.balls.find(b => b.stuck); if (!b) return; const a = -Math.PI / 2 + (this.r() - 0.5) * 0.6; const v = this.speed(); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.stuck = false; this.sfx.click(); }
  onDown(x) { const w = this.pw(); this.px = clamp(x, w / 2, this.W - w / 2); this.launch(); }
  onMove(x) { const w = this.pw(); this.px = clamp(x, w / 2, this.W - w / 2); }
  onKey(code, down) { if (code === 'ArrowLeft' || code === 'KeyA') this.keyL = down; if (code === 'ArrowRight' || code === 'KeyD') this.keyR = down; if (down && (code === 'Space' || code === 'ArrowUp')) this.launch(); }
  hitBrick(k, b) {
    k.hp--; const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    if (k.hp > 0) { k.hitT = 0.12; this.sfx.tone(900, 0.04, { type: 'square', vol: 0.12 }); return; }
    k.dead = true; this.combo++; const base = k.kind === 'gold' ? 50 : k.kind === 'steel' ? 20 : 10; const chain = Math.min(4, 1 + 0.25 * (this.combo - 1)); const pts = this.award(Math.round(base * this.mult() * chain), 'h');
    this.burst(cx, cy, [HCOL[k.kind], '#ffffff', HCOL[k.kind]], k.kind === 'gold' ? 16 : 10, 220, 0.5, 4); this.flash.push({ x: cx, y: cy, w: k.w, t: 0.18 });
    if (k.kind === 'gold') { this.coins++; this.pop(cx, cy, `+${pts}`, '#fbbf24', 20); } else if (this.combo >= 4 && this.combo % 2 === 0) this.pop(cx, cy, `x${chain.toFixed(2).replace(/\.?0+$/, '')}`, '#fde047', 16);
    this.sfx.tone(500 + Math.min(12, this.combo) * 60, 0.05, { type: 'triangle', vol: 0.2 });
    if (this.r() < 0.09) { const ks = Object.keys(PUS); this.pu.push({ k: ks[Math.floor(this.r() * ks.length)], x: cx, y: cy }); }
  }
  update(dt) {
    for (const f of this.flash) f.t -= dt; this.flash = this.flash.filter(f => f.t > 0); for (const k in this.eff) if (this.eff[k] > 0) this.eff[k] -= dt;
    if (this.over) { this.over -= dt; if (this.over <= 0) this.finish(); return; }
    if (this.keyL) this.px -= 620 * dt; if (this.keyR) this.px += 620 * dt; const pw = this.pw(); this.px = clamp(this.px, pw / 2, this.W - pw / 2);
    // the wall creeps down; a new row slides in whenever the top row has moved a full row height
    const dy = this.creepSpeed() * dt; for (const k of this.bricks) { k.y += dy; if (k.hitT > 0) k.hitT -= dt; }
    this.creep += dy; while (this.creep >= BH + GAP) { this.creep -= BH + GAP; this.addRow(120 - (BH + GAP) + this.creep); if (this.rows % 30 === 0) { this.lives = Math.min(5, this.lives + 1); this.pop(this.W / 2, this.H * 0.5, '+1 BALL', '#22d3ee', 22); } }
    if (this.bricks.some(k => k.y + k.h >= this.dangerY)) { this.over = 1.2; this.sfx.lose(); this.burst(this.W / 2, this.dangerY, ['#ef4444', '#fff'], 40, 320, 0.8, 5); return; }
    // lasers
    if (this.eff.laser > 0) { this.laserT -= dt; if (this.laserT <= 0) { this.laserT = 0.28; this.lasers.push({ x: this.px - pw / 2 + 8, y: this.py - 10 }, { x: this.px + pw / 2 - 8, y: this.py - 10 }); this.sfx.tone(1500, 0.03, { type: 'square', vol: 0.06 }); } }
    for (const l of this.lasers) { l.y -= 900 * dt; for (const k of this.bricks) if (!k.dead && l.x > k.x && l.x < k.x + k.w && l.y > k.y && l.y < k.y + k.h) { l.dead = 1; this.hitBrick(k); break; } }
    this.lasers = this.lasers.filter(l => !l.dead && l.y > 100);
    for (const b of this.balls) {
      if (b.stuck) { b.x = this.px; b.y = this.py - 20; continue; }
      b.trail.push([b.x, b.y]); if (b.trail.length > 7) b.trail.shift();
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6)); const h = dt / steps; const r = this.br;
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); } if (b.x > this.W - r) { b.x = this.W - r; b.vx = -Math.abs(b.vx); } if (b.y < 100 + r) { b.y = 100 + r; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y + r >= this.py - 8 && b.y + r <= this.py + 14 && Math.abs(b.x - this.px) <= pw / 2 + r) {
          const off = clamp((b.x - this.px) / (pw / 2), -1, 1); const a = -Math.PI / 2 + off * 1.05; const v = this.speed(); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = this.py - 8 - r; this.combo = 0; this.sfx.tone(300, 0.05, { type: 'square', vol: 0.15 });
        }
        for (const k of this.bricks) { if (k.dead) continue;
          if (b.x + r > k.x && b.x - r < k.x + k.w && b.y + r > k.y && b.y - r < k.y + k.h) {
            const ox = Math.min(b.x + r - k.x, k.x + k.w - (b.x - r)), oy = Math.min(b.y + r - k.y, k.y + k.h - (b.y - r)); if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            this.hitBrick(k, b); break; } }
        // keep the speed in step with the ramp (and the slow power-up)
        const v = Math.hypot(b.vx, b.vy), tv = this.speed(); if (Math.abs(v - tv) > 4) { b.vx *= tv / v; b.vy *= tv / v; }
        if (Math.abs(b.vy) < 120) b.vy = Math.sign(b.vy || -1) * 120;
      }
      if (b.y > this.H + 20) b.lost = true;
    }
    this.bricks = this.bricks.filter(k => !k.dead); this.balls = this.balls.filter(b => !b.lost);
    if (!this.balls.length) { this.lives--; this.sfx.lose(); if (this.lives <= 0) { this.over = 1; return; } this.pop(this.W / 2, this.H * 0.55, `${this.lives} BALL${this.lives === 1 ? '' : 'S'} LEFT`, '#f87171', 22); this.serve(); }
    for (const p of this.pu) { p.y += 170 * dt; if (p.y > this.py - 14 && p.y < this.py + 16 && Math.abs(p.x - this.px) < pw / 2 + 12) { p.dead = 1; this.power(p.k); } }
    this.pu = this.pu.filter(p => !p.dead && p.y < this.H + 20);
  }
  power(k) {
    this.pop(this.px, this.py - 40, PUS[k].t, PUS[k].c, 20); this.sfx.chord([660, 990], 0.12, { type: 'triangle', vol: 0.25 });
    if (k === 'multi') { const add = []; for (const b of this.balls.slice(0, 4)) { if (b.stuck) continue; for (const da of [-0.35, 0.35]) { const a = Math.atan2(b.vy, b.vx) + da, v = this.speed(); add.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, trail: [] }); } } this.balls.push(...add); }
    else this.eff[k] = k === 'wide' ? 12 : 8;
  }
  render(ctx) {
    const A = this.art || {}, B = this.B, W = this.W, H = this.H, t = this.t;
    this.photoBg(ctx, A.bg, 'rgba(4,5,16,0.78)');
    // playfield glass panel + danger line
    ctx.fillStyle = 'rgba(10,12,30,0.35)'; ctx.fillRect(8, 100, W - 16, this.py - 92);
    const dz = this.bricks.reduce((m, k) => Math.max(m, k.y + k.h), 0); const near = clamp((dz - (this.dangerY - 160)) / 160, 0, 1);
    ctx.save(); ctx.strokeStyle = `rgba(239,68,68,${0.35 + near * 0.6 * (0.5 + 0.5 * Math.sin(t * 10))})`; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, this.dangerY); ctx.lineTo(W - 12, this.dangerY); ctx.stroke(); ctx.restore();
    if (near > 0) { const g = ctx.createLinearGradient(0, this.dangerY - 60, 0, this.dangerY); g.addColorStop(0, 'rgba(239,68,68,0)'); g.addColorStop(1, `rgba(239,68,68,${0.25 * near})`); ctx.fillStyle = g; ctx.fillRect(8, this.dangerY - 60, W - 16, 60); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, 100, W, H); ctx.clip();
    for (const k of this.bricks) { const name = k.kind === 'steel' ? (k.hp < 2 ? 'b_steel_cracked' : 'b_steel') : k.kind === 'gold' ? 'b_yellow' : 'b_' + k.kind;
      if (k.hitT > 0) ctx.filter = 'brightness(1.8)'; if (!spr(ctx, B, name, k.x - 2, k.y - 2, k.w + 4, k.h + 4)) { ctx.fillStyle = HCOL[k.kind]; roundRect(ctx, k.x, k.y, k.w, k.h, 5); ctx.fill(); } ctx.filter = 'none';
      if (k.kind === 'gold') { const s = (t * 0.8 + k.x * 0.01) % 2; if (s < 1) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const gx = k.x + s * k.w; const g = ctx.createLinearGradient(gx - 14, 0, gx + 14, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,180,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(k.x, k.y, k.w, k.h); ctx.restore(); } } }
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const f of this.flash) { ctx.globalAlpha = f.t / 0.18; ctx.fillStyle = '#fff'; ctx.fillRect(f.x - f.w / 2, f.y - BH / 2, f.w, BH); } ctx.restore(); ctx.globalAlpha = 1;
    for (const l of this.lasers) { ctx.fillStyle = '#fecdd3'; ctx.fillRect(l.x - 1.5, l.y - 14, 3, 18); }
    for (const p of this.pu) { const c = PUS[p.k].c; ctx.save(); ctx.translate(p.x, p.y); ctx.fillStyle = c; ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; roundRect(ctx, -16, -8, 32, 16, 8); const g = ctx.createLinearGradient(0, -8, 0, 8); g.addColorStop(0, '#fff'); g.addColorStop(0.4, c); g.addColorStop(1, '#111'); ctx.fillStyle = g; ctx.fill(); ctx.restore(); }
    // paddle
    const pw = this.pw(); if (!spr(ctx, B, 'paddle', this.px - pw / 2 - 4, this.py - 12, pw + 8, 24)) { ctx.fillStyle = '#e2e8f0'; roundRect(ctx, this.px - pw / 2, this.py - 8, pw, 16, 8); ctx.fill(); }
    if (this.eff.laser > 0) { ctx.fillStyle = '#fb7185'; ctx.fillRect(this.px - pw / 2 + 5, this.py - 16, 6, 8); ctx.fillRect(this.px + pw / 2 - 11, this.py - 16, 6, 8); }
    // balls with a motion-blur trail
    for (const b of this.balls) { if (!reducedMotion()) b.trail.forEach(([x, y], i) => { ctx.globalAlpha = (i + 1) / b.trail.length * 0.3; ctx.fillStyle = '#bae6fd'; ctx.beginPath(); ctx.arc(x, y, this.br * (0.5 + 0.5 * i / b.trail.length), 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1;
      if (!sprC(ctx, B, 'ball', b.x, b.y, this.br * 2.4)) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, this.br, 0, TAU); ctx.fill(); } }
    this.hudScore(ctx);
    this.text(ctx, `ROW ${this.rows}`, W - 18, 30, { size: 12, weight: 800, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < this.lives; i++) sprC(ctx, B, 'ball', W - 26 - i * 22, 50, 18);
    this.text(ctx, `x${this.mult().toFixed(1)}`, W - 18, 82, { size: 12, weight: 800, align: 'right', color: '#fde047', font: 'Exo' });
    if (this.balls.some(b => b.stuck) && this.state === 'play') this.text(ctx, 'TAP TO LAUNCH', W / 2, this.py - 50, { size: 16, weight: 800, align: 'center', color: '#c4b5fd' });
  }
}

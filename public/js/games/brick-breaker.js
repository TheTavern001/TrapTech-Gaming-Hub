// Brick Breaker v8 - endless neon wall. Rebuilt: Kenney Puzzle Pack 2 bevel bricks (CC0) lit with additive glow, chrome-neon paddle,
// comet-trail ball with spin from paddle motion, bomb bricks that chain, steel + gold bricks, capsules (multi / wide / laser / slow),
// perspective arcade floor, shake + hit-stop on big breaks. The wall creeps down and a new row slides in forever.
// Scoring rules are unchanged (src/ac-levels.js 'brick-breaker'): 10/20/50 x wave multiplier x chain.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, loadPack, spr, halo, bake, roundRect, mix, lighten, shade } from './kit.js';
const HUES = ['blue', 'green', 'orange', 'pink', 'red'];
const HCOL = { blue: '#38bdf8', green: '#4ade80', orange: '#fb923c', pink: '#f472b6', red: '#f87171', yellow: '#fbbf24', grey: '#cbd5e1', bomb: '#fb923c' };
const PUS = { multi: { c: '#22d3ee', t: 'MULTIBALL', g: 'M' }, wide: { c: '#4ade80', t: 'WIDE PADDLE', g: 'W' }, laser: { c: '#fb7185', t: 'LASERS', g: 'L' }, slow: { c: '#a78bfa', t: 'SLOW BALL', g: 'S' } };
const COLS = 8, BH = 26, GAP = 5, TOP = 96;
export class BrickBreaker extends Game8 {
  get title() { return 'BRICK BREAKER'; }
  get hint() { return 'Drag to move the paddle, tap to launch. Where the ball meets the paddle (and how fast you move) sets its angle. The wall never ends: break it back before it reaches the red line. Catch capsules, blow up bomb bricks, chain hits for a bigger multiplier.'; }
  get accent() { return '#22d3ee'; }
  get musicOpts() { return { root: 55, bpm: 118, mode: 'dorian', seed: 2, vol: 0.4 }; }
  async load() { this.B = await loadPack('brick'); }
  layout() { this.bw = (this.W - 32 - GAP * (COLS - 1)) / COLS; this.py = this.H - 84; this.dangerY = this.py - 74; this.br = 9; this.bgc = null; }
  reset() {
    super.reset(); this.layout(); this.score = 0; this.coins = 0; this.lives = 3; this.rows = 0; this.px = this.W / 2; this.pvx = 0; this.keyL = this.keyR = false; this.combo = 0; this.bricks = []; this.creep = 0; this.pu = []; this.lasers = [];
    this.eff = { wide: 0, laser: 0, slow: 0 }; this.laserT = 0; this.bk = [];
    for (let i = 0; i < 6; i++) this.addRow(TOP + (5 - i) * (BH + GAP)); this.serve();
  }
  get level() { return 1 + Math.floor(this.rows / 10); }
  mult() { return Math.min(5, 1 + 0.2 * Math.floor(this.rows / 10)); }
  addRow(y) {
    const r = this.rows++; this.mark('r', this.rows); const pat = Math.floor(this.r() * 5), hue = HUES[r % HUES.length], steelP = Math.min(0.35, Math.max(0, (r - 8) * 0.01)), gapP = r < 6 ? 0 : 0.12;
    for (let c = 0; c < COLS; c++) {
      if (pat === 1 && (c + r) % 2 === 0 && r > 4) continue; if (pat === 2 && (c === 3 || c === 4) && r > 4) continue; if (this.r() < gapP) continue;
      const gold = this.r() < 0.06, bomb = !gold && r > 10 && this.r() < 0.05, steel = !gold && !bomb && this.r() < steelP;
      this.bricks.push({ x: 16 + c * (this.bw + GAP), y, w: this.bw, h: BH, c, kind: gold ? 'yellow' : bomb ? 'bomb' : steel ? 'grey' : hue, hp: steel ? 2 : 1, hit: 0 });
    }
  }
  pw() { return Math.max(72, this.W * 0.2 - Math.min(30, this.rows * 0.25)) * (this.eff.wide > 0 ? 1.5 : 1); }
  serve() { this.balls = [{ x: this.px, y: this.py - 20, vx: 0, vy: 0, stuck: true, trail: [] }]; this.combo = 0; }
  speed() { return Math.min(760, 420 + this.rows * 2.2) * (this.eff.slow > 0 ? 0.65 : 1); }
  creepSpeed() { return (BH + GAP) / Math.max(2.6, 8 - this.rows * 0.04) * (this.bricks.length < 10 ? 3 : 1); }
  launch() { const b = this.balls.find(b => b.stuck); if (!b) return; const a = -Math.PI / 2 + (this.r() - 0.5) * 0.6, v = this.speed(); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.stuck = false; this.sfx.click(); this.fx.ring(b.x, b.y, '#67e8f9', 6, 34, 0.3); }
  onDown(x) { this.setPx(x); this.launch(); }
  onMove(x) { this.setPx(x); }
  setPx(x) { const w = this.pw(); const nx = clamp(x, w / 2, this.W - w / 2); this.pvx = clamp((nx - this.px) * 60, -900, 900); this.px = nx; }
  onKey(c, d) { if (c === 'ArrowLeft' || c === 'KeyA') this.keyL = d; if (c === 'ArrowRight' || c === 'KeyD') this.keyR = d; if (d && (c === 'Space' || c === 'ArrowUp')) this.launch(); }
  breakBrick(k, viaBomb) {
    if (k.dead) return; k.hp--; const cx = k.x + k.w / 2, cy = k.y + k.h / 2;
    if (k.hp > 0) { k.hit = 0.14; this.fx.sparks(cx, cy, '#e2e8f0', 4, 260, 0.25, 10); this.fx.shake(1.5); this.sfx.tone(900, 0.04, { type: 'square', vol: 0.1 }); return; }
    k.dead = true; this.combo++; const base = k.kind === 'yellow' ? 50 : k.kind === 'grey' ? 20 : 10, chain = Math.min(4, 1 + 0.25 * (this.combo - 1)), pts = this.award(Math.round(base * this.mult() * chain), 'h'); const col = HCOL[k.kind];
    this.fx.burst(cx, cy, [col, '#fff'], 7, 220, 0.5, 14); this.fx.debris(cx, cy, col, k.kind === 'yellow' ? 8 : 4, 260, 0.9, 7); this.fx.ring(cx, cy, col, 4, 30, 0.3, 2); this.fx.shake(k.kind === 'yellow' ? 4 : 1.8);
    if (k.kind === 'yellow') { this.coins++; this.pop(cx, cy, '+' + pts, '#fbbf24', 20); this.hitstop(0.04); } else if (this.combo >= 4 && this.combo % 2 === 0) this.pop(cx, cy, 'x' + chain.toFixed(2).replace(/\.?0+$/, ''), '#fde047', 16);
    this.sfx.tone(480 + Math.min(14, this.combo) * 55, 0.06, { type: 'triangle', vol: 0.2 });
    if (k.kind === 'bomb') { this.fx.ring(cx, cy, '#fb923c', 10, 110, 0.5, 5); this.fx.flash('#fb923c', 0.15); this.fx.shake(9); this.sfx.noise(0.25, { vol: 0.3, freq: 500 }); this.hitstop(0.07); for (const o of this.bricks) if (!o.dead && o !== k && Math.abs(o.x + o.w / 2 - cx) < this.bw * 1.2 && Math.abs(o.y + o.h / 2 - cy) < BH * 1.8) { o.hp = 1; this.breakBrick(o, true); } }
    if (!viaBomb && this.r() < 0.09) { const ks = Object.keys(PUS); this.pu.push({ k: ks[Math.floor(this.r() * ks.length)], x: cx, y: cy, t: 0 }); }
  }
  update(dt) {
    for (const k in this.eff) if (this.eff[k] > 0) this.eff[k] -= dt; this.pvx *= Math.pow(0.001, dt);
    if (this.keyL) this.px -= 620 * dt; if (this.keyR) this.px += 620 * dt; const pw = this.pw(); this.px = clamp(this.px, pw / 2, this.W - pw / 2);
    const dy = this.creepSpeed() * dt; for (const k of this.bricks) { k.y += dy; if (k.hit > 0) k.hit -= dt; }
    this.creep += dy; while (this.creep >= BH + GAP) { this.creep -= BH + GAP; this.addRow(TOP - (BH + GAP) + this.creep); if (this.rows % 30 === 0) { this.lives = Math.min(5, this.lives + 1); this.pop(this.W / 2, this.H * 0.5, '+1 BALL', '#22d3ee', 22); this.sfx.win(); } }
    this.setLevel(this.rows / 120);
    if (this.bricks.some(k => k.y + k.h >= this.dangerY)) { this.fx.ring(this.W / 2, this.dangerY, '#ef4444', 20, 300, 0.7, 6); this.kill(1.1); return; }
    if (this.eff.laser > 0) { this.laserT -= dt; if (this.laserT <= 0) { this.laserT = 0.28; this.lasers.push({ x: this.px - pw / 2 + 8, y: this.py - 10 }, { x: this.px + pw / 2 - 8, y: this.py - 10 }); this.sfx.tone(1500, 0.03, { type: 'square', vol: 0.05 }); } }
    for (const l of this.lasers) { l.y -= 950 * dt; for (const k of this.bricks) if (!k.dead && l.x > k.x && l.x < k.x + k.w && l.y > k.y && l.y < k.y + k.h) { l.dead = 1; this.breakBrick(k); break; } }
    this.lasers = this.lasers.filter(l => !l.dead && l.y > TOP - 10);
    for (const b of this.balls) {
      if (b.stuck) { b.x = this.px; b.y = this.py - 20; continue; }
      b.trail.push(b.x, b.y); if (b.trail.length > 16) b.trail.splice(0, 2);
      const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 6)), h = dt / steps, r = this.br;
      for (let s = 0; s < steps; s++) {
        b.x += b.vx * h; b.y += b.vy * h;
        if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); this.fx.sparks(b.x, b.y, '#7dd3fc', 2, 150, 0.2, 8, 0, 1.5); } if (b.x > this.W - r) { b.x = this.W - r; b.vx = -Math.abs(b.vx); this.fx.sparks(b.x, b.y, '#7dd3fc', 2, 150, 0.2, 8, Math.PI, 1.5); } if (b.y < TOP - 8 + r) { b.y = TOP - 8 + r; b.vy = Math.abs(b.vy); }
        if (b.vy > 0 && b.y + r >= this.py - 8 && b.y + r <= this.py + 14 && Math.abs(b.x - this.px) <= pw / 2 + r) {
          const off = clamp((b.x - this.px) / (pw / 2), -1, 1), a = -Math.PI / 2 + clamp(off * 1.05 + this.pvx / 2600, -1.2, 1.2), v = this.speed(); b.vx = Math.cos(a) * v; b.vy = Math.sin(a) * v; b.y = this.py - 8 - r; this.combo = 0; this.sfx.tone(300, 0.05, { type: 'square', vol: 0.15 }); this.fx.sparks(b.x, this.py - 8, '#67e8f9', 5, 260, 0.25, 12, -Math.PI / 2, 1.8); this.padHit = 0.12;
        }
        for (const k of this.bricks) { if (k.dead) continue;
          if (b.x + r > k.x && b.x - r < k.x + k.w && b.y + r > k.y && b.y - r < k.y + k.h) {
            const ox = Math.min(b.x + r - k.x, k.x + k.w - (b.x - r)), oy = Math.min(b.y + r - k.y, k.y + k.h - (b.y - r));
            if (ox < oy) { if (b.x < k.x + k.w / 2) { b.x = k.x - r; b.vx = -Math.abs(b.vx); } else { b.x = k.x + k.w + r; b.vx = Math.abs(b.vx); } } else { if (b.y < k.y + k.h / 2) { b.y = k.y - r; b.vy = -Math.abs(b.vy); } else { b.y = k.y + k.h + r; b.vy = Math.abs(b.vy); } }
            this.breakBrick(k); break; } }
        const v = Math.hypot(b.vx, b.vy), tv = this.speed(); if (Math.abs(v - tv) > 4) { b.vx *= tv / v; b.vy *= tv / v; } if (Math.abs(b.vy) < 120) b.vy = Math.sign(b.vy || -1) * 120;
      }
      if (b.y > this.H + 20) b.lost = true;
    }
    if (this.padHit > 0) this.padHit -= dt; this.bricks = this.bricks.filter(k => !k.dead); this.balls = this.balls.filter(b => !b.lost);
    if (!this.balls.length) { this.lives--; if (this.lives <= 0) { this.kill(1); return; } this.sfx.lose(); this.fx.shake(6); this.fx.flash('#ef4444', 0.2); this.pop(this.W / 2, this.H * 0.55, `${this.lives} BALL${this.lives === 1 ? '' : 'S'} LEFT`, '#f87171', 22); this.serve(); }
    for (const p of this.pu) { p.y += 170 * dt; p.t += dt; if (p.y > this.py - 14 && p.y < this.py + 16 && Math.abs(p.x - this.px) < pw / 2 + 12) { p.dead = 1; this.power(p.k); } } this.pu = this.pu.filter(p => !p.dead && p.y < this.H + 20);
  }
  power(k) {
    this.pop(this.px, this.py - 40, PUS[k].t, PUS[k].c, 20); this.sfx.chord([660, 990, 1320], 0.14, { type: 'triangle', vol: 0.25 }); this.fx.ring(this.px, this.py, PUS[k].c, 10, 90, 0.4, 4);
    if (k === 'multi') { const add = []; for (const b of this.balls.slice(0, 4)) { if (b.stuck) continue; for (const da of [-0.35, 0.35]) { const a = Math.atan2(b.vy, b.vx) + da, v = this.speed(); add.push({ x: b.x, y: b.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, trail: [] }); } } this.balls.push(...add); } else this.eff[k] = k === 'wide' ? 12 : 8;
  }
  initBg() {
    this.bgc = bake(Math.round(this.W / 2), Math.round(this.H / 2), (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#070a24'); gr.addColorStop(0.6, '#0d0b30'); gr.addColorStop(1, '#13093a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const hg = g.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, w * 0.9); hg.addColorStop(0, 'rgba(99,102,241,.35)'); hg.addColorStop(1, 'rgba(99,102,241,0)'); g.fillStyle = hg; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(103,232,249,.10)'; g.lineWidth = 1; g.beginPath(); const hz = h * 0.42; for (let i = -10; i <= 10; i++) { g.moveTo(w / 2 + i * w * 0.05, hz); g.lineTo(w / 2 + i * w * 0.34, h); } for (let j = 0; j < 12; j++) { const y = hz + Math.pow(j / 12, 2) * (h - hz); g.moveTo(0, y); g.lineTo(w, y); } g.stroke();
    });
    this.motes = Array.from({ length: 26 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.H, s: rnd(1, 2.6), v: rnd(6, 20) }));
  }
  paddleSpr(w) {
    const k = Math.round(w); if (this._pk === k) return this._pc; this._pk = k; const dpr = 2, h = 22; return (this._pc = bake((k + 8) * dpr, (h + 6) * dpr, (g) => {
      g.scale(dpr, dpr); g.translate(4, 3); roundRect(g, 0, 0, k, h, 11); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#f8fafc'); gr.addColorStop(0.45, '#94a3b8'); gr.addColorStop(0.55, '#475569'); gr.addColorStop(1, '#cbd5e1'); g.fillStyle = gr; g.fill(); g.strokeStyle = '#0f172a'; g.lineWidth = 1.5; g.stroke();
      roundRect(g, 10, h / 2 - 2.5, k - 20, 5, 2.5); const ng = g.createLinearGradient(0, 0, k, 0); ng.addColorStop(0, '#8b5cf6'); ng.addColorStop(0.5, '#22d3ee'); ng.addColorStop(1, '#8b5cf6'); g.fillStyle = ng; g.shadowColor = '#22d3ee'; g.shadowBlur = 8; g.fill();
    }));
  }
  render(ctx) {
    if (!this.bgc) this.initBg(); const B = this.B, W = this.W, H = this.H, t = this.t; ctx.drawImage(this.bgc, 0, 0, W, H);
    for (const m of this.motes) { m.y -= m.v * 0.016; if (m.y < 0) { m.y = H; m.x = Math.random() * W; } ctx.globalAlpha = 0.3; ctx.fillStyle = '#a5b4fc'; ctx.fillRect(m.x, m.y, m.s, m.s); } ctx.globalAlpha = 1;
    const dz = this.bricks.reduce((m, k) => Math.max(m, k.y + k.h), 0), near = clamp((dz - (this.dangerY - 170)) / 170, 0, 1);
    ctx.fillStyle = 'rgba(8,10,32,.35)'; ctx.fillRect(8, TOP - 8, W - 16, this.py - TOP + 40); ctx.strokeStyle = 'rgba(139,92,246,.35)'; ctx.lineWidth = 1.5; ctx.strokeRect(8, TOP - 8, W - 16, this.py - TOP + 40);
    ctx.save(); ctx.strokeStyle = `rgba(239,68,68,${0.4 + near * 0.6 * (0.5 + 0.5 * Math.sin(t * 10))})`; ctx.setLineDash([10, 8]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, this.dangerY); ctx.lineTo(W - 12, this.dangerY); ctx.stroke(); ctx.restore();
    if (near > 0) { const g = ctx.createLinearGradient(0, this.dangerY - 70, 0, this.dangerY); g.addColorStop(0, 'rgba(239,68,68,0)'); g.addColorStop(1, `rgba(239,68,68,${0.3 * near})`); ctx.fillStyle = g; ctx.fillRect(8, this.dangerY - 70, W - 16, 70); }
    ctx.save(); ctx.beginPath(); ctx.rect(0, TOP - 8, W, H); ctx.clip();
    for (const k of this.bricks) {
      const isB = k.kind === 'bomb', name = 'b_' + (isB ? 'black' : k.kind), col = HCOL[k.kind];
      if (k.kind === 'yellow') halo(ctx, '#fbbf24', k.x + k.w / 2, k.y + k.h / 2, k.w * 0.8, 0.35 + 0.15 * Math.sin(t * 4 + k.x));
      spr(ctx, B, name, k.x + k.w / 2, k.y + k.h / 2, k.w + 3, k.h + 3);
      if (k.hit > 0) { ctx.globalCompositeOperation = 'lighter'; spr(ctx, B, name, k.x + k.w / 2, k.y + k.h / 2, k.w + 3, k.h + 3, 0, 0.8); ctx.globalCompositeOperation = 'source-over'; }
      if (k.kind === 'grey' && k.hp < 2) { ctx.strokeStyle = 'rgba(15,23,42,.8)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(k.x + k.w * 0.3, k.y + 3); ctx.lineTo(k.x + k.w * 0.42, k.y + k.h * 0.5); ctx.lineTo(k.x + k.w * 0.32, k.y + k.h - 3); ctx.moveTo(k.x + k.w * 0.42, k.y + k.h * 0.5); ctx.lineTo(k.x + k.w * 0.7, k.y + k.h * 0.6); ctx.stroke(); }
      if (isB) { const cx = k.x + k.w / 2, cy = k.y + k.h / 2; halo(ctx, '#fb923c', cx, cy, 20, 0.6 + 0.4 * Math.sin(t * 8)); ctx.fillStyle = '#fb923c'; ctx.beginPath(); ctx.arc(cx, cy + 1, 6, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(cx - 1, cy - 8, 2, 4); }
    }
    ctx.restore();
    for (const l of this.lasers) { halo(ctx, '#fb7185', l.x, l.y, 14, 0.8); ctx.fillStyle = '#ffe4e6'; ctx.fillRect(l.x - 1.5, l.y - 14, 3, 20); }
    for (const p of this.pu) { const D = PUS[p.k]; halo(ctx, D.c, p.x, p.y, 26, 0.7); roundRect(ctx, p.x - 17, p.y - 10, 34, 20, 10); const g = ctx.createLinearGradient(0, p.y - 10, 0, p.y + 10); g.addColorStop(0, lighten(D.c, 0.5)); g.addColorStop(1, shade(D.c, 0.45)); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1.2; ctx.stroke(); this.text(ctx, D.g, p.x, p.y + 5, { size: 13, color: '#fff', align: 'center' }); }
    const pw = this.pw(); halo(ctx, '#22d3ee', this.px, this.py + 10, pw * 0.7, 0.18 + (this.padHit > 0 ? 0.3 : 0)); const ps = this.paddleSpr(pw); ctx.drawImage(ps, this.px - pw / 2 - 4, this.py - 14, pw + 8, 28);
    if (this.eff.laser > 0) { ctx.fillStyle = '#fb7185'; ctx.fillRect(this.px - pw / 2 + 5, this.py - 18, 6, 9); ctx.fillRect(this.px + pw / 2 - 11, this.py - 18, 6, 9); }
    for (const b of this.balls) {
      for (let i = 0; i < b.trail.length; i += 2) { const f = i / b.trail.length; ctx.globalAlpha = f * 0.5; halo(ctx, '#38bdf8', b.trail[i], b.trail[i + 1], this.br * (0.7 + f * 1.1), 1); } ctx.globalAlpha = 1;
      halo(ctx, '#7dd3fc', b.x, b.y, this.br * 3, 0.7); spr(ctx, B, 'ball', b.x, b.y, this.br * 2.3);
    }
    this.hud(ctx, { best: this.best, label: 'SCORE', chip: 'ROW ' + this.rows, chipColor: 'rgba(34,211,238,.35)' });
    for (let i = 0; i < this.lives; i++) { halo(ctx, '#7dd3fc', W - 24 - i * 20, 74, 12, 0.5); spr(ctx, B, 'ball', W - 24 - i * 20, 74, 14); }
    this.text(ctx, 'x' + this.mult().toFixed(1) + (this.combo > 1 ? '  CHAIN ' + this.combo : ''), 18, 80, { size: 12, color: '#fde047', font: 'Exo' });
    if (this.balls.some(b => b.stuck) && this.state === 'play') this.text(ctx, 'TAP TO LAUNCH', W / 2, this.py - 52, { size: 16, color: '#c4b5fd', align: 'center', glow: '#8b5cf6' });
  }
}

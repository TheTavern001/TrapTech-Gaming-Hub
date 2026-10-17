// Sling Smash - original endless slingshot game (v7). Drag back the wooden slingshot, fire a steel ball and topple towers of
// wood, glass and stone to knock out the Glitch Bots. Lightweight physics: the ball is a real projectile (gravity, wind, bounces);
// blocks are boxes that break when hit hard enough and fall when their support is gone; bots break when hit or crushed.
// Art: Blender Cycles renders (original models, PBR wood/glass/stone, steel ball, Glitch Bot, slingshot fork), v6 sky layers.
import { loadAtlas, loadLayers, spr, sprC, softShadow, reducedMotion } from './engine.js';
import { Game8, TAU, rnd, clamp, lerp, roundRect, fmt } from './kit.js';
const MAT = { wood: { hp: 2.2, pts: 10, col: ['#a16207', '#78350f'] }, glass: { hp: 1, pts: 20, col: ['#bae6fd', '#7dd3fc'] }, stone: { hp: 4.5, pts: 40, col: ['#a8a29e', '#57534e'] } };
const G = 900;
export class SlingSmash extends Game8 {
  get accent() { return '#fb923c'; }
  get musicOpts() { return { root: 57, bpm: 100, mode: 'major', seed: 33, vol: 0.28 }; }
  burst(x, y, c, n, sp, life, size) { this.fx.burst(x, y, c, Math.ceil(n * 0.8), sp, life, (size || 4) * 2.2); }
  get title() { return 'SLING SMASH'; }
  get hint() { return 'Drag back from the slingshot to aim, then let go to fire. Knock out every Glitch Bot to clear the tower. Unused balls carry over, and towers get taller and windier forever. Run out of balls with bots still standing and the run ends.'; }
  async load() { const [S, L] = await Promise.all([loadAtlas('/assets/v7/sling'), loadLayers({ sky: 'px-sky.webp', far: 'px-far.webp' })]); this.S = S; this.L = L; }
  layout() { this.ground = this.H - 150; this.sx = 92; this.sy = this.ground - 120; }
  reset() { super.reset(); this.layout(); this.score = 0; this.coins = 0; this.balls = 5; this.tower = 0; this.used = 0; this.ball = null; this.aim = null; this.blocks = []; this.bots = []; this.wind = 0; this.settle = 0; this.over = 0; this.next = 0.8; this.shake = 0; this.trail = []; }
  build() {
    this.tower++; this.mark('t', this.tower); this.used = 0; this.blocks = []; this.bots = []; const k = this.tower; const cols = Math.min(4, 2 + Math.floor(k / 3)), floors = Math.min(6, 2 + Math.floor(k / 2)); const bw = 26, colW = Math.min(80, (this.W - 230) / cols); const x0 = this.W - 40 - cols * colW;
    this.wind = k < 3 ? 0 : rnd(-1, 1) * Math.min(160, 30 + k * 10);
    const pick = () => { const r = this.r(); const sp = Math.min(0.45, 0.05 + k * 0.04); return r < sp ? 'stone' : r < sp + 0.3 ? 'glass' : 'wood'; };
    let y = this.ground; const botsWanted = 2 + Math.floor(k / 3); const slots = [];
    for (let f = 0; f < floors; f++) { const h = 78; const m = pick();
      for (let c = 0; c <= cols; c++) this.blocks.push({ x: x0 + c * colW - bw / 2 + (c === cols ? -0 : 0), y: y - h, w: bw, h, m, hp: MAT[m].hp, vy: 0 });
      for (let c = 0; c < cols; c++) slots.push({ x: x0 + c * colW + colW / 2, y: y - 4 });
      const pm = pick(); this.blocks.push({ x: x0 - bw / 2 - 6, y: y - h - 16, w: cols * colW + bw + 12, h: 16, m: pm, hp: MAT[pm].hp * 1.3, vy: 0 }); y -= h + 16; }
    for (let i = 0; i < botsWanted; i++) { const s = slots.splice(Math.floor(this.r() * slots.length), 1)[0] || { x: x0 + colW / 2, y }; this.bots.push({ x: s.x, y: s.y - 22, r: 22, vy: 0, alive: true, t: this.r() * 6 }); }
    // the bots on top floor stand on the roof slab
    this.pop(this.W / 2, this.H * 0.3, `TOWER ${k}`, '#fde047', 28); if (this.wind) this.pop(this.W / 2, this.H * 0.3 + 30, `WIND ${this.wind > 0 ? '→' : '←'} ${Math.abs(Math.round(this.wind / 10))}`, '#bae6fd', 16);
  }
  onDown(x, y) { if (this.ball || this.over || this.next > 0 || this.balls <= 0) return; if (Math.hypot(x - this.sx, y - this.sy) < 140) this.aim = [x, y]; }
  onMove(x, y) { if (this.aim) this.aim = [x, y]; }
  onUp(x, y, e) { if (e && e.cancelled) { this.aim = null; return; } if (!this.aim) return; const [dx, dy] = this.pull(); this.aim = null; if (Math.hypot(dx, dy) < 18) return; this.balls--; this.used++; this.ball = { x: this.sx, y: this.sy, vx: -dx * 7.2, vy: -dy * 7.2, r: 13, life: 7, rest: 0 }; this.trail = []; this.sfx.tone(240, 0.12, { type: 'sawtooth', vol: 0.18, slide: 2 }); }
  pull() { const [x, y] = this.aim; let dx = x - this.sx, dy = y - this.sy; const d = Math.hypot(dx, dy), m = 110; if (d > m) { dx *= m / d; dy *= m / d; } return [dx, dy]; }
  onKey() {}
  support(b) { if (b.y + b.h >= this.ground - 0.5) return true; return this.blocks.some(o => o !== b && !o.dead && o.y >= b.y + b.h - 2 && o.y <= b.y + b.h + 2 && o.x < b.x + b.w - 2 && o.x + o.w > b.x + 2); }
  breakBlock(b, by) { if (b.dead) return; b.dead = true; this.award(MAT[b.m].pts, 'k'); const cx = b.x + b.w / 2, cy = b.y + b.h / 2; this.burst(cx, cy, MAT[b.m].col, b.m === 'glass' ? 14 : 10, 200, 0.6, b.m === 'glass' ? 3 : 4); if (b.m === 'glass') this.sfx.tone(rnd(1800, 2600), 0.06, { type: 'triangle', vol: 0.15 }); else this.sfx.noise(0.08, { vol: 0.18, freq: b.m === 'stone' ? 500 : 1100 }); }
  killBot(o) { if (!o.alive) return; o.alive = false; this.award(500, 'b'); this.pop(o.x, o.y - 24, '+500', '#fde047', 22); this.burst(o.x, o.y, ['#fb923c', '#34d399', '#fff'], 22, 260, 0.7, 4); this.sfx.chord([523, 784], 0.15, { type: 'square', vol: 0.15 }); this.shake = 0.25; }
  update(dt) {
    if (this.shake > 0) this.shake -= dt;
    if (this.over) { this.over -= dt; if (this.over <= 0) this.finish(); return; }
    if (this.next > 0) { this.next -= dt; if (this.next <= 0) this.build(); return; }
    const b = this.ball;
    if (b) { const steps = 4; const h = dt / steps;
      for (let s = 0; s < steps; s++) { b.vy += G * h; b.vx += this.wind * h; b.x += b.vx * h; b.y += b.vy * h;
        if (b.y + b.r > this.ground) { b.y = this.ground - b.r; b.vy *= -0.35; b.vx *= 0.8; }
        for (const k of this.blocks) { if (k.dead) continue; if (b.x + b.r > k.x && b.x - b.r < k.x + k.w && b.y + b.r > k.y && b.y - b.r < k.y + k.h) { const sp = Math.hypot(b.vx, b.vy); const dmg = sp / 260;
            k.hp -= dmg; if (k.hp <= 0) { this.breakBlock(k); b.vx *= 0.72; b.vy *= 0.72; } else { const ox = Math.min(b.x + b.r - k.x, k.x + k.w - (b.x - b.r)), oy = Math.min(b.y + b.r - k.y, k.y + k.h - (b.y - b.r)); if (ox < oy) { b.vx = -b.vx * 0.4; b.x += Math.sign(b.x - (k.x + k.w / 2)) * ox; } else { b.vy = -b.vy * 0.4; b.y += Math.sign(b.y - (k.y + k.h / 2)) * oy; } this.sfx.tone(160, 0.05, { type: 'square', vol: 0.1 }); } break; } }
        for (const o of this.bots) if (o.alive && Math.hypot(o.x - b.x, o.y - b.y) < o.r + b.r) { this.killBot(o); b.vx *= 0.85; } }
      b.trail = (this.trail.push([b.x, b.y]), this.trail.length > 18 && this.trail.shift()); b.life -= dt;
      if (Math.hypot(b.vx, b.vy) < 40 && b.y > this.ground - b.r - 2) b.rest += dt;
      if (b.x > this.W + 60 || b.x < -60 || b.life <= 0 || b.rest > 0.6) { this.ball = null; this.settle = 1.2; } }
    // gravity on unsupported blocks and bots; a big fall crushes bots
    for (const k of this.blocks) { if (k.dead) continue; if (!this.support(k)) { k.vy += G * dt; k.y += k.vy * dt; if (k.y + k.h > this.ground) { k.y = this.ground - k.h; if (k.vy > 380) this.breakBlock(k); k.vy = 0; } for (const o of this.blocks) if (o !== k && !o.dead && k.vy > 0 && k.x < o.x + o.w && k.x + k.w > o.x && k.y + k.h > o.y && k.y < o.y) { if (k.vy > 420) { this.breakBlock(o); } k.y = o.y - k.h; k.vy = 0; } for (const o of this.bots) if (o.alive && k.vy > 150 && o.x > k.x && o.x < k.x + k.w && k.y + k.h > o.y - o.r) this.killBot(o); } else k.vy = 0; }
    for (const o of this.bots) { if (!o.alive) continue; o.t += dt; const below = this.blocks.some(k => !k.dead && o.x > k.x - 4 && o.x < k.x + k.w + 4 && k.y >= o.y + o.r - 3 && k.y <= o.y + o.r + 6) || o.y + o.r >= this.ground - 1;
      if (!below) { o.vy += G * dt; o.y += o.vy * dt; if (o.y + o.r >= this.ground) { o.y = this.ground - o.r; if (o.vy > 300) this.killBot(o); o.vy = 0; } for (const k of this.blocks) if (!k.dead && o.vy > 0 && o.x > k.x && o.x < k.x + k.w && o.y + o.r > k.y && o.y < k.y) { if (o.vy > 330) this.killBot(o); o.y = k.y - o.r; o.vy = 0; } } else o.vy = 0; }
    this.blocks = this.blocks.filter(k => !k.dead);
    if (!this.ball && this.settle > 0) { this.settle -= dt; if (this.settle <= 0) this.check(); }
  }
  check() {
    if (this.bots.every(o => !o.alive)) { const k = this.tower; const spare = Math.max(0, 3 - this.used); const bonus = this.award(1000 * Math.min(5, k) * (spare + 1) / 2, 'c'); this.balls += 1 + spare; this.pop(this.W / 2, this.H * 0.35, `TOWER CLEARED  +${fmt(bonus)}`, '#34d399', 24); this.pop(this.W / 2, this.H * 0.35 + 30, `+${1 + spare} BALL${spare ? 'S' : ''}`, '#bae6fd', 18); this.sfx.win(); if (k % 3 === 0) this.coins++; this.next = 1.6; return; }
    if (this.balls <= 0) { this.over = 1.4; this.sfx.lose(); this.fx.shake(10); this.fx.flash('#ef4444', 0.25); }
  }
  render(ctx) {
    const W = this.W, H = this.H, S = this.S, L = this.L || {}, t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1026'); g.addColorStop(0.7, '#3b1d4a'); g.addColorStop(1, '#7c2d12'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    if (L.sky) { ctx.globalAlpha = 0.7; L.sky.draw(ctx, t * 3, 0, 0, W, this.ground * 0.8); ctx.globalAlpha = 1; } if (L.far) L.far.draw(ctx, t * 5 + this.tower * 120, 0, this.ground - 260, W, 280);
    ctx.save(); if (this.shake > 0 && !reducedMotion()) ctx.translate(rnd(-5, 5) * this.shake * 3, rnd(-5, 5) * this.shake * 3);
    const gg = ctx.createLinearGradient(0, this.ground, 0, H); gg.addColorStop(0, '#3f3a2e'); gg.addColorStop(0.08, '#2a251c'); gg.addColorStop(1, '#100d08'); ctx.fillStyle = gg; ctx.fillRect(-20, this.ground, W + 40, H - this.ground + 20); ctx.fillStyle = 'rgba(255,220,160,0.25)'; ctx.fillRect(-20, this.ground, W + 40, 2);
    for (const k of this.blocks) { softShadow(ctx, k.x + k.w / 2, this.ground + 4, k.w * 0.6, 5, 0.35); const v = k.w > k.h * 1.5 ? 'h' : k.h > k.w * 1.5 ? 'v' : 'sq'; if (!spr(ctx, S, `${k.m}_${v}`, k.x, k.y, k.w, k.h)) { ctx.fillStyle = MAT[k.m].col[0]; ctx.fillRect(k.x, k.y, k.w, k.h); }
      if (k.hp < MAT[k.m].hp * 0.6) { ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(k.x + k.w * 0.2, k.y + k.h * 0.3); ctx.lineTo(k.x + k.w * 0.5, k.y + k.h * 0.55); ctx.lineTo(k.x + k.w * 0.8, k.y + k.h * 0.4); ctx.stroke(); } }
    for (const o of this.bots) if (o.alive) { softShadow(ctx, o.x, o.y + o.r, o.r, 5, 0.4); sprC(ctx, S, 'bot', o.x, o.y + Math.sin(o.t * 3) * 1.2, o.r * 2.3); }
    // slingshot: back band, fork, ball in pouch, front band
    const fy = this.ground - 60; const [px, py] = this.aim ? (([dx, dy]) => [this.sx + dx, this.sy + dy])(this.pull()) : [this.sx, this.sy];
    ctx.strokeStyle = '#3b1d0e'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(this.sx + 16, this.sy - 4); ctx.lineTo(px, py); ctx.stroke();
    sprC(ctx, S, 'fork', this.sx, fy - 4, 70);
    if (this.balls > 0 && !this.ball && !this.next) sprC(ctx, S, 'ball', px, py, 28);
    ctx.strokeStyle = '#4a2511'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(this.sx - 16, this.sy - 4); ctx.lineTo(px, py); ctx.stroke();
    if (this.aim) { const [dx, dy] = this.pull(); let x = this.sx, y = this.sy, vx = -dx * 7.2, vy = -dy * 7.2; ctx.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 16; i++) { for (let j = 0; j < 4; j++) { vy += G * 0.0125; vx += this.wind * 0.0125; x += vx * 0.0125; y += vy * 0.0125; } if (i > 1) { ctx.beginPath(); ctx.arc(x, y, 3.2 - i * 0.12, 0, TAU); ctx.fill(); } } }
    if (this.ball) { const b = this.ball; this.trail.forEach(([x, y], i) => { ctx.globalAlpha = i / this.trail.length * 0.35; ctx.fillStyle = '#e2e8f0'; ctx.beginPath(); ctx.arc(x, y, b.r * (0.4 + 0.5 * i / this.trail.length), 0, TAU); ctx.fill(); }); ctx.globalAlpha = 1; softShadow(ctx, b.x, this.ground + 3, b.r, 4, 0.4); sprC(ctx, S, 'ball', b.x, b.y, b.r * 2.2); }
    ctx.restore();
    this.hudScore(ctx);
    this.text(ctx, `TOWER ${this.tower}`, W - 18, 30, { size: 12, weight: 800, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < Math.min(8, this.balls); i++) sprC(ctx, S, 'ball', W - 26 - i * 22, 52, 18); if (this.balls > 8) this.text(ctx, `+${this.balls - 8}`, W - 200, 57, { size: 12, weight: 800, color: '#e2e8f0' });
    this.text(ctx, `BOTS ${this.bots.filter(o => o.alive).length}`, W - 18, 84, { size: 12, weight: 800, align: 'right', color: '#fdba74', font: 'Exo' });
    if (this.wind) { const a = Math.sign(this.wind); ctx.fillStyle = 'rgba(186,230,253,0.85)'; this.text(ctx, `WIND ${a > 0 ? '→' : '←'} ${Math.abs(Math.round(this.wind / 10))}`, W / 2, 30, { size: 12, weight: 800, align: 'center', color: '#bae6fd' }); }
    if (this.state === 'play' && this.tower === 1 && this.used === 0 && !this.aim) this.text(ctx, 'DRAG BACK FROM THE SLINGSHOT', this.sx + 30, this.sy - 90, { size: 13, weight: 800, color: '#fde68a' });
  }
}

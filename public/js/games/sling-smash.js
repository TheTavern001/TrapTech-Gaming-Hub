// Sling Smash v8 - fully rebuilt (original code and original baked art; procedural WebAudio).
// New in v8: a real rigid-box solver (stacking, friction, toppling, sleeping) instead of fall-straight-down blocks, a live aim preview,
// baked material tiles / robots so the frame cost stays tiny (no per-block gradients), spare-ball rewards and wind from tower 3.
// Scoring contract unchanged (src/ac-levels.js): 't' tower, 'k' block 10/20/40, 'b' bot 500, 'c' clear bonus 1000*min(5,k)*(sp+1)/2.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, halo, bake, roundRect } from './kit.js';
const G = 1100;
const MAT = { wood: { hp: 2.2, pts: 10, m: 1 }, glass: { hp: 1, pts: 20, m: 0.6 }, stone: { hp: 4.5, pts: 40, m: 2 } };
export class SlingSmash extends Game8 {
  get title() { return 'SLING SMASH'; }
  get hint() { return 'Drag back from the slingshot and let go to fire. Smash the Glitch Bots: topple the towers of wood, glass and stone onto them. Clear a tower with fewer balls for a bigger bonus. Every cleared tower earns a spare ball. Out of balls ends the run.'; }
  get accent() { return '#fb923c'; }
  get musicOpts() { return { root: 57, bpm: 102, mode: 'major', seed: 33, vol: 0.28 }; }
  layout() { this.ground = this.H - 130; this.sx = Math.min(96, this.W * 0.18); this.sy = this.ground - 110; this.bgc = null; }
  reset() { super.reset(); this.layout(); this.score = 0; this.coins = 0; this.balls = 5; this.tower = 0; this.used = 0; this.ball = null; this.aim = null; this.blocks = []; this.wind = 0; this.settle = 0; this.next = 0.6; this.over = 0; this.cleared = false; this.clearT = 0; this.trail = []; }
  // ---- tower generation (<= 60 blocks, bots <= 2 + floor(k/3))
  build() {
    this.tower++; const k = this.tower, floors = Math.min(5, 2 + Math.floor(k / 2)), W = this.W, g = this.ground; this.blocks = []; this.used = 0; this.cleared = false; this.mark('t', k);
    this.wind = k >= 3 ? (this.r() < 0.5 ? -1 : 1) * Math.round(this.r() * Math.min(40, 8 + k * 3)) : 0;
    const nb = Math.min(2 + Math.floor(k / 3), 5), cols = Math.min(4, 2 + Math.floor(k / 3)), cw = 70, gapx = 62, x0 = W - 50 - cols * (cw + gapx); const pick = () => { const r = this.r(); return k < 3 ? (r < 0.6 ? 'wood' : r < 0.9 ? 'glass' : 'stone') : (r < 0.35 ? 'wood' : r < 0.65 ? 'glass' : 'stone'); };
    let y = g, bots = 0; const bx = (m, x, yy, w, h, bot) => this.blocks.push({ m, x, y: yy, w, h, vx: 0, vy: 0, dmg: 0, sl: true, st: 0, bot: !!bot, ph: this.r() * TAU, dead: false });
    for (let f = 0; f < floors; f++) {
      const ph = 54; y -= ph; for (let c = 0; c < cols + 1; c++) bx(pick(), x0 + c * (cw + gapx) - 9, y, 18, ph);
      y -= 16; for (let c = 0; c < cols; c++) { bx(pick(), x0 + c * (cw + gapx) - 14, y, cw + gapx + 28, 16); }
      // bots rest on the plank between pillars
      for (let c = 0; c < cols && bots < nb; c++) if ((f === floors - 1 || this.r() < 0.45)) { bx('glass', x0 + c * (cw + gapx) + (cw + gapx) / 2 - 14, y - 30, 28, 30, true); bots++; }
    }
    while (bots < nb) { const c = Math.floor(this.r() * cols); bx('glass', x0 + c * (cw + gapx) + (cw + gapx) / 2 - 14, y - 30 - bots * 31, 28, 30, true); bots++; }
    this.nBots = nb; for (const b of this.blocks) b.sl = true;
    this.pop(this.W / 2, 150, 'TOWER ' + k, '#fde68a', 24);
  }
  pull() { let dx = this.aim[0] - this.sx, dy = this.aim[1] - this.sy; const d = Math.hypot(dx, dy), mx = 96; if (d > mx) { dx *= mx / d; dy *= mx / d; } return [dx, dy]; }
  onDown(x, y) { if (this.ball || this.over || this.next > 0 || this.balls <= 0 || this.cleared) return; if (Math.hypot(x - this.sx, y - this.sy) < 150) { this.aim = [x, y]; this.sfx.tone(300, 0.05, { type: 'sine', vol: 0.1 }); } }
  onMove(x, y) { if (this.aim) this.aim = [x, y]; }
  onUp(x, y, e) { if (e && e.cancelled) { this.aim = null; return; } if (!this.aim) return; const [dx, dy] = this.pull(); this.aim = null; if (Math.hypot(dx, dy) < 20) return; this.balls--; this.used++; this.ball = { x: this.sx - dx * 0.6, y: this.sy - dy * 0.6, vx: -dx * 8.4, vy: -dy * 8.4, r: 14, life: 8, bn: 0 }; this.trail.length = 0; this.sfx.tone(240, 0.14, { type: 'sawtooth', vol: 0.2, slide: 2.2 }); this.fx.ring(this.sx, this.sy, '#fb923c', 6, 40, 0.3, 3); this.fx.shake(2); }
  breakB(b, by) {
    if (b.dead) return; b.dead = true; const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    if (b.bot) { this.award(500, 'b'); this.pop(cx, cy - 20, '+500', '#fb923c', 22); this.fx.burst(cx, cy, ['#a3e635', '#fde047', '#fff'], 16, 380, 0.7, 14); this.fx.ring(cx, cy, '#fde047', 8, 80, 0.4, 4); this.fx.shake(7); this.hitstop(0.05); this.sfx.chord([392, 523, 784], 0.16, { type: 'square', vol: 0.12 }); this.fx.debris(cx, cy, '#94a3b8', 6, 300, 0.8, 6); return; }
    this.award(MAT[b.m].pts, 'k'); const col = b.m === 'glass' ? ['#bae6fd', '#fff'] : b.m === 'stone' ? ['#a8a29e', '#57534e'] : ['#d97706', '#78350f']; this.fx.debris(cx, cy, col, b.m === 'glass' ? 9 : 7, 280, 0.8, b.m === 'glass' ? 5 : 7); this.fx.sparks(cx, cy, col, 4, 220, 0.3, 8);
    if (b.m === 'glass') this.sfx.tone(rnd(1800, 2600), 0.06, { type: 'triangle', vol: 0.14 }); else this.sfx.noise(0.08, { vol: 0.18, freq: b.m === 'stone' ? 500 : 1100 });
  }
  hurtB(b, d) { b.dmg += d; if (b.dmg >= (b.bot ? 0.8 : MAT[b.m].hp)) this.breakB(b); }
  step(dt) {
    const B = this.blocks, g = this.ground, W = this.W;
    // support check wakes sleepers
    for (const b of B) { if (!b.sl || b.dead) continue; let sup = b.y + b.h >= g - 1; if (!sup) for (const o of B) if (o !== b && !o.dead && o.y >= b.y + b.h - 2 && o.y <= b.y + b.h + 3 && o.x < b.x + b.w - 2 && o.x + o.w > b.x + 2) { sup = true; break; } if (!sup) b.sl = false; }
    for (const b of B) { if (b.sl || b.dead) continue; b.vy += G * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y + b.h > g) { const imp = b.vy; b.y = g - b.h; if (imp > 260) this.hurtB(b, (imp - 260) / 260); b.vy = 0; b.vx *= Math.max(0, 1 - 7 * dt); } if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * 0.3; } if (b.x + b.w > W) { b.x = W - b.w; b.vx = -Math.abs(b.vx) * 0.3; }
      if (Math.abs(b.vx) < 7 && Math.abs(b.vy) < 7) { b.st += dt; if (b.st > 0.35) { b.sl = true; b.vx = b.vy = 0; b.st = 0; } } else b.st = 0; }
    for (let it = 0; it < 2; it++) for (let i = 0; i < B.length; i++) { const a = B[i]; if (a.dead) continue; for (let j = i + 1; j < B.length; j++) { const c = B[j]; if (c.dead || (a.sl && c.sl)) continue;
      const ox = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x), oy = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y); if (ox <= 0 || oy <= 0) continue;
      const ia = a.sl ? 0 : 1 / MAT[a.m].m, ic = c.sl ? 0 : 1 / MAT[c.m].m, is = ia + ic; if (!is) continue;
      if (oy < ox) { const aTop = a.y + a.h / 2 < c.y + c.h / 2, s = aTop ? -1 : 1; a.y += s * oy * ia / is; c.y -= s * oy * ic / is; const rv = aTop ? a.vy - c.vy : c.vy - a.vy;
        if (rv > 0) { const J = rv * 1.05 / is; if (rv > 150) { const d = (rv - 150) / 230; this.hurtB(a, d); this.hurtB(c, d); } if (aTop) { a.vy -= J * ia; c.vy += J * ic; } else { c.vy -= J * ic; a.vy += J * ia; } }
        const tv = a.vx - c.vx; a.vx -= tv * 0.25 * ia / is; c.vx += tv * 0.25 * ic / is; if (!a.sl || !c.sl) { if (Math.abs(rv) > 30) { a.sl = c.sl = false; } else if (!a.sl) c.sl = c.sl && Math.abs(c.vx) < 1; } }
      else { const aL = a.x + a.w / 2 < c.x + c.w / 2, s = aL ? -1 : 1; a.x += s * ox * ia / is; c.x -= s * ox * ic / is; const rv = aL ? a.vx - c.vx : c.vx - a.vx; if (rv > 0) { const J = rv * 1.15 / is; if (rv > 170) { const d = (rv - 170) / 250; this.hurtB(a, d); this.hurtB(c, d); } if (aL) { a.vx -= J * ia; c.vx += J * ic; } else { c.vx -= J * ic; a.vx += J * ia; } a.sl = false; c.sl = false; } } } }
    // bots hit by falling blocks
    for (const b of B) if (b.bot && !b.dead && !b.sl && (b.vy > 330 || Math.abs(b.vx) > 380)) this.hurtB(b, 1);
    this.blocks = B.filter(b => !b.dead);
  }
  update(dt) {
    if (this.next > 0) { this.next -= dt; if (this.next <= 0 && !this.blocks.length) this.build(); }
    // sub-step physics for stability
    const n = Math.max(1, Math.ceil(dt / 0.012)), h = dt / n; for (let i = 0; i < n; i++) { this.step(h); this.stepBall(h); }
    const bl = this.ball; if (bl) { this.trail.push([bl.x, bl.y]); if (this.trail.length > 18) this.trail.shift(); } else if (this.trail.length) this.trail.shift();
    const bots = this.blocks.filter(b => b.bot).length;
    if (!this.cleared && this.nBots !== undefined && bots === 0 && this.tower > 0 && this.blocks.length >= 0 && !this.next) { this.cleared = true; this.clearT = 1.6; const sp = this.used <= 1 ? 3 : this.used === 2 ? 2 : this.used === 3 ? 1 : 0, bonus = 1000 * Math.min(5, this.tower) * (sp + 1) / 2; this.award(bonus, 'c'); this.balls = Math.min(9, this.balls + 1); this.coins++; this.pop(this.W / 2, this.H * 0.3, `TOWER CLEARED +${fmt(bonus)}`, '#fde047', 24); this.fx.ring(this.W / 2, this.H * 0.3, '#fde047', 10, 160, 0.6, 5); this.fx.flash('#fde047', 0.18); this.sfx.chord([523, 659, 784, 1047], 0.3, { type: 'triangle', vol: 0.25 }); this.setLevel(Math.min(1, this.tower / 12)); }
    if (this.cleared) { this.clearT -= dt; if (this.clearT <= 0) { this.blocks = []; this.cleared = false; this.next = 0.4; this.nBots = undefined; } }
    if (!this.cleared && !this.ball && this.balls <= 0 && !this.over && this.tower > 0 && this.next <= 0) { this.over = 1; this.settle = (this.settle || 0) + dt; if (this.settle > 1.4 || this.blocks.every(b => b.sl)) { this.kill(0.8, '#fb923c'); } } else if (this.balls > 0) this.settle = 0; }
  stepBall(dt) {
    const b = this.ball; if (!b) return; b.vy += G * dt; b.vx += this.wind * 2.2 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.y + b.r > this.ground) { b.y = this.ground - b.r; b.vy = -b.vy * 0.4; b.vx *= 0.8; b.bn++; if (Math.abs(b.vy) < 60) b.vy = 0; this.fx.smoke(b.x, b.y + b.r, '#a8a29e', 1, 0.4, 10); }
    for (const k of this.blocks) { if (k.dead) continue; const cx = clamp(b.x, k.x, k.x + k.w), cy = clamp(b.y, k.y, k.y + k.h), dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy); if (d >= b.r) continue;
      const sp = Math.hypot(b.vx, b.vy), nx = d > 0.001 ? dx / d : -1, ny = d > 0.001 ? dy / d : 0; const m = MAT[k.m].m; k.sl = false; k.vx += b.vx * 0.55 / m; k.vy += b.vy * 0.25 / m; this.hurtB(k, sp / 250); if (sp > 300) this.fx.sparks(cx, cy, ['#fff', '#fde047'], 5, 300, 0.25, 10);
      b.x += nx * (b.r - d); b.y += ny * (b.r - d); const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.5 * vn * nx; b.vy -= 1.5 * vn * ny; } b.vx *= k.dead ? 0.92 : 0.6; b.vy *= k.dead ? 0.92 : 0.6; b.bn++; this.sfx.noise(0.05, { vol: Math.min(0.25, sp / 2500), freq: 400 }); }
    if (b.x > this.W + 80 || b.x < -80 || b.life <= 0 || (b.y > this.ground - b.r - 1 && Math.abs(b.vx) < 25)) { this.fx.smoke(b.x, b.y, '#cbd5e1', 2, 0.4, 12); this.ball = null; }
  }
  art() {
    if (this.A) return this.A; const A = this.A = {}, W = this.W, H = this.H;
    A.bg = bake(Math.round(W / 2), Math.round(H / 2), (g) => { g.scale(0.5, 0.5); const s = g.createLinearGradient(0, 0, 0, H); s.addColorStop(0, '#1b1450'); s.addColorStop(0.55, '#6d2f86'); s.addColorStop(0.85, '#f0716b'); s.addColorStop(1, '#fbbf24'); g.fillStyle = s; g.fillRect(0, 0, W, H);
      let q = 3; const rr = () => (q = (q * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${rr() * 0.6})`; g.fillRect(rr() * W, rr() * H * 0.5, 2, 2); } g.fillStyle = '#fff6c9'; g.beginPath(); g.arc(W * 0.78, H * 0.2, 36, 0, TAU); g.fill();
      for (const [c, y, amp, f] of [['#3b2a73', 0.66, 60, 0.012], ['#2a1d57', 0.72, 44, 0.02]]) { g.fillStyle = c; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 10) g.lineTo(x, H * y + Math.sin(x * f) * amp); g.lineTo(W, H); g.fill(); } });
    A.ground = bake(Math.round(W), 130, (g) => { const gr = g.createLinearGradient(0, 0, 0, 130); gr.addColorStop(0, '#4d7c0f'); gr.addColorStop(0.12, '#365314'); gr.addColorStop(0.13, '#44281a'); gr.addColorStop(1, '#1c1109'); g.fillStyle = gr; g.fillRect(0, 0, W, 130); g.fillStyle = '#84cc16'; g.fillRect(0, 0, W, 5); });
    const tile = (w, h, fn) => bake(w * 2, h * 2, (g) => { g.scale(2, 2); fn(g, w, h); });
    A.wood = tile(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#c88a3d'); gr.addColorStop(1, '#8a5a22'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,30,5,.35)'; g.lineWidth = 1.5; for (let y = 8; y < h; y += 10) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * .3, y - 3, w * .6, y + 3, w, y); g.stroke(); } g.strokeStyle = '#5b3410'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 3); });
    A.glass = tile(64, 64, (g, w, h) => { g.fillStyle = 'rgba(147,220,255,.55)'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(224,247,255,.95)'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, w - 3, h - 3); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(w * .15, h * .8); g.lineTo(w * .55, h * .15); g.stroke(); });
    A.stone = tile(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#b7b0a8'); gr.addColorStop(1, '#6b6560'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(0,0,0,.12)'; for (let i = 0; i < 18; i++) g.fillRect((i * 37) % w, (i * 53) % h, 8, 5); g.strokeStyle = '#4b4641'; g.lineWidth = 3; g.strokeRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, w, 3); });
    A.bot = tile(40, 40, (g) => { g.fillStyle = '#7dd3a0'; roundRect(g, 4, 6, 32, 30, 9); g.fill(); g.strokeStyle = '#14532d'; g.lineWidth = 2.5; g.stroke(); g.fillStyle = '#052e16'; g.fillRect(9, 12, 22, 12); g.fillStyle = '#fde047'; g.beginPath(); g.arc(15, 18, 4, 0, TAU); g.arc(25, 18, 4, 0, TAU); g.fill(); g.fillStyle = '#052e16'; g.beginPath(); g.arc(15.5, 18, 1.8, 0, TAU); g.arc(25.5, 18, 1.8, 0, TAU); g.fill(); g.fillStyle = '#14532d'; g.fillRect(12, 28, 16, 3); g.strokeStyle = '#14532d'; g.beginPath(); g.moveTo(20, 6); g.lineTo(20, 1); g.stroke(); g.fillStyle = '#ef4444'; g.beginPath(); g.arc(20, 1.5, 2, 0, TAU); g.fill(); });
    A.ball = tile(30, 30, (g) => { const gr = g.createRadialGradient(10, 9, 2, 15, 15, 15); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#cbd5e1'); gr.addColorStop(1, '#475569'); g.fillStyle = gr; g.beginPath(); g.arc(15, 15, 14, 0, TAU); g.fill(); g.strokeStyle = '#1e293b'; g.lineWidth = 1.5; g.stroke(); });
    return A;
  }
  render(ctx) {
    const A = this.art(), W = this.W, H = this.H, g = this.ground, t = this.t; ctx.drawImage(A.bg, 0, 0, W, H); ctx.drawImage(A.ground, 0, g);
    // sling
    const sx = this.sx, sy = this.sy; ctx.strokeStyle = '#7c4a1d'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, g); ctx.lineTo(sx, sy + 34); ctx.moveTo(sx, sy + 34); ctx.lineTo(sx - 20, sy - 6); ctx.moveTo(sx, sy + 34); ctx.lineTo(sx + 20, sy - 6); ctx.stroke();
    if (this.aim) { const [dx, dy] = this.pull(), px = sx + dx, py = sy + dy; ctx.strokeStyle = '#fde68a'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(sx - 20, sy - 6); ctx.lineTo(px, py); ctx.lineTo(sx + 20, sy - 6); ctx.stroke(); ctx.drawImage(A.ball, px - 14, py - 14, 28, 28);
      let x = sx - dx * 0.6, y = sy - dy * 0.6, vx = -dx * 8.4, vy = -dy * 8.4; ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 26; i++) { for (let k = 0; k < 3; k++) { vy += G * 0.012; vx += this.wind * 2.2 * 0.012; x += vx * 0.012; y += vy * 0.012; } if (y > g) break; ctx.globalAlpha = 1 - i / 28; ctx.beginPath(); ctx.arc(x, y, 3 - i * 0.05, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
    else if (!this.ball && this.balls > 0) ctx.drawImage(A.ball, sx - 14, sy - 14, 28, 28);
    ctx.strokeStyle = '#a05a24'; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(sx, sy + 34); ctx.lineTo(sx + 20, sy - 6); ctx.stroke();
    for (const b of this.blocks) { const tex = b.bot ? A.bot : A[b.m]; ctx.drawImage(tex, b.x, b.y, b.w, b.h); if (b.dmg > 0.35 * (b.bot ? 0.8 : MAT[b.m].hp)) { ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(b.x + b.w * .2, b.y + 2); ctx.lineTo(b.x + b.w * .5, b.y + b.h * .5); ctx.lineTo(b.x + b.w * .35, b.y + b.h - 2); ctx.stroke(); } if (b.bot) halo(ctx, '#a3e635', b.x + b.w / 2, b.y + b.h / 2, 30, 0.22 + 0.1 * Math.sin(t * 5 + b.ph)); }
    for (let i = 0; i < this.trail.length; i++) { halo(ctx, '#fde68a', this.trail[i][0], this.trail[i][1], 6 + i * 0.6, i / this.trail.length * 0.6); }
    if (this.ball) ctx.drawImage(A.ball, this.ball.x - this.ball.r, this.ball.y - this.ball.r, this.ball.r * 2, this.ball.r * 2);
    this.hud(ctx, { best: this.best, chip: 'T' + this.tower, chipColor: 'rgba(251,146,60,.5)' });
    for (let i = 0; i < Math.min(9, this.balls); i++) ctx.drawImage(A.ball, 14 + i * 22, 66, 18, 18); if (this.wind) this.text(ctx, `WIND ${this.wind > 0 ? '→' : '←'} ${Math.abs(this.wind)}`, W - 16, 80, { size: 12, color: '#bae6fd', align: 'right', glow: '#0369a1' });
    if (this.state === 'play' && this.tower === 1 && this.used === 0 && !this.aim) this.text(ctx, 'DRAG BACK, THEN RELEASE', sx + 24, sy - 70, { size: 13, color: '#fde68a' });
  }
}

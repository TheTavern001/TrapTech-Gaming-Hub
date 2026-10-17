// Haze Defense v8 - fully rebuilt endless tower defense (original code, original baked vector art; procedural WebAudio).
// New in v8: a serpentine glow-tube track, four turret classes with 3 upgrade levels (dart / fan / prism laser / frost), layered smoke orbs
// (gold orbs split, dark orbs are armored and only lasers melt them), an active PULSE ability on a cooldown, hold-to-sell, chained cash.
// Scoring contract unchanged (src/ac-levels.js): 'w' wave marker, 'o' = 1+floor(wave/10) per popped layer, 'c' = 50*wave clear bonus.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, halo, bake, roundRect } from './kit.js';
const ORB = [null, { c: '#f1f5f9', sp: 70 }, { c: '#c084fc', sp: 80 }, { c: '#4ade80', sp: 92 }, { c: '#fbbf24', sp: 104, split: true }, { c: '#64748b', sp: 60, armor: true }];
const TUR = { dart: { n: 'Dart Coil', cost: 100, range: 135, rate: 0.42, dmg: 1, col: '#22d3ee' }, fan: { n: 'Fan Blaster', cost: 160, range: 100, rate: 1.2, dmg: 1, multi: 5, col: '#f472b6' }, laser: { n: 'Prism Laser', cost: 240, range: 150, rate: 0.1, dmg: 0.18, col: '#a78bfa', melt: true }, frost: { n: 'Frost Mister', cost: 140, range: 110, rate: 1.4, dmg: 0, col: '#bae6fd', slow: true } };
const KEYS = Object.keys(TUR);
export class HazeDefense extends Game8 {
  get title() { return 'HAZE DEFENSE'; }
  get hint() { return 'Pick a turret at the bottom, then tap an empty pad to build it. Tap a built turret to upgrade it (3 levels). Pop the smoke orbs before they reach the exit: gold orbs split, dark orbs are armored and only the Prism Laser melts them. Use PULSE when a wave leaks. 20 lives, endless waves.'; }
  get accent() { return '#c084fc'; }
  get musicOpts() { return { root: 53, bpm: 98, mode: 'minor', seed: 44, vol: 0.26 }; }
  layout() {
    const W = this.W, top = 128, bot = this.H - 170, h = bot - top; this.top = top; this.bot = bot;
    this.path = [[-30, top + h * 0.1], [W * 0.82, top + h * 0.1], [W * 0.82, top + h * 0.37], [W * 0.18, top + h * 0.37], [W * 0.18, top + h * 0.63], [W * 0.82, top + h * 0.63], [W * 0.82, top + h * 0.9], [-30, top + h * 0.9]];
    this.seg = []; let L = 0; for (let i = 1; i < this.path.length; i++) { const a = this.path[i - 1], b = this.path[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); this.seg.push({ a, b, l, s: L }); L += l; } this.len = L;
    const ys = [0.235, 0.5, 0.765].map(f => top + h * f), pads = [[W * 0.3, top + h * 0.0], [W * 0.62, top + h * 0.0], [W * 0.93, top + h * 0.235]];
    ys.forEach((y, i) => { for (const fx of (i % 2 ? [0.32, 0.55, 0.9] : [0.1, 0.4, 0.66])) pads.push([W * fx, y]); }); pads.push([W * 0.07, top + h * 0.5], [W * 0.5, top + h * 1.0 + 6]);
    if (!this.pads || this.pads.length !== pads.length) this.pads = pads.map(([x, y]) => ({ x, y, t: null })); else this.pads.forEach((p, i) => { p.x = pads[i][0]; p.y = pads[i][1]; });
    const cw = (W - 28 - 84) / 4; this.cards = KEYS.map((k, i) => ({ k, x: 10 + i * (cw + 2), y: this.H - 150, w: cw, h: 84 })); this.pbtn = { x: W - 82, y: this.H - 150, w: 72, h: 84 }; this.bgc = null;
  }
  bar() { return this.cards; }
  reset() { super.reset(); this.pads = null; this.layout(); this.score = 0; this.coins = 0; this.cash = 320; this.lives = 20; this.wave = 0; this.orbs = []; this.queue = []; this.spawnT = 0; this.between = 2.2; this.sel = null; this.beams = []; this.shots = []; this.pulse = 0; this.pulseCd = 12; this.waveSpawned = true; this.waveClearPaid = true; this.sellT = 0; this.selPad = null; }
  at(d) { d = clamp(d, 0, this.len - 0.01); for (const s of this.seg) if (d <= s.s + s.l) { const t = (d - s.s) / s.l; return [s.a[0] + (s.b[0] - s.a[0]) * t, s.a[1] + (s.b[1] - s.a[1]) * t]; } return this.path[this.path.length - 1]; }
  startWave() {
    this.wave++; this.mark('w', this.wave); const w = this.wave, n = 8 + Math.floor(w * 1.6); this.queue = [];
    for (let i = 0; i < n; i++) { const r = this.r(); let lv = 1; const p = Math.min(0.85, w / 25); if (r < p * 0.18 && w >= 8) lv = 5; else if (r < p * 0.4 && w >= 5) lv = 4; else if (r < 0.15 + p && w >= 3) lv = 3; else if (r < 0.35 + p && w >= 2) lv = 2; this.queue.push(lv); }
    this.spawnT = 0.5; this.waveSpawned = false; this.waveClearPaid = false; this.pop(this.W / 2, this.top + 30, 'WAVE ' + w, '#e9d5ff', 26); this.sfx.chord([330, 494], 0.2, { type: 'triangle', vol: 0.2 });
  }
  onDown(x, y) {
    this.sellT = 0; const c = this.cards.find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); if (c) { this.sel = this.sel === c.k ? null : c.k; this.sfx.click(); return; }
    const pb = this.pbtn; if (x >= pb.x && x <= pb.x + pb.w && y >= pb.y && y <= pb.y + pb.h) { this.usePulse(); return; }
    const p = this.pads.find(p => Math.hypot(p.x - x, p.y - y) < 36); if (!p) return;
    if (p.t) { this.selPad = p; const cost = Math.round(TUR[p.t.k].cost * 0.8 * p.t.lv); if (p.t.lv >= 3) { this.pop(p.x, p.y - 34, 'MAX LEVEL', '#c4b5fd', 14); return; } if (this.cash < cost) { this.pop(p.x, p.y - 34, `Upgrade $${cost}`, '#f87171', 14); return; } this.cash -= cost; p.t.lv++; this.pop(p.x, p.y - 34, `LEVEL ${p.t.lv}`, '#a7f3d0', 16); this.fx.ring(p.x, p.y, TUR[p.t.k].col, 8, 60, 0.4, 4); this.sfx.chord([660, 990], 0.1, { type: 'triangle', vol: 0.2 }); return; }
    if (!this.sel) { this.pop(p.x, p.y - 30, 'Pick a turret first', '#94a3b8', 13); return; } const T = TUR[this.sel]; if (this.cash < T.cost) { this.pop(p.x, p.y - 30, 'Need more cash', '#f87171', 14); this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return; }
    this.cash -= T.cost; p.t = { k: this.sel, lv: 1, cd: 0, ang: -Math.PI / 2 }; this.sfx.tone(520, 0.08, { type: 'triangle', vol: 0.25 }); this.fx.burst(p.x, p.y, [T.col, '#fff'], 10, 160, 0.4, 8); this.fx.ring(p.x, p.y, T.col, 6, 50, 0.35, 3);
  }
  usePulse() { if (this.pulseCd > 0 || this.state !== 'play') return; this.pulseCd = 28; this.pulse = 0.5; this.fx.flash('#c084fc', 0.25); this.fx.shake(6); this.sfx.noise(0.3, { vol: 0.3, freq: 300 }); for (const o of this.orbs.slice()) { this.pop1(o, 1, true); } }
  pop1(o, dmg, free) {
    if (o.dead) return; o.hp -= dmg * (ORB[o.lv].armor && !o.melt && !free ? 0.35 : 1); o.melt = false;
    while (o.hp <= 0 && !o.dead) { this.award(1 + Math.floor(this.wave / 10), 'o'); this.cash += 1; const [x, y] = this.at(o.d); this.fx.burst(x, y, [ORB[o.lv].c, '#fff'], 5, 150, 0.4, 7);
      if (o.lv === 1) { o.dead = true; if (this.r() < 0.3) this.sfx.tone(rnd(500, 900), 0.04, { type: 'sine', vol: 0.1 }); break; }
      if (ORB[o.lv].split) { o.lv = 2; o.hp = 1; this.orbs.push({ lv: 2, hp: 1, d: Math.max(0, o.d - 14), slow: 0, melt: false, dead: false, ph: this.r() * TAU }); } else { o.lv--; o.hp = 1; } } }
  update(dt) {
    if (this.pulse > 0) this.pulse -= dt; if (this.pulseCd > 0) this.pulseCd -= dt;
    if (this.between > 0) { this.between -= dt; if (this.between <= 0) this.startWave(); }
    else { this.spawnT -= dt; if (this.queue.length && this.spawnT <= 0) { const lv = this.queue.shift(); this.orbs.push({ lv, hp: 1, d: 0, slow: 0, melt: false, dead: false, ph: this.r() * TAU }); this.spawnT = Math.max(0.28, 0.85 - this.wave * 0.02); } if (!this.queue.length) this.waveSpawned = true;
      if (this.waveSpawned && !this.orbs.length && !this.waveClearPaid) { this.waveClearPaid = true; const b = this.award(50 * this.wave, 'c'); this.cash += 40 + this.wave * 4; this.pop(this.W / 2, this.top + 30, `WAVE CLEAR +${b}`, '#fde047', 20); this.fx.flash('#fde047', 0.1); this.between = 3.2; this.setLevel(Math.min(1, this.wave / 20)); } }
    for (const o of this.orbs) { o.slow = Math.max(0, o.slow - dt); o.d += ORB[o.lv].sp * (1 + this.wave * 0.012) * (o.slow > 0 ? 0.45 : 1) * dt; }
    for (const o of this.orbs) if (o.d >= this.len) { o.dead = true; this.lives -= o.lv; this.fx.shake(6); this.fx.flash('#ef4444', 0.15); this.sfx.tone(160, 0.2, { type: 'sawtooth', vol: 0.18, slide: 0.5 }); this.pop(24, this.path[this.path.length - 1][1] - 20, '-' + o.lv, '#f87171', 16); }
    if (this.lives <= 0) { this.lives = 0; this.kill(0.9, '#c084fc'); return; }
    for (const p of this.pads) { const t = p.t; if (!t) continue; const T = TUR[t.k], rng = T.range * (1 + (t.lv - 1) * 0.12); t.cd -= dt; let tg = null, bd = -1;
      for (const o of this.orbs) { if (o.dead) continue; const [x, y] = this.at(o.d); const dd = Math.hypot(x - p.x, y - p.y); if (dd <= rng && o.d > bd) { bd = o.d; tg = o; } }
      if (!tg) continue; const [tx, ty] = this.at(tg.d); t.ang = Math.atan2(ty - p.y, tx - p.x);
      if (t.k === 'laser') { tg.melt = true; this.pop1(tg, 1.6 * t.lv * dt, false); this.beams.push({ x1: p.x, y1: p.y, x2: tx, y2: ty, c: T.col, t: 0.06 }); continue; }
      if (t.cd > 0) continue; t.cd = T.rate / (1 + (t.lv - 1) * 0.18);
      if (t.k === 'dart') { this.shots.push({ x: p.x, y: p.y, o: tg, t: 1, dmg: T.dmg * t.lv, c: T.col }); this.sfx.tone(900, 0.03, { type: 'square', vol: 0.05 }); }
      else if (t.k === 'fan') { let n = 0; for (const o of this.orbs) { if (o.dead || n >= T.multi + t.lv) continue; const [x, y] = this.at(o.d); if (Math.hypot(x - p.x, y - p.y) <= rng) { this.pop1(o, 1, false); o.d = Math.max(0, o.d - 12); n++; } } this.beams.push({ ring: [p.x, p.y, rng], c: T.col, t: 0.25 }); this.sfx.noise(0.05, { vol: 0.08, freq: 1500 }); }
      else if (t.k === 'frost') { for (const o of this.orbs) { const [x, y] = this.at(o.d); if (Math.hypot(x - p.x, y - p.y) <= rng) o.slow = 1.6 + 0.4 * t.lv; } this.beams.push({ ring: [p.x, p.y, rng], c: T.col, t: 0.45 }); }
    }
    for (const s of this.shots) { if (!s.o || s.o.dead) { s.t = 0; continue; } const [tx, ty] = this.at(s.o.d), dx = tx - s.x, dy = ty - s.y, d = Math.hypot(dx, dy) || 1, sp = 520 * dt; if (d < sp + 8) { this.pop1(s.o, s.dmg, false); this.fx.sparks(tx, ty, [s.c, '#fff'], 3, 200, 0.2, 8); s.t = 0; } else { s.x += dx / d * sp; s.y += dy / d * sp; } }
    for (const b of this.beams) b.t -= dt; this.beams = this.beams.filter(b => b.t > 0); this.shots = this.shots.filter(s => s.t > 0); this.orbs = this.orbs.filter(o => !o.dead);
  }
  art() {
    if (this.A) return this.A; const A = this.A = { o: [] }, W = this.W, H = this.H;
    A.bg = bake(Math.round(W / 2), Math.round(H / 2), (g) => { g.scale(0.5, 0.5); const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0a0828'); gr.addColorStop(1, '#14103c'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(129,140,248,.08)'; g.lineWidth = 1; for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      const tr = () => { g.beginPath(); this.path.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); }; g.lineCap = 'round'; g.lineJoin = 'round'; tr(); g.strokeStyle = 'rgba(34,211,238,.18)'; g.lineWidth = 56; g.stroke(); tr(); g.strokeStyle = '#161a44'; g.lineWidth = 44; g.stroke(); tr(); g.strokeStyle = 'rgba(103,232,249,.5)'; g.lineWidth = 2; g.setLineDash([10, 14]); g.stroke(); g.setLineDash([]);
      const e = this.path[this.path.length - 1]; g.fillStyle = 'rgba(239,68,68,.25)'; g.fillRect(0, e[1] - 26, 26, 52); g.fillStyle = '#ef4444'; g.fillRect(0, e[1] - 26, 4, 52); g.fillStyle = 'rgba(34,211,238,.25)'; g.fillRect(this.path[0][0] + 30, this.path[0][1] - 26, 8, 52); });
    A.pad = bake(88, 88, (g) => { g.translate(44, 44); g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(Math.cos(a) * 32, Math.sin(a) * 32); } g.closePath(); g.fillStyle = 'rgba(30,27,75,.85)'; g.fill(); g.strokeStyle = 'rgba(167,139,250,.65)'; g.lineWidth = 3; g.stroke(); g.fillStyle = 'rgba(167,139,250,.14)'; g.beginPath(); g.arc(0, 0, 18, 0, TAU); g.fill(); });
    for (let l = 1; l <= 5; l++) A.o[l] = bake(72, 72, (g) => { const c = ORB[l].c; g.translate(36, 36); const gr = g.createRadialGradient(-6, -8, 2, 0, 0, 24); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, c); gr.addColorStop(1, c + '55'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill(); g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 2; g.stroke(); if (ORB[l].armor) { g.strokeStyle = '#cbd5e1'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke(); } g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(-8, -10, 7, 4, -0.6, 0, TAU); g.fill(); });
    A.head = {}; for (const k of KEYS) A.head[k] = bake(80, 80, (g) => { g.translate(40, 40); const c = TUR[k].col; g.fillStyle = '#e2e8f0'; if (k === 'dart') { roundRect(g, -6, -9, 36, 18, 6); g.fill(); g.fillStyle = c; g.fillRect(24, -4, 10, 8); } else if (k === 'fan') { for (let i = -2; i <= 2; i++) { g.save(); g.rotate(i * 0.32); roundRect(g, 4, -4, 28, 8, 4); g.fill(); g.restore(); } } else if (k === 'laser') { g.beginPath(); g.moveTo(-12, -14); g.lineTo(26, 0); g.lineTo(-12, 14); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.arc(8, 0, 6, 0, TAU); g.fill(); } else { g.beginPath(); g.arc(0, 0, 15, 0, TAU); g.fill(); g.fillStyle = c; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(Math.cos(i * 2.09) * 7, Math.sin(i * 2.09) * 7, 5, 0, TAU); g.fill(); } } g.strokeStyle = c; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.stroke(); });
    return A;
  }
  render(ctx) {
    const A = this.art(), W = this.W, H = this.H, t = this.t; if (!this.bgc) { this.bgc = A.bg; } ctx.drawImage(A.bg, 0, 0, W, H);
    for (const p of this.pads) { ctx.drawImage(A.pad, p.x - 44, p.y - 44); if (this.sel && !p.t) { halo(ctx, TUR[this.sel].col, p.x, p.y, 40, 0.25 + 0.12 * Math.sin(t * 5)); } }
    for (const p of this.pads) { const q = p.t; if (!q) continue; const T = TUR[q.k]; halo(ctx, T.col, p.x, p.y, 34 + q.lv * 4, 0.3); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(q.ang); ctx.drawImage(A.head[q.k], -40, -40); ctx.restore(); for (let i = 0; i < q.lv; i++) { ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(p.x - 8 + i * 8, p.y + 24, 2.6, 0, TAU); ctx.fill(); } }
    if (this.selPad && this.selPad.t && this.state === 'play') { const q = this.selPad.t; ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(this.selPad.x, this.selPad.y, TUR[q.k].range * (1 + (q.lv - 1) * 0.12), 0, TAU); ctx.stroke(); }
    for (const o of this.orbs) { const [x, y] = this.at(o.d), w = 44 + o.lv * 2, b = Math.sin(t * 4 + o.ph) * 1.5; halo(ctx, ORB[o.lv].c, x, y, 30, 0.35); ctx.drawImage(A.o[o.lv], x - w / 2, y - w / 2 + b, w, w); if (o.slow > 0) { ctx.strokeStyle = '#bae6fd'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, w / 2 + 3, 0, TAU); ctx.stroke(); } }
    for (const s of this.shots) halo(ctx, s.c, s.x, s.y, 16, 1);
    for (const b of this.beams) { ctx.globalAlpha = Math.min(1, b.t * 5); if (b.ring) { ctx.strokeStyle = b.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(b.ring[0], b.ring[1], b.ring[2] * (1 - b.t * 1.2 > 0.1 ? Math.min(1, 1.1 - b.t) : 1), 0, TAU); ctx.stroke(); } else { ctx.strokeStyle = b.c; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke(); } ctx.globalAlpha = 1; }
    if (this.pulse > 0) { ctx.strokeStyle = `rgba(192,132,252,${this.pulse * 2})`; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(W / 2, H / 2, (0.5 - this.pulse) * 1400, 0, TAU); ctx.stroke(); }
    // bottom bar
    for (const c of this.cards) { const T = TUR[c.k], on = this.sel === c.k, can = this.cash >= T.cost; ctx.fillStyle = on ? 'rgba(76,29,149,.85)' : 'rgba(18,16,56,.85)'; roundRect(ctx, c.x, c.y, c.w, c.h, 12); ctx.fill(); ctx.strokeStyle = on ? T.col : 'rgba(139,92,246,.4)'; ctx.lineWidth = on ? 2.5 : 1.2; ctx.stroke(); ctx.globalAlpha = can ? 1 : 0.45; ctx.drawImage(A.head[c.k], c.x + c.w / 2 - 26, c.y + 2, 52, 52); this.text(ctx, T.n.split(' ')[0], c.x + c.w / 2, c.y + 62, { size: 10, color: '#e2e8f0', align: 'center', font: 'Exo' }); this.text(ctx, '$' + T.cost, c.x + c.w / 2, c.y + 78, { size: 12, color: can ? '#fde047' : '#94a3b8', align: 'center' }); ctx.globalAlpha = 1; }
    const pb = this.pbtn, rdy = this.pulseCd <= 0; ctx.fillStyle = rdy ? 'rgba(126,34,206,.8)' : 'rgba(18,16,56,.85)'; roundRect(ctx, pb.x, pb.y, pb.w, pb.h, 12); ctx.fill(); ctx.strokeStyle = rdy ? '#e9d5ff' : 'rgba(139,92,246,.4)'; ctx.lineWidth = 2; ctx.stroke(); if (rdy) halo(ctx, '#c084fc', pb.x + pb.w / 2, pb.y + pb.h / 2, 50, 0.3 + 0.15 * Math.sin(t * 6)); this.text(ctx, 'PULSE', pb.x + pb.w / 2, pb.y + 38, { size: 14, color: '#fff', align: 'center' }); this.text(ctx, rdy ? 'READY' : Math.ceil(this.pulseCd) + 's', pb.x + pb.w / 2, pb.y + 60, { size: 11, color: rdy ? '#fde047' : '#94a3b8', align: 'center' });
    this.hud(ctx, { best: this.best, lives: Math.min(5, Math.ceil(this.lives / 4)), maxLives: 5, chip: 'W' + this.wave, chipColor: 'rgba(192,132,252,.5)' }); this.text(ctx, `$${fmt(this.cash)}   ·   LIVES ${this.lives}`, W / 2, 82, { size: 13, color: '#67e8f9', align: 'center', glow: '#0891b2' });
    if (this.sel) this.text(ctx, `${TUR[this.sel].n}: tap an empty pad`, W / 2, 110, { size: 12, color: '#a5f3fc', align: 'center', font: 'Exo' });
  }
}

// Haze Defense - original endless tower-defense game (v7). Volumetric smoke orbs drift along a glowing track; build turrets on
// the pads to pop them layer by layer before they slip through. Art: Blender Cycles renders (original models): Dart Coil, Fan
// Blaster, Prism Laser and Frost Mister turrets on lit pads, and true volumetric smoke orbs (Cycles volume shader, 5 colours).
import { Game, TAU, rnd, clamp, lerp, fmt, roundRect, loadAtlas, sprC, softShadow } from './engine.js';
const ORB = [null, { spr: 'orb_white', sp: 70, col: '#f1f5f9' }, { spr: 'orb_violet', sp: 80, col: '#c084fc' }, { spr: 'orb_green', sp: 92, col: '#4ade80' }, { spr: 'orb_gold', sp: 104, col: '#fbbf24', split: true }, { spr: 'orb_dark', sp: 60, col: '#64748b', split: true, armor: true }];
const TUR = {
  dart: { name: 'Dart Coil', cost: 100, spr: 'dart', range: 125, rate: 0.45, dmg: 1 },
  fan: { name: 'Fan Blaster', cost: 160, spr: 'fan', range: 95, rate: 1.3, dmg: 1, multi: 5 },
  prism: { name: 'Prism Laser', cost: 260, spr: 'prism', range: 165, rate: 0.12, dmg: 0.5, pierce: true },
  frost: { name: 'Frost Mister', cost: 120, spr: 'frost', range: 105, rate: 1.6, dmg: 0, slow: true },
};
export class HazeDefense extends Game {
  get title() { return 'HAZE DEFENSE'; }
  get hint() { return 'Tap a turret at the bottom, then tap an empty pad to build it. Tap a built turret to upgrade it. Pop the smoke orbs before they reach the exit: big orbs split, dark orbs are armored (lasers melt them). You have 20 lives, and the waves never stop.'; }
  async load() { this.Z = await loadAtlas('/assets/v7/haze'); }
  layout() {
    const W = this.W, top = 130, bot = this.H - 140, h = bot - top;
    this.path = [[-30, top + h * 0.12], [W * 0.78, top + h * 0.12], [W * 0.78, top + h * 0.38], [W * 0.22, top + h * 0.38], [W * 0.22, top + h * 0.64], [W * 0.78, top + h * 0.64], [W * 0.78, top + h * 0.9], [-30, top + h * 0.9]];
    this.seg = []; let L = 0; for (let i = 1; i < this.path.length; i++) { const a = this.path[i - 1], b = this.path[i]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); this.seg.push({ a, b, l, s: L }); L += l; } this.len = L;
    const ys = [0.25, 0.51, 0.77].map(f => top + h * f), y0 = top + h * 0.02, y1 = top + h * 0.995;
    const pads = [[W * 0.3, y0 + 4], [W * 0.55, y0 + 4], [W * 0.92, top + h * 0.25]]; for (const [i, y] of ys.entries()) for (const fx of (i % 2 ? [0.38, 0.62, 0.9] : [0.1, 0.38, 0.62])) pads.push([W * fx, y]); pads.push([W * 0.08, top + h * 0.51], [W * 0.45, y1 - 6]);
    if (!this.pads || this.pads.length !== pads.length) this.pads = pads.map(([x, y]) => ({ x, y, t: null })); else this.pads.forEach((p, i) => { p.x = pads[i][0]; p.y = pads[i][1]; });
  }
  reset() { this.pads = null; this.layout(); this.score = 0; this.coins = 0; this.cash = 300; this.lives = 20; this.wave = 0; this.orbs = []; this.queue = []; this.spawnT = 0; this.between = 2.5; this.sel = null; this.fx = []; this.over = 0; this.beams = []; }
  at(d) { for (const s of this.seg) if (d <= s.s + s.l) { const k = (d - s.s) / s.l; return [lerp(s.a[0], s.b[0], k), lerp(s.a[1], s.b[1], k)]; } return this.path[this.path.length - 1]; }
  startWave() { this.wave++; const w = this.wave; this.mark('w', w); const n = 8 + Math.floor(w * 2.2); this.queue = [];
    for (let i = 0; i < n; i++) { let lv = 1 + Math.floor(this.r() * Math.min(4, 1 + w / 3)); if (w >= 6 && this.r() < Math.min(0.3, (w - 5) * 0.03)) lv = 5; this.queue.push(lv); }
    this.gap = Math.max(0.28, 1.1 - w * 0.04); this.pop(this.W / 2, this.H * 0.45, `WAVE ${w}`, '#c084fc', 30); }
  bar() { const ks = Object.keys(TUR); const w = (this.W - 24 - 6 * (ks.length - 1)) / ks.length; return ks.map((k, i) => ({ k, x: 12 + i * (w + 6), y: this.H - 122, w, h: 110 })); }
  onDown(x, y) {
    const c = this.bar().find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); if (c) { this.sel = this.sel === c.k ? null : c.k; this.sfx.click(); return; }
    const p = this.pads.find(p => Math.hypot(p.x - x, p.y - y) < 34); if (!p) return;
    if (p.t) { const cost = Math.round(TUR[p.t.k].cost * 0.8 * p.t.lv); if (p.t.lv >= 3) { this.pop(p.x, p.y - 30, 'MAX LEVEL', '#c4b5fd', 14); return; } if (this.cash < cost) { this.pop(p.x, p.y - 30, `Upgrade ${cost}`, '#f87171', 14); return; } this.cash -= cost; p.t.lv++; this.pop(p.x, p.y - 30, `LEVEL ${p.t.lv}`, '#a7f3d0', 16); this.sfx.chord([660, 990], 0.1, { type: 'triangle', vol: 0.2 }); return; }
    if (!this.sel) return; const T = TUR[this.sel]; if (this.cash < T.cost) { this.pop(p.x, p.y - 30, 'Need more cash', '#f87171', 14); this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return; }
    this.cash -= T.cost; p.t = { k: this.sel, lv: 1, cd: 0, ang: 0 }; this.sfx.tone(520, 0.08, { type: 'triangle', vol: 0.25 }); this.burst(p.x, p.y, ['#67e8f9', '#fff'], 10, 120, 0.4, 3);
  }
  popLayer(o, dmg) {
    if (o.dead) return; o.hp -= dmg * (ORB[o.lv].armor && !o.melt ? 0.35 : 1); o.melt = false;
    while (o.hp <= 0 && !o.dead) { const tier = this.award(1 + Math.floor(this.wave / 10), 'o'); this.cash += 1; const [x, y] = this.at(o.d); this.burst(x, y, [ORB[o.lv].col, '#ffffff'], 6, 120, 0.4, 3); this.fx.push({ x, y, t: 0.35, c: ORB[o.lv].col });
      if (o.lv === 1) { o.dead = true; if (Math.random() < 0.3) this.sfx.tone(rnd(500, 900), 0.04, { type: 'sine', vol: 0.12 }); break; }
      const split = ORB[o.lv].split; o.lv--; o.hp += 1; if (split) this.orbs.push({ lv: o.lv, d: Math.max(0, o.d - 18), hp: 1, slow: 0 }); }
  }
  update(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.finish(); return; }
    if (!this.queue.length && !this.orbs.length) { this.between -= dt; if (this.between <= 0) { if (this.wave > 0) { const b = this.award(50 * this.wave, 'c'); this.cash += 60 + 10 * this.wave; this.pop(this.W / 2, this.H * 0.4, `WAVE ${this.wave} CLEARED  +${fmt(b)}`, '#34d399', 22); if (this.wave % 5 === 0) this.coins++; } this.startWave(); this.between = 3; } }
    if (this.queue.length) { this.spawnT -= dt; if (this.spawnT <= 0) { this.orbs.push({ lv: this.queue.shift(), d: 0, hp: 1, slow: 0 }); this.spawnT = this.gap; } }
    const spdMul = 1 + Math.min(0.8, this.wave * 0.02);
    for (const o of this.orbs) { if (o.slow > 0) o.slow -= dt; o.d += ORB[o.lv].sp * spdMul * (o.slow > 0 ? 0.55 : 1) * dt; if (o.d >= this.len) { o.dead = true; o.leak = true; this.lives -= o.lv; this.sfx.noise(0.15, { vol: 0.2, freq: 400 }); this.pop(40, this.path[this.path.length - 1][1] - 20, `-${o.lv}`, '#f87171', 18); } }
    if (this.lives <= 0) { this.lives = 0; this.over = 1.5; this.sfx.lose(); return; }
    this.beams = [];
    for (const p of this.pads) { const t = p.t; if (!t) continue; const T = TUR[t.k]; const rng = T.range * (1 + 0.15 * (t.lv - 1)); t.cd -= dt;
      const inR = this.orbs.filter(o => !o.dead && Math.hypot(...((q) => [q[0] - p.x, q[1] - p.y])(this.at(o.d))) < rng).sort((a, b) => b.d - a.d);
      if (inR.length) { const q = this.at(inR[0].d); t.ang = Math.atan2(q[1] - p.y, q[0] - p.x); }
      if (t.cd > 0 || !inR.length) continue; t.cd = T.rate / (1 + 0.25 * (t.lv - 1));
      if (t.k === 'dart') { this.popLayer(inR[0], T.dmg * t.lv); const q = this.at(inR[0].d); this.fx.push({ line: [p.x, p.y, q[0], q[1]], t: 0.08, c: '#fde68a' }); }
      if (t.k === 'fan') { for (const o of inR.slice(0, T.multi + t.lv)) { this.popLayer(o, 1); o.d = Math.max(0, o.d - 14); } this.fx.push({ ring: [p.x, p.y, rng], t: 0.3, c: '#7dd3fc' }); this.sfx.noise(0.1, { vol: 0.08, freq: 1500 }); }
      if (t.k === 'prism') { const o = inR[0]; o.melt = true; this.popLayer(o, T.dmg * (1 + 0.5 * (t.lv - 1))); const q = this.at(o.d); this.beams.push([p.x, p.y - 16, q[0], q[1]]); }
      if (t.k === 'frost') { for (const o of inR) o.slow = 1.6 + 0.4 * t.lv; this.fx.push({ ring: [p.x, p.y, rng], t: 0.5, c: '#a5f3fc' }); if (t.lv >= 2) for (const o of inR.slice(0, 2)) this.popLayer(o, 1); }
    }
    this.orbs = this.orbs.filter(o => !o.dead); for (const f of this.fx) f.t -= dt; this.fx = this.fx.filter(f => f.t > 0);
  }
  floor() { if (this._fl && this._fl.width === Math.ceil(this.W)) return this._fl; const c = document.createElement('canvas'); c.width = Math.ceil(this.W); c.height = Math.ceil(this.H); const g = c.getContext('2d');
    const bg = g.createLinearGradient(0, 0, 0, c.height); bg.addColorStop(0, '#0b0d17'); bg.addColorStop(1, '#05060c'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.035})`; g.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2); }
    g.strokeStyle = 'rgba(148,163,184,0.06)'; for (let x = 0; x < c.width; x += 54) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, c.height); g.stroke(); } for (let y = 0; y < c.height; y += 54) { g.beginPath(); g.moveTo(0, y); g.lineTo(c.width, y); g.stroke(); }
    const P = this.path; const line = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath(); P.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); };
    line(64, 'rgba(0,0,0,0.6)'); line(56, '#141826'); line(46, '#1c2133'); g.setLineDash([14, 12]); line(2, 'rgba(103,232,249,0.35)'); g.setLineDash([]);
    g.globalCompositeOperation = 'lighter'; line(60, 'rgba(103,232,249,0.05)'); line(58, 'rgba(192,132,252,0.04)');
    return (this._fl = c); }
  render(ctx) {
    const W = this.W, H = this.H, Z = this.Z, t = this.t; ctx.drawImage(this.floor(), 0, 0, W, H);
    // track edge glow pulses
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = `rgba(103,232,249,${0.18 + 0.08 * Math.sin(t * 2)})`; ctx.lineWidth = 2; for (const o of [-27, 27]) { ctx.beginPath(); this.path.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); } ctx.restore();
    const ex = this.path[this.path.length - 1]; ctx.fillStyle = 'rgba(248,113,113,0.25)'; ctx.fillRect(0, ex[1] - 30, 18, 60);
    for (const p of this.pads) { if (!p.t) { ctx.save(); ctx.globalAlpha = this.sel ? 0.9 : 0.5; ctx.strokeStyle = '#67e8f9'; ctx.setLineDash([4, 4]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, TAU); ctx.stroke(); ctx.restore(); continue; }
      const T = TUR[p.t.k]; softShadow(ctx, p.x, p.y + 8, 30, 12, 0.6); ctx.save(); ctx.translate(p.x, p.y); if (p.t.k === 'dart' || p.t.k === 'fan') ctx.rotate(p.t.k === 'fan' ? t * 6 * (p.t.cd > 0 ? 1 : 0.3) : p.t.ang + Math.PI / 2); sprC(ctx, Z, T.spr, 0, 0, 62); ctx.restore();
      for (let i = 0; i < p.t.lv; i++) { ctx.fillStyle = '#fde047'; ctx.beginPath(); ctx.arc(p.x - 8 + i * 8, p.y + 28, 2.6, 0, TAU); ctx.fill(); } }
    // orbs: volumetric sprites with an additive halo, a subtle wobble
    for (const o of this.orbs) { const [x, y] = this.at(o.d); const O = ORB[o.lv]; const s = 30 + o.lv * 6; const wob = 1 + Math.sin(t * 5 + o.d * 0.05) * 0.06;
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; ctx.fillStyle = O.col; ctx.beginPath(); ctx.arc(x, y, s * 0.7, 0, TAU); ctx.fill(); ctx.restore();
      ctx.save(); ctx.translate(x, y); ctx.scale(wob, 2 - wob); if (!sprC(ctx, Z, O.spr, 0, 0, s * 1.5)) { ctx.fillStyle = O.col; ctx.beginPath(); ctx.arc(0, 0, s / 2, 0, TAU); ctx.fill(); } ctx.restore();
      if (o.slow > 0) { ctx.strokeStyle = 'rgba(165,243,252,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, s * 0.6, 0, TAU); ctx.stroke(); } }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (const [x0, y0, x1, y1] of this.beams) { ctx.strokeStyle = 'rgba(232,121,249,0.35)'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = '#fdf4ff'; ctx.lineWidth = 2.5; ctx.stroke(); }
    for (const f of this.fx) { ctx.globalAlpha = Math.min(1, f.t * 4); if (f.line) { ctx.strokeStyle = f.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(f.line[0], f.line[1]); ctx.lineTo(f.line[2], f.line[3]); ctx.stroke(); } else if (f.ring) { ctx.strokeStyle = f.c; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(f.ring[0], f.ring[1], f.ring[2] * (1 - f.t), 0, TAU); ctx.stroke(); } else { ctx.fillStyle = f.c; ctx.beginPath(); ctx.arc(f.x, f.y, 26 * (1 - f.t / 0.35) + 6, 0, TAU); ctx.globalAlpha = f.t; ctx.fill(); } } ctx.restore(); ctx.globalAlpha = 1;
    for (const c of this.bar()) { const T = TUR[c.k]; const ok = this.cash >= T.cost, on = this.sel === c.k; roundRect(ctx, c.x, c.y, c.w, c.h, 12); ctx.fillStyle = on ? 'rgba(14,116,144,0.85)' : 'rgba(10,12,24,0.85)'; ctx.fill(); ctx.strokeStyle = on ? '#67e8f9' : ok ? 'rgba(103,232,249,0.4)' : 'rgba(100,116,139,0.35)'; ctx.lineWidth = on ? 3 : 1.5; ctx.stroke();
      ctx.save(); ctx.globalAlpha = ok ? 1 : 0.4; sprC(ctx, Z, T.spr, c.x + c.w / 2, c.y + 42, Math.min(64, c.w * 0.7)); ctx.restore(); this.text(ctx, T.name, c.x + c.w / 2, c.y + c.h - 24, { size: 10, weight: 700, align: 'center', color: '#e2e8f0', font: 'Exo' }); this.text(ctx, `$${T.cost}`, c.x + c.w / 2, c.y + c.h - 8, { size: 13, weight: 900, align: 'center', color: ok ? '#67e8f9' : '#64748b' }); }
    this.hudScore(ctx);
    this.text(ctx, 'CASH', W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' }); this.text(ctx, `$${fmt(this.cash)}`, W - 18, 62, { size: 26, weight: 900, align: 'right', color: '#67e8f9', glow: '#0891b2' });
    this.text(ctx, `WAVE ${this.wave}  •  LIVES ${this.lives}`, W - 18, 82, { size: 12, weight: 800, align: 'right', color: '#f0abfc', font: 'Exo' });
    if (this.sel) this.text(ctx, `${TUR[this.sel].name}: tap an empty pad`, W / 2, 112, { size: 13, weight: 700, align: 'center', color: '#a5f3fc', font: 'Exo' });
  }
}

// Grow Guard - original endless lane-defense game (v7). Pests crawl in from the right along 5 rows of soil beds; place
// bug-fighting gadgets to protect the plants on the left. Art: Blender Cycles renders (original models, PBR, HDRI): aphid, mite,
// gnat, caterpillar, beetle, Ladybug Launcher, Sticky Trap, Neem Mister, UV Zapper, Solar Panel and a flowering plant.
import { loadAtlas, loadArt, sprC, softShadow } from './engine.js';
import { Game8, TAU, rnd, clamp, lerp, roundRect, fmt } from './kit.js';
const ROWS = 5, COLS = 7;
const GADGETS = {
  launcher: { name: 'Ladybug', cost: 100, hp: 6, spr: 'launcher', tip: 'Shoots ladybugs down the row' },
  trap: { name: 'Sticky Trap', cost: 50, hp: 16, spr: 'trap', tip: 'Blocks pests while they chew' },
  mister: { name: 'Neem Mister', cost: 125, hp: 6, spr: 'mister', tip: 'Slows and harms the whole row' },
  zapper: { name: 'UV Zapper', cost: 175, hp: 6, spr: 'zapper', tip: 'Big zaps on the lead pest' },
  solar: { name: 'Solar Panel', cost: 50, hp: 5, spr: 'solar', tip: 'Makes extra light' },
};
const PESTS = { aphid: { hp: 3, sp: 20, pts: 10, size: 46 }, mite: { hp: 4, sp: 26, pts: 15, size: 44 }, gnat: { hp: 2, sp: 42, pts: 20, size: 46, fly: true }, caterpillar: { hp: 9, sp: 15, pts: 30, size: 62 }, beetle: { hp: 20, sp: 12, pts: 60, size: 58 } };
export class GrowGuard extends Game8 {
  get accent() { return '#84cc16'; }
  get musicOpts() { return { root: 60, bpm: 104, mode: 'major', seed: 55, vol: 0.26 }; }
  burst(x, y, c, n, sp, life, size) { this.fx.burst(x, y, c, Math.ceil(n * 0.8), sp, life, (size || 4) * 2.2); }
  get title() { return 'GROW GUARD'; }
  get hint() { return 'Tap falling light drops to collect light. Tap a gadget card, then tap a tile to place it. Stop the pests before they reach your plants: each pest that gets through costs a plant, and losing all 3 ends the run. The waves never stop.'; }
  async load() { const [G, a] = await Promise.all([loadAtlas('/assets/v7/grow'), loadArt({ bg: '/assets/v7/growroom.webp' })]); this.G = G; this.art = a; }
  layout() { const top = 140, bottom = this.H - 130; this.ch = Math.min(96, (bottom - top) / ROWS); this.cw = (this.W - 70) / COLS; this.gx = 62; this.gy = top + ((bottom - top) - this.ch * ROWS) / 2; this._soil = null; }
  reset() { super.reset();
    this.layout(); this.score = 0; this.coins = 0; this.light = 250; this.swarm = Array(ROWS).fill(true); this.swarms = []; this.plants = 3; this.wave = 0; this.tiles = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.pests = []; this.shots = []; this.drops = []; this.sel = null; this.queue = []; this.spawnT = 0; this.dropT = 3; this.between = 3; this.over = 0; this.zaps = [];
  }
  startWave() { this.wave++; const w = this.wave; this.mark('w', w); const n = w <= 3 ? 4 + 2 * w : 6 + 3 * w; const pool = ['aphid', 'aphid', 'mite']; if (w >= 2) pool.push('gnat'); if (w >= 3) pool.push('caterpillar', 'mite'); if (w >= 5) pool.push('beetle'); if (w >= 8) pool.push('beetle', 'caterpillar');
    this.queue = Array.from({ length: n }, () => pool[Math.floor(this.r() * pool.length)]); this.spawnGap = Math.max(0.5, 2.6 - w * 0.12); this.spawnT = 1; this.pop(this.W / 2, this.H * 0.42, `WAVE ${w}`, '#a3e635', 30); this.sfx.tone(330, 0.3, { type: 'triangle', vol: 0.25 }); }
  tileAt(x, y) { const c = Math.floor((x - this.gx) / this.cw), r = Math.floor((y - this.gy) / this.ch); return r >= 0 && r < ROWS && c >= 0 && c < COLS ? [r, c] : null; }
  cards() { const keys = Object.keys(GADGETS); const w = (this.W - 24 - 6 * (keys.length - 1)) / keys.length; return keys.map((k, i) => ({ k, x: 12 + i * (w + 6), y: this.H - 116, w, h: 104 })); }
  onDown(x, y) {
    for (const d of this.drops) if (!d.got && Math.hypot(d.x - x, d.y - y) < 40) { d.got = true; this.light += d.v; this.sfx.tone(1100, 0.08, { type: 'sine', vol: 0.25 }); this.pop(d.x, d.y, `+${d.v}`, '#fde047', 18); return; }
    const c = this.cards().find(c => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h); if (c) { this.sel = this.sel === c.k ? null : c.k; this.sfx.click(); return; }
    const t = this.tileAt(x, y); if (t && this.sel) { const [r, cc] = t; const G = GADGETS[this.sel];
      if (this.tiles[r][cc]) { this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return; }
      if (this.light < G.cost) { this.pop(x, y, 'Need more light', '#f87171', 16); this.sfx.tone(150, 0.08, { type: 'square', vol: 0.08 }); return; }
      this.light -= G.cost; this.tiles[r][cc] = { k: this.sel, hp: G.hp, cd: 0.6, t: 0 }; this.sfx.tone(520, 0.08, { type: 'triangle', vol: 0.25 }); this.burst(this.cx(cc), this.cy(r), ['#a3e635', '#fff'], 10, 120, 0.4, 3); }
  }
  cx(c) { return this.gx + (c + 0.5) * this.cw; } cy(r) { return this.gy + (r + 0.5) * this.ch; }
  update(dt) {
    if (this.over) { this.over -= dt; if (this.over <= 0) this.finish(); return; }
    // waves
    if (!this.queue.length && !this.pests.length) { this.between -= dt; if (this.between <= 0) { if (this.wave > 0) { const b = this.award(100 * this.wave, 'c'); this.pop(this.W / 2, this.H * 0.36, `WAVE ${this.wave} CLEARED  +${fmt(b)}`, '#34d399', 22); this.light += 25; } this.startWave(); this.between = 4; } }
    if (this.queue.length) { this.spawnT -= dt; if (this.spawnT <= 0) { const k = this.queue.shift(); const P = PESTS[k]; const r = Math.floor(this.r() * ROWS); const hpMul = 1 + Math.max(0, this.wave - 6) * 0.12; this.pests.push({ k, r, x: this.W + 30, hp: P.hp * hpMul, max: P.hp * hpMul, slow: 0, eat: null, t: this.r() * 6, hit: 0 }); this.spawnT = this.spawnGap * rnd(0.6, 1.3); } }
    // light from the sky
    this.dropT -= dt; if (this.dropT <= 0) { this.dropT = 7.5; this.drops.push({ x: rnd(this.gx + 20, this.W - 30), y: 110, ty: rnd(this.gy + 20, this.gy + this.ch * ROWS - 20), v: 25, life: 9 }); }
    for (const d of this.drops) { d.y = Math.min(d.ty, d.y + 60 * dt); d.life -= dt; } this.drops = this.drops.filter(d => !d.got && d.life > 0);
    // gadgets
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const g = this.tiles[r][c]; if (!g) continue; g.t += dt; g.cd -= dt; const x = this.cx(c), y = this.cy(r);
      const ahead = this.pests.filter(p => p.r === r && p.x > x - 10 && p.x < this.W + 10).sort((a, b) => a.x - b.x);
      if (g.k === 'launcher' && ahead.length && g.cd <= 0) { g.cd = 1.3; this.shots.push({ x: x + 20, y: y - 6, r, vx: 330 }); this.sfx.tone(700, 0.04, { type: 'square', vol: 0.06 }); }
      if (g.k === 'zapper' && ahead.length && g.cd <= 0) { g.cd = 2; const p = ahead[0]; this.damage(p, 3.5); this.zaps.push({ x0: x, y0: y - 20, x1: p.x, y1: this.cy(p.r), t: 0.15 }); this.sfx.noise(0.08, { vol: 0.15, freq: 4000 }); }
      if (g.k === 'mister') { for (const p of ahead) { p.slow = 0.3; this.damage(p, 0.35 * dt, true); } }
      if (g.k === 'solar' && g.cd <= 0) { g.cd = 10; this.drops.push({ x: x + rnd(-12, 12), y: y - 30, ty: y - 10, v: 25, life: 9 }); }
    }
    for (const s of this.shots) { s.x += s.vx * dt; const p = this.pests.find(p => p.r === s.r && Math.abs(p.x - s.x) < 18 && p.hp > 0); if (p) { s.dead = true; this.damage(p, 1); this.burst(s.x, this.cy(s.r), ['#ef4444', '#111'], 5, 90, 0.25, 3); } }
    this.shots = this.shots.filter(s => !s.dead && s.x < this.W + 20); for (const z of this.zaps) z.t -= dt; this.zaps = this.zaps.filter(z => z.t > 0);
    // pests: walk left, chew on any gadget they bump into
    for (const p of this.pests) { if (p.hp <= 0) continue; p.t += dt; if (p.hit > 0) p.hit -= dt; const P = PESTS[p.k]; const c = Math.floor((p.x - 26 - this.gx) / this.cw); const g = c >= 0 && c < COLS ? this.tiles[p.r][c] : null;
      if (g && !P.fly && p.x - 26 < this.cx(c) + this.cw * 0.4) { g.hp -= (P.hp > 8 ? 1.4 : 0.8) * dt; if (g.hp <= 0) { this.tiles[p.r][c] = null; this.burst(this.cx(c), this.cy(p.r), ['#a8a29e', '#57534e'], 12, 140, 0.5, 3); } }
      else if (g && P.fly && g.k === 'trap' && Math.abs(p.x - this.cx(c)) < 20) { this.damage(p, 99); }
      else p.x -= P.sp * (p.slow > 0 ? 0.5 : 1) * Math.min(1.35, 0.7 + this.wave * 0.05) * dt;
      if (p.slow > 0) p.slow -= dt;
      if (p.x < this.gx - 10 && this.swarm[p.r]) { this.swarm[p.r] = false; this.swarms.push({ r: p.r, x: this.gx - 20 }); this.pop(80, this.cy(p.r), 'LADYBUG SWARM!', '#fca5a5', 18); this.sfx.chord([440, 660, 880], 0.2, { type: 'triangle', vol: 0.25 }); }
      if (p.x < this.gx - 10 && !this.swarms.some(s => s.r === p.r)) { p.hp = 0; p.leak = true; this.plants--; this.sfx.lose(); this.fx.shake(10); this.fx.flash('#ef4444', 0.25); this.burst(36, this.cy(p.r), ['#84cc16', '#fde047'], 18, 200, 0.6, 4); this.pop(60, this.cy(p.r), 'PLANT LOST', '#f87171', 18); if (this.plants <= 0) { this.over = 1.5; } }
    }
    // last-line ladybug swarm (once per row): sweeps the whole row clear
    for (const s of this.swarms) { s.x += 420 * dt; for (const p of this.pests) if (p.r === s.r && p.x < s.x + 20 && p.hp > 0) this.damage(p, 999); }
    this.swarms = this.swarms.filter(s => s.x < this.W + 40);
    this.pests = this.pests.filter(p => p.hp > 0);
  }
  damage(p, d, quiet) { if (p.hp <= 0) return; p.hp -= d; if (!quiet) p.hit = 0.1; if (p.hp <= 0 && !p.leak) { const pts = this.award(PESTS[p.k].pts, 'p'); const y = this.cy(p.r); this.burst(p.x, y, ['#a3e635', '#fef08a', '#57534e'], 10, 150, 0.45, 3); if (pts >= 30) this.pop(p.x, y - 20, `+${pts}`, '#fde047', 16); if (this.r() < 0.12) this.drops.push({ x: p.x, y: y - 20, ty: y, v: 25, life: 8 }); if (this.score >= (this.coins + 1) * 2500) this.coins++; } }
  soil() { if (this._soil) return this._soil; const c = document.createElement('canvas'); c.width = Math.ceil(this.cw * COLS); c.height = Math.ceil(this.ch * ROWS); const g = c.getContext('2d'); let noiseState = 0x6d2b79f5; const noise = () => { noiseState = Math.imul(noiseState ^ (noiseState >>> 15), noiseState | 1); noiseState ^= noiseState + Math.imul(noiseState ^ (noiseState >>> 7), noiseState | 61); return ((noiseState ^ (noiseState >>> 14)) >>> 0) / 4294967296; };
    for (let r = 0; r < ROWS; r++) { const y = r * this.ch; const gr = g.createLinearGradient(0, y, 0, y + this.ch); gr.addColorStop(0, '#3b2a1c'); gr.addColorStop(0.5, '#2a1d12'); gr.addColorStop(1, '#1b120b'); g.fillStyle = gr; g.fillRect(0, y + 3, c.width, this.ch - 6);
      for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(${120 + noise() * 60},${90 + noise() * 40},${60 + noise() * 30},${0.15 + noise() * 0.25})`; g.fillRect(noise() * c.width, y + 4 + noise() * (this.ch - 8), 1 + noise() * 2.5, 1 + noise() * 2); }
      g.strokeStyle = 'rgba(255,220,170,0.08)'; for (let cc = 1; cc < COLS; cc++) { g.beginPath(); g.moveTo(cc * this.cw, y + 6); g.lineTo(cc * this.cw, y + this.ch - 6); g.stroke(); } }
    return (this._soil = c); }
  render(ctx) {
    const W = this.W, H = this.H, A = this.art || {}, G = this.G, t = this.t;
    if (A.bg) { const s0 = Math.max(W / A.bg.width, H / A.bg.height); ctx.drawImage(A.bg, (W - A.bg.width * s0) / 2, (H - A.bg.height * s0) / 2, A.bg.width * s0, A.bg.height * s0); ctx.fillStyle = 'rgba(6,4,2,0.55)'; ctx.fillRect(0, 0, W, H); } else this.bg(ctx);
    ctx.drawImage(this.soil(), this.gx, this.gy);
    // warm grow-light pool + plants on the left
    const lg = ctx.createRadialGradient(W * 0.4, this.gy, 10, W * 0.4, this.gy, H * 0.7); lg.addColorStop(0, 'rgba(255,200,140,0.14)'); lg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 3; i++) { const y = this.gy + this.ch * ROWS * (0.2 + i * 0.3); ctx.save(); ctx.globalAlpha = i < this.plants ? 1 : 0.18; softShadow(ctx, 34, y + 34, 26, 8, 0.6); sprC(ctx, G, 'plant', 32, y - 6 + Math.sin(t * 1.5 + i) * 1.5, 72); ctx.restore(); }
    if (this.sel) { ctx.strokeStyle = 'rgba(163,230,53,0.25)'; ctx.lineWidth = 1; for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (!this.tiles[r][c]) { roundRect(ctx, this.gx + c * this.cw + 3, this.gy + r * this.ch + 5, this.cw - 6, this.ch - 10, 8); ctx.stroke(); } }
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const g = this.tiles[r][c]; if (!g) continue; const x = this.cx(c), y = this.cy(r); const s = Math.min(this.cw, this.ch) * 0.95; softShadow(ctx, x, y + s * 0.35, s * 0.4, s * 0.12, 0.6);
      const bob = g.k === 'launcher' && g.cd > 1.1 ? -3 : 0; sprC(ctx, G, GADGETS[g.k].spr, x, y + bob, s * (g.k === 'trap' ? 0.62 : 0.86));
      if (g.k === 'mister') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const k = (t * 0.8 + i * 0.25) % 1; ctx.globalAlpha = 0.18 * (1 - k); ctx.fillStyle = '#d1fae5'; ctx.beginPath(); ctx.arc(x + 20 + k * 90, y - 10 + Math.sin(k * 6 + i) * 6, 6 + k * 18, 0, TAU); ctx.fill(); } ctx.restore(); }
      if (g.hp < GADGETS[g.k].hp) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x - 18, y + s * 0.42, 36, 4); ctx.fillStyle = '#a3e635'; ctx.fillRect(x - 18, y + s * 0.42, 36 * g.hp / GADGETS[g.k].hp, 4); } }
    for (const s of this.swarms) for (let i = 0; i < 7; i++) { const x = s.x - i * 14, y = this.cy(s.r) + Math.sin(this.t * 20 + i) * 10; ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.ellipse(x, y, 7, 6, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(x + 3, y, 2.5, 0, TAU); ctx.fill(); }
    for (let r = 0; r < ROWS; r++) if (this.swarm[r]) { ctx.fillStyle = 'rgba(220,38,38,0.85)'; ctx.beginPath(); ctx.arc(this.gx - 6, this.cy(r) + this.ch * 0.32, 5, 0, TAU); ctx.fill(); }
    for (const s of this.shots) { ctx.save(); ctx.translate(s.x, this.cy(s.r) - 6); ctx.fillStyle = '#dc2626'; ctx.beginPath(); ctx.ellipse(0, 0, 8, 6.5, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(-2, -1, 1.6, 0, TAU); ctx.arc(3, 2, 1.4, 0, TAU); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.ellipse(-2, -3, 3, 1.5, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    for (const z of this.zaps) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = '#c4b5fd'; ctx.lineWidth = 3; ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(z.x0, z.y0); for (let i = 1; i < 6; i++) ctx.lineTo(lerp(z.x0, z.x1, i / 6) + rnd(-6, 6), lerp(z.y0, z.y1, i / 6) + rnd(-6, 6)); ctx.lineTo(z.x1, z.y1); ctx.stroke(); ctx.restore(); }
    for (const p of [...this.pests].sort((a, b) => a.r - b.r)) { const P = PESTS[p.k]; const y = this.cy(p.r) + (P.fly ? -16 + Math.sin(p.t * 8) * 5 : Math.sin(p.t * 10) * 1.5); softShadow(ctx, p.x, this.cy(p.r) + 18, P.size * 0.35, 6, P.fly ? 0.3 : 0.55);
      ctx.save(); ctx.translate(p.x, y); ctx.scale(-1, 1); if (p.hit > 0) ctx.filter = 'brightness(2)'; if (p.slow > 0) ctx.filter = 'hue-rotate(60deg) saturate(0.7)'; sprC(ctx, G, p.k, 0, 0, P.size); ctx.restore();
      if (p.hp < p.max) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(p.x - 16, y - P.size * 0.5, 32, 3); ctx.fillStyle = '#f87171'; ctx.fillRect(p.x - 16, y - P.size * 0.5, 32 * p.hp / p.max, 3); } }
    for (const d of this.drops) { const k = 1 + Math.sin(t * 6 + d.x) * 0.1; ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(d.x, d.y, 2, d.x, d.y, 30 * k); g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(0.3, 'rgba(253,224,71,0.8)'); g.addColorStop(1, 'rgba(253,186,71,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(d.x, d.y, 30 * k, 0, TAU); ctx.fill(); ctx.restore(); if (d.life < 2 && Math.floor(t * 8) % 2) continue; }
    // cards
    for (const c of this.cards()) { const G0 = GADGETS[c.k]; const ok = this.light >= G0.cost; const on = this.sel === c.k; roundRect(ctx, c.x, c.y, c.w, c.h, 12); ctx.fillStyle = on ? 'rgba(77,124,15,0.9)' : 'rgba(20,16,10,0.85)'; ctx.fill(); ctx.strokeStyle = on ? '#bef264' : ok ? 'rgba(190,242,100,0.45)' : 'rgba(120,113,108,0.4)'; ctx.lineWidth = on ? 3 : 1.5; ctx.stroke();
      ctx.save(); ctx.globalAlpha = ok ? 1 : 0.45; sprC(ctx, G, G0.spr, c.x + c.w / 2, c.y + 40, Math.min(c.w * 0.75, 60)); ctx.restore(); this.text(ctx, G0.name, c.x + c.w / 2, c.y + c.h - 24, { size: 10, weight: 700, align: 'center', color: '#e7e5e4', font: 'Exo' }); this.text(ctx, `${G0.cost}`, c.x + c.w / 2, c.y + c.h - 8, { size: 13, weight: 900, align: 'center', color: ok ? '#fde047' : '#78716c' }); }
    this.hudScore(ctx);
    this.text(ctx, 'LIGHT', W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' }); this.text(ctx, fmt(this.light), W - 18, 62, { size: 28, weight: 900, align: 'right', color: '#fde047', glow: '#f59e0b' });
    this.text(ctx, `WAVE ${this.wave}  •  PLANTS ${this.plants}`, W - 18, 82, { size: 12, weight: 800, align: 'right', color: '#bef264', font: 'Exo' });
    if (this.sel) this.text(ctx, `${GADGETS[this.sel].tip}. Tap a tile.`, W / 2, this.gy - 12, { size: 13, weight: 700, align: 'center', color: '#d9f99d', font: 'Exo' });
  }
}

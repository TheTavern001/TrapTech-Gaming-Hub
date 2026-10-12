// Void Swarm - original endless space shooter (v7). Waves of alien drones fly in along curved paths, lock into a swaying
// formation, then peel off and dive at you. Every 5th wave a mothership arrives. Original ships and art: Blender Cycles renders
// (PBR titanium hull, glass canopy, translucent insect wings, emissive cores). No third-party names or art.
import { Game, TAU, rnd, clamp, lerp, fmt, loadAtlas, sprC, drawFlame, reducedMotion } from './engine.js';
const TYPES = { a: { spr: 'drone_a', pts: 50, hp: 1, size: 50, col: '#fde047' }, b: { spr: 'drone_b', pts: 80, hp: 1, size: 50, col: '#e879f9' }, c: { spr: 'drone_c', pts: 150, hp: 2, size: 56, col: '#fb7185' } };
const PU = { spread: { spr: 'pu_spread', col: '#fb923c', label: 'SPREAD SHOT' }, rapid: { spr: 'pu_rapid', col: '#4ade80', label: 'RAPID FIRE' }, shield: { spr: 'pu_shield', col: '#60a5fa', label: 'SHIELD' }, life: { spr: 'pu_life', col: '#fb7185', label: '+1 LIFE' } };
const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };
const glow = (col, r) => { const c = document.createElement('canvas'); c.width = c.height = r * 2; const g = c.getContext('2d'); const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.2, col); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); return c; };
export class VoidSwarm extends Game {
  get title() { return 'VOID SWARM'; }
  range(min, max) { return min + this.r() * (max - min); }
  get hint() { return 'Drag anywhere to fly; your fighter fires automatically. Shoot drones while they dive for double points, grab capsules for power-ups, and survive the endless waves. Every 5th wave brings a mothership.'; }
  async load() { this.S = await loadAtlas('/assets/v7/ships'); }
  layout() { this.py = this.H - 120; if (this.px === undefined) this.px = this.W / 2; this._neb = null; }
  reset() {
    this.score = 0; this.coins = 0; this.lives = 3; this.wave = 0; this.px = this.W / 2; this.py = this.H - 120; this.inv = 2; this.dead = 0; this.over = 0;
    this.enemies = []; this.shots = []; this.bolts = []; this.pus = []; this.fx = []; this.fireT = 0; this.diveT = 3; this.shake = 0; this.pw = { spread: 0, rapid: 0, shield: 0 };
    this.sway = 0; this.drag = null; this.keys = {}; this.waveT = 1.2; this.banner = 0; this.kills = 0; this.boss = null;
    this.stars = Array.from({ length: 90 }, (_, i) => ({ x: this.r(), y: Math.random(), z: [0.25, 0.5, 1][i % 3] }));
    this.gl = { blue: glow('#60a5fa', 16), pink: glow('#f472b6', 14), orange: glow('#fb923c', 30), white: glow('#e0f2fe', 20) };
  }
  mult() { return Math.min(4, 1 + 0.05 * (this.wave - 1)); }
  nebula() { // pre-rendered soft nebula (tall, scrolls slowly)
    if (this._neb) return this._neb; const c = document.createElement('canvas'); c.width = 270; c.height = 600; const g = c.getContext('2d'); g.fillStyle = '#03030c'; g.fillRect(0, 0, 270, 600);
    const blobs = [[60, 120, 140, '#3b0764'], [210, 260, 160, '#0c4a6e'], [90, 420, 150, '#4a044e'], [200, 540, 120, '#1e1b4b'], [130, 0, 120, '#3b0764'], [130, 600, 120, '#3b0764']];
    for (const [x, y, r, col] of blobs) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, col + 'cc'); gr.addColorStop(1, col + '00'); g.fillStyle = gr; g.fillRect(0, 0, 270, 600); }
    return (this._neb = c);
  }
  startWave() {
    this.wave++; this.banner = 2; const w = this.wave; this.mark('w', w);
    if (w % 5 === 0) { this.boss = { x: this.W / 2, y: -120, ty: 150, hp: 40 + 12 * (w / 5), max: 40 + 12 * (w / 5), t: 0, fire: 2, hitT: 0 }; this.sfx.tone(80, 1.2, { type: 'sawtooth', vol: 0.25, slide: 0.5 }); }
    const rows = Math.min(5, 3 + Math.floor(w / 3)), cols = Math.min(8, 6 + Math.floor(w / 4)); const gx = 52, gy = 46; const x0 = this.W / 2 - (cols - 1) * gx / 2;
    let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const type = r === 0 ? 'c' : r <= 1 + Math.floor(rows / 3) ? 'b' : 'a'; const left = (k % 2 === 0);
      const sx = x0 + c * gx, sy = 120 + r * gy + (this.boss ? 120 : 0);
      this.enemies.push({ type, hp: TYPES[type].hp + (w >= 12 && type === 'a' ? 1 : 0), slot: [sx, sy], x: left ? -40 : this.W + 40, y: 80, mode: 'enter', t: -0.12 * k - (left ? 0 : 0.06),
        path: [[left ? -40 : this.W + 40, this.H * 0.15], [left ? this.W * 0.9 : this.W * 0.1, this.H * 0.55], [sx + (left ? -160 : 160), sy + 220], [sx, sy]], hitT: 0, dur: 1.9 - Math.min(0.7, w * 0.03) });
      k++;
    }
  }
  onDown(x, y) { this.drag = [x, y, this.px, this.py]; }
  onMove(x, y) { if (!this.drag) return; this.px = clamp(this.drag[2] + (x - this.drag[0]) * 1.25, 24, this.W - 24); this.py = clamp(this.drag[3] + (y - this.drag[1]) * 1.25, this.H * 0.45, this.H - 50); }
  onUp() { this.drag = null; }
  onKey(code, down) { this.keys[code] = down; }
  fire() {
    const rate = this.pw.rapid > 0 ? 0.085 : 0.16; if (this.fireT > 0) return; this.fireT = rate;
    const sp = -820; const add = (dx, vx) => this.shots.push({ x: this.px + dx, y: this.py - 30, vx, vy: sp });
    add(-9, 0); add(9, 0); if (this.pw.spread > 0) { add(-14, -220); add(14, 220); }
    if (Math.random() < 0.5) this.sfx.tone(1400, 0.035, { type: 'square', vol: 0.05, slide: -0.5 });
  }
  explode(x, y, col, big = 1) {
    this.fx.push({ k: 'ring', x, y, t: 0, max: 0.45 * big, r: 60 * big, col }); this.fx.push({ k: 'flash', x, y, t: 0, max: 0.25, r: 50 * big });
    this.burst(x, y, [col, '#fff', '#fbbf24'], Math.round(16 * big), 260 * big, 0.6, 3.5); this.sfx.noise(0.18 * big, { vol: 0.22, freq: 900 / big });
  }
  hitPlayer() {
    if (this.inv > 0 || this.dead) return;
    if (this.pw.shield > 0) { this.pw.shield = 0; this.inv = 1; this.fx.push({ k: 'ring', x: this.px, y: this.py, t: 0, max: 0.4, r: 70, col: '#60a5fa' }); this.sfx.tone(300, 0.2, { type: 'sine', vol: 0.3 }); return; }
    this.lives--; this.explode(this.px, this.py, '#93c5fd', 1.8); this.shake = 0.5; this.pw = { spread: 0, rapid: 0, shield: 0 };
    if (this.lives <= 0) { this.over = 1.6; this.dead = 99; this.sfx.lose(); return; }
    this.dead = 1.2; this.inv = 3.2;
  }
  kill(e) {
    const T = TYPES[e.type]; const diving = e.mode === 'dive'; const pts = this.award(Math.round(T.pts * (diving ? 2 : 1) * this.mult()), 'k'); this.kills++;
    this.explode(e.x, e.y, T.col, e.type === 'c' ? 1.2 : 0.9); if (diving || e.type === 'c') this.pop(e.x, e.y - 12, `+${fmt(pts)}`, diving ? '#fde047' : '#fff', diving ? 20 : 16);
    if (Math.random() < 0.05 + (diving ? 0.04 : 0)) { const r = Math.random(); let k = r < 0.36 ? 'spread' : r < 0.72 ? 'rapid' : r < 0.94 ? 'shield' : 'life'; if (k === 'life' && this.lives >= 3) k = 'shield'; this.pus.push({ k, x: e.x, y: e.y, vy: 120 }); }
    if (this.kills % 40 === 0) this.coins++;
  }
  update(dt) {
    const W = this.W, H = this.H; if (this.shake > 0) this.shake -= dt; if (this.banner > 0) this.banner -= dt;
    for (const s of this.stars) { s.y += s.z * dt * 0.25; if (s.y > 1) { s.y -= 1; s.x = Math.random(); } }
    if (this.over) { this.over -= dt; this._fx(dt); if (this.over <= 0) this.finish(); return; }
    if (this.inv > 0) this.inv -= dt; for (const k in this.pw) if (this.pw[k] > 0) this.pw[k] -= dt; this.fireT -= dt;
    if (this.dead > 0) { this.dead -= dt; if (this.dead <= 0) { this.px = W / 2; this.py = H - 120; } }
    const kx = (this.keys.ArrowRight || this.keys.KeyD ? 1 : 0) - (this.keys.ArrowLeft || this.keys.KeyA ? 1 : 0), ky = (this.keys.ArrowDown || this.keys.KeyS ? 1 : 0) - (this.keys.ArrowUp || this.keys.KeyW ? 1 : 0);
    if (kx || ky) { this.px = clamp(this.px + kx * 380 * dt, 24, W - 24); this.py = clamp(this.py + ky * 380 * dt, H * 0.45, H - 50); }
    if (this.dead <= 0) this.fire();
    // waves
    if (!this.enemies.length && !this.boss) { this.waveT -= dt; if (this.waveT <= 0) { if (this.wave > 0) { const b = this.award(100 * this.wave, 'c'); this.pop(W / 2, H * 0.4, `WAVE ${this.wave} CLEAR  +${fmt(b)}`, '#34d399', 22); } this.startWave(); this.waveT = 1.6; } }
    this.sway += dt; const sx = Math.sin(this.sway * 0.8) * 26, breathe = 1 + Math.sin(this.sway * 1.6) * 0.04;
    const w = this.wave; const espd = 1 + Math.min(1.2, w * 0.05);
    // formation + enemy motion
    let inForm = 0;
    for (const e of this.enemies) {
      if (e.hitT > 0) e.hitT -= dt; const slotX = W / 2 + (e.slot[0] - W / 2) * breathe + sx, slotY = e.slot[1];
      if (e.mode === 'enter' || e.mode === 'return') { e.t += dt / e.dur * espd; if (e.t < 0) continue; const tt = Math.min(1, e.t); const p = e.path.slice(); p[3] = [slotX, slotY]; const [nx, ny] = bez(p[0], p[1], p[2], p[3], tt); e.ang = Math.atan2(ny - e.y, nx - e.x) + Math.PI / 2; e.x = nx; e.y = ny; if (e.t >= 1) { e.mode = 'form'; e.ang = 0; } }
      else if (e.mode === 'form') { e.x = slotX; e.y = slotY; e.ang = lerp(e.ang || 0, 0, Math.min(1, dt * 6)); inForm++; if (Math.random() < dt * 0.04 * (0.5 + w * 0.06) * (1 + Math.max(0, w - 8) * 0.12)) this.enemyShot(e, w >= 10 && Math.random() < 0.3); }
      else if (e.mode === 'dive') { e.t += dt / e.dur * espd; const [nx, ny] = bez(e.path[0], e.path[1], e.path[2], e.path[3], Math.min(1, e.t)); e.ang = Math.atan2(ny - e.y, nx - e.x) - Math.PI / 2; e.x = nx; e.y = ny;
        if (e.shots > 0 && e.y > 140 && e.y < this.py - 140 && Math.random() < dt * 2.2) { e.shots--; this.enemyShot(e, true); }
        if (e.t >= 1) { e.mode = 'return'; e.t = 0; e.dur = 1.3; e.path = [[e.x, -50], [slotX, 0], [slotX, slotY - 60], [slotX, slotY]]; e.x = e.path[0][0]; e.y = -50; } }
      if (this.dead <= 0 && this.inv <= 0 && Math.abs(e.x - this.px) < 26 && Math.abs(e.y - this.py) < 26) { e.hp = 0; this.kill(e); this.hitPlayer(); }
    }
    this.diveT -= dt;
    if (this.diveT <= 0 && inForm > 0 && this.dead <= 0) { const n = Math.min(1 + Math.floor(w / 4), w >= 12 ? 7 : 4); const cands = this.enemies.filter(e => e.mode === 'form');
      for (let i = 0; i < n && cands.length; i++) { const e = cands.splice(Math.floor(Math.random() * cands.length), 1)[0]; const side = e.x < W / 2 ? -1 : 1;
        e.mode = 'dive'; e.t = 0; e.dur = 2.4 - Math.min(1, w * 0.05); e.shots = 1 + Math.floor(w / 4); e.path = [[e.x, e.y], [e.x + side * 140, e.y - 90], [this.px + this.range(-60, 60), this.py - 120], [this.px - side * this.range(40, 140), H + 70]]; }
      this.diveT = Math.max(w >= 12 ? 0.45 : 0.7, 2.8 - w * 0.12) * this.range(0.7, 1.3); if (Math.random() < 0.5) this.sfx.tone(900, 0.4, { type: 'sine', vol: 0.08, slide: -0.6 }); }
    // boss
    const B = this.boss; if (B) { B.t += dt; if (B.hitT > 0) B.hitT -= dt; B.y = lerp(B.y, B.ty, Math.min(1, dt * 1.2)); B.x = W / 2 + Math.sin(B.t * 0.7) * (W * 0.28); B.fire -= dt;
      if (B.fire <= 0 && B.y > 60) { B.fire = Math.max(0.7, 1.8 - w * 0.03); const n = 5 + Math.min(6, Math.floor(w / 5)); for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.18; this.bolts.push({ x: B.x, y: B.y + 50, vx: Math.cos(a) * 210, vy: Math.sin(a) * 210, big: true }); } this.sfx.tone(180, 0.2, { type: 'sawtooth', vol: 0.12 }); } }
    // player shots
    for (const s of this.shots) { s.x += s.vx * dt; s.y += s.vy * dt;
      for (const e of this.enemies) { if (e.hp <= 0 || (e.mode === 'enter' && e.t < 0)) continue; if (Math.abs(s.x - e.x) < 20 && Math.abs(s.y - e.y) < 20) { s.dead = 1; e.hp--; e.hitT = 0.08; if (e.hp <= 0) this.kill(e); break; } }
      if (!s.dead && B && B.hp > 0 && Math.abs(s.x - B.x) < 90 && Math.abs(s.y - B.y) < 60) { s.dead = 1; B.hp--; B.hitT = 0.06; if (Math.random() < 0.3) this.burst(s.x, s.y, ['#fde047', '#fff'], 3, 120, 0.25, 2);
        if (B.hp <= 0) { const pts = this.award(Math.round(2000 * Math.max(1, w / 5)), 'b'); this.pop(B.x, B.y, `MOTHERSHIP +${fmt(pts)}`, '#fde047', 26); for (let i = 0; i < 5; i++) this.explode(B.x + this.range(-70, 70), B.y + this.range(-40, 40), '#fb7185', 1.6); this.shake = 0.6; this.coins += 2; this.pus.push({ k: 'life', x: B.x, y: B.y, vy: 110 }); this.boss = null; } } }
    this.shots = this.shots.filter(s => !s.dead && s.y > -30 && s.x > -30 && s.x < W + 30); this.enemies = this.enemies.filter(e => e.hp > 0);
    // enemy bolts
    for (const b of this.bolts) { b.x += b.vx * dt; b.y += b.vy * dt; if (this.dead <= 0 && Math.abs(b.x - this.px) < (b.big ? 12 : 9) && Math.abs(b.y - this.py) < 16) { b.dead = 1; this.hitPlayer(); } }
    this.bolts = this.bolts.filter(b => !b.dead && b.y < H + 20 && b.y > -40 && b.x > -20 && b.x < W + 20);
    // power-ups
    for (const p of this.pus) { p.y += p.vy * dt; if (this.dead <= 0 && Math.abs(p.x - this.px) < 30 && Math.abs(p.y - this.py) < 30) { p.dead = 1; if (p.k === 'life') this.lives = Math.min(4, this.lives + 1); else this.pw[p.k] = p.k === 'shield' ? 12 : 10; this.pop(this.px, this.py - 50, PU[p.k].label, PU[p.k].col, 20); this.sfx.chord([660, 880, 1320], 0.12, { type: 'triangle', vol: 0.25 }); } }
    this.pus = this.pus.filter(p => !p.dead && p.y < H + 40);
    this._fx(dt);
  }
  enemyShot(e, aimed) { const sp = 230 + Math.min(200, this.wave * 9); const a = aimed ? Math.atan2(this.py - e.y, this.px - e.x) : Math.PI / 2 + this.range(-0.15, 0.15); this.bolts.push({ x: e.x, y: e.y + 16, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); }
  _fx(dt) { for (const f of this.fx) f.t += dt; this.fx = this.fx.filter(f => f.t < f.max); }
  render(ctx) {
    const W = this.W, H = this.H, S = this.S, t = this.t; const rm = reducedMotion();
    const neb = this.nebula(); const off = (t * 12) % H; ctx.drawImage(neb, 0, off - H, W, H); ctx.drawImage(neb, 0, off, W, H);
    for (const s of this.stars) { const y = s.y * H, x = s.x * W; ctx.fillStyle = `rgba(220,230,255,${0.3 + s.z * 0.6})`; ctx.fillRect(x, y, s.z * 1.8, s.z * (rm ? 1.8 : 6)); }
    ctx.save(); if (this.shake > 0 && !rm) ctx.translate(rnd(-6, 6) * this.shake, rnd(-6, 6) * this.shake);
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.shots) { ctx.drawImage(this.gl.blue, s.x - 8, s.y - 12, 16, 30); ctx.fillStyle = '#e0f2fe'; ctx.fillRect(s.x - 1.5, s.y - 10, 3, 20); }
    for (const b of this.bolts) { const r = b.big ? 16 : 11; ctx.drawImage(this.gl.pink, b.x - r, b.y - r, r * 2, r * 2); }
    ctx.globalCompositeOperation = 'source-over';
    // power-up capsules with halo
    for (const p of this.pus) { const k = PU[p.k]; ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.6 + 0.3 * Math.sin(t * 8); ctx.drawImage(this.gl.orange, p.x - 26, p.y - 26, 52, 52); ctx.restore(); ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.sin(t * 3) * 0.4); if (!sprC(ctx, S, k.spr, 0, 0, 36)) { ctx.fillStyle = k.col; ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill(); } ctx.restore(); }
    // enemies
    for (const e of this.enemies) { if (e.mode === 'enter' && e.t < 0) continue; const T = TYPES[e.type]; const flap = 1 + Math.sin(t * 18 + e.slot[0]) * 0.06;
      ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(e.ang || 0); ctx.scale(flap, 1); if (e.hitT > 0) ctx.filter = 'brightness(2.2)'; if (!sprC(ctx, S, T.spr, 0, 0, T.size)) { ctx.fillStyle = T.col; ctx.beginPath(); ctx.arc(0, 0, 14, 0, TAU); ctx.fill(); } ctx.restore(); }
    const B = this.boss; if (B) { ctx.save(); ctx.translate(B.x, B.y); if (B.hitT > 0) ctx.filter = 'brightness(1.8)'; if (!sprC(ctx, S, 'boss', 0, 0, 200)) { ctx.fillStyle = '#555'; ctx.beginPath(); ctx.ellipse(0, 0, 90, 50, 0, 0, TAU); ctx.fill(); } ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 110, 96, 220, 8); ctx.fillStyle = '#fb7185'; ctx.fillRect(W / 2 - 110, 96, 220 * B.hp / B.max, 8); this.text(ctx, 'MOTHERSHIP', W / 2, 92, { size: 11, weight: 800, align: 'center', color: '#fecdd3' }); }
    // player
    if (this.dead <= 0 && !this.over) { ctx.save(); ctx.translate(this.px, this.py); if (this.inv > 0 && Math.floor(t * 14) % 2) ctx.globalAlpha = 0.45;
      drawFlame(ctx, -11, 30, 30 + Math.sin(t * 40) * 5, 10, 0, t); drawFlame(ctx, 11, 30, 30 + Math.cos(t * 40) * 5, 10, 0, t + 1);
      if (!sprC(ctx, S, 'player', 0, 0, 64)) { ctx.fillStyle = '#cbd5e1'; ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(22, 20); ctx.lineTo(-22, 20); ctx.closePath(); ctx.fill(); }
      if (this.pw.shield > 0) { ctx.strokeStyle = `rgba(96,165,250,${0.5 + 0.3 * Math.sin(t * 10)})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.25; ctx.drawImage(this.gl.blue, -44, -44, 88, 88); }
      ctx.restore(); }
    // explosions: additive flash + shock ring
    for (const f of this.fx) { const k = f.t / f.max; if (f.k === 'flash') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 - k; const r = f.r * (0.6 + k); ctx.drawImage(this.gl.orange, f.x - r, f.y - r, r * 2, r * 2); ctx.restore(); }
      else { ctx.strokeStyle = f.col; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3 * (1 - k) + 1; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * k, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; } }
    ctx.restore();
    // HUD
    this.hudScore(ctx);
    this.text(ctx, `WAVE ${this.wave}`, W - 18, 30, { size: 12, weight: 800, color: '#9aa3d0', align: 'right' });
    for (let i = 0; i < this.lives; i++) sprC(ctx, S, 'player', W - 28 - i * 26, 54, 22) || (ctx.fillStyle = '#cbd5e1', ctx.fillRect(W - 36 - i * 26, 46, 16, 16));
    this.text(ctx, `x${this.mult().toFixed(1)}`, W - 18, 84, { size: 12, weight: 800, align: 'right', color: '#fde047', font: 'Exo' });
    let yy = 104; for (const k of ['spread', 'rapid', 'shield']) if (this.pw[k] > 0) { this.text(ctx, `${PU[k].label} ${Math.ceil(this.pw[k])}s`, W - 18, yy, { size: 11, weight: 800, align: 'right', color: PU[k].col, font: 'Exo' }); yy += 16; }
    if (this.banner > 0) { ctx.globalAlpha = Math.min(1, this.banner); this.text(ctx, this.wave % 5 === 0 ? `WAVE ${this.wave}: MOTHERSHIP` : `WAVE ${this.wave}`, W / 2, H * 0.42, { size: 30, weight: 900, align: 'center', glow: '#7c4dff' }); ctx.globalAlpha = 1; }
    if (this.state === 'play' && this.playT < 3.5) this.text(ctx, 'DRAG ANYWHERE TO FLY', W / 2, H - 30, { size: 14, weight: 800, align: 'center', color: '#c4b5fd' });
  }
}

// Void Swarm v8 - endless wave shooter. Rebuilt from scratch: Kenney Space Shooter Remastered art (CC0), parallax space with
// drifting meteors, curved entry paths into a swaying formation, divers, aimed bullet fans, motherships every 5th wave,
// capsules (spread / rapid / shield / life), additive FX, hit-flash, shake and hit-stop. Scoring rules unchanged (src/ac-levels.js).
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, loadPack, spr, halo, bake, mix } from './kit.js';
const TYPES = { a: { s: 'ea', pts: 50, hp: 1, w: 46, col: '#4ade80' }, b: { s: 'eb', pts: 80, hp: 1, w: 46, col: '#38bdf8' }, c: { s: 'ec', pts: 150, hp: 2, w: 52, col: '#fb7185' } };
const PU = { spread: { s: 'pu_spread', col: '#fb923c', t: 'SPREAD SHOT' }, rapid: { s: 'pu_rapid', col: '#fde047', t: 'RAPID FIRE' }, shield: { s: 'pu_shield', col: '#60a5fa', t: 'SHIELD' }, life: { s: 'pu_life', col: '#4ade80', t: '+1 LIFE' } };
const bez = (a, b, c, d, t) => { const u = 1 - t; return [u * u * u * a[0] + 3 * u * u * t * b[0] + 3 * u * t * t * c[0] + t * t * t * d[0], u * u * u * a[1] + 3 * u * u * t * b[1] + 3 * u * t * t * c[1] + t * t * t * d[1]]; };
export class VoidSwarm extends Game8 {
  get title() { return 'VOID SWARM'; }
  get hint() { return 'Drag to fly, your fighter fires on its own. Shoot divers for double points, grab capsules, dodge the bullet fans. Every 5th wave a mothership arrives. The waves never end.'; }
  get accent() { return '#60a5fa'; }
  get musicOpts() { return { root: 49, bpm: 124, mode: 'minor', seed: 5, lead: 'square', vol: 0.4 }; }
  async load() { this.P = await loadPack('void-swarm'); }
  reset() {
    super.reset(); this.score = 0; this.coins = 0; this.lives = 3; this.wave = 0; this.px = this.W / 2; this.py = this.H - 140; this.inv = 2; this.en = []; this.sh = []; this.bl = []; this.pus = []; this.fireT = 0; this.diveT = 3; this.pw = { spread: 0, rapid: 0, shield: 0 };
    this.sway = 0; this.drag = null; this.keys = {}; this.waveT = 1; this.banner = 0; this.boss = null; this.bossShown = 0; this.clearedMark = true; this.rocks = null; this.stars = null;
  }
  layout() { if (this.px === undefined) this.px = this.W / 2; this.py = Math.min(this.py || 1e9, this.H - 140); this.bgc = null; this.rocks = null; this.stars = null; }
  mult() { return Math.min(4, 1 + 0.05 * (this.wave - 1)); }
  initBg() {
    const W = this.W, H = this.H; this.bgc = bake(Math.round(W / 2), Math.round(H / 2), (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#05061a'); gr.addColorStop(0.55, '#0b0a2e'); gr.addColorStop(1, '#150a3a'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (const [x, y, r, c] of [[0.2, 0.2, 0.5, '#4c1d95'], [0.85, 0.45, 0.6, '#0c4a6e'], [0.3, 0.8, 0.55, '#6b21a8'], [0.9, 0.95, 0.4, '#1e3a8a']]) { const rg = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w); rg.addColorStop(0, c + 'aa'); rg.addColorStop(1, c + '00'); g.fillStyle = rg; g.fillRect(0, 0, w, h); }
    });
    this.stars = Array.from({ length: 70 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, z: [0.2, 0.45, 0.9][i % 3], tw: Math.random() * 6 }));
    this.rocks = Array.from({ length: 5 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, s: ['m_big', 'm_med', 'm_sm', 'm_big2', 'm_sm'][i], v: 24 + Math.random() * 26, r: Math.random() * TAU, vr: rnd(-0.6, 0.6), w: [74, 40, 24, 70, 22][i] }));
  }
  startWave() {
    const w = ++this.wave; this.banner = 2.2; this.mark('w', w); this.clearedMark = false; this.setLevel(w / 14);
    if (w % 5 === 0) { const hp = 40 + 12 * (w / 5); this.boss = { x: this.W / 2, y: -140, ty: 150, hp, max: hp, t: 0, fire: 2.5, hit: 0, ph: 0 }; this.sfx.tone(70, 1.4, { type: 'sawtooth', vol: 0.3, slide: 0.5 }); }
    const rows = Math.min(5, 3 + Math.floor(w / 3)), cols = Math.min(8, 6 + Math.floor(w / 4)), gx = Math.min(56, (this.W - 70) / cols), gy = 48, x0 = this.W / 2 - (cols - 1) * gx / 2; let k = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const type = r === 0 ? 'c' : r <= 1 + Math.floor(rows / 3) ? 'b' : 'a', left = k % 2 === 0, sx = x0 + c * gx, sy = 110 + r * gy + (this.boss ? 130 : 0);
      this.en.push({ type, hp: TYPES[type].hp + (w >= 12 && type === 'a' ? 1 : 0), sx, sy, x: left ? -40 : this.W + 40, y: 60, mode: 'enter', t: -0.1 * k, hit: 0, dur: 1.9 - Math.min(0.7, w * 0.03), left, fire: 2 + this.r() * 5, k });
      k++;
    }
  }
  onDown(x, y) { this.drag = [x, y, this.px, this.py]; }
  onMove(x, y) { if (!this.drag) return; this.px = clamp(this.drag[2] + (x - this.drag[0]) * 1.25, 24, this.W - 24); this.py = clamp(this.drag[3] + (y - this.drag[1]) * 1.25, this.H * 0.4, this.H - 60); }
  onUp() { this.drag = null; }
  onKey(c, d) { this.keys[c] = d; }
  fire() {
    if (this.fireT > 0) return; this.fireT = this.pw.rapid > 0 ? 0.085 : 0.16; const add = (dx, vx) => this.sh.push({ x: this.px + dx, y: this.py - 30, vx, vy: -900 });
    add(-10, 0); add(10, 0); if (this.pw.spread > 0) { add(-16, -240); add(16, 240); } if (this.pw.spread > 0 && this.pw.rapid > 0) add(0, 0);
    this.fx.add({ k: 0, x: this.px - 10, y: this.py - 34, vx: 0, vy: -30, g: 0, life: 0.1, max: 0.1, c: '#93c5fd', s: 10 }); this.fx.add({ k: 0, x: this.px + 10, y: this.py - 34, vx: 0, vy: -30, g: 0, life: 0.1, max: 0.1, c: '#93c5fd', s: 10 });
    if (Math.random() < 0.45) this.sfx.tone(1500, 0.03, { type: 'square', vol: 0.04, slide: 0.4 });
  }
  explode(x, y, col, big = 1) { this.fx.ring(x, y, col, 8, 54 * big, 0.45); this.fx.burst(x, y, [col, '#ffffff', '#fbbf24'], Math.round(10 * big), 280 * big, 0.6, 18); this.fx.sparks(x, y, ['#fff', col], Math.round(8 * big), 420, 0.4, 16); this.fx.debris(x, y, mix(col, '#000000', 0.4), Math.round(4 * big), 240, 0.8, 6); this.sfx.noise(0.16 * big, { vol: 0.2, freq: 900 / big }); if (big > 1) { this.fx.shake(9 * big); this.fx.flash('#ffffff', 0.18); } else this.fx.shake(2.5); }
  hitPlayer() {
    if (this.inv > 0 || this.dead) return;
    if (this.pw.shield > 0) { this.pw.shield = 0; this.inv = 1.2; this.fx.ring(this.px, this.py, '#60a5fa', 20, 90, 0.5, 4); this.fx.shake(6); this.sfx.tone(300, 0.2, { vol: 0.3 }); return; }
    this.lives--; this.explode(this.px, this.py, '#93c5fd', 1.8); this.pw = { spread: 0, rapid: 0, shield: 0 }; this.bl = this.bl.filter(b => Math.hypot(b.x - this.px, b.y - this.py) > 160); this.hitstop(0.08);
    if (this.lives <= 0) this.kill(1.3, '#60a5fa'); else { this.inv = 2.2; this.px = this.W / 2; this.py = this.H - 140; }
  }
  killEnemy(e, i) {
    const T = TYPES[e.type], d = e.mode === 'dive' ? 2 : 1; this.award(Math.round(T.pts * d * this.mult()), 'k'); this.explode(e.x, e.y, T.col, d > 1 ? 1.3 : 1); this.pop(e.x, e.y - 14, '+' + Math.round(T.pts * d * this.mult()), d > 1 ? '#fde047' : '#fff', d > 1 ? 22 : 17);
    if (this.r() < 0.1) { const ks = ['spread', 'rapid', 'shield', 'life']; this.pus.push({ k: ks[Math.floor(this.r() * (this.lives >= 5 ? 3 : 4))], x: e.x, y: e.y, t: 0 }); } this.en.splice(i, 1);
  }
  update(dt) {
    if (!this.bgc) this.initBg(); this.sway += dt; if (this.inv > 0) this.inv -= dt; for (const k in this.pw) if (this.pw[k] > 0 && k !== 'shield') this.pw[k] -= dt;
    const sp = 460 * dt; if (this.keys.ArrowLeft || this.keys.KeyA) this.px -= sp; if (this.keys.ArrowRight || this.keys.KeyD) this.px += sp; if (this.keys.ArrowUp || this.keys.KeyW) this.py -= sp; if (this.keys.ArrowDown || this.keys.KeyS) this.py += sp; this.px = clamp(this.px, 24, this.W - 24); this.py = clamp(this.py, this.H * 0.4, this.H - 60);
    this.fireT -= dt; this.fire();
    for (const s of this.stars) { s.y += s.z * 60 * dt; if (s.y > this.H) { s.y = -4; s.x = Math.random() * this.W; } }
    for (const r of this.rocks) { r.y += r.v * dt; r.r += r.vr * dt; if (r.y > this.H + 60) { r.y = -60; r.x = Math.random() * this.W; } }
    if (!this.en.length && !this.boss && this.state === 'play') { if (!this.clearedMark) { this.clearedMark = true; if (this.wave > 0) { this.award(100 * this.wave, 'c'); this.pop(this.W / 2, this.H * 0.4, 'WAVE CLEAR +' + 100 * this.wave, '#4ade80', 24); this.sfx.win(); } this.waveT = 1.6; } this.waveT -= dt; if (this.waveT <= 0) this.startWave(); }
    if (this.banner > 0) this.banner -= dt;
    // enemies
    const diveN = this.en.filter(e => e.mode === 'dive').length; this.diveT -= dt;
    if (this.diveT <= 0 && diveN < Math.min(4, 1 + Math.floor(this.wave / 3))) { const cand = this.en.filter(e => e.mode === 'form'); if (cand.length) { const e = cand[Math.floor(this.r() * cand.length)]; e.mode = 'dive'; e.t = 0; e.dx = clamp(this.px + (this.r() - 0.5) * 120, 40, this.W - 40); e.x0 = e.x; e.y0 = e.y; this.sfx.tone(700, 0.25, { type: 'sawtooth', vol: 0.05, slide: 0.3 }); } this.diveT = Math.max(0.9, 3.4 - this.wave * 0.12) * (0.7 + this.r() * 0.6); }
    for (let i = this.en.length - 1; i >= 0; i--) {
      const e = this.en[i]; e.hit -= dt; const fx = e.sx + Math.sin(this.sway * 1.2 + e.sx * 0.02) * 22, fy = e.sy + Math.sin(this.sway * 2 + e.k * 0.5) * 4;
      if (e.mode === 'enter') { e.t += dt; if (e.t > 0) { const u = clamp(e.t / e.dur, 0, 1), L = e.left ? 1 : -1, p = bez([e.left ? -40 : this.W + 40, 60], [e.left ? this.W * 0.95 : this.W * 0.05, this.H * 0.3], [fx + L * -170, fy + 230], [fx, fy], u * u * (3 - 2 * u)); e.x = p[0]; e.y = p[1]; if (u >= 1) e.mode = 'form'; } }
      else if (e.mode === 'form') { e.x = fx; e.y = fy; e.fire -= dt; if (e.fire <= 0) { e.fire = Math.max(1.6, 7 - this.wave * 0.3) * (0.6 + this.r()); if (this.wave > 1 && this.r() < 0.6) this.bl.push({ x: e.x, y: e.y + 16, vx: 0, vy: 230 + this.wave * 6 }); } }
      else { e.t += dt; const u = e.t / 1.9; e.x = lerp(e.x0, e.dx, Math.min(1, u)) + Math.sin(u * 7) * 60 * (1 - Math.min(1, u) * 0.5); e.y = e.y0 + u * (this.H + 80 - e.y0) * 1.05 + Math.sin(u * 3) * 10; if (u > 0.22 && !e.shot && this.r() < 0.9) { e.shot = 1; this.aimShot(e.x, e.y + 16, 280 + this.wave * 8); } if (e.y > this.H + 50) { e.mode = 'enter'; e.t = -0.2; e.left = this.r() < 0.5; e.x = e.left ? -40 : this.W + 40; e.y = 60; e.shot = 0; e.dur = 1.3; } }
      if (e.mode !== 'enter' && Math.hypot(e.x - this.px, e.y - this.py) < 30 && this.inv <= 0) { this.hitPlayer(); if (e.mode === 'dive') { this.explode(e.x, e.y, TYPES[e.type].col, 1); this.en.splice(i, 1); this.pop(e.x, e.y, 'RAMMED', '#fb7185', 14); } }
    }
    // boss
    const B = this.boss; if (B) {
      B.t += dt; B.hit -= dt; B.y = lerp(B.y, B.ty, Math.min(1, dt * 1.5)); B.x = this.W / 2 + Math.sin(B.t * 0.8) * (this.W * 0.32); B.fire -= dt; const ph = B.hp < B.max * 0.4 ? 2 : B.hp < B.max * 0.75 ? 1 : 0;
      if (B.fire <= 0 && B.y > B.ty - 10) { B.fire = [1.5, 1.15, 0.8][ph] / (1 + this.wave * 0.01); const n = 5 + ph * 2; for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.2 + Math.sin(B.t) * 0.2; this.bl.push({ x: B.x, y: B.y + 40, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220, big: 1 }); } if (ph) this.aimShot(B.x, B.y + 40, 320); this.sfx.tone(180, 0.2, { type: 'square', vol: 0.08, slide: 0.5 }); }
    }
    // player shots
    for (let i = this.sh.length - 1; i >= 0; i--) {
      const s = this.sh[i]; s.x += s.vx * dt; s.y += s.vy * dt; let gone = s.y < -30 || s.x < -20 || s.x > this.W + 20;
      for (let j = this.en.length - 1; j >= 0 && !gone; j--) { const e = this.en[j]; if (e.mode === 'enter' && e.t < 0) continue; if (Math.abs(s.x - e.x) < TYPES[e.type].w * 0.5 && Math.abs(s.y - e.y) < 24) { gone = true; e.hp--; e.hit = 0.08; this.fx.sparks(s.x, s.y, '#bae6fd', 3, 240, 0.25, 9, -Math.PI / 2, 2); if (e.hp <= 0) this.killEnemy(e, j); else this.sfx.tone(520, 0.04, { type: 'square', vol: 0.08 }); } }
      if (!gone && B && Math.abs(s.x - B.x) < 68 && Math.abs(s.y - B.y) < 40) { gone = true; B.hp--; B.hit = 0.06; this.fx.sparks(s.x, s.y, '#fde68a', 3, 260, 0.25, 9, Math.PI / 2, 2); if (B.hp <= 0) { const bonus = Math.round(2000 * Math.max(1, this.wave / 5)); this.award(bonus, 'b'); this.explode(B.x, B.y, '#fb7185', 3); this.pop(B.x, B.y, 'MOTHERSHIP +' + fmt(bonus), '#fde047', 26); this.hitstop(0.18); for (let k = 0; k < 4; k++) this.pus.push({ k: ['spread', 'rapid', 'shield', 'life'][k], x: B.x + (k - 1.5) * 30, y: B.y, t: 0 }); this.boss = null; } }
      if (gone) this.sh.splice(i, 1);
    }
    // enemy bullets
    for (let i = this.bl.length - 1; i >= 0; i--) { const b = this.bl[i]; b.x += b.vx * dt; b.y += b.vy * dt; if (b.y > this.H + 20 || b.y < -30 || b.x < -20 || b.x > this.W + 20) { this.bl.splice(i, 1); continue; } if (this.inv <= 0 && Math.hypot(b.x - this.px, b.y - this.py) < 13) { this.bl.splice(i, 1); this.hitPlayer(); } }
    for (let i = this.pus.length - 1; i >= 0; i--) { const p = this.pus[i]; p.t += dt; p.y += 110 * dt; p.x += Math.sin(p.t * 3) * 20 * dt; if (p.y > this.H + 30) { this.pus.splice(i, 1); continue; } if (Math.hypot(p.x - this.px, p.y - this.py) < 34) { this.pus.splice(i, 1); const D = PU[p.k]; this.pop(p.x, p.y - 20, D.t, D.col, 17); this.fx.ring(p.x, p.y, D.col, 10, 60, 0.4); this.sfx.chord([660, 880, 1320], 0.18, { type: 'triangle', vol: 0.2 }); if (p.k === 'life') this.lives = Math.min(5, this.lives + 1); else this.pw[p.k] = p.k === 'shield' ? 1 : 10; } }
    if (this.py > this.H * 0.4 && Math.random() < 0.6) this.fx.add({ k: 0, x: this.px + rnd(-4, 4), y: this.py + 26, vx: rnd(-14, 14), vy: 140, g: 0, life: 0.28, max: 0.28, c: '#38bdf8', s: 9 });
  }
  aimShot(x, y, sp) { const a = Math.atan2(this.py - y, this.px - x); this.bl.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp }); }
  render(ctx) {
    if (!this.bgc) this.initBg(); const P = this.P, W = this.W, H = this.H; ctx.drawImage(this.bgc, 0, 0, W, H);
    for (const s of this.stars) { ctx.globalAlpha = 0.35 + 0.5 * s.z * (0.6 + 0.4 * Math.sin(this.t * 2 + s.tw)); ctx.fillStyle = '#dbeafe'; const z = 0.8 + s.z * 1.6; ctx.fillRect(s.x, s.y, z, z + s.z * 3); } ctx.globalAlpha = 1;
    ctx.globalAlpha = 0.5; for (const r of this.rocks) spr(ctx, P, r.s, r.x, r.y, r.w, 0, r.r); ctx.globalAlpha = 1;
    // pickups
    for (const p of this.pus) { const D = PU[p.k]; halo(ctx, D.col, p.x, p.y, 34, 0.7 + 0.3 * Math.sin(p.t * 8)); spr(ctx, P, D.s, p.x, p.y, 34, 0, 0, 1); }
    // enemies
    for (const e of this.en) { if (e.mode === 'enter' && e.t < 0) continue; const T = TYPES[e.type]; const diving = e.mode === 'dive'; if (diving) halo(ctx, '#fb7185', e.x, e.y, 36, 0.35); spr(ctx, P, T.s, e.x, e.y, T.w); if (e.hit > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.8; spr(ctx, P, T.s, e.x, e.y, T.w); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; } if (T.hp === 2 && e.hp === 1) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(e.x - 8, e.y - 4, 16, 3); } }
    const B = this.boss; if (B) { halo(ctx, '#fb7185', B.x, B.y, 120, 0.45 + 0.15 * Math.sin(this.t * 5)); spr(ctx, P, 'boss', B.x, B.y, 120, 0, this.t * 0.25); if (B.hit > 0) { ctx.globalCompositeOperation = 'lighter'; spr(ctx, P, 'boss', B.x, B.y, 120, 0, this.t * 0.25, 0.6); ctx.globalCompositeOperation = 'source-over'; }
      const bw = Math.min(260, W - 120); ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(W / 2 - bw / 2, 70, bw, 8); const g = ctx.createLinearGradient(0, 0, bw, 0); g.addColorStop(0, '#fb7185'); g.addColorStop(1, '#fbbf24'); ctx.fillStyle = g; ctx.fillRect(W / 2 - bw / 2, 70, bw * clamp(B.hp / B.max, 0, 1), 8); }
    // shots
    for (const s of this.sh) { spr(ctx, P, this.pw.spread > 0 && s.vx ? 'pl2' : 'pl', s.x, s.y, 7, 30); halo(ctx, '#38bdf8', s.x, s.y, 14, 0.5); }
    for (const b of this.bl) { halo(ctx, '#fb7185', b.x, b.y, b.big ? 22 : 16, 0.9); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.big ? 4.5 : 3.2, 0, TAU); ctx.fill(); }
    // player
    if (!(this.dead > 0)) { const blink = this.inv > 0 && Math.floor(this.inv * 12) % 2 === 0; if (!blink) { halo(ctx, '#38bdf8', this.px, this.py + 28, 26, 0.55 + 0.25 * Math.sin(this.t * 40)); spr(ctx, P, 'ship', this.px, this.py, 56); if (this.pw.shield > 0) { ctx.globalAlpha = 0.7 + 0.2 * Math.sin(this.t * 6); spr(ctx, P, 'shield', this.px, this.py, 84); ctx.globalAlpha = 1; } } }
    // HUD
    this.hud(ctx, { best: this.best, lives: this.lives, maxLives: 5, chip: 'W' + Math.max(1, this.wave), chipColor: 'rgba(59,130,246,.55)' });
    let y = 84; for (const k of ['spread', 'rapid']) if (this.pw[k] > 0) { this.text(ctx, PU[k].t + ' ' + Math.ceil(this.pw[k]), 18, y + 12, { size: 11, color: PU[k].col, glow: PU[k].col }); y += 18; }
    if (this.banner > 0) { const a = Math.min(1, this.banner * 2, (2.2 - this.banner) * 4); ctx.globalAlpha = a; const bs = this.wave % 5 === 0 ? 'MOTHERSHIP' : 'WAVE ' + this.wave; this.text(ctx, bs, W / 2, H * 0.36, { size: 44, align: 'center', color: '#fff', glow: '#60a5fa' }); this.text(ctx, this.wave % 5 === 0 ? 'WAVE ' + this.wave : 'x' + this.mult().toFixed(2) + ' BONUS', W / 2, H * 0.36 + 34, { size: 16, align: 'center', color: '#93c5fd' }); ctx.globalAlpha = 1; }
  }
}

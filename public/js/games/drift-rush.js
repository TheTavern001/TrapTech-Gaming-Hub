// Drift Rush v8 - fully rebuilt top-down drift racer (original code; Kenney Racing Pack CC0 cars/props; procedural WebAudio).
// New in v8: a real slip model (the body angle leads, the velocity direction follows with limited grip), road that curves and
// narrows, tyre smoke + skid marks, oil slicks, slow traffic, nitro canisters, 3 hearts with checkpoint repairs, horizontal split-screen
// steer zones. Hold the left or right half of the screen to steer; hold through corners to build drift points, straighten up to bank them.
// Scoring contract unchanged: score = meters + banked drift, events 'd' (bank) and 'm' (distance).
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, loadPack, spr, halo, bake, roundRect } from './kit.js';
const PX = 10;
export class DriftRush extends Game8 {
  get title() { return 'DRIFT RUSH'; }
  get hint() { return 'Hold the left or right half of the screen to steer. Slide through corners to build drift points, then straighten up to bank them (chains multiply, up to x3). Dodge cones, barrels, oil and traffic. 3 hearts, a checkpoint every 1,500 m repairs one.'; }
  get accent() { return '#f472b6'; }
  get musicOpts() { return { root: 52, bpm: 134, mode: 'minor', seed: 21, vol: 0.3 }; }
  async load() { this.P = await loadPack('drift'); }
  layout() { this.carY = this.H * 0.74; this.hw = Math.max(92, this.W * 0.27); this.base = null; }
  reset() {
    super.reset(); this.layout(); this.score = 0; this.coins = 0; this.D = 0; this.meters = 0; this.x = this.W / 2; this.th = 0; this.ph = 0; this.v = 16; this.hearts = 3; this.inv = 0; this.banked = 0; this.pending = 0; this.chain = 0; this.calm = 0;
    this.items = []; this.deco = []; this.nextItem = 700; this.nextDeco = 100; this.nextCp = 1500; this.nextM = 250; this.skids = []; this.slick = 0; this.nitro = 0; this.steer = 0; this.keyL = 0; this.keyR = 0; this.ptrX = null; this.flash = 0; this.sk = 0;
  }
  amp() { return Math.min(this.W * 0.2, 12 + this.D / 260); }
  cx(d) { return this.W / 2 + this.amp() * (Math.sin(d / 950) + 0.5 * Math.sin(d / 390 + 1.3)); }
  hwAt() { return Math.max(this.hw * 0.7, this.hw - this.meters / 90); }
  onDown(x) { this.ptrX = x; } onMove(x) { if (this.ptrX != null) this.ptrX = x; } onUp() { this.ptrX = null; }
  onKey(c, d) { if (c === 'ArrowLeft' || c === 'KeyA') this.keyL = d ? 1 : 0; if (c === 'ArrowRight' || c === 'KeyD') this.keyR = d ? 1 : 0; }
  mult() { return 1 + Math.min(2, this.chain); }
  hurt(why) {
    if (this.inv > 0) return; this.hearts--; this.inv = 1.5; this.pending = 0; this.chain = 0; this.v *= 0.55; this.flash = 0.35; this.fx.shake(12); this.hitstop(0.06); this.sfx.noise(0.25, { vol: 0.4, freq: 500 });
    this.fx.burst(this.x, this.carY, ['#fff', '#fb923c', '#fde047'], 18, 340, 0.6, 12); this.pop(this.x, this.carY - 50, why, '#f87171', 20);
    if (this.hearts <= 0) { this.score = Math.floor(this.meters + this.banked); this.mark('m', Math.floor(this.meters)); this.kill(1.0, '#f472b6'); }
  }
  spawn() {
    const d = this.nextItem, m = d / PX, r = this.r(), hw = this.hwAt(), c = this.cx(d), roll = r;
    let n = 1; if (m > 600 && this.r() < 0.35) n = 2;
    for (let i = 0; i < n; i++) { const dd = d + i * 110, cc = this.cx(dd), kind = roll < 0.4 ? 'cone' : roll < 0.62 ? 'barrel' : roll < 0.78 ? 'oil' : roll < 0.93 && m > 200 ? 'car' : 'nitro'; const lat = (this.r() * 2 - 1) * (hw - 30);
      this.items.push({ k: kind, d: dd, x: cc + lat, sp: kind === 'car' ? 0.42 : 0, sk: 'car_' + ['blue', 'yellow', 'green', 'black'][Math.floor(this.r() * 4)], rot: this.r() * TAU }); }
    this.nextItem = d + Math.max(240, 520 - m / 6) + this.r() * 220;
  }
  update(dt) {
    const D0 = this.D, m = this.meters, T = this.playT;
    let s = 0; if (this.ptrX != null) s = this.ptrX < this.W / 2 ? -1 : 1; if (this.keyL || this.keyR) s = this.keyR - this.keyL; if (this.slick > 0) { this.slick -= dt; s = -s * 0.8 + Math.sin(T * 14) * 0.4; } this.steer = lerp(this.steer, s, Math.min(1, dt * 12));
    const tang = Math.atan2(this.cx(D0 + 30) - this.cx(D0), 30);
    if (s) this.th = clamp(this.th + this.steer * 3.1 * dt, tang - 1.15, tang + 1.15); else this.th += (tang - this.th) * Math.min(1, dt * 3.2);
    const onRoad = Math.abs(this.x - this.cx(D0)) < this.hwAt() - 4; const grip = (onRoad ? 4.8 : 7) * (this.slick > 0 ? 0.35 : 1); this.ph += (this.th - this.ph) * Math.min(1, dt * grip); const slip = this.th - this.ph;
    const target = 16 + Math.min(34, T * 0.19) + (this.nitro > 0 ? 9 : 0); this.v += (target - this.v) * Math.min(1, dt * 0.8) - (Math.abs(slip) > 0.3 ? this.v * 0.05 * dt : 0); if (!onRoad) this.v = Math.max(12, this.v * (1 - 1.1 * dt)); if (this.nitro > 0) this.nitro -= dt; this.v = Math.min(this.v, 55);
    const sp = this.v * PX; this.x += sp * Math.sin(this.ph) * dt; this.D += sp * Math.cos(this.ph) * dt; this.meters = this.D / PX;
    if (this.inv > 0) this.inv -= dt; if (this.flash > 0) this.flash -= dt;
    // drift scoring: accrual <= 30/s per multiplier step (anti-cheat bound 95/s)
    const drifting = onRoad && Math.abs(slip) > 0.2 && this.v > 14;
    if (drifting) { this.pending += Math.min(30, 60 * Math.abs(slip) * (this.v / 30)) * this.mult() * dt; this.calm = 0; this.sk += dt; this.setLevel(0.5 + Math.min(0.5, this.pending / 400));
      if (this.r() < 0.9) { const bx = this.x - Math.sin(this.th) * 22, bz = this.carY + Math.cos(this.th) * 22; this.fx.smoke(bx - 8, bz, '#cbd5e1', 1, 0.7, 20); this.fx.smoke(bx + 8, bz, '#cbd5e1', 1, 0.7, 20); }
      if (((this.t * 40) | 0) % 2) this.skids.push({ d: this.D, x: this.x, th: this.th });
    } else if (this.pending > 0) { this.calm += dt; if (this.calm > 0.35) { const p = Math.floor(this.pending); this.banked += p; this.mark('d', p); this.pop(this.x, this.carY - 60, `DRIFT +${fmt(p)}`, '#34d399', 22); this.fx.ring(this.x, this.carY, '#34d399', 8, 90, 0.4, 4); this.pending = 0; this.chain = Math.min(3, this.chain + 1); this.nitro = 1.2; this.sfx.tone(660, 0.12, { type: 'triangle', vol: 0.25 }); } }
    else { this.calm += dt; if (this.calm > 3) this.chain = 0; }
    if (this.skids.length > 140) this.skids.splice(0, this.skids.length - 140);
    while (this.nextItem < this.D + 1100) this.spawn(); while (this.nextDeco < this.D + 1100) { const d = this.nextDeco, c = this.cx(d), side = this.r() < 0.5 ? -1 : 1; this.deco.push({ d, x: c + side * (this.hwAt() + 50 + this.r() * 90), k: this.r() < 0.6 ? 'tree' : this.r() < 0.5 ? 'tree2' : 'rock', rot: this.r() * TAU }); this.nextDeco += 80 + this.r() * 120; }
    const rr = 16;
    for (const it of this.items) { it.d += it.sp * sp * dt; const y = this.carY - (it.d - this.D); if (it.gone || y < this.carY - 40 || y > this.carY + 40) continue; const dx = it.x - this.x, dy = y - this.carY;
      if (it.k === 'nitro') { if (Math.hypot(dx, dy) < 28) { it.gone = true; this.nitro = 3; this.coins++; this.pop(this.x, this.carY - 50, 'NITRO', '#22d3ee', 20); this.fx.ring(this.x, this.carY, '#22d3ee', 8, 100, 0.5, 5); this.sfx.chord([660, 990], 0.12, { type: 'triangle', vol: 0.2 }); } }
      else if (it.k === 'oil') { if (Math.hypot(dx, dy) < 42 && this.slick <= 0) { this.slick = 1.1; this.pop(this.x, this.carY - 50, 'SLICK!', '#a78bfa', 18); } }
      else if (Math.hypot(dx, dy) < rr + (it.k === 'car' ? 18 : 15)) { it.gone = true; this.hurt(it.k === 'car' ? 'TRAFFIC' : 'CRASH'); } }
    this.items = this.items.filter(it => !it.gone && this.carY - (it.d - this.D) < this.H + 120); this.deco = this.deco.filter(d => this.carY - (d.d - this.D) < this.H + 100); this.skids = this.skids.filter(k => this.carY - (k.d - this.D) < this.H + 20);
    if (this.meters >= this.nextCp) { this.nextCp += 1500; const heal = this.hearts < 3; if (heal) this.hearts++; this.pop(this.W / 2, this.H * 0.32, heal ? 'CHECKPOINT +1 HEART' : 'CHECKPOINT', '#fde047', 22); this.sfx.chord([523, 784], 0.2, { type: 'triangle', vol: 0.25 }); this.fx.flash('#fde047', 0.15); }
    this.score = Math.floor(this.meters + this.banked); if (this.meters >= this.nextM) { this.nextM += 250; this.mark('m', Math.floor(this.meters)); }
  }
  ground() { return this.gr || (this.gr = bake(128, 128, (g) => { g.fillStyle = '#0c1a2a'; g.fillRect(0, 0, 128, 128); let s = 5; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 140; i++) { g.fillStyle = `rgba(${40 + rr() * 30 | 0},${90 + rr() * 60 | 0},${110 + rr() * 60 | 0},${0.12 + rr() * 0.2})`; g.fillRect(rr() * 128, rr() * 128, 2 + rr() * 6, 2 + rr() * 6); } })); }
  render(ctx) {
    const W = this.W, H = this.H, D = this.D, cy = this.carY; const G = this.ground();
    if (!this.pat) this.pat = ctx.createPattern(G, 'repeat'); ctx.save(); ctx.translate(0, D % 128); ctx.fillStyle = this.pat; ctx.fillRect(0, -128, W, H + 128); ctx.restore();
    const hw = this.hwAt(), step = 8;
    for (let y = H + 8; y > -8; y -= step) { const d = D + (cy - y), c = this.cx(d), stripe = Math.floor(d / 40) % 2;
      ctx.fillStyle = '#1f2433'; ctx.fillRect(c - hw, y, hw * 2, step + 1); ctx.fillStyle = stripe ? '#ef4444' : '#f8fafc'; ctx.fillRect(c - hw - 7, y, 7, step + 1); ctx.fillRect(c + hw, y, 7, step + 1);
      if (Math.floor(d / 60) % 2 === 0) { ctx.fillStyle = 'rgba(250,250,210,.7)'; ctx.fillRect(c - 2, y, 4, step + 1); } }
    ctx.fillStyle = 'rgba(8,10,20,.55)'; for (const k of this.skids) { const y = cy - (k.d - D); ctx.save(); ctx.translate(k.x, y); ctx.rotate(k.th); ctx.fillRect(-12, 14, 4, 8); ctx.fillRect(8, 14, 4, 8); ctx.restore(); }
    for (const d of this.deco) { const y = cy - (d.d - D); spr(ctx, this.P, d.k, d.x, y, d.k === 'tree' ? 92 : d.k === 'tree2' ? 62 : 54, 0, d.k === 'rock' ? d.rot : 0); }
    for (const it of this.items) { const y = cy - (it.d - D); if (y < -80 || y > H + 80) continue;
      if (it.k === 'cone') spr(ctx, this.P, 'cone', it.x, y, 40); else if (it.k === 'barrel') spr(ctx, this.P, 'barrel', it.x, y, 50); else if (it.k === 'oil') spr(ctx, this.P, 'oil', it.x, y, 96, 0, it.rot, 0.9);
      else if (it.k === 'car') spr(ctx, this.P, it.sk, it.x, y, 38); else { halo(ctx, '#22d3ee', it.x, y, 40, 0.8); ctx.fillStyle = '#0891b2'; roundRect(ctx, it.x - 9, y - 14, 18, 28, 5); ctx.fill(); ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 2; ctx.stroke(); this.text(ctx, 'N', it.x, y + 5, { size: 14, color: '#fff', align: 'center' }); } }
    for (const it of this.items) { if (it.k !== 'cone' && it.k !== 'barrel' && it.k !== 'car') continue; const y = cy - (it.d - D); if (y < -10 && y > -420) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(this.t * 12); ctx.fillStyle = '#f87171'; ctx.beginPath(); ctx.moveTo(it.x, 22 + 60); ctx.lineTo(it.x - 9, 72); ctx.lineTo(it.x + 9, 72); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; } }
    // car
    if (!(this.inv > 0 && ((this.t * 14) | 0) % 2)) { halo(ctx, '#fff', this.x + Math.sin(this.th) * -2, cy - 26, 60, 0.18); if (this.nitro > 0) { halo(ctx, '#22d3ee', this.x - Math.sin(this.th) * 26, cy + 30, 50, 0.8); } ctx.save(); ctx.translate(this.x, cy); ctx.rotate(this.th); ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(3, 5, 17, 32, 0, 0, TAU); ctx.fill(); spr(ctx, this.P, 'car_red', 0, 0, 36); ctx.restore(); }
    if (this.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${this.flash})`; ctx.fillRect(0, 0, W, H); }
    this.hud(ctx, { best: this.best, lives: this.hearts, maxLives: 3, chip: 'x' + this.mult(), chipColor: this.mult() > 1 ? 'rgba(52,211,153,.5)' : 'rgba(139,92,246,.45)' });
    this.text(ctx, `${Math.round(this.v * 3.6)} KM/H  ·  ${fmt(this.meters)} m`, W / 2, 80, { size: 11, weight: 800, align: 'center', color: '#b9b3ff', font: 'Exo' });
    if (this.pending > 0) this.text(ctx, `DRIFT +${fmt(this.pending)}  x${this.mult()}`, W / 2, 122, { size: 22, color: '#fde047', align: 'center', glow: '#f59e0b' });
    if (this.state === 'play' && this.playT < 4) { ctx.globalAlpha = 0.5; this.text(ctx, '◀ HOLD', 22, H - 28, { size: 15, color: '#22d3ee' }); this.text(ctx, 'HOLD ▶', W - 22, H - 28, { size: 15, color: '#f472b6', align: 'right' }); ctx.globalAlpha = 1; }
  }
}

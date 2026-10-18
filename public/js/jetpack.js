// Jetpack Dash v8 - portrait-native vertical shaft climber (fully rebuilt, original code + original baked art; procedural WebAudio).
// You rocket UP a neon research shaft. Drag anywhere to steer (the astronaut eases toward your finger / arrow keys). Score = meters climbed.
// Hazards: zapper gates with a gap (gaps shrink, later they slide), buzz saws patrolling rails, homing-column rockets (watch the ! warning),
// shields absorb one hit, coins bank bonus coins. Endless, uncapped, speed ramps. Same scoring contract as before (score = meters, ac perSec 30).
import { Game8, PAL, TAU, rnd, clamp, lerp, halo, bake, roundRect } from './games/kit.js';
const PXM = 24;                          // px per meter
const HR = 15;                           // hero collision radius
export class JetpackDash extends Game8 {
  get title() { return 'JETPACK DASH'; }
  get hint() { return 'Drag anywhere to steer your astronaut up the shaft (or use the arrow keys). Slip through the zapper gaps, dodge saws and rockets (watch the ! warning), grab shields and coins. Score is meters climbed.'; }
  get accent() { return '#22d3ee'; }
  get musicOpts() { return { root: 50, bpm: 128, mode: 'minor', seed: 71, vol: 0.3 }; }
  constructor(c, o) { super(c, o); const r = document.getElementById('rot'); if (r) r.style.display = 'none'; } // portrait-native now: no 'rotate your phone' tip
  layout() { this.hy = this.H * 0.72; this.mk = null; }
  reset() {
    super.reset(); this.layout(); this.score = 0; this.coins = 0; this.dist = 0; this.mps = 8; this.x = this.W / 2; this.vx = 0; this.tx = this.W / 2; this.touch = false; this.keys = 0;
    this.obs = []; this.coinsA = []; this.pick = []; this.rockets = []; this.next = 900; this.nextCoin = 700; this.nextShield = 9000; this.shield = false; this.inv = 0; this.lastM = 0; this.tilt = 0;
  }
  diff() { return clamp(this.dist / PXM / 2200, 0, 1); }
  onDown(x) { this.touch = true; this.tx = x; } onMove(x) { if (this.touch) this.tx = x; } onUp() { this.touch = false; }
  onKey(c, d) { const v = d ? 1 : 0; if (c === 'ArrowLeft' || c === 'KeyA') this.kl = v; if (c === 'ArrowRight' || c === 'KeyD') this.kr = v; }
  // ---- world generation (obstacle y is measured as world distance; screen y = hy - (o.d - dist))
  spawn() {
    const d = this.dist, m = d / PXM, df = this.diff(), W = this.W, at = this.next, roll = this.r();
    if (m > 120 && roll < 0.2 + df * 0.08) { const n = m > 700 && this.r() < 0.4 ? 2 : 1; for (let i = 0; i < n; i++) this.rockets.push({ col: this.range(40, W - 40), t: -i * 0.6, warn: 1.3, y: -40, vy: 0, ph: 'warn' }); this.next = at + 300; return; }
    if (roll < 0.5) { const n = m > 500 && this.r() < 0.45 ? 2 : 1, gap = this.range(110, 150) - df * 14; for (let i = 0; i < n; i++) { const y = at + i * 190; const left = this.r() < 0.5; this.obs.push({ k: 'saw', d: y, x: this.range(60, W - 60), dir: left ? -1 : 1, sp: this.range(70, 110) + df * 80, r: this.range(24, 31), rot: 0, bob: 0 }); } this.next = at + this.range(300, 380) - df * 70; return; }
    const gap = Math.max(96, this.range(168, 205) - df * 70 + (m < 60 ? 30 : 0)), gx = this.range(gap / 2 + 24, W - gap / 2 - 24), mov = m > 260 && this.r() < 0.55 + df * 0.2;
    this.obs.push({ k: 'gate', d: at, gx, gap, mov, ph: this.r() * TAU, amp: Math.min(70, 30 + df * 60), sp: this.range(1, 1.7) + df });
    // coins through the gap
    for (let i = 0; i < 6; i++) this.coinsA.push({ d: at - 60 + i * 38 + 190, x: gx + Math.sin(i * 0.9) * 26, ph: this.r() * TAU });
    this.next = at + this.range(330, 420) - df * 80;
  }
  range(a, b) { return a + this.r() * (b - a); }
  gateX(o) { return o.mov ? clamp(o.gx + Math.sin(this.t * o.sp + o.ph) * o.amp, o.gap / 2 + 14, this.W - o.gap / 2 - 14) : o.gx; }
  hit(x, y) {
    if (this.inv > 0) return;
    if (this.shield) { this.shield = false; this.inv = 1.2; this.fx.ring(this.x, this.hy, '#4fc3ff', 10, 90, 0.5, 5); this.fx.shake(8); this.hitstop(0.05); this.pop(this.x, this.hy - 40, 'SHIELD BROKEN', '#7dd3fc', 16); this.sfx.noise(0.2, { vol: 0.3, freq: 700 }); return; }
    this.fx.burst(this.x, this.hy, ['#fff', '#fb923c', '#fde047'], 26, 360, 0.7, 14); this.fx.ring(this.x, this.hy, '#fb923c', 8, 130, 0.55, 6); this.dying = true; this.kill(1.0, '#f97316');
  }
  update(dt) {
    const df = this.diff(); this.mps = Math.min(22, 8 + this.dist / PXM / 160 + df * 4); const sp = this.mps * PXM;
    // steering
    let tx = this.touch ? this.tx : null; if (this.kl || this.kr) { tx = this.x + (this.kr - this.kl) * 260; this.tx = tx; }
    const want = tx == null ? 0 : clamp((tx - this.x) * 7, -460, 460); this.vx = lerp(this.vx, want, Math.min(1, dt * 9)); this.x = clamp(this.x + this.vx * dt, 20, this.W - 20); this.tilt = lerp(this.tilt, this.vx / 460 * 0.45, Math.min(1, dt * 10));
    this.dist += sp * dt; this.score = Math.floor(this.dist / PXM); if (this.inv > 0) this.inv -= dt;
    this.setLevel(this.mps / 22);
    // exhaust
    if (this.r() < 0.9) this.fx.add({ k: 0, x: this.x - this.tilt * 10, y: this.hy + 26, vx: -this.vx * 0.1 + rnd(-25, 25), vy: rnd(160, 300), g: 0, life: 0.34, max: 0.34, c: this.r() < 0.5 ? '#fde047' : '#fb923c', s: rnd(10, 18) });
    while (this.dist + 900 > this.next) this.spawn();
    if (this.dist + 900 > this.nextCoin) { const n = 7, x0 = this.range(60, this.W - 60), at = this.dist + 900, ty = this.r() < 0.5; for (let i = 0; i < n; i++) this.coinsA.push({ d: at + i * 34, x: clamp(x0 + (ty ? Math.sin(i / 1.4) * 60 : 0), 30, this.W - 30), ph: i }); this.nextCoin = at + this.range(500, 800); }
    if (this.dist + 900 > this.nextShield) { this.pick.push({ d: this.nextShield, x: this.range(50, this.W - 50) }); this.nextShield += this.range(9000, 14000); }
    const sy = (d) => this.hy - (d - this.dist);
    for (const o of this.obs) {
      const y = sy(o.d);
      if (o.k === 'gate') { if (y > this.hy - 12 && y < this.hy + 12 && !this.inv) { const gx = this.gateX(o); if (Math.abs(this.x - gx) > o.gap / 2 - HR * 0.55) this.hit(this.x, y); else if (!o.pass) { o.pass = true; this.fx.sparks(this.x, y, ['#22d3ee', '#fff'], 6, 240, 0.3, 10); } } }
      else if (o.k === 'saw') { o.x += o.dir * o.sp * dt; if (o.x < o.r + 10) { o.x = o.r + 10; o.dir = 1; } else if (o.x > this.W - o.r - 10) { o.x = this.W - o.r - 10; o.dir = -1; } o.rot += dt * 14; if (Math.hypot(o.x - this.x, y - this.hy) < o.r * 0.85 + HR * 0.7) this.hit(o.x, y); }
    }
    for (const c of this.coinsA) { if (c.got) continue; const y = sy(c.d); if (Math.abs(y - this.hy) < 26 && Math.abs(c.x - this.x) < 26) { c.got = true; this.coins++; this.fx.sparks(c.x, y, ['#fde047', '#fff'], 5, 240, 0.3, 8); this.sfx.tone(900 + (this.coins % 8) * 70, 0.05, { type: 'triangle', vol: 0.16 }); } }
    for (const p of this.pick) { if (p.got) continue; const y = sy(p.d); if (Math.abs(y - this.hy) < 30 && Math.abs(p.x - this.x) < 30) { p.got = true; this.shield = true; this.pop(this.x, this.hy - 50, 'SHIELD', '#7dd3fc', 18); this.fx.ring(this.x, this.hy, '#4fc3ff', 6, 70, 0.4, 4); this.sfx.chord([660, 990], 0.14, { type: 'triangle', vol: 0.2 }); } }
    for (const m of this.rockets) {
      m.t += dt;
      if (m.ph === 'warn') { m.col = lerp(m.col, clamp(this.x, 30, this.W - 30), Math.min(1, dt * (m.t < m.warn * 0.7 ? 2.2 : 0)));
        if (m.t >= m.warn) { m.ph = 'fly'; m.y = -40; m.vy = 620 + df * 160; this.sfx.noise(0.25, { vol: 0.2, freq: 1200 }); } }
      else if (m.ph === 'fly') { m.y += m.vy * dt; this.fx.add({ k: 4, x: m.col, y: m.y - 24, vx: rnd(-10, 10), vy: -20, g: 0, life: 0.35, max: 0.35, c: '#cbd5e1', s: 12 }); if (Math.abs(m.col - this.x) < 15 + HR * 0.6 && Math.abs(m.y - this.hy) < 28) { m.ph = 'done'; this.fx.burst(m.col, m.y, ['#fb923c', '#fde047', '#fff'], 14, 300, 0.5, 12); this.hit(m.col, m.y); } else if (m.y > this.H + 60) m.ph = 'done'; }
    }
    this.obs = this.obs.filter(o => sy(o.d) < this.H + 100); this.coinsA = this.coinsA.filter(c => !c.got && sy(c.d) < this.H + 40); this.pick = this.pick.filter(p => !p.got && sy(p.d) < this.H + 40); this.rockets = this.rockets.filter(m => m.ph !== 'done');
    if (this.score - this.lastM >= 250) { this.lastM = this.score; this.pop(this.W / 2, 150, this.score + ' m', '#a5b4fc', 20); this.fx.flash('#6366f1', 0.1); }
  }
  // ---- baked art
  art() {
    if (this.A) return this.A; const A = this.A = {}, W = this.W, H = this.H;
    A.wall = bake(W, 512, (g) => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#0b0f2c'); gr.addColorStop(0.5, '#141a46'); gr.addColorStop(1, '#0b0f2c'); g.fillStyle = gr; g.fillRect(0, 0, W, 512);
      g.strokeStyle = 'rgba(120,140,255,.12)'; g.lineWidth = 1; for (let y = 0; y <= 512; y += 128) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } for (let x = 0; x < W; x += 65) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 512); g.stroke(); }
      g.fillStyle = 'rgba(34,211,238,.5)'; g.fillRect(12, 0, 3, 512); g.fillRect(W - 15, 0, 3, 512); g.fillStyle = 'rgba(167,139,250,.4)'; for (let y = 24; y < 512; y += 128) { g.fillRect(0, y, 26, 6); g.fillRect(W - 26, y, 26, 6); } });
    A.far = bake(W, 512, (g) => { let s = 7; const rr = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 46; i++) { const x = rr() * W, y = rr() * 512, r = rr() * 1.7 + 0.4; g.fillStyle = `rgba(${rr() < 0.5 ? '120,200,255' : '200,160,255'},${0.3 + rr() * 0.5})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); } });
    A.hero = bake(64, 84, (g) => { g.translate(32, 38);
      g.fillStyle = '#f97316'; roundRect(g, -17, -6, 8, 30, 4); g.fill(); roundRect(g, 9, -6, 8, 30, 4); g.fill(); g.fillStyle = '#475569'; g.fillRect(-17, 20, 8, 5); g.fillRect(9, 20, 8, 5);
      const bg = g.createLinearGradient(-12, 0, 12, 0); bg.addColorStop(0, '#cbd5e1'); bg.addColorStop(0.5, '#fff'); bg.addColorStop(1, '#94a3b8'); g.fillStyle = bg; roundRect(g, -12, -8, 24, 34, 9); g.fill();
      g.fillStyle = '#e2e8f0'; g.beginPath(); g.arc(0, -16, 14, 0, TAU); g.fill(); const vg = g.createLinearGradient(-9, -22, 9, -8); vg.addColorStop(0, '#22d3ee'); vg.addColorStop(1, '#6d28d9'); g.fillStyle = vg; g.beginPath(); g.ellipse(0, -16, 9, 7.5, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-3.5, -19, 3, 1.8, -0.5, 0, TAU); g.fill();
      g.strokeStyle = '#94a3b8'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(-12, 0); g.lineTo(-17, 12); g.moveTo(12, 0); g.lineTo(17, 12); g.stroke(); g.fillStyle = '#a78bfa'; g.fillRect(-12, 10, 24, 3); });
    A.saw = bake(80, 80, (g) => { g.translate(40, 40); g.fillStyle = '#cbd5e1'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i / 16 * TAU, r = i % 2 ? 28 : 38; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.fill(); const rg = g.createRadialGradient(-6, -6, 2, 0, 0, 34); rg.addColorStop(0, '#f1f5f9'); rg.addColorStop(1, '#64748b'); g.fillStyle = rg; g.beginPath(); g.arc(0, 0, 28, 0, TAU); g.fill(); g.fillStyle = '#ef4444'; g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.fillStyle = '#7f1d1d'; g.beginPath(); g.arc(0, 0, 5, 0, TAU); g.fill(); });
    A.rocket = bake(30, 62, (g) => { g.translate(15, 31); g.fillStyle = '#e2e8f0'; roundRect(g, -8, -22, 16, 40, 7); g.fill(); g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(-8, 18); g.lineTo(8, 18); g.lineTo(0, 30); g.closePath(); g.fill(); g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, -14); g.lineTo(0, -29); g.closePath(); g.fill(); g.fillStyle = '#22d3ee'; g.beginPath(); g.arc(0, -4, 4, 0, TAU); g.fill(); g.fillStyle = '#475569'; g.fillRect(-12, 6, 5, 12); g.fillRect(7, 6, 5, 12); });
    return A;
  }
  render(ctx) {
    const A = this.art(), W = this.W, H = this.H, sc = this.dist; let y0 = ((sc * 0.25) % 512); ctx.fillStyle = '#060a22'; ctx.fillRect(0, 0, W, H);
    for (let y = y0 - 512; y < H; y += 512) ctx.drawImage(A.far, 0, y);
    y0 = (sc % 512); for (let y = y0 - 512; y < H; y += 512) ctx.drawImage(A.wall, 0, y);
    const sy = (d) => this.hy - (d - this.dist), t = this.t;
    // altitude ticks
    ctx.fillStyle = 'rgba(165,180,255,.5)'; const m0 = Math.floor(this.dist / PXM / 50) * 50; for (let m = m0; m < m0 + 50 + H / PXM; m += 50) { const y = sy(m * PXM); if (y < 70 || y > H) continue; ctx.fillRect(0, y, 26, 2); this.text(ctx, m + 'm', 30, y + 4, { size: 11, color: 'rgba(165,180,255,.6)' }); }
    for (const c of this.coinsA) { if (c.got) continue; const y = sy(c.d); if (y < -20 || y > H + 20) continue; const w = Math.abs(Math.cos(t * 5 + c.ph)); halo(ctx, '#fbbf24', c.x, y, 22, 0.5); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.ellipse(c.x, y, 3 + 8 * w, 9, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#fff7ad'; ctx.lineWidth = 1.5; ctx.stroke(); }
    for (const p of this.pick) { if (p.got) continue; const y = sy(p.d); halo(ctx, '#4fc3ff', p.x, y, 38, 0.7 + 0.2 * Math.sin(t * 6)); ctx.strokeStyle = '#7dd3fc'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, y, 13, 0, TAU); ctx.stroke(); this.text(ctx, 'S', p.x, y + 5, { size: 14, color: '#e0f2fe', align: 'center' }); }
    for (const o of this.obs) {
      const y = sy(o.d); if (y < -90 || y > H + 90) continue;
      if (o.k === 'gate') { const gx = this.gateX(o), l = gx - o.gap / 2, r = gx + o.gap / 2, f = 0.6 + 0.4 * Math.sin(t * 30 + o.ph);
        ctx.fillStyle = '#334155'; ctx.fillRect(0, y - 10, 22, 20); ctx.fillRect(W - 22, y - 10, 22, 20); ctx.fillStyle = '#1e293b'; roundRect(ctx, l - 10, y - 11, 14, 22, 5); ctx.fill(); roundRect(ctx, r - 4, y - 11, 14, 22, 5); ctx.fill();
        for (const [a, b] of [[22, l - 8], [r + 8, W - 22]]) { if (b <= a) continue; halo(ctx, '#22d3ee', (a + b) / 2, y, (b - a) * 0.6 + 16, 0.35 * f); ctx.strokeStyle = '#a5f3fc'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(a, y); for (let x = a; x < b; x += 14) ctx.lineTo(x + 7, y + (((x / 14 | 0) + (t * 30 | 0)) % 2 ? 7 : -7) * f); ctx.lineTo(b, y); ctx.stroke(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke(); }
        halo(ctx, '#f0abfc', l - 3, y, 20, 0.7); halo(ctx, '#f0abfc', r + 3, y, 20, 0.7); }
      else if (o.k === 'saw') { halo(ctx, '#ef4444', o.x, y, o.r * 2.3, 0.3); ctx.save(); ctx.translate(o.x, y); ctx.rotate(o.rot); ctx.drawImage(A.saw, -o.r * 1.3, -o.r * 1.3, o.r * 2.6, o.r * 2.6); ctx.restore(); }
    }
    for (const m of this.rockets) { if (m.ph === 'warn') { const a = 0.5 + 0.5 * Math.sin(t * 18); ctx.globalAlpha = a; ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.moveTo(m.col, 96); ctx.lineTo(m.col - 14, 70); ctx.lineTo(m.col + 14, 70); ctx.closePath(); ctx.fill(); this.text(ctx, '!', m.col, 66, { size: 20, color: '#fff', align: 'center' }); ctx.globalAlpha = 0.12 * a; ctx.fillRect(m.col - 14, 100, 28, H); ctx.globalAlpha = 1; } else if (m.ph === 'fly') { halo(ctx, '#fb923c', m.col, m.y - 30, 30, 0.8); ctx.save(); ctx.translate(m.col, m.y); ctx.rotate(Math.PI); ctx.drawImage(A.rocket, -15, -31); ctx.restore(); } }
    // hero
    if (!(this.inv > 0 && ((t * 14) | 0) % 2)) { halo(ctx, '#22d3ee', this.x, this.hy, 44, 0.25); ctx.save(); ctx.translate(this.x, this.hy); ctx.rotate(this.tilt); ctx.drawImage(A.hero, -32, -38); ctx.restore(); }
    if (this.shield) { halo(ctx, '#4fc3ff', this.x, this.hy, 52, 0.55); ctx.strokeStyle = 'rgba(125,211,252,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.x, this.hy, 30, 0, TAU); ctx.stroke(); }
    this.hud(ctx, { label: 'METERS', unit: ' m', best: this.best, chip: '◎ ' + this.coins, chipColor: 'rgba(251,191,36,.35)' });
    if (this.state === 'play' && this.playT < 4) this.text(ctx, 'DRAG TO STEER', W / 2, H - 40, { size: 15, color: '#c4b5fd', align: 'center', glow: '#7c3aed' });
  }
}

// Drift Rush - top-down neon drift racer. Original procedural code/art.
import { Game, TAU, rnd, clamp, roundRect, fmt } from './engine.js';
const PX = 10; // px per meter
export class DriftRush extends Game {
  get title() { return 'DRIFT RUSH'; }
  get hint() { return 'Hold left/right side (or arrows / A-D) to steer. Slide through curves to build drift points, straighten out to bank them. Stay on the road!'; }
  layout() { this.carY = this.H * 0.74; }
  reset() {
    this.score = 0; this.coins = 0; this.dist = 0; this.meters = 0; this.x = this.W / 2; this.th = 0; this.ph = 0; this.v = 20;
    this.timeLeft = 45; this.nextCp = 1000; this.banked = 0; this.pending = 0; this.chain = 0; this.calm = 0; this.boost = 0; this.hit = 0;
    this.items = []; this.nextCone = 900; this.nextOrb = 1400; this.skids = []; this.touch = {}; this.keyL = false; this.keyR = false; this.flash = 0;
  }
  hw(d) { return Math.max(80, 160 - (d / PX) / 40); }
  cx(d) { const hw = this.hw(d); const A = Math.max(0, this.W / 2 - hw - 18) * Math.min(1, 0.3 + (d / PX) / 1500); return this.W / 2 + A * (0.6 * Math.sin(d * 0.0021) + 0.4 * Math.sin(d * 0.0049 + 1.3)); }
  mult() { return Math.min(4, 1 + this.chain); }
  steer() { let s = 0; for (const k in this.touch) s += this.touch[k]; if (this.keyL) s -= 1; if (this.keyR) s += 1; return clamp(s, -1, 1); }
  onDown(x, y, e) { this.touch[e.pointerId] = x < this.W / 2 ? -1 : 1; }
  onMove(x, y, e) { if (this.touch[e.pointerId] !== undefined) this.touch[e.pointerId] = x < this.W / 2 ? -1 : 1; }
  onUp(x, y, e) { delete this.touch[e.pointerId]; }
  onKey(code, down) { if (code === 'ArrowLeft' || code === 'KeyA') this.keyL = down; if (code === 'ArrowRight' || code === 'KeyD') this.keyR = down; }
  crash(msg) {
    if (this.pending > 0) this.pop(this.x, this.carY - 50, `${msg}  -${fmt(this.pending)}`, '#f87171', 20); else this.pop(this.x, this.carY - 50, msg, '#f87171', 20);
    this.pending = 0; this.chain = 0; this.v = Math.max(16, this.v * 0.5); this.hit = 0.7; this.flash = 0.3; this.th *= 0.3; this.ph *= 0.3;
    this.burst(this.x, this.carY, ['#f472b6', '#fde047', '#fff'], 18, 260, 0.5, 4); this.sfx.noise(0.25, { vol: 0.4, freq: 500 });
  }
  update(dt) {
    if (this.flash > 0) this.flash -= dt; if (this.hit > 0) this.hit -= dt; if (this.boost > 0) this.boost -= dt;
    this.timeLeft -= dt; if (this.timeLeft <= 0) { this.timeLeft = 0; if (this.pending > 0) { this.banked += this.pending; this.pending = 0; } this.score = Math.floor(this.meters + this.banked); this.sfx.win(); this.finish(); return; }
    const s = this.steer();
    this.th = clamp(this.th + s * 2.6 * dt, -0.95, 0.95); if (!s) this.th -= this.th * Math.min(1, 2.2 * dt);
    this.ph += (this.th - this.ph) * Math.min(1, 3.0 * dt);
    const target = this.boost > 0 ? 65 : clamp(22 + this.playT * 0.9, 22, 55);
    this.v += (target - this.v) * Math.min(1, (this.boost > 0 ? 2.5 : 0.6) * dt);
    const da = Math.abs(this.th - this.ph); this.v *= 1 - 0.12 * da * dt;
    const sp = this.v * PX; this.x += sp * Math.sin(this.ph) * dt; const fwd = sp * Math.cos(this.ph) * dt; this.dist += fwd; this.meters = this.dist / PX;
    // drift scoring
    if (da > 0.22 && this.v > 24 && this.hit <= 0) {
      this.pending += this.v * 0.4 * this.mult() * Math.min(1, da / 0.5) * dt; this.calm = 0;
      if (Math.random() < 0.6) { const bx = this.x - Math.sin(this.th) * 22, by = this.carY + Math.cos(this.th) * 22; this.parts.push({ x: bx + rnd(-8, 8), y: by, vx: rnd(-30, 30), vy: rnd(40, 90), life: 0.6, max: 0.6, c: 'rgba(196,181,253,0.55)', s: rnd(5, 10), g: -20 }); }
      this.skids.push({ d: this.dist, x: this.x - Math.sin(this.th) * 18 });
    } else if (this.pending > 0) { this.calm += dt; if (this.calm > 0.3) { const p = Math.floor(this.pending); this.banked += p; this.pop(this.x, this.carY - 60, `DRIFT +${fmt(p)}`, '#34d399', 22); this.pending = 0; this.chain = Math.min(3, this.chain + 1); this.sfx.tone(660, 0.1, { type: 'triangle', vol: 0.3 }); this.sfx.tone(990, 0.12, { type: 'triangle', vol: 0.25, delay: 0.08 }); } }
    if (this.skids.length > 400) this.skids.splice(0, this.skids.length - 400);
    // road bounds
    const c = this.cx(this.dist), hw = this.hw(this.dist);
    if (Math.abs(this.x - c) > hw - 12) { this.x = c + Math.sign(this.x - c) * (hw - 16); if (this.hit <= 0) this.crash('OFF ROAD'); }
    // spawn items ahead
    const ahead = this.dist + this.H;
    while (this.nextCone < ahead) { const d = this.nextCone; const h = this.hw(d); this.items.push({ t: 'cone', d, x: this.cx(d) + rnd(-h * 0.72, h * 0.72) }); this.nextCone += rnd(260, 420) - Math.min(140, this.meters / 25); }
    while (this.nextOrb < ahead) { const d = this.nextOrb; const h = this.hw(d); this.items.push({ t: 'orb', d, x: this.cx(d) + rnd(-h * 0.6, h * 0.6) }); this.nextOrb += rnd(900, 1500); }
    for (const it of this.items) {
      if (it.gone) continue; const dy = it.d - this.dist;
      if (Math.abs(dy) < 20 && Math.abs(it.x - this.x) < 22) {
        it.gone = true;
        if (it.t === 'cone') { if (this.hit <= 0) this.crash('CONE'); }
        else { this.coins++; this.boost = 2.2; this.timeLeft += 1; this.pop(it.x, this.carY - 40, 'NITRO +1s', '#22d3ee', 22); this.burst(it.x, this.carY, ['#22d3ee', '#a855f7'], 16, 240, 0.5, 4); this.sfx.tone(440, 0.25, { type: 'sawtooth', vol: 0.2, slide: 2.2 }); }
      }
    }
    this.items = this.items.filter(it => !it.gone && it.d > this.dist - 200);
    if (this.meters >= this.nextCp) { this.nextCp += 1000; this.timeLeft += 10; this.pop(this.W / 2, this.H * 0.35, 'CHECKPOINT +10s', '#fde047', 26); this.sfx.win(); }
    this.score = Math.floor(this.meters + this.banked);
  }
  render(ctx) {
    ctx.fillStyle = '#070516'; ctx.fillRect(0, 0, this.W, this.H);
    const off = this.dist % 40; ctx.strokeStyle = 'rgba(99,102,241,0.09)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < this.W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); } for (let y = off - 40; y < this.H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); } ctx.stroke();
    const step = 10; const L = [], R = [], C = [];
    for (let y = -step; y <= this.H + step; y += step) { const d = this.dist + (this.carY - y); const c = this.cx(d), h = this.hw(d); L.push([c - h, y]); R.push([c + h, y]); C.push([c, y, d]); }
    ctx.beginPath(); L.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, this.H); g.addColorStop(0, '#120c33'); g.addColorStop(1, '#1b1446'); ctx.fillStyle = g; ctx.fill();
    for (const [pts, col] of [[L, '#22d3ee'], [R, '#f472b6']]) { ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 4; ctx.shadowColor = col; ctx.shadowBlur = 14; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.restore(); }
    ctx.strokeStyle = 'rgba(253,224,71,0.45)'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 1; i < C.length; i++) { if (Math.floor(C[i][2] / 60) % 2) continue; ctx.moveTo(C[i - 1][0], C[i - 1][1]); ctx.lineTo(C[i][0], C[i][1]); } ctx.stroke();
    // checkpoint line
    const cpD = this.nextCp * PX; const cpY = this.carY - (cpD - this.dist); if (cpY > -10 && cpY < this.H) { const c = this.cx(cpD), h = this.hw(cpD); for (let i = 0; i < 12; i++) { ctx.fillStyle = i % 2 ? '#fff' : '#111'; ctx.fillRect(c - h + (2 * h / 12) * i, cpY - 6, 2 * h / 12, 12); } }
    // skids
    ctx.fillStyle = 'rgba(15,10,30,0.7)'; for (const s of this.skids) { const y = this.carY - (s.d - this.dist); if (y > this.H) continue; ctx.fillRect(s.x - 2, y, 4, 4); }
    for (const it of this.items) {
      const y = this.carY - (it.d - this.dist); if (y < -30 || y > this.H + 30) continue;
      if (it.t === 'cone') { ctx.save(); ctx.translate(it.x, y); ctx.fillStyle = '#fb923c'; ctx.shadowColor = '#fb923c'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(11, 11); ctx.lineTo(-11, 11); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.fillStyle = '#fff'; ctx.fillRect(-6, 0, 12, 3); ctx.restore(); }
      else { const p = 1 + Math.sin(this.t * 8) * 0.12; ctx.save(); ctx.translate(it.x, y); ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 20; ctx.fillStyle = '#22d3ee'; ctx.beginPath(); ctx.arc(0, 0, 11 * p, 0, TAU); ctx.fill(); ctx.fillStyle = '#0b1030'; ctx.font = '900 12px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('N', 0, 1); ctx.restore(); }
    }
    // car
    ctx.save(); ctx.translate(this.x, this.carY); ctx.rotate(this.th); if (this.hit > 0 && Math.floor(this.t * 20) % 2) ctx.globalAlpha = 0.5;
    if (this.boost > 0) { ctx.fillStyle = '#22d3ee'; ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 20; ctx.beginPath(); ctx.moveTo(-7, 22); ctx.lineTo(0, 22 + rnd(18, 34)); ctx.lineTo(7, 22); ctx.fill(); }
    ctx.shadowColor = '#a855f7'; ctx.shadowBlur = 18; ctx.fillStyle = '#7c3aed'; roundRect(ctx, -13, -24, 26, 48, 7); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#c4b5fd'; roundRect(ctx, -10, -12, 20, 14, 4); ctx.fill(); ctx.fillStyle = '#22d3ee'; ctx.fillRect(-11, -24, 6, 3); ctx.fillRect(5, -24, 6, 3);
    ctx.fillStyle = '#f472b6'; ctx.fillRect(-11, 21, 6, 3); ctx.fillRect(5, 21, 6, 3); ctx.fillStyle = '#0b0820'; for (const [wx, wy] of [[-15, -15], [11, -15], [-15, 8], [11, 8]]) ctx.fillRect(wx, wy, 4, 10);
    ctx.restore();
    if (this.flash > 0) { ctx.fillStyle = `rgba(239,68,68,${this.flash})`; ctx.fillRect(0, 0, this.W, this.H); }
    // HUD
    this.hudScore(ctx);
    const tl = Math.ceil(this.timeLeft); this.text(ctx, 'TIME', this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, `${tl}s`, this.W - 18, 62, { size: 30, weight: 900, align: 'right', color: tl <= 10 ? '#f87171' : '#fff', glow: tl <= 10 ? '#ef4444' : '#22d3ee' });
    this.text(ctx, `${Math.round(this.v * 3.6)} KM/H  ${fmt(this.meters)} m`, this.W - 18, 82, { size: 12, weight: 700, align: 'right', color: '#b9b3ff', font: 'Exo' });
    if (this.pending > 0) this.text(ctx, `DRIFT +${fmt(this.pending)}  x${this.mult()}`, this.W / 2, 128, { size: 22, weight: 900, align: 'center', color: '#fde047', glow: '#f59e0b' });
    else if (this.chain > 0) this.text(ctx, `CHAIN x${this.mult()}`, this.W / 2, 128, { size: 16, weight: 800, align: 'center', color: '#c4b5fd' });
    if (this.state === 'play' && this.playT < 4) { ctx.globalAlpha = 0.5; this.text(ctx, '◀ HOLD', 24, this.H - 30, { size: 16, color: '#22d3ee' }); this.text(ctx, 'HOLD ▶', this.W - 24, this.H - 30, { size: 16, color: '#f472b6', align: 'right' }); ctx.globalAlpha = 1; }
  }
}

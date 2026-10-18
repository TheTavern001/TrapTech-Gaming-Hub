// Memory Match v8 - endless timed pairs. Rebuilt: baked neon glass card atlas (15 glyph faces + holographic back, drawn once), 3D-style flip with
// light sweep, match shockwaves, combo flame meter, board-clock ring bar, confetti clears. Deal, clocks and scoring mirror src/anticheat.js
// replayMemory exactly (the server replays the tap log from the seed), so the verified rules are unchanged.
import { Game8, PAL, TAU, rnd, clamp, lerp, fmt, shuffle, halo, bake, roundRect, mix, lighten, shade } from './kit.js';
const LEVELS = [[4, 3], [4, 4], [5, 4], [6, 4], [6, 5]];
const GLYPHS = ['star', 'heart', 'diamond', 'bolt', 'moon', 'crown', 'hex', 'ring', 'tri', 'plus', 'drop', 'note', 'flame', 'square', 'spark'];
const GCOL = ['#fde047', '#f472b6', '#22d3ee', '#facc15', '#c4b5fd', '#fbbf24', '#34d399', '#60a5fa', '#fb7185', '#a3e635', '#38bdf8', '#e879f9', '#fb923c', '#5eead4', '#f0abfc'];
export const boardTime = (level, pairs) => +(pairs * Math.max(1.3, 4.2 * Math.pow(0.95, level))).toFixed(2);
const CW = 160, CH = 206;
function glyph(ctx, name, s, col) {
  ctx.save(); ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineWidth = s * 0.16; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const P = (pts, fill = true) => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.closePath(); fill ? ctx.fill() : ctx.stroke(); };
  switch (name) {
    case 'star': { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 0.45 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } P(p); break; }
    case 'heart': ctx.beginPath(); ctx.moveTo(0, s * 0.9); ctx.bezierCurveTo(-s * 1.3, 0, -s * 0.7, -s * 1.1, 0, -s * 0.35); ctx.bezierCurveTo(s * 0.7, -s * 1.1, s * 1.3, 0, 0, s * 0.9); ctx.fill(); break;
    case 'diamond': P([[0, -1], [0.75, 0], [0, 1], [-0.75, 0]]); break;
    case 'bolt': P([[0.2, -1], [-0.6, 0.15], [-0.05, 0.15], [-0.25, 1], [0.6, -0.2], [0.05, -0.2]]); break;
    case 'moon': ctx.beginPath(); ctx.arc(0, 0, s, 0.5, TAU - 0.5); ctx.arc(s * 0.45, -s * 0.1, s * 0.75, TAU - 0.9, 0.9, true); ctx.fill(); break;
    case 'crown': P([[-1, 0.7], [-1, -0.5], [-0.5, 0.05], [0, -0.85], [0.5, 0.05], [1, -0.5], [1, 0.7]]); break;
    case 'hex': { const p = []; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; p.push([Math.cos(a), Math.sin(a)]); } P(p, false); break; }
    case 'ring': ctx.beginPath(); ctx.arc(0, 0, s * 0.8, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.3, 0, TAU); ctx.fill(); break;
    case 'tri': P([[0, -0.95], [0.95, 0.75], [-0.95, 0.75]], false); break;
    case 'plus': P([[-0.3, -1], [0.3, -1], [0.3, -0.3], [1, -0.3], [1, 0.3], [0.3, 0.3], [0.3, 1], [-0.3, 1], [-0.3, 0.3], [-1, 0.3], [-1, -0.3], [-0.3, -0.3]]); break;
    case 'drop': ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, 0, s * 0.8, s, 0, s); ctx.bezierCurveTo(-s * 0.8, s, -s * 0.9, 0, 0, -s); ctx.fill(); break;
    case 'note': ctx.beginPath(); ctx.ellipse(-s * 0.35, s * 0.55, s * 0.38, s * 0.28, -0.4, 0, TAU); ctx.fill(); ctx.fillRect(-s * 0.05, -s, s * 0.16, s * 1.5); P([[0.08, -1], [0.75, -0.65], [0.75, -0.35], [0.08, -0.65]]); break;
    case 'flame': ctx.beginPath(); ctx.moveTo(0, -s); ctx.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.8, s, 0, s); ctx.bezierCurveTo(-s * 0.8, s, -s * 0.9, 0, -s * 0.2, -s * 0.4); ctx.bezierCurveTo(-s * 0.1, -s * 0.1, s * 0.1, -s * 0.5, 0, -s); ctx.fill(); break;
    case 'square': ctx.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); ctx.fillRect(-s * 0.35, -s * 0.35, s * 0.7, s * 0.7); break;
    default: { ctx.beginPath(); for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * s, Math.sin(a) * s); } ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, s * 0.25, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}
function bakeCards() {
  return bake(CW * 4, CH * 4, (g) => {
    for (let i = 0; i < 16; i++) {
      const cx = (i % 4) * CW, cy = Math.floor(i / 4) * CH; g.save(); g.translate(cx, cy); roundRect(g, 3, 3, CW - 6, CH - 6, 22);
      if (i === 15) { // back
        const gr = g.createLinearGradient(0, 0, CW, CH); gr.addColorStop(0, '#5b21b6'); gr.addColorStop(0.5, '#3730a3'); gr.addColorStop(1, '#0e7490'); g.fillStyle = gr; g.fill(); g.save(); g.clip();
        g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 2; for (let k = -CH; k < CW + CH; k += 22) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + CH, CH); g.stroke(); g.beginPath(); g.moveTo(k + CH, 0); g.lineTo(k, CH); g.stroke(); }
        const sh = g.createLinearGradient(0, 0, 0, CH * 0.5); sh.addColorStop(0, 'rgba(255,255,255,.28)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, CW, CH * 0.5); g.restore();
        g.strokeStyle = 'rgba(196,181,253,.9)'; g.lineWidth = 3; roundRect(g, 3, 3, CW - 6, CH - 6, 22); g.stroke(); g.strokeStyle = 'rgba(103,232,249,.5)'; g.lineWidth = 1.5; roundRect(g, 12, 12, CW - 24, CH - 24, 15); g.stroke();
        g.translate(CW / 2, CH / 2); g.rotate(Math.PI / 4); g.fillStyle = 'rgba(8,10,40,.65)'; g.fillRect(-26, -26, 52, 52); g.strokeStyle = '#a5f3fc'; g.lineWidth = 2.5; g.strokeRect(-26, -26, 52, 52); g.rotate(-Math.PI / 4); g.font = '900 30px Orbitron,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText('TT', 0, 2);
      } else {
        const col = GCOL[i], bg = g.createLinearGradient(0, 0, 0, CH); bg.addColorStop(0, mix('#101a4a', col, 0.22)); bg.addColorStop(1, '#070b26'); g.fillStyle = bg; g.fill(); g.save(); g.clip();
        const rg = g.createRadialGradient(CW / 2, CH / 2, 0, CW / 2, CH / 2, CW * 0.7); rg.addColorStop(0, col + '66'); rg.addColorStop(1, col + '00'); g.fillStyle = rg; g.fillRect(0, 0, CW, CH);
        const sh = g.createLinearGradient(0, 0, 0, CH * 0.45); sh.addColorStop(0, 'rgba(255,255,255,.2)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sh; g.fillRect(0, 0, CW, CH * 0.45); g.restore();
        g.strokeStyle = col; g.lineWidth = 3.5; roundRect(g, 3, 3, CW - 6, CH - 6, 22); g.stroke();
        g.save(); g.translate(CW / 2, CH / 2); g.shadowColor = col; g.shadowBlur = 24; glyph(g, GLYPHS[i], 44, col); g.shadowBlur = 8; glyph(g, GLYPHS[i], 44, '#ffffffcc'); g.restore();
        g.save(); g.translate(24, 26); glyph(g, GLYPHS[i], 9, col); g.restore(); g.save(); g.translate(CW - 24, CH - 26); glyph(g, GLYPHS[i], 9, col); g.restore();
      }
      g.restore();
    }
  });
}
export class MemoryMatch extends Game8 {
  get title() { return 'MEMORY MATCH'; }
  get hint() { return 'Memorize the cards, then tap two at a time to find the pairs. Chain matches without a miss for up to a x5 combo. Every board has its own clock and every new board is bigger or faster. The run ends when a board clock runs out.'; }
  get startOnTapOnly() { return true; }
  get accent() { return '#e879f9'; }
  get musicOpts() { return { root: 62, bpm: 96, mode: 'major', seed: 7, vol: 0.28 }; }
  async load() { this.atlas = bakeCards(); }
  reset() { super.reset(); this.used = 0; this.score = 0; this.coins = 0; this.level = 0; this.time = 0; this.combo = 0; this.bestCombo = 0; this.pairs = 0; this.confetti = []; this.newLevel(); }
  newLevel() {
    const [c, r] = LEVELS[Math.min(this.level, LEVELS.length - 1)]; this.cols = c; this.rows = r; const n = c * r / 2, ids = [], pool = shuffle(GLYPHS.map((_, i) => i), this.r).slice(0, n);
    for (const i of pool) ids.push(i, i); shuffle(ids, this.r); this.cards = ids.map((g, k) => ({ g, k, open: false, done: false, flip: 0, shake: 0, glow: 0 }));
    this.time = boardTime(this.level, n); this.maxTime = this.time; this.sel = []; this.lock = 0; this.peek = this.level === 0 ? 1.6 : 1.2; this.clearT = 0; this.layout(); this.setLevel(this.level / 12);
  }
  layout() {
    if (!this.cards) return; let c = this.cols, r = this.rows; if (this.portrait && c > r) [c, r] = [r, c]; this.gc = c; this.gr = r; const top = 118, bot = this.H - 24, aw = this.W - 28, ah = bot - top;
    const cw = Math.min(aw / c, (ah / r) * 0.78), ch = cw / 0.78; this.cellW = cw; this.cellH = ch; this.gx = (this.W - cw * c) / 2; this.gy = top + (ah - ch * r) / 2;
  }
  rect(k) { const c = k % this.gc, r = Math.floor(k / this.gc), p = 5; return [this.gx + c * this.cellW + p, this.gy + r * this.cellH + p, this.cellW - p * 2, this.cellH - p * 2]; }
  onDown(x, y) { if (this.peek > 0 || this.lock > 0 || this.clearT > 0) return; for (const cd of this.cards) { const [rx, ry, rw, rh] = this.rect(cd.k); if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) { this.pick(cd); return; } } }
  onKey() {}
  pick(cd) {
    if (cd.open || cd.done || this.sel.length >= 2) return; cd.open = true; this.sel.push(cd); this.log.push([Math.round(this.used * 1000), cd.k]); this.sfx.tone(600 + this.sel.length * 120, 0.06, { type: 'triangle', vol: 0.22 });
    if (this.sel.length === 2) {
      const [a, b] = this.sel;
      if (a.g === b.g) {
        a.done = b.done = true; a.glow = b.glow = 1; this.combo = Math.min(5, this.combo + 1); this.bestCombo = Math.max(this.bestCombo, this.combo); this.pairs++; const pts = this.award(100 * this.combo, 'p');
        for (const q of [a, b]) { const [rx, ry, rw, rh] = this.rect(q.k); this.fx.ring(rx + rw / 2, ry + rh / 2, GCOL[q.g], 6, rw * 0.9, 0.5, 4); this.fx.sparks(rx + rw / 2, ry + rh / 2, [GCOL[q.g], '#fff'], 10, 320, 0.5, 14); }
        const [rx, ry, rw] = this.rect(b.k); this.pop(rx + rw / 2, ry, `+${pts}${this.combo > 1 ? ` x${this.combo}` : ''}`, this.combo >= 3 ? '#fde047' : '#34d399', 24); this.fx.shake(1 + this.combo); this.sfx.chord([660, 990, 1320].slice(0, 2 + (this.combo > 2 ? 1 : 0)), 0.15, { type: 'triangle', vol: 0.22 }); this.sel = [];
        if (this.cards.every(c => c.done)) this.cleared();
      } else { this.combo = 0; this.lock = 0.55; a.shake = b.shake = 0.3; this.sfx.tone(220, 0.15, { type: 'sawtooth', vol: 0.14 }); }
    }
  }
  cleared() {
    const bonus = Math.round(Math.max(0, this.time)) * 10 + 50 * (this.level + 1); this.award(bonus, 'c'); this.coins++; this.pop(this.W / 2, this.H / 2, `BOARD CLEAR +${fmt(bonus)}`, '#fde047', 30); this.sfx.win(); this.fx.flash('#a78bfa', 0.25); this.hitstop(0.05);
    for (let i = 0; i < 46; i++) this.confetti.push({ x: this.W / 2 + rnd(-30, 30), y: this.H * 0.4, vx: rnd(-320, 320), vy: rnd(-520, -120), r: Math.random() * TAU, vr: rnd(-9, 9), c: GCOL[i % GCOL.length], life: 1.6 }); this.clearT = 1.1;
  }
  update(dt) {
    for (const f of this.confetti) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; f.r += f.vr * dt; f.life -= dt; } this.confetti = this.confetti.filter(f => f.life > 0);
    for (const c of this.cards) { const tgt = c.open || c.done ? 1 : 0; c.flip += (tgt - c.flip) * Math.min(1, dt * 14); if (c.shake > 0) c.shake -= dt; if (c.glow > 0) c.glow -= dt * 1.4; }
    if (this.peek > 0) { this.peek -= dt; return; }
    if (this.clearT > 0) { this.clearT -= dt; if (this.clearT <= 0) { this.level++; this.newLevel(); } return; }
    this.time -= dt; this.used += dt; if (this.lock > 0) { this.lock -= dt; if (this.lock <= 0) { for (const c of this.sel) c.open = false; this.sel = []; } }
    if (this.time < 6 && Math.floor(this.time * 2) !== Math.floor((this.time + dt) * 2)) this.sfx.tone(900, 0.05, { type: 'square', vol: 0.08 });
    if (this.time <= 0) { this.time = 0; this.kill(0.8, '#f472b6'); }
  }
  initBg() { this.bgc = bake(Math.round(this.W / 2), Math.round(this.H / 2), (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#0a0824'); gr.addColorStop(1, '#14083a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (const [x, y, r, c] of [[0.15, 0.25, 0.6, '#6d28d9'], [0.9, 0.7, 0.6, '#0e7490'], [0.5, 1, 0.5, '#9d174d']]) { const rg = g.createRadialGradient(x * w, y * h, 0, x * w, y * h, r * w); rg.addColorStop(0, c + '88'); rg.addColorStop(1, c + '00'); g.fillStyle = rg; g.fillRect(0, 0, w, h); } g.strokeStyle = 'rgba(165,180,252,.06)'; g.lineWidth = 1; for (let x = 0; x < w; x += 20) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); } for (let y = 0; y < h; y += 20) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); } }); }
  render(ctx) {
    if (!this.bgc) this.initBg(); const W = this.W, H = this.H; ctx.drawImage(this.bgc, 0, 0, W, H);
    for (const c of this.cards) {
      let [x, y, w, h] = this.rect(c.k); const f = this.peek > 0 ? 1 : c.flip, face = f > 0.5, s = Math.max(0.04, Math.abs(Math.cos(f * Math.PI))); if (c.shake > 0) x += Math.sin(c.shake * 60) * 4;
      if (c.glow > 0) halo(ctx, GCOL[c.g], x + w / 2, y + h / 2, w * 0.95, c.glow);
      const idx = face ? c.g : 15; ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, 1); if (c.done && c.glow <= 0) ctx.globalAlpha = 0.5; ctx.drawImage(this.atlas, (idx % 4) * CW, Math.floor(idx / 4) * CH, CW, CH, -w / 2, -h / 2, w, h);
      if (s < 0.9) { ctx.globalAlpha = (1 - s) * 0.5; ctx.fillStyle = '#000'; ctx.fillRect(-w / 2, -h / 2, w, h); } ctx.restore();
      if (c.done) { ctx.strokeStyle = 'rgba(52,211,153,.7)'; ctx.lineWidth = 2; roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 12); ctx.stroke(); }
    }
    for (const f of this.confetti) { ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.r); ctx.globalAlpha = Math.min(1, f.life); ctx.fillStyle = f.c; ctx.fillRect(-4, -2, 8, 4); ctx.restore(); } ctx.globalAlpha = 1;
    this.hud(ctx, { best: this.best, chip: 'x' + Math.max(1, this.combo), chipColor: this.combo >= 3 ? 'rgba(251,191,36,.6)' : 'rgba(139,92,246,.45)' });
    // board clock bar
    const bw = W - 20, k = clamp(this.time / this.maxTime, 0, 1), low = this.time < 10; ctx.fillStyle = 'rgba(0,0,0,.45)'; roundRect(ctx, 10, 66, bw, 12, 6); ctx.fill(); const g = ctx.createLinearGradient(10, 0, 10 + bw, 0); g.addColorStop(0, low ? '#ef4444' : '#22d3ee'); g.addColorStop(1, low ? '#f97316' : '#a855f7'); ctx.fillStyle = g; roundRect(ctx, 10, 66, Math.max(10, bw * k), 12, 6); ctx.fill();
    this.text(ctx, this.time.toFixed(1) + 's', W / 2, 90, { size: 12, color: low ? '#fca5a5' : '#c7d2fe', align: 'center' }); this.text(ctx, 'BOARD ' + (this.level + 1), 18, 90, { size: 11, color: '#a5b4fc' }); this.text(ctx, this.cols * this.rows / 2 + ' PAIRS', W - 18, 90, { size: 11, color: '#a5b4fc', align: 'right' });
    if (this.peek > 0 && this.state === 'play') this.text(ctx, 'MEMORIZE!', W / 2, this.gy - 10, { size: 18, color: '#fde047', align: 'center', glow: '#fde047' });
  }
}

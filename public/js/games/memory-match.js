// Memory Match - v5 art: real photo card faces (rawpixel / Wikimedia public-domain + CC0 photos), velvet card backs + walnut table (Poly Haven CC0).
// Card identities are still glyph indexes (the server replays the deal from the seed), only the artwork changed. See /CREDITS.md
import { Game, TAU, rnd, clamp, roundRect, fmt, shuffle, loadArt, cover, Ambient } from './engine.js';
// v6: new velvet + gold-foil card back with embossed medallion (original), animated lounge ambience.
const LEVELS = [[4, 3], [4, 4], [5, 4], [6, 4], [6, 5]];
const GLYPHS = ['star', 'heart', 'diamond', 'bolt', 'moon', 'crown', 'hex', 'ring', 'tri', 'plus', 'drop', 'note', 'flame', 'square', 'spark'];
const GCOL = ['#fde047', '#f472b6', '#22d3ee', '#facc15', '#c4b5fd', '#fbbf24', '#34d399', '#60a5fa', '#fb7185', '#a3e635', '#38bdf8', '#e879f9', '#fb923c', '#5eead4', '#f0abfc'];
// photo face per glyph index (index order must not change: it is part of the replay-verified deal)
const PHOTOS = ['lime', 'orange', 'lemon', 'grapefruit', 'coin', 'leaf', 'target', 'darts', 'roulette', 'chips', 'boombox', 'controller', 'dice', 'headphones', 'vinyl'];
// v7 endless: board clock = pairs x max(1.3, 4.2 x 0.95^board) seconds
export const boardTime = (level, pairs) => +(pairs * Math.max(1.3, 4.2 * Math.pow(0.95, level))).toFixed(2);
export class MemoryMatch extends Game {
  async load() { this.amb = new Ambient('lounge', 17); const m = { table: 'mm-table.webp', back: '/assets/v6/mm-back.webp' }; PHOTOS.forEach((n, i) => { m['f' + i] = `mm-${n}.webp`; }); this.art = await loadArt(m); }
  get title() { return 'MEMORY MATCH'; }
  get hint() { return 'Memorize the cards, then tap two at a time to find the pairs. Chain matches for up to a x5 combo. Each board has its own clock, and every new board is bigger or faster. The run ends when a board clock runs out.'; }
  get startOnTapOnly() { return true; }
  reset() { this.used = 0; this.score = 0; this.coins = 0; this.level = 0; this.time = 0; this.combo = 0; this.bestCombo = 0; this.pairs = 0; this.newLevel(); }
  newLevel() {
    let [c, r] = LEVELS[Math.min(this.level, LEVELS.length - 1)]; this.cols = c; this.rows = r;
    // v5: dealt from the server seed (same algorithm as src/anticheat.js) so the run can be replayed + verified
    const n = c * r / 2; const ids = []; const pool = shuffle(GLYPHS.map((_, i) => i), this.r).slice(0, n);
    for (const i of pool) ids.push(i, i); shuffle(ids, this.r);
    this.cards = ids.map((g, k) => ({ g, k, open: false, done: false, flip: 0, shake: 0 }));
    this.time = boardTime(this.level, n); // v7: each board has its own clock (mirrored by src/anticheat.js replayMemory)
    this.sel = []; this.lock = 0; this.peek = this.level === 0 ? 1.6 : 1.2; this.clearT = 0; this.layout();
  }
  layout() {
    if (!this.cards) return;
    let c = this.cols, r = this.rows; if (this.portrait && c > r) [c, r] = [r, c];
    this.gc = c; this.gr = r; const top = 110, bot = this.H - 20; const aw = this.W - 30, ah = bot - top;
    const cw = Math.min(aw / c, (ah / r) * 0.78); const ch = cw / 0.78; const gw = cw * c, gh = ch * r;
    this.cellW = cw; this.cellH = ch; this.gx = (this.W - gw) / 2; this.gy = top + (ah - gh) / 2;
  }
  rect(k) { const c = k % this.gc, r = Math.floor(k / this.gc); const p = 5; return [this.gx + c * this.cellW + p, this.gy + r * this.cellH + p, this.cellW - p * 2, this.cellH - p * 2]; }
  onDown(x, y) {
    if (this.peek > 0 || this.lock > 0 || this.clearT > 0) return;
    for (const cd of this.cards) {
      const [rx, ry, rw, rh] = this.rect(cd.k);
      if (x >= rx && x <= rx + rw && y >= ry && y <= ry + rh) { this.pick(cd); return; }
    }
  }
  onKey() {}
  pick(cd) {
    if (cd.open || cd.done || this.sel.length >= 2) return;
    cd.open = true; this.sel.push(cd); this.log.push([Math.round(this.used * 1000), cd.k]); this.sfx.tone(600 + this.sel.length * 120, 0.06, { type: 'triangle', vol: 0.25 });
    if (this.sel.length === 2) {
      const [a, b] = this.sel;
      if (a.g === b.g) {
        a.done = b.done = true; this.combo = Math.min(5, this.combo + 1); this.bestCombo = Math.max(this.bestCombo, this.combo); this.pairs++;
        const pts = this.award(100 * this.combo, 'p'); const [rx, ry, rw] = this.rect(b.k);
        this.pop(rx + rw / 2, ry, `+${pts}${this.combo > 1 ? ` x${this.combo}` : ''}`, this.combo >= 3 ? '#fde047' : '#34d399', 24);
        this.burst(rx + rw / 2, ry + this.cellH / 2, [GCOL[a.g], '#fff'], 14, 200, 0.5, 4); this.sfx.chord([660, 990], 0.15, { type: 'triangle', vol: 0.25 });
        this.sel = [];
        if (this.cards.every(c => c.done)) this.cleared();
      } else { this.combo = 0; this.lock = 0.55; a.shake = b.shake = 0.3; this.sfx.tone(220, 0.15, { type: 'sawtooth', vol: 0.15 }); }
    }
  }
  cleared() {
    const bonus = Math.round(Math.max(0, this.time)) * 10 + 50 * (this.level + 1); this.award(bonus, 'c'); this.coins++;
    this.pop(this.W / 2, this.H / 2, `BOARD CLEAR +${fmt(bonus)}`, '#fde047', 30); this.sfx.win();
    this.burst(this.W / 2, this.H / 2, ['#fde047', '#22d3ee', '#f472b6', '#a855f7'], 50, 460, 1, 5);
    this.clearT = 1.1;
  }
  update(dt) {
    if (this.peek > 0) { this.peek -= dt; return; }
    if (this.clearT > 0) { this.clearT -= dt; if (this.clearT <= 0) { this.level++; this.newLevel(); } return; }
    this.time -= dt; this.used += dt;
    if (this.lock > 0) { this.lock -= dt; if (this.lock <= 0) { for (const c of this.sel) c.open = false; this.sel = []; } }
    for (const c of this.cards) { const tgt = c.open || c.done ? 1 : 0; c.flip += (tgt - c.flip) * Math.min(1, dt * 14); if (c.shake > 0) c.shake -= dt; }
    if (this.time <= 0) { this.time = 0; this.sfx.lose(); this.finish(); }
  }
  render(ctx) {
    const A = this.art || {}; this.photoBg(ctx, A.table, 'rgba(8,5,4,0.35)');
    for (const c of this.cards) {
      let [x, y, w, h] = this.rect(c.k); const f = this.peek > 0 ? 1 : c.flip;
      const face = f > 0.5; const s = Math.max(0.04, Math.abs(Math.cos(f * Math.PI)));
      if (c.shake > 0) x += Math.sin(c.shake * 60) * 4;
      ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(s, 1);
      roundRect(ctx, -w / 2, -h / 2, w, h, 12);
      const ph = A['f' + c.g];
      if (face && ph) { ctx.save(); ctx.clip(); cover(ctx, ph, -w / 2, -h / 2, w, h); if (c.done) { ctx.fillStyle = 'rgba(16,185,129,0.22)'; ctx.fillRect(-w / 2, -h / 2, w, h); } ctx.restore(); roundRect(ctx, -w / 2, -h / 2, w, h, 12); ctx.strokeStyle = c.done ? '#34d399' : '#f5f5f4'; ctx.lineWidth = c.done ? 4 : 3; ctx.shadowColor = c.done ? '#34d399' : 'rgba(0,0,0,0.6)'; ctx.shadowBlur = c.done ? 16 : 8; ctx.stroke(); ctx.shadowBlur = 0; }
      else if (!face && A.back) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3; ctx.fillStyle = '#3b0d4d'; ctx.fill(); ctx.restore(); ctx.save(); roundRect(ctx, -w / 2, -h / 2, w, h, 12); ctx.clip(); cover(ctx, A.back, -w / 2, -h / 2, w, h); ctx.restore(); roundRect(ctx, -w / 2, -h / 2, w, h, 12); ctx.strokeStyle = 'rgba(234,179,8,0.85)'; ctx.lineWidth = 2; ctx.stroke(); roundRect(ctx, -w / 2 + 6, -h / 2 + 6, w - 12, h - 12, 8); ctx.strokeStyle = 'rgba(234,179,8,0.35)'; ctx.lineWidth = 1; ctx.stroke(); this.text(ctx, 'TT', 0, Math.min(w, h) * 0.1, { size: Math.min(w, h) * 0.26, weight: 900, align: 'center', color: 'rgba(250,204,21,0.85)' }); }
      else if (face) { ctx.fillStyle = c.done ? 'rgba(52,211,153,0.16)' : '#111a46'; ctx.fill(); ctx.strokeStyle = c.done ? '#34d399' : GCOL[c.g]; ctx.lineWidth = 2.5; ctx.shadowColor = ctx.strokeStyle; ctx.shadowBlur = c.done ? 16 : 8; ctx.stroke(); ctx.shadowBlur = 0; this.glyph(ctx, c.g, Math.min(w, h) * 0.3); }
      else { const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2); g.addColorStop(0, '#6d28d9'); g.addColorStop(1, '#1d4ed8'); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(196,181,253,0.7)'; ctx.lineWidth = 2; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,0.18)'; ctx.lineWidth = 1; for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(-w / 2, i * h / 6); ctx.lineTo(w / 2, i * h / 6 + h / 3); ctx.stroke(); }
        this.text(ctx, '?', 0, 9, { size: Math.min(w, h) * 0.32, weight: 900, align: 'center', color: 'rgba(255,255,255,0.8)' }); }
      ctx.restore();
    }
    this.hudScore(ctx);
    const tl = Math.max(0, this.time); const low = tl < 10;
    this.text(ctx, 'TIME', this.W / 2, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'center' });
    this.text(ctx, tl.toFixed(1), this.W / 2, 64, { size: 32, weight: 900, align: 'center', color: low ? '#f87171' : '#fff', glow: low ? '#ef4444' : '#22d3ee' });
    this.text(ctx, `LEVEL ${this.level + 1}`, this.W - 18, 30, { size: 12, weight: 700, color: '#9aa3d0', align: 'right' });
    this.text(ctx, `x${Math.max(1, this.combo)}`, this.W - 18, 62, { size: 28, weight: 900, align: 'right', color: this.combo >= 3 ? '#fde047' : '#fff', glow: '#a855f7' });
    this.text(ctx, 'COMBO', this.W - 18, 82, { size: 11, weight: 700, color: '#b9b3ff', align: 'right' });
    if (this.peek > 0 && this.state === 'play') this.text(ctx, 'MEMORIZE!', this.W / 2, this.gy - 8, { size: 18, weight: 900, align: 'center', color: '#fde047', glow: '#fde047' });
  }
  glyph(ctx, i, s) {
    const name = GLYPHS[i]; ctx.save(); ctx.fillStyle = GCOL[i]; ctx.strokeStyle = GCOL[i]; ctx.lineWidth = s * 0.16; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.shadowColor = GCOL[i]; ctx.shadowBlur = 12;
    const P = (pts, fill = true) => { ctx.beginPath(); pts.forEach(([x, y], k) => k ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)); ctx.closePath(); fill ? ctx.fill() : ctx.stroke(); };
    switch (name) {
      case 'star': { const p = []; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5; const r = k % 2 ? 0.45 : 1; p.push([Math.cos(a) * r, Math.sin(a) * r]); } P(p); break; }
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
}

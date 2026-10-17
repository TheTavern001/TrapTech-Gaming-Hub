// Core-game kit (v8, original code). Shared by the 13 rebuilt core games: baked glow sprites, pooled additive FX,
// screen shake / hit-stop / slow-mo, a unified glass HUD + start card in the hub palette, procedural music, atlas packs.
// Everything is canvas-2D, allocation-light (pooled particles, pre-baked sprites) and capped for mid phones.
import { Game, TAU, rnd, clamp, lerp, roundRect, fmt, seeded, reducedMotion } from './engine.js';
export { TAU, rnd, clamp, lerp, roundRect, fmt, seeded, reducedMotion };
export const PAL = { bg: '#050714', bg2: '#0a1030', purple: '#8b5cf6', violet: '#a855f7', blue: '#3b82f6', cyan: '#22d3ee', green: '#34d399', gold: '#fbbf24', red: '#ef4444', pink: '#f472b6', text: '#eef0ff', muted: '#9aa3d0' };
// ---------- atlas packs: /assets/v8/<name>.js = { i: data-URI webp, f: { sprite: [x,y,w,h] } } ----------
const _packs = {};
export function loadPack(name) {
  if (_packs[name]) return _packs[name];
  return (_packs[name] = import('/assets/v8/' + name + '.js').then(m => new Promise((res) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res({ img, f: m.default.f }); img.onerror = () => res(null); img.src = m.default.i; })).catch(() => null));
}
// draw sprite centred at (x,y) with width w (height from aspect unless h), optional rotation / alpha / flip
export function spr(ctx, P, name, x, y, w, h, rot = 0, a = 1, flip = false) {
  const f = P && P.f[name]; if (!f) return false; const hh = h || w * f[3] / f[2];
  if (a !== 1) ctx.globalAlpha *= a;
  if (rot || flip) { ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-1, 1); ctx.drawImage(P.img, f[0], f[1], f[2], f[3], -w / 2, -hh / 2, w, hh); ctx.restore(); }
  else ctx.drawImage(P.img, f[0], f[1], f[2], f[3], x - w / 2, y - hh / 2, w, hh);
  if (a !== 1) ctx.globalAlpha /= a; return true;
}
export const aspect = (P, name) => { const f = P && P.f[name]; return f ? f[3] / f[2] : 1; };
// ---------- baked glow / light sprites ----------
const _glow = {};
export function glowSpr(color) {
  if (color.length === 4) color = '#' + color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
  if (_glow[color]) return _glow[color]; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.18, color); gr.addColorStop(0.5, color + '55'); gr.addColorStop(1, color + '00');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (_glow[color] = c);
}
// additive light blob
export function halo(ctx, color, x, y, r, a = 1) { const o = ctx.globalCompositeOperation, ga = ctx.globalAlpha; ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = ga * a; ctx.drawImage(glowSpr(color), x - r, y - r, r * 2, r * 2); ctx.globalCompositeOperation = o; ctx.globalAlpha = ga; }
// baked vertical gradient strip, reused as sky / panel background
export function bake(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); return c; }
export function vgrad(stops, w = 4, h = 256) { return bake(w, h, (g) => { const gr = g.createLinearGradient(0, 0, 0, h); stops.forEach(([o, c]) => gr.addColorStop(o, c)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); }
// glossy rounded "jewel" tile baked once per colour: bevel + inner glow + specular streak
const _jewel = {};
export function jewel(color, w, h, r = 8, dark = '#0b0f2a') {
  const k = color + w + 'x' + h + r; if (_jewel[k]) return _jewel[k]; const dpr = 2; const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
  roundRect(g, 1, 1, w - 2, h - 2, r); const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, lighten(color, 0.45)); gr.addColorStop(0.45, color); gr.addColorStop(1, shade(color, 0.55)); g.fillStyle = gr; g.fill();
  g.lineWidth = 1.5; g.strokeStyle = shade(color, 0.35); g.stroke();
  g.save(); roundRect(g, 1, 1, w - 2, h - 2, r); g.clip();
  const sp = g.createLinearGradient(0, 0, 0, h * 0.55); sp.addColorStop(0, 'rgba(255,255,255,.65)'); sp.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = sp; roundRect(g, 3, 2.5, w - 6, h * 0.42, r * 0.7); g.fill();
  const ed = g.createLinearGradient(0, h, 0, h * 0.6); ed.addColorStop(0, 'rgba(255,255,255,.25)'); ed.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = ed; g.fillRect(0, h * 0.6, w, h * 0.4); g.restore();
  return (_jewel[k] = c);
}
export function hex2rgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
export function mix(a, b, t) { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(lerp(v, B[i], t)).toString(16).padStart(2, '0')).join(''); }
export const lighten = (c, t) => mix(c, '#ffffff', t); export const shade = (c, t) => mix(c, '#000000', t);
// ---------- pooled FX ----------
// kinds: 0 glow dot, 1 spark streak, 2 ring, 3 debris square (rotating), 4 sprite-free smoke puff
export class Fx {
  constructor(max = 260) { this.p = []; this.max = max; this.shakeM = 0; this.flashA = 0; this.flashC = '#fff'; this.hs = 0; }
  clear() { this.p.length = 0; this.shakeM = 0; this.flashA = 0; this.hs = 0; }
  add(o) { if (this.p.length >= this.max) this.p.shift(); this.p.push(o); return o; }
  burst(x, y, color, n = 12, sp = 240, life = 0.55, size = 10) { const cols = Array.isArray(color) ? color : [color]; for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(sp * 0.25, sp); this.add({ k: 0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, life, max: life, c: cols[i % cols.length], s: rnd(size * 0.5, size) }); } }
  sparks(x, y, color, n = 10, sp = 380, life = 0.4, len = 14, ang = null, spread = TAU) { const cols = Array.isArray(color) ? color : [color]; for (let i = 0; i < n; i++) { const a = (ang == null ? Math.random() * TAU : ang + (Math.random() - 0.5) * spread), v = rnd(sp * 0.3, sp); this.add({ k: 1, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 260, life, max: life, c: cols[i % cols.length], s: len * rnd(0.6, 1.1) }); } }
  ring(x, y, color, r0 = 6, r1 = 60, life = 0.4, w = 3) { this.add({ k: 2, x, y, vx: 0, vy: 0, g: 0, life, max: life, c: color, s: r0, e: r1, w }); }
  debris(x, y, color, n = 8, sp = 260, life = 0.8, size = 7) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(sp * 0.2, sp); this.add({ k: 3, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - sp * 0.3, g: 700, life, max: life, c: color, s: rnd(size * 0.5, size), r: Math.random() * TAU, vr: rnd(-8, 8) }); } }
  smoke(x, y, color = '#9aa3d0', n = 3, life = 0.7, size = 18) { for (let i = 0; i < n; i++) this.add({ k: 4, x: x + rnd(-4, 4), y, vx: rnd(-20, 20), vy: rnd(-50, -15), g: -10, life, max: life, c: color, s: size * rnd(0.6, 1) }); }
  shake(m) { this.shakeM = Math.max(this.shakeM, reducedMotion() ? m * 0.2 : m); }
  flash(c, a = 0.35) { this.flashC = c; this.flashA = Math.max(this.flashA, reducedMotion() ? a * 0.3 : a); }
  update(dt) {
    const a = this.p; let j = 0;
    for (let i = 0; i < a.length; i++) { const q = a[i]; q.life -= dt; if (q.life <= 0) continue; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.g * dt; if (q.k === 3) q.r += q.vr * dt; a[j++] = q; }
    a.length = j; this.shakeM *= Math.pow(0.0006, dt); if (this.shakeM < 0.2) this.shakeM = 0; this.flashA = Math.max(0, this.flashA - dt * 1.6);
  }
  draw(ctx) {
    const a = this.p; if (!a.length) return; const og = ctx.globalAlpha;
    for (const q of a) {
      const t = q.life / q.max;
      if (q.k === 0) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t; const s = q.s * (0.4 + t * 0.9); ctx.drawImage(glowSpr(q.c), q.x - s, q.y - s, s * 2, s * 2); }
      else if (q.k === 1) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t; ctx.strokeStyle = q.c; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; const m = Math.hypot(q.vx, q.vy) || 1; ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx / m * q.s * t, q.y - q.vy / m * q.s * t); ctx.stroke(); }
      else if (q.k === 2) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = t * 0.9; ctx.strokeStyle = q.c; ctx.lineWidth = q.w * t + 0.5; ctx.beginPath(); ctx.arc(q.x, q.y, lerp(q.e, q.s, t), 0, TAU); ctx.stroke(); }
      else if (q.k === 3) { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = Math.min(1, t * 2); ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.c; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, q.s * 0.7); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(-q.s / 2, -q.s / 2, q.s, 2); ctx.restore(); }
      else { ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = t * 0.35; const s = q.s * (2 - t); ctx.drawImage(glowSpr(q.c), q.x - s, q.y - s, s * 2, s * 2); }
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = og;
  }
}
// ---------- procedural music: bass + arp + kick/hat, tempo & layers follow game intensity ----------
const MODES = { minor: [0, 3, 7, 10, 12, 15, 19], dorian: [0, 3, 7, 9, 12, 14, 17], major: [0, 4, 7, 9, 12, 16, 19] };
export class Music {
  constructor(sfx, o = {}) { this.sfx = sfx; this.root = o.root || 55; this.mode = MODES[o.mode || 'minor']; this.bpm = o.bpm || 112; this.vol = o.vol == null ? 0.5 : o.vol; this.on = false; this.step = 0; this.next = 0; this.level = 0; this.seed = o.seed || 3; this.lead = o.lead || 'triangle'; }
  start() { this.on = true; const ac = this.sfx._ctx(); this.next = ac ? ac.currentTime + 0.1 : 0; this.step = 0; }
  stop() { this.on = false; }
  tick() {
    if (!this.on || this.sfx.muted) return; const ac = this.sfx.ac; if (!ac || ac.state !== 'running') return;
    const spb = 60 / (this.bpm * (1 + this.level * 0.12)) / 2; // eighth notes
    while (this.next < ac.currentTime + 0.12) {
      const s = this.step++, t = this.next, bar = Math.floor(s / 16), i = s % 16;
      const deg = [0, 0, 3, 5, 0, 0, 7, 3][bar % 8] ; const root = this.root * Math.pow(2, deg / 12);
      if (i % 4 === 0) this.n(root * (bar % 2 ? 1 : 1), spb * 1.8, 'sine', 0.55 * this.vol, t, 0.5); // kick-ish bass
      if (i % 2 === 0 && this.level > 0.15) this.n(root * 2, spb * 0.9, 'sawtooth', 0.14 * this.vol, t, 0.8);
      const k = (s * 7 + this.seed * 13 + bar * 5) % this.mode.length; if ((i % 2 === 1 || this.level > 0.5) && (s * 31 + this.seed) % 5 !== 0) this.n(root * 4 * Math.pow(2, this.mode[k] / 12), spb * 0.85, this.lead, (0.1 + this.level * 0.06) * this.vol, t, 0.3);
      if (i % 2 === 1) this.hat(t, 0.05 * this.vol * (0.5 + this.level));
      this.next += spb;
    }
  }
  n(f, d, type, vol, t, slide) { const ac = this.sfx.ac; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (type === 'sine') o.frequency.exponentialRampToValueAtTime(Math.max(30, f * slide), t + d); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(this.sfx.master); o.start(t); o.stop(t + d + 0.02); }
  hat(t, vol) { const ac = this.sfx.ac; if (!this._nb) { const n = ac.sampleRate * 0.04 | 0; this._nb = ac.createBuffer(1, n, ac.sampleRate); const d = this._nb.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); } const s = ac.createBufferSource(); s.buffer = this._nb; const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000; const g = ac.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(this.sfx.master); s.start(t); }
}
// ---------- Game8: engine Game + FX, shake, hit-stop, HUD, start card, music, death sequence ----------
export class Game8 extends Game {
  get fx() { return this._fx || (this._fx = new Fx()); }
  get musicOpts() { return null; }
  get accent() { return PAL.cyan; }
  get blurb() { return ''; }
  reset() { this.fx.clear(); this.dead = 0; this.hs = 0; this.ts = 1; this.dispScore = 0; this._music && this._music.stop(); }
  setLevel(v) { if (this._music) this._music.level = clamp(v, 0, 1); }
  begin() { super.begin(); if (this.state !== 'play') return; const mo = this.musicOpts; if (mo) { this._music = this._music || new Music(this.sfx, mo); this._music.start(); } }
  pause(v = true) { super.pause(v); if (this._music) { if (this.state === 'paused') this._music.stop(); else if (this.state === 'play') this._music.start(); } }
  finish() { if (this._music) this._music.stop(); super.finish(); }
  destroy() { if (this._music) this._music.stop(); super.destroy(); }
  restart() { super.restart(); }
  // start the death sequence: slow-mo, shake, flash, then finish() after `delay` seconds
  kill(delay = 0.9, color = PAL.red) { if (this.dead > 0 || this.state !== 'play') return; this.dead = delay; this.fx.shake(14); this.fx.flash(color, 0.45); this.sfx.lose(); if (this._music) this._music.stop(); this.onDeath && this.onDeath(); }
  hitstop(s = 0.06) { this.hs = Math.max(this.hs, s); }
  frame(dt) {
    this.t += dt;
    if (this._music) this._music.tick();
    if (this.state === 'play') {
      this.playT += dt;
      if (this.dead > 0) { this.dead -= dt; this.fx.update(dt * 0.4); this.dyingUpdate && this.dyingUpdate(dt * 0.4); if (this.dead <= 0) { this.dead = -1; this.finish(); } }
      else { let d = dt; if (this.hs > 0) { this.hs -= dt; d = dt * 0.08; } this.update(d * (this.ts || 1)); this.fx.update(dt); }
    } else if (this.state !== 'paused') this.fx.update(dt);
    if (this.state !== 'paused') { this._parts(dt); if (this.amb) this.amb.update(dt); }
    this.dispScore += ((this.score || 0) - this.dispScore) * Math.min(1, dt * 10); if (Math.abs((this.score || 0) - this.dispScore) < 1) this.dispScore = this.score || 0;
    this.draw();
  }
  draw() {
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = PAL.bg; ctx.fillRect(0, 0, this.c.width, this.c.height);
    const sm = this.fx.shakeM, sx = sm ? (Math.random() - 0.5) * sm : 0, sy = sm ? (Math.random() - 0.5) * sm : 0;
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox + sx * this.scale, this.oy + sy * this.scale);
    ctx.save(); ctx.beginPath(); ctx.rect(-20, -20, this.W + 40, this.H + 40); ctx.clip();
    this.render(ctx); this.fx.draw(ctx);
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); const sc = 1 + Math.max(0, p.life - 0.7) * 1.5; this.text(ctx, p.text, p.x, p.y, { size: p.size * sc, color: p.color, align: 'center', glow: p.color }); }
    ctx.globalAlpha = 1;
    if (this.fx.flashA > 0.01) { ctx.globalAlpha = this.fx.flashA; ctx.fillStyle = this.fx.flashC; ctx.fillRect(0, 0, this.W, this.H); ctx.globalAlpha = 1; }
    if (this.vig === undefined) this.vig = null; if (!this._vg || this._vgW !== this.W || this._vgH !== this.H) { this._vgW = this.W; this._vgH = this.H; this._vg = bake(64, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, h * 0.28, w / 2, h / 2, h * 0.75); gr.addColorStop(0, 'rgba(3,5,18,0)'); gr.addColorStop(1, 'rgba(3,5,18,.55)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }); }
    ctx.drawImage(this._vg, 0, 0, this.W, this.H);
    ctx.restore();
    if (this.state === 'ready') this.center(ctx, this.title, this.hint, 'TAP TO START');
    if (this.state === 'paused') this.center(ctx, 'PAUSED', 'Tap Resume to keep playing');
  }
  // HUD: glass pill with score, optional best, lives (hearts), combo chip. y offset keeps it clear of the page top bar
  hud(ctx, o = {}) {
    const x = 10, y = 10, w = this.W - 20, h = 48; const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(26,22,66,.78)'); g.addColorStop(1, 'rgba(6,14,38,.72)');
    roundRect(ctx, x, y, w, h, 16); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(139,92,246,.55)'; ctx.lineWidth = 1.2; ctx.stroke();
    this.text(ctx, o.label || 'SCORE', x + 14, y + 17, { size: 9, weight: 800, color: PAL.muted });
    this.text(ctx, fmt(this.dispScore) + (o.unit || ''), x + 14, y + 39, { size: 22, weight: 900, color: '#fff', glow: this.accent });
    if (o.best != null) { this.text(ctx, 'BEST', x + w * 0.5, y + 17, { size: 9, weight: 800, color: PAL.muted, align: 'center' }); this.text(ctx, fmt(Math.max(o.best, this.score || 0)), x + w * 0.5, y + 37, { size: 15, weight: 800, color: '#c4b5fd', align: 'center' }); }
    let rx = x + w - 14;
    if (o.lives != null) { for (let i = (o.maxLives || 3) - 1; i >= 0; i--) { this.heart(ctx, rx - 9, y + 17, 8.5, i < o.lives); rx -= 21; } }
    if (o.chip) { const tw = 54; roundRect(ctx, rx - tw, y + 27, tw, 17, 8); ctx.fillStyle = o.chipColor || 'rgba(139,92,246,.45)'; ctx.fill(); this.text(ctx, o.chip, rx - tw / 2, y + 40, { size: 11, weight: 900, color: '#fff', align: 'center' }); }
  }
  heart(ctx, cx, cy, r, full) {
    ctx.save(); ctx.translate(cx, cy); ctx.beginPath(); ctx.moveTo(0, r * 0.9); ctx.bezierCurveTo(-r * 1.6, -r * 0.2, -r * 0.7, -r * 1.2, 0, -r * 0.35); ctx.bezierCurveTo(r * 0.7, -r * 1.2, r * 1.6, -r * 0.2, 0, r * 0.9);
    if (full) { const g = ctx.createLinearGradient(0, -r, 0, r); g.addColorStop(0, '#fda4af'); g.addColorStop(1, '#e11d48'); ctx.fillStyle = g; ctx.shadowColor = '#fb7185'; ctx.shadowBlur = 8; ctx.fill(); } else { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.stroke(); }
    ctx.restore();
  }
  // unified start / pause card (hub purple-cyan), draws over the live scene so the art shows behind it
  center(ctx, title, sub, cta) {
    const W = this.W, H = this.H, cx = W / 2; ctx.save(); ctx.fillStyle = 'rgba(4,6,22,.62)'; ctx.fillRect(0, 0, W, H);
    const pw = Math.min(W - 36, 420), lines = this.wrap(ctx, String(sub || ''), pw - 44, 15); const ph = 128 + lines.length * 21 + (cta ? 62 : 0), py = H * 0.5 - ph / 2;
    const g = ctx.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, 'rgba(32,24,78,.94)'); g.addColorStop(1, 'rgba(8,16,44,.95)'); roundRect(ctx, cx - pw / 2, py, pw, ph, 24); ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(167,139,250,.7)'; ctx.lineWidth = 1.5; ctx.stroke(); halo(ctx, this.accent, cx, py, pw * 0.45, 0.22);
    const big = Math.min(36, pw / (Math.max(6, title.length) * 0.66)); const tg = ctx.createLinearGradient(cx - 140, 0, cx + 140, 0); tg.addColorStop(0, '#c4b5fd'); tg.addColorStop(0.5, '#fff'); tg.addColorStop(1, '#67e8f9');
    ctx.save(); ctx.shadowColor = '#8b5cf6'; ctx.shadowBlur = 20; ctx.font = `900 ${big}px Orbitron,"Exo 2",sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = tg; ctx.fillText(title, cx, py + 48, pw - 30); ctx.restore();
    this.text(ctx, 'TRAP TECH  ·  ARCADE', cx, py + 82, { size: 9, weight: 800, color: '#a5b4fc', align: 'center' });
    lines.forEach((l, i) => this.text(ctx, l, cx, py + 110 + i * 21, { size: 15, weight: 600, color: '#d4d8f5', align: 'center', font: 'Exo' }));
    if (cta) { const by = py + ph - 38, bw = Math.min(260, pw - 60); ctx.globalAlpha = 0.82 + Math.sin(this.t * 4) * 0.18; const bg = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0); bg.addColorStop(0, '#7c3aed'); bg.addColorStop(0.55, '#6366f1'); bg.addColorStop(1, '#22d3ee'); roundRect(ctx, cx - bw / 2, by - 20, bw, 40, 14); ctx.fillStyle = bg; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke(); ctx.globalAlpha = 1; this.text(ctx, cta, cx, by + 5, { size: 14, weight: 900, color: '#fff', align: 'center' }); }
    ctx.restore();
  }
  wrap(ctx, s, maxW, size) { ctx.font = `600 ${size}px "Exo 2",sans-serif`; const out = []; let cur = ''; for (const w of s.split(/\s+/)) { const n = cur ? cur + ' ' + w : w; if (ctx.measureText(n).width > maxW && cur) { out.push(cur); cur = w; } else cur = n; } if (cur) out.push(cur); return out.slice(0, 6); }
}

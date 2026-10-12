import { ls } from '../store.js';
// Shared mini game engine for The Gaming Hub (original code).
// Gives every game the same interface the play page expects:
//   ready (Promise), start(), togglePause(), pause(bool), restart(), endNow(), destroy(), sfx.toggle()/muted
//   opts.onEnd({score, coins, duration_ms}), opts.onState(state)
// Sounds are synthesized with WebAudio (original), no audio files needed.
export const TAU = Math.PI * 2;
export const rnd = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export function roundRect(ctx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
// v5: seeded RNG (mulberry32), identical to src/anticheat.js so the server can replay seeded games
export function seeded(seedHex) { let a = parseInt(String(seedHex || '').slice(0, 8) || '0', 16) >>> 0; if (!seedHex) return Math.random; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function shuffle(arr, r = Math.random) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
// v5: input telemetry (count + rhythm of inputs). Sent with the score so the server can spot bots without hurting real players.
export class Telemetry { constructor() { this.reset(); } reset() { this.n = 0; this.last = 0; this.sum = 0; this.sq = 0; this.min = 0; this.k = 0; }
  hit() { const t = performance.now(); if (this.last) { const d = t - this.last; this.sum += d; this.sq += d * d; this.k++; this.min = this.min ? Math.min(this.min, d) : d; } this.last = t; this.n++; }
  out() { const m = this.k ? this.sum / this.k : 0; return { n: this.n, mean: Math.round(m), sd: Math.round(Math.sqrt(Math.max(0, this.k ? this.sq / this.k - m * m : 0))), min: Math.round(this.min) }; } }
// v5: realistic art helpers (photos/textures from CC0 + public-domain sources, see /CREDITS.md)
export const ART = '/assets/v5/';
const _imgCache = {};
export function loadImg(name) { if (_imgCache[name]) return _imgCache[name]; return (_imgCache[name] = new Promise((res) => { const i = new Image(); i.decoding = 'async'; i.onload = () => res(i); i.onerror = () => res(null); i.src = name.startsWith('/') ? name : ART + name; })); }
export async function loadArt(map) { const out = {}; await Promise.all(Object.entries(map).map(async ([k, n]) => { out[k] = await loadImg(n); })); return out; }
// draw an image to cover a rect (object-fit: cover), optional horizontal scroll offset for parallax panoramas
export function cover(ctx, img, x, y, w, h, scroll = 0) {
  if (!img) return false; const s = Math.max(w / img.width, h / img.height); const iw = img.width * s, ih = img.height * s;
  if (scroll) { let ox = -((scroll % iw) + iw) % iw; for (; ox < w; ox += iw) ctx.drawImage(img, x + ox, y + (h - ih) / 2, iw, ih); return true; }
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih); return true;
}
const _pat = new WeakMap();
export function pattern(ctx, img) { if (!img) return null; let p = _pat.get(img); if (!p) { p = ctx.createPattern(img, 'repeat'); _pat.set(img, p); } return p; }
export const fmt = (n) => Math.floor(n).toLocaleString('en-US');
// ---------- v6 art: WebP sprite atlases (Blender renders, see /CREDITS.md), parallax layers, animated ambience ----------
export const ART6 = '/assets/v6/';
const _atlas = {};
// loads /assets/v6/<name>.webp + <name>.json once per page (lazy: only the games that need an atlas ask for it)
export function loadAtlas(name) {
  if (_atlas[name]) return _atlas[name];
  const base = name.startsWith('/') ? name : ART6 + name; // v7: full paths like /assets/v7/snacks
  return (_atlas[name] = Promise.all([loadImg(base + '.webp'), fetch(base + '.json').then(r => (r.ok ? r.json() : null)).catch(() => null)])
    .then(([img, j]) => (img && j ? { img, f: j.frames, meta: j } : null)));
}
// draw atlas frame into a box; returns false when the art is missing so callers can fall back to vector drawing
export function spr(ctx, A, name, x, y, w, h) { const f = A && A.f[name]; if (!f) return false; ctx.drawImage(A.img, f[0], f[1], f[2], f[3], x, y, w, h); return true; }
// centred, width given, height from the frame aspect (h optional)
export function sprC(ctx, A, name, cx, cy, w, h) { const f = A && A.f[name]; if (!f) return false; const hh = h || w * f[3] / f[2]; ctx.drawImage(A.img, f[0], f[1], f[2], f[3], cx - w / 2, cy - hh / 2, w, hh); return true; }
// realistic thruster flame (pre-rendered once, additive): white-hot core, yellow/orange body, blue base
let _flame = null;
export function flameSprite() {
  if (_flame) return _flame; const c = document.createElement('canvas'); c.width = 64; c.height = 192; const g = c.getContext('2d'); g.globalCompositeOperation = 'lighter';
  const blob = (cy, ry, rx, stops) => { g.save(); g.translate(32, cy); g.scale(rx / ry, 1); const gr = g.createRadialGradient(0, 0, 0, 0, 0, ry); stops.forEach(([o, col]) => gr.addColorStop(o, col)); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, ry, 0, TAU); g.fill(); g.restore(); };
  blob(96, 92, 30, [[0, 'rgba(255,120,30,0.55)'], [0.5, 'rgba(255,60,20,0.22)'], [1, 'rgba(255,40,0,0)']]);
  blob(70, 64, 16, [[0, 'rgba(255,230,140,0.95)'], [0.45, 'rgba(255,170,60,0.6)'], [1, 'rgba(255,90,20,0)']]);
  blob(38, 30, 9, [[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,250,220,0.8)'], [1, 'rgba(255,220,150,0)']]);
  blob(10, 12, 12, [[0, 'rgba(140,200,255,0.9)'], [1, 'rgba(80,120,255,0)']]);
  return (_flame = c);
}
// draw a flame whose nozzle is at (x, y) pointing along angle a (0 = down)
export function drawFlame(ctx, x, y, len, w, a = 0, t = 0) {
  const f = flameSprite(); const fl = 0.85 + 0.15 * Math.sin(t * 61) * Math.sin(t * 23); ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.rotate(a); ctx.drawImage(f, -w / 2, -len * 0.05, w, len * fl); ctx.restore();
}
// cheap pre-baked contact shadow (software-rendered canvases pay a lot for shadowBlur on big sprites)
let _shadow = null;
export function softShadow(ctx, cx, cy, rx, ry, a = 0.5) { if (!_shadow) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _shadow = c; } const o = ctx.globalAlpha; ctx.globalAlpha = o * a; ctx.drawImage(_shadow, cx - rx, cy - ry, rx * 2, ry * 2); ctx.globalAlpha = o; }
export const coinFrame = (t, ph = 0) => 'coin_' + (Math.floor(t * 12 + ph * 8) % 8 + 8) % 8;
export function reducedMotion() { try { return document.documentElement.classList.contains('reduce-motion') || matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } }
// Seamless horizontal parallax layer. The tile is pre-doubled into one offscreen canvas so each frame is a single
// drawImage from a sliding window: no tile edge is ever drawn, so there is no seam even at fractional scales.
export class Layer {
  constructor(img) { this.img = img; if (!img) return; const c = document.createElement('canvas'); c.width = img.width * 2; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); g.drawImage(img, img.width, 0); this.c = c; }
  draw(ctx, off, x, y, w, h) {
    const im = this.img; if (!im) return; const s = h / im.height; const sw = w / s;
    let sx = ((off / s) % im.width + im.width) % im.width;
    if (sw <= im.width) { ctx.drawImage(this.c, sx, 0, sw, im.height, x, y, w, h); return; }
    for (let px = -sx * s; px < w; px += im.width * s) ctx.drawImage(im, x + px, y, im.width * s + 0.6, h);
  }
}
export async function loadLayers(map) { const out = {}; await Promise.all(Object.entries(map).map(async ([k, n]) => { const im = await loadImg(n.startsWith('/') ? n : ART6 + n); out[k] = im ? new Layer(im) : null; })); return out; }
// Subtle animated ambience for the board games: drifting fog, slow light rays, bokeh, dust motes and a neon flicker value.
// Cheap: 2 pattern fills + ~20 small sprite draws per frame. Frozen while paused, static under reduced motion.
const _sprite = (col, size, kind) => { const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r); if (kind === 'bokeh') { gr.addColorStop(0, col + '00'); gr.addColorStop(0.55, col + '30'); gr.addColorStop(0.8, col + '66'); gr.addColorStop(0.9, col + '40'); gr.addColorStop(1, col + '00'); } else { gr.addColorStop(0, '#ffffffff'); gr.addColorStop(0.3, col + 'aa'); gr.addColorStop(1, col + '00'); }
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c; };
export const AMBIENT = {
  lounge: { fog: '#b07cff', fogA: 0.10, cols: ['#ff4fd8', '#7c4dff', '#ffd27a'], rays: '#ffcf8a', raysA: 0.07, bokeh: 12, dust: 18 },
  casino: { fog: '#ff9a4d', fogA: 0.08, cols: ['#ffd27a', '#ff4f6d', '#ffffff'], rays: '#ffd9a0', raysA: 0.08, bokeh: 12, dust: 16 },
  club: { fog: '#38e8ff', fogA: 0.10, cols: ['#38e8ff', '#ff4fd8', '#a3e635'], rays: '#9ff3ff', raysA: 0.07, bokeh: 10, dust: 18 },
  smoke: { fog: '#d9d4ff', fogA: 0.12, cols: ['#a3e635', '#ffd27a', '#38e8ff'], rays: '#e9e4ff', raysA: 0.05, bokeh: 9, dust: 22 },
  arcade: { fog: '#6b7cff', fogA: 0.08, cols: ['#38e8ff', '#ff4fd8', '#ffd23f'], rays: '#b6c2ff', raysA: 0.05, bokeh: 10, dust: 14 },
};
export class Ambient {
  constructor(preset = 'lounge', seed = 7) { this.p = typeof preset === 'string' ? AMBIENT[preset] : preset; this.t = 0; this.flick = 1; this._fl = 0; let a = seed; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
    this.bok = Array.from({ length: this.p.bokeh }, (_, i) => ({ x: r(), y: r(), s: 40 + r() * 90, sp: 4 + r() * 10, ph: r() * 6.28, c: i % this.p.cols.length }));
    this.dust = Array.from({ length: this.p.dust }, () => ({ x: r(), y: r(), s: 1 + r() * 2.2, sp: 6 + r() * 16, ph: r() * 6.28 }));
    this.spr = this.p.cols.map(c => _sprite(c, 128, 'bokeh')); this.dot = _sprite('#ffffff', 16, 'dot');
    const rc = document.createElement('canvas'); rc.width = 64; rc.height = 512; const g = rc.getContext('2d'); const lg = g.createLinearGradient(0, 0, 0, 512); lg.addColorStop(0, this.p.rays + 'ff'); lg.addColorStop(1, this.p.rays + '00'); g.fillStyle = lg;
    g.beginPath(); g.moveTo(26, 0); g.lineTo(38, 0); g.lineTo(64, 512); g.lineTo(0, 512); g.closePath(); g.filter = 'blur(6px)'; g.fill(); this.ray = rc;
    this.ready = loadImg(ART6 + 'fx-fog.webp').then(im => { if (!im) return; const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g2 = c.getContext('2d'); g2.drawImage(im, 0, 0); g2.globalCompositeOperation = 'source-in'; g2.fillStyle = this.p.fog; g2.fillRect(0, 0, c.width, c.height); this.fog = c; });
  }
  update(dt) {
    if (reducedMotion()) { this.flick = 1; return; }
    this.t += dt; this._fl -= dt;
    if (this._fl <= 0) { this._fl = 0.04 + Math.random() * (Math.random() < 0.08 ? 0.06 : 2.5); this.flick = Math.random() < 0.3 ? 0.55 + Math.random() * 0.3 : 1; }
  }
  // call right after drawing the game's backdrop. Everything here is soft, so it is rendered into a quarter-resolution
  // buffer (re-rendered at most ~30x/s, never while frozen) and upscaled with one drawImage: mobile-friendly fill rate.
  draw(ctx, W, H) {
    const q = 0.25, bw = Math.ceil(W * q), bh = Math.ceil(H * q);
    if (!this.buf) { this.buf = document.createElement('canvas'); this.bctx = this.buf.getContext('2d'); }
    const sizeChanged = this.buf.width !== bw || this.buf.height !== bh;
    if (sizeChanged) { this.buf.width = bw; this.buf.height = bh; }
    if (sizeChanged || this._drawnT === undefined || this.t - this._drawnT >= 1 / 30 || this.t < this._drawnT || this._fogOk !== !!this.fog) {
      const b = this.bctx; b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, bw, bh); b.setTransform(q, 0, 0, q, 0, 0); this._paint(b, W, H); this._drawnT = this.t; this._fogOk = !!this.fog;
    }
    // auto-lite: the full-screen upscale is ~free on a GPU canvas but costs real CPU on software-rendered / very slow
    // devices. If this layer alone averages > 3 ms over 40 frames, keep only the top/bottom neon bands (sticky).
    if (this.lite) { const sh = Math.ceil(bh * 0.22); ctx.drawImage(this.buf, 0, 0, bw, sh, 0, 0, W, sh / q); ctx.drawImage(this.buf, 0, bh - sh, bw, sh, 0, H - sh / q, W, sh / q); return; }
    const t0 = performance.now(); ctx.drawImage(this.buf, 0, 0, W, H); const dt = performance.now() - t0;
    this._n = (this._n || 0) + 1; if (this._n > 20) { this._acc = (this._acc || 0) + dt; if (this._n % 40 === 0) { if (this._acc / 40 > 3) this.lite = true; this._acc = 0; } }
  }
  _paint(ctx, W, H) {
    const t = this.t, p = this.p, q = 0.25; ctx.save();
    if (this.fog) { // two fog sheets drifting in different directions at different scales. Each sheet is pre-scaled once to
      // buffer resolution and tiled with plain 1:1 blits (a scaled pattern fill is slow on software-rendered canvases)
      if (!this._fogT) this._fogT = [[1.6, 9, 2, p.fogA], [2.3, -6, -1.5, p.fogA * 0.8]].map(([sc, vx, vy, a]) => { const n = Math.round(512 * sc * q), c = document.createElement('canvas'); c.width = c.height = n; c.getContext('2d').drawImage(this.fog, 0, 0, n, n); return { c, n, sc, vx, vy, a }; });
      ctx.setTransform(1, 0, 0, 1, 0, 0); const bw = W * q, bh = H * q;
      for (const f of this._fogT) {
        ctx.globalAlpha = f.a; const ox = Math.round((((t * f.vx * f.sc * q) % f.n) + f.n) % f.n) - f.n, oy = Math.round((((t * f.vy * f.sc * q) % f.n) + f.n) % f.n) - f.n;
        for (let y = oy; y < bh; y += f.n) for (let x = ox; x < bw; x += f.n) ctx.drawImage(f.c, x, y);
      }
      ctx.setTransform(q, 0, 0, q, 0, 0);
    }
    ctx.globalCompositeOperation = 'lighter';
    // slow light rays from the top: rotated blits are the costly part, so they live in their own buffer refreshed at ~10 Hz
    if (!this._ray) { this._ray = document.createElement('canvas'); this._rctx = this._ray.getContext('2d'); }
    const rw = Math.ceil(W * q), rh = Math.ceil(H * q);
    if (this._ray.width !== rw || this._ray.height !== rh || this._rayT === undefined || Math.abs(t - this._rayT) >= 0.1) {
      if (this._ray.width !== rw || this._ray.height !== rh) { this._ray.width = rw; this._ray.height = rh; }
      const r = this._rctx; r.setTransform(1, 0, 0, 1, 0, 0); r.clearRect(0, 0, rw, rh); r.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a = Math.sin(t * 0.15 + i * 2.1) * 0.12 + (i - 1) * 0.35; r.setTransform(q, 0, 0, q, 0, 0); r.globalAlpha = p.raysA * (0.7 + 0.3 * Math.sin(t * 0.4 + i)); r.translate(W * (0.2 + i * 0.3), -20); r.rotate(a); r.drawImage(this.ray, -W * 0.18, 0, W * 0.36, H * 1.1);
      }
      this._rayT = t;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.drawImage(this._ray, 0, 0); ctx.setTransform(q, 0, 0, q, 0, 0);
    for (const b of this.bok) {
      const y = ((b.y * (H + 200) - t * b.sp) % (H + 200) + H + 200) % (H + 200) - 100; const x = b.x * W + Math.sin(t * 0.3 + b.ph) * 24;
      ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 0.7 + b.ph); ctx.drawImage(this.spr[b.c], x - b.s / 2, y - b.s / 2, b.s, b.s);
    }
    for (const d of this.dust) {
      const y = ((d.y * H - t * d.sp) % H + H) % H; const x = d.x * W + Math.sin(t * 0.8 + d.ph) * 10; ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 2 + d.ph); ctx.drawImage(this.dot, x - d.s * 2, y - d.s * 2, d.s * 4, d.s * 4);
    }
    // neon edge glow (flickers like a real tube)
    ctx.globalAlpha = 0.16 * this.flick; let g = ctx.createLinearGradient(0, 0, 0, 90); g.addColorStop(0, p.cols[0]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 90);
    g = ctx.createLinearGradient(0, H, 0, H - 90); g.addColorStop(0, p.cols[1]); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, H - 90, W, 90);
    ctx.restore();
  }
}

export class Synth {
  constructor() { this.muted = ls.getItem('jd_muted') === '1'; this.ac = null; }
  _ctx() {
    if (this.muted) return null;
    if (!this.ac && window.__ghAC && window.__ghAC.state !== 'closed') { this.ac = window.__ghAC; this.shared = true; this.master = this.ac.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ac.destination); }
    if (!this.ac) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; try { this.ac = new AC(); this.master = this.ac.createGain(); this.master.gain.value = 0.35; this.master.connect(this.ac.destination); } catch { return null; } }
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    return this.ac;
  }
  tone(freq, dur = 0.12, { type = 'sine', vol = 0.5, slide = 0, delay = 0 } = {}) {
    const ac = this._ctx(); if (!ac) return;
    const t = ac.currentTime + delay; const o = ac.createOscillator(); const g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur = 0.15, { vol = 0.3, freq = 1200, delay = 0 } = {}) {
    const ac = this._ctx(); if (!ac) return;
    const t = ac.currentTime + delay; const n = Math.floor(ac.sampleRate * dur); const buf = ac.createBuffer(1, n, ac.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = ac.createBufferSource(); s.buffer = buf; const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; const g = ac.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
  }
  chord(freqs, dur = 0.3, o = {}) { freqs.forEach((f, i) => this.tone(f, dur, { ...o, delay: (o.delay || 0) + i * 0.06 })); }
  click() { this.tone(1800, 0.03, { type: 'square', vol: 0.15 }); }
  win() { this.chord([523, 659, 784, 1047], 0.35, { type: 'triangle', vol: 0.35 }); }
  lose() { this.tone(300, 0.4, { type: 'sawtooth', vol: 0.25, slide: 0.4 }); }
  toggle() { this.muted = !this.muted; ls.setItem('jd_muted', this.muted ? '1' : '0'); return this.muted; }
}

export class Game {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.onEnd = opts.onEnd || (() => {}); this.onState = opts.onState || (() => {});
    this.best = opts.best || 0; this.sfx = new Synth(); this.tel = new Telemetry(); this.seed = opts.seed || ''; this.r = seeded(this.seed); this.log = [];
    this.state = 'ready'; this.t = 0; this.parts = []; this.pops = []; this.running = false; this._activePointers = new Set(); this._activeKeys = new Set();
    this._bind(); this.resize(); this.reset(); this.layout(); this._inited = true;
    this.ready = Promise.resolve(this.load ? this.load() : null).then(() => (this.amb && this.amb.ready)).then(() => this.draw());
  }
  // ----- to override -----
  get title() { return 'GAME'; }
  get hint() { return 'Tap to start'; }
  get unit() { return 'pts'; }
  reset() {} layout() {} update() {} render() {}
  onDown() {} onMove() {} onUp() {} onKey() {}
  // ----- plumbing -----
  _bind() {
    const pos = (e) => { const r = this.c.getBoundingClientRect(); const dpr = this.c.width / Math.max(1, r.width); return [((e.clientX - r.left) * dpr - this.ox) / this.scale, ((e.clientY - r.top) * dpr - this.oy) / this.scale]; };
    this._h = {
      pd: (e) => { e.preventDefault(); try { this.c.setPointerCapture(e.pointerId); } catch {} const [x, y] = pos(e); this.sfx._ctx();
        if (this.state === 'ready') { this.begin(); if (this.startOnTapOnly) return; }
        if (this.state === 'play') { this._activePointers.add(e.pointerId); this.tel.hit(); this.onDown(x, y, e); } },
      pm: (e) => { if (this.state === 'play') { const [x, y] = pos(e); this.onMove(x, y, e); } },
      pu: (e) => { this._activePointers.delete(e.pointerId); if (this.state === 'play') { const [x, y] = pos(e); this.onUp(x, y, e); } },
      kd: (e) => {
        if (e.code === 'KeyP' || e.code === 'Escape') { this.togglePause(); return; }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (this.state === 'ready' && !e.repeat && (e.code === 'Space' || e.code === 'Enter')) { this.sfx._ctx(); this.begin(); if (this.startOnTapOnly) return; }
        if (this.state === 'play') { this._activeKeys.add(e.code); if (!e.repeat) this.tel.hit(); this.onKey(e.code, true, e); }
      },
      ku: (e) => { this._activeKeys.delete(e.code); if (this.state === 'play') this.onKey(e.code, false, e); },
      vis: () => { if (document.hidden && this.state === 'play') this.pause(true); },
      rs: () => this.resize(),
    };
    this.c.addEventListener('pointerdown', this._h.pd); this.c.addEventListener('pointermove', this._h.pm);
    window.addEventListener('pointerup', this._h.pu); window.addEventListener('pointercancel', this._h.pu);
    window.addEventListener('keydown', this._h.kd); window.addEventListener('keyup', this._h.ku);
    document.addEventListener('visibilitychange', this._h.vis); window.addEventListener('resize', this._h.rs);
    this.c.style.touchAction = 'none';
  }
  clearInputs() {
    for (const id of this._activePointers) this.onUp(0, 0, { pointerId: id, pointerType: 'touch', cancelled: true });
    this._activePointers.clear();
    for (const code of this._activeKeys) this.onKey(code, false, { code });
    this._activeKeys.clear();
  }
  destroy() {
    this.clearInputs(); this.running = false; cancelAnimationFrame(this.raf);
    this.c.removeEventListener('pointerdown', this._h.pd); this.c.removeEventListener('pointermove', this._h.pm);
    window.removeEventListener('pointerup', this._h.pu); window.removeEventListener('pointercancel', this._h.pu);
    window.removeEventListener('keydown', this._h.kd); window.removeEventListener('keyup', this._h.ku);
    document.removeEventListener('visibilitychange', this._h.vis); window.removeEventListener('resize', this._h.rs);
    try { this.sfx.ac && !this.sfx.shared && this.sfx.ac.close(); } catch {}
  }
  resize() {
    const r = this.c.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.c.width = Math.max(1, Math.round(r.width * dpr)); this.c.height = Math.max(1, Math.round(r.height * dpr));
    const cw = this.c.width, ch = this.c.height; const B = 540;
    if (cw >= ch) { this.H = B; this.W = clamp(B * cw / ch, 720, 1200); } else { this.W = B; this.H = clamp(B * ch / cw, 700, 1200); }
    this.portrait = ch > cw;
    this.scale = Math.min(cw / this.W, ch / this.H); this.ox = (cw - this.W * this.scale) / 2; this.oy = (ch - this.H * this.scale) / 2;
    this.layout();
    if (this._inited && this.state !== 'play') this.draw();
  }
  start() {
    if (this.running) return; this.running = true; this.last = performance.now();
    const loop = (now) => { if (!this.running) return; this.raf = requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.frame(dt); };
    this.raf = requestAnimationFrame(loop);
  }
  frame(dt) {
    this.t += dt;
    if (this.state === 'play') { this.playT += dt; this.update(dt); }
    if (this.state !== 'paused') { this._parts(dt); if (this.amb) this.amb.update(dt); }
    this.draw();
  }
  begin() { if (this.state !== 'ready') return; this._ev = null; this.state = 'play'; this.startedAt = performance.now(); this.playT = 0; this.onState('play'); }
  pause(v = true) { if (this.state !== 'play' && this.state !== 'paused') return; if (v && this.state === 'play') this.clearInputs(); this.state = v ? 'paused' : 'play'; this.last = performance.now(); this.onState(this.state); this.draw(); }
  togglePause() { if (this.state === 'play') this.pause(true); else if (this.state === 'paused') this.pause(false); }
  // v5: server seed for this run (from /api/run/start). Re-deals the board if the run has not started yet.
  setSeed(s) { this.seed = s || ''; this.r = seeded(this.seed); if (this.state === 'ready') { this.log = []; this._ev = null; this.reset(); this.layout(); this.draw(); } }
  restart() { this.clearInputs(); this.state = 'ready'; this.parts = []; this.pops = []; this.r = seeded(this.seed); this.log = []; this._ev = null; this.tel.reset(); this.reset(); this.layout(); this.onState('ready'); this.draw(); }
  // End the run and submit the current score (used at game over and by "End run & save")
  finish() {
    if (this.state === 'over') return; const wasReady = this.state === 'ready'; this.clearInputs(); this.state = 'over';
    if (wasReady) return;
    const score = Math.max(0, Math.floor(this.score || 0)); if (score > this.best) this.best = score;
    this.onState('over'); this.onEnd({ score, coins: Math.floor(this.coins || 0), duration_ms: Math.round(performance.now() - this.startedAt), tel: this.tel.out(), log: this.log.length ? this.log.slice(0, 5000) : undefined, ev: this.evOut() });
  }
  endNow() { if (this.state === 'play' || this.state === 'paused') this.finish(); }
  // ----- v7 anti-cheat level 3: event log -----
  // award(pts, kind) adds points AND records [time, kind, points]; mark(kind, value) records progression (wave, row, life...).
  // The log is sent with the run; src/ac-levels.js checks it against the game rules (sum = score, values legal for the
  // current wave/row/multiplier, counts and timing possible). Compact flat encoding: [dt in 10 ms, kind, value, ...].
  award(pts, kind) { pts = Math.round(pts); this.score += pts; this.mark(kind, pts); return pts; }
  mark(kind, v = 0) {
    const L = this._ev || (this._ev = { e: [], last: 0, n: 0, agg: null }); const t = Math.round((this.playT || 0) * 100); L.n++;
    if (L.e.length < 4500 * 3) { L.e.push(t - L.last, kind, v); L.last = t; }
    else { const a = L.agg || (L.agg = {}); const r = a[kind] || (a[kind] = [0, 0, 0]); r[0]++; r[1] += v; r[2] = Math.max(r[2], v); L.lastT = t; }
  }
  evOut() { const L = this._ev; if (!L) return undefined; return { v: 1, e: L.e, n: L.n, agg: L.agg || undefined, end: Math.round((this.playT || 0) * 100) }; }
  // ----- helpers -----
  burst(x, y, color, n = 12, sp = 220, life = 0.6, size = 4) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, v = rnd(sp * 0.3, sp); this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, max: life, c: Array.isArray(color) ? color[i % color.length] : color, s: rnd(size * 0.5, size * 1.3) }); } }
  pop(x, y, text, color = '#fff', size = 26) { this.pops.push({ x, y, text, color, size, life: 1, max: 1 }); }
  _parts(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 300) * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const p of this.pops) { p.y -= 50 * dt; p.life -= dt; }
    this.pops = this.pops.filter(p => p.life > 0);
  }
  text(ctx, s, x, y, { size = 20, weight = 800, color = '#fff', align = 'left', glow = null, font = 'Orbitron', base = 'alphabetic' } = {}) {
    ctx.save(); ctx.font = `${weight} ${size}px ${font === 'Exo' ? '"Exo 2"' : 'Orbitron'}, sans-serif`; ctx.textAlign = align; ctx.textBaseline = base; ctx.fillStyle = color;
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 14; } ctx.fillText(s, x, y); ctx.restore();
  }
  // photo backdrop: cover-fit image + a dark tint so neon HUD stays readable; falls back to gradient bg
  photoBg(ctx, img, tint = 'rgba(6,6,18,0.45)', scroll = 0) {
    if (!cover(ctx, img, 0, 0, this.W, this.H, scroll)) this.bg(ctx);
    else if (tint) { ctx.fillStyle = tint; ctx.fillRect(0, 0, this.W, this.H); }
    if (this.amb) this.amb.draw(ctx, this.W, this.H); // v6 animated ambience over the backdrop
  }
  bg(ctx, c1 = '#0a0628', c2 = '#050714') {
    const g = ctx.createLinearGradient(0, 0, 0, this.H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, this.W, this.H);
    ctx.strokeStyle = 'rgba(99,102,241,0.08)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let x = 0; x < this.W; x += 40) { ctx.moveTo(x, 0); ctx.lineTo(x, this.H); } for (let y = 0; y < this.H; y += 40) { ctx.moveTo(0, y); ctx.lineTo(this.W, y); } ctx.stroke();
  }
  draw() {
    const ctx = this.ctx; ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#03040c'; ctx.fillRect(0, 0, this.c.width, this.c.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, this.ox, this.oy);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, this.W, this.H); ctx.clip();
    this.render(ctx);
    for (const p of this.parts) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    ctx.globalAlpha = 1;
    for (const p of this.pops) { ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); this.text(ctx, p.text, p.x, p.y, { size: p.size, color: p.color, align: 'center', glow: p.color }); }
    ctx.globalAlpha = 1;
    if (this.state === 'ready') this.center(ctx, this.title, this.hint, 'TAP TO START');
    if (this.state === 'paused') this.center(ctx, 'PAUSED', 'Tap Resume to keep playing');
    ctx.restore();
  }
  center(ctx, title, sub, cta) {
    ctx.save(); ctx.fillStyle = 'rgba(5,6,20,0.62)'; ctx.fillRect(0, 0, this.W, this.H);
    const cy = this.H / 2; const big = Math.min(46, this.W / (title.length * 0.78));
    this.text(ctx, title, this.W / 2, cy - 30, { size: big, weight: 900, align: 'center', glow: '#00e5ff' });
    const words = String(sub).split(' '); const lines = []; let cur = '';
    ctx.font = '600 17px "Exo 2", sans-serif';
    for (const w of words) { const nx = cur ? cur + ' ' + w : w; if (ctx.measureText(nx).width > this.W * 0.82) { lines.push(cur); cur = w; } else cur = nx; } if (cur) lines.push(cur);
    lines.slice(0, 4).forEach((l, i) => this.text(ctx, l, this.W / 2, cy + 8 + i * 22, { size: 17, weight: 600, color: '#c9c4ff', align: 'center', font: 'Exo' }));
    if (cta) { const a = 0.6 + Math.sin(this.t * 4) * 0.4; ctx.globalAlpha = a; this.text(ctx, cta, this.W / 2, cy + 30 + Math.min(4, lines.length) * 22 + 16, { size: 20, weight: 800, color: '#22d3ee', align: 'center', glow: '#22d3ee' }); ctx.globalAlpha = 1; }
    ctx.restore();
  }
  hudScore(ctx, label = 'SCORE') {
    this.text(ctx, label, 18, 30, { size: 12, weight: 700, color: '#9aa3d0' });
    this.text(ctx, fmt(this.score || 0), 18, 62, { size: 30, weight: 900, glow: '#7c4dff' });
    this.text(ctx, `BEST ${fmt(Math.max(this.best, this.score || 0))}`, 18, 82, { size: 12, weight: 700, color: '#b9b3ff', font: 'Exo' });
  }
}

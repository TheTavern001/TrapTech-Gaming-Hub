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
export const fmt = (n) => Math.floor(n).toLocaleString('en-US');

export class Synth {
  constructor() { this.muted = localStorage.getItem('jd_muted') === '1'; this.ac = null; }
  _ctx() {
    if (this.muted) return null;
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
  toggle() { this.muted = !this.muted; localStorage.setItem('jd_muted', this.muted ? '1' : '0'); return this.muted; }
}

export class Game {
  constructor(canvas, opts = {}) {
    this.c = canvas; this.ctx = canvas.getContext('2d');
    this.onEnd = opts.onEnd || (() => {}); this.onState = opts.onState || (() => {});
    this.best = opts.best || 0; this.sfx = new Synth();
    this.state = 'ready'; this.t = 0; this.parts = []; this.pops = []; this.running = false;
    this._bind(); this.resize(); this.reset(); this.layout(); this._inited = true;
    this.ready = Promise.resolve(this.load ? this.load() : null).then(() => this.draw());
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
        if (this.state === 'play') this.onDown(x, y, e); },
      pm: (e) => { if (this.state === 'play') { const [x, y] = pos(e); this.onMove(x, y, e); } },
      pu: (e) => { if (this.state === 'play') { const [x, y] = pos(e); this.onUp(x, y, e); } },
      kd: (e) => {
        if (e.code === 'KeyP' || e.code === 'Escape') { this.togglePause(); return; }
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        if (this.state === 'ready' && !e.repeat && (e.code === 'Space' || e.code === 'Enter')) { this.sfx._ctx(); this.begin(); if (this.startOnTapOnly) return; }
        if (this.state === 'play') this.onKey(e.code, true, e);
      },
      ku: (e) => { if (this.state === 'play') this.onKey(e.code, false, e); },
      vis: () => { if (document.hidden && this.state === 'play') this.pause(true); },
      rs: () => this.resize(),
    };
    this.c.addEventListener('pointerdown', this._h.pd); this.c.addEventListener('pointermove', this._h.pm);
    window.addEventListener('pointerup', this._h.pu); window.addEventListener('pointercancel', this._h.pu);
    window.addEventListener('keydown', this._h.kd); window.addEventListener('keyup', this._h.ku);
    document.addEventListener('visibilitychange', this._h.vis); window.addEventListener('resize', this._h.rs);
    this.c.style.touchAction = 'none';
  }
  destroy() {
    this.running = false; cancelAnimationFrame(this.raf);
    this.c.removeEventListener('pointerdown', this._h.pd); this.c.removeEventListener('pointermove', this._h.pm);
    window.removeEventListener('pointerup', this._h.pu); window.removeEventListener('pointercancel', this._h.pu);
    window.removeEventListener('keydown', this._h.kd); window.removeEventListener('keyup', this._h.ku);
    document.removeEventListener('visibilitychange', this._h.vis); window.removeEventListener('resize', this._h.rs);
    try { this.sfx.ac && this.sfx.ac.close(); } catch {}
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
    if (this.state !== 'paused') { this._parts(dt); }
    this.draw();
  }
  begin() { if (this.state !== 'ready') return; this.state = 'play'; this.startedAt = performance.now(); this.playT = 0; this.onState('play'); }
  pause(v = true) { if (this.state !== 'play' && this.state !== 'paused') return; this.state = v ? 'paused' : 'play'; this.last = performance.now(); this.onState(this.state); this.draw(); }
  togglePause() { if (this.state === 'play') this.pause(true); else if (this.state === 'paused') this.pause(false); }
  restart() { this.state = 'ready'; this.parts = []; this.pops = []; this.reset(); this.layout(); this.onState('ready'); this.draw(); }
  // End the run and submit the current score (used at game over and by "End run & save")
  finish() {
    if (this.state === 'over') return; const wasReady = this.state === 'ready'; this.state = 'over';
    if (wasReady) return;
    const score = Math.max(0, Math.floor(this.score || 0)); if (score > this.best) this.best = score;
    this.onState('over'); this.onEnd({ score, coins: Math.floor(this.coins || 0), duration_ms: Math.round(performance.now() - this.startedAt) });
  }
  endNow() { if (this.state === 'play' || this.state === 'paused') this.finish(); }
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

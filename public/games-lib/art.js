// The Gaming Hub - shared procedural art helpers for rebuilt library games (original code, MIT, Trap Tech Solutions).
// Everything is drawn in code (gradients, bevels, glow): no third-party images, nothing to license, tiny payload.
(function () {
  const A = window.Art = {};
  const TAU = Math.PI * 2;
  A.hex = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  A.mix = (a, b, t) => { const x = A.hex(a), y = A.hex(b); return 'rgb(' + x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(',') + ')'; };
  A.light = (c, t) => A.mix(c, '#ffffff', t); A.dark = (c, t) => A.mix(c, '#000000', t);
  // offscreen sprite cache: draw(ctx,w,h) once, blit forever
  const cache = new Map();
  A.sprite = function (key, w, h, draw, dpr) { dpr = dpr || 2; let s = cache.get(key); if (s) return s; const cv = document.createElement('canvas'); cv.width = Math.ceil(w * dpr); cv.height = Math.ceil(h * dpr); const x = cv.getContext('2d'); x.scale(dpr, dpr); draw(x, w, h); cache.set(key, cv); s = cv; return s; };
  A.blit = (c, s, x, y, w, h) => c.drawImage(s, x, y, w, h);
  A.rr = (c, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  // glossy bevelled tile
  A.tile = function (c, x, y, w, h, col, r) {
    r = r == null ? Math.min(w, h) * 0.2 : r;
    const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, A.light(col, 0.28)); g.addColorStop(0.55, col); g.addColorStop(1, A.dark(col, 0.28));
    A.rr(c, x, y, w, h, r); c.fillStyle = g; c.fill();
    c.strokeStyle = 'rgba(255,255,255,.28)'; c.lineWidth = 1.2; A.rr(c, x + 0.6, y + 0.6, w - 1.2, h - 1.2, r); c.stroke();
    const hg = c.createLinearGradient(0, y, 0, y + h * 0.5); hg.addColorStop(0, 'rgba(255,255,255,.34)'); hg.addColorStop(1, 'rgba(255,255,255,0)');
    A.rr(c, x + w * 0.06, y + h * 0.05, w * 0.88, h * 0.42, r * 0.8); c.fillStyle = hg; c.fill();
  };
  A.orb = function (c, x, y, r, col) {
    const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, A.light(col, 0.7)); g.addColorStop(0.45, col); g.addColorStop(1, A.dark(col, 0.45));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.45, r * 0.28, r * 0.16, -0.5, 0, TAU); c.fill();
  };
  A.shadow = (c, x, y, rx, ry, a) => { c.fillStyle = 'rgba(0,0,0,' + (a == null ? 0.28 : a) + ')'; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); };
  // soft animated background: gradient + drifting light blobs (+ optional vignette)
  A.bg = function (c, W, H, t, top, bot, blob) {
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, top); g.addColorStop(1, bot); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) { const x = W * (0.2 + 0.6 * ((i * 0.37 + t * 0.012 * (1 + i * 0.3)) % 1)), y = H * (0.15 + 0.7 * ((i * 0.61 + t * 0.008) % 1)), r = W * (0.35 + 0.1 * i); const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, blob || 'rgba(120,90,255,.10)'); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); }
    c.globalCompositeOperation = 'source-over';
  };
  // stylised bud: layered calyx leaves around a core with orange pistils (original vector art)
  A.bud = function (c, x, y, s, col, tier) {
    c.save(); c.translate(x, y); const n = 5 + Math.min(4, tier || 0);
    for (let k = 0; k < 2; k++) for (let i = 0; i < n; i++) { const a = (i / n) * TAU + k * 0.3 + (tier || 0) * 0.2; c.save(); c.rotate(a); const L = s * (k ? 0.55 : 0.8), W = s * (k ? 0.22 : 0.3);
      const g = c.createLinearGradient(0, 0, 0, -L); g.addColorStop(0, A.dark(col, 0.35)); g.addColorStop(1, k ? A.light(col, 0.25) : col);
      c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(W, -L * 0.45, 0, -L); c.quadraticCurveTo(-W, -L * 0.45, 0, 0); c.fill(); c.restore(); }
    A.orb(c, 0, 0, s * 0.2, A.light(col, 0.15));
    c.strokeStyle = '#ff9a3c'; c.lineWidth = Math.max(1, s * 0.05); c.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4; c.beginPath(); c.moveTo(Math.cos(a) * s * 0.1, Math.sin(a) * s * 0.1); c.quadraticCurveTo(Math.cos(a + .5) * s * 0.3, Math.sin(a + .5) * s * 0.3, Math.cos(a) * s * 0.36, Math.sin(a) * s * 0.36); c.stroke(); }
    c.restore();
  };
  A.ease = { out: t => 1 - Math.pow(1 - t, 3), back: t => { const s = 1.70158; t -= 1; return t * t * ((s + 1) * t + s) + 1; }, inout: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2 };
})();

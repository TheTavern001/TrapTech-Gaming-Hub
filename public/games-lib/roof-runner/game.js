// Roof Runner - original portrait rooftop parkour (Hub build v8). Dusk skyline, parallax city, scarf-trailing courier.
// Tap = jump (hold = higher). Coyote time + jump buffer. Endless, uncapped, skill-only. All art is code-drawn.
Kit.run({ id: 'gl-roof-runner', title: 'ROOF RUNNER', fill: true, help: 'Tap to jump - hold for higher\nLand near an edge for a CLOSE bonus\nDon\'t hit a wall, don\'t fall', bg: '#1b1640',
  init(g) { g.p = { y: 0, vy: 0, on: true, hold: 0, coy: 0, buf: 0, anim: 0, sq: 0 }; g.sp = 280; g.d = 0; g.lastM = 0; g.box = []; g.dust = []; g.scarf = []; g.cl = 0; g.base = g.H * 0.6;
    g.p.y = g.base; g.roofs = [{ x: -80, w: 620, y: g.base, k: 1 }]; },
  update(g, dt) {
    const p = g.p; p.buf = Math.max(0, p.buf - dt); p.coy = p.on ? 0.09 : Math.max(0, p.coy - dt); if (g.tap()) p.buf = 0.12;
    if (p.buf > 0 && p.coy > 0) { p.vy = -600; p.on = false; p.coy = 0; p.buf = 0; p.hold = 0.2; p.sq = -1; g.sfx('whoosh'); }
    if (!p.on && p.hold > 0 && g.held()) { p.vy -= 1500 * dt; p.hold -= dt; } else p.hold = 0;
    p.vy += 1800 * dt; const oy = p.y; p.y += p.vy * dt; g.sp = Math.min(620, 280 + g.t * 7); const dx = g.sp * dt; g.d += dx;
    const m = Math.floor(g.d / 25); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    for (const r of g.roofs) r.x -= dx; for (const b of g.box) b.x -= dx;
    const last = g.roofs[g.roofs.length - 1];
    if (last.x + last.w < g.W + 220) { const gap = g.R(50, 70 + Math.min(80, g.sp * 0.16)), lo = g.base - 120, hi = g.base + 140; const y = Kit.clamp(last.y + g.R(-70, 90), lo, hi), w = g.R(220, 520), x = last.x + last.w + gap;
      g.roofs.push({ x, w, y, k: g.RI(0, 5) }); if (g.rnd() < 0.45 && w > 300) g.box.push({ x: x + g.R(110, w - 90), y }); }
    const was = p.on; p.on = false;
    for (const r of g.roofs) if (96 + 6 > r.x && 96 - 6 < r.x + r.w) {
      if (oy <= r.y + 1 && p.y >= r.y && p.vy >= 0) { p.y = r.y; p.vy = 0; p.on = true; const edge = Math.min(96 - r.x, r.x + r.w - 96); if (!was) { p.sq = 1; g.sfx('thud'); for (let i = 0; i < 8; i++) g.dust.push({ x: 96, y: r.y, vx: g.R(-120, 40), vy: g.R(-90, -20), l: 0.5 }); if (r.x > -2 && 96 - r.x < 26 && 96 - r.x > -10) { g.cl++; g.add(5, 'close'); g.float('CLOSE +5', 96, r.y - 70, '#fde047'); } } }
      else if (p.y > r.y + 8 && oy > r.y + 8 && 96 > r.x - 2 && 96 < r.x + 10) { g.sfx('hit'); g.shake(10); g.flash('#fff'); return g.end('Hit a wall'); } }
    for (const b of g.box) if (!b.hit && Math.abs(b.x - 96) < 20 && p.y > b.y - 30) { b.hit = true; g.sp *= 0.82; g.sfx('bad'); g.burst(b.x, b.y - 14, '#a16207', 14, 170); g.shake(5); }
    if (p.on && g.rnd() < 0.5) g.dust.push({ x: 90, y: p.y, vx: g.R(-160, -60), vy: g.R(-40, -5), l: 0.35 });
    for (const d of g.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.l -= dt; } g.dust = g.dust.filter(d => d.l > 0);
    p.sq *= Math.pow(0.001, dt); p.anim += dt * (p.on ? 14 + g.sp / 60 : 4);
    g.scarf.unshift({ x: 0, y: p.y }); if (g.scarf.length > 9) g.scarf.pop();
    if (p.y > g.H + 60) return g.end('Fell');
    g.roofs = g.roofs.filter(r => r.x + r.w > -140); g.box = g.box.filter(b => b.x > -40); g.hud = Math.floor(g.d / 25) + ' m';
  },
  draw(g, c) {
    const W = g.W, H = g.H, hs = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#120f33'); sky.addColorStop(0.45, '#5b2a86'); sky.addColorStop(0.75, '#e0457b'); sky.addColorStop(1, '#ffb36b'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { c.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(g.t * 1.4 + i)); c.fillStyle = '#fff'; c.fillRect(hs(i) * W, hs(i + 9) * H * 0.4, 1.6, 1.6); } c.globalAlpha = 1;
    const mx = W * 0.72, my = H * 0.17; const mg = c.createRadialGradient(mx, my, 10, mx, my, 110); mg.addColorStop(0, 'rgba(255,240,200,.5)'); mg.addColorStop(1, 'rgba(255,240,200,0)'); c.fillStyle = mg; c.fillRect(mx - 120, my - 120, 240, 240); c.fillStyle = '#fff4d6'; c.beginPath(); c.arc(mx, my, 34, 0, 7); c.fill(); c.fillStyle = 'rgba(210,190,160,.45)'; for (const [a, b, r] of [[-9, -6, 7], [8, 8, 5], [-4, 12, 4]]) { c.beginPath(); c.arc(mx + a, my + b, r, 0, 7); c.fill(); }
    const layers = [[0.08, '#3b1f63', 0.78, 70, 150, 0], [0.18, '#2a1750', 0.86, 60, 190, 0.12], [0.34, '#1c1038', 0.95, 50, 240, 0.3]];
    for (const [par, col, yb, bw, bh, lit] of layers) { const off = g.d * par; const i0 = Math.floor(off / bw) - 1; for (let i = i0; i < i0 + W / bw + 3; i++) { const w = bw * (0.8 + hs(i + par * 100) * 0.6), x = i * bw - off, h = bh * (0.35 + hs(i * 3.3 + par * 50) * 0.75), y = H * yb - h * 0.6 + 60; c.fillStyle = col; c.fillRect(x, y, w, H); if (hs(i + par) > 0.7) c.fillRect(x + w * 0.45, y - 24, 3, 24);
        if (lit) { c.fillStyle = 'rgba(255,214,120,' + (0.35 + lit) + ')'; for (let wy = y + 12; wy < y + h * 0.9 && wy < H; wy += 18) for (let wx = x + 6; wx < x + w - 8; wx += 14) if (hs(wx * 0.37 + wy * 1.7 + i) > 0.72) c.fillRect(wx, wy, 5, 7); } } }
    for (const r of g.roofs) { const h = H - r.y + 4; const bg = c.createLinearGradient(r.x, 0, r.x + r.w, 0); bg.addColorStop(0, '#2c2748'); bg.addColorStop(1, '#241f3d'); c.fillStyle = bg; c.fillRect(r.x, r.y, r.w, h); c.fillStyle = '#4a4470'; c.fillRect(r.x - 3, r.y, r.w + 6, 9); c.fillStyle = '#6b6499'; c.fillRect(r.x - 3, r.y, r.w + 6, 3); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(r.x, r.y + 9, r.w, 8);
      for (let wx = r.x + 18; wx < r.x + r.w - 26; wx += 38) for (let wy = r.y + 34; wy < H; wy += 46) { const on = hs(wx * 0.11 + wy * 0.7 + r.k) > 0.5; c.fillStyle = on ? '#ffd27a' : '#3a3560'; Kit.rr(c, wx, wy, 20, 28, 3); c.fill(); if (on) { c.fillStyle = 'rgba(255,210,120,.18)'; c.fillRect(wx - 3, wy - 3, 26, 34); } }
      if (r.w > 330) { const px = r.x + r.w * 0.78 + r.k * 4; if (r.k % 3 === 0) { c.fillStyle = '#5b5684'; c.fillRect(px, r.y - 26, 40, 26); c.fillStyle = '#7a74a8'; c.fillRect(px, r.y - 26, 40, 5); c.fillStyle = '#2b2748'; c.beginPath(); c.arc(px + 20, r.y - 12, 8, 0, 7); c.fill(); } else if (r.k % 3 === 1) { c.fillStyle = '#4a4470'; c.fillRect(px + 16, r.y - 70, 4, 70); c.fillStyle = '#ef4444'; c.beginPath(); c.arc(px + 18, r.y - 72, 3 + Math.sin(g.t * 5) * 1, 0, 7); c.fill(); } else { c.fillStyle = '#5a4a3e'; Kit.rr(c, px, r.y - 44, 34, 30, 4); c.fill(); c.fillStyle = '#3b2e25'; c.fillRect(px + 3, r.y - 14, 4, 14); c.fillRect(px + 27, r.y - 14, 4, 14); c.fillStyle = '#7a6454'; c.fillRect(px - 2, r.y - 48, 38, 6); } } }
    for (const b of g.box) if (!b.hit) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(b.x - 16, b.y - 2, 32, 4); c.fillStyle = '#b4742b'; Kit.rr(c, b.x - 15, b.y - 30, 30, 30, 3); c.fill(); c.strokeStyle = '#6b3f12'; c.lineWidth = 2; c.strokeRect(b.x - 14, b.y - 29, 28, 28); c.beginPath(); c.moveTo(b.x - 14, b.y - 29); c.lineTo(b.x + 14, b.y - 1); c.moveTo(b.x + 14, b.y - 29); c.lineTo(b.x - 14, b.y - 1); c.stroke(); }
    for (const d of g.dust) { c.globalAlpha = Math.max(0, d.l * 2); c.fillStyle = '#e8dcc8'; c.beginPath(); c.arc(d.x, d.y, 2 + (0.5 - d.l) * 6, 0, 7); c.fill(); } c.globalAlpha = 1;
    const p = g.p, X = 96, run = p.on ? Math.sin(p.anim) : 0.8, sq = 1 + p.sq * 0.12, by = p.y; c.save(); c.translate(X, by); c.scale(1 / sq, sq); c.translate(-X, -by);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(X, by + 1, 14, 3, 0, 0, 7); c.fill();
    c.lineCap = 'round'; c.lineJoin = 'round'; const lim = (x0, y0, x1, y1, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); };
    const air = !p.on, hip = by - 24; lim(X, hip, X - 7 + (air ? -8 : run * 9), by - (air ? 8 : 2 - Math.max(0, -run) * 6), 7, '#111827'); lim(X, hip, X + 7 + (air ? 9 : -run * 9), by - (air ? 14 : 2 - Math.max(0, run) * 6), 7, '#1f2937');
    c.strokeStyle = '#7c3aed'; c.lineWidth = 5; c.beginPath(); c.moveTo(X - 8, by - 4); c.lineTo(X - 8 + (air ? -8 : run * 9), by - 2); c.stroke();
    c.fillStyle = '#2a2f45'; Kit.rr(c, X - 10, hip - 24, 22, 28, 8); c.fill(); c.fillStyle = '#f97316'; c.fillRect(X - 10, hip - 8, 22, 5);
    lim(X + 2, hip - 18, X + 14 + (air ? 4 : -run * 6), hip - 8 + (air ? -12 : run * 4), 5, '#334155'); lim(X + 2, hip - 18, X - 10 + (air ? -6 : run * 6), hip - 8 + (air ? -14 : -run * 4), 5, '#475569');
    c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(X + 3, hip - 34, 9, 0, 7); c.fill(); c.fillStyle = '#1f1632'; c.beginPath(); c.arc(X + 2, hip - 37, 9.5, Math.PI * 0.9, Math.PI * 2.1); c.fill(); c.fillRect(X - 7, hip - 37, 7, 6);
    c.fillStyle = '#111'; c.fillRect(X + 7, hip - 35, 2.5, 3); c.fillStyle = '#ef4444'; c.fillRect(X - 6, hip - 28, 20, 4); c.restore();
    c.strokeStyle = '#ef4444'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(X - 4, p.y - 58); for (let i = 1; i < g.scarf.length; i++) c.lineTo(X - 4 - i * (g.sp / 85), p.y - 58 + (g.scarf[i].y - p.y) * 0.22 + Math.sin(g.t * 20 + i) * 2 + (p.vy > 0 ? -i : i) * 0.6); c.stroke();
  } });

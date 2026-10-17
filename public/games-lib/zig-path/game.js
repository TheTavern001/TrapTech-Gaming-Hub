// Zig Path - original tap-to-turn zigzag (Hub build), isometric path.
Kit.run({ fill: true, id: 'gl-zig-path', title: 'ZIG PATH', help: 'Tap / Space to switch direction\nStay on the path, grab the gems', bg: '#0c4a6e',
  init(g) { g.tiles = []; let x = 0, y = 0; for (let i = 0; i < 8; i++) { g.tiles.push({ x, y, h: i * 6 }); y--; } g.tx = x; g.ty = y + 1; for (let i = 0; i < 60; i++) ext(g); g.p = { x: 0, y: -2, d: 0 }; g.sp = 3.2; g.cam = { x: 0, y: 0 }; g.dist = 0; g.gems = new Set(); },
  update(g, dt) {
    if (g.tap()) { g.p.d = 1 - g.p.d; g.sfx('click'); g.add(1, 't'); }
    g.sp = Math.min(7, 3.2 + g.t * 0.05); const s = g.sp * dt; if (g.p.d === 0) g.p.y -= s; else g.p.x += s; g.dist += s;
    while (g.tiles.length < 80 + Math.floor(g.dist)) ext(g);
    const cx = Math.round(g.p.x), cy = Math.round(g.p.y); const on = g.tiles.some(t => Math.abs(t.x - g.p.x) < 0.62 && Math.abs(t.y - g.p.y) < 0.62); if (!on && g.t > 0.2) { g.sfx('die'); return g.end('Fell off'); }
    const k = cx + ',' + cy; if (g.gk && g.gk.has(k)) { g.gk.delete(k); g.add(5, 'g'); g.sfx('coin'); const [sx, sy] = iso(g, cx, cy); g.burst(sx, sy - 10, '#f472b6', 12); }
    const [ix, iy] = [g.p.x - g.p.y, (g.p.x + g.p.y)]; g.cam.x = Kit.lerp(g.cam.x, ix, dt * 5); g.cam.y = Kit.lerp(g.cam.y, iy, dt * 5);
  },
  draw(g, c) {
    const P = g.p, W = g.W, H = g.H, hue0 = (g.dist * 6) % 360;
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'hsl(' + (hue0 + 200) % 360 + ',60%,18%)'); bg.addColorStop(1, 'hsl(' + (hue0 + 240) % 360 + ',65%,8%)'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const z = 0.3 + (i % 4) * 0.2, x = (i * 71 + g.cam.x * 14 * z) % (W + 40), y = (i * 113 + g.t * 20 * z + g.cam.y * 8 * z) % H; c.globalAlpha = 0.15 + z * 0.2; c.fillStyle = '#fff'; c.fillRect((x + W + 40) % (W + 40) - 20, y, 2 * z + 1, 2 * z + 1); } c.globalAlpha = 1;
    const drawT = (t, n) => { const [x, y] = iso(g, t.x, t.y); if (y < -60 || y > H + 60) return; const h = (t.h * 3) % 360; const edge = Math.max(0, Math.min(1, (y - H * 0.62) / 200));
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.moveTo(x - 28, y + 30); c.lineTo(x, y + 58); c.lineTo(x + 28, y + 44); c.lineTo(x, y + 28); c.fill();
      c.fillStyle = 'hsl(' + h + ',65%,' + (62 - edge * 8) + '%)'; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 28, y); c.lineTo(x, y + 14); c.lineTo(x - 28, y); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = 'hsl(' + h + ',60%,42%)'; c.beginPath(); c.moveTo(x - 28, y); c.lineTo(x, y + 14); c.lineTo(x, y + 44); c.lineTo(x - 28, y + 30); c.fill();
      c.fillStyle = 'hsl(' + h + ',60%,30%)'; c.beginPath(); c.moveTo(x + 28, y); c.lineTo(x, y + 14); c.lineTo(x, y + 44); c.lineTo(x + 28, y + 30); c.fill(); };
    const sorted = g.tiles.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)); for (const t of sorted) drawT(t);
    const tk = new Set(g.tiles.map(t => t.x + ',' + t.y)); if (g.gk) for (const k of g.gk) { if (!tk.has(k)) { g.gk.delete(k); continue; } const [gx, gy] = k.split(',').map(Number); const [x, y] = iso(g, gx, gy); const bob = Math.sin(g.t * 4 + gx) * 3; Kit.glow(c, '#f472b6', 14); c.fillStyle = '#fbcfe8'; c.beginPath(); c.moveTo(x, y - 26 + bob); c.lineTo(x + 8, y - 14 + bob); c.lineTo(x, y - 2 + bob); c.lineTo(x - 8, y - 14 + bob); c.fill(); c.fillStyle = '#f472b6'; c.beginPath(); c.moveTo(x, y - 26 + bob); c.lineTo(x + 8, y - 14 + bob); c.lineTo(x, y - 14 + bob); c.fill(); Kit.noGlow(c); }
    const [x, y] = iso(g, P.x, P.y); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(x, y + 2, 10, 5, 0, 0, 7); c.fill();
    g.trl = g.trl || []; if (g.frames % 2 === 0) g.trl.push({ x, y: y - 10, l: 1 }); for (const q of g.trl) { q.l -= 0.05; q.x -= 0; } g.trl = g.trl.filter(q => q.l > 0).slice(-14);
    for (const q of g.trl) { c.globalAlpha = q.l * 0.5; c.fillStyle = '#f472b6'; c.beginPath(); c.arc(q.x - (g.cam.x - (g.cam.x)), q.y, 8 * q.l, 0, 7); c.fill(); } c.globalAlpha = 1;
    Kit.glow(c, '#f472b6', 16); const gr = c.createRadialGradient(x - 3, y - 14, 1, x, y - 10, 10); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#f472b6'); gr.addColorStop(1, '#9d174d'); c.fillStyle = gr; c.beginPath(); c.arc(x, y - 10, 10, 0, 7); c.fill(); Kit.noGlow(c);
  } });
function iso(g, x, y) { return [g.W / 2 + ((x - y) - g.cam.x) * 28, g.H * 0.62 + ((x + y) - g.cam.y) * 14]; }
function ext(g) { const d = g.rnd() < 0.5 ? 0 : 1; const n = g.RI(1, 4); for (let i = 0; i < n; i++) { if (d === 0) g.ty--; else g.tx++; g.tiles.push({ x: g.tx, y: g.ty, h: (g.hc = (g.hc || 50) + 3) }); if (g.rnd() < 0.08) { g.gk = g.gk || new Set(); g.gk.add(g.tx + ',' + g.ty); } } if (g.tiles.length > 200) g.tiles.splice(0, g.tiles.length - 200); }

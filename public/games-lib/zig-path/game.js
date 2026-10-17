// Zig Path - original tap-to-turn zigzag (Hub build), isometric path.
Kit.run({ fill: true, id: 'gl-zig-path', title: 'ZIG PATH', help: 'Tap / Space to switch direction\nStay on the path, grab the gems', bg: '#0c4a6e',
  init(g) { g.tiles = []; let x = 0, y = 0; for (let i = 0; i < 8; i++) { g.tiles.push({ x, y }); y--; } g.tx = x; g.ty = y; for (let i = 0; i < 60; i++) ext(g); g.p = { x: 0, y: -2, d: 0 }; g.sp = 3.2; g.cam = { x: 0, y: 0 }; g.dist = 0; g.gems = new Set(); },
  update(g, dt) {
    if (g.tap()) { g.p.d = 1 - g.p.d; g.sfx('click'); g.add(1, 't'); }
    g.sp = Math.min(7, 3.2 + g.t * 0.05); const s = g.sp * dt; if (g.p.d === 0) g.p.y -= s; else g.p.x += s; g.dist += s;
    while (g.tiles.length < 80 + Math.floor(g.dist)) ext(g);
    const cx = Math.round(g.p.x), cy = Math.round(g.p.y); const on = g.tiles.some(t => Math.abs(t.x - g.p.x) < 0.62 && Math.abs(t.y - g.p.y) < 0.62); if (!on && g.t > 0.2) { g.sfx('die'); return g.end('Fell off'); }
    const k = cx + ',' + cy; if (g.gk && g.gk.has(k)) { g.gk.delete(k); g.add(5, 'g'); g.sfx('coin'); const [sx, sy] = iso(g, cx, cy); g.burst(sx, sy - 10, '#f472b6', 12); }
    const [ix, iy] = [g.p.x - g.p.y, (g.p.x + g.p.y)]; g.cam.x = Kit.lerp(g.cam.x, ix, dt * 5); g.cam.y = Kit.lerp(g.cam.y, iy, dt * 5);
  },
  draw(g, c) {
    const P = g.p; const drawT = (t) => { const [x, y] = iso(g, t.x, t.y); if (y < -60 || y > g.H + 60) return; c.fillStyle = '#e0f2fe'; c.beginPath(); c.moveTo(x, y - 14); c.lineTo(x + 28, y); c.lineTo(x, y + 14); c.lineTo(x - 28, y); c.fill(); c.fillStyle = '#7dd3fc'; c.beginPath(); c.moveTo(x - 28, y); c.lineTo(x, y + 14); c.lineTo(x, y + 44); c.lineTo(x - 28, y + 30); c.fill(); c.fillStyle = '#0284c7'; c.beginPath(); c.moveTo(x + 28, y); c.lineTo(x, y + 14); c.lineTo(x, y + 44); c.lineTo(x + 28, y + 30); c.fill(); };
    const sorted = g.tiles.slice().sort((a, b) => (a.x + a.y) - (b.x + b.y)); for (const t of sorted) drawT(t);
    if (g.gk) for (const k of g.gk) { const [gx, gy] = k.split(',').map(Number); const [x, y] = iso(g, gx, gy); c.fillStyle = '#f472b6'; c.beginPath(); c.moveTo(x, y - 22); c.lineTo(x + 7, y - 12); c.lineTo(x, y - 2); c.lineTo(x - 7, y - 12); c.fill(); }
    const [x, y] = iso(g, P.x, P.y); Kit.glow(c, '#f472b6', 12); Kit.circ(c, x, y - 10, 9, '#f472b6'); Kit.noGlow(c);
  } });
function iso(g, x, y) { return [g.W / 2 + ((x - y) - g.cam.x) * 28, g.H * 0.62 + ((x + y) - g.cam.y) * 14]; }
function ext(g) { const d = g.rnd() < 0.5 ? 0 : 1; const n = g.RI(1, 4); for (let i = 0; i < n; i++) { if (d === 0) g.ty--; else g.tx++; g.tiles.push({ x: g.tx, y: g.ty }); if (g.rnd() < 0.08) { g.gk = g.gk || new Set(); g.gk.add(g.tx + ',' + g.ty); } } if (g.tiles.length > 200) g.tiles.splice(0, g.tiles.length - 200); }

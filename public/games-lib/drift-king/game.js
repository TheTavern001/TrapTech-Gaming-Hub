// Drift King - original one-tap drift on a zig-zag road (Hub build)
Kit.run({ fill: true, id: 'gl-drift-king', title: 'DRIFT KING', help: 'Hold to turn right, release to turn left\nKeep the car on the winding road', bg: '#0f766e',
  init(g) { g.car = { x: 0, y: 0, a: -Math.PI / 2, sp: 170 }; g.pts = [[0, 120], [0, -140]]; let x = 0, y = -140, d = 1; for (let i = 0; i < 40; i++) { const L = g.R(80, 220); d = -d; x += d * L * 0.7; y -= L * 0.7; g.pts.push([x, y]); } g.last = 0; g.dist = 0; g.lastM = 0; },
  update(g, dt) {
    const c0 = g.car, turn = g.held() ? 1 : -1; c0.a += turn * 2.6 * dt; c0.a = Kit.clamp(c0.a, -Math.PI * 0.95, -Math.PI * 0.05); c0.sp = Math.min(330, 170 + g.t * 3); c0.x += Math.cos(c0.a) * c0.sp * dt; c0.y += Math.sin(c0.a) * c0.sp * dt;
    if (g.frames % 2) g.parts.push({ x: 0, y: 0, wx: c0.x, wy: c0.y, vx: 0, vy: 0, l: 0.8, m: 0, c: 'rgba(30,30,30,.5)', s: 5, gr: 0, sk: 1 });
    const n = g.pts.length; if (c0.y < g.pts[n - 15][1]) { let [x, y] = g.pts[n - 1]; const d = g.pts[n - 1][0] > g.pts[n - 2][0] ? -1 : 1; for (let i = 0; i < 10; i++) { const L = g.R(70, 200 - Math.min(80, g.t)); const dd = i % 2 ? -d : d; x += dd * L * 0.7; y -= L * 0.7; g.pts.push([x, y]); } }
    // distance to road polyline
    let best = 1e9; for (let i = Math.max(1, g.last - 2); i < Math.min(n, g.last + 6); i++) { const [ax, ay] = g.pts[i - 1], [bx, by] = g.pts[i]; const L2 = (bx - ax) ** 2 + (by - ay) ** 2; const t = Kit.clamp(((c0.x - ax) * (bx - ax) + (c0.y - ay) * (by - ay)) / L2, 0, 1); const dd = Math.hypot(ax + (bx - ax) * t - c0.x, ay + (by - ay) * t - c0.y); if (dd < best) { best = dd; if (t > 0.99) g.last = Math.max(g.last, i); } }
    if (best > 36) { g.sfx('die'); g.burst(g.W / 2, g.H * 0.65, '#a16207', 30); return g.end('Off the road'); }
    const m = Math.floor(-c0.y / 20); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    for (const p of g.parts) if (p.sk) { p.x = p.wx - c0.x + g.W / 2; p.y = p.wy - c0.y + g.H * 0.65; }
  },
  draw(g, c) {
    const ox = g.W / 2 - g.car.x, oy = g.H * 0.65 - g.car.y; c.lineCap = 'round'; c.lineJoin = 'round';
    c.strokeStyle = '#134e4a'; c.lineWidth = 92; c.beginPath(); g.pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x + ox, y + oy + 10)); c.stroke();
    c.strokeStyle = '#e5e7eb'; c.lineWidth = 80; c.stroke(); c.strokeStyle = '#374151'; c.lineWidth = 72; c.beginPath(); g.pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x + ox, y + oy)); c.stroke();
    c.save(); c.translate(g.W / 2, g.H * 0.65); c.rotate(g.car.a + Math.PI / 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-11, -16, 26, 40); c.fillStyle = '#ef4444'; Kit.rr(c, -13, -20, 26, 40, 6); c.fill(); c.fillStyle = '#111827'; c.fillRect(-9, -10, 18, 10); c.restore();
  } });

// @uses carart.js
// Drift King - original one-tap drift on a zig-zag road (Hub build)
Kit.run({ fill: true, id: 'gl-drift-king', title: 'DRIFT KING', help: 'Hold to turn right, release to turn left\nKeep the car on the winding road', bg: '#0f766e',
  init(g) { g.car = { x: 0, y: 0, a: -Math.PI / 2, sp: 170 }; g.pts = [[0, 120], [0, -140]]; let x = 0, y = -140, d = 1; for (let i = 0; i < 40; i++) { const L = g.R(80, 220); d = -d; x += d * L * 0.7; y -= L * 0.7; g.pts.push([x, y]); } g.last = 0; g.dist = 0; g.lastM = 0; },
  update(g, dt) {
    const c0 = g.car, turn = g.t < 0.5 ? 0 : g.held() ? 1 : -1; c0.a += turn * 2.6 * dt; c0.a = Kit.clamp(c0.a, -Math.PI * 0.95, -Math.PI * 0.05); c0.sp = Math.min(330, 170 + g.t * 3); c0.x += Math.cos(c0.a) * c0.sp * dt; c0.y += Math.sin(c0.a) * c0.sp * dt;
    if (g.frames % 2) g.parts.push({ x: 0, y: 0, wx: c0.x, wy: c0.y, vx: 0, vy: 0, l: 0.8, m: 0, c: 'rgba(30,30,30,.5)', s: 5, gr: 0, sk: 1 });
    const n = g.pts.length; if (c0.y < g.pts[n - 15][1]) { let [x, y] = g.pts[n - 1]; const d = g.pts[n - 1][0] > g.pts[n - 2][0] ? -1 : 1; for (let i = 0; i < 10; i++) { const L = g.R(70, 200 - Math.min(80, g.t)); const dd = i % 2 ? -d : d; x += dd * L * 0.7; y -= L * 0.7; g.pts.push([x, y]); } }
    // distance to road polyline
    let best = 1e9; for (let i = Math.max(1, g.last - 2); i < Math.min(n, g.last + 6); i++) { const [ax, ay] = g.pts[i - 1], [bx, by] = g.pts[i]; const L2 = (bx - ax) ** 2 + (by - ay) ** 2; const t = Kit.clamp(((c0.x - ax) * (bx - ax) + (c0.y - ay) * (by - ay)) / L2, 0, 1); const dd = Math.hypot(ax + (bx - ax) * t - c0.x, ay + (by - ay) * t - c0.y); if (dd < best) { best = dd; if (t > 0.99) g.last = Math.max(g.last, i); } }
    if (best > 36) { g.sfx('die'); g.burst(g.W / 2, g.H * 0.65, '#a16207', 30); return g.end('Off the road'); }
    const m = Math.floor(-c0.y / 20); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    for (const p of g.parts) if (p.sk) { p.x = p.wx - c0.x + g.W / 2; p.y = p.wy - c0.y + g.H * 0.65; }
  },
  draw(g, c) {
    const W = g.W, H = g.H, ox = W / 2 - g.car.x, oy = H * 0.65 - g.car.y; c.lineCap = 'round'; c.lineJoin = 'round';
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#166534'); bg.addColorStop(1, '#14532d'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // scenery: deterministic trees + rocks per 120px world cell, culled to the screen
    const cs = 120, wx0 = Math.floor((g.car.x - W / 2 - 60) / cs), wx1 = Math.floor((g.car.x + W / 2 + 60) / cs), wy0 = Math.floor((g.car.y - H * 0.65 - 60) / cs), wy1 = Math.floor((g.car.y + H * 0.35 + 60) / cs);
    const props = [];
    for (let ix = wx0; ix <= wx1; ix++) for (let iy = wy0; iy <= wy1; iy++) { const h = ((ix * 73856093) ^ (iy * 19349663)) >>> 0; if (h % 3 === 0) continue; const px = ix * cs + (h % 97) / 97 * cs, py = iy * cs + ((h >> 7) % 89) / 89 * cs; props.push([px + ox, py + oy, h]); }
    const road = () => { c.beginPath(); g.pts.forEach(([x, y], i) => c[i ? 'lineTo' : 'moveTo'](x + ox, y + oy)); };
    c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = 100; road(); c.stroke();
    c.strokeStyle = '#f8fafc'; c.lineWidth = 86; road(); c.stroke();
    c.strokeStyle = '#dc2626'; c.lineWidth = 86; c.setLineDash([22, 22]); road(); c.stroke(); c.setLineDash([]);
    c.strokeStyle = '#3a4150'; c.lineWidth = 74; road(); c.stroke(); c.strokeStyle = '#475062'; c.lineWidth = 52; road(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.setLineDash([18, 22]); road(); c.stroke(); c.setLineDash([]);
    // persistent tire marks come from g.parts (sk), cars + props on top
    c.save(); c.translate(W / 2, H * 0.65); c.rotate(g.car.a + Math.PI / 2); c.scale(0.85, 0.85); CarArt.car(c, 0, 0, '#ef4444', { kind: 'sedan', angle: 0, scale: 1 }); c.restore();
    for (const [x, y, h] of props) { if (Math.abs(x - W / 2) < 0 ) continue; let near = false; for (let i = Math.max(0, g.last - 3); i < Math.min(g.pts.length, g.last + 12); i++) { if (Math.hypot(g.pts[i][0] + ox - x, g.pts[i][1] + oy - y) < 70) { near = true; break; } } if (near) continue; if (h % 5 === 0) { c.fillStyle = '#6b7280'; c.beginPath(); c.ellipse(x, y, 9, 6, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(x - 2, y - 2, 4, 2.5, 0, 0, 7); c.fill(); } else CarArt.tree(c, x, y, 14 + (h % 9)); }
    // speed lines on hard drift
    if (g.held && g.t > 1) { c.globalAlpha = 0.12; c.fillStyle = '#fff'; for (let i = 0; i < 6; i++) c.fillRect((i * 67 + g.t * 300) % W, 0, 2, H); c.globalAlpha = 1; }
  } });

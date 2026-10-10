// Roof Runner - original one-button rooftop escape (Hub build)
Kit.run({ id: 'gl-roof-runner', title: 'ROOF RUNNER', orient: 'l', help: 'Tap / Space to jump (hold = higher)\nDon\'t fall between the rooftops', bg: '#64748b',
  init(g) { g.p = { y: 250, vy: 0, on: true }; g.sp = 300; g.d = 0; g.roofs = [{ x: -50, w: 700, y: 300 }]; g.lastM = 0; g.box = []; },
  update(g, dt) {
    const p = g.p; if (g.tap() && p.on) { p.vy = -560; p.on = false; g.sfx('jump'); p.hold = 0.22; } if (!p.on && p.hold > 0 && g.held()) { p.vy -= 1400 * dt; p.hold -= dt; } else p.hold = 0;
    p.vy += 1700 * dt; const oy = p.y; p.y += p.vy * dt; g.sp = Math.min(900, 300 + g.t * 9); const dx = g.sp * dt; g.d += dx; const m = Math.floor(g.d / 25); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    for (const r of g.roofs) r.x -= dx; for (const b of g.box) b.x -= dx;
    const last = g.roofs[g.roofs.length - 1]; if (last.x + last.w < g.W + 200) { const gap = g.R(60, 90 + g.sp * 0.18), y = Kit.clamp(last.y + g.R(-70, 80), 190, 380); g.roofs.push({ x: last.x + last.w + gap, w: g.R(260, 700), y }); if (g.rnd() < 0.4) g.box.push({ x: last.x + last.w + gap + g.R(80, 200), y }); }
    p.on = false; for (const r of g.roofs) if (120 > r.x && 100 < r.x + r.w) { if (oy <= r.y && p.y >= r.y && p.vy >= 0) { p.y = r.y; p.vy = 0; p.on = true; } else if (p.y > r.y + 6 && oy > r.y + 6 && 120 > r.x && 100 < r.x + 8) { g.sfx('hit'); g.shake(10); return g.end('Smashed into a building'); } }
    for (const b of g.box) if (!b.hit && Math.abs(b.x - 110) < 18 && p.y > b.y - 26) { b.hit = true; g.sp *= 0.85; g.sfx('thud'); g.burst(b.x, b.y - 10, '#a16207', 14, 160); g.shake(4); }
    if (p.y > g.H + 40) return g.end('Fell');
    g.roofs = g.roofs.filter(r => r.x + r.w > -100); g.box = g.box.filter(b => b.x > -40); g.hud = Math.floor(g.d / 25) + ' m';
  },
  draw(g, c) {
    const sky = c.createLinearGradient(0, 0, 0, g.H); sky.addColorStop(0, '#94a3b8'); sky.addColorStop(1, '#cbd5e1'); c.fillStyle = sky; c.fillRect(0, 0, g.W, g.H);
    c.fillStyle = '#94a3b8'; for (let i = 0; i < 14; i++) { const x = ((i * 75 - g.d * 0.2) % 1050 + 1050) % 1050 - 100; c.fillRect(x, 180 + (i * 47) % 90, 60, 300); }
    for (const r of g.roofs) { c.fillStyle = '#334155'; c.fillRect(r.x, r.y, r.w, g.H); c.fillStyle = '#1e293b'; c.fillRect(r.x, r.y, r.w, 8); c.fillStyle = '#475569'; for (let wx = r.x + 20; wx < r.x + r.w - 20; wx += 40) for (let wy = r.y + 30; wy < g.H; wy += 50) c.fillRect(wx, wy, 18, 26); }
    for (const b of g.box) if (!b.hit) { c.fillStyle = '#a16207'; c.fillRect(b.x - 14, b.y - 26, 28, 26); c.strokeStyle = '#78350f'; c.strokeRect(b.x - 14, b.y - 26, 28, 26); }
    const p = g.p, run = p.on ? Math.sin(g.t * 22) : 0.6; c.strokeStyle = '#0f172a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(110, p.y - 22); c.lineTo(110 + run * 9, p.y); c.moveTo(110, p.y - 22); c.lineTo(110 - run * 9, p.y); c.moveTo(110, p.y - 22); c.lineTo(114, p.y - 42); c.moveTo(113, p.y - 36); c.lineTo(124, p.y - 28 - run * 6); c.moveTo(113, p.y - 36); c.lineTo(100, p.y - 30 + run * 6); c.stroke(); Kit.circ(c, 116, p.y - 50, 7, '#0f172a');
  } });

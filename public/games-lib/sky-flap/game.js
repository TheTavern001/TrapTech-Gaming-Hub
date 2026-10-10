// Neon Flapper - original one-tap flyer (Hub build)
Kit.run({ id: 'gl-sky-flap', title: 'NEON FLAPPER', help: 'Tap / Space to flap\nSlip through the gates', bg: '#07092a',
  init(g) { g.b = { x: 110, y: 330, vy: 0, a: 0 }; g.pipes = []; g.next = 1.2; g.gap = 170; g.sp = 150; g.gx = 0; },
  attract(g, dt) { g.b.y = 330 + Math.sin(g.t * 3) * 20; g.gx += 60 * dt; },
  update(g, dt) {
    const b = g.b; if (g.tap()) { b.vy = -330; g.sfx('flap'); g.burst(b.x - 10, b.y + 6, '#a855f7', 6, 80, 0.4); }
    b.vy += 980 * dt; b.y += b.vy * dt; b.a = Kit.clamp(b.vy / 600, -0.5, 1.2); g.gx += g.sp * dt;
    g.sp = 150 + Math.min(110, g.score * 2.5); g.gap = Math.max(118, 170 - g.score * 1.5);
    g.next -= dt; if (g.next <= 0) { g.next = 1.45 - Math.min(0.35, g.score * 0.01); const gy = g.R(130, g.H - 190); g.pipes.push({ x: g.W + 40, y: gy, gap: g.gap, done: false, m: g.score > 15 ? g.R(-1, 1) * 40 : 0, p: g.R(0, 6) }); }
    for (const p of g.pipes) { p.x -= g.sp * dt; const yy = p.y + Math.sin(g.t * 2 + p.p) * p.m;
      if (!p.done && p.x + 30 < b.x) { p.done = true; g.add(1, 'g'); g.sfx('coin'); g.float(b.x, b.y - 30, '+1', '#34d399'); }
      if (b.x + 14 > p.x - 30 && b.x - 14 < p.x + 30 && (b.y - 12 < yy - p.gap / 2 || b.y + 12 > yy + p.gap / 2)) { g.burst(b.x, b.y, ['#fbbf24', '#ef4444', '#fff'], 30, 260); return g.end('Hit a gate'); } }
    g.pipes = g.pipes.filter(p => p.x > -60);
    if (b.y > g.H - 40 || b.y < -30) { g.burst(b.x, b.y, '#fbbf24', 30, 260); g.end('Crashed'); }
  },
  draw(g, c) {
    Kit.stars(c, g.W, g.H, g.t, 0); c.fillStyle = '#120f3a'; for (let i = 0; i < 8; i++) { const x = ((i * 70 - g.gx * 0.3) % 560 + 560) % 560 - 60; c.fillRect(x, g.H - 130 - (i % 3) * 40, 50, 200); }
    for (const p of g.pipes) { const yy = p.y + Math.sin(g.t * 2 + p.p) * p.m; Kit.glow(c, '#22d3ee', 14); c.fillStyle = '#0e7490'; c.fillRect(p.x - 30, -10, 60, yy - p.gap / 2 + 10); c.fillRect(p.x - 30, yy + p.gap / 2, 60, g.H); c.fillStyle = '#22d3ee'; c.fillRect(p.x - 34, yy - p.gap / 2 - 16, 68, 16); c.fillRect(p.x - 34, yy + p.gap / 2, 68, 16); Kit.noGlow(c); }
    c.fillStyle = '#1d2a66'; c.fillRect(0, g.H - 40, g.W, 40); c.fillStyle = '#6366f1'; for (let x = -(g.gx % 30); x < g.W; x += 30) c.fillRect(x, g.H - 40, 15, 4);
    const b = g.b; c.save(); c.translate(b.x, b.y); c.rotate(b.a); Kit.glow(c, '#fbbf24', 16); Kit.circ(c, 0, 0, 15, '#fbbf24'); Kit.noGlow(c); c.fillStyle = '#f59e0b'; c.beginPath(); c.ellipse(-4, 3 + Math.sin(g.t * 30) * 4, 9, 5, 0, 0, 7); c.fill(); Kit.circ(c, 6, -5, 5, '#fff'); Kit.circ(c, 8, -5, 2.4, '#111'); c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(12, 0); c.lineTo(22, 3); c.lineTo(12, 7); c.fill(); c.restore();
  } });

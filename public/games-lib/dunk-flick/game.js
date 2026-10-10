// Dunk Flick - original drag-and-release hoop to hoop (Hub build). Swish = no rim = bonus streak.
Kit.run({ id: 'gl-dunk-flick', title: 'DUNK FLICK', help: 'Drag back from the ball and release to shoot\nLand in the next hoop - swishes build a streak', bg: '#1e1b4b', partGrav: 300,
  init(g) { g.hoops = [{ x: 110, y: 470 }, { x: 290, y: 330 }]; g.ball = { x: 110, y: 455, vx: 0, vy: 0, held: true }; g.cam = 0; g.streak = 0; g.rim = false; g.misses = 0; },
  update(g, dt) {
    const b = g.ball, P = g.ptr; const H0 = g.hoops[0], H1 = g.hoops[1];
    if (b.held) { b.x = H0.x; b.y = H0.y - 15; if (P.down) { g.aim = { dx: Kit.clamp(P.sx - P.x, -160, 160), dy: Kit.clamp(P.sy - P.y, -40, 200) }; } if (P.released && g.aim && Math.hypot(g.aim.dx, g.aim.dy) > 20) { b.held = false; b.vx = g.aim.dx * 4.2; b.vy = -Math.abs(g.aim.dy) * 4.6 - 120; g.aim = null; g.rim = false; g.sfx('whoosh'); }
      if (g.kd(' ')) { b.held = false; const dx = H1.x - H0.x, dy = H1.y - H0.y; const T = 0.9; b.vx = dx / T; b.vy = (dy - 0.5 * 1100 * T * T) / T; g.rim = false; g.sfx('whoosh'); } return; }
    b.vy += 1100 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < 12 || b.x > g.W - 12) { b.vx *= -0.8; b.x = Kit.clamp(b.x, 12, g.W - 12); g.sfx('click'); }
    for (const h of [H0, H1]) for (const rx of [h.x - 34, h.x + 34]) { const d = Math.hypot(b.x - rx, b.y - h.y); if (d < 15) { const nx = (b.x - rx) / d, ny = (b.y - h.y) / d; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; } b.x = rx + nx * 15; b.y = h.y + ny * 15; g.rim = true; g.sfx('thud'); } }
    if (b.vy > 0 && Math.abs(b.x - H1.x) < 26 && b.y > H1.y && b.y < H1.y + 20) { g.streak = g.rim ? 0 : g.streak + 1; const v = 1 + (g.rim ? 0 : g.streak); g.add(v, 's'); g.float(H1.x, H1.y - 40, g.rim ? '+1' : 'SWISH x' + g.streak + ' +' + v, g.rim ? '#fff' : '#fbbf24', 18); g.sfx(g.rim ? 'good' : 'power'); g.burst(H1.x, H1.y, g.rim ? '#fff' : ['#f97316', '#fbbf24'], 20, 160);
      const nx = g.R(70, 330), ny = H1.y - g.R(110, 190); g.hoops = [H1, { x: Math.abs(nx - H1.x) < 90 ? (H1.x < 200 ? 300 : 100) : nx, y: ny }]; b.held = true; }
    if (b.y - g.cam > g.H + 40) { g.misses++; if (g.misses >= 1) return g.end('Missed'); }
    g.cam = Kit.lerp(g.cam, H0.y - 470, dt * 4); g.hud = g.streak > 1 ? 'STREAK ' + g.streak : '';
  },
  draw(g, c) {
    c.save(); c.translate(0, -g.cam); for (let y = Math.floor(g.cam / 80) * 80; y < g.cam + g.H; y += 80) { c.fillStyle = 'rgba(99,102,241,.08)'; c.fillRect(0, y, g.W, 40); }
    for (const h of g.hoops) { c.fillStyle = '#e5e7eb'; c.fillRect(h.x - 40, h.y - 60, 80, 50); c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.strokeRect(h.x - 15, h.y - 50, 30, 26); c.strokeStyle = '#e5e7eb'; c.lineWidth = 2; for (let i = -3; i <= 3; i++) { c.beginPath(); c.moveTo(h.x + i * 10, h.y); c.lineTo(h.x + i * 6, h.y + 30); c.stroke(); } c.strokeStyle = '#f97316'; c.lineWidth = 6; c.beginPath(); c.moveTo(h.x - 34, h.y); c.lineTo(h.x + 34, h.y); c.stroke(); }
    const b = g.ball; Kit.circ(c, b.x, b.y, 13, '#f97316'); c.strokeStyle = '#7c2d12'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, 13, 0, 7); c.moveTo(b.x - 13, b.y); c.lineTo(b.x + 13, b.y); c.stroke();
    if (b.held && g.aim) { c.fillStyle = 'rgba(255,255,255,.6)'; let x = b.x, y = b.y, vx = g.aim.dx * 4.2, vy = -Math.abs(g.aim.dy) * 4.6 - 120; for (let i = 0; i < 14; i++) { x += vx * 0.04; vy += 1100 * 0.04; y += vy * 0.04; c.fillRect(x - 2, y - 2, 4, 4); } }
    c.restore();
  } });

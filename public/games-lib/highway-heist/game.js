// Highway Heist - original top-down highway escape with ramming cops (Hub build)
Kit.run({ id: 'gl-highway-heist', title: 'HIGHWAY HEIST', help: 'Steer: arrows / drag. Cops try to box you in\nSideswipe them into traffic - survive and score', bg: '#1f2937',
  init(g) { g.x = 200; g.vx = 0; g.road = 0; g.traffic = []; g.cops = []; g.nt = 0.6; g.nc = 3; g.sp = 420; g.lastM = 0; g.hp = 3; g.inv = 0; },
  update(g, dt) {
    let st = g.ax(); if (g.ptr.down) st = Kit.clamp((g.ptr.x - g.x) / 40, -1, 1); g.vx = Kit.lerp(g.vx, st * 320, dt * 8); g.x = Kit.clamp(g.x + g.vx * dt, 55, 345); g.inv -= dt;
    g.sp = Math.min(800, 420 + g.t * 4); g.road += g.sp * dt; const m = Math.floor(g.road / 60); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    g.nt -= dt; if (g.nt <= 0) { g.nt = g.R(0.35, 0.8); g.traffic.push({ x: 75 + g.RI(0, 4) * 62, y: -60, v: g.R(160, 300), c: g.pick(['#3b82f6', '#e5e7eb', '#22c55e', '#a855f7']) }); }
    g.nc -= dt; if (g.nc <= 0 && g.cops.length < 1 + Math.floor(g.t / 20)) { g.nc = g.R(3, 6); g.cops.push({ x: g.R(80, 320), y: g.H + 60, vy: -g.R(40, 90), vx: 0 }); g.sfx('bad'); }
    for (const k of g.traffic) { k.y += (g.sp - k.v) * dt; }
    for (const p of g.cops) { p.vx = Kit.lerp(p.vx, Kit.clamp((g.x - p.x) * 3, -260, 260), dt * 2); p.x = Kit.clamp(p.x + p.vx * dt, 55, 345); p.y = Kit.lerp(p.y, 520 + Math.sin(g.t + p.x) * 30, dt * 0.8);
      if (Math.abs(p.x - g.x) < 44 && Math.abs(p.y - 560) < 50) { const push = Math.sign(p.x - g.x) || 1; if (Math.abs(g.vx) > 120 && Math.sign(g.vx) === push) { p.vx = push * 600; p.hit = 0.6; g.sfx('hit'); g.shake(5); } else if (g.inv <= 0) { g.hp--; g.inv = 1.2; g.vx = -push * 300; g.sfx('hit'); g.flash('#ef4444', 0.08); g.shake(8); if (g.hp <= 0) return g.end('Boxed in'); } }
      if (p.x <= 56 || p.x >= 344) { if (p.hit > 0) p.dead = true; } for (const k of g.traffic) if (Math.abs(k.x - p.x) < 40 && Math.abs(k.y - p.y) < 56) p.dead = true; p.hit -= dt;
      if (p.dead) { g.add(150, 'k'); g.float(p.x, p.y - 30, 'COP DOWN +150', '#fbbf24', 16); g.burst(p.x, p.y, ['#3b82f6', '#ef4444', '#fbbf24'], 30, 220); g.sfx('boom'); } }
    for (const k of g.traffic) if (Math.abs(k.x - g.x) < 40 && Math.abs(k.y - 560) < 52) { g.burst(g.x, 560, ['#ef4444', '#fbbf24'], 50, 300); g.sfx('boom'); g.shake(14); return g.end('Crashed into traffic'); }
    g.traffic = g.traffic.filter(k => k.y < g.H + 80); g.cops = g.cops.filter(p => !p.dead);
    g.hud = '\u2665'.repeat(g.hp) + '  COPS ' + g.cops.length;
  },
  draw(g, c) {
    c.fillStyle = '#4d7c0f'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#374151'; c.fillRect(44, 0, 312, g.H); c.fillStyle = '#facc15'; c.fillRect(44, 0, 4, g.H); c.fillRect(352, 0, 4, g.H); c.fillStyle = '#fff'; for (let l = 1; l < 5; l++) for (let y = (g.road % 60) - 60; y < g.H; y += 60) c.fillRect(44 + l * 62.4, y, 3, 30);
    const car = (x, y, col, rot, siren) => { c.save(); c.translate(x, y); c.rotate(rot); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-18, -24, 40, 56); c.fillStyle = col; Kit.rr(c, -20, -28, 40, 56, 8); c.fill(); c.fillStyle = '#0f172a'; c.fillRect(-15, -14, 30, 12); if (siren) { c.fillStyle = Math.sin(g.t * 20) > 0 ? '#ef4444' : '#3b82f6'; c.fillRect(-12, 0, 24, 5); } c.restore(); };
    for (const k of g.traffic) car(k.x, k.y, k.c, Math.PI); for (const p of g.cops) car(p.x, p.y, '#f8fafc', p.vx * 0.0006, true); if (!(g.inv > 0 && Math.sin(g.t * 30) > 0)) car(g.x, 560, '#111827', g.vx * 0.0008);
  } });

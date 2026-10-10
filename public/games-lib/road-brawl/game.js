// Road Brawl - original motorbike combat (Hub build). Kick rival bikers off the road while dodging traffic.
Kit.run({ id: 'gl-road-brawl', title: 'ROAD BRAWL', help: 'Steer: drag / arrows. Tap left/right edge (or A/D... Q/E) to kick\nKick rivals off the road - avoid the cars', bg: '#1f2937',
  buttons: [{ id: 'L', key: 'q', label: 'KICK L' }, { id: 'R', key: 'e', label: 'KICK R' }],
  init(g) { g.x = 200; g.road = 0; g.sp = 420; g.riv = []; g.cars = []; g.nr = 1; g.nc = 1; g.hp = 100; g.kick = 0; g.kd2 = 0; g.lastM = 0; },
  update(g, dt) {
    let st = g.ax(); if (g.ptr.down && !g.btn.L && !g.btn.R) st = Kit.clamp((g.ptr.x - g.x) / 40, -1, 1); g.x = Kit.clamp(g.x + st * 260 * dt, 70, 330); g.sp = Math.min(700, 420 + g.t * 3); g.road += g.sp * dt; const m = Math.floor(g.road / 60); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    if (g.kick <= 0 && (g.btnP.L || g.kd('q') || g.kd('Q'))) { g.kick = 0.25; g.kd2 = -1; g.sfx('whoosh'); } if (g.kick <= 0 && (g.btnP.R || g.kd('e') || g.kd('E'))) { g.kick = 0.25; g.kd2 = 1; g.sfx('whoosh'); } g.kick -= dt;
    g.nr -= dt; if (g.nr <= 0 && g.riv.length < 2 + Math.floor(g.t / 25)) { g.nr = g.R(1.5, 3); g.riv.push({ x: g.pick([90, 310]), y: g.H + 40, vx: 0, hp: 2, cd: 1 }); }
    g.nc -= dt; if (g.nc <= 0) { g.nc = g.R(0.6, 1.3); g.cars.push({ x: 90 + g.RI(0, 3) * 73, y: -60, v: g.R(150, 260) }); }
    for (const r of g.riv) { r.y = Kit.lerp(r.y, 540 + Math.sin(g.t + r.x) * 40, dt * 0.8); r.vx = Kit.lerp(r.vx, Kit.clamp((g.x - r.x) * 2, -150, 150), dt * 1.5); if (r.fly) { r.x += r.fly * 500 * dt; r.y += 200 * dt; } else r.x += r.vx * dt;
      const dx = r.x - g.x; if (!r.fly && Math.abs(dx) < 50 && Math.abs(r.y - 560) < 40) { if (g.kick > 0 && Math.sign(dx) === g.kd2) { r.hp--; r.x += g.kd2 * 30; g.sfx('hit'); g.shake(5); g.burst(r.x, r.y, '#fbbf24', 10, 140); g.kick = 0; if (r.hp <= 0) { r.fly = g.kd2; g.add(100, 'k'); g.float(r.x, r.y - 30, 'TAKEDOWN +100', '#fbbf24', 18); g.sfx('boom'); } } else { r.cd -= dt; if (r.cd <= 0) { r.cd = 1.1; g.hp -= 12; g.sfx('hit'); g.flash('#ef4444', 0.06); g.x -= Math.sign(dx) * 20; if (g.hp <= 0) return g.end('Knocked off the bike'); } } }
      if (r.x < 40 || r.x > 360) { if (!r.fly) { r.fly = Math.sign(r.x - 200); g.add(60, 'k'); } r.dead = r.x < -60 || r.x > 460; } for (const k of g.cars) if (!r.fly && Math.abs(k.x - r.x) < 30 && Math.abs(k.y - r.y) < 50) { r.fly = Math.sign(r.x - k.x) || 1; g.add(80, 'k'); g.sfx('boom'); } }
    for (const k of g.cars) { k.y += (g.sp - k.v) * dt; if (Math.abs(k.x - g.x) < 30 && Math.abs(k.y - 560) < 48) { g.burst(g.x, 560, ['#ef4444', '#fbbf24'], 50, 300); g.sfx('boom'); g.shake(14); return g.end('Hit a car'); } }
    g.riv = g.riv.filter(r => !r.dead && r.y < g.H + 120); g.cars = g.cars.filter(k => k.y < g.H + 80); g.hud = 'HP ' + Math.max(0, g.hp);
  },
  draw(g, c) {
    c.fillStyle = '#a16207'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#374151'; c.fillRect(50, 0, 300, g.H); c.fillStyle = '#fff'; for (let l = 1; l < 4; l++) for (let y = (g.road % 60) - 60; y < g.H; y += 60) c.fillRect(50 + l * 75, y, 3, 30);
    for (const k of g.cars) { c.fillStyle = '#3b82f6'; Kit.rr(c, k.x - 20, k.y - 28, 40, 56, 8); c.fill(); c.fillStyle = '#0f172a'; c.fillRect(k.x - 15, k.y + 8, 30, 12); }
    const bike = (x, y, col, kick, rot) => { c.save(); c.translate(x, y); c.rotate(rot || 0); c.fillStyle = '#111827'; c.fillRect(-4, -26, 8, 52); c.fillStyle = col; Kit.rr(c, -11, -14, 22, 28, 6); c.fill(); Kit.circ(c, 0, -2, 8, '#1f2937'); if (kick) { c.strokeStyle = col; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 4); c.lineTo(kick * 34, 0); c.stroke(); } c.restore(); };
    for (const r of g.riv) bike(r.x, r.y, '#ef4444', 0, r.fly ? g.t * 10 : 0); bike(g.x, 560, '#22c55e', g.kick > 0 ? g.kd2 : 0);
    c.fillStyle = '#1d2a66'; c.fillRect(20, 46, g.W - 40, 8); c.fillStyle = '#34d399'; c.fillRect(20, 46, (g.W - 40) * Math.max(0, g.hp) / 100, 8);
  } });

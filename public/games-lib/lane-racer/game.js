// Lane Racer - original endless highway weaving (Hub build). Close passes score bonus.
Kit.run({ id: 'gl-lane-racer', title: 'LANE RACER', help: 'Steer: arrows / hold left-right side\nWeave through traffic - near misses pay double', bg: '#1f2937',
  init(g) { g.x = 200; g.sp = 380; g.cars = []; g.next = 0.5; g.d = 0; g.lastM = 0; g.road = 0; },
  update(g, dt) {
    let st = g.ax(); if (g.ptr.down) st = g.ptr.x < g.W / 2 ? -1 : 1; g.x = Kit.clamp(g.x + st * 300 * dt, 70, 330); g.tilt = Kit.lerp(g.tilt || 0, st * 0.18, dt * 8);
    g.sp = Math.min(900, 380 + g.t * 6); const dy = g.sp * dt; g.d += dy; g.road += dy; const m = Math.floor(g.d / 50); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    g.next -= dt; if (g.next <= 0) { g.next = Math.max(0.28, 0.9 - g.t * 0.006) * g.R(0.7, 1.3); const lane = g.RI(0, 3); g.cars.push({ x: 95 + lane * 70, y: -80, v: g.R(150, 260), c: g.pick(['#ef4444', '#3b82f6', '#fbbf24', '#e5e7eb', '#22c55e']), truck: g.rnd() < 0.2 }); }
    for (const k of g.cars) { k.y += (g.sp - k.v) * dt; const h = k.truck ? 90 : 56; if (Math.abs(k.x - g.x) < 30 && Math.abs(k.y - 560) < h / 2 + 26) { g.burst(g.x, 560, ['#ef4444', '#fbbf24', '#fff'], 50, 300); g.sfx('boom'); g.shake(14); return g.end('Crashed'); }
      if (!k.passed && k.y > 600) { k.passed = true; if (Math.abs(k.x - g.x) < 62) { g.add(20, 'n'); g.float(g.x, 520, 'NEAR MISS +20', '#22d3ee', 15); g.sfx('whoosh'); } } }
    g.cars = g.cars.filter(k => k.y < g.H + 120);
    g.hud = Math.round(g.sp / 4) + ' km/h';
  },
  draw(g, c) {
    c.fillStyle = '#166534'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#374151'; c.fillRect(60, 0, 280, g.H); c.fillStyle = '#fff'; c.fillRect(60, 0, 4, g.H); c.fillRect(336, 0, 4, g.H);
    for (let l = 1; l < 4; l++) for (let y = (g.road % 60) - 60; y < g.H; y += 60) c.fillRect(60 + l * 70 - 2, y, 4, 30);
    for (let y = (g.road * 1 % 120) - 120; y < g.H; y += 120) { c.fillStyle = '#15803d'; Kit.circ(c, 25, y, 16, '#15803d'); Kit.circ(c, 375, y + 60, 16, '#15803d'); }
    const car = (x, y, col, truck, rot) => { const h = truck ? 90 : 56; c.save(); c.translate(x, y); c.rotate(rot || 0); c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(-20, -h / 2 + 6, 44, h); c.fillStyle = col; Kit.rr(c, -22, -h / 2, 44, h, 8); c.fill(); c.fillStyle = '#0f172a'; c.fillRect(-16, -h / 2 + 10, 32, 12); c.fillRect(-16, h / 2 - 18, 32, 8); c.restore(); };
    for (const k of g.cars) car(k.x, k.y, k.c, k.truck, Math.PI); car(g.x, 560, '#a855f7', false, g.tilt);
    c.fillStyle = 'rgba(253,224,71,.12)'; c.beginPath(); c.moveTo(g.x - 16, 532); c.lineTo(g.x - 50, 420); c.lineTo(g.x + 50, 420); c.lineTo(g.x + 16, 532); c.fill();
  } });

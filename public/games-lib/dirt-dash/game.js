// Dirt Dash - original side-view motocross with lanes, ramps and engine heat (Hub build)
Kit.run({ id: 'gl-dirt-dash', title: 'DIRT DASH', orient: 'l', help: 'Hold GAS (right side / Right), Up/Down to switch lane\nTURBO is faster but heats the engine - land ramps level', bg: '#0369a1',
  buttons: [{ id: 'U', key: 'ArrowUp', label: 'UP' }, { id: 'D', key: 'ArrowDown', label: 'DOWN' }, { id: 'T', key: 'x', label: 'TURBO' }],
  init(g) { g.lane = 1; g.ly = 1; g.x = 0; g.sp = 0; g.heat = 0; g.y = 0; g.vy = 0; g.tilt = 0; g.obs = []; for (let x = 600; x < 200000; x += g.R(250, 500)) g.obs.push({ x, lane: g.RI(0, 3), k: g.rnd() < 0.55 ? 'ramp' : 'mud', w: g.R(60, 110) }); g.lastM = 0; g.cool = 0; },
  update(g, dt) {
    if (g.kd('ArrowUp') || g.btnP.U) g.lane = Math.max(0, g.lane - 1); if (g.kd('ArrowDown') || g.btnP.D) g.lane = Math.min(3, g.lane + 1); g.ly = Kit.lerp(g.ly, g.lane, dt * 10);
    const turbo = g.keys.x || g.btn.T, gas = turbo || g.keys.ArrowRight || g.keys.d || g.keys[' '] || (g.ptr.down && !g.btn.U && !g.btn.D);
    if (g.cool > 0) { g.cool -= dt; g.sp = Kit.lerp(g.sp, 0, dt * 3); if (g.cool <= 0) g.heat = 0.3; } else { const top = turbo ? 520 : 400; g.sp = Kit.lerp(g.sp, gas ? top : 60, dt * (gas ? 1.2 : 2)); g.heat = Kit.clamp(g.heat + (turbo ? 0.22 : gas ? 0.02 : -0.15) * dt, 0, 1); if (g.heat >= 1) { g.cool = 2.5; g.sfx('bad'); g.float(g.W / 2, 120, 'OVERHEAT!', '#ef4444', 24); } }
    g.x += g.sp * dt; const m = Math.floor(g.x / 40); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    if (g.y > 0 || g.vy > 0) { g.vy -= 900 * dt; g.y += g.vy * dt; g.tilt += ((g.keys.ArrowLeft || g.keys.a ? -1 : 0) + (gas ? 0.4 : -0.4)) * 2 * dt; if (g.y <= 0) { g.y = 0; g.vy = 0; if (Math.abs(g.tilt) > 0.5) { g.sp = 0; g.cool = 1.5; g.sfx('hit'); g.shake(10); g.float(g.W / 2, 140, 'WIPEOUT', '#ef4444', 24); g.lives = (g.lives || 3) - 1; if (g.lives <= 0) return g.end('Too many wipeouts'); } else { g.add(30, 'j'); g.float(200, 200, 'CLEAN LANDING +30', '#34d399', 16); g.sfx('good'); } g.tilt = 0; } }
    for (const o of g.obs) { if (o.lane !== g.lane || o.done) continue; if (g.x > o.x && g.x < o.x + o.w && g.y === 0) { o.done = true; if (o.k === 'ramp') { g.vy = 260 + g.sp * 0.45; g.y = 0.1; g.tilt = -0.25; g.sfx('jump'); } else { g.sp *= 0.45; g.sfx('thud'); g.burst(200, 330 + g.lane * 30, '#78350f', 14, 120); } } }
    g.hud = Math.floor(g.x / 40) + ' m  ' + '\u2665'.repeat(g.lives || 3);
  },
  draw(g, c) {
    c.fillStyle = '#0369a1'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#1e40af'; for (let i = 0; i < 30; i++) { const x = ((i * 47 - g.x * 0.2) % 1400 + 1400) % 1400 - 100; c.fillRect(x, 200 - (i % 5) * 10, 30, 60); }
    c.fillStyle = '#16a34a'; c.fillRect(0, 260, g.W, 40); c.fillStyle = '#a16207'; c.fillRect(0, 300, g.W, 140); for (let l = 0; l <= 4; l++) { c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(0, 300 + l * 30, g.W, 2); }
    for (const o of g.obs) { const x = o.x - g.x + 200; if (x < -150 || x > g.W + 50) continue; const y = 300 + o.lane * 30; if (o.k === 'ramp') { c.fillStyle = '#92400e'; c.beginPath(); c.moveTo(x, y + 28); c.lineTo(x + o.w, y + 4); c.lineTo(x + o.w, y + 28); c.fill(); } else { c.fillStyle = '#451a03'; c.beginPath(); c.ellipse(x + o.w / 2, y + 18, o.w / 2, 9, 0, 0, 7); c.fill(); } }
    const y = 300 + g.ly * 30 + 22 - g.y * 0.4; c.save(); c.translate(200, y); c.rotate(g.tilt); Kit.circ(c, -18, 0, 10, '#111827'); Kit.circ(c, 18, 0, 10, '#111827'); c.fillStyle = '#ef4444'; c.beginPath(); c.moveTo(-18, -4); c.lineTo(12, -16); c.lineTo(20, -4); c.fill(); c.fillStyle = '#e5e7eb'; c.fillRect(-6, -30, 10, 16); Kit.circ(c, 0, -36, 7, '#facc15'); c.restore();
    c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(g.W / 2 - 80, 40, 160, 10); c.fillStyle = g.heat > 0.75 || g.cool > 0 ? '#ef4444' : '#fbbf24'; c.fillRect(g.W / 2 - 80, 40, 160 * g.heat, 10); g.txt('ENGINE HEAT', g.W / 2, 60, 10, '#fff');
  } });

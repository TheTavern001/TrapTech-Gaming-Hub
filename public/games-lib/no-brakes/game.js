// No Brakes - original brakeless mountain-road survival (Hub build). Speed only goes up.
Kit.run({ fill: true, id: 'gl-no-brakes', title: 'NO BRAKES', help: 'Steer: arrows / drag - there are no brakes\nStay on the twisting road, dodge oncoming cars', bg: '#365314',
  init(g) { g.x = 200; g.d = 0; g.sp = 250; g.cars = []; g.next = 1.2; g.lastM = 0; },
  update(g, dt) {
    let st = g.ax(); if (g.ptr.down) st = Kit.clamp((g.ptr.x - g.x) / 50, -1, 1); g.x += st * 300 * dt; g.sp += 6 * dt; g.d += g.sp * dt; const m = Math.floor(g.d / 40); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    const cx = center(g, g.d + 0); if (Math.abs(g.x - cx) > 92) { g.burst(g.x, 560, ['#a16207', '#fbbf24'], 40, 260); g.sfx('boom'); g.shake(12); return g.end('Off the cliff'); }
    g.next -= dt; if (g.next <= 0) { g.next = Math.max(0.6, 1.6 - g.t * 0.01); g.cars.push({ wd: g.d + 900, off: g.pick([-45, 45]), v: g.R(120, 200) }); }
    for (const k of g.cars) { k.wd -= k.v * dt; const y = 560 - (k.wd - g.d); const x = center(g, k.wd) + k.off; if (Math.abs(x - g.x) < 36 && Math.abs(y - 560) < 50) { g.burst(g.x, 560, ['#ef4444', '#fbbf24'], 50, 300); g.sfx('boom'); g.shake(14); return g.end('Head-on'); } if (!k.passed && y > 620) { k.passed = true; g.add(10, 'p'); } }
    g.cars = g.cars.filter(k => 560 - (k.wd - g.d) < g.H + 80); g.hud = Math.round(g.sp / 3) + ' km/h';
  },
  draw(g, c) {
    c.fillStyle = '#3f6212'; c.fillRect(0, 0, g.W, g.H);
    for (let y = g.H + 20; y > -20; y -= 8) { const wd = g.d + (560 - y), x = center(g, wd); c.fillStyle = '#57534e'; c.fillRect(x - 108, y, 216, 9); c.fillStyle = '#374151'; c.fillRect(x - 96, y, 192, 9); if (Math.floor(wd / 30) % 2) { c.fillStyle = '#facc15'; c.fillRect(x - 2, y, 4, 9); } c.fillStyle = Math.floor(wd / 20) % 2 ? '#ef4444' : '#fff'; c.fillRect(x - 108, y, 8, 9); c.fillRect(x + 100, y, 8, 9); }
    for (const k of g.cars) { const y = 560 - (k.wd - g.d), x = center(g, k.wd) + k.off; c.fillStyle = '#3b82f6'; Kit.rr(c, x - 18, y - 26, 36, 52, 8); c.fill(); c.fillStyle = '#fde68a'; c.fillRect(x - 14, y + 20, 8, 5); c.fillRect(x + 6, y + 20, 8, 5); }
    c.save(); c.translate(g.x, 560); c.fillStyle = '#dc2626'; Kit.rr(c, -18, -26, 36, 52, 8); c.fill(); c.fillStyle = '#0f172a'; c.fillRect(-13, -14, 26, 12); c.restore();
  } });
function center(g, wd) { return 200 + Math.sin(wd * 0.004) * 80 + Math.sin(wd * 0.0013 + 1) * 40 * Math.min(1, wd / 3000); }

// Green Dash - original top-down delivery scooter runner (Hub build, cannabis-delivery theme)
Kit.run({ id: 'gl-green-dash', title: 'GREEN DASH', help: 'Steer: drag / arrows. Hit the glowing drop zones\nEach delivery adds time - dodge traffic', bg: '#1f2937',
  init(g) { g.x = 200; g.scroll = 0; g.cars = []; g.next = 0.8; g.time = 25; g.zone = null; g.zt = 1.5; g.deliv = 0; g.sp = 300; g.lastM = 0; },
  update(g, dt) {
    let st = g.ax(); g.x = Kit.clamp(g.x + st * 280 * dt, 40, 360); if (g.ptr.down) g.x += Kit.clamp(g.ptr.x - g.x, -380 * dt, 380 * dt); g.x = Kit.clamp(g.x, 40, 360);
    g.time -= dt; if (g.time <= 0) return g.end('Out of time'); g.sp = Math.min(640, 300 + g.t * 4); const dy = g.sp * dt; g.scroll += dy; const m = Math.floor(g.scroll / 100); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    g.next -= dt; if (g.next <= 0) { g.next = Math.max(0.3, 0.9 - g.t * 0.005); g.cars.push({ x: 70 + g.RI(0, 4) * 65, y: -60, v: g.R(-60, 140), c: g.pick(['#ef4444', '#3b82f6', '#e5e7eb', '#fbbf24']) }); }
    for (const k of g.cars) { k.y += (g.sp - k.v) * dt; if (Math.abs(k.x - g.x) < 30 && Math.abs(k.y - 560) < 44) { g.sfx('boom'); g.burst(g.x, 560, ['#22c55e', '#fff'], 40, 260); g.shake(12); return g.end('Crashed the scooter'); } }
    g.cars = g.cars.filter(k => k.y < g.H + 80);
    g.zt -= dt; if (!g.zone && g.zt <= 0) g.zone = { side: g.rnd() < 0.5 ? 0 : 1, y: -60 }; if (g.zone) { g.zone.y += g.sp * dt; const zx = g.zone.side ? 375 : 25; if (Math.abs(g.zone.y - 560) < 34 && Math.abs(g.x - zx) < 50) { g.deliv++; g.add(100, 'd'); g.time = Math.min(40, g.time + 6); g.float(g.x, 500, 'DELIVERED +100  +6s', '#34d399', 18); g.sfx('power'); g.burst(zx, 560, '#34d399', 30, 200); g.zone = null; g.zt = g.R(1.5, 3); } else if (g.zone.y > g.H + 40) { g.zone = null; g.zt = 1; g.sfx('bad'); } }
    g.hud = Math.ceil(g.time) + 's  DROPS ' + g.deliv;
  },
  draw(g, c) {
    c.fillStyle = '#4b5563'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#9ca3af'; c.fillRect(0, 0, 40, g.H); c.fillRect(360, 0, 40, g.H);
    c.fillStyle = '#fff'; for (let l = 1; l < 5; l++) for (let y = (g.scroll % 70) - 70; y < g.H; y += 70) c.fillRect(40 + l * 64, y, 3, 34);
    for (let y = (g.scroll % 160) - 160; y < g.H; y += 160) { c.fillStyle = '#334155'; c.fillRect(0, y, 40, 120); c.fillRect(360, y + 60, 40, 120); }
    if (g.zone) { const zx = g.zone.side ? 375 : 25; Kit.glow(c, '#34d399', 18); c.strokeStyle = '#34d399'; c.lineWidth = 4; c.beginPath(); c.arc(zx, g.zone.y, 26 + Math.sin(g.t * 8) * 4, 0, 7); c.stroke(); Kit.noGlow(c); g.txt('DROP', zx, g.zone.y, 11, '#34d399'); }
    for (const k of g.cars) { c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(k.x - 20, k.y - 26, 44, 60); c.fillStyle = k.c; Kit.rr(c, k.x - 22, k.y - 30, 44, 60, 8); c.fill(); c.fillStyle = '#0f172a'; c.fillRect(k.x - 16, k.y + 10, 32, 12); }
    c.save(); c.translate(g.x, 560); c.fillStyle = '#111827'; c.fillRect(-4, -26, 8, 52); c.fillStyle = '#22c55e'; Kit.rr(c, -12, -14, 24, 30, 6); c.fill(); c.fillStyle = '#14532d'; c.fillRect(-10, 6, 20, 14); Kit.circ(c, 0, -4, 8, '#fcd9b6'); c.fillStyle = '#16a34a'; c.fillRect(-8, -14, 16, 6); c.restore();
    c.fillStyle = '#1d2a66'; c.fillRect(20, 46, g.W - 40, 8); c.fillStyle = g.time > 8 ? '#34d399' : '#ef4444'; c.fillRect(20, 46, (g.W - 40) * Math.min(1, g.time / 40), 8);
  } });

// Green Dash - original top-down delivery scooter runner (Hub build, cannabis-delivery theme) // @uses carart.js
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
    CarArt.road(c, g.W, g.H, g.scroll, { theme: 'city', x0: 40, x1: 360, lanes: 5, speed: true }); CarArt.roadside(c, g.W, g.H, g.scroll, { theme: 'city', x0: 40, x1: 360 });
    if (g.zone) { const zx = g.zone.side ? 375 : 25, zy = g.zone.y, pu = 26 + Math.sin(g.t * 8) * 4; c.save(); c.globalCompositeOperation = 'lighter'; const rg = c.createRadialGradient(zx, zy, 4, zx, zy, pu + 14); rg.addColorStop(0, 'rgba(52,211,153,.1)'); rg.addColorStop(0.75, 'rgba(52,211,153,.4)'); rg.addColorStop(1, 'rgba(52,211,153,0)'); c.fillStyle = rg; c.beginPath(); c.arc(zx, zy, pu + 14, 0, 7); c.fill(); c.restore(); c.strokeStyle = '#6ee7b7'; c.lineWidth = 3; c.setLineDash([7, 5]); c.lineDashOffset = -g.t * 30; c.beginPath(); c.arc(zx, zy, pu, 0, 7); c.stroke(); c.setLineDash([]); g.txt('DROP', zx, zy, 11, '#d1fae5'); }
    const kinds = ['sedan', 'suv', 'van']; for (const k of g.cars) CarArt.car(c, k.x, k.y, k.c, { kind: kinds[Math.abs(Math.floor(k.v)) % 3], scale: 1.12, brake: k.v < 0 });
    CarArt.scooter(c, g.x, 560, { body: '#22c55e', suit: '#14532d', lean: Kit.clamp((g.ptr.down ? (g.ptr.x - g.x) / 60 : g.ax()), -1, 1), boost: true, scale: 0.95 });
    c.fillStyle = 'rgba(8,12,24,.7)'; Kit.rr(c, 20, 45, g.W - 40, 10, 5); c.fill(); c.fillStyle = g.time > 8 ? '#34d399' : '#ef4444'; Kit.rr(c, 21, 46, Math.max(8, (g.W - 42) * Math.min(1, g.time / 40)), 8, 4); c.fill();
  } });

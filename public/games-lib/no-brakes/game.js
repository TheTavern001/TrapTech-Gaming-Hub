// @uses carart.js
// No Brakes - original brakeless mountain-road survival (Hub build). Speed only goes up.
const PY = (g) => g.H * 0.7;
Kit.run({ fill: true, id: 'gl-no-brakes', title: 'NO BRAKES', help: 'Steer: arrows / drag - there are no brakes\nStay on the twisting road, dodge oncoming cars', bg: '#365314',
  init(g) { g.x = 200; g.d = 0; g.sp = 250; g.cars = []; g.next = 1.2; g.lastM = 0; },
  update(g, dt) {
    let st = g.ax(); if (g.ptr.down) st = Kit.clamp((g.ptr.x - g.x) / 50, -1, 1); g.x += st * 300 * dt; g.sp += 6 * dt; g.d += g.sp * dt; const m = Math.floor(g.d / 40); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    const cx = center(g, g.d + 0); if (Math.abs(g.x - cx) > 92) { g.burst(g.x, PY(g), ['#a16207', '#fbbf24'], 40, 260); g.sfx('boom'); g.shake(12); return g.end('Off the cliff'); }
    g.next -= dt; if (g.next <= 0) { g.next = Math.max(0.6, 1.6 - g.t * 0.01); g.cars.push({ wd: g.d + 900, off: g.pick([-45, 45]), v: g.R(120, 200) }); }
    for (const k of g.cars) { k.wd -= k.v * dt; const y = PY(g) - (k.wd - g.d); const x = center(g, k.wd) + k.off; if (Math.abs(x - g.x) < 36 && Math.abs(y - PY(g)) < 50) { g.burst(g.x, PY(g), ['#ef4444', '#fbbf24'], 50, 300); g.sfx('boom'); g.shake(14); return g.end('Head-on'); } if (!k.passed && y > 620) { k.passed = true; g.add(10, 'p'); } }
    g.cars = g.cars.filter(k => PY(g) - (k.wd - g.d) < g.H + 80); g.hud = Math.round(g.sp / 3) + ' km/h';
  },
  draw(g, c) {
    const W = g.W, H = g.H, py = PY(g); c.fillStyle = '#365314'; c.fillRect(0, 0, W, H);
    for (let y = H + 20; y > -20; y -= 8) { const wd = g.d + (py - y), x = center(g, wd);
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x - 128, y, 256, 9); c.fillStyle = '#292524'; c.fillRect(x - 114, y, 228, 9); c.fillStyle = '#57534e'; c.fillRect(x - 108, y, 216, 9); c.fillStyle = '#3b4252'; c.fillRect(x - 96, y, 192, 9);
      if (Math.floor(wd / 30) % 2) { c.fillStyle = '#facc15'; c.fillRect(x - 2, y, 4, 9); } c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(x - 93, y, 2, 9); c.fillRect(x + 91, y, 2, 9); c.fillStyle = Math.floor(wd / 20) % 2 ? '#ef4444' : '#fff'; c.fillRect(x - 108, y, 8, 9); c.fillRect(x + 100, y, 8, 9); }
    // roadside pines + boulders (deterministic by world distance)
    for (let k = Math.floor(g.d / 90) - 1; k < Math.floor((g.d + H) / 90) + 2; k++) for (const sd of [-1, 1]) { const h = ((k * 2654435761) ^ (sd * 40503)) >>> 0; const wd = k * 90 + (h % 60), y = py - (wd - g.d); if (y < -40 || y > H + 40) continue; const x = center(g, wd) + sd * (130 + (h >> 4) % 70); if (h % 4 === 0) { c.fillStyle = '#78716c'; c.beginPath(); c.ellipse(x, y, 11, 8, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(x - 3, y - 3, 5, 3, 0, 0, 7); c.fill(); } else CarArt.tree(c, x, y, 16 + (h >> 8) % 8); }
    for (const k of g.cars) { const y = py - (k.wd - g.d), x = center(g, k.wd) + k.off; if (y < -80 || y > H + 80) continue; c.fillStyle = 'rgba(253,230,138,.12)'; c.beginPath(); c.moveTo(x - 14, y + 26); c.lineTo(x - 30, y + 110); c.lineTo(x + 30, y + 110); c.lineTo(x + 14, y + 26); c.fill(); CarArt.car(c, x, y, ['#3b82f6', '#a855f7', '#f59e0b', '#e5e7eb'][Math.floor(k.v) % 4], { kind: ['sedan', 'suv', 'van'][Math.floor(k.v / 7) % 3], angle: Math.PI, scale: 0.92 }); }
    c.save(); c.translate(g.x, py); c.rotate(Kit.clamp(g.ax() * 0.12 + (g.ptr.down ? Kit.clamp((g.ptr.x - g.x) / 50, -1, 1) * 0.12 : 0), -0.2, 0.2)); CarArt.car(c, 0, 0, '#dc2626', { kind: 'sedan', scale: 0.92 }); c.restore();
    c.globalAlpha = Math.min(0.2, (g.sp - 250) / 1500); c.fillStyle = '#fff'; for (let i = 0; i < 7; i++) c.fillRect((i * 59 + 13) % W, ((g.d * 1.5 + i * 211) % H), 2, 40 + g.sp / 10); c.globalAlpha = 1;
  } });
function center(g, wd) { return 200 + Math.sin(wd * 0.004) * 80 + Math.sin(wd * 0.0013 + 1) * 40 * Math.min(1, wd / 3000); }

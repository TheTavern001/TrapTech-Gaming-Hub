// Hill Glider - original hold-to-dive hill flyer (Hub build). Dive into downslopes, release on upslopes to launch.
(function () {
  const hy = (x) => 380 + Math.sin(x * 0.006) * 70 * (1 + Math.min(1.2, x / 20000)) + Math.sin(x * 0.0021) * 40;
  Kit.run({ id: 'gl-hill-glider', title: 'HILL GLIDER', orient: 'l', help: 'HOLD to dive down the slopes, release to fly\nBeat the sunset - perfect slides give speed boosts', bg: '#fdba74',
    init(g) { g.b = { x: 100, y: 200, vx: 260, vy: 0 }; g.cam = 0; g.sun = 60; g.dist = 0; g.lastM = 0; g.air = 0; g.perfect = 0; g.camY = 0; },
    update(g, dt) {
      const b = g.b, dive = g.held(); b.vy += (dive ? 2000 : 700) * dt; b.x += b.vx * dt; b.y += b.vy * dt; const gy = hy(b.x) - 10;
      if (b.y >= gy) { const sl = (hy(b.x + 3) - hy(b.x - 3)) / 6; b.y = gy; const n = Math.hypot(1, sl); const tv = (b.vx + b.vy * sl) / n; if (g.air > 0.6) { if (Math.abs(Math.atan(sl) - Math.atan2(b.vy, b.vx)) < 0.35 && sl > 0) { g.perfect++; g.add(25 * g.perfect, 'p'); g.float(b.x - g.cam, b.y - 40 - g.camY, 'PERFECT x' + g.perfect, '#22d3ee', 18); g.sfx('good'); } else { g.perfect = 0; g.sfx('thud'); } } g.air = 0;
        let sp = Math.max(120, tv + (sl > 0 && dive ? 900 : sl > 0 ? 300 : dive ? -500 : -260) * dt * (sl > 0 ? sl : -sl) * 1.5); sp -= 20 * dt; b.vx = sp / n; b.vy = sp * sl / n; } else g.air += dt;
      b.vx = Math.max(120, Math.min(900, b.vx)); g.sun -= dt; if (g.sun <= 0) return g.end('Night fell');
      if (g.perfect >= 3 && g.air > 0 && b.y < 80) { g.sun = Math.min(60, g.sun + dt * 2); }
      g.cam = b.x - 200; g.camY = Kit.lerp(g.camY, Math.min(0, b.y - 160), dt * 4); const m = Math.floor(b.x / 50); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
      g.hud = Math.floor(b.x / 50) + ' m   SUN ' + Math.ceil(g.sun) + 's';
    },
    draw(g, c) {
      const k = g.sun / 60; const sky = c.createLinearGradient(0, 0, 0, g.H); sky.addColorStop(0, `hsl(${200 + (1 - k) * 60},70%,${25 + k * 35}%)`); sky.addColorStop(1, `hsl(${25 + k * 10},90%,${30 + k * 35}%)`); c.fillStyle = sky; c.fillRect(0, 0, g.W, g.H);
      Kit.circ(c, g.W - 100, 80 + (1 - k) * 300, 40, '#fde047'); c.save(); c.translate(0, -g.camY);
      c.fillStyle = '#16a34a'; c.beginPath(); c.moveTo(0, g.H + 400); for (let x = 0; x <= g.W; x += 6) c.lineTo(x, hy(x + g.cam)); c.lineTo(g.W, g.H + 400); c.fill();
      for (let x = 0; x <= g.W; x += 6) { const wx = x + g.cam; c.fillStyle = Math.floor(wx / 120) % 2 ? '#22c55e' : '#15803d'; c.fillRect(x, hy(wx) + 4, 6, 400); }
      const b = g.b; const a = Math.atan2(b.vy, b.vx); c.save(); c.translate(b.x - g.cam, b.y); c.rotate(a); Kit.circ(c, 0, 0, 13, g.held() ? '#1d4ed8' : '#3b82f6'); Kit.circ(c, 5, -4, 4, '#fff'); Kit.circ(c, 6, -4, 2, '#111'); c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(12, 0); c.lineTo(20, 2); c.lineTo(12, 5); c.fill(); if (!g.held()) { c.fillStyle = '#60a5fa'; c.beginPath(); c.ellipse(-4, -10, 12, 5, -0.6 + Math.sin(g.t * 20) * 0.4, 0, 7); c.fill(); } c.restore(); c.restore();
    } });
})();

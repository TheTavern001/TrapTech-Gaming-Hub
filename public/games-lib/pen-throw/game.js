// Pen Throw - original throw-the-pen-at-moving-fruit timing game (Hub build)
Kit.run({ id: 'gl-pen-throw', title: 'PEN THROW', help: 'Tap / Space to throw the pen\nSpear the fruit as it slides past - miss and it\'s over', bg: '#312e81',
  init(g) { g.f = null; g.pen = null; g.n = 0; spawn(g); },
  update(g, dt) {
    const f = g.f; f.x += f.v * dt; if ((f.x > g.W - 30 && f.v > 0) || (f.x < 30 && f.v < 0)) f.v *= -1; if (f.bob) f.y = f.y0 + Math.sin(g.t * f.bob) * 60;
    if (!g.pen && g.tap()) { g.pen = { y: 620 }; g.sfx('whoosh'); }
    if (g.pen) { g.pen.y -= 1500 * dt; if (Math.abs(g.pen.y - f.y) < f.r && Math.abs(200 - f.x) < f.r) { g.n++; const center = 1 - Math.abs(200 - f.x) / f.r; const v = center > 0.7 ? 3 : 1; g.add(v, 'h'); g.float(200, f.y - 40, center > 0.7 ? 'PERFECT +3' : '+1', center > 0.7 ? '#fbbf24' : '#fff', 20); g.burst(f.x, f.y, f.c, 24, 220); g.sfx(center > 0.7 ? 'power' : 'pop'); g.pen = null; spawn(g); } else if (g.pen.y < -40) { g.pen = null; return g.end('Missed'); } }
    g.hud = 'HITS ' + g.n;
  },
  draw(g, c) {
    c.fillStyle = '#3730a3'; c.fillRect(0, 0, g.W, g.H); c.strokeStyle = 'rgba(255,255,255,.08)'; for (let x = 0; x < g.W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, g.H); c.stroke(); }
    const f = g.f; Kit.glow(c, f.c, 14); Kit.circ(c, f.x, f.y, f.r, f.c); Kit.noGlow(c); c.fillStyle = '#16a34a'; c.beginPath(); c.ellipse(f.x + 4, f.y - f.r, 6, 12, 0.4, 0, 7); c.fill(); Kit.circ(c, f.x - f.r * 0.35, f.y - f.r * 0.35, f.r * 0.2, 'rgba(255,255,255,.4)');
    const y = g.pen ? g.pen.y : 620; c.fillStyle = '#fde047'; c.fillRect(196, y - 70, 8, 70); c.fillStyle = '#111'; c.beginPath(); c.moveTo(196, y - 70); c.lineTo(200, y - 84); c.lineTo(204, y - 70); c.fill(); c.fillStyle = '#ef4444'; c.fillRect(196, y - 6, 8, 10);
  } });
function spawn(g) { const lv = Math.min(1, g.n / 30); g.f = { x: g.rnd() < 0.5 ? 30 : g.W - 30, y: g.R(140, 300), r: Math.max(16, 34 - lv * 16), v: (g.R(160, 240) + lv * 260) * (g.rnd() < 0.5 ? 1 : -1), c: g.pick(['#fbbf24', '#ef4444', '#f97316', '#a855f7']), bob: lv > 0.4 && g.rnd() < 0.4 ? g.R(1.5, 3) : 0 }; g.f.y0 = g.f.y; }

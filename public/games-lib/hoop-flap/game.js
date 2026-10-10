// Hoop Flap - original winged-ball flap through hoops (Hub build). Miss a hoop = game over; swish = bonus.
Kit.run({ id: 'gl-hoop-flap', title: 'HOOP FLAP', help: 'Tap / Space to flap\nDrop down through every hoop - clean swishes score double', bg: '#0c4a6e',
  init(g) { g.b = { y: 250, vy: 0 }; g.x = 0; g.hoops = []; g.nx = 380; g.streak = 0; for (let i = 0; i < 4; i++) add(g); },
  update(g, dt) {
    const b = g.b; if (g.tap()) { b.vy = -340; g.sfx('flap'); } b.vy += 1000 * dt; b.y += b.vy * dt; g.x += (180 + g.t * 1.5) * dt; if (b.y > g.H - 20 || b.y < -40) return g.end('Crashed');
    for (const h of g.hoops) { const hx = h.x - g.x; if (!h.done && Math.abs(hx - 120) < 30) { if (b.vy > 0 && Math.abs(b.y - h.y) < 14 && Math.abs(hx - 120) < 22) { h.done = true; const sw = Math.abs(hx - 120) < 10; g.streak = sw ? g.streak + 1 : 0; const v = sw ? 2 * Math.max(1, g.streak) : 1; g.add(v, 'h'); g.float(120, h.y - 40, sw ? 'SWISH +' + v : '+1', sw ? '#fbbf24' : '#fff', 18); g.sfx(sw ? 'power' : 'good'); g.burst(120, h.y, '#f97316', 14); } else if (Math.abs(b.y - h.y) < 20 && Math.abs(Math.abs(hx - 120) - 30) < 8) { b.vy = -Math.abs(b.vy) * 0.4; g.sfx('thud'); } }
      if (!h.done && hx < 80) { g.burst(120, b.y, '#ef4444', 30); return g.end('Missed a hoop'); } }
    g.hoops = g.hoops.filter(h => h.x - g.x > -60); while (g.hoops.length < 4) add(g);
  },
  draw(g, c) {
    c.fillStyle = '#075985'; for (let i = 0; i < 8; i++) { const x = ((i * 90 - g.x * 0.3) % 720 + 720) % 720 - 60; c.fillRect(x, 520 - (i % 3) * 40, 60, 200); } c.fillStyle = '#0369a1'; c.fillRect(0, g.H - 20, g.W, 20);
    for (const h of g.hoops) { const x = h.x - g.x; c.strokeStyle = h.done ? '#34d399' : '#f97316'; c.lineWidth = 6; c.beginPath(); c.ellipse(x, h.y, 30, 9, 0, Math.PI, 0); c.stroke(); }
    const b = g.b; Kit.circ(c, 120, b.y, 13, '#f97316'); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(108, b.y - 4, 12, 6, -0.5 + Math.sin(g.t * 25) * 0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(132, b.y - 4, 12, 6, 0.5 - Math.sin(g.t * 25) * 0.5, 0, 7); c.fill();
    for (const h of g.hoops) { const x = h.x - g.x; c.strokeStyle = h.done ? '#34d399' : '#f97316'; c.lineWidth = 6; c.beginPath(); c.ellipse(x, h.y, 30, 9, 0, 0, Math.PI); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(x + i * 12, h.y + 4); c.lineTo(x + i * 7, h.y + 28); c.stroke(); } }
  } });
function add(g) { g.hoops.push({ x: g.nx, y: g.R(200, 560) }); g.nx += g.R(230, 300); }

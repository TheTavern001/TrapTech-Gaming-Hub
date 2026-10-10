// Bud Bar - original 4-counter dispensary rush (Hub build, cannabis theme; mechanic in the spirit of bar-tapper games)
Kit.run({ id: 'gl-bud-bar', title: 'BUD BAR', help: 'Tap a counter (or Up/Down + Space) to slide an order\nServe every customer before they reach the end. Catch empties', bg: '#1c1917',
  init(g) { g.lane = 0; g.cust = []; g.bags = []; g.empties = []; g.lives = 3; g.next = 1; g.served = 0; },
  update(g, dt) {
    const LY = (i) => 200 + i * 110; if (g.kd('ArrowUp')) g.lane = (g.lane + 3) % 4; if (g.kd('ArrowDown')) g.lane = (g.lane + 1) % 4;
    let fire = g.kd(' '); if (g.ptr.pressed) { const i = Math.floor((g.ptr.y - 145) / 110); if (i >= 0 && i < 4) { if (i === g.lane) fire = true; g.lane = i; if (g.ptr.x > 300) fire = true; } }
    if (fire) { g.bags.push({ lane: g.lane, x: 330 }); g.sfx('whoosh'); }
    const pace = 1 + g.t / 60; g.next -= dt; if (g.next <= 0) { g.next = g.R(1.2, 2.6) / pace; g.cust.push({ lane: g.RI(0, 3), x: -20, sp: g.R(16, 26) * pace, back: 0, c: g.pick(['#f472b6', '#22d3ee', '#fbbf24', '#a855f7', '#34d399']) }); }
    for (const b of g.bags) { b.x -= 330 * dt; const hit = g.cust.filter(k => k.lane === b.lane && !k.back && Math.abs(k.x - b.x) < 18).sort((a, b2) => b2.x - a.x)[0]; if (hit) { b.dead = true; hit.back = 1; g.served++; g.add(50, 's'); g.float(hit.x, LY(hit.lane) - 40, '+50', '#34d399'); g.sfx('coin'); } else if (b.x < 20) { b.dead = true; miss(g, 'An order slid off the counter'); if (g.state !== 'play') return; } }
    for (const k of g.cust) { if (k.back) { k.x -= 160 * dt; if (k.x < -30) { k.dead = true; if (g.rnd() < 0.5) g.empties.push({ lane: k.lane, x: 0 }); } } else { k.x += k.sp * dt * (Math.sin(g.t * 3 + k.x) > 0 ? 1.4 : 0.4); if (k.x > 300) { k.dead = true; miss(g, 'A customer waited too long'); if (g.state !== 'play') return; } } }
    for (const e of g.empties) { e.x += 120 * dt; if (e.x > 310) { e.dead = true; if (e.lane === g.lane) { g.add(25, 'e'); g.sfx('click'); g.float(310, LY(e.lane) - 30, '+25', '#fbbf24'); } else { miss(g, 'A tray crashed'); if (g.state !== 'play') return; } } }
    g.bags = g.bags.filter(b => !b.dead); g.cust = g.cust.filter(k => !k.dead); g.empties = g.empties.filter(e => !e.dead); g.hud = 'SERVED ' + g.served + '  ' + '\u2665'.repeat(g.lives);
  },
  draw(g, c) {
    c.fillStyle = '#292524'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#14532d'; c.fillRect(0, 80, g.W, 40); g.txt('BUD BAR', g.W / 2, 100, 18, '#86efac');
    for (let i = 0; i < 4; i++) { const y = 200 + i * 110; c.fillStyle = '#78350f'; c.fillRect(10, y, 320, 18); c.fillStyle = '#a16207'; c.fillRect(10, y, 320, 5); c.fillStyle = '#44403c'; c.fillRect(10, y + 18, 320, 50); if (i === g.lane) { c.fillStyle = 'rgba(52,211,153,.18)'; c.fillRect(0, y - 50, g.W, 110); } }
    for (const k of g.cust) { const y = 200 + k.lane * 110; c.fillStyle = k.c; Kit.rr(c, k.x - 12, y - 46, 24, 40, 8); c.fill(); Kit.circ(c, k.x, y - 54, 10, '#fcd9b6'); if (k.back) { c.fillStyle = '#16a34a'; c.fillRect(k.x + 8, y - 34, 12, 14); } }
    for (const b of g.bags) { const y = 200 + b.lane * 110; c.fillStyle = '#16a34a'; c.fillRect(b.x - 8, y - 16, 16, 16); c.fillStyle = '#fff'; c.fillRect(b.x - 3, y - 12, 6, 6); }
    for (const e of g.empties) { const y = 200 + e.lane * 110; c.fillStyle = '#9ca3af'; c.fillRect(e.x - 9, y - 6, 18, 6); }
    const y = 200 + g.lane * 110; c.fillStyle = '#22c55e'; Kit.rr(c, 336, y - 48, 28, 44, 8); c.fill(); Kit.circ(c, 350, y - 58, 11, '#fcd9b6'); c.fillStyle = '#14532d'; c.fillRect(338, y - 70, 24, 6);
  } });
function miss(g, why) { g.lives--; g.sfx('bad'); g.shake(8); g.flash('#ef4444', 0.1); g.float(g.W / 2, 160, why, '#ef4444', 14); if (g.lives <= 0) g.end(why); }

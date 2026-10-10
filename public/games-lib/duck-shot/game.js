// Duck Shot - original flying-target shooting gallery (Hub build). 3 shots per pair, rounds speed up.
Kit.run({ id: 'gl-duck-shot', title: 'DUCK SHOT', help: 'Tap / click the flying birds (or aim with arrows + Space)\n3 shots per wave - miss 5 birds and it\'s over', bg: '#38bdf8',
  init(g) { g.round = 0; g.birds = []; g.shots = 3; g.missed = 0; g.aim = { x: 200, y: 300 }; g.next = 1; },
  update(g, dt) {
    g.aim.x = Kit.clamp(g.aim.x + g.ax() * 400 * dt, 0, g.W); g.aim.y = Kit.clamp(g.aim.y + g.ay() * 400 * dt, 0, 560);
    let sx = null, sy; if (g.ptr.pressed) { sx = g.ptr.x; sy = g.ptr.y; g.aim = { x: sx, y: sy }; } if (g.kd(' ')) { sx = g.aim.x; sy = g.aim.y; }
    if (sx !== null && g.shots > 0 && g.birds.some(b => !b.dead && !b.gone)) { g.shots--; g.sfx('boom'); g.flash('#fff', 0.05); for (const b of g.birds) if (!b.dead && !b.gone && Math.hypot(b.x - sx, b.y - sy) < 30) { b.dead = true; b.vy = 0; const v = 100 + g.round * 20 + (b.gold ? 400 : 0); g.add(v, 'k'); g.float(b.x, b.y - 30, '+' + v, b.gold ? '#fbbf24' : '#fff', 18); g.burst(b.x, b.y, ['#fff', '#78350f'], 18, 200); } }
    if (!g.birds.length) { g.next -= dt; if (g.next <= 0) { g.round++; g.mark('w', g.round); g.shots = 3; const n = g.round > 3 ? 2 : 1 + (g.round > 1 ? 1 : 0); for (let i = 0; i < n; i++) g.birds.push({ x: g.R(60, 340), y: 600, vx: g.R(-1, 1) * (120 + g.round * 15), vy: -(100 + g.round * 12), t: 0, gold: g.rnd() < 0.1 }); g.sfx('click'); } }
    for (const b of g.birds) { b.t += dt; if (b.dead) { b.vy += 900 * dt; b.y += b.vy * dt; continue; } if (b.gone) { b.y -= 300 * dt; continue; } if (g.rnd() < dt * 1.5) { b.vx = -b.vx + g.R(-40, 40); } b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < 20 || b.x > g.W - 20) b.vx = -b.vx; if (b.y < 60 || b.y > 560) b.vy = -b.vy; if (b.t > Math.max(3, 7 - g.round * 0.25) || (g.shots === 0)) { b.gone = true; g.missed++; g.sfx('bad'); } }
    if (g.birds.length && g.birds.every(b => (b.dead && b.y > g.H) || (b.gone && b.y < -40))) { g.birds = []; g.next = 1; if (g.missed >= 5) return g.end('Too many got away'); }
    g.hud = 'ROUND ' + g.round + '  SHOTS ' + g.shots + '  MISSED ' + g.missed + '/5';
  },
  draw(g, c) {
    c.fillStyle = '#38bdf8'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#16a34a'; c.fillRect(0, 560, g.W, 140); for (let i = 0; i < 9; i++) { Kit.circ(c, 20 + i * 48, 560, 34, '#15803d'); } c.fillStyle = '#65a30d'; c.fillRect(0, 590, g.W, 110);
    for (const b of g.birds) { c.save(); c.translate(b.x, b.y); if (b.dead) c.rotate(Math.PI); c.scale(b.vx < 0 ? -1 : 1, 1); c.fillStyle = b.gold ? '#fbbf24' : '#78350f'; c.beginPath(); c.ellipse(0, 0, 18, 10, 0, 0, 7); c.fill(); Kit.circ(c, 15, -8, 7, b.gold ? '#fbbf24' : '#166534'); c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(21, -8); c.lineTo(28, -6); c.lineTo(21, -4); c.fill(); c.fillStyle = b.gold ? '#fde68a' : '#a16207'; c.beginPath(); c.ellipse(-2, -6, 12, 5, Math.sin(g.t * 20) * 0.8, 0, 7); c.fill(); c.restore(); }
    c.strokeStyle = '#ef4444'; c.lineWidth = 2; c.beginPath(); c.arc(g.aim.x, g.aim.y, 16, 0, 7); c.moveTo(g.aim.x - 24, g.aim.y); c.lineTo(g.aim.x + 24, g.aim.y); c.moveTo(g.aim.x, g.aim.y - 24); c.lineTo(g.aim.x, g.aim.y + 24); c.stroke();
    for (let i = 0; i < g.shots; i++) { c.fillStyle = '#f97316'; c.fillRect(20 + i * 14, 650, 8, 20); }
  } });

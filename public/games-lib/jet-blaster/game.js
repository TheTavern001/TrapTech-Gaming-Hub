// Jet Blaster - original hold-to-fly jetpack runner (Hub build)
Kit.run({ id: 'gl-jet-blaster', title: 'JET BLASTER', orient: 'l', help: 'Hold to fly up, release to fall\nDodge zappers and missiles, grab coins', bg: '#0f172a',
  init(g) { g.p = { y: 300, vy: 0 }; g.sp = 260; g.d = 0; g.obs = []; g.coins = []; g.next = 1; g.lastM = 0; g.miss = []; g.mt = 6; },
  update(g, dt) {
    const p = g.p, up = g.held(); p.vy += (up ? -1500 : 1100) * dt; p.vy = Kit.clamp(p.vy, -420, 520); p.y += p.vy * dt; if (p.y < 40) { p.y = 40; p.vy = 0; } if (p.y > 395) { p.y = 395; p.vy = 0; }
    if (up && g.frames % 2) g.parts.push({ x: 150, y: p.y + 18, vx: g.R(-60, -20), vy: g.R(150, 260), l: 0.4, m: 0, c: g.pick(['#f97316', '#fbbf24', '#fff']), s: 4, gr: 0 });
    g.sp = Math.min(620, 260 + g.t * 5); const dx = g.sp * dt; g.d += dx; const m = Math.floor(g.d / 20); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    g.next -= dt; if (g.next <= 0) { g.next = g.R(0.9, 1.7) * 300 / g.sp * 1.6; const t = g.rnd(); if (t < 0.6) { const len = g.R(70, 160), y = g.R(60, 370), a = g.pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]); g.obs.push({ x: 860, y, len, a, rot: g.rnd() < 0.2 ? g.R(-2, 2) : 0 }); } else { const y0 = g.R(80, 340); for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) g.coins.push({ x: 860 + i * 26, y: y0 + j * 24 + Math.sin(i) * 10 }); } }
    g.mt -= dt; if (g.mt <= 0) { g.mt = g.R(4, 8) - Math.min(3, g.t / 30); g.miss.push({ x: 900, y: p.y, warn: 1.2 }); }
    for (const o of g.obs) { o.x -= dx; o.a += o.rot * dt; const ex = Math.cos(o.a) * o.len / 2, ey = Math.sin(o.a) * o.len / 2; const ax = o.x - ex, ay = o.y - ey, bx = o.x + ex, by = o.y + ey; const t = Kit.clamp(((150 - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / (o.len * o.len), 0, 1); if (Math.hypot(ax + (bx - ax) * t - 150, ay + (by - ay) * t - p.y) < 20) { g.burst(150, p.y, ['#facc15', '#fff'], 40, 260); g.sfx('boom'); g.flash('#facc15'); return g.end('Zapped'); } }
    for (const c of g.coins) { c.x -= dx; if (!c.got && Math.hypot(c.x - 150, c.y - p.y) < 22) { c.got = true; g.add(5, 'c'); g.sfx('coin'); } }
    for (const s of g.miss) { if (s.warn > 0) { s.warn -= dt; s.y = Kit.lerp(s.y, p.y, dt * 3); } else { s.x -= (g.sp + 380) * dt; if (Math.abs(s.x - 150) < 22 && Math.abs(s.y - p.y) < 16) { g.burst(150, p.y, ['#ef4444', '#fbbf24'], 40, 260); g.sfx('boom'); return g.end('Missile hit'); } } }
    g.obs = g.obs.filter(o => o.x > -120); g.coins = g.coins.filter(c => c.x > -20 && !c.got); g.miss = g.miss.filter(s => s.x > -40);
    g.hud = Math.floor(g.d / 20) + ' m';
  },
  draw(g, c) {
    c.fillStyle = '#1e293b'; for (let i = 0; i < 12; i++) { const x = ((i * 90 - g.d * 0.4) % 1080 + 1080) % 1080 - 100; c.fillRect(x, 20, 60, 400); c.fillStyle = '#0f172a'; c.fillRect(x + 8, 40, 44, 360); c.fillStyle = '#1e293b'; }
    c.fillStyle = '#334155'; c.fillRect(0, 0, g.W, 22); c.fillRect(0, 418, g.W, 32); c.fillStyle = '#fbbf24'; for (let x = -(g.d % 40); x < g.W; x += 40) c.fillRect(x, 418, 20, 4);
    for (const o of g.obs) { c.save(); c.translate(o.x, o.y); c.rotate(o.a); Kit.glow(c, '#facc15', 16); c.strokeStyle = '#fde047'; c.lineWidth = 6 + Math.sin(g.t * 40) * 2; c.beginPath(); c.moveTo(-o.len / 2, 0); for (let k = 1; k < 8; k++) c.lineTo(-o.len / 2 + k * o.len / 8, (Math.random() - 0.5) * 8); c.lineTo(o.len / 2, 0); c.stroke(); Kit.noGlow(c); Kit.circ(c, -o.len / 2, 0, 10, '#64748b'); Kit.circ(c, o.len / 2, 0, 10, '#64748b'); c.restore(); }
    for (const k of g.coins) { Kit.circ(c, k.x, k.y, 8, '#fbbf24'); c.fillStyle = '#fde68a'; c.fillRect(k.x - 2, k.y - 5, 3, 10); }
    for (const s of g.miss) { if (s.warn > 0) { if (Math.sin(g.t * 25) > 0) g.txt('!', g.W - 30, s.y, 30, '#ef4444'); } else { c.fillStyle = '#ef4444'; c.fillRect(s.x - 18, s.y - 6, 36, 12); c.fillStyle = '#f97316'; c.fillRect(s.x + 18, s.y - 4, 10 + Math.random() * 8, 8); } }
    const p = g.p; c.save(); c.translate(150, p.y); c.rotate(Kit.clamp(p.vy / 1500, -0.3, 0.3)); c.fillStyle = '#64748b'; c.fillRect(-20, -12, 12, 28); c.fillStyle = '#f97316'; Kit.rr(c, -10, -16, 22, 34, 6); c.fill(); Kit.circ(c, 2, -24, 11, '#fcd9b6'); c.fillStyle = '#7c2d12'; c.fillRect(-9, -36, 22, 7); c.restore();
  } });

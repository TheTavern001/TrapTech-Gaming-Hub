// Rock Buster - original vector space-rock shooter (Hub build)
Kit.run({ id: 'gl-rock-buster', title: 'ROCK BUSTER', help: 'Desktop: arrows rotate/thrust, Space fire\nTouch: stick to steer + thrust, FIRE button', bg: '#02030f', stick: true,
  buttons: [{ id: 'F', key: 'f', label: 'FIRE' }],
  init(g) { g.s = { x: 200, y: 350, a: -Math.PI / 2, vx: 0, vy: 0, inv: 2 }; g.rocks = []; g.sh = []; g.lv = 0; g.lives = 3; g.cd = 0; g.ufo = null; g.ub = []; next(g); },
  update(g, dt) {
    const s = g.s; let thr = false;
    if (g.stick.on && Math.hypot(g.stick.x, g.stick.y) > 0.3) { const ta = Math.atan2(g.stick.y, g.stick.x); let d = ta - s.a; d = Math.atan2(Math.sin(d), Math.cos(d)); s.a += Kit.clamp(d, -7 * dt, 7 * dt); thr = Math.hypot(g.stick.x, g.stick.y) > 0.6; }
    else { s.a += ((g.keys.ArrowRight || g.keys.d ? 1 : 0) - (g.keys.ArrowLeft || g.keys.a ? 1 : 0)) * 4.5 * dt; thr = g.keys.ArrowUp || g.keys.w; }
    if (thr) { s.vx += Math.cos(s.a) * 300 * dt; s.vy += Math.sin(s.a) * 300 * dt; if (g.frames % 2) g.parts.push({ x: s.x - Math.cos(s.a) * 12, y: s.y - Math.sin(s.a) * 12, vx: -Math.cos(s.a) * 120 + g.R(-30, 30), vy: -Math.sin(s.a) * 120 + g.R(-30, 30), l: 0.35, m: 0, c: '#f97316', s: 3, gr: 0 }); }
    s.vx *= Math.pow(0.6, dt); s.vy *= Math.pow(0.6, dt); s.x = (s.x + s.vx * dt + g.W) % g.W; s.y = (s.y + s.vy * dt + g.H) % g.H; s.inv -= dt;
    g.cd -= dt; if ((g.keys[' '] || g.btn.F || g.keys.f) && g.cd <= 0) { g.cd = 0.18; g.sh.push({ x: s.x + Math.cos(s.a) * 14, y: s.y + Math.sin(s.a) * 14, vx: Math.cos(s.a) * 480 + s.vx, vy: Math.sin(s.a) * 480 + s.vy, l: 0.9 }); g.sfx('shoot'); }
    for (const b of g.sh) { b.x = (b.x + b.vx * dt + g.W) % g.W; b.y = (b.y + b.vy * dt + g.H) % g.H; b.l -= dt; }
    for (const r of g.rocks) { r.x += r.vx * dt; r.y += r.vy * dt; if (r.x < -30) r.x += g.W + 60; if (r.x > g.W + 30) r.x -= g.W + 60; if (r.y < -30) r.y += g.H + 60; if (r.y > g.H + 30) r.y -= g.H + 60; r.a += r.va * dt;
      for (const b of g.sh) if (b.l > 0 && Math.hypot(b.x - r.x, b.y - r.y) < r.r) { b.l = 0; r.dead = true; }
      if (s.inv <= 0 && Math.hypot(s.x - r.x, s.y - r.y) < r.r + 8) { hitShip(g); if (g.state !== 'play') return; } }
    const born = []; for (const r of g.rocks) if (r.dead) { const v = r.sz === 3 ? 20 : r.sz === 2 ? 50 : 100; g.add(v, 'r'); g.float(r.x, r.y, v, '#e2e8f0', 13); g.burst(r.x, r.y, ['#cbd5e1', '#94a3b8', '#fbbf24'], 8 + r.sz * 5, 150); g.sfx(r.sz === 3 ? 'boom' : 'hit'); g.shake(r.sz * 2); if (r.sz > 1) for (let i = 0; i < 2; i++) born.push(rock(g, r.x, r.y, r.sz - 1)); }
    g.rocks = g.rocks.filter(r => !r.dead).concat(born); g.sh = g.sh.filter(b => b.l > 0);
    if (!g.ufo && g.lv > 1 && g.rnd() < dt * 0.06) g.ufo = { x: -20, y: g.R(80, g.H - 80), cd: 1.5, hp: 1 };
    if (g.ufo) { const u = g.ufo; u.x += 90 * dt; u.y += Math.sin(g.t * 2) * 50 * dt; u.cd -= dt; if (u.cd <= 0) { u.cd = 1.4; const a = Math.atan2(s.y - u.y, s.x - u.x) + g.R(-0.3, 0.3); g.ub.push({ x: u.x, y: u.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, l: 2.5 }); g.sfx('shoot'); }
      for (const b of g.sh) if (b.l > 0 && Math.hypot(b.x - u.x, b.y - u.y) < 18) { b.l = 0; g.add(300, 'u'); g.float(u.x, u.y, 300, '#f472b6', 20); g.burst(u.x, u.y, '#f472b6', 30, 220); g.sfx('boom'); g.ufo = null; break; } if (g.ufo && u.x > g.W + 30) g.ufo = null; }
    for (const b of g.ub) { b.x += b.vx * dt; b.y += b.vy * dt; b.l -= dt; if (s.inv <= 0 && Math.hypot(b.x - s.x, b.y - s.y) < 10) { b.l = 0; hitShip(g); if (g.state !== 'play') return; } } g.ub = g.ub.filter(b => b.l > 0);
    if (!g.rocks.length) { g.add(200 * g.lv, 'c'); g.sfx('line'); next(g); }
    g.hud = 'SECTOR ' + g.lv + '  ' + '\u25B2'.repeat(g.lives);
  },
  draw(g, c) {
    Kit.stars(c, g.W, g.H, 0, 0, 80); c.lineWidth = 2;
    for (const r of g.rocks) { c.save(); c.translate(r.x, r.y); c.rotate(r.a); c.strokeStyle = '#cbd5e1'; Kit.glow(c, '#94a3b8', 6); c.beginPath(); r.pts.forEach((p, i) => { const a = i / r.pts.length * Math.PI * 2; c[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r.r * p, Math.sin(a) * r.r * p); }); c.closePath(); c.stroke(); c.restore(); }
    Kit.noGlow(c); c.fillStyle = '#fde68a'; for (const b of g.sh) c.fillRect(b.x - 2, b.y - 2, 4, 4); c.fillStyle = '#f472b6'; for (const b of g.ub) c.fillRect(b.x - 2, b.y - 2, 5, 5);
    if (g.ufo) { const u = g.ufo; c.strokeStyle = '#f472b6'; Kit.glow(c, '#f472b6', 10); c.beginPath(); c.ellipse(u.x, u.y, 18, 7, 0, 0, 7); c.moveTo(u.x - 8, u.y - 5); c.lineTo(u.x - 4, u.y - 12); c.lineTo(u.x + 4, u.y - 12); c.lineTo(u.x + 8, u.y - 5); c.stroke(); Kit.noGlow(c); }
    const s = g.s; if (!(s.inv > 0 && Math.sin(g.t * 25) > 0)) { c.save(); c.translate(s.x, s.y); c.rotate(s.a); c.strokeStyle = '#22d3ee'; Kit.glow(c, '#22d3ee', 12); c.beginPath(); c.moveTo(15, 0); c.lineTo(-10, -9); c.lineTo(-5, 0); c.lineTo(-10, 9); c.closePath(); c.stroke(); Kit.noGlow(c); c.restore(); }
  } });
function rock(g, x, y, sz) { const a = g.R(0, 6.28), sp = g.R(30, 70) * (4 - sz) * 0.7 + g.lv * 4; return { x, y, sz, r: sz * 13 + 4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a: 0, va: g.R(-1, 1), pts: Array.from({ length: 11 }, () => g.R(0.72, 1.1)) }; }
function next(g) { g.lv++; g.mark('w', g.lv); for (let i = 0; i < 2 + g.lv; i++) { let x, y; do { x = g.R(0, g.W); y = g.R(0, g.H); } while (Math.hypot(x - g.s.x, y - g.s.y) < 150); g.rocks.push(rock(g, x, y, 3)); } g.s.inv = 1.5; }
function hitShip(g) { const s = g.s; g.lives--; g.burst(s.x, s.y, ['#22d3ee', '#fff'], 40, 260); g.sfx('boom'); g.shake(12); g.flash('#ef4444'); if (g.lives <= 0) return g.end('Ship lost'); s.x = 200; s.y = 350; s.vx = s.vy = 0; s.inv = 2.5; }

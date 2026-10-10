// Most Wanted Run - original top-down police-chase survival (Hub build)
Kit.run({ id: 'gl-wanted-run', title: 'MOST WANTED RUN', help: 'Steer: left/right arrows or hold left/right side\nSurvive the chase - make cops crash into each other', bg: '#14532d',
  init(g) { g.car = { x: 0, y: 0, a: -Math.PI / 2, sp: 260 }; g.cops = []; g.obj = []; g.heat = 1; g.ht = 0; g.next = 2; g.sec = 0; g.coins = []; for (let i = 0; i < 160; i++) g.obj.push({ x: g.R(-2000, 2000), y: g.R(-2000, 2000), r: g.R(14, 30), k: g.rnd() < 0.7 ? 't' : 'r' }); g.obj = g.obj.filter(o => Math.hypot(o.x, o.y) > 120); },
  update(g, dt) {
    const c0 = g.car; let st = g.ax(); if (g.ptr.down) st = g.ptr.x < g.W / 2 ? -1 : 1; c0.a += st * 3.1 * dt; c0.sp = Math.min(420, 260 + g.t * 2); c0.x += Math.cos(c0.a) * c0.sp * dt; c0.y += Math.sin(c0.a) * c0.sp * dt;
    if (st && g.frames % 3 === 0) g.parts.push({ x: g.W / 2 - Math.cos(c0.a) * 14, y: g.H / 2 - Math.sin(c0.a) * 14, vx: g.R(-20, 20), vy: g.R(-20, 20), l: 0.5, m: 0, c: 'rgba(200,200,200,.6)', s: 6, gr: 0 });
    // world recycling of obstacles around the car
    for (const o of g.obj) { if (o.x - c0.x > 2000) o.x -= 4000; if (c0.x - o.x > 2000) o.x += 4000; if (o.y - c0.y > 2000) o.y -= 4000; if (c0.y - o.y > 2000) o.y += 4000; if (Math.hypot(o.x - c0.x, o.y - c0.y) < o.r + 12) { g.burst(g.W / 2, g.H / 2, ['#ef4444', '#fbbf24', '#fff'], 40, 260); g.sfx('boom'); return g.end('Wrecked on a ' + (o.k === 't' ? 'tree' : 'rock')); } }
    g.sec += dt; const s = Math.floor(g.sec * 10); if (s > (g.ls || 0)) { g.add((s - (g.ls || 0)) * g.heat, 's'); g.ls = s; }
    g.ht += dt; if (g.ht > 15) { g.ht = 0; g.heat = Math.min(6, g.heat + 1); g.mark('w', g.heat); g.float(g.W / 2, 140, 'HEAT ' + g.heat + '\u2605', '#fbbf24', 26); g.sfx('power'); }
    g.next -= dt; if (g.next <= 0 && g.cops.length < 3 + g.heat * 2) { g.next = Math.max(0.6, 3 - g.heat * 0.35); const a = g.R(0, 6.28); g.cops.push({ x: c0.x + Math.cos(a) * 520, y: c0.y + Math.sin(a) * 520, a: a + Math.PI, sp: 250 + g.heat * 28 + g.R(-20, 20), tank: g.heat >= 4 && g.rnd() < 0.2 }); }
    for (const p of g.cops) { const ta = Math.atan2(c0.y + Math.sin(c0.a) * 60 - p.y, c0.x + Math.cos(c0.a) * 60 - p.x); let d = ta - p.a; d = Math.atan2(Math.sin(d), Math.cos(d)); p.a += Kit.clamp(d, -2.4 * dt, 2.4 * dt); const sp = p.tank ? p.sp * 0.8 : p.sp; p.x += Math.cos(p.a) * sp * dt; p.y += Math.sin(p.a) * sp * dt;
      if (Math.hypot(p.x - c0.x, p.y - c0.y) < (p.tank ? 26 : 20)) { g.burst(g.W / 2, g.H / 2, ['#3b82f6', '#ef4444', '#fff'], 40, 260); g.sfx('boom'); return g.end('Busted!'); }
      for (const o of g.obj) if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + 10) p.dead = true;
      for (const q of g.cops) if (q !== p && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 22) { p.dead = true; if (!q.tank) q.dead = true; } }
    for (const p of g.cops) if (p.dead) { g.add(50 * g.heat, 'k'); g.burst(p.x - c0.x + g.W / 2, p.y - c0.y + g.H / 2, ['#3b82f6', '#ef4444', '#fbbf24'], 25, 220); g.sfx('boom'); g.shake(6); g.float(p.x - c0.x + g.W / 2, p.y - c0.y + g.H / 2 - 20, '+' + 50 * g.heat, '#fbbf24'); }
    g.cops = g.cops.filter(p => !p.dead && Math.hypot(p.x - c0.x, p.y - c0.y) < 1200);
    g.hud = '\u2605'.repeat(g.heat) + '  ' + Math.floor(g.sec) + 's';
  },
  draw(g, c) {
    const c0 = g.car, ox = g.W / 2 - c0.x, oy = g.H / 2 - c0.y; c.fillStyle = '#166534'; c.fillRect(0, 0, g.W, g.H);
    c.fillStyle = '#334155'; const gs = 400; for (let x = Math.floor(-ox / gs) * gs; x < -ox + g.W + gs; x += gs) c.fillRect(x + ox - 30, 0, 60, g.H); for (let y = Math.floor(-oy / gs) * gs; y < -oy + g.H + gs; y += gs) c.fillRect(0, y + oy - 30, g.W, 60);
    for (const o of g.obj) { const x = o.x + ox, y = o.y + oy; if (x < -40 || y < -40 || x > g.W + 40 || y > g.H + 40) continue; if (o.k === 't') { Kit.circ(c, x + 4, y + 4, o.r, 'rgba(0,0,0,.25)'); Kit.circ(c, x, y, o.r, '#15803d'); Kit.circ(c, x - o.r * 0.3, y - o.r * 0.3, o.r * 0.5, '#22c55e'); } else { c.fillStyle = '#78716c'; c.beginPath(); c.arc(x, y, o.r * 0.8, 0, 7); c.fill(); } }
    const car = (x, y, a, body, roof, siren) => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-14, -8, 32, 20); c.fillStyle = body; Kit.rr(c, -16, -10, 32, 20, 5); c.fill(); c.fillStyle = roof; c.fillRect(-6, -8, 12, 16); if (siren) { c.fillStyle = Math.sin(g.t * 20) > 0 ? '#ef4444' : '#3b82f6'; c.fillRect(-2, -8, 4, 16); } c.restore(); };
    for (const p of g.cops) car(p.x + ox, p.y + oy, p.a, p.tank ? '#065f46' : '#f8fafc', p.tank ? '#022c22' : '#111827', !p.tank);
    car(g.W / 2, g.H / 2, c0.a, '#f97316', '#7c2d12', false);
    for (const p of g.cops) { const dx = p.x - c0.x, dy = p.y - c0.y; if (Math.abs(dx) > g.W / 2 || Math.abs(dy) > g.H / 2) { const a = Math.atan2(dy, dx); Kit.circ(c, g.W / 2 + Math.cos(a) * 170, g.H / 2 + Math.sin(a) * 300, 5, '#ef4444'); } }
  } });

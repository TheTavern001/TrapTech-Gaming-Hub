// Lawn Guard - original 5-lane garden defense (Hub build). Collect sun, plant defenders, survive endless waves.
(function () {
  const ROWS = 5, COLS = 9, CW = 76, CH = 72, OX = 100, OY = 70;
  const PL = [{ k: 'sun', n: 'Sunbloom', cost: 50, hp: 6, c: '#fbbf24' }, { k: 'pea', n: 'Pea Pod', cost: 100, hp: 6, c: '#22c55e' }, { k: 'wall', n: 'Rock Nut', cost: 50, hp: 40, c: '#a16207' }, { k: 'ice', n: 'Frost Pod', cost: 175, hp: 6, c: '#38bdf8' }, { k: 'boom', n: 'Boom Berry', cost: 150, hp: 99, c: '#ef4444' }];
  Kit.run({ id: 'gl-lawn-guard', title: 'LAWN GUARD', orient: 'l', help: 'Tap a seed card, then a lawn tile to plant\nTap falling suns to collect - hold the lawn', bg: '#14532d',
    init(g) { g.sun = 150; g.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null)); g.z = []; g.peas = []; g.suns = []; g.sel = 1; g.wave = 0; g.wt = 12; g.queue = 0; g.st = 0; g.cd = PL.map(() => 0); g.mowers = Array(ROWS).fill(true); },
    update(g, dt) {
      for (let i = 0; i < PL.length; i++) { g.cd[i] = Math.max(0, g.cd[i] - dt); if (g.kd(String(i + 1))) g.sel = i; }
      const P = g.ptr; if (P.pressed) {
        let took = false; for (const s of g.suns) if (Math.hypot(s.x - P.x, s.y - P.y) < 30) { s.got = true; took = true; g.sun += 25; g.sfx('coin'); }
        if (!took) { if (P.y < 60) { const i = Math.floor((P.x - 100) / 92); if (i >= 0 && i < PL.length) { g.sel = i; g.sfx('click'); } }
          else { const c = Math.floor((P.x - OX) / CW), r = Math.floor((P.y - OY) / CH); if (c >= 0 && c < COLS && r >= 0 && r < ROWS) plant(g, r, c); } } }
      if (g.kd(' ')) { // keyboard: plant selected in the most threatened free tile
        let best = null; for (let r = 0; r < ROWS; r++) for (let c = 0; c < 4; c++) if (!g.grid[r][c]) { best = best || [r, c]; } if (best) plant(g, best[0], best[1]); for (const s of g.suns) { s.got = true; g.sun += 25; } }
      g.st -= dt; if (g.st <= 0) { g.st = 9; g.suns.push({ x: g.R(OX + 40, OX + CW * COLS - 40), y: -20, ty: g.R(OY + 40, OY + CH * ROWS - 20), l: 10 }); }
      for (const s of g.suns) { if (s.y < s.ty) s.y += 60 * dt; s.l -= dt; } g.suns = g.suns.filter(s => !s.got && s.l > 0);
      // waves
      g.wt -= dt; if (g.wt <= 0 && g.queue <= 0) { g.wave++; g.mark('w', g.wave); g.queue = 3 + Math.floor(g.wave * 1.7); g.wt = 4; g.float(g.W / 2, 220, 'WAVE ' + g.wave, '#ef4444', 30); g.sfx('bad'); }
      if (g.queue > 0) { g.qt = (g.qt || 0) - dt; if (g.qt <= 0) { g.qt = Math.max(0.6, 3.2 - g.wave * 0.12) * g.R(0.6, 1.3); g.queue--; const r = g.RI(0, ROWS - 1); const t = g.wave > 4 && g.rnd() < 0.25 ? 'cone' : g.wave > 8 && g.rnd() < 0.15 ? 'bucket' : 'z'; g.z.push({ r, x: g.W + 20, hp: { z: 10, cone: 24, bucket: 50 }[t], max: 0, t, sp: g.R(14, 20), slow: 0, eat: 0 }); if (g.queue === 0) g.wt = 10; } }
      for (const z of g.z) { const sp = z.sp * (z.slow > 0 ? 0.5 : 1); z.slow -= dt; const c = Math.floor((z.x - OX - 20) / CW); const p = c >= 0 && c < COLS ? g.grid[z.r][c] : null;
        if (p && z.x - (OX + c * CW + CW / 2) < 34) { z.eat += dt; if (z.eat > 0.5) { z.eat = 0; p.hp--; g.sfx('click'); if (p.hp <= 0) g.grid[z.r][c] = null; } } else z.x -= sp * dt;
        if (z.x < OX - 10) { if (g.mowers[z.r]) { g.mowers[z.r] = false; g.sfx('boom'); g.shake(8); for (const q of g.z) if (q.r === z.r) { q.hp = 0; q.mowed = true; } } else return g.end('They reached the house'); } }
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const p = g.grid[r][c]; if (!p) continue; p.t += dt; const y = OY + r * CH + CH / 2, x = OX + c * CW + CW / 2;
        if (p.k === 'sun' && p.t > 10) { p.t = 0; g.suns.push({ x: x + 10, y: y - 10, ty: y + 10, l: 10 }); }
        if ((p.k === 'pea' || p.k === 'ice') && p.t > 1.5 && g.z.some(z => z.r === r && z.x > x)) { p.t = 0; g.peas.push({ x: x + 20, y: y - 8, r, ice: p.k === 'ice' }); g.sfx('pop'); }
        if (p.k === 'boom' && p.t > 1.2) { g.grid[r][c] = null; g.sfx('boom'); g.shake(10); g.burst(x, y, ['#ef4444', '#fbbf24', '#fff'], 50, 300); for (const z of g.z) if (Math.abs(z.r - r) <= 1 && Math.abs(z.x - x) < CW * 1.5) z.hp -= 60; } }
      for (const b of g.peas) { b.x += 300 * dt; for (const z of g.z) if (z.r === b.r && z.hp > 0 && Math.abs(z.x - b.x) < 16) { z.hp -= 2; if (b.ice) z.slow = 3; b.dead = true; g.burst(b.x, b.y, b.ice ? '#38bdf8' : '#4ade80', 5, 80, 0.3); break; } } g.peas = g.peas.filter(b => !b.dead && b.x < g.W + 10);
      for (const z of g.z) if (z.hp <= 0) { const v = { z: 10, cone: 25, bucket: 50 }[z.t]; if (!z.mowed) g.add(v, 'z'); g.burst(z.x, OY + z.r * CH + CH / 2, ['#65a30d', '#a3e635'], 14, 160); if (!z.mowed) g.float(z.x, OY + z.r * CH + 10, '+' + v, '#fff', 13); }
      g.z = g.z.filter(z => z.hp > 0);
      if (g.queue === 0 && !g.z.length && g.wave > 0 && !g.cleared) { g.cleared = true; g.add(100 * g.wave, 'c'); g.float(g.W / 2, 200, 'WAVE CLEAR +' + 100 * g.wave, '#34d399', 22); g.sfx('line'); g.wt = Math.min(g.wt, 5); } if (g.queue > 0) g.cleared = false;
      g.hud = 'WAVE ' + g.wave;
    },
    draw(g, c) {
      for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) { c.fillStyle = (r + cc) % 2 ? '#4d7c0f' : '#65a30d'; c.fillRect(OX + cc * CW, OY + r * CH, CW, CH); }
      c.fillStyle = '#78350f'; c.fillRect(0, OY, OX - 30, CH * ROWS); for (let r = 0; r < ROWS; r++) if (g.mowers[r]) { c.fillStyle = '#ef4444'; c.fillRect(OX - 28, OY + r * CH + 26, 24, 18); }
      for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) { const p = g.grid[r][cc]; if (!p) continue; const x = OX + cc * CW + CW / 2, y = OY + r * CH + CH / 2, b = Math.sin(g.t * 3 + cc) * 2;
        c.fillStyle = '#15803d'; c.fillRect(x - 3, y, 6, 22); if (p.k === 'sun') { for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + g.t; Kit.circ(c, x + Math.cos(a) * 16, y - 6 + b + Math.sin(a) * 16, 6, '#f59e0b'); } Kit.circ(c, x, y - 6 + b, 13, '#fbbf24'); }
        else if (p.k === 'wall') { c.fillStyle = '#a16207'; c.beginPath(); c.ellipse(x, y + 4, 24, 30, 0, 0, 7); c.fill(); if (p.hp < 20) { c.strokeStyle = '#451a03'; c.beginPath(); c.moveTo(x - 10, y - 10); c.lineTo(x + 4, y + 8); c.stroke(); } }
        else if (p.k === 'boom') { const s = 1 + p.t * 0.4; Kit.circ(c, x, y, 16 * s, '#ef4444'); Kit.circ(c, x - 5, y - 5, 4, '#fff'); }
        else { Kit.circ(c, x, y - 8 + b, 18, p.k === 'ice' ? '#38bdf8' : '#22c55e'); c.fillStyle = p.k === 'ice' ? '#0284c7' : '#15803d'; c.fillRect(x + 10, y - 16 + b, 16, 14); Kit.circ(c, x + 2, y - 14 + b, 4, '#fff'); Kit.circ(c, x + 3, y - 14 + b, 2, '#111'); } }
      for (const z of g.z) { const y = OY + z.r * CH + CH / 2, x = z.x, w = Math.sin(g.t * 6 + x) * 3; c.fillStyle = z.slow > 0 ? '#7dd3fc' : '#84cc16'; c.fillRect(x - 12, y - 22, 24, 34); Kit.circ(c, x - 2, y - 32, 13, z.slow > 0 ? '#bae6fd' : '#a3e635'); c.fillStyle = '#3f6212'; c.fillRect(x - 10 + w, y + 12, 8, 14); c.fillRect(x + 2 - w, y + 12, 8, 14); c.fillRect(x - 24, y - 16, 14, 6);
        if (z.t === 'cone') { c.fillStyle = '#f97316'; c.beginPath(); c.moveTo(x - 12, y - 40); c.lineTo(x + 8, y - 40); c.lineTo(x - 2, y - 62); c.fill(); } if (z.t === 'bucket') { c.fillStyle = '#94a3b8'; c.fillRect(x - 13, y - 52, 22, 16); } Kit.circ(c, x - 7, y - 34, 3, '#fff'); }
      for (const b of g.peas) Kit.circ(c, b.x, b.y, 6, b.ice ? '#7dd3fc' : '#4ade80');
      for (const s of g.suns) { Kit.glow(c, '#fde047', 16); Kit.circ(c, s.x, s.y, 16, '#fde047'); Kit.noGlow(c); }
      c.fillStyle = 'rgba(5,7,20,.7)'; c.fillRect(0, 0, g.W, 62); Kit.circ(c, 60, 32, 16, '#fde047'); g.txt(g.sun, 60, 32, 14, '#111');
      PL.forEach((p, i) => { const x = 100 + i * 92; c.fillStyle = g.sel === i ? '#6366f1' : '#1d2a66'; Kit.rr(c, x, 6, 86, 50, 8); c.fill(); Kit.circ(c, x + 18, 30, 11, p.c); g.txt(p.n, x + 54, 22, 11, '#fff'); g.txt(p.cost, x + 54, 42, 13, g.sun >= p.cost ? '#fde047' : '#ef4444'); if (g.cd[i] > 0) { c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x, 6, 86, 50 * g.cd[i] / 6); } });
    } });
  function plant(g, r, c) { const p = PL[g.sel]; if (g.grid[r][c] || g.sun < p.cost || g.cd[g.sel] > 0) { g.sfx('bad'); return; } g.sun -= p.cost; g.cd[g.sel] = p.k === 'boom' ? 20 : p.k === 'wall' ? 12 : 6; g.grid[r][c] = { k: p.k, hp: p.hp, t: 0 }; g.sfx('thud'); g.burst(OX + c * CW + CW / 2, OY + r * CH + CH / 2, '#a3e635', 10, 100); }
})();

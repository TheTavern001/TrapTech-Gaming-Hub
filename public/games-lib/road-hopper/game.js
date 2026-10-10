// Road Hopper - original lane-crossing hopper (Hub build). Isometric-ish blocky look, roads, rivers with logs, rails.
(function () {
  const TS = 40, COLS = 10;
  function row(g, i) { if (i < 4) return { t: 'g', trees: i > 0 ? [0, 9] : [] }; const lvl = Math.min(1, i / 300); const r = g.rnd();
    if (r < 0.38) return { t: 'r', sp: g.R(70, 120 + 120 * lvl) * (g.rnd() < 0.5 ? -1 : 1), cars: [], gap: g.R(150, 260), next: 0, col: g.pick(['#ef4444', '#3b82f6', '#fbbf24', '#a855f7', '#f97316']) };
    if (r < 0.58) return { t: 'w', sp: g.R(45, 90 + 50 * lvl) * (g.rnd() < 0.5 ? -1 : 1), logs: [], next: 0 };
    if (r < 0.66 && i > 12) return { t: 't', warn: 0, train: null, cd: g.R(2, 5) };
    const trees = []; for (let x = 0; x < COLS; x++) if (g.rnd() < 0.18) trees.push(x); return { t: 'g', trees }; }
  Kit.run({ id: 'gl-road-hopper', title: 'ROAD HOPPER', help: 'Tap / Up to hop forward, swipe or arrows to dodge\nDon\'t stall - the hawk is watching', bg: '#14532d',
    init(g) { g.rows = []; for (let i = 0; i < 30; i++) g.rows.push(row(g, i)); g.p = { x: 4, y: 0, hx: 4, hy: 0, ht: 1, on: null }; g.cam = 0; g.best = g.best; g.far = 0; g.idle = 0; g.coins = new Set(); for (let i = 5; i < 30; i++) if (g.rnd() < 0.15) g.coins.add(i + ',' + g.RI(0, 9)); },
    update(g, dt) {
      const p = g.p; p.ht = Math.min(1, p.ht + dt * 9);
      let mv = null; if (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) mv = [0, 1]; if (g.kd('ArrowDown') || g.kd('s')) mv = [0, -1]; if (g.kd('ArrowLeft') || g.kd('a')) mv = [-1, 0]; if (g.kd('ArrowRight') || g.kd('d')) mv = [1, 0];
      if (g.ptr.released) { const dx = g.ptr.x - g.ptr.sx, dy = g.ptr.y - g.ptr.sy; mv = Math.hypot(dx, dy) < 20 ? [0, 1] : Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, -Math.sign(dy)]; }
      if (mv && p.ht >= 0.6) { const nx = Math.round(p.x) + mv[0], ny = p.y + mv[1]; const R = g.rows[ny]; if (nx >= 0 && nx < COLS && ny >= 0 && !(R && R.t === 'g' && R.trees.includes(nx))) { p.hx = p.x; p.hy = p.y; p.x = nx; p.y = ny; p.ht = 0; g.sfx('jump'); g.idle = 0; if (ny > g.far) { g.add(ny - g.far, 'r'); g.far = ny; } const ck = ny + ',' + nx; if (g.coins.delete(ck)) { g.add(5, 'c'); g.sfx('coin'); g.float(g.W / 2, 300, '+5', '#fbbf24'); } } }
      while (g.rows.length < p.y + 25) { const i = g.rows.length; g.rows.push(row(g, i)); if (g.rnd() < 0.15) g.coins.add(i + ',' + g.RI(0, 9)); }
      g.idle += dt; const tc = p.y - 3; g.cam = Kit.lerp(g.cam, tc, dt * 3); if (p.y < g.cam - 2.2 || g.idle > 8) { return g.end(g.idle > 8 ? 'Too slow - the hawk got you' : 'Left behind'); }
      for (let i = Math.max(0, p.y - 8); i < p.y + 16; i++) { const R = g.rows[i]; if (!R) continue;
        if (R.t === 'r') { R.next -= dt; if (R.next <= 0) { R.next = R.gap / Math.abs(R.sp) + g.R(0.3, 1.6); R.cars.push({ x: R.sp > 0 ? -2 : COLS + 1, w: g.rnd() < 0.2 ? 2.4 : 1.4 }); } for (const c of R.cars) c.x += R.sp / TS * dt; R.cars = R.cars.filter(c => c.x > -4 && c.x < COLS + 4);
          if (i === p.y && p.ht > 0.5) for (const c of R.cars) if (p.x + 0.35 > c.x - c.w / 2 && p.x - 0.35 < c.x + c.w / 2) { g.burst(g.W / 2, 0, '#fff', 1); squash(g); return g.end('Flattened'); } }
        if (R.t === 'w') { R.next -= dt; if (R.next <= 0) { R.next = g.R(1.1, 2.2) * 70 / Math.abs(R.sp); R.logs.push({ x: R.sp > 0 ? -3 : COLS + 2, w: g.pick([2, 3, 3, 4]) }); } for (const L of R.logs) L.x += R.sp / TS * dt; R.logs = R.logs.filter(L => L.x > -5 && L.x < COLS + 5); }
        if (R.t === 't') { R.cd -= dt; if (!R.train && R.cd < 1.2 && R.cd > 0) R.warn = 1; if (R.cd <= 0 && !R.train) { R.train = { x: -14, sp: 22 }; R.warn = 0; } if (R.train) { R.train.x += R.train.sp * dt; if (i === p.y && p.x > R.train.x && p.x < R.train.x + 12) { squash(g); return g.end('Hit by a train'); } if (R.train.x > COLS + 2) { R.train = null; R.cd = g.R(3, 7); } } }
      }
      const R = g.rows[p.y]; if (R && R.t === 'w' && p.ht >= 1) { const L = R.logs.find(L => p.x > L.x - 0.6 && p.x < L.x + L.w - 0.4); if (!L) { g.burst(g.W / 2, 400, '#38bdf8', 30, 160); g.sfx('whoosh'); return g.end('Splash!'); } p.x += R.sp / TS * dt; if (p.x < -0.4 || p.x > COLS - 0.6) return g.end('Swept away'); }
      else if (p.ht >= 1) p.x = Math.round(p.x) === p.x ? p.x : Kit.lerp(p.x, Math.round(p.x), Math.min(1, dt * 12));
      g.hud = g.far + ' rows';
    },
    draw(g, c) {
      const base = g.H - 140; const y0 = (i) => base - (i - g.cam) * TS; const ox = 0;
      for (let i = Math.floor(g.cam) - 4; i < g.cam + 18; i++) { const R = g.rows[i]; if (!R) continue; const y = y0(i);
        c.fillStyle = R.t === 'g' ? (i % 2 ? '#22c55e' : '#16a34a') : R.t === 'r' ? '#334155' : R.t === 'w' ? '#0ea5e9' : '#57534e'; c.fillRect(0, y - TS / 2, g.W, TS);
        if (R.t === 'r') { c.fillStyle = 'rgba(255,255,255,.4)'; for (let x = 0; x < g.W; x += 40) c.fillRect(x, y - 1, 20, 2); for (const car of R.cars) { const cx = ox + car.x * TS + TS / 2; c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(cx - car.w * TS / 2 + 3, y - 12, car.w * TS, 26); c.fillStyle = car.w > 2 ? '#e2e8f0' : R.col; c.fillRect(cx - car.w * TS / 2, y - 15, car.w * TS, 26); c.fillStyle = '#93c5fd'; c.fillRect(cx + (R.sp > 0 ? car.w * TS / 2 - 14 : -car.w * TS / 2 + 4), y - 11, 10, 18); } }
        if (R.t === 'w') { c.fillStyle = 'rgba(255,255,255,.25)'; for (let x = (g.t * 20 * Math.sign(R.sp)) % 60 - 60; x < g.W; x += 60) c.fillRect(x, y + 6, 18, 2); for (const L of R.logs) { c.fillStyle = '#92400e'; Kit.rr(c, ox + L.x * TS + 4, y - 13, L.w * TS - 8, 26, 8); c.fill(); c.fillStyle = '#b45309'; c.fillRect(ox + L.x * TS + 8, y - 9, L.w * TS - 16, 4); } }
        if (R.t === 't') { c.fillStyle = '#78716c'; for (let x = 0; x < g.W; x += 16) c.fillRect(x, y - 14, 6, 28); c.fillStyle = '#a8a29e'; c.fillRect(0, y - 8, g.W, 3); c.fillRect(0, y + 6, g.W, 3); if (R.warn && Math.sin(g.t * 20) > 0) { Kit.circ(c, 14, y, 7, '#ef4444'); } if (R.train) { c.fillStyle = '#dc2626'; c.fillRect(R.train.x * TS, y - 17, 12 * TS, 32); c.fillStyle = '#fde68a'; for (let k = 0; k < 12; k++) c.fillRect(R.train.x * TS + k * TS + 8, y - 10, 22, 10); } }
        if (R.t === 'g') for (const x of R.trees) { c.fillStyle = '#78350f'; c.fillRect(x * TS + 16, y - 4, 8, 14); c.fillStyle = '#15803d'; c.fillRect(x * TS + 6, y - 26, 28, 26); c.fillStyle = '#4ade80'; c.fillRect(x * TS + 6, y - 26, 28, 6); }
        for (let x = 0; x < COLS; x++) if (g.coins.has(i + ',' + x)) { Kit.glow(c, '#fbbf24', 8); Kit.circ(c, x * TS + 20, y - 4 + Math.sin(g.t * 5 + x) * 2, 7, '#fbbf24'); Kit.noGlow(c); }
      }
      const p = g.p; const fx = Kit.lerp(p.hx, p.x, p.ht), fy = Kit.lerp(p.hy, p.y, p.ht); const R = g.rows[p.y]; const px = (R && R.t === 'w' && p.ht >= 1 ? p.x : fx) * TS + TS / 2, py = y0(fy) - Math.sin(p.ht * Math.PI) * 16;
      c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(px - 11, y0(fy) - 4, 24, 14); c.fillStyle = '#fff'; c.fillRect(px - 12, py - 20, 24, 24); c.fillStyle = '#e5e7eb'; c.fillRect(px - 12, py - 2, 24, 6); c.fillStyle = '#ef4444'; c.fillRect(px - 3, py - 26, 8, 6); c.fillStyle = '#f97316'; c.fillRect(px - 3, py - 10, 7, 5); c.fillStyle = '#111'; c.fillRect(px - 7, py - 15, 3, 3); c.fillRect(px + 5, py - 15, 3, 3);
    } });
  function squash(g) { g.sfx('hit'); g.shake(10); g.flash('#ef4444'); }
})();

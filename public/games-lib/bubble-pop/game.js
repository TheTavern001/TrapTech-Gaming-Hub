// Bubble Pop - original hex-grid bubble shooter (Hub build). Match 3+, drop orphans, ceiling descends.
(function () {
  const R = 16, COLS = 12, OX = 8, OY = 60; const C = ['#ef4444', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#22d3ee'];
  const pos = (r, c) => [OX + R + c * R * 2 + (r % 2 ? R : 0), OY + R + r * R * 1.74];
  Kit.run({ id: 'gl-bubble-pop', title: 'BUBBLE POP', help: 'Aim by dragging / mouse, release to shoot\nArrows aim + Space shoots. Match 3 or more', bg: '#0f172a',
    init(g) { g.grid = []; g.nc = 4; for (let r = 0; r < 6; r++) { g.grid.push([]); for (let c = 0; c < COLS; c++) g.grid[r][c] = (r % 2 && c === COLS - 1) ? -1 : g.RI(0, g.nc - 1); } g.cur = nextC(g); g.nxt = nextC(g); g.aim = -Math.PI / 2; g.shot = null; g.shots = 0; g.fall = []; g.drop = 0; },
    update(g, dt) {
      const P = g.ptr; if (P.down || matchMedia('(pointer:fine)').matches) { const a = Math.atan2(P.y - 640, P.x - 200); if (P.y < 620) g.aim = Kit.clamp(a, -Math.PI + 0.15, -0.15); } g.aim = Kit.clamp(g.aim + g.ax() * 1.8 * dt, -Math.PI + 0.15, -0.15);
      if (!g.shot && (P.released && P.y < 620 || g.kd(' ') || g.kd('ArrowUp'))) { g.shot = { x: 200, y: 640, vx: Math.cos(g.aim) * 760, vy: Math.sin(g.aim) * 760, c: g.cur }; g.cur = g.nxt; g.nxt = nextC(g); g.sfx('shoot'); }
      const s = g.shot; if (s) { for (let k = 0; k < 4; k++) { s.x += s.vx * dt / 4; s.y += s.vy * dt / 4; if (s.x < OX + R || s.x > OX + COLS * R * 2 - R) { s.vx *= -1; s.x = Kit.clamp(s.x, OX + R, OX + COLS * R * 2 - R); g.sfx('click'); }
        let hit = s.y < OY + R; for (let r = 0; r < g.grid.length && !hit; r++) for (let c = 0; c < COLS; c++) if (g.grid[r][c] >= 0) { const [x, y] = pos(r, c); if (Math.hypot(x - s.x, y - s.y) < R * 1.75) { hit = true; break; } }
        if (hit) { snap(g, s); g.shot = null; break; } } }
      for (const f of g.fall) { f.vy += 1200 * dt; f.y += f.vy * dt; f.x += f.vx * dt; } g.fall = g.fall.filter(f => f.y < g.H + 30);
      g.hud = 'SHOTS ' + g.shots;
    },
    draw(g, c) {
      c.fillStyle = '#1e293b'; c.fillRect(OX, OY, COLS * R * 2, 600 - OY); c.strokeStyle = '#ef4444'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(OX, 590); c.lineTo(OX + COLS * R * 2, 590); c.stroke(); c.setLineDash([]);
      const bub = (x, y, i) => { Kit.circ(c, x, y, R - 1, C[i]); Kit.circ(c, x - 5, y - 5, 4, 'rgba(255,255,255,.55)'); };
      for (let r = 0; r < g.grid.length; r++) for (let cc = 0; cc < COLS; cc++) if (g.grid[r][cc] >= 0) { const [x, y] = pos(r, cc); bub(x, y, g.grid[r][cc]); }
      for (const f of g.fall) bub(f.x, f.y, f.c);
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.setLineDash([4, 8]); c.beginPath(); c.moveTo(200, 640); c.lineTo(200 + Math.cos(g.aim) * 220, 640 + Math.sin(g.aim) * 220); c.stroke(); c.setLineDash([]);
      if (g.shot) bub(g.shot.x, g.shot.y, g.shot.c); else bub(200, 640, g.cur); bub(260, 666, g.nxt); g.txt('next', 300, 666, 11, '#9aa3d0');
    } });
  function present(g) { const s = new Set(); for (const row of g.grid) for (const v of row) if (v >= 0) s.add(v); return [...s]; }
  function nextC(g) { const p = present(g); return p.length ? g.pick(p) : g.RI(0, g.nc - 1); }
  function nb(r, c) { const o = r % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]; return o.map(([dr, dc]) => [r + dr, c + dc]); }
  function snap(g, s) { let br = 0, bc = 0, bd = 1e9; for (let r = 0; r < g.grid.length + 1; r++) for (let c = 0; c < COLS; c++) { if (r % 2 && c === COLS - 1) continue; if (g.grid[r] && g.grid[r][c] >= 0) continue; const [x, y] = pos(r, c); const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; br = r; bc = c; } }
    while (g.grid.length <= br) g.grid.push(Array.from({ length: COLS }, (_, c) => (g.grid.length % 2 && c === COLS - 1) ? -1 : -2)); for (const row of g.grid) for (let c = 0; c < COLS; c++) if (row[c] === undefined) row[c] = -2;
    g.grid[br][bc] = s.c; g.shots++; g.sfx('thud');
    const same = flood(g, br, bc, (v) => v === s.c); if (same.length >= 3) { for (const [r, c] of same) { const [x, y] = pos(r, c); g.grid[r][c] = -2; g.burst(x, y, C[s.c], 6, 140, 0.4); } g.add(10 * same.length, 'm'); g.sfx('pop');
      const anchored = new Set(); const q = []; for (let c = 0; c < COLS; c++) if (g.grid[0][c] >= 0) { q.push([0, c]); anchored.add('0,' + c); } while (q.length) { const [r, c] = q.pop(); for (const [nr, nc] of nb(r, c)) if (g.grid[nr] && g.grid[nr][nc] >= 0 && !anchored.has(nr + ',' + nc)) { anchored.add(nr + ',' + nc); q.push([nr, nc]); } }
      let dropped = 0; for (let r = 0; r < g.grid.length; r++) for (let c = 0; c < COLS; c++) if (g.grid[r][c] >= 0 && !anchored.has(r + ',' + c)) { const [x, y] = pos(r, c); g.fall.push({ x, y, vx: g.R(-60, 60), vy: g.R(-200, 0), c: g.grid[r][c] }); g.grid[r][c] = -2; dropped++; }
      if (dropped) { g.add(20 * dropped * Math.min(4, dropped), 'd'); g.float(200, 400, 'DROP x' + dropped, '#fbbf24', 22); g.sfx('power'); } if (same.length + dropped >= 8) g.shake(6); }
    while (g.grid.length && g.grid[g.grid.length - 1].every(v => v < 0)) g.grid.pop();
    if (!g.grid.length || g.grid.every(r => r.every(v => v < 0))) { g.add(1000, 'c'); g.float(200, 300, 'CLEAR +1000', '#34d399', 26); g.nc = Math.min(6, g.nc + 1); addRow(g); addRow(g); }
    if (g.shots % Math.max(7, 12 - Math.floor(g.shots / 40)) === 0) addRow(g);
    for (let r = 0; r < g.grid.length; r++) if (g.grid[r].some(v => v >= 0) && pos(r, 0)[1] > 590 - R) return g.end('Bubbles reached the line'); }
  function addRow(g) { // rows are pushed in pairs so the hex stagger (odd rows shifted, last slot unused) never flips
    g.grid.unshift(Array.from({ length: COLS }, (_, c) => c === COLS - 1 ? -1 : g.RI(0, g.nc - 1))); g.grid.unshift(Array.from({ length: COLS }, () => g.RI(0, g.nc - 1))); g.sfx('thud'); g.shake(3); }
  function flood(g, r, c, f) { const out = [], seen = new Set([r + ',' + c]), q = [[r, c]]; while (q.length) { const [a, b] = q.pop(); out.push([a, b]); for (const [nr, nc] of nb(a, b)) { const k = nr + ',' + nc; if (!seen.has(k) && g.grid[nr] && g.grid[nr][nc] !== undefined && f(g.grid[nr][nc])) { seen.add(k); q.push([nr, nc]); } } } return out; }
})();

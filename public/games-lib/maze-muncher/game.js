// Maze Muncher - original maze chase (Hub build). Original maze layout, 4 hunters with different targeting.
(function () {
  const MAP = [
    '###################',
    '#o.......#.......o#',
    '#.##.###.#.###.##.#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    '   #.#   G   #.#   ',
    '####.# ##-## #.####',
    '    .  #GGG#  .    ',
    '####.# ##### #.####',
    '   #.#       #.#   ',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################'];
  const T = 20, OX = 10, OY = 110, COLS = MAP[0].length, ROWS = MAP.length;
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const GC = ['#ef4444', '#f472b6', '#22d3ee', '#f97316'];
  const wall = (g, x, y) => { if (x < 0 || x >= COLS) return false; const ch = (MAP[y] || '')[x]; return ch === '#' || ch === '-' ; };
  function reset(g) { g.pl = { x: 9, y: 15, px: 9, py: 15, d: [0, 0], nd: [-1, 0], prog: 0 }; g.gh = [[9, 7], [8, 9], [9, 9], [10, 9]].map(([x, y], i) => ({ x, y, d: [0, 0], prog: 0, home: i * 2.5, fr: 0, eaten: false, i })); g.fr = 0; g.ready = 1.2; }
  Kit.run({ id: 'gl-maze-muncher', title: 'MAZE MUNCHER', help: 'Arrows / swipe to steer\nEat every dot, power pellets turn the hunters', bg: '#03051a',
    init(g) { g.lvl = 1; g.lives = 3; g.dots = new Set(); g.pw = new Set(); MAP.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') g.dots.add(x + ',' + y); if (ch === 'o') g.pw.add(x + ',' + y); })); g.total = g.dots.size + g.pw.size; reset(g); g.combo = 0; },
    update(g, dt) {
      const p = g.pl; const ax = g.ax(), ay = g.ay();
      if (ax || ay) p.nd = Math.abs(ax) > Math.abs(ay) ? [Math.sign(ax), 0] : [0, Math.sign(ay)];
      if (g.ptr.released) { const dx = g.ptr.x - g.ptr.sx, dy = g.ptr.y - g.ptr.sy; if (Math.hypot(dx, dy) > 18) p.nd = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; }
      if (g.ptr.down) { const dx = g.ptr.x - g.ptr.sx, dy = g.ptr.y - g.ptr.sy; if (Math.hypot(dx, dy) > 24) { p.nd = Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]; g.ptr.sx = g.ptr.x; g.ptr.sy = g.ptr.y; } }
      if (g.ready > 0) { g.ready -= dt; return; }
      const sp = (7 + g.lvl * 0.4) * dt;
      // player moves tile to tile
      if (p.prog === 0) { if (!wall(g, p.x + p.nd[0], p.y + p.nd[1])) p.d = p.nd; if (wall(g, p.x + p.d[0], p.y + p.d[1])) p.d = [0, 0]; }
      if (p.d[0] || p.d[1]) { p.prog += sp; if (p.prog >= 1) { p.prog = 0; p.x += p.d[0]; p.y += p.d[1]; if (p.x < 0) p.x = COLS - 1; if (p.x >= COLS) p.x = 0; eat(g); } }
      g.fr = Math.max(0, g.fr - dt); if (!g.fr) g.combo = 0;
      for (const h of g.gh) {
        if (h.home > 0) { h.home -= dt; continue; }
        const hs = (h.eaten ? 14 : h.fr > 0 ? 4 : 6.4 + g.lvl * 0.45) * dt; h.prog += hs;
        if (h.prog >= 1) { h.prog = 0; h.x += h.d[0]; h.y += h.d[1]; if (h.x < 0) h.x = COLS - 1; if (h.x >= COLS) h.x = 0; if (h.eaten && h.x === 9 && h.y === 8) { h.eaten = false; h.fr = 0; }
          let tx, ty; if (h.eaten) { tx = 9; ty = 8; } else if (h.fr > 0) { tx = g.RI(0, COLS); ty = g.RI(0, ROWS); } else if (h.i === 0) { tx = p.x; ty = p.y; } else if (h.i === 1) { tx = p.x + p.d[0] * 4; ty = p.y + p.d[1] * 4; } else if (h.i === 2) { tx = 2 * p.x - g.gh[0].x; ty = 2 * p.y - g.gh[0].y; } else { const dd = Math.hypot(h.x - p.x, h.y - p.y); tx = dd > 8 ? p.x : 0; ty = dd > 8 ? p.y : ROWS; }
          if (!h.eaten && h.y >= 8 && h.x >= 7 && h.x <= 11 && h.y <= 9) { tx = 9; ty = 6; }
          const ok = (d) => { const nx = h.x + d[0], ny = h.y + d[1]; const ch = (MAP[ny] || '')[((nx % COLS) + COLS) % COLS]; if (ch === undefined || ch === '#') return false; if (ch === '-' && d[1] === 1 && !h.eaten) return false; return true; };
          let best = null, bd = 1e9; for (const d of DIRS) { if (d[0] === -h.d[0] && d[1] === -h.d[1] && (h.d[0] || h.d[1])) continue; if (!ok(d)) continue; const dist = (h.x + d[0] - tx) ** 2 + (h.y + d[1] - ty) ** 2; if (dist < bd) { bd = dist; best = d; } }
          if (!best) best = DIRS.find(ok) || [0, 0]; h.d = best; }
        h.fr = Math.max(0, h.fr - dt);
        const hx = h.x + h.d[0] * h.prog, hy = h.y + h.d[1] * h.prog, px = p.x + p.d[0] * p.prog, py = p.y + p.d[1] * p.prog;
        if (Math.hypot(hx - px, hy - py) < 0.7 && !h.eaten) {
          if (h.fr > 0) { h.eaten = true; g.combo++; const v = 200 * Math.pow(2, Math.min(3, g.combo - 1)); g.add(v, 'gh'); g.float(OX + hx * T, OY + hy * T, v, '#22d3ee', 20); g.sfx('power'); g.burst(OX + hx * T, OY + hy * T, GC[h.i], 20); }
          else { g.lives--; g.sfx('die'); g.shake(10); g.burst(OX + px * T, OY + py * T, '#fbbf24', 40, 220); if (g.lives <= 0) return g.end('Caught'); reset(g); return; } }
      }
      g.hud = 'MAZE ' + g.lvl + '  ' + '\u2665'.repeat(g.lives);
    },
    draw(g, c) {
      for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) { const ch = MAP[y][x]; if (ch === '#') { c.fillStyle = '#1e1b6b'; c.fillRect(OX + x * T + 1, OY + y * T + 1, T - 2, T - 2); c.strokeStyle = '#6366f1'; c.lineWidth = 1.5; c.strokeRect(OX + x * T + 3, OY + y * T + 3, T - 6, T - 6); } if (ch === '-') { c.fillStyle = '#f472b6'; c.fillRect(OX + x * T, OY + y * T + 8, T, 4); } }
      c.fillStyle = '#fde68a'; for (const k of g.dots) { const [x, y] = k.split(','); c.fillRect(OX + x * T + 8, OY + y * T + 8, 4, 4); }
      for (const k of g.pw) { const [x, y] = k.split(','); Kit.glow(c, '#fde68a', 10); Kit.circ(c, OX + x * T + 10, OY + y * T + 10, 5 + Math.sin(g.t * 8) * 1.5, '#fde68a'); Kit.noGlow(c); }
      const p = g.pl; const px = OX + (p.x + p.d[0] * p.prog) * T + 10, py = OY + (p.y + p.d[1] * p.prog) * T + 10; const ang = Math.atan2(p.d[1] || p.nd[1], p.d[0] || p.nd[0]); const m = 0.25 + 0.25 * Math.abs(Math.sin(g.t * 14));
      Kit.glow(c, '#fbbf24', 14); c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(px, py); c.arc(px, py, 9, ang + m, ang + Math.PI * 2 - m); c.fill(); Kit.noGlow(c);
      for (const h of g.gh) { const hx = OX + (h.x + h.d[0] * h.prog) * T + 10, hy = OY + (h.y + h.d[1] * h.prog) * T + 10;
        if (!h.eaten) { const col = h.fr > 0 ? (h.fr < 2 && Math.sin(g.t * 20) > 0 ? '#fff' : '#3b82f6') : GC[h.i]; c.fillStyle = col; c.beginPath(); c.arc(hx, hy - 1, 9, Math.PI, 0); c.lineTo(hx + 9, hy + 9); for (let i = 0; i < 4; i++) c.lineTo(hx + 9 - (i + 0.5) * 4.5, hy + 9 - ((i + Math.floor(g.t * 8)) % 2) * 4); c.lineTo(hx - 9, hy + 9); c.fill(); }
        Kit.circ(c, hx - 3.5, hy - 2, 3, '#fff'); Kit.circ(c, hx + 3.5, hy - 2, 3, '#fff'); Kit.circ(c, hx - 3.5 + h.d[0] * 1.3, hy - 2 + h.d[1] * 1.3, 1.5, '#111'); Kit.circ(c, hx + 3.5 + h.d[0] * 1.3, hy - 2 + h.d[1] * 1.3, 1.5, '#111'); }
      if (g.ready > 0 && g.state === 'play') g.txt('READY!', g.W / 2, OY + 11 * T + 10, 20, '#fbbf24');
    } });
  function eat(g) { const p = g.pl, k = p.x + ',' + p.y;
    if (g.dots.delete(k)) { g.add(10, 'd'); if (g.frames % 2) Kit.tone(520, 0.04, 'triangle', 0.04); }
    if (g.pw.delete(k)) { g.add(50, 'o'); g.fr = Math.max(2.5, 7 - g.lvl * 0.6); for (const h of g.gh) if (!h.eaten) { h.fr = g.fr; h.d = [-h.d[0], -h.d[1]]; } g.combo = 0; g.sfx('power'); g.flash('#3b82f6', 0.1); }
    if (!g.dots.size && !g.pw.size) { g.lvl++; g.mark('w', g.lvl); g.add(500, 'c'); g.float(g.W / 2, 300, 'MAZE CLEAR +500', '#34d399', 24); g.sfx('line'); MAP.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') g.dots.add(x + ',' + y); if (ch === 'o') g.pw.add(x + ',' + y); })); reset(g); } }
})();

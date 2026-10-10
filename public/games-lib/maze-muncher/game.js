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
  const GC = ['#ff5a6e', '#c77dff', '#3fd8c8', '#ffa94d'];
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
      c.drawImage(mazeLayer(g.W, g.H), 0, 0, g.W, g.H);
      for (const k of g.dots) { const [x, y] = k.split(','); const cx = OX + x * T + 10, cy = OY + y * T + 10; c.fillStyle = 'rgba(255,214,120,.25)'; c.beginPath(); c.arc(cx, cy, 4, 0, 7); c.fill(); c.fillStyle = '#ffe6a8'; c.beginPath(); c.arc(cx, cy, 2.1, 0, 7); c.fill(); }
      for (const k of g.pw) { const [x, y] = k.split(','); const cx = OX + x * T + 10, cy = OY + y * T + 10, s = 1 + Math.sin(g.t * 6) * 0.12; c.save(); c.translate(cx, cy); c.scale(s, s); c.shadowColor = '#7dff9a'; c.shadowBlur = 12; leaf(c, 0, 0, 8, '#6fe38a'); c.restore(); }
      const p = g.pl; const px = OX + (p.x + p.d[0] * p.prog) * T + 10, py = OY + (p.y + p.d[1] * p.prog) * T + 10; const ang = Math.atan2(p.d[1] || p.nd[1], p.d[0] || p.nd[0]); const m = 0.06 + 0.32 * Math.abs(Math.sin(g.t * 13));
      c.save(); c.translate(px, py); c.shadowColor = 'rgba(255,220,90,.7)'; c.shadowBlur = 14; const hg = c.createRadialGradient(-3, -4, 1, 0, 0, 10); hg.addColorStop(0, '#fff6c0'); hg.addColorStop(0.45, '#ffd23f'); hg.addColorStop(1, '#e09a10'); c.fillStyle = hg; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 9.5, ang + m, ang + Math.PI * 2 - m); c.closePath(); c.fill(); c.shadowBlur = 0;
        c.save(); c.rotate(-0.3); leaf(c, 0, -10, 4.5, '#4fd16e'); c.restore();
        const ex = Math.cos(ang - 1.1) * 4.5, ey = Math.sin(ang - 1.1) * 4.5 - (Math.abs(Math.cos(ang)) > 0.5 ? 0 : 0); c.fillStyle = '#2a1a05'; c.beginPath(); c.arc(ex, Math.min(ey, -1.5), 1.6, 0, 7); c.fill(); c.restore();
      for (const h of g.gh) { const hx = OX + (h.x + h.d[0] * h.prog) * T + 10, hy = OY + (h.y + h.d[1] * h.prog) * T + 10;
        if (!h.eaten) { const fr = h.fr > 0, blink = fr && h.fr < 2 && Math.sin(g.t * 20) > 0; wisp(c, hx + (fr ? Math.sin(g.t * 40) * 0.6 : 0), hy, fr ? (blink ? '#f2f6ff' : '#5b7cff') : GC[h.i], g.t + h.i, fr); }
        if (!h.fr || h.eaten) { for (const sx of [-3.6, 3.6]) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(hx + sx, hy - 2, 2.6, 3.2, 0, 0, 7); c.fill(); c.fillStyle = '#16123a'; c.beginPath(); c.arc(hx + sx + h.d[0] * 1.3, hy - 2 + h.d[1] * 1.4, 1.4, 0, 7); c.fill(); } }
        else { c.fillStyle = '#fff'; c.fillRect(hx - 4.5, hy - 3, 2.2, 2.2); c.fillRect(hx + 2.3, hy - 3, 2.2, 2.2); c.strokeStyle = '#fff'; c.lineWidth = 1; c.beginPath(); for (let i = 0; i <= 4; i++) c.lineTo(hx - 5 + i * 2.5, hy + 3 + (i % 2) * 1.6); c.stroke(); } }
      if (g.ready > 0 && g.state === 'play') g.txt('READY!', g.W / 2, OY + 11 * T + 10, 20, '#ffd23f');
    } });
  function leaf(c, x, y, r, col) { c.save(); c.translate(x, y); c.fillStyle = col; for (let i = -2; i <= 2; i++) { c.save(); c.rotate(i * 0.55); c.beginPath(); c.ellipse(0, -r * (0.55 - Math.abs(i) * 0.08), r * 0.2, r * (0.6 - Math.abs(i) * 0.1), 0, 0, 7); c.fill(); c.restore(); } c.restore(); }
  // enemies are original "haze wisps": soft cloud bodies with trailing curls
  function wisp(c, x, y, col, t, fr) { c.save(); c.translate(x, y); c.shadowColor = col; c.shadowBlur = 10; const gr = c.createRadialGradient(-2, -4, 1, 0, 0, 12); gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.25, col); gr.addColorStop(1, col); c.fillStyle = gr; c.globalAlpha = fr ? 0.85 : 0.95;
    c.beginPath(); c.arc(0, -2, 8.5, Math.PI, 0); for (let i = 0; i <= 6; i++) { const xx = 8.5 - i * (17 / 6); c.lineTo(xx, 6 + Math.sin(t * 9 + i * 1.3) * 2.2 + (i % 2) * 1.5); } c.closePath(); c.fill();
    c.globalAlpha = 0.35; c.beginPath(); c.arc(-6, -6, 3.5, 0, 7); c.arc(6, -7, 3, 0, 7); c.fill(); c.restore(); }
  let ML = null; function mazeLayer(W, H) { if (ML) return ML; const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2; const c = cv.getContext('2d'); c.scale(2, 2);
    const bg = c.createRadialGradient(W / 2, H * 0.45, 30, W / 2, H / 2, H * 0.75); bg.addColorStop(0, '#0f1f3a'); bg.addColorStop(1, '#03051a'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    const isW = (x, y) => y >= 0 && y < ROWS && x >= 0 && x < COLS && MAP[y][x] === '#';
    const path = () => { c.beginPath(); for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (isW(x, y)) { const cx = OX + x * T + 10, cy = OY + y * T + 10; c.moveTo(cx, cy); c.lineTo(cx + 0.01, cy); if (isW(x + 1, y)) { c.moveTo(cx, cy); c.lineTo(cx + T, cy); } if (isW(x, y + 1)) { c.moveTo(cx, cy); c.lineTo(cx, cy + T); } } };
    c.lineCap = 'round'; c.lineJoin = 'round';
    path(); c.shadowColor = '#4fe3a0'; c.shadowBlur = 14; c.strokeStyle = '#1f8a66'; c.lineWidth = 13; c.stroke(); c.shadowBlur = 0;
    path(); c.strokeStyle = '#7dffc4'; c.lineWidth = 10; c.stroke();
    path(); c.strokeStyle = '#0b1830'; c.lineWidth = 7; c.stroke();
    path(); c.strokeStyle = 'rgba(125,255,196,.12)'; c.lineWidth = 2; c.stroke();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (MAP[y][x] === '-') { c.fillStyle = '#ffb3d1'; c.fillRect(OX + x * T, OY + y * T + 8.5, T, 3); }
    return (ML = cv); }
  function eat(g) { const p = g.pl, k = p.x + ',' + p.y;
    if (g.dots.delete(k)) { g.add(10, 'd'); if (g.frames % 2) Kit.tone(520, 0.04, 'triangle', 0.04); }
    if (g.pw.delete(k)) { g.add(50, 'o'); g.fr = Math.max(2.5, 7 - g.lvl * 0.6); for (const h of g.gh) if (!h.eaten) { h.fr = g.fr; h.d = [-h.d[0], -h.d[1]]; } g.combo = 0; g.sfx('power'); g.flash('#3b82f6', 0.1); }
    if (!g.dots.size && !g.pw.size) { g.lvl++; g.mark('w', g.lvl); g.add(500, 'c'); g.float(g.W / 2, 300, 'MAZE CLEAR +500', '#34d399', 24); g.sfx('line'); MAP.forEach((r, y) => [...r].forEach((ch, x) => { if (ch === '.') g.dots.add(x + ',' + y); if (ch === 'o') g.pw.add(x + ',' + y); })); reset(g); } }
})();

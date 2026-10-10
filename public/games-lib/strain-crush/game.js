// Strain Crush - original timed match-3 with strain gems (Hub build, cannabis theme). Endless: matches refill the clock, the drain speeds up.
(function () {
  const N = 8, S = 46, OX = 16, OY = 130; const G = ['#22c55e', '#a855f7', '#fbbf24', '#f97316', '#38bdf8', '#f472b6'];
  Kit.run({ id: 'gl-strain-crush', title: 'STRAIN CRUSH', help: 'Swipe a gem into a neighbour to swap (or tap two)\nMatch 3+ strains - cascades multiply. 3 minutes', bg: '#1e1b4b',
    init(g) { g.b = []; for (let r = 0; r < N; r++) { g.b.push([]); for (let c = 0; c < N; c++) { let v; do v = g.RI(0, 5); while ((c > 1 && g.b[r][c - 1].v === v && g.b[r][c - 2].v === v) || (r > 1 && g.b[r - 1][c].v === v && g.b[r - 2][c].v === v)); g.b[r].push({ v, y: r, sp: 0 }); } } g.sel = null; g.time = 60; g.busy = 0; g.chain = 0; },
    update(g, dt) {
      g.time -= dt * (1 + g.t / 180); if (g.time <= 0) { g.time = 0; return g.end('Out of time'); }
      let moving = false; for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const k = g.b[r][c]; if (k && k.y < r) { k.sp += 2200 * dt / S; k.y = Math.min(r, k.y + k.sp * dt); moving = true; } else if (k) { k.y = r; k.sp = 0; } }
      if (g.swap) { g.swap.t += dt * 6; if (g.swap.t >= 1) { const s = g.swap; g.swap = null; if (!resolve(g) && !s.back) { swap(g, s.a, s.b); g.swap = { a: s.a, b: s.b, t: 0, back: true }; g.sfx('bad'); } } return; }
      if (!moving) { if (g.pending) { g.pending = false; if (!resolve(g)) g.chain = 0; } }
      else return;
      const cell = (x, y) => { const c = Math.floor((x - OX) / S), r = Math.floor((y - OY) / S); return r >= 0 && c >= 0 && r < N && c < N ? [r, c] : null; };
      const P = g.ptr; if (P.pressed) g.down = cell(P.x, P.y);
      if (P.down && g.down) { const dx = P.x - P.sx, dy = P.y - P.sy; if (Math.hypot(dx, dy) > 22) { const [r, c] = g.down; const t = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c]; g.down = null; g.sel = null; tryS(g, [r, c], t); } }
      if (P.released && g.down) { const d = g.down; g.down = null; if (g.sel && Math.abs(g.sel[0] - d[0]) + Math.abs(g.sel[1] - d[1]) === 1) { tryS(g, g.sel, d); g.sel = null; } else g.sel = d; }
      g.cur = g.cur || [3, 3]; if (g.kd('ArrowUp')) g.cur[0] = Math.max(0, g.cur[0] - 1); if (g.kd('ArrowDown')) g.cur[0] = Math.min(N - 1, g.cur[0] + 1); if (g.kd('ArrowLeft')) g.cur[1] = Math.max(0, g.cur[1] - 1); if (g.kd('ArrowRight')) g.cur[1] = Math.min(N - 1, g.cur[1] + 1);
      if (g.kd(' ')) { if (g.sel && Math.abs(g.sel[0] - g.cur[0]) + Math.abs(g.sel[1] - g.cur[1]) === 1) { tryS(g, g.sel, g.cur.slice()); g.sel = null; } else g.sel = g.cur.slice(); }
      g.hud = Math.floor(g.time / 60) + ':' + String(Math.floor(g.time % 60)).padStart(2, '0') + (g.chain > 1 ? '  CHAIN x' + g.chain : '');
    },
    draw(g, c) {
      c.fillStyle = '#312e81'; Kit.rr(c, OX - 6, OY - 6, N * S + 12, N * S + 12, 12); c.fill();
      for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) { c.fillStyle = (r + cc) % 2 ? '#3730a3' : '#4338ca'; c.fillRect(OX + cc * S, OY + r * S, S, S); }
      for (let r = 0; r < N; r++) for (let cc = 0; cc < N; cc++) { const k = g.b[r][cc]; if (!k) continue; let x = OX + cc * S + S / 2, y = OY + k.y * S + S / 2;
        if (g.swap) { const s = g.swap, t = Math.min(1, s.t); const other = (s.a[0] === r && s.a[1] === cc) ? s.b : (s.b[0] === r && s.b[1] === cc) ? s.a : null; if (other) { x += (other[1] - cc) * S * (1 - t); y += (other[0] - r) * S * (1 - t); } }
        leaf(c, x, y, G[k.v], k.v); }
      if (g.sel) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.strokeRect(OX + g.sel[1] * S + 2, OY + g.sel[0] * S + 2, S - 4, S - 4); } if (g.cur && !matchMedia('(pointer:coarse)').matches) { c.strokeStyle = 'rgba(34,211,238,.6)'; c.lineWidth = 2; c.strokeRect(OX + g.cur[1] * S + 4, OY + g.cur[0] * S + 4, S - 8, S - 8); }
      c.fillStyle = '#1d2a66'; c.fillRect(20, 60, g.W - 40, 10); c.fillStyle = '#34d399'; c.fillRect(20, 60, (g.W - 40) * g.time / 60, 10);
    } });
  function leaf(c, x, y, col, v) { c.save(); c.translate(x, y); Kit.glow(c, col, 6); c.fillStyle = col; if (v % 2 === 0) { for (let f = -2; f <= 2; f++) { c.save(); c.rotate(f * 0.45 - Math.PI / 2); c.beginPath(); c.ellipse(9, 0, 10 - Math.abs(f) * 2, 3.5, 0, 0, 7); c.fill(); c.restore(); } } else if (v === 1 || v === 5) { c.beginPath(); for (let i = 0; i < 6; i++) c.lineTo(Math.cos(i * 1.047) * 16, Math.sin(i * 1.047) * 16); c.fill(); Kit.circ(c, -4, -4, 4, 'rgba(255,255,255,.4)'); } else { c.beginPath(); c.arc(0, 0, 15, 0, 7); c.fill(); Kit.circ(c, -5, -5, 4, 'rgba(255,255,255,.4)'); } Kit.noGlow(c); c.restore(); }
  function swap(g, a, b) { const t = g.b[a[0]][a[1]]; g.b[a[0]][a[1]] = g.b[b[0]][b[1]]; g.b[b[0]][b[1]] = t; }
  function tryS(g, a, b) { if (b[0] < 0 || b[1] < 0 || b[0] >= N || b[1] >= N) return; swap(g, a, b); g.swap = { a, b, t: 0 }; g.sfx('click'); g.chain = 0; }
  function resolve(g) { const kill = new Set(); for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const v = g.b[r][c] && g.b[r][c].v; if (v === undefined) continue; if (c < N - 2 && g.b[r][c + 1].v === v && g.b[r][c + 2].v === v) { kill.add(r + ',' + c); kill.add(r + ',' + (c + 1)); kill.add(r + ',' + (c + 2)); } if (r < N - 2 && g.b[r + 1][c].v === v && g.b[r + 2][c].v === v) { kill.add(r + ',' + c); kill.add((r + 1) + ',' + c); kill.add((r + 2) + ',' + c); } }
    if (!kill.size) return false; g.chain++; const v = kill.size * 10 * g.chain; g.add(v, 'm'); g.time = Math.min(60, g.time + kill.size * 0.12 * g.chain); if (g.chain > 1 || kill.size > 3) g.float(200, OY - 20, (kill.size > 3 ? kill.size + ' MATCH ' : '') + '+' + v, '#fbbf24', 20); g.sfx(g.chain > 1 ? 'power' : 'pop'); if (kill.size >= 5) g.shake(5);
    for (const k of kill) { const [r, c] = k.split(',').map(Number); g.burst(OX + c * S + S / 2, OY + r * S + S / 2, G[g.b[r][c].v], 8, 140, 0.4); g.b[r][c] = null; }
    for (let c = 0; c < N; c++) { let w = N - 1; for (let r = N - 1; r >= 0; r--) if (g.b[r][c]) { const k = g.b[r][c]; g.b[r][c] = null; g.b[w][c] = k; w--; } for (let r = w; r >= 0; r--) g.b[r][c] = { v: g.RI(0, 5), y: r - w - 1, sp: 0 }; }
    g.pending = true; return true; }
})();

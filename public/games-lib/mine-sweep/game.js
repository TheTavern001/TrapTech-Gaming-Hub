// Mine Sweep - original timed minefield boards (Hub build). Clear boards back to back; score = cells + speed bonus.
(function () {
  const SZ = [[9, 9, 10], [9, 12, 18], [10, 14, 26], [10, 16, 34]];
  Kit.run({ id: 'gl-mine-sweep', title: 'MINE SWEEP', help: 'Tap to reveal, long-press (or right-click / F) to flag\nClear boards back to back - 3 lives', bg: '#0f172a',
    init(g) { g.board = 0; g.lives = 3; g.hover = null; newBoard(g); },
    update(g, dt) {
      const P = g.ptr; g.bt += dt; const at = (x, y) => { const c = Math.floor((x - g.ox) / g.cs), r = Math.floor((y - g.oy) / g.cs); return c >= 0 && r >= 0 && c < g.W2 && r < g.H2 ? [r, c] : null; };
      if (P.pressed) { g.pt = g.t; g.pc = at(P.x, P.y); g.flagged = false; } if (P.down && g.pc && !g.flagged && g.t - g.pt > 0.38) { flag(g, ...g.pc); g.flagged = true; }
      if (P.released && g.pc && !g.flagged) { const p = at(P.x, P.y); if (p && p[0] === g.pc[0] && p[1] === g.pc[1]) reveal(g, ...p); }
      g.cur = g.cur || [0, 0]; if (g.kd('ArrowUp')) g.cur[0] = Math.max(0, g.cur[0] - 1); if (g.kd('ArrowDown')) g.cur[0] = Math.min(g.H2 - 1, g.cur[0] + 1); if (g.kd('ArrowLeft')) g.cur[1] = Math.max(0, g.cur[1] - 1); if (g.kd('ArrowRight')) g.cur[1] = Math.min(g.W2 - 1, g.cur[1] + 1); if (g.kd(' ')) reveal(g, ...g.cur); if (g.kd('f') || g.kd('F')) flag(g, ...g.cur);
      g.hud = 'BOARD ' + (g.board) + '  ' + '\u2665'.repeat(g.lives) + '  ' + Math.floor(g.bt) + 's';
    },
    draw(g, c) {
      for (let r = 0; r < g.H2; r++) for (let cc = 0; cc < g.W2; cc++) { const x = g.ox + cc * g.cs, y = g.oy + r * g.cs, k = g.cell[r][cc];
        if (k.open) { c.fillStyle = '#1e293b'; c.fillRect(x, y, g.cs - 1, g.cs - 1); if (k.mine) { Kit.circ(c, x + g.cs / 2, y + g.cs / 2, g.cs / 3.5, '#ef4444'); } else if (k.n) g.txt(k.n, x + g.cs / 2, y + g.cs / 2 + 1, g.cs * 0.5, ['', '#60a5fa', '#4ade80', '#f87171', '#a78bfa', '#fbbf24', '#22d3ee', '#fff', '#fff'][k.n]); }
        else { c.fillStyle = '#4f46e5'; c.fillRect(x, y, g.cs - 1, g.cs - 1); c.fillStyle = '#6366f1'; c.fillRect(x, y, g.cs - 1, 3); if (k.flag) { c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(x + g.cs * 0.35, y + g.cs * 0.2); c.lineTo(x + g.cs * 0.75, y + g.cs * 0.35); c.lineTo(x + g.cs * 0.35, y + g.cs * 0.5); c.fill(); c.fillRect(x + g.cs * 0.33, y + g.cs * 0.2, 2, g.cs * 0.6); } } }
      if (g.cur) { c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.strokeRect(g.ox + g.cur[1] * g.cs, g.oy + g.cur[0] * g.cs, g.cs - 1, g.cs - 1); }
      g.txt('Mines ' + g.mines + '   Flags ' + g.flags, g.W / 2, 56, 13, '#9aa3d0');
    } });
  function newBoard(g) { const [w, h, m] = SZ[Math.min(SZ.length - 1, g.board)]; g.board++; g.mark('w', g.board); g.W2 = w; g.H2 = h; g.mines = m + Math.max(0, g.board - SZ.length) * 3; g.cs = Math.floor(Math.min(380 / w, 600 / h)); g.ox = (g.W - g.cs * w) / 2; g.oy = 80; g.cell = Array.from({ length: h }, () => Array.from({ length: w }, () => ({ mine: false, open: false, flag: false, n: 0 }))); g.first = true; g.flags = 0; g.bt = 0; g.opened = 0; }
  function place(g, sr, sc) { let n = 0; while (n < g.mines) { const r = g.RI(0, g.H2 - 1), c = g.RI(0, g.W2 - 1); if (g.cell[r][c].mine || (Math.abs(r - sr) <= 1 && Math.abs(c - sc) <= 1)) continue; g.cell[r][c].mine = true; n++; } for (let r = 0; r < g.H2; r++) for (let c = 0; c < g.W2; c++) g.cell[r][c].n = around(g, r, c).filter(([a, b]) => g.cell[a][b].mine).length; }
  function around(g, r, c) { const o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const a = r + dr, b = c + dc; if ((dr || dc) && a >= 0 && b >= 0 && a < g.H2 && b < g.W2) o.push([a, b]); } return o; }
  function flag(g, r, c) { const k = g.cell[r][c]; if (k.open) return; k.flag = !k.flag; g.flags += k.flag ? 1 : -1; g.sfx('click'); }
  function reveal(g, r, c) { if (g.first) { place(g, r, c); g.first = false; } const k = g.cell[r][c]; if (k.flag) return; if (k.open) { // chord
      const f = around(g, r, c).filter(([a, b]) => g.cell[a][b].flag).length; if (k.n && f === k.n) for (const [a, b] of around(g, r, c)) if (!g.cell[a][b].open && !g.cell[a][b].flag) reveal(g, a, b); return; }
    if (k.mine) { k.open = true; g.lives--; g.sfx('boom'); g.shake(10); g.flash('#ef4444'); g.burst(g.ox + c * g.cs + g.cs / 2, g.oy + r * g.cs + g.cs / 2, ['#ef4444', '#fbbf24'], 30, 240); k.flag = true; g.flags++; if (g.lives <= 0) return g.end('Boom'); return; }
    const q = [[r, c]]; let n = 0; while (q.length) { const [a, b] = q.pop(); const z = g.cell[a][b]; if (z.open || z.flag) continue; z.open = true; n++; if (!z.n) for (const p of around(g, a, b)) if (!g.cell[p[0]][p[1]].open) q.push(p); } g.add(n, 'o'); g.opened += n; g.sfx(n > 5 ? 'whoosh' : 'pop');
    if (g.opened >= g.W2 * g.H2 - g.mines) { const b = Math.max(50, Math.round(500 * g.board - g.bt * 5)); g.add(b, 'c'); g.float(g.W / 2, 300, 'BOARD CLEAR +' + b, '#34d399', 24); g.sfx('line'); newBoard(g); } }
})();

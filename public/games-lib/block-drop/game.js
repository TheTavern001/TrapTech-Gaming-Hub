// Block Drop - original falling-block puzzle (Hub build). Guideline-style 7-bag, hold, ghost, wall kicks (simple).
(function () {
  const C = 10, R = 20, S = 28, OX = 20, OY = 70;
  const SH = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
  const COL = { I: '#22d3ee', O: '#fbbf24', T: '#a855f7', S: '#34d399', Z: '#ef4444', J: '#3b82f6', L: '#f97316' };
  const rot = (cells, k, n) => cells.map(([x, y]) => { for (let i = 0; i < k; i++) [x, y] = [n - 1 - y, x]; return [x, y]; });
  Kit.run({ id: 'gl-block-drop', title: 'BLOCK DROP', help: 'Arrows / swipe to move, Up / tap to rotate\nDown soft drop, Space hard drop, C hold', bg: '#060920',
    init(g) { g.bd = Array.from({ length: R }, () => Array(C).fill(null)); g.bag = []; g.lines = 0; g.lv = 1; g.fall = 0; g.hold = null; g.canHold = true; g.lock = 0; g.clr = []; g.nextQ = []; for (let i = 0; i < 3; i++) g.nextQ.push(take(g)); spawn(g); g.das = 0; },
    update(g, dt) {
      if (g.clr.length) { g.clrT -= dt; if (g.clrT <= 0) { for (const y of g.clr) { g.bd.splice(y, 1); g.bd.unshift(Array(C).fill(null)); } g.clr = []; spawn(g); } return; }
      const p = g.p; const mv = (dx) => { if (fits(g, p.cells, p.x + dx, p.y)) { p.x += dx; g.sfx('click'); g.lock = Math.min(g.lock, 0.3); } };
      if (g.kd('ArrowLeft') || g.kd('a')) { mv(-1); g.das = -0.17; } if (g.kd('ArrowRight') || g.kd('d')) { mv(1); g.das = -0.17; }
      const hx = (g.keys.ArrowLeft || g.keys.a ? -1 : 0) + (g.keys.ArrowRight || g.keys.d ? 1 : 0); if (hx) { g.das += dt; if (g.das > 0.05) { g.das = 0; mv(hx); } }
      if (g.kd('ArrowUp') || g.kd('w') || g.kd('x')) rotate(g, 1); if (g.kd('z')) rotate(g, 3);
      if (g.kd('c') || g.kd('C') || g.kd('Shift')) doHold(g);
      if (g.kd(' ')) { let d = 0; while (fits(g, p.cells, p.x, p.y + 1)) { p.y++; d++; } g.add(2 * d, 'd'); g.shake(4); g.sfx('thud'); return place(g); }
      // touch: drag horizontally = move per cell, drag down = soft drop, quick swipe down = hard drop, tap = rotate (right half) / hold (top area)
      const P = g.ptr; if (P.pressed) { g.tx = P.x; g.ty = P.y; g.t0 = g.t; g.moved = false; }
      if (P.down) { while (P.x - g.tx > S * 0.9) { mv(1); g.tx += S * 0.9; g.moved = true; } while (g.tx - P.x > S * 0.9) { mv(-1); g.tx -= S * 0.9; g.moved = true; } if (P.y - g.ty > S) { if (fits(g, p.cells, p.x, p.y + 1)) { p.y++; g.add(1, 'd'); } g.ty += S; g.moved = true; } }
      if (P.released) { if (!g.moved && g.t - g.t0 < 0.3) { if (P.y < OY + 40 && P.x > OX + C * S) doHold(g); else rotate(g, 1); } else if (g.t - g.t0 < 0.22 && P.y - (g.ty) > -S && g.moved && P.y - g.ty > 0) {} }
      const soft = g.keys.ArrowDown || g.keys.s; const iv = Math.max(0.05, 0.8 * Math.pow(0.82, g.lv - 1));
      g.fall += dt * (soft ? 12 : 1); if (g.fall >= iv) { g.fall = 0; if (fits(g, p.cells, p.x, p.y + 1)) { p.y++; if (soft) g.add(1, 'd'); g.lock = 0.5; } }
      if (!fits(g, p.cells, p.x, p.y + 1)) { g.lock -= dt; if (g.lock <= 0) place(g); } else g.lock = 0.5;
      g.hud = 'LV ' + g.lv + '  LINES ' + g.lines;
    },
    draw(g, c) {
      c.fillStyle = '#0a1030'; Kit.rr(c, OX - 6, OY - 6, C * S + 12, R * S + 12, 10); c.fill(); c.strokeStyle = '#1d2a66'; c.lineWidth = 1;
      for (let x = 0; x <= C; x++) { c.beginPath(); c.moveTo(OX + x * S, OY); c.lineTo(OX + x * S, OY + R * S); c.stroke(); }
      for (let y = 0; y <= R; y++) { c.beginPath(); c.moveTo(OX, OY + y * S); c.lineTo(OX + C * S, OY + y * S); c.stroke(); }
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (g.bd[y][x]) cell(c, OX + x * S, OY + y * S, g.bd[y][x], g.clr.includes(y) ? 0.4 + Math.sin(g.t * 40) * 0.4 : 1);
      if (g.p && !g.clr.length) { const p = g.p; let gy = p.y; while (fits(g, p.cells, p.x, gy + 1)) gy++; for (const [x, y] of p.cells) { c.strokeStyle = COL[p.k]; c.globalAlpha = 0.4; c.strokeRect(OX + (p.x + x) * S + 2, OY + (gy + y) * S + 2, S - 4, S - 4); c.globalAlpha = 1; } for (const [x, y] of p.cells) if (p.y + y >= 0) cell(c, OX + (p.x + x) * S, OY + (p.y + y) * S, COL[p.k], 1); }
      const sx = OX + C * S + 16; g.txt('HOLD', sx + 26, OY + 6, 11, '#9aa3d0'); if (g.hold) mini(c, g.hold, sx, OY + 20);
      g.txt('NEXT', sx + 26, OY + 96, 11, '#9aa3d0'); (g.nextQ || []).forEach((k, i) => mini(c, k, sx, OY + 110 + i * 56));
    } });
  function cell(c, x, y, col, a) { c.globalAlpha = a; c.fillStyle = col; c.fillRect(x + 1, y + 1, S - 2, S - 2); c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(x + 1, y + 1, S - 2, 5); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 1, y + S - 6, S - 2, 5); c.globalAlpha = 1; }
  function mini(c, k, x, y) { for (const [a, b] of SH[k]) { c.fillStyle = COL[k]; c.fillRect(x + a * 13, y + b * 13, 12, 12); } }
  function take(g) { if (!g.bag.length) { g.bag = Object.keys(SH); for (let i = 6; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [g.bag[i], g.bag[j]] = [g.bag[j], g.bag[i]]; } } return g.bag.pop(); }
  function spawn(g, k) { k = k || g.nextQ.shift(); if (g.nextQ.length < 3) g.nextQ.push(take(g)); const n = k === 'I' || k === 'O' ? 4 : 3; g.p = { k, n, r: 0, cells: SH[k].map(a => a.slice()), x: 3, y: -1 }; g.canHold = true; g.lock = 0.5; if (!fits(g, g.p.cells, g.p.x, g.p.y)) g.end('Stacked out'); }
  function doHold(g) { if (!g.canHold) return; const k = g.p.k; if (g.hold) spawn(g, g.hold); else spawn(g); g.hold = k; g.canHold = false; g.sfx('whoosh'); }
  function fits(g, cells, px, py) { for (const [x, y] of cells) { const X = px + x, Y = py + y; if (X < 0 || X >= C || Y >= R) return false; if (Y >= 0 && g.bd[Y][X]) return false; } return true; }
  function rotate(g, k) { const p = g.p; if (p.k === 'O') return; const nc = rot(SH[p.k], (p.r + k) % 4, p.n); for (const dx of [0, -1, 1, -2, 2]) for (const dy of [0, -1]) if (fits(g, nc, p.x + dx, p.y + dy)) { p.cells = nc; p.r = (p.r + k) % 4; p.x += dx; p.y += dy; g.sfx('click'); g.lock = Math.min(g.lock + 0.1, 0.5); return; } }
  function place(g) { const p = g.p; for (const [x, y] of p.cells) { if (p.y + y < 0) return g.end('Stacked out'); g.bd[p.y + y][p.x + x] = COL[p.k]; } g.sfx('thud');
    const full = []; for (let y = 0; y < R; y++) if (g.bd[y].every(Boolean)) full.push(y);
    if (full.length) { const pts = [0, 100, 300, 500, 800][full.length] * g.lv; g.add(pts, 'l'); g.lines += full.length; g.float(OX + C * S / 2, OY + full[0] * S, full.length === 4 ? 'QUAD! +' + pts : '+' + pts, full.length === 4 ? '#fbbf24' : '#34d399', 22); g.sfx('line'); g.shake(full.length * 3);
      for (const y of full) g.burst(OX + C * S / 2, OY + y * S + S / 2, ['#22d3ee', '#a855f7', '#fff'], 20, 300); const nl = 1 + Math.floor(g.lines / 10); if (nl > g.lv) { g.lv = nl; g.mark('w', nl); g.sfx('power'); g.flash('#6366f1'); }
      g.clr = full; g.clrT = 0.25; g.p = null; return; }
    spawn(g); }
})();

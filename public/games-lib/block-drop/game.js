// Block Drop - original falling-block puzzle (Hub build). Guideline-style 7-bag, hold, ghost, wall kicks (simple).
(function () {
  const C = 10, R = 20, S = 28, OX = 20, OY = 70;
  const SH = { I: [[0, 1], [1, 1], [2, 1], [3, 1]], O: [[1, 0], [2, 0], [1, 1], [2, 1]], T: [[1, 0], [0, 1], [1, 1], [2, 1]], S: [[1, 0], [2, 0], [0, 1], [1, 1]], Z: [[0, 0], [1, 0], [1, 1], [2, 1]], J: [[0, 0], [0, 1], [1, 1], [2, 1]], L: [[2, 0], [0, 1], [1, 1], [2, 1]] };
  const COL = { I: '#2fd6f0', O: '#ffc93c', T: '#b15cff', S: '#3ddc84', Z: '#ff4f5e', J: '#3d7bff', L: '#ff8c2e' };
  const SPR = {}; // pre-rendered glossy bevelled tiles
  function tile(col, sz) { const k = col + sz; if (SPR[k]) return SPR[k]; const cv = document.createElement('canvas'); cv.width = cv.height = sz * 2; const c = cv.getContext('2d'); c.scale(2, 2);
    const sh = (hex, f) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = f > 0 ? (v) => v + (255 - v) * f : (v) => v * (1 + f); return `rgb(${m(r) | 0},${m(g) | 0},${m(b) | 0})`; };
    const b = Math.max(3, sz * 0.14); c.fillStyle = sh(col, -0.45); Kit.rr(c, 0.5, 0.5, sz - 1, sz - 1, 4); c.fill();
    c.fillStyle = sh(col, 0.45); c.beginPath(); c.moveTo(1, 1); c.lineTo(sz - 1, 1); c.lineTo(sz - 1 - b, 1 + b); c.lineTo(1 + b, 1 + b); c.lineTo(1 + b, sz - 1 - b); c.lineTo(1, sz - 1); c.fill();
    c.fillStyle = sh(col, -0.25); c.beginPath(); c.moveTo(sz - 1, 1); c.lineTo(sz - 1, sz - 1); c.lineTo(1, sz - 1); c.lineTo(1 + b, sz - 1 - b); c.lineTo(sz - 1 - b, sz - 1 - b); c.lineTo(sz - 1 - b, 1 + b); c.fill();
    const gr = c.createLinearGradient(0, b, 0, sz - b); gr.addColorStop(0, sh(col, 0.18)); gr.addColorStop(1, sh(col, -0.12)); c.fillStyle = gr; c.fillRect(1 + b, 1 + b, sz - 2 - 2 * b, sz - 2 - 2 * b);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(sz * 0.38, sz * 0.32, sz * 0.22, sz * 0.09, -0.5, 0, 7); c.fill(); return (SPR[k] = cv); }
  let BGC = null; function boardBg(W, H) { if (BGC) return BGC; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const g = c.createRadialGradient(W / 2, H * 0.4, 40, W / 2, H * 0.5, H * 0.8); g.addColorStop(0, '#173a3a'); g.addColorStop(1, '#060a18'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) { const x = (i * 97) % W, y = (i * 211) % H, r = 10 + (i * 37) % 40; const b = c.createRadialGradient(x, y, 0, x, y, r); b.addColorStop(0, i % 3 ? 'rgba(80,220,160,.10)' : 'rgba(255,200,80,.10)'); b.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = b; c.fillRect(x - r, y - r, 2 * r, 2 * r); }
    // faint leaf watermark (21+ theme)
    c.save(); c.translate(W / 2 - 60, H * 0.5); c.globalAlpha = 0.05; c.fillStyle = '#7dffb0'; for (let i = -3; i <= 3; i++) { c.save(); c.rotate(i * 0.38); c.beginPath(); c.ellipse(0, -70 + Math.abs(i) * 12, 11 - Math.abs(i), 70 - Math.abs(i) * 12, 0, 0, 7); c.fill(); c.restore(); } c.restore(); return (BGC = cv); }
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
      if (g.kd(' ')) { const xs = p.cells.map(q => p.x + q[0]), y0 = p.y + Math.min(...p.cells.map(q => q[1])); let d = 0; while (fits(g, p.cells, p.x, p.y + 1)) { p.y++; d++; } g.add(2 * d, 'd'); g.shake(4); g.trail = 0.18; g.trailD = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.max(0, y0), y1: p.y + Math.max(...p.cells.map(q => q[1])) }; g.sfx('thud'); return place(g); }
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
      c.drawImage(boardBg(g.W, g.H), 0, 0);
      c.save(); c.shadowColor = 'rgba(60,255,170,.25)'; c.shadowBlur = 18; c.fillStyle = 'rgba(8,14,30,.82)'; Kit.rr(c, OX - 6, OY - 6, C * S + 12, R * S + 12, 10); c.fill(); c.restore();
      c.strokeStyle = 'rgba(120,255,190,.35)'; c.lineWidth = 1.5; Kit.rr(c, OX - 6, OY - 6, C * S + 12, R * S + 12, 10); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.035)'; for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if ((x + y) & 1) c.fillRect(OX + x * S, OY + y * S, S, S);
      for (let y = 0; y < R; y++) for (let x = 0; x < C; x++) if (g.bd[y][x]) cell(c, OX + x * S, OY + y * S, g.bd[y][x], 1);
      if (g.clr.length) { const k = 1 - Math.max(0, g.clrT) / 0.25; for (const y of g.clr) { c.fillStyle = `rgba(255,255,255,${0.85 * (1 - k)})`; c.fillRect(OX, OY + y * S, C * S, S); const w = C * S * k; c.fillStyle = 'rgba(8,14,30,.95)'; c.fillRect(OX + C * S / 2 - w / 2, OY + y * S, w, S); } }
      if (g.lockFx > 0) { g.lockFx -= 1 / 60; c.globalAlpha = Math.max(0, g.lockFx) * 3; c.fillStyle = '#fff'; for (const [x, y] of g.lockCells || []) c.fillRect(OX + x * S + 1, OY + y * S + 1, S - 2, S - 2); c.globalAlpha = 1; }
      if (g.trail > 0) { g.trail -= 1 / 60; const t = g.trailD; const gr = c.createLinearGradient(0, OY + t.y0 * S, 0, OY + t.y1 * S); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, `rgba(255,255,255,${0.35 * g.trail / 0.18})`); c.fillStyle = gr; c.fillRect(OX + t.x0 * S, OY + t.y0 * S, (t.x1 - t.x0 + 1) * S, (t.y1 - t.y0) * S); }
      if (g.p && !g.clr.length) { const p = g.p; let gy = p.y; while (fits(g, p.cells, p.x, gy + 1)) gy++; c.globalAlpha = 0.22; for (const [x, y] of p.cells) if (gy + y >= 0) c.drawImage(tile(COL[p.k], S), OX + (p.x + x) * S, OY + (gy + y) * S, S, S); c.globalAlpha = 0.6; c.strokeStyle = COL[p.k]; c.lineWidth = 1.5; for (const [x, y] of p.cells) if (gy + y >= 0) c.strokeRect(OX + (p.x + x) * S + 1.5, OY + (gy + y) * S + 1.5, S - 3, S - 3); c.globalAlpha = 1;
        for (const [x, y] of p.cells) if (p.y + y >= 0) cell(c, OX + (p.x + x) * S, OY + (p.y + y) * S, COL[p.k], 1); }
      const sx = OX + C * S + 14; panel(c, sx - 4, OY - 6, 62, 70); panel(c, sx - 4, OY + 84, 62, 186);
      g.txt('HOLD', sx + 27, OY + 6, 11, '#bfeedd'); if (g.hold) mini(c, g.hold, sx + 27, OY + 38, g.canHold ? 1 : 0.4);
      g.txt('NEXT', sx + 27, OY + 96, 11, '#bfeedd'); (g.nextQ || []).forEach((k, i) => mini(c, k, sx + 27, OY + 134 + i * 52, i ? 0.8 : 1));
    } });
  function cell(c, x, y, col, a) { c.globalAlpha = a; c.drawImage(tile(col, S), x, y, S, S); c.globalAlpha = 1; }
  function panel(c, x, y, w, h) { c.fillStyle = 'rgba(8,14,30,.7)'; Kit.rr(c, x, y, w, h, 8); c.fill(); c.strokeStyle = 'rgba(120,255,190,.25)'; c.lineWidth = 1; Kit.rr(c, x, y, w, h, 8); c.stroke(); }
  function mini(c, k, cx, cy, a) { const z = 12, xs = SH[k].map(q => q[0]), ys = SH[k].map(q => q[1]); const w = (Math.max(...xs) - Math.min(...xs) + 1) * z, h = (Math.max(...ys) - Math.min(...ys) + 1) * z; c.globalAlpha = a; for (const [p, q] of SH[k]) c.drawImage(tile(COL[k], z), cx - w / 2 + (p - Math.min(...xs)) * z, cy - h / 2 + (q - Math.min(...ys)) * z, z, z); c.globalAlpha = 1; }
  function take(g) { if (!g.bag.length) { g.bag = Object.keys(SH); for (let i = 6; i > 0; i--) { const j = Math.floor(g.rnd() * (i + 1)); [g.bag[i], g.bag[j]] = [g.bag[j], g.bag[i]]; } } return g.bag.pop(); }
  function spawn(g, k) { k = k || g.nextQ.shift(); if (g.nextQ.length < 3) g.nextQ.push(take(g)); const n = k === 'I' || k === 'O' ? 4 : 3; g.p = { k, n, r: 0, cells: SH[k].map(a => a.slice()), x: 3, y: -1 }; g.canHold = true; g.lock = 0.5; if (!fits(g, g.p.cells, g.p.x, g.p.y)) g.end('Stacked out'); }
  function doHold(g) { if (!g.canHold) return; const k = g.p.k; if (g.hold) spawn(g, g.hold); else spawn(g); g.hold = k; g.canHold = false; g.sfx('whoosh'); }
  function fits(g, cells, px, py) { for (const [x, y] of cells) { const X = px + x, Y = py + y; if (X < 0 || X >= C || Y >= R) return false; if (Y >= 0 && g.bd[Y][X]) return false; } return true; }
  function rotate(g, k) { const p = g.p; if (p.k === 'O') return; const nc = rot(SH[p.k], (p.r + k) % 4, p.n); for (const dx of [0, -1, 1, -2, 2]) for (const dy of [0, -1]) if (fits(g, nc, p.x + dx, p.y + dy)) { p.cells = nc; p.r = (p.r + k) % 4; p.x += dx; p.y += dy; g.sfx('click'); g.lock = Math.min(g.lock + 0.1, 0.5); return; } }
  function place(g) { const p = g.p; for (const [x, y] of p.cells) { if (p.y + y < 0) return g.end('Stacked out'); g.bd[p.y + y][p.x + x] = COL[p.k]; } g.sfx('thud'); g.lockFx = 0.12; g.lockCells = p.cells.map(([x, y]) => [p.x + x, p.y + y]);
    const full = []; for (let y = 0; y < R; y++) if (g.bd[y].every(Boolean)) full.push(y);
    if (full.length) { const pts = [0, 100, 300, 500, 800][full.length] * g.lv; g.add(pts, 'l'); g.lines += full.length; g.float(OX + C * S / 2, OY + full[0] * S, full.length === 4 ? 'QUAD! +' + pts : '+' + pts, full.length === 4 ? '#fbbf24' : '#34d399', 22); g.sfx('line'); g.shake(full.length * 3);
      for (const y of full) g.burst(OX + C * S / 2, OY + y * S + S / 2, ['#22d3ee', '#a855f7', '#fff'], 20, 300); const nl = 1 + Math.floor(g.lines / 10); if (nl > g.lv) { g.lv = nl; g.mark('w', nl); g.sfx('power'); g.flash('#6366f1'); }
      g.clr = full; g.clrT = 0.25; g.p = null; return; }
    spawn(g); }
})();

// @uses art.js
// Hex Stack - original honeycomb drop puzzle (Hub v8 rebuild, replaces the vendored GPL game).
// Drag to aim the hex, release to drop it. 3+ touching hexes of one colour burst; falling hexes can chain. The drop timer
// shortens as you go, so the stack eventually wins: endless and uncapped, score = hexes burst x chain, skill only.
(function () {
  const COLS = 7, ROWS = 8, COL = ['#5fd68a', '#f2c744', '#ec5b84', '#4fb0ee', '#a874f2'];
  const S3 = Math.sqrt(3);
  Kit.run({ id: 'gl-hex-stack', title: 'HEX STACK', fill: true, minH: 640, maxH: 900, bg: '#0c1220',
    help: 'Drag to aim, release to drop\nMatch 3+ touching hexes to burst them\nChains multiply the score - the timer speeds up',
    init(g) { g.cols = Array.from({ length: COLS }, () => []); g.R = Math.floor((g.W - 30) / 11); layout(g); g.chain = 0; g.busy = 0; g.pieces = 0; g.fx = []; g.clr = null;
      g.next = pick(g); newPiece(g); g.armed = false; g.pk = {}; g.cleared = 0; },
    onResize(g) { layout(g); },
    update(g, dt) {
      const P = g.ptr;
      for (const col of g.cols) for (const h of col) if (h.dy > 0) { h.v = (h.v || 0) + 2600 * dt; h.dy = Math.max(0, h.dy - h.v * dt); if (!h.dy) h.v = 0; }
      g.fx = g.fx.filter(f => (f.t += dt) < f.d);
      if (g.busy > 0) { g.busy -= dt; if (g.busy <= 0) resolve(g); g.hud = hud(g); return; }
      const key = (k) => { const d = g.kd(k); const e = d && !g.pk[k]; g.pk[k] = d; return e; };
      if (key('ArrowLeft') || key('a')) g.pc = Math.max(0, g.pc - 1); if (key('ArrowRight') || key('d')) g.pc = Math.min(COLS - 1, g.pc + 1);
      if (P.pressed) g.armed = true;
      if (g.armed && P.down) { g.pc = Kit.clamp(Math.round((P.x - g.ox) / (1.5 * g.R)), 0, COLS - 1); g.aim = true; }
      let drop = false; if (g.armed && P.released && g.aim) { drop = true; g.aim = false; g.armed = false; }
      if (key('ArrowDown') || key('s') || key(' ')) drop = true;
      g.timer -= dt; if (g.timer <= 0) drop = true;
      if (drop) dropPiece(g);
      g.hud = hud(g);
    },
    draw(g, c) {
      Art.bg(c, g.W, g.H, g.t, '#14203a', '#070b16', 'rgba(110,150,255,.08)');
      const R = g.R, h = S3 * R;
      // well
      c.save(); c.globalAlpha = 0.5; for (let q = 0; q < COLS; q++) for (let r = 0; r < ROWS; r++) { const p = pos(g, q, r); hexPath(c, p.x, p.y, R - 2); c.fillStyle = 'rgba(255,255,255,.04)'; c.fill(); c.strokeStyle = 'rgba(160,190,255,.14)'; c.lineWidth = 1; c.stroke(); } c.restore();
      // danger line
      const topY = g.oy - h * 0.5; c.strokeStyle = 'rgba(255,90,110,.5)'; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(g.ox - R, topY); c.lineTo(g.ox + 6 * 1.5 * R + R, topY); c.stroke(); c.setLineDash([]);
      for (let q = 0; q < COLS; q++) g.cols[q].forEach((cell, i) => { const r = ROWS - 1 - i; const p = pos(g, q, r); const flash = g.clr && g.clr.has(cell); drawHex(c, p.x, p.y - cell.dy, R - 2, cell.c, flash ? 1 : 0); });
      for (const f of g.fx) { const k = f.t / f.d; c.save(); c.globalAlpha = 1 - k; c.strokeStyle = f.c; c.lineWidth = 3; hexPath(c, f.x, f.y, (R - 2) * (1 + k * 0.9)); c.stroke(); c.restore(); }
      // aim column guide + held piece
      if (g.state === 'play' && g.busy <= 0) { const x = g.ox + g.pc * 1.5 * R; c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(x - R * 0.8, topY - 90, R * 1.6, 90 + ROWS * h + h); drawHex(c, x, g.oy - h - 40, R - 2, COL[g.cur], 0); const tw = g.timer / g.tmax; c.fillStyle = 'rgba(255,255,255,.2)'; c.fillRect(g.ox - R, topY - 12, (6 * 1.5 * R + 2 * R) * tw, 4); }
      c.font = '700 12px system-ui,sans-serif'; c.fillStyle = '#8aa0d0'; c.textAlign = 'left'; c.fillText('NEXT', g.W - 112, 128); drawHex(c, g.W - 50, 124, 14, COL[g.next], 0);
      if (g.chain > 1 && g.busy > 0) g.txt('CHAIN x' + g.chain, g.W / 2, g.oy - h - 40, 20, '#ffe08a');
    } });
  function layout(g) { const R = g.R, h = S3 * R; g.ox = (g.W - (6 * 1.5 * R)) / 2; g.oy = Math.max(g.H - 100 - ROWS * h, 190 + h * 0.5); }
  function pos(g, q, r) { return { x: g.ox + q * 1.5 * g.R, y: g.oy + (r + (q & 1 ? 0.5 : 0)) * S3 * g.R - (ROWS - 1) * S3 * g.R + (ROWS - 1) * S3 * g.R }; }
  function hud(g) { return 'BURST ' + g.cleared + (g.chain > 1 ? '  CHAIN x' + g.chain : ''); }
  function pick(g) { return Math.min(COL.length - 1, Math.floor(g.rnd() * (g.pieces > 25 ? 5 : 4))); }
  function newPiece(g) { g.cur = g.next; g.next = pick(g); g.pc = 3; g.tmax = Math.max(1.4, 5 - g.pieces * 0.06); g.timer = g.tmax; }
  function hexPath(c, x, y, r) { c.beginPath(); for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const px = x + r * Math.cos(a), py = y + r * Math.sin(a); i ? c.lineTo(px, py) : c.moveTo(px, py); } c.closePath(); }
  function drawHex(c, x, y, r, col, flash) {
    const g = c.createLinearGradient(x, y - r, x, y + r); g.addColorStop(0, Art.light(col, 0.3)); g.addColorStop(0.55, col); g.addColorStop(1, Art.dark(col, 0.35));
    hexPath(c, x, y, r); c.fillStyle = flash ? '#fff' : g; c.fill(); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 1.3; c.stroke();
    hexPath(c, x, y, r * 0.66); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = 'rgba(255,255,255,.32)'; c.beginPath(); c.ellipse(x - r * 0.25, y - r * 0.45, r * 0.34, r * 0.14, -0.3, 0, Math.PI * 2); c.fill();
  }
  function dropPiece(g) {
    const col = g.cols[g.pc]; if (col.length >= ROWS) { g.sfx('bad'); const alt = g.cols.findIndex(a => a.length < ROWS); if (alt < 0 || g.timer > 0 && false) { g.end('full'); return; } g.pc = alt; return dropPiece(g); }
    col.push({ c: COL[g.cur], dy: (ROWS - col.length) * S3 * g.R + 30, v: 0 }); g.pieces++; g.chain = 0; g.sfx('thud'); g.mark('w', g.pieces); newPiece(g); g.busy = 0.28; g.aim = false;
    if (g.cols.some(a => a.length >= ROWS) && g.cols.every(a => a.length >= ROWS - 0)) g.end('full');
  }
  function nb(q, r) { const o = q & 1 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]; return o.map(d => [q + d[0], r + d[1]]); }
  function cellAt(g, q, r) { if (q < 0 || q >= COLS || r < 0 || r >= ROWS) return null; return g.cols[q][ROWS - 1 - r] || null; }
  function resolve(g) {
    if (g.clr) { // burst the flashed group, then collapse
      let n = 0; const gone = g.clr; g.clr = null;
      for (let q = 0; q < COLS; q++) { const col = g.cols[q]; let below = 0; const keep = []; col.forEach((cell, i) => { if (gone.has(cell)) { n++; below++; const p = pos(g, q, ROWS - 1 - i); g.fx.push({ x: p.x, y: p.y, t: 0, d: 0.35, c: cell.c }); g.burst(p.x, p.y, cell.c, 5, 140, 0.5, 3); } else { if (below) { cell.dy += below * S3 * g.R; cell.v = 0; } keep.push(cell); } }); g.cols[q] = keep; }
      g.chain++; const pts = n * 10 * g.chain; g.cleared += n; g.add(pts, 'c'); g.float(g.W / 2, g.oy, '+' + pts, '#ffe08a', 20); g.sfx(g.chain > 1 ? 'line' : 'pop'); g.shake(g.chain * 1.5, 0.15); g.busy = 0.3; return;
    }
    const seen = new Set(); let best = null;
    for (let q = 0; q < COLS; q++) for (let r = 0; r < ROWS; r++) { const cell = cellAt(g, q, r); if (!cell || seen.has(cell)) continue; const grp = new Set([cell]); const st = [[q, r]]; seen.add(cell);
      while (st.length) { const [a, b] = st.pop(); for (const [x, y] of nb(a, b)) { const o = cellAt(g, x, y); if (o && !grp.has(o) && o.c === cell.c) { grp.add(o); seen.add(o); st.push([x, y]); } } }
      if (grp.size >= 3) { if (!best) best = new Set(); for (const m of grp) best.add(m); } }
    if (best) { g.clr = best; g.busy = 0.22; } else if (g.cols.every(a => a.length >= ROWS)) g.end('full');
  }
})();

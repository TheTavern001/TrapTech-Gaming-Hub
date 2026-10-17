// Bubble Pop - original hex-grid bubble shooter (Hub build). Match 3+, drop orphans, ceiling descends.
(function () {
  const R = 16, COLS = 12, OX = 8, OY = 60; const C = ['#ef4444', '#3b82f6', '#22c55e', '#fbbf24', '#a855f7', '#22d3ee'];
  let BG = null; const POPS = [];
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, a = Math.abs(f); return 'rgb(' + Math.round((t - r) * a + r) + ',' + Math.round((t - g) * a + g) + ',' + Math.round((t - b) * a + b) + ')'; }
  const ICON = ['heart', 'drop', 'leaf', 'star', 'moon', 'diamond'];
  const SPR = {}; function bubble(c, x, y, i, sc, rot) { const k = i + ':' + (sc || 1); if (!SPR[k]) { const cv = document.createElement('canvas'); cv.width = cv.height = R * 2 + 4; bubble0(cv.getContext('2d'), R + 2, R + 2, i, sc); SPR[k] = cv; } if (rot) { c.save(); c.translate(x, y); c.rotate(rot); c.drawImage(SPR[k], -R - 2, -R - 2); c.restore(); } else c.drawImage(SPR[k], x - R - 2, y - R - 2); }
  function bubble0(c, x, y, i, sc, rot) { const r = (R - 0.5) * (sc || 1); const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, shade(C[i], 0.65)); g.addColorStop(0.55, C[i]); g.addColorStop(1, shade(C[i], -0.45)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = shade(C[i], -0.55); c.lineWidth = 1.2; c.stroke();
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.fillStyle = 'rgba(255,255,255,.35)'; const s = r * 0.42, k = ICON[i]; c.beginPath(); if (k === 'heart') { c.moveTo(0, s * 0.8); c.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.5, -s * 1.2, 0, -s * 0.4); c.bezierCurveTo(s * 0.5, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.8); } else if (k === 'drop') { c.moveTo(0, -s); c.quadraticCurveTo(s, s * 0.3, 0, s); c.quadraticCurveTo(-s, s * 0.3, 0, -s); } else if (k === 'leaf') { c.ellipse(0, 0, s * 0.45, s, 0.5, 0, 7); } else if (k === 'star') { for (let j = 0; j < 10; j++) { const rr = j % 2 ? s * 0.45 : s, a = j * 0.628 - 1.57; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } } else if (k === 'moon') { c.arc(0, 0, s, 0.6, 5.7); c.arc(s * 0.5, 0, s * 0.7, 5.2, 1.1, true); } else { c.moveTo(0, -s); c.lineTo(s * 0.8, 0); c.lineTo(0, s); c.lineTo(-s * 0.8, 0); } c.closePath(); c.fill(); c.restore();
    c.fillStyle = 'rgba(255,255,255,.8)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.45, r * 0.24, r * 0.14, -0.6, 0, 7); c.fill(); }
  const pos = (r, c) => [OX + R + c * R * 2 + (r % 2 ? R : 0), OY + R + r * R * 1.74];
  Kit.run({ fill: true, id: 'gl-bubble-pop', title: 'BUBBLE POP', help: 'Aim by dragging / mouse, release to shoot\nArrows aim + Space shoots. Match 3 or more', bg: '#3a1a6a',
    init(g) { g.grid = []; g.nc = 4; for (let r = 0; r < 6; r++) { g.grid.push([]); for (let c = 0; c < COLS; c++) g.grid[r][c] = (r % 2 && c === COLS - 1) ? -1 : g.RI(0, g.nc - 1); } g.cur = nextC(g); g.nxt = nextC(g); g.aim = -Math.PI / 2; g.shot = null; g.shots = 0; g.fall = []; g.drop = 0; },
    update(g, dt) {
      const P = g.ptr; if (P.down || matchMedia('(pointer:fine)').matches) { const a = Math.atan2(P.y - 640, P.x - 200); if (P.y < 630) g.aim = Kit.clamp(a, -Math.PI + 0.15, -0.15); } g.aim = Kit.clamp(g.aim + g.ax() * 1.8 * dt, -Math.PI + 0.15, -0.15);
      if (!g.shot && (P.released && P.y < 620 || g.kd(' ') || g.kd('ArrowUp'))) { g.shot = { x: 200, y: 640, vx: Math.cos(g.aim) * 760, vy: Math.sin(g.aim) * 760, c: g.cur }; g.cur = g.nxt; g.nxt = nextC(g); g.sfx('shoot'); }
      const s = g.shot; if (s) { for (let k = 0; k < 4; k++) { s.x += s.vx * dt / 4; s.y += s.vy * dt / 4; if (s.x < OX + R || s.x > OX + COLS * R * 2 - R) { s.vx *= -1; s.x = Kit.clamp(s.x, OX + R, OX + COLS * R * 2 - R); g.sfx('click'); }
        let hit = s.y < OY + R; for (let r = 0; r < g.grid.length && !hit; r++) for (let c = 0; c < COLS; c++) if (g.grid[r][c] >= 0) { const [x, y] = pos(r, c); if (Math.hypot(x - s.x, y - s.y) < R * 1.75) { hit = true; break; } }
        if (hit) { snap(g, s); g.shot = null; break; } } }
      for (const f of g.fall) { f.vy += 1200 * dt; f.y += f.vy * dt; f.x += f.vx * dt; } g.fall = g.fall.filter(f => f.y < g.H + 30);
      g.hud = '';
    },
    draw(g, c) { const W = g.W, H = g.H; if (!BG) { BG = document.createElement('canvas'); BG.width = W; BG.height = H; const b = BG.getContext('2d'); const sky = b.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#3a1a6a'); sky.addColorStop(0.6, '#7a3aa8'); sky.addColorStop(1, '#ff8ab0'); b.fillStyle = sky; b.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) { const x = (i * 137) % W, y = (i * 211) % H, r = 10 + (i * 7) % 30; const bg = b.createRadialGradient(x, y, 0, x, y, r); bg.addColorStop(0, 'rgba(255,255,255,.18)'); bg.addColorStop(1, 'rgba(255,255,255,0)'); b.fillStyle = bg; b.beginPath(); b.arc(x, y, r, 0, 7); b.fill(); }
        b.fillStyle = 'rgba(20,10,40,.45)'; Kit.rr(b, OX - 4, OY - 4, COLS * R * 2 + 8, 600 - OY + 8, 14); b.fill(); b.strokeStyle = 'rgba(255,255,255,.35)'; b.lineWidth = 2; b.stroke();
        b.fillStyle = '#2a1040'; b.fillRect(OX - 4, OY - 10, COLS * R * 2 + 8, 10); b.fillStyle = '#9dff7a'; b.font = 'bold 10px system-ui'; b.textAlign = 'right'; b.fillText('\u2618 BUBBLE LOUNGE \u00b7 21+', W - 12, 34); }
      c.drawImage(BG, 0, 0);
      const dz = g.grid.length ? Math.max(0, (pos(g.grid.length - 1, 0)[1] - 440) / 150) : 0; c.strokeStyle = `rgba(255,${120 - dz * 100},${140 - dz * 100},${0.5 + dz * 0.5 * (0.5 + Math.sin(g.t * 10) * 0.5)})`; c.lineWidth = 2; c.setLineDash([8, 6]); c.beginPath(); c.moveTo(OX, 590); c.lineTo(OX + COLS * R * 2, 590); c.stroke(); c.setLineDash([]);
      for (let r = 0; r < g.grid.length; r++) for (let cc = 0; cc < COLS; cc++) if (g.grid[r][cc] >= 0) { const [x, y] = pos(r, cc); bubble(c, x, y + Math.sin(g.t * 2 + cc + r) * 0.6, g.grid[r][cc], 1); }
      for (const f of g.fall) { f.rot = (f.rot || 0) + 0.2; bubble(c, f.x, f.y, f.c, 1, f.rot); }
      for (const p of POPS) { p.l -= 1 / 60; const k = 1 - p.l / 0.3; c.strokeStyle = C[p.c]; c.globalAlpha = Math.max(0, p.l / 0.3); c.lineWidth = 3; c.beginPath(); c.arc(p.x, p.y, R * (0.8 + k * 0.9), 0, 7); c.stroke(); c.globalAlpha = 1; } for (let i = POPS.length - 1; i >= 0; i--) if (POPS[i].l <= 0) POPS.splice(i, 1);
      // trajectory with wall bounce
      if (!g.shot) { let x = 200, y = 640, vx = Math.cos(g.aim), vy = Math.sin(g.aim); const LIVE = []; for (let r = 0; r < g.grid.length; r++) for (let cc = 0; cc < COLS; cc++) if (g.grid[r][cc] >= 0) LIVE.push(pos(r, cc)); c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 46; i++) { for (let k = 0; k < 14; k++) { x += vx; y += vy; if (x < OX + R || x > OX + COLS * R * 2 - R) vx *= -1; } if (y < OY) break; if (LIVE.some(([bx, by]) => (bx - x) * (bx - x) + (by - y) * (by - y) < R * R * 2.56)) break; c.globalAlpha = 1 - i / 50; c.beginPath(); c.arc(x, y, 2.6, 0, 7); c.fill(); } c.globalAlpha = 1; }
      // launcher
      c.save(); c.translate(200, 652); c.fillStyle = '#2a1040'; c.beginPath(); c.ellipse(0, 18, 44, 14, 0, 0, 7); c.fill(); c.rotate(g.aim + Math.PI / 2); const lg = c.createLinearGradient(-12, 0, 12, 0); lg.addColorStop(0, '#6a4a9a'); lg.addColorStop(0.5, '#d8c0ff'); lg.addColorStop(1, '#5a3a8a'); c.fillStyle = lg; Kit.rr(c, -11, -40, 22, 40, 6); c.fill(); c.strokeStyle = '#2a1040'; c.lineWidth = 2; c.stroke(); c.restore();
      c.fillStyle = '#4a2a7a'; c.beginPath(); c.arc(200, 652, 22, 0, 7); c.fill(); c.strokeStyle = '#ffd23f'; c.lineWidth = 3; c.stroke();
      if (g.shot) bubble(c, g.shot.x, g.shot.y, g.shot.c, 1); else bubble(c, 200, 640, g.cur, 1); c.fillStyle = 'rgba(20,10,40,.6)'; c.beginPath(); c.arc(266, 672, 18, 0, 7); c.fill(); bubble(c, 266, 672, g.nxt, 0.75); g.txt('NEXT', 266, 698, 10, '#f0e0ff');
    },
    hudDraw(g, c) { c.textAlign = 'left'; c.textBaseline = 'top'; c.font = 'bold 26px system-ui'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.45)'; const s = String(Math.floor(g.score)); c.strokeText(s, 14, 18); c.fillStyle = '#fff'; c.fillText(s, 14, 18); } });
  function present(g) { const s = new Set(); for (const row of g.grid) for (const v of row) if (v >= 0) s.add(v); return [...s]; }
  function nextC(g) { const p = present(g); return p.length ? g.pick(p) : g.RI(0, g.nc - 1); }
  function nb(r, c) { const o = r % 2 ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]]; return o.map(([dr, dc]) => [r + dr, c + dc]); }
  function snap(g, s) { let br = 0, bc = 0, bd = 1e9; for (let r = 0; r < g.grid.length + 1; r++) for (let c = 0; c < COLS; c++) { if (r % 2 && c === COLS - 1) continue; if (g.grid[r] && g.grid[r][c] >= 0) continue; const [x, y] = pos(r, c); const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; br = r; bc = c; } }
    while (g.grid.length <= br) g.grid.push(Array.from({ length: COLS }, (_, c) => (g.grid.length % 2 && c === COLS - 1) ? -1 : -2)); for (const row of g.grid) for (let c = 0; c < COLS; c++) if (row[c] === undefined) row[c] = -2;
    g.grid[br][bc] = s.c; g.shots++; g.sfx('thud');
    const same = flood(g, br, bc, (v) => v === s.c); if (same.length >= 3) { for (const [r, c] of same) { const [x, y] = pos(r, c); g.grid[r][c] = -2; g.burst(x, y, C[s.c], 6, 140, 0.4); POPS.push({ x, y, c: s.c, l: 0.3 }); } g.add(10 * same.length, 'm'); g.sfx('pop');
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

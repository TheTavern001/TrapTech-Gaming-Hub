// Bud Sort - original conveyor sorting reflex game (Hub build, Cannabis category, 21+). Jars ride a belt toward a gate;
// swipe (or tap a bin / arrow keys) to send each one to the bin matching its strain colour before it falls off. Stems and seeds
// (contaminants) go to the reject chute (swipe down). Endless: belt speeds up, more strains unlock, combos multiply.
(function () {
  const ST = [{ n: 'SATIVA', c: '#ffd23f', d: '#b8860b' }, { n: 'INDICA', c: '#a78bfa', d: '#6d28d9' }, { n: 'HYBRID', c: '#4ade80', d: '#15803d' }, { n: 'CBD', c: '#38bdf8', d: '#0369a1' }];
  const BINS = [{ x: 70, y: 210, k: 0 }, { x: 330, y: 210, k: 1 }, { x: 70, y: 560, k: 2 }, { x: 330, y: 560, k: 3 }]; const GX = 200, GY = 385;
  let BG = null;
  function bg(W, H) { if (BG) return BG; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2a24'); g.addColorStop(1, '#0b1410'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(157,255,122,.05)'; for (let y = 0; y < H; y += 24) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // belt from top centre to gate
    c.fillStyle = '#20262c'; c.fillRect(GX - 46, 0, 92, GY); c.fillStyle = '#9ca3af'; c.fillRect(GX - 50, 0, 6, GY); c.fillRect(GX + 44, 0, 6, GY);
    // gate hub
    const hg = c.createRadialGradient(GX - 8, GY - 8, 4, GX, GY, 54); hg.addColorStop(0, '#6b7280'); hg.addColorStop(1, '#1f2937'); c.fillStyle = hg; c.beginPath(); c.arc(GX, GY, 50, 0, 7); c.fill(); c.strokeStyle = '#9ca3af'; c.lineWidth = 3; c.stroke();
    // chutes to bins
    for (const b of BINS) { c.strokeStyle = 'rgba(255,255,255,.08)'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(GX, GY); c.lineTo(b.x, b.y); c.stroke(); }
    c.strokeStyle = 'rgba(255,90,90,.12)'; c.lineWidth = 30; c.beginPath(); c.moveTo(GX, GY); c.lineTo(GX, H - 20); c.stroke();
    c.fillStyle = '#3a1414'; Kit.rr(c, GX - 40, H - 70, 80, 50, 8); c.fill(); c.fillStyle = '#ff8a8a'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText('REJECT', GX, H - 40);
    c.fillStyle = 'rgba(157,255,122,.45)'; c.font = 'bold 9px sans-serif'; c.fillText('\u2618 GREENLINE PACKING CO. \u00b7 21+', GX, H - 6);
    return (BG = cv); }
  function bin(c, b, lit, t) { const s = ST[b.k]; c.save(); c.translate(b.x, b.y); const sc = 1 + lit * 0.15; c.scale(sc, sc); c.fillStyle = 'rgba(0,0,0,.4)'; Kit.rr(c, -46, -36, 96, 80, 14); c.fill(); const g = c.createLinearGradient(0, -40, 0, 40); g.addColorStop(0, s.c); g.addColorStop(1, s.d); c.fillStyle = g; Kit.rr(c, -48, -40, 96, 78, 14); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; Kit.rr(c, -44, -36, 88, 12, 6); c.fill(); c.fillStyle = 'rgba(0,0,0,.35)'; Kit.rr(c, -36, -18, 72, 30, 8); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 15px sans-serif'; c.textAlign = 'center'; c.fillText(s.n, 0, 3); c.font = 'bold 9px sans-serif'; c.fillText(['\u2191\u2190', '\u2191\u2192', '\u2193\u2190', '\u2193\u2192'][b.k], 0, 28); if (lit > 0) { c.strokeStyle = '#fff'; c.lineWidth = 3; c.globalAlpha = lit * 3; Kit.rr(c, -48, -40, 96, 78, 14); c.stroke(); } c.restore(); }
  function item(c, it, t) { c.save(); c.translate(it.x, it.y); c.rotate(it.rot || 0); const sc = it.sc || 1; c.scale(sc, sc);
    if (it.k < 0) { c.strokeStyle = '#8a6a3a'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, 8); c.quadraticCurveTo(0, -4, 14, -10); c.stroke(); c.fillStyle = '#5a3a1a'; for (const [x, y] of [[-6, 6], [3, 0], [9, -6]]) { c.beginPath(); c.ellipse(x, y, 3.5, 2.5, 0.5, 0, 7); c.fill(); } c.fillStyle = '#ff5a5a'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('\u2716', 0, -16); }
    else { const s = ST[it.k]; c.fillStyle = 'rgba(0,0,0,.35)'; Kit.rr(c, -15, -18, 32, 40, 7); c.fill(); const g = c.createLinearGradient(-16, 0, 16, 0); g.addColorStop(0, 'rgba(220,240,255,.85)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(170,200,220,.85)'); c.fillStyle = g; Kit.rr(c, -16, -18, 32, 38, 7); c.fill();
      c.fillStyle = s.d; Kit.rr(c, -12, -6, 24, 22, 5); c.fill(); c.fillStyle = s.c; for (const [x, y, r] of [[-4, 0, 6], [5, 4, 5], [-2, 9, 5], [4, -3, 4]]) { c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); } c.fillStyle = 'rgba(255,255,255,.5)'; for (const [x, y] of [[-5, -2], [4, 3], [0, 8]]) c.fillRect(x, y, 1.5, 1.5);
      c.fillStyle = s.c; Kit.rr(c, -17, -24, 34, 8, 3); c.fill(); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(-17, -18, 34, 2); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-12, -14, 2, 30); }
    c.restore(); }
  Kit.run({ id: 'gl-bud-sort', title: 'BUD SORT', help: '21+ only. Swipe each jar toward the bin of its colour (or tap the bin / arrows + Q/E)\nStems & seeds: swipe DOWN to reject. Don\'t let the gate jam', bg: '#0b1410',
    init(g) { g.items = []; g.fly = []; g.lit = [0, 0, 0, 0]; g.lives = 3; g.combo = 0; g.sorted = 0; g.spawnT = 0.5; g.belt = 0; g.hud = ''; },
    update(g, dt) { const lvl = g.sorted / 15, sp = 70 + lvl * 9, nk = Math.min(4, 2 + Math.floor(g.sorted / 10)); g.belt = (g.belt + sp * dt) % 24;
      g.spawnT -= dt; if (g.spawnT <= 0) { g.spawnT = Math.max(0.55, 1.6 - lvl * 0.08); g.items.push({ x: GX + g.R(-10, 10), y: -30, k: g.rnd() < 0.12 ? -1 : g.RI(0, nk - 1), rot: g.R(-0.2, 0.2) }); }
      for (const it of g.items) it.y += sp * dt; const head = g.items.filter(i => !i.gone).sort((a, b) => b.y - a.y)[0];
      let dir = null; const P = g.ptr; if (P.pressed) g.sw = { x: P.x, y: P.y }; if (P.released && g.sw) { const dx = P.x - g.sw.x, dy = P.y - g.sw.y; if (Math.hypot(dx, dy) > 24) { if (dy > 30 && Math.abs(dx) < Math.abs(dy) * 0.5) dir = 'R'; else dir = (dy < 0 ? 0 : 2) + (dx < 0 ? 0 : 1); } else { const bi = BINS.findIndex(b => Math.abs(P.x - b.x) < 52 && Math.abs(P.y - b.y) < 44); if (bi >= 0) dir = bi; else if (P.y > g.H - 80) dir = 'R'; } g.sw = null; }
      const KM = { q: 0, e: 1, a: 2, d: 3, ArrowDown: 'R', s: 'R' }; for (const k in KM) if (g.kd(k)) dir = KM[k]; if (g.kd('ArrowLeft')) dir = (g.keys.ArrowUp ? 0 : 2); if (g.kd('ArrowRight')) dir = (g.keys.ArrowUp ? 1 : 3);
      if (dir !== null && head && head.y > GY - 230) { head.gone = true; const ok = dir === 'R' ? head.k < 0 : head.k === BINS[dir].k; const tx = dir === 'R' ? GX : BINS[dir].x, ty = dir === 'R' ? g.H - 45 : BINS[dir].y; g.fly.push({ ...head, sx: head.x, sy: head.y, tx, ty, t: 0, ok, dir });
        if (ok) { g.combo++; g.sorted++; g.mark('s', g.sorted); const proximity = Math.max(0, Math.min(1, (head.y - (GY - 230)) / 230)); const pts = Math.round((10 + proximity * 10) * Math.min(8, 1 + Math.floor(g.combo / 5))); g.add(pts, 'sort'); if (dir !== 'R') g.lit[dir] = 0.3; g.sfx('coin'); if (g.combo % 10 === 0) { g.float(200, 300, 'COMBO ' + g.combo, '#9dff7a', 24); g.sfx('power'); } }
        else { g.combo = 0; g.lives--; g.sfx('bad'); g.shake(6); g.float(tx, ty - 40, 'WRONG BIN', '#ff5a5a', 16); if (g.lives <= 0) return g.end('Mixed up the strains'); } }
      for (const it of g.items) if (!it.gone && it.y > GY + 6) { it.gone = true; if (it.k >= 0) { g.combo = 0; g.lives--; g.sfx('bad'); g.shake(8); g.float(GX, GY + 60, 'GATE JAM', '#ff5a5a', 18); g.burst(GX, GY, ['#9ca3af', '#fff'], 16, 160); if (g.lives <= 0) return g.end('Gate jammed'); } else { g.combo = 0; g.lives--; g.float(GX, GY + 60, 'STEM SLIPPED IN', '#ff5a5a', 16); g.sfx('bad'); if (g.lives <= 0) return g.end('Contaminated batch'); } }
      g.items = g.items.filter(i => !i.gone);
      for (const f of g.fly) { f.t += dt * 4; const k = Math.min(1, f.t); f.x = f.sx + (f.tx - f.sx) * k; f.y = f.sy + (f.ty - f.sy) * k - Math.sin(k * Math.PI) * 40; f.sc = 1 - k * 0.4; f.rot += dt * 10; if (f.t >= 1 && !f.done) { f.done = true; g.burst(f.tx, f.ty, f.ok ? [f.k >= 0 ? ST[f.k].c : '#ff8a8a', '#fff'] : ['#ff5a5a'], 10, 140, 0.4); } } g.fly = g.fly.filter(f => f.t < 1.05);
      for (let i = 0; i < 4; i++) g.lit[i] = Math.max(0, g.lit[i] - dt); },
    draw(g, c) { c.drawImage(bg(g.W, g.H), 0, 0); const t = g.t;
      c.fillStyle = 'rgba(255,255,255,.07)'; for (let y = -24 + g.belt; y < GY - 40; y += 24) c.fillRect(GX - 44, y, 88, 3);
      for (const b of BINS) bin(c, b, g.lit[BINS.indexOf(b)], t);
      const head = g.items.slice().sort((a, b) => b.y - a.y)[0]; if (head && head.y > GY - 230) { c.strokeStyle = 'rgba(255,255,255,' + (0.4 + Math.sin(t * 10) * 0.3) + ')'; c.lineWidth = 2; c.beginPath(); c.arc(head.x, head.y, 28, 0, 7); c.stroke(); }
      c.fillStyle = 'rgba(255,90,90,' + (0.15 + (head ? Math.max(0, (head.y - (GY - 80)) / 80) * 0.5 : 0)) + ')'; c.beginPath(); c.arc(GX, GY, 46, 0, 7); c.fill();
      for (const it of g.items) item(c, it, t); for (const f of g.fly) item(c, f, t); },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = '#9dff7a'; c.fillText('SORTED ' + g.sorted + (g.combo >= 5 ? '  \u00b7  x' + Math.min(8, 1 + Math.floor(g.combo / 5)) : ''), 14, 48); c.textAlign = 'right'; c.font = 'bold 16px sans-serif'; c.fillStyle = '#7dff6a'; c.fillText('\u2618'.repeat(Math.max(0, g.lives)), g.W - 14, 32); } });
})();

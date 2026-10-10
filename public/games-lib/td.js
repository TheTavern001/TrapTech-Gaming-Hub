// Shared grid tower-defense engine (original code, MIT). Path mode (fixed road) or maze mode (towers block, enemies BFS).
// cfg: { id, title, help, theme, maze, path:[[c,r]...], towers:[{n,cost,range,rate,dmg,c,kind}], enemy(wave,i,g)->{hp,sp,v,c,r,layers,armor,fly},
//        perWave(w)->count, bonus(w), startCash, lives, kill:'pts'|'layers' }
window.TD = function (cfg) {
  const CS = 40, COLS = 20, ROWS = 10, OY = 50; const T = cfg.theme || {};
  Kit.run({ id: cfg.id, title: cfg.title, orient: 'l', help: cfg.help || 'Tap a tower card, then tap a free tile to build\nTap a tower to upgrade it - waves auto-start', bg: T.bg || '#0b1e12',
    init(g) { g.cash = cfg.startCash || 120; g.lives = cfg.lives || 20; g.wave = 0; g.en = []; g.tw = []; g.sh = []; g.sel = 0; g.wt = 6; g.queue = 0; g.occ = new Set(); g.block = new Set();
      if (cfg.maze) { g.start = [0, 4]; g.goal = [COLS - 1, 5]; route(g); } else { g.path = expand(cfg.path); for (const p of g.path) g.block.add(p[0] + ',' + p[1]); }
      if (cfg.rocks) for (let i = 0; i < cfg.rocks; i++) { const c = g.RI(2, COLS - 3), r = g.RI(0, ROWS - 1); if (!g.block.has(c + ',' + r)) g.occ.add(c + ',' + r + ',rock'); } },
    update(g, dt) {
      for (let i = 0; i < cfg.towers.length; i++) if (g.kd(String(i + 1))) g.sel = i;
      const P = g.ptr; if (P.pressed) { if (P.y > g.H - 50) { const i = Math.floor((P.x - 10) / 118); if (i >= 0 && i < cfg.towers.length) { g.sel = i; g.sfx('click'); } else if (P.x > g.W - 110) { g.wt = 0; } }
        else { const c = Math.floor(P.x / CS), r = Math.floor((P.y - OY) / CS); if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tap(g, c, r); } }
      if (g.kd(' ')) { // keyboard helper: build the selected tower on the best free tile next to the road
        let best = null, bs = -1; for (let c = 1; c < COLS - 1; c++) for (let r = 0; r < ROWS; r++) { if (!free(g, c, r)) continue; const sc = (g.path || []).filter(p => Math.abs(p[0] - c) <= 2 && Math.abs(p[1] - r) <= 2).length; if (sc > bs) { bs = sc; best = [c, r]; } } if (best) tap(g, best[0], best[1]); }
      if (g.kd('n') || g.kd('Enter')) g.wt = 0;
      g.wt -= dt; if (g.wt <= 0 && g.queue <= 0 && !g.en.length) { g.wave++; g.mark('w', g.wave); g.queue = cfg.perWave ? cfg.perWave(g.wave) : 6 + g.wave * 2; g.qi = 0; g.qt = 0; g.wt = 1e9; g.float(g.W / 2, 200, 'WAVE ' + g.wave, '#fbbf24', 28); g.sfx('bad'); }
      if (g.queue > 0) { g.qt -= dt; if (g.qt <= 0) { g.qt = Math.max(0.25, 0.9 - g.wave * 0.02); g.queue--; const e = cfg.enemy(g.wave, g.qi++, g); const p0 = g.path[0]; g.en.push({ ...e, max: e.hp, d: 0, x: p0[0] * CS + CS / 2, y: OY + p0[1] * CS + CS / 2, slow: 0 }); } }
      for (const e of g.en) { const sp = e.sp * (e.slow > 0 ? 0.5 : 1); e.slow -= dt; e.d += sp * dt / CS; const path = e.fly ? [g.path[0], g.path[g.path.length - 1]] : g.path; const L = path.length - 1; const seg = e.fly ? e.d / (Math.hypot(path[1][0] - path[0][0], path[1][1] - path[0][1])) : e.d;
        if (seg >= L) { e.gone = true; g.lives -= e.layers || 1; g.sfx('hit'); g.shake(5); g.flash('#ef4444', 0.08); continue; } const i = Math.floor(seg), f = seg - i; const a = path[i], b = path[i + 1]; e.x = (a[0] + (b[0] - a[0]) * f) * CS + CS / 2; e.y = OY + (a[1] + (b[1] - a[1]) * f) * CS + CS / 2; }
      g.en = g.en.filter(e => !e.gone); if (g.lives <= 0) return g.end('Base overrun');
      for (const t of g.tw) { t.cd -= dt; const S = cfg.towers[t.k]; const rng = S.range * (1 + 0.15 * (t.lv - 1)) * CS; if (t.cd > 0) continue; let tg = null, bd = -1;
        for (const e of g.en) { if (e.fly && S.noAir) continue; if (Math.hypot(e.x - t.x, e.y - t.y) <= rng && e.d > bd) { bd = e.d; tg = e; } }
        if (!tg) continue; t.cd = S.rate / (1 + 0.2 * (t.lv - 1)); t.a = Math.atan2(tg.y - t.y, tg.x - t.x); const dmg = S.dmg * (1 + 0.6 * (t.lv - 1));
        if (S.kind === 'laser' || S.kind === 'sniper') { hurt(g, tg, dmg, S); t.beam = { x: tg.x, y: tg.y, l: 0.08 }; g.sfx('shoot'); }
        else if (S.kind === 'pulse') { for (const e of g.en) if (Math.hypot(e.x - t.x, e.y - t.y) <= rng) { hurt(g, e, dmg, S); if (S.slow) e.slow = S.slow; } t.ring = 0.25; g.sfx('whoosh'); }
        else { g.sh.push({ x: t.x, y: t.y, tg, sp: S.speed || 420, dmg, S }); if (g.frames % 2) g.sfx('shoot'); } }
      for (const s of g.sh) { if (s.tg.hp <= 0 || s.tg.gone) { s.dead = true; continue; } const dx = s.tg.x - s.x, dy = s.tg.y - s.y, d = Math.hypot(dx, dy); if (d < 8) { s.dead = true; if (s.S.kind === 'splash') { g.burst(s.x, s.y, s.S.c, 10, 120, 0.3); for (const e of g.en) if (Math.hypot(e.x - s.x, e.y - s.y) < (s.S.radius || 1.2) * CS) hurt(g, e, s.dmg, s.S); g.sfx('thud'); } else hurt(g, s.tg, s.dmg, s.S); if (s.S.slow) s.tg.slow = s.S.slow; continue; } s.x += dx / d * s.sp * dt; s.y += dy / d * s.sp * dt; }
      g.sh = g.sh.filter(s => !s.dead);
      for (const e of g.en) if (e.hp <= 0 && !e.dead) { e.dead = true; }
      g.en = g.en.filter(e => !e.dead);
      if (g.queue === 0 && !g.en.length && g.wt > 100) { const b = cfg.bonus ? cfg.bonus(g.wave) : 50 * g.wave; g.add(b, 'c'); g.cash += 40 + g.wave * 6; g.float(g.W / 2, 220, 'WAVE ' + g.wave + ' CLEAR +' + b, '#34d399', 22); g.sfx('line'); g.wt = 5; }
      g.hud = 'WAVE ' + g.wave + '   $' + g.cash + '   \u2665 ' + g.lives;
    },
    draw(g, c) {
      c.fillStyle = T.ground || '#14532d'; c.fillRect(0, OY, COLS * CS, ROWS * CS);
      c.strokeStyle = 'rgba(255,255,255,.04)'; for (let x = 0; x <= COLS; x++) { c.beginPath(); c.moveTo(x * CS, OY); c.lineTo(x * CS, OY + ROWS * CS); c.stroke(); }
      c.fillStyle = T.road || '#a16207'; for (const p of g.path) c.fillRect(p[0] * CS + 2, OY + p[1] * CS + 2, CS - 4, CS - 4);
      for (const k of g.occ) { const [cc, r, t] = k.split(','); if (t === 'rock') { c.fillStyle = '#57534e'; Kit.rr(c, cc * CS + 6, OY + r * CS + 8, CS - 12, CS - 14, 8); c.fill(); } }
      const pe = g.path[g.path.length - 1]; c.fillStyle = T.base || '#6366f1'; c.fillRect(pe[0] * CS + 4, OY + pe[1] * CS + 4, CS - 8, CS - 8);
      for (const t of g.tw) { const S = cfg.towers[t.k]; c.fillStyle = '#1f2937'; Kit.rr(c, t.x - 16, t.y - 16, 32, 32, 6); c.fill(); Kit.glow(c, S.c, 8); Kit.circ(c, t.x, t.y, 10 + t.lv, S.c); Kit.noGlow(c); c.strokeStyle = S.c; c.lineWidth = 5; c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.x + Math.cos(t.a || 0) * 18, t.y + Math.sin(t.a || 0) * 18); c.stroke(); for (let i = 0; i < t.lv; i++) Kit.circ(c, t.x - 12 + i * 6, t.y + 14, 2, '#fbbf24');
        if (t.beam && (t.beam.l -= 1 / 60) > 0) { c.strokeStyle = S.c; c.lineWidth = 3; c.beginPath(); c.moveTo(t.x, t.y); c.lineTo(t.beam.x, t.beam.y); c.stroke(); } if (t.ring && (t.ring -= 1 / 60) > 0) { c.strokeStyle = S.c; c.globalAlpha = t.ring * 3; c.lineWidth = 2; c.beginPath(); c.arc(t.x, t.y, S.range * CS * (1 - t.ring * 2), 0, 7); c.stroke(); c.globalAlpha = 1; } }
      for (const e of g.en) { if (cfg.drawEnemy) cfg.drawEnemy(c, e, g); else { Kit.glow(c, e.c, 6); Kit.circ(c, e.x, e.y, e.r || 10, e.c); Kit.noGlow(c); } if (e.max > 1 && e.hp < e.max && !e.layers) { c.fillStyle = '#111'; c.fillRect(e.x - 12, e.y - 18, 24, 4); c.fillStyle = '#34d399'; c.fillRect(e.x - 12, e.y - 18, 24 * e.hp / e.max, 4); } }
      for (const s of g.sh) Kit.circ(c, s.x, s.y, 3.5, s.S.c);
      c.fillStyle = 'rgba(5,7,20,.8)'; c.fillRect(0, g.H - 50, g.W, 50);
      cfg.towers.forEach((S, i) => { const x = 10 + i * 118; c.fillStyle = g.sel === i ? '#6366f1' : '#1d2a66'; Kit.rr(c, x, g.H - 46, 112, 42, 8); c.fill(); Kit.circ(c, x + 18, g.H - 25, 9, S.c); g.txt(S.n, x + 66, g.H - 34, 11, '#fff'); g.txt('$' + S.cost, x + 66, g.H - 16, 12, g.cash >= S.cost ? '#fbbf24' : '#ef4444'); });
      if (g.wt < 100 && g.wt > 0 && g.state === 'play') { c.fillStyle = '#16a34a'; Kit.rr(c, g.W - 108, g.H - 46, 100, 42, 8); c.fill(); g.txt('NEXT ' + Math.ceil(g.wt) + 's \u25B6', g.W - 58, g.H - 25, 12, '#fff'); }
    } });
  function expand(pts) { const out = []; for (let i = 0; i < pts.length - 1; i++) { let [x, y] = pts[i]; const [bx, by] = pts[i + 1]; while (x !== bx || y !== by) { out.push([x, y]); x += Math.sign(bx - x); y += Math.sign(by - y); } } out.push(pts[pts.length - 1]); return out; }
  function free(g, c, r) { const k = c + ',' + r; return !g.block.has(k) && !g.tw.some(t => t.c === c && t.r === r) && !g.occ.has(k + ',rock'); }
  function bfs(g, extra) { const S = g.start, G = g.goal, prev = new Map(), q = [S], key = (p) => p[0] + ',' + p[1]; prev.set(key(S), null); const blk = (c, r) => g.tw.some(t => t.c === c && t.r === r) || g.occ.has(c + ',' + r + ',rock') || (extra && extra[0] === c && extra[1] === r);
    while (q.length) { const p = q.shift(); if (p[0] === G[0] && p[1] === G[1]) { const out = []; let k = key(p), cur = p; while (cur) { out.unshift(cur); cur = prev.get(key(cur)); } return out; } for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) { const n = [p[0] + dx, p[1] + dy]; if (n[0] < 0 || n[1] < 0 || n[0] >= COLS || n[1] >= ROWS || blk(n[0], n[1]) || prev.has(key(n))) continue; prev.set(key(n), p); q.push(n); } } return null; }
  function route(g) { g.path = bfs(g); }
  function tap(g, c, r) { const t = g.tw.find(t => t.c === c && t.r === r); if (t) { const cost = Math.round(cfg.towers[t.k].cost * 0.8 * t.lv); if (t.lv < 4 && g.cash >= cost) { g.cash -= cost; t.lv++; g.sfx('power'); g.float(t.x, t.y - 20, 'LV ' + t.lv, '#fbbf24'); } else g.sfx('bad'); return; }
    const S = cfg.towers[g.sel]; if (!free(g, c, r) || g.cash < S.cost) { g.sfx('bad'); return; }
    if (cfg.maze) { if ((c === g.start[0] && r === g.start[1]) || (c === g.goal[0] && r === g.goal[1])) return; const np = bfs(g, [c, r]); if (!np) { g.sfx('bad'); g.float(c * CS + 20, OY + r * CS, 'BLOCKED', '#ef4444'); return; } if (g.en.some(e => !e.fly && Math.floor((e.x) / CS) === c && Math.floor((e.y - OY) / CS) === r)) { g.sfx('bad'); return; } }
    g.cash -= S.cost; g.tw.push({ k: g.sel, c, r, x: c * CS + CS / 2, y: OY + r * CS + CS / 2, cd: 0, lv: 1, a: 0 }); g.sfx('thud'); g.burst(c * CS + 20, OY + r * CS + 20, S.c, 10, 100);
    if (cfg.maze) { const old = g.path; route(g); for (const e of g.en) if (!e.fly) { // re-map progress to nearest cell on the new path
      const cc = Math.round((e.x - CS / 2) / CS), rr = Math.round((e.y - OY - CS / 2) / CS); let bi = 0, bd = 1e9; g.path.forEach((p, i) => { const d = Math.abs(p[0] - cc) + Math.abs(p[1] - rr); if (d < bd) { bd = d; bi = i; } }); e.d = bi; } } }
  function hurt(g, e, dmg, S) { if (e.hp <= 0) return; const d = Math.max(dmg * 0.25, dmg - (e.armor || 0)); 
    if (e.layers) { const before = Math.ceil(e.hp / e.lhp); e.hp -= d; const after = Math.max(0, Math.ceil(e.hp / e.lhp)); const popped = before - after; if (popped > 0) { g.add(popped, 'o'); g.cash += popped; e.layers = after; e.c = cfg.layerColor(after); g.sfx('pop'); g.burst(e.x, e.y, '#fff', 4, 80, 0.3); } if (e.hp <= 0) e.dead = true; return; }
    e.hp -= d; if (e.hp <= 0) { e.dead = true; g.add(e.v, 'k'); g.cash += e.cash || Math.ceil(e.v / 2); g.burst(e.x, e.y, e.c, 12, 140); g.sfx('pop'); g.float(e.x, e.y - 10, '+' + e.v, '#fff', 12); } }
};

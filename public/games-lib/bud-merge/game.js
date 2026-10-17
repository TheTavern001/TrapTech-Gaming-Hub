// @uses art.js
// Bud Merge - original merge puzzle (Hub v8 rebuild). Slide the whole 5x5 grove, matching buds fuse into the next tier.
// Endless, uncapped: score = sum of every merged bud value. Skill only (the seeded spawns are identical for everyone on a seed).
(function () {
  const N = 5, TIERS = ['#7bd88f', '#43c46a', '#2fb5a0', '#33a1e0', '#6f7cf0', '#a269f0', '#d65fd0', '#f0589a', '#f0803c', '#f0c23c', '#ffe97a'];
  const val = (t) => 2 << t;
  Kit.run({ id: 'gl-bud-merge', title: 'BUD MERGE', fill: true, bg: '#08150f', minH: 640, maxH: 900,
    help: 'Swipe (or arrow keys) to slide every bud\nMatching buds fuse into the next tier\nNo win stop: keep merging for a higher score',
    init(g) { g.grid = Array.from({ length: N }, () => Array(N).fill(null)); g.anim = []; g.lock = 0; g.moves = 0; g.combo = 0; spawn(g); spawn(g); layout(g); },
    onResize(g) { layout(g); },
    update(g, dt) {
      const P = g.ptr; if (g.lock > 0) g.lock -= dt; if (g.tiles) for (const tl of g.tiles) if (tl.t < 1) tl.t = Math.min(1, tl.t + dt / 0.17);
      for (const a of g.anim) a.t = Math.min(1, a.t + dt / a.d); g.anim = g.anim.filter(a => a.t < 1 || a.keep);
      let dir = null;
      if (P.released && Math.hypot(P.x - P.sx, P.y - P.sy) > 22) { const dx = P.x - P.sx, dy = P.y - P.sy; dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U'); }
      if (g.kd('ArrowLeft') || g.kd('a')) dir = 'L'; if (g.kd('ArrowRight') || g.kd('d')) dir = 'R'; if (g.kd('ArrowUp') || g.kd('w')) dir = 'U'; if (g.kd('ArrowDown') || g.kd('s')) dir = 'D';
      if (dir && g.lock <= 0) move(g, dir);
      g.hud = 'MOVES ' + g.moves + (g.combo > 1 ? '   COMBO x' + g.combo : '');
    },
    draw(g, c) {
      const t = g.t + performance.now() / 1000 * 0;
      Art.bg(c, g.W, g.H, g.t, '#0c2418', '#05100a', 'rgba(70,220,120,.09)');
      const { bx, by, cs, bs } = g;
      // board
      Art.rr(c, bx - 10, by - 10, bs + 20, bs + 20, 22); const bg = c.createLinearGradient(0, by, 0, by + bs); bg.addColorStop(0, '#12301f'); bg.addColorStop(1, '#0a1d13'); c.fillStyle = bg; c.fill();
      c.strokeStyle = 'rgba(120,255,170,.25)'; c.lineWidth = 2; c.stroke();
      for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) { Art.rr(c, bx + q * cs + 4, by + r * cs + 4, cs - 8, cs - 8, 12); c.fillStyle = 'rgba(0,0,0,.28)'; c.fill(); }
      // tiles (animated from -> to)
      const live = g.grid; const drawn = new Set();
      for (const tl of g.tiles || []) {
        const e = Art.ease.out(Math.min(1, tl.t)); const x = bx + (tl.fc + (tl.tc - tl.fc) * e) * cs, y = by + (tl.fr + (tl.tr - tl.fr) * e) * cs;
        let sc = 1; if (tl.born) sc = Art.ease.back(Math.min(1, Math.max(0, (tl.t - 0.5) * 2))) * (tl.t < 0.5 ? 0 : 1) || 0; if (tl.pop) sc = 1 + 0.22 * Math.sin(Math.min(1, Math.max(0, (tl.t - 0.6) / 0.4)) * Math.PI);
        if (tl.dead && tl.t >= 1) continue; if (sc <= 0.01) continue; tileAt(c, x, y, cs, tl.tier, sc);
      }
      if (g.over0) { c.fillStyle = 'rgba(5,10,8,.4)'; c.fillRect(0, 0, g.W, g.H); }
      g.txt('Slide in any direction', g.W / 2, by + bs + 34, 13, '#8ab89a');
    } });
  function layout(g) { g.bs = Math.min(g.W - 40, g.H - 250); g.cs = g.bs / N; g.bx = (g.W - g.bs) / 2; g.by = Math.max(110, (g.H - g.bs) / 2 - 10); }
  function tileAt(c, x, y, cs, tier, sc) { const pad = 5, s = cs - pad * 2; c.save(); c.translate(x + cs / 2, y + cs / 2); c.scale(sc, sc);
    Art.tile(c, -s / 2, -s / 2, s, s, TIERS[Math.min(tier, TIERS.length - 1)], 13);
    Art.bud(c, 0, -s * 0.06, s * 0.36, A_light(TIERS[Math.min(tier, TIERS.length - 1)]), tier);
    c.font = '900 ' + Math.round(s * (val(tier) > 999 ? 0.22 : 0.27)) + 'px system-ui,sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(val(tier), 0, s * 0.31); c.fillStyle = '#fff'; c.fillText(val(tier), 0, s * 0.31); c.restore(); }
  const A_light = (c) => Art.light(c, 0.2);
  function spawn(g) { const e = []; for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) if (!g.grid[r][q]) e.push([r, q]); if (!e.length) return; const [r, q] = g.pick(e); const tier = g.rnd() < 0.88 ? 0 : 1; g.grid[r][q] = { tier, id: ++g.uid || (g.uid = 1) }; (g.tiles = g.tiles || []).push({ fr: r, fc: q, tr: r, tc: q, tier, t: 0, born: true, id: g.uid }); }
  function move(g, dir) {
    const vec = { L: [0, -1], R: [0, 1], U: [-1, 0], D: [1, 0] }[dir]; const [dr, dc] = vec; const grid = g.grid; let moved = false, gained = 0, merges = 0;
    const tiles = []; const order = []; for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) order.push([r, q]);
    order.sort((a, b) => (dr > 0 ? b[0] - a[0] : dr < 0 ? a[0] - b[0] : 0) || (dc > 0 ? b[1] - a[1] : dc < 0 ? a[1] - b[1] : 0));
    const merged = Array.from({ length: N }, () => Array(N).fill(false));
    for (const [r, q] of order) { const tl = grid[r][q]; if (!tl) continue; let nr = r, nc = q;
      while (true) { const pr = nr + dr, pc = nc + dc; if (pr < 0 || pc < 0 || pr >= N || pc >= N) break; const o = grid[pr][pc]; if (!o) { grid[nr][nc] = null; nr = pr; nc = pc; grid[nr][nc] = tl; moved = true; continue; }
        if (o.tier === tl.tier && !merged[pr][pc] && !o.dying) { grid[nr][nc] = null; o.tier++; merged[pr][pc] = true; const v = val(o.tier); gained += v; merges++; tiles.push({ fr: nr, fc: nc, tr: pr, tc: pc, tier: tl.tier, t: 0, dead: true }); o.mergedFrom = true; moved = true; o.pop = true; nr = pr; nc = pc; tl.gone = true; break; } break; }
      if (!tl.gone) tiles.push({ fr: r, fc: q, tr: nr, tc: nc, tier: tl.tier, t: 0, ref: tl }); }
    if (!moved) { g.sfx('bad'); return; }
    // rebuild visual tiles from final grid positions
    const vis = []; const from = new Map(); for (const t of tiles) if (t.ref) from.set(t.ref, t);
    for (const t of tiles) { if (t.dead) { vis.push({ ...t, t: 0 }); } }
    for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) { const tl = grid[r][q]; if (!tl) continue; const f = from.get(tl); const pop = !!tl.pop; tl.pop = false; vis.push({ fr: f ? f.fr : r, fc: f ? f.fc : q, tr: r, tc: q, tier: tl.tier, t: 0, pop }); tl.gone = false; }
    g.tiles = vis; g.anim.push({ t: 0, d: 0.16 });
    for (const t of vis) { t._d = 0.16; }
    g.moves++; g.lock = 0.13; g.combo = merges > 1 ? merges : 0;
    if (gained) { g.add(gained, 'm'); g.sfx(merges > 1 ? 'line' : 'pop'); g.float(g.W / 2, g.by - 28, '+' + gained, '#9bffb8', 22); for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) if (merged[r][q]) g.burst(g.bx + (q + 0.5) * g.cs, g.by + (r + 0.5) * g.cs, [TIERS[Math.min(10, grid[r][q].tier)], '#fff'], 12, 150, 0.5, 3); if (merges > 1) g.shake(4, 0.15); } else g.sfx('click');
    spawn(g); (g.tiles).forEach(t => { if (t.born) t.t = 0; });
    g.mark('w', g.moves);
    if (!canMove(g)) { g.over0 = true; g.end('No moves left'); }
  }
  function canMove(g) { for (let r = 0; r < N; r++) for (let q = 0; q < N; q++) { const t = g.grid[r][q]; if (!t) return true; if (q + 1 < N && g.grid[r][q + 1] && g.grid[r][q + 1].tier === t.tier) return true; if (r + 1 < N && g.grid[r + 1][q] && g.grid[r + 1][q].tier === t.tier) return true; } return false; }
})();

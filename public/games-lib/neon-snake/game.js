// Neon Serpent - original grid snake (Hub build)
Kit.run({ id: 'gl-neon-snake', title: 'NEON SERPENT', help: 'Arrows / swipe to turn\nEat, grow, speed up - gold is worth 50', bg: '#040616',
  init(g) { g.N = 20; g.S = 19; g.ox = (g.W - g.N * g.S) / 2; g.oy = 120; g.sn = [[10, 12], [10, 13], [10, 14]]; g.d = [0, -1]; g.q = []; g.mt = 0; g.lv = 1; g.eaten = 0; food(g); g.gold = null; },
  update(g, dt) {
    const want = (d) => { const last = g.q.length ? g.q[g.q.length - 1] : g.d; if (d[0] !== -last[0] || d[1] !== -last[1]) if (g.q.length < 3) g.q.push(d); };
    if (g.kd('ArrowUp') || g.kd('w')) want([0, -1]); if (g.kd('ArrowDown') || g.kd('s')) want([0, 1]); if (g.kd('ArrowLeft') || g.kd('a')) want([-1, 0]); if (g.kd('ArrowRight') || g.kd('d')) want([1, 0]);
    if (g.ptr.down) { const dx = g.ptr.x - g.ptr.sx, dy = g.ptr.y - g.ptr.sy; if (Math.hypot(dx, dy) > 22) { want(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]); g.ptr.sx = g.ptr.x; g.ptr.sy = g.ptr.y; } }
    if (g.ptr.pressed && !g.ptr.down) {}
    g.mt += dt; const iv = Math.max(0.055, 0.15 - g.lv * 0.008); if (g.mt < iv) return; g.mt = 0;
    if (g.q.length) g.d = g.q.shift(); const h = g.sn[0]; const n = [h[0] + g.d[0], h[1] + g.d[1]];
    if (n[0] < 0 || n[1] < 0 || n[0] >= g.N || n[1] >= g.N || g.sn.some((s, i) => i < g.sn.length - 1 && s[0] === n[0] && s[1] === n[1])) { g.burst(g.ox + h[0] * g.S, g.oy + h[1] * g.S, '#34d399', 40, 240); return g.end('Crashed'); }
    g.sn.unshift(n); let grow = false;
    if (n[0] === g.f[0] && n[1] === g.f[1]) { grow = true; const v = 10 * g.lv; g.add(v, 'f'); g.float(g.ox + n[0] * g.S, g.oy + n[1] * g.S, '+' + v, '#34d399'); g.burst(g.ox + n[0] * g.S + 9, g.oy + n[1] * g.S + 9, '#f472b6', 14); g.sfx('coin'); g.eaten++; if (g.eaten % 5 === 0) { g.lv++; g.mark('w', g.lv); g.sfx('power'); } food(g); if (!g.gold && g.rnd() < 0.25) { g.gold = { p: free(g), t: 6 }; } }
    if (g.gold && n[0] === g.gold.p[0] && n[1] === g.gold.p[1]) { g.add(50, 'g'); grow = true; g.float(g.ox + n[0] * g.S, g.oy + n[1] * g.S, '+50', '#fbbf24', 22); g.burst(g.ox + n[0] * g.S + 9, g.oy + n[1] * g.S + 9, '#fbbf24', 24); g.sfx('power'); g.gold = null; }
    if (!grow) g.sn.pop(); if (g.gold && (g.gold.t -= iv) <= 0) g.gold = null;
    g.hud = 'SPEED ' + g.lv + '  LENGTH ' + g.sn.length;
  },
  draw(g, c) {
    c.fillStyle = '#0a1030'; c.fillRect(g.ox, g.oy, g.N * g.S, g.N * g.S); Kit.bgGrid(c, g.W, g.H, 0, 'rgba(99,102,241,.06)'); c.strokeStyle = '#6366f1'; c.lineWidth = 2; c.strokeRect(g.ox, g.oy, g.N * g.S, g.N * g.S);
    const S = g.S; Kit.glow(c, '#f472b6', 14); Kit.circ(c, g.ox + g.f[0] * S + S / 2, g.oy + g.f[1] * S + S / 2, S / 2.6 + Math.sin(g.t * 8) * 1.2, '#f472b6'); if (g.gold) { Kit.glow(c, '#fbbf24', 16); Kit.circ(c, g.ox + g.gold.p[0] * S + S / 2, g.oy + g.gold.p[1] * S + S / 2, S / 2.2, '#fbbf24'); } Kit.noGlow(c);
    g.sn.forEach((s, i) => { const k = 1 - i / (g.sn.length + 4); c.fillStyle = `hsl(${150 + i * 3},80%,${40 + k * 25}%)`; Kit.rr(c, g.ox + s[0] * S + 1, g.oy + s[1] * S + 1, S - 2, S - 2, 5); c.fill(); });
    const h = g.sn[0]; Kit.circ(c, g.ox + h[0] * S + S / 2 + g.d[0] * 3 - g.d[1] * 4, g.oy + h[1] * S + S / 2 + g.d[1] * 3 - g.d[0] * 4, 2.5, '#fff'); Kit.circ(c, g.ox + h[0] * S + S / 2 + g.d[0] * 3 + g.d[1] * 4, g.oy + h[1] * S + S / 2 + g.d[1] * 3 + g.d[0] * 4, 2.5, '#fff');
  } });
function free(g) { for (;;) { const p = [g.RI(0, g.N - 1), g.RI(0, g.N - 1)]; if (!g.sn.some(s => s[0] === p[0] && s[1] === p[1])) return p; } }
function food(g) { g.f = free(g); }

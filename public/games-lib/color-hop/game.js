// Color Hop - original colour-gate tapper (Hub build). Pass only through your own colour.
Kit.run({ id: 'gl-color-hop', title: 'COLOR HOP', help: 'Tap / Space to hop upward\nPass through segments of YOUR colour only', bg: '#111827',
  init(g) { g.C = ['#f472b6', '#22d3ee', '#fde047', '#a855f7']; g.b = { y: 560, vy: 0, c: 0 }; g.cam = 0; g.obs = []; g.top = 400; for (let i = 0; i < 6; i++) add(g); g.started = false; },
  update(g, dt) {
    const b = g.b; if (g.tap()) { b.vy = -430; g.started = true; g.sfx('flap'); } if (g.started) b.vy += 1100 * dt; b.y += b.vy * dt; if (b.y - g.cam < 330) g.cam = b.y - 330; if (b.y - g.cam > g.H + 20) return g.end('Fell');
    while (g.top > g.cam - 300) add(g);
    for (const o of g.obs) { o.a += o.sp * dt; if (o.k === 'star') { if (!o.got && Math.abs(b.y - o.y) < 18) { o.got = true; g.add(1, 's'); g.sfx('coin'); g.float(g.W / 2, o.y - g.cam, '+1', '#fff'); } continue; } if (o.k === 'sw') { if (!o.got && Math.abs(b.y - o.y) < 14) { o.got = true; let n; do n = g.RI(0, 3); while (n === b.c); b.c = n; g.sfx('power'); } continue; }
      // ring: check the arc at the ball's position (top or bottom of ring)
      for (const yy of [o.y - o.r, o.y + o.r]) if (Math.abs(b.y - yy) < 10) { const ang = yy < o.y ? -Math.PI / 2 : Math.PI / 2; const rel = (((ang - o.a) % 6.283) + 6.283) % 6.283; const seg = Math.floor(rel / (6.283 / 4)); if (seg !== b.c) { g.burst(g.W / 2, b.y - g.cam, g.C, 50, 280); return g.end('Wrong colour'); } } }
    g.obs = g.obs.filter(o => o.y - g.cam < g.H + 200);
  },
  draw(g, c) {
    const cx = g.W / 2; for (const o of g.obs) { const y = o.y - g.cam; if (o.k === 'star') { if (!o.got) { c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = i * 0.628 - Math.PI / 2; c.lineTo(cx + Math.cos(a) * r, y + Math.sin(a) * r); } c.fill(); } continue; }
      if (o.k === 'sw') { if (!o.got) for (let i = 0; i < 4; i++) { c.fillStyle = g.C[i]; c.beginPath(); c.moveTo(cx, y); c.arc(cx, y, 12, i * 1.57, (i + 1) * 1.57); c.fill(); } continue; }
      c.lineWidth = 16; for (let i = 0; i < 4; i++) { c.strokeStyle = g.C[i]; c.beginPath(); c.arc(cx, y, o.r, o.a + i * 1.5708 + 0.02, o.a + (i + 1) * 1.5708 - 0.02); c.stroke(); } }
    Kit.glow(c, g.C[g.b.c], 14); Kit.circ(c, cx, g.b.y - g.cam, 11, g.C[g.b.c]); Kit.noGlow(c);
  } });
function add(g) { const lvl = Math.min(1, -g.top / 8000); g.obs.push({ k: 'ring', y: g.top, r: 85 - lvl * 15, a: g.R(0, 6.28), sp: (1.4 + lvl * 1.6) * (g.rnd() < 0.5 ? 1 : -1) }); g.obs.push({ k: 'star', y: g.top }); g.obs.push({ k: 'sw', y: g.top - 160 }); g.top -= 320; }

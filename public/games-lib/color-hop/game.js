// Color Hop - original colour-gate tapper (Hub build). Pass only through your own colour.
Kit.run({ fill: true, id: 'gl-color-hop', title: 'COLOR HOP', help: 'Tap / Space to hop upward\nPass through segments of YOUR colour only', bg: '#111827',
  init(g) { g.C = ['#f472b6', '#22d3ee', '#fde047', '#a855f7']; g.b = { y: 560, vy: 0, c: 0 }; g.cam = 0; g.obs = []; g.top = 400; for (let i = 0; i < 6; i++) add(g); g.started = false; g.trail = []; },
  update(g, dt) {
    const b = g.b; for (const p of g.trail) p.l -= dt; g.trail = g.trail.filter(p => p.l > 0); g.trail.push({ y: b.y, c: b.c, l: 0.4 }); if (g.tap()) { b.vy = -430; g.started = true; g.sfx('flap'); g.burst(g.W / 2, b.y - g.cam + 10, g.C[b.c], 6, 90, 0.3, 3); } if (g.started) b.vy += 1100 * dt; b.y += b.vy * dt; if (b.y - g.cam < 330) g.cam = b.y - 330; if (b.y - g.cam > g.H + 20) return g.end('Fell');
    while (g.top > g.cam - 300) add(g);
    for (const o of g.obs) { o.a += o.sp * dt; if (o.k === 'star') { if (!o.got && Math.abs(b.y - o.y) < 18) { o.got = true; g.add(1, 's'); g.sfx('coin'); g.float(g.W / 2, o.y - g.cam, '+1', '#fff'); } continue; } if (o.k === 'sw') { if (!o.got && Math.abs(b.y - o.y) < 14) { o.got = true; let n; do n = g.RI(0, 3); while (n === b.c); b.c = n; g.sfx('power'); g.burst(g.W / 2, o.y - g.cam, g.C, 24, 200); g.flash(g.C[b.c], 0.12); } continue; }
      // ring: check the arc at the ball's position (top or bottom of ring)
      for (const yy of [o.y - o.r, o.y + o.r]) if (Math.abs(b.y - yy) < 10) { const ang = yy < o.y ? -Math.PI / 2 : Math.PI / 2; const rel = (((ang - o.a) % 6.283) + 6.283) % 6.283; const seg = Math.floor(rel / (6.283 / 4)); if (seg !== b.c) { g.burst(g.W / 2, b.y - g.cam, g.C, 50, 280); return g.end('Wrong colour'); } } }
    g.obs = g.obs.filter(o => o.y - g.cam < g.H + 200);
  },
  draw(g, c) {
    const cx = g.W / 2, W = g.W, H = g.H, t = g.t, b = g.b, by = b.y - g.cam;
    // parallax backdrop: tinted gradient that shifts hue with height, drifting motes, depth rings
    const hh = Math.floor((-g.cam / 6) % 360 + 360) % 360; const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'hsl(' + hh + ',45%,12%)'); bg.addColorStop(1, 'hsl(' + (hh + 50) + ',50%,6%)'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 36; i++) { const z = 0.15 + (i % 4) * 0.12, x = (i * 97.7) % W, y = (((i * 61.3) - g.cam * z) % (H + 40) + H + 40) % (H + 40) - 20; c.globalAlpha = 0.25 + z * 0.4; c.fillStyle = g.C[i % 4]; c.beginPath(); c.arc(x, y, 1.5 + z * 3, 0, 6.283); c.fill(); } c.globalAlpha = 1;
    if (g.trail) for (const p of g.trail) { const a = p.l / 0.4; c.globalAlpha = a * 0.6; c.fillStyle = g.C[p.c]; c.beginPath(); c.arc(cx, p.y - g.cam, 9 * a + 2, 0, 6.283); c.fill(); } c.globalAlpha = 1;
    for (const o of g.obs) { const y = o.y - g.cam; if (y < -120 || y > H + 120) continue;
      if (o.k === 'star') { if (!o.got) { const p = 1 + Math.sin(t * 6 + o.y) * 0.18; c.save(); c.translate(cx, y); c.rotate(t * 1.5); c.scale(p, p); Kit.glow(c, '#fde047', 14); c.fillStyle = '#fff'; c.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 6 : 14, a = i * 0.628 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); Kit.noGlow(c); c.restore(); } continue; }
      if (o.k === 'sw') { if (!o.got) { c.save(); c.translate(cx, y); c.rotate(t * 2); Kit.glow(c, '#fff', 12); for (let i = 0; i < 4; i++) { c.fillStyle = g.C[i]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 14, i * 1.57, (i + 1) * 1.57); c.fill(); } Kit.noGlow(c); c.fillStyle = '#111827'; c.beginPath(); c.arc(0, 0, 4, 0, 6.283); c.fill(); c.restore(); } continue; }
      // ring: dark track + glossy coloured arcs with inner highlight
      c.lineCap = 'butt'; c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 24; c.beginPath(); c.arc(cx, y, o.r, 0, 6.283); c.stroke();
      for (let i = 0; i < 4; i++) { const a0 = o.a + i * 1.5708 + 0.03, a1 = o.a + (i + 1) * 1.5708 - 0.03; Kit.glow(c, g.C[i], 12); c.strokeStyle = g.C[i]; c.lineWidth = 18; c.beginPath(); c.arc(cx, y, o.r, a0, a1); c.stroke(); Kit.noGlow(c); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3; c.beginPath(); c.arc(cx, y, o.r - 5, a0 + 0.05, a1 - 0.05); c.stroke(); } }
    const sq = Math.min(0.3, Math.abs(b.vy) / 1800); Kit.glow(c, g.C[b.c], 18); c.fillStyle = g.C[b.c]; c.beginPath(); c.ellipse(cx, by, 11 * (1 - sq * 0.6), 11 * (1 + sq), 0, 0, 6.283); c.fill(); Kit.noGlow(c);
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(cx - 3.5, by - 4, 3, 0, 6.283); c.fill();
  } });
function add(g) { const lvl = Math.min(1, -g.top / 8000); g.obs.push({ k: 'ring', y: g.top, r: 85 - lvl * 15, a: g.R(0, 6.28), sp: (1.4 + lvl * 1.6) * (g.rnd() < 0.5 ? 1 : -1) }); g.obs.push({ k: 'star', y: g.top }); g.obs.push({ k: 'sw', y: g.top - 160 }); g.top -= 320; }

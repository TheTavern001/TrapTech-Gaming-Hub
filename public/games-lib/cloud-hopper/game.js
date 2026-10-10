// Cloud Hopper - original vertical bounce climber (Hub build)
Kit.run({ id: 'gl-cloud-hopper', title: 'CLOUD HOPPER', help: 'Tilt with arrows / hold left or right side\nBounce up - springs, movers and breakers', bg: '#0b1240',
  init(g) { g.p = { x: 200, y: 560, vx: 0, vy: -600 }; g.cam = 0; g.top = 0; g.pl = [{ x: 160, y: 620, w: 80, t: 0 }]; g.hi = 620; while (g.hi > -800) gen(g); g.en = []; },
  update(g, dt) {
    const p = g.p; let ax = g.ax(); if (g.ptr.down) ax = g.ptr.x < g.W / 2 ? -1 : 1; p.vx = Kit.lerp(p.vx, ax * 300, Math.min(1, dt * 10)); p.x += p.vx * dt; if (p.x < -15) p.x = g.W + 15; if (p.x > g.W + 15) p.x = -15;
    p.vy += 1100 * dt; const oy = p.y; p.y += p.vy * dt;
    if (p.vy > 0) for (const q of g.pl) if (!q.gone && p.x > q.x - 10 && p.x < q.x + q.w + 10 && oy + 14 <= q.y && p.y + 14 >= q.y) {
      if (q.t === 2) { q.gone = true; g.sfx('hit'); g.burst(q.x + q.w / 2, q.y, '#a16207', 16, 120); continue; }
      p.vy = q.spring ? -1250 : -640; g.sfx(q.spring ? 'power' : 'jump'); g.burst(p.x, q.y, q.spring ? '#fbbf24' : '#fff', 8, 90, 0.4); if (q.spring) g.shake(4); if (q.t === 3) q.gone = true; }
    if (g.ptr.pressed || g.tap()) {} // tilt game: no tap action
    for (const q of g.pl) if (q.t === 1) { q.x += q.d * 80 * dt; if (q.x < 0 || q.x + q.w > g.W) q.d *= -1; }
    const target = p.y - 300; if (target < g.cam) g.cam = target; const h = Math.floor(-g.cam / 10); if (h > g.top) { g.add(h - g.top, 'h'); g.top = h; }
    while (g.hi > g.cam - 100) gen(g); g.pl = g.pl.filter(q => q.y < g.cam + g.H + 50);
    for (const e of g.en) { e.x += Math.sin(g.t * 2 + e.ph) * 60 * dt; if (Math.hypot(e.x - p.x, e.y - p.y) < 26) { if (p.vy > 0 && p.y < e.y) { e.dead = true; p.vy = -800; g.add(50, 'e'); g.float(e.x, e.y - g.cam, '+50', '#f472b6'); g.burst(e.x, e.y - g.cam, '#f472b6', 20); g.sfx('pop'); } else { g.burst(p.x, p.y - g.cam, '#ef4444', 30); return g.end('Caught by a cloud monster'); } } }
    g.en = g.en.filter(e => !e.dead && e.y < g.cam + g.H + 50);
    if (p.y - g.cam > g.H + 40) g.end('Fell');
    g.hud = Math.floor(g.top) + ' m';
  },
  draw(g, c) {
    const gr = c.createLinearGradient(0, 0, 0, g.H); gr.addColorStop(0, '#1e1b6b'); gr.addColorStop(1, '#0b1240'); c.fillStyle = gr; c.fillRect(0, 0, g.W, g.H); Kit.bgGrid(c, g.W, g.H, -g.cam * 0.5);
    for (const q of g.pl) { if (q.gone) continue; const y = q.y - g.cam; c.fillStyle = ['#34d399', '#22d3ee', '#a16207', '#f8fafc'][q.t]; Kit.rr(c, q.x, y, q.w, 12, 6); c.fill(); if (q.spring) { c.fillStyle = '#fbbf24'; c.fillRect(q.x + q.w / 2 - 7, y - 8, 14, 8); } if (q.t === 2) { c.strokeStyle = '#000'; c.beginPath(); c.moveTo(q.x + q.w / 2, y); c.lineTo(q.x + q.w / 2 + 4, y + 12); c.stroke(); } }
    for (const e of g.en) { const y = e.y - g.cam; Kit.glow(c, '#f472b6', 10); Kit.circ(c, e.x, y, 16, '#be185d'); Kit.noGlow(c); Kit.circ(c, e.x - 5, y - 3, 4, '#fff'); Kit.circ(c, e.x + 5, y - 3, 4, '#fff'); }
    const p = g.p, y = p.y - g.cam; c.save(); c.translate(p.x, y); c.scale(p.vx < 0 ? -1 : 1, 1 + Kit.clamp(-p.vy / 4000, -0.15, 0.2)); Kit.glow(c, '#a855f7', 14); c.fillStyle = '#a855f7'; Kit.rr(c, -13, -14, 26, 28, 9); c.fill(); Kit.noGlow(c); Kit.circ(c, 5, -5, 5, '#fff'); Kit.circ(c, 7, -5, 2.5, '#111'); c.fillStyle = '#34d399'; c.fillRect(-13, 8, 26, 6); c.restore();
  } });
function gen(g) { const lvl = -g.hi / 1000; g.hi -= g.R(55, 70 + Math.min(70, lvl * 12)); const r = g.rnd(); const t = r < Math.min(0.25, lvl * 0.04) ? 1 : r < Math.min(0.4, 0.05 + lvl * 0.04) ? 2 : r < 0.48 ? 3 : 0; g.pl.push({ x: g.R(0, g.W - 70), y: g.hi, w: 70, t, d: 1, spring: t === 0 && g.rnd() < 0.08 }); if (t === 2) { g.pl.push({ x: g.R(0, g.W - 70), y: g.hi - 20, w: 70, t: 0, d: 1 }); } if (lvl > 1.5 && g.rnd() < 0.04 && g.en) g.en.push({ x: g.R(40, g.W - 40), y: g.hi - 40, ph: g.R(0, 6) }); }

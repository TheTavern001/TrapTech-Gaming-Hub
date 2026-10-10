// Trim Rush - original 60-second precision trimming (Hub build, cannabis theme). Swipe fan leaves off, never cut the bud.
Kit.run({ id: 'gl-trim-rush', title: 'TRIM RUSH', help: 'Swipe / drag across the green fan leaves to snip them\nDon\'t slice the bud! 60 seconds', bg: '#14532d',
  init(g) { g.time = 30; g.combo = 0; g.trail = []; nextBud(g); g.done = 0; },
  update(g, dt) {
    g.time -= dt * (1 + g.t / 120); if (g.time <= 0) { g.time = 0; return g.end('Out of time'); }
    const P = g.ptr; if (P.down) { g.trail.push({ x: P.x, y: P.y, l: 0.18 }); if (g.prev) cut(g, g.prev.x, g.prev.y, P.x, P.y); g.prev = { x: P.x, y: P.y }; } else g.prev = null;
    if (g.kd(' ')) { const L = g.leaves.find(l => !l.cut); if (L) { const ex = 200 + Math.cos(L.a) * (L.len + 20), ey = 330 + Math.sin(L.a) * (L.len + 20); const mx = 200 + Math.cos(L.a) * L.len * 0.5, my = 330 + Math.sin(L.a) * L.len * 0.5; cut(g, mx - Math.sin(L.a) * 30, my + Math.cos(L.a) * 30, mx + Math.sin(L.a) * 30, my - Math.cos(L.a) * 30); } }
    for (const t of g.trail) t.l -= dt; g.trail = g.trail.filter(t => t.l > 0); for (const l of g.leaves) if (l.cut) { l.vy += 900 * dt; l.y += l.vy * dt; l.x += l.vx * dt; l.r += l.vr * dt; }
    if (g.leaves.every(l => l.cut) && !g.next) { g.next = 0.5; g.done++; const b = 30 + Math.round(g.combo * 2); g.add(b, 'c'); g.time = Math.min(30, g.time + 3); g.float(200, 200, 'CLEAN TRIM +' + b, '#fbbf24', 22); g.sfx('line'); } if (g.next && (g.next -= dt) <= 0) { g.next = 0; nextBud(g); }
    g.rot += dt * g.spin; g.hud = Math.ceil(g.time) + 's  BUDS ' + g.done;
  },
  draw(g, c) {
    c.fillStyle = '#0f172a'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#1e293b'; Kit.rr(c, 30, 120, 340, 440, 30); c.fill();
    for (const l of g.leaves) { c.save(); if (l.cut) { c.translate(l.x, l.y); c.rotate(l.r); } else { c.translate(200, 330); c.rotate(l.a + g.rot); } c.fillStyle = l.cut ? '#4d7c0f' : '#22c55e'; for (let f = -3; f <= 3; f++) { c.save(); c.rotate(f * 0.22); c.beginPath(); c.ellipse(l.len * 0.55, 0, l.len * 0.5 * (1 - Math.abs(f) * 0.15), 6, 0, 0, 7); c.fill(); c.restore(); } c.strokeStyle = '#166534'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(l.len * 0.3, 0); c.stroke(); c.restore(); }
    c.save(); c.translate(200, 330); c.rotate(g.rot); for (let i = 0; i < 9; i++) { const a = i * 0.7; Kit.circ(c, Math.cos(a) * 18, Math.sin(a) * 24, 18, i % 2 ? '#86efac' : '#bbf7d0'); } for (let i = 0; i < 14; i++) Kit.circ(c, Math.cos(i * 2.4) * 22, Math.sin(i * 2.4) * 28, 2.5, i % 3 ? '#fb923c' : '#f5f5f4'); c.restore();
    c.strokeStyle = '#e5e7eb'; c.lineWidth = 3; c.beginPath(); g.trail.forEach((t, i) => c[i ? 'lineTo' : 'moveTo'](t.x, t.y)); c.stroke();
    c.fillStyle = '#1d2a66'; c.fillRect(20, 60, g.W - 40, 10); c.fillStyle = '#34d399'; c.fillRect(20, 60, (g.W - 40) * g.time / 30, 10);
  } });
function nextBud(g) { g.leaves = []; const n = 4 + Math.min(6, Math.floor(g.done / 2)); for (let i = 0; i < n; i++) g.leaves.push({ a: i / n * 6.283 + g.R(-0.2, 0.2), len: g.R(70, 110), cut: false }); g.rot = 0; g.spin = g.done > 3 ? g.R(-0.6, 0.6) : 0; }
function cut(g, x1, y1, x2, y2) { // segment vs bud circle -> penalty; segment crossing a leaf stem region -> snip
  const segD = (px, py) => { const L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 || 1; const t = Kit.clamp(((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / L2, 0, 1); return Math.hypot(x1 + (x2 - x1) * t - px, y1 + (y2 - y1) * t - py); };
  if (segD(200, 330) < 30) { if (!g.budHit || g.t - g.budHit > 0.5) { g.budHit = g.t; g.time = Math.max(0, g.time - 3); g.combo = 0; g.sfx('bad'); g.shake(8); g.flash('#ef4444', 0.1); g.float(200, 270, '-3s BUD!', '#ef4444', 20); } return; }
  for (const l of g.leaves) { if (l.cut) continue; const a = l.a + g.rot; const mx = 200 + Math.cos(a) * l.len * 0.45, my = 330 + Math.sin(a) * l.len * 0.45; if (segD(mx, my) < 16) { l.cut = true; l.x = mx; l.y = my; l.vx = g.R(-120, 120); l.vy = g.R(-250, -80); l.r = a; l.vr = g.R(-6, 6); g.combo++; const v = 10 + Math.min(20, g.combo); g.add(v, 'l'); g.time = Math.min(30, g.time + 0.25); g.sfx('whoosh'); g.burst(mx, my, '#4ade80', 8, 140); } } }

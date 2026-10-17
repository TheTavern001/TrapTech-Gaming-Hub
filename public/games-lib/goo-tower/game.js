// Goo Tower - original goo-ball tower builder (Hub build, World of Goo-style). Matter.js (MIT) springy goo lattice. Code-drawn art. // @uses vendor/matter.min.js
(function () { const M = window.Matter, B = M.Bodies, C = M.Constraint, DT = 1 / 120, R = 13, REACH = 118, MINL = 48;
  const lerp = (a, b, t) => a + (b - a) * t;
  function addBall(g, x, y, fixed) { const b = B.circle(x, y, R, { density: 0.002, friction: 0.8, frictionAir: 0.02, restitution: 0.1, isStatic: !!fixed }); b.eyeT = g.R(0, 5); M.Composite.add(g.eng.world, b); return b; }
  function link(g, a, b) { const L = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y); const c = C.create({ bodyA: a, bodyB: b, length: L, stiffness: 0.35, damping: 0.08 }); M.Composite.add(g.eng.world, c); g.links.push(c); a.n = (a.n || 0) + 1; b.n = (b.n || 0) + 1; }
  function cands(g, x, y) { return g.nodes.map(n => [n, Math.hypot(n.position.x - x, n.position.y - y)]).filter(([, d]) => d < REACH && d > MINL * 0.6).sort((a, b) => a[1] - b[1]).slice(0, 2); }
  Kit.run({ id: 'gl-goo-tower', title: 'GOO TOWER', orient: 'p', help: 'Drag a goo ball near the tower and let go - it links to the 2 nearest balls\nBuild as high as you can. Wind gets stronger. Don\'t let it topple!', bg: '#1a1030', fill: true,
    init(g) { const eng = M.Engine.create({ gravity: { y: 1 }, constraintIterations: 4, positionIterations: 8 }); g.eng = eng; g.links = []; g.nodes = []; g.free = []; g.prev = new Map(); g.acc = 0; g.alpha = 1;
      const gy = g.H - 70; g.gy = gy; M.Composite.add(eng.world, B.rectangle(g.W / 2, gy + 40, g.W * 3, 80, { isStatic: true, friction: 1 }));
      const a = addBall(g, g.W / 2 - 50, gy - R, true), b = addBall(g, g.W / 2 + 50, gy - R, true), c = addBall(g, g.W / 2, gy - R - 80); g.nodes.push(a, b, c); link(g, a, b); link(g, a, c); link(g, b, c);
      g.best = 0; g.peak = 0; g.wind = 0; g.windT = 6; g.lost = 0; g.drag = null; g.spawnT = 0; g.camY = 0; g.camT = 0; g.placed = 0; g.kCursor = { x: g.W / 2, y: gy - 130 }; },
    update(g, dt) { const cy = g.camY;
      // spawn free goo crawling along the ground pile at the left
      g.spawnT -= dt; if (g.free.length < 4 && g.spawnT <= 0) { g.spawnT = 0.6; g.free.push({ x: 30 + g.free.length * 34, y: g.gy - R, t: g.R(0, 6) }); } g.free.forEach((f, i) => { f.t += dt; f.x = lerp(f.x, 30 + i * 32, dt * 4); f.y = Math.min(g.gy - R, g.camY + g.H - 110) - Math.abs(Math.sin(f.t * 5)) * 6; });
      const px = g.ptr.x, py = g.ptr.y + cy;
      if (g.ptr.pressed && !g.drag) { const i = g.free.findIndex(f => Math.hypot(f.x - px, f.y - py) < 34); if (i >= 0) g.drag = { x: px, y: py, from: i }; }
      if (g.drag) { g.drag.x = px; g.drag.y = py; if (!g.ptr.down) { if (g.ptr.released) { const cs = cands(g, px, py); if (cs.length >= 2) { g.free.splice(g.drag.from, 1); const b = addBall(g, px, py); g.nodes.push(b); for (const [n] of cs) link(g, b, n); g.placed++; g.sfx('pop'); } else g.sfx('click'); } g.drag = null; } }
      // Keyboard parity: arrows/WASD move a visible cursor; Space/Enter places only
      // at that chosen point. Never auto-solve the next optimal tower link.
      const kx = Number(!!(g.keys.ArrowRight || g.keys.d)) - Number(!!(g.keys.ArrowLeft || g.keys.a));
      const ky = Number(!!(g.keys.ArrowDown || g.keys.s)) - Number(!!(g.keys.ArrowUp || g.keys.w));
      g.kCursor.x = Math.max(R, Math.min(g.W - R, g.kCursor.x + kx * dt * 230));
      g.kCursor.y = Math.max(g.camY + 30, Math.min(g.gy - R - 15, g.kCursor.y + ky * dt * 230));
      if (kx || ky || g.kd(' ') || g.kd('Enter')) g.kCursor.used = true;
      if (g.kd(' ') || g.kd('Enter')) {
        const tx = g.kCursor.x, ty = g.kCursor.y, cs = cands(g, tx, ty);
        if (cs.length >= 2 && g.free.length) {
          g.free.shift(); const b = addBall(g, tx, ty); g.nodes.push(b);
          for (const [n] of cs) link(g, b, n);
          g.placed++; g.sfx('pop');
        } else g.sfx('click');
      }
      g.windT -= dt; if (g.windT <= 0) { g.windT = g.R(4, 8); g.windTgt = (g.rnd() < 0.5 ? -1 : 1) * Math.min(1, 0.15 + g.peak / 2000); } g.wind = lerp(g.wind, g.windTgt || 0, dt * 0.8);
      g.acc += Math.min(dt, 0.1); for (const n of g.nodes) g.prev.set(n, { x: n.position.x, y: n.position.y });
      while (g.acc >= DT) { g.acc -= DT; for (const n of g.nodes) if (!n.isStatic) M.Body.applyForce(n, n.position, { x: g.wind * 0.00035 * Math.max(0, (g.gy - n.position.y) / 400), y: 0 }); M.Engine.update(g.eng, DT * 1000); }
      g.alpha = g.acc / DT;
      // over-stretched links snap
      for (let i = g.links.length - 1; i >= 0; i--) { const l = g.links[i]; const d = Math.hypot(l.bodyA.position.x - l.bodyB.position.x, l.bodyA.position.y - l.bodyB.position.y); if (d > l.length * 1.6) { M.Composite.remove(g.eng.world, l); g.links.splice(i, 1); g.sfx('hit'); g.shake(4, 0.15); } }
      const h = Math.max(0, Math.round((g.gy - R - Math.min(...g.nodes.map(n => n.position.y))) / 10)); if (h > g.peak) { g.add(h - g.peak, 'h'); g.peak = h; if (h % 25 === 0) g.float(g.W / 2, 120, h + ' m!', '#9dff7a', 22); }
      if (g.peak > 20 && h < g.peak * 0.55) return g.end('Tower toppled');
      for (const n of g.nodes) if (n.position.x < -200 || n.position.x > g.W + 200 || n.position.y > g.gy + 200) { n.gone = true; } if (g.nodes.some(n => n.gone)) { for (const n of g.nodes) if (n.gone) { g.prev.delete(n); M.Composite.remove(g.eng.world, n); } g.nodes = g.nodes.filter(n => !n.gone); }
      g.camT = Math.min(0, (Math.min(...g.nodes.map(n => n.position.y)) - g.H * 0.35)); g.camY = lerp(g.camY, g.camT, Math.min(1, dt * 2)); g.hud = ''; },
    draw(g, c) { const W = g.W, H = g.H, cy = g.camY; const sky = c.createLinearGradient(0, 0, 0, H); const k = Math.min(1, -cy / 3000); sky.addColorStop(0, `rgb(${30 - k * 20},${20 + k * 0},${60 + k * 20})`); sky.addColorStop(1, '#e88a5a'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 40; i++) { const x = (i * 97) % W, y = ((i * 211 - cy * 0.2) % (H * 2) + H * 2) % (H * 2) - H * 0.5; c.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(g.t * 1.5 + i)); c.fillRect(x, y, 2, 2); } c.globalAlpha = 1;
      { const mx = W * 0.78, my = H * 0.2 - cy * 0.05, mg = c.createRadialGradient(mx, my, 6, mx, my, 70); mg.addColorStop(0, 'rgba(255,240,200,.95)'); mg.addColorStop(0.25, 'rgba(255,214,150,.35)'); mg.addColorStop(1, 'rgba(255,200,140,0)'); c.fillStyle = mg; c.fillRect(mx - 80, my - 80, 160, 160); c.fillStyle = '#fff3d6'; c.beginPath(); c.arc(mx, my, 16, 0, 7); c.fill(); c.fillStyle = 'rgba(210,170,120,.45)'; c.beginPath(); c.arc(mx - 4, my - 3, 4, 0, 7); c.arc(mx + 5, my + 4, 3, 0, 7); c.fill(); }
      const hill = (col, base, amp, f, par) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 10) c.lineTo(x, H - base - cy * par + Math.sin(x * f + par * 9) * amp + Math.sin(x * f * 2.7) * amp * 0.3); c.lineTo(W, H); c.fill(); };
      hill('#3a2250', 190, 34, 0.012, 0.18); hill('#2f1c44', 140, 28, 0.02, 0.3); hill('#2a1838', 100, 20, 0.03, 0.42);
      for (let i = 0; i < 14; i++) { const fx = ((i * 83 + Math.sin(g.t * 0.6 + i) * 22) % W + W) % W, fy = H * 0.45 + ((i * 131) % (H * 0.5)) + Math.sin(g.t * 0.9 + i * 2) * 14; c.globalAlpha = 0.35 + 0.55 * Math.abs(Math.sin(g.t * 2 + i)); c.fillStyle = '#d6ff8a'; c.beginPath(); c.arc(fx, fy, 2.2, 0, 7); c.fill(); c.globalAlpha = 0.18; c.beginPath(); c.arc(fx, fy, 6, 0, 7); c.fill(); } c.globalAlpha = 1;
      c.save(); c.translate(0, -cy);
      if (g.kCursor && g.kCursor.used) { c.save(); c.strokeStyle = '#f7dd7c'; c.lineWidth = 2; c.setLineDash([5, 3]); c.beginPath(); c.arc(g.kCursor.x, g.kCursor.y, 18, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.restore(); }
      // height markers
      c.font = 'bold 11px system-ui'; c.textAlign = 'left'; for (let m = 10; m < 2000; m += 10) { const y = g.gy - R - m * 10; if (y < cy - 20 || y > cy + H) continue; c.strokeStyle = 'rgba(255,255,255,.12)'; c.setLineDash([6, 8]); c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,255,255,.4)'; c.fillText(m + ' m', 6, y - 4); }
      { const y = g.gy - R - g.peak * 10; c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.moveTo(W - 70, y); c.lineTo(W, y); c.stroke(); c.fillStyle = '#ffd23f'; c.textAlign = 'right'; c.fillText('BEST ' + g.peak + ' m', W - 4, y - 5); }
      // ground: mossy hill with a tiny dispensary hut (21+)
      const gg = c.createLinearGradient(0, g.gy, 0, g.gy + 80); gg.addColorStop(0, '#3a2a4a'); gg.addColorStop(1, '#1a1024'); c.fillStyle = gg; c.fillRect(-10, g.gy, W + 20, 200); c.fillStyle = '#4a8a3a'; c.beginPath(); c.moveTo(-10, g.gy + 4); for (let x = 0; x <= W + 10; x += 12) c.lineTo(x, g.gy - 2 + Math.sin(x * 0.3) * 3); c.lineTo(W + 10, g.gy + 6); c.fill();
      c.fillStyle = '#2a1838'; c.fillRect(W - 92, g.gy - 46, 70, 46); c.fillStyle = '#3a2a4a'; c.beginPath(); c.moveTo(W - 98, g.gy - 46); c.lineTo(W - 57, g.gy - 70); c.lineTo(W - 16, g.gy - 46); c.fill(); c.fillStyle = '#9dff7a'; c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.fillText('\u2618 GOO CO.', W - 57, g.gy - 30); c.fillStyle = '#ffd23f'; c.font = 'bold 8px system-ui'; c.fillText('21+', W - 57, g.gy - 18);
      // links (goo strands)
      const pos = (n) => { const p = g.prev.get(n); return p ? [lerp(p.x, n.position.x, g.alpha), lerp(p.y, n.position.y, g.alpha)] : [n.position.x, n.position.y]; };
      for (const l of g.links) { const [ax, ay] = pos(l.bodyA), [bx, by] = pos(l.bodyB); const st = Math.min(1, Math.max(0, (Math.hypot(ax - bx, ay - by) / l.length - 1) * 3)); c.strokeStyle = `rgb(${30 + st * 200},${30},${40})`; c.lineWidth = 9 - st * 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.stroke(); }
      const goo = (x, y, t, s) => { const r = R * (s || 1); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(x + 2, y + r * 0.85, r * 0.9, r * 0.32, 0, 0, 7); c.fill(); const gr = c.createRadialGradient(x - r * 0.35, y - r * 0.4, 1, x, y, r * 1.1); gr.addColorStop(0, '#4a4658'); gr.addColorStop(0.55, '#1c1a26'); gr.addColorStop(1, '#0b0a12'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(160,255,140,.35)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r - 0.8, 0.2, 2.2); c.stroke(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.5, 4, 2.4, -0.6, 0, 7); c.fill(); const bl = Math.sin(t * 1.3) > 0.97; c.fillStyle = '#fff'; c.beginPath(); c.arc(x - 4, y - 1, 3.8, 0, 7); c.arc(x + 4, y - 1, 3.8, 0, 7); c.fill(); if (!bl) { c.fillStyle = '#111'; c.beginPath(); c.arc(x - 3.4 + Math.sin(t) * 0.9, y - 0.6, 1.8, 0, 7); c.arc(x + 4.6 + Math.sin(t) * 0.9, y - 0.6, 1.8, 0, 7); c.fill(); } c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.beginPath(); c.arc(x, y + 4, 3, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); };
      for (const n of g.nodes) { const [x, y] = pos(n); goo(x, y, g.t + n.eyeT); }
      if (g.camY < -40) { c.fillStyle = 'rgba(20,10,30,.6)'; Kit.rr(c, 8, g.camY + g.H - 140, 150, 58, 14); c.fill(); } g.free.forEach((f, i) => { if (g.drag && g.drag.from === i) return; goo(f.x, f.y, f.t); });
      if (g.drag) { const cs = cands(g, g.drag.x, g.drag.y); for (const [n] of cs) { c.strokeStyle = cs.length >= 2 ? 'rgba(157,255,122,.8)' : 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.setLineDash([6, 5]); c.beginPath(); c.moveTo(g.drag.x, g.drag.y); c.lineTo(n.position.x, n.position.y); c.stroke(); c.setLineDash([]); } goo(g.drag.x, g.drag.y, g.t * 3, 1.15); }
      c.restore();
      if (Math.abs(g.wind) > 0.05) { c.save(); c.globalAlpha = Math.min(0.8, Math.abs(g.wind)); c.strokeStyle = '#dfe8ff'; c.lineWidth = 2; for (let i = 0; i < 12; i++) { const y = (i * 67) % H, x = ((g.t * 300 * Math.sign(g.wind) + i * 113) % (W + 100) + W + 100) % (W + 100) - 50; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 30 * Math.sign(g.wind), y); c.stroke(); } c.restore(); g.txt((g.wind > 0 ? 'WIND \u2192' : '\u2190 WIND'), W / 2, 84, 13, '#dfe8ff'); } },
    hudDraw(g, c) { c.textAlign = 'left'; c.textBaseline = 'top'; c.font = 'bold 26px system-ui'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)'; const m = g.peak + ' m'; c.strokeText(m, 14, 30); c.fillStyle = '#fff'; c.fillText(m, 14, 30); } });
})();

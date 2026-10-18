// Skee Roll - original alley ball-roll into scoring rings (Hub build). 9 balls per game.
Kit.run({ fill: true, id: 'gl-skee-roll', title: 'SKEE ROLL', help: 'Swipe up to roll - aim with the swipe angle, power with its speed\nOr hold Space. 9 balls per frame: beat the target to keep playing', bg: '#7c2d12',
  init(g) { g.dy = (g.H - 800) / 2; g.balls = 9; g.ball = null; g.pow = 0; g.frame = 1; g.fs = 0; g.target = 150; },
  update(g, dt) {
    const P = g.ptr; if (!g.ball && g.balls > 0) { if (P.pressed) g.st = g.t; let go = null; if (P.released && P.sy - P.y > 30) { const T = Math.max(0.05, g.t - g.st); go = { vx: (P.x - P.sx) / T * 0.3, sp: Kit.clamp((P.sy - P.y) / T, 300, 1800) }; } if (g.keys[' ']) g.pow = Math.min(1, g.pow + dt * 0.8); else if (g.pow > 0) { go = { vx: g.ax() * 40, sp: 400 + g.pow * 1300 }; g.pow = 0; } if (go) { g.ball = { x: 200, y: 640, vx: go.vx, vy: -go.sp, air: 0 }; g.balls--; g.sfx('whoosh'); } }
    const b = g.ball; if (b) { b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < 70 || b.x > 330) { b.vx *= -0.6; b.x = Kit.clamp(b.x, 70, 330); g.sfx('click'); }
      if (b.y < 260 && !b.jumped) { b.jumped = true; g.sfx('jump'); } if (b.vy > -60 && b.y < 260) { const rings = [[200, 110, 20, 100], [130, 110, 18, 100], [270, 110, 18, 100], [200, 150, 26, 50], [200, 180, 40, 40], [200, 205, 60, 30], [200, 225, 80, 20], [200, 240, 110, 10]]; let v = 0; for (const [x, y, r, p] of rings) if (Math.hypot(b.x - x, (b.y - y) * 1.6) < r) { v = p; break; } g.add(v, 'r'); g.fs += v; g.float(b.x, b.y - 20 + g.dy, v ? '+' + v : 'GUTTER', v >= 50 ? '#fbbf24' : '#fff', 20); g.sfx(v >= 50 ? 'power' : v ? 'good' : 'bad'); if (v) g.burst(b.x, b.y + g.dy, '#fbbf24', v / 4); g.ball = null; if (g.balls <= 0) frameEnd(g); }
      else if (b.vy > 0 && b.y > 640) { g.ball = null; g.float(200, 500 + g.dy, 'TOO SOFT', '#ef4444'); g.sfx('bad'); if (g.balls <= 0) frameEnd(g); } }
    g.hud = 'FRAME ' + g.frame + '  ' + g.fs + '/' + g.target + '  BALLS ' + g.balls;
  },
  draw(g, c) {
    const W = g.W, H = g.H, t = g.t; const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1e1b4b'); bg.addColorStop(0.5, '#3b1d0b'); bg.addColorStop(1, '#1c0a03'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.save(); c.translate(0, g.dy);
    // arcade cabinet marquee with chasing lights
    c.fillStyle = '#0f0a2e'; Kit.rr(c, 50, 40, 300, 232, 14); c.fill(); c.strokeStyle = '#7c3aed'; c.lineWidth = 3; Kit.rr(c, 50, 40, 300, 232, 14); c.stroke();
    for (let k = 0; k < 20; k++) { const x = 62 + k * 14.4; const on = (Math.floor(t * 8) + k) % 3 === 0; c.fillStyle = on ? '#fde047' : '#78350f'; c.beginPath(); c.arc(x, 50, 3, 0, 7); c.fill(); }
    // lane: perspective wood with plank lines and side rails
    const ln = c.createLinearGradient(0, 260, 0, 690); ln.addColorStop(0, '#b45309'); ln.addColorStop(1, '#f59e0b'); c.fillStyle = ln; c.beginPath(); c.moveTo(70, 690); c.lineTo(330, 690); c.lineTo(300, 260); c.lineTo(100, 260); c.fill();
    c.strokeStyle = 'rgba(120,53,15,.55)'; c.lineWidth = 1.5; for (let k = 0; k <= 6; k++) { const f = k / 6; c.beginPath(); c.moveTo(100 + f * 200, 260); c.lineTo(70 + f * 260, 690); c.stroke(); }
    for (let y = 280; y < 690; y += 36) { c.strokeStyle = 'rgba(255,237,213,.18)'; c.beginPath(); c.moveTo(100 - (y - 260) * 0.07, y); c.lineTo(300 + (y - 260) * 0.07, y); c.stroke(); }
    c.fillStyle = '#3f1d0b'; c.beginPath(); c.moveTo(58, 690); c.lineTo(70, 690); c.lineTo(100, 260); c.lineTo(92, 260); c.fill(); c.beginPath(); c.moveTo(342, 690); c.lineTo(330, 690); c.lineTo(300, 260); c.lineTo(308, 260); c.fill();
    // ramp face + rings as glowing hoops
    const rings = [[200, 240, 110, 10], [200, 225, 80, 20], [200, 205, 60, 30], [200, 180, 40, 40], [200, 150, 26, 50], [130, 110, 18, 100], [270, 110, 18, 100], [200, 110, 20, 100]];
    const rg = c.createLinearGradient(0, 60, 0, 270); rg.addColorStop(0, '#1e1b4b'); rg.addColorStop(1, '#312e81'); c.fillStyle = rg; Kit.rr(c, 62, 62, 276, 200, 10); c.fill();
    for (const [x, y, r, p] of rings) { c.fillStyle = '#05010f'; c.beginPath(); c.ellipse(x, y, r, r / 1.6, 0, 0, 7); c.fill(); const hot = p >= 50; Kit.glow(c, hot ? '#fbbf24' : '#22d3ee', 12); c.strokeStyle = hot ? '#fbbf24' : '#22d3ee'; c.lineWidth = 3.5; c.stroke(); Kit.noGlow(c); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.ellipse(x, y - 1, r - 3, (r - 3) / 1.6, 0, 3.4, 6); c.stroke(); if (r < 40 || p === 10) g.txt(p, x, y - (p === 10 ? 50 : 0), 11, '#fff'); }
    const b = g.ball; const drawBall = (x, y, s) => { c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(x + s * 0.3, y + s * 0.9, s * 0.95, s * 0.35, 0, 0, 7); c.fill(); const gr = c.createRadialGradient(x - s * 0.35, y - s * 0.4, 1, x, y, s); gr.addColorStop(0, '#fff'); gr.addColorStop(0.5, '#e2e8f0'); gr.addColorStop(1, '#475569'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); };
    if (b) { const s = Math.max(5, 8 + (b.y - 100) / 540 * 9); for (let k = 3; k >= 1; k--) { c.globalAlpha = 0.14 * (4 - k); drawBall(b.x - b.vx * 0.012 * k, b.y - b.vy * 0.012 * k, s); } c.globalAlpha = 1; drawBall(b.x, b.y, s); } else if (g.balls > 0) drawBall(200, 640 + Math.sin(t * 3) * 2, 17);
    for (let k = 0; k < g.balls; k++) { c.fillStyle = '#e2e8f0'; c.beginPath(); c.arc(78 + k * 12, 710, 4.5, 0, 7); c.fill(); }
    if (g.pow > 0) { c.fillStyle = '#1d2a66'; Kit.rr(c, 350, 400, 14, 200, 7); c.fill(); const pg = c.createLinearGradient(0, 600, 0, 400); pg.addColorStop(0, '#34d399'); pg.addColorStop(1, '#ef4444'); c.fillStyle = pg; Kit.rr(c, 350, 600 - 200 * g.pow, 14, 200 * g.pow, 7); c.fill(); }
    c.restore();
  } });

function frameEnd(g) { if (g.fs < g.target) return g.end('Frame ' + g.frame + ': ' + g.fs + ' of ' + g.target); g.add(50 * g.frame, 'w'); g.float(200, 330 + g.dy, 'FRAME CLEARED +' + 50 * g.frame, '#fbbf24', 22); g.sfx('line'); g.frame++; g.mark('f', g.frame); g.fs = 0; g.balls = 9; g.target = Math.min(800, 150 + (g.frame - 1) * 40); }

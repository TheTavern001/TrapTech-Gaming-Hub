// Skee Roll - original alley ball-roll into scoring rings (Hub build). 9 balls per game.
Kit.run({ fill: true, id: 'gl-skee-roll', title: 'SKEE ROLL', help: 'Swipe up to roll - aim with the swipe angle, power with its speed\nOr hold Space. 9 balls per frame: beat the target to keep playing', bg: '#7c2d12',
  init(g) { g.balls = 9; g.ball = null; g.pow = 0; g.frame = 1; g.fs = 0; g.target = 150; },
  update(g, dt) {
    const P = g.ptr; if (!g.ball && g.balls > 0) { if (P.pressed) g.st = g.t; let go = null; if (P.released && P.sy - P.y > 30) { const T = Math.max(0.05, g.t - g.st); go = { vx: (P.x - P.sx) / T * 0.3, sp: Kit.clamp((P.sy - P.y) / T, 300, 1800) }; } if (g.keys[' ']) g.pow = Math.min(1, g.pow + dt * 0.8); else if (g.pow > 0) { go = { vx: g.ax() * 40, sp: 400 + g.pow * 1300 }; g.pow = 0; } if (go) { g.ball = { x: 200, y: 640, vx: go.vx, vy: -go.sp, air: 0 }; g.balls--; g.sfx('whoosh'); } }
    const b = g.ball; if (b) { b.vy += 520 * dt; b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < 70 || b.x > 330) { b.vx *= -0.6; b.x = Kit.clamp(b.x, 70, 330); g.sfx('click'); }
      if (b.y < 260 && !b.jumped) { b.jumped = true; g.sfx('jump'); } if (b.vy > -60 && b.y < 260) { const rings = [[200, 110, 20, 100], [130, 110, 18, 100], [270, 110, 18, 100], [200, 150, 26, 50], [200, 180, 40, 40], [200, 205, 60, 30], [200, 225, 80, 20], [200, 240, 110, 10]]; let v = 0; for (const [x, y, r, p] of rings) if (Math.hypot(b.x - x, (b.y - y) * 1.6) < r) { v = p; break; } g.add(v, 'r'); g.fs += v; g.float(b.x, b.y - 20, v ? '+' + v : 'GUTTER', v >= 50 ? '#fbbf24' : '#fff', 20); g.sfx(v >= 50 ? 'power' : v ? 'good' : 'bad'); if (v) g.burst(b.x, b.y, '#fbbf24', v / 4); g.ball = null; if (g.balls <= 0) frameEnd(g); }
      else if (b.vy > 0 && b.y > 640) { g.ball = null; g.float(200, 500, 'TOO SOFT', '#ef4444'); g.sfx('bad'); if (g.balls <= 0) frameEnd(g); } }
    g.hud = 'FRAME ' + g.frame + '  ' + g.fs + '/' + g.target + '  BALLS ' + g.balls;
  },
  draw(g, c) {
    c.fillStyle = '#451a03'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#d97706'; c.beginPath(); c.moveTo(70, 680); c.lineTo(330, 680); c.lineTo(300, 260); c.lineTo(100, 260); c.fill(); c.fillStyle = '#92400e'; for (let y = 300; y < 680; y += 40) c.fillRect(80, y, 240, 2);
    c.fillStyle = '#1e1b4b'; c.fillRect(60, 60, 280, 200); const rings = [[200, 240, 110, 10], [200, 225, 80, 20], [200, 205, 60, 30], [200, 180, 40, 40], [200, 150, 26, 50], [130, 110, 18, 100], [270, 110, 18, 100], [200, 110, 20, 100]];
    for (const [x, y, r, p] of rings) { c.fillStyle = '#0f172a'; c.beginPath(); c.ellipse(x, y, r, r / 1.6, 0, 0, 7); c.fill(); c.strokeStyle = p >= 50 ? '#fbbf24' : '#22d3ee'; c.lineWidth = 3; c.stroke(); if (r < 40 || p === 10) g.txt(p, x, y - (p === 10 ? 50 : 0), 11, '#fff'); }
    const b = g.ball; if (b) { const s = Math.max(4, 8 + (b.y - 100) / 540 * 8); Kit.circ(c, b.x, b.y, s, '#f8fafc'); } else if (g.balls > 0) Kit.circ(c, 200, 640, 16, '#f8fafc');
    if (g.pow > 0) { c.fillStyle = '#1d2a66'; c.fillRect(350, 400, 14, 200); c.fillStyle = '#fbbf24'; c.fillRect(350, 600 - 200 * g.pow, 14, 200 * g.pow); }
  } });

function frameEnd(g) { if (g.fs < g.target) return g.end('Frame ' + g.frame + ': ' + g.fs + ' of ' + g.target); g.add(50 * g.frame, 'w'); g.float(200, 330, 'FRAME CLEARED +' + 50 * g.frame, '#fbbf24', 22); g.sfx('line'); g.frame++; g.mark('f', g.frame); g.fs = 0; g.balls = 9; g.target = Math.min(800, 150 + (g.frame - 1) * 40); }

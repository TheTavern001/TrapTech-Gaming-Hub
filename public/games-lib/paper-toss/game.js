// Paper Toss - original flick-into-the-bin with wind (Hub build)
Kit.run({ id: 'gl-paper-toss', title: 'PAPER TOSS', help: 'Flick upward toward the bin (or Space)\nWatch the wind - 3 misses and you\'re done', bg: '#e5e7eb', partGrav: 300,
  init(g) { g.ball = null; g.misses = 0; g.made = 0; newWind(g); },
  update(g, dt) {
    const P = g.ptr; if (!g.ball) { let vx = null, vy; if (P.released) { const dx = P.x - P.sx, dy = P.y - P.sy; if (dy < -30) { vx = dx * 2.2; vy = dy * 2.6; } } if (g.kd(' ')) { vx = -g.wind * 1.2; vy = -560; } if (vx !== null) { g.ball = { x: 200, y: 600, z: 0, vx, vy: Math.max(-900, vy), t: 0 }; g.sfx('whoosh'); } return; }
    const b = g.ball; b.t += dt; b.vx += g.wind * dt; b.x += b.vx * dt; b.z = b.t; const sy = 600 + b.vy * b.t + 700 * b.t * b.t; b.y = sy; const scale = 1 - Math.min(0.6, b.t * 0.5);
    if (b.t > 0.4 && b.vy + 1400 * b.t > 0 && b.y > 300) { const inBin = Math.abs(b.x - 200) < 34 * 1 && b.y < 360; if (inBin || b.y > 380) { if (inBin) { g.made++; const v = 1 + Math.min(4, Math.floor(Math.abs(g.wind) / 30)); g.add(v, 's'); g.float(200, 240, '+' + v + (Math.abs(g.wind) > 60 ? ' WINDY!' : ''), '#16a34a', 22); g.sfx('good'); } else { g.misses++; g.sfx('bad'); g.float(b.x, 360, 'MISS', '#ef4444', 18); if (g.misses >= 3) { g.ball = null; return g.end('3 misses'); } } g.ball = null; newWind(g); } }
    g.hud = 'MADE ' + g.made + '  MISSES ' + g.misses + '/3';
  },
  draw(g, c) {
    c.fillStyle = '#cbd5e1'; c.fillRect(0, 0, g.W, 360); c.fillStyle = '#94a3b8'; c.fillRect(0, 360, g.W, g.H - 360); c.fillStyle = '#64748b'; c.fillRect(260, 120, 120, 90); c.fillStyle = '#bae6fd'; c.fillRect(266, 126, 108, 78);
    c.fillStyle = '#475569'; c.beginPath(); c.moveTo(166, 300); c.lineTo(234, 300); c.lineTo(226, 370); c.lineTo(174, 370); c.fill(); c.fillStyle = '#1e293b'; c.beginPath(); c.ellipse(200, 300, 34, 9, 0, 0, 7); c.fill();
    c.fillStyle = '#0f172a'; c.fillRect(140, 60, 120, 40); g.txt('WIND ' + (g.wind > 0 ? '\u2192 ' : '\u2190 ') + Math.abs(Math.round(g.wind / 10)), 200, 80, 14, '#22d3ee');
    const b = g.ball; if (b) { const s = Math.max(6, 18 - b.t * 14); Kit.circ(c, b.x, b.y, s, '#f8fafc'); c.strokeStyle = '#94a3b8'; c.beginPath(); c.arc(b.x, b.y, s, 0, 7); c.stroke(); } else { Kit.circ(c, 200, 600, 18, '#f8fafc'); c.strokeStyle = '#94a3b8'; c.beginPath(); c.arc(200, 600, 18, 0, 7); c.stroke(); }
  } });
function newWind(g) { const lv = Math.min(1, g.made / 25); g.wind = g.R(-1, 1) * (20 + lv * 120); }

// Paper Toss - original flick-into-the-bin with wind (Hub build)
Kit.run({ fill: true, id: 'gl-paper-toss', title: 'PAPER TOSS', help: 'Flick upward toward the bin (or Space)\nWatch the wind - 3 misses and you\'re done', bg: '#e5e7eb', partGrav: 300,
  init(g) { g.ball = null; g.misses = 0; g.made = 0; newWind(g); },
  update(g, dt) {
    const P = g.ptr; if (!g.ball) { let vx = null, vy; if (P.released) { const dx = P.x - P.sx, dy = P.y - P.sy; if (dy < -30) { vx = dx * 2.2; vy = dy * 2.6; } } if (g.kd(' ')) { vx = -g.wind * 1.2; vy = -560; } if (vx !== null) { g.ball = { x: 200, y: 600, z: 0, vx, vy: Math.max(-900, vy), t: 0 }; g.sfx('whoosh'); } return; }
    const b = g.ball; b.t += dt; b.vx += g.wind * dt; b.x += b.vx * dt; b.z = b.t; const sy = 600 + b.vy * b.t + 700 * b.t * b.t; b.y = sy; const scale = 1 - Math.min(0.6, b.t * 0.5);
    if (b.t > 0.4 && b.vy + 1400 * b.t > 0 && b.y > 300) { const inBin = Math.abs(b.x - 200) < 34 * 1 && b.y < 360; if (inBin || b.y > 380) { if (inBin) { g.made++; const v = 1 + Math.min(4, Math.floor(Math.abs(g.wind) / 30)); g.add(v, 's'); g.float(200, 240, '+' + v + (Math.abs(g.wind) > 60 ? ' WINDY!' : ''), '#16a34a', 22); g.sfx('good'); } else { g.misses++; g.sfx('bad'); g.float(b.x, 360, 'MISS', '#ef4444', 18); if (g.misses >= 3) { g.ball = null; return g.end('3 misses'); } } g.ball = null; newWind(g); } }
    g.hud = 'MADE ' + g.made + '  MISSES ' + g.misses + '/3';
  },
  draw(g, c) {
    const W = g.W, H = g.H, dy = (H - 800) / 2, t = g.t;
    // office: wall with wainscot, window with skyline, wood floor
    const wall = c.createLinearGradient(0, 0, 0, H * 0.5); wall.addColorStop(0, '#dbe4ee'); wall.addColorStop(1, '#b7c4d4'); c.fillStyle = wall; c.fillRect(0, 0, W, H);
    const fy = H * 0.5 + dy * 0.4 + 30; const fl = c.createLinearGradient(0, fy, 0, H); fl.addColorStop(0, '#a16b3f'); fl.addColorStop(1, '#5b3a1f'); c.fillStyle = fl; c.fillRect(0, fy, W, H - fy);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; for (let k = 0; k < 14; k++) { const yy = fy + k * k * 3 + 8; c.beginPath(); c.moveTo(0, yy); c.lineTo(W, yy); c.stroke(); } for (let k = -6; k <= 6; k++) { c.beginPath(); c.moveTo(W / 2 + k * 30, fy); c.lineTo(W / 2 + k * 90, H); c.stroke(); }
    c.fillStyle = '#7c8aa0'; c.fillRect(0, fy - 18, W, 18);
    c.save(); c.translate(0, dy);
    // window with skyline
    c.fillStyle = '#475569'; c.fillRect(254, 114, 132, 102); const sky = c.createLinearGradient(0, 120, 0, 210); sky.addColorStop(0, '#7dd3fc'); sky.addColorStop(1, '#fde68a'); c.fillStyle = sky; c.fillRect(260, 120, 120, 90);
    c.fillStyle = '#64748b'; for (let k = 0; k < 6; k++) c.fillRect(262 + k * 20, 175 - (k * 37 % 40), 16, 40 + (k * 37 % 40)); c.fillStyle = '#475569'; c.fillRect(318, 120, 4, 90); c.fillRect(260, 163, 120, 4);
    // shelf + plant
    c.fillStyle = '#6b4423'; c.fillRect(20, 190, 110, 8); c.fillStyle = '#9a3412'; c.beginPath(); c.moveTo(50, 190); c.lineTo(100, 190); c.lineTo(94, 150); c.lineTo(56, 150); c.fill(); c.fillStyle = '#16a34a'; for (let k = 0; k < 5; k++) { c.beginPath(); c.ellipse(75 + (k - 2) * 12, 140 - Math.abs(k - 2) * 4, 7, 22, (k - 2) * 0.3, 0, 7); c.fill(); }
    // wind flag
    const wdir = g.wind > 0 ? 1 : -1, wa = Math.min(1, Math.abs(g.wind) / 90); c.fillStyle = '#334155'; c.fillRect(196, 56, 8, 52); c.fillStyle = '#22d3ee'; c.beginPath(); c.moveTo(200, 60); for (let k = 0; k <= 8; k++) c.lineTo(200 + wdir * k * (6 + wa * 5), 60 + Math.sin(t * (6 + wa * 8) - k * 0.8) * (2 + wa * 5) * (k / 8)); for (let k = 8; k >= 0; k--) c.lineTo(200 + wdir * k * (6 + wa * 5), 80 + Math.sin(t * (6 + wa * 8) - k * 0.8) * (2 + wa * 5) * (k / 8)); c.fill();
    g.txt('WIND ' + (g.wind > 0 ? '\u2192 ' : '\u2190 ') + Math.abs(Math.round(g.wind / 10)), 200, 124, 14, '#0e7490');
    // bin: rim back, body with gradient and mesh, rim front
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(200, 374, 52, 9, 0, 0, 7); c.fill();
    const bg2 = c.createLinearGradient(166, 0, 234, 0); bg2.addColorStop(0, '#334155'); bg2.addColorStop(0.5, '#64748b'); bg2.addColorStop(1, '#334155'); c.fillStyle = bg2; c.beginPath(); c.moveTo(164, 300); c.lineTo(236, 300); c.lineTo(226, 370); c.lineTo(174, 370); c.fill();
    c.strokeStyle = 'rgba(15,23,42,.45)'; c.lineWidth = 1; for (let k = 0; k < 6; k++) { c.beginPath(); c.moveTo(168 + k * 13, 300); c.lineTo(176 + k * 9.5, 370); c.stroke(); } for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(166, 300 + k * 14); c.lineTo(234, 300 + k * 14); c.stroke(); }
    c.fillStyle = '#0f172a'; c.beginPath(); c.ellipse(200, 300, 36, 10, 0, 0, 7); c.fill();
    const b = g.ball; const drawBall = (x, y, s) => { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x + 2, y + s * 0.9, s * 0.9, s * 0.35, 0, 0, 7); c.fill(); const gr = c.createRadialGradient(x - s * 0.35, y - s * 0.35, 1, x, y, s); gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#cbd5e1'); c.fillStyle = gr; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); c.strokeStyle = 'rgba(100,116,139,.7)'; c.lineWidth = 1; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(x, y, s * (0.35 + k * 0.28), 0.6 + k, 2.4 + k); c.stroke(); } };
    if (b) { const s = Math.max(6, 18 - b.t * 14); for (let k = 3; k >= 1; k--) { c.globalAlpha = 0.12 * (4 - k); drawBall(b.x - b.vx * 0.012 * k, b.y - (b.vy + 1400 * b.t) * 0.012 * k, s); } c.globalAlpha = 1; drawBall(b.x, b.y, s); } else { drawBall(200, 600 + Math.sin(t * 3) * 3, 18); const P = g.ptr; if (P.down && P.sy - P.y > 20) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.setLineDash([6, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(200, 600); c.lineTo(200 + (P.x - P.sx) * 0.6, 600 + (P.y - P.sy) * 0.6); c.stroke(); c.setLineDash([]); } }
    // front rim over the ball when it drops in
    c.strokeStyle = '#94a3b8'; c.lineWidth = 3; c.beginPath(); c.ellipse(200, 300, 36, 10, 0, 0, Math.PI); c.stroke();
    c.restore();
  } });
function newWind(g) { const lv = Math.min(1, g.made / 25); g.wind = g.R(-1, 1) * (20 + lv * 120); }

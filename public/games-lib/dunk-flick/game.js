// Dunk Flick - original portrait drag-and-release hoop to hoop (Hub build v8). Swish = no rim = bonus streak. Endless, skill-only.
// Drag back from the ball and release. Fully code-drawn art (night street court, glass backboards, nets).
Kit.run({ id: 'gl-dunk-flick', title: 'DUNK FLICK', fill: true, help: 'Drag back from the ball and release to shoot\nSwishes (no rim) build a streak - miss once and it ends', bg: '#140f33', partGrav: 300,
  init(g) { g.hoops = [{ x: 110, y: 520, sw: 0 }, { x: 290, y: 380, sw: 0 }]; g.ball = { x: 110, y: 505, vx: 0, vy: 0, held: true, rot: 0 }; g.cam = 0; g.streak = 0; g.rim = false; g.trail = []; g.glow = 0; },
  update(g, dt) {
    const b = g.ball, P = g.ptr; const H0 = g.hoops[0], H1 = g.hoops[1]; for (const h of g.hoops) h.sw = Math.max(0, h.sw - dt); g.glow = Math.max(0, g.glow - dt);
    if (b.held) { b.x = H0.x; b.y = H0.y - 15; g.trail.length = 0; if (P.down) { g.aim = { dx: Kit.clamp(P.sx - P.x, -160, 160), dy: Kit.clamp(P.sy - P.y, -40, 200) }; } else if (!P.released) g.aim = null;
      if (P.released && g.aim && Math.hypot(g.aim.dx, g.aim.dy) > 20) { b.held = false; b.vx = g.aim.dx * 4.2; b.vy = -Math.abs(g.aim.dy) * 4.6 - 120; g.aim = null; g.rim = false; g.sfx('whoosh'); }
      g.cam = Kit.lerp(g.cam, H0.y - g.H * 0.62, dt * 4); return; }
    b.vy += 1100 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vx * dt / 13; g.trail.push({ x: b.x, y: b.y }); if (g.trail.length > 16) g.trail.shift();
    if (b.x < 12 || b.x > g.W - 12) { b.vx *= -0.8; b.x = Kit.clamp(b.x, 12, g.W - 12); g.sfx('click'); }
    for (const h of [H0, H1]) for (const rx of [h.x - 34, h.x + 34]) { const d = Math.hypot(b.x - rx, b.y - h.y); if (d < 15) { const nx = (b.x - rx) / d, ny = (b.y - h.y) / d; const vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.7 * vn * nx; b.vy -= 1.7 * vn * ny; } b.x = rx + nx * 15; b.y = h.y + ny * 15; g.rim = true; g.sfx('thud'); h.sw = 0.3; } }
    if (b.vy > 0 && Math.abs(b.x - H1.x) < 26 && b.y > H1.y && b.y < H1.y + 20) { g.streak = g.rim ? 0 : g.streak + 1; const v = 1 + (g.rim ? 0 : g.streak); g.add(v, 's'); g.float(H1.x, H1.y - g.cam - 90, g.rim ? '+1' : 'SWISH x' + g.streak + '  +' + v, g.rim ? '#fff' : '#fbbf24', 18); g.sfx(g.rim ? 'good' : 'power'); g.burst(H1.x, H1.y - g.cam, g.rim ? '#fff' : ['#f97316', '#fbbf24'], 22, 170); H1.sw = 0.8; if (!g.rim) g.glow = 0.6;
      const nx = g.R(70, 330), ny = H1.y - g.R(110, 190); g.hoops = [H1, { x: Math.abs(nx - H1.x) < 90 ? (H1.x < 200 ? 300 : 100) : nx, y: ny, sw: 0 }]; b.held = true; b.vx = b.vy = 0; }
    if (b.y - g.cam > g.H + 40) return g.end('Missed');
    g.cam = Kit.lerp(g.cam, H0.y - g.H * 0.62, dt * 4); g.hud = g.streak > 1 ? 'STREAK ' + g.streak : '';
  },
  draw(g, c) {
    const W = g.W, H = g.H, cam = g.cam, hs = n => { const s = Math.sin(n * 91.7 + 17.3) * 43758.5; return s - Math.floor(s); };
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0b0826'); bg.addColorStop(0.6, '#2a1257'); bg.addColorStop(1, '#5b1e6e'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { const x = hs(i) * W, y = ((hs(i + 5) * H * 1.4 - cam * 0.25) % (H * 1.2) + H * 1.2) % (H * 1.2) - 20, r = 18 + hs(i + 2) * 40; const gr = c.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, i % 2 ? 'rgba(255,170,90,.22)' : 'rgba(120,150,255,.2)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let k = 0; k < 2; k++) { const par = 0.1 + k * 0.12; c.fillStyle = k ? '#1a0e3b' : '#241250'; for (let i = 0; i < 9; i++) { const bw = 56 + hs(i + k * 9) * 40, x = i * 52 - 10, base = (H * 0.8 + cam * par) % 1000 + 40; const h = 120 + hs(i * 2 + k) * 180; c.fillRect(x, base - h + 400 * 0, bw, h + H); } }
    c.save(); c.translate(0, -cam); const drawHoop = (h, front) => { const x = h.x, y = h.y, sw = Math.sin(h.sw * 38) * Math.min(1, h.sw * 2.2) * 3;
      if (!front) { c.fillStyle = 'rgba(0,0,0,.35)'; Kit.rr(c, x - 44, y - 71, 88, 58, 6); c.fill(); const gg = c.createLinearGradient(x - 42, y - 70, x + 42, y - 14); gg.addColorStop(0, 'rgba(235,245,255,.95)'); gg.addColorStop(1, 'rgba(150,185,225,.9)'); c.fillStyle = gg; Kit.rr(c, x - 42, y - 72, 84, 58, 6); c.fill(); c.strokeStyle = '#f8fafc'; c.lineWidth = 3; Kit.rr(c, x - 42, y - 72, 84, 58, 6); c.stroke(); c.strokeStyle = '#ef4444'; c.lineWidth = 3; c.strokeRect(x - 16, y - 50, 32, 26); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x - 38, y - 68); c.lineTo(x - 14, y - 68); c.lineTo(x - 38, y - 40); c.fill();
        c.fillStyle = '#9ca3af'; c.fillRect(x - 6, y - 14, 12, 8);
        c.strokeStyle = '#f97316'; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, 34, 7, 0, Math.PI, 0); c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 1.6; c.beginPath(); for (let i = -4; i <= 4; i++) { c.moveTo(x + i * 8, y + 2); c.quadraticCurveTo(x + i * 5 + sw, y + 18, x + i * 4 + sw * 1.5, y + 34); } for (let j = 1; j < 4; j++) { const yy = y + j * 9, hw = 33 - j * 7; c.moveTo(x - hw + sw * j * 0.4, yy); c.quadraticCurveTo(x + sw * j * 0.4, yy + 5, x + hw + sw * j * 0.4, yy); } c.stroke(); }
      else { c.strokeStyle = '#fb923c'; c.lineWidth = 5; c.beginPath(); c.ellipse(x, y, 34, 7, 0, 0, Math.PI); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.5; c.beginPath(); c.ellipse(x, y - 1, 33, 6, 0, 0.2, Math.PI - 0.2); c.stroke(); } };
    for (const h of g.hoops) drawHoop(h, false);
    const b = g.ball; for (let i = 0; i < g.trail.length; i++) { c.globalAlpha = i / g.trail.length * 0.35; Kit.circ(c, g.trail[i].x, g.trail[i].y, 3 + i * 0.5, '#fb923c'); } c.globalAlpha = 1;
    if (g.glow > 0) { const gr = c.createRadialGradient(b.x, b.y, 4, b.x, b.y, 70); gr.addColorStop(0, 'rgba(251,191,36,' + g.glow + ')'); gr.addColorStop(1, 'rgba(251,191,36,0)'); c.fillStyle = gr; c.fillRect(b.x - 70, b.y - 70, 140, 140); }
    c.save(); c.translate(b.x, b.y); c.rotate(b.rot); const bg2 = c.createRadialGradient(-4, -5, 2, 0, 0, 14); bg2.addColorStop(0, '#fdba74'); bg2.addColorStop(0.6, '#f97316'); bg2.addColorStop(1, '#9a3412'); c.fillStyle = bg2; c.beginPath(); c.arc(0, 0, 13.5, 0, 7); c.fill(); c.strokeStyle = '#431407'; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-13.5, 0); c.lineTo(13.5, 0); c.moveTo(0, -13.5); c.lineTo(0, 13.5); c.arc(-15, 0, 11, -0.9, 0.9); c.moveTo(15 + 0, 0); c.arc(15, 0, 11, Math.PI - 0.9, Math.PI + 0.9); c.stroke(); c.restore();
    for (const h of g.hoops) drawHoop(h, true);
    if (b.held && g.aim) { let x = b.x, y = b.y, vx = g.aim.dx * 4.2, vy = -Math.abs(g.aim.dy) * 4.6 - 120; for (let i = 0; i < 16; i++) { x += vx * 0.04; vy += 1100 * 0.04; y += vy * 0.04; c.fillStyle = 'rgba(255,255,255,' + (0.8 - i * 0.045) + ')'; c.beginPath(); c.arc(x, y, 3.2 - i * 0.1, 0, 7); c.fill(); } }
    c.restore();
  } });

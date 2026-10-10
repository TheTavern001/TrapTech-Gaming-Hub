// Jet Blaster - original hold-to-fly jetpack runner (Hub build)
Kit.run({ id: 'gl-jet-blaster', title: 'JET BLASTER', orient: 'l', help: 'Hold to fly up, release to fall\nDodge zappers and missiles, grab coins', bg: '#1c222c',
  init(g) { g.p = { y: 300, vy: 0 }; g.sp = 260; g.d = 0; g.obs = []; g.coins = []; g.next = 1; g.lastM = 0; g.miss = []; g.mt = 6; },
  update(g, dt) {
    const p = g.p, up = g.held(); p.vy += (up ? -1500 : 1100) * dt; p.vy = Kit.clamp(p.vy, -420, 520); p.y += p.vy * dt; if (p.y < 40) { p.y = 40; p.vy = 0; } if (p.y > 395) { p.y = 395; p.vy = 0; }
    if (up && g.frames % 2) g.parts.push({ x: 134, y: p.y + 30, vx: g.R(-60, -20), vy: g.R(150, 260), l: 0.4, m: 0, c: g.pick(['#f97316', '#fbbf24', '#fff']), s: 4, gr: 0 });
    g.sp = Math.min(620, 260 + g.t * 5); const dx = g.sp * dt; g.d += dx; const m = Math.floor(g.d / 20); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    g.next -= dt; if (g.next <= 0) { g.next = g.R(0.9, 1.7) * 300 / g.sp * 1.6; const t = g.rnd(); if (t < 0.6) { const len = g.R(70, 160), y = g.R(60, 370), a = g.pick([0, Math.PI / 2, Math.PI / 4, -Math.PI / 4]); g.obs.push({ x: 860, y, len, a, rot: g.rnd() < 0.2 ? g.R(-2, 2) : 0 }); } else { const y0 = g.R(80, 340); for (let i = 0; i < 8; i++) for (let j = 0; j < 3; j++) g.coins.push({ x: 860 + i * 26, y: y0 + j * 24 + Math.sin(i) * 10 }); } }
    g.mt -= dt; if (g.mt <= 0) { g.mt = g.R(4, 8) - Math.min(3, g.t / 30); g.miss.push({ x: 900, y: p.y, warn: 1.2 }); }
    for (const o of g.obs) { o.x -= dx; o.a += o.rot * dt; const ex = Math.cos(o.a) * o.len / 2, ey = Math.sin(o.a) * o.len / 2; const ax = o.x - ex, ay = o.y - ey, bx = o.x + ex, by = o.y + ey; const t = Kit.clamp(((150 - ax) * (bx - ax) + (p.y - ay) * (by - ay)) / (o.len * o.len), 0, 1); if (Math.hypot(ax + (bx - ax) * t - 150, ay + (by - ay) * t - p.y) < 20) { g.burst(150, p.y, ['#facc15', '#fff'], 40, 260); g.sfx('boom'); g.flash('#facc15'); return g.end('Zapped'); } }
    for (const c of g.coins) { c.x -= dx; if (!c.got && Math.hypot(c.x - 150, c.y - p.y) < 22) { c.got = true; g.add(5, 'c'); g.sfx('coin'); } }
    for (const s of g.miss) { if (s.warn > 0) { s.warn -= dt; s.y = Kit.lerp(s.y, p.y, dt * 3); } else { s.x -= (g.sp + 380) * dt; if (Math.abs(s.x - 150) < 22 && Math.abs(s.y - p.y) < 16) { g.burst(150, p.y, ['#ef4444', '#fbbf24'], 40, 260); g.sfx('boom'); return g.end('Missile hit'); } } }
    g.obs = g.obs.filter(o => o.x > -120); g.coins = g.coins.filter(c => c.x > -20 && !c.got); g.miss = g.miss.filter(s => s.x > -40);
    g.hud = '';
  },
  draw(g, c) { const W = g.W, d = g.d;
    // far wall (parallax 0.25): panelled lab wall with windows into grow rooms
    c.drawImage(wallLayer(), -((d * 0.25) % 400), 0); c.drawImage(wallLayer(), 400 - ((d * 0.25) % 400), 0); c.drawImage(wallLayer(), 800 - ((d * 0.25) % 400), 0);
    // mid props (parallax 0.6): pipes and pillars
    for (let i = -1; i < 6; i++) { const x = i * 220 - ((d * 0.6) % 220); const pg = c.createLinearGradient(x, 0, x + 34, 0); pg.addColorStop(0, '#3a4252'); pg.addColorStop(0.4, '#6b7588'); pg.addColorStop(1, '#2a303c'); c.fillStyle = pg; c.fillRect(x, 22, 34, 396); c.fillStyle = '#20252f'; for (let y = 60; y < 410; y += 90) c.fillRect(x - 3, y, 40, 8); }
    // ceiling + floor
    const cg = c.createLinearGradient(0, 0, 0, 24); cg.addColorStop(0, '#2a2f3a'); cg.addColorStop(1, '#4a5262'); c.fillStyle = cg; c.fillRect(0, 0, W, 24); c.fillStyle = '#ffd23f'; for (let x = -((d) % 60); x < W; x += 60) { c.save(); c.globalAlpha = 0.85; c.fillRect(x, 20, 30, 4); c.restore(); }
    const fg = c.createLinearGradient(0, 416, 0, 450); fg.addColorStop(0, '#6a7384'); fg.addColorStop(0.15, '#454c5a'); fg.addColorStop(1, '#262a33'); c.fillStyle = fg; c.fillRect(0, 416, W, 34); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = -(d % 80); x < W; x += 80) { c.beginPath(); c.moveTo(x, 418); c.lineTo(x - 20, 450); c.stroke(); } c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(0, 416, W, 2);
    // coins
    for (const k of g.coins) { const s = Math.abs(Math.cos(g.t * 4 + k.x * 0.02)); if (CO.complete) c.drawImage(CO, k.x - 10 * s, k.y - 10, 20 * s + 0.5, 20); }
    // zappers
    for (const o of g.obs) { c.save(); c.translate(o.x, o.y); c.rotate(o.a); const L = o.len / 2; c.globalCompositeOperation = 'lighter';
      for (let pass = 0; pass < 3; pass++) { c.strokeStyle = pass === 0 ? 'rgba(255,220,60,.25)' : pass === 1 ? 'rgba(255,230,90,.8)' : '#fffbe0'; c.lineWidth = pass === 0 ? 18 : pass === 1 ? 5 : 2; c.beginPath(); c.moveTo(-L, 0); const n = 9; for (let k = 1; k < n; k++) c.lineTo(-L + k * o.len / n, (Math.random() - 0.5) * (pass ? 10 : 6)); c.lineTo(L, 0); c.stroke(); }
      c.globalCompositeOperation = 'source-over'; for (const sx of [-L, L]) { const eg = c.createRadialGradient(sx - 3, -3, 1, sx, 0, 13); eg.addColorStop(0, '#e8edf5'); eg.addColorStop(0.5, '#8a93a5'); eg.addColorStop(1, '#3a404c'); c.fillStyle = eg; c.beginPath(); c.arc(sx, 0, 13, 0, 7); c.fill(); c.strokeStyle = '#1e222a'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#ffe14a'; c.beginPath(); c.arc(sx, 0, 5, 0, 7); c.fill(); } c.restore(); }
    // missiles
    for (const s of g.miss) { if (s.warn > 0) { const bl = Math.sin(g.t * 25) > 0; c.save(); c.translate(W - 36, s.y); c.fillStyle = bl ? '#ff3b2f' : '#ffd23f'; c.beginPath(); c.moveTo(0, -16); c.lineTo(16, 12); c.lineTo(-16, 12); c.closePath(); c.fill(); c.strokeStyle = '#2a0a05'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#2a0a05'; c.font = 'bold 18px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('!', 0, 3); c.restore(); }
      else { for (let k = 0; k < 6; k++) { c.fillStyle = 'rgba(200,200,210,' + (0.35 - k * 0.05) + ')'; c.beginPath(); c.arc(s.x + 30 + k * 16, s.y + Math.sin(g.t * 20 + k) * 2, 6 + k * 2, 0, 7); c.fill(); }
        c.save(); c.translate(s.x, s.y); const mg = c.createLinearGradient(0, -7, 0, 7); mg.addColorStop(0, '#ff8a7a'); mg.addColorStop(0.5, '#d42a2a'); mg.addColorStop(1, '#7a0a0a'); c.fillStyle = mg; c.beginPath(); c.moveTo(-22, 0); c.quadraticCurveTo(-16, -7, -8, -7); c.lineTo(16, -7); c.lineTo(16, 7); c.lineTo(-8, 7); c.quadraticCurveTo(-16, 7, -22, 0); c.fill(); c.strokeStyle = '#3a0505'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#555'; c.beginPath(); c.moveTo(10, -7); c.lineTo(20, -13); c.lineTo(18, -7); c.moveTo(10, 7); c.lineTo(20, 13); c.lineTo(18, 7); c.fill(); c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(16, -4); c.lineTo(26 + Math.random() * 8, 0); c.lineTo(16, 4); c.fill(); c.restore(); } }
    // hero
    const p = g.p, gnd = p.y >= 394; c.save(); c.translate(150, p.y); c.rotate(gnd ? 0 : Kit.clamp(p.vy / 1500, -0.3, 0.3)); hero(c, g, gnd); c.restore();
    if (g.held() && g.state === 'play') { c.save(); c.globalCompositeOperation = 'lighter'; const fl = c.createRadialGradient(134, p.y + 22, 2, 134, p.y + 30, 26); fl.addColorStop(0, 'rgba(255,240,180,.9)'); fl.addColorStop(0.4, 'rgba(255,140,40,.6)'); fl.addColorStop(1, 'rgba(255,80,20,0)'); c.fillStyle = fl; c.beginPath(); c.ellipse(134, p.y + 34, 9, 22 + Math.random() * 6, 0, 0, 7); c.fill(); c.restore(); }
  },
  hudDraw(g, c) { c.textAlign = 'left'; c.textBaseline = 'top'; c.font = 'bold 26px system-ui'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.6)'; const m = Math.floor(g.d / 20) + 'm'; c.strokeText(m, 14, 30); c.fillStyle = '#fff'; c.fillText(m, 14, 30); c.font = 'bold 15px system-ui'; const s = 'SCORE ' + Math.floor(g.score) + '   BEST ' + Math.floor(g.best || 0); c.strokeText(s, 14, 62); c.fillStyle = '#ffd23f'; c.fillText(s, 14, 62); } });
const CO = new Image(); CO.src = 'img/coinGold.webp';
let WL = null; function wallLayer() { if (WL) return WL; const cv = document.createElement('canvas'); cv.width = 400; cv.height = 450; const c = cv.getContext('2d');
  const bg = c.createLinearGradient(0, 0, 0, 450); bg.addColorStop(0, '#2c3442'); bg.addColorStop(1, '#1c222c'); c.fillStyle = bg; c.fillRect(0, 0, 400, 450); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = 0; x <= 400; x += 100) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 450); c.stroke(); } for (let y = 60; y < 450; y += 120) { c.beginPath(); c.moveTo(0, y); c.lineTo(400, y); c.stroke(); }
  // grow-room window (21+ theme)
  c.save(); c.translate(40, 110); const wg = c.createLinearGradient(0, 0, 0, 170); wg.addColorStop(0, '#3a1a5a'); wg.addColorStop(1, '#1a3a2a'); c.fillStyle = wg; c.fillRect(0, 0, 220, 170); c.fillStyle = 'rgba(255,120,255,.5)'; c.fillRect(10, 8, 200, 6); const gl = c.createLinearGradient(0, 14, 0, 120); gl.addColorStop(0, 'rgba(255,140,255,.35)'); gl.addColorStop(1, 'rgba(255,140,255,0)'); c.fillStyle = gl; c.fillRect(0, 14, 220, 110);
  for (let k = 0; k < 5; k++) { const px = 22 + k * 44, py = 160; c.fillStyle = '#5a3a1e'; c.fillRect(px - 10, py - 14, 20, 14); c.fillStyle = '#3fae4a'; for (let i = -3; i <= 3; i++) { c.save(); c.translate(px, py - 14); c.rotate(i * 0.42); c.beginPath(); c.ellipse(0, -22 + Math.abs(i) * 4, 3.4, 22 - Math.abs(i) * 4, 0, 0, 7); c.fill(); c.restore(); } }
  c.strokeStyle = '#8a93a5'; c.lineWidth = 8; c.strokeRect(0, 0, 220, 170); c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(20, 0); c.lineTo(80, 0); c.lineTo(20, 170); c.lineTo(-40, 170); c.fill(); c.restore();
  c.fillStyle = '#123d24'; c.fillRect(280, 120, 100, 40); c.fillStyle = '#7dff9a'; c.font = 'bold 13px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('GROW LAB B', 330, 134); c.font = 'bold 10px sans-serif'; c.fillStyle = '#ffd23f'; c.fillText('STAFF 21+ ONLY', 330, 150);
  c.fillStyle = '#3a4252'; c.fillRect(290, 220, 80, 120); c.fillStyle = '#5fd36a'; for (let i = 0; i < 6; i++) c.fillRect(300 + (i % 3) * 22, 236 + Math.floor(i / 3) * 18, 12, 6); c.fillStyle = '#ff5a4a'; c.fillRect(300, 290, 12, 6);
  return (WL = cv); }
function hero(c, g, gnd) { const run = gnd ? Math.sin(g.t * 18) : 0; c.lineJoin = 'round'; const OL = '#1b1b22';
  // jetpack
  const jg = c.createLinearGradient(-26, 0, -10, 0); jg.addColorStop(0, '#5a6274'); jg.addColorStop(1, '#a7b0c2'); c.fillStyle = jg; c.strokeStyle = OL; c.lineWidth = 2; Kit.rr(c, -26, -16, 14, 30, 5); c.fill(); c.stroke(); c.fillStyle = '#2f9e4a'; c.fillRect(-24, -10, 10, 4); c.fillStyle = '#333'; Kit.rr(c, -24, 14, 10, 6, 2); c.fill();
  // legs
  for (const [s, k] of [[-1, run], [1, -run]]) { c.save(); c.translate(-2 + s * 3, 12); c.rotate(k * 0.6); c.fillStyle = '#2a3b5a'; Kit.rr(c, -3.5, 0, 7, 16, 3); c.fill(); c.stroke(); c.fillStyle = '#222'; Kit.rr(c, -4, 14, 10, 5, 2); c.fill(); c.restore(); }
  // body
  const bg = c.createLinearGradient(0, -16, 0, 14); bg.addColorStop(0, '#ff9a4a'); bg.addColorStop(1, '#d4500a'); c.fillStyle = bg; Kit.rr(c, -12, -16, 22, 30, 6); c.fill(); c.stroke(); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-9, -13, 4, 22);
  c.save(); c.translate(6, -8); c.rotate(gnd ? run * 0.5 : -0.8); c.fillStyle = '#d4500a'; Kit.rr(c, -3, 0, 7, 15, 3); c.fill(); c.stroke(); c.fillStyle = '#f1c9a0'; c.beginPath(); c.arc(0.5, 16, 3.5, 0, 7); c.fill(); c.restore();
  // head
  const hg = c.createRadialGradient(-2, -30, 2, 1, -26, 13); hg.addColorStop(0, '#ffe2c4'); hg.addColorStop(1, '#d9a57a'); c.fillStyle = hg; c.beginPath(); c.arc(1, -27, 11, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#4a2a14'; c.beginPath(); c.arc(1, -30, 11, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill();
  c.fillStyle = '#2f9e4a'; c.save(); c.translate(-2, -40); c.rotate(-0.4); c.beginPath(); c.ellipse(0, -4, 2.5, 6, 0, 0, 7); c.fill(); c.restore();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(6, -28, 3.4, 0, 7); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(7, -28, 1.7, 0, 7); c.fill(); c.strokeStyle = '#3a1a05'; c.lineWidth = 1.5; c.beginPath(); c.arc(6, -22, 3, 0.2, Math.PI - 0.6); c.stroke(); }

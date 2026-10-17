// Hoop Streak - original basketball shot challenge (Hub build, Sports). Swipe up from the ball: direction and swipe speed set the arc.
// Real rim and backboard bounces. Makes add time to the clock (swishes add more); the shooting spot moves after each make and,
// later, the hoop slides. Fire streak doubles points. Endless until the clock runs out.
(function () {
  const G = 1500, BR = 15;
  function spot(g) { const lv = g.makes; g.bx0 = g.R(50, 190); g.by0 = g.R(600, 660); g.hx = 300 + (lv > 6 ? 0 : 0); resetBall(g); }
  function resetBall(g) { g.b = { x: g.bx0, y: g.by0, vx: 0, vy: 0, live: false, t: 0, rim: false, scored: false, below: false }; }
  Kit.run({ fill: true, id: 'gl-hoop-streak', title: 'HOOP STREAK', help: 'Swipe up from the ball to shoot: aim and speed set the arc\nMakes add time, swishes add more; 3 in a row = FIRE (x2)\nEndless until the clock hits zero', bg: '#1a0f0a',
    init(g) { g.time = 30; g.makes = 0; g.sw = 0; g.streak = 0; g.shots = 0; g.hy = 330; g.hx = 300; g.ht = 0; g.fx = []; g.msg = ''; g.msgT = 0; g.net = 0; g.hud = ''; spot(g); },
    update(g, dt) { g.msgT -= dt; g.net = Math.max(0, g.net - dt * 3); for (const f of g.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 400 * dt; f.l -= dt; } g.fx = g.fx.filter(f => f.l > 0);
      g.time -= dt; if (g.time <= 0) { g.time = 0; return g.end('Time up'); }
      g.ht += dt; if (g.makes >= 6) g.hx = 300 + Math.sin(g.ht * (0.8 + Math.min(1, g.makes / 30))) * Math.min(60, (g.makes - 5) * 6);
      const b = g.b, P = g.ptr, rimL = g.hx - 40, rimR = g.hx + 34, rimY = g.hy, bbX = g.hx + 40;
      if (!b.live) { if (P.pressed && Math.hypot(P.x - b.x, P.y - b.y) < 90) g.drag = { x: P.x, y: P.y, t: g.t }; if (g.drag && P.released) { const dx = P.x - g.drag.x, dy = P.y - g.drag.y, dur = Math.max(0.06, g.t - g.drag.t);
          if (dy < -40) { const sp = Math.min(1500, Math.hypot(dx, dy) / dur * 0.9); const a = Math.atan2(dy, dx); b.vx = Math.cos(a) * sp * 0.75; b.vy = Math.sin(a) * sp * 1.15; b.live = true; g.shots++; g.sfx('whoosh'); } g.drag = null; } return; }
      const st = 1 / 240; for (let t = 0; t < dt; t += st) { b.vy += G * st; b.x += b.vx * st; b.y += b.vy * st; b.t += st;
        for (const [rx, ry] of [[rimL, rimY], [rimR, rimY]]) { const dx = b.x - rx, dy = b.y - ry, d = Math.hypot(dx, dy); if (d < BR + 1 && b.vy > 0) { const nx = dx / d, ny = dy / d, vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= 1.45 * vn * nx; b.vy -= 1.45 * vn * ny; b.vx *= 0.85; b.vy *= 0.85; } b.x = rx + nx * (BR + 1); b.y = ry + ny * (BR + 1); if (!b.rimT || b.t - b.rimT > 0.1) { g.sfx('tick'); b.rimT = b.t; } b.rim = true; } }
        if (b.x + BR > bbX && b.x < bbX + 10 && b.y > rimY - 110 && b.y < rimY + 10 && b.vx > 0) { b.x = bbX - BR; b.vx *= -0.6; b.rim = true; g.sfx('hit'); }
        if (!b.scored && b.vy > 0 && b.y > rimY && b.y - b.vy * st <= rimY && b.x > rimL + 2 && b.x < rimR - 2) { b.scored = true; make(g, !b.rim); } }
      if (b.y > g.H + 40 || b.x < -40 || b.x > g.W + 60 || b.t > 4) { if (!b.scored) { g.streak = 0; g.msg = 'MISS'; g.msgT = 0.8; g.sfx('bad'); resetBall(g); } else spot(g); } },
    draw(g, c) { if (!g.bgc) { const cv = document.createElement('canvas'); cv.width = g.W; cv.height = g.H; const k = cv.getContext('2d');
        let gr = k.createLinearGradient(0, 0, 0, 420); gr.addColorStop(0, '#0f0a1e'); gr.addColorStop(1, '#2b1d3a'); k.fillStyle = gr; k.fillRect(0, 0, 400, 420);
        for (let i = 0; i < 6; i++) { const x = 30 + i * 70; const lg = k.createRadialGradient(x, 30, 2, x, 30, 70); lg.addColorStop(0, 'rgba(255,240,210,.55)'); lg.addColorStop(1, 'rgba(255,240,210,0)'); k.fillStyle = lg; k.fillRect(x - 70, 0, 140, 110); }
        for (let row = 0; row < 12; row++) { const y = 130 + row * 22, sh = 0.1 + row * 0.03; k.fillStyle = 'rgba(15,10,30,.6)'; k.fillRect(0, y + 8, 400, 14); for (let x = (row % 2) * 8; x < 400; x += 16) { const h = (x * 7 + row * 13) % 5; k.globalAlpha = sh + 0.08; k.fillStyle = ['#7f1d1d', '#1e3a8a', '#14532d', '#713f12', '#4c1d95'][h]; k.beginPath(); k.roundRect(x - 6, y + 4, 12, 14, 4); k.fill(); k.fillStyle = ['#f1c27d', '#8d5524', '#c68642', '#e0ac69', '#ffdbac'][(h + row) % 5]; k.beginPath(); k.arc(x, y, 4.5, 0, 7); k.fill(); } } k.globalAlpha = 1;
        k.fillStyle = '#0c2a17'; k.fillRect(0, 395, 400, 26); k.font = 'bold 12px sans-serif'; k.textAlign = 'center'; ['\u2618 GREEN LEAF', 'GOLD BUD 21+', 'KUSH KINGS'].forEach((t, i) => { k.fillStyle = ['#86efac', '#fde047', '#f0abfc'][i]; k.fillText(t, 70 + i * 130, 413); });
        gr = k.createLinearGradient(0, 421, 0, g.H); gr.addColorStop(0, '#9a5b2a'); gr.addColorStop(1, '#d08b4c'); k.fillStyle = gr; k.fillRect(0, 421, 400, g.H - 421);
        for (let i = 0; i < 16; i++) { k.fillStyle = i % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.04)'; k.fillRect(i * 25, 421, 25, g.H - 421); }
        k.strokeStyle = 'rgba(255,255,255,.75)'; k.lineWidth = 3; k.beginPath(); k.ellipse(300, 470, 210, 34, 0, Math.PI * 0.5, Math.PI * 1.5); k.stroke(); k.beginPath(); k.moveTo(230, 445); k.lineTo(230, 495); k.stroke();
        k.fillStyle = 'rgba(255,255,255,.08)'; k.beginPath(); k.ellipse(200, 700, 260, 40, 0, 0, 7); k.fill(); { // v8 art: hanging jumbotron, wood plank grain, painted key + centre logo
          const k2 = cv.getContext('2d'); const jx = 120, jy = 56; k2.strokeStyle = '#555'; k2.lineWidth = 2; k2.beginPath(); k2.moveTo(jx + 10, 0); k2.lineTo(jx + 22, jy); k2.moveTo(jx + 150, 0); k2.lineTo(jx + 138, jy); k2.stroke();
          const jg = k2.createLinearGradient(0, jy, 0, jy + 62); jg.addColorStop(0, '#2b2f3a'); jg.addColorStop(1, '#0b0d14'); k2.fillStyle = jg; Kit.rr(k2, jx, jy, 160, 62, 8); k2.fill(); k2.strokeStyle = '#8b93a8'; k2.lineWidth = 2; k2.stroke(); k2.fillStyle = '#05070c'; Kit.rr(k2, jx + 6, jy + 6, 148, 50, 5); k2.fill();
          k2.fillStyle = '#ff9a2e'; k2.font = 'bold 22px monospace'; k2.textAlign = 'center'; k2.textBaseline = 'middle'; k2.fillText('HOME 00', jx + 80, jy + 22); k2.fillStyle = '#9dff7a'; k2.font = 'bold 11px monospace'; k2.fillText('\u2618 STREAK ARENA', jx + 80, jy + 44);
          for (let y = 430; y < g.H; y += 26) { k2.fillStyle = (y / 26) % 2 ? 'rgba(0,0,0,.05)' : 'rgba(255,230,170,.04)'; k2.fillRect(0, y, 400, 26); } k2.strokeStyle = 'rgba(80,40,10,.12)'; for (let y = 430; y < g.H; y += 26) { k2.beginPath(); k2.moveTo(0, y); k2.lineTo(400, y); k2.stroke(); }
          k2.fillStyle = 'rgba(120,30,40,.25)'; k2.beginPath(); k2.moveTo(120, 700); k2.lineTo(280, 700); k2.lineTo(310, 760); k2.lineTo(90, 760); k2.closePath(); k2.fill();
          k2.fillStyle = 'rgba(255,255,255,.2)'; k2.font = 'bold 26px system-ui'; k2.fillText('\u2618', 200, 560); }
        g.bgc = cv; }
      c.drawImage(g.bgc, 0, 0); const b = g.b, hx = g.hx, hy = g.hy;
      // stanchion + backboard
      const pg = c.createLinearGradient(hx + 52, 0, hx + 64, 0); pg.addColorStop(0, '#64748b'); pg.addColorStop(1, '#1e293b'); c.fillStyle = pg; c.fillRect(hx + 52, hy - 120, 12, 560); c.fillStyle = '#1e293b'; c.fillRect(hx + 36, 680, 44, 30); c.fillStyle = '#16a34a'; c.fillRect(hx + 36, 690, 44, 6); c.fillStyle = 'rgba(226,232,240,.35)'; c.fillRect(hx + 40, hy - 115, 10, 130); c.strokeStyle = '#f8fafc'; c.lineWidth = 2; c.strokeRect(hx + 40, hy - 115, 10, 130); c.strokeStyle = '#ef4444'; c.strokeRect(hx + 42, hy - 52, 6, 40);
      const ballD = () => { const r = BR, gr = c.createRadialGradient(b.x - 5, b.y - 6, 2, b.x, b.y, r); gr.addColorStop(0, '#fdba74'); gr.addColorStop(1, '#c2410c'); c.fillStyle = gr; c.beginPath(); c.arc(b.x, b.y, r, 0, 7); c.fill(); c.strokeStyle = '#431407'; c.lineWidth = 1.5; const a = b.t * 9; c.beginPath(); c.arc(b.x, b.y, r, a, a + Math.PI); c.stroke(); c.beginPath(); c.moveTo(b.x + Math.cos(a + 1.57) * r, b.y + Math.sin(a + 1.57) * r); c.lineTo(b.x - Math.cos(a + 1.57) * r, b.y - Math.sin(a + 1.57) * r); c.stroke();
        if (g.streak >= 3) { c.fillStyle = 'rgba(251,146,60,.35)'; c.beginPath(); c.arc(b.x, b.y, r + 6 + Math.sin(g.t * 20) * 2, 0, 7); c.fill(); } };
      if (!b.scored) ballD();
      // net (behind rim front)
      const sw = g.net; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; for (let i = 0; i <= 6; i++) { const x0 = hx - 40 + i * 74 / 6, x1 = hx - 22 + i * 40 / 6 + Math.sin(g.t * 20) * sw * 3; c.beginPath(); c.moveTo(x0, hy); c.lineTo(x1, hy + 44 + sw * 8); c.stroke(); } for (let j = 1; j <= 3; j++) { c.beginPath(); c.moveTo(hx - 34 + j * 4, hy + j * 13); c.lineTo(hx + 30 - j * 4, hy + j * 13); c.stroke(); }
      if (b.scored) ballD();
      c.strokeStyle = '#ea580c'; c.lineWidth = 4; c.beginPath(); c.ellipse(hx - 3, hy, 37, 5, 0, 0, 7); c.stroke(); c.fillStyle = '#9a3412'; c.fillRect(hx + 34, hy - 3, 8, 6);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(g.bx0, g.by0 + 22, 22, 6, 0, 0, 7); c.fill();
      if (!b.live) { c.setLineDash([5, 6]); c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 2; c.beginPath(); c.arc(b.x, b.y, 40, 0, 7); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(g.t * 5) * 0.3) + ')'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('\u2191 SWIPE UP FROM THE BALL', 200, g.H - 18); }
      for (const f of g.fx) { c.fillStyle = f.c + Math.min(1, f.l * 2) + ')'; c.beginPath(); c.arc(f.x, f.y, 3, 0, 7); c.fill(); }
      if (g.msgT > 0) { c.globalAlpha = Math.min(1, g.msgT * 2); c.fillStyle = g.msg === 'MISS' ? '#fca5a5' : '#fde047'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.strokeStyle = '#000'; c.lineWidth = 5; c.strokeText(g.msg, 200, 200); c.fillText(g.msg, 200, 200); c.globalAlpha = 1; } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = g.streak >= 3 ? '#fb923c' : '#fde68a'; c.fillText('MAKES ' + g.makes + '  \u00b7  SWISH ' + g.sw + (g.streak >= 3 ? '  \u00b7  \ud83d\udd25 FIRE x2' : ''), 14, 48);
      c.textAlign = 'right'; c.font = 'bold 26px sans-serif'; c.fillStyle = g.time < 6 ? '#f87171' : '#fff'; c.fillText(g.time.toFixed(1), g.W - 14, 36); } });
  function make(g, swish) { g.makes++; g.streak++; if (swish) g.sw++; const fire = g.streak >= 3; const dist = Math.hypot(g.hx - g.bx0, g.hy - g.by0); const pts = Math.round((dist > 260 ? 3 : 2) * 50 * (swish ? 1.5 : 1) * (fire ? 2 : 1));
    g.add(pts, 'make'); g.time += Math.max(1.2, (swish ? 4 : 3) - g.makes * 0.05); g.mark('m', g.makes); g.net = 1; g.msg = (swish ? 'SWISH! ' : '') + '+' + pts; g.msgT = 1; g.sfx(swish ? 'power' : 'coin'); g.shake(swish ? 4 : 2);
    for (let i = 0; i < 18; i++) g.fx.push({ x: g.hx, y: g.hy + 20, vx: g.R(-140, 140), vy: g.R(-260, -60), l: 0.7, c: fire ? 'rgba(251,146,60,' : 'rgba(253,224,71,' }); }
})();

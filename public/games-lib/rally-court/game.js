// Rally Court - original tennis rally game (Hub build, Sports; ref Tennis rally challenges). Drag or arrows to move along the baseline.
// The racket swings automatically when the ball reaches you: where it meets the racket aims the shot (hit it on your left side to
// go cross-court right). Sweet-spot hits fly faster. Win points by beating the rival; every return scores, rallies multiply. 3 lives.
(function () {
  const HW = 4.1, LEN = 23.8, NET = 11.9, KX = 512, D = 14, HOR = 40, G = 9.8;
  const P = (x, y, h) => { const s = KX / (y + D); return { x: 200 + x * s, y: HOR + 8645 / (y + D) - (h || 0) * s, s }; };
  function serve(g) { const b = g.b; b.x = g.ai.x; b.y = LEN + 0.5; b.h = 2.2; aiShot(g, 0.6); g.phase = 'play'; g.bounces = 0; g.rally = 0; }
  function launch(b, tx, ty, T) { for (let i = 0; i < 12; i++) { const vh = (0 - b.h + 0.5 * G * T * T) / T, tn = T * Math.abs((NET - b.y) / (ty - b.y)); if (b.h + vh * tn - 0.5 * G * tn * tn > 1.2) break; T += 0.06; }
    b.vx = (tx - b.x) / T; b.vy = (ty - b.y) / T; b.vh = (0 - b.h + 0.5 * G * T * T) / T; b.land = { x: tx, y: ty }; }
  function aiShot(g, ease) { const b = g.b, lv = Math.min(1, 0.2 + g.rally / 10 + g.pts / 20); const err = !ease && g.R(0, 1) < 0.05 + Math.min(0.06, g.rally * 0.005); const tx = err ? (g.R(0, 1) < 0.5 ? -1 : 1) * g.R(4.3, 5) : g.R(-1, 1) * (1.8 + lv * 2.2) * (ease || 1), ty = g.R(2, 6.5 - lv * 2);
    launch(b, tx, ty, (1.2 - lv * 0.45) * g.R(0.92, 1.08)); g.bounces = 0; g.side = 'me'; }
  Kit.run({ id: 'gl-rally-court', title: 'RALLY COURT', help: 'Drag or use arrows to move along the baseline\nThe racket swings by itself: where the ball meets it aims the shot\nKeep rallies going; beat the rival for big points. 3 lives', bg: '#0b1a33',
    init(g) { g.me = { x: 0, sw: 0, sd: 1 }; g.ai = { x: 0, sw: 0 }; g.b = { x: 0, y: 0, h: 0, vx: 0, vy: 0, vh: 0 }; g.lives = 3; g.pts = 0; g.rally = 0; g.long = 0; g.hits = 0; g.sweet = 0; g.msg = ''; g.msgT = 0; g.fx = []; g.trail = []; g.hud = ''; g.phase = 'wait'; g.wait = 1; },
    update(g, dt) { const me = g.me, ai = g.ai, b = g.b; g.msgT -= dt; me.sw = Math.max(0, me.sw - dt * 4); ai.sw = Math.max(0, ai.sw - dt * 4);
      for (const f of g.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.l -= dt; } g.fx = g.fx.filter(f => f.l > 0);
      let tx = me.x; if (g.ptr.down) tx = (g.ptr.x - 200) / (KX / D); if (g.kd('ArrowLeft') || g.kd('a')) tx = me.x - 9; if (g.kd('ArrowRight') || g.kd('d')) tx = me.x + 9;
      tx = Math.max(-6, Math.min(6, tx)); me.x += Math.max(-5.6 * dt, Math.min(5.6 * dt, tx - me.x));
      if (g.phase === 'wait') { g.wait -= dt; if (g.wait <= 0) serve(g); return; }
      const st = 1 / 120; for (let t = 0; t < dt - 1e-6; t += st) {
        b.x += b.vx * st; b.y += b.vy * st; b.h += b.vh * st; b.vh -= G * st;
        if (b.h < 0) { b.h = 0; b.vh = -b.vh * 0.68; b.vx *= 0.9; b.vy *= 0.88; g.bounces++; g.sfx('tick'); for (let i = 0; i < 5; i++) g.fx.push({ ...P(b.x, b.y, 0), vx: g.R(-30, 30), vy: g.R(-20, 0), l: 0.3 });
          if (g.bounces === 1) { const inY = g.side === 'me' ? (b.y > -0.05 && b.y < NET) : (b.y > NET && b.y < LEN + 0.05); if (Math.abs(b.x) > HW + 0.05 || !inY) return point(g, g.side === 'me' ? 'ai' : 'me', 'OUT'); }
          if (g.bounces >= 2) return point(g, g.side === 'me' ? 'me' : 'ai', g.side === 'me' ? 'MISSED' : 'WINNER!'); }
        if (Math.abs(b.y - NET) < 0.15 && b.h < 0.95 && Math.abs(b.x) < HW + 1) { return point(g, g.side === 'me' ? 'ai' : 'me', 'NET'); }
        if (g.side === 'me' && g.bounces === 1 && b.y < 0.6 && b.y > -2.5 && b.h < 2.6) { const off = (b.x - me.x) / 1.15; if (Math.abs(off) <= 1) {
            g.rally++; g.hits++; me.sw = 1; me.sd = off > 0 ? 1 : -1; const sweet = Math.abs(off) < 0.28 && b.h > 0.4 && b.h < 1.6; if (sweet) g.sweet++; g.mark('rally', g.rally);
            const lv = Math.min(1, g.rally / 14); const tgx = -off * 5.2 + g.R(-0.3, 0.3); launch(b, tgx, g.R(17, 22), (sweet ? 0.8 : 1.05) - lv * 0.15); g.side = 'ai'; g.bounces = 0; g.aiWait = 0.25;
            g.add(10 * Math.min(10, g.rally) * (sweet ? 2 : 1), 'ret'); g.sfx(sweet ? 'coin' : 'hit'); if (sweet) { g.shake(4); g.float(P(b.x, b.y, b.h).x, P(b.x, b.y, b.h).y - 20, 'SWEET!', '#fde047', 16); }
            const aiReach = Math.abs(b.land.x - ai.x) / (6.2 + 0.0 * lv) < ((sweet ? 0.8 : 1.05) - lv * 0.15) + 0.55; g.aiCan = aiReach; } }
        if (g.side === 'ai' && g.bounces === 1 && b.y > LEN - 1.5 && b.h < 2.6) { if (Math.abs(b.x - ai.x) < 1.15) { ai.sw = 1; g.sfx('hit'); aiShot(g); } } }
      // AI moves toward landing x of our shot, plus a bit
      const goal = g.side === 'ai' && g.b.vy > 0 ? g.b.x + g.b.vx * (LEN - 0.9 - g.b.y) / g.b.vy : 0; if (g.aiWait > 0) g.aiWait -= dt; const asp = g.aiWait > 0 ? 0 : 4.2 + Math.min(2.5, g.pts * 0.12); ai.x += Math.max(-asp * dt, Math.min(asp * dt, goal - ai.x));
      g.trail.push({ x: b.x, y: b.y, h: b.h }); if (g.trail.length > 8) g.trail.shift(); },
    draw(g, c) { if (!g.bgc) { const cv = document.createElement('canvas'); cv.width = g.W; cv.height = g.H; const k = cv.getContext('2d');
        let gr = k.createLinearGradient(0, 0, 0, 290); gr.addColorStop(0, '#1e3a5f'); gr.addColorStop(1, '#7fa7d1'); k.fillStyle = gr; k.fillRect(0, 0, 400, 290);
        k.fillStyle = '#20314f'; k.fillRect(0, 120, 400, 120); for (let i = 0; i < 520; i++) { k.fillStyle = ['#f1f5f9', '#fca5a5', '#93c5fd', '#fde68a', '#a7f3d0'][i % 5]; k.globalAlpha = 0.5; k.fillRect((i * 41) % 400, 125 + ((i * 29) % 108), 3, 4); } k.globalAlpha = 1;
        const ads = ['\u2618 GREEN LEAF', 'GOLD BUD 21+', 'HIGH TIDE CO.', 'KUSH KINGS']; for (let i = 0; i < 4; i++) { k.fillStyle = i % 2 ? '#14532d' : '#0f3d22'; k.fillRect(i * 100, 236, 100, 22); k.fillStyle = i % 2 ? '#fde047' : '#86efac'; k.font = 'bold 10px sans-serif'; k.textAlign = 'center'; k.fillText(ads[i], i * 100 + 50, 251); }
        k.fillStyle = '#2f6b45'; k.fillRect(0, 258, 400, g.H - 258);
        const poly = (pts, col) => { k.fillStyle = col; k.beginPath(); pts.forEach(([x, y], i) => { const p = P(x, y); i ? k.lineTo(p.x, p.y) : k.moveTo(p.x, p.y); }); k.fill(); };
        poly([[-6.5, -4], [6.5, -4], [6.5, LEN + 4], [-6.5, LEN + 4]], '#1d4f8a'); poly([[-HW, 0], [HW, 0], [HW, LEN], [-HW, LEN]], '#2563b0');
        for (let y = 0; y < LEN; y += 1.2) { const a = P(-HW, y), b2 = P(HW, y + 0.6); k.fillStyle = 'rgba(255,255,255,.025)'; k.fillRect(a.x, b2.y, b2.x - a.x, a.y - b2.y); }
        const ln = (x1, y1, x2, y2, w) => { const a = P(x1, y1), b2 = P(x2, y2); k.strokeStyle = '#f8fafc'; k.lineWidth = w || 2; k.beginPath(); k.moveTo(a.x, a.y); k.lineTo(b2.x, b2.y); k.stroke(); };
        ln(-HW, 0, HW, 0, 3); ln(-HW, LEN, HW, LEN); ln(-HW, 0, -HW, LEN); ln(HW, 0, HW, LEN); ln(-HW, 5.5, HW, 5.5); ln(-HW, LEN - 5.5, HW, LEN - 5.5); ln(0, 5.5, 0, LEN - 5.5); ln(0, 0, 0, 0.3); ln(0, LEN, 0, LEN - 0.3);
        const vg = k.createRadialGradient(200, 500, 220, 200, 500, 560); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); k.fillStyle = vg; k.fillRect(0, 0, 400, g.H); g.bgc = cv; }
      c.drawImage(g.bgc, 0, 0); const b = g.b;
      const player = (x, y, sw, sd, col, far) => { const p = P(x, y), s = p.s / 36; c.save(); c.translate(p.x, p.y); c.scale(s, s); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 22, 7, 0, 0, 7); c.fill();
        c.fillStyle = '#334155'; c.fillRect(-9, -40, 7, 40); c.fillRect(2, -40, 7, 40); c.fillStyle = col; c.beginPath(); c.roundRect(-14, -82, 28, 46, 7); c.fill(); c.fillStyle = '#f8fafc'; c.fillRect(-14, -46, 28, 8);
        c.fillStyle = '#c68642'; c.beginPath(); c.arc(0, -93, 11, 0, 7); c.fill(); c.fillStyle = col; c.fillRect(-12, -102, 24, 5);
        const a = (far ? Math.PI : 0) + sd * (0.4 - sw * 2.2); c.save(); c.translate(sd * 14, -70); c.rotate(a); c.strokeStyle = '#c68642'; c.lineWidth = 5; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 18); c.stroke(); c.strokeStyle = '#111'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 18); c.lineTo(0, 34); c.stroke();
        c.strokeStyle = '#facc15'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 46, 9, 13, 0, 0, 7); c.stroke(); c.restore(); c.restore(); };
      player(g.ai.x, LEN + 0.8, g.ai.sw, 1, '#dc2626', true);
      const net = (side) => { const a = P(-HW - 0.9, NET), bb = P(HW + 0.9, NET), ht = 0.95 * a.s; c.fillStyle = 'rgba(15,23,42,.55)'; c.fillRect(a.x, a.y - ht, bb.x - a.x, ht); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1; for (let x = a.x; x < bb.x; x += 5) { c.beginPath(); c.moveTo(x, a.y - ht); c.lineTo(x, a.y); c.stroke(); } c.fillStyle = '#f8fafc'; c.fillRect(a.x, a.y - ht - 2, bb.x - a.x, 3); c.fillStyle = '#94a3b8'; c.fillRect(a.x - 2, a.y - ht - 2, 4, ht + 2); c.fillRect(bb.x - 2, bb.y - ht - 2, 4, ht + 2); };
      const ballDraw = () => { if (g.phase !== 'play') return; const sh = P(b.x, b.y, 0), p = P(b.x, b.y, b.h), r = Math.max(2, p.s * 0.09); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(sh.x, sh.y, r, r * 0.4, 0, 0, 7); c.fill();
        g.trail.forEach((t, i) => { const q = P(t.x, t.y, t.h); c.fillStyle = 'rgba(217,249,157,' + i / 20 + ')'; c.beginPath(); c.arc(q.x, q.y, r * 0.8, 0, 7); c.fill(); });
        const bg = c.createRadialGradient(p.x - r / 3, p.y - r / 3, 0.5, p.x, p.y, r); bg.addColorStop(0, '#f7fee7'); bg.addColorStop(1, '#a3e635'); c.fillStyle = bg; c.beginPath(); c.arc(p.x, p.y, r, 0, 7); c.fill(); };
      if (b.y > NET) { ballDraw(); net(); } else { net(); ballDraw(); }
      player(g.me.x, -1, g.me.sw, g.me.sd, '#16a34a', false);
      for (const f of g.fx) { c.fillStyle = 'rgba(255,255,255,' + f.l * 2 + ')'; c.fillRect(f.x, f.y, 2, 2); }
      if (g.msgT > 0) { c.globalAlpha = Math.min(1, g.msgT * 2); c.textAlign = 'center'; c.font = 'bold 26px sans-serif'; c.strokeStyle = '#000'; c.lineWidth = 4; c.fillStyle = g.msgC; c.strokeText(g.msg, 200, 380); c.fillText(g.msg, 200, 380); c.globalAlpha = 1; } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = '#fde68a'; c.fillText('RALLY ' + g.rally + '  \u00b7  BEST ' + g.long + '  \u00b7  POINTS WON ' + g.pts, 14, 48);
      for (let i = 0; i < 3; i++) { c.fillStyle = i < g.lives ? '#a3e635' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(g.W - 18 - i * 18, 26, 6, 0, 7); c.fill(); } } });
  function point(g, loser, why) { g.long = Math.max(g.long, g.rally); g.mark('long', g.long); g.phase = 'wait'; g.wait = 1.3; g.msgT = 1.2; g.trail = [];
    if (loser === 'ai') { g.pts++; g.add(200 + 25 * g.rally, 'pt'); g.msg = why === 'WINNER!' ? 'WINNER!' : 'POINT - ' + why; g.msgC = '#a3e635'; g.sfx('power'); }
    else { g.lives--; g.msg = why; g.msgC = '#fca5a5'; g.sfx('bad'); g.shake(6); if (g.lives <= 0) g.end('Out of lives'); } }
})();

// Long Ball - original Home Run Derby-style batting game (Hub build, Sports). Pitches come in; tap to swing.
// Timing sets launch angle and exit speed, tap position (left/right of the ball) must line up for solid contact.
// Fastballs, change-ups and curves; pitch speed ramps. Non-homers and misses are outs; 10 outs ends the run.
(function () {
  const PX = 200, PY = 610, MY = 330; // plate & mound screen y
  const TYPES = [['FASTBALL', 1, 0], ['CHANGE-UP', 1.45, 0], ['CURVE', 1.2, 1], ['SLIDER', 1.05, -1]];
  function proj(z) { const s = 1 / (0.25 + z * 1.6); return { y: PY - (PY - MY) * (1 - (1 - z) * (1 - z)) * 0 - (PY - MY) * z, s }; }
  function newPitch(g) { g.n++; const lvl = Math.min(1, g.n / 30); const t = g.n < 3 ? 0 : g.RI(0, g.n < 6 ? 1 : 3); const [name, slow, brk] = TYPES[t];
    g.p = { name, z: 1, T: (1.05 - lvl * 0.35) * slow * g.R(0.95, 1.05), x0: PX + g.R(-30, 30), brk: brk * g.R(25, 50) * (0.5 + lvl), t: 0, wind: 0.9 }; g.phase = 'wind'; g.swing = -1; }
  function px(p, z) { const k = 1 - z; return p.x0 + p.brk * k * k; }
  Kit.run({ id: 'gl-long-ball', title: 'LONG BALL', help: 'Tap to swing as the pitch reaches the plate\nTap on the side the ball crosses for solid contact (Space swings centre)\nHomers score by distance; streaks multiply. 10 outs ends the run', bg: '#0b1a33',
    init(g) { g.n = 0; g.outs = 0; g.hr = 0; g.streak = 0; g.lng = 0; g.fly = null; g.msg = ''; g.msgT = 0; g.bat = 0; g.fx = []; g.hud = ''; newPitch(g); },
    update(g, dt) { g.msgT -= dt; g.bat = Math.max(0, g.bat - dt * 5); for (const f of g.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; f.l -= dt; } g.fx = g.fx.filter(f => f.l > 0);
      const p = g.p;
      if (g.phase === 'wind') { p.wind -= dt; if (p.wind <= 0) g.phase = 'pitch'; return; }
      if (g.phase === 'pitch') { p.t += dt; p.z = 1 - p.t / p.T; const tap = g.ptr.pressed || g.kd(' ');
        if (tap && g.swing < 0) { g.swing = p.t; g.bat = 1; g.sfx('jump'); const sx = g.ptr.pressed ? g.ptr.x : px(p, 0);
          const te = (p.t - p.T) / 0.14, xe = (sx - px(p, 0)) / 45; const q = 1 - Math.min(1, Math.hypot(te, xe * 0.8));
          if (q > 0.05) { const ang = 28 - te * 22, ev = 70 + q * 45; const dist = Math.round((170 + q * 300) * Math.sin(2 * Math.max(4, Math.min(62, ang)) * Math.PI / 180) / 0.83 + g.R(-8, 8));
            g.fly = { t: 0, dist, ang, dir: Math.max(-1, Math.min(1, te * 0.9 + xe * 0.3)), hr: dist >= 330 && Math.abs(te) < 0.9 }; g.phase = 'fly'; g.shake(q > 0.8 ? 7 : 3); g.sfx(q > 0.8 ? 'coin' : 'hit');
            for (let i = 0; i < 14; i++) g.fx.push({ x: px(p, 0), y: PY - 20, vx: g.R(-160, 160), vy: g.R(-260, -40), l: 0.5 }); return; } }
        if (p.z < -0.12) { g.outs++; g.streak = 0; g.msg = g.swing < 0 ? 'STRIKE' : 'SWING & MISS'; g.msgT = 1; g.sfx('bad'); if (g.outs >= 10) return g.end('10 outs'); g.phase = 'gap'; g.gap = 0.6; }
        return; }
      if (g.phase === 'fly') { const f = g.fly; f.t += dt; if (f.t > 1.6) { if (f.hr) { g.hr++; g.streak++; const m = Math.min(4, 1 + Math.floor(g.streak / 3)); g.add(f.dist * m, 'hr'); g.lng = Math.max(g.lng, f.dist); g.mark('long', g.lng); g.msg = 'HOME RUN ' + f.dist + ' FT' + (m > 1 ? ' x' + m : ''); g.sfx('power'); }
          else { g.outs++; g.streak = 0; g.msg = f.dist < 150 ? 'GROUNDER - OUT' : f.dist + ' FT - CAUGHT'; g.sfx('bad'); if (g.outs >= 10) return g.end('10 outs'); } g.msgT = 1.2; g.phase = 'gap'; g.gap = 0.7; } return; }
      if (g.phase === 'gap') { g.gap -= dt; if (g.gap <= 0) newPitch(g); } },
    draw(g, c) { if (!g.bgc) { const b = document.createElement('canvas'); b.width = g.W; b.height = g.H; const k = b.getContext('2d');
        let gr = k.createLinearGradient(0, 0, 0, 260); gr.addColorStop(0, '#0b1a3a'); gr.addColorStop(1, '#3b4f8a'); k.fillStyle = gr; k.fillRect(0, 0, g.W, 260);
        for (let i = 0; i < 4; i++) { const lx = 40 + i * 107; k.fillStyle = '#222'; k.fillRect(lx - 2, 40, 4, 120); const lg = k.createRadialGradient(lx, 40, 2, lx, 40, 60); lg.addColorStop(0, 'rgba(255,255,230,.9)'); lg.addColorStop(1, 'rgba(255,255,230,0)'); k.fillStyle = lg; k.fillRect(lx - 60, -20, 120, 120); k.fillStyle = '#fffbe0'; k.fillRect(lx - 14, 32, 28, 14); }
        k.fillStyle = '#1b2440'; k.beginPath(); k.moveTo(0, 150); k.quadraticCurveTo(200, 110, 400, 150); k.lineTo(400, 225); k.lineTo(0, 225); k.fill();
        for (let i = 0; i < 260; i++) { k.fillStyle = ['#e2e8f0', '#f87171', '#60a5fa', '#fde68a', '#94a3b8'][i % 5]; k.globalAlpha = 0.35; k.fillRect((i * 37) % 400, 150 + ((i * 53) % 70) - Math.abs(((i * 37) % 400) - 200) * -0.0 , 3, 3); } k.globalAlpha = 1;
        const ads = ['GREEN LEAF CO.', '\u2618 HIGH TIDE', 'GOLD BUD 21+', 'KUSH KINGS']; for (let i = 0; i < 4; i++) { k.fillStyle = i % 2 ? '#14532d' : '#1e3a2a'; k.fillRect(i * 100, 222, 100, 28); k.fillStyle = i % 2 ? '#fde047' : '#86efac'; k.font = 'bold 11px sans-serif'; k.textAlign = 'center'; k.fillText(ads[i], i * 100 + 50, 241); }
        k.fillStyle = '#facc15'; k.fillRect(0, 248, 400, 3);
        for (let y = 251; y < g.H; y += 22) { const t = (y - 251) / (g.H - 251); k.fillStyle = (Math.floor((y - 251) / 22) % 2) ? '#2f7d3a' : '#348a40'; k.fillRect(0, y, 400, 22); }
        for (let y = 251; y < g.H; y += 6) { k.fillStyle = 'rgba(0,0,0,' + (0.18 * (1 - (y - 251) / 500)) + ')'; k.fillRect(0, y, 400, 6); }
        k.fillStyle = '#b4794a'; k.beginPath(); k.moveTo(200, 640); k.quadraticCurveTo(-60, 420, 200, 300); k.quadraticCurveTo(460, 420, 200, 640); k.fill();
        k.fillStyle = '#3a8f46'; k.beginPath(); k.moveTo(200, 590); k.lineTo(95, 455); k.lineTo(200, 365); k.lineTo(305, 455); k.closePath(); k.fill();
        k.strokeStyle = 'rgba(255,255,255,.85)'; k.lineWidth = 2; k.beginPath(); k.moveTo(200, 620); k.lineTo(-40, 251 + 40); k.moveTo(200, 620); k.lineTo(440, 291); k.stroke();
        k.fillStyle = '#fff'; for (const [bx, by] of [[92, 455], [200, 362], [308, 455]]) { k.save(); k.translate(bx, by); k.scale(1, 0.5); k.rotate(0.785); k.fillRect(-6, -6, 12, 12); k.restore(); }
        k.fillStyle = '#b07a4a'; k.beginPath(); k.ellipse(200, 335, 46, 14, 0, 0, 7); k.fill(); k.fillStyle = '#fff'; k.fillRect(194, 333, 12, 3);
        const vg = k.createRadialGradient(200, 450, 200, 200, 450, 520); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.45)'); k.fillStyle = vg; k.fillRect(0, 0, 400, g.H);
        k.fillStyle = '#c08a58'; k.beginPath(); k.ellipse(200, 625, 120, 40, 0, 0, 7); k.fill(); k.fillStyle = '#fff'; k.beginPath(); k.moveTo(186, 612); k.lineTo(214, 612); k.lineTo(214, 620); k.lineTo(200, 628); k.lineTo(186, 620); k.fill();
        k.strokeStyle = 'rgba(255,255,255,.7)'; k.lineWidth = 2; k.strokeRect(150, 590, 26, 46); k.strokeRect(224, 590, 26, 46); g.bgc = b; }
      c.drawImage(g.bgc, 0, 0); const p = g.p;
      // pitcher
      const arm = g.phase === 'wind' ? Math.min(1, (0.9 - p.wind) / 0.9) : 1; c.fillStyle = '#e5e7eb'; c.fillRect(193, 300, 14, 26); c.fillStyle = '#7c2d12'; c.beginPath(); c.arc(200, 294, 6, 0, 7); c.fill(); c.fillStyle = '#166534'; c.fillRect(194, 287, 12, 4);
      c.strokeStyle = '#e5e7eb'; c.lineWidth = 4; c.beginPath(); c.moveTo(205, 304); c.lineTo(205 + Math.cos(-2.6 + arm * 3.2) * 13, 304 + Math.sin(-2.6 + arm * 3.2) * 13); c.stroke();
      // ball
      if (g.phase === 'pitch') { const z = Math.max(-0.12, p.z), y = MY + (PY - 18 - MY) * (1 - z), s = 2.5 + (1 - z) * 6; const x = px(p, z);
        c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(x, y + 18 * (1 - z) + 6, s, s * 0.35, 0, 0, 7); c.fill(); const bg = c.createRadialGradient(x - s / 3, y - s / 3, 1, x, y, s); bg.addColorStop(0, '#fff'); bg.addColorStop(1, '#cbd5e1'); c.fillStyle = bg; c.beginPath(); c.arc(x, y, s, 0, 7); c.fill(); c.strokeStyle = '#dc2626'; c.lineWidth = 1; c.beginPath(); c.arc(x - s * 0.5, y, s * 0.7, -0.9, 0.9); c.stroke(); }
      if (g.phase === 'fly') { const f = g.fly, k = Math.min(1, f.t / 1.4), d = f.dist * k; const yy = PY - 20 - (d / 420) * 400 - Math.sin(k * Math.PI) * f.ang * 3, xx = PX + f.dir * d * 0.45, s = Math.max(1.5, 7 - k * 5);
        c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 20; i++) { const kk = k * i / 20, dd = f.dist * kk; const Y = PY - 20 - (dd / 420) * 400 - Math.sin(kk * Math.PI) * f.ang * 3, X = PX + f.dir * dd * 0.45; i ? c.lineTo(X, Y) : c.moveTo(X, Y); } c.stroke();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(xx, yy, s, 0, 7); c.fill(); c.fillStyle = '#fde047'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText(Math.round(d) + ' FT', 200, 120); }
      // batter (lefty stance at right of plate)
      c.save(); c.translate(236, 560); c.fillStyle = '#1e293b'; c.fillRect(-10, 30, 8, 44); c.fillRect(4, 30, 8, 44); c.fillStyle = '#f8fafc'; c.beginPath(); c.roundRect(-14, -8, 28, 42, 6); c.fill(); c.fillStyle = '#15803d'; c.fillRect(-14, 6, 28, 6);
      c.fillStyle = '#a16207'; c.beginPath(); c.arc(0, -18, 10, 0, 7); c.fill(); c.fillStyle = '#15803d'; c.beginPath(); c.arc(0, -21, 11, Math.PI, 0); c.fill(); c.fillRect(-14, -22, 10, 4);
      const ba = g.bat > 0 ? -0.6 - (1 - g.bat) * 0 - g.bat * 2.6 + 2.6 * 0 : -0.6; c.rotate(g.bat > 0 ? -0.6 - (1 - g.bat) * 2.8 : -0.6 + 0 * ba); c.fillStyle = '#d6a96a'; c.beginPath(); c.moveTo(-4, 0); c.lineTo(-8, -62); c.lineTo(2, -62); c.lineTo(4, 0); c.fill(); c.restore();
      for (const f of g.fx) { c.fillStyle = 'rgba(255,240,180,' + f.l * 2 + ')'; c.fillRect(f.x, f.y, 3, 3); }
      if (g.msgT > 0) { c.globalAlpha = Math.min(1, g.msgT * 2); c.fillStyle = g.msg.startsWith('HOME') ? '#fde047' : '#fca5a5'; c.font = 'bold 24px sans-serif'; c.textAlign = 'center'; c.strokeStyle = '#000'; c.lineWidth = 4; c.strokeText(g.msg, 200, 420); c.fillText(g.msg, 200, 420); c.globalAlpha = 1; }
      if (g.phase === 'pitch' || g.phase === 'wind') { c.fillStyle = 'rgba(255,255,255,.75)'; c.font = 'bold 11px sans-serif'; c.textAlign = 'center'; c.fillText(p.name, 200, 270); } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = '#fde68a'; c.fillText('HR ' + g.hr + '  \u00b7  STREAK ' + g.streak + '  \u00b7  LONGEST ' + g.lng, 14, 48);
      for (let i = 0; i < 10; i++) { c.fillStyle = i < g.outs ? '#ef4444' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(g.W - 16 - i * 13, 26, 5, 0, 7); c.fill(); } } });
})();

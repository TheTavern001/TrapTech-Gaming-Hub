// Ice Snipe - original hockey shootout (Hub build, Sports; ref Hockey Shootout). You skate in on the goalie automatically.
// Drag left/right to stickhandle the puck (the goalie shadows it with a short lag), then swipe up to shoot: swipe direction aims,
// swipe speed lifts it. Pull the goalie one way and snipe the other. Wait too long and he poke-checks. 3 misses end the run.
(function () {
  const NW = 183, NH = 122, GZ = 1100;
  const proj = (x, y, z, cz) => { const d = z - cz + 260, s = 640 / d; return { x: 200 + x * s, y: 270 + (150 - y) * s, s }; };
  function reset(g) { g.cz = 0; g.p = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, live: false, done: false }; g.px = 0; g.gk = { x: 0, lag: [], dive: 0, dir: 0 }; g.res = null; g.sw = null; g.hist = []; }
  Kit.run({ id: 'gl-ice-snipe', title: 'ICE SNIPE', help: 'You skate in automatically. Drag left/right to stickhandle (arrows too)\nSwipe up to shoot: direction aims, speed lifts. Space shoots straight\nDeke the goalie, then shoot the other way. 3 misses end it', bg: '#0b1426',
    init(g) { g.goals = 0; g.miss = 0; g.streak = 0; g.lvl = 0; g.fx = []; reset(g); g.hud = ''; },
    update(g, dt) { const p = g.p, k = g.gk, P = g.ptr; for (const f of g.fx) { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 200 * dt; f.l -= dt; } g.fx = g.fx.filter(f => f.l > 0);
      if (g.res) { g.res.t -= dt; if (g.res.t <= 0) { if (g.miss >= 3) return g.end('Three misses'); reset(g); } }
      const spd = 330 + g.lvl * 12; if (!p.live && !g.res) { g.cz += spd * dt;
        let tx = g.px; if (P.down) { if (P.pressed) g.sw = { pts: [] }; } if (g.kd('ArrowLeft')) tx -= 260 * dt; if (g.kd('ArrowRight')) tx += 260 * dt;
        if (P.down && g.sw) { g.sw.pts.push([P.x, P.y, g.t]); const q = g.sw.pts; if (q.length > 1) { const a = q[q.length - 2]; if (Math.abs(P.y - g.sw.pts[0][1]) < 30) tx += (P.x - a[0]) * 1.4; } }
        g.px = Math.max(-85, Math.min(85, tx));
        let shoot = null; if (P.released && g.sw && g.sw.pts.length > 2) { const a = g.sw.pts[0], b = g.sw.pts[g.sw.pts.length - 1], dy = a[1] - b[1], dur = Math.max(0.04, b[2] - a[2]); if (dy > 45) shoot = { ax: (b[0] - a[0]) / dy, sp: Math.min(1.3, dy / dur / 1400) }; g.sw = null; }
        if (g.kd(' ') && !g.spc) shoot = { ax: 0, sp: 0.6 }; g.spc = g.kd(' ');
        if (shoot) { p.x = g.px; p.z = g.cz + 60; p.y = 2; const T = (GZ - p.z) / (2400 + shoot.sp * 600); p.vz = (GZ - p.z) / T; p.vx = (shoot.ax * 260 - p.x * 0.35) / T; p.vy = (shoot.sp * 125) / T + 0.5 * 980 * T; p.live = true; g.sfx('whoosh'); g.shake(3); g.shot = shoot; }
        if (g.cz > 860) { g.miss++; g.streak = 0; g.res = { t: 1.5, txt: 'POKE-CHECKED!', c: '#ff6b6b' }; g.sfx('bad'); k.dive = 1; k.dir = 0; } }
      // goalie shadows puck x with a reaction lag; covers angle (moves out as you approach)
      const lagT = Math.max(0.1, (p.live ? 0.17 : 0.3) - g.lvl * 0.01); g.hist.push([g.t, p.live ? p.x : g.px]); while (g.hist.length > 2 && g.hist[1][0] < g.t - lagT) g.hist.shift(); const seen = g.hist[0][1];
      const want = seen * (0.55 + Math.min(0.3, g.cz / 3000)); const gs = (p.live ? 760 : 300) + g.lvl * 15; if (!k.dive) k.x += Math.max(-gs * dt, Math.min(gs * dt, want - k.x));
      if (p.live && !p.done) { p.vy -= 980 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (p.y < 0) { p.y = 0; p.vy = 0; }
        if (p.z > GZ - 120 && !k.dive && g.R(0, 1) < dt * 14) { k.dive = 1; k.dir = Math.sign(p.x - k.x) || 1; k.diveY = p.y; }
        if (k.dive && k.dive < 2) { k.x += k.dir * 380 * dt; }
        if (p.z >= GZ) { p.done = true; p.z = GZ; const inNet = Math.abs(p.x) < NW / 2 - 5 && p.y < NH - 4; const post = !inNet && Math.abs(p.x) < NW / 2 + 6 && p.y < NH + 6;
          const dx = Math.abs(p.x - k.x), half = p.y < 35 ? 66 : p.y < 80 ? 46 : 56; const save = dx < half + Math.min(14, g.lvl) && p.y < 118;
          if (inNet && !save) { g.goals++; g.streak++; g.lvl++; g.mark('g', g.goals); const corner = Math.min(1, Math.abs(p.x) / (NW / 2) * 0.6 + p.y / NH * 0.4); const m = Math.min(4, 1 + Math.floor(g.streak / 3)); g.add(Math.round((100 + corner * 150) * m), 'goal');
            g.res = { t: 1.6, txt: corner > 0.75 ? 'TOP SHELF!' : 'GOAL!', c: '#9dff7a' }; g.sfx('power'); g.shake(6); const q = proj(p.x, p.y, GZ, g.cz); for (let i = 0; i < 26; i++) g.fx.push({ x: q.x, y: q.y, vx: g.R(-160, 160), vy: g.R(-220, 20), l: 0.8 }); }
          else { g.miss++; g.streak = 0; g.res = { t: 1.5, txt: save ? 'SAVED!' : post ? 'OFF THE POST!' : 'WIDE!', c: '#ff6b6b' }; g.sfx(post ? 'hit' : 'bad'); } } } },
    draw(g, c) { const cz = g.cz;
      if (!g.bgc) { const cv = document.createElement('canvas'); cv.width = g.W; cv.height = 300; const k = cv.getContext('2d'); const gr = k.createLinearGradient(0, 0, 0, 300); gr.addColorStop(0, '#0a1020'); gr.addColorStop(1, '#1e2a48'); k.fillStyle = gr; k.fillRect(0, 0, 400, 300);
        for (let i = 0; i < 700; i++) { k.fillStyle = ['#e2e8f0', '#ef4444', '#3b82f6', '#facc15', '#22c55e'][i % 5]; k.globalAlpha = 0.45; k.fillRect((i * 53) % 400, 80 + ((i * 31) % 170), 2, 3); } k.globalAlpha = 1;
        for (const x of [60, 200, 340]) { const lg = k.createRadialGradient(x, 20, 2, x, 20, 80); lg.addColorStop(0, 'rgba(255,255,255,.8)'); lg.addColorStop(1, 'rgba(255,255,255,0)'); k.fillStyle = lg; k.fillRect(x - 80, 0, 160, 100); } g.bgc = cv; }
      const bw = proj(-700, 0, GZ + 250, cz), bt = proj(700, 70, GZ + 250, cz); c.drawImage(g.bgc, 0, 0, 400, 300, 0, 0, 400, bt.y + 2);
      const ig = c.createLinearGradient(0, bw.y, 0, g.H); ig.addColorStop(0, '#cfe3f3'); ig.addColorStop(1, '#f5fbff'); c.fillStyle = ig; c.fillRect(0, bw.y, 400, g.H - bw.y); c.fillStyle = '#f8fafc'; c.fillRect(0, bt.y, 400, bw.y - bt.y); c.fillStyle = '#facc15'; c.fillRect(0, bw.y - 4, 400, 4);
      const ads = ['\u2618 GREEN LEAF', 'GOLD BUD 21+', 'KUSH KINGS', 'HIGH TIDE']; c.font = 'bold ' + Math.max(8, Math.round(36 * bt.s)) + 'px sans-serif'; c.textAlign = 'center'; for (let i = -1; i < 5; i++) { c.fillStyle = i % 2 ? '#15803d' : '#b45309'; c.fillText(ads[(i + 4) % 4], 200 + (i - 1.5) * 230 * bt.s * 2.2, (bt.y + bw.y) / 2 + 4); }
      c.fillStyle = 'rgba(200,230,255,.12)'; c.fillRect(0, bt.y - 90 * bt.s * 2, 400, 90 * bt.s * 2);
      // lines: goal line, crease
      const gl1 = proj(-600, 0, GZ, cz), gl2 = proj(600, 0, GZ, cz); c.strokeStyle = '#dc2626'; c.lineWidth = Math.max(1, 3 * gl1.s); c.beginPath(); c.moveTo(gl1.x, gl1.y); c.lineTo(gl2.x, gl2.y); c.stroke();
      c.fillStyle = 'rgba(59,130,246,.35)'; c.beginPath(); for (let i = 0; i <= 16; i++) { const a = Math.PI * i / 16; const q = proj(Math.cos(a) * 180, 0, GZ - Math.sin(a) * 130, cz); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); } c.fill();
      const bl = proj(-700, 0, 650, cz); if (bl.y < g.H && bl.y > 262) { c.fillStyle = 'rgba(37,99,235,.7)'; c.fillRect(0, bl.y, 400, Math.max(2, 18 * bl.s)); }
      for (let i = 0; i < 14; i++) { const z = Math.floor(cz / 140) * 140 + i * 140 - 280; const q = proj(((i * 97) % 600) - 300, 0, z, cz); if (q.y > 262 && q.y < g.H) { c.strokeStyle = 'rgba(148,163,184,.25)'; c.lineWidth = 1; c.beginPath(); c.moveTo(q.x - 30 * q.s, q.y); c.lineTo(q.x + 40 * q.s, q.y + 2); c.stroke(); } }
      // net
      const a = proj(-NW / 2, 0, GZ, cz), b = proj(NW / 2, NH, GZ, cz), ba = proj(-NW / 2 + 15, NH * 0.6, GZ + 90, cz), bb = proj(NW / 2 - 15, 0, GZ + 90, cz);
      c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(ba.x, ba.y, bb.x - ba.x, bb.y - ba.y); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; for (let i = 0; i <= 14; i++) { const x = ba.x + (bb.x - ba.x) * i / 14; c.beginPath(); c.moveTo(x, ba.y); c.lineTo(x, bb.y); c.stroke(); } for (let i = 0; i <= 6; i++) { const y = ba.y + (bb.y - ba.y) * i / 6; c.beginPath(); c.moveTo(ba.x, y); c.lineTo(bb.x, y); c.stroke(); }
      c.beginPath(); c.moveTo(a.x, b.y); c.lineTo(ba.x, ba.y); c.moveTo(b.x, b.y); c.lineTo(bb.x, ba.y); c.stroke();
      const puckDraw = () => { const pp = g.p.live ? g.p : { x: g.px, y: 0, z: cz + 60 }; const q = proj(pp.x, pp.y, pp.z, cz), sh = proj(pp.x, 0, pp.z, cz), r = 9 * q.s; c.fillStyle = 'rgba(15,23,42,.25)'; c.beginPath(); c.ellipse(sh.x, sh.y, r * 1.2, r * 0.4, 0, 0, 7); c.fill(); c.fillStyle = '#0b0b0f'; c.beginPath(); c.ellipse(q.x, q.y - r * 0.3, r, r * 0.45, 0, 0, 7); c.fill(); c.fillStyle = '#334155'; c.beginPath(); c.ellipse(q.x, q.y - r * 0.5, r, r * 0.4, 0, 0, 7); c.fill(); };
      const goalie = () => { const k = g.gk, q = proj(k.x, 0, GZ - 40, cz), s = q.s; c.save(); c.translate(q.x, q.y); const tilt = k.dive ? k.dir * 0.9 : 0; c.rotate(tilt); c.fillStyle = 'rgba(15,23,42,.25)'; c.beginPath(); c.ellipse(0, 0, 70 * s, 10 * s, 0, 0, 7); c.fill();
        c.fillStyle = '#f8fafc'; c.beginPath(); c.roundRect(-62 * s, -48 * s, 50 * s, 48 * s, 8 * s); c.fill(); c.beginPath(); c.roundRect(12 * s, -48 * s, 50 * s, 48 * s, 8 * s); c.fill(); c.strokeStyle = '#16a34a'; c.lineWidth = 4 * s; c.strokeRect(-56 * s, -40 * s, 38 * s, 30 * s); c.strokeRect(18 * s, -40 * s, 38 * s, 30 * s);
        c.fillStyle = '#166534'; c.beginPath(); c.roundRect(-36 * s, -112 * s, 72 * s, 68 * s, 14 * s); c.fill(); c.fillStyle = '#fde047'; c.font = 'bold ' + Math.round(26 * s) + 'px sans-serif'; c.textAlign = 'center'; c.fillText('\u2618', 0, -70 * s);
        c.fillStyle = '#e2e8f0'; c.beginPath(); c.arc(0, -128 * s, 18 * s, 0, 7); c.fill(); c.strokeStyle = '#475569'; c.lineWidth = 2 * s; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(i * 6 * s, -136 * s); c.lineTo(i * 6 * s, -116 * s); c.stroke(); }
        c.fillStyle = '#b45309'; c.beginPath(); c.arc(-52 * s, -88 * s, 18 * s, 0, 7); c.fill(); c.fillStyle = '#f8fafc'; c.fillRect(40 * s, -104 * s, 26 * s, 34 * s); c.strokeStyle = '#78350f'; c.lineWidth = 6 * s; c.beginPath(); c.moveTo(48 * s, -70 * s); c.lineTo(30 * s, -4 * s); c.lineTo(-10 * s, -2 * s); c.stroke(); c.restore(); };
      c.strokeStyle = '#dc2626'; c.lineWidth = Math.max(2, 6 * a.s); c.lineCap = 'round'; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(a.x, b.y); c.lineTo(b.x, b.y); c.lineTo(b.x, a.y); c.stroke(); c.lineCap = 'butt';
      if (g.p.live && g.p.z > GZ - 40) { puckDraw(); goalie(); } else { goalie(); puckDraw(); }
      // our stick (first-person)
      if (!g.p.live && !g.res) { const q = proj(g.px, 0, cz + 60, cz); c.strokeStyle = '#1f2937'; c.lineWidth = 9; c.beginPath(); c.moveTo(q.x + 120, g.H + 20); c.lineTo(q.x + 18, q.y - 4); c.stroke(); c.fillStyle = '#111827'; c.beginPath(); c.roundRect(q.x - 30, q.y - 8, 46, 12, 5); c.fill(); c.fillStyle = '#facc15'; c.fillRect(q.x + 60, g.H - 80, 16, 6);
        c.fillStyle = 'rgba(15,23,42,' + (0.45 + Math.sin(g.t * 5) * 0.2) + ')'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('\u2194 DRAG TO DEKE  \u00b7  \u2191 SWIPE TO SHOOT', 200, g.H - 20); }
      for (const f of g.fx) { c.fillStyle = 'rgba(255,255,255,' + Math.min(1, f.l * 2) + ')'; c.fillRect(f.x, f.y, 3, 3); }
      if (g.res) { const kk = 1 + Math.max(0, g.res.t - 1.2) * 1.5; c.save(); c.translate(200, 520); c.scale(kk, kk); c.font = 'bold 34px sans-serif'; c.textAlign = 'center'; c.lineWidth = 6; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(g.res.txt, 0, 0); c.fillStyle = g.res.c; c.fillText(g.res.txt, 0, 0); c.restore(); } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = '#9dff7a'; c.fillText('GOALS ' + g.goals + (g.streak >= 3 ? '  \u00b7  x' + Math.min(4, 1 + Math.floor(g.streak / 3)) : ''), 14, 48);
      for (let i = 0; i < 3; i++) { c.fillStyle = i < g.miss ? '#ef4444' : 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(g.W - 18 - i * 18, 26, 6, 0, 7); c.fill(); } } });
})();

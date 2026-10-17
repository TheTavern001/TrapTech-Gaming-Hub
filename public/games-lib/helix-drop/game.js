// Helix Drop - original spinning-tower drop (Hub build). Drag / arrows rotate the tower; fall through gaps, avoid red.
Kit.run({ fill: true, id: 'gl-helix-drop', title: 'HELIX DROP', help: 'Drag sideways / arrows to spin the tower\nDrop through gaps - red zones break you', bg: '#1e1b4b',
  init(g) { g.rot = 0; g.ball = { y: 120, vy: 0 }; g.lv = []; for (let i = 0; i < 400; i++) g.lv.push(mk(g, i)); g.cam = 0; g.pass = 0; g.combo = 0; },
  update(g, dt) {
    if (g.ptr.down) { g.rot += (g.ptr.x - (g.lx ?? g.ptr.x)) * 0.012; g.lx = g.ptr.x; } else g.lx = null; g.rot += g.ax() * 3.2 * dt;
    const b = g.ball; b.vy += 1300 * dt; b.y += b.vy * dt; g.cam = Kit.lerp(g.cam, b.y - 220, Math.min(1, dt * 8));
    const i = Math.floor((b.y + 8) / 110); const L = g.lv[i]; const ly = i * 110;
    if (L && !L.gone && b.vy > 0 && b.y + 10 >= ly && b.y + 10 - b.vy * dt < ly + 4) {
      const a = (((Math.PI / 2 - g.rot - L.off) % 6.283) + 6.283) % 6.283; const seg = Math.floor(a / (6.283 / 12)); const s = L.seg[seg];
      if (s === 0) {} else if (g.combo >= 3) { L.gone = true; g.add(10 * g.combo, 'p'); g.burst(g.W / 2, ly - g.cam + 34, '#fff', 30, 260); g.sfx('boom'); g.shake(6); g.combo = 0; }
      else if (s === 2) { g.burst(g.W / 2, b.y - g.cam + 34, '#ef4444', 40, 260); return g.end('Hit a red zone'); }
      else { b.y = ly - 10; b.vy = -520; g.combo = 0; g.sfx('jump'); g.burst(g.W / 2, ly - g.cam + 34, '#fde047', 6, 80, 0.3); }
    }
    while (g.pass < i && g.pass < g.lv.length) { g.pass++; g.combo++; g.add(g.combo, 'p'); if (g.combo >= 2) g.float(g.W / 2 + 40, b.y - g.cam, '+' + g.combo, '#fde047'); g.sfx('pop'); }
    g.hud = 'FLOOR ' + g.pass + (g.combo >= 3 ? '  FIREBALL!' : '');
  },
  draw(g, c) {
    const cx = g.W / 2, W = g.W, H = g.H, fl = Math.floor(g.cam / 110), hue = (fl * 11 + 250) % 360;
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, 'hsl(' + hue + ',55%,16%)'); bg.addColorStop(1, 'hsl(' + (hue + 40) % 360 + ',60%,8%)'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 22; i++) { const z = 0.2 + (i % 3) * 0.15, y = (((i * 91) - g.cam * z) % (H + 60) + H + 60) % (H + 60) - 30; c.globalAlpha = 0.08 + z * 0.15; c.fillStyle = '#fff'; c.beginPath(); c.arc((i * 61) % W, y, 2 + z * 6, 0, 6.283); c.fill(); } c.globalAlpha = 1;
    // pole
    const pg = c.createLinearGradient(cx - 22, 0, cx + 22, 0); pg.addColorStop(0, '#1e1b4b'); pg.addColorStop(0.35, '#6366f1'); pg.addColorStop(0.5, '#a5b4fc'); pg.addColorStop(1, '#1e1b4b'); c.fillStyle = pg; c.fillRect(cx - 22, 0, 44, H);
    const b = g.ball, by = b.y - g.cam + 34;
    for (let i = Math.max(0, Math.floor(g.cam / 110) - 1); i < g.cam / 110 + 9; i++) { const L = g.lv[i]; if (!L || L.gone) continue; const y = i * 110 - g.cam; const TH = 15;
      // back-to-front: back half top faces first, then front half with side walls
      const order = []; for (let s2 = 0; s2 < 12; s2++) { if (!L.seg[s2]) continue; const a0 = L.off + g.rot + s2 * 6.283 / 12, a1 = a0 + 6.283 / 12; order.push([s2, a0, a1, Math.sin((a0 + a1) / 2)]); } order.sort((p, q) => p[3] - q[3]);
      for (const [s2, a0, a1, d] of order) { const red = L.seg[s2] === 2, lit = 0.7 + 0.3 * d;
        const top = red ? (d > 0 ? '#ef4444' : '#b91c1c') : (d > 0 ? L.c : L.c2), side = red ? '#7f1d1d' : L.c2;
        if (d > -0.2) { c.fillStyle = side; c.beginPath(); c.ellipse(cx, y, 150, 40, 0, a0, a1); c.ellipse(cx, y + TH, 150, 40, 0, a1, a0, true); c.closePath(); c.fill(); }
        c.fillStyle = top; c.beginPath(); c.moveTo(cx, y); c.ellipse(cx, y, 150, 40, 0, a0, a1); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(255,255,255,' + (red ? 0.35 : 0.25 * lit) + ')'; c.lineWidth = 2; c.beginPath(); c.ellipse(cx, y, 148, 39, 0, a0 + 0.01, a1 - 0.01); c.stroke();
        if (red) { c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = 3; c.beginPath(); c.ellipse(cx, y, 120, 31, 0, a0 + 0.06, a1 - 0.06); c.stroke(); } }
      c.fillStyle = '#c7d2fe'; c.beginPath(); c.ellipse(cx, y, 22, 6, 0, 0, 6.283); c.fill();
      // ball shadow on the platform it will land on
      if (i === Math.floor((b.y + 8) / 110) + 0 && y + 36 > by) { c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(cx, y + 36, 12 * Math.max(0.4, 1 - (y + 36 - by) / 200), 4, 0, 0, 6.283); c.fill(); } }
    const fire = g.combo >= 3, bc = fire ? '#f97316' : '#fde047';
    for (let k = 3; k >= 1; k--) { c.globalAlpha = 0.18 * (4 - k); c.fillStyle = bc; c.beginPath(); c.arc(cx, by - b.vy * 0.012 * k, 10 - k, 0, 6.283); c.fill(); } c.globalAlpha = 1;
    Kit.glow(c, bc, 18); const sq = Math.min(0.25, Math.abs(b.vy) / 3000); const gr = c.createRadialGradient(cx - 4, by - 4, 2, cx, by, 13); gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, bc); gr.addColorStop(1, fire ? '#9a3412' : '#a16207'); c.fillStyle = gr; c.beginPath(); c.ellipse(cx, by, 11 * (1 - sq), 11 * (1 + sq), 0, 0, 6.283); c.fill(); Kit.noGlow(c);
    if (fire) { c.globalAlpha = 0.5 + 0.3 * Math.sin(g.t * 30); c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(cx - 8, by); c.quadraticCurveTo(cx, by - 38, cx + 8, by); c.fill(); c.globalAlpha = 1; }
  } });
function mk(g, i) { const seg = Array(12).fill(1); if (i === 0) { return { seg, off: 0, c: '#a855f7', c2: '#6b21a8' }; } const gap = g.RI(0, 11), gw = g.rnd() < 0.5 ? 2 : 3; for (let k = 0; k < gw; k++) seg[(gap + k) % 12] = 0; const reds = Math.min(5, Math.floor(i / 6) + (g.rnd() < 0.5 ? 1 : 0)); for (let k = 0; k < reds; k++) { const s = g.RI(0, 11); if (seg[s]) seg[s] = 2; } const hue = (i * 23) % 360; return { seg, off: g.R(0, 6.28), c: `hsl(${hue},70%,60%)`, c2: `hsl(${hue},70%,35%)` }; }

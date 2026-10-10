// Helix Drop - original spinning-tower drop (Hub build). Drag / arrows rotate the tower; fall through gaps, avoid red.
Kit.run({ id: 'gl-helix-drop', title: 'HELIX DROP', help: 'Drag sideways / arrows to spin the tower\nDrop through gaps - red zones break you', bg: '#1e1b4b',
  init(g) { g.rot = 0; g.ball = { y: 120, vy: 0 }; g.lv = []; for (let i = 0; i < 400; i++) g.lv.push(mk(g, i)); g.cam = 0; g.pass = 0; g.combo = 0; },
  update(g, dt) {
    if (g.ptr.down) { g.rot += (g.ptr.x - (g.lx ?? g.ptr.x)) * 0.012; g.lx = g.ptr.x; } else g.lx = null; g.rot += g.ax() * 3.2 * dt;
    const b = g.ball; b.vy += 1300 * dt; b.y += b.vy * dt; g.cam = Kit.lerp(g.cam, b.y - 220, Math.min(1, dt * 8));
    const i = Math.floor((b.y + 8) / 110); const L = g.lv[i]; const ly = i * 110;
    if (L && !L.gone && b.vy > 0 && b.y + 10 >= ly && b.y + 10 - b.vy * dt < ly + 4) {
      const a = (((-Math.PI / 2 - g.rot - L.off) % 6.283) + 6.283) % 6.283; const seg = Math.floor(a / (6.283 / 12)); const s = L.seg[seg];
      if (s === 0) {} else if (g.combo >= 3) { L.gone = true; g.add(10 * g.combo, 'p'); g.burst(g.W / 2, ly - g.cam, '#fff', 30, 260); g.sfx('boom'); g.shake(6); g.combo = 0; }
      else if (s === 2) { g.burst(g.W / 2, b.y - g.cam, '#ef4444', 40, 260); return g.end('Hit a red zone'); }
      else { b.y = ly - 10; b.vy = -520; g.combo = 0; g.sfx('jump'); g.burst(g.W / 2, ly - g.cam, '#fde047', 6, 80, 0.3); }
    }
    while (g.pass < i && g.pass < g.lv.length) { g.pass++; g.combo++; g.add(g.combo, 'p'); if (g.combo >= 2) g.float(g.W / 2 + 40, b.y - g.cam, '+' + g.combo, '#fde047'); g.sfx('pop'); }
    g.hud = 'FLOOR ' + g.pass + (g.combo >= 3 ? '  FIREBALL!' : '');
  },
  draw(g, c) {
    const cx = g.W / 2; c.fillStyle = '#312e81'; c.fillRect(cx - 18, 0, 36, g.H);
    for (let i = Math.max(0, Math.floor(g.cam / 110) - 1); i < g.cam / 110 + 8; i++) { const L = g.lv[i]; if (!L || L.gone) continue; const y = i * 110 - g.cam;
      for (let s = 0; s < 12; s++) { if (!L.seg[s]) continue; const a0 = L.off + g.rot + s * 6.283 / 12, a1 = a0 + 6.283 / 12; const depth = Math.sin((a0 + a1) / 2); c.fillStyle = L.seg[s] === 2 ? (depth > 0 ? '#ef4444' : '#991b1b') : (depth > 0 ? L.c : L.c2); c.beginPath(); c.ellipse(cx, y, 150, 40, 0, a0, a1); c.ellipse(cx, y + 14, 150, 40, 0, a1, a0, true); c.closePath(); c.fill(); } }
    const b = g.ball; Kit.glow(c, g.combo >= 3 ? '#f97316' : '#fde047', 14); Kit.circ(c, cx, b.y - g.cam + (-40 + 40), 11, g.combo >= 3 ? '#f97316' : '#fde047'); Kit.noGlow(c);
  } });
function mk(g, i) { const seg = Array(12).fill(1); if (i === 0) { return { seg, off: 0, c: '#a855f7', c2: '#6b21a8' }; } const gap = g.RI(0, 11), gw = g.rnd() < 0.5 ? 2 : 3; for (let k = 0; k < gw; k++) seg[(gap + k) % 12] = 0; const reds = Math.min(5, Math.floor(i / 6) + (g.rnd() < 0.5 ? 1 : 0)); for (let k = 0; k < reds; k++) { const s = g.RI(0, 11); if (seg[s]) seg[s] = 2; } const hue = (i * 23) % 360; return { seg, off: g.R(0, 6.28), c: `hsl(${hue},70%,60%)`, c2: `hsl(${hue},70%,35%)` }; }

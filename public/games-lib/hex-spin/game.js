// Hex Spin - original closing-walls survival (Hub build). Orbit the core, slip through the gaps.
Kit.run({ fill: true, id: 'gl-hex-spin', title: 'HEX SPIN', help: 'Hold left / right side (or arrows) to orbit\nSurvive the closing walls - score = time', bg: '#020617',
  init(g) { g.a = 0; g.walls = []; g.next = 0.5; g.rot = 0; g.rs = 1; g.lastS = 0; g.hue = 280; },
  update(g, dt) {
    let d = g.ax(); if (g.ptr.down) d = g.ptr.x < g.W / 2 ? -1 : 1; g.a += d * 6.5 * dt; g.rot += g.rs * dt * (1 + g.t * 0.02); if (g.rnd() < dt * 0.2) g.rs = -g.rs;
    const sp = 170 + g.t * 3; g.next -= dt; if (g.next <= 0) { g.next = Math.max(0.42, 0.95 - g.t * 0.006); const gap = g.RI(0, 5), pat = g.rnd(); const segs = []; for (let s = 0; s < 6; s++) segs.push(pat < 0.3 ? s % 2 === gap % 2 : s !== gap); g.walls.push({ r: 520, segs, th: 22 }); }
    for (const w of g.walls) w.r -= sp * dt; g.walls = g.walls.filter(w => w.r > 20);
    const pa = ((g.a % 6.283) + 6.283) % 6.283, rel = (((pa - g.rot) % 6.283) + 6.283) % 6.283, seg = Math.floor(rel / (6.283 / 6)), PR = 70;
    for (const w of g.walls) if (w.segs[seg] && PR > w.r && PR < w.r + w.th) { g.burst(g.W / 2 + Math.cos(g.a) * PR, g.H / 2 + Math.sin(g.a) * PR, '#fff', 40, 260); return g.end('Crushed'); }
    const s = Math.floor(g.t * 10); if (s > g.lastS) { g.add(s - g.lastS, 's'); g.lastS = s; if (s % 100 === 0) { g.sfx('power'); g.float(g.W / 2, 140, (s / 10) + 's!', '#fff', 26); g.hue = (g.hue + 60) % 360; } }
    g.hud = (g.t).toFixed(1) + 's';
  },
  draw(g, c) {
    const cx = g.W / 2, cy = g.H / 2, h = g.hue; c.save(); c.translate(cx, cy); c.rotate(g.rot); const pulse = 1 + Math.sin(g.t * 9) * 0.04; c.scale(pulse, pulse);
    for (let s = 0; s < 6; s++) { c.fillStyle = s % 2 ? `hsl(${h},50%,8%)` : `hsl(${h},50%,13%)`; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 700, s * 1.047, (s + 1) * 1.047); c.fill(); }
    for (const w of g.walls) for (let s = 0; s < 6; s++) if (w.segs[s]) { c.fillStyle = `hsl(${h},90%,60%)`; c.beginPath(); c.arc(0, 0, w.r + w.th, s * 1.047, (s + 1) * 1.047); c.arc(0, 0, w.r, (s + 1) * 1.047, s * 1.047, true); c.fill(); }
    c.fillStyle = `hsl(${h},90%,60%)`; c.beginPath(); for (let s = 0; s < 6; s++) c.lineTo(Math.cos(s * 1.047) * 44, Math.sin(s * 1.047) * 44); c.fill(); c.fillStyle = '#020617'; c.beginPath(); for (let s = 0; s < 6; s++) c.lineTo(Math.cos(s * 1.047) * 38, Math.sin(s * 1.047) * 38); c.fill(); c.restore();
    const px = cx + Math.cos(g.a) * 70 * (1 + Math.sin(g.t * 9) * 0.04), py = cy + Math.sin(g.a) * 70; c.save(); c.translate(px, py); c.rotate(g.a); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(8, 0); c.lineTo(-5, -6); c.lineTo(-5, 6); c.fill(); c.restore();
  } });

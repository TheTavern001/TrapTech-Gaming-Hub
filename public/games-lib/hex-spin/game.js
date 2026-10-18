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
    const cx = g.W / 2, cy = g.H / 2, h = g.hue, W = g.W, H = g.H, beat = Math.pow(Math.max(0, Math.sin(g.t * 9)), 4);
    c.fillStyle = `hsl(${h},60%,4%)`; c.fillRect(0, 0, W, H);
    c.save(); c.translate(cx, cy); c.rotate(g.rot); const pulse = 1 + beat * 0.035; c.scale(pulse, pulse);
    for (let s = 0; s < 6; s++) { const gr = c.createRadialGradient(0, 0, 20, 0, 0, 720); gr.addColorStop(0, `hsl(${h},55%,${s % 2 ? 14 : 19}%)`); gr.addColorStop(1, `hsl(${h},60%,${s % 2 ? 4 : 7}%)`); c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 760, s * 1.047, (s + 1) * 1.047); c.fill(); }
    c.globalCompositeOperation = 'lighter';
    for (const w of g.walls) { const k = Math.min(1, w.r / 420); for (let s = 0; s < 6; s++) if (w.segs[s]) { const a0 = s * 1.047, a1 = (s + 1) * 1.047; c.fillStyle = `hsla(${h},90%,${48 + (1 - k) * 12}%,.85)`; c.beginPath(); c.arc(0, 0, w.r + w.th, a0, a1); c.arc(0, 0, w.r, a1, a0, true); c.fill(); c.strokeStyle = `hsla(${h + 20},100%,85%,.9)`; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, w.r, a0, a1); c.stroke(); } }
    c.globalCompositeOperation = 'source-over';
    Kit.glow(c, `hsl(${h},100%,60%)`, 20); c.fillStyle = `hsl(${h},90%,60%)`; c.beginPath(); for (let s = 0; s < 6; s++) c.lineTo(Math.cos(s * 1.047) * 46, Math.sin(s * 1.047) * 46); c.fill(); Kit.noGlow(c); c.fillStyle = '#020617'; c.beginPath(); for (let s = 0; s < 6; s++) c.lineTo(Math.cos(s * 1.047) * 38, Math.sin(s * 1.047) * 38); c.fill(); c.restore();
    g.trl = g.trl || []; const PR = 70 * pulse, px = cx + Math.cos(g.a) * PR, py = cy + Math.sin(g.a) * PR; g.trl.push({ x: px, y: py, l: 1 }); for (const q of g.trl) q.l -= 0.08; g.trl = g.trl.filter(q => q.l > 0);
    for (const q of g.trl) { c.globalAlpha = q.l * 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(q.x, q.y, 5 * q.l, 0, 7); c.fill(); } c.globalAlpha = 1;
    c.save(); c.translate(px, py); c.rotate(g.a); Kit.glow(c, '#fff', 16); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(10, 0); c.lineTo(-6, -7); c.lineTo(-3, 0); c.lineTo(-6, 7); c.fill(); Kit.noGlow(c); c.restore();
  } });

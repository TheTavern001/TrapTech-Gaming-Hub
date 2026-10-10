// Bug Blaster - original mushroom-field segment shooter (Hub build)
Kit.run({ id: 'gl-bug-blaster', title: 'BUG BLASTER', help: 'Drag / arrows to move in the bottom zone\nAuto-fire on touch, Space to fire', bg: '#0b0b1a',
  init(g) { g.S = 20; g.cols = 20; g.rows = 32; g.mush = new Map(); for (let i = 0; i < 45; i++) g.mush.set(g.RI(0, 19) + ',' + g.RI(3, 26), 3); g.p = { x: 200, y: 640 }; g.sh = null; g.wave = 0; g.cent = []; newWave(g); g.spider = null; g.lives = 3; g.inv = 0; },
  update(g, dt) {
    const p = g.p, S = g.S; p.x = Kit.clamp(p.x + g.ax() * 260 * dt, 10, g.W - 10); p.y = Kit.clamp(p.y + g.ay() * 260 * dt, 560, 680); if (g.ptr.down) { p.x += Kit.clamp(g.ptr.x - p.x, -360 * dt, 360 * dt); p.y = Kit.clamp(p.y + Kit.clamp(g.ptr.y - 40 - p.y, -360 * dt, 360 * dt), 560, 680); } g.inv -= dt;
    if (!g.sh && (g.keys[' '] || g.ptr.down)) { g.sh = { x: p.x, y: p.y - 10 }; g.sfx('shoot'); }
    if (g.sh) { g.sh.y -= 900 * dt; const k = Math.floor(g.sh.x / S) + ',' + Math.floor(g.sh.y / S); if (g.mush.has(k)) { const h = g.mush.get(k) - 1; if (h <= 0) { g.mush.delete(k); g.add(1, 'm'); } else g.mush.set(k, h); g.sh = null; g.sfx('click'); } else if (g.sh.y < 0) g.sh = null; }
    g.mt = (g.mt || 0) + dt; const step = Math.max(0.03, 0.09 - g.wave * 0.006);
    while (g.mt > step) { g.mt -= step; for (const s of g.cent) { const nx = s.c + s.d; const blocked = nx < 0 || nx >= g.cols || g.mush.has(nx + ',' + s.r); if (blocked) { s.r += s.dr; s.d = -s.d; if (s.r >= g.rows - 1) s.dr = -1; if (s.r <= 26 && s.dr < 0) s.dr = 1; } else s.c = nx; } }
    if (g.sh) for (let i = 0; i < g.cent.length; i++) { const s = g.cent[i]; if (Math.abs(s.c * S + S / 2 - g.sh.x) < S / 2 + 2 && Math.abs(s.r * S + S / 2 - g.sh.y) < S / 2 + 4) { g.add(s.head ? 100 : 10, 's'); g.mush.set(s.c + ',' + s.r, 3); g.burst(s.c * S + 10, s.r * S + 10, '#4ade80', 12, 140); g.sfx('pop'); g.cent.splice(i, 1); if (g.cent[i]) g.cent[i].head = true; g.sh = null; break; } }
    for (const s of g.cent) if (g.inv <= 0 && Math.abs(s.c * S + 10 - p.x) < 16 && Math.abs(s.r * S + 10 - p.y) < 16) { die(g); if (g.state !== 'play') return; break; }
    if (!g.spider && g.rnd() < dt * 0.15) g.spider = { x: g.rnd() < 0.5 ? -10 : g.W + 10, y: 600, vx: 0, vy: 0, t: 0 }; if (g.spider) { const sp = g.spider; sp.t += dt; sp.vx = (sp.x < 0 ? 1 : sp.x > g.W ? -1 : Math.sign(sp.vx || 1)) * 110; sp.x += sp.vx * dt; sp.y = 600 + Math.sin(sp.t * 4) * 60; if (g.sh && Math.hypot(g.sh.x - sp.x, g.sh.y - sp.y) < 16) { const v = g.pick([300, 600, 900]); g.add(v, 'p'); g.float(sp.x, sp.y, v, '#f472b6', 16); g.burst(sp.x, sp.y, '#f472b6', 20); g.sfx('boom'); g.spider = null; g.sh = null; } else if (g.inv <= 0 && Math.hypot(p.x - sp.x, p.y - sp.y) < 18) { die(g); if (g.state !== 'play') return; } else if (sp.t > 9) g.spider = null; }
    if (!g.cent.length) { g.add(200 * g.wave, 'c'); g.sfx('line'); newWave(g); }
    g.hud = 'WAVE ' + g.wave + '  ' + '\u2665'.repeat(g.lives);
  },
  draw(g, c) {
    const S = g.S; c.fillStyle = 'rgba(99,102,241,.08)'; c.fillRect(0, 550, g.W, 150);
    for (const [k, h] of g.mush) { const [x, y] = k.split(',').map(Number); c.fillStyle = ['#000', '#7c2d12', '#c2410c', '#f97316'][h]; c.beginPath(); c.arc(x * S + 10, y * S + 10, 9, Math.PI, 0); c.fill(); c.fillStyle = '#fde68a'; c.fillRect(x * S + 7, y * S + 10, 6, 8); }
    for (const s of g.cent) { Kit.glow(c, '#4ade80', 8); Kit.circ(c, s.c * S + 10, s.r * S + 10, 9, s.head ? '#facc15' : '#4ade80'); Kit.noGlow(c); if (s.head) { Kit.circ(c, s.c * S + 7, s.r * S + 8, 2, '#111'); Kit.circ(c, s.c * S + 13, s.r * S + 8, 2, '#111'); } }
    if (g.spider) { const sp = g.spider; Kit.circ(c, sp.x, sp.y, 10, '#f472b6'); c.strokeStyle = '#f472b6'; c.lineWidth = 2; for (let i = -1; i <= 1; i += 2) for (let j = 0; j < 3; j++) { c.beginPath(); c.moveTo(sp.x, sp.y); c.lineTo(sp.x + i * 16, sp.y - 8 + j * 8 + Math.sin(g.t * 20 + j) * 3); c.stroke(); } }
    if (g.sh) { c.fillStyle = '#fff'; c.fillRect(g.sh.x - 1.5, g.sh.y - 8, 3, 12); }
    if (!(g.inv > 0 && Math.sin(g.t * 30) > 0)) { const p = g.p; Kit.glow(c, '#22d3ee', 12); c.fillStyle = '#22d3ee'; c.beginPath(); c.moveTo(p.x, p.y - 12); c.lineTo(p.x + 10, p.y + 10); c.lineTo(p.x - 10, p.y + 10); c.fill(); Kit.noGlow(c); }
  } });
function newWave(g) { g.wave++; g.mark('w', g.wave); g.cent = []; const n = Math.min(16, 9 + g.wave); for (let i = 0; i < n; i++) g.cent.push({ c: 9 - i, r: 0, d: 1, dr: 1, head: i === 0 }); }
function die(g) { g.lives--; g.inv = 2; g.sfx('boom'); g.shake(10); g.flash('#ef4444'); g.burst(g.p.x, g.p.y, '#22d3ee', 30, 240); g.spider = null; if (g.lives <= 0) g.end('Bugged out'); }

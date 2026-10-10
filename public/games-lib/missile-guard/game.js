// Missile Guard - original city-defense interceptor (Hub build). Tap the sky to detonate interceptors.
Kit.run({ id: 'gl-missile-guard', title: 'MISSILE GUARD', help: 'Tap / click the sky to launch an interceptor\nBlast radius takes out incoming warheads', bg: '#020617',
  init(g) { g.cities = [60, 120, 180, 260, 320, 380].map(x => ({ x, alive: true })); g.bases = [{ x: 30, ammo: 10 }, { x: 220, ammo: 10 }, { x: 370, ammo: 10 }]; g.inc = []; g.ints = []; g.ex = []; g.wave = 0; g.left = 0; g.wt = 1; },
  update(g, dt) {
    const P = g.ptr; let tx = null, ty; if (P.pressed && P.y < 560) { tx = P.x; ty = P.y; } if (g.kd(' ') && g.inc.length) { const m = g.inc.reduce((a, b) => b.y > a.y ? b : a); tx = m.x + m.vx * 0.6; ty = m.y + m.vy * 0.6; }
    if (tx !== null) { const b = g.bases.filter(b => b.ammo > 0).sort((a, b) => Math.abs(a.x - tx) - Math.abs(b.x - tx))[0]; if (b) { b.ammo--; g.ints.push({ x: b.x, y: 600, sx: b.x, tx, ty, t: 0, T: Math.hypot(tx - b.x, ty - 600) / 520 }); g.sfx('shoot'); } else g.sfx('bad'); }
    g.wt -= dt; if (g.wt <= 0 && g.left <= 0 && !g.inc.length) { g.wave++; g.mark('w', g.wave); g.left = 8 + g.wave * 3; g.bases.forEach(b => b.ammo = 10 + Math.min(6, g.wave)); g.float(g.W / 2, 250, 'WAVE ' + g.wave, '#fbbf24', 26); }
    if (g.left > 0 && g.rnd() < dt * (0.9 + g.wave * 0.25)) { g.left--; const tgts = [...g.cities.filter(c => c.alive), ...g.bases]; const t = g.pick(tgts); const sx = g.R(0, g.W), T = g.R(5, 9) / (1 + g.wave * 0.08); g.inc.push({ x: sx, y: 0, sx, sy: 0, vx: (t.x - sx) / T, vy: 600 / T, split: g.wave > 2 && g.rnd() < 0.2 }); }
    for (const m of g.inc) { m.x += m.vx * dt; m.y += m.vy * dt; if (m.split && m.y > 220) { m.split = false; for (let i = 0; i < 2; i++) g.inc.push({ ...m, sx: m.x, sy: m.y, vx: m.vx + g.R(-40, 40), split: false }); } if (m.y >= 600) { m.dead = true; g.ex.push({ x: m.x, y: 600, r: 0, max: 30, t: 0, enemy: true }); g.sfx('boom'); g.shake(8); for (const c of g.cities) if (c.alive && Math.abs(c.x - m.x) < 24) { c.alive = false; } for (const b of g.bases) if (Math.abs(b.x - m.x) < 20) b.ammo = 0; } }
    for (const s of g.ints) { s.t += dt; const k = Math.min(1, s.t / s.T); s.x = s.sx + (s.tx - s.sx) * k; s.y = 600 + (s.ty - 600) * k; if (k >= 1) { s.dead = true; g.ex.push({ x: s.tx, y: s.ty, r: 0, max: 42, t: 0 }); g.sfx('boom'); } }
    for (const e of g.ex) { e.t += dt; e.r = e.max * Math.sin(Math.min(1, e.t / 1.2) * Math.PI); if (!e.enemy) for (const m of g.inc) if (!m.dead && Math.hypot(m.x - e.x, m.y - e.y) < e.r) { m.dead = true; g.add(25, 'k'); g.float(m.x, m.y, '+25', '#fbbf24', 13); g.ex.push({ x: m.x, y: m.y, r: 0, max: 30, t: 0 }); } }
    g.inc = g.inc.filter(m => !m.dead); g.ints = g.ints.filter(s => !s.dead); g.ex = g.ex.filter(e => e.t < 1.2);
    if (!g.cities.some(c => c.alive)) return g.end('All cities lost');
    if (g.left <= 0 && !g.inc.length && g.wt <= 0 && !g.bonusDone) { g.bonusDone = true; const b = g.cities.filter(c => c.alive).length * 100 + g.bases.reduce((s, b) => s + b.ammo, 0) * 5; g.add(b, 'c'); g.float(g.W / 2, 300, 'WAVE BONUS +' + b, '#34d399', 22); g.sfx('line'); g.wt = 2.5; } if (g.left > 0) g.bonusDone = false;
    g.hud = 'WAVE ' + g.wave;
  },
  draw(g, c) {
    Kit.stars(c, g.W, 560, 0, 0, 60); c.fillStyle = '#854d0e'; c.fillRect(0, 600, g.W, 100); c.fillStyle = '#a16207'; c.fillRect(0, 600, g.W, 6);
    for (const ct of g.cities) if (ct.alive) { c.fillStyle = '#22d3ee'; c.fillRect(ct.x - 18, 584, 10, 16); c.fillRect(ct.x - 6, 576, 10, 24); c.fillRect(ct.x + 6, 588, 12, 12); } else { c.fillStyle = '#44403c'; c.fillRect(ct.x - 16, 594, 32, 6); }
    for (const b of g.bases) { c.fillStyle = '#a16207'; c.beginPath(); c.moveTo(b.x - 24, 600); c.lineTo(b.x, 570); c.lineTo(b.x + 24, 600); c.fill(); g.txt(b.ammo, b.x, 616, 12, '#fff'); }
    c.lineWidth = 2; for (const m of g.inc) { c.strokeStyle = 'rgba(239,68,68,.7)'; c.beginPath(); c.moveTo(m.sx, m.sy); c.lineTo(m.x, m.y); c.stroke(); Kit.circ(c, m.x, m.y, 3, '#fff'); }
    for (const s of g.ints) { c.strokeStyle = 'rgba(52,211,153,.8)'; c.beginPath(); c.moveTo(s.sx, 600); c.lineTo(s.x, s.y); c.stroke(); c.strokeStyle = '#fff'; c.beginPath(); c.moveTo(s.tx - 5, s.ty - 5); c.lineTo(s.tx + 5, s.ty + 5); c.moveTo(s.tx + 5, s.ty - 5); c.lineTo(s.tx - 5, s.ty + 5); c.stroke(); }
    for (const e of g.ex) { const gr = c.createRadialGradient(e.x, e.y, 0, e.x, e.y, Math.max(1, e.r)); gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, e.enemy ? '#f97316' : '#fde047'); gr.addColorStop(1, 'rgba(239,68,68,0)'); c.fillStyle = gr; c.beginPath(); c.arc(e.x, e.y, Math.max(1, e.r), 0, 7); c.fill(); }
  } });

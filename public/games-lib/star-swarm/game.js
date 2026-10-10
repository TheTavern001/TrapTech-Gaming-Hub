// Star Swarm - original formation shooter with diving bugs (Hub build)
Kit.run({ id: 'gl-star-swarm', title: 'STAR SWARM', help: 'Drag / arrows to move, auto-fire while touching\nSpace to fire - divers are worth double', bg: '#02030f',
  init(g) { g.p = { x: 200, cd: 0, inv: 1 }; g.stage = 0; g.sh = []; g.eb = []; g.lives = 3; nextStage(g); },
  update(g, dt) {
    const p = g.p; p.x += g.ax() * 300 * dt; if (g.ptr.down) p.x += Kit.clamp(g.ptr.x - p.x, -400 * dt, 400 * dt); p.x = Kit.clamp(p.x, 18, g.W - 18); p.inv -= dt;
    p.cd -= dt; if ((g.keys[' '] || g.ptr.down) && p.cd <= 0 && g.sh.length < 3) { p.cd = 0.2; g.sh.push({ x: p.x, y: 615 }); g.sfx('shoot'); }
    for (const s of g.sh) s.y -= 600 * dt; g.sh = g.sh.filter(s => s.y > 30 && !s.dead);
    g.ft += dt; const sway = Math.sin(g.ft * 0.9) * 30, breathe = 1 + Math.sin(g.ft * 1.6) * 0.05;
    g.entry = Math.max(0, g.entry - dt);
    for (const e of g.en) { if (e.dead) continue; const hx = 200 + (e.gx - 4.5) * 36 * breathe + sway, hy = 110 + e.gy * 34;
      if (e.st === 'in') { e.k += dt * 0.8; const t = Math.min(1, e.k - e.delay); if (t > 0) { const sx = e.side ? g.W + 40 : -40; e.x = Kit.lerp(sx, hx, t) + Math.sin(t * Math.PI) * 120 * (e.side ? -1 : 1); e.y = Kit.lerp(300, hy, t) - Math.sin(t * Math.PI) * 140; if (t >= 1) e.st = 'f'; } else { e.x = -100; e.y = -100; } }
      else if (e.st === 'f') { e.x = hx; e.y = hy; if (!g.entry && g.rnd() < dt * (0.05 + g.stage * 0.012)) { e.st = 'd'; e.dt = 0; e.sx = e.x; g.sfx('whoosh'); } }
      else if (e.st === 'd') { e.dt += dt; e.x = e.sx + Math.sin(e.dt * 2.5) * 90 + (p.x - e.sx) * Math.min(1, e.dt * 0.5); e.y += (220 + g.stage * 15) * dt; if (g.rnd() < dt * 1.2 && e.y < 500) g.eb.push({ x: e.x, y: e.y, vx: (p.x - e.x) * 0.4, vy: 260 }); if (e.y > g.H + 20) { e.st = 'in'; e.k = e.delay = 0; e.side = g.rnd() < 0.5; e.y = -30; e.st = 'f'; } }
      for (const s of g.sh) if (!s.dead && Math.abs(s.x - e.x) < 16 && Math.abs(s.y - e.y) < 14) { s.dead = true; if (--e.hp <= 0) { e.dead = true; const v = e.v * (e.st === 'd' ? 2 : 1); g.add(v, 'k'); g.float(e.x, e.y, v, e.st === 'd' ? '#fbbf24' : '#fff', 14); g.burst(e.x, e.y, [e.c, '#fff'], 18, 200); g.sfx('pop'); g.shake(2); } else { g.sfx('hit'); e.c = '#a855f7'; } }
      if (!e.dead && p.inv <= 0 && Math.abs(e.x - p.x) < 20 && Math.abs(e.y - 625) < 18) { e.dead = true; die(g); if (g.state !== 'play') return; } }
    for (const b of g.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (p.inv <= 0 && Math.abs(b.x - p.x) < 12 && Math.abs(b.y - 625) < 12) { b.y = 9e3; die(g); if (g.state !== 'play') return; } } g.eb = g.eb.filter(b => b.y < g.H);
    if (g.en.every(e => e.dead)) { g.add(300 * g.stage, 'c'); g.float(200, 330, 'STAGE CLEAR +' + 300 * g.stage, '#34d399', 22); g.sfx('line'); nextStage(g); }
    g.hud = 'STAGE ' + g.stage + '  ' + '\u25B2'.repeat(g.lives);
  },
  draw(g, c) {
    Kit.stars(c, g.W, g.H, g.t, 60, 90);
    for (const e of g.en) { if (e.dead || e.y < -50) continue; c.save(); c.translate(e.x, e.y); if (e.st === 'd') c.rotate(Math.sin(e.dt * 2.5) * 0.5 + Math.PI); const f = Math.sin(g.t * 12) * 3; Kit.glow(c, e.c, 10); c.fillStyle = e.c; c.beginPath(); c.ellipse(0, 0, 7, 10, 0, 0, 7); c.fill(); c.fillStyle = e.c2; c.beginPath(); c.moveTo(-6, -2); c.lineTo(-17, -8 + f); c.lineTo(-15, 6); c.closePath(); c.moveTo(6, -2); c.lineTo(17, -8 + f); c.lineTo(15, 6); c.closePath(); c.fill(); Kit.noGlow(c); Kit.circ(c, -3, -4, 2, '#fff'); Kit.circ(c, 3, -4, 2, '#fff'); c.restore(); }
    c.fillStyle = '#fff'; for (const s of g.sh) c.fillRect(s.x - 1.5, s.y - 9, 3, 14); c.fillStyle = '#ef4444'; for (const b of g.eb) { c.beginPath(); c.arc(b.x, b.y, 3.5, 0, 7); c.fill(); }
    const p = g.p; if (!(p.inv > 0 && Math.sin(g.t * 25) > 0)) { c.save(); c.translate(p.x, 625); Kit.glow(c, '#22d3ee', 14); c.fillStyle = '#e2e8f0'; c.beginPath(); c.moveTo(0, -16); c.lineTo(14, 12); c.lineTo(0, 6); c.lineTo(-14, 12); c.closePath(); c.fill(); c.fillStyle = '#ef4444'; c.fillRect(-2, -6, 4, 8); Kit.noGlow(c); c.fillStyle = '#f97316'; c.fillRect(-3, 8, 6, 4 + Math.random() * 6); c.restore(); }
  } });
function nextStage(g) { g.stage++; g.mark('w', g.stage); g.en = []; g.ft = 0; g.entry = 3; const C = [['#fbbf24', '#ef4444', 160, 2], ['#ef4444', '#3b82f6', 80, 1], ['#ef4444', '#3b82f6', 80, 1], ['#3b82f6', '#fbbf24', 50, 1], ['#3b82f6', '#fbbf24', 50, 1]];
  let n = 0; for (let r = 0; r < 5; r++) for (let i = 0; i < 10; i++) { if (r === 0 && (i < 3 || i > 6)) continue; if (r > 0 && r < 3 && (i === 0 || i === 9)) continue; const k = C[r]; g.en.push({ gx: i, gy: r, c: k[0], c2: k[1], v: k[2], hp: k[3], st: 'in', k: 0, delay: (n++ % 8) * 0.12 + Math.floor(n / 8) * 0.5, side: (n % 2) === 0, x: -100, y: -100 }); } }
function die(g) { const p = g.p; g.lives--; g.burst(p.x, 625, ['#22d3ee', '#fff', '#f97316'], 40, 260); g.sfx('boom'); g.shake(12); g.flash('#ef4444'); p.inv = 2.5; if (g.lives <= 0) g.end('Fighter destroyed'); }

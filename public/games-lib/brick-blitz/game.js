// Brick Blitz - original paddle & ball brick breaker with power-ups (Hub build)
Kit.run({ id: 'gl-brick-blitz', title: 'BRICK BLITZ', help: 'Drag / arrows to move the paddle\nTap / Space to launch - catch power-ups', bg: '#050720',
  init(g) { g.pad = { x: 200, w: 80 }; g.lives = 3; g.wall = 0; g.balls = []; g.pu = []; g.combo = 0; nextWall(g); },
  update(g, dt) {
    const P = g.pad; P.x += g.ax() * 420 * dt; if (g.ptr.down || g.stick.on) P.x = Kit.lerp(P.x, g.ptr.x, Math.min(1, dt * 18)); P.x = Kit.clamp(P.x, P.w / 2, g.W - P.w / 2);
    if (P.wt > 0 && (P.wt -= dt) <= 0) P.w = 80;
    for (const b of g.balls) if (b.stuck) { b.x = P.x; b.y = 618; if (g.tap() || g.ptr.released) { b.stuck = false; b.vx = g.R(-120, 120); b.vy = -b.sp; g.sfx('click'); } }
    for (const b of g.balls) { if (b.stuck) continue; const steps = 3; for (let s = 0; s < steps; s++) { b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      if (b.x < 7) { b.x = 7; b.vx = Math.abs(b.vx); } if (b.x > g.W - 7) { b.x = g.W - 7; b.vx = -Math.abs(b.vx); } if (b.y < 50) { b.y = 50; b.vy = Math.abs(b.vy); }
      if (b.vy > 0 && b.y > 618 && b.y < 636 && Math.abs(b.x - P.x) < P.w / 2 + 6) { const o = (b.x - P.x) / (P.w / 2); const sp = Math.hypot(b.vx, b.vy); const a = o * 1.1; b.vx = Math.sin(a) * sp; b.vy = -Math.cos(a) * sp; g.combo = 0; g.sfx('click'); g.burst(b.x, 620, '#22d3ee', 6, 80, 0.3); }
      for (const k of g.br) { if (k.hp <= 0) continue; if (b.x + 7 > k.x && b.x - 7 < k.x + k.w && b.y + 7 > k.y && b.y - 7 < k.y + k.h) {
        const ox = Math.min(b.x + 7 - k.x, k.x + k.w - b.x + 7), oy = Math.min(b.y + 7 - k.y, k.y + k.h - b.y + 7); if (ox < oy) b.vx *= -1; else b.vy *= -1;
        if (k.hp < 99) k.hp--; if (k.hp <= 0) { g.combo++; const v = k.v * Math.min(8, g.combo); g.add(v, 'b'); g.float(k.x + k.w / 2, k.y, '+' + v, k.c, 13); g.burst(k.x + k.w / 2, k.y + k.h / 2, k.c, 14, 160); g.sfx('pop'); g.shake(2); if (g.rnd() < 0.12) g.pu.push({ x: k.x + k.w / 2, y: k.y, t: g.pick(['W', 'M', 'S']) }); } else g.sfx('hit');
        const sp = Math.hypot(b.vx, b.vy); if (sp < b.sp + 200) { b.vx *= 1.01; b.vy *= 1.01; } break; } } }
      if (b.y > g.H + 10) b.dead = true; }
    g.balls = g.balls.filter(b => !b.dead); if (!g.balls.length) { g.lives--; g.sfx('die'); g.shake(8); if (g.lives <= 0) return g.end('Out of balls'); serve(g); }
    for (const u of g.pu) { u.y += 140 * dt; if (u.y > 610 && u.y < 640 && Math.abs(u.x - P.x) < P.w / 2 + 10) { u.dead = true; g.sfx('power'); if (u.t === 'W') { P.w = 130; P.wt = 12; } if (u.t === 'M') { const b0 = g.balls[0]; for (let i = 0; i < 2; i++) g.balls.push({ x: b0.x, y: b0.y, vx: g.R(-200, 200), vy: -b0.sp, sp: b0.sp }); } if (u.t === 'S') for (const b of g.balls) { b.vx *= 0.7; b.vy *= 0.7; } } }
    g.pu = g.pu.filter(u => !u.dead && u.y < g.H);
    if (g.br.every(k => k.hp <= 0 || k.hp >= 99)) { g.add(250 * g.wall, 'c'); g.float(200, 330, 'WALL CLEAR +' + 250 * g.wall, '#34d399', 24); g.sfx('line'); nextWall(g); }
    g.hud = 'WALL ' + g.wall + '  ' + '\u2665'.repeat(g.lives);
  },
  draw(g, c) {
    Kit.bgGrid(c, g.W, g.H, g.t * 4);
    for (const k of g.br) if (k.hp > 0) { c.fillStyle = k.hp >= 99 ? '#475569' : k.c; Kit.glow(c, k.c, 6); Kit.rr(c, k.x + 1, k.y + 1, k.w - 2, k.h - 2, 4); c.fill(); Kit.noGlow(c); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(k.x + 3, k.y + 3, k.w - 6, 3); if (k.hp > 1 && k.hp < 99) g.txt(k.hp, k.x + k.w / 2, k.y + k.h / 2 + 1, 10, '#fff'); }
    for (const u of g.pu) { c.fillStyle = { W: '#3b82f6', M: '#f472b6', S: '#34d399' }[u.t]; Kit.rr(c, u.x - 14, u.y - 8, 28, 16, 8); c.fill(); g.txt(u.t, u.x, u.y + 1, 11, '#fff'); }
    const P = g.pad; Kit.glow(c, '#22d3ee', 16); c.fillStyle = '#22d3ee'; Kit.rr(c, P.x - P.w / 2, 622, P.w, 12, 6); c.fill(); for (const b of g.balls) Kit.circ(c, b.x, b.y, 7, '#fff'); Kit.noGlow(c);
  } });
function serve(g) { g.balls = [{ x: g.pad.x, y: 618, vx: 0, vy: 0, sp: 330 + g.wall * 18, stuck: true }]; }
function nextWall(g) { g.wall++; g.mark('w', g.wall); g.br = []; const rows = Math.min(9, 4 + g.wall), cols = 8, bw = (g.W - 20) / cols; const pat = g.RI(0, 3); const C = ['#ef4444', '#f97316', '#fbbf24', '#34d399', '#22d3ee', '#3b82f6', '#a855f7', '#f472b6', '#ef4444'];
  for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) { if (pat === 1 && (i + r) % 2) continue; if (pat === 2 && Math.abs(i - 3.5) > rows - r) continue; if (pat === 3 && r % 3 === 2 && i % 2) continue;
    const hp = g.wall > 2 && g.rnd() < 0.05 * g.wall ? (g.rnd() < 0.15 ? 99 : 2 + Math.floor(g.wall / 4)) : 1; g.br.push({ x: 10 + i * bw, y: 80 + r * 24, w: bw, h: 22, hp, c: C[r], v: hp > 1 && hp < 99 ? 50 : r < 2 ? 30 : r < 5 ? 20 : 10 }); }
  serve(g); g.pu = []; }

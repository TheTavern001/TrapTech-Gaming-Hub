// Sling Siege - original slingshot tower-toppling campaign (Hub build). Blocks have HP; knocked blocks fly as debris,
// unsupported blocks fall, debris and falling blocks crush targets. Endless sequence of generated forts.
(function () {
  const GY = 400, SX = 130, SY = 320;
  const MAT = { w: { c: '#b45309', hp: 2, v: 20 }, s: { c: '#64748b', hp: 4, v: 50 }, i: { c: '#7dd3fc', hp: 1, v: 10 } };
  function fort(g) { g.blocks = []; g.tg = []; const lvl = g.lv; const towers = Math.min(4, 1 + Math.floor(lvl / 2)); let x = 470;
    for (let t = 0; t < towers; t++) { const fl = Math.min(5, 2 + Math.floor(g.rnd() * (1 + lvl / 2))); let y = GY; const w = 70;
      for (let f = 0; f < fl; f++) { const m = g.pick(lvl < 2 ? ['w', 'i'] : ['w', 'w', 's', 'i']); g.blocks.push({ x: x, y: y - 50, w: 12, h: 50, m, hp: MAT[m].hp }); g.blocks.push({ x: x + w - 12, y: y - 50, w: 12, h: 50, m, hp: MAT[m].hp }); g.tg.push({ x: x + w / 2, y: y - 14, r: 13, alive: true }); g.blocks.push({ x: x - 6, y: y - 62, w: w + 12, h: 12, m: g.pick(['w', 's', 'i']), hp: 2 }); y -= 62; }
      x += w + g.R(20, 50); if (x > 740) break; }
    for (const b of g.blocks) { b.vy = 0; b.hp = MAT[b.m].hp; } g.shots = 3 + Math.min(2, Math.floor(lvl / 3)); g.bird = null; g.debris = []; g.settle = 0; }
  Kit.run({ id: 'gl-sling-siege', title: 'SLING SIEGE', orient: 'l', help: 'Drag back from the sling and release to launch\nTopple the forts, pop every green bot', bg: '#0c4a6e', partGrav: 400,
    init(g) { g.lv = 1; fort(g); g.aim = null; g.mark('t', 1); },
    update(g, dt) {
      const P = g.ptr;
      if (!g.bird && g.shots > 0) { if (P.pressed && Math.hypot(P.x - SX, P.y - SY) < 90) g.aim = { x: P.x, y: P.y }; if (g.aim && P.down) { const dx = P.x - SX, dy = P.y - SY, d = Math.min(90, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); g.aim = { x: SX + Math.cos(a) * d, y: SY + Math.sin(a) * d }; }
        if (g.kd(' ')) g.aim = { x: SX - 70, y: SY + 40 }; // keyboard fallback: default shot, then adjust with arrows
        if (g.aim && (g.keys.ArrowUp || g.keys.ArrowDown || g.keys.ArrowLeft || g.keys.ArrowRight)) { g.aim.y += ((g.keys.ArrowDown ? 1 : 0) - (g.keys.ArrowUp ? 1 : 0)) * 90 * dt; g.aim.x += ((g.keys.ArrowRight ? 1 : 0) - (g.keys.ArrowLeft ? 1 : 0)) * 90 * dt; }
        if (g.aim && (P.released || g.kd('Enter') || (g.keys[' '] === false && g.kAim))) launch(g); g.kAim = g.aim && g.keys[' ']; }
      const b = g.bird; if (b) { b.vy += 500 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.t += dt; if (g.frames % 2) g.parts.push({ x: b.x, y: b.y, vx: 0, vy: 0, l: 0.6, m: 0, c: 'rgba(255,255,255,.5)', s: 3, gr: 0 });
        if (b.y > GY - 12) { b.y = GY - 12; b.vy *= -0.4; b.vx *= 0.7; }
        for (const k of g.blocks) { if (k.dead) continue; if (Kit.cr(b.x, b.y, 12, k)) { const sp = Math.hypot(b.vx, b.vy); const dmg = sp / 180; k.hp -= dmg; g.sfx('thud'); g.shake(3); if (k.hp <= 0) breakBlock(g, k, b.vx * 0.6, b.vy * 0.6); else { k.kx = (k.kx || 0) + b.vx * 0.15; } b.vx *= 0.55; b.vy *= 0.55; if (Math.abs(b.x - k.x - k.w / 2) > k.w / 2) b.vx *= -0.5; } }
        for (const t of g.tg) if (t.alive && Math.hypot(t.x - b.x, t.y - b.y) < t.r + 12) popT(g, t);
        if (b.t > 8 || b.x > g.W + 40 || b.x < -40 || (Math.hypot(b.vx, b.vy) < 15 && b.y >= GY - 13)) { g.bird = null; g.settle = 1.2; } }
      // falling blocks (unsupported)
      for (const k of g.blocks) { if (k.dead) continue; const sup = k.y + k.h >= GY - 0.5 || g.blocks.some(o => o !== k && !o.dead && o.y >= k.y + k.h - 2 && o.y <= k.y + k.h + 2 && o.x < k.x + k.w - 2 && o.x + o.w > k.x + 2);
        if (k.kx) { k.x += k.kx * dt; k.kx *= Math.pow(0.01, dt); if (Math.abs(k.kx) < 5) k.kx = 0; }
        if (!sup) { k.vy += 900 * dt; k.y += k.vy * dt; for (const t of g.tg) if (t.alive && Kit.cr(t.x, t.y, t.r, k) && k.vy > 120) popT(g, t); for (const o of g.blocks) if (o !== k && !o.dead && Kit.hit(k, o) && o.y > k.y) { k.y = o.y - k.h; if (k.vy > 380) { o.hp -= 1; k.hp -= 1; g.sfx('thud'); if (o.hp <= 0) breakBlock(g, o, g.R(-80, 80), 0); if (k.hp <= 0) breakBlock(g, k, g.R(-80, 80), -100); } k.vy = 0; } if (k.y + k.h > GY) { k.y = GY - k.h; if (k.vy > 380) { k.hp -= 1; g.sfx('thud'); if (k.hp <= 0) breakBlock(g, k, g.R(-60, 60), -80); } k.vy = 0; } } else k.vy = 0; }
      for (const d of g.debris) { d.vy += 700 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.a += d.va * dt; d.l -= dt; if (d.y > GY - 6) { d.y = GY - 6; d.vy *= -0.3; d.vx *= 0.6; } for (const t of g.tg) if (t.alive && Math.hypot(d.x - t.x, d.y - t.y) < t.r + 8 && Math.hypot(d.vx, d.vy) > 140) popT(g, t); }
      g.debris = g.debris.filter(d => d.l > 0);
      if (!g.bird && g.settle > 0) { g.settle -= dt; if (g.settle <= 0) { if (g.tg.every(t => !t.alive)) { const bonus = 1000 * g.shots; g.add(bonus + 500, 'c'); g.float(g.W / 2, 150, 'FORT DOWN! +' + (bonus + 500), '#34d399', 28); g.sfx('line'); g.lv++; g.mark('t', g.lv); fort(g); } else if (g.shots <= 0) return g.end('Out of shots'); } }
      g.hud = 'FORT ' + g.lv + '   SHOTS ' + g.shots + (g.bird ? '' : '');
    },
    draw(g, c) {
      const sky = c.createLinearGradient(0, 0, 0, GY); sky.addColorStop(0, '#1e3a8a'); sky.addColorStop(1, '#7dd3fc'); c.fillStyle = sky; c.fillRect(0, 0, g.W, GY);
      c.fillStyle = 'rgba(255,255,255,.25)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse((i * 190 + g.t * 8) % 900 - 50, 60 + i * 20, 55, 15, 0, 0, 7); c.fill(); }
      c.fillStyle = '#4d7c0f'; c.fillRect(0, GY, g.W, g.H - GY); c.fillStyle = '#65a30d'; c.fillRect(0, GY, g.W, 6);
      for (const k of g.blocks) { if (k.dead) continue; c.fillStyle = MAT[k.m].c; c.fillRect(k.x, k.y, k.w, k.h); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.strokeRect(k.x, k.y, k.w, k.h); if (k.hp < MAT[k.m].hp) { c.strokeStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.moveTo(k.x + 2, k.y + 2); c.lineTo(k.x + k.w - 2, k.y + k.h - 2); c.stroke(); } }
      for (const d of g.debris) { c.save(); c.translate(d.x, d.y); c.rotate(d.a); c.fillStyle = d.c; c.fillRect(-d.s / 2, -d.s / 4, d.s, d.s / 2); c.restore(); }
      for (const t of g.tg) if (t.alive) { Kit.circ(c, t.x, t.y, t.r, '#22c55e'); Kit.circ(c, t.x, t.y, t.r - 3, '#4ade80'); Kit.circ(c, t.x - 4, t.y - 3, 3, '#fff'); Kit.circ(c, t.x + 4, t.y - 3, 3, '#fff'); Kit.circ(c, t.x - 4, t.y - 3, 1.4, '#111'); Kit.circ(c, t.x + 4, t.y - 3, 1.4, '#111'); }
      c.fillStyle = '#78350f'; c.fillRect(SX - 6, SY, 12, GY - SY); c.fillRect(SX - 18, SY - 26, 8, 30); c.fillRect(SX + 10, SY - 26, 8, 30);
      const a = g.aim; c.strokeStyle = '#451a03'; c.lineWidth = 4; if (a && !g.bird) { c.beginPath(); c.moveTo(SX - 14, SY - 22); c.lineTo(a.x, a.y); c.lineTo(SX + 14, SY - 22); c.stroke(); Kit.circ(c, a.x, a.y, 12, '#ef4444');
        const vx = (SX - a.x) * 7.5, vy = (SY - a.y) * 7.5; c.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 1; i < 16; i++) { const t = i * 0.07; c.fillRect(a.x + vx * t - 2, a.y + vy * t + 250 * t * t - 2, 4, 4); } }
      else if (!g.bird && g.shots > 0) Kit.circ(c, SX, SY - 18, 12, '#ef4444');
      if (g.bird) { Kit.circ(c, g.bird.x, g.bird.y, 12, '#ef4444'); Kit.circ(c, g.bird.x + 4, g.bird.y - 3, 3, '#fff'); c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(g.bird.x + 10, g.bird.y); c.lineTo(g.bird.x + 18, g.bird.y + 3); c.lineTo(g.bird.x + 10, g.bird.y + 6); c.fill(); }
      for (let i = 0; i < g.shots - (g.bird ? 0 : 1); i++) Kit.circ(c, 40 + i * 22, GY - 10, 8, '#ef4444');
    } });
  function launch(g) { const a = g.aim; if (Math.hypot(a.x - SX, a.y - SY) < 15) { g.aim = null; return; } g.bird = { x: a.x, y: a.y, vx: (SX - a.x) * 7.5, vy: (SY - a.y) * 7.5, t: 0 }; g.aim = null; g.shots--; g.sfx('whoosh'); }
  function breakBlock(g, k, vx, vy) { k.dead = true; g.add(MAT[k.m].v, 'k'); g.float(k.x + k.w / 2, k.y, '+' + MAT[k.m].v, '#fff', 13); g.sfx(k.m === 'i' ? 'pop' : 'hit'); for (let i = 0; i < 4; i++) g.debris.push({ x: k.x + k.w / 2, y: k.y + k.h / 2, vx: vx + g.R(-120, 120), vy: vy + g.R(-200, 0), a: 0, va: g.R(-8, 8), l: 2, s: Math.max(k.w, k.h) / 2, c: MAT[k.m].c }); }
  function popT(g, t) { t.alive = false; g.add(500, 'b'); g.float(t.x, t.y - 20, '+500', '#34d399', 20); g.burst(t.x, t.y, ['#22c55e', '#4ade80', '#fff'], 26, 220); g.sfx('pop'); g.shake(4); }
})();

// Rift Survival — original top-down arena survival game for The Gaming Hub.
// Controls: WASD / arrows or touch-drag to move. Survive waves, collect rift shards.
Kit.run({
  id: 'gl-rift-survival',
  title: 'RIFT SURVIVAL',
  help: 'MOVE TO SURVIVE · COLLECT SHARDS · CLEAR THE RIFT',
  bg: '#080b18',
  stick: true,
  init(g) {
    g.player = { x: g.W / 2, y: g.H * .58, r: 13, hp: 3, invuln: 0, speed: 185 };
    g.enemies = [];
    g.shards = [];
    g.spawn = .6;
    g.wave = 1;
    g.lastWave = 1;
    g.kills = 0;
    g.elapsed = 0;
    g.shardClock = 0;
    g.riftPulse = 0;
  },
  update(g, dt) {
    const p = g.player;
    g.elapsed += dt;
    g.wave = 1 + Math.floor(g.elapsed / 18);
    if (g.wave !== g.lastWave) { g.lastWave = g.wave; g.add(g.wave * 10, 'b'); g.mark('wave', g.wave); g.sfx('power'); }
    p.invuln = Math.max(0, p.invuln - dt);
    p.x = Kit.clamp(p.x + g.ax() * p.speed * dt, 20, g.W - 20);
    p.y = Kit.clamp(p.y + g.ay() * p.speed * dt, 28, g.H - 28);
    g.spawn -= dt;
    if (g.spawn <= 0) {
      // Keep entity count bounded on long runs and slower mobile devices.
      g.spawn = Math.max(.28, .92 - g.wave * .045);
      if (g.enemies.length >= 70) { g.spawn = .18; } else {
      const a = g.R(0, Math.PI * 2);
      const edge = Math.floor(g.R(0, 4));
      let x = edge === 0 ? -16 : edge === 1 ? g.W + 16 : g.R(0, g.W);
      let y = edge === 2 ? -16 : edge === 3 ? g.H + 16 : g.R(0, g.H);
      if (edge === 0 || edge === 1) y = g.R(0, g.H);
      if (edge === 2 || edge === 3) x = g.R(0, g.W);
      g.enemies.push({ x, y, r: g.R(8, 13), hp: 1, phase: g.R(0, 6.28), speed: g.R(36, 54) + g.wave * 2.5, hue: Math.floor(g.R(0, 3)) });
      }
    }
    for (let i = g.enemies.length - 1; i >= 0; i--) {
      const e = g.enemies[i];
      const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
      e.phase += dt * 3;
      e.x += dx / d * e.speed * dt + Math.cos(e.phase) * 10 * dt;
      e.y += dy / d * e.speed * dt + Math.sin(e.phase) * 10 * dt;
      if (d < p.r + e.r + 2 && p.invuln <= 0) {
        p.hp--; p.invuln = 1.15; g.shake(8, .3); g.flash('#ff355d', .12); g.sfx('bad');
        if (p.hp <= 0) { g.hud = 'RIFT COLLAPSED'; return g.end('Rift collapsed'); }
      }
      if (d < 18 && p.invuln > .7) { /* brief post-hit grace: collision remains non-lethal */ }
    }
    g.shardClock -= dt;
    if (g.shardClock <= 0) {
      g.shardClock = 2.8;
      if (g.shards.length < 8) g.shards.push({ x: g.R(30, g.W - 30), y: g.R(50, g.H - 50), r: 9, phase: 0, life: 10 });
    }
    for (let i = g.shards.length - 1; i >= 0; i--) {
      const s = g.shards[i]; s.phase += dt * 3; s.life -= dt;
      if (s.life <= 0) { g.shards.splice(i, 1); continue; }
      if (Math.hypot(p.x - s.x, p.y - s.y) < 22) {
        g.shards.splice(i, 1); g.add(25, 's'); g.sfx('coin'); g.burst(s.x, s.y, '#6fffe9', 14, 150, .55);
      }
    }
    // Enemies that drift far off-screen are removed to bound memory and per-frame work.
    g.enemies = g.enemies.filter(e => e.x > -60 && e.x < g.W + 60 && e.y > -60 && e.y < g.H + 60);
    g.hud = 'WAVE ' + g.wave + '   HP ' + '♥'.repeat(Math.max(0, p.hp)) + '   SHARDS ' + Math.floor(g.score / 25);
  },
  draw(g, c) {
    const W = g.W, H = g.H;
    const bg = c.createRadialGradient(W * .5, H * .48, 20, W * .5, H * .48, Math.max(W, H) * .7);
    bg.addColorStop(0, '#171a3d'); bg.addColorStop(.55, '#0b1028'); bg.addColorStop(1, '#050710');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // Subtle arena grid and pulsing rift rings.
    c.strokeStyle = 'rgba(88,115,255,.12)'; c.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
    for (let y = 0; y < H; y += 40) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    const pulse = .5 + .5 * Math.sin(g.t * 2.2);
    c.save(); c.translate(W * .5, H * .47); c.rotate(g.t * .08);
    for (let i = 0; i < 4; i++) {
      c.beginPath(); c.ellipse(0, 0, 56 + i * 20 + pulse * 8, 28 + i * 12, .25, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(102,90,255,' + (.2 - i * .035) + ')'; c.lineWidth = 2; c.stroke();
    }
    c.restore();
    for (const s of g.shards) {
      const pulseS = 1 + Math.sin(s.phase) * .12;
      c.save(); c.translate(s.x, s.y); c.rotate(s.phase * .5); c.scale(pulseS, pulseS);
      c.shadowColor = '#6fffe9'; c.shadowBlur = 18; c.fillStyle = '#6fffe9';
      c.beginPath(); c.moveTo(0, -12); c.lineTo(9, 0); c.lineTo(0, 12); c.lineTo(-9, 0); c.closePath(); c.fill(); c.restore();
    }
    for (const e of g.enemies) {
      c.save(); c.translate(e.x, e.y); c.rotate(e.phase * .3);
      const col = ['#ff5277', '#ff8f4d', '#be69ff'][e.hue];
      c.shadowColor = col; c.shadowBlur = 12; c.fillStyle = col;
      c.beginPath(); c.moveTo(0, -e.r * 1.3); c.lineTo(e.r, 0); c.lineTo(0, e.r * 1.3); c.lineTo(-e.r, 0); c.closePath(); c.fill();
      c.restore();
    }
    const p = g.player;
    c.save(); c.translate(p.x, p.y);
    c.globalAlpha = p.invuln > 0 && Math.floor(g.t * 16) % 2 === 0 ? .35 : 1;
    c.shadowColor = '#6fffe9'; c.shadowBlur = 22;
    c.fillStyle = '#d9fffb'; c.strokeStyle = '#6fffe9'; c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 13, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = '#5d62ff'; c.beginPath(); c.arc(0, 0, 5, 0, Math.PI * 2); c.fill(); c.restore();
    c.fillStyle = 'rgba(3,7,20,.65)'; c.fillRect(12, 12, 104, 7);
    c.fillStyle = '#ff5277'; c.fillRect(12, 12, 104 * Math.max(0, p.hp) / 3, 7);
    c.fillStyle = '#d7eaff'; c.font = '12px system-ui'; c.fillText('RIFT CORE', 12, 34);
  }
});

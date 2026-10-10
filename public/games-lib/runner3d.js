// Shared pseudo-3D three-lane runner (original code, MIT). Used by Rail Rush, Ruin Runner and other lane runners.
// cfg: { id, title, help, theme:{sky1,sky2,ground,lane,side,obs,coin}, turns:bool, gaps:bool, trains:bool, coinV, speed }
window.Runner3D = function (cfg) {
  const T = cfg.theme; const HZ = 230; // horizon y
  const proj = (x, z, W, H) => { const s = 260 / (z + 260); return { x: W / 2 + x * s * 1.0, y: HZ + (H - HZ) * s * 1.05 - 0, s }; };
  Kit.run({ id: cfg.id, title: cfg.title, help: cfg.help || 'Swipe / arrows: left-right to change lane\nUp to jump, down to roll', bg: T.sky2,
    init(g) { g.lane = 0; g.lx = 0; g.y = 0; g.vy = 0; g.roll = 0; g.z = 0; g.sp = cfg.speed || 420; g.obs = []; g.coins = []; g.spawnZ = 600; g.dist = 0; g.turnAt = cfg.turns ? 1800 : 1e12; g.turn = null; g.lean = 0; g.mag = 0; g.lastM = 0; g.spawnZ = 300; for (let z = 1000; z < 2400; z += 450) spawn(g, z); },
    update(g, dt) {
      let mv = 0, jump = false, roll = false; if (g.kd('ArrowLeft') || g.kd('a')) mv = -1; if (g.kd('ArrowRight') || g.kd('d')) mv = 1; if (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) jump = true; if (g.kd('ArrowDown') || g.kd('s')) roll = true;
      if (g.ptr.released) { const dx = g.ptr.x - g.ptr.sx, dy = g.ptr.y - g.ptr.sy; if (Math.hypot(dx, dy) < 18) jump = true; else if (Math.abs(dx) > Math.abs(dy)) mv = Math.sign(dx); else if (dy < 0) jump = true; else roll = true; }
      if (g.turn) { if (mv && mv === g.turn.dir && g.turn.z < 140) { g.turn.done = true; g.sfx('whoosh'); g.add(25, 't'); g.float(g.W / 2, 300, 'TURN +25', '#34d399'); g.lean = mv; mv = 0; } }
      if (mv) { const nl = Kit.clamp(g.lane + mv, -1, 1); if (nl !== g.lane) { g.lane = nl; g.sfx('click'); } }
      if (jump && g.y === 0) { g.vy = 620; g.sfx('jump'); g.roll = 0; } if (roll) { g.roll = 0.6; if (g.y > 0) g.vy = -900; g.sfx('whoosh'); }
      g.vy -= 1700 * dt; g.y = Math.max(0, g.y + g.vy * dt); if (g.y === 0) g.vy = 0; g.roll = Math.max(0, g.roll - dt); g.lx = Kit.lerp(g.lx, g.lane, Math.min(1, dt * 14)); g.lean *= Math.pow(0.02, dt);
      g.sp = Math.min(1100, (cfg.speed || 420) + g.t * 7); const d = g.sp * dt; g.dist += d / 40; const m = Math.floor(g.dist); if (m > (g.lastM || 0)) { g.add(m - (g.lastM || 0), 'm'); g.lastM = m; }
      for (const o of g.obs) o.z -= d; for (const c of g.coins) c.z -= d; g.spawnZ -= d; g.mag = Math.max(0, g.mag - dt);
      while (g.spawnZ <= 0) { spawn(g, 2400); g.spawnZ += Math.max(170, 400 - g.t * 2) + g.R(0, 180); }
      if (cfg.turns) { g.turnAt -= d; if (!g.turn && g.turnAt < 2000) { g.turn = { z: 2000, dir: g.rnd() < 0.5 ? -1 : 1 }; } if (g.turn) { g.turn.z -= d; if (g.turn.z < 0) { if (!g.turn.done) { return g.end('Missed the turn'); } g.turn = null; g.turnAt = g.R(1800, 3200); } } }
      for (const o of g.obs) { if (o.z < 30 && o.z > -30 && !o.hit) { if (o.lane === g.lane || o.wide) { const ok = (o.k === 'low' && g.y > 40) || (o.k === 'high' && g.roll > 0) || (o.k === 'gap' && g.y > 20) || (o.k === 'train' && o.ramp && g.y > 0); if (!ok) { o.hit = true; g.shake(12); g.flash('#ef4444'); g.burst(g.W / 2, g.H - 120, ['#fff', T.obs], 30, 260); g.sfx('boom'); return g.end(o.k === 'gap' ? 'Fell in' : 'Crashed'); } else if (!o.scored) { o.scored = true; g.add(10, 'o'); } } } }
      for (const c of g.coins) if (!c.got && c.z < 30 && c.z > -30 && (c.lane === g.lane || g.mag > 0) && Math.abs(g.y - c.h) < 70) { c.got = true; g.add(cfg.coinV || 10, 'c'); g.sfx('coin'); const p = proj(c.lane * 120, Math.max(1, c.z), g.W, g.H); g.burst(p.x, p.y - 40, T.coin, 6, 100, 0.4); }
      g.obs = g.obs.filter(o => o.z > -80); g.coins = g.coins.filter(c => c.z > -80 && !c.got);
      g.hud = Math.floor(g.dist) + ' m' + (g.turn ? (g.turn.dir < 0 ? '   \u2190 TURN LEFT' : '   TURN RIGHT \u2192') : '');
    },
    draw(g, c) {
      const W = g.W, H = g.H; const sky = c.createLinearGradient(0, 0, 0, HZ); sky.addColorStop(0, T.sky1); sky.addColorStop(1, T.sky2); c.fillStyle = sky; c.fillRect(0, 0, W, HZ);
      c.fillStyle = T.far || 'rgba(255,255,255,.08)'; for (let i = 0; i < 9; i++) { const x = ((i * 61 - g.lean * 30) % 460 + 460) % 460 - 30, h = 30 + (i * 37) % 60; c.fillRect(x, HZ - h, 40, h); }
      c.fillStyle = T.ground; c.fillRect(0, HZ, W, H - HZ);
      // road trapezoid with lane lines and sleepers
      const L = proj(-190, 2400, W, H), R = proj(190, 2400, W, H), L0 = proj(-190, -100, W, H), R0 = proj(190, -100, W, H); c.fillStyle = T.lane; c.beginPath(); c.moveTo(L.x, L.y); c.lineTo(R.x, R.y); c.lineTo(R0.x, R0.y); c.lineTo(L0.x, L0.y); c.fill();
      const off = (g.dist * 40) % 120; c.fillStyle = T.side; for (let z = 2400 - off; z > -80; z -= 120) { const a = proj(-190, z, W, H), b = proj(190, z, W, H); c.globalAlpha = 0.5; c.fillRect(a.x, a.y, b.x - a.x, Math.max(1, 6 * a.s)); } c.globalAlpha = 1;
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 2; for (const x of [-60, 60]) { const a = proj(x, 2400, W, H), b = proj(x, -100, W, H); c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      if (g.turn) { const p = proj(0, Math.max(1, g.turn.z), W, H); c.fillStyle = T.ground; c.fillRect(0, p.y - 4, W, 8); c.fillStyle = 'rgba(251,191,36,.9)'; g.txt(g.turn.dir < 0 ? '\u2190' : '\u2192', p.x, p.y - 40 * p.s - 10, 30 + 40 * p.s, '#fbbf24'); }
      const items = [...g.obs.map(o => ({ z: o.z, o })), ...g.coins.map(k => ({ z: k.z, k }))].sort((a, b) => b.z - a.z);
      for (const it of items) { if (it.z < -40) continue; if (it.o) { const o = it.o; const p = proj(o.wide ? 0 : o.lane * 120, Math.max(1, o.z), W, H), s = p.s, w = (o.wide ? 380 : 100) * s;
          if (o.k === 'low') { c.fillStyle = T.obs; c.fillRect(p.x - w / 2, p.y - 40 * s, w, 40 * s); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(p.x - w / 2, p.y - 40 * s, w, 6 * s); }
          else if (o.k === 'high') { c.fillStyle = T.obs; c.fillRect(p.x - w / 2, p.y - 150 * s, 10 * s, 150 * s); c.fillRect(p.x + w / 2 - 10 * s, p.y - 150 * s, 10 * s, 150 * s); c.fillStyle = '#fbbf24'; c.fillRect(p.x - w / 2, p.y - 150 * s, w, 40 * s); c.fillStyle = '#111'; for (let k = 0; k < 4; k++) c.fillRect(p.x - w / 2 + k * w / 4, p.y - 150 * s, w / 8, 40 * s); }
          else if (o.k === 'gap') { c.fillStyle = '#000'; c.fillRect(p.x - w / 2, p.y - 12 * s, w, 24 * s); }
          else if (o.k === 'train') { const p2 = proj(o.lane * 120, Math.max(1, o.z + o.len), W, H); c.fillStyle = T.train || '#64748b'; c.beginPath(); c.moveTo(p.x - 50 * p.s, p.y); c.lineTo(p.x + 50 * p.s, p.y); c.lineTo(p2.x + 50 * p2.s, p2.y - 130 * p2.s); c.lineTo(p2.x - 50 * p2.s, p2.y - 130 * p2.s); c.lineTo(p2.x - 50 * p2.s, p2.y); c.closePath(); c.fill(); c.fillStyle = o.ramp ? '#fbbf24' : (T.trainFront || '#ef4444'); c.fillRect(p.x - 50 * s, p.y - 130 * s, 100 * s, 130 * s); c.fillStyle = '#bae6fd'; c.fillRect(p.x - 38 * s, p.y - 115 * s, 76 * s, 40 * s); } }
        else { const k = it.k; const p = proj(k.lane * 120, Math.max(1, k.z), W, H); Kit.glow(c, T.coin, 8); c.fillStyle = T.coin; c.beginPath(); c.ellipse(p.x, p.y - (k.h + 40) * p.s, 14 * p.s * Math.abs(Math.sin(g.t * 4 + k.z * 0.01)) + 2, 14 * p.s, 0, 0, 7); c.fill(); Kit.noGlow(c); } }
      // player
      const p = proj(g.lx * 120, 0, W, H); const bob = g.y === 0 ? Math.abs(Math.sin(g.t * 14)) * 4 : 0; const hgt = g.roll > 0 ? 34 : 64; const px = p.x, py = p.y - g.y * p.s - bob;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(p.x, p.y, 26, 8, 0, 0, 7); c.fill(); c.save(); c.translate(px, py); c.rotate(g.lean * 0.3);
      c.fillStyle = cfg.hero || '#22d3ee'; Kit.rr(c, -16, -hgt, 32, hgt - 14, 10); c.fill(); Kit.circ(c, 0, -hgt - 10, 13, '#fcd9b6'); c.fillStyle = cfg.cap || '#a855f7'; c.fillRect(-14, -hgt - 22, 28, 9);
      if (g.roll <= 0) { const sw = Math.sin(g.t * 16) * 8; c.fillStyle = '#1e293b'; c.fillRect(-12 + sw, -16, 9, 16); c.fillRect(3 - sw, -16, 9, 16); } c.restore();
    } });
  function spawn(g, z) { const lvl = Math.min(1, g.t / 90); const r = g.rnd(); const lane = g.RI(-1, 1);
    if (cfg.trains && r < 0.25) { g.obs.push({ k: 'train', lane, z, len: g.R(250, 500), ramp: g.rnd() < 0.3 }); }
    else if (r < 0.5) g.obs.push({ k: 'low', lane, z }); else if (r < 0.7) g.obs.push({ k: 'high', lane, z, wide: lvl > 0.4 && g.rnd() < 0.3 }); else if (cfg.gaps && r < 0.82) g.obs.push({ k: 'gap', lane, z, wide: g.rnd() < 0.3 });
    if (r > 0.6 || g.rnd() < 0.5) { const cl = g.RI(-1, 1); if (cl !== lane || r > 0.82) for (let i = 0; i < 5; i++) g.coins.push({ lane: cl, z: z + 60 + i * 50, h: 0 }); }
    if (g.rnd() < 0.15 + lvl * 0.2) { const l2 = g.RI(-1, 1); if (l2 !== lane) g.obs.push({ k: g.pick(['low', 'high']), lane: l2, z: z + g.R(-20, 20) }); } }
};

// @uses art.js
// Alien Rows - original marching-invaders shooter (Hub v8 rebuild). Drag to move, auto-fire while touching.
// Endless waves, uncapped, skill only (seeded alien fire). Art is drawn in code; no third-party assets.
(function () {
  const TAU = Math.PI * 2, CW = 8, SP = 40, RH = 34;
  const COLS3 = ['#5fd68a', '#f2c744', '#ec5b84', '#4fb0ee', '#a874f2'];
  Kit.run({ id: 'gl-alien-rows', title: 'ALIEN ROWS', fill: true, minH: 640, maxH: 900, bg: '#070a1c', partGrav: 0,
    help: 'Drag to move, hold to auto-fire\nHide behind the bunkers - they crumble\nShoot the saucer for big points',
    init(g) { g.wave = 0; g.lives = 3; g.p = { x: g.W / 2 }; g.pb = []; g.eb = []; g.fire = 0; g.inv = 0; g.ufo = null; g.ut = 12; g.py = g.H - 64; newWave(g); },
    onResize(g) { g.py = g.H - 64; layoutShields(g); },
    update(g, dt) {
      const P = g.ptr; g.inv -= dt; g.fire -= dt; g.ut -= dt; g.fr = (g.fr || 0);
      if (P.down) g.p.x += Kit.clamp(P.x - g.p.x, -640 * dt, 640 * dt); g.p.x = Kit.clamp(g.p.x + g.ax() * 320 * dt, 22, g.W - 22);
      if ((P.down || g.kd(' ')) && g.fire <= 0 && g.pb.length < 3) { g.pb.push({ x: g.p.x, y: g.py - 20 }); g.fire = 0.34; g.sfx('shoot'); }
      const al = g.al.filter(a => a.on); const n = al.length;
      g.st -= dt; if (g.st <= 0) { g.st = Math.max(0.035, 0.0125 * n * (1 - Math.min(0.5, g.wave * 0.03)) + 0.03); g.fr ^= 1; let edge = false; for (const a of al) { const x = ax_(g, a) + g.dir * 10; if (x < 20 || x > g.W - 20) edge = true; } if (edge) { g.dir = -g.dir; g.fy += 18; } else g.fx += g.dir * 10; g.sfx('click'); }
      g.fireT = (g.fireT || 0) - dt; if (g.fireT <= 0 && n) { g.fireT = Math.max(0.35, 1.3 - g.wave * 0.07) * (0.6 + g.rnd() * 0.8); const bottoms = new Map(); for (const a of al) { const b = bottoms.get(a.c); if (!b || a.r > b.r) bottoms.set(a.c, a); } const arr = [...bottoms.values()]; const s = g.pick(arr); g.eb.push({ x: ax_(g, s), y: ay_(g, s) + 12, v: 210 + g.wave * 9 }); }
      for (const b of g.pb) { b.y -= 760 * dt; }
      for (const b of g.eb) { b.y += b.v * dt; }
      for (const b of g.pb) { if (b.dead) continue; if (g.ufo && Math.abs(b.x - g.ufo.x) < 26 && Math.abs(b.y - g.ufo.y) < 14) { const v = [100, 200, 300][(g.ufo.k + g.wave) % 3]; g.add(v, 'u'); g.float(g.ufo.x, g.ufo.y, '+' + v, '#ff9ae0', 20); g.burst(g.ufo.x, g.ufo.y, ['#ff7ad0', '#fff'], 20, 220, 0.6, 3); g.sfx('boom'); g.ufo = null; g.ut = 14; b.dead = true; continue; }
        if (shieldHit(g, b)) { b.dead = true; continue; }
        for (const a of al) if (Math.abs(ax_(g, a) - b.x) < 17 && Math.abs(ay_(g, a) - b.y) < 15) { a.on = false; b.dead = true; const v = [30, 20, 20, 10, 10][a.r % 5] ; g.add(v, 'a'); g.burst(ax_(g, a), ay_(g, a), COLS3[a.r % 5], 12, 180, 0.5, 3); g.sfx('pop'); break; } }
      for (const b of g.eb) { if (shieldHit(g, b)) { b.dead = true; continue; } if (g.inv <= 0 && Math.abs(b.x - g.p.x) < 18 && Math.abs(b.y - g.py) < 16) { b.dead = true; hurt(g); if (g.state !== 'play') return; } }
      g.pb = g.pb.filter(b => !b.dead && b.y > -10); g.eb = g.eb.filter(b => !b.dead && b.y < g.H + 10);
      if (g.ufo) { g.ufo.x += g.ufo.v * dt; if (g.ufo.x < -40 || g.ufo.x > g.W + 40) { g.ufo = null; g.ut = 12; } } else if (g.ut <= 0 && n > 6) { const l = g.rnd() < 0.5; g.ufo = { x: l ? -30 : g.W + 30, y: 86, v: (l ? 1 : -1) * 120, k: g.RI(0, 2) }; }
      for (const a of al) if (ay_(g, a) > g.py - 34) { return g.end('Invaded'); }
      if (!n) { const b = 100 * g.wave; g.add(b, 'c'); g.float(g.W / 2, g.H * 0.4, 'WAVE CLEAR +' + b, '#7bf0a0', 22); g.sfx('line'); newWave(g); }
      g.hud = 'WAVE ' + g.wave + '   ' + '\u2665'.repeat(g.lives);
    },
    draw(g, c) {
      Art.bg(c, g.W, g.H, g.t, '#10163a', '#04060f', 'rgba(110,120,255,.06)');
      c.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 40; i++) c.fillRect((i * 97) % g.W, ((i * 53 + g.t * (6 + i % 5)) % g.H), 1.4, 1.4);
      for (const a of g.al) if (a.on) alien(c, ax_(g, a), ay_(g, a), a.r % 5, g.fr);
      c.fillStyle = '#7bd8ff'; for (const s of g.sh) for (const k of s.cells) if (k.on) c.fillRect(k.x, k.y, 5, 5);
      if (g.ufo) { const u = g.ufo; c.fillStyle = '#ff5fb8'; c.beginPath(); c.ellipse(u.x, u.y, 24, 9, 0, 0, TAU); c.fill(); c.fillStyle = '#ffd7f0'; c.beginPath(); c.ellipse(u.x, u.y - 6, 11, 8, 0, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; for (let i = -2; i <= 2; i++) c.fillRect(u.x + i * 9 - 1.5, u.y + 1, 3, 3); }
      for (const b of g.pb) { c.fillStyle = '#d8f6ff'; Art.rr(c, b.x - 2, b.y - 9, 4, 18, 2); c.fill(); }
      for (const b of g.eb) { c.strokeStyle = '#ff7a5a'; c.lineWidth = 3; c.beginPath(); for (let i = 0; i < 6; i++) { const y = b.y - 10 + i * 4; c.lineTo(b.x + (i % 2 ? 3 : -3), y); } c.stroke(); }
      if (g.state === 'play' && (g.inv <= 0 || Math.floor(g.t * 14) % 2)) ship(c, g.p.x, g.py);
    } });
  const ax_ = (g, a) => g.fx + a.c * SP, ay_ = (g, a) => g.fy + a.r * RH;
  function newWave(g) { g.wave++; g.mark('w', g.wave); const rows = Math.min(6, 4 + (g.wave > 2 ? 1 : 0) + (g.wave > 5 ? 1 : 0)); g.al = []; for (let r = 0; r < rows; r++) for (let q = 0; q < CW; q++) g.al.push({ c: q, r, on: true }); g.fx = (g.W - (CW - 1) * SP) / 2; g.fy = 112 + Math.min(g.wave - 1, 5) * 12; g.dir = 1; g.st = 0.5; g.eb = []; layoutShields(g); }
  function layoutShields(g) { g.sh = []; const y0 = g.H - 170; for (let i = 0; i < 4; i++) { const x0 = g.W * (0.14 + i * 0.24) - 27; const cells = []; for (let r = 0; r < 5; r++) for (let q = 0; q < 11; q++) { if (r === 4 && q > 2 && q < 8) continue; if (r === 0 && (q < 1 || q > 9)) continue; cells.push({ x: x0 + q * 5, y: y0 + r * 5, on: true }); } g.sh.push({ cells }); } }
  function shieldHit(g, b) { for (const s of g.sh) for (const k of s.cells) if (k.on && Math.abs(b.x - (k.x + 2.5)) < 5 && Math.abs(b.y - (k.y + 2.5)) < 7) { k.on = false; for (const o of s.cells) if (o.on && o !== k && Math.hypot(o.x - k.x, o.y - k.y) < 8 && g.rnd() < 0.45) o.on = false; return true; } return false; }
  function hurt(g) { g.lives--; g.sfx('die'); g.shake(10, 0.35); g.burst(g.p.x, g.py, ['#7bd8ff', '#fff', '#ffd24a'], 26, 250, 0.8, 4); if (g.lives <= 0) return g.end('Destroyed'); g.inv = 1.8; g.eb = []; }
  function alien(c, x, y, t, f) { const col = COLS3[t]; c.save(); c.translate(x, y); Art.orb(c, 0, 0, 14, col); c.fillStyle = Art.dark(col, 0.2); for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 8, 10); c.lineTo(d * (13 + f * 3), 17); c.lineTo(d * (9 + f * 2), 12); c.fill(); c.fillRect(d * 8 - 2, -18 + f * 2, 3, 6); } c.fillStyle = '#fff'; c.beginPath(); c.arc(-5, -2, 4, 0, TAU); c.arc(5, -2, 4, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(-5 + (f ? 1 : -1), -1, 1.8, 0, TAU); c.arc(5 + (f ? 1 : -1), -1, 1.8, 0, TAU); c.fill(); c.restore(); }
  function ship(c, x, y) { Art.shadow(c, x, y + 14, 18, 4, 0.3); const g = c.createLinearGradient(x - 20, y, x + 20, y); g.addColorStop(0, '#6fb4ff'); g.addColorStop(1, '#3a6bd8'); c.fillStyle = g; c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 8, y - 4); c.lineTo(x + 22, y + 10); c.lineTo(x + 22, y + 14); c.lineTo(x - 22, y + 14); c.lineTo(x - 22, y + 10); c.lineTo(x - 8, y - 4); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2; c.stroke(); c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(x, y + 2, 4.5, 0, TAU); c.fill(); }
})();

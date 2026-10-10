// Mole Whack - original 60-second whack-a-critter (Hub build). Short session: score attack, combos, no bombs!
Kit.run({ id: 'gl-mole-whack', title: 'MOLE WHACK', help: 'Tap the critters as they pop up (or keys 1-9)\nAvoid the bombs. 60 seconds - combos multiply', bg: '#14532d',
  init(g) { g.holes = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.holes.push({ x: 80 + c * 120, y: 230 + r * 140, up: 0, t: 0, k: null, hit: 0 }); g.time = 60; g.combo = 0; g.next = 0.6; },
  update(g, dt) {
    g.time -= dt; if (g.time <= 0) { g.time = 0; return g.end('Time!'); } const pace = 1 + (60 - g.time) / 30;
    g.next -= dt; if (g.next <= 0) { g.next = g.R(0.35, 0.9) / pace; const free = g.holes.filter(h => !h.k); if (free.length) { const h = g.pick(free); const r = g.rnd(); h.k = r < 0.12 ? 'bomb' : r < 0.22 ? 'gold' : 'mole'; h.t = g.R(0.7, 1.2) / Math.sqrt(pace); h.hit = 0; } }
    for (const h of g.holes) { if (h.k && !h.hit) { h.up = Math.min(1, h.up + dt * 8); h.t -= dt; if (h.t <= 0) { if (h.k !== 'bomb') g.combo = 0; h.k = null; } } else { h.up = Math.max(0, h.up - dt * 6); if (h.up === 0) { h.k = null; h.hit = 0; } } }
    const whack = (h) => { if (!h.k || h.hit || h.up < 0.4) { g.combo = 0; return; } h.hit = 1; if (h.k === 'bomb') { g.add(0); g.time = Math.max(0, g.time - 5); g.combo = 0; g.sfx('boom'); g.shake(10); g.flash('#ef4444'); g.float(h.x, h.y - 50, '-5s', '#ef4444', 22); return; } g.combo++; const m = Math.min(5, 1 + Math.floor(g.combo / 5)); const v = (h.k === 'gold' ? 50 : 10) * m; g.add(v, 'h'); g.float(h.x, h.y - 60, '+' + v, h.k === 'gold' ? '#fbbf24' : '#fff', 18); g.burst(h.x, h.y - 30, h.k === 'gold' ? '#fbbf24' : '#a16207', 14, 180); g.sfx(h.k === 'gold' ? 'coin' : 'thud'); g.shake(3); };
    if (g.ptr.pressed) { let hit = false; for (const h of g.holes) if (Math.abs(g.ptr.x - h.x) < 55 && g.ptr.y < h.y + 30 && g.ptr.y > h.y - 90) { whack(h); hit = true; } if (!hit) g.combo = 0; g.ham = { x: g.ptr.x, y: g.ptr.y, t: 0.12 }; }
    for (let i = 0; i < 9; i++) if (g.kd(String(i + 1))) whack(g.holes[i]);
    if (g.kd(' ')) { const h = g.holes.find(h => h.k && h.k !== 'bomb' && !h.hit && h.up > 0.5); if (h) whack(h); }
    if (g.ham) g.ham.t -= dt; g.hud = Math.ceil(g.time) + 's  x' + Math.min(5, 1 + Math.floor(g.combo / 5));
  },
  draw(g, c) {
    c.fillStyle = '#166534'; c.fillRect(0, 0, g.W, g.H); for (let i = 0; i < 40; i++) { c.fillStyle = '#15803d'; c.fillRect((i * 67) % g.W, (i * 131) % g.H, 3, 8); }
    for (const h of g.holes) { c.fillStyle = '#3f2a1d'; c.beginPath(); c.ellipse(h.x, h.y, 50, 18, 0, 0, 7); c.fill(); c.save(); c.beginPath(); c.rect(h.x - 60, h.y - 120, 120, 120); c.clip();
      if (h.k) { const y = h.y + 10 - h.up * 70; if (h.k === 'bomb') { Kit.circ(c, h.x, y, 26, '#111827'); c.fillStyle = '#f97316'; c.fillRect(h.x - 2, y - 36, 4, 12); Kit.circ(c, h.x, y - 38, 4 + Math.random() * 2, '#fde047'); } else { const col = h.k === 'gold' ? '#fbbf24' : '#92400e'; c.fillStyle = col; Kit.rr(c, h.x - 26, y - 30, 52, 70, 24); c.fill(); Kit.circ(c, h.x, y - 6, 9, '#fda4af'); if (h.hit) { c.strokeStyle = '#111'; c.lineWidth = 3; for (const s of [-1, 1]) { c.beginPath(); c.moveTo(h.x + s * 14 - 4, y - 22); c.lineTo(h.x + s * 14 + 4, y - 14); c.moveTo(h.x + s * 14 + 4, y - 22); c.lineTo(h.x + s * 14 - 4, y - 14); c.stroke(); } } else { Kit.circ(c, h.x - 12, y - 18, 5, '#111'); Kit.circ(c, h.x + 12, y - 18, 5, '#111'); } } }
      c.restore(); c.fillStyle = '#4d2f1f'; c.beginPath(); c.ellipse(h.x, h.y + 4, 52, 12, 0, 0, Math.PI); c.fill(); }
    if (g.ham && g.ham.t > 0) { c.save(); c.translate(g.ham.x, g.ham.y); c.rotate(-0.6); c.fillStyle = '#78350f'; c.fillRect(-4, 0, 8, 50); c.fillStyle = '#ef4444'; c.fillRect(-22, -14, 44, 22); c.restore(); }
    c.fillStyle = '#1d2a66'; c.fillRect(20, 60, g.W - 40, 10); c.fillStyle = g.time > 10 ? '#34d399' : '#ef4444'; c.fillRect(20, 60, (g.W - 40) * g.time / 60, 10);
  } });

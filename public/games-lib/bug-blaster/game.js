// @uses art.js
// Bug Blaster - original segmented-crawler shooter (Hub v8 rebuild). Shoot the crawler: every hit turns a segment into a
// mushroom and splits it in two. Drag to move, auto-fire while touching. Endless waves, uncapped, skill only (seeded).
(function () {
  const COLS = 15, ZONE = 6, TAU = Math.PI * 2;
  Kit.run({ id: 'gl-bug-blaster', title: 'BUG BLASTER', fill: true, minH: 640, maxH: 900, bg: '#120a24', partGrav: 0,
    help: 'Drag to move your blaster (it sits above your finger)\nHold to auto-fire\nShots split the crawler; mushrooms block it',
    init(g) { geom(g); g.m = new Map(); for (let i = 0; i < 38; i++) g.m.set(key(g.RI(0, COLS - 1), g.RI(2, g.rows - ZONE - 2)), 4); g.p = { x: g.W / 2, y: g.zy + g.S * 3 }; g.bul = []; g.wave = 0; g.lives = 3; g.inv = 0; g.fire = 0; g.chains = []; g.spider = null; g.sp = 6; g.tick = 0; g.ap = 0; newWave(g); },
    onResize(g) { geom(g); },
    update(g, dt) {
      const P = g.ptr, S = g.S, p = g.p; g.inv -= dt; g.fire -= dt;
      if (P.down) { const tx = P.x, ty = P.y - 70; p.x += Kit.clamp(tx - p.x, -700 * dt, 700 * dt); p.y += Kit.clamp(ty - p.y, -700 * dt, 700 * dt); }
      p.x = Kit.clamp(p.x + g.ax() * 300 * dt, 14, g.W - 14); p.y = Kit.clamp(p.y + g.ay() * 300 * dt, g.zy + S * 0.5, g.H - 40); p.x = Kit.clamp(p.x, 14, g.W - 14); p.y = Kit.clamp(p.y, g.zy + S * 0.5, g.H - 40);
      if ((P.down || g.kd(' ')) && g.fire <= 0 && g.bul.length < 3) { g.bul.push({ x: p.x, y: p.y - 14 }); g.fire = 0.17; g.sfx('shoot'); }
      for (const b of g.bul) { b.y -= 950 * dt; const cx = Math.floor(b.x / S), cy = Math.floor((b.y - g.top) / S), k = key(cx, cy);
        if (g.m.has(k)) { const h = g.m.get(k) - 1; b.dead = true; if (h <= 0) { g.m.delete(k); g.add(1, 'm'); g.burst(cx * S + S / 2, g.top + cy * S + S / 2, '#ff8a4a', 6, 120, 0.4, 2); } else g.m.set(k, h); g.sfx('hit'); continue; }
        for (const ch of g.chains) { const i = ch.s.findIndex(s => Math.abs(s.c * S + S / 2 - b.x) < S * 0.55 && Math.abs(g.top + s.r * S + S / 2 - b.y) < S * 0.6); if (i >= 0) { hitSeg(g, ch, i); b.dead = true; break; } }
        if (!b.dead && g.spider && Math.hypot(g.spider.x - b.x, g.spider.y - b.y) < 20) { const d = Math.hypot(g.spider.x - p.x, g.spider.y - p.y), v = d < 70 ? 900 : d < 140 ? 600 : 300; g.add(v, 's'); g.float(g.spider.x, g.spider.y - 10, '+' + v, '#ff9ae0', 18); g.burst(g.spider.x, g.spider.y, ['#ff7ad0', '#fff'], 18, 200, 0.6, 3); g.sfx('boom'); g.spider = null; g.sp = 5 + g.rnd() * 4; b.dead = true; } }
      g.bul = g.bul.filter(b => !b.dead && b.y > -20); g.chains = g.chains.filter(c => c.s.length);
      const step = Math.max(0.045, 0.13 - g.wave * 0.006); g.tick += dt; while (g.tick >= step) { g.tick -= step; moveChains(g); } g.ap = g.tick / step;
      if (g.spider) { const s = g.spider; s.t += dt; s.x += s.vx * dt; s.y += s.vy * dt; if (s.y < g.zy || s.y > g.H - 36) s.vy = -s.vy; s.vy += Math.sin(s.t * 5) * 400 * dt; const ck = key(Math.floor(s.x / S), Math.floor((s.y - g.top) / S)); if (g.m.has(ck) && g.rnd() < 0.5) g.m.delete(ck); if (s.x < -40 || s.x > g.W + 40) { g.spider = null; g.sp = 4 + g.rnd() * 4; } }
      else { g.sp -= dt; if (g.sp <= 0) { const l = g.rnd() < 0.5; g.spider = { x: l ? -20 : g.W + 20, y: g.zy + S * 2, vx: (l ? 1 : -1) * (130 + g.wave * 6), vy: 140, t: 0 }; } }
      if (g.inv <= 0) { let hit = false; for (const ch of g.chains) for (const s of ch.s) if (Math.hypot(s.c * S + S / 2 - p.x, g.top + s.r * S + S / 2 - p.y) < S * 0.62) hit = true; if (g.spider && Math.hypot(g.spider.x - p.x, g.spider.y - p.y) < 22) hit = true;
        if (hit) { g.lives--; g.sfx('die'); g.shake(10, 0.35); g.burst(p.x, p.y, ['#ffd24a', '#ff6a4a', '#fff'], 28, 260, 0.8, 4); if (g.lives <= 0) return g.end('Caught'); g.inv = 1.8; g.spider = null; g.sp = 3; g.p.x = g.W / 2; g.p.y = g.zy + S * 3; g.bul = []; } }
      if (!g.chains.length) { g.add(200 * g.wave, 'c'); g.sfx('line'); g.float(g.W / 2, g.H * 0.4, 'WAVE CLEAR +' + 200 * g.wave, '#7bf0a0', 22); newWave(g); }
      g.hud = 'WAVE ' + g.wave + '   ' + '\u2665'.repeat(g.lives);
    },
    draw(g, c) {
      const S = g.S, W = g.W, H = g.H; Art.bg(c, W, H, g.t, '#1d1040', '#08040f', 'rgba(150,100,255,.07)');
      c.fillStyle = 'rgba(120,255,160,.05)'; c.fillRect(0, g.zy, W, H - g.zy); c.strokeStyle = 'rgba(120,255,160,.2)'; c.beginPath(); c.moveTo(0, g.zy); c.lineTo(W, g.zy); c.stroke();
      for (const [k, h] of g.m) { const cx = k % 100, cy = (k / 100) | 0; shroom(c, cx * S + S / 2, g.top + cy * S + S / 2, S * 0.48, h); }
      for (const ch of g.chains) for (let i = ch.s.length - 1; i >= 0; i--) { const s = ch.s[i]; const x = (s.pc + (s.c - s.pc) * g.ap) * S + S / 2, y = g.top + (s.pr + (s.r - s.pr) * g.ap) * S + S / 2; bug(c, x, y, S * 0.5, i === 0, g.t * 10 + i); }
      if (g.spider) { const s = g.spider; c.strokeStyle = '#ff7ad0'; c.lineWidth = 2.5; for (let i = 0; i < 4; i++) for (const d of [-1, 1]) { const a = 0.5 + i * 0.35, w = Math.sin(g.t * 14 + i) * 4; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + d * 20, s.y - 12 + i * 8 + w); c.lineTo(s.x + d * 26, s.y + 6 + i * 6); c.stroke(); } Art.orb(c, s.x, s.y, 13, '#c43fa0'); c.fillStyle = '#fff'; c.fillRect(s.x - 6, s.y - 4, 4, 4); c.fillRect(s.x + 2, s.y - 4, 4, 4); }
      for (const b of g.bul) { c.fillStyle = '#fff6a8'; Art.rr(c, b.x - 2, b.y - 8, 4, 16, 2); c.fill(); }
      if (g.state === 'play' && (g.inv <= 0 || Math.floor(g.t * 14) % 2)) blaster(c, g.p.x, g.p.y);
    } });
  function key(c, r) { return r * 100 + c; }
  function geom(g) { g.S = Math.floor(g.W / COLS); g.rows = Math.floor((g.H - 90) / g.S); g.top = 78; g.zy = g.top + (g.rows - ZONE) * g.S; }
  function newWave(g) { g.wave++; g.mark('w', g.wave); g.chains = []; const len = Math.min(14, 8 + g.wave); g.chains.push(mk(g, len, 0)); const heads = Math.min(6, Math.max(0, g.wave - 2)); for (let i = 0; i < heads; i++) g.chains.push(mk(g, 1, i + 1)); }
  function mk(g, n, k) { const dir = k % 2 ? -1 : 1, s = []; for (let i = 0; i < n; i++) { const c = dir > 0 ? -i - (k ? 3 * k : 0) : COLS - 1 + i + 3 * k; s.push({ c, r: 0, pc: c, pr: 0 }); } return { s, dir, v: 1 }; }
  function moveChains(g) { const rows = g.rows;
    for (const ch of g.chains) { const h = ch.s[0]; for (const s of ch.s) { s.pc = s.c; s.pr = s.r; }
      for (let i = ch.s.length - 1; i > 0; i--) { ch.s[i].c = ch.s[i - 1].pc; ch.s[i].r = ch.s[i - 1].pr; }
      const nc = h.c + ch.dir; const blocked = (nc < 0 && h.c <= 0 || nc >= COLS && h.c >= COLS - 1) || g.m.has(key(nc, h.r));
      if (h.c < 0 || h.c >= COLS) { h.c = nc; continue; } // still entering from off-screen
      if (blocked) { let nr = h.r + ch.v; if (nr >= rows) { ch.v = -1; nr = h.r - 1; } if (nr < rows - ZONE && ch.v < 0 && h.r >= rows - ZONE - 0) { ch.v = 1; } if (nr < 0) { ch.v = 1; nr = 1; } h.r = nr; ch.dir = -ch.dir; if (h.r >= rows - 1) ch.v = -1; if (h.r <= rows - ZONE - 1 && ch.v < 0 && g.hadZone) ch.v = 1; } else h.c = nc; } }
  function hitSeg(g, ch, i) { const s = ch.s[i], S = g.S; const head = i === 0; g.add(head ? 100 : 10, 'b'); g.sfx('hit'); g.burst(s.c * S + S / 2, g.top + s.r * S + S / 2, ['#7bf07b', '#d8ff8a'], 10, 150, 0.45, 3);
    if (s.r >= 0 && s.c >= 0 && s.c < COLS && !(g.chains.some(c => c.s.some(q => q !== s && q.c === s.c && q.r === s.r)) && false)) g.m.set(key(s.c, s.r), 4);
    const tail = ch.s.splice(i + 1); ch.s.splice(i, 1); if (tail.length) g.chains.push({ s: tail, dir: ch.dir, v: ch.v }); }
  function shroom(c, x, y, r, h) { const col = ['#000', '#8a2f6a', '#c2436e', '#e8605a', '#ff8a4a'][h]; c.fillStyle = '#e9dcc4'; Art.rr(c, x - r * 0.28, y, r * 0.56, r * 0.9, 3); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(x, y + r * 0.1, r, Math.PI, 0); c.fill(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.arc(x - r * 0.4, y - r * 0.35, r * 0.18, 0, TAU); c.arc(x + r * 0.35, y - r * 0.5, r * 0.13, 0, TAU); c.fill(); }
  function bug(c, x, y, r, head, t) { c.strokeStyle = '#2c8a4e'; c.lineWidth = 2; for (const d of [-1, 1]) { c.beginPath(); c.moveTo(x + d * r * 0.6, y); c.lineTo(x + d * r * 1.1, y + 5 + Math.sin(t) * 3 * d); c.stroke(); } Art.orb(c, x, y, r, head ? '#ffd24a' : '#4fd36a'); if (head) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.15, r * 0.25, 0, TAU); c.arc(x + r * 0.35, y - r * 0.15, r * 0.25, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(x - r * 0.35, y - r * 0.1, r * 0.1, 0, TAU); c.arc(x + r * 0.35, y - r * 0.1, r * 0.1, 0, TAU); c.fill(); } }
  function blaster(c, x, y) { Art.shadow(c, x, y + 16, 14, 4, 0.3); const g = c.createLinearGradient(x - 14, y, x + 14, y); g.addColorStop(0, '#5fa8ff'); g.addColorStop(1, '#3a6bd8'); c.fillStyle = g; c.beginPath(); c.moveTo(x, y - 18); c.lineTo(x + 14, y + 12); c.lineTo(x, y + 6); c.lineTo(x - 14, y + 12); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.stroke(); c.fillStyle = '#ffe9a0'; c.beginPath(); c.arc(x, y - 2, 4, 0, TAU); c.fill(); }
})();

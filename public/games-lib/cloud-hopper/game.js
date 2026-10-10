// Cloud Hopper - original vertical bounce climber (Hub build). Art: Kenney Jumper Pack (CC0), see LICENSE-Kenney-CC0.txt
const CH = {}; let chN = 0; const CHL = ['bg_layer1', 'bg_layer2', 'bg_layer3', 'bg_layer4', 'ground_grass_small', 'ground_snow_small', 'ground_wood_small_broken', 'ground_cake_small', 'spring', 'spring_out', 'flyMan_fly', 'flyMan_still_fly', 'bunny1_jump', 'bunny1_stand', 'bunny1_hurt']; CHL.forEach(n => { const im = new Image(); im.onload = () => chN++; im.src = 'img/' + n + '.webp'; CH[n] = im; });
Kit.run({ id: 'gl-cloud-hopper', title: 'CLOUD HOPPER', help: 'Tilt with arrows / hold left or right side\nBounce up - springs, movers and breakers', bg: '#0b1240',
  init(g) { g.p = { x: 200, y: 560, vx: 0, vy: -600 }; g.cam = 0; g.top = 0; g.pl = [{ x: 160, y: 620, w: 80, t: 0 }]; g.hi = 620; while (g.hi > -800) gen(g); g.en = []; },
  update(g, dt) {
    const p = g.p; let ax = g.ax(); if (g.ptr.down) ax = g.ptr.x < g.W / 2 ? -1 : 1; p.vx = Kit.lerp(p.vx, ax * 300, Math.min(1, dt * 10)); p.x += p.vx * dt; if (p.x < -15) p.x = g.W + 15; if (p.x > g.W + 15) p.x = -15;
    p.vy += 1100 * dt; const oy = p.y; p.y += p.vy * dt;
    if (p.vy > 0) for (const q of g.pl) if (!q.gone && p.x > q.x - 10 && p.x < q.x + q.w + 10 && oy + 14 <= q.y && p.y + 14 >= q.y) {
      if (q.t === 2) { q.gone = true; g.sfx('hit'); g.burst(q.x + q.w / 2, q.y, '#a16207', 16, 120); continue; }
      p.vy = q.spring ? -1250 : -640; g.sfx(q.spring ? 'power' : 'jump'); g.burst(p.x, q.y, q.spring ? '#fbbf24' : '#fff', 8, 90, 0.4); if (q.spring) { g.shake(4); q.sprT = 0.3; } if (q.t === 3) q.gone = true; }
    if (g.ptr.pressed || g.tap()) {} // tilt game: no tap action
    for (const q of g.pl) if (q.sprT > 0) q.sprT -= dt; for (const q of g.pl) if (q.t === 1) { q.x += q.d * 80 * dt; if (q.x < 0 || q.x + q.w > g.W) q.d *= -1; }
    const target = p.y - 300; if (target < g.cam) g.cam = target; const h = Math.floor(-g.cam / 10); if (h > g.top) { g.add(h - g.top, 'h'); g.top = h; }
    while (g.hi > g.cam - 100) gen(g); g.pl = g.pl.filter(q => q.y < g.cam + g.H + 50);
    for (const e of g.en) { e.x += Math.sin(g.t * 2 + e.ph) * 60 * dt; if (Math.hypot(e.x - p.x, e.y - p.y) < 26) { if (p.vy > 0 && p.y < e.y) { e.dead = true; p.vy = -800; g.add(50, 'e'); g.float(e.x, e.y - g.cam, '+50', '#f472b6'); g.burst(e.x, e.y - g.cam, '#f472b6', 20); g.sfx('pop'); } else { g.burst(p.x, p.y - g.cam, '#ef4444', 30); return g.end('Caught by a cloud monster'); } } }
    g.en = g.en.filter(e => !e.dead && e.y < g.cam + g.H + 50);
    if (p.y - g.cam > g.H + 40) g.end('Fell');
    g.hud = Math.floor(g.top) + ' m';
  },
  draw(g, c) {
    if (chN < CHL.length) { c.fillStyle = '#cfefff'; c.fillRect(0, 0, g.W, g.H); return; }
    // parallax sky: 512px layers tiled vertically at different rates
    const L = [[CH.bg_layer1, 0.05], [CH.bg_layer2, 0.12], [CH.bg_layer3, 0.22], [CH.bg_layer4, 0.35]]; const sz = Math.max(g.W, g.H) * 1.05;
    for (const [im, f] of L) { const off = ((-g.cam * f) % sz + sz) % sz; for (let y = off - sz; y < g.H; y += sz) c.drawImage(im, (g.W - sz) / 2, y, sz, sz); }
    const PIM = [CH.ground_grass_small, CH.ground_snow_small, CH.ground_wood_small_broken, CH.ground_cake_small];
    for (const q of g.pl) { if (q.gone) continue; const y = q.y - g.cam; const im = PIM[q.t]; const h = q.w * im.height / im.width; c.drawImage(im, q.x - 4, y - 6, q.w + 8, h + 4);
      if (q.spring) { const sp = q.sprT > 0 ? CH.spring_out : CH.spring; c.drawImage(sp, q.x + q.w / 2 - 12, y - 20 - (q.sprT > 0 ? 6 : 0), 24, 24 * sp.height / sp.width); } }
    for (const e of g.en) { const y = e.y - g.cam; const im = Math.sin(g.t * 20 + e.ph) > 0 ? CH.flyMan_fly : CH.flyMan_still_fly; c.drawImage(im, e.x - 22, y - 25, 44, 44 * im.height / im.width); }
    const p = g.p, y = p.y - g.cam; const im = g.state === 'over' ? CH.bunny1_hurt : p.vy < -200 ? CH.bunny1_jump : CH.bunny1_stand; const w = 36, h = w * im.height / im.width; const sq = 1 + Kit.clamp(-p.vy / 4000, -0.12, 0.15);
    c.save(); c.translate(p.x, y + 14); c.scale((p.vx < -5 ? -1 : 1) / sq, sq); c.drawImage(im, -w / 2, -h, w, h); c.restore();
  } });
function gen(g) { const lvl = -g.hi / 1000; g.hi -= g.R(55, 70 + Math.min(70, lvl * 12)); const r = g.rnd(); const t = r < Math.min(0.25, lvl * 0.04) ? 1 : r < Math.min(0.4, 0.05 + lvl * 0.04) ? 2 : r < 0.48 ? 3 : 0; g.pl.push({ x: g.R(0, g.W - 70), y: g.hi, w: 70, t, d: 1, spring: t === 0 && g.rnd() < 0.08 }); if (t === 2) { g.pl.push({ x: g.R(0, g.W - 70), y: g.hi - 20, w: 70, t: 0, d: 1 }); } if (lvl > 1.5 && g.rnd() < 0.04 && g.en) g.en.push({ x: g.R(40, g.W - 40), y: g.hi - 40, ph: g.R(0, 6) }); }

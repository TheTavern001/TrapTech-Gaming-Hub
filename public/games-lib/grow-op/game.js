// @uses art.js
// Grow Op - endless grow-room management survival (Hub v8 portrait rebuild, cannabis theme).
// Six plants in a 2x3 tent grid: keep water and nutrients in the green band, swat pests, harvest at peak ripeness.
// A third lost plant ends the run. Timed, seeded pest waves are independent of frame rate; endless and uncapped.
Kit.run({ id: 'gl-grow-op', title: 'GROW OP', fill: true, minH: 640, maxH: 900, bg: '#06150d',
  help: 'Tap a plant to select it, then WATER / FEED\nTap bugs to swat them. HARVEST when the bar is gold.\nEndless grow cycles; 3 dead plants ends the run.',
  buttons: [{ id: 'W', label: 'WATER' }, { id: 'F', label: 'FEED' }, { id: 'H', label: 'HARVEST' }],
  init(g) { g.time = 0; g.deaths = 0; g.sel = 0; g.plants = []; for (let i = 0; i < 6; i++) g.plants.push(newPlant(g, i)); g.pests = []; g.pestTimer = 3; },
  onResize(g) { if (g.plants) for (const p of g.plants) place(g, p); },
  update(g, dt) {
    g.time += dt;
    const P = g.ptr;
    if (P.pressed && P.y < dims(g).by) {
      // One phone touch = one live pest swatted OR one plant selected, never both.
      let hit = null, dist = 30;
      for (const s of g.pests) { if (s.dead) continue; const d = Math.hypot(P.x - s.x, P.y - s.y); if (d < dist) { hit = s; dist = d; } }
      if (hit) {
        hit.dead = true;
        const host = g.plants[hit.p]; if (host) host.pests = Math.max(0, host.pests - 1); // a swatted pest stops damaging this tick
        g.add(5, 'b'); g.sfx('pop'); g.burst(hit.x, hit.y, '#a3e635', 10);
      } else { const d = dims(g); for (const p of g.plants) if (Math.abs(P.x - p.x) < d.cw / 2 && Math.abs(P.y - p.y) < d.ch / 2) { g.sel = p.i; break; } }
    }
    for (let i = 0; i < 6; i++) if (g.kd(String(i + 1))) g.sel = i; const p0 = g.plants[g.sel];
    if (g.btnP.W || g.kd('w')) { p0.water = Math.min(1.2, p0.water + 0.25); g.sfx('whoosh'); g.burst(p0.x, p0.y - 30, '#38bdf8', 10, 120); }
    if (g.btnP.F || g.kd('f')) { p0.food = Math.min(1.2, p0.food + 0.22); g.sfx('click'); g.burst(p0.x, p0.y + 10, '#fbbf24', 8, 100); }
    if (g.btnP.H || g.kd('h') || g.kd(' ')) harvest(g, p0);
    // Age existing pests first so a new wave is never born already expired after a slow frame or tab suspension.
    const counts = [0, 0, 0, 0, 0, 0];
    for (const pest of g.pests) { pest.t += dt; pest.x += Math.sin(pest.t * 7) * 30 * Math.min(dt, 0.1); if (!pest.dead && pest.t < pest.life) counts[pest.p]++; else pest.dead = true; }
    g.pests = g.pests.filter(pest => !pest.dead);
    g.pestTimer -= dt;
    let waves = 0;
    while (g.pestTimer <= 0 && waves++ < 4) {
      const interval = Math.max(0.75, 4.5 - Math.min(3.75, g.time / 190));
      g.pestTimer += interval;
      if (g.pests.length < 18) { const p = g.pick(g.plants), d = dims(g); g.pests.push({ x: p.x + g.R(-d.cw * 0.3, d.cw * 0.3), y: p.y + g.R(-d.ch * 0.35, d.ch * 0.15), p: p.i, t: 0, life: 9 + g.R(0, 5) }); counts[p.i]++; }
    }
    if (g.pestTimer <= 0) g.pestTimer = 0.75;
    for (const p of g.plants) p.pests = counts[p.i];
    // A resumed phone tab must not instantly kill plants through a huge delta.
    const careDt = Math.min(dt, 0.25);
    for (const p of g.plants) {
      p.water -= careDt * 0.045; p.food -= careDt * 0.03; const okW = p.water > 0.35 && p.water < 0.95, okF = p.food > 0.3 && p.food < 0.95;
      p.health = Kit.clamp(p.health + ((okW && okF) ? 0.04 : -0.08) * careDt - (p.pests || 0) * 0.03 * careDt, 0, 1);
      p.grow += careDt * (0.05 + 0.08 * p.health) * (okW ? 1 : 0.3);
      if (p.health <= 0) { g.float(p.x, p.y - 40, 'DIED', '#ef4444', 18); g.sfx('bad'); g.deaths++; if (g.deaths >= 3) return g.end('3 plants died'); Object.assign(p, newPlant(g, p.i)); }
    }
    g.hud = 'LOST ' + g.deaths + '/3   ' + Math.floor(g.time / 60) + ':' + String(Math.floor(g.time % 60)).padStart(2, '0');
  },
  draw(g, c) {
    const W = g.W, H = g.H, d = dims(g), T = g.t;
    const bg = c.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#12281c'); bg.addColorStop(1, '#050d09'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    for (const p of g.plants) tent(c, g, p, d, T);
    for (const s of g.pests) bug(c, s.x, s.y, T);
    c.font = '700 12px system-ui,sans-serif'; c.textAlign = 'center'; c.fillStyle = 'rgba(190,255,210,.7)'; c.fillText('Selected: plant ' + (g.sel + 1) + '   -   tap bugs to swat', W / 2, d.by - 8);
  } });
function dims(g) { const W = g.W || 400, H = g.H || 800; const top = 96, by = H - 120; return { top, by, cw: (W - 24) / 2, ch: (by - top - 8) / 3, W, H }; }
function place(g, p) { const d = dims(g), col = p.i % 2, row = Math.floor(p.i / 2); p.x = 12 + d.cw * (col + 0.5); p.y = d.top + d.ch * (row + 0.5); }
function newPlant(g, i) { const p = { i, x: 0, y: 0, water: 0.6, food: 0.6, health: 0.8, grow: 0, pests: 0 }; place(g, p); return p; }
function harvest(g, p) {
  const ripe = (p.grow - 1) / 0.6; if (p.grow < 0.8) { g.sfx('bad'); g.float(p.x, p.y - 40, 'TOO EARLY', '#9ca3af'); return; }
  const q = ripe >= 0.7 && ripe <= 1.1 ? 1 : ripe > 1.1 ? 0.6 : 0.4; const v = Math.round(100 * q * (0.5 + p.health));
  g.add(v, 'h'); g.float(p.x, p.y - 40, (q === 1 ? 'PRIME ' : '') + '+' + v, q === 1 ? '#fbbf24' : '#fff', 20); g.sfx(q === 1 ? 'power' : 'coin'); g.burst(p.x, p.y - 20, q === 1 ? '#fbbf24' : '#a3e635', 16);
  Object.assign(p, newPlant(g, p.i), { health: Math.max(0.5, p.health) });
}
function tent(c, g, p, d, T) {
  const x0 = p.x - d.cw / 2 + 4, y0 = p.y - d.ch / 2 + 2, w = d.cw - 8, h = d.ch - 4, sel = p.i === g.sel;
  Art.rr(c, x0, y0, w, h, 16); const pg = c.createLinearGradient(0, y0, 0, y0 + h); pg.addColorStop(0, sel ? '#173f2a' : '#10261b'); pg.addColorStop(1, sel ? '#0d2a1c' : '#08150e'); c.fillStyle = pg; c.fill();
  c.strokeStyle = sel ? '#34e0a1' : 'rgba(120,200,150,.22)'; c.lineWidth = sel ? 2.5 : 1.2; c.stroke();
  const lg = c.createLinearGradient(0, y0, 0, y0 + h * 0.8); lg.addColorStop(0, 'rgba(255,120,220,' + (0.2 + 0.05 * Math.sin(T * 2 + p.i)) + ')'); lg.addColorStop(1, 'rgba(255,120,220,0)');
  c.fillStyle = lg; c.beginPath(); c.moveTo(p.x - 24, y0 + 6); c.lineTo(p.x + 24, y0 + 6); c.lineTo(p.x + w * 0.42, y0 + h * 0.8); c.lineTo(p.x - w * 0.42, y0 + h * 0.8); c.fill();
  c.fillStyle = '#ffd1f4'; Art.rr(c, p.x - 24, y0 + 3, 48, 6, 3); c.fill();
  const base = y0 + h * 0.56, maxH = h * 0.42, gr = Math.min(1, p.grow), ph = 22 + gr * maxH, col = p.health > 0.5 ? '#2fd56b' : p.health > 0.25 ? '#a3e635' : '#a16207';
  Art.shadow(c, p.x, base + 18, 26, 6, 0.3); const pot = c.createLinearGradient(p.x - 24, 0, p.x + 24, 0); pot.addColorStop(0, '#9a4f26'); pot.addColorStop(1, '#6a3216'); c.fillStyle = pot; c.beginPath(); c.moveTo(p.x - 24, base); c.lineTo(p.x + 24, base); c.lineTo(p.x + 18, base + 24); c.lineTo(p.x - 18, base + 24); c.fill();
  c.strokeStyle = '#1f7a3f'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(p.x, base); c.lineTo(p.x + Math.sin(T + p.i) * 1.5, base - ph); c.stroke();
  const nodes = 3 + Math.round(gr * 3); for (let k = 1; k <= nodes; k++) { const y = base - ph * k / (nodes + 0.5), s = (0.55 + 0.45 * (1 - k / (nodes + 1))) * (0.5 + gr * 0.8) * (h / 190) * 1.3; for (const sd of [-1, 1]) leaf(c, p.x + sd * 2, y, sd, s, col, T + k + p.i); }
  const ripe = Kit.clamp((p.grow - 1) / 0.6, 0, 1.5);
  if (p.grow > 0.8) { const bc = ripe > 1.1 ? '#b8731a' : ripe > 0.7 ? '#e0c8ff' : '#8ef0a8'; for (let k = 0; k < 4; k++) Art.orb(c, p.x + (k % 2 ? 9 : -9), base - ph + 6 + k * 13, 7 + gr * 2, bc); }
  const bx = p.x - w * 0.36, bw = w * 0.72, by = base + 34;
  const bar = (y, v, ok, colr) => { c.fillStyle = '#0a120d'; Art.rr(c, bx, y, bw, 7, 3); c.fill(); c.fillStyle = 'rgba(52,211,153,.35)'; c.fillRect(bx + ok[0] * bw / 1.2, y, (ok[1] - ok[0]) * bw / 1.2, 7); c.fillStyle = colr; Art.rr(c, bx + Kit.clamp(v, 0, 1.2) * bw / 1.2 - 2, y - 2, 4, 11, 2); c.fill(); };
  bar(by, p.water, [0.35, 0.95], '#38bdf8'); bar(by + 14, p.food, [0.3, 0.95], '#fbbf24');
  c.fillStyle = '#0a120d'; Art.rr(c, bx, by + 28, bw, 7, 3); c.fill(); c.fillStyle = ripe >= 0.7 && ripe <= 1.1 ? '#fbbf24' : '#8a93a3'; Art.rr(c, bx, by + 28, Math.max(4, bw * Math.min(1, ripe / 1.1)), 7, 3); c.fill();
  c.font = '800 11px system-ui,sans-serif'; c.textAlign = 'left'; c.fillStyle = 'rgba(200,255,220,.55)'; c.fillText(String(p.i + 1), x0 + 8, y0 + 18);
  if (p.health < 0.3) { c.fillStyle = 'rgba(255,70,70,' + (0.4 + 0.3 * Math.sin(T * 8)) + ')'; c.fillText('!', x0 + w - 14, y0 + 20); }
}
function leaf(c, x, y, sd, s, col, t) { c.save(); c.translate(x, y); c.scale(sd, 1); c.rotate(-0.15 + Math.sin(t) * 0.04); c.fillStyle = col; for (let f = -2; f <= 2; f++) { c.save(); c.rotate(-0.55 + f * 0.33); c.beginPath(); c.ellipse(18 * s, 0, 18 * s * (1 - Math.abs(f) * 0.15), 3.6 * s, 0, 0, Math.PI * 2); c.fill(); c.restore(); } c.restore(); }
function bug(c, x, y, T) { c.save(); c.translate(x, y); c.strokeStyle = '#33521a'; c.lineWidth = 1.6; for (let i = -1; i <= 1; i++) for (const d of [-1, 1]) { c.beginPath(); c.moveTo(d * 4, i * 4); c.lineTo(d * (11 + Math.sin(T * 30 + i) * 2), i * 6 + 2); c.stroke(); } Art.orb(c, 0, 0, 8, '#b6f23a'); c.fillStyle = '#17250a'; c.beginPath(); c.arc(-3, -3, 1.4, 0, 6.3); c.arc(3, -3, 1.4, 0, 6.3); c.fill(); c.restore(); }

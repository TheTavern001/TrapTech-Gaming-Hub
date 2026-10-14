// Grow Op - endless grow-room management survival (Hub build, cannabis theme). Keep plants healthy and harvest; third loss ends the run.
// Six plants: keep water and nutrients in the green band, set the light cycle, swat pests, harvest at peak ripeness.
Kit.run({ id: 'gl-grow-op', title: 'GROW OP', orient: 'l', help: 'Tap a plant to select it, then WATER / FEED / SWAT\nHarvest when the trichome meter is gold.\nEndless grow cycles; 3 dead plants ends the run.', bg: '#052e16',
  buttons: [{ id: 'W', label: 'WATER' }, { id: 'F', label: 'FEED' }, { id: 'H', label: 'HARVEST' }],
  init(g) { g.time = 0; g.deaths = 0; g.sel = 0; g.plants = []; for (let i = 0; i < 6; i++) g.plants.push(newPlant(g, i)); g.pests = []; g.pestTimer = 3; },
  update(g, dt) {
    g.time += dt;
    const P = g.ptr;
    if (P.pressed && P.y < 330) {
      // Mobile-first: a pest tap must never silently change the selected
      // plant, and overlapping hit regions must not award multiple pests.
      // Pick the nearest live pest, resolve one action, then stop.
      let hit = null, dist = 26;
      for (const s of g.pests) {
        if (s.dead) continue;
        const d = Math.hypot(P.x - s.x, P.y - s.y);
        if (d < dist) { hit = s; dist = d; }
      }
      if (hit) {
        hit.dead = true;
        // A swatted pest must stop damaging its plant on this same tick.
        const host = g.plants[hit.p];
        if (host) host.pests = Math.max(0, host.pests - 1);
        g.add(5, 'b'); g.sfx('pop');
        g.burst(hit.x, hit.y, '#a3e635', 10);
      } else {
        for (const p of g.plants) if (Math.abs(P.x - p.x) < 55) { g.sel = p.i; break; }
      }
    }
    for (let i = 0; i < 6; i++) if (g.kd(String(i + 1))) g.sel = i; const p0 = g.plants[g.sel];
    if (g.btnP.W || g.kd('w')) { p0.water = Math.min(1.2, p0.water + 0.25); g.sfx('whoosh'); g.burst(p0.x, 200, '#38bdf8', 10, 120); }
    if (g.btnP.F || g.kd('f')) { p0.food = Math.min(1.2, p0.food + 0.22); g.sfx('click'); g.burst(p0.x, 260, '#fbbf24', 8, 100); }
    if (g.btnP.H || g.kd('h') || g.kd(' ')) harvest(g, p0);
    // Timed, seeded pest waves are independent of render frame frequency.
    // Unswatted pests chew for a limited time, then leave. Cap actors to
    // keep long Android/iPhone sessions bounded in CPU and retained memory.
    // Age existing pests first. New waves must not be born already expired
    // after a tab suspension or a slow phone frame.
    const counts = [0,0,0,0,0,0];
    for (const pest of g.pests) {
      pest.t += dt;
      pest.x += Math.sin(pest.t * 7) * 30 * Math.min(dt, 0.1);
      if (!pest.dead && pest.t < pest.life) counts[pest.p]++;
      else pest.dead = true;
    }
    g.pests = g.pests.filter(pest => !pest.dead);
    g.pestTimer -= dt;
    let waves = 0;
    while (g.pestTimer <= 0 && waves++ < 4) {
      const interval = Math.max(0.75, 4.5 - Math.min(3.75, g.time / 190));
      g.pestTimer += interval;
      if (g.pests.length < 18) {
        const p = g.pick(g.plants);
        g.pests.push({ x:p.x + g.R(-30, 30), y:g.R(120, 300),
          p:p.i, t:0, life:9 + g.R(0, 5) });
        counts[p.i]++;
      }
    }
    if (g.pestTimer <= 0) g.pestTimer = 0.75;
    for (const p of g.plants) p.pests = counts[p.i];
    // A resumed phone tab must not instantly kill plants through a huge delta.
    const careDt = Math.min(dt, 0.25);
    for (const p of g.plants) { p.water -= careDt * 0.045; p.food -= careDt * 0.03; const okW = p.water > 0.35 && p.water < 0.95, okF = p.food > 0.3 && p.food < 0.95; p.health = Kit.clamp(p.health + ((okW && okF) ? 0.04 : -0.08) * careDt - (p.pests || 0) * 0.03 * careDt, 0, 1);
      p.grow += careDt * (0.05 + 0.08 * p.health) * (okW ? 1 : 0.3); if (p.health <= 0) { g.float(p.x, 150, 'DIED', '#ef4444', 18); g.sfx('bad'); g.deaths++; if (g.deaths >= 3) return g.end('3 plants died'); Object.assign(p, newPlant(g, p.i)); } }

    g.hud = 'LOST ' + g.deaths + '/3  ' + Math.floor(g.time / 60) + ':' + String(Math.floor(g.time % 60)).padStart(2, '0');
  },
  draw(g, c) {
    c.fillStyle = '#1f2937'; c.fillRect(0, 0, g.W, g.H); for (let i = 0; i < 6; i++) { c.fillStyle = `rgba(251,191,36,${0.07 + 0.03 * Math.sin(g.t * 2 + i)})`; c.beginPath(); c.moveTo(70 + i * 130, 40); c.lineTo(20 + i * 130, 330); c.lineTo(120 + i * 130, 330); c.fill(); c.fillStyle = '#e5e7eb'; c.fillRect(50 + i * 130, 34, 40, 8); }
    for (const p of g.plants) { const x = p.x, base = 330, h = 40 + Math.min(1, p.grow) * 170, col = p.health > 0.5 ? '#22c55e' : p.health > 0.25 ? '#a3e635' : '#a16207';
      if (p.i === g.sel) { c.strokeStyle = '#22d3ee'; c.lineWidth = 2; c.strokeRect(x - 58, 60, 116, 300); }
      c.fillStyle = '#78350f'; c.fillRect(x - 26, base, 52, 34); c.strokeStyle = '#15803d'; c.lineWidth = 4; c.beginPath(); c.moveTo(x, base); c.lineTo(x, base - h); c.stroke();
      for (let k = 1; k <= 5; k++) { const y = base - h * k / 6, w = 14 + (6 - k) * 6 * Math.min(1, p.grow + 0.3); for (const s of [-1, 1]) { c.save(); c.translate(x, y); c.scale(s, 1); c.fillStyle = col; for (let f = -2; f <= 2; f++) { c.save(); c.rotate(-0.6 + f * 0.35); c.beginPath(); c.ellipse(w * 0.6, 0, w * 0.6, 4, 0, 0, 7); c.fill(); c.restore(); } c.restore(); } }
      const ripe = Kit.clamp((p.grow - 1) / 0.6, 0, 1.5); if (p.grow > 0.8) { for (let k = 0; k < 4; k++) Kit.circ(c, x + (k % 2 ? 8 : -8), base - h + 10 + k * 14, 8, ripe > 1.1 ? '#a16207' : ripe > 0.7 ? '#e9d5ff' : '#86efac'); }
      const bar = (y, v, ok, colr) => { c.fillStyle = '#111827'; c.fillRect(x - 40, y, 80, 7); c.fillStyle = 'rgba(52,211,153,.35)'; c.fillRect(x - 40 + ok[0] * 80 / 1.2, y, (ok[1] - ok[0]) * 80 / 1.2, 7); c.fillStyle = colr; c.fillRect(x - 40 + Kit.clamp(v, 0, 1.2) * 80 / 1.2 - 2, y - 2, 4, 11); };
      bar(372, p.water, [0.35, 0.95], '#38bdf8'); bar(386, p.food, [0.3, 0.95], '#fbbf24'); c.fillStyle = '#111827'; c.fillRect(x - 40, 400, 80, 7); c.fillStyle = ripe >= 0.7 && ripe <= 1.1 ? '#fbbf24' : '#9ca3af'; c.fillRect(x - 40, 400, 80 * Math.min(1, ripe / 1.1), 7); }
    for (const s of g.pests) { Kit.circ(c, s.x, s.y, 7, '#a3e635'); c.strokeStyle = '#3f6212'; c.beginPath(); c.moveTo(s.x - 9, s.y - 4 + Math.sin(g.t * 40) * 3); c.lineTo(s.x + 9, s.y - 4 - Math.sin(g.t * 40) * 3); c.stroke(); }
  } });
function newPlant(g, i) { return { i, x: 70 + i * 130, water: 0.6, food: 0.6, health: 0.8, grow: 0, pests: 0 }; }
function harvest(g, p) { const ripe = (p.grow - 1) / 0.6; if (p.grow < 0.8) { g.sfx('bad'); g.float(p.x, 150, 'TOO EARLY', '#9ca3af'); return; } const q = ripe >= 0.7 && ripe <= 1.1 ? 1 : ripe > 1.1 ? 0.6 : 0.4; const v = Math.round(100 * q * (0.5 + p.health)); g.add(v, 'h'); g.float(p.x, 150, (q === 1 ? 'PRIME ' : '') + '+' + v, q === 1 ? '#fbbf24' : '#fff', 20); g.sfx(q === 1 ? 'power' : 'coin'); g.burst(p.x, 200, ['#22c55e', '#fbbf24', '#e9d5ff'], 30, 200); Object.assign(p, newPlant(g, p.i)); }

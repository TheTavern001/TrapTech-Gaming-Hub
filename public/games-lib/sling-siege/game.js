// Sling Siege - original slingshot fort-toppling game (Hub build). Matter.js physics (MIT) via phys.js.
// Art: Kenney Physics Assets (CC0, see LICENSE-Kenney-CC0.txt). Endless sequence of generated forts.
// Scoring (unchanged contract): blocks 10-50 by material, targets 500, each unused shot 1000 when a fort falls.
(function () { const P = Phys, M = P.M, GY = 400, SX = 140, SY = 318;
  const IMG = {}; let nL = 0; const NAMES = []; for (const m of ['wood', 'stone', 'glass']) for (const k of ['plank', 'pillar', 'square', 'plank_d', 'pillar_d', 'square_d']) NAMES.push(m + '_' + k);
  NAMES.push('alienGreen_round', 'alienBlue_round', 'alienPink_round', 'debrisWood_1', 'debrisStone_1', 'debrisGlass_1', 'starGold', 'bg', 'grass', 'dirt', 'bush'); for (const n of NAMES) { const im = new Image(); im.onload = () => nL++; im.src = 'img/' + n + '.webp'; IMG[n] = im; }
  const BV = { wood: 20, stone: 50, glass: 10 }; const HP = { wood: 32, stone: 70, glass: 9 }; const DEN = { wood: 0.0016, stone: 0.0034, glass: 0.0012 };
  function blk(g, x, y, w, h, m, shape) { const b = P.box(g, x, y, w, h, { hp: HP[m], v: BV[m], d: DEN[m] }, { kind: m, friction: 0.7 }); b.gl.w = w; b.gl.h = h; b.gl.shape = shape; b.gl.m = m; return b; }
  function alien(g, x, y, i) { const b = P.ball(g, x, y, 15, { hp: 11, v: 500, d: 0.0014 }, { kind: 'target' }); b.gl.spr = ['alienGreen_round', 'alienBlue_round', 'alienPink_round'][i % 3]; return b; }
  function fort(g) { if (g.eng) M.Composite.clear(g.world, false); else P.init(g, { minImpact: 2.4, onHit: (a, b, rv) => { if (rv > 5) { g.shake(Math.min(8, rv * 0.5)); if (rv > 8) g.sfx('hit'); } } });
    g.onBreak = (b) => { const d = b.gl; const s = { wood: 'debrisWood_1', stone: 'debrisStone_1', glass: 'debrisGlass_1' }[d.m]; for (let i = 0; i < 5; i++) g.deb.push({ x: b.position.x, y: b.position.y, vx: g.R(-120, 120), vy: g.R(-220, -60), r: g.R(0, 6), vr: g.R(-8, 8), l: 1.2, s: s || 'debrisStone_1' }); if (d.kind === 'target') { g.float(b.position.x, b.position.y - 24, '+500', '#ffe14a', 22); g.sfx('power'); g.stars.push({ x: b.position.x, y: b.position.y, l: 1 }); } };
    g.lv++; g.mark('l', g.lv); P.ground(g, 400, GY + 40, 1600, 80, 'rgba(0,0,0,0)'); g.deb = g.deb || []; g.stars = g.stars || [];
    const towers = Math.min(3, 1 + Math.floor(g.lv / 2)); let x = 470; const mats = g.lv < 2 ? ['wood', 'glass'] : ['wood', 'wood', 'stone', 'glass']; let ai = 0; g.tg = [];
    for (let t = 0; t < towers && x < 760; t++) { const w = g.R(80, 110); const fl = Math.min(4, 1 + g.RI(1, 1 + Math.floor(g.lv / 2))); let y = GY;
      for (let f = 0; f < fl; f++) { const m = g.pick(mats), ph = g.R(58, 78); blk(g, x + 8, y - ph / 2, 15, ph, m, 'pillar'); blk(g, x + w - 8, y - ph / 2, 15, ph, m, 'pillar'); if (g.rnd() < 0.7 || f === 0) g.tg.push(alien(g, x + w / 2, y - 16, ai++)); y -= ph; blk(g, x + w / 2, y - 7, w + 12, 14, g.pick(mats), 'plank'); y -= 14; }
      if (g.rnd() < 0.5) { blk(g, x + w / 2, y - 15, 30, 30, g.pick(mats), 'square'); } x += w + g.R(30, 70); }
    for (let i = 0; i < 120; i++) M.Engine.update(g.eng, 1000 / 60); g.breaks = 0; for (const b of P.bodies(g)) if (b.gl && b.gl.hp != null) { b.gl.dead = false; b.gl.hp = b.gl.max = b.gl.kind === 'target' ? 11 : HP[b.gl.m]; }
    g.shots = g.tg.length + 2; g.ready = true; g.proj = null; }
  Kit.run({ id: 'gl-sling-siege', title: 'SLING SIEGE', orient: 'l', bg: '#bfe6f5', help: 'Drag back from the slingshot and let go\nTopple the forts and pop every lurker - spare shots are bonus',
    init(g) { g.lv = 0; g.deb = []; g.stars = []; g.trail = []; fort(g); },
    update(g, dt) { P.step(g, dt); const v = P.reap(g, p => p); if (v) { g.add(v, 'b'); g.sfx('thud'); }
      for (const d of g.deb) { d.vy += 600 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.r += d.vr * dt; d.l -= dt; } g.deb = g.deb.filter(d => d.l > 0); for (const s of g.stars) s.l -= dt * 0.8; g.stars = g.stars.filter(s => s.l > 0);
      if (g.proj && g.proj.speed > 2) g.trail.push({ x: g.proj.position.x, y: g.proj.position.y, l: 1 }); for (const t of g.trail) t.l -= dt * 0.7; g.trail = g.trail.filter(t => t.l > 0);
      const Q = g.ptr; if (g.ready && Q.pressed && Math.hypot(Q.x - SX, Q.y - SY) < 90) g.drag = true;
      if (g.drag && Q.down) { let dx = Q.x - SX, dy = Q.y - SY; const L = Math.hypot(dx, dy), mx = 95; if (L > mx) { dx *= mx / L; dy *= mx / L; } g.aim = { dx, dy }; }
      let fire = null; if (g.drag && Q.released) { g.drag = false; if (g.aim && Math.hypot(g.aim.dx, g.aim.dy) > 15) fire = g.aim; g.aim = null; } if (g.ready && g.kd(' ')) fire = { dx: -80, dy: 45 };
      if (fire && g.shots > 0) { const k = 0.23; const b = P.ball(g, SX + fire.dx, SY + fire.dy, 14, { d: 0.006, hp: null, v: 0 }, { kind: 'shot', restitution: 0.25 }); M.Body.setVelocity(b, { x: -fire.dx * k, y: -fire.dy * k }); g.proj = b; g.shots--; g.ready = false; g.wait = 5; g.sfx('whoosh'); g.trail = []; g.snap = 0.25; }
      g.snap = Math.max(0, (g.snap || 0) - dt);
      if (!g.ready) { g.wait -= dt; const moving = P.bodies(g).some(b => !b.isStatic && b.speed > 0.5 && b.gl); if (g.wait <= 0 || (g.wait < 3.6 && !moving)) { g.ready = true; for (const b of P.bodies(g)) if (b.gl && b.gl.kind === 'shot') P.remove(g, b); g.proj = null; } }
      for (const b of P.bodies(g)) if (!b.isStatic && b.gl && !b.gl.dead && (b.position.y > 520 || b.position.x < -60 || b.position.x > 880)) { if (b.gl.kind === 'target') { b.gl.dead = true; g.breaks++; g.onBreak(b); } else P.remove(g, b); }
      if (g.ready) { const alive = g.tg.filter(t => !t.gl.dead).length; if (!alive) { const bonus = 1000 * g.shots; if (bonus) g.add(bonus, 's'); g.float(400, 140, 'FORT DOWN!' + (bonus ? ' +' + bonus : ''), '#ffe14a', 28); g.sfx('line'); fort(g); } else if (g.shots <= 0) return g.end('Out of shots'); }
      g.hud = 'FORT ' + g.lv + '   SHOTS ' + g.shots + '   LURKERS ' + g.tg.filter(t => !t.gl.dead).length; },
    draw(g, c) { if (nL < NAMES.length) { c.fillStyle = '#bfe6f5'; c.fillRect(0, 0, g.W, g.H); return; }
      c.drawImage(IMG.bg, 0, -170, 800, 800); for (const bx of [40, 300, 420, 760]) c.drawImage(IMG.bush, bx, GY - 26, 32, 32); for (let x = 0; x < 800; x += 35) { c.drawImage(IMG.grass, x, GY - 4, 35, 35); c.drawImage(IMG.dirt, x, GY + 30, 35, 35); }
      // slingshot back fork + band
      const ax = g.aim ? SX + g.aim.dx : SX, ay = g.aim ? SY + g.aim.dy : SY; const wood = c.createLinearGradient(SX - 20, 0, SX + 20, 0); wood.addColorStop(0, '#8a4b1c'); wood.addColorStop(1, '#5b2e0e');
      c.strokeStyle = wood; c.lineCap = 'round'; c.lineWidth = 11; c.beginPath(); c.moveTo(SX, GY + 2); c.lineTo(SX, SY + 30); c.lineTo(SX + 14, SY - 6); c.stroke();
      if (g.ready || g.aim) { c.strokeStyle = '#3b1d0a'; c.lineWidth = 5; c.beginPath(); c.moveTo(SX + 14, SY - 4); c.lineTo(ax, ay); c.stroke(); }
      // bodies with sprites
      for (const b of P.bodies(g)) { const d = b.gl; if (!d || b.isStatic) continue; c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle); if (d.flash > 0) c.filter = 'brightness(1.8)';
        if (d.kind === 'target') { const r = b.circleRadius; c.drawImage(IMG[d.spr], -r * 1.15, -r * 1.15, r * 2.3, r * 2.3); }
        else if (d.kind === 'shot') { const r = b.circleRadius; const gr = c.createRadialGradient(-4, -5, 2, 0, 0, r); gr.addColorStop(0, '#9be36a'); gr.addColorStop(1, '#2f7d34'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, -3, 3.4, 0, 7); c.arc(5, -3, 3.4, 0, 7); c.fill(); c.fillStyle = '#123'; c.beginPath(); c.arc(-3, -2.5, 1.6, 0, 7); c.arc(6, -2.5, 1.6, 0, 7); c.fill(); c.fillStyle = '#3e9e4c'; c.beginPath(); c.ellipse(0, -r - 2, 3, 6, 0.3, 0, 7); c.fill(); }
        else if (d.m) { const dmg = d.max && d.hp < d.max * 0.55 ? '_d' : ''; const im = IMG[d.m + '_' + d.shape + dmg]; c.drawImage(im, -d.w / 2 - 1, -d.h / 2 - 1, d.w + 2, d.h + 2); }
        c.restore(); }
      // projectile resting in the pouch
      if (g.ready && g.shots > 0) { c.save(); c.translate(ax, ay); const r = 14, gr = c.createRadialGradient(-4, -5, 2, 0, 0, r); gr.addColorStop(0, '#9be36a'); gr.addColorStop(1, '#2f7d34'); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-4, -3, 3.4, 0, 7); c.arc(5, -3, 3.4, 0, 7); c.fill(); c.fillStyle = '#123'; c.beginPath(); c.arc(-3, -2.5, 1.6, 0, 7); c.arc(6, -2.5, 1.6, 0, 7); c.fill(); c.restore(); }
      if (g.ready || g.aim) { c.strokeStyle = '#4a2410'; c.lineWidth = 5; c.beginPath(); c.moveTo(ax, ay); c.lineTo(SX - 12, SY - 4); c.stroke(); }
      c.strokeStyle = wood; c.lineWidth = 11; c.beginPath(); c.moveTo(SX, SY + 30); c.lineTo(SX - 12, SY - 6); c.stroke();
      for (const t of g.trail) { c.globalAlpha = t.l * 0.8; c.fillStyle = '#fff'; c.beginPath(); c.arc(t.x, t.y, 3 + 2 * t.l, 0, 7); c.fill(); } c.globalAlpha = 1;
      if (g.aim) { const k = 0.23; let x = ax, y = ay, vx = -g.aim.dx * k, vy = -g.aim.dy * k; c.fillStyle = 'rgba(255,255,255,.9)'; for (let i = 0; i < 70; i++) { vy += 0.278 * 0.5; x += vx * 0.5 * 1.0; y += vy * 0.5; vy += 0.278 * 0.5; if (i % 5 === 0) { c.beginPath(); c.arc(x, y, 3 - i * 0.03, 0, 7); c.fill(); } } }
      for (const d of g.deb) { c.save(); c.globalAlpha = Math.min(1, d.l * 2); c.translate(d.x, d.y); c.rotate(d.r); c.drawImage(IMG[d.s], -10, -10, 20, 20); c.restore(); }
      for (const s of g.stars) { c.save(); c.globalAlpha = s.l; c.translate(s.x, s.y - (1 - s.l) * 50); c.rotate((1 - s.l) * 4); c.drawImage(IMG.starGold, -16, -16, 32, 32); c.restore(); }
      for (let i = 0; i < g.shots - (g.ready ? 1 : 0) && i < 8; i++) { const x = SX - 40 - i * 24, y = GY - 11; c.fillStyle = '#2f7d34'; c.beginPath(); c.arc(x, y, 10, 0, 7); c.fill(); c.fillStyle = '#9be36a'; c.beginPath(); c.arc(x - 3, y - 3, 4, 0, 7); c.fill(); }
    } });
})();

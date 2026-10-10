// Castle Crush - original trebuchet siege on procedural forts (Hub build, Matter.js MIT) // @uses vendor/matter.min.js @uses phys.js
(function () { const P = Phys, M = P.M, GY = 420;
Kit.run({ id: 'gl-castle-crush', title: 'CASTLE CRUSH', orient: 'l', bg: '#7dd3fc', help: 'Drag back from the trebuchet and release to fling\nKnock out every crowned king - unused stones are bonus',
  init(g) { g.lvl = 0; g.trail = []; g.onHit = (a, b, rv) => { if (rv > 6) { g.shake(Math.min(10, rv * 0.6)); const p = a.position; g.burst(p.x, p.y, ['#d6c3a5', '#a8a29e'], Math.min(16, rv | 0), 140); if (rv > 9) g.sfx('hit'); } }; g.onBreak = b => { if (b.gl.kind === 'target') { g.float(b.position.x, b.position.y - 20, 'KING +' + b.gl.v, '#fbbf24', 18); g.sfx('power'); } }; build(g); },
  update(g, dt) {
    P.step(g, dt); for (const b of P.bodies(g)) if (b.gl && b.gl.kind === 'shot' && b.speed > 3) g.trail.push({ x: b.position.x, y: b.position.y, l: 1 }); for (const t of g.trail) t.l -= dt * 2.5; g.trail = g.trail.filter(t => t.l > 0); const v = P.reap(g, p => p); if (v) { g.add(v, 'b'); g.sfx('thud'); } const P0 = g.ptr;
    if (g.ready && P0.down && Math.hypot(P0.sx - 90, P0.sy - 360) < 140) { g.aim = { dx: Kit.clamp(P0.sx - P0.x, 0, 200), dy: Kit.clamp(P0.sy - P0.y, -200, 120) }; }
    let fire = null; if (g.ready && P0.released && g.aim) { fire = g.aim; g.aim = null; } if (g.ready && g.kd(' ')) fire = { dx: 150, dy: 90 };
    if (fire && g.shots > 0) { const p = Math.hypot(fire.dx, fire.dy) / 200; const a = Math.atan2(fire.dy, fire.dx); const s = P.ball(g, 100, 330, 14, { d: 0.02 }, { c: '#334155', kind: 'shot' }); M.Body.setVelocity(s, { x: Math.cos(a) * 26 * p, y: -Math.sin(a) * 26 * p }); g.shots--; g.ready = false; g.wait = 3.5; g.sfx('whoosh'); g.arm = 0.4; }
    if (!g.ready) { g.wait -= dt; const moving = P.bodies(g).some(b => !b.isStatic && b.speed > 0.6 && b.gl && b.gl.kind !== 'shot'); if (g.wait <= 0 || (g.wait < 2.5 && !moving)) { g.ready = true; for (const b of P.bodies(g)) if (b.gl && b.gl.kind === 'shot') P.remove(g, b); } }
    for (const b of P.bodies(g)) if (!b.isStatic && (b.position.y > 600 || b.position.x < -50 || b.position.x > 900) && b.gl && !b.gl.dead) { if (b.gl.kind === 'target') { b.gl.dead = true; g.breaks++; g.onBreak(b); } else if (b.gl.kind !== 'shot') P.remove(g, b); }
    g.arm = Math.max(0, (g.arm || 0) - dt);
    if (g.ready) { const alive = g.kings.filter(k => !k.gl.dead).length; if (!alive) { g.add(500 * g.shots + 200 * g.lvl, 'w'); g.float(400, 150, 'CASTLE DOWN! +' + (500 * g.shots + 200 * g.lvl), '#fbbf24', 26); g.sfx('line'); build(g); } else if (g.shots <= 0) return g.end('Out of stones'); }
    g.hud = 'CASTLE ' + g.lvl + '  STONES ' + g.shots + '  KINGS ' + g.kings.filter(k => !k.gl.dead).length;
  },
  draw(g, c) {
    const sky = c.createLinearGradient(0, 0, 0, 450); sky.addColorStop(0, '#1e6fd9'); sky.addColorStop(0.6, '#7cc4f4'); sky.addColorStop(1, '#fde8c8'); c.fillStyle = sky; c.fillRect(0, 0, g.W, g.H);
    const sun = c.createRadialGradient(640, 90, 10, 640, 90, 160); sun.addColorStop(0, 'rgba(255,250,220,1)'); sun.addColorStop(0.15, 'rgba(255,236,170,.8)'); sun.addColorStop(1, 'rgba(255,236,170,0)'); c.fillStyle = sun; c.fillRect(440, 0, 360, 300);
    for (let i = 0; i < 5; i++) { const x = ((i * 230 + g.t * (8 + i * 3)) % 1100) - 150, y = 50 + (i * 37) % 110; c.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, dy, r] of [[0, 0, 26], [24, -10, 30], [52, 0, 24], [26, 8, 26]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, 7); c.fill(); } }
    const hills = (col, base, amp, f, ph) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 450); for (let x = 0; x <= 800; x += 20) c.lineTo(x, base - Math.sin(x * f + ph) * amp - Math.sin(x * f * 2.7 + ph) * amp * 0.3); c.lineTo(800, 450); c.fill(); };
    hills('#93b6d8', 300, 60, 0.006, 1); hills('#6f9e6a', 360, 30, 0.01, 2); hills('#4f8a3c', 395, 18, 0.017, 4);
    const gr = c.createLinearGradient(0, GY, 0, 450); gr.addColorStop(0, '#5fa83a'); gr.addColorStop(0.15, '#3f7d26'); gr.addColorStop(1, '#2b5418'); c.fillStyle = gr; c.fillRect(0, GY, g.W, 50); c.fillStyle = '#7cc84a'; c.fillRect(0, GY, g.W, 3);
    P.draw(g, c);
    c.save(); c.translate(90, 380); c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 10; c.shadowOffsetY = 5; const wd = c.createLinearGradient(-30, 0, 30, 0); wd.addColorStop(0, '#8a4b1c'); wd.addColorStop(1, '#5b2e0e'); c.fillStyle = wd; Kit.rr(c, -36, 0, 72, 14, 4); c.fill(); Kit.circ(c, -26, 18, 8, '#3f2410'); Kit.circ(c, 26, 18, 8, '#3f2410');
    c.strokeStyle = '#6b3a14'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(-22, 2); c.lineTo(0, -62); c.lineTo(22, 2); c.stroke(); c.shadowBlur = 0; c.translate(0, -60);
    const ang = g.arm > 0 ? -0.6 + g.arm * 3 : g.aim ? 0.9 : 0.6; c.rotate(ang); c.fillStyle = '#a8662a'; Kit.rr(c, -64, -4, 100, 8, 3); c.fill(); c.fillStyle = '#475569'; Kit.rr(c, 26, -12, 18, 22, 3); c.fill(); Kit.circ(c, 0, 0, 5, '#fbbf24'); c.restore();
    if (g.trail) for (const t of g.trail) { c.globalAlpha = t.l; Kit.circ(c, t.x, t.y, 6 * t.l, '#e2e8f0'); } c.globalAlpha = 1;
    if (g.aim) { const p = Math.hypot(g.aim.dx, g.aim.dy) / 200, a = Math.atan2(g.aim.dy, g.aim.dx); let x = 100, y = 330, vx = Math.cos(a) * 26 * p, vy = -Math.sin(a) * 26 * p; c.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 40; i++) { vy += 0.28; x += vx; y += vy; if (i % 3 === 0) c.fillRect(x - 2, y - 2, 4, 4); } }
  } });
function build(g) { if (g.eng) M.Composite.clear(g.world, false); else P.init(g, { onHit: (a, b, rv) => g.onHit(a, b, rv) }); g.lvl++; g.mark('l', g.lvl); P.ground(g, 400, GY + 40, 1400, 80, 'rgba(0,0,0,0)');
  g.kings = P.fort(g, 420, 780, GY, { targets: { hp: 10, v: 300, crown: true }, maxFloors: Math.min(4, 1 + Math.ceil(g.lvl / 2)), mats: g.lvl > 2 ? ['wood', 'stone', 'stone', 'glass'] : ['wood', 'wood', 'glass'] });
  if (!g.kings.length) g.kings.push(P.target(g, 600, GY - 13, { hp: 10, v: 300, crown: true })); g.shots = Math.max(3, 2 + g.kings.length); g.ready = true; }
})();

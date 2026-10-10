// Shared Matter.js helpers for the physics games (original code, MIT). Needs vendor/matter.min.js (MIT, liabru).
// Bodies carry b.gl = { c: colour, hp, v: score value, kind }. Impacts (relative speed x mass) damage bodies with hp.
(function () {
  const M = window.Matter, P = window.Phys = { M };
  P.MAT = { wood: { c: '#b45309', hp: 30, v: 10, d: 0.0015 }, stone: { c: '#64748b', hp: 80, v: 25, d: 0.003 }, glass: { c: '#7dd3fc', hp: 10, v: 5, d: 0.001 }, steel: { c: '#94a3b8', hp: 200, v: 50, d: 0.005 }, car: { c: '#ef4444', hp: 60, v: 40, d: 0.002 } };
  P.init = function (g, o) { o = o || {}; const eng = M.Engine.create({ gravity: { y: o.gy == null ? 1 : o.gy }, positionIterations: 8, velocityIterations: 6 }); g.eng = eng; g.world = eng.world; g.cam = { x: 0, y: 0, z: 1 }; g.breaks = 0;
    M.Events.on(eng, 'collisionStart', ev => { for (const pr of ev.pairs) { const a = pr.bodyA.parent, b = pr.bodyB.parent; const rv = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y); if (rv < (o.minImpact || 2.2)) continue; P.hurt(g, a, rv * Math.min(b.isStatic ? 3 : b.mass, 12)); P.hurt(g, b, rv * Math.min(a.isStatic ? 3 : a.mass, 12)); if (o.onHit) o.onHit(a, b, rv); } });
    return eng; };
  P.hurt = function (g, b, dmg) { const d = b.gl; if (!d || d.hp == null || d.dead || b.isStatic && !d.breakStatic) return; d.hp -= dmg; d.flash = 0.15; if (d.hp <= 0) { d.dead = true; g.breaks++; if (g.onBreak) g.onBreak(b); } };
  P.box = function (g, x, y, w, h, mat, opt) { const m = typeof mat === 'string' ? P.MAT[mat] : mat || {}; const b = M.Bodies.rectangle(x, y, w, h, Object.assign({ density: m.d || 0.0015, friction: 0.6, restitution: 0.05 }, opt)); b.gl = { c: (opt && opt.c) || m.c || '#9ca3af', hp: m.hp, v: m.v || 0, kind: (opt && opt.kind) || (typeof mat === 'string' ? mat : 'box') }; M.Composite.add(g.world, b); return b; };
  P.ball = function (g, x, y, r, mat, opt) { const m = typeof mat === 'string' ? P.MAT[mat] : mat || {}; const b = M.Bodies.circle(x, y, r, Object.assign({ density: m.d || 0.002, friction: 0.4, restitution: 0.2 }, opt)); b.gl = { c: (opt && opt.c) || m.c || '#e5e7eb', hp: m.hp, v: m.v || 0, kind: (opt && opt.kind) || 'ball', r }; M.Composite.add(g.world, b); return b; };
  P.ground = function (g, x, y, w, h, c) { const b = M.Bodies.rectangle(x, y, w, h, { isStatic: true, friction: 0.9 }); b.gl = { c: c || '#365314' }; M.Composite.add(g.world, b); return b; };
  P.poly = function (g, pts, c, opt) { const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length; const b = M.Bodies.fromVertices(cx, cy, [pts], Object.assign({ isStatic: true, friction: 0.9 }, opt)); b.gl = { c: c || '#365314' }; M.Composite.add(g.world, b); return b; };
  P.joint = function (g, a, b, o) { const k = M.Constraint.create(Object.assign({ bodyA: a, bodyB: b, stiffness: 0.9, length: undefined }, o)); M.Composite.add(g.world, k); return k; };
  P.remove = function (g, b) { M.Composite.remove(g.world, b, true); };
  P.step = function (g, dt) { const n = 2; for (let i = 0; i < n; i++) M.Engine.update(g.eng, Math.min(dt, 1 / 30) * 1000 / n); for (const b of M.Composite.allBodies(g.world)) if (b.gl && b.gl.flash) b.gl.flash = Math.max(0, b.gl.flash - dt); };
  P.bodies = (g) => M.Composite.allBodies(g.world);
  // remove dead bodies with a burst; returns total score value
  P.reap = function (g, toScreen) { let v = 0; for (const b of P.bodies(g)) if (b.gl && b.gl.dead && !b.gl.gone) { b.gl.gone = true; v += b.gl.v || 0; const s = toScreen(b.position); g.burst(s.x, s.y, [b.gl.c, '#fff'], 10, 160); P.remove(g, b); } return v; };
  P.view = (g) => ({ x: (p) => (p.x - g.cam.x) * g.cam.z, y: (p) => (p.y - g.cam.y) * g.cam.z, s: (p) => ({ x: (p.x - g.cam.x) * g.cam.z, y: (p.y - g.cam.y) * g.cam.z }), w: (p) => ({ x: p.x / g.cam.z + g.cam.x, y: p.y / g.cam.z + g.cam.y }) });
  // illustrated material textures (generated once): wood grain, stone bricks, frosted glass, riveted steel
  const PAT = {}; P.pattern = function (c, kind, base) { const key = kind + base; if (PAT[key] !== undefined) return PAT[key]; const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 64, 64); gr.addColorStop(0, base); gr.addColorStop(1, shade(base, -0.18)); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    if (kind === 'wood') { x.strokeStyle = shade(base, -0.3); x.globalAlpha = 0.45; for (let i = 0; i < 9; i++) { x.lineWidth = 1 + (i % 3) * 0.6; x.beginPath(); x.moveTo(0, i * 7 + 3); x.bezierCurveTo(20, i * 7 + 6, 44, i * 7, 64, i * 7 + 3); x.stroke(); } x.globalAlpha = 0.5; x.fillStyle = shade(base, -0.35); x.beginPath(); x.ellipse(40, 30, 5, 2.5, 0, 0, 7); x.fill(); }
    else if (kind === 'stone') { x.strokeStyle = shade(base, -0.35); x.lineWidth = 2; for (let r = 0; r < 4; r++) { x.beginPath(); x.moveTo(0, r * 16); x.lineTo(64, r * 16); x.stroke(); for (let k = 0; k < 3; k++) { const cx = (k * 24 + (r % 2) * 12) % 64; x.beginPath(); x.moveTo(cx, r * 16); x.lineTo(cx, r * 16 + 16); x.stroke(); } } x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 40; i++) x.fillRect(Math.random() * 64, Math.random() * 64, 2, 2); }
    else if (kind === 'glass') { x.globalAlpha = 0.5; x.strokeStyle = '#fff'; x.lineWidth = 3; x.beginPath(); x.moveTo(8, 56); x.lineTo(28, 8); x.moveTo(22, 60); x.lineTo(40, 16); x.stroke(); }
    else if (kind === 'steel' || kind === 'car') { x.fillStyle = 'rgba(0,0,0,.35)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) x.fillRect(6 + i * 16, 6 + j * 16, 3, 3); }
    else { PAT[key] = null; return null; }
    return (PAT[key] = c.createPattern(cv, 'repeat')); };
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, gg = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, a = Math.abs(f); r = Math.round((t - r) * a + r); gg = Math.round((t - gg) * a + gg); b = Math.round((t - b) * a + b); return '#' + ((1 << 24) + (r << 16) + (gg << 8) + b).toString(16).slice(1); }
  P.shade = shade;
  P.draw = function (g, c, filter) { c.save(); c.scale(g.cam.z, g.cam.z); c.translate(-g.cam.x, -g.cam.y);
    for (const b of P.bodies(g)) { if (!b.gl || (filter && !filter(b))) continue; const d = b.gl; const parts = b.parts.length > 1 ? b.parts.slice(1) : [b];
      for (const p of parts) { c.beginPath(); if (b.circleRadius && parts.length === 1) c.arc(b.position.x, b.position.y, b.circleRadius, 0, 7); else { const v = p.vertices; c.moveTo(v[0].x, v[0].y); for (let i = 1; i < v.length; i++) c.lineTo(v[i].x, v[i].y); c.closePath(); }
        const pt = d.c[0] === '#' && d.c.length === 7 ? P.pattern(c, d.kind, d.c) : null; if (!b.isStatic) c.save();
        if (b.circleRadius && parts.length === 1 && !pt && d.c[0] === '#' && d.c.length === 7) { const r = b.circleRadius, gr = c.createRadialGradient(b.position.x - r * 0.35, b.position.y - r * 0.4, r * 0.1, b.position.x, b.position.y, r); gr.addColorStop(0, shade(d.c, 0.45)); gr.addColorStop(1, shade(d.c, -0.3)); c.fillStyle = d.flash > 0 ? '#fff' : gr; }
        else if (pt) { const m = new DOMMatrix().translate(b.position.x, b.position.y).rotate(b.angle * 57.2958); pt.setTransform(m); c.fillStyle = d.flash > 0 ? '#fff' : pt; } else c.fillStyle = d.flash > 0 ? '#fff' : d.c;
        c.fill(); if (!b.isStatic) { c.restore(); c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 2 / g.cam.z; c.stroke(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1 / g.cam.z; c.stroke(); } }
      if (d.hp != null && d.max == null) d.max = d.hp; if (d.hp != null && d.max && d.hp < d.max * 0.6 && !b.circleRadius) { c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(b.position.x - 6, b.position.y - 6); c.lineTo(b.position.x + 2, b.position.y); c.lineTo(b.position.x - 2, b.position.y + 6); c.stroke(); }
      if (d.face) d.face(c, b); }
    for (const k of M.Composite.allConstraints(g.world)) { if (!k.gl) continue; const a = k.bodyA ? M.Vector.add(k.bodyA.position, M.Vector.rotate(k.pointA, k.bodyA.angle - (k.angleA || 0))) : k.pointA, bb = k.bodyB ? M.Vector.add(k.bodyB.position, M.Vector.rotate(k.pointB, k.bodyB.angle - (k.angleB || 0))) : k.pointB; c.strokeStyle = k.gl.c || '#e5e7eb'; c.lineWidth = k.gl.w || 3; c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(bb.x, bb.y); c.stroke(); }
    c.restore(); };
  // simple ragdoll (head, torso, arms, legs) - returns {parts, head, torso}
  P.ragdoll = function (g, x, y, s, col, group) { s = s || 1; const grp = group || M.Body.nextGroup(true); const o = (c) => ({ collisionFilter: { group: grp }, c, friction: 0.5 }); const mk = (dx, dy, w, h, c, hp) => { const b = P.box(g, x + dx * s, y + dy * s, w * s, h * s, { hp: hp || 40, v: 0, d: 0.002 }, o(c)); b.gl.kind = 'rag'; return b; };
    const head = P.ball(g, x, y - 30 * s, 9 * s, { d: 0.002, hp: 30 }, o('#fcd9b6')); head.gl.kind = 'head';
    const torso = mk(0, -6, 14, 30, col), ua = [mk(-11, -12, 6, 16, col), mk(11, -12, 6, 16, col)], ul = [mk(-4, 20, 7, 20, '#1e3a8a'), mk(4, 20, 7, 20, '#1e3a8a')];
    const J = (a, b, pa, pb) => P.joint(g, a, b, { pointA: { x: pa[0] * s, y: pa[1] * s }, pointB: { x: pb[0] * s, y: pb[1] * s }, stiffness: 0.95, length: 0 });
    J(torso, head, [0, -15], [0, 9]); J(torso, ua[0], [-7, -12], [0, -7]); J(torso, ua[1], [7, -12], [0, -7]); J(torso, ul[0], [-4, 15], [0, -9]); J(torso, ul[1], [4, 15], [0, -9]);
    return { head, torso, parts: [head, torso, ...ua, ...ul], group: grp }; };
})();
(function () { const P = window.Phys, M = P.M;
  // procedural fort: towers of pillars + beams, random materials, optional targets on floors. Settles before play.
  P.fort = function (g, x0, x1, gy, o) { o = o || {}; const mats = o.mats || ['wood', 'wood', 'stone', 'glass']; const targets = [];
    let x = x0; while (x < x1 - 60) { const w = g.R(70, 120), floors = g.RI(1, o.maxFloors || 3); const mat = g.pick(mats); let y = gy;
      for (let f = 0; f < floors; f++) { const ph = g.R(45, 70); P.box(g, x + 6, y - ph / 2, 12, ph, mat); P.box(g, x + w - 6, y - ph / 2, 12, ph, mat); if (o.targets && g.rnd() < 0.55) targets.push(P.target(g, x + w / 2, y - 13, o.targets)); y -= ph; P.box(g, x + w / 2, y - 6, w + 10, 12, g.pick(mats)); y -= 12; }
      if (o.roof !== false && g.rnd() < 0.6) { const b = M.Bodies.fromVertices(x + w / 2, y - 16, [[{ x: 0, y: 30 }, { x: w / 2 + 6, y: 0 }, { x: w + 12, y: 30 }]], { density: 0.0015 }); b.gl = { c: '#991b1b', hp: 30, v: 10 }; M.Composite.add(g.world, b); }
      x += w + g.R(10, 40); }
    for (let i = 0; i < 90; i++) M.Engine.update(g.eng, 1000 / 60); g.breaks = 0; for (const b of P.bodies(g)) if (b.gl && b.gl.hp != null) { if (b.gl.dead) { b.gl.dead = false; } b.gl.hp = b.gl.max = (P.MAT[b.gl.kind] || {}).hp || b.gl.hp; }
    return targets; };
  P.target = function (g, x, y, t) { const b = P.ball(g, x, y, 12, { hp: t.hp || 12, v: t.v || 300, d: 0.0015 }, { c: t.c || '#22c55e', kind: 'target' }); b.gl.face = (c, b) => { c.fillStyle = '#111'; c.beginPath(); c.arc(b.position.x - 4, b.position.y - 2, 2, 0, 7); c.arc(b.position.x + 4, b.position.y - 2, 2, 0, 7); c.fill(); if (t.crown) { c.fillStyle = '#fbbf24'; c.fillRect(b.position.x - 7, b.position.y - 18, 14, 6); } }; return b; };
})();

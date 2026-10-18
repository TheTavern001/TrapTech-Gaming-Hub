// Hill Hauler - original hill-climb driving (Hub build). Matter.js (MIT) rigid-body car: sprung suspension, wheel motor,
// air pitch control, fixed 120 Hz step with render interpolation. Coins: Kenney Physics Assets (CC0). Everything else code-drawn.
(function () { const M = window.Matter; const DT = 1 / 120;
  const IMG = {}; for (const n of ['coinGold']) { const i = new Image(); i.src = 'img/' + n + '.webp'; IMG[n] = i; }
  function hgt(x) { const k = x / 900; const amp = 40 + Math.min(170, x / 55); return 330 + Math.sin(x * 0.004) * amp * 0.6 + Math.sin(x * 0.011 + 1) * amp * 0.35 + Math.sin(x * 0.0017) * amp + Math.sin(x * 0.023) * 8 * Math.min(1, k); }
  const SEG = 30;
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, a = Math.abs(f); return 'rgb(' + Math.round((t - r) * a + r) + ',' + Math.round((t - g) * a + g) + ',' + Math.round((t - b) * a + b) + ')'; }
  function build(g) { const eng = M.Engine.create({ gravity: { y: 1 }, positionIterations: 10, velocityIterations: 8 }); g.eng = eng; g.segs = new Map(); g.segHi = -SEG * 10;
    const grp = M.Body.nextGroup(true); const x0 = 160, y0 = hgt(x0) - 60;
    g.ch = M.Bodies.rectangle(x0, y0, 112, 26, { collisionFilter: { group: grp }, density: 0.0022, friction: 0.5, chamfer: { radius: 8 } });
    g.wh = [-40, 42].map(dx => M.Bodies.circle(x0 + dx, y0 + 26, 19, { collisionFilter: { group: grp }, density: 0.0016, friction: 1.4, frictionStatic: 4, restitution: 0.05 }));
    g.sp = g.wh.map((w, i) => M.Constraint.create({ bodyA: g.ch, pointA: { x: i ? 42 : -40, y: 14 }, bodyB: w, length: 14, stiffness: 0.16, damping: 0.18 }));
    g.sp2 = g.wh.map((w, i) => M.Constraint.create({ bodyA: g.ch, pointA: { x: i ? 12 : -12, y: 0 }, bodyB: w, stiffness: 0.12, damping: 0.1 }));
    M.Composite.add(eng.world, [g.ch, ...g.wh, ...g.sp, ...g.sp2]); terrain(g, x0); }
  function terrain(g, cx) { while (g.segHi < cx + 1400) { const a = g.segHi, b = a + SEG; const ya = hgt(a), yb = hgt(b); const v = [{ x: a, y: ya }, { x: b, y: yb }, { x: b, y: Math.max(ya, yb) + 140 }, { x: a, y: Math.max(ya, yb) + 140 }];
      const body = M.Bodies.fromVertices((a + b) / 2, 0, [v], { isStatic: true, friction: 1.2 }); M.Body.setPosition(body, { x: body.position.x + (a - body.bounds.min.x), y: body.position.y + (Math.min(ya, yb) - body.bounds.min.y) }); M.Composite.add(g.eng.world, body); g.segs.set(a, body); g.segHi = b; }
    for (const [a, body] of g.segs) if (a < cx - 700) { M.Composite.remove(g.eng.world, body); g.segs.delete(a); } }
  Kit.run({ id: 'gl-hill-hauler', title: 'HILL HAULER', fill: true, minH: 560, maxH: 900, help: 'Hold right side / Right arrow = gas, left side / Left = brake\nGrab fuel cans, land flips for bonus, don\'t land on your head', bg: '#8fd3f4',
    buttons: [{ id: 'B', key: 'ArrowLeft', label: 'BRAKE' }, { id: 'G', key: 'ArrowRight', label: 'GAS' }],
    init(g) { build(g); g.fuel = 1; g.cam = 0; g.camY = 0; g.dist = 0; g.items = []; for (let x = 600; x < 60000; x += g.R(300, 520)) g.items.push({ x, k: (x % 2400 < 520 && x > 1500) || g.rnd() < 0.12 ? 'f' : 'c' }); g.rot = 0; g.air = 0; g.acc = 0; g.prev = null; g.dust = []; g.ground = 2; },
    update(g, dt) {
      let gas = (g.keys.ArrowRight || g.keys.d ? 1 : 0), brake = (g.keys.ArrowLeft || g.keys.a ? 1 : 0); if (g.ptr.down) { if (g.ptr.x > g.W / 2) gas = 1; else brake = 1; } if (g.fuel <= 0) gas = 0;
      g.acc += Math.min(dt, 0.1); g.prev = { x: g.ch.position.x, y: g.ch.position.y, a: g.ch.angle, w: g.wh.map(w => ({ x: w.position.x, y: w.position.y, a: w.angle })) };
      while (g.acc >= DT) { g.acc -= DT;
        let gr = 0; for (const w of g.wh) { w.gnd = w.position.y + 19 >= hgt(w.position.x) - 3; if (w.gnd) gr++; }
        const tgt = gas ? 0.5 : brake ? -0.35 : null; for (const w of g.wh) if (tgt !== null) M.Body.setAngularVelocity(w, w.angularVelocity + (tgt - w.angularVelocity) * (gas ? 0.08 : 0.12)); else M.Body.setAngularVelocity(w, w.angularVelocity * 0.995);
        const pitch = (brake - gas) * (gr ? 0.00025 : 0.0034); M.Body.setAngularVelocity(g.ch, g.ch.angularVelocity + pitch);
        M.Engine.update(g.eng, DT * 1000); g.ground = gr; }
      g.alpha = g.acc / DT;
      const ang = g.ch.angle, cx = g.ch.position.x, cy = g.ch.position.y;
      if (!g.ground) { g.air += dt; g.rot += ang - (g.lastA == null ? ang : g.lastA); } else { if (Math.abs(g.rot) > Math.PI * 1.7) { const n = Math.round(Math.abs(g.rot) / (Math.PI * 2)) || 1; g.add(100 * n, 'f'); g.float(g.W / 2, 120, (n > 1 ? n + 'x ' : '') + 'FLIP +' + 100 * n, '#ffd23f', 26); g.sfx('power'); } else if (g.air > 1.2) { g.add(20, 'a'); g.float(g.W / 2, 140, 'AIR +20', '#7df9ff'); } g.rot = 0; g.air = 0; } g.lastA = ang;
      const hx = cx + Math.cos(ang) * 6 + Math.sin(ang) * 40, hy = cy + Math.sin(ang) * 6 - Math.cos(ang) * 40; if (hy + 9 > hgt(hx)) { g.shake(12, 0.4); g.burst(hx - g.cam, hy - g.camY, ['#ff5a4a', '#ffd23f', '#fff'], 34, 220); g.sfx('boom'); return g.end('Landed on your head'); }
      g.fuel -= dt * (0.04 + gas * 0.028); const spd = Math.hypot(g.ch.velocity.x, g.ch.velocity.y); if (g.fuel <= 0 && spd < 0.15 && g.ground) return g.end('Out of fuel');
      terrain(g, cx); g.cam = Kit.lerp(g.cam, cx - 130 - Math.min(80, g.ch.velocity.x * 8), Math.min(1, dt * 4)); g.camY = Kit.lerp(g.camY, cy - g.H * 0.52, Math.min(1, dt * 3));
      const m = Math.floor((cx - 160) / 10); if (m > g.dist) { g.add(m - g.dist, 'm'); g.dist = m; }
      for (const it of g.items) if (!it.got && Math.abs(it.x - cx) < 50 && Math.abs(hgt(it.x) - 40 - cy) < 70) { it.got = true; if (it.k === 'f') { g.fuel = 1; g.sfx('power'); g.float(it.x - g.cam, hgt(it.x) - 60 - g.camY, 'FUEL', '#ff5a4a'); } else { g.add(5, 'c'); g.sfx('coin'); g.burst(it.x - g.cam, hgt(it.x) - 40 - g.camY, ['#ffd23f', '#fff'], 8, 120, 0.4); } }
      if (gas) for (const w of g.wh) if (w.gnd && g.rnd() < 0.5) g.dust.push({ x: w.position.x - 14, y: w.position.y + 16, vx: -40 - g.rnd() * 60, vy: -20 - g.rnd() * 40, l: 0.6 }); for (const d of g.dust) { d.x += d.vx * dt; d.y += d.vy * dt; d.l -= dt; } g.dust = g.dust.filter(d => d.l > 0);
      if (gas && g.frames % 6 === 0) Kit.sfx('engine', Math.min(1, spd / 12));
      g.hud = g.dist + ' m';
    },
    draw(g, c) { const W = g.W, H = g.H, cam = g.cam, cy0 = g.camY;
      const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#4aa8e8'); sky.addColorStop(0.7, '#bfe6f7'); sky.addColorStop(1, '#f4f0d8'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      const sun = c.createRadialGradient(W * 0.8, 70, 5, W * 0.8, 70, 120); sun.addColorStop(0, 'rgba(255,252,225,1)'); sun.addColorStop(0.2, 'rgba(255,240,180,.6)'); sun.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = sun; c.fillRect(W * 0.8 - 120, 0, 240, 200);
      for (let i = 0; i < 6; i++) { const x = ((i * 190 - cam * 0.05) % 1140 + 1140) % 1140 - 120, y = 40 + (i * 29) % 80; c.fillStyle = 'rgba(255,255,255,.85)'; for (const [dx, dy, r] of [[0, 0, 18], [18, -8, 22], [40, 0, 17], [20, 6, 18]]) { c.beginPath(); c.arc(x + dx, y + dy, r, 0, 7); c.fill(); } }
      const layer = (f, base, amp, fr, col, top) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 10) { const wx = x + cam * f; c.lineTo(x, base - cy0 * f * 0.5 - Math.abs(Math.sin(wx * fr)) * amp - Math.sin(wx * fr * 2.3) * amp * 0.3); } c.lineTo(W, H); c.fill(); if (top) { c.strokeStyle = top; c.lineWidth = 2; c.stroke(); } };
      layer(0.12, 230, 110, 0.004, '#9ab8d6'); layer(0.25, 270, 70, 0.007, '#7fa6a8'); layer(0.45, 300, 45, 0.012, '#5e9466');
      { // snow caps on far mountains + parallax pine forest + birds (v8 art)
        c.fillStyle = 'rgba(255,255,255,.85)'; for (let k = -1; k < 6; k++) { const px = ((k * 210 - cam * 0.12) % 1260 + 1260) % 1260 - 120, py = 120 + ((k * 37) % 40); c.beginPath(); c.moveTo(px - 26, py + 28); c.lineTo(px, py - 8); c.lineTo(px + 26, py + 28); c.lineTo(px + 12, py + 22); c.lineTo(px + 2, py + 30); c.lineTo(px - 10, py + 22); c.closePath(); c.fill(); }
        for (let i = 0; i < 26; i++) { const wx = i * 58 + (i * 37 % 23), px = ((wx - cam * 0.55) % 1508 + 1508) % 1508 - 60, hh = 38 + (i * 13 % 26), by = 345 - cy0 * 0.27 - Math.abs(Math.sin((px + cam * 0.55) * 0.012)) * 22; c.fillStyle = i % 3 ? '#2f6b3c' : '#285c35'; for (let L = 0; L < 3; L++) { const w = 22 - L * 5, y2 = by - hh + L * hh * 0.28; c.beginPath(); c.moveTo(px, y2 - hh * 0.35); c.lineTo(px + w, y2 + hh * 0.35); c.lineTo(px - w, y2 + hh * 0.35); c.closePath(); c.fill(); } c.fillStyle = '#4a3320'; c.fillRect(px - 2, by - 2, 4, 8); }
        c.strokeStyle = '#2a3a4a'; c.lineWidth = 1.6; for (let i = 0; i < 3; i++) { const bx = ((i * 260 + g.t * 26 - cam * 0.08) % 640 + 640) % 640 - 100, by2 = 70 + i * 22 + Math.sin(g.t * 2 + i) * 6, fl = Math.sin(g.t * 9 + i) * 3; c.beginPath(); c.moveTo(bx - 7, by2 - 3 + fl); c.lineTo(bx, by2); c.lineTo(bx + 7, by2 - 3 + fl); c.stroke(); } }
      c.save(); c.translate(-cam, -cy0);
      // ground: dirt body with strata, grass lip
      const x0 = Math.floor(cam / 8) * 8 - 8, x1 = cam + W + 16; c.beginPath(); c.moveTo(x0, cy0 + H + 10); for (let x = x0; x <= x1; x += 8) c.lineTo(x, hgt(x)); c.lineTo(x1, cy0 + H + 10); c.closePath();
      const dg = c.createLinearGradient(0, cy0 + 200, 0, cy0 + H); dg.addColorStop(0, '#9a6236'); dg.addColorStop(1, '#5b3519'); c.fillStyle = dg; c.fill();
      c.save(); c.clip(); c.fillStyle = 'rgba(60,30,10,.25)'; for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) for (let k = 0; k < 4; k++) { const sx = x + ((x * 7 + k * 31) % 50), sy = hgt(sx) + 30 + k * 34 + ((x + k * 13) % 17); c.beginPath(); c.ellipse(sx, sy, 7 + k % 3 * 3, 4, 0, 0, 7); c.fill(); } c.restore();
      c.beginPath(); for (let x = x0; x <= x1; x += 8) c.lineTo(x, hgt(x) + 3); c.strokeStyle = '#3f8a2a'; c.lineWidth = 16; c.lineJoin = 'round'; c.stroke(); c.beginPath(); for (let x = x0; x <= x1; x += 8) c.lineTo(x, hgt(x) - 1); c.strokeStyle = '#78c84a'; c.lineWidth = 7; c.stroke();
      for (let x = Math.floor(x0 / 46) * 46; x < x1; x += 46) { const h = ((x * 2654435761) >>> 0) / 4294967296, y = hgt(x + h * 20); const px = x + h * 20; // grass tufts, flowers, rocks, fence
        if (h < 0.35) { c.strokeStyle = '#4fa233'; c.lineWidth = 2; for (let k = -2; k <= 2; k++) { c.beginPath(); c.moveTo(px + k * 2, y); c.quadraticCurveTo(px + k * 3, y - 8, px + k * 4 + 2, y - 11 - (k & 1) * 3); c.stroke(); } }
        else if (h < 0.5) { c.strokeStyle = '#3b8a2b'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px, y); c.lineTo(px, y - 9); c.stroke(); c.fillStyle = ['#ff6fa8', '#ffd23f', '#fff', '#b78cff'][Math.floor(h * 100) % 4]; c.beginPath(); c.arc(px, y - 10, 3, 0, 7); c.fill(); c.fillStyle = '#e8a010'; c.beginPath(); c.arc(px, y - 10, 1.1, 0, 7); c.fill(); }
        else if (h < 0.62) { c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(px + 2, y + 2, 14, 4, 0, 0, 7); c.fill(); const rg = c.createLinearGradient(px - 10, y - 14, px + 10, y); rg.addColorStop(0, '#b4b0a8'); rg.addColorStop(1, '#6b6760'); c.fillStyle = rg; c.beginPath(); c.moveTo(px - 12, y + 1); c.lineTo(px - 8, y - 9); c.lineTo(px + 2, y - 13); c.lineTo(px + 11, y - 6); c.lineTo(px + 13, y + 1); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.stroke(); }
        else if (h < 0.7) { c.fillStyle = '#8a5a30'; c.fillRect(px - 2, y - 20, 4, 20); c.fillRect(px + 22, y - 20 - 2, 4, 22); c.fillStyle = '#b07a44'; c.save(); c.translate(px, y); c.rotate(Math.atan2(hgt(px + 24) - y, 24)); c.fillRect(0, -16, 25, 3); c.fillRect(0, -8, 25, 3); c.restore(); } }
      for (let m = Math.ceil(cam / 1000) * 1000; m < cam + W; m += 1000) { const x = m + 160, y = hgt(x); c.fillStyle = '#7a4a24'; c.fillRect(x - 2, y - 46, 4, 46); c.fillStyle = '#f2e6c4'; Kit.rr(c, x - 26, y - 64, 52, 22, 4); c.fill(); c.strokeStyle = '#7a4a24'; c.lineWidth = 2; Kit.rr(c, x - 26, y - 64, 52, 22, 4); c.stroke(); c.fillStyle = '#3a2408'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(Math.round(m / 10) + ' m', x, y - 53); }
      for (let m = Math.ceil(cam / 1700) * 1700 + 850; m < cam + W + 200; m += 1700) { const x = m, y = hgt(x); c.fillStyle = '#5a5a5a'; c.fillRect(x - 3, y - 110, 6, 110); c.fillStyle = '#1f6b3a'; Kit.rr(c, x - 70, y - 160, 140, 58, 6); c.fill(); c.fillStyle = '#ffe9a8'; c.font = 'bold 15px system-ui'; c.fillText('\u2618 HIGH COUNTRY', x, y - 140); c.font = 'bold 11px system-ui'; c.fillStyle = '#fff'; c.fillText('DISPENSARY 2 km  \u00b7  21+', x, y - 118); }
      for (const it of g.items) { if (it.got || it.x < cam - 40 || it.x > cam + W + 40) continue; const x = it.x, y = hgt(x) - 40 + Math.sin(g.t * 3 + x) * 3;
        if (it.k === 'f') { c.save(); c.translate(x, y); c.rotate(-0.1); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 6; const fg = c.createLinearGradient(-12, 0, 12, 0); fg.addColorStop(0, '#ff6a4a'); fg.addColorStop(1, '#b51e14'); c.fillStyle = fg; Kit.rr(c, -12, -15, 24, 30, 4); c.fill(); c.shadowBlur = 0; c.strokeStyle = '#5a0a05'; c.lineWidth = 2; Kit.rr(c, -12, -15, 24, 30, 4); c.stroke(); c.fillStyle = '#333'; c.fillRect(4, -21, 6, 7); c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(-7, -8); c.lineTo(7, 8); c.moveTo(7, -8); c.lineTo(-7, 8); c.stroke(); c.restore(); }
        else { const s = Math.abs(Math.cos(g.t * 3 + x * 0.01)); c.drawImage(IMG.coinGold, x - 12 * s, y - 12, 24 * s + 0.5, 24); } }
      for (const d of g.dust) { c.globalAlpha = d.l * 0.7; c.fillStyle = '#c9a77a'; c.beginPath(); c.arc(d.x, d.y, 4 + (0.6 - d.l) * 12, 0, 7); c.fill(); } c.globalAlpha = 1;
      const al = g.alpha || 0, P = g.prev; const lerp = (a, b) => a + (b - a) * al; const px = P ? lerp(P.x, g.ch.position.x) : g.ch.position.x, py = P ? lerp(P.y, g.ch.position.y) : g.ch.position.y, pa = P ? lerp(P.a, g.ch.angle) : g.ch.angle;
      g.wh.forEach((w, i) => { const wx = P ? lerp(P.w[i].x, w.position.x) : w.position.x, wy = P ? lerp(P.w[i].y, w.position.y) : w.position.y; c.strokeStyle = '#444'; c.lineWidth = 5; c.beginPath(); c.moveTo(px + Math.cos(pa) * (i ? 42 : -40) - Math.sin(pa) * 8, py + Math.sin(pa) * (i ? 42 : -40) + Math.cos(pa) * 8); c.lineTo(wx, wy); c.stroke(); });
      c.save(); c.translate(px, py); c.rotate(pa); car(c, g);
      c.restore();
      g.wh.forEach((w, i) => { const wx = P ? lerp(P.w[i].x, w.position.x) : w.position.x, wy = P ? lerp(P.w[i].y, w.position.y) : w.position.y; wheel(c, wx, wy, w.angle); });
      c.restore();
      // fuel gauge
      c.save(); c.translate(g.W - 60, 100); c.fillStyle = 'rgba(20,20,30,.55)'; c.beginPath(); c.arc(0, 0, 38, Math.PI, 0); c.closePath(); c.fill(); c.lineWidth = 6; c.strokeStyle = '#ff5a4a'; c.beginPath(); c.arc(0, 0, 30, Math.PI, Math.PI * 1.25); c.stroke(); c.strokeStyle = '#ffd23f'; c.beginPath(); c.arc(0, 0, 30, Math.PI * 1.25, Math.PI * 1.5); c.stroke(); c.strokeStyle = '#5fd36a'; c.beginPath(); c.arc(0, 0, 30, Math.PI * 1.5, Math.PI * 2); c.stroke();
      const fa = Math.PI + Math.PI * Math.max(0, g.fuel); c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(fa) * 26, Math.sin(fa) * 26); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 4, 0, 7); c.fill(); c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.fillText('FUEL', 0, -10); c.restore();
    } });
  function car(c, g) { car0(c, g); c.save(); c.fillStyle = '#f8fafc'; c.beginPath(); c.arc(6, -3, 7.5, 0, 7); c.fill(); c.strokeStyle = '#111'; c.lineWidth = 1.4; c.stroke(); c.fillStyle = '#111'; c.font = 'bold 10px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('7', 6, -2.5);
    c.fillStyle = '#242424'; c.beginPath(); c.arc(-64, -6, 11, 0, 7); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#9aa'; c.beginPath(); c.arc(-64, -6, 4, 0, 7); c.fill();
    c.strokeStyle = '#d1d5db'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(60, 8); c.lineTo(68, 2); c.lineTo(68, -8); c.stroke(); c.beginPath(); c.moveTo(68, -2); c.lineTo(60, -2); c.stroke();
    c.fillStyle = '#2a2a2a'; c.fillRect(-4, -23, 26, 4); c.fillStyle = '#fde68a'; for (let i = 0; i < 4; i++) c.fillRect(-2 + i * 6, -24, 4, 3);
    c.fillStyle = 'rgba(70,40,15,.55)'; for (const [mx, my, mr] of [[-40, 8, 5], [-30, 5, 3], [-48, 2, 3.5], [30, 9, 4], [42, 5, 2.5], [-20, 9, 3]]) { c.beginPath(); c.ellipse(mx, my, mr * 1.4, mr, 0, 0, 7); c.fill(); }
    c.restore(); }
  function car0(c, g) { c.save(); c.shadowColor = 'rgba(0,0,0,.35)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
    const bg = c.createLinearGradient(0, -24, 0, 14); bg.addColorStop(0, '#ff7a4a'); bg.addColorStop(0.5, '#e8401e'); bg.addColorStop(1, '#a8240c'); c.fillStyle = bg; c.beginPath(); c.moveTo(-58, -4); c.lineTo(-54, -18); c.lineTo(-20, -20); c.lineTo(-12, -14); c.lineTo(34, -14); c.lineTo(46, -6); c.lineTo(60, -4); c.lineTo(60, 10); c.lineTo(-58, 12); c.closePath(); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.strokeStyle = '#4a1005'; c.lineWidth = 2.2; c.stroke(); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-52, -16, 30, 3); c.fillStyle = '#2a2a2a'; Kit.rr(c, -60, 8, 122, 6, 3); c.fill(); c.fillStyle = '#ffe9a8'; Kit.rr(c, 54, -3, 7, 6, 2); c.fill();
    // cannabis decal
    c.save(); c.translate(-30, 0); c.fillStyle = '#2f9e4a'; for (let i = -2; i <= 2; i++) { c.save(); c.rotate(i * 0.5); c.beginPath(); c.ellipse(0, -5, 1.6, 5.5 - Math.abs(i), 0, 0, 7); c.fill(); c.restore(); } c.restore();
    // roll cage + driver
    c.strokeStyle = '#2b2b2b'; c.lineWidth = 3.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(-14, -14); c.lineTo(-10, -48); c.lineTo(18, -48); c.lineTo(30, -14); c.stroke();
    c.fillStyle = '#2f6fd0'; Kit.rr(c, -6, -34, 16, 22, 5); c.fill(); c.strokeStyle = '#13305a'; c.lineWidth = 1.6; c.stroke(); c.strokeStyle = '#f1c9a0'; c.lineWidth = 4; c.beginPath(); c.moveTo(6, -26); c.lineTo(22, -20); c.stroke();
    const hg = c.createRadialGradient(0, -44, 1, 2, -40, 11); hg.addColorStop(0, '#fff'); hg.addColorStop(0.3, '#ffd23f'); hg.addColorStop(1, '#c08a00'); c.fillStyle = hg; c.beginPath(); c.arc(2, -40, 9.5, 0, 7); c.fill(); c.strokeStyle = '#5a3a00'; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#1b2a3a'; Kit.rr(c, 4, -44, 9, 6, 2); c.fill();
    c.strokeStyle = '#555'; c.lineWidth = 3; c.beginPath(); c.arc(24, -18, 6, Math.PI, Math.PI * 1.8); c.stroke(); c.restore(); }
  function wheel(c, x, y, a) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = '#1b1b1f'; c.beginPath(); c.arc(0, 0, 20, 0, 7); c.fill(); c.fillStyle = '#2c2c32'; for (let i = 0; i < 14; i++) { c.save(); c.rotate(i / 14 * 6.283); c.fillRect(-2.5, -21.5, 5, 4); c.restore(); }
    const rg = c.createRadialGradient(-3, -3, 1, 0, 0, 11); rg.addColorStop(0, '#f2f2f2'); rg.addColorStop(1, '#8a8f98'); c.fillStyle = rg; c.beginPath(); c.arc(0, 0, 10.5, 0, 7); c.fill(); c.fillStyle = '#555'; for (let i = 0; i < 5; i++) { c.save(); c.rotate(i / 5 * 6.283); c.beginPath(); c.arc(0, -6, 1.8, 0, 7); c.fill(); c.restore(); } c.fillStyle = '#333'; c.beginPath(); c.arc(0, 0, 3, 0, 7); c.fill(); c.restore(); }
})();

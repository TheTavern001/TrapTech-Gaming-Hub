(function () { const r = Kit.run; Kit.run = function (d) { const o = d.draw; d.draw = function (g, c) { o.apply(this, arguments); c.save(); try { POST(g, c); } catch (e) {} c.restore(); }; Kit.run = r; return r.call(this, d); }; function POST(g, c) {
const t = g.t, cx = 195, cy = 664;
  // drain guardian: glowing alien that blinks and watches
  c.save(); c.translate(cx, cy); const bl = Math.sin(t * 1.7) > 0.96; c.globalCompositeOperation = 'lighter'; const gl = c.createRadialGradient(0, 0, 4, 0, 0, 52); gl.addColorStop(0, 'rgba(180,90,255,.35)'); gl.addColorStop(1, 'rgba(180,90,255,0)'); c.fillStyle = gl; c.beginPath(); c.arc(0, 0, 52, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over';
  const hg = c.createRadialGradient(-6, -8, 2, 0, 0, 30); hg.addColorStop(0, '#9dffb0'); hg.addColorStop(1, '#1f7a52'); c.fillStyle = hg; c.beginPath(); c.ellipse(0, 0, 26, 20, 0, 0, 7); c.fill(); c.strokeStyle = '#073b2a'; c.lineWidth = 2; c.stroke(); c.strokeStyle = '#2fd18a'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-8, -18); c.quadraticCurveTo(-14, -30, -8 + Math.sin(t * 4) * 3, -36); c.moveTo(8, -18); c.quadraticCurveTo(14, -30, 8 + Math.sin(t * 4 + 1) * 3, -36); c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-8 + Math.sin(t * 4) * 3, -36, 3, 0, 7); c.arc(8 + Math.sin(t * 4 + 1) * 3, -36, 3, 0, 7); c.fill();
  c.fillStyle = '#fff'; if (!bl) { c.beginPath(); c.ellipse(-9, -2, 7, 8, 0, 0, 7); c.ellipse(9, -2, 7, 8, 0, 0, 7); c.fill(); c.fillStyle = '#220a3a'; c.beginPath(); c.arc(-9 + Math.sin(t) * 2, -1, 3.2, 0, 7); c.arc(9 + Math.sin(t) * 2, -1, 3.2, 0, 7); c.fill(); } else { c.fillRect(-15, -2, 12, 2); c.fillRect(3, -2, 12, 2); }
  c.fillStyle = '#052a1c'; c.beginPath(); c.arc(0, 10, 8, 0.1, Math.PI - 0.1); c.fill(); c.fillStyle = '#fff'; for (let k = -2; k <= 2; k++) c.fillRect(k * 3 - 1, 10.5, 2, 2.5); c.restore();
} })(); // v8 scenery+sprite overlay
// Neon Flipper - original pinball table (Hub build). Custom sub-stepped circle-vs-capsule physics (fixed 1/600 s steps), moving-flipper impulses.
// Pop bumpers, slingshots, a 3-target drop bank, 3 rollover lanes (multiplier), ball save, endless: extra ball every 40k.
(function () {
  const BR = 8.5, GRAV = 1150, STEP = 1 / 600; let TABLE = null; const touch = { l: new Set(), r: new Set() };
  const segs = []; const S = (ax, ay, bx, by, o) => segs.push({ ax, ay, bx, by, r: 0, e: 0.45, ...o });
  // outer shell: walls + top arc
  S(22, 690, 22, 200); for (let i = 0; i < 20; i++) { const a0 = Math.PI + i / 20 * Math.PI, a1 = Math.PI + (i + 1) / 20 * Math.PI; S(200 + Math.cos(a0) * 178, 200 + Math.sin(a0) * 178, 200 + Math.cos(a1) * 178, 200 + Math.sin(a1) * 178); }
  S(378, 200, 378, 690); S(350, 690, 350, 250); // plunger lane wall
  S(22, 470, 120, 594); S(350, 470, 280, 594); // funnels to flippers
  const sl1 = { ax: 58, ay: 440, bx: 100, by: 528, kick: 380 }, sl2 = { ax: 314, ay: 440, bx: 272, by: 528, kick: 380 }; S(sl1.ax, sl1.ay, sl1.bx, sl1.by, sl1); S(sl2.ax, sl2.ay, sl2.bx, sl2.by, sl2); S(58, 440, 58, 500); S(58, 500, 100, 528); S(314, 440, 314, 500); S(314, 500, 272, 528);
  S(112, 95, 112, 125, { r: 3 }); S(172, 85, 172, 125, { r: 3 }); S(228, 85, 228, 125, { r: 3 }); S(288, 95, 288, 125, { r: 3 }); // rollover lane guides
  const tg = [0, 1, 2].map(i => { const t = { ax: 25, ay: 290 + i * 30, bx: 25, by: 312 + i * 30, r: 3, e: 0.5, tgt: i }; segs.push(t); return t; });
  const bumps = [{ x: 150, y: 210, r: 22 }, { x: 250, y: 210, r: 22 }, { x: 200, y: 285, r: 22 }];
  const FL = [{ px: 120, py: 598, side: 1, rest: 0.52, up: -0.48, len: 60 }, { px: 280, py: 598, side: -1, rest: 0.52, up: -0.48, len: 60 }];
  const rolls = [{ x: 142 }, { x: 200 }, { x: 258 }];
  function flipSeg(f) { const a = f.ang; return { ax: f.px, ay: f.py, bx: f.px + Math.cos(a) * f.len * f.side, by: f.py + Math.sin(a) * f.len, r: 6, e: 0.25, fl: f }; }
  function collide(g, b, s) { const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1; let t = ((b.x - s.ax) * dx + (b.y - s.ay) * dy) / L2; t = Math.max(0, Math.min(1, t)); const cx = s.ax + dx * t, cy = s.ay + dy * t; let nx = b.x - cx, ny = b.y - cy; const d = Math.hypot(nx, ny), R = BR + (s.r || 0); if (d >= R || d === 0) return; nx /= d; ny /= d; b.x = cx + nx * R; b.y = cy + ny * R;
    let svx = 0, svy = 0; if (s.fl) { const f = s.fl, rx = cx - f.px, ry = cy - f.py, w = f.w * f.side; svx = -w * ry; svy = w * rx; }
    const rvx = b.vx - svx, rvy = b.vy - svy, vn = rvx * nx + rvy * ny; if (vn < 0) { b.vx -= (1 + s.e) * vn * nx; b.vy -= (1 + s.e) * vn * ny; }
    if (s.kick && -vn > 60) { b.vx += nx * s.kick; b.vy += ny * s.kick; hit(g, cx, cy, 10, '#ff4fd8', 'sling'); s.lit = 0.15; }
    if (s.tgt != null && !g.tgt[s.tgt] && -vn > 40) { g.tgt[s.tgt] = true; hit(g, cx, cy, 250, '#ffd23f', 'tgt'); if (g.tgt.every(Boolean)) { g.tgt = [false, false, false]; g.add(5000 * g.mult, 'bank'); g.float(200, 360, 'TARGET BANK ' + 5000 * g.mult, '#ffd23f', 22); g.sfx('power'); g.shake(6); } } }
  function hit(g, x, y, pts, col, k) { g.add(pts * g.mult, k); g.burst(x, y, [col, '#fff'], k === 'bump' ? 12 : 6, 220, 0.35); g.sfx(k === 'bump' ? 'pop' : 'click'); if (navigator.vibrate) navigator.vibrate(8); }
  function newBall(g) { g.ball = { x: 364, y: 650, vx: 0, vy: 0, lane: true }; g.charge = 0; g.save = 6; }
  function table(W, H) { if (TABLE) return TABLE; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const bg = c.createRadialGradient(200, 330, 30, 200, 360, 460); bg.addColorStop(0, '#2a1458'); bg.addColorStop(0.6, '#140a30'); bg.addColorStop(1, '#05030f'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(120,90,255,.08)'; c.lineWidth = 1; for (let x = 0; x < W; x += 20) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); } for (let y = 0; y < H; y += 20) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
    // centre logo: leaf + text
    c.save(); c.translate(200, 400); c.globalAlpha = 0.22; c.fillStyle = '#7dff6a'; for (let f = -3; f <= 3; f++) { c.save(); c.rotate(f * 0.36 - Math.PI / 2); c.beginPath(); c.ellipse(34 - Math.abs(f) * 4, 0, 36 - Math.abs(f) * 7, 7, 0, 0, 7); c.fill(); c.restore(); } c.globalAlpha = 0.7; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c9b8ff'; c.fillText('HAZE ARCADE', 0, 50); c.font = 'bold 11px sans-serif'; c.fillStyle = '#7dff6a'; c.fillText('\u2618 21+ \u00b7 NEON FLIPPER', 0, 66); c.restore();
    // insert arrows
    for (const [x, y, a, col] of [[90, 380, -0.6, '#ff4fd8'], [310, 380, 0.6 + Math.PI, '#22d3ee'], [200, 520, -Math.PI / 2, '#ffd23f']]) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = col; c.globalAlpha = 0.35; c.beginPath(); c.moveTo(16, 0); c.lineTo(-10, -10); c.lineTo(-4, 0); c.lineTo(-10, 10); c.fill(); c.restore(); }
    // walls as neon tubes
    const tube = (s, col, w) => { c.lineCap = 'round'; c.shadowColor = col; c.shadowBlur = 12; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = w * 0.3; c.stroke(); };
    for (const s of segs) if (!s.kick && s.tgt == null) tube(s, s.r ? '#ffd23f' : '#7c5cff', s.r ? 5 : 6);
    // sling bodies
    for (const [p, col] of [[[[58, 440], [58, 500], [100, 528]], '#ff4fd8'], [[[314, 440], [314, 500], [272, 528]], '#ff4fd8']]) { c.fillStyle = 'rgba(255,79,216,.18)'; c.beginPath(); p[0].forEach(q => c.lineTo(q[0], q[1])); c.fill(); }
    // plunger lane
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(352, 250, 24, 440); return (TABLE = cv); }
  addEventListener('pointerdown', e => { const cv = document.getElementById('gl'); if (!cv) return; const r = cv.getBoundingClientRect(); (e.clientX < r.left + r.width / 2 ? touch.l : touch.r).add(e.pointerId); });
  const up = e => { touch.l.delete(e.pointerId); touch.r.delete(e.pointerId); }; addEventListener('pointerup', up); addEventListener('pointercancel', up);
  Kit.run({ fill: true, id: 'gl-neon-flipper', title: 'NEON FLIPPER', help: 'Left / right side of the screen (or Z and M / arrow keys) flip\nHold, then release to launch. Light the lanes for a multiplier', bg: '#0b0620',
    init(g) { g.balls = 3; g.mult = 1; g.tgt = [false, false, false]; g.roll = [false, false, false]; g.nextXB = 40000; for (const f of FL) { f.ang = f.rest; f.w = 0; } for (const b of bumps) b.lit = 0; newBall(g); g.hud = ''; },
    update(g, dt) { const L = touch.l.size > 0 || g.keys.ArrowLeft || g.keys.z || g.keys.Z || g.keys.a, Rt = touch.r.size > 0 || g.keys.ArrowRight || g.keys.m || g.keys.M || g.keys.d; const b = g.ball;
      if (b.lane) { const hold = g.held() || L || Rt; if (hold) g.charge = Math.min(1, g.charge + dt * 1.2); else if (g.charge > 0.05) { b.vy = -(900 + g.charge * 700); b.lane = false; g.sfx('whoosh'); g.charge = 0; } }
      [L, Rt].forEach((on, i) => { const f = FL[i]; if (on && !f.on) g.sfx('click'); f.on = on; });
      const n = Math.round(dt / STEP); for (let k = 0; k < n; k++) { for (const f of FL) { const tgtA = f.on ? f.up : f.rest, sp = f.on ? 28 : 16; const prev = f.ang; f.ang += Math.sign(tgtA - f.ang) * Math.min(Math.abs(tgtA - f.ang), sp * STEP); f.w = (f.ang - prev) / STEP; }
        if (b.lane && b.vy === 0) break; b.vy += GRAV * STEP; b.x += b.vx * STEP; b.y += b.vy * STEP; const sp = Math.hypot(b.vx, b.vy); if (sp > 1900) { b.vx *= 1900 / sp; b.vy *= 1900 / sp; }
        for (const s of segs) collide(g, b, s); for (const f of FL) collide(g, b, flipSeg(f));
        for (const u of bumps) { const dx = b.x - u.x, dy = b.y - u.y, d = Math.hypot(dx, dy); if (d < u.r + BR) { const nx = dx / d, ny = dy / d; b.x = u.x + nx * (u.r + BR); b.y = u.y + ny * (u.r + BR); const vn = b.vx * nx + b.vy * ny; b.vx -= vn * nx; b.vy -= vn * ny; b.vx += nx * 560; b.vy += ny * 560; u.lit = 0.18; hit(g, b.x, b.y, 100, '#22d3ee', 'bump'); g.shake(2); } }
        if (b.lane && b.y > 650) { b.y = 650; b.vy = 0; } }
      for (let i = 0; i < 3; i++) if (!b.lane && Math.abs(b.x - rolls[i].x) < 14 && b.y > 95 && b.y < 125 && !g.roll[i] && b.vy > 0) { g.roll[i] = true; g.add(500 * g.mult, 'roll'); g.sfx('coin'); if (g.roll.every(Boolean)) { g.roll = [false, false, false]; g.mult = Math.min(6, g.mult + 1); g.float(200, 150, 'MULTIPLIER x' + g.mult, '#7dff6a', 24); g.sfx('power'); g.mark('m', g.mult); } }
      if (g.keys.ArrowUp && !b.lane) {} if (g.kd('ArrowLeft') || g.kd('ArrowRight')) { if (g.roll) { const r = g.roll; g.roll = Rt ? [r[2], r[0], r[1]] : [r[1], r[2], r[0]]; } } // lane change (rotate lit lanes)
      for (const u of bumps) u.lit = Math.max(0, u.lit - dt); for (const s of segs) if (s.lit) s.lit = Math.max(0, s.lit - dt); g.save = Math.max(0, g.save - dt);
      if (g.score >= g.nextXB) { g.nextXB += 40000 + g.nextXB * 0.5; g.balls++; g.float(200, 330, 'EXTRA BALL', '#ffd23f', 26); g.sfx('power'); }
      if (!b.lane && b.x > 352 && b.y > 640) { b.lane = true; b.x = 364; b.y = 650; b.vx = b.vy = 0; }
      if (b.y > 712) { if (g.save > 0) { g.float(200, 560, 'BALL SAVED', '#22d3ee', 22); newBall(g); g.save = 0; b.vy = 0; return; } g.balls--; g.mult = 1; g.sfx('bad'); g.shake(6); if (g.balls <= 0) return g.end('Drained'); newBall(g); g.save = 0; }
      // stuck-ball guard: a ball that sits still away from the flippers gets a small automatic nudge
      if (!b.lane && Math.hypot(b.vx, b.vy) < 12 && b.y < 560) { g.still = (g.still || 0) + dt; if (g.still > 1.5) { b.vx += g.R(-1, 1) * 160; b.vy -= 220; g.still = 0; g.shake(3); } } else g.still = 0;
      g.trail = g.trail || []; g.trail.push([b.x, b.y]); if (g.trail.length > 8) g.trail.shift(); },
    draw(g, c) { c.drawImage(table(g.W, g.H), 0, 0); const t = g.t;
      for (let i = 0; i < 3; i++) { const x = rolls[i].x, on = g.roll[i]; c.fillStyle = on ? '#7dff6a' : 'rgba(125,255,106,.18)'; if (on) { c.shadowColor = '#7dff6a'; c.shadowBlur = 14; } c.beginPath(); c.arc(x, 110, 6, 0, 7); c.fill(); c.shadowBlur = 0; }
      c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#c9b8ff'; c.fillText('x' + g.mult, 200, 74);
      for (const s of tg) { const on = g.tgt[s.tgt]; const gr = c.createLinearGradient(s.ax - 5, 0, s.ax + 5, 0); gr.addColorStop(0, on ? '#5a4a10' : '#ffd23f'); gr.addColorStop(1, on ? '#2a220a' : '#b8860b'); c.fillStyle = gr; c.fillRect(s.ax - 4, s.ay, 9, s.by - s.ay); }
      for (const s of [sl1, sl2]) { c.strokeStyle = s.lit ? '#fff' : '#ff4fd8'; c.shadowColor = '#ff4fd8'; c.shadowBlur = s.lit ? 24 : 10; c.lineWidth = s.lit ? 7 : 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); c.shadowBlur = 0; }
      for (const u of bumps) { const k = u.lit > 0 ? 1.1 : 1; c.save(); c.translate(u.x, u.y); c.scale(k, k); c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(3, 5, u.r + 2, 0, 7); c.fill(); const g1 = c.createRadialGradient(-6, -6, 2, 0, 0, u.r + 2); g1.addColorStop(0, '#f0f4ff'); g1.addColorStop(1, '#6b7280'); c.fillStyle = g1; c.beginPath(); c.arc(0, 0, u.r + 2, 0, 7); c.fill();
        const g2 = c.createRadialGradient(-5, -5, 1, 0, 0, u.r - 3); g2.addColorStop(0, u.lit ? '#ffffff' : '#7ff0ff'); g2.addColorStop(1, u.lit ? '#22d3ee' : '#0e7490'); c.fillStyle = g2; c.shadowColor = '#22d3ee'; c.shadowBlur = u.lit ? 30 : 10; c.beginPath(); c.arc(0, 0, u.r - 4, 0, 7); c.fill(); c.shadowBlur = 0;
        c.fillStyle = 'rgba(10,40,20,.75)'; for (let f = -2; f <= 2; f++) { c.save(); c.rotate(f * 0.5 - Math.PI / 2); c.beginPath(); c.ellipse(7 - Math.abs(f), 0, 8 - Math.abs(f) * 1.5, 2.2, 0, 0, 7); c.fill(); c.restore(); } c.restore(); if (u.lit > 0) { c.strokeStyle = 'rgba(34,211,238,' + u.lit * 5 + ')'; c.lineWidth = 3; c.beginPath(); c.arc(u.x, u.y, u.r + 8 + (0.18 - u.lit) * 120, 0, 7); c.stroke(); } }
      for (const f of FL) { const s = flipSeg(f); c.save(); c.lineCap = 'round'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 14; c.beginPath(); c.moveTo(s.ax + 2, s.ay + 4); c.lineTo(s.bx + 2, s.by + 4); c.stroke(); const fg = c.createLinearGradient(s.ax, s.ay - 7, s.ax, s.ay + 7); fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#c4b5fd'); c.strokeStyle = fg; c.lineWidth = 13; c.beginPath(); c.moveTo(s.ax, s.ay); c.lineTo(s.bx, s.by); c.stroke(); c.strokeStyle = '#ff4fd8'; c.lineWidth = 3; c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(s.ax, s.ay, 4, 0, 7); c.fill(); c.restore(); }
      // plunger
      const pl = 668 + g.charge * 18; c.fillStyle = '#9ca3af'; c.fillRect(358, pl, 16, 690 - pl + 10); c.fillStyle = '#ff4fd8'; c.fillRect(356, pl - 4, 20, 6);
      if (g.ball.lane) { c.fillStyle = 'rgba(255,79,216,' + (0.5 + Math.sin(t * 6) * 0.3) + ')'; c.font = 'bold 11px sans-serif'; c.save(); c.translate(364, 560); c.rotate(-Math.PI / 2); c.fillText('HOLD \u00b7 LAUNCH', 0, 4); c.restore(); }
      const b = g.ball; (g.trail || []).forEach((p, i) => { c.fillStyle = 'rgba(200,220,255,' + i / 40 + ')'; c.beginPath(); c.arc(p[0], p[1], BR * (0.4 + i / 14), 0, 7); c.fill(); });
      c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(b.x + 3, b.y + 4, BR, 0, 7); c.fill(); const bg = c.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, BR); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.4, '#cbd5e1'); bg.addColorStop(1, '#475569'); c.fillStyle = bg; c.beginPath(); c.arc(b.x, b.y, BR, 0, 7); c.fill();
      if (g.save > 0 && !b.lane) { c.fillStyle = 'rgba(34,211,238,' + (0.4 + Math.sin(t * 10) * 0.3) + ')'; c.font = 'bold 10px sans-serif'; c.fillText('BALL SAVE', 200, 640); } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.shadowColor = '#7c5cff'; c.shadowBlur = 10; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 30); c.shadowBlur = 0; c.textAlign = 'right'; c.font = 'bold 12px sans-serif'; c.fillStyle = '#c9b8ff'; c.fillText('BALLS ' + '\u25cf'.repeat(Math.max(0, g.balls)), g.W - 14, 28); } });
})();

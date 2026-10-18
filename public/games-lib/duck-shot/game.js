// @uses art.js
// Duck Shot - original flying-target shooting gallery (Hub v8 rebuild). Tap to fire where you tap. Every wave gives a few shots;
// ducks escape on a timer that shrinks. Hit streaks multiply points. Endless and uncapped; flights are seeded, so it is skill only.
(function () {
  Kit.run({ id: 'gl-duck-shot', title: 'DUCK SHOT', fill: true, minH: 640, maxH: 900, bg: '#4aa8e8', partGrav: 700,
    help: 'Tap to shoot where you tap\nFew shots per wave: lead the flying ducks\nStreaks multiply points - 5 escapes ends the run',
    init(g) { g.round = 0; g.ducks = []; g.shots = 0; g.missed = 0; g.streak = 0; g.wait = 0.8; g.rings = []; g.cl = [0.1, 0.5, 0.85].map((x, i) => ({ x: x * g.W, y: 70 + i * 70, s: 0.9 + i * 0.3 })); g.aim = { x: g.W / 2, y: g.H * 0.45 }; g.perfect = true; g.gy = Math.round(g.H * 0.8); },
    onResize(g) { g.gy = Math.round(g.H * 0.8); },
    update(g, dt) {
      const P = g.ptr; g.rings = g.rings.filter(r => (r.t += dt) < 0.35);
      for (const k of g.cl) k.x = (k.x + dt * 8 * k.s) % (g.W + 160);
      g.aim.x = Kit.clamp(g.aim.x + g.ax() * 420 * dt, 0, g.W); g.aim.y = Kit.clamp(g.aim.y + g.ay() * 420 * dt, 0, g.gy);
      let sx = null, sy; if (P.pressed) { sx = P.x; sy = P.y; g.aim.x = sx; g.aim.y = sy; } const sp = g.kd(' ') && !g._sp; g._sp = g.kd(' '); if (sp) { sx = g.aim.x; sy = g.aim.y; }
      const live = g.ducks.filter(d => d.s === 'fly');
      if (sx !== null && g.shots > 0 && live.length && sy < g.gy + 10) {
        g.shots--; g.sfx('boom'); g.flash('#fff', 0.04); g.rings.push({ x: sx, y: sy, t: 0 }); let hit = false; const rad = Math.max(26, 38 - g.round * 0.6);
        let best = null, bd = 1e9; for (const d of live) { const dd = Math.hypot(d.x - sx, (d.y - sy) * 1.2); if (dd < rad + 8 && dd < bd) { best = d; bd = dd; } }
        if (best) { hit = true; best.s = 'fall'; best.vy = -120; g.streak++; const v = Math.round((100 + g.round * 20 + (best.gold ? 400 : 0)) * Math.min(3, 1 + (g.streak - 1) * 0.25)); g.add(v, 'k'); g.float(best.x, best.y - 24, '+' + v, best.gold ? '#ffd24a' : '#fff', 18); g.burst(best.x, best.y, ['#fff', '#d9c28a', '#8ad0ff'], 14, 170, 0.6, 3); g.sfx('pop'); g.shake(3, 0.1); }
        else { g.streak = 0; g.perfect = false; }
      }
      if (!g.ducks.length) { g.wait -= dt; if (g.wait <= 0) spawn(g); }
      for (const d of g.ducks) { d.t += dt; d.fl += dt * 14;
        if (d.s === 'fall') { d.vy += 1100 * dt; d.y += d.vy * dt; d.rot += dt * 9; if (d.y > g.gy + 30) d.s = 'done'; continue; }
        if (d.s === 'away') { d.y -= 380 * dt; d.x += d.vx * dt * 0.6; if (d.y < -50) d.s = 'done'; continue; }
        d.x += d.vx * dt; d.y += d.vy * dt; d.vy += Math.sin(d.t * d.w + d.ph) * 260 * dt; d.vx += Math.cos(d.t * d.w * 0.7 + d.ph) * 150 * dt;
        const sp0 = Math.hypot(d.vx, d.vy), top = 60, mx = 24; d.vx = d.vx / sp0 * d.sp; d.vy = d.vy / sp0 * d.sp;
        if (d.x < mx) { d.x = mx; d.vx = Math.abs(d.vx); } if (d.x > g.W - mx) { d.x = g.W - mx; d.vx = -Math.abs(d.vx); } if (d.y < top) { d.y = top; d.vy = Math.abs(d.vy); } if (d.y > g.gy - 40 && d.t > 0.8) d.vy = -Math.abs(d.vy);
        if (d.t > d.life || g.shots === 0 && d.t > 0.9 && false) { d.s = 'away'; g.missed++; g.streak = 0; g.perfect = false; g.sfx('bad'); } }
      if (g.ducks.length && g.shots === 0 && g.ducks.every(d => d.s !== 'fly' || d.t > 0)) { for (const d of g.ducks) if (d.s === 'fly') { d.life = Math.min(d.life, d.t + 0.5); } }
      if (g.ducks.length && g.ducks.every(d => d.s === 'done')) { if (g.perfect && g.round > 0) { const b = 150 * g.round; g.add(b, 'b'); g.float(g.W / 2, g.H * 0.4, 'PERFECT +' + b, '#7bf0a0', 22); g.sfx('good'); } g.ducks = []; g.wait = 0.9; if (g.missed >= 5) return g.end('Too many got away'); }
      g.hud = 'ROUND ' + g.round + '   SHOTS ' + g.shots + '   MISSED ' + g.missed + '/5' + (g.streak > 1 ? '   x' + Math.min(3, 1 + (g.streak - 1) * 0.25).toFixed(2) : '');
    },
    draw(g, c) {
      const W = g.W, H = g.H, gy = g.gy;
      const sk = c.createLinearGradient(0, 0, 0, gy); sk.addColorStop(0, '#3b8fe0'); sk.addColorStop(1, '#bfe6ff'); c.fillStyle = sk; c.fillRect(0, 0, W, H);
      for (const k of g.cl) { c.save(); c.globalAlpha = 0.85; c.fillStyle = '#fff'; const x = k.x - 80, y = k.y, s = k.s; c.beginPath(); c.ellipse(x, y, 42 * s, 13 * s, 0, 0, Kit.TAU); c.ellipse(x + 24 * s, y - 9 * s, 28 * s, 13 * s, 0, 0, Kit.TAU); c.ellipse(x - 22 * s, y - 5 * s, 24 * s, 11 * s, 0, 0, Kit.TAU); c.fill(); c.restore(); }
      hills(c, W, gy, '#5fb36b', gy - 60, 40, 0.015, 0); hills(c, W, gy, '#3d9a55', gy - 22, 30, 0.025, 2);
      for (const d of g.ducks) if (d.s !== 'done') duck(c, d);
      // foreground grass hides the spawn point
      const gg = c.createLinearGradient(0, gy - 10, 0, H); gg.addColorStop(0, '#4cb04a'); gg.addColorStop(1, '#22652f'); c.fillStyle = gg; c.fillRect(0, gy - 8, W, H - gy + 8);
      c.fillStyle = '#7fd36b'; for (let i = 0; i < 34; i++) { const x = i * 13 + (i % 3) * 3; c.beginPath(); c.moveTo(x, gy - 4); c.lineTo(x + 5, gy - 22 - (i * 7) % 14); c.lineTo(x + 10, gy - 4); c.fill(); }
      for (const r of g.rings) { c.strokeStyle = 'rgba(255,255,255,' + (1 - r.t / 0.35) + ')'; c.lineWidth = 3; c.beginPath(); c.arc(r.x, r.y, 10 + r.t * 90, 0, Kit.TAU); c.stroke(); }
      if (g.state === 'play') { const a = g.aim; c.strokeStyle = 'rgba(255,60,60,.85)'; c.lineWidth = 2; c.beginPath(); c.arc(a.x, a.y, 18, 0, Kit.TAU); c.moveTo(a.x - 26, a.y); c.lineTo(a.x - 8, a.y); c.moveTo(a.x + 8, a.y); c.lineTo(a.x + 26, a.y); c.moveTo(a.x, a.y - 26); c.lineTo(a.x, a.y - 8); c.moveTo(a.x, a.y + 8); c.lineTo(a.x, a.y + 26); c.stroke(); }
      for (let i = 0; i < g.shots; i++) { Art.rr(c, 70 + i * 18, H - 62, 11, 30, 4); c.fillStyle = '#ffb347'; c.fill(); c.fillStyle = '#d97a1d'; c.fillRect(70 + i * 18, H - 40, 11, 8); }
    } });
  function hills(c, W, gy, col, base, amp, f, ph) { c.fillStyle = col; c.beginPath(); c.moveTo(0, gy); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, base - amp * 0.5 * (Math.sin(x * f + ph) + 0.6 * Math.sin(x * f * 2.2 + 1))); c.lineTo(W, gy); c.fill(); }
  function spawn(g) {
    g.round++; g.mark('w', g.round); g.perfect = true; const n = g.round < 2 ? 1 : g.round < 5 ? 2 : 3; g.shots = n === 1 ? 3 : n === 2 ? 3 : 4; g.ducks = [];
    for (let i = 0; i < n; i++) { const sp = 190 + Math.min(260, g.round * 14), a = -Math.PI / 2 + g.R(-0.7, 0.7); g.ducks.push({ x: g.R(70, g.W - 70), y: g.gy - 20, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sp, t: -i * 0.25, fl: g.R(0, 6), w: g.R(2.2, 3.6), ph: g.R(0, 6), life: Math.max(3.4, 6.5 - g.round * 0.2), s: 'fly', gold: g.round > 2 && g.rnd() < 0.1, rot: 0 }); }
  }
  function duck(c, d) {
    if (d.t < 0) return; const flap = Math.sin(d.fl), col = d.gold ? '#ffcc33' : '#7b4a24'; c.save(); c.translate(d.x, d.y); if (d.s === 'fall') c.rotate(d.rot); const dir = d.vx < 0 ? -1 : 1; c.scale(dir, 1);
    Art.shadow(c, 0, 0, 0, 0, 0);
    c.fillStyle = Art.dark(col, 0.2); c.beginPath(); c.ellipse(-4, -4 - flap * 14, 8, 17, -0.5 + flap * 0.3, 0, Kit.TAU); c.fill();
    const bg = c.createLinearGradient(0, -14, 0, 14); bg.addColorStop(0, Art.light(col, 0.25)); bg.addColorStop(1, Art.dark(col, 0.25)); c.fillStyle = bg; c.beginPath(); c.ellipse(0, 0, 22, 13, 0, 0, Kit.TAU); c.fill();
    c.fillStyle = d.gold ? '#fff3b0' : '#e8dcc0'; c.beginPath(); c.ellipse(-2, 5, 14, 6, 0, 0, Kit.TAU); c.fill();
    c.fillStyle = d.gold ? '#ffe170' : '#1f8a50'; c.beginPath(); c.arc(17, -8, 9, 0, Kit.TAU); c.fill(); c.fillStyle = '#ff9a2a'; c.beginPath(); c.moveTo(24, -9); c.lineTo(36, -6); c.lineTo(24, -3); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(19, -10, 3, 0, Kit.TAU); c.fill(); c.fillStyle = d.s === 'fall' ? '#c00' : '#111'; c.beginPath(); c.arc(20, -10, 1.5, 0, Kit.TAU); c.fill();
    c.fillStyle = Art.dark(col, 0.1); c.beginPath(); c.ellipse(-2, -2 + flap * 14, 9, 16, 0.5 - flap * 0.3, 0, Kit.TAU); c.fill(); c.restore();
  }
})();

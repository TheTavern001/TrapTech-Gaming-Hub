// @uses art.js
// Desert Dash - original portrait endless runner (Hub v8 rebuild). Tap = jump (hold for a higher hop), swipe/hold down = duck + fast fall.
// Endless and uncapped: score = distance. Obstacle spacing is always jumpable, so rank is pure reflex skill.
(function () {
  const GRAV = 2500, JV = 840, HOLDG = 0.55, PX = 86, STAND = 54, DUCK = 28, PW = 34;
  Kit.run({ id: 'gl-dino-dash', title: 'DESERT DASH', fill: true, minH: 640, maxH: 900, bg: '#f3b46a', partGrav: 600,
    help: 'Tap to jump (hold = higher)\nSwipe or hold down to duck under drones\nSpeed keeps climbing: how far can you run?',
    init(g) { g.gy = Math.round(g.H * 0.74); g.py = g.gy; g.vy = 0; g.duck = false; g.obs = []; g.speed = 300; g.dist = 0; g.paid = 0; g.next = 520; g.step = 0; g.onGround = true; g.dustT = 0; g.cl = [0.1, 0.45, 0.8].map((x, i) => ({ x: x * g.W, y: 90 + i * 55, s: 0.8 + i * 0.25 })); },
    onResize(g) { const was = g.gy; g.gy = Math.round(g.H * 0.74); if (g.py === was) g.py = g.gy; },
    update(g, dt) {
      const P = g.ptr; const ph = g.duck ? DUCK : STAND;
      const down = g.kd('ArrowDown') || g.kd('s') || (P.down && P.y - P.sy > 34);
      const want = g.onGround ? down : down; g.duck = want && g.onGround;
      if ((g.tap() || (g.kd('ArrowUp') || g.kd('w') || g.kd(' ')) && g.onGround) && g.onGround && !down) { g.vy = -JV; g.onGround = false; g.sfx('jump'); g.burst(PX, g.gy, '#e8b97a', 6, 90, 0.4, 3); }
      if (!g.onGround) { const holding = g.held() && g.vy < 0 && !down; g.vy += GRAV * (holding ? HOLDG : 1) * dt * (down ? 1.8 : 1); g.py += g.vy * dt; if (g.py >= g.gy) { g.py = g.gy; g.vy = 0; g.onGround = true; g.burst(PX, g.gy, '#e8b97a', 6, 80, 0.35, 3); } }
      g.speed = Math.min(780, 300 + g.dist * 0.035); g.dist += g.speed * dt; g.step += g.speed * dt * 0.045;
      const gained = Math.floor(g.dist / 12) - g.paid; if (gained > 0) { g.paid += gained; g.add(gained, 'p'); if (g.paid % 100 === 0) g.mark('d', g.paid); }
      g.next -= g.speed * dt; if (g.next <= 0) spawn(g);
      for (const o of g.obs) o.x -= g.speed * dt; g.obs = g.obs.filter(o => o.x + o.w > -40);
      const me = { x: PX - PW / 2 + 5, y: g.py - ph + 4, w: PW - 10, h: ph - 6 };
      for (const o of g.obs) { const b = { x: o.x + 4, y: o.y + 4, w: o.w - 8, h: o.h - 8 }; if (o.k === 'd') { b.y += 4; b.h -= 6; } if (Kit.hit(me, b)) { g.burst(PX, g.py - 24, ['#ffcf6a', '#ff7a4a', '#fff'], 22, 260, 0.7, 4); g.end('crash'); break; } }
      g.hud = Math.round(g.dist / 12) + ' m';
    },
    draw(g, c) {
      const W = g.W, H = g.H, gy = g.gy, t = g.dist;
      const sk = c.createLinearGradient(0, 0, 0, gy); sk.addColorStop(0, '#5b4fb3'); sk.addColorStop(0.45, '#e9798c'); sk.addColorStop(1, '#ffc97a'); c.fillStyle = sk; c.fillRect(0, 0, W, H);
      { const sx = W * 0.72, sy = gy * 0.5, rg = c.createRadialGradient(sx, sy, 10, sx, sy, 80); rg.addColorStop(0, '#fff3b0'); rg.addColorStop(0.5, '#ffd66a'); rg.addColorStop(1, 'rgba(255,214,106,0)'); c.fillStyle = rg; c.beginPath(); c.arc(sx, sy, 80, 0, Kit.TAU); c.fill(); } c.fillStyle = 'rgba(255,255,255,.55)';
      for (const k of g.cl) { const x = ((k.x - t * 0.02 * k.s) % (W + 120) + W + 120) % (W + 120) - 60; cloud(c, x, k.y, k.s); }
      dunes(c, W, gy, t * 0.1, 50, '#d9895a', gy - 70, 0.012); dunes(c, W, gy, t * 0.25, 38, '#c27549', gy - 34, 0.02);
      const gg = c.createLinearGradient(0, gy, 0, H); gg.addColorStop(0, '#e2a35f'); gg.addColorStop(1, '#a8683d'); c.fillStyle = gg; c.fillRect(0, gy, W, H - gy);
      c.fillStyle = 'rgba(255,230,170,.7)'; c.fillRect(0, gy, W, 3);
      c.fillStyle = 'rgba(90,50,25,.25)'; for (let i = 0; i < 14; i++) { const x = ((i * 97 - t * 1) % (W + 40) + W + 40) % (W + 40) - 20; c.fillRect(x, gy + 16 + (i * 37) % (H - gy - 30), 14 + i % 3 * 8, 3); }
      for (const o of g.obs) { if (o.k === 'c') cactus(c, o); else drone(c, o, g.t); }
      runner(c, PX, g.py, g.duck, g.onGround, g.step, g.state === 'over');
      if (g.state === 'play' && g.dist < 700) g.txt('TAP TO JUMP  -  SWIPE DOWN TO DUCK', W / 2, g.gy + 70, 13, '#fff3d6');
    } });
  function spawn(g) {
    const r = g.rnd(); let w, h, y, k;
    if (r < 0.28 && g.dist > 900) { k = 'd'; w = 46; h = 30; y = g.gy - 62 + (g.rnd() < 0.3 ? 14 : 0); }
    else { k = 'c'; const n = g.rnd() < 0.35 && g.dist > 500 ? 2 + (g.rnd() < 0.4 ? 1 : 0) : 1; h = 44 + Math.floor(g.rnd() * 30); w = 26 * n + 8 * (n - 1); y = g.gy - h; g.cn = n; }
    g.obs.push({ k, x: g.W + 30, y, w, h, n: k === 'c' ? g.cn : 0, sd: Math.floor(g.rnd() * 99) });
    g.next = Math.max(g.speed * 0.95, 280) + w + g.rnd() * 260;
  }
  function cloud(c, x, y, s) { c.save(); c.globalAlpha = 0.5; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, 40 * s, 12 * s, 0, 0, Kit.TAU); c.ellipse(x + 22 * s, y - 8 * s, 26 * s, 12 * s, 0, 0, Kit.TAU); c.ellipse(x - 20 * s, y - 5 * s, 22 * s, 10 * s, 0, 0, Kit.TAU); c.fill(); c.restore(); }
  function dunes(c, W, gy, off, amp, col, base, f) { c.fillStyle = col; c.beginPath(); c.moveTo(0, gy + 2); for (let x = 0; x <= W + 8; x += 8) c.lineTo(x, base - amp * 0.5 * (Math.sin((x + off) * f) + 0.6 * Math.sin((x + off) * f * 2.3 + 1.3))); c.lineTo(W, gy + 2); c.fill(); }
  function cactus(c, o) { const n = o.n, cw = 26, gap = 8; for (let i = 0; i < n; i++) { const x = o.x + i * (cw + gap), h = o.h - (i % 2) * 10, y = o.y + o.h - h;
    const g = c.createLinearGradient(x, 0, x + cw, 0); g.addColorStop(0, '#2c7a4b'); g.addColorStop(0.5, '#47b46b'); g.addColorStop(1, '#2a6e45');
    c.fillStyle = g; Art.rr(c, x + 6, y, cw - 12, h, 8); c.fill(); Art.rr(c, x - 2, y + h * 0.35, 12, 8, 4); c.fill(); Art.rr(c, x - 2, y + h * 0.2, 8, h * 0.2, 4); c.fill(); Art.rr(c, x + cw - 10, y + h * 0.5, 12, 8, 4); c.fill(); Art.rr(c, x + cw - 4, y + h * 0.32, 8, h * 0.22, 4); c.fill();
    c.fillStyle = '#ff7ab0'; c.beginPath(); c.arc(x + cw / 2, y + 2, 4, 0, Kit.TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; for (let j = 1; j < 4; j++) { c.beginPath(); c.moveTo(x + cw / 2, y + j * h / 4); c.lineTo(x + cw / 2 + 3, y + j * h / 4 - 2); c.stroke(); } }
    Art.shadow(c, o.x + o.w / 2, o.y + o.h + 2, o.w * 0.6, 4, 0.22); }
  function drone(c, o, t) { const cx = o.x + o.w / 2, cy = o.y + o.h / 2; Art.shadow(c, cx, o.y + o.h + 52, 20, 3, 0.15);
    Art.orb(c, cx, cy, 15, '#e95757'); c.fillStyle = '#fff'; c.beginPath(); c.arc(cx - 5, cy - 1, 4, 0, Kit.TAU); c.fill(); c.fillStyle = '#222'; c.beginPath(); c.arc(cx - 6, cy - 1, 2, 0, Kit.TAU); c.fill();
    c.strokeStyle = '#2a2f4a'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx, cy - 14); c.lineTo(cx, cy - 20); c.stroke(); const s = Math.sin(t * 40); c.fillStyle = 'rgba(40,45,70,.8)'; c.beginPath(); c.ellipse(cx, cy - 21, 22 * Math.abs(s) + 3, 2.5, 0, 0, Kit.TAU); c.fill(); }
  function runner(c, x, y, duck, ground, step, dead) { const h = duck ? 28 : 54; Art.shadow(c, x, y + 2, 20, 4, 0.25); c.save(); c.translate(x, y);
    const sw = ground && !dead ? Math.sin(step * 2) : 0.5; c.strokeStyle = '#3a2a50'; c.lineWidth = 6; c.lineCap = 'round'; const ly = duck ? 8 : 12;
    c.beginPath(); c.moveTo(-6, -ly); c.lineTo(-6 + sw * 9, 0); c.moveTo(6, -ly); c.lineTo(6 - sw * 9, 0); c.stroke();
    const bh = h - ly + 4; const bg = c.createLinearGradient(-18, 0, 18, 0); bg.addColorStop(0, '#46c47a'); bg.addColorStop(1, '#2a8f59'); c.fillStyle = bg; Art.rr(c, -17, -h, 34, bh, 14); c.fill();
    c.fillStyle = 'rgba(255,255,255,.3)'; Art.rr(c, -12, -h + 3, 14, 8, 4); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(7, -h + 14, 6, 0, Kit.TAU); c.fill(); c.fillStyle = '#1b1530'; c.beginPath(); c.arc(dead ? 7 : 9, -h + 14, dead ? 1.5 : 3, 0, Kit.TAU); c.fill();
    c.fillStyle = '#7bd88f'; for (let i = -1; i <= 1; i++) { c.save(); c.translate(i * 6 - 2, -h + 1); c.rotate(i * 0.5 + Math.sin(step) * 0.1); c.beginPath(); c.ellipse(0, -7, 3.5, 9, 0, 0, Kit.TAU); c.fill(); c.restore(); }
    c.restore(); }
})();

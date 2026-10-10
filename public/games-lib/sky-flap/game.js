// Sky Flap - original one-tap flyer (Hub build). Art: Kenney "Tappy Plane" (CC0, see LICENSE-Kenney-CC0.txt), recoloured
// palette + code-drawn haze/leaf banner. Endless: +1 per rock gate cleared; gap tightens and speed rises with score.
(function () {
  const IMG = {}; const names = ['background', 'groundGrass', 'rock', 'rockGrassDown', 'planeGreen1', 'planeGreen2', 'planeGreen3', 'puffLarge', 'puffSmall', 'textGetReady', 'tap'].concat([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => 'number' + i));
  let loaded = 0; for (const n of names) { const im = new Image(); im.onload = () => loaded++; im.src = 'img/' + n + '.webp'; IMG[n] = im; }
  const W = 400, H = 700, GROUND = 70, PX = 120, R = 21;
  const puffs = []; let bgX = 0, gX = 0;
  function drawNum(c, n, cx, y, h) { const s = String(n); const ims = [...s].map(d => IMG['number' + d]); const sc = h / 90; let tw = 0; for (const im of ims) tw += im.width * sc + 2; let x = cx - tw / 2; for (const im of ims) { c.drawImage(im, x, y, im.width * sc, im.height * sc); x += im.width * sc + 2; } }
  // triangle spike collision (rock art is a tall spike); sample points on the plane's circle
  function inTri(px, py, ax, ay, bx, by, cx, cy) { const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); const u = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d, v = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d; return u >= 0 && v >= 0 && u + v <= 1; }
  function hitRock(b, r) { const tris = [[r.x - 44, H - GROUND, r.x + 44, H - GROUND, r.x + 6, r.gy + r.gap / 2], [r.x - 44, 0, r.x + 44, 0, r.x + 6, r.gy - r.gap / 2]];
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const px = b.x + Math.cos(a) * R * 0.85, py = b.y + Math.sin(a) * R * 0.75; for (const t of tris) if (inTri(px, py, ...t)) return true; } return false; }
  Kit.run({ id: 'gl-sky-flap', title: 'SKY FLAP', help: 'Tap / Space to fly up\nThread the plane between the rock spires', bg: '#cfe9f7',
    init(g) { g.b = { x: PX, y: 300, vy: 0, a: 0, f: 0 }; g.rocks = []; g.next = 1.4; g.sp = 170; puffs.length = 0; },
    attract(g, dt) { g.b.y = 300 + Math.sin(g.t * 3) * 16; g.b.f += dt * 12; bgX += 20 * dt; gX += 170 * dt; },
    update(g, dt) { const b = g.b; b.f += dt * (b.vy < 0 ? 22 : 12);
      if (g.tap()) { b.vy = -340; g.sfx('flap'); for (let i = 0; i < 2; i++) puffs.push({ x: b.x - 34, y: b.y + 6 + i * 4, vx: -60 - Math.random() * 40, l: 0.6, s: 0.6 + Math.random() * 0.4 }); }
      b.vy = Math.min(560, b.vy + 1100 * dt); b.y += b.vy * dt; const ta = Kit.clamp(b.vy / 620, -0.45, 1.25); b.a += (ta - b.a) * Math.min(1, dt * (ta > b.a ? 5 : 14));
      g.sp = 170 + Math.min(110, g.score * 2.2); bgX += g.sp * 0.12 * dt; gX += g.sp * dt;
      const gap = Math.max(150, 215 - g.score * 1.6);
      g.next -= dt; if (g.next <= 0) { g.next = Math.max(1.05, 1.5 - g.score * 0.008); g.rocks.push({ x: W + 60, gy: g.R(190, H - GROUND - 170), gap, done: false }); }
      for (const r of g.rocks) { r.x -= g.sp * dt; if (!r.done && r.x + 20 < b.x) { r.done = true; g.add(1, 'g'); g.sfx('coin'); g.burst(b.x, b.y - 20, ['#ffe08a', '#9be38b', '#fff'], 10, 120, 0.5); }
        if (Math.abs(r.x - b.x) < 70 && hitRock(b, r)) { g.shake(10, 0.35); g.burst(b.x, b.y, ['#ffd23f', '#ff7a59', '#fff'], 34, 280); g.flash && g.flash('#fff', 0.15); return g.end('Clipped a spire'); } }
      g.rocks = g.rocks.filter(r => r.x > -80);
      for (const p of puffs) { p.x += p.vx * dt - g.sp * 0.2 * dt; p.y -= 10 * dt; p.l -= dt; } for (let i = puffs.length - 1; i >= 0; i--) if (puffs[i].l <= 0) puffs.splice(i, 1);
      if (b.y > H - GROUND - 16) { g.shake(12, 0.4); g.burst(b.x, H - GROUND, ['#c99a5b', '#fff'], 30, 240); return g.end('Crashed'); } if (b.y < -40) b.y = -40;
    },
    draw(g, c) {
      if (loaded < names.length) { c.fillStyle = '#cfe9f7'; c.fillRect(0, 0, W, H); return; }
      // parallax sky (background art is 800x480; scale to fill height above the ground)
      const bh = H - GROUND + 10, bw = 800 * bh / 480; for (let x = -(bgX % bw); x < W; x += bw) c.drawImage(IMG.background, x, 0, bw, bh);
      // soft haze bands + a sponsor-style leaf banner far back (21+, original)
      const hz = c.createLinearGradient(0, H * 0.45, 0, H); hz.addColorStop(0, 'rgba(255,255,255,0)'); hz.addColorStop(1, 'rgba(210,240,215,.35)'); c.fillStyle = hz; c.fillRect(0, 0, W, H);
      { const bx = W + 260 - ((g.t * 28) % (W + 900)); if (bx > -240) { c.save(); c.globalAlpha = 0.55; c.strokeStyle = '#7d8a7f'; c.beginPath(); c.moveTo(bx, 128); c.lineTo(bx + 26, 132); c.stroke(); c.fillStyle = '#f6f1d8'; c.fillRect(bx + 26, 120, 170, 24); c.fillStyle = '#2f7d4a'; c.font = 'bold 13px system-ui'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('\u2618 GREEN SUMMIT  21+', bx + 34, 132); c.drawImage(IMG.planeGreen1, bx - 30, 116, 34, 28); c.restore(); } }
      for (const r of g.rocks) { const top = r.gy - r.gap / 2, bot = r.gy + r.gap / 2; const rw = 108;
        c.drawImage(IMG.rock, r.x - rw / 2, bot, rw, H - GROUND - bot + 8); c.drawImage(IMG.rockGrassDown, r.x - rw / 2, -8, rw, top + 8); }
      for (const p of puffs) { c.globalAlpha = Math.max(0, p.l / 0.6) * 0.8; const s = 30 * p.s * (1.6 - p.l); c.drawImage(IMG.puffLarge, p.x - s / 2, p.y - s / 2, s, s * 0.83); } c.globalAlpha = 1;
      const gw = 808 * (GROUND + 6) / 71; for (let x = -(gX % gw); x < W; x += gw) c.drawImage(IMG.groundGrass, x, H - GROUND - 6, gw, GROUND + 6);
      const b = g.b; const fr = IMG['planeGreen' + (1 + (Math.floor(b.f) % 3))]; c.save(); c.translate(b.x, b.y); c.rotate(b.a * 0.75); c.drawImage(fr, -44, -36, 88, 73); c.restore();
      if (g.state === 'title') { const im = IMG.textGetReady; c.drawImage(im, W / 2 - im.width * 0.45, 150, im.width * 0.9, im.height * 0.9); c.drawImage(IMG.tap, W / 2 - 30, 380, 60, 60); }
    },
    hudDraw(g, c) { if (loaded < names.length) return; drawNum(c, Math.floor(g.score), W / 2, 40, 64); c.font = 'bold 13px system-ui'; c.textAlign = 'right'; c.fillStyle = 'rgba(30,60,40,.85)'; c.fillText('BEST ' + Math.floor(g.best), W - 12, 24); }
  });
})();

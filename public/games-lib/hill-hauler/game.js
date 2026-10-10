// Hill Hauler - original hill-climb driving with wheel physics, fuel and flips (Hub build)
(function () {
  function hgt(g, x) { const k = x / 900; const amp = 40 + Math.min(160, x / 60); return 330 + Math.sin(x * 0.004) * amp * 0.6 + Math.sin(x * 0.011 + 1) * amp * 0.35 + Math.sin(x * 0.0017) * amp + Math.sin(x * 0.023) * 8 * Math.min(1, k); }
  Kit.run({ id: 'gl-hill-hauler', title: 'HILL HAULER', orient: 'l', help: 'Hold right side / Right arrow = gas, left side / Left = brake\nGrab fuel cans, land flips for bonus, don\'t land on your head', bg: '#0c4a6e',
    buttons: [{ id: 'B', key: 'ArrowLeft', label: 'BRAKE' }, { id: 'G', key: 'ArrowRight', label: 'GAS' }],
    init(g) { g.w1 = { x: 120, y: 280, vx: 0, vy: 0 }; g.w2 = { x: 190, y: 280, vx: 0, vy: 0 }; g.fuel = 1; g.cam = 0; g.dist = 0; g.items = []; for (let x = 600; x < 40000; x += g.R(350, 600)) g.items.push({ x, k: g.rnd() < 0.3 ? 'f' : 'c' }); g.rot = 0; g.air = 0; g.lastA = 0; g.flip = 0; },
    update(g, dt) {
      let gas = (g.keys.ArrowRight || g.keys.d ? 1 : 0), brake = (g.keys.ArrowLeft || g.keys.a ? 1 : 0); if (g.ptr.down) { if (g.ptr.x > g.W / 2) gas = 1; else brake = 1; } if (g.fuel <= 0) gas = 0;
      const steps = 4, h = dt / steps; const L = 70;
      for (let s = 0; s < steps; s++) {
        let grounded = 0;
        for (const w of [g.w1, g.w2]) { w.vy += 900 * h; w.x += w.vx * h; w.y += w.vy * h; const gy = hgt(g, w.x) - 16; if (w.y > gy) { w.y = gy; const sl = (hgt(g, w.x + 2) - hgt(g, w.x - 2)) / 4; const nx = -sl, ny = 1; const nl = Math.hypot(nx, ny); const vn = (w.vx * nx + w.vy * ny) / nl; if (vn > 0) { w.vx -= vn * nx / nl * 1.2; w.vy -= vn * ny / nl * 1.2; } grounded++; w.g = 1; const tx = 1 / nl, ty = sl / nl; const drive = (gas * 520 - brake * 520) * h; w.vx += tx * drive; w.vy += ty * drive; w.vx *= 0.995; } else w.g = 0; }
        // stick constraint
        const dx = g.w2.x - g.w1.x, dy = g.w2.y - g.w1.y, d = Math.hypot(dx, dy), diff = (d - L) / d / 2; g.w1.x += dx * diff; g.w1.y += dy * diff; g.w2.x -= dx * diff; g.w2.y -= dy * diff;
        // air control: gas tilts back, brake tilts forward
        if (!grounded) { const cx = (g.w1.x + g.w2.x) / 2, cy = (g.w1.y + g.w2.y) / 2, a = (gas - brake) * -2.6 * h; for (const w of [g.w1, g.w2]) { const rx = w.x - cx, ry = w.y - cy; w.x = cx + rx * Math.cos(a) - ry * Math.sin(a); w.y = cy + rx * Math.sin(a) + ry * Math.cos(a); } }
        g.ground = grounded;
      }
      const ang = Math.atan2(g.w2.y - g.w1.y, g.w2.x - g.w1.x); let da = ang - g.lastA; da = Math.atan2(Math.sin(da), Math.cos(da)); g.lastA = ang;
      if (!g.ground) { g.air += dt; g.rot += da; } else { if (Math.abs(g.rot) > Math.PI * 1.7) { const n = Math.round(Math.abs(g.rot) / (Math.PI * 2)); g.add(100 * Math.max(1, n), 'f'); g.float(g.W / 2, 120, (n > 1 ? n + 'x ' : '') + 'FLIP +' + 100 * Math.max(1, n), '#fbbf24', 26); g.sfx('power'); } else if (g.air > 1.2) { g.add(20, 'a'); g.float(g.W / 2, 140, 'AIR +20', '#22d3ee'); } g.rot = 0; g.air = 0; }
      // head check: roof touching ground
      const cx = (g.w1.x + g.w2.x) / 2, cy = (g.w1.y + g.w2.y) / 2; const hx = cx + Math.sin(ang) * 34, hy = cy - Math.cos(ang) * 34; if (hy > hgt(g, hx) - 4) { g.burst(hx - g.cam, hy, ['#ef4444', '#fbbf24'], 30, 200); g.sfx('boom'); return g.end('Landed on your head'); }
      g.fuel -= dt * (0.045 + gas * 0.03); if (g.fuel <= 0 && Math.abs(g.w1.vx) < 8 && g.ground) return g.end('Out of fuel');
      g.cam = Kit.lerp(g.cam, cx - 260, Math.min(1, dt * 5)); const m = Math.floor((cx - 150) / 10); if (m > g.dist) { g.add(m - g.dist, 'm'); g.dist = m; }
      for (const it of g.items) if (!it.got && Math.abs(it.x - cx) < 40 && Math.abs(hgt(g, it.x) - 40 - cy) < 60) { it.got = true; if (it.k === 'f') { g.fuel = 1; g.sfx('power'); g.float(it.x - g.cam, hgt(g, it.x) - 60, 'FUEL', '#ef4444'); } else { g.add(5, 'c'); g.sfx('coin'); g.burst(it.x - g.cam, hgt(g, it.x) - 40, '#fbbf24', 8); } }
      if (gas && g.frames % 6 === 0) Kit.sfx('engine', Math.min(1, Math.abs(g.w1.vx) / 400));
      g.hud = g.dist + ' m   FUEL ' + Math.max(0, Math.round(g.fuel * 100)) + '%';
    },
    draw(g, c) {
      const W = g.W, H = g.H; const sky = c.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0c4a6e'); sky.addColorStop(1, '#38bdf8'); c.fillStyle = sky; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.15)'; for (let i = 0; i < 6; i++) { const x = ((i * 200 - g.cam * 0.1) % 1200 + 1200) % 1200 - 100; c.beginPath(); c.ellipse(x, 60 + i * 13, 60, 16, 0, 0, 7); c.fill(); }
      c.fillStyle = '#1e3a8a'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 20) c.lineTo(x, 250 + Math.sin((x + g.cam * 0.3) * 0.006) * 50); c.lineTo(W, H); c.fill();
      c.fillStyle = '#65a30d'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, hgt(g, x + g.cam)); c.lineTo(W, H); c.fill(); c.fillStyle = '#78350f'; c.beginPath(); c.moveTo(0, H); for (let x = 0; x <= W; x += 8) c.lineTo(x, hgt(g, x + g.cam) + 14); c.lineTo(W, H); c.fill();
      for (let m = Math.ceil(g.cam / 1000) * 1000; m < g.cam + W; m += 1000) { const x = m - g.cam + 150; c.fillStyle = '#fff'; c.fillRect(x, hgt(g, m + 150) - 50, 3, 50); g.txt(Math.round(m / 10) + 'm', x, hgt(g, m + 150) - 60, 12, '#fff'); }
      for (const it of g.items) { if (it.got || it.x < g.cam - 40 || it.x > g.cam + W + 40) continue; const x = it.x - g.cam, y = hgt(g, it.x) - 40; if (it.k === 'f') { c.fillStyle = '#ef4444'; c.fillRect(x - 10, y - 14, 20, 26); g.txt('F', x, y, 12, '#fff'); } else { Kit.glow(c, '#fbbf24', 8); Kit.circ(c, x, y, 9, '#fbbf24'); Kit.noGlow(c); } }
      const a = Math.atan2(g.w2.y - g.w1.y, g.w2.x - g.w1.x), cx = (g.w1.x + g.w2.x) / 2 - g.cam, cy = (g.w1.y + g.w2.y) / 2;
      c.save(); c.translate(cx, cy); c.rotate(a); c.fillStyle = '#ef4444'; Kit.rr(c, -46, -26, 92, 22, 6); c.fill(); c.fillStyle = '#b91c1c'; c.fillRect(-10, -42, 34, 18); c.fillStyle = '#bae6fd'; c.fillRect(-6, -39, 26, 12); Kit.circ(c, -2, -33, 7, '#fcd9b6'); c.restore();
      for (const w of [g.w1, g.w2]) { const x = w.x - g.cam; Kit.circ(c, x, w.y, 16, '#111827'); Kit.circ(c, x, w.y, 7, '#9ca3af'); c.strokeStyle = '#374151'; c.lineWidth = 2; c.beginPath(); const sp = w.x / 16; c.moveTo(x + Math.cos(sp) * 13, w.y + Math.sin(sp) * 13); c.lineTo(x - Math.cos(sp) * 13, w.y - Math.sin(sp) * 13); c.stroke(); }
      c.fillStyle = 'rgba(0,0,0,.4)'; c.fillRect(W / 2 - 80, 40, 160, 10); c.fillStyle = g.fuel > 0.25 ? '#34d399' : '#ef4444'; c.fillRect(W / 2 - 80, 40, 160 * Math.max(0, g.fuel), 10);
    } });
})();

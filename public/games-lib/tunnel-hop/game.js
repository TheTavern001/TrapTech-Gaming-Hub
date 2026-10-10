// Tunnel Hop - original gravity-tunnel runner (Hub build). Walk onto the walls - the tunnel rotates with you.
Kit.run({ id: 'gl-tunnel-hop', title: 'TUNNEL HOP', help: 'Left / right (or hold sides) to move - walls become floors\nSpace / tap jump over missing tiles', bg: '#020617',
  init(g) { g.N = 5 * 2 + 0; g.sides = 4; g.rot = 0; g.lat = 0; g.y = 0; g.vy = 0; g.z = 0; g.rows = []; for (let i = 0; i < 60; i++) g.rows.push(row(g, i)); g.sp = 9; g.lastM = 0; },
  update(g, dt) {
    let mv = g.ax(); if (g.ptr.down) mv = g.ptr.x < g.W / 3 ? -1 : g.ptr.x > g.W * 2 / 3 ? 1 : 0; if ((g.tap() && g.ptr.x > g.W / 3 && g.ptr.x < g.W * 2 / 3) || g.kd(' ') || g.kd('ArrowUp')) { if (g.y === 0) { g.vy = 7; g.sfx('jump'); } }
    g.lat += mv * 4.5 * dt; const per = 5; // tiles per side
    const total = per * 4; if (g.lat < 0) g.lat += total; if (g.lat >= total) g.lat -= total;
    g.rot = Kit.lerp(g.rot, -Math.floor(g.lat / per) * Math.PI / 2, dt * 8);
    g.vy -= 22 * dt; g.y = Math.max(0, g.y + g.vy * dt); if (g.y === 0) g.vy = Math.max(0, g.vy);
    g.sp = Math.min(22, 9 + g.t * 0.15); g.z += g.sp * dt; const m = Math.floor(g.z); if (m > g.lastM) { g.add(m - g.lastM, 'm'); g.lastM = m; }
    while (g.rows.length < Math.floor(g.z) + 60) g.rows.push(row(g, g.rows.length));
    const R = g.rows[Math.floor(g.z) + 1]; const tile = Math.floor(g.lat); if (g.y === 0 && R && !R[tile]) { g.fallT = (g.fallT || 0) + dt; if (g.fallT > 0.05) { g.sfx('die'); return g.end('Fell into space'); } } else g.fallT = 0;
    g.hud = Math.floor(g.z) + ' m';
  },
  draw(g, c) {
    const cx = g.W / 2, cy = g.H * 0.5, per = 5; Kit.stars(c, g.W, g.H, 0, 0, 80);
    const proj = (u, v, z) => { const s = 300 / (z + 1.2); return [cx + u * s, cy + v * s]; };
    for (let i = 40; i >= 0; i--) { const zi = Math.floor(g.z) + i; const R = g.rows[zi]; if (!R) continue; const z0 = zi - g.z, z1 = z0 + 1; if (z1 < 0.05) continue;
      for (let t = 0; t < per * 4; t++) { if (!R[t]) continue; const side = Math.floor(t / per), k = t % per; const a = side * Math.PI / 2 + g.rot; const ca = Math.cos(a), sa = Math.sin(a);
        const ux0 = -1 + k * 2 / per, ux1 = ux0 + 2 / per; const pt = (ux, z) => { const u = ux * ca - 1 * sa, v = ux * sa + 1 * ca; return proj(u, v, Math.max(0.05, z)); };
        const p1 = pt(ux0, z0), p2 = pt(ux1, z0), p3 = pt(ux1, z1), p4 = pt(ux0, z1); const fade = Math.max(0, 1 - i / 40); c.fillStyle = `hsla(${(zi * 4 + side * 40) % 360},80%,${45 + (k % 2) * 10}%,${fade})`; c.beginPath(); c.moveTo(...p1); c.lineTo(...p2); c.lineTo(...p3); c.lineTo(...p4); c.fill(); c.strokeStyle = `rgba(2,6,23,${fade})`; c.stroke(); } }
    const k = g.lat % per; const ux = -1 + (k + 0.5) * 2 / per; const [px, py] = proj(ux, 1 - g.y * 0.12, 0.6); c.fillStyle = '#e5e7eb'; Kit.rr(c, px - 12, py - 40, 24, 34, 8); c.fill(); Kit.circ(c, px, py - 46, 9, '#e5e7eb'); Kit.circ(c, px + 3, py - 47, 3, '#0f172a');
  } });
function row(g, i) { const per = 5, n = per * 4; const r = Array(n).fill(true); if (i < 12) return r; const lvl = Math.min(0.55, 0.12 + i / 900); for (let t = 0; t < n; t++) if (g.rnd() < lvl) r[t] = false; if (i % 9 === 0) for (let t = 0; t < n; t++) if (g.rnd() < 0.7) r[t] = false; const keep = g.RI(0, n - 1); r[keep] = r[(keep + 1) % n] = true; return r; }

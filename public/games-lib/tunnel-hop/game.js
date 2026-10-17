// Tunnel Hop - original gravity-tunnel runner (Hub build). Walk onto the walls - the tunnel rotates with you.
Kit.run({ fill: true, id: 'gl-tunnel-hop', title: 'TUNNEL HOP', help: 'Left / right (or hold sides) to move - walls become floors\nSpace / tap jump over missing tiles', bg: '#020617',
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
        const p1 = pt(ux0, z0), p2 = pt(ux1, z0), p3 = pt(ux1, z1), p4 = pt(ux0, z1); const fade = Math.max(0, 1 - i / 40); const hu = (zi * 4 + side * 40 + g.z * 6) % 360; const lg = c.createLinearGradient(p1[0], p1[1], p3[0], p3[1]); lg.addColorStop(0, `hsla(${hu},85%,${58 + (k % 2) * 8}%,${fade})`); lg.addColorStop(1, `hsla(${hu + 30},85%,${30 + (k % 2) * 8}%,${fade})`); c.fillStyle = lg; c.beginPath(); c.moveTo(...p1); c.lineTo(...p2); c.lineTo(...p3); c.lineTo(...p4); c.fill(); c.strokeStyle = `rgba(255,255,255,${0.35 * fade})`; c.lineWidth = Math.max(1, 2.2 * (1 - i / 40)); c.beginPath(); c.moveTo(...p1); c.lineTo(...p2); c.stroke(); c.strokeStyle = `rgba(2,6,23,${fade})`; c.lineWidth = 1; c.beginPath(); c.moveTo(...p2); c.lineTo(...p3); c.lineTo(...p4); c.lineTo(...p1); c.stroke(); } }
    const vg = c.createRadialGradient(cx, cy, 6, cx, cy, 190); vg.addColorStop(0, 'rgba(236,254,255,.55)'); vg.addColorStop(0.15, 'rgba(56,189,248,.18)'); vg.addColorStop(1, 'rgba(2,6,23,0)'); c.fillStyle = vg; c.fillRect(0, 0, g.W, g.H);
    const k = g.lat % per; const ux = -1 + (k + 0.5) * 2 / per; const [px, py] = proj(ux, 1 - g.y * 0.12, 0.6); const bob = g.y === 0 ? Math.abs(Math.sin(g.z * 5)) * 4 : 0, lean = Math.max(-0.2, Math.min(0.2, 0)); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(px, py + 2, 14 - g.y * 2, 5, 0, 0, 7); c.fill(); const bg2 = c.createLinearGradient(px - 13, 0, px + 13, 0); bg2.addColorStop(0, '#94a3b8'); bg2.addColorStop(0.5, '#f8fafc'); bg2.addColorStop(1, '#94a3b8'); const ly = Math.sin(g.z * 5) * 5; c.fillStyle = '#1e293b'; Kit.rr(c, px - 10, py - 12 + (ly > 0 ? 0 : 0), 8, 12 + ly * 0.4, 3); c.fill(); Kit.rr(c, px + 2, py - 12, 8, 12 - ly * 0.4, 3); c.fill(); Kit.glow(c, '#22d3ee', 10); c.fillStyle = bg2; Kit.rr(c, px - 13, py - 42 - bob, 26, 34, 9); c.fill(); Kit.noGlow(c); Kit.circ(c, px, py - 49 - bob, 10, '#f1f5f9'); c.fillStyle = '#0ea5e9'; Kit.rr(c, px - 7, py - 53 - bob, 14, 7, 3); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(px - 5, py - 52 - bob, 5, 2);
  } });
function row(g, i) { const per = 5, n = per * 4; const r = Array(n).fill(true); if (i < 12) return r; const lvl = Math.min(0.55, 0.12 + i / 900); for (let t = 0; t < n; t++) if (g.rnd() < lvl) r[t] = false; if (i % 9 === 0) for (let t = 0; t < n; t++) if (g.rnd() < 0.7) r[t] = false; const keep = g.RI(0, n - 1); r[keep] = r[(keep + 1) % n] = true; return r; }

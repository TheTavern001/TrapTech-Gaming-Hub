// Trim Rush - original precision bud-trimming game (Hub build). Portrait, endless, skill-only.
// Snip the fan leaves off a turntable bud: cut the stem CLOSE to the bud for top points, but never touch the bud itself.
// All art is drawn in code (pre-rendered calyx rosette + serrated fan leaves + workshop table). No third-party assets.
(function () {
  const TAU = Math.PI * 2, RB = 33, ATT = RB + 5, CLOSE0 = 0.12, CLOSE1 = 0.38, CLEAN1 = 0.7;
  const STRAINS = [{ lo: '#2d6a1c', hi: '#b8f06c', pi: '#ff9a2e' }, { lo: '#4a2a80', hi: '#d2b0ff', pi: '#ffb347' }, { lo: '#5c8a12', hi: '#f2ff8c', pi: '#ff7a2a' }, { lo: '#1f5e4a', hi: '#d6fce8', pi: '#ffa23c' }];
  const mkc = (w, h) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; };
  const lcg = (seed) => { let s = (seed * 2654435761) % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
  const hex = (h) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',') + ')'; };
  const ease = { out: (t) => 1 - Math.pow(1 - t, 3), back: (t) => { const s = 1.9; t -= 1; return t * t * ((s + 1) * t + s) + 1; } };

  // ---- pre-rendered sprites -------------------------------------------------
  function budSprite(seed, st) { const S = 2, N = 56; const cv = mkc(N * 2 * S, N * 2 * S), c = cv.getContext('2d'); c.scale(S, S); c.translate(N, N); const r = lcg(seed + 7);
    const dark = mix(st.lo, '#000000', 0.55); let g0 = c.createRadialGradient(0, 0, 2, 0, 0, 46); g0.addColorStop(0, mix(st.lo, '#000000', 0.3)); g0.addColorStop(1, dark); c.fillStyle = g0; c.beginPath(); c.arc(0, 0, 45, 0, TAU); c.fill();
    const rings = [[35, 16, 21, 13], [27, 13, 19, 12], [19, 10, 17, 11], [11, 7, 14, 10], [3, 4, 11, 9]];
    for (const [rr, n, len, wd] of rings) for (let k = 0; k < n; k++) { const a = k / n * TAU + r() * 0.3 + rr * 0.05, rad = rr * (0.88 + r() * 0.2); c.save(); c.translate(Math.cos(a) * rad, Math.sin(a) * rad); c.rotate(a);
      const gr = c.createLinearGradient(-len * 0.35, 0, len, 0); gr.addColorStop(0, mix(st.lo, '#000000', 0.45)); gr.addColorStop(0.5, st.lo); gr.addColorStop(1, mix(st.hi, st.lo, r() * 0.35)); c.fillStyle = gr;
      c.beginPath(); c.moveTo(-len * 0.35, 0); c.bezierCurveTo(-len * 0.1, -wd, len * 0.7, -wd * 0.8, len, 0); c.bezierCurveTo(len * 0.7, wd * 0.8, -len * 0.1, wd, -len * 0.35, 0); c.fill(); c.strokeStyle = mix(st.lo, '#000000', 0.5); c.lineWidth = 0.8; c.stroke();
      c.fillStyle = 'rgba(255,255,225,.24)'; c.beginPath(); c.ellipse(len * 0.5, -wd * 0.28, len * 0.26, wd * 0.18, 0, 0, TAU); c.fill();
      if (r() < 0.75) { c.strokeStyle = st.pi; c.lineWidth = 1.3; c.lineCap = 'round'; c.beginPath(); c.moveTo(len * 0.85, 0); c.quadraticCurveTo(len * 1.2, (r() - 0.5) * 12, len * (1.2 + r() * 0.35), (r() - 0.5) * 16); c.stroke(); }
      c.restore(); }
    for (let i = 0; i < 210; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 44; c.fillStyle = 'rgba(255,255,255,' + (0.25 + r() * 0.65).toFixed(2) + ')'; c.beginPath(); c.arc(Math.cos(a) * d, Math.sin(a) * d, 0.5 + r() * 0.9, 0, TAU); c.fill(); }
    const ao = c.createRadialGradient(0, 0, 24, 0, 0, 46); ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,.4)'); c.fillStyle = ao; c.beginPath(); c.arc(0, 0, 46, 0, TAU); c.fill();
    return cv; }
  const LC = new Map();
  function leafSprite(L, kind) { const key = kind + ':' + Math.round(L / 6); if (LC.has(key)) return LC.get(key); L = Math.round(L / 6) * 6; const S = 2, w = Math.ceil(L + 14), h = Math.ceil(L * 0.95 + 12); const cv = mkc(w * S, h * S), c = cv.getContext('2d'); c.scale(S, S); c.translate(10, h / 2);
    const pal = kind === 1 ? ['#8a5a00', '#e8b81a', '#fff2a6'] : kind === 2 ? ['#0f4a44', '#26a090', '#8ee8c8'] : ['#17501a', '#3aa636', '#a2e86e']; const pet = L * 0.3;
    c.lineCap = 'round'; c.strokeStyle = mix(pal[0], '#000000', 0.2); c.lineWidth = kind === 2 ? 7.5 : 4.4; c.beginPath(); c.moveTo(-9, 0); c.lineTo(pet + 3, 0); c.stroke(); c.strokeStyle = pal[1]; c.lineWidth = kind === 2 ? 5 : 2.6; c.beginPath(); c.moveTo(-9, 0); c.lineTo(pet + 3, 0); c.stroke();
    if (kind === 2) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; for (let x = 4; x < pet; x += 6) { c.beginPath(); c.moveTo(x, -3); c.lineTo(x, 3); c.stroke(); } }
    const spec = [[1.25, 0.46], [-1.25, 0.46], [0.85, 0.68], [-0.85, 0.68], [0.42, 0.88], [-0.42, 0.88], [0, 1]];
    for (const [an, ln] of spec) { const len = (L - pet) * ln, Wm = len * 0.12; c.save(); c.translate(pet, 0); c.rotate(an); const T = 8; const gr = c.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, pal[0]); gr.addColorStop(0.55, pal[1]); gr.addColorStop(1, mix(pal[1], pal[2], 0.6)); c.fillStyle = gr; c.strokeStyle = mix(pal[0], '#000000', 0.35); c.lineWidth = 0.9;
      c.beginPath(); for (let i = 0; i <= T; i++) { const u = i / T, hw = Wm * Math.sin(Math.PI * Math.pow(u, 0.72)) * (i % 2 ? 0.74 : 1); c.lineTo(u * len, -hw); } for (let i = T; i >= 0; i--) { const u = i / T, hw = Wm * Math.sin(Math.PI * Math.pow(u, 0.72)) * (i % 2 ? 0.74 : 1); c.lineTo(u * len, hw); } c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.38)'; c.lineWidth = 1; c.beginPath(); c.moveTo(1, 0); c.lineTo(len * 0.92, 0); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.14)'; for (let i = 2; i < T - 1; i++) { const u = i / T; c.beginPath(); c.moveTo(u * len, 0); c.lineTo(u * len + len * 0.07, -Wm * 0.7 * Math.sin(Math.PI * u)); c.moveTo(u * len, 0); c.lineTo(u * len + len * 0.07, Wm * 0.7 * Math.sin(Math.PI * u)); c.stroke(); } c.restore(); }
    const o = { cv, w, h, ox: 10, L }; LC.set(key, o); return o; }
  let BG = null, BGH = 0, BGcy = 0;
  function table(g, cy) { if (BG && BGH === g.H && BGcy === cy) return BG; const S = 2, W = g.W, H = g.H; const cv = mkc(W * S, H * S), c = cv.getContext('2d'); c.scale(S, S); const r = lcg(99);
    for (let y = 0; y < H; y += 56) { c.fillStyle = (y / 56) % 2 ? '#2c1d14' : '#33231a'; c.fillRect(0, y, W, 56); c.fillStyle = 'rgba(0,0,0,.45)'; c.fillRect(0, y + 54, W, 2); for (let i = 0; i < 26; i++) { c.strokeStyle = 'rgba(255,220,170,' + (0.02 + r() * 0.05).toFixed(3) + ')'; c.lineWidth = 0.7; const yy = y + 4 + r() * 46, x0 = r() * W; c.beginPath(); c.moveTo(x0, yy); c.bezierCurveTo(x0 + 60, yy - 3, x0 + 120, yy + 3, x0 + 60 + r() * 200, yy); c.stroke(); } }
    const lamp = c.createRadialGradient(W / 2, cy - 60, 20, W / 2, cy - 60, 420); lamp.addColorStop(0, 'rgba(255,205,130,.34)'); lamp.addColorStop(1, 'rgba(255,205,130,0)'); c.fillStyle = lamp; c.fillRect(0, 0, W, H);
    // steel-framed trimming tray with a dark rubber mat
    const tx = 20, ty = cy - 182, tw = W - 40, th = 364; c.fillStyle = 'rgba(0,0,0,.5)'; c.beginPath(); c.roundRect ? c.roundRect(tx + 4, ty + 12, tw, th, 40) : c.rect(tx + 4, ty + 12, tw, th); c.fill();
    const rr = (x, y, w, h, rad) => { c.beginPath(); c.moveTo(x + rad, y); c.arcTo(x + w, y, x + w, y + h, rad); c.arcTo(x + w, y + h, x, y + h, rad); c.arcTo(x, y + h, x, y, rad); c.arcTo(x, y, x + w, y, rad); c.closePath(); };
    const sg = c.createLinearGradient(tx, ty, tx + tw, ty + th); sg.addColorStop(0, '#e4eaf0'); sg.addColorStop(0.5, '#9aa4ae'); sg.addColorStop(1, '#cfd6dd'); c.fillStyle = sg; rr(tx, ty, tw, th, 40); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; rr(tx + 1, ty + 1, tw - 2, th - 2, 39); c.stroke();
    const mg = c.createRadialGradient(W / 2, cy, 30, W / 2, cy, 210); mg.addColorStop(0, '#22363a'); mg.addColorStop(1, '#101c1f'); c.fillStyle = mg; rr(tx + 12, ty + 12, tw - 24, th - 24, 30); c.fill();
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let x = tx + 22; x < tx + tw - 18; x += 14) for (let y = ty + 22; y < ty + th - 18; y += 14) c.fillRect(x, y, 1.4, 1.4);
    for (const [x, y] of [[tx + 18, ty + 18], [tx + tw - 18, ty + 18], [tx + 18, ty + th - 18], [tx + tw - 18, ty + th - 18]]) { c.fillStyle = '#5a636c'; c.beginPath(); c.arc(x, y, 3.4, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(x - 1, y - 1, 1.2, 0, TAU); c.fill(); }
    const vg = c.createLinearGradient(0, 0, 0, 120); vg.addColorStop(0, 'rgba(8,4,2,.82)'); vg.addColorStop(1, 'rgba(8,4,2,0)'); c.fillStyle = vg; c.fillRect(0, 0, W, 120); const vb = c.createLinearGradient(0, H - 170, 0, H); vb.addColorStop(0, 'rgba(8,4,2,0)'); vb.addColorStop(1, 'rgba(8,4,2,.78)'); c.fillStyle = vb; c.fillRect(0, H - 170, W, 170);
    BG = cv; BGH = H; BGcy = cy; return cv; }

  // ---- game model -----------------------------------------------------------
  function makeBud(g, n) { const st = STRAINS[n % STRAINS.length], cnt = Math.min(9, 4 + Math.floor(n / 2)), leaves = []; const off = g.R(0, TAU);
    for (let i = 0; i < cnt; i++) { const kind = n >= 4 && g.rnd() < 0.2 ? 2 : g.rnd() < 0.09 ? 1 : 0, L = g.R(74, 112) | 0; leaves.push({ a: off + i / cnt * TAU + g.R(-0.12, 0.12), len: L, kind, hp: kind === 2 ? 2 : 1, spr: leafSprite(L, kind), sw: g.R(1.2, 2.4), ph: g.R(0, TAU), swa: Math.min(0.2, 0.02 + n * 0.012), tc: 0, mark: -1 }); }
    return { st, sp: budSprite(g.RI(1, 9999) + n, st), leaves, scars: [], rot: 0, spin: n < 3 ? 0 : (g.rnd() < 0.5 ? -1 : 1) * Math.min(1.5, 0.3 + n * 0.06), nicks: 0, tips: 0, n, x: 0, y: 0 }; }
  function geom(g, b, l) { const ang = l.a + b.rot + Math.sin(g.t * l.sw + l.ph) * l.swa; const dx = Math.cos(ang), dy = Math.sin(ang); return { ang, dx, dy, ax: b.x + dx * ATT, ay: b.y + dy * ATT }; }
  function nextBud(g) { g.cur = makeBud(g, g.budN); g.cur.x = g.bx; g.cur.y = g.by; g.enter = 0; g.budN++; }
  function nick(g, x, y, why) { if (g.nickCd > 0 || !g.cur) return; g.nickCd = 0.6; g.nicks++; g.cur.nicks++; g.combo = 0; g.shake(8, 0.25); g.flash('#ef4444', 0.12); g.sfx('bad'); g.burst(x, y, '#7fc23a', 14, 150, 0.5); g.burst(x, y, '#3a5a1a', 8, 90, 0.6); g.float(x, y - 18, why || 'NICKED!', '#ff6b6b', 20); g.budShake = 0.3;
    const dx = x - g.cur.x, dy = y - g.cur.y, a = Math.atan2(dy, dx) - g.cur.rot; g.cur.scars.push({ a, d: Math.min(RB, Math.hypot(dx, dy)) }); if (g.nicks >= 3) g.end('Bud ruined'); }
  function snip(g, l, t, x, y) { const b = g.cur; if (l.hp > 1) { l.hp--; l.mark = t; g.sfx('click'); g.burst(x, y, '#9be36a', 5, 80, 0.3); return; } l.hp = 0; l.tc = t; l.spr = l.spr; const G = geom(g, b, l);
    let q, base, col; if (t < CLOSE0) { nick(g, x, y, 'TOO CLOSE!'); q = 'X'; base = 0; } else if (t < CLOSE1) { q = 'CLOSE'; base = 30; col = '#ffe066'; g.combo++; } else if (t < CLEAN1) { q = 'CLEAN'; base = 20; col = '#b6ff7a'; } else { q = 'TIP'; base = 10; col = '#cfd8dc'; g.combo = 0; b.tips++; }
    if (q !== 'X') { let pts = base + Math.min(10, g.combo); if (l.kind === 1) { pts *= 2; col = '#ffd23f'; g.sfx('power'); } else g.sfx(q === 'CLOSE' ? 'pop' : 'click'); g.add(pts, 'c'); g.float(x, y - 14, q + ' +' + pts, col, q === 'CLOSE' ? 20 : 16); g.burst(x, y, col, q === 'CLOSE' ? 12 : 6, 120, 0.4); if (q === 'CLOSE') g.shake(2, 0.08); }
    g.pieces.push({ spr: l.spr, ang: G.ang, px: G.ax + G.dx * t * l.len, py: G.ay + G.dy * t * l.len, vx: (G.dx * 60 + g.R(-90, 90)), vy: g.R(-260, -120), r: 0, vr: g.R(-9, 9), tc: t * l.len, life: 1.3 }); }
  function swipe(g, x1, y1, x2, y2) { const b = g.cur; if (!b || g.enter < 0.8) return; const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (len < 0.4) return; const steps = Math.max(1, Math.ceil(len / 4));
    for (let s = 0; s <= steps; s++) { const px = x1 + dx * s / steps, py = y1 + dy * s / steps; if (Math.hypot(px - b.x, py - b.y) < RB - 3) { nick(g, px, py); if (g.state !== 'play') return; }
      for (const l of b.leaves) { if (l.hp <= 0) continue; const G = geom(g, b, l), rx = px - G.ax, ry = py - G.ay, t = (rx * G.dx + ry * G.dy) / l.len, d = Math.abs(-rx * G.dy + ry * G.dx); if (t < 0.02 || t > 1.02) continue; const hw = t < 0.3 ? (l.kind === 2 ? 9 : 7.5) : Math.min(20, 9 + (t - 0.3) * 40); if (d < hw) { snip(g, l, t, px, py); if (g.state !== 'play') return; } } } }
  function layout(g) { g.bx = g.W / 2; g.by = Math.max(300, Math.min(430, Math.round(g.H * 0.47))); if (g.cur) { g.cur.x = g.bx; g.cur.y = g.by; } }

  Kit.run({ id: 'gl-trim-rush', title: 'TRIM RUSH', orient: 'p', fill: true, bg: '#1a110c', onResize: layout,
    help: 'Swipe across a leaf stem to snip it\nCut CLOSE to the bud for top points - touch the bud and it is NICKED\n3 nicks or the clock hits zero: run over',
    init(g) { layout(g); g.time = 22; g.combo = 0; g.nicks = 0; g.nickCd = 0; g.budN = 0; g.done = 0; g.pieces = []; g.trail = []; g.prev = null; g.out = null; g.exit = 0; g.budShake = 0; g.jar = 0; g.kc = { x: g.W / 2, y: g.by + 140, used: false }; nextBud(g); g.cur.x = g.bx; g.cur.y = g.by; g.geom = (l) => geom(g, g.cur, l); },
    update(g, dt) {
      g.time -= dt; g.nickCd -= dt; g.budShake = Math.max(0, g.budShake - dt); if (g.time <= 0) { g.time = 0; return g.end('Out of time'); }
      if (g.enter < 1) g.enter = Math.min(1, g.enter + dt / 0.5); if (g.out) { g.exit += dt / 0.55; if (g.exit >= 1) g.out = null; }
      const b = g.cur; if (b) b.rot += b.spin * dt * Math.min(1, g.enter * 2);
      // input: pointer drag, or keyboard (arrows/WASD move the blade, hold Space to cut)
      const kx = Number(!!(g.keys.ArrowRight || g.keys.d)) - Number(!!(g.keys.ArrowLeft || g.keys.a)), ky = Number(!!(g.keys.ArrowDown || g.keys.s)) - Number(!!(g.keys.ArrowUp || g.keys.w));
      if (kx || ky || g.keys[' ']) g.kc.used = true; g.kc.x = Math.max(10, Math.min(g.W - 10, g.kc.x + kx * dt * 340)); g.kc.y = Math.max(70, Math.min(g.H - 20, g.kc.y + ky * dt * 340));
      let ix, iy, down = false; if (g.ptr.down) { ix = g.ptr.x; iy = g.ptr.y; down = true; } else if (g.keys[' '] && g.kc.used) { ix = g.kc.x; iy = g.kc.y; down = true; }
      if (down) { g.trail.push({ x: ix, y: iy, l: 0.22 }); if (g.prev) swipe(g, g.prev.x, g.prev.y, ix, iy); g.prev = { x: ix, y: iy }; } else g.prev = null;
      for (const t of g.trail) t.l -= dt; g.trail = g.trail.filter(t => t.l > 0);
      for (const p of g.pieces) { p.vy += 1000 * dt; p.px += p.vx * dt; p.py += p.vy * dt; p.r += p.vr * dt; p.life -= dt; } g.pieces = g.pieces.filter(p => p.life > 0);
      if (b && g.enter >= 1 && b.leaves.every(l => l.hp <= 0)) { const perfect = b.nicks === 0, neat = b.tips === 0; const bonus = 25 + (perfect ? 25 : 0) + (perfect && neat ? 15 : 0); g.add(bonus, 'b'); g.done++; g.jar++; g.time = Math.min(22, g.time + Math.max(2.6, 5.4 - b.n * 0.11) + (perfect ? 1 : 0)); g.float(g.bx, g.by - 150, (perfect && neat ? 'PERFECT BUD +' : 'BUD DONE +') + bonus, perfect ? '#ffe066' : '#b6ff7a', 22); g.sfx('line'); g.burst(g.bx, g.by, '#e6ffb0', 22, 190, 0.7); g.out = b; g.exit = 0; nextBud(g); }
      g.hud = 'BUD ' + g.done + (g.combo > 1 ? '  x' + g.combo : '');
    },
    draw(g, c) {
      const W = g.W, H = g.H; c.drawImage(table(g, g.by), 0, 0, W, H);
      const drawBud = (b, alpha, sc, ox, oy) => { c.save(); c.globalAlpha = alpha; c.translate(b.x + ox, b.y + oy); c.scale(sc, sc);
        c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.ellipse(6, 10, 46, 42, 0, 0, TAU); c.fill();
        for (const l of b.leaves) { const G = geom(g, b, l); c.save(); c.translate(G.dx * ATT, G.dy * ATT); c.rotate(G.ang); const s = l.spr;
          if (l.hp > 0) { c.drawImage(s.cv, -s.ox, -s.h / 2, s.w, s.h); if (l.mark >= 0) { c.strokeStyle = '#fff'; c.globalAlpha = alpha * 0.8; c.lineWidth = 1.6; const mx = l.mark * l.len; c.beginPath(); c.moveTo(mx, -6); c.lineTo(mx, 6); c.stroke(); c.globalAlpha = alpha; }
            if (b === g.cur && g.enter >= 1 && g.budN <= 6) { const mx = (CLOSE0 + CLOSE1) / 2 * l.len; c.strokeStyle = 'rgba(255,224,102,.55)'; c.lineWidth = 1.6; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(mx, -12); c.lineTo(mx, 12); c.stroke(); c.setLineDash([]); } }
          else { c.save(); c.beginPath(); c.rect(-s.ox, -s.h / 2, l.tc * l.len + s.ox, s.h); c.clip(); c.drawImage(s.cv, -s.ox, -s.h / 2, s.w, s.h); c.restore(); c.fillStyle = '#d9f2a6'; c.fillRect(l.tc * l.len - 0.6, -2, 1.6, 4); }
          c.restore(); }
        c.save(); c.rotate(b.rot); c.drawImage(b.sp, -56, -56, 112, 112); for (const sc2 of b.scars) { c.save(); c.rotate(sc2.a); c.translate(sc2.d, 0); c.strokeStyle = '#5a1c14'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-4, -5); c.lineTo(4, 5); c.stroke(); c.strokeStyle = 'rgba(255,120,90,.6)'; c.lineWidth = 1; c.stroke(); c.restore(); } c.restore();
        c.restore(); };
      if (g.out) { const e = ease.out(Math.min(1, g.exit)); drawBud(g.out, 1 - e * 0.9, 1 - e * 0.65, -(g.bx - 58) * e, (g.H - 90 - g.by) * e); }
      if (g.cur) { const e = g.enter, oy = -(1 - ease.back(e)) * 300, sk = g.budShake > 0 ? Math.sin(g.t * 70) * 4 * g.budShake / 0.3 : 0; drawBud(g.cur, Math.min(1, e * 3), 1, sk, oy); }
      for (const p of g.pieces) { const s = p.spr; c.save(); c.globalAlpha = Math.min(1, p.life * 2); c.translate(p.px, p.py); c.rotate(p.ang + p.r); c.translate(-p.tc, 0); c.beginPath(); c.rect(p.tc, -s.h / 2, s.w, s.h); c.clip(); c.drawImage(s.cv, -s.ox, -s.h / 2, s.w, s.h); c.restore(); }
      // blade trail + scissors
      if (g.trail.length > 1) { c.save(); c.lineCap = 'round'; c.lineJoin = 'round'; for (const [w, col] of [[9, 'rgba(180,220,255,.18)'], [3.2, 'rgba(255,255,255,.95)']]) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); g.trail.forEach((t, i) => c[i ? 'lineTo' : 'moveTo'](t.x, t.y)); c.stroke(); } c.restore(); }
      const tip = g.prev || (g.kc.used ? g.kc : null); if (tip) { const tr = g.trail, a = tr.length > 1 ? Math.atan2(tr[tr.length - 1].y - tr[0].y, tr[tr.length - 1].x - tr[0].x) : -0.8, open = 0.28 + 0.12 * Math.sin(g.t * 40); c.save(); c.translate(tip.x, tip.y); c.rotate(a);
        for (const s of [-1, 1]) { c.save(); c.rotate(s * open); const gr = c.createLinearGradient(0, -3, 0, 3); gr.addColorStop(0, '#f4f7fa'); gr.addColorStop(1, '#8b95a0'); c.fillStyle = gr; c.beginPath(); c.moveTo(0, 0); c.lineTo(-30, -3.5); c.lineTo(-30, 3.5); c.closePath(); c.fill(); c.strokeStyle = '#59626b'; c.lineWidth = 0.8; c.stroke(); c.fillStyle = s > 0 ? '#e0453a' : '#d03030'; c.beginPath(); c.ellipse(-40, 0, 9, 6, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.stroke(); c.restore(); } c.fillStyle = '#c4ccd4'; c.beginPath(); c.arc(-22, 0, 2.4, 0, TAU); c.fill(); c.restore(); }
      // HUD: clock bar, nick hearts, jar, combo ring
      const pct = Math.max(0, g.time / 22), low = g.time < 6; c.fillStyle = 'rgba(0,0,0,.55)'; c.beginPath(); c.roundRect ? c.roundRect(20, 66, W - 40, 12, 6) : c.rect(20, 66, W - 40, 12); c.fill(); const bg2 = c.createLinearGradient(20, 0, W - 20, 0); bg2.addColorStop(0, low ? '#ff5a4a' : '#7be34f'); bg2.addColorStop(1, low ? '#ffb03a' : '#d8ff7a'); c.fillStyle = bg2; c.beginPath(); c.roundRect ? c.roundRect(21, 67, Math.max(10, (W - 42) * pct), 10, 5) : c.rect(21, 67, (W - 42) * pct, 10); c.fill(); if (low) { c.fillStyle = 'rgba(255,80,60,' + (0.1 + 0.1 * Math.sin(g.t * 12)) + ')'; c.fillRect(0, 0, W, H); }
      for (let i = 0; i < 3; i++) { c.font = 'bold 20px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = i < 3 - g.nicks ? '#ff5a6a' : 'rgba(255,255,255,.18)'; c.fillText('\u2665', W / 2 + (i - 1) * 24, 98); }
      // jar
      const jx = 22, jy = H - 128, jw = 64, jh = 92, lvl = g.jar % 6; c.save(); c.fillStyle = 'rgba(210,235,255,.1)'; c.strokeStyle = 'rgba(230,245,255,.55)'; c.lineWidth = 2; c.beginPath(); c.roundRect ? c.roundRect(jx, jy, jw, jh, 12) : c.rect(jx, jy, jw, jh); c.fill(); c.save(); c.clip(); const fh = (lvl + (g.jar > 0 && lvl === 0 ? 6 : 0)) / 6 * (jh - 10); const jg = c.createLinearGradient(0, jy + jh - fh, 0, jy + jh); jg.addColorStop(0, '#b8f06c'); jg.addColorStop(1, '#2d6a1c'); c.fillStyle = jg; for (let x = jx; x < jx + jw; x += 12) { c.beginPath(); c.arc(x + 6, jy + jh - fh + 4, 9, 0, TAU); c.fill(); } c.fillRect(jx, jy + jh - fh + 4, jw, fh); c.restore(); c.stroke(); c.fillStyle = '#6b4a2e'; c.fillRect(jx - 3, jy - 9, jw + 6, 11); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(jx + 8, jy + 8, 5, jh - 22); c.restore(); c.fillStyle = '#f3e7d3'; c.font = 'bold 12px system-ui'; c.textAlign = 'center'; c.fillText('BUDS ' + g.done, jx + jw / 2, jy + jh + 14);
      const cx2 = W - 54, cy2 = H - 80; c.lineWidth = 6; c.strokeStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.arc(cx2, cy2, 30, 0, TAU); c.stroke(); c.strokeStyle = g.combo >= 10 ? '#ffd23f' : '#9be36a'; c.beginPath(); c.arc(cx2, cy2, 30, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, g.combo / 10)); c.stroke(); g.txt(String(g.combo), cx2, cy2 - 2, 24, g.combo >= 10 ? '#ffd23f' : '#fff'); g.txt('COMBO', cx2, cy2 + 42, 10, '#cdbfa8');
      if (g.budN <= 2) g.txt('Swipe the STEM close to the bud - never the bud', W / 2, H - 56, 13, '#ffe9b8');
    } });
})();

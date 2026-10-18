(function () { const r = Kit.run; Kit.run = function (d) { const o = d.draw; d.draw = function (g, c) { o.apply(this, arguments); c.save(); try { POST(g, c); } catch (e) {} c.restore(); }; Kit.run = r; return r.call(this, d); }; function POST(g, c) {
const t = g.t, W = g.W, H = g.H;
  // butterflies fluttering over the temple floor
  for (let i = 0; i < 4; i++) { const x = W / 2 + Math.cos(t * 0.5 + i * 1.7) * (110 + i * 25), y = H / 2 + Math.sin(t * 0.7 + i * 2.1) * (180 - i * 20), fl = Math.abs(Math.sin(t * 14 + i * 3)), col = ['#ff7ab8', '#ffd23f', '#7ad7ff', '#c79bff'][i]; c.save(); c.translate(x, y); c.rotate(Math.cos(t * 0.5 + i * 1.7) * 0.6); c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(5, 10, 8 * fl + 1, 3, 0, 0, 7); c.fill(); c.fillStyle = col; for (const s of [-1, 1]) { c.beginPath(); c.ellipse(s * 5 * fl, -2, 6 * fl + 0.8, 8, s * 0.5, 0, 7); c.fill(); c.beginPath(); c.ellipse(s * 4 * fl, 5, 4 * fl + 0.6, 5, -s * 0.4, 0, 7); c.fill(); } c.fillStyle = '#222'; c.fillRect(-1, -8, 2, 15); c.restore(); }
  c.globalCompositeOperation = 'lighter'; for (let i = 0; i < 12; i++) { const x = (i * 97 + Math.sin(t + i) * 20) % W, y = (i * 61 + t * 12) % H; c.fillStyle = 'rgba(255,240,150,' + (0.3 + 0.3 * Math.sin(t * 3 + i)) + ')'; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); }
} })(); // v8 scenery+sprite overlay
// Orb Coil - original marble-chain shooter (Hub build, Zuma-style). Code-drawn temple art, glossy orbs.
(function () { const D = 26, COLS = ['#e8343a', '#2f7fe8', '#2fbf4a', '#ffc21f', '#b26bff', '#ff8a2a'];
  let PATH = null, LEN = 0, CUM = null; function mkPath(W, H) { const pts = [], cx = W / 2, cy = H * 0.5; const turns = 2.35, R0 = Math.min(W, H) * 0.47, R1 = 70; for (let i = 0; i <= 1600; i++) { const t = i / 1600, a = -Math.PI / 2 + t * turns * 6.283, r = R0 + (R1 - R0) * t; pts.push([cx + Math.cos(a) * r * (W / Math.min(W, H) * 0.98), cy + Math.sin(a) * r * 0.98]); }
    pts.unshift([pts[0][0] - 0, pts[0][1] - 200]); CUM = [0]; for (let i = 1; i < pts.length; i++) CUM.push(CUM[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); PATH = pts; LEN = CUM[CUM.length - 1]; }
  function at(s) { s = Math.max(0, Math.min(LEN, s)); let lo = 0, hi = CUM.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (CUM[m] < s) lo = m; else hi = m; } const t = (s - CUM[lo]) / ((CUM[hi] - CUM[lo]) || 1); return [PATH[lo][0] + (PATH[hi][0] - PATH[lo][0]) * t, PATH[lo][1] + (PATH[hi][1] - PATH[lo][1]) * t]; }
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = f < 0 ? 0 : 255, a = Math.abs(f); return 'rgb(' + Math.round((t - r) * a + r) + ',' + Math.round((t - g) * a + g) + ',' + Math.round((t - b) * a + b) + ')'; }
  function orb(c, x, y, col, r, rot) { const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r); g.addColorStop(0, shade(col, 0.6)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.5)); c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, r * 0.62, rot, rot + 1.2); c.stroke(); c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.42, r * 0.22, r * 0.14, -0.6, 0, 7); c.fill(); }
  let BG = null; function bg(g) { if (BG) return BG; const cv = document.createElement('canvas'); cv.width = g.W; cv.height = g.H; const c = cv.getContext('2d'); let s = 5; const rn = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const sg = c.createRadialGradient(g.W / 2, g.H / 2, 40, g.W / 2, g.H / 2, g.H * 0.7); sg.addColorStop(0, '#c9a86a'); sg.addColorStop(1, '#6a5030'); c.fillStyle = sg; c.fillRect(0, 0, g.W, g.H);
    for (let y = 0; y < g.H; y += 36) for (let x = (y / 36) % 2 * -30; x < g.W; x += 60) { c.strokeStyle = 'rgba(60,40,20,.35)'; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, 58, 34); c.fillStyle = `rgba(255,240,200,${rn() * 0.08})`; c.fillRect(x + 2, y + 2, 56, 32); }
    for (let i = 0; i < 40; i++) { c.fillStyle = 'rgba(60,110,40,.45)'; c.beginPath(); c.ellipse(rn() * g.W, rn() * g.H, 8 + rn() * 18, 4 + rn() * 8, rn() * 3, 0, 7); c.fill(); }
    // carved groove
    c.lineCap = 'round'; c.lineJoin = 'round'; const tr = (w, col) => { c.beginPath(); for (let i = 0; i < PATH.length; i += 4) i ? c.lineTo(PATH[i][0], PATH[i][1]) : c.moveTo(PATH[i][0], PATH[i][1]); c.strokeStyle = col; c.lineWidth = w; c.stroke(); };
    c.save(); c.translate(2, 3); tr(D + 14, 'rgba(255,240,200,.35)'); c.restore(); tr(D + 12, '#4a3418'); tr(D + 4, '#2a1c0c'); c.save(); c.translate(-1, -2); tr(D - 6, 'rgba(0,0,0,.25)'); c.restore();
    // end hole: golden idol pit
    const e = PATH[PATH.length - 1]; const hg = c.createRadialGradient(e[0], e[1], 4, e[0], e[1], 34); hg.addColorStop(0, '#000'); hg.addColorStop(0.6, '#1a0a00'); hg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = hg; c.beginPath(); c.arc(e[0], e[1], 34, 0, 7); c.fill(); c.strokeStyle = '#ffd23f'; c.lineWidth = 4; c.beginPath(); c.arc(e[0], e[1], 22, 0, 7); c.stroke();
    c.fillStyle = 'rgba(30,20,10,.6)'; Kit.rr(c, g.W / 2 - 74, g.H - 40, 148, 22, 6); c.fill(); c.fillStyle = '#9dff7a'; c.font = 'bold 11px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('\u2618 TEMPLE OF TERPS \u00b7 21+', g.W / 2, g.H - 29);
    return (BG = cv); }
  Kit.run({ fill: true, id: 'gl-orb-coil', title: 'ORB COIL', orient: 'p', help: 'Aim with mouse / drag, release or click to shoot\nSpace / tap the idol swaps orbs. Match 3+ before the coil reaches the pit', bg: '#6a5030',
    init(g) { mkPath(g.W, g.H); BG = null; g.ch = []; g.head = 260; g.spd = 70; g.rush = 1.2; g.shots = []; g.nc = 4; g.cur = g.RI(0, 3); g.next = g.RI(0, 3); g.aim = -Math.PI / 2; g.combo = 0; g.fx = []; g.idle = 0; for (let i = 0; i < 18; i++) g.ch.push({ c: g.RI(0, 3), off: 0 }); },
    update(g, dt) { const cx = g.W / 2, cy = g.H * 0.5;
      g.nc = Math.min(6, 4 + Math.floor(g.t / 60)); g.spd = 14 + Math.min(40, g.t * 0.25); const v = g.rush > 0 ? 220 : g.spd; g.rush -= dt; g.head += v * dt * (g.ch.length ? 1 : 0);
      // feed new orbs at the tail
      const tail = g.head - (g.ch.length - 1) * D; if (tail > D * 1.2 || !g.ch.length) { if (!g.ch.length) g.head = D; else g.ch.push({ c: pickC(g), off: -D }); }
      for (const b of g.ch) b.off *= Math.pow(0.0005, dt);
      if (g.head >= LEN - 8) { g.shake(14, 0.6); g.sfx('bad'); return g.end('The coil reached the pit'); }
      if (g.ptr.x !== undefined) g.aim = Math.atan2(g.ptr.y - cy, g.ptr.x - cx); if (g.keys.ArrowLeft) g.aim -= dt * 3; if (g.keys.ArrowRight) g.aim += dt * 3;
      const swap = g.kd(' ') || (g.ptr.pressed && Math.hypot(g.ptr.x - cx, g.ptr.y - cy) < 34); if (swap) { [g.cur, g.next] = [g.next, g.cur]; g.sfx('click'); }
      else if ((g.ptr.released && Math.hypot(g.ptr.x - cx, g.ptr.y - cy) > 40) || g.kd('ArrowUp') || g.kd('Enter')) { if (g.shots.length < 2) { g.shots.push({ x: cx + Math.cos(g.aim) * 30, y: cy + Math.sin(g.aim) * 30, vx: Math.cos(g.aim) * 900, vy: Math.sin(g.aim) * 900, c: g.cur }); g.cur = g.next; g.next = pickC(g); g.sfx('shoot'); } }
      for (const s of g.shots) { s.x += s.vx * dt; s.y += s.vy * dt; let hit = -1, bd = D * 0.95; g.ch.forEach((b, i) => { const [x, y] = at(g.head - i * D + b.off); const d = Math.hypot(x - s.x, y - s.y); if (d < bd) { bd = d; hit = i; } });
        if (hit >= 0) { s.dead = true; const [hx, hy] = at(g.head - hit * D); const [fx, fy] = at(g.head - hit * D + 4); const front = (s.x - hx) * (fx - hx) + (s.y - hy) * (fy - hy) > 0; const k = front ? hit : hit + 1; g.ch.splice(k, 0, { c: s.c, off: 0 }); if (k === 0) g.head += D; else { g.head += D; for (let i = k; i < g.ch.length; i++) g.ch[i].off -= 0; for (let i = 0; i < k; i++) g.ch[i].off -= D; } g.combo = 0; resolve(g, k); }
        if (s.x < -40 || s.y < -40 || s.x > g.W + 40 || s.y > g.H + 40) s.dead = true; } g.shots = g.shots.filter(s => !s.dead);
      for (const f of g.fx) { f.l -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 300 * dt; } g.fx = g.fx.filter(f => f.l > 0); g.hud = ''; },
    draw(g, c) { c.drawImage(bg(g), 0, 0); const cx = g.W / 2, cy = g.H * 0.5;
      // danger glow near pit
      const dz = Math.max(0, (g.head - (LEN - 500)) / 500); if (dz > 0) { const e = PATH[PATH.length - 1]; c.fillStyle = `rgba(255,40,20,${dz * 0.35 * (0.6 + Math.sin(g.t * 8) * 0.4)})`; c.beginPath(); c.arc(e[0], e[1], 80, 0, 7); c.fill(); }
      for (let i = g.ch.length - 1; i >= 0; i--) { const b = g.ch[i]; const s = g.head - i * D + b.off; if (s < 0) continue; const [x, y] = at(s); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.arc(x + 2, y + 3, D / 2, 0, 7); c.fill(); orb(c, x, y, COLS[b.c], D / 2, -s / (D / 2)); }
      for (const s of g.shots) orb(c, s.x, s.y, COLS[s.c], D / 2, 0);
      for (const f of g.fx) { c.globalAlpha = Math.max(0, f.l * 2); c.fillStyle = f.c; c.beginPath(); c.arc(f.x, f.y, 3, 0, 7); c.fill(); c.globalAlpha = 1; }
      // aim guide
      c.save(); c.setLineDash([2, 10]); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3; c.beginPath(); c.moveTo(cx + Math.cos(g.aim) * 36, cy + Math.sin(g.aim) * 36); c.lineTo(cx + Math.cos(g.aim) * 260, cy + Math.sin(g.aim) * 260); c.stroke(); c.restore();
      // stone idol shooter
      c.save(); c.translate(cx, cy); c.rotate(g.aim + Math.PI / 2); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(3, 5, 32, 30, 0, 0, 7); c.fill(); const ig = c.createRadialGradient(-8, -10, 4, 0, 0, 34); ig.addColorStop(0, '#7ad06a'); ig.addColorStop(1, '#2a6a2a'); c.fillStyle = ig; c.strokeStyle = '#1a3a14'; c.lineWidth = 3; c.beginPath(); c.ellipse(0, 4, 30, 28, 0, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-11, -14, 7, 0, 7); c.arc(11, -14, 7, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#111'; c.beginPath(); c.arc(-11, -15, 3, 0, 7); c.arc(11, -15, 3, 0, 7); c.fill(); orb(c, 0, -26, COLS[g.cur], D / 2 - 1, 0); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.arc(0, 14, 8, 0, 7); c.fill(); orb(c, 0, 14, COLS[g.next], 6, 0); c.restore(); },
    hudDraw(g, c) { c.textAlign = 'left'; c.textBaseline = 'top'; c.font = 'bold 26px serif'; c.lineWidth = 5; c.strokeStyle = 'rgba(0,0,0,.55)'; const s = String(Math.floor(g.score)); c.strokeText(s, 14, 30); c.fillStyle = '#ffd23f'; c.fillText(s, 14, 30); } });
  function pickC(g) { const present = [...new Set(g.ch.map(b => b.c))]; return present.length && g.rnd() < 0.8 ? present[g.RI(0, present.length - 1)] : g.RI(0, g.nc - 1); }
  function resolve(g, k) { if (k < 0 || k >= g.ch.length) return; const col = g.ch[k].c; let a = k, b = k; while (a > 0 && g.ch[a - 1].c === col) a--; while (b < g.ch.length - 1 && g.ch[b + 1].c === col) b++; const n = b - a + 1; if (n < 3) return;
    g.combo++; const pts = n * 10 * g.combo + (g.combo > 1 ? 50 * g.combo : 0); g.add(pts, 'k'); for (let i = a; i <= b; i++) { const [x, y] = at(g.head - i * D); for (let j = 0; j < 6; j++) g.fx.push({ x, y, vx: (Math.random() - 0.5) * 260, vy: -Math.random() * 200, l: 0.6, c: COLS[col] }); }
    const [mx, my] = at(g.head - ((a + b) / 2) * D); g.float(mx, my - 20, (g.combo > 1 ? 'COMBO x' + g.combo + ' ' : '') + '+' + pts, '#fff6c8', g.combo > 1 ? 22 : 16); g.sfx(g.combo > 1 ? 'power' : 'line'); g.shake(3 + g.combo * 2, 0.15);
    // front part stays; back part slides forward (smoothly via offset)
    g.ch.splice(a, n); for (let i = a; i < g.ch.length; i++) g.ch[i].off -= n * D; if (a === 0) { g.head -= n * D; for (const bb of g.ch) bb.off += n * D; }
    if (a > 0 && a < g.ch.length && g.ch[a - 1].c === g.ch[a].c) resolve(g, a); }
})();

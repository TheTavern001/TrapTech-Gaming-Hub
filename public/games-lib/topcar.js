// Shared top-down driving engine (original code, MIT). Player car always drives forward, you steer (+ optional brake/drift).
// cfg.mode: 'getaway' (collect cash bags, cops chase), 'derby' (closed arena, ram AI cars, health), 'taxi' (city grid, fares + timer)
window.TopCar = function (cfg) {
  const WW = cfg.world || 1600, WH = cfg.world || 1600;
  let GND = null, GKEY = null;
  function ground(g) { if (GND && GKEY === g.obj) return GND; GKEY = g.obj; const cv = document.createElement('canvas'); cv.width = WW; cv.height = WH; const c = cv.getContext('2d'); let s = 5; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; const taxi = cfg.mode === 'taxi';
    c.fillStyle = taxi ? '#2b2f36' : cfg.mode === 'derby' ? '#a9783a' : '#2f3a2c'; c.fillRect(0, 0, WW, WH);
    for (let i = 0; i < WW * WH / 380; i++) { c.fillStyle = taxi ? (R() < 0.5 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.1)') : (R() < 0.5 ? 'rgba(255,230,170,.1)' : 'rgba(70,40,10,.14)'); c.fillRect(R() * WW, R() * WH, 1 + R() * 3, 1 + R() * 2); }
    if (taxi) { for (let x = 75; x < WW; x += 300) { c.fillStyle = '#e6c04a'; c.fillRect(x - 3, 0, 2, WH); c.fillRect(x + 1, 0, 2, WH); } for (let y = 75; y < WH; y += 300) { c.fillStyle = '#e6c04a'; c.fillRect(0, y - 3, WW, 2); c.fillRect(0, y + 1, WW, 2); }
      c.fillStyle = 'rgba(245,245,235,.8)'; for (let x = 75; x < WW; x += 300) for (let y = 75; y < WH; y += 300) { for (let k = -48; k <= 48; k += 12) { c.fillRect(x + k - 3, y - 70, 6, 18); c.fillRect(x + k - 3, y + 52, 6, 18); c.fillRect(x - 70, y + k - 3, 18, 6); c.fillRect(x + 52, y + k - 3, 18, 6); } }
      for (const o of g.obj) if (o.b) { c.fillStyle = '#9097a2'; c.fillRect(o.x - 14, o.y - 14, o.w + 28, o.h + 28); c.fillStyle = '#c5cbd3'; c.fillRect(o.x - 14, o.y - 14, o.w + 28, 3); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; for (let k = 0; k < o.w + 28; k += 24) { c.beginPath(); c.moveTo(o.x - 14 + k, o.y - 14); c.lineTo(o.x - 14 + k, o.y + o.h + 14); c.stroke(); } }
      for (const o of g.obj) if (o.b) CarArt.roof(c, o.x, o.y, o.w, o.h, Math.floor(o.x * 3 + o.y)); else CarArt.tree(c, o.x, o.y, o.r); }
    else { if (cfg.mode === 'derby') { c.strokeStyle = 'rgba(70,40,10,.3)'; c.lineWidth = 9; c.lineCap = 'round'; for (let i = 0; i < 26; i++) { const cx = R() * WW, cy = R() * WH, rad = 60 + R() * 220; c.beginPath(); c.arc(cx, cy, rad, R() * 6, R() * 6 + 1.6); c.stroke(); } }
      for (const o of g.obj) if (cfg.mode === 'derby') CarArt.tire(c, o.x, o.y, o.r); else CarArt.tree(c, o.x, o.y, o.r);
      if (cfg.mode === 'derby') for (let k = 20; k < WW; k += 38) for (const [x, y] of [[k, 18], [k, WH - 18], [18, k], [WW - 18, k]]) CarArt.tire(c, x, y, 17); }
    if (taxi) { c.strokeStyle = '#d93a2b'; c.lineWidth = 10; c.setLineDash([26, 26]); c.strokeRect(5, 5, WW - 10, WH - 10); c.strokeStyle = '#f5f5f0'; c.lineDashOffset = -26; c.strokeRect(5, 5, WW - 10, WH - 10); c.setLineDash([]); }
    return (GND = cv); }
  Kit.run({ id: cfg.id, title: cfg.title, help: cfg.help, bg: cfg.bg || '#14532d', fill: true,
    init(g) { const s0 = cfg.mode === 'taxi' ? 975 : WW / 2; g.car = { x: s0, y: s0, a: -Math.PI / 2, sp: 0, hp: 100 }; g.ai = []; g.obj = []; g.next = 2; g.heat = 1; g.ht = 0; g.time = cfg.mode === 'taxi' ? 45 : 0; g.fares = 0;
      if (cfg.mode === 'taxi') { for (let x = 100; x < WW; x += 300) for (let y = 100; y < WH; y += 300) g.obj.push({ x: x + 50, y: y + 50, w: 150, h: 150, b: true }); newFare(g); }
      else { for (let i = 0; i < (cfg.mode === 'derby' ? 14 : 70); i++) { const x = g.R(60, WW - 60), y = g.R(60, WH - 60); if (Math.hypot(x - WW / 2, y - WH / 2) > 160) g.obj.push({ x, y, r: g.R(14, 28) }); } }
      if (cfg.mode === 'getaway') { g.bags = []; for (let i = 0; i < 3; i++) g.bags.push(bag(g)); }
      if (cfg.mode === 'derby') for (let i = 0; i < 4; i++) g.ai.push(rival(g)); },
    update(g, dt) {
      const c0 = g.car; let st = g.ax(); if (g.ptr.down) st = g.ptr.x < g.W / 2 ? -1 : 1; const brake = g.keys.ArrowDown || g.keys.s || (g.ptr.down && g.ptr.y > g.H - 140);
      const top = (cfg.speed || 260) + (cfg.mode === 'getaway' ? g.t * 1.5 : 0); c0.sp = Kit.lerp(c0.sp, brake ? top * 0.45 : top, dt * 2); c0.a += st * (brake ? 4 : 3) * dt; c0.x += Math.cos(c0.a) * c0.sp * dt; c0.y += Math.sin(c0.a) * c0.sp * dt;
      if (st && g.frames % 3 === 0) g.parts.push({ x: g.W / 2 - Math.cos(c0.a) * 14, y: g.H / 2 - Math.sin(c0.a) * 14, vx: g.R(-20, 20), vy: g.R(-20, 20), l: 0.5, m: 0, c: 'rgba(200,200,200,.5)', s: 6, gr: 0 });
      if (c0.x < 15 || c0.y < 15 || c0.x > WW - 15 || c0.y > WH - 15) { c0.x = Kit.clamp(c0.x, 15, WW - 15); c0.y = Kit.clamp(c0.y, 15, WH - 15); c0.a += Math.PI * 0.8; c0.sp *= 0.4; damage(g, 10); g.sfx('thud'); if (g.state !== 'play') return; }
      for (const o of g.obj) { const hit = o.b ? Kit.cr(c0.x, c0.y, 12, o) : Math.hypot(o.x - c0.x, o.y - c0.y) < o.r + 12; if (hit) { if (cfg.mode === 'getaway') { g.burst(g.W / 2, g.H / 2, ['#ef4444', '#fbbf24'], 40, 260); g.sfx('boom'); return g.end('Wrecked'); } c0.x -= Math.cos(c0.a) * 6; c0.y -= Math.sin(c0.a) * 6; c0.a += Math.PI * 0.6; c0.sp *= 0.3; damage(g, cfg.mode === 'taxi' ? 0 : 8); g.sfx('thud'); g.shake(5); if (cfg.mode === 'taxi') g.time -= 1; if (g.state !== 'play') return; } }
      if (cfg.mode === 'getaway') { const s = Math.floor(g.t * 2); if (s > (g.ls || 0)) { g.add(s - (g.ls || 0), 's'); g.ls = s; }
        for (const b of g.bags) if (Math.hypot(b.x - c0.x, b.y - c0.y) < 26) { g.add(100 * g.heat, 'b'); g.float(g.W / 2, g.H / 2 - 40, '+' + 100 * g.heat, '#34d399', 20); g.sfx('coin'); Object.assign(b, bag(g)); g.heat = Math.min(6, g.heat + 0.5); }
        g.next -= dt; if (g.next <= 0 && g.ai.length < 2 + Math.floor(g.heat * 1.5)) { g.next = Math.max(0.8, 3 - g.heat * 0.3); const a = g.R(0, 6.28); g.ai.push({ x: c0.x + Math.cos(a) * 500, y: c0.y + Math.sin(a) * 500, a: a + Math.PI, sp: 240 + g.heat * 20, cop: true }); } }
      if (cfg.mode === 'taxi') { g.time -= dt; if (g.time <= 0) return g.end('Shift over'); const F = g.fare; const tgt = F.picked ? F.to : F.from; if (Math.hypot(tgt.x - c0.x, tgt.y - c0.y) < 40 && c0.sp < (cfg.speed || 260) * 0.7) { if (!F.picked) { F.picked = true; F.t0 = g.t; g.sfx('click'); g.float(g.W / 2, g.H / 2 - 40, 'PICKED UP', '#fbbf24'); } else { const fast = Math.max(0, 25 - (g.t - F.t0)); const v = 50 + Math.round(fast * 8); g.add(v, 'f'); g.time += 6 + fast * 0.3; g.fares++; g.float(g.W / 2, g.H / 2 - 40, 'FARE +' + v, '#34d399', 22); g.sfx('power'); newFare(g); } } }
      if (cfg.mode === 'derby') { if (g.ai.filter(a => !a.dead).length < 3 + Math.floor(g.t / 30)) g.ai.push(rival(g)); }
      for (const p of g.ai) { if (p.dead) continue; const tx = p.cop ? c0.x + Math.cos(c0.a) * 60 : c0.x, ty = p.cop ? c0.y + Math.sin(c0.a) * 60 : c0.y; const ta = Math.atan2(ty - p.y, tx - p.x); let d = ta - p.a; d = Math.atan2(Math.sin(d), Math.cos(d)); p.a += Kit.clamp(d, -2.3 * dt, 2.3 * dt); p.x += Math.cos(p.a) * p.sp * dt; p.y += Math.sin(p.a) * p.sp * dt; p.x = Kit.clamp(p.x, 15, WW - 15); p.y = Kit.clamp(p.y, 15, WH - 15);
        for (const o of g.obj) if (!o.b && Math.hypot(o.x - p.x, o.y - p.y) < o.r + 10) { if (p.cop) { p.dead = true; g.add(50 * Math.floor(g.heat), 'k'); } else { p.a += 2; } }
        if (Math.hypot(p.x - c0.x, p.y - c0.y) < 24) { if (p.cop) { g.burst(g.W / 2, g.H / 2, ['#3b82f6', '#ef4444'], 40, 260); g.sfx('boom'); return g.end('Busted!'); }
          // derby impact: damage scales with closing speed and angle (ramming nose-first hurts them, side hits hurt you)
          const myNose = Math.cos(Math.atan2(p.y - c0.y, p.x - c0.x) - c0.a); const dmgThem = Math.max(5, 40 * Math.max(0, myNose) * c0.sp / 260); const dmgMe = Math.max(3, 22 * Math.max(0, Math.cos(Math.atan2(c0.y - p.y, c0.x - p.x) - p.a)));
          p.hp -= dmgThem; g.add(Math.round(dmgThem), 'h'); damage(g, dmgMe); const ang = Math.atan2(p.y - c0.y, p.x - c0.x); p.x += Math.cos(ang) * 30; p.y += Math.sin(ang) * 30; c0.x -= Math.cos(ang) * 14; c0.y -= Math.sin(ang) * 14; c0.sp *= 0.5; g.sfx('hit'); g.shake(6); g.burst(g.W / 2 + Math.cos(ang) * 16, g.H / 2 + Math.sin(ang) * 16, ['#fbbf24', '#9ca3af'], 14, 200);
          if (p.hp <= 0) { p.dead = true; g.add(150, 'w'); g.float(g.W / 2, g.H / 2 - 50, 'WRECKED +150', '#fbbf24', 22); g.sfx('boom'); } if (g.state !== 'play') return; }
        for (const q of g.ai) if (q !== p && !q.dead && p.cop && q.cop && Math.hypot(q.x - p.x, q.y - p.y) < 22) { p.dead = q.dead = true; g.add(100 * Math.floor(g.heat), 'k'); g.sfx('boom'); g.burst(p.x - c0.x + g.W / 2, p.y - c0.y + g.H / 2, ['#3b82f6', '#ef4444', '#fbbf24'], 30, 220); } }
      for (const p of g.ai) if (p.dead && !p.fx) { p.fx = true; g.burst(p.x - c0.x + g.W / 2, p.y - c0.y + g.H / 2, ['#9ca3af', '#f97316'], 20, 200); }
      g.ai = g.ai.filter(p => !p.dead || cfg.mode === 'derby' ? !p.dead : false);
      g.hud = cfg.mode === 'taxi' ? Math.ceil(g.time) + 's  FARES ' + g.fares : cfg.mode === 'derby' ? 'HP ' + Math.max(0, Math.round(c0.hp)) : 'HEAT ' + Math.floor(g.heat);
    },
    draw(g, c) {
      const c0 = g.car, ox = g.W / 2 - c0.x, oy = g.H / 2 - c0.y; c.fillStyle = cfg.mode === 'taxi' ? '#12151b' : cfg.mode === 'derby' ? '#2b1d10' : (cfg.ground || '#166534'); c.fillRect(0, 0, g.W, g.H); c.save(); c.translate(ox, oy);
      c.drawImage(ground(g), 0, 0);
      if (g.bags) for (const b of g.bags) { const bob = Math.sin(g.t * 5 + b.x) * 2; c.save(); c.shadowColor = '#34d399'; c.shadowBlur = 16; c.fillStyle = '#10b981'; Kit.rr(c, b.x - 11, b.y - 11 + bob, 22, 22, 6); c.fill(); c.restore(); c.fillStyle = '#6ee7b7'; Kit.rr(c, b.x - 11, b.y - 11 + bob, 22, 8, 5); c.fill(); g.txt('$', b.x, b.y + 2 + bob, 14, '#052e16'); }
      if (g.fare) { const F = g.fare, t = F.picked ? F.to : F.from, pu = 30 + Math.sin(g.t * 6) * 4; c.save(); c.globalCompositeOperation = 'lighter'; const rg = c.createRadialGradient(t.x, t.y, 4, t.x, t.y, pu + 10); rg.addColorStop(0, 'rgba(251,191,36,.05)'); rg.addColorStop(0.8, 'rgba(251,191,36,.3)'); rg.addColorStop(1, 'rgba(251,191,36,0)'); c.fillStyle = rg; c.beginPath(); c.arc(t.x, t.y, pu + 10, 0, 7); c.fill(); c.restore(); c.strokeStyle = '#fbbf24'; c.lineWidth = 3; c.setLineDash([8, 6]); c.lineDashOffset = -g.t * 30; c.beginPath(); c.arc(t.x, t.y, pu, 0, 7); c.stroke(); c.setLineDash([]); g.txt(F.picked ? 'DROP' : 'FARE', t.x, t.y, 11, '#fde68a'); }
      const kinds = ['sedan', 'suv', 'van'], carAt = (x, y, a, col, kind, o) => CarArt.car(c, x, y, col, Object.assign({ kind, angle: a + Math.PI / 2, scale: 0.72, t: g.t }, o || {}));
      for (const p of g.ai) if (!p.dead) { const kd = cfg.mode === 'derby' ? 'derby' : p.cop ? 'cop' : kinds[Math.abs(Math.floor((p.c || '#000').charCodeAt(2) + (p.x > 0 ? 1 : 0))) % 3]; carAt(p.x, p.y, p.a, p.cop ? '#f8fafc' : p.c, kd, { siren: p.cop }); }
      carAt(c0.x, c0.y, c0.a, cfg.carColor || '#f97316', cfg.mode === 'taxi' ? 'taxi' : cfg.mode === 'derby' ? 'derby' : 'sedan', { brake: !!(g.keys.ArrowDown || g.keys.s || (g.ptr.down && g.ptr.y > g.H - 140)) }); c.restore();
      if (g.fare) { const F = g.fare, t = F.picked ? F.to : F.from; const a = Math.atan2(t.y - c0.y, t.x - c0.x); if (Math.hypot(t.x - c0.x, t.y - c0.y) > 160) { c.save(); c.translate(g.W / 2 + Math.cos(a) * 80, g.H / 2 + Math.sin(a) * 80); c.rotate(a); c.fillStyle = '#fbbf24'; c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, -10); c.lineTo(-8, 10); c.fill(); c.restore(); } }
      if (cfg.mode === 'derby') { c.fillStyle = '#1d2a66'; c.fillRect(20, 46, g.W - 40, 8); c.fillStyle = c0.hp > 30 ? '#34d399' : '#ef4444'; c.fillRect(20, 46, (g.W - 40) * Math.max(0, c0.hp) / 100, 8); }
    } });
  function bag(g) { return { x: g.R(80, WW - 80), y: g.R(80, WH - 80) }; }
  function rival(g) { const side = g.RI(0, 3); return { x: side < 2 ? g.R(50, WW - 50) : side === 2 ? 40 : WW - 40, y: side >= 2 ? g.R(50, WH - 50) : side === 0 ? 40 : WH - 40, a: 0, sp: 150 + g.R(0, 40) + Math.min(80, g.t), hp: 60, c: g.pick(['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#e5e7eb']) }; }
  function newFare(g) { const spot = () => ({ x: 75 + g.RI(0, Math.floor(WW / 300) - 1) * 300, y: 75 + g.RI(0, Math.floor(WH / 300) - 1) * 300 + g.R(40, 200) }); g.fare = { from: spot(), to: spot(), picked: false }; }
  function damage(g, d) { if (cfg.mode !== 'derby' || !d) return; g.car.hp -= d; g.flash('#ef4444', 0.06); if (g.car.hp <= 0) g.end('Totaled'); }
};

// Arrow Hero - original Archero-style room crawler (Hub build, Survival & Horde). Drag anywhere to move (virtual stick); stand still
// and your archer auto-fires at the nearest enemy. Clear the room, walk through the gate, pick 1 of 3 skills on level-up.
// Enemies: slimes (charge), mages (aimed orbs), bats (weave), turrets (radial bursts); every 5th room is a boss. Endless rooms.
(function () {
  const RX = 20, RY = 80, RW = 360, RH = 560;
  const SK = [['Multishot', 'Fire 1 extra arrow', g => g.multi++], ['Ricochet', 'Arrows bounce to 1 more foe', g => g.rico++], ['Front +1', 'Extra arrow straight ahead', g => g.front++], ['Attack speed', '+25% fire rate', g => g.rate *= 0.8], ['Attack +30%', 'More damage', g => g.dmg *= 1.3], ['Heal', 'Restore 40% HP', g => g.hp = Math.min(g.maxhp, g.hp + g.maxhp * 0.4)], ['Max HP +20%', 'Tougher', g => { g.maxhp *= 1.2; g.hp *= 1.2; }], ['Piercing', 'Arrows pass through 1 foe', g => g.pierce++], ['Diagonal', '+2 diagonal arrows', g => g.diag++], ['Bloodthirst', 'Kills heal 2 HP', g => g.leech += 2]];
  let FLOOR = null;
  function floor(W, H) { if (FLOOR) return FLOOR; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); c.fillStyle = '#1a1410'; c.fillRect(0, 0, W, H);
    let s = 5; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let y = RY; y < RY + RH; y += 40) for (let x = RX; x < RX + RW; x += 40) { const v = 70 + R() * 20; c.fillStyle = `rgb(${v + 30},${v + 18},${v})`; c.fillRect(x + 1, y + 1, 38, 38); c.fillStyle = 'rgba(255,255,255,.06)'; c.fillRect(x + 1, y + 1, 38, 3); if (R() < 0.12) { c.strokeStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.moveTo(x + R() * 40, y); c.lineTo(x + R() * 40, y + 40); c.stroke(); } if (R() < 0.08) { c.fillStyle = 'rgba(60,120,40,.5)'; c.beginPath(); c.arc(x + R() * 40, y + R() * 40, 5, 0, 7); c.fill(); } }
    const vg = c.createRadialGradient(200, 360, 120, 200, 360, 420); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); c.fillStyle = vg; c.fillRect(RX, RY, RW, RH);
    const wall = (x, y, w, h) => { const gg = c.createLinearGradient(x, y, x, y + h); gg.addColorStop(0, '#6b5a4a'); gg.addColorStop(1, '#3a2e24'); c.fillStyle = gg; c.fillRect(x, y, w, h); c.strokeStyle = 'rgba(0,0,0,.35)'; for (let yy = y; yy < y + h; yy += 10) for (let xx = x + ((yy / 10) % 2) * 10; xx < x + w; xx += 20) c.strokeRect(xx, yy, 20, 10); };
    wall(0, RY - 30, W, 30); wall(0, RY + RH, W, 30); wall(0, RY, RX, RH); wall(RX + RW, RY, RX, RH);
    for (const x of [60, 340]) { c.fillStyle = '#ffb347'; c.shadowColor = '#ffb347'; c.shadowBlur = 18; c.beginPath(); c.arc(x, RY - 12, 5, 0, 7); c.fill(); c.shadowBlur = 0; }
    c.fillStyle = 'rgba(157,255,122,.5)'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('\u2618 ARROW HERO \u00b7 21+', 200, RY + RH + 20); return (FLOOR = cv); }
  function spawnRoom(g) { g.en = []; g.eb = []; g.ar = []; g.gate = false; const n = g.room; g.obs = []; for (let i = 0; i < Math.min(5, 1 + Math.floor(n / 2)); i++) {
      // Keep a permanent navigable center lane to the exit and boss.
      // Otherwise several randomly placed obstacles can seal off a room.
      const w = 40 + g.R(0, 40);
      const left = g.RI(0, 1) === 0;
      const x = left ? RX + 18 + g.R(0, 62) :
        RX + RW - 18 - w - g.R(0, 62);
      g.obs.push({ x, y: RY + 120 + g.R(0, RH - 300), w, h: 30 });
    }
    const pos = () => { for (let k = 0; k < 30; k++) { const x = RX + 30 + g.R(0, RW - 60), y = RY + 40 + g.R(0, RH * 0.55); if (!g.obs.some(o => x > o.x - 16 && x < o.x + o.w + 16 && y > o.y - 16 && y < o.y + o.h + 16)) return [x, y]; } return [200, 150]; };
    const hpK = 1 + n * 0.22;
    if (n % 5 === 0) { const [x, y] = [200, RY + 120]; g.en.push({ t: 'boss', x, y, r: 34, hp: 80 * hpK, max: 80 * hpK, cd: 1.5, ph: 0, vx: 0, vy: 0 }); }
    else { const cnt = Math.min(12, 2 + Math.floor(n * 0.8)); for (let i = 0; i < cnt; i++) { const t = g.pick(n < 2 ? ['slime', 'slime', 'mage'] : n < 4 ? ['slime', 'mage', 'bat'] : ['slime', 'mage', 'bat', 'turret']); const [x, y] = pos(); g.en.push({ t, x, y, r: t === 'turret' ? 16 : 14, hp: { slime: 5, mage: 4, bat: 3, turret: 8 }[t] * hpK, max: { slime: 5, mage: 4, bat: 3, turret: 8 }[t] * hpK, cd: g.R(0.8, 2), ph: g.R(0, 6), vx: 0, vy: 0 }); } }
    g.p.x = 200; g.p.y = RY + RH - 50; g.p.inv = 0.8; }
  function blocked(g, x, y, r) { if (x < RX + r || x > RX + RW - r || y < RY + r || y > RY + RH - r) return true; return g.obs.some(o => x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r); }
  // A fast arrow can travel more than an enemy's diameter in one phone frame.
  // Collision must cover the entire frame segment, not only the destination.
  function arrowHitsEnemy(x0, y0, x1, y1, e) {
    const dx = x1 - x0, dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    const t = len2 > 0 ? Math.max(0, Math.min(1,
      ((e.x - x0) * dx + (e.y - y0) * dy) / len2)) : 0;
    const px = x0 + t * dx - e.x, py = y0 + t * dy - e.y;
    return px * px + py * py < (e.r + 4) * (e.r + 4);
  }
  function fire(g) { const p = g.p; const tg = g.en.reduce((b, e) => { const d = Math.hypot(e.x - p.x, e.y - p.y); return d < b.d ? { e, d } : b; }, { e: null, d: 1e9 }).e; if (!tg) return; const a = Math.atan2(tg.y - p.y, tg.x - p.x); p.face = a; const shots = []; const spread = 0.12; for (let i = 0; i <= g.multi; i++) shots.push([a, i * 0.09]); for (let i = 0; i < g.front; i++) shots.push([a + (i % 2 ? 1 : -1) * spread * Math.ceil((i + 1) / 2), 0]); for (let i = 0; i < g.diag; i++) { shots.push([a + 0.7, 0], [a - 0.7, 0]); }
    for (const [ang, delay] of shots) g.ar.push({ x: p.x, y: p.y, vx: Math.cos(ang) * 620, vy: Math.sin(ang) * 620, d: delay, rico: g.rico, pierce: g.pierce, hit: new Set() }); g.sfx('shoot'); }
  Kit.run({ id: 'gl-arrow-hero', title: 'ARROW HERO', help: 'Drag anywhere to move (WASD / arrows). Stand still to auto-shoot\nClear the room, walk through the gate, pick a skill on level-up', bg: '#1a1410', stick: 'always', stickZone: () => true, stickAlsoPtr: true,
    // The virtual stick ordinarily consumes touch pointerdown. This game also
    // needs that tap to select one of three level-up cards.
    init(g) { g.p = { x: 200, y: 600, inv: 1, face: -1.57, walk: 0 }; g.hp = g.maxhp = 120; g.rate = 0.55; g.dmg = 1; g.multi = 0; g.rico = 0; g.front = 0; g.diag = 0; g.pierce = 0; g.leech = 0; g.cd = 0; g.room = 1; g.xp = 0; g.need = 6; g.lvl = 1; g.kills = 0; g.choose = null; spawnRoom(g); g.hud = ''; },
    update(g, dt) { const p = g.p;
      if (g.choose) { let pick = -1; for (let i = 0; i < 3; i++) if (g.kd(String(i + 1))) pick = i; if (g.ptr.pressed) {
        const i = Math.floor((g.ptr.y - 250) / 90);
        // Only a tap inside the VISIBLE 320×76 card is a selection,
        // not a stray touch on the overlay or a gap between cards.
        if (g.ptr.x >= 40 && g.ptr.x <= 360 &&
            i >= 0 && i < 3 && g.ptr.y < 250 + i * 90 + 76) pick = i;
      } if (pick >= 0) { SK[g.choose[pick]][2](g); g.float(200, 330, SK[g.choose[pick]][0], '#9dff7a', 22); g.choose = null; g.sfx('power'); g.stick.on = false; g.stick.x = g.stick.y = 0; } return; }
      let mx = g.ax(), my = g.ay(); const ml = Math.hypot(mx, my); if (ml > 1) { mx /= ml; my /= ml; } const moving = ml > 0.15; if (moving) { const sp = 190; const nx = p.x + mx * sp * dt, ny = p.y + my * sp * dt; if (!blocked(g, nx, p.y, 12)) p.x = nx; if (!blocked(g, p.x, ny, 12)) p.y = ny; p.walk += dt * 10; p.face = Math.atan2(my, mx); }
      p.inv -= dt; g.cd -= dt; if (!moving && g.cd <= 0 && g.en.length) { fire(g); g.cd = g.rate; }
      if (g.gate && p.y < RY + 30 && Math.abs(p.x - 200) < 40) { g.room++; g.mark('r', g.room); g.add(100 * g.room, 'room'); spawnRoom(g); return; }
      // arrows
      for (const a of g.ar) { if (a.d > 0) { a.d -= dt; continue; } const x0 = a.x, y0 = a.y; a.x += a.vx * dt; a.y += a.vy * dt; if (a.x < RX || a.x > RX + RW || a.y < RY || a.y > RY + RH) a.dead = true;
        for (const e of g.en) { if (a.hit.has(e) || e.dead) continue; if (arrowHitsEnemy(x0, y0, a.x, a.y, e)) { a.hit.add(e); e.hp -= 1.6 * g.dmg; e.fl = 0.08; g.sfx('hit'); if (e.hp <= 0) { e.dead = true; g.kills++; g.mark('k', g.kills); g.add(e.t === 'boss' ? 1000 : 25, 'kill'); g.burst(e.x, e.y, e.t === 'boss' ? ['#f97316', '#fde047', '#fff'] : ['#84cc16', '#a855f7', '#fff'], e.t === 'boss' ? 40 : 12, 180); g.hp = Math.min(g.maxhp, g.hp + g.leech); g.xp += e.t === 'boss' ? 10 : 1; }
            if (a.pierce > 0) a.pierce--; else if (a.rico > 0) { a.rico--; const nx = g.en.filter(o => !o.dead && !a.hit.has(o)).sort((u, v) => Math.hypot(u.x - a.x, u.y - a.y) - Math.hypot(v.x - a.x, v.y - a.y))[0]; if (nx) { const an = Math.atan2(nx.y - a.y, nx.x - a.x); a.vx = Math.cos(an) * 620; a.vy = Math.sin(an) * 620; } else a.dead = true; } else a.dead = true; break; } } }
      g.ar = g.ar.filter(a => !a.dead && a.x > 0 && a.x < 400 && a.y > 0 && a.y < 700); g.en = g.en.filter(e => !e.dead);
      if (g.xp >= g.need) { g.xp -= g.need; g.need = Math.round(g.need * 1.35); g.lvl++; const idx = []; while (idx.length < 3) { const i = g.RI(0, SK.length - 1); if (!idx.includes(i)) idx.push(i); } g.choose = idx; g.sfx('power'); }
      if (!g.en.length && !g.gate) { g.gate = true; g.float(200, RY + 60, 'GATE OPEN \u2191', '#9dff7a', 20); g.sfx('coin'); }
      // enemies
      for (const e of g.en) { e.fl = Math.max(0, (e.fl || 0) - dt); e.cd -= dt; e.ph += dt; const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
        if (e.t === 'slime') { const sp = e.cd < 0 && e.cd > -0.5 ? 170 : 35; if (e.cd < -0.5) e.cd = g.R(1, 2); const nx = e.x + dx / d * sp * dt, ny = e.y + dy / d * sp * dt; if (!blocked(g, nx, ny, e.r)) { e.x = nx; e.y = ny; } }
        else if (e.t === 'bat') { const a = Math.atan2(dy, dx) + Math.sin(e.ph * 3) * 1.1; const nx = e.x + Math.cos(a) * 110 * dt, ny = e.y + Math.sin(a) * 110 * dt; if (nx > RX && nx < RX + RW && ny > RY && ny < RY + RH) { e.x = nx; e.y = ny; } }
        else if (e.t === 'mage') { if (e.cd <= 0) { e.cd = g.R(1.6, 2.4); g.eb.push({ x: e.x, y: e.y, vx: dx / d * 160, vy: dy / d * 160, r: 6, c: '#c084fc' }); } }
        else if (e.t === 'turret') { if (e.cd <= 0) { e.cd = 2.6; for (let i = 0; i < 8; i++) { const a = i * 0.785 + e.ph * 0.3; g.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 150, vy: Math.sin(a) * 150, r: 6, c: '#f87171' }); } } }
        else if (e.t === 'boss') { e.x += Math.sin(e.ph * 0.8) * 70 * dt; if (e.cd <= 0) { e.cd = Math.max(0.9, 1.8 - g.room * 0.02); const k = Math.floor(e.ph) % 3; if (k === 0) for (let i = 0; i < 14; i++) { const a = i * 0.449; g.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, r: 7, c: '#fb923c' }); } else for (let i = -2; i <= 2; i++) { const a = Math.atan2(dy, dx) + i * 0.18; g.eb.push({ x: e.x, y: e.y, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, r: 7, c: '#fde047' }); } } }
        if (d < e.r + 12 && p.inv <= 0) { g.hp -= e.t === 'boss' ? 22 : 9; p.inv = 0.8; g.sfx('bad'); g.shake(6); } }
      for (const b of g.eb) { b.x += b.vx * dt; b.y += b.vy * dt; if (b.x < RX || b.x > RX + RW || b.y < RY || b.y > RY + RH) b.dead = true; if (!b.dead && Math.hypot(b.x - p.x, b.y - p.y) < b.r + 10 && p.inv <= 0) { b.dead = true; g.hp -= 7 + g.room * 0.5; p.inv = 0.6; g.sfx('bad'); g.shake(5); } }
      g.eb = g.eb.filter(b => !b.dead);
      if (g.hp <= 0) return g.end('Fell in room ' + g.room); },
    draw(g, c) { c.drawImage(floor(g.W, g.H), 0, 0); const p = g.p, t = g.t;
      // gate
      c.fillStyle = g.gate ? '#0a0a0a' : '#3a2e24'; c.fillRect(170, RY - 30, 60, 30); if (g.gate) { const gg = c.createLinearGradient(0, RY - 30, 0, RY + 20); gg.addColorStop(0, 'rgba(157,255,122,.6)'); gg.addColorStop(1, 'rgba(157,255,122,0)'); c.fillStyle = gg; c.fillRect(170, RY - 30, 60, 50); } else { c.fillStyle = '#6b4a2a'; for (let i = 0; i < 6; i++) c.fillRect(172 + i * 10, RY - 28, 4, 28); }
      for (const o of g.obs) { c.fillStyle = '#3a2e24'; Kit.rr(c, o.x - 3, o.y - 3, o.w + 6, o.h + 6, 10); c.fill(); const og = c.createLinearGradient(o.x, o.y, o.x + o.w, o.y + o.h); og.addColorStop(0, '#0e7490'); og.addColorStop(1, '#164e63'); c.fillStyle = og; Kit.rr(c, o.x, o.y, o.w, o.h, 8); c.fill(); c.strokeStyle = 'rgba(255,255,255,' + (0.25 + Math.sin(t * 2 + o.x) * 0.1) + ')'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(o.x + 8, o.y + o.h * 0.4); c.quadraticCurveTo(o.x + o.w / 2, o.y + o.h * 0.25, o.x + o.w - 8, o.y + o.h * 0.45); c.stroke(); }
      for (const e of g.en) { c.save(); c.translate(e.x, e.y); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(2, e.r * 0.8, e.r, e.r * 0.35, 0, 0, 7); c.fill(); const fl = e.fl > 0;
        if (e.t === 'slime') { const sq = 1 + Math.sin(e.ph * 8) * 0.08; c.scale(1 / sq, sq); const gg = c.createRadialGradient(-4, -6, 2, 0, 0, e.r); gg.addColorStop(0, fl ? '#fff' : '#bef264'); gg.addColorStop(1, '#3f6212'); c.fillStyle = gg; c.beginPath(); c.moveTo(-e.r, 6); c.quadraticCurveTo(-e.r, -e.r, 0, -e.r); c.quadraticCurveTo(e.r, -e.r, e.r, 6); c.quadraticCurveTo(0, 12, -e.r, 6); c.fill(); }
        else if (e.t === 'mage') { c.fillStyle = fl ? '#fff' : '#6d28d9'; c.beginPath(); c.moveTo(0, -e.r - 10); c.lineTo(e.r, e.r); c.lineTo(-e.r, e.r); c.fill(); c.fillStyle = '#e9d5ff'; c.beginPath(); c.arc(0, -2, 5, 0, 7); c.fill(); c.fillStyle = '#c084fc'; c.shadowColor = '#c084fc'; c.shadowBlur = 10; c.beginPath(); c.arc(e.r, -6 + Math.sin(e.ph * 4) * 2, 4, 0, 7); c.fill(); c.shadowBlur = 0; }
        else if (e.t === 'bat') { const w = Math.sin(e.ph * 20) * 0.6; c.fillStyle = fl ? '#fff' : '#3b0764'; c.beginPath(); c.ellipse(0, 0, 7, 8, 0, 0, 7); c.fill(); for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 5, 0); c.quadraticCurveTo(sd * 16, -12 * (1 + w), sd * 22, 2); c.quadraticCurveTo(sd * 14, 0, sd * 5, 5); c.fill(); } c.fillStyle = '#f87171'; c.fillRect(-3, -3, 2, 2); c.fillRect(1, -3, 2, 2); }
        else if (e.t === 'turret') { c.fillStyle = fl ? '#fff' : '#57534e'; c.beginPath(); c.arc(0, 0, e.r, 0, 7); c.fill(); c.fillStyle = '#ef4444'; c.beginPath(); c.arc(0, 0, 6 + Math.sin(e.ph * 5), 0, 7); c.fill(); c.strokeStyle = '#a8a29e'; c.lineWidth = 4; for (let i = 0; i < 4; i++) { const a = i * 1.571 + e.ph * 0.3; c.beginPath(); c.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); c.lineTo(Math.cos(a) * 20, Math.sin(a) * 20); c.stroke(); } }
        else { const gg = c.createRadialGradient(-10, -12, 4, 0, 0, e.r); gg.addColorStop(0, fl ? '#fff' : '#fdba74'); gg.addColorStop(1, '#7c2d12'); c.fillStyle = gg; c.beginPath(); c.arc(0, 0, e.r, 0, 7); c.fill(); c.fillStyle = '#fde047'; c.beginPath(); c.moveTo(-18, -26); c.lineTo(-10, -44); c.lineTo(-4, -28); c.moveTo(18, -26); c.lineTo(10, -44); c.lineTo(4, -28); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(-10, -4, 5, 0, 7); c.arc(10, -4, 5, 0, 7); c.fill(); c.fillStyle = '#ef4444'; c.beginPath(); c.arc(-10, -4, 2, 0, 7); c.arc(10, -4, 2, 0, 7); c.fill(); }
        c.restore(); if (e.hp < e.max) { const w = e.t === 'boss' ? 80 : 28; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(e.x - w / 2, e.y - e.r - 14, w, 4); c.fillStyle = '#ef4444'; c.fillRect(e.x - w / 2, e.y - e.r - 14, w * Math.max(0, e.hp / e.max), 4); } }
      for (const b of g.eb) { c.fillStyle = b.c; c.shadowColor = b.c; c.shadowBlur = 10; c.beginPath(); c.arc(b.x, b.y, b.r, 0, 7); c.fill(); c.shadowBlur = 0; c.fillStyle = '#fff'; c.beginPath(); c.arc(b.x, b.y, b.r * 0.4, 0, 7); c.fill(); }
      for (const a of g.ar) { if (a.d > 0) continue; const an = Math.atan2(a.vy, a.vx); c.save(); c.translate(a.x, a.y); c.rotate(an); c.strokeStyle = '#d6b48a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-14, 0); c.lineTo(6, 0); c.stroke(); c.fillStyle = '#e5e7eb'; c.beginPath(); c.moveTo(10, 0); c.lineTo(4, -3); c.lineTo(4, 3); c.fill(); c.fillStyle = '#22c55e'; c.fillRect(-14, -3, 5, 2); c.fillRect(-14, 1, 5, 2); c.restore(); }
      if (!(p.inv > 0 && Math.sin(t * 30) > 0)) { c.save(); c.translate(p.x, p.y); c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, 12, 12, 4, 0, 0, 7); c.fill(); const bob = Math.sin(p.walk) * 2; c.fillStyle = '#166534'; c.beginPath(); c.moveTo(-10, 10); c.lineTo(10, 10); c.lineTo(8, -6 + bob); c.lineTo(-8, -6 + bob); c.fill(); c.fillStyle = '#f0c8a0'; c.beginPath(); c.arc(0, -11 + bob, 7, 0, 7); c.fill(); c.fillStyle = '#15803d'; c.beginPath(); c.moveTo(-8, -12 + bob); c.lineTo(0, -24 + bob); c.lineTo(9, -12 + bob); c.fill(); c.rotate(p.face); c.strokeStyle = '#7a4a22'; c.lineWidth = 3; c.beginPath(); c.arc(8, 0, 12, -1.1, 1.1); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(8 + Math.cos(-1.1) * 12, Math.sin(-1.1) * 12); c.lineTo(8 + Math.cos(1.1) * 12, Math.sin(1.1) * 12); c.stroke(); c.restore(); }
      // HP bar over player
      c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(p.x - 18, p.y - 36, 36, 5); c.fillStyle = '#22c55e'; c.fillRect(p.x - 18, p.y - 36, 36 * Math.max(0, g.hp / g.maxhp), 5);
      if (g.choose) { c.fillStyle = 'rgba(5,5,12,.78)'; c.fillRect(0, 0, g.W, g.H); c.fillStyle = '#fde047'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center'; c.fillText('LEVEL ' + g.lvl + '! CHOOSE A SKILL', 200, 220); g.choose.forEach((i, k) => { const y = 250 + k * 90; const gg = c.createLinearGradient(40, y, 360, y + 76); gg.addColorStop(0, '#1e3a8a'); gg.addColorStop(1, '#4c1d95'); c.fillStyle = gg; Kit.rr(c, 40, y, 320, 76, 14); c.fill(); c.strokeStyle = '#a5b4fc'; c.lineWidth = 2; Kit.rr(c, 40, y, 320, 76, 14); c.stroke(); c.fillStyle = '#fff'; c.font = 'bold 20px sans-serif'; c.fillText(SK[i][0], 200, y + 34); c.font = '13px sans-serif'; c.fillStyle = '#c7d2fe'; c.fillText(SK[i][1] + '   [' + (k + 1) + ']', 200, y + 58); }); } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.font = 'bold 11px sans-serif'; c.fillStyle = '#fde68a'; c.fillText('ROOM ' + g.room + (g.room % 5 === 0 ? ' \u00b7 BOSS' : '') + '  \u00b7  LV ' + g.lvl, 14, 48); const w = 150; c.fillStyle = 'rgba(255,255,255,.15)'; c.fillRect(g.W - w - 14, 22, w, 8); c.fillStyle = '#60a5fa'; c.fillRect(g.W - w - 14, 22, w * Math.min(1, g.xp / g.need), 8); c.textAlign = 'right'; c.fillStyle = '#fff'; c.font = 'bold 10px sans-serif'; c.fillText('HP ' + Math.ceil(g.hp) + ' / ' + Math.round(g.maxhp), g.W - 14, 44); } });
})();

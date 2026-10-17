(function () { const r = Kit.run; Kit.run = function (d) { const o = d.draw; d.draw = function (g, c) { o.apply(this, arguments); c.save(); try { POST(g, c); } catch (e) {} c.restore(); }; Kit.run = r; return r.call(this, d); }; function POST(g, c) {
const t = g.t, W = g.W;
  // camera flashes in the crowd
  for (let i = 0; i < 9; i++) { const ph = (t * 0.9 + i * 0.37) % 2.6; if (ph < 0.12) { const x = (i * 83 + 40) % W, y = 135 + (i * 29) % 70; c.globalCompositeOperation = 'lighter'; const gl = c.createRadialGradient(x, y, 1, x, y, 26); gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.beginPath(); c.arc(x, y, 26, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; } }
  // ring bell on right post, swinging
  const bx = W - 38, by = 238; c.save(); c.translate(bx, by); c.fillStyle = '#4a4a4a'; c.fillRect(-2, -14, 4, 14); c.rotate(Math.sin(t * 7) * (g.bellT > 0 ? 0.35 : 0.04)); const bg2 = c.createLinearGradient(-9, 0, 9, 0); bg2.addColorStop(0, '#f6d56a'); bg2.addColorStop(0.5, '#c8941a'); bg2.addColorStop(1, '#7a5508'); c.fillStyle = bg2; c.beginPath(); c.moveTo(-9, 12); c.quadraticCurveTo(-9, -2, 0, -4); c.quadraticCurveTo(9, -2, 9, 12); c.closePath(); c.fill(); c.fillStyle = '#5a3d08'; c.beginPath(); c.arc(0, 13, 2.4, 0, 7); c.fill(); c.restore();
  // overhead arena lights
  c.globalCompositeOperation = 'lighter'; for (const x of [W * 0.2, W * 0.5, W * 0.8]) { const lg = c.createRadialGradient(x, 0, 2, x, 0, 120); lg.addColorStop(0, 'rgba(255,240,210,.28)'); lg.addColorStop(1, 'rgba(255,240,210,0)'); c.fillStyle = lg; c.fillRect(x - 120, 0, 240, 150); }
} })(); // v8 scenery+sprite overlay
// Knockout Ring - original Punch-Out!!-style boxing (Hub build, Combat). Your boxer is seen from behind; the opponent telegraphs every
// attack (eye flash + wind-up). Dodge left/right (swipe or A/D / arrows) or block (hold the bottom / S / down), then counter while he
// is open: tap the upper half (left/right hand by side, or J/K). Hits during his recovery are counters (x2, stun meter). KO him to
// face a faster, trickier fighter. Your stamina bar is your life; a full meter of counters lets you throw a Star Uppercut (U / double tap).
(function () {
  const FIGHTERS = [{ n: 'BIG BUD', skin: '#e0a37a', trunk: '#16a34a', hair: '#2a1a10', hp: 100, tell: 0.75, moves: ['L', 'R'] }, { n: 'HAZE HURRICANE', skin: '#8d5a3a', trunk: '#7c3aed', hair: '#111', hp: 120, tell: 0.62, moves: ['L', 'R', 'U'] }, { n: 'KUSH KONG', skin: '#c68a5a', trunk: '#dc2626', hair: '#6b3a1a', hp: 150, tell: 0.52, moves: ['L', 'R', 'U', 'F'] }, { n: 'THE STICKY ICKY', skin: '#f0c8a0', trunk: '#0891b2', hair: '#f5d76e', hp: 170, tell: 0.44, moves: ['L', 'R', 'U', 'F'] }];
  let BG = null;
  function bg(W, H) { if (BG) return BG; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d'); const g = c.createRadialGradient(200, 200, 20, 200, 260, 520); g.addColorStop(0, '#3a2a4a'); g.addColorStop(1, '#07050c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    let s = 11; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(${150 + R() * 100},${120 + R() * 80},${120 + R() * 100},${0.15 + R() * 0.25})`; c.beginPath(); c.arc(R() * W, 120 + R() * 200, 3 + R() * 3, 0, 7); c.fill(); }
    for (let i = 0; i < 18; i++) { c.fillStyle = 'rgba(255,255,255,' + R() * 0.8 + ')'; c.fillRect(R() * W, 120 + R() * 200, 2, 2); }
    for (const x of [60, 200, 340]) { const lg = c.createRadialGradient(x, 0, 2, x, 0, 220); lg.addColorStop(0, 'rgba(255,250,220,.4)'); lg.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = lg; c.fillRect(0, 0, W, 260); }
    const fl = c.createLinearGradient(0, 330, 0, H); fl.addColorStop(0, '#2563eb'); fl.addColorStop(1, '#1e3a8a'); c.fillStyle = fl; c.beginPath(); c.moveTo(60, 330); c.lineTo(340, 330); c.lineTo(400, H); c.lineTo(0, H); c.fill(); c.save(); c.globalAlpha = 0.15; c.fillStyle = '#9dff7a'; c.font = 'bold 120px serif'; c.textAlign = 'center'; c.translate(200, 560); c.scale(1.4, 0.45); c.fillText('\u2618', 0, 40); c.restore();
    for (const [y, col] of [[250, '#ef4444'], [282, '#fff'], [314, '#3b82f6']]) { c.strokeStyle = col; c.lineWidth = 4; c.beginPath(); c.moveTo(0, y + 70); c.lineTo(60, y); c.lineTo(340, y); c.lineTo(400, y + 70); c.stroke(); }
    c.fillStyle = '#d4d4d8'; c.fillRect(54, 230, 10, 110); c.fillRect(336, 230, 10, 110); c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 116, W, 18); c.fillStyle = '#9dff7a'; c.font = 'bold 10px sans-serif'; c.textAlign = 'center'; c.fillText('\u2618 GREEN GLOVES BOXING CLUB \u00b7 21+', 200, 129); return (BG = cv); }
  function opp(c, g, t) { const o = g.o, F = o.f; const ox = 200 + o.dx, oy = 270 + o.dy; c.save(); c.translate(ox, oy); const sh = o.hitT > 0 ? Math.sin(t * 80) * 6 : 0; c.translate(sh, 0); const s = 1.15;
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 150, 90, 16, 0, 0, 7); c.fill();
    const bodyG = c.createLinearGradient(-70, 0, 70, 0); bodyG.addColorStop(0, shade(F.skin, 0.65)); bodyG.addColorStop(0.5, F.skin); bodyG.addColorStop(1, shade(F.skin, 0.7)); c.fillStyle = bodyG; c.beginPath(); c.moveTo(-70 * s, -10); c.quadraticCurveTo(-80 * s, 60, -50 * s, 100); c.lineTo(50 * s, 100); c.quadraticCurveTo(80 * s, 60, 70 * s, -10); c.quadraticCurveTo(0, -40, -70 * s, -10); c.fill();
    c.strokeStyle = shade(F.skin, 0.75); c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 70); c.moveTo(-30, 20); c.quadraticCurveTo(-15, 30, 0, 22); c.moveTo(30, 20); c.quadraticCurveTo(15, 30, 0, 22); c.stroke();
    c.fillStyle = F.trunk; c.fillRect(-55 * s, 95, 110 * s, 55); c.fillStyle = '#fff'; c.fillRect(-55 * s, 95, 110 * s, 7);
    // head
    c.fillStyle = shade(F.skin, 0.85); c.fillRect(-14, -48, 28, 20); const hg = c.createRadialGradient(-8, -80, 4, 0, -70, 40); hg.addColorStop(0, F.skin); hg.addColorStop(1, shade(F.skin, 0.7)); c.fillStyle = hg; c.beginPath(); c.ellipse(0, -72, 30, 36, 0, 0, 7); c.fill(); c.fillStyle = F.hair; c.beginPath(); c.ellipse(0, -96, 30, 16, 0, Math.PI, 0); c.fill();
    const tell = o.st === 'tell'; c.fillStyle = tell ? '#fde047' : '#fff'; if (tell) { c.shadowColor = '#fde047'; c.shadowBlur = 16; } c.beginPath(); c.ellipse(-11, -76, 6, tell ? 5 : 4, 0, 0, 7); c.ellipse(11, -76, 6, tell ? 5 : 4, 0, 0, 7); c.fill(); c.shadowBlur = 0; c.fillStyle = '#111'; c.beginPath(); c.arc(-11, -76, 2.4, 0, 7); c.arc(11, -76, 2.4, 0, 7); c.fill();
    c.strokeStyle = '#3a1a10'; c.lineWidth = 3; c.beginPath(); c.moveTo(-18, tell ? -88 : -86); c.lineTo(-5, -84); c.moveTo(18, tell ? -88 : -86); c.lineTo(5, -84); c.stroke(); c.strokeStyle = '#7a2a1a'; c.lineWidth = 2.5; c.beginPath(); if (o.st === 'stun' || o.st === 'down') c.arc(0, -56, 7, 0, Math.PI * 2); else c.arc(0, -52, 8, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
    if (o.st === 'stun') { for (let i = 0; i < 3; i++) { const a = t * 4 + i * 2.1; c.fillStyle = '#fde047'; c.font = 'bold 14px sans-serif'; c.fillText('\u2605', Math.cos(a) * 34 - 6, -112 + Math.sin(a) * 8); } }
    // gloves
    const gl = (x, y, r, col) => { const gg = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); gg.addColorStop(0, '#fca5a5'); gg.addColorStop(0.4, col); gg.addColorStop(1, shade(col, 0.5)); c.fillStyle = gg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.fillStyle = '#fff'; c.fillRect(x - r * 0.6, y + r * 0.6, r * 1.2, r * 0.35); };
    const m = o.mv, k = o.st === 'tell' ? o.k : o.st === 'atk' ? 1 : 0; let L = [-58, -20, 30], Rr = [58, -20, 30];
    if (m === 'L') { L = [-58 - 30 * k, -40 + 90 * (o.st === 'atk' ? 1 : -0.3 * k), 30 + 22 * (o.st === 'atk' ? 1 : 0)]; } if (m === 'R') { Rr = [58 + 30 * k, -40 + 90 * (o.st === 'atk' ? 1 : -0.3 * k), 30 + 22 * (o.st === 'atk' ? 1 : 0)]; } if (m === 'U') { Rr = [40 - 10 * k, 60 - (o.st === 'atk' ? 150 : -20 * k), 30 + (o.st === 'atk' ? 20 : 0)]; } if (m === 'F') { L = [-58 + 30 * k, -30 - 30 * k, 30]; Rr = [58 - 30 * k, -30 - 30 * k, 30]; if (o.st === 'atk') { L = [-30, 120, 52]; Rr = [30, 120, 52]; } }
    if (o.st === 'block') { L = [-22, -70, 32]; Rr = [22, -70, 32]; }
    c.strokeStyle = F.skin; c.lineWidth = 22; c.lineCap = 'round'; c.beginPath(); c.moveTo(-60, -6); c.lineTo(L[0], L[1]); c.moveTo(60, -6); c.lineTo(Rr[0], Rr[1]); c.stroke(); gl(L[0], L[1], L[2], '#dc2626'); gl(Rr[0], Rr[1], Rr[2], '#dc2626');
    if (o.flash > 0) { c.globalCompositeOperation = 'lighter'; c.fillStyle = 'rgba(255,255,255,' + o.flash * 3 + ')'; c.beginPath(); c.ellipse(0, -40, 90, 120, 0, 0, 7); c.fill(); c.globalCompositeOperation = 'source-over'; }
    c.restore(); }
  function shade(h, f) { const n = parseInt(h.slice(1), 16); return `rgb(${Math.floor((n >> 16) * f)},${Math.floor(((n >> 8) & 255) * f)},${Math.floor((n & 255) * f)})`; }
  function me(c, g) { const p = g.p; c.save(); c.translate(200 + p.dx, 600); c.globalAlpha = 0.85; const s = 1.0; c.fillStyle = '#5a3a24'; c.beginPath(); c.ellipse(0, -40, 34, 40, 0, 0, 7); c.fill(); c.fillStyle = '#2a1a10'; c.beginPath(); c.ellipse(0, -52, 34, 30, 0, Math.PI, 0); c.fill();
    c.fillStyle = '#7a5032'; c.beginPath(); c.moveTo(-90, 10); c.quadraticCurveTo(0, -30, 90, 10); c.lineTo(110, 140); c.lineTo(-110, 140); c.fill(); c.fillStyle = '#16a34a'; c.fillRect(-90, 90, 180, 60);
    const gl = (x, y, r) => { const gg = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 2, x, y, r); gg.addColorStop(0, '#bbf7d0'); gg.addColorStop(0.4, '#16a34a'); gg.addColorStop(1, '#064e1a'); c.fillStyle = gg; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    const pl = p.punch === 'L' ? p.pk : 0, pr = p.punch === 'R' ? p.pk : 0, up = p.punch === 'S' ? p.pk : 0, bl = p.block ? 1 : 0;
    gl(-70 + pl * 40 + bl * 40, -30 - pl * 150 - bl * 60 - up * 90, 32 - pl * 8); gl(70 - pr * 40 - bl * 40 + up * -40, -30 - pr * 150 - bl * 60 - up * 230, 32 - pr * 8 + up * 4); c.restore(); }
  function newFight(g) { const F = FIGHTERS[g.fi % FIGHTERS.length], lap = Math.floor(g.fi / FIGHTERS.length); g.o = { f: F, hp: F.hp * 1.5 * (1 + lap * 0.3), max: F.hp * 1.5 * (1 + lap * 0.3), st: 'idle', t: 1.4, mv: null, k: 0, dx: 0, dy: 0, hitT: 0, flash: 0, tell: Math.max(0.28, F.tell * 0.8 * Math.pow(0.9, lap)) }; g.intro = 1.6; }
  Kit.run({ fill: true, id: 'gl-knockout', title: 'KNOCKOUT RING', help: 'Dodge: swipe / A D / arrows.  Block: hold the bottom / S / down.  Punch: tap upper-left/right (J K)\nCounter while he is open after a miss. STAR full: U or double tap for an uppercut', bg: '#07050c',
    init(g) { g.fi = 0; g.p = { hp: 100, dx: 0, dodge: 0, dir: 0, block: false, punch: null, pk: 0, pt: 0, star: 0 }; g.kos = 0; g.counters = 0; g.lastTap = -1; newFight(g); g.hud = ''; },
    update(g, dt) { const p = g.p, o = g.o, P = g.ptr; if (g.intro > 0) { g.intro -= dt; return; }
      // input
      let dodge = 0, punch = null; if (g.kd('ArrowLeft') || g.kd('a')) dodge = -1; if (g.kd('ArrowRight') || g.kd('d')) dodge = 1; if (g.kd('j')) punch = 'L'; if (g.kd('k')) punch = 'R'; if (g.kd('u')) punch = 'S';
      if (P.released && g.swX != null) { const dx = P.x - g.swX; if (Math.abs(dx) > 50 && g.t - g.swT < 0.4) dodge = Math.sign(dx); else if (g.swY < 500 && Math.abs(dx) < 30) { punch = g.swX < 200 ? 'L' : 'R'; if (g.t - g.lastTap < 0.3 && p.star >= 3) punch = 'S'; g.lastTap = g.t; } g.swX = null; }
      if (P.pressed) { g.swX = P.x; g.swY = P.y; g.swT = g.t; }
      p.block = (P.down && g.swY >= 500 && g.t - g.swT > 0.08 && Math.abs(P.x - g.swX) < 40) || !!(g.keys.s || g.keys.ArrowDown);
      if (dodge && p.dodge <= 0) { p.dodge = 0.42; p.dir = dodge; p.dT = g.t; g.sfx('whoosh'); }
      if (p.dodge > 0) { p.dodge -= dt; p.dx = p.dir * 110 * Math.sin(Math.max(0, p.dodge) / 0.42 * Math.PI); } else p.dx = 0;
      if (punch && !p.punch && p.dodge <= 0 && !p.block) { if (punch === 'S' && p.star < 3) punch = 'R'; p.punch = punch; p.pk = 0; p.pt = 0;
        const open = o.st === 'open' || o.st === 'stun'; const guarded = o.st === 'idle' && g.rnd() < 0.7; let dmg = punch === 'S' ? 30 : 6;
        if (o.st === 'tell' && o.mv !== 'F') { dmg = 8; o.st = 'stun'; o.t = 0.8; g.float(200, 150, 'INTERRUPT!', '#fde047', 18); }
        else if (guarded || o.st === 'block') { o.st = 'block'; o.t = 0.35; dmg = 0; g.sfx('click'); }
        else if (open) { dmg *= 2; g.counters++; g.mark('c', g.counters); p.star = Math.min(3, p.star + (punch === 'S' ? -3 : 1)); g.float(200 + (punch === 'L' ? -40 : 40), 170, 'COUNTER!', '#9dff7a', 18); }
        if (punch === 'S') p.star = 0;
        if (dmg > 0) { o.hp -= dmg; o.hitT = 0.18; o.flash = 0.12; g.add(dmg * 10, 'hit'); g.sfx(punch === 'S' ? 'boom' : 'hit'); g.shake(punch === 'S' ? 10 : 3); g.burst(200 + (punch === 'L' ? -20 : 20), 220, ['#fff', '#fde047'], punch === 'S' ? 30 : 10, 220); if (o.st === 'idle') { o.st = 'stun'; o.t = 0.25; } } }
      if (p.punch) { p.pt += dt; p.pk = Math.sin(Math.min(1, p.pt / 0.22) * Math.PI); if (p.pt > 0.22) p.punch = null; }
      // opponent AI
      o.hitT -= dt; o.flash -= dt; o.t -= dt; o.dx = Math.sin(g.t * 1.6) * 14; o.dy = Math.sin(g.t * 3.2) * 4;
      if (o.hp <= 0 && o.st !== 'down') { o.st = 'down'; o.t = 2.2; g.kos++; g.mark('k', g.kos); g.add(1000 * g.kos + Math.round(p.hp) * 10, 'ko'); g.float(200, 330, 'K.O.!', '#fde047', 54); g.sfx('power'); g.shake(14); p.hp = Math.min(100, p.hp + 25); }
      if (o.st === 'down') { o.dy = Math.min(140, (2.2 - o.t) * 200); if (o.t <= 0) { g.fi++; newFight(g); } return; }
      if (o.t <= 0) { if (o.st === 'idle' || o.st === 'block' || o.st === 'open' || o.st === 'stun') { o.st = 'tell'; o.mv = g.pick(o.f.moves); o.t = o.tell * g.R(0.7, 1.25); o.k = 0; if (o.mv === 'F' && g.rnd() < 0.5) o.t *= 0.6; }
        else if (o.st === 'tell') { if (g.fi >= 1 && g.rnd() < 0.15) { o.st = 'idle'; o.t = 0.3; g.float(200, 150, 'FEINT', '#c4b5fd', 14); } else { o.st = 'atk'; o.t = 0.16; } }
        else if (o.st === 'atk') { const recent = p.dT != null && g.t - p.dT < 0.28; const dodged = (o.mv === 'L' && p.dir === 1 && recent) || (o.mv === 'R' && p.dir === -1 && recent) || (o.mv === 'U' && recent) || (o.mv === 'F' && p.block);
          const blocked = p.block && o.mv !== 'F' && o.mv !== 'U';
          if (dodged) { g.add(50, 'dodge'); g.float(200, 470, 'DODGED', '#22d3ee', 16); g.sfx('coin'); if (g.fi % 4 >= 2 && !o.combo && g.rnd() < 0.4) { o.combo = true; o.st = 'tell'; o.mv = g.pick(o.f.moves.filter(m => m !== 'F')); o.t = o.tell * 0.55; o.k = 0; } else { o.combo = false; o.st = 'open'; o.t = 0.8; } }
          else if (blocked) { p.hp -= 3; o.st = 'idle'; o.t = 0.5; g.sfx('click'); g.float(200, 470, 'BLOCK', '#fff', 14); }
          else if (false) {} else { const dmg = o.mv === 'U' ? 22 : o.mv === 'F' ? 18 : 14; p.hp -= dmg; g.sfx('bad'); g.shake(10); g.flash = 0.25; o.st = 'idle'; o.t = 0.7; if (p.hp <= 0) return g.end('Knocked out'); } }
        else { o.st = 'idle'; o.t = g.R(0.5, 1.1); } }
      if (o.st === 'tell') o.k = Math.min(1, o.k + dt / o.tell);
      g.flash = Math.max(0, (g.flash || 0) - dt); },
    draw(g, c) { c.drawImage(bg(g.W, g.H), 0, 0); opp(c, g, g.t); me(c, g); if (g.flash > 0) { c.fillStyle = 'rgba(255,0,0,' + g.flash + ')'; c.fillRect(0, 0, g.W, g.H); }
      if (g.intro > 0) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 280, g.W, 110); c.textAlign = 'center'; c.fillStyle = '#fde047'; c.font = 'bold 13px sans-serif'; c.fillText('FIGHT ' + (g.fi + 1), 200, 312); c.font = 'bold 30px Georgia, serif'; c.fillStyle = '#fff'; c.fillText(g.o.f.n, 200, 348); c.font = 'bold 12px sans-serif'; c.fillStyle = '#9dff7a'; c.fillText(g.intro > 0.5 ? 'GET READY' : 'BOX!', 200, 372); }
      // bars
      const bar = (x, y, w, f, col, lbl) => { c.fillStyle = 'rgba(0,0,0,.6)'; Kit.rr(c, x, y, w, 12, 6); c.fill(); c.fillStyle = col; Kit.rr(c, x + 2, y + 2, Math.max(0, (w - 4) * f), 8, 4); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 9px sans-serif'; c.textAlign = 'left'; c.fillText(lbl, x, y - 3); };
      bar(14, 70, 170, Math.max(0, g.p.hp / 100), '#22c55e', 'YOU'); bar(216, 70, 170, Math.max(0, g.o.hp / g.o.max), '#ef4444', g.o.f.n);
      for (let i = 0; i < 3; i++) { c.fillStyle = i < g.p.star ? '#fde047' : 'rgba(255,255,255,.2)'; c.font = 'bold 18px sans-serif'; c.textAlign = 'left'; c.fillText('\u2605', 14 + i * 20, 104); } },
    hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#fff'; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.textAlign = 'right'; c.font = 'bold 11px sans-serif'; c.fillStyle = '#fde047'; c.fillText('KOs ' + g.kos + '  \u00b7  COUNTERS ' + g.counters, g.W - 14, 30); } });
})();

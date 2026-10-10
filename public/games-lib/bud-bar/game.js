// Bud Bar - original 4-counter dispensary rush (Hub build, cannabis theme; mechanic in the spirit of bar-tapper games)
Kit.run({ id: 'gl-bud-bar', title: 'BUD BAR', help: 'Tap a counter (or Up/Down + Space) to slide an order\nServe every customer before they reach the end. Catch empties', bg: '#1c1917',
  init(g) { g.lane = 0; g.cust = []; g.bags = []; g.empties = []; g.lives = 3; g.next = 1; g.served = 0; },
  update(g, dt) {
    const LY = (i) => 200 + i * 110; if (g.kd('ArrowUp')) g.lane = (g.lane + 3) % 4; if (g.kd('ArrowDown')) g.lane = (g.lane + 1) % 4;
    let fire = g.kd(' '); if (g.ptr.pressed) { const i = Math.floor((g.ptr.y - 145) / 110); if (i >= 0 && i < 4) { if (i === g.lane) fire = true; g.lane = i; if (g.ptr.x > 300) fire = true; } }
    if (fire) { g.bags.push({ lane: g.lane, x: 330 }); g.sfx('whoosh'); }
    const pace = 1 + g.t / 60; g.next -= dt; if (g.next <= 0) { g.next = g.R(1.2, 2.6) / pace; g.cust.push({ lane: g.RI(0, 3), x: -20, sp: g.R(16, 26) * pace, back: 0, c: g.pick(['#f472b6', '#22d3ee', '#fbbf24', '#a855f7', '#34d399']) }); }
    for (const b of g.bags) { b.x -= 330 * dt; const hit = g.cust.filter(k => k.lane === b.lane && !k.back && Math.abs(k.x - b.x) < 18).sort((a, b2) => b2.x - a.x)[0]; if (hit) { b.dead = true; hit.back = 1; g.burst(hit.x, LY(hit.lane) - 30, ['#9dff7a', '#fff'], 8, 120, 0.4); g.served++; g.add(50, 's'); g.float(hit.x, LY(hit.lane) - 40, '+50', '#34d399'); g.sfx('coin'); } else if (b.x < 20) { b.dead = true; g.burst(16, LY(b.lane) - 10, ['#cfe8ff', '#fff', '#3f9a3a'], 16, 180, 0.5); miss(g, 'An order slid off the counter'); if (g.state !== 'play') return; } }
    for (const k of g.cust) { if (k.back) { k.x -= 160 * dt; if (k.x < -30) { k.dead = true; if (g.rnd() < 0.5) g.empties.push({ lane: k.lane, x: 0 }); } } else { k.x += k.sp * dt * (Math.sin(g.t * 3 + k.x) > 0 ? 1.4 : 0.4); if (k.x > 300) { k.dead = true; miss(g, 'A customer waited too long'); if (g.state !== 'play') return; } } }
    for (const e of g.empties) { e.x += 120 * dt; if (e.x > 310) { e.dead = true; if (e.lane === g.lane) { g.add(25, 'e'); g.sfx('click'); g.float(310, LY(e.lane) - 30, '+25', '#fbbf24'); } else { miss(g, 'A tray crashed'); if (g.state !== 'play') return; } } }
    g.bags = g.bags.filter(b => !b.dead); g.cust = g.cust.filter(k => !k.dead); g.empties = g.empties.filter(e => !e.dead); g.hud = '';
  },
  draw(g, c) { c.drawImage(room(g.W, g.H), 0, 0); const LY = (i) => 200 + i * 110;
    for (let i = 0; i < 4; i++) { const y = LY(i); if (i === g.lane) { const gl = c.createLinearGradient(0, y - 60, 0, y + 20); gl.addColorStop(0, 'rgba(125,255,106,0)'); gl.addColorStop(1, 'rgba(125,255,106,.16)'); c.fillStyle = gl; c.fillRect(0, y - 60, g.W, 80); } }
    for (const k of g.cust) person(c, k.x, LY(k.lane), k, g.t, false);
    for (const b of g.bags) jar(c, b.x, LY(b.lane) - 2, false, g.t);
    for (const e of g.empties) jar(c, e.x, LY(e.lane) - 2, true, g.t);
    const y = LY(g.lane); person(c, 352, y, { c: '#16a34a', hat: 2, hair: '#3b2414', skin: '#e8b48a', seed: 7 }, g.t, true);
    for (let i = 0; i < 4; i++) tap(c, 384, LY(i));
    if (g.ptr.down) {} },
  hudDraw(g, c) { c.textAlign = 'left'; c.font = 'bold 22px sans-serif'; c.fillStyle = '#ffe9b0'; c.shadowColor = '#000'; c.shadowBlur = 6; c.fillText(Math.floor(g.score).toLocaleString('en-US'), 14, 32); c.shadowBlur = 0; c.textAlign = 'right'; c.font = 'bold 14px sans-serif'; c.fillStyle = '#ff6b8a'; c.fillText('\u2665'.repeat(Math.max(0, g.lives)), g.W - 14, 30); c.fillStyle = '#9dff7a'; c.font = 'bold 11px sans-serif'; c.fillText('SERVED ' + g.served, g.W - 14, 46); } });
let ROOM = null; function room(W, H) { if (ROOM) return ROOM; const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
  const wall = c.createLinearGradient(0, 0, 0, H); wall.addColorStop(0, '#2a1a12'); wall.addColorStop(1, '#170e09'); c.fillStyle = wall; c.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 22) { c.fillStyle = x % 44 ? 'rgba(255,200,140,.03)' : 'rgba(0,0,0,.12)'; c.fillRect(x, 0, 22, H); }
  // neon sign
  c.save(); c.translate(W / 2, 92); c.shadowColor = '#7dff6a'; c.shadowBlur = 18; c.strokeStyle = '#b6ff9e'; c.lineWidth = 3; Kit.rr(c, -120, -34, 240, 64, 14); c.stroke(); c.font = 'bold 30px Georgia, serif'; c.textAlign = 'center'; c.fillStyle = '#d9ffcc'; c.fillText('BUD  BAR', 0, 8); c.shadowColor = '#ff4fd8'; c.fillStyle = '#ffb3ec'; c.font = 'bold 11px sans-serif'; c.fillText('DISPENSARY \u00b7 LOUNGE \u00b7 21+', 0, 24); c.restore();
  for (let i = 0; i < 4; i++) { const y = 200 + i * 110;
    // door on the left
    c.fillStyle = '#120a06'; c.fillRect(0, y - 70, 14, 70); c.fillStyle = '#c08a40'; c.fillRect(12, y - 40, 3, 6);
    // counter
    const top = c.createLinearGradient(0, y - 4, 0, y + 14); top.addColorStop(0, '#d79a52'); top.addColorStop(1, '#8a5222'); c.fillStyle = top; c.fillRect(14, y - 4, 330, 16); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(14, y - 4, 330, 2);
    const front = c.createLinearGradient(0, y + 12, 0, y + 62); front.addColorStop(0, '#5a3418'); front.addColorStop(1, '#2a160a'); c.fillStyle = front; c.fillRect(14, y + 12, 330, 50); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = 40; x < 344; x += 50) { c.strokeRect(x - 20, y + 18, 40, 38); }
    c.fillStyle = '#c08a40'; c.fillRect(14, y + 58, 330, 3); }
  return (ROOM = cv); }
function person(c, x, y, k, t, bt) { const sd = k.seed ?? (k.seed = Math.floor(Math.random() * 1e6)); const pick = (a, o) => a[(sd >> o) % a.length]; const skin = k.skin || pick(['#f2c7a5', '#d9a07a', '#a8714a', '#7a4a2a', '#f8d8bc'], 1); const hair = k.hair || pick(['#2a1a10', '#6b3e1a', '#e8c070', '#1a1a1a', '#b04a2a', '#9aa3ad'], 3); const hat = k.hat ?? sd % 4; const wobble = bt ? 0 : Math.sin(t * 9 + sd) * 2, step = bt ? 0 : Math.sin(t * 9 + sd);
  c.save(); c.translate(x, y - 6); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 4, 13, 3, 0, 0, 7); c.fill();
  // body (behind counter: upper torso only visible)
  const bg = c.createLinearGradient(-13, 0, 13, 0); bg.addColorStop(0, k.c); bg.addColorStop(1, shade(k.c)); c.fillStyle = bg; Kit.rr(c, -13, -38 + wobble, 26, 36, 9); c.fill();
  c.fillStyle = skin; c.fillRect(-15 - (bt ? 0 : step * 2), -30 + wobble, 6, 14); c.fillRect(9 + (bt ? 0 : step * 2), -30 + wobble, 6, 14);
  if (bt) { c.fillStyle = '#f5f0e0'; c.fillRect(-9, -36, 18, 26); c.fillStyle = '#16a34a'; c.fillRect(-9, -26, 18, 16); c.fillStyle = '#d9ffcc'; c.font = 'bold 7px sans-serif'; c.textAlign = 'center'; c.fillText('\u2618', 0, -16); }
  // head
  const hy = -50 + wobble; c.fillStyle = skin; c.beginPath(); c.arc(0, hy, 11, 0, 7); c.fill(); c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(3, hy + 2, 10, -0.6, 1.6); c.fill();
  c.fillStyle = hair; c.beginPath(); c.arc(0, hy - 3, 11.5, Math.PI * 1.05, Math.PI * 1.95); c.fill(); if (sd % 3 === 0 && !bt) { c.fillRect(-11, hy - 4, 4, 12); c.fillRect(7, hy - 4, 4, 12); }
  c.fillStyle = '#1a1a1a'; const ex = bt ? -1 : 1; c.fillRect(-5 * ex - 1.5, hy - 1, 3, 3); c.fillRect(3 * ex - 1.5, hy - 1, 3, 3); c.fillStyle = '#7a2a2a'; c.fillRect(-3, hy + 5, 6, 1.6);
  if (sd % 5 === 1 && !bt) { c.fillStyle = hair; c.beginPath(); c.arc(0, hy + 6, 7, 0, Math.PI); c.fill(); }
  if (hat === 1) { c.fillStyle = '#2a2a3a'; c.fillRect(-14, hy - 12, 28, 4); c.fillRect(-9, hy - 22, 18, 11); c.fillStyle = '#c0392b'; c.fillRect(-9, hy - 14, 18, 2); } else if (hat === 2) { c.fillStyle = bt ? '#14532d' : '#3b82f6'; c.beginPath(); c.arc(0, hy - 6, 11, Math.PI, 0); c.fill(); c.fillRect(bt ? -18 : 0, hy - 7, 18, 3); } else if (hat === 3) { c.fillStyle = '#8a4a1a'; c.beginPath(); c.ellipse(0, hy - 10, 18, 4, 0, 0, 7); c.fill(); c.fillRect(-8, hy - 20, 16, 10); }
  if (k.back) { jar(c, 14, -20 + wobble, false, t); c.fillStyle = '#9dff7a'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('\u263a', 0, hy - 18); }
  c.restore(); }
function shade(hex) { const n = parseInt(hex.slice(1), 16); return 'rgb(' + ((n >> 16) * 0.6 | 0) + ',' + (((n >> 8) & 255) * 0.6 | 0) + ',' + ((n & 255) * 0.6 | 0) + ')'; }
function jar(c, x, y, empty, t) { c.save(); c.translate(x, y); c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(1, 1, 9, 2.5, 0, 0, 7); c.fill(); const g = c.createLinearGradient(-8, 0, 8, 0); g.addColorStop(0, 'rgba(220,240,255,.75)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(160,190,210,.75)'); c.fillStyle = g; Kit.rr(c, -8, -20, 16, 20, 4); c.fill();
  if (!empty) { c.fillStyle = '#3f9a3a'; Kit.rr(c, -6, -14, 12, 12, 3); c.fill(); c.fillStyle = '#7dd36a'; c.beginPath(); c.arc(-2, -10, 3, 0, 7); c.arc(3, -7, 2.5, 0, 7); c.fill(); }
  c.fillStyle = empty ? '#6b7280' : '#16a34a'; c.fillRect(-8.5, -24, 17, 5); c.fillStyle = 'rgba(255,255,255,.7)'; c.fillRect(-6, -18, 2, 14); if (!empty && Math.sin(t * 6 + x * 0.1) > 0.8) { c.fillStyle = '#fff'; c.fillRect(4, -22, 2, 2); } c.restore(); }
function tap(c, x, y) { c.fillStyle = '#4b5563'; c.fillRect(x - 6, y - 60, 12, 62); c.fillStyle = '#9ca3af'; c.fillRect(x - 6, y - 60, 3, 62); c.fillStyle = '#16a34a'; c.beginPath(); c.arc(x, y - 64, 8, 0, 7); c.fill(); c.fillStyle = '#d9ffcc'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('\u2618', x, y - 61); c.fillStyle = '#d1d5db'; c.fillRect(x - 16, y - 30, 12, 5); }
function miss(g, why) { g.lives--; g.sfx('bad'); g.shake(8); g.flash('#ef4444', 0.1); g.float(g.W / 2, 160, why, '#ef4444', 14); if (g.lives <= 0) g.end(why); }

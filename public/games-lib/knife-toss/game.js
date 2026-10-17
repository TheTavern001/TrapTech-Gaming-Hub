// Knife Toss - original spinning-target knife thrower (Hub build)
Kit.run({ fill: true, id: 'gl-knife-toss', title: 'KNIFE TOSS', help: 'Tap / Space to throw\nDon\'t hit other knives - apples are bonus', bg: '#1c1917',
  init(g) { g.stage = 0; nextStage(g); g.fly = null; },
  update(g, dt) {
    g.rs += (g.rt - g.rs) * dt * 1.5; if (g.rnd() < dt * g.chg) g.rt = g.R(-1, 1) * g.maxs; g.rot += g.rs * dt;
    if (g.tap() && !g.fly && g.left > 0) { g.fly = { y: 600 }; g.sfx('whoosh'); }
    if (g.fly) { g.fly.y -= 1900 * dt; if (g.fly.y <= 300 + 80) { const a = (((Math.PI / 2 - g.rot) % 6.283) + 6.283) % 6.283; if (g.knives.some(k => Math.abs(Math.atan2(Math.sin(k - a), Math.cos(k - a))) < 0.16)) { g.sfx('hit'); g.shake(8); g.burst(200, 380, ['#fff', '#fde68a'], 24, 260); g.bounce = { x: 200, y: g.fly.y, vx: g.R(-1, 1) * 160, vy: 200, r: 0 }; g.fly = null; if (navigator.vibrate) navigator.vibrate(60); return g.end('Knife clash'); }
        g.knives.push(a); g.left--; g.fly = null; g.add(10, 'k'); g.sfx('thud'); g.shake(3); g.burst(200, 386, ['#e0a868', '#8a5222'], 10, 150, 0.35); g.hitT = 0.1;
        for (const ap of g.apples) if (!ap.got && Math.abs(Math.atan2(Math.sin(ap.a - a), Math.cos(ap.a - a))) < 0.22) { ap.got = true; g.add(50, 'a'); g.float(200, 200, '+50', '#ef4444', 20); g.burst(200, 380, ['#ef4444', '#fff', '#22c55e'], 16, 220, 0.5); g.sfx('coin'); }
        if (g.left <= 0) { g.add(100 * g.stage, 'c'); g.float(200, 250, 'STAGE ' + g.stage + ' CLEAR', '#34d399', 24); g.sfx('boom'); g.burst(200, 300, ['#c98a4b', '#78350f', '#fde68a'], 60, 340); shatter(g); setTimeout(() => g.state === 'play' && nextStage(g), 500); g.left = -1; } } }
    g.hitT = Math.max(0, (g.hitT || 0) - dt); g.hud = '';
  },
  draw(g, c) { const W = g.W, H = g.H; const bg = c.createRadialGradient(200, 300, 30, 200, 340, 520); bg.addColorStop(0, '#3b2a22'); bg.addColorStop(1, '#0d0907'); c.fillStyle = bg; c.fillRect(0, 0, W, H);
    // stage dots
    for (let i = 0; i < 5; i++) { const st = Math.floor((g.stage - 1) / 5) * 5 + i + 1, x = 200 + (i - 2) * 26; c.save(); c.translate(x, 70); c.rotate(0.785); c.fillStyle = st < g.stage ? '#fbbf24' : st === g.stage ? (i === 4 ? '#ef4444' : '#fde68a') : 'rgba(255,255,255,.18)'; c.fillRect(-6, -6, 12, 12); c.restore(); }
    c.fillStyle = g.boss ? '#ef4444' : '#fde68a'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.fillText(g.boss ? 'BOSS: ' + BOSS[(g.stage / 5 - 1) % BOSS.length].n : 'STAGE ' + g.stage, 200, 106);
    const cy = 300 - (g.hitT > 0 ? 7 * g.hitT / 0.1 : 0); c.save(); c.translate(200, cy); c.rotate(g.rot);
    for (const k of g.knives) { c.save(); c.rotate(k); knife(c, 0, 72, true); c.restore(); }
    for (const ap of g.apples) if (!ap.got) { c.save(); c.rotate(ap.a); c.translate(0, 98); c.rotate(Math.PI); apple(c); c.restore(); }
    c.drawImage(wheel(g.boss ? (g.stage / 5 - 1) % BOSS.length : -1), -96, -96); c.restore();
    for (const ch of g.chunks || []) { c.save(); c.translate(ch.x, ch.y); c.rotate(ch.r); c.globalAlpha = Math.min(1, ch.l * 2); c.fillStyle = ch.c; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 80, ch.a0, ch.a0 + 1.05); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.stroke(); c.restore(); }
    if (g.bounce) { const b = g.bounce; c.save(); c.translate(b.x, b.y); c.rotate(b.r); knife(c, 0, 0, true); c.restore(); }
    if (g.fly) { knife(c, 200, g.fly.y - 50, true, true); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(197, g.fly.y + 40, 6, 70); } else if (g.left > 0) knife(c, 200, 560, true);
    for (let i = 0; i < Math.max(0, g.left); i++) { c.save(); c.translate(26, 640 - i * 24); c.rotate(-0.785); c.globalAlpha = 0.9; c.fillStyle = '#e2e8f0'; c.fillRect(-2, -12, 4, 12); c.fillStyle = '#7c2d12'; c.fillRect(-2.5, 0, 5, 8); c.restore(); }
    c.fillStyle = 'rgba(157,255,122,.55)'; c.font = 'bold 10px sans-serif'; c.fillText('\u2618 BLADE & BUD \u00b7 21+', 200, H - 14);
    if (g.chunks) { const dt = 1 / 60; for (const ch of g.chunks) { ch.x += ch.vx * dt; ch.y += ch.vy * dt; ch.vy += 900 * dt; ch.r += ch.vr * dt; ch.l -= dt; } g.chunks = g.chunks.filter(ch => ch.l > 0); }
    if (g.bounce) { const b = g.bounce, dt = 1 / 60; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 1400 * dt; b.r += 12 * dt; if (b.y > H + 80) g.bounce = null; }
  } });
const BOSS = [{ n: 'CHEESE WHEEL', a: '#facc15', b: '#eab308', e: '#ca8a04' }, { n: 'ORANGE', a: '#fb923c', b: '#f97316', e: '#c2410c' }, { n: 'IRON SHIELD', a: '#94a3b8', b: '#64748b', e: '#334155' }, { n: 'LIME', a: '#a3e635', b: '#65a30d', e: '#3f6212' }];
const WC = {};
function wheel(k) { if (WC[k]) return WC[k]; const cv = document.createElement('canvas'); cv.width = cv.height = 192; const c = cv.getContext('2d'); c.translate(96, 96); const B = k >= 0 ? BOSS[k] : null;
  c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 14; c.shadowOffsetY = 6; c.fillStyle = B ? B.e : '#5b3416'; c.beginPath(); c.arc(0, 0, 86, 0, 7); c.fill(); c.shadowColor = 'transparent';
  if (!B) { for (let i = 0; i < 70; i++) { const a = i / 70 * 6.283; c.strokeStyle = i % 2 ? '#3f230d' : '#6b3e1a'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 84, a, a + 0.06); c.stroke(); }
    const g = c.createRadialGradient(-20, -20, 4, 0, 0, 78); g.addColorStop(0, '#f3c98b'); g.addColorStop(1, '#c98a4b'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 76, 0, 7); c.fill();
    let seed = 7; const R = () => (seed = (seed * 16807) % 2147483647) / 2147483647; c.lineWidth = 1.5; for (let r = 8; r < 76; r += 6 + R() * 5) { c.strokeStyle = 'rgba(120,70,30,' + (0.25 + R() * 0.25) + ')'; c.beginPath(); for (let i = 0; i <= 40; i++) { const a = i / 40 * 6.283, rr = r + Math.sin(a * 3 + r) * 1.5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.stroke(); }
    c.strokeStyle = 'rgba(80,40,10,.5)'; c.lineWidth = 1.2; for (let i = 0; i < 3; i++) { const a = R() * 6.28; c.beginPath(); c.moveTo(Math.cos(a) * 30, Math.sin(a) * 30); c.lineTo(Math.cos(a + 0.05) * 74, Math.sin(a + 0.05) * 74); c.stroke(); }
    c.fillStyle = '#8a5222'; c.beginPath(); c.arc(0, 0, 5, 0, 7); c.fill(); }
  else { const g = c.createRadialGradient(-25, -25, 5, 0, 0, 84); g.addColorStop(0, B.a); g.addColorStop(1, B.b); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 80, 0, 7); c.fill();
    if (k === 0) for (let i = 0; i < 9; i++) { c.fillStyle = 'rgba(180,120,0,.35)'; c.beginPath(); c.arc(Math.cos(i * 2.4) * 45 * ((i % 3) / 3 + 0.3), Math.sin(i * 2.4) * 45 * ((i % 3) / 3 + 0.3), 6 + (i % 3) * 3, 0, 7); c.fill(); }
    if (k === 1 || k === 3) { c.strokeStyle = 'rgba(255,255,230,.7)'; c.lineWidth = 3; for (let i = 0; i < 10; i++) { c.save(); c.rotate(i * 0.628); c.beginPath(); c.moveTo(6, 0); c.quadraticCurveTo(40, 12, 70, 4); c.quadraticCurveTo(40, -12, 6, 0); c.stroke(); c.restore(); } c.fillStyle = 'rgba(255,255,230,.8)'; c.beginPath(); c.arc(0, 0, 7, 0, 7); c.fill(); }
    if (k === 2) { c.strokeStyle = '#cbd5e1'; c.lineWidth = 5; c.beginPath(); c.arc(0, 0, 62, 0, 7); c.stroke(); for (let i = 0; i < 12; i++) { c.fillStyle = '#e2e8f0'; c.beginPath(); c.arc(Math.cos(i * 0.52) * 72, Math.sin(i * 0.52) * 72, 3, 0, 7); c.fill(); } c.fillStyle = '#475569'; c.beginPath(); c.arc(0, 0, 22, 0, 7); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.ellipse(-30, -38, 26, 10, -0.6, 0, 7); c.fill(); }
  return (WC[k] = cv); }
function knife(c, x, y, up, fly) { c.save(); c.translate(x, y); if (!up) c.rotate(Math.PI); else c.translate(0, 0);
  // blade points toward -y when up
  const bl = c.createLinearGradient(-5, 0, 5, 0); bl.addColorStop(0, '#f8fafc'); bl.addColorStop(0.5, '#cbd5e1'); bl.addColorStop(1, '#64748b'); c.fillStyle = bl; c.beginPath(); c.moveTo(-5, 50); c.lineTo(-5, 12); c.quadraticCurveTo(-5, 0, 0, -2); c.lineTo(5, 10); c.lineTo(5, 50); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; c.fillRect(-3.5, 14, 1.5, 34);
  c.fillStyle = '#d4a017'; c.fillRect(-9, 50, 18, 5); const hg = c.createLinearGradient(-5, 0, 5, 0); hg.addColorStop(0, '#9a3412'); hg.addColorStop(1, '#431407'); c.fillStyle = hg; Kit.rr(c, -5.5, 55, 11, 34, 4); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; for (let i = 60; i < 88; i += 5) { c.beginPath(); c.moveTo(-5, i); c.lineTo(5, i + 3); c.stroke(); } c.fillStyle = '#d4a017'; c.beginPath(); c.arc(0, 90, 4, 0, 7); c.fill(); c.restore(); }
function apple(c) { const g = c.createRadialGradient(-4, -4, 1, 0, 0, 13); g.addColorStop(0, '#ff8a8a'); g.addColorStop(1, '#b91c1c'); c.fillStyle = g; c.beginPath(); c.arc(-5, 0, 10, 0, 7); c.arc(5, 0, 10, 0, 7); c.fill(); c.strokeStyle = '#3f2a14'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -8); c.lineTo(2, -15); c.stroke(); c.fillStyle = '#22c55e'; c.beginPath(); c.ellipse(7, -14, 6, 3, -0.4, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-8, -4, 3, 2, -0.5, 0, 7); c.fill(); }
function shatter(g) { g.chunks = []; const cols = g.boss ? [BOSS[(g.stage / 5 - 1) % BOSS.length].b] : ['#c98a4b', '#e0a868']; for (let i = 0; i < 6; i++) { const a = i * 1.047 + g.rot; g.chunks.push({ x: 200, y: 300, a0: a, r: 0, vx: Math.cos(a + 0.5) * 260, vy: Math.sin(a + 0.5) * 260 - 250, vr: g.R(-6, 6), l: 1.2, c: cols[i % cols.length] }); } }
function nextStage(g) { g.stage++; g.mark('t', g.stage); g.boss = g.stage % 5 === 0; g.knives = []; const pre = Math.min(6, Math.floor(g.stage / 2)); for (let i = 0; i < pre; i++) g.knives.push(g.R(0, 6.28)); g.apples = []; for (let i = 0; i < (g.rnd() < 0.6 ? 1 : 0) + (g.boss ? 1 : 0); i++) g.apples.push({ a: g.R(0, 6.28) }); g.left = 6 + Math.min(6, g.stage) + (g.boss ? 3 : 0); g.rot = 0; g.maxs = 2 + g.stage * 0.25 + (g.boss ? 1.5 : 0); g.rs = g.maxs; g.rt = g.maxs; g.chg = g.stage > 2 ? 0.6 : 0; }

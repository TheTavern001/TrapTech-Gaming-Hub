// Knife Toss - original spinning-target knife thrower (Hub build)
Kit.run({ id: 'gl-knife-toss', title: 'KNIFE TOSS', help: 'Tap / Space to throw\nDon\'t hit other knives - apples are bonus', bg: '#1c1917',
  init(g) { g.stage = 0; nextStage(g); g.fly = null; },
  update(g, dt) {
    g.rs += (g.rt - g.rs) * dt * 1.5; if (g.rnd() < dt * g.chg) g.rt = g.R(-1, 1) * g.maxs; g.rot += g.rs * dt;
    if (g.tap() && !g.fly && g.left > 0) { g.fly = { y: 600 }; g.sfx('whoosh'); }
    if (g.fly) { g.fly.y -= 1900 * dt; if (g.fly.y <= 300 + 80) { const a = (((Math.PI / 2 - g.rot) % 6.283) + 6.283) % 6.283; if (g.knives.some(k => Math.abs(Math.atan2(Math.sin(k - a), Math.cos(k - a))) < 0.16)) { g.sfx('hit'); g.shake(8); g.burst(200, 380, '#e5e7eb', 20, 200); g.fly = null; return g.end('Knife clash'); }
        g.knives.push(a); g.left--; g.fly = null; g.add(10, 'k'); g.sfx('thud'); g.shake(3); g.burst(200, 380, '#a16207', 8, 120, 0.3); g.hitT = 0.1;
        for (const ap of g.apples) if (!ap.got && Math.abs(Math.atan2(Math.sin(ap.a - a), Math.cos(ap.a - a))) < 0.22) { ap.got = true; g.add(50, 'a'); g.float(200, 200, '+50', '#ef4444', 20); g.sfx('coin'); }
        if (g.left <= 0) { g.add(100 * g.stage, 'c'); g.float(200, 250, 'STAGE ' + g.stage + ' CLEAR', '#34d399', 24); g.sfx('boom'); g.burst(200, 300, ['#a16207', '#78350f', '#fde68a'], 60, 340); setTimeout(() => g.state === 'play' && nextStage(g), 500); g.left = -1; } } }
    g.hitT = Math.max(0, (g.hitT || 0) - dt); g.hud = 'STAGE ' + g.stage + (g.boss ? ' BOSS' : '');
  },
  draw(g, c) {
    const cy = 300 - (g.hitT > 0 ? 6 : 0); c.save(); c.translate(200, cy); c.rotate(g.rot);
    for (const k of g.knives) { c.save(); c.rotate(k); c.fillStyle = '#e5e7eb'; c.fillRect(-4, 80, 8, 50); c.fillStyle = '#334155'; c.fillRect(-5, 128, 10, 34); c.restore(); }
    for (const ap of g.apples) if (!ap.got) { c.save(); c.rotate(ap.a); Kit.circ(c, 0, 96, 12, '#ef4444'); c.restore(); }
    Kit.circ(c, 0, 0, 86, g.boss ? '#7f1d1d' : '#a16207'); Kit.circ(c, 0, 0, 70, g.boss ? '#991b1b' : '#b45309'); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 3; for (let r = 20; r < 80; r += 16) { c.beginPath(); c.arc(0, 0, r, 0, 7); c.stroke(); } c.restore();
    if (g.fly) { c.fillStyle = '#e5e7eb'; c.fillRect(196, g.fly.y - 50, 8, 50); c.fillStyle = '#334155'; c.fillRect(195, g.fly.y, 10, 34); } else if (g.left > 0) { c.fillStyle = '#e5e7eb'; c.fillRect(196, 560, 8, 50); c.fillStyle = '#334155'; c.fillRect(195, 610, 10, 34); }
    for (let i = 0; i < Math.max(0, g.left); i++) { c.fillStyle = '#9ca3af'; c.fillRect(20, 640 - i * 20, 16, 5); }
  } });
function nextStage(g) { g.stage++; g.mark('t', g.stage); g.boss = g.stage % 5 === 0; g.knives = []; const pre = Math.min(6, Math.floor(g.stage / 2)); for (let i = 0; i < pre; i++) g.knives.push(g.R(0, 6.28)); g.apples = []; for (let i = 0; i < (g.rnd() < 0.6 ? 1 : 0) + (g.boss ? 1 : 0); i++) g.apples.push({ a: g.R(0, 6.28) }); g.left = 6 + Math.min(6, g.stage) + (g.boss ? 3 : 0); g.rot = 0; g.maxs = 2 + g.stage * 0.25 + (g.boss ? 1.5 : 0); g.rs = g.maxs; g.rt = g.maxs; g.chg = g.stage > 2 ? 0.6 : 0; }

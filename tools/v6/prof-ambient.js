const { chromium } = require('playwright-core');
// v6: profile the Ambient layer under 4x CPU throttle. usage: [V=nofog,nobok,nodust,norays,lite] node tools/v6/prof-ambient.js high-score,plinko
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await p.goto('http://localhost:8787/', { waitUntil: 'networkidle' });
  if (await p.$('#gate')) { await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.tap('#gate button[type=submit]'); await p.waitForSelector('.splash, .home, main', { state: 'attached' }); await sleep(800); }
  for (const g of (process.argv[2]||'high-score').split(',')) {
  await p.goto('http://localhost:8787/play/' + g, { waitUntil: 'networkidle' });
  await p.waitForFunction(() => window.__game && window.__game.running);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate((v) => { const A = window.__game.amb; if (v.includes('nofog')) A.fog = null; if (v.includes('nobok')) A.bok = []; if (v.includes('nodust')) A.dust = []; if (v.includes('norays')) A.p = { ...A.p, raysA: 0 }; if (v.includes('lite')) A.lite = true; }, process.env.V || '');
  const box = await p.locator('#game').boundingBox(); await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.45);
  await p.evaluate(() => { const A = window.__game.amb; const s = window.__ps = { draw: [], paint: [], game: [] }; const od = A.draw.bind(A), op = A._paint.bind(A); A.draw = (...a) => { const t = performance.now(); od(...a); s.draw.push(performance.now() - t); }; A._paint = (...a) => { const t = performance.now(); op(...a); s.paint.push(performance.now() - t); };
    const G = window.__game; const gd = G.draw.bind(G); G.draw = () => { const t = performance.now(); gd(); s.game.push(performance.now() - t); }; });
  await sleep(4000);
  const r = await p.evaluate(() => { const s = window.__ps; const m = a => (a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)).toFixed(2); return { W: window.__game.W, H: window.__game.H, cw: window.__game.c.width, lite: window.__game.amb.lite, draw: m(s.draw), drawLate: m(s.draw.slice(-20)), paint: m(s.paint), np: s.paint.length, game: m(s.game), gameLate: m(s.game.slice(-20)), n: s.game.length }; });
  console.log(g, JSON.stringify(r)); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); }
  await b.close();
})();

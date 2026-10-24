// v6: verifies ambient backgrounds freeze while paused and stay static under reduced motion (html.reduce-motion / prefers-reduced-motion)
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://localhost:8787'; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome' }); let fail = 0;
  for (const rm of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: rm ? 'reduce' : 'no-preference' }); const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '/'); if (await p.$('#gate')) { await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.click('#gate button[type=submit]'); await p.waitForSelector('.splash, .home, main', { state: 'attached' }); }
    for (const g of ['plinko', 'spin-to-win', 'high-score', 'blazed-roulette', 'terp-tapper', 'stack-2048', 'brick-breaker', 'munchies-snake']) {
      await p.goto(BASE + '/play/' + g); await p.waitForFunction(() => window.__game && window.__game.running && window.__game.amb, null, { timeout: 15000 });
      await p.evaluate(() => window.__game.begin()); await sleep(400);
      const a = await p.evaluate(() => window.__game.amb.t); await p.evaluate(() => window.__game.pause(true)); const b1 = await p.evaluate(() => window.__game.amb.t); await sleep(500); const b2 = await p.evaluate(() => window.__game.amb.t);
      const ok = rm ? a === 0 && b2 === 0 : a > 0.2 && b1 === b2; if (!ok) fail++;
      console.log(rm ? 'reduced' : 'normal ', g.padEnd(16), ok ? 'PASS' : 'FAIL', { playing: +a.toFixed(2), pausedStart: +b1.toFixed(2), pausedLater: +b2.toFixed(2) });
    }
    if (errs.length) { fail++; console.log('page errors', errs); }
    await ctx.close();
  }
  console.log(fail ? `FAIL ${fail}` : 'ALL PASS'); await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

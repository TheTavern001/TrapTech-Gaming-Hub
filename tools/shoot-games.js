// v5: capture real gameplay frames of every game (used for review screenshots + to build the store thumbnails).
// usage: node tools/shoot-games.js [gameId ...]   -> screenshots/v5/play-<id>.png + /tmp/frames/<id>.png (raw canvas)
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787'; const SHOTS = path.join(__dirname, '..', 'screenshots', 'v5'); const FR = '/tmp/frames';
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(FR, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ALL = ['jetpack-dash', 'drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper'];
(async () => {
  const games = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (await p.$('#gate')) { await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.tap('#gate button[type=submit]'); await p.waitForSelector('.splash, .home, main', { state: 'attached' }); await sleep(800); }
  for (const g of games) {
    await p.goto(BASE + '/play/' + g, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.__game && window.__game.running, null, { timeout: 15000 });
    await sleep(500);
    const box = await p.locator('#game').boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.45);
        const plan = { 'jetpack-dash': 'hold', 'drift-rush': 'steer', 'memory-match': 'flip', 'terp-tapper': 'tap', 'high-score': 'tap', 'plinko': 'tap', 'spin-to-win': 'tap', 'blazed-roulette': 'tap' }[g];
    const t0 = Date.now();
    while (Date.now() - t0 < ({ 'jetpack-dash': 1500, 'memory-match': 500 }[g] || 2600)) {
      if (plan === 'hold') { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await sleep(180); await p.mouse.up(); await sleep(260); }
      else if (plan === 'steer') { await sleep(400); }
      else if (plan === 'flip') { await sleep(250); } // capture during the memorize peek so every photo face shows
      else { await p.touchscreen.tap(box.x + box.width * (0.15 + Math.random() * 0.7), box.y + box.height * (0.55 + Math.random() * 0.3)); await sleep(300); }
    }
    await p.screenshot({ path: path.join(SHOTS, `play-${g}.png`) });
    const data = await p.evaluate(() => document.querySelector('#game').toDataURL('image/png'));
    fs.writeFileSync(path.join(FR, g + '.png'), Buffer.from(data.split(',')[1], 'base64'));
    console.log('shot', g, await p.evaluate(() => window.__game.state));
  }
  console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

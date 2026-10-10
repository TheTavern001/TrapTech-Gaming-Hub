#!/usr/bin/env node
// Gameplay thumbnails: node tools/games-lib-thumb.js slug [slug...]   (BASE defaults to http://localhost:8795)
// Starts the game, plays gently (light taps / keys), samples frames every 250 ms and keeps the latest one taken
// while __GL.state === 'play' and at least ~1 s into the run (later attempts don't tap and keep an earlier frame, for tap-to-act games), so a title or game-over screen is never saved.
const path = require('path'); const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8795', PUB = path.join(__dirname, '..', 'public', 'games-lib');
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  for (const slug of process.argv.slice(2)) { const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await p.goto(`${BASE}/games-lib/${slug}/index.html`); await p.waitForFunction(() => window.__GL && window.__GL.g, null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(1200);
    let best = null; let quiet = false; for (let attempt = 0; attempt < 4 && !best; attempt++) {
      quiet = attempt >= 2; await p.keyboard.press('Space'); const cv = p.locator('#gl, canvas').first(); const bx = await cv.boundingBox(); if (quiet) await p.waitForTimeout(250); if (!quiet || await p.evaluate(() => window.__GL.state) !== 'play') await p.mouse.click(bx.x + bx.width / 2, bx.y + bx.height * 0.6);
      const t0 = Date.now(); while (Date.now() - t0 < 4500) { const st = await p.evaluate(() => window.__GL.state); if (st !== 'play') break;
        if (Date.now() - t0 > (quiet ? 300 : 900)) { const shot = await cv.screenshot({ type: 'jpeg', quality: 76 }); if (await p.evaluate(() => window.__GL.state) === 'play') best = shot; }
        if (Date.now() - t0 > (quiet ? 900 : 2600) && best) break; if (!quiet && Math.random() < 0.35) await p.mouse.click(bx.x + bx.width * (0.3 + Math.random() * 0.4), bx.y + bx.height * (0.4 + Math.random() * 0.4)); await p.waitForTimeout(quiet ? 80 : 250); }
      if (!best) { await p.keyboard.press('Enter'); await p.waitForTimeout(800); } }
    if (best) { require('fs').writeFileSync(path.join(PUB, slug, 'thumb.jpg'), best); console.log('OK  ', slug); } else console.log('FAIL', slug, '(never stayed in play long enough)');
    await p.close(); }
  await b.close(); })();

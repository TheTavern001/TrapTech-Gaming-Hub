// Quality audit: phone-viewport screenshot + 5 s FPS sample per game. Ratings (1-10 visual/feel + notes) are kept by hand
// in tools/games-lib-ratings.json; the builder writes both into docs/GAMES-LIB.md. Usage: node tools/games-lib-audit.js slug,slug
const { chromium, devices } = require('playwright-core'); const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8795'; const slugs = (process.argv[2] || '').split(',').filter(Boolean);
const OUT = path.join(__dirname, '..', 'docs', 'audit'); fs.mkdirSync(OUT, { recursive: true }); const RES = path.join(__dirname, 'games-lib-audit.json');
(async () => { const res = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : {}; const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  for (const s of slugs) { const ctx = await b.newContext({ ...devices['iPhone 13'], extraHTTPHeaders: { 'X-Forwarded-For': '10.7.' + (Math.random() * 250 | 0) + '.' + (Math.random() * 250 | 0) } }); const p = await ctx.newPage();
    await p.goto(BASE + '/games-lib/' + s + '/index.html'); await p.waitForTimeout(600); const vp = p.viewportSize(); await p.touchscreen.tap(vp.width / 2, vp.height / 2); await p.waitForTimeout(400);
    const fps = []; for (let i = 0; i < 5; i++) { await p.touchscreen.tap(vp.width * (0.3 + Math.random() * 0.4), vp.height * (0.4 + Math.random() * 0.3)); await p.waitForTimeout(1000); fps.push(await p.evaluate(() => window.__GL ? __GL.fps : 0)); }
    await p.screenshot({ path: path.join(OUT, s + '.jpg'), type: 'jpeg', quality: 60 }); res[s] = { fpsMin: Math.min(...fps), fpsAvg: Math.round(fps.reduce((a, c) => a + c, 0) / fps.length), gpu: await p.evaluate(() => window.__R ? { calls: __R.info.render.calls, tris: __R.info.render.triangles } : null), at: new Date().toISOString() };
    console.log(s, JSON.stringify(res[s])); await ctx.close(); }
  fs.writeFileSync(RES, JSON.stringify(res, null, 1)); await b.close(); })();

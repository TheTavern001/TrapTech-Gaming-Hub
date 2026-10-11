// Games Library e2e: every library game headless on desktop + iPhone. Usage:
//   BASE=http://localhost:8795 node tools/e2e-games-lib.js [slug,slug...]   (ONLY=batch:N also works via SLUGS env)
// Per game: page loads with no console errors, a scripted/random input session plays, FPS is measured, the run ends and the
// legit score is ACCEPTED by /api/score, a forged score on a fresh token is REJECTED, a gameplay frame is saved as thumb.jpg,
// and on the iPhone viewport the game starts from a touch and survives touch input with no errors.
const fs = require('fs'); const path = require('path');
const { chromium, devices } = require('playwright-core');
const BASE = process.env.BASE || 'http://localhost:8795';
const { games } = require('../src/games-lib');
const PUB = path.join(__dirname, '..', 'public', 'games-lib');
const SHOTS = path.join(__dirname, '..', 'screenshots', 'v7', 'games-lib');
const only = (process.argv[2] || process.env.SLUGS || '').split(',').filter(Boolean);
const list = games.filter(g => !only.length || only.includes(g.slug));
// Eligibility gate (Reese, Oct 10 2026): 100% of listed games giveaway-eligible, endless mode, L2+ anti-cheat,
// skill-only tie-break metrics (src/games-lib-playoff.js). Any failure fails the whole run.
{ const PO = require('../src/games-lib-playoff'); const { EXTERNAL } = require('../src/games-lib'); const bad = [];
  for (const g of games) { const m = PO.metricsFor(g.id); if (!g.giveaway || g.just_for_fun || !g.endless_mode || !(g.acLevel >= 2) || !m || m.length < 1 || m.some(x => !x.id || !['asc', 'desc'].includes(x.dir))) bad.push(g.slug); }
  if (EXTERNAL.length) bad.push('external links present');
  const pct = Math.round((games.length - bad.length) / games.length * 1000) / 10; console.log(`eligibility: ${games.length - bad.length}/${games.length} (${pct}%) giveaway-eligible with skill tie-breaks`);
  if (bad.length) { console.log('FAIL eligibility gate:', bad.join(', ')); process.exitCode = 1; } }
const PLAY_MS = +(process.env.PLAY_MS || 6000);
let ip = 0; const nextIp = () => { ip++; return `10.77.${Math.floor(ip / 250) % 250}.${ip % 250 + 1}`; };
// thumbnails are curated (docs/audit shots): only write one when the game has none yet, or when THUMBS=1 is set
const WRITE_THUMB = (slug) => process.env.THUMBS === '1' || !require('fs').existsSync(require('path').join(PUB, slug, 'thumb.jpg'));
let SEQ = 0; const RUN_ID = (Date.now() % 1e7) * 10 + (process.pid % 10);
async function signup(xff) {
  const u = 'tester' + String(RUN_ID) + String(++SEQ).padStart(3, '0'); // digits only: filter-safe, unique per run
  const r = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': xff }, body: JSON.stringify({ username: u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' }) });
  const ck = (r.headers.getSetCookie() || []).map(c => c.split(';')[0]); const j = await r.json(); if (!j.ok) throw new Error('signup failed ' + JSON.stringify(j));
  return ck.map(c => { const i = c.indexOf('='); return { name: c.slice(0, i), value: c.slice(i + 1), url: BASE }; });
}
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' ', ' ', 'ArrowLeft', 'ArrowRight'];
(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = []; let pass = 0, fail = 0;
  for (const g of list) {
    const R = { slug: g.slug, title: g.title, errors: [], desktop: {}, mobile: {} }; const t0 = Date.now();
    try {
      // ---------- desktop ----------
      const xff = nextIp(); const ctx = await browser.newContext({ viewport: { width: 1000, height: 720 }, extraHTTPHeaders: { 'X-Forwarded-For': xff } });
      await ctx.addCookies(await signup(xff)); const page = await ctx.newPage();
      page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(401|404|422)/.test(m.text())) R.errors.push('desktop: ' + m.text()); });
      page.on('pageerror', e => R.errors.push('desktop pageerror: ' + e.message));
      await page.goto(BASE + g.url, { waitUntil: 'load' }); await page.waitForTimeout(500); await page.waitForFunction(() => window.__GL && window.__GL.g, null, { timeout: 15000 }).catch(() => {});
      const runtimeReady = await page.evaluate(() => !!(window.__GL && window.__GL.g && typeof window.__GL.state === 'string'));
      if (!runtimeReady) throw new Error('Game runtime contract missing: window.__GL.g/state; check index script paths and engine adapter.');
      const box = await page.evaluate(() => { const c = document.querySelector('canvas') || document.getElementById('gl'); const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
      await page.keyboard.press('Space'); await page.mouse.click(box.x + box.w / 2, box.y + box.h / 2); await page.waitForFunction(() => window.__GL && ['play', 'over'].includes(window.__GL.state), null, { timeout: 12000 }).catch(() => {});
      R.desktop.started = await page.evaluate(() => window.__GL && window.__GL.state);
      let shot = false; const end = Date.now() + PLAY_MS;
      while (Date.now() < end) {
        const st = await page.evaluate(() => window.__GL.state); if (st === 'over') break;
        const r = Math.random();
        if (r < 0.45) { const k = KEYS[Math.floor(Math.random() * KEYS.length)]; await page.keyboard.down(k); await page.waitForTimeout(60 + Math.random() * 160); await page.keyboard.up(k); }
        else { const x = box.x + box.w * (0.15 + Math.random() * 0.7), y = box.y + box.h * (0.3 + Math.random() * 0.6); await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + (Math.random() - 0.5) * 80, y + (Math.random() - 0.5) * 80, { steps: 3 }); await page.waitForTimeout(40 + Math.random() * 200); await page.mouse.up(); }
        if (!shot && Date.now() > end - PLAY_MS + 900) { shot = true; const st2 = await page.evaluate(() => window.__GL.state); if (st2 === 'play') if (WRITE_THUMB(g.slug)) await page.locator('#gl, canvas').first().screenshot({ path: path.join(PUB, g.slug, 'thumb.jpg'), type: 'jpeg', quality: 72 }); }
      }
      R.desktop.performance = await page.evaluate(() => { const gl = window.__GL; return { fps: Number.isFinite(gl.fps) ? gl.fps : null, jsMs: Number.isFinite(gl.jsMs) ? gl.jsMs : null, stateAtSample: gl.state, measuredAfterMs: Math.round(performance.now()) }; });
      R.desktop.fps = R.desktop.performance.fps;
      if (R.desktop.fps === null) R.errors.push('desktop: FPS metric unavailable; no finite frame-rate sample');
      // no fallback thumbnail: a frame taken after the run ended would be a game-over screen (use tools/games-lib-thumb.js)
      // end the run through the game's own game-over path (same code path as dying) if the bot is still alive
      await page.evaluate(() => { if (window.__GL.state === 'play') { if (window.__GL.g.paused) window.__GL.g.paused = false; window.__GL.g.end('test end'); } });
      await page.waitForFunction(() => window.__GL.lastSubmit, null, { timeout: 8000 }).catch(() => {});
      const sub = await page.evaluate(() => window.__GL.lastSubmit); R.desktop.score = await page.evaluate(() => window.__GL.score); R.desktop.submit = sub && (sub.ok ? 'accepted' : 'REJECTED: ' + sub.error);
      // forged score on a fresh token -> must be rejected
      const forged = await page.evaluate(async (id) => { const s = await fetch('/api/run/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game_id: id }) }).then(r => r.json()); await new Promise(r => setTimeout(r, 1200)); const r = await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: s.token, score: 987654321, coins: 0, duration_ms: 1200 }) }); return { status: r.status, body: await r.json() }; }, g.id);
      R.desktop.forged = forged.status >= 400 && forged.body.rejected ? 'rejected' : 'ACCEPTED?! ' + JSON.stringify(forged);
      if (process.env.SHOTS === '1' || only.length <= 30) await page.screenshot({ path: path.join(SHOTS, g.slug + '-desktop-over.png') });
      await ctx.close();
      // ---------- iPhone ----------
      const xff2 = nextIp(); const mctx = await browser.newContext({ ...devices['iPhone 13'], extraHTTPHeaders: { 'X-Forwarded-For': xff2 } }); await mctx.addCookies(await signup(xff2)); const mp = await mctx.newPage();
      mp.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*(401|404|422)/.test(m.text())) R.errors.push('mobile: ' + m.text()); });
      mp.on('pageerror', e => R.errors.push('mobile pageerror: ' + e.message));
      await mp.goto(BASE + g.url, { waitUntil: 'load' }); await mp.waitForTimeout(400); await mp.waitForFunction(() => window.__GL && window.__GL.g, null, { timeout: 15000 }).catch(() => {});
      const vp = mp.viewportSize();
      const tapGame = async (x, y) => {
        const b = await mp.evaluate(() => { const c = document.querySelector('#gl, canvas'); if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
        await mp.touchscreen.tap(b ? b.x + b.w * x : vp.width * x, b ? b.y + b.h * y : vp.height * y);
      };
      await tapGame(0.5, 0.5);
      await mp.waitForFunction(() => window.__GL && ['play', 'over'].includes(window.__GL.state), null, { timeout: 7000 }).catch(() => {});
      let state = await mp.evaluate(() => window.__GL && window.__GL.state);
      if (state === 'title') { await tapGame(0.5, 0.5); await mp.waitForFunction(() => window.__GL && ['play', 'over'].includes(window.__GL.state), null, { timeout: 4000 }).catch(() => {}); state = await mp.evaluate(() => window.__GL && window.__GL.state); }
      R.mobile.started = state;
      const mend = Date.now() + 3000; while (Date.now() < mend) { await tapGame(0.2 + Math.random() * 0.7, 0.35 + Math.random() * 0.55); await mp.waitForTimeout(80 + Math.random() * 150); }
      R.mobile.fps = await mp.evaluate(() => window.__GL.fps);
      R.mobile.inputs = await mp.evaluate(() => window.__GL.g.inputs);
      R.mobile.hub = await mp.evaluate(() => window.Hub ? { tokenReady: !!Hub.token, guest: !!Hub.guest, error: Hub.err || null } : null);
      R.gpu = await mp.evaluate(() => window.__R ? { calls: __R.info.render.calls, tris: __R.info.render.triangles, dpr: __R.getPixelRatio() } : null);
      await mp.screenshot({ path: path.join(SHOTS, g.slug + '-iphone.png') });
      await mctx.close();
    } catch (e) { R.errors.push('harness: ' + e.message.split('\n')[0]); }
    const ok = !R.errors.length && ['play', 'over'].includes(R.desktop.started) && R.desktop.submit === 'accepted' && R.desktop.forged === 'rejected' && ['play', 'over'].includes(R.mobile.started) && (R.gpu ? (R.gpu.calls < 150 && R.gpu.tris < 160000 && R.gpu.dpr <= 2) : R.desktop.fps >= 20) && R.mobile.inputs > 0;
    R.pass = ok; ok ? pass++ : fail++; R.ms = Date.now() - t0; results.push(R);
    console.log(`${ok ? 'PASS' : 'FAIL'} ${g.slug.padEnd(18)} start=${R.desktop.started}/${R.mobile.started} ${R.gpu ? `fps=needs-GPU(headless ${R.desktop.fps}) budget calls=${R.gpu.calls} tris=${R.gpu.tris} dpr=${R.gpu.dpr}` : `fps=${R.desktop.fps}/${R.mobile.fps}`} score=${R.desktop.score} submit=${R.desktop.submit} forged=${R.desktop.forged} ${R.errors.length ? 'ERR ' + R.errors.slice(0, 2).join(' | ') : ''}`);
  }
  await browser.close();
  const outF = path.join(SHOTS, 'e2e-results.json'); let all = {}; try { all = JSON.parse(fs.readFileSync(outF, 'utf8')); } catch (e) {} for (const r of results) all[r.slug] = r; fs.writeFileSync(outF, JSON.stringify(all, null, 1));
  console.log(`\n${pass}/${pass + fail} games passed`); process.exit(fail ? 1 : 0);
})();

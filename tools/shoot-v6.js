// v6: capture gameplay of every game at 390x844 (mobile, DPR 2) + measure frame rate and per-frame draw cost.
// usage: [THROTTLE=4] [NOSHOT=1] node tools/shoot-v6.js [gameId ...]
//   -> screenshots/v6/play-<id>.png, /tmp/frames/<id>.png (raw canvas for thumbnails), screenshots/v6/fps[-x4].json
const { chromium } = require('playwright-core'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787'; const SHOTS = path.join(__dirname, '..', 'screenshots', 'v6'); const VIEW = (process.env.VIEW || '390x844').split('x').map(Number); const FR = process.env.FRAMES || '/tmp/frames';
const TH = +process.env.THROTTLE || 1; const NOSHOT = !!process.env.NOSHOT;
fs.mkdirSync(SHOTS, { recursive: true }); fs.mkdirSync(FR, { recursive: true });
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ALL = ['jetpack-dash', 'drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper', 'stack-2048', 'munchies-snake', 'brick-breaker', 'sky-hopper'];
(async () => {
  const games = process.argv.slice(2).length ? process.argv.slice(2) : ALL;
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--autoplay-policy=no-user-gesture-required', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: VIEW[0], height: VIEW[1] }, deviceScaleFactor: VIEW[0] > 700 ? 1.5 : 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  const cdp = await ctx.newCDPSession(p);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' });
  if (await p.$('#gate')) { await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.tap('#gate button[type=submit]'); await p.waitForSelector('.splash, .home, main', { state: 'attached' }); await sleep(800); }
  const out = {};
  for (const g of games) {
    const bytes = { n: 0 }; const onResp = async (r) => { const u = r.url(); if (/\/assets\/v[56]\//.test(u)) { try { const bb = await r.body(); bytes.n += bb.length; } catch {} } }; p.on('response', onResp);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await p.goto(BASE + '/play/' + g, { waitUntil: 'networkidle' });
    await p.waitForFunction(() => window.__game && window.__game.running, null, { timeout: 15000 });
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
    await sleep(500); p.off('response', onResp);
    if (process.env.BASELINE) await p.evaluate(() => { const G = window.__game; G.amb = null; G.P = null; G.D = null; G.L = null; G.AS = null; if (G.art) { G.art.clouds = null; G.art.tower = null; } });
    if (TH > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: TH });
    const box = await p.locator('#game').boundingBox();
    await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.45);
    await p.evaluate(() => { const G = window.__game; const st = window.__fps = { n: 0, t0: performance.now(), d: [] }; const od = G.draw.bind(G); G.draw = function () { const t = performance.now(); od(); st.d.push(performance.now() - t); }; const loop = () => { st.n++; if (!st.stop) requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
    const plan = { 'jetpack-dash': 'hold', 'drift-rush': 'steer', 'memory-match': 'flip', 'terp-tapper': 'tap', 'high-score': 'tap', 'plinko': 'tap', 'spin-to-win': 'tap', 'blazed-roulette': 'tap', 'stack-2048': 'swipe', 'munchies-snake': 'snake', 'brick-breaker': 'steer', 'sky-hopper': 'hop' }[g];
    const t0 = Date.now(); const dur = ({ 'jetpack-dash': 2500, 'memory-match': 600, 'munchies-snake': 2200, 'sky-hopper': 1400 }[g] || 3000);
    while (Date.now() - t0 < dur) {
      if (plan === 'hold') { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await sleep(200); await p.mouse.up(); await sleep(220); }
      else if (plan === 'steer') { await sleep(300); }
      else if (plan === 'swipe') { for (const k of ['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown']) { await p.keyboard.press(k); await sleep(120); } }
      else if (plan === 'snake') { await sleep(400); }
      else if (plan === 'hop') { const y = await p.evaluate(() => window.__game.y / window.__game.H); if (y > 0.42) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2); await sleep(80); }
      else if (plan === 'flip') { await sleep(200); }
      else { await p.touchscreen.tap(box.x + box.width * (0.15 + Math.random() * 0.7), box.y + box.height * (0.55 + Math.random() * 0.3)); await sleep(300); }
    }
    const m = await p.evaluate(() => { const st = window.__fps; st.stop = true; const el = (performance.now() - st.t0) / 1000; const d = st.d.slice().sort((a, b) => a - b); const q = (k) => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * k))] : 0; return { fps: +(st.n / el).toFixed(1), drawMs: +(d.reduce((a, b) => a + b, 0) / Math.max(1, d.length)).toFixed(2), p95: +q(0.95).toFixed(2), frames: d.length, state: window.__game.state }; });
    if (TH > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    m.artKB = Math.round(bytes.n / 1024); out[g] = m;
    if (!NOSHOT) {
      if (!process.env.FRAMES) await p.screenshot({ path: path.join(SHOTS, `play-${g}.png`) });
      const data = await p.evaluate(() => document.querySelector('#game').toDataURL('image/png'));
      fs.writeFileSync(path.join(FR, g + '.png'), Buffer.from(data.split(',')[1], 'base64'));
    }
    console.log(g, JSON.stringify(m));
  }
  if (!process.env.FRAMES) fs.writeFileSync(path.join(SHOTS, (process.env.BASELINE ? 'baseline-' : '') + (TH > 1 ? `fps-x${TH}.json` : 'fps.json')), JSON.stringify(out, null, 1));
  console.log(errs.length ? 'PAGE ERRORS: ' + errs.join(' | ') : 'no page errors');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });

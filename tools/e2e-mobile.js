// v5 phone + in-app browser test (Potato chat, Android WebView, iOS WKWebView).
// Emulates Pixel 7 (Chrome), iPhone 14 (Safari), an Android WebView UA, an iOS in-app (WKWebView) UA, and a
// "locked webview" (Android WebView UA + DOM storage that throws + cookies stripped from every response).
// Visits every page and plays every game with touch input on each profile.
// Usage: node tools/e2e-mobile.js   (restart the server first: it signs up 5 accounts; signup is limited to 10/hour per IP)
const { chromium, devices } = require('playwright-core');
const path = require('path'); const fs = require('fs');
const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = path.join(__dirname, '..', 'screenshots', 'v5'); fs.mkdirSync(SHOTS, { recursive: true });
let pass = 0, fail = 0; const errors = []; const report = {};
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const P7 = devices['Pixel 7'], I14 = devices['iPhone 14'];
const AND_WV = 'Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UQ1A.240205.004; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.6668.100 Mobile Safari/537.36';
const IOS_INAPP = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Potato/6.2';
const PROFILES = [
  { id: 'desktop-chrome', dev: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: true } },
  { id: 'pixel7-chrome', dev: P7 },
  { id: 'iphone14-safari', dev: I14 },
  { id: 'android-webview', dev: { ...P7, userAgent: AND_WV } },
  { id: 'ios-inapp-wkwebview', dev: { ...I14, userAgent: IOS_INAPP } },
  { id: 'locked-webview', dev: { ...P7, userAgent: AND_WV }, locked: true },
];
// Use the canonical ACTIVE registry. Retired chance games must not appear in
// the mobile release gate or a stale hard-coded list will report false failures.
const GAMES = require('../src/config').GAMES.filter(g => !g.retired && g.playable !== false).map(g => g.id);
let STEP = 'start'; const T0 = Date.now();
setInterval(() => { if (Date.now() - T0 > 20 * 60e3) { console.error('WATCHDOG: hung at', STEP); process.exit(2); } }, 1000).unref();
(async () => {
  const chromeBin = process.env.CHROME_BIN || ['/usr/bin/google-chrome','/usr/bin/chromium','/usr/bin/chromium-browser'].find(f=>fs.existsSync(f));
  if(!chromeBin) throw Error('Chromium/Chrome not installed; set CHROME_BIN');
  const browser = await chromium.launch({ executablePath: chromeBin, args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'] });
  const gw = await (await fetch(BASE + '/api/giveaways?status=active')).json(); const gid = gw.giveaways[0] && gw.giveaways[0].id;
  for (const pf of PROFILES.filter(x => !process.env.ONLY || process.env.ONLY.split(',').includes(x.id))) {
    console.log(`# ${pf.id}${pf.locked ? ' (storage throws + cookies blocked)' : ''}`);
    const ctx = await browser.newContext({ ...pf.dev });
    if (pf.locked) {
      await ctx.addInitScript(() => { const boom = { get() { throw new DOMException('blocked', 'SecurityError'); } }; try { Object.defineProperty(window, 'localStorage', boom); Object.defineProperty(window, 'sessionStorage', boom); } catch {} });
      await ctx.route('**/*', async (route) => { const r = await route.fetch(); const h = { ...r.headers() }; delete h['set-cookie']; await route.fulfill({ response: r, headers: h }); });
    }
    const p = await ctx.newPage(); const tag = pf.id; let bytes = 0, reqs = 0;
    // locked webviews keep gate/session only in memory, so navigate in-app (SPA) instead of reloading
    const nav = async (u) => { if (pf.locked) { await p.evaluate((u) => window.__go(u), u); await sleep(150); } else await p.goto(BASE + u); };
    const tapGame = async (x, y) => { if (pf.id === 'desktop-chrome') await p.mouse.click(x, y); else await p.touchscreen.tap(x, y); };
    p.on('pageerror', e => errors.push(`[${tag}] ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/favicon|status of 4\d\d/.test(m.text())) errors.push(`[${tag}] console: ${m.text()}`); });
    p.on('popup', () => errors.push(`[${tag}] a popup window was opened`));
    p.on('dialog', d => { errors.push(`[${tag}] native dialog: ${d.type()}`); d.dismiss(); });
    const onFin = async (rq) => { try { const s = await rq.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; reqs++; } catch {} };
    p.on('requestfinished', onFin);
    STEP = tag + ' first load';
    await p.goto(BASE + '/', { waitUntil: 'networkidle' });
    p.off('requestfinished', onFin);
    report[tag] = { first_load_kb: Math.round(bytes / 1024), requests: reqs };
    ok(bytes < 2 * 1024 * 1024, `first load ${Math.round(bytes / 1024)} KB in ${reqs} requests (< 2 MB budget)`);
    // 21+ gate through the UI (works without storage)
    await p.waitForSelector('#gate'); await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.tap('#gate button[type=submit]');
    await p.waitForSelector('.splash, .home, main'); ok(true, 'age gate passes with touch');
    const vp = await p.evaluate(() => document.querySelector('meta[name=viewport]').content);
    ok(vp.includes('viewport-fit=cover') && !vp.includes('user-scalable=no'), 'viewport-fit=cover (safe areas) without disabling zoom');
    const ta = await p.evaluate(() => getComputedStyle(document.documentElement).touchAction);
    ok(ta === 'manipulation', 'touch-action: manipulation (no 300ms delay / double-tap zoom)');
    // sign up through the UI
    STEP = tag + ' signup';
    const uname = 'mb_' + Math.random().toString(36).slice(2, 7);
    await nav('/signup'); await p.waitForSelector('#su-u, #u, input[autocomplete=username]');
    const uSel = (await p.$('#su-u')) ? '#su-u' : (await p.$('#u')) ? '#u' : 'input[autocomplete=username]';
    await p.fill(uSel, uname);
    const pws = await p.$$('input[type=password]'); for (const x of pws) await x.fill('mobilepass123');
    for (const [k, v] of [['m', '05'], ['d', '05'], ['y', '1990']]) { const el = await p.$(`#dob-${k}`); if (el) await el.fill(v); }
    const agree = await p.$('#agree'); if (agree) await agree.check();
    await p.tap('form button[type=submit]');
    await p.waitForFunction(() => !location.pathname.startsWith('/signup'), null, { timeout: 15000 }).catch(() => {});
    const me = await p.evaluate(async () => { const r = await fetch('/api/me', { headers: window.__ghTok ? { 'X-Session': window.__ghTok } : {} }); return r.json(); });
    const signedIn = await p.evaluate(() => !!document.querySelector('.topbar a[aria-label="My profile"]'));
    ok(signedIn, `signed up + signed in as ${uname}${pf.locked ? ' (session via X-Session header, no cookies)' : ''}`, me);
    // every page: renders, no horizontal overflow
    STEP = tag + ' pages';
    const pages = ['/', '/games', '/leaderboard', '/giveaways', ...(gid ? [`/giveaways/${gid}`, `/giveaways/${gid}/live`, `/giveaways/${gid}/rules`] : []), '/tournaments', '/community', '/achievements', '/quests', '/season',
      '/sponsor', '/shop', '/about', '/terms', '/privacy', '/rules', '/responsible-play', '/search', '/notifications', '/settings', '/invite', '/u/' + uname, ...GAMES.map(g => '/games/' + g)];
    const bad = [];
    for (const u of pages) {
      await nav(u); await p.waitForSelector('main#main', { timeout: 15000 }); await sleep(250);
      const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, empty: !document.querySelector('main#main').textContent.trim(), err: !!document.querySelector('.empty-state b') && /went wrong|not found/i.test(document.querySelector('.empty-state b').textContent) }));
      if (r.over > 1 || r.empty || r.err) bad.push([u, r]);
    }
    ok(!bad.length, `${pages.length} pages render without horizontal overflow or errors`, bad);
    // every game: touch to start, run is saved
    STEP = tag + ' games';
    const saved = [];
    for (const g of GAMES) {
      await nav('/play/' + g); await p.waitForSelector('#game'); await p.waitForFunction(() => window.__game && window.__game.running, null, { timeout: 15000 });
      const box = await p.locator('#game').boundingBox();
      ok(box.width >= 300 && box.height >= 300, `${g}: canvas fills the portrait screen (${Math.round(box.width)}x${Math.round(box.height)})`);
      await tapGame(box.x + box.width / 2, box.y + box.height * 0.45); await sleep(600);
      if (g === 'drift-rush') { await tapGame(box.x + box.width / 2, box.y + box.height * 0.5); }
      const st = await p.evaluate(() => window.__game.state);
      ok(st === 'play' || st === 'over', `${g}: touch starts the run (state ${st})`);
      if (pf.id === 'desktop-chrome') await p.screenshot({ path: path.join(SHOTS, `d-play-${g}.png`) });
      if (pf.id === 'pixel7-chrome') await p.screenshot({ path: path.join(SHOTS, `m-play-${g}.png`) });
      await sleep(900);
      const st2 = await p.evaluate(() => window.__game.state);
      if (st2 === 'play' || st2 === 'paused') { await p.tap('#pause').catch(() => {}); await p.waitForSelector('#endrun, #sv .ok-msg, #sv .err', { timeout: 15000 }); if (await p.isVisible('#endrun')) await p.tap('#endrun'); } // one-hit games (Sky Hopper) can end on their own while Pause is tapped
      await p.waitForSelector('#sv .ok-msg, #sv .err', { timeout: 20000 }).catch(() => {});
      const res = await p.evaluate(() => window.__lastResult);
      if (res && res.ok) saved.push(g); else console.log('   not saved', g, res && res.error);
      const audio = await p.evaluate(() => window.__ghAC ? window.__ghAC.state : 'none');
      if (g === 'jetpack-dash') ok(audio === 'running', `audio unlocked by the first tap (AudioContext ${audio})`);
    }
    ok(saved.length === GAMES.length, `all ${GAMES.length} games saved a run with touch input (${saved.length})`, GAMES.filter(g => !saved.includes(g)));
    // share uses navigator.share or an on-page copy sheet (never window.open / prompt)
    STEP = tag + ' share';
    if (gid) {
      await p.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); } catch {} try { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch {} document.execCommand = () => false; });
      await nav(`/giveaways/${gid}`); await p.waitForSelector('#share-gw');
      await p.evaluate(() => { try { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); } catch {} document.execCommand = () => false; });
      await p.tap('#share-gw'); await p.waitForSelector('.copy-sheet #copy-field', { timeout: 5000 }).catch(() => {});
      ok(!!(await p.$('.copy-sheet #copy-field')) && (await p.inputValue('.copy-sheet #copy-field')).includes(`/giveaways/${gid}`), 'share falls back to an on-page copy sheet (no prompt/popup)');
      if (pf.id === 'ios-inapp-wkwebview') await p.screenshot({ path: path.join(SHOTS, 'm-share-copy-fallback-inapp.png') });
    }
    await ctx.close();
  }
  await browser.close();
  ok(errors.length === 0, 'no JS errors, popups or native dialogs on any profile', errors.slice(0, 10));
  console.log('\nREPORT ' + JSON.stringify(report));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(errors.length ? 'JS errors:\n' + errors.join('\n') : 'JS errors: none');
  // cleanup: delete mb_ users
  try { const db = require('../src/db'); const ids = db.prepare("SELECT id FROM users WHERE username LIKE 'mb\\_%' ESCAPE '\\'").all(); for (const { id } of ids) { db.prepare('DELETE FROM activity WHERE user_id=?').run(id); db.prepare('DELETE FROM users WHERE id=?').run(id); } console.log('cleanup: removed', ids.length, 'mb_ users'); } catch (e) { console.log('cleanup failed', e.message); }
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH at', STEP, e); process.exit(1); });

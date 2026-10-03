// Headless browser end-to-end test + screenshots.
// Usage: BASE=http://localhost:8787 node tools/e2e-browser.js
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = path.join(__dirname, '..', 'screenshots');
const V2 = path.join(SHOTS, 'v2');
fs.mkdirSync(V2, { recursive: true });
const ENV_FILE = path.join(__dirname, '..', '.env');
const env = { ...(fs.existsSync(ENV_FILE) ? Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter(Boolean).map(l => l.split(/=(.*)/s).slice(0, 2))) : {}), ...(process.env.ADMIN_PASSWORD ? { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD } : {}) };
let pass = 0, fail = 0; const errors = [];
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x ?? ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
function watch(page, tag) {
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|status of 4\d\d/.test(m.text())) errors.push(`[${tag}] console: ${m.text()}`); });
  page.on('dialog', d => d.type() === 'prompt' ? d.accept() : d.accept());
}
async function shot(page, name, full = false, keepAch = false) { await sleep(350); await page.evaluate((k) => { document.querySelectorAll('.toast').forEach(t => t.remove()); if (!k) document.querySelectorAll('.ach-stack').forEach(t => t.remove()); }, keepAch); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: full }); console.log('   shot', name); }
const v2 = (page, name, full = false, keepAch = false) => shot(page, 'v2/' + name, full, keepAch);
// logical game coords -> page coords (for clicking on canvas objects)
const L2S = (page, x, y) => page.evaluate(([x, y]) => { const g = window.__game; const r = g.c.getBoundingClientRect(); const d = g.c.width / r.width; return [r.left + (x * g.scale + g.ox) / d, r.top + (y * g.scale + g.oy) / d]; }, [x, y]);
async function tapL(page, x, y, hold = 60) { const [px, py] = await L2S(page, x, y); await page.mouse.move(px, py); await page.mouse.down(); await sleep(hold); await page.mouse.up(); }

// Playwright's browser pipe is unref'd: keep the process alive so a hung step times out loudly instead of exiting silently.
let STEP = 'start'; const t0 = Date.now();
setInterval(() => { if (Date.now() - t0 > 15 * 60e3) { console.error('WATCHDOG: hung at step', STEP); process.exit(2); } }, 1000);
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const uname = 'ui_' + Math.random().toString(36).slice(2, 7); const pw = 'testpass123'; const brand = 'UI Test Brand ' + uname;
  console.log('BASE', BASE, 'user', uname);

  // ---------- mobile player flow ----------
  const mctx = await browser.newContext(MOBILE); const m = await mctx.newPage(); watch(m, 'mobile');
  console.log('# splash / sign up');
  await m.goto(BASE + '/'); await m.waitForSelector('.splash');
  ok(await m.isVisible('.splash .logo-stack'), 'first visit shows splash'); await shot(m, 'mobile-01-splash');
  await m.click('text=Get Started'); await m.waitForSelector('#f');
  ok(m.url().endsWith('/signup'), 'Get Started -> sign up');
  await m.fill('#u', 'bad name'); await m.fill('#p', pw); await m.fill('#p2', pw); await m.check('#agree'); await m.click('button[type=submit]');
  ok(await m.isVisible('.err'), 'sign up validates username (no spaces)');
  await m.fill('#u', uname); await m.fill('#p2', 'mismatch1'); await m.click('button[type=submit]');
  ok((await m.textContent('.err')).includes('match'), 'sign up validates password confirmation');
  await m.fill('#p2', pw); await m.evaluate(() => document.querySelector('#msg').innerHTML = ''); await shot(m, 'mobile-03-signup');
  await m.click('button[type=submit]'); await m.waitForURL(/\/games\/jetpack-dash/);
  ok(true, 'sign up succeeds and lands on Jetpack Dash');
  await m.waitForSelector('.gd-hero'); await shot(m, 'mobile-06-game-detail');

  console.log('# sign out / sign in');
  await m.click('.topbar [data-act=menu] >> nth=-1'); await m.click('.drawer [data-act=signout]'); await m.waitForURL(/\/signin/);
  ok(true, 'sign out from menu');
  ok((await m.inputValue('#u')) === uname, 'username remembered on sign-in form (localStorage)');
  await m.fill('#p', 'wrongpass1'); await m.click('button[type=submit]'); await m.waitForSelector('.err');
  ok((await m.textContent('.err')).includes('Wrong'), 'wrong password shows error');
  await m.fill('#p', ''); await m.evaluate(() => document.querySelector('#msg').innerHTML = ''); await shot(m, 'mobile-02-signin');
  await m.fill('#p', pw); await m.click('button[type=submit]'); await m.waitForURL(u => new URL(u).pathname === '/');
  await m.waitForSelector('.hero, .hero-take'); ok(true, 'sign in -> home');
  ok(await m.isVisible('.hero-take'), 'Elite + featured giveaway takes over the home hero banner');
  await m.waitForFunction(() => document.querySelector('.cd b') && !document.querySelector('.cd b').textContent.includes('-'));
  const cd1 = await m.textContent('.cd'); await sleep(2200); const cd2 = await m.textContent('.cd');
  ok(cd1 !== cd2 && !cd2.includes('--'), 'home live-giveaway countdown ticks', cd1 + ' / ' + cd2);
  await shot(m, 'mobile-04-home'); await shot(m, 'mobile-04-home-full', true);

  console.log('# games library');
  await m.click('.bottomnav >> text=Games'); await m.waitForSelector('#grid .gcard');
  const nAll = await m.locator('#grid .gcard').count(); await m.fill('#q', 'plin'); const nQ = await m.locator('#grid .gcard').count();
  ok(nAll >= 5 && nQ === 1, `games search filters (${nAll} -> ${nQ})`); await m.fill('#q', '');
  await m.click('#chips >> text=Racing'); ok((await m.locator('#grid .gcard').count()) === 1, 'category chip filters');
  await m.click('#chips >> text=All'); await shot(m, 'mobile-05-games'); await v2(m, 'games-library');
  ok((await m.locator('main .gcard').count()) === 8 && (await m.locator('main .gcard .soon').count()) === 0, 'all 8 games listed, none "coming soon"');
  await v2(m, 'games-library-full', true);
  await m.click('#grid .gcard[data-game=drift-rush]'); await m.waitForSelector('.gd-hero');
  const dtxt = await m.textContent('main'); ok(dtxt.includes('Play Now') && dtxt.includes('Scoring') && !dtxt.includes('COMING SOON'), 'Drift Rush detail page is playable with how-to + scoring');

  console.log('# play Jetpack Dash');
  await m.goto(BASE + '/play/jetpack-dash'); await m.waitForSelector('#game'); await sleep(1200);
  const box = await m.locator('#game').boundingBox();
  // fly a bit: press-hold pattern via touch-like pointer events
  await m.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 6; i++) { await m.mouse.down(); await sleep(260); await m.mouse.up(); await sleep(320); }
  await m.keyboard.down('Space'); await sleep(400); await m.keyboard.up('Space');
  await shot(m, 'mobile-07-gameplay');
  // then idle until we die (missiles track the player)
  await m.waitForSelector('#ov:not(.hidden) .over-card', { timeout: 120000 });
  await m.waitForSelector('#sv .ok-msg, #sv .err', { timeout: 15000 });
  const saved = await m.textContent('#sv'); ok(saved.includes('Saved'), 'run over -> score auto-submitted and saved', saved);
  ok(await m.isVisible('.ach-toast'), 'achievement unlock toast shows after the run'); ok((await m.textContent('#sv')).includes('First Flight') || (await m.locator('#sv .unl').count()) >= 1, 'run result lists the unlocked achievements');
  await shot(m, 'mobile-08b-achievement-toast', false, true);
  ok(/Counted for/.test(saved), 'run counted toward the active giveaway', saved);
  const scoreTxt = await m.textContent('.over-card .big'); const myScore = parseInt(scoreTxt.replace(/\D/g, ''), 10);
  await shot(m, 'mobile-08-game-over');
  await m.click('#again'); await sleep(800); ok(await m.isHidden('#ov'), 'Play Again restarts'); 

  console.log('# leaderboard');
  await m.goto(BASE + '/leaderboard?game=jetpack-dash'); await m.waitForSelector('.lb');
  ok((await m.textContent('.lb')).includes(uname), `my score (${myScore}m) appears on Jetpack Dash leaderboard`);
  for (const t of ['Weekly', 'Monthly', 'All Time']) { await m.click(`#per >> text=${t}`); await sleep(500); ok((await m.textContent('#tbl')).includes(uname), `${t} tab includes my run`); }
  await m.click('#gsel >> text=Global'); await sleep(500); await m.check('#mine'); await sleep(600);
  ok(await m.isVisible('.lb tr.me'), 'View My Rank highlights my row');
  await m.uncheck('#mine'); await m.evaluate(() => window.scrollTo(0, 0)); await shot(m, 'mobile-09-leaderboard');

  console.log('# giveaways');
  await m.click('.bottomnav >> text=Giveaways'); await m.waitForSelector('.gw');
  ok((await m.locator('.gw').count()) >= 1, 'active giveaways listed');
  await shot(m, 'mobile-10-giveaways');
  await m.click('#t >> text=Upcoming'); await sleep(600); ok((await m.textContent('#list')).includes('Starts in'), 'upcoming tab shows start countdown');
  await m.click('#t >> text=Past'); await sleep(600); ok((await m.textContent('#list')).match(/Ended|No past/), 'past tab works');
  await m.click('#t >> text=Active'); await sleep(600); await m.click('.gw .btn >> nth=0'); await m.waitForSelector('.lb, .empty');
  ok((await m.textContent('main')).includes("You're entered"), 'giveaway detail shows I am entered');
  await shot(m, 'mobile-11-giveaway-detail', true);

  console.log('# profile');
  await m.goto(BASE + '/profile'); await m.waitForSelector('.prof-head');
  const st = await m.locator('.stat3 b').allTextContents(); ok(st[1] === '1' && +st[0].replace(/\D/g, '') === myScore, 'profile shows total score = my run and games played = 1', st);
  ok((await m.textContent('.card .act-row')).includes('Jetpack Dash'), 'profile recent activity shows the run');
  await shot(m, 'mobile-12-profile');

  console.log('# new games: play each briefly, end run & save');
  const NEW = ['drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper'];
  const PLAY = {
    'drift-rush': async (p, box) => { for (let i = 0; i < 6; i++) { const left = i % 2 === 0; await p.mouse.move(box.x + box.width * (left ? 0.2 : 0.8), box.y + box.height * 0.7); await p.mouse.down(); await sleep(left ? 700 : 900); await p.mouse.up(); await sleep(200); } },
    plinko: async (p) => { for (let i = 0; i < 3; i++) { const g = await p.evaluate(() => ({ x: window.__game.g.bx + window.__game.g.bw * (0.15 + Math.random() * 0.7), y: window.__game.g.top + 20 })); await tapL(p, g.x, g.y, 120); await sleep(900); const c = await p.evaluate(() => window.__game.chip && { x: window.__game.chip.x, y: window.__game.chip.y }); if (c) await tapL(p, c.x + 40, c.y); await sleep(2600); } },
    'spin-to-win': async (p, box) => { for (let i = 0; i < 2; i++) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await sleep(500 + i * 350); await p.mouse.up(); await sleep(i === 0 ? 1500 : 5200); } },
    'memory-match': async (p) => { await sleep(1800); for (let n = 0; n < 4; n++) { const pair = await p.evaluate(() => { const g = window.__game; const left = g.cards.filter(c => !c.done && !c.open); const a = left[0]; const b = left.find(c => c !== a && c.g === a.g); const R = (c) => { const [x, y, w, h] = g.rect(c.k); return [x + w / 2, y + h / 2]; }; return a && b ? [R(a), R(b)] : null; }); if (!pair) break; await tapL(p, ...pair[0]); await sleep(150); await tapL(p, ...pair[1]); await sleep(450); } },
    'high-score': async (p) => { const until = Date.now() + 5000; while (Date.now() < until) { const t = await p.evaluate(() => (window.__game.targets || []).filter(t => t.type !== 'bomb').map(t => [t.x, t.y])[0]); if (t) await tapL(p, t[0], t[1], 30); await sleep(120); } },
    'blazed-roulette': async (p) => { for (let i = 0; i < 2; i++) { for (const id of ['red', 'd2']) { const b = await p.evaluate((id) => { const b = window.__game.btns.find(x => x.id === id); return [b.x + b.w / 2, b.y + b.h / 2]; }, id); await tapL(p, ...b); await sleep(150); } const d = await p.evaluate(() => { const b = window.__game.btns.find(x => x.id === 'drop'); return [b.x + b.w / 2, b.y + b.h / 2]; }); await tapL(p, ...d); await sleep(i === 0 ? 4300 : 1200); } },
    'terp-tapper': async (p) => { await p.evaluate(() => { const K = ['KeyD', 'KeyF', 'KeyJ', 'KeyK']; const g = window.__game; const done = new Set(); const loop = () => { if (g.state !== 'play') return; for (const n of g.notes) if (!n.done && !done.has(n) && Math.abs(n.t - g.playT) < 0.03) { done.add(n); window.dispatchEvent(new KeyboardEvent('keydown', { code: K[n.lane] })); window.dispatchEvent(new KeyboardEvent('keyup', { code: K[n.lane] })); } window.__tt = requestAnimationFrame(loop); }; loop(); }); await sleep(6500); },
  };
  let lastUnlocked = [];
  for (const id of NEW) {
    await m.goto(BASE + '/play/' + id); await m.waitForSelector('#game'); await m.waitForFunction(() => window.__game && window.__game.running, null, { timeout: 15000 });
    const box = await m.locator('#game').boundingBox();
    await m.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45); await m.mouse.down(); await sleep(40); await m.mouse.up(); await sleep(300);
    ok(await m.evaluate(() => window.__game.state === 'play'), `${id}: tap starts the run`);
    STEP = 'play ' + id; await PLAY[id](m, box); STEP = 'save ' + id;
    await v2(m, 'game-' + id);
    const st = await m.evaluate(() => window.__game.state);
    if (st === 'play' || st === 'paused') { await m.click('#pause'); await m.waitForSelector('#endrun'); await m.click('#endrun'); }
    await m.waitForSelector('#sv .ok-msg, #sv .err', { timeout: 20000 });
    const res = await m.evaluate(() => window.__lastResult);
    ok(res && res.ok && res.game_id === id && (await m.textContent('#sv')).includes('Saved'), `${id}: run saved via run-token flow (score ${res && res.score})`, res && res.error);
    lastUnlocked = (res && res.unlocked) || [];
    if (id === 'drift-rush' || id === 'blazed-roulette' || id === 'high-score') ok(res && res.score > 0, `${id}: real inputs produced a score > 0 (${res && res.score})`);
  }
  ok(lastUnlocked.some(a => a.id === 'variety-all'), 'playing all 8 games unlocks "variety-all" (server-side)', lastUnlocked.map(a => a.id));
  ok(await m.isVisible('.ach-toast'), 'unlock toast visible after the last run');
  await shot(m, 'mobile-08c-unlock-toast', false, true);
  const lbAll = await m.evaluate(async (u) => { const out = {}; for (const g of ['drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper']) { const r = await (await fetch('/api/leaderboard?game=' + g + '&limit=500')).json(); out[g] = r.rows.some(x => x.username === u); } return out; }, uname);
  ok(Object.values(lbAll).every(Boolean), 'my scores are on every new game leaderboard', lbAll);

  console.log('# achievements page');
  await m.goto(BASE + '/achievements'); await m.waitForSelector('.ach');
  const nAch = await m.locator('.ach').count(); const nOn = await m.locator('.ach.on').count();
  ok(nAch >= 60 && nAch <= 100 && nOn >= 4, `achievements page: ${nAch} achievements, ${nOn} unlocked`);
  ok((await m.textContent('main')).includes('Cosmetic only, no cash value'), 'achievements page states "Cosmetic only, no cash value"');
  ok((await m.locator('.ach .bar i').count()) >= 10 && (await m.locator('.ach .rar').count()) === nAch, 'progress bars + rarity % shown');
  await v2(m, 'achievements');
  await m.click('#flt >> text=Unlocked'); await sleep(300); ok((await m.locator('.ach.off').count()) === 0, 'filter: unlocked only'); await v2(m, 'achievements-unlocked');
  await m.click('#flt >> text=All'); await m.click('#cats >> text=Secret'); await sleep(300); ok((await m.textContent('#alist')).includes('Secret achievement'), 'secret category hides locked secrets');

  console.log('# profile: equip banner, frame, title');
  await m.goto(BASE + '/profile'); await m.waitForSelector('#czl .czi');
  const before = await m.getAttribute('#pbanner', 'class');
  const pickB = m.locator('#czl .czi:not(.locked):not(.on)').first(); const bId = await pickB.getAttribute('data-id');
  ok(!!bId && (await m.locator('#czl .czi.locked').count()) > 0, 'customize shows owned + locked banners');
  await pickB.click(); await m.waitForFunction((b) => document.querySelector('#pbanner').classList.contains('bn-' + b), bId);
  ok(before !== (await m.getAttribute('#pbanner', 'class')), `banner equipped (${bId})`);
  await m.click('#czt >> text=Frames'); const fr = m.locator('#czl .czi:not(.locked):not(.on)').first(); if (await fr.count()) { await fr.click(); await sleep(500); }
  await m.click('#czt >> text=Titles'); const ti = m.locator('#czl .czi:not(.locked):not(.on)').first(); const tName = await ti.locator('b').textContent(); await ti.click(); await sleep(500);
  ok((await m.textContent('#pbanner .ptitle')) === tName, `title equipped (${tName})`);
  await m.evaluate(() => window.scrollTo(0, 0)); await v2(m, 'profile-equipped-banner');
  await m.evaluate(() => document.getElementById('customize').scrollIntoView()); await m.click('#czt >> text=Banners'); await sleep(300); await v2(m, 'profile-customize-banners');
  await m.goto(BASE + '/leaderboard?game=plinko'); await m.waitForSelector('.lb');
  const myRow = m.locator('.lb tr', { hasText: uname }).first();
  ok((await myRow.locator('.bn-strip.bn-' + bId).count()) === 1 && (await myRow.textContent()).includes(tName), 'equipped banner + title show on the leaderboard');
  await m.goto(BASE + '/community'); await m.waitForSelector('.post');
  const hype = m.locator('.post .hype').first(); await hype.click(); await m.waitForFunction(() => document.querySelector('.post .hype').classList.contains('on')); ok(true, 'hype a community post');

  console.log('# host packages / booking with tier');
  await m.goto(BASE + '/host'); await m.waitForSelector('.pk');
  const prices = await m.locator('.pk .pk-price b').allTextContents();
  ok(prices.join() === '$49,$149,$399', 'package prices shown (admin-editable)', prices);
  ok((await m.locator('.pk.basic .pk-f li').count()) >= 5 && (await m.locator('.pk.elite .pk-f li').count()) >= 8 && (await m.locator('.pk-who').count()) === 3, 'each tier lists who-it-is-for + distinct features');
  ok((await m.locator('.cmp tbody tr').count()) >= 10, 'comparison table rendered'); ok((await m.locator('.faq details').count()) >= 5, 'FAQ rendered');
  await shot(m, 'mobile-13-host'); await v2(m, 'host-packages');
  await m.evaluate(() => document.querySelector('.pk.premium').scrollIntoView()); await v2(m, 'host-packages-premium');
  await m.evaluate(() => document.querySelector('.pk.elite').scrollIntoView()); await v2(m, 'host-packages-elite');
  await m.evaluate(() => document.querySelector('.cmp-wrap').scrollIntoView()); await v2(m, 'host-compare-table');
  await m.evaluate(() => document.getElementById('faq').scrollIntoView()); await v2(m, 'host-faq');
  await m.click('#ht >> text=Custom Event'); ok(await m.isVisible('text=Request a Custom Event'), 'custom event tab');
  await m.click('#ht >> text=Giveaway Packages'); await m.click('.pk.elite [data-pick=elite]'); await m.waitForSelector('[data-b=brand]');
  ok((await m.textContent('#pksel')).includes('Elite') && (await m.textContent('#pksel')).includes('$399'), 'booking form carries the chosen tier (Elite $399)');
  await m.click('#tp [data-t=premium]'); ok((await m.textContent('#pksel')).includes('Premium'), 'tier can be switched in the form'); await m.click('#tp [data-t=elite]');
  await m.click('#next'); ok(await m.isVisible('.err'), 'booking step 1 validates brand');
  await m.fill('[data-b=brand]', brand); await m.selectOption('[data-b=event_type]', 'Giveaway'); await m.fill('[data-b=contact]', 'uitest@example.com');
  await m.evaluate(() => { const e = document.querySelector('.err'); if (e) e.remove(); }); await shot(m, 'mobile-14-booking'); await v2(m, 'booking-with-tier');
  await m.click('#next'); await m.fill('[data-b=start_date]', '2026-11-01'); await m.fill('[data-b=end_date]', '2026-11-15'); await m.fill('[data-b=details]', 'Headless browser test booking');
  await m.click('#next'); ok((await m.textContent('main')).includes(brand) && (await m.textContent('[data-rv=package]')).includes('Elite - $399'), 'review step shows summary incl. package + price');
  await m.click('#next'); await m.waitForSelector('text=Request Sent!'); ok((await m.textContent('#booked-pkg')).includes('Elite'), 'booking submitted with Elite tier');

  console.log('# community');
  await m.click('.bottomnav >> text=Community'); await m.waitForSelector('.post'); await shot(m, 'mobile-15-community');

  // ---------- guest flow ----------
  console.log('# guest');
  const gctx = await browser.newContext(MOBILE); const g = await gctx.newPage(); watch(g, 'guest');
  await g.goto(BASE + '/signin'); await g.click('#guest'); await g.waitForSelector('.hero, .hero-take'); ok(true, 'Continue as Guest -> home');
  await g.goto(BASE + '/games/jetpack-dash'); ok((await g.textContent('main')).includes('Playing as guest'), 'guest sees practice-mode note');
  await g.goto(BASE + '/play/jetpack-dash'); await g.waitForSelector('#game'); ok((await g.textContent('.who-chip')).includes('Guest'), 'guest can play practice run');
  await g.goto(BASE + '/giveaways'); await g.waitForSelector('.gw'); await g.click('.gw .btn >> nth=0'); await g.waitForURL(/giveaways\/\d+/); await g.waitForSelector('.back-row');
  ok(await g.isVisible('text=Sign in to enter') && (await g.locator('.gpicks a[href^="/signin"]').count()) >= 1, 'guest is asked to sign in to enter giveaway');
  await gctx.close();

  // ---------- desktop pages ----------
  console.log('# desktop pages');
  const dctx = await browser.newContext(DESKTOP); const d = await dctx.newPage(); watch(d, 'desktop');
  await d.goto(BASE + '/signin'); await d.fill('#u', uname); await d.fill('#p', pw); await d.click('button[type=submit]'); await d.waitForSelector('.hero, .hero-take');
  await shot(d, 'desktop-01-home', true);
  await d.goto(BASE + '/games'); await d.waitForSelector('.gcard'); await shot(d, 'desktop-02-games', true);
  await d.goto(BASE + '/games/jetpack-dash'); await d.waitForSelector('.gd-hero'); await shot(d, 'desktop-03-game-detail');
  await d.goto(BASE + '/leaderboard'); await d.waitForSelector('.lb'); await shot(d, 'desktop-04-leaderboard');
  await d.goto(BASE + '/giveaways'); await d.waitForSelector('.gw'); await shot(d, 'desktop-05-giveaways', true);
  await d.goto(BASE + '/u/' + uname); await d.waitForSelector('.prof-head'); await shot(d, 'desktop-06-profile', true);
  await d.goto(BASE + '/host'); await d.waitForSelector('.pk'); await shot(d, 'desktop-07-host', true);
  await d.goto(BASE + '/achievements'); await d.waitForSelector('.ach'); await shot(d, 'desktop-07b-achievements');
  await d.goto(BASE + '/book?package=elite'); await d.waitForSelector('[data-b=brand]'); await shot(d, 'desktop-08-booking');
  await d.goto(BASE + '/play/jetpack-dash'); await d.waitForSelector('#game'); await sleep(900);
  await d.keyboard.down('Space'); await sleep(700); await d.keyboard.up('Space'); await sleep(500); await d.keyboard.down('Space'); await sleep(300); await shot(d, 'desktop-09-gameplay'); await d.keyboard.up('Space');

  // ---------- admin ----------
  console.log('# admin');
  const a = await dctx.newPage(); watch(a, 'admin');
  await a.goto(BASE + '/admin'); await a.waitForSelector('#pw');
  await a.fill('#pw', 'wrong'); await a.click('#lf button'); await a.waitForSelector('.err'); ok(true, 'admin wrong password rejected');
  await shot(a, 'desktop-10-admin-login');
  await a.fill('#pw', env.ADMIN_PASSWORD); await a.click('#lf button'); await a.waitForSelector('.stats');
  ok((await a.textContent('.amain')).includes('Total Players'), 'admin dashboard loads'); await shot(a, 'desktop-11-admin-dashboard', true);
  ok((await a.textContent('.amain')).includes('8/8 games live'), 'dashboard: 8/8 games live');
  console.log('# admin: one-click giveaway linking');
  await a.click('.side >> text=Games'); await a.waitForSelector('.agame');
  ok((await a.locator('.agame').count()) === 8, 'admin games page shows 8 game cards');
  await a.click('[data-create=plinko]'); await a.waitForSelector('#gpk');
  ok((await a.inputValue('#title')) === 'Plinko Giveaway' && (await a.locator('#gpk .gp.on').count()) === 1 && (await a.getAttribute('#gpk .gp.on', 'data-g')) === 'plinko', 'Create-giveaway-for-game prefills title + game');
  await a.click('#gpk .gp[data-g=memory-match]'); await a.click('#gpk .gp[data-g=high-score]');
  ok((await a.locator('#gpk .gp.on').count()) === 3, 'visual game picker multi-select (3 games)');
  await a.fill('#title', 'UI Test Plinko Giveaway'); await a.fill('#host', 'UI Brand'); await a.selectOption('#tier', 'premium'); await a.check('#usecolor'); await a.fill('#minscore', '0');
  await shot(a, 'desktop-11b-admin-giveaway-picker');
  await a.click('#gf button[type=submit]'); await a.waitForSelector('#draw'); const linkGid = a.url().split('/').pop();
  ok((await a.textContent('.amain')).includes('Live campaign stats'), 'manage page shows live campaign stats');
  const linkedNow = await a.evaluate(async (id) => (await (await fetch('/api/admin/giveaways/' + id)).json()).giveaway.game_ids, linkGid);
  ok(linkedNow.join() === 'plinko,memory-match,high-score', 'saved giveaway counts the 3 picked games', linkedNow);
  await a.click('.side >> text=Games'); await a.waitForSelector('.agame');
  ok(await a.isChecked(`.agame[data-game=plinko] [data-link="${linkGid}"]`), 'plinko card shows the new giveaway linked (toggle on)');
  await a.click(`.agame[data-game=drift-rush] .glink[data-gw="${linkGid}"] .toggle span`); await a.waitForFunction((id) => document.querySelector(`.agame[data-game=drift-rush] [data-link="${id}"]`)?.checked, linkGid);
  const after = await a.evaluate(async (id) => (await (await fetch('/api/admin/giveaways/' + id)).json()).giveaway.game_ids, linkGid);
  ok(after.includes('drift-rush'), 'toggle on Drift Rush card links it to the giveaway', after);
  await a.click(`.agame[data-game=high-score] .glink[data-gw="${linkGid}"] .toggle span`); await a.waitForFunction((id) => !document.querySelector(`.agame[data-game=high-score] [data-link="${id}"]`)?.checked, linkGid);
  ok(!(await a.evaluate(async (id) => (await (await fetch('/api/admin/giveaways/' + id)).json()).giveaway.game_ids, linkGid)).includes('high-score'), 'toggle off unlinks High Score');
  await shot(a, 'desktop-11c-admin-games-linking', true);
  // create giveaway
  await a.click('.side >> text=Giveaways'); await a.waitForSelector('.tbl'); await a.click('text=New Giveaway');
  await a.waitForSelector('#gf');
  await a.fill('#title', 'UI Test Giveaway'); await a.fill('#host', 'Trap Tech Solutions'); await a.fill('#prize', 'Test prize');
  const toLocal = (ms) => { const x = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
  await a.fill('#start', toLocal(Date.now() - 30 * 864e5)); await a.fill('#end', toLocal(Date.now() + 2 * 864e5));
  await a.click('#imgs button >> nth=1'); await a.click('#gf button[type=submit]');
  await a.waitForSelector('#draw'); ok(true, 'admin creates giveaway -> manage page');
  // edit
  await a.fill('#title', 'UI Test Giveaway (edited)'); await a.click('#gf button[type=submit]'); await sleep(900);
  ok((await a.inputValue('#title')).includes('edited'), 'admin edits giveaway');
  // player ran before this giveaway started? our run started ~minutes ago and window started 1h ago -> entrant
  await a.fill('#viewn', '200'); await sleep(200); ok((await a.textContent('#ent')).includes(uname), 'test player is an entrant (played during window)'); await a.fill('#viewn', '10');
  await a.click('#draw'); await a.waitForSelector('.winner-box .nm'); ok(true, 'draw random winner shows a winner');
  await shot(a, 'desktop-12-admin-manage-giveaway', true);
  await a.fill('#topn', '2'); await a.click('#top'); await a.waitForFunction(() => document.querySelectorAll('.winner-box').length >= 3, null, { timeout: 8000 }).catch(() => {}); ok((await a.locator('.winner-box').count()) >= 3, 'pick top N (2) adds winners');
  const csv = await a.evaluate(async (u) => (await fetch(u)).text(), (await a.getAttribute('a[href*="export/leaderboard.csv?giveaway"]', 'href')));
  ok(csv.startsWith('rank,username,score') && csv.includes(uname), 'giveaway CSV export downloads with entrants');
  const gidUrl = a.url();
  // bookings
  await a.click('.side >> text=Bookings'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Bookings');
  ok((await a.textContent('.tbl')).includes(brand), 'booking from the public form shows in admin');
  ok((await a.locator('tr', { hasText: brand }).locator('[data-snap]').textContent()).includes('Elite - $399'), 'admin booking shows chosen tier + price');
  const row = a.locator('tr', { hasText: brand }); await row.locator('[data-st]').selectOption('approved'); await row.locator('[data-save]').click(); await sleep(600);
  await a.reload(); await a.waitForSelector('.tbl'); ok((await a.locator('tr', { hasText: brand }).locator('[data-st]').inputValue()) === 'approved', 'admin updates booking status');
  await shot(a, 'desktop-13-admin-bookings');
  // players
  await a.click('.side >> text=Players'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Players'); ok((await a.textContent('.tbl')).includes(uname), 'admin players list shows new player');
  await shot(a, 'desktop-14-admin-players');
  await a.click('.side >> text=Leaderboards'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Leaderboards'); await a.selectOption('#p', 'weekly'); await sleep(600); ok((await a.textContent('.tbl')).includes(uname), 'admin weekly leaderboard');
  await a.click('.side >> text=Reports'); await a.waitForSelector('.stat'); await shot(a, 'desktop-15-admin-reports');
  const runsCsv = await a.evaluate(async () => (await fetch('/api/admin/export/runs.csv')).text()); ok(runsCsv.includes(uname), 'runs CSV export');
  await a.click('.side >> text=Announcements'); await a.fill('#at', 'UI test announcement'); await a.fill('#ab', 'hello'); await a.click('#af button'); await sleep(700);
  ok((await a.textContent('.amain')).includes('UI test announcement'), 'admin posts announcement');
  // admin mobile layout
  const am = await mctx.newPage(); watch(am, 'admin-mobile'); await am.goto(BASE + '/admin'); await am.fill('#pw', env.ADMIN_PASSWORD); await am.click('#lf button'); await am.waitForSelector('.stats'); await shot(am, 'mobile-16-admin-dashboard');
  await am.goto(gidUrl); await am.waitForSelector('#gf'); await shot(am, 'mobile-17-admin-manage-giveaway');
  await am.goto(BASE + '/admin/games'); await am.waitForSelector('.agame'); await am.evaluate(() => document.querySelector('.agame[data-game=drift-rush]').scrollIntoView()); await v2(am, 'admin-game-giveaway-linking');
  await am.evaluate(() => document.querySelector('.agame[data-game=plinko]').scrollIntoView()); await v2(am, 'admin-game-giveaway-linking-2');
  await am.goto(BASE + '/admin/giveaways/new?game=terp-tapper'); await am.waitForSelector('#gpk'); await am.click('#gpk .gp[data-g=spin-to-win]'); await am.evaluate(() => document.getElementById('gpk').scrollIntoView({ block: 'center' })); await v2(am, 'admin-giveaway-game-picker');
  await am.goto(BASE + '/admin/settings'); await am.waitForSelector('#pkg-editor'); await v2(am, 'admin-package-editor');

  // ---------- cleanup of UI test data (keeps demo data) ----------
  if (!process.env.KEEP) {
    console.log('# cleanup');
    const res = await a.evaluate(async (uname) => {
      const j = (u, o) => fetch(u, o).then(r => r.json());
      const out = [];
      const gs = await j('/api/admin/giveaways'); for (const g of gs.giveaways.filter(g => g.title.startsWith('UI Test'))) { await fetch('/api/admin/giveaways/' + g.id, { method: 'DELETE' }); out.push('giveaway ' + g.id); }
      const bs = await j('/api/admin/bookings'); for (const b of bs.bookings.filter(b => b.brand.startsWith('UI Test Brand'))) { await fetch('/api/admin/bookings/' + b.id, { method: 'DELETE' }); out.push('booking ' + b.id); }
      const an = await j('/api/admin/announcements'); for (const x of an.announcements.filter(x => x.title === 'UI test announcement')) { await fetch('/api/admin/announcements/' + x.id, { method: 'DELETE' }); out.push('announcement'); }
      const ps = await j('/api/admin/players?q=ui_'); for (const p of ps.players.filter(p => p.username.startsWith('ui_'))) { await fetch('/api/admin/players/' + p.id, { method: 'DELETE' }); out.push('player ' + p.username); }
      return out;
    }, uname);
    console.log('  removed', res.join(', '));
  }
  await browser.close();
  console.log('\nJS errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

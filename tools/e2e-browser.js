// Headless browser end-to-end test + screenshots.
// Usage: BASE=http://localhost:8787 node tools/e2e-browser.js
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = path.join(__dirname, '..', 'screenshots');
fs.mkdirSync(SHOTS, { recursive: true });
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
async function shot(page, name, full = false) { await sleep(350); await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: full }); console.log('   shot', name); }

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
  await m.waitForSelector('.hero'); ok(true, 'sign in -> home');
  await m.waitForFunction(() => document.querySelector('.cd b') && !document.querySelector('.cd b').textContent.includes('-'));
  const cd1 = await m.textContent('.cd'); await sleep(2200); const cd2 = await m.textContent('.cd');
  ok(cd1 !== cd2 && !cd2.includes('--'), 'home live-giveaway countdown ticks', cd1 + ' / ' + cd2);
  await shot(m, 'mobile-04-home'); await shot(m, 'mobile-04-home-full', true);

  console.log('# games library');
  await m.click('.bottomnav >> text=Games'); await m.waitForSelector('#grid .gcard');
  const nAll = await m.locator('#grid .gcard').count(); await m.fill('#q', 'plin'); const nQ = await m.locator('#grid .gcard').count();
  ok(nAll >= 5 && nQ === 1, `games search filters (${nAll} -> ${nQ})`); await m.fill('#q', '');
  await m.click('#chips >> text=Racing'); ok((await m.locator('#grid .gcard').count()) === 1, 'category chip filters');
  await m.click('#chips >> text=All'); await shot(m, 'mobile-05-games');
  await m.click('#grid .gcard >> nth=1'); await m.waitForSelector('text=COMING SOON'); ok(true, 'coming-soon game shows placeholder');

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

  console.log('# host / booking');
  await m.goto(BASE + '/host'); await m.waitForSelector('.pkg'); await shot(m, 'mobile-13-host');
  await m.click('#ht >> text=Custom Event'); ok(await m.isVisible('text=Request a Custom Event'), 'custom event tab');
  await m.click('#ht >> text=Hosting Packages'); await m.click('.pkg >> nth=1 >> text=Select'); await m.waitForSelector('[data-b=brand]');
  ok((await m.inputValue('[data-b=package]')) === 'premium', 'package preselected from Host page');
  await m.click('#next'); ok(await m.isVisible('.err'), 'booking step 1 validates brand');
  await m.fill('[data-b=brand]', brand); await m.selectOption('[data-b=event_type]', 'Giveaway'); await m.fill('[data-b=contact]', 'uitest@example.com');
  await m.evaluate(() => { const e = document.querySelector('.err'); if (e) e.remove(); }); await shot(m, 'mobile-14-booking');
  await m.click('#next'); await m.fill('[data-b=start_date]', '2026-11-01'); await m.fill('[data-b=end_date]', '2026-11-15'); await m.fill('[data-b=details]', 'Headless browser test booking');
  await m.click('#next'); ok((await m.textContent('main')).includes(brand), 'review step shows summary');
  await m.click('#next'); await m.waitForSelector('text=Request Sent!'); ok(true, 'booking submitted');

  console.log('# community');
  await m.click('.bottomnav >> text=Community'); await m.waitForSelector('.post'); await shot(m, 'mobile-15-community');

  // ---------- guest flow ----------
  console.log('# guest');
  const gctx = await browser.newContext(MOBILE); const g = await gctx.newPage(); watch(g, 'guest');
  await g.goto(BASE + '/signin'); await g.click('#guest'); await g.waitForSelector('.hero'); ok(true, 'Continue as Guest -> home');
  await g.goto(BASE + '/games/jetpack-dash'); ok((await g.textContent('main')).includes('Playing as guest'), 'guest sees practice-mode note');
  await g.goto(BASE + '/play/jetpack-dash'); await g.waitForSelector('#game'); ok((await g.textContent('.who-chip')).includes('Guest'), 'guest can play practice run');
  await g.goto(BASE + '/giveaways'); await g.waitForSelector('.gw'); await g.click('.gw .btn >> nth=0'); await g.waitForURL(/giveaways\/\d+/); await g.waitForSelector('.back-row');
  ok(await g.isVisible('text=Sign in to Enter'), 'guest is asked to sign in to enter giveaway');
  await gctx.close();

  // ---------- desktop pages ----------
  console.log('# desktop pages');
  const dctx = await browser.newContext(DESKTOP); const d = await dctx.newPage(); watch(d, 'desktop');
  await d.goto(BASE + '/signin'); await d.fill('#u', uname); await d.fill('#p', pw); await d.click('button[type=submit]'); await d.waitForSelector('.hero');
  await shot(d, 'desktop-01-home', true);
  await d.goto(BASE + '/games'); await d.waitForSelector('.gcard'); await shot(d, 'desktop-02-games', true);
  await d.goto(BASE + '/games/jetpack-dash'); await d.waitForSelector('.gd-hero'); await shot(d, 'desktop-03-game-detail');
  await d.goto(BASE + '/leaderboard'); await d.waitForSelector('.lb'); await shot(d, 'desktop-04-leaderboard');
  await d.goto(BASE + '/giveaways'); await d.waitForSelector('.gw'); await shot(d, 'desktop-05-giveaways', true);
  await d.goto(BASE + '/u/' + uname); await d.waitForSelector('.prof-head'); await shot(d, 'desktop-06-profile', true);
  await d.goto(BASE + '/host'); await d.waitForSelector('.pkg'); await shot(d, 'desktop-07-host', true);
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

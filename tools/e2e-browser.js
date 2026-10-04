// Headless browser end-to-end test + screenshots.
// Usage: BASE=http://localhost:8787 node tools/e2e-browser.js
const { chromium } = require('playwright-core');
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787';
const AP = '/' + require('./admin-auth').loadEnv().ADMIN_PATH; // v7 secret admin path
const SHOTS = path.join(__dirname, '..', 'screenshots');
const V2 = path.join(SHOTS, 'v2'); const V3 = path.join(SHOTS, 'v3');
fs.mkdirSync(V2, { recursive: true }); fs.mkdirSync(V3, { recursive: true });
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
const v3 = (page, name, full = false, keepAch = false) => shot(page, 'v3/' + name, full, keepAch);
const v5 = (page, name, full = false, keepAch = false) => shot(page, 'v5/' + name, full, keepAch);
const passGate = (ctx) => ctx.addInitScript(() => { try { if (!localStorage.getItem('gh_age_ok')) localStorage.setItem('gh_age_ok', String(Date.now())); } catch {} });
const noShare = (ctx) => ctx.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true }); } catch {} });
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
  console.log('# v3: 21+ age gate');
  const uctx = await browser.newContext(MOBILE); const u = await uctx.newPage(); watch(u, 'underage');
  await u.goto(BASE + '/'); await u.waitForSelector('#gate');
  await u.fill('#gate-m', '06'); await u.fill('#gate-d', '15'); await u.fill('#gate-y', String(new Date().getFullYear() - 18)); await u.click('#gate button[type=submit]');
  await u.waitForSelector('#gate-h'); ok((await u.textContent('#gate-h')) === 'Sorry' && (await u.textContent('.gate')).includes('21'), 'under-21 date of birth is blocked');
  await v3(u, 'm01b-age-gate-blocked');
  await u.goto(BASE + '/giveaways'); await u.waitForSelector('.gate'); ok((await u.textContent('#gate-h')) === 'Sorry', 'block persists for the session');
  await u.goto(BASE + '/rules'); await u.waitForSelector('.prose'); ok((await u.textContent('.prose')).includes('NO PURCHASE NECESSARY'), 'legal pages stay readable without passing the gate');
  await uctx.close();
  const mctx = await browser.newContext(MOBILE); await noShare(mctx); await mctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const m = await mctx.newPage(); watch(m, 'mobile');
  await m.goto(BASE + '/'); await m.waitForSelector('#gate');
  ok(await m.isVisible('#gate') && (await m.textContent('.gate')).includes('date of birth'), 'first visit shows the neutral 21+ date-of-birth gate');
  ok((await m.textContent('.gate-tt')).includes('Built by'), 'age gate carries "Built by Trap Tech Solutions"');
  await v3(m, 'm01-age-gate');
  await m.click('#gate button[type=submit]'); await m.waitForSelector('#gmsg .err'); ok(true, 'age gate requires a valid date');
  await m.fill('#gate-m', '05'); await m.fill('#gate-d', '05'); await m.fill('#gate-y', '1990'); await m.click('#gate button[type=submit]');
  ok(!!(await m.$('link[rel=manifest]')) && (await m.title()).includes('Trap Tech'), 'manifest link + Trap Tech in page title');
  console.log('# splash / sign up');
  await m.waitForSelector('.splash');
  ok(await m.isVisible('.splash .logo-stack'), 'first visit shows splash'); await shot(m, 'mobile-01-splash');
  ok((await m.textContent('.splash .tt-sig')).includes('Built by') && await m.isVisible('.splash .tt-sig img'), 'splash shows "Built by" + Trap Tech logo'); await v3(m, 'm02-splash');
  await m.click('text=Get Started'); await m.waitForSelector('#f');
  ok(m.url().endsWith('/signup'), 'Get Started -> sign up');
  await m.fill('#u', 'bad name'); await m.fill('#p', pw); await m.fill('#p2', pw); await m.check('#agree'); await m.click('button[type=submit]');
  ok(await m.isVisible('.err'), 'sign up validates username (no spaces)');
  await m.fill('#u', uname); await m.fill('#p2', 'mismatch1'); await m.click('button[type=submit]');
  ok((await m.textContent('.err')).includes('match'), 'sign up validates password confirmation');
  ok((await m.inputValue('#dob-y')) === '1990' && (await m.inputValue('#dob-m')) === '05', 'signup date of birth is prefilled from the age gate');
  ok((await m.textContent('.tt-sig')).includes('Powered by Trap Tech'), 'auth screen shows "Powered by Trap Tech"');
  await m.fill('#p2', pw); await m.fill('#dob-y', String(new Date().getFullYear() - 19)); await m.click('button[type=submit]'); await m.waitForSelector('.err');
  ok(/21/.test(await m.textContent('.err')), 'signup rejects an under-21 date of birth', await m.textContent('.err'));
  await m.fill('#dob-y', '1990'); await m.evaluate(() => document.querySelector('#msg').innerHTML = ''); await shot(m, 'mobile-03-signup'); await v3(m, 'm03-signup', true);
  await m.click('button[type=submit]'); await m.waitForURL(/\/games\/jetpack-dash/);
  ok(true, 'sign up succeeds and lands on Jetpack Dash');
  await m.waitForSelector('.gd-hero'); await shot(m, 'mobile-06-game-detail');

  console.log('# sign out / sign in');
  await m.click('.topbar .menu-btn'); await m.waitForSelector('.drawer .dr-tt');
  ok((await m.textContent('.drawer')).includes('Quests') && (await m.textContent('.drawer .dr-tt')).includes('Built by') && (await m.locator('.drawer .dr-legal a').count()) >= 3, 'drawer: progress links, legal links + Trap Tech credit');
  await v3(m, 'm32-drawer');
  await m.click('.drawer [data-act=signout]'); await m.waitForURL(/\/signin/);
  ok(true, 'sign out from menu');
  ok((await m.inputValue('#u')) === uname, 'username remembered on sign-in form (localStorage)');
  await m.fill('#p', 'wrongpass1'); await m.click('button[type=submit]'); await m.waitForSelector('.err');
  ok((await m.textContent('.err')).includes('Wrong'), 'wrong password shows error');
  await m.fill('#p', ''); await m.evaluate(() => document.querySelector('#msg').innerHTML = ''); await shot(m, 'mobile-02-signin'); await v3(m, 'm04-signin');
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
  ok((await m.locator('main .gcard').count()) === 12 && (await m.locator('main .gcard .soon').count()) === 0, 'all 12 games listed, none "coming soon"');
  await v2(m, 'games-library-full', true);
  await m.click('#grid .gcard[data-game=drift-rush]'); await m.waitForSelector('.gd-hero');
  const dtxt = await m.textContent('main'); ok(dtxt.includes('Play Now') && dtxt.includes('Scoring') && !dtxt.includes('COMING SOON'), 'Drift Rush detail page is playable with how-to + scoring');

  console.log('# play Jetpack Dash');
  await m.goto(BASE + '/play/jetpack-dash'); await m.waitForSelector('#boot');
  ok((await m.textContent('#boot')).includes('A Trap Tech game'), 'game loading screen says "A Trap Tech game"');
  await m.screenshot({ path: path.join(V3, 'm09-game-boot.png') }); console.log('   shot v3/m09-game-boot');
  await m.waitForSelector('#game'); await m.waitForSelector('#boot', { state: 'detached' }); await sleep(600);
  ok((await m.title()).startsWith('Play Jetpack Dash'), 'game page title set');
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
  ok(/Counted for/.test(saved) || /Enter .+ to have your runs count/.test(saved), 'run result: counted toward the active giveaway, or (v5) tells me to Enter the giveaway first', saved);
  const scoreTxt = await m.textContent('.over-card .big'); const myScore = parseInt(scoreTxt.replace(/\D/g, ''), 10);
  await shot(m, 'mobile-08-game-over');
  ok(await m.isVisible('.xp-line') && /XP/.test(await m.textContent('.xp-line')), 'result shows XP gained + level bar');
  ok(await m.isVisible('#share-run') && await m.isVisible('.share-row a[href^="/s/"]'), 'result offers Share score + Score card');
  await v3(m, 'm10-game-over-share');
  await m.click('#share-run'); await m.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => /copied/i.test(t.textContent)), null, { timeout: 5000 }).catch(() => {});
  const sh1 = await m.evaluate(async () => (await (await fetch('/api/achievements')).json()).achievements.find(a => a.id === 'share-1').unlocked);
  ok(sh1, 'sharing the score logs a share (unlocks Hype Sharer)');
  const jetRun = await m.evaluate(() => window.__lastResult && window.__lastResult.run_id);
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
  // v5 anti-camping: entry is explicit (Enter button) and gated by the eligibility rules shown on the page
  await m.waitForSelector('#elig-status', { timeout: 10000 }); await v5(m, 'giveaway-eligibility-card', true);
  if (await m.$('#join-gw')) { await m.click('#join-gw'); await m.waitForSelector('#elig-status.joined', { timeout: 10000 }); }
  const eligCls = await m.getAttribute('#elig-status', 'class'); const nChecks = await m.locator('.elig-checks li').count();
  ok(nChecks >= 3 && (/joined/.test(eligCls) || ((await m.locator('.elig-checks li.no').count()) >= 1 && !(await m.$('#join-gw')))), `giveaway detail: eligibility checklist (${nChecks} rules) and explicit entry - ${/joined/.test(eligCls) ? 'entered' : 'not yet eligible, Enter hidden'}`);
  ok((await m.textContent('main')).includes("You're entered") || /joined/.test(eligCls) || (await m.textContent('#elig-status')).length > 5, 'giveaway detail shows my entry status');
  await shot(m, 'mobile-11-giveaway-detail', true); await v3(m, 'm13-giveaway-detail', true);
  ok(await m.isVisible('#share-gw') && (await m.textContent('main')).includes('No purchase necessary'), 'giveaway detail: share link + no-purchase note');
  await m.click('.gw-actions a[href$="/rules"]'); await m.waitForSelector('.prose .npn');
  const rulesTxt = await m.textContent('.prose'); ok(rulesTxt.includes('NO PURCHASE NECESSARY') && rulesTxt.includes('Trap Tech Solutions') && /21 or older/.test(rulesTxt) && /Sponsor/.test(rulesTxt), 'per-giveaway official rules: NPN, 21+, sponsor + Trap Tech as operator');
  await v3(m, 'm14-giveaway-rules');

  console.log('# profile');
  await m.goto(BASE + '/profile'); await m.waitForSelector('.prof-head');
  const st = await m.locator('.stat3 b').allTextContents(); ok(st[1] === '1' && +st[0].replace(/\D/g, '') === myScore, 'profile shows total score = my run and games played = 1', st);
  ok((await m.textContent('.card .act-row')).includes('Jetpack Dash'), 'profile recent activity shows the run');
  await shot(m, 'mobile-12-profile');
  ok(await m.isVisible('.prof-actions .fcount') && await m.isVisible('.pchips') && await m.isVisible('.prof-head .xpbar'), 'profile: level bar, rank/streak chips, follower counts');
  await v3(m, 'm15-profile');

  console.log('# new games: play each briefly, end run & save');
  const NEW = ['drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper', 'stack-2048', 'munchies-snake', 'brick-breaker', 'sky-hopper'];
  const PLAY = {
    'drift-rush': async (p, box) => { for (let i = 0; i < 6; i++) { const left = i % 2 === 0; await p.mouse.move(box.x + box.width * (left ? 0.2 : 0.8), box.y + box.height * 0.7); await p.mouse.down(); await sleep(left ? 700 : 900); await p.mouse.up(); await sleep(200); } },
    plinko: async (p) => { for (let i = 0; i < 3; i++) { const g = await p.evaluate(() => ({ x: window.__game.g.bx + window.__game.g.bw * (0.15 + Math.random() * 0.7), y: window.__game.g.top + 20 })); await tapL(p, g.x, g.y, 120); await sleep(900); const c = await p.evaluate(() => window.__game.chip && { x: window.__game.chip.x, y: window.__game.chip.y }); if (c) await tapL(p, c.x + 40, c.y); await sleep(2600); } },
    'spin-to-win': async (p, box) => { for (let i = 0; i < 2; i++) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await sleep(500 + i * 350); await p.mouse.up(); await sleep(i === 0 ? 1500 : 5200); } },
    'memory-match': async (p) => { await sleep(1800); for (let n = 0; n < 4; n++) { const pair = await p.evaluate(() => { const g = window.__game; const left = g.cards.filter(c => !c.done && !c.open); const a = left[0]; const b = left.find(c => c !== a && c.g === a.g); const R = (c) => { const [x, y, w, h] = g.rect(c.k); return [x + w / 2, y + h / 2]; }; return a && b ? [R(a), R(b)] : null; }); if (!pair) break; await tapL(p, ...pair[0]); await sleep(150); await tapL(p, ...pair[1]); await sleep(450); } },
    'high-score': async (p) => { const until = Date.now() + 5000; while (Date.now() < until) { const t = await p.evaluate(() => (window.__game.targets || []).filter(t => t.type !== 'bomb').map(t => [t.x, t.y])[0]); if (t) await tapL(p, t[0], t[1], 30); await sleep(120); } },
    'blazed-roulette': async (p) => { for (let i = 0; i < 2; i++) { for (const id of ['red', 'd2']) { const b = await p.evaluate((id) => { const b = window.__game.btns.find(x => x.id === id); return [b.x + b.w / 2, b.y + b.h / 2]; }, id); await tapL(p, ...b); await sleep(150); } const d = await p.evaluate(() => { const b = window.__game.btns.find(x => x.id === 'drop'); return [b.x + b.w / 2, b.y + b.h / 2]; }); await tapL(p, ...d); await sleep(i === 0 ? 4300 : 1200); } },
    'stack-2048': async (p) => { for (let i = 0; i < 24; i++) { await p.keyboard.press(['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'][i % 4]); await sleep(110); } },
    'munchies-snake': async (p) => { await p.evaluate(() => { const g = window.__game; const K = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']; const loop = () => { if (g.state !== 'play') return; const [hx, hy] = g.body[0]; const [fx, fy] = g.food; const cur = g.q.length ? g.q[g.q.length - 1] : g.dir; let want = fx > hx ? 0 : fx < hx ? 2 : fy > hy ? 1 : 3; if ((want + 2) % 4 === cur) want = (want + 1) % 4; if (want !== cur && !g.q.length) window.dispatchEvent(new KeyboardEvent('keydown', { code: K[want] })); window.__sn = requestAnimationFrame(loop); }; loop(); }); await sleep(5000); await p.evaluate(() => cancelAnimationFrame(window.__sn)); },
    'brick-breaker': async (p) => { await p.evaluate(() => { const g = window.__game; g.launch(); const loop = () => { if (g.state !== 'play') return; g.px = Math.max(g.pw / 2, Math.min(g.W - g.pw / 2, g.ball.x + 18)); if (g.ball.stuck) g.launch(); window.__bb = requestAnimationFrame(loop); }; loop(); }); await sleep(6000); await p.evaluate(() => cancelAnimationFrame(window.__bb)); },
    'sky-hopper': async (p) => { await p.evaluate(() => { const g = window.__game; const loop = () => { if (g.state !== 'play') return; const nx = g.pipes.find(q => q.x - g.x + 74 > g.hx - 18); const target = nx ? nx.top + nx.g * 0.55 : g.H * 0.5; if (g.y > target && g.vy > -60) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.__sh = requestAnimationFrame(loop); }; loop(); }); await sleep(7000); await p.evaluate(() => cancelAnimationFrame(window.__sh)); },
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
    if (['drift-rush', 'blazed-roulette', 'high-score', 'stack-2048', 'munchies-snake', 'brick-breaker', 'sky-hopper'].includes(id)) ok(res && res.score > 0, `${id}: real inputs produced a score > 0 (${res && res.score})`);
  }
  ok(lastUnlocked.some(a => a.id === 'variety-all'), 'playing all 12 games unlocks "variety-all" (server-side)', lastUnlocked.map(a => a.id));
  ok((await m.isVisible('.ach-toast')) || (await m.locator('#sv .unl').count()) >= 1, 'unlock shown after the last run (toast, or listed in the run result if the toast already faded)');
  await shot(m, 'mobile-08c-unlock-toast', false, true);
  const lbAll = await m.evaluate(async (u) => { const out = {}; for (const g of ['drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper', 'stack-2048', 'munchies-snake', 'brick-breaker', 'sky-hopper']) { const r = await (await fetch('/api/leaderboard?game=' + g + '&limit=500')).json(); out[g] = r.rows.some(x => x.username === u); } return out; }, uname);
  ok(Object.values(lbAll).every(Boolean), 'my scores are on every new game leaderboard', lbAll);

  console.log('# achievements page');
  await m.goto(BASE + '/achievements'); await m.waitForSelector('.ach');
  const nAch = await m.locator('.ach').count(); const nOn = await m.locator('.ach.on').count();
  ok(nAch >= 100 && nAch <= 140 && nOn >= 4, `achievements page: ${nAch} achievements, ${nOn} unlocked`);
  ok((await m.textContent('main')).includes('Achievement system by Trap Tech') && (await m.locator('.ach-links a[href="/season"]').count()) === 1, 'achievements page: Trap Tech credit + season/quests links');
  ok((await m.locator('#cats button, #cats .chip').allTextContents()).join('|').includes('Streaks'), 'new achievement categories (streaks & seasons, friends & referrals)');
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

  console.log('# v5: brand channels, Hub Points shop, friends & challenges (no messaging), special badges');
  await m.goto(BASE + '/games'); await m.waitForSelector('.gcard'); await v5(m, 'games-grid-new-thumbnails', true);
  ok((await m.evaluate(() => [...document.querySelectorAll('main .gcard img, main .gcard [style*="background"]')].some(e => /cards\/v5\//.test(e.getAttribute('src') || e.getAttribute('style') || '')))), 'game cards use the new v5 thumbnails');
  { const code = await m.evaluate(async () => { const r = await (await fetch('/api/brands')).json(); return r.brands[0] && r.brands[0].slug; });
    await m.goto(BASE + '/settings#v7-brand'); await m.waitForSelector('#v7-brand #br-pick'); await v5(m, 'settings-your-brand');
    ok((await m.textContent('#v7-brand')).includes('not in a brand') || (await m.$('#v7-brand .br-mine')), 'Settings: Your brand card');
    await m.selectOption('#br-pick', code); m.once('dialog', d => d.accept()); await m.click('#br-f button'); await m.waitForSelector('#v7-brand .br-mine');
    ok(true, 'player joins a brand from Settings (one brand at a time)'); }
  { const r = await m.evaluate(async () => (await fetch('/api/me/brand')).json()); const inv = r.brand.slug; // the brand slug works as a code too
    await m.goto(BASE + '/join/' + inv); await m.waitForSelector('.br-card'); ok((await m.textContent('.br-card')).includes("You're in"), 'brand invite page recognises a member'); await v5(m, 'brand-invite'); }
  { const r = await m.evaluate(async () => (await fetch('/channels')).status); ok(r === 200, '/channels now redirects inside the app (no channel pages)'); }
  await m.goto(BASE + '/shop'); await m.waitForSelector('.shop-item');
  ok((await m.locator('#shop-daily .shop-item').count()) >= 4 && (await m.locator('#shop-weekly .shop-item').count()) >= 2 && (await m.textContent('main')).match(/cosmetic/i), 'Hub Points shop: daily + weekly rotation, cosmetic-only note');
  ok(+(await m.textContent('#pts-bal')).replace(/\D/g, '') > 0, `points balance earned from play (${(await m.textContent('#pts-bal')).trim()})`);
  ok(!/\b(dealer|plug|trap house|re-up|sell weed)\b/i.test(await m.textContent('main')), 'shop copy has no dealing-glorifying terms');
  await v5(m, 'shop', true);
  await m.goto(BASE + '/friends'); await m.waitForSelector('#ft'); ok((await m.textContent('main')).includes('There is no chat or messaging'), 'friends page: no chat/messaging, play-together only');
  await v5(m, 'friends'); await m.click('#ft [data-k=challenges]'); await m.waitForSelector('#chf'); ok((await m.locator('#ch-game option').count()) === 12, 'challenge form lists all 12 games'); await v5(m, 'friend-challenges');
  ok((await m.evaluate(async () => (await fetch('/api/messages')).status)) === 404 && (await m.locator('a[href*="messages"], a[href*="/dm"], textarea[placeholder*="essage"]').count()) === 0, 'no messaging endpoint or UI anywhere');
  await m.goto(BASE + '/achievements'); await m.waitForSelector('.ach'); await m.waitForSelector('#special-section', { timeout: 8000 }).catch(() => {});
  ok((await m.locator('#special-section .special-b').count()) >= 8, 'achievements page: special (admin-only) badges section'); await m.evaluate(() => document.getElementById('special-section')?.scrollIntoView()); await v5(m, 'achievements-special-badges');
  ok((await m.textContent('main')).match(/Centurion|Iron Thumbs|One Percenter/), 'hard Legendary achievements listed');

  console.log('# v7: Sponsor a Host - feature picker, no tiers, no public prices, quote status page');
  await m.goto(BASE + '/host'); await m.waitForSelector('.sp-f'); ok(m.url().endsWith('/sponsor'), '/host redirects to /sponsor');
  ok(!/\$\d/.test(await m.textContent('main')) && !/\b(Basic|Premium|Elite)\b/.test(await m.textContent('main')), 'no prices and no tier names on the sponsor page');
  ok((await m.locator('.sp-f').count()) >= 20 && (await m.locator('.sp-g').count()) >= 5, `one combined feature list (${await m.locator('.sp-f').count()} features)`);
  ok((await m.textContent('.tt-build')).includes('Trap Tech Solutions'), 'sponsor page: built by Trap Tech');
  await v5(m, 'sponsor-features');
  await m.click('.sp-f[data-f=featured] .sp-chk'); await m.click('.sp-f[data-f=featured] [data-d="1"]'); await m.click('.sp-f[data-f=game-skin] .sp-chk');
  ok((await m.textContent('.sp-f[data-f=featured] .sp-qty b')).includes('2 weeks') && (await m.textContent('#next')).includes('4 picked'), 'quantity stepper + picked count');
  await m.click('#next'); await m.waitForSelector('#bt');
  ok(!(await m.$('#licensed')), 'no license question before a business type is chosen');
  await m.selectOption('#bt', 'Streamer / content creator'); await sleep(100); ok(!(await m.$('#licensed')), 'streamer: no license question');
  await m.selectOption('#bt', 'Cannabis products seller (dispensary/brand/delivery)'); await m.waitForSelector('#licensed');
  ok((await m.textContent('.check.lic')).includes('I confirm my business is licensed and legally permitted to operate and advertise in my jurisdiction'), 'cannabis seller: required licensed-business checkbox appears');
  await m.fill('#sb-brand', brand); await m.fill('#sb-email', ''); await m.fill('#sb-potato', '');
  await m.click('#next'); ok((await m.textContent('.err')).includes('licensed'), 'cannot continue without confirming the license');
  await m.check('#licensed'); await m.click('#next'); ok((await m.textContent('.err')).includes('Potato username or an email'), 'needs an email or Potato username');
  await m.fill('#sb-potato', '@uitest_brand'); await m.fill('#sb-s', '2026-11-01'); await m.fill('#sb-e', '2026-11-15'); await m.fill('#sb-d', 'Headless browser test request'); await m.fill('#sb-n', 'Budget flexible');
  await m.evaluate(() => { const e = document.querySelector('.err'); if (e) e.remove(); }); await v5(m, 'sponsor-details');
  await m.click('#next'); ok((await m.textContent('main')).includes(brand) && (await m.textContent('.rv')).includes('Home page Featured row (2 weeks)') && (await m.textContent('.rv')).includes('@uitest_brand'), 'review lists the picked features and Potato contact');
  await m.click('#next'); await m.waitForURL(/\/sponsor\/status\//); await m.waitForSelector('.sp-state');
  ok((await m.textContent('.sp-state')).includes('Request received') && !(await m.$('.sp-quote')) && (await m.textContent('.sp-asked')).includes('Branded game skin'), 'private status page: received, no price yet, features listed');
  const sponsorStatusUrl = m.url().split('?')[0]; await v5(m, 'sponsor-status-pending', true);

  console.log('# community');
  await m.click('.bottomnav >> text=Community'); await m.waitForSelector('.post'); await shot(m, 'mobile-15-community'); await v3(m, 'm19-community');
  ok((await m.locator('.tabs [role=tab]').allTextContents()).join('|').includes('Following'), 'community has a Following tab');

  console.log('# v3: home daily panel, streak, quests');
  await m.goto(BASE + '/'); await m.waitForSelector('#daily .quest');
  ok((await m.locator('#daily .quest').count()) === 3, 'home shows 3 daily quests');
  const stk = await m.evaluate(async () => (await (await fetch('/api/me')).json()).user.streak);
  ok(stk.current >= 1 && stk.checked_today, 'opening home checks in automatically (streak >= 1)', stk);
  await m.reload(); await m.waitForSelector('#daily'); ok(await m.isVisible('.streak-chip'), 'streak chip in the top bar');
  ok((await m.locator('.t-strip .t-card').count()) >= 1 && (await m.locator('.promo-grid .ach-promo').count()) === 3, 'home: tournaments strip + season/achievements/invite promos');
  ok((await m.textContent('.site-foot')).includes('Built by Trap Tech Solutions'), 'footer: Built by Trap Tech Solutions');
  await v3(m, 'm05-home'); await v3(m, 'm06-home-full', true);
  await m.goto(BASE + '/quests'); await m.waitForSelector('.streak-card');
  ok((await m.locator('.quests .quest').count()) === 4, 'quests page: 3 quests + bonus');
  const claimBtn = m.locator('[data-claim]').first();
  if (await claimBtn.count()) { await claimBtn.click(); await m.waitForSelector('.quest.claimed'); ok(true, 'claim a completed quest (+XP)'); } else ok(false, 'expected a claimable quest after 8 runs');
  await v3(m, 'm20-quests', true);

  console.log('# v3: season');
  await m.goto(BASE + '/season'); await m.waitForSelector('.track .tier');
  ok((await m.locator('.track .tier').count()) === 20 && (await m.locator('.track .tier.rw').count()) >= 4, 'season track: 20 tiers with cosmetic rewards');
  ok((await m.textContent('main')).includes('Free track only') && await m.isVisible('.sh-tier'), 'season: free track only + my tier');
  await v3(m, 'm21-season'); await v3(m, 'm21b-season-full', true);

  console.log('# v3: tournaments');
  const TL = await m.evaluate(async () => (await (await fetch('/api/tournaments')).json()).tournaments);
  const tBr = TL.find(t => t.format === 'bracket' && t.status !== 'upcoming'); const tTm = TL.find(t => t.format === 'timed' && t.status === 'live');
  await m.goto(BASE + '/tournaments'); await m.waitForSelector('.t-card');
  ok((await m.locator('.t-card').count()) >= 3 && (await m.textContent('main')).includes('Live now'), 'tournaments page lists live + upcoming events');
  await v3(m, 'm22-tournaments', true);
  if (tBr) {
    await m.goto(BASE + '/tournaments/' + tBr.id); await m.waitForSelector('.bracket .bk-m');
    ok((await m.locator('.bk-round').count()) >= 3 && (await m.textContent('.bracket')).includes('Quarterfinals'), 'bracket view renders all rounds');
    ok((await m.locator('.bk-p.win').count()) >= 3, 'bracket highlights quarterfinal winners');
    await v3(m, 'm23-tournament-bracket'); await v3(m, 'm23b-tournament-bracket-full', true);
  } else ok(false, 'demo bracket tournament exists');
  if (tTm) {
    await m.goto(BASE + '/tournaments/' + tTm.id); await m.waitForSelector('.t-hero .cd');
    ok(await m.isVisible('.t-hero a.btn[href^="/play/"]') && await m.isVisible('#share-t'), 'live timed tournament: countdown, Play + Share');
    await v3(m, 'm24-tournament-timed');
  }

  console.log('# v3: follow + friends leaderboard');
  await m.goto(BASE + '/u/TerpQueen'); await m.waitForSelector('#follow');
  const f0 = +(await m.textContent('#nfollowers')).replace(/\D/g, '');
  await m.click('#follow'); await m.waitForFunction(() => document.querySelector('#follow').getAttribute('aria-pressed') === 'true');
  ok(+(await m.textContent('#nfollowers')).replace(/\D/g, '') === f0 + 1 && (await m.textContent('#follow')).includes('Following'), 'follow button toggles + updates follower count');
  await m.click('.fcount[data-fl=followers]'); await m.waitForSelector('.sheet .mini-row');
  ok((await m.textContent('.sheet')).includes(uname), 'followers sheet lists me'); await v3(m, 'm15b-followers-sheet');
  await m.keyboard.press('Escape'); await m.waitForSelector('.sheet', { state: 'detached' });
  await m.goto(BASE + '/leaderboard?game=plinko'); await m.waitForSelector('.lb'); await m.check('#friends'); await sleep(900);
  const fnames = await m.locator('.lb .nm').allTextContents();
  ok(fnames.length >= 2 && fnames.every(n => n.includes(uname) || n.includes('TerpQueen')), 'friends leaderboard = me + players I follow', fnames);
  await v3(m, 'm11-leaderboard-friends'); await m.uncheck('#friends'); await sleep(500); await v3(m, 'm11b-leaderboard');

  console.log('# v3: notifications');
  const un = await m.evaluate(async () => (await (await fetch('/api/me')).json()).user.unread);
  ok(un >= 1, `unread notifications counted (${un})`);
  await m.goto(BASE + '/'); await m.waitForSelector('#daily'); await m.waitForFunction(() => !document.getElementById('bell-n').classList.contains('hidden'));
  ok(true, 'bell shows the unread badge');
  await m.click('.topbar a[href="/notifications"]'); await m.waitForSelector('.notif');
  ok((await m.locator('.notif.unread').count()) >= 1 && (await m.textContent('#nl')).includes('Achievement unlocked'), 'notifications center lists unread achievement notices');
  await v3(m, 'm25-notifications');
  await m.click('#readall'); await m.waitForFunction(() => !document.querySelector('.notif.unread'));
  ok(await m.isHidden('#bell-n'), 'mark all read clears the bell badge');

  console.log('# v3: search');
  await m.click('.topbar a[href="/search"]'); await m.waitForSelector('#sq'); await m.fill('#sq', 'plinko'); await m.waitForSelector('#sr .sr-row');
  const srt = await m.textContent('#sr'); ok(srt.includes('Plinko') && srt.includes('Tournaments'), 'search finds games + tournaments');
  await v3(m, 'm26-search');
  await m.fill('#sq', 'zzqqxx'); await m.waitForSelector('#sr .empty-state'); ok(true, 'search empty state');

  console.log('# v3: invite + share card');
  await m.goto(BASE + '/invite'); await m.waitForSelector('#refcode');
  const rcode = (await m.textContent('#refcode')).trim();
  ok(/^[A-Z0-9]{6}$/.test(rcode) && (await m.inputValue('#reflink')).endsWith('/r/' + rcode), 'invite page shows my code + link', rcode);
  await v3(m, 'm27-invite', true);
  await m.goto(BASE + '/s/' + jetRun); await m.waitForSelector('.share-card');
  ok((await m.textContent('.share-card')).includes(uname) && (await m.getAttribute('meta[property="og:image"]', 'content')).includes('/og/run/' + jetRun), 'score card page + per-run og:image');
  await v3(m, 'm28-share-card');

  console.log('# v3: legal, about, settings');
  for (const [pth, sel, txt] of [['/terms', '.prose', '21 years old'], ['/privacy', '.prose', 'date of birth'], ['/rules', '.prose', 'Trap Tech Solutions'], ['/responsible-play', '.prose', 'No real money'], ['/about', '.about-hero', 'Trap Tech Solutions'], ['/settings', '.about-mini', 'Built by Trap Tech Solutions']]) {
    await m.goto(BASE + pth); await m.waitForSelector(sel); ok((await m.textContent('main')).includes(txt), `${pth} renders ("${txt}")`);
  }
  await m.goto(BASE + '/about'); await m.waitForSelector('.about-hero'); await v3(m, 'm29-about', true);
  await m.goto(BASE + '/settings'); await m.waitForSelector('.set-row'); ok(await m.isVisible('#install') && await m.isVisible('#rm'), 'settings: install app + reduce motion'); await v3(m, 'm30-settings', true);
  await m.goto(BASE + '/terms'); await m.waitForSelector('.prose'); await v3(m, 'm31-terms');
  await m.goto(BASE + '/rules'); await m.waitForSelector('.prose'); await v3(m, 'm31b-rules-template');
  await m.goto(BASE + '/nope-404'); await m.waitForSelector('.empty-state'); ok((await m.textContent('main')).includes('Page not found'), '404 empty state');
  await m.goto(BASE + '/games'); await m.waitForSelector('.gcard'); await v3(m, 'm07-games');
  await m.goto(BASE + '/games/drift-rush'); await m.waitForSelector('.gd-hero'); await v3(m, 'm08-game-detail');
  await m.goto(BASE + '/giveaways'); await m.waitForSelector('.gw'); await v3(m, 'm12-giveaways');
  await m.goto(BASE + '/achievements'); await m.waitForSelector('.ach'); await v3(m, 'm16-achievements');

  // ---------- guest flow ----------
  console.log('# guest');
  const gctx = await browser.newContext(MOBILE); await passGate(gctx); const g = await gctx.newPage(); watch(g, 'guest');
  await g.goto(BASE + '/signin'); await g.click('#guest'); await g.waitForSelector('.hero, .hero-take'); ok(true, 'Continue as Guest -> home');
  await g.goto(BASE + '/games/jetpack-dash'); ok((await g.textContent('main')).includes('Playing as guest'), 'guest sees practice-mode note');
  await g.goto(BASE + '/play/jetpack-dash'); await g.waitForSelector('#game'); ok((await g.textContent('.who-chip')).includes('Guest'), 'guest can play practice run');
  await g.goto(BASE + '/giveaways'); await g.waitForSelector('.gw'); await g.click('.gw .btn >> nth=0'); await g.waitForURL(/giveaways\/\d+/); await g.waitForSelector('.back-row');
  ok(await g.isVisible('text=Sign in to enter') && (await g.locator('.gpicks a[href^="/signin"]').count()) >= 1, 'guest is asked to sign in to enter giveaway');
  await g.goto(BASE + '/'); await g.waitForSelector('.cta-card'); ok((await g.textContent('.cta-card')).includes('Sign up'), 'guest home shows a sign-up card instead of quests');
  await g.goto(BASE + '/quests'); await g.waitForSelector('.empty-state'); ok((await g.textContent('main')).includes('Sign in'), 'guest quests page asks to sign in');
  await gctx.close();

  // ---------- desktop pages ----------
  console.log('# desktop pages');
  const dctx = await browser.newContext(DESKTOP); await passGate(dctx); const d = await dctx.newPage(); watch(d, 'desktop');
  await d.goto(BASE + '/signin'); await d.fill('#u', uname); await d.fill('#p', pw); await d.click('button[type=submit]'); await d.waitForSelector('.hero, .hero-take');
  await shot(d, 'desktop-01-home', true); await v3(d, 'd01-home'); await v3(d, 'd01b-home-full', true);
  ok(await d.isVisible('.site-foot .sf-brand img') && (await d.locator('.site-foot .sf-links a').count()) >= 6 && await d.isVisible('.desk-nav a[href="/tournaments"]'), 'desktop: Trap Tech footer with links + Tournaments in nav');
  await d.click('.topbar .more-btn'); await d.waitForSelector('.drawer .dr-tt'); ok(true, 'desktop "more" menu opens the drawer'); await d.keyboard.press('Escape');
  await d.goto(BASE + '/games'); await d.waitForSelector('.gcard'); await shot(d, 'desktop-02-games', true);
  await d.goto(BASE + '/games/jetpack-dash'); await d.waitForSelector('.gd-hero'); await shot(d, 'desktop-03-game-detail');
  await d.goto(BASE + '/leaderboard'); await d.waitForSelector('.lb'); await shot(d, 'desktop-04-leaderboard');
  await d.goto(BASE + '/giveaways'); await d.waitForSelector('.gw'); await shot(d, 'desktop-05-giveaways', true);
  await d.goto(BASE + '/u/' + uname); await d.waitForSelector('.prof-head'); await shot(d, 'desktop-06-profile', true);
  await d.goto(BASE + '/sponsor'); await d.waitForSelector('.sp-f'); await shot(d, 'desktop-07-sponsor', true);
  await d.goto(BASE + '/achievements'); await d.waitForSelector('.ach'); await shot(d, 'desktop-07b-achievements');
  await d.goto(BASE + '/games'); await d.waitForSelector('.gcard'); await v3(d, 'd02-games');
  if (tBr) { await d.goto(BASE + '/tournaments/' + tBr.id); await d.waitForSelector('.bracket .bk-m'); await v3(d, 'd03-tournament-bracket', true); }
  await d.goto(BASE + '/tournaments'); await d.waitForSelector('.t-card'); await v3(d, 'd03b-tournaments', true);
  await d.goto(BASE + '/season'); await d.waitForSelector('.track .tier'); await v3(d, 'd04-season', true);
  await d.goto(BASE + '/u/' + uname); await d.waitForSelector('.prof-head'); await v3(d, 'd05-profile');
  await d.goto(BASE + '/achievements'); await d.waitForSelector('.ach'); await v3(d, 'd06-achievements');
  await d.goto(BASE + '/sponsor'); await d.waitForSelector('.tt-build'); await v3(d, 'd07-sponsor', true);
  await d.goto(BASE + '/about'); await d.waitForSelector('.about-hero'); await v3(d, 'd08-about', true);
  await d.goto(BASE + '/leaderboard'); await d.waitForSelector('.lb'); await v3(d, 'd09-leaderboard');
  await d.goto(BASE + '/giveaways'); await d.waitForSelector('.gw'); await v3(d, 'd10-giveaways');
  await d.goto(BASE + '/rules'); await d.waitForSelector('.prose'); await v3(d, 'd11-rules');
  await d.goto(BASE + '/play/jetpack-dash'); await d.waitForSelector('#game'); await sleep(900);
  await d.keyboard.down('Space'); await sleep(700); await d.keyboard.up('Space'); await sleep(500); await d.keyboard.down('Space'); await sleep(300); await shot(d, 'desktop-09-gameplay'); await d.keyboard.up('Space');

  // ---------- admin ----------
  console.log('# admin');
  const a = await dctx.newPage(); watch(a, 'admin');
  { const r404 = await a.goto(BASE + AP + '/'); ok(r404.status() === 404, 'old /admin URL is a plain 404'); }
  await a.goto(BASE + AP + '/'); await a.waitForSelector('#un');
  await a.fill('#un', 'owner'); await a.fill('#pw', 'wrong'); await a.click('#f button'); await a.waitForSelector('.err'); ok(true, 'admin wrong password rejected');
  await shot(a, 'desktop-10-admin-login'); ok(await a.isVisible('.aa-brand picture img'), 'admin sign-in page shows the Trap Tech lockup');
  ok(await require('./admin-auth').browserLogin(a, BASE), 'admin signs in with password + authenticator code'); await a.waitForSelector('.stats');
  ok((await a.textContent('.amain')).includes('Total Players'), 'admin dashboard loads'); await shot(a, 'desktop-11-admin-dashboard', true);
  ok((await a.textContent('.tt-bar')).includes('Powered by Trap Tech Solutions') && await a.isVisible('.side-tt img'), 'admin header: Powered by Trap Tech Solutions'); await v3(a, 'd12-admin-dashboard');
  ok((await a.textContent('.amain')).includes('12/12 games live'), 'dashboard: 12/12 games live');
  console.log('# admin: brands, grant badge, fair play');
  await a.goto(BASE + AP + '/channels'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Brands'); ok((await a.locator('code.inv').count()) >= 1, 'admin Brands page shows invite links'); await v5(a, 'admin-brands');
  await a.goto(BASE + AP + '/badges'); await a.waitForSelector('#bgf'); await a.fill('#bg-user', uname); await a.selectOption('#bg-badge', 'beta-tester'); await a.fill('#bg-note', 'UI test grant'); await a.click('#bg-grant'); await sleep(900);
  ok((await a.textContent('.amain')).includes(uname), 'admin grants a special badge (shows in holders/audit)'); await v5(a, 'admin-grant-badge', true);
  { const sb = await a.evaluate(async (u) => (await (await fetch('/api/users/' + u + '/special-badges')).json()).granted.map(b => b.id), uname); ok(sb.includes('beta-tester'), 'granted badge is visible on the public profile API', sb); }
  await a.click('#bg-revoke'); await sleep(700);
  await a.goto(BASE + AP + '/fairplay'); await a.waitForSelector('#fp-tabs'); ok((await a.textContent('.amain')).includes('Nobody is ever banned automatically'), 'admin Fair Play queue (soft flags, no auto-bans)'); await v5(a, 'admin-fair-play', true);
  console.log('# admin: one-click giveaway linking');
  await a.click('.side >> text=Games'); await a.waitForSelector('.agame');
  ok((await a.locator('.agame').count()) === 12, 'admin games page shows 12 game cards');
  await a.click('[data-create=plinko]'); await a.waitForSelector('#gpk');
  ok((await a.inputValue('#title')) === 'Plinko Giveaway' && (await a.locator('#gpk .gp.on').count()) === 1 && (await a.getAttribute('#gpk .gp.on', 'data-g')) === 'plinko', 'Create-giveaway-for-game prefills title + game');
  await a.click('#gpk .gp[data-g=memory-match]'); await a.click('#gpk .gp[data-g=high-score]');
  ok((await a.locator('#gpk .gp.on').count()) === 3, 'visual game picker multi-select (3 games)');
  await a.fill('#title', 'UI Test Plinko Giveaway'); await a.fill('#host', 'UI Brand'); await a.check('[data-plc=featured]'); await a.check('#usecolor'); await a.fill('#minscore', '0');
  await shot(a, 'desktop-11b-admin-giveaway-picker');
  await a.click('#gf button[type=submit]'); await a.waitForSelector('#wcard'); const linkGid = a.url().split('/').pop();
  ok((await a.textContent('.amain')).includes('Live campaign stats'), 'manage page shows live campaign stats');
  const linkedNow = await a.evaluate(async (id) => (await (await fetch('/' + location.pathname.split('/')[1] + '/api/giveaways/' + id)).json()).giveaway.game_ids, linkGid);
  ok(linkedNow.join() === 'plinko,memory-match,high-score', 'saved giveaway counts the 3 picked games', linkedNow);
  await a.click('.side >> text=Games'); await a.waitForSelector('.agame');
  ok(await a.isChecked(`.agame[data-game=plinko] [data-link="${linkGid}"]`), 'plinko card shows the new giveaway linked (toggle on)');
  await a.click(`.agame[data-game=drift-rush] .glink[data-gw="${linkGid}"] .toggle span`); await a.waitForFunction((id) => document.querySelector(`.agame[data-game=drift-rush] [data-link="${id}"]`)?.checked, linkGid);
  const after = await a.evaluate(async (id) => (await (await fetch('/' + location.pathname.split('/')[1] + '/api/giveaways/' + id)).json()).giveaway.game_ids, linkGid);
  ok(after.includes('drift-rush'), 'toggle on Drift Rush card links it to the giveaway', after);
  await a.click(`.agame[data-game=high-score] .glink[data-gw="${linkGid}"] .toggle span`); await a.waitForFunction((id) => !document.querySelector(`.agame[data-game=high-score] [data-link="${id}"]`)?.checked, linkGid);
  ok(!(await a.evaluate(async (id) => (await (await fetch('/' + location.pathname.split('/')[1] + '/api/giveaways/' + id)).json()).giveaway.game_ids, linkGid)).includes('high-score'), 'toggle off unlinks High Score');
  await shot(a, 'desktop-11c-admin-games-linking', true);
  // create giveaway
  await a.click('.side >> text=Giveaways'); await a.waitForSelector('.tbl'); await a.click('text=New Giveaway');
  await a.waitForSelector('#gf');
  await a.fill('#title', 'UI Test Giveaway'); await a.fill('#host', 'Trap Tech Solutions'); await a.fill('#prize', 'Test prize');
  const toLocal = (ms) => { const x = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
  await a.fill('#start', toLocal(Date.now() - 30 * 864e5)); await a.fill('#end', toLocal(Date.now() + 2 * 864e5));
  await a.click('#imgs button >> nth=1');
  ok(await a.isChecked('#e-join'), 'v5: new giveaways default to explicit entry + eligibility rules (anti-camping)');
  // this UI-test giveaway runs in "open" mode (every run in the window counts) so the test player's earlier runs make them an entrant
  await a.uncheck('#e-join'); for (const id of ['#e-age', '#e-runs']) if (await a.$(id)) await a.fill(id, '0');
  await a.click('#gf button[type=submit]');
  await a.waitForSelector('#wcard'); ok(true, 'admin creates giveaway -> manage page');
  ok((await a.inputValue('#wmethod')) === 'score' && (await a.inputValue('#wcount')) === '0', 'winner selection defaults: top score, one winner per prize tier');
  // edit
  await a.fill('#title', 'UI Test Giveaway (edited)'); await a.click('#gf button[type=submit]'); await sleep(900);
  ok((await a.inputValue('#title')).includes('edited'), 'admin edits giveaway');
  // player ran before this giveaway started? our run started ~minutes ago and window started 1h ago -> entrant
  await a.fill('#viewn', '200'); await sleep(200); ok((await a.textContent('#ent')).includes(uname), 'test player is an entrant (played during window)'); await a.fill('#viewn', '10');
  console.log('# v4: review queue, end now + lock, confirm, disqualify');
  await a.waitForSelector('#rq .rq-item'); ok((await a.textContent('#rq')).includes('Live preview') && (await a.locator('#rq [data-confirm]').count()) === 0, 'review queue is a live preview before the end (no confirm buttons)');
  ok((await a.locator('#rq .rq-item').count()) === Math.min(10, +(await a.textContent('.agstats div:nth-child(3) b')).replace(/,/g, '')) && (await a.locator('#rq .rq-runs').count()) >= 1, 'review queue lists the top 10 entrants with their runs');
  await a.fill('#rqn', '100'); await a.dispatchEvent('#rqn', 'change'); await a.waitForFunction((u) => document.querySelector(`#rq .rq-item[data-name="${u}"]`), uname, { timeout: 8000 }).catch(() => {});
  ok(!!(await a.$(`#rq .rq-item[data-name="${uname}"]`)), 'top-N input widens the queue (test player found in the top 100)');
  await a.fill('#rqn', '10'); await a.dispatchEvent('#rqn', 'change'); await a.waitForFunction(() => document.querySelectorAll('#rq .rq-item').length <= 10);
  await a.click('#endnow'); await a.waitForSelector('.lockbox'); ok((await a.textContent('#wcard')).includes('Final standings locked'), '"End now & lock results" locks the final standings');
  ok(await a.isDisabled('#end') && await a.isDisabled('#wmethod'), 'locked giveaway: dates + winner rules disabled in the form');
  await a.waitForSelector('#rq [data-confirm]');
  const firstName = await a.getAttribute('#rq .rq-item >> nth=0', 'data-name'); const secondName = await a.getAttribute('#rq .rq-item >> nth=1', 'data-name');
  await a.click('#rq .rq-item >> nth=0 >> [data-dq-open]'); await a.fill('#rq .rq-item >> nth=0 >> [data-reason]', 'UI test disqualification'); await a.click('#rq .rq-item >> nth=0 >> [data-dq-go]');
  await a.waitForSelector(`#rq .rq-item.is-dq[data-name="${firstName}"]`); ok((await a.getAttribute('#rq .rq-item >> nth=0', 'data-name')) === secondName, 'disqualify #1 (with reason) promotes #2 to the winning place');
  await v5(a, 'admin-review-queue-potato-contact');
  await a.click('#rq .rq-item >> nth=0 >> [data-confirm]'); await a.waitForSelector('#rq .rq-item >> nth=0 >> .pill.green'); ok((await a.textContent('#wb')).includes('Confirmed'), 'confirm winner from the review queue');
  ok((await a.textContent('#audit')).includes('Disqualified') && (await a.textContent('#audit')).includes('Promoted to a winning place') && (await a.textContent('#audit')).includes('Winner confirmed'), 'audit log shows disqualify, promote, confirm');
  const fcsv = await a.evaluate(async (u) => (await fetch(u)).text(), (await a.getAttribute('#exp-final', 'href'))); ok(fcsv.startsWith('rank,place,username') && fcsv.includes('UI test disqualification'), 'final standings CSV export');
  const rcsv = await a.evaluate(async (u) => (await fetch(u)).text(), (await a.getAttribute('#exp-runs', 'href'))); ok(rcsv.startsWith('giveaway_id,username') && rcsv.includes(uname), 'all entrants + runs CSV export');
  await shot(a, 'desktop-12-admin-manage-giveaway', true);
  const v4gid = a.url().split('/').pop();
  { const pc = await browser.newContext(MOBILE); await passGate(pc); const p = await pc.newPage(); watch(p, 'v4-public');
    await p.goto(`${BASE}/giveaways/${v4gid}`); await p.waitForSelector('#final-results');
    ok((await p.textContent('#final-results')).includes(secondName) && (await p.textContent('#final-results')).includes('Confirmed winner') && (await p.textContent('#gw-how')).includes('fewer attempts'), 'public page: Final results with the confirmed winner + tiebreak rules');
    await p.click('#live-link'); await p.waitForSelector('.res-table'); ok((await p.textContent('.res-table')).includes(secondName) && (await p.locator('.res-table tr.win').count()) >= 1, 'printable results page highlights the winner');
    await p.goto(`${BASE}/giveaways/${v4gid}/live`); await p.waitForSelector('#lv-table table'); ok((await p.textContent('.final-banner')).includes('Final results locked'), 'live page switches to final results after the lock');
    await p.goto(`${BASE}/giveaways/${v4gid}/rules`); await p.waitForSelector('#rules-tiebreak'); ok((await p.textContent('.prose')).includes('(b) If scores are tied, whoever reached that score first wins'), 'Official Rules list the tiebreak order');
    await pc.close(); }
  const csv = await a.evaluate(async (u) => (await fetch(u)).text(), (await a.getAttribute('a[href*="export/leaderboard.csv?giveaway"]', 'href')));
  ok(csv.startsWith('rank,username,score') && csv.includes(uname), 'giveaway CSV export downloads with entrants');
  const gidUrl = a.url();
  // sponsor requests -> quote builder -> sponsor accepts
  await a.click('.side >> text=Sponsor requests'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Sponsor requests');
  ok((await a.textContent('.tbl')).includes(brand), 'sponsor request from the public form shows in admin');
  await a.click(`text=${brand}`); await a.waitForSelector('#qb');
  ok(+(await a.textContent('#q-tot')).replace(/[^0-9.]/g, '') > 0 && (await a.textContent('#qb')).includes('Branded game skin'), 'draft quote is auto-totalled from the admin price sheet');
  await a.click('#q-add'); { const rows = a.locator('#ql tr'); const last = rows.nth((await rows.count()) - 1); await last.locator('[data-k=label]').fill('UI custom line'); await last.locator('[data-k=amount]').fill('10'); }
  await a.fill('#q-pct', '10'); const qTotal = await a.textContent('#q-tot'); await shot(a, 'desktop-13-admin-quote', true);
  a.once('dialog', d => d.accept()); await a.click('#q-send'); await a.waitForFunction(() => /Sent/.test(document.querySelector('#qb .pill')?.textContent || ''));
  ok(true, 'admin sends the quote');
  { const sp = await dctx.newPage(); await sp.goto(sponsorStatusUrl); await sp.waitForSelector('#sp-acc'); ok((await sp.textContent('#sp-total')) === qTotal, `sponsor sees the same total (${qTotal})`);
    sp.once('dialog', d => d.accept()); await sp.click('#sp-acc'); await sp.waitForSelector('.sp-state.st-accepted'); ok(true, 'sponsor accepts on the status page'); await sp.close(); }
  await a.reload(); await a.waitForSelector('#q-paid'); a.once('dialog', d => d.accept()); await a.click('#q-paid'); await a.waitForFunction(() => /Paid/.test(document.querySelector('#qb .pill')?.textContent || '')); ok(true, 'admin marks the accepted quote paid');
  await a.click('text=Price sheet'); await a.waitForSelector('[data-p=base]'); ok((await a.locator('[data-p]').count()) >= 20, 'admin-only price sheet lists every feature'); await shot(a, 'desktop-13b-admin-price-sheet');
  // players
  await a.click('.side >> text=Players'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Players'); ok((await a.textContent('.tbl')).includes(uname), 'admin players list shows new player');
  await shot(a, 'desktop-14-admin-players');
  await a.click('.side >> text=Leaderboards'); await a.waitForFunction(() => document.querySelector('.ahead h1')?.textContent === 'Leaderboards'); await a.selectOption('#p', 'weekly'); await sleep(600); ok((await a.textContent('.tbl')).includes(uname), 'admin weekly leaderboard');
  await a.click('.side >> text=Reports'); await a.waitForSelector('.stat'); await shot(a, 'desktop-15-admin-reports');
  const runsCsv = await a.evaluate(async () => (await fetch('/' + location.pathname.split('/')[1] + '/api/export/runs.csv')).text()); ok(runsCsv.includes(uname), 'runs CSV export');
  await a.click('.side >> text=Announcements'); await a.fill('#at', 'UI test announcement'); await a.fill('#ab', 'hello'); await a.click('#af button'); await sleep(700);
  ok((await a.textContent('.amain')).includes('UI test announcement'), 'admin posts announcement');
  console.log('# v3: admin tournaments');
  await a.click('.side >> text=Tournaments'); await a.waitForSelector('#tf');
  await a.fill('#tt', 'UI Test Cup'); await a.selectOption('#tg', 'drift-rush'); await a.selectOption('#tfm', 'bracket');
  ok(await a.isVisible('#tq') && await a.isHidden('#te'), 'bracket format shows qualifying + round fields');
  await a.selectOption('#tfm', 'timed'); await a.fill('#ts', toLocal(Date.now() - 3600e3)); await a.fill('#te', toLocal(Date.now() + 864e5));
  await v3(a, 'd13-admin-tournament-form');
  await a.click('#tf button[type=submit]'); await a.waitForFunction(() => document.querySelector('.tbl') && document.querySelector('.tbl').textContent.includes('UI Test Cup'));
  ok((await a.locator('tr', { hasText: 'UI Test Cup' }).textContent()).includes('live'), 'admin creates a live timed tournament');
  await v3(a, 'd14-admin-tournaments');
  // admin mobile layout
  const am = await mctx.newPage(); watch(am, 'admin-mobile'); await require('./admin-auth').browserLogin(am, BASE); await am.waitForSelector('.stats'); await shot(am, 'mobile-16-admin-dashboard');
  await am.goto(gidUrl); await am.waitForSelector('#gf'); await shot(am, 'mobile-17-admin-manage-giveaway');
  await am.goto(BASE + AP + '/games'); await am.waitForSelector('.agame'); await am.evaluate(() => document.querySelector('.agame[data-game=drift-rush]').scrollIntoView()); await v2(am, 'admin-game-giveaway-linking');
  await am.evaluate(() => document.querySelector('.agame[data-game=plinko]').scrollIntoView()); await v2(am, 'admin-game-giveaway-linking-2');
  await am.goto(BASE + AP + '/giveaways/new?game=terp-tapper'); await am.waitForSelector('#gpk'); await am.click('#gpk .gp[data-g=spin-to-win]'); await am.evaluate(() => document.getElementById('gpk').scrollIntoView({ block: 'center' })); await v2(am, 'admin-giveaway-game-picker');
  await am.goto(BASE + AP + '/settings'); await am.waitForSelector('#pkg-editor'); await v2(am, 'admin-package-editor');
  await am.goto(BASE + AP + '/tournaments'); await am.waitForSelector('#tf'); await v3(am, 'm33-admin-tournaments');

  // ---------- cleanup of UI test data (keeps demo data) ----------
  if (!process.env.KEEP) {
    console.log('# cleanup');
    const res = await a.evaluate(async (uname) => {
      const j = (u, o) => fetch(u, o).then(r => r.json());
      const out = [];
      const gs = await j('/' + location.pathname.split('/')[1] + '/api/giveaways'); for (const g of gs.giveaways.filter(g => g.title.startsWith('UI Test'))) { await fetch('/' + location.pathname.split('/')[1] + '/api/giveaways/' + g.id, { method: 'DELETE', headers: { 'X-CSRF-Token': document.querySelector('meta[name=csrf]').content } }); out.push('giveaway ' + g.id); }
      const bs = await j('/' + location.pathname.split('/')[1] + '/api/bookings'); for (const b of bs.bookings.filter(b => b.brand.startsWith('UI Test Brand'))) { await fetch('/' + location.pathname.split('/')[1] + '/api/bookings/' + b.id, { method: 'DELETE', headers: { 'X-CSRF-Token': document.querySelector('meta[name=csrf]').content } }); out.push('booking ' + b.id); }
      const ts = await j('/' + location.pathname.split('/')[1] + '/api/tournaments'); for (const t of ts.tournaments.filter(t => t.title.startsWith('UI Test'))) { await fetch('/' + location.pathname.split('/')[1] + '/api/tournaments/' + t.id, { method: 'DELETE', headers: { 'X-CSRF-Token': document.querySelector('meta[name=csrf]').content } }); out.push('tournament ' + t.id); }
      const an = await j('/' + location.pathname.split('/')[1] + '/api/announcements'); for (const x of an.announcements.filter(x => x.title === 'UI test announcement')) { await fetch('/' + location.pathname.split('/')[1] + '/api/announcements/' + x.id, { method: 'DELETE', headers: { 'X-CSRF-Token': document.querySelector('meta[name=csrf]').content } }); out.push('announcement'); }
      const ps = await j('/' + location.pathname.split('/')[1] + '/api/players?q=ui_'); for (const p of ps.players.filter(p => p.username.startsWith('ui_'))) { await fetch('/' + location.pathname.split('/')[1] + '/api/players/' + p.id, { method: 'DELETE', headers: { 'X-CSRF-Token': document.querySelector('meta[name=csrf]').content } }); out.push('player ' + p.username); }
      return out;
    }, uname);
    console.log('  removed', res.join(', '));
  }
  await browser.close();
  console.log('\nJS errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });

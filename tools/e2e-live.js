// Gentle end-to-end smoke test against a LIVE deployment (no direct DB access, nothing left behind).
// Usage: BASE=https://glassy-drifter-9532.de.deplexo.com node tools/e2e-live.js
//   ADMIN_PASSWORD is read from the environment or ../.env.  Screenshots -> screenshots/live/.  Report JSON -> screenshots/live/report.json
// What it does: page loads + console-error watch, 21+ gate, manifest + service worker; signs up ONE livetest_<random> account and plays
// 3 different games on each of desktop / iPhone 14 / Pixel 7; checks profile + leaderboards; admin dashboard; deletes the test account
// through the admin Players UI; then presses "Back up now" and downloads that backup (so the snapshot is already clean);
// light latency sampling + a burst of 10 concurrent page loads. Cleanup runs in a finally block even if a step fails.
const { chromium, devices } = require('playwright-core');
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const BASE = (process.env.BASE || 'https://glassy-drifter-9532.de.deplexo.com').replace(/\/$/, '');
const SHOTS = process.env.SHOTS_DIR || path.join(__dirname, '..', 'screenshots', 'live'); fs.mkdirSync(SHOTS, { recursive: true });
const ENV_FILE = path.join(__dirname, '..', '.env');
const env = { ...(fs.existsSync(ENV_FILE) ? Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(/=(.*)/s).slice(0, 2))) : {}), ...(process.env.ADMIN_PASSWORD ? { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD } : {}) };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const results = []; const errors = []; const httpErrors = []; const prefetch503 = []; const report = { base: BASE, started: new Date().toISOString(), loads: {}, latency: {}, burst: null, games: {}, backup: null, cleanup: null, demo: {}, shots: [] };
const ok = (c, m, x) => { results.push({ pass: !!c, check: m, detail: x }); console.log(`  ${c ? 'PASS' : 'FAIL'} ${m}${x !== undefined ? ' ' + JSON.stringify(x).slice(0, 300) : ''}`); return !!c; };
let STEP = 'start'; const T0 = Date.now();
setInterval(() => { if (Date.now() - T0 > 25 * 60e3) { console.error('WATCHDOG: hung at', STEP); process.exit(2); } }, 1000);

const DESKTOP = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
const PROFILES = [
  { id: 'desktop', dev: DESKTOP, touch: false, games: ['stack-2048', 'brick-breaker', 'high-score'] },
  { id: 'iphone14', dev: devices['iPhone 14'], touch: true, games: ['munchies-snake', 'sky-hopper'] },
  { id: 'pixel7', dev: devices['Pixel 7'], touch: true, games: ['drift-rush', 'blazed-roulette', 'terp-tapper'] },
];
function watch(page, tag) {
  page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`));
  page.on('console', m => { if (m.type() === 'error') errors.push(`[${tag}] console: ${m.text()} @ ${page.url()}`); });
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('response', r => { if (r.status() < 400) return; const sp = r.request().headers()['sec-purpose'] || '';
    // Cloudflare Speed Brain (speculation-rules prefetch) answers non-cacheable prefetches with 503 at the edge; Chrome then does the real request
    if (/prefetch/.test(sp) && r.status() === 503) { prefetch503.push(r.url()); return; }
    httpErrors.push(`[${tag}] ${r.status()} ${r.request().method()} ${r.url()} (page ${page.url()})`); });
}
async function shot(page, name, full = false) {
  await sleep(400); await page.evaluate(() => document.querySelectorAll('.toast, .ach-stack').forEach(t => t.remove())).catch(() => {});
  const f = path.join(SHOTS, name + '.png'); await page.screenshot({ path: f, fullPage: full }); report.shots.push(f); console.log('   shot', f);
}
const passGate = (ctx) => ctx.addInitScript(() => { try { if (!localStorage.getItem('gh_age_ok')) localStorage.setItem('gh_age_ok', String(Date.now())); localStorage.setItem('gh_seen_splash', '1'); } catch {} });
const navTiming = (p) => p.evaluate(() => { const n = performance.getEntriesByType('navigation')[0]; return n ? { ttfb: Math.round(n.responseStart), dcl: Math.round(n.domContentLoadedEventEnd), load: Math.round(n.loadEventEnd) } : null; });
const L2S = (page, x, y) => page.evaluate(([x, y]) => { const g = window.__game; const r = g.c.getBoundingClientRect(); const d = g.c.width / r.width; return [r.left + (x * g.scale + g.ox) / d, r.top + (y * g.scale + g.oy) / d]; }, [x, y]);
async function tapL(page, x, y, hold = 60) { const [px, py] = await L2S(page, x, y); await page.mouse.move(px, py); await page.mouse.down(); await sleep(hold); await page.mouse.up(); }
// game drivers: same approach as tools/e2e-browser.js (real inputs, or a tiny in-page bot that dispatches the same key events a player would)
const PLAY = {
  'drift-rush': async (p, box) => { for (let i = 0; i < 6; i++) { const left = i % 2 === 0; await p.mouse.move(box.x + box.width * (left ? 0.2 : 0.8), box.y + box.height * 0.7); await p.mouse.down(); await sleep(left ? 700 : 900); await p.mouse.up(); await sleep(200); } },
  'memory-match': async (p) => { await sleep(1800); for (let n = 0; n < 4; n++) { const pair = await p.evaluate(() => { const g = window.__game; const left = g.cards.filter(c => !c.done && !c.open); const a = left[0]; const b = left.find(c => c !== a && c.g === a.g); const R = (c) => { const [x, y, w, h] = g.rect(c.k); return [x + w / 2, y + h / 2]; }; return a && b ? [R(a), R(b)] : null; }); if (!pair) break; await tapL(p, ...pair[0]); await sleep(150); await tapL(p, ...pair[1]); await sleep(450); } },
  'high-score': async (p) => { const until = Date.now() + 5000; while (Date.now() < until) { const t = await p.evaluate(() => (window.__game.targets || []).filter(t => t.type !== 'bomb').map(t => [t.x, t.y])[0]); if (t) await tapL(p, t[0], t[1], 30); await sleep(120); } },
  'blazed-roulette': async (p) => { for (let i = 0; i < 2; i++) { for (const id of ['red', 'd2']) { const b = await p.evaluate((id) => { const b = window.__game.btns.find(x => x.id === id); return [b.x + b.w / 2, b.y + b.h / 2]; }, id); await tapL(p, ...b); await sleep(150); } const d = await p.evaluate(() => { const b = window.__game.btns.find(x => x.id === 'drop'); return [b.x + b.w / 2, b.y + b.h / 2]; }); await tapL(p, ...d); await sleep(i === 0 ? 4300 : 1200); } },
  'stack-2048': async (p) => { for (let i = 0; i < 24; i++) { await p.keyboard.press(['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowDown'][i % 4]); await sleep(110); } },
  'munchies-snake': async (p) => { await p.evaluate(() => { const g = window.__game; const K = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']; const loop = () => { if (g.state !== 'play') return; const [hx, hy] = g.body[0]; const [fx, fy] = g.food; const cur = g.q.length ? g.q[g.q.length - 1] : g.dir; let want = fx > hx ? 0 : fx < hx ? 2 : fy > hy ? 1 : 3; if ((want + 2) % 4 === cur) want = (want + 1) % 4; if (want !== cur && !g.q.length) window.dispatchEvent(new KeyboardEvent('keydown', { code: K[want] })); window.__sn = requestAnimationFrame(loop); }; loop(); }); await sleep(5000); await p.evaluate(() => cancelAnimationFrame(window.__sn)); },
  'brick-breaker': async (p) => { await p.evaluate(() => { const g = window.__game; g.launch(); const loop = () => { if (g.state !== 'play') return; g.px = Math.max(g.pw / 2, Math.min(g.W - g.pw / 2, g.ball.x + 18)); if (g.ball.stuck) g.launch(); window.__bb = requestAnimationFrame(loop); }; loop(); }); await sleep(6000); await p.evaluate(() => cancelAnimationFrame(window.__bb)); },
  'sky-hopper': async (p) => { await p.evaluate(() => { const g = window.__game; const loop = () => { if (g.state !== 'play') return; const nx = g.pipes.find(q => q.x - g.x + 74 > g.hx - 18); const target = nx ? nx.top + nx.g * 0.55 : g.H * 0.5; if (g.y > target && g.vy > -60) window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); window.__sh = requestAnimationFrame(loop); }; loop(); }); await sleep(7000); await p.evaluate(() => cancelAnimationFrame(window.__sh)); },
  'terp-tapper': async (p) => { await p.evaluate(() => { const K = ['KeyD', 'KeyF', 'KeyJ', 'KeyK']; const g = window.__game; const done = new Set(); const loop = () => { if (g.state !== 'play') return; for (const n of g.notes) if (!n.done && !done.has(n) && Math.abs(n.t - g.playT) < 0.03) { done.add(n); window.dispatchEvent(new KeyboardEvent('keydown', { code: K[n.lane] })); window.dispatchEvent(new KeyboardEvent('keyup', { code: K[n.lane] })); } window.__tt = requestAnimationFrame(loop); }; loop(); }); await sleep(6500); },
};
async function passGateUI(p) {
  await p.waitForSelector('#gate', { timeout: 20000 });
  await p.fill('#gate-m', '05'); await p.fill('#gate-d', '05'); await p.fill('#gate-y', '1990'); await p.click('#gate button[type=submit]');
  await p.waitForSelector('#gate', { state: 'detached', timeout: 10000 }).catch(() => {});
  return !(await p.$('#gate'));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const uname = 'livetest_' + Math.random().toString(36).slice(2, 8); const pw = 'Lt-' + Math.random().toString(36).slice(2, 12) + '9';
  report.username = uname; console.log('BASE', BASE, 'test user', uname);
  let signedUp = false; let adminCtx = null; let admin = null;
  const adminLogin = async () => {
    if (admin) return admin;
    adminCtx = await browser.newContext(DESKTOP); admin = await adminCtx.newPage(); watch(admin, 'admin-desktop');
    await admin.goto(BASE + '/admin'); await admin.waitForSelector('#pw'); await admin.fill('#pw', env.ADMIN_PASSWORD || ''); await admin.click('#lf button');
    await admin.waitForSelector('.stats', { timeout: 20000 }); return admin;
  };
  try {
    // ---------------- 1. public pages, gate, manifest, service worker ----------------
    console.log('# 1. public pages (desktop, cold cache)');
    STEP = 'pages';
    { const ctx = await browser.newContext(DESKTOP); const p = await ctx.newPage(); watch(p, 'gate');
      let bytes = 0, reqs = 0; const onFin = async (rq) => { try { const s = await rq.sizes(); bytes += s.responseBodySize + s.responseHeadersSize; reqs++; } catch {} };
      p.on('requestfinished', onFin);
      const t = Date.now(); await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForSelector('#gate'); const ready = Date.now() - t;
      await p.waitForLoadState('networkidle').catch(() => {}); p.off('requestfinished', onFin);
      report.loads['home (cold, 21+ gate)'] = { ready_ms: ready, ...(await navTiming(p)), kb: Math.round(bytes / 1024), requests: reqs };
      ok((await p.textContent('.gate')).includes('date of birth') && (await p.textContent('.gate')).includes('21'), '21+ age gate shows on first visit');
      ok(await passGateUI(p), '21+ age gate passes with a valid 21+ date of birth');
      ok(!!(await p.$('link[rel=manifest]')), 'manifest <link> present');
      const sw = await p.evaluate(async () => { if (!('serviceWorker' in navigator)) return { supported: false }; const r = await Promise.race([navigator.serviceWorker.ready, new Promise(res => setTimeout(() => res(null), 15000))]); return { supported: true, active: !!(r && r.active), script: r && r.active && r.active.scriptURL, scope: r && r.scope }; });
      ok(sw.active && /\/sw\.js$/.test(sw.script || ''), 'service worker registers and activates', sw);
      const swRes = await p.request.get(BASE + '/sw.js'); const swTxt = await swRes.text();
      ok(swRes.ok() && /javascript/.test(swRes.headers()['content-type'] || '') && /addEventListener\(['"](fetch|install)/.test(swTxt), '/sw.js served as JavaScript with install/fetch handlers', { status: swRes.status(), type: swRes.headers()['content-type'] });
      const t2 = Date.now(); const mf = await p.request.get(BASE + '/manifest.webmanifest'); const mj = await mf.json().catch(() => null); report.loads['manifest.webmanifest'] = { ready_ms: Date.now() - t2 };
      const icon = mj && mj.icons && mj.icons[0] ? await p.request.get(new URL(mj.icons[0].src, BASE).href) : null;
      ok(mf.ok() && mj && mj.name && mj.start_url && (mj.icons || []).length >= 1 && icon && icon.ok(), 'PWA manifest valid JSON with name/start_url/icons (first icon loads)', mj && { name: mj.name, start_url: mj.start_url, display: mj.display, icons: (mj.icons || []).length });
      await ctx.close(); }
    { const ctx = await browser.newContext(DESKTOP); await passGate(ctx); const p = await ctx.newPage(); watch(p, 'pages');
      const PAGES = [['home', '/', 'main#main .hero, main#main .hero-take, main#main .cta-card, main#main section, main#main .card'], ['games (store)', '/games', '#grid .gcard'], ['shop', '/shop', 'main#main'], ['leaderboard', '/leaderboard', '#tbl .lb, #tbl .empty-state, #tbl .empty'],
        ['terms', '/terms', '.prose'], ['privacy', '/privacy', '.prose'], ['official rules', '/rules', '.prose'], ['giveaways', '/giveaways', 'main#main']];
      for (const [name, u, sel] of PAGES) {
        STEP = 'page ' + u; const t = Date.now(); const resp = await p.goto(BASE + u, { waitUntil: 'load' });
        let shown = true; await p.waitForSelector(sel, { timeout: 20000 }).catch(() => { shown = false; }); const ready = Date.now() - t;
        await p.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
        report.loads[name] = { status: resp && resp.status(), ready_ms: ready, ...(await navTiming(p)) };
        const txt = (await p.textContent('main#main').catch(() => '')) || '';
        ok(resp && resp.status() === 200 && shown && txt.trim().length > 20, `${name} (${u}) loads and renders in ${ready} ms`);
        if (u === '/games') { const n = await p.locator('main .gcard').count(); ok(n === 12, `games list shows 12 games (${n})`); }
        if (u === '/rules') ok(txt.includes('NO PURCHASE NECESSARY'), 'Official Rules include NO PURCHASE NECESSARY');
        if (u === '/terms') ok(/21/.test(txt), 'Terms mention 21+');
      }
      await p.goto(BASE + '/'); await p.waitForLoadState('networkidle').catch(() => {}); await shot(p, 'desktop-01-home-guest');
      // ---- demo / seed data visible publicly? ----
      report.demo = await p.evaluate(async (games) => {
        const j = async (u) => { try { return await (await fetch(u)).json(); } catch { return null; } };
        const gl = await j('/api/leaderboard?game=global&limit=500'); const gw = await j('/api/giveaways'); const t = await j('/api/tournaments'); const c = await j('/api/community'); const ch = await j('/api/channels');
        const sponsors = {}; for (const g of games) { const s = await j('/api/games/' + g + '/sponsor'); if (s && (s.sponsor || s.giveaway || s.channel)) sponsors[g] = s; }
        return { global_leaderboard_players: gl && gl.total, demo_rows_on_leaderboard: gl && gl.rows.filter(r => r.demo).length, giveaways: gw && gw.giveaways.length, demo_giveaways: gw && gw.giveaways.filter(g => g.is_demo || g.demo).length, tournaments: t && t.tournaments.length, community_items: c && c.items.length, channels: ch && ch.channels.length, game_sponsors: sponsors };
      }, ['jetpack-dash', 'drift-rush', 'plinko', 'spin-to-win', 'high-score', 'blazed-roulette', 'terp-tapper', 'stack-2048', 'munchies-snake', 'brick-breaker', 'sky-hopper']);
      console.log('   demo data check', JSON.stringify(report.demo));
      await ctx.close(); }

    // ---------------- 2. sign up once, play 3 games on each of desktop / iPhone / Android ----------------
    for (const pf of PROFILES) {
      console.log(`# 2. ${pf.id}`); STEP = pf.id + ' auth';
      const ctx = await browser.newContext({ ...pf.dev }); const p = await ctx.newPage(); watch(p, pf.id);
      await p.goto(BASE + '/'); ok(await passGateUI(p), `${pf.id}: age gate passed through the UI`);
      if (!signedUp) {
        await p.goto(BASE + '/signup'); await p.waitForSelector('#u');
        await p.fill('#u', uname); await p.fill('#p', pw); await p.fill('#p2', pw);
        for (const [k, v] of [['m', '05'], ['d', '05'], ['y', '1990']]) if (await p.$(`#dob-${k}`)) await p.fill(`#dob-${k}`, v);
        if (await p.$('#agree')) await p.check('#agree');
        await p.click('form button[type=submit]'); signedUp = true; // assume created from here on so cleanup always looks for it
        await p.waitForFunction(() => !location.pathname.startsWith('/signup'), null, { timeout: 20000 }).catch(() => {});
        ok(!p.url().includes('/signup'), `signed up ${uname} (landed on ${new URL(p.url()).pathname})`, p.url().includes('/signup') ? await p.textContent('#msg').catch(() => '') : undefined);
      } else {
        await p.goto(BASE + '/signin'); await p.waitForSelector('#u'); await p.fill('#u', uname); await p.fill('#p', pw); await p.click('form button[type=submit]');
        await p.waitForFunction(() => !location.pathname.startsWith('/signin'), null, { timeout: 20000 }).catch(() => {});
        ok(!p.url().includes('/signin'), `${pf.id}: signed in as ${uname}`);
      }
      const me = await p.evaluate(async () => (await (await fetch('/api/me')).json()).user);
      ok(me && me.username === uname, `${pf.id}: /api/me reports ${uname}`);
      if (pf.id !== 'pixel7') { await p.goto(BASE + '/'); await p.waitForLoadState('networkidle').catch(() => {}); await shot(p, `${pf.id}-01-home-signed-in`); }
      for (const [gi, g] of pf.games.entries()) {
        STEP = `${pf.id} play ${g}`;
        await p.goto(BASE + '/play/' + g); await p.waitForSelector('#game', { timeout: 20000 }); await p.waitForFunction(() => window.__game && window.__game.running, null, { timeout: 20000 });
        const box = await p.locator('#game').boundingBox();
        if (pf.touch) await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height * 0.45);
        else { await p.mouse.move(box.x + box.width / 2, box.y + box.height * 0.45); await p.mouse.down(); await sleep(40); await p.mouse.up(); }
        await sleep(300);
        const started = await p.evaluate(() => window.__game.state);
        ok(started === 'play', `${pf.id}/${g}: tap starts the run (state ${started})`);
        const drive = PLAY[g](p, box);
        if (gi === 0 && pf.id !== 'pixel7') { await sleep(1500); await p.screenshot({ path: path.join(SHOTS, `${pf.id}-02-game-in-play-${g}.png`) }); report.shots.push(path.join(SHOTS, `${pf.id}-02-game-in-play-${g}.png`)); }
        await drive;
        const st = await p.evaluate(() => window.__game.state);
        if (st === 'play' || st === 'paused') { await p.click('#pause').catch(() => {}); await p.waitForSelector('#endrun, #sv .ok-msg, #sv .err', { timeout: 15000 }); if (await p.isVisible('#endrun')) await p.click('#endrun'); }
        await p.waitForSelector('#sv .ok-msg, #sv .err', { timeout: 30000 }).catch(() => {});
        const res = await p.evaluate(() => window.__lastResult);
        const svTxt = (await p.textContent('#sv').catch(() => '')) || '';
        report.games[`${pf.id}/${g}`] = { ok: !!(res && res.ok), score: res && res.score, held: res && res.held, run_id: res && res.run_id, error: res && res.error, ui: svTxt.trim().slice(0, 120) };
        ok(res && res.ok && res.game_id === g && /Saved/.test(svTxt), `${pf.id}/${g}: score submitted and saved (score ${res && res.score}${res && res.held ? ', HELD for fair-play review' : ''})`, res && !res.ok ? res.error : undefined);
        await sleep(800);
      }
      // profile + leaderboard checks
      STEP = pf.id + ' verify';
      const prof = await p.evaluate(async (u) => (await (await fetch('/api/profile/' + u)).json()).profile, uname);
      for (const g of pf.games) {
        const r = report.games[`${pf.id}/${g}`];
        const b = prof && prof.best_by_game.find(x => x.game_id === g);
        ok(b && r && r.ok && b.best >= r.score, `${pf.id}/${g}: score on ${uname}'s profile (best ${b && b.best})`);
        const lb = await p.evaluate(async ([g, u]) => { const r = await (await fetch('/api/leaderboard?game=' + g + '&limit=500')).json(); return r.rows.find(x => x.username === u) || null; }, [g, uname]);
        if (r && r.held) ok(!lb, `${pf.id}/${g}: held run is correctly hidden from the leaderboard until reviewed`);
        else ok(lb && r && lb.score >= r.score, `${pf.id}/${g}: score on the ${g} leaderboard (rank ${lb && lb.rank}, ${lb && lb.score})`);
      }
      await p.goto(BASE + '/u/' + uname); await p.waitForSelector('.prof-head', { timeout: 20000 }).catch(() => {});
      const ptxt = (await p.textContent('main#main').catch(() => '')) || '';
      ok(ptxt.includes(uname) && pf.games.some(g => ptxt.toLowerCase().includes(g.split('-')[0])), `${pf.id}: profile page UI shows ${uname} with recent games`);
      const lbGame = pf.games.find(g => !(report.games[`${pf.id}/${g}`] || {}).held) || pf.games[0];
      await p.goto(BASE + '/leaderboard?game=' + lbGame); await p.waitForSelector('#tbl .lb, #tbl .empty-state', { timeout: 20000 }).catch(() => {});
      ok(((await p.textContent('#tbl').catch(() => '')) || '').includes(uname), `${pf.id}: leaderboard page UI (${lbGame}) lists ${uname}`);
      if (pf.id !== 'pixel7') await shot(p, `${pf.id}-03-leaderboard-${lbGame}`);
      await p.goto(BASE + '/leaderboard?game=global'); await p.waitForSelector('#tbl .lb, #tbl .empty-state', { timeout: 20000 }).catch(() => {});
      ok(((await p.textContent('#tbl').catch(() => '')) || '').includes(uname), `${pf.id}: global leaderboard lists ${uname}`);
      await ctx.close();
    }

    // ---------------- 3. admin dashboard (desktop + iPhone) ----------------
    console.log('# 3. admin'); STEP = 'admin';
    const a = await adminLogin();
    const dtxt = await a.textContent('.amain');
    ok(dtxt.includes('Total Players'), 'admin login + dashboard loads');
    ok(dtxt.includes('12/12 games live'), 'dashboard: 12/12 games live');
    report.admin_stats = await a.evaluate(async () => { const s = await (await fetch('/api/admin/stats')).json(); return { players: s.players, runs: s.runs, runs_24h: s.runs_24h, games_live: `${s.games_live}/${s.games_total}`, active_giveaways: s.active_giveaways, bookings_total: s.bookings_total, rejected_runs: s.rejected_runs, demo: s.demo, upcoming_giveaways: (s.upcoming || []).length }; });
    await a.waitForLoadState('networkidle').catch(() => {}); await shot(a, 'desktop-04-admin-dashboard', true);
    const mctx = await browser.newContext({ ...devices['iPhone 14'] }); const am = await mctx.newPage(); watch(am, 'admin-iphone');
    await am.goto(BASE + '/admin'); await am.waitForSelector('#pw'); await am.fill('#pw', env.ADMIN_PASSWORD || ''); await am.click('#lf button');
    ok(await am.waitForSelector('.stats', { timeout: 20000 }).then(() => true).catch(() => false), 'admin dashboard loads on iPhone');
    await shot(am, 'iphone14-04-admin-dashboard');

    // ---------------- 5 (done before the backup so the snapshot is clean). delete the test account via the admin Players UI ----------------
    console.log('# 5. cleanup via admin UI'); STEP = 'cleanup';
    report.cleanup = await cleanup(a, uname);
    signedUp = !report.cleanup.verified_gone;

    // ---------------- 3b. Settings > Database backups > Back up now ----------------
    console.log('# 3b. backup'); STEP = 'backup';
    await a.goto(BASE + '/admin/settings'); await a.waitForSelector('#bk-now', { timeout: 20000 });
    const before = await a.evaluate(async () => (await (await fetch('/api/admin/backups')).json()));
    report.backup = { config: { interval_hours: before.interval_hours, keep: before.keep, max_mb: before.max_mb, github: before.github }, before: (before.backups || []).map(b => b.name) };
    const tB = Date.now();
    const toastP = a.waitForFunction(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).find(t => /Backup/.test(t)), null, { timeout: 120000 }).then(h => h.jsonValue()).catch(() => null);
    await a.click('#bk-now'); const toast = await toastP; report.backup.ms = Date.now() - tB; report.backup.toast = toast;
    await a.waitForSelector('#bk-now:not([disabled])', { timeout: 30000 }).catch(() => {}); await sleep(800);
    const after = await a.evaluate(async () => (await (await fetch('/api/admin/backups')).json()));
    const newOnes = (after.backups || []).filter(b => !report.backup.before.includes(b.name));
    report.backup.after = (after.backups || []).map(b => ({ name: b.name, kb: Math.round(b.size / 1024) })); report.backup.created = newOnes.map(b => b.name); report.backup.status = after.status || null;
    ok(toast && /Backup saved/.test(toast) && newOnes.length === 1, `"Back up now" created a backup in ${report.backup.ms} ms (${newOnes[0] && newOnes[0].name}); toast: ${toast}`);
    if (newOnes[0]) {
      const row = a.locator('#backups tr', { hasText: newOnes[0].name });
      ok(await row.count() === 1, 'new backup listed in the backups card');
      const dlP = a.waitForEvent('download', { timeout: 60000 }); await row.locator('a[href*="backups/download"]').click(); const dl = await dlP;
      const tmp = path.join(require('os').tmpdir(), 'livetest-' + dl.suggestedFilename()); await dl.saveAs(tmp);
      const gz = fs.readFileSync(tmp); let head = ''; try { head = zlib.gunzipSync(gz).subarray(0, 16).toString('latin1'); } catch (e) { head = 'gunzip failed: ' + e.message; }
      report.backup.download = { file: dl.suggestedFilename(), kb: Math.round(gz.length / 1024), sqlite_header: head.replace(/\0/g, '') };
      ok(dl.suggestedFilename() === newOnes[0].name && head.startsWith('SQLite format 3'), `backup downloads (${Math.round(gz.length / 1024)} KB gzip) and is a valid SQLite file`);
      fs.unlinkSync(tmp); // contains live user data (password hashes): don't keep a copy on the box
    }
    await a.evaluate(() => document.getElementById('backups').scrollIntoView({ block: 'start' })); await sleep(300); await shot(a, 'desktop-05-admin-backup-card');
    await am.goto(BASE + '/admin/settings'); await am.waitForSelector('#backups', { timeout: 20000 }); await am.evaluate(() => document.getElementById('backups').scrollIntoView({ block: 'start' })); await sleep(300); await shot(am, 'iphone14-05-admin-backup-card');
    await mctx.close();

    // ---------------- 4. gentle latency sampling + small burst ----------------
    console.log('# 4. latency'); STEP = 'latency';
    const timeGet = async (u) => { const t = Date.now(); let st = 0; try { const r = await fetch(BASE + u, { headers: { 'Cache-Control': 'no-cache' } }); await r.arrayBuffer(); st = r.status; } catch { st = -1; } return { ms: Date.now() - t, st }; };
    for (const u of ['/healthz', '/api/games', '/api/leaderboard?game=global&limit=50', '/api/giveaways?status=active', '/']) {
      const xs = []; for (let i = 0; i < 5; i++) { xs.push(await timeGet(u)); await sleep(300); }
      const ms = xs.map(x => x.ms).sort((a, b) => a - b);
      report.latency[u] = { min: ms[0], median: ms[2], max: ms[4], statuses: [...new Set(xs.map(x => x.st))] };
      ok(xs.every(x => x.st === 200), `${u}: 5/5 OK, median ${ms[2]} ms (min ${ms[0]}, max ${ms[4]})`);
    }
    const BURST = ['/', '/games', '/leaderboard', '/terms', '/privacy', '/rules', '/', '/games', '/giveaways', '/shop'];
    const tBurst = Date.now();
    const burst = await Promise.all(BURST.map(async (u, i) => { const ctx = await browser.newContext(DESKTOP); await passGate(ctx); const p = await ctx.newPage(); watch(p, 'burst' + i);
      const t = Date.now(); let st = 0; try { const r = await p.goto(BASE + u, { waitUntil: 'load', timeout: 60000 }); st = r ? r.status() : 0; await p.waitForSelector('main#main', { timeout: 30000 }); } catch (e) { st = st || -1; } const ms = Date.now() - t; await ctx.close(); return { u, st, ms }; }));
    const bms = burst.map(b => b.ms).sort((a, b) => a - b);
    report.burst = { pages: burst, wall_ms: Date.now() - tBurst, min: bms[0], median: bms[Math.floor(bms.length / 2)], max: bms[bms.length - 1] };
    ok(burst.every(b => b.st === 200), `burst of ${BURST.length} concurrent cold page loads all 200 (median ${report.burst.median} ms, max ${report.burst.max} ms, wall ${report.burst.wall_ms} ms)`);
    const hz = await timeGet('/healthz'); ok(hz.st === 200, `/healthz still OK after the burst (${hz.ms} ms)`);
  } catch (e) {
    ok(false, 'FATAL at step ' + STEP, String(e && e.stack || e).slice(0, 600)); console.error(e);
  } finally {
    if (signedUp) { // something failed before cleanup: try again so nothing is left behind
      try { console.log('# cleanup (finally)'); const a = await adminLogin(); report.cleanup = await cleanup(a, uname); } catch (e) { report.cleanup = { error: String(e), remaining: [uname] }; }
    }
    await browser.close().catch(() => {});
    report.console_errors = errors; report.http_errors = httpErrors; report.cf_prefetch_503 = prefetch503; report.finished = new Date().toISOString();
    report.results = results; fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
    console.log('\nLOADS ' + JSON.stringify(report.loads, null, 1));
    console.log('\nJS console errors:', errors.length ? '\n  ' + errors.join('\n  ') : 'none');
    console.log('HTTP >= 400 responses:', httpErrors.length ? '\n  ' + httpErrors.join('\n  ') : 'none');
    const nf = results.filter(r => !r.pass).length; console.log(`\n${results.length - nf} passed, ${nf} failed`);
    process.exit(nf || errors.length ? 1 : 0);
  }
})();

// Delete the test account(s) through the admin Players page (trash button + confirm), falling back to the admin API.
async function cleanup(a, uname) {
  const out = { via: null, deleted: [], others_found: [] };
  await a.goto(BASE + '/admin/players'); await a.waitForSelector('#q', { timeout: 20000 });
  await a.fill('#q', 'livetest_'); await sleep(1200); await a.waitForSelector('.tbl', { timeout: 10000 });
  out.others_found = (await a.locator('.tbl tr[data-name]').evaluateAll(trs => trs.map(t => t.dataset.name))).filter(n => n !== uname);
  const row = a.locator(`.tbl tr[data-name="${uname}"]`);
  if (await row.count()) {
    const runs = await row.locator('td.num').first().textContent(); out.runs_before_delete = +runs.replace(/\D/g, '');
    await row.locator('[data-del]').click(); // confirm() is auto-accepted by watch()
    await a.waitForFunction((u) => !document.querySelector(`.tbl tr[data-name="${u}"]`), uname, { timeout: 15000 }).catch(() => {});
    out.via = 'admin UI (Players > trash > confirm)';
  }
  let still = await a.evaluate(async (u) => (await (await fetch('/api/admin/players?q=' + encodeURIComponent(u))).json()).players.filter(p => p.username === u), uname);
  if (still.length) { await a.evaluate(async (id) => fetch('/api/admin/players/' + id, { method: 'DELETE' }), still[0].id); out.via = (out.via ? out.via + ' + ' : '') + 'admin API DELETE /api/admin/players/:id'; still = await a.evaluate(async (u) => (await (await fetch('/api/admin/players?q=' + encodeURIComponent(u))).json()).players.filter(p => p.username === u), uname); }
  // public checks from outside the browser (a 404 here is the expected result, so keep it out of the page console)
  const prof = (await fetch(BASE + '/api/profile/' + encodeURIComponent(uname))).status; const boards = [];
  for (const g of ['global', ...PROFILES.flatMap(x => x.games)]) { const r = await (await fetch(BASE + '/api/leaderboard?game=' + g + '&limit=500')).json(); if (r.rows.some(x => x.username === uname)) boards.push(g); }
  const st = await a.evaluate(async () => (await fetch('/api/admin/stats')).json());
  const pub = { profile_status: prof, on_boards: boards, stats_after: { players: st.players, runs: st.runs }, activity_mentions: st.activity.filter(x => x.message.includes(uname)).length };
  out.public_after = pub; out.stats_before = report.admin_stats ? { players: report.admin_stats.players, runs: report.admin_stats.runs } : null;
  out.verified_gone = !still.length && pub.profile_status === 404 && !pub.on_boards.length && !pub.activity_mentions; if (!still.length) out.deleted.push(uname);
  out.remaining = still.map(p => p.username).concat(out.others_found);
  ok(out.verified_gone, `cleanup: ${uname} deleted via ${out.via}; profile 404, on no leaderboard, players ${out.stats_before && out.stats_before.players} -> ${pub.stats_after.players}, runs ${out.stats_before && out.stats_before.runs} -> ${pub.stats_after.runs}`, out);
  return out;
}

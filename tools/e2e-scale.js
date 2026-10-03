// v4 scale test: a giveaway with 300 simulated players and thousands of runs.
// Seeds directly into SQLite (same DB the running server uses), then verifies everything over HTTP + a headless browser:
// deterministic ranking + tiebreaks, over-cap cheat exclusion, live "you are #X of N", search + pagination, API latency,
// automatic final-standings lock at the end time, immutability vs late scores, admin review flags, disqualify -> auto-promote,
// confirm, notifications, CSV exports, verifiable random draw, screenshots, and full cleanup.
// Usage: node tools/e2e-scale.js   (server must be running on BASE, default http://localhost:8787)
const fs = require('fs'); const path = require('path'); const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../src/db'); const cfg = require('../src/config');
const BASE = process.env.BASE || 'http://localhost:8787';
const SHOTS = path.join(__dirname, '..', 'screenshots', 'v4'); fs.mkdirSync(SHOTS, { recursive: true });
const ENV_FILE = path.join(__dirname, '..', '.env');
const env = { ...(fs.existsSync(ENV_FILE) ? Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter(Boolean).map(l => l.split(/=(.*)/s).slice(0, 2))) : {}), ...(process.env.ADMIN_PASSWORD ? { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD } : {}) };
let pass = 0, fail = 0; const errors = []; const report = {};
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
function client() {
  const jar = {};
  return async (p, opts = {}) => {
    const t = performance.now();
    const res = await fetch(BASE + p, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const ct = res.headers.get('content-type') || ''; const body = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body, ms: performance.now() - t, jar };
  };
}
let seed = 20261003; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const N_PLAYERS = 300; const name = (i) => 'sc_' + String(i).padStart(3, '0');
// memory-match: a game with no other recent runs, so the window holds exactly our 300 players
const GAME = 'memory-match'; const AC = cfg.GAME_MAP[GAME].ac;
const capOf = (r) => Math.min(AC.max, Math.floor(AC.perSec * (r.created_at - r.started_at) / 1000 + AC.grace));
const stats = (a) => { const s = [...a].sort((x, y) => x - y); return { n: s.length, avg: +(s.reduce((p, c) => p + c, 0) / s.length).toFixed(1), p50: +s[Math.floor(s.length * .5)].toFixed(1), p95: +s[Math.min(s.length - 1, Math.floor(s.length * .95))].toFixed(1), max: +s[s.length - 1].toFixed(1) }; };

function cleanup() {
  const ids = db.prepare("SELECT id FROM users WHERE username LIKE 'sc\\_%' ESCAPE '\\'").all().map(r => r.id);
  db.transaction(() => {
    for (const g of db.prepare("SELECT id FROM giveaways WHERE title LIKE 'SCALE Test%'").all()) { db.prepare("DELETE FROM activity WHERE type IN ('giveaway','entry','winner') AND ref_id=?").run(g.id); db.prepare('DELETE FROM giveaways WHERE id=?').run(g.id); }
    for (const id of ids) { db.prepare('DELETE FROM activity WHERE user_id=?').run(id); db.prepare('DELETE FROM users WHERE id=?').run(id); }
  })();
  return ids.length;
}

let STEP = 'start'; const T0 = Date.now();
setInterval(() => { if (Date.now() - T0 > 10 * 60e3) { console.error('WATCHDOG: hung at step', STEP); process.exit(2); } }, 1000).unref();
(async () => {
  console.log('BASE', BASE);
  const leftovers = cleanup(); if (leftovers) console.log('  (removed', leftovers, 'leftover sc_ users)');
  const ADM = client(), anon = client(), P150 = client();
  let r = await ADM('/api/admin/login', { body: { password: env.ADMIN_PASSWORD } }); ok(r.body.ok, 'admin login');

  // ---------- seed ----------
  STEP = 'seed'; console.log('# seed 300 players + runs');
  const now = Date.now(); const START = now - 3 * 3600e3;
  r = await ADM('/api/admin/giveaways', { body: { title: 'SCALE Test Score Giveaway', host: 'Scale Lab', prize: 'Top-3 prize pack', image: '/assets/giveaways/ps5-bundle-art.webp', start_at: START, end_at: now + 3600e3, game_ids: [GAME], rules: 'Scale test', active: true, win_method: 'score', winner_count: 3, prize_tiers: '1st: Grand prize\n2nd: Runner-up prize\n3rd: Third prize' } });
  ok(r.body.ok, 'create score giveaway (top 3)'); const GA = r.body.id;
  r = await ADM('/api/admin/giveaways', { body: { title: 'SCALE Test Random Draw', host: 'Scale Lab', prize: '5x merch packs', image: '/assets/giveaways/store-credit-art.webp', start_at: START, end_at: now + 3600e3, game_ids: [GAME], rules: 'Scale test', active: true, win_method: 'random', winner_count: 5 } });
  ok(r.body.ok, 'create random-draw giveaway (5 winners)'); const GB = r.body.id;
  const tSeed = performance.now();
  const pw = bcrypt.hashSync('scalepass123', 8); const unusable = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 4);
  const insU = db.prepare("INSERT INTO users (username, pass_hash, created_at, last_seen, birth_date) VALUES (?,?,?,?,'1990-05-05')");
  const insR = db.prepare('INSERT INTO runs (user_id, game_id, score, coins, duration_ms, started_at, created_at, ip_hash, ua_hash) VALUES (?,?,?,?,?,?,?,?,?)');
  const uid = {}; let runs = 0;
  const run = (i, score, at, opts = {}) => { // legit: started long enough ago for the score to be possible
    const need = Math.max(5, Math.ceil((score - AC.grace) / AC.perSec)) + 3 + Math.floor(rnd() * 40);
    const dur = (opts.durS ?? need) * 1000; const st = at - dur;
    const ip = opts.ip || sha('ip' + i).slice(0, 16), ua = opts.ua || sha('ua' + i).slice(0, 12);
    runs++; return insR.run(uid[i], GAME, score, Math.floor(score / 20), dur, st, at, ip, ua).lastInsertRowid;
  };
  const T = (minAgo) => now - minAgo * 60e3;
  db.transaction(() => {
    for (let i = 1; i <= N_PLAYERS; i++) uid[i] = insU.run(name(i), i === 150 ? pw : unusable, i === 299 ? now - 2 * 3600e3 : now - (30 + i % 50) * 864e5, now).lastInsertRowid;
    // designed cases (scores above every random player: random scores are < 7900)
    // sc_001 + sc_002 tie on 9500: sc_001 got there first (T-150m) despite more attempts -> wins on time
    run(1, 4000, T(170)); run(1, 6000, T(160)); run(1, 9500, T(150), { ip: 'a11ce5ha12ed0001', ua: 'deadbeef0001' }); run(1, 9500, T(20)); run(1, 7000, T(10));
    run(2, 5000, T(149)); run(2, 9500, T(140)); run(2, 9000, T(100));
    // sc_003 + sc_004: same 9000 at the exact same server timestamp -> fewer attempts wins (sc_003: 2, sc_004: 6)
    const same = T(120);
    run(3, 3000, T(130)); run(3, 9000, same);
    run(4, 2000, T(179)); run(4, 2500, T(175)); run(4, 3000, T(172)); run(4, 3500, T(171)); run(4, 9000, same); run(4, 100, T(5));
    // sc_006 + sc_007: same 8000, same time, same attempts (3) -> earlier-submitted run (lower run ID) wins
    const same2 = T(90); run(6, 1000, T(100)); run(7, 1000, T(100)); run(6, 2000, T(95)); run(7, 2000, T(95)); run(6, 8000, same2); run(7, 8000, same2);
    // sc_005 cheater: one over-cap run (60,000 in 20s, cap 625) is excluded; legit best 3000 counts
    run(5, 2500, T(60)); run(5, 3000, T(50)); runs++; insR.run(uid[5], GAME, 60000, 0, 20000, T(40) - 20000, T(40), sha('ip5').slice(0, 16), sha('ua5').slice(0, 12));
    // sc_299: alt account created 2h ago on the same IP + device as sc_001
    run(299, 1500, T(80), { ip: 'a11ce5ha12ed0001', ua: 'deadbeef0001' }); run(299, 1700, T(70), { ip: 'a11ce5ha12ed0001', ua: 'deadbeef0001' });
    // everyone else: 8-16 runs, skill-based, all inside the window and inside the caps
    for (let i = 8; i <= N_PLAYERS; i++) {
      if (i === 299) continue;
      const skill = 900 + Math.floor(rnd() * 6900); const n = 8 + Math.floor(rnd() * 9);
      for (let k = 0; k < n; k++) run(i, Math.max(50, Math.floor(skill * (0.3 + rnd() * 0.7))), T(175 - Math.floor(rnd() * 170)) - Math.floor(rnd() * 59e3));
    }
    // random ties in the middle of the table: sc_200..sc_209 all hit 7777
    for (let i = 200; i < 210; i++) run(i, 7777, T(30 + (i - 200)));
  })();
  report.seed_ms = Math.round(performance.now() - tSeed); report.players = N_PLAYERS; report.runs = runs;
  console.log(`  seeded ${N_PLAYERS} players, ${runs} runs in ${report.seed_ms}ms`);
  ok(runs >= 3000, `thousands of runs seeded (${runs})`);

  // ---------- independent expected ranking (computed here from the raw rows, not by the server) ----------
  function expected(endAt) {
    const all = db.prepare(`SELECT r.* FROM runs r JOIN users u ON u.id=r.user_id WHERE u.username LIKE 'sc\\_%' ESCAPE '\\' AND r.game_id=? AND r.started_at>=? AND r.created_at>=? AND r.created_at<=?`).all(GAME, START, START, endAt);
    const by = new Map();
    for (const x of all) { if (x.score > capOf(x)) continue; const u = by.get(x.user_id) || { user_id: x.user_id, attempts: 0, score: -1, reached_at: 0, best_run_id: 0 }; u.attempts++;
      if (x.score > u.score || (x.score === u.score && (x.created_at < u.reached_at || (x.created_at === u.reached_at && x.id < u.best_run_id)))) { u.score = x.score; u.reached_at = x.created_at; u.best_run_id = x.id; } by.set(x.user_id, u); }
    const names = new Map(db.prepare("SELECT id, username FROM users WHERE username LIKE 'sc\\_%' ESCAPE '\\'").all().map(u => [u.id, u.username]));
    return [...by.values()].map(u => ({ ...u, username: names.get(u.user_id) })).sort((a, b) => b.score - a.score || a.reached_at - b.reached_at || a.attempts - b.attempts || a.best_run_id - b.best_run_id);
  }
  const exp = expected(now + 3600e3);

  // ---------- live standings ----------
  STEP = 'live'; console.log('# live standings (300 entrants)');
  r = await P150('/api/auth/signin', { body: { username: 'sc_150', password: 'scalepass123' } }); ok(r.body.ok, 'sc_150 signs in');
  let all = []; for (let p = 1; p <= 3; p++) { r = await anon(`/api/giveaways/${GA}/standings?per=100&page=${p}`); all = all.concat(r.body.rows); }
  ok(r.body.total === N_PLAYERS && all.length === N_PLAYERS, `standings total = ${N_PLAYERS}`, r.body.total);
  ok(all.every((x, i) => x.username === exp[i].username && x.score === exp[i].score && x.attempts === exp[i].attempts), 'all 300 ranks match an independent recomputation (score, reached-first, attempts, run id)',
    all.map((x, i) => [i + 1, x.username, exp[i].username]).filter(x => x[1] !== x[2]).slice(0, 5));
  const top = all.slice(0, 7).map(x => x.username);
  ok(top.slice(0, 6).join() === 'sc_001,sc_002,sc_003,sc_004,sc_006,sc_007', 'top order: sc_001, sc_002, sc_003, sc_004, sc_006, sc_007', top);
  ok(all[1].tiebreak === 'time' && all[0].score === all[1].score, 'tie on 9500: sc_001 beats sc_002 because it reached 9500 first (tiebreak "time"), even with more attempts', [all[0], all[1]].map(x => [x.username, x.score, x.attempts, x.tiebreak]));
  ok(all[0].reached_at === T(150), 'reached_at is the FIRST run that hit the best score (not the later repeat)');
  ok(all[3].tiebreak === 'attempts' && all[2].attempts === 2 && all[3].attempts === 6 && all[2].reached_at === all[3].reached_at, 'same score + same timestamp: fewer attempts wins (sc_003: 2 vs sc_004: 6)', [all[2], all[3]].map(x => [x.username, x.attempts, x.tiebreak]));
  ok(all[5].tiebreak === 'run' && all[4].attempts === all[5].attempts, 'same score, time and attempts: earlier run ID wins (sc_006 over sc_007)', [all[4], all[5]].map(x => [x.username, x.attempts, x.tiebreak]));
  const cheat = all.find(x => x.username === 'sc_005');
  ok(cheat && cheat.score === 3000 && cheat.attempts === 2, 'over-cap cheat run (60,000) is excluded: sc_005 ranks on legit best 3000', cheat);
  const ties7777 = all.filter(x => x.score === 7777);
  ok(ties7777.length >= 10 && ties7777.every((x, i) => i === 0 || x.reached_at >= ties7777[i - 1].reached_at), `${ties7777.length} players tied on 7777 are ordered by who reached it first`);
  r = await P150(`/api/giveaways/${GA}/standings?per=25&around=me`);
  const me = r.body.me; const myIdx = exp.findIndex(x => x.username === 'sc_150');
  ok(me && me.rank === myIdx + 1 && me.of === N_PLAYERS && r.body.rows.some(x => x.username === 'sc_150'), `"you are #${me && me.rank} of ${me && me.of}" for sc_150, page jumps to them`, me);
  ok(me.gap_to_next === (myIdx ? exp[myIdx - 1].score - exp[myIdx].score : null) && me.next_username === (myIdx ? exp[myIdx - 1].username : null), 'gap to next place is correct', { gap: me.gap_to_next, next: me.next_username });
  ok(me.attempts === exp[myIdx].attempts && me.score === exp[myIdx].score, 'my best score + attempts are correct');
  report.sc_150 = { rank: me.rank, of: me.of, score: me.score, attempts: me.attempts, gap_to_next: me.gap_to_next };
  r = await anon(`/api/giveaways/${GA}/standings?q=sc_15&per=50`);
  ok(r.body.matched === 10 && r.body.rows.every(x => x.username.includes('sc_15')) && r.body.total === N_PLAYERS, 'search "sc_15" finds 10 players (sc_150-159) and keeps their overall rank', r.body.matched);
  r = await anon(`/api/giveaways/${GA}/standings?per=50&page=6`); ok(r.body.pages === 6 && r.body.rows.length === 50 && r.body.rows[0].rank === 251, 'pagination: page 6 of 6 starts at #251');
  r = await anon(`/api/giveaways/${GA}`); ok(r.body.giveaway.tiebreak_rules.length === 4 && r.body.giveaway.winner_count === 3 && !r.body.giveaway.finalized_at, 'giveaway API exposes tiebreak rules + winner count');

  // ---------- performance ----------
  STEP = 'perf'; console.log('# performance');
  const warm = [], cold = [], srv = [], q = [];
  for (let i = 0; i < 40; i++) { const x = await anon(`/api/giveaways/${GA}/standings?per=50&page=${1 + (i % 6)}`); warm.push(x.ms); srv.push(x.body.ms); }
  for (let i = 0; i < 15; i++) { const x = await P150(`/api/giveaways/${GA}/standings?per=25&q=sc_${i % 3}`); q.push(x.ms); }
  // cold: a new run lands before every request, so the server must recompute all 300 standings each time
  const filler = uid[300];
  for (let i = 0; i < 20; i++) { insR.run(filler, GAME, 60, 0, 10000, Date.now() - 10000, Date.now() - 1, sha('ip300').slice(0, 16), sha('ua300').slice(0, 12)); runs++; const x = await P150(`/api/giveaways/${GA}/standings?per=25&around=me`); cold.push(x.ms); }
  report.latency = { warm: stats(warm), server_compute: stats(srv), search: stats(q), cold_recompute: stats(cold) };
  console.log('  latency ms', JSON.stringify(report.latency));
  ok(Math.max(...warm, ...cold, ...q) < 300, `leaderboard API < 300ms on every call (max ${Math.max(...warm, ...cold, ...q).toFixed(1)}ms over ${warm.length + cold.length + q.length} calls)`);
  let tr = performance.now(); r = await ADM(`/api/admin/giveaways/${GA}/review?n=10`); report.review_ms = Math.round(performance.now() - tr);
  ok(r.body.ok && r.body.queue.length === 10 && report.review_ms < 1000, `admin review queue (top 10, all runs + IP checks) in ${report.review_ms}ms`);
  const q1 = r.body.queue[0];
  ok(q1.username === 'sc_001' && q1.flags.some(f => f.code === 'shared_device') && q1.shared_device_accounts.includes('sc_299'), 'review flags sc_001: same IP + device as sc_299', q1.flags);
  ok(q1.runs.length === 5 && q1.runs.every(x => x.cap > 0 && x.pct_cap > 0 && x.elapsed_ms > 0 && 'rate' in x && x.per_sec_cap === AC.perSec), 'per-run details: duration, server time, rate vs cap, % of cap');
  ok(r.body.excluded_runs.some(x => x.username === 'sc_005' && x.score === 60000 && x.over_cap), 'cheat run listed as excluded (over cap)');
  ok(!r.body.finalized && r.body.queue.every(x => x.state === 'live'), 'before the end the queue is a live preview (no confirm yet)');
  r = await ADM(`/api/admin/giveaways/${GA}/confirm`, { body: { username: 'sc_001' } }); ok(r.status === 400, 'cannot confirm a winner before results are locked');
  // the commit is public before the end; the seed is not
  const pubB = await anon(`/api/giveaways/${GB}`); const seedB = db.prepare('SELECT draw_seed FROM giveaways WHERE id=?').get(GB).draw_seed;
  ok(/^[0-9a-f]{64}$/.test(pubB.body.giveaway.draw_commit) && !JSON.stringify(pubB.body).includes(seedB), 'random draw: commitment is public before the end, the seed is not');
  r = await anon(`/api/giveaways/${GB}/verify`); ok(r.body.ok && !r.body.seed && !r.body.finalized, 'verify endpoint does not reveal the seed early');

  // ---------- browser: live leaderboard ----------
  STEP = 'browser-live';
  const { chromium } = require('playwright-core');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const MOBILE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' };
  const watch = (page, tag) => { page.on('pageerror', e => errors.push(`[${tag}] pageerror: ${e.message}`)); page.on('console', m => { if (m.type() === 'error' && !/favicon|status of 4\d\d/.test(m.text())) errors.push(`[${tag}] console: ${m.text()}`); }); page.on('dialog', d => d.accept()); };
  const shot = async (page, file, full = false) => { await sleep(400); await page.evaluate(() => document.querySelectorAll('.toast, .ach-stack').forEach(t => t.remove())); await page.screenshot({ path: path.join(SHOTS, file + '.png'), fullPage: full }); };
  const mctx = await browser.newContext(MOBILE); await mctx.addInitScript(() => { try { localStorage.setItem('gh_age_ok', String(Date.now())); localStorage.setItem('gh_seen_splash', '1'); } catch {} });
  await mctx.request.post(BASE + '/api/auth/signin', { data: { username: 'sc_150', password: 'scalepass123' } });
  const m = await mctx.newPage(); watch(m, 'mobile');
  await m.goto(`${BASE}/giveaways/${GA}`); await m.waitForSelector('#gw-how');
  const how = await m.textContent('#gw-how');
  ok(how.includes('Top 3 by best qualifying score') && how.includes('whoever reached that score first') && how.includes('fewer attempts'), 'giveaway page shows the winner rule + tiebreak order');
  await m.click('#live-link'); await m.waitForSelector('#lv-rank');
  ok((await m.textContent('#lv-rank')) === `#${me.rank}` && (await m.textContent('#lv-mecard')).includes(`of ${N_PLAYERS}`), `live page: "You are #${me.rank} of ${N_PLAYERS}"`);
  ok(await m.isVisible('.live-lb tr.me') && (await m.textContent('.live-pill')).includes('updates every 10s'), 'live page highlights my row and auto-refreshes every 10s');
  ok((await m.textContent('#lv-pager')).includes('of 12'), 'live page paginates 300 entrants (25 per page, 12 pages)');
  // polling: inject a better run for sc_150 and wait for the next refresh
  const target = exp[9]; const newScore = target.score + 1;
  insR.run(uid[150], GAME, newScore, 0, (Math.ceil(newScore / AC.perSec) + 5) * 1000, Date.now() - (Math.ceil(newScore / AC.perSec) + 5) * 1000, Date.now(), sha('ip150').slice(0, 16), sha('ua150').slice(0, 12)); runs++;
  await m.waitForFunction(() => { const e = document.getElementById('lv-rank'); return e && parseInt(e.textContent.slice(1), 10) <= 10; }, null, { timeout: 15000 }).then(() => ok(true, 'auto-refresh picked up a new best score within ~10s (sc_150 jumps into the top 10)')).catch(() => ok(false, 'auto-refresh picked up a new best score'));
  report.sc_150_after = await m.textContent('#lv-rank');
  await shot(m, 'm-live-leaderboard');
  await m.fill('#lv-q', 'sc_29'); await m.waitForFunction(() => (document.getElementById('lv-count') || {}).textContent?.includes('match'));
  ok((await m.textContent('#lv-count')).startsWith('10 of 300'), 'username search on the live page (sc_29 -> 10 of 300)');
  await m.fill('#lv-q', ''); await m.waitForFunction(() => !(document.getElementById('lv-count') || {}).textContent?.includes('match'));

  // ---------- end time -> automatic lock ----------
  STEP = 'finalize'; console.log('# end time + automatic snapshot');
  const before = (await anon(`/api/giveaways/${GA}/standings?per=1000`)).body.rows;
  const endAt = Date.now() + 2000;
  r = await ADM(`/api/admin/giveaways/${GA}`); const gA = r.body.giveaway;
  r = await ADM(`/api/admin/giveaways/${GA}`, { method: 'PUT', body: { title: gA.title, host: gA.host, prize: gA.prize, image: gA.image, start_at: gA.start_at, end_at: endAt, game_ids: gA.game_ids, rules: gA.rules, active: true, win_method: 'score', winner_count: 3, prize_tiers: gA.prize_tiers_raw } });
  ok(r.body.ok, 'schedule end time 2s from now');
  // wait for the server's own sweep (no API reads of this giveaway that could trigger a lazy lock)
  let fin = null; const tw = Date.now();
  while (Date.now() - tw < 30000) { fin = db.prepare('SELECT finalized_at, entrants_hash FROM giveaways WHERE id=?').get(GA); if (fin.finalized_at) break; await sleep(500); }
  ok(fin && fin.finalized_at && fin.finalized_at >= endAt, `standings locked automatically by the server ${fin && fin.finalized_at ? ((fin.finalized_at - endAt) / 1000).toFixed(1) + 's' : '?'} after the end time`);
  report.lock_delay_s = fin && fin.finalized_at ? +((fin.finalized_at - endAt) / 1000).toFixed(1) : null;
  const snap = db.prepare('SELECT * FROM giveaway_results WHERE giveaway_id=? ORDER BY rank').all(GA);
  const exp2 = expected(endAt);
  ok(snap.length === N_PLAYERS && snap.every((s, i) => s.username === exp2[i].username && s.score === exp2[i].score && s.best_run_id === exp2[i].best_run_id && s.reached_at === exp2[i].reached_at && s.attempts === exp2[i].attempts && s.rank === i + 1),
    'snapshot has 300 rows: rank, username, best score, run id, timestamp, attempts (all match recomputation)');
  ok(sha(snap.map(s => `${s.rank}|${s.username}|${s.score}|${s.best_run_id}|${s.reached_at}|${s.attempts}`).join('\n')) === fin.entrants_hash, 'entrant-list SHA-256 matches the snapshot');
  // late scores: one after the end, one back-dated into the window (simulated tamper) -> snapshot unchanged
  insR.run(uid[100], GAME, 99999, 0, 4000e3, Date.now() - 4000e3, Date.now(), 'late', 'late'); insR.run(uid[101], GAME, 99998, 0, 4000e3, endAt - 4001e3, endAt - 1000, 'late', 'late'); runs += 2;
  await sleep(300);
  const after = db.prepare('SELECT * FROM giveaway_results WHERE giveaway_id=? ORDER BY rank').all(GA);
  ok(JSON.stringify(after) === JSON.stringify(snap), 'late / back-dated scores never change the locked snapshot');
  r = await anon(`/api/giveaways/${GA}/standings?per=5`); ok(r.body.finalized && r.body.rows[0].username === 'sc_001' && !r.body.rows.some(x => ['sc_100', 'sc_101'].includes(x.username) && x.score > 90000), 'public standings come from the snapshot after the end');
  let blocked = 0; try { db.prepare('UPDATE giveaway_results SET score=1 WHERE giveaway_id=?').run(GA); } catch { blocked++; } try { db.prepare('DELETE FROM giveaway_results WHERE giveaway_id=?').run(GA); } catch { blocked++; }
  ok(blocked === 2, 'database triggers block UPDATE and DELETE of the locked results');
  r = await anon(`/api/giveaways/${GA}`); const pg = r.body.giveaway;
  ok(pg.winners.map(w => w.username).join() === 'sc_001,sc_002,sc_003' && pg.winners.every(w => w.state === 'pending') && pg.winners_state === 'pending', 'winners #1-#3 shown as "pending verification"', pg.winners);
  const notes = (u) => db.prepare("SELECT title FROM notifications WHERE user_id=? ORDER BY id").all(uid[u]).map(n => n.title);
  ok(notes(1).some(t => t.includes('placed #1')) && notes(3).some(t => t.includes('placed #3')), 'provisional winners notified in-app');
  r = await ADM(`/api/admin/giveaways/${GA}`, { method: 'PUT', body: { title: gA.title, host: gA.host, prize: gA.prize, image: gA.image, start_at: gA.start_at, end_at: endAt + 3600e3, game_ids: gA.game_ids, rules: gA.rules, active: true, win_method: 'score', winner_count: 3, prize_tiers: gA.prize_tiers_raw } });
  ok(r.status === 409, 'changing the end time after the lock is refused (409)');
  r = await ADM(`/api/admin/giveaways/${GA}/draw`, { body: { method: 'top', count: 3 } }); ok(r.status === 409, 'legacy draw is refused after the lock');

  // ---------- admin: disqualify -> promote, confirm ----------
  STEP = 'admin'; console.log('# admin review: disqualify + promote + confirm');
  r = await ADM(`/api/admin/giveaways/${GA}/review?n=10`); ok(r.body.finalized && r.body.queue[0].state === 'pending' && r.body.queue.slice(3).every(x => !x.winner), 'review queue: top 3 pending, 4-10 not winners');
  r = await ADM(`/api/admin/giveaways/${GA}/disqualify`, { body: { username: 'sc_001' } }); ok(r.status === 400, 'disqualify requires a reason');
  // disqualify #1 through the admin UI (mobile), with the reason form
  const amctx = await browser.newContext(MOBILE); await amctx.request.post(BASE + '/api/admin/login', { data: { password: env.ADMIN_PASSWORD } });
  const am = await amctx.newPage(); watch(am, 'admin-m'); await am.goto(`${BASE}/admin/giveaways/${GA}`); await am.waitForSelector('#rq .rq-item');
  const it1 = await am.$('.rq-item[data-name="sc_001"]');
  ok(it1 && (await it1.textContent()).includes('Same IP + device as: sc_299') && (await it1.textContent()).includes('Pending verification') && !!(await it1.$('[data-confirm]')), 'admin UI: #1 sc_001 flagged (same IP + device as sc_299), pending, with Confirm / Disqualify');
  await (await it1.$('[data-dq-open]')).click(); await (await it1.$('[data-reason]')).fill('Alt account: same IP + device as sc_299');
  await am.evaluate(() => { document.getElementById('rq-card').scrollIntoView({ block: 'start' }); });
  await shot(am, 'm-admin-review-queue');
  await (await it1.$('[data-dq-go]')).click(); await am.waitForSelector('.rq-item.is-dq[data-name="sc_001"]');
  ok((await am.textContent('.rq-item[data-name="sc_004"] .rq-pos')) === '#3' && (await am.textContent('.rq-item[data-name="sc_004"]')).includes('Pending verification'), 'admin UI: after disqualifying sc_001, sc_004 is promoted to #3');
  await amctx.close();
  r = await ADM(`/api/admin/giveaways/${GA}/review?n=10`);
  ok(r.body.disqualified.length === 1 && r.body.disqualified[0].username === 'sc_001' && r.body.disqualified[0].dq_reason.startsWith('Alt account'), 'disqualification stored with its reason');
  r = await ADM(`/api/admin/giveaways/${GA}/audit`); ok(r.body.audit.some(a => a.action === 'promoted' && a.username === 'sc_004' && a.detail.includes('"place":3')), 'promotion of sc_004 to 3rd place logged');
  r = await anon(`/api/giveaways/${GA}`);
  ok(r.body.giveaway.winners.map(w => `${w.place}:${w.username}`).join() === '1:sc_002,2:sc_003,3:sc_004', 'new winners: #1 sc_002, #2 sc_003, #3 sc_004', r.body.giveaway.winners);
  ok(notes(4).some(t => t.includes('placed #3')) && notes(1).some(t => t.includes('disqualified')), 'promoted player + disqualified player notified in-app');
  r = await ADM(`/api/admin/giveaways/${GA}/confirm`, { body: { username: 'sc_005' } }); ok(r.status === 400, 'cannot confirm a non-winning place');
  r = await ADM(`/api/admin/giveaways/${GA}/confirm`, { body: { username: 'sc_002' } }); ok(r.body.ok && r.body.winner.place === 1, 'confirm sc_002 as winner #1');
  r = await ADM(`/api/admin/giveaways/${GA}/confirm`, { body: { username: 'sc_002' } }); ok(r.status === 400, 'double confirm refused');
  ok(notes(2).some(t => t.startsWith('Confirmed: you won')), 'confirmed winner notified in-app');
  ok(db.prepare('SELECT COUNT(*) c FROM winners WHERE giveaway_id=?').get(GA).c === 1, 'confirmed winner recorded in winners table (profile/community)');
  r = await anon(`/api/giveaways/${GA}/standings?per=3`); ok(r.body.rows[0].username === 'sc_002' && r.body.rows[0].final_rank === 2 && r.body.winners[0].state === 'confirmed' && r.body.winners[1].state === 'pending', 'public results: sc_002 #1 confirmed, others pending, DQ removed');
  r = await ADM(`/api/admin/giveaways/${GA}/audit`); const acts = r.body.audit.map(a => a.action);
  ok(['created', 'seed_committed', 'finalized', 'provisional_winner', 'disqualified', 'promoted', 'confirmed'].every(a => acts.includes(a)), 'audit log has created, commit, lock, provisional winners, disqualify, promote, confirm', acts);
  ok(JSON.stringify(db.prepare('SELECT * FROM giveaway_results WHERE giveaway_id=? ORDER BY rank').all(GA)) === JSON.stringify(snap), 'snapshot still untouched after disqualify/confirm');

  // ---------- exports ----------
  STEP = 'exports'; console.log('# exports');
  r = await ADM(`/api/admin/export/giveaway/${GA}/runs.csv`); const lines = r.body.trim().split('\r\n');
  const winRuns = db.prepare('SELECT COUNT(*) c FROM runs WHERE game_id=? AND started_at>=? AND created_at>=? AND created_at<=?').get(GAME, START, START, endAt).c;
  ok(lines.length - 1 === winRuns && lines[0].startsWith('giveaway_id,username') && lines.some(l => l.includes(',60000,') && l.includes(',yes,')), `all-runs CSV: ${winRuns} runs from every entrant, with cap/over-cap columns`);
  report.csv_runs_rows = lines.length - 1;
  r = await ADM(`/api/admin/export/giveaway/${GA}/final.csv`); const fl = r.body.trim().split('\r\n');
  ok(fl.length - 1 === N_PLAYERS && fl[0].startsWith('rank,place,username,score,best_run_id,reached_at,attempts') && fl[1].includes('sc_001') && fl[1].includes(',yes,Alt account') && fl[2].includes(',yes,confirmed,'), 'final standings CSV: 300 rows with DQ + winner state', fl.slice(0, 3));
  report.csv_final_rows = fl.length - 1;

  // ---------- random draw: verifiable + unique ----------
  STEP = 'random'; console.log('# verifiable random draw');
  r = await ADM(`/api/admin/giveaways/${GB}/finalize`, { method: 'POST' }); ok(r.body.ok && r.body.results.length === 5, 'admin "End now & lock results" on the random giveaway');
  r = await anon(`/api/giveaways/${GB}/verify`); const v = r.body;
  ok(v.seed_ok && v.hash_ok && v.draw_commit === pubB.body.giveaway.draw_commit && sha(v.seed) === v.draw_commit, 'revealed seed matches the commitment published before the end');
  const order = v.entrant_lines.map(l => { const u = l.split('|')[1]; return [crypto.createHmac('sha256', v.seed).update(`${v.entrants_hash}:${u}`).digest('hex'), u]; }).sort((a, b) => a[0] < b[0] ? -1 : 1).map(x => x[1]);
  ok(order.join() === v.draw_order.map(x => x.username).join(), 'draw order independently recomputed from seed + entrant-list hash');
  r = await anon(`/api/giveaways/${GB}`); const wB = r.body.giveaway.winners.map(w => w.username);
  ok(wB.join() === order.slice(0, 5).join() && new Set(wB).size === 5 && v.entrant_lines.length === new Set(v.entrant_lines.map(l => l.split('|')[1])).size, '5 winners = first 5 in draw order, all unique (one entry per player)');
  r = await ADM(`/api/admin/giveaways/${GB}/disqualify`, { body: { username: order[0], reason: 'Scale test DQ' } });
  ok(r.body.ok && r.body.promoted.length === 1 && r.body.promoted[0].username === order[5] && !r.body.results.some(w => w.username === order[0]), 'random draw: DQ of draw #1 promotes draw #6, nobody picked twice');
  report.random = { entrants: v.entrant_lines.length, commit: v.draw_commit.slice(0, 16) + '...', winners: wB };

  // ---------- browser: final results + admin review screenshots ----------
  STEP = 'browser-final';
  await m.goto(`${BASE}/giveaways/${GA}`); await m.waitForSelector('#final-results');
  const frt = await m.textContent('#final-results');
  ok(frt.includes('Final results') && frt.includes('sc_002') && frt.includes('Confirmed winner') && frt.includes('Winner pending verification'), 'giveaway page: "Final results" with winners highlighted + pending/confirmed state');
  await m.evaluate(() => document.getElementById('final-results').scrollIntoView({ block: 'start' })); await m.evaluate(() => window.scrollBy(0, -70));
  await shot(m, 'm-final-results-winner');
  await m.goto(`${BASE}/giveaways/${GA}/results`); await m.waitForSelector('.res-table tbody tr'); await m.waitForFunction(() => !document.getElementById('vf-body').textContent.includes('Checking'));
  ok((await m.$$('.res-table tbody tr')).length === N_PLAYERS - 1 && (await m.textContent('#vf-body')).includes('match'), 'printable results page lists 299 placed entrants and verifies the hash in the browser');
  await m.emulateMedia({ media: 'print' }); ok(!(await m.isVisible('.topbar')) && !(await m.isVisible('#print-btn')), 'print stylesheet hides navigation'); await m.emulateMedia({ media: 'screen' });
  await m.goto(`${BASE}/giveaways/${GB}/results`); await m.waitForFunction(() => (document.getElementById('vf-body') || {}).textContent?.includes('Draw order'));
  ok((await m.textContent('#vf-body')).split('match').length >= 3 && (await m.textContent('#vf-body')).includes('equals the commitment: yes'), 'random draw verified in the browser (seed vs commitment, draw order)');
  await m.goto(`${BASE}/giveaways/${GA}/rules`); await m.waitForSelector('#rules-tiebreak');
  const rules = await m.textContent('.prose'); ok(rules.includes('(b) If scores are tied, whoever reached that score first wins') && rules.includes('(c) If still tied, the player with fewer attempts') && rules.includes('Final standings lock'), 'Official Rules show the exact tiebreak order + lock');
  for (const [tag, opts, file] of [['admin-d', { viewport: { width: 1440, height: 900 } }, 'd-admin-review-queue']]) {
    const actx = await browser.newContext(opts); await actx.request.post(BASE + '/api/admin/login', { data: { password: env.ADMIN_PASSWORD } });
    const a = await actx.newPage(); watch(a, tag); await a.goto(`${BASE}/admin/giveaways/${GA}`); await a.waitForSelector('#rq .rq-item');
    ok((await a.$$('#rq .rq-item')).length === 11 && (await a.textContent('#rq')).includes('Same IP + device as: sc_299'), `${tag}: review queue shows top 10 + disqualified entry with flags`);
    if (tag === 'admin-d') {
      // confirm #2 through the UI
      const it = await a.$('.rq-item[data-name="sc_003"]'); await (await it.$('[data-confirm]')).click(); await a.waitForSelector('.rq-item[data-name="sc_003"] .pill.green');
      ok(true, 'admin UI: Confirm winner button works');
      const it4 = await a.$('.rq-item[data-name="sc_004"]'); await (await it4.$('[data-dq-open]')).click(); ok(await (await it4.$('.dq-form')).isVisible(), 'admin UI: Disqualify opens the reason form');
      await (await it4.$('[data-dq-open]')).click();
      ok((await a.textContent('#audit')).includes('Winner confirmed'), 'admin UI: audit log shows the confirmation');
    }
    await a.evaluate(() => { const r = document.getElementById('rq-card'); r.scrollIntoView({ block: 'start' }); const d = document.querySelector('.rq-item details'); if (d) d.open = true; });
    await shot(a, file);
    await (await a.$('#rq-card')).screenshot({ path: path.join(SHOTS, file + '-full.png') }); // whole queue incl. disqualified + excluded cheat runs
    await actx.close();
  }
  await browser.close();
  ok(errors.length === 0, 'no JS errors in the browser', errors);

  // ---------- cleanup ----------
  STEP = 'cleanup'; console.log('# cleanup');
  for (const id of [GA, GB]) { r = await ADM(`/api/admin/giveaways/${id}`, { method: 'DELETE' }); ok(r.body.ok, 'delete giveaway ' + id); }
  cleanup();
  const left = { users: db.prepare("SELECT COUNT(*) c FROM users WHERE username LIKE 'sc\\_%' ESCAPE '\\'").get().c, giveaways: db.prepare("SELECT COUNT(*) c FROM giveaways WHERE title LIKE 'SCALE Test%'").get().c,
    results: db.prepare('SELECT COUNT(*) c FROM giveaway_results WHERE giveaway_id IN (?,?)').get(GA, GB).c, audit: db.prepare('SELECT COUNT(*) c FROM giveaway_audit WHERE giveaway_id IN (?,?)').get(GA, GB).c,
    runs: db.prepare("SELECT COUNT(*) c FROM runs WHERE user_id NOT IN (SELECT id FROM users)").get().c, notifications: db.prepare("SELECT COUNT(*) c FROM notifications WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM users)").get().c };
  ok(Object.values(left).every(x => x === 0), 'cleanup: no scale users, giveaways, results, audit rows, runs or notifications left', left);
  report.runs = runs;
  console.log('\nREPORT ' + JSON.stringify(report));
  console.log(`\n${pass} passed, ${fail} failed`);
  console.log(errors.length ? 'JS errors:\n' + errors.join('\n') : 'JS errors: none');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH at', STEP, e); try { cleanup(); } catch {} process.exit(1); });

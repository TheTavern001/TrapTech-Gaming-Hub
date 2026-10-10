// Skill-only tie-breaks + sudden-death playoff for official events. Run on a fresh DB: tools/fresh-api.sh tools/e2e-tiebreak.js
const BASE = process.env.BASE || 'http://localhost:8787';
const path = require('path'); const Database = require('better-sqlite3');
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client() { const jar = {}; return async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
(async () => {
  const cfg = require('../src/config'); const P = require('../src/games-lib-playoff');
  ok(cfg.GAMES.every(g => g.giveaway), `every core game is giveaway-eligible (${cfg.GAMES.length}/${cfg.GAMES.length})`);
  ok(['plinko', 'spin-to-win', 'blazed-roulette'].every(id => !cfg.GAMES.some(g => g.id === id)), 'pure-chance games retired from the catalog');
  ok(cfg.GAMES.every(g => P.metricsFor(g.id).length === 2 && P.metricsFor(g.id)[0].id === 'faster'), 'every core game has a skill metric (faster run + game metric)');
  const R = require('../src/results'); const txt = R.TIEBREAK_RULES.join(' ');
  ok(!/first wins|reached that score first|fewer attempts|lower run ID|earlier-submitted/i.test(txt) && /server-timed/.test(txt) && /playoff/.test(txt), 'published tie-break rules are skill-only');
  const db = new Database(process.env.DB_PATH || path.join(__dirname, '..', 'data', 'hub.db'));
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  const mk = () => { const c = client(); c.u = 'tb_' + Math.random().toString(36).slice(2, 8); return c; };
  const [A, B, C] = [mk(), mk(), mk()];
  for (const c of [A, B, C]) { const r = await c('/api/auth/signup', { body: { username: c.u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); c.id = db.prepare('SELECT id FROM users WHERE username=?').get(c.u).id; }
  const t0 = Date.now();
  let r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Tie Event', host: 'Acme', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_ids: ['munchies-snake'], active: true, winner_count: 1 } }); const gid = r.body.id;
  const code = (await ADM(`/api/admin/events/${gid}/share`)).body.code;
  const run = async (c, wait, ev) => { const s = await c('/api/run/start', { body: { game_id: 'munchies-snake', event: code } }); await sleep(wait); return c('/api/score', { body: { token: s.body.token, score: 30, coins: 0, duration_ms: wait, ev } }); };
  const EV2 = { v: 1, e: [50, 'f', 10, 50, 'f', 20], n: 2 }, EV3 = { v: 1, e: [50, 'f', 10, 50, 'f', 10, 50, 'f', 10], n: 3 };
  await Promise.all([run(A, 3500, EV2), run(B, 2300, EV2), run(C, 2300, EV3)]);
  r = await ADM(`/api/admin/giveaways/${gid}`); // live standings
  r = await client()(`/api/leaderboard?giveaway=${gid}`); const names = r.body.rows.map(x => x.username);
  ok(names.indexOf(A.u) === 2, 'same score: the slowest server-timed run (A) ranks last', r.body.rows.map(x => [x.username, x.tiebreak]));
  // B and C: same score; make their server-timed runs identical so the skill metric decides (C ate 3 snacks vs B 2)
  const setDur = (uid, ms) => db.prepare('UPDATE runs SET started_at = created_at - ? WHERE user_id=? AND event_id=?').run(ms, uid, gid);
  setDur(B.id, 2300); setDur(C.id, 2300); await sleep(5200);
  r = await client()(`/api/leaderboard?giveaway=${gid}`); let rows = r.body.rows;
  ok(rows[0].username === C.u && rows[1].username === B.u && rows[1].tiebreak === 'skill', 'equal score + equal time: the skill metric decides (more snacks eaten)', rows.map(x => [x.username, x.tiebreak]));
  // exact tie: same score, time and metric -> playoff
  db.prepare('UPDATE lib_run_metrics SET m2 = 2 WHERE run_id IN (SELECT id FROM runs WHERE user_id=? AND event_id=?)').run(C.id, gid);
  r = await ADM(`/api/admin/giveaways/${gid}/finalize`, { method: 'POST' }); ok(r.body.ok, 'admin locks results');
  r = await ADM(`/api/admin/events/${gid}/ties`); ok(r.body.playoff_needed && r.body.playoff_needed.length === 2, 'exact tie on the winning place is flagged: playoff needed', r.body);
  r = await client()(`/api/giveaways/${gid}`); ok(r.body.giveaway.winners.every(w => w.state !== 'confirmed'), 'no winner confirmed while the tie is open', r.body.giveaway.winners);
  r = await ADM(`/api/admin/giveaways/${gid}/confirm`, { body: { user_id: C.id } }); ok(!r.body.ok, 'a tied winning place cannot be confirmed before the playoff', r.body);
  r = await ADM(`/api/admin/events/${gid}/playoff`, { body: { window_min: 30 } }); ok(r.body.ok && r.body.playoff.entries.length === 2 && /^[0-9a-f]{32}$/.test(r.body.playoff.seed), 'admin starts a sudden-death playoff (same seed for both)', r.body); const pid = r.body.playoff.id;
  r = await A('/api/run/start', { body: { game_id: 'munchies-snake', playoff: pid } }); ok(r.status === 403, 'players outside the tie cannot join the playoff');
  const pr = async (c, score, ev) => { const s = await c('/api/run/start', { body: { game_id: 'munchies-snake', playoff: pid } }); await sleep(2300); return [s, await c('/api/score', { body: { token: s.body.token, score, coins: 0, duration_ms: 2300, ev } })]; };
  const [[sb], [sc]] = await Promise.all([pr(B, 30, EV2), pr(C, 10, { v: 1, e: [50, 'f', 10], n: 1 })]);
  ok(sb.body.seed === sc.body.seed, 'both playoff runs get the same seed');
  r = await B('/api/run/start', { body: { game_id: 'munchies-snake', playoff: pid } }); ok(r.status === 409, 'one playoff run per player');
  r = await ADM(`/api/admin/events/${gid}/playoff/${pid}/resolve`, { method: 'POST' }); ok(r.body.ok && r.body.playoff.status === 'decided' && r.body.playoff.winner_user_id === B.id, 'playoff resolved: best playoff run wins', r.body.playoff);
  r = await ADM(`/api/admin/events/${gid}/playoff/${pid}/apply`, { method: 'POST' }); ok(r.body.ok && r.body.winners[0].username === B.u, 'applying the playoff makes B the winner in the locked standings', r.body);
  r = await client()(`/api/giveaways/${gid}`); ok(r.body.giveaway.winners[0].username === B.u && r.body.giveaway.winners[0].state === 'pending', 'public page shows the playoff winner pending verification');
  await ADM('/api/admin/giveaways/' + gid, { method: 'DELETE' });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

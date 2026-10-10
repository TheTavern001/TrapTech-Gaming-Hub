// End-to-end API test. Usage: BASE=https://xxx.trycloudflare.com node tools/e2e-api.js
// Creates temporary test users/giveaways/bookings and deletes them at the end.
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787';
const ENV_FILE = path.join(__dirname, '..', '.env');
const env = { ...(fs.existsSync(ENV_FILE) ? Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter(Boolean).map(l => l.split(/=(.*)/s).slice(0, 2))) : {}), ...(process.env.ADMIN_PASSWORD ? { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD } : {}) };
const AP = '/' + (process.env.ADMIN_PATH || env.ADMIN_PATH); // v7 secret admin path
let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  PASS', msg); } else { fail++; console.log('  FAIL', msg, extra !== undefined ? JSON.stringify(extra).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client() {
  const jar = {};
  return async (p, opts = {}) => {
    const res = await fetch(BASE + p, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual' });
    for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const ct = res.headers.get('content-type') || ''; const body = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body, ct };
  };
}
(async () => {
  console.log('BASE', BASE);
  const A = client(), B = client(), ADM = require('./admin-auth').adminClient(BASE), anon = client(); // v7: secret admin path + TOTP + CSRF (tools/admin-auth.js)
  const ua = 'e2e_' + Math.random().toString(36).slice(2, 8), ub = 'e2e_' + Math.random().toString(36).slice(2, 8);
  console.log('# accounts');
  let r = await A('/api/auth/signup', { body: { username: 'bad name', password: 'x', agree: true, dob: '1990-05-05' } }); ok(r.status === 400, 'signup rejects invalid username');
  r = await A('/api/auth/signup', { body: { username: ua, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup A ' + ua, r.body);
  ok((r.body.unlocked || []).some(a => a.id === 'welcome'), 'signup unlocks the "welcome" achievement (server-side)', r.body.unlocked);
  r = await A('/api/auth/signup', { body: { username: ua.toUpperCase(), password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.status === 409, 'duplicate username (case-insensitive) rejected');
  r = await B('/api/auth/signup', { body: { username: ub, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup B ' + ub);
  r = await anon('/api/auth/signin', { body: { username: ua, password: 'wrongpass' } }); ok(r.status === 401, 'signin wrong password rejected');
  const A2 = client(); r = await A2('/api/auth/signin', { body: { username: ua, password: 'hunter2hunter2' } }); ok(r.body.ok, 'signin A works');
  r = await A2('/api/me'); ok(r.body.user && r.body.user.username === ua, '/api/me returns signed-in user');
  r = await anon('/api/run/start', { body: { game_id: 'jetpack-dash' } }); ok(r.status === 401, 'guest cannot start a scored run');

  console.log('# admin + giveaway');
  r = await ADM('/api/admin/stats'); ok(r.status === 401, 'admin API requires login');
  r = await ADM('/api/admin/login', { body: { username: 'owner', password: 'nope' } }); ok(r.status === 401, 'wrong admin password rejected');
  r = await ADM.login(); ok(r.body.ok, 'admin login (password + authenticator code)', r.body);
  r = await anon('/api/admin/stats'); ok(r.status === 404, 'old /api/admin path is a plain 404 (admin lives at the secret ADMIN_PATH)');
  const t0 = Date.now();
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Test Giveaway', host: 'Test Host', prize: 'Bragging rights', image: '/assets/giveaways/ps5-bundle-art.webp', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', rules: 'test', active: true } });
  ok(r.body.ok, 'admin creates giveaway'); const gid = r.body.id;
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Short Giveaway', host: 'Test', start_at: t0 - 60e3, end_at: t0 + 6000, game_id: 'jetpack-dash', active: true } });
  ok(r.body.ok, 'admin creates short giveaway (ends in 6s)'); const gshort = r.body.id;
  r = await ADM('/api/admin/giveaways', { body: { title: 'bad', start_at: t0, end_at: t0 - 1, game_id: 'jetpack-dash' } }); ok(r.status === 400, 'giveaway with end<start rejected');
  r = await ADM(`/api/admin/giveaways/${gid}`, { method: 'PUT', body: { title: 'E2E Test Giveaway (edited)', host: 'Test Host', prize: 'Bragging rights', image: '/assets/giveaways/ps5-bundle-art.webp', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', rules: 'edited rules', active: true } });
  ok(r.body.ok, 'admin edits giveaway');
  r = await anon('/api/giveaways?status=active'); ok(r.body.giveaways.some(g => g.id === gid && g.title.includes('edited')), 'public active giveaways list shows edited giveaway');

  console.log('# runs + anti-cheat');
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash' } }); ok(r.body.ok && r.body.token, 'run/start issues token'); const tokA = r.body.token;
  r = await B('/api/run/start', { body: { game_id: 'jetpack-dash' } }); const tokB = r.body.token;
  r = await A('/api/run/start', { body: { game_id: 'jetpack-dash' } }); const tokShort = r.body.token;
  await sleep(3200);
  r = await B('/api/score', { body: { token: tokA, score: 10, coins: 0 } }); ok(r.status === 403, "another player can't use A's token");
  r = await A('/api/score', { body: { token: tokA, score: 80, coins: 5, duration_ms: 3000, giveaway_id: gid } });
  ok(r.body.ok && r.body.rank >= 1, 'valid score accepted (80m in ~3s)', r.body);
  ok(r.body.giveaways && r.body.giveaways.some(g => g.id === gid), 'score counted toward active giveaway');
  ok(r.body.giveaway_status === 'counted', 'giveaway_status=counted');
  r = await A('/api/score', { body: { token: tokA, score: 80, coins: 5 } }); ok(r.status === 409, 'same token cannot be submitted twice');
  r = await B('/api/score', { body: { token: tokB, score: 5000, coins: 0 } }); ok(r.status === 422 && r.body.rejected, 'implausible score rejected (5000m in ~3s)', r.body);
  r = await B('/api/score', { body: { token: tokB, score: 10, coins: 0 } }); ok(r.status === 409, 'rejected token cannot be reused');
  r = await B('/api/score', { body: { token: tokB.slice(0, -3) + 'abc', score: 10 } }); ok(r.status === 400, 'tampered token rejected');
  r = await B('/api/run/start', { body: { game_id: 'not-a-game' } }); ok(r.status === 400, 'unknown game cannot be started');
  r = await B('/api/run/start', { body: { game_id: 'jetpack-dash' } }); const tokB2 = r.body.token; await sleep(2100);
  r = await B('/api/score', { body: { token: tokB2, score: 40, coins: 2 } }); ok(r.body.ok, 'B valid score accepted');
  console.log('  waiting for short giveaway to end...'); await sleep(Math.max(0, t0 + 6500 - Date.now()));
  r = await A('/api/score', { body: { token: tokShort, score: 60, coins: 0, giveaway_id: gshort } });
  ok(r.body.ok && r.body.giveaway_status === 'ended_not_counted', 'score after giveaway end is saved globally but NOT counted for the giveaway', r.body);
  r = await ADM(`/api/admin/giveaways/${gshort}`); ok(!r.body.entrants.some(e => e.username === ua && e.score === 60), 'ended giveaway entrants exclude late run');

  console.log('# leaderboards');
  for (const period of ['all', 'weekly', 'monthly']) {
    r = await anon(`/api/leaderboard?game=jetpack-dash&period=${period}&limit=500`);
    ok(r.body.rows.some(x => x.username === ua && x.score === 80), `jetpack-dash ${period} leaderboard has A best=80`);
  }
  r = await anon('/api/leaderboard?game=global&limit=500'); ok(r.body.rows.some(x => x.username === ub && x.score === 40), 'global leaderboard has B');
  r = await A('/api/leaderboard?game=jetpack-dash&limit=1'); ok(r.body.me && r.body.me.username === ua, 'leaderboard returns my rank when signed in');
  r = await anon(`/api/leaderboard?giveaway=${gid}`); ok(r.body.rows.length >= 2 && r.body.rows[0].username === ua, 'giveaway leaderboard ranks entrants (A first)', r.body.rows);

  console.log('# winners + CSV');
  r = await ADM(`/api/admin/giveaways/${gid}/draw`, { body: { method: 'random' } }); ok(r.body.ok && r.body.winners.length === 1 && [ua, ub].includes(r.body.winners[0].username), 'random draw picks one entrant', r.body);
  const first = r.body.winners[0].username;
  r = await ADM(`/api/admin/giveaways/${gid}/draw`, { body: { method: 'top', count: 3 } }); ok(r.body.ok && r.body.winners.length === 1 && r.body.winners[0].username !== first, 'top-N draw skips already-drawn winner');
  r = await ADM(`/api/admin/giveaways/${gid}/draw`, { body: { method: 'random' } }); ok(r.status === 400, 'draw fails when all entrants already won');
  r = await anon(`/api/giveaways/${gid}`); ok(r.body.giveaway.winners.length === 2, 'public giveaway shows winners');
  r = await ADM(`/api/admin/export/leaderboard.csv?giveaway=${gid}`); ok(r.ct.includes('text/csv') && r.body.includes(ua) && r.body.split('\n')[0].startsWith('rank,username,score'), 'giveaway entrants CSV export');
  r = await ADM('/api/admin/export/runs.csv'); ok(r.body.includes(ua), 'runs CSV export');
  r = await ADM('/api/admin/export/leaderboard.csv?game=jetpack-dash&period=weekly'); ok(r.body.includes(ua), 'leaderboard CSV export');
  r = await anon(AP + '/api/export/runs.csv'); ok(r.status === 401, 'CSV export requires admin');

  console.log('# v4: final standings lock + winner workflow');
  const crypto = require('crypto'); const sha = (x) => crypto.createHash('sha256').update(x).digest('hex');
  r = await anon(`/api/giveaways/${gshort}`); let gs = r.body.giveaway;
  ok(gs.finalized_at && gs.finalized_at >= gs.end_at && gs.winners.length === 1 && gs.winners[0].username === ua && gs.winners[0].state === 'pending' && gs.winners_state === 'pending', 'ended giveaway: standings locked, #1 shown as "pending verification"', gs.winners);
  ok(gs.tiebreak_rules.length === 4 && gs.tiebreak_rules[1].includes('reached that score first') && gs.tiebreak_rules[2].includes('fewer attempts'), 'giveaway API publishes the tiebreak rules');
  r = await A(`/api/giveaways/${gshort}/standings`); ok(r.body.finalized && r.body.total === 2 && r.body.me.rank === 1 && r.body.me.of === 2 && r.body.me.gap_to_next === null, 'standings: A is #1 of 2 (final)', r.body.me);
  r = await B(`/api/giveaways/${gshort}/standings`); ok(r.body.me.rank === 2 && r.body.me.gap_to_next === 40 && r.body.me.next_username === ua, 'standings: B is #2, 40 behind A', r.body.me);
  r = await anon(`/api/giveaways/${gshort}/standings?q=${ub}`); ok(r.body.matched === 1 && r.body.rows[0].username === ub && r.body.rows[0].rank === 2, 'standings search by username');
  r = await anon(`/api/giveaways/${gshort}/verify`); ok(r.body.hash_ok && r.body.entrant_lines.length === 2 && sha(r.body.entrant_lines.join('\n')) === r.body.entrants_hash && !r.body.seed, 'verify: entrant-list hash recomputes (score giveaway: no seed revealed)');
  r = await anon(`/api/giveaways/${gid}/verify`); ok(!r.body.finalized && !r.body.seed && /^[0-9a-f]{64}$/.test(r.body.draw_commit), 'active giveaway: commitment published, nothing else');
  r = await ADM(`/api/admin/giveaways/${gshort}/review`); const q0 = r.body.queue[0];
  ok(r.body.finalized && q0.username === ua && q0.state === 'pending' && q0.runs.length >= 1 && q0.runs[0].cap > 0 && 'pct_cap' in q0.runs[0] && 'elapsed_ms' in q0.runs[0], 'review queue: per-run duration, cap and % of cap', q0);
  ok(q0.flags.some(f => f.code === 'shared_device' || f.code === 'shared_ip') && q0.shared_ip_accounts.includes(ub), 'review queue flags accounts sharing an IP hash (A and B play from the same IP)', q0.flags);
  r = await ADM(`/api/admin/giveaways/${gshort}/confirm`, { body: { username: ub } }); ok(r.status === 400, 'cannot confirm a non-winning place');
  r = await ADM(`/api/admin/giveaways/${gshort}/disqualify`, { body: { username: ua, reason: '' } }); ok(r.status === 400, 'disqualify requires a reason');
  r = await ADM(`/api/admin/giveaways/${gshort}/disqualify`, { body: { username: ua, reason: 'E2E test disqualification' } });
  ok(r.body.ok && r.body.promoted.length === 1 && r.body.promoted[0].username === ub && r.body.results[0].username === ub, 'disqualify #1 auto-promotes #2', r.body);
  r = await B('/api/notifications'); ok((r.body.items || r.body.notifications || []).some(n => n.title.includes('placed #1')), 'promoted player notified in-app');
  r = await A('/api/notifications'); ok((r.body.items || r.body.notifications || []).some(n => n.title.includes('disqualified')), 'disqualified player notified in-app');
  r = await A(`/api/giveaways/${gshort}/standings`); ok(r.body.me.rank === null && r.body.me.disqualified && r.body.total === 1, 'disqualified player sees they are out of the standings');
  r = await ADM(`/api/admin/giveaways/${gshort}/reinstate`, { body: { username: ua } }); ok(r.body.ok && r.body.results[0].username === ua, 'reinstate restores the original place');
  r = await ADM(`/api/admin/giveaways/${gshort}/confirm`, { body: { username: ua } }); ok(r.body.ok && r.body.winner.place === 1, 'admin confirms winner');
  r = await anon(`/api/giveaways/${gshort}`); ok(r.body.giveaway.winners[0].state === 'confirmed' && r.body.giveaway.winners_state === 'confirmed', 'public page: winner confirmed');
  r = await A('/api/notifications'); ok((r.body.items || r.body.notifications || []).some(n => n.title.startsWith('Confirmed: you won')), 'confirmed winner notified in-app');
  r = await ADM(`/api/admin/giveaways/${gshort}/audit`); const acts = r.body.audit.map(a => a.action);
  ok(['finalized', 'provisional_winner', 'disqualified', 'promoted', 'reinstated', 'confirmed'].every(a => acts.includes(a)), 'audit log records every step', acts);
  r = await ADM(`/api/admin/export/giveaway/${gshort}/final.csv`); ok(r.ct.includes('text/csv') && r.body.split('\r\n')[0].startsWith('rank,place,username,score,best_run_id,reached_at,attempts') && r.body.includes(',confirmed,'), 'final standings CSV');
  r = await ADM(`/api/admin/export/giveaway/${gshort}/runs.csv`); ok(r.body.split('\r\n')[0].startsWith('giveaway_id,username') && r.body.includes(ua) && r.body.includes(ub), 'all entrants + runs CSV');
  r = await ADM(`/api/admin/export/giveaway/${gid}/final.csv`); ok(r.status === 409, 'final CSV only after the lock');
  r = await anon(`${AP}/api/export/giveaway/${gshort}/final.csv`); ok(r.status === 401, 'exports require admin');
  r = await ADM(`/api/admin/giveaways/${gshort}`); const gsa = r.body.giveaway;
  const putBody = (x) => ({ title: gsa.title, host: gsa.host, prize: gsa.prize, image: gsa.image, start_at: gsa.start_at, end_at: gsa.end_at, game_ids: gsa.game_ids, rules: gsa.rules, active: true, ...x });
  r = await ADM(`/api/admin/giveaways/${gshort}`, { method: 'PUT', body: putBody({ end_at: gsa.end_at + 3600e3 }) }); ok(r.status === 409, 'locked giveaway: end time cannot change');
  r = await ADM(`/api/admin/giveaways/${gshort}`, { method: 'PUT', body: putBody({ title: 'E2E Short Giveaway (renamed)' }) }); ok(r.body.ok, 'locked giveaway: title can still change');
  r = await ADM(`/api/admin/giveaways/${gshort}/draw`, { body: { method: 'random' } }); ok(r.status === 409, 'legacy draw refused after the lock');
  r = await ADM(`/api/admin/giveaways/${gshort}/winners`, { method: 'DELETE' }); ok(r.status === 409, 'clearing winners refused after the lock');
  r = await ADM(`/api/admin/giveaways/${gshort}/finalize`, { method: 'POST' }); ok(r.status === 409, 'cannot lock twice');
  // verifiable random draw, ended early by the admin
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Random Giveaway', host: 'Test', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true, win_method: 'random', winner_count: 2 } });
  const grand = r.body.id; r = await anon(`/api/giveaways/${grand}`); const commit = r.body.giveaway.draw_commit;
  ok(r.body.giveaway.win_method === 'random' && r.body.giveaway.winner_count === 2 && /^[0-9a-f]{64}$/.test(commit), 'random giveaway publishes its draw commitment up front');
  r = await ADM(`/api/admin/giveaways/${grand}/finalize`, { method: 'POST' }); ok(r.body.ok && r.body.results.length === 2, 'admin "End now & lock results"');
  r = await anon(`/api/giveaways/${grand}/verify`); const vv = r.body;
  const ord = vv.entrant_lines.map(l => l.split('|')[1]).map(u => [crypto.createHmac('sha256', vv.seed).update(`${vv.entrants_hash}:${u}`).digest('hex'), u]).sort((a, b) => a[0] < b[0] ? -1 : 1).map(x => x[1]);
  ok(vv.draw_commit === commit && sha(vv.seed) === commit && vv.seed_ok && vv.hash_ok && ord.join() === vv.draw_order.map(x => x.username).join(), 'seed reveal matches commitment and the draw order recomputes');
  r = await anon(`/api/giveaways/${grand}`); ok(r.body.giveaway.winners.map(w => w.username).join() === ord.slice(0, 2).join() && new Set(r.body.giveaway.winners.map(w => w.username)).size === 2, 'random winners = first 2 in draw order, no duplicates');
  r = await anon('/api/giveaways/999999/standings'); ok(r.status === 404, 'standings 404 for unknown giveaway');

  console.log('# profile, booking, community');
  r = await anon('/api/profile/' + ua); ok(r.body.ok && r.body.profile.games_played === 2 && r.body.profile.total_score === 80 && r.body.profile.giveaways_won >= 1, 'profile stats (2 runs, total 80, won>=1)', r.body.profile);
  r = await anon('/api/bookings', { body: { brand: 'E2E Brand', email: 'e2e@example.com', business_type: 'Apparel / streetwear brand', event_type: 'Giveaway', package: 'premium', start_date: '2026-11-01', end_date: '2026-11-14', details: 'test booking' } }); ok(r.body.ok, 'booking submitted'); const bid = r.body.id;
  r = await anon('/api/bookings', { body: { brand: '', contact: '' } }); ok(r.status === 400, 'booking without brand rejected');
  r = await ADM('/api/admin/bookings'); ok(r.body.bookings.some(b => b.id === bid && b.brand === 'E2E Brand'), 'booking visible to admin');
  r = await ADM('/api/admin/bookings/' + bid, { method: 'PUT', body: { status: 'approved', admin_note: 'ok' } }); ok(r.body.ok, 'admin updates booking status');
  r = await ADM('/api/admin/players?q=e2e_'); ok(r.body.players.some(p => p.username === ua), 'admin players list');
  r = await anon('/api/community?tab=winners'); ok(r.body.items.some(i => i.title.includes('E2E Test Giveaway')), 'community feed shows winner');


  console.log('# v2: all games playable with per-game anti-cheat');
  const C = client(); const uc = 'e2e_' + Math.random().toString(36).slice(2, 8);
  r = await C('/api/auth/signup', { body: { username: uc, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup C (game runner) ' + uc);
  r = await anon('/api/games'); const GAMES = r.body.games;
  ok(GAMES.length === 16 && GAMES.every(g => g.playable && g.module && g.ac && g.tiers), 'all 16 games are playable with module + caps + tiers', GAMES.map(g => g.id));
  for (const g of GAMES) { const js = await anon('/js/' + g.module); ok(js.status === 200 && String(js.body).includes('class ' + g.cls), `game module served: ${g.module}`); }
  // multi-game + min-score giveaways created BEFORE C plays
  const t1 = Date.now();
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Multi Giveaway', host: 'E2E Brand', start_at: t1 - 60e3, end_at: t1 + 3600e3, game_ids: ['terp-tapper', 'memory-match'], placements: ['featured', 'giveaway'], brand_color: '#22d3ee', featured: true, min_score: 0, prize_tiers: '1st - test\nRandom - test', active: true } });
  ok(r.body.ok, 'admin creates multi-game giveaway (terp-tapper + memory-match)', r.body); const gmulti = r.body.id;
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E MinScore Giveaway', host: 'E2E', start_at: t1 - 60e3, end_at: t1 + 3600e3, game_ids: ['terp-tapper'], min_score: 1000, active: true } });
  ok(r.body.ok, 'admin creates min-score giveaway (terp-tapper, 1000+)'); const gmin = r.body.id;
  r = await anon('/api/giveaways/' + gmulti); ok(r.body.giveaway.game_ids.join() === 'terp-tapper,memory-match' && r.body.giveaway.placements.includes('featured') && !('tier' in r.body.giveaway) && r.body.giveaway.prize_tiers.length === 2 && r.body.giveaway.featured, 'public giveaway exposes game_ids, placements (no tier), prize tiers, featured', r.body.giveaway);
  const PLAUS = { 'jetpack-dash': 50, 'drift-rush': 300, plinko: 600, 'spin-to-win': 800, 'memory-match': 400, 'high-score': 250, 'blazed-roulette': 1150, 'terp-tapper': 600, 'stack-2048': 300, 'munchies-snake': 100, 'brick-breaker': 500, 'sky-hopper': 5, 'void-swarm': 50, 'grow-guard': 0, 'sling-smash': 0, 'haze-defense': 0 /* 12+ submits/min = submit_burst note; 0 keeps them un-held */, stack: 30 };
  await sleep(61e3); // L2 per-IP submit limit (30/min): let earlier submissions age out
  const toks = {};
  for (const g of GAMES) { r = await C('/api/run/start', { body: { game_id: g.id } }); ok(r.body.ok, `run/start ${g.id}`); toks[g.id] = r.body.token; }
  r = await C('/api/run/start', { body: { game_id: 'plinko' } }); const tokPl = r.body.token;
  r = await C('/api/run/start', { body: { game_id: 'blazed-roulette' } }); const tokRo = r.body.token;
  await sleep(2600);
  let allUnlocked = [];
  for (const g of GAMES) {
    r = await C('/api/score', { body: { token: toks[g.id], score: PLAUS[g.id], coins: 1, duration_ms: 2500, log: g.id === 'stack' ? [1450, 1500] : undefined, giveaway_id: g.id === 'terp-tapper' ? gmin : undefined } });
    ok(r.body.ok && r.body.game_id === g.id && r.body.best === PLAUS[g.id], `${g.title}: plausible score ${PLAUS[g.id]} saved`, r.body);
    allUnlocked.push(...(r.body.unlocked || []));
    if (g.id === 'terp-tapper') ok(r.body.giveaway_status === 'below_min_score', 'run below the giveaway minimum score is not counted (below_min_score)', r.body.giveaway_status);
  }
  r = await C('/api/score', { body: { token: tokPl, score: 9000, coins: 0 } }); ok(r.status === 422 && /Plinko/.test(r.body.error), 'Plinko: 9000 pts in ~3s rejected by per-game cap', r.body);
  r = await C('/api/score', { body: { token: tokRo, score: 50000, coins: 0 } }); ok(r.status === 422, 'Blazed Roulette: 50,000 chips rejected (absolute cap 3,800)', r.body);
  for (const g of GAMES) { r = await anon(`/api/leaderboard?game=${g.id}&limit=500`); ok(r.body.rows.some(x => x.username === uc && x.score === PLAUS[g.id]), `${g.id} leaderboard has C`); }
  const ids = new Set(allUnlocked.map(a => a.id));
  ok(ids.has('first-run') && ids.has('variety-3') && ids.has('variety-all'), 'runs unlock first-run, variety-3 and variety-all (played every game)', [...ids]);
  ok(ids.has('plinko-bronze') === false, 'no bronze for plinko at 600 (< 900 threshold)');
  ok(ids.has('blazed-roulette-bronze') === false && ids.has('memory-match-bronze') === false, 'thresholds respected server-side');

  console.log('# v2: multi-game giveaway + one-click linking');
  r = await anon(`/api/leaderboard?giveaway=${gmulti}`); let rowC = r.body.rows.find(x => x.username === uc);
  ok(rowC && rowC.score === 1000, 'multi-game giveaway score = sum of best per linked game (600 + 400)', rowC);
  r = await anon(`/api/leaderboard?giveaway=${gmin}`); ok(!r.body.rows.some(x => x.username === uc), 'min-score giveaway excludes C (600 < 1000)');
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'high-score', linked: true } }); ok(r.body.ok && r.body.game_ids.includes('high-score'), 'one-click link high-score to giveaway');
  r = await anon(`/api/leaderboard?giveaway=${gmulti}`); rowC = r.body.rows.find(x => x.username === uc); ok(rowC && rowC.score === 1250, 'linked game immediately counts (1000 + 250)', rowC);
  r = await ADM('/api/admin/games'); let hs = r.body.games.find(g => g.id === 'high-score'); ok(hs.giveaways.some(x => x.id === gmulti && x.linked), 'admin games list shows giveaway linked on High Score card');
  ok(r.body.games.find(g => g.id === 'drift-rush').giveaways.some(x => x.id === gmulti && !x.linked), 'admin games list offers unlinked live giveaway as a toggle');
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'terp-tapper', linked: false } }); ok(r.body.ok && !r.body.game_ids.includes('terp-tapper'), 'one-click unlink terp-tapper');
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'memory-match', linked: false } }); ok(r.body.ok, 'unlink memory-match');
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'high-score', linked: false } }); ok(r.status === 400, 'cannot unlink the last game of a giveaway');
  r = await ADM(`/api/admin/giveaways/${gmulti}`); ok(r.body.giveaway.game_ids.join() === 'high-score' && r.body.stats && r.body.stats.plays >= 1, 'admin giveaway detail has game_ids + live stats', r.body.stats);

  console.log('# v7: Sponsor a Host (features, no public tiers or prices)');
  r = await anon('/api/packages'); ok(r.status === 404, 'old public package/price list is gone');
  r = await anon('/api/sponsor/catalog'); const CAT = r.body;
  ok(CAT.ok && CAT.features.length >= 20 && !/price|_cents/.test(JSON.stringify(CAT.features)) && CAT.potato_handle, `one feature list without prices (${CAT.features.length} features)`);
  r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Brand Tier', email: 'e2e@example.com', business_type: 'Gaming channel / esports', features: [{ id: 'weeks', qty: 2 }, { id: 'featured', qty: 1 }] } }); ok(r.body.ok && r.body.token && r.body.features.some(f => /2 weeks/.test(f)), 'quote request carries the picked features', r.body); const bid2 = r.body.id;
  r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Brand Tier', potato: 'e2e_brand', business_type: CAT.cannabis, licensed: true, features: [{ id: 'push', qty: 1 }, { id: 'bogus' }] } }); const bid3 = r.body.id;
  ok(r.body.licensed_confirmed === true && r.body.features.some(f => /alert blast/.test(f)) && !r.body.features.some(f => /bogus/.test(f)) && r.body.potato_handle === 'TrapTechSolutions', 'cannabis seller request with license + Potato handle in reply', r.body);
  r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Brand Tier', email: 'e2e@example.com', business_type: CAT.cannabis } }); ok(r.status === 400 && /licensed/.test(r.body.error), 'cannabis seller without license confirmation rejected');
  r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Brand Tier', business_type: 'Artist / musician' } }); ok(r.status === 400 && /Potato username/.test(r.body.error), 'request needs email or Potato username');
  r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Brand Tier', email: 'e2e@example.com' } }); ok(r.status === 400 && /business type/.test(r.body.error), 'request needs a business type');
  r = await anon('/api/bookings', { body: { brand: 'E2E Brand Tier', potato: '@e2e_glass', business_type: 'Glass / smoke-gear shop', package: 'basic' } }); ok(r.body.ok && r.body.licensed_confirmed === false, 'old /api/bookings alias still works (non-cannabis, no license question)'); const bid4 = r.body.id;
  r = await ADM('/api/admin/sponsor/requests/' + bid2); ok(r.body.request.quote.total_cents > 0 && r.body.request.quote.status === 'draft', 'admin gets an auto-totalled draft quote');
  r = await ADM('/api/admin/bookings'); ok(r.body.bookings.some(b => b.id === bid2 && /Featured row/.test(b.package_snapshot)), 'admin sees the request feature snapshot');

  console.log('# v2: achievements + cosmetics');
  r = await C('/api/achievements'); const AL = r.body.achievements;
  ok(AL.length >= 100 && AL.length <= 140, `achievement catalog size ${AL.length}`);
  ok(AL.find(a => a.id === 'first-run').unlocked && AL.every(a => typeof a.rarity_pct === 'number' && a.rarity), 'achievements list has unlocked state + rarity');
  ok(AL.filter(a => a.hidden && !a.unlocked).every(a => a.name === 'Secret achievement'), 'secret achievements stay hidden until unlocked');
  const pg = AL.find(a => a.id === 'plinko-bronze'); ok(pg.progress === 600 && pg.target === 830, 'progress is reported (plinko 600/830)', pg);
  r = await C('/api/cosmetics'); const CZ = r.body; const ownedB = CZ.banners.filter(b => b.owned && !b.default); const lockedB = CZ.banners.find(b => !b.owned);
  ok(CZ.totals.banners >= 30 && CZ.totals.frames >= 15 && CZ.totals.titles >= 30, `cosmetic catalog: ${CZ.totals.banners} banners, ${CZ.totals.frames} frames, ${CZ.totals.titles} titles`);
  ok(ownedB.length >= 1, 'C owns at least one unlocked banner', CZ.banners.filter(b => b.owned).map(b => b.id));
  r = await C('/api/me/cosmetics', { body: { banner: lockedB.id } }); ok(r.status === 403, 'equipping a locked banner is refused (403)');
  r = await C('/api/me/cosmetics', { body: { banner: ownedB[0].id } }); ok(r.body.ok && r.body.cos.banner === ownedB[0].id, 'equip owned banner ' + ownedB[0].id);
  ok((r.body.unlocked || []).some(a => a.id === 'equip-banner'), 'equipping a banner unlocks "equip-banner"', r.body.unlocked);
  const ownedT = CZ.titles.find(t => t.owned && !t.default); if (ownedT) { r = await C('/api/me/cosmetics', { body: { title: ownedT.id } }); ok(r.body.ok, 'equip owned title ' + ownedT.id); }
  r = await anon('/api/leaderboard?game=plinko&limit=500'); const lrow = r.body.rows.find(x => x.username === uc);
  ok(lrow && lrow.cos && lrow.cos.banner === ownedB[0].id && lrow.cos.title, 'leaderboard row carries equipped banner + title', lrow && lrow.cos);
  r = await anon('/api/profile/' + uc); ok(r.body.profile.cos.banner === ownedB[0].id && r.body.profile.achievements.length >= 4, 'profile shows equipped banner + unlocked achievements');
  r = await anon('/cosmetics.css'); ok(r.status === 200 && String(r.body).includes('.bn-' + ownedB[0].id + '{'), 'cosmetics.css serves banner classes');
  r = await anon('/api/community'); const post = r.body.items[0];
  r = await C('/api/community/react', { body: { key: post.key } }); ok(r.body.ok && r.body.mine && r.body.hype >= 1, 'hype a community post');
  ok((r.body.unlocked || []).some(a => a.id === 'react-1'), 'first hype unlocks react-1');
  r = await C('/api/community/react', { body: { key: post.key } }); ok(r.body.ok && !r.body.mine, 'un-hype toggles off');

  console.log('# v3: 21+ date-of-birth check at signup');
  const D = client(); const ud = 'e2e_' + Math.random().toString(36).slice(2, 8);
  r = await D('/api/auth/signup', { body: { username: ud, password: 'hunter2hunter2', agree: true } }); ok(r.status === 400 && /date of birth/i.test(r.body.error), 'signup without a date of birth is rejected', r.body);
  const yng = new Date(); yng.setFullYear(yng.getFullYear() - 20);
  r = await D('/api/auth/signup', { body: { username: ud, password: 'hunter2hunter2', agree: true, dob: yng.toISOString().slice(0, 10) } }); ok(r.status === 403 && r.body.underage, 'under-21 signup rejected (403 underage)', r.body);

  console.log('# v3: XP levels, check-in streaks, daily quests, season');
  r = await C('/api/me'); const lv0 = r.body.user.level;
  ok(lv0 && lv0.level >= 1 && lv0.xp > 0 && lv0.need > 0 && r.body.user.ref_code, '/api/me has level/xp + ref code', r.body.user.level);
  r = await C('/api/checkin', { body: {} }); ok(r.body.ok && r.body.streak.fresh && r.body.streak.current === 1 && r.body.xp === 20, 'first daily check-in: 1-day streak, +20 XP', r.body.streak);
  r = await C('/api/checkin', { body: {} }); ok(r.body.ok && !r.body.streak.fresh && r.body.xp === 0, 'second check-in on the same day gives no XP');
  r = await C('/api/me'); ok(r.body.user.level.xp === lv0.xp + 20 && r.body.user.streak.checked_today, 'check-in XP counted toward level', [lv0.xp, r.body.user.level.xp]);
  r = await anon('/api/checkin', { body: {} }); ok(r.status === 401, 'guests cannot check in');
  r = await C('/api/quests'); const Q = r.body;
  ok(Q.quests.length === 3 && Q.quests.every(q => q.text && q.xp > 0 && q.n > 0) && Q.bonus && Q.resets_at > Date.now(), '3 daily quests + all-clear bonus, with reset time', Q.quests && Q.quests.map(q => q.text));
  r = await A('/api/quests'); ok(r.body.quests.map(q => q.text).join('|') === Q.quests.map(q => q.text).join('|'), 'everyone gets the same daily quests');
  const qDone = Q.quests.find(q => q.done), qOpen = Q.quests.find(q => !q.done);
  ok(!!qDone, 'C (8 runs today) has completed at least one quest', Q.quests.map(q => [q.text, q.value, q.n]));
  if (qDone) {
    r = await C(`/api/quests/${qDone.idx}/claim`, { body: {} }); ok(r.body.ok && r.body.xp === qDone.xp && r.body.quests[qDone.idx].claimed, `claim quest "${qDone.text}" (+${qDone.xp} XP)`, r.body);
    ok((r.body.unlocked || []).some(a => a.id === 'quest-1'), 'first claimed quest unlocks quest-1', r.body.unlocked);
    r = await C(`/api/quests/${qDone.idx}/claim`, { body: {} }); ok(r.status === 400, 'a quest cannot be claimed twice');
  }
  if (qOpen) { r = await C(`/api/quests/${qOpen.idx}/claim`, { body: {} }); ok(r.status === 400, 'an unfinished quest cannot be claimed'); }
  r = await C('/api/quests/3/claim', { body: {} }); ok(r.status === 400 || (r.body.ok && Q.quests.every(q => q.done)), 'bonus needs all 3 quests claimed first');
  r = await C('/api/season'); const SN = r.body.season;
  ok(SN.number >= 1 && SN.name && SN.track.length === 60 && SN.track.filter(t => t.item).length === 13 && SN.perks.length === 6 && SN.xp > 0 && SN.end_at > Date.now() && SN.length_days === 56, `season ${SN.number} "${SN.name}": 8-week season, 60-level free track (13 cosmetics, 6 perks), C has ${SN.xp} season XP`);
  ok(r.body.board.some(x => x.username === uc), 'C is on the season leaderboard');

  console.log('# v3: follows, friends leaderboard, notifications');
  r = await A('/api/follow/' + uc, { body: {} }); ok(r.body.ok && r.body.following && r.body.followers >= 1, 'A follows C');
  ok((r.body.unlocked || []).some(a => a.id === 'follow-1'), 'first follow unlocks follow-1', r.body.unlocked);
  r = await A('/api/follow/' + ua, { body: {} }); ok(r.status === 400, "can't follow yourself");
  r = await anon('/api/follow/' + uc, { body: {} }); ok(r.status === 401, 'guests cannot follow');
  r = await A('/api/follows/' + ua + '?type=following'); ok(r.body.users.some(u => u.username === uc), "A's following list has C");
  r = await anon('/api/follows/' + uc + '?type=followers'); ok(r.body.users.some(u => u.username === ua), "C's followers list has A (public)");
  r = await A('/api/profile/' + uc); ok(r.body.profile.i_follow === true && r.body.profile.followers >= 1 && r.body.profile.level && r.body.profile.level.level >= 1, 'profile shows follow state, follower count and level');
  r = await A('/api/me'); ok(r.body.user.following >= 1, '/api/me has following count');
  r = await A('/api/leaderboard?game=plinko&friends=1'); ok(r.body.rows.length >= 1 && r.body.rows.every(x => [ua, uc].includes(x.username)) && r.body.rows.some(x => x.username === uc), 'friends leaderboard = me + players I follow', r.body.rows && r.body.rows.map(x => x.username));
  r = await anon('/api/leaderboard?game=plinko&friends=1'); ok(r.status === 401, 'friends leaderboard needs sign-in');
  r = await A('/api/community?tab=following'); ok(r.body.ok && Array.isArray(r.body.items), 'community "following" tab works');
  r = await C('/api/notifications'); const nf = r.body.items.find(n => n.type === 'follow' && n.title.includes(ua));
  ok(nf && nf.unread && r.body.unread >= 1, 'C gets a "followed you" notification', r.body.items.slice(0, 3));
  r = await C('/api/notifications/read', { body: { id: nf && nf.id } }); ok(r.body.ok, 'mark one notification read');
  r = await C('/api/notifications'); ok(!r.body.items.find(n => n.id === (nf && nf.id)).unread, 'notification is now read');
  r = await C('/api/notifications/read', { body: {} }); ok(r.body.ok && r.body.unread === 0, 'mark all read -> 0 unread');
  r = await anon('/api/notifications'); ok(r.status === 401, 'notifications need sign-in');

  console.log('# v3: referrals (invite codes award cosmetics)');
  r = await C('/api/referral'); const code = r.body.code; ok(/^[A-Z0-9]{6}$/.test(code) && r.body.link === '/r/' + code && r.body.joined === 0, 'C has an invite code + link', r.body);
  const rr = await fetch(BASE + '/r/' + code, { redirect: 'manual' }); ok(rr.status === 302 && (rr.headers.get('location') || '').includes('ref=' + code), '/r/CODE redirects to signup with the code');
  r = await D('/api/auth/signup', { body: { username: ud, password: 'hunter2hunter2', agree: true, dob: '1990-05-05', ref: code.toLowerCase() } }); ok(r.body.ok && r.body.referred, 'D signs up with C\'s invite code', r.body);
  ok((r.body.unlocked || []).some(a => a.id === 'referred'), 'D unlocks "Newcomer" (joined with an invite)', r.body.unlocked);
  r = await C('/api/referral'); ok(r.body.joined === 1 && r.body.counted === 0 && r.body.friends[0].username === ud, 'C sees 1 invite joined, not counted until first run');
  r = await D('/api/run/start', { body: { game_id: 'jetpack-dash' } }); const tokD = r.body.token; await sleep(2200);
  r = await D('/api/score', { body: { token: tokD, score: 30, coins: 1, duration_ms: 2200 } });
  ok(r.body.ok && r.body.share_url === '/s/' + r.body.run_id && r.body.level && r.body.xp_gained >= 10, 'score response has share_url, level and xp_gained', r.body); const runD = r.body.run_id;
  r = await C('/api/referral'); ok(r.body.counted === 1, 'referral counts after the friend\'s first run');
  r = await C('/api/achievements'); ok(r.body.achievements.find(a => a.id === 'ref-1').unlocked, 'C unlocks ref-1 (Crew Builder cosmetics)');
  r = await C('/api/notifications'); ok(r.body.items.some(n => n.type === 'referral' && n.title.includes(ud)), 'C notified that the referral counted');

  console.log('# v3: share cards, OG images, page meta');
  r = await anon('/api/runs/' + runD); ok(r.body.ok && r.body.run.player.username === ud && r.body.run.score === 30 && r.body.run.score_text, 'public run card data', r.body.run);
  r = await D('/api/share', { body: { kind: 'run', ref: String(runD) } }); ok(r.body.ok && r.body.ref_code && (r.body.unlocked || []).some(a => a.id === 'share-1'), 'sharing a score card logs it + unlocks share-1', r.body);
  r = await D('/api/share', { body: { kind: 'nope' } }); ok(r.status === 400, 'share rejects unknown kinds');
  for (const p of ['/og/default.png', `/og/run/${runD}.png`, `/og/giveaway/${gmulti}.png`, `/og/u/${uc}.png`]) { const x = await fetch(BASE + p); const buf = Buffer.from(await x.arrayBuffer()); ok(x.status === 200 && x.headers.get('content-type') === 'image/png' && buf.slice(1, 4).toString() === 'PNG' && buf.length > 20000, `OG image ${p} (${Math.round(buf.length / 1024)} KB)`); }
  { const x = await fetch(BASE + '/og/run/99999999.png'); ok(x.status === 200 && x.headers.get('content-type') === 'image/png', 'unknown run falls back to the default OG image'); }
  r = await anon('/s/' + runD); ok(r.status === 200 && String(r.body).includes(`/og/run/${runD}.png`) && String(r.body).includes(ud) && /twitter:card" content="summary_large_image/.test(r.body), '/s/:id HTML has per-run OG + Twitter meta');
  r = await anon('/giveaways/' + gmulti); ok(String(r.body).includes('E2E Multi Giveaway') && String(r.body).includes(`/og/giveaway/${gmulti}.png`), 'giveaway page HTML has per-giveaway OG meta');
  r = await anon('/u/' + uc); ok(String(r.body).includes(`/og/u/${uc}.png`), 'profile page HTML has per-player OG image');
  r = await anon('/'); ok(/<meta name="author" content="Trap Tech Solutions">/.test(r.body) && /og:image" content="https?:\/\/[^"]+\/og\/default\.png/.test(r.body) && /rel="manifest"/.test(r.body), 'home HTML: Trap Tech author meta, absolute OG image, manifest link');

  console.log('# v3: search');
  r = await anon('/api/search?q=plinko'); ok(r.body.games.some(g => g.id === 'plinko'), 'search finds games');
  r = await anon('/api/search?q=' + uc); ok(r.body.players.some(u => u.username === uc), 'search finds players');
  r = await anon('/api/search?q=' + encodeURIComponent('E2E Multi')); ok(r.body.giveaways.some(g => g.id === gmulti), 'search finds giveaways');
  r = await anon('/api/search?q='); ok(r.body.ok && !r.body.games.length, 'empty search returns nothing');

  console.log('# v3: tournaments (timed + bracket)');
  const tStart = t1 - 60e3;
  r = await ADM('/api/admin/tournaments', { body: { title: 'E2E Timed Cup', game_id: 'plinko', format: 'timed', start_at: tStart, end_at: Date.now() + 3600e3, prize: 'Finalist title', description: 'e2e' } });
  ok(r.body.ok, 'admin creates a timed tournament'); const tid = r.body.id;
  r = await anon('/api/tournaments/' + tid); let T = r.body.tournament;
  ok(T.status === 'live' && T.format === 'timed' && T.board[0] && T.board[0].username === uc && T.board[0].score === 600, 'timed tournament is live; board ranks best score in the window', T.board && T.board.slice(0, 2));
  r = await C('/api/tournaments/' + tid); ok(r.body.tournament.me && r.body.tournament.me.rank === 1, 'tournament shows my rank');
  r = await A('/api/notifications'); ok(r.body.items.some(n => n.type === 'tournament' && n.link === '/tournaments/' + tid && n.broadcast), 'new tournament is broadcast to players');
  r = await anon('/api/tournaments'); ok(r.body.tournaments.some(t => t.id === tid), 'tournament list has the timed event');
  r = await ADM('/api/admin/tournaments', { body: { title: 'E2E Bracket', game_id: 'plinko', format: 'bracket', start_at: tStart, qual_end_at: Date.now() - 500, round_ms: 3600e3 } });
  ok(r.body.ok, 'admin creates a bracket tournament (qualifying just ended)'); const tbid = r.body.id;
  r = await anon('/api/tournaments/' + tbid); T = r.body.tournament;
  ok(T.status === 'quarterfinals' && T.bracket.rounds.length === 3 && T.bracket.rounds[0].matches.length === 4 && T.bracket.rounds.map(x => x.name).join() === 'Quarterfinals,Semifinals,Final' && T.bracket.rounds[1].matches.length === 2 && T.bracket.rounds[2].matches[0].tbd && T.bracket.rounds[0].state === 'live', 'bracket: 3 rounds (later rounds TBD), 4 quarterfinal matches', T.bracket && T.bracket.rounds.map(x => x.name));
  ok(T.bracket.seeds[0].username === uc && T.bracket.rounds[0].matches[0].a.username === uc && T.qualifying[0].username === uc, 'top qualifier is seed 1 in match 1');
  ok(T.end_at === T.qual_end_at + 3 * 3600e3, 'bracket end = qualifying end + 3 rounds');
  r = await ADM('/api/admin/tournaments', { body: { title: '', game_id: 'plinko', start_at: Date.now() } }); ok(r.status === 400, 'tournament needs a title');
  r = await ADM('/api/admin/tournaments', { body: { title: 'x', game_id: 'nope', start_at: Date.now(), end_at: Date.now() + 1 } }); ok(r.status === 400, 'tournament needs a valid game');
  r = await ADM('/api/admin/tournaments/' + tid, { method: 'PUT', body: { title: 'E2E Timed Cup Renamed', game_id: 'plinko', format: 'timed', start_at: tStart, end_at: Date.now() + 3600e3 } }); ok(r.body.ok, 'admin edits tournament');
  r = await ADM('/api/admin/tournaments'); ok(r.body.tournaments.some(t => t.id === tid && t.title === 'E2E Timed Cup Renamed'), 'admin tournament list reflects edit');
  r = await anon('/api/tournaments'); const demoBr = r.body.tournaments.find(t => t.demo && t.format === 'bracket');
  if (demoBr) { r = await anon('/api/tournaments/' + demoBr.id); const b = r.body.tournament.bracket; ok(b.rounds[0].state === 'done' && b.rounds[0].matches.filter(m => m.a && m.b).every(m => m.winner === 'a' || m.winner === 'b'), 'demo bracket: finished quarterfinals have winners'); }
  r = await C('/api/profile/' + uc); r = await C('/api/achievements'); ok(r.body.achievements.find(a => a.id === 'tourney-enter').unlocked, 'playing in a tournament window unlocks tourney-enter');
  r = await anon('/api/tournaments/99999'); ok(r.status === 404, 'unknown tournament 404');

  console.log('# v3: PWA + legal/about pages');
  r = await anon('/manifest.webmanifest'); const MF = typeof r.body === 'string' ? JSON.parse(r.body) : r.body;
  ok(/Trap Tech/.test(MF.name) && MF.display === 'standalone' && MF.start_url && MF.icons.some(i => i.sizes === '512x512') && MF.icons.some(i => (i.purpose || '').includes('maskable')), 'web app manifest: name, standalone, 192/512 + maskable icons');
  for (const ic of MF.icons) { const x = await fetch(BASE + ic.src); ok(x.status === 200, 'manifest icon ' + ic.src); }
  r = await anon('/sw.js'); ok(r.status === 200 && String(r.body).includes('gh-shell'), 'service worker served');
  for (const [p, t] of [['/terms', 'Terms of Service'], ['/privacy', 'Privacy Policy'], ['/rules', 'Official Giveaway Rules'], ['/responsible-play', 'Responsible Play'], ['/about', 'About Trap Tech Solutions'], ['/settings', 'Settings'], ['/quests', 'Daily Quests'], ['/season', 'Season'], ['/tournaments', 'Tournaments'], ['/notifications', 'Notifications'], ['/search', 'Search'], ['/invite', 'Invite']]) {
    r = await anon(p); ok(r.status === 200 && String(r.body).includes('<title>' + t) && String(r.body).includes('Trap Tech Solutions'), `GET ${p}: title "${t}" + Trap Tech meta`);
  }
  r = await anon(`/giveaways/${gmulti}/rules`); ok(r.status === 200 && /Official Rules/.test(r.body), 'per-giveaway official rules page');
  r = await anon('/js/app.js'); ok(/NO PURCHASE NECESSARY/.test(r.body) && /Trap Tech Solutions/.test(r.body) && /A Trap Tech game/.test(r.body), 'app bundle has no-purchase rules, Trap Tech operator + "A Trap Tech game" loader');

  // ======================= v5 =======================
  const DBP = require(path.join(__dirname, '..', 'src', 'config.js')).DB_PATH; const sdb = new (require('better-sqlite3'))(DBP);
  const play = async (cl, game, score, wait = 1200, extra = {}) => { let x; for (let k = 0; k < 6; k++) { x = await cl('/api/run/start', { body: { game_id: game } }); if (x.status !== 429) break; await sleep(12000); } if (!x.body.ok) return x; const tk = x.body.token; const seed = x.body.seed; if (wait) await sleep(wait); const body = { token: tk, score, coins: 0, duration_ms: wait, tel: { n: 12, mean: 310, sd: 95, min: 120 }, ...extra }; for (let k = 0; k < 6; k++) { x = await cl('/api/score', { body }); if (x.status !== 429 || x.body.rejected) break; await sleep(12000); } x.seed = seed; return x; };
  console.log('# v7: brands (one per player) + paid link placements');
  r = await anon('/api/brands'); ok(r.body.ok && Array.isArray(r.body.brands) && r.body.cooldown_days === 30, 'public brand list');
  for (const p of ['/api/channels', '/api/channels/terp-tavern', '/api/me/channels']) { r = await anon(p); ok(r.status === 404, `${p} removed`); }
  r = await ADM('/api/admin/channels', { body: { name: 'E2E Brand', slug: 'e2e-brand', link_url: 'https://example.com/brand', link_label: 'Shop' } }); ok(r.body.ok, 'admin creates a brand'); const chE = r.body.id;
  r = await ADM('/api/admin/channels', { body: { name: 'E2E Basic', slug: 'e2e-basic', link_url: 'https://example.com/basic' } }); const chB = r.body.id;
  r = await ADM('/api/admin/channels', { body: { name: 'Bad', link_url: 'http://insecure.example' } }); ok(r.status === 400, 'brand link must be https');
  r = await ADM('/api/admin/brands'); const invE = (r.body.brands.find(b => b.id === chE) || {}).invite_code; ok(/^[A-Z2-9]{8}$/.test(invE || ''), 'new brand gets an invite code');
  r = await C('/api/me/brand', { body: { code: invE, via: 'link' } }); ok(r.body.ok && r.body.brand.slug === 'e2e-brand', 'player joins the brand via its invite code');
  r = await C('/api/me/brand', { body: { code: 'e2e-basic' } }); ok(r.status === 400 && /30 days/.test(r.body.error), 'switching again within 30 days is refused');

  console.log('# v5: eligibility + explicit entries (anti-camping)');
  const t5 = Date.now();
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Brand Giveaway', host: 'E2E Brand', start_at: t5 - 60e3, end_at: t5 + 3600e3, game_id: 'high-score', active: true, placements: ['giveaway', 'game'], channel_id: chE, link_url: 'https://example.com/gw', link_label: 'Visit E2E',
    require_join: true, elig_min_runs7: 3, elig_account_age_days: 0, elig_max_active: 3, elig_win_cooldown_days: 30, elig_brand_month: true } });
  ok(r.body.ok, 'admin creates a channel giveaway with eligibility rules'); const gE = r.body.id;
  r = await anon(`/api/giveaways/${gE}/eligibility`); ok(r.body.require_join && r.body.rules.some(x => x.includes('members only')) && r.body.rules.some(x => x.includes('Win cooldown')) && r.body.rules.some(x => x.includes('Potato')), 'public eligibility rules in plain language');
  r = await D(`/api/giveaways/${gE}/eligibility`); const dAct = r.body.checks.find(c => c.id === 'activity');
  ok(!r.body.eligible && dAct && !dAct.ok && /Play \d more runs? to qualify/.test(dAct.hint) && r.body.checks.find(c => c.id === 'brand_member').ok === false, 'ineligible player sees exactly what to do ("Play N more runs", join the brand)', r.body.checks);
  r = await D(`/api/giveaways/${gE}/join`, { body: {} }); ok(r.status === 400 && r.body.status && !r.body.status.eligible, 'ineligible player cannot join');
  r = await A(`/api/giveaways/${gE}/eligibility`); ok(r.body.checks.some(c => c.id === 'cooldown' && !c.ok && /won recently/.test(c.hint)), 'recent winner is on win cooldown');
  for (let i = 0; i < 3; i++) await play(C, 'high-score', 5, 300);
  r = await C(`/api/giveaways/${gE}/eligibility`); ok(r.body.eligible && r.body.can_join && r.body.message.includes('Enter giveaway'), 'eligible player: "You\'re eligible - tap Enter giveaway"', r.body);
  r = await play(C, 'high-score', 20, 300); ok(r.body.ok && !(r.body.giveaways || []).some(g => g.id === gE), 'runs before joining do not count for a join-required giveaway');
  r = await C(`/api/giveaways/${gE}/join`, { body: {} }); ok(r.body.ok && r.body.status.joined, 'eligible player joins');
  r = await anon(`/api/giveaways/${gE}`); ok(r.body.giveaway.joined_count === 1 && r.body.giveaway.link && r.body.giveaway.link.url === `/go/g/${gE}?p=giveaway` && r.body.giveaway.channel.slug === 'e2e-brand' && r.body.giveaway.brand.slug === 'e2e-brand' && r.body.giveaway.open_to_all === false, 'giveaway shows entrants, brand (members only) and the paid sponsor link');
  let rr2 = await fetch(BASE + `/go/g/${gE}?p=giveaway`, { redirect: 'manual' }); ok(rr2.status === 302 && rr2.headers.get('location') === 'https://example.com/gw', '/go redirect sends to the sponsor URL');
  rr2 = await fetch(BASE + `/go/g/${gE}?p=announcement`, { redirect: 'manual' }); ok(rr2.status === 302 && rr2.headers.get('location') === '/', '/go refuses placements the sponsor did not pay for');
  r = await anon('/api/games/high-score/sponsor'); ok(r.body.sponsor && r.body.sponsor.giveaway_id === gE, 'game-page link placement shows the sponsor on the game page');
  r = await play(C, 'high-score', 25, 300); ok((r.body.giveaways || []).some(g => g.id === gE && g.rank === 1), 'after joining, runs count');
  const gMs = []; for (let i = 0; i < 3; i++) { r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Slot ' + i, host: 'T', start_at: t5 - 60e3, end_at: t5 + 3600e3, game_id: 'terp-tapper', active: true, require_join: true, elig_max_active: 3 } }); gMs.push(r.body.id); }
  r = await C(`/api/giveaways/${gMs[0]}/join`, { body: {} }); ok(r.body.ok, 'join 2nd live giveaway');
  r = await C(`/api/giveaways/${gMs[1]}/join`, { body: {} }); ok(r.body.ok, 'join 3rd live giveaway');
  r = await C(`/api/giveaways/${gMs[2]}/join`, { body: {} }); ok(r.status === 400 && /Leave one/.test(r.body.error), 'max 3 live entries: 4th join refused with a clear hint', r.body);
  r = await C('/api/me/entries'); ok(r.body.entries.length === 3 && r.body.max === 3, '/api/me/entries shows the 3 entries');
  r = await C(`/api/giveaways/${gMs[1]}/leave`, { body: {} }); ok(r.body.ok, 'leaving frees a slot');
  r = await C(`/api/giveaways/${gMs[2]}/join`, { body: {} }); ok(r.body.ok, 'now the other giveaway can be joined');

  console.log('# v5: Potato username (winner contact)');
  r = await D('/api/me/potato', { method: 'PUT', body: { potato: 'bad name!' } }); ok(r.status === 400, 'invalid Potato username rejected');
  r = await D('/api/me/potato', { method: 'PUT', body: { potato: '@e2e_potato_d' } }); ok(r.body.ok && r.body.potato === 'e2e_potato_d', 'Potato username saved (leading @ stripped)');
  r = await D('/api/me'); ok(r.body.user.potato === 'e2e_potato_d', '/api/me returns the Potato username');

  console.log('# v5: cooldown skip at lock + activity-weighted verifiable draw');
  const t6 = Date.now();
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Cooldown', host: 'T', start_at: t6 - 1000, end_at: t6 + 3600e3, game_id: 'brick-breaker', active: true, winner_count: 1, elig_win_cooldown_days: 30 } }); const gCD = r.body.id;
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Weighted', host: 'T', start_at: t6 - 1000, end_at: t6 + 3600e3, game_id: 'terp-tapper', active: true, win_method: 'random', winner_count: 1, weight_mode: 'activity' } }); const gW = r.body.id;
  await play(A, 'brick-breaker', 200, 1500); await play(D, 'brick-breaker', 100, 1500);
  for (let i = 0; i < 5; i++) await play(D, 'terp-tapper', 10 + i, 300); await play(C, 'terp-tapper', 50, 300);
  r = await ADM(`/api/admin/giveaways/${gCD}/finalize`, { method: 'POST' }); r = await ADM(`/api/admin/giveaways/${gW}/finalize`, { method: 'POST' }); ok(r.body.ok, 'admin ends both test giveaways and locks results');
  r = await anon(`/api/giveaways/${gCD}`); ok(r.body.giveaway.winners.length === 1 && r.body.giveaway.winners[0].username === ud, 'recent winner auto-skipped at lock; next place promoted', r.body.giveaway.winners);
  r = await ADM(`/api/admin/giveaways/${gCD}/audit`); ok(r.body.audit.some(a => a.action === 'ineligible_skipped' && a.username === ua), 'audit logs "ineligible_skipped" with the reason');
  r = await anon(`/api/giveaways/${gW}/verify`); const vw = r.body;
  const wOf = (l) => { const m = l.match(/\|w(\d+)$/); return m ? +m[1] : 1; };
  const word = vw.entrant_lines.map(l => [-Math.log((parseInt(crypto.createHmac('sha256', vw.seed).update(`${vw.entrants_hash}:${l.split('|')[1]}`).digest('hex').slice(0, 13), 16) + 1) / (2 ** 52 + 1)) / wOf(l), l.split('|')[1]]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  ok(vw.weighted && vw.weight_rule && vw.draw_order.find(x => x.username === ud).weight === 2 && vw.draw_order.find(x => x.username === uc).weight === 1, 'weights: D (5 runs) has 2 entries, C (1 run) has 1', vw.draw_order);
  ok(vw.hash_ok && vw.seed_ok && word.join() === vw.draw_order.map(x => x.username).join(), 'weighted draw order recomputes independently from the revealed seed');

  console.log('# v5: friend challenges (play together, no messaging)');
  r = await C('/api/challenges', { body: { to: ud, game_id: 'high-score' } }); ok(r.status === 403, 'challenges need mutual follows (friends)');
  await C('/api/follow/' + ud, { body: {} }); await D('/api/follow/' + uc, { body: {} });
  r = await D('/api/challenges', { body: { to: uc, game_id: 'drift-rush' } }); ok(r.status === 400 && /Finish a run/.test(r.body.error), 'challenger needs a run in that game (their best is the target)');
  r = await C('/api/challenges', { body: { to: ud, game_id: 'high-score' } }); const chT = r.body.target_score; ok(r.body.ok && chT >= 25, 'friend challenge created with C\'s best as target', r.body); const chId = r.body.id;
  r = await C('/api/challenges', { body: { to: ud, game_id: 'high-score' } }); ok(r.status === 409, 'one open challenge per friend per game');
  r = await D('/api/challenges'); ok(r.body.incoming.some(c => c.id === chId && c.target_score === chT) && r.body.friends.includes(uc), 'D sees the incoming challenge');
  r = await D('/api/notifications'); ok(r.body.items.some(n => n.type === 'challenge'), 'D notified of the challenge');
  r = await D(`/api/challenges/${chId}/accept`, { body: {} }); ok(r.body.ok && r.body.status === 'accepted', 'D accepts');
  r = await play(D, 'high-score', chT + 10, 1500);
  r = await D('/api/challenges'); const done = r.body.history.find(c => c.id === chId); ok(done && done.status === 'completed' && done.won === true && done.result_score === chT + 10, 'beating the target completes the challenge (D wins)', r.body);
  r = await anon('/api/messages'); ok(r.status === 404, 'no user-to-user messaging endpoint exists');
  r = await anon('/api/dm'); ok(r.status === 404, 'no DM endpoint exists');

  console.log('# v5: profanity + staff-name filter at signup');
  r = await anon('/api/auth/signup', { body: { username: 'TrapTech_Official', password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.status === 400, 'staff-like username refused');

  console.log('# v5: Hub Points + cosmetics shop');
  r = await D('/api/shop'); ok(r.body.ok && r.body.balance > 0 && r.body.daily.length === 6 && r.body.weekly.length === 4 && /no cash value/.test(r.body.disclaimer), 'shop: balance from play, 6 daily + 4 weekly items, cosmetic-only disclaimer', { bal: r.body.balance });
  const shop = r.body; const pricey = shop.weekly.find(i => i.price > shop.balance);
  if (pricey) { r = await D('/api/shop/buy', { body: { item: pricey.id } }); ok(r.status === 400 && /more Hub Points/.test(r.body.error), 'cannot buy without enough points'); }
  const notIn = require(path.join(__dirname, '..', 'src', 'shop.js')).ITEMS.find(i => ![...shop.daily, ...shop.weekly].some(x => x.id === i.id));
  r = await D('/api/shop/buy', { body: { item: notIn.id } }); ok(r.status === 400 && /not in the shop/.test(r.body.error), 'only rotating items can be bought');
  const dId = sdb.prepare('SELECT id FROM users WHERE username=?').get(ud).id; sdb.prepare("INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?, 5000, 'e2e', 'grant', ?)").run(dId, Date.now());
  const color = [...shop.daily, ...shop.weekly].find(i => i.type !== 'badge') || shop.daily[0];
  r = await D('/api/shop/buy', { body: { item: color.id } }); ok(r.body.ok && r.body.item.owned && r.body.balance === shop.balance + 5000 - color.price, 'buying deducts exactly the price', r.body);
  r = await D('/api/shop/buy', { body: { item: color.id } }); ok(r.status === 400 && /already own/.test(r.body.error), 'cannot buy twice');
  r = await D('/api/cosmetics'); const t2 = { banner: 'banners', frame: 'frames', title: 'titles', color: 'colors', effect: 'effects', badge: 'badges' }[color.type];
  ok((r.body[t2] || []).some(x => (x.id === color.id || x.id === 'shop:' + color.id) && x.owned), 'purchased item shows as owned in cosmetics');
  r = await D('/api/me/cosmetics', { body: { [color.type]: color.type === 'badge' ? 'shop:' + color.id : color.id } }); ok(r.body.ok, 'purchased item can be equipped');
  const unownedColor = require(path.join(__dirname, '..', 'src', 'shop.js')).ITEMS.find(i => i.type === 'color' && i.id !== color.id);
  r = await D('/api/me/cosmetics', { body: { color: unownedColor.id } }); ok(r.status === 403, 'unowned shop items cannot be equipped');
  r = await D('/api/me/points'); ok(r.body.history.some(h => h.reason === 'purchase') && r.body.history.some(h => h.reason === 'run'), 'points history shows earn + spend');

  console.log('# v5: achievements overhaul + admin-only badges');
  r = await anon('/api/achievements?user=' + ud); const achs = r.body.achievements || [];
  ok(achs.filter(a => a.tier === 'legendary').length >= 5 && achs.some(a => a.id === 'leg-top1') && achs.some(a => a.id === 'leg-streak-100'), 'legendary (very hard) achievements exist');
  { const vis = achs.filter(a => a.name !== 'Secret achievement'); ok(new Set(vis.map(a => a.name)).size === vis.length && !achs.some(a => /^Level \d+$/.test(a.name)), 'achievement names are unique (no generic "Level 5")'); }
  ok(achs.find(a => a.id === 'ref-1').name === 'Crew Builder' && achs.find(a => a.id === 'ref-5').name === 'Squad Goals', 'referral badges renamed (Crew Builder, Squad Goals)');
  r = await anon('/badges/leg-top1.svg'); ok(r.status === 200 && r.ct.includes('svg') && String(r.body).includes('<path'), 'unique badge art served as SVG');
  const a1 = (await anon('/badges/runs-10.svg')).body, a2 = (await anon('/badges/runs-50.svg')).body; ok(a1 !== a2, 'each badge has different art');
  r = await anon(AP + '/api/badges'); ok(r.status === 401, 'badge admin needs admin login');
  r = await D('/api/me/cosmetics', { body: { badge: 'adm:staff' } }); ok(r.status === 403, 'players cannot equip admin badges they were not granted');
  r = await ADM('/api/admin/badges/grant', { body: { username: ud, badge: 'verified-host', note: 'E2E grant' } }); ok(r.body.ok, 'admin grants "Verified Host"');
  r = await ADM('/api/admin/badges/grant', { body: { username: ud, badge: 'verified-host' } }); ok(r.status === 409, 'double grant refused');
  r = await ADM('/api/admin/badges/grant', { body: { username: ud, badge: 'not-a-badge' } }); ok(r.status === 400, 'unknown badge refused');
  r = await anon(`/api/users/${ud}/special-badges`); ok(r.body.granted.some(b => b.id === 'verified-host') && r.body.all.length >= 8, 'special badges listed on the profile');
  r = await D('/api/me/cosmetics', { body: { badge: 'adm:verified-host' } }); ok(r.body.ok && r.body.cos.badge && r.body.cos.badge.tier === 'admin', 'granted badge can be equipped (admin tier styling)');
  r = await anon(`/api/giveaways/${gshort}`);
  r = await ADM('/api/admin/badges'); ok(r.body.audit.some(a => a.username === ud && a.action === 'grant') && r.body.grants.some(g => g.username === ua && g.badge_id === 'giveaway-winner'), 'audit log + confirmed winner auto-received "Giveaway Winner"');
  r = await ADM('/api/admin/badges/revoke', { body: { username: ud, badge: 'verified-host', note: 'E2E revoke' } }); ok(r.body.ok, 'admin revokes');
  r = await D('/api/me'); ok(!r.body.user.cos.badge, 'revoked badge is unequipped');

  console.log('# v5: anti-cheat (keep great legit scores, catch cheaters)');
  r = await D('/api/run/start', { body: { game_id: 'memory-match' } }); const mmTok = r.body.token, mmSeed = r.body.seed; ok(/^[0-9a-f]{16}$/.test(mmSeed), 'run/start issues a server seed');
  const AC = require(path.join(__dirname, '..', 'src', 'anticheat.js')); const deal = AC.mmLevel(0, AC.rng(mmSeed)); const pos = {}; deal.forEach((g, i) => (pos[g] = pos[g] || []).push(i));
  const log = []; let tt = 600; for (const g in pos) { log.push([tt, pos[g][0]]); tt += 350; log.push([tt, pos[g][1]]); tt += 350; }
  const legit = AC.replayMemory(mmSeed, log).score; await sleep(5000);
  r = await D('/api/score', { body: { token: mmTok, score: legit, coins: 1, duration_ms: 5000, log, tel: { n: 12, mean: 350, sd: 60, min: 200 } } });
  ok(r.body.ok && r.body.verified && !r.body.held, 'perfect Memory Match run is replay-verified and counts', r.body);
  r = await D('/api/run/start', { body: { game_id: 'memory-match' } }); const mmTok2 = r.body.token; await sleep(5000);
  r = await D('/api/score', { body: { token: mmTok2, score: legit + 2000, coins: 1, duration_ms: 5000, log, tel: { n: 12, mean: 350, sd: 60, min: 200 } } });
  ok(r.body.ok && r.body.held && !r.body.verified && /fair-play review/.test(r.body.held_reason), 'tampered Memory Match score (log replays differently) is kept but held', r.body); const heldRun = r.body.run_id;
  r = await play(C, 'terp-tapper', 30, 1500, { tel: { n: 60, mean: 100, sd: 1, min: 99 } }); ok(r.body.ok && r.body.held, 'robotic input rhythm (bot) is held for review');
  r = await play(D, 'terp-tapper', 30, 1500); ok(r.body.ok && !r.body.held, 'human-like input rhythm counts normally');
  r = await anon('/api/leaderboard?game=memory-match&period=all&limit=500'); const lbRows = r.body.rows || r.body.leaderboard || r.body.entries || [];
  ok(lbRows.length > 0 && lbRows.some(x => x.username === ud && x.score === legit) && !lbRows.some(x => x.username === ud && x.score === legit + 2000), 'held runs are hidden from leaderboards (verified run shows)', lbRows.filter(x => x.username === ud));
  r = await ADM('/api/admin/flags?status=open'); ok(r.body.flags.some(f => f.run_id === heldRun && f.reasons.some(x => x.code === 'replay_mismatch')), 'admin fair-play queue lists the held run with reasons');
  r = await ADM(`/api/admin/flags/${heldRun}/clear`, { body: { note: 'E2E clear' } }); ok(r.body.ok, 'admin clears a held run');
  r = await D('/api/notifications'); ok(r.body.items.some(n => n.title === 'Your score was verified'), 'player notified when cleared');
  r = await ADM('/api/admin/flags?status=cleared'); ok(r.body.flags.some(f => f.run_id === heldRun), 'cleared run moves to the cleared list');
  r = await ADM('/api/admin/players?q=' + uc); ok(!r.body.players[0].banned, 'anti-cheat never auto-bans');
  for (const id of [gE, gCD, gW, ...gMs]) await ADM('/api/admin/giveaways/' + id, { method: 'DELETE' });
  for (const id of [chE, chB]) await ADM('/api/admin/channels/' + id, { method: 'DELETE' });

  console.log('# rate limiting');
  let got429 = false; for (let i = 0; i < 22; i++) { r = await B('/api/run/start', { body: { game_id: 'jetpack-dash' } }); if (r.status === 429) { got429 = true; break; } }
  ok(got429, 'run/start rate limited (20/min per player)');

  console.log('# static pages');
  for (const p of ['/', '/leaderboard', '/giveaways', '/games/jetpack-dash']) { r = await anon(p); ok(r.status === 200 && String(r.body).includes('<!doctype html>'), `GET ${p} serves HTML`); }
  r = await anon('/js/jetpack.js'); ok(r.status === 200 && String(r.body).includes('class JetpackDash'), 'game JS served');
  for (const p of ['/achievements', '/sponsor', '/join/ABCDEFGH', '/games/plinko', '/play/terp-tapper']) { r = await anon(p); ok(r.status === 200, `GET ${p} serves HTML`); }
  r = await anon('/assets/cards/jetpack-dash.webp'); ok(r.status === 200, 'card art served');

  if (!process.env.KEEP) {
    console.log('# cleanup');
    for (const id of [gid, gshort, gmulti, gmin, grand]) await ADM('/api/admin/giveaways/' + id, { method: 'DELETE' });
    for (const id of [tid, tbid]) await ADM('/api/admin/tournaments/' + id, { method: 'DELETE' });
    for (const id of [bid, bid2, bid3, bid4]) await ADM('/api/admin/bookings/' + id, { method: 'DELETE' });
    const pl = await ADM('/api/admin/players?q=e2e_'); for (const p of pl.body.players) await ADM('/api/admin/players/' + p.id, { method: 'DELETE' });
    console.log('  removed test giveaways, booking and', pl.body.players.length, 'test players');
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

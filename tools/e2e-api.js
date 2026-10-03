// End-to-end API test. Usage: BASE=https://xxx.trycloudflare.com node tools/e2e-api.js
// Creates temporary test users/giveaways/bookings and deletes them at the end.
const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8787';
const ENV_FILE = path.join(__dirname, '..', '.env');
const env = { ...(fs.existsSync(ENV_FILE) ? Object.fromEntries(fs.readFileSync(ENV_FILE, 'utf8').split('\n').filter(Boolean).map(l => l.split(/=(.*)/s).slice(0, 2))) : {}), ...(process.env.ADMIN_PASSWORD ? { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD } : {}) };
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
  const A = client(), B = client(), ADM = client(), anon = client();
  const ua = 'e2e_' + Math.random().toString(36).slice(2, 8), ub = 'e2e_' + Math.random().toString(36).slice(2, 8);
  console.log('# accounts');
  let r = await A('/api/auth/signup', { body: { username: 'bad name', password: 'x', agree: true } }); ok(r.status === 400, 'signup rejects invalid username');
  r = await A('/api/auth/signup', { body: { username: ua, password: 'hunter2hunter2', agree: true } }); ok(r.body.ok, 'signup A ' + ua, r.body);
  r = await A('/api/auth/signup', { body: { username: ua.toUpperCase(), password: 'hunter2hunter2', agree: true } }); ok(r.status === 409, 'duplicate username (case-insensitive) rejected');
  r = await B('/api/auth/signup', { body: { username: ub, password: 'hunter2hunter2', agree: true } }); ok(r.body.ok, 'signup B ' + ub);
  r = await anon('/api/auth/signin', { body: { username: ua, password: 'wrongpass' } }); ok(r.status === 401, 'signin wrong password rejected');
  const A2 = client(); r = await A2('/api/auth/signin', { body: { username: ua, password: 'hunter2hunter2' } }); ok(r.body.ok, 'signin A works');
  r = await A2('/api/me'); ok(r.body.user && r.body.user.username === ua, '/api/me returns signed-in user');
  r = await anon('/api/run/start', { body: { game_id: 'jetpack-dash' } }); ok(r.status === 401, 'guest cannot start a scored run');

  console.log('# admin + giveaway');
  r = await ADM('/api/admin/stats'); ok(r.status === 401, 'admin API requires login');
  r = await ADM('/api/admin/login', { body: { password: 'nope' } }); ok(r.status === 401, 'wrong admin password rejected');
  r = await ADM('/api/admin/login', { body: { password: env.ADMIN_PASSWORD } }); ok(r.body.ok, 'admin login');
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
  r = await B('/api/run/start', { body: { game_id: 'drift-rush' } }); ok(r.status === 400, 'non-playable game cannot be started');
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
  r = await anon('/api/admin/export/runs.csv'); ok(r.status === 401, 'CSV export requires admin');

  console.log('# profile, booking, community');
  r = await anon('/api/profile/' + ua); ok(r.body.ok && r.body.profile.games_played === 2 && r.body.profile.total_score === 80 && r.body.profile.giveaways_won >= 1, 'profile stats (2 runs, total 80, won>=1)', r.body.profile);
  r = await anon('/api/bookings', { body: { brand: 'E2E Brand', contact: 'e2e@example.com', event_type: 'Giveaway', package: 'premium', start_date: '2026-11-01', end_date: '2026-11-14', details: 'test booking' } }); ok(r.body.ok, 'booking submitted'); const bid = r.body.id;
  r = await anon('/api/bookings', { body: { brand: '', contact: '' } }); ok(r.status === 400, 'booking without brand rejected');
  r = await ADM('/api/admin/bookings'); ok(r.body.bookings.some(b => b.id === bid && b.brand === 'E2E Brand'), 'booking visible to admin');
  r = await ADM('/api/admin/bookings/' + bid, { method: 'PUT', body: { status: 'approved', admin_note: 'ok' } }); ok(r.body.ok, 'admin updates booking status');
  r = await ADM('/api/admin/players?q=e2e_'); ok(r.body.players.some(p => p.username === ua), 'admin players list');
  r = await anon('/api/community?tab=winners'); ok(r.body.items.some(i => i.title.includes('E2E Test Giveaway')), 'community feed shows winner');

  console.log('# rate limiting');
  let got429 = false; for (let i = 0; i < 22; i++) { r = await B('/api/run/start', { body: { game_id: 'jetpack-dash' } }); if (r.status === 429) { got429 = true; break; } }
  ok(got429, 'run/start rate limited (20/min per player)');

  console.log('# static pages');
  for (const p of ['/', '/leaderboard', '/giveaways', '/games/jetpack-dash', '/admin']) { r = await anon(p); ok(r.status === 200 && String(r.body).includes('<!doctype html>'), `GET ${p} serves HTML`); }
  r = await anon('/js/jetpack.js'); ok(r.status === 200 && String(r.body).includes('class JetpackDash'), 'game JS served');
  r = await anon('/assets/cards/jetpack-dash.webp'); ok(r.status === 200, 'card art served');

  if (!process.env.KEEP) {
    console.log('# cleanup');
    for (const id of [gid, gshort]) await ADM('/api/admin/giveaways/' + id, { method: 'DELETE' });
    await ADM('/api/admin/bookings/' + bid, { method: 'DELETE' });
    const pl = await ADM('/api/admin/players?q=e2e_'); for (const p of pl.body.players) await ADM('/api/admin/players/' + p.id, { method: 'DELETE' });
    console.log('  removed test giveaways, booking and', pl.body.players.length, 'test players');
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

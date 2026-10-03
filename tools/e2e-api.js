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
  ok((r.body.unlocked || []).some(a => a.id === 'welcome'), 'signup unlocks the "welcome" achievement (server-side)', r.body.unlocked);
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
  r = await anon('/api/admin/export/runs.csv'); ok(r.status === 401, 'CSV export requires admin');

  console.log('# profile, booking, community');
  r = await anon('/api/profile/' + ua); ok(r.body.ok && r.body.profile.games_played === 2 && r.body.profile.total_score === 80 && r.body.profile.giveaways_won >= 1, 'profile stats (2 runs, total 80, won>=1)', r.body.profile);
  r = await anon('/api/bookings', { body: { brand: 'E2E Brand', contact: 'e2e@example.com', event_type: 'Giveaway', package: 'premium', start_date: '2026-11-01', end_date: '2026-11-14', details: 'test booking' } }); ok(r.body.ok, 'booking submitted'); const bid = r.body.id;
  r = await anon('/api/bookings', { body: { brand: '', contact: '' } }); ok(r.status === 400, 'booking without brand rejected');
  r = await ADM('/api/admin/bookings'); ok(r.body.bookings.some(b => b.id === bid && b.brand === 'E2E Brand'), 'booking visible to admin');
  r = await ADM('/api/admin/bookings/' + bid, { method: 'PUT', body: { status: 'approved', admin_note: 'ok' } }); ok(r.body.ok, 'admin updates booking status');
  r = await ADM('/api/admin/players?q=e2e_'); ok(r.body.players.some(p => p.username === ua), 'admin players list');
  r = await anon('/api/community?tab=winners'); ok(r.body.items.some(i => i.title.includes('E2E Test Giveaway')), 'community feed shows winner');


  console.log('# v2: all games playable with per-game anti-cheat');
  const C = client(); const uc = 'e2e_' + Math.random().toString(36).slice(2, 8);
  r = await C('/api/auth/signup', { body: { username: uc, password: 'hunter2hunter2', agree: true } }); ok(r.body.ok, 'signup C (game runner) ' + uc);
  r = await anon('/api/games'); const GAMES = r.body.games;
  ok(GAMES.length === 8 && GAMES.every(g => g.playable && g.module && g.ac && g.tiers), 'all 8 games are playable with module + caps + tiers', GAMES.map(g => g.id));
  for (const g of GAMES) { const js = await anon('/js/' + g.module); ok(js.status === 200 && String(js.body).includes('class ' + g.cls), `game module served: ${g.module}`); }
  // multi-game + min-score giveaways created BEFORE C plays
  const t1 = Date.now();
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Multi Giveaway', host: 'E2E Brand', start_at: t1 - 60e3, end_at: t1 + 3600e3, game_ids: ['plinko', 'memory-match'], tier: 'premium', brand_color: '#22d3ee', featured: true, min_score: 0, prize_tiers: '1st - test\nRandom - test', active: true } });
  ok(r.body.ok, 'admin creates multi-game giveaway (plinko + memory-match)', r.body); const gmulti = r.body.id;
  r = await ADM('/api/admin/giveaways', { body: { title: 'E2E MinScore Giveaway', host: 'E2E', start_at: t1 - 60e3, end_at: t1 + 3600e3, game_ids: ['terp-tapper'], min_score: 1000, active: true } });
  ok(r.body.ok, 'admin creates min-score giveaway (terp-tapper, 1000+)'); const gmin = r.body.id;
  r = await anon('/api/giveaways/' + gmulti); ok(r.body.giveaway.game_ids.join() === 'plinko,memory-match' && r.body.giveaway.tier === 'premium' && r.body.giveaway.prize_tiers.length === 2 && r.body.giveaway.featured, 'public giveaway exposes game_ids, tier, prize tiers, featured', r.body.giveaway);
  const PLAUS = { 'jetpack-dash': 50, 'drift-rush': 300, plinko: 600, 'spin-to-win': 800, 'memory-match': 400, 'high-score': 250, 'blazed-roulette': 1150, 'terp-tapper': 600 };
  const toks = {};
  for (const g of GAMES) { r = await C('/api/run/start', { body: { game_id: g.id } }); ok(r.body.ok, `run/start ${g.id}`); toks[g.id] = r.body.token; }
  r = await C('/api/run/start', { body: { game_id: 'plinko' } }); const tokPl = r.body.token;
  r = await C('/api/run/start', { body: { game_id: 'blazed-roulette' } }); const tokRo = r.body.token;
  await sleep(2600);
  let allUnlocked = [];
  for (const g of GAMES) {
    r = await C('/api/score', { body: { token: toks[g.id], score: PLAUS[g.id], coins: 1, duration_ms: 2500, giveaway_id: g.id === 'terp-tapper' ? gmin : undefined } });
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
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'plinko', linked: false } }); ok(r.body.ok && !r.body.game_ids.includes('plinko'), 'one-click unlink plinko');
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'memory-match', linked: false } }); ok(r.body.ok, 'unlink memory-match');
  r = await ADM(`/api/admin/giveaways/${gmulti}/games`, { body: { game_id: 'high-score', linked: false } }); ok(r.status === 400, 'cannot unlink the last game of a giveaway');
  r = await ADM(`/api/admin/giveaways/${gmulti}`); ok(r.body.giveaway.game_ids.join() === 'high-score' && r.body.stats && r.body.stats.plays >= 1, 'admin giveaway detail has game_ids + live stats', r.body.stats);

  console.log('# v2: packages + booking with tier');
  r = await anon('/api/packages'); const PK = r.body;
  ok(PK.tiers.map(t => t.id).join() === 'basic,premium,elite' && PK.tiers.every(t => t.price && t.features.length >= 5 && t.who), 'packages: 3 tiers with price, who-for and features');
  ok(PK.compare.length >= 10 && PK.faq.length >= 5, `packages: comparison table (${PK.compare.length} rows) + FAQ (${PK.faq.length})`);
  const adm0 = (await ADM('/api/admin/packages')).body; const orig = { tiers: adm0.tiers, compare: adm0.compare, faq: adm0.faq };
  const wasDefault = JSON.stringify(orig) === JSON.stringify(adm0.defaults);
  const edited = JSON.parse(JSON.stringify(orig)); edited.tiers[1].price = '$175'; edited.tiers[1].features.push('E2E extra feature');
  r = await ADM('/api/admin/packages', { method: 'PUT', body: edited }); ok(r.body.ok, 'admin edits Premium price + features');
  r = await anon('/api/packages'); ok(r.body.tiers[1].price === '$175' && r.body.tiers[1].features.includes('E2E extra feature'), 'edited price/features are live on /api/packages');
  r = await anon('/api/bookings', { body: { brand: 'E2E Brand Tier', contact: 'e2e@example.com', package: 'premium' } }); ok(r.body.ok && r.body.package === 'premium' && r.body.package_snapshot.includes('$175'), 'booking carries chosen tier + price snapshot', r.body); const bid2 = r.body.id;
  r = await anon('/api/bookings', { body: { brand: 'E2E Brand Tier', contact: 'e2e@example.com', package: 'elite' } }); ok(r.body.package === 'elite' && /Elite/.test(r.body.package_snapshot), 'elite booking snapshot', r.body.package_snapshot); const bid3 = r.body.id;
  r = await ADM('/api/admin/packages', { method: 'PUT', body: { tiers: [{ name: 'x' }] } }); ok(r.status === 400, 'packages need exactly 3 tiers');
  if (wasDefault) await ADM('/api/admin/packages/reset', { body: {} }); else await ADM('/api/admin/packages', { method: 'PUT', body: orig });
  r = await anon('/api/packages'); ok(r.body.tiers[1].price === orig.tiers[1].price, 'packages restored after test');
  r = await ADM('/api/admin/bookings'); ok(r.body.bookings.some(b => b.id === bid2 && b.package_snapshot.includes('Premium')), 'admin sees booking package snapshot');

  console.log('# v2: achievements + cosmetics');
  r = await C('/api/achievements'); const AL = r.body.achievements;
  ok(AL.length >= 60 && AL.length <= 100, `achievement catalog size ${AL.length}`);
  ok(AL.find(a => a.id === 'first-run').unlocked && AL.every(a => typeof a.rarity_pct === 'number' && a.rarity), 'achievements list has unlocked state + rarity');
  ok(AL.filter(a => a.hidden && !a.unlocked).every(a => a.name === 'Secret achievement'), 'secret achievements stay hidden until unlocked');
  const pg = AL.find(a => a.id === 'plinko-bronze'); ok(pg.progress === 600 && pg.target === 900, 'progress is reported (plinko 600/900)', pg);
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

  console.log('# rate limiting');
  let got429 = false; for (let i = 0; i < 22; i++) { r = await B('/api/run/start', { body: { game_id: 'jetpack-dash' } }); if (r.status === 429) { got429 = true; break; } }
  ok(got429, 'run/start rate limited (20/min per player)');

  console.log('# static pages');
  for (const p of ['/', '/leaderboard', '/giveaways', '/games/jetpack-dash', '/admin']) { r = await anon(p); ok(r.status === 200 && String(r.body).includes('<!doctype html>'), `GET ${p} serves HTML`); }
  r = await anon('/js/jetpack.js'); ok(r.status === 200 && String(r.body).includes('class JetpackDash'), 'game JS served');
  for (const p of ['/achievements', '/host', '/games/plinko', '/play/terp-tapper']) { r = await anon(p); ok(r.status === 200, `GET ${p} serves HTML`); }
  r = await anon('/assets/cards/jetpack-dash.webp'); ok(r.status === 200, 'card art served');

  if (!process.env.KEEP) {
    console.log('# cleanup');
    for (const id of [gid, gshort, gmulti, gmin]) await ADM('/api/admin/giveaways/' + id, { method: 'DELETE' });
    for (const id of [bid, bid2, bid3]) await ADM('/api/admin/bookings/' + id, { method: 'DELETE' });
    const pl = await ADM('/api/admin/players?q=e2e_'); for (const p of pl.body.players) await ADM('/api/admin/players/' + p.id, { method: 'DELETE' });
    console.log('  removed test giveaways, booking and', pl.body.players.length, 'test players');
  }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

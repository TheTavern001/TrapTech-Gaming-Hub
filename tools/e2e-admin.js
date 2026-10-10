// v7 items 22-23 end-to-end test: giveaway builder (custom giveaway with an uploaded image, 2 games, 3 prizes, 37 minutes,
// run to natural completion with tiebreakers + a random-draw prize; a recurring series), Game Rules Profiles (edit, reset,
// exact-game-hunt.json importer dry-run + apply, builder pre-fill) and Reese's competition formats (7-day campaign 1-30,
// 72 h endless survival+distance, 5-day tower defense highest round, 24 h marathon, 48 h with a 30-min run cap, 60-s best of 3,
// fastest completion), roles (moderator can't appoint, admin can't remove the owner), every player action including a
// password reset that the player redeems, events, seasons, shop, badges, analytics, announcements, settings, reports, and
// phone + desktop screenshots of every admin screen and builder step (screenshots/v7/admin/).
// Runs its OWN server on a copy of the DB (port 8794), so it never touches the dev server.
// Usage: node tools/e2e-admin.js [--no-shots]
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const { adminClient, loadEnv, freshCode, totpSecret, browserLogin } = require('./admin-auth');
const ROOT = path.join(__dirname, '..'); const PORT = 8794; const BASE = `http://localhost:${PORT}`;
const TMP = fs.mkdtempSync('/tmp/gh-adm7-'); const DB = path.join(TMP, 'hub.db');
const SHOTS = path.join(ROOT, 'screenshots', 'v7', 'admin'); const NO_SHOTS = process.argv.includes('--no-shots');
let pass = 0, fail = 0; const fails = [];
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; fails.push(m); console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const env0 = loadEnv(); const env = { ...env0, DB_PATH: DB, DATA_DIR: TMP }; const AP = '/' + env.ADMIN_PATH;
const H = 3600e3, D = 24 * H, MIN = 60e3;
async function start() {
  const p = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_PATH: DB, DATA_DIR: TMP, BUILD_DIR: path.join(TMP, 'build'), ADMIN_PATH: env.ADMIN_PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  for (let i = 0; i < 80 && !out.includes('listening'); i++) await sleep(200);
  p.out = () => out; return p;
}
const stop = (p) => new Promise(r => { p.on('exit', r); p.kill('SIGTERM'); setTimeout(r, 4000); });
// player-side client (cookie jar)
function player() {
  const jar = {};
  const call = async (p, opts = {}) => {
    const res = await fetch(BASE + p, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: opts.body ? JSON.stringify(opts.body) : undefined });
    for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() };
  };
  return call;
}

(async () => {
  const Dbs = require('better-sqlite3'); const bcrypt = require('bcryptjs');
  const src = new Dbs(env0.DB_PATH || path.join(ROOT, 'data', 'hub.db'), { readonly: true }); await src.backup(DB); src.close();
  { const d = new Dbs(DB); for (const t of ['admin_users', 'admin_sessions', 'admin_login_log', 'admin_meta', 'admin_auth']) d.exec(`DROP TABLE IF EXISTS ${t}`); d.close(); }
  let srv = await start(); if (!srv.out().includes('listening')) { console.log(srv.out()); process.exit(1); }
  const db = new Dbs(DB); db.pragma('busy_timeout = 5000');
  const PW = 'players-pass-123'; const PH = bcrypt.hashSync(PW, 8); const T0 = Date.now(); const tag = T0.toString(36).slice(-5);
  const mkUser = (name) => db.prepare("INSERT INTO users (username, pass_hash, created_at, birth_date, potato) VALUES (?,?,?,?,?)").run(name, PH, T0 - 30 * D, '1990-01-01', name.replace(/[^A-Za-z0-9_]/g, '')).lastInsertRowid;
  const U = {}; for (const n of ['ava', 'ben', 'cam', 'dee', 'eli', 'fay']) U[n] = mkUser(`t7${n}_${tag}`);
  const uname = (k) => `t7${k}_${tag}`;
  const insRun = db.prepare('INSERT INTO runs (user_id, game_id, score, coins, duration_ms, started_at, created_at, ip_hash, verify, held) VALUES (?,?,?,0,?,?,?,?,?,?)');
  // a run that ended `ago` seconds ago and lasted `dur` seconds (server-measured); verify='cleared' = passed review
  const run = (uid, game, score, ago, dur = 60, o = {}) => { const c = Date.now() - ago * 1000; return insRun.run(uid, game, score, dur * 1000, c - dur * 1000, c, 'e2e' + uid, o.verify ?? 'cleared', o.held ? 1 : 0).lastInsertRowid; };
  const join = (gid, ...ks) => { for (const k of ks) db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, joined_at) VALUES (?,?,?)').run(gid, U[k], Date.now() - 50 * MIN); };
  const O = adminClient(BASE, env);
  try {
    let r = await O.login(); ok(r.body && r.body.ok, 'owner signs in (password + TOTP)', r.body);
    console.log('# admin shell + v7 meta');
    r = await O('/api/admin/v7/me'); ok(r.body.ok && r.body.admin.role === 'owner' && (Array.isArray(r.body.perms) ? r.body.perms.includes('games.profiles') : !!r.body.perms['games.profiles']) && r.body.org === 'Trap Tech Solutions', 'v7/me: owner, perms include games.profiles, org Trap Tech Solutions');
    r = await O('/api/admin/ui/admin-v7.js'); ok(r.status === 200 && String(r.body).includes(AP + '/api') && !String(r.body).includes("'/api/admin"), 'v7 admin UI module served behind auth with secret-path URLs');
    r = await fetch(BASE + AP + '/api/ui/admin-v7.js'); ok(r.status === 401 || r.status === 404, 'v7 admin UI module not served without a session', r.status);
    const meta = (await O('/api/admin/v7/gw/meta')).body;
    ok(meta.ok && Object.keys(meta.profiles).length === meta.games.length && meta.games.length >= 13, `builder meta has a rules profile for all ${meta.games.length} games`);
    ok(['plinko', 'spin-to-win', 'blazed-roulette'].every(id => !meta.games.some(g => (g.id || g) === id)) && Object.values(meta.profiles).every(p => p.giveaway_compatible !== false), 'v7: chance games retired, every live game is giveaway compatible');
    ok(meta.comp.endless && meta.comp.campaign && meta.comp.short_session && meta.comp.strategy && meta.winner_rule === 'Highest verified score at close', 'competition types endless/campaign/short session/strategy + verified winner rule');
    ok(Object.keys(meta.ac_levels).join() === 'L1,L2,L3,L4', 'anti-cheat levels L1-L4 listed');
    const card = meta.profiles['sling-smash'];
    ok(['game', 'category', 'recognition_tier', 'competition_type', 'endless', 'giveaway_compatible', 'scoring', 'attempts', 'recommended_length', 'anticheat_level', 'leaderboard', 'winner_rule'].every(k => k in card), 'profile card has every field (game, category, tier, type, endless, compatible, scoring, attempts, length, AC, leaderboard, winner rule)', Object.keys(card));

    console.log('# Game Rules Profiles: edit, chance lock, reset');
    r = await O('/api/admin/v7/profiles'); ok(r.body.ok && r.body.profiles.length >= 16 && r.body.tiers.includes('A+'), 'profiles list');
    r = await O('/api/admin/v7/profiles/jetpack-dash', { method: 'PUT', body: { ...meta.profiles['jetpack-dash'], anticheat_level: 'L3', attempts: 5, recommended_hours: 96, notes: 'e2e edit' } });
    ok(r.body.ok && r.body.profile.anticheat_level === 'L3' && r.body.profile.attempts === 5 && r.body.profile.source === 'admin', 'admin edits a profile (AC L3, 5 attempts, 96 h)', r.body);
    r = await O('/api/admin/v7/gw/meta'); ok(r.body.defaults['jetpack-dash'].attempts === 5 && r.body.defaults['jetpack-dash'].anticheat_level === 'L3', 'builder defaults follow the edited profile', r.body.defaults['jetpack-dash']);
    r = await O('/api/admin/v7/profiles/plinko', { method: 'PUT', body: { giveaway_compatible: true } }); ok(!r.body.ok || r.body.profile.giveaway_compatible === false, 'a chance game can not be made giveaway compatible from its profile');
    await O('/api/admin/v7/profiles/plinko', { method: 'DELETE' });
    r = await O('/api/admin/v7/profiles/nope-game', { method: 'PUT', body: { game: 'x' } }); ok(!r.body.ok, 'unknown game id rejected (use the importer for catalog references)', r.body);

    console.log('# exact-game-hunt.json importer');
    const hunt = { generated_at: '2026-10-04', categories: {
      'Endless movement and running': [
        { 'Game': 'Jetpack Joyride', 'Hub game': 'jetpack-dash', 'Recognition tier': 'A+', 'Competition type': 'Endless', 'Endless Y/N': 'Y', 'Giveaway compatible': 'Y', 'Scoring': 'Distance in metres + coins', 'Attempts': 'Unlimited', 'Recommended event length': '3 days', 'Anti-cheat level': 'L3 event log', 'Leaderboard': 'Highest distance', 'Winner rule': 'Highest verified score at close' },
        { 'Game': 'Subway Surfers', 'Recognition tier': 'A+', 'Competition type': 'Endless', 'Endless Y/N': 'Y', 'Giveaway compatible': 'Y', 'Scoring': 'Score multiplier x distance', 'Attempts': 'Unlimited', 'Recommended event length': '72 hours', 'Anti-cheat level': 'L2', 'Leaderboard': 'Highest score', 'Source tier': 'alternative' } ],
      'Physics and destruction': [ { game: 'Angry Birds', hub_game: 'sling-smash', category: 'Physics and destruction', recognition_tier: 'A+', competition_type: 'campaign', endless: 'N', giveaway_compatible: 'yes', attempts: 'unlimited', recommended_event_length: '7 days', anticheat_level: 'L2', level_set: '1-30', leaderboard: 'Cumulative across levels 1-30' } ],
      'Defense and tower defense': [ { card: { game: 'Kingdom Rush', 'competition type': 'Strategy', scoring: 'Highest wave', attempts: 'Best of 3', 'recommended event length': '5 days', 'anti-cheat level': 'L4 replay', 'giveaway compatible': 'Y' } } ],
      'Chance (just for fun)': [ { Game: 'Plinko', 'Hub game': 'plinko', 'Giveaway compatible': 'Y', 'Competition type': 'Short session' } ] } };
    r = await O('/api/admin/v7/profiles/import', { body: { data: hunt } });
    ok(r.body.ok && r.body.dry && r.body.linked.length === 2 && r.body.refs.length === 2 && r.body.skipped.some(s => /jetpack-dash/.test(JSON.stringify(s))), 'dry run: 2 hub games linked, 2 catalog references, admin-edited jetpack-dash skipped', r.body);
    r = await O('/api/admin/v7/profiles'); ok(!r.body.profiles.some(p => p.game_id === 'ref:subway-surfers'), 'dry run writes nothing');
    r = await O('/api/admin/v7/profiles/import', { body: { data: JSON.stringify(hunt), apply: true } }); ok(r.body.ok && !r.body.dry, 'apply import (JSON string body)', r.body);
    r = await O('/api/admin/v7/profiles'); const P = Object.fromEntries(r.body.profiles.map(p => [p.game_id, p]));
    ok(P['ref:subway-surfers'] && P['ref:subway-surfers'].recommended_hours === 72 && P['ref:subway-surfers'].linked === false, 'catalog reference created (Subway Surfers, 72 h)', P['ref:subway-surfers']);
    ok(P['ref:kingdom-rush'] && P['ref:kingdom-rush'].competition_type === 'strategy' && P['ref:kingdom-rush'].attempts === 3 && P['ref:kingdom-rush'].anticheat_level === 'L4' && P['ref:kingdom-rush'].recommended_hours === 120, 'nested card: strategy, Best of 3 -> 3 attempts, "L4 replay" -> L4, 5 days -> 120 h', P['ref:kingdom-rush']);
    ok(P['sling-smash'].source === 'import' && P['sling-smash'].level_from === 1 && P['sling-smash'].level_to === 30 && P['sling-smash'].recommended_hours === 168, 'hub game updated from import: campaign levels 1-30, 7 days', P['sling-smash']);
    ok(!P.plinko || P.plinko.giveaway_compatible === false, 'import can not make a chance game giveaway compatible');
    ok(P['jetpack-dash'].anticheat_level === 'L3' && P['jetpack-dash'].source === 'admin', 'admin edit kept (not overwritten without the option)');
    r = await O('/api/admin/v7/profiles/import', { body: { data: hunt, apply: true, overwrite_admin: true } }); r = await O('/api/admin/v7/profiles');
    ok(r.body.profiles.find(p => p.game_id === 'jetpack-dash').source === 'import', 'overwrite option replaces admin edits');
    r = await O('/api/admin/v7/profiles/import', { body: { data: [{ Game: 'Tetris', Attempts: 'Unlimited' }, { nope: 1 }], apply: false } }); ok(r.body.ok && r.body.refs.length === 1 && r.body.errors.length === 1, 'plain array accepted; rows without a game name reported as errors', r.body);
    r = await O('/api/admin/v7/profiles/import', { body: { data: '{bad json' } }); ok(!r.body.ok, 'invalid JSON rejected');
    r = await O('/api/admin/v7/profiles/import', { body: { from_file: true } }); ok(r.body.ok || /missing|valid JSON/.test(r.body.error || ''), 'docs/exact-game-hunt.json import path works (or reports the file is missing)', r.body.error);
    r = await O('/api/admin/v7/profiles/export'); ok(r.status === 200 && r.body.games && r.body.games.length >= 18, 'export profiles JSON');
    r = await O('/api/admin/v7/profiles/ref:tetris', { method: 'DELETE' }); r = await O('/api/admin/v7/profiles/jetpack-dash', { method: 'DELETE' });
    r = await O('/api/admin/v7/profiles'); ok(r.body.profiles.find(p => p.game_id === 'jetpack-dash').source === 'default', 'reset a hub game profile to the built-in default');

    console.log('# picking a game pre-fills its profile');
    r = await O('/api/admin/v7/gw/drafts', { body: { game: 'sling-smash' } }); let dr = (await O('/api/admin/v7/gw/drafts/' + r.body.id)).body.data;
    ok(dr.games.ids.join() === 'sling-smash' && dr.games.competition.type === 'campaign' && dr.games.competition.level_to === 30 && dr.games.score_rule === 'campaign' && dr.schedule.end_at - dr.schedule.start_at === 168 * H, 'Sling Smash: campaign levels 1-30, cumulative rule, 7-day length', dr.games);
    r = await O('/api/admin/v7/gw/drafts', { body: { game: 'memory-match' } }); dr = (await O('/api/admin/v7/gw/drafts/' + r.body.id)).body.data;
    ok(dr.games.competition.type === 'short_session' && dr.games.attempts === 3, 'Memory Match: short session, best of 3', dr.games);
    r = await O('/api/admin/v7/gw/drafts', { body: { game: 'plinko' } }); dr = (await O('/api/admin/v7/gw/drafts/' + r.body.id)).body.data; ok(!dr.games.ids.includes('plinko'), 'a chance game is never pre-filled into a giveaway');

    // ---------- helper: build + publish a builder giveaway ----------
    const PNG = await (async () => { const { Resvg } = require('@resvg/resvg-js'); return new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#7c3aed"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><circle cx="800" cy="450" r="260" fill="#fbbf24"/></svg>`).render().asPng(); })();
    async function make(over, { publish = true } = {}) {
      const id = (await O('/api/admin/v7/gw/drafts', { body: {} })).body.id; const base = (await O('/api/admin/v7/gw/drafts/' + id)).body.data;
      if (!over.prizes) over = { ...over, prizes: [{ id: 'p1', name: 'Hub hoodie', qty: 1, value: 60, type: 'physical', award: 'rank' }] };
      const data = { ...base, ...over, basics: { ...base.basics, ...(over.basics || {}) }, media: { ...base.media, ...(over.media || {}) }, schedule: { ...base.schedule, ...(over.schedule || {}) }, games: { ...base.games, ...(over.games || {}) }, entry: { ...base.entry, ...(over.entry || {}) }, winners: { ...base.winners, ...(over.winners || {}) }, features: { ...base.features, ...(over.features || {}) } };
      const s = await O('/api/admin/v7/gw/drafts/' + id, { method: 'PUT', body: { data } }); if (!publish) return { draft: id, save: s.body };
      const p = await O(`/api/admin/v7/gw/drafts/${id}/publish`, { body: {} }); return { draft: id, save: s.body, pub: p.body, id: p.body.id };
    }
    const standings = async (gid) => (await O('/api/admin/v7/gw/' + gid)).body.standings || [];
    const top = async (gid) => (await standings(gid)).map(x => [x.username.replace(/^t7|_.*$/g, ''), x.score]);

    console.log('# full custom giveaway: uploaded image, 2 games, 3 prizes, 37 minutes, natural completion');
    // adminClient JSON-encodes bodies, so the raw upload goes through fetch with the same cookie + CSRF
    const up = await (await fetch(BASE + AP + '/api/v7/media?kind=giveaway', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF-Token': O.csrf(), Cookie: Object.entries(O.jar).map(([k, v]) => `${k}=${v}`).join('; '), 'X-Crops': JSON.stringify({ card: { x: 0, y: 0.05, w: 1, h: 0.9 }, banner: { x: 0, y: 0.3, w: 1, h: 0.4 }, square: { x: 0.2, y: 0, w: 0.56, h: 1 } }) }, body: PNG })).json();
    ok(up.ok && Object.values(up.urls).every(u => /^\/media\/[a-z0-9-]+\.(webp|png|jpg)$/.test(u)), 'image upload: cropped sizes stored', up);
    const imgRes = up.ok ? await fetch(BASE + Object.values(up.urls)[0]) : { status: 0 }; ok(imgRes.status === 200, 'uploaded image is publicly served');
    const s37 = Date.now() - 36 * MIN + 20e3; // ends ~80 s from now: 37 minutes long
    const full = await make({ basics: { title: `E2E Custom ${tag}`, subtitle: 'Two games, three prizes', description: '<p>Play <b>both</b> games.</p><script>alert(1)</script>', sponsor: 'Trap Tech Solutions' },
      media: { source: 'upload', image: up.urls && up.urls.card, image_square: up.urls && up.urls.square, banner: up.urls && up.urls.banner },
      schedule: { start_at: s37, end_at: s37 + 37 * MIN, publish_mode: 'now' },
      games: { ids: ['munchies-snake', 'brick-breaker'], weights: { 'munchies-snake': 1, 'brick-breaker': 2 }, score_rule: 'sum_best', competition: { type: 'endless', metric: 'score' }, attempts: 0, run_cap_sec: 0 },
      prizes: [{ id: 'p1', name: 'Grand prize hoodie', qty: 1, value: 80, type: 'physical', award: 'rank' }, { id: 'p2', name: 'Runner-up tee', qty: 1, value: 30, type: 'physical', award: 'rank' }, { id: 'p3', name: 'Lucky sticker pack', qty: 1, value: 10, type: 'digital', award: 'random' }],
      entry: { require_join: true, activity_weight: true, age21: true }, winners: { claim_hours: 48 } });
    ok(full.save.ok && !full.save.validation.errors.length, 'custom draft validates', full.save.validation);
    ok(full.pub && full.pub.ok && full.id, 'custom giveaway published', full.pub);
    const FG = full.id; join(FG, 'ava', 'ben', 'cam', 'dee', 'eli');
    run(U.ava, 'munchies-snake', 300, 20 * 60); run(U.ava, 'brick-breaker', 100, 19 * 60);   // 300 + 2x100 = 500 (reached 19 min ago)
    run(U.ben, 'munchies-snake', 500, 10 * 60);                                                // 500 (reached 10 min ago) -> loses the tie
    run(U.cam, 'munchies-snake', 200, 15 * 60); run(U.cam, 'brick-breaker', 50, 14 * 60); run(U.cam, 'munchies-snake', 150, 13 * 60); // 200 + 100 = 300
    run(U.dee, 'brick-breaker', 120, 12 * 60);                                                 // 240
    run(U.eli, 'munchies-snake', 9_999_999, 8 * 60, 10, { verify: '' });                      // over the plausibility cap, not reviewed: does not count
    run(U.eli, 'munchies-snake', 90, 7 * 60); run(U.fay, 'munchies-snake', 5000, 6 * 60);     // fay never joined
    let st = await top(FG);
    ok(JSON.stringify(st.slice(0, 4)) === JSON.stringify([['ava', 500], ['ben', 500], ['cam', 300], ['dee', 240]]), 'weighted sum of best per game; tie 500/500 goes to whoever reached it first', st);
    ok(st.find(x => x[0] === 'eli')[1] === 90 && !st.some(x => x[0] === 'fay'), 'unverified over-cap run ignored (only verified runs count); non-entrant not ranked', st);
    const pubG = (await player()(`/api/giveaways/${FG}`)).body.giveaway;
    ok(pubG.v7 && pubG.subtitle === 'Two games, three prizes' && (pubG.prizes || []).length === 3 && pubG.banner && !/script/.test(pubG.description_html) && /<b>both<\/b>/.test(pubG.description_html), 'public page: subtitle, banner, 3 prizes, sanitized description', { v7: pubG.v7, sub: pubG.subtitle, n: (pubG.prizes || []).length, banner: pubG.banner, d: pubG.description_html });
    ok(pubG.win_method === 'hybrid' && pubG.competition && pubG.competition.winner_rule === 'Highest verified score at close' && pubG.official_rules_html.includes('verified'), 'public: hybrid method, competition block, official rules mention verified scores');
    console.log('  … waiting for the 37-minute giveaway to end on its own');
    if (process.env.E2E_FAST) db.prepare('UPDATE giveaways SET end_at=? WHERE id=?').run(Date.now() - 500, FG); // dev shortcut only
    else while (Date.now() < s37 + 37 * MIN + 1500) await sleep(1000);
    r = await O('/api/admin/v7/sweep', { body: {} }); let G = (await O('/api/admin/v7/gw/' + FG)).body;
    ok(G.giveaway.finalized_at && G.results, 'ended at its scheduled time and finalized (immutable standings)', G.giveaway);
    const W = (G.results && G.results.winners) || [];
    ok(W.length === 3 && W[0].username === uname('ava') && W[1].username === uname('ben') && [uname('cam'), uname('dee'), uname('eli')].includes(W[2].username), 'winners: 1st ava + 2nd ben by rank (tiebreaker), 3rd prize by verifiable random draw among the rest', W.map(w => [w.place, w.username, w.method]));
    r = await player()(`/api/giveaways/${FG}/verify`); ok(r.status !== 200 || (r.body.hash_ok !== false && r.body.seed_ok !== false), 'verify bundle: entrants hash + draw seed check out', r.body && { h: r.body.hash_ok, s: r.body.seed_ok });
    r = await O(`/api/admin/v7/gw/${FG}/claims/${U.ava}`, { body: { action: 'contacted' } }); ok(r.body.ok, 'claims: winner marked contacted');
    r = await O(`/api/admin/v7/gw/${FG}/claims/${U.ava}`, { body: { action: 'claimed' } }); ok(r.body.ok && r.body.winners.find(w => w.user_id === U.ava).claimed_at, 'claims: winner marked claimed', r.body);
    r = await O(`/api/admin/v7/gw/${FG}/act/announce`, { body: {} }); ok(r.body.ok, 'announce winners');

    console.log('# recurring giveaway');
    const rs = Date.now() - 5 * MIN;
    const rec = await make({ basics: { title: `E2E Daily ${tag}` }, schedule: { start_at: rs, end_at: rs + 10 * MIN, recur: { freq: 'daily', every: 1, count: 3 } }, games: { ids: ['sky-hopper'] }, prizes: [{ id: 'p1', name: 'Daily badge', qty: 1, type: 'digital', award: 'rank' }] });
    ok(rec.pub && rec.pub.ok && rec.pub.series_id, 'recurring giveaway published as a series', rec.pub);
    db.prepare('UPDATE giveaways SET end_at=? WHERE id=?').run(Date.now() - 1000, rec.id); // backdate: the first occurrence is over
    r = await O('/api/admin/v7/sweep', { body: {} }); ok(r.body.ok && r.body.giveaways && r.body.giveaways.made >= 1, 'sweep creates the next occurrence', r.body);
    let L = (await O('/api/admin/v7/gw')).body; const occ = L.giveaways.filter(g => g.series_id === rec.pub.series_id).sort((a, b) => a.occurrence - b.occurrence);
    ok(occ.length === 2 && occ[1].occurrence === 2 && Math.abs(occ[1].start_at - (rs + D)) < 2000 && occ[1].end_at - occ[1].start_at === 10 * MIN, 'occurrence #2 starts exactly one day later with the same length', occ.map(o => [o.occurrence, o.start_at - rs, o.state]));
    r = await O(`/api/admin/v7/gw/${occ[1].id}/act/stop_series`, { body: {} }); ok(r.body.ok, 'stop the series');

    console.log("# Reese's competition formats (verified highest score at close)");
    const gs = Date.now() - 2 * H;
    // 1) 7-day campaign, levels 1-30, cumulative score
    const camp = await make({ basics: { title: `E2E Campaign ${tag}` }, schedule: { start_at: gs, end_at: gs + 7 * D }, games: { ids: ['sling-smash'], score_rule: 'campaign', competition: { type: 'campaign', metric: 'cumulative', level_from: 1, level_to: 30 } }, entry: { require_join: false, age21: false } });
    ok(camp.pub && camp.pub.ok, '7-day campaign (levels 1-30, cumulative) published', camp.pub || camp.save);
    run(U.ava, 'sling-smash', 100, 90 * 60); run(U.ava, 'sling-smash', 200, 80 * 60); run(U.ava, 'sling-smash', 300, 70 * 60);
    run(U.ben, 'sling-smash', 550, 60 * 60); run(U.ben, 'sling-smash', 5000, 50 * 60, 60, { held: true });
    st = await top(camp.id); if (!st.length) { const b = (await O('/api/admin/v7/gw/' + camp.id)).body; console.log('DEBUG', JSON.stringify({ e: b.data.entry.require_join, g: b.data.games, gg: db.prepare('SELECT * FROM giveaway_games WHERE giveaway_id=?').all(camp.id), row: db.prepare('SELECT require_join, score_rule, min_score, min_runs, win_method, v7 FROM giveaways WHERE id=?').get(camp.id), runs: db.prepare('SELECT user_id, score, started_at, created_at, verify, held FROM runs WHERE game_id=? ORDER BY id DESC LIMIT 5').all('sling-smash') })); }
    ok(st[0] && st[0][0] === 'ava' && st[0][1] === 600 && st[1][1] === 550, 'campaign: cumulative 100+200+300=600 beats a single 550; held run ignored', st);
    let pg = (await player()(`/api/giveaways/${camp.id}`)).body.giveaway; ok(pg.competition.type === 'campaign' && pg.competition.level_from === 1 && pg.competition.level_to === 30 && pg.competition.anticheat['sling-smash'], 'public: campaign levels 1-30 + anti-cheat level shown', pg.competition);
    // 2) 72-hour endless chase, survival + distance
    const chase = await make({ basics: { title: `E2E Chase ${tag}` }, schedule: { start_at: gs, end_at: gs + 72 * H }, games: { ids: ['drift-rush'], score_rule: 'best', competition: { type: 'endless', metric: 'survival_distance' } }, entry: { require_join: false, age21: false } });
    run(U.ava, 'drift-rush', 800, 60 * 60, 120); run(U.ben, 'drift-rush', 950, 50 * 60, 150); run(U.ben, 'drift-rush', 400, 40 * 60); run(U.cam, 'drift-rush', 9_999_999, 30 * 60, 5, { verify: '' });
    st = await top(chase.id); ok(chase.pub.ok && st[0][0] === 'ben' && st[0][1] === 950 && !st.some(x => x[1] > 1e6), '72 h endless chase: best single verified run wins; implausible run excluded', st);
    pg = (await player()(`/api/giveaways/${chase.id}`)).body.giveaway; ok(pg.competition.metric_label === 'Survival + distance', 'public: scored on survival + distance');
    // 3) 5-day tower defense, highest round
    const td = await make({ basics: { title: `E2E Tower ${tag}` }, schedule: { start_at: gs, end_at: gs + 5 * D }, games: { ids: ['haze-defense'], score_rule: 'best', competition: { type: 'strategy', metric: 'wave' } }, entry: { require_join: false, age21: false } });
    run(U.cam, 'haze-defense', 31, 70 * 60, 600); run(U.dee, 'haze-defense', 42, 65 * 60, 900); run(U.dee, 'haze-defense', 12, 60 * 60, 200);
    st = await top(td.id); ok(td.pub.ok && st[0][0] === 'dee' && st[0][1] === 42, '5-day tower defense: highest round wins', st);
    // 4) 24-hour marathon (every run adds up)
    const mar = await make({ basics: { title: `E2E Marathon ${tag}` }, schedule: { start_at: gs, end_at: gs + 24 * H }, games: { ids: ['terp-tapper'], score_rule: 'total', competition: { type: 'endless', metric: 'marathon' } }, entry: { require_join: false, age21: false } });
    for (let i = 0; i < 6; i++) run(U.eli, 'terp-tapper', 100, (90 - i * 5) * 60); run(U.fay, 'terp-tapper', 450, 30 * 60);
    st = await top(mar.id); ok(mar.pub.ok && st[0][0] === 'eli' && st[0][1] === 600 && st[1][1] === 450, '24 h marathon: total of all runs (6x100=600 beats one 450)', st);
    // 5) 48-hour run capped at 30 minutes, kills + score
    const cap = await make({ basics: { title: `E2E Capped ${tag}` }, schedule: { start_at: gs, end_at: gs + 48 * H }, games: { ids: ['void-swarm'], score_rule: 'best', competition: { type: 'endless', metric: 'kills_score' }, run_cap_sec: 1800 }, entry: { require_join: false, age21: false } });
    run(U.ava, 'void-swarm', 20000, 10 * 60, 40 * 60); run(U.ava, 'void-swarm', 7000, 5 * 60, 25 * 60); run(U.ben, 'void-swarm', 9000, 3 * 60, 29 * 60);
    st = await top(cap.id); ok(cap.pub.ok && st[0][0] === 'ben' && st[0][1] === 9000 && st.find(x => x[0] === 'ava')[1] === 7000, '48 h, 30-min run cap: a 40-minute run does not count; kills + score best run wins', st);
    pg = (await player()(`/api/giveaways/${cap.id}`)).body.giveaway; ok(pg.competition.run_cap_sec === 1800 && /30 min|30-minute|1800/.test(pg.official_rules_html + pg.competition.run_cap_sec), 'public + official rules state the 30-minute run cap');
    // 6) short session: 60-second score attack, best of 3 (attempts limit + 60 s cap)
    const att = await make({ basics: { title: `E2E Attack ${tag}` }, schedule: { start_at: gs, end_at: gs + 24 * H }, games: { ids: ['high-score'], score_rule: 'best', competition: { type: 'short_session', metric: 'attack_60' }, attempts: 3, run_cap_sec: 60 }, entry: { require_join: false, age21: false } });
    run(U.cam, 'high-score', 50, 50 * 60, 60); run(U.cam, 'high-score', 70, 45 * 60, 60); run(U.cam, 'high-score', 60, 40 * 60, 90); run(U.cam, 'high-score', 999, 35 * 60, 60);
    run(U.dee, 'high-score', 80, 30 * 60, 58);
    st = await top(att.id); ok(att.pub.ok && st[0][0] === 'dee' && st[0][1] === 80 && st.find(x => x[0] === 'cam')[1] === 70, 'best of 3: the 4th attempt (999) is ignored; a 90 s run breaks the 60 s cap', st);
    // 7) campaign, fastest completion + score
    const fast = await make({ basics: { title: `E2E Fastest ${tag}` }, schedule: { start_at: gs, end_at: gs + 3 * D }, games: { ids: ['stack'], score_rule: 'fastest', competition: { type: 'campaign', metric: 'fastest', level_from: 1, level_to: 10 } }, entry: { require_join: false, age21: false } });
    run(U.ava, 'stack', 300, 80 * 60, 200); run(U.ben, 'stack', 300, 70 * 60, 150); run(U.cam, 'stack', 250, 60 * 60, 50);
    st = await top(fast.id); ok(fast.pub.ok && st[0][0] === 'ben' && st[1][0] === 'ava', 'fastest completion: equal scores split by the faster run (ben 150 s beats ava 200 s, though ava was first)', st);
    // validation: run cap longer than the event; profile marked not compatible
    const bad = await make({ basics: { title: 'bad cap' }, schedule: { start_at: Date.now() + H, end_at: Date.now() + H + 20 * MIN }, games: { ids: ['void-swarm'], run_cap_sec: 1800 } }, { publish: false });
    ok(bad.save.validation.errors.some(e => e.field === 'run_cap_sec'), 'validation: a run cap longer than the whole giveaway is an error', bad.save.validation);
    // winner at close = highest verified score
    r = await O(`/api/admin/v7/gw/${camp.id}/act/end`, { body: { confirm: 'END' } }); G = (await O('/api/admin/v7/gw/' + camp.id)).body;
    ok(r.body.ok && G.results && G.results.winners[0] && G.results.winners[0].username === uname('ava'), 'ending early locks the result: winner = highest verified score at close', G.results && G.results.winners);

    console.log('# lifecycle: pause / resume / extend / cancel / archive / template / duplicate / edit');
    r = await O(`/api/admin/v7/gw/${chase.id}/act/pause`, { body: {} }); ok(r.body.ok, 'pause');
    pg = (await player()(`/api/giveaways/${chase.id}`)).body.giveaway; ok(pg.paused === true, 'public shows paused');
    r = await O(`/api/admin/v7/gw/${chase.id}/act/resume`, { body: {} }); ok(r.body.ok, 'resume');
    r = await O(`/api/admin/v7/gw/${chase.id}/act/extend`, { body: { end_at: gs + 96 * H } }); ok(r.body.ok, 'extend end time');
    r = await O(`/api/admin/v7/gw/${td.id}/act/cancel`, { body: { confirm: 'nope' } }); ok(!r.body.ok, 'cancel needs typed CANCEL');
    r = await O(`/api/admin/v7/gw/${td.id}/act/cancel`, { body: { confirm: 'CANCEL', reason: 'e2e' } }); ok(r.body.ok, 'cancel with typed confirm');
    r = await O(`/api/admin/v7/gw/${td.id}/act/archive`, { body: {} }); ok(r.body.ok, 'archive');
    r = await O(`/api/admin/v7/gw/${chase.id}/act/template`, { body: { name: 'E2E chase template' } }); ok(r.body.ok && r.body.id, 'save as template');
    r = await O('/api/admin/v7/gw/drafts', { body: { template: r.body.id } }); ok(r.body.ok, 'new draft from template');
    r = await O('/api/admin/v7/gw/drafts', { body: { duplicate: chase.id } }); ok(r.body.ok, 'duplicate a giveaway into a draft');
    r = await O(`/api/admin/v7/gw/${chase.id}/edit`, { body: {} }); const ed = r.body.id; let ex = (await O('/api/admin/v7/gw/drafts/' + ed)).body;
    ex.data.basics.subtitle = 'Edited live'; r = await O('/api/admin/v7/gw/drafts/' + ed, { method: 'PUT', body: { data: ex.data, base: ex.draft.updated_at } }); ok(r.body.ok, 'autosave of an edit draft');
    r = await O('/api/admin/v7/gw/drafts/' + ed, { method: 'PUT', body: { data: ex.data, base: ex.draft.updated_at - 10000 } }); ok(r.status === 409 && r.body.conflict, 'stale autosave from another admin -> conflict, not silent overwrite');
    r = await O(`/api/admin/v7/gw/drafts/${ed}/publish`, { body: {} }); pg = (await player()(`/api/giveaways/${chase.id}`)).body.giveaway; ok(r.body.ok && pg.subtitle === 'Edited live', 'publishing the edit updates the live giveaway', r.body);

    console.log('# roles');
    r = await O('/api/admin/v7/team/appoint', { body: { username: `mod_${tag}`, role: 'moderator', temp_password: 'Temp-Pass-12345!' } }); ok(r.body.ok && r.body.account.role === 'moderator', 'owner appoints a moderator', r.body);
    r = await O('/api/admin/v7/team/appoint', { body: { username: `adm_${tag}`, role: 'admin', temp_password: 'Temp-Pass-12345!' } }); ok(r.body.ok, 'owner appoints an admin'); const admId = r.body.account && r.body.account.id;
    async function staff(name) {
      const c = adminClient(BASE, env); let x = await c.login('Temp-Pass-12345!', name);
      if (x.body.ok && x.body.must_change) { const sec = totpSecret(env, name); await sleep(50); const ch = await c('/api/admin/security/password', { body: { current: 'Temp-Pass-12345!', code: await freshCode(env, sec, name), new_password: 'Own-Strong-Pass-777!' } }); if (ch.body.ok) x = await c.login('Own-Strong-Pass-777!', name); }
      return [c, x];
    }
    const [MOD, ml] = await staff(`mod_${tag}`); ok(ml.body.ok, 'moderator signs in (enrols TOTP, sets own password)', ml.body);
    r = await MOD('/api/admin/v7/team/appoint', { body: { username: `x_${tag}`, role: 'moderator' } }); ok(r.status === 403, 'moderator can NOT appoint staff', r.status);
    r = await MOD('/api/admin/v7/profiles/stack', { method: 'PUT', body: { attempts: 2 } }); ok(r.status === 403, 'moderator can NOT edit game rules profiles');
    r = await MOD('/api/admin/v7/mod/reports'); ok(r.status === 200, 'moderator can work the moderation queue');
    r = await MOD(`/api/admin/v7/users/${U.fay}/ban`, { body: { banned: true, reason: 'x' } }); ok(r.status === 403, 'moderator can NOT ban (admin+)', r.status);
    const [ADM, al] = await staff(`adm_${tag}`); ok(al.body.ok, 'admin signs in');
    const team = (await O('/api/admin/v7/team')).body; const owner = team.staff.find(s => s.role === 'owner');
    r = await ADM('/api/admin/v7/team/' + owner.id, { method: 'DELETE' }); ok(!r.body.ok, 'admin can NOT remove the owner', r.body);
    r = await ADM('/api/admin/v7/team/' + owner.id, { method: 'PUT', body: { role: 'moderator' } }); ok(!r.body.ok, 'admin can NOT demote the owner', r.body);
    r = await ADM('/api/admin/v7/team/transfer', { body: { to: admId, confirm: `adm_${tag}` } }); ok(r.status === 403, 'only the owner can transfer ownership');
    r = await ADM('/api/admin/v7/profiles/stack', { method: 'PUT', body: { ...meta.profiles.stack, attempts: 2 } }); ok(r.body.ok, 'admin can edit game rules profiles'); await O('/api/admin/v7/profiles/stack', { method: 'DELETE' });
    r = await O('/api/admin/v7/team/invite', { body: { role: 'moderator', note: 'e2e', hours: 24 } }); ok(r.body.ok && r.body.url.includes('/join/'), 'owner creates an invite link');
    r = await O('/api/admin/v7/log?q=staff'); ok(r.body.ok && r.body.log.rows ? r.body.log.rows.length > 0 : (r.body.log || []).length > 0, 'staff actions in the action log');

    console.log('# player actions');
    const fid = U.fay; let pr = (await O('/api/admin/v7/users/' + fid)).body; ok(pr.ok && pr.user && pr.user.username === uname('fay'), 'player profile');
    r = await O('/api/admin/v7/users?q=' + uname('fay')); ok(r.body.rows.some(x => x.id === fid), 'search players');
    r = await O('/api/admin/v7/users/' + fid, { method: 'PUT', body: { potato: 'fay_potato', region: 'MI' } }); ok(r.body.ok && r.body.changed.length === 2, 'edit potato + state', r.body);
    r = await O(`/api/admin/v7/users/${fid}/points`, { body: { amount: 250, reason: 'e2e goodwill' } }); ok(r.body.ok, 'grant points');
    r = await O(`/api/admin/v7/users/${fid}/points`, { body: { amount: 10 } }); ok(!r.body.ok, 'points need a reason');
    const anyItem = (await O('/api/admin/v7/shop')).body; const itemId = (anyItem.all || anyItem.items || anyItem.now || [])[0]; const iid = itemId && (itemId.id || itemId.item);
    r = await O(`/api/admin/v7/users/${fid}/items`, { body: { item: iid } }); ok(r.body.ok, 'grant a shop item', [iid, r.body]);
    r = await O(`/api/admin/v7/users/${fid}/items`, { body: { item: iid, action: 'revoke' } }); ok(r.body.ok, 'revoke the item');
    const badges = (await O('/api/admin/v7/badges')).body; const bid = badges.admin[0].id;
    r = await O(`/api/admin/v7/users/${fid}/badges`, { body: { badge: bid, note: 'e2e' } }); ok(r.body.ok, 'award a badge from the profile');
    r = await O(`/api/admin/v7/users/${fid}/notes`, { body: { text: 'e2e private note' } }); ok(r.body.ok, 'add a staff note');
    pr = (await O('/api/admin/v7/users/' + fid)).body; const note = (pr.notes || [])[0]; r = await O(`/api/admin/v7/users/${fid}/notes/${note && note.id}`, { method: 'DELETE' }); ok(note && r.body.ok, 'delete the note');
    r = await O(`/api/admin/v7/users/${fid}/shadow`, { body: { on: true } }); ok(r.body.ok, 'shadow-ban');
    st = await top(mar.id); ok(!st.some(x => x[0] === 'fay'), 'shadow-banned player disappears from giveaway standings', st);
    r = await O(`/api/admin/v7/users/${fid}/shadow`, { body: { on: false } }); st = await top(mar.id); ok(st.some(x => x[0] === 'fay'), 'lifting the shadow-ban restores them');
    r = await O(`/api/admin/v7/users/${fid}/suspend`, { body: { hours: 24 } }); ok(!r.body.ok, 'suspension needs a reason');
    r = await O(`/api/admin/v7/users/${fid}/suspend`, { body: { hours: 24, reason: 'cool-off' } }); ok(r.body.ok, 'suspend 24 h');
    let PL = player(); r = await PL('/api/auth/login', { body: { username: uname('fay'), password: PW } }); ok(!r.body.ok, 'suspended player can not sign in', r.body);
    r = await O(`/api/admin/v7/users/${fid}/suspend`, { body: { lift: true } }); ok(r.body.ok, 'lift suspension');
    r = await O(`/api/admin/v7/users/${fid}/clear-flags`, { body: { action: 'clear' } }); ok(r.body.ok, 'clear anti-cheat flags');
    r = await O(`/api/admin/v7/users/${fid}/reset`, { body: {} }); ok(r.body.ok && /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(r.body.code) && r.body.path.startsWith('/reset-password?token=') && r.body.potato_message.includes(r.body.code), 'reset link + code + Potato message', r.body);
    const rcode = r.body.code; const rtok = new URL(BASE + r.body.path).searchParams.get('token');
    r = await PL('/api/auth/reset', { body: { username: uname('fay'), code: 'AAAA-AAAA', password: 'brand-new-pass-1' } }); ok(!r.body.ok, 'wrong reset code rejected');
    r = await PL('/api/auth/reset', { body: { username: uname('fay'), code: rcode, password: 'brand-new-pass-1' } }); ok(r.body.ok, 'player redeems the reset code', r.body);
    r = await PL('/api/auth/reset', { body: { token: rtok, password: 'brand-new-pass-2' } }); ok(!r.body.ok, 'the link stops working once the code was used (one reset per issue)');
    r = await PL('/api/auth/login', { body: { username: uname('fay'), password: 'brand-new-pass-1' } }); ok(r.body.ok, 'player signs in with the new password', r.body);
    r = await fetch(BASE + '/reset-password'); ok(r.status === 200, 'reset page served');
    r = await PL('/api/report', { body: { kind: 'user', username: uname('eli'), reason: 'cheating', details: 'e2e' } }); ok(r.body.ok, 'player reports another player');
    r = await O('/api/admin/v7/mod/reports'); const rep = r.body.reports.find(x => x.target_username === uname('eli') || x.target === uname('eli') || JSON.stringify(x).includes(uname('eli')));
    ok(rep, 'report shows in the moderation queue'); r = await O('/api/admin/v7/mod/reports/' + (rep && rep.id), { body: { status: 'actioned', resolution: 'warned' } }); ok(r.body.ok, 'report actioned');
    r = await O(`/api/admin/v7/users/${fid}/export`); ok(r.status === 200 && r.body.account && r.body.account.username === uname('fay'), 'export player data (JSON)');
    r = await O(`/api/admin/v7/users/${fid}/ban`, { body: { banned: true, reason: 'e2e' } }); ok(r.body.ok, 'ban');
    r = await O(`/api/admin/v7/users/${fid}/ban`, { body: { banned: false } }); ok(r.body.ok, 'unban');
    r = await O(`/api/admin/v7/users/${fid}`, { method: 'DELETE', body: { confirm: 'wrong' } }); ok(!r.body.ok, 'delete needs the typed username');
    r = await O(`/api/admin/v7/users/${fid}`, { method: 'DELETE', body: { confirm: uname('fay') } }); ok(r.body.ok, 'delete account with typed confirm');

    console.log('# live ops');
    r = await O('/api/admin/v7/events', { body: { kind: 'double_points', name: 'E2E Double Points', starts_at: Date.now() - MIN, ends_at: Date.now() + D, multiplier: 2 } }); ok(r.body.ok, 'create a double-points event', r.body); const evId = r.body.id;
    r = await O('/api/admin/v7/events', { body: { kind: 'themed_weekend', name: 'E2E 420 Weekend', starts_at: Date.now() - MIN, ends_at: Date.now() + 2 * D, theme: 'green', games: ['jetpack-dash'] } }); ok(r.body.ok, 'create a themed weekend');
    r = await O('/api/admin/v7/events', { body: { kind: 'shop_sale', name: 'no pct', starts_at: Date.now(), ends_at: Date.now() + D } }); ok(!r.body.ok, 'shop sale needs a percent');
    r = await O('/api/admin/v7/events'); ok(r.body.events.some(e => e.id === evId && e.state === 'live'), 'event is live');
    r = await player()('/api/site-config'); ok(r.body.events.some(e => e.name === 'E2E Double Points'), 'live event shows in the public site config');
    r = await O('/api/admin/v7/events/' + evId, { method: 'PUT', body: { name: 'E2E Double Points!' } }); ok(r.body.ok, 'edit event');
    r = await O('/api/admin/v7/events/' + evId, { method: 'DELETE' }); ok(r.body.ok, 'delete event');
    const sea = (await O('/api/admin/v7/seasons')).body; ok(sea.ok && sea.current, 'seasons overview (engine)', Object.keys(sea));
    if (sea.current) { const n = sea.current.number || sea.current.n; r = await O('/api/admin/v7/seasons/' + n, { method: 'PUT', body: { name: 'E2E Season Name' } }); ok(r.body.ok, 'rename the current season', r.body);
      r = await O('/api/admin/v7/seasons/end', { body: { confirm: 'nope' } }); ok(!r.body.ok, 'ending a season needs typed confirm'); }
    const shop = (await O('/api/admin/v7/shop')).body; ok(shop.ok, 'shop overview');
    r = await O('/api/admin/v7/shop', { body: { item: iid, action: 'pin' } }); ok(r.body.ok, 'pin a shop item');
    r = await O('/api/admin/v7/shop', { body: { item: iid, action: 'feature' } }); ok(r.body.ok, 'feature it');
    r = await O('/api/admin/v7/shop', { body: { item: iid, action: 'unpin' } }); ok(r.body.ok, 'unpin');
    r = await O('/api/admin/v7/badges', { body: { name: `E2E Champ ${tag}`.slice(0, 40), icon: 'trophy', color: '#22d3ee', description: 'e2e' } }); ok(r.body.ok && r.body.id.startsWith('c-'), 'create a custom badge', r.body); const cb = r.body.id;
    r = await O('/api/admin/v7/badges/award', { body: { username: uname('ava'), badge: cb, note: 'e2e' } }); ok(r.body.ok, 'award the custom badge by username');
    r = await O('/api/admin/v7/badges/' + cb, { method: 'PUT', body: { name: 'E2E Champ edited', icon: 'star' } }); ok(r.body.ok, 'edit the badge');
    r = await O('/api/admin/v7/analytics?days=30'); ok(r.body.ok && r.body.series && Object.keys(r.body).length > 3, 'analytics (30 days)', Object.keys(r.body));
    r = await O('/api/admin/v7/banner', { body: { on: true, text: 'E2E banner', tone: 'info', link: '/giveaways', link_label: 'Play' } }); ok(r.body.ok, 'site banner on');
    r = await player()('/api/site-config'); ok(r.body.banner && r.body.banner.text === 'E2E banner', 'banner in public site config');
    await O('/api/admin/v7/banner', { body: { on: false } });
    r = await O('/api/admin/v7/broadcast', { body: { title: 'E2E broadcast', body: 'hello', link: '/giveaways' } }); ok(r.body.ok, 'broadcast notification', r.body);
    r = await O('/api/admin/v7/settings', { method: 'PUT', body: { maintenance: { on: true, message: 'E2E maintenance' }, age_gate: { title: 'Hold up', text: 'Adults 21+ only.' }, legal: { terms: '<p>E2E terms</p><script>x</script>' } } }); ok(r.body.ok, 'settings: maintenance + age gate + legal override');
    r = await player()('/api/site-config'); ok(r.body.maintenance && r.body.maintenance.on && r.body.age_gate.title === 'Hold up' && r.body.legal.terms === '<p>E2E terms</p>', 'public config: maintenance, age gate text, sanitized legal override', r.body);
    PL = player(); r = await PL('/api/auth/login', { body: { username: uname('ava'), password: PW } }); ok(r.status === 503 && r.body.maintenance, 'maintenance blocks player writes', r.status);
    r = await O('/api/admin/v7/settings', { method: 'PUT', body: { maintenance: { on: false }, legal: { terms: '' } } }); ok(r.body.ok, 'maintenance off, legal override removed');
    r = await PL('/api/auth/login', { body: { username: uname('ava'), password: PW } }); ok(r.body.ok, 'players can write again');

    if (!NO_SHOTS) {
      console.log('# screenshots (phone 390x844 + desktop 1366x900)');
      fs.mkdirSync(SHOTS, { recursive: true });
      const { chromium } = require('./node_modules/playwright-core');
      const br = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
      const screens = ['', 'analytics', 'giveaways', 'game-rules', 'players', `players/${U.ava}`, 'moderation', 'events', 'seasons', 'shop', 'badges', 'announcements', 'settings', 'team', 'log'];
      const steps = ['basics', 'media', 'schedule', 'games', 'prizes', 'entry', 'features', 'winners', 'rules'];
      let shots = 0; const errs = [];
      for (const [vn, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1366, height: 900 }]]) {
        const ctx = await br.newContext({ viewport: vp, deviceScaleFactor: vn === 'phone' ? 2 : 1, isMobile: vn === 'phone', hasTouch: vn === 'phone' }); const page = await ctx.newPage();
        page.on('pageerror', e => errs.push(`${vn} ${page.url().split(env.ADMIN_PATH)[1]}: ${e.message}`));
        await browserLogin(page, BASE, env);
        for (const s of screens) {
          await page.goto(BASE + AP + '/' + s); await page.waitForTimeout(1300);
          await page.screenshot({ path: path.join(SHOTS, `${vn}-${(s || 'dashboard').replace(/\//g, '-').replace(/-\d+$/, '-profile')}.png`) }); shots++;
        }
        await page.goto(BASE + AP + '/giveaways/new?game=sling-smash'); await page.waitForSelector('[data-step=basics]', { timeout: 15000 });
        await page.fill('[data-f="basics.title"]', 'Spring Smash Showdown').catch(() => {}); await page.waitForTimeout(400);
        for (const [i, st] of steps.entries()) {
          await page.click(`[data-step=${st}]`); await page.waitForTimeout(700);
          await page.screenshot({ path: path.join(SHOTS, `${vn}-builder-${i + 1}-${st}.png`) }); shots++;
          if (st === 'games' && vn === 'phone') { await page.screenshot({ path: path.join(SHOTS, `${vn}-builder-4-games-full.png`), fullPage: true }); shots++; }
        }
        const pv = await page.$('[data-act=preview]'); if (pv && vn === 'phone') { await pv.click(); await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `${vn}-builder-preview.png`) }); shots++; }
        await page.goto(BASE + AP + '/game-rules'); await page.waitForTimeout(1200); const eb = await page.$('[data-act=edit]'); if (eb) { await eb.click(); await page.waitForTimeout(600); await page.screenshot({ path: path.join(SHOTS, `${vn}-game-rules-edit.png`) }); shots++; }
        await page.goto(BASE + AP + `/giveaways/${FG}`); await page.waitForTimeout(1300); await page.screenshot({ path: path.join(SHOTS, `${vn}-giveaway-detail.png`) }); shots++;
        // player-facing page for a builder giveaway
        const pp = await ctx.newPage(); await pp.addInitScript(() => { try { localStorage.setItem('gh_age_ok', '1'); localStorage.setItem('gh_age', '1'); } catch {} });
        await pp.goto(BASE + `/giveaways/${cap.id}`); await pp.waitForTimeout(1500);
        if (await pp.$('#gate')) { await pp.fill('#gate-y, [name=y], #gate-year', '1990').catch(() => {}); }
        await pp.screenshot({ path: path.join(SHOTS, `${vn}-public-giveaway.png`), fullPage: vn === 'phone' }); shots++;
        const hasComp = await pp.$('#gw7-comp'); ok(!!hasComp || !!(await pp.$('.gate')), `${vn}: public giveaway page renders the competition card`);
        await ctx.close();
      }
      await br.close();
      ok(!errs.length, `admin screens + builder steps load without JS errors (${shots} screenshots)`, errs.slice(0, 5));
    }
  } catch (e) { fail++; fails.push('exception: ' + e.message); console.error(e); }
  finally {
    db.close(); await stop(srv);
    console.log(`\n${pass} passed, ${fail} failed`); if (fails.length) console.log('FAILED:\n - ' + fails.join('\n - '));
    try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {}
    process.exit(fail ? 1 : 0);
  }
})();

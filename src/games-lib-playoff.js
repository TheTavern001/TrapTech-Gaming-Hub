'use strict';
// Games Library: SKILL-ONLY tie-breaks + sudden-death playoffs (separate module; core events code untouched).
// Reese, Oct 10 2026: ties are broken only by skill. Every library game declares 1-2 secondary metrics that the SERVER
// derives and validates from the run itself (server-timed duration + the signed run's event log), never from
// submission time, first-to-score or attempt counts. If tied players are still exactly level on score AND both
// metrics, an admin starts a sudden-death playoff: each tied player gets ONE run of the same game with the SAME seed
// inside a set window; best score (then the same metrics) wins; exact ties again -> automatic next round (new seed).
// Hooks (3 lines, marked [games-lib hook] in src/server.js): run/start seed override, /api/score record, mount().
const crypto = require('crypto');
const db = require('./db');
db.exec(`CREATE TABLE IF NOT EXISTS lib_run_metrics (run_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, game_id TEXT NOT NULL, score INTEGER NOT NULL,
    m1 REAL, m2 REAL, valid INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
  CREATE INDEX IF NOT EXISTS lib_run_metrics_g ON lib_run_metrics (game_id, score);
  CREATE TABLE IF NOT EXISTS lib_playoffs (id INTEGER PRIMARY KEY AUTOINCREMENT, giveaway_id INTEGER, game_id TEXT NOT NULL, round INTEGER NOT NULL DEFAULT 1,
    seed TEXT NOT NULL, opens_at INTEGER NOT NULL, closes_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', winner_user_id INTEGER, parent_id INTEGER,
    created_by INTEGER, created_at INTEGER NOT NULL, note TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS lib_playoff_entries (playoff_id INTEGER NOT NULL, user_id INTEGER NOT NULL, rid TEXT, run_id INTEGER, score INTEGER, m1 REAL, m2 REAL,
    started_at INTEGER, PRIMARY KEY (playoff_id, user_id));`);

// ---- per-game metric definitions --------------------------------------------------------------------------------
// m1 (all games): 'faster' = shorter server-timed run (created_at - started_at) to post the same score.
// m2: { count: key } = more events of that key (e.g. near misses, coins, takedowns), or { eff: true } = higher points
// per scoring event (bigger combos / chains / multipliers for the same score).
const M2 = { 'neon-circuit': ['e', 'More energy cells collected'], 'rift-survival': ['s', 'More rift shards collected'], 'lane-racer': ['n', 'More near misses'], 'road-brawl': ['k', 'More takedowns'], 'highway-heist': ['k', 'More cops taken down'], 'rail-rush': ['c', 'More coins'],
  'ruin-runner': ['c', 'More gems'], 'jet-blaster': ['c', 'More coins'], 'moto-lanes': ['o', 'More near misses'], 'no-brakes': ['p', 'More cars passed'], 'dirt-dash': ['j', 'More clean landings'],
  'hill-glider': ['p', 'More perfect slides'], 'dune-glide': ['f', 'More flips'], 'hill-hauler': ['c', 'More coins'], 'egg-roll': ['c', 'More coins'], 'monster-crush': ['k', 'More cars crushed'],
  'zig-path': ['g', 'More gems'], 'road-hopper': ['c', 'More coins'], 'block-drop': ['l', 'More line clears'], 'duck-shot': ['k', 'More birds hit'], 'castle-crush': ['w', 'More castles cleared'],
  'sling-siege': ['k', 'More targets'], 'trim-rush': ['c', 'More clean trims'], 'cab-rush': ['f', 'More fares'], 'park-getaway': ['b', 'More cash bags'], 'derby-smash': ['w', 'More wrecks'],
  'missile-guard': ['k', 'More warheads stopped'], 'knife-toss': ['a', 'More apples'], 'bat-boy': ['h', 'More hits'] };
// core catalog games (Reese: skill-only tie-breaks for ALL games). 'eff' = more points per scoring action; 'coins' = more
// coins collected (server plausibility-checked against the server-timed run); a count key = more events of that kind.
const CORE = { 'jetpack-dash': ['coins', 'More coins collected'], 'sky-hopper': ['coins', 'More coins collected'], 'drift-rush': ['d', 'More drift banks'],
  'memory-match': ['eff', 'Fewer misses: more points per flip'], 'high-score': ['eff', 'Bigger combos: more points per hit'], 'terp-tapper': ['eff', 'Bigger combos: more points per note'],
  'munchies-snake': ['f', 'More snacks eaten'], 'brick-breaker': ['eff', 'Bigger chains: more points per brick'], 'void-swarm': ['k', 'More drones destroyed'],
  stack: ['eff', 'More perfect drops: more points per slab'], 'grow-guard': ['eff', 'More points per defence action'], 'sling-smash': ['b', 'More bots smashed'],
  'haze-defense': ['eff', 'More points per pop (higher wave tiers)'] };
function metricsFor(slugOrId) { const c = CORE[slugOrId]; if (c) return [{ id: 'faster', label: 'Faster run (server-timed) to the same score', dir: 'asc' }, c[0] === 'eff' ? { id: 'eff', label: c[1], dir: 'desc' } : c[0] === 'coins' ? { id: 'coins', label: c[1], dir: 'desc' } : { id: 'count:' + c[0], label: c[1], dir: 'desc' }];
  return metricsForLib(slugOrId); }
function metricsForLib(slugOrId) { const slug = String(slugOrId).replace(/^gl-/, ''); const m = M2[slug];
  return [{ id: 'faster', label: 'Faster run (server-timed) to the same score', dir: 'asc' }, m ? { id: 'count:' + m[0], label: m[1], dir: 'desc' } : { id: 'eff', label: 'Higher efficiency: more points per scoring action (combos, chains, multipliers)', dir: 'desc' }]; }

// derive m1/m2 from the stored run + its event log; invalid (log does not add up to the score) -> metrics null = ranks last on ties
function derive(gameId, score, elapsedMs, ev, coins = null) { const ms = metricsFor(gameId); const e = ev && Array.isArray(ev.e) ? ev.e : [];
  let sum = 0, n = 0; const cnt = {}; for (let i = 0; i + 2 < e.length + 0.5 && i + 2 <= e.length - 1; i += 3) { const k = String(e[i + 1]); if (k[0] === '#') continue; const v = Number(e[i + 2]) || 0; sum += v; if (v > 0) n++; cnt[k] = (cnt[k] || 0) + 1; }
  const valid = e.length >= 3 ? Math.abs(sum - score) <= Math.max(2, score * 0.001) : score === 0;
  const m1 = Math.max(0, Math.round(elapsedMs)); let m2 = null; const d = ms[1].id;
  if (d === 'coins') return { m1, m2: coins == null ? null : coins, valid: 1 }; if (d.startsWith('count:')) m2 = cnt[d.slice(6)] || 0; else m2 = n ? Math.round(score / n * 100) / 100 : 0;
  return { m1, m2: valid ? m2 : null, valid: valid ? 1 : 0 }; }

function isLib(gameId) { return /^gl-/.test(String(gameId)); }
function record(runId, userId, gameId, score, startedAt, createdAt, ev, rid) { try { // every game (core + library) since Oct 10 2026
  const coins = (db.prepare('SELECT coins FROM runs WHERE id=?').get(runId) || {}).coins; const d = derive(gameId, score, createdAt - startedAt, ev, coins == null ? null : coins);
  db.prepare('INSERT OR REPLACE INTO lib_run_metrics (run_id,user_id,game_id,score,m1,m2,valid,created_at) VALUES (?,?,?,?,?,?,?,?)').run(runId, userId, gameId, score, d.m1, d.m2, d.valid, createdAt);
  if (rid) { const pe = db.prepare('SELECT * FROM lib_playoff_entries WHERE rid=?').get(rid); if (pe && pe.run_id == null) db.prepare('UPDATE lib_playoff_entries SET run_id=?, score=?, m1=?, m2=? WHERE playoff_id=? AND user_id=?').run(runId, score, d.m1, d.m2, pe.playoff_id, pe.user_id); }
  } catch (e) { console.error('[games-lib-playoff] record', e.message); } }

// comparator: score desc, then m1, then m2 (null metrics rank last). Returns 0 only for an exact skill tie.
function cmp(gameId, a, b) { if (b.score !== a.score) return b.score - a.score; const ms = metricsFor(gameId);
  for (const [k, m] of [['m1', ms[0]], ['m2', ms[1]]]) { const x = a[k], y = b[k]; if (x == null && y == null) continue; if (x == null) return 1; if (y == null) return -1; if (x !== y) return m.dir === 'asc' ? x - y : y - x; }
  return 0; }
// rank a giveaway's best runs (one per player) for a library game; groups players that are exactly tied
function rank(gameId, start, end, userIds) { const rows = db.prepare(`SELECT m.* FROM lib_run_metrics m JOIN runs r ON r.id = m.run_id WHERE m.game_id = ? AND m.created_at BETWEEN ? AND ? AND r.held = 0`).all(gameId, start, end);
  const best = new Map(); for (const r of rows) { if (userIds && !userIds.includes(r.user_id)) continue; const b = best.get(r.user_id); if (!b || cmp(gameId, r, b) < 0) best.set(r.user_id, r); }
  const list = [...best.values()].sort((a, b) => cmp(gameId, a, b)); let place = 0; list.forEach((r, i) => { if (i === 0 || cmp(gameId, list[i - 1], r) !== 0) place = i + 1; r.place = place; });
  const tiedForFirst = list.filter(r => r.place === 1); return { list, metrics: metricsFor(gameId), tie: tiedForFirst.length > 1 ? tiedForFirst.map(r => r.user_id) : null }; }

// ---- playoffs ------------------------------------------------------------------------------------------------------
function createPlayoff({ giveawayId, gameId, userIds, windowMin, adminId, parentId, round, note }) {
  const ids = [...new Set((userIds || []).map(Number).filter(Boolean))]; if (ids.length < 2) throw new Error('need at least 2 tied players');
  const t = Date.now(), seed = crypto.randomBytes(16).toString('hex'); const w = Math.max(10, Math.min(7 * 24 * 60, Number(windowMin) || 60));
  const id = db.prepare('INSERT INTO lib_playoffs (giveaway_id,game_id,round,seed,opens_at,closes_at,status,parent_id,created_by,created_at,note) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(giveawayId || null, gameId, round || 1, seed, t, t + w * 60e3, 'open', parentId || null, adminId || null, t, note || '').lastInsertRowid;
  const ins = db.prepare('INSERT INTO lib_playoff_entries (playoff_id,user_id) VALUES (?,?)'); for (const u of ids) ins.run(id, u); return getPlayoff(id); }
function getPlayoff(id) { const p = db.prepare('SELECT * FROM lib_playoffs WHERE id=?').get(id); if (!p) return null; p.entries = db.prepare('SELECT user_id, run_id, score, m1, m2, started_at FROM lib_playoff_entries WHERE playoff_id=?').all(id); p.metrics = metricsFor(p.game_id); return p; }
// run/start hook: a playoff run gets the playoff seed; exactly one start per player per round, only inside the window
function checkStart(user, gameId, playoffId) { const p = db.prepare('SELECT * FROM lib_playoffs WHERE id=?').get(Number(playoffId)); const t = Date.now();
  if (!p || p.game_id !== gameId) return { ok: false, status: 404, error: 'Playoff not found for this game.' }; if (p.status !== 'open' || t < p.opens_at || t > p.closes_at) return { ok: false, status: 403, error: 'This playoff window is closed.' };
  const e = db.prepare('SELECT * FROM lib_playoff_entries WHERE playoff_id=? AND user_id=?').get(p.id, user.id); if (!e) return { ok: false, status: 403, error: 'You are not in this playoff.' }; if (e.started_at) return { ok: false, status: 409, error: 'You already used your one playoff run.' };
  return { ok: true, seed: p.seed, bind: (rid) => db.prepare('UPDATE lib_playoff_entries SET rid=?, started_at=? WHERE playoff_id=? AND user_id=?').run(rid, t, p.id, user.id) }; }
// resolve: best playoff run wins (score, then metrics). No-shows rank last. Exact tie among the best -> new round with a new seed.
function resolve(id, adminId) { const p = getPlayoff(id); if (!p) throw new Error('not found'); if (p.status !== 'open') return p;
  const played = p.entries.filter(e => e.run_id != null); const all = p.entries.map(e => e.run_id != null ? e : { ...e, score: -1, m1: null, m2: null });
  all.sort((a, b) => cmp(p.game_id, a, b)); const top = all.filter(e => cmp(p.game_id, e, all[0]) === 0);
  if (!played.length || top.length > 1) { db.prepare("UPDATE lib_playoffs SET status='tied' WHERE id=?").run(id); const next = createPlayoff({ giveawayId: p.giveaway_id, gameId: p.game_id, userIds: top.map(e => e.user_id), windowMin: (p.closes_at - p.opens_at) / 60e3, adminId, parentId: id, round: p.round + 1, note: 'sudden death: still tied after round ' + p.round }); return { ...getPlayoff(id), next }; }
  db.prepare("UPDATE lib_playoffs SET status='decided', winner_user_id=? WHERE id=?").run(all[0].user_id, id); return getPlayoff(id); }

function mount(app, { requireUser, requireAdmin }) {
  // player: my open playoffs (shown as a banner in the library); admin: list/create/resolve; standings with skill tie-breaks
  app.get('/api/games-lib/playoffs/mine', requireUser, (req, res) => res.json({ ok: true, playoffs: db.prepare(`SELECT p.id, p.game_id, p.round, p.closes_at, e.started_at FROM lib_playoffs p JOIN lib_playoff_entries e ON e.playoff_id = p.id WHERE e.user_id=? AND p.status='open' AND p.closes_at > ?`).all(req.user.id, Date.now()) }));
  app.get('/api/admin/games-lib/standings', requireAdmin, (req, res) => { const q = req.query; res.json({ ok: true, ...rank(String(q.game_id), Number(q.start) || 0, Number(q.end) || Date.now()) }); });
  app.get('/api/admin/games-lib/playoffs', requireAdmin, (req, res) => res.json({ ok: true, playoffs: db.prepare('SELECT id FROM lib_playoffs ORDER BY id DESC LIMIT 100').all().map(r => getPlayoff(r.id)) }));
  app.post('/api/admin/games-lib/playoffs', requireAdmin, (req, res) => { try { const b = req.body || {}; let ids = b.user_ids; if (!ids && b.game_id && b.start) ids = (rank(String(b.game_id), Number(b.start), Number(b.end) || Date.now()).tie || []); res.json({ ok: true, playoff: createPlayoff({ giveawayId: b.giveaway_id, gameId: String(b.game_id), userIds: ids, windowMin: b.window_min, adminId: req.user && req.user.id }) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
  app.post('/api/admin/games-lib/playoffs/:id/resolve', requireAdmin, (req, res) => { try { res.json({ ok: true, playoff: resolve(Number(req.params.id), req.user && req.user.id) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
}
module.exports = { metricsFor, derive, record, cmp, rank, createPlayoff, getPlayoff, checkStart, resolve, mount };

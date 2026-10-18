'use strict';
// v8 skill engine: achievements and quests at scale, generated on demand (nothing is stored per definition).
//  * ACHIEVEMENTS: per game seven ladders (best score 30 tiers, runs 25, playtime 20, longest run 15, play days 15, personal bests 15,
//    good runs 10 = 130 per game) + ~260 hub-wide ladders. 93 games -> 12,000+ achievements. A definition is a pure function of
//    its id (`a2:<game>:<family>:<n>`); only unlocks are stored (ach2_unlocks), so memory is O(games), not O(achievements).
//  * QUESTS: daily / weekly / seasonal, skill-based (score targets, beating your own best, consistency, survival, variety, play days)
//    scaled from each game's score tiers. Assignments are stored per user+period so they never change mid-period; progress is read
//    from the server's accepted (held=0, non-demo) runs; claims are idempotent (PRIMARY KEY).
// Rewards are cosmetic: small Hub Credits and earn-only universe designs. Nothing here touches scores, entries or giveaway eligibility.
const db = require('./db');
const cfg = require('./config');
const UNI = require('./cosmetic-universe');
const PR = () => require('./progress');
const SEA = () => require('./seasons');

db.exec(`
CREATE TABLE IF NOT EXISTS ach2_unlocks (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, aid TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (user_id, aid));
CREATE TABLE IF NOT EXISTS quest2_assign (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, period TEXT NOT NULL, pkey TEXT NOT NULL, slot INTEGER NOT NULL, qid TEXT NOT NULL, PRIMARY KEY (user_id, period, pkey, slot));
CREATE TABLE IF NOT EXISTS quest2_claims (user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, qid TEXT NOT NULL, at INTEGER NOT NULL, credits INTEGER NOT NULL DEFAULT 0, item_id TEXT NOT NULL DEFAULT '', PRIMARY KEY (user_id, qid));
`);

const fmt = (n) => Number(n).toLocaleString('en-US');
const hash = UNI.h32;
function nice(x) { if (!(x >= 1)) return 1; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 1)); return Math.max(1, Math.round(x / p) * p); }
let RANGES = {}; try { RANGES = require('../docs/score-ranges.json').games || {}; } catch {}

// ---------- games and their score scale ----------
let GCACHE = { t: 0, list: [], by: new Map() };
function games() {
  if (Date.now() - GCACHE.t < 30e3 && GCACHE.list.length) return GCACHE.list;
  let lib = []; try { lib = require('./games-lib').games || []; } catch {}
  const seen = new Set(); const list = [];
  for (const g of [...(cfg.GAMES || []), ...lib]) {
    if (!g || !g.id || seen.has(g.id) || g.retired || g.playable === false) continue; seen.add(g.id);
    const R = RANGES[g.id] || {}; const tr = Array.isArray(g.tiers) ? g.tiers : [];
    const casual = Math.max(1, (R.casual && R.casual.median) || tr[0] || 100);
    const good = Math.max(casual + 1, (R.good && R.good.median_pb) || tr[1] || casual * 4);
    const top = Math.max(good + 1, (R.top1 && R.top1.pb) || tr[2] || good * 1.6);
    const secs = Math.max(15, Math.min(1800, (R.run_seconds && R.run_seconds.p50) || 45));
    list.push({ id: g.id, title: g.title || g.id, casual, good, top, secs });
  }
  GCACHE = { t: Date.now(), list, by: new Map(list.map(g => [g.id, g])) };
  return list;
}
const gameOf = (id) => { games(); return GCACHE.by.get(id) || null; };

// ---------- achievements ----------
const TIER_WORDS = ['Rookie', 'Newcomer', 'Casual', 'Regular', 'Steady', 'Sharp', 'Skilled', 'Adept', 'Seasoned', 'Veteran', 'Expert', 'Elite', 'Master', 'Grandmaster', 'Champion', 'Paragon', 'Virtuoso', 'Prodigy', 'Legend', 'Mythic', 'Titan', 'Apex', 'Sovereign', 'Transcendent', 'Immortal', 'Unrivaled', 'Ascendant', 'Eternal', 'Celestial', 'Absolute', 'Peerless', 'Boundless', 'Radiant', 'Sublime', 'Supreme', 'Ultimate', 'Infinite', 'Primordial', 'Godlike', 'Final'];
const CREDITS = { bronze: 5, silver: 10, gold: 20, epic: 40, legendary: 100 };
const tierClass = (n, N) => { const f = n / N; return f <= 0.25 ? 'bronze' : f <= 0.5 ? 'silver' : f <= 0.75 ? 'gold' : f <= 0.92 ? 'epic' : 'legendary'; };
// per-game families: [id, label, noun, tiers, icon, ladder(g, N) -> thresholds, describe(v, g)]
const geo = (lo, hi, N) => { const out = []; for (let i = 0; i < N; i++) { let v = nice(lo * Math.pow(hi / lo, i / (N - 1))); if (out.length && v <= out[out.length - 1]) v = out[out.length - 1] + Math.max(1, Math.ceil(out[out.length - 1] * 0.05)); out.push(v); } return out; };
const FAMILIES = [
  { id: 'best', noun: 'High Score', N: 30, icon: 'trophy', ladder: (g, N) => geo(Math.max(1, g.casual * 0.5), g.top * 1.6, N), desc: (v, g) => `Score ${fmt(v)} in a single ${g.title} run` },
  { id: 'runs', noun: 'Run Count', N: 25, icon: 'gamepad-2', ladder: (g, N) => geo(1, 5000, N), desc: (v, g) => `Finish ${fmt(v)} ${g.title} run${v === 1 ? '' : 's'}` },
  { id: 'time', noun: 'Playtime', N: 20, icon: 'clock', ladder: (g, N) => geo(5, 3000, N), desc: (v, g) => `Play ${g.title} for ${fmt(v)} minute${v === 1 ? '' : 's'} in total` },
  { id: 'survive', noun: 'Survivor', N: 15, icon: 'shield', ladder: (g, N) => geo(Math.max(20, g.secs * 0.6), Math.max(120, g.secs * 10), N), desc: (v, g) => `Last ${fmt(v)} seconds in one ${g.title} run` },
  { id: 'days', noun: 'Regular', N: 15, icon: 'calendar-check', ladder: () => [1, 2, 3, 5, 7, 10, 14, 21, 30, 45, 60, 90, 120, 180, 365], desc: (v, g) => `Play ${g.title} on ${fmt(v)} different day${v === 1 ? '' : 's'}` },
  { id: 'pbs', noun: 'Record Breaker', N: 15, icon: 'trending-up', ladder: () => [1, 2, 3, 5, 8, 12, 17, 25, 35, 50, 70, 100, 150, 220, 300], desc: (v, g) => `Set ${fmt(v)} new personal best${v === 1 ? '' : 's'} in ${g.title}` },
  { id: 'good', noun: 'Consistency', N: 10, icon: 'target', ladder: () => [1, 3, 5, 10, 20, 40, 75, 150, 300, 600], desc: (v, g) => `Finish ${fmt(v)} strong ${g.title} runs (at or above ${fmt(nice(g.good * 0.8))})` },
];
const GLOBAL = [
  { id: 'runs', noun: 'Hub Runner', N: 40, icon: 'activity', ladder: () => geo(1, 50000, 40), desc: (v) => `Finish ${fmt(v)} runs across the Hub` },
  { id: 'days', noun: 'Daily Habit', N: 30, icon: 'calendar-check', ladder: () => geo(1, 400, 30), desc: (v) => `Play on ${fmt(v)} different days` },
  { id: 'games', noun: 'Explorer', N: 93, icon: 'compass', ladder: () => Array.from({ length: 93 }, (_, i) => i + 1), desc: (v) => `Score in ${fmt(v)} different games` },
  { id: 'items', noun: 'Collector', N: 40, icon: 'gem', ladder: () => geo(1, 3000, 40), desc: (v) => `Own ${fmt(v)} cosmetics` },
  { id: 'quests', noun: 'Questmaster', N: 30, icon: 'scroll', ladder: () => geo(1, 2000, 30), desc: (v) => `Complete ${fmt(v)} skill quests` },
  { id: 'streak', noun: 'Unbroken', N: 30, icon: 'flame', ladder: () => geo(2, 365, 30), desc: (v) => `Play ${fmt(v)} days in a row` },
];
const LCACHE = new Map(); // `${gameId}:${fam}` -> thresholds (tiny: 93 x 7 arrays)
function ladderOf(fam, g) { const key = (g ? g.id : '*') + ':' + fam.id; let l = LCACHE.get(key); if (!l) { l = fam.ladder(g, fam.N); LCACHE.set(key, l); } return l; }
function def(aid) {
  const m = /^a2:([a-z0-9-]{1,64}|\*):([a-z]{3,8}):(\d{1,3})$/.exec(String(aid)); if (!m) return null;
  const n = +m[3]; const g = m[1] === '*' ? null : gameOf(m[1]); if (m[1] !== '*' && !g) return null;
  const fam = (g ? FAMILIES : GLOBAL).find(f => f.id === m[2]); if (!fam || n < 1 || n > fam.N) return null;
  const target = ladderOf(fam, g)[n - 1]; const tier = tierClass(n, fam.N); const word = TIER_WORDS[Math.min(TIER_WORDS.length - 1, Math.floor((n - 1) * TIER_WORDS.length / fam.N))];
  return { id: aid, game: g ? g.id : null, game_title: g ? g.title : 'Hub', family: fam.id, n, of: fam.N, tier, icon: fam.icon, name: `${g ? g.title + ': ' : ''}${word} ${fam.noun} ${n > TIER_WORDS.length || fam.N > TIER_WORDS.length ? 'Tier ' + n : ''}`.trim(),
    desc: fam.desc(target, g || {}), target, credits: CREDITS[tier], item: n % 5 === 0 || n === fam.N };
}
function achievementTotal() { return games().length * FAMILIES.reduce((s, f) => s + f.N, 0) + GLOBAL.reduce((s, f) => s + f.N, 0); }

// ---------- stats ----------
const dayOf = (t) => PR().dayNum(t);
function gameStats(userId, onlyGames) {
  const sql = `SELECT game_id, score, duration_ms, created_at FROM runs WHERE user_id=? AND held=0 AND is_demo=0${onlyGames && onlyGames.length ? ` AND game_id IN (${onlyGames.map(() => '?').join(',')})` : ''} ORDER BY created_at, id`;
  const rows = db.prepare(sql).all(userId, ...(onlyGames && onlyGames.length ? onlyGames : []));
  const by = new Map(); const allDays = new Set();
  for (const r of rows) {
    const g = gameOf(r.game_id); let s = by.get(r.game_id); if (!s) { s = { runs: 0, best: 0, ms: 0, maxms: 0, days: new Set(), pbs: 0, good: 0 }; by.set(r.game_id, s); }
    s.runs++; s.ms += r.duration_ms || 0; s.maxms = Math.max(s.maxms, r.duration_ms || 0); const d = dayOf(r.created_at); s.days.add(d); allDays.add(d);
    if (r.score > s.best) { if (s.best > 0) s.pbs++; s.best = r.score; }
    if (g && r.score >= g.good * 0.8) s.good++;
  }
  return { by, allDays, total: rows.length };
}
function streakOf(days) { const a = [...days].sort((x, y) => x - y); let best = 0, cur = 0; a.forEach((d, i) => { cur = i && d === a[i - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); }); return best; }
function valueFor(famId, s) { return famId === 'best' ? s.best : famId === 'runs' ? s.runs : famId === 'time' ? Math.floor(s.ms / 60000) : famId === 'survive' ? Math.floor(s.maxms / 1000) : famId === 'days' ? s.days.size : famId === 'pbs' ? s.pbs : famId === 'good' ? s.good : 0; }
function globalValues(userId, st) {
  const owned = db.prepare('SELECT COUNT(*) c FROM user_items WHERE user_id=?').get(userId).c;
  const quests = db.prepare('SELECT COUNT(*) c FROM quest2_claims WHERE user_id=?').get(userId).c;
  return { runs: st.total, days: st.allDays.size, games: [...st.by.keys()].length, items: owned, quests, streak: streakOf(st.allDays) };
}

// ---------- evaluating + granting ----------
const insU = db.prepare('INSERT OR IGNORE INTO ach2_unlocks (user_id, aid, at) VALUES (?,?,?)');
const insLedger = db.prepare('INSERT OR IGNORE INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)');
const insItem = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)');
const hasItem = db.prepare('SELECT 1 FROM user_items WHERE user_id=? AND item_id=?');
// earn-only design for a key; probes a few deterministic candidates so a player is not given a duplicate they already own
function grantDesign(userId, key, t) {
  for (let probe = 0; probe < 8; probe++) { const id = U_ID(UNI.earnIndex(key + '#' + probe)); if (!hasItem.get(userId, id)) { insItem.run(userId, id, t); return id; } }
  return '';
}
const U_ID = (i) => UNI.idOf(i);
const LAST = new Map(); // userId -> last full evaluation time (full scans are throttled; single-game checks after a run are not)
function evaluate(userId, onlyGames, opts = {}) {
  const t = Date.now(); const list = onlyGames && onlyGames.length ? [...new Set(onlyGames)].filter(id => gameOf(id)) : null;
  if (!list && !opts.force) { const l = LAST.get(userId) || 0; if (t - l < 15e3) return { fresh: [], newCount: 0 }; LAST.set(userId, t); if (LAST.size > 5000) LAST.delete(LAST.keys().next().value); }
  const st = gameStats(userId, list); const have = new Set(db.prepare('SELECT aid FROM ach2_unlocks WHERE user_id=?').all(userId).map(r => r.aid));
  const fresh = [];
  const reach = (aid, fam, ladder, v) => { // every tier up to the current value
    for (let n = 1; n <= ladder.length && ladder[n - 1] <= v; n++) { const id = aid + n; if (!have.has(id)) fresh.push(id); }
  };
  for (const g of (list ? list.map(gameOf) : games())) { const s = st.by.get(g.id); if (!s) continue; for (const fam of FAMILIES) reach(`a2:${g.id}:${fam.id}:`, fam, ladderOf(fam, g), valueFor(fam.id, s)); }
  if (!list || opts.force) { const gv = globalValues(userId, list ? gameStats(userId) : st); for (const fam of GLOBAL) reach(`a2:*:${fam.id}:`, fam, ladderOf(fam, null), gv[fam.id]); }
  const out = [];
  if (fresh.length) db.transaction(() => {
    let credits = 0;
    for (const id of fresh) {
      if (!insU.run(userId, id, t).changes) continue; const d = def(id); if (!d) continue; credits += d.credits;
      const item = d.item ? grantDesign(userId, id, t) : ''; out.push({ ...d, item_id: item });
    }
    if (credits) insLedger.run(userId, credits, 'ach2', 'batch:' + t + ':' + out.length, t);
  })();
  out.sort((a, b) => ['bronze', 'silver', 'gold', 'epic', 'legendary'].indexOf(b.tier) - ['bronze', 'silver', 'gold', 'epic', 'legendary'].indexOf(a.tier) || b.n - a.n);
  const notable = out.filter(d => d.tier === 'epic' || d.tier === 'legendary').slice(0, 3);
  for (const d of notable) { try { require('./notify').notify(userId, 'achievement', `Achievement unlocked: ${d.name}`, d.desc, '/achievements', d.icon, t); } catch {} }
  return { fresh: out.slice(0, 8).map(publicAch), newCount: out.length };
}
function publicAch(d) { return { id: d.id, cat: 'skill', tier: d.tier, icon: d.icon, game: d.game, hidden: false, name: d.name, desc: d.desc, target: d.target, rewards: d.item_id ? [{ type: 'item', id: d.item_id, name: (require('./shop').resolve(d.item_id) || {}).name || 'Cosmetic' }] : [], credits: d.credits }; }

function summary(userId) {
  const st = gameStats(userId); const unlocked = new Map(); // game -> count
  let total = 0;
  for (const r of db.prepare('SELECT aid FROM ach2_unlocks WHERE user_id=?').all(userId)) { total++; const m = /^a2:([^:]+):/.exec(r.aid); unlocked.set(m[1], (unlocked.get(m[1]) || 0) + 1); }
  const perGame = FAMILIES.reduce((s, f) => s + f.N, 0);
  return { total: achievementTotal(), per_game: perGame, global: GLOBAL.reduce((s, f) => s + f.N, 0), unlocked: total,
    games: games().map(g => ({ id: g.id, title: g.title, total: perGame, unlocked: unlocked.get(g.id) || 0, played: st.by.has(g.id) })), hub: { total: GLOBAL.reduce((s, f) => s + f.N, 0), unlocked: unlocked.get('*') || 0 } };
}
function listFor(userId, gameId, famId) {
  const g = gameId === '*' ? null : gameOf(gameId); if (gameId !== '*' && !g) return null;
  const st = userId ? (g ? gameStats(userId, [g.id]) : gameStats(userId)) : { by: new Map(), allDays: new Set(), total: 0 };
  const vals = g ? (st.by.get(g.id) ? Object.fromEntries(FAMILIES.map(f => [f.id, valueFor(f.id, st.by.get(g.id))])) : {}) : (userId ? globalValues(userId, st) : {});
  const have = userId ? new Set(db.prepare("SELECT aid FROM ach2_unlocks WHERE user_id=? AND aid LIKE ?").all(userId, `a2:${gameId}:%`).map(r => r.aid)) : new Set();
  const out = [];
  for (const fam of (g ? FAMILIES : GLOBAL)) { if (famId && fam.id !== famId) continue; const lad = ladderOf(fam, g); for (let n = 1; n <= fam.N; n++) { const d = def(`a2:${gameId}:${fam.id}:${n}`); const v = vals[fam.id] || 0; out.push({ ...d, value: Math.min(v, d.target), unlocked: have.has(d.id) || v >= lad[n - 1] }); } }
  return { game: g ? { id: g.id, title: g.title } : { id: '*', title: 'Hub-wide' }, families: (g ? FAMILIES : GLOBAL).map(f => ({ id: f.id, noun: f.noun, tiers: f.N })), items: out };
}

// ---------- quests ----------
const QTIERS = ['easy', 'normal', 'hard', 'elite', 'mythic'];
const SLOTS = { daily: [0, 1, 1, 2], weekly: [1, 1, 2, 3, 3], seasonal: [2, 2, 3, 3, 4, 4] };
const KINDS = { daily: ['score', 'improve', 'consistent', 'survive', 'variety'], weekly: ['score', 'improve', 'consistent', 'survive', 'variety', 'days'], seasonal: ['score', 'improve', 'consistent', 'survive', 'variety', 'days'] };
const PERIOD_F = { daily: 1, weekly: 1.15, seasonal: 1.3 };
const QCREDITS = { daily: [10, 18, 30, 50, 80], weekly: [40, 70, 120, 200, 320], seasonal: [150, 250, 400, 650, 1000] };
const lerp = (a, b, t) => a + (b - a) * t;
function windowOf(period, t = Date.now()) {
  const day = dayOf(t);
  if (period === 'daily') return { key: 'D' + day, start: PR().dayStart(day), end: PR().dayStart(day + 1) };
  if (period === 'weekly') { const w = Math.floor((day + 3) / 7); const s = w * 7 - 3; return { key: 'W' + w, start: PR().dayStart(s), end: PR().dayStart(s + 7) }; }
  const s = SEA().seasonAt(t); return { key: 'S' + s.number, start: s.start_at, end: s.end_at + 1 };
}
function scoreTarget(g, tier, period) { const c = g.casual, gd = g.good, tp = g.top; const base = [c * 0.9, lerp(c, gd, 0.6), gd, lerp(gd, tp, 0.7), tp * 1.1][tier]; return nice(base * PERIOD_F[period]); }
function build(period, key, slot, kind, gameId, tier) {
  const g = gameId && gameId !== 'any' ? gameOf(gameId) : null; const tn = QTIERS[tier]; const pf = PERIOD_F[period];
  const q = { id: `q2.${period}.${key}.${slot}.${kind}.${gameId || 'any'}.${tier}`, period, kind, tier: tn, game: g ? g.id : null, game_title: g ? g.title : null };
  if (kind === 'score') { q.target = scoreTarget(g, tier, period); q.title = `${g.title}: reach ${fmt(q.target)}`; q.desc = `Score ${fmt(q.target)} or more in a single ${g.title} run.`; q.unit = 'score'; }
  else if (kind === 'improve') { q.mult = [0.85, 0.95, 1.03, 1.1, 1.25][tier]; q.title = `${g.title}: ${tier < 2 ? 'get close to' : 'beat'} your best`; q.unit = 'score'; q.floor = nice(g.casual * 0.9); }
  else if (kind === 'consistent') { const thr = nice(lerp(g.casual * 0.9, g.good * 0.8, tier / 4)); const cnt = Math.round([3, 4, 5, 8, 12][tier] * (period === 'daily' ? 1 : period === 'weekly' ? 2 : 4)); q.thr = thr; q.target = cnt; q.title = `${g.title}: ${cnt} solid runs`; q.desc = `Finish ${cnt} ${g.title} runs, each scoring at least ${fmt(thr)}.`; q.unit = 'runs'; }
  else if (kind === 'survive') { const secs = Math.round(Math.max(20, g.secs) * [0.8, 1.2, 1.8, 2.6, 3.6][tier] * (period === 'daily' ? 1 : period === 'weekly' ? 1.1 : 1.25) / 5) * 5; q.target = secs; q.thr = nice(g.casual * 0.4); q.title = `${g.title}: survive ${secs}s`; q.desc = `Last ${secs} seconds in one ${g.title} run while scoring at least ${fmt(q.thr)} (idle runs do not count).`; q.unit = 'seconds'; }
  else if (kind === 'variety') { const cnt = Math.max(2, Math.round([2, 3, 4, 6, 8][tier] * (period === 'daily' ? 1 : period === 'weekly' ? 1.5 : 2.5))); q.target = cnt; q.title = `Play ${cnt} games well`; q.desc = `Reach a solid score (at least that game's starter tier) in ${cnt} different games.`; q.unit = 'games'; }
  else { const cnt = period === 'weekly' ? [3, 4, 5, 6, 7][tier] : [8, 14, 20, 28, 40][tier]; q.target = cnt; q.title = `${cnt} days of real play`; q.desc = `Play on ${cnt} different days and reach a strong score in some game each day.`; q.unit = 'days'; }
  if (kind === 'improve') q.desc = q.desc || `Reach ${Math.round(q.mult * 100)}% of your own personal best in ${g.title}.`;
  q.credits = QCREDITS[period][tier]; q.item = tier >= 3; q.expires_at = null;
  return q;
}
function candidateGames(userId) {
  const since = Date.now() - 45 * 864e5;
  const rows = db.prepare('SELECT game_id, COUNT(*) c FROM runs WHERE user_id=? AND held=0 AND is_demo=0 AND created_at>? GROUP BY game_id ORDER BY c DESC LIMIT 10').all(userId, since).map(r => r.game_id).filter(gameOf);
  if (rows.length >= 3) return rows;
  const all = games().map(g => g.id); const start = hash('starter', userId) % Math.max(1, all.length);
  const filler = []; for (let i = 0; filler.length < 8 && i < all.length; i++) { const id = all[(start + i * 7) % all.length]; if (!rows.includes(id) && !filler.includes(id)) filler.push(id); }
  return [...rows, ...filler];
}
function assign(userId, period, win) {
  const have = db.prepare('SELECT slot, qid FROM quest2_assign WHERE user_id=? AND period=? AND pkey=? ORDER BY slot').all(userId, period, win.key);
  if (have.length >= SLOTS[period].length) return have.map(r => r.qid);
  const cands = candidateGames(userId); const kinds = KINDS[period]; const used = new Set(have.map(r => r.slot)); const out = have.map(r => r.qid); const usedKinds = new Set(out.map(q => q.split('.')[4]));
  const ins = db.prepare('INSERT OR IGNORE INTO quest2_assign (user_id, period, pkey, slot, qid) VALUES (?,?,?,?,?)');
  SLOTS[period].forEach((tier, slot) => {
    if (used.has(slot)) return;
    let kind = kinds[hash('qk', userId, period, win.key, slot) % kinds.length];
    for (let i = 0; i < kinds.length && usedKinds.has(kind); i++) kind = kinds[(kinds.indexOf(kind) + 1) % kinds.length];
    usedKinds.add(kind);
    const game = (kind === 'variety' || kind === 'days') ? 'any' : cands[hash('qg', userId, period, win.key, slot) % cands.length];
    const q = build(period, win.key, slot, kind, game, tier); ins.run(userId, period, win.key, slot, q.id); out.push(q.id);
  });
  db.prepare("DELETE FROM quest2_assign WHERE user_id=? AND period=? AND pkey<>? AND rowid IN (SELECT rowid FROM quest2_assign WHERE user_id=? AND period=? AND pkey<>? ORDER BY rowid LIMIT 40)").run(userId, period, win.key, userId, period, win.key);
  return db.prepare('SELECT qid FROM quest2_assign WHERE user_id=? AND period=? AND pkey=? ORDER BY slot').all(userId, period, win.key).map(r => r.qid);
}
const parseQ = (qid) => { const m = /^q2\.(daily|weekly|seasonal)\.([DWS]\d{1,6})\.(\d)\.(score|improve|consistent|survive|variety|days)\.([a-z0-9-]{1,64}|any)\.([0-4])$/.exec(String(qid)); if (!m) return null; if (m[5] !== 'any' && !gameOf(m[5])) return null; return build(m[1], m[2], +m[3], m[4], m[5], +m[6]); };
function progressOf(userId, q, win) {
  const run = (sql, ...a) => db.prepare(sql).all(userId, win.start, win.end, ...a);
  const base = 'FROM runs WHERE user_id=? AND held=0 AND is_demo=0 AND created_at>=? AND created_at<?';
  if (q.kind === 'score') return (db.prepare(`SELECT COALESCE(MAX(score),0) v ${base} AND game_id=?`).get(userId, win.start, win.end, q.game) || {}).v || 0;
  if (q.kind === 'improve') { const prior = (db.prepare('SELECT COALESCE(MAX(score),0) v FROM runs WHERE user_id=? AND held=0 AND is_demo=0 AND created_at<? AND game_id=?').get(userId, win.start, q.game) || {}).v || 0;
    q.prior = prior; q.target = Math.max(q.floor, Math.ceil(prior * q.mult)); q.desc = prior ? `Score ${fmt(q.target)} or more in ${q.game_title} (${Math.round(q.mult * 100)}% of your best of ${fmt(prior)}).` : `Score ${fmt(q.target)} or more in ${q.game_title} to set your first benchmark.`;
    return (db.prepare(`SELECT COALESCE(MAX(score),0) v ${base} AND game_id=?`).get(userId, win.start, win.end, q.game) || {}).v || 0; }
  if (q.kind === 'consistent') return (db.prepare(`SELECT COUNT(*) v ${base} AND game_id=? AND score>=?`).get(userId, win.start, win.end, q.game, q.thr) || {}).v || 0;
  if (q.kind === 'survive') return Math.floor(((db.prepare(`SELECT COALESCE(MAX(duration_ms),0) v ${base} AND game_id=? AND score>=?`).get(userId, win.start, win.end, q.game, q.thr) || {}).v || 0) / 1000);
  const rows = run(`SELECT game_id, MAX(score) b, created_at ${base} GROUP BY game_id, created_at/86400000`);
  if (q.kind === 'variety') { const ok = new Set(); for (const r of rows) { const g = gameOf(r.game_id); if (g && r.b >= g.casual * 0.9) ok.add(r.game_id); } return ok.size; }
  const days = new Set(); for (const r of rows) { const g = gameOf(r.game_id); if (g && r.b >= g.good * 0.5) days.add(dayOf(r.created_at)); } return days.size;
}
function board(userId, t = Date.now()) {
  const out = { now: t, space: questSpace() };
  for (const period of ['daily', 'weekly', 'seasonal']) {
    const win = windowOf(period, t); const ids = assign(userId, period, win);
    out[period] = { key: win.key, ends_at: win.end, quests: ids.map(parseQ).filter(Boolean).map(q => {
      const v = progressOf(userId, q, win); const claim = db.prepare('SELECT credits, item_id FROM quest2_claims WHERE user_id=? AND qid=?').get(userId, q.id);
      return { ...q, expires_at: win.end, progress: Math.min(v, q.target), done: v >= q.target, claimed: !!claim, reward: { credits: q.credits, item: q.item } };
    }) };
  }
  return out;
}
function claim(userId, qid, t = Date.now()) {
  const q = parseQ(qid); if (!q) return { ok: false, error: 'Unknown quest.' };
  const win = windowOf(q.period, t); if (!/^q2\.\w+\.([DWS]\d+)\./.test(qid) || RegExp.$1 !== win.key) return { ok: false, error: 'That quest has expired.' };
  const mine = db.prepare('SELECT 1 FROM quest2_assign WHERE user_id=? AND period=? AND pkey=? AND qid=?').get(userId, q.period, win.key, qid); if (!mine) return { ok: false, error: 'That quest is not on your board.' };
  const v = progressOf(userId, q, win); if (v < q.target) return { ok: false, error: 'Not finished yet.' };
  let res = null;
  db.transaction(() => {
    if (db.prepare('SELECT 1 FROM quest2_claims WHERE user_id=? AND qid=?').get(userId, qid)) return;
    const item = q.item ? grantDesign(userId, qid, t) : '';
    db.prepare('INSERT INTO quest2_claims (user_id, qid, at, credits, item_id) VALUES (?,?,?,?,?)').run(userId, qid, t, q.credits, item);
    insLedger.run(userId, q.credits, 'quest2', qid, t); res = { credits: q.credits, item_id: item };
  })();
  if (!res) return { ok: false, error: 'Already claimed.' };
  const item = res.item_id ? require('./shop').resolve(res.item_id) : null;
  try { evaluate(userId, null, { force: true }); } catch {}
  return { ok: true, credits: res.credits, item: item ? { id: item.id, name: item.name, rarity: item.rarity, art: '/shop/art/' + item.id + '.svg' } : null };
}
function questSpace() { const g = games().length; return { definitions: g * (4 * 5 * 3) + 2 * 5 * 3 * g + 15 * 3 + 5 * 2 * 3 * 2, kinds: 6, periods: 3, tiers: 5, games: g }; }
module.exports = { games, def, FAMILIES, GLOBAL, achievementTotal, evaluate, summary, listFor, board, claim, parseQ, windowOf, questSpace, ladderOf, gameOf, publicAch };

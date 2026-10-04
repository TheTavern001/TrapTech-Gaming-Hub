'use strict';
// v4: giveaway standings with deterministic tiebreaks, locked final results, verifiable random draws,
// winner review (confirm / disqualify with auto-promotion) and an audit log.
const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');
const N = require('./notify');
const now = () => Date.now();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (key, msg) => crypto.createHmac('sha256', key).update(msg).digest('hex');

// Shown verbatim on the giveaway page, the live leaderboard and in the Official Rules.
const TIEBREAK_RULES = [
  'Higher score wins.',
  'If scores are tied, whoever reached that score first wins (server timestamp of the run that set it).',
  'If still tied, the player with fewer attempts (runs in the giveaway window) wins.',
  'If still tied, the earlier-submitted run (lower run ID) wins.',
];
const SCORE_RULE = 'Ranking uses each player\'s best qualifying score: runs must start and finish inside the giveaway window and meet the minimum score. With several linked games, the score is the sum of the best score in each game.';
const RANDOM_RULE = 'Random-draw giveaways use a verifiable commit-reveal draw. Before the giveaway starts we publish the SHA-256 hash of a secret seed. When it ends we lock the entrant list and publish its SHA-256 hash, then reveal the seed. Each entrant\'s draw key is HMAC-SHA256(seed, entrants_hash + ":" + username), and the lowest keys win in order. Anyone can recompute the result. Each entrant appears once, so nobody can be picked twice.';

const gamesOf = (gid) => db.prepare('SELECT game_id FROM giveaway_games WHERE giveaway_id=? ORDER BY rowid').all(gid).map(r => r.game_id);
const winnerCount = (g) => g.winner_count > 0 ? g.winner_count : Math.max(1, String(g.prize_tiers || '').split('\n').map(x => x.trim()).filter(Boolean).filter(x => !/random/i.test(x) || g.win_method === 'random').length);
// SQL expression: max plausible score for a run given server-measured time (same caps as POST /api/score)
const capSql = () => `(CASE r.game_id ${cfg.GAMES.map(x => `WHEN '${x.id}' THEN MIN(${x.ac.max}, ${x.ac.perSec} * (r.created_at - r.started_at) / 1000.0 + ${x.ac.grace})`).join(' ')} ELSE 0 END)`;
const capFor = (run) => { const a = cfg.GAME_MAP[run.game_id].ac; return Math.min(a.max, Math.floor(a.perSec * (run.created_at - run.started_at) / 1000 + a.grace)); };

const U = 'u.id AS user_id, u.username, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge, u.eq_color, u.eq_effect, u.created_at AS joined_at';
const cache = new Map();
// Live standings (deterministic). Excludes banned players, players disqualified from this giveaway and impossible (over-cap) runs.
function liveStandings(g) {
  const games = gamesOf(g.id); if (!games.length) return [];
  const sig = db.prepare(`SELECT MAX(id) AS m, COUNT(*) AS c FROM runs`).get();
  const dq = db.prepare('SELECT COUNT(*) AS c, MAX(created_at) AS m FROM giveaway_dq WHERE giveaway_id=?').get(g.id);
  const en = db.prepare('SELECT COUNT(*) AS c, MAX(joined_at) AS j, MAX(left_at) AS l FROM giveaway_entries WHERE giveaway_id=?').get(g.id);
  const key = `${g.id}:${g.updated_at}:${sig.m}:${sig.c}:${dq.c}:${dq.m}:${games.join()}:${en.c}:${en.j}:${en.l}`;
  const hit = cache.get(g.id); if (hit && hit.key === key && now() - hit.at < 5000) return hit.rows;
  const ph = games.map(() => '?').join(',');
  const X = module.exports.scoring; // v7 builder score rules (src/admin-scoring.js); legacy giveaways keep this query
  const rows = X && X.custom(g) ? X.standings(g, games, capSql(), E()) : db.prepare(`
    WITH w AS (SELECT r.id, r.user_id, r.game_id, r.score, r.created_at FROM runs r
               WHERE r.game_id IN (${ph}) AND r.started_at >= @s AND r.created_at >= @s AND r.created_at <= @e AND r.held = 0 AND (r.score <= ${capSql()} OR r.verify = 'cleared')),
    att AS (SELECT user_id, COUNT(*) AS attempts FROM w GROUP BY user_id),
    q AS (SELECT * FROM w WHERE score >= @min),
    -- best run per player per game: highest score, then the first run that reached it
    b AS (SELECT user_id, game_id, id, score, created_at, ROW_NUMBER() OVER (PARTITION BY user_id, game_id ORDER BY score DESC, created_at ASC, id ASC) AS rn FROM q),
    -- total = sum of per-game bests; "reached at" = when the last of those bests was set (that run is the deciding run)
    bb AS (SELECT user_id, id, created_at, SUM(score) OVER (PARTITION BY user_id) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM b WHERE rn = 1)
    SELECT ${U}, bb.tot AS score, bb.created_at AS reached_at, bb.id AS best_run_id, att.attempts
    FROM bb JOIN att ON att.user_id = bb.user_id JOIN users u ON u.id = bb.user_id
    WHERE bb.rl = 1 AND u.banned = 0 AND u.shadow_banned = 0 AND NOT EXISTS (SELECT 1 FROM giveaway_dq d WHERE d.giveaway_id = @gid AND d.user_id = bb.user_id)
    ${g.require_join ? 'AND EXISTS (SELECT 1 FROM giveaway_entries e WHERE e.giveaway_id = @gid AND e.user_id = bb.user_id AND e.left_at IS NULL)' : ''}
    ORDER BY score DESC, reached_at ASC, att.attempts ASC, best_run_id ASC`).all(...games, { s: g.start_at, e: g.end_at, min: g.min_score || 0, gid: g.id });
  tag(rows); rows.forEach(r => { if (r.weight == null) r.weight = E().weightOf(g, r.attempts); });
  cache.set(g.id, { key, rows, at: now() });
  if (cache.size > 20) for (const [id, c] of cache) if (now() - c.at > 5000) cache.delete(id); // only a 5 s cache: keep it small
  return rows;
}
// rank + which tiebreak separated a row from the one above it (for display)
function tag(rows) {
  rows.forEach((r, i) => {
    r.rank = i + 1; r.runs = r.attempts; r.last_at = r.reached_at; r.first_at = r.reached_at;
    const p = rows[i - 1]; r.tiebreak = null;
    if (p && p.score === r.score) r.tiebreak = p.reached_at !== r.reached_at ? 'time' : p.attempts !== r.attempts ? 'attempts' : 'run';
  });
  return rows;
}
// runs inside the window that break the per-game plausibility cap (excluded from ranking, shown to admins)
function excludedRuns(g) {
  const games = gamesOf(g.id); if (!games.length) return [];
  const ph = games.map(() => '?').join(',');
  return db.prepare(`SELECT r.id, r.user_id, u.username, r.game_id, r.score, r.started_at, r.created_at, r.duration_ms, r.ip_hash FROM runs r JOIN users u ON u.id = r.user_id
    WHERE r.game_id IN (${ph}) AND r.started_at >= ? AND r.created_at >= ? AND r.created_at <= ? AND (r.held <> 0 OR (r.score > ${capSql()} AND r.verify <> 'cleared')) ORDER BY r.score DESC LIMIT 200`)
    .all(...games, g.start_at, g.start_at, g.end_at).map(r => ({ ...r, cap: capFor(r) }));
}

function audit(gid, actor, action, username = null, detail = '') {
  db.prepare('INSERT INTO giveaway_audit (giveaway_id, created_at, actor, action, username, detail) VALUES (?,?,?,?,?,?)').run(gid, now(), actor, action, username, typeof detail === 'string' ? detail : JSON.stringify(detail));
}
function ensureCommit(g) {
  if (g.draw_commit) return g;
  const seed = crypto.randomBytes(32).toString('hex');
  db.prepare('UPDATE giveaways SET draw_seed=?, draw_commit=? WHERE id=? AND draw_commit IS NULL').run(seed, sha256(seed), g.id);
  const out = db.prepare('SELECT * FROM giveaways WHERE id=?').get(g.id);
  audit(g.id, 'system', 'seed_committed', null, { draw_commit: out.draw_commit });
  return out;
}
// weighted (activity) draws append |w<entries> so the published entrant hash also commits to every draw weight
const lineOf = (r) => `${r.rank}|${r.username}|${r.score}|${r.best_run_id}|${r.reached_at}|${r.attempts}${r.weight > 1 || r.weighted ? `|w${r.weight}` : ''}`;
const E = () => require('./eligibility');
// weighted draw key (Efraimidis-Spirakis): u = HMAC as a uniform number in (0,1); key = -ln(u) / weight; lowest keys win
const wKey = (h, w) => -Math.log((parseInt(h.slice(0, 13), 16) + 1) / (2 ** 52 + 1)) / w;

// Lock the final standings (idempotent). Late scores can never change the snapshot afterwards.
function finalize(g, actor = 'system', opts = {}) {
  g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(g.id);
  if (!g || g.finalized_at) return g;
  if (now() <= g.end_at && !opts.force) return g;
  g = ensureCommit(g);
  cache.delete(g.id);
  const rows = liveStandings(g).map(r => ({ ...r })); const t = now();
  const drawn = g.win_method === 'random' || g.win_method === 'hybrid'; // hybrid (v7 builder): top win_split by rank, the rest drawn
  const weighted = drawn && (g.weight_mode === 'activity' || rows.some(r => r.weight > 1));
  rows.forEach(r => { r.weighted = weighted; if (!weighted) r.weight = 1; });
  const hash = sha256(rows.map(lineOf).join('\n'));
  if (drawn) {
    rows.forEach(r => { r.draw_key = hmac(g.draw_seed, `${hash}:${r.username}`); });
    const k = (r) => weighted ? wKey(r.draw_key, r.weight) : 0;
    [...rows].sort((a, b) => weighted ? (k(a) - k(b)) || (a.draw_key < b.draw_key ? -1 : 1) : a.draw_key < b.draw_key ? -1 : 1).forEach((r, i) => { r.draw_pos = i + 1; });
  }
  const ins = db.prepare('INSERT INTO giveaway_results (giveaway_id, rank, user_id, username, score, best_run_id, reached_at, attempts, draw_key, draw_pos, locked_at, weight) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const done = db.transaction(() => {
    const claim = db.prepare('UPDATE giveaways SET finalized_at=?, entrants_hash=? WHERE id=? AND finalized_at IS NULL').run(t, hash, g.id);
    if (claim.changes !== 1) return false;
    for (const r of rows) ins.run(g.id, r.rank, r.user_id, r.username, r.score, r.best_run_id, r.reached_at, r.attempts, r.draw_key || null, r.draw_pos || null, t, weighted ? r.weight : null);
    audit(g.id, actor, 'finalized', null, { entrants: rows.length, entrants_hash: hash, method: g.win_method, winners: winnerCount(g), ...(drawn ? { seed_revealed: g.draw_seed, draw_commit: g.draw_commit } : {}) });
    return true;
  })();
  if (!done) return db.prepare('SELECT * FROM giveaways WHERE id=?').get(g.id);
  const fin = db.prepare('SELECT * FROM giveaways WHERE id=?').get(g.id);
  // anti-camping: skip winners who won elsewhere meanwhile (cooldown / one win per brand per month); next place is promoted
  for (let guard = 0; guard < 50; guard++) {
    const bad = results(fin).winners.map(w => [w, w.user_id && E().lockViolation(fin, w.user_id, t)]).find(x => x[1]);
    if (!bad) break;
    db.prepare('INSERT OR IGNORE INTO giveaway_dq (giveaway_id, user_id, reason, created_at) VALUES (?,?,?,?)').run(fin.id, bad[0].user_id, bad[1], t);
    audit(fin.id, 'system', 'ineligible_skipped', bad[0].username, { reason: bad[1] });
  }
  for (const w of results(fin).winners) notifyProvisional(fin, w, opts.quiet);
  return fin;
}
function notifyProvisional(g, w, quiet) {
  audit(g.id, 'system', 'provisional_winner', w.username, { place: w.place, score: w.score });
  if (!quiet && w.user_id) N.notify(w.user_id, 'winner', `You placed #${w.place} in "${g.title}"!`, 'Winner pending verification. An admin is reviewing the final standings, and we will confirm here once your result is verified (21+, fair play). Make sure your Potato username is set in Settings: that is how the Trap Tech team will contact winners.', `/giveaways/${g.id}/results`, 'party-popper');
}

// Final results from the locked snapshot (+ disqualifications/confirmations, which never change the snapshot itself)
function results(g) {
  if (!g.finalized_at) return null;
  const snap = db.prepare(`SELECT r.*, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge, u.eq_color, u.eq_effect FROM giveaway_results r LEFT JOIN users u ON u.id = r.user_id WHERE r.giveaway_id=? ORDER BY r.rank`).all(g.id);
  const dq = new Map(db.prepare('SELECT user_id, reason, created_at FROM giveaway_dq WHERE giveaway_id=?').all(g.id).map(d => [d.user_id, d]));
  const conf = new Map(db.prepare('SELECT user_id, created_at FROM giveaway_confirm WHERE giveaway_id=?').all(g.id).map(c => [c.user_id, c]));
  let order = g.win_method === 'random' ? [...snap].sort((a, b) => a.draw_pos - b.draw_pos) : snap;
  if (g.win_method === 'hybrid') { const top = snap.filter(r => r.user_id != null && !dq.has(r.user_id)).slice(0, g.win_split || 0); const s = new Set(top); order = [...top, ...snap.filter(r => !s.has(r)).sort((a, b) => a.draw_pos - b.draw_pos)]; }
  let place = 0; const n = winnerCount(g);
  for (const r of order) {
    const d = r.user_id != null ? dq.get(r.user_id) : null;
    r.disqualified = !!d; r.dq_reason = d ? d.reason : null;
    r.place = d || r.user_id == null ? null : ++place;
    r.winner = !!r.place && r.place <= n;
    r.state = r.winner ? (conf.has(r.user_id) ? 'confirmed' : 'pending') : null;
  }
  tagSnap(snap);
  return { finalized_at: g.finalized_at, method: g.win_method, winner_count: n, entrants: snap.length, entrants_hash: g.entrants_hash,
    standings: order, winners: order.filter(r => r.winner).map(r => ({ place: r.place, user_id: r.user_id, username: r.username, score: r.score, state: r.state, rank: r.rank })) };
}
function tagSnap(rows) { rows.forEach((r, i) => { const p = rows[i - 1]; r.tiebreak = p && p.score === r.score ? (p.reached_at !== r.reached_at ? 'time' : p.attempts !== r.attempts ? 'attempts' : 'run') : null; }); }

function disqualify(g, userId, reason, actor = 'admin') {
  reason = String(reason || '').trim().slice(0, 300); if (!reason) return { ok: false, error: 'A reason is required.' };
  const u = db.prepare('SELECT id, username FROM users WHERE id=?').get(userId); if (!u) return { ok: false, error: 'Player not found.' };
  const before = g.finalized_at ? results(g).winners.map(w => w.user_id) : [];
  const r = db.prepare('INSERT OR IGNORE INTO giveaway_dq (giveaway_id, user_id, reason, created_at) VALUES (?,?,?,?)').run(g.id, u.id, reason, now());
  if (!r.changes) return { ok: false, error: 'Already disqualified.' };
  db.prepare('DELETE FROM giveaway_confirm WHERE giveaway_id=? AND user_id=?').run(g.id, u.id);
  db.prepare('DELETE FROM winners WHERE giveaway_id=? AND user_id=?').run(g.id, u.id);
  cache.delete(g.id);
  audit(g.id, actor, 'disqualified', u.username, { reason });
  N.notify(u.id, 'giveaway', `Your entry in "${g.title}" was disqualified`, `Reason: ${reason}. Contact support if you think this is a mistake.`, `/giveaways/${g.id}/results`, 'shield-alert');
  const promoted = [];
  if (g.finalized_at) for (const w of results(g).winners) if (!before.includes(w.user_id)) { promoted.push(w); audit(g.id, 'system', 'promoted', w.username, { place: w.place, after_dq_of: u.username }); notifyProvisional(g, w); }
  return { ok: true, promoted };
}
function reinstate(g, userId, actor = 'admin') {
  const u = db.prepare('SELECT username FROM users WHERE id=?').get(userId);
  const r = db.prepare('DELETE FROM giveaway_dq WHERE giveaway_id=? AND user_id=?').run(g.id, userId);
  if (!r.changes) return { ok: false, error: 'Not disqualified.' };
  cache.delete(g.id); audit(g.id, actor, 'reinstated', u && u.username);
  return { ok: true };
}
function confirm(g, userId, actor = 'admin', note = '') {
  const res = results(g); if (!res) return { ok: false, error: 'Results are not final yet. The giveaway must end (or be ended early) first.' };
  const w = res.winners.find(x => x.user_id === userId); if (!w) return { ok: false, error: 'Only a current winning place can be confirmed.' };
  if (w.state === 'confirmed') return { ok: false, error: 'Already confirmed.' };
  const t = now();
  db.prepare('INSERT INTO giveaway_confirm (giveaway_id, user_id, place, note, created_at) VALUES (?,?,?,?,?)').run(g.id, userId, w.place, String(note || '').slice(0, 300), t);
  db.prepare('INSERT OR IGNORE INTO winners (giveaway_id, user_id, method, score, drawn_at) VALUES (?,?,?,?,?)').run(g.id, userId, g.win_method === 'random' ? 'random' : 'top', w.score, t);
  audit(g.id, actor, 'confirmed', w.username, { place: w.place, score: w.score, note });
  const pot = (db.prepare('SELECT potato FROM users WHERE id=?').get(userId) || {}).potato;
  N.notify(userId, 'winner', `Confirmed: you won "${g.title}"!`, `Place #${w.place}. Prize: ${g.prize || g.title}. The Trap Tech team will message you on Potato${pot ? ` (@${pot})` : ''} to verify eligibility (21+) and arrange your prize. ${pot ? 'Keep an eye on your Potato chats.' : 'Add your Potato username in Settings so we can reach you.'} We will never ask you for a password or payment.`, `/giveaways/${g.id}/results`, 'party-popper');
  try { db.prepare("INSERT OR IGNORE INTO badge_grants (user_id, badge_id, granted_by, note, created_at) VALUES (?, 'giveaway-winner', 'system', ?, ?)").run(userId, `Won "${g.title}"`.slice(0, 200), t);
    db.prepare("INSERT INTO badge_audit (user_id, username, badge_id, action, actor, note, created_at) VALUES (?,?,?,?,?,?,?)").run(userId, w.username || '', 'giveaway-winner', 'grant', 'system', `Auto: confirmed winner of "${g.title}"`.slice(0, 200), t); } catch (e) { /* badge tables optional */ }
  return { ok: true, winner: w };
}
// Public verification bundle for random draws (and the locked list for every giveaway)
function verifyBundle(g) {
  const res = results(g);
  const out = { method: g.win_method, draw_commit: g.draw_commit || null, finalized: !!res, rules: { tiebreak: TIEBREAK_RULES, random: RANDOM_RULE } };
  if (!res) return out;
  const lines = db.prepare('SELECT * FROM giveaway_results WHERE giveaway_id=? ORDER BY rank').all(g.id).map(r => lineOf({ ...r, weighted: r.weight != null }));
  out.entrants_hash = g.entrants_hash; out.entrant_lines = lines; out.hash_ok = sha256(lines.join('\n')) === g.entrants_hash;
  if (g.win_method === 'random' || g.win_method === 'hybrid') {
    out.seed = g.draw_seed; out.seed_ok = sha256(g.draw_seed) === g.draw_commit;
    out.weighted = g.weight_mode === 'activity' || res.standings.some(r => r.weight > 1); out.weight_rule = 'key = -ln((int(first 13 hex of HMAC, base 16) + 1) / (2^52 + 1)) / weight; lowest key wins';
    out.draw_order = res.standings.map(r => ({ pos: r.draw_pos, username: r.username, key: r.draw_key, weight: r.weight || 1, disqualified: r.disqualified }));
  }
  return out;
}
let sweeping = false;
function sweep() {
  if (sweeping) return 0; sweeping = true; let n = 0;
  try {
    for (const g of db.prepare('SELECT id FROM giveaways WHERE draw_commit IS NULL AND finalized_at IS NULL').all()) ensureCommit(g); // publish a commit for older giveaways
    for (const g of db.prepare('SELECT * FROM giveaways WHERE finalized_at IS NULL AND end_at < ?').all(now())) { finalize(g, 'system'); n++; }
  }
  catch (e) { console.error('finalize sweep failed', e); } finally { sweeping = false; }
  return n;
}
module.exports = { TIEBREAK_RULES, SCORE_RULE, RANDOM_RULE, liveStandings, excludedRuns, finalize, results, disqualify, reinstate, confirm, verifyBundle, ensureCommit, audit, sweep, winnerCount, capFor, gamesOf, sha256, hmac, lineOf };

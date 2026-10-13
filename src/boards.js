'use strict';
// v7: the global board only sums catalog games (retired games are archived, see src/games-v7.js).
// Leaderboard + giveaway-entrant queries shared by the API and the achievement engine.
const db = require('./db');
const PRIZE_PROOF = require('./prize-score-proof');
const cfg = require('./config');
const now = () => Date.now();
const U = 'u.id AS user_id, u.username, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge, u.eq_color, u.eq_effect';

function gameBoard(gameId, since = 0, until = Infinity, opts = {}) {
  const until2 = Number.isFinite(until) ? until : 8.64e15;
  const startCol = opts.byStart ? 'r.started_at' : 'r.created_at';
  return db.prepare(`
    SELECT ${U}, MAX(r.score) AS score, COUNT(*) AS runs, MAX(r.created_at) AS last_at, MIN(r.created_at) AS first_at
    FROM runs r JOIN users u ON u.id = r.user_id
    WHERE r.game_id = ? AND ${startCol} >= ? AND r.created_at >= ? AND r.created_at <= ? AND u.banned = 0 AND u.shadow_banned = 0 AND r.held = 0
    GROUP BY u.id ORDER BY score DESC, last_at ASC`).all(gameId, since, since, until2);
}
function globalBoard(since = 0) {
  return db.prepare(`
    SELECT ${U}, SUM(b.best) AS score, SUM(b.n) AS runs, MAX(b.last_at) AS last_at
    FROM (SELECT user_id, game_id, MAX(score) AS best, COUNT(*) AS n, MAX(created_at) AS last_at FROM runs WHERE created_at >= ? AND held = 0 GROUP BY user_id, game_id) b
    JOIN users u ON u.id = b.user_id WHERE u.banned = 0 AND u.shadow_banned = 0
    GROUP BY u.id ORDER BY score DESC, last_at ASC`).all(since);
}
const ranked = (rows) => rows.map((r, i) => ({ rank: i + 1, ...r }));

function giveawayGameIds(gid) {
  return db.prepare('SELECT game_id FROM giveaway_games WHERE giveaway_id=? ORDER BY rowid').all(gid).map(r => r.game_id);
}
// Entrants = signed-in players who STARTED and FINISHED a run of any linked game inside the window
// (and scored at least the giveaway's min_score). Giveaway score = sum of each player's best per linked game.
// v4: standings live in results.js (deterministic tiebreaks, over-cap runs excluded, locked snapshot after the end).
function giveawayEntrants(g) {
  const R = require('./results');
  if (g.finalized_at) {
    const res = R.results(g);
    return res.standings.filter(r => !r.disqualified && r.user_id != null).sort((a, b) => a.rank - b.rank)
      .map((r, i) => ({ ...r, rank: i + 1, final_rank: r.rank, runs: r.attempts, last_at: r.reached_at, first_at: r.reached_at }));
  }
  return R.liveStandings(g);
}
function giveawayStats(g) {
  const games = giveawayGameIds(g.id); if (!games.length) return { plays: 0, players: 0, qualifying_runs: 0 };
  const ph = games.map(() => '?').join(',');
  const r = db.prepare(`SELECT COUNT(*) AS plays, COUNT(DISTINCT user_id) AS players, SUM(CASE WHEN score >= ? AND held=0 AND verify='replay-ok' AND ${PRIZE_PROOF.sqlCertified('runs')} THEN 1 ELSE 0 END) AS q
    FROM runs WHERE event_id = ${+g.id} AND game_id IN (${ph}) AND started_at >= ? AND created_at >= ? AND created_at <= ?`).get(g.min_score || 0, ...games, g.start_at, g.start_at, g.end_at);
  const per = db.prepare(`SELECT game_id, COUNT(*) AS plays, COUNT(DISTINCT user_id) AS players, MAX(CASE WHEN held=0 AND verify='replay-ok' AND ${PRIZE_PROOF.sqlCertified('runs')} THEN score END) AS best FROM runs
    WHERE event_id = ${+g.id} AND game_id IN (${ph}) AND started_at >= ? AND created_at >= ? AND created_at <= ? GROUP BY game_id`).all(...games, g.start_at, g.start_at, g.end_at);
  return { plays: r.plays || 0, players: r.players || 0, qualifying_runs: r.q || 0, per_game: per };
}
function giveawayStatus(g, t = now()) { return t < g.start_at ? 'upcoming' : t > g.end_at ? 'past' : 'active'; }
function activeGiveawaysFor(gameId, at) {
  return db.prepare(`SELECT g.* FROM giveaways g JOIN giveaway_games gg ON gg.giveaway_id = g.id
    WHERE g.active = 1 AND gg.game_id = ? AND g.start_at <= ? AND g.end_at >= ?`).all(gameId, at, at);
}
module.exports = { gameBoard, globalBoard, ranked, giveawayGameIds, giveawayEntrants, giveawayStats, giveawayStatus, activeGiveawaysFor };

'use strict';
// v3 tournaments: timed events (best score in the window wins) and asynchronous 8-player brackets.
// Brackets are computed from stored runs: the qualifying window seeds the top 8, then each knockout round
// is a time window; the higher best score in that round's window advances (ties -> higher seed).
// No state is stored besides the tournament itself, so results can't drift from the validated runs.
const db = require('./db');
const cfg = require('./config');
const U = 'u.id AS user_id, u.username, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge';
const ROUNDS = ['Quarterfinals', 'Semifinals', 'Final'];
const SEED_ORDER = [[1, 8], [4, 5], [3, 6], [2, 7]];

function windowBoard(gameId, from, to) {
  return db.prepare(`SELECT ${U}, MAX(r.score) AS score, COUNT(*) AS runs, MAX(r.created_at) AS last_at FROM runs r JOIN users u ON u.id=r.user_id
    WHERE r.game_id=? AND r.started_at>=? AND r.created_at>=? AND r.created_at<=? AND u.banned=0 GROUP BY u.id ORDER BY score DESC, last_at ASC`).all(gameId, from, from, to)
    .map((r, i) => ({ rank: i + 1, ...r }));
}
function bestIn(gameId, userId, from, to) {
  const r = db.prepare('SELECT MAX(score) AS s FROM runs WHERE game_id=? AND user_id=? AND started_at>=? AND created_at>=? AND created_at<=?').get(gameId, userId, from, from, to);
  return r.s === null ? null : r.s;
}
function status(t, x = Date.now()) {
  if (x < t.start_at) return 'upcoming';
  if (x > t.end_at) return 'ended';
  if (t.format === 'bracket') { if (x <= t.qual_end_at) return 'qualifying'; const r = Math.min(2, Math.floor((x - t.qual_end_at) / t.round_ms)); return ['quarterfinals', 'semifinals', 'final'][r]; }
  return 'live';
}
function bracket(t, x = Date.now()) {
  const qual = windowBoard(t.game_id, t.start_at, t.qual_end_at);
  const seeds = qual.slice(0, 8);
  if (x <= t.qual_end_at) return { seeds: [], rounds: [], qualifying: qual, champion: null };
  const bySeed = (n) => seeds[n - 1] || null;
  let current = SEED_ORDER.map(([a, b]) => [bySeed(a) && { ...bySeed(a), seed: a }, bySeed(b) && { ...bySeed(b), seed: b }]);
  const rounds = []; let champion = null;
  for (let r = 0; r < 3; r++) {
    const from = t.qual_end_at + r * t.round_ms, to = from + t.round_ms - 1;
    const state = x < from ? 'upcoming' : x > to ? 'done' : 'live';
    const matches = current.map(([p, q]) => {
      const sp = p && state !== 'upcoming' ? bestIn(t.game_id, p.user_id, from, to) : null;
      const sq = q && state !== 'upcoming' ? bestIn(t.game_id, q.user_id, from, to) : null;
      let winner = null;
      if (state === 'done') {
        if (p && !q) winner = p; else if (q && !p) winner = q;
        else if (p && q) winner = (sp ?? -1) > (sq ?? -1) ? p : (sq ?? -1) > (sp ?? -1) ? q : (p.seed < q.seed ? p : q);
      }
      return { a: p && { ...p, score: sp }, b: q && { ...q, score: sq }, winner: winner ? winner.user_id : null, _w: winner };
    });
    rounds.push({ name: ROUNDS[r], from, to, state, matches: matches.map(({ _w, ...m }) => m) });
    if (state !== 'done') { // later rounds are shown as TBD placeholders
      for (let rr = r + 1; rr < 3; rr++) { const f2 = t.qual_end_at + rr * t.round_ms; rounds.push({ name: ROUNDS[rr], from: f2, to: f2 + t.round_ms - 1, state: 'upcoming', matches: Array.from({ length: 4 >> rr }, () => ({ a: null, b: null, winner: null, tbd: true })) }); }
      break;
    }
    const winners = matches.map(m => m._w);
    if (r === 2) { champion = winners[0] || null; break; }
    current = []; for (let i = 0; i < winners.length; i += 2) current.push([winners[i], winners[i + 1]]);
  }
  return { seeds: seeds.map((s, i) => ({ ...s, seed: i + 1 })), rounds, qualifying: qual, champion };
}
// Player placement summary across finished tournaments (for achievements)
function placements(userId, x = Date.now()) {
  const out = { entered: 0, podium: 0, wins: 0 };
  for (const t of db.prepare('SELECT * FROM tournaments WHERE active=1 AND start_at<=?').all(x)) {
    const played = db.prepare('SELECT 1 FROM runs WHERE user_id=? AND game_id=? AND started_at>=? AND created_at<=? LIMIT 1').get(userId, t.game_id, t.start_at, t.end_at);
    if (!played) continue; out.entered++;
    if (x <= t.end_at) continue;
    if (t.format === 'bracket') {
      const b = bracket(t, x); const fin = b.rounds[2];
      if (fin && fin.matches[0] && [fin.matches[0].a, fin.matches[0].b].some(p => p && p.user_id === userId)) out.podium++;
      if (b.champion && b.champion.user_id === userId) out.wins++;
    } else {
      const rows = windowBoard(t.game_id, t.start_at, t.end_at); const me = rows.find(r => r.user_id === userId);
      if (me && me.rank <= 3 && rows.length >= 3) out.podium++;
      if (me && me.rank === 1 && rows.length >= 2) out.wins++;
    }
  }
  return out;
}
module.exports = { windowBoard, bracket, status, placements, ROUNDS };

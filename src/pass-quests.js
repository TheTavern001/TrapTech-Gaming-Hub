'use strict';
// "Earn next season's pass FREE": a hard 48-quest chain, computed from honest (non-held) runs in the current season.
// Thresholds come from docs/pass-quests.json, tuned by tools/pass-quest-sim.js so that ~5% of active players finish
// (see docs/PASS-QUESTS.md). Finishing all 48 grants NEXT season's Season Pass (pass_owned, source 'quests').
// Nothing here touches scores, giveaways or eligibility.
const db = require('./db');
const cfg = require('./config');
const T = require('../docs/pass-quests.json');
const SE = () => require('./seasons');
const DAY = 86400e3;
const QUESTS = [];
for (const g of cfg.GAMES) { const th = T.games[g.id]; if (!th) continue;
  [['t1', 'I'], ['t2', 'II'], ['t3', 'III']].forEach(([k, n]) => QUESTS.push({ id: `${g.id}-${k}`, title: `${g.title} ${n}`, desc: `Personal best of ${th[k].toLocaleString('en-US')} in ${g.title} this season`, kind: 'pb', game: g.id, target: th[k] })); }
QUESTS.push({ id: 'days', title: 'Regular', desc: `Play on ${T.activity.days} different days this season`, kind: 'days', target: T.activity.days });
QUESTS.push({ id: 'runs', title: 'Grinder', desc: `Finish ${T.activity.runs} runs this season`, kind: 'runs', target: T.activity.runs });
QUESTS.push({ id: 'level60', title: 'Max Level', desc: 'Reach season level 60 on the free track (no boosts count)', kind: 'level', target: 60 });
QUESTS.push({ id: 'allinday', title: 'Full Card', desc: `Play all ${cfg.GAMES.length} games in one day`, kind: 'allinday', target: cfg.GAMES.length });
QUESTS.push({ id: 'gold5', title: 'Gold x5', desc: 'Gold tier personal best in 5 games', kind: 'gold', target: 5 });
QUESTS.push({ id: 'gold9', title: 'Gold x9', desc: 'Gold tier personal best in 9 games', kind: 'gold', target: 9 });
QUESTS.push({ id: 'goldall', title: 'Gold Everything', desc: `Gold tier personal best in all ${cfg.GAMES.length} games`, kind: 'gold', target: cfg.GAMES.length });
QUESTS.push({ id: 'streak14', title: 'Two-Week Streak', desc: 'Play 14 days in a row', kind: 'streak', target: 14 });
QUESTS.push({ id: 'elite30', title: 'Elite Thirty', desc: '30 runs at or above the tier-II score of their game', kind: 'elite', target: 30 });
if (QUESTS.length !== 48) console.warn('[pass-quests] expected 48 quests, have', QUESTS.length);

function status(userId, t = Date.now()) {
  const s = SE().seasonAt(t); const rows = db.prepare('SELECT game_id, score, created_at FROM runs WHERE user_id=? AND held=0 AND created_at BETWEEN ? AND ?').all(userId, s.start_at, s.end_at);
  const pb = {}; const days = new Set(); const perDay = new Map(); let elite = 0;
  const dk = (x) => require('./progress').dayNum ? require('./progress').dayNum(x) : Math.floor(x / DAY);
  for (const r of rows) { pb[r.game_id] = Math.max(pb[r.game_id] || 0, r.score); const d = dk(r.created_at); days.add(d); if (!perDay.has(d)) perDay.set(d, new Set()); perDay.get(d).add(r.game_id); const th = T.games[r.game_id]; if (th && r.score >= th.t2) elite++; }
  const ds = [...days].sort((a, b) => a - b); let best = 0, cur = 0; ds.forEach((d, i) => { cur = i && d === ds[i - 1] + 1 ? cur + 1 : 1; best = Math.max(best, cur); });
  const gold = cfg.GAMES.filter(g => (pb[g.id] || 0) >= g.tiers[2]).length; const allin = Math.max(0, ...[...perDay.values()].map(x => cfg.GAMES.filter(g => x.has(g.id)).length));
  const level = SE().levelOf(require('./progress').xpFor(userId, s.start_at, s.end_at)).level;
  const val = (q) => q.kind === 'pb' ? pb[q.game] || 0 : q.kind === 'days' ? days.size : q.kind === 'runs' ? rows.length : q.kind === 'level' ? level : q.kind === 'allinday' ? allin : q.kind === 'gold' ? gold : q.kind === 'streak' ? best : elite;
  const qs = QUESTS.map(q => { const v = val(q); return { id: q.id, title: q.title, desc: q.desc, progress: Math.min(v, q.target), target: q.target, done: v >= q.target }; });
  const done = qs.filter(q => q.done).length; const next = s.number + 1;
  const granted = !!db.prepare("SELECT 1 FROM pass_owned WHERE user_id=? AND season=?").get(userId, next);
  return { season: s.number, reward_season: next, done, total: qs.length, complete: done === qs.length, granted, quests: qs, est_completion: T.simulated_completion };
}
function claim(userId, t = Date.now()) { const st = status(userId, t); if (!st.complete) return { ok: false, error: `Finish all ${st.total} quests first (${st.done} done).` };
  db.prepare("INSERT OR IGNORE INTO pass_owned (user_id, season, source, created_at) VALUES (?,?, 'quests', ?)").run(userId, st.reward_season, t); return { ok: true, season: st.reward_season }; }
module.exports = { QUESTS, status, claim };

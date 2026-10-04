'use strict';
// v7 item 22: giveaway score rules for builder-made giveaways. results.liveStandings() calls standings() whenever
// custom(g) is true, and keeps its original query for everything else (legacy giveaways are untouched).
// Every rule returns rows with the same shape and the same deterministic tiebreaks as v4:
//   score DESC, reached_at ASC (when the deciding run was set), attempts ASC, best_run_id ASC.
// Rules (per-game weight w multiplies every run score of that game, rounded to an integer):
//   best      best single weighted run across the linked games
//   sum_best  sum of the best weighted run per linked game (the v4 default)
//   total     sum of every qualifying weighted run in the window
//   avg_top   average of the player's top N weighted runs (missing runs count as 0, so one lucky run can't win)
//   improved  sum over games of (best in window - best before the giveaway started); needs a score from before the start
// Also: runs created or started while the giveaway was paused don't count; min_runs = attempts needed to be ranked.
const db = require('./db');
const RULES = ['best', 'sum_best', 'total', 'avg_top', 'improved', 'campaign', 'fastest'];
const weightsOf = (gid) => { try { return Object.fromEntries(db.prepare('SELECT game_id, weight FROM giveaway_games WHERE giveaway_id=?').all(gid).map(r => [r.game_id, Number(r.weight) || 1])); } catch { return {}; } };
const pausesOf = (g) => { try { const p = JSON.parse(g.pauses || '[]'); return Array.isArray(p) ? p.filter(x => Array.isArray(x) && Number.isFinite(+x[0])) : []; } catch { return []; } };
const cfgOf = (g) => { try { return g.cfg ? JSON.parse(g.cfg) : {}; } catch { return {}; } };
function custom(g) {
  if (!g || !g.v7) return false;
  if (g.win_method === 'hybrid') return true;
  if (g.score_rule && g.score_rule !== 'sum_best') return true;
  if ((g.min_runs || 0) > 0 || pausesOf(g).length) return true;
  const gm = cfgOf(g).games || {}; if ((+gm.attempts || 0) > 0 || (+gm.run_cap_sec || 0) > 0) return true;
  const e = (cfgOf(g).entry || {}); if ((e.quest_bonus && e.quest_bonus.on) || (e.referral_bonus && e.referral_bonus.on)) return true;
  return Object.values(weightsOf(g.id)).some(w => w !== 1);
}
const U = 'u.id AS user_id, u.username, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge, u.eq_color, u.eq_effect, u.created_at AS joined_at';
function standings(g, games, capSql, E) {
  const rule = RULES.includes(g.score_rule) ? g.score_rule : 'sum_best';
  const w = weightsOf(g.id); const ph = games.map(() => '?').join(',');
  const wExpr = `CAST(ROUND(r.score * (CASE r.game_id ${games.map(id => `WHEN '${String(id).replace(/'/g, '')}' THEN ${Number(w[id]) || 1}`).join(' ')} ELSE 1 END)) AS INTEGER)`;
  const t = Date.now();
  const pz = pausesOf(g).map(([a, b]) => [Math.floor(+a), Math.floor(Number.isFinite(+b) && b ? +b : t + 1)]);
  const pauseSql = pz.map(([a, b]) => ` AND NOT (r.created_at BETWEEN ${a} AND ${b}) AND NOT (r.started_at BETWEEN ${a} AND ${b})`).join('');
  const topN = Math.max(1, Math.min(50, g.score_top_n || 3));
  // competition format (Game Rules Profiles): attempt limit (first N counted runs per game), run cap (server-measured
  // seconds), campaign level set (only when runs carry a level; otherwise campaign = cumulative of the counted runs)
  const gm = cfgOf(g).games || {}; const attempts = Math.max(0, Math.min(100, parseInt(gm.attempts, 10) || 0)); const capS = Math.max(0, Math.min(86400, parseInt(gm.run_cap_sec, 10) || 0));
  const comp = gm.competition || {}; const lvl = rule === 'campaign' && hasCol('runs', 'level');
  const capRun = capS ? ` AND (r.created_at - r.started_at) <= ${capS * 1000 + 5000}` : '';
  const lvlSql = lvl ? ` AND r.level BETWEEN ${Math.max(0, parseInt(comp.level_from, 10) || 1)} AND ${Math.max(1, parseInt(comp.level_to, 10) || 999)}` : '';
  const base = `w0 AS (SELECT r.id, r.user_id, r.game_id, r.score, ${wExpr} AS ws, r.created_at, r.duration_ms AS dur${lvl ? ', r.level AS lv' : ''},
        ROW_NUMBER() OVER (PARTITION BY r.user_id, r.game_id ORDER BY r.created_at ASC, r.id ASC) AS an FROM runs r
      WHERE r.game_id IN (${ph}) AND r.started_at >= @s AND r.created_at >= @s AND r.created_at <= @e AND r.held = 0 AND (r.score <= ${capSql} OR r.verify = 'cleared')${pauseSql}${capRun}${lvlSql}),
    w AS (SELECT * FROM w0 ${attempts ? `WHERE an <= ${attempts}` : ''}),
    att AS (SELECT user_id, COUNT(*) AS attempts FROM w GROUP BY user_id),
    q AS (SELECT * FROM w WHERE score >= @min)`;
  let pick;
  if (rule === 'fastest') pick = `x AS (SELECT user_id, id, created_at, ws AS tot, dur, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ws DESC, dur ASC, created_at ASC, id ASC) AS rl FROM q)`;
  else if (rule === 'campaign' && lvl) pick = `b AS (SELECT user_id, lv, id, ws, created_at, ROW_NUMBER() OVER (PARTITION BY user_id, game_id, lv ORDER BY ws DESC, created_at ASC, id ASC) AS rn FROM q),
    x AS (SELECT user_id, id, created_at, SUM(ws) OVER (PARTITION BY user_id) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM b WHERE rn = 1)`;
  else if (rule === 'campaign') pick = `x AS (SELECT user_id, id, created_at, SUM(ws) OVER (PARTITION BY user_id) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM q)`;
  else if (rule === 'best') pick = `x AS (SELECT user_id, id, created_at, ws AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ws DESC, created_at ASC, id ASC) AS rl FROM q)`;
  else if (rule === 'total') pick = `x AS (SELECT user_id, id, created_at, SUM(ws) OVER (PARTITION BY user_id) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM q)`;
  else if (rule === 'avg_top') pick = `t AS (SELECT user_id, id, ws, created_at, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY ws DESC, created_at ASC, id ASC) AS rn FROM q),
    x AS (SELECT user_id, id, created_at, CAST(ROUND(SUM(ws) OVER (PARTITION BY user_id) * 1.0 / ${topN}) AS INTEGER) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM t WHERE rn <= ${topN})`;
  else if (rule === 'improved') pick = `pre AS (SELECT r.user_id, r.game_id, MAX(${wExpr}) AS base FROM runs r WHERE r.game_id IN (${games.map(() => '?').join(',')}) AND r.created_at < @s AND r.held = 0 GROUP BY r.user_id, r.game_id),
    b AS (SELECT q.user_id, q.game_id, q.id, q.ws, q.created_at, ROW_NUMBER() OVER (PARTITION BY q.user_id, q.game_id ORDER BY q.ws DESC, q.created_at ASC, q.id ASC) AS rn FROM q),
    imp AS (SELECT b.user_id, b.id, b.created_at, b.ws - pre.base AS gain FROM b JOIN pre ON pre.user_id = b.user_id AND pre.game_id = b.game_id WHERE b.rn = 1 AND b.ws > pre.base),
    x AS (SELECT user_id, id, created_at, SUM(gain) OVER (PARTITION BY user_id) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM imp)`;
  else pick = `b AS (SELECT user_id, game_id, id, ws, created_at, ROW_NUMBER() OVER (PARTITION BY user_id, game_id ORDER BY ws DESC, created_at ASC, id ASC) AS rn FROM q),
    x AS (SELECT user_id, id, created_at, SUM(ws) OVER (PARTITION BY user_id) AS tot, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC, id DESC) AS rl FROM b WHERE rn = 1)`;
  const sql = `WITH ${base}, ${pick}
    SELECT ${U}, x.tot AS score, x.created_at AS reached_at, x.id AS best_run_id, att.attempts
    FROM x JOIN att ON att.user_id = x.user_id JOIN users u ON u.id = x.user_id
    WHERE x.rl = 1 AND att.attempts >= @minruns AND u.banned = 0 AND NOT EXISTS (SELECT 1 FROM giveaway_dq d WHERE d.giveaway_id = @gid AND d.user_id = x.user_id)
    ${g.require_join ? 'AND EXISTS (SELECT 1 FROM giveaway_entries e WHERE e.giveaway_id = @gid AND e.user_id = x.user_id AND e.left_at IS NULL)' : ''}
    ${hasCol('users', 'shadow_banned') ? 'AND u.shadow_banned = 0' : ''}
    ORDER BY score DESC, ${rule === 'fastest' ? 'x.dur ASC, ' : ''}reached_at ASC, att.attempts ASC, best_run_id ASC`;
  const params = rule === 'improved' ? [...games, ...games] : [...games];
  const rows = db.prepare(sql).all(...params, { s: g.start_at, e: g.end_at, min: g.min_score || 0, gid: g.id, minruns: g.min_runs || 0 });
  // free bonus entries for random draws (never bought: quests completed + friends invited who played in the window)
  const e = cfgOf(g).entry || {};
  const qb = e.quest_bonus && e.quest_bonus.on ? { per: Math.max(1, +e.quest_bonus.per || 1), max: Math.max(0, Math.min(20, +e.quest_bonus.max || 3)) } : null;
  const rb = e.referral_bonus && e.referral_bonus.on ? { max: Math.max(0, Math.min(20, +e.referral_bonus.max || 3)) } : null;
  const qq = qb ? db.prepare('SELECT COUNT(*) AS c FROM quest_claims WHERE user_id=? AND idx<3 AND created_at BETWEEN ? AND ?') : null;
  const rq = rb ? db.prepare('SELECT COUNT(*) AS c FROM users f WHERE f.referred_by=? AND f.banned=0 AND EXISTS (SELECT 1 FROM runs r WHERE r.user_id=f.id AND r.created_at BETWEEN ? AND ?)') : null;
  const draw = g.win_method === 'random' || g.win_method === 'hybrid';
  const W = (E && E.WEIGHT) || { per: 5, max: 5 };
  for (const r of rows) {
    if (!draw) { r.weight = 1; continue; }
    let wt = g.weight_mode === 'activity' ? Math.min(W.max, 1 + Math.floor((r.attempts || 0) / W.per)) : 1;
    if (qb) wt += Math.min(qb.max, Math.floor(qq.get(r.user_id, g.start_at, g.end_at).c / qb.per));
    if (rb) wt += Math.min(rb.max, rq.get(r.user_id, g.start_at, g.end_at).c);
    r.weight = wt;
  }
  return rows;
}
const colCache = new Map();
function hasCol(t, c) { const k = t + '.' + c; if (!colCache.has(k)) colCache.set(k, db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)); return colCache.get(k); }
const RULE_TEXT = {
  best: 'Ranking uses each player\'s best single qualifying run across the linked games.',
  sum_best: 'Ranking uses the sum of each player\'s best qualifying run in every linked game.',
  total: 'Ranking uses the total of all of a player\'s qualifying runs in the window.',
  avg_top: (n) => `Ranking uses the average of each player's top ${n} qualifying runs (fewer runs count as 0, so consistency wins).`,
  campaign: 'Ranking uses the cumulative score across the campaign: every counted run in the level set adds up (best run per level when the game reports levels).',
  fastest: 'Ranking uses each player\'s best single run; equal scores are split by the faster completion (shorter server-measured run).',
  improved: 'Ranking uses improvement: the best score in the window minus the player\'s best score from before the giveaway started (per game, summed). Players need a score from before the start.',
};
function ruleText(g) { const r = RULES.includes(g.score_rule) ? g.score_rule : 'sum_best'; const t = RULE_TEXT[r]; return typeof t === 'function' ? t(g.score_top_n || 3) : t; }
module.exports = { RULES, custom, standings, weightsOf, pausesOf, ruleText, hasCol, clearColCache: () => colCache.clear() };

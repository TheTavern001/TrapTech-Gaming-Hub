'use strict';
// v4 routes: live giveaway standings (paginated + search + "you are #X of N"), locked final results,
// verifiable random draws, admin winner review (confirm / disqualify -> auto-promote), audit log and exports.
const db = require('./db');
const cfg = require('./config');
const ach = require('./achievements');
const R = require('./results');
const boards = require('./boards');

module.exports = function v4(app, A, h) {
  const { now, bad, currentUser, str, logActivity, sendCsv, iso, giveawayPublic } = h;
  const getG = (id, pub) => { const g = db.prepare(`SELECT * FROM giveaways WHERE id=?${pub ? ' AND active=1' : ''}`).get(id); return g ? R.ready(g) : null; };
  const gInfo = (g) => ({ id: g.id, title: g.title, host: g.host, prize: g.prize, status: boards.giveawayStatus(g), start_at: g.start_at, end_at: g.end_at,
    win_method: g.win_method || 'score', winner_count: R.winnerCount(g), min_score: g.min_score || 0, finalized_at: g.finalized_at || null,
    draw_commit: g.draw_commit || null, entrants_hash: g.entrants_hash || null, demo: !!g.is_demo,
    game_ids: R.gamesOf(g.id), game_title: R.gamesOf(g.id).map(x => cfg.GAME_MAP[x]?.title || x).join(' + '),
    prize_tiers: String(g.prize_tiers || '').split('\n').map(x => x.trim()).filter(Boolean) });
  const row = (r) => ({ rank: r.rank, username: r.username, demo: !!r.is_demo, cos: ach.publicCos(r), score: r.score, attempts: r.attempts, reached_at: r.reached_at,
    tiebreak: r.tiebreak || null, ...(r.final_rank !== undefined ? { final_rank: r.final_rank, place: r.place, winner: !!r.winner, state: r.state || null, draw_pos: r.draw_pos || null } : {}) });

  // ordered, non-disqualified standings (live, or the locked snapshot after the end)
  function standingsOf(g) {
    if (!g.finalized_at) return { rows: R.liveStandings(g), res: null };
    const res = R.results(g);
    const rows = res.standings.filter(r => !r.disqualified && r.user_id != null).sort((a, b) => a.rank - b.rank).map((r, i) => ({ ...r, final_rank: r.rank, rank: i + 1 }));
    // tiebreak labels relative to the row above in the published (post-DQ) order
    rows.forEach((r, i) => { const p = rows[i - 1]; r.tiebreak = p && p.score === r.score ? (p.reached_at !== r.reached_at ? 'time' : p.attempts !== r.attempts ? 'attempts' : 'run') : null; });
    return { rows, res };
  }

  app.get('/api/giveaways/:id/standings', (req, res) => {
    const t0 = process.hrtime.bigint();
    const g = getG(req.params.id, true); if (!g) return bad(res, 404, 'Giveaway not found');
    const hid = h.v7Hidden && h.v7Hidden(g); if (hid) return res.json({ ...hid, giveaway: gInfo(g), now: now() }); // v7: hidden until it ends
    const { rows, res: fin } = standingsOf(g);
    const per = Math.min(Math.max(parseInt(req.query.per || '50', 10) || 50, 5), 1000);
    const q = str(req.query.q, 40).toLowerCase();
    const user = currentUser(req);
    const meIdx = user ? rows.findIndex(r => r.user_id === user.id) : -1;
    const list = q ? rows.filter(r => r.username.toLowerCase().includes(q)) : rows;
    const pages = Math.max(1, Math.ceil(list.length / per));
    let page = Math.max(1, parseInt(req.query.page || '1', 10) || 1);
    if (req.query.around === 'me' && meIdx >= 0 && !q) page = Math.floor(meIdx / per) + 1;
    page = Math.min(page, pages);
    let me = null;
    if (user) {
      if (meIdx >= 0) {
        const r = rows[meIdx], above = rows[meIdx - 1];
        const n = R.winnerCount(g); const cut = g.win_method === 'random' ? null : rows[n - 1];
        me = { ...row(r), of: rows.length, gap_to_next: above ? above.score - r.score : null, next_username: above ? above.username : null,
          gap_to_win: cut && meIdx >= n ? cut.score - r.score : (meIdx < n && g.win_method !== 'random' ? 0 : null), page: Math.floor(meIdx / per) + 1 };
      } else {
        const dq = db.prepare('SELECT reason FROM giveaway_dq WHERE giveaway_id=? AND user_id=?').get(g.id, user.id);
        me = { rank: null, of: rows.length, disqualified: !!dq, username: user.username };
      }
    }
    const out = { ok: true, giveaway: gInfo(g), finalized: !!g.finalized_at, total: rows.length, matched: list.length, page, per, pages, q,
      rows: list.slice((page - 1) * per, page * per).map(row), me,
      winners: fin ? fin.winners.map(w => ({ place: w.place, username: w.username, score: w.score, state: w.state })) : [],
      winners_state: fin ? (fin.winners.length && fin.winners.every(w => w.state === 'confirmed') ? 'confirmed' : fin.winners.length ? 'pending' : 'none') : null,
      tiebreak_rules: R.TIEBREAK_RULES, score_rule: (h.v7Rule && h.v7Rule(g)) || R.SCORE_RULE, random_rule: R.RANDOM_RULE, refresh_ms: 10000, now: now() };
    out.ms = Number(process.hrtime.bigint() - t0) / 1e6;
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Server-Timing', `standings;dur=${out.ms.toFixed(1)}`);
    res.json(out);
  });
  app.get('/api/giveaways/:id/verify', (req, res) => {
    const g = getG(req.params.id, true); if (!g) return bad(res, 404, 'Giveaway not found');
    res.json({ ok: true, giveaway: gInfo(g), ...R.verifyBundle(g) });
  });

  // ---------- admin ----------
  const userBy = (b) => b.user_id ? db.prepare('SELECT id, username FROM users WHERE id=?').get(Number(b.user_id)) : db.prepare('SELECT id, username FROM users WHERE username=? COLLATE NOCASE').get(String(b.username || ''));
  function windowRuns(g, userIds) {
    const games = R.gamesOf(g.id); if (!games.length || !userIds.length) return [];
    return db.prepare(`SELECT id, user_id, game_id, score, coins, duration_ms, started_at, created_at, ip_hash, ua_hash FROM runs
      WHERE game_id IN (${games.map(() => '?').join(',')}) AND user_id IN (${userIds.map(() => '?').join(',')}) AND started_at >= ? AND created_at >= ? AND created_at <= ? ORDER BY created_at`)
      .all(...games, ...userIds, g.start_at, g.start_at, g.end_at);
  }
  const runInfo = (r, best) => { const cap = R.capFor(r); const el = r.created_at - r.started_at; return { id: r.id, game_id: r.game_id, score: r.score, duration_ms: r.duration_ms, elapsed_ms: el,
    rate: el > 0 ? +(r.score / (el / 1000)).toFixed(2) : null, per_sec_cap: (cfg.gameInfo(r.game_id) || { ac: {} }).ac.perSec, cap, pct_cap: cap > 0 ? Math.round(r.score / cap * 100) : null, over_cap: r.score > cap,
    ip: r.ip_hash ? r.ip_hash.slice(0, 8) : '', device: r.ua_hash ? r.ua_hash.slice(0, 6) : '', created_at: r.created_at, best: r.id === best }; };
  function review(g, n) {
    const { rows, res } = standingsOf(g);
    const method = g.win_method || 'score';
    let order = rows;
    if (res && method === 'random') order = rows.slice().sort((a, b) => a.draw_pos - b.draw_pos);
    const top = order.slice(0, n);
    const dqRows = res ? res.standings.filter(r => r.disqualified) : [];
    const ids = [...top, ...dqRows].map(r => r.user_id).filter(Boolean);
    const runs = windowRuns(g, ids); const byU = new Map(); for (const r of runs) { if (!byU.has(r.user_id)) byU.set(r.user_id, []); byU.get(r.user_id).push(r); }
    const users = new Map(db.prepare(`SELECT id, username, created_at, banned, potato FROM users WHERE id IN (${ids.map(() => '?').join(',') || 'NULL'})`).all(...ids).map(u => [u.id, u]));
    const otherIp = db.prepare(`SELECT DISTINCT u.username FROM runs r JOIN users u ON u.id = r.user_id WHERE r.ip_hash = ? AND r.user_id <> ? LIMIT 10`);
    const otherDev = db.prepare(`SELECT DISTINCT u.username FROM runs r JOIN users u ON u.id = r.user_id WHERE r.ip_hash = ? AND r.ua_hash = ? AND r.user_id <> ? LIMIT 10`);
    const entry = (r) => {
      const u = users.get(r.user_id) || {}; const mine = byU.get(r.user_id) || []; const info = mine.map(x => runInfo(x, r.best_run_id));
      const ips = [...new Set(mine.map(x => x.ip_hash).filter(Boolean))];
      const shared = new Set(), dev = new Set();
      for (const ip of ips) { otherIp.all(ip, r.user_id).forEach(x => shared.add(x.username)); }
      for (const x of new Set(mine.filter(m => m.ip_hash && m.ua_hash).map(m => m.ip_hash + '|' + m.ua_hash))) { const [ip, ua] = x.split('|'); otherDev.all(ip, ua, r.user_id).forEach(y => dev.add(y.username)); }
      const best = info.find(x => x.best);
      const flags = [];
      const over = info.filter(x => x.over_cap).length;
      if (over) flags.push({ level: 'high', code: 'over_cap', text: `${over} run${over > 1 ? 's' : ''} over the game's score cap (excluded from ranking)` });
      if (dev.size) flags.push({ level: 'high', code: 'shared_device', text: `Same IP + device as: ${[...dev].join(', ')}` });
      else if (shared.size) flags.push({ level: 'med', code: 'shared_ip', text: `Shares an IP hash with: ${[...shared].join(', ')}` });
      if (best && best.pct_cap >= 90) flags.push({ level: 'med', code: 'near_cap', text: `Best run is ${best.pct_cap}% of the score cap for its duration` });
      const mism = info.filter(x => x.duration_ms && Math.abs(x.elapsed_ms - x.duration_ms) > Math.max(5000, 0.25 * x.elapsed_ms)).length;
      if (mism) flags.push({ level: 'low', code: 'duration_mismatch', text: `${mism} run${mism > 1 ? 's' : ''} where the client duration differs from server time` });
      if (u.created_at && u.created_at > g.start_at - 864e5) flags.push({ level: 'low', code: 'new_account', text: 'Account created within 24h of the giveaway start (or during it)' });
      if (ips.length > 5) flags.push({ level: 'low', code: 'many_ips', text: `${ips.length} different IP hashes` });
      return { user_id: r.user_id, username: r.username, potato: u.potato || '', potato_url: u.potato ? `https://potato.im/${u.potato}` : '', joined_at: u.created_at || null, banned: !!u.banned, rank: r.rank, final_rank: r.final_rank ?? null, place: r.place ?? null, draw_pos: r.draw_pos ?? null,
        score: r.score, attempts: r.attempts, reached_at: r.reached_at, best_run_id: r.best_run_id, tiebreak: r.tiebreak || null,
        winner: res ? !!r.winner : r.rank <= R.winnerCount(g), state: r.state || (res ? null : 'live'), disqualified: !!r.disqualified, dq_reason: r.dq_reason || null,
        flags, ip_hashes: ips.map(x => x.slice(0, 8)), shared_ip_accounts: [...shared], shared_device_accounts: [...dev], runs: info.reverse() };
    };
    return { queue: top.map(entry), disqualified: dqRows.map(entry), total: rows.length };
  }
  A.get('/giveaways/:id/review', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    const n = Math.min(Math.max(parseInt(req.query.n || '10', 10) || 10, 1), 100);
    const t0 = Date.now(); const rv = review(g, n);
    res.json({ ok: true, giveaway: gInfo(g), finalized: !!g.finalized_at, n, ...rv, excluded_runs: R.excludedRuns(g).slice(0, 50).map(r => ({ ...runInfo(r, 0), username: r.username })),
      audit: db.prepare('SELECT * FROM giveaway_audit WHERE giveaway_id=? ORDER BY id DESC LIMIT 300').all(g.id), tiebreak_rules: R.TIEBREAK_RULES, ms: Date.now() - t0, now: now() });
  });
  A.get('/giveaways/:id/audit', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    res.json({ ok: true, audit: db.prepare('SELECT * FROM giveaway_audit WHERE giveaway_id=? ORDER BY id DESC').all(g.id) });
  });
  A.post('/giveaways/:id/finalize', (req, res) => {
    let g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!g) return bad(res, 404, 'Not found');
    if (g.finalized_at) return bad(res, 409, 'Final standings are already locked.');
    const t = now();
    if (t < g.start_at) return bad(res, 400, 'This giveaway has not started yet.');
    if (g.end_at > t) { db.prepare('UPDATE giveaways SET end_at=?, updated_at=? WHERE id=?').run(t, t, g.id); R.audit(g.id, 'admin', 'ended_early', null, { scheduled_end: g.end_at, ended_at: t }); }
    g = R.finalize({ id: g.id }, 'admin', { force: true });
    res.json({ ok: true, finalized_at: g.finalized_at, entrants_hash: g.entrants_hash, results: R.results(g).winners });
  });
  A.post('/giveaways/:id/confirm', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    const u = userBy(req.body || {}); if (!u) return bad(res, 404, 'Player not found.');
    const r = R.confirm(g, u.id, 'admin', str(req.body.note, 300)); if (!r.ok) return bad(res, 400, r.error);
    logActivity('winner', `${u.username} won "${g.title}" (${g.win_method === 'random' ? 'verified random draw' : `#${r.winner.place}, top score`})`, u.id, g.id);
    try { ach.evaluate(u.id, { games: [] }); } catch (e) { console.error(e); }
    res.json({ ok: true, winner: r.winner, results: R.results(g).winners });
  });
  A.post('/giveaways/:id/disqualify', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    const u = userBy(req.body || {}); if (!u) return bad(res, 404, 'Player not found.');
    const r = R.disqualify(g, u.id, req.body.reason, 'admin'); if (!r.ok) return bad(res, 400, r.error);
    db.prepare("DELETE FROM activity WHERE type='winner' AND ref_id=? AND user_id=?").run(g.id, u.id);
    res.json({ ok: true, promoted: r.promoted, results: g.finalized_at ? R.results(g).winners : [] });
  });
  A.post('/giveaways/:id/reinstate', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    const u = userBy(req.body || {}); if (!u) return bad(res, 404, 'Player not found.');
    const r = R.reinstate(g, u.id, 'admin'); if (!r.ok) return bad(res, 400, r.error);
    res.json({ ok: true, results: g.finalized_at ? R.results(g).winners : [] });
  });

  // exports: every entrant with every run in the window, and the locked final standings
  A.get('/export/giveaway/:id/runs.csv', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    const games = R.gamesOf(g.id); const { rows } = standingsOf(g);
    const rankOf = new Map(rows.map(r => [r.user_id, r])); const bestIds = new Set(rows.map(r => r.best_run_id));
    const dq = new Map(db.prepare('SELECT user_id, reason FROM giveaway_dq WHERE giveaway_id=?').all(g.id).map(d => [d.user_id, d.reason]));
    const runs = games.length ? db.prepare(`SELECT r.*, u.username FROM runs r JOIN users u ON u.id = r.user_id WHERE r.game_id IN (${games.map(() => '?').join(',')}) AND r.started_at >= ? AND r.created_at >= ? AND r.created_at <= ? ORDER BY u.username COLLATE NOCASE, r.created_at`)
      .all(...games, g.start_at, g.start_at, g.end_at) : [];
    const out = runs.map(r => { const cap = R.capFor(r); const st = rankOf.get(r.user_id); return { giveaway_id: g.id, username: r.username, user_id: r.user_id,
      standing: st ? st.rank : '', best_total: st ? st.score : '', attempts: st ? st.attempts : '', run_id: r.id, game_id: r.game_id, score: r.score, coins: r.coins,
      duration_ms: r.duration_ms, elapsed_ms: r.created_at - r.started_at, cap, over_cap: r.score > cap ? 'yes' : '', qualifying: r.score >= (g.min_score || 0) && r.score <= cap ? 'yes' : '',
      counted_best: bestIds.has(r.id) ? 'yes' : '', disqualified: dq.has(r.user_id) ? dq.get(r.user_id) : '', started_at: iso(r.started_at), created_at: iso(r.created_at), ip_hash: r.ip_hash || '', ua_hash: r.ua_hash || '' }; });
    sendCsv(res, `giveaway-${g.id}-all-runs.csv`, out, ['giveaway_id', 'username', 'user_id', 'standing', 'best_total', 'attempts', 'run_id', 'game_id', 'score', 'coins', 'duration_ms', 'elapsed_ms', 'cap', 'over_cap', 'qualifying', 'counted_best', 'disqualified', 'started_at', 'created_at', 'ip_hash', 'ua_hash']);
  });
  A.get('/export/giveaway/:id/final.csv', (req, res) => {
    const g = getG(req.params.id); if (!g) return bad(res, 404, 'Not found');
    if (!g.finalized_at) return bad(res, 409, 'Final standings are created when the giveaway ends.');
    const fin = R.results(g);
    const out = db.prepare('SELECT * FROM giveaway_results WHERE giveaway_id=? ORDER BY rank').all(g.id).map(s => { const r = fin.standings.find(x => x.rank === s.rank) || {};
      return { rank: s.rank, place: r.place || '', username: s.username, score: s.score, best_run_id: s.best_run_id, reached_at: iso(s.reached_at), attempts: s.attempts, tiebreak: r.tiebreak || '',
        draw_pos: s.draw_pos || '', draw_key: s.draw_key || '', disqualified: r.disqualified ? 'yes' : '', dq_reason: r.dq_reason || '', winner: r.winner ? 'yes' : '', winner_state: r.state || '', locked_at: iso(s.locked_at) }; });
    sendCsv(res, `giveaway-${g.id}-final-standings.csv`, out, ['rank', 'place', 'username', 'score', 'best_run_id', 'reached_at', 'attempts', 'tiebreak', 'draw_pos', 'draw_key', 'disqualified', 'dq_reason', 'winner', 'winner_state', 'locked_at']);
  });
};

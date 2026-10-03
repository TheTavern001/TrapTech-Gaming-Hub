'use strict';
// v3 routes: check-in streaks, daily quests, XP levels, seasons, tournaments, follows + friend boards,
// notifications, referrals, sharing (share pages + OG images), global search, and admin tournaments.
// Points and cosmetics only - nothing here has cash value.
const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');
const ach = require('./achievements');
const PR = require('./progress');
const TN = require('./tournaments');
const N = require('./notify');
const og = require('./og');
const boards = require('./boards');

module.exports = function v3(app, A, h) {
  const { now, bad, requireUser, currentUser, limiter, logActivity, str, publicRow } = h;
  const userRow = db.prepare('SELECT id, username, created_at, is_demo, eq_banner, eq_frame, eq_title, eq_badge, banned, ref_code FROM users WHERE username=?');
  const pub = (u) => ({ username: u.username, demo: !!u.is_demo, cos: ach.publicCos(u) });
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  const scoreText = (n, gid) => { const g = cfg.GAME_MAP[gid]; return g && g.unit === 'm' ? `${fmt(n)}m` : `${fmt(n)} ${g ? g.unit : 'pts'}`; };

  function ensureRefCode(userId) {
    const u = db.prepare('SELECT ref_code FROM users WHERE id=?').get(userId); if (u && u.ref_code) return u.ref_code;
    for (let i = 0; i < 10; i++) {
      const code = Array.from(crypto.randomBytes(6), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');
      try { db.prepare('UPDATE users SET ref_code=? WHERE id=?').run(code, userId); return code; } catch { /* collision, retry */ }
    }
    return null;
  }
  function levelOf(userId) { return PR.levelFor(PR.xpFor(userId)); }
  // extra fields for /api/me
  h.meExtras = (u) => ({ level: levelOf(u.id), streak: PR.streakInfo(u.id), unread: N.unreadCount(u), ref_code: ensureRefCode(u.id),
    following: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id=?').get(u.id).c });
  h.followingIds = (userId) => new Set(db.prepare('SELECT followee_id FROM follows WHERE follower_id=?').all(userId).map(r => r.followee_id));
  h.ensureRefCode = ensureRefCode;
  h.profileExtras = (u, me) => ({
    level: levelOf(u.id), streak: PR.streakInfo(u.id),
    followers: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followee_id=?').get(u.id).c,
    following: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE follower_id=?').get(u.id).c,
    i_follow: !!(me && db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?').get(me.id, u.id)),
    follows_me: !!(me && db.prepare('SELECT 1 FROM follows WHERE follower_id=? AND followee_id=?').get(u.id, me.id)),
    season: (() => { const s = PR.seasonProgress(u.id); return { number: s.number, name: s.name, tier: s.tier, xp: s.xp }; })(),
  });
  // called by /api/score after a run is stored: level-up notices, referral credit
  h.afterRun = (user, levelBefore) => {
    const out = {};
    const lv = levelOf(user.id); out.level = lv;
    if (levelBefore && lv.level > levelBefore.level) {
      out.level_up = lv.level;
      N.notify(user.id, 'level', `Level up! You reached level ${lv.level}`, 'Keep playing to earn XP and unlock more rewards.', '/season', 'chevrons-up');
      if (lv.level % 5 === 0) logActivity('levelup', `${user.username} reached level ${lv.level}`, user.id);
    }
    const u = db.prepare('SELECT referred_by FROM users WHERE id=?').get(user.id);
    if (u && u.referred_by && db.prepare('SELECT COUNT(*) AS c FROM runs WHERE user_id=?').get(user.id).c === 1) {
      N.notify(u.referred_by, 'referral', `${user.username} joined with your invite!`, 'Your referral counted: they finished their first run.', '/u/' + encodeURIComponent(user.username), 'gift');
      ach.evaluate(u.referred_by, { games: [] });
    }
    return out;
  };
  h.levelOf = levelOf;

  // ---------- streaks + quests ----------
  app.post('/api/checkin', requireUser, (req, res) => {
    const r = PR.checkin(req.user.id);
    if (r.fresh && [7, 30, 100].includes(r.current)) logActivity('streak', `${req.user.username} hit a ${r.current}-day streak`, req.user.id);
    const unlocked = r.fresh ? ach.evaluate(req.user.id, { games: [] }).fresh : [];
    res.json({ ok: true, streak: r, xp: r.xp, level: levelOf(req.user.id), unlocked });
  });
  app.get('/api/quests', requireUser, (req, res) => res.json({ ok: true, ...PR.questProgress(req.user.id), streak: PR.streakInfo(req.user.id), level: levelOf(req.user.id), now: now() }));
  app.post('/api/quests/:idx/claim', requireUser, limiter('quest', 30, 60e3), (req, res) => {
    const r = PR.claimQuest(req.user.id, parseInt(req.params.idx, 10));
    if (!r.ok) return bad(res, 400, r.error);
    const unlocked = ach.evaluate(req.user.id, { games: [] }).fresh;
    res.json({ ok: true, xp: r.xp, level: levelOf(req.user.id), unlocked, ...PR.questProgress(req.user.id) });
  });

  // ---------- seasons ----------
  app.get('/api/season', (req, res) => {
    const me = currentUser(req); const s = PR.seasonProgress(me && me.id);
    const board = PR.seasonBoard(50).map(r => ({ rank: r.rank, username: r.username, score: r.score, tier: r.tier, demo: !!r.is_demo, cos: ach.publicCos(r) }));
    res.json({ ok: true, season: s, signed_in: !!me, board, me: me ? board.find(r => r.username === me.username) || null : null, now: now() });
  });

  // ---------- tournaments ----------
  const tPublic = (t, x = now()) => {
    const st = TN.status(t, x); const g = cfg.GAME_MAP[t.game_id] || {};
    const board = TN.windowBoard(t.game_id, t.start_at, t.format === 'bracket' ? t.qual_end_at : t.end_at);
    return { id: t.id, title: t.title, game_id: t.game_id, game: g.title, art: g.art, unit: g.unit, format: t.format, description: t.description, prize: t.prize,
      start_at: t.start_at, qual_end_at: t.qual_end_at, round_ms: t.round_ms, end_at: t.end_at, status: st, players: board.length,
      leader: board[0] ? { ...pub(board[0]), score: board[0].score } : null, demo: !!t.is_demo };
  };
  app.get('/api/tournaments', (req, res) => {
    const rows = db.prepare('SELECT * FROM tournaments WHERE active=1 ORDER BY CASE WHEN end_at < ? THEN 2 WHEN start_at > ? THEN 1 ELSE 0 END, start_at DESC').all(now(), now());
    res.json({ ok: true, tournaments: rows.map(t => tPublic(t)), now: now() });
  });
  app.get('/api/tournaments/:id', (req, res) => {
    const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND active=1').get(req.params.id); if (!t) return bad(res, 404, 'Tournament not found');
    const me = currentUser(req); const out = tPublic(t);
    const row = (r) => ({ rank: r.rank, ...pub(r), score: r.score, runs: r.runs });
    if (t.format === 'bracket') {
      const b = TN.bracket(t);
      const side = (p) => p ? { ...pub(p), seed: p.seed, score: p.score } : null;
      out.bracket = { seeds: b.seeds.map(s => ({ seed: s.seed, ...pub(s), score: s.score })), champion: b.champion ? pub(b.champion) : null,
        rounds: b.rounds.map(r => ({ name: r.name, from: r.from, to: r.to, state: r.state, matches: r.matches.map(m => ({ a: side(m.a), b: side(m.b), winner: m.winner ? (m.a && m.a.user_id === m.winner ? 'a' : 'b') : null, tbd: !!m.tbd })) })) };
      out.qualifying = b.qualifying.slice(0, 50).map(row);
    } else out.board = TN.windowBoard(t.game_id, t.start_at, t.end_at).slice(0, 50).map(row);
    out.me = me ? (TN.windowBoard(t.game_id, t.start_at, t.format === 'bracket' ? t.qual_end_at : t.end_at).find(r => r.user_id === me.id) || null) : null;
    if (out.me) out.me = row(out.me);
    res.json({ ok: true, tournament: out, now: now() });
  });

  // ---------- follows + friends ----------
  app.post('/api/follow/:username', requireUser, limiter('follow', 60, 60e3), (req, res) => {
    const u = userRow.get(String(req.params.username)); if (!u || u.banned) return bad(res, 404, 'Player not found');
    if (u.id === req.user.id) return bad(res, 400, "You can't follow yourself.");
    const r = db.prepare('INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?,?,?)').run(req.user.id, u.id, now());
    if (r.changes) { N.notify(u.id, 'follow', `${req.user.username} followed you`, 'Follow back to see their runs in your feed and friends leaderboard.', '/u/' + encodeURIComponent(req.user.username), 'user-plus'); ach.evaluate(u.id, { games: [] }); }
    const unlocked = ach.evaluate(req.user.id, { games: [] }).fresh;
    res.json({ ok: true, following: true, followers: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followee_id=?').get(u.id).c, unlocked });
  });
  app.delete('/api/follow/:username', requireUser, (req, res) => {
    const u = userRow.get(String(req.params.username)); if (!u) return bad(res, 404, 'Player not found');
    db.prepare('DELETE FROM follows WHERE follower_id=? AND followee_id=?').run(req.user.id, u.id);
    res.json({ ok: true, following: false, followers: db.prepare('SELECT COUNT(*) AS c FROM follows WHERE followee_id=?').get(u.id).c });
  });
  app.get('/api/follows/:username', (req, res) => {
    const u = userRow.get(String(req.params.username)); if (!u || u.banned) return bad(res, 404, 'Player not found');
    const type = req.query.type === 'following' ? 'following' : 'followers';
    const rows = type === 'following'
      ? db.prepare('SELECT u.* FROM follows f JOIN users u ON u.id=f.followee_id WHERE f.follower_id=? AND u.banned=0 ORDER BY f.created_at DESC LIMIT 200').all(u.id)
      : db.prepare('SELECT u.* FROM follows f JOIN users u ON u.id=f.follower_id WHERE f.followee_id=? AND u.banned=0 ORDER BY f.created_at DESC LIMIT 200').all(u.id);
    res.json({ ok: true, type, users: rows.map(pub) });
  });

  // ---------- notifications ----------
  app.get('/api/notifications', requireUser, (req, res) => res.json({ ok: true, items: N.listFor(req.user), unread: N.unreadCount(req.user), now: now() }));
  app.post('/api/notifications/read', requireUser, (req, res) => { N.markRead(req.user, req.body.id ? parseInt(req.body.id, 10) : null); res.json({ ok: true, unread: N.unreadCount(req.user) }); });

  // ---------- referrals ----------
  app.get('/api/referral', requireUser, (req, res) => {
    const code = ensureRefCode(req.user.id);
    const rows = db.prepare('SELECT u.username, u.created_at, (SELECT COUNT(*) FROM runs WHERE user_id=u.id) AS runs FROM users u WHERE u.referred_by=? AND u.banned=0 ORDER BY u.created_at DESC').all(req.user.id);
    res.json({ ok: true, code, link: `/r/${code}`, joined: rows.length, counted: rows.filter(r => r.runs > 0).length, friends: rows.map(r => ({ username: r.username, counted: r.runs > 0, created_at: r.created_at })) });
  });
  app.get('/r/:code', (req, res) => {
    const code = String(req.params.code).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    const ok = db.prepare('SELECT 1 FROM users WHERE ref_code=?').get(code);
    res.redirect(302, ok ? `/signup?ref=${code}` : '/signup');
  });

  // ---------- sharing ----------
  app.post('/api/share', requireUser, limiter('share', 60, 60e3), (req, res) => {
    const kind = ['run', 'giveaway', 'profile', 'tournament', 'invite'].includes(req.body.kind) ? req.body.kind : null; if (!kind) return bad(res, 400, 'Unknown share type.');
    const ref = str(req.body.ref, 60);
    db.prepare('INSERT OR IGNORE INTO shares (user_id, kind, ref, created_at) VALUES (?,?,?,?)').run(req.user.id, kind, ref, now());
    const unlocked = ach.evaluate(req.user.id, { games: [] }).fresh;
    res.json({ ok: true, unlocked, ref_code: ensureRefCode(req.user.id) });
  });
  function runCard(id) {
    const r = db.prepare('SELECT r.*, u.username, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge, u.banned FROM runs r JOIN users u ON u.id=r.user_id WHERE r.id=?').get(id);
    if (!r || r.banned) return null;
    const g = cfg.GAME_MAP[r.game_id] || {}; const board = boards.gameBoard(r.game_id); const rank = board.findIndex(x => x.user_id === r.user_id) + 1;
    const best = db.prepare('SELECT MAX(score) AS b FROM runs WHERE user_id=? AND game_id=?').get(r.user_id, r.game_id).b;
    return { id: r.id, game_id: r.game_id, game: g.title, art: g.art, unit: g.unit, score: r.score, score_text: scoreText(r.score, r.game_id), created_at: r.created_at,
      player: pub(r), rank: rank || null, players: board.length, personal_best: r.score >= best };
  }
  h.runCard = runCard;
  app.get('/api/runs/:id', (req, res) => { const c = runCard(parseInt(req.params.id, 10)); if (!c) return bad(res, 404, 'Run not found'); res.json({ ok: true, run: c }); });

  const png = (res, buf) => { res.setHeader('Content-Type', 'image/png'); res.setHeader('Cache-Control', 'public, max-age=600'); res.end(buf); };
  const whenText = (a, b) => { const d = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: cfg.TZ }); const t = now(); return t < a ? `Starts ${d(a)}` : t > b ? `Ended ${d(b)}` : `Live now • ends ${d(b)}`; };
  h.og = {
    run(id) { const c = runCard(id); if (!c) return null; return { kind: 'run', key: `${id}:${c.rank}:${c.players}`, data: { game: c.game, scoreText: c.score_text, username: c.player.username, title: c.player.cos.title, rank: c.rank, players: c.players, best: c.personal_best, art: c.art }, title: `${c.player.username} scored ${c.score_text} in ${c.game}`, desc: `#${c.rank} of ${c.players} players on The Gaming Hub. Can you beat it? Free to play.` }; },
    giveaway(id) { const g = db.prepare('SELECT * FROM giveaways WHERE id=? AND active=1').get(id); if (!g) return null; return { kind: 'giveaway', key: `${id}:${g.updated_at}:${Math.floor(now() / 36e5)}`, data: { title: g.title, host: g.host, tier: g.tier, when: whenText(g.start_at, g.end_at), art: g.image, color: g.brand_color }, title: `${g.title} - giveaway on The Gaming Hub`, desc: `Hosted by ${g.host}. Play free games to enter. No purchase necessary. 21+.` }; },
    profile(name) { const u = userRow.get(String(name)); if (!u || u.banned) return null; const lv = levelOf(u.id); const st = db.prepare('SELECT COUNT(DISTINCT game_id) AS g, COALESCE(SUM(score),0) AS p FROM runs WHERE user_id=?').get(u.id); const a = db.prepare('SELECT COUNT(*) AS c FROM user_achievements WHERE user_id=?').get(u.id).c;
      return { kind: 'profile', key: `${u.id}:${lv.level}:${a}`, data: { username: u.username, title: ach.publicCos(u).title, level: lv.level, ach: a, games: st.g, points: fmt(st.p) }, title: `${u.username} on The Gaming Hub`, desc: `Level ${lv.level} • ${a} achievements. Play free games, climb leaderboards and win brand giveaways.` }; },
    tournament(id) { const t = db.prepare('SELECT * FROM tournaments WHERE id=? AND active=1').get(id); if (!t) return null; const g = cfg.GAME_MAP[t.game_id] || {}; return { kind: 'tournament', key: `${id}:${Math.floor(now() / 36e5)}`, data: { title: t.title, game: g.title, format: t.format, when: whenText(t.start_at, t.end_at), prize: t.prize, art: g.art }, title: `${t.title} - ${g.title} tournament`, desc: `Free ${t.format === 'bracket' ? 'bracket' : 'timed'} tournament on The Gaming Hub. Cosmetic prizes only.` }; },
    game(id) { const g = cfg.GAME_MAP[id]; if (!g) return null; return { kind: 'default', key: null, img: g.art ? g.art.replace(/\.webp$/, '.png') : null, title: `${g.title} - play free on The Gaming Hub`, desc: (g.desc || 'A Trap Tech game.') + ' Free to play, A Trap Tech game.' }; },
  };
  app.get('/og/default.png', (req, res) => png(res, og.render('default', {}, 'default')));
  app.get('/og/:kind/:id.png', (req, res) => {
    const f = { run: 'run', giveaway: 'giveaway', u: 'profile', tournament: 'tournament' }[req.params.kind];
    const m = f && h.og[f](f === 'profile' ? req.params.id : parseInt(req.params.id, 10));
    if (!m) return png(res, og.render('default', {}, 'default'));
    png(res, og.render(m.kind, m.data, m.key));
  });

  // ---------- search ----------
  app.get('/api/search', limiter('search', 120, 60e3), (req, res) => {
    const q = str(req.query.q, 40); if (q.length < 1) return res.json({ ok: true, q, games: [], players: [], giveaways: [], tournaments: [] });
    const like = `%${q.replace(/[!%_]/g, c => '!' + c)}%`; const ql = q.toLowerCase();
    const games = cfg.GAMES.filter(g => [g.title, g.category, ...(g.tags || [])].join(' ').toLowerCase().includes(ql)).map(g => ({ id: g.id, title: g.title, category: g.category, art: g.art }));
    const players = db.prepare('SELECT * FROM users WHERE banned=0 AND username LIKE ? ESCAPE \'!\' ORDER BY is_demo, LENGTH(username) LIMIT 10').all(like).map(pub);
    const giveaways = db.prepare('SELECT id, title, host, end_at, start_at, image FROM giveaways WHERE active=1 AND (title LIKE ? ESCAPE \'!\' OR host LIKE ? ESCAPE \'!\' OR prize LIKE ? ESCAPE \'!\') ORDER BY end_at DESC LIMIT 10').all(like, like, like);
    const tournaments = db.prepare('SELECT id, title, game_id, start_at, end_at FROM tournaments WHERE active=1 AND title LIKE ? ESCAPE \'!\' ORDER BY end_at DESC LIMIT 10').all(like);
    res.json({ ok: true, q, games, players, giveaways, tournaments });
  });

  // ---------- admin: tournaments ----------
  const TCOLS = ['title', 'game_id', 'format', 'description', 'prize', 'start_at', 'qual_end_at', 'round_ms', 'end_at', 'active'];
  function tBody(b) {
    const t = { title: str(b.title, 100), game_id: String(b.game_id || ''), format: b.format === 'bracket' ? 'bracket' : 'timed', description: str(b.description, 2000), prize: str(b.prize, 200),
      start_at: Number(b.start_at), qual_end_at: b.qual_end_at ? Number(b.qual_end_at) : null, round_ms: b.round_ms ? Number(b.round_ms) : null, end_at: Number(b.end_at), active: b.active === false ? 0 : 1 };
    if (!t.title) return 'Title is required.'; if (!cfg.GAME_MAP[t.game_id]) return 'Pick a game.';
    if (!Number.isFinite(t.start_at)) return 'Start time is required.';
    if (t.format === 'bracket') {
      if (!Number.isFinite(t.qual_end_at) || t.qual_end_at <= t.start_at) return 'Qualifying end must be after the start.';
      if (!Number.isFinite(t.round_ms) || t.round_ms < 60e3) t.round_ms = 24 * 3600e3;
      t.end_at = t.qual_end_at + 3 * t.round_ms;
    } else { t.qual_end_at = null; t.round_ms = null; if (!Number.isFinite(t.end_at) || t.end_at <= t.start_at) return 'End must be after the start.'; }
    return t;
  }
  A.get('/tournaments', (req, res) => res.json({ ok: true, tournaments: db.prepare('SELECT * FROM tournaments ORDER BY start_at DESC').all().map(t => ({ ...tPublic(t), active: !!t.active })) }));
  A.post('/tournaments', (req, res) => {
    const t = tBody(req.body || {}); if (typeof t === 'string') return bad(res, 400, t);
    const info = db.prepare(`INSERT INTO tournaments (${TCOLS.join(',')},created_at) VALUES (${TCOLS.map(c => '@' + c).join(',')},${now()})`).run(t);
    const g = cfg.GAME_MAP[t.game_id];
    N.notify(null, 'tournament', `New tournament: ${t.title}`, `${g.title} • ${t.format === 'bracket' ? 'bracket' : 'timed'} • free entry, cosmetic prizes`, `/tournaments/${info.lastInsertRowid}`, 'swords');
    logActivity('tournament', `New tournament: ${t.title} (${g.title})`, null, info.lastInsertRowid);
    res.json({ ok: true, id: info.lastInsertRowid });
  });
  A.put('/tournaments/:id', (req, res) => {
    const t = tBody(req.body || {}); if (typeof t === 'string') return bad(res, 400, t);
    const r = db.prepare(`UPDATE tournaments SET ${TCOLS.map(c => `${c}=@${c}`).join(',')} WHERE id=@id`).run({ ...t, id: req.params.id });
    if (!r.changes) return bad(res, 404, 'Not found'); res.json({ ok: true });
  });
  A.delete('/tournaments/:id', (req, res) => { db.prepare('DELETE FROM tournaments WHERE id=?').run(req.params.id); res.json({ ok: true }); });
};

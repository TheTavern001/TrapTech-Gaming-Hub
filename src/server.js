'use strict';
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cfg = require('./config');
const db = require('./db');
const boards = require('./boards');
const ach = require('./achievements');
const COS = require('./cosmetics');
const PK = require('./packages');
const { gameBoard, globalBoard, ranked, giveawayEntrants, giveawayStatus, activeGiveawaysFor, giveawayGameIds } = boards;

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
// gzip/brotli-free compression for text assets + JSON (fast first load on 4G and in in-app browsers)
app.use(require('compression')({ threshold: 1024 }));
app.use(express.json({ limit: '32kb' }));

// Health check for hosting platforms (Render healthCheckPath, Docker HEALTHCHECK)
app.get('/healthz', (req, res) => { try { db.prepare('SELECT 1').get(); res.json({ ok: true }); } catch (e) { res.status(500).json({ ok: false }); } });

// ---------- helpers ----------
const now = () => Date.now();
const b64u = (s) => Buffer.from(s).toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url').toString('utf8');
const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('base64url');
function safeEq(a, b) {
  const A = Buffer.from(String(a)); const B = Buffer.from(String(b));
  if (A.length !== B.length) { crypto.timingSafeEqual(A, A); return false; }
  return crypto.timingSafeEqual(A, B);
}
function sign(secret, obj) { const p = b64u(JSON.stringify(obj)); return `${p}.${hmac(secret, p)}`; }
function verify(secret, token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [p, s] = token.split('.');
  if (!safeEq(s, hmac(secret, p))) return null;
  try { return JSON.parse(unb64u(p)); } catch { return null; }
}
function clientIp(req) { return String(req.headers['cf-connecting-ip'] || req.ip || '').trim(); }
function ipHash(req) { return crypto.createHash('sha256').update(cfg.IP_SALT + clientIp(req)).digest('hex').slice(0, 16); }
function uaHash(req) { return crypto.createHash('sha256').update(cfg.IP_SALT + ':ua:' + String(req.headers['user-agent'] || '')).digest('hex').slice(0, 12); }
function parseCookies(req) {
  const out = {};
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function isHttps(req) { return req.secure || req.headers['x-forwarded-proto'] === 'https'; }
function setCookie(req, res, name, value, maxAgeMs) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeMs !== undefined) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
function bad(res, code, error, extra = {}) { return res.status(code).json({ ok: false, error, ...extra }); }
function logActivity(type, message, user_id = null, ref_id = null, is_demo = 0, at = now()) {
  db.prepare('INSERT INTO activity (type,message,user_id,ref_id,created_at,is_demo) VALUES (?,?,?,?,?,?)').run(type, message, user_id, ref_id, at, is_demo);
}
const str = (v, max) => String(v ?? '').trim().slice(0, max);

// Simple in-memory sliding-window rate limiter
const buckets = new Map();
function rateLimit(key, limit, windowMs) {
  const t = now(); const arr = (buckets.get(key) || []).filter(x => t - x < windowMs);
  if (arr.length >= limit) { buckets.set(key, arr); return false; }
  arr.push(t); buckets.set(key, arr); return true;
}
setInterval(() => { const t = now(); for (const [k, v] of buckets) if (!v.length || t - v[v.length - 1] > 3600e3) buckets.delete(k); }, 600e3).unref();
const limiter = (name, limit, windowMs) => (req, res, next) =>
  rateLimit(`${name}:${ipHash(req)}`, limit, windowMs) ? next() : bad(res, 429, 'Too many requests, slow down a little.');

// helpers shared with src/v3.js (filled in below / by v3.js)
const H = {};

// ---------- auth ----------
function currentUser(req) {
  // cookie first; X-Session header for in-app browsers (Potato / WebViews) that block cookies
  const tok = verify(cfg.SESSION_SECRET, parseCookies(req).gh_sess || String(req.headers['x-session'] || ''));
  if (!tok || tok.e < now()) return null;
  const u = db.prepare('SELECT id, username, created_at, banned, is_demo, eq_banner, eq_frame, eq_title, eq_badge FROM users WHERE id=?').get(tok.u);
  if (!u || u.banned) return null;
  return u;
}
function startSession(req, res, user) {
  const t = sign(cfg.SESSION_SECRET, { u: user.id, e: now() + cfg.SESSION_TTL_MS });
  setCookie(req, res, 'gh_sess', t, cfg.SESSION_TTL_MS);
  db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), user.id);
  return t;
}
const requireUser = (req, res, next) => { const u = currentUser(req); if (!u) return bad(res, 401, 'Please sign in first.'); req.user = u; next(); };
function isAdmin(req) { const t = verify(cfg.SESSION_SECRET + ':admin', parseCookies(req).gh_admin); return !!(t && t.adm && t.e > now()); }
const requireAdmin = (req, res, next) => isAdmin(req) ? next() : bad(res, 401, 'Admin login required.');

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;

app.post('/api/auth/signup', limiter('signup', 10, 3600e3), (req, res) => {
  const username = str(req.body.username, 40); const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) return bad(res, 400, 'Username must be 3-20 characters: letters, numbers, _ . - (no spaces).');
  if (password.length < 8 || password.length > 200) return bad(res, 400, 'Password must be at least 8 characters.');
  if (!req.body.agree) return bad(res, 400, 'Please agree to the Terms of Service and Privacy Policy.');
  // 21+ only (cannabis-brand sponsors). Neutral date-of-birth check, validated on the server.
  const dob = String(req.body.dob || ''); const dm = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dm) return bad(res, 400, 'Please enter your date of birth.');
  const [yy, mm, dd] = dm.slice(1).map(Number); const today = new Date();
  const bd = new Date(Date.UTC(yy, mm - 1, dd));
  if (bd.getUTCMonth() !== mm - 1 || yy < 1900 || bd.getTime() > today.getTime()) return bad(res, 400, 'Please enter a valid date of birth.');
  const age = today.getUTCFullYear() - yy - ((today.getUTCMonth() + 1 < mm || (today.getUTCMonth() + 1 === mm && today.getUTCDate() < dd)) ? 1 : 0);
  if (age < 21) return bad(res, 403, 'You must be 21 or older to join The Gaming Hub.', { underage: true });
  const refCode = String(req.body.ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
  const referrer = refCode ? db.prepare('SELECT id FROM users WHERE ref_code=? AND banned=0').get(refCode) : null;
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return bad(res, 409, 'That Potato username is taken.');
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, pass_hash, created_at, last_seen, birth_date, referred_by) VALUES (?,?,?,?,?,?)').run(username, hash, now(), now(), dob, referrer ? referrer.id : null);
  const user = { id: info.lastInsertRowid, username };
  if (referrer) require('./notify').notify(referrer.id, 'referral', `${username} signed up with your invite`, 'It counts as soon as they finish their first scored run.', '/u/' + encodeURIComponent(username), 'gift');
  logActivity('player', `New player registered: ${username}`, user.id);
  const session = startSession(req, res, user);
  const unlocked = ach.evaluate(user.id, { games: [] }).fresh;
  res.json({ ok: true, user: { username, cos: ach.publicCos({}) }, unlocked, referred: !!referrer, session });
});

app.post('/api/auth/signin', limiter('signin', 20, 15 * 60e3), (req, res) => {
  const username = str(req.body.username, 40); const password = String(req.body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u || !bcrypt.compareSync(password, u.pass_hash)) return bad(res, 401, 'Wrong username or password.');
  if (u.banned) return bad(res, 403, 'This account has been suspended.');
  const session = startSession(req, res, u);
  res.json({ ok: true, user: { username: u.username, cos: ach.publicCos(u) }, session });
});

app.post('/api/auth/signout', (req, res) => { setCookie(req, res, 'gh_sess', '', 0); res.json({ ok: true }); });

app.post('/api/auth/password', requireUser, limiter('pw', 10, 3600e3), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(String(req.body.current || ''), u.pass_hash)) return bad(res, 401, 'Current password is wrong.');
  const np = String(req.body.password || '');
  if (np.length < 8) return bad(res, 400, 'New password must be at least 8 characters.');
  db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(np, 10), u.id);
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  const u = currentUser(req);
  res.json({ ok: true, user: u ? { username: u.username, created_at: u.created_at, cos: ach.publicCos(u), ...H.meExtras(u) } : null, now: now() });
});

// ---------- games & leaderboards ----------
app.get('/api/games', (req, res) => res.json({ ok: true, games: cfg.GAMES }));

function periodStart(period) {
  if (period === 'weekly') return now() - 7 * 864e5;
  if (period === 'monthly') return now() - 30 * 864e5;
  return 0;
}
app.get('/api/leaderboard', (req, res) => {
  const game = String(req.query.game || req.query.contest_game || 'global');
  const period = ['weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'all';
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 500);
  let rows;
  if (req.query.giveaway || req.query.contest) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.query.giveaway || req.query.contest);
    if (!g) return bad(res, 404, 'Giveaway not found');
    rows = giveawayEntrants(R.ready(g));
  } else if (game === 'global') rows = ranked(globalBoard(periodStart(period)));
  else if (cfg.GAME_MAP[game]) rows = ranked(gameBoard(game, periodStart(period)));
  else return bad(res, 404, 'Unknown game');
  const me = currentUser(req);
  if (req.query.friends === '1' || req.query.friends === 'true') {
    if (!me) return bad(res, 401, 'Sign in to see your friends leaderboard.');
    const ids = H.followingIds(me.id); ids.add(me.id);
    rows = rows.filter(r => ids.has(r.user_id)).map((r, i) => ({ ...r, rank: i + 1 }));
  }
  const mine = me ? rows.find(r => r.user_id === me.id) || null : null;
  res.json({ ok: true, game, period, total: rows.length, rows: rows.slice(0, limit).map(publicRow), me: mine && publicRow(mine), now: now() });
});
Object.assign(H, { now, bad, limiter, logActivity, str });
const publicRow = (r) => ({ rank: r.rank, username: r.username, score: r.score, runs: r.runs, last_at: r.last_at, demo: !!r.is_demo, cos: ach.publicCos(r) });

// ---------- runs / anti-cheat ----------
app.post('/api/run/start', requireUser, (req, res) => {
  const gameId = String(req.body.game_id || 'jetpack-dash');
  const game = cfg.GAME_MAP[gameId];
  if (!game || !game.playable) return bad(res, 400, 'That game is not playable yet.');
  if (!rateLimit(`start-u:${req.user.id}`, 20, 60e3) || !rateLimit(`start-ip:${ipHash(req)}`, 40, 60e3)) return bad(res, 429, 'Too many runs started, wait a moment.');
  const rid = crypto.randomBytes(16).toString('hex');
  const t = now();
  db.prepare('INSERT INTO run_tokens (rid,user_id,game_id,started_at,ip_hash) VALUES (?,?,?,?,?)').run(rid, req.user.id, gameId, t, ipHash(req));
  res.json({ ok: true, token: sign(cfg.RUN_SECRET, { rid, u: req.user.id, g: gameId, t }), started_at: t });
});

app.post('/api/score', requireUser, (req, res) => {
  if (!rateLimit(`score-ip:${ipHash(req)}`, 30, 60e3)) return bad(res, 429, 'Too many score submissions.');
  const tok = verify(cfg.RUN_SECRET, req.body.token);
  if (!tok) return bad(res, 400, 'Invalid run token.');
  if (tok.u !== req.user.id) return bad(res, 403, 'Run token belongs to another player.');
  const row = db.prepare('SELECT * FROM run_tokens WHERE rid=?').get(tok.rid);
  if (!row) return bad(res, 400, 'Unknown run.');
  const t = now();
  const reject = (code, reason) => {
    db.prepare("UPDATE run_tokens SET used_at=?, status='rejected', reason=? WHERE rid=? AND used_at IS NULL").run(t, reason, row.rid);
    return bad(res, code, reason, { rejected: true });
  };
  if (row.used_at) return bad(res, 409, 'This run was already submitted.', { rejected: true });
  if (t - row.started_at > cfg.RUN_TOKEN_TTL_MS) return reject(400, 'Run token expired.');
  const game = cfg.GAME_MAP[row.game_id]; const ac = game.ac; const unit = game.unit === 'm' ? 'm' : ' ' + game.unit;
  const score = Number(req.body.score); const coins = Number(req.body.coins || 0);
  if (!Number.isInteger(score) || score < 0 || score > 10_000_000) return reject(400, 'Invalid score value.');
  if (!Number.isInteger(coins) || coins < 0 || coins > 1_000_000) return reject(400, 'Invalid coin value.');
  // per-game plausibility caps against SERVER-measured elapsed time (see config.js GAMES[].ac)
  const elapsedS = (t - row.started_at) / 1000;
  const maxScore = Math.min(ac.max, Math.floor(ac.perSec * elapsedS + ac.grace));
  if (score > maxScore) return reject(422, `Score rejected: ${score}${unit} in ${elapsedS.toFixed(1)}s is not possible in ${game.title} (max ${maxScore}${unit}).`);
  if (coins > ac.coinsPerSec * elapsedS + 10) return reject(422, 'Coin count rejected as implausible.');
  const durationMs = Math.max(0, Math.min(Math.round(Number(req.body.duration_ms) || 0), t - row.started_at + 5000));

  // single-use: atomically claim the token
  const claim = db.prepare("UPDATE run_tokens SET used_at=?, status='accepted' WHERE rid=? AND used_at IS NULL").run(t, row.rid);
  if (claim.changes !== 1) return bad(res, 409, 'This run was already submitted.', { rejected: true });

  const prevBest = db.prepare('SELECT MAX(score) AS b FROM runs WHERE user_id=? AND game_id=?').get(req.user.id, row.game_id).b;
  const levelBefore = H.levelOf(req.user.id);
  const gws = activeGiveawaysFor(row.game_id, t).filter(g => row.started_at >= g.start_at);
  const newEntries = [];
  for (const g of gws) {
    if (score < (g.min_score || 0)) continue;
    const games = giveawayGameIds(g.id); const ph = games.map(() => '?').join(',');
    const had = db.prepare(`SELECT 1 FROM runs WHERE user_id=? AND game_id IN (${ph}) AND started_at>=? AND created_at<=? AND score>=? LIMIT 1`).get(req.user.id, ...games, g.start_at, g.end_at, g.min_score || 0);
    if (!had) newEntries.push(g);
  }
  const info = db.prepare('INSERT INTO runs (user_id,game_id,score,coins,duration_ms,started_at,created_at,ip_hash,ua_hash) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(req.user.id, row.game_id, score, coins, durationMs, row.started_at, t, ipHash(req), uaHash(req));
  for (const g of newEntries) logActivity('entry', `${req.user.username} entered "${g.title}"`, req.user.id, g.id);
  const isBest = prevBest === null || prevBest === undefined || score > prevBest;
  if (isBest && score >= (game.tiers ? game.tiers[0] : 100)) logActivity('highscore', `New high score (${game.title}): ${req.user.username} - ${score.toLocaleString('en-US')}${unit}`, req.user.id, info.lastInsertRowid);

  const board = gameBoard(row.game_id);
  const rank = board.findIndex(r => r.user_id === req.user.id) + 1;
  const counted = gws.map(g => {
    const entrants = giveawayEntrants(g); const me = entrants.find(e => e.user_id === req.user.id);
    return { id: g.id, title: g.title, rank: me ? me.rank : null, entrants: entrants.length, min_score: g.min_score || 0, qualified: score >= (g.min_score || 0) };
  });
  // explicit giveaway param (legacy "contest") => tell the client if it ended
  let giveawayStatusOut = null;
  const gid = req.body.giveaway_id || req.body.contest;
  if (gid) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(gid);
    giveawayStatusOut = !g ? 'not_found' : (t > g.end_at ? 'ended_not_counted' : t < g.start_at ? 'not_started_not_counted' : !g.active ? 'inactive'
      : !giveawayGameIds(g.id).includes(row.game_id) ? 'game_not_linked' : score < (g.min_score || 0) ? 'below_min_score' : 'counted');
  }
  // achievements are evaluated here, on the server, from the stored runs
  const unlocked = ach.evaluate(req.user.id, { games: [row.game_id] }).fresh;
  for (const a of unlocked) if (['gold', 'epic', 'legendary'].includes(a.tier) && !a.hidden) logActivity('achievement', `${req.user.username} unlocked "${a.name}"`, req.user.id);
  const extra = H.afterRun(req.user, levelBefore);
  res.json({ ok: true, run_id: info.lastInsertRowid, share_url: `/s/${info.lastInsertRowid}`, level: extra.level, level_up: extra.level_up || null, xp_gained: extra.level.xp - levelBefore.xp, game_id: row.game_id, score, coins, personal_best: isBest, best: Math.max(score, prevBest || 0), rank, players: board.length, giveaways: counted, giveaway_status: giveawayStatusOut, unlocked });
});

// ---------- giveaways ----------
const R = require('./results');
// lazily lock results the moment anyone looks at an ended giveaway (the 15s sweep below covers the rest)
R.ready = (g) => { if (g && !g.finalized_at && !g.draw_commit) g = R.ensureCommit(g); return (g && !g.finalized_at && g.end_at < now()) ? R.finalize(g) : g; };
const winnersOf = (gid) => db.prepare('SELECT u.username, w.method, w.score, w.drawn_at FROM winners w JOIN users u ON u.id=w.user_id WHERE w.giveaway_id=? ORDER BY w.drawn_at').all(gid);
function giveawayPublic(g, withWinners = true) {
  const entrants = giveawayEntrants(g);
  const gameIds = giveawayGameIds(g.id);
  const out = { id: g.id, title: g.title, host: g.host, prize: g.prize, image: g.image, start_at: g.start_at, end_at: g.end_at,
    entry_method: g.entry_method, game_id: gameIds[0] || g.game_id, game_ids: gameIds,
    game_title: gameIds.map(id => cfg.GAME_MAP[id]?.title || id).join(' + '), rules: g.rules,
    tier: g.tier || '', brand_color: g.brand_color || '', brand_logo: g.brand_logo || '', featured: !!g.featured, min_score: g.min_score || 0,
    prize_tiers: String(g.prize_tiers || '').split('\n').map(x => x.trim()).filter(Boolean),
    status: giveawayStatus(g), entrants: entrants.length, demo: !!g.is_demo, top: entrants.slice(0, 3).map(publicRow),
    win_method: g.win_method || 'score', winner_count: R.winnerCount(g), finalized_at: g.finalized_at || null, draw_commit: g.draw_commit || null,
    entrants_hash: g.entrants_hash || null, tiebreak_rules: R.TIEBREAK_RULES };
  if (withWinners) {
    const res = g.finalized_at ? R.results(g) : null;
    // after the lock, winners come from the immutable final standings (pending until an admin confirms)
    out.winners = res ? res.winners.map(w => ({ username: w.username, place: w.place, score: w.score, state: w.state, method: g.win_method === 'random' ? 'random' : 'top' })) : winnersOf(g.id);
    out.winners_state = res ? (res.winners.length && res.winners.every(w => w.state === 'confirmed') ? 'confirmed' : res.winners.length ? 'pending' : 'none') : null;
  }
  return out;
}
app.get('/api/giveaways', (req, res) => {
  const status = req.query.status;
  const all = db.prepare('SELECT * FROM giveaways WHERE active=1 ORDER BY start_at DESC').all();
  let list = all.map(g => giveawayPublic(R.ready(g)));
  if (['active', 'upcoming', 'past'].includes(status)) list = list.filter(g => g.status === status);
  list.sort((a, b) => a.status === 'past' ? b.end_at - a.end_at : (b.featured - a.featured) || (a.end_at - b.end_at));
  res.json({ ok: true, giveaways: list, now: now() });
});
app.get('/api/giveaways/:id', (req, res) => {
  const g = R.ready(db.prepare('SELECT * FROM giveaways WHERE id=? AND active=1').get(req.params.id));
  if (!g) return bad(res, 404, 'Giveaway not found');
  const entrants = giveawayEntrants(g); const me = currentUser(req);
  const mine = me ? entrants.find(e => e.user_id === me.id) : null;
  res.json({ ok: true, giveaway: giveawayPublic(g), leaderboard: entrants.slice(0, 25).map(publicRow), me: mine ? publicRow(mine) : null, now: now() });
});

// ---------- profiles ----------
function profileFor(user) {
  const bests = db.prepare('SELECT game_id, MAX(score) AS best, COUNT(*) AS n, SUM(coins) AS coins FROM runs WHERE user_id=? GROUP BY game_id').all(user.id);
  const total = bests.reduce((s, b) => s + b.best, 0);
  const plays = bests.reduce((s, b) => s + b.n, 0);
  const coins = bests.reduce((s, b) => s + (b.coins || 0), 0);
  const wins = db.prepare('SELECT COUNT(*) AS c FROM winners WHERE user_id=?').get(user.id).c;
  const recent = db.prepare('SELECT game_id, score, coins, created_at FROM runs WHERE user_id=? ORDER BY created_at DESC LIMIT 10').all(user.id)
    .map(r => ({ ...r, game_title: cfg.GAME_MAP[r.game_id]?.title || r.game_id, unit: cfg.GAME_MAP[r.game_id]?.unit || 'pts' }));
  const gb = globalBoard(0); const grank = gb.findIndex(r => r.user_id === user.id) + 1;
  const entries = db.prepare(`SELECT COUNT(DISTINCT g.id) AS c FROM giveaways g JOIN giveaway_games gg ON gg.giveaway_id=g.id JOIN runs r ON r.game_id=gg.game_id AND r.user_id=? AND r.started_at>=g.start_at AND r.created_at<=g.end_at AND r.created_at>=g.start_at AND r.score>=g.min_score`).get(user.id).c;
  const unl = ach.unlockedMap(user.id);
  const achievements = [...unl.entries()].sort((a, b) => b[1] - a[1]).map(([id, at]) => { const a = ach.BY_ID[id]; return a && { ...ach.publicAch(a, true), unlocked_at: at }; }).filter(Boolean);
  return { username: user.username, member_since: user.created_at, demo: !!user.is_demo, total_score: total, games_played: plays, coins,
    giveaways_won: wins, giveaways_entered: entries, global_rank: grank || null,
    best_by_game: bests.map(b => ({ game_id: b.game_id, game_title: cfg.GAME_MAP[b.game_id]?.title || b.game_id, best: b.best, plays: b.n })),
    cos: ach.publicCos(user), achievements, achievements_total: ach.ACHIEVEMENTS.length, recent };
}
app.get('/api/profile/:username', (req, res) => {
  const u = db.prepare('SELECT id, username, created_at, is_demo, eq_banner, eq_frame, eq_title, eq_badge FROM users WHERE username=? AND banned=0').get(String(req.params.username));
  if (!u) return bad(res, 404, 'Player not found');
  const me = currentUser(req);
  // catch up on achievements that depend on things other people did (giveaway draws, leaderboard moves)
  const unlocked = me && me.id === u.id ? ach.evaluate(u.id).fresh : [];
  res.json({ ok: true, profile: { ...profileFor(u), ...H.profileExtras(u, me) }, is_me: !!(me && me.id === u.id), unlocked });
});

// ---------- achievements & cosmetics ----------
function achievementList(userId) {
  const rr = ach.rarity();
  let unl = new Map(), st = null, fresh = [];
  if (userId) { const ev = ach.evaluate(userId); unl = ev.have; st = ev.stats; fresh = ev.fresh; }
  const list = ach.ACHIEVEMENTS.map(a => {
    const done = unl.has(a.id); const pct = rr.pct(a.id);
    const val = st ? Math.min(a.target, Math.max(0, a.value(st))) : 0;
    return { ...ach.publicAch(a, done), unlocked: done, unlocked_at: unl.get(a.id) || null, progress: done ? a.target : val,
      rarity_pct: pct, rarity: ach.rarityLabel(pct) };
  });
  return { list, fresh, players: rr.total };
}
app.get('/api/achievements', (req, res) => {
  const me = currentUser(req);
  let userId = me ? me.id : null; let who = me ? me.username : null;
  if (req.query.user) {
    const u = db.prepare('SELECT id, username FROM users WHERE username=? AND banned=0').get(String(req.query.user));
    if (!u) return bad(res, 404, 'Player not found');
    if (!me || u.id !== me.id) { // someone else's: show their unlocks, no progress details
      const unl = ach.unlockedMap(u.id); const rr = ach.rarity();
      const list = ach.ACHIEVEMENTS.map(a => { const done = unl.has(a.id); const pct = rr.pct(a.id); return { ...ach.publicAch(a, done), unlocked: done, unlocked_at: unl.get(a.id) || null, progress: done ? a.target : null, rarity_pct: pct, rarity: ach.rarityLabel(pct) }; });
      return res.json({ ok: true, user: u.username, is_me: false, cats: ach.CATS, achievements: list, players: rr.total, unlocked: [] });
    }
  }
  const r = achievementList(userId);
  res.json({ ok: true, user: who, is_me: !!me, cats: ach.CATS, achievements: r.list, players: r.players, unlocked: r.fresh });
});
function cosmeticsFor(user) {
  const unl = ach.unlockedMap(user.id); const own = ach.ownedFrom(unl);
  const source = {}; for (const a of ach.ACHIEVEMENTS) for (const r of a.rewards) source[`${r.type}:${r.id}`] = a;
  const item = (type, x) => { const a = source[`${type}:${x.id}`]; const owned = own[type].has(x.id);
    return { id: x.id, name: x.name, owned, from: a ? (a.hidden && !unl.has(a.id) ? 'Secret achievement' : a.name) : 'Free', default: COS.DEFAULTS[type] === x.id, ...(type === 'frame' ? { anim: x.anim } : {}) }; };
  return {
    banners: COS.BANNERS.map(b => item('banner', b)), frames: COS.FRAMES.map(f => item('frame', f)), titles: COS.TITLES.map(t => item('title', t)),
    badges: ach.ACHIEVEMENTS.filter(a => unl.has(a.id)).map(a => ({ id: a.id, name: a.name, icon: a.icon, tier: a.tier, owned: true })),
    equipped: { banner: user.eq_banner || COS.DEFAULTS.banner, frame: user.eq_frame || 'none', title: user.eq_title || COS.DEFAULTS.title, badge: user.eq_badge || '' },
    owned_count: ach.ownedCount(own), badge_count: own.badge.size,
    totals: { banners: COS.BANNERS.length, frames: COS.FRAMES.length, titles: COS.TITLES.length, badges: ach.ACHIEVEMENTS.length },
  };
}
app.get('/api/cosmetics', requireUser, (req, res) => res.json({ ok: true, ...cosmeticsFor(req.user), cos: ach.publicCos(req.user) }));
app.post('/api/me/cosmetics', requireUser, limiter('equip', 60, 60e3), (req, res) => {
  const own = ach.ownedFrom(ach.unlockedMap(req.user.id));
  const upd = {};
  for (const [k, col] of [['banner', 'eq_banner'], ['frame', 'eq_frame'], ['title', 'eq_title'], ['badge', 'eq_badge']]) {
    if (req.body[k] === undefined) continue;
    const v = String(req.body[k] || '');
    if (k === 'badge' && v === '') { upd[col] = ''; continue; }
    if (!own[k].has(v)) return bad(res, 403, `You haven't unlocked that ${k} yet.`);
    upd[col] = v;
  }
  if (!Object.keys(upd).length) return bad(res, 400, 'Nothing to equip.');
  db.prepare(`UPDATE users SET ${Object.keys(upd).map(c => `${c}=@${c}`).join(', ')} WHERE id=@id`).run({ ...upd, id: req.user.id });
  const unlocked = ach.evaluate(req.user.id, { games: [] }).fresh;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ ok: true, cos: ach.publicCos(u), unlocked });
});
app.get('/cosmetics.css', (req, res) => { res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=3600'); res.send(COS_CSS); });
const COS_CSS = COS.css();

// ---------- community ----------
const userCos = (id) => { const u = id && db.prepare('SELECT username, is_demo, eq_banner, eq_frame, eq_title, eq_badge FROM users WHERE id=?').get(id); return u ? { username: u.username, demo: !!u.is_demo, cos: ach.publicCos(u) } : null; };
app.get('/api/community', (req, res) => {
  const tab = req.query.tab || 'all';
  const ann = db.prepare('SELECT id, title, body, created_at, is_demo FROM announcements ORDER BY created_at DESC LIMIT 30').all().map(a => ({ kind: 'announcement', key: `a:${a.id}`, ...a }));
  const wins = db.prepare(`SELECT w.id, w.user_id, w.drawn_at AS created_at, u.username, g.title, w.method FROM winners w JOIN users u ON u.id=w.user_id JOIN giveaways g ON g.id=w.giveaway_id WHERE g.active=1 ORDER BY w.drawn_at DESC LIMIT 30`).all()
    .map(w => ({ kind: 'winner', key: `w:${w.id}`, uid: w.user_id, user: userCos(w.user_id), title: `${w.username} won "${w.title}"`, body: w.method === 'top' ? 'Winner by top score' : 'Winner by random draw', created_at: w.created_at }));
  const hs = db.prepare("SELECT id, user_id, type, message AS title, created_at, is_demo FROM activity WHERE type IN ('highscore','player','achievement','levelup','streak','tournament') ORDER BY created_at DESC LIMIT 40").all()
    .map(a => ({ kind: 'activity', key: `x:${a.id}`, user: userCos(a.user_id), ...a, uid: a.user_id, user_id: undefined }));
  const meF = currentUser(req);
  let items;
  if (tab === 'following') {
    if (!meF) return bad(res, 401, 'Sign in to see players you follow.');
    const ids = H.followingIds(meF.id); ids.add(meF.id);
    items = [...wins.filter(w => ids.has(w.uid)), ...hs.filter(a => ids.has(a.uid))];
  } else items = tab === 'announcements' ? ann : tab === 'winners' ? wins : [...ann, ...wins, ...hs];
  items.forEach(i => { delete i.uid; });
  items.sort((a, b) => b.created_at - a.created_at); items = items.slice(0, 40);
  const me = currentUser(req);
  const cnt = db.prepare('SELECT COUNT(*) AS c FROM reactions WHERE item_key=?'); const mine = db.prepare('SELECT 1 FROM reactions WHERE item_key=? AND user_id=?');
  for (const it of items) { it.hype = cnt.get(it.key).c; it.mine = !!(me && mine.get(it.key, me.id)); }
  res.json({ ok: true, items, now: now() });
});
app.post('/api/community/react', requireUser, limiter('react', 60, 60e3), (req, res) => {
  const key = String(req.body.key || ''); const m = key.match(/^([awx]):(\d+)$/);
  if (!m) return bad(res, 400, 'Unknown post.');
  const exists = m[1] === 'a' ? db.prepare('SELECT 1 FROM announcements WHERE id=?').get(m[2]) : m[1] === 'w' ? db.prepare('SELECT 1 FROM winners WHERE id=?').get(m[2]) : db.prepare('SELECT 1 FROM activity WHERE id=?').get(m[2]);
  if (!exists) return bad(res, 404, 'Post not found.');
  const had = db.prepare('SELECT 1 FROM reactions WHERE user_id=? AND item_key=?').get(req.user.id, key);
  if (had && req.body.on !== true) db.prepare('DELETE FROM reactions WHERE user_id=? AND item_key=?').run(req.user.id, key);
  else if (!had) db.prepare('INSERT INTO reactions (user_id, item_key, created_at) VALUES (?,?,?)').run(req.user.id, key, now());
  const unlocked = ach.evaluate(req.user.id, { games: [] }).fresh;
  res.json({ ok: true, key, mine: !had || req.body.on === true, hype: db.prepare('SELECT COUNT(*) AS c FROM reactions WHERE item_key=?').get(key).c, unlocked });
});

// ---------- hosting packages & bookings ----------
app.get('/api/packages', (req, res) => res.json({ ok: true, ...PK.getPackages() }));
app.post('/api/bookings', limiter('booking', 8, 3600e3), (req, res) => {
  const b = req.body || {};
  const brand = str(b.brand, 120), contact = str(b.contact, 160);
  if (!brand) return bad(res, 400, 'Channel / brand name is required.');
  if (!contact) return bad(res, 400, 'Please give an email or Discord handle so we can reply.');
  const pk = PK.getPackages();
  const tier = pk.tiers.find(t => t.id === b.package);
  const pkg = tier ? tier.id : 'custom';
  const snapshot = tier ? `${tier.name} - ${tier.price}${tier.price_note ? ' ' + tier.price_note : ''}` : 'Custom event - quote on request';
  const me = currentUser(req);
  const info = db.prepare(`INSERT INTO bookings (brand,contact_name,contact,event_type,package,package_snapshot,start_date,end_date,details,user_id,created_at,ip_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(brand, str(b.contact_name, 120), contact, str(b.event_type, 60), pkg, snapshot,
    str(b.start_date, 20), str(b.end_date, 20), str(b.details, 4000), me ? me.id : null, now(), ipHash(req));
  logActivity('booking', `Booking request submitted: ${brand} (${tier ? tier.name : 'Custom'})`, me ? me.id : null, info.lastInsertRowid);
  res.json({ ok: true, id: info.lastInsertRowid, package: pkg, package_snapshot: snapshot });
});

// ---------- admin ----------
app.post('/api/admin/login', limiter('admin-login', 10, 15 * 60e3), (req, res) => {
  if (!safeEq(String(req.body.password || ''), cfg.ADMIN_PASSWORD)) return bad(res, 401, 'Wrong admin password.');
  setCookie(req, res, 'gh_admin', sign(cfg.SESSION_SECRET + ':admin', { adm: 1, e: now() + 12 * 3600e3 }), 12 * 3600e3);
  res.json({ ok: true });
});
app.post('/api/admin/logout', (req, res) => { setCookie(req, res, 'gh_admin', '', 0); res.json({ ok: true }); });
app.get('/api/admin/me', (req, res) => res.json({ ok: true, admin: isAdmin(req) }));
const A = express.Router();
A.use(requireAdmin);

A.get('/stats', (req, res) => {
  const t = now();
  const one = (sql, ...p) => db.prepare(sql).get(...p).c;
  const all = db.prepare('SELECT * FROM giveaways ORDER BY start_at').all();
  res.json({ ok: true,
    players: one('SELECT COUNT(*) c FROM users'), players_7d: one('SELECT COUNT(*) c FROM users WHERE created_at>=?', t - 7 * 864e5),
    runs: one('SELECT COUNT(*) c FROM runs'), runs_24h: one('SELECT COUNT(*) c FROM runs WHERE created_at>=?', t - 864e5),
    games_live: cfg.GAMES.filter(g => g.playable).length, games_total: cfg.GAMES.length,
    active_giveaways: all.filter(g => g.active && giveawayStatus(g, t) === 'active').length,
    bookings_pending: one("SELECT COUNT(*) c FROM bookings WHERE status='pending'"), bookings_total: one('SELECT COUNT(*) c FROM bookings'),
    rejected_runs: one("SELECT COUNT(*) c FROM run_tokens WHERE status='rejected'"),
    demo: { players: one('SELECT COUNT(*) c FROM users WHERE is_demo=1'), giveaways: one('SELECT COUNT(*) c FROM giveaways WHERE is_demo=1') },
    activity: db.prepare('SELECT type, message, created_at FROM activity ORDER BY created_at DESC LIMIT 15').all(),
    upcoming: all.filter(g => giveawayStatus(g, t) !== 'past').slice(0, 5).map(g => giveawayPublic(g, false)),
    now: t });
});
A.get('/games', (req, res) => {
  const stats = db.prepare('SELECT game_id, COUNT(*) AS runs, COUNT(DISTINCT user_id) AS players, MAX(score) AS best FROM runs GROUP BY game_id').all();
  const m = Object.fromEntries(stats.map(s => [s.game_id, s]));
  const t = now();
  const gws = db.prepare('SELECT * FROM giveaways ORDER BY start_at DESC').all();
  const links = db.prepare('SELECT giveaway_id, game_id FROM giveaway_games').all();
  const linked = new Set(links.map(l => `${l.giveaway_id}:${l.game_id}`));
  const nLinks = {}; for (const l of links) nLinks[l.giveaway_id] = (nLinks[l.giveaway_id] || 0) + 1;
  res.json({ ok: true, now: t, games: cfg.GAMES.map(g => ({ ...g, runs: m[g.id]?.runs || 0, players: m[g.id]?.players || 0, best: m[g.id]?.best || 0,
    // every giveaway that is linked to this game, plus every live/upcoming one it could be linked to (toggle on/off)
    giveaways: gws.filter(x => linked.has(`${x.id}:${g.id}`) || giveawayStatus(x, t) !== 'past')
      .map(x => ({ id: x.id, title: x.title, status: giveawayStatus(x, t), active: !!x.active, demo: !!x.is_demo, linked: linked.has(`${x.id}:${g.id}`), games: nLinks[x.id] || 0 }))
      .sort((a, b) => (b.linked - a.linked) || a.status.localeCompare(b.status)) })) });
});

const HEX = /^#[0-9a-fA-F]{6}$/;
const IMG_RE = /^(\/assets\/[\w\-./]+|https:\/\/[^\s"'<>]+)$/;
function readGiveaway(b) {
  let gameIds = Array.isArray(b.game_ids) ? b.game_ids.map(String) : [String(b.game_id || 'jetpack-dash')];
  gameIds = [...new Set(gameIds)].filter(Boolean);
  const g = {
    title: str(b.title, 120), host: str(b.host, 80), prize: str(b.prize, 200), image: str(b.image, 300),
    start_at: Number(b.start_at), end_at: Number(b.end_at), entry_method: 'play',
    game_id: gameIds[0], rules: str(b.rules, 4000), active: b.active ? 1 : 0,
    tier: ['basic', 'premium', 'elite'].includes(b.tier) ? b.tier : '', brand_color: HEX.test(String(b.brand_color || '')) ? b.brand_color : '',
    brand_logo: str(b.brand_logo, 300), featured: b.featured ? 1 : 0, min_score: Math.max(0, Math.min(10_000_000, parseInt(b.min_score || '0', 10) || 0)),
    prize_tiers: str(b.prize_tiers, 1000),
    win_method: b.win_method === 'random' ? 'random' : 'score', winner_count: Math.max(0, Math.min(100, parseInt(b.winner_count || '0', 10) || 0)),
  };
  if (!g.title) return [null, 'Title is required.'];
  if (!Number.isFinite(g.start_at) || !Number.isFinite(g.end_at)) return [null, 'Start and end date/time are required.'];
  if (g.end_at <= g.start_at) return [null, 'End time must be after start time.'];
  if (!gameIds.length) return [null, 'Pick at least one game.'];
  for (const id of gameIds) if (!cfg.GAME_MAP[id]) return [null, `Unknown linked game: ${id}`];
  if (g.image && !IMG_RE.test(g.image)) return [null, 'Image must be a /assets/... path or an https:// URL.'];
  if (g.brand_logo && !IMG_RE.test(g.brand_logo)) return [null, 'Brand logo must be a /assets/... path or an https:// URL.'];
  return [g, null, gameIds];
}
function setGames(gid, gameIds) {
  db.transaction(() => {
    db.prepare('DELETE FROM giveaway_games WHERE giveaway_id=?').run(gid);
    const ins = db.prepare('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) VALUES (?,?)');
    for (const id of gameIds) ins.run(gid, id);
    db.prepare('UPDATE giveaways SET game_id=? WHERE id=?').run(gameIds[0], gid);
  })();
}
A.get('/giveaways', (req, res) => {
  const list = db.prepare('SELECT * FROM giveaways ORDER BY start_at DESC').all().map(g => ({ ...giveawayPublic(g), active: !!g.active }));
  res.json({ ok: true, giveaways: list, now: now() });
});
const GW_COLS = 'title,host,prize,image,start_at,end_at,entry_method,game_id,rules,active,tier,brand_color,brand_logo,featured,min_score,prize_tiers,win_method,winner_count';
A.post('/giveaways', (req, res) => {
  const [g, err, gameIds] = readGiveaway(req.body || {}); if (err) return bad(res, 400, err);
  const t = now();
  const info = db.prepare(`INSERT INTO giveaways (${GW_COLS},created_at,updated_at) VALUES (${GW_COLS.split(',').map(c => '@' + c).join(',')},${t},${t})`).run(g);
  setGames(info.lastInsertRowid, gameIds);
  R.ensureCommit({ id: info.lastInsertRowid }); R.audit(info.lastInsertRowid, 'admin', 'created', null, { method: g.win_method, winners: g.winner_count || 'auto' });
  logActivity('giveaway', `Giveaway created: ${g.title}`, null, info.lastInsertRowid);
  if (g.active) require('./notify').notify(null, 'giveaway', `New giveaway: ${g.title}`, `Hosted by ${g.host}. Play free to enter - no purchase necessary.`, `/giveaways/${info.lastInsertRowid}`, 'gift');
  res.json({ ok: true, id: info.lastInsertRowid });
});
A.get('/giveaways/:id', (req, res) => {
  const g = R.ready(db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id)); if (!g) return bad(res, 404, 'Not found');
  const entrants = giveawayEntrants(g);
  res.json({ ok: true, giveaway: { ...giveawayPublic(g), active: !!g.active, prize_tiers_raw: g.prize_tiers || '', winner_count_raw: g.winner_count || 0 }, entrants: entrants.map(publicRow), stats: boards.giveawayStats(g), now: now() });
});
A.put('/giveaways/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!ex) return bad(res, 404, 'Not found');
  const [g, err, gameIds] = readGiveaway(req.body || {}); if (err) return bad(res, 400, err);
  if (ex.finalized_at) {
    const cur = giveawayGameIds(ex.id);
    const changed = ['start_at', 'end_at', 'min_score', 'win_method', 'winner_count'].filter(k => Number.isFinite(ex[k]) ? Number(ex[k]) !== Number(g[k]) : String(ex[k]) !== String(g[k]));
    if (cur.join() !== gameIds.join()) changed.push('games');
    if (changed.length) return bad(res, 409, `Final results are locked, so these can't change: ${changed.join(', ')}. You can still edit the title, prize, artwork and rules text.`);
  }
  db.prepare(`UPDATE giveaways SET ${GW_COLS.split(',').map(c => `${c}=@${c}`).join(',')},updated_at=${now()} WHERE id=${ex.id}`).run(g);
  setGames(ex.id, gameIds);
  res.json({ ok: true });
});
// one-click link / unlink a game from a giveaway (Admin > Games toggles)
A.post('/giveaways/:id/games', (req, res) => {
  const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!g) return bad(res, 404, 'Not found');
  const gameId = String(req.body.game_id || ''); if (!cfg.GAME_MAP[gameId]) return bad(res, 400, 'Unknown game.');
  if (g.finalized_at) return bad(res, 409, 'Final results are locked, so linked games can\'t change.');
  const cur = giveawayGameIds(g.id);
  let next = req.body.linked ? [...new Set([...cur, gameId])] : cur.filter(x => x !== gameId);
  if (!next.length) return bad(res, 400, 'A giveaway needs at least one game. Link another game first, or delete the giveaway.');
  setGames(g.id, next);
  res.json({ ok: true, game_ids: next });
});
A.delete('/giveaways/:id', (req, res) => {
  db.prepare("DELETE FROM activity WHERE type IN ('giveaway','entry','winner') AND ref_id=?").run(req.params.id);
  // notifications that point at the deleted giveaway (new-giveaway broadcast, winner / disqualification notices)
  db.prepare("DELETE FROM notifications WHERE link = ? OR link LIKE ?").run(`/giveaways/${Number(req.params.id)}`, `/giveaways/${Number(req.params.id)}/%`);
  const r = db.prepare('DELETE FROM giveaways WHERE id=?').run(req.params.id);
  res.json({ ok: r.changes === 1 });
});
A.post('/giveaways/:id/draw', (req, res) => {
  const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!g) return bad(res, 404, 'Not found');
  if (R.ready(g).finalized_at) return bad(res, 409, 'This giveaway has ended and its final standings are locked. Use the review queue to confirm or disqualify winners.');
  const method = req.body.method === 'top' ? 'top' : 'random';
  const entrants = giveawayEntrants(g);
  const already = new Set(db.prepare('SELECT user_id FROM winners WHERE giveaway_id=?').all(g.id).map(r => r.user_id));
  const pool = entrants.filter(e => !already.has(e.user_id));
  const n = Math.min(Math.max(parseInt(req.body.count || '1', 10) || 1, 1), 100);
  if (!pool.length) return bad(res, 400, entrants.length ? 'Every entrant has already been drawn.' : 'No entrants yet.');
  const picks = [];
  if (method === 'top') picks.push(...pool.slice(0, n));
  else {
    const arr = pool.slice();
    for (let i = 0; i < Math.min(n, arr.length); i++) { const j = i + crypto.randomInt(arr.length - i); [arr[i], arr[j]] = [arr[j], arr[i]]; picks.push(arr[i]); }
  }
  const t = now();
  const ins = db.prepare('INSERT INTO winners (giveaway_id,user_id,method,score,drawn_at) VALUES (?,?,?,?,?)');
  db.transaction(() => { for (const p of picks) { ins.run(g.id, p.user_id, method, p.score, t); logActivity('winner', `${p.username} won "${g.title}" (${method === 'top' ? 'top score' : 'random draw'})`, p.user_id, g.id); } })();
  for (const p of picks) { require('./notify').notify(p.user_id, 'winner', `You won "${g.title}"!`, `Prize: ${g.prize}. ${g.host} or the Trap Tech team will contact you to verify eligibility (21+) and deliver your prize.`, `/giveaways/${g.id}`, 'party-popper'); ach.evaluate(p.user_id, { games: [] }); } // "Winner Winner" etc.
  res.json({ ok: true, method, pool_size: pool.length, winners: picks.map(publicRow) });
});
A.delete('/giveaways/:id/winners', (req, res) => {
  const g = db.prepare('SELECT finalized_at FROM giveaways WHERE id=?').get(req.params.id);
  if (g && g.finalized_at) return bad(res, 409, 'Final results are locked. Disqualify a winner instead (the next place is promoted automatically).');
  const r = db.prepare('DELETE FROM winners WHERE giveaway_id=?').run(req.params.id); res.json({ ok: true, removed: r.changes });
});

A.get('/players', (req, res) => {
  const q = `%${str(req.query.q, 40)}%`;
  const rows = db.prepare(`SELECT u.id, u.username, u.created_at, u.last_seen, u.banned, u.is_demo,
      (SELECT COUNT(*) FROM runs r WHERE r.user_id=u.id) AS runs, (SELECT MAX(score) FROM runs r WHERE r.user_id=u.id) AS best,
      (SELECT COUNT(*) FROM winners w WHERE w.user_id=u.id) AS wins
    FROM users u WHERE u.username LIKE ? ORDER BY u.created_at DESC LIMIT 500`).all(q);
  res.json({ ok: true, players: rows });
});
A.post('/players/:id/ban', (req, res) => { db.prepare('UPDATE users SET banned=? WHERE id=?').run(req.body.banned ? 1 : 0, req.params.id); res.json({ ok: true }); });
A.post('/players/:id/reset-password', (req, res) => {
  const tmp = crypto.randomBytes(6).toString('base64url');
  const r = db.prepare('UPDATE users SET pass_hash=? WHERE id=?').run(bcrypt.hashSync(tmp, 10), req.params.id);
  if (!r.changes) return bad(res, 404, 'Not found');
  res.json({ ok: true, temp_password: tmp });
});
A.delete('/players/:id', (req, res) => { db.prepare('DELETE FROM activity WHERE user_id=?').run(req.params.id); const r = db.prepare('DELETE FROM users WHERE id=?').run(req.params.id); res.json({ ok: r.changes === 1 }); });

A.get('/bookings', (req, res) => res.json({ ok: true, bookings: db.prepare('SELECT b.*, u.username FROM bookings b LEFT JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC').all() }));
A.put('/bookings/:id', (req, res) => {
  const status = ['pending', 'approved', 'declined', 'done'].includes(req.body.status) ? req.body.status : 'pending';
  db.prepare('UPDATE bookings SET status=?, admin_note=? WHERE id=?').run(status, str(req.body.admin_note, 2000), req.params.id);
  res.json({ ok: true });
});
A.delete('/bookings/:id', (req, res) => { db.prepare("DELETE FROM activity WHERE type='booking' AND ref_id=?").run(req.params.id); db.prepare('DELETE FROM bookings WHERE id=?').run(req.params.id); res.json({ ok: true }); });

A.get('/announcements', (req, res) => res.json({ ok: true, announcements: db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all() }));
A.post('/announcements', (req, res) => {
  const title = str(req.body.title, 140); if (!title) return bad(res, 400, 'Title required');
  const info = db.prepare('INSERT INTO announcements (title, body, created_at) VALUES (?,?,?)').run(title, str(req.body.body, 4000), now());
  logActivity('announcement', `Announcement posted: ${title}`, null, info.lastInsertRowid);
  require('./notify').notify(null, 'announcement', title, str(req.body.body, 300), '/community', 'megaphone');
  res.json({ ok: true, id: info.lastInsertRowid });
});
A.delete('/announcements/:id', (req, res) => { db.prepare('DELETE FROM announcements WHERE id=?').run(req.params.id); res.json({ ok: true }); });

A.get('/runs', (req, res) => {
  res.json({ ok: true, rejected: db.prepare("SELECT t.rid, u.username, t.game_id, t.started_at, t.used_at, t.reason FROM run_tokens t JOIN users u ON u.id=t.user_id WHERE t.status='rejected' ORDER BY t.used_at DESC LIMIT 50").all() });
});

// CSV exports
function csv(rows, cols) {
  const esc = (v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\r\n') + '\r\n';
}
const iso = (ms) => ms ? new Date(ms).toISOString() : '';
function sendCsv(res, name, rows, cols) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  res.send(csv(rows, cols));
}
A.get('/export/leaderboard.csv', (req, res) => {
  let rows; let name;
  if (req.query.giveaway) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.query.giveaway); if (!g) return bad(res, 404, 'Not found');
    const winners = new Map(db.prepare('SELECT user_id, method FROM winners WHERE giveaway_id=?').all(g.id).map(w => [w.user_id, w.method]));
    rows = giveawayEntrants(g).map(r => ({ ...r, winner: winners.get(r.user_id) || '' })); name = `giveaway-${g.id}-entrants.csv`;
  } else {
    const game = String(req.query.game || 'global'); const since = periodStart(req.query.period);
    rows = ranked(game === 'global' ? globalBoard(since) : gameBoard(game, since)); name = `leaderboard-${game}-${req.query.period || 'all'}.csv`;
  }
  sendCsv(res, name, rows.map(r => ({ ...r, last_at: iso(r.last_at), first_at: iso(r.first_at), demo: r.is_demo ? 'yes' : '' })), ['rank', 'username', 'score', 'runs', 'first_at', 'last_at', 'demo', ...(req.query.giveaway ? ['winner'] : [])]);
});
A.get('/export/runs.csv', (req, res) => {
  const rows = db.prepare('SELECT r.id, u.username, r.game_id, r.score, r.coins, r.duration_ms, r.started_at, r.created_at, r.ip_hash, r.is_demo FROM runs r JOIN users u ON u.id=r.user_id ORDER BY r.created_at DESC').all()
    .map(r => ({ ...r, started_at: iso(r.started_at), created_at: iso(r.created_at) }));
  sendCsv(res, 'runs.csv', rows, ['id', 'username', 'game_id', 'score', 'coins', 'duration_ms', 'started_at', 'created_at', 'ip_hash', 'is_demo']);
});
A.get('/export/players.csv', (req, res) => {
  const rows = db.prepare('SELECT u.id, u.username, u.created_at, u.last_seen, u.banned, u.is_demo, (SELECT COUNT(*) FROM runs r WHERE r.user_id=u.id) AS runs, (SELECT MAX(score) FROM runs r WHERE r.user_id=u.id) AS best FROM users u ORDER BY u.id').all()
    .map(r => ({ ...r, created_at: iso(r.created_at), last_seen: iso(r.last_seen) }));
  sendCsv(res, 'players.csv', rows, ['id', 'username', 'created_at', 'last_seen', 'runs', 'best', 'banned', 'is_demo']);
});
A.get('/export/bookings.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all().map(r => ({ ...r, created_at: iso(r.created_at) }));
  sendCsv(res, 'bookings.csv', rows, ['id', 'brand', 'contact_name', 'contact', 'event_type', 'package', 'package_snapshot', 'start_date', 'end_date', 'details', 'status', 'admin_note', 'created_at', 'is_demo']);
});

// hosting packages (prices/features shown on /host)
A.get('/packages', (req, res) => res.json({ ok: true, ...PK.getPackages(), defaults: PK.DEFAULT_PACKAGES }));
A.put('/packages', (req, res) => {
  const [v, err] = PK.sanitize(req.body || {}); if (err) return bad(res, 400, err);
  PK.savePackages(v); res.json({ ok: true, ...v });
});
A.post('/packages/reset', (req, res) => { PK.resetPackages(); res.json({ ok: true, ...PK.getPackages() }); });
A.get('/achievements', (req, res) => {
  const rr = ach.rarity();
  res.json({ ok: true, players: rr.total, unlocks: db.prepare('SELECT COUNT(*) AS c FROM user_achievements').get().c,
    achievements: ach.ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, cat: a.cat, tier: a.tier, hidden: a.hidden, pct: rr.pct(a.id) })) });
});

// ---------- v3 routes (streaks, quests, seasons, tournaments, follows, notifications, referrals, sharing, search) ----------
Object.assign(H, { requireUser, currentUser, publicRow });
require('./v3')(app, A, H);
Object.assign(H, { csv, sendCsv, iso, giveawayPublic, ipHash });
require('./v4')(app, A, H);

const demo = require('./demo');
A.post('/demo/seed', (req, res) => res.json({ ok: true, ...demo.seed() }));
A.post('/demo/wipe', (req, res) => res.json({ ok: true, ...demo.wipe() }));
app.use('/api/admin', A);

app.use('/api', (req, res) => bad(res, 404, 'Not found'));

// ---------- static ----------
const PUB = path.join(cfg.ROOT, 'public');
app.use(express.static(PUB, { index: false, extensions: ['html'], maxAge: '1h', setHeaders(res, p) { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get(['/admin', '/admin/*'], (req, res) => res.sendFile(path.join(PUB, 'admin.html')));
// Per-page <title> / description / Open Graph + Twitter card tags for share links (crawlers don't run JS).
const INDEX_FILE = path.join(PUB, 'index.html');
const escA = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PAGE_TITLES = { '/games': 'Games', '/leaderboard': 'Leaderboards', '/giveaways': 'Giveaways', '/tournaments': 'Tournaments', '/season': 'Season Pass', '/quests': 'Daily Quests',
  '/achievements': 'Achievements & Rewards', '/community': 'Community', '/host': 'Host a Giveaway - Trap Tech Solutions', '/book': 'Book a Branded Game or Giveaway', '/about': 'About Trap Tech Solutions',
  '/terms': 'Terms of Service', '/privacy': 'Privacy Policy', '/rules': 'Official Giveaway Rules', '/responsible-play': 'Responsible Play', '/search': 'Search', '/notifications': 'Notifications', '/settings': 'Settings', '/invite': 'Invite Friends' };
function pageMeta(p, origin) {
  let m = null, mm;
  if ((mm = p.match(/^\/s\/(\d+)$/))) { const o = H.og.run(+mm[1]); if (o) m = { ...o, img: `/og/run/${mm[1]}.png` }; }
  else if ((mm = p.match(/^\/giveaways\/(\d+)(\/rules|\/live|\/results)?$/))) { const o = H.og.giveaway(+mm[1]); if (o) m = { ...o, img: `/og/giveaway/${mm[1]}.png`, title: ({ '/rules': 'Official Rules: ', '/live': 'Live standings: ', '/results': 'Final results: ' }[mm[2]] || '') + o.title }; }
  else if ((mm = p.match(/^\/u\/([^/]+)$/))) { const o = H.og.profile(decodeURIComponent(mm[1])); if (o) m = { ...o, img: `/og/u/${encodeURIComponent(decodeURIComponent(mm[1]))}.png` }; }
  else if ((mm = p.match(/^\/tournaments\/(\d+)$/))) { const o = H.og.tournament(+mm[1]); if (o) m = { ...o, img: `/og/tournament/${mm[1]}.png` }; }
  else if ((mm = p.match(/^\/(?:games|play)\/([\w-]+)$/))) { const o = H.og.game(mm[1]); if (o) m = o; }
  if (!m && PAGE_TITLES[p]) m = { title: PAGE_TITLES[p] };
  if (!m) return null;
  const site = 'The Gaming Hub by Trap Tech Solutions';
  const title = `${m.title} | ${site}`; const desc = m.desc || 'Free arcade games, leaderboards, tournaments and brand giveaways. Built by Trap Tech Solutions. 21+. No purchase necessary.';
  const img = origin + (m.img || '/og/default.png'); const url = origin + p;
  return `<title>${escA(title)}</title>
  <meta name="description" content="${escA(desc)}">
  <meta property="og:title" content="${escA(m.title)}"><meta property="og:description" content="${escA(desc)}"><meta property="og:image" content="${escA(img)}">
  <meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:url" content="${escA(url)}"><meta property="og:type" content="website"><meta property="og:site_name" content="${site}">
  <meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escA(m.title)}"><meta name="twitter:description" content="${escA(desc)}"><meta name="twitter:image" content="${escA(img)}">`;
}
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).send('Not found');
  res.setHeader('Cache-Control', 'no-cache');
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const origin = `${isHttps(req) ? 'https' : 'http'}://${req.get('host')}`;
  const meta = (() => { try { return pageMeta(req.path.replace(/\/+$/, '') || '/', origin); } catch (e) { console.error(e); return null; } })();
  if (meta) html = html.replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta);
  else html = html.replace(/(content=")\/og\/default\.png"/g, `$1${origin}/og/default.png"`);
  res.type('html').send(html);
});
app.use((err, req, res, next) => { console.error(err); bad(res, err.status || 500, err.type === 'entity.parse.failed' ? 'Bad JSON' : 'Server error'); });

// lock final standings automatically at each giveaway's end time
setInterval(() => R.sweep(), 15e3).unref(); setTimeout(() => R.sweep(), 1500).unref();
const server = app.listen(cfg.PORT, '0.0.0.0', () => console.log(`[${new Date().toISOString()}] Gaming Hub listening on port ${cfg.PORT} (db: ${cfg.DB_PATH})`));
// Graceful shutdown (Render/Docker send SIGTERM on deploys): stop accepting requests, then close SQLite cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`[${new Date().toISOString()}] ${sig} received, shutting down`);
  server.close(() => { try { db.close(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(0), 8000).unref();
});

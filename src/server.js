'use strict';
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const cfg = require('./config');
const db = require('./db');

const app = express();
app.set('trust proxy', true);
app.disable('x-powered-by');
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

// ---------- auth ----------
function currentUser(req) {
  const tok = verify(cfg.SESSION_SECRET, parseCookies(req).gh_sess);
  if (!tok || tok.e < now()) return null;
  const u = db.prepare('SELECT id, username, created_at, banned, is_demo FROM users WHERE id=?').get(tok.u);
  if (!u || u.banned) return null;
  return u;
}
function startSession(req, res, user) {
  setCookie(req, res, 'gh_sess', sign(cfg.SESSION_SECRET, { u: user.id, e: now() + cfg.SESSION_TTL_MS }), cfg.SESSION_TTL_MS);
  db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), user.id);
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
  if (db.prepare('SELECT 1 FROM users WHERE username=?').get(username)) return bad(res, 409, 'That Potato username is taken.');
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (username, pass_hash, created_at, last_seen) VALUES (?,?,?,?)').run(username, hash, now(), now());
  const user = { id: info.lastInsertRowid, username };
  logActivity('player', `New player registered: ${username}`, user.id);
  startSession(req, res, user);
  res.json({ ok: true, user: { username } });
});

app.post('/api/auth/signin', limiter('signin', 20, 15 * 60e3), (req, res) => {
  const username = str(req.body.username, 40); const password = String(req.body.password || '');
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(username);
  if (!u || !bcrypt.compareSync(password, u.pass_hash)) return bad(res, 401, 'Wrong username or password.');
  if (u.banned) return bad(res, 403, 'This account has been suspended.');
  startSession(req, res, u);
  res.json({ ok: true, user: { username: u.username } });
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
  res.json({ ok: true, user: u ? { username: u.username, created_at: u.created_at } : null, now: now() });
});

// ---------- games & leaderboards ----------
app.get('/api/games', (req, res) => res.json({ ok: true, games: cfg.GAMES }));

function periodStart(period) {
  if (period === 'weekly') return now() - 7 * 864e5;
  if (period === 'monthly') return now() - 30 * 864e5;
  return 0;
}
function gameBoard(gameId, since = 0, until = Infinity, opts = {}) {
  const until2 = Number.isFinite(until) ? until : 8.64e15;
  const startCol = opts.byStart ? 'r.started_at' : 'r.created_at';
  return db.prepare(`
    SELECT u.id AS user_id, u.username, u.is_demo, MAX(r.score) AS score, COUNT(*) AS runs, MAX(r.created_at) AS last_at,
           MIN(r.created_at) AS first_at
    FROM runs r JOIN users u ON u.id = r.user_id
    WHERE r.game_id = ? AND ${startCol} >= ? AND r.created_at >= ? AND r.created_at <= ? AND u.banned = 0
    GROUP BY u.id ORDER BY score DESC, last_at ASC`).all(gameId, since, since, until2);
}
function globalBoard(since = 0) {
  return db.prepare(`
    SELECT u.id AS user_id, u.username, u.is_demo, SUM(b.best) AS score, SUM(b.n) AS runs, MAX(b.last_at) AS last_at
    FROM (SELECT user_id, game_id, MAX(score) AS best, COUNT(*) AS n, MAX(created_at) AS last_at FROM runs WHERE created_at >= ? GROUP BY user_id, game_id) b
    JOIN users u ON u.id = b.user_id WHERE u.banned = 0
    GROUP BY u.id ORDER BY score DESC, last_at ASC`).all(since);
}
const ranked = (rows) => rows.map((r, i) => ({ rank: i + 1, ...r }));

app.get('/api/leaderboard', (req, res) => {
  const game = String(req.query.game || req.query.contest_game || 'global');
  const period = ['weekly', 'monthly'].includes(req.query.period) ? req.query.period : 'all';
  const limit = Math.min(Math.max(parseInt(req.query.limit || '50', 10) || 50, 1), 500);
  let rows;
  if (req.query.giveaway || req.query.contest) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.query.giveaway || req.query.contest);
    if (!g) return bad(res, 404, 'Giveaway not found');
    rows = giveawayEntrants(g);
  } else if (game === 'global') rows = ranked(globalBoard(periodStart(period)));
  else if (cfg.GAME_MAP[game]) rows = ranked(gameBoard(game, periodStart(period)));
  else return bad(res, 404, 'Unknown game');
  const me = currentUser(req);
  const mine = me ? rows.find(r => r.user_id === me.id) || null : null;
  res.json({ ok: true, game, period, total: rows.length, rows: rows.slice(0, limit).map(publicRow), me: mine && publicRow(mine), now: now() });
});
const publicRow = (r) => ({ rank: r.rank, username: r.username, score: r.score, runs: r.runs, last_at: r.last_at, demo: !!r.is_demo });

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

function activeGiveawaysFor(gameId, at) {
  return db.prepare('SELECT * FROM giveaways WHERE active=1 AND game_id=? AND start_at<=? AND end_at>=?').all(gameId, at, at);
}

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
  const score = Number(req.body.score); const coins = Number(req.body.coins || 0);
  if (!Number.isInteger(score) || score < 0 || score > 10_000_000) return reject(400, 'Invalid score value.');
  if (!Number.isInteger(coins) || coins < 0 || coins > 1_000_000) return reject(400, 'Invalid coin value.');
  const elapsedS = (t - row.started_at) / 1000;
  const maxScore = Math.floor(cfg.MAX_METERS_PER_SEC * elapsedS + cfg.SCORE_GRACE);
  if (score > maxScore) return reject(422, `Score rejected: ${score}m in ${elapsedS.toFixed(1)}s is not possible (max ${maxScore}m).`);
  if (coins > cfg.MAX_COINS_PER_SEC * elapsedS + 10) return reject(422, 'Coin count rejected as implausible.');
  const durationMs = Math.max(0, Math.min(Math.round(Number(req.body.duration_ms) || 0), t - row.started_at + 5000));

  // single-use: atomically claim the token
  const claim = db.prepare("UPDATE run_tokens SET used_at=?, status='accepted' WHERE rid=? AND used_at IS NULL").run(t, row.rid);
  if (claim.changes !== 1) return bad(res, 409, 'This run was already submitted.', { rejected: true });

  const prevBest = db.prepare('SELECT MAX(score) AS b FROM runs WHERE user_id=? AND game_id=?').get(req.user.id, row.game_id).b;
  const gws = activeGiveawaysFor(row.game_id, t).filter(g => row.started_at >= g.start_at);
  const newEntries = [];
  for (const g of gws) {
    const had = db.prepare('SELECT 1 FROM runs WHERE user_id=? AND game_id=? AND started_at>=? AND created_at<=? LIMIT 1').get(req.user.id, g.game_id, g.start_at, g.end_at);
    if (!had) newEntries.push(g);
  }
  const info = db.prepare('INSERT INTO runs (user_id,game_id,score,coins,duration_ms,started_at,created_at,ip_hash) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.user.id, row.game_id, score, coins, durationMs, row.started_at, t, ipHash(req));
  const gameTitle = cfg.GAME_MAP[row.game_id].title;
  for (const g of newEntries) logActivity('entry', `${req.user.username} entered "${g.title}"`, req.user.id, g.id);
  const isBest = prevBest === null || prevBest === undefined || score > prevBest;
  if (isBest && score >= 100) logActivity('highscore', `New high score (${gameTitle}): ${req.user.username} - ${score.toLocaleString('en-US')}m`, req.user.id, info.lastInsertRowid);

  const board = gameBoard(row.game_id);
  const rank = board.findIndex(r => r.user_id === req.user.id) + 1;
  const counted = gws.map(g => {
    const entrants = giveawayEntrants(g); const me = entrants.find(e => e.user_id === req.user.id);
    return { id: g.id, title: g.title, rank: me ? me.rank : null, entrants: entrants.length };
  });
  // explicit giveaway param (legacy "contest") => tell the client if it ended
  let giveawayStatus = null;
  const gid = req.body.giveaway_id || req.body.contest;
  if (gid) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(gid);
    giveawayStatus = !g ? 'not_found' : (t > g.end_at ? 'ended_not_counted' : t < g.start_at ? 'not_started_not_counted' : !g.active ? 'inactive' : 'counted');
  }
  res.json({ ok: true, run_id: info.lastInsertRowid, score, coins, personal_best: isBest, best: Math.max(score, prevBest || 0), rank, players: board.length, giveaways: counted, giveaway_status: giveawayStatus });
});

// ---------- giveaways ----------
function giveawayEntrants(g) {
  return ranked(gameBoard(g.game_id, g.start_at, g.end_at, { byStart: true }));
}
function giveawayStatus(g, t = now()) { return t < g.start_at ? 'upcoming' : t > g.end_at ? 'past' : 'active'; }
function giveawayPublic(g, withWinners = true) {
  const entrants = giveawayEntrants(g);
  const out = { id: g.id, title: g.title, host: g.host, prize: g.prize, image: g.image, start_at: g.start_at, end_at: g.end_at,
    entry_method: g.entry_method, game_id: g.game_id, game_title: cfg.GAME_MAP[g.game_id]?.title || g.game_id, rules: g.rules,
    status: giveawayStatus(g), entrants: entrants.length, demo: !!g.is_demo, top: entrants.slice(0, 3).map(publicRow) };
  if (withWinners) out.winners = db.prepare('SELECT u.username, w.method, w.score, w.drawn_at FROM winners w JOIN users u ON u.id=w.user_id WHERE w.giveaway_id=? ORDER BY w.drawn_at').all(g.id);
  return out;
}
app.get('/api/giveaways', (req, res) => {
  const status = req.query.status;
  const all = db.prepare('SELECT * FROM giveaways WHERE active=1 ORDER BY start_at DESC').all();
  let list = all.map(g => giveawayPublic(g));
  if (['active', 'upcoming', 'past'].includes(status)) list = list.filter(g => g.status === status);
  list.sort((a, b) => a.status === 'past' ? b.end_at - a.end_at : a.end_at - b.end_at);
  res.json({ ok: true, giveaways: list, now: now() });
});
app.get('/api/giveaways/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM giveaways WHERE id=? AND active=1').get(req.params.id);
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
    .map(r => ({ ...r, game_title: cfg.GAME_MAP[r.game_id]?.title || r.game_id }));
  const gb = globalBoard(0); const grank = gb.findIndex(r => r.user_id === user.id) + 1;
  const entries = db.prepare(`SELECT COUNT(DISTINCT g.id) AS c FROM giveaways g JOIN runs r ON r.game_id=g.game_id AND r.user_id=? AND r.started_at>=g.start_at AND r.created_at<=g.end_at AND r.created_at>=g.start_at`).get(user.id).c;
  const best = Math.max(0, ...bests.map(b => b.best));
  const achievements = [
    { id: 'rising-star', name: 'Rising Star', desc: 'Play your first run', earned: plays >= 1, img: '/assets/badges/rising-star.webp' },
    { id: 'top-10', name: 'Top 10', desc: 'Reach the global top 10', earned: grank > 0 && grank <= 10, img: '/assets/badges/top-10.webp' },
    { id: 'game-master', name: 'Game Master', desc: 'Fly 1,000m in a single run', earned: best >= 1000, img: '/assets/badges/game-master.webp' },
    { id: 'lucky', name: 'Lucky', desc: 'Win a giveaway', earned: wins >= 1, img: '/assets/badges/lucky.webp' },
  ];
  return { username: user.username, member_since: user.created_at, demo: !!user.is_demo, total_score: total, games_played: plays, coins,
    giveaways_won: wins, giveaways_entered: entries, global_rank: grank || null, level: Math.floor(Math.sqrt(total / 150)) + 1,
    best_by_game: bests.map(b => ({ game_id: b.game_id, game_title: cfg.GAME_MAP[b.game_id]?.title || b.game_id, best: b.best, plays: b.n })),
    achievements, recent };
}
app.get('/api/profile/:username', (req, res) => {
  const u = db.prepare('SELECT id, username, created_at, is_demo FROM users WHERE username=? AND banned=0').get(String(req.params.username));
  if (!u) return bad(res, 404, 'Player not found');
  const me = currentUser(req);
  res.json({ ok: true, profile: profileFor(u), is_me: !!(me && me.id === u.id) });
});

// ---------- community ----------
app.get('/api/community', (req, res) => {
  const tab = req.query.tab || 'all';
  const ann = db.prepare('SELECT id, title, body, created_at, is_demo FROM announcements ORDER BY created_at DESC LIMIT 30').all().map(a => ({ kind: 'announcement', ...a }));
  const wins = db.prepare(`SELECT w.drawn_at AS created_at, u.username, g.title, w.method FROM winners w JOIN users u ON u.id=w.user_id JOIN giveaways g ON g.id=w.giveaway_id WHERE g.active=1 ORDER BY w.drawn_at DESC LIMIT 30`).all()
    .map(w => ({ kind: 'winner', title: `${w.username} won "${w.title}"`, body: w.method === 'top' ? 'Winner by top score' : 'Winner by random draw', created_at: w.created_at }));
  const hs = db.prepare("SELECT message AS title, created_at FROM activity WHERE type IN ('highscore','player') ORDER BY created_at DESC LIMIT 30").all().map(a => ({ kind: 'activity', ...a }));
  let items = tab === 'announcements' ? ann : tab === 'winners' ? wins : [...ann, ...wins, ...hs];
  items.sort((a, b) => b.created_at - a.created_at);
  res.json({ ok: true, items: items.slice(0, 40), now: now() });
});

// ---------- bookings ----------
app.post('/api/bookings', limiter('booking', 8, 3600e3), (req, res) => {
  const b = req.body || {};
  const brand = str(b.brand, 120), contact = str(b.contact, 160);
  if (!brand) return bad(res, 400, 'Channel / brand name is required.');
  if (!contact) return bad(res, 400, 'Please give an email or Discord handle so we can reply.');
  const pkg = ['basic', 'premium', 'elite', 'custom'].includes(b.package) ? b.package : 'custom';
  const me = currentUser(req);
  const info = db.prepare(`INSERT INTO bookings (brand,contact_name,contact,event_type,package,start_date,end_date,details,user_id,created_at,ip_hash)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(brand, str(b.contact_name, 120), contact, str(b.event_type, 60), pkg,
    str(b.start_date, 20), str(b.end_date, 20), str(b.details, 4000), me ? me.id : null, now(), ipHash(req));
  logActivity('booking', `Booking request submitted: ${brand} (${pkg})`, me ? me.id : null, info.lastInsertRowid);
  res.json({ ok: true, id: info.lastInsertRowid });
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
  res.json({ ok: true, games: cfg.GAMES.map(g => ({ ...g, runs: m[g.id]?.runs || 0, players: m[g.id]?.players || 0, best: m[g.id]?.best || 0 })) });
});

function readGiveaway(b) {
  const g = {
    title: str(b.title, 120), host: str(b.host, 80), prize: str(b.prize, 200), image: str(b.image, 300),
    start_at: Number(b.start_at), end_at: Number(b.end_at), entry_method: 'play',
    game_id: String(b.game_id || 'jetpack-dash'), rules: str(b.rules, 4000), active: b.active ? 1 : 0,
  };
  if (!g.title) return [null, 'Title is required.'];
  if (!Number.isFinite(g.start_at) || !Number.isFinite(g.end_at)) return [null, 'Start and end date/time are required.'];
  if (g.end_at <= g.start_at) return [null, 'End time must be after start time.'];
  if (!cfg.GAME_MAP[g.game_id]) return [null, 'Unknown linked game.'];
  if (g.image && !/^(\/assets\/[\w\-./]+|https:\/\/[^\s"'<>]+)$/.test(g.image)) return [null, 'Image must be a /assets/... path or an https:// URL.'];
  return [g, null];
}
A.get('/giveaways', (req, res) => {
  const list = db.prepare('SELECT * FROM giveaways ORDER BY start_at DESC').all().map(g => ({ ...giveawayPublic(g), active: !!g.active }));
  res.json({ ok: true, giveaways: list, now: now() });
});
A.post('/giveaways', (req, res) => {
  const [g, err] = readGiveaway(req.body || {}); if (err) return bad(res, 400, err);
  const t = now();
  const info = db.prepare(`INSERT INTO giveaways (title,host,prize,image,start_at,end_at,entry_method,game_id,rules,active,created_at,updated_at)
    VALUES (@title,@host,@prize,@image,@start_at,@end_at,@entry_method,@game_id,@rules,@active,${t},${t})`).run(g);
  logActivity('giveaway', `Giveaway created: ${g.title}`, null, info.lastInsertRowid);
  res.json({ ok: true, id: info.lastInsertRowid });
});
A.get('/giveaways/:id', (req, res) => {
  const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!g) return bad(res, 404, 'Not found');
  const entrants = giveawayEntrants(g);
  res.json({ ok: true, giveaway: { ...giveawayPublic(g), active: !!g.active }, entrants: entrants.map(publicRow), now: now() });
});
A.put('/giveaways/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!ex) return bad(res, 404, 'Not found');
  const [g, err] = readGiveaway(req.body || {}); if (err) return bad(res, 400, err);
  db.prepare(`UPDATE giveaways SET title=@title,host=@host,prize=@prize,image=@image,start_at=@start_at,end_at=@end_at,entry_method=@entry_method,
    game_id=@game_id,rules=@rules,active=@active,updated_at=${now()} WHERE id=${ex.id}`).run(g);
  res.json({ ok: true });
});
A.delete('/giveaways/:id', (req, res) => {
  db.prepare("DELETE FROM activity WHERE type IN ('giveaway','entry','winner') AND ref_id=?").run(req.params.id);
  const r = db.prepare('DELETE FROM giveaways WHERE id=?').run(req.params.id);
  res.json({ ok: r.changes === 1 });
});
A.post('/giveaways/:id/draw', (req, res) => {
  const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!g) return bad(res, 404, 'Not found');
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
  res.json({ ok: true, method, pool_size: pool.length, winners: picks.map(publicRow) });
});
A.delete('/giveaways/:id/winners', (req, res) => {
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
  sendCsv(res, 'bookings.csv', rows, ['id', 'brand', 'contact_name', 'contact', 'event_type', 'package', 'start_date', 'end_date', 'details', 'status', 'admin_note', 'created_at', 'is_demo']);
});

const demo = require('./demo');
A.post('/demo/seed', (req, res) => res.json({ ok: true, ...demo.seed() }));
A.post('/demo/wipe', (req, res) => res.json({ ok: true, ...demo.wipe() }));
app.use('/api/admin', A);

app.use('/api', (req, res) => bad(res, 404, 'Not found'));

// ---------- static ----------
const PUB = path.join(cfg.ROOT, 'public');
app.use(express.static(PUB, { extensions: ['html'], maxAge: '1h', setHeaders(res, p) { if (p.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get(['/admin', '/admin/*'], (req, res) => res.sendFile(path.join(PUB, 'admin.html')));
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).send('Not found');
  res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(PUB, 'index.html'));
});
app.use((err, req, res, next) => { console.error(err); bad(res, err.status || 500, err.type === 'entity.parse.failed' ? 'Bad JSON' : 'Server error'); });

const server = app.listen(cfg.PORT, '0.0.0.0', () => console.log(`[${new Date().toISOString()}] Gaming Hub listening on port ${cfg.PORT} (db: ${cfg.DB_PATH})`));
// Graceful shutdown (Render/Docker send SIGTERM on deploys): stop accepting requests, then close SQLite cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`[${new Date().toISOString()}] ${sig} received, shutting down`);
  server.close(() => { try { db.close(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(0), 8000).unref();
});

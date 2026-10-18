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
const AC = require('./anticheat');
const COS = require('./cosmetics');
const PK = require('./packages');
const { gameBoard, globalBoard, ranked, giveawayEntrants, giveawayStatus, activeGiveawaysFor, giveawayGameIds } = boards;

// Resolve first-party games and Games Library titles through the same signed-run pipeline.
// Official event eligibility remains controlled by the event builder and server-side event checks.
const libraryGames = () => require('./games-lib').games;
const resolveGame = (id) => cfg.GAME_MAP[id] || libraryGames().find(g => g.id === id) || null;
const HUB_VERSION = 'V1';
const { buildFingerprint } = require('./build-info');
const BUILD_FINGERPRINT = buildFingerprint(path.resolve(__dirname, '..'));

const app = express();
require('./external-routes').register(app); // External games catalog (GameArter + GameDistribution) at /external
const proxyHops = Number(process.env.TRUST_PROXY_HOPS || (process.env.NODE_ENV === 'production' ? 1 : 0));
// Trust at most the configured reverse-proxy hop count (one hosting ingress hop in production by default); never trust an arbitrary full X-Forwarded-* chain.
app.set('trust proxy', Number.isInteger(proxyHops) && proxyHops >= 1 && proxyHops <= 3 ? proxyHops : false);
const PU = require('./public-url'); app.use(PU.redirect()); // v7: PUBLIC_URL + optional CANONICAL_REDIRECT (src/public-url.js)
app.disable('x-powered-by');
// Baseline hardening: client-side code is public by design, but browser capabilities and API responses are constrained.
// Authorization remains server-side; hiding JavaScript is not a security boundary.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
});
require('./v8-sec').install(app); // v8: public-page CSP + cross-site request guard
const PRIVATE_REVIEW = require('./private-review');
app.use(PRIVATE_REVIEW.makeGate({
  enabled: process.env.HUB_PRIVATE_REVIEW === '1',
  users: process.env.HUB_PREVIEW_USERNAMES || '',
  reviewerExists: username => !!db.prepare('SELECT 1 FROM users WHERE lower(username)=? AND banned=0 LIMIT 1').get(username),
  currentUser: req => currentUser(req),
  isOwnerAdmin: req => ADMSEC.isOwnerSession(req),
  adminBase: () => ADMSEC.BASE()
})); // Explicit preview switch; OFF on normal public builds.
// The review gate MUST precede even compressed static files; otherwise /index.html
// or pre-gzipped page assets could bypass it before Express routing.
// Static text assets are gzipped at build time (scripts/deplexo-prebuild.js -> $BUILD_DIR/gz) and served as-is;
// on-the-fly gzip is only used for dynamic responses (JSON, HTML). Smaller zlib windows keep per-response memory low.
app.use(require('./static-gz')(path.join(cfg.ROOT, 'public')));
app.use(require('compression')({ threshold: 1024, memLevel: 7, windowBits: 14 }));
const V7A = require('./admin-v7'); app.use(V7A.bigJson); // v7 admin: larger JSON bodies only for signed-in builder/settings/import routes
// v7: score submissions carry the L3 event log / L4 input log (up to ~60 KB); everything else stays at 32 KB
const captureStripeBody = (req, res, buf) => { if (String(req.originalUrl || '').split('?')[0] === '/api/store/webhook/stripe') req.rawBody = Buffer.from(buf); };
const jsonSmall = express.json({ limit: '32kb', verify: captureStripeBody }), jsonScore = express.json({ limit: '96kb', verify: captureStripeBody });
app.use((req, res, next) => (req.path === '/api/score' ? jsonScore : jsonSmall)(req, res, next));
app.use(V7A.early); // v7 admin: player sign-in/device history + maintenance mode


// Health check for hosting platforms (Render healthCheckPath, Docker HEALTHCHECK)
app.get('/healthz', (req, res) => { try { db.prepare('SELECT 1').get(); res.json({ ok: true, product: 'The Gaming Hub', version: HUB_VERSION }); } catch (e) { res.status(500).json({ ok: false, version: HUB_VERSION }); } });
app.get('/api/build', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.json({ ok: true, product: 'The Gaming Hub by Trap Tech Solutions', version: HUB_VERSION, build_fingerprint: BUILD_FINGERPRINT, games_library: libraryGames().length, games_library_playable: libraryGames().filter(g => g.playable !== false && !g.retired).length, games_library_archived: libraryGames().filter(g => g.retired).length, core_games: cfg.GAMES.filter(g => !new Set(['plinko', 'spin-to-win', 'blazed-roulette']).has(g.id)).length, scoring: 'shared signed-run API' }); });
// Read-only release audit endpoint. The report is generated during the image build and copied into BUILD_DIR.
// It contains structural findings only (no account records, secrets, or runtime database data).
app.get('/api/audit/report', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const auditPath = path.join(process.env.BUILD_DIR || path.join(__dirname, '..', 'build'), 'audit', 'prelaunch-structural-audit.json');
  try {
    const report = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    res.json({ ok: true, report });
  } catch (err) {
    res.status(503).json({ ok: false, error: 'Release audit report is not available in this build.' });
  }
});

// Read-only, source-level per-game audit; does not grant AAA approval.
app.get('/api/audit/game-source', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const file=path.join(process.env.BUILD_DIR || path.join(__dirname,'..','build'),'audit','game-source-mechanics.json');
  try { res.json({ok:true,report:JSON.parse(fs.readFileSync(file,'utf8'))}); }
  catch { res.status(503).json({ok:false,error:'Game source audit unavailable in this build.'}); }
});
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
function clientIp(req) {
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();
  // Only honor Cloudflare's client-IP header when the operator explicitly confirms that direct origin access is blocked.
  if (proxyHops > 0 && process.env.TRUST_CF_IP === '1' && require('net').isIP(cf)) return cf;
  return String(req.ip || req.socket && req.socket.remoteAddress || '').trim();
}
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

// Simple in-memory sliding-window rate limiter. Bounded: least-recently-used keys are evicted past RATE_LIMIT_MAX_KEYS
// (Map keeps insertion order, so delete + set moves a key to the end).
const buckets = new Map(); const MAX_BUCKETS = Math.max(1000, parseInt(process.env.RATE_LIMIT_MAX_KEYS || '20000', 10) || 20000);
function rateLimit(key, limit, windowMs) {
  const t = now(); const arr = (buckets.get(key) || []).filter(x => t - x < windowMs);
  buckets.delete(key);
  if (arr.length >= limit) { buckets.set(key, arr); return false; }
  arr.push(t); buckets.set(key, arr);
  if (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value);
  return true;
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
  // Legacy unversioned signatures are rejected after migration. Possession
  // of a previously issued, copied X-Session header is not sufficient once
  // its account has signed out, changed password or been reset by an admin.
  if (!tok || !Number.isSafeInteger(tok.u) || !Number.isSafeInteger(tok.v) ||
      !Number.isFinite(tok.e) || tok.e <= now()) return null;
  const u = db.prepare('SELECT id, username, created_at, banned, is_demo, session_version, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect FROM users WHERE id=?').get(tok.u);
  if (!u || u.banned || tok.v !== u.session_version) return null;
  return u;
}
function startSession(req, res, user) {
  const current = db.prepare('SELECT session_version,banned FROM users WHERE id=?').get(user.id);
  if (!current || current.banned) throw new Error('Cannot issue session to inactive account');
  const t = sign(cfg.SESSION_SECRET, { u: user.id, v: current.session_version,
    e: now() + cfg.SESSION_TTL_MS });
  setCookie(req, res, 'gh_sess', t, cfg.SESSION_TTL_MS);
  db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), user.id);
  return t;
}
const requireUser = (req, res, next) => { const u = currentUser(req); if (!u) return bad(res, 401, 'Please sign in first.'); req.user = u; next(); };
// v7: admin lives at a secret path with password + authenticator (TOTP), lockouts, CSRF and an audit log (src/admin-sec.js)
const ADMSEC = require('./admin-sec');
const EV = require('./events'); // v7 official events vs free play
const requireAdmin = ADMSEC.requireAdmin;

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,20}$/;

app.post('/api/auth/signup', limiter('signup', 10, 3600e3), (req, res) => {
  const username = str(req.body.username, 40); const password = String(req.body.password || '');
  if (!USERNAME_RE.test(username)) return bad(res, 400, 'Username must be 3-20 characters: letters, numbers, _ . - (no spaces).');
  { const pf = require('./profanity').check(username); if (!pf.ok) return bad(res, 400, pf.reason); }
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
  const potato = str(req.body.potato, 40).replace(/^@/, '') || (/^[A-Za-z0-9_]{3,32}$/.test(username) ? username : '');
  if (potato && !/^[A-Za-z0-9_]{3,32}$/.test(potato)) return bad(res, 400, 'Potato usernames use letters, numbers and _ (3-32 characters).');
  const info = db.prepare('INSERT INTO users (username, pass_hash, created_at, last_seen, birth_date, referred_by, potato) VALUES (?,?,?,?,?,?,?)').run(username, hash, now(), now(), dob, referrer ? referrer.id : null, potato);
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

app.post('/api/auth/signout', (req, res) => {
  const active = currentUser(req);
  if (active) db.prepare('UPDATE users SET session_version=session_version+1 WHERE id=?')
    .run(active.id);
  // Current implementation deliberately revokes all sessions for an account;
  // a future per-device session registry may implement selective device logout.
  setCookie(req, res, 'gh_sess', '', 0);
  res.json({ ok:true, all_devices_signed_out:!!active });
});

app.post('/api/auth/password', requireUser, limiter('pw', 10, 3600e3), (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!bcrypt.compareSync(String(req.body.current || ''), u.pass_hash)) return bad(res, 401, 'Current password is wrong.');
  const np = String(req.body.password || '');
  if (np.length < 8) return bad(res, 400, 'New password must be at least 8 characters.');
  db.prepare('UPDATE users SET pass_hash=?, session_version=session_version+1 WHERE id=?')
    .run(bcrypt.hashSync(np, 10), u.id);
  setCookie(req, res, 'gh_sess', '', 0);
  res.json({ ok: true });
});

// v8: browsers always probe /favicon.ico; answer with the brand icon so no game page logs a 404.
app.get('/favicon.ico', (req, res) => res.redirect(301, '/assets/brand/favicon.png?v=tt-crown-20261014'));

app.get('/api/me', (req, res) => {
  const u = currentUser(req);
  res.json({ ok: true, user: u ? { username: u.username, created_at: u.created_at, cos: ach.publicCos(u), potato: db.prepare('SELECT potato FROM users WHERE id=?').get(u.id).potato, ...H.meExtras(u), ...(H.meV5 ? H.meV5(u) : {}) } : null, now: now(), version: HUB_VERSION });
});

// ---------- games & leaderboards ----------
app.get('/api/games', (req, res) => {
  const games = cfg.GAMES.map(g => ({ ...g }));
  const curated = games.filter(g => g.featured === true || g.home_featured === true);
  const pool = curated.length ? curated : games;
  const slot = pool.length ? Math.floor(now() / (7 * 864e5)) % pool.length : 0;
  const ordered = pool.slice(slot).concat(pool.slice(0, slot));
  const featured = new Set(ordered.slice(0, 4).map(g => g.id));
  res.json({ ok: true, games: games.map(g => ({ ...g, home_featured: featured.has(g.id) })) });
});

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
  else if (resolveGame(game)) rows = ranked(gameBoard(game, periodStart(period)));
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
const publicRow = (r) => ({ rank: r.rank, username: r.username, score: r.score, runs: r.runs, last_at: r.last_at, demo: !!r.is_demo, cos: ach.publicCos(r), ...(r.tiebreak !== undefined ? { tiebreak: r.tiebreak || null, exact_tie: !!r.exact_tie } : {}) });

// ---------- runs / anti-cheat ----------
app.post('/api/run/start', requireUser, (req, res) => {
  const gameId = String(req.body.game_id || 'jetpack-dash');
  const game = resolveGame(gameId);
  if (!game || !game.playable) return bad(res, 400, 'That game is not playable yet.');
  if (!rateLimit(`start-u:${req.user.id}`, 20, 60e3) || !rateLimit(`start-ip:${ipHash(req)}`, 40, 60e3)) return bad(res, 429, 'Too many runs started, wait a moment.');
  const rid = crypto.randomBytes(16).toString('hex');
  const t = now();
  const PO = req.body.playoff ? require('./games-lib-playoff').checkStart(req.user, gameId, req.body.playoff) : null; if (PO && !PO.ok) return bad(res, PO.status, PO.error); // [games-lib hook] playoff run = shared seed, one start
  const seed = PO ? PO.seed : AC.newSeed();
  // v7 official events: an event-run token is only issued after the server validates the event (src/events.js)
  const evRef = req.body.event || req.body.event_code || req.body.giveaway_id;
  let ev = null;
  if (evRef != null && evRef !== '') { const c = EV.checkStart(req, req.user, gameId, evRef, t); if (!c.ok) return bad(res, c.status, c.error, { event_rejected: true }); ev = c.g; }
  db.prepare('INSERT INTO run_tokens (rid,user_id,game_id,started_at,ip_hash,seed,event_id,sess_hash) VALUES (?,?,?,?,?,?,?,?)').run(rid, req.user.id, gameId, t, ipHash(req), seed, ev ? ev.id : null, ev ? EV.sessHash(req) : '');
  if (PO) PO.bind(rid); // [games-lib hook]
  res.json({ ok: true, token: sign(cfg.RUN_SECRET, ev ? { rid, u: req.user.id, g: gameId, t, e: ev.id } : { rid, u: req.user.id, g: gameId, t }), started_at: t, seed,
    event: ev ? { id: ev.id, code: ev.event_code, label: EV.label(ev), expires_at: t + EV.EVENT_TOKEN_TTL_MS } : null });
});

app.post('/api/score', requireUser, (req, res) => {
  if (!rateLimit(`score-ip:${ipHash(req)}`, 30, 60e3) || !rateLimit(`score-u:${req.user.id}`, 40, 60e3)) return bad(res, 429, 'Too many score submissions.'); // L2 submit frequency (hard)
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
  if ((tok.e || null) !== (row.event_id || null)) return reject(400, 'Event run token does not match this run.');
  const evOrig = row.event_id || null;
  { const ec = EV.checkSubmit(req, req.user, row, tok, t); if (ec && ec.demote) row.event_id = null; else if (ec) return reject(ec.status, ec.error); }
  const game = resolveGame(row.game_id); if (!game || !game.playable) return reject(400, 'This game is no longer available for scoring.'); const ac = game.ac; const unit = game.unit === 'm' ? 'm' : ' ' + game.unit;
  const score = Number(req.body.score); const coins = Number(req.body.coins || 0);
  if (!Number.isInteger(score) || score < 0 || score > cfg.MAX_SCORE) return reject(400, 'Invalid score value.');
  if (!Number.isInteger(coins) || coins < 0 || coins > 1_000_000) return reject(400, 'Invalid coin value.');
  // per-game plausibility caps against SERVER-measured elapsed time (see config.js GAMES[].ac)
  const elapsedS = (t - row.started_at) / 1000;
  const rawDur = Math.round(Number(req.body.duration_ms) || 0);
  const durationMs = Math.max(0, Math.min(rawDur, t - row.started_at + 5000));
  // v5 anti-cheat (src/anticheat.js): only physically impossible runs are rejected; suspicious ones are kept + flagged
  const tel = req.body.tel && typeof req.body.tel === 'object' ? req.body.tel : null;
  const verdict = require('./prize-score-proof').admit(row.event_id, row.game_id, AC.assess({ userId: req.user.id, game: { ...game, id: row.game_id }, score, elapsedS, durationMs: rawDur, tel, seed: row.seed, log: Array.isArray(req.body.log) ? req.body.log : null, ev: req.body.ev && typeof req.body.ev === 'object' ? req.body.ev : null,
    recent: db.prepare('SELECT COUNT(*) c FROM runs WHERE user_id=? AND created_at>?').get(req.user.id, t - 60e3).c }));
  if (verdict.reject && verdict.why) return reject(422, verdict.why);
  if (verdict.reject) return reject(422, `Score rejected: ${score}${unit} in ${elapsedS.toFixed(1)}s is not possible in ${game.title} (max ${verdict.cap}${unit}).`);
  if (coins > 2 * ac.coinsPerSec * elapsedS + 20) return reject(422, 'Coin count rejected as implausible.');

  // single-use: atomically claim the token
  const claim = db.prepare("UPDATE run_tokens SET used_at=?, status='accepted' WHERE rid=? AND used_at IS NULL").run(t, row.rid);
  if (claim.changes !== 1) return bad(res, 409, 'This run was already submitted.', { rejected: true });

  const prevBest = db.prepare('SELECT MAX(score) AS b FROM runs WHERE user_id=? AND game_id=?').get(req.user.id, row.game_id).b;
  const levelBefore = H.levelOf(req.user.id);
  const gwsAll = row.event_id ? activeGiveawaysFor(row.game_id, t).filter(g => g.id === row.event_id && row.started_at >= g.start_at) : []; // v7: free-play runs never enter giveaways
  const joinedQ = db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id=? AND user_id=? AND left_at IS NULL');
  const gws = gwsAll.filter(g => !g.require_join || joinedQ.get(g.id, req.user.id));
  // v5 anti-camping: giveaways this game feeds that the player has not entered yet (runs only count after "Enter giveaway")
  const joinToCount = gwsAll.filter(g => g.require_join && !gws.includes(g)).map(g => ({ id: g.id, title: g.title }));
  const newEntries = [];
  for (const g of gws) {
    if (verdict.held || score < (g.min_score || 0)) continue;
    const games = giveawayGameIds(g.id); const ph = games.map(() => '?').join(',');
    const had = db.prepare(`SELECT 1 FROM runs WHERE event_id=${+g.id} AND user_id=? AND game_id IN (${ph}) AND held=0 AND verify='replay-ok' AND ${require('./prize-score-proof').sqlCertified('runs')} AND started_at>=? AND created_at<=? AND score>=? LIMIT 1`).get(req.user.id, ...games, g.start_at, g.end_at, g.min_score || 0);
    if (!had) newEntries.push(g);
  }
  const info = db.prepare('INSERT INTO runs (user_id,game_id,score,coins,duration_ms,started_at,created_at,ip_hash,ua_hash,seed,verify,held,event_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(req.user.id, row.game_id, score, coins, durationMs, row.started_at, t, ipHash(req), uaHash(req), row.seed || '', verdict.verify || '', verdict.held || 0, row.event_id || null);
  AC.record(info.lastInsertRowid, req.user.id, row.game_id, score, verdict, t);
  require('./games-lib-playoff').record(info.lastInsertRowid, req.user.id, row.game_id, score, row.started_at, t, req.body.ev, row.rid); // [games-lib hook] server-derived skill tie-break metrics
  for (const g of newEntries) logActivity('entry', `${req.user.username} entered "${g.title}"`, req.user.id, g.id);
  const isBest = prevBest === null || prevBest === undefined || score > prevBest;
  if (isBest && !verdict.held && score >= (game.tiers ? game.tiers[0] : 100)) logActivity('highscore', `New high score (${game.title}): ${req.user.username} - ${score.toLocaleString('en-US')}${unit}`, req.user.id, info.lastInsertRowid);

  const board = gameBoard(row.game_id);
  const rank = board.findIndex(r => r.user_id === req.user.id) + 1;
  const counted = gws.map(g => {
    const entrants = giveawayEntrants(g); const me = entrants.find(e => e.user_id === req.user.id);
    return { id: g.id, title: g.title, rank: me ? me.rank : null, entrants: entrants.length, min_score: g.min_score || 0, qualified: !verdict.held && verdict.verify === 'replay-ok' && score >= (g.min_score || 0) };
  });
  // explicit giveaway param (legacy "contest") => tell the client if it ended
  let giveawayStatusOut = null;
  const gid = req.body.giveaway_id || req.body.contest;
  if (gid) {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(gid);
    giveawayStatusOut = !g ? 'not_found' : String(evOrig || '') !== String(g.id) ? 'not_event_run' : (t > g.end_at ? 'ended_not_counted' : t < g.start_at ? 'not_started_not_counted' : !g.active ? 'inactive'
      : !giveawayGameIds(g.id).includes(row.game_id) ? 'game_not_linked' : score < (g.min_score || 0) ? 'below_min_score' : verdict.held ? 'held_pending_independent_replay' : 'counted');
  }
  // achievements are evaluated here, on the server, from the stored runs
  const unlocked = ach.evaluate(req.user.id, { games: [row.game_id] }).fresh;
  for (const a of unlocked) if (['gold', 'epic', 'legendary'].includes(a.tier) && !a.hidden) logActivity('achievement', `${req.user.username} unlocked "${a.name}"`, req.user.id);
  const extra = H.afterRun(req.user, levelBefore);
  if (H.settleChallenges) H.settleChallenges(req.user.id);
  const first = board[0]; const toFirst = first && first.user_id !== req.user.id ? first.score - Math.max(score, prevBest || 0) + 1 : 0;
  let points = null; try { const before = require('./shop').balance(req.user.id); const after = require('./shop').sync(req.user.id); points = { balance: after, gained: after - before }; } catch (e) { console.error('points sync', e.message); }
  res.json({ ok: true, held: !!verdict.held, verified: verdict.verify === 'replay-ok', held_reason: verdict.held ? (verdict.prizeProofHeld ? 'Run saved but this game is not independently certified for official prize scoring. It cannot change giveaway winners. Keep playing free mode.' : 'Suspicious run held for fair-play review; no giveaway eligibility is granted without independent approved replay.') : null,
    to_first: toFirst > 0 ? toFirst : 0, is_first: !!(first && first.user_id === req.user.id), points, run_id: info.lastInsertRowid, share_url: `/s/${info.lastInsertRowid}`, level: extra.level, level_up: extra.level_up || null, xp_gained: extra.level.xp - levelBefore.xp, game_id: row.game_id, score, coins, personal_best: isBest, best: Math.max(score, prevBest || 0), rank, players: board.length, giveaways: counted, join_to_count: joinToCount, giveaway_status: giveawayStatusOut, unlocked });
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
    entrants_hash: g.entrants_hash || null, tiebreak_rules: R.TIEBREAK_RULES,
    event_code: g.event_code || null, event_label: g.event_code ? EV.label(g) : null,
    linked_requirements: require('./giveaway-linked').publicView(g.linked_requirements), official: true };
  if (H.v5Giveaway) Object.assign(out, H.v5Giveaway(g));
  if (H.v7Giveaway) H.v7Giveaway(g, out); // v7 builder: subtitle, description, banner, prizes, hidden board, official rules
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
  let list = all.filter(g => !g.booking_id || ['active','scheduled'].includes(EV.status(g)))
    .map(g => giveawayPublic(R.ready(g)));
  if (['active', 'upcoming', 'past'].includes(status)) list = list.filter(g => g.status === status);
  list.sort((a, b) => a.status === 'past' ? b.end_at - a.end_at : (b.featured - a.featured) || (a.end_at - b.end_at));
  res.json({ ok: true, giveaways: list, now: now() });
});
app.get('/api/giveaways/:id', (req, res) => {
  const g = R.ready(db.prepare('SELECT * FROM giveaways WHERE id=? AND active=1').get(req.params.id));
  if (!g || (g.booking_id && !['active','scheduled'].includes(EV.status(g)))) return bad(res, 404, 'Giveaway not found');
  const entrants = giveawayEntrants(g); const me = currentUser(req);
  const mine = me ? entrants.find(e => e.user_id === me.id) : null;
  const hidden = H.v7Hidden && H.v7Hidden(g); // v7: leaderboard hidden until the end
  res.json({ ok: true, giveaway: giveawayPublic(g), leaderboard: hidden ? [] : entrants.slice(0, 25).map(publicRow), me: mine && !hidden ? publicRow(mine) : null, now: now() });
});

// ---------- profiles ----------
function profileFor(user) {
  const bests = db.prepare('SELECT game_id, MAX(score) AS best, COUNT(*) AS n, SUM(coins) AS coins FROM runs WHERE user_id=? GROUP BY game_id').all(user.id);
  const total = bests.reduce((s, b) => s + b.best, 0);
  const plays = bests.reduce((s, b) => s + b.n, 0);
  const coins = bests.reduce((s, b) => s + (b.coins || 0), 0);
  const wins = db.prepare('SELECT COUNT(*) AS c FROM winners WHERE user_id=?').get(user.id).c;
  const recent = db.prepare('SELECT game_id, score, coins, created_at FROM runs WHERE user_id=? ORDER BY created_at DESC LIMIT 10').all(user.id)
    .map(r => ({ ...r, game_title: cfg.gameInfo(r.game_id)?.title || r.game_id, unit: cfg.gameInfo(r.game_id)?.unit || 'pts' }));
  const gb = globalBoard(0); const grank = gb.findIndex(r => r.user_id === user.id) + 1;
  const entries = db.prepare(`SELECT COUNT(DISTINCT g.id) AS c FROM giveaways g JOIN giveaway_games gg ON gg.giveaway_id=g.id JOIN runs r ON r.game_id=gg.game_id AND r.user_id=? AND r.started_at>=g.start_at AND r.created_at<=g.end_at AND r.created_at>=g.start_at AND r.score>=g.min_score`).get(user.id).c;
  const unl = ach.unlockedMap(user.id);
  const achievements = [...unl.entries()].sort((a, b) => b[1] - a[1]).map(([id, at]) => { const a = ach.BY_ID[id]; return a && { ...ach.publicAch(a, true), unlocked_at: at }; }).filter(Boolean);
  return { username: user.username, member_since: user.created_at, demo: !!user.is_demo, total_score: total, games_played: plays, coins,
    giveaways_won: wins, giveaways_entered: entries, global_rank: grank || null,
    best_by_game: bests.map(b => ({ game_id: b.game_id, game_title: cfg.gameInfo(b.game_id)?.title || b.game_id, best: b.best, plays: b.n })),
    cos: ach.publicCos(user), achievements, achievements_total: ach.ACHIEVEMENTS.length, recent };
}
app.get('/api/profile/:username', (req, res) => {
  const u = db.prepare('SELECT id, username, created_at, is_demo, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect FROM users WHERE username=? AND banned=0').get(String(req.params.username));
  if (!u) return bad(res, 404, 'Player not found');
  const me = currentUser(req);
  // catch up on achievements that depend on things other people did (giveaway draws, leaderboard moves)
  const unlocked = me && me.id === u.id ? ach.evaluate(u.id).fresh : [];
  res.json({ ok: true, profile: { ...profileFor(u), ...H.profileExtras(u, me) }, is_me: !!(me && me.id === u.id), unlocked, version: HUB_VERSION });
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
  const unl = ach.unlockedMap(user.id); const own = ach.ownedAll(user.id, unl);
  const source = {}; for (const a of ach.ACHIEVEMENTS) for (const r of a.rewards) source[`${r.type}:${r.id}`] = a;
  const SH = require('./shop');
  const item = (type, x) => { const a = source[`${type}:${x.id}`]; const owned = own[type].has(x.id);
    return { id: x.id, name: x.name, owned, from: a ? (a.hidden && !unl.has(a.id) ? 'Secret achievement' : a.name) : x.id === 'staff-glow' ? 'Staff only' : 'Free', default: COS.DEFAULTS[type] === x.id, ...(type === 'frame' ? { anim: x.anim } : {}) }; };
  const shopItem = (it) => ({ id: it.id, name: it.name, owned: own[it.type].has(it.id), from: 'Points Shop', rarity: it.rarity, ...(it.type === 'frame' ? { anim: it.extra.split('|')[1] } : {}) });
  const shopOf = (type) => SH.listFor(own[type], type).map(shopItem); // v7: owned + on-sale items (the generated catalog is endless)
  const grants = ach.grantsOf(user.id);
  return {
    banners: [...COS.BANNERS.map(b => item('banner', b)), ...shopOf('banner')], frames: [...COS.FRAMES.map(f => item('frame', f)), ...shopOf('frame')], titles: [...COS.TITLES.map(t => item('title', t)), ...shopOf('title')],
    colors: shopOf('color'), effects: shopOf('effect'),
    badges: [...grants.map(g => { const b = ach.ADMIN_BY[g.badge_id]; return { id: 'adm:' + b.id, name: b.name, icon: b.icon, tier: 'admin', owned: true }; }),
      ...ach.ACHIEVEMENTS.filter(a => unl.has(a.id)).map(a => ({ id: a.id, name: a.name, icon: a.icon, tier: a.tier, owned: true })),
      ...SH.listFor(own.badge, 'badge').filter(i => own.badge.has('shop:' + i.id)).map(i => ({ id: 'shop:' + i.id, name: i.name, icon: i.extra, tier: i.rarity, owned: true }))],
    equipped: { banner: user.eq_banner || COS.DEFAULTS.banner, frame: user.eq_frame || 'none', title: user.eq_title || COS.DEFAULTS.title, badge: user.eq_badge || '', color: user.eq_color || '', effect: user.eq_effect || '' },
    owned_count: ach.ownedCount(own) + own.color.size + own.effect.size, badge_count: own.badge.size,
    totals: { banners: COS.BANNERS.length + shopOf('banner').length, frames: COS.FRAMES.length + shopOf('frame').length, titles: COS.TITLES.length + shopOf('title').length, badges: ach.ACHIEVEMENTS.length },
  };
}
app.get('/api/cosmetics', requireUser, (req, res) => res.json({ ok: true, ...cosmeticsFor(req.user), cos: ach.publicCos(req.user) }));
app.post('/api/me/cosmetics', requireUser, limiter('equip', 60, 60e3), (req, res) => {
  const own = ach.ownedAll(req.user.id);
  const upd = {};
  for (const [k, col] of [['banner', 'eq_banner'], ['frame', 'eq_frame'], ['title', 'eq_title'], ['badge', 'eq_badge'], ['color', 'eq_color'], ['effect', 'eq_effect']]) {
    if (req.body[k] === undefined) continue;
    const v = String(req.body[k] || '');
    if ((k === 'badge' || k === 'color' || k === 'effect') && v === '') { upd[col] = ''; continue; }
    if (!own[k].has(v)) return bad(res, 403, `You haven't unlocked that ${k} yet.`);
    upd[col] = v;
  }
  if (!Object.keys(upd).length) return bad(res, 400, 'Nothing to equip.');
  db.prepare(`UPDATE users SET ${Object.keys(upd).map(c => `${c}=@${c}`).join(', ')} WHERE id=@id`).run({ ...upd, id: req.user.id });
  const unlocked = ach.evaluate(req.user.id, { games: [] }).fresh;
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  res.json({ ok: true, cos: ach.publicCos(u), unlocked });
});
// v7: rebuilt when the shop's live set of generated items changes (new day / new purchases); see src/shop.js css()
let COS_CSS = { k: '', css: '' }; const cosCss = () => { const k = require('./shop').cssKey(); if (COS_CSS.k !== k) COS_CSS = { k, css: COS.css() }; return COS_CSS.css; };
app.get('/cosmetics-mine.css', (req, res) => { res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.setHeader('Cache-Control', 'private, no-store'); const u = currentUser(req); res.send(u ? require('./shop').cssMine(u.id) : ''); });
app.get('/cosmetics.css', (req, res) => { res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.setHeader('Cache-Control', 'public, max-age=600'); res.send(cosCss()); });

// ---------- community ----------
const userCos = (id) => { const u = id && db.prepare('SELECT username, is_demo, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect FROM users WHERE id=?').get(id); return u ? { username: u.username, demo: !!u.is_demo, cos: ach.publicCos(u) } : null; };
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

// ---------- Official giveaway booking (feature picker + quotes) lives in src/sponsor.js; legacy /api/bookings remains an alias ----------
app.get('/api/business-types', (req, res) => res.json({ ok: true, types: PK.BUSINESS_TYPES, cannabis: PK.CANNABIS_TYPE }));

// ---------- admin ----------
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
    channel_id: parseInt(b.channel_id, 10) || null, link_url: str(b.link_url, 300), link_label: str(b.link_label, 40),
    ...require('./eligibility').read(b),
  };
  // v7 brands + placements: a giveaway with a brand is members-only unless "open to everyone"; no brand = hub-wide
  g.open_to_all = !g.channel_id ? 1 : b.open_to_all ? 1 : 0;
  if (g.channel_id && !g.open_to_all) g.require_join = 1;
  g.placements = Array.isArray(b.placements) ? JSON.stringify(b.placements.filter(x => require('./sponsor').PLACES.includes(x))) : (typeof b.placements === 'string' && b.placements.startsWith('[') ? b.placements : null);
  if (g.link_url && !/^https:\/\/[^\s"'<>]{4,300}$/.test(g.link_url)) return [null, 'Sponsor link must be an https:// URL.'];
  if (g.channel_id && !db.prepare('SELECT 1 FROM channels WHERE id=?').get(g.channel_id)) return [null, 'Unknown channel.'];
  if (!g.title) return [null, 'Title is required.'];
  if (!Number.isFinite(g.start_at) || !Number.isFinite(g.end_at)) return [null, 'Start and end date/time are required.'];
  if (g.end_at <= g.start_at) return [null, 'End time must be after start time.'];
  if (!gameIds.length) return [null, 'Pick at least one game.'];
  for (const id of gameIds) if (!cfg.GAME_MAP[id]) return [null, `Unknown linked game: ${id}`];
  for (const id of gameIds) if (!cfg.giveawayEligible(id)) return [null, `${cfg.GAME_MAP[id].title} is a just-for-fun chance game, so it can't count for a giveaway.`];
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
const GW_COLS = 'title,host,prize,image,start_at,end_at,entry_method,game_id,rules,active,tier,brand_color,brand_logo,featured,min_score,prize_tiers,win_method,winner_count,channel_id,link_url,link_label,open_to_all,placements,' + require('./eligibility').FIELDS.join(',');
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
  res.json({ ok: true, giveaway: { ...giveawayPublic(g), active: !!g.active, prize_tiers_raw: g.prize_tiers || '', winner_count_raw: g.winner_count || 0, ...require('./eligibility').rulesOf(g), require_join: g.require_join || 0, channel_id: g.channel_id || null, link_url: g.link_url || '', link_label: g.link_label || '' }, entrants: entrants.map(publicRow), stats: boards.giveawayStats(g), now: now() });
});
A.put('/giveaways/:id', (req, res) => {
  const ex = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!ex) return bad(res, 404, 'Not found');
  const [g, err, gameIds] = readGiveaway(req.body || {}); if (err) return bad(res, 400, err);
  if ((req.body || {}).placements === undefined) g.placements = ex.placements; // forms that don't edit placements keep them
  if ((req.body || {}).open_to_all === undefined && g.channel_id && g.channel_id === ex.channel_id) { g.open_to_all = ex.open_to_all ? 1 : 0; if (!g.open_to_all) g.require_join = 1; }
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
  if (req.body.linked && !cfg.giveawayEligible(gameId)) return bad(res, 400, `${cfg.GAME_MAP[gameId].title} is a just-for-fun chance game, so it can't be linked to a giveaway.`);
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
  const r = db.prepare('UPDATE users SET pass_hash=?, session_version=session_version+1 WHERE id=?')
    .run(bcrypt.hashSync(tmp, 10), req.params.id);
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

// CSV exports (streamed: rows are written in ~64 KB chunks with backpressure, never joined into one big string)
const csvEsc = (v) => { let s = v === null || v === undefined ? '' : String(v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const csvLine = (r, cols) => cols.map(c => csvEsc(r[c])).join(',') + '\r\n';
function csv(rows, cols) { return cols.join(',') + '\r\n' + rows.map(r => csvLine(r, cols)).join(''); }
const iso = (ms) => ms ? new Date(ms).toISOString() : '';
function csvStart(res, name) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
  let buf = ''; let closed = false; res.on('close', () => { closed = true; });
  const flush = () => new Promise(r => {
    if (closed || res.write(buf)) { buf = ''; return r(); }
    buf = ''; const done = () => { res.off('drain', done); res.off('close', done); r(); }; res.on('drain', done); res.on('close', done);
  });
  return { async add(line) { buf += line; if (buf.length >= 65536) await flush(); }, async end() { if (buf) res.write(buf); res.end(); }, get closed() { return closed; } };
}
// rows: an array (already computed in memory)
function sendCsv(res, name, rows, cols) {
  return (async () => {
    const w = csvStart(res, name); await w.add(cols.join(',') + '\r\n');
    for (let i = 0; i < rows.length && !w.closed; i++) await w.add(csvLine(rows[i], cols));
    await w.end();
  })().catch(e => { console.error('csv export', e); res.destroy(); });
}
// page(after) -> up to N rows ordered by the paging key; key(row) gives the cursor for the next page.
// Each page is a short synchronous query, so the SQLite connection is never held across an await.
async function sendCsvPaged(res, name, cols, page, map) {
  const w = csvStart(res, name); await w.add(cols.join(',') + '\r\n');
  let after = null;
  for (;;) {
    const rows = page(after); if (!rows.length || w.closed) break;
    for (const r of rows) await w.add(csvLine(map ? map(r) : r, cols));
    after = rows[rows.length - 1];
  }
  await w.end();
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
const RUNS_PAGE = 'SELECT r.id, u.username, r.game_id, r.score, r.coins, r.duration_ms, r.started_at, r.created_at, r.ip_hash, r.is_demo FROM runs r JOIN users u ON u.id=r.user_id';
const runsFirst = db.prepare(`${RUNS_PAGE} ORDER BY r.created_at DESC, r.id DESC LIMIT 1000`);
const runsNext = db.prepare(`${RUNS_PAGE} WHERE (r.created_at < @c OR (r.created_at = @c AND r.id < @i)) ORDER BY r.created_at DESC, r.id DESC LIMIT 1000`);
A.get('/export/runs.csv', (req, res, next) => {
  sendCsvPaged(res, 'runs.csv', ['id', 'username', 'game_id', 'score', 'coins', 'duration_ms', 'started_at', 'created_at', 'ip_hash', 'is_demo'],
    (a) => a ? runsNext.all({ c: a.created_at, i: a.id }) : runsFirst.all(), (r) => ({ ...r, started_at: iso(r.started_at), created_at: iso(r.created_at) })).catch(next);
});
const playersPage = db.prepare('SELECT u.id, u.username, u.created_at, u.last_seen, u.banned, u.is_demo, (SELECT COUNT(*) FROM runs r WHERE r.user_id=u.id) AS runs, (SELECT MAX(score) FROM runs r WHERE r.user_id=u.id) AS best FROM users u WHERE u.id > ? ORDER BY u.id LIMIT 1000');
A.get('/export/players.csv', (req, res, next) => {
  sendCsvPaged(res, 'players.csv', ['id', 'username', 'created_at', 'last_seen', 'runs', 'best', 'banned', 'is_demo'],
    (a) => playersPage.all(a ? a.id : -1), (r) => ({ ...r, created_at: iso(r.created_at), last_seen: iso(r.last_seen) })).catch(next);
});
A.get('/export/bookings.csv', (req, res) => {
  const rows = db.prepare('SELECT * FROM bookings ORDER BY created_at DESC').all().map(r => ({ ...r, created_at: iso(r.created_at) }));
  sendCsv(res, 'bookings.csv', rows, ['id', 'brand', 'business_type', 'licensed_confirmed', 'contact_name', 'email', 'potato', 'contact', 'event_type', 'package', 'package_snapshot', 'addons', 'start_date', 'end_date', 'details', 'status', 'admin_note', 'created_at', 'is_demo']);
});

// v7: the public package/tier editor is replaced by the admin-only sponsor price sheet (/sponsor/prices in src/sponsor.js)
A.get('/achievements', (req, res) => {
  const rr = ach.rarity();
  res.json({ ok: true, players: rr.total, unlocks: db.prepare('SELECT COUNT(*) AS c FROM user_achievements').get().c,
    achievements: ach.ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, cat: a.cat, tier: a.tier, hidden: a.hidden, pct: rr.pct(a.id) })) });
});

// ---------- backups (SQLite online backup -> gzip -> $DATA_DIR/backups, optional push to a private GitHub branch) ----------
const BK = require('./backup');
A.get('/backups', (req, res) => res.json({ ok: true, ...BK.info(), og_cache: require('./og').stats() }));
A.post('/backups', async (req, res, next) => { try { const r = await BK.run('manual'); const { github: push, ...rest } = r; res.status(r.ok ? 200 : 500).json({ ...BK.info(), ...rest, ok: r.ok, push: push || null }); } catch (e) { next(e); } });
// "Download backup": makes a fresh snapshot (also kept in the local rotation) and streams the .db.gz
A.get('/backups/download', async (req, res, next) => {
  try {
    let name = req.query.name ? String(req.query.name) : null;
    if (!name) { const r = await BK.run('download', { push: false }); if (!r.ok) return bad(res, 500, r.error || 'Backup failed'); name = r.name; }
    const f = BK.fileOf(name); if (!f || !fs.existsSync(f)) return bad(res, 404, 'Backup not found');
    res.setHeader('Cache-Control', 'no-store'); res.download(f, name);
  } catch (e) { next(e); }
});

// ---------- v3 routes (streaks, quests, seasons, tournaments, follows, notifications, referrals, sharing, search) ----------
Object.assign(H, { requireUser, currentUser, publicRow });
V7A.routes(app, A, H); // v7 admin overhaul: giveaway builder, players, live ops, roles (src/admin-v7.js)
require('./v3')(app, A, H);
Object.assign(H, { csv, sendCsv, sendCsvPaged, iso, giveawayPublic, ipHash });
require('./v4')(app, A, H);
require('./sponsor')(app, A, H); // v7 official giveaway booking: feature picker, admin price sheet, quotes
require('./brands').routes(app, A, H); // v7 brand affiliation (invite links, one brand per player)
require('./v5')(app, A, H);
require('./v5b')(app, A, H);
require('./v8')(app, A, H); // v8 systems: skill quests + achievements at scale, brand pages, privacy tools
require('./events').routes(app, A, H); // v7 official events (event codes, event-run tokens, event boards, vendor QR)
require('./monetize').routes(app, A, H); // v7 cosmetic-only store: Hub Crowns, Season Pass, Prestige; Bitcoin checkout (BTC_ADDRESS)
require('./avatars').routes(app, H); // v7 Phase 5 player avatars (GET /avatar/<name>.svg, editor API)
require('./games-v7')(app); // v7: retired-game archive (Stack 2048 -> Stack)

const demo = require('./demo');
try { demo.v5(); } catch (e) { console.error('demo v5 migration failed', e); }
A.post('/demo/seed', (req, res) => res.json({ ok: true, ...demo.seed() }));
A.post('/demo/wipe', (req, res) => res.json({ ok: true, ...demo.wipe() }));
ADMSEC.mount(app, express, A); // secret-path admin (old /admin + /api/admin are plain 404s)

require('./games-lib').mount(app); // [games-lib hook] GET /api/games-lib
require('./games-lib-playoff').mount(app, { requireUser, requireAdmin }); // [games-lib hook] skill tie-breaks + sudden-death playoffs
app.use('/api', (req, res) => bad(res, 404, 'Not found'));

// ---------- static + canonical Trap Tech app icons ----------
const PUB = path.join(cfg.ROOT, 'public');
// Raster icon URLs are generated from the canonical Trap Tech crowned-TT SVG so browsers,
// Android/PWA installs, iOS home-screen shortcuts and legacy PNG references share one mark.
const HUB_ICON_ROUTES = {
  '/assets/icons/icon-192.png': 192,
  '/assets/icons/icon-512.png': 512,
  '/assets/icons/maskable-512.png': 512,
  '/assets/icons/apple-touch-icon.png': 180,
  '/assets/brand/favicon.png': 64
};
const HUB_ICON_CACHE = new Map();
app.get(Object.keys(HUB_ICON_ROUTES), (req, res) => {
  try {
    const size = HUB_ICON_ROUTES[req.path];
    let png = HUB_ICON_CACHE.get(size);
    if (!png) {
      const svg = fs.readFileSync(path.join(PUB, 'assets', 'brand', 'traptech-app-icon.svg'), 'utf8');
      const { Resvg } = require('@resvg/resvg-js');
      png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
      HUB_ICON_CACHE.set(size, png);
    }
    res.status(200).set('Content-Type', 'image/png').set('Cache-Control', 'public, max-age=86400').send(png);
  } catch (err) {
    console.error('Trap Tech app icon render failed:', err);
    res.status(500).type('text').send('App icon unavailable');
  }
});
// Public, read-only release review. Uses the same generated report as /api/audit/report.
app.get(['/audit', '/audit/'], (req, res) => { res.setHeader('Cache-Control','no-store');res.sendFile(path.join(PUB, 'audit', 'index.html')); });
// robots.txt + sitemap.xml: private/account/API paths are not indexed; the sitemap is only published when PUBLIC_URL is configured.
const SITEMAP_PATHS = ['/', '/games', '/leaderboard', '/giveaways', '/tournaments', '/season', '/quests', '/achievements', '/community', '/shop', '/sponsor', '/about', '/terms', '/privacy', '/rules', '/responsible-play'];
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /settings\nDisallow: /notifications\nDisallow: /me/\nDisallow: /friends\nDisallow: /invite\nDisallow: /join/\nDisallow: /signin\nDisallow: /signup\nDisallow: /forgot\n${PU.PUBLIC_URL ? `Sitemap: ${PU.PUBLIC_URL}/sitemap.xml\n` : ''}`));
app.get('/sitemap.xml', (req, res) => { if (!PU.PUBLIC_URL) return res.status(404).type('text').send('Sitemap is published once PUBLIC_URL is set.'); res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${SITEMAP_PATHS.map(x => `<url><loc>${PU.PUBLIC_URL}${x === '/' ? '' : x}</loc></url>`).join('\n')}\n</urlset>\n`); });
app.use(express.static(PUB, { index: false, extensions: ['html'], maxAge: '1h', setHeaders(res, p) { if (p.endsWith('.html')||process.env.HUB_PRIVATE_REVIEW==='1') res.setHeader('Cache-Control', 'no-store'); } }));
// Per-page <title> / description / Open Graph + Twitter card tags for share links (crawlers don't run JS).
const INDEX_FILE = path.join(PUB, 'index.html');
const escA = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PAGE_TITLES = { '/games': 'Games', '/leaderboard': 'Leaderboards', '/giveaways': 'Giveaways', '/tournaments': 'Tournaments', '/season': 'Season Pass', '/quests': 'Daily Quests',
  '/achievements': 'Achievements & Rewards', '/community': 'Community', '/sponsor': 'Book a Giveaway - Trap Tech Solutions', '/about': 'About Trap Tech Solutions',
  '/terms': 'Terms of Service', '/privacy': 'Privacy Policy', '/rules': 'Official Giveaway Rules', '/responsible-play': 'Responsible Play', '/search': 'Search', '/notifications': 'Notifications', '/settings': 'Settings', '/invite': 'Invite Friends', '/channels': 'Brand Channels', '/friends': 'Friends & Challenges', '/shop': 'Hub Credits Shop', '/store': 'Get Hub Credits', '/prestige': 'Prestige Collection' };
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
  res.setHeader('Cache-Control', 'no-store');
  let html = fs.readFileSync(INDEX_FILE, 'utf8');
  const origin = PU.originOf(req); // v7: PUBLIC_URL when set
  const meta = (() => { try { return pageMeta(req.path.replace(/\/+$/, '') || '/', origin); } catch (e) { console.error(e); return null; } })();
  if (PU.PUBLIC_URL) html = html.replace('</head>', `<meta name="public-url" content="${escA(PU.PUBLIC_URL)}"><link rel="canonical" href="${escA(PU.PUBLIC_URL + (req.path.replace(/\/+$/, '') || '/'))}"></head>`);
  if (/^\/(settings|notifications|me|friends|invite|join|signin|signup|forgot|welcome|reset)(\/|$)/.test(req.path)) html = html.replace('</head>', '<meta name="robots" content="noindex,nofollow"></head>');
  if (meta) html = html.replace(/<!--META-->[\s\S]*?<!--\/META-->/, meta);
  else html = html.replace(/(content=")\/og\/default\.png"/g, `$1${origin}/og/default.png"`);
  res.type('html').send(html);
});
const ERR_PAGE = (code, head, msg) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${head} | The Gaming Hub</title><style>html,body{margin:0;height:100%;background:#050714;color:#e8eaff;font-family:system-ui,sans-serif}body{display:grid;place-items:center;text-align:center;padding:24px;background:radial-gradient(900px 500px at 50% 0,#1a1450,#050714 70%)}h1{font-size:1.5rem;margin:0 0 10px}p{color:#aab0d8;margin:0 0 22px;line-height:1.5}a{display:inline-block;color:#fff;text-decoration:none;font-weight:700;border-radius:12px;padding:14px 26px;background:linear-gradient(90deg,#8b5cf6,#38bdf8)}small{display:block;margin-top:18px;color:#7f86b5}</style></head><body><main><h1>${head}</h1><p>${msg}</p><a href="/">Back to The Gaming Hub</a><small>Error ${code}</small></main></body></html>`;
app.use((err, req, res, next) => { console.error(err);
  if (!req.path.startsWith('/api/') && req.accepts(['html', 'json']) === 'html' && !res.headersSent) { const st = err.status && err.status < 600 ? err.status : 500; return res.status(st).type('html').send(ERR_PAGE(st, st === 413 ? 'That request was too large' : 'Something went wrong on our side', st === 413 ? 'Please try again with something smaller.' : 'We have logged it. Please try again in a moment.')); }
  bad(res, err.status || 500, err.type === 'entity.parse.failed' ? 'Bad JSON' : 'Server error'); });

// lock final standings automatically at each giveaway's end time
setInterval(() => R.sweep(), 15e3).unref(); setTimeout(() => R.sweep(), 1500).unref();
BK.schedule();
const server = app.listen(cfg.PORT, '0.0.0.0', () => {
  const heap = Math.round(require('v8').getHeapStatistics().heap_size_limit / 1048576);
  console.log(`[${new Date().toISOString()}] Gaming Hub listening on port ${cfg.PORT} (db: ${cfg.DB_PATH}, node ${process.version} ${process.platform}/${process.arch}, heap limit ${heap} MB, uid ${process.getuid ? process.getuid() : '?'})`);
});
// Keep idle keep-alive sockets open longer than a typical reverse-proxy idle timeout, so the proxy never reuses a
// socket the app has just closed (that race shows up as sporadic ECONNRESET / 502 on slow, CPU-capped hosts).
server.keepAliveTimeout = 65e3; server.headersTimeout = 66e3;
// Graceful shutdown (Render/Docker send SIGTERM on deploys): stop accepting requests, then close SQLite cleanly.
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, () => {
  console.log(`[${new Date().toISOString()}] ${sig} received, shutting down`);
  server.close(() => { try { db.close(); } catch {} process.exit(0); });
  setTimeout(() => process.exit(0), 8000).unref();
});

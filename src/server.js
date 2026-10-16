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
require('./external-routes').register(app); // External games catalog (GameArter + GameDistribution)
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
  res.json
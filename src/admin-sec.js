'use strict';
// v7: hardened admin access.
//  - Admin lives ONLY at a secret path: /<ADMIN_PATH>/ (env var, long random slug). /admin, /admin/*, /api/admin/* are plain 404s.
//    The path appears in no public HTML/JS/robots/sitemap/service worker. The admin app (JS/CSS) is served only from the
//    secret path and only to a fully signed-in session; before that the path serves a tiny login page.
//  - Password (bcrypt hash in the DB overrides the ADMIN_PASSWORD env var) + TOTP authenticator app (QR enrolment on first
//    login, 10 one-time backup codes).
//  - Brute force: per-IP + global request limits, per-IP failure lockout with exponential backoff, global lockout, all
//    comparisons constant-time. Client IP = CF-Connecting-IP only when we are behind Cloudflare (TRUST_CF_IP=1, default
//    on in production), otherwise the socket address (a spoofed header can't dodge the limits).
//  - Sessions: random server-side session ids (only a hash is stored), HttpOnly + SameSite=Strict (+ Secure on HTTPS)
//    cookie scoped to the secret path, 30 min idle timeout, 8 h absolute, CSRF token on every admin POST/PUT/DELETE,
//    all sessions revoked when the password changes.
//  - Admin-only headers: X-Robots-Tag noindex, Cache-Control no-store, CSP frame-ancestors 'none', Referrer-Policy no-referrer.
//  - Audit log of logins, failures, lockouts, resets (admin_login_log), shown in Admin > Security.
//  - Recovery: ADMIN_RESET_TOKEN env var (>= 24 chars) enables a one-time reset at /<ADMIN_PATH>/reset (new password, 2FA
//    cleared for re-enrolment). Each token works once; remove the env var afterwards.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const cfg = require('./config');
const db = require('./db');

const now = () => Date.now();
const RESERVED = new Set(['api', 'admin', 'assets', 'css', 'js', 'fonts', 'og', 'games', 'play', 'u', 's', 'go']);
const RAW_PATH = String(process.env.ADMIN_PATH || '').trim().replace(/^\/+|\/+$/g, '');
const PATH_OK = /^[A-Za-z0-9_-]{16,128}$/.test(RAW_PATH) && !RESERVED.has(RAW_PATH.toLowerCase());
const BASE = PATH_OK ? '/' + RAW_PATH : null;
if (!PATH_OK) console.warn('[admin] ADMIN_PATH is not set (or shorter than 16 characters of A-Z a-z 0-9 _ -): the admin dashboard is DISABLED. Set ADMIN_PATH to a long random slug.');
const TRUST_CF = process.env.TRUST_CF_IP === '1' || (process.env.NODE_ENV === 'production' && process.env.TRUST_CF_IP !== '0');
const RESET_TOKEN = String(process.env.ADMIN_RESET_TOKEN || '');
if (RESET_TOKEN && RESET_TOKEN.length < 24) console.warn('[admin] ADMIN_RESET_TOKEN is shorter than 24 characters and is ignored.');
const RESET_ON = RESET_TOKEN.length >= 24;
if (RESET_ON) console.warn('[admin] ADMIN_RESET_TOKEN is set: a one-time admin reset is enabled. Remove the env var as soon as you have used it.');

const IDLE_MS = 30 * 60e3, ABS_MS = 8 * 3600e3, PRE_MS = 5 * 60e3;          // full-session idle / absolute, password-stage TTL
const IP_WINDOW = 15 * 60e3, IP_FREE = 5, IP_MAX_LOCK = 60 * 60e3;           // 5 free failures per IP / 15 min, then backoff
const G_WINDOW = 15 * 60e3, G_FAILS = 40, G_LOCK = 15 * 60e3;                // 40 failures from anywhere in 15 min -> global lock
const REQ_IP = [20, 10 * 60e3], REQ_GLOBAL = [200, 10 * 60e3];               // auth requests per IP / globally per 10 min

db.exec(`
CREATE TABLE IF NOT EXISTS admin_auth (id INTEGER PRIMARY KEY CHECK (id = 1), pass_hash TEXT, pass_set_at INTEGER, pw_ver INTEGER NOT NULL DEFAULT 1,
  totp_enc TEXT, totp_at INTEGER, totp_last_step INTEGER NOT NULL DEFAULT 0, backup_codes TEXT NOT NULL DEFAULT '[]', reset_used TEXT NOT NULL DEFAULT '[]');
INSERT OR IGNORE INTO admin_auth (id) VALUES (1);
CREATE TABLE IF NOT EXISTS admin_sessions (sid_hash TEXT PRIMARY KEY, stage TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
  csrf TEXT NOT NULL, ip_hash TEXT, ua TEXT, pw_ver INTEGER NOT NULL, pending_totp TEXT);
CREATE TABLE IF NOT EXISTS admin_login_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, ip_hash TEXT, ip_hint TEXT, ua TEXT,
  event TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 0, detail TEXT);
CREATE INDEX IF NOT EXISTS idx_admin_log_at ON admin_login_log(at);
CREATE INDEX IF NOT EXISTS idx_admin_log_ip ON admin_login_log(ip_hash, at);
`);

// ---------- small crypto helpers ----------
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const hm = (s) => crypto.createHmac('sha256', cfg.SESSION_SECRET + ':admin-sec').update(String(s)).digest('hex');
function safeEq(a, b) {
  // constant time for any lengths: compare fixed-size digests
  const A = crypto.createHash('sha256').update(String(a)).digest(); const B = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(A, B) && String(a).length === String(b).length;
}
const KEY = crypto.createHash('sha256').update(cfg.SESSION_SECRET + ':totp-key').digest();
function enc(plain) { const iv = crypto.randomBytes(12); const c = crypto.createCipheriv('aes-256-gcm', KEY, iv); const d = Buffer.concat([c.update(plain, 'utf8'), c.final()]); return [iv, c.getAuthTag(), d].map(b => b.toString('base64url')).join('.'); }
function dec(s) { try { const [iv, tag, d] = String(s).split('.').map(x => Buffer.from(x, 'base64url')); const c = crypto.createDecipheriv('aes-256-gcm', KEY, iv); c.setAuthTag(tag); return Buffer.concat([c.update(d), c.final()]).toString('utf8'); } catch { return null; } }
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32enc(buf) { let bits = 0, val = 0, out = ''; for (const b of buf) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; }
function b32dec(s) { const out = []; let bits = 0, val = 0; for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function hotp(secretB32, counter) {
  const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', b32dec(secretB32)).update(b).digest(); const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
// returns the matched 30 s step (> lastStep, so a code can't be replayed) or -1. Checks all 3 candidates (no early exit).
function totpStep(secretB32, code, lastStep = 0, t = now()) {
  const c = String(code || '').replace(/\s+/g, ''); const s0 = Math.floor(t / 30e3); let hit = -1;
  for (const d of [-1, 0, 1]) { const st = s0 + d; const okc = safeEq(hotp(secretB32, st), c); if (okc && st > lastStep && hit < 0) hit = st; }
  return /^\d{6}$/.test(c) ? hit : -1;
}

// ---------- client IP (Cloudflare-aware) ----------
const IP_RE = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[0-9a-fA-F:]{2,45})$/;
function clientIp(req) {
  const cf = String(req.headers['cf-connecting-ip'] || '').trim();
  if (TRUST_CF && IP_RE.test(cf)) return cf;
  return String((req.socket && req.socket.remoteAddress) || req.ip || '').replace(/^::ffff:/, '');
}
const ipHash = (req) => hm('ip:' + clientIp(req)).slice(0, 20);
const ipHint = (req) => { const ip = clientIp(req); return ip.includes('.') ? ip.split('.').slice(0, 3).join('.') + '.x' : ip.split(':').slice(0, 3).join(':') + '::x'; };

// ---------- request rate limits (in memory, bounded) ----------
const hits = new Map();
function allow(key, [limit, win]) {
  const t = now(); const a = (hits.get(key) || []).filter(x => t - x < win); hits.delete(key);
  const ok = a.length < limit; if (ok) a.push(t); hits.set(key, a);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return ok;
}
setInterval(() => { const t = now(); for (const [k, v] of hits) if (!v.length || t - v[v.length - 1] > 3600e3) hits.delete(k); }, 600e3).unref();

// ---------- audit log ----------
function log(req, event, ok, detail = '') {
  db.prepare('INSERT INTO admin_login_log (at, ip_hash, ip_hint, ua, event, ok, detail) VALUES (?,?,?,?,?,?,?)')
    .run(now(), ipHash(req), ipHint(req), String(req.headers['user-agent'] || '').slice(0, 160), event, ok ? 1 : 0, String(detail).slice(0, 200));
  if (Math.random() < 0.02) db.prepare('DELETE FROM admin_login_log WHERE at < ?').run(now() - 180 * 864e5); // keep 6 months
}
const FAIL_EVENTS = "('login-fail','totp-fail','reset-fail')";
function lockState(req) {
  const t = now(); const ih = ipHash(req);
  const lastOk = (db.prepare("SELECT MAX(at) AS m FROM admin_login_log WHERE ip_hash=? AND ok=1 AND event IN ('login-ok','reset-ok')").get(ih).m) || 0;
  const fails = db.prepare(`SELECT at FROM admin_login_log WHERE ip_hash=? AND event IN ${FAIL_EVENTS} AND at > ? ORDER BY at DESC LIMIT 50`).all(ih, Math.max(t - IP_WINDOW * 4, lastOk));
  const recent = fails.filter(f => f.at > t - IP_WINDOW).length;
  if (fails.length >= IP_FREE && recent >= 1) {
    const lock = Math.min(IP_MAX_LOCK, 60e3 * 2 ** (fails.length - IP_FREE)); const until = fails[0].at + lock;
    if (until > t) return { locked: true, scope: 'ip', until };
  }
  const g = db.prepare(`SELECT COUNT(*) AS c, MAX(at) AS m FROM admin_login_log WHERE event IN ${FAIL_EVENTS} AND at > ?`).get(t - G_WINDOW);
  if (g.c >= G_FAILS && g.m + G_LOCK > t) return { locked: true, scope: 'global', until: g.m + G_LOCK };
  return { locked: false };
}

// ---------- sessions ----------
const COOKIE = 'gh_adm';
function cookies(req) { const o = {}; for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } return o; }
const isHttps = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';
function setCookie(req, res, val, maxMs) {
  const parts = [`${COOKIE}=${encodeURIComponent(val)}`, `Path=${BASE}`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.floor(maxMs / 1000)}`];
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
const auth = () => db.prepare('SELECT * FROM admin_auth WHERE id=1').get();
function newSession(req, res, stage, extra = {}) {
  const sid = crypto.randomBytes(32).toString('base64url'); const csrf = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO admin_sessions (sid_hash, stage, created_at, last_seen, csrf, ip_hash, ua, pw_ver, pending_totp) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(hm(sid), stage, now(), now(), csrf, ipHash(req), String(req.headers['user-agent'] || '').slice(0, 160), auth().pw_ver, extra.pending_totp || null);
  setCookie(req, res, sid, stage === 'full' ? ABS_MS : PRE_MS);
  return { csrf };
}
function getSession(req) {
  const sid = cookies(req)[COOKIE]; if (!sid || sid.length > 100) return null;
  const s = db.prepare('SELECT * FROM admin_sessions WHERE sid_hash=?').get(hm(sid)); if (!s) return null;
  const t = now(); const a = auth();
  const dead = s.pw_ver !== a.pw_ver || (s.stage === 'full' ? (t - s.last_seen > IDLE_MS || t - s.created_at > ABS_MS) : t - s.created_at > PRE_MS);
  if (dead) { db.prepare('DELETE FROM admin_sessions WHERE sid_hash=?').run(s.sid_hash); return null; }
  if (s.stage === 'full' && t - s.last_seen > 30e3) db.prepare('UPDATE admin_sessions SET last_seen=? WHERE sid_hash=?').run(t, s.sid_hash);
  return s;
}
function endSession(req, res) { const sid = cookies(req)[COOKIE]; if (sid) db.prepare('DELETE FROM admin_sessions WHERE sid_hash=?').run(hm(sid)); setCookie(req, res, '', 0); }
setInterval(() => { try { db.prepare('DELETE FROM admin_sessions WHERE (stage=\'full\' AND last_seen < ?) OR (stage<>\'full\' AND created_at < ?)').run(now() - IDLE_MS, now() - PRE_MS); } catch {} }, 10 * 60e3).unref();

async function checkPassword(pw) {
  const a = auth(); pw = String(pw || '').slice(0, 200);
  if (a.pass_hash) return bcrypt.compare(pw, a.pass_hash);
  return safeEq(pw, cfg.ADMIN_PASSWORD);
}
function hashCodes(codes) { return JSON.stringify(codes.map(c => hm('bc:' + c.replace(/-/g, '').toLowerCase()))); }
function newBackupCodes() {
  const codes = Array.from({ length: 10 }, () => { const s = b32enc(crypto.randomBytes(5)).toLowerCase(); return s.slice(0, 4) + '-' + s.slice(4, 8); });
  db.prepare('UPDATE admin_auth SET backup_codes=? WHERE id=1').run(hashCodes(codes));
  return codes;
}
function useBackupCode(code) {
  const h = hm('bc:' + String(code || '').replace(/[\s-]/g, '').toLowerCase()); const list = JSON.parse(auth().backup_codes || '[]');
  let idx = -1; list.forEach((x, i) => { if (safeEq(x, h) && idx < 0) idx = i; });
  if (idx < 0) return false;
  list.splice(idx, 1); db.prepare('UPDATE admin_auth SET backup_codes=? WHERE id=1').run(JSON.stringify(list)); return true;
}
const pwProblem = (p) => (typeof p !== 'string' || p.length < 12) ? 'Use at least 12 characters.' : p.length > 200 ? 'Too long.' : null;

// ---------- headers / pages ----------
function secHeaders(req, res, next) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Cache-Control', 'no-store, max-age=0'); res.setHeader('Pragma', 'no-cache');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'");
  res.setHeader('X-Frame-Options', 'DENY'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin'); res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  next();
}
const UI = path.join(__dirname, 'admin-ui');
const read = (f) => fs.readFileSync(path.join(UI, f), 'utf8');
const sub = (s) => s.replace(/(['"`])\/api\/admin(?=[/'"`?$])/g, `$1${BASE}/api`).replace(/(['"`])\/admin(?=[/'"`?$])/g, `$1${BASE}`);
const shellHtml = (csrf) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Admin - The Gaming Hub by Trap Tech Solutions</title><meta name="theme-color" content="#050714">
<meta name="csrf" content="${csrf}"><link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/v7.css"><link rel="stylesheet" href="${BASE}/admin.css"><link rel="stylesheet" href="/cosmetics.css">
</head><body><div id="admin"></div><script type="module" src="${BASE}/admin.js"></script></body></html>`;
const loginHtml = (mode) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Sign in</title><meta name="theme-color" content="#050714"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/v7.css"><link rel="stylesheet" href="${BASE}/login.css">
</head><body><main class="adm-auth" id="auth" data-mode="${mode}" data-base="${BASE}"><noscript>JavaScript is required.</noscript></main><script src="${BASE}/login.js"></script></body></html>`;

function requireAdmin(req, res, next) {
  const s = getSession(req);
  if (!s || s.stage !== 'full') return res.status(401).json({ ok: false, error: 'Admin login required.' });
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
    if (!safeEq(String(req.headers['x-csrf-token'] || ''), s.csrf)) return res.status(403).json({ ok: false, error: 'Missing or invalid CSRF token. Reload the page.' });
  }
  req.adminSession = s; next();
}
const notFound = (req, res) => res.status(404).type('text/plain').send('Not found');

function mount(app, express, A) {
  // the old public admin URLs simply don't exist any more
  app.all(['/admin', '/admin/*', '/admin.html', '/api/admin', '/api/admin/*', '/js/admin.js', '/css/admin.css'], notFound);
  if (!BASE) return;
  const R = express.Router();
  R.use(secHeaders);
  const authLimit = (req, res, next) => {
    if (!allow('g', REQ_GLOBAL) || !allow('ip:' + ipHash(req), REQ_IP)) { log(req, 'rate-limited', 0); return res.status(429).json({ ok: false, error: 'Too many attempts. Wait a few minutes.', retry_after: 600 }); }
    if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
    const L = lockState(req);
    if (L.locked) { log(req, 'locked-out', 0, L.scope); return res.status(429).json({ ok: false, error: L.scope === 'global' ? 'Admin sign-in is temporarily locked after many failed attempts. Try again later.' : 'Too many failed attempts from your network. Try again later.', locked: true, scope: L.scope, retry_after: Math.ceil((L.until - now()) / 1000) }); }
    next();
  };
  R.post('/api/login', express.json({ limit: '4kb' }), authLimit, async (req, res) => {
    const ok = await checkPassword(req.body && req.body.password);
    if (!ok) { log(req, 'login-fail', 0, 'password'); await new Promise(r => setTimeout(r, 250 + Math.random() * 250)); return res.status(401).json({ ok: false, error: 'Wrong password or code.' }); }
    endSession(req, res);
    const a = auth();
    if (a.totp_enc && dec(a.totp_enc)) { newSession(req, res, 'pw'); log(req, 'password-ok', 1); return res.json({ ok: true, next: 'totp' }); }
    // first login (or after a reset): enrol an authenticator app
    const secret = b32enc(crypto.randomBytes(20));
    newSession(req, res, 'enroll', { pending_totp: enc(secret) }); log(req, 'password-ok', 1, 'enrol');
    const label = encodeURIComponent('Gaming Hub Admin'); const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Trap Tech Gaming Hub')}&algorithm=SHA1&digits=6&period=30`;
    const qrg = require('qrcode-generator'); const q = (qrg.default || qrg)(0, 'M'); q.addData(uri); q.make();
    res.json({ ok: true, next: 'enroll', secret, otpauth: uri, qr_svg: q.createSvgTag({ cellSize: 5, margin: 3, scalable: true }) });
  });
  R.post('/api/totp', express.json({ limit: '4kb' }), authLimit, (req, res) => {
    const s = getSession(req); if (!s || (s.stage !== 'pw' && s.stage !== 'enroll')) return res.status(401).json({ ok: false, error: 'Start again with your password.', restart: true });
    const a = auth(); const code = String((req.body && req.body.code) || '').trim(); let codes = null, via = 'totp';
    if (s.stage === 'enroll') {
      const secret = dec(s.pending_totp); const st = secret ? totpStep(secret, code, 0) : -1;
      if (st < 0) { log(req, 'totp-fail', 0, 'enrol'); return res.status(401).json({ ok: false, error: 'That code did not match. Check the time on your phone and try the newest code.' }); }
      db.prepare('UPDATE admin_auth SET totp_enc=?, totp_at=?, totp_last_step=? WHERE id=1').run(enc(secret), now(), st);
      codes = newBackupCodes(); via = 'enrol';
    } else {
      const secret = dec(a.totp_enc); const st = secret ? totpStep(secret, code, a.totp_last_step) : -1;
      if (st >= 0) db.prepare('UPDATE admin_auth SET totp_last_step=? WHERE id=1').run(st);
      else if (/^[a-z2-7]{4}-?[a-z2-7]{4}$/i.test(code) && useBackupCode(code)) via = 'backup-code';
      else { log(req, 'totp-fail', 0); return res.status(401).json({ ok: false, error: 'Wrong password or code.' }); }
    }
    endSession(req, res); const { csrf } = newSession(req, res, 'full'); log(req, 'login-ok', 1, via);
    res.json({ ok: true, csrf, backup_codes: codes, backup_left: JSON.parse(auth().backup_codes).length });
  });
  // one-time recovery (only while ADMIN_RESET_TOKEN is set)
  R.get('/reset', (req, res) => RESET_ON ? res.type('html').send(loginHtml('reset')) : notFound(req, res));
  R.post('/api/reset', express.json({ limit: '4kb' }), authLimit, async (req, res) => {
    if (!RESET_ON) return notFound(req, res);
    const tok = String((req.body && req.body.token) || ''); const used = JSON.parse(auth().reset_used || '[]');
    const good = safeEq(tok, RESET_TOKEN);
    if (!good) { log(req, 'reset-fail', 0); return res.status(401).json({ ok: false, error: 'Reset token is wrong.' }); }
    if (used.includes(sha(RESET_TOKEN))) { log(req, 'reset-fail', 0, 'token already used'); return res.status(410).json({ ok: false, error: 'This reset token was already used. Remove ADMIN_RESET_TOKEN from the host settings (or set a new one) and restart.' }); }
    const np = req.body.new_password; const pr = pwProblem(np); if (pr) return res.status(400).json({ ok: false, error: pr });
    used.push(sha(RESET_TOKEN));
    db.prepare("UPDATE admin_auth SET pass_hash=?, pass_set_at=?, pw_ver=pw_ver+1, totp_enc=NULL, totp_at=NULL, totp_last_step=0, backup_codes='[]', reset_used=? WHERE id=1")
      .run(await bcrypt.hash(np, 12), now(), JSON.stringify(used));
    db.prepare('DELETE FROM admin_sessions').run(); log(req, 'reset-ok', 1, 'password replaced, 2FA cleared');
    res.json({ ok: true, note: 'Password reset. Sign in and set up your authenticator again, then REMOVE ADMIN_RESET_TOKEN from the host settings.' });
  });
  R.get('/login.js', (req, res) => res.type('application/javascript').send(read('login.js')));
  R.get('/login.css', (req, res) => res.type('text/css').send(read('login.css')));
  // everything below needs a full session
  R.get('/admin.js', (req, res) => { const s = getSession(req); if (!s || s.stage !== 'full') return notFound(req, res); res.type('application/javascript').send(sub(read('admin.js'))); });
  R.get('/admin.css', (req, res) => { const s = getSession(req); if (!s || s.stage !== 'full') return notFound(req, res); res.type('text/css').send(read('admin.css')); });
  R.get('/api/me', (req, res) => { const s = getSession(req); res.json({ ok: true, admin: !!(s && s.stage === 'full'), csrf: s && s.stage === 'full' ? s.csrf : undefined }); });
  R.post('/api/logout', requireAdmin, (req, res) => { endSession(req, res); log(req, 'logout', 1); res.json({ ok: true }); });
  R.get('/api/security', requireAdmin, (req, res) => {
    const a = auth();
    res.json({ ok: true, password_source: a.pass_hash ? 'database (bcrypt)' : 'ADMIN_PASSWORD env var', password_set_at: a.pass_set_at, totp_enrolled_at: a.totp_at,
      backup_codes_left: JSON.parse(a.backup_codes || '[]').length, reset_token_active: RESET_ON, trust_cf: TRUST_CF,
      sessions: db.prepare("SELECT created_at, last_seen, ip_hash, ua FROM admin_sessions WHERE stage='full' ORDER BY last_seen DESC").all().map(x => ({ ...x, current: x.ip_hash === req.adminSession.ip_hash && x.created_at === req.adminSession.created_at })),
      log: db.prepare('SELECT at, ip_hint, ua, event, ok, detail FROM admin_login_log ORDER BY id DESC LIMIT 200').all(),
      failed_24h: db.prepare(`SELECT COUNT(*) AS c FROM admin_login_log WHERE event IN ${FAIL_EVENTS} AND at > ?`).get(now() - 864e5).c });
  });
  const needCode = (req) => { const a = auth(); const secret = dec(a.totp_enc); const st = secret ? totpStep(secret, req.body.code, a.totp_last_step) : -1; if (st >= 0) db.prepare('UPDATE admin_auth SET totp_last_step=? WHERE id=1').run(st); return st >= 0; };
  R.post('/api/security/password', express.json({ limit: '4kb' }), requireAdmin, async (req, res) => {
    if (!allow('pw:' + ipHash(req), [10, 3600e3])) return res.status(429).json({ ok: false, error: 'Too many attempts.' });
    if (!(await checkPassword(req.body.current))) { log(req, 'password-change-fail', 0, 'current password wrong'); return res.status(401).json({ ok: false, error: 'Current password is wrong.' }); }
    if (!needCode(req)) { log(req, 'password-change-fail', 0, 'code wrong'); return res.status(401).json({ ok: false, error: 'Authenticator code is wrong.' }); }
    const pr = pwProblem(req.body.new_password); if (pr) return res.status(400).json({ ok: false, error: pr });
    db.prepare('UPDATE admin_auth SET pass_hash=?, pass_set_at=?, pw_ver=pw_ver+1 WHERE id=1').run(await bcrypt.hash(req.body.new_password, 12), now());
    db.prepare('DELETE FROM admin_sessions').run(); setCookie(req, res, '', 0); log(req, 'password-changed', 1, 'all sessions signed out');
    res.json({ ok: true, note: 'Password changed. Every admin session (including this one) has been signed out.' });
  });
  R.post('/api/security/backup-codes', express.json({ limit: '4kb' }), requireAdmin, (req, res) => {
    if (!needCode(req)) return res.status(401).json({ ok: false, error: 'Authenticator code is wrong.' });
    const codes = newBackupCodes(); log(req, 'backup-codes-regenerated', 1); res.json({ ok: true, backup_codes: codes });
  });
  R.post('/api/security/logout-all', requireAdmin, (req, res) => { db.prepare('DELETE FROM admin_sessions').run(); setCookie(req, res, '', 0); log(req, 'logout-all', 1); res.json({ ok: true }); });
  R.use('/api', requireAdmin, A);
  R.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
  // the admin app shell (any client-side route below the secret path)
  R.get(['/', '/*'], (req, res) => {
    if (path.extname(req.path)) return notFound(req, res);
    const s = getSession(req);
    res.type('html').send(s && s.stage === 'full' ? shellHtml(s.csrf) : loginHtml('login'));
  });
  app.use(BASE, R);
}

module.exports = { mount, requireAdmin, BASE: () => BASE, _t: { hotp, totpStep, b32enc, b32dec, dec, clientIp } };

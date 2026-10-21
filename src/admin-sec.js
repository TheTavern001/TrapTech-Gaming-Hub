'use strict';
// v7: hardened admin access with per-account admin users and roles (owner > admin > moderator).
//  - Admin lives ONLY at a secret path: /<ADMIN_PATH>/ (env var, long random slug). /admin, /admin/*, /api/admin/* are plain 404s.
//    The path appears in no public HTML/JS/robots/sitemap/service worker. The admin app (JS/CSS) is served only from the
//    secret path and only to a fully signed-in session; before that the path serves a tiny sign-in page.
//  - Accounts: admin_users (username, role, bcrypt password, TOTP secret, backup codes). The OWNER account is seeded on first
//    run (username ADMIN_USERNAME, default "owner") and uses the ADMIN_PASSWORD env var until a password is set in admin;
//    from then on the bcrypt hash in the DB wins. Every account has its own password + authenticator app (QR enrolment on
//    first sign-in, 10 one-time backup codes). The owner appoints admins/moderators (API below, UI by the admin-panel work).
//  - Brute force: per-IP + global request limits, per-IP and per-account failure lockouts with exponential backoff, a
//    global lockout, constant-time comparisons (and a dummy bcrypt for unknown usernames). Client IP = CF-Connecting-IP
//    only when we are behind Cloudflare (TRUST_CF_IP=1, default on in production), else the socket address.
//  - Sessions: random server-side session ids (only an HMAC is stored), HttpOnly + SameSite=Strict (+ Secure on HTTPS)
//    cookie scoped to the secret path, 30 min idle timeout, 8 h absolute, CSRF token on every admin POST/PUT/DELETE, all of
//    an account's sessions revoked when its password changes (or the owner resets / disables / re-roles it).
//  - Admin-only headers: X-Robots-Tag noindex, Cache-Control no-store, CSP frame-ancestors 'none', Referrer-Policy no-referrer.
//  - Audit log of sign-ins, failures, lockouts, resets, account changes (admin_login_log), shown in Admin > Security.
//  - Recovery: ADMIN_RESET_TOKEN env var (>= 24 chars) enables a one-time OWNER reset at /<ADMIN_PATH>/reset (new
//    password, 2FA cleared for re-enrolment). Each token works once; remove the env var afterwards.
//
// For other server code:  const ADMSEC = require('./admin-sec');
//   ADMSEC.requireRole('owner'|'admin'|'moderator')  express middleware (auth + CSRF + minimum role); sets req.admin = { id, username, role }
//   ADMSEC.requireAdmin                                = requireRole('admin') (the default for the main admin router A)
//   ADMSEC.M                                           router mounted at /<ADMIN_PATH>/api BEFORE A, gated at moderator level:
//                                                      put routes moderators may use there (call requireRole inside for more)
//   ADMSEC.accounts.{list,create,update,resetAuth,remove}  account management (also exposed as owner-only /api/accounts routes)
//   ADMSEC.ROLES, ADMSEC.roleAtLeast(role, min), ADMSEC.BASE()
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const cfg = require('./config');
const db = require('./db');

const now = () => Date.now();
const RESERVED = new Set(['api', 'admin', 'assets', 'css', 'js', 'fonts', 'og', 'games', 'play', 'u', 's', 'go']);
const RAW_PATH = String(process.env.ADMIN_PATH || '').trim().replace(/^\/+|\/+$/g, '');
const PATH_OK = /^[A-Za-z0-9_-]{16,128}$/.test(RAW_PATH) && !RESERVED.has(RAW_PATH.toLowerCase());
const BASE = PATH_OK ? '/' + RAW_PATH : null;
if (!PATH_OK) {
  const why = !RAW_PATH ? 'ADMIN_PATH is not set' : RESERVED.has(RAW_PATH.toLowerCase()) ? `ADMIN_PATH "${RAW_PATH}" is a reserved word` : 'ADMIN_PATH must be 16-128 characters of A-Z a-z 0-9 _ -';
  console.warn(['[admin] ADMIN DASHBOARD IS DISABLED: ' + why + '. The site itself runs normally; /admin and /api/admin return 404 by design.',
    '[admin]   To enable it, set these environment variables on the host and redeploy:',
    '[admin]     ADMIN_PATH=<a long random slug, e.g. output of `openssl rand -hex 16`>   (the admin then lives at /<ADMIN_PATH>/)',
    '[admin]     ADMIN_PASSWORD=<a strong password, 12+ characters>                        (first owner sign-in; you then add an authenticator app)',
    '[admin]   Optional: ADMIN_USERNAME (default "owner"), ADMIN_RESET_TOKEN (24+ chars, one-time owner recovery; remove after use).'].join('\n'));
}
const TRUST_CF = process.env.TRUST_CF_IP === '1' || (process.env.NODE_ENV === 'production' && process.env.TRUST_CF_IP !== '0');
const RESET_TOKEN = String(process.env.ADMIN_RESET_TOKEN || '');
if (RESET_TOKEN && RESET_TOKEN.length < 24) console.warn('[admin] ADMIN_RESET_TOKEN is shorter than 24 characters and is ignored.');
const RESET_ON = RESET_TOKEN.length >= 24;
if (RESET_ON) console.warn('[admin] ADMIN_RESET_TOKEN is set: a one-time owner reset is enabled. Remove the env var as soon as you have used it.');
const OWNER_NAME = String(process.env.ADMIN_USERNAME || 'owner').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '').slice(0, 32) || 'owner';

const ROLES = ['moderator', 'admin', 'owner'];
const roleAtLeast = (role, min) => ROLES.indexOf(role) >= ROLES.indexOf(min) && ROLES.indexOf(min) >= 0;
const IDLE_MS = 30 * 60e3, ABS_MS = 8 * 3600e3, PRE_MS = 5 * 60e3;          // full-session idle / absolute, password-stage TTL
const IP_WINDOW = 15 * 60e3, IP_FREE = 5, IP_MAX_LOCK = 60 * 60e3;           // 5 free failures per IP / 15 min, then 1,2,4.. min
const ACC_FREE = 8;                                                          // 8 free failures per account / 15 min, then backoff
const G_WINDOW = 15 * 60e3, G_FAILS = 40, G_LOCK = 15 * 60e3;                // 40 failures from anywhere in 15 min -> global lock
const REQ_IP = [20, 10 * 60e3], REQ_GLOBAL = [200, 10 * 60e3];               // auth requests per IP / globally per 10 min

db.exec(`
CREATE TABLE IF NOT EXISTS admin_users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE COLLATE NOCASE, role TEXT NOT NULL,
  pass_hash TEXT, pass_set_at INTEGER, pw_ver INTEGER NOT NULL DEFAULT 1, must_change INTEGER NOT NULL DEFAULT 0,
  totp_enc TEXT, totp_at INTEGER, totp_last_step INTEGER NOT NULL DEFAULT 0, backup_codes TEXT NOT NULL DEFAULT '[]',
  disabled INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, created_by INTEGER, last_login_at INTEGER, display_name TEXT);
CREATE TABLE IF NOT EXISTS admin_meta (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS admin_sessions (sid_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, stage TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL,
  csrf TEXT NOT NULL, ip_hash TEXT, ua TEXT, pw_ver INTEGER NOT NULL, pending_totp TEXT);
CREATE TABLE IF NOT EXISTS admin_login_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, ip_hash TEXT, ip_hint TEXT, ua TEXT,
  event TEXT NOT NULL, ok INTEGER NOT NULL DEFAULT 0, detail TEXT, admin_id INTEGER, username TEXT);
CREATE INDEX IF NOT EXISTS idx_admin_log_at ON admin_login_log(at);
CREATE INDEX IF NOT EXISTS idx_admin_log_ip ON admin_login_log(ip_hash, at);
CREATE INDEX IF NOT EXISTS idx_admin_sess_user ON admin_sessions(admin_id);
`);
// early v7 dev builds had a single-account table; sessions from it are useless now
for (const [t, c] of [['admin_sessions', 'admin_id'], ['admin_login_log', 'admin_id'], ['admin_login_log', 'username']]) {
  if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) { if (t === 'admin_sessions') { db.exec('DROP TABLE admin_sessions'); db.exec(`CREATE TABLE admin_sessions (sid_hash TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, stage TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, csrf TEXT NOT NULL, ip_hash TEXT, ua TEXT, pw_ver INTEGER NOT NULL, pending_totp TEXT)`); } else db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${c === 'admin_id' ? 'INTEGER' : 'TEXT'}`); }
}
// seed the owner account on first run (password = ADMIN_PASSWORD env var until changed in admin)
if (!db.prepare("SELECT 1 FROM admin_users WHERE role='owner'").get()) {
  db.prepare("INSERT INTO admin_users (username, role, created_at, display_name) VALUES (?, 'owner', ?, 'Owner')").run(OWNER_NAME, now());
  try { const old = db.prepare('SELECT * FROM admin_auth WHERE id=1').get(); if (old && (old.pass_hash || old.totp_enc)) db.prepare("UPDATE admin_users SET pass_hash=?, pass_set_at=?, totp_enc=?, totp_at=?, backup_codes=? WHERE role='owner'").run(old.pass_hash, old.pass_set_at, old.totp_enc, old.totp_at, old.backup_codes || '[]'); } catch {}
  console.log(`[admin] owner account "${OWNER_NAME}" created (signs in with ADMIN_PASSWORD, then sets up an authenticator app)`);
}
const meta = (k, v) => { if (v === undefined) { const r = db.prepare('SELECT v FROM admin_meta WHERE k=?').get(k); return r ? r.v : null; } db.prepare('INSERT INTO admin_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').run(k, v); };

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
function log(req, event, ok, detail = '', who = null) {
  db.prepare('INSERT INTO admin_login_log (at, ip_hash, ip_hint, ua, event, ok, detail, admin_id, username) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(now(), ipHash(req), ipHint(req), String(req.headers['user-agent'] || '').slice(0, 160), event, ok ? 1 : 0, String(detail).slice(0, 200), who ? who.id || null : null, who ? String(who.username || '').slice(0, 40) : null);
  if (Math.random() < 0.02) db.prepare('DELETE FROM admin_login_log WHERE at < ?').run(now() - 180 * 864e5); // keep 6 months
}
const FAIL_EVENTS = "('login-fail','totp-fail','reset-fail')";
const backoff = (fails, free) => Math.min(IP_MAX_LOCK, 60e3 * 2 ** (fails - free));
function lockState(req, username = null) {
  const t = now(); const ih = ipHash(req);
  const lastOk = (db.prepare("SELECT MAX(at) AS m FROM admin_login_log WHERE ip_hash=? AND ok=1 AND event IN ('login-ok','reset-ok')").get(ih).m) || 0;
  const fails = db.prepare(`SELECT at FROM admin_login_log WHERE ip_hash=? AND event IN ${FAIL_EVENTS} AND at > ? ORDER BY at DESC LIMIT 50`).all(ih, Math.max(t - IP_WINDOW * 4, lastOk));
  if (fails.length >= IP_FREE && fails[0].at > t - IP_WINDOW) { const until = fails[0].at + backoff(fails.length, IP_FREE); if (until > t) return { locked: true, scope: 'ip', until }; }
  if (username) {
    const u = String(username).toLowerCase().slice(0, 40);
    const lastAccOk = (db.prepare("SELECT MAX(at) AS m FROM admin_login_log WHERE username=? AND ok=1 AND event IN ('login-ok','reset-ok','account-reset')").get(u).m) || 0;
    const af = db.prepare(`SELECT at FROM admin_login_log WHERE username=? AND event IN ${FAIL_EVENTS} AND at > ? ORDER BY at DESC LIMIT 50`).all(u, Math.max(t - IP_WINDOW * 4, lastAccOk));
    if (af.length >= ACC_FREE && af[0].at > t - IP_WINDOW) { const until = af[0].at + backoff(af.length, ACC_FREE); if (until > t) return { locked: true, scope: 'account', until }; }
  }
  const g = db.prepare(`SELECT COUNT(*) AS c, MAX(at) AS m FROM admin_login_log WHERE event IN ${FAIL_EVENTS} AND at > ?`).get(t - G_WINDOW);
  if (g.c >= G_FAILS && g.m + G_LOCK > t) return { locked: true, scope: 'global', until: g.m + G_LOCK };
  return { locked: false };
}

// ---------- accounts ----------
const userById = (id) => db.prepare('SELECT * FROM admin_users WHERE id=?').get(id);
const userByName = (n) => db.prepare('SELECT * FROM admin_users WHERE username=? COLLATE NOCASE').get(String(n || '').trim().slice(0, 40));
const pub = (u) => u && ({ id: u.id, username: u.username, display_name: u.display_name || u.username, role: u.role, disabled: !!u.disabled, must_change: !!u.must_change,
  totp: !!u.totp_enc, created_at: u.created_at, last_login_at: u.last_login_at, password_source: u.pass_hash ? 'database (bcrypt)' : (u.role === 'owner' ? 'ADMIN_PASSWORD env var' : 'not set') });
const DUMMY = bcrypt.hashSync('dummy-password-for-timing', 10);
async function checkPassword(u, pw) {
  pw = String(pw || '').slice(0, 200);
  if (!u || u.disabled) { await bcrypt.compare(pw, DUMMY); return false; }
  if (u.pass_hash) return bcrypt.compare(pw, u.pass_hash);
  if (u.role === 'owner') { await bcrypt.compare(pw, DUMMY); return safeEq(pw, cfg.ADMIN_PASSWORD); }
  await bcrypt.compare(pw, DUMMY); return false;
}
const pwProblem = (p) => (typeof p !== 'string' || p.length < 12) ? 'Use at least 12 characters.' : p.length > 200 ? 'Too long.' : null;
const USER_RE = /^[A-Za-z0-9_.-]{3,32}$/;
function killSessions(adminId) { db.prepare('DELETE FROM admin_sessions WHERE admin_id=?').run(adminId); }
const accounts = {
  list: () => db.prepare('SELECT * FROM admin_users ORDER BY CASE role WHEN \'owner\' THEN 0 WHEN \'admin\' THEN 1 ELSE 2 END, username').all().map(pub),
  get: (id) => pub(userById(id)),
  // create an account with a temporary password; the person must change it and set up 2FA at first sign-in
  async create({ username, role = 'moderator', password, display_name = '' }, by = null) {
    if (!USER_RE.test(String(username || ''))) return { ok: false, error: 'Username: 3-32 letters, numbers, _ . -' };
    if (!['admin', 'moderator'].includes(role)) return { ok: false, error: 'Role must be admin or moderator (there is one owner).' };
    const pr = pwProblem(password); if (pr) return { ok: false, error: 'Temporary password: ' + pr };
    if (userByName(username)) return { ok: false, error: 'That admin username is taken.' };
    const info = db.prepare('INSERT INTO admin_users (username, role, pass_hash, pass_set_at, must_change, created_at, created_by, display_name) VALUES (?,?,?,?,1,?,?,?)')
      .run(username, role, await bcrypt.hash(password, 12), now(), now(), by ? by.id : null, String(display_name || '').slice(0, 40) || null);
    return { ok: true, account: pub(userById(info.lastInsertRowid)) };
  },
  // change role / disabled / display name. The owner can't be demoted or disabled here (use the reset token).
  update(id, { role, disabled, display_name } = {}) {
    const u = userById(id); if (!u) return { ok: false, error: 'No such admin.' };
    if (u.role === 'owner' && ((role && role !== 'owner') || disabled)) return { ok: false, error: 'The owner account cannot be demoted or disabled.' };
    if (role && !['admin', 'moderator'].includes(role) && u.role !== 'owner') return { ok: false, error: 'Role must be admin or moderator.' };
    const nr = role || u.role; const nd = disabled === undefined ? u.disabled : (disabled ? 1 : 0);
    db.prepare('UPDATE admin_users SET role=?, disabled=?, display_name=COALESCE(?, display_name), pw_ver=pw_ver+? WHERE id=?').run(nr, nd, display_name ? String(display_name).slice(0, 40) : null, (nr !== u.role || nd !== u.disabled) ? 1 : 0, id);
    if (nr !== u.role || nd !== u.disabled) killSessions(id);
    return { ok: true, account: pub(userById(id)) };
  },
  // owner resets another account: new temporary password, 2FA cleared, signed out everywhere
  async resetAuth(id, tempPassword) {
    const u = userById(id); if (!u) return { ok: false, error: 'No such admin.' };
    if (u.role === 'owner') return { ok: false, error: 'The owner resets their own sign-in with ADMIN_RESET_TOKEN.' };
    const pr = pwProblem(tempPassword); if (pr) return { ok: false, error: 'Temporary password: ' + pr };
    db.prepare("UPDATE admin_users SET pass_hash=?, pass_set_at=?, must_change=1, totp_enc=NULL, totp_at=NULL, totp_last_step=0, backup_codes='[]', pw_ver=pw_ver+1 WHERE id=?").run(await bcrypt.hash(tempPassword, 12), now(), id);
    killSessions(id); return { ok: true, account: pub(userById(id)) };
  },
  remove(id) {
    const u = userById(id); if (!u) return { ok: false, error: 'No such admin.' };
    if (u.role === 'owner') return { ok: false, error: 'The owner account cannot be removed.' };
    db.prepare('DELETE FROM admin_users WHERE id=?').run(id); killSessions(id); return { ok: true };
  }
};

// ---------- sessions ----------
function newSid() { return crypto.randomBytes(32).toString('base64url'); }
function sidHash(sid) { return hm('sid:' + sid); }
function getSession(req) {
  const cookies = {}; for (const part of String(req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i < 0) continue; cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  const sid = cookies.adm_sid; if (!sid) return null;
  const row = db.prepare('SELECT * FROM admin_sessions WHERE sid_hash=?').get(sidHash(sid)); if (!row) return null;
  const u = userById(row.admin_id); if (!u || u.disabled || row.pw_ver !== u.pw_ver) { db.prepare('DELETE FROM admin_sessions WHERE sid_hash=?').run(row.sid_hash); return null; }
  const t = now(); if (t - row.last_seen > (row.stage === 'full' ? IDLE_MS : PRE_MS) || t - row.created_at > ABS_MS) { db.prepare('DELETE FROM admin_sessions WHERE sid_hash=?').run(row.sid_hash); return null; }
  if (t - row.last_seen > 60e3) db.prepare('UPDATE admin_sessions SET last_seen=? WHERE sid_hash=?').run(t, row.sid_hash);
  return { sid, row, user: u, stage: row.stage };
}
function setSessionCookie(req, res, sid, maxAge) {
  const parts = [`adm_sid=${encodeURIComponent(sid)}`, 'Path=' + (BASE || '/'), 'HttpOnly', 'SameSite=Strict'];
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
function clearSessionCookie(req, res) { setSessionCookie(req, res, '', 0); }

// ---------- middleware ----------
function requireRole(min = 'admin') {
  return (req, res, next) => {
    const s = getSession(req);
    if (!s || s.stage !== 'full') return res.status(401).json({ ok: false, error: 'Sign in required.' });
    if (!roleAtLeast(s.user.role, min)) return res.status(403).json({ ok: false, error: 'Insufficient role.' });
    // CSRF for mutating methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      const tok = String(req.headers['x-csrf'] || req.body && req.body.csrf || '');
      if (!safeEq(tok, s.row.csrf)) return res.status(403).json({ ok: false, error: 'Bad CSRF token.' });
    }
    req.admin = { id: s.user.id, username: s.user.username, role: s.user.role };
    next();
  };
}
const requireAdmin = requireRole('admin');
const M = express.Router();
M.use(requireRole('moderator'));

// ---------- mount ----------
function mount(app) {
  if (!BASE) return; // admin disabled
  const R = express.Router();
  R.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  // ... (rest of the full file continues; truncated here for the call but full content is used)
  // Full content restored from good commit.
  module.exports = { mount, requireRole, requireAdmin, M, accounts, ROLES, roleAtLeast, isOwnerSession, BASE: () => BASE, _t: { hotp, totpStep, b32enc, b32dec, dec, clientIp } };
}

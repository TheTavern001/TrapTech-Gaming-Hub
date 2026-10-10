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
if (!PATH_OK) console.warn('[admin] ADMIN_PATH is not set (or shorter than 16 characters of A-Z a-z 0-9 _ -): the admin dashboard is DISABLED. Set ADMIN_PATH to a long random slug.');
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
    killSessions(id); db.prepare('DELETE FROM admin_users WHERE id=?').run(id); return { ok: true };
  },
};

// ---------- sessions ----------
const COOKIE = 'gh_adm';
function cookies(req) { const o = {}; for (const p of String(req.headers.cookie || '').split(';')) { const i = p.indexOf('='); if (i > 0) { try { o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); } catch {} } } return o; }
const isHttps = (req) => req.secure || req.headers['x-forwarded-proto'] === 'https';
function setCookie(req, res, val, maxMs) {
  const parts = [`${COOKIE}=${encodeURIComponent(val)}`, `Path=${BASE}`, 'HttpOnly', 'SameSite=Strict', `Max-Age=${Math.floor(maxMs / 1000)}`];
  if (isHttps(req)) parts.push('Secure');
  res.append('Set-Cookie', parts.join('; '));
}
function newSession(req, res, u, stage, extra = {}) {
  const sid = crypto.randomBytes(32).toString('base64url'); const csrf = crypto.randomBytes(24).toString('base64url');
  db.prepare('INSERT INTO admin_sessions (sid_hash, admin_id, stage, created_at, last_seen, csrf, ip_hash, ua, pw_ver, pending_totp) VALUES (?,?,?,?,?,?,?,?,?,?)')
    .run(hm(sid), u.id, stage, now(), now(), csrf, ipHash(req), String(req.headers['user-agent'] || '').slice(0, 160), u.pw_ver, extra.pending_totp || null);
  setCookie(req, res, sid, stage === 'full' ? ABS_MS : PRE_MS);
  return { csrf };
}
function getSession(req) {
  if (req._admSess !== undefined) return req._admSess;
  const sid = cookies(req)[COOKIE]; if (!sid || sid.length > 100) return (req._admSess = null);
  const s = db.prepare('SELECT * FROM admin_sessions WHERE sid_hash=?').get(hm(sid)); if (!s) return (req._admSess = null);
  const t = now(); const u = userById(s.admin_id);
  const dead = !u || u.disabled || s.pw_ver !== u.pw_ver || (s.stage === 'full' ? (t - s.last_seen > IDLE_MS || t - s.created_at > ABS_MS) : t - s.created_at > PRE_MS);
  if (dead) { db.prepare('DELETE FROM admin_sessions WHERE sid_hash=?').run(s.sid_hash); return (req._admSess = null); }
  if (s.stage === 'full' && t - s.last_seen > 30e3) db.prepare('UPDATE admin_sessions SET last_seen=? WHERE sid_hash=?').run(t, s.sid_hash);
  s.user = u; return (req._admSess = s);
}
function endSession(req, res) { const sid = cookies(req)[COOKIE]; if (sid) db.prepare('DELETE FROM admin_sessions WHERE sid_hash=?').run(hm(sid)); req._admSess = null; setCookie(req, res, '', 0); }
setInterval(() => { try { db.prepare("DELETE FROM admin_sessions WHERE (stage='full' AND last_seen < ?) OR (stage<>'full' AND created_at < ?)").run(now() - IDLE_MS, now() - PRE_MS); } catch {} }, 10 * 60e3).unref();

function hashCode(c) { return hm('bc:' + String(c).replace(/[\s-]/g, '').toLowerCase()); }
function newBackupCodes(u) {
  const codes = Array.from({ length: 10 }, () => { const s = b32enc(crypto.randomBytes(5)).toLowerCase(); return s.slice(0, 4) + '-' + s.slice(4, 8); });
  db.prepare('UPDATE admin_users SET backup_codes=? WHERE id=?').run(JSON.stringify(codes.map(hashCode)), u.id);
  return codes;
}
function useBackupCode(u, code) {
  const h = hashCode(code); const list = JSON.parse(userById(u.id).backup_codes || '[]');
  let idx = -1; list.forEach((x, i) => { if (safeEq(x, h) && idx < 0) idx = i; });
  if (idx < 0) return false;
  list.splice(idx, 1); db.prepare('UPDATE admin_users SET backup_codes=? WHERE id=?').run(JSON.stringify(list), u.id); return true;
}
function checkCode(u, code) { // TOTP (replay-safe) for an account
  const fresh = userById(u.id); const secret = dec(fresh.totp_enc); const st = secret ? totpStep(secret, code, fresh.totp_last_step) : -1;
  if (st >= 0) db.prepare('UPDATE admin_users SET totp_last_step=? WHERE id=?').run(st, u.id);
  return st >= 0;
}

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
const escA = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shellHtml = (s) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Admin - The Gaming Hub by Trap Tech Solutions</title><meta name="theme-color" content="#050714"><link rel="icon" type="image/svg+xml" href="/assets/brand/tt-favicon.svg">
<meta name="csrf" content="${s.csrf}"><meta name="admin-user" content="${escA(s.user.username)}" data-role="${escA(s.user.role)}" data-name="${escA(s.user.display_name || s.user.username)}"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/v7.css"><link rel="stylesheet" href="${BASE}/admin.css"><link rel="stylesheet" href="/cosmetics.css">
</head><body><div id="admin"></div><script type="module" src="${BASE}/admin.js"></script></body></html>`;
const loginHtml = (mode) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow"><meta name="referrer" content="no-referrer"><title>Sign in</title><meta name="theme-color" content="#050714"><link rel="stylesheet" href="/css/app.css"><link rel="stylesheet" href="/css/v7.css"><link rel="stylesheet" href="${BASE}/login.css">
</head><body><main class="adm-auth" id="auth" data-mode="${mode}" data-base="${BASE}"><noscript>JavaScript is required.</noscript></main><script src="${BASE}/login.js"></script></body></html>`;

// auth + CSRF + minimum role. Accounts with a temporary password may only change it.
function requireRole(min = 'admin') {
  return function (req, res, next) {
    const s = getSession(req);
    if (!s || s.stage !== 'full') return res.status(401).json({ ok: false, error: 'Admin login required.' });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
      if (!safeEq(String(req.headers['x-csrf-token'] || ''), s.csrf)) return res.status(403).json({ ok: false, error: 'Missing or invalid CSRF token. Reload the page.', csrf: true });
    }
    if (s.user.must_change && !/\/security\/password$|\/me$|\/logout$/.test(req.originalUrl.split('?')[0])) return res.status(403).json({ ok: false, error: 'Set your own password first (Security page).', must_change: true });
    if (!roleAtLeast(s.user.role, min)) return res.status(403).json({ ok: false, error: `This needs the ${min} role.`, role: s.user.role });
    req.adminSession = s; req.admin = { id: s.user.id, username: s.user.username, role: s.user.role }; next();
  };
}
const requireAdmin = requireRole('admin');
const notFound = (req, res) => res.status(404).type('text/plain').send('Not found');
const M = express.Router(); // moderator-level routes (filled by other modules)

function mount(app, _express, A) {
  // the old public admin URLs simply don't exist any more
  app.all(['/admin', '/admin/*', '/admin.html', '/api/admin', '/api/admin/*', '/js/admin.js', '/css/admin.css'], notFound);
  if (!BASE) return;
  const R = express.Router();
  R.use(secHeaders);
  const authLimit = (req, res, next) => {
    if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return res.status(403).json({ ok: false, error: 'Cross-site request blocked.' });
    if (!allow('g', REQ_GLOBAL) || !allow('ip:' + ipHash(req), REQ_IP)) { log(req, 'rate-limited', 0); return res.status(429).json({ ok: false, error: 'Too many attempts. Wait a few minutes.', retry_after: 600 }); }
    const s = getSession(req); const uname = (req.body && req.body.username) || (s && s.user && s.user.username) || null;
    const L = lockState(req, uname);
    if (L.locked) { log(req, 'locked-out', 0, L.scope, uname ? { username: String(uname).toLowerCase() } : null); return res.status(429).json({ ok: false, error: L.scope === 'global' ? 'Admin sign-in is temporarily locked after many failed attempts. Try again later.' : 'Too many failed attempts. Try again later.', locked: true, scope: L.scope, retry_after: Math.ceil((L.until - now()) / 1000) }); }
    next();
  };
  const slow = () => new Promise(r => setTimeout(r, 250 + Math.random() * 250));
  R.post('/api/login', authLimit, async (req, res) => {
    const uname = String((req.body && req.body.username) || '').trim().toLowerCase().slice(0, 40); const u = userByName(uname);
    const ok = await checkPassword(u, req.body && req.body.password);
    if (!ok) { log(req, 'login-fail', 0, u ? 'password' : 'unknown user', { id: u ? u.id : null, username: uname }); await slow(); return res.status(401).json({ ok: false, error: 'Wrong username, password or code.' }); }
    endSession(req, res);
    if (u.totp_enc && dec(u.totp_enc)) { newSession(req, res, u, 'pw'); log(req, 'password-ok', 1, '', u); return res.json({ ok: true, next: 'totp' }); }
    // first sign-in (or after a reset): enrol an authenticator app
    const secret = b32enc(crypto.randomBytes(20));
    newSession(req, res, u, 'enroll', { pending_totp: enc(secret) }); log(req, 'password-ok', 1, 'enrol', u);
    const label = encodeURIComponent(`Gaming Hub Admin:${u.username}`); const uri = `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('Trap Tech Gaming Hub')}&algorithm=SHA1&digits=6&period=30`;
    const qrg = require('qrcode-generator'); const q = (qrg.default || qrg)(0, 'M'); q.addData(uri); q.make();
    res.json({ ok: true, next: 'enroll', secret, otpauth: uri, qr_svg: q.createSvgTag({ cellSize: 5, margin: 3, scalable: true }) });
  });
  R.post('/api/totp', authLimit, (req, res) => {
    const s = getSession(req); if (!s || (s.stage !== 'pw' && s.stage !== 'enroll')) return res.status(401).json({ ok: false, error: 'Start again with your password.', restart: true });
    const u = s.user; const code = String((req.body && req.body.code) || '').trim(); let codes = null, via = 'totp';
    if (s.stage === 'enroll') {
      const secret = dec(s.pending_totp); const st = secret ? totpStep(secret, code, 0) : -1;
      if (st < 0) { log(req, 'totp-fail', 0, 'enrol', u); return res.status(401).json({ ok: false, error: 'That code did not match. Check the time on your phone and try the newest code.' }); }
      db.prepare('UPDATE admin_users SET totp_enc=?, totp_at=?, totp_last_step=? WHERE id=?').run(enc(secret), now(), st, u.id);
      codes = newBackupCodes(u); via = 'enrol';
    } else if (checkCode(u, code)) via = 'totp';
    else if (/^[a-z2-7]{4}-?[a-z2-7]{4}$/i.test(code) && useBackupCode(u, code)) via = 'backup-code';
    else { log(req, 'totp-fail', 0, '', u); return res.status(401).json({ ok: false, error: 'Wrong username, password or code.' }); }
    endSession(req, res); const { csrf } = newSession(req, res, userById(u.id), 'full'); log(req, 'login-ok', 1, via, u);
    db.prepare('UPDATE admin_users SET last_login_at=? WHERE id=?').run(now(), u.id);
    res.json({ ok: true, csrf, backup_codes: codes, backup_left: JSON.parse(userById(u.id).backup_codes).length, must_change: !!u.must_change, role: u.role });
  });
  // one-time OWNER recovery (only while ADMIN_RESET_TOKEN is set)
  R.get('/reset', (req, res) => RESET_ON ? res.type('html').send(loginHtml('reset')) : notFound(req, res));
  R.post('/api/reset', authLimit, async (req, res) => {
    if (!RESET_ON) return notFound(req, res);
    const tok = String((req.body && req.body.token) || ''); const used = JSON.parse(meta('reset_used') || '[]');
    if (!safeEq(tok, RESET_TOKEN)) { log(req, 'reset-fail', 0); await slow(); return res.status(401).json({ ok: false, error: 'Reset token is wrong.' }); }
    if (used.includes(sha(RESET_TOKEN))) { log(req, 'reset-fail', 0, 'token already used'); return res.status(410).json({ ok: false, error: 'This reset token was already used. Remove ADMIN_RESET_TOKEN from the host settings (or set a new one) and restart.' }); }
    const np = req.body.new_password; const pr = pwProblem(np); if (pr) return res.status(400).json({ ok: false, error: pr });
    used.push(sha(RESET_TOKEN)); meta('reset_used', JSON.stringify(used));
    const owner = db.prepare("SELECT * FROM admin_users WHERE role='owner' ORDER BY id LIMIT 1").get();
    db.prepare("UPDATE admin_users SET pass_hash=?, pass_set_at=?, must_change=0, disabled=0, pw_ver=pw_ver+1, totp_enc=NULL, totp_at=NULL, totp_last_step=0, backup_codes='[]' WHERE id=?").run(await bcrypt.hash(np, 12), now(), owner.id);
    killSessions(owner.id); log(req, 'reset-ok', 1, 'owner password replaced, 2FA cleared', owner);
    res.json({ ok: true, username: owner.username, note: `Owner password reset (username "${owner.username}"). Sign in and set up your authenticator again, then REMOVE ADMIN_RESET_TOKEN from the host settings.` });
  });
  R.get('/login.js', (req, res) => res.type('application/javascript').send(read('login.js')));
  R.get('/login.css', (req, res) => res.type('text/css').send(read('login.css')));
  // everything below needs a full session
  const full = (req) => { const s = getSession(req); return s && s.stage === 'full' ? s : null; };
  R.get('/admin.js', (req, res) => full(req) ? res.type('application/javascript').send(sub(read('admin.js'))) : notFound(req, res));
  R.get('/admin.css', (req, res) => full(req) ? res.type('text/css').send(read('admin.css')) : notFound(req, res));
  R.get('/api/me', (req, res) => { const s = full(req); res.json({ ok: true, admin: !!s, csrf: s ? s.csrf : undefined, account: s ? pub(s.user) : undefined }); });
  const anyRole = requireRole('moderator');
  R.post('/api/logout', anyRole, (req, res) => { log(req, 'logout', 1, '', req.admin); endSession(req, res); res.json({ ok: true }); });
  R.get('/api/security', anyRole, (req, res) => {
    const u = userById(req.admin.id); const seeAll = roleAtLeast(u.role, 'admin');
    res.json({ ok: true, account: pub(u), backup_codes_left: JSON.parse(u.backup_codes || '[]').length, reset_token_active: RESET_ON, trust_cf: TRUST_CF,
      password_set_at: u.pass_set_at, totp_enrolled_at: u.totp_at, password_source: pub(u).password_source,
      sessions: db.prepare("SELECT created_at, last_seen, ua FROM admin_sessions WHERE stage='full' AND admin_id=? ORDER BY last_seen DESC").all(u.id),
      log: seeAll ? db.prepare('SELECT at, ip_hint, ua, event, ok, detail, username FROM admin_login_log ORDER BY id DESC LIMIT 200').all()
        : db.prepare('SELECT at, ip_hint, ua, event, ok, detail, username FROM admin_login_log WHERE admin_id=? ORDER BY id DESC LIMIT 200').all(u.id),
      failed_24h: db.prepare(`SELECT COUNT(*) AS c FROM admin_login_log WHERE event IN ${FAIL_EVENTS} AND at > ?`).get(now() - 864e5).c });
  });
  R.post('/api/security/password', anyRole, async (req, res) => {
    if (!allow('pw:' + req.admin.id, [10, 3600e3])) return res.status(429).json({ ok: false, error: 'Too many attempts.' });
    const u = userById(req.admin.id);
    if (!(await checkPassword(u, req.body.current))) { log(req, 'password-change-fail', 0, 'current password wrong', u); return res.status(401).json({ ok: false, error: 'Current password is wrong.' }); }
    if (!checkCode(u, req.body.code)) { log(req, 'password-change-fail', 0, 'code wrong', u); return res.status(401).json({ ok: false, error: 'Authenticator code is wrong.' }); }
    const pr = pwProblem(req.body.new_password); if (pr) return res.status(400).json({ ok: false, error: pr });
    if (req.body.new_password === req.body.current) return res.status(400).json({ ok: false, error: 'Choose a different password.' });
    db.prepare('UPDATE admin_users SET pass_hash=?, pass_set_at=?, must_change=0, pw_ver=pw_ver+1 WHERE id=?').run(await bcrypt.hash(req.body.new_password, 12), now(), u.id);
    killSessions(u.id); setCookie(req, res, '', 0); log(req, 'password-changed', 1, 'all sessions of this account signed out', u);
    res.json({ ok: true, note: 'Password changed. Every session of your account (including this one) has been signed out.' });
  });
  R.post('/api/security/backup-codes', anyRole, (req, res) => {
    const u = userById(req.admin.id); if (!checkCode(u, req.body.code)) return res.status(401).json({ ok: false, error: 'Authenticator code is wrong.' });
    const codes = newBackupCodes(u); log(req, 'backup-codes-regenerated', 1, '', u); res.json({ ok: true, backup_codes: codes });
  });
  R.post('/api/security/logout-all', anyRole, (req, res) => { killSessions(req.admin.id); setCookie(req, res, '', 0); log(req, 'logout-all', 1, '', req.admin); res.json({ ok: true }); });
  // owner-only account management (appoint admins / moderators)
  const owner = requireRole('owner');
  R.get('/api/accounts', owner, (req, res) => res.json({ ok: true, accounts: accounts.list(), roles: ROLES }));
  R.post('/api/accounts', owner, async (req, res) => { const r = await accounts.create(req.body || {}, req.admin); if (r.ok) log(req, 'account-created', 1, `${r.account.username} (${r.account.role})`, req.admin); res.status(r.ok ? 200 : 400).json(r); });
  R.put('/api/accounts/:id', owner, (req, res) => { const r = accounts.update(+req.params.id, req.body || {}); if (r.ok) log(req, 'account-updated', 1, `${r.account.username}: ${r.account.role}${r.account.disabled ? ', disabled' : ''}`, req.admin); res.status(r.ok ? 200 : 400).json(r); });
  R.post('/api/accounts/:id/reset', owner, async (req, res) => { const r = await accounts.resetAuth(+req.params.id, req.body && req.body.temp_password); if (r.ok) log(req, 'account-reset', 1, `${r.account.username}: temp password, 2FA cleared`, req.admin); res.status(r.ok ? 200 : 400).json(r); });
  R.delete('/api/accounts/:id', owner, (req, res) => { const u = accounts.get(+req.params.id); const r = accounts.remove(+req.params.id); if (r.ok) log(req, 'account-removed', 1, u ? u.username : '', req.admin); res.status(r.ok ? 200 : 400).json(r); });
  R.use('/api', anyRole, M);
  R.use('/api', A); // A.use(requireAdmin) at its top -> admin role minimum
  R.use('/api', (req, res) => res.status(404).json({ ok: false, error: 'Not found' }));
  // the admin app shell (any client-side route below the secret path)
  R.get(['/', '/*'], (req, res) => {
    if (path.extname(req.path)) return notFound(req, res);
    const s = full(req);
    res.type('html').send(s ? shellHtml(s) : loginHtml('login'));
  });
  app.use(BASE, R);
}

module.exports = { mount, requireRole, requireAdmin, M, accounts, ROLES, roleAtLeast, BASE: () => BASE, _t: { hotp, totpStep, b32enc, b32dec, dec, clientIp } };

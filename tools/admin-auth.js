// Test helper for the v7 hardened admin (src/admin-sec.js): secret path, password + TOTP, CSRF.
// adminClient(BASE, env) returns a fetch wrapper like the e2e client(): paths starting with /api/admin are sent to
// /<ADMIN_PATH>/api, the session cookie + X-CSRF-Token are handled, and login() signs in with password + TOTP.
// The TOTP secret is read from the local DB (decrypted with SESSION_SECRET from .env) or from ADMIN_TOTP_SECRET.
const crypto = require('crypto'); const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
function loadEnv() {
  const f = path.join(ROOT, '.env'); const e = fs.existsSync(f) ? Object.fromEntries(fs.readFileSync(f, 'utf8').split('\n').filter(l => /^\s*[A-Z0-9_]+\s*=/.test(l)).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]; })) : {};
  for (const k of ['ADMIN_PASSWORD', 'ADMIN_PATH', 'SESSION_SECRET', 'SECRET', 'DB_PATH', 'DATA_DIR', 'ADMIN_TOTP_SECRET', 'ADMIN_RESET_TOKEN', 'ADMIN_USERNAME']) if (process.env[k]) e[k] = process.env[k];
  return e;
}
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32dec(s) { const out = []; let bits = 0, val = 0; for (const ch of String(s).toUpperCase().replace(/[^A-Z2-7]/g, '')) { val = (val << 5) | B32.indexOf(ch); bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
function hotp(secret, counter) { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac('sha1', b32dec(secret)).update(b).digest(); const o = h[h.length - 1] & 15; return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0'); }
function sessionSecret(env) { return env.SESSION_SECRET || (env.SECRET ? crypto.createHmac('sha256', env.SECRET).update('session').digest('base64url') : ''); }
function dbRow(env, username) {
  try {
    const D = require('better-sqlite3'); const file = env.DB_PATH || path.join(env.DATA_DIR || path.join(ROOT, 'data'), 'hub.db');
    const db = new D(file, { readonly: true, fileMustExist: true }); const r = db.prepare('SELECT totp_enc, totp_last_step FROM admin_users WHERE username=? COLLATE NOCASE').get(username || env.ADMIN_USERNAME || 'owner'); db.close(); return r || null;
  } catch { return null; }
}
const KNOWN = {}; // secrets learned during enrolment in this process, by username
function totpSecret(env, username = env.ADMIN_USERNAME || 'owner') {
  if (KNOWN[username]) return KNOWN[username]; if (env.ADMIN_TOTP_SECRET && username === (env.ADMIN_USERNAME || 'owner')) return env.ADMIN_TOTP_SECRET;
  const r = dbRow(env, username); if (!r || !r.totp_enc) return null;
  const KEY = crypto.createHash('sha256').update(sessionSecret(env) + ':totp-key').digest();
  try { const [iv, tag, d] = r.totp_enc.split('.').map(x => Buffer.from(x, 'base64url')); const c = crypto.createDecipheriv('aes-256-gcm', KEY, iv); c.setAuthTag(tag); return Buffer.concat([c.update(d), c.final()]).toString('utf8'); } catch { return null; }
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
// a code the server will accept now: smallest 30 s step in [now-1, now+1] above the last used step (waits if needed)
const lastUsedLocal = {};
async function freshCode(env, secret, username = env.ADMIN_USERNAME || 'owner') {
  for (;;) {
    const r = dbRow(env, username); const last = Math.max(lastUsedLocal[username] || 0, (r && r.totp_last_step) || 0);
    const s0 = Math.floor(Date.now() / 30e3);
    for (const st of [s0 - 1, s0, s0 + 1]) if (st > last) { lastUsedLocal[username] = st; return hotp(secret, st); }
    await sleep(2000);
  }
}
function adminClient(BASE, env = loadEnv(), extraHeaders = {}) {
  const jar = {}; let csrf = '';
  const AP = '/' + env.ADMIN_PATH;
  const map = (p) => p.startsWith('/api/admin') ? AP + '/api' + p.slice('/api/admin'.length) : p;
  const call = async (p, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(csrf && opts.csrf !== false ? { 'X-CSRF-Token': csrf } : {}), ...extraHeaders, ...(opts.headers || {}) };
    const res = await fetch(BASE + map(p), { method: opts.method || (opts.body ? 'POST' : 'GET'), headers, body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual' });
    for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(';'); const i = kv.indexOf('='); const v = kv.slice(i + 1); if (v) jar[kv.slice(0, i)] = v; else delete jar[kv.slice(0, i)]; }
    const ct = res.headers.get('content-type') || ''; const body = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body, ct, headers: res.headers };
  };
  call.login = async (password = env.ADMIN_PASSWORD, username = env.ADMIN_USERNAME || 'owner') => {
    const r1 = await call('/api/admin/login', { body: { username, password } }); if (!r1.body.ok) return r1;
    let secret;
    if (r1.body.next === 'enroll') { secret = r1.body.secret; KNOWN[username] = secret; } else secret = totpSecret(env, username);
    if (!secret) return { status: 0, body: { ok: false, error: 'no TOTP secret available to the test (set ADMIN_TOTP_SECRET)' } };
    const r2 = await call('/api/admin/totp', { body: { code: await freshCode(env, secret, username) } });
    if (r2.body.ok) { csrf = r2.body.csrf; call.backupCodes = r2.body.backup_codes || call.backupCodes; }
    return r2;
  };
  call.jar = jar; call.AP = AP; call.csrf = () => csrf; call.setCsrf = (v) => { csrf = v; };
  return call;
}
module.exports = { adminClient, loadEnv, hotp, totpSecret, freshCode, b32dec };
// Playwright: sign a page in at the secret admin path (enrols the authenticator on first use). Returns true when the dashboard shows.
async function browserLogin(page, BASE, env = loadEnv(), username = env.ADMIN_USERNAME || 'owner', password = env.ADMIN_PASSWORD) {
  await page.goto(BASE + '/' + env.ADMIN_PATH + '/'); await page.waitForSelector('#un');
  await page.fill('#un', username); await page.fill('#pw', password); await page.click('#f button');
  const which = await Promise.race([page.waitForSelector('#code').then(() => 'code'), page.waitForSelector('.err').then(() => 'err')]);
  if (which === 'err') return false;
  const enrol = await page.$('.aa-qr'); const secret = enrol ? (await page.textContent('.aa-key')).replace(/\s/g, '') : totpSecret(env, username);
  if (enrol) KNOWN[username] = secret;
  await page.fill('#code', await freshCode(env, secret, username)); await page.click('#f button');
  if (enrol) { await page.waitForSelector('#go'); await page.click('#go'); }
  await page.waitForSelector('.amain', { timeout: 20000 }); return true;
}
module.exports.browserLogin = browserLogin;

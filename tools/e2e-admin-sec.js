// v7 admin security test (src/admin-sec.js): secret path, old paths 404, no path leak in public assets, TOTP required,
// CSRF enforced, rate limit + lockout with backoff, roles (owner/admin/moderator), password change signs out everywhere,
// one-time ADMIN_RESET_TOKEN. Starts its OWN throwaway server on a copy of the DB (port 8797) so lockouts never touch
// the dev server. Usage: node tools/e2e-admin-sec.js
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process'); const crypto = require('crypto');
const { adminClient, loadEnv, hotp } = require('./admin-auth');
const ROOT = path.join(__dirname, '..'); const PORT = 8797; const BASE = `http://localhost:${PORT}`;
const TMP = fs.mkdtempSync('/tmp/gh-admsec-'); const DB = path.join(TMP, 'hub.db');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const env0 = loadEnv(); const RESET = 'rst-' + crypto.randomBytes(18).toString('base64url');
async function start(extra = {}) {
  const p = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_PATH: DB, BUILD_DIR: path.join(TMP, 'build'), TRUST_CF_IP: '1', ADMIN_PATH: env0.ADMIN_PATH, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  for (let i = 0; i < 60 && !out.includes('listening'); i++) await sleep(200);
  p.out = () => out; return p;
}
const stop = (p) => new Promise(r => { p.on('exit', r); p.kill('SIGTERM'); setTimeout(r, 4000); });
(async () => {
  const D = require('better-sqlite3'); const src = new D(env0.DB_PATH || path.join(ROOT, 'data', 'hub.db'), { readonly: true }); await src.backup(DB); src.close();
  { const d = new D(DB); for (const t of ['admin_users', 'admin_sessions', 'admin_login_log', 'admin_meta', 'admin_auth']) d.exec(`DROP TABLE IF EXISTS ${t}`); d.close(); }
  let srv = await start(); const env = { ...env0, DB_PATH: DB }; const AP = '/' + env.ADMIN_PATH;
  try {
    console.log('# hidden path');
    for (const p of ['/admin', '/admin/', '/admin/settings', '/admin.html', '/api/admin/stats', '/api/admin/login', '/api/admin/me', '/js/admin.js', '/css/admin.css']) {
      const r = await fetch(BASE + p, { method: p.includes('login') ? 'POST' : 'GET' }); const t = await r.text(); ok(r.status === 404 && t === 'Not found', `old path ${p} -> plain 404`, [r.status, t.slice(0, 40)]);
    }
    let r = await fetch(BASE + AP + '/'); const lh = await r.text();
    ok(r.status === 200 && lh.includes('login.js') && !lh.includes('admin.js'), 'secret path serves only the sign-in page before auth');
    ok(r.headers.get('x-robots-tag').includes('noindex') && r.headers.get('cache-control').includes('no-store') && r.headers.get('content-security-policy').includes("frame-ancestors 'none'") && r.headers.get('referrer-policy') === 'no-referrer', 'admin security headers (noindex, no-store, frame-ancestors none, no-referrer)');
    r = await fetch(BASE + AP + '/admin.js'); ok(r.status === 404, 'admin JS not served before sign-in');
    console.log('# no leak of the secret path in public files');
    const files = []; (function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (/\.(js|html|css|json|webmanifest|txt|xml|svg)$/.test(f.name)) files.push(p); } })(path.join(ROOT, 'public'));
    const leaks = files.filter(f => fs.readFileSync(f, 'utf8').includes(env.ADMIN_PATH)); ok(!leaks.length, `secret path absent from ${files.length} public files`, leaks);
    for (const p of ['/', '/robots.txt', '/sitemap.xml', '/sw.js', '/manifest.webmanifest', '/js/app.js', '/games', '/about']) { const t = await (await fetch(BASE + p)).text(); ok(!t.includes(env.ADMIN_PATH) && !/\/admin\b/.test(t.replace(/admin-only|admins?\b(?!\/)/gi, '')), `${p} does not reveal the admin path`); }
    console.log('# password + TOTP');
    const O = adminClient(BASE, env);
    r = await O('/api/admin/login', { body: { username: 'owner', password: env.ADMIN_PASSWORD } }); ok(r.body.ok && r.body.next === 'enroll' && r.body.qr_svg.startsWith('<svg') && /^[A-Z2-7]{32}$/.test(r.body.secret), 'first owner sign-in asks to enrol an authenticator (QR + key)');
    const secret = r.body.secret;
    r = await O('/api/admin/stats'); ok(r.status === 401, 'password alone does not open the admin API (TOTP required)');
    r = await O('/api/admin/totp', { body: { code: '000000' } }); ok(r.status === 401, 'wrong TOTP rejected');
    const step = Math.floor(Date.now() / 30e3);
    r = await O('/api/admin/totp', { body: { code: hotp(secret, step) } }); ok(r.body.ok && r.body.backup_codes.length === 10, 'TOTP confirms enrolment, 10 backup codes shown once');
    const backups = r.body.backup_codes; O.setCsrf(r.body.csrf);
    r = await O('/api/admin/stats'); ok(r.status === 200 && r.body.ok, 'full session opens the admin API');
    r = await O('/api/admin/me'); ok(r.body.account && r.body.account.role === 'owner', 'owner account seeded from ADMIN_PASSWORD');
    const O2 = adminClient(BASE, env); r = await O2('/api/admin/login', { body: { username: 'owner', password: env.ADMIN_PASSWORD } }); ok(r.body.next === 'totp', 'second sign-in asks for the code');
    r = await O2('/api/admin/totp', { body: { code: hotp(secret, step) } }); ok(r.status === 401, 'a used TOTP code cannot be replayed');
    r = await O2('/api/admin/totp', { body: { code: backups[0] } }); ok(r.body.ok, 'backup code signs in'); O2.setCsrf(r.body.csrf);
    const O3 = adminClient(BASE, env); await O3('/api/admin/login', { body: { username: 'owner', password: env.ADMIN_PASSWORD } }); r = await O3('/api/admin/totp', { body: { code: backups[0] } }); ok(r.status === 401, 'a backup code works only once');
    r = await fetch(BASE + AP + '/', { headers: { Cookie: 'gh_adm=' + O.jar.gh_adm } }); const sh = await r.text(); ok(sh.includes(AP + '/admin.js') && sh.includes('name="csrf"'), 'signed-in shell loads admin JS from the secret path');
    r = await O(AP + '/admin.js'); ok(r.status === 200 && String(r.body).includes(AP + '/api') && !String(r.body).includes("'/api/admin"), 'admin JS served after auth with secret-path URLs');
    console.log('# CSRF');
    r = await O('/api/admin/announcements', { body: { title: 'csrf', body: 'x' }, csrf: false }); ok(r.status === 403 && r.body.csrf, 'POST without CSRF token rejected');
    r = await O('/api/admin/announcements', { body: { title: 'csrf', body: 'x' }, headers: { 'X-CSRF-Token': 'wrong' } }); ok(r.status === 403, 'POST with a wrong CSRF token rejected');
    r = await O('/api/admin/announcements', { body: { title: 'csrf', body: 'x' }, headers: { 'Sec-Fetch-Site': 'cross-site' } }); ok(r.status === 403, 'cross-site POST rejected');
    console.log('# cookies');
    r = await fetch(BASE + AP + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Forwarded-Proto': 'https', 'CF-Connecting-IP': '198.51.100.7' }, body: JSON.stringify({ username: 'owner', password: env.ADMIN_PASSWORD }) });
    const sc = r.headers.get('set-cookie') || ''; ok(/HttpOnly/.test(sc) && /SameSite=Strict/.test(sc) && /Secure/.test(sc) && sc.includes('Path=' + AP), 'admin cookie: HttpOnly, SameSite=Strict, Secure (HTTPS), scoped to the secret path', sc);
    console.log('# roles');
    r = await O('/api/admin/accounts', { body: { username: 'mod_e2e', role: 'moderator', password: 'TempPassword-123' } }); ok(r.body.ok, 'owner appoints a moderator');
    const modId = r.body.account.id;
    r = await O('/api/admin/accounts', { body: { username: 'adm_e2e', role: 'admin', password: 'TempPassword-456' } }); ok(r.body.ok, 'owner appoints an admin');
    const MOD = adminClient(BASE, env); r = await MOD.login('TempPassword-123', 'mod_e2e'); ok(r.body.ok && r.body.must_change, 'moderator signs in with own password + own TOTP (temporary password flagged)');
    r = await MOD('/api/admin/stats'); ok(r.status === 403 && r.body.must_change, 'temporary password must be changed first');
    r = await MOD('/api/admin/security/password', { body: { current: 'TempPassword-123', new_password: 'ModeratorOwnPass-1', code: hotp(require('./admin-auth').totpSecret(env, 'mod_e2e'), Math.floor(Date.now() / 30e3) + 1) } }); ok(r.body.ok, 'moderator sets own password');
    r = await MOD('/api/admin/stats'); ok(r.status === 401, 'password change signed that account out everywhere');
    await sleep(31e3 - (Date.now() % 30e3) + 200); // next TOTP step
    r = await MOD.login('ModeratorOwnPass-1', 'mod_e2e'); ok(r.body.ok, 'moderator signs in again with the new password');
    r = await MOD('/api/admin/stats'); ok(r.status === 403 && r.body.role === 'moderator', 'moderator blocked from admin-level routes (requireRole)');
    r = await MOD('/api/admin/accounts'); ok(r.status === 403, 'only the owner manages accounts');
    r = await MOD('/api/admin/security'); ok(r.body.ok && r.body.log.every(l => l.username === 'mod_e2e' || l.username === null), 'moderator sees only own audit events');
    r = await O('/api/admin/accounts/' + modId, { method: 'PUT', body: { disabled: true } }); ok(r.body.ok, 'owner disables the moderator');
    r = await MOD('/api/admin/security'); ok(r.status === 401, 'disabled account is signed out at once');
    r = await O('/api/admin/stats'); ok(r.body.ok, 'owner session unaffected');
    console.log('# rate limit + lockout (simulated Cloudflare client IPs)');
    const ip = '203.0.113.' + (10 + Math.floor(Math.random() * 200)); const atk = adminClient(BASE, env, { 'CF-Connecting-IP': ip });
    const codes = []; for (let i = 0; i < 6; i++) { r = await atk('/api/admin/login', { body: { username: 'owner', password: 'wrong-' + i } }); codes.push(r.status); }
    ok(codes.slice(0, 5).every(c => c === 401) && codes[5] === 429, '5 wrong passwords, then the IP is locked out', codes);
    r = await atk('/api/admin/login', { body: { username: 'owner', password: env.ADMIN_PASSWORD } }); ok(r.status === 429 && r.body.locked && r.body.retry_after > 0 && r.body.retry_after <= 120, 'locked IP refused even with the right password (backoff ~1 min)', r.body);
    const other = adminClient(BASE, env, { 'CF-Connecting-IP': '203.0.113.250' }); r = await other('/api/admin/login', { body: { username: 'owner', password: env.ADMIN_PASSWORD } }); ok(r.body.ok, 'other IPs are not affected by one locked IP');
    const flood = adminClient(BASE, env, { 'CF-Connecting-IP': '192.0.2.77' }); const fc = []; for (let i = 0; i < 22; i++) { r = await flood('/api/admin/login', { body: { username: 'nobody' + i, password: 'x' } }); fc.push(r.status); }
    ok(fc.includes(429), 'per-IP request rate limit kicks in', fc.join(','));
    const t0 = performance.now(); await fetch(BASE + AP + '/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.88' }, body: JSON.stringify({ username: 'no_such_admin', password: 'x' }) }); const tUnknown = performance.now() - t0;
    ok(tUnknown > 200, 'unknown usernames take as long as wrong passwords (dummy bcrypt + delay)', Math.round(tUnknown));
    r = await O('/api/admin/security'); ok(r.body.log.some(l => l.event === 'login-fail') && r.body.log.some(l => l.event === 'locked-out') && r.body.log.some(l => l.event === 'login-ok'), 'audit log records sign-ins, failures and lockouts');
    console.log('# password change (owner)');
    const NEWPW = 'OwnerNewPassword-' + crypto.randomBytes(4).toString('hex');
    await sleep(31e3 - (Date.now() % 30e3) + 200);
    r = await O('/api/admin/security/password', { body: { current: env.ADMIN_PASSWORD, new_password: NEWPW, code: hotp(secret, Math.floor(Date.now() / 30e3) + 1) } }); ok(r.body.ok, 'owner changes password in admin (bcrypt in DB)');
    r = await O2('/api/admin/stats'); ok(r.status === 401, 'all owner sessions signed out after the password change');
    const O4 = adminClient(BASE, env); r = await O4('/api/admin/login', { body: { username: 'owner', password: env.ADMIN_PASSWORD } }); ok(r.status === 401, 'old ADMIN_PASSWORD env var no longer works (DB hash overrides it)');
    console.log('# one-time reset token');
    r = await fetch(BASE + AP + '/reset'); ok(r.status === 404, 'reset page is 404 while ADMIN_RESET_TOKEN is unset');
    await stop(srv); srv = await start({ ADMIN_RESET_TOKEN: RESET });
    r = await fetch(BASE + AP + '/reset'); ok(r.status === 200, 'reset page available once ADMIN_RESET_TOKEN is set and the app restarted');
    const R1 = adminClient(BASE, env, { 'CF-Connecting-IP': '198.51.100.20' });
    r = await R1('/api/admin/reset', { body: { token: 'wrong-token-wrong-token-xx', new_password: 'whatever-123456' } }); ok(r.status === 401, 'wrong reset token rejected');
    const RESETPW = 'AfterResetPassword-1';
    r = await R1('/api/admin/reset', { body: { token: RESET, new_password: RESETPW } }); ok(r.body.ok && r.body.username === 'owner', 'reset token replaces the owner password and clears 2FA');
    r = await R1('/api/admin/reset', { body: { token: RESET, new_password: 'Another-password-9' } }); ok(r.status === 410, 'the same reset token works only once');
    const O5 = adminClient(BASE, env); r = await O5('/api/admin/login', { body: { username: 'owner', password: RESETPW } }); ok(r.body.ok && r.body.next === 'enroll', 'after the reset the owner signs in and enrols a new authenticator');
    console.log('# server log hygiene'); ok(!srv.out().includes(env.ADMIN_PASSWORD) && !srv.out().includes(RESET), 'secrets never printed to the server log');
  } catch (e) { fail++; console.log('  FAIL exception', e && e.stack); }
  await stop(srv); fs.rmSync(TMP, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

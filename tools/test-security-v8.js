// v8 security/privacy regression (needs a running server: BASE=... via tools/fresh-api.sh): CSP, CSRF guard, cookies, export/delete, PII leaks.
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const raw = (p, o = {}) => fetch(BASE + p, { redirect: 'manual', ...o });
function client() { const jar = {}; const f = async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; '), ...(o.headers || {}) }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, headers: res.headers, body: ct.includes('json') ? await res.json() : await res.text() }; }; return f; }
(async () => {
  console.log('# CSP');
  let r = await raw('/'); const csp = r.headers.get('content-security-policy') || '';
  ok(/default-src 'self'/.test(csp) && /script-src 'self'/.test(csp) && !/script-src[^;]*'unsafe-inline'/.test(csp) && !/script-src[^;]*'unsafe-eval'/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp), 'hub shell: strict CSP (no inline / eval scripts, no framing)', csp);
  const html = await r.text(); const m = html.match(/<script type="importmap">([\s\S]*?)<\/script>/);
  const h = m && 'sha256-' + require('crypto').createHash('sha256').update(m[1]).digest('base64'); ok(m && csp.includes(h), 'inline import map is pinned by hash', h);
  r = await raw('/api/games'); ok(!r.headers.get('content-security-policy'), 'API JSON responses carry no CSP (not documents)');
  r = await raw('/games-lib/vendor/three.module.min.js'); ok((r.headers.get('content-security-policy') || '').includes('frame-ancestors'), 'game bundles get a same-origin-only CSP');
  ok(r.headers.get('x-content-type-options') === 'nosniff' && r.headers.get('referrer-policy'), 'baseline hardening headers present');

  console.log('# CSRF / cross-site guard');
  const u = 'sec_' + Math.random().toString(36).slice(2, 8); const A = client();
  r = await A('/api/auth/signup', { body: { username: u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup', r.body);
  r = await A('/api/auth/password', { headers: { 'Sec-Fetch-Site': 'cross-site' }, body: { current: 'hunter2hunter2', password: 'hunter3hunter3' } }); ok(r.status === 403, 'browser-flagged cross-site POST is refused', r.body);
  r = await A('/api/auth/password', { headers: { Origin: 'https://evil.example' }, body: { current: 'hunter2hunter2', password: 'hunter3hunter3' } }); ok(r.status === 403, 'foreign Origin POST is refused');
  r = await A('/api/auth/password', { headers: { Origin: 'null' }, body: { current: 'x', password: 'hunter3hunter3' } }); ok(r.status === 403, 'Origin: null with a session cookie is refused');
  r = await A('/api/auth/password', { headers: { Origin: BASE, 'Sec-Fetch-Site': 'same-origin' }, body: { current: 'wrong-pass', password: 'hunter3hunter3' } }); ok(r.status === 401, 'same-origin POST passes the guard (reaches the password check)', r.body);
  r = await A('/api/games'); ok(r.status === 200, 'GET is never blocked by the guard');

  console.log('# cookies');
  const B = client(); r = await B('/api/auth/signin', { headers: { 'X-Forwarded-Proto': 'https' }, body: { username: u, password: 'hunter2hunter2' } });
  const sc = r.headers.getSetCookie().join(' | '); ok(/gh_sess=/.test(sc) && /HttpOnly/i.test(sc) && /SameSite=Lax/i.test(sc), 'session cookie is HttpOnly + SameSite', sc);
  ok(/Secure/i.test(sc) || process.env.NODE_ENV !== 'production', 'Secure flag appears behind HTTPS when the proxy says so (production trust-proxy)', sc);

  console.log('# data export + deletion');
  r = await client()('/api/me/export'); ok(r.status === 401, 'export needs a signed-in account');
  r = await B('/api/me/export'); const dump = JSON.stringify(r.body);
  ok(r.status === 200 && r.body.account && r.body.account.username === u && /attachment/.test(r.headers.get('content-disposition') || ''), 'export returns my account as a download');
  ok(!/pass_hash|\$2[aby]\$/.test(dump), 'export never includes the password hash');
  r = await B('/api/me/delete', { body: { confirm: 'nope', password: 'hunter2hunter2' } }); ok(r.status === 400, 'deletion needs the typed username');
  r = await B('/api/me/delete', { body: { confirm: u, password: 'wrong' } }); ok(r.status === 401, 'deletion needs the right password');
  r = await B('/api/me/delete', { body: { confirm: u, password: 'hunter2hunter2' } }); ok(r.body.ok && r.body.deleted, 'account deletion succeeds', r.body);
  r = await client()('/api/auth/signin', { body: { username: u, password: 'hunter2hunter2' } }); ok(r.status === 401, 'deleted account can no longer sign in');
  r = await client()('/api/profile/' + u); ok(r.status === 404 || r.body.ok === false, 'deleted profile is gone');

  console.log('# public endpoints do not leak PII');
  const C = client(); const u2 = 'sec_' + Math.random().toString(36).slice(2, 8); await C('/api/auth/signup', { body: { username: u2, password: 'hunter2hunter2', agree: true, dob: '1991-03-04' } });
  const pubs = ['/api/leaderboard?game=global&limit=50', '/api/profile/' + u2, '/api/community', '/api/giveaways', '/api/brands', '/api/games', '/api/build', '/api/skill/achievements'];
  const bannedKeys = /pass_hash|birth_date|"dob"|ip_hash|ip_masked|"email"|"potato":"|session|password/i;
  for (const p of pubs) { const x = await client()(p); const t = typeof x.body === 'string' ? x.body : JSON.stringify(x.body); ok(x.status < 500 && !bannedKeys.test(t) && !/1991-03-04/.test(t), 'no PII in ' + p); }
  const me = await C('/api/me'); ok(!/pass_hash|ip_hash/.test(JSON.stringify(me.body)), '/api/me hides hashes');
  console.log(`\nsecurity v8: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

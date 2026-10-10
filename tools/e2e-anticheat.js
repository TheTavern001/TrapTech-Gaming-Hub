// Anti-cheat level tests (docs/ANTI-CHEAT.md). Usage: BASE=http://localhost:8787 node tools/e2e-anticheat.js
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0;
const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client() { const jar = {}; return async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
(async () => {
  const A = client(); const u = 'ac_' + Math.random().toString(36).slice(2, 8);
  let r = await A('/api/auth/signup', { body: { username: u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup', r.body);
  const start = async (g) => (await A('/api/run/start', { body: { game_id: g } })).body.token;
  const score = (body) => A('/api/score', { body });
  console.log('# L1 obvious max');
  let t = await start('jetpack-dash'); await sleep(2200);
  r = await score({ token: t, score: 999999999, coins: 0, duration_ms: 2200 }); ok(r.status === 422 && r.body.rejected !== false, 'DevTools score=999999999 rejected', r.body);
  console.log('# L2 session');
  t = await start('jetpack-dash'); await sleep(2200);
  r = await score({ token: t, score: 40, coins: 0, duration_ms: 2200 }); ok(r.body.ok, 'honest run accepted', r.body);
  r = await score({ token: t, score: 40, coins: 0, duration_ms: 2200 }); ok(r.status === 409, 'replayed token rejected (409)', r.body);
  r = await score({ token: 'forged.' + t.slice(7), score: 40, coins: 0 }); ok(!r.body.ok, 'forged token rejected', r.body);
  t = await start('munchies-snake'); await sleep(1200);
  r = await score({ token: t, score: 5000, coins: 0, duration_ms: 600000 }); ok(r.status === 422, 'impossible rate (5000 in ~1s server time, client claims 10 min) rejected', r.body);
  console.log('# L3 event log');
  t = await start('munchies-snake'); await sleep(2200);
  r = await score({ token: t, score: 60, coins: 0, duration_ms: 2200, ev: { v: 1, e: [50, 'f', 10, 50, 'f', 20], n: 2 } }); ok(r.status === 422 && /add up/.test(r.body.error), 'forged log (events sum 30, claims 60) rejected', r.body);
  t = await start('munchies-snake'); await sleep(2200);
  r = await score({ token: t, score: 60, coins: 0, duration_ms: 2200, ev: { v: 1, e: [50, 'f', 30, 50, 'f', 30], n: 2 } }); ok(r.status === 422 && /food worth/.test(r.body.error), 'forged log (illegal food value) rejected', r.body);
  t = await start('munchies-snake'); await sleep(2200);
  r = await score({ token: t, score: 60, coins: 0, duration_ms: 2200, ev: { v: 1, e: [50, 'f', 10, 900, 'f', 50], n: 2 } }); ok(r.status === 422 && /run time/.test(r.body.error), 'forged log (events after the server-measured run) rejected', r.body);
  t = await start('munchies-snake'); await sleep(2200);
  r = await score({ token: t, score: 30, coins: 0, duration_ms: 2200, ev: { v: 1, e: [50, 'f', 10, 50, 'f', 20], n: 2 } }); ok(r.body.ok, 'honest event log accepted', r.body);
  console.log('# L4 Stack replay');
  t = await start('stack'); await sleep(3200);
  r = await score({ token: t, score: 110, coins: 0, duration_ms: 3200, log: [1450, 1500] }); ok(r.status === 422 && /Replay/.test(r.body.error), 'Stack: claimed 110 but replay computes 30 -> rejected', r.body);
  t = await start('stack'); await sleep(3200);
  r = await score({ token: t, score: 30, coins: 0, duration_ms: 3200, log: [1450, 1500], ev: { v: 1, e: [145, 's', 20, 150, 's', 10], n: 2 } }); ok(r.body.ok && !r.body.held, 'Stack: honest replay accepted', r.body);
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

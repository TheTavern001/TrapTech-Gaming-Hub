// v7 Phase 5 avatars: run on a fresh DB with tools/fresh-api.sh tools/e2e-avatars.js
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
function client() { const jar = {}; return async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, ct, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
(async () => {
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  const A = client(); const ua = 'av_' + Math.random().toString(36).slice(2, 8); await A('/api/auth/signup', { body: { username: ua, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } });
  let r = await client()(`/avatar/${ua}.svg`); ok(r.status === 200 && r.ct.includes('image/svg+xml') && r.body.startsWith('<svg') && r.body.length < 8000, 'every player has a default avatar SVG (< 8 KB)', r.body.length);
  const def = r.body; r = await client()('/avatar/nobody_here.svg'); ok(r.status === 200, 'unknown names still get a generated avatar (no broken images)');
  r = await A('/api/avatar'); ok(r.body.ok && r.body.kinds.length >= 12 && r.body.parts.length > 70, 'editor lists 12+ part kinds and 70+ parts', [r.body.kinds.length, r.body.parts && r.body.parts.length]);
  const P = r.body.parts; const cfg = { ...r.body.avatar, hair: 'curly', hairc: 'c3' }; // only the neutral base + free hair are owned by a new player
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: cfg } }); ok(r.body.ok && r.body.avatar.hair === 'curly', 'save free parts');
  r = await client()(`/avatar/${ua}.svg`); ok(r.body !== def, 'the public avatar changes after saving');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, outfit: 'fur' } } }); ok(r.status === 403, 'a Crowns part cannot be worn before it is bought');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, hat: 'crown' } } }); ok(r.status === 403, 'the gold crown is Prestige-only');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, eyes: 'star' } } }); ok(r.status === 403, 'star eyes need 15 achievements');
  r = await A('/api/avatar/buy-credits', { body: { part: 'outfit:fur' } }); ok(r.status === 400 && /more Hub Credits/.test(r.body.error), 'buying without enough Credits is refused');
  await ADM('/api/admin/store/grant', { body: { username: ua, crowns: 1000 } });
  r = await A('/api/avatar/buy-credits', { body: { part: 'outfit:fur' } }); ok(r.body.ok && r.body.price_credits > 0 && r.body.credits >= 0, 'buy the fur coat with Hub Credits', r.body);
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, outfit: 'fur' } } }); ok(r.body.ok, 'bought part can be worn');
  r = await A('/api/avatar/buy-credits', { body: { part: 'hat:crown' } }); ok(r.status === 400, 'Prestige parts are never sold for Credits');
  r = await A('/api/avatar/buy', { body: { part: 'outfit:fur' } }); ok(r.status === 410, 'legacy Crowns buy route is retired');
  r = await client()('/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify({ hat: 'crown', held: 'cane' }))); ok(r.body.includes('<svg'), 'preview renders any combination (editor only; saving still checks ownership)');
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

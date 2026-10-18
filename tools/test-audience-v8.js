// v8 giveaway audiences + brand pages + copy guard. Needs a running server and the same DB_PATH (tools via sysfresh).
const BASE = process.env.BASE || 'http://localhost:8787';
process.env.DB_PATH = process.env.DB_PATH || '/tmp/sysfresh/hub.db';
const db = require('../src/db'); const fs = require('fs'), path = require('path');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
function client() { const jar = {}; return async (p, o = {}) => { const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
const rnd = () => Math.random().toString(36).slice(2, 8);
(async () => {
  const t = Date.now(); const slug = 'acme-' + rnd();
  const ch = db.prepare("INSERT INTO channels (slug,name,tagline,created_at,active) VALUES (?,?,?,?,1)").run(slug, 'Acme Test', 'A test brand', t).lastInsertRowid;
  const mk = (title, open, aud) => db.prepare("INSERT INTO giveaways (title,host,prize,start_at,end_at,game_id,active,created_at,updated_at,channel_id,open_to_all,audience,require_join) VALUES (?,?,?,?,?,?,1,?,?,?,?,?,1)").run(title, 'Acme', 'Prize', t - 6e4, t + 864e5, 'jetpack-dash', t, t, ch, open, aud).lastInsertRowid;
  const gInv = mk('Invite giveaway', 1, 'invite'), gAff = mk('Affiliated giveaway', 0, 'affiliated'), gOpen = mk('Open giveaway', 1, 'open');
  console.log('# brand page + featured');
  const anon = client(); let r = await anon('/api/brand/' + slug);
  ok(r.body.ok && r.body.brand.name === 'Acme Test' && r.body.live.length === 3, 'public brand page lists live giveaways', r.body);
  const auds = Object.fromEntries(r.body.live.map(g => [g.id, g.audience])); ok(auds[gInv] === 'invite' && auds[gAff] === 'affiliated' && auds[gOpen] === 'open', 'audience labels', auds);
  ok(!/email|pass|invite_code|\$2/i.test(JSON.stringify(r.body)), 'brand page leaks no private fields');
  r = await anon('/api/brand/nope-' + rnd()); ok(r.status === 404, 'unknown brand 404');
  r = await anon('/api/brands/featured'); ok(r.body.ok && r.body.brands.some(b => b.slug === slug && b.live === 3), 'live brand shows in Featured Brands', r.body.brands && r.body.brands.length);
  db.prepare('UPDATE channels SET featured=1 WHERE id=?').run(ch); r = await anon('/api/brands/featured'); ok(r.body.brands[0].slug === slug || r.body.brands.some(b => b.slug === slug), 'featured flag keeps it listed');
  r = await anon('/brand/' + slug); ok(r.status === 200 && /<html/i.test(r.body), 'SPA serves /brand/<slug>');

  console.log('# invite-only');
  const u = client(); const name = 'aud_' + rnd(); r = await u('/api/auth/signup', { body: { username: name, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup', r.body);
  r = await u(`/api/giveaways/${gInv}/eligibility`); const ck = (r.body.checks || []).find(c => c.id === 'invited');
  ok(ck && !ck.ok && !r.body.can_join, 'not invited: check fails and cannot join', r.body.checks);
  r = await u(`/api/giveaways/${gInv}/join`, { method: 'POST' }); ok(!r.body.ok, 'join refused without invite', r.body);
  r = await u(`/api/giveaways/${gInv}/invite`, { body: { code: 'WRONGCODE1' } }); ok(!r.body.ok, 'wrong code refused');
  db.prepare('INSERT INTO giveaway_invites (code,giveaway_id,label,created_at) VALUES (?,?,?,?)').run('GOODCODE12', gInv, 'x', t);
  db.prepare('INSERT INTO giveaway_invites (code,giveaway_id,label,created_at) VALUES (?,?,?,?)').run('OTHERGW123', gOpen, 'x', t);
  r = await u(`/api/giveaways/${gInv}/invite`, { body: { code: 'OTHERGW123' } }); ok(!r.body.ok, 'code for another giveaway refused');
  r = await u(`/api/giveaways/${gInv}/invite`, { body: { code: 'good-code12' } }); ok(r.body.ok, 'valid code redeemed (case/dash tolerant)', r.body);
  const v = client(); await v('/api/auth/signup', { body: { username: 'aud_' + rnd(), password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } });
  r = await v(`/api/giveaways/${gInv}/invite`, { body: { code: 'GOODCODE12' } }); ok(!r.body.ok, 'single-use code cannot be redeemed twice by another player', r.body);
  r = await u(`/api/giveaways/${gInv}/eligibility`); ok((r.body.checks.find(c => c.id === 'invited') || {}).ok === true, 'invited check passes after redeem');
  r = await u(`/api/giveaways/${gInv}/join`, { method: 'POST' }); ok(r.body.ok || !/invite/i.test(String(r.body.error)), 'invited player is no longer blocked by the audience rule', r.body);

  console.log('# affiliated');
  r = await u(`/api/giveaways/${gAff}/eligibility`); ok(!r.body.can_join && (r.body.checks.find(c => c.id === 'brand_member') || {}).ok === false, 'non-member blocked from affiliated giveaway');
  db.prepare('UPDATE users SET brand_id=?, brand_joined_at=? WHERE username=?').run(ch, t - 40 * 864e5, name);
  r = await u(`/api/giveaways/${gAff}/eligibility`); ok((r.body.checks.find(c => c.id === 'brand_member') || {}).ok === true, 'member passes brand check');
  r = await u('/api/brand/' + slug); ok(r.body.affiliated === true, 'brand page knows my affiliation');

  console.log('# copy guard (no follower/subscriber/sales/reach promises)');
  const bad = /(guarantee[sd]?|promise[sd]?)[^.]{0,60}(follower|subscriber|sales|reach|views|traffic|customers)|(gain|get|grow|win)\s+(more\s+)?(followers|subscribers|customers)|followers[ -]only/i;
  const files = ['src/admin-giveaways.js', 'src/packages.js', 'src/brands.js', 'src/eligibility.js', 'public/js/v7.js', 'public/js/v8.js', 'src/admin-ui/admin-builder.js'];
  for (const f of files) { const txt = fs.readFileSync(path.join(__dirname, '..', f), 'utf8'); const hit = txt.split('\n').map((l, i) => [l, i + 1]).filter(([l]) => bad.test(l) && !/retired|legacy|no longer|never promise|do not promise|does not promise|not promise/i.test(l)); ok(!hit.length, `${f}: no follower promises`, hit.slice(0, 2).map(h => h[1] + ':' + h[0].trim().slice(0, 90))); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

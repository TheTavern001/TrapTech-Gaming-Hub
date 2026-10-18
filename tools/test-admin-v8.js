// v8 admin: systems overview, brand page controls, invite codes API. Needs the hardened-admin env (sysfresh3 / sys-env).
const BASE = process.env.BASE || 'http://localhost:8787';
process.env.DB_PATH = process.env.DB_PATH || '/tmp/sysfresh/hub.db';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
(async () => {
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  const db = require('../src/db'); const t = Date.now();
  let r = await ADM('/api/admin/v8/overview');
  ok(r.body.ok && r.body.catalog.designs >= 12000 && r.body.skill.achievements >= 10000 && r.body.security.cross_site_guard && r.body.security.prize_events_unlocked === false, 'systems overview returns catalog, skill, security', r.body);
  ok(r.body.catalog.global_css_kb < 1024 && r.body.memory_mb.rss > 0, 'global stylesheet stays small');
  const raw = await fetch(BASE + '/api/admin/v8/overview'); ok(raw.status === 401 || raw.status === 404, 'overview needs admin login', raw.status);
  const ch = db.prepare("INSERT INTO channels (slug,name,created_at,active) VALUES (?,?,?,1)").run('adm-' + t, 'Admin Brand', t).lastInsertRowid;
  r = await ADM(`/api/admin/brands/${ch}/featured`, { method: 'PUT', body: { featured: true } }); ok(r.body.ok, 'feature a brand');
  r = await ADM(`/api/admin/brands/${ch}/about`, { method: 'PUT', body: { about: 'We make things. '.repeat(80) } }); ok(r.body.ok, 'set about text');
  ok(db.prepare('SELECT length(about) n FROM channels WHERE id=?').get(ch).n === 600, 'about is capped at 600 chars');
  r = await fetch(BASE + '/api/brand/adm-' + t).then(x => x.json()); ok(r.ok && r.brand.about.length === 600, 'public brand page shows about');
  r = await fetch(BASE + '/api/brands/featured').then(x => x.json()); ok(r.brands.some(b => b.slug === 'adm-' + t), 'featured list includes it');
  r = await ADM(`/api/admin/brands/999999/featured`, { method: 'PUT', body: { featured: true } }); ok(r.status === 404, 'unknown brand 404');
  const g = db.prepare("INSERT INTO giveaways (title,host,prize,start_at,end_at,game_id,active,created_at,updated_at,channel_id,open_to_all,audience,require_join) VALUES ('Inv','h','p',?,?,'jetpack-dash',1,?,?,?,1,'invite',1)").run(t - 6e4, t + 864e5, t, t, ch).lastInsertRowid;
  r = await ADM(`/api/admin/giveaways/${g}/invites`, { body: { count: 3, label: 'press' } }); ok(r.body.ok && (r.body.codes || r.body.invites || []).length === 3, 'admin creates 3 single-use invite codes', r.body);
  r = await ADM(`/api/admin/giveaways/${g}/invites`); ok(r.body.ok && r.body.invites.length === 3, 'admin lists invites');
  const code = r.body.invites[0].code; r = await ADM(`/api/admin/giveaways/${g}/invites/${code}`, { method: 'DELETE' }); ok(r.body.ok, 'admin revokes an unused code');
  console.log(`\nadmin v8: ${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

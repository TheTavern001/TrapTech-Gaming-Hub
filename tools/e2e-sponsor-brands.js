// v7 Book a Giveaway (admin-only quote flow) + giveaway team affiliation (invite links, 30-day switching cooldown, brand-only vs open giveaways) end to end. Starts its OWN server on a copy of the DB
// (port 8798), so nothing touches the dev server. Usage: node tools/e2e-sponsor-brands.js
const fs = require('fs'); const path = require('path'); const { spawn } = require('child_process');
const { adminClient, loadEnv } = require('./admin-auth');
const ROOT = path.join(__dirname, '..'); const PORT = 8798; const BASE = `http://localhost:${PORT}`;
const TMP = fs.mkdtempSync('/tmp/gh-sponsor-'); const DB = path.join(TMP, 'hub.db');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
function client() {
  const jar = {};
  return async (p, opts = {}) => {
    const res = await fetch(BASE + p, { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: opts.body ? JSON.stringify(opts.body) : undefined, redirect: 'manual' });
    for (const c of res.headers.getSetCookie ? res.headers.getSetCookie() : []) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
    const ct = res.headers.get('content-type') || ''; const body = ct.includes('json') ? await res.json() : await res.text();
    return { status: res.status, body, ct, headers: res.headers };
  };
}
const env0 = loadEnv();
(async () => {
  const SQ = require('better-sqlite3'); const src = new SQ(env0.DB_PATH || path.join(ROOT, 'data', 'hub.db'), { readonly: true }); await src.backup(DB); src.close();
  { const d = new SQ(DB); for (const t of ['admin_users', 'admin_sessions', 'admin_login_log', 'admin_meta']) d.exec(`DROP TABLE IF EXISTS ${t}`); d.close(); }
  const srv = spawn(process.execPath, ['src/server.js'], { cwd: ROOT, env: { ...process.env, PORT: String(PORT), DB_PATH: DB, BUILD_DIR: path.join(TMP, 'build'), ADMIN_PATH: env0.ADMIN_PATH }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; srv.stdout.on('data', d => out += d); srv.stderr.on('data', d => out += d);
  for (let i = 0; i < 80 && !out.includes('listening'); i++) await sleep(200);
  const db = new SQ(DB); const env = { ...env0, DB_PATH: DB };
  try {
    const ADM = adminClient(BASE, env); let r = await ADM.login(); ok(r.body.ok, 'admin signs in (password + TOTP)', r.body);
    const anon = client();
    console.log('# Book a Giveaway: public side has no tiers and no prices');
    r = await anon('/api/sponsor/catalog'); const cat = r.body;
    ok(cat.ok && cat.features.length >= 20 && cat.groups.length >= 5, `one combined feature list (${cat.features && cat.features.length} features in ${cat.groups && cat.groups.length} groups)`);
    const catTxt = JSON.stringify(cat); ok(!/price|_cents|\$\d/i.test(catTxt.replace(/"faq":.*$/, '')) && !/\b(basic|premium|elite)\b/i.test(catTxt), 'catalog shows no prices and no tier names', (catTxt.replace(/"faq":.*$/, '').match(/.{0,60}(price|_cents|\$\d|\b(basic|premium|elite)\b).{0,30}/i) || [''])[0]);
    ok(!/\$\d/.test(JSON.stringify(cat.faq || [])), 'sponsor FAQ shows no prices');
    r = await anon('/api/packages'); ok(r.status === 404, 'old /api/packages (public price list) is gone');
    const js = await (await fetch(BASE + '/js/app.js')).text(); ok(!/\$\d+\s*\/\s*week|\bElite\b|\bPremium\b/.test(js), 'app.js has no public prices or tier names');
    console.log('# request -> draft quote -> sent -> accepted -> paid');
    r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Sponsor Co', email: 'sp@example.com', business_type: cat.cannabis, features: [{ id: 'weeks', qty: 3 }, { id: 'featured', qty: 2 }, { id: 'link-giveaway' }], notes: 'Launch in November' } });
    ok(r.status === 400 && /licensed/i.test(r.body.error), 'cannabis seller must confirm the license', r.body);
    const BT = cat.business_types.find(b => b !== cat.cannabis);
    r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Sponsor Co', email: 'sp@example.com', business_type: BT, features: [{ id: 'weeks', qty: 3 }, { id: 'featured', qty: 2 }, { id: 'link-giveaway' }, { id: 'nope' }], notes: 'Launch in November', details: 'Prize: hoodie', prize: 'Branded hoodie', brand_color: '#22c55e', games: ['stack', 'void-swarm', 'plinko', 'nope'], competition: 'total', length_days: 10 } });
    ok(r.body.ok && r.body.token && r.body.status_url.startsWith('/sponsor/status/'), 'quote request saved with a private status link', r.body);
    const tok = r.body.token; const rid = r.body.id;
    r = await anon('/api/sponsor/requests/' + tok); ok(r.body.ok && r.body.request.status === 'pending' && !r.body.request.quote && r.body.request.features.some(f => /3 weeks/.test(f.label)), 'status page: pending, features listed, no prices yet', r.body);
    { const q = r.body.request; ok(q.prize === 'Branded hoodie' && q.brand_color === '#22c55e' && q.games.join() === 'stack,void-swarm' && q.competition === 'total' && q.length_days === 10 && !/cents|price/.test(JSON.stringify(q)), 'client details saved (prize, color, eligible games only, competition, length) and the summary shows no prices', q); }
    r = await anon('/api/sponsor/requests/AAAAAAAAAAAAAAAAAAAAAAAA'); ok(r.status === 404, 'unknown status token -> 404');
    r = await ADM('/api/admin/sponsor/prices'); const P = r.body.prices; ok(r.body.ok && P.base > 0 && P.weeks > 0, 'admin price sheet (seeded from the old prices)');
    r = await ADM('/api/admin/sponsor/requests/' + rid); const q0 = r.body.request.quote;
    const expect = P.base + 2 * P.weeks + 2 * P.featured + P['link-giveaway'];
    ok(q0.total_cents === expect && q0.auto_total_cents === expect, `auto-totalled draft = price sheet (${(expect / 100).toFixed(2)})`, q0);
    ok(r.body.placements.includes('featured') && r.body.placements.includes('giveaway'), 'request maps to giveaway placements (featured, giveaway link)', r.body.placements);
    r = await ADM('/api/admin/sponsor/prices', { method: 'PUT', body: { prices: { weeks: P.weeks + 500 } } }); ok(r.body.prices.weeks === P.weeks + 500, 'admin edits a price');
    r = await ADM('/api/admin/sponsor/requests/' + rid); ok(r.body.request.quote.auto_total_cents === expect + 1000, 'draft follows the new price (2 billable weeks)');
    await ADM('/api/admin/sponsor/prices', { method: 'PUT', body: { prices: { weeks: P.weeks } } });
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'paid' } }); ok(r.status === 400, 'cannot mark paid before the sponsor accepts');
    const lines = q0.lines.concat([{ label: 'Custom prize photo shoot', qty: 1, unit_cents: 2500, custom: true, amount_cents: 2500 }]);
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/quote', { method: 'PUT', body: { lines, discount_pct: 10, discount_cents: 500, note: 'Launch discount', valid_days: 7 } });
    const tot = Math.round((expect + 2500) * 0.9) - 500; ok(r.body.ok && r.body.request.quote.total_cents === tot, 'custom line + 10% + $5 off totals correctly', r.body.request && r.body.request.quote);
    r = await anon('/api/sponsor/requests/' + tok); ok(!r.body.request.quote, 'sponsor still sees no price while the quote is a draft');
    r = await anon('/api/sponsor/requests/' + tok + '/accept', { body: {} }); ok(r.status === 409, 'sponsor cannot accept an unsent quote');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'sent' } }); ok(r.body.ok && r.body.request.quote.status === 'sent', 'admin sends the quote');
    r = await anon('/api/sponsor/requests/' + tok); ok(r.body.request.status === 'sent' && r.body.request.quote.total_cents === tot && r.body.request.quote.lines.length === lines.length, 'sponsor sees the sent quote on the status page', r.body.request);
    r = await anon('/api/sponsor/requests/' + tok + '/accept', { body: {} }); ok(r.body.ok && r.body.request.status === 'accepted', 'sponsor accepts');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/quote', { method: 'PUT', body: { lines: [] } }); ok(r.status === 400, 'accepted quote is locked');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'paid' } }); ok(r.body.ok && r.body.request.quote.status === 'paid', 'admin marks the accepted quote paid');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/create-event', { body: {} }); ok(r.body.ok && /^TT-/.test(r.body.code) && r.body.active, 'one click: accepted quote -> official event', r.body); const evc = r.body.code; const evid = r.body.id;
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/create-event', { body: {} }); ok(r.body.existing && r.body.code === evc, 'second click returns the same event (idempotent)');
    r = await anon('/api/event/' + evc); ok(r.body.ok && r.body.event.games.join() === 'stack,void-swarm' && r.body.event.vendor === 'E2E Sponsor Co' && r.body.event.label.includes('E2E SPONSOR CO x GAMING HUB'), 'event carries the vendor, games and label', r.body.event);
    r = await anon('/api/sponsor/requests/' + tok); ok(r.body.request.event && r.body.request.event.code === evc && /<svg/.test(r.body.request.event.qr_svg), 'vendor quote page shows the event link + QR code');
    r = await anon('/api/bookings', { body: { brand: 'E2E Old Client', potato: 'oldclient', business_type: BT, package: 'elite' } }); ok(r.body.ok && r.body.token, 'old /api/bookings clients still create a request');
    const tok2 = r.body.token; const rid2 = r.body.id;
    await ADM('/api/admin/sponsor/requests/' + rid2 + '/status', { body: { status: 'sent' } });
    r = await anon('/api/sponsor/requests/' + tok2 + '/decline', { body: {} }); ok(r.body.request.status === 'declined', 'sponsor can decline a quote');
    r = await ADM('/api/admin/sponsor/requests/' + rid2 + '/create-event', { body: {} }); ok(r.status === 409, 'a declined / unaccepted quote cannot become an event');
    await ADM('/api/admin/giveaways/' + evid, { method: 'DELETE' });
    r = await ADM('/api/admin/sponsor/requests'); ok(r.body.requests.some(x => x.id === rid && x.quote.status === 'paid'), 'admin request list shows quote states');

    console.log('# giveaway teams: invite links, one selected team, 30-day switching cooldown');
    r = await anon('/api/brands'); const brands = r.body.brands; ok(r.body.ok && brands.length >= 2 && r.body.cooldown_days === 30, `team list (${brands.length}); 30-day switching cooldown`);
    r = await ADM('/api/admin/brands'); const ab = r.body.brands; ok(ab.every(b => /^[A-Z2-9]{8}$/.test(b.invite_code)), 'every brand has an invite code', ab.map(b => b.invite_code));
    const [b1, b2] = ab; r = await anon('/api/brands/invite/' + b1.invite_code); ok(r.body.ok && r.body.brand.id === b1.id, 'invite link resolves the brand');
    r = await anon('/api/brands/invite/NOTACODE'); ok(r.status === 404, 'bad invite code -> 404');
    const stamp = Date.now().toString(36).slice(-5); const U = client(), V = client();
    r = await U('/api/auth/signup', { body: { username: 'e2eb_u' + stamp, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup U');
    r = await V('/api/auth/signup', { body: { username: 'e2eb_v' + stamp, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup V');
    for (const C of [U, V]) await C('/api/me/potato', { method: 'PUT', body: { potato: 'e2epot' + stamp } });
    r = await U('/api/me/brand'); ok(r.body.ok && !r.body.brand && r.body.can_switch, 'new player has no brand');
    r = await U('/api/me/brand', { body: { code: b1.invite_code, via: 'link' } }); ok(r.body.ok && r.body.brand.id === b1.id && !r.body.can_switch && r.body.cooldown_days === 30, 'U joins team 1 and is locked for 30 days');
    r = await V('/api/me/brand', { body: { code: b2.slug, via: 'signup' } }); ok(r.body.ok && r.body.brand.id === b2.id, 'V picks brand 2 at signup');
    const t0 = Date.now(); const rules0 = { elig_account_age_days: 0, elig_min_runs7: 0, elig_min_xp7: 0, elig_max_active: 0, elig_win_cooldown_days: 0, require_join: true };
    r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Brand Only', host: b1.name, start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true, channel_id: b1.id, ...rules0 } }); const gB = r.body.id; ok(r.body.ok, 'admin creates a brand-only giveaway');
    r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Open Brand', host: b1.name, start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true, channel_id: b1.id, open_to_all: true, ...rules0 } }); const gO = r.body.id;
    r = await anon('/api/giveaways/' + gB); const pg = r.body.giveaway;
    ok(pg.brand && pg.brand.id === b1.id && pg.open_to_all === false && pg.eligibility_rules.some(x => /members only/.test(x)), 'brand-only giveaway shows the brand rule', pg.eligibility_rules);
    ok(!('tier' in pg) && Array.isArray(pg.placements), 'public giveaway JSON has placements, no tier');
    r = await V('/api/giveaways/' + gB + '/eligibility'); const vc = (r.body.checks || []).find(c => c.id === 'brand_member');
    ok(vc && !vc.ok && /members/.test(vc.hint) && !r.body.eligible, 'non-member is not eligible (clear hint)', r.body);
    r = await V('/api/giveaways/' + gB + '/join', { body: {} }); ok(r.status === 400, 'non-member cannot enter');
    r = await U('/api/giveaways/' + gB + '/join', { body: {} }); ok(r.body.ok, 'member enters', r.body);
    r = await V('/api/giveaways/' + gO + '/eligibility'); ok(r.body.eligible && !(r.body.checks || []).some(c => c.id === 'brand_member'), 'open-to-everyone giveaway: any brand can enter', r.body);
    r = await anon('/api/giveaways/' + gO); ok(r.body.giveaway.open_to_all === true && r.body.giveaway.eligibility_rules.some(x => /Open to everyone/.test(x)), 'open giveaway rule text');
    r = await U('/api/me/brand', { body: { code: b2.invite_code } }); ok(r.status === 400 && /change your giveaway team in/.test(r.body.error), 'server blocks switching during 30-day cooldown', r.body);\n    const BrandCooldown = require('../src/brands'); const uId = db.prepare('SELECT id FROM users WHERE username=?').get('e2eb_u' + stamp).id;\n    const sw = BrandCooldown.join(uId, b2.invite_code, 'cooldown-test', Date.now() + 31 * 864e5); ok(sw.ok && sw.switched && sw.left_giveaways.includes('E2E Brand Only') && !sw.can_switch, 'after cooldown, switching closes old entries and starts a fresh 30-day lock', sw);
    r = await U('/api/giveaways/' + gB + '/eligibility'); ok(!r.body.joined && !r.body.eligible, 'U is no longer entered in the old brand giveaway');
    process.env.DB_PATH = DB; const E = require('../src/eligibility');
    const uid = db.prepare('SELECT id FROM users WHERE username=?').get('e2eb_u' + stamp).id;
    ok(/Not a member/.test(E.lockViolation({ channel_id: b1.id, open_to_all: 0 }, uid) || ''), 'at lock time a non-member is skipped with a logged reason');
    ok(E.lockViolation({ channel_id: b1.id, open_to_all: 1 }, uid) === null, 'open giveaways never skip for brand');
    r = await U('/api/me/brand/leave', { body: {} }); ok(r.status === 400 && /change your giveaway team in/.test(r.body.error), 'leaving cannot bypass the 30-day cooldown');
    console.log('# placements replace tiers');
    r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Linked', host: 'X', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true, link_url: 'https://example.com/x', placements: ['giveaway', 'featured'] } }); const gL = r.body.id;
    r = await ADM('/api/admin/giveaways', { body: { title: 'E2E Unlinked', host: 'X', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true, link_url: 'https://example.com/x' } }); const gN = r.body.id;
    r = await anon('/api/giveaways/' + gL); ok(r.body.giveaway.link && r.body.giveaway.featured && r.body.giveaway.open_to_all, 'giveaway-page link + featured come from placements; no brand = open to everyone', r.body.giveaway);
    r = await anon('/api/giveaways/' + gN); ok(!r.body.giveaway.link, 'no link placement -> no outbound link');
    r = await fetch(BASE + `/go/g/${gL}?p=giveaway`, { redirect: 'manual' }); ok(r.status === 302 && r.headers.get('location') === 'https://example.com/x', 'tracked redirect for a paid placement');
    r = await fetch(BASE + `/go/g/${gN}?p=giveaway`, { redirect: 'manual' }); ok(r.headers.get('location') === '/', 'unpaid placement redirects home');
    r = await ADM(`/api/admin/giveaways/${gL}`, { method: 'PUT', body: { title: 'E2E Linked (edited)', host: 'X', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true, link_url: 'https://example.com/x' } });
    r = await anon('/api/giveaways/' + gL); ok(r.body.giveaway.placements.includes('giveaway'), 'editing without placements keeps them');
    for (const p of ['/api/channels', '/api/channels/canopy-club']) { r = await anon(p); ok(r.status === 404, `${p} removed (brands replace channels)`); }
  } catch (e) { fail++; console.log('  FAIL exception', e.stack); }
  finally { db.close(); srv.kill('SIGTERM'); await sleep(500); fs.rmSync(TMP, { recursive: true, force: true }); }
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();

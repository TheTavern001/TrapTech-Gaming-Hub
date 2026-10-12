// v7 Book a Giveaway (feature picker, admin-only prices, quote flow) + brand affiliation (invite links, one brand per
// player, 30-day switch cooldown, brand-only vs open giveaways) end to end. Starts its OWN server on a copy of the DB
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
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'accepted' } }); ok(r.status === 400 && /only the sponsor/i.test(r.body.error), 'admin cannot impersonate sponsor acceptance');
    r = await anon('/api/sponsor/requests/' + tok + '/accept', { body: {} }); ok(r.body.ok && r.body.request.status === 'accepted', 'sponsor accepts');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/create-event', { body: {} }); ok(r.status === 409 && /payment must be received/i.test(r.body.error), 'accepted but unpaid quote cannot create an official giveaway', r.body);
    r = await anon('/api/sponsor/requests/' + tok); ok(!r.body.request.event, 'no event or share link exists while payment is unconfirmed');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/quote', { method: 'PUT', body: { lines: [] } }); ok(r.status === 400, 'accepted quote is locked');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'draft' } }); ok(r.status === 400 && /accepted quote is locked/i.test(r.body.error), 'accepted quote cannot be downgraded to draft');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'declined' } }); ok(r.status === 400 && /accepted quote is locked/i.test(r.body.error), 'accepted quote cannot be downgraded to declined');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'paid' } }); ok(r.body.ok && r.body.request.quote.status === 'paid', 'admin marks the accepted quote paid');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/create-event', { body: {} }); ok(r.body.ok && /^TT-/.test(r.body.code) && r.body.active, 'paid quote -> official event', r.body); const evc = r.body.code; const evid = r.body.id;
    const createdEvent = db.prepare('SELECT v7, score_rule, win_method FROM giveaways WHERE id=?').get(evid);
    ok(createdEvent.v7 === 1 && createdEvent.score_rule === 'sum_best' && createdEvent.win_method === 'score', 'multi-game total mode uses sum of best score per linked game');
    // Separate highest-single-score booking guards against accidentally mapping every non-random
    // competition to the total-score rule.
    r = await anon('/api/sponsor/requests', { body: { brand: 'E2E Best Score Co', email: 'best@example.com', business_type: BT, prize: 'Gift card', games: ['stack'], competition: 'best', length_days: 7 } });
    const bestTok = r.body.token, bestRid = r.body.id;
    ok(r.body.ok && bestTok, 'highest-score booking request created');
    r = await ADM('/api/admin/sponsor/requests/' + bestRid + '/status', { body: { status: 'sent' } });
    ok(r.body.ok, 'highest-score quote sent');
    r = await anon('/api/sponsor/requests/' + bestTok + '/accept', { body: {} });
    ok(r.body.ok && r.body.request.status === 'accepted', 'highest-score quote accepted by sponsor');
    r = await ADM('/api/admin/sponsor/requests/' + bestRid + '/status', { body: { status: 'paid' } });
    ok(r.body.ok, 'highest-score quote marked paid after acceptance');
    r = await ADM('/api/admin/sponsor/requests/' + bestRid + '/create-event', { body: {} });
    const bestEvent = db.prepare('SELECT v7, score_rule, win_method FROM giveaways WHERE id=?').get(r.body.id);
    ok(r.body.ok && bestEvent.v7 === 1 && bestEvent.score_rule === 'best' && bestEvent.win_method === 'score', 'highest-single-score booking maps to best-score rule, not sum_best');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/create-event', { body: {} }); ok(r.body.existing && r.body.code === evc, 'second click returns the same event (idempotent)');
    r = await anon('/api/event/' + evc); ok(r.body.ok && r.body.event.games.join() === 'stack,void-swarm' && r.body.event.vendor === 'E2E Sponsor Co' && r.body.event.label.includes('E2E SPONSOR CO x GAMING HUB'), 'event carries the vendor, games and label', r.body.event);
    r = await anon('/api/sponsor/requests/' + tok); ok(r.body.request.event && r.body.request.event.code === evc && /<svg/.test(r.body.request.event.qr_svg), 'vendor quote page shows the event link + QR code after payment');
    // Simulate a legacy event created before the payment gate, where the quote is accepted
    // and an event exists but its payment_status is still unpaid. Marking the verified quote paid
    // must update both records atomically so the sponsor does not remain permanently blocked.
    db.prepare("UPDATE sponsor_quotes SET status='accepted' WHERE booking_id=?").run(rid);
    db.prepare("UPDATE giveaways SET payment_status='unpaid' WHERE id=?").run(evid);
    r = await anon('/api/event/' + evc); ok(r.status === 404, 'legacy accepted-but-unpaid event is hidden before payment verification');
    r = await ADM('/api/admin/events/' + evid + '/meta', { method: 'PUT', body: { payment_status: 'paid' } });
    ok(r.status === 409 && /quote is verified as paid/i.test(r.body.error), 'event metadata editor requires a verified paid quote');
    r = await anon('/api/event/' + evc); ok(r.status === 404, 'event remains hidden after rejected metadata update');
    r = await ADM('/api/admin/events/' + evid + '/meta', { method: 'PUT', body: { payment_status: 'comped' } });
    ok(r.status === 409 && /cannot be waived/i.test(r.body.error), 'event metadata editor cannot bypass payment by marking booking comped');
    r = await anon('/api/event/' + evc); ok(r.status === 404, 'event remains hidden after rejected comped bypass');
    r = await ADM('/api/admin/events/' + evid + '/share');
    ok(r.status === 409 && /share link is unavailable/i.test(r.body.error), 'admin share kit does not expose an official URL while booking payment is blocked');
    r = await ADM('/api/admin/giveaways/' + evid + '/draw', { body: { method: 'random', count: 1 } });
    ok(r.status === 409 && /payment is confirmed/i.test(r.body.error), 'admin cannot draw winners for an unpaid booking-backed giveaway');
    db.prepare('UPDATE giveaways SET end_at=? WHERE id=?').run(Date.now() - 1000, evid);
    r = await ADM('/api/admin/giveaways/' + evid);
    const unpaidLock = db.prepare('SELECT finalized_at FROM giveaways WHERE id=?').get(evid);
    ok(r.body.ok && unpaidLock.finalized_at == null, 'admin read / scheduled results sweep cannot lock an unpaid booking giveaway');
    r = await ADM('/api/admin/v7/gw/' + evid + '/act/end', { body: { confirm: 'END' } });
    ok(!r.body.ok && /cannot be ended or finalized until payment/i.test(r.body.error), 'v7 admin cannot force-end an unpaid booking giveaway');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/create-event', { body: {} });
    ok(r.status === 409 && /payment is reconciled/i.test(r.body.error), 'idempotent create-event does not reissue a share URL while existing event payment is blocked');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'declined' } });
    ok(r.status === 400 && /paid quote is locked/i.test(r.body.error), 'settled quote cannot be downgraded to declined');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'paid' } });
    ok(r.body.ok && r.body.request.quote.status === 'paid', 'admin verifies receipt and marks legacy quote paid');
    r = await anon('/api/event/' + evc); ok(r.body.ok && r.body.event.status === 'active', 'verified payment atomically restores the pre-existing event');
    r = await anon('/api/sponsor/requests/' + tok); ok(r.body.request.event && r.body.request.event.code === evc, 'vendor status page regains its event link after verified payment');
    r = await ADM('/api/admin/events/' + evid + '/meta', { method: 'PUT', body: { payment_status: 'refunded' } });
    ok(r.body.ok, 'refund state blocks the booking-backed event');
    r = await anon('/api/event/' + evc); ok(r.status === 404, 'refunded booking event is hidden');
    r = await ADM('/api/admin/events/' + evid + '/meta', { method: 'PUT', body: { payment_status: 'paid' } });
    ok(r.status === 409 && /refunded booking cannot be reactivated/i.test(r.body.error), 'metadata editor cannot reverse a refund into paid state');
    r = await anon('/api/event/' + evc); ok(r.status === 404, 'refunded event remains hidden after rejected metadata reactivation');
    r = await ADM('/api/admin/sponsor/requests/' + rid + '/status', { body: { status: 'paid' } });
    ok(r.body.ok, 'audited quote reconciliation restores a refunded event after payment is verified');
    r = await anon('/api/event/' + evc); ok(r.body.ok && r.body.event.status === 'active', 'event becomes available only after quote reconciliation');

    const payGuardName = 'paygate_' + Date.now().toString(36).slice(-6);
    const payGuard = client();
    r = await payGuard('/api/auth/signup', { body: { username: payGuardName, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } });
    ok(r.body.ok, 'payment-gate regression player signs up', r.body);
    const runWindow = Date.now();
    db.prepare('UPDATE giveaways SET start_at=?, end_at=? WHERE id=?').run(runWindow - 60e3, runWindow + 3600e3, evid);
    r = await payGuard('/api/run/start', { body: { game_id: 'stack', event: evc } });
    ok(r.body.ok && r.body.token && r.body.event.code === evc, 'payment-gate regression starts a valid, paid event run', r.body);
    const paymentGateToken = r.body.token;
    db.prepare("UPDATE giveaways SET payment_status='unpaid' WHERE id=?").run(evid);
    r = await anon('/api/events'); ok(!r.body.events.some(e => e.code === evc), 'unpaid booking-backed event is hidden from the official event directory');
    r = await anon('/api/giveaways/' + evid + '/eligibility'); ok(r.status === 404, 'unpaid booking is hidden from the eligibility endpoint');
    r = await payGuard('/api/giveaways/' + evid + '/join', { body: {} }); ok(r.status === 404, 'unpaid booking cannot accept new giveaway entries');
    r = await payGuard('/api/giveaways/' + evid + '/checklist', { body: { checked: true, step_id: 'rules' } }); ok(r.status === 404, 'unpaid booking cannot update entry checklist state');
    r = await anon('/api/giveaways/' + evid + '/standings'); ok(r.status === 404, 'unpaid booking standings are hidden');
    r = await anon('/api/giveaways/' + evid + '/verify'); ok(r.status === 404, 'unpaid booking verification bundle is hidden');
    r = await anon('/api/games/stack/sponsor'); ok(r.body.ok && !r.body.sponsor, 'unpaid booking does not appear in in-game sponsor placements');
    db.prepare("UPDATE giveaways SET link_url='https://example.com/paygate', placements='[\"giveaway\"]' WHERE id=?").run(evid);
    r = await fetch(BASE + '/go/g/' + evid + '?p=giveaway', { redirect: 'manual' }); ok(r.status === 302 && r.headers.get('location') === '/', 'unpaid booking cannot redirect through a paid giveaway link');
    r = await anon('/api/event/' + evc); ok(r.status === 404, 'direct official-event URL is unavailable while booking is unpaid');
    r = await anon('/api/giveaways'); ok(!r.body.giveaways.some(g => g.id === evid), 'unpaid booking-backed giveaway is hidden from the public giveaway feed');
    r = await anon('/api/giveaways/' + evid); ok(r.status === 404, 'direct public giveaway API is hidden while booking is unpaid');
    r = await anon('/api/leaderboard?giveaway=' + evid); ok(r.status === 404, 'unpaid booking leaderboard is hidden');
    r = await payGuard('/api/run/start', { body: { game_id: 'stack', event: evc } });
    ok(r.status === 403 && /payment is confirmed/i.test(r.body.error), 'new event-run token cannot be issued while booking is unpaid', r.body);
    await sleep(2300);
    r = await payGuard('/api/score', { body: { token: paymentGateToken, score: 0, coins: 0, duration_ms: 2300, giveaway_id: evid } });
    ok(r.body.ok && r.body.giveaway_status === 'not_event_run' && !(r.body.giveaways || []).length, 'previously issued token is demoted to free play if payment becomes unconfirmed', r.body);
    r = await anon('/api/sponsor/requests/' + tok); ok(!r.body.request.event, 'vendor status page hides event link and QR while payment is unconfirmed');
    db.prepare("UPDATE giveaways SET payment_status='paid' WHERE id=?").run(evid);
    r = await anon('/api/event/' + evc); ok(r.body.ok && r.body.event.status === 'active', 'confirmed payment restores the official event');
    r = await anon('/api/sponsor/requests/' + tok); ok(r.body.request.event && r.body.request.event.code === evc && /<svg/.test(r.body.request.event.qr_svg), 'vendor status page restores the event link and QR after payment is confirmed');
    r = await anon('/api/bookings', { body: { brand: 'E2E Old Client', potato: 'oldclient', business_type: BT, package: 'elite' } }); ok(r.body.ok && r.body.token, 'old /api/bookings clients still create a request');
    const tok2 = r.body.token; const rid2 = r.body.id;
    await ADM('/api/admin/sponsor/requests/' + rid2 + '/status', { body: { status: 'sent' } });
    r = await anon('/api/sponsor/requests/' + tok2 + '/decline', { body: {} }); ok(r.body.request.status === 'declined', 'sponsor can decline a quote');
    r = await ADM('/api/admin/sponsor/requests/' + rid2 + '/create-event', { body: {} }); ok(r.status === 409, 'a declined / unaccepted quote cannot become an event');
    await ADM('/api/admin/giveaways/' + evid, { method: 'DELETE' });
    r = await ADM('/api/admin/sponsor/requests'); ok(r.body.requests.some(x => x.id === rid && x.quote.status === 'paid'), 'admin request list shows quote states');

    console.log('# brands: invite links, one brand per player, 30-day switch cooldown');
    r = await anon('/api/brands'); const brands = r.body.brands; ok(r.body.ok && brands.length >= 2 && r.body.cooldown_days === 30, `brand list (${brands.length})`);
    r = await ADM('/api/admin/brands'); const ab = r.body.brands; ok(ab.every(b => /^[A-Z2-9]{8}$/.test(b.invite_code)), 'every brand has an invite code', ab.map(b => b.invite_code));
    const [b1, b2] = ab; r = await anon('/api/brands/invite/' + b1.invite_code); ok(r.body.ok && r.body.brand.id === b1.id, 'invite link resolves the brand');
    r = await anon('/api/brands/invite/NOTACODE'); ok(r.status === 404, 'bad invite code -> 404');
    const stamp = Date.now().toString(36).slice(-5); const U = client(), V = client();
    r = await U('/api/auth/signup', { body: { username: 'e2eb_u' + stamp, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup U');
    r = await V('/api/auth/signup', { body: { username: 'e2eb_v' + stamp, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); ok(r.body.ok, 'signup V');
    for (const C of [U, V]) await C('/api/me/potato', { method: 'PUT', body: { potato: 'e2epot' + stamp } });
    r = await U('/api/me/brand'); ok(r.body.ok && !r.body.brand && r.body.can_switch, 'new player has no brand');
    r = await U('/api/me/brand', { body: { code: b1.invite_code, via: 'link' } }); ok(r.body.ok && r.body.brand.id === b1.id && !r.body.can_switch, 'U joins brand 1 via invite link');
    r = await V('/api/me/brand', { body: { code: b2.slug, via: 'signup' } }); ok(r.body.ok && r.body.brand.id === b2.id, 'V picks brand 2 at signup');
    r = await U('/api/me/brand', { body: { code: b2.invite_code } }); ok(r.status === 400 && /30 days/.test(r.body.error) && r.body.can_switch_at, 'switching again inside 30 days is refused with the date', r.body);
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
    db.prepare('UPDATE users SET brand_joined_at=? WHERE username=?').run(Date.now() - 31 * 864e5, 'e2eb_u' + stamp);
    r = await U('/api/me/brand', { body: { code: b2.invite_code } }); ok(r.body.ok && r.body.switched && r.body.left_giveaways.includes('E2E Brand Only'), 'after 30 days U switches; old-brand live entries are left automatically', r.body);
    r = await U('/api/giveaways/' + gB + '/eligibility'); ok(!r.body.joined && !r.body.eligible, 'U is no longer entered in the old brand giveaway');
    process.env.DB_PATH = DB; const E = require('../src/eligibility');
    const uid = db.prepare('SELECT id FROM users WHERE username=?').get('e2eb_u' + stamp).id;
    ok(/Not a member/.test(E.lockViolation({ channel_id: b1.id, open_to_all: 0 }, uid) || ''), 'at lock time a non-member is skipped with a logged reason');
    ok(E.lockViolation({ channel_id: b1.id, open_to_all: 1 }, uid) === null, 'open giveaways never skip for brand');
    r = await U('/api/me/brand/leave', { body: {} }); ok(r.body.ok && !r.body.brand, 'player can leave a brand');
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

'use strict';
// v7 "Book a Giveaway": no tiers, no public prices.
// A sponsor ticks the features they want from ONE combined list (everything the old Basic/Premium/Elite tiers and add-ons
// offered), adds details, and sends a free quote request. Only admins see the price sheet (settings key "sponsor_prices",
// seeded from the old v5 prices); the admin gets an auto-totalled draft quote per request, can adjust it (discounts,
// custom lines), and marks it sent / accepted / declined / paid. The sponsor sees the quote on their private status page
// (/sponsor/status/<token>) once it is sent, and accepts or declines it there. Payment stays the existing manual flow:
// the accepted quote amount is settled through secure Stripe card checkout and the admin marks it paid.
const crypto = require('crypto');
const db = require('./db');
const linked = require('./giveaway-linked');
const PK = require('./packages');
const BOOKING_FEE = require('./booking-fee-guard');
const BOOKING_STRIPE = require('./booking-stripe');

const D = 864e5;
const cents = (d) => Math.round(d * 100);
// unit: 'flat' (once), 'week' (per week, qty = weeks), 'each' (qty = how many). min/max bound the qty a sponsor can pick.
// price = admin-only seed in cents (from the v5 tier + add-on prices). place = giveaway placement the feature unlocks.
const FEATURES = [
  { id: 'base', group: 'Giveaway basics', name: 'Hosted giveaway (required)', desc: 'Your giveaway set up by Trap Tech on the Giveaways page: brand name, prize photo, official rules, 1 linked game, 1 winner, entrant list when it ends.', unit: 'flat', required: true, price: cents(49) },
  { id: 'weeks', group: 'Giveaway basics', name: 'Giveaway length', desc: 'How many weeks your giveaway runs (1 week is included).', unit: 'week', min: 1, max: 8, dflt: 1, free: 1, price: cents(25) },
  { id: 'games', group: 'Giveaway basics', name: 'Extra linked games', desc: 'Runs in more games count toward your giveaway (multi-game).', unit: 'each', min: 1, max: 15, dflt: 2, price: cents(15) },
  { id: 'giveaways', group: 'Giveaway basics', name: 'Extra giveaways in the same campaign', desc: 'Run more than one giveaway (for example a weekly prize) inside your dates.', unit: 'each', min: 1, max: 5, dflt: 1, price: cents(35) },
  { id: 'winners', group: 'Winners & rules', name: 'Extra winners / prize tiers', desc: 'Additional verified leaderboard placements (1st, 2nd, 3rd) with published skill-based ranking.', unit: 'each', min: 1, max: 20, dflt: 2, price: cents(15) },
  { id: 'weekly-winners', group: 'Winners & rules', name: 'Weekly leaderboard winners', desc: 'Extra winners from each week\'s leaderboard while the giveaway runs.', unit: 'flat', price: cents(49) },
  { id: 'entry-rules', group: 'Winners & rules', name: 'Custom entry rules', desc: 'Minimum score, recent activity or account-age rules to stop giveaway camping.', unit: 'flat', price: cents(19) },
  { id: 'open-to-all', group: 'Winners & rules', name: 'Open to every hub player', desc: 'By default only players affiliated with your brand can enter. Ask for a hub-wide giveaway open to everyone (admin approves).', unit: 'flat', price: cents(59), place: 'open' },
  { id: 'featured', group: 'Placement & reach', name: 'Home page Featured row', desc: 'Your giveaway in the Featured row on the Home page (shared fairly with other sponsors).', unit: 'week', min: 1, max: 8, dflt: 1, price: cents(49), place: 'featured' },
  { id: 'hero', group: 'Placement & reach', name: 'Home hero takeover', desc: 'The big banner at the top of Home. Only one runs at a time, booked by date.', unit: 'week', min: 1, max: 4, dflt: 1, price: cents(99), place: 'hero' },
  { id: 'push', group: 'Placement & reach', name: 'Push / in-app alert blast', desc: 'One alert to every player who opted in. Max one blast per day across all sponsors.', unit: 'each', min: 1, max: 4, dflt: 1, price: cents(79) },
  { id: 'reminder', group: 'Placement & reach', name: 'Final-week reminder alert', desc: 'A second alert in the last week of your giveaway.', unit: 'flat', price: cents(29) },
  { id: 'member-alert', group: 'Placement & reach', name: 'Launch alert to your brand members', desc: 'An in-app alert to the players affiliated with your brand when it goes live.', unit: 'flat', price: cents(19) },
  { id: 'tournament', group: 'Placement & reach', name: 'Featured tournament', desc: 'A timed tournament (leaderboard cup or bracket) with your brand name, listed on Tournaments.', unit: 'each', min: 1, max: 4, dflt: 1, price: cents(99) },
  { id: 'logo-colors', group: 'Branding', name: 'Logo + brand colors', desc: 'Your logo and colors on the giveaway card and page.', unit: 'flat', price: cents(30) },
  { id: 'share-cards', group: 'Branding', name: 'Branded share cards', desc: 'Share images for your giveaway with your logo, for players to post.', unit: 'flat', price: cents(19) },
  { id: 'brand-badge', group: 'Branding', name: 'Custom brand badge', desc: 'A collectible badge for your giveaway\'s players.', unit: 'flat', price: cents(49) },
  { id: 'game-skin', group: 'Branding', name: 'Branded game skin', desc: 'Your logo on obstacles / background and branded coins inside a game.', unit: 'flat', price: cents(249), place: 'skin' },
  { id: 'link-giveaway', group: 'Links to your site', name: 'Link on the giveaway page', desc: 'An outbound link (website or Potato channel), click-tracked.', unit: 'flat', price: cents(39), place: 'giveaway' },
  { id: 'link-game', group: 'Links to your site', name: 'Link on the game page', desc: 'Your link shown on the game page of a linked game.', unit: 'flat', price: cents(39), place: 'game' },
  { id: 'link-announcement', group: 'Links to your site', name: 'Link in the launch announcement', desc: 'Your link in the hub announcement when the giveaway goes live.', unit: 'flat', price: cents(25), place: 'announcement' },
  { id: 'live-stats', group: 'Reports & winner help', name: 'Live stats', desc: 'Plays, unique players, entrants and link clicks while it runs.', unit: 'flat', price: cents(29) },
  { id: 'report', group: 'Reports & winner help', name: 'Post-campaign report', desc: 'Reach, plays, entrants and clicks by placement after it ends.', unit: 'flat', price: cents(49) },
  { id: 'winner-contact', group: 'Reports & winner help', name: 'Winner contact on Potato', desc: 'Trap Tech contacts each winner on Potato and confirms with you (always included).', unit: 'flat', included: true, price: 0 },
  { id: 'delivery', group: 'Reports & winner help', name: 'Winner verification + delivery help', desc: 'We verify winners and coordinate prize delivery for every winner.', unit: 'flat', price: cents(39) },
];
const BY = Object.fromEntries(FEATURES.map(f => [f.id, f]));
const GROUPS = [...new Set(FEATURES.map(f => f.group))];
const PLACES = ['giveaway', 'game', 'announcement', 'featured', 'hero', 'skin', 'open'];
// legacy tier -> placements (old giveaways keep what they paid for)
const TIER_PLACES = { basic: [], premium: ['giveaway', 'featured'], elite: ['giveaway', 'game', 'announcement', 'featured', 'hero', 'skin'] };

function cols(t) { return new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name)); }
function addCol(t, c, def) { if (!cols(t).has(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); }
addCol('bookings', 'features', "TEXT NOT NULL DEFAULT ''");          // JSON [{id, qty, note}]
addCol('bookings', 'public_token', "TEXT");
addCol('bookings', 'notes', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'brand_id', 'INTEGER');
// v7 Phase 3: the client's giveaway details (never prices) + the official event made from an accepted quote
addCol('bookings', 'prize', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'brand_color', "TEXT NOT NULL DEFAULT ''");
addCol('bookings', 'game_ids', "TEXT NOT NULL DEFAULT '[]'");
addCol('bookings', 'competition', "TEXT NOT NULL DEFAULT 'best'");
addCol('bookings', 'length_days', 'INTEGER NOT NULL DEFAULT 7');
addCol('bookings', 'event_id', 'INTEGER');
addCol('giveaways', 'placements', "TEXT");                           // JSON list of PLACES; NULL = derive from legacy tier
db.exec(`CREATE TABLE IF NOT EXISTS sponsor_quotes (
  booking_id INTEGER PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  lines TEXT NOT NULL DEFAULT '[]', discount_pct REAL NOT NULL DEFAULT 0, discount_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'draft', valid_until INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  sent_at INTEGER, responded_at INTEGER, paid_at INTEGER, updated_by TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_token ON bookings(public_token);`);
BOOKING_STRIPE.ensureSchema(db);
// Keep existing booking/event data while adding one optional brand channel link. No growth goals or follow requirements.
linked.ensureSchema(db);
// migrate: every booking gets a private status token; old tier bookings get an equivalent feature list
for (const b of db.prepare("SELECT id, package, addons FROM bookings WHERE public_token IS NULL").all()) {
  const feats = [{ id: 'base', qty: 1 }];
  const map = { basic: [], premium: [['weeks', 2], ['featured', 2], ['link-giveaway', 1], ['logo-colors', 1], ['winners', 2], ['live-stats', 1], ['games', 2]],
    elite: [['weeks', 4], ['featured', 4], ['hero', 4], ['push', 1], ['reminder', 1], ['link-giveaway', 1], ['link-game', 1], ['link-announcement', 1], ['game-skin', 1], ['brand-badge', 1], ['winners', 9], ['weekly-winners', 1], ['live-stats', 1], ['report', 1], ['delivery', 1], ['games', 3]] };
  for (const [id, q] of map[b.package] || []) feats.push({ id, qty: q });
  const addMap = { 'extra-week': 'weeks', 'extra-link': 'link-giveaway', push: 'push', 'extra-winners': 'winners', 'featured-week': 'featured', 'game-skin': 'game-skin' };
  for (const a of String(b.addons || '').split(',').filter(Boolean)) { const id = addMap[a]; if (id && !feats.some(f => f.id === id)) feats.push({ id, qty: 1 }); }
  db.prepare('UPDATE bookings SET public_token=?, features=CASE WHEN features=\'\' THEN ? ELSE features END WHERE id=?').run(crypto.randomBytes(18).toString('base64url'), JSON.stringify(feats), b.id);
}

// ---------- admin price sheet ----------
function prices() {
  const row = db.prepare("SELECT value FROM settings WHERE key='sponsor_prices'").get(); let saved = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch {}
  return Object.fromEntries(FEATURES.map(f => [f.id, Number.isInteger(saved[f.id]) ? saved[f.id] : f.price]));
}
function setPrices(input) {
  const cur = prices(); const out = {};
  for (const f of FEATURES) { const v = input && input[f.id]; const c = v === undefined ? cur[f.id] : Math.round(Number(v)); out[f.id] = Number.isFinite(c) && c >= 0 && c <= 10_000_000 ? c : cur[f.id]; }
  db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('sponsor_prices',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(JSON.stringify(out), Date.now());
  return out;
}

// ---------- requests ----------
function readFeatures(list) {
  const out = []; const seen = new Set();
  for (const x of Array.isArray(list) ? list : []) {
    const f = BY[String(x && x.id)]; if (!f || seen.has(f.id)) continue; seen.add(f.id);
    const qty = f.unit === 'flat' ? 1 : Math.max(f.min || 1, Math.min(f.max || 1, parseInt(x.qty, 10) || f.dflt || 1));
    out.push({ id: f.id, qty, note: String(x.note || '').trim().slice(0, 300) });
  }
  if (!out.some(x => x.id === 'base')) out.unshift({ id: 'base', qty: 1, note: '' });
  if (!out.some(x => x.id === 'winner-contact')) out.push({ id: 'winner-contact', qty: 1, note: '' });
  return out;
}
const featuresOf = (b) => { try { return JSON.parse(b.features || '[]'); } catch { return []; } };
const label = (f, qty) => f.unit === 'week' ? `${f.name}: ${qty} week${qty === 1 ? '' : 's'}` : f.unit === 'each' ? `${f.name} x ${qty}` : f.name;
// auto-totalled draft from the price sheet
function draftLines(b, P = prices()) {
  return featuresOf(b).map(x => {
    const f = BY[x.id]; if (!f) return null;
    const billable = Math.max(0, x.qty - (f.free || 0)); const qty = f.unit === 'flat' ? 1 : billable;
    return { feature_id: f.id, label: label(f, x.qty), qty, unit_cents: P[f.id], amount_cents: f.included ? 0 : qty * P[f.id], note: x.note || '' };
  }).filter(Boolean);
}
function total(lines, pct, off) {
  const sub = lines.reduce((s, l) => s + (Number(l.amount_cents) || 0), 0);
  return Math.max(0, Math.round(sub * (1 - Math.min(100, Math.max(0, pct || 0)) / 100)) - Math.max(0, off || 0));
}
function quoteRow(id) { return db.prepare('SELECT * FROM sponsor_quotes WHERE booking_id=?').get(id) || null; }
function adminView(b) {
  const q = quoteRow(b.id); const lines = q ? JSON.parse(q.lines) : draftLines(b);
  const disc = q ? { pct: q.discount_pct, cents: q.discount_cents } : { pct: 0, cents: 0 };
  return { ...b, linked_requirements: linked.publicView(b.linked_requirements), features: featuresOf(b).map(x => ({ ...x, name: BY[x.id] ? BY[x.id].name : x.id, unit: BY[x.id] ? BY[x.id].unit : 'flat' })),
    quote: { saved: !!q, status: q ? q.status : 'draft', lines, discount_pct: disc.pct, discount_cents: disc.cents, subtotal_cents: lines.reduce((s, l) => s + (l.amount_cents || 0), 0),
      total_cents: total(lines, disc.pct, disc.cents), note: q ? q.note : '', valid_until: q ? q.valid_until : null, sent_at: q && q.sent_at, responded_at: q && q.responded_at, paid_at: q && q.paid_at,
      auto_total_cents: total(draftLines(b), 0, 0) } };
}
function saveQuote(id, body, by) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(id); if (!b) return { ok: false, error: 'Request not found.' };
  const q = quoteRow(id); if (q && ['accepted', 'paid'].includes(q.status)) return { ok: false, error: 'This quote was already accepted; it can no longer change.' };
  const lines = (Array.isArray(body.lines) ? body.lines : draftLines(b)).slice(0, 60).map(l => {
    const qty = Math.max(0, Math.min(1000, Number(l.qty) || 0)); const unit = Math.round(Number(l.unit_cents) || 0);
    const amount = l.amount_cents !== undefined && l.custom ? Math.round(Number(l.amount_cents) || 0) : Math.round(qty * unit);
    return { feature_id: BY[l.feature_id] ? l.feature_id : null, label: String(l.label || (BY[l.feature_id] && BY[l.feature_id].name) || 'Custom item').slice(0, 160), qty, unit_cents: unit, amount_cents: Math.max(-10_000_000, Math.min(10_000_000, amount)), custom: !!l.custom, note: String(l.note || '').slice(0, 300) };
  });
  const pct = Math.max(0, Math.min(100, Number(body.discount_pct) || 0)); const off = Math.max(0, Math.round(Number(body.discount_cents) || 0));
  const t = Date.now(); const valid = t + Math.max(1, Math.min(90, parseInt(body.valid_days, 10) || 14)) * D;
  db.prepare(`INSERT INTO sponsor_quotes (booking_id, lines, discount_pct, discount_cents, total_cents, note, status, valid_until, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?,'draft',?,?,?,?)
    ON CONFLICT(booking_id) DO UPDATE SET lines=excluded.lines, discount_pct=excluded.discount_pct, discount_cents=excluded.discount_cents, total_cents=excluded.total_cents, note=excluded.note, valid_until=excluded.valid_until, updated_at=excluded.updated_at, updated_by=excluded.updated_by, status=CASE WHEN sponsor_quotes.status IN ('sent','declined') THEN 'draft' ELSE sponsor_quotes.status END`)
    .run(id, JSON.stringify(lines), pct, off, total(lines, pct, off), String(body.note || '').slice(0, 2000), valid, t, t, by || null);
  return { ok: true, request: adminView(b) };
}
function setStatus(id, status, by) {
  const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(id); if (!b) return { ok: false, error: 'Request not found.' };
  if (!['sent', 'accepted', 'declined', 'paid', 'draft'].includes(status)) return { ok: false, error: 'Unknown status.' };
  if (!quoteRow(id)) { const r = saveQuote(id, {}, by); if (!r.ok) return r; }
  const q = quoteRow(id); const t = Date.now();
  if (status === 'paid') return { ok:false,error:'Payments are verified through signed Stripe webhooks, not by an admin status button.' };
  if (q.status === 'paid' || q.status === 'refunded') return { ok:false,error:'A settled or refunded booking cannot be manually reset.' };
  if (status === 'sent' && ['accepted', 'paid'].includes(q.status)) return { ok: false, error: 'Already accepted.' };
  db.prepare(`UPDATE sponsor_quotes SET status=?, updated_at=?, updated_by=?, sent_at=CASE WHEN ?='sent' THEN ? ELSE sent_at END, responded_at=CASE WHEN ? IN ('accepted','declined') THEN ? ELSE responded_at END, paid_at=CASE WHEN ?='paid' THEN ? ELSE paid_at END WHERE booking_id=?`)
    .run(status, t, by || null, status, t, status, t, status, t, id);
  const bs = { sent: 'quoted', accepted: 'approved', declined: 'declined', paid: 'paid', draft: 'pending' }[status];
  db.prepare('UPDATE bookings SET status=? WHERE id=?').run(bs, id);
  return { ok: true, request: adminView(db.prepare('SELECT * FROM bookings WHERE id=?').get(id)) };
}
// what the sponsor sees on the status page (prices only once a quote has been SENT)
function sponsorView(b) {
  const q = quoteRow(b.id); const shown = q && ['sent', 'accepted', 'declined', 'paid'].includes(q.status);
  const pk = PK.getPackages();
  const ev = b.event_id ? db.prepare('SELECT id, event_code, title, start_at, end_at FROM giveaways WHERE id=?').get(b.event_id) : null;
  return { id: b.id, brand: b.brand, created_at: b.created_at, start_date: b.start_date, end_date: b.end_date, details: b.details, notes: b.notes, business_type: b.business_type,
    prize: b.prize || '', brand_color: b.brand_color || '', games: JSON.parse(b.game_ids || '[]'), competition: b.competition || 'best', length_days: b.length_days || 7,
    linked_requirements: linked.publicView(b.linked_requirements),
    event: ev && ['active','scheduled'].includes(require('./events').status(db.prepare('SELECT * FROM giveaways WHERE id=?').get(ev.id))) ? { code: ev.event_code, url: '/event/' + ev.event_code, qr_svg: require('./events').qrSvg((require('./public-url').PUBLIC_URL || '') + '/event/' + ev.event_code), start_at: ev.start_at, end_at: ev.end_at } : null,
    status: shown ? q.status : (b.status === 'declined' ? 'declined' : 'pending'), potato_handle: pk.potato_handle,
    payment_checkout: BOOKING_STRIPE.checkoutFields(q),
    features: featuresOf(b).map(x => BY[x.id] && ({ id: x.id, label: label(BY[x.id], x.qty), note: x.note })).filter(Boolean),
    quote: shown ? { lines: JSON.parse(q.lines).map(l => ({ label: l.label, qty: l.qty, amount_cents: l.amount_cents, note: l.note })), discount_pct: q.discount_pct, discount_cents: q.discount_cents,
      total_cents: q.total_cents, note: q.note, valid_until: q.valid_until, sent_at: q.sent_at, responded_at: q.responded_at, paid_at: q.paid_at, status: q.status,
      expired: q.status === 'sent' && q.valid_until && q.valid_until < Date.now() } : null };
}
function placementsOf(g) {
  if (g.placements) { try { const p = JSON.parse(g.placements); if (Array.isArray(p)) return p.filter(x => PLACES.includes(x)); } catch {} }
  return TIER_PLACES[g.tier] || [];
}
// placements implied by a request's features (admin can apply them to a giveaway)
const placementsFromFeatures = (feats) => [...new Set(feats.map(x => BY[x.id] && BY[x.id].place).filter(Boolean))];
// public catalog: names, groups, descriptions and quantity limits only - never prices
const publicCatalog = () => ({ groups: GROUPS, features: FEATURES.map(f => ({ id: f.id, group: f.group, name: f.name, desc: f.desc, unit: f.unit, min: f.min || 1, max: f.max || 1, dflt: f.dflt || 1, required: !!f.required, included: !!f.included, free: f.free || 0 })) });

module.exports = function sponsor(app, A, h) {
  const { now, bad, currentUser, str, limiter, logActivity, ipHash } = h;
  h.placementsOf = placementsOf;
  app.get('/api/sponsor/catalog', (req, res) => { const pk = PK.getPackages(); res.json({ ok: true, ...publicCatalog(), business_types: PK.BUSINESS_TYPES, cannabis: PK.CANNABIS_TYPE, potato_handle: pk.potato_handle, faq: (pk.faq || []).filter(f => !/pay|price|cost/i.test(f[0]) && !/\$\d|\b(basic|premium|elite|tiers?)\b/i.test(f.join(' '))).concat([['When do I pay?', 'Not now. A request is free. Trap Tech looks at the features you picked and sends you a quote on your private status page. You only pay after you accept it, settled through secure Stripe card checkout.']]) }); });
  const create = (req, res) => {
    const b = req.body || {};
    const brand = str(b.brand, 120); const email = str(b.email, 160).toLowerCase(); const potato = str(b.potato, 40).replace(/^@/, '');
    if (!brand) return bad(res, 400, 'Brand / channel name is required.');
    if (!email && !potato) return bad(res, 400, 'Add an email or a Potato username (at least one) so we can reach you.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad(res, 400, 'That email address does not look right.');
    if (potato && !/^[A-Za-z0-9_]{3,32}$/.test(potato)) return bad(res, 400, 'Potato usernames use letters, numbers and _ only.');
    const businessType = PK.BUSINESS_TYPES.includes(b.business_type) ? b.business_type : '';
    if (!businessType) return bad(res, 400, 'Please choose your business type.');
    const isCannabis = businessType === PK.CANNABIS_TYPE;
    if (isCannabis && b.licensed !== true) return bad(res, 400, 'Cannabis product sellers must confirm the business is licensed and legally permitted to operate and advertise in its jurisdiction.');
    let external;
    try { external=linked.normalize(b.linked_requirements); }
    catch(e){ return bad(res,400,e.message); }
    const cfgBooking = require('./config');
    const proposedGames=(Array.isArray(b.games)?b.games:[]).map(String);
    if(proposedGames.some(id=>!cfgBooking.GAME_MAP[id]||!cfgBooking.GAME_MAP[id].giveaway||cfgBooking.GAME_MAP[id].playable===false||cfgBooking.GAME_MAP[id].retired))
      return bad(res,400,'Select only currently playable giveaway game candidates.');
    const contestCheck=require('./booked-competition').validate(b.competition || 'best',proposedGames);
    if(!contestCheck.ok)return bad(res,400,contestCheck.error);
    const feats = readFeatures(b.features);
    const snapshot = feats.map(x => label(BY[x.id], x.qty)).join(', ');
    const contact = [email, potato ? '@' + potato + ' (Potato)' : ''].filter(Boolean).join(' / ');
    const me = currentUser(req); const token = crypto.randomBytes(18).toString('base64url');
    const info = db.prepare(`INSERT INTO bookings (brand,contact_name,contact,event_type,package,package_snapshot,start_date,end_date,details,user_id,created_at,ip_hash,business_type,email,potato,licensed_confirmed,addons,features,public_token,notes)
      VALUES (?,?,?,?,'custom',?,?,?,?,?,?,?,?,?,?,?,'',?,?,?)`).run(brand, str(b.contact_name, 120), contact, str(b.event_type, 60), snapshot.slice(0, 1000),
      str(b.start_date, 20), str(b.end_date, 20), str(b.details, 4000), me ? me.id : null, now(), ipHash(req), businessType, email, potato, isCannabis ? 1 : 0, JSON.stringify(feats), token, str(b.notes, 2000));
    { const cfg = require('./config'); const gidInput=Array.isArray(b.games) ? b.games : [];
      const gids = gidInput.map(String).filter(id => cfg.GAME_MAP[id] && cfg.GAME_MAP[id].giveaway && cfg.GAME_MAP[id].playable !== false && !cfg.GAME_MAP[id].retired);
      const contest=require('./booked-competition').validate(b.competition || 'best',gids);
      if(!contest.ok) return bad(res,400,contest.error);
      db.prepare('UPDATE bookings SET prize=?, brand_color=?, game_ids=?, competition=?, length_days=?, linked_requirements=? WHERE id=?').run(str(b.prize, 200), /^#[0-9a-fA-F]{6}$/.test(String(b.brand_color || '')) ? b.brand_color : '', JSON.stringify(gids),
        contest.mode, Math.max(1, Math.min(90, parseInt(b.length_days, 10) || 7)), JSON.stringify(external), info.lastInsertRowid); }
    logActivity('booking', `Sponsor quote request: ${brand} (${feats.length} features)`, me ? me.id : null, info.lastInsertRowid);
    const pk = PK.getPackages();
    res.json({ ok: true, id: info.lastInsertRowid, token, status_url: '/sponsor/status/' + token, features: feats.map(x => label(BY[x.id], x.qty)), potato_handle: pk.potato_handle, licensed_confirmed: isCannabis });
  };
  app.post('/api/sponsor/requests', limiter('booking', 15, 3600e3), create);
  app.post('/api/bookings', limiter('booking', 15, 3600e3), create); // old clients
  const byToken = (t) => /^[A-Za-z0-9_-]{20,40}$/.test(String(t)) ? db.prepare('SELECT * FROM bookings WHERE public_token=?').get(String(t)) : null;
  BOOKING_STRIPE.register(app,db,h,{byToken,quoteRow,sponsorView});
  app.get('/api/sponsor/requests/:token', limiter('sp-status', 120, 600e3), (req, res) => { const b = byToken(req.params.token); if (!b) return bad(res, 404, 'Request not found.'); res.json({ ok: true, request: sponsorView(b) }); });
  app.post('/api/sponsor/requests/:token/:act(accept|decline)', limiter('sp-act', 20, 600e3), (req, res) => {
    const b = byToken(req.params.token); if (!b) return bad(res, 404, 'Request not found.');
    const q = quoteRow(b.id); if (!q || q.status !== 'sent') return bad(res, 409, 'There is no open quote to answer.');
    if (q.valid_until && q.valid_until < now()) return bad(res, 409, 'This quote has expired. Ask Trap Tech for a fresh one.');
    const r = setStatus(b.id, req.params.act === 'accept' ? 'accepted' : 'declined', 'sponsor');
    logActivity('booking', `Sponsor ${req.params.act}ed quote: ${b.brand}`, null, b.id);
    res.json({ ok: r.ok, request: sponsorView(db.prepare('SELECT * FROM bookings WHERE id=?').get(b.id)) });
  });
  // ---------- admin ----------
  A.get('/sponsor/prices', (req, res) => res.json({ ok: true, prices: prices(), features: FEATURES.map(f => ({ ...f, seed: f.price })), groups: GROUPS }));
  A.put('/sponsor/prices', (req, res) => res.json({ ok: true, prices: setPrices(req.body && req.body.prices) }));
  // Potato handle shown to sponsors + the sponsor FAQ (stored with the legacy package settings)
  A.get('/sponsor/settings', (req, res) => { const pk = PK.getPackages(); res.json({ ok: true, potato_handle: pk.potato_handle || '', faq: pk.faq || [] }); });
  A.put('/sponsor/settings', (req, res) => {
    const pk = PK.getPackages(); const b = req.body || {};
    const [v, err] = PK.sanitize({ ...pk, potato_handle: b.potato_handle !== undefined ? String(b.potato_handle).replace(/^@/, '') : pk.potato_handle, faq: Array.isArray(b.faq) ? b.faq : pk.faq });
    if (err) return bad(res, 400, err); PK.savePackages(v); res.json({ ok: true, potato_handle: v.potato_handle, faq: v.faq });
  });
  A.get('/sponsor/requests', (req, res) => res.json({ ok: true, requests: db.prepare('SELECT b.*, u.username FROM bookings b LEFT JOIN users u ON u.id=b.user_id ORDER BY b.created_at DESC LIMIT 500').all().map(adminView) }));
  A.get('/sponsor/requests/:id', (req, res) => { const b = db.prepare('SELECT b.*, u.username, (SELECT event_code FROM giveaways WHERE id = b.event_id) AS event_code FROM bookings b LEFT JOIN users u ON u.id=b.user_id WHERE b.id=?').get(req.params.id); if (!b) return bad(res, 404, 'Not found'); res.json({ ok: true, request: adminView(b), placements: placementsFromFeatures(featuresOf(b)) }); });
  A.put('/sponsor/requests/:id/quote', (req, res) => { const r = saveQuote(+req.params.id, req.body || {}, req.admin && req.admin.username); r.ok ? res.json(r) : bad(res, 400, r.error); });
  // v7 Phase 3: an ACCEPTED (or paid) quote becomes an official event in one click. Idempotent: a second click returns the same event.
  A.post('/sponsor/requests/:id/create-event', (req, res) => {
    const b = db.prepare('SELECT * FROM bookings WHERE id=?').get(+req.params.id); if (!b) return bad(res, 404, 'Request not found.');
    const q = quoteRow(b.id); if (!BOOKING_FEE.paidFeeRecorded(q)) return bad(res, 409, 'A positive booking fee and paid booking record are required before preparing an official event.');
    const EV = require('./events');
    const EVSTATUS = g => EV.status(g);
    if (b.event_id) { const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(b.event_id); if (g) return res.json({ ok: true, existing: true, id: g.id, status: EVSTATUS(g), share_ready: false, message:'Share links are released only after settled payment and certified gameplay.' }); }
    const cfg = require('./config'); const games = JSON.parse(b.game_ids || '[]').filter(id => cfg.GAME_MAP[id] && cfg.GAME_MAP[id].giveaway && cfg.GAME_MAP[id].playable !== false && !cfg.GAME_MAP[id].retired);
    const contest=require('./booked-competition').validate(b.competition || 'best',games);
    if(!contest.ok)return bad(res,409,contest.error);
    const day = 86400e3; const parse = (d) => { const t = Date.parse(String(d || '') + 'T12:00:00-04:00'); return Number.isFinite(t) ? t : null; };
    const start = Math.max(Date.now(), parse(b.start_date) || Date.now() + day); const end = parse(b.end_date) && parse(b.end_date) > start ? parse(b.end_date) : start + (b.length_days || 7) * day;
    const t = Date.now(); const comp = contest.mode;
    const id = db.transaction(() => {
      const info = db.prepare(`INSERT INTO giveaways (title, host, prize, image, start_at, end_at, entry_method, game_id, rules, active, created_at, updated_at, brand_color, win_method, winner_count)
        VALUES (?,?,?,?,?,?,'play',?,?,0,?,?,?,?,1)`).run(`${b.brand} Official Giveaway`, b.brand, b.prize || 'Prize from ' + b.brand, '', start, end, games[0], String(b.details || '').slice(0, 2000), t, t, b.brand_color || '', 'score');
      const gid = info.lastInsertRowid; for (const gm of games) db.prepare('INSERT OR IGNORE INTO giveaway_games (giveaway_id, game_id) VALUES (?,?)').run(gid, gm);
      db.prepare('UPDATE giveaways SET linked_requirements=? WHERE id=?').run(JSON.stringify(linked.parse(b.linked_requirements)),gid);
      db.prepare('UPDATE giveaways SET score_rule=? WHERE id=?').run(contest.scoreRule,gid);
      db.prepare("UPDATE giveaways SET vendor=?, booking_id=?, booking_status='booked', payment_status=? WHERE id=?").run(b.brand, b.id, q.status === 'paid' ? 'paid' : 'unpaid', gid);
      db.prepare('UPDATE bookings SET event_id=? WHERE id=?').run(gid, b.id); return gid; })();
    EV.ensureCodes(); const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
    if (require('./results').ensureCommit) require('./results').ensureCommit(g);
    res.json({ ok: true, id, prepared: true, status: EV.status(g), share_ready: false, active: false, start_at: g.start_at, end_at: g.end_at, message:'Event created as an unshared draft. It remains unavailable until independently certified gameplay and owner activation.' });
  });
  A.post('/sponsor/requests/:id/status', (req, res) => { const r = setStatus(+req.params.id, String((req.body || {}).status), req.admin && req.admin.username); r.ok ? res.json(r) : bad(res, 400, r.error); });
};
Object.assign(module.exports, { FEATURES, BY, GROUPS, PLACES, prices, setPrices, readFeatures, draftLines, total, adminView, sponsorView, saveQuote, setStatus, placementsOf, placementsFromFeatures, publicCatalog });

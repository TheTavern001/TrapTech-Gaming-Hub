'use strict';
// v7 Phase 2: OFFICIAL EVENTS vs FREE PLAY.
//  * Free play: any signed-in player can play any game; scores go to the public/global boards ONLY. A public score is
//    never a giveaway entry (POST /api/score ignores giveaway_id unless the run token itself is an event-run token).
//  * Official giveaway = a giveaway row an admin created server-side. Every giveaway gets a private event code
//    (TT-XXXXX, URL /event/TT-XXXXX) plus vendor, booking/payment status and a derived status.
//  * Entering an active event issues a short-lived, HMAC-signed, single-use EVENT-RUN token bound to player + event +
//    game + session (POST /api/run/start {game_id, event}). The server checks: event is real, active (not draft,
//    cancelled, scheduled or ended), the player is signed in, the game is assigned to the event and giveaway-eligible,
//    the player is eligible/entered, and on submit: token unused, same session, event still running (2 min grace for a
//    run started before the end), plus the game's anti-cheat level. Runs are stored with runs.event_id.
//  * Event boards are computed ONLY from runs with event_id = that event (src/results.js), so global scores never
//    appear on event boards, and only event boards decide winners.
//  * Nothing that decides "official" or "admin" lives in frontend JS; the game postMessage bridge is untrusted.
const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');
const PU = require('./public-url');

const cols = (t) => new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name));
const addCol = (t, c, def) => { if (!cols(t).has(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
addCol('giveaways', 'event_code', 'TEXT');
addCol('giveaways', 'vendor', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'booking_status', "TEXT NOT NULL DEFAULT 'none'");   // none | requested | quoted | accepted | booked
addCol('giveaways', 'payment_status', "TEXT NOT NULL DEFAULT 'n/a'");    // n/a | unpaid | paid | refunded | comped
addCol('giveaways', 'booking_id', 'INTEGER');
addCol('runs', 'event_id', 'INTEGER');
addCol('run_tokens', 'event_id', 'INTEGER');
addCol('run_tokens', 'sess_hash', "TEXT NOT NULL DEFAULT ''");
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS giveaways_event_code ON giveaways(event_code)');
db.exec('CREATE INDEX IF NOT EXISTS runs_event ON runs(event_id, game_id, user_id)');

const ALPHA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // no 0/O/1/I
function newCode() {
  for (;;) { const b = crypto.randomBytes(5); const c = 'TT-' + [...b].map(x => ALPHA[x % 32]).join('');
    if (!db.prepare('SELECT 1 FROM giveaways WHERE event_code=?').get(c)) return c; }
}
// map every existing giveaway onto the event model (idempotent; existing data is untouched apart from the new columns)
function backfill() { const rows = db.prepare('SELECT id FROM giveaways WHERE event_code IS NULL').all(); for (const r of rows) db.prepare('UPDATE giveaways SET event_code=? WHERE id=?').run(newCode(), r.id); return rows.length; }
// new giveaways (any admin path: legacy form, v7 builder, quote -> event) get a code at insert time
db.exec(`CREATE TRIGGER IF NOT EXISTS giveaways_event_code_ins AFTER INSERT ON giveaways WHEN NEW.event_code IS NULL BEGIN
  UPDATE giveaways SET event_code = 'TT-' || substr(upper(hex(randomblob(4))), 1, 5) WHERE id = NEW.id; END`);
const n = backfill(); if (n) console.log(`[events] ${n} giveaway(s) mapped onto official events (event codes issued)`);

const norm = (c) => String(c || '').trim().toUpperCase();
function find(ref) {
  if (ref == null || ref === '') return null;
  if (/^\d+$/.test(String(ref))) return db.prepare('SELECT * FROM giveaways WHERE id=?').get(+ref) || null;
  return db.prepare('SELECT * FROM giveaways WHERE event_code=?').get(norm(ref)) || null;
}
const gamesOf = (id) => db.prepare('SELECT game_id FROM giveaway_games WHERE giveaway_id=? ORDER BY rowid').all(id).map(r => r.game_id);
// A booking-backed official event must not run until payment is explicitly confirmed.
// Legacy non-booking events stay unaffected; owner-approved comped bookings are allowed.
const bookingPaymentCleared = (g) => !g || !g.booking_id || ['paid', 'comped'].includes(String(g.payment_status || '').toLowerCase());
function status(g, t = Date.now()) {
  if (!g) return 'missing';
  if (g.state === 'cancelled') return 'cancelled';
  if (g.archived) return 'archived';
  if (!bookingPaymentCleared(g)) return 'unpaid';
  if (!g.active || g.state === 'paused') return g.state === 'paused' ? 'paused' : 'draft';
  if (t < g.start_at) return 'scheduled';
  if (t >= g.end_at || g.finalized_at) return 'ended';
  return 'active';
}
const label = (g) => `${(g.vendor || g.host || 'BRAND').toUpperCase()} x GAMING HUB, Official Giveaway #${g.event_code}`;
const sessHash = (req) => { const raw = (String(req.headers.cookie || '').match(/(?:^|;\s*)gh_sess=([^;]+)/) || [])[1] || String(req.headers['x-session'] || ''); return crypto.createHash('sha256').update('sess:' + raw).digest('hex').slice(0, 24); };
const EVENT_TOKEN_TTL_MS = 30 * 60e3; // short-lived

// start: returns { ok, g } or { status, error }
function checkStart(req, user, gameId, ref, t = Date.now()) {
  const g = find(ref);
  if (!g) return { status: 404, error: 'That is not an official Gaming Hub event.' };
  const st = status(g, t);
  if (st !== 'active') return { status: 403, error: st === 'scheduled' ? 'This event has not started yet.' : st === 'ended' ? 'This event has ended.' : st === 'unpaid' ? 'This event is unavailable until its booking payment is confirmed.' : 'This event is not active.' };
  if (!user) return { status: 401, error: 'Please sign in first.' };
  const game = cfg.GAME_MAP[gameId];
  if (!game || !game.giveaway) return { status: 400, error: 'That game cannot count for an official giveaway.' };
  if (!gamesOf(g.id).includes(gameId)) return { status: 400, error: 'That game is not part of this event.' };
  const E = require('./eligibility');
  if (g.require_join) { if (!db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id=? AND user_id=? AND left_at IS NULL').get(g.id, user.id)) return { status: 403, error: 'Enter this event first.' }; }
  // other eligibility rules (win cooldown, activity, brand) are applied at the results lock, where ineligible players are skipped and audited
  return { ok: true, g };
}
// submit: row = run_tokens row. Returns null when fine, else { status, error }
function checkSubmit(req, user, row, tok, t = Date.now()) {
  if (!row.event_id) return null;
  if (tok.e !== row.event_id) return { status: 400, error: 'Event run token does not match this run.' };
  if (row.sess_hash && row.sess_hash !== sessHash(req)) return { status: 403, error: 'Event runs must be submitted from the session that started them.' };
  if (t - row.started_at > EVENT_TOKEN_TTL_MS) return { status: 400, error: 'Event run token expired.' };
  const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(row.event_id);
  if (!g) return { status: 404, error: 'That is not an official Gaming Hub event.' };
  if (!bookingPaymentCleared(g)) return { status: 403, error: 'This event booking payment is not confirmed.', demote: true, paymentUnconfirmed: true };
  // ended (or a run that outlived its event): the run is kept as a free-play run, never as an event entry
  if (t >= g.end_at) return { status: 403, error: 'This event has ended.', demote: true };
  const st = status({ ...g, finalized_at: null }, Math.min(t, g.end_at - 1));
  if (st !== 'active') return { status: 403, error: 'This event is not active.' };
  if (!gamesOf(g.id).includes(row.game_id)) return { status: 400, error: 'That game is not part of this event.' };
  return null;
}
function eventPublic(g, t = Date.now()) {
  return { id: g.id, code: g.event_code, url: `/event/${g.event_code}`, label: label(g), title: g.title, vendor: g.vendor || g.host, host: g.host, prize: g.prize,
    image: g.image, games: gamesOf(g.id), start_at: g.start_at, end_at: g.end_at, status: status(g, t), rules: g.rules, require_join: !!g.require_join };
}
function qrSvg(text) { const qr = require('qrcode-generator')(0, 'M'); qr.addData(text); qr.make(); return qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true }); }

const NOTICE = 'Only giveaways shown in the Official Giveaways section of The Gaming Hub are authorized Gaming Hub competitions. Public game scores do not count as entry into an official giveaway.';

function routes(app, A, H) {
  // Official Giveaways section: active (and upcoming) events only
  app.get('/api/events', (req, res) => {
    const t = Date.now(); const rows = db.prepare('SELECT * FROM giveaways WHERE active=1 AND archived=0 AND end_at > ? ORDER BY start_at').all(t);
    res.json({ ok: true, notice: NOTICE, events: rows.map(g => eventPublic(g, t)).filter(e => e.status === 'active' || e.status === 'scheduled') });
  });
  app.get('/api/event/:code', (req, res) => {
    const g = find(req.params.code); if (!g || /^\d+$/.test(req.params.code)) return res.status(404).json({ ok: false, error: 'That is not an official Gaming Hub event.', notice: NOTICE });
    if (!bookingPaymentCleared(g)) return res.status(404).json({ ok: false, error: 'This event is unavailable.', notice: NOTICE });
    const R = require('./results'); const rows = (H.giveawayEntrants ? H.giveawayEntrants(g) : R.liveStandings(g)).slice(0, 100)
      .map(r => ({ rank: r.rank, username: r.username, score: r.score, cos: r.cos, avatar: r.avatar }));
    res.json({ ok: true, notice: NOTICE, event: eventPublic(g), board: rows, board_label: label(g) });
  });
  // vendor share kit (admin): link + QR code
  A.get('/events/:id/share', (req, res) => {
    const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false, error: 'Unknown event.' });
    const url = PU.originOf(req) + '/event/' + g.event_code;
    res.json({ ok: true, code: g.event_code, url, label: label(g), qr_svg: qrSvg(url), status: status(g), vendor: g.vendor || g.host, booking_status: g.booking_status || null, payment_status: g.payment_status || null, booking_id: g.booking_id || null });
  });
  A.put('/events/:id/meta', (req, res) => {
    const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false, error: 'Unknown event.' });
    const b = req.body || {}; const pick = (v, ok, d) => ok.includes(v) ? v : d;
    const nextPayment = pick(b.payment_status, ['n/a', 'unpaid', 'paid', 'refunded', 'comped'], g.payment_status);
    // For booking-backed events the sponsor quote is the payment source of truth. The legacy
    // event-metadata editor must not bypass the quote's verified-paid transition and unhide an
    // unpaid event. Payment can still be revoked here to block an event immediately.
    if (g.booking_id && ['paid', 'comped'].includes(nextPayment) && String(g.payment_status || '').toLowerCase() !== nextPayment) {
      // This legacy editor is not a payment reconciliation interface. Neither "paid" nor
      // "comped" may be used to bypass the booking's verified quote/payment workflow.
      const quote = db.prepare('SELECT status FROM sponsor_quotes WHERE booking_id=?').get(g.booking_id);
      if (nextPayment === 'comped') return res.status(409).json({ ok: false, error: 'Booking payment cannot be waived from event metadata; use the audited reconciliation workflow.' });
      if (!quote || quote.status !== 'paid') return res.status(409).json({ ok: false, error: 'Booking payment can only be confirmed after its sponsor quote is verified as paid.' });
    }
    db.prepare('UPDATE giveaways SET vendor=?, booking_status=?, payment_status=?, updated_at=? WHERE id=?').run(String(b.vendor ?? g.vendor).slice(0, 80),
      pick(b.booking_status, ['none', 'requested', 'quoted', 'accepted', 'booked'], g.booking_status), nextPayment, Date.now(), g.id);
    res.json({ ok: true, event: eventPublic(find(g.id)) });
  });
  // sudden-death playoff for an exact skill tie on a winning place (src/games-lib-playoff.js; admin page /games-lib/admin-playoffs.html)
  A.get('/events/:id/ties', (req, res) => { const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false });
    const R = require('./results'); const res2 = g.finalized_at ? R.results(g) : null;
    const live = R.liveStandings(g).filter(r => r.exact_tie).map(r => ({ user_id: r.user_id, username: r.username, score: r.score, tdur: r.tdur, skill: r.skill }));
    res.json({ ok: true, finalized: !!g.finalized_at, playoff_needed: res2 ? res2.playoff_needed : null, live_exact_ties: live,
      playoffs: db.prepare('SELECT id FROM lib_playoffs WHERE giveaway_id=? ORDER BY id').all(g.id).map(r => require('./games-lib-playoff').getPlayoff(r.id)) }); });
  A.post('/events/:id/playoff', (req, res) => { const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false, error: 'Unknown event.' });
    const R = require('./results'); const rr = g.finalized_at ? R.results(g) : null; const tied = rr && rr.playoff_needed;
    if (!tied || tied.length < 2) return res.status(400).json({ ok: false, error: 'No exact tie on a winning place (lock the results first).' });
    const top = Math.max(...tied.map(t => t.score)); const ids = tied.filter(t => t.score === top).map(t => t.user_id);
    const gameId = String((req.body && req.body.game_id) || gamesOf(g.id)[0]);
    try { const P = require('./games-lib-playoff'); const p = P.createPlayoff({ giveawayId: g.id, gameId, userIds: ids, windowMin: (req.body && req.body.window_min) || 60, note: 'Official event ' + g.event_code });
      for (const u of ids) require('./notify').notify(u, 'giveaway', `Sudden-death playoff: ${g.title}`, `You are exactly tied for a winning place. Play ONE run of ${(cfg.GAME_MAP[gameId] || {}).title || gameId} before ${new Date(p.closes_at).toLocaleString('en-US', { timeZone: 'America/New_York' })} ET. Everyone gets the same seed.`, `/play/${gameId}?playoff=${p.id}`, 'swords');
      require('./results').audit(g.id, 'admin', 'playoff_started', null, { playoff_id: p.id, game_id: gameId, players: ids });
      res.json({ ok: true, playoff: p }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
  A.post('/events/:id/playoff/:pid/resolve', (req, res) => { const P = require('./games-lib-playoff'); const p = P.getPlayoff(+req.params.pid); const g = find(req.params.id);
    if (!g || !p || p.giveaway_id !== g.id) return res.status(404).json({ ok: false, error: 'Unknown playoff.' });
    try { res.json({ ok: true, playoff: P.resolve(p.id) }); } catch (e) { res.status(400).json({ ok: false, error: e.message }); } });
  // apply a decided playoff to the locked standings: the tied group is reordered by playoff finish (winner first)
  A.post('/events/:id/playoff/:pid/apply', (req, res) => { const g = find(req.params.id); const P = require('./games-lib-playoff');
    let p = P.getPlayoff(+req.params.pid); if (!g || !p || p.giveaway_id !== g.id) return res.status(404).json({ ok: false, error: 'Unknown playoff.' });
    while (p && p.status === 'tied') { const nx = db.prepare('SELECT id FROM lib_playoffs WHERE parent_id=? ORDER BY id DESC LIMIT 1').get(p.id); p = nx ? P.getPlayoff(nx.id) : null; }
    if (!p || p.status !== 'decided') return res.status(409).json({ ok: false, error: 'The playoff is not decided yet (resolve it after its window closes).' });
    const order = [...p.entries].map(e => e.run_id != null ? e : { ...e, score: -1, m1: null, m2: null }).sort((a, b) => P.cmp(p.game_id, a, b));
    const i = order.findIndex(e => e.user_id === p.winner_user_id); if (i > 0) order.unshift(order.splice(i, 1)[0]);
    order.forEach((e, k) => db.prepare('UPDATE giveaway_results SET playoff_pos=? WHERE giveaway_id=? AND user_id=?').run(k + 1, g.id, e.user_id));
    require('./results').audit(g.id, 'admin', 'playoff_applied', null, { playoff_id: p.id, order: order.map(e => e.user_id) });
    res.json({ ok: true, winners: require('./results').results(db.prepare('SELECT * FROM giveaways WHERE id=?').get(g.id)).winners }); });
  A.post('/events/:id/regen-code', (req, res) => { const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false }); const c = newCode(); db.prepare('UPDATE giveaways SET event_code=? WHERE id=?').run(c, g.id); res.json({ ok: true, code: c }); });
}
// called after any giveaway insert so new giveaways always get a code
function ensureCodes() { return backfill(); }
module.exports = { routes, find, status, label, checkStart, checkSubmit, sessHash, eventPublic, qrSvg, newCode, ensureCodes, NOTICE, EVENT_TOKEN_TTL_MS, gamesOf, bookingPaymentCleared };

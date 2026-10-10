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
function status(g, t = Date.now()) {
  if (!g) return 'missing';
  if (g.state === 'cancelled') return 'cancelled';
  if (g.archived) return 'archived';
  if (!g.active || g.state === 'paused') return g.state === 'paused' ? 'paused' : 'draft';
  if (t < g.start_at) return 'scheduled';
  if (t >= g.end_at || g.finalized_at) return 'ended';
  return 'active';
}
const label = (g) => `${(g.vendor || g.host || 'BRAND').toUpperCase()} x GAMING HUB, Official Giveaway #${g.event_code}`;
const sessHash = (req) => { const raw = (String(req.headers.cookie || '').match(/(?:^|;\s*)gh_sess=([^;]+)/) || [])[1] || String(req.headers['x-session'] || ''); return crypto.createHash('sha256').update('sess:' + raw).digest('hex').slice(0, 24); };
const EVENT_TOKEN_TTL_MS = 30 * 60e3; // short-lived
const GRACE_MS = 120e3;

// start: returns { ok, g } or { status, error }
function checkStart(req, user, gameId, ref, t = Date.now()) {
  const g = find(ref);
  if (!g) return { status: 404, error: 'That is not an official Gaming Hub event.' };
  const st = status(g, t);
  if (st !== 'active') return { status: 403, error: st === 'scheduled' ? 'This event has not started yet.' : st === 'ended' ? 'This event has ended.' : 'This event is not active.' };
  if (!user) return { status: 401, error: 'Please sign in first.' };
  const game = cfg.GAME_MAP[gameId];
  if (!game || !game.giveaway) return { status: 400, error: 'That game cannot count for an official giveaway.' };
  if (!gamesOf(g.id).includes(gameId)) return { status: 400, error: 'That game is not part of this event.' };
  const E = require('./eligibility');
  if (g.require_join) { if (!db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id=? AND user_id=? AND left_at IS NULL').get(g.id, user.id)) return { status: 403, error: 'Enter this event first.' }; }
  else { try { const c = E.check(user, g, t); if (c && c.eligible === false) return { status: 403, error: 'You are not eligible for this event.', checks: c.checks }; } catch (e) { /* eligibility is advisory when it fails to compute */ } }
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
  if (t >= g.end_at && !(row.started_at < g.end_at && t - g.end_at <= GRACE_MS)) return { status: 403, error: 'This event has ended.' };
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
    const R = require('./results'); const rows = (H.giveawayEntrants ? H.giveawayEntrants(g) : R.liveStandings(g)).slice(0, 100)
      .map(r => ({ rank: r.rank, username: r.username, score: r.score, cos: r.cos, avatar: r.avatar }));
    res.json({ ok: true, notice: NOTICE, event: eventPublic(g), board: rows, board_label: label(g) });
  });
  // vendor share kit (admin): link + QR code
  A.get('/events/:id/share', (req, res) => {
    const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false, error: 'Unknown event.' });
    const url = PU.originOf(req) + '/event/' + g.event_code;
    res.json({ ok: true, code: g.event_code, url, label: label(g), qr_svg: qrSvg(url), status: status(g) });
  });
  A.put('/events/:id/meta', (req, res) => {
    const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false, error: 'Unknown event.' });
    const b = req.body || {}; const pick = (v, ok, d) => ok.includes(v) ? v : d;
    db.prepare('UPDATE giveaways SET vendor=?, booking_status=?, payment_status=?, updated_at=? WHERE id=?').run(String(b.vendor ?? g.vendor).slice(0, 80),
      pick(b.booking_status, ['none', 'requested', 'quoted', 'accepted', 'booked'], g.booking_status), pick(b.payment_status, ['n/a', 'unpaid', 'paid', 'refunded', 'comped'], g.payment_status), Date.now(), g.id);
    res.json({ ok: true, event: eventPublic(find(g.id)) });
  });
  A.post('/events/:id/regen-code', (req, res) => { const g = find(req.params.id); if (!g) return res.status(404).json({ ok: false }); const c = newCode(); db.prepare('UPDATE giveaways SET event_code=? WHERE id=?').run(c, g.id); res.json({ ok: true, code: c }); });
}
// called after any giveaway insert so new giveaways always get a code
function ensureCodes() { return backfill(); }
module.exports = { routes, find, status, label, checkStart, checkSubmit, sessHash, eventPublic, qrSvg, newCode, ensureCodes, NOTICE, EVENT_TOKEN_TTL_MS, gamesOf };

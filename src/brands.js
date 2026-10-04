'use strict';
// v7 brand affiliation (replaces v5 "brand channels" pages and follows).
// A player belongs to ONE brand at a time. They join through the brand's invite link (/join/<CODE>) or code, or pick a
// brand at signup. Switching to another brand is allowed 30 days after the last join (shown clearly in the UI).
// Giveaways: a giveaway with a brand (giveaways.channel_id) is only for that brand's members, unless the admin marks it
// "open to everyone" (giveaways.open_to_all). Giveaways without a brand are hub-wide (open to everyone).
// Brand registry = the existing `channels` table (same ids, so old giveaways keep their brand).
const crypto = require('crypto');
const db = require('./db');
const D = 864e5;
const COOLDOWN_DAYS = 30;

function cols(t) { return new Set(db.prepare(`PRAGMA table_info(${t})`).all().map(c => c.name)); }
function addCol(t, c, def) { if (!cols(t).has(c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); }
addCol('users', 'brand_id', 'INTEGER');
addCol('users', 'brand_joined_at', 'INTEGER');
addCol('channels', 'invite_code', 'TEXT');
addCol('giveaways', 'open_to_all', 'INTEGER NOT NULL DEFAULT 0');
db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_invite ON channels(invite_code);
CREATE INDEX IF NOT EXISTS idx_users_brand ON users(brand_id);
CREATE TABLE IF NOT EXISTS brand_moves (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, from_brand INTEGER, to_brand INTEGER, via TEXT, at INTEGER NOT NULL);`);
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = () => { for (;;) { const b = crypto.randomBytes(8); let c = ''; for (const x of b) c += ALPH[x % ALPH.length]; if (!db.prepare('SELECT 1 FROM channels WHERE invite_code=?').get(c)) return c; } };
function ensureCodes() { for (const c of db.prepare('SELECT id FROM channels WHERE invite_code IS NULL').all()) db.prepare('UPDATE channels SET invite_code=? WHERE id=?').run(newCode(), c.id); }
ensureCodes();
// one-time migration from v5 follows: a player's brand = the channel they followed most recently; giveaways without a
// channel become hub-wide, channel giveaways become brand-only (and need joining, so the member check always runs).
if (!db.prepare("SELECT 1 FROM settings WHERE key='brands_v7_migrated'").get()) {
  db.transaction(() => {
    const t = Date.now();
    for (const r of db.prepare('SELECT user_id, channel_id, MAX(created_at) AS at FROM channel_follows GROUP BY user_id').all()) {
      // pick the newest follow for each user (SQLite returns the row of MAX(created_at))
      db.prepare('UPDATE users SET brand_id=?, brand_joined_at=? WHERE id=? AND brand_id IS NULL').run(r.channel_id, Math.min(r.at, t - COOLDOWN_DAYS * D), r.user_id);
      db.prepare('INSERT INTO brand_moves (user_id, from_brand, to_brand, via, at) VALUES (?,?,?,?,?)').run(r.user_id, null, r.channel_id, 'v7-migration (followed)', t);
    }
    db.prepare('UPDATE giveaways SET open_to_all=1 WHERE channel_id IS NULL').run();
    // Trap Tech's own house brand runs hub-wide giveaways
    db.prepare("UPDATE giveaways SET open_to_all=1 WHERE channel_id IN (SELECT id FROM channels WHERE slug='trap-tech-drops')").run();
    // live / upcoming brand giveaways that counted every player's runs now need joining: players who already played in the
    // window keep their place (an entry is created for them), ended / locked giveaways are not touched.
    // Players with no brand yet who were competing in a live brand giveaway join the brand they played most for.
    const live = db.prepare('SELECT id, channel_id, start_at, end_at FROM giveaways WHERE channel_id IS NOT NULL AND open_to_all=0 AND require_join=0 AND finalized_at IS NULL AND end_at > ?').all(t);
    const runsIn = (g) => db.prepare(`SELECT r.user_id AS u, COUNT(*) AS n, MIN(r.created_at) AS first FROM runs r JOIN giveaway_games gg ON gg.game_id=r.game_id AND gg.giveaway_id=?
        WHERE r.started_at >= ? AND r.created_at <= ? GROUP BY r.user_id`).all(g.id, g.start_at, g.end_at);
    const best = new Map();
    for (const g of live) for (const r of runsIn(g)) { const k = best.get(r.u) || {}; k[g.channel_id] = (k[g.channel_id] || 0) + r.n; best.set(r.u, k); }
    for (const [u, m] of best) { const bid = +Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
      if (db.prepare('UPDATE users SET brand_id=?, brand_joined_at=? WHERE id=? AND brand_id IS NULL').run(bid, t - COOLDOWN_DAYS * D, u).changes)
        db.prepare('INSERT INTO brand_moves (user_id, from_brand, to_brand, via, at) VALUES (?,?,?,?,?)').run(u, null, bid, 'v7-migration (played)', t); }
    for (const g of live) {
      for (const r of runsIn(g)) if (db.prepare('SELECT 1 FROM users WHERE id=? AND brand_id=?').get(r.u, g.channel_id))
        db.prepare('INSERT OR IGNORE INTO giveaway_entries (giveaway_id, user_id, joined_at, left_at) VALUES (?,?,?,NULL)').run(g.id, r.u, r.first);
      db.prepare('UPDATE giveaways SET require_join=1 WHERE id=?').run(g.id);
    }
    db.prepare("INSERT INTO settings (key,value,updated_at) VALUES ('brands_v7_migrated',?,?)").run(JSON.stringify({ at: t }), t);
  })();
}

const brandById = (id) => id ? db.prepare('SELECT * FROM channels WHERE id=?').get(id) : null;
const pubBrand = (c, full = false) => c && ({ id: c.id, slug: c.slug, name: c.name, tagline: c.tagline, logo: c.logo, color: c.color, demo: !!c.is_demo,
  ...(full ? { members: db.prepare('SELECT COUNT(*) AS c FROM users WHERE brand_id=? AND banned=0').get(c.id).c,
    live: db.prepare('SELECT COUNT(*) AS c FROM giveaways WHERE channel_id=? AND active=1 AND start_at<=? AND end_at>?').get(c.id, Date.now(), Date.now()).c } : {}) });
function status(userId, t = Date.now()) {
  const u = db.prepare('SELECT brand_id, brand_joined_at FROM users WHERE id=?').get(userId) || {};
  const b = brandById(u.brand_id);
  const canAt = u.brand_joined_at ? u.brand_joined_at + COOLDOWN_DAYS * D : 0;
  return { brand: b && b.active ? pubBrand(b) : null, joined_at: u.brand_joined_at || null, can_switch: !u.brand_joined_at || t >= canAt, can_switch_at: canAt || null, cooldown_days: COOLDOWN_DAYS };
}
const findBrand = (code) => {
  const s = String(code || '').trim(); if (!s) return null;
  return db.prepare('SELECT * FROM channels WHERE active=1 AND (invite_code=? OR slug=?)').get(s.toUpperCase().replace(/[^A-Z0-9]/g, ''), s.toLowerCase()) || null;
};
// join / switch. Leaving entries of the old brand's live giveaways keeps the "own brand only" rule true.
function join(userId, code, via = 'code', t = Date.now()) {
  const b = findBrand(code); if (!b) return { ok: false, error: 'That brand code or link is not valid.' };
  const st = status(userId, t); const cur = db.prepare('SELECT brand_id FROM users WHERE id=?').get(userId);
  if (cur && cur.brand_id === b.id) return { ok: true, already: true, ...status(userId, t) };
  if (cur && cur.brand_id && !st.can_switch) return { ok: false, error: `You can switch brands once every ${COOLDOWN_DAYS} days. You can switch from ${new Date(st.can_switch_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' })}.`, ...st };
  const left = [];
  db.transaction(() => {
    if (cur && cur.brand_id) for (const g of db.prepare(`SELECT g.id, g.title FROM giveaway_entries e JOIN giveaways g ON g.id=e.giveaway_id WHERE e.user_id=? AND e.left_at IS NULL AND g.channel_id=? AND g.open_to_all=0 AND g.finalized_at IS NULL AND g.end_at > ?`).all(userId, cur.brand_id, t)) {
      db.prepare('UPDATE giveaway_entries SET left_at=? WHERE giveaway_id=? AND user_id=?').run(t, g.id, userId); left.push(g.title);
    }
    db.prepare('UPDATE users SET brand_id=?, brand_joined_at=? WHERE id=?').run(b.id, t, userId);
    db.prepare('INSERT INTO brand_moves (user_id, from_brand, to_brand, via, at) VALUES (?,?,?,?,?)').run(userId, cur ? cur.brand_id : null, b.id, via, t);
  })();
  return { ok: true, switched: !!(cur && cur.brand_id), left_giveaways: left, ...status(userId, t) };
}
function leave(userId, t = Date.now()) {
  const cur = db.prepare('SELECT brand_id FROM users WHERE id=?').get(userId); if (!cur || !cur.brand_id) return { ok: false, error: 'You are not in a brand.' };
  db.transaction(() => {
    db.prepare(`UPDATE giveaway_entries SET left_at=? WHERE user_id=? AND left_at IS NULL AND giveaway_id IN (SELECT id FROM giveaways WHERE channel_id=? AND open_to_all=0 AND finalized_at IS NULL AND end_at > ?)`).run(t, userId, cur.brand_id, t);
    db.prepare('UPDATE users SET brand_id=NULL WHERE id=?').run(userId); // joined_at stays: the cooldown still counts from the last join
    db.prepare('INSERT INTO brand_moves (user_id, from_brand, to_brand, via, at) VALUES (?,?,?,?,?)').run(userId, cur.brand_id, null, 'left', t);
  })();
  return { ok: true, ...status(userId, t) };
}
// giveaway audience: { open, brand } and whether a user may enter
function audience(g) { const b = g.channel_id ? brandById(g.channel_id) : null; return { open: !b || !!g.open_to_all, brand: b ? pubBrand(b) : null }; }
function allowed(userId, g) {
  const a = audience(g); if (a.open) return { ok: true, ...a };
  const u = db.prepare('SELECT brand_id FROM users WHERE id=?').get(userId);
  return { ok: !!(u && u.brand_id === g.channel_id), ...a };
}
const RULE_TEXT = (g) => { const a = audience(g); return a.open ? 'Open to everyone: every eligible hub player can enter, whatever brand they belong to.' : `${a.brand.name} members only: players affiliated with ${a.brand.name} can enter. Each player belongs to one brand at a time (join with the brand's invite link or code; switching is allowed once every ${COOLDOWN_DAYS} days).`; };

function routes(app, A, h) {
  const { bad, requireUser, currentUser, limiter, str } = h;
  app.get('/api/brands', (req, res) => res.json({ ok: true, brands: db.prepare('SELECT * FROM channels WHERE active=1 ORDER BY is_demo, name').all().map(c => pubBrand(c, true)), cooldown_days: COOLDOWN_DAYS }));
  app.get('/api/brands/invite/:code', limiter('brand-inv', 120, 600e3), (req, res) => { const b = findBrand(req.params.code); if (!b) return bad(res, 404, 'That invite link is not valid.'); const me = currentUser(req); res.json({ ok: true, brand: pubBrand(b, true), me: me ? status(me.id) : null, cooldown_days: COOLDOWN_DAYS }); });
  app.get('/api/me/brand', requireUser, (req, res) => res.json({ ok: true, ...status(req.user.id) }));
  app.post('/api/me/brand', requireUser, limiter('brand-join', 20, 3600e3), (req, res) => { const r = join(req.user.id, str(req.body.code, 40), req.body.via === 'signup' ? 'signup' : req.body.via === 'link' ? 'invite link' : 'code'); r.ok ? res.json(r) : bad(res, 400, r.error, r); });
  app.post('/api/me/brand/leave', requireUser, limiter('brand-join', 20, 3600e3), (req, res) => { const r = leave(req.user.id); r.ok ? res.json(r) : bad(res, 400, r.error); });
  // admin: invite codes + member counts for the brand list; set a giveaway's audience
  A.get('/brands', (req, res) => { ensureCodes(); res.json({ ok: true, brands: db.prepare('SELECT * FROM channels ORDER BY name').all().map(c => ({ ...pubBrand(c, true), invite_code: c.invite_code, invite_path: '/join/' + c.invite_code, active: !!c.active, link_url: c.link_url, business_type: c.business_type })), cooldown_days: COOLDOWN_DAYS }); });
  A.post('/brands/:id/new-code', (req, res) => { const c = brandById(+req.params.id); if (!c) return bad(res, 404, 'Not found'); const code = newCode(); db.prepare('UPDATE channels SET invite_code=? WHERE id=?').run(code, c.id); res.json({ ok: true, invite_code: code }); });
  A.put('/giveaways/:id/audience', (req, res) => {
    const g = db.prepare('SELECT * FROM giveaways WHERE id=?').get(req.params.id); if (!g) return bad(res, 404, 'Not found');
    const bid = req.body.brand_id === null || req.body.brand_id === '' ? null : parseInt(req.body.brand_id, 10) || g.channel_id;
    if (bid && !brandById(bid)) return bad(res, 400, 'Unknown brand.');
    const open = bid ? (req.body.open_to_all ? 1 : 0) : 1;
    db.prepare('UPDATE giveaways SET channel_id=?, open_to_all=?, require_join=CASE WHEN ?=0 THEN 1 ELSE require_join END, updated_at=? WHERE id=?').run(bid, open, open, Date.now(), g.id);
    res.json({ ok: true, audience: audience(db.prepare('SELECT * FROM giveaways WHERE id=?').get(g.id)) });
  });
}
module.exports = { COOLDOWN_DAYS, status, join, leave, audience, allowed, findBrand, pubBrand, RULE_TEXT, routes, ensureCodes };

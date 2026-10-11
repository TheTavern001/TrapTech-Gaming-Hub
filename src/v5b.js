'use strict';
// v5 part 2: Hub Points + cosmetics shop, unique badge art, admin-granted badges, fair-play (anti-cheat) review queue.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const ach = require('./achievements');
const SH = require('./shop');
const AC = require('./anticheat');

let ICONS = {};
try { ICONS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'icons.js'), 'utf8').match(/export const ICONS=(\{.*?\});/s)[1]); } catch (e) { console.error('icons parse', e.message); }

module.exports = function v5b(app, A, h) {
  const { now, bad, requireUser, limiter, str, logActivity } = h;
  // one-time renames (referral cosmetics must not sound like vendors or staff)
  db.prepare("UPDATE users SET eq_title='crew-builder' WHERE eq_title='recruiter'").run();
  db.prepare("UPDATE users SET eq_title='squad-goals' WHERE eq_title='ambassador'").run();
  db.prepare("UPDATE users SET eq_banner='crew-beacon' WHERE eq_banner='recruiter'").run();

  h.meV5 = (u) => ({ points: SH.balance(u.id), staff: !!db.prepare("SELECT 1 FROM badge_grants WHERE user_id=? AND badge_id = 'staff'").get(u.id) });
  // ---------- Points + shop ----------
  // v7: daily / weekly featured / season shop / events / earned, from the economy engine (src/shop.js, docs/ECONOMY.md). Open to guests.
  app.get('/api/shop', (req, res) => {
    const me = h.currentUser(req); const bal = me ? SH.sync(me.id) : 0; const own = me ? SH.owned(me.id) : new Set(); const v = SH.view(me);
    const mine = [...own].map(id => SH.BY_ID[id]).filter(Boolean);
    res.json({ ok: true, signed_in: !!me, balance: bal, earned: me ? SH.earned(me.id) : 0, ...v, owned: mine.map(i => SH.pub(i, true)), total_items: SH.ITEMS.length,
      earn: SH.EARN, rarity: SH.RARITY, themes: SH.THEMES, now: now(), disclaimer: SH.DISCLAIMER });
  });
  SH.routes(app, A, h); require('./seasons').routes(app, A, h);
  app.post('/api/shop/buy', requireUser, limiter('shopbuy', 20, 60e3), (req, res) => {
    const r = SH.buy(req.user, str(req.body.item, 60)); if (!r.ok) return bad(res, 400, r.error);
    res.json(r);
  });
  app.get('/api/me/points', requireUser, (req, res) => {
    const bal = SH.sync(req.user.id);
    res.json({ ok: true, balance: bal, earned: SH.earned(req.user.id), history: db.prepare('SELECT amount, reason, ref, created_at FROM points_ledger WHERE user_id=? AND amount<>0 ORDER BY created_at DESC, id DESC LIMIT 40').all(req.user.id) });
  });

  // ---------- badge art ----------
  app.get('/badges/:id.svg', (req, res) => {
    const id = String(req.params.id); const a = ach.BY_ID[id]; const adm = id.startsWith('adm:') ? ach.ADMIN_BY[id.slice(4)] : null;
    const svg = ach.badgeSvg(id, ICONS[(a && a.icon) || (adm && adm.icon)] || '');
    if (!svg) return res.status(404).end();
    res.setHeader('Content-Type', 'image/svg+xml'); res.setHeader('Cache-Control', 'public, max-age=86400'); res.send(svg);
  });
  // special (admin-granted) badges for a profile / achievements page
  app.get('/api/users/:username/special-badges', (req, res) => {
    const u = db.prepare('SELECT id FROM users WHERE username=? AND banned=0').get(String(req.params.username)); if (!u) return bad(res, 404, 'Player not found.');
    res.json({ ok: true, granted: ach.grantsOf(u.id).map(g => ({ ...ach.ADMIN_BY[g.badge_id], granted_at: g.created_at, art: `/badges/adm:${g.badge_id}.svg` })),
      all: ach.ADMIN_BADGES.map(b => ({ ...b, art: `/badges/adm:${b.id}.svg` })) });
  });

  // ---------- admin: grant / revoke badges ----------
  const findUser = (name) => db.prepare('SELECT id, username FROM users WHERE username=?').get(String(name || '').trim().replace(/^@/, ''));
  A.get('/badges', (req, res) => res.json({ ok: true, badges: ach.ADMIN_BADGES.map(b => ({ ...b, art: `/badges/adm:${b.id}.svg`, holders: db.prepare('SELECT COUNT(*) AS c FROM badge_grants WHERE badge_id=?').get(b.id).c })),
    grants: db.prepare('SELECT g.badge_id, g.granted_by, g.note, g.created_at, u.username FROM badge_grants g JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 300').all(),
    audit: db.prepare('SELECT * FROM badge_audit ORDER BY id DESC LIMIT 200').all() }));
  A.post('/badges/grant', (req, res) => {
    const u = findUser(req.body.username); if (!u) return bad(res, 404, 'No player with that username.');
    const b = ach.ADMIN_BY[String(req.body.badge)]; if (!b) return bad(res, 400, 'Unknown badge.');
    const note = str(req.body.note, 200); const t = now();
    const r = db.prepare('INSERT OR IGNORE INTO badge_grants (user_id, badge_id, granted_by, note, created_at) VALUES (?,?,?,?,?)').run(u.id, b.id, 'admin', note, t);
    if (!r.changes) return bad(res, 409, `${u.username} already has ${b.name}.`);
    db.prepare('INSERT INTO badge_audit (user_id, username, badge_id, action, actor, note, created_at) VALUES (?,?,?,?,?,?,?)').run(u.id, u.username, b.id, 'grant', 'admin', note, t);
    try { require('./notify').notify(u.id, 'achievement', `You received the ${b.name} badge`, `${b.desc}. Equip it from Achievements > Cosmetics.`, '/achievements', b.icon); } catch (e) { /* optional */ }
    res.json({ ok: true });
  });
  A.post('/badges/revoke', (req, res) => {
    const u = findUser(req.body.username); if (!u) return bad(res, 404, 'No player with that username.');
    const b = ach.ADMIN_BY[String(req.body.badge)]; if (!b) return bad(res, 400, 'Unknown badge.');
    const r = db.prepare('DELETE FROM badge_grants WHERE user_id=? AND badge_id=?').run(u.id, b.id); if (!r.changes) return bad(res, 404, `${u.username} does not have ${b.name}.`);
    db.prepare("UPDATE users SET eq_badge='' WHERE id=? AND eq_badge=?").run(u.id, 'adm:' + b.id);
    if (b.id === 'staff' || b.id === 'traptech-team') { const left = db.prepare("SELECT 1 FROM badge_grants WHERE user_id=? AND badge_id IN ('staff','traptech-team')").get(u.id); if (!left) db.prepare("UPDATE users SET eq_frame='none' WHERE id=? AND eq_frame='staff-glow'").run(u.id); }
    db.prepare('INSERT INTO badge_audit (user_id, username, badge_id, action, actor, note, created_at) VALUES (?,?,?,?,?,?,?)').run(u.id, u.username, b.id, 'revoke', 'admin', str(req.body.note, 200), now());
    res.json({ ok: true });
  });

  // ---------- admin: fair-play review queue ----------
  A.get('/flags', (req, res) => {
    const status = ['open', 'note', 'cleared', 'confirmed'].includes(req.query.status) ? req.query.status : 'open';
    const rows = db.prepare(`SELECT f.*, u.username, u.potato, r.duration_ms, r.created_at - r.started_at AS elapsed_ms, r.verify, r.held FROM run_flags f JOIN runs r ON r.id=f.run_id JOIN users u ON u.id=f.user_id WHERE f.status=? ORDER BY f.created_at DESC LIMIT 200`).all(status)
      .map(f => ({ ...f, reasons: JSON.parse(f.reasons || '[]'), history: db.prepare('SELECT score, created_at FROM runs WHERE user_id=? AND game_id=? AND id<>? ORDER BY id DESC LIMIT 10').all(f.user_id, f.game_id, f.run_id) }));
    res.json({ ok: true, status, flags: rows, counts: Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS c FROM run_flags GROUP BY status').all().map(r => [r.status, r.c])) });
  });
  A.post('/flags/:run/:act(clear|confirm)', (req, res) => {
    const r = AC.review(+req.params.run, req.params.act, 'admin', str(req.body && req.body.note, 300)); if (!r.ok) return bad(res, 404, r.error);
    const f = db.prepare('SELECT * FROM run_flags WHERE run_id=?').get(+req.params.run);
    if (req.params.act === 'clear') try { require('./notify').notify(f.user_id, 'system', 'Your score was verified', `Your ${f.score.toLocaleString('en-US')} run passed fair-play review and now counts on the leaderboards.`, '/leaderboard?game=' + f.game_id, 'badge-check'); } catch (e) { /* optional */ }
    res.json({ ok: true });
  });
};

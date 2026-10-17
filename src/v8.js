'use strict';
// v8 systems routes: skill quests + achievements at scale, cosmetic universe browsing helpers.
// (Brand pages / booking / privacy / checkout live in their own modules, mounted from here.)
const SK = require('./skill-engine');
module.exports = function v8(app, A, H) {
  require('./v8-sec').routes(app, A, H); // account export + self-service deletion
  const { bad, requireUser, currentUser, limiter } = H;
  app.get('/api/skill/quests', requireUser, limiter('skillq', 90, 60e3), (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { SK.evaluate(req.user.id, null); } catch {}
    res.json({ ok: true, ...SK.board(req.user.id) });
  });
  app.post('/api/skill/quests/claim', requireUser, limiter('skillclaim', 40, 60e3), (req, res) => {
    const id = String((req.body || {}).id || '').slice(0, 160);
    const r = SK.claim(req.user.id, id);
    if (!r.ok) return bad(res, 400, r.error);
    res.json({ ok: true, ...r, board: SK.board(req.user.id) });
  });
  app.get('/api/skill/achievements', limiter('skillach', 90, 60e3), (req, res) => {
    const me = currentUser(req);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, signed_in: !!me, ...SK.summary(me ? me.id : 0) });
  });
  app.get('/api/skill/achievements/:game', limiter('skillach', 120, 60e3), (req, res) => {
    const me = currentUser(req); const id = String(req.params.game || '').slice(0, 64);
    const r = SK.listFor(me ? me.id : 0, id, String(req.query.family || '').slice(0, 10) || null);
    if (!r) return bad(res, 404, 'Unknown game.');
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, signed_in: !!me, ...r });
  });

  // ---------- brand profile pages + Featured Brands (facts only: no reach / follower / sales promises) ----------
  const db = require('./db'); const B = require('./brands');
  try { const cols = db.prepare('PRAGMA table_info(channels)').all().map(c => c.name); if (!cols.includes('featured')) db.exec('ALTER TABLE channels ADD COLUMN featured INTEGER NOT NULL DEFAULT 0'); if (!cols.includes('about')) db.exec("ALTER TABLE channels ADD COLUMN about TEXT NOT NULL DEFAULT ''"); } catch {}
  const t0 = () => Date.now();
  const gwBrief = (g) => ({ id: g.id, title: g.title, prize: g.prize, start_at: g.start_at, end_at: g.end_at, audience: g.audience === 'invite' ? 'invite' : (g.channel_id && !g.open_to_all) ? 'affiliated' : 'open' });
  const brandCard = (c) => { const t = t0(); const live = db.prepare('SELECT COUNT(*) AS n FROM giveaways WHERE channel_id=? AND active=1 AND start_at<=? AND end_at>?').get(c.id, t, t).n;
    return { slug: c.slug, name: c.name, tagline: c.tagline, logo: c.logo, color: c.color, live, members: db.prepare('SELECT COUNT(*) AS n FROM users WHERE brand_id=? AND banned=0').get(c.id).n }; };
  app.get('/api/brands/featured', limiter('brandfeat', 90, 60e3), (req, res) => {
    const rows = db.prepare('SELECT * FROM channels WHERE active=1 ORDER BY featured DESC, is_demo ASC, name LIMIT 60').all().map(brandCard)
      .sort((a, b) => (b.live > 0) - (a.live > 0)).slice(0, 10);
    res.setHeader('Cache-Control', 'public, max-age=60'); res.json({ ok: true, brands: rows });
  });
  app.get('/api/brand/:slug', limiter('brandpage', 90, 60e3), (req, res) => {
    const c = db.prepare('SELECT * FROM channels WHERE slug=? AND active=1').get(String(req.params.slug || '').toLowerCase().slice(0, 60)); if (!c) return bad(res, 404, 'Brand not found.');
    const t = t0(); const me = currentUser(req);
    const live = db.prepare('SELECT * FROM giveaways WHERE channel_id=? AND active=1 AND start_at<=? AND end_at>? ORDER BY end_at').all(c.id, t, t).map(gwBrief);
    const upcoming = db.prepare('SELECT * FROM giveaways WHERE channel_id=? AND active=1 AND start_at>? ORDER BY start_at LIMIT 10').all(c.id, t).map(gwBrief);
    const past = db.prepare('SELECT * FROM giveaways WHERE channel_id=? AND active=1 AND end_at<=? ORDER BY end_at DESC LIMIT 12').all(c.id, t).map(gwBrief);
    const done = db.prepare('SELECT COUNT(*) AS n FROM giveaways WHERE channel_id=? AND active=1 AND end_at<=?').get(c.id, t).n;
    const mine = me ? B.status(me.id).brand : null;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, brand: { ...brandCard(c), about: c.about || '', link: c.link_url ? { url: c.link_url, label: c.link_label || 'Visit brand' } : null }, live, upcoming, past, giveaways_hosted: done,
      affiliated: !!(mine && mine.id === c.id), signed_in: !!me,
      facts_note: 'Facts about this brand on the Hub. We do not promise followers, subscribers, traffic or sales to any brand.' });
  });
  if (A) {
    A.put('/brands/:id/featured', (req, res) => { const r = db.prepare('UPDATE channels SET featured=? WHERE id=?').run((req.body && req.body.featured) ? 1 : 0, +req.params.id); r.changes ? res.json({ ok: true }) : bad(res, 404, 'Brand not found.'); });
    A.put('/brands/:id/about', (req, res) => { const r = db.prepare('UPDATE channels SET about=? WHERE id=?').run(String((req.body && req.body.about) || '').trim().slice(0, 600), +req.params.id); r.changes ? res.json({ ok: true }) : bad(res, 404, 'Brand not found.'); });
  }
};

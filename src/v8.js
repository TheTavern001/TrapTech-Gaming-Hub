'use strict';
// v8 systems routes: skill quests + achievements at scale, cosmetic universe browsing helpers.
// (Brand pages / booking / privacy / checkout live in their own modules, mounted from here.)
const SK = require('./skill-engine');
module.exports = function v8(app, A, H) {
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
};

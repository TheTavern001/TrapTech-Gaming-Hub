'use strict';
// v7 items 22-23: wiring for the admin overhaul. server.js calls early() before its routes and routes(app, A, H) once the
// shared helpers exist. Everything admin goes on ADMSEC.M (the per-account router at /<ADMIN_PATH>/api, moderator+),
// each route gated by the permission matrix (src/admin-roles.js perm()) and logged to the action log (RO.act).
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('./db');
const cfg = require('./config');
const ADMSEC = require('./admin-sec');
const RO = require('./admin-roles');
const G = require('./admin-giveaways');
const SC = require('./admin-scoring');
const MEDIA = require('./admin-media');
const U = require('./admin-users');
const OPS = require('./admin-ops');
const PROF = require('./admin-profiles');
const R = require('./results');
const E = require('./eligibility');
const now = () => Date.now();
const perm = RO.perm;
const UI_DIR = path.join(__dirname, 'admin-ui');
const sub = (s) => { const B = ADMSEC.BASE(); return s.replace(/(['"`])\/api\/admin(?=[/'"`?$])/g, `$1${B}/api`).replace(/(['"`])\/admin(?=[/'"`?$])/g, `$1${B}`); };
const send = (res, r, okStatus = 200) => res.status(r && r.ok === false ? (r.status || 400) : okStatus).json(r);
const actor = (req) => RO.who(req).username;

function early(req, res, next) { U.track(req, res, () => OPS.maintenanceGate(req, res, next)); }

function routes(app, A, H) {
  const { bad, requireUser, currentUser, limiter } = H;
  // ---------- boot ----------
  try { const n = G.migrate(); if (n) console.log(`[admin-v7] ${n} giveaways migrated to the builder model (cfg only, scoring unchanged)`); } catch (e) { console.error('[admin-v7] migrate failed', e); }
  OPS.init();
  R.scoring = SC;                                 // builder score rules (results.liveStandings)
  E.extra.push(G.extraChecks);                    // paused / 21+ / regions / capacity checks
  H.v7Giveaway = (g, out) => Object.assign(out, G.publicExtras(g, out));
  H.v7Hidden = (g) => G.boardHidden(g);
  H.v7Rule = (g) => g && g.v7 ? SC.ruleText(g) : null;
  H.trackLogin = U.trackLogin;
  setInterval(() => { try { G.sweep(); OPS.sweep(); U.unsuspendExpired(); } catch (e) { console.error('[admin-v7] sweep', e.message); } }, 30e3).unref();
  setTimeout(() => { try { G.sweep(); OPS.sweep(); U.unsuspendExpired(); } catch {} }, 4000).unref();

  // ---------- public ----------
  MEDIA.serve(app);
  app.get('/api/site-config', (req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.json(OPS.publicConfig()); });
  app.get('/g/:slug', (req, res) => { const g = db.prepare('SELECT id FROM giveaways WHERE slug=? AND active=1').get(String(req.params.slug).slice(0, 80)); res.redirect(302, g ? `/giveaways/${g.id}` : '/giveaways'); });
  app.post('/api/me/region', requireUser, (req, res) => {
    const r = String((req.body || {}).region || '').toUpperCase(); if (!G.REGIONS.includes(r)) return bad(res, 400, 'Pick your US state.');
    db.prepare('UPDATE users SET region=? WHERE id=?').run(r, req.user.id); res.json({ ok: true, region: r });
  });
  app.post('/api/report', requireUser, limiter('report', 10, 3600e3), (req, res) => send(res, U.fileReport(req.user, req.body || {})));
  app.get('/api/report/reasons', (req, res) => res.json({ ok: true, reasons: U.REPORT_REASONS }));
  // player password reset (one-time link or code an admin gave them on Potato)
  app.get('/reset-password', (req, res) => { res.setHeader('Cache-Control', 'no-store'); res.setHeader('Referrer-Policy', 'no-referrer'); res.type('html').send(RESET_HTML); });
  app.post('/api/auth/reset', limiter('pw-reset', 10, 900e3), (req, res) => { const r = U.redeemReset(req.body || {}); res.status(r.ok ? 200 : (r.status || 400)).json(r); });
  // staff invite links: /<ADMIN_PATH>/join/<token> (registered before the admin router so it isn't swallowed by its shell route)
  const B = ADMSEC.BASE();
  if (B) {
    const secH = (res) => { res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
      res.setHeader('X-Robots-Tag', 'noindex, nofollow'); res.setHeader('Referrer-Policy', 'no-referrer'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Frame-Options', 'DENY'); };
    app.get(`${B}/join/:token`, (req, res) => { secH(res); const inv = RO.inviteByToken(String(req.params.token)); const st = RO.inviteState(inv);
      res.type('html').send(JOIN_HTML(st, inv ? inv.role : '', B)); });
    app.get(`${B}/join.js`, (req, res) => { secH(res); res.type('application/javascript').send(sub(fs.readFileSync(path.join(UI_DIR, 'join.js'), 'utf8'))); });
    app.post(`${B}/join-api`, limiter('adm-join', 10, 900e3), async (req, res) => {
      secH(res); if (String(req.headers['sec-fetch-site'] || '') === 'cross-site') return bad(res, 403, 'Cross-site request blocked.');
      const b = req.body || {}; const r = await RO.acceptInvite(String(b.token || ''), { username: String(b.username || '').trim(), password: String(b.password || ''), display_name: String(b.display_name || '') });
      res.status(r.ok ? 200 : 400).json(r.ok ? { ok: true, username: r.username, role: r.role, login: B + '/' } : r);
    });
  }

  // ---------- admin (ADMSEC.M = /<ADMIN_PATH>/api, moderator+) ----------
  const M = ADMSEC.M;
  M.use(['/bookings', '/sponsor'], perm('billing.view'));     // billing + quotes: owner only (falls through to the site worker's routes)
  // static UI modules (same /api/admin -> secret path rewrite as admin.js)
  M.get('/ui/:file', (req, res) => {
    const f = String(req.params.file); if (!/^admin-[a-z0-9-]+\.(js|css)$/.test(f)) return res.status(404).end();
    const p = path.join(UI_DIR, f); if (!fs.existsSync(p)) return res.status(404).end();
    res.setHeader('Cache-Control', 'no-cache'); res.type(f.endsWith('.css') ? 'text/css' : 'application/javascript').send(f.endsWith('.js') ? sub(fs.readFileSync(p, 'utf8')) : fs.readFileSync(p, 'utf8'));
  });
  M.get('/v7/me', (req, res) => { const w = RO.who(req); const acc = ADMSEC.accounts ? ADMSEC.accounts.get(w.id) : null;
    res.json({ ok: true, admin: { id: w.id, username: w.username, role: w.role, display_name: (acc && acc.display_name) || w.username }, perms: RO.permsFor(w.role), org: 'Trap Tech Solutions', site: OPS.site().name,
      counts: { flags: db.prepare("SELECT COUNT(*) AS c FROM run_flags WHERE status='open'").get().c, reports: db.prepare("SELECT COUNT(*) AS c FROM reports WHERE status='open'").get().c,
        drafts: db.prepare('SELECT COUNT(*) AS c FROM gw_drafts').get().c, review: db.prepare("SELECT COUNT(*) AS c FROM giveaways g WHERE g.finalized_at IS NOT NULL AND g.state<>'cancelled' AND COALESCE(g.archived,0)=0 AND EXISTS (SELECT 1 FROM giveaway_results r WHERE r.giveaway_id=g.id) AND g.finalized_at > ?").get(now() - 30 * 864e5).c } }); });

  // ===== giveaways builder =====
  const gwRow = (req, res) => { const g = G.getRow(+req.params.id); if (!g) { bad(res, 404, 'Giveaway not found.'); return null; } return g; };
  M.get('/v7/gw/meta', perm('giveaways.view'), (req, res) => {
    const games = cfg.GAMES.map(x => ({ id: x.id, title: x.title, art: x.art, eligible: G.eligible(x.id), playable: x.playable !== false, desc: x.desc || x.tagline || '' }));
    res.json({ ok: true, prize_types: G.PRIZE_TYPES, score_rules: G.SCORE_RULES, regions: G.REGIONS, themes: G.THEMES, presets: G.PRESETS, features: G.FEATURES, games, tz: cfg.TZ, blank: G.blank(),
      brands: db.prepare('SELECT id, name, slug, color, logo FROM channels WHERE active=1 ORDER BY name').all(), templates: db.prepare('SELECT id, name, created_at, created_by FROM gw_templates ORDER BY id DESC').all(),
      media_sizes: MEDIA.SIZES, migration: RO.getS('gw_migration_v7', null),
      profiles: Object.fromEntries(cfg.GAMES.map(x => [x.id, PROF.get(x.id)])), defaults: Object.fromEntries(cfg.GAMES.map(x => [x.id, PROF.builderDefaults(x.id)])), comp: PROF.COMP, ac_levels: PROF.AC, winner_rule: PROF.WINNER_RULE });
  });
  M.get('/v7/gw', perm('giveaways.view'), (req, res) => {
    const t = now(); const rows = db.prepare('SELECT * FROM giveaways ORDER BY COALESCE(archived,0) ASC, start_at DESC LIMIT 500').all();
    const list = rows.map(g => { const games = R.gamesOf(g.id); return { id: g.id, title: g.title, host: g.host, image: g.image, start_at: g.start_at, end_at: g.end_at, state: G.lifecycle(g, t), v7: !!g.v7, demo: !!g.is_demo, series_id: g.series_id, occurrence: g.occurrence,
      games, win_method: g.win_method, winners: R.winnerCount(g), finalized_at: g.finalized_at, publish_at: g.publish_at, featured: !!g.featured, archived: !!g.archived, slug: g.slug,
      entrants: g.require_join ? db.prepare('SELECT COUNT(*) AS c FROM giveaway_entries WHERE giveaway_id=? AND left_at IS NULL').get(g.id).c : null }; });
    const drafts = db.prepare('SELECT id, giveaway_id, title, updated_at, updated_by, created_at FROM gw_drafts ORDER BY updated_at DESC').all();
    const series = db.prepare('SELECT id, freq, every, max_count, until_at, made, active, last_id FROM gw_series ORDER BY id DESC').all();
    res.json({ ok: true, giveaways: list, drafts, series, now: t });
  });
  M.post('/v7/gw/drafts', perm('giveaways.edit'), (req, res) => {
    const b = req.body || {}; let c;
    if (b.template) { const tp = db.prepare('SELECT data FROM gw_templates WHERE id=?').get(+b.template); if (!tp) return bad(res, 404, 'Template not found.'); c = G.normalize(JSON.parse(tp.data)); c.schedule = G.blank().schedule; c.basics.slug = ''; c.runtime = {}; }
    else if (b.duplicate) { const g = G.getRow(+b.duplicate); if (!g) return bad(res, 404, 'Giveaway not found.'); const id = G.duplicate(G.cfgOf(g), actor(req)); RO.act(req, 'giveaway.duplicate', 'giveaway:' + g.id, `draft ${id}`); return res.json({ ok: true, id }); }
    else c = G.blank(b.data ? G.normalize(b.data) : {});
    if (b.game && G.eligible(String(b.game))) { const pd = PROF.builderDefaults(String(b.game)); c.games.ids = [String(b.game)]; c.games.weights = {}; if (pd) { Object.assign(c.games, { competition: pd.competition, score_rule: pd.score_rule, attempts: pd.attempts, run_cap_sec: pd.run_cap_sec, profile_from: pd.game_id }); if (pd.recommended_hours) c.schedule.end_at = c.schedule.start_at + pd.recommended_hours * 3600e3; }
      const gm = cfg.GAME_MAP[String(b.game)]; if (gm) Object.assign(c.media, { source: 'game', game_thumb: gm.id, image: gm.art }); }
    const id = G.newDraft(G.normalize(c), actor(req)); RO.act(req, 'giveaway.draft_new', 'draft:' + id); res.json({ ok: true, id });
  });
  M.get('/v7/gw/drafts/:id', perm('giveaways.view'), (req, res) => {
    const d = db.prepare('SELECT * FROM gw_drafts WHERE id=?').get(+req.params.id); if (!d) return bad(res, 404, 'Draft not found.');
    const c = G.normalize(JSON.parse(d.data)); const ex = d.giveaway_id ? G.getRow(d.giveaway_id) : null;
    res.json({ ok: true, draft: { id: d.id, giveaway_id: d.giveaway_id, updated_at: d.updated_at, updated_by: d.updated_by, locked: !!(ex && ex.finalized_at), state: ex ? G.lifecycle(ex) : 'draft' }, data: c, validation: G.validate(c, { giveawayId: d.giveaway_id || 0, existing: !!ex }) });
  });
  M.put('/v7/gw/drafts/:id', perm('giveaways.edit'), express.json({ limit: '200kb' }), (req, res) => {
    const d = db.prepare('SELECT id, giveaway_id, updated_at FROM gw_drafts WHERE id=?').get(+req.params.id); if (!d) return bad(res, 404, 'Draft not found.');
    if (req.body && req.body.base && d.updated_at > req.body.base + 1 && !req.body.force) return res.status(409).json({ ok: false, conflict: true, error: 'Someone else saved this draft since you opened it. Reload to see their changes, or save again to overwrite.' });
    const c = G.normalize((req.body || {}).data || {}); const t = now();
    db.prepare('UPDATE gw_drafts SET data=?, title=?, updated_at=?, updated_by=? WHERE id=?').run(JSON.stringify(c), c.basics.title, t, actor(req), d.id);
    res.json({ ok: true, saved_at: t, data: c, validation: G.validate(c, { giveawayId: d.giveaway_id || 0, existing: !!d.giveaway_id }) });
  });
  M.delete('/v7/gw/drafts/:id', perm('giveaways.edit'), (req, res) => { const r = db.prepare('DELETE FROM gw_drafts WHERE id=?').run(+req.params.id); if (!r.changes) return bad(res, 404, 'Draft not found.'); RO.act(req, 'giveaway.draft_delete', 'draft:' + req.params.id); res.json({ ok: true }); });
  M.post('/v7/gw/drafts/:id/rules', perm('giveaways.edit'), (req, res) => {
    const d = db.prepare('SELECT * FROM gw_drafts WHERE id=?').get(+req.params.id); if (!d) return bad(res, 404, 'Draft not found.');
    const c = G.normalize(JSON.parse(d.data)); const html = G.officialRules(c, d.giveaway_id ? G.getRow(d.giveaway_id) : null);
    if (req.body && req.body.apply) { c.rules.official = html; c.rules.edited = false; db.prepare('UPDATE gw_drafts SET data=?, updated_at=? WHERE id=?').run(JSON.stringify(c), now(), d.id); }
    res.json({ ok: true, html });
  });
  M.post('/v7/gw/drafts/:id/publish', perm('giveaways.publish'), (req, res) => {
    const r = G.publishDraft(+req.params.id, actor(req)); if (r.ok) RO.act(req, 'giveaway.publish', 'giveaway:' + r.id, `${r.state}${r.series_id ? ` series ${r.series_id}` : ''}`); send(res, r);
  });
  M.post('/v7/gw/:id/edit', perm('giveaways.edit'), (req, res) => {
    const g = gwRow(req, res); if (!g) return; const ex = db.prepare('SELECT id FROM gw_drafts WHERE giveaway_id=?').get(g.id);
    if (ex) return res.json({ ok: true, id: ex.id, existing: true });
    const id = G.newDraft(G.cfgOf(g), actor(req), g.id); RO.act(req, 'giveaway.edit_open', 'giveaway:' + g.id, `draft ${id}`); res.json({ ok: true, id });
  });
  M.get('/v7/gw/:id', perm('giveaways.view'), (req, res) => {
    const g = gwRow(req, res); if (!g) return; const c = G.cfgOf(g); const fin = g.finalized_at ? R.results(g) : null;
    res.json({ ok: true, giveaway: { id: g.id, title: g.title, audience: g.audience || '', state: G.lifecycle(g), start_at: g.start_at, end_at: g.end_at, finalized_at: g.finalized_at, win_method: g.win_method, win_split: g.win_split, winners: R.winnerCount(g), series_id: g.series_id, occurrence: g.occurrence, slug: g.slug, draw_commit: g.draw_commit, pauses: SC.pausesOf(g) },
      data: c, plan: G.plan(c), standings: g.finalized_at ? null : R.liveStandings(g).slice(0, 50), results: fin, claims: fin ? G.claims(g) : null,
      audit: db.prepare('SELECT created_at, actor, action, username, detail FROM giveaway_audit WHERE giveaway_id=? ORDER BY id DESC LIMIT 100').all(g.id) });
  });
  const ACTIONS = {
    pause: ['giveaways.publish', (g, b, req) => G.pause(g, actor(req))], resume: ['giveaways.publish', (g, b, req) => G.resume(g, actor(req))],
    end: ['giveaways.publish', (g, b, req) => String(b.confirm || '') === 'END' ? G.endEarly(g, actor(req)) : { ok: false, error: 'Type END to confirm ending early.' }],
    extend: ['giveaways.publish', (g, b, req) => G.extend(g, b.end_at, actor(req))],
    cancel: ['giveaways.publish', (g, b, req) => String(b.confirm || '') === 'CANCEL' ? G.cancel(g, actor(req), b.reason) : { ok: false, error: 'Type CANCEL to confirm.' }],
    archive: ['giveaways.publish', (g, b, req) => G.archive(g, actor(req), true)], unarchive: ['giveaways.publish', (g, b, req) => G.archive(g, actor(req), false)],
    announce: ['winners.review', (g, b, req) => G.announceWinners(g, actor(req))],
    template: ['giveaways.edit', (g, b, req) => { const c = G.cfgOf(g); const n = String(b.name || g.title).slice(0, 80); const info = db.prepare('INSERT INTO gw_templates (name, data, created_at, created_by) VALUES (?,?,?,?)').run(n, JSON.stringify(c), now(), actor(req)); return { ok: true, id: info.lastInsertRowid }; }],
    stop_series: ['giveaways.publish', (g) => { if (!g.series_id) return { ok: false, error: 'Not a recurring giveaway.' }; db.prepare('UPDATE gw_series SET active=0 WHERE id=?').run(g.series_id); return { ok: true }; }],
  };
  M.post('/v7/gw/:id/act/:action', (req, res, next) => { const a = ACTIONS[req.params.action]; if (!a) return bad(res, 404, 'Unknown action.'); const [mw1, mw2] = perm(a[0]); mw1(req, res, () => mw2(req, res, next)); }, (req, res) => {
    const g = gwRow(req, res); if (!g) return; const r = ACTIONS[req.params.action][1](g, req.body || {}, req);
    if (r.ok) RO.act(req, 'giveaway.' + req.params.action, 'giveaway:' + g.id, req.body && (req.body.reason || req.body.end_at) ? String(req.body.reason || new Date(+req.body.end_at).toISOString()) : ''); send(res, r);
  });
  M.get('/v7/gw/:id/claims', perm('giveaways.view'), (req, res) => { const g = gwRow(req, res); if (!g) return; res.json({ ok: true, ...G.claims(g) }); });
  M.post('/v7/gw/:id/claims/:uid', perm('winners.review'), (req, res) => {
    const g = gwRow(req, res); if (!g) return; const uid = +req.params.uid; const b = req.body || {}; const t = now();
    if (!R.results(g) || !R.results(g).winners.some(w => w.user_id === uid)) return bad(res, 400, 'That player is not a current winner.');
    db.prepare('INSERT INTO gw_claims (giveaway_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(g.id, uid);
    if (b.action === 'contacted') db.prepare('UPDATE gw_claims SET contacted_at=? WHERE giveaway_id=? AND user_id=?').run(t, g.id, uid);
    else if (b.action === 'claimed') db.prepare('UPDATE gw_claims SET claimed_at=? WHERE giveaway_id=? AND user_id=?').run(t, g.id, uid);
    else if (b.action === 'note') db.prepare('UPDATE gw_claims SET note=? WHERE giveaway_id=? AND user_id=?').run(String(b.note || '').slice(0, 300), g.id, uid);
    else if (b.action === 'forfeit') { const r = R.disqualify(g, uid, String(b.reason || 'Prize not claimed in time').slice(0, 200), actor(req)); if (!r.ok) return send(res, r); }
    else return bad(res, 400, 'Unknown action.');
    R.audit(g.id, actor(req), 'claim_' + b.action, (db.prepare('SELECT username FROM users WHERE id=?').get(uid) || {}).username || null, b.note || b.reason || '');
    RO.act(req, 'giveaway.claim_' + b.action, 'giveaway:' + g.id, 'user ' + uid); res.json({ ok: true, ...G.claims(G.getRow(g.id)) });
  });
  M.get('/v7/gw-templates', perm('giveaways.view'), (req, res) => res.json({ ok: true, templates: db.prepare('SELECT id, name, created_at, created_by FROM gw_templates ORDER BY id DESC').all() }));
  M.delete('/v7/gw-templates/:id', perm('giveaways.edit'), (req, res) => { db.prepare('DELETE FROM gw_templates WHERE id=?').run(+req.params.id); RO.act(req, 'giveaway.template_delete', 'template:' + req.params.id); res.json({ ok: true }); });
  M.post('/v7/sweep', perm('giveaways.publish'), (req, res) => { const a = G.sweep(); R.sweep(); OPS.sweep(); res.json({ ok: true, giveaways: a }); });
  // image upload: raw bytes (the global JSON limit is 32 kb), crops as JSON in the X-Crops header
  M.post('/v7/media', perm('giveaways.edit'), express.raw({ type: ['application/octet-stream', 'image/png', 'image/jpeg'], limit: '5mb' }), async (req, res) => {
    let crops = {}; try { crops = JSON.parse(String(req.headers['x-crops'] || '{}')); } catch { return bad(res, 400, 'Bad crop data.'); }
    for (const [k, v] of Object.entries(crops)) { if (!MEDIA.SIZES[k] || !v || ![v.x, v.y, v.w, v.h].every(n => Number.isFinite(+n) && +n >= 0 && +n <= 1)) delete crops[k]; }
    const r = await MEDIA.save(req.body, crops, String(req.query.kind || 'giveaway')); if (r.ok) RO.act(req, 'media.upload', String(req.query.kind || 'giveaway'), Object.values(r.urls).join(' ')); send(res, r);
  });

  // ===== players =====
  M.get('/v7/users', perm('users.view'), (req, res) => res.json({ ok: true, ...U.list(req.query) }));
  M.get('/v7/users/:id', perm('users.view'), (req, res) => { const p = U.profile(+req.params.id, RO.permsFor(RO.who(req).role)); if (!p) return bad(res, 404, 'Player not found.'); res.json({ ok: true, ...p }); });
  M.get('/v7/users/:id/export', perm('users.export'), (req, res) => { const x = U.exportData(+req.params.id); if (!x) return bad(res, 404, 'Player not found.'); RO.act(req, 'user.export', 'user:' + req.params.id);
    res.setHeader('Content-Disposition', `attachment; filename="player-${x.account.username}-${new Date().toISOString().slice(0, 10)}.json"`); res.type('application/json').send(JSON.stringify(x, null, 2)); });
  const uAct = (key, fn) => [...perm(key), (req, res) => send(res, fn(req, +req.params.id, req.body || {}))];
  M.post('/v7/users/:id/reset', ...uAct('users.reset_password', (req, id) => U.resetLink(req, id)));
  M.put('/v7/users/:id', ...uAct('users.edit', (req, id, b) => U.edit(req, id, b)));
  M.post('/v7/users/:id/points', ...uAct('users.edit', (req, id, b) => U.points(req, id, b.amount, b.reason)));
  M.post('/v7/users/:id/items', ...uAct('users.edit', (req, id, b) => U.item(req, id, b.item, b.action !== 'revoke')));
  M.post('/v7/users/:id/badges', ...uAct('badges.award', (req, id, b) => OPS.awardBadge(req, String(id), b.badge, b.action !== 'revoke', b.note)));
  M.post('/v7/users/:id/ban', ...uAct('users.ban', (req, id, b) => U.ban(req, id, !!b.banned, b.reason)));
  M.post('/v7/users/:id/suspend', ...uAct('users.moderate', (req, id, b) => b.lift ? U.ban(req, id, false, 'suspension lifted') : U.suspend(req, id, b.hours, b.reason)));
  M.post('/v7/users/:id/shadow', ...uAct('users.moderate', (req, id, b) => U.shadow(req, id, !!b.on)));
  M.post('/v7/users/:id/clear-flags', ...uAct('users.moderate', (req, id, b) => U.clearFlags(req, id, b.action)));
  M.post('/v7/users/:id/notes', ...uAct('users.moderate', (req, id, b) => U.addNote(req, id, b.text)));
  M.delete('/v7/users/:id/notes/:nid', ...perm('users.moderate'), (req, res) => { db.prepare('DELETE FROM user_notes WHERE id=? AND user_id=?').run(+req.params.nid, +req.params.id); RO.act(req, 'user.note_delete', 'user:' + req.params.id); res.json({ ok: true }); });
  M.delete('/v7/users/:id', ...uAct('users.delete', (req, id, b) => U.remove(req, id, b.confirm)));

  // ===== Game Rules Profiles (per-game competition metadata; importer for docs/exact-game-hunt.json) =====
  M.get('/v7/profiles', perm('giveaways.view'), (req, res) => res.json({ ok: true, profiles: PROF.list(), comp: PROF.COMP, ac_levels: PROF.AC, tiers: PROF.TIERS, sources: PROF.SOURCES, categories: PROF.CATEGORIES, winner_rule: PROF.WINNER_RULE,
    hunt_file: require('fs').existsSync(require('path').join(__dirname, '..', 'docs', 'exact-game-hunt.json')) }));
  M.get('/v7/profiles/export', perm('giveaways.view'), (req, res) => { res.setHeader('Content-Disposition', 'attachment; filename="game-rules-profiles.json"'); res.json({ exported_at: new Date().toISOString(), games: PROF.list() }); });
  M.put('/v7/profiles/:id', perm('games.profiles'), (req, res) => { const r = PROF.save(req.params.id, req.body || {}, RO.who(req).username); if (r.ok) RO.act(req, 'profile.save', 'game:' + req.params.id); send(res, r); });
  M.delete('/v7/profiles/:id', perm('games.profiles'), (req, res) => { const id = String(req.params.id); const r = id.startsWith('ref:') ? (db.prepare('DELETE FROM game_profiles WHERE game_id=?').run(id), { ok: true }) : PROF.reset(id); RO.act(req, id.startsWith('ref:') ? 'profile.delete' : 'profile.reset', 'game:' + id); send(res, r); });
  M.post('/v7/profiles/import', perm('games.profiles'), express.json({ limit: '1mb' }), (req, res) => {
    const b = req.body || {}; let data = b.data;
    if (b.from_file) { try { data = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'docs', 'exact-game-hunt.json'), 'utf8')); } catch (e) { return bad(res, 400, 'docs/exact-game-hunt.json is missing or not valid JSON.'); } }
    if (typeof data === 'string') { try { data = JSON.parse(data); } catch { return bad(res, 400, 'That is not valid JSON.'); } }
    const r = PROF.importProfiles(data, { dry: b.apply !== true, actor: RO.who(req).username, overwriteAdmin: !!b.overwrite_admin });
    if (r.ok && !r.dry) RO.act(req, 'profile.import', 'games', `${r.linked.length} hub games, ${r.refs.length} references, ${r.skipped.length} skipped`); send(res, r);
  });

  // ===== moderation =====
  M.get('/v7/mod/flags', perm('moderation.queue'), (req, res) => {
    const st = ['open', 'cleared', 'confirmed', 'note'].includes(req.query.status) ? req.query.status : 'open';
    const rows = db.prepare(`SELECT f.*, u.username, u.created_at AS joined_at, r.duration_ms, r.created_at - r.started_at AS elapsed_ms, r.verify, (SELECT COUNT(*) FROM run_flags x WHERE x.user_id=f.user_id) AS user_flags
      FROM run_flags f LEFT JOIN users u ON u.id=f.user_id LEFT JOIN runs r ON r.id=f.run_id WHERE f.status=? ORDER BY f.severity DESC, f.created_at DESC LIMIT 300`).all(st)
      .map(f => ({ ...f, reasons: JSON.parse(f.reasons || '[]'), cap: (() => { try { return R.capFor({ game_id: f.game_id, created_at: f.created_at, started_at: f.created_at - (f.elapsed_ms || 0) }); } catch { return null; } })(), game_title: (cfg.gameInfo ? cfg.gameInfo(f.game_id) : cfg.GAME_MAP[f.game_id] || {})?.title || f.game_id }));
    res.json({ ok: true, flags: rows, counts: Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS c FROM run_flags GROUP BY status').all().map(r => [r.status, r.c])) });
  });
  M.post('/v7/mod/flags/:run', perm('moderation.queue'), (req, res) => {
    const b = req.body || {}; const runs = Array.isArray(b.runs) ? b.runs.map(Number).slice(0, 200) : [+req.params.run];
    const AC = require('./anticheat'); let n = 0; for (const id of runs) { const r = AC.review(id, b.action, actor(req), b.note || ''); if (r.ok) n++; else if (runs.length === 1) return send(res, r); }
    RO.act(req, 'flag.' + b.action, 'runs:' + runs.join(',').slice(0, 100), b.note || ''); res.json({ ok: true, count: n });
  });
  M.get('/v7/mod/reports', perm('moderation.queue'), (req, res) => res.json({ ok: true, reports: U.reports(['open', 'actioned', 'dismissed'].includes(req.query.status) ? req.query.status : 'open'),
    counts: Object.fromEntries(db.prepare('SELECT status, COUNT(*) AS c FROM reports GROUP BY status').all().map(r => [r.status, r.c])) }));
  M.post('/v7/mod/reports/:id', perm('moderation.queue'), (req, res) => send(res, U.handleReport(req, +req.params.id, (req.body || {}).status, (req.body || {}).resolution)));
  M.get('/v7/log', perm('actionlog.view'), (req, res) => res.json({ ok: true, log: OPS.actionLog(req.query) }));

  // ===== live ops =====
  M.get('/v7/events', perm('events.manage'), (req, res) => res.json({ ok: true, events: OPS.eventsList(), kinds: OPS.EVENT_KINDS, recur: OPS.RECUR, effects: OPS.activeEffects(), items: require('./shop').ITEMS.map(i => ({ id: i.id, name: i.name, rarity: i.rarity })), games: cfg.GAMES.map(g => ({ id: g.id, title: g.title })) }));
  M.post('/v7/events', perm('events.manage'), (req, res) => send(res, OPS.createEvent(req, req.body || {})));
  M.put('/v7/events/:id', perm('events.manage'), (req, res) => send(res, OPS.updateEvent(req, +req.params.id, req.body || {})));
  M.delete('/v7/events/:id', perm('events.manage'), (req, res) => send(res, OPS.deleteEvent(req, +req.params.id)));
  M.get('/v7/seasons', perm('seasons.manage'), (req, res) => res.json({ ok: true, ...OPS.seasons.overview() }));
  M.put('/v7/seasons/:n', perm('seasons.manage'), (req, res) => send(res, OPS.seasons.update(req, req.params.n, req.body || {})));
  M.post('/v7/seasons/end', perm('seasons.manage'), (req, res) => send(res, OPS.seasons.endNow(req, (req.body || {}).confirm)));
  M.get('/v7/shop', perm('shop.manage'), (req, res) => res.json({ ok: true, ...OPS.shop.overview() }));
  M.post('/v7/shop', perm('shop.manage'), (req, res) => send(res, OPS.shop.set(req, req.body || {})));
  M.get('/v7/badges', perm('badges.award'), (req, res) => res.json({ ok: true, ...OPS.badgeOverview() }));
  M.post('/v7/badges', perm('badges.manage'), (req, res) => send(res, OPS.saveBadge(req, req.body || {})));
  M.put('/v7/badges/:id', perm('badges.manage'), (req, res) => send(res, OPS.saveBadge(req, req.body || {}, String(req.params.id))));
  M.post('/v7/badges/award', perm('badges.award'), (req, res) => { const b = req.body || {}; send(res, OPS.awardBadge(req, b.username, b.badge, b.action !== 'revoke', b.note)); });
  M.get('/v7/analytics', perm('analytics.view'), (req, res) => res.json({ ok: true, ...OPS.analytics(req.query.days) }));
  M.get('/v7/announce', perm('announcements.post'), (req, res) => res.json({ ok: true, banner: RO.getS('site_banner', null), tones: OPS.TONES, announcements: db.prepare('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50').all(),
    broadcasts: db.prepare("SELECT at, actor, detail FROM admin_actions WHERE action='broadcast.send' ORDER BY id DESC LIMIT 20").all() }));
  M.post('/v7/banner', perm('announcements.post'), (req, res) => send(res, OPS.setBanner(req, req.body || {})));
  M.post('/v7/broadcast', perm('announcements.post'), (req, res) => send(res, OPS.broadcast(req, req.body || {})));
  M.get('/v7/settings', perm('settings.manage'), (req, res) => res.json({ ok: true, site: OPS.site(), legal_keys: OPS.LEGAL }));
  M.put('/v7/settings', perm('settings.manage'), express.json({ limit: '300kb' }), (req, res) => send(res, OPS.setSite(req, req.body || {})));

  // ===== team, roles, ownership =====
  M.get('/v7/team', perm('dashboard.view'), (req, res) => {
    const w = RO.who(req); const owner = w.role === 'owner';
    res.json({ ok: true, me: w, staff: RO.staffList().map(s => ({ id: s.id, username: s.username, display_name: s.display_name, role: s.role, disabled: !!s.disabled, last_login_at: s.last_login_at, created_at: s.created_at, totp: !!s.totp, must_change: !!s.must_change })),
      matrix: RO.matrix(), roles: ['owner', 'admin', 'moderator'], invites: owner ? db.prepare('SELECT id, role, note, created_by, created_at, expires_at, used_at, used_by, revoked_at FROM admin_invites ORDER BY id DESC LIMIT 50').all().map(i => ({ ...i, state: RO.inviteState(i) })) : [] });
  });
  M.post('/v7/team/invite', perm('staff.manage'), (req, res) => { const b = req.body || {}; const r = RO.makeInvite(req, b.role, b.note, +b.hours || 72); if (r.ok) { RO.act(req, 'staff.invite', b.role, b.note || ''); r.url = `${ADMSEC.BASE()}/join/${r.token}`; } send(res, r); });
  M.delete('/v7/team/invite/:id', perm('staff.manage'), (req, res) => { db.prepare('UPDATE admin_invites SET revoked_at=? WHERE id=? AND used_at IS NULL').run(now(), +req.params.id); RO.act(req, 'staff.invite_revoke', 'invite:' + req.params.id); res.json({ ok: true }); });
  M.post('/v7/team/appoint', perm('staff.manage'), async (req, res) => {
    const b = req.body || {}; const a = ADMSEC.accounts; if (!a) return bad(res, 400, 'Per-account admin sign-in is not available yet.');
    const temp = b.temp_password || require('crypto').randomBytes(12).toString('base64url');
    const r = await a.create({ username: String(b.username || '').trim(), role: b.role, password: temp, display_name: b.display_name }, RO.who(req));
    if (r.ok) RO.act(req, 'staff.appoint', r.account.username, r.account.role); res.status(r.ok ? 200 : 400).json(r.ok ? { ...r, temp_password: temp } : r);
  });
  M.put('/v7/team/:id', perm('staff.manage'), (req, res) => { const a = ADMSEC.accounts; const b = req.body || {}; const r = a.update(+req.params.id, { role: b.role, disabled: b.disabled, display_name: b.display_name }); if (r.ok) RO.act(req, 'staff.update', r.account.username, `${r.account.role}${r.account.disabled ? ' (disabled)' : ''}`); send(res, r); });
  M.delete('/v7/team/:id', perm('staff.manage'), (req, res) => { const a = ADMSEC.accounts; const u = a.get(+req.params.id); const r = a.remove(+req.params.id); if (r.ok) RO.act(req, 'staff.remove', u ? u.username : req.params.id); send(res, r); });
  M.post('/v7/team/transfer', perm('ownership.transfer'), (req, res) => { const b = req.body || {}; const r = RO.transferOwnership(req, +b.to, b.confirm); if (r.ok) RO.act(req, 'ownership.transfer', r.owner); send(res, r); });
  M.put('/v7/perms', perm('staff.manage'), (req, res) => { const m = RO.setMatrix((req.body || {}).matrix || {}); RO.act(req, 'perms.update', 'matrix', JSON.stringify((req.body || {}).matrix || {}).slice(0, 300)); res.json({ ok: true, matrix: m }); });
}

const RESET_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><meta name="robots" content="noindex">
<title>Reset your password | The Gaming Hub</title><link rel="stylesheet" href="/css/app.css"><link rel="icon" type="image/svg+xml" href="/assets/brand/favicon.svg">
<style>body{display:grid;place-items:center;min-height:100vh;padding:20px}.rp{max-width:420px;width:100%;background:rgba(18,20,48,.92);border:1px solid rgba(167,139,250,.35);border-radius:18px;padding:22px}
.rp h1{font-size:22px;margin:0 0 6px}.rp label{display:block;margin:12px 0 4px;font-size:13px;opacity:.85}.rp input{width:100%;padding:12px;border-radius:10px;border:1px solid #3b3f7a;background:#0b0d26;color:#fff;font-size:16px}
.rp button{margin-top:16px;width:100%;padding:13px;border-radius:12px;border:0;background:linear-gradient(90deg,#a78bfa,#22d3ee);color:#050714;font-weight:800;font-size:16px}.rp .msg{margin-top:12px;font-size:14px}.rp .err{color:#fca5a5}.rp .ok{color:#86efac}.rp a{color:#67e8f9}</style>
</head><body><main class="rp"><h1>Reset your password</h1><p class="muted">Use the one-time link or code a Trap Tech admin sent you on Potato. We never ask for your password.</p>
<form id="rp"><div id="codeRow"><label for="un">Username</label><input id="un" autocomplete="username"><label for="cd">Reset code</label><input id="cd" placeholder="XXXX-XXXX" autocomplete="one-time-code"></div>
<label for="pw">New password</label><input id="pw" type="password" minlength="8" autocomplete="new-password" required><label for="pw2">Repeat new password</label><input id="pw2" type="password" minlength="8" autocomplete="new-password" required>
<button type="submit">Set new password</button><div class="msg" id="msg" role="status"></div></form><p class="tiny muted" style="margin-top:14px"><a href="/">Back to the hub</a></p></main>
<script src="/js/reset-password.js"></script></body></html>`;
const JOIN_HTML = (state, role, B) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow">
<title>Join the admin team | The Gaming Hub</title><link rel="stylesheet" href="${B}/login.css"></head><body><main class="login-card" id="join" data-state="${state}" data-role="${role}">
<h1>Join the Trap Tech admin team</h1>${state === 'open' ? `<p>You were invited as <b>${role === 'admin' ? 'Admin' : 'Moderator'}</b> on The Gaming Hub. Pick a username and a strong password (12+ characters). You will set up an authenticator app on your first sign-in.</p>
<form id="jf"><label>Username<input id="ju" autocomplete="username" required pattern="[A-Za-z0-9_.-]{3,32}"></label><label>Display name<input id="jd" maxlength="40"></label>
<label>Password<input id="jp" type="password" minlength="12" autocomplete="new-password" required></label><label>Repeat password<input id="jp2" type="password" minlength="12" autocomplete="new-password" required></label>
<button type="submit">Create my account</button><p id="jm" role="status"></p></form>` : `<p>This invite link is <b>${state}</b>. Ask the owner for a new one.</p>`}</main><script src="${B}/join.js"></script></body></html>`;

// larger JSON bodies (rich-text drafts, legal pages, catalog import) only on these admin routes under the secret path;
// everything else keeps the global 32 kb limit. body-parser skips the global parser once req._body is set.
const bigParser = express.json({ limit: '1mb' });
const BIG_RE = /^\/api\/v7\/(gw\/drafts(\/\d+)?|gw\/\d+\/edit|settings|profiles\/import|gw-templates)$/;
function bigJson(req, res, next) {
  if (req.method === 'GET' || !ADMSEC || typeof ADMSEC.BASE !== 'function') return next();
  const B = ADMSEC.BASE(); if (!B || !req.path.startsWith(B + '/')) return next();
  if (!BIG_RE.test(req.path.slice(B.length))) return next();
  return bigParser(req, res, next);
}
module.exports = { early, routes, bigJson };

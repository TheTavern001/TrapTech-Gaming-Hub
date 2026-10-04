'use strict';
// v5 routes: brand channels (follow, channel-scoped giveaways), eligibility + explicit entries (anti-camping),
// paid outbound links with click tracking, Potato username for winner contact, friend challenges (play together).
const db = require('./db');
const cfg = require('./config');
const E = require('./eligibility');
const N = require('./notify');
const R = require('./results');
const boards = require('./boards');
const D = 864e5;

const SLUG = /^[a-z0-9][a-z0-9-]{1,38}$/;
const URL_RE = /^https:\/\/[^\s"'<>]{4,300}$/;
const HEX = /^#[0-9a-fA-F]{6}$/;
// v7: no tiers. What a giveaway shows (outbound links, featured row, hero, game skin) comes from the placements the
// sponsor's accepted quote included (giveaways.placements; legacy giveaways map their old tier, see src/sponsor.js).
const SP = require('./sponsor');
const LINK_PLACEMENTS = SP.PLACES;
const allows = (g, placement) => SP.placementsOf(g).includes(placement);
const B = require('./brands');

module.exports = function v5(app, A, h) {
  const { now, bad, currentUser, requireUser, str, limiter, logActivity, ipHash } = h;
  h.channelOf = (g) => g.channel_id ? db.prepare('SELECT * FROM channels WHERE id=?').get(g.channel_id) : null;
  // extra public giveaway fields (merged into giveawayPublic)
  h.v5Giveaway = (g) => {
    const c = h.channelOf(g); const au = B.audience(g); const places = SP.placementsOf(g);
    return { channel: c ? { slug: c.slug, name: c.name, logo: c.logo, color: c.color } : null, require_join: !!g.require_join,
      brand: au.brand, open_to_all: au.open, placements: places, featured: !!g.featured || places.includes('featured'), tier: undefined,
      eligibility_rules: E.describe(g, c), rules_cfg: E.rulesOf(g), joined_count: g.require_join ? db.prepare('SELECT COUNT(*) AS c FROM giveaway_entries WHERE giveaway_id=? AND left_at IS NULL').get(g.id).c : null,
      link: (g.link_url || (c && c.link_url)) && allows(g, 'giveaway') ? { url: `/go/g/${g.id}?p=giveaway`, label: g.link_label || `Visit ${g.host || 'sponsor'}` } : null };
  };

  // v7: the public brand-channel pages (/api/channels, follow) are gone; brands are joined via invite links (src/brands.js)
  // ---------- eligibility + entries ----------
  const pubG = (id) => { const g = db.prepare('SELECT * FROM giveaways WHERE id=? AND active=1').get(id); return g ? R.ready(g) : null; };
  app.get('/api/giveaways/:id/eligibility', (req, res) => {
    const g = pubG(req.params.id); if (!g) return bad(res, 404, 'Giveaway not found');
    const me = currentUser(req); const c = h.channelOf(g);
    const out = { ok: true, rules: E.describe(g, c), require_join: !!g.require_join, signed_in: !!me };
    if (me) {
      Object.assign(out, E.check(me, g));
      if (g.win_method === 'random' && g.weight_mode === 'activity') {
        const row = R.liveStandings(g).find(r => r.user_id === me.id); const att = row ? row.attempts : 0;
        out.entries = { count: E.weightOf(g, att), runs: att, next_at: Math.min(E.WEIGHT.max, E.weightOf(g, att) + 1) > E.weightOf(g, att) ? (E.weightOf(g, att)) * E.WEIGHT.per : null, max: E.WEIGHT.max };
      }
    }
    res.json(out);
  });
  app.post('/api/giveaways/:id/join', requireUser, limiter('gjoin', 30, 60e3), (req, res) => {
    const g = pubG(req.params.id); if (!g) return bad(res, 404, 'Giveaway not found');
    const r = E.join(req.user, g); if (!r.ok) return bad(res, 400, r.error, { status: r.status });
    if (!r.already) logActivity('entry', `${req.user.username} entered "${g.title}"`, req.user.id, g.id);
    res.json(r);
  });
  app.post('/api/giveaways/:id/leave', requireUser, limiter('gjoin', 30, 60e3), (req, res) => {
    const g = pubG(req.params.id); if (!g) return bad(res, 404, 'Giveaway not found');
    const r = E.leave(req.user, g); if (!r.ok) return bad(res, 400, r.error); res.json(r);
  });
  app.get('/api/me/entries', requireUser, (req, res) => res.json({ ok: true, entries: E.activeEntries(req.user.id), max: E.DEFAULTS.elig_max_active }));

  // ---------- Potato username (winner contact) ----------
  app.put('/api/me/potato', requireUser, limiter('potato', 20, 3600e3), (req, res) => {
    const p = str(req.body.potato, 40).replace(/^@/, '');
    if (!/^[A-Za-z0-9_]{3,32}$/.test(p)) return bad(res, 400, 'Potato usernames use letters, numbers and _ (3-32 characters).');
    db.prepare('UPDATE users SET potato=? WHERE id=?').run(p, req.user.id); res.json({ ok: true, potato: p });
  });

  // ---------- paid outbound links (tracked) ----------
  app.get('/go/:kind/:id', (req, res) => {
    const placement = String(req.query.p || '');
    let url = null, ok = false; const refId = parseInt(req.params.id, 10) || 0;
    if (req.params.kind === 'g') { const g = db.prepare('SELECT * FROM giveaways WHERE id=? AND active=1').get(refId); const c = g && h.channelOf(g); if (g) { url = g.link_url || (c && c.link_url); ok = allows(g, placement); } }
    if (!url || !URL_RE.test(url) || !ok) return res.redirect(302, '/');
    const u = currentUser(req);
    db.prepare('INSERT INTO link_clicks (kind, ref_id, placement, user_id, ip_hash, created_at) VALUES (?,?,?,?,?,?)').run(req.params.kind, refId, placement, u ? u.id : null, ipHash(req), now());
    res.redirect(302, url);
  });
  // sponsor link shown on a game page: the live giveaway linking this game whose quote included the game-page link
  app.get('/api/games/:id/sponsor', (req, res) => {
    const t = now();
    const g = db.prepare(`SELECT g.* FROM giveaways g JOIN giveaway_games gg ON gg.giveaway_id=g.id WHERE gg.game_id=? AND g.active=1 AND g.start_at<=? AND g.end_at>? ORDER BY g.end_at`).all(String(req.params.id), t, t).find(x => allows(x, 'game'));
    if (!g) return res.json({ ok: true, sponsor: null });
    const c = h.channelOf(g); const url = g.link_url || (c && c.link_url);
    res.json({ ok: true, sponsor: { giveaway_id: g.id, title: g.title, host: g.host, logo: g.brand_logo || (c && c.logo) || '', color: g.brand_color || (c && c.color) || '', link: url ? { url: `/go/g/${g.id}?p=game`, label: g.link_label || `Visit ${g.host}` } : null } });
  });

  // ---------- friend challenges (play together; no free text) ----------
  const friends = (a, b) => !!db.prepare('SELECT 1 FROM follows f1 JOIN follows f2 ON f2.follower_id=f1.followee_id AND f2.followee_id=f1.follower_id WHERE f1.follower_id=? AND f1.followee_id=?').get(a, b);
  const bestOf = (uid, gid, since = 0, until = 8.64e15) => db.prepare('SELECT id, score FROM runs WHERE user_id=? AND game_id=? AND created_at>=? AND created_at<=? ORDER BY score DESC, created_at ASC LIMIT 1').get(uid, gid, since, until);
  const CH_TTL = 2 * D, CH_PLAY = 2 * D;
  function settle(c) {
    const t = now();
    if (c.status === 'pending' && t > c.expires_at) { db.prepare("UPDATE challenges SET status='expired' WHERE id=?").run(c.id); return { ...c, status: 'expired' }; }
    if (c.status !== 'accepted') return c;
    const b = bestOf(c.to_user, c.game_id, c.responded_at, c.expires_at);
    if (b && b.score > c.target_score) {
      db.prepare("UPDATE challenges SET status='completed', result_run_id=?, result_score=?, winner_id=? WHERE id=? AND status='accepted'").run(b.id, b.score, c.to_user, c.id);
      const to = db.prepare('SELECT username FROM users WHERE id=?').get(c.to_user).username;
      N.notify(c.from_user, 'challenge', `${to} beat your challenge`, `${cfg.GAME_MAP[c.game_id].title}: ${b.score.toLocaleString('en-US')} vs your ${c.target_score.toLocaleString('en-US')}. Challenge them back!`, '/friends?tab=challenges', 'swords');
      return { ...c, status: 'completed', result_score: b.score, result_run_id: b.id, winner_id: c.to_user };
    }
    if (t > c.expires_at) {
      db.prepare("UPDATE challenges SET status='completed', result_score=?, result_run_id=?, winner_id=? WHERE id=? AND status='accepted'").run(b ? b.score : null, b ? b.id : null, c.from_user, c.id);
      return { ...c, status: 'completed', result_score: b ? b.score : null, winner_id: c.from_user };
    }
    return c;
  }
  h.settleChallenges = (uid) => { for (const c of db.prepare("SELECT * FROM challenges WHERE (to_user=? OR from_user=?) AND status IN ('pending','accepted')").all(uid, uid)) settle(c); };
  const chPublic = (c, me) => {
    const u = (id) => db.prepare('SELECT username, is_demo, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect FROM users WHERE id=?').get(id) || { username: '?' };
    const g = cfg.GAME_MAP[c.game_id];
    return { id: c.id, game_id: c.game_id, game_title: g ? g.title : c.game_id, unit: g ? g.unit : '', target_score: c.target_score, status: c.status,
      from: u(c.from_user).username, to: u(c.to_user).username, incoming: c.to_user === me.id, created_at: c.created_at, expires_at: c.expires_at,
      result_score: c.result_score, won: c.winner_id ? c.winner_id === me.id : null };
  };
  app.get('/api/challenges', requireUser, (req, res) => {
    h.settleChallenges(req.user.id);
    const all = db.prepare('SELECT * FROM challenges WHERE to_user=? OR from_user=? ORDER BY created_at DESC LIMIT 60').all(req.user.id, req.user.id).map(c => chPublic(c, req.user));
    const fr = db.prepare('SELECT u.username FROM follows f1 JOIN follows f2 ON f2.follower_id=f1.followee_id AND f2.followee_id=f1.follower_id JOIN users u ON u.id=f1.followee_id WHERE f1.follower_id=? ORDER BY u.username').all(req.user.id).map(r => r.username);
    res.json({ ok: true, incoming: all.filter(c => c.incoming && c.status === 'pending'), active: all.filter(c => c.status === 'accepted' || (!c.incoming && c.status === 'pending')), history: all.filter(c => ['completed', 'declined', 'expired'].includes(c.status)), friends: fr });
  });
  app.post('/api/challenges', requireUser, limiter('challenge', 20, 3600e3), (req, res) => {
    const to = db.prepare('SELECT id, username FROM users WHERE username=? AND banned=0').get(str(req.body.to, 40)); if (!to) return bad(res, 404, 'Player not found.');
    if (to.id === req.user.id) return bad(res, 400, "You can't challenge yourself.");
    if (!friends(req.user.id, to.id)) return bad(res, 403, 'You can only challenge friends (you follow each other).');
    const game = cfg.GAME_MAP[String(req.body.game_id)]; if (!game || !game.playable) return bad(res, 400, 'Pick a game.');
    const b = bestOf(req.user.id, game.id); if (!b) return bad(res, 400, `Finish a run of ${game.title} first - your best score is the target.`);
    if (db.prepare("SELECT 1 FROM challenges WHERE from_user=? AND to_user=? AND game_id=? AND status IN ('pending','accepted')").get(req.user.id, to.id, game.id)) return bad(res, 409, 'You already have an open challenge with this friend on that game.');
    const t = now();
    const info = db.prepare('INSERT INTO challenges (from_user, to_user, game_id, target_score, from_run_id, status, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?)').run(req.user.id, to.id, game.id, b.score, b.id, 'pending', t, t + CH_TTL);
    N.notify(to.id, 'challenge', `${req.user.username} challenged you`, `Beat ${b.score.toLocaleString('en-US')}${game.unit === 'm' ? 'm' : ' ' + game.unit} in ${game.title}. Accept to start a 48-hour window.`, '/friends?tab=challenges', 'swords');
    res.json({ ok: true, id: info.lastInsertRowid, target_score: b.score });
  });
  app.post('/api/challenges/:id/:act(accept|decline)', requireUser, limiter('challenge-r', 60, 3600e3), (req, res) => {
    const c = db.prepare('SELECT * FROM challenges WHERE id=? AND to_user=?').get(req.params.id, req.user.id); if (!c) return bad(res, 404, 'Challenge not found.');
    const s = settle(c); if (s.status !== 'pending') return bad(res, 409, `This challenge is ${s.status}.`);
    const t = now(); const acc = req.params.act === 'accept';
    db.prepare('UPDATE challenges SET status=?, responded_at=?, expires_at=? WHERE id=?').run(acc ? 'accepted' : 'declined', t, acc ? t + CH_PLAY : c.expires_at, c.id);
    N.notify(c.from_user, 'challenge', `${req.user.username} ${acc ? 'accepted' : 'declined'} your challenge`, acc ? `They have 48 hours to beat ${c.target_score.toLocaleString('en-US')} in ${cfg.GAME_MAP[c.game_id].title}.` : 'Maybe next time.', '/friends?tab=challenges', 'swords');
    res.json({ ok: true, status: acc ? 'accepted' : 'declined', game_id: c.game_id });
  });

  // ---------- admin: channels + link analytics ----------
  const readChannel = (b) => {
    const c = { slug: str(b.slug, 40).toLowerCase(), name: str(b.name, 60), tagline: str(b.tagline, 160), logo: str(b.logo, 300), color: HEX.test(String(b.color || '')) ? b.color : '',
      link_url: str(b.link_url, 300), link_label: str(b.link_label, 40), tier: ['basic', 'premium', 'elite'].includes(b.tier) ? b.tier : 'basic', business_type: str(b.business_type, 80), active: b.active === false ? 0 : 1 };
    if (!c.name) return [null, 'Channel name is required.'];
    if (!c.slug) c.slug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 38);
    if (!SLUG.test(c.slug)) return [null, 'Slug: lowercase letters, numbers and dashes.'];
    if (c.link_url && !URL_RE.test(c.link_url)) return [null, 'Link must be an https:// URL.'];
    if (c.logo && !/^(\/assets\/[\w\-./]+|https:\/\/[^\s"'<>]+)$/.test(c.logo)) return [null, 'Logo must be a /assets/... path or an https:// URL.'];
    return [c, null];
  };
  A.get('/channels', (req, res) => res.json({ ok: true, channels: db.prepare('SELECT c.*, (SELECT COUNT(*) FROM channel_follows f WHERE f.channel_id=c.id) AS followers, (SELECT COUNT(*) FROM link_clicks l WHERE l.kind=\'c\' AND l.ref_id=c.id) AS clicks FROM channels c ORDER BY c.name').all() }));
  A.post('/channels', (req, res) => {
    const [c, err] = readChannel(req.body || {}); if (err) return bad(res, 400, err);
    if (db.prepare('SELECT 1 FROM channels WHERE slug=?').get(c.slug)) return bad(res, 409, 'That slug is taken.');
    const info = db.prepare('INSERT INTO channels (slug,name,tagline,logo,color,link_url,link_label,tier,business_type,active,created_at) VALUES (@slug,@name,@tagline,@logo,@color,@link_url,@link_label,@tier,@business_type,@active,' + now() + ')').run(c);
    res.json({ ok: true, id: info.lastInsertRowid, slug: c.slug });
  });
  A.put('/channels/:id', (req, res) => {
    const [c, err] = readChannel(req.body || {}); if (err) return bad(res, 400, err);
    if (db.prepare('SELECT 1 FROM channels WHERE slug=? AND id<>?').get(c.slug, req.params.id)) return bad(res, 409, 'That slug is taken.');
    db.prepare('UPDATE channels SET slug=@slug,name=@name,tagline=@tagline,logo=@logo,color=@color,link_url=@link_url,link_label=@link_label,tier=@tier,business_type=@business_type,active=@active WHERE id=' + (parseInt(req.params.id, 10) || 0)).run(c);
    res.json({ ok: true });
  });
  A.delete('/channels/:id', (req, res) => { db.prepare('UPDATE giveaways SET channel_id=NULL WHERE channel_id=?').run(req.params.id); db.prepare('DELETE FROM channels WHERE id=?').run(req.params.id); res.json({ ok: true }); });
  A.get('/giveaways/:id/clicks', (req, res) => res.json({ ok: true, clicks: db.prepare("SELECT placement, COUNT(*) AS n, COUNT(DISTINCT COALESCE(user_id, ip_hash)) AS uniq FROM link_clicks WHERE kind='g' AND ref_id=? GROUP BY placement").all(req.params.id) }));
  A.get('/eligibility-defaults', (req, res) => res.json({ ok: true, defaults: E.DEFAULTS, weight: E.WEIGHT }));
  A.get('/giveaways/:id/entries', (req, res) => res.json({ ok: true, entries: db.prepare('SELECT u.username, e.joined_at, e.left_at FROM giveaway_entries e JOIN users u ON u.id=e.user_id WHERE e.giveaway_id=? ORDER BY e.joined_at').all(req.params.id) }));
};
module.exports.LINK_PLACEMENTS = LINK_PLACEMENTS;

'use strict';
// v7 item 23: live-ops + site backends for the admin panel.
//   events / specials (double points, bonus quests, shop sales, themed weekends, XP boosts) with schedules
//   economy adapter: seasons + shop admin on top of the season/shop engine. If the site worker's engine module lands
//     (src/seasons.js exporting admin hooks), it is used; until then a small overlay on src/progress.js + src/shop.js:
//     season overrides (names, dates, reward tracks, end/roll early) + hall of fame, shop pins/featured/retired + sales.
//   custom badges (generated or uploaded art, admin-only), moderation helpers, analytics (60 s cache),
//   site banner + broadcast, site settings (name, branding, maintenance mode, age-gate text, legal page overrides).
const db = require('./db');
const cfg = require('./config');
const N = require('./notify');
const RO = require('./admin-roles');
const PR = require('./progress');
const SH = require('./shop');
const ach = require('./achievements');
const now = () => Date.now();
const D = 864e5;
const { getS, setS } = RO;
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const num = (v, lo, hi, d) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };

db.exec(`
CREATE TABLE IF NOT EXISTS hub_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
  starts_at INTEGER NOT NULL, ends_at INTEGER NOT NULL, recur TEXT NOT NULL DEFAULT 'none', multiplier REAL NOT NULL DEFAULT 2, sale_pct INTEGER NOT NULL DEFAULT 0,
  items TEXT NOT NULL DEFAULT '[]', games TEXT NOT NULL DEFAULT '[]', theme TEXT NOT NULL DEFAULT '', banner INTEGER NOT NULL DEFAULT 1, notify INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'scheduled', notified_at INTEGER, created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_events_time ON hub_events(ends_at, starts_at);
CREATE TABLE IF NOT EXISTS admin_seasons (number INTEGER PRIMARY KEY, name TEXT, starts_at INTEGER, ends_at INTEGER, track TEXT, theme TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '', ended_early_at INTEGER, updated_by TEXT, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS season_hof (number INTEGER NOT NULL, rank INTEGER NOT NULL, user_id INTEGER, username TEXT NOT NULL, xp INTEGER NOT NULL, tier INTEGER NOT NULL,
  archived_at INTEGER NOT NULL, PRIMARY KEY (number, rank));
CREATE TABLE IF NOT EXISTS custom_badges (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', icon TEXT NOT NULL DEFAULT 'star', color TEXT NOT NULL DEFAULT '#a78bfa',
  art TEXT NOT NULL DEFAULT '', admin_only INTEGER NOT NULL DEFAULT 1, retired INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
`);

// =====================================================================================================================
// Events / specials
// =====================================================================================================================
const EVENT_KINDS = {
  double_points: { label: 'Double Hub Points', icon: 'coins', desc: 'Runs earn extra Hub Points (cosmetic only) while it is on.' },
  xp_boost: { label: 'XP boost', icon: 'zap', desc: 'Season XP from runs counts extra while it is on.' },
  bonus_quests: { label: 'Bonus quests', icon: 'list-checks', desc: 'Daily quests pay extra points while it is on.' },
  shop_sale: { label: 'Shop sale', icon: 'tag', desc: 'Percent off shop items (all or picked items).' },
  themed_weekend: { label: 'Themed weekend', icon: 'party-popper', desc: 'A themed banner + featured games for the weekend.' },
  custom: { label: 'Custom special', icon: 'sparkles', desc: 'Any announcement-style special with a schedule.' },
};
const RECUR = ['none', 'daily', 'weekly', 'monthly'];
function readEvent(b, old = {}) {
  const kind = EVENT_KINDS[b.kind] ? b.kind : old.kind || 'custom';
  const e = { kind, name: str(b.name ?? old.name, 80), description: str(b.description ?? old.description, 600), starts_at: Math.floor(Number(b.starts_at ?? old.starts_at)), ends_at: Math.floor(Number(b.ends_at ?? old.ends_at)),
    recur: RECUR.includes(b.recur) ? b.recur : old.recur || 'none', multiplier: num(b.multiplier ?? old.multiplier, 1, 5, 2), sale_pct: Math.round(num(b.sale_pct ?? old.sale_pct, 0, 90, 0)),
    items: JSON.stringify((Array.isArray(b.items) ? b.items : JSON.parse(old.items || '[]')).filter(i => SH.BY_ID[i]).slice(0, 60)),
    games: JSON.stringify((Array.isArray(b.games) ? b.games : JSON.parse(old.games || '[]')).filter(g => cfg.GAME_MAP[g]).slice(0, 20)),
    theme: str(b.theme ?? old.theme, 40), banner: (b.banner ?? old.banner ?? 1) ? 1 : 0, notify: (b.notify ?? old.notify ?? 1) ? 1 : 0 };
  if (!e.name) return [null, 'Give the event a name.'];
  if (!Number.isFinite(e.starts_at) || !Number.isFinite(e.ends_at)) return [null, 'Pick a start and end date/time.'];
  if (e.ends_at <= e.starts_at) return [null, 'The end must be after the start.'];
  if (e.ends_at - e.starts_at > 92 * D) return [null, 'Events can run for up to 92 days (use recurrence for longer).'];
  if (kind === 'shop_sale' && !e.sale_pct) return [null, 'Set the sale percent (1-90).'];
  return [e, null];
}
const evPub = (e, t = now()) => ({ ...e, items: JSON.parse(e.items || '[]'), games: JSON.parse(e.games || '[]'), kind_label: (EVENT_KINDS[e.kind] || {}).label,
  state: e.status === 'cancelled' ? 'cancelled' : t < e.starts_at ? 'scheduled' : t <= e.ends_at ? 'live' : 'ended' });
function eventsList() { const t = now(); return db.prepare('SELECT * FROM hub_events ORDER BY (ends_at < ?) ASC, starts_at DESC LIMIT 300').all(t).map(e => evPub(e, t)); }
function createEvent(req, b) { cfgCache = null; /* v7: public config shows changes at once */
  const [e, err] = readEvent(b); if (err) return { ok: false, error: err }; const t = now();
  const info = db.prepare(`INSERT INTO hub_events (kind,name,description,starts_at,ends_at,recur,multiplier,sale_pct,items,games,theme,banner,notify,created_by,created_at,updated_at)
    VALUES (@kind,@name,@description,@starts_at,@ends_at,@recur,@multiplier,@sale_pct,@items,@games,@theme,@banner,@notify,@by,@t,@t)`).run({ ...e, by: RO.who(req).username, t });
  RO.act(req, 'event.create', 'event:' + info.lastInsertRowid, `${e.kind} ${e.name}`); bust(); return { ok: true, id: info.lastInsertRowid };
}
function updateEvent(req, id, b) { cfgCache = null; /* v7: public config shows changes at once */
  const old = db.prepare('SELECT * FROM hub_events WHERE id=?').get(id); if (!old) return { ok: false, error: 'Event not found.' };
  if (b.status === 'cancelled' || b.status === 'scheduled') { db.prepare('UPDATE hub_events SET status=?, updated_at=? WHERE id=?').run(b.status, now(), id); RO.act(req, 'event.' + (b.status === 'cancelled' ? 'cancel' : 'restore'), 'event:' + id); bust(); return { ok: true }; }
  if (b.end_now) { db.prepare('UPDATE hub_events SET ends_at=?, recur=\'none\', updated_at=? WHERE id=?').run(Math.max(old.starts_at + 1, now()), now(), id); RO.act(req, 'event.end_now', 'event:' + id); bust(); return { ok: true }; }
  const [e, err] = readEvent(b, old); if (err) return { ok: false, error: err };
  db.prepare(`UPDATE hub_events SET kind=@kind,name=@name,description=@description,starts_at=@starts_at,ends_at=@ends_at,recur=@recur,multiplier=@multiplier,sale_pct=@sale_pct,items=@items,games=@games,theme=@theme,banner=@banner,notify=@notify,updated_at=@t WHERE id=@id`).run({ ...e, t: now(), id });
  RO.act(req, 'event.edit', 'event:' + id, e.name); bust(); return { ok: true };
}
function deleteEvent(req, id) { cfgCache = null; /* v7: public config shows changes at once */ const r = db.prepare('DELETE FROM hub_events WHERE id=?').run(id); if (!r.changes) return { ok: false, error: 'Event not found.' }; RO.act(req, 'event.delete', 'event:' + id); bust(); return { ok: true }; }
let effCache = null;
const bust = () => { effCache = null; };
// what is on right now (used by the shop/points overlay and the public site config)
function activeEffects(t = now()) {
  if (effCache && effCache.at > t - 15e3 && Math.abs(effCache.t - t) < 15e3) return effCache.v;
  const live = db.prepare("SELECT * FROM hub_events WHERE status<>'cancelled' AND starts_at<=? AND ends_at>=?").all(t, t).map(e => evPub(e, t));
  const v = { events: live, points_mult: 1, xp_mult: 1, quest_mult: 1, sale: null, themes: [], featured_games: [] };
  for (const e of live) {
    if (e.kind === 'double_points') v.points_mult = Math.max(v.points_mult, e.multiplier);
    if (e.kind === 'xp_boost') v.xp_mult = Math.max(v.xp_mult, e.multiplier);
    if (e.kind === 'bonus_quests') v.quest_mult = Math.max(v.quest_mult, e.multiplier);
    if (e.kind === 'shop_sale' && (!v.sale || e.sale_pct > v.sale.pct)) v.sale = { id: e.id, pct: e.sale_pct, items: e.items, name: e.name, ends_at: e.ends_at };
    if (e.kind === 'themed_weekend' && e.theme) v.themes.push(e.theme);
    v.featured_games.push(...e.games);
  }
  effCache = { at: t, t, v }; return v;
}
// recurring events roll forward; launch notifications go out once
function eventsSweep(t = now()) {
  for (const e of db.prepare("SELECT * FROM hub_events WHERE recur<>'none' AND status<>'cancelled' AND ends_at < ?").all(t)) {
    const dur = e.ends_at - e.starts_at; let s = e.starts_at;
    const step = (x) => e.recur === 'daily' ? x + D : e.recur === 'weekly' ? x + 7 * D : (() => { const d = new Date(x); d.setMonth(d.getMonth() + 1); return d.getTime(); })();
    let guard = 0; do { s = step(s); } while (s + dur < t && guard++ < 400);
    db.prepare('UPDATE hub_events SET starts_at=?, ends_at=?, notified_at=NULL, updated_at=? WHERE id=?').run(s, s + dur, t, e.id); bust();
  }
  for (const e of db.prepare("SELECT * FROM hub_events WHERE notify=1 AND notified_at IS NULL AND status<>'cancelled' AND starts_at<=? AND ends_at>=?").all(t, t)) {
    N.notify(null, 'system', `${(EVENT_KINDS[e.kind] || {}).label || 'Special'}: ${e.name}`, e.description || `On now until ${new Date(e.ends_at).toLocaleString('en-US', { timeZone: cfg.TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.`, e.kind === 'shop_sale' ? '/shop' : '/', (EVENT_KINDS[e.kind] || {}).icon || 'sparkles');
    db.prepare('UPDATE hub_events SET notified_at=? WHERE id=?').run(t, e.id);
  }
}

// =====================================================================================================================
// Economy adapter: seasons + shop admin
// =====================================================================================================================
let ENGINE = null; try { ENGINE = require('./seasons'); if (!ENGINE || typeof ENGINE.adminList !== 'function') ENGINE = null; } catch { ENGINE = null; }
const baseSeasonAt = PR.seasonAt; const baseProgress = PR.seasonProgress; const baseBoard = PR.seasonBoard;
const DEFAULT_TRACK = { 3: 'Title: Season Starter', 5: 'Banner: Season One: Neon Genesis', 10: 'Frame: Season Laurel', 20: 'Title: Season Legend' };
const ovr = (n) => db.prepare('SELECT * FROM admin_seasons WHERE number=?').get(n);
// season n with overrides; a season that was ended early pushes the next one's start forward (roll)
function seasonN(n) {
  const T = (x) => baseSeasonAt(x);
  // find the default season with number n by probing quarter starts
  let probe = T(now()); let guard = 0;
  while (probe.number < n && guard++ < 200) probe = T(probe.end_at + 1);
  while (probe.number > n && guard++ < 400) probe = T(probe.start_at - 1);
  const o = ovr(n) || {}; const prev = n > 1 ? ovr(n - 1) : null;
  let start = o.starts_at || probe.start_at; if (prev && prev.ended_early_at && !o.starts_at) start = prev.ended_early_at + 1;
  const end = o.ended_early_at || o.ends_at || probe.end_at;
  let track = DEFAULT_TRACK; try { if (o.track) track = JSON.parse(o.track); } catch {}
  return { number: n, name: o.name || probe.name, start_at: start, end_at: end, tiers: probe.tiers, tier_xp: probe.tier_xp, track, theme: o.theme || '', notes: o.notes || '', ended_early_at: o.ended_early_at || null, overridden: !!o.number };
}
function seasonAtOverlay(t = now()) {
  const d = baseSeasonAt(t); let s = seasonN(d.number);
  if (t > s.end_at) s = seasonN(d.number + 1); else if (t < s.start_at && d.number > 1) s = seasonN(d.number - 1);
  return { number: s.number, name: s.name, start_at: s.start_at, end_at: s.end_at, tiers: s.tiers, tier_xp: s.tier_xp };
}
let overlayOn = false;
function installSeasonOverlay() {
  if (ENGINE || overlayOn) return; overlayOn = true;
  PR.seasonAt = seasonAtOverlay;
  PR.seasonProgress = (userId, t = now()) => {
    const s = seasonAtOverlay(t); const full = seasonN(s.number); const xp = userId ? PR.xpFor(userId, s.start_at, s.end_at) : 0; const tier = Math.min(s.tiers, Math.floor(xp / s.tier_xp));
    return { ...s, xp, tier, into: tier >= s.tiers ? s.tier_xp : xp % s.tier_xp, track: Array.from({ length: s.tiers }, (_, i) => ({ tier: i + 1, xp: (i + 1) * s.tier_xp, reward: full.track[i + 1] || null, unlocked: tier >= i + 1 })) };
  };
  PR.seasonBoard = (limit = 50, t = now()) => boardFor(seasonAtOverlay(t), limit);
}
function boardFor(s, limit = 50) {
  const ids = db.prepare(`SELECT DISTINCT user_id FROM (SELECT user_id FROM runs WHERE created_at BETWEEN @a AND @b UNION SELECT user_id FROM checkins WHERE created_at BETWEEN @a AND @b UNION SELECT user_id FROM quest_claims WHERE created_at BETWEEN @a AND @b)`).all({ a: s.start_at, b: s.end_at }).map(r => r.user_id);
  const U = db.prepare('SELECT id AS user_id, username, is_demo, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect, banned, shadow_banned FROM users WHERE id=?');
  return ids.map(id => ({ id, xp: PR.xpFor(id, s.start_at, s.end_at) })).sort((a, b) => b.xp - a.xp).slice(0, limit * 2)
    .map(r => ({ ...U.get(r.id), score: r.xp, tier: Math.min(s.tiers || 20, Math.floor(r.xp / (s.tier_xp || 300))) })).filter(r => r.username && !r.banned && !r.shadow_banned).slice(0, limit).map((r, i) => ({ rank: i + 1, ...r }));
}
function archiveSeason(n) {
  if (db.prepare('SELECT 1 FROM season_hof WHERE number=?').get(n)) return 0;
  const s = seasonN(n); const rows = boardFor(s, 10); const t = now();
  const ins = db.prepare('INSERT OR IGNORE INTO season_hof (number, rank, user_id, username, xp, tier, archived_at) VALUES (?,?,?,?,?,?,?)');
  db.transaction(() => { for (const r of rows) ins.run(n, r.rank, r.user_id, r.username, r.score, r.tier, t); })();
  return rows.length;
}
const seasons = {
  engine: ENGINE ? 'src/seasons.js' : 'overlay (src/progress.js + admin_seasons)',
  overview() {
    if (ENGINE) return ENGINE.adminList();
    const cur = seasonAtOverlay(); const list = [];
    for (let n = Math.max(1, cur.number - 3); n <= cur.number + 3; n++) { const s = seasonN(n); list.push({ ...s, state: n < cur.number ? 'ended' : n === cur.number ? 'live' : 'upcoming' }); }
    const c = seasonN(cur.number);
    return { engine: this.engine, current: { ...c, players: boardFor(c, 1000).length, top: boardFor(c, 10) }, seasons: list, hall_of_fame: this.hof(), reward_types: ['Title', 'Banner', 'Frame', 'Badge', 'Color', 'Effect', 'Points'] };
  },
  hof() { const rows = db.prepare('SELECT * FROM season_hof ORDER BY number DESC, rank ASC LIMIT 200').all(); const by = {}; for (const r of rows) (by[r.number] = by[r.number] || { number: r.number, name: seasonN(r.number).name, top: [] }).top.push(r); return Object.values(by); },
  update(req, n, b) {
    if (ENGINE && ENGINE.adminUpdate) { const r0 = ENGINE.adminUpdate(n, b, RO.who(req)); if (r0.ok) RO.act(req, 'season.edit', 'season:' + n, JSON.stringify(b).slice(0, 300)); return r0; }
    const cur = seasonAtOverlay(); n = parseInt(n, 10);
    if (!(n >= cur.number)) return { ok: false, error: 'Past seasons are locked (their results are in the hall of fame).' };
    const s = seasonN(n); const o = ovr(n) || {};
    const name = b.name !== undefined ? str(b.name, 40) : o.name; let track = o.track;
    if (b.track) { const tr = {}; for (const [k, v] of Object.entries(b.track)) { const tier = parseInt(k, 10); const val = str(v, 60); if (tier >= 1 && tier <= (s.tiers || 20) && val) tr[tier] = val; } track = JSON.stringify(tr); }
    let starts = o.starts_at, ends = o.ends_at;
    if (n > cur.number) {
      if (b.starts_at !== undefined) starts = Math.floor(+b.starts_at) || null; if (b.ends_at !== undefined) ends = Math.floor(+b.ends_at) || null;
      const st = starts || s.start_at, en = ends || s.end_at; if (en <= st) return { ok: false, error: 'The season must end after it starts.' };
    } else if (b.ends_at !== undefined) { ends = Math.floor(+b.ends_at); if (!(ends > now())) return { ok: false, error: 'To end the live season now use "End season now".' }; }
    db.prepare(`INSERT INTO admin_seasons (number, name, starts_at, ends_at, track, theme, notes, updated_by, updated_at) VALUES (@n,@name,@starts,@ends,@track,@theme,@notes,@by,@t)
      ON CONFLICT(number) DO UPDATE SET name=excluded.name, starts_at=excluded.starts_at, ends_at=excluded.ends_at, track=excluded.track, theme=excluded.theme, notes=excluded.notes, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
      .run({ n, name: name || null, starts: starts || null, ends: ends || null, track: track || null, theme: b.theme !== undefined ? str(b.theme, 40) : (o.theme || ''), notes: b.notes !== undefined ? str(b.notes, 400) : (o.notes || ''), by: RO.who(req).username, t: now() });
    RO.act(req, 'season.edit', 'season:' + n, JSON.stringify(b).slice(0, 300)); return { ok: true, season: seasonN(n) };
  },
  // end the live season now: results archived to the hall of fame, the next season starts immediately (roll)
  endNow(req, confirm) {
    if (ENGINE && ENGINE.adminEnd) { const r0 = ENGINE.adminEnd(RO.who(req), String(confirm || '')); if (r0.ok) RO.act(req, 'season.end_now', 'season:' + r0.ended, `${r0.archived} players archived`); return r0; }
    const cur = seasonAtOverlay(); if (String(confirm || '') !== cur.name) return { ok: false, error: `Type the season name (${cur.name}) to confirm.` };
    const t = now();
    db.prepare(`INSERT INTO admin_seasons (number, ended_early_at, updated_by, updated_at) VALUES (?,?,?,?) ON CONFLICT(number) DO UPDATE SET ended_early_at=excluded.ended_early_at, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).run(cur.number, t, RO.who(req).username, t);
    const n = archiveSeason(cur.number);
    N.notify(null, 'system', `Season ${cur.number}: ${cur.name} has ended`, `Season ${cur.number + 1}: ${seasonN(cur.number + 1).name} starts now. The top players are in the hall of fame.`, '/season', 'trophy');
    RO.act(req, 'season.end_now', 'season:' + cur.number, `${n} players archived`); return { ok: true, ended: cur.number, next: seasonAtOverlay(t + 1000), archived: n };
  },
  sweep() { if (ENGINE) return; const cur = seasonAtOverlay(); for (let n = Math.max(1, cur.number - 2); n < cur.number; n++) archiveSeason(n); },
};

// ---- shop overlay: pins, featured, retired, sales (sales come from events of kind shop_sale) ----
const SHOP_KEY = 'shop_admin';
const shopCfg = () => { const c = getS(SHOP_KEY, {}); return { pins: (c.pins || []).filter(p => SH.BY_ID[p.item]), featured: (c.featured || []).filter(i => SH.BY_ID[i]), retired: (c.retired || []).filter(i => SH.BY_ID[i]) }; };
const baseRotation = SH.rotation; const basePub = SH.pub; const baseBuy = SH.buy; const baseSync = SH.sync;
function effRotation(t = now()) {
  const r = baseRotation(t); const c = shopCfg(); const ret = new Set(c.retired);
  const pins = c.pins.filter(p => !p.until || p.until > t).map(p => SH.BY_ID[p.item]).filter(i => !ret.has(i.id));
  const daily = r.daily.filter(i => !ret.has(i.id)); const weekly = r.weekly.filter(i => !ret.has(i.id));
  for (const p of pins) if (!daily.includes(p) && !weekly.includes(p)) (p.rarity === 'epic' || p.rarity === 'legendary' ? weekly : daily).unshift(p);
  return { ...r, daily, weekly, pinned: pins.map(p => p.id), featured: c.featured.filter(i => !ret.has(i)) };
}
const salePrice = (it, t = now()) => { const s = activeEffects(t).sale; if (!s || !(s.items.length === 0 || s.items.includes(it.id))) return null; return Math.max(1, Math.round(it.price * (100 - s.pct) / 100)); };
let shopOverlay = false;
function installShopOverlay() {
  if (shopOverlay) return; shopOverlay = true;
  SH.rotation = effRotation;
  SH.pub = (i, own) => { const o = basePub(i, own); const sp = salePrice(i); const c = shopCfg(); if (sp != null) { o.sale_price = sp; o.list_price = i.price; o.price = sp; o.sale = activeEffects().sale.name; } if (c.featured.includes(i.id)) o.featured = true; if (c.pins.some(p => p.item === i.id)) o.pinned = true; return o; };
  // shop.buy (src/shop.js) prices through module.exports.priceFor and checks module.exports.rotation, so wrapping those two
  // is enough: a live sale lowers the price (perk discounts still apply when they are cheaper); pins/retired come from effRotation.
  if (typeof SH.priceFor === 'function') { const basePrice = SH.priceFor; SH.priceFor = (it, user, t = now()) => { const b = basePrice(it, user, t); const sp = salePrice(it, t); return sp != null ? Math.min(b, sp) : b; }; }
  else SH.buy = (user, itemId, t = now()) => { const it = SH.BY_ID[itemId]; const sp = it ? salePrice(it, t) : null; if (sp == null) return baseBuy(user, itemId, t); const p0 = it.price; it.price = sp; try { return baseBuy(user, itemId, t); } finally { it.price = p0; } };
  // event bonus: during Double Points, each run in the window earns (multiplier - 1) x the normal run points, within the daily cap
  SH.sync = (userId) => { const b = baseSync(userId); try { if (eventBonus(userId)) return SH.balance(userId); } catch (e) { /* never break the shop */ } return b; };
}
function eventBonus(userId) {
  const evs = db.prepare("SELECT id, starts_at, ends_at, multiplier FROM hub_events WHERE kind='double_points' AND status<>'cancelled' AND starts_at<=? AND ends_at>=? - 7*86400000").all(now(), now());
  if (!evs.length) return 0; let n = 0; const per = SH.EARN.run || 5; const cap = SH.EARN.runDailyCap || 40;
  const ins = db.prepare('INSERT OR IGNORE INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)');
  for (const e of evs) {
    const runs = db.prepare('SELECT id, created_at FROM runs WHERE user_id=? AND created_at BETWEEN ? AND ? AND held=0 ORDER BY id').all(userId, e.starts_at, e.ends_at);
    const perDay = {};
    for (const r of runs) { const d = PR.dayNum(r.created_at); perDay[d] = (perDay[d] || 0) + 1; if (perDay[d] * per > cap) continue;
      n += ins.run(userId, Math.round(per * (e.multiplier - 1)), 'event', `ev${e.id}:r${r.id}`, r.created_at).changes; }
  }
  return n;
}
const shop = {
  overview(t = now()) {
    const c = shopCfg(); const rot = effRotation(t); const base = baseRotation(t);
    const sold = new Map(db.prepare('SELECT item_id, COUNT(*) AS n, SUM(price) AS pts FROM user_items WHERE price>0 GROUP BY item_id').all().map(r => [r.item_id, r]));
    const item = (i) => ({ id: i.id, name: i.name, type: i.type, rarity: i.rarity, price: i.price, sale_price: salePrice(i, t), retired: c.retired.includes(i.id), featured: c.featured.includes(i.id), pin: c.pins.find(p => p.item === i.id) || null, sold: (sold.get(i.id) || {}).n || 0, points: (sold.get(i.id) || {}).pts || 0, preview: basePub(i, false) });
    const future = []; for (let k = 1; k <= 7; k++) { const tt = PR.dayStart(PR.dayNum(t) + k) + 3600e3; const r = effRotation(tt); future.push({ day: tt, daily: r.daily.map(i => i.id), weekly: r.weekly.map(i => i.id), week_changes: baseRotation(tt).week !== base.week }); }
    return { now: { daily: rot.daily.map(item), weekly: rot.weekly.map(item), daily_ends: rot.daily_ends, weekly_ends: rot.weekly_ends }, items: SH.ITEMS.map(item), sale: activeEffects(t).sale, future,
      sales: eventsList().filter(e => e.kind === 'shop_sale'), cfg: c, rarities: SH.RARITY };
  },
  set(req, b) {
    const c = shopCfg(); const id = String(b.item || ''); if (!SH.BY_ID[id]) return { ok: false, error: 'Unknown item.' };
    const tog = (arr, on) => on ? [...new Set([...arr, id])] : arr.filter(x => x !== id);
    if (b.action === 'pin') c.pins = [...c.pins.filter(p => p.item !== id), { item: id, until: b.until ? Math.floor(+b.until) : null }];
    else if (b.action === 'unpin') c.pins = c.pins.filter(p => p.item !== id);
    else if (b.action === 'feature' || b.action === 'unfeature') c.featured = tog(c.featured, b.action === 'feature');
    else if (b.action === 'retire' || b.action === 'unretire') { c.retired = tog(c.retired, b.action === 'retire'); if (b.action === 'retire') c.pins = c.pins.filter(p => p.item !== id); }
    else return { ok: false, error: 'Unknown action.' };
    setS(SHOP_KEY, c); RO.act(req, 'shop.' + b.action, 'item:' + id); return { ok: true, cfg: shopCfg() };
  },
};

// =====================================================================================================================
// Custom badges (shown + granted exactly like the built-in admin badges)
// =====================================================================================================================
function loadBadges() {
  const builtIn = ach.ADMIN_BADGES.filter(b => !b.custom);
  const custom = db.prepare('SELECT * FROM custom_badges WHERE retired=0').all().map(b => ({ id: b.id, name: b.name, icon: b.icon, desc: b.description, color: b.color, art: b.art, custom: true, admin_only: !!b.admin_only }));
  ach.ADMIN_BADGES.length = 0; ach.ADMIN_BADGES.push(...builtIn, ...custom);
  for (const k of Object.keys(ach.ADMIN_BY)) delete ach.ADMIN_BY[k];
  for (const b of ach.ADMIN_BADGES) ach.ADMIN_BY[b.id] = b;
}
const ICON_NAMES = (() => { try { return Object.keys(JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'icons.js'), 'utf8').match(/export const ICONS=(\{.*?\});/s)[1])); } catch { return []; } })();
function saveBadge(req, b, id = null) {
  const name = str(b.name, 40); if (!name) return { ok: false, error: 'Give the badge a name.' };
  const icon = ICON_NAMES.includes(b.icon) ? b.icon : 'star'; const color = /^#[0-9a-fA-F]{6}$/.test(b.color || '') ? b.color : '#a78bfa';
  const art = /^\/media\/[a-z0-9-]+\.png$/.test(b.art || '') ? b.art : ''; const t = now();
  if (id) {
    if (!id.startsWith('c-')) return { ok: false, error: 'Built-in badges can\'t be edited (create a custom one instead).' };
    const r = db.prepare('UPDATE custom_badges SET name=?, description=?, icon=?, color=?, art=?, admin_only=?, retired=?, updated_at=? WHERE id=?').run(name, str(b.description, 160), icon, color, art, b.admin_only === false ? 0 : 1, b.retired ? 1 : 0, t, id);
    if (!r.changes) return { ok: false, error: 'Badge not found.' };
  } else {
    id = 'c-' + (name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'badge');
    let k = id, i = 2; while (db.prepare('SELECT 1 FROM custom_badges WHERE id=?').get(k) || ach.ADMIN_BY[k]) k = `${id}-${i++}`; id = k;
    db.prepare('INSERT INTO custom_badges (id, name, description, icon, color, art, admin_only, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').run(id, name, str(b.description, 160), icon, color, art, b.admin_only === false ? 0 : 1, RO.who(req).username, t, t);
  }
  loadBadges(); RO.act(req, 'badge.save', 'badge:' + id, name); return { ok: true, id };
}
function badgeOverview() {
  const holders = new Map(db.prepare('SELECT badge_id, COUNT(*) AS c FROM badge_grants GROUP BY badge_id').all().map(r => [r.badge_id, r.c]));
  const unlocks = new Map(db.prepare('SELECT ach_id, COUNT(*) AS c FROM user_achievements GROUP BY ach_id').all().map(r => [r.ach_id, r.c]));
  const players = db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_demo=0').get().c || 1;
  const retired = db.prepare('SELECT * FROM custom_badges WHERE retired=1').all().map(b => ({ id: b.id, name: b.name, icon: b.icon, desc: b.description, color: b.color, art: b.art, custom: true, retired: true }));
  return { admin: [...ach.ADMIN_BADGES, ...retired].map(b => ({ ...b, art_url: b.art || `/badges/adm:${b.id}.svg`, holders: holders.get(b.id) || 0, builtin: !b.custom })),
    achievements: ach.ACHIEVEMENTS.map(a => ({ id: a.id, name: a.name, desc: a.desc, tier: a.tier, cat: a.cat, icon: a.icon, art_url: `/badges/${a.id}.svg`, unlocked: unlocks.get(a.id) || 0, pct: Math.round(1000 * (unlocks.get(a.id) || 0) / players) / 10 })),
    grants: db.prepare('SELECT g.badge_id, g.granted_by, g.note, g.created_at, u.username FROM badge_grants g JOIN users u ON u.id=g.user_id ORDER BY g.created_at DESC LIMIT 100').all(), icons: ICON_NAMES };
}
function awardBadge(req, username, badgeId, on, note = '') {
  const u = db.prepare('SELECT id, username FROM users WHERE username=? OR id=?').get(String(username || ''), parseInt(username, 10) || 0); if (!u) return { ok: false, error: 'Player not found.' };
  const b = ach.ADMIN_BY[badgeId]; if (!b) return { ok: false, error: 'Unknown badge.' }; const t = now(); const actor = RO.who(req).username;
  if (on) { const r = db.prepare('INSERT OR IGNORE INTO badge_grants (user_id, badge_id, granted_by, note, created_at) VALUES (?,?,?,?,?)').run(u.id, b.id, actor, str(note, 200), t); if (!r.changes) return { ok: false, error: `${u.username} already has ${b.name}.` };
    N.notify(u.id, 'system', `You earned the ${b.name} badge`, b.desc || 'Awarded by the Trap Tech team.', '/achievements', 'award'); }
  else { const r = db.prepare('DELETE FROM badge_grants WHERE user_id=? AND badge_id=?').run(u.id, b.id); if (!r.changes) return { ok: false, error: `${u.username} does not have ${b.name}.` };
    db.prepare("UPDATE users SET eq_badge='' WHERE id=? AND eq_badge=?").run(u.id, 'adm:' + b.id); }
  try { db.prepare('INSERT INTO badge_audit (user_id, username, badge_id, action, actor, note, created_at) VALUES (?,?,?,?,?,?,?)').run(u.id, u.username, b.id, on ? 'grant' : 'revoke', actor, str(note, 200), t); } catch {}
  RO.act(req, on ? 'badge.grant' : 'badge.revoke', 'user:' + u.id, `${b.id}${note ? ': ' + note : ''}`); return { ok: true };
}

// =====================================================================================================================
// Action log (admin_actions + giveaway audit + badge audit + sign-ins)
// =====================================================================================================================
function actionLog(q = {}) {
  const lim = Math.max(20, Math.min(500, parseInt(q.limit, 10) || 200)); const s = str(q.q, 40);
  const like = s ? `%${s}%` : '%';
  const a = db.prepare('SELECT at, actor, role, action, target, detail, \'admin\' AS src FROM admin_actions WHERE (actor LIKE ? OR action LIKE ? OR target LIKE ? OR detail LIKE ?) ORDER BY id DESC LIMIT ?').all(like, like, like, like, lim);
  const g = db.prepare("SELECT a.created_at AS at, a.actor, '' AS role, 'giveaway.' || a.action AS action, 'giveaway:' || a.giveaway_id AS target, COALESCE(a.username,'') || CASE WHEN a.detail<>'' THEN ' ' || a.detail ELSE '' END AS detail, 'giveaway' AS src FROM giveaway_audit a WHERE a.actor<>'system' AND (a.actor LIKE ? OR a.action LIKE ?) ORDER BY a.id DESC LIMIT ?").all(like, like, lim);
  let l = []; try { l = db.prepare("SELECT at, COALESCE(username,'?') AS actor, '' AS role, 'signin.' || event || CASE WHEN ok THEN '' ELSE ' (failed)' END AS action, COALESCE(ip_hint,'') AS target, COALESCE(detail,'') AS detail, 'signin' AS src FROM admin_login_log ORDER BY id DESC LIMIT ?").all(Math.min(lim, 100)); } catch { l = []; }
  return [...a, ...g, ...l].sort((x, y) => y.at - x.at).slice(0, lim).map(r => ({ ...r, detail: String(r.detail || '').slice(0, 300) }));
}

// =====================================================================================================================
// Analytics (computed on demand, cached 60 s; all SQL on indexed columns)
// =====================================================================================================================
let anCache = null;
function analytics(days = 30) {
  days = Math.max(7, Math.min(90, parseInt(days, 10) || 30)); const t = now();
  if (anCache && anCache.days === days && t - anCache.at < 60e3) return anCache.v;
  const today = PR.dayNum(t); const d0 = today - days + 1; const since = PR.dayStart(d0);
  const dayOf = (ms) => PR.dayNum(ms); const label = (d) => new Date(PR.dayStart(d) + 12 * 3600e3).toLocaleDateString('en-US', { timeZone: cfg.TZ, month: 'short', day: 'numeric' });
  const series = () => Array.from({ length: days }, (_, i) => ({ day: d0 + i, label: label(d0 + i), v: 0 }));
  // DAU: players with a run, check-in or quest claim that day (demo players excluded)
  const act = db.prepare(`SELECT user_id, created_at FROM runs WHERE created_at>=@s AND is_demo=0 UNION ALL SELECT user_id, created_at FROM checkins WHERE created_at>=@s UNION ALL SELECT user_id, created_at FROM quest_claims WHERE created_at>=@s`).all({ s: since });
  const dauSets = new Map(); for (const r of act) { const d = dayOf(r.created_at); if (!dauSets.has(d)) dauSets.set(d, new Set()); dauSets.get(d).add(r.user_id); }
  const dau = series().map(x => ({ ...x, v: (dauSets.get(x.day) || new Set()).size }));
  const signups = series(); for (const r of db.prepare('SELECT created_at FROM users WHERE created_at>=? AND is_demo=0').all(since)) { const i = dayOf(r.created_at) - d0; if (signups[i]) signups[i].v++; }
  const runsDay = series(); const perGame = {}; const playersGame = {};
  for (const r of db.prepare('SELECT game_id, user_id, created_at FROM runs WHERE created_at>=? AND is_demo=0').all(since)) {
    const i = dayOf(r.created_at) - d0; if (runsDay[i]) runsDay[i].v++; perGame[r.game_id] = (perGame[r.game_id] || 0) + 1; (playersGame[r.game_id] = playersGame[r.game_id] || new Set()).add(r.user_id);
  }
  const title = (id) => ((cfg.gameInfo ? cfg.gameInfo(id) : cfg.GAME_MAP[id]) || {}).title || id;
  const games = Object.keys(perGame).map(id => ({ id, title: title(id), runs: perGame[id], players: playersGame[id].size })).sort((a, b) => b.runs - a.runs);
  // retention: of players who signed up 1 / 7 / 30+ days ago (in the last 90 days), how many came back on that day
  const cohort = db.prepare('SELECT id, created_at FROM users WHERE created_at >= ? AND is_demo=0').all(t - 90 * D);
  const actDays = (uid) => new Set(db.prepare('SELECT DISTINCT created_at/3600000 AS h FROM runs WHERE user_id=?').all(uid).map(r => dayOf(r.h * 3600000)));
  const ret = { d1: [0, 0], d7: [0, 0], d30: [0, 0] };
  for (const u of cohort.slice(0, 3000)) { const sd = dayOf(u.created_at); const ad = actDays(u.id);
    for (const [k, n] of [['d1', 1], ['d7', 7], ['d30', 30]]) if (sd + n <= today) { ret[k][1]++; if ([...ad].some(d => d >= sd + n && d <= sd + n + (n === 1 ? 0 : n === 7 ? 1 : 3))) ret[k][0]++; } }
  const pct = ([a, b]) => b ? Math.round(1000 * a / b) / 10 : null;
  const gws = db.prepare(`SELECT g.id, g.title, g.start_at, g.end_at, g.finalized_at, g.require_join, (SELECT COUNT(*) FROM giveaway_entries e WHERE e.giveaway_id=g.id AND e.left_at IS NULL) AS joined,
      (SELECT COUNT(*) FROM giveaway_results r WHERE r.giveaway_id=g.id) AS final_entrants FROM giveaways g WHERE g.is_demo=0 AND g.end_at >= ? AND COALESCE(g.archived,0)=0 ORDER BY g.end_at DESC LIMIT 12`).all(t - days * D)
    .map(g => ({ ...g, entrants: g.finalized_at ? g.final_entrants : g.require_join ? g.joined : db.prepare(`SELECT COUNT(DISTINCT r.user_id) AS c FROM runs r JOIN giveaway_games gg ON gg.game_id=r.game_id AND gg.giveaway_id=? WHERE r.started_at>=? AND r.created_at<=?`).get(g.id, g.start_at, g.end_at).c }));
  const ref = db.prepare(`SELECT COUNT(*) AS invited, SUM(EXISTS (SELECT 1 FROM runs r WHERE r.user_id=u.id)) AS played, SUM((SELECT COUNT(*) FROM runs r WHERE r.user_id=u.id) >= 5) AS engaged,
      SUM(EXISTS (SELECT 1 FROM giveaway_entries e WHERE e.user_id=u.id) OR EXISTS (SELECT 1 FROM giveaway_results gr WHERE gr.user_id=u.id)) AS entered FROM users u WHERE u.referred_by IS NOT NULL AND u.created_at >= ? AND u.is_demo=0`).get(since);
  const topRef = db.prepare('SELECT r.username, COUNT(*) AS n FROM users u JOIN users r ON r.id=u.referred_by WHERE u.created_at>=? GROUP BY u.referred_by ORDER BY n DESC LIMIT 5').all(since);
  const v = { days, generated_at: t,
    totals: { players: db.prepare('SELECT COUNT(*) AS c FROM users WHERE is_demo=0').get().c, runs: db.prepare('SELECT COUNT(*) AS c FROM runs WHERE is_demo=0').get().c,
      dau_today: dau[dau.length - 1].v, wau: new Set(act.filter(r => r.created_at >= t - 7 * D).map(r => r.user_id)).size, mau: new Set(act.filter(r => r.created_at >= t - 30 * D).map(r => r.user_id)).size,
      signups_period: signups.reduce((s, x) => s + x.v, 0), runs_period: runsDay.reduce((s, x) => s + x.v, 0), online_15m: db.prepare('SELECT COUNT(DISTINCT user_id) AS c FROM user_ip_log WHERE last_seen >= ?').get(t - 15 * 60e3).c,
      points_issued: db.prepare('SELECT COALESCE(SUM(amount),0) AS s FROM points_ledger WHERE amount>0 AND created_at>=?').get(since).s, items_bought: db.prepare('SELECT COUNT(*) AS c FROM user_items WHERE price>0 AND acquired_at>=?').get(since).c },
    dau, signups, runs: runsDay, games, top_games: games.slice(0, 5), retention: { d1: pct(ret.d1), d7: pct(ret.d7), d30: pct(ret.d30), cohort: { d1: ret.d1[1], d7: ret.d7[1], d30: ret.d30[1] } },
    giveaways: gws, referrals: { invited: ref.invited || 0, played: ref.played || 0, engaged: ref.engaged || 0, entered: ref.entered || 0, top: topRef } };
  anCache = { at: t, days, v }; return v;
}

// =====================================================================================================================
// Announcements: site banner + broadcast
// =====================================================================================================================
const TONES = ['info', 'promo', 'warning', 'success'];
function banner() { const b = getS('site_banner', null); if (!b || !b.on) return null; const t = now(); if ((b.starts_at && t < b.starts_at) || (b.ends_at && t > b.ends_at)) return null; return { text: b.text, link: b.link, link_label: b.link_label, tone: b.tone, id: b.id, dismissible: b.dismissible !== false }; }
function setBanner(req, b) { cfgCache = null; /* v7: public config shows changes at once */
  const v = { on: !!b.on, text: str(b.text, 200), link: /^\/[^\s"'<>]{0,200}$|^https:\/\/[^\s"'<>]{4,200}$/.test(b.link || '') ? b.link : '', link_label: str(b.link_label, 30), tone: TONES.includes(b.tone) ? b.tone : 'info',
    starts_at: b.starts_at ? Math.floor(+b.starts_at) : null, ends_at: b.ends_at ? Math.floor(+b.ends_at) : null, dismissible: b.dismissible !== false, id: now().toString(36) };
  if (v.on && !v.text) return { ok: false, error: 'Write the banner text.' };
  setS('site_banner', v); RO.act(req, v.on ? 'banner.on' : 'banner.off', 'site', v.text); return { ok: true, banner: v };
}
function broadcast(req, b) {
  const title = str(b.title, 140); if (!title) return { ok: false, error: 'Write a title.' };
  const link = /^\/[^\s"'<>]{0,200}$/.test(b.link || '') ? b.link : '';
  const today = db.prepare("SELECT COUNT(*) AS c FROM admin_actions WHERE action='broadcast.send' AND at >= ?").get(now() - D).c;
  if (today >= 5) return { ok: false, error: 'Max 5 broadcasts per 24 hours (players turn off noisy apps).' };
  N.notify(null, 'system', title, str(b.body, 400), link, 'megaphone');
  if (b.post) db.prepare('INSERT INTO announcements (title, body, created_at) VALUES (?,?,?)').run(title, str(b.body, 4000), now());
  RO.act(req, 'broadcast.send', 'all', title); return { ok: true };
}

// =====================================================================================================================
// Site settings (public part served at /api/site-config, read by public/js/site-config.js)
// =====================================================================================================================
const LEGAL = ['terms', 'privacy', 'rules', 'responsible'];
const SITE_DEFAULTS = { name: 'The Gaming Hub', tagline: 'by Trap Tech Solutions', accent: '', support_potato: '', maintenance: { on: false, message: 'We are making the hub better. Back soon!', until: null },
  age_gate: { title: '', text: '' }, legal: {}, socials: { potato: '', instagram: '', x: '' } };
function site() { const s = getS('site_settings', {}); return { ...SITE_DEFAULTS, ...s, maintenance: { ...SITE_DEFAULTS.maintenance, ...(s.maintenance || {}) }, age_gate: { ...SITE_DEFAULTS.age_gate, ...(s.age_gate || {}) }, legal: { ...(s.legal || {}) }, socials: { ...SITE_DEFAULTS.socials, ...(s.socials || {}) } }; }
function setSite(req, b) {
  const G = require('./admin-giveaways'); const s = site();
  if (b.name !== undefined) { const n = str(b.name, 40); if (!n) return { ok: false, error: 'Site name can\'t be empty.' }; s.name = n; }
  if (b.tagline !== undefined) s.tagline = str(b.tagline, 60);
  if (b.accent !== undefined) s.accent = /^#[0-9a-fA-F]{6}$/.test(b.accent) ? b.accent : '';
  if (b.support_potato !== undefined) s.support_potato = str(b.support_potato, 32).replace(/[^A-Za-z0-9_]/g, '');
  if (b.maintenance) s.maintenance = { on: !!b.maintenance.on, message: str(b.maintenance.message, 300) || SITE_DEFAULTS.maintenance.message, until: b.maintenance.until ? Math.floor(+b.maintenance.until) : null };
  if (b.age_gate) s.age_gate = { title: str(b.age_gate.title, 80), text: str(b.age_gate.text, 600) };
  if (b.legal) for (const k of LEGAL) if (b.legal[k] !== undefined) { const h = G.sanitizeHtml(String(b.legal[k] || '')).slice(0, 60000); if (h.trim()) s.legal[k] = { html: h, updated_at: now() }; else delete s.legal[k]; }
  if (b.socials) for (const k of Object.keys(SITE_DEFAULTS.socials)) if (b.socials[k] !== undefined) s.socials[k] = /^https:\/\/[^\s"'<>]{4,200}$/.test(b.socials[k]) ? b.socials[k] : '';
  setS('site_settings', s); cfgCache = null;
  RO.act(req, 'settings.save', 'site', Object.keys(b).join(', ')); return { ok: true, site: s };
}
let cfgCache = null;
function publicConfig() {
  const t = now(); if (cfgCache && t - cfgCache.at < 10e3) return cfgCache.v;
  const s = site(); const fx = activeEffects(t);
  const v = { ok: true, name: s.name, tagline: s.tagline, accent: s.accent, support_potato: s.support_potato, socials: s.socials, maintenance: s.maintenance.on ? { on: true, message: s.maintenance.message, until: s.maintenance.until } : null,
    age_gate: (s.age_gate.title || s.age_gate.text) ? s.age_gate : null, legal: Object.fromEntries(Object.entries(s.legal).map(([k, v]) => [k, v.html])), banner: banner(),
    events: fx.events.filter(e => e.banner).map(e => ({ id: e.id, kind: e.kind, name: e.name, description: e.description, ends_at: e.ends_at, multiplier: e.multiplier, sale_pct: e.sale_pct })) };
  cfgCache = { at: t, v }; return v;
}
const maintenanceOn = () => { const v = publicConfig(); return v.maintenance; };
// players get a 503 on game/API writes while maintenance is on (pages still load and show the notice; admin is unaffected)
function maintenanceGate(req, res, next) {
  if (!req.path.startsWith('/api/') || req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (/^\/api\/(site-config|auth\/logout)/.test(req.path)) return next();
  const m = maintenanceOn(); if (!m) return next();
  res.status(503).json({ ok: false, maintenance: true, error: m.message || 'The hub is in maintenance. Back soon!' });
}

function init() { loadBadges(); installSeasonOverlay(); installShopOverlay(); }
function sweep() { try { eventsSweep(); } catch (e) { console.error('events sweep', e.message); } try { seasons.sweep(); } catch (e) { console.error('season sweep', e.message); } }
module.exports = { init, sweep, EVENT_KINDS, RECUR, eventsList, createEvent, updateEvent, deleteEvent, activeEffects, seasons, seasonN, shop, effRotation, salePrice, loadBadges, saveBadge, badgeOverview, awardBadge, ICON_NAMES,
  actionLog, analytics, banner, setBanner, broadcast, site, setSite, publicConfig, maintenanceGate, LEGAL, TONES, eventBonus };

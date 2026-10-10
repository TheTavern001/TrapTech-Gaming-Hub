'use strict';
// v7 season engine (docs/ECONOMY.md). Seasons auto-roll forever: Season 1 started Thu Oct 1 2026 00:00 (hub time) and
// every season lasts 8 weeks (56 days) unless an admin ends it early or extends it (overrides shift the seasons after it).
// Each season has a free 60-level track (no paid pass): Hub Points on most levels, 13 season-exclusive cosmetics,
// six perks, then endless "Overdrive" stars past level 60. Soft reset: season XP starts again at 0, but everyone gets a
// head start of 10% of last season's XP (max 2,000). When a season ends its results are archived (season_results),
// the top 10 go in the hall of fame and get a season title, and #1 gets the Champion title.
// progress.js seasonAt / seasonProgress / bestSeasonTier / seasonBoard delegate here (same shapes, more fields).
const db = require('./db');
const cfg = require('./config');
const G = require('./shop-gen');
const D = 864e5;
const PR = () => require('./progress');
const LEN_DAYS = 56, LEVELS = 60;
const EPOCH_DAY = 20727; // hub day number of 2026-10-01
const NAMES = ['Neon Genesis', 'Purple Haze', 'Chrome Summer', 'Afterglow', 'Static Bloom', 'Night Shift', 'Hyperdrive', 'Low Orbit', 'Golden Hour', 'Frostbyte',
  'Terp Tide', 'Pixel Rain', 'Cloud Nine', 'Overdrive', 'Midnight Garden', 'Solar Flare', 'Glass House', 'Aurora', 'Retrograde', 'High Tide'];
const PALS = ['neon', 'haze', 'chrome', 'sunset', 'kush', 'galaxy', 'ocean', 'ice', 'gold', 'frost', 'terp', 'arcade', 'mint', 'lava', 'toxic', 'ember', 'royal', 'summer', 'rose', 'dab'];
const THEMES = ['gaming', 'culture', 'money', 'culture', 'culture', 'gaming', 'gaming', 'gaming', 'money', 'money', 'culture', 'gaming', 'culture', 'gaming', 'culture', 'gaming', 'money', 'culture', 'gaming', 'money'];
const ROMAN = ['', '', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
const nameOf = (n) => NAMES[(n - 1) % NAMES.length] + (ROMAN[Math.ceil(n / NAMES.length)] ?? ' ' + Math.ceil(n / NAMES.length));

// ---------- level curve + track ----------
const stepXp = (L) => 200 + 10 * L; // XP from level L-1 to L
const CUM = [0]; for (let L = 1; L <= LEVELS; L++) CUM[L] = CUM[L - 1] + stepXp(L); // CUM[60] = 30,300
const OVERDRIVE_XP = 2000, OVERDRIVE_POINTS = 100, OVERDRIVE_MAX = 20;
function levelOf(xp) {
  let L = 0; while (L < LEVELS && xp >= CUM[L + 1]) L++;
  const over = L >= LEVELS ? Math.floor((xp - CUM[LEVELS]) / OVERDRIVE_XP) : 0;
  const into = L >= LEVELS ? (xp - CUM[LEVELS]) % OVERDRIVE_XP : xp - CUM[L]; const need = L >= LEVELS ? OVERDRIVE_XP : stepXp(L + 1);
  return { level: L, into, need, overdrive: over };
}
// season-exclusive cosmetics on the track (never sold, never return). slot = index here.
const SCHEDULE = [[3, 'title', 'rare', 'Rookie'], [6, 'color', 'rare'], [10, 'banner', 'rare'], [15, 'badge', 'rare'], [20, 'frame', 'epic'], [25, 'title', 'epic', 'Veteran'], [30, 'effect', 'epic'],
  [35, 'banner', 'epic'], [40, 'color', 'epic'], [45, 'badge', 'epic'], [50, 'frame', 'legendary'], [55, 'effect', 'legendary'], [60, 'banner', 'legendary', 'Legend']];
const TOP10_SLOT = 90, CHAMP_SLOT = 91;
const PERKS = [
  { level: 8, id: 'discount5', name: '5% off the shop', desc: 'Every Points Shop price is 5% lower for the rest of the season.', discount: 5 },
  { level: 18, id: 'peek', name: 'Early peek', desc: "See tomorrow's daily picks in the shop before they go live." },
  { level: 28, id: 'discount10', name: '10% off the shop', desc: 'Shop prices are 10% lower for the rest of the season.', discount: 10 },
  { level: 38, id: 'vault', name: 'Vault radar', desc: 'See which retired items return from the Vault over the next 7 days.' },
  { level: 48, id: 'discount15', name: '15% off the shop', desc: 'Shop prices are 15% lower for the rest of the season.', discount: 15 },
  { level: 58, id: 'glow', name: 'Season glow', desc: 'An animated ring around your name on the season leaderboard.' },
];
const pointsAt = (L) => SCHEDULE.some(s => s[0] === L) ? 0 : 40 + 20 * Math.floor(L / 10);
const NOUN = { banner: 'Banner', frame: 'Frame', color: 'Glow', badge: 'Crest', effect: 'Aura', title: '' };
G.parse.contexts.k = (n, slot) => {
  const pal = PALS[(n - 1) % PALS.length]; const theme = THEMES[(n - 1) % THEMES.length]; const nm = nameOf(n);
  if (slot === TOP10_SLOT) return { type: 'title', rarity: 'epic', palette: pal, theme, name: `S${n} Top 10` };
  if (slot === CHAMP_SLOT) return { type: 'title', rarity: 'legendary', palette: pal, theme, name: `S${n} Champion` };
  const s = SCHEDULE[slot]; if (!s) return null;
  return { type: s[1], rarity: s[2], palette: pal, theme, name: s[1] === 'title' ? `${nm} ${s[3]}` : `${nm} ${s[3] || NOUN[s[1]]}${s[0] >= 35 && !s[3] ? ' II' : ''}`, label: `Season ${n} level ${s[0]}` };
};
const trackItem = (n, slot) => G.parse(G.make('k', n, slot, G.parse.contexts.k(n, slot)).id);

// ---------- calendar (with admin overrides) ----------
db.exec(`CREATE TABLE IF NOT EXISTS season_overrides (number INTEGER PRIMARY KEY, name TEXT, theme TEXT, ends_at INTEGER, notes TEXT NOT NULL DEFAULT '', updated_by TEXT, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS season_results (number INTEGER NOT NULL, user_id INTEGER NOT NULL, username TEXT NOT NULL, xp INTEGER NOT NULL, level INTEGER NOT NULL, rank INTEGER NOT NULL,
  archived_at INTEGER NOT NULL, PRIMARY KEY (number, user_id));
CREATE INDEX IF NOT EXISTS idx_season_results_rank ON season_results(number, rank);
CREATE TABLE IF NOT EXISTS season_archive_log (number INTEGER PRIMARY KEY, players INTEGER NOT NULL, archived_at INTEGER NOT NULL);`);
let OV = null; let bounds = [];
function loadOv() { OV = new Map(db.prepare('SELECT * FROM season_overrides').all().map(o => [o.number, o])); bounds = []; }
function info(n) {
  if (!OV) loadOv();
  while (bounds.length < n) {
    const k = bounds.length + 1; const prev = bounds[k - 2];
    const start = k === 1 ? PR().dayStart(EPOCH_DAY) : prev.end_at + 1;
    const o = OV.get(k) || {}; const nominal = PR().dayStart(PR().dayNum(start + 3600e3) + LEN_DAYS) - 1;
    const end = o.ends_at && o.ends_at > start ? o.ends_at : nominal;
    const pal = (o.theme && G.PALETTES[o.theme]) ? o.theme : PALS[(k - 1) % PALS.length];
    bounds.push({ number: k, name: o.name || nameOf(k), palette: pal, theme: THEMES[(k - 1) % THEMES.length], start_at: start, end_at: end, notes: o.notes || '', overridden: !!o.number, ended_early: !!(o.ends_at && o.ends_at < nominal) });
  }
  return bounds[n - 1];
}
function seasonAt(t = Date.now()) {
  let n = 1; if (t >= info(1).start_at) { n = Math.max(1, Math.floor((t - info(1).start_at) / (LEN_DAYS * D)) - 2); while (info(n).end_at < t) n++; while (n > 1 && info(n).start_at > t) n--; }
  const s = info(n);
  return { number: n, name: s.name, palette: s.palette, theme: s.theme, start_at: s.start_at, end_at: s.end_at, tiers: LEVELS, levels: LEVELS, tier_xp: stepXp(1), length_days: Math.round((s.end_at + 1 - s.start_at) / D) };
}
// shop season items use the season look
G.parse.contexts.s = (n, slot) => { if (slot > 5) return null; const s = info(n); return { type: G.TYPES[slot], palette: s.palette, theme: s.theme, rarity: ['rare', 'epic', 'rare', 'epic', 'epic', 'legendary'][slot] }; };

// ---------- XP + head start ----------
const XPF = () => PR().xpFor;
const hsCache = new Map();
function headStart(userId, n) {
  if (n <= 1 || !userId) return 0; const key = n + ':' + userId; if (hsCache.has(key)) return hsCache.get(key);
  const row = db.prepare('SELECT xp FROM season_results WHERE number=? AND user_id=?').get(n - 1, userId);
  let prevXp; if (row) prevXp = row.xp; else if (db.prepare('SELECT 1 FROM season_archive_log WHERE number=?').get(n - 1)) prevXp = 0; else { const p = info(n - 1); prevXp = XPF()(userId, p.start_at, p.end_at); }
  const v = Math.min(2000, Math.floor(prevXp * 0.1)); if (hsCache.size > 20000) hsCache.clear(); hsCache.set(key, v); return v;
}
function trackFor(n, level) {
  return Array.from({ length: LEVELS }, (_, i) => {
    const L = i + 1; const si = SCHEDULE.findIndex(s => s[0] === L); const it = si >= 0 ? trackItem(n, si) : null; const perk = PERKS.find(p => p.level === L);
    const pts = pointsAt(L);
    return { tier: L, level: L, xp: CUM[L], unlocked: level >= L, points: pts,
      reward: it ? `${{ banner: 'Banner', frame: 'Frame', color: 'Name color', title: 'Title', badge: 'Badge', effect: 'Effect' }[it.type]}: ${it.name}` : `Points: ${pts}`,
      item: it ? { id: it.id, type: it.type, name: it.name, rarity: it.rarity } : null, perk: perk ? { id: perk.id, name: perk.name, desc: perk.desc } : null };
  });
}
function seasonProgress(userId, t = Date.now()) {
  const s = seasonAt(t); const raw = userId ? XPF()(userId, s.start_at, s.end_at) : 0; const hs = userId ? headStart(userId, s.number) : 0;
  const xp = raw + hs; const L = levelOf(xp);
  return { ...s, xp, season_xp: raw, head_start: hs, level: L.level, tier: L.level, into: L.into, need: L.need, tier_xp: L.need, overdrive: L.overdrive, overdrive_xp: OVERDRIVE_XP,
    track: trackFor(s.number, L.level), perks: PERKS.map(p => ({ ...p, active: L.level >= p.level })), discount: perkDiscount(L.level), max_xp: CUM[LEVELS] };
}
const perkDiscount = (level) => PERKS.filter(p => p.discount && level >= p.level).reduce((m, p) => Math.max(m, p.discount), 0);
const perksOf = (userId, t = Date.now()) => { if (!userId) return { level: 0, discount: 0, peek: false, vault: false, glow: false }; const p = seasonProgress(userId, t); return { level: p.level, discount: p.discount, peek: p.level >= 18, vault: p.level >= 38, glow: p.level >= 58 }; };

// ---------- boards ----------
const boardCache = new Map();
function boardFor(n, limit = 50) {
  const key = n + ':' + limit; const c = boardCache.get(key); if (c && Date.now() - c.at < 30e3) return c.rows;
  const s = info(n); const now = Date.now(); let rows;
  if (s.end_at < now && db.prepare('SELECT 1 FROM season_archive_log WHERE number=?').get(n)) {
    rows = db.prepare('SELECT r.user_id, r.username, r.xp AS score, r.level, r.rank, u.is_demo, u.eq_banner, u.eq_frame, u.eq_title, u.eq_badge, u.eq_color, u.eq_effect FROM season_results r LEFT JOIN users u ON u.id=r.user_id WHERE r.number=? ORDER BY r.rank LIMIT ?').all(n, limit)
      .map(r => ({ ...r, tier: r.level }));
  } else {
    const ids = db.prepare(`SELECT DISTINCT user_id FROM (SELECT user_id FROM runs WHERE created_at BETWEEN @a AND @b UNION SELECT user_id FROM checkins WHERE created_at BETWEEN @a AND @b UNION SELECT user_id FROM quest_claims WHERE created_at BETWEEN @a AND @b)`).all({ a: s.start_at, b: s.end_at }).map(r => r.user_id);
    const U = db.prepare('SELECT id AS user_id, username, is_demo, eq_banner, eq_frame, eq_title, eq_badge, eq_color, eq_effect, banned, COALESCE(shadow_banned,0) AS sb FROM users WHERE id=?');
    rows = ids.map(id => ({ id, xp: XPF()(id, s.start_at, s.end_at) + headStart(id, n) })).sort((a, b) => b.xp - a.xp || a.id - b.id)
      .map(r => ({ ...U.get(r.id), score: r.xp })).filter(r => r.username && !r.banned && !r.sb).slice(0, limit).map((r, i) => { const L = levelOf(r.score).level; return { rank: i + 1, ...r, level: L, tier: L, banned: undefined, sb: undefined }; });
  }
  boardCache.set(key, { at: Date.now(), rows }); if (boardCache.size > 50) boardCache.clear(); return rows;
}
try { db.prepare('SELECT shadow_banned FROM users LIMIT 1').get(); } catch { db.exec("ALTER TABLE users ADD COLUMN shadow_banned INTEGER NOT NULL DEFAULT 0"); }
const seasonBoard = (limit = 50, t = Date.now()) => boardFor(seasonAt(t).number, limit);
function bestSeasonTier(userId) { // 20-step scale for the v3 achievements ("tier 20" = level 60)
  const cur = seasonProgress(userId).level; const past = db.prepare('SELECT MAX(level) AS l FROM season_results WHERE user_id=?').get(userId).l || 0;
  return Math.floor(Math.max(cur, past) / 3);
}

// ---------- rewards: points + track cosmetics, granted idempotently (called from shop.sync) ----------
function claimTrack(userId, t = Date.now()) {
  const p = seasonProgress(userId, t); const n = p.number; let pts = 0, items = [];
  const insL = db.prepare('INSERT OR IGNORE INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)');
  const insI = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)');
  db.transaction(() => {
    for (let L = 1; L <= p.level; L++) { const a = pointsAt(L); if (a && insL.run(userId, a, 'season', `${n}:L${L}`, t).changes) pts += a; }
    for (let k = 1; k <= Math.min(p.overdrive, OVERDRIVE_MAX); k++) if (insL.run(userId, OVERDRIVE_POINTS, 'season', `${n}:O${k}`, t).changes) pts += OVERDRIVE_POINTS;
    SCHEDULE.forEach((s, i) => { if (p.level >= s[0]) { const it = trackItem(n, i); if (insI.run(userId, it.id, t).changes) items.push(it); } });
  })();
  if (items.length) try { require('./notify').notify(userId, 'season', `Season reward unlocked: ${items[items.length - 1].name}`, `Level ${p.level} in Season ${n}. Equip it from your profile.`, '/season', 'gift'); } catch {}
  return { points: pts, items };
}

// ---------- archive + hall of fame ----------
function archive(n) {
  const s = info(n); if (s.end_at >= Date.now() || db.prepare('SELECT 1 FROM season_archive_log WHERE number=?').get(n)) return 0;
  boardCache.clear(); const rows = boardFor(n, 1e6); boardCache.clear(); const t = Date.now();
  const ins = db.prepare('INSERT OR IGNORE INTO season_results (number, user_id, username, xp, level, rank, archived_at) VALUES (?,?,?,?,?,?,?)');
  const insI = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)');
  db.transaction(() => {
    for (const r of rows) ins.run(n, r.user_id, r.username, r.score, r.level, r.rank, t);
    for (const r of rows.slice(0, 10)) insI.run(r.user_id, trackItem(n, TOP10_SLOT).id, t);
    if (rows[0]) insI.run(rows[0].user_id, trackItem(n, CHAMP_SLOT).id, t);
    db.prepare('INSERT OR IGNORE INTO season_archive_log (number, players, archived_at) VALUES (?,?,?)').run(n, rows.length, t);
  })();
  try { const N = require('./notify'); for (const r of rows.slice(0, 10)) N.notify(r.user_id, 'season', r.rank === 1 ? `You won Season ${n}: ${s.name}!` : `Top 10 in Season ${n}`, `Final rank #${r.rank}. Your title is in your collection and you're in the hall of fame.`, '/season', 'trophy'); } catch {}
  hsCache.clear(); return rows.length;
}
function sweep() { const cur = seasonAt().number; for (let n = 1; n < cur; n++) archive(n); }
function hallOfFame(limit = 12) {
  const nums = db.prepare('SELECT number, players FROM season_archive_log ORDER BY number DESC LIMIT ?').all(limit);
  return nums.map(x => ({ number: x.number, name: info(x.number).name, players: x.players, start_at: info(x.number).start_at, end_at: info(x.number).end_at,
    top: db.prepare('SELECT rank, username, xp, level, level AS tier, user_id FROM season_results WHERE number=? AND rank<=10 ORDER BY rank').all(x.number) }));
}
function history(userId) { return db.prepare('SELECT number, xp, level, rank FROM season_results WHERE user_id=? ORDER BY number DESC').all(userId).map(r => ({ ...r, name: info(r.number).name, players: (db.prepare('SELECT players FROM season_archive_log WHERE number=?').get(r.number) || {}).players })); }

// ---------- admin hooks (used by the admin panel via src/admin-ops.js) ----------
function adminList() {
  sweep(); const cur = seasonAt(); const list = [];
  for (let n = Math.max(1, cur.number - 3); n <= cur.number + 3; n++) { const s = info(n); list.push({ ...s, tiers: LEVELS, levels: LEVELS, state: n < cur.number ? 'ended' : n === cur.number ? 'live' : 'upcoming', track: Object.fromEntries(trackFor(n, 0).filter(x => x.item).map(x => [x.level, x.reward])) }); }
  const c = info(cur.number);
  return { engine: 'src/seasons.js', current: { ...c, tiers: LEVELS, levels: LEVELS, players: boardFor(cur.number, 1e6).length, top: boardFor(cur.number, 10) }, seasons: list, hall_of_fame: hallOfFame(),
    reward_types: ['Title', 'Banner', 'Frame', 'Badge', 'Color', 'Effect', 'Points'], rules: RULES, palettes: G.PAL_KEYS, perks: PERKS, length_days: LEN_DAYS, levels: LEVELS };
}
function adminUpdate(n, b = {}, who = {}) {
  n = parseInt(n, 10); const cur = seasonAt().number; if (!(n >= cur)) return { ok: false, error: 'Past seasons are locked (their results are in the hall of fame).' };
  const o = (OV || loadOv() || OV).get(n) || {}; const s = info(n); const t = Date.now(); const ignored = [];
  const name = b.name !== undefined ? String(b.name || '').trim().slice(0, 40) || null : o.name || null;
  const theme = b.theme !== undefined ? (G.PALETTES[b.theme] ? b.theme : null) : o.theme || null; if (b.theme && !G.PALETTES[b.theme]) ignored.push('theme (use a palette name: ' + G.PAL_KEYS.join(', ') + ')');
  let ends = o.ends_at || null;
  if (b.ends_at !== undefined) { const e = Math.floor(+b.ends_at); if (!e) ends = null; else { if (e <= s.start_at) return { ok: false, error: 'The season must end after it starts.' }; if (e <= t + 3600e3) return { ok: false, error: 'Pick an end at least an hour from now (or use "End season now").' }; ends = e; } }
  if (b.starts_at !== undefined && n > cur) { const st = Math.floor(+b.starts_at); if (st && st !== s.start_at) { const r = adminUpdate(n - 1, { ends_at: st - 1 }, who); if (!r.ok) return r; } }
  else if (b.starts_at !== undefined && +b.starts_at !== s.start_at) ignored.push('starts_at (the live season has already started)');
  if (b.track !== undefined) ignored.push('track (rewards are generated by the engine, see docs/ECONOMY.md)');
  db.prepare(`INSERT INTO season_overrides (number, name, theme, ends_at, notes, updated_by, updated_at) VALUES (@n,@name,@theme,@ends,@notes,@by,@t)
    ON CONFLICT(number) DO UPDATE SET name=excluded.name, theme=excluded.theme, ends_at=excluded.ends_at, notes=excluded.notes, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .run({ n, name, theme, ends, notes: b.notes !== undefined ? String(b.notes || '').slice(0, 400) : o.notes || '', by: who.username || '', t });
  loadOv(); boardCache.clear(); return { ok: true, season: info(n), ignored };
}
function adminEnd(who = {}, confirm) {
  const cur = seasonAt(); if (confirm !== undefined && String(confirm) !== cur.name) return { ok: false, error: `Type the season name (${cur.name}) to confirm.` };
  const t = Date.now();
  db.prepare(`INSERT INTO season_overrides (number, ends_at, updated_by, updated_at) VALUES (?,?,?,?) ON CONFLICT(number) DO UPDATE SET ends_at=excluded.ends_at, updated_by=excluded.updated_by, updated_at=excluded.updated_at`).run(cur.number, t - 1, who.username || '', t);
  loadOv(); boardCache.clear(); const n = archive(cur.number); const next = seasonAt(t + 1000);
  try { require('./notify').notify(null, 'system', `Season ${cur.number}: ${cur.name} has ended`, `Season ${next.number}: ${next.name} starts now. The top players are in the hall of fame.`, '/season', 'trophy'); } catch {}
  return { ok: true, ended: cur.number, next, archived: n };
}
const RULES = [`Seasons last ${LEN_DAYS / 7} weeks and roll over automatically at midnight (hub time), forever.`, `The free track has ${LEVELS} levels (${CUM[LEVELS].toLocaleString('en-US')} XP). Past level ${LEVELS}, every ${OVERDRIVE_XP.toLocaleString('en-US')} XP is an Overdrive star worth ${OVERDRIVE_POINTS} Hub Points (up to ${OVERDRIVE_MAX} a season).`,
  'Season XP comes from the same play as your level: finished runs, daily quests, check-ins and achievements.', 'Soft reset: season XP starts at 0 each season, plus a head start of 10% of last season\'s XP (max 2,000).',
  'Track cosmetics are season-exclusive: they are never sold and never come back. Perks last until the season ends.', 'When a season ends, results are archived, the top 10 enter the hall of fame and get a Top 10 title, and #1 gets the Champion title.',
  'Nothing on the track affects giveaways, scores or entries.'];
setInterval(() => { try { sweep(); } catch (e) { console.error('season sweep', e.message); } }, 10 * 60e3).unref();

function routes(app, A, H) {
  app.get('/api/seasons', (req, res) => { try { sweep(); } catch {} const me = H.currentUser(req); const cur = seasonAt();
    res.json({ ok: true, current: cur, upcoming: [info(cur.number + 1), info(cur.number + 2)].map(s => ({ number: s.number, name: s.name, start_at: s.start_at, end_at: s.end_at })), rules: RULES, perks: PERKS,
      levels: LEVELS, length_days: LEN_DAYS, max_xp: CUM[LEVELS], hall_of_fame: hallOfFame(), mine: me ? history(me.id) : [] }); });
  app.get('/api/seasons/:n(\\d+)', (req, res) => { const n = +req.params.n; const cur = seasonAt().number; if (n < 1 || n > cur + 2) return res.status(404).json({ ok: false, error: 'No such season.' });
    const s = info(n); res.json({ ok: true, season: { ...s, state: n < cur ? 'ended' : n === cur ? 'live' : 'upcoming' }, track: trackFor(n, 0), board: n <= cur ? boardFor(n, 50).map(r => ({ rank: r.rank, username: r.username, score: r.score, level: r.level })) : [] }); });
}
module.exports = { LEVELS, LEN_DAYS, EPOCH_DAY, CUM, PERKS, SCHEDULE, RULES, OVERDRIVE_XP, stepXp, levelOf, info, seasonAt, seasonProgress, seasonBoard, bestSeasonTier, headStart, perksOf, perkDiscount,
  trackFor, trackItem, claimTrack, archive, sweep, hallOfFame, history, adminList, adminUpdate, adminEnd, routes, nameOf, _reset() { loadOv(); boardCache.clear(); hsCache.clear(); } };

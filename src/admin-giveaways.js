'use strict';
// v7 item 22: the giveaway builder backend.
// Data model: every builder setting lives in one JSON document (giveaways.cfg, version 7). publish() derives the classic
// columns from it (title, host, image, dates, games, eligibility, tier, prize_tiers, win_method, winner_count, ...), so the
// v4/v5 engine (standings, locked results, verifiable draws, review queue, Official Rules page, OG cards) keeps working,
// plus a few new columns the engine reads (score_rule, score_top_n, min_runs, pauses, win_split, state, slug, ...).
// Drafts live in gw_drafts (autosaved, never touched by the results sweep) until they are published or scheduled.
// Existing giveaways are migrated in place (cfg built from their columns; nothing else changes; legacy scoring kept).
const crypto = require('crypto');
const db = require('./db');
const cfgApp = require('./config');
const R = require('./results');
const E = require('./eligibility');
const N = require('./notify');
const SC = require('./admin-scoring');
const RO = require('./admin-roles');
const now = () => Date.now();
const H = 3600e3, D = 864e5;

// ---------- schema ----------
const addCol = (t, c, def) => { if (!db.prepare(`PRAGMA table_info(${t})`).all().some(x => x.name === c)) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${def}`); };
addCol('giveaways', 'v7', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'cfg', "TEXT NOT NULL DEFAULT ''");
addCol('giveaways', 'state', "TEXT NOT NULL DEFAULT ''");          // draft-free lifecycle: scheduled | live | paused | ended | cancelled
addCol('giveaways', 'archived', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'slug', 'TEXT');
addCol('giveaways', 'publish_at', 'INTEGER');
addCol('giveaways', 'score_rule', "TEXT NOT NULL DEFAULT ''");     // '' = legacy (sum of per-game bests)
addCol('giveaways', 'score_top_n', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'min_runs', 'INTEGER NOT NULL DEFAULT 0');
addCol('giveaways', 'pauses', "TEXT NOT NULL DEFAULT '[]'");
addCol('giveaways', 'win_split', 'INTEGER NOT NULL DEFAULT 0');    // hybrid: places 1..win_split by rank, the rest by draw
addCol('giveaways', 'series_id', 'INTEGER');
addCol('giveaways', 'occurrence', 'INTEGER');
addCol('giveaway_games', 'weight', 'REAL NOT NULL DEFAULT 1');
addCol('users', 'region', "TEXT NOT NULL DEFAULT ''");
db.exec(`
CREATE UNIQUE INDEX IF NOT EXISTS idx_giveaways_slug ON giveaways(slug) WHERE slug IS NOT NULL;
CREATE TABLE IF NOT EXISTS gw_drafts (id INTEGER PRIMARY KEY AUTOINCREMENT, giveaway_id INTEGER, title TEXT NOT NULL DEFAULT '', data TEXT NOT NULL,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, updated_by TEXT NOT NULL DEFAULT '', autosaves INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS gw_templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, data TEXT NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL DEFAULT '');
CREATE TABLE IF NOT EXISTS gw_series (id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, freq TEXT NOT NULL, every INTEGER NOT NULL DEFAULT 1,
  max_count INTEGER NOT NULL DEFAULT 0, until_at INTEGER, made INTEGER NOT NULL DEFAULT 0, last_id INTEGER, active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS gw_notif (giveaway_id INTEGER NOT NULL, kind TEXT NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (giveaway_id, kind));
CREATE TABLE IF NOT EXISTS gw_claims (giveaway_id INTEGER NOT NULL REFERENCES giveaways(id) ON DELETE CASCADE, user_id INTEGER NOT NULL, contacted_at INTEGER, claimed_at INTEGER,
  note TEXT NOT NULL DEFAULT '', PRIMARY KEY (giveaway_id, user_id));
`);

// ---------- catalogs ----------
const PRIZE_TYPES = { physical: 'Physical item', digital: 'Digital code', giftcard: 'Gift card', points: 'Hub Points (cosmetic only)', cosmetic: 'Cosmetic item', custom: 'Custom' };
const SCORE_RULES = { best: 'Best single run', sum_best: 'Sum of best run per game', total: 'Total of all runs', avg_top: 'Average of top N runs', improved: 'Most improved', campaign: 'Campaign: cumulative across a level set', fastest: 'Fastest completion + score' };
const PROF = require('./admin-profiles');
const COMP_TYPES = Object.keys(PROF.COMP);
const REGIONS = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const THEMES = { neon: ['#7c3aed', '#22d3ee'], gold: ['#f59e0b', '#fde68a'], emerald: ['#10b981', '#a7f3d0'], sunset: ['#f43f5e', '#fb923c'], ice: ['#38bdf8', '#e0f2fe'], mono: ['#e5e7eb', '#64748b'] };
const PRESETS = ['/assets/giveaways/store-credit-art.webp', '/assets/giveaways/ps5-bundle-art.webp', '/assets/brand/hero-banner.webp'];
// every feature the old Basic / Premium / Elite tiers and add-ons sold, as individual switches
const FEATURES = [
  ['featured', 'Featured row on Home', 'Placement', 'Was Premium/Elite or the "Featured row week" add-on.'],
  ['pinned_home', 'Pinned hero on Home (takeover)', 'Placement', 'Was Elite. Only one hero runs at a time.'],
  ['channel_pin', 'Pinned on the sponsor channel page', 'Placement', 'Was Elite channel header.'],
  ['branding', 'Logo + brand colours on card, page and channel', 'Branding', 'Was Premium/Elite.'],
  ['game_skin', 'Branded game skin request', 'Branding', 'Was Elite / $249 add-on. Flags the request for the games team.'],
  ['link_giveaway', 'Sponsor link on the giveaway page (tracked)', 'Links', 'Was Premium / "Extra link" add-on.'],
  ['link_channel', 'Sponsor link on the channel page (tracked)', 'Links', 'Was Premium/Elite.'],
  ['link_game', 'Sponsor link on the game page (tracked)', 'Links', 'Was Elite / extra link add-on.'],
  ['link_announcement', 'Sponsor link in the launch announcement', 'Links', 'Was Elite.'],
  ['tournament', 'Tournament mode (linked timed tournament)', 'Competition', 'Creates a tournament for the same window and first game.'],
  ['live_standings', 'Live standings page', 'Competition', 'Players see "You are #X of N" while it runs.'],
  ['hidden_board', 'Hide the leaderboard until the end', 'Competition', 'Ranks stay secret until the standings lock.'],
  ['share_cards', 'Share cards + share buttons', 'Growth', 'OG image + share button on the giveaway.'],
  ['referral_bonus', 'Referral bonus entries (free)', 'Growth', 'Friends you invite who play add draw entries. Never bought.'],
  ['notify_announce', 'Announce to all players at launch', 'Notifications', 'Was Elite push/in-app alert.'],
  ['notify_followers', 'Alert the sponsor\'s followers at launch', 'Notifications', 'Was Premium.'],
  ['notify_reminder', 'Reminder (24 h before the end)', 'Notifications', 'Was Elite final-week reminder.'],
  ['notify_ending', 'Ending-soon alert', 'Notifications', 'Sent shortly before the end (scaled to the length).'],
  ['analytics_live', 'Live stats for the sponsor', 'Reporting', 'Plays, unique players, entrants, link clicks.'],
  ['analytics_report', 'Post-campaign report', 'Reporting', 'Was Elite. Reach, plays, entrants, clicks by placement (CSV + printable).'],
  ['potato_contact', 'Winner contact on Potato by Trap Tech', 'Winners', 'Included in every old tier.'],
  ['delivery_coord', 'Prize delivery coordination', 'Winners', 'Was Elite.'],
  ['category_exclusive', 'Category exclusivity while it runs', 'Commercial', 'Was an add-on. Recorded on the giveaway for scheduling.'],
];
const FEATURE_KEYS = FEATURES.map(f => f[0]);

// ---------- helpers ----------
const str = (v, n) => String(v ?? '').trim().slice(0, n);
const int = (v, lo, hi, d = 0) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const num = (v, lo, hi, d = 0) => { const x = Number(v); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
const HEX = /^#[0-9a-fA-F]{6}$/;
const IMG_RE = /^(\/assets\/[\w\-./]+|\/media\/[a-z0-9-]+\.png|https:\/\/[^\s"'<>]{4,300})$/;
const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const games = () => [...cfgApp.GAMES, ...(cfgApp.LIB_GAMES || []).filter(g => ['gl-neon-circuit', 'gl-rift-survival'].includes(g.id))];
const eligible = (id) => typeof cfgApp.giveawayEligible === 'function' ? cfgApp.giveawayEligible(id) : (cfgApp.GAME_MAP[id] && !['plinko', 'spin-to-win'].includes(id));
const fmtN = (n) => Number(n || 0).toLocaleString('en-US');
const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');

// Rich text: a small allow-list sanitizer (no attributes except safe a[href] and plain class names).
const ALLOWED = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'p', 'br', 'ul', 'ol', 'li', 'a', 'h2', 'h3', 'h4', 'blockquote', 'span', 'div', 'code']);
function sanitizeHtml(html, max = 20000) {
  html = String(html || '').slice(0, max * 2).replace(/<(script|style|iframe|object|embed|template|noscript)\b[\s\S]*?(<\/\1\s*>|$)/gi, ''); // drop these with their contents
  let out = ''; let i = 0; const re = /<\/?([a-zA-Z0-9]+)([^<>]*)>|<!--[\s\S]*?-->/g; let m; const open = [];
  const text = (t) => t.replace(/&(?!(#\d{1,6}|#x[0-9a-f]{1,6}|[a-z]{2,8});)/gi, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  while ((m = re.exec(html))) {
    out += text(html.slice(i, m.index)); i = re.lastIndex;
    if (!m[1]) continue; const tag = m[1].toLowerCase(); if (!ALLOWED.has(tag)) continue;
    if (/^<\//.test(m[0])) { const k = open.lastIndexOf(tag); if (k >= 0) { for (let j = open.length - 1; j >= k; j--) out += `</${open[j]}>`; open.length = k; } continue; }
    if (['script', 'style'].includes(tag)) continue;
    let attrs = '';
    if (tag === 'a') { const h = /href\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[2]); const href = h ? (h[2] ?? h[3]) : ''; if (/^(https:\/\/[^\s"'<>]+|\/[\w\-./?=&#%]*)$/i.test(href)) attrs = ` href="${esc(href)}"${href.startsWith('/') ? '' : ' target="_blank" rel="noopener nofollow"'}`; }
    const c = /class\s*=\s*"([a-z0-9 _-]{1,60})"/i.exec(m[2]); if (c && ['p', 'ol', 'ul', 'span', 'div'].includes(tag)) attrs += ` class="${c[1]}"`;
    if (tag === 'br') { out += '<br>'; continue; }
    out += `<${tag}${attrs}>`; open.push(tag);
  }
  out += text(html.slice(i)); for (let j = open.length - 1; j >= 0; j--) out += `</${open[j]}>`;
  return out.slice(0, max);
}
const plain = (html) => String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|li|h\d|div)>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim();

// competition format (Game Rules Profiles): type + metric label + optional campaign level set
function compOf(x) {
  x = x && typeof x === 'object' ? x : {}; const type = COMP_TYPES.includes(x.type) ? x.type : 'endless'; const ms = PROF.COMP[type].metrics;
  const metric = ms[x.metric] ? x.metric : Object.keys(ms)[0]; const lf = Math.max(0, Math.min(999, parseInt(x.level_from, 10) || 0)), lt = Math.max(0, Math.min(999, parseInt(x.level_to, 10) || 0));
  return { type, metric, level_from: type === 'campaign' ? (lf || 1) : 0, level_to: type === 'campaign' ? Math.max(lf || 1, lt || 30) : 0 };
}
// ---------- the builder document ----------
function blank(over = {}) {
  const t = Math.ceil((now() + H) / (15 * 60e3)) * 15 * 60e3;
  const firstGame = games().find(g => eligible(g.id));
  return normalize({
    v: 7,
    basics: { title: '', subtitle: '', description: '', slug: '', sponsor: 'Trap Tech Solutions', sponsor_logo: '', channel_id: null, brand_id: null, hub_wide: true },
    media: { source: 'preset', image: PRESETS[0], image_tall: '', image_square: '', banner: '', game_thumb: '', theme: 'neon', accent: THEMES.neon[0], accent2: THEMES.neon[1] },
    schedule: { start_at: t, end_at: t + 7 * D, tz: 'America/New_York', publish_mode: 'now', publish_at: null, recur: { freq: '', every: 1, count: 0, until: null } },
    games: (() => { const pd = firstGame ? PROF.builderDefaults(firstGame.id) : null; return { ids: firstGame ? [firstGame.id] : [], weights: {}, score_rule: pd ? pd.score_rule : 'best', top_n: 3, min_score: 0, min_runs: 0,
      competition: pd ? pd.competition : { type: 'endless', metric: 'score', level_from: 0, level_to: 0 }, attempts: pd ? pd.attempts : 0, run_cap_sec: pd ? pd.run_cap_sec : 0, profile_from: pd ? pd.game_id : '' }; })(),
    prizes: [{ id: 'p1', name: '', desc: '', image: '', qty: 1, value: 0, type: 'physical', award: 'rank' }],
    winners: { alternates: 2, claim_hours: 72, auto_forfeit: false, announce: true, review: true },
    entry: { ...E.DEFAULTS, age21: true, require_join: true, activity_weight: true, max_entrants: 0, regions_mode: 'all', regions: [], brand_only: false, follow_sponsor: false,
      quest_bonus: { on: false, per: 1, max: 3 }, referral_bonus: { on: false, max: 3 }, checklist: [] },
    features: { featured: false, pinned_home: false, channel_pin: false, branding: true, game_skin: false, link_giveaway: false, link_channel: false, link_game: false, link_announcement: false,
      link_url: '', link_label: '', tournament: false, live_standings: true, hidden_board: false, share_cards: true, referral_bonus: false,
      notify_announce: true, notify_followers: true, notify_reminder: true, notify_ending: true, analytics_live: true, analytics_report: false, potato_contact: true, delivery_coord: false, category_exclusive: false },
    rules: { official: '', edited: false, house: 'One account per person. No purchase necessary. Winners are contacted by Trap Tech on Potato.' },
    ...over,
  });
}
function normalize(c) {
  c = c && typeof c === 'object' ? c : {};
  const b = c.basics || {}, m = c.media || {}, s = c.schedule || {}, gm = c.games || {}, w = c.winners || {}, e = c.entry || {}, f = c.features || {}, r = c.rules || {};
  const ids = [...new Set((Array.isArray(gm.ids) ? gm.ids : []).map(String))].filter(id => cfgApp.GAME_MAP[id]).slice(0, 12);
  const weights = {}; for (const id of ids) weights[id] = num((gm.weights || {})[id], 0.1, 10, 1);
  const theme = THEMES[m.theme] ? m.theme : 'neon';
  const rec = s.recur || {};
  const out = {
    v: 7,
    basics: { title: str(b.title, 120), subtitle: str(b.subtitle, 160), description: sanitizeHtml(b.description, 8000), slug: slugify(b.slug || ''),
      sponsor: str(b.sponsor, 80), sponsor_logo: IMG_RE.test(str(b.sponsor_logo, 300)) ? str(b.sponsor_logo, 300) : '', channel_id: parseInt(b.channel_id, 10) || null,
      brand_id: parseInt(b.brand_id, 10) || null, hub_wide: b.hub_wide !== false },
    media: { source: ['upload', 'preset', 'game', 'url'].includes(m.source) ? m.source : 'preset', image: IMG_RE.test(str(m.image, 300)) ? str(m.image, 300) : '',
      image_tall: IMG_RE.test(str(m.image_tall, 300)) ? str(m.image_tall, 300) : '', image_square: IMG_RE.test(str(m.image_square, 300)) ? str(m.image_square, 300) : '',
      banner: IMG_RE.test(str(m.banner, 300)) ? str(m.banner, 300) : '', game_thumb: cfgApp.GAME_MAP[m.game_thumb] ? m.game_thumb : '', theme,
      accent: HEX.test(m.accent) ? m.accent : THEMES[theme][0], accent2: HEX.test(m.accent2) ? m.accent2 : THEMES[theme][1] },
    schedule: { start_at: Number.isFinite(+s.start_at) ? Math.floor(+s.start_at) : null, end_at: Number.isFinite(+s.end_at) ? Math.floor(+s.end_at) : null,
      tz: str(s.tz || 'America/New_York', 60), publish_mode: ['now', 'schedule'].includes(s.publish_mode) ? s.publish_mode : 'now',
      publish_at: Number.isFinite(+s.publish_at) && s.publish_at ? Math.floor(+s.publish_at) : null,
      recur: { freq: ['daily', 'weekly', 'monthly'].includes(rec.freq) ? rec.freq : '', every: int(rec.every, 1, 12, 1), count: int(rec.count, 0, 520, 0), until: Number.isFinite(+rec.until) && rec.until ? Math.floor(+rec.until) : null } },
    games: { ids, weights, score_rule: SCORE_RULES[gm.score_rule] ? gm.score_rule : 'best', top_n: int(gm.top_n, 1, 50, 3), min_score: int(gm.min_score, 0, cfgApp.MAX_SCORE || 1e9, 0), min_runs: int(gm.min_runs, 0, 1000, 0),
      competition: compOf(gm.competition), attempts: int(gm.attempts, 0, 100, 0), run_cap_sec: int(gm.run_cap_sec, 0, 86400, 0), profile_from: str(gm.profile_from, 64) },
    prizes: (Array.isArray(c.prizes) ? c.prizes : []).slice(0, 50).map((p, i) => ({ id: str(p.id, 20) || 'p' + (i + 1), name: str(p.name, 120), desc: str(p.desc, 400),
      image: IMG_RE.test(str(p.image, 300)) ? str(p.image, 300) : '', qty: int(p.qty, 1, 1000, 1), value: num(p.value, 0, 1e7, 0),
      type: PRIZE_TYPES[p.type] ? p.type : 'physical', award: p.award === 'random' ? 'random' : 'rank' })),
    winners: { alternates: int(w.alternates, 0, 50, 2), claim_hours: int(w.claim_hours, 1, 24 * 90, 72), auto_forfeit: !!w.auto_forfeit, announce: w.announce !== false, review: w.review !== false },
    entry: { require_join: e.require_join ? 1 : 0, elig_min_runs7: int(e.elig_min_runs7, 0, 100), elig_min_xp7: int(e.elig_min_xp7, 0, 100000), elig_account_age_days: int(e.elig_account_age_days, 0, 365),
      elig_max_active: int(e.elig_max_active, 0, 50), elig_win_cooldown_days: int(e.elig_win_cooldown_days, 0, 365), elig_brand_month: e.elig_brand_month ? 1 : 0, elig_followers_only: (e.elig_followers_only || e.follow_sponsor) ? 1 : 0,
      weight_mode: e.activity_weight ? 'activity' : '', age21: e.age21 !== false, activity_weight: !!e.activity_weight, max_entrants: int(e.max_entrants, 0, 1e6),
      regions_mode: ['all', 'allow', 'exclude'].includes(e.regions_mode) ? e.regions_mode : 'all', regions: (Array.isArray(e.regions) ? e.regions : []).map(x => String(x).toUpperCase()).filter(x => REGIONS.includes(x)),
      brand_only: !!e.brand_only, follow_sponsor: !!(e.follow_sponsor || e.elig_followers_only),
      quest_bonus: { on: !!(e.quest_bonus && e.quest_bonus.on), per: int(e.quest_bonus && e.quest_bonus.per, 1, 10, 1), max: int(e.quest_bonus && e.quest_bonus.max, 1, 20, 3) },
      referral_bonus: { on: !!((e.referral_bonus && e.referral_bonus.on) || f.referral_bonus), max: int(e.referral_bonus && e.referral_bonus.max, 1, 20, 3) },
      checklist: (Array.isArray(e.checklist) ? e.checklist : []).slice(0, 8).map((x, i) => ({ id: str(x.id, 24) || ('step' + (i + 1)), label: str(x.label, 120), url: /^https:\/\/[^\s"'<>]{4,300}$/.test(str(x.url, 300)) ? str(x.url, 300) : '', required: x.required !== false, attestation: true })) },
    features: {}, rules: { official: sanitizeHtml(r.official, 60000), edited: !!r.edited, house: str(r.house, 2000) },
    runtime: c.runtime && typeof c.runtime === 'object' ? { tournament_id: parseInt(c.runtime.tournament_id, 10) || null, announced_winners_at: +c.runtime.announced_winners_at || null } : {},
  };
  for (const k of FEATURE_KEYS) out.features[k] = !!f[k];
  out.features.referral_bonus = out.entry.referral_bonus.on;
  out.features.link_url = /^https:\/\/[^\s"'<>]{4,300}$/.test(str(f.link_url, 300)) ? str(f.link_url, 300) : '';
  out.features.link_label = str(f.link_label, 40);
  if (out.features.hidden_board) out.features.live_standings = false;
  if (out.entry.follow_sponsor && out.basics.channel_id) out.entry.brand_only = true; // v7: "following" a sponsor = being in its brand
  if (out.entry.brand_only) out.basics.hub_wide = false;
  if (!out.basics.hub_wide) out.entry.brand_only = true;
  return out;
}
// winners plan from the prize list
function plan(c) {
  const rank = c.prizes.filter(p => p.award === 'rank'), rnd = c.prizes.filter(p => p.award === 'random');
  const k = rank.reduce((s, p) => s + p.qty, 0), m = rnd.reduce((s, p) => s + p.qty, 0);
  const places = []; let pl = 1;
  for (const p of rank) { places.push({ prize: p.id, name: p.name, from: pl, to: pl + p.qty - 1, award: 'rank', value: p.value, qty: p.qty }); pl += p.qty; }
  for (const p of rnd) { places.push({ prize: p.id, name: p.name, from: pl, to: pl + p.qty - 1, award: 'random', value: p.value, qty: p.qty }); pl += p.qty; }
  const method = m === 0 ? 'score' : k === 0 ? 'random' : 'hybrid';
  const label = (x) => x.award === 'random' ? `Random draw${x.qty > 1 ? ` (${x.qty} winners)` : ''}` : x.from === x.to ? ord(x.from) : (x.from === 1 ? `Top ${x.to}` : `${ord(x.from)}-${ord(x.to)}`);
  const tiers = places.map(x => `${label(x)}: ${x.name || 'Prize'}${x.value ? ` (${money(x.value)}${x.qty > 1 ? ' each' : ''})` : ''}`);
  const arv = c.prizes.reduce((s, p) => s + p.qty * p.value, 0);
  return { method, winners: k + m, split: k, places, tiers, arv };
}
const prizeForPlace = (c, place) => { const p = plan(c).places.find(x => place >= x.from && place <= x.to); return p ? c.prizes.find(q => q.id === p.prize) || null : null; };
// v7 (site worker, src/sponsor.js): tiers are gone; what a giveaway shows comes from giveaways.placements
function placesOf(c) {
  const f = c.features; const p = [];
  if (f.link_giveaway || f.link_channel) p.push('giveaway'); if (f.link_game) p.push('game'); if (f.link_announcement) p.push('announcement');
  if (f.featured || f.pinned_home) p.push('featured'); if (f.pinned_home) p.push('hero'); if (f.game_skin) p.push('skin');
  if (c.basics.channel_id && c.basics.hub_wide) p.push('open');
  return p;
}

function validate(c, opts = {}) {
  const errs = [], warns = []; const E_ = (step, field, msg) => errs.push({ step, field, msg }); const W = (step, msg) => warns.push({ step, msg });
  const b = c.basics, s = c.schedule;
  if (!b.title) E_('basics', 'title', 'Give the giveaway a title.');
  if (!b.sponsor) W('basics', 'No sponsor name: it will show as hosted by Trap Tech Solutions.');
  if (b.slug) { const hit = db.prepare('SELECT id FROM giveaways WHERE slug=?').get(b.slug); if (hit && hit.id !== opts.giveawayId) E_('basics', 'slug', `The link /g/${b.slug} is already used by giveaway #${hit.id}.`); }
  if (!b.hub_wide && !b.channel_id) E_('basics', 'brand', 'Members-only giveaways need a brand. Pick one, or make it open to everyone.');
  if (!c.media.image && !c.media.game_thumb) E_('media', 'image', 'Pick, upload or link a giveaway image.');
  if (!Number.isFinite(s.start_at) || !Number.isFinite(s.end_at)) E_('schedule', 'dates', 'Set a start and end date/time.');
  else {
    const dur = s.end_at - s.start_at;
    if (dur < 60e3) E_('schedule', 'end_at', 'End must be at least 1 minute after the start.');
    if (dur > 366 * D) E_('schedule', 'end_at', 'Maximum length is 366 days (use a recurring giveaway for longer).');
    if (!opts.existing && s.end_at <= now()) E_('schedule', 'end_at', 'The end time is in the past.');
    if (s.publish_mode === 'schedule') { if (!s.publish_at) E_('schedule', 'publish_at', 'Pick when to publish.'); else if (s.publish_at > s.end_at) E_('schedule', 'publish_at', 'Publish time must be before the end.'); }
    if (s.recur.freq) { const per = { daily: D, weekly: 7 * D, monthly: 28 * D }[s.recur.freq] * s.recur.every; if (dur > per) E_('schedule', 'recur', `Each occurrence (${Math.round(dur / H)} h) is longer than the repeat interval: shorten it or repeat less often.`); }
  }
  if (!c.games.ids.length) E_('games', 'ids', 'Link at least one game.');
  for (const id of c.games.ids) if (!eligible(id)) E_('games', 'ids', `${(cfgApp.GAME_MAP[id] || {}).title || id} is a chance game ("just for fun") and can't be used in giveaways.`);
  if (c.games.score_rule === 'avg_top' && c.games.top_n < 1) E_('games', 'top_n', 'Top N must be at least 1.');
  if (c.games.run_cap_sec && c.schedule.end_at && c.schedule.start_at && c.games.run_cap_sec * 1000 > c.schedule.end_at - c.schedule.start_at) E_('games', 'run_cap_sec', 'The run cap is longer than the whole giveaway.');
  if (c.games.score_rule === 'improved' && c.games.attempts) W('games', 'Most improved + an attempt limit: only the first attempts in the window count toward the improvement.');
  if (c.games.score_rule === 'campaign' && c.games.competition.type !== 'campaign') W('games', 'The campaign score rule is meant for the Campaign competition type.');
  for (const id of c.games.ids) { const p = PROF.get(id); if (p && !p.giveaway_compatible && eligible(id)) W('games', `${p.hub_version || id}: its rules profile is marked "not giveaway compatible". Check the profile in Games before publishing.`); }
  if (!c.prizes.length) E_('prizes', 'prizes', 'Add at least one prize.');
  c.prizes.forEach((p, i) => { if (!p.name) E_('prizes', `prize-${i}`, `Prize ${i + 1} needs a name.`); });
  if (c.prizes.some(p => p.type === 'points') && c.prizes.every(p => p.type === 'points')) W('prizes', 'Points-only prizes are cosmetic; the rules still state no cash value.');
  const pl = plan(c); if (pl.winners > 1000) E_('prizes', 'qty', 'At most 1,000 winners.');
  if (c.entry.regions_mode !== 'all' && !c.entry.regions.length) E_('entry', 'regions', 'Pick at least one state for the allow / exclude list.');\n  if (c.entry.checklist.some(x => !x.label)) E_('entry', 'checklist', 'Every checklist step needs a label.');
  if (c.features.hidden_board && c.features.live_standings) W('features', 'Live standings are off while the leaderboard is hidden.');
  if ((c.features.link_giveaway || c.features.link_channel || c.features.link_game || c.features.link_announcement) && !c.features.link_url) E_('features', 'link_url', 'Sponsor link placements need an https:// link.');
  if (c.features.pinned_home) { const other = db.prepare("SELECT id, title FROM giveaways WHERE v7=1 AND placements LIKE '%hero%' AND active=1 AND end_at > ? AND id <> ? AND state IN ('live','scheduled','paused')").get(now(), opts.giveawayId || 0); if (other) W('features', `"${other.title}" already has the Home hero; the newest one shows first.`); }
  return { ok: !errs.length, errors: errs, warnings: warns, plan: pl };
}

// columns for the giveaways row
function derive(c) {
  const pl = plan(c); const f = c.features; const e = c.entry;
  const img = c.media.image || (c.media.game_thumb ? (cfgApp.GAME_MAP[c.media.game_thumb] || {}).art : '') || PRESETS[0];
  const headline = c.prizes.length ? (c.prizes[0].name + (c.prizes.length > 1 ? ` + ${c.prizes.length - 1} more prize${c.prizes.length > 2 ? 's' : ''}` : '')) : '';
  const anyLink = f.link_giveaway || f.link_channel || f.link_game || f.link_announcement;
  return {
    title: c.basics.title, host: c.basics.sponsor || 'Trap Tech Solutions', prize: headline.slice(0, 200), image: img, start_at: c.schedule.start_at, end_at: c.schedule.end_at,
    entry_method: 'play', game_id: c.games.ids[0], rules: (c.rules.house || 'See the Official Rules.').slice(0, 4000), tier: '', placements: JSON.stringify(placesOf(c)),
    brand_color: f.branding ? c.media.accent : '', brand_logo: f.branding ? c.basics.sponsor_logo : '', featured: (f.featured || f.pinned_home) ? 1 : 0,
    min_score: c.games.min_score, prize_tiers: pl.tiers.join('\n').slice(0, 1000), win_method: pl.method === 'hybrid' ? 'hybrid' : pl.method, winner_count: pl.winners,
    channel_id: c.basics.channel_id || null, open_to_all: !c.basics.channel_id || c.basics.hub_wide ? 1 : 0, link_url: anyLink ? f.link_url : '', link_label: anyLink ? f.link_label : '',
    require_join: ((c.basics.channel_id && !c.basics.hub_wide) || e.age21 || e.regions_mode !== 'all' || e.max_entrants) ? 1 : e.require_join, elig_min_runs7: e.elig_min_runs7, elig_min_xp7: e.elig_min_xp7, elig_account_age_days: e.elig_account_age_days, elig_max_active: e.elig_max_active,
    elig_win_cooldown_days: e.elig_win_cooldown_days, elig_brand_month: e.elig_brand_month, elig_followers_only: e.elig_followers_only,
    weight_mode: (e.activity_weight || e.quest_bonus.on || e.referral_bonus.on) && pl.method !== 'score' ? 'activity' : '',
    v7: 1, slug: c.basics.slug || null, score_rule: c.games.score_rule, score_top_n: c.games.top_n, min_runs: c.games.min_runs,
    win_split: pl.method === 'hybrid' ? pl.split : 0,
  };
}
const COLS = ['title', 'host', 'prize', 'image', 'start_at', 'end_at', 'entry_method', 'game_id', 'rules', 'tier', 'brand_color', 'brand_logo', 'featured', 'min_score', 'prize_tiers', 'win_method', 'winner_count',
  'channel_id', 'link_url', 'link_label', 'require_join', 'elig_min_runs7', 'elig_min_xp7', 'elig_account_age_days', 'elig_max_active', 'elig_win_cooldown_days', 'elig_brand_month', 'elig_followers_only', 'weight_mode',
  'v7', 'slug', 'score_rule', 'score_top_n', 'min_runs', 'win_split', 'open_to_all', 'placements'];
function setGames(gid, c) {
  db.transaction(() => {
    db.prepare('DELETE FROM giveaway_games WHERE giveaway_id=?').run(gid);
    const ins = db.prepare('INSERT INTO giveaway_games (giveaway_id, game_id, weight) VALUES (?,?,?)');
    for (const id of c.games.ids) ins.run(gid, id, c.games.weights[id] || 1);
  })();
}

// ---------- Official Rules (generated from the settings; editable before publishing) ----------
const when = (ms, tz = 'America/New_York') => new Date(ms).toLocaleString('en-US', { timeZone: tz, dateStyle: 'long', timeStyle: 'short' }) + (tz === 'America/New_York' ? ' ET' : ` (${tz})`);
function officialRules(c, g = null) {
  const OP = 'Trap Tech Solutions'; const b = c.basics; const pl = plan(c); const e = c.entry;
  const name = `"${esc(b.title || 'Giveaway')}"`; const sponsor = esc(b.sponsor || OP);
  const gl = c.games.ids.map(id => esc((cfgApp.GAME_MAP[id] || {}).title || id)); const gamesTxt = gl.length > 1 ? gl.slice(0, -1).join(', ') + ' and ' + gl.slice(-1) : (gl[0] || 'the linked game');
  const period = c.schedule.start_at && c.schedule.end_at ? `${when(c.schedule.start_at, c.schedule.tz)} through ${when(c.schedule.end_at, c.schedule.tz)}` : '[START] through [END]';
  const wt = Object.entries(c.games.weights).filter(([, v]) => v !== 1);
  const regionTxt = e.regions_mode === 'allow' ? `legal residents of ${e.regions.join(', ')}` : e.regions_mode === 'exclude' ? `legal residents of the 50 United States and D.C., excluding ${e.regions.join(', ')}` : 'legal residents of the 50 United States and D.C.';
  const elig = [];
  if (e.age21) elig.push('be 21 or older at the time of entry (date of birth on the account)');
  if (e.elig_account_age_days) elig.push(`have an account at least ${e.elig_account_age_days} day${e.elig_account_age_days === 1 ? '' : 's'} old`);
  if (e.elig_min_runs7 || e.elig_min_xp7) elig.push(`show recent activity: ${[e.elig_min_runs7 ? e.elig_min_runs7 + ' runs' : '', e.elig_min_xp7 ? e.elig_min_xp7 + ' XP' : ''].filter(Boolean).join(' or ')} in the 7 days before joining`);
  if (e.elig_max_active) elig.push(`be entered in no more than ${e.elig_max_active} live giveaways at once`);
  if (e.elig_win_cooldown_days) elig.push(`not have won a Hub giveaway in the previous ${e.elig_win_cooldown_days} days`);
  if (e.elig_brand_month) elig.push('not have won a giveaway from the same sponsor in the previous 30 days');
  if (e.brand_only || !b.hub_wide) elig.push(`be affiliated with ${sponsor} on the Hub (brand-only giveaway)`);
  if (e.max_entrants) elig.push(`join before the giveaway reaches ${fmtN(e.max_entrants)} entrants`);
  const ruleTxt = SC.ruleText({ score_rule: c.games.score_rule, score_top_n: c.games.top_n });
  const cp = c.games.competition; const acl = [...new Set(c.games.ids.map(id => (PROF.get(id) || {}).anticheat_level || 'L2'))].sort();
  const compTxt = `Competition format: <b>${esc(PROF.COMP[cp.type].label)}</b> (${esc(PROF.metricLabel(cp.type, cp.metric))})${cp.type === 'campaign' ? `, levels ${cp.level_from} to ${cp.level_to}` : ''}. `
    + (c.games.attempts ? `Only each entrant's first ${c.games.attempts} counted run${c.games.attempts > 1 ? 's' : ''} per game in the Giveaway Period count${c.games.attempts > 1 ? '' : 's'}; later runs do not change the standings. ` : 'Attempts are unlimited. ')
    + (c.games.run_cap_sec ? `Each run is capped at ${c.games.run_cap_sec % 60 ? c.games.run_cap_sec + ' seconds' : (c.games.run_cap_sec / 60) + ' minute' + (c.games.run_cap_sec === 60 ? '' : 's')} of play; a run that lasts longer than the cap (server-measured) does not count. ` : '')
    + `The winner rule is the highest <b>verified</b> score at close: only runs that pass the Hub's server-side validation count (anti-cheat level ${acl.join(', ')}; runs held for review count only if a moderator clears them before winners are confirmed).`;
  const placeTxt = pl.places.map(x => `<li>${x.award === 'random' ? `<b>Random draw</b> among all other eligible entrants` : `<b>${x.from === x.to ? ord(x.from) : `${ord(x.from)} to ${ord(x.to)}`} place</b> by final ranking`}: ${esc(x.name || 'Prize')}${x.qty > 1 ? ` (${x.qty} winners)` : ''}${x.value ? `, approximate retail value ${money(x.value)}${x.qty > 1 ? ' each' : ''}` : ''}</li>`).join('');
  const method = pl.method === 'random' ? `a verifiable random draw of ${pl.winners} winner${pl.winners > 1 ? 's' : ''} among all eligible entrants` : pl.method === 'hybrid' ? `final ranking for the top ${pl.split} place${pl.split > 1 ? 's' : ''}, then a verifiable random draw of ${pl.winners - pl.split} more winner${pl.winners - pl.split > 1 ? 's' : ''} among the remaining eligible entrants` : `final ranking: the top ${pl.winners} eligible entrant${pl.winners > 1 ? 's' : ''} win`;
  const bonus = []; if (e.activity_weight && pl.method !== 'score') bonus.push('1 entry plus 1 more per 5 runs of the linked games in the Giveaway Period (max 5)');
  if (e.quest_bonus.on && pl.method !== 'score') bonus.push(`+1 entry per ${e.quest_bonus.per} daily quest${e.quest_bonus.per > 1 ? 's' : ''} completed in the Giveaway Period (max ${e.quest_bonus.max})`);
  if (e.referral_bonus.on && pl.method !== 'score') bonus.push(`+1 entry per invited friend who plays during the Giveaway Period (max ${e.referral_bonus.max})`);
  const tb = R.TIEBREAK_RULES.map((x, i) => `<li><b>(${'abcd'[i]})</b> ${esc(x)}</li>`).join('');
  const rec = c.schedule.recur.freq ? `<p>This giveaway repeats ${c.schedule.recur.every > 1 ? `every ${c.schedule.recur.every} ` : ''}${{ daily: c.schedule.recur.every > 1 ? 'days' : 'daily', weekly: c.schedule.recur.every > 1 ? 'weeks' : 'weekly', monthly: c.schedule.recur.every > 1 ? 'months' : 'monthly' }[c.schedule.recur.freq]}. Each occurrence is a separate giveaway with its own period, standings and winners, under these rules.</p>` : '';
  return sanitizeHtml(`<p class="npn">NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE WILL NOT IMPROVE YOUR CHANCES OF WINNING. OPEN ONLY TO ${regionTxt.toUpperCase()} WHO ARE ${e.age21 ? '21' : '18'} YEARS OF AGE OR OLDER. VOID WHERE PROHIBITED.</p>
<h2>1. Giveaway, Sponsor and Operator</h2><p>The ${name} giveaway (the "Giveaway") is sponsored by <b>${sponsor}</b> ("Sponsor") and operated and administered by <b>${OP}</b> ("Operator") on The Gaming Hub. Sponsor must comply with all laws that apply to its business, products, advertising and this Giveaway.</p>
<h2>2. Eligibility</h2><p>Open to ${regionTxt} who are <b>${e.age21 ? '21' : '18'} or older</b> and have a Gaming Hub account in good standing. Employees of Sponsor and Operator and their immediate families and household members are not eligible. Void where prohibited or restricted by law.</p>${elig.length ? `<p>To be eligible for this Giveaway an entrant must also:</p><ul class="plain">${elig.map(x => `<li>${x}</li>`).join('')}</ul>` : ''}
<h2>3. Giveaway Period</h2><p>${period} (the "Giveaway Period"). Operator's server clock is the official timekeeper.${c.schedule.publish_mode === 'schedule' && c.schedule.publish_at ? ` The Giveaway is announced on ${when(c.schedule.publish_at, c.schedule.tz)}.` : ''}</p>${rec}
<h2>4. How to Enter (free)</h2><p>Sign in to a free Gaming Hub account${e.require_join ? ', tap "Enter giveaway" on the giveaway page,' : ''} then start and finish at least one scored run of ${gamesTxt} during the Giveaway Period${c.games.min_score ? ` with a score of at least ${fmtN(c.games.min_score)}` : ''}.${c.games.min_runs ? ` Entrants need at least ${c.games.min_runs} valid run${c.games.min_runs > 1 ? 's' : ''} in the Giveaway Period to be ranked.` : ''} Every game on the Hub is free; there is nothing to buy. Limit: one account per person. ${bonus.length ? `For random draws each eligible entrant gets ${bonus.join('; ')}. Entries come only from free play and can never be bought; Hub Points can never be exchanged for entries.` : 'Playing more runs can improve your ranking but never creates extra entries.'} Entries made with scripts, bots, multiple accounts or tampered scores are void.</p>
<h2>5. Winner Selection and Tiebreakers</h2><p>Winners are determined by ${method}. ${esc(ruleTxt)} ${compTxt}${wt.length ? ` Game weightings: ${wt.map(([id, v]) => `${esc((cfgApp.GAME_MAP[id] || {}).title || id)} scores count x${v}`).join(', ')}.` : ''} Runs must start and finish inside the Giveaway Period; runs whose score is impossible for their server-measured duration are excluded${c.runtime && c.runtime.paused ? '' : ', as are runs made while the Giveaway is paused'}.</p>
<p id="rules-tiebreak"><b>Tiebreakers, applied in this order:</b></p><ol class="tb-rules plain">${tb}</ol>
<p><b>Final standings lock:</b> at the end of the Giveaway Period the server saves the final standings to a locked record. Scores submitted afterwards never change it.</p>${pl.method !== 'score' ? `<p><b>Random draws</b> use a verifiable commit-reveal method: the SHA-256 hash of a secret seed is published on the giveaway page before the end; at the end the locked entrant list is hashed and the seed revealed. Each entrant's draw key is HMAC-SHA256(seed, entrant-list hash + ":" + username) and entrants are drawn in ascending key order${bonus.length ? ' (weighted by entries: key = -ln(u)/entries)' : ''}. Anyone can recompute the result on the results page.</p>` : ''}
<h2>6. Prizes</h2><ul class="plain">${placeTxt}</ul><p>Total approximate retail value of all prizes: <b>${money(pl.arv)}</b>. No cash alternative or substitution except by Sponsor, which may substitute a prize of equal or greater value. <b>No cannabis, THC, nicotine or alcohol products are awarded as prizes.</b> Hub Points and cosmetic items have no cash value. Winners are responsible for any taxes.</p>
<h2>7. Odds</h2><p>Odds of winning a ranked place depend on the skill shown in valid runs and the number of entrants; odds of winning a random draw depend on the number of eligible entrants${bonus.length ? ' and their free entries' : ''}.</p>
<h2>8. Winner Notification, Claim and Alternates</h2><p>Potential winners are notified in their Gaming Hub notifications and contacted by Operator on <b>Potato</b> using the Potato username saved on their account. Winners must respond within <b>${c.winners.claim_hours >= 48 && c.winners.claim_hours % 24 === 0 ? `${c.winners.claim_hours / 24} days` : `${c.winners.claim_hours} hours`}</b> of the standings lock. Operator will never ask for a password or payment. Winners may need to verify age, identity and eligibility. Results show as "Winner pending verification" until Operator confirms them. If a winner can't be reached, doesn't respond in time, is ineligible or is disqualified, the prize goes to the next eligible entrant in the locked standings (or draw order)${c.winners.alternates ? `; Operator keeps ${c.winners.alternates} alternate${c.winners.alternates > 1 ? 's' : ''} ready` : ''}. Every confirmation and disqualification is recorded in an audit log.</p>
<h2>9. General Conditions</h2><p>Operator may disqualify anyone who tampers with the Giveaway or breaks these rules or the <a href="/terms">Terms of Service</a>. Operator may pause, extend, modify or cancel the Giveaway if fraud, technical failures or other causes beyond its control affect it; runs made while it is paused do not count.</p>
<h2>10. Publicity & Privacy</h2><p>Except where prohibited, winners agree that their username may be shown as a winner on the Hub${c.winners.announce ? ' and in a public winners announcement' : ''}. Personal data is handled under the <a href="/privacy">Privacy Policy</a>.</p>
<h2>11. Limitation of Liability</h2><p>Sponsor and Operator are not responsible for lost, late or incomplete entries, technical malfunctions, or any injury or damage arising from participation or from accepting or using a prize.</p>
<h2>12. Winners List</h2><p>Winners and the final standings are shown on the giveaway's results page after the Giveaway Period ends.</p>
${c.rules.house ? `<h2>13. Additional Rules</h2><p>${esc(c.rules.house)}</p>` : ''}<p class="tiny muted">Generated by ${OP} from this giveaway's settings${g ? ` (#${g.id})` : ''}. Not legal advice; have counsel review each promotion.</p>`, 60000);
}

// ---------- migration of pre-builder giveaways (cfg only; scoring + columns unchanged) ----------
function cfgFromRow(g) {
  const ids = R.gamesOf(g.id); const tiers = String(g.prize_tiers || '').split('\n').map(x => x.trim()).filter(Boolean);
  const prizes = tiers.length ? tiers.map((t, i) => { const m = /^(.*?)\s*[-:–]\s*(.+)$/.exec(t); const lbl = m ? m[1] : ''; const random = /random/i.test(lbl || t); const qty = Math.max(1, parseInt((/(\d+)\s*x\b/i.exec(t) || [])[1] || '1', 10));
    return { id: 'p' + (i + 1), name: (m ? m[2] : t).slice(0, 120), desc: '', image: '', qty, value: 0, type: 'physical', award: random ? 'random' : 'rank' }; })
    : [{ id: 'p1', name: g.prize || g.title, desc: '', image: '', qty: Math.max(1, g.winner_count || 1), value: 0, type: 'physical', award: g.win_method === 'random' ? 'random' : 'rank' }];
  const st = g.finalized_at || g.end_at < now() ? 'ended' : 'live';
  const c = normalize({
    basics: { title: g.title, subtitle: '', description: '', slug: '', sponsor: g.host, sponsor_logo: g.brand_logo, channel_id: g.channel_id, hub_wide: !g.channel_id || !!g.open_to_all },
    media: { source: String(g.image || '').startsWith('/assets/cards/') ? 'game' : 'preset', image: g.image, theme: 'neon', accent: g.brand_color || THEMES.neon[0] },
    schedule: { start_at: g.start_at, end_at: g.end_at, tz: 'America/New_York', publish_mode: 'now' },
    games: { ids, weights: {}, score_rule: 'sum_best', top_n: 3, min_score: g.min_score || 0, min_runs: 0 }, prizes,
    winners: { alternates: 2, claim_hours: 168, announce: true, review: true },
    entry: { ...E.rulesOf(g), require_join: g.require_join, activity_weight: g.weight_mode === 'activity', age21: true, follow_sponsor: !!g.elig_followers_only },
    features: (() => { const P = (() => { try { return require('./sponsor').placementsOf(g); } catch { return []; } })();
      return { featured: !!g.featured || P.includes('featured'), pinned_home: P.includes('hero'), game_skin: P.includes('skin'), branding: !!(g.brand_color || g.brand_logo), link_giveaway: !!g.link_url && P.includes('giveaway'),
        link_game: !!g.link_url && P.includes('game'), link_announcement: !!g.link_url && P.includes('announcement'), link_url: g.link_url, link_label: g.link_label,
        live_standings: true, share_cards: true, notify_announce: true, analytics_live: true, potato_contact: true, delivery_coord: g.tier === 'elite' }; })(),
    rules: { official: '', edited: false, house: g.rules || '' },
  });
  return { c, st };
}
function migrate() {
  const rows = db.prepare("SELECT * FROM giveaways WHERE cfg='' OR cfg IS NULL").all(); if (!rows.length) return 0;
  const up = db.prepare("UPDATE giveaways SET cfg=?, state=CASE WHEN state='' THEN ? ELSE state END, score_rule=CASE WHEN score_rule='' THEN 'sum_best' ELSE score_rule END WHERE id=?");
  db.transaction(() => { for (const g of rows) { const { c, st } = cfgFromRow(g); c.migrated_from = 'v5'; up.run(JSON.stringify(c), st, g.id); } })();
  RO.setS('gw_migration_v7', { at: now(), count: (RO.getS('gw_migration_v7', {}).count || 0) + rows.length });
  return rows.length;
}

// ---------- reads ----------
const cfgOf = (g) => { try { const c = JSON.parse(g.cfg || '{}'); return c && c.v === 7 ? normalize(c) : cfgFromRow(g).c; } catch { return cfgFromRow(g).c; } };
const getRow = (id) => db.prepare('SELECT * FROM giveaways WHERE id=?').get(id);
function lifecycle(g, t = now()) {
  if (g.state === 'cancelled') return 'cancelled';
  if (g.archived) return 'archived';
  if (g.state === 'scheduled' && !g.active) return 'scheduled';
  if (g.finalized_at || g.end_at < t) return 'ended';
  if (g.state === 'paused') return 'paused';
  if (!g.active) return 'hidden';
  return g.start_at > t ? 'upcoming' : 'live';
}

// ---------- publish / apply ----------
function writeRow(c, existing, actor, opts = {}) {
  const v = derive(c); const t = now();
  if (existing && existing.finalized_at) {
    const locked = ['start_at', 'end_at', 'min_score', 'win_method', 'winner_count', 'score_rule', 'score_top_n', 'min_runs', 'win_split'].filter(k => String(existing[k] ?? '') !== String(v[k] ?? ''));
    if (R.gamesOf(existing.id).join() !== c.games.ids.join()) locked.push('games');
    if (locked.length) return { ok: false, status: 409, error: `Final results are locked, so these can't change: ${locked.join(', ')}. Title, art, prizes text and rules can still change.` };
  }
  const publishLater = c.schedule.publish_mode === 'schedule' && c.schedule.publish_at && c.schedule.publish_at > t;
  let id;
  if (existing) {
    db.prepare(`UPDATE giveaways SET ${COLS.map(k => `${k}=@${k}`).join(',')}, cfg=@cfg, publish_at=@publish_at, updated_at=@t WHERE id=@id`).run({ ...v, cfg: JSON.stringify(c), publish_at: c.schedule.publish_at, t, id: existing.id });
    id = existing.id; if (!existing.finalized_at) setGames(id, c);
    R.audit(id, actor, 'edited', null, { via: 'builder' });
  } else {
    const info = db.prepare(`INSERT INTO giveaways (${COLS.join(',')}, cfg, state, active, publish_at, series_id, occurrence, created_at, updated_at) VALUES (${COLS.map(k => '@' + k).join(',')}, @cfg, @state, @active, @publish_at, @series_id, @occurrence, @t, @t)`)
      .run({ ...v, cfg: JSON.stringify(c), state: publishLater ? 'scheduled' : 'live', active: publishLater ? 0 : 1, publish_at: c.schedule.publish_at, series_id: opts.series_id || null, occurrence: opts.occurrence || null, t });
    id = info.lastInsertRowid; setGames(id, c);
    R.ensureCommit({ id }); R.audit(id, actor, 'created', null, { via: 'builder', method: v.win_method, winners: v.winner_count, score_rule: v.score_rule, ...(opts.series_id ? { series: opts.series_id, occurrence: opts.occurrence } : {}) });
    if (!publishLater) goLive(getRow(id), c);
  }
  return { ok: true, id };
}
function goLive(g, c) {
  const f = c.features; const t = now();
  db.prepare("UPDATE giveaways SET active=1, state='live', updated_at=? WHERE id=?").run(t, g.id);
  try { db.prepare("INSERT INTO activity (type,message,user_id,ref_id,created_at,is_demo) VALUES ('giveaway',?,NULL,?,?,0)").run(`Giveaway created: ${g.title}`, g.id, t); } catch {}
  if (f.notify_announce && !db.prepare("SELECT 1 FROM gw_notif WHERE giveaway_id=? AND kind='announce'").get(g.id)) {
    N.notify(null, 'giveaway', `New giveaway: ${g.title}`, `${c.basics.subtitle || `Hosted by ${g.host}.`} Play free to enter - no purchase necessary.`, `/giveaways/${g.id}`, 'gift');
    db.prepare('INSERT OR IGNORE INTO gw_notif (giveaway_id, kind, at) VALUES (?,?,?)').run(g.id, 'announce', t);
  }
  if (f.notify_followers && g.channel_id && !db.prepare("SELECT 1 FROM gw_notif WHERE giveaway_id=? AND kind='followers'").get(g.id)) {
    for (const r of db.prepare('SELECT id AS user_id FROM users WHERE brand_id=? AND banned=0 LIMIT 5000').all(g.channel_id)) N.notify(r.user_id, 'giveaway', `${g.host} launched a giveaway`, g.title, `/giveaways/${g.id}`, 'gift');
    db.prepare('INSERT OR IGNORE INTO gw_notif (giveaway_id, kind, at) VALUES (?,?,?)').run(g.id, 'followers', t);
  }
  if (f.link_announcement && c.features.link_url) {
    try { db.prepare('INSERT INTO announcements (title, body, created_at) VALUES (?,?,?)').run(`New giveaway: ${g.title}`.slice(0, 140), `${c.basics.subtitle || ''} Sponsored by ${g.host}: ${c.features.link_url}`.trim().slice(0, 4000), t); } catch {}
  }
  if (f.tournament && !(c.runtime && c.runtime.tournament_id)) {
    try {
      const info = db.prepare("INSERT INTO tournaments (title, game_id, format, description, prize, start_at, end_at, active, created_at) VALUES (?,?,'timed',?,?,?,?,1,?)")
        .run(`${g.title} Tournament`.slice(0, 100), c.games.ids[0], `Tournament mode for the giveaway "${g.title}". Best single score in the window.`, 'Bragging rights + giveaway standings', g.start_at, g.end_at, t);
      c.runtime = { ...(c.runtime || {}), tournament_id: info.lastInsertRowid }; db.prepare('UPDATE giveaways SET cfg=? WHERE id=?').run(JSON.stringify(c), g.id);
    } catch (e) { console.error('[gw] tournament mode', e.message); }
  }
}
function publishDraft(draftId, actor) {
  const d = db.prepare('SELECT * FROM gw_drafts WHERE id=?').get(draftId); if (!d) return { ok: false, status: 404, error: 'Draft not found.' };
  let c = normalize(JSON.parse(d.data)); const existing = d.giveaway_id ? getRow(d.giveaway_id) : null;
  if (!c.rules.edited) c.rules.official = officialRules(c, existing);
  const v = validate(c, { giveawayId: existing ? existing.id : 0, existing: !!existing }); if (!v.ok) return { ok: false, status: 400, error: v.errors[0].msg, errors: v.errors, warnings: v.warnings };
  if (existing) c.runtime = cfgOf(existing).runtime || {};
  let series = null;
  if (!existing && c.schedule.recur.freq) {
    const info = db.prepare('INSERT INTO gw_series (data, freq, every, max_count, until_at, made, active, created_at) VALUES (?,?,?,?,?,0,1,?)')
      .run(JSON.stringify(c), c.schedule.recur.freq, c.schedule.recur.every, c.schedule.recur.count, c.schedule.recur.until, now());
    series = info.lastInsertRowid;
  }
  const r = writeRow(c, existing, actor, series ? { series_id: series, occurrence: 1 } : {}); if (!r.ok) return r;
  if (series) db.prepare('UPDATE gw_series SET made=1, last_id=? WHERE id=?').run(r.id, series);
  db.prepare('DELETE FROM gw_drafts WHERE id=?').run(d.id);
  return { ok: true, id: r.id, series_id: series, state: lifecycle(getRow(r.id)), warnings: v.warnings };
}

// ---------- lifecycle actions ----------
function pause(g, actor) {
  if (lifecycle(g) !== 'live' && lifecycle(g) !== 'upcoming') return { ok: false, error: `Only a live or upcoming giveaway can be paused (this one is ${lifecycle(g)}).` };
  const p = SC.pausesOf(g); p.push([now(), null]);
  db.prepare("UPDATE giveaways SET state='paused', pauses=?, updated_at=? WHERE id=?").run(JSON.stringify(p), now(), g.id); R.audit(g.id, actor, 'paused', null, {}); return { ok: true };
}
function resume(g, actor) {
  if (g.state !== 'paused') return { ok: false, error: 'This giveaway is not paused.' };
  const p = SC.pausesOf(g); const last = p[p.length - 1]; if (last && !last[1]) last[1] = now();
  db.prepare("UPDATE giveaways SET state='live', pauses=?, updated_at=? WHERE id=?").run(JSON.stringify(p), now(), g.id); R.audit(g.id, actor, 'resumed', null, { paused_ms: last ? last[1] - last[0] : 0 }); return { ok: true };
}
function endEarly(g, actor) {
  if (g.finalized_at) return { ok: false, error: 'Final standings are already locked.' };
  const t = now(); if (t < g.start_at) return { ok: false, error: 'This giveaway has not started yet; cancel it instead.' };
  if (g.state === 'paused') resume(g, actor);
  db.prepare("UPDATE giveaways SET end_at=?, state='ended', updated_at=? WHERE id=?").run(Math.min(t, g.end_at), t, g.id);
  R.audit(g.id, actor, 'ended_early', null, { scheduled_end: g.end_at, ended_at: t });
  const fin = R.finalize({ id: g.id }, actor, { force: true });
  return { ok: true, finalized_at: fin.finalized_at, winners: R.results(fin).winners };
}
function extend(g, newEnd, actor) {
  newEnd = Math.floor(+newEnd); if (g.finalized_at) return { ok: false, error: 'Final standings are locked; it can no longer be extended.' };
  if (!Number.isFinite(newEnd) || newEnd <= g.end_at) return { ok: false, error: 'The new end must be later than the current end.' };
  if (newEnd - g.start_at > 366 * D) return { ok: false, error: 'Maximum length is 366 days.' };
  const c = cfgOf(g); c.schedule.end_at = newEnd; if (!c.rules.edited) c.rules.official = officialRules(c, g);
  db.prepare('UPDATE giveaways SET end_at=?, cfg=?, updated_at=? WHERE id=?').run(newEnd, JSON.stringify(c), now(), g.id);
  db.prepare("DELETE FROM gw_notif WHERE giveaway_id=? AND kind IN ('reminder','ending')").run(g.id);
  R.audit(g.id, actor, 'extended', null, { from: g.end_at, to: newEnd }); return { ok: true, end_at: newEnd };
}
function cancel(g, actor, reason = '') {
  const lc = lifecycle(g); if (lc === 'cancelled') return { ok: false, error: 'Already cancelled.' };
  if (g.finalized_at && db.prepare('SELECT 1 FROM giveaway_results WHERE giveaway_id=? LIMIT 1').get(g.id)) return { ok: false, error: 'Results are already locked; disqualify or archive instead.' };
  const t = now();
  // finalized with an empty snapshot: the results sweep never computes winners for it
  db.prepare("UPDATE giveaways SET state='cancelled', active=0, end_at=MIN(end_at, ?), finalized_at=COALESCE(finalized_at, ?), entrants_hash=COALESCE(entrants_hash, 'cancelled'), updated_at=? WHERE id=?").run(Math.max(t, g.start_at + 1), t, t, g.id);
  R.audit(g.id, actor, 'cancelled', null, { reason: String(reason).slice(0, 300) });
  for (const r of db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id=? AND left_at IS NULL').all(g.id)) N.notify(r.user_id, 'giveaway', `"${g.title}" was cancelled`, reason ? `Reason: ${String(reason).slice(0, 200)}` : 'The organiser cancelled this giveaway. Sorry about that.', '/giveaways', 'circle-x');
  return { ok: true };
}
function archive(g, actor, on = true) {
  const lc = lifecycle(g); if (on && !['ended', 'cancelled'].includes(lc)) return { ok: false, error: 'Only ended or cancelled giveaways can be archived.' };
  db.prepare('UPDATE giveaways SET archived=?, active=?, updated_at=? WHERE id=?').run(on ? 1 : 0, on ? 0 : (g.state === 'cancelled' ? 0 : 1), now(), g.id); R.audit(g.id, actor, on ? 'archived' : 'unarchived', null, {}); return { ok: true };
}
function newDraft(c, actor, giveawayId = null) {
  const t = now(); const info = db.prepare('INSERT INTO gw_drafts (giveaway_id, title, data, created_at, updated_at, updated_by) VALUES (?,?,?,?,?,?)').run(giveawayId, c.basics.title, JSON.stringify(c), t, t, actor);
  return info.lastInsertRowid;
}
function duplicate(c, actor) {
  const d = normalize(JSON.parse(JSON.stringify(c))); const dur = (d.schedule.end_at - d.schedule.start_at) || 7 * D;
  const st = Math.ceil((now() + H) / (15 * 60e3)) * 15 * 60e3; d.schedule.start_at = st; d.schedule.end_at = st + dur; d.schedule.publish_at = null; d.schedule.publish_mode = 'now';
  d.basics.title = (d.basics.title + ' (copy)').slice(0, 120); d.basics.slug = ''; d.runtime = {}; d.rules.edited = false; d.rules.official = '';
  return newDraft(d, actor);
}

// ---------- claims / winners announcement ----------
function claims(g) {
  const c = cfgOf(g); const res = R.results(g); if (!res) return { winners: [], alternates: [], deadline: null };
  const deadline = g.finalized_at + c.winners.claim_hours * H;
  const cl = new Map(db.prepare('SELECT * FROM gw_claims WHERE giveaway_id=?').all(g.id).map(r => [r.user_id, r]));
  const winners = res.winners.map(w => { const x = cl.get(w.user_id) || {}; const p = prizeForPlace(c, w.place);
    return { ...w, prize: p ? p.name : null, prize_type: p ? p.type : null, contacted_at: x.contacted_at || null, claimed_at: x.claimed_at || null, note: x.note || '', overdue: !x.claimed_at && now() > deadline }; });
  const alternates = res.standings.filter(r => !r.disqualified && r.user_id != null && !r.winner && r.place).slice(0, c.winners.alternates).map(r => ({ place: r.place, username: r.username, user_id: r.user_id, score: r.score }));
  return { winners, alternates, deadline, claim_hours: c.winners.claim_hours };
}
function announceWinners(g, actor) {
  const c = cfgOf(g); const res = R.results(g); if (!res) return { ok: false, error: 'Results are not locked yet.' };
  if (!res.winners.length) return { ok: false, error: 'No winners to announce.' };
  const lines = res.winners.map(w => { const p = prizeForPlace(c, w.place); return `#${w.place} ${w.username}${p ? ` - ${p.name}` : ''}${w.state === 'confirmed' ? '' : ' (pending verification)'}`; });
  const t = now();
  db.prepare('INSERT INTO announcements (title, body, created_at) VALUES (?,?,?)').run(`Winners: ${g.title}`.slice(0, 140), `Congratulations to the winners of "${g.title}"!\n${lines.join('\n')}\nFull results: /giveaways/${g.id}/results`.slice(0, 4000), t);
  N.notify(null, 'announcement', `Winners announced: ${g.title}`, lines.slice(0, 3).join(' • ').slice(0, 300), `/giveaways/${g.id}/results`, 'trophy');
  c.runtime = { ...(c.runtime || {}), announced_winners_at: t }; db.prepare('UPDATE giveaways SET cfg=? WHERE id=?').run(JSON.stringify(c), g.id);
  R.audit(g.id, actor, 'winners_announced', null, { winners: res.winners.length }); return { ok: true, lines };
}

// ---------- sweep: scheduled publishing, notifications, claim deadlines, recurring giveaways ----------
const PERIOD = { daily: (t, n) => t + n * D, weekly: (t, n) => t + n * 7 * D, monthly: (t, n) => { const d = new Date(t); d.setMonth(d.getMonth() + n); return d.getTime(); } };
let sweeping = false;
function sweep() {
  if (sweeping) return; sweeping = true; const t = now(); const out = { published: 0, notified: 0, made: 0, forfeited: 0 };
  try {
    for (const g of db.prepare("SELECT * FROM giveaways WHERE state='scheduled' AND active=0 AND publish_at IS NOT NULL AND publish_at <= ?").all(t)) { goLive(g, cfgOf(g)); R.audit(g.id, 'system', 'published', null, { scheduled_for: g.publish_at }); out.published++; }
    db.prepare("UPDATE giveaways SET state='ended' WHERE state IN ('live','paused') AND (finalized_at IS NOT NULL OR end_at < ?)").run(t);
    const sent = db.prepare('INSERT OR IGNORE INTO gw_notif (giveaway_id, kind, at) VALUES (?,?,?)');
    for (const g of db.prepare("SELECT * FROM giveaways WHERE v7=1 AND active=1 AND state='live' AND start_at <= ? AND end_at > ? AND finalized_at IS NULL").all(t, t)) {
      const c = cfgOf(g); const dur = g.end_at - g.start_at; const left = g.end_at - t;
      const target = (title, body, kind, ic) => { if (!sent.run(g.id, kind, t).changes) return; out.notified++;
        if (g.require_join) for (const r of db.prepare('SELECT user_id FROM giveaway_entries WHERE giveaway_id=? AND left_at IS NULL LIMIT 5000').all(g.id)) N.notify(r.user_id, 'giveaway', title, body, `/giveaways/${g.id}`, ic);
        else N.notify(null, 'giveaway', title, body, `/giveaways/${g.id}`, ic); };
      if (c.features.notify_reminder && dur >= 48 * H && left <= 24 * H && left > 2 * H) target(`24 hours left: ${g.title}`, 'Your best score counts. One more run?', 'reminder', 'alarm-clock');
      const soon = Math.min(H, Math.max(5 * 60e3, 0.2 * dur));
      if (c.features.notify_ending && dur >= 20 * 60e3 && left <= soon) target(`Ending soon: ${g.title}`, `Ends in about ${Math.max(1, Math.round(left / 60e3))} minutes. Final standings lock at the end.`, 'ending', 'timer');
    }
    for (const g of db.prepare("SELECT * FROM giveaways WHERE v7=1 AND finalized_at IS NOT NULL AND state <> 'cancelled' AND finalized_at > ?").all(t - 120 * D)) {
      const c = cfgOf(g); if (!c.winners.auto_forfeit || t < g.finalized_at + c.winners.claim_hours * H) continue;
      for (const w of claims(g).winners) if (w.overdue && w.state !== 'confirmed') { const r = R.disqualify(g, w.user_id, `Prize not claimed within ${c.winners.claim_hours} hours`, 'system'); if (r.ok) out.forfeited++; }
    }
    for (const s of db.prepare('SELECT * FROM gw_series WHERE active=1').all()) {
      const last = s.last_id ? getRow(s.last_id) : null; if (!last) { db.prepare('UPDATE gw_series SET active=0 WHERE id=?').run(s.id); continue; }
      if (last.state === 'cancelled' && last.archived) continue;
      if (t < last.end_at) continue;                                  // next occurrence is created when the current one ends
      if (s.max_count && s.made >= s.max_count) { db.prepare('UPDATE gw_series SET active=0 WHERE id=?').run(s.id); continue; }
      const c = normalize(JSON.parse(s.data)); const dur = c.schedule.end_at - c.schedule.start_at;
      let k = s.made; let st = PERIOD[s.freq](c.schedule.start_at, k * s.every);
      while (st + dur <= t && k < 1000) { k++; st = PERIOD[s.freq](c.schedule.start_at, k * s.every); } // skip occurrences missed while offline
      if (s.until_at && st > s.until_at) { db.prepare('UPDATE gw_series SET active=0 WHERE id=?').run(s.id); continue; }
      c.schedule.start_at = st; c.schedule.end_at = st + dur; c.schedule.publish_mode = 'now'; c.schedule.publish_at = null;
      c.basics.slug = c.basics.slug ? `${c.basics.slug}-${k + 1}`.slice(0, 60) : ''; c.runtime = {}; if (!c.rules.edited) c.rules.official = officialRules(c);
      const r = writeRow(c, null, 'system', { series_id: s.id, occurrence: k + 1 });
      if (r.ok) { db.prepare('UPDATE gw_series SET made=?, last_id=? WHERE id=?').run(k + 1, r.id, s.id); out.made++; }
    }
  } catch (e) { console.error('[gw] sweep failed', e); } finally { sweeping = false; }
  return out;
}

// ---------- public hooks ----------
function publicExtras(g, out) {
  if (!g.v7 && !g.cfg) return {};
  const c = cfgOf(g); const f = c.features; const hidden = f.hidden_board && !g.finalized_at;
  const x = { v7: true, subtitle: c.basics.subtitle, description_html: c.basics.description, banner: c.media.banner, image_tall: c.media.image_tall, accent: c.media.accent, accent2: c.media.accent2, theme: c.media.theme,
    slug: g.slug || null, state: lifecycle(g), paused: g.state === 'paused', score_rule: g.score_rule || 'sum_best', score_rule_text: SC.ruleText(g), min_runs: g.min_runs || 0,
    competition: { ...c.games.competition, label: PROF.COMP[c.games.competition.type].label, metric_label: PROF.metricLabel(c.games.competition.type, c.games.competition.metric), attempts: c.games.attempts, run_cap_sec: c.games.run_cap_sec, winner_rule: PROF.WINNER_RULE,
      anticheat: Object.fromEntries(c.games.ids.map(id => [id, (PROF.get(id) || {}).anticheat_level || 'L2'])) },
    prizes: c.prizes.map(p => { const pl = plan(c).places.find(q => q.prize === p.id); return { name: p.name, desc: p.desc, image: p.image, qty: p.qty, value: p.value, type: p.type, type_label: PRIZE_TYPES[p.type], award: p.award, places: pl ? (p.award === 'random' ? 'Random draw' : pl.from === pl.to ? ord(pl.from) : `${ord(pl.from)}-${ord(pl.to)}`) : '' }; }),
    total_value: plan(c).arv, features: { share_cards: f.share_cards, live_standings: f.live_standings && !f.hidden_board, hidden_board: f.hidden_board, tournament_id: (c.runtime || {}).tournament_id || null },
    board_hidden: hidden, claim_hours: c.winners.claim_hours, regions: c.entry.regions_mode === 'all' ? null : { mode: c.entry.regions_mode, list: c.entry.regions }, brand_only: !c.basics.hub_wide, entry_checklist: c.entry.checklist.map(x => ({ id: x.id, label: x.label, url: x.url, required: x.required, attestation: true })),
    official_rules_html: c.rules.official || null };
  if (hidden && out) out.top = [];
  return x;
}
function boardHidden(g) {
  if (!g || (!g.v7 && !g.cfg)) return null; const c = cfgOf(g);
  if (g.finalized_at) return null;
  if (c.features.hidden_board) return { ok: true, hidden: true, reason: 'The leaderboard for this giveaway is hidden until it ends. Final standings are published when it locks.', rows: [], total: 0, matched: 0, page: 1, pages: 1, per: 50, me: null, winners: [], finalized: false, tiebreak_rules: R.TIEBREAK_RULES, refresh_ms: 30000, now: now() };
  return null;
}
const isPaused = (g) => g && g.state === 'paused';
// extra eligibility checks for builder giveaways (eligibility.check() calls these)
function extraChecks(u, g, t) {
  if (!g.v7) return [];
  const c = cfgOf(g); const e = c.entry; const out = [];
  const full = db.prepare('SELECT id, birth_date, region, created_at FROM users WHERE id=?').get(u.id) || {};
  if (g.state === 'paused') out.push({ id: 'paused', ok: false, label: 'Giveaway is paused', hint: 'This giveaway is paused right now. Runs during a pause do not count; check back soon.' });
  if (e.age21) { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(full.birth_date || ''); let ok = false; if (m) { const d = new Date(t); const age = d.getUTCFullYear() - +m[1] - ((d.getUTCMonth() + 1 < +m[2] || (d.getUTCMonth() + 1 === +m[2] && d.getUTCDate() < +m[3])) ? 1 : 0); ok = age >= 21; }
    out.push({ id: 'age21', ok, label: '21 or older', hint: ok ? 'Age verified from your date of birth' : 'Your account needs a date of birth showing you are 21+' }); }
  if (e.regions_mode !== 'all') {
    const r = full.region || ''; const inList = e.regions.includes(r); const ok = !!r && (e.regions_mode === 'allow' ? inList : !inList);
    out.push({ id: 'region', ok, label: e.regions_mode === 'allow' ? `Open to: ${e.regions.join(', ')}` : `Not open in: ${e.regions.join(', ')}`, have: r, options: REGIONS,
      hint: !r ? 'Confirm the US state you live in to enter' : ok ? `Your state: ${r}` : `Not available in ${r}` });
  }
  // brand-only membership is checked by eligibility.js (site worker's brand affiliation: users.brand_id vs giveaways.channel_id)
  if (e.max_entrants) {
    const joined = db.prepare('SELECT 1 FROM giveaway_entries WHERE giveaway_id=? AND user_id=? AND left_at IS NULL').get(g.id, u.id);
    const n = db.prepare('SELECT COUNT(*) AS c FROM giveaway_entries WHERE giveaway_id=? AND left_at IS NULL').get(g.id).c; const ok = !!joined || n < e.max_entrants;
    out.push({ id: 'capacity', ok, label: `Limited to ${fmtN(e.max_entrants)} entrants`, have: n, need: e.max_entrants, hint: ok ? `${fmtN(n)} of ${fmtN(e.max_entrants)} spots taken` : 'This giveaway is full' });
  }
  return out;
}

module.exports = { compOf, PRIZE_TYPES, SCORE_RULES, REGIONS, THEMES, PRESETS, FEATURES, blank, normalize, validate, plan, prizeForPlace, derive, officialRules, sanitizeHtml, plain, migrate, cfgOf, cfgFromRow, getRow, lifecycle,
  writeRow, publishDraft, pause, resume, endEarly, extend, cancel, archive, newDraft, duplicate, claims, announceWinners, sweep, publicExtras, boardHidden, isPaused, extraChecks, eligible, goLive };

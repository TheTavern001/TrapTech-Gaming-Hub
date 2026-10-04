'use strict';
// v7 item 22b: Game Rules Profiles (Reese's master catalog brief, docs/REESE-MASTER-CATALOG.md).
// One metadata card per game: reference game, hub version, category, recognition tier (A+/A/B+), competition type
// (endless / campaign / short session / strategy) + metric, endless Y/N, giveaway compatible, scoring, attempts,
// recommended event length, anti-cheat level L1-L4, leaderboard, winner rule, level set and run cap.
// Stored in game_profiles (JSON per game). Built-in defaults come from the game catalog (src/config.js); admins edit them,
// and importProfiles() accepts the research worker's docs/exact-game-hunt.json (array, {games:[...]}, or an object keyed by
// name; keys may be snake_case or the card's Title Case labels). Catalog entries without a hub game are kept as references
// ("ref:<slug>") so the hunt results are browsable before the game is built.
// The giveaway builder reads profiles to pre-fill the competition format; giveaway_compatible can never override the
// games worker's chance-game flag (cfg.giveawayEligible).
const db = require('./db');
const cfg = require('./config');
const now = () => Date.now();
db.exec(`CREATE TABLE IF NOT EXISTS game_profiles (game_id TEXT PRIMARY KEY, data TEXT NOT NULL, source TEXT NOT NULL DEFAULT 'admin',
  updated_by TEXT NOT NULL DEFAULT '', updated_at INTEGER NOT NULL)`);

const COMP = {
  endless: { label: 'Endless', desc: 'One run keeps going until you fail. Highest verified run wins.', metrics: {
    score: ['Highest score', 'best'], survival: ['Survival time', 'best'], wave: ['Highest wave', 'best'], kills: ['Kills', 'best'], distance: ['Distance', 'best'], combo: ['Best combo', 'best'],
    survival_distance: ['Survival + distance', 'best'], kills_score: ['Kills + score', 'best'], marathon: ['Marathon (every run adds up)', 'total'] } },
  campaign: { label: 'Campaign', desc: 'A defined set of levels. Cumulative score across the set, or fastest completion plus score.', metrics: {
    cumulative: ['Cumulative score across the level set', 'campaign'], fastest: ['Fastest completion + score', 'fastest'] } },
  short_session: { label: 'Short session', desc: 'Short timed score attacks or a fixed number of attempts.', metrics: {
    attack_60: ['60-second score attack', 'best', { cap: 60 }], attack_180: ['3-minute score attack', 'best', { cap: 180 }], best_of_3: ['Best of 3 runs', 'best', { attempts: 3 }],
    best_of_5: ['Best of 5 runs', 'best', { attempts: 5 }], single: ['Highest single run', 'best'] } },
  strategy: { label: 'Strategy', desc: 'Defense / economy games: highest wave, total score or economy-adjusted score.', metrics: {
    wave: ['Highest wave', 'best'], total: ['Total score', 'best'], economy: ['Economy-adjusted score', 'best'] } },
};
const AC = { L1: 'L1 simple: the maximum score is obvious', L2: 'L2 session: score, time, progression and max-rate checks', L3: 'L3 event / action log validation', L4: 'L4 deterministic replay verified on the server' };
const TIERS = ['A+', 'A', 'B+', 'B'];
const SOURCES = { exact: 'Exact (original source, usable licence)', faithful: 'Faithful recreation (open source)', alternative: 'Open-source alternative', build: 'Must build (original adaptation)', original: 'Hub original' };
const CATEGORIES = ['Endless movement and running', 'Driving and vehicle survival', 'Physics and destruction', 'Defense and tower defense', 'Survival and horde', 'Arcade shooters', 'Puzzle and brain', 'Reflex, precision and skill', 'Combat and fighting', 'Sports', 'Specialty', 'Chance (just for fun)'];
const WINNER_RULE = 'Highest verified score at close';

// built-in defaults for the hub's own games (reference names are for recognition only; the hub versions are originals)
const D = {
  'jetpack-dash': { game: 'Jetpack Joyride', category: CATEGORIES[0], recognition_tier: 'A+', competition_type: 'endless', metric: 'distance', hours: 72, ac: 'L2' },
  'drift-rush': { game: 'Drift Boss / Traffic Racer', category: CATEGORIES[1], recognition_tier: 'A', competition_type: 'endless', metric: 'survival_distance', hours: 72, ac: 'L2' },
  'sky-hopper': { game: 'Flappy Bird', category: CATEGORIES[0], recognition_tier: 'A+', competition_type: 'endless', metric: 'score', hours: 48, ac: 'L1' },
  'stack': { game: 'Stack', category: CATEGORIES[7], recognition_tier: 'A', competition_type: 'endless', metric: 'score', hours: 48, ac: 'L2' },
  'terp-tapper': { game: 'Piano Tiles', category: CATEGORIES[7], recognition_tier: 'A', competition_type: 'endless', metric: 'combo', hours: 48, ac: 'L2' },
  'high-score': { game: 'Whac-A-Mole', category: CATEGORIES[7], recognition_tier: 'A', competition_type: 'short_session', metric: 'best_of_5', hours: 24, ac: 'L2' },
  'memory-match': { game: 'Simon / Memory', category: CATEGORIES[6], recognition_tier: 'B+', competition_type: 'short_session', metric: 'best_of_3', hours: 24, ac: 'L4' },
  'munchies-snake': { game: 'Snake', category: CATEGORIES[10], recognition_tier: 'A+', competition_type: 'endless', metric: 'score', hours: 72, ac: 'L2' },
  'brick-breaker': { game: 'Breakout / Arkanoid', category: CATEGORIES[5], recognition_tier: 'A', competition_type: 'endless', metric: 'score', hours: 72, ac: 'L2' },
  'void-swarm': { game: 'Galaga', category: CATEGORIES[5], recognition_tier: 'A+', competition_type: 'endless', metric: 'kills_score', hours: 48, ac: 'L2', cap: 1800 },
  'grow-guard': { game: 'Plants vs. Zombies', category: CATEGORIES[3], recognition_tier: 'A+', competition_type: 'strategy', metric: 'wave', hours: 120, ac: 'L2' },
  'haze-defense': { game: 'Bloons TD 6', category: CATEGORIES[3], recognition_tier: 'A+', competition_type: 'strategy', metric: 'wave', hours: 120, ac: 'L2' },
  'sling-smash': { game: 'Angry Birds 2', category: CATEGORIES[2], recognition_tier: 'A+', competition_type: 'campaign', metric: 'cumulative', hours: 168, ac: 'L2', levels: [1, 30] },
  'plinko': { game: 'Plinko', category: CATEGORIES[11], recognition_tier: 'A', competition_type: 'short_session', metric: 'single', hours: 24, ac: 'L1' },
  'spin-to-win': { game: 'Prize wheel', category: CATEGORIES[11], recognition_tier: 'B+', competition_type: 'short_session', metric: 'single', hours: 24, ac: 'L1' },
  'blazed-roulette': { game: 'Roulette', category: CATEGORIES[11], recognition_tier: 'A', competition_type: 'short_session', metric: 'single', hours: 24, ac: 'L1' },
};
const str = (v, n) => String(v == null ? '' : v).trim().slice(0, n);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
const eligible = (id) => typeof cfg.giveawayEligible === 'function' ? !!cfg.giveawayEligible(id) : (cfg.GAME_MAP[id] || {}).giveaway !== false;
const hoursText = (h) => !h ? '' : h < 1 ? `${Math.round(h * 60)} minutes` : h < 48 ? `${+h.toFixed(1)} hours` : `${+(h / 24).toFixed(1)} days`;
const metricLabel = (t, m) => ((COMP[t] || COMP.endless).metrics[m] || [m])[0];

function defaults(id) {
  const g = cfg.GAME_MAP[id] || (cfg.gameInfo ? cfg.gameInfo(id) : null) || { id, title: id };
  const d = D[id] || { game: g.title, category: g.category || 'Specialty', recognition_tier: 'B+', competition_type: 'endless', metric: 'score', hours: 48, ac: 'L2' };
  const m = (COMP[d.competition_type].metrics[d.metric] || [])[2] || {};
  return clean({ game_id: id, game: d.game, hub_version: g.title, category: d.category, recognition_tier: d.recognition_tier, competition_type: d.competition_type, metric: d.metric,
    endless: d.competition_type === 'endless' || (g.tags || []).includes('Endless'), giveaway_compatible: eligible(id), scoring: g.scoring || '', attempts: m.attempts || 0,
    recommended_hours: d.hours, anticheat_level: d.ac, leaderboard: d.competition_type === 'campaign' ? 'Cumulative across the level set' : metricLabel(d.competition_type, d.metric),
    winner_rule: WINNER_RULE, level_from: d.levels ? d.levels[0] : 0, level_to: d.levels ? d.levels[1] : 0, run_cap_sec: m.cap || d.cap || 0, source_tier: 'original', licence: 'Hub original', notes: '' }, id);
}
function clean(p, id) {
  const t = COMP[p.competition_type] ? p.competition_type : 'endless'; const metric = COMP[t].metrics[p.metric] ? p.metric : Object.keys(COMP[t].metrics)[0];
  const linked = !!cfg.GAME_MAP[id];
  const lf = Math.max(0, Math.min(999, parseInt(p.level_from, 10) || 0)), lt = Math.max(0, Math.min(999, parseInt(p.level_to, 10) || 0));
  return { game_id: id, linked, game: str(p.game, 80), hub_version: str(p.hub_version, 80), category: str(p.category, 60), recognition_tier: TIERS.includes(p.recognition_tier) ? p.recognition_tier : 'B+',
    competition_type: t, metric, metric_label: metricLabel(t, metric), endless: !!p.endless,
    giveaway_compatible: linked ? (!!p.giveaway_compatible && eligible(id)) : !!p.giveaway_compatible, chance_locked: linked && !eligible(id),
    scoring: str(p.scoring, 400), attempts: Math.max(0, Math.min(100, parseInt(p.attempts, 10) || 0)),
    recommended_hours: Math.max(0, Math.min(24 * 366, Number(p.recommended_hours) || 0)), recommended_length: hoursText(Number(p.recommended_hours) || 0),
    anticheat_level: AC[p.anticheat_level] ? p.anticheat_level : 'L2', leaderboard: str(p.leaderboard, 120), winner_rule: str(p.winner_rule, 160) || WINNER_RULE,
    level_from: t === 'campaign' ? (lf || 1) : lf, level_to: t === 'campaign' ? Math.max(lt, lf || 1) : lt, run_cap_sec: Math.max(0, Math.min(86400, parseInt(p.run_cap_sec, 10) || 0)),
    source_tier: SOURCES[p.source_tier] ? p.source_tier : 'build', licence: str(p.licence, 120), source_url: /^https:\/\/[^\s"'<>]{4,300}$/.test(p.source_url || '') ? p.source_url : '', notes: str(p.notes, 1000) };
}
function get(id) {
  const r = db.prepare('SELECT * FROM game_profiles WHERE game_id=?').get(id);
  if (!r) return cfg.GAME_MAP[id] ? { ...defaults(id), source: 'default' } : null;
  let d = {}; try { d = JSON.parse(r.data); } catch { d = {}; }
  const base = cfg.GAME_MAP[id] ? defaults(id) : {};
  return { ...clean({ ...base, ...d }, id), source: r.source, updated_by: r.updated_by, updated_at: r.updated_at };
}
function list() {
  const ids = new Set([...cfg.GAMES.map(g => g.id), ...db.prepare('SELECT game_id FROM game_profiles').all().map(r => r.game_id)]);
  return [...ids].map(get).filter(Boolean).sort((a, b) => (b.linked - a.linked) || a.hub_version.localeCompare(b.hub_version) || a.game.localeCompare(b.game));
}
function save(id, body, actor = '', source = 'admin') {
  id = String(id || ''); if (!/^(ref:)?[a-z0-9][a-z0-9-]{0,60}$/.test(id)) return { ok: false, error: 'Bad game id.' };
  const cur = get(id) || {}; const p = clean({ ...cur, ...body }, id);
  if (!p.game && !p.hub_version) return { ok: false, error: 'Give the profile a game name.' };
  if (p.competition_type === 'campaign' && p.level_to < p.level_from) return { ok: false, error: 'The level set must end after it starts.' };
  const { linked, metric_label, recommended_length, chance_locked, ...store } = p; void linked; void metric_label; void recommended_length; void chance_locked;
  db.prepare('INSERT INTO game_profiles (game_id, data, source, updated_by, updated_at) VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET data=excluded.data, source=excluded.source, updated_by=excluded.updated_by, updated_at=excluded.updated_at')
    .run(id, JSON.stringify(store), source, str(actor, 40), now());
  return { ok: true, profile: get(id) };
}
function reset(id) { db.prepare('DELETE FROM game_profiles WHERE game_id=?').run(String(id)); return { ok: true, profile: get(String(id)) }; }

// ---------- importer (docs/exact-game-hunt.json) ----------
const KEY = { game: ['game', 'name', 'reference', 'reference_game', 'title', 'game_name'], hub_version: ['hub_version', 'hub_name', 'hub_title', 'hub_game'], game_id: ['game_id', 'hub_id', 'hub_game_id', 'id', 'slug'],
  category: ['category', 'cat', 'genre'], recognition_tier: ['recognition_tier', 'recognition', 'tier', 'recognizability'], competition_type: ['competition_type', 'competition', 'mode', 'type', 'format'],
  metric: ['metric', 'score_metric', 'primary_metric'], endless: ['endless', 'endless_y_n', 'endless_yn', 'is_endless'], giveaway_compatible: ['giveaway_compatible', 'giveaway', 'giveaway_ok', 'giveaway_compatibility', 'giveaway_eligible'],
  scoring: ['scoring', 'score', 'score_rule', 'scoring_rule'], attempts: ['attempts', 'attempt_rule', 'attempts_rule', 'max_attempts'], recommended_hours: ['recommended_hours', 'event_hours'],
  recommended_length: ['recommended_event_length', 'event_length', 'recommended_length', 'length'], anticheat_level: ['anti_cheat_level', 'anticheat_level', 'anti_cheat', 'anticheat', 'ac_level', 'ac'],
  leaderboard: ['leaderboard', 'leaderboard_type'], winner_rule: ['winner_rule', 'winner', 'win_rule'], level_set: ['level_set', 'levels', 'level_range'], run_cap_sec: ['run_cap_sec', 'run_cap', 'session_cap', 'time_cap'],
  source_tier: ['source_tier', 'source', 'source_hierarchy', 'source_type', 'verdict'], licence: ['licence', 'license'], source_url: ['source_url', 'url', 'repo', 'link'], notes: ['notes', 'note', 'comments'] };
const nk = (k) => String(k).toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const yes = (v) => typeof v === 'boolean' ? v : /^(y|yes|true|1|ok|compatible)/i.test(String(v || '').trim());
function parseHours(v) { if (typeof v === 'number') return v; const s = String(v || '').toLowerCase(); const n = parseFloat(s.replace(/[^0-9.]+/g, ' ').trim().split(' ')[0]); if (!Number.isFinite(n)) return 0;
  return /month/.test(s) ? n * 730 : /week/.test(s) ? n * 168 : /day|\dd\b/.test(s) ? n * 24 : /min/.test(s) ? n / 60 : n; }
function parseSecs(v) { if (typeof v === 'number') return v; const s = String(v || '').toLowerCase(); const n = parseFloat(s); if (!Number.isFinite(n)) return 0; return /hour|\dh\b/.test(s) ? n * 3600 : /min|\dm\b/.test(s) ? n * 60 : n; }
function parseComp(v, metricRaw) {
  const s = `${v || ''} ${metricRaw || ''}`.toLowerCase(); let t = /campaign|level/.test(s) ? 'campaign' : /short|session|attack|best of|60.?s|3.?min/.test(s) ? 'short_session' : /strategy|tower|economy/.test(s) ? 'strategy' : 'endless';
  if (/^(endless|campaign|short_session|strategy)$/.test(String(v || ''))) t = v; const m = String(metricRaw || '').toLowerCase(); let metric = '';
  if (t === 'campaign') metric = /fast/.test(s) ? 'fastest' : 'cumulative';
  else if (t === 'short_session') metric = /best of 5|bo5/.test(s) ? 'best_of_5' : /best of 3|bo3/.test(s) ? 'best_of_3' : /60/.test(s) ? 'attack_60' : /3.?min|180/.test(s) ? 'attack_180' : 'single';
  else if (t === 'strategy') metric = /econom/.test(s) ? 'economy' : /total/.test(s) ? 'total' : 'wave';
  else metric = /marathon|cumulative|total/.test(m) ? 'marathon' : /surviv/.test(s) && /dist/.test(s) ? 'survival_distance' : /kill/.test(s) && /score/.test(s) ? 'kills_score' : /surviv|time/.test(m || s) ? 'survival' : /wave|round/.test(s) ? 'wave' : /kill/.test(s) ? 'kills' : /dist|meter/.test(s) ? 'distance' : /combo/.test(s) ? 'combo' : 'score';
  if (COMP[t].metrics[metricRaw]) metric = metricRaw;
  return [t, metric];
}
function matchGame(e) {
  const cand = [e.game_id, e.hub_version, e.game].filter(Boolean).map(String);
  for (const c of cand) { if (cfg.GAME_MAP[c]) return c; const s = slug(c); if (cfg.GAME_MAP[s]) return s; const byTitle = cfg.GAMES.find(g => g.title.toLowerCase() === c.toLowerCase()); if (byTitle) return byTitle.id; }
  return 'ref:' + (slug(e.game || e.hub_version || e.game_id).slice(0, 56) || 'game');
}
function entriesOf(json) {
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') { for (const k of ['games', 'items', 'catalog', 'entries', 'profiles', 'results', 'data']) if (Array.isArray(json[k])) return json[k];
    if (json.categories && typeof json.categories === 'object') return Object.entries(json.categories).flatMap(([cat, arr]) => (Array.isArray(arr) ? arr : []).map(x => ({ category: cat, ...x })));
    return Object.entries(json).filter(([, v]) => v && typeof v === 'object' && !Array.isArray(v)).map(([name, v]) => ({ game: name, ...v })); }
  return [];
}
function readEntry(raw) {
  const flat = {}; for (const [k, v] of Object.entries(raw || {})) flat[nk(k)] = v;
  if (raw && raw.card && typeof raw.card === 'object') for (const [k, v] of Object.entries(raw.card)) if (flat[nk(k)] === undefined) flat[nk(k)] = v;
  const pick = (f) => { for (const k of KEY[f]) if (flat[k] !== undefined && flat[k] !== null && flat[k] !== '') return flat[k]; return undefined; };
  const e = {}; for (const f of Object.keys(KEY)) { const v = pick(f); if (v !== undefined) e[f] = v; }
  const [t, metric] = parseComp(e.competition_type, e.metric || (typeof e.scoring === 'string' && e.scoring.length < 80 ? e.scoring : '')); e.competition_type = t; e.metric = metric;
  if (e.endless !== undefined) e.endless = yes(e.endless); else e.endless = t === 'endless';
  if (e.giveaway_compatible !== undefined) e.giveaway_compatible = yes(e.giveaway_compatible);
  if (e.recognition_tier) { const m = String(e.recognition_tier).toUpperCase().match(/A\+|B\+|A|B/); e.recognition_tier = m ? m[0] : 'B+'; }
  if (e.anticheat_level !== undefined) { const m = String(e.anticheat_level).match(/[1-4]/); e.anticheat_level = m ? 'L' + m[0] : 'L2'; }
  if (e.attempts !== undefined) { const s = String(e.attempts).toLowerCase(); e.attempts = /unlimit|any|∞/.test(s) ? 0 : parseInt(s.replace(/[^0-9]+/g, ' ').trim().split(' ')[0], 10) || 0; }
  else if (/best_of_(\d)/.test(metric)) e.attempts = +metric.slice(-1);
  if (e.recommended_hours === undefined && e.recommended_length !== undefined) e.recommended_hours = parseHours(e.recommended_length); else if (e.recommended_hours !== undefined) e.recommended_hours = parseHours(e.recommended_hours);
  delete e.recommended_length;
  if (e.level_set !== undefined) { const m = String(Array.isArray(e.level_set) ? e.level_set.join('-') : e.level_set).match(/(\d+)\D+(\d+)/); if (m) { e.level_from = +m[1]; e.level_to = +m[2]; } delete e.level_set; }
  if (e.run_cap_sec !== undefined) e.run_cap_sec = parseSecs(e.run_cap_sec); else if (metric === 'attack_60') e.run_cap_sec = 60; else if (metric === 'attack_180') e.run_cap_sec = 180;
  if (e.source_tier !== undefined) { const s = String(e.source_tier).toLowerCase(); e.source_tier = /exact|original source/.test(s) ? 'exact' : /faithful|recreat/.test(s) ? 'faithful' : /alternative|open/.test(s) ? 'alternative' : /hub original/.test(s) ? 'original' : 'build'; }
  for (const f of ['game', 'hub_version', 'category', 'scoring', 'leaderboard', 'winner_rule', 'licence', 'notes', 'source_url']) if (e[f] !== undefined && typeof e[f] !== 'string') e[f] = Array.isArray(e[f]) ? e[f].join(', ') : JSON.stringify(e[f]);
  return e;
}
function importProfiles(json, { dry = true, actor = '', overwriteAdmin = false } = {}) {
  const list0 = entriesOf(json); if (!list0.length) return { ok: false, error: 'No game entries found. Expected an array of game cards, {"games": [...]}, or an object keyed by game name.' };
  if (list0.length > 1000) return { ok: false, error: 'Too many entries (max 1000).' };
  const out = { ok: true, dry, total: list0.length, linked: [], refs: [], skipped: [], errors: [] };
  const tx = db.transaction(() => { list0.forEach((raw, i) => {
    try {
      const e = readEntry(raw); if (!e.game && !e.hub_version && !e.game_id) { out.errors.push({ i, error: 'Entry has no game name.' }); return; }
      const id = matchGame(e); delete e.game_id;
      const cur = db.prepare('SELECT source FROM game_profiles WHERE game_id=?').get(id);
      if (cur && cur.source === 'admin' && !overwriteAdmin) { out.skipped.push({ i, id, game: e.game || e.hub_version, why: 'edited by an admin (tick "overwrite admin edits" to replace)' }); return; }
      const p = clean({ ...(get(id) || {}), ...e }, id);
      (id.startsWith('ref:') ? out.refs : out.linked).push({ i, id, game: p.game, hub_version: p.hub_version, competition: `${COMP[p.competition_type].label}: ${p.metric_label}`, ac: p.anticheat_level, giveaway: p.giveaway_compatible });
      if (!dry) { const r = save(id, e, actor, 'import'); if (!r.ok) out.errors.push({ i, id, error: r.error }); }
    } catch (err) { out.errors.push({ i, error: String(err.message || err).slice(0, 200) }); }
  }); });
  tx(); return out;
}
// what the builder pre-fills when a game is picked
function builderDefaults(id) {
  const p = get(id); if (!p) return null; const m = COMP[p.competition_type].metrics[p.metric] || [];
  return { game_id: id, competition: { type: p.competition_type, metric: p.metric, level_from: p.level_from, level_to: p.level_to }, score_rule: m[1] || 'best', attempts: p.attempts, run_cap_sec: p.run_cap_sec,
    recommended_hours: p.recommended_hours, anticheat_level: p.anticheat_level, winner_rule: p.winner_rule };
}
module.exports = { COMP, AC, TIERS, SOURCES, CATEGORIES, WINNER_RULE, get, list, save, reset, defaults, importProfiles, readEntry, entriesOf, builderDefaults, metricLabel };

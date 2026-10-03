'use strict';
// v3 progression: player XP + levels, daily check-in streaks, daily quests and seasons (free reward track).
// Everything here is computed on the server from stored, validated data. Points/cosmetics only - no cash value.
const db = require('./db');
const cfg = require('./config');

// ---------- days in the hub's time zone ----------
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: cfg.TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayNum = (ms) => { const [y, m, d] = dayFmt.format(new Date(ms)).split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 864e5); };
const offFmt = new Intl.DateTimeFormat('en-US', { timeZone: cfg.TZ, timeZoneName: 'longOffset' });
function tzOffsetMs(ms) { const p = offFmt.formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value; const m = p.match(/GMT([+-])(\d\d):?(\d\d)?/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 3600e3 + (+m[3] || 0) * 60e3) : 0; }
// ms timestamp of local midnight that starts hub-day `d`
function dayStart(d) { const utc = d * 864e5; return utc - tzOffsetMs(utc + 12 * 3600e3); }

// ---------- XP + levels ----------
const ACH_XP = { bronze: 25, silver: 50, gold: 100, epic: 200, legendary: 400 };
const RUN_XP = 10, TIER_XP = 10;
function runXp(r) { const t = cfg.GAME_MAP[r.game_id]?.tiers || []; return RUN_XP + t.filter(x => r.score >= x).length * TIER_XP; }
function levelFor(xp) {
  const level = Math.floor((1 + Math.sqrt(1 + (8 * xp) / 100)) / 2);
  const base = 100 * (level - 1) * level / 2, next = 100 * level * (level + 1) / 2;
  return { level, xp, into: xp - base, need: next - base, next_at: next };
}
let achTier = null; // lazily loaded to avoid a require cycle with achievements.js
function xpFor(userId, since = 0, until = 8.64e15) {
  if (!achTier) achTier = (id) => (require('./achievements').BY_ID[id] || {}).tier;
  let xp = 0;
  for (const r of db.prepare('SELECT game_id, score FROM runs WHERE user_id=? AND created_at>=? AND created_at<=?').all(userId, since, until)) xp += runXp(r);
  for (const a of db.prepare('SELECT ach_id FROM user_achievements WHERE user_id=? AND unlocked_at>=? AND unlocked_at<=?').all(userId, since, until)) xp += ACH_XP[achTier(a.ach_id)] || 0;
  xp += db.prepare('SELECT COALESCE(SUM(xp),0) AS x FROM quest_claims WHERE user_id=? AND created_at>=? AND created_at<=?').get(userId, since, until).x;
  xp += db.prepare('SELECT COALESCE(SUM(xp),0) AS x FROM checkins WHERE user_id=? AND created_at>=? AND created_at<=?').get(userId, since, until).x;
  return xp;
}

// ---------- daily check-in streak ----------
function streakInfo(userId, today = dayNum(Date.now())) {
  const days = db.prepare('SELECT day FROM checkins WHERE user_id=? ORDER BY day').all(userId).map(r => r.day);
  let best = 0, run = 0;
  for (let i = 0; i < days.length; i++) { run = i && days[i] === days[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); }
  const last = days[days.length - 1];
  const current = last !== undefined && last >= today - 1 ? run : 0;
  return { current, best, checked_today: last === today, total: days.length };
}
const checkinXp = (streak) => 20 + 5 * Math.min(Math.max(streak - 1, 0), 6);
function checkin(userId, t = Date.now()) {
  const today = dayNum(t); const before = streakInfo(userId, today);
  if (before.checked_today) return { ...before, fresh: false, xp: 0 };
  const streak = before.current + 1; const xp = checkinXp(streak);
  db.prepare('INSERT OR IGNORE INTO checkins (user_id, day, xp, created_at) VALUES (?,?,?,?)').run(userId, today, xp, t);
  return { ...streakInfo(userId, today), fresh: true, xp };
}

// ---------- daily quests (same 3 for everyone each day, progress from today's validated runs) ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const G = () => cfg.GAMES.filter(g => g.playable);
function questsFor(day) {
  const r = rng(day * 2654435761); const games = G();
  const pick = (arr) => arr[Math.floor(r() * arr.length)];
  const g1 = pick(games); let g2 = pick(games); if (g2.id === g1.id) g2 = games[(games.indexOf(g1) + 1) % games.length];
  const fmt = (n) => Number(n).toLocaleString('en-US'); const u = (g) => g.unit === 'm' ? 'm' : ' ' + g.unit;
  const scoreN = (g) => { const t = g.tiers[0]; const v = Math.max(10, Math.round(t * 0.5 / 10) * 10); return v; };
  const A = [{ k: 'runs', n: 3, text: 'Finish 3 runs of any game', xp: 60, icon: 'gamepad-2' }, { k: 'runs', n: 5, text: 'Finish 5 runs of any game', xp: 90, icon: 'gamepad-2' }];
  const B = [{ k: 'game', game: g1.id, n: 1, text: `Finish a run of ${g1.title}`, xp: 50, icon: 'play' }, { k: 'score', game: g2.id, n: scoreN(g2), text: `Score ${fmt(scoreN(g2))}${u(g2)} in ${g2.title}`, xp: 120, icon: 'target' }];
  const C = [{ k: 'variety', n: 3, text: 'Play 3 different games', xp: 80, icon: 'shuffle' }, { k: 'pb', n: 1, text: 'Beat one of your personal bests', xp: 120, icon: 'trending-up' }, { k: 'hype', n: 1, text: 'Hype a post in the Community', xp: 40, icon: 'flame' }];
  return [pick(A), pick(B), pick(C)].map((q, i) => ({ idx: i, ...q }));
}
const BONUS_XP = 100;
function questProgress(userId, t = Date.now()) {
  const day = dayNum(t); const from = dayStart(day), to = dayStart(day + 1) - 1;
  const runs = db.prepare('SELECT game_id, score, created_at FROM runs WHERE user_id=? AND created_at>=? AND created_at<=? ORDER BY created_at').all(userId, from, to);
  const claimed = new Set(db.prepare('SELECT idx FROM quest_claims WHERE user_id=? AND day=?').all(userId, day).map(r => r.idx));
  const val = (q) => {
    if (q.k === 'runs') return runs.length;
    if (q.k === 'game') return runs.filter(r => r.game_id === q.game).length;
    if (q.k === 'score') return Math.max(0, ...runs.filter(r => r.game_id === q.game).map(r => r.score));
    if (q.k === 'variety') return new Set(runs.map(r => r.game_id)).size;
    if (q.k === 'pb') { let n = 0; for (const r of runs) { const prev = db.prepare('SELECT MAX(score) AS b FROM runs WHERE user_id=? AND game_id=? AND created_at<?').get(userId, r.game_id, r.created_at).b; if (prev !== null && r.score > prev) n++; } return n; }
    if (q.k === 'hype') return db.prepare('SELECT COUNT(*) AS c FROM reactions WHERE user_id=? AND created_at>=? AND created_at<=?').get(userId, from, to).c;
    return 0;
  };
  const quests = questsFor(day).map(q => { const v = val(q); return { ...q, value: Math.min(v, q.n), done: v >= q.n, claimed: claimed.has(q.idx) }; });
  const allClaimed = quests.every(q => q.claimed);
  return { day, resets_at: to + 1, quests, bonus: { idx: 3, xp: BONUS_XP, text: 'Complete all 3 daily quests', ready: allClaimed, claimed: claimed.has(3) } };
}
function claimQuest(userId, idx, t = Date.now()) {
  const p = questProgress(userId, t);
  if (idx === 3) { if (!p.bonus.ready) return { ok: false, error: 'Claim all 3 quests first.' }; if (p.bonus.claimed) return { ok: false, error: 'Already claimed.' }; }
  else { const q = p.quests[idx]; if (!q) return { ok: false, error: 'Unknown quest.' }; if (!q.done) return { ok: false, error: 'Quest not complete yet.' }; if (q.claimed) return { ok: false, error: 'Already claimed.' }; }
  const xp = idx === 3 ? BONUS_XP : p.quests[idx].xp;
  const r = db.prepare('INSERT OR IGNORE INTO quest_claims (user_id, day, idx, xp, created_at) VALUES (?,?,?,?,?)').run(userId, p.day, idx, xp, t);
  if (!r.changes) return { ok: false, error: 'Already claimed.' };
  return { ok: true, xp };
}
const questsDone = (userId) => db.prepare('SELECT COUNT(*) AS c FROM quest_claims WHERE user_id=? AND idx<3').get(userId).c;

// ---------- seasons: calendar quarters, Season 1 = Q4 2026. Free 20-tier track, no paid pass. ----------
const SEASON_NAMES = ['Neon Genesis', 'Purple Haze', 'Chrome Summer', 'Afterglow', 'Static Bloom', 'Night Shift', 'Hyperdrive', 'Low Orbit'];
const TIER_XP_S = 300, TIERS = 20;
const TRACK = { 3: 'Title: Season Starter', 5: 'Banner: Season One: Neon Genesis', 10: 'Frame: Season Laurel', 20: 'Title: Season Legend' };
function seasonAt(t = Date.now()) {
  const [y, m] = dayFmt.format(new Date(t)).split('-').map(Number);
  const q = Math.floor((m - 1) / 3); const n = (y - 2026) * 4 + q - 2; // 2026 Q4 (q=3) -> 1
  const num = Math.max(1, n);
  const sy = 2026 + Math.floor((num + 2) / 4), sq = (num + 2) % 4;
  const start = dayStart(Math.round(Date.UTC(sy, sq * 3, 1) / 864e5));
  const end = dayStart(Math.round(Date.UTC(sq === 3 ? sy + 1 : sy, sq === 3 ? 0 : sq * 3 + 3, 1) / 864e5)) - 1;
  return { number: num, name: SEASON_NAMES[(num - 1) % SEASON_NAMES.length], start_at: start, end_at: end, tiers: TIERS, tier_xp: TIER_XP_S };
}
function seasonProgress(userId, t = Date.now()) {
  const s = seasonAt(t); const xp = userId ? xpFor(userId, s.start_at, s.end_at) : 0;
  const tier = Math.min(TIERS, Math.floor(xp / TIER_XP_S));
  return { ...s, xp, tier, into: tier >= TIERS ? TIER_XP_S : xp % TIER_XP_S, track: Array.from({ length: TIERS }, (_, i) => ({ tier: i + 1, xp: (i + 1) * TIER_XP_S, reward: TRACK[i + 1] || null, unlocked: tier >= i + 1 })) };
}
// best season tier ever reached (for achievements); only the current season is computed (seasons are short-lived here)
const bestSeasonTier = (userId) => seasonProgress(userId).tier;
function seasonBoard(limit = 50, t = Date.now()) {
  const s = seasonAt(t);
  const ids = db.prepare(`SELECT DISTINCT user_id FROM (SELECT user_id FROM runs WHERE created_at BETWEEN ? AND ? UNION SELECT user_id FROM checkins WHERE created_at BETWEEN ? AND ? UNION SELECT user_id FROM quest_claims WHERE created_at BETWEEN ? AND ?)`).all(s.start_at, s.end_at, s.start_at, s.end_at, s.start_at, s.end_at).map(r => r.user_id);
  const rows = ids.map(id => ({ id, xp: xpFor(id, s.start_at, s.end_at) })).sort((a, b) => b.xp - a.xp).slice(0, limit);
  const U = db.prepare('SELECT id AS user_id, username, is_demo, eq_banner, eq_frame, eq_title, eq_badge, banned FROM users WHERE id=?');
  return rows.map(r => ({ ...U.get(r.id), score: r.xp, tier: Math.min(TIERS, Math.floor(r.xp / TIER_XP_S)) })).filter(r => r.username && !r.banned).map((r, i) => ({ rank: i + 1, ...r }));
}

module.exports = { dayNum, dayStart, levelFor, xpFor, runXp, ACH_XP, streakInfo, checkin, checkinXp, questsFor, questProgress, claimQuest, questsDone, seasonAt, seasonProgress, bestSeasonTier, seasonBoard };

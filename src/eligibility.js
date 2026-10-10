'use strict';
// v5 anti-giveaway-camping: per-giveaway eligibility rules, explicit entries with a cap on simultaneous entries,
// win cooldowns, one win per brand per month and activity-weighted random draws.
const db = require('./db');
const D = 864e5;
const now = () => Date.now();

// Defaults pre-filled in the admin giveaway form (and used for demo giveaways).
const DEFAULTS = { require_join: 1, elig_min_runs7: 3, elig_min_xp7: 0, elig_account_age_days: 2, elig_max_active: 3, elig_win_cooldown_days: 30, elig_brand_month: 1, elig_followers_only: 0, weight_mode: 'activity' };
const FIELDS = Object.keys(DEFAULTS);
const WEIGHT = { per: 5, max: 5 }; // random draws: 1 entry + 1 per 5 runs in the giveaway window, max 5 entries

function read(b) {
  const n = (v, lo, hi) => Math.max(lo, Math.min(hi, parseInt(v ?? 0, 10) || 0));
  return { require_join: b.require_join ? 1 : 0, elig_min_runs7: n(b.elig_min_runs7, 0, 100), elig_min_xp7: n(b.elig_min_xp7, 0, 100000),
    elig_account_age_days: n(b.elig_account_age_days, 0, 365), elig_max_active: n(b.elig_max_active, 0, 50), elig_win_cooldown_days: n(b.elig_win_cooldown_days, 0, 365),
    elig_brand_month: b.elig_brand_month ? 1 : 0, elig_followers_only: b.elig_followers_only ? 1 : 0, weight_mode: b.weight_mode === 'activity' ? 'activity' : '' };
}
function rulesOf(g) {
  const r = {}; for (const k of FIELDS) r[k] = g[k] ?? 0; r.weight_mode = g.weight_mode || '';
  return r;
}
// plain-language list shown on every giveaway + in its Official Rules
function describe(g, channel) {
  const r = rulesOf(g); const out = [];
  if (r.require_join) out.push('Tap "Enter giveaway" to join, then play a linked game. Only joined players are ranked or drawn.');
  if (r.elig_min_runs7 || r.elig_min_xp7) out.push(`Recent activity: ${[r.elig_min_runs7 ? `${r.elig_min_runs7} run${r.elig_min_runs7 === 1 ? '' : 's'}` : '', r.elig_min_xp7 ? `${r.elig_min_xp7} XP` : ''].filter(Boolean).join(' or ')} in the last 7 days (any games) before joining.`);
  if (r.elig_account_age_days) out.push(`Account at least ${r.elig_account_age_days} day${r.elig_account_age_days === 1 ? '' : 's'} old.`);
  if (r.elig_max_active) out.push(`You can be entered in up to ${r.elig_max_active} live giveaways at once - choose which; leave one to free a slot.`);
  if (r.elig_win_cooldown_days) out.push(`Win cooldown: no new wins for ${r.elig_win_cooldown_days} days after you win a giveaway.`);
  if (r.elig_brand_month && channel) out.push(`One win per player per brand per 30 days (${channel.name}).`);
  out.push(require('./brands').RULE_TEXT(g)); // v7 brand affiliation: who can enter
  if (g.win_method === 'random' && r.weight_mode === 'activity') out.push(`Activity entries: 1 entry + 1 more per ${WEIGHT.per} runs in the giveaway window (max ${WEIGHT.max}). Free play only - nothing can be bought.`);
  out.push('Have your Potato username on your account so Trap Tech can contact you if you win.');
  return out;
}
const entryOf = (gid, uid) => db.prepare('SELECT * FROM giveaway_entries WHERE giveaway_id=? AND user_id=?').get(gid, uid);
function activeEntries(uid, t = now()) {
  return db.prepare(`SELECT g.id, g.title, g.end_at FROM giveaway_entries e JOIN giveaways g ON g.id = e.giveaway_id
    WHERE e.user_id=? AND e.left_at IS NULL AND g.active=1 AND g.finalized_at IS NULL AND g.start_at <= ? AND g.end_at > ? ORDER BY g.end_at`).all(uid, t, t);
}
function lastWin(uid, since, channelId = null) {
  const q = `SELECT MAX(t) AS t FROM (
    SELECT c.created_at AS t, g.channel_id FROM giveaway_confirm c JOIN giveaways g ON g.id = c.giveaway_id WHERE c.user_id=@u AND c.created_at >= @s
    UNION ALL SELECT w.drawn_at AS t, g.channel_id FROM winners w JOIN giveaways g ON g.id = w.giveaway_id WHERE w.user_id=@u AND w.drawn_at >= @s) x ${channelId ? 'WHERE x.channel_id = @c' : ''}`;
  return db.prepare(q).get({ u: uid, s: since, c: channelId }).t || null;
}
const fmtDate = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' });

// Eligibility of a player for a giveaway, with a human hint for every unmet rule.
function check(user, g, t = now()) {
  const r = rulesOf(g); const checks = [];
  const u = db.prepare('SELECT id, username, created_at, potato FROM users WHERE id=?').get(user.id);
  const channel = g.channel_id ? db.prepare('SELECT id, name, slug FROM channels WHERE id=?').get(g.channel_id) : null;
  if (r.elig_min_runs7 || r.elig_min_xp7) {
    const runs = db.prepare('SELECT COUNT(*) AS c FROM runs WHERE user_id=? AND created_at >= ?').get(u.id, t - 7 * D).c;
    const xp = r.elig_min_xp7 ? require('./progress').xpFor(u.id, t - 7 * D) : 0;
    const ok = (r.elig_min_runs7 && runs >= r.elig_min_runs7) || (r.elig_min_xp7 && xp >= r.elig_min_xp7);
    const need = Math.max(0, r.elig_min_runs7 - runs);
    checks.push({ id: 'activity', ok, label: 'Recent activity (7 days)', have: runs, need: r.elig_min_runs7,
      hint: ok ? `${runs} run${runs === 1 ? '' : 's'} in the last 7 days` : r.elig_min_runs7 ? `Play ${need} more run${need === 1 ? '' : 's'} to qualify` : `Earn ${r.elig_min_xp7 - xp} more XP this week to qualify` });
  }
  if (r.elig_account_age_days) {
    const ready = u.created_at + r.elig_account_age_days * D; const ok = t >= ready;
    checks.push({ id: 'age', ok, label: `Account ${r.elig_account_age_days}+ days old`, hint: ok ? 'Account age OK' : `New accounts can enter from ${fmtDate(ready)}` });
  }
  if (channel && !g.open_to_all) { // v7: brand giveaways are for that brand's members (one brand per player)
    const mine = db.prepare('SELECT c.id, c.name FROM users u JOIN channels c ON c.id=u.brand_id WHERE u.id=?').get(u.id); const ok = !!(mine && mine.id === channel.id);
    const sw = require('./brands').status(u.id, t);
    checks.push({ id: 'brand_member', ok, label: `${channel.name} member`, channel: channel.slug, brand_id: channel.id,
      hint: ok ? `You're in ${channel.name}` : mine ? (sw.can_switch ? `This giveaway is for ${channel.name} members. You're in ${mine.name} - switch brands to enter.` : `This giveaway is for ${channel.name} members. You're in ${mine.name} and can switch from ${fmtDate(sw.can_switch_at)}.`) : `This giveaway is for ${channel.name} members. Join ${channel.name} with its invite link or code to enter.` });
  }
  if (r.elig_win_cooldown_days) {
    const w = lastWin(u.id, t - r.elig_win_cooldown_days * D); const ok = !w;
    checks.push({ id: 'cooldown', ok, label: `No wins in the last ${r.elig_win_cooldown_days} days`, hint: ok ? 'No recent wins' : `You won recently - you can win again from ${fmtDate(w + r.elig_win_cooldown_days * D)}` });
  }
  if (r.elig_brand_month && channel) {
    const w = lastWin(u.id, t - 30 * D, channel.id); const ok = !w;
    checks.push({ id: 'brand', ok, label: `One ${channel.name} win per 30 days`, hint: ok ? `No ${channel.name} win in 30 days` : `You already won a ${channel.name} giveaway - try again from ${fmtDate(w + 30 * D)}` });
  }
  const entry = entryOf(g.id, u.id); const joined = !!(entry && !entry.left_at);
  if (r.elig_max_active && !joined) {
    const act = activeEntries(u.id, t).filter(x => x.id !== g.id); const ok = act.length < r.elig_max_active;
    checks.push({ id: 'slots', ok, label: `Max ${r.elig_max_active} live entries at once`, have: act.length, need: r.elig_max_active, entries: act,
      hint: ok ? `${act.length} of ${r.elig_max_active} entry slots used` : `You're in ${act.length} live giveaways (max ${r.elig_max_active}). Leave one to join this one.` });
  }
  for (const fn of module.exports.extra) { try { checks.push(...fn(u, g, t)); } catch (e) { /* v7 builder checks never break the page */ } }
  const potatoOk = /^[A-Za-z0-9_]{3,32}$/.test(u.potato || '');
  checks.push({ id: 'potato', ok: potatoOk, label: 'Potato username on file', hint: potatoOk ? `Winner contact: @${u.potato} on Potato` : 'Add your Potato username so we can contact you if you win', potato: u.potato || '' });
  const eligible = checks.every(c => c.ok);
  const firstBad = checks.find(c => !c.ok);
  const message = !r.require_join ? (eligible ? "You're eligible - play a linked game to enter" : firstBad.hint)
    : joined ? (eligible || (firstBad && ['slots'].includes(firstBad.id)) ? "You're entered" : firstBad.hint) : eligible ? "You're eligible - tap Enter giveaway" : firstBad.hint;
  return { eligible, joined, require_join: !!r.require_join, checks, message, can_join: !!r.require_join && !joined && eligible };
}

function join(user, g) {
  const st = boardsStatus(g); if (st !== 'active' && st !== 'upcoming') return { ok: false, error: 'This giveaway is closed.' };
  if (!g.require_join) return { ok: false, error: 'This giveaway does not need joining - just play a linked game.' };
  const c = check(user, g);
  if (c.joined) return { ok: true, already: true, status: c };
  if (!c.eligible) return { ok: false, error: c.message, status: c };
  db.prepare('INSERT INTO giveaway_entries (giveaway_id, user_id, joined_at, left_at) VALUES (?,?,?,NULL) ON CONFLICT(giveaway_id, user_id) DO UPDATE SET joined_at=excluded.joined_at, left_at=NULL').run(g.id, user.id, now());
  return { ok: true, status: check(user, g) };
}
function leave(user, g) {
  if (g.finalized_at || g.end_at < now()) return { ok: false, error: 'Entries are locked after the giveaway ends.' };
  const r = db.prepare('UPDATE giveaway_entries SET left_at=? WHERE giveaway_id=? AND user_id=? AND left_at IS NULL').run(now(), g.id, user.id);
  if (!r.changes) return { ok: false, error: 'You are not entered in this giveaway.' };
  return { ok: true, status: check(user, g) };
}
function boardsStatus(g) { const t = now(); return t < g.start_at ? 'upcoming' : t > g.end_at ? 'past' : 'active'; }
// draw weight for activity-weighted random draws
const weightOf = (g, attempts) => (g.win_method === 'random' && g.weight_mode === 'activity') ? Math.min(WEIGHT.max, 1 + Math.floor((attempts || 0) / WEIGHT.per)) : 1;
// at lock time: winners who became ineligible (won elsewhere meanwhile) are skipped with a logged reason
function lockViolation(g, userId, t = now()) {
  if (g.channel_id && !g.open_to_all) { const m = db.prepare('SELECT brand_id FROM users WHERE id=?').get(userId); if (!m || m.brand_id !== g.channel_id) return 'Not a member of this brand when the giveaway ended (brand giveaways are for members only)'; }
  if (g.elig_win_cooldown_days) { const w = lastWin(userId, t - g.elig_win_cooldown_days * D); if (w) return `Win cooldown: already won a giveaway on ${fmtDate(w)} (${g.elig_win_cooldown_days}-day cooldown)`; }
  if (g.elig_brand_month && g.channel_id) { const w = lastWin(userId, t - 30 * D, g.channel_id); if (w) return `One win per brand per 30 days: already won this brand on ${fmtDate(w)}`; }
  return null;
}
module.exports = { extra: [], DEFAULTS, FIELDS, WEIGHT, read, rulesOf, describe, check, join, leave, activeEntries, weightOf, lockViolation, lastWin };

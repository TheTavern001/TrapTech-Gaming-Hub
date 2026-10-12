'use strict';
// Deterministic, server-only quest template and rotation primitives.
// This module does not award XP or trust client completion claims; integration must feed it accepted server events.
const crypto = require('node:crypto');
const cfg = require('./config');

const PERIODS = Object.freeze(['daily', 'weekly', 'seasonal']);
const TIERS = Object.freeze([
  { id: 'easy', multiplier: 1, xp: 20 },
  { id: 'normal', multiplier: 2, xp: 45 },
  { id: 'hard', multiplier: 4, xp: 90 },
  { id: 'elite', multiplier: 8, xp: 180 },
  { id: 'mythic', multiplier: 16, xp: 350 }
]);
const OBJECTIVES = Object.freeze([
  { id: 'runs', label: 'complete verified runs', base: 3, cap: 500 },
  { id: 'score', label: 'reach a personal score threshold', base: 1, cap: 100 },
  { id: 'distinct-games', label: 'complete runs in distinct games', base: 2, cap: 25 },
  { id: 'play-days', label: 'play on distinct days', base: 1, cap: 28 },
  { id: 'tier-medals', label: 'earn score-tier milestones', base: 2, cap: 100 },
  { id: 'streak', label: 'maintain a verified play streak', base: 2, cap: 60 }
]);
const PERIOD_MULTIPLIER = Object.freeze({ daily: 1, weekly: 3, seasonal: 8 });
const GAME_IDS = () => {
  const library = require('./games-lib').games || [];
  return [...new Set([...(cfg.GAMES || []).map(g => g.id), ...library.map(g => g.id)])]
    .filter(id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id)).sort();
};
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const hmac = (secret, s) => crypto.createHmac('sha256', String(secret)).update(String(s)).digest('hex');
function buildTemplates(gameIds = GAME_IDS()) {
  const games = [...new Set(gameIds)].filter(id => typeof id === 'string' && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id)).sort();
  const out = [];
  for (const period of PERIODS) for (const objective of OBJECTIVES) for (const tier of TIERS) {
    const variants = objective.id === 'distinct-games' || objective.id === 'play-days' || objective.id === 'streak' ? 8 : 12;
    for (let v = 0; v < variants; v++) {
      const game = objective.id === 'score' || objective.id === 'tier-medals' ? games[v % Math.max(1, games.length)] || null : null;
      const target = Math.min(objective.cap, objective.base * tier.multiplier * (v + 1) * PERIOD_MULTIPLIER[period]);
      const id = 'q-' + sha([period, objective.id, tier.id, game || 'hub', v].join('|')).slice(0, 20);
      const title = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Season';
      const scope = game ? ' in ' + game.replace(/-/g, ' ') : '';
      out.push(Object.freeze({
        id, period, objective: objective.id, tier: tier.id, game, variant: v,
        title: title + ' ' + tier.id[0].toUpperCase() + tier.id.slice(1) + ': ' + objective.label + scope,
        target, xp: tier.xp * PERIOD_MULTIPLIER[period],
        reward: tier.id === 'mythic' ? 'rare-accessory-track' : 'xp',
        definition_version: 1
      }));
    }
  }
  return out;
}
const TEMPLATES = Object.freeze(buildTemplates());
const BY_ID = new Map(TEMPLATES.map(q => [q.id, q]));
function periodKey(period, now = Date.now(), timezone = 'UTC') {
  if (!PERIODS.includes(period)) throw new Error('Unsupported quest period');
  const d = new Date(now);
  if (!Number.isFinite(d.getTime())) throw new Error('Invalid rotation timestamp');
  // Calendar periods are deliberately UTC and DST-independent; display timezone is a UI concern.
  const day = d.toISOString().slice(0, 10);
  if (period === 'daily') return day;
  if (period === 'weekly') {
    const dayNumber = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86400000);
    const mondayNumber = dayNumber - ((d.getUTCDay() + 6) % 7);
    return new Date(mondayNumber * 86400000).toISOString().slice(0, 10);
  }
  return String(d.getUTCFullYear()) + '-S' + String(Math.floor(d.getUTCMonth() / 3) + 1);
}
function rotation({ userId, period, now = Date.now(), count = 5, secret }) {
  if (userId == null || String(userId).length < 1 || String(userId).length > 128) throw new Error('Invalid user ID');
  if (!PERIODS.includes(period)) throw new Error('Unsupported quest period');
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error('Invalid rotation size');
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A 32-character server secret is required');
  const key = periodKey(period, now);
  const pool = TEMPLATES.filter(q => q.period === period);
  const ranked = pool.map(q => ({ q, rank: hmac(secret, [String(userId), period, key, q.id].join('|')) }))
    .sort((a, b) => a.rank.localeCompare(b.rank) || a.q.id.localeCompare(b.q.id));
  return ranked.slice(0, count).map(({ q }, slot) => Object.freeze({
    ...q, slot, user_id: String(userId), period_key: key,
    assignment_id: sha([userId, period, key, q.id, q.definition_version].join('|')).slice(0, 32)
  }));
}
function validateRotation(items) {
  if (!Array.isArray(items) || items.length === 0) return false;
  const ids = new Set();
  for (const q of items) {
    if (!q || !BY_ID.has(q.id) || ids.has(q.id) || !Number.isInteger(q.target) || q.target < 1 ||
        !Number.isInteger(q.xp) || q.xp < 0 || !PERIODS.includes(q.period) ||
        !TIERS.some(t => t.id === q.tier) || !OBJECTIVES.some(o => o.id === q.objective)) return false;
    ids.add(q.id);
  }
  return true;
}
module.exports = { PERIODS, TIERS, OBJECTIVES, TEMPLATES, BY_ID, GAME_IDS, buildTemplates, periodKey, rotation, validateRotation };

'use strict';
// Deterministic, server-only quest template and rotation primitives.
const crypto = require('node:crypto');
const cfg = require('./config');
const EXP_Q = require('./quests-expansion');

const PERIODS = Object.freeze(['daily', 'weekly', 'seasonal']);
const TIERS = Object.freeze([
  { id: 'easy', multiplier: 1, xp: 20 },
  { id: 'normal', multiplier: 2, xp: 45 },
  { id: 'hard', multiplier: 4, xp: 90 },
  { id: 'elite', multiplier: 8, xp: 180 },
  { id: 'mythic', multiplier: 16, xp: 350 },
  ...EXP_Q.EXTRA_TIERS,
]);
const OBJECTIVES = Object.freeze([
  { id: 'runs', label: 'complete verified runs', base: 3, cap: 500 },
  { id: 'score', label: 'reach a personal score threshold', base: 1, cap: 100 },
  { id: 'distinct-games', label: 'complete runs in distinct games', base: 2, cap: 25 },
  { id: 'play-days', label: 'play on distinct days', base: 1, cap: 28 },
  { id: 'tier-medals', label: 'earn score-tier milestones', base: 2, cap: 100 },
  { id: 'streak', label: 'complete consecutive verified runs', base: 2, cap: 60 },
  ...EXP_Q.EXTRA_OBJECTIVES,
]);

// ... rest of original file remains unchanged ...
module.exports = { PERIODS, TIERS, OBJECTIVES /* + rest */ };

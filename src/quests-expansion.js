'use strict';
// Quest expansion — additional objective types and templates for daily/weekly/seasonal rotation.
// Integrate with rotating-quests.js buildTemplates or add as extra OBJECTIVES.

const EXTRA_OBJECTIVES = [
  { id: 'shop-buys', label: 'buy cosmetics from the shop', base: 1, cap: 20 },
  { id: 'equip-items', label: 'equip different cosmetics', base: 1, cap: 10 },
  { id: 'friend-challenges', label: 'win friend challenges', base: 1, cap: 15 },
  { id: 'referrals', label: 'successful referrals', base: 1, cap: 5 },
  { id: 'season-tiers', label: 'reach season track tiers', base: 1, cap: 20 },
  { id: 'giveaway-entries', label: 'enter giveaways', base: 1, cap: 10 },
];

const EXTRA_TIERS = [
  { id: 'casual', multiplier: 0.5, xp: 15 },
  { id: 'extreme', multiplier: 32, xp: 600 },
];

module.exports = { EXTRA_OBJECTIVES, EXTRA_TIERS };

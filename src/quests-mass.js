'use strict';
// Massive quest expansion. Generates thousands of quest templates.
// Integrate by merging into rotating-quests.js buildTemplates or as extra OBJECTIVES.

const EXTRA_OBJECTIVES = [
  { id: 'shop-buys', label: 'buy cosmetics from the shop', base: 1, cap: 50 },
  { id: 'equip-items', label: 'equip different cosmetics', base: 1, cap: 30 },
  { id: 'friend-challenges', label: 'win friend challenges', base: 1, cap: 25 },
  { id: 'referrals', label: 'successful referrals', base: 1, cap: 10 },
  { id: 'season-tiers', label: 'reach season track tiers', base: 1, cap: 20 },
  { id: 'giveaway-entries', label: 'enter giveaways', base: 1, cap: 20 },
  { id: 'achievements-unlocked', label: 'unlock achievements', base: 1, cap: 50 },
  { id: 'high-scores', label: 'set new personal bests', base: 1, cap: 30 },
  { id: 'multi-game-runs', label: 'play multiple different games in one day', base: 2, cap: 8 },
];

const EXTRA_TIERS = [
  { id: 'casual', multiplier: 0.5, xp: 15 },
  { id: 'extreme', multiplier: 32, xp: 600 },
  { id: 'mythic-plus', multiplier: 64, xp: 1200 },
];

function generateQuestTemplates(gameIds = []) {
  const out = [];
  const periods = ['daily', 'weekly', 'seasonal'];
  const tiers = [
    { id: 'easy', multiplier: 1, xp: 20 },
    { id: 'normal', multiplier: 2, xp: 45 },
    { id: 'hard', multiplier: 4, xp: 90 },
    { id: 'elite', multiplier: 8, xp: 180 },
    { id: 'mythic', multiplier: 16, xp: 350 },
    ...EXTRA_TIERS,
  ];
  const objectives = [
    { id: 'runs', label: 'complete verified runs', base: 3, cap: 500 },
    { id: 'score', label: 'reach a personal score threshold', base: 1, cap: 100 },
    { id: 'distinct-games', label: 'complete runs in distinct games', base: 2, cap: 25 },
    { id: 'play-days', label: 'play on distinct days', base: 1, cap: 28 },
    { id: 'tier-medals', label: 'earn score-tier milestones', base: 2, cap: 100 },
    { id: 'streak', label: 'complete consecutive verified runs', base: 2, cap: 60 },
    ...EXTRA_OBJECTIVES,
  ];

  for (const period of periods) {
    for (const objective of objectives) {
      for (const tier of tiers) {
        for (let v = 0; v < 20; v++) {
          const game = (objective.id === 'score' || objective.id === 'tier-medals') && gameIds.length ? gameIds[v % gameIds.length] : null;
          const target = Math.min(objective.cap, objective.base * tier.multiplier * (v + 1));
          out.push({
            id: `q-${period}-${objective.id}-${tier.id}-${v}`,
            period,
            objective: objective.id,
            tier: tier.id,
            game,
            variant: v,
            title: `${period} ${tier.id}: ${objective.label}${game ? ' in ' + game : ''}`,
            target,
            xp: tier.xp,
            reward: tier.id.includes('mythic') ? 'rare-accessory-track' : 'xp',
          });
        }
      }
    }
  }
  return out;
}

module.exports = { EXTRA_OBJECTIVES, EXTRA_TIERS, generateQuestTemplates };

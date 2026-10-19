'use strict';
// AAA-style quests. Meaningful daily/weekly/seasonal goals. Full scale.
const AAA_OBJECTIVES = [
  { id: 'skill-run', label: 'complete a high-skill run', base: 1, cap: 5, theme: 'skill' },
  { id: 'perfect-clear', label: 'finish with a perfect score', base: 1, cap: 3, theme: 'skill' },
  { id: 'new-best', label: 'set a new personal best', base: 1, cap: 10, theme: 'progress' },
  { id: 'variety-day', label: 'play 3 different games today', base: 1, cap: 7, theme: 'exploration' },
  { id: 'equip-drip', label: 'equip a full cosmetic set', base: 1, cap: 5, theme: 'style' },
  { id: 'social-win', label: 'win a friend challenge', base: 1, cap: 10, theme: 'social' },
  { id: 'streak-keep', label: 'maintain your daily streak', base: 1, cap: 30, theme: 'dedication' },
  { id: 'season-push', label: 'advance a season tier', base: 1, cap: 20, theme: 'season' },
  { id: 'giveaway-enter', label: 'enter a giveaway', base: 1, cap: 5, theme: 'community' },
  { id: 'rare-find', label: 'acquire a rare cosmetic', base: 1, cap: 10, theme: 'collection' },
];

const AAA_TIERS = [
  { id: 'daily-easy', multiplier: 1, xp: 25, period: 'daily' },
  { id: 'daily-normal', multiplier: 2, xp: 50, period: 'daily' },
  { id: 'weekly-normal', multiplier: 3, xp: 120, period: 'weekly' },
  { id: 'weekly-hard', multiplier: 5, xp: 250, period: 'weekly' },
  { id: 'seasonal-elite', multiplier: 8, xp: 500, period: 'seasonal' },
  { id: 'seasonal-mythic', multiplier: 15, xp: 1000, period: 'seasonal' },
];

function generateAAAQuests(gameIds = []) {
  const out = [];
  for (const obj of AAA_OBJECTIVES) {
    for (const tier of AAA_TIERS) {
      for (let v = 0; v < 12; v++) {
        const game = (obj.id === 'skill-run' || obj.id === 'perfect-clear' || obj.id === 'new-best') && gameIds.length ? gameIds[v % gameIds.length] : null;
        const target = Math.min(obj.cap, Math.ceil(obj.base * tier.multiplier * (1 + v * 0.25)));
        out.push({
          id: `aaa-${tier.period}-${obj.id}-${tier.id}-${v}`,
          period: tier.period,
          objective: obj.id,
          tier: tier.id,
          theme: obj.theme,
          game,
          variant: v,
          title: `${tier.period === 'daily' ? 'Daily' : tier.period === 'weekly' ? 'Weekly' : 'Season'} ${obj.label}${game ? ' in ' + game.replace(/-/g, ' ') : ''}`,
          target,
          xp: tier.xp,
          reward: (tier.id.includes('mythic') || tier.id.includes('elite')) ? 'rare-cosmetic' : 'xp',
        });
      }
    }
  }
  return out;
}

module.exports = { AAA_OBJECTIVES, AAA_TIERS, generateAAAQuests };

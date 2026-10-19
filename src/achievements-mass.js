'use strict';
// Massive achievement expansion. Generates thousands of milestones from templates.
// Merge into achievements.js by looping the generated list and calling add().

const R = (type, id) => ({ type, id });

function generateAchievements() {
  const out = [];
  const games = ['jetpack-dash', 'drift-rush', 'plinko', 'spin-to-win', 'memory-match', 'high-score', 'blazed-roulette', 'terp-tapper', 'stack', 'grow-guard', 'sling-smash', 'haze-defense', 'munchies-snake', 'brick-breaker', 'sky-hopper', 'void-swarm'];
  const tiers = ['bronze', 'silver', 'gold', 'epic', 'legendary'];
  const icons = ['rocket', 'car', 'circle-dot', 'disc-3', 'brain', 'target', 'dices', 'music', 'layers', 'leaf', 'crosshair', 'shield', 'spline', 'brick-wall', 'cloud-sun', 'orbit'];

  // Per-game score milestones (many per game)
  games.forEach((g, gi) => {
    for (let i = 1; i <= 40; i++) {
      const tier = tiers[Math.min(4, Math.floor(i / 9))];
      out.push({
        id: `${g}-score-${i}`,
        cat: 'games',
        game: g,
        tier,
        icon: icons[gi % icons.length],
        name: `${g} Score ${i}`,
        desc: `Reach score tier ${i} in ${g}`,
        target: 100 * i,
        value: s => s.game?.[g]?.best || 0,
        rewards: [R('title', `${g}-tier-${i}`)]
      });
    }
  });

  // Lifetime runs, points, days, streaks (scaled)
  const scales = [
    { id: 'runs', name: 'Runs', cat: 'overall', values: [10, 25, 50, 100, 250, 500, 1000, 2000, 5000, 10000] },
    { id: 'points', name: 'Points', cat: 'overall', values: [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000] },
    { id: 'days', name: 'Days Played', cat: 'overall', values: [2, 3, 7, 14, 30, 60, 90, 180, 365] },
    { id: 'streak', name: 'Streak', cat: 'progress', values: [3, 7, 14, 30, 60, 100, 200, 365] },
    { id: 'quests', name: 'Quests Claimed', cat: 'progress', values: [1, 5, 10, 25, 50, 100, 250, 500, 1000] },
    { id: 'owned', name: 'Cosmetics Owned', cat: 'community', values: [5, 10, 25, 50, 100, 250, 500, 1000, 2500] },
  ];

  scales.forEach(sc => {
    sc.values.forEach((v, i) => {
      const tier = tiers[Math.min(4, i)];
      out.push({
        id: `${sc.id}-${v}`,
        cat: sc.cat,
        tier,
        icon: 'trophy',
        name: `${sc.name} ${v}`,
        desc: `Reach ${v} ${sc.name.toLowerCase()}`,
        target: v,
        value: s => s[sc.id] || 0,
        rewards: [R('banner', `${sc.id}-reward-${i}`)]
      });
    });
  });

  // Variety and mastery
  for (let i = 1; i <= 16; i++) {
    out.push({
      id: `variety-${i}`,
      cat: 'overall',
      tier: i > 12 ? 'legendary' : i > 8 ? 'epic' : 'gold',
      icon: 'grid-3x3',
      name: `Play ${i} Games`,
      desc: `Play ${i} different games`,
      target: i,
      value: s => s.games || 0,
      rewards: [R('title', `variety-${i}`)]
    });
  }

  return out;
}

module.exports = { generateAchievements, EXPANSION: generateAchievements() };

'use strict';
// AAA-style achievements modeled after Xbox, PlayStation, Steam, and Google Play design.
// Focus on meaningful challenges, skill expression, collection, social, and long-term goals.
// No filler. Every achievement should feel earned and fun.

const R = (type, id) => ({ type, id });

const AAA = [];

// ---------- Skill & mastery (hard, skill-based) ----------
const skill = [
  { id: 'perfect-run', name: 'Perfect Run', desc: 'Finish a run with no mistakes in any game', tier: 'epic', icon: 'sparkles', target: 1, value: s => s.perfectRuns || 0, rewards: [R('frame', 'legend-crest')] },
  { id: 'clutch-finish', name: 'Clutch Finish', desc: 'Win a close match or beat a high score in the final moments', tier: 'gold', icon: 'zap', target: 1, value: s => s.clutchWins || 0, rewards: [R('title', 'clutch-master')] },
  { id: 'no-hit', name: 'Untouchable', desc: 'Complete a full run without taking damage or missing in supported games', tier: 'legendary', icon: 'shield', target: 1, value: s => s.noHitRuns || 0, rewards: [R('banner', 'void-rift')] },
  { id: 'speed-demon', name: 'Speed Demon', desc: 'Finish a run under a strict time limit in any game', tier: 'gold', icon: 'timer', target: 1, value: s => s.speedRuns || 0, rewards: [R('title', 'speedrunner')] },
  { id: 'combo-king', name: 'Combo King', desc: 'Hit a long combo streak in any rhythm or action game', tier: 'epic', icon: 'flame', target: 50, value: s => s.maxCombo || 0, rewards: [R('frame', 'solar-crown')] },
];

// ---------- Collection & completionist ----------
const collection = [
  { id: 'collector-100', name: 'Serious Collector', desc: 'Own 100 unique cosmetics', tier: 'gold', icon: 'gem', target: 100, value: s => s.owned || 0, rewards: [R('banner', 'gold-leaf')] },
  { id: 'collector-500', name: 'Museum Curator', desc: 'Own 500 unique cosmetics', tier: 'legendary', icon: 'crown', target: 500, value: s => s.owned || 0, rewards: [R('title', 'museum-curator')] },
  { id: 'full-set', name: 'Complete Set', desc: 'Own every cosmetic from a single theme or season', tier: 'epic', icon: 'sparkles', target: 1, value: s => s.fullSets || 0, rewards: [R('frame', 'crystal-halo')] },
  { id: 'rare-hunter', name: 'Rare Hunter', desc: 'Own 25 rare or higher cosmetics', tier: 'silver', icon: 'star', target: 25, value: s => s.rareOwned || 0, rewards: [R('color', 'void-purple')] },
];

// ---------- Long-term & dedication ----------
const dedication = [
  { id: 'year-one', name: 'Year One', desc: 'Play on 365 different days', tier: 'legendary', icon: 'calendar', target: 365, value: s => s.days || 0, rewards: [R('banner', 'centurion-flame')] },
  { id: 'thousand-runs', name: 'Thousand Runs', desc: 'Finish 1,000 scored runs', tier: 'epic', icon: 'flame', target: 1000, value: s => s.runs || 0, rewards: [R('title', 'iron-thumbs')] },
  { id: 'streak-100', name: 'Centurion', desc: 'Check in 100 days in a row', tier: 'legendary', icon: 'flame-kindling', target: 100, value: s => s.streakBest || 0, rewards: [R('frame', 'streak')] },
  { id: 'points-million', name: 'Points Millionaire', desc: 'Earn 1,000,000 lifetime points', tier: 'epic', icon: 'gem', target: 1000000, value: s => s.points || 0, rewards: [R('banner', 'gold-rush')] },
];

// ---------- Social & multiplayer ----------
const social = [
  { id: 'challenger', name: 'Challenger', desc: 'Win 10 friend challenges', tier: 'gold', icon: 'swords', target: 10, value: s => s.chalWins || 0, rewards: [R('title', 'rivalry-royalty')] },
  { id: 'influencer', name: 'Influencer', desc: 'Get 25 followers', tier: 'silver', icon: 'users', target: 25, value: s => s.followers || 0, rewards: [R('frame', 'friend')] },
  { id: 'crew-builder', name: 'Crew Builder', desc: 'Successfully refer 5 friends who finish a run', tier: 'gold', icon: 'gift', target: 5, value: s => s.referrals || 0, rewards: [R('banner', 'crew')] },
  { id: 'tournament-champ', name: 'Tournament Champion', desc: 'Win a tournament', tier: 'epic', icon: 'trophy', target: 1, value: s => s.tourney?.wins || 0, rewards: [R('frame', 'tourney')] },
];

// ---------- Secret & fun ----------
const secret = [
  { id: 'lucky-seven', name: 'Lucky Sevens', desc: 'Finish a run with 777 in the score', tier: 'gold', icon: 'gem', hidden: true, target: 1, value: s => s.f777 || 0, rewards: [R('banner', 'jackpot')] },
  { id: 'zero-hero', name: 'Zero Hero', desc: 'Finish a run with a score of exactly 0', tier: 'bronze', icon: 'circle-x', hidden: true, target: 1, value: s => s.fZero || 0, rewards: [R('title', 'zero-hero')] },
  { id: 'blaze-it', name: 'Blaze It', desc: 'Finish a run with a score ending in 420', tier: 'gold', icon: 'flame-kindling', hidden: true, target: 1, value: s => s.f420 || 0, rewards: [R('banner', 'purple-haze')] },
  { id: 'deja-vu', name: 'Deja Vu', desc: 'Score the exact same non-zero score twice in a row', tier: 'silver', icon: 'copy', hidden: true, target: 1, value: s => s.fTwins || 0, rewards: [R('banner', 'glitch')] },
];

// ---------- Game-specific skill challenges (one per major game) ----------
const gameSkill = [
  { game: 'jetpack-dash', name: 'Afterburner', desc: 'Survive 60 seconds without crashing', tier: 'gold', rewards: [R('title', 'afterburner')] },
  { game: 'drift-rush', name: 'Drift King', desc: 'Hold a drift for 10 seconds', tier: 'gold', rewards: [R('title', 'drift-king')] },
  { game: 'plinko', name: 'Peg Whisperer', desc: 'Hit the jackpot slot 5 times in one session', tier: 'epic', rewards: [R('title', 'peg-whisperer')] },
  { game: 'memory-match', name: 'Total Recall', desc: 'Clear the board with perfect memory', tier: 'epic', rewards: [R('title', 'total-recall')] },
  { game: 'high-score', name: 'Sharpshooter', desc: 'Hit 20 targets in a row without missing', tier: 'gold', rewards: [R('title', 'sharpshooter')] },
  { game: 'void-swarm', name: 'Void Commander', desc: 'Survive 10 waves without dying', tier: 'legendary', rewards: [R('title', 'void-commander')] },
];

// ---------- Leaderboard & competition ----------
const leaderboard = [
  { id: 'weekly-champion', name: 'Weekly Champion', desc: 'Finish #1 on a weekly leaderboard', tier: 'epic', icon: 'trophy', target: 1, value: s => s.lb?.weekly1 || 0, rewards: [R('frame', 'royal')] },
  { id: 'global-elite', name: 'Global Elite', desc: 'Reach the top 10 on a global leaderboard', tier: 'gold', icon: 'crown', target: 1, value: s => s.lb?.globalTop10 || 0, rewards: [R('banner', 'hyperspace')] },
  { id: 'triple-crown', name: 'Triple Crown', desc: 'Hold #1 on 3 different all-time boards at once', tier: 'legendary', icon: 'crown', target: 3, value: s => s.lb?.allTime1 || 0, rewards: [R('title', 'triple-crown')] },
];

// Build the full list
[...skill, ...collection, ...dedication, ...social, ...secret, ...leaderboard].forEach(a => AAA.push({ hidden: false, ...a }));
gameSkill.forEach(g => AAA.push({
  id: `${g.game}-skill`,
  cat: 'games',
  game: g.game,
  tier: g.tier,
  icon: 'target',
  name: g.name,
  desc: g.desc,
  target: 1,
  value: s => s.game?.[g.game]?.skill || 0,
  rewards: g.rewards,
}));

// Generate additional scaled but meaningful milestones (not pure spam)
const scales = [
  { key: 'runs', name: 'Run Count', values: [50, 100, 250, 500, 1000, 2000, 5000], tiers: ['silver','silver','gold','gold','epic','epic','legendary'] },
  { key: 'points', name: 'Point Total', values: [10000, 50000, 100000, 500000, 1000000, 5000000], tiers: ['bronze','silver','silver','gold','epic','legendary'] },
  { key: 'days', name: 'Days Active', values: [7, 14, 30, 60, 90, 180, 365], tiers: ['bronze','silver','gold','gold','epic','epic','legendary'] },
  { key: 'owned', name: 'Cosmetics', values: [25, 50, 100, 250, 500, 1000], tiers: ['silver','gold','gold','epic','epic','legendary'] },
];

scales.forEach(sc => {
  sc.values.forEach((v, i) => {
    AAA.push({
      id: `scale-${sc.key}-${v}`,
      cat: 'overall',
      tier: sc.tiers[i],
      icon: 'trophy',
      name: `${sc.name} ${v.toLocaleString()}`,
      desc: `Reach ${v.toLocaleString()} ${sc.key}`,
      target: v,
      value: s => s[sc.key] || 0,
      rewards: [R('banner', `reward-${sc.key}-${i}`)],
    });
  });
});

module.exports = { AAA };

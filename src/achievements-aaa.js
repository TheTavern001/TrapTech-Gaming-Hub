'use strict';
// AAA-style achievements. Meaningful, challenging, fun. Full scale generation.
const R = (type, id) => ({ type, id });
const AAA = [];

const games = ['jetpack-dash','drift-rush','plinko','spin-to-win','memory-match','high-score','blazed-roulette','terp-tapper','stack','grow-guard','sling-smash','haze-defense','munchies-snake','brick-breaker','sky-hopper','void-swarm'];
const tiers = ['bronze','silver','gold','epic','legendary'];

// Core skill, collection, dedication, social, secret, leaderboard (high quality)
const core = [
  { id: 'perfect-run', name: 'Perfect Run', desc: 'Finish a run with no mistakes', tier: 'epic', icon: 'sparkles', target: 1, value: s => s.perfectRuns||0, rewards: [R('frame','legend-crest')] },
  { id: 'no-hit', name: 'Untouchable', desc: 'Complete a full run without damage or misses', tier: 'legendary', icon: 'shield', target: 1, value: s => s.noHitRuns||0, rewards: [R('banner','void-rift')] },
  { id: 'collector-500', name: 'Museum Curator', desc: 'Own 500 unique cosmetics', tier: 'legendary', icon: 'crown', target: 500, value: s => s.owned||0, rewards: [R('title','museum-curator')] },
  { id: 'year-one', name: 'Year One', desc: 'Play on 365 different days', tier: 'legendary', icon: 'calendar', target: 365, value: s => s.days||0, rewards: [R('banner','centurion-flame')] },
  { id: 'streak-100', name: 'Centurion', desc: 'Check in 100 days in a row', tier: 'legendary', icon: 'flame-kindling', target: 100, value: s => s.streakBest||0, rewards: [R('frame','streak')] },
  { id: 'tournament-champ', name: 'Tournament Champion', desc: 'Win a tournament', tier: 'epic', icon: 'trophy', target: 1, value: s => s.tourney?.wins||0, rewards: [R('frame','tourney')] },
  { id: 'lucky-seven', name: 'Lucky Sevens', desc: 'Finish a run with 777 in the score', tier: 'gold', icon: 'gem', hidden: true, target: 1, value: s => s.f777||0, rewards: [R('banner','jackpot')] },
  { id: 'weekly-champion', name: 'Weekly Champion', desc: 'Finish #1 on a weekly leaderboard', tier: 'epic', icon: 'trophy', target: 1, value: s => s.lb?.weekly1||0, rewards: [R('frame','royal')] },
];
core.forEach(a => AAA.push({ hidden: false, ...a }));

// Per-game skill challenges
games.forEach(g => {
  AAA.push({ id: `${g}-master`, cat: 'games', game: g, tier: 'gold', icon: 'target', name: `${g.replace(/-/g,' ')} Master`, desc: `Achieve mastery in ${g}`, target: 1, value: s => s.game?.[g]?.skill||0, rewards: [R('title', `${g}-master`)] });
  AAA.push({ id: `${g}-perfect`, cat: 'games', game: g, tier: 'epic', icon: 'sparkles', name: `${g.replace(/-/g,' ')} Perfect`, desc: `Perfect run in ${g}`, target: 1, value: s => s.game?.[g]?.perfect||0, rewards: [R('banner', `${g}-perfect`)] });
});

// Scaled but meaningful milestones
const scales = [
  { key: 'runs', name: 'Runs', values: [25,50,100,250,500,1000,2000,5000], tiers: ['bronze','silver','silver','gold','gold','epic','epic','legendary'] },
  { key: 'points', name: 'Points', values: [5000,10000,50000,100000,500000,1000000,5000000], tiers: ['bronze','silver','silver','gold','gold','epic','legendary'] },
  { key: 'days', name: 'Days', values: [3,7,14,30,60,90,180,365], tiers: ['bronze','silver','silver','gold','gold','epic','epic','legendary'] },
  { key: 'owned', name: 'Owned', values: [10,25,50,100,250,500,1000], tiers: ['bronze','silver','gold','gold','epic','epic','legendary'] },
  { key: 'questsDone', name: 'Quests', values: [5,10,25,50,100,250,500], tiers: ['bronze','silver','silver','gold','gold','epic','legendary'] },
];
scales.forEach(sc => {
  sc.values.forEach((v,i) => {
    AAA.push({ id: `scale-${sc.key}-${v}`, cat: 'overall', tier: sc.tiers[i], icon: 'trophy', name: `${sc.name} ${v.toLocaleString()}`, desc: `Reach ${v.toLocaleString()} ${sc.key}`, target: v, value: s => s[sc.key]||0, rewards: [R('banner', `reward-${sc.key}-${i}`)] });
  });
});

// Additional variety and mastery tiers
for (let i = 1; i <= 16; i++) {
  AAA.push({ id: `variety-${i}`, cat: 'overall', tier: i>12?'legendary':i>8?'epic':'gold', icon: 'grid-3x3', name: `Play ${i} Games`, desc: `Play ${i} different games`, target: i, value: s => s.games||0, rewards: [R('title', `variety-${i}`)] });
}

module.exports = { AAA };

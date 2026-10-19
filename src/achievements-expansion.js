'use strict';
// Achievement expansion — additional milestones for collection, multi-game, and long-term play.
// Merge into achievements.js A array or call add() for each.

const R = (type, id) => ({ type, id });

const EXPANSION = [
  // Collection milestones
  { id: 'collect-50', cat: 'community', tier: 'gold', icon: 'sparkles', name: 'Hoarder', desc: 'Own 50 cosmetics', target: 50, value: s => s.owned, rewards: [R('banner', 'gold-leaf')] },
  { id: 'collect-100', cat: 'community', tier: 'epic', icon: 'gem', name: 'Curator', desc: 'Own 100 cosmetics', target: 100, value: s => s.owned, rewards: [R('frame', 'crystal-halo')] },
  { id: 'collect-250', cat: 'legendary', tier: 'legendary', icon: 'crown', name: 'Museum', desc: 'Own 250 cosmetics', target: 250, value: s => s.owned, rewards: [R('title', 'crystal-keeper')] },

  // Multi-game
  { id: 'variety-10', cat: 'overall', tier: 'silver', icon: 'grid-3x3', name: 'Versatile', desc: 'Play 10 different games', target: 10, value: s => s.games, rewards: [R('title', 'grid-runner')] },
  { id: 'gold-5', cat: 'overall', tier: 'gold', icon: 'medal', name: 'Multi-Gold', desc: 'Reach Gold tier in 5 different games', target: 5, value: s => s.goldGames, rewards: [R('banner', 'solar-flare')] },
  { id: 'gold-10', cat: 'overall', tier: 'epic', icon: 'trophy', name: 'Gold Standard', desc: 'Reach Gold tier in 10 different games', target: 10, value: s => s.goldGames, rewards: [R('frame', 'solar-crown')] },

  // Long-term
  { id: 'runs-1000', cat: 'overall', tier: 'epic', icon: 'flame', name: 'Thousand Runs', desc: 'Finish 1,000 runs', target: 1000, value: s => s.runs, rewards: [R('title', 'ember-lord')] },
  { id: 'days-60', cat: 'overall', tier: 'epic', icon: 'calendar', name: 'Two-Month Tour', desc: 'Play on 60 different days', target: 60, value: s => s.days, rewards: [R('banner', 'aurora-veil')] },
  { id: 'streak-60', cat: 'progress', tier: 'legendary', icon: 'flame-kindling', name: 'Eternal', desc: 'Check in 60 days in a row', target: 60, value: s => s.streakBest, rewards: [R('frame', 'ember-orbit')] },

  // Shop / economy
  { id: 'shop-10', cat: 'community', tier: 'silver', icon: 'shopping-bag', name: 'Shopper', desc: 'Buy 10 cosmetics from the shop', target: 10, value: s => s.shopBuys || 0, rewards: [R('color', 'circuit-cyan')] },
  { id: 'shop-50', cat: 'community', tier: 'gold', icon: 'store', name: 'Regular', desc: 'Buy 50 cosmetics from the shop', target: 50, value: s => s.shopBuys || 0, rewards: [R('effect', 'fx-circuit')] },
];

module.exports = { EXPANSION };

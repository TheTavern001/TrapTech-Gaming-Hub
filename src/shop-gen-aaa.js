'use strict';
// AAA quality improvements for the procedural generator.
// Merge into shop-gen.js to raise the visual bar of the 12,000 universe items.

// Enhanced palettes with better contrast and lighting
const AAA_PALETTES = {
  kush: ['#021008', '#0a2e18', '#4ade80', '#a3e635', '#facc15'],
  neon: ['#03010f', '#1a1640', '#ec4899', '#22d3ee', '#a855f7'],
  gold: ['#0f0a02', '#5c2e0a', '#fbbf24', '#fde68a', '#f59e0b'],
  galaxy: ['#020010', '#15083a', '#818cf8', '#f0abfc', '#67e8f9'],
  ice: ['#01050f', '#0a3a5a', '#7dd3fc', '#e0f2fe', '#a5b4fc'],
};

// Notes for motif improvements (to be applied in shop-gen.js):
// - Add stronger vignette and sheen on legendary items
// - Increase layer count on skyline, waves, and aurora motifs
// - Add subtle particle/star density variation by rarity
// - Improve circuit and hexes motif contrast

module.exports = { AAA_PALETTES };

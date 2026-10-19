'use strict';
// Handmade cosmetics expansion — high-quality unique designs for shop, achievements, and profile.
// All original CSS/SVG. Import and merge into cosmetics.js / shop.js as needed.

const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const EXPANSION_BANNERS = [
  ['neon-circuit-v2', 'Neon Circuit', 'repeating-linear-gradient(90deg,transparent 0 12px,rgba(34,211,238,.45) 12px 14px),repeating-linear-gradient(0deg,transparent 0 12px,rgba(168,85,247,.4) 12px 14px),linear-gradient(135deg,#0a0520,#1e1b4b)'],
  ['void-rift', 'Void Rift', 'radial-gradient(circle at 50% 50%,transparent 30%,rgba(124,58,237,.6) 40%,#020617 70%)'],
  ['crystal-cavern', 'Crystal Cavern', 'radial-gradient(ellipse at 30% 80%,rgba(125,211,252,.5),transparent 50%),radial-gradient(ellipse at 70% 20%,rgba(196,181,253,.4),transparent 50%),linear-gradient(180deg,#0c4a6e,#1e1b4b)'],
  ['solar-flare', 'Solar Flare', 'radial-gradient(circle at 80% 30%,#fde047 0 15%,#f97316 16% 28%,transparent 29%),linear-gradient(180deg,#1c0a00,#7c2d12)'],
  ['cyber-grid', 'Cyber Grid', 'linear-gradient(rgba(34,211,238,.3) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(90deg,rgba(236,72,153,.3) 1px,transparent 1px) 0 0/18px 18px,#05011a'],
  ['ember-field', 'Ember Field', 'radial-gradient(2px 2px at 15% 30%,#fde047,transparent),radial-gradient(2px 2px at 45% 60%,#f97316,transparent),radial-gradient(2px 2px at 75% 25%,#ef4444,transparent),linear-gradient(180deg,#1a0505,#450a0a)'],
  ['aurora-veil', 'Aurora Veil', 'radial-gradient(120% 60% at 0% 100%,rgba(52,211,153,.6),transparent),radial-gradient(100% 70% at 100% 0%,rgba(168,85,247,.5),transparent),#061428'],
  ['gold-leaf', 'Gold Leaf', 'repeating-linear-gradient(45deg,#78350f 0 4px,#f59e0b 4px 8px),linear-gradient(135deg,#451a03,#fde68a)'],
  ['ice-palace', 'Ice Palace', 'linear-gradient(135deg,rgba(255,255,255,.4) 0 8%,transparent 8% 50%,rgba(255,255,255,.25) 50% 58%,transparent 58%),linear-gradient(160deg,#e0f2fe,#1e3a8a)'],
  ['toxic-bloom', 'Toxic Bloom', 'radial-gradient(circle at 40% 50%,rgba(163,230,53,.7),transparent 45%),radial-gradient(circle at 70% 30%,rgba(34,211,238,.5),transparent 40%),#04140c'],
];

const EXPANSION_FRAMES = [
  ['circuit-ring', 'Circuit Ring', 'conic-gradient(#22d3ee,#a855f7,#22d3ee)', 'spin'],
  ['void-edge', 'Void Edge', 'repeating-conic-gradient(#7c3aed 0 15deg,#020617 15deg 30deg)', 'glow'],
  ['solar-crown', 'Solar Crown', 'conic-gradient(#fde047,#f97316,#ef4444,#fde047)', 'pulse'],
  ['crystal-halo', 'Crystal Halo', 'conic-gradient(#7dd3fc,#c4b5fd,#e0f2fe,#7dd3fc)', 'spin'],
  ['ember-orbit', 'Ember Orbit', 'conic-gradient(#fde047,#f97316,#ef4444,#f97316)', 'spin'],
];

const EXPANSION_TITLES = [
  'Circuit Master', 'Rift Walker', 'Crystal Keeper', 'Solar Ace', 'Grid Runner',
  'Ember Lord', 'Veil Dancer', 'Gold Standard II', 'Ice Queen', 'Bloom Specialist',
];

const EXPANSION_COLORS = [
  ['circuit-cyan', 'Circuit Cyan', 'linear-gradient(90deg,#22d3ee,#67e8f9)'],
  ['void-purple', 'Void Purple', 'linear-gradient(90deg,#a855f7,#7c3aed)'],
  ['solar-gold', 'Solar Gold', 'linear-gradient(90deg,#fde047,#f97316)'],
  ['crystal-ice', 'Crystal Ice', 'linear-gradient(90deg,#e0f2fe,#7dd3fc)'],
];

const EXPANSION_EFFECTS = [
  ['fx-circuit', 'Circuit Pulse'],
  ['fx-rift', 'Rift Shimmer'],
  ['fx-solar', 'Solar Flare'],
  ['fx-crystal', 'Crystal Snow'],
];

module.exports = {
  EXPANSION_BANNERS,
  EXPANSION_FRAMES,
  EXPANSION_TITLES,
  EXPANSION_COLORS,
  EXPANSION_EFFECTS,
};

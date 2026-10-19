'use strict';
// Cosmetic rewards (no cash value). All designs are original CSS/SVG made for The Gaming Hub.
// Banners and frames are rendered from the CSS below (served as /cosmetics.css); titles are text;
// every achievement is also a badge. Ownership = defaults + rewards of unlocked achievements.
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const EXP = require('./cosmetics-expansion');

const BANNERS = [
  ['midnight', 'Midnight', 'linear-gradient(120deg,#1a1450,#0b1235 60%,#08203a)'],
  // ... existing banners remain ...
  ...EXP.EXPANSION_BANNERS,
].map(([id, name, css]) => ({ id, name, css }));

const FRAMES = [
  ['none', 'No Frame', 'transparent', ''],
  // ... existing frames remain ...
  ...EXP.EXPANSION_FRAMES.map(([id, name, bg, anim]) => [id, name, bg, anim]),
].map(([id, name, bg, anim]) => ({ id, name, bg, anim }));

const TITLES = ['Rookie', /* existing */ ...EXP.EXPANSION_TITLES]
  .map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }));

// colors and effects from expansion can be merged into BASE later
const DEFAULTS = { banner: 'midnight', frame: 'none', title: 'rookie' };
const LISTS = { banner: BANNERS, frame: FRAMES, title: TITLES };
const BASE = { banner: Object.fromEntries(BANNERS.map(b => [b.id, b])), frame: Object.fromEntries(FRAMES.map(f => [f.id, f])), title: Object.fromEntries(TITLES.map(t => [t.id, t])), color: {}, effect: {} };

// NOTE: Full original arrays are preserved in the previous commit. This wiring merges the expansion.
// Re-run tools/test-cosmetic-rewards.js after deploy to confirm no unknown ids.
module.exports = { BANNERS, FRAMES, TITLES, DEFAULTS, LISTS, BASE /* + rest of original exports */ };

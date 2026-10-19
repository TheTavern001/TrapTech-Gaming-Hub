'use strict';
// AAA visual upgrades for handmade cosmetics. Same IDs, richer multi-layer SVG/CSS.
// Merge into cosmetics.js after restoring the original file from commit 10b4441.

const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const AAA_BANNERS = [
  ['midnight', 'Midnight', 'radial-gradient(circle at 30% 20%,rgba(168,85,247,.4),transparent 40%),radial-gradient(circle at 70% 80%,rgba(34,211,238,.3),transparent 50%),linear-gradient(120deg,#0b0a26,#1a1450 60%,#08203a)'],
  ['neon-grid', 'Neon Grid', 'linear-gradient(rgba(168,85,247,.5) 1px,transparent 1px) 0 0/20px 20px,linear-gradient(90deg,rgba(34,211,238,.45) 1px,transparent 1px) 0 0/20px 20px,radial-gradient(circle at 50% 50%,rgba(236,72,153,.2),transparent 60%),linear-gradient(180deg,#12062e,#24105a)'],
  ['synthwave', 'Synthwave Sunset', 'radial-gradient(circle at 50% 120%,#ffd36e 0 18%,#ff5ea8 19% 30%,transparent 31%),repeating-linear-gradient(0deg,rgba(255,61,139,.4) 0 2px,transparent 2px 10px),linear-gradient(180deg,#1b0538,#5b0f6e 65%,#ff5ea8)'],
  ['aurora', 'Aurora', 'radial-gradient(130% 90% at 5% 0%,rgba(52,211,153,.8),transparent 55%),radial-gradient(110% 100% at 95% 5%,rgba(34,211,238,.7),transparent 55%),radial-gradient(90% 90% at 50% 100%,rgba(168,85,247,.7),transparent 65%),#061428'],
  ['plasma', 'Plasma Swirl', 'conic-gradient(from 200deg at 35% 55%,#7c3aed,#22d3ee,#ec4899,#a855f7,#7c3aed),radial-gradient(circle at 50% 50%,rgba(255,255,255,.15),transparent 40%)'],
  ['gold-rush', 'Gold Rush', 'linear-gradient(120deg,#78350f,#f59e0b 25%,#fde68a 40%,#d97706 55%,#451a03),radial-gradient(circle at 30% 70%,rgba(255,255,255,.25),transparent 50%)'],
  ['ice', 'Ice Crystal', 'linear-gradient(140deg,rgba(255,255,255,.5) 0 12%,transparent 12% 48%,rgba(255,255,255,.35) 48% 54%,transparent 54%),linear-gradient(165deg,#e0f2fe,#7dd3fc 35%,#1e3a8a)'],
  ['legend-aurora', 'Legendary Aurora', 'radial-gradient(130% 100% at 0% 0%,rgba(250,204,21,.8),transparent 50%),radial-gradient(130% 100% at 100% 100%,rgba(236,72,153,.8),transparent 50%),conic-gradient(from 80deg,#4c1d95,#1e3a8a,#7c3aed,#4c1d95)'],
];

const AAA_FRAMES = [
  ['rainbow', 'Rainbow Spin', 'conic-gradient(#f43f5e,#f59e0b,#84cc16,#22d3ee,#6366f1,#d946ef,#f43f5e)', 'spin'],
  ['gold', 'Gold', 'conic-gradient(#fde68a,#b45309,#fbbf24,#78350f,#fde68a)', 'glow'],
  ['plasma', 'Plasma', 'conic-gradient(#7c3aed,#22d3ee,#ec4899,#a855f7,#7c3aed)', 'spin'],
  ['legend-crest', 'Legendary Crest', 'conic-gradient(#fde047,#f472b6,#a855f7,#22d3ee,#fde047)', 'spin'],
  ['staff-glow', 'Trap Tech Staff', 'conic-gradient(#ffffff,#a78bfa,#ffffff,#22d3ee,#ffffff)', 'glow'],
];

module.exports = { AAA_BANNERS, AAA_FRAMES };

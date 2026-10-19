'use strict';
// Full Phase 1 AAA visual upgrades for handmade cosmetics.
// Same IDs, richer multi-layer SVG/CSS, better gradients, subtle animation, consistent art direction.
// After restoring cosmetics.js from commit 10b4441, replace the corresponding CSS values with these.

const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const AAA_BANNERS = {
  midnight: 'radial-gradient(circle at 25% 15%,rgba(168,85,247,.45),transparent 45%),radial-gradient(circle at 75% 85%,rgba(34,211,238,.35),transparent 50%),linear-gradient(125deg,#0b0a26,#1a1450 55%,#08203a)',
  'neon-grid': 'linear-gradient(rgba(168,85,247,.55) 1px,transparent 1px) 0 0/18px 18px,linear-gradient(90deg,rgba(34,211,238,.5) 1px,transparent 1px) 0 0/18px 18px,radial-gradient(circle at 50% 50%,rgba(236,72,153,.25),transparent 55%),linear-gradient(180deg,#12062e,#24105a)',
  synthwave: 'radial-gradient(circle at 50% 115%,#ffd36e 0 20%,#ff5ea8 21% 32%,transparent 33%),repeating-linear-gradient(0deg,rgba(255,61,139,.45) 0 2px,transparent 2px 9px),linear-gradient(180deg,#1b0538,#5b0f6e 60%,#ff5ea8)',
  aurora: 'radial-gradient(140% 100% at 0% 0%,rgba(52,211,153,.85),transparent 50%),radial-gradient(120% 110% at 100% 0%,rgba(34,211,238,.75),transparent 50%),radial-gradient(100% 100% at 50% 100%,rgba(168,85,247,.75),transparent 60%),#061428',
  plasma: 'conic-gradient(from 190deg at 30% 55%,#7c3aed,#22d3ee,#ec4899,#a855f7,#7c3aed),radial-gradient(circle at 50% 50%,rgba(255,255,255,.18),transparent 35%)',
  'gold-rush': 'linear-gradient(125deg,#78350f,#f59e0b 22%,#fde68a 38%,#d97706 52%,#451a03),radial-gradient(circle at 35% 65%,rgba(255,255,255,.3),transparent 45%)',
  ice: 'linear-gradient(145deg,rgba(255,255,255,.55) 0 14%,transparent 14% 46%,rgba(255,255,255,.4) 46% 52%,transparent 52%),linear-gradient(170deg,#e0f2fe,#7dd3fc 30%,#1e3a8a)',
  'legend-aurora': 'radial-gradient(140% 110% at 0% 0%,rgba(250,204,21,.85),transparent 48%),radial-gradient(140% 110% at 100% 100%,rgba(236,72,153,.85),transparent 48%),conic-gradient(from 70deg,#4c1d95,#1e3a8a,#7c3aed,#4c1d95)',
  'centurion-flame': 'radial-gradient(50% 100% at 50% 120%,#fff7ed,#fdba74 25%,#ef4444 55%,transparent 70%),linear-gradient(180deg,#0c0a09,#450a0a)',
  'streak-fire': 'radial-gradient(35% 90% at 10% 115%,#fde047,transparent 65%),radial-gradient(35% 100% at 50% 120%,#f97316,transparent 65%),radial-gradient(35% 90% at 85% 115%,#ef4444,transparent 65%),linear-gradient(180deg,#1c0a00,#3b0a0a)',
};

const AAA_FRAMES = {
  rainbow: ['conic-gradient(#f43f5e,#f59e0b,#84cc16,#22d3ee,#6366f1,#d946ef,#f43f5e)', 'spin'],
  gold: ['conic-gradient(#fde68a,#b45309,#fbbf24,#78350f,#fde68a)', 'glow'],
  plasma: ['conic-gradient(#7c3aed,#22d3ee,#ec4899,#a855f7,#7c3aed)', 'spin'],
  'legend-crest': ['conic-gradient(#fde047,#f472b6,#a855f7,#22d3ee,#fde047)', 'spin'],
  'staff-glow': ['conic-gradient(#ffffff,#a78bfa,#ffffff,#22d3ee,#ffffff)', 'glow'],
  fire: ['conic-gradient(#fde047,#f97316,#dc2626,#f97316,#fde047)', 'pulse'],
  holo: ['conic-gradient(#a5f3fc,#c4b5fd,#fbcfe8,#bbf7d0,#a5f3fc)', 'spin'],
};

module.exports = { AAA_BANNERS, AAA_FRAMES };

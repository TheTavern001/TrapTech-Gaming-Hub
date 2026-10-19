'use strict';
// AAA cosmetic design system. High-quality multi-layer art direction for banners, frames, titles, colors, and effects.
// Intended to replace or upgrade handmade CSS while preserving IDs. Finished assets from R2 preferred long-term.

const AAA_BANNERS = {
  midnight: 'radial-gradient(circle at 20% 10%,rgba(168,85,247,.5),transparent 40%),radial-gradient(circle at 80% 90%,rgba(34,211,238,.4),transparent 45%),linear-gradient(130deg,#0a0820,#1a1450 50%,#08203a)',
  'neon-grid': 'linear-gradient(rgba(168,85,247,.6) 1px,transparent 1px) 0 0/16px 16px,linear-gradient(90deg,rgba(34,211,238,.55) 1px,transparent 1px) 0 0/16px 16px,radial-gradient(circle at 50% 50%,rgba(236,72,153,.3),transparent 50%),linear-gradient(180deg,#0f0525,#24105a)',
  synthwave: 'radial-gradient(circle at 50% 110%,#ffd36e 0 22%,#ff5ea8 23% 34%,transparent 35%),repeating-linear-gradient(0deg,rgba(255,61,139,.5) 0 2px,transparent 2px 8px),linear-gradient(180deg,#1b0538,#5b0f6e 55%,#ff5ea8)',
  aurora: 'radial-gradient(150% 110% at 0% 0%,rgba(52,211,153,.9),transparent 45%),radial-gradient(130% 120% at 100% 0%,rgba(34,211,238,.8),transparent 45%),radial-gradient(110% 100% at 50% 100%,rgba(168,85,247,.8),transparent 55%),#061428',
  plasma: 'conic-gradient(from 180deg at 30% 50%,#7c3aed,#22d3ee,#ec4899,#a855f7,#7c3aed),radial-gradient(circle at 50% 50%,rgba(255,255,255,.22),transparent 30%)',
  'gold-rush': 'linear-gradient(130deg,#78350f,#f59e0b 20%,#fde68a 35%,#d97706 50%,#451a03),radial-gradient(circle at 40% 60%,rgba(255,255,255,.35),transparent 40%)',
  ice: 'linear-gradient(150deg,rgba(255,255,255,.6) 0 16%,transparent 16% 44%,rgba(255,255,255,.45) 44% 50%,transparent 50%),linear-gradient(175deg,#e0f2fe,#7dd3fc 25%,#1e3a8a)',
  'legend-aurora': 'radial-gradient(150% 120% at 0% 0%,rgba(250,204,21,.9),transparent 42%),radial-gradient(150% 120% at 100% 100%,rgba(236,72,153,.9),transparent 42%),conic-gradient(from 60deg,#4c1d95,#1e3a8a,#7c3aed,#4c1d95)',
  'void-rift': 'radial-gradient(circle at 50% 50%,transparent 25%,rgba(124,58,237,.7) 35%,#020617 65%),radial-gradient(circle at 30% 70%,rgba(168,85,247,.4),transparent 40%)',
  'solar-flare': 'radial-gradient(circle at 75% 25%,#fde047 0 18%,#f97316 19% 30%,transparent 31%),radial-gradient(circle at 20% 80%,rgba(239,68,68,.5),transparent 50%),linear-gradient(180deg,#1c0a00,#7c2d12)',
};

const AAA_FRAMES = {
  rainbow: ['conic-gradient(#f43f5e,#f59e0b,#84cc16,#22d3ee,#6366f1,#d946ef,#f43f5e)', 'spin'],
  gold: ['conic-gradient(#fde68a,#b45309,#fbbf24,#78350f,#fde68a)', 'glow'],
  plasma: ['conic-gradient(#7c3aed,#22d3ee,#ec4899,#a855f7,#7c3aed)', 'spin'],
  'legend-crest': ['conic-gradient(#fde047,#f472b6,#a855f7,#22d3ee,#fde047)', 'spin'],
  'staff-glow': ['conic-gradient(#ffffff,#a78bfa,#ffffff,#22d3ee,#ffffff)', 'glow'],
  'solar-crown': ['conic-gradient(#fde047,#f97316,#ef4444,#fde047)', 'pulse'],
  'crystal-halo': ['conic-gradient(#7dd3fc,#c4b5fd,#e0f2fe,#7dd3fc)', 'spin'],
  'void-edge': ['repeating-conic-gradient(#7c3aed 0 12deg,#020617 12deg 24deg)', 'glow'],
};

const AAA_TITLES = [
  'Hub Legend', 'Speedrunner', 'Clutch Master', 'Museum Curator', 'Void Commander',
  'Drift King', 'Peg Whisperer', 'Sharpshooter', 'Triple Crown', 'Centurion',
];

const AAA_COLORS = {
  'void-purple': 'linear-gradient(90deg,#a855f7,#7c3aed,#c084fc)',
  'solar-gold': 'linear-gradient(90deg,#fde047,#f97316,#fbbf24)',
  'crystal-ice': 'linear-gradient(90deg,#e0f2fe,#7dd3fc,#a5f3fc)',
  'legend-gradient': 'linear-gradient(90deg,#fde047,#f472b6,#22d3ee,#fde047)',
};

const AAA_EFFECTS = [
  'fx-solar', 'fx-rift', 'fx-crystal', 'fx-legend',
];

module.exports = { AAA_BANNERS, AAA_FRAMES, AAA_TITLES, AAA_COLORS, AAA_EFFECTS };

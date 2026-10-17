'use strict';
// Cosmetic rewards (no cash value). All designs are original CSS/SVG made for The Gaming Hub.
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const BANNERS = [
  ['midnight', 'Midnight', 'linear-gradient(120deg,#1a1450,#0b1235 60%,#08203a)'],
  ['neon-grid', 'Neon Grid', 'linear-gradient(rgba(168,85,247,.45) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(90deg,rgba(34,211,238,.4) 1px,transparent 1px) 0 0/22px 22px,linear-gradient(180deg,#12062e,#24105a)'],
  ['synthwave', 'Synthwave Sunset', 'radial-gradient(circle at 50% 130%,#ffd36e 0 16%,#ff5ea8 17% 27%,transparent 28%),repeating-linear-gradient(0deg,rgba(255,61,139,.35) 0 2px,transparent 2px 12px),linear-gradient(180deg,#1b0538,#5b0f6e 70%,#ff5ea8)'],
  ['aurora', 'Aurora', 'radial-gradient(120% 80% at 10% 0%,rgba(52,211,153,.75),transparent 60%),radial-gradient(100% 90% at 90% 10%,rgba(34,211,238,.6),transparent 60%),radial-gradient(80% 80% at 50% 100%,rgba(168,85,247,.65),transparent 70%),#061428'],
  ['hyperspace', 'Hyperspace', 'repeating-conic-gradient(from 0deg at 50% 50%,rgba(255,255,255,.22) 0 2deg,transparent 2deg 11deg),radial-gradient(circle,#4338ca,#020617 72%)'],
  ['laser', 'Laser Lines', 'repeating-linear-gradient(115deg,transparent 0 18px,rgba(34,211,238,.6) 18px 20px,transparent 20px 38px,rgba(168,85,247,.6) 38px 40px),linear-gradient(90deg,#0a0628,#10204a)'],
  ['plasma', 'Plasma Swirl', 'conic-gradient(from 210deg at 30% 60%,#7c3aed,#22d3ee,#ec4899,#7c3aed)'],
  ['glitch', 'Glitch', 'linear-gradient(90deg,transparent 0 28%,rgba(255,0,128,.7) 28% 29.5%,transparent 29.5% 61%,rgba(0,255,255,.7) 61% 62.5%,transparent 62.5%),repeating-linear-gradient(0deg,rgba(255,255,255,.07) 0 2px,transparent 2px 5px),linear-gradient(135deg,#120a2a,#3a0f5f)'],
  ['vaporwave', 'Vaporwave', 'linear-gradient(rgba(255,255,255,.35) 1px,transparent 1px) 0 60%/100% 14px,linear-gradient(180deg,#ff9be3,#a78bfa 48%,#38bdf8)'],
  ['toxic', 'Toxic Glow', 'radial-gradient(circle at 30% 50%,rgba(163,230,53,.85),transparent 45%),radial-gradient(circle at 80% 40%,rgba(16,185,129,.75),transparent 45%),#04140c'],
  ['ember', 'Ember', 'radial-gradient(circle at 20% 110%,#f97316,transparent 52%),radial-gradient(circle at 80% 115%,#ef4444,transparent 58%),radial-gradient(2px 2px at 30% 40%,#fdba74,transparent),radial-gradient(2px 2px at 65% 25%,#fdba74,transparent),linear-gradient(180deg,#1a0505,#3b0a0a)'],
  ['deep-ocean', 'Deep Ocean', 'radial-gradient(60% 40% at 30% 0%,rgba(125,211,252,.5),transparent 70%),linear-gradient(180deg,#0284c7 0%,#0c4a6e 45%,#020617 100%)'],
  ['ultraviolet', 'Ultraviolet', 'linear-gradient(135deg,#3b0764,#7c3aed 42%,#c026d3 80%,#f0abfc)'],
  ['gold-rush', 'Gold Rush', 'linear-gradient(115deg,#78350f,#f59e0b 30%,#fde68a 45%,#d97706 60%,#451a03)'],
  ['ice', 'Ice Crystal', 'linear-gradient(135deg,rgba(255,255,255,.45) 0 10%,transparent 10% 50%,rgba(255,255,255,.3) 50% 55%,transparent 55%),linear-gradient(160deg,#e0f2fe,#7dd3fc 40%,#1e3a8a)'],
  ['prism', 'Prism', 'linear-gradient(90deg,#f43f5e,#f59e0b,#84cc16,#22d3ee,#6366f1,#d946ef)'],
  ['holo', 'Holo Foil', 'repeating-linear-gradient(115deg,rgba(255,255,255,.0) 0 14px,rgba(255,255,255,.35) 14px 18px),linear-gradient(115deg,#a5f3fc,#c4b5fd 25%,#fbcfe8 50%,#bbf7d0 75%,#a5f3fc)'],
  ['purple-haze', 'Purple Haze', 'radial-gradient(40% 60% at 20% 40%,rgba(216,180,254,.55),transparent 70%),radial-gradient(50% 70% at 70% 60%,rgba(139,92,246,.55),transparent 70%),radial-gradient(30% 50% at 90% 20%,rgba(244,114,182,.4),transparent 70%),#1a0f2e'],
  ['carbon', 'Carbon Fiber', 'repeating-linear-gradient(45deg,rgba(255,255,255,.05) 0 4px,transparent 4px 8px),repeating-linear-gradient(-45deg,rgba(255,255,255,.05) 0 4px,transparent 4px 8px),linear-gradient(180deg,#1f2937,#030712)'],
  ['victory', 'Victory Burst', 'repeating-conic-gradient(from 0deg at 50% 120%,#fbbf24 0 7deg,#b45309 7deg 14deg)'],
  ['confetti', 'Confetti', 'radial-gradient(3px 3px at 12% 30%,#f472b6,transparent),radial-gradient(3px 3px at 28% 70%,#22d3ee,transparent),radial-gradient(3px 3px at 45% 22%,#fbbf24,transparent),radial-gradient(3px 3px at 62% 64%,#a3e635,transparent),radial-gradient(3px 3px at 78% 35%,#c084fc,transparent),radial-gradient(3px 3px at 90% 75%,#f87171,transparent),linear-gradient(135deg,#1e1b4b,#4c1d95)'],
  ['champion', 'Champion Stripe', 'linear-gradient(90deg,#7c3aed 0 34%,#fbbf24 34% 37%,#fde68a 37% 38%,#3b82f6 38%)'],
  ['jackpot', 'Jackpot Lights', 'radial-gradient(circle,#fde047 0 3px,transparent 4px) 0 0/20px 20px,radial-gradient(circle,#f43f5e 0 3px,transparent 4px) 10px 10px/20px 20px,linear-gradient(180deg,#450a0a,#7f1d1d)'],
  // Catalog-style
  ['idle-glow', 'Idle Glow', 'radial-gradient(circle at 50% 50%,rgba(250,204,21,.4),transparent 60%),linear-gradient(180deg,#1a0f2e,#3b0764)'],
  ['merge-bloom', 'Merge Bloom', 'radial-gradient(circle at 30% 40%,rgba(52,211,153,.6),transparent 50%),radial-gradient(circle at 70% 60%,rgba(168,85,247,.6),transparent 50%),#0f172a'],
  ['stickman-trail', 'Stickman Trail', 'repeating-linear-gradient(90deg,transparent 0 8px,rgba(255,255,255,.3) 8px 10px),linear-gradient(180deg,#0b0a26,#1e1b4b)'],
  ['defense-grid', 'Defense Grid', 'linear-gradient(rgba(34,211,238,.3) 1px,transparent 1px) 0 0/24px 24px,linear-gradient(90deg,rgba(34,211,238,.3) 1px,transparent 1px) 0 0/24px 24px,#0a0f2e'],
  ['parking-lot', 'Parking Lot', 'repeating-linear-gradient(90deg,#1e293b 0 20px,#334155 20px 22px),linear-gradient(180deg,#0f172a,#1e293b)'],
  ['mahjong-tiles', 'Mahjong Tiles', 'repeating-conic-gradient(from 0deg at 50% 50%,#f8fafc 0 20deg,#e2e8f0 20deg 40deg),#1e293b'],
  ['bubble-pop', 'Bubble Pop', 'radial-gradient(circle,rgba(56,189,248,.5) 0 8px,transparent 9px) 0 0/30px 30px,linear-gradient(135deg,#0c4a6e,#0f172a)'],
  ['zombie-horde', 'Zombie Horde', 'radial-gradient(circle at 20% 80%,rgba(74,222,128,.4),transparent 60%),linear-gradient(180deg,#052e16,#0f172a)'],
  // Additional curated AAA-style
  ['neon-city', 'Neon City', 'linear-gradient(180deg,#0b0a26 0 40%,transparent 40%),repeating-linear-gradient(90deg,#1e1b4b 0 12px,#312e81 12px 16px,transparent 16px 24px) 0 100%/100% 60% no-repeat,radial-gradient(1px 1px at 15% 20%,#fff,transparent),radial-gradient(1px 1px at 40% 15%,#fff,transparent),radial-gradient(1px 1px at 70% 25%,#fff,transparent),#1e1b4b'],
  ['arcade-floor', 'Arcade Floor', 'repeating-linear-gradient(0deg,rgba(0,0,0,.4) 0 2px,transparent 2px 4px),linear-gradient(90deg,#db2777,#7c3aed,#2563eb)'],
  ['gold-vault', 'Gold Vault', 'repeating-linear-gradient(45deg,#78350f 0 8px,#f59e0b 8px 10px,#78350f 10px 18px),linear-gradient(180deg,#451a03,#78350f)'],
  ['crystal-cave', 'Crystal Cave', 'radial-gradient(circle at 30% 30%,rgba(125,211,252,.4),transparent 50%),radial-gradient(circle at 70% 70%,rgba(167,139,250,.4),transparent 50%),linear-gradient(135deg,#0c4a6e,#1e1b4b)'],
  ['sunset-drive', 'Sunset Drive', 'linear-gradient(180deg,#1e1b4b 0 50%,#7c2d12 50% 70%,#f97316 70% 85%,#fde047 85%)'],
  ['forest-canopy', 'Forest Canopy', 'radial-gradient(circle at 20% 80%,rgba(22,163,74,.5),transparent 60%),radial-gradient(circle at 80% 60%,rgba(21,128,61,.4),transparent 50%),linear-gradient(180deg,#052e16,#0f172a)'],
  ['cyber-grid', 'Cyber Grid', 'linear-gradient(rgba(34,211,238,.25) 1px,transparent 1px) 0 0/20px 20px,linear-gradient(90deg,rgba(34,211,238,.25) 1px,transparent 1px) 0 0/20px 20px,linear-gradient(180deg,#020617,#0f172a)'],
  ['lava-flow', 'Lava Flow', 'radial-gradient(circle at 40% 100%,#f97316,transparent 40%),radial-gradient(circle at 60% 110%,#ef4444,transparent 35%),linear-gradient(180deg,#1c0a00,#3b0a0a)'],
].map(([id, name, css]) => ({ id, name, css }));

const FRAMES = [
  ['none', 'No Frame', 'transparent', ''],
  ['violet', 'Neon Violet', 'linear-gradient(#a855f7,#a855f7)', 'glow'],
  ['cyan-pulse', 'Cyan Pulse', 'linear-gradient(#22d3ee,#22d3ee)', 'pulse'],
  ['rainbow', 'Rainbow Spin', 'conic-gradient(#f43f5e,#f59e0b,#84cc16,#22d3ee,#6366f1,#d946ef,#f43f5e)', 'spin'],
  ['gold', 'Gold', 'conic-gradient(#fde68a,#b45309,#fbbf24,#78350f,#fde68a)', 'glow'],
  ['plasma', 'Plasma', 'conic-gradient(#7c3aed,#22d3ee,#ec4899,#7c3aed)', 'spin'],
  ['fire', 'Fire', 'conic-gradient(#fde047,#f97316,#dc2626,#f97316,#fde047)', 'pulse'],
  ['holo', 'Holo', 'conic-gradient(#a5f3fc,#c4b5fd,#fbcfe8,#bbf7d0,#a5f3fc)', 'spin'],
  ['champion', 'Champion', 'repeating-conic-gradient(#fbbf24 0 20deg,#fff7d6 20deg 30deg)', 'spin'],
  ['royal', 'Royal', 'repeating-conic-gradient(#7c3aed 0 30deg,#fbbf24 30deg 45deg)', 'glow'],
  ['idle-ring', 'Idle Ring', 'conic-gradient(#facc15,#22d3ee,#facc15)', 'spin'],
  ['merge-frame', 'Merge Frame', 'conic-gradient(#34d399,#a855f7,#34d399)', 'pulse'],
  ['stickman-glow', 'Stickman Glow', 'conic-gradient(#fff,#22d3ee,#fff)', 'glow'],
  ['defense-shield', 'Defense Shield', 'repeating-conic-gradient(#22d3ee 0 15deg,#0f172a 15deg 30deg)', 'pulse'],
  // Additional curated frames
  ['neon-pulse', 'Neon Pulse', 'conic-gradient(#22d3ee,#a855f7,#22d3ee)', 'pulse'],
  ['gold-crown', 'Gold Crown', 'conic-gradient(#fde68a,#fbbf24,#b45309,#fde68a)', 'glow'],
  ['crystal-ring', 'Crystal Ring', 'conic-gradient(#7dd3fc,#c4b5fd,#7dd3fc)', 'spin'],
  ['lava-ring', 'Lava Ring', 'conic-gradient(#f97316,#ef4444,#f97316)', 'pulse'],
  ['cyber-frame', 'Cyber Frame', 'repeating-conic-gradient(#22d3ee 0 10deg,#0f172a 10deg 20deg)', 'spin'],
].map(([id, name, bg, anim]) => ({ id, name, bg, anim }));

const TITLES = ['Rookie', 'Hub Regular', 'Hub Legend', 'Explorer', 'Daily Driver', 'Unstoppable', 'Contender', 'Giveaway Hunter', 'Lucky Charm',
  'Hype Machine', 'Trendsetter', 'Weekly Warrior', 'Champion', 'Triple Crown', 'Blaze Legend', 'Zero Hero', 'Record Breaker', 'Marathoner', 'OG Member',
  'Idle Tycoon', 'Merge Master', 'Stickman Ace', 'Defense Commander', 'Parking Pro', 'Mahjong Sage', 'Bubble Blaster', 'Zombie Slayer', 'Fruit Ninja', 'Drive King',
  'Neon Runner', 'Arcade King', 'Gold Standard', 'Crystal Hunter', 'Lava Lord', 'Cyber Ace', 'Forest Guardian', 'Sunset Rider', 'Vault Keeper']
  .map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }));

const DEFAULTS = { banner: 'midnight', frame: 'none', title: 'rookie' };
const BY = { banner: Object.fromEntries(BANNERS.map(b => [b.id, b])), frame: Object.fromEntries(FRAMES.map(f => [f.id, f])), title: Object.fromEntries(TITLES.map(t => [t.id, t])), color: {}, effect: {} };

function css() {
  return [
    '/* generated by src/cosmetics.js */',
    ...BANNERS.map(b => `.bn-${b.id}{background:${b.css};background-color:#0b1030}`),
    ...FRAMES.map(f => `.fr-${f.id}{--frame-bg:${f.bg}}` + (f.anim ? `\n.fr-${f.id}::before{animation:${{ spin: 'fr-spin 5s linear infinite', glow: 'fr-glow 2.6s ease-in-out infinite', pulse: 'fr-pulse 1.6s ease-in-out infinite' }[f.anim]}}` : '')),
  ].join('\n');
}

module.exports = { BANNERS, FRAMES, TITLES, DEFAULTS, BY, css };

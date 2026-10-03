'use strict';
// Cosmetic rewards (no cash value). All designs are original CSS/SVG made for The Gaming Hub.
// Banners and frames are rendered from the CSS below (served as /cosmetics.css); titles are text;
// every achievement is also a badge. Ownership = defaults + rewards of unlocked achievements.
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
  // game themed
  ['rocket-trail', 'Rocket Trail', 'linear-gradient(170deg,transparent 40%,rgba(251,146,60,.85) 46%,rgba(253,224,71,.9) 48%,transparent 54%),radial-gradient(1px 1px at 20% 20%,#fff,transparent),radial-gradient(1px 1px at 75% 30%,#fff,transparent),linear-gradient(180deg,#0b0a26,#1e1b4b)'],
  ['lab', 'Lab Pillars', 'linear-gradient(90deg,transparent 0 46%,#b14dff 46% 48%,transparent 48%) 0 0/90px 100%,linear-gradient(180deg,#0a0a22,#1b1748 85%,#7c4dff 86% 87%,#07061a 88%)'],
  ['drift-smoke', 'Drift Smoke', 'radial-gradient(40% 60% at 20% 70%,rgba(226,232,240,.45),transparent 70%),radial-gradient(35% 55% at 55% 60%,rgba(203,213,225,.35),transparent 70%),linear-gradient(100deg,#0f172a,#334155)'],
  ['night-track', 'Night Track', 'linear-gradient(90deg,transparent 0 48%,#fde047 48% 52%,transparent 52%) 0 0/100% 34px,linear-gradient(90deg,#ec4899 0 4%,#111827 4% 96%,#22d3ee 96%)'],
  ['peg-board', 'Peg Board', 'radial-gradient(circle,rgba(255,255,255,.75) 0 2px,transparent 3px) 0 0/18px 18px,radial-gradient(circle,rgba(255,255,255,.75) 0 2px,transparent 3px) 9px 9px/18px 18px,linear-gradient(180deg,#1e1b4b,#312e81)'],
  ['pachinko', 'Pachinko Lights', 'radial-gradient(circle,#22d3ee 0 2px,transparent 3px) 0 0/16px 16px,radial-gradient(circle,#f472b6 0 2px,transparent 3px) 8px 8px/16px 16px,linear-gradient(135deg,#0c0a2a,#3b0764)'],
  ['prize-wheel', 'Prize Wheel', 'repeating-conic-gradient(from 0deg at 85% 50%,#7c3aed 0 15deg,#22d3ee 15deg 30deg,#f472b6 30deg 45deg,#fbbf24 45deg 60deg)'],
  ['spotlight', 'Spotlight', 'conic-gradient(from 160deg at 50% -10%,transparent 0 10deg,rgba(255,255,255,.35) 18deg,transparent 26deg 34deg,rgba(255,255,255,.3) 42deg,transparent 50deg),linear-gradient(180deg,#1e1b4b,#030712)'],
  ['card-back', 'Card Back', 'conic-gradient(from 45deg,#be123c 25%,#881337 0 50%,#be123c 0 75%,#881337 0) 0 0/22px 22px'],
  ['mind-maze', 'Mind Maze', `${svg("<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><path d='M0 20h20V0M20 40V20h20' fill='none' stroke='#a78bfa' stroke-width='2' opacity='.6'/></svg>")},linear-gradient(135deg,#1e1b4b,#0f172a)`],
  ['bullseye', 'Bullseye', 'repeating-radial-gradient(circle at 85% 50%,rgba(34,211,238,.65) 0 3px,transparent 3px 14px),linear-gradient(90deg,#0a0f2e,#172554)'],
  ['scanlines', 'Arcade Scanlines', 'repeating-linear-gradient(0deg,rgba(0,0,0,.35) 0 2px,transparent 2px 4px),linear-gradient(90deg,#db2777,#7c3aed,#2563eb)'],
  ['wedges', 'Roulette Wedges', 'repeating-conic-gradient(from 0deg at 50% 50%,#b91c1c 0 10deg,#111827 10deg 20deg)'],
  ['felt', 'Felt Table', 'radial-gradient(circle at 50% 50%,#16a34a,#052e16 85%),repeating-linear-gradient(45deg,rgba(0,0,0,.08) 0 2px,transparent 2px 4px)'],
  ['rhythm-bars', 'Rhythm Bars', 'linear-gradient(0deg,#22d3ee 0 30%,transparent 30%) 0 100%/12% 100% no-repeat,linear-gradient(0deg,#a855f7 0 70%,transparent 70%) 14% 100%/12% 100% no-repeat,linear-gradient(0deg,#ec4899 0 45%,transparent 45%) 28% 100%/12% 100% no-repeat,linear-gradient(0deg,#22d3ee 0 85%,transparent 85%) 42% 100%/12% 100% no-repeat,linear-gradient(0deg,#a855f7 0 55%,transparent 55%) 56% 100%/12% 100% no-repeat,linear-gradient(0deg,#ec4899 0 35%,transparent 35%) 70% 100%/12% 100% no-repeat,linear-gradient(0deg,#22d3ee 0 65%,transparent 65%) 84% 100%/12% 100% no-repeat,#0b0a26'],
  ['bass-drop', 'Bass Drop', `${svg("<svg xmlns='http://www.w3.org/2000/svg' width='120' height='40'><path d='M0 20 Q15 0 30 20 T60 20 T90 20 T120 20' fill='none' stroke='#22d3ee' stroke-width='2'/><path d='M0 28 Q15 8 30 28 T60 28 T90 28 T120 28' fill='none' stroke='#e879f9' stroke-width='2' opacity='.7'/></svg>")},linear-gradient(180deg,#0f0726,#2e1065)`],
  // v3: streaks, quests, levels, seasons, tournaments, friends, referrals
  ['streak-fire', 'Streak Fire', 'radial-gradient(30% 80% at 15% 110%,#fde047,transparent 70%),radial-gradient(30% 90% at 45% 115%,#f97316,transparent 70%),radial-gradient(30% 80% at 80% 110%,#ef4444,transparent 70%),linear-gradient(180deg,#1c0a00,#3b0a0a)'],
  ['sunrise', 'Daily Sunrise', 'radial-gradient(circle at 50% 120%,#fde68a 0 20%,#fb923c 21% 34%,transparent 35%),linear-gradient(180deg,#1e1b4b,#7c3aed 70%,#f472b6)'],
  ['quest-map', 'Quest Map', `${svg("<svg xmlns='http://www.w3.org/2000/svg' width='60' height='40'><path d='M2 30 C15 5 30 35 45 12 S58 20 58 20' fill='none' stroke='#fde047' stroke-width='2' stroke-dasharray='4 4' opacity='.8'/><circle cx='58' cy='20' r='3' fill='#f43f5e'/></svg>")},linear-gradient(135deg,#1f2937,#0f172a)`],
  ['level-up', 'Level Up', 'repeating-linear-gradient(90deg,rgba(34,211,238,.55) 0 8%,transparent 8% 10%),linear-gradient(0deg,#0b1030 0 30%,transparent 30%),linear-gradient(90deg,#7c3aed,#22d3ee)'],
  ['season-one', 'Season One: Neon Genesis', 'radial-gradient(circle at 80% 50%,rgba(250,204,21,.6),transparent 30%),repeating-linear-gradient(135deg,rgba(168,85,247,.5) 0 10px,rgba(59,130,246,.45) 10px 20px),#0b1030'],
  ['tourney-bracket', 'Bracket Lines', `${svg("<svg xmlns='http://www.w3.org/2000/svg' width='80' height='40'><path d='M0 6h16v12h16M0 30h16V18M32 18h16v-8h16M48 18v12h16' fill='none' stroke='#22d3ee' stroke-width='2' opacity='.7'/></svg>")},linear-gradient(90deg,#0a0f2e,#312e81)`],
  ['crew', 'Crew Colors', 'linear-gradient(90deg,#f472b6 0 20%,#a855f7 20% 40%,#6366f1 40% 60%,#22d3ee 60% 80%,#34d399 80%)'],
  ['crew-beacon', 'Crew Beacon', 'repeating-radial-gradient(circle at 20% 50%,rgba(52,211,153,.6) 0 2px,transparent 2px 16px),linear-gradient(90deg,#022c22,#0f172a)'],
  // v5 legendary rewards
  ['legend-aurora', 'Legendary Aurora', 'radial-gradient(120% 90% at 0% 0%,rgba(250,204,21,.7),transparent 55%),radial-gradient(120% 90% at 100% 100%,rgba(236,72,153,.7),transparent 55%),conic-gradient(from 90deg,#4c1d95,#1e3a8a,#4c1d95)'],
  ['centurion-flame', 'Centurion Flame', 'radial-gradient(40% 90% at 50% 115%,#fff7ed,#fdba74 30%,#ef4444 60%,transparent 75%),linear-gradient(180deg,#0c0a09,#450a0a)'],
].map(([id, name, css]) => ({ id, name, css }));

// Avatar frames: ring background (+ optional animation class defined in app.css)
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
  ['double', 'Double Ring', 'radial-gradient(closest-side,transparent 84%,#fff 85% 90%,transparent 91%),conic-gradient(#7c3aed,#22d3ee,#7c3aed)', 'glow'],
  // game themed
  ['thruster', 'Thruster', 'conic-gradient(#f97316,#fde047,#22d3ee,#f97316)', 'spin'],
  ['tire-smoke', 'Tire Smoke', 'conic-gradient(#e2e8f0,#475569,#e2e8f0,#1e293b,#e2e8f0)', 'glow'],
  ['peg-ring', 'Peg Ring', 'repeating-conic-gradient(#fff 0 8deg,#6366f1 8deg 20deg)', 'glow'],
  ['wheel', 'Wheel Spin', 'conic-gradient(#7c3aed 0 25%,#22d3ee 0 50%,#f472b6 0 75%,#fbbf24 0)', 'spin'],
  ['card-shark', 'Card Shark', 'repeating-conic-gradient(#e11d48 0 45deg,#0f172a 45deg 90deg)', 'glow'],
  ['crosshair', 'Crosshair', 'repeating-conic-gradient(#ef4444 0 6deg,transparent 6deg 84deg,#ef4444 84deg 90deg),linear-gradient(#22d3ee,#22d3ee)', 'pulse'],
  ['croupier', 'Croupier', 'repeating-conic-gradient(#b91c1c 0 12deg,#0f172a 12deg 24deg,#15803d 24deg 26deg)', 'spin'],
  ['equalizer', 'Equalizer', 'conic-gradient(#a3e635,#22d3ee,#a855f7,#a3e635)', 'pulse'],
  // v3
  ['streak', 'Eternal Flame', 'conic-gradient(#fde047,#f97316,#ef4444,#f97316,#fde047)', 'spin'],
  ['level', 'XP Ring', 'conic-gradient(#22d3ee 0 75%,#1e293b 0)', 'glow'],
  ['season', 'Season Laurel', 'repeating-conic-gradient(#facc15 0 10deg,#7c3aed 10deg 20deg)', 'spin'],
  ['tourney', 'Tournament Gold', 'conic-gradient(#fff7d6,#fbbf24,#b45309,#fbbf24,#fff7d6)', 'pulse'],
  ['friend', 'Friendship', 'conic-gradient(#f472b6,#a855f7,#22d3ee,#f472b6)', 'glow'],
  // v5 legendary + admin-granted
  ['legend-crest', 'Legendary Crest', 'conic-gradient(#fde047,#f472b6,#a855f7,#22d3ee,#fde047)', 'spin'],
  ['staff-glow', 'Trap Tech Staff', 'conic-gradient(#ffffff,#a78bfa,#ffffff,#22d3ee,#ffffff)', 'glow'],
].map(([id, name, bg, anim]) => ({ id, name, bg, anim }));

const TITLES = ['Rookie', 'Hub Regular', 'Hub Legend', 'Explorer', 'Daily Driver', 'Unstoppable', 'Contender', 'Giveaway Hunter', 'Lucky Charm',
  'Hype Machine', 'Trendsetter', 'Weekly Warrior', 'Champion', 'Triple Crown', 'Blaze Legend', 'Zero Hero', 'Record Breaker', 'Marathoner', 'OG Member',
  'Sky Ace', 'Afterburner', 'Drift King', 'Slide Master', 'Plinko Pro', 'Peg Whisperer', 'Wheel Wizard', 'Spin Doctor', 'Memory Master', 'Total Recall',
  'Reflex Legend', 'Sharpshooter', 'High Roller', 'Hot Table', 'Rhythm Royalty', 'Encore',
  'Early Bird', 'Habit Former', 'Questor', 'Quest Legend', 'Level Grinder', 'Veteran', 'Season Starter', 'Season Legend', 'Competitor', 'Finalist', 'Tournament Champ',
  'Social Butterfly', 'Influencer', 'Crew Builder', 'Squad Goals', 'Party Starter', 'Newcomer', 'Hype Sharer',
  // v5 legendary
  'One Percenter', 'Centurion', 'Grandmaster', 'Iron Thumbs', 'Dynasty']
  .map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }));

const DEFAULTS = { banner: 'midnight', frame: 'none', title: 'rookie' };
const BY = { banner: Object.fromEntries(BANNERS.map(b => [b.id, b])), frame: Object.fromEntries(FRAMES.map(f => [f.id, f])), title: Object.fromEntries(TITLES.map(t => [t.id, t])), color: {}, effect: {} };
// v5: shop items join the same lookup maps (ownership is checked separately)
for (const i of require('./shop').ITEMS) { if (BY[i.type]) BY[i.type][i.id] = { id: i.id, name: i.name, shop: true, anim: i.type === 'frame' ? i.extra.split('|')[1] : undefined }; }

function css() {
  return [
    '/* generated by src/cosmetics.js */',
    ...BANNERS.map(b => `.bn-${b.id}{background:${b.css};background-color:#0b1030}`),
    ...FRAMES.map(f => `.fr-${f.id}{--frame-bg:${f.bg}}` + (f.anim ? `\n.fr-${f.id}::before{animation:${{ spin: 'fr-spin 5s linear infinite', glow: 'fr-glow 2.6s ease-in-out infinite', pulse: 'fr-pulse 1.6s ease-in-out infinite' }[f.anim]}}` : '')),
  ].join('\n') + '\n' + require('./shop').css();
}
module.exports = { BANNERS, FRAMES, TITLES, DEFAULTS, BY, css };

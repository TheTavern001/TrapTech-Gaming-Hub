'use strict';
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;

const IMAGE_BANNERS = [
  { id: 'kenney-panel-blue', name: 'Kenney Panel Blue', img: '/cosmetics/kenney/ui/panel-blue.png' },
  { id: 'kenney-panel-green', name: 'Kenney Panel Green', img: '/cosmetics/kenney/ui/panel-green.png' },
  { id: 'kenney-panel-red', name: 'Kenney Panel Red', img: '/cosmetics/kenney/ui/panel-red.png' },
  { id: 'kenney-button-round', name: 'Kenney Round Button', img: '/cosmetics/kenney/ui/button-round.png' },
  { id: 'kenney-icon-star', name: 'Kenney Star', img: '/cosmetics/kenney/icons/star.png' },
  { id: 'kenney-icon-trophy', name: 'Kenney Trophy', img: '/cosmetics/kenney/icons/trophy.png' },
  { id: 'kenney-icon-coin', name: 'Kenney Coin', img: '/cosmetics/kenney/icons/coin.png' },
  { id: 'kenney-icon-gem', name: 'Kenney Gem', img: '/cosmetics/kenney/icons/gem.png' },
];

const BANNERS = [
  ['midnight', 'Midnight', 'linear-gradient(120deg,#1a1450,#0b1235 60%,#08203a)'],
  ['aurora', 'Aurora', 'radial-gradient(120% 80% at 10% 0%,rgba(52,211,153,.75),transparent 60%),radial-gradient(100% 90% at 90% 10%,rgba(34,211,238,.6),transparent 60%),radial-gradient(80% 80% at 50% 100%,rgba(168,85,247,.65),transparent 70%),#061428'],
  ['gold-rush', 'Gold Rush', 'linear-gradient(115deg,#78350f,#f59e0b 30%,#fde68a 45%,#d97706 60%,#451a03)'],
  ['crystal-cave', 'Crystal Cave', 'radial-gradient(circle at 30% 30%,rgba(125,211,252,.4),transparent 50%),radial-gradient(circle at 70% 70%,rgba(167,139,250,.4),transparent 50%),linear-gradient(135deg,#0c4a6e,#1e1b4b)'],
  ['lava-flow', 'Lava Flow', 'radial-gradient(circle at 40% 100%,#f97316,transparent 40%),radial-gradient(circle at 60% 110%,#ef4444,transparent 35%),linear-gradient(180deg,#1c0a00,#3b0a0a)'],
  ['rocket-trail', 'Rocket Trail', 'linear-gradient(180deg,#1e1b4b 0 40%,#7c2d12 40% 70%,#f97316 70%)'],
  ...IMAGE_BANNERS.map(b => [b.id, b.name, `url("${b.img}")`]),
].map(([id, name, css]) => ({ id, name, css }));

const FRAMES = [
  ['none', 'No Frame', 'transparent', ''],
  ['violet', 'Neon Violet', 'linear-gradient(#a855f7,#a855f7)', 'glow'],
  ['gold', 'Gold', 'conic-gradient(#fde68a,#b45309,#fbbf24,#78350f,#fde68a)', 'glow'],
  ['crystal-ring', 'Crystal Ring', 'conic-gradient(#7dd3fc,#c4b5fd,#7dd3fc)', 'spin'],
  ['lava-ring', 'Lava Ring', 'conic-gradient(#f97316,#ef4444,#f97316)', 'pulse'],
  ['kenney-border-1', 'Kenney Border', 'url("/cosmetics/kenney/ui/border.png")', ''],
].map(([id, name, bg, anim]) => ({ id, name, bg, anim }));

const TITLES = ['Rookie', 'Hub Regular', 'Hub Legend', 'Explorer', 'Daily Driver', 'Unstoppable', 'Contender', 'Giveaway Hunter', 'Lucky Charm',
  'Hype Machine', 'Trendsetter', 'Weekly Warrior', 'Champion', 'Triple Crown', 'Blaze Legend', 'Zero Hero', 'Record Breaker', 'Marathoner', 'OG Member',
  'Idle Tycoon', 'Merge Master', 'Defense Commander', 'Mahjong Sage', 'Bubble Blaster', 'Zombie Slayer', 'Fruit Ninja', 'Drive King',
  'Neon Runner', 'Arcade King', 'Gold Standard', 'Crystal Hunter', 'Lava Lord', 'Forest Guardian', 'Sunset Rider', 'Vault Keeper']
  .map(name => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name }));

const DEFAULTS = { banner: 'midnight', frame: 'none', title: 'rookie' };
const LISTS = { banner: BANNERS, frame: FRAMES, title: TITLES };
const BASE = { banner: Object.fromEntries(BANNERS.map(b => [b.id, b])), frame: Object.fromEntries(FRAMES.map(f => [f.id, f])), title: Object.fromEntries(TITLES.map(t => [t.id, t])), color: {}, effect: {} };

// Safety net: achievements/shop/quests may reference a cosmetic id that has no hand-made design yet. Instead of crashing the
// whole server at startup (which happened in production), unknown ids get a deterministic generated design (hue from the id)
// and a warning is logged once. tools/test-cosmetic-rewards.js fails the build on any such id so designs get added on purpose.
const GENERATED = [];
const hue = (id) => { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const nice = (id) => id.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
function generate(type, id) {
  const h = hue(id);
  let item;
  if (type === 'banner') item = { id, name: nice(id), css: `linear-gradient(120deg,hsl(${h} 70% 18%),hsl(${(h + 50) % 360} 75% 30%) 60%,hsl(${(h + 110) % 360} 70% 22%))` };
  else if (type === 'frame') item = { id, name: nice(id), bg: `conic-gradient(hsl(${h} 85% 60%),hsl(${(h + 120) % 360} 85% 55%),hsl(${(h + 240) % 360} 85% 60%),hsl(${h} 85% 60%))`, anim: 'glow' };
  else item = { id, name: nice(id) };
  LISTS[type].push(item); BASE[type][id] = item; GENERATED.push(`${type}:${id}`);
  console.warn(`[cosmetics] no design for ${type} "${id}"; using a generated placeholder`);
  return item;
}
const BY = Object.fromEntries(Object.keys(BASE).map(type => [type, new Proxy(BASE[type], {
  get(t, id) {
    if (typeof id !== 'string' || id in t) return t[id];
    if (!LISTS[type] || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(id) || id in Object.prototype) return undefined;
    return generate(type, id);
  },
  has(t, id) { return typeof id === 'string' && Object.prototype.hasOwnProperty.call(t, id); },
})]));
const generated = () => GENERATED.slice();

function css() {
  return [
    '/* generated by src/cosmetics.js */',
    ...BANNERS.map(b => `.bn-${b.id}{background:${b.css};background-color:#0b1030;background-size:cover;background-position:center}`),
    ...FRAMES.map(f => `.fr-${f.id}{--frame-bg:${f.bg}}` + (f.anim ? `\n.fr-${f.id}::before{animation:${{ spin: 'fr-spin 5s linear infinite', glow: 'fr-glow 2.6s ease-in-out infinite', pulse: 'fr-pulse 1.6s ease-in-out infinite' }[f.anim]}}` : '')),
  ].join('\n');
}

module.exports = { BANNERS, FRAMES, TITLES, DEFAULTS, BY, css, IMAGE_BANNERS, generated };

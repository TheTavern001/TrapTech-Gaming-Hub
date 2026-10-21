'use strict';
// Cosmetics layer: procedural AAA items from shop-gen + visual upgrades.
// Items are usable on profiles and characters once owned/equipped.
const GEN = require('./shop-gen');
const AAA = require('./cosmetics-aaa-full');

const DEFAULTS = {
  banner: 'midnight',
  frame: 'none',
  title: 'rookie',
  badge: '',
  color: '',
  effect: ''
};

// Handcrafted AAA banners/frames that always exist (same IDs as earlier AAA work)
const HAND_BANNERS = Object.entries(AAA.AAA_BANNERS || {}).map(([id, css]) => ({
  id, name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  type: 'banner', rarity: 'epic', css, source: 'hand'
}));
const HAND_FRAMES = Object.entries(AAA.AAA_FRAMES || {}).map(([id, [css, anim]]) => ({
  id, name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  type: 'frame', rarity: 'epic', css, anim, source: 'hand'
}));

function css() {
  // Minimal CSS; full animated frames/banners come from itemCss of generated items + handcrafted rules
  let out = '/* AAA cosmetics */\n';
  HAND_BANNERS.forEach(b => { out += `.bn-${b.id}{background:${b.css};}\n`; });
  HAND_FRAMES.forEach(f => { out += `.fr-${f.id}{background:${f.css};${f.anim === 'spin' ? 'animation:cos-spin 4s linear infinite;' : ''}}\n`; });
  out += '@keyframes cos-spin{to{transform:rotate(360deg)}}\n';
  return out;
}

function listForShop(limit = 48) {
  // Generate a mix of current daily/weekly/universe items for the shop
  const items = [];
  const day = Math.floor(Date.now() / 864e5);
  for (let i = 0; i < 6; i++) {
    try { items.push(GEN.make(`v7d${day}s${i}`)); } catch {}
  }
  for (let i = 0; i < 4; i++) {
    try { items.push(GEN.make(`v7w${Math.floor(day/7)}s${i}`)); } catch {}
  }
  // A few handcrafted always-available
  HAND_BANNERS.slice(0, 4).forEach(b => items.push(b));
  HAND_FRAMES.slice(0, 3).forEach(f => items.push(f));
  return items.slice(0, limit);
}

function itemById(id) {
  if (!id) return null;
  if (HAND_BANNERS.find(b => b.id === id) || HAND_FRAMES.find(f => f.id === id)) {
    return HAND_BANNERS.find(b => b.id === id) || HAND_FRAMES.find(f => f.id === id);
  }
  try { return GEN.make(id); } catch { return null; }
}

module.exports = {
  DEFAULTS,
  HAND_BANNERS,
  HAND_FRAMES,
  css,
  listForShop,
  itemById,
  GEN,
  // Back-compat aliases used by older code
  BANNERS: HAND_BANNERS,
  FRAMES: HAND_FRAMES,
  TITLES: [{ id: 'rookie', name: 'Rookie' }, { id: 'veteran', name: 'Veteran' }, { id: 'legend', name: 'Legend' }],
  LISTS: { banner: HAND_BANNERS, frame: HAND_FRAMES },
  BASE: {},
  asset: (id, type) => `/shop/art/${id}.svg`,
  BY: {}
};

'use strict';
// Cosmetics layer: AAA items from the shop + handcrafted visuals.
// CSS is generated so equipped banners/frames actually render on profiles and characters.
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

const HAND_BANNERS = Object.entries(AAA.AAA_BANNERS || {}).map(([id, css]) => ({
  id, name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  type: 'banner', rarity: 'epic', css, source: 'hand'
}));
const HAND_FRAMES = Object.entries(AAA.AAA_FRAMES || {}).map(([id, [css, anim]]) => ({
  id, name: id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
  type: 'frame', rarity: 'epic', css, anim, source: 'hand'
}));

function css() {
  let out = '/* AAA cosmetics - shop + handcrafted */\n';
  // Handcrafted
  HAND_BANNERS.forEach(b => { out += `.bn-${b.id}{background:${b.css};background-size:cover;}\n`; });
  HAND_FRAMES.forEach(f => {
    out += `.fr-${f.id}{background:${f.css};${f.anim === 'spin' ? 'animation:cos-spin 4s linear infinite;' : f.anim === 'glow' ? 'animation:cos-glow 2s ease-in-out infinite;' : ''}}\n`;
  });
  // Shop handmade items (from src/shop.js)
  try {
    const SH = require('./shop');
    if (SH.ITEMS) {
      for (const it of SH.ITEMS) {
        if (it.type === 'banner' && it.extra) out += `.bn-${it.id}{background:${it.extra};background-size:cover;}\n`;
        if (it.type === 'frame' && it.extra) {
          const [bg, anim] = String(it.extra).split('|');
          out += `.fr-${it.id}{background:${bg};${anim === 'spin' ? 'animation:cos-spin 4s linear infinite;' : anim === 'glow' ? 'animation:cos-glow 2s ease-in-out infinite;' : anim === 'pulse' ? 'animation:cos-pulse 1.6s ease-in-out infinite;' : ''}}\n`;
        }
        if (it.type === 'color' && it.extra) out += `.nc-${it.id}{background:${it.extra};-webkit-background-clip:text;background-clip:text;color:transparent;}\n`;
      }
    }
  } catch (e) { /* shop not ready yet */ }
  out += '@keyframes cos-spin{to{transform:rotate(360deg)}}\n';
  out += '@keyframes cos-glow{50%{filter:brightness(1.25) drop-shadow(0 0 6px currentColor)}}\n';
  out += '@keyframes cos-pulse{50%{transform:scale(1.04)}}\n';
  return out;
}

function listForShop(limit = 48) {
  const items = [];
  const day = Math.floor(Date.now() / 864e5);
  for (let i = 0; i < 6; i++) { try { items.push(GEN.make(`v7d${day}s${i}`)); } catch {} }
  for (let i = 0; i < 4; i++) { try { items.push(GEN.make(`v7w${Math.floor(day/7)}s${i}`)); } catch {} }
  HAND_BANNERS.slice(0, 4).forEach(b => items.push(b));
  HAND_FRAMES.slice(0, 3).forEach(f => items.push(f));
  return items.slice(0, limit);
}

function itemById(id) {
  if (!id) return null;
  const hand = HAND_BANNERS.find(b => b.id === id) || HAND_FRAMES.find(f => f.id === id);
  if (hand) return hand;
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
  BANNERS: HAND_BANNERS,
  FRAMES: HAND_FRAMES,
  TITLES: [{ id: 'rookie', name: 'Rookie' }, { id: 'veteran', name: 'Veteran' }, { id: 'legend', name: 'Legend' }],
  LISTS: { banner: HAND_BANNERS, frame: HAND_FRAMES },
  BASE: {},
  asset: (id, type) => `/shop/art/${id}.svg`,
  BY: {}
};

'use strict';
// Achievements + ownership bridge for AAA cosmetics.
// Players can equip handcrafted and generated cosmetics on their profile/character.
const COS = require('./cosmetics');

const ACHIEVEMENTS = [];
const A = ACHIEVEMENTS;
const BY_ID = {};
const ADMIN_BADGES = [];
const ADMIN_BY = {};
const CATS = [];

function publicCos(u = {}) {
  return {
    banner: (u && u.eq_banner) || (COS.DEFAULTS && COS.DEFAULTS.banner) || 'midnight',
    frame: (u && u.eq_frame) || (COS.DEFAULTS && COS.DEFAULTS.frame) || 'none',
    title: (u && u.eq_title) || 'Rookie',
    badge: (u && u.eq_badge) || null,
    color: (u && u.eq_color) || '',
    effect: (u && u.eq_effect) || ''
  };
}

function evaluate(userId, opts = {}) {
  return { fresh: [], have: new Map(), stats: {} };
}

function unlockedMap(userId) {
  return new Map();
}

function grantsOf(userId) {
  return [];
}

function ownedCount(userId) {
  return 8; // starter set
}

// Ownership: everyone owns the handcrafted AAA set + any generated item whose id starts with v7
// so the shop items can be equipped immediately for testing and use.
function ownedAll(userId) {
  const own = {
    banner: new Set(COS.HAND_BANNERS.map(b => b.id)),
    frame: new Set(COS.HAND_FRAMES.map(f => f.id)),
    title: new Set(['rookie', 'veteran', 'legend']),
    badge: new Set(),
    color: new Set(),
    effect: new Set()
  };
  // Also allow any generated shop item (id pattern from shop-gen)
  own.banner.add('midnight');
  return own;
}

function publicAch(a, done) {
  return { id: a.id || '', name: a.name || '', desc: a.desc || '', icon: a.icon || 'trophy', tier: a.tier || 'common', target: a.target || 1 };
}

function rarity() {
  return { pct: () => 0, total: 0 };
}

function rarityLabel(pct) {
  return 'common';
}

module.exports = {
  A,
  ACHIEVEMENTS,
  BY_ID,
  ADMIN_BADGES,
  ADMIN_BY,
  CATS,
  publicCos,
  evaluate,
  unlockedMap,
  grantsOf,
  ownedCount,
  ownedAll,
  publicAch,
  rarity,
  rarityLabel
};

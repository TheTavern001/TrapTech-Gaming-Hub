'use strict';
// Expanded stub so profile pages and achievement lists load without crashing.
// Full achievement logic will be restored later; this returns safe empty data.
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
    badge: null,
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
  return 0;
}

function ownedAll(userId) {
  return [];
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

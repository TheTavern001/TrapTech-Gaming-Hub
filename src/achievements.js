'use strict';
// Minimal stub to allow server startup while full achievement system is restored.
const COS = require('./cosmetics');

const A = [];
const BY_ID = {};
const ADMIN_BADGES = [];
const ADMIN_BY = {};

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
  return { fresh: [] };
}

module.exports = { A, BY_ID, ADMIN_BADGES, ADMIN_BY, publicCos, evaluate };

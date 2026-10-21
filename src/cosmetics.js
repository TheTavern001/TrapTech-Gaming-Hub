'use strict';
// Cosmetic rewards. Minimal version with css() stub for startup.
const ASSET_BASE = process.env.ASSET_CDN_URL || 'https://assets.example.com/cosmetics/v1/';

function asset(id, type) {
  return ASSET_BASE + type + '/' + id + '.png';
}

const BANNERS = [
  { id: 'midnight', name: 'Midnight', css: asset('midnight', 'banner') },
  { id: 'neon-grid', name: 'Neon Grid', css: asset('neon-grid', 'banner') },
];

const FRAMES = [
  { id: 'none', name: 'No Frame', bg: 'transparent', anim: '' },
];

const TITLES = [{ id: 'rookie', name: 'Rookie' }];

const DEFAULTS = { banner: 'midnight', frame: 'none', title: 'rookie' };
const LISTS = { banner: BANNERS, frame: FRAMES, title: TITLES };
const BASE = {
  banner: Object.fromEntries(BANNERS.map(b => [b.id, b])),
  frame: Object.fromEntries(FRAMES.map(f => [f.id, f])),
  title: Object.fromEntries(TITLES.map(t => [t.id, t])),
  color: {},
  effect: {}
};

function css() {
  return '/* cosmetics.css - designs restored in full later */\n.cos-banner{background:#111;}\n';
}

module.exports = { BANNERS, FRAMES, TITLES, DEFAULTS, LISTS, BASE, asset, css, BY: BASE };

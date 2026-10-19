'use strict';
// Cosmetic rewards. IDs preserved from original. Designs load from Cloudflare R2.
// Full original ID lists must be restored from commit 10b4441 then CSS replaced with asset URLs.

const ASSET_BASE = process.env.ASSET_CDN_URL || 'https://assets.example.com/cosmetics/v1/';

function asset(id, type) {
  return ASSET_BASE + type + '/' + id + '.png';
}

const BANNERS = [
  { id: 'midnight', name: 'Midnight', css: asset('midnight', 'banner') },
  { id: 'neon-grid', name: 'Neon Grid', css: asset('neon-grid', 'banner') },
  { id: 'synthwave', name: 'Synthwave Sunset', css: asset('synthwave', 'banner') },
  { id: 'aurora', name: 'Aurora', css: asset('aurora', 'banner') },
  { id: 'plasma', name: 'Plasma Swirl', css: asset('plasma', 'banner') },
  { id: 'gold-rush', name: 'Gold Rush', css: asset('gold-rush', 'banner') },
  { id: 'ice', name: 'Ice Crystal', css: asset('ice', 'banner') },
  { id: 'legend-aurora', name: 'Legendary Aurora', css: asset('legend-aurora', 'banner') },
];

const FRAMES = [
  { id: 'none', name: 'No Frame', bg: 'transparent', anim: '' },
  { id: 'rainbow', name: 'Rainbow Spin', bg: asset('rainbow', 'frame'), anim: 'spin' },
  { id: 'gold', name: 'Gold', bg: asset('gold', 'frame'), anim: 'glow' },
  { id: 'plasma', name: 'Plasma', bg: asset('plasma', 'frame'), anim: 'spin' },
  { id: 'legend-crest', name: 'Legendary Crest', bg: asset('legend-crest', 'frame'), anim: 'spin' },
];

const TITLES = ['Rookie', 'Hub Regular', 'Hub Legend'].map(name => ({ id: name.toLowerCase().replace(/\s+/g, '-'), name }));

const DEFAULTS = { banner: 'midnight', frame: 'none', title: 'rookie' };
const LISTS = { banner: BANNERS, frame: FRAMES, title: TITLES };
const BASE = {
  banner: Object.fromEntries(BANNERS.map(b => [b.id, b])),
  frame: Object.fromEntries(FRAMES.map(f => [f.id, f])),
  title: Object.fromEntries(TITLES.map(t => [t.id, t])),
  color: {},
  effect: {}
};

module.exports = { BANNERS, FRAMES, TITLES, DEFAULTS, LISTS, BASE, asset };

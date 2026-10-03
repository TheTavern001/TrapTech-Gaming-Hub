'use strict';
// Server-rendered share images (Open Graph / social cards), 1200x630 PNG. SVG templates rendered with resvg.
// Fonts: Orbitron + Exo 2 (SIL OFL), converted to TTF in src/og-fonts. Logos: The Gaming Hub + Trap Tech Solutions.
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');
const PUB = path.join(__dirname, '..', 'public');
const FONTS = fs.readdirSync(path.join(__dirname, 'og-fonts')).map(f => path.join(__dirname, 'og-fonts', f));
const cache = new Map();
const imgCache = new Map();
function dataUri(rel) {
  if (!rel || !/^\/assets\/[\w\/.-]+$/.test(rel)) return null;
  const png = rel.replace(/\.webp$/, '.png'); const f = path.join(PUB, png);
  if (!f.startsWith(PUB) || !fs.existsSync(f)) return null;
  if (!imgCache.has(f)) imgCache.set(f, 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'));
  return imgCache.get(f);
}
const x = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const clip = (s, n) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function frame(inner, { art = null, accent = '#a855f7' } = {}) {
  const logo = dataUri('/assets/brand/logo-horizontal.png'); const tt = dataUri('/assets/brand/traptech.png'); const a = dataUri(art);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#140a3c"/><stop offset=".55" stop-color="#0a0f2e"/><stop offset="1" stop-color="#06203f"/></linearGradient>
    <linearGradient id="nv" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a855f7"/><stop offset="1" stop-color="#22d3ee"/></linearGradient>
    <radialGradient id="glow" cx=".85" cy=".2" r=".7"><stop offset="0" stop-color="${accent}" stop-opacity=".45"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#6d5bd0" stroke-opacity=".16" stroke-width="1"/></pattern>
    <clipPath id="artc"><rect x="760" y="120" width="380" height="380" rx="28"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/><rect width="1200" height="630" fill="url(#grid)"/><rect width="1200" height="630" fill="url(#glow)"/>
  <rect x="14" y="14" width="1172" height="602" rx="30" fill="none" stroke="url(#nv)" stroke-width="3" stroke-opacity=".8"/>
  ${logo ? `<image x="60" y="44" width="300" height="76" xlink:href="${logo}"/>` : ''}
  ${a ? `<rect x="752" y="112" width="396" height="396" rx="34" fill="url(#nv)" opacity=".75"/><image x="760" y="120" width="380" height="380" preserveAspectRatio="xMidYMid slice" clip-path="url(#artc)" xlink:href="${a}"/>` : ''}
  ${inner}
  <text x="60" y="580" font-family="Exo 2" font-weight="600" font-size="22" fill="#9aa3d0">Free to play • Points &amp; cosmetics only • 21+</text>
  ${tt ? `<text x="1140" y="548" text-anchor="end" font-family="Orbitron" font-weight="700" font-size="14" fill="#9aa3d0" letter-spacing="3">BUILT BY</text><image x="880" y="556" width="260" height="40" xlink:href="${tt}"/>` : ''}
</svg>`;
}
const T = (x0, y, size, fill, text, { font = 'Orbitron', weight = 900, anchor = 'start', ls = 0 } = {}) =>
  `<text x="${x0}" y="${y}" font-family="${font}" font-weight="${weight}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" letter-spacing="${ls}">${x(text)}</text>`;

const templates = {
  default: () => frame(`${T(60, 240, 64, '#fff', 'PLAY • COMPETE')}${T(60, 320, 64, 'url(#nv)', 'WIN • CONNECT')}
    ${T(60, 390, 28, '#c7cdf5', 'Free arcade games, leaderboards, tournaments and', { font: 'Exo 2', weight: 600 })}${T(60, 430, 28, '#c7cdf5', 'brand giveaways. No purchase necessary.', { font: 'Exo 2', weight: 600 })}`, { art: '/assets/cards/jetpack-dash.png' }),
  run: (d) => frame(`${T(60, 190, 26, '#22d3ee', clip(d.game, 28).toUpperCase(), { weight: 700, ls: 3 })}
    ${T(60, 320, d.scoreText.length > 9 ? 92 : 120, '#fff', d.scoreText)}
    ${T(60, 380, 34, '#e9e6ff', `${clip(d.username, 20)}${d.title ? ' • ' + clip(d.title, 22) : ''}`, { font: 'Exo 2', weight: 800 })}
    ${T(60, 430, 28, '#fde047', d.rank ? `#${d.rank} of ${d.players} players${d.best ? ' • personal best' : ''}` : 'New run', { font: 'Exo 2', weight: 800 })}
    <rect x="60" y="460" width="330" height="62" rx="31" fill="url(#nv)"/>${T(225, 501, 24, '#fff', 'CAN YOU BEAT IT?', { anchor: 'middle', weight: 800 })}`, { art: d.art }),
  giveaway: (d) => frame(`${T(60, 180, 24, '#fde047', (d.tier ? d.tier.toUpperCase() + ' GIVEAWAY' : 'GIVEAWAY'), { weight: 700, ls: 3 })}
    ${T(60, 260, d.title.length > 18 ? 52 : 66, '#fff', clip(d.title, 26))}
    ${T(60, 320, 32, '#c7cdf5', `Hosted by ${clip(d.host, 28)}`, { font: 'Exo 2', weight: 800 })}
    ${T(60, 370, 28, '#22d3ee', d.when, { font: 'Exo 2', weight: 800 })}
    ${T(60, 420, 26, '#e9e6ff', 'Play free to enter. No purchase necessary.', { font: 'Exo 2', weight: 600 })}
    <rect x="60" y="455" width="300" height="62" rx="31" fill="url(#nv)"/>${T(210, 496, 24, '#fff', 'PLAY TO ENTER', { anchor: 'middle', weight: 800 })}`, { art: d.art, accent: d.color || '#a855f7' }),
  profile: (d) => frame(`${T(60, 190, 24, '#22d3ee', 'PLAYER PROFILE', { weight: 700, ls: 3 })}
    ${T(60, 280, 72, '#fff', clip(d.username, 16))}
    ${T(60, 335, 32, '#fde047', clip(d.title, 30), { font: 'Exo 2', weight: 800 })}
    ${T(60, 400, 30, '#e9e6ff', `Level ${d.level} • ${d.ach} achievements • ${d.games} games`, { font: 'Exo 2', weight: 700 })}
    ${T(60, 445, 30, '#c7cdf5', `${d.points} total points`, { font: 'Exo 2', weight: 700 })}`, { art: '/assets/brand/logo-mark.png' }),
  tournament: (d) => frame(`${T(60, 180, 24, '#fde047', d.format === 'bracket' ? 'BRACKET TOURNAMENT' : 'TIMED TOURNAMENT', { weight: 700, ls: 3 })}
    ${T(60, 260, d.title.length > 18 ? 52 : 64, '#fff', clip(d.title, 26))}
    ${T(60, 320, 32, '#22d3ee', d.game, { font: 'Exo 2', weight: 800 })}
    ${T(60, 370, 28, '#c7cdf5', d.when, { font: 'Exo 2', weight: 700 })}
    ${T(60, 420, 26, '#e9e6ff', d.prize ? clip('Prize: ' + d.prize, 44) : 'Free entry - play to compete', { font: 'Exo 2', weight: 600 })}`, { art: d.art }),
};
function render(kind, data, key) {
  const k = key ? `${kind}:${key}` : null;
  if (k && cache.has(k)) return cache.get(k);
  const svg = (templates[kind] || templates.default)(data || {});
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Exo 2' } }).render().asPng();
  if (k) { cache.set(k, png); if (cache.size > 300) cache.delete(cache.keys().next().value); }
  return png;
}
module.exports = { render };

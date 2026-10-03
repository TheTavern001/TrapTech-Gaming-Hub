// Regenerates public/js/icons.js from lucide-static (ISC). Dev tool only:
//   (cd tools && npm install --no-save lucide-static) && node tools/build-icons.js
const fs = require('fs'); const path = require('path');
const OUT = path.join(__dirname, '..', 'public', 'js', 'icons.js');
const DIR = path.join(__dirname, 'node_modules', 'lucide-static', 'icons');
const old = fs.readFileSync(OUT, 'utf8').match(/export const ICONS=(\{.*\});/s);
const prev = old ? JSON.parse(old[1]) : {};
const EXTRA = ['target', 'disc-3', 'dices', 'palette', 'link', 'unlink', 'badge-check', 'circle-help', 'chart-column', 'shield', 'image', 'layers', 'lock-open', 'flag', 'car', 'brain', 'music', 'circle-dot', 'rocket', 'hand', 'gem', 'swords', 'calendar-days', 'hourglass', 'pin', 'mail', 'info', 'percent', 'square-check', 'chevron-down', 'circle-check', 'circle-x', 'party-popper', 'heart-handshake', 'flame-kindling', 'wand-sparkles', 'repeat', 'grid-3x3', 'mouse-pointer-click', 'arrow-down-to-line', 'trending-up',
  // v3
  'calendar-check', 'sunrise', 'scroll-text', 'map', 'chevrons-up', 'shield-check', 'calendar-range', 'megaphone', 'handshake', 'share-2', 'share', 'search', 'bell-ring', 'user-check',
  'user-minus', 'download', 'copy', 'settings', 'scale', 'triangle-alert', 'heart-pulse', 'smartphone', 'wifi-off', 'x', 'check', 'shuffle', 'play', 'zap', 'clock', 'external-link',
  'building-2', 'code-xml', 'sparkle', 'eye', 'circle-alert', 'list-checks', 'network', 'bell-off', 'inbox', 'cake', 'ban', 'house', 'arrow-right', 'globe', 'cookie', 'accessibility', 'moon', 'activity',
  // v4
  'shield-alert', 'printer', 'fingerprint', 'radio', 'user-x', 'hash', 'gavel', 'lock', 'list-ordered', 'scroll'];
const names = [...new Set([...Object.keys(prev), ...EXTRA])];
const out = {};
for (const n of names) {
  const f = path.join(DIR, n + '.svg');
  if (fs.existsSync(f)) { const s = fs.readFileSync(f, 'utf8'); out[n] = s.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '').trim().replace(/\s*\n\s*/g, ' '); }
  else if (prev[n]) out[n] = prev[n]; else console.warn('missing icon', n);
}
fs.writeFileSync(OUT, `// Icons from Lucide (ISC License) https://lucide.dev\nexport const ICONS=${JSON.stringify(out)};\nexport function icon(n,c=""){return \`<svg class="ico \${c}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\${ICONS[n]||""}</svg>\`}\n`);
console.log('icons:', Object.keys(out).length);

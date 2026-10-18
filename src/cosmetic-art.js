'use strict';
// v8 procedural card art for universe cosmetics (shop-gen src 'u' / 'a'). Pure function of the item: no stored assets.
// Original SVG only: lit metal (specular lighting filters), gems, foil borders, scenes and particle fields.
// Output ~6-12 KB per card, served with immutable caching by /shop/art/<id>.svg and rebuilt on demand.
const G = require('./shop-gen');
const f1 = (n) => Math.round(n * 10) / 10;
const esc = (v) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const TYPE_LABEL = { banner: 'PROFILE BANNER', frame: 'AVATAR FRAME', title: 'TITLE', badge: 'BADGE', color: 'NAME COLOR', effect: 'PROFILE EFFECT' };
const RIM = { common: ['#e5e7eb', '#9ca3af', '#4b5563'], rare: ['#dbeafe', '#60a5fa', '#1d4ed8'], epic: ['#f5d0fe', '#c084fc', '#7e22ce'], legendary: ['#fef9c3', '#facc15', '#b45309'] };
const GEMS = { common: 4, rare: 8, epic: 12, legendary: 16 };
const mix = (a, b, t) => { const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16)), pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16)); return '#' + pa.map((x, i) => Math.round(x + (pb[i] - x) * t).toString(16).padStart(2, '0')).join(''); };

function defs(it, p, rim) {
  const rr = RIM[it.rarity] || RIM.rare;
  return `<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[1]}"/><stop offset=".55" stop-color="${p[0]}"/><stop offset="1" stop-color="${mix(p[0], '#000000', .55)}"/></linearGradient>
<radialGradient id="spot" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="${p[2]}" stop-opacity=".5"/><stop offset=".5" stop-color="${p[3]}" stop-opacity=".12"/><stop offset="1" stop-color="${p[0]}" stop-opacity="0"/></radialGradient>
<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${rr[0]}"/><stop offset=".22" stop-color="${rr[1]}"/><stop offset=".4" stop-color="${rr[0]}"/><stop offset=".62" stop-color="${rr[2]}"/><stop offset=".82" stop-color="${rr[1]}"/><stop offset="1" stop-color="${rr[0]}"/></linearGradient>
<linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p[4]}"/><stop offset=".5" stop-color="${p[2]}"/><stop offset="1" stop-color="${p[3]}"/></linearGradient>
<linearGradient id="glass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".5" stop-color="#fff" stop-opacity=".04"/><stop offset="1" stop-color="#fff" stop-opacity=".0"/></linearGradient>
<radialGradient id="gem" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".25" stop-color="${p[4]}"/><stop offset=".7" stop-color="${p[2]}"/><stop offset="1" stop-color="${mix(p[2], '#000000', .6)}"/></radialGradient>
<radialGradient id="dish" cx=".4" cy=".35" r=".85"><stop offset="0" stop-color="${mix(p[2], '#ffffff', .25)}"/><stop offset=".55" stop-color="${p[1]}"/><stop offset="1" stop-color="${p[0]}"/></radialGradient>
<radialGradient id="vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".62"/></radialGradient>
<linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".34"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<filter id="noise" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="${it.universe % 97}" result="n"/><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 -.18"/></filter>
<filter id="bevel" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="b"/><feSpecularLighting in="b" surfaceScale="5" specularConstant=".9" specularExponent="22" lighting-color="#ffffff" result="s"><feDistantLight azimuth="235" elevation="48"/></feSpecularLighting><feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/><feComposite in="SourceGraphic" in2="sp" operator="arithmetic" k1="0" k2="1" k3=".85" k4="0"/></filter>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
<filter id="drop" x="-20%" y="-20%" width="140%" height="150%"><feGaussianBlur in="SourceAlpha" stdDeviation="6"/><feOffset dy="9"/><feComponentTransfer><feFuncA type="linear" slope=".55"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;
}
function stage(it, p, r) {
  let s = `<rect width="640" height="400" rx="26" fill="url(#bg)"/><rect width="640" height="400" rx="26" fill="url(#spot)"/>`;
  // bokeh motes
  for (let i = 0; i < 22; i++) s += `<circle cx="${f1(r() * 640)}" cy="${f1(r() * 330)}" r="${f1(1 + r() * 5)}" fill="${[p[2], p[3], p[4]][i % 3]}" opacity="${f1(0.08 + r() * 0.3)}"/>`;
  // floor + reflection
  s += `<ellipse cx="320" cy="312" rx="230" ry="26" fill="#000" opacity=".4"/><ellipse cx="320" cy="308" rx="200" ry="18" fill="none" stroke="${p[2]}" stroke-opacity=".35"/>`;
  return s;
}
function chrome(it, p, r) { // rarity border, corner ornaments, foil
  const rr = RIM[it.rarity] || RIM.rare; let s = `<rect x="10" y="10" width="620" height="380" rx="20" fill="url(#glass)" stroke="url(#metal)" stroke-width="${it.rarity === 'common' ? 2 : 3.5}"/>`;
  if (it.rarity !== 'common') s += `<rect x="18" y="18" width="604" height="364" rx="14" fill="none" stroke="${rr[1]}" stroke-opacity=".35"/>`;
  const gem = GEMS[it.rarity] > 4;
  if (gem) for (const [x, y] of [[26, 26], [614, 26], [26, 374], [614, 374]]) s += `<path d="M${x} ${y - 9}L${x + 9} ${y}L${x} ${y + 9}L${x - 9} ${y}Z" fill="url(#gem)" stroke="${rr[0]}" stroke-width="1.5"/>`;
  if (it.rarity === 'epic' || it.rarity === 'legendary') { // light rays behind hero
    let rays = ''; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 + r() * 0.2; rays += `<path d="M320 170 L${f1(320 + Math.cos(a) * 420)} ${f1(170 + Math.sin(a) * 420)} L${f1(320 + Math.cos(a + 0.09) * 420)} ${f1(170 + Math.sin(a + 0.09) * 420)}Z" fill="${p[4]}" opacity=".05"/>`; }
    s = rays + s;
  }
  if (it.rarity === 'legendary') s += `<rect x="10" y="10" width="620" height="380" rx="20" fill="url(#sweep)" opacity=".5"><animate attributeName="x" values="-640;640" dur="5s" repeatCount="indefinite"/></rect>`;
  return s;
}
function caption(it, p) {
  const rr = RIM[it.rarity] || RIM.rare; const nm = esc(it.name); const fs = nm.length > 26 ? 21 : nm.length > 20 ? 25 : 30;
  return `<rect x="26" y="332" width="588" height="52" rx="12" fill="#02040c" opacity=".62"/><text x="44" y="354" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="700" letter-spacing="3" fill="${rr[1]}">${esc(String(it.rarity).toUpperCase())} · ${TYPE_LABEL[it.type] || ''}</text>`
    + `<text x="44" y="377" font-family="Arial,Helvetica,sans-serif" font-size="${fs > 25 ? 22 : 18}" font-weight="800" letter-spacing=".5" fill="#fff">${nm}</text>`
    + `<text x="596" y="377" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-size="10" letter-spacing="2" fill="#fff" opacity=".45">TRAPTECH ORIGINAL</text>`;
}
const avatarSil = (cx, cy, k, col) => `<g transform="translate(${cx} ${cy}) scale(${k})"><circle cx="0" cy="-8" r="30" fill="${col}"/><path d="M-52 62 Q-50 20 0 16 Q50 20 52 62Z" fill="${col}"/></g>`;
function gemRing(cx, cy, rad, n, size) { let s = ''; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2; s += `<circle cx="${f1(cx + Math.cos(a) * rad)}" cy="${f1(cy + Math.sin(a) * rad)}" r="${size}" fill="url(#gem)" stroke="#fff" stroke-opacity=".6" stroke-width=".8"/>`; } return s; }
function arcSeg(cx, cy, rad, a0, a1) { const x0 = cx + Math.cos(a0) * rad, y0 = cy + Math.sin(a0) * rad, x1 = cx + Math.cos(a1) * rad, y1 = cy + Math.sin(a1) * rad; return `M${f1(x0)} ${f1(y0)} A${rad} ${rad} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f1(x1)} ${f1(y1)}`; }
function theme(it) { return it.theme; }
function ornaments(it, p, cx, cy, rad) {
  const t = theme(it); let s = '';
  if (t === 'culture') for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; s += `<path d="M0 0 C6 -10 18 -12 24 -4 C16 4 6 6 0 0Z" transform="translate(${f1(cx + Math.cos(a) * rad)} ${f1(cy + Math.sin(a) * rad)}) rotate(${f1(a * 57.3 + 20)})" fill="${i % 2 ? p[2] : p[3]}" stroke="${p[4]}" stroke-opacity=".5" stroke-width=".8"/>`; }
  else if (t === 'gaming') for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; s += `<path d="M-9 -5.2L0 -10.4L9 -5.2L9 5.2L0 10.4L-9 5.2Z" transform="translate(${f1(cx + Math.cos(a) * rad)} ${f1(cy + Math.sin(a) * rad)}) rotate(${f1(a * 57.3)})" fill="#050816" stroke="${p[2]}" stroke-width="2"/>`; }
  else s += `<path d="M${cx - 34} ${cy - rad - 6} L${cx - 22} ${cy - rad - 34} L${cx - 8} ${cy - rad - 14} L${cx} ${cy - rad - 40} L${cx + 8} ${cy - rad - 14} L${cx + 22} ${cy - rad - 34} L${cx + 34} ${cy - rad - 6}Z" fill="url(#metal)" stroke="#fff" stroke-opacity=".5" filter="url(#bevel)"/>`;
  return s;
}
function hero(it, p, r, icons) {
  const t = it.type, rr = RIM[it.rarity] || RIM.rare, cx = 320, cy = 168;
  if (t === 'banner') {
    const banner = G.bannerSvg(it.art.seed, it.palette, it.art.motif, it.rarity).replace(/id='/g, "id='b").replace(/url\(#/g, 'url(#b').replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
    return `<g filter="url(#drop)"><rect x="76" y="70" width="488" height="162" rx="14" fill="url(#metal)"/><svg x="84" y="78" width="472" height="146" viewBox="0 0 480 160" preserveAspectRatio="xMidYMid slice" overflow="hidden"><clipPath id="bc"><rect width="480" height="160" rx="9"/></clipPath><g clip-path="url(#bc)">${banner}</g></svg><rect x="84" y="78" width="472" height="73" rx="9" fill="url(#glass)"/></g>`
      + `<clipPath id="bav"><circle cx="150" cy="262" r="34"/></clipPath><circle cx="150" cy="262" r="34" fill="url(#dish)"/><g clip-path="url(#bav)">${avatarSil(150, 276, .72, '#050816')}</g><circle cx="150" cy="262" r="34" fill="none" stroke="url(#metal)" stroke-width="5"/>` + `<rect x="200" y="252" width="150" height="10" rx="5" fill="#fff" opacity=".85"/><rect x="200" y="270" width="96" height="7" rx="3.5" fill="#fff" opacity=".4"/>`;
  }
  if (t === 'frame') {
    const R0 = 104; const st = it.art.style; let s = `<circle cx="${cx}" cy="${cy}" r="${R0 + 18}" fill="${p[2]}" opacity=".25" filter="url(#soft)"/><circle cx="${cx}" cy="${cy}" r="${R0 - 10}" fill="url(#dish)"/>` + `<g clip-path="url(#av)">${avatarSil(cx, cy + 40, 1.25, '#050816')}</g>`;
    s = `<clipPath id="av"><circle cx="${cx}" cy="${cy}" r="${R0 - 10}"/></clipPath>` + s;
    s += `<g filter="url(#bevel)">`;
    if (st === 'segments') for (let i = 0; i < 12; i++) s += `<path d="${arcSeg(cx, cy, R0, i * Math.PI / 6 + .05, (i + 1) * Math.PI / 6 - .05)}" fill="none" stroke="${i % 2 ? 'url(#metal)' : 'url(#acc)'}" stroke-width="20" stroke-linecap="butt"/>`;
    else if (st === 'dual') s += `<circle cx="${cx}" cy="${cy}" r="${R0 + 5}" fill="none" stroke="url(#metal)" stroke-width="9"/><circle cx="${cx}" cy="${cy}" r="${R0 - 8}" fill="none" stroke="url(#acc)" stroke-width="9"/>`;
    else if (st === 'ticks') s += `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="none" stroke="url(#metal)" stroke-width="16"/><circle cx="${cx}" cy="${cy}" r="${R0 + 14}" fill="none" stroke="${p[4]}" stroke-width="8" stroke-dasharray="2.4 7.2" opacity=".9"/>`;
    else s += `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="none" stroke="url(#metal)" stroke-width="20"/><circle cx="${cx}" cy="${cy}" r="${R0 - 12}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/>`;
    s += `</g>` + ornaments(it, p, cx, cy, R0 + 12) + gemRing(cx, cy, R0, GEMS[it.rarity], it.rarity === 'common' ? 3 : 5);
    if (it.art.anim === 'spin') s += `<circle cx="${cx}" cy="${cy}" r="${R0}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="3" stroke-dasharray="30 600"><animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="6s" repeatCount="indefinite"/></circle>`;
    return s;
  }
  if (t === 'badge') {
    const shape = G.hash('shape', it.id) % 3; const R = 88;
    const path = shape === 0 ? `M${cx} ${cy - R} L${cx + R * .87} ${cy - R / 2} L${cx + R * .87} ${cy + R / 2} L${cx} ${cy + R} L${cx - R * .87} ${cy + R / 2} L${cx - R * .87} ${cy - R / 2}Z` : shape === 1 ? `M${cx - R * .86} ${cy - R * .8} H${cx + R * .86} V${cy + R * .1} Q${cx + R * .86} ${cy + R * .72} ${cx} ${cy + R * 1.08} Q${cx - R * .86} ${cy + R * .72} ${cx - R * .86} ${cy + R * .1}Z` : `M${cx} ${cy - R} A${R} ${R} 0 1 1 ${cx - .01} ${cy - R}Z`;
    const ic = (icons && icons[it.art.icon]) || '';
    let s = `<ellipse cx="${cx}" cy="${cy + 8}" rx="${R + 26}" ry="${R + 14}" fill="${p[2]}" opacity=".28" filter="url(#soft)"/><g filter="url(#drop)"><path d="${path}" fill="url(#metal)" stroke="${rr[2]}" stroke-width="2" filter="url(#bevel)"/><path d="${path}" transform="translate(${cx} ${cy}) scale(.82) translate(${-cx} ${-cy})" fill="url(#dish)" stroke="#000" stroke-opacity=".4" stroke-width="2"/><path d="${path}" transform="translate(${cx} ${cy}) scale(.9) translate(${-cx} ${-cy})" fill="none" stroke="#fff" stroke-opacity=".5" stroke-dasharray="2 5"/></g>`;
    s += `<g transform="translate(${cx - 44} ${cy - 44}) scale(3.67)" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity=".96" filter="url(#bevel)">${ic}</g>`;
    s += `<path d="${path}" transform="translate(${cx} ${cy}) scale(.82) translate(${-cx} ${-cy})" fill="url(#glass)"/>`;
    s += gemRing(cx, cy, R + 8, Math.max(4, GEMS[it.rarity] / 2), 4);
    return s;
  }
  if (t === 'title') {
    const nm = esc(it.name); const fs = nm.length > 24 ? 27 : nm.length > 17 ? 34 : 42;
    return `<g filter="url(#drop)"><path d="M70 150 L118 104 H522 L570 150 L522 196 H118Z" fill="url(#metal)" filter="url(#bevel)"/><path d="M92 150 L128 118 H512 L548 150 L512 182 H128Z" fill="#050816" stroke="${p[2]}" stroke-opacity=".6"/></g>`
      + `<text x="320" y="${150 + fs * .35}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="${fs}" font-weight="700" letter-spacing="1.5" fill="url(#acc)" stroke="#000" stroke-opacity=".35" stroke-width=".8">${nm}</text>`
      + `<path d="M150 212 H490" stroke="url(#metal)" stroke-width="3" stroke-linecap="round"/><circle cx="320" cy="212" r="7" fill="url(#gem)" stroke="#fff" stroke-opacity=".7"/>`
      + `<text x="320" y="252" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" letter-spacing="4" fill="#fff" opacity=".6">PLAYER NAME</text>`;
  }
  if (t === 'color') {
    const st = it.art.stops; const sweep = it.art.shimmer ? `<rect x="-300" y="96" width="260" height="120" fill="url(#sweep)" opacity=".9"><animate attributeName="x" values="-300;640" dur="3.6s" repeatCount="indefinite"/></rect>` : '';
    return `<linearGradient id="txt" x1="0" y1="0" x2="1" y2="0">${st.map((c, i) => `<stop offset="${i / Math.max(1, st.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient><clipPath id="pl"><rect x="80" y="96" width="480" height="120" rx="22"/></clipPath>`
      + `<g filter="url(#drop)"><rect x="80" y="96" width="480" height="120" rx="22" fill="#050816" stroke="url(#metal)" stroke-width="4"/></g><rect x="80" y="96" width="480" height="60" rx="22" fill="url(#glass)"/>`
      + `<text x="320" y="178" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="58" font-weight="900" letter-spacing="2" fill="url(#txt)" filter="url(#bevel)">PLAYER</text><g clip-path="url(#pl)">${sweep}</g>`
      + `<g>${[0, 1, 2, 3, 4].map(n => `<rect x="${150 + n * 70}" y="236" width="52" height="12" rx="6" fill="${p[n]}" stroke="#fff" stroke-opacity=".35"/>`).join('')}</g>`;
  }
  // effect
  const kind = it.art.kind; let fx = ''; const n = 34;
  for (let i = 0; i < n; i++) {
    const x = f1(r() * 640), y = f1(30 + r() * 280), c = [p[2], p[3], p[4]][i % 3];
    if (kind === 'embers' || kind === 'fireflies') fx += `<circle cx="${x}" cy="${y}" r="${f1(1.5 + r() * 3.5)}" fill="${c}" opacity="${f1(.5 + r() * .5)}"><animate attributeName="cy" values="${y};${f1(y - 40 - r() * 40)};${y}" dur="${f1(3 + r() * 4)}s" repeatCount="indefinite"/></circle><circle cx="${x}" cy="${y}" r="9" fill="${c}" opacity=".12"/>`;
    else if (kind === 'snow') fx += `<circle cx="${x}" cy="${y}" r="${f1(1.5 + r() * 3)}" fill="#fff" opacity="${f1(.5 + r() * .5)}"/>`;
    else if (kind === 'confetti') fx += `<rect x="${x}" y="${y}" width="${f1(5 + r() * 7)}" height="${f1(3 + r() * 4)}" fill="${c}" opacity=".9" transform="rotate(${Math.round(r() * 180)} ${x} ${y})"/>`;
    else if (kind === 'starfall') fx += `<path d="M${x} ${y} l${f1(26 + r() * 30)} ${f1(26 + r() * 30)}" stroke="${c}" stroke-width="${f1(1.2 + r() * 1.6)}" stroke-linecap="round" opacity=".85"/><circle cx="${x}" cy="${y}" r="2.4" fill="#fff"/>`;
    else if (kind === 'static') fx += `<rect x="0" y="${f1(30 + i * 8.5)}" width="640" height="${f1(1 + r() * 2)}" fill="${c}" opacity="${f1(.06 + r() * .16)}"/>`;
    else if (kind === 'fog') fx += `<ellipse cx="${x}" cy="${y}" rx="${f1(60 + r() * 80)}" ry="${f1(18 + r() * 26)}" fill="${c}" opacity=".08" filter="url(#soft)"/>`;
    else if (kind === 'aurora') { if (i < 6) fx += `<path d="M0 ${f1(80 + i * 30)} C160 ${f1(20 + i * 30 + r() * 60)} 420 ${f1(150 + i * 20 - r() * 60)} 640 ${f1(70 + i * 28)}" fill="none" stroke="${c}" stroke-width="${f1(10 + r() * 16)}" opacity=".22" filter="url(#soft)"/>`; }
    else if (kind === 'pulse') { if (i < 5) fx += `<circle cx="320" cy="168" r="${60 + i * 34}" fill="none" stroke="${c}" stroke-width="2" opacity="${f1(.6 - i * .1)}"><animate attributeName="r" values="${60 + i * 34};${74 + i * 34};${60 + i * 34}" dur="2.4s" repeatCount="indefinite"/></circle>`; }
    else fx += `<path d="M${x} ${y - 6} l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="${c}" opacity="${f1(.5 + r() * .5)}"/>`;
  }
  return fx + `<clipPath id="eav"><rect x="200" y="60" width="240" height="272"/></clipPath><g clip-path="url(#eav)">${avatarSil(320, 218, 1.55, '#050816')}</g><circle cx="320" cy="205" r="54" fill="none" stroke="url(#metal)" stroke-width="3" opacity=".6"/>`;
}
function cardSvg(it, icons = {}) {
  const p = G.PALETTES[it.palette] || G.PALETTES.neon; const r = G.rng(G.hash('card', it.id));
  const body = hero(it, p, r, icons);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 400" width="640" height="400" role="img" aria-label="${esc(it.name)}">${defs(it, p)}${stage(it, p, r)}${chrome(it, p, r)}${body}`
    + `<rect width="640" height="400" rx="26" filter="url(#noise)" opacity=".08"/><rect width="640" height="400" rx="26" fill="url(#vg)"/>${caption(it, p)}</svg>`;
}
module.exports = { cardSvg };

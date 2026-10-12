'use strict';
// v7 procedural cosmetic generator (docs/ECONOMY.md). Every generated item is a pure function of its id, so the
// shop can keep inventing new items forever without storing designs: the id encodes where the item came from
// (daily drop, weekly drop, season shop, season track, event, earned) plus a number and a slot, and the same id
// always rebuilds the same name, rarity, art and CSS. Art is original SVG/CSS (no third-party assets).
//   id = [fx-]v7<src><num>s<slot>      src: d daily, w weekly, s season, k free track, e event, b earned, p premium track,
//                                        c permanent catalog (1,000 stable original cosmetics)
const ID_RE = /^(?:fx-)?v7([dwskebpc])(\d{1,9})s(\d{1,3})$/;
const TYPES = ['banner', 'frame', 'color', 'title', 'badge', 'effect'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

function hash(...parts) { let h = 2166136261; for (const c of parts.join('|')) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return h >>> 0; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
const wpick = (r, entries) => { const tot = entries.reduce((s, e) => s + e[1], 0); let x = r() * tot; for (const [v, w] of entries) { if ((x -= w) < 0) return v; } return entries[entries.length - 1][0]; };
const f1 = (n) => Math.round(n * 10) / 10;

// ---------- palettes (bg0, bg1, accent1, accent2, accent3) ----------
const PALETTES = {
  kush: ['#03140a', '#0f3d22', '#4ade80', '#a3e635', '#facc15'], haze: ['#120624', '#3b0f63', '#c084fc', '#f0abfc', '#67e8f9'],
  sunset: ['#1a0610', '#7c2d12', '#fb923c', '#f472b6', '#fde047'], ice: ['#020617', '#0c4a6e', '#7dd3fc', '#e0f2fe', '#a5b4fc'],
  gold: ['#140c02', '#78350f', '#fbbf24', '#fde68a', '#f59e0b'], neon: ['#05011a', '#1e1b4b', '#ec4899', '#22d3ee', '#a855f7'],
  toxic: ['#071102', '#1a2e05', '#bef264', '#84cc16', '#22d3ee'], ember: ['#120303', '#450a0a', '#ef4444', '#f97316', '#fde047'],
  ocean: ['#020a17', '#083344', '#2dd4bf', '#38bdf8', '#a7f3d0'], rose: ['#17040c', '#4c0519', '#fb7185', '#fda4af', '#fcd34d'],
  chrome: ['#0b0f17', '#334155', '#e2e8f0', '#94a3b8', '#7dd3fc'], terp: ['#0c0a02', '#3f2a05', '#facc15', '#fb923c', '#a3e635'],
  galaxy: ['#030014', '#1e0b4b', '#818cf8', '#f0abfc', '#67e8f9'], lava: ['#0f0500', '#5c1d00', '#ff6b00', '#ffd23f', '#ff2e63'],
  mint: ['#011410', '#064e3b', '#6ee7b7', '#99f6e4', '#fef08a'], royal: ['#0a0418', '#312e81', '#a78bfa', '#fbbf24', '#f5f3ff'],
  arcade: ['#0a0a0a', '#1f1147', '#f43f5e', '#facc15', '#22d3ee'], frost: ['#030712', '#1e3a5f', '#bae6fd', '#ffffff', '#c4b5fd'],
  spooky: ['#0b0612', '#2e1065', '#f97316', '#a3e635', '#c084fc'], holly: ['#04130a', '#7f1d1d', '#ef4444', '#4ade80', '#fef3c7'],
  love: ['#170512', '#831843', '#f472b6', '#fecdd3', '#fb7185'], lucky: ['#021307', '#14532d', '#22c55e', '#fde047', '#bbf7d0'],
  summer: ['#06121f', '#0e7490', '#fbbf24', '#f472b6', '#5eead4'], dab: ['#120a01', '#713f12', '#fcd34d', '#fb923c', '#fef9c3'],
};
const PAL_KEYS = Object.keys(PALETTES);
const THEME_PALS = { culture: ['kush', 'haze', 'terp', 'sunset', 'mint', 'toxic', 'dab'], gaming: ['neon', 'arcade', 'galaxy', 'toxic', 'chrome', 'ocean'], money: ['gold', 'chrome', 'ice', 'royal', 'mint', 'rose'] };

// ---------- names ----------
const WORDS = {
  culture: { adj: ['Frosted', 'Sticky', 'Golden', 'Purple', 'Hazy', 'Terp', 'Cured', 'Emerald', 'Velvet', 'Midnight', 'Kief', 'Amber', 'Loud', 'Fresh-Cut', 'Mellow', 'Sun-Grown', 'Cloud', 'Resin'],
    noun: ['Canopy', 'Garden', 'Haze', 'Grove', 'Bloom', 'Greenhouse', 'Trichomes', 'Fields', 'Harvest', 'Vapor', 'Leafline', 'Glasshouse', 'Session', 'Sesh', 'Terpscape', 'Grow Room'],
    title: ['Connoisseur', 'Head Grower', 'Cloud Surfer', 'Terp Hunter', 'Rosin Royalty', 'Strain Scholar', 'Sesh Captain', 'Haze Walker', 'Trichome Tracker', 'Harvest Hero', 'Grow Guru', 'Bud Botanist'] },
  gaming: { adj: ['Neon', 'Pixel', 'Turbo', 'Glitch', 'Retro', 'Hyper', 'Laser', 'Arcade', 'Quantum', '8-Bit', 'Chrome', 'Cyber', 'Combo', 'Boss-Level', 'Overclocked', 'Warp'],
    noun: ['Grid', 'Circuit', 'Skyline', 'Warp Zone', 'Cabinet', 'High Score', 'Combo', 'Respawn', 'Boss Room', 'Power-Up', 'Pixel Storm', 'Mainframe', 'Speedrun', 'Hyperlane', 'Lobby'],
    title: ['Speedrunner', 'Combo King', 'Glitch Hunter', 'Final Boss', 'Respawn Champ', 'Pixel Prophet', 'Frame Perfect', 'Clutch Master', 'Button Masher', 'Score Chaser', 'No-Hit Hero', 'Endless Runner'] },
  money: { adj: ['Gold', 'Diamond', 'Platinum', 'Iced-Out', 'Velvet', 'Royal', 'Mint', 'Stacked', 'Marble', 'Penthouse', 'Black Card', 'Bullion', 'Gilded', 'Crystal'],
    noun: ['Vault', 'Stack', 'Chain', 'Crown', 'Penthouse', 'Mint', 'Empire', 'Skyrise', 'Ledger', 'Treasury', 'Throne', 'Jackpot', 'Ice', 'Marble Hall'],
    title: ['Big Spender', 'Vault Keeper', 'Hustle Mode', 'Self-Made', 'Boss Moves', 'Diamond Mind', 'Gold Rush', 'Stack Builder', 'Empire Maker', 'Main Character', 'Top Shelf', 'Big League'] },
};
const KIND_NOUN = { banner: '', frame: ' Frame', color: '', badge: ' Badge', effect: '' };
const EFFECT_NOUN = ['Embers', 'Aurora', 'Shimmer', 'Snowfall', 'Pulse', 'Confetti', 'Fog', 'Starfall', 'Static', 'Fireflies'];

// ---------- banner art (layered SVG scenes) ----------
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svgUri = (s) => `url("data:image/svg+xml,${s.replace(/"/g, "'").replace(/[<>#%\n{}]/g, (c) => encodeURIComponent(c))}")`;
const W = 480, H = 160;
const LEAF = 'M0-16c2 5 2 9 1 12 2-2 6-4 9-4-2 3-5 6-8 7 2 1 4 2 6 3-3 1-6 0-7-1l-1 7-1-7c-1 1-4 2-7 1 2-1 4-2 6-3-3-1-6-4-8-7 3 0 7 2 9 4-1-3-1-7 1-12z';
function wave(r, y, amp, seg) { let d = `M0 ${H} L0 ${y}`; const n = seg; for (let i = 1; i <= n; i++) { const x = (W / n) * i; d += ` Q${f1(x - W / n / 2)} ${f1(y + (r() * 2 - 1) * amp)} ${f1(x)} ${f1(y + (r() * 2 - 1) * amp * 0.4)}`; } return d + ` L${W} ${H}Z`; }
function peaks(r, y, amp, n) { let d = `M0 ${H} L0 ${y}`; for (let i = 1; i <= n; i++) d += ` L${f1((W / n) * (i - 0.5))} ${f1(y - amp * (0.4 + r() * 0.6))} L${f1((W / n) * i)} ${f1(y - r() * amp * 0.25)}`; return d + ` L${W} ${H}Z`; }
const MOTIFS = {
  skyline(r, p) {
    let s = `<circle cx='${f1(60 + r() * 360)}' cy='${f1(40 + r() * 20)}' r='${f1(18 + r() * 14)}' fill='${p[4]}' opacity='.85'/>`;
    for (let layer = 0; layer < 3; layer++) {
      let x = -10; const base = H - 12 - layer * 14; const col = layer === 2 ? p[0] : layer === 1 ? p[1] : p[1];
      while (x < W) { const w = 18 + r() * 30, h = 30 + r() * (60 - layer * 10); s += `<rect x='${f1(x)}' y='${f1(base - h + layer * 22)}' width='${f1(w)}' height='${f1(h + 40)}' fill='${col}' opacity='${[0.55, 0.8, 1][layer]}'/>`;
        if (layer === 2) for (let k = 0; k < 4; k++) if (r() < 0.55) s += `<rect x='${f1(x + 3 + r() * (w - 8))}' y='${f1(base - h + 26 + r() * h * 0.6)}' width='3' height='4' fill='${pick(r, [p[2], p[3], p[4]])}' opacity='.9'/>`;
        x += w + 2 + r() * 6; }
    }
    return s;
  },
  synthwave(r, p) {
    const cx = 120 + r() * 240; let s = `<circle cx='${f1(cx)}' cy='92' r='46' fill='url(#g2)'/>`;
    for (let i = 0; i < 6; i++) s += `<rect x='0' y='${f1(80 + i * 7)}' width='${W}' height='${f1(1.5 + i * 0.6)}' fill='${p[0]}'/>`;
    s += `<rect x='0' y='104' width='${W}' height='56' fill='${p[0]}'/>`;
    for (let i = -12; i <= 12; i++) s += `<line x1='${f1(W / 2 + i * 14)}' y1='104' x2='${f1(W / 2 + i * 70)}' y2='${H}' stroke='${p[2]}' stroke-opacity='.55' stroke-width='1'/>`;
    for (let j = 0; j < 6; j++) { const y = 104 + Math.pow(j / 6, 1.8) * 56; s += `<line x1='0' y1='${f1(y)}' x2='${W}' y2='${f1(y)}' stroke='${p[3]}' stroke-opacity='.45'/>`; }
    return s;
  },
  ridges(r, p) { let s = ''; for (let i = 0; i < 4; i++) s += `<path d='${peaks(r, 60 + i * 22, 50 - i * 8, 5 + i * 2)}' fill='${[p[3], p[2], p[1], p[0]][i]}' opacity='${[0.35, 0.55, 0.8, 1][i]}'/>`; return stars(r, p, 26) + s; },
  waves(r, p) { let s = ''; for (let i = 0; i < 5; i++) s += `<path d='${wave(r, 50 + i * 20, 16, 4 + i)}' fill='${[p[4], p[3], p[2], p[1], p[0]][i]}' opacity='${[0.3, 0.4, 0.55, 0.75, 1][i]}'/>`; return s; },
  canopy(r, p) {
    let s = `<circle cx='${f1(r() * W)}' cy='${f1(r() * 40)}' r='120' fill='${p[2]}' opacity='.18'/>`;
    for (let i = 0; i < 46; i++) { const sc = 0.6 + r() * 1.9; const o = 0.18 + (sc / 2.5) * 0.7; s += `<path d='${LEAF}' transform='translate(${f1(r() * W)} ${f1(r() * H)}) rotate(${Math.round(r() * 360)}) scale(${f1(sc)})' fill='${pick(r, [p[2], p[3], p[4]])}' opacity='${f1(o)}'/>`; }
    return s;
  },
  smoke(r, p) {
    let s = ''; for (let i = 0; i < 7; i++) { const y = 20 + r() * 120; s += `<path d='M-20 ${f1(y)} C${f1(100 + r() * 80)} ${f1(y - 60 + r() * 120)} ${f1(260 + r() * 80)} ${f1(y - 60 + r() * 120)} ${W + 20} ${f1(y - 30 + r() * 60)}' fill='none' stroke='${pick(r, [p[2], p[3], p[4]])}' stroke-width='${f1(6 + r() * 18)}' stroke-linecap='round' opacity='${f1(0.12 + r() * 0.2)}' filter='url(#bl)'/>`; }
    return s;
  },
  bokeh(r, p) { let s = ''; for (let i = 0; i < 34; i++) { const rr = 4 + r() * 26; s += `<circle cx='${f1(r() * W)}' cy='${f1(r() * H)}' r='${f1(rr)}' fill='${pick(r, [p[2], p[3], p[4]])}' opacity='${f1(0.08 + r() * 0.3)}'/>`; } return s; },
  circuit(r, p) {
    let s = ''; for (let i = 0; i < 22; i++) { let x = Math.round(r() * 24) * 20, y = Math.round(r() * 8) * 20; let d = `M${x} ${y}`; for (let k = 0; k < 4; k++) { if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * 20 * (1 + Math.floor(r() * 3)); else y += (r() < 0.5 ? -1 : 1) * 20; d += ` L${x} ${y}`; }
      const c = pick(r, [p[2], p[3], p[4]]); s += `<path d='${d}' fill='none' stroke='${c}' stroke-width='2' opacity='.55'/><circle cx='${x}' cy='${y}' r='3.5' fill='${c}'/>`; }
    return s;
  },
  shards(r, p) {
    let s = ''; const cols = 12, rows = 5; const pts = []; for (let j = 0; j <= rows; j++) { pts.push([]); for (let i = 0; i <= cols; i++) pts[j].push([i * W / cols + (i && i < cols ? (r() - 0.5) * 26 : 0), j * H / rows + (j && j < rows ? (r() - 0.5) * 20 : 0)]); }
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], d = pts[j + 1][i + 1];
      for (const tri of [[a, b, c], [b, d, c]]) s += `<path d='M${tri.map(q => f1(q[0]) + ' ' + f1(q[1])).join(' L')}Z' fill='${pick(r, [p[1], p[2], p[3], p[0], p[1]])}' opacity='${f1(0.25 + r() * 0.6)}'/>`; }
    return s;
  },
  contours(r, p) {
    let s = ''; const cx = r() * W, cy = r() * H; for (let i = 1; i < 16; i++) { const rad = i * 18; let d = ''; for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2; const rr = rad * (1 + 0.12 * Math.sin(t * 3 + i) + 0.06 * Math.sin(t * 5 + r())); d += (a ? ' L' : 'M') + f1(cx + Math.cos(t) * rr * 1.6) + ' ' + f1(cy + Math.sin(t) * rr); }
      s += `<path d='${d}Z' fill='none' stroke='${i % 3 ? p[2] : p[3]}' stroke-width='${i % 4 ? 1.2 : 2.2}' opacity='${f1(0.25 + (i % 4 ? 0 : 0.3))}'/>`; }
    return s;
  },
  aurora(r, p) { let s = stars(r, p, 30); for (let i = 0; i < 4; i++) s += `<path d='M-40 ${f1(30 + i * 22)} C120 ${f1(r() * 140)} 300 ${f1(r() * 140)} ${W + 40} ${f1(20 + i * 25)} L${W + 40} ${f1(60 + i * 25)} C300 ${f1(60 + r() * 100)} 120 ${f1(60 + r() * 100)} -40 ${f1(80 + i * 22)}Z' fill='${[p[2], p[3], p[4], p[2]][i]}' opacity='.28' filter='url(#bl)'/>`; return s; },
  galaxy(r, p) { let s = `<ellipse cx='${f1(W / 2 + (r() - 0.5) * 200)}' cy='80' rx='190' ry='38' fill='${p[2]}' opacity='.22' filter='url(#bl)' transform='rotate(${Math.round((r() - 0.5) * 30)} 240 80)'/><ellipse cx='${f1(W / 2)}' cy='80' rx='90' ry='16' fill='${p[4]}' opacity='.3' filter='url(#bl)'/>`; return s + stars(r, p, 90); },
  hexes(r, p) { // one tiled outline pattern + <use> for the lit cells keeps the file small
    const R = 16, w = R * Math.sqrt(3); const hx = (x, y) => `M${f1(x)} ${f1(y - R)}l${f1(w / 2)} ${R / 2}v${R}l${f1(-w / 2)} ${R / 2}l${f1(-w / 2)} ${-R / 2}v${-R}z`;
    let s = `<defs><path id='hx' d='${hx(0, 0)}'/><pattern id='hp' width='${f1(w)}' height='${3 * R}' patternUnits='userSpaceOnUse'><path d='${[[0, 0], [w, 0], [w / 2, 1.5 * R], [0, 3 * R], [w, 3 * R]].map(([x, y]) => hx(x, y)).join('')}' fill='none' stroke='${p[2]}' stroke-opacity='.25'/></pattern></defs><rect width='${W}' height='${H}' fill='url(#hp)'/>`;
    for (let row = -1; row < 7; row++) for (let col = -1; col < 18; col++) { if (r() >= 0.16) continue; const x = col * w + (row % 2 ? w / 2 : 0), y = row * R * 1.5;
      s += `<use href='#hx' x='${f1(x)}' y='${f1(y)}' fill='${pick(r, [p[2], p[3], p[4]])}' fill-opacity='${f1(0.3 + r() * 0.5)}'/>`; }
    return s;
  },
  stripes(r, p) { let s = ''; const ang = Math.round(-30 + r() * 60); for (let i = -10; i < 30; i++) s += `<rect x='${i * 26}' y='-200' width='${f1(6 + r() * 16)}' height='600' fill='${pick(r, [p[2], p[3], p[4], p[1]])}' opacity='${f1(0.15 + r() * 0.45)}' transform='rotate(${ang} 240 80)'/>`; return s; },
};
function stars(r, p, n) { let s = ''; for (let i = 0; i < n; i++) s += `<circle cx='${f1(r() * W)}' cy='${f1(r() * H * 0.8)}' r='${f1(0.4 + r() * 1.3)}' fill='${r() < 0.7 ? '#fff' : p[4]}' opacity='${f1(0.3 + r() * 0.7)}'/>`; return s; }
const MOTIF_KEYS = Object.keys(MOTIFS);
const THEME_MOTIFS = { culture: ['canopy', 'smoke', 'bokeh', 'waves', 'contours', 'aurora', 'ridges'], gaming: ['synthwave', 'circuit', 'hexes', 'skyline', 'shards', 'galaxy', 'stripes'], money: ['skyline', 'shards', 'stripes', 'bokeh', 'contours', 'hexes', 'waves'] };
function bannerSvg(seed, pal, motif, rarity) {
  const r = rng(seed); const p = PALETTES[pal];
  const body = MOTIFS[motif](r, p);
  const sheen = rarity === 'legendary' ? `<rect width='${W}' height='${H}' fill='url(#sh)'/>` : '';
  const vign = `<rect width='${W}' height='${H}' fill='url(#vg)'/>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${W} ${H}' preserveAspectRatio='xMidYMid slice'><defs>`
    + `<linearGradient id='g1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${p[1]}'/><stop offset='1' stop-color='${p[0]}'/></linearGradient>`
    + `<linearGradient id='g2' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='${p[4]}'/><stop offset='1' stop-color='${p[2]}'/></linearGradient>`
    + `<radialGradient id='vg' cx='.5' cy='.5' r='.75'><stop offset='.6' stop-color='#000' stop-opacity='0'/><stop offset='1' stop-color='#000' stop-opacity='.55'/></radialGradient>`
    + `<linearGradient id='sh' x1='0' y1='0' x2='1' y2='1'><stop offset='.35' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.22'/><stop offset='.65' stop-color='#fff' stop-opacity='0'/></linearGradient>`
    + `<filter id='bl' x='-20%' y='-50%' width='140%' height='200%'><feGaussianBlur stdDeviation='6'/></filter></defs>`
    + `<rect width='${W}' height='${H}' fill='url(#g1)'/>${body}${vign}${sheen}</svg>`;
}

// ---------- the generator ----------
const RARITY_BY_SRC = {
  d: (r, slot) => slot === 0 ? wpick(r, [['common', 60], ['rare', 40]]) : wpick(r, [['common', 25], ['rare', 50], ['epic', 25]]),
  c: (r, slot) => slot % 100 < 48 ? 'common' : slot % 100 < 78 ? 'rare' : slot % 100 < 95 ? 'epic' : 'legendary',
  w: (r, slot) => slot === 0 ? 'legendary' : wpick(r, [['epic', 75], ['legendary', 25]]),
  s: (r, slot) => ['rare', 'rare', 'epic', 'epic', 'legendary', 'epic'][slot % 6],
  e: (r, slot) => ['rare', 'epic', 'legendary', 'epic'][slot % 4],
  b: () => 'epic', k: () => 'rare', p: (r, slot) => (slot % 5 === 0 ? 'legendary' : 'epic'), // p = premium season pass track (src/monetize.js)
};
const TYPE_W = [['banner', 26], ['frame', 20], ['color', 16], ['title', 16], ['badge', 12], ['effect', 10]];
const BADGE_ICONS = ['crown', 'gem', 'leaf', 'diamond', 'flame', 'rocket', 'star', 'zap', 'trophy', 'medal', 'sparkles', 'heart', 'music', 'target', 'crosshair', 'castle', 'anchor', 'flask-conical', 'hand-metal', 'moon', 'sunrise', 'flame-kindling', 'wand-sparkles', 'swords', 'piggy-bank', 'banknote', 'shield-half', 'gamepad-2', 'disc-3', 'dices', 'paintbrush', 'cookie', 'cake'];
const FX_KINDS = ['embers', 'aurora', 'shimmer', 'snow', 'pulse', 'confetti', 'fog', 'starfall', 'static', 'fireflies'];
const FRAME_STYLES = ['smooth', 'segments', 'dual', 'ticks'];
const cache = new Map();
// ctx (optional, for season/event/earned items): { theme, palette, name, label, type, rarity }
function make(src, num, slot, ctx = {}) {
  const core = `v7${src}${num}s${slot}`;
  const r = rng(hash('v7item', src, num, slot));
  const rarity = ctx.rarity || RARITY_BY_SRC[src](r, slot);
  const type = ctx.type || wpick(r, TYPE_W);
  const theme = ctx.theme || pick(r, ['culture', 'gaming', 'money']);
  const pal = ctx.palette || pick(r, THEME_PALS[theme] || PAL_KEYS);
  const words = ctx.words || WORDS[theme] || WORDS[pick(r, ['culture', 'gaming', 'money'])];
  const id = (type === 'effect' ? 'fx-' : '') + core;
  const it = { id, type, rarity, theme: WORDS[theme] ? theme : ctx.themeKey || 'culture', palette: pal, src, num, slot, generated: true, art: {} };
  const p = PALETTES[pal];
  if (type === 'banner') { it.art.motif = ctx.motif || pick(r, THEME_MOTIFS[theme] || MOTIF_KEYS); it.art.seed = hash('art', core); it.name = ctx.name || `${pick(r, words.adj)} ${pick(r, words.noun)}`; }
  else if (type === 'frame') { it.art.style = pick(r, FRAME_STYLES); it.art.anim = pick(r, ['spin', 'glow', 'pulse']); it.name = ctx.name || `${pick(r, words.adj)}${KIND_NOUN.frame}`; }
  else if (type === 'color') { it.art.stops = [p[2], p[3], p[4]].slice(0, rarity === 'common' ? 2 : 3); it.art.shimmer = rarity === 'epic' || rarity === 'legendary'; it.name = ctx.name || `${pick(r, words.adj)} ${pick(r, ['Glow', 'Ink', 'Shine', 'Script', 'Tone', 'Gleam'])}`; }
  else if (type === 'title') { it.name = ctx.name || pick(r, words.title); if (!ctx.name && r() < 0.45) it.name = `${pick(r, words.adj)} ${it.name.split(' ').pop()}`; }
  else if (type === 'badge') { it.art.icon = ctx.icon || pick(r, BADGE_ICONS); it.name = ctx.name || `${pick(r, words.adj)}${KIND_NOUN.badge}`; }
  else { it.art.kind = pick(r, FX_KINDS); it.art.hue = Math.round(r() * 360); it.name = ctx.name || `${pick(r, words.adj)} ${EFFECT_NOUN[FX_KINDS.indexOf(it.art.kind)]}`; }
  if (ctx.label) it.label = ctx.label;
  it.extra = itemCss(it, true); // inline preview value (banner background / frame bg / color gradient)
  return it;
}
// CSS for one generated item. inline=true returns just the main value (used in API previews).
function itemCss(it, inline = false) {
  const p = PALETTES[it.palette] || PALETTES.neon;
  if (it.type === 'banner') { const v = `${svgUri(bannerSvg(it.art.seed, it.palette, it.art.motif, it.rarity))} center/cover no-repeat`; return inline ? v : `.bn-${it.id}{background:${v};background-color:${p[0]}}`; }
  if (it.type === 'frame') {
    const st = it.art.style; const v = st === 'segments' ? `repeating-conic-gradient(${p[2]} 0 18deg,${p[1]} 18deg 30deg,${p[3]} 30deg 48deg,${p[1]} 48deg 60deg)` : st === 'dual' ? `conic-gradient(${p[2]},${p[2]} 25%,${p[3]} 25% 50%,${p[2]} 50% 75%,${p[3]} 75%)`
      : st === 'ticks' ? `repeating-conic-gradient(${p[4]} 0 4deg,${p[1]} 4deg 15deg),conic-gradient(${p[2]},${p[3]},${p[2]})` : `conic-gradient(${p[2]},${p[3]},${p[4]},${p[2]})`;
    if (inline) return v + '|' + it.art.anim;
    return `.fr-${it.id}{--frame-bg:${v}}\n.fr-${it.id}::before{animation:${{ spin: 'fr-spin 5s linear infinite', glow: 'fr-glow 2.6s ease-in-out infinite', pulse: 'fr-pulse 1.6s ease-in-out infinite' }[it.art.anim]}}`;
  }
  if (it.type === 'color') { const v = `linear-gradient(90deg,${it.art.stops.join(',')}${it.art.shimmer ? ',' + it.art.stops[0] : ''})`; return inline ? v : `.nc-${it.id} .nt{background:${v};${it.art.shimmer ? 'background-size:200% 100%;animation:v7-shimmer 4s linear infinite;' : ''}-webkit-background-clip:text;background-clip:text;color:transparent}`; }
  if (it.type === 'effect') { const v = fxBody(it.art.kind, p, it.art.hue); return inline ? it.art.kind : `.fx.${it.id}::before{${v}}`; }
  if (it.type === 'badge') return inline ? it.art.icon : '';
  return '';
}
function fxBody(kind, p, hue) {
  const c = (i, a) => { const h = p[i].replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  switch (kind) {
    case 'embers': return `background-image:radial-gradient(circle,${c(2, 0.9)} 0 1.5px,transparent 2.5px),radial-gradient(circle,${c(4, 0.8)} 0 1px,transparent 2px);background-size:38px 46px,57px 61px;animation:v7-rise 4s linear infinite`;
    case 'aurora': return `background:linear-gradient(115deg,transparent 20%,${c(2, 0.35)} 40%,${c(3, 0.3)} 55%,transparent 75%);background-size:250% 100%;animation:v7-sweep 7s ease-in-out infinite alternate`;
    case 'shimmer': return `background:linear-gradient(100deg,transparent 35%,${c(4, 0.35)} 50%,transparent 65%);background-size:300% 100%;animation:v7-sweep 3.2s linear infinite`;
    case 'snow': return `background-image:radial-gradient(circle,rgba(255,255,255,.9) 0 1.6px,transparent 2.4px),radial-gradient(circle,${c(4, 0.7)} 0 1px,transparent 2px);background-size:44px 44px,67px 59px;animation:v7-fall 6s linear infinite`;
    case 'pulse': return `box-shadow:inset 0 0 26px ${c(2, 0.75)},inset 0 0 52px ${c(3, 0.45)};animation:fx-pulse 2s ease-in-out infinite`;
    case 'confetti': return `background-image:linear-gradient(${p[2]} 0 0),linear-gradient(${p[3]} 0 0),linear-gradient(${p[4]} 0 0);background-size:5px 9px,7px 4px,4px 7px;background-repeat:repeat;background-position:0 0,23px 31px,41px 13px;animation:v7-fall 5s linear infinite;opacity:.55`;
    case 'fog': return `background:radial-gradient(45% 35% at 25% 75%,${c(3, 0.3)},transparent 70%),radial-gradient(40% 30% at 75% 35%,${c(2, 0.25)},transparent 70%);animation:fx-drift 10s ease-in-out infinite alternate`;
    case 'starfall': return `background-image:linear-gradient(160deg,transparent 46%,${c(4, 0.9)} 50%,transparent 54%);background-size:120px 120px;animation:v7-fall 2.6s linear infinite;opacity:.7`;
    case 'static': return `background-image:repeating-linear-gradient(0deg,${c(2, 0.12)} 0 1px,transparent 1px 3px),repeating-linear-gradient(90deg,${c(3, 0.08)} 0 1px,transparent 1px 4px);animation:v7-jitter .4s steps(3) infinite`;
    default: return `background-image:radial-gradient(circle,${c(4, 0.95)} 0 2px,${c(2, 0.25)} 3px,transparent 6px),radial-gradient(circle,${c(3, 0.9)} 0 1.5px,transparent 4px),radial-gradient(circle,${c(4, 0.7)} 0 1px,transparent 3px);background-size:71px 63px,97px 89px,131px 113px;background-position:0 0,37px 21px,13px 57px;animation:v7-float 5s ease-in-out infinite alternate;filter:hue-rotate(${hue % 40}deg)`;
  }
}
const KEYFRAMES = '@keyframes v7-shimmer{to{background-position:-200% 0}}@keyframes v7-rise{from{background-position:0 160px,20px 200px}to{background-position:0 0,40px 0}}'
  + '@keyframes v7-fall{from{background-position:0 -80px,30px -60px,10px -40px}to{background-position:20px 160px,0 200px,40px 180px}}@keyframes v7-sweep{from{background-position:100% 0}to{background-position:-100% 0}}'
  + '@keyframes v7-jitter{50%{transform:translate(1px,-1px)}}@keyframes v7-float{from{background-position:0 0}to{background-position:18px -24px}}'
  + '@media (prefers-reduced-motion: reduce){[class*=nc-v7] .nt{animation:none!important}}';
function parse(id) {
  if (cache.has(id)) return cache.get(id);
  const m = ID_RE.exec(String(id)); if (!m) return null;
  const ctxFn = parse.contexts[m[1]]; const ctx = ctxFn ? ctxFn(+m[2], +m[3]) : {};
  if (ctx === null) return null;
  const it = make(m[1], +m[2], +m[3], ctx);
  if (it.id !== id) return null; // effect ids must carry fx-, others must not
  cache.set(id, it); return it;
}
parse.contexts = {}; // shop.js / seasons.js register context builders for s, k, e, b items (theme, fixed type, names)
// medallion SVG used for badge previews in the shop
function badgeArt(it, iconPaths = '') {
  const p = PALETTES[it.palette] || PALETTES.neon; const rim = { common: ['#e2e8f0', '#64748b'], rare: ['#bfdbfe', '#2563eb'], epic: ['#f5d0fe', '#9333ea'], legendary: ['#fef08a', '#db2777'] }[it.rarity] || ['#fff', '#888'];
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><defs><linearGradient id='r' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${rim[0]}'/><stop offset='1' stop-color='${rim[1]}'/></linearGradient><radialGradient id='f' cx='.35' cy='.3' r='.8'><stop offset='0' stop-color='${p[2]}'/><stop offset='1' stop-color='${p[1]}'/></radialGradient></defs>`
    + `<circle cx='50' cy='50' r='46' fill='url(#r)'/><circle cx='50' cy='50' r='39' fill='url(#f)'/><circle cx='50' cy='50' r='30' fill='none' stroke='#fff' stroke-opacity='.15' stroke-width='5'/><g transform='translate(26 26) scale(2)' fill='none' stroke='#fff' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'>${iconPaths}</g></svg>`;
}
module.exports = { make, parse, itemCss, KEYFRAMES, PALETTES, PAL_KEYS, MOTIFS, MOTIF_KEYS, WORDS, hash, rng, ID_RE, TYPES, RARITIES, bannerSvg, svgUri, badgeArt };

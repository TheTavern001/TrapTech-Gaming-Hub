'use strict';
// v7 Phase 5: customizable player avatars (cosmetic only). An avatar is a small JSON of part ids stored on the user;
// the server renders it to a ~2-4 KB SVG (GET /avatar/<username>.svg), cached by ETag. Parts are free, bought with Hub
// Crowns, earned (achievements) or Prestige-only (the held cane / cash stack / gold crown). Never affects gameplay.
const crypto = require('crypto');
const db = require('./db');
try { db.prepare('SELECT avatar FROM users LIMIT 1').get(); } catch { db.exec("ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ''"); }
db.exec('CREATE TABLE IF NOT EXISTS avatar_parts_owned (user_id INTEGER NOT NULL, part TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, part))');

const SKIN = ['#f9d7b9', '#f1c19b', '#e0a679', '#c98a5b', '#a8693f', '#8a5232', '#6b3d22', '#4a2915'];
const HAIRC = ['#1b1b1f', '#4a2f1d', '#7b4a24', '#c58b3c', '#e8c46a', '#d9d4cc', '#c2410c', '#7c3aed', '#22d3ee', '#16a34a'];
const EYEC = ['#111827', '#2563eb', '#22d3ee', '#16a34a', '#a16207', '#a855f7', '#f8fafc', '#ef4444'];
const BG = { violet: ['#7c3aed', '#22d3ee'], night: ['#0f172a', '#4338ca'], kush: ['#14532d', '#84cc16'], sunset: ['#f97316', '#db2777'], ocean: ['#0369a1', '#22d3ee'], haze: ['#6b21a8', '#f0abfc'], mono: ['#27272a', '#71717a'], toxic: ['#166534', '#facc15'],
  'gold-rays': ['#78350f', '#facc15'], 'cash-rain': ['#052e16', '#22c55e'] };
// part catalog: [kind, id, label, unlock]  unlock: 'free' | { crowns: n } | { ach: n } | { prestige: itemId }
const P = [];
const add = (kind, id, label, unlock = 'free') => P.push({ kind, id, label, unlock });
Object.keys(BG).forEach(k => add('bg', k, k.replace('-', ' '), k === 'gold-rays' ? { prestige: 'prestige-crown' } : k === 'cash-rain' ? { prestige: 'prestige-throne' } : k === 'toxic' ? { ach: 25 } : 'free'));
SKIN.forEach((c, i) => add('skin', 's' + i, 'Tone ' + (i + 1)));
['round', 'oval', 'square'].forEach(f => add('face', f, f));
['none', 'buzz', 'curly', 'afro', 'long', 'bun', 'mohawk', 'braids', 'waves', 'spiky'].forEach(h => add('hair', h, h));
HAIRC.forEach((c, i) => add('hairc', 'c' + i, 'Color ' + (i + 1), i >= 7 ? { crowns: 150 } : 'free'));
['dot', 'happy', 'sleepy', 'wink', 'wide'].forEach(e => add('eyes', e, e)); add('eyes', 'star', 'star eyes', { ach: 15 });
['smile', 'grin', 'flat', 'open', 'smirk'].forEach(m => add('mouth', m, m));
['none', 'mustache', 'goatee', 'beard'].forEach(b => add('beard', b, b));
add('outfit', 'tee', 'tee'); add('outfit', 'hoodie', 'hoodie'); add('outfit', 'jersey', 'jersey'); add('outfit', 'tracksuit', 'tracksuit', { crowns: 300 }); add('outfit', 'chain-tee', 'tee + gold chain', { crowns: 600 }); add('outfit', 'fur', 'fur coat', { crowns: 900 });
add('hat', 'none', 'none'); add('hat', 'beanie', 'beanie'); add('hat', 'snapback', 'snapback'); add('hat', 'bucket', 'bucket hat', { crowns: 250 }); add('hat', 'halo', 'halo', { ach: 30 }); add('hat', 'crown', 'solid gold crown', { prestige: 'prestige-crown' });
add('acc', 'none', 'none'); add('acc', 'glasses', 'glasses'); add('acc', 'shades', 'shades'); add('acc', 'grill', 'diamond grill', { crowns: 800 });
['#111827', '#2563eb', '#22d3ee', '#16a34a', '#a16207', '#a855f7', '#f8fafc', '#ef4444'].forEach((c, i) => add('eyec', 'e' + i, ['Dark brown', 'Blue', 'Ice cyan', 'Green', 'Amber', 'Violet', 'Silver', 'Crimson'][i], i >= 5 ? { crowns: 120 } : 'free'));
['natural', 'bold', 'angled', 'none'].forEach((x) => add('brow', x, x));
['none', 'freckles', 'scar', 'war-paint'].forEach((x, i) => add('mark', x, x === 'war-paint' ? 'war paint' : x, i === 3 ? { crowns: 180 } : 'free'));
['none', 'nose-ring', 'ear-studs', 'double-piercing'].forEach((x, i) => add('piercing', x, x === 'double-piercing' ? 'nose + ear piercings' : x.replace('-', ' '), i === 3 ? { crowns: 200 } : 'free'));
['none', 'silver-chain', 'gold-chain', 'diamond-pendant'].forEach((x, i) => add('neck', x, x.replace(/-/g, ' '), i === 2 ? { crowns: 220 } : i === 3 ? { crowns: 500 } : 'free'));
add('outfit', 'armor', 'carbon armor', { crowns: 700 }); add('outfit', 'techwear', 'techwear jacket', { crowns: 500 }); add('outfit', 'varsity', 'varsity jacket', { crowns: 350 });
add('held', 'none', 'none'); add('held', 'controller', 'controller'); add('held', 'cane', 'diamond cane', { prestige: 'prestige-cane' }); add('held', 'cash', 'cash stack', { prestige: 'prestige-throne' });
const KINDS = ['bg', 'skin', 'face', 'hair', 'hairc', 'brow', 'eyes', 'eyec', 'mouth', 'mark', 'beard', 'piercing', 'outfit', 'neck', 'hat', 'acc', 'held'];
const BYK = {}; for (const p of P) (BYK[p.kind] = BYK[p.kind] || {})[p.id] = p;
const key = (p) => p.kind + ':' + p.id;
function hashOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function defaultFor(name) { const h = hashOf(name); const pick = (k, n) => Object.keys(BYK[k]).filter(id => BYK[k][id].unlock === 'free')[(h >>> n) % Object.keys(BYK[k]).filter(id => BYK[k][id].unlock === 'free').length];
  return { bg: pick('bg', 1), skin: pick('skin', 4), face: pick('face', 7), hair: pick('hair', 9), hairc: pick('hairc', 13), brow: pick('brow', 15), eyes: pick('eyes', 16), eyec: pick('eyec', 18), mouth: pick('mouth', 19), mark: pick('mark', 20), beard: (h >>> 22) % 4 === 0 ? pick('beard', 23) : 'none', piercing: pick('piercing', 24), outfit: pick('outfit', 25), neck: pick('neck', 26), hat: 'none', acc: (h >>> 27) % 3 === 0 ? 'glasses' : 'none', held: 'none' }; }
function clean(cfg, base) { const out = { ...base }; for (const k of KINDS) if (cfg && BYK[k][cfg[k]]) out[k] = cfg[k]; return out; }
function configOf(user) { let c = {}; try { c = JSON.parse(user.avatar || '{}'); } catch {} return clean(c, defaultFor(user.username)); }
// ownership
function owns(userId, part, ctx) { const u = part.unlock; if (u === 'free') return true;
  if (u.crowns) return !!db.prepare('SELECT 1 FROM avatar_parts_owned WHERE user_id=? AND part=?').get(userId, key(part));
  if (u.ach) return (ctx.ach ?? (ctx.ach = achCount(userId))) >= u.ach;
  if (u.prestige) return (ctx.px ?? (ctx.px = new Set(require('./monetize').prestigeOf(userId).map(r => r.item_id)))).has(u.prestige);
  return false; }
function achCount(userId) { try { return db.prepare('SELECT COUNT(*) c FROM user_achievements WHERE user_id=?').get(userId).c; } catch { return 0; } }
// ---- SVG ----
function svg(c) {
  const s = SKIN[+c.skin.slice(1)] || SKIN[2]; const hc = HAIRC[+c.hairc.slice(1)] || HAIRC[0]; const eyeColor = EYEC[+String(c.eyec || 'e0').slice(1)] || EYEC[0]; const [b1, b2] = BG[c.bg] || BG.violet; const o = []; const shirt = { tee: '#3b82f6', hoodie: '#334155', jersey: '#dc2626', tracksuit: '#111827', 'chain-tee': '#f8fafc', fur: '#a16207', armor: '#475569', techwear: '#111827', varsity: '#7c2d12' }[c.outfit] || '#3b82f6';
  o.push(`<defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset=".58" stop-color="${b2}"/><stop offset="1" stop-color="#050714"/></linearGradient>
    <linearGradient id="skin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".48"/><stop offset=".23" stop-color="${s}"/><stop offset=".7" stop-color="${s}"/><stop offset="1" stop-color="#24130e" stop-opacity=".38"/></linearGradient>
    <linearGradient id="hair" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".22" stop-color="${hc}"/><stop offset=".72" stop-color="${hc}"/><stop offset="1" stop-color="#080912"/></linearGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".24" stop-color="${shirt}"/><stop offset=".78" stop-color="${shirt}"/><stop offset="1" stop-color="#050714" stop-opacity=".55"/></linearGradient>
    <linearGradient id="au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4bd"/><stop offset=".38" stop-color="#f59e0b"/><stop offset="1" stop-color="#fff7cc"/></linearGradient>
    <radialGradient id="face-light" cx=".28" cy=".22" r=".82"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".62" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#100a0a" stop-opacity=".18"/></radialGradient>
    <filter id="drop" x="-30%" y="-30%" width="160%" height="170%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.5"/><feOffset dy="3"/><feComponentTransfer><feFuncA type="linear" slope=".45"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs><rect width="120" height="120" rx="24" fill="url(#g)"/><ellipse cx="60" cy="60" rx="48" ry="54" fill="${b2}" opacity=".16"/>`);
  if (c.bg === 'gold-rays') o.push('<g opacity=".35" fill="#fef3c7">' + [0, 30, 60, 90, 120, 150].map(a => `<path d="M60 60 L${60 + 90 * Math.cos(a * Math.PI / 180)} ${60 + 90 * Math.sin(a * Math.PI / 180)} L${60 + 90 * Math.cos((a + 10) * Math.PI / 180)} ${60 + 90 * Math.sin((a + 10) * Math.PI / 180)}Z"/>`).join('') + '<animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="24s" repeatCount="indefinite"/></g>');
  if (c.bg === 'cash-rain') o.push('<g fill="#86efac" opacity=".55">' + [12, 34, 58, 82, 104].map((x, i) => `<rect x="${x}" y="-12" width="12" height="7" rx="1"><animate attributeName="y" from="-12" to="124" dur="${3 + i * 0.6}s" repeatCount="indefinite"/></rect>`).join('') + '</g>');
  o.push(`<path d="M18 120 C22 92 40 84 60 84 C80 84 98 92 102 120Z" fill="url(#shirt)"/>`);
  if (c.outfit === 'hoodie') o.push('<path d="M42 88 C48 100 72 100 78 88" fill="none" stroke="#1e293b" stroke-width="4"/>');
  if (c.outfit === 'jersey') o.push('<text x="60" y="112" font-size="16" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">7</text>');
  if (c.outfit === 'tracksuit') o.push('<path d="M34 120 L40 90 M86 120 L80 90" stroke="#22d3ee" stroke-width="3"/>');
  if (c.outfit === 'fur') o.push('<path d="M22 118 C26 96 40 88 50 88 L56 120Z M98 118 C94 96 80 88 70 88 L64 120Z" fill="#fde68a" opacity=".85"/>');
  if (c.outfit === 'chain-tee') o.push('<path d="M44 88 Q60 108 76 88" fill="none" stroke="url(#au)" stroke-width="3.5" stroke-dasharray="4 2"/><circle cx="60" cy="102" r="5" fill="url(#au)"/>');
  if (c.outfit === 'armor') o.push('<path d="M24 100 L36 87 L48 93 L60 90 L72 93 L84 87 L96 100 L90 120 L30 120Z" fill="#334155" stroke="#94a3b8" stroke-width="2"/><path d="M42 94 L60 106 L78 94 M60 106 L60 120" stroke="#22d3ee" stroke-width="2" fill="none"/><circle cx="60" cy="101" r="3" fill="#67e8f9"/>');
  if (c.outfit === 'techwear') o.push('<path d="M25 103 L39 89 L50 94 L60 91 L70 94 L81 89 L95 103 L88 120 L32 120Z" fill="#0f172a" stroke="#64748b" stroke-width="1.5"/><path d="M38 100 L48 114 M82 100 L72 114" stroke="#22d3ee" stroke-width="3"/><rect x="54" y="103" width="12" height="7" rx="2" fill="#22d3ee"/>');
  if (c.outfit === 'varsity') o.push('<path d="M25 103 L39 89 L50 94 L60 91 L70 94 L81 89 L95 103 L88 120 L32 120Z" fill="#7c2d12" stroke="#fbbf24" stroke-width="2"/><path d="M60 93 L60 120 M36 106 L45 110 M84 106 L75 110" stroke="#fff7ed" stroke-width="2"/>');
  if (c.neck === 'silver-chain' || c.neck === 'gold-chain' || c.neck === 'diamond-pendant') { const nc = c.neck === 'silver-chain' ? '#cbd5e1' : '#fbbf24'; o.push(`<path d="M43 91 Q60 112 77 91" fill="none" stroke="${nc}" stroke-width="3"/><path d="M60 105 L66 111 L60 118 L54 111Z" fill="${c.neck === 'diamond-pendant' ? '#67e8f9' : nc}" stroke="#fff" stroke-width=".8"/>`); }
  o.push(`<rect x="52" y="72" width="16" height="16" rx="6" fill="url(#skin)"/>`);
  const face = c.face === 'square' ? `<rect x="34" y="28" width="52" height="54" rx="16" fill="url(#skin)"/>` : c.face === 'oval' ? `<ellipse cx="60" cy="54" rx="25" ry="29" fill="url(#skin)"/>` : `<circle cx="60" cy="55" r="27" fill="url(#skin)"/>`;
  if (c.hair === 'long' || c.hair === 'braids') o.push(`<path d="M32 50 C30 30 44 22 60 22 C76 22 90 30 88 50 L92 92 L76 90 L74 60 L46 60 L44 90 L28 92Z" fill="url(#hair)"/>`);
  if (c.hair === 'afro') o.push(`<circle cx="60" cy="42" r="34" fill="url(#hair)"/>`);
  if (c.hair === 'bun') o.push(`<circle cx="60" cy="20" r="10" fill="url(#hair)"/>`);
  o.push(`<circle cx="33" cy="56" r="5" fill="url(#skin)"/><circle cx="87" cy="56" r="5" fill="url(#skin)"/>`, face, `<path d="M37 42 C40 29 51 26 60 27 C72 28 82 36 83 49 C76 39 68 36 60 36 C51 36 43 39 37 48Z" fill="url(#face-light)"/><ellipse cx="47" cy="47" rx="7" ry="14" fill="#fff" opacity=".07"/>`);
  const HAIR = { buzz: `<path d="M35 46 C36 30 48 26 60 26 C72 26 84 30 85 46 C80 38 70 34 60 34 C50 34 40 38 35 46Z" fill="url(#hair)" opacity=".9"/>`,
    curly: `<g fill="url(#hair)">${[38, 46, 54, 62, 70, 78, 84].map((x, i) => `<circle cx="${x}" cy="${32 + (i % 2) * 3}" r="8"/>`).join('')}</g>`,
    afro: `<path d="M33 50 C33 34 46 28 60 28 C74 28 87 34 87 50 C80 40 70 37 60 37 C50 37 40 40 33 50Z" fill="url(#hair)"/>`,
    long: `<path d="M33 52 C33 32 46 26 60 26 C74 26 87 32 87 52 C78 40 66 36 52 40 C44 42 38 46 33 52Z" fill="url(#hair)"/>`,
    bun: `<path d="M34 48 C35 32 47 27 60 27 C73 27 85 32 86 48 C80 38 70 35 60 35 C50 35 40 38 34 48Z" fill="url(#hair)"/>`,
    mohawk: `<path d="M54 40 L56 12 L60 22 L64 10 L66 40Z" fill="url(#hair)"/>`,
    braids: `<path d="M33 52 C33 32 46 26 60 26 C74 26 87 32 87 52 C80 40 70 37 60 37 C50 37 40 40 33 52Z" fill="url(#hair)"/><g stroke="url(#hair)" stroke-width="4" stroke-dasharray="3 2"><path d="M34 58 L32 92"/><path d="M86 58 L88 92"/></g>`,
    waves: `<path d="M35 46 C36 30 48 26 60 26 C72 26 84 30 85 46 C80 38 70 34 60 34 C50 34 40 38 35 46Z" fill="url(#hair)"/><path d="M40 36 Q46 32 52 36 T64 36 T76 36" stroke="#000" stroke-opacity=".25" fill="none"/>`,
    spiky: `<path d="M34 46 L38 26 L44 36 L50 20 L56 34 L62 18 L68 34 L74 22 L78 36 L84 28 L86 46 C78 38 68 35 60 35 C50 35 40 38 34 46Z" fill="url(#hair)"/>` };
  if (HAIR[c.hair]) o.push(HAIR[c.hair]);
  const BR = { natural: '<path d="M43 47 Q50 43 56 47 M64 47 Q70 43 77 47" stroke="#35251d" stroke-width="2" fill="none" stroke-linecap="round"/>', bold: '<path d="M42 47 Q50 41 57 46 M63 46 Q70 41 78 47" stroke="#211712" stroke-width="4" fill="none" stroke-linecap="round"/>', angled: '<path d="M42 45 L57 49 M63 49 L78 45" stroke="#211712" stroke-width="3" fill="none" stroke-linecap="round"/>' }; if (BR[c.brow]) o.push(BR[c.brow]);
  const EY = { dot: `<circle cx="50" cy="55" r="3.2" fill="${eyeColor}" stroke="#111827" stroke-width=".8"/><circle cx="70" cy="55" r="3.2" fill="${eyeColor}" stroke="#111827" stroke-width=".8"/>`, happy: '<path d="M45 56 Q50 50 55 56 M65 56 Q70 50 75 56" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    sleepy: '<path d="M45 55 L55 55 M65 55 L75 55" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>', wink: '<circle cx="50" cy="55" r="3.2" fill="#111"/><path d="M65 56 Q70 51 75 56" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    wide: `<circle cx="50" cy="55" r="5" fill="#fff"/><circle cx="70" cy="55" r="5" fill="#fff"/><circle cx="51" cy="56" r="2.6" fill="${eyeColor}"/><circle cx="71" cy="56" r="2.6" fill="${eyeColor}"/>`,
    star: '<g fill="#facc15">' + [50, 70].map(x => `<path d="M${x} 49 L${x + 1.8} 53.5 L${x + 6} 54 L${x + 2.8} 57 L${x + 3.8} 61.5 L${x} 59 L${x - 3.8} 61.5 L${x - 2.8} 57 L${x - 6} 54 L${x - 1.8} 53.5Z"/>`).join('') + '</g>' };
  o.push(EY[c.eyes] || EY.dot);
  if (c.mark === 'freckles') o.push('<g fill="#6b3d22" opacity=".72">' + [43,48,53,67,72,77].map(x=>`<circle cx="${x}" cy="61" r=".8"/>`).join('') + '</g>');
  if (c.mark === 'scar') o.push('<path d="M72 39 L64 47 L70 50 L63 58" stroke="#9f4b45" stroke-width="2.5" fill="none" stroke-linecap="round"/>');
  if (c.mark === 'war-paint') o.push('<path d="M38 51 L53 58 L50 62 L36 56Z M82 51 L67 58 L70 62 L84 56Z" fill="#22d3ee" opacity=".85"/>');
  if (c.piercing === 'nose-ring' || c.piercing === 'double-piercing') o.push('<circle cx="61" cy="63" r="2.8" fill="none" stroke="#e5e7eb" stroke-width="1.5"/><circle cx="61" cy="63" r="1" fill="#fbbf24"/>');
  if (c.piercing === 'ear-studs' || c.piercing === 'double-piercing') o.push('<circle cx="33" cy="61" r="2.1" fill="#fbbf24" stroke="#fff" stroke-width=".6"/><circle cx="87" cy="61" r="2.1" fill="#fbbf24" stroke="#fff" stroke-width=".6"/>');
  const MO = { smile: '<path d="M51 68 Q60 75 69 68" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>', grin: '<path d="M50 66 Q60 78 70 66Z" fill="#111"/><path d="M52 67 L68 67" stroke="#fff" stroke-width="2.4"/>',
    flat: '<path d="M52 69 L68 69" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>', open: '<ellipse cx="60" cy="69" rx="6" ry="5" fill="#111"/>', smirk: '<path d="M52 69 Q62 72 69 65" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>' };
  o.push(MO[c.mouth] || MO.smile);
  if (c.acc === 'grill') o.push('<path d="M51 68 Q60 75 69 68" stroke="#e0f2fe" stroke-width="4" fill="none"/><g fill="#fff">' + [53, 57, 61, 65].map(x => `<circle cx="${x + 1}" cy="${70 - (x === 57 || x === 61 ? -1 : 0)}" r=".9"><animate attributeName="opacity" values="1;.2;1" dur="1.6s" begin="${(x % 4) * 0.3}s" repeatCount="indefinite"/></circle>`).join('') + '</g>');
  const BE = { mustache: `<path d="M50 64 Q55 60 60 63 Q65 60 70 64 Q65 66 60 65 Q55 66 50 64Z" fill="url(#hair)"/>`, goatee: `<path d="M54 74 Q60 84 66 74 Q60 78 54 74Z" fill="url(#hair)"/>`, beard: `<path d="M34 58 C36 80 48 86 60 86 C72 86 84 80 86 58 C80 72 72 76 60 76 C48 76 40 72 34 58Z" fill="url(#hair)"/>` };
  if (BE[c.beard]) o.push(BE[c.beard]);
  if (c.acc === 'glasses') o.push('<g fill="none" stroke="#111" stroke-width="2.2"><circle cx="50" cy="55" r="7"/><circle cx="70" cy="55" r="7"/><path d="M57 55 L63 55"/></g>');
  if (c.acc === 'shades') o.push('<path d="M41 50 L59 50 L57 60 L44 60Z M61 50 L79 50 L76 60 L63 60Z" fill="#0b0b0f"/><path d="M59 52 L61 52" stroke="#0b0b0f" stroke-width="2"/>');
  const HAT = { beanie: '<path d="M33 46 C33 26 46 20 60 20 C74 20 87 26 87 46Z" fill="#ef4444"/><rect x="31" y="42" width="58" height="8" rx="4" fill="#b91c1c"/><circle cx="60" cy="18" r="5" fill="#fff"/>',
    snapback: '<path d="M34 44 C34 28 46 22 60 22 C74 22 86 28 86 44Z" fill="#111827"/><path d="M60 42 L98 44 L96 48 L60 47Z" fill="#111827"/><circle cx="60" cy="32" r="4" fill="#22d3ee"/>',
    bucket: '<path d="M38 42 L42 22 L78 22 L82 42Z" fill="#65a30d"/><path d="M26 44 L94 44 L88 38 L32 38Z" fill="#4d7c0f"/>',
    halo: '<ellipse cx="60" cy="20" rx="20" ry="5" fill="none" stroke="#fde047" stroke-width="3"><animate attributeName="cy" values="20;17;20" dur="3s" repeatCount="indefinite"/></ellipse>',
    crown: '<path d="M38 36 L40 14 L50 26 L60 10 L70 26 L80 14 L82 36Z" fill="url(#au)" stroke="#92400e" stroke-width="1.2"/><circle cx="60" cy="27" r="3.5" fill="#10b981"/><circle cx="46" cy="30" r="2" fill="#e0f2fe"/><circle cx="74" cy="30" r="2" fill="#e0f2fe"/><rect x="38" y="33" width="44" height="4" fill="#fbbf24"/>' };
  if (HAT[c.hat]) o.push(HAT[c.hat]);
  const HE = { controller: '<g transform="translate(78 92) rotate(-12)"><rect width="30" height="16" rx="8" fill="#111827"/><circle cx="8" cy="8" r="2.5" fill="#22d3ee"/><circle cx="22" cy="6" r="1.8" fill="#f472b6"/><circle cx="25" cy="10" r="1.8" fill="#a3e635"/></g>',
    cane: '<g><path d="M98 120 L98 74" stroke="url(#au)" stroke-width="4"/><path d="M98 74 C98 62 110 62 110 72" stroke="url(#au)" stroke-width="4" fill="none"/><path d="M93 74 L98 64 L103 74 L98 80Z" fill="#e0f2fe" stroke="#93c5fd"/><circle cx="98" cy="70" r="1.6" fill="#fff"><animate attributeName="opacity" values="1;.1;1" dur="1.2s" repeatCount="indefinite"/></circle></g>',
    cash: '<g transform="translate(82 94)">' + [0, 5, 10].map(y => `<rect y="${12 - y}" width="26" height="6" rx="1" fill="#16a34a" stroke="#14532d"/>`).join('') + '<rect x="9" y="2" width="8" height="16" fill="#facc15" opacity=".9"/></g>' };
  if (HE[c.held]) o.push(HE[c.held]);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${o.join('')}</svg>`;
}
function partsFor(userId) { const ctx = {}; return P.map(p => ({ kind: p.kind, id: p.id, label: p.label, unlock: p.unlock, owned: userId ? owns(userId, p, ctx) : p.unlock === 'free', crowns: p.unlock.crowns || 0 })); }
function routes(app, H) {
  const { requireUser, currentUser, bad } = H; const cache = new Map();
  app.get('/avatar/:u.svg', (req, res) => { const u = db.prepare('SELECT id, username, avatar FROM users WHERE username=? COLLATE NOCASE').get(String(req.params.u));
    const cfg = u ? configOf(u) : defaultFor(req.params.u); const body = svg(cfg); const et = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 16) + '"';
    res.set({ 'Cache-Control': 'public, max-age=300', ETag: et, 'Content-Type': 'image/svg+xml' }); if (req.headers['if-none-match'] === et) return res.status(304).end(); res.send(body); });
  app.get('/avatar-preview.svg', (req, res) => { let c = {}; try { c = JSON.parse(String(req.query.c || '{}')); } catch {} res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg(clean(c, defaultFor('preview')))); });
  app.get('/api/avatar', requireUser, (req, res) => res.json({ ok: true, avatar: configOf(req.user), kinds: KINDS, parts: partsFor(req.user.id), bg: BG, skin: SKIN, hair_colors: HAIRC, crowns: require('./monetize').crowns(req.user.id) }));
  app.put('/api/avatar', requireUser, (req, res) => { const want = clean(req.body && req.body.avatar, configOf(req.user)); const ctx = {};
    for (const k of KINDS) { const p = BYK[k][want[k]]; if (!owns(req.user.id, p, ctx)) return bad(res, 403, `Unlock "${p.label}" first.`); }
    db.prepare('UPDATE users SET avatar=? WHERE id=?').run(JSON.stringify(want), req.user.id); res.json({ ok: true, avatar: want }); });
  app.post('/api/avatar/buy', requireUser, (req, res) => { const [k, id] = String((req.body || {}).part || '').split(':'); const p = BYK[k] && BYK[k][id]; if (!p || !p.unlock.crowns) return bad(res, 400, 'That part is not sold for Crowns.');
    const M = require('./monetize'); const t = Date.now();
    const r = db.transaction(() => { if (db.prepare('SELECT 1 FROM avatar_parts_owned WHERE user_id=? AND part=?').get(req.user.id, key(p))) return { error: 'You already own it.' };
      if (M.crowns(req.user.id) < p.unlock.crowns) return { error: `You need ${p.unlock.crowns - M.crowns(req.user.id)} more Hub Crowns.` };
      M.addCrowns(req.user.id, -p.unlock.crowns, 'spend', 'avatar:' + key(p), t); db.prepare('INSERT INTO avatar_parts_owned (user_id, part, created_at) VALUES (?,?,?)').run(req.user.id, key(p), t); return { ok: true }; })();
    if (r.error) return bad(res, 400, r.error); res.json({ ok: true, crowns: M.crowns(req.user.id) }); });
}
module.exports = { routes, svg, configOf, defaultFor, partsFor, KINDS, P };

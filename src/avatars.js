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
const BG = { violet: ['#7c3aed', '#22d3ee'], night: ['#0f172a', '#4338ca'], kush: ['#14532d', '#84cc16'], sunset: ['#f97316', '#db2777'], ocean: ['#0369a1', '#22d3ee'], haze: ['#6b21a8', '#f0abfc'], mono: ['#27272a', '#71717a'], toxic: ['#166534', '#facc15'],
  'gold-rays': ['#78350f', '#facc15'], 'cash-rain': ['#052e16', '#22c55e'], 'grow-room': ['#052e16', '#15803d'], 'night-club': ['#1e1b4b', '#db2777'], 'hospital': ['#e0f2fe', '#38bdf8'], 'workshop': ['#292524', '#f59e0b'], 'farm': ['#14532d', '#a3e635'], 'studio': ['#111827', '#7c3aed'], 'city-lights': ['#020617', '#475569'],
  'diamond-prism': ['#172554', '#a5f3fc'], 'stack-throne': ['#052e16', '#facc15'], 'royal-crown': ['#422006', '#fbbf24'], 'phoenix-mantle': ['#450a0a', '#fb923c'], 'singularity-orbit': ['#020617', '#7c3aed'], 'void-dragon': ['#082f49', '#a78bfa'],
  'nebula-wings': ['#312e81', '#ec4899'], 'titan-exoframe': ['#111827', '#22d3ee'], 'holo-decree': ['#164e63', '#e879f9'],
  'storm-halo': ['#0f172a', '#60a5fa'], 'chronos-mantle': ['#422006', '#fbbf24'], 'aurora-crown': ['#052e16', '#c084fc'] };
// part catalog: [kind, id, label, unlock]  unlock: 'free' | { crowns: n } | { ach: n } | { prestige: itemId }
const P = [];
const FREE_HAIR = new Set(['none','buzz','curly','afro','long','bun','waves']);
const add = (kind, id, label, unlock = 'free') => {
  // A non-collectible neutral base is provided for modesty. No other gear is
  // automatically owned by a new player; all cosmetics remain earnable.
  if (unlock === 'free' && (
    (['outfit','hat','acc','held'].includes(kind) && id !== 'none' && id !== 'base') ||
    (kind === 'hair' && !FREE_HAIR.has(id)) ||
    (kind === 'bg' && id !== 'night')
  )) unlock = { crowns: ['outfit','hat','acc','held'].includes(kind) ? 150 : 100 };
  P.push({ kind, id, label, unlock });
};
const PRESTIGE_BG = {
  'diamond-prism': 'prestige-original-cane', 'cash-rain': 'prestige-throne', 'gold-rays': 'prestige-crown', 'stack-throne': 'prestige-original-throne', 'royal-crown': 'prestige-original-crown',
  'phoenix-mantle': 'prestige-original-phoenix', 'singularity-orbit': 'prestige-original-singularity', 'void-dragon': 'prestige-original-dragon',
  'nebula-wings': 'prestige-original-nebula', 'titan-exoframe': 'prestige-original-mech', 'holo-decree': 'prestige-original-holo',
  'storm-halo': 'prestige-original-storm', 'chronos-mantle': 'prestige-original-chronos', 'aurora-crown': 'prestige-original-aurora'
};
Object.keys(BG).forEach(k => add('bg', k, k.replace(/-/g, ' '), PRESTIGE_BG[k] ? { prestige: PRESTIGE_BG[k] } : k === 'toxic' ? { ach: 25 } : 'free'));
SKIN.forEach((c, i) => add('skin', 's' + i, 'Tone ' + (i + 1)));
['round','oval','square','heart','angular','soft','chiseled'].forEach(f=>add('face',f,f));
['none', 'buzz', 'curly', 'afro', 'long', 'bun', 'mohawk', 'braids', 'waves', 'spiky'].forEach(h => add('hair', h, h));
HAIRC.forEach((c, i) => add('hairc', 'c' + i, 'Color ' + (i + 1), i >= 7 ? { crowns: 150 } : 'free'));
['dot', 'happy', 'sleepy', 'wink', 'wide'].forEach(e => add('eyes', e, e)); add('eyes', 'star', 'star eyes', { ach: 15 });
['smile', 'grin', 'flat', 'open', 'smirk'].forEach(m => add('mouth', m, m));
['none', 'mustache', 'goatee', 'beard'].forEach(b => add('beard', b, b));
for (const [id, label] of [['average','Average build'],['slim','Slim build'],['athletic','Athletic build'],['stocky','Stocky build'],['curvy','Curvy build'],['tall','Tall build'],['short','Short build']]) add('build', id, label, 'free');
add('outfit','base','Neutral starter covering'); add('outfit', 'adventurer', 'Adventure Captain', 'free'); add('outfit', 'tee', 'tee'); add('outfit', 'titan-exoframe', 'Titan Exo Frame', { prestige: 'prestige-original-mech' }); add('outfit', 'hoodie', 'hoodie'); add('outfit', 'jersey', 'jersey'); add('outfit', 'tracksuit', 'tracksuit', { crowns: 300 }); add('outfit', 'chain-tee', 'tee + gold chain', { crowns: 600 }); add('outfit', 'fur', 'fur coat', { crowns: 900 });
for (const [id, label] of [['cannabis-hoodie','Cannabis streetwear hoodie'],['dj','DJ performance fit'],['scrubs','Medical scrubs'],['labcoat','Lab coat'],['mechanic','Mechanic coveralls'],['hardhat','Blue-collar workwear'],['farmer','Farm workwear'],['suit','Executive suit'],['tactical','Tactical streetwear'],['chef','Chef jacket'],['firefighter','Firefighter turnout gear'],['varsity','Varsity jacket'],['denim','Denim jacket'],['ranch','Ranch workwear'],['hype','Hype streetwear']]) add('outfit', id, label, ['cannabis-hoodie','dj','labcoat','mechanic','farmer','suit','tactical','firefighter','hype'].includes(id) ? { crowns: 450 } : 'free');
add('hat', 'none', 'none'); add('hat', 'beanie', 'beanie'); add('hat', 'snapback', 'snapback'); add('hat', 'bucket', 'bucket hat', { crowns: 250 }); add('hat', 'halo', 'halo', { ach: 30 }); add('hat', 'crown', 'solid gold crown', { prestige: 'prestige-original-crown' });
add('hat', 'hardhat', 'Construction hardhat'); add('hat', 'storm-halo', 'Stormforged Halo', { prestige: 'prestige-original-storm' }); add('hat', 'aurora-crown', 'Aurora Crown of Worlds', { prestige: 'prestige-original-aurora' }); add('hat', 'cowboy', 'Ranch cowboy hat'); add('hat', 'chef-hat', 'Chef toque'); add('hat', 'scrub-cap', 'Medical scrub cap'); add('hat', 'dj-cap', 'DJ cap');
add('acc', 'none', 'none'); add('acc', 'glasses', 'glasses'); add('acc', 'shades', 'shades'); add('acc', 'grill', 'diamond grill', { crowns: 800 });
add('acc', 'bandana', 'Bandana'); add('acc', 'phoenix-wings', 'Phoenix Rebirth Mantle', { prestige: 'prestige-original-phoenix' }); add('acc', 'singularity-orbit', 'Singularity Orbit', { prestige: 'prestige-original-singularity' }); add('acc', 'void-dragon', 'Void Dragon Familiar', { prestige: 'prestige-original-dragon' }); add('acc', 'nebula-wings', 'Nebula Sovereign Wings', { prestige: 'prestige-original-nebula' }); add('acc', 'holo-decree', 'Holographic Royal Decree', { prestige: 'prestige-original-holo' }); add('acc', 'chronos-mantle', 'Chronos Clockwork Mantle', { prestige: 'prestige-original-chronos' }); add('acc', 'mask', 'Medical mask'); add('acc', 'earrings', 'Hoop earrings'); add('acc', 'leaf-chain', 'Cannabis-leaf chain', { crowns: 650 }); add('acc', 'stethoscope', 'Stethoscope necklace');
add('held', 'none', 'none'); add('held', 'controller', 'controller'); add('held', 'cane', 'diamond cane', { prestige: 'prestige-original-cane' }); add('held', 'cash', 'cash stack', { prestige: 'prestige-original-throne' });
add('held', 'microphone', 'DJ microphone'); add('held', 'wrench', 'Mechanic wrench'); add('held', 'sprout', 'Seedling'); add('held', 'stethoscope', 'Stethoscope'); add('held', 'pitchfork', 'Pitchfork'); add('held', 'syringe', 'Medical syringe'); add('held', 'headphones', 'DJ headphones'); add('held', 'toolbox', 'Toolbox');
add('held', 'laptop', 'DJ laptop'); add('held', 'briefcase', 'Business briefcase'); add('held', 'medical-bag', 'Medical bag'); add('held', 'camera', 'Camera'); add('held', 'paintbrush', 'Paintbrush'); add('held', 'spray-can', 'Graffiti spray can'); add('held', 'cash-bag', 'Money bag', { crowns: 900 }); add('held', 'flower', 'Farm flower bundle');
add('emote','none','No emote');
for (const [id,label] of [['wave','Wave'],['cheer','Cheer'],['salute','Salute'],['laugh','Laugh'],['victory','Victory']])
  add('emote',id,label,{crowns:200});
const KINDS = ['bg', 'skin', 'face', 'hair', 'hairc', 'eyes', 'mouth', 'beard', 'build', 'outfit', 'hat', 'acc', 'held', 'emote'];
const BYK = {}; for (const p of P) (BYK[p.kind] = BYK[p.kind] || {})[p.id] = p;
const key = (p) => p.kind + ':' + p.id;
// One-time, idempotent migration. Players who had already saved a formerly free
// costume, prop or premium trait retain that entitlement. No XP or balances reset.
db.exec('CREATE TABLE IF NOT EXISTS avatar_migrations (key TEXT PRIMARY KEY)');
const migrationKey = 'starter-v2-saved-cosmetics';
if (!db.prepare('SELECT 1 FROM avatar_migrations WHERE key=?').get(migrationKey)) {
  db.transaction(() => {
    const insert = db.prepare('INSERT OR IGNORE INTO avatar_parts_owned (user_id, part, created_at) VALUES (?,?,?)');
    for (const u of db.prepare("SELECT id, avatar FROM users WHERE avatar <> ''").all()) {
      let cfg; try { cfg = JSON.parse(u.avatar); } catch { continue; }
      if (!cfg || typeof cfg !== 'object') continue;
      for (const kind of ['bg','face','hair','outfit','hat','acc','held']) {
        const part = BYK[kind] && BYK[kind][cfg[kind]];
        if (part && part.unlock !== 'free' && !part.unlock.prestige)
          insert.run(u.id, key(part), Date.now());
      }
    }
    db.prepare('INSERT OR IGNORE INTO avatar_migrations (key) VALUES (?)').run(migrationKey);
  })();
}
// One deliberate starter look for every new/unsaved profile. No random appearance, no paid items.
// Presentation is chosen separately; existing saved avatars and purchases are never overwritten.
const STARTER_AVATAR = Object.freeze({
  gender: 'other', bg: 'night', skin: 's2', face: 'oval', hair: 'waves',
  hairc: 'c1', eyes: 'wide', mouth: 'smile', beard: 'none', build: 'average',
  outfit: 'base', hat: 'none', acc: 'none', held: 'none', emote: 'none'
});
function defaultFor() { return { ...STARTER_AVATAR }; }
function clean(cfg, base) { const out = { ...base }; if (cfg && ['male', 'female', 'other'].includes(cfg.gender)) out.gender = cfg.gender; for (const k of KINDS) if (cfg && BYK[k][cfg[k]]) out[k] = cfg[k]; return out; }
function configOf(user) {
  let c = {}; try { c = JSON.parse(user.avatar || '{}'); } catch {}
  const cfg = clean(c, defaultFor(user.username));
  // A previously equipped item must not outlive the entitlement it depends on.
  // This also protects public profile SVG/API reads, not only wardrobe writes.
  if (Number.isSafeInteger(user.id) && user.id > 0) {
    const ctx = {}, starter = defaultFor(user.username);
    for (const kind of KINDS) {
      const part = BYK[kind] && BYK[kind][cfg[kind]];
      if (!part || !owns(user.id, part, ctx)) cfg[kind] = starter[kind];
    }
  }
  return cfg;
}
// ownership
function owns(userId, part, ctx) {
  const u = part.unlock;
  if (u === 'free') return true;
  // An earned Points unlock and a Crowns purchase produce the same permanent entitlement.
  // Always check saved ownership before checking a distinct eligibility rule.
  if (db.prepare('SELECT 1 FROM avatar_parts_owned WHERE user_id=? AND part=?').get(userId, key(part))) return true;
  if (u.ach) return (ctx.ach ?? (ctx.ach = achCount(userId))) >= u.ach;
  if (u.prestige) return (ctx.px ?? (ctx.px = new Set(require('./monetize').prestigeOf(userId).map(r => r.item_id)))).has(u.prestige);
  return false;
}
// Cosmetic-only Points pricing: all non-Prestige locked avatar items are achievable by
// playing games, quests and achievements; an optional Crowns purchase remains available.
// Prestige is one-of-one and must be won in an authorized event or purchased as a collectible.
// Natural facial customization is completely free, including special face shapes.
const POINT_COSTS = { bg: 250, skin: 0, face: 0, hair: 230, hairc: 210,
  eyes: 0, mouth: 0, beard: 0, build: 180, outfit: 650, hat: 360, acc: 420, held: 440, emote: 350 };
function pointsPrice(part) {
  const u = part.unlock;
  if (u === 'free') return 0;
  if (u.prestige) return null;
  const base = POINT_COSTS[part.kind] || 250;
  return Math.max(base, u.crowns ? u.crowns * 3 : u.ach ? u.ach * 48 : base);
}
function achCount(userId) { try { return db.prepare('SELECT COUNT(*) c FROM user_achievements WHERE user_id=?').get(userId).c; } catch { return 0; } }
// ---- SVG ----
function svg(c) {
  const s = SKIN[+c.skin.slice(1)] || SKIN[2]; const hc = HAIRC[+c.hairc.slice(1)] || HAIRC[0]; const [b1, b2] = BG[c.bg] || BG.violet; const o = [];
  o.push(`<defs><linearGradient id="sh-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient><radialGradient id="sh-f" cx=".4" cy=".32" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".14"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></radialGradient><radialGradient id="sh-v" cx=".5" cy=".42" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".3"/></radialGradient><radialGradient id="sh-l" cx=".25" cy=".1" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient><linearGradient id="au" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fde68a"/><stop offset=".5" stop-color="#f59e0b"/><stop offset="1" stop-color="#fef3c7"/></linearGradient></defs><rect width="120" height="120" rx="24" fill="url(#g)"/>`);
  if (c.bg === 'gold-rays') o.push('<g opacity=".35" fill="#fef3c7">' + [0, 30, 60, 90, 120, 150].map(a => `<path d="M60 60 L${60 + 90 * Math.cos(a * Math.PI / 180)} ${60 + 90 * Math.sin(a * Math.PI / 180)} L${60 + 90 * Math.cos((a + 10) * Math.PI / 180)} ${60 + 90 * Math.sin((a + 10) * Math.PI / 180)}Z"/>`).join('') + '<animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="24s" repeatCount="indefinite"/></g>');
  if (c.bg === 'cash-rain') o.push('<g fill="#86efac" opacity=".55">' + [12, 34, 58, 82, 104].map((x, i) => `<rect x="${x}" y="-12" width="12" height="7" rx="1"><animate attributeName="y" from="-12" to="124" dur="${3 + i * 0.6}s" repeatCount="indefinite"/></rect>`).join('') + '</g>');
  if (c.bg === 'stack-throne') o.push('<g opacity=".65"><path d="M22 82 L28 45 L43 59 L60 32 L77 59 L92 45 L98 82Z" fill="#facc15" fill-opacity=".25" stroke="#fde68a" stroke-width="2"/><path d="M25 86 H95 M30 92 H90" stroke="#86efac" stroke-width="3"/><g fill="#86efac">' + [18, 43, 72, 97].map((x,i)=>`<rect x="${x}" y="-10" width="8" height="5" rx="1"><animate attributeName="y" from="-10" to="120" dur="${2.5+i*.5}s" repeatCount="indefinite"/></rect>`).join('') + '</g></g>');
  if (c.bg === 'royal-crown') o.push('<g fill="none" stroke="#fde68a" stroke-width="2.5" opacity=".85"><path d="M23 42 L32 17 L46 32 L60 9 L74 32 L88 17 L97 42Z" fill="#fbbf24" fill-opacity=".35"/><path d="M25 47 H95"><animate attributeName="stroke-width" values="2;4;2" dur="2s" repeatCount="indefinite"/></path><circle cx="60" cy="29" r="27" stroke-dasharray="3 6"><animateTransform attributeName="transform" type="rotate" from="0 60 29" to="360 60 29" dur="20s" repeatCount="indefinite"/></circle></g>');
  // Distinct animated silhouettes for the one-of-one prestige originals. These are profile-only SVG effects.
  if (c.bg === 'diamond-prism') o.push('<g fill="none" stroke="#e0f2fe" stroke-width="1.5" opacity=".75"><path d="M60 5 L73 24 L60 38 L47 24Z"/><path d="M10 18 L28 28 L18 44 M110 18 L92 28 L102 44"><animate attributeName="opacity" values=".25;1;.25" dur="2s" repeatCount="indefinite"/></path><circle cx="60" cy="22" r="19" stroke="#fef3c7" stroke-dasharray="2 5"><animateTransform attributeName="transform" type="rotate" from="0 60 22" to="360 60 22" dur="12s" repeatCount="indefinite"/></circle></g>');
  if (c.bg === 'phoenix-mantle') o.push('<g fill="none" stroke="#fdba74" stroke-width="3" opacity=".7"><path d="M48 66 Q23 45 14 22 Q34 29 47 47 Q36 20 42 10 Q57 29 60 47 Q68 24 82 13 Q83 36 72 50 Q92 31 106 28 Q97 54 72 68"><animate attributeName="opacity" values=".35;.9;.35" dur="2.8s" repeatCount="indefinite"/></path><g fill="#fb923c" stroke="none"><circle cx="20" cy="74" r="2"><animate attributeName="cy" values="80;60;80" dur="2.2s" repeatCount="indefinite"/></circle><circle cx="98" cy="80" r="2"><animate attributeName="cy" values="86;65;86" dur="2.7s" repeatCount="indefinite"/></circle></g></g>');
  if (c.bg === 'singularity-orbit') o.push('<g fill="none" stroke="#c4b5fd" opacity=".8"><ellipse cx="60" cy="57" rx="49" ry="17" transform="rotate(-28 60 57)" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="-28 60 57" to="332 60 57" dur="14s" repeatCount="indefinite"/></ellipse><ellipse cx="60" cy="57" rx="35" ry="47" stroke="#818cf8" stroke-width="1.5"/><circle cx="60" cy="57" r="12" fill="#020617" stroke="#a78bfa"><animate attributeName="r" values="10;14;10" dur="3s" repeatCount="indefinite"/></circle></g>');
  if (c.bg === 'void-dragon') o.push('<g fill="none" stroke="#a5f3fc" stroke-width="3" stroke-linecap="round" opacity=".8"><path d="M13 94 Q1 65 28 48 Q42 38 36 22 L50 32 L62 20 L67 40 Q92 36 104 58 Q91 53 84 64 Q77 75 94 91 Q66 85 60 68 Q51 86 34 87Z"><animate attributeName="stroke" values="#a5f3fc;#c4b5fd;#a5f3fc" dur="4s" repeatCount="indefinite"/></path><circle cx="49" cy="43" r="2" fill="#fff" stroke="none"/></g>');
  if (c.bg === 'nebula-wings') o.push('<g fill="none" stroke-width="2.5" opacity=".75"><path d="M56 72 Q27 63 11 35 Q36 38 53 55 Q39 28 42 13 Q59 30 61 52 Q78 28 94 18 Q92 41 70 59 Q95 43 109 47 Q91 70 64 74Z" stroke="#f0abfc"><animate attributeName="opacity" values=".45;.9;.45" dur="3s" repeatCount="indefinite"/></path><g fill="#fff" stroke="none"><circle cx="18" cy="22" r="1.5"/><circle cx="101" cy="20" r="1.4"/><circle cx="95" cy="89" r="1.2"/><circle cx="25" cy="94" r="1.2"/></g></g>');
  if (c.bg === 'titan-exoframe') o.push('<g fill="none" stroke="#67e8f9" stroke-width="3" opacity=".8"><path d="M18 27 L33 16 L43 30 L35 46 L20 43Z M102 27 L87 16 L77 30 L85 46 L100 43Z M15 54 L28 48 L30 76 L18 85Z M105 54 L92 48 L90 76 L102 85Z"/><path d="M24 30 L35 32 M96 30 L85 32"><animate attributeName="opacity" values=".2;1;.2" dur="1.5s" repeatCount="indefinite"/></path></g>');
  if (c.bg === 'holo-decree') o.push('<g fill="none" stroke="#67e8f9" stroke-width="1.5" opacity=".8"><path d="M60 8 L83 21 L83 48 L60 62 L37 48 L37 21Z"/><path d="M60 15 L76 24 L76 44 L60 53 L44 44 L44 24Z" stroke="#f0abfc" stroke-dasharray="3 3"><animateTransform attributeName="transform" type="rotate" from="0 60 35" to="360 60 35" dur="18s" repeatCount="indefinite"/></path><path d="M8 68 H112 M8 74 H112" stroke="#fff" opacity=".3"><animate attributeName="opacity" values=".1;.7;.1" dur="2s" repeatCount="indefinite"/></path></g>');
  if (c.bg === 'storm-halo') o.push('<g fill="none" stroke="#bfdbfe" stroke-width="2.5" opacity=".85"><ellipse cx="60" cy="27" rx="29" ry="9" transform="rotate(-15 60 27)"><animateTransform attributeName="transform" type="rotate" from="-15 60 27" to="345 60 27" dur="16s" repeatCount="indefinite"/></ellipse><path d="M31 22 L40 27 L34 34 L47 37 M82 17 L76 26 L87 30 L78 38"><animate attributeName="opacity" values=".2;1;.2" dur="1.1s" repeatCount="indefinite"/></path></g>');
  if (c.bg === 'chronos-mantle') o.push('<g fill="none" stroke="#fcd34d" opacity=".8"><circle cx="60" cy="59" r="46" stroke-width="1.5" stroke-dasharray="3 4"/><circle cx="60" cy="59" r="36" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 60 59" to="360 60 59" dur="30s" repeatCount="indefinite"/></circle><path d="M60 18 V34 M60 84 V100 M19 59 H35 M85 59 H101" stroke-width="3"/><circle cx="60" cy="59" r="3" fill="#fef3c7"/></g>');
  if (c.bg === 'aurora-crown') o.push('<g fill="none" stroke-width="3" opacity=".75"><path d="M7 28 Q26 4 43 26 T80 24 T113 26" stroke="#86efac"><animate attributeName="d" values="M7 28 Q26 4 43 26 T80 24 T113 26;M7 32 Q26 16 43 30 T80 18 T113 32;M7 28 Q26 4 43 26 T80 24 T113 26" dur="5s" repeatCount="indefinite"/></path><path d="M7 38 Q26 18 43 37 T80 35 T113 38" stroke="#e9d5ff"/><path d="M38 18 L43 8 L48 18 L60 3 L72 18 L77 8 L82 18 L82 26 L38 26Z" stroke="#fde68a" fill="#fbbf24" fill-opacity=".25"/></g>');
  const shirt = { base:'#475569', tee: '#3b82f6', hoodie: '#334155', jersey: '#dc2626', tracksuit: '#111827', 'chain-tee': '#f8fafc', fur: '#a16207', 'cannabis-hoodie':'#166534', dj:'#312e81', scrubs:'#0e7490', labcoat:'#f8fafc', mechanic:'#292524', hardhat:'#f59e0b', farmer:'#365314', suit:'#111827', tactical:'#374151', chef:'#f8fafc', firefighter:'#991b1b', varsity:'#7f1d1d', adventurer:'#3b493b', denim:'#1d4ed8', ranch:'#92400e', hype:'#db2777', 'titan-exoframe':'#334155' }[c.outfit] || '#3b82f6';
  o.push(`<path d="M18 120 C22 92 40 84 60 84 C80 84 98 92 102 120Z" fill="${shirt}"/>`);
  o.push('<path d="M18 120 C22 92 40 84 60 84 C80 84 98 92 102 120Z" fill="url(#sh-b)"/><path d="M24 108 C28 94 42 87 54 86 C44 92 34 98 30 120 L22 120Z" fill="#fff" opacity=".10"/><path d="M60 84 C54 96 52 108 54 120" stroke="#000" stroke-opacity=".12" stroke-width="2" fill="none"/>');
  if (c.outfit === 'adventurer') o.push('<path d="M24 117 L42 89 L51 93 L48 120 L25 120Z M96 117 L78 89 L69 93 L72 120 L95 120Z" fill="#233c33" stroke="#c49b65" stroke-width="1.4"/><path d="M46 87 L61 112 L75 87 M51 107 H69" stroke="#d1aa66" stroke-width="3" fill="none"/>');
  if (c.outfit === 'hoodie') o.push('<path d="M42 88 C48 100 72 100 78 88" fill="none" stroke="#1e293b" stroke-width="4"/>');
  if (c.outfit === 'jersey') o.push('<text x="60" y="112" font-size="16" font-family="Arial" font-weight="700" fill="#fff" text-anchor="middle">7</text>');
  if (c.outfit === 'tracksuit') o.push('<path d="M34 120 L40 90 M86 120 L80 90" stroke="#22d3ee" stroke-width="3"/>');
  if (c.outfit === 'fur') o.push('<path d="M22 118 C26 96 40 88 50 88 L56 120Z M98 118 C94 96 80 88 70 88 L64 120Z" fill="#fde68a" opacity=".85"/>');
  if (c.outfit === 'chain-tee') o.push('<path d="M44 88 Q60 108 76 88" fill="none" stroke="url(#au)" stroke-width="3.5" stroke-dasharray="4 2"/><circle cx="60" cy="102" r="5" fill="url(#au)"/>');
  o.push(`<rect x="52" y="72" width="16" height="16" rx="6" fill="${s}"/>`);
  o.push('<path d="M52 76 Q60 84 68 76 L68 86 L52 86Z" fill="#000" opacity=".16"/>');
  const faceW = c.gender === 'female' ? 24 : c.gender === 'male' ? 27 : 25;
  const face = ['square','angular','chiseled'].includes(c.face) ? `<rect x="${60-faceW}" y="28" width="${faceW*2}" height="54" rx="16" fill="${s}"/>` : c.face === 'oval' ? `<ellipse cx="60" cy="54" rx="${faceW}" ry="29" fill="${s}"/>` : `<ellipse cx="60" cy="55" rx="${faceW+1}" ry="27" fill="${s}"/>`;
  if (c.hair === 'long' || c.hair === 'braids') o.push(`<path d="M32 50 C30 30 44 22 60 22 C76 22 90 30 88 50 L92 92 L76 90 L74 60 L46 60 L44 90 L28 92Z" fill="${hc}"/>`);
  if (c.hair === 'afro') o.push(`<circle cx="60" cy="42" r="34" fill="${hc}"/>`);
  if (c.hair === 'bun') o.push(`<circle cx="60" cy="20" r="10" fill="${hc}"/>`);
  o.push(`<circle cx="33" cy="56" r="5" fill="${s}"/><circle cx="87" cy="56" r="5" fill="${s}"/>`, face);
  o.push('<ellipse cx="60" cy="54" rx="27" ry="29" fill="url(#sh-f)"/><ellipse cx="46" cy="63" rx="5.5" ry="3.2" fill="#fb7185" opacity=".20"/><ellipse cx="74" cy="63" rx="5.5" ry="3.2" fill="#fb7185" opacity=".20"/><path d="M60 56 Q57 62 60 64" stroke="#000" stroke-opacity=".14" stroke-width="1.6" fill="none" stroke-linecap="round"/><ellipse cx="52" cy="38" rx="9" ry="4" fill="#fff" opacity=".16"/>');
  const HAIR = { buzz: `<path d="M35 46 C36 30 48 26 60 26 C72 26 84 30 85 46 C80 38 70 34 60 34 C50 34 40 38 35 46Z" fill="${hc}" opacity=".9"/>`,
    curly: `<g fill="${hc}">${[38, 46, 54, 62, 70, 78, 84].map((x, i) => `<circle cx="${x}" cy="${32 + (i % 2) * 3}" r="8"/>`).join('')}</g>`,
    afro: `<path d="M33 50 C33 34 46 28 60 28 C74 28 87 34 87 50 C80 40 70 37 60 37 C50 37 40 40 33 50Z" fill="${hc}"/>`,
    long: `<path d="M33 52 C33 32 46 26 60 26 C74 26 87 32 87 52 C78 40 66 36 52 40 C44 42 38 46 33 52Z" fill="${hc}"/>`,
    bun: `<path d="M34 48 C35 32 47 27 60 27 C73 27 85 32 86 48 C80 38 70 35 60 35 C50 35 40 38 34 48Z" fill="${hc}"/>`,
    mohawk: `<path d="M54 40 L56 12 L60 22 L64 10 L66 40Z" fill="${hc}"/>`,
    braids: `<path d="M33 52 C33 32 46 26 60 26 C74 26 87 32 87 52 C80 40 70 37 60 37 C50 37 40 40 33 52Z" fill="${hc}"/><g stroke="${hc}" stroke-width="4" stroke-dasharray="3 2"><path d="M34 58 L32 92"/><path d="M86 58 L88 92"/></g>`,
    waves: `<path d="M35 46 C36 30 48 26 60 26 C72 26 84 30 85 46 C80 38 70 34 60 34 C50 34 40 38 35 46Z" fill="${hc}"/><path d="M40 36 Q46 32 52 36 T64 36 T76 36" stroke="#000" stroke-opacity=".25" fill="none"/>`,
    spiky: `<path d="M34 46 L38 26 L44 36 L50 20 L56 34 L62 18 L68 34 L74 22 L78 36 L84 28 L86 46 C78 38 68 35 60 35 C50 35 40 38 34 46Z" fill="${hc}"/>` };
  if (HAIR[c.hair]) o.push(HAIR[c.hair]);
  const EY = { dot: '<circle cx="50" cy="55" r="3.2" fill="#111"/><circle cx="70" cy="55" r="3.2" fill="#111"/>', happy: '<path d="M45 56 Q50 50 55 56 M65 56 Q70 50 75 56" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    sleepy: '<path d="M45 55 L55 55 M65 55 L75 55" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>', wink: '<circle cx="50" cy="55" r="3.2" fill="#111"/><path d="M65 56 Q70 51 75 56" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>',
    wide: '<circle cx="50" cy="55" r="5" fill="#fff"/><circle cx="70" cy="55" r="5" fill="#fff"/><circle cx="51" cy="56" r="2.6" fill="#111"/><circle cx="71" cy="56" r="2.6" fill="#111"/>',
    star: '<g fill="#facc15">' + [50, 70].map(x => `<path d="M${x} 49 L${x + 1.8} 53.5 L${x + 6} 54 L${x + 2.8} 57 L${x + 3.8} 61.5 L${x} 59 L${x - 3.8} 61.5 L${x - 2.8} 57 L${x - 6} 54 L${x - 1.8} 53.5Z"/>`).join('') + '</g>' };
  o.push(EY[c.eyes] || EY.dot);
  const MO = { smile: '<path d="M51 68 Q60 75 69 68" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>', grin: '<path d="M50 66 Q60 78 70 66Z" fill="#111"/><path d="M52 67 L68 67" stroke="#fff" stroke-width="2.4"/>',
    flat: '<path d="M52 69 L68 69" stroke="#111" stroke-width="2.6" stroke-linecap="round"/>', open: '<ellipse cx="60" cy="69" rx="6" ry="5" fill="#111"/>', smirk: '<path d="M52 69 Q62 72 69 65" stroke="#111" stroke-width="2.6" fill="none" stroke-linecap="round"/>' };
  o.push(MO[c.mouth] || MO.smile);
  if (c.acc === 'grill') o.push('<path d="M51 68 Q60 75 69 68" stroke="#e0f2fe" stroke-width="4" fill="none"/><g fill="#fff">' + [53, 57, 61, 65].map(x => `<circle cx="${x + 1}" cy="${70 - (x === 57 || x === 61 ? -1 : 0)}" r=".9"><animate attributeName="opacity" values="1;.2;1" dur="1.6s" begin="${(x % 4) * 0.3}s" repeatCount="indefinite"/></circle>`).join('') + '</g>');
  const BE = { mustache: `<path d="M50 64 Q55 60 60 63 Q65 60 70 64 Q65 66 60 65 Q55 66 50 64Z" fill="${hc}"/>`, goatee: `<path d="M54 74 Q60 84 66 74 Q60 78 54 74Z" fill="${hc}"/>`, beard: `<path d="M34 58 C36 80 48 86 60 86 C72 86 84 80 86 58 C80 72 72 76 60 76 C48 76 40 72 34 58Z" fill="${hc}"/>` };
  if (BE[c.beard]) o.push(BE[c.beard]);
  if (c.acc === 'glasses') o.push('<g fill="none" stroke="#111" stroke-width="2.2"><circle cx="50" cy="55" r="7"/><circle cx="70" cy="55" r="7"/><path d="M57 55 L63 55"/></g>');
  if (c.acc === 'shades') o.push('<path d="M41 50 L59 50 L57 60 L44 60Z M61 50 L79 50 L76 60 L63 60Z" fill="#0b0b0f"/><path d="M59 52 L61 52" stroke="#0b0b0f" stroke-width="2"/>');
  const HAT = { beanie: '<path d="M33 46 C33 26 46 20 60 20 C74 20 87 26 87 46Z" fill="#ef4444"/><rect x="31" y="42" width="58" height="8" rx="4" fill="#b91c1c"/><circle cx="60" cy="18" r="5" fill="#fff"/>',
    snapback: '<path d="M34 44 C34 28 46 22 60 22 C74 22 86 28 86 44Z" fill="#111827"/><path d="M60 42 L98 44 L96 48 L60 47Z" fill="#111827"/><circle cx="60" cy="32" r="4" fill="#22d3ee"/>',
    bucket: '<path d="M38 42 L42 22 L78 22 L82 42Z" fill="#65a30d"/><path d="M26 44 L94 44 L88 38 L32 38Z" fill="#4d7c0f"/>',
    halo: '<ellipse cx="60" cy="20" rx="20" ry="5" fill="none" stroke="#fde047" stroke-width="3"><animate attributeName="cy" values="20;17;20" dur="3s" repeatCount="indefinite"/></ellipse>',
    crown: '<path d="M38 36 L40 14 L50 26 L60 10 L70 26 L80 14 L82 36Z" fill="url(#au)" stroke="#92400e" stroke-width="1.2"/><circle cx="60" cy="27" r="3.5" fill="#10b981"/><circle cx="46" cy="30" r="2" fill="#e0f2fe"/><circle cx="74" cy="30" r="2" fill="#e0f2fe"/><rect x="38" y="33" width="44" height="4" fill="#fbbf24"/>',
    'storm-halo': '<ellipse cx="60" cy="20" rx="25" ry="7" fill="none" stroke="#93c5fd" stroke-width="3"><animateTransform attributeName="transform" type="rotate" from="0 60 25" to="360 60 25" dur="8s" repeatCount="indefinite"/></ellipse><path d="M39 18 L47 23 L43 29 L54 31 M75 17 L70 24 L80 28" fill="none" stroke="#e0f2fe" stroke-width="2"><animate attributeName="opacity" values=".2;1;.2" dur="1s" repeatCount="indefinite"/></path>',
    'aurora-crown': '<path d="M36 36 L39 18 L49 28 L60 8 L71 28 L81 18 L84 36Z" fill="#fbbf24" stroke="#ccfbf1" stroke-width="1.5"/><path d="M32 17 Q43 5 54 18 T77 15 T91 17" fill="none" stroke="#34d399" stroke-width="3"><animate attributeName="d" values="M32 17 Q43 5 54 18 T77 15 T91 17;M32 20 Q43 13 54 20 T77 11 T91 20;M32 17 Q43 5 54 18 T77 15 T91 17" dur="4s" repeatCount="indefinite"/></path>' };
  if (HAT[c.hat]) o.push(HAT[c.hat]);
  const HE = { controller: '<g transform="translate(78 92) rotate(-12)"><rect width="30" height="16" rx="8" fill="#111827"/><circle cx="8" cy="8" r="2.5" fill="#22d3ee"/><circle cx="22" cy="6" r="1.8" fill="#f472b6"/><circle cx="25" cy="10" r="1.8" fill="#a3e635"/></g>',
    cane: '<g><path d="M98 120 L98 74" stroke="url(#au)" stroke-width="4"/><path d="M98 74 C98 62 110 62 110 72" stroke="url(#au)" stroke-width="4" fill="none"/><path d="M93 74 L98 64 L103 74 L98 80Z" fill="#e0f2fe" stroke="#93c5fd"/><circle cx="98" cy="70" r="1.6" fill="#fff"><animate attributeName="opacity" values="1;.1;1" dur="1.2s" repeatCount="indefinite"/></circle></g>',
    cash: '<g transform="translate(82 94)">' + [0, 5, 10].map(y => `<rect y="${12 - y}" width="26" height="6" rx="1" fill="#16a34a" stroke="#14532d"/>`).join('') + '<rect x="9" y="2" width="8" height="16" fill="#facc15" opacity=".9"/></g>' };
  if (HE[c.held]) o.push(HE[c.held]);
  if (c.acc === 'phoenix-wings') o.push('<g fill="none" stroke-width="3" stroke-linecap="round" opacity=".9"><path d="M48 83 Q28 73 20 51 Q36 57 48 72 Q39 51 41 39 Q55 54 59 72 M72 83 Q92 73 100 51 Q84 57 72 72 Q81 51 79 39 Q65 54 61 72" stroke="#fb923c"/><path d="M49 80 Q36 64 34 51 M71 80 Q84 64 86 51" stroke="#fde68a"/></g>');
  if (c.acc === 'singularity-orbit') o.push('<g fill="none" stroke="#c4b5fd" opacity=".9"><ellipse cx="60" cy="61" rx="43" ry="17" transform="rotate(-25 60 61)" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="-25 60 61" to="335 60 61" dur="16s" repeatCount="indefinite"/></ellipse><ellipse cx="60" cy="61" rx="37" ry="48" stroke="#818cf8" stroke-width="1.5"/><circle cx="60" cy="61" r="5" fill="#a78bfa"><animate attributeName="r" values="4;7;4" dur="2.8s" repeatCount="indefinite"/></circle></g>');
  if (c.acc === 'void-dragon') o.push('<g fill="none" stroke="#67e8f9" stroke-width="3" stroke-linecap="round"><path d="M85 96 Q109 82 101 64 Q95 51 83 57 L76 46 L71 58 L59 57 Q68 72 79 71 Q92 75 85 96Z"><animate attributeName="stroke" values="#67e8f9;#c4b5fd;#67e8f9" dur="3s" repeatCount="indefinite"/></path><circle cx="87" cy="62" r="1.5" fill="#fff"/></g>');
  if (c.acc === 'nebula-wings') o.push('<g fill="none" stroke="#f0abfc" stroke-width="3" opacity=".9"><path d="M47 83 Q25 80 11 54 Q30 57 47 73 Q34 48 40 31 Q56 48 59 72 M73 83 Q95 80 109 54 Q90 57 73 73 Q86 48 80 31 Q64 48 61 72"/><g fill="#fff" stroke="none"><circle cx="19" cy="42" r="1.5"/><circle cx="101" cy="41" r="1.5"/><circle cx="27" cy="82" r="1.3"/><circle cx="94" cy="84" r="1.3"/></g></g>');
  if (c.acc === 'holo-decree') o.push('<g fill="none" stroke="#67e8f9" stroke-width="1.6" opacity=".85"><path d="M60 12 L77 22 L77 42 L60 52 L43 42 L43 22Z"/><path d="M60 17 L71 24 L71 39 L60 46 L49 39 L49 24Z" stroke="#f0abfc" stroke-dasharray="3 3"><animateTransform attributeName="transform" type="rotate" from="0 60 32" to="360 60 32" dur="18s" repeatCount="indefinite"/></path></g>');
  if (c.acc === 'chronos-mantle') o.push('<g fill="none" stroke="#fcd34d" opacity=".85"><circle cx="60" cy="67" r="43" stroke-width="1.5" stroke-dasharray="3 4"/><circle cx="60" cy="67" r="33" stroke-width="2"><animateTransform attributeName="transform" type="rotate" from="0 60 67" to="360 60 67" dur="24s" repeatCount="indefinite"/></circle><path d="M60 25 V39 M60 95 V109 M18 67 H32 M88 67 H102" stroke-width="3"/></g>');
  if (c.outfit === 'titan-exoframe') o.push('<g fill="none" stroke="#67e8f9" stroke-width="3"><path d="M25 74 L34 63 L45 70 L42 89 L29 94Z M95 74 L86 63 L75 70 L78 89 L91 94Z"/><path d="M40 84 L43 104 L77 104 L80 84 M43 91 H77" stroke="#94a3b8" stroke-width="2"/><path d="M34 70 L41 76 M86 70 L79 76"><animate attributeName="opacity" values=".2;1;.2" dur="1.5s" repeatCount="indefinite"/></path></g>');
  // Profile-SVG emote preview. Rigged full-body animations require sourced clips.
  if (c.emote === 'wave') o.push('<g><path d="M101 108 L99 84 Q101 70 106 80 L110 100Z" fill="#f1c19b"><animateTransform attributeName="transform" type="rotate" values="-12 104 94;18 104 94;-12 104 94" dur="1.1s" repeatCount="indefinite"/></path></g>');
  if (c.emote === 'cheer' || c.emote === 'victory') o.push('<g fill="#facc15"><path d="M12 25 L16 16 L20 25 L30 29 L20 32 L16 42 L12 32 L3 29Z"><animate attributeName="opacity" values=".2;1;.2" dur="1.2s" repeatCount="indefinite"/></path><path d="M102 13 L106 5 L110 13 L118 17 L110 21 L106 30 L102 21 L94 17Z"/></g>');
  if (c.emote === 'salute') o.push('<path d="M78 46 Q91 32 105 38" fill="none" stroke="#f1c19b" stroke-width="7" stroke-linecap="round"><animate attributeName="opacity" values=".4;1;.4" dur="1.2s" repeatCount="indefinite"/></path>');
  if (c.emote === 'laugh') o.push('<g fill="#fbbf24"><circle cx="16" cy="60" r="3"/><circle cx="104" cy="60" r="3"><animate attributeName="cy" values="60;71;60" dur="1.3s" repeatCount="indefinite"/></circle></g>');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${o.join('')}<rect width="120" height="120" rx="24" fill="url(#sh-v)"/><rect width="120" height="120" rx="24" fill="url(#sh-l)"/><rect x=".75" y=".75" width="118.5" height="118.5" rx="23.4" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="1.5"/></svg>`;
}
function partsFor(userId) { const ctx = {}; return P.map(p => ({ kind: p.kind, id: p.id, label: p.label, unlock: p.unlock, owned: userId ? owns(userId, p, ctx) : p.unlock === 'free',
  crowns: p.unlock.crowns || 0, points: pointsPrice(p), credits: pointsPrice(p) })); }
function routes(app, H) {
  const { requireUser, currentUser, bad } = H; const cache = new Map();
  app.get('/avatar/:u.svg', (req, res) => { const u = db.prepare('SELECT id, username, avatar FROM users WHERE username=? COLLATE NOCASE').get(String(req.params.u));
    const cfg = u ? configOf(u) : defaultFor(req.params.u); const body = svg(cfg); const et = '"' + crypto.createHash('sha1').update(body).digest('base64').slice(0, 16) + '"';
    res.set({ 'Cache-Control': 'public, max-age=300', ETag: et, 'Content-Type': 'image/svg+xml' }); if (req.headers['if-none-match'] === et) return res.status(304).end(); res.send(body); });
  app.get('/api/avatar/:u', (req, res) => { const u = db.prepare('SELECT id, username, avatar FROM users WHERE username=? COLLATE NOCASE').get(String(req.params.u).slice(0, 32)); if (!u) return bad(res, 404, 'Avatar not found'); res.set('Cache-Control', 'public, max-age=60').json({ ok: true, avatar: configOf(u) }); });
  app.get('/avatar-preview.svg', (req, res) => { let c = {}; try { c = JSON.parse(String(req.query.c || '{}')); } catch {} res.type('image/svg+xml').set('Cache-Control', 'public, max-age=86400').send(svg(clean(c, defaultFor('preview')))); });
  app.get('/api/avatar', requireUser, (req, res) => { const shop = require('./shop');
    const points = shop.sync(req.user.id);
    res.json({ ok: true, avatar: configOf(req.user), kinds: KINDS, parts: partsFor(req.user.id),
      bg: BG, skin: SKIN, hair_colors: HAIRC, starter: defaultFor(), credits: points, points });
  });
  app.put('/api/avatar', requireUser, (req, res) => { const want = clean(req.body && req.body.avatar, configOf(req.user)); const ctx = {};
    for (const k of KINDS) { const p = BYK[k][want[k]]; if (!owns(req.user.id, p, ctx)) return bad(res, 403, `Unlock "${p.label}" first.`); }
    db.prepare('UPDATE users SET avatar=? WHERE id=?').run(JSON.stringify(want), req.user.id); res.json({ ok: true, avatar: want }); });
  // Legacy dual-currency purchase must never spend a second Crown balance.
  // Require older clients to refresh instead of silently repricing their order.
  app.post('/api/avatar/buy', requireUser, (_req, res) => bad(res, 410, 'Refresh the Hub to purchase avatar parts with Hub Credits.'));
  const buyAvatarWithCredits = (req, res) => {
    const [k, id] = String((req.body || {}).part || '').split(':');
    const p = BYK[k] && BYK[k][id];
    if (!p || p.unlock === 'free' || p.unlock.prestige) return bad(res, 400, 'That item cannot be purchased with Hub Credits.');
    const price = pointsPrice(p), t = Date.now(), shop = require('./shop');
    // Sync signed accepted runs and migrate historical Crown credits before attempting a debit.
    shop.sync(req.user.id);
    const result = db.transaction(() => {
      if (owns(req.user.id, p, {})) return { error: 'You already own this part.' };
      const balance = shop.balance(req.user.id);
      if (balance < price) return { error: `You need ${price - balance} more Hub Credits. Earn Credits by playing or purchase them optionally.` };
      const purchased = db.prepare('INSERT OR IGNORE INTO avatar_parts_owned (user_id, part, created_at) VALUES (?,?,?)').run(req.user.id, key(p), t);
      if (!purchased.changes) return { error: 'You already own this part.' };
      db.prepare('INSERT INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)')
        .run(req.user.id, -price, 'avatar-purchase', key(p), t);
      return { ok: true };
    })();
    if (result.error) return bad(res, 400, result.error);
    const credits = shop.balance(req.user.id);
    res.json({ ok: true, item: key(p), price_credits: price, credits, price_points: price, points: credits });
  };
  app.post('/api/avatar/buy-credits', requireUser, buyAvatarWithCredits);
  // Compatibility: historical Points route now debits the same Credits wallet.
  app.post('/api/avatar/buy-points', requireUser, buyAvatarWithCredits);
}

module.exports = { routes, svg, configOf, defaultFor, partsFor, KINDS, P };

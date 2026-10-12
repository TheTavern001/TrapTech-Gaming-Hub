'use strict';
// v5 Points + cosmetics shop.
// Hub Points are COSMETIC ONLY: no cash value, cannot be bought with money, cannot be traded/transferred between
// players and can never be redeemed for prizes or giveaway entries. Earned from runs, quests, streaks, achievements,
// referrals and friend challenges; spent on rotating cosmetic items. All designs are original CSS/SVG.
const db = require('./db');
const cfg = require('./config');
const D = 864e5;
const svg = (s) => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
const LEAF = "<path d='M20 4c2 6 2 11 1 15 3-3 7-5 11-5-2 4-6 7-10 8 3 1 5 2 7 4-4 1-7 0-9-1l-1 9-1-9c-2 1-5 2-9 1 2-2 4-3 7-4-4-1-8-4-10-8 4 0 8 2 11 5-1-4-1-9 3-15z'/>";

const RARITY = { common: { price: 150, label: 'Common' }, rare: { price: 400, label: 'Rare' }, epic: { price: 900, label: 'Epic' }, legendary: { price: 2000, label: 'Legendary' } };
const THEMES = { culture: 'Cannabis culture', gaming: 'Gaming', money: 'Money & grind' };

// [id, type, name, rarity, theme, css/bg/anim]
const ITEMS = [
  // banners
  ['leaf-canopy', 'banner', 'Leaf Canopy', 'rare', 'culture', `${svg(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><g fill='#4ade80' opacity='.35'>${LEAF}</g></svg>`)} 0 0/40px 40px,linear-gradient(135deg,#052e16,#14532d 60%,#166534)`],
  ['terp-garden', 'banner', 'Terp Garden', 'epic', 'culture', 'radial-gradient(circle at 15% 40%,rgba(250,204,21,.8) 0 7%,transparent 8%),radial-gradient(circle at 35% 70%,rgba(251,146,60,.75) 0 6%,transparent 7%),radial-gradient(circle at 60% 30%,rgba(192,132,252,.8) 0 8%,transparent 9%),radial-gradient(circle at 82% 65%,rgba(74,222,128,.75) 0 7%,transparent 8%),linear-gradient(120deg,#1a2e05,#3b0764)'],
  ['smoke-rings', 'banner', 'Smoke Rings', 'common', 'culture', 'repeating-radial-gradient(circle at 25% 60%,rgba(226,232,240,.18) 0 3px,transparent 3px 22px),repeating-radial-gradient(circle at 75% 40%,rgba(196,181,253,.16) 0 3px,transparent 3px 26px),linear-gradient(180deg,#1e1b2e,#312e4a)'],
  ['heady-glass', 'banner', 'Heady Glass', 'legendary', 'culture', 'conic-gradient(from 30deg at 30% 50%,#22d3ee,#a78bfa,#f472b6,#facc15,#4ade80,#22d3ee),radial-gradient(circle at 70% 40%,rgba(255,255,255,.5),transparent 40%)'],
  ['four-twenty', 'banner', '4:20 Sunset', 'rare', 'culture', 'radial-gradient(circle at 80% 120%,#fde047 0 18%,#fb923c 19% 30%,transparent 31%),linear-gradient(180deg,#14532d,#7c2d12 60%,#f97316)'],
  ['pixel-city', 'banner', 'Pixel City', 'rare', 'gaming', 'linear-gradient(0deg,#0f172a 0 18%,transparent 18%),repeating-linear-gradient(90deg,#1e293b 0 14px,#334155 14px 22px,transparent 22px 30px) 0 100%/100% 55% no-repeat,radial-gradient(1px 1px at 20% 20%,#fff,transparent),radial-gradient(1px 1px at 70% 15%,#fff,transparent),linear-gradient(180deg,#1e1b4b,#7c3aed)'],
  ['arcade-cabinet', 'banner', 'Arcade Cabinet', 'common', 'gaming', 'repeating-linear-gradient(0deg,rgba(0,0,0,.3) 0 2px,transparent 2px 4px),linear-gradient(90deg,#f43f5e,#f59e0b 33%,#22d3ee 66%,#a855f7)'],
  ['neon-tunnel', 'banner', 'Neon Tunnel', 'epic', 'gaming', 'repeating-radial-gradient(ellipse at 50% 50%,transparent 0 10px,rgba(236,72,153,.6) 10px 12px,transparent 12px 22px,rgba(34,211,238,.6) 22px 24px),#05011a'],
  ['cash-stack', 'banner', 'Cash Stack', 'rare', 'money', 'repeating-linear-gradient(0deg,#14532d 0 6px,#166534 6px 7px,#86efac 7px 8px),linear-gradient(90deg,rgba(0,0,0,.35),transparent 30% 70%,rgba(0,0,0,.35))'],
  ['gold-chain', 'banner', 'Gold Chain', 'epic', 'money', `${svg("<svg xmlns='http://www.w3.org/2000/svg' width='36' height='18'><ellipse cx='9' cy='9' rx='8' ry='5' fill='none' stroke='#fbbf24' stroke-width='3'/><ellipse cx='27' cy='9' rx='8' ry='5' fill='none' stroke='#f59e0b' stroke-width='3'/></svg>")} 0 50%/36px 18px repeat-x,linear-gradient(180deg,#1c1917,#44403c)`],
  ['diamond-cut', 'banner', 'Diamond Cut', 'legendary', 'money', 'conic-gradient(from 45deg at 50% 50%,#e0f2fe,#7dd3fc,#ffffff,#a5b4fc,#e0f2fe,#38bdf8,#ffffff,#c7d2fe,#e0f2fe)'],
  // frames
  ['leaf-wreath', 'frame', 'Leaf Wreath', 'rare', 'culture', 'repeating-conic-gradient(#22c55e 0 14deg,#14532d 14deg 22deg)|glow'],
  ['terp-ring', 'frame', 'Terp Ring', 'common', 'culture', 'conic-gradient(#facc15,#fb923c,#c084fc,#4ade80,#facc15)|spin'],
  ['glass-swirl', 'frame', 'Glass Swirl', 'epic', 'culture', 'conic-gradient(#22d3ee,#a78bfa,#f472b6,#facc15,#22d3ee)|spin'],
  ['pixel-frame', 'frame', 'Pixel Frame', 'common', 'gaming', 'repeating-conic-gradient(#84cc16 0 15deg,#0f172a 15deg 30deg)|pulse'],
  ['neon-arcade', 'frame', 'Neon Arcade', 'rare', 'gaming', 'conic-gradient(#ec4899,#22d3ee,#ec4899)|glow'],
  ['chain-frame', 'frame', 'Gold Chain Frame', 'epic', 'money', 'repeating-conic-gradient(#fde68a 0 10deg,#b45309 10deg 20deg)|spin'],
  ['diamond-ring', 'frame', 'Diamond Ring', 'legendary', 'money', 'conic-gradient(#ffffff,#7dd3fc,#c7d2fe,#ffffff,#38bdf8,#ffffff)|spin'],
  // titles
  ['terp-connoisseur', 'title', 'Terp Connoisseur', 'rare', 'culture'], ['glass-collector', 'title', 'Glass Collector', 'epic', 'culture'], ['cloud-chaser', 'title', 'Cloud Chaser', 'common', 'culture'],
  ['four-twenty-legend', 'title', '4:20 Legend', 'legendary', 'culture'], ['pixel-pusher', 'title', 'Pixel Pusher', 'common', 'gaming'], ['arcade-royalty', 'title', 'Arcade Royalty', 'epic', 'gaming'],
  ['neon-ninja', 'title', 'Neon Ninja', 'rare', 'gaming'], ['diamond-hands', 'title', 'Diamond Hands', 'epic', 'money'], ['gold-standard', 'title', 'Gold Standard', 'rare', 'money'],
  ['grind-mode', 'title', 'Grind Mode', 'common', 'money'], ['self-made', 'title', 'Self-Made', 'legendary', 'money'],
  // name colors
  ['kush-green', 'color', 'Kush Green', 'common', 'culture', 'linear-gradient(90deg,#86efac,#22c55e)'], ['purple-haze-name', 'color', 'Purple Haze', 'rare', 'culture', 'linear-gradient(90deg,#e9d5ff,#a855f7,#f0abfc)'],
  ['sunset-420', 'color', '4:20 Sunset', 'rare', 'culture', 'linear-gradient(90deg,#fde047,#fb923c,#f472b6)'], ['neon-name', 'color', 'Neon Sign', 'common', 'gaming', 'linear-gradient(90deg,#22d3ee,#e879f9)'],
  ['pixel-lime', 'color', 'Pixel Lime', 'common', 'gaming', 'linear-gradient(90deg,#d9f99d,#84cc16)'], ['gold-name', 'color', '24K Gold', 'epic', 'money', 'linear-gradient(90deg,#fef3c7,#fbbf24,#b45309,#fde68a)'],
  ['diamond-name', 'color', 'Diamond Ice', 'legendary', 'money', 'linear-gradient(90deg,#ffffff,#7dd3fc,#c7d2fe,#ffffff)'], ['cash-green', 'color', 'Cash Green', 'rare', 'money', 'linear-gradient(90deg,#bbf7d0,#16a34a)'],
  // profile effects (animated overlay on the profile header)
  ['fx-smoke', 'effect', 'Drifting Smoke', 'epic', 'culture'], ['fx-leaves', 'effect', 'Falling Leaves', 'rare', 'culture'], ['fx-pixels', 'effect', 'Pixel Rain', 'rare', 'gaming'],
  ['fx-neon', 'effect', 'Neon Pulse', 'common', 'gaming'], ['fx-sparkle', 'effect', 'Diamond Sparkle', 'legendary', 'money'], ['fx-coins', 'effect', 'Gold Coin Shower', 'epic', 'money'],
  // badges (shown next to the name)
  ['b-leaf', 'badge', 'Leaf Badge', 'common', 'culture', 'leaf'], ['b-glass', 'badge', 'Glass Badge', 'rare', 'culture', 'flame-kindling'], ['b-joystick', 'badge', 'Joystick Badge', 'common', 'gaming', 'gamepad-2'],
  ['b-crown', 'badge', 'Arcade Crown', 'epic', 'gaming', 'crown'], ['b-diamond', 'badge', 'Diamond Badge', 'legendary', 'money', 'gem'], ['b-coins', 'badge', 'Coin Stack Badge', 'rare', 'money', 'coins'],
].map(([id, type, name, rarity, theme, extra]) => ({ id, type, name, rarity, theme, price: RARITY[rarity].price, extra: extra || '' }));
// ===================================================================================================================
// v7 economy engine (docs/ECONOMY.md): seeded rotations (daily / weekly featured / season shop / events), a procedural
// item generator that never runs out (src/shop-gen.js), live pricing from rarity x type x demand x scarcity x
// appearances (no fixed price tiers), retire-to-Vault and return rules, score- and leaderboard-gated items, and a
// rebalanced EARN table. Everything that decides WHAT is in the shop is a pure function of the date, so every server
// (and every test) computes the same shop; prices only use purchase data from before the current day.
// ===================================================================================================================
const G = require('./shop-gen');
const SE = () => require('./seasons');
const PR = () => require('./progress');
const HANDMADE = ITEMS.slice();
for (const it of HANDMADE) { it.generated = false; it.palette = null; }
const GEN = new Map(); // generated items that have appeared so far (id -> item)
const resolve = (id) => { id = String(id); if (HANDMADE_BY[id]) return HANDMADE_BY[id]; const it = G.parse(id); if (!it) return undefined; if (!('price' in it)) Object.defineProperty(it, 'price', { get() { return listPrice(it); }, enumerable: true }); return it; };
const HANDMADE_BY = Object.fromEntries(HANDMADE.map(i => [i.id, i]));
for (const it of HANDMADE) { delete it.price; Object.defineProperty(it, 'price', { get() { return listPrice(it); }, enumerable: true }); }
// BY_ID resolves handmade AND generated ids (generated ids rebuild from the id itself)
const BY_ID = new Proxy(HANDMADE_BY, { get: (t, k) => typeof k === 'string' ? resolve(k) : t[k], has: (t, k) => !!resolve(k) });
// cosmetics.js lookup maps (banner/frame/title/color/effect) fall back to generated items too
function attach(BY) {
  for (const type of ['banner', 'frame', 'title', 'color', 'effect']) {
    const base = BY[type];
    BY[type] = new Proxy(base, { get: (t, k) => { if (typeof k !== 'string') return t[k]; if (t[k]) return t[k]; const it = /^(fx-)?v7/.test(k) ? resolve(k) : null;
      return it && it.type === type ? { id: it.id, name: it.name, shop: true, anim: it.type === 'frame' ? it.extra.split('|')[1] : undefined } : undefined; } });
  }
  return BY;
}

// ---------- calendar ----------
const EPOCH_DAY = 20727; // 2026-10-01, Season 1 day 1
const dayNum = (t) => PR().dayNum(t);
const weekOf = (day) => Math.floor((day + 3) / 7); // weeks start Monday
const weekStartDay = (w) => w * 7 - 3;
const ymd = (day) => { const d = new Date(day * 864e5); return [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]; };
const dayOfYmd = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / 864e5);
const W = (adj, noun, title) => ({ adj, noun, title });
const EVENTS = [
  { idx: 1, key: 'launch', name: 'Launch Week', later: 'Hub Birthday Week', from: [10, 1], to: [10, 7], palette: 'neon', theme: 'gaming', icon: 'party-popper', words: W(['Launch', 'Day-One', 'Founding', 'Premiere', 'Birthday'], ['Countdown', 'Liftoff', 'Spotlight', 'Kickoff', 'Confetti'], ['Founding Player', 'Day One', 'Launch Crew', 'Party Starter']) },
  { idx: 2, key: 'spooky', name: 'Spooky Haze', from: [10, 24], to: [11, 1], palette: 'spooky', theme: 'culture', icon: 'moon', words: W(['Haunted', 'Spooky', 'Pumpkin', 'Witchy', 'Ghostly', 'Cursed'], ['Hollow', 'Graveyard', 'Cauldron', 'Fog', 'Moon', 'Lantern'], ['Night Stalker', 'Pumpkin King', 'Ghost Mode', 'Grave Gamer']) },
  { idx: 3, key: 'munchies', name: 'Munchies Week', from: [11, 24], to: [11, 30], palette: 'terp', theme: 'culture', icon: 'cookie', words: W(['Snack', 'Glazed', 'Crispy', 'Toasted', 'Sugar-Rush'], ['Feast', 'Buffet', 'Pantry', 'Diner', 'Kitchen'], ['Snack Master', 'Munchie Monarch', 'Second Plate']) },
  { idx: 4, key: 'frosted', name: 'Frosted Holidays', from: [12, 18], to: [12, 31], palette: 'holly', theme: 'culture', icon: 'gift', words: W(['Frosted', 'Snowy', 'Jolly', 'Tinsel', 'Candy-Cane', 'Cozy'], ['Cabin', 'Snowfall', 'Lights', 'Fireplace', 'Wonderland'], ['Gift Giver', 'Snow Day', 'Holiday Hero']) },
  { idx: 5, key: 'newyear', name: 'New Year Glow', from: [1, 1], to: [1, 4], palette: 'gold', theme: 'money', icon: 'sparkles', words: W(['Midnight', 'Countdown', 'Golden', 'Fresh-Start', 'Champagne'], ['Fireworks', 'Ball Drop', 'Toast', 'Resolution'], ['New Year, New PB', 'Midnight Legend']) },
  { idx: 6, key: 'hearts', name: 'Heart Eyes', from: [2, 10], to: [2, 15], palette: 'love', theme: 'culture', icon: 'heart', words: W(['Sweet', 'Crushing', 'Rose', 'Lovestruck', 'Candy'], ['Hearts', 'Valentine', 'Crush', 'Bouquet'], ['Heartbreaker', 'Player Two', 'Sweetheart']) },
  { idx: 7, key: 'lucky', name: 'Lucky Green', from: [3, 14], to: [3, 18], palette: 'lucky', theme: 'culture', icon: 'leaf', words: W(['Lucky', 'Clover', 'Emerald', 'Four-Leaf', 'Shamrock'], ['Charm', 'Rainbow', 'Pot of Gold', 'Meadow'], ['Lucky Streak', 'Clover Chaser']) },
  { idx: 8, key: '420', name: '4/20 Week', from: [4, 16], to: [4, 21], palette: 'kush', theme: 'culture', icon: 'leaf', words: W(['Four-Twenty', 'Lifted', 'Sticky', 'Top-Shelf', 'Blazed', 'Elevated'], ['Sesh', 'Cloud', 'Canopy', 'Haze', 'Garden'], ['Holiday Head', '4/20 Royalty', 'Elevated']) },
  { idx: 9, key: 'summer', name: 'Summer Arcade', from: [6, 20], to: [6, 28], palette: 'summer', theme: 'gaming', icon: 'sunrise', words: W(['Sunny', 'Boardwalk', 'Heatwave', 'Tropical', 'Poolside'], ['Arcade', 'Pier', 'Beach', 'Sunset', 'Waves'], ['Summer Champ', 'Boardwalk Boss']) },
  { idx: 10, key: '710', name: '7/10 Dab Days', from: [7, 8], to: [7, 11], palette: 'dab', theme: 'culture', icon: 'flame', words: W(['Golden', 'Shatter', 'Honey', 'Amber', 'Glass'], ['Torch', 'Rig', 'Glow', 'Drip'], ['Dab Lab', 'Golden Hour']) },
];
const EV_TYPES = ['banner', 'frame', 'title', 'effect'], EV_RAR = ['rare', 'epic', 'epic', 'legendary'];
G.parse.contexts.e = (num, slot) => {
  if (slot > 3) return null;
  if (num >= 900000) { let e = null; try { e = db.prepare('SELECT id, name, theme FROM hub_events WHERE id=?').get(num - 900000); } catch {} const pal = G.PAL_KEYS[G.hash('ev', (e && (e.theme || e.name)) || num) % G.PAL_KEYS.length];
    return { type: EV_TYPES[slot], rarity: EV_RAR[slot], palette: pal, theme: 'gaming' }; }
  const ev = EVENTS.find(x => x.idx === num % 100); if (!ev) return null;
  return { type: EV_TYPES[slot], rarity: EV_RAR[slot], palette: ev.palette, theme: ev.theme, words: ev.words };
};
function eventsOn(day) {
  const [y] = ymd(day); const out = [];
  for (const ev of EVENTS) { const a = dayOfYmd(y, ...ev.from), b = dayOfYmd(y, ...ev.to); if (day >= a && day <= b && a >= EPOCH_DAY) out.push({ ...ev, year: y, first: a, last: b, name: y > 2026 && ev.later ? ev.later : ev.name }); }
  return out;
}
function eventItems(ev) {
  const num = ev.year * 100 + ev.idx; const items = [0, 1, 2, 3].map(s => ({ it: resolve(G.make('e', num, s, G.parse.contexts.e(num, s)).id), tag: 'event' }));
  const prevA = dayOfYmd(ev.year - 1, ...ev.from); if (prevA >= EPOCH_DAY) for (const s of [0, 3]) items.push({ it: resolve(G.make('e', num - 100, s, G.parse.contexts.e(num - 100, s)).id), tag: 'returning' });
  return items;
}

// ---------- the rotation simulation (deterministic from Oct 1 2026, one day at a time) ----------
const CAP = { common: 8, rare: 6, epic: 4, legendary: 3 };             // appearances before an item retires to the Vault
const COOL = { common: 10, rare: 14, epic: 21, legendary: 28 };        // min days between daily appearances
const RW = { common: 50, rare: 32, epic: 14, legendary: 4 };          // daily pick weights
const VAULT_GAP = 90, VAULT_REPEAT = 180, SEASON_VAULT_AFTER = 365;
const DAILY_SLOTS = 6, WEEKLY_SLOTS = 4;
const SIM = { day: EPOCH_DAY - 1, seen: new Map(), vaulted: new Map(), lastReturn: new Map(), days: new Map(), weeks: new Map(), pool: [], intro: [] };
for (const it of HANDMADE) SIM.pool.push(it.id);
function meta(id) { let m = SIM.seen.get(id); if (!m) { m = { first: null, last: -1e9, days: [] }; SIM.seen.set(id, m); } return m; }
function appear(id, day, last = day) { const m = meta(id); if (m.first === null) { m.first = day; if (!HANDMADE_BY[id]) SIM.intro.push([day, id]); } m.days.push(day); m.last = Math.max(m.last, last); }
function wpickIds(r, ids, weight) { let tot = 0; const w = ids.map(id => { const x = Math.max(0, weight(id)); tot += x; return x; }); if (!tot) return null; let x = r() * tot; for (let i = 0; i < ids.length; i++) { if ((x -= w[i]) < 0) return ids[i]; } return ids[ids.length - 1]; }
const rarOf = (id) => resolve(id).rarity;
function stepWeek(w, day) {
  const r = G.rng(G.hash('weekly', w)); const out = []; const tags = {};
  for (const s of [0, 1]) { const it = resolve(G.make('w', w, s).id); out.push(it.id); tags[it.id] = 'new'; SIM.pool.push(it.id); }
  const endDay = weekStartDay(w) + 6;
  const cand = () => SIM.pool.filter(id => !out.includes(id) && !SIM.vaulted.has(id) && /epic|legendary/.test(rarOf(id)) && meta(id).last <= day - 42);
  while (out.length < WEEKLY_SLOTS) { const c = cand(); const id = wpickIds(r, c.length ? c : SIM.pool.filter(id => !out.includes(id) && /epic|legendary/.test(rarOf(id))), (id) => 1 + Math.min(120, day - meta(id).last) / 20); if (!id) break; out.push(id); }
  for (const id of out) { appear(id, day, endDay); const m = meta(id); if (m.days.length >= CAP[rarOf(id)] && !SIM.vaulted.has(id)) SIM.vaulted.set(id, endDay); }
  SIM.weeks.set(w, { ids: out, tags });
}
function stepDay(day) {
  const w = weekOf(day); if (!SIM.weeks.has(w)) stepWeek(w, day);
  const week = SIM.weeks.get(w).ids; const r = G.rng(G.hash('daily', day)); const out = []; const tags = {};
  for (const s of [0, 1]) { const it = resolve(G.make('d', day, s).id); out.push(it.id); tags[it.id] = 'new'; SIM.pool.push(it.id); }
  // season shop items join the Vault a year after their season ends
  const sn = SE().seasonAt(PR().dayStart(day) + 3600e3).number;
  for (let n = 1; n < sn; n++) { const endDay = EPOCH_DAY + n * 56 - 1; if (day === endDay + SEASON_VAULT_AFTER) for (let s = 0; s < 6; s++) { const id = resolve(G.make('s', n, s, G.parse.contexts.s(n, s)).id).id; SIM.vaulted.set(id, endDay); } }
  // Vault return slot
  const vault = [...SIM.vaulted.entries()].filter(([id, v]) => day - Math.max(v, meta(id).last) >= VAULT_GAP && day - (SIM.lastReturn.get(id) ?? -1e9) >= VAULT_REPEAT && !week.includes(id)).map(([id]) => id);
  const vid = wpickIds(r, vault, (id) => 1 + (day - meta(id).last) / 30);
  if (vid) { out.push(vid); tags[vid] = 'vault'; SIM.lastReturn.set(vid, day); }
  const ok = (id, cool) => !out.includes(id) && !week.includes(id) && !SIM.vaulted.has(id) && day - meta(id).last >= (cool ? COOL[rarOf(id)] : 1);
  while (out.length < DAILY_SLOTS) {
    let c = SIM.pool.filter(id => ok(id, true) && (rarOf(id) !== 'legendary' || r() < 0.15));
    if (!c.length) c = SIM.pool.filter(id => ok(id, false));
    const id = wpickIds(r, c, (id) => RW[rarOf(id)] * (1 + Math.min(60, day - meta(id).last) / 15)); if (!id) break; out.push(id);
  }
  for (const id of out) { if (tags[id] === 'vault') { meta(id).last = day; meta(id).days.push(day); continue; } appear(id, day); const m = meta(id); if (m.days.length >= CAP[rarOf(id)] && !SIM.vaulted.has(id)) SIM.vaulted.set(id, day); }
  SIM.days.set(day, { ids: out, tags });
}
function ensure(day) { while (SIM.day < day) { SIM.day++; stepDay(SIM.day); } }
const realToday = () => dayNum(Date.now());
function syncGen() { const today = realToday(); ensure(today + 2); for (const [d, id] of SIM.intro) { if (d > today + 2) break; if (!GEN.has(id)) { const it = resolve(id); GEN.set(id, it); ITEMS.push(it); } } }

// what is on sale at time t (pure; the admin overlay in src/admin-ops.js may wrap this to add pins / remove retired items)
function rotation(t = Date.now()) {
  const day = Math.max(EPOCH_DAY, dayNum(t)); ensure(day + 1); syncGen();
  const w = weekOf(day); const wk = SIM.weeks.get(w); const dd = SIM.days.get(day);
  const season = SE().seasonAt(t); const seasonItems = [0, 1, 2, 3, 4, 5].map(s => resolve(G.make('s', season.number, s, G.parse.contexts.s(season.number, s)).id));
  const evs = eventsOn(day).map(ev => ({ key: ev.key, name: ev.name, icon: ev.icon, year: ev.year, starts_at: PR().dayStart(ev.first), ends_at: PR().dayStart(ev.last + 1), items: eventItems(ev) }));
  for (const e of adminEvents(t)) evs.push(e);
  const tags = { ...wk.tags, ...dd.tags }; for (const e of evs) for (const x of e.items) tags[x.it.id] = x.tag;
  return { day, week: w, daily: dd.ids.map(resolve), weekly: wk.ids.map(resolve), season: { number: season.number, name: season.name, ends_at: season.end_at + 1, items: seasonItems },
    events: evs.map(e => ({ ...e, items: e.items.map(x => x.it) })), tags,
    daily_ends: PR().dayStart(day + 1), weekly_ends: PR().dayStart(weekStartDay(w) + 7), season_ends: season.end_at + 1 };
}
function adminEvents(t) {
  let rows = []; try { rows = db.prepare("SELECT id, name, items, ends_at, starts_at FROM hub_events WHERE kind='themed_weekend' AND status<>'cancelled' AND starts_at<=? AND ends_at>=?").all(t, t); } catch { return []; }
  return rows.map(e => { let picked = []; try { picked = JSON.parse(e.items || '[]'); } catch {}
    return { key: 'admin-' + e.id, name: e.name, icon: 'party-popper', starts_at: e.starts_at, ends_at: e.ends_at, admin: true,
      items: [...[0, 1].map(s => ({ it: resolve(G.make('e', 900000 + e.id, s, G.parse.contexts.e(900000 + e.id, s)).id), tag: 'event' })), ...picked.map(resolve).filter(Boolean).map(it => ({ it, tag: 'event' }))] }; });
}
const allOnSale = (rot) => [...rot.daily, ...rot.weekly, ...(rot.season ? rot.season.items : []), ...(rot.events || []).flatMap(e => e.items)];
const inRotation = (rot, it) => allOnSale(rot).some(x => x && it && x.id === it.id);

// ---------- earned (score / leaderboard gated) items: never sold ----------
let RANGES = {}; try { RANGES = require('../docs/score-ranges.json').games || {}; } catch {}
const nice = (x) => { if (!(x > 0)) return 0; const p = Math.pow(10, Math.max(0, Math.floor(Math.log10(x)) - 1)); return Math.round(x / p) * p; };
const GATES = []; const GATE_BY = new Map();
for (const g of cfg.GAMES) {
  const R = RANGES[g.id]; if (g.giveaway === false || !R || !R.good || !R.top1) continue; // giveaway-eligible games only (config.js sets g.giveaway)
  const num = G.hash('gate', g.id) % 800000 + 1000; GATE_BY.set(num, g);
  GATES.push({ num, slot: 0, game: g.id, kind: 'score', need: nice(R.good.median_pb), label: 'good' }, { num, slot: 1, game: g.id, kind: 'score', need: nice(R.top1.pb), label: 'top 1%' });
}
const PODIUM = 999001;
GATES.push({ num: PODIUM, slot: 0, kind: 'weekly', need: 3, label: 'podium' }, { num: PODIUM, slot: 1, kind: 'weekly', need: 10, label: 'top 10' });
G.parse.contexts.b = (num, slot) => {
  if (num === PODIUM) return slot === 0 ? { type: 'badge', rarity: 'epic', palette: 'gold', theme: 'gaming', name: 'Weekly Podium', icon: 'trophy' } : slot === 1 ? { type: 'title', rarity: 'rare', palette: 'chrome', theme: 'gaming', name: 'Weekly Top 10' } : null;
  const g = GATE_BY.get(num); if (!g || slot > 1) return null; const pal = G.PAL_KEYS[G.hash('gp', g.id) % G.PAL_KEYS.length];
  return slot === 0 ? { type: 'banner', rarity: 'epic', palette: pal, theme: 'gaming', name: `${g.title} Pro` } : { type: 'frame', rarity: 'legendary', palette: pal, theme: 'gaming', name: `${g.title} Elite` };
};
const gateItem = (gt) => resolve(G.make('b', gt.num, gt.slot, G.parse.contexts.b(gt.num, gt.slot)).id);
const gateText = (gt) => gt.kind === 'weekly' ? (gt.need === 3 ? 'Finish top 3 on any game\'s weekly leaderboard' : 'Finish top 10 on any game\'s weekly leaderboard')
  : `Score ${gt.need.toLocaleString('en-US')}${(cfg.GAME_MAP[gt.game] || {}).unit === 'm' ? 'm' : ''}+ in ${(cfg.GAME_MAP[gt.game] || {}).title} (${gt.label === 'good' ? 'a strong player\'s best' : 'top 1% of players'})`;
function grantGates(userId, t = Date.now()) {
  const best = new Map(db.prepare('SELECT game_id, MAX(score) AS b FROM runs WHERE user_id=? AND held=0 GROUP BY game_id').all(userId).map(r => [r.game_id, r.b]));
  const ins = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)'); const got = [];
  for (const gt of GATES) if (gt.kind === 'score' && (best.get(gt.game) || 0) >= gt.need) { const it = gateItem(gt); if (ins.run(userId, it.id, t).changes) got.push(it); }
  if (got.length) try { require('./notify').notify(userId, 'achievement', `Unlocked: ${got.map(i => i.name).join(', ')}`, 'Earned by score, not bought. Equip it from your profile.', '/shop#earned', 'award'); } catch {}
  return got;
}
// weekly leaderboard rewards for the last finished week (runs from the sweep; idempotent)
function grantWeekly(t = Date.now()) {
  const w = weekOf(dayNum(t)) - 1; const key = 'econ_weekly_' + w; if (db.prepare('SELECT 1 FROM settings WHERE key=?').get(key)) return 0;
  const a = PR().dayStart(weekStartDay(w)), b = PR().dayStart(weekStartDay(w) + 7) - 1; let n = 0;
  const ins = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)');
  const pod = gateItem(GATES.find(g => g.num === PODIUM && g.slot === 0)), t10 = gateItem(GATES.find(g => g.num === PODIUM && g.slot === 1));
  db.transaction(() => {
    for (const g of cfg.GAMES.filter(g => g.giveaway !== false)) {
      const rows = db.prepare('SELECT r.user_id, MAX(r.score) AS s FROM runs r JOIN users u ON u.id=r.user_id WHERE r.game_id=? AND r.created_at BETWEEN ? AND ? AND r.held=0 AND u.banned=0 AND u.is_demo=0 GROUP BY r.user_id ORDER BY s DESC LIMIT 10').all(g.id, a, b);
      rows.forEach((r, i) => { if (i < 3) n += ins.run(r.user_id, pod.id, t).changes; n += ins.run(r.user_id, t10.id, t).changes; });
    }
    db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)').run(key, JSON.stringify({ at: t, granted: n }));
  })();
  return n;
}

// ---------- pricing: rarity x type x demand x scarcity x appearances x section (no fixed tiers) ----------
const TYPE_MULT = { banner: 1, frame: 1.1, color: 0.9, title: 0.7, badge: 0.8, effect: 1.25 };
const PRICE_FLOOR = 50;
let PSTAT = { day: null };
function priceStats(day) {
  if (PSTAT.day === day && Date.now() - PSTAT.at < 3600e3) return PSTAT;
  const start = PR().dayStart(day), from = start - 14 * 864e5;
  const buys = new Map(db.prepare('SELECT item_id, COUNT(*) AS n FROM user_items WHERE price>0 AND acquired_at>=? AND acquired_at<? GROUP BY item_id').all(from, start).map(r => [r.item_id, r.n]));
  const owners = new Map(db.prepare('SELECT item_id, COUNT(*) AS n FROM user_items WHERE acquired_at<? GROUP BY item_id').all(start).map(r => [r.item_id, r.n]));
  const active = Math.max(20, db.prepare('SELECT COUNT(DISTINCT user_id) AS n FROM runs WHERE created_at>=? AND created_at<?').get(start - 30 * 864e5, start).n);
  // demand is relative: an item's buys vs the average buys per listed item of its type over the same 14 days
  ensure(day); const listed = new Set(); for (let d = day - 14; d < day; d++) { const x = SIM.days.get(d); if (x) x.ids.forEach(i => listed.add(i)); const w = SIM.weeks.get(weekOf(d)); if (w) w.ids.forEach(i => listed.add(i)); }
  for (const id of buys.keys()) listed.add(id);
  const avg = {}; const cnt = {}; for (const id of listed) { const it = resolve(id); if (!it) continue; cnt[it.type] = (cnt[it.type] || 0) + 1; avg[it.type] = (avg[it.type] || 0) + (buys.get(id) || 0); }
  for (const k in avg) avg[k] /= Math.max(1, cnt[k]);
  PSTAT = { day, at: Date.now(), buys, owners, active, avg, cache: new Map() }; return PSTAT;
}
function priceParts(it, t = Date.now()) {
  const day = Math.max(EPOCH_DAY, dayNum(t)); const st = priceStats(day);
  const base = RARITY[it.rarity].price * (TYPE_MULT[it.type] || 1);
  const b = st.buys.get(it.id) || 0; const avg = st.avg[it.type] || 0;
  const demand = Math.min(1.35, Math.max(0.85, 1 + 0.12 * Math.log2((b + 1) / (avg + 1))));
  const share = (st.owners.get(it.id) || 0) / st.active;
  ensure(day); const m = SIM.seen.get(it.id); const before = m ? m.days.filter(d => d < day).length : 0;
  // scarcity only counts once an item has been on sale before (a debut has no ownership signal yet)
  const scarcity = before === 0 ? 1 : share < 0.01 ? 1.1 : share < 0.05 ? 1.04 : share > 0.25 ? 0.88 : share > 0.12 ? 0.95 : 1;
  const tag = currentTag(it.id, day);
  const appear = tag === 'vault' ? 1.25 : before === 0 ? 1.08 : before <= 2 ? 1 : before <= 4 ? 0.94 : 0.88;
  const section = it.src === 's' || it.src === 'e' ? 1.15 : 1;
  const jitter = 0.96 + (G.hash('px', it.id) % 81) / 1000;
  const raw = base * demand * scarcity * appear * section * jitter;
  const price = Math.max(PRICE_FLOOR, Math.round(Math.min(base * 2.2, Math.max(base * 0.6, raw)) / 5) * 5);
  return { price, base: Math.round(base), rarity: RARITY[it.rarity].price, type_mult: TYPE_MULT[it.type] || 1, demand: +demand.toFixed(3), scarcity, appearances: before, appear_mult: appear, section_mult: section, jitter: +jitter.toFixed(3), recent_buys: b, owners: st.owners.get(it.id) || 0, active_players: st.active, tag: tag || null };
}
function currentTag(id, day) { const d = SIM.days.get(day); if (d && d.tags[id]) return d.tags[id]; const w = SIM.weeks.get(weekOf(day)); return w && w.tags[id] ? w.tags[id] : null; }
function listPrice(it, t = Date.now()) { const day = dayNum(t); const st = priceStats(Math.max(EPOCH_DAY, day)); const c = st.cache.get(it.id); if (c !== undefined) return c; const p = priceParts(it, t).price; st.cache.set(it.id, p); return p; }
// what this player pays (season perks: 5 / 10 / 15% off)
function priceFor(it, user, t = Date.now()) { const p = it.price; const d = user ? SE().perksOf(user.id, t).discount : 0; return d ? Math.max(PRICE_FLOOR, Math.round(p * (100 - d) / 100 / 5) * 5) : p; }

// ---------- earning (idempotent ledger sync from server-validated data) ----------
// v7 rebalance: runs pay 5, +5 for a score at a strong player's level and +15 at the top-1% level (docs/score-ranges.json),
// so skill earns more than grinding; the 40-runs-a-day cap stays. Season levels pay points on the free track (seasons.js).
const EARN = { run: 5, pb: 10, runDailyCap: 40, skill: { good: 5, top1: 15 }, quest: 25, checkinPerDay: 10, checkinMax: 70, ach: { bronze: 20, silver: 40, gold: 80, epic: 150, legendary: 400 }, referral: 150, challenge: 30, season: 'free track: 40-140 per level, 100 per Overdrive star' };
const SKILL = {}; for (const [id, R] of Object.entries(RANGES)) if (R.good && R.top1) SKILL[id] = { good: nice(R.good.median_pb), top1: nice(R.top1.pb) };
const insL = db.prepare('INSERT OR IGNORE INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)');
function sync(userId) {
  const ach = require('./achievements');
  db.transaction(() => {
    const runs = db.prepare('SELECT id, game_id, score, created_at FROM runs WHERE user_id=? AND id > COALESCE((SELECT MAX(CAST(ref AS INTEGER)) FROM points_ledger WHERE user_id=? AND reason=\'run\'), 0) ORDER BY id').all(userId, userId);
    if (runs.length) {
      const best = {}; for (const r of db.prepare('SELECT game_id, MAX(score) AS b FROM runs WHERE user_id=? AND id < ? GROUP BY game_id').all(userId, runs[0].id)) best[r.game_id] = r.b;
      const perDay = {};
      for (const r of runs) {
        const day = Math.floor(r.created_at / D);
        if (perDay[day] === undefined) perDay[day] = db.prepare("SELECT COUNT(*) AS c FROM points_ledger WHERE user_id=? AND reason='run' AND created_at >= ? AND created_at < ?").get(userId, day * D, (day + 1) * D).c;
        const pb = best[r.game_id] !== undefined && r.score > best[r.game_id];
        best[r.game_id] = Math.max(best[r.game_id] ?? -1, r.score);
        const sk = SKILL[r.game_id]; const skill = sk ? (r.score >= sk.top1 ? EARN.skill.top1 : r.score >= sk.good ? EARN.skill.good : 0) : 0;
        const amt = perDay[day] < EARN.runDailyCap ? EARN.run + (pb ? EARN.pb : 0) + skill : 0; perDay[day]++;
        insL.run(userId, amt, 'run', String(r.id), r.created_at);
      }
    }
    for (const a of db.prepare('SELECT ach_id, unlocked_at FROM user_achievements WHERE user_id=?').all(userId)) { const def = ach.BY_ID[a.ach_id]; if (def) insL.run(userId, EARN.ach[def.tier] || 20, 'achievement', a.ach_id, a.unlocked_at); }
    for (const q of db.prepare('SELECT day, idx, created_at FROM quest_claims WHERE user_id=?').all(userId)) insL.run(userId, EARN.quest, 'quest', q.day + '-' + q.idx, q.created_at);
    const days = db.prepare('SELECT day, created_at FROM checkins WHERE user_id=? ORDER BY day').all(userId); let run = 0, prev = null;
    for (const c of days) { run = prev !== null && c.day === prev + 1 ? run + 1 : 1; prev = c.day; insL.run(userId, Math.min(EARN.checkinMax, EARN.checkinPerDay * run), 'checkin', String(c.day), c.created_at); }
    for (const r of db.prepare('SELECT r.id, r.created_at FROM users r WHERE r.referred_by=? AND r.banned=0 AND EXISTS (SELECT 1 FROM runs WHERE user_id=r.id)').all(userId)) insL.run(userId, EARN.referral, 'referral', String(r.id), r.created_at);
    for (const c of db.prepare("SELECT id, responded_at, created_at FROM challenges WHERE winner_id=? AND status='completed'").all(userId)) insL.run(userId, EARN.challenge, 'challenge', String(c.id), c.responded_at || c.created_at);
  })();
  try { SE().claimTrack(userId); } catch (e) { console.error('season track', e.message); }
  try { grantGates(userId); } catch (e) { console.error('gates', e.message); }
  return balance(userId);
}
const balance = (userId) => db.prepare('SELECT COALESCE(SUM(amount),0) AS b FROM points_ledger WHERE user_id=?').get(userId).b;
const earned = (userId) => db.prepare('SELECT COALESCE(SUM(amount),0) AS b FROM points_ledger WHERE user_id=? AND amount > 0').get(userId).b;
const owned = (userId) => new Set(db.prepare('SELECT item_id FROM user_items WHERE user_id=?').all(userId).map(r => r.item_id));

function buy(user, itemId, t = Date.now()) {
  const it = BY_ID[itemId]; if (!it) return { ok: false, error: 'Unknown item.' };
  if (it.src === 'k' || it.src === 'b') return { ok: false, error: 'This item is earned, not sold.' };
  const rot = module.exports.rotation(t); if (!inRotation(rot, it)) return { ok: false, error: 'That item is not in the shop right now. Check back when it rotates in.' };
  if (owned(user.id).has(it.id)) return { ok: false, error: 'You already own this.' };
  const price = module.exports.priceFor(it, user, t);
  const bal = module.exports.sync(user.id); if (bal < price) return { ok: false, error: `You need ${price - bal} more Hub Points.` };
  const res = db.transaction(() => {
    const b = balance(user.id); if (b < price) return false;
    const r = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,?,?)').run(user.id, it.id, price, t); if (!r.changes) return false;
    insL.run(user.id, -price, 'purchase', it.id, t); return true;
  })();
  return res ? { ok: true, item: module.exports.pub(it, true), price, balance: balance(user.id) } : { ok: false, error: 'Purchase failed. Try again.' };
}
const TAG_LABEL = { new: 'New', vault: 'Back from the Vault', returning: 'Returning', event: 'Event', season: 'Season' };
const pub = (i, own) => ({ id: i.id, type: i.type, name: i.name, rarity: i.rarity, rarity_label: RARITY[i.rarity].label, theme: THEMES[i.theme] || i.theme, price: i.price, owned: !!own,
  ...(i.type === 'badge' ? { icon: i.generated ? i.art.icon : i.extra } : {}), ...(i.type === 'frame' ? { anim: i.extra.split('|')[1] } : {}),
  generated: !!i.generated, ...(i.generated && ['banner', 'frame', 'color', 'title', 'badge', 'effect'].includes(i.type) ? { art: `/shop/art/${i.id}.svg` } : {}), ...(i.label ? { label: i.label } : {}) });

// ---------- generated CSS: handmade items + every generated item that could be on screen ----------
function liveGenerated() {
  syncGen(); const today = realToday(); const ids = new Set();
  for (const [d, id] of SIM.intro) if (d >= today - 60 && d <= today + 2) ids.add(id);
  for (let d = today - 1; d <= today + 2; d++) { ensure(d); const x = SIM.days.get(d); if (x) x.ids.forEach(i => ids.add(i)); const w = SIM.weeks.get(weekOf(d)); if (w) w.ids.forEach(i => ids.add(i)); }
  const sn = SE().seasonAt().number; for (let s = 0; s < 6; s++) { ids.add(G.make('s', sn, s, G.parse.contexts.s(sn, s)).id); }
  for (const n of [sn - 1, sn, sn + 1]) if (n >= 1) { SE().SCHEDULE.forEach((_, i) => ids.add(SE().trackItem(n, i).id)); ids.add(SE().trackItem(n, 90).id); ids.add(SE().trackItem(n, 91).id); }
  for (const d of [today, today + 1]) for (const ev of eventsOn(d)) eventItems(ev).forEach(x => ids.add(x.it.id));
  for (const gt of GATES) ids.add(gateItem(gt).id);
  for (const r of db.prepare("SELECT DISTINCT item_id FROM user_items WHERE item_id LIKE 'v7%' OR item_id LIKE 'fx-v7%'").all()) ids.add(r.item_id);
  return [...ids].map(resolve).filter(i => i && i.generated);
}
let CSS_CACHE = { key: '', css: '' };
function css() {
  const gen = liveGenerated(); const key = realToday() + ':' + gen.length;
  if (CSS_CACHE.key === key) return CSS_CACHE.css;
  const out = ['/* v5 + v7 shop cosmetics (generated by src/shop.js + src/shop-gen.js) */', G.KEYFRAMES];
  for (const i of HANDMADE) {
    if (i.type === 'banner') out.push(`.bn-${i.id}{background:${i.extra};background-color:#0b1030}`);
    if (i.type === 'frame') { const [bg, anim] = i.extra.split('|'); out.push(`.fr-${i.id}{--frame-bg:${bg}}`); if (anim) out.push(`.fr-${i.id}::before{animation:${{ spin: 'fr-spin 5s linear infinite', glow: 'fr-glow 2.6s ease-in-out infinite', pulse: 'fr-pulse 1.6s ease-in-out infinite' }[anim]}}`); }
    if (i.type === 'color') out.push(`.nc-${i.id} .nt{background:${i.extra};-webkit-background-clip:text;background-clip:text;color:transparent}`);
  }
  for (const i of gen) { if (i.type === 'banner') out.push(`.bn-${i.id}{background:url(/shop/art/${i.id}.svg) center/cover no-repeat;background-color:${G.PALETTES[i.palette][0]}}`); else { const c = G.itemCss(i); if (c) out.push(c); } }
  CSS_CACHE = { key, css: out.join('\n') + '\n' }; return CSS_CACHE.css;
}
const cssKey = () => realToday() + ':' + liveGenerated().length;

// ---------- views for the player pages ----------
const DISCLAIMER = 'Hub Points are cosmetic only. They have no cash value, cannot be bought, sold, traded or transferred, and cannot be redeemed for prizes or giveaway entries.';
const RULES = [
  'Daily picks change every day at midnight (hub time, America/New_York): 2 brand-new items, 1 Vault return when one is due, and 3 items from the catalog.',
  'Weekly featured changes every Monday at midnight: 2 brand-new epic or legendary items plus 2 picks from the catalog.',
  'The season shop sells 6 season-themed items for the whole 8-week season. Events (Launch Week, Spooky Haze, 4/20 Week and more) add 4 themed items while they run, and last year\'s event items return.',
  'New items are generated forever, so the catalog never runs out. Each item retires to the Vault after a few appearances (common 8, rare 6, epic 4, legendary 3).',
  'Vault items can come back after at least 90 days (at most once every 180 days) for 25% more. Season shop items join the Vault a year after their season ends. Season track rewards and earned items never come back.',
  'There are no fixed price tiers. A price starts from rarity and item type, then moves with demand (purchases over the last 14 days), scarcity (how many active players own it) and how often it has appeared. Prices are set at midnight and hold all day.',
  'Earned items cannot be bought: reach a score target or finish on a weekly leaderboard to unlock them.',
];
function view(user, t = Date.now()) {
  const rot = module.exports.rotation(t); const own = user ? owned(user.id) : new Set(); const P = (i) => module.exports.pub(i, own.has(i.id));
  const perks = user ? SE().perksOf(user.id, t) : { discount: 0 };
  const card = (i) => { const o = P(i); const tg = rot.tags[i.id]; if (tg) { o.tag = tg; o.tag_label = TAG_LABEL[tg]; } if (perks.discount && !o.owned) o.your_price = module.exports.priceFor(i, user, t); return o; };
  const out = { daily: rot.daily.map(card), weekly: rot.weekly.map(card), season: { ...rot.season, items: rot.season.items.map(i => ({ ...card(i), tag: 'season', tag_label: 'Season' })) },
    events: rot.events.map(e => ({ ...e, items: e.items.map(card) })), daily_ends: rot.daily_ends, weekly_ends: rot.weekly_ends, season_ends: rot.season_ends, perks, rules: RULES };
  if (perks.peek) { const tm = module.exports.rotation(PR().dayStart(rot.day + 1) + 3600e3); out.peek = tm.daily.map(i => ({ ...P(i), tag: tm.tags[i.id], tag_label: TAG_LABEL[tm.tags[i.id]] })); }
  if (perks.vault) { const list = []; for (let d = rot.day + 1; d <= rot.day + 7; d++) { ensure(d); const x = SIM.days.get(d); for (const id of x.ids) if (x.tags[id] === 'vault') list.push({ day: d, at: PR().dayStart(d), item: P(resolve(id)) }); } out.vault_radar = list; }
  const best = user ? new Map(db.prepare('SELECT game_id, MAX(score) AS b FROM runs WHERE user_id=? AND held=0 GROUP BY game_id').all(user.id).map(r => [r.game_id, r.b])) : new Map();
  out.earned_items = GATES.map(gt => { const it = gateItem(gt); return { ...P(it), requirement: gateText(gt), game: gt.game || null, need: gt.kind === 'score' ? gt.need : null, best: gt.kind === 'score' ? best.get(gt.game) || 0 : null, kind: gt.kind }; });
  return out;
}
function history(id) {
  const it = resolve(id); if (!it) return null; ensure(realToday() + 1); const m = SIM.seen.get(it.id);
  const today = realToday(); const days = m ? m.days.filter(d => d <= today) : []; const next = m ? m.days.filter(d => d > today) : [];
  const v = SIM.vaulted.get(it.id);
  return { first_seen: days.length ? PR().dayStart(days[0]) : null, appearances: days.length, last_seen: days.length ? PR().dayStart(days[days.length - 1]) : null, vaulted: v !== undefined && v <= today, vaulted_at: v !== undefined && v <= today ? PR().dayStart(v) : null, retire_after: CAP[it.rarity], tomorrow: next.includes(today + 1) };
}
function detail(user, id, t = Date.now()) {
  const it = resolve(id); if (!it) return null; const rot = module.exports.rotation(t); const own = user ? owned(user.id).has(it.id) : false;
  const o = module.exports.pub(it, own); const on = inRotation(rot, it); const tag = rot.tags[it.id] || (rot.season.items.some(x => x.id === it.id) ? 'season' : null);
  const where = rot.daily.some(x => x.id === it.id) ? { section: 'daily', ends_at: rot.daily_ends } : rot.weekly.some(x => x.id === it.id) ? { section: 'weekly', ends_at: rot.weekly_ends }
    : rot.season.items.some(x => x.id === it.id) ? { section: 'season', ends_at: rot.season_ends } : (() => { const e = rot.events.find(e => e.items.some(x => x.id === it.id)); return e ? { section: 'event', event: e.name, ends_at: e.ends_at } : null; })();
  const gate = GATES.find(g => gateItem(g).id === it.id);
  const owners = db.prepare('SELECT COUNT(*) AS n FROM user_items WHERE item_id=?').get(it.id).n;
  return { item: { ...o, tag, tag_label: TAG_LABEL[tag] }, on_sale: on, where, source: it.src === 'k' ? `Season ${it.num} free track (${it.label || 'level reward'})` : it.src === 'b' ? 'Earned, not sold' : it.src === 's' ? `Season ${it.num} shop` : it.src === 'e' ? 'Event item' : it.src === 'w' ? 'Weekly featured drop' : it.src === 'd' ? 'Daily drop' : 'Original v5 collection',
    sold: it.src !== 'k' && it.src !== 'b', requirement: gate ? gateText(gate) : null, price: on ? priceParts(it, t) : null, your_price: on && user ? module.exports.priceFor(it, user, t) : null, history: history(it.id), owners };
}
// for the admin panel (src/admin-ops.js) and tests: the catalog that has appeared so far, newest first
function catalog({ limit = 500, type = '', q = '' } = {}) {
  syncGen(); const today = realToday();
  const list = [...HANDMADE, ...[...GEN.values()].filter(i => (SIM.seen.get(i.id) || {}).first <= today).reverse()];
  return list.filter(i => (!type || i.type === type) && (!q || i.name.toLowerCase().includes(String(q).toLowerCase()))).slice(0, limit).map(i => ({ ...pub(i, false), src: i.generated ? i.src : 'v5', history: history(i.id) }));
}
// A deterministic 1,200-item rotating universe: two new daily originals for 600 days.
 // Items are previewable in the catalog, but purchase still requires the item to be in the active rotation.
const CATALOG_UNIVERSE_SIZE = 1200;
function catalogUniverse({ limit = 50, offset = 0, type = '', q = '', user = null, t = Date.now() } = {}) {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(Number(limit) || 50)));
  const safeOffset = Math.max(0, Math.min(CATALOG_UNIVERSE_SIZE, Math.floor(Number(offset) || 0)));
  const needle = String(q || '').trim().slice(0, 80).toLowerCase();
  const rot = module.exports.rotation(t);
  const onSale = new Set(module.exports.allOnSale(rot).map(it => it.id));
  const own = user ? owned(user.id) : new Set();
  const matches = [];
  for (let n = 0; n < 600; n++) {
    const day = EPOCH_DAY + n;
    for (let slot = 0; slot < 2; slot++) {
      const it = resolve(G.make('d', day, slot).id);
      if (!it || (type && it.type !== type) || (needle && !it.name.toLowerCase().includes(needle))) continue;
      matches.push({ it, day });
    }
  }
  return { total: matches.length, offset: safeOffset, limit: safeLimit,
    items: matches.slice(safeOffset, safeOffset + safeLimit).map(({ it, day }) => ({ ...module.exports.pub(it, own.has(it.id)), catalog_only: !onSale.has(it.id), on_sale: onSale.has(it.id), scheduled_day: day })) };
}
function schedule(days = 14, t = Date.now()) { const d0 = Math.max(EPOCH_DAY, dayNum(t)); const out = []; for (let d = d0; d < d0 + days; d++) { const r = module.exports.rotation(PR().dayStart(d) + 3600e3); out.push({ day: d, at: PR().dayStart(d), daily: r.daily.map(i => ({ id: i.id, name: i.name, tag: r.tags[i.id] || null })), weekly: r.weekly.map(i => i.id), events: r.events.map(e => e.name) }); } return out; }
function stats() { syncGen(); return { catalog_universe: CATALOG_UNIVERSE_SIZE, generated_so_far: GEN.size, handmade: HANDMADE.length, vaulted: [...SIM.vaulted.values()].filter(v => v <= realToday()).length, simulated_to: SIM.day }; }
// owned + currently-listed shop items of one type (Customize page lists only these, not the whole endless catalog)
function listFor(own, type) {
  const rot = module.exports.rotation(); const ids = new Set([...HANDMADE.filter(i => i.type === type).map(i => i.id)]);
  for (const id of own) { const it = resolve(id.replace(/^shop:/, '')); if (it && it.type === type) ids.add(it.id); }
  for (const i of allOnSale(rot)) if (i.type === type) ids.add(i.id);
  return [...ids].map(resolve).filter(Boolean);
}

let ICONS = null;
function icons() { if (!ICONS) { try { ICONS = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'js', 'icons.js'), 'utf8').match(/export const ICONS=(\{.*?\});/s)[1]); } catch { ICONS = {}; } } return ICONS; }
function routes(app, A, H) {
  app.get('/shop/art/:id.svg', (req, res) => {
    const it = resolve(req.params.id); if (!it || !it.generated) return res.status(404).end();
    const svg = G.itemThumbSvg(it, icons());
    if (!svg) return res.status(404).end();
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
    res.send(svg);
  });
  app.get('/api/shop/catalog', (req, res) => {
    const me = H.currentUser(req);
    const page = module.exports.catalogUniverse({ limit: req.query.limit, offset: req.query.offset, type: req.query.type, q: req.query.q, user: me });
    res.setHeader('Cache-Control', 'private, max-age=60');
    res.json({ ok: true, catalog_size: CATALOG_UNIVERSE_SIZE, ...page });
  });
  app.get('/api/shop/item/:id', (req, res) => { const me = H.currentUser(req); const d = detail(me, req.params.id); if (!d) return res.status(404).json({ ok: false, error: 'No such item.' }); res.json({ ok: true, ...d }); });
  app.get('/api/shop/rules', (req, res) => res.json({ ok: true, rules: RULES, earn: EARN, rarity: RARITY, type_mult: TYPE_MULT, caps: CAP, cooldowns: COOL, seasons: SE().RULES, perks: SE().PERKS, disclaimer: DISCLAIMER }));
  app.get('/api/shop/upcoming', (req, res) => res.json({ ok: true, events: upcomingEvents(), season: (() => { const s = SE().seasonAt(); return { number: s.number, name: s.name, ends_at: s.end_at + 1 }; })() }));
  setTimeout(() => { try { grantWeekly(); } catch (e) { console.error('weekly gates', e.message); } }, 5000).unref();
  setInterval(() => { try { grantWeekly(); } catch (e) { console.error('weekly gates', e.message); } }, 3600e3).unref();
}
function upcomingEvents(t = Date.now()) { const d0 = dayNum(t); const out = []; for (let d = d0; d < d0 + 400 && out.length < 4; d++) for (const ev of eventsOn(d)) if (ev.first === d || (d === d0)) { if (!out.some(x => x.key === ev.key && x.year === ev.year)) out.push({ key: ev.key, name: ev.name, icon: ev.icon, starts_at: PR().dayStart(ev.first), ends_at: PR().dayStart(ev.last + 1), live: ev.first <= d0 }); } return out; }

module.exports = { ITEMS, BY_ID, RARITY, THEMES, EARN, sync, balance, earned, owned, rotation, buy, pub, css, cssKey, attach,
  // v7 engine (docs/ECONOMY.md)
  EPOCH_DAY, EVENTS, GATES, CAP, COOL, TYPE_MULT, RULES, DISCLAIMER, resolve, listPrice, priceParts, priceFor, inRotation, allOnSale, view, detail, history, catalog, catalogUniverse, CATALOG_UNIVERSE_SIZE, schedule, stats, listFor,
  grantGates, grantWeekly, eventsOn, upcomingEvents, routes, gateItem, _sim: SIM };

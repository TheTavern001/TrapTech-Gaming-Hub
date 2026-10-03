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
const BY_ID = Object.fromEntries(ITEMS.map(i => [i.id, i]));

// ---------- earning (idempotent ledger sync from server-validated data) ----------
const EARN = { run: 5, pb: 10, runDailyCap: 40, quest: 25, checkinPerDay: 10, checkinMax: 70, ach: { bronze: 20, silver: 40, gold: 80, epic: 150, legendary: 400 }, referral: 150, challenge: 30 };
const insL = db.prepare('INSERT OR IGNORE INTO points_ledger (user_id, amount, reason, ref, created_at) VALUES (?,?,?,?,?)');
function sync(userId) {
  const ach = require('./achievements');
  db.transaction(() => {
    // runs: +5 each (first 40 runs per day), +10 more for a new personal best
    const runs = db.prepare('SELECT id, game_id, score, created_at FROM runs WHERE user_id=? AND id > COALESCE((SELECT MAX(CAST(ref AS INTEGER)) FROM points_ledger WHERE user_id=? AND reason=\'run\'), 0) ORDER BY id').all(userId, userId);
    if (runs.length) {
      const best = {}; for (const r of db.prepare('SELECT game_id, MAX(score) AS b FROM runs WHERE user_id=? AND id < ? GROUP BY game_id').all(userId, runs[0].id)) best[r.game_id] = r.b;
      const perDay = {};
      for (const r of runs) {
        const day = Math.floor(r.created_at / D);
        if (perDay[day] === undefined) perDay[day] = db.prepare("SELECT COUNT(*) AS c FROM points_ledger WHERE user_id=? AND reason='run' AND created_at >= ? AND created_at < ?").get(userId, day * D, (day + 1) * D).c;
        const pb = best[r.game_id] !== undefined && r.score > best[r.game_id];
        best[r.game_id] = Math.max(best[r.game_id] ?? -1, r.score);
        const amt = perDay[day] < EARN.runDailyCap ? EARN.run + (pb ? EARN.pb : 0) : 0; perDay[day]++;
        insL.run(userId, amt, 'run', String(r.id), r.created_at);
      }
    }
    for (const a of db.prepare('SELECT ach_id, unlocked_at FROM user_achievements WHERE user_id=?').all(userId)) { const def = ach.BY_ID[a.ach_id]; if (def) insL.run(userId, EARN.ach[def.tier] || 20, 'achievement', a.ach_id, a.unlocked_at); }
    for (const q of db.prepare('SELECT day, idx, created_at FROM quest_claims WHERE user_id=?').all(userId)) insL.run(userId, EARN.quest, 'quest', q.day + '-' + q.idx, q.created_at);
    // streak check-ins: 10 x current streak length that day, capped at 70
    const days = db.prepare('SELECT day, created_at FROM checkins WHERE user_id=? ORDER BY day').all(userId); let run = 0, prev = null;
    for (const c of days) { run = prev !== null && c.day === prev + 1 ? run + 1 : 1; prev = c.day; insL.run(userId, Math.min(EARN.checkinMax, EARN.checkinPerDay * run), 'checkin', String(c.day), c.created_at); }
    for (const r of db.prepare('SELECT r.id, r.created_at FROM users r WHERE r.referred_by=? AND r.banned=0 AND EXISTS (SELECT 1 FROM runs WHERE user_id=r.id)').all(userId)) insL.run(userId, EARN.referral, 'referral', String(r.id), r.created_at);
    for (const c of db.prepare("SELECT id, responded_at, created_at FROM challenges WHERE winner_id=? AND status='completed'").all(userId)) insL.run(userId, EARN.challenge, 'challenge', String(c.id), c.responded_at || c.created_at);
  })();
  return balance(userId);
}
const balance = (userId) => db.prepare('SELECT COALESCE(SUM(amount),0) AS b FROM points_ledger WHERE user_id=?').get(userId).b;
const earned = (userId) => db.prepare('SELECT COALESCE(SUM(amount),0) AS b FROM points_ledger WHERE user_id=? AND amount > 0').get(userId).b;
const owned = (userId) => new Set(db.prepare('SELECT item_id FROM user_items WHERE user_id=?').all(userId).map(r => r.item_id));

// ---------- rotation (deterministic per day / week, America/New_York) ----------
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const PR = () => require('./progress');
function pick(pool, n, seed) { const r = rng(seed); const a = [...pool]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, n); }
function rotation(t = Date.now()) {
  const day = PR().dayNum(t); const week = Math.floor((day + 3) / 7); // weeks start Monday
  const weekly = pick(ITEMS.filter(i => i.rarity === 'epic' || i.rarity === 'legendary'), 4, week * 7919 + 13);
  const daily = pick(ITEMS.filter(i => !weekly.includes(i) && (i.rarity === 'common' || i.rarity === 'rare')), 6, day * 104729 + 7);
  return { daily, weekly, day, week, daily_ends: PR().dayStart(day + 1), weekly_ends: PR().dayStart(week * 7 - 3 + 7) };
}
function buy(user, itemId, t = Date.now()) {
  const it = BY_ID[itemId]; if (!it) return { ok: false, error: 'Unknown item.' };
  const rot = rotation(t); if (![...rot.daily, ...rot.weekly].includes(it)) return { ok: false, error: 'That item is not in the shop right now. Check back when it rotates in.' };
  if (owned(user.id).has(it.id)) return { ok: false, error: 'You already own this.' };
  const bal = sync(user.id); if (bal < it.price) return { ok: false, error: `You need ${it.price - bal} more Hub Points.` };
  const res = db.transaction(() => {
    const b = balance(user.id); if (b < it.price) return false;
    const r = db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,?,?)').run(user.id, it.id, it.price, t); if (!r.changes) return false;
    insL.run(user.id, -it.price, 'purchase', it.id, t); return true;
  })();
  return res ? { ok: true, item: pub(it, true), balance: balance(user.id) } : { ok: false, error: 'Purchase failed. Try again.' };
}
const pub = (i, own) => ({ id: i.id, type: i.type, name: i.name, rarity: i.rarity, rarity_label: RARITY[i.rarity].label, theme: THEMES[i.theme], price: i.price, owned: !!own,
  ...(i.type === 'badge' ? { icon: i.extra } : {}), ...(i.type === 'frame' ? { anim: i.extra.split('|')[1] } : {}) });
function css() {
  const out = ['/* v5 shop cosmetics (generated by src/shop.js) */'];
  for (const i of ITEMS) {
    if (i.type === 'banner') out.push(`.bn-${i.id}{background:${i.extra};background-color:#0b1030}`);
    if (i.type === 'frame') { const [bg, anim] = i.extra.split('|'); out.push(`.fr-${i.id}{--frame-bg:${bg}}`); if (anim) out.push(`.fr-${i.id}::before{animation:${{ spin: 'fr-spin 5s linear infinite', glow: 'fr-glow 2.6s ease-in-out infinite', pulse: 'fr-pulse 1.6s ease-in-out infinite' }[anim]}}`); }
    if (i.type === 'color') out.push(`.nc-${i.id} .nt{background:${i.extra};-webkit-background-clip:text;background-clip:text;color:transparent}`);
  }
  return out.join('\n') + '\n';
}
module.exports = { ITEMS, BY_ID, RARITY, THEMES, EARN, sync, balance, earned, owned, rotation, buy, pub, css };

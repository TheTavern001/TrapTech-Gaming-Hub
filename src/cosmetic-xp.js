'use strict';
// This read model must never replace progress.xpFor in ranking or eligibility.
// Ownership persists across seasons and does not require the item to be equipped.
const { verifiedSettlement } = require('./payment-settlement-proof');
function cosmeticProgress(userId, since, until, baseXp, xpFor) {
  const db = require('./db');
  // Seasons are also initialized before the optional store on fresh installs
  // and in standalone economy tools. No store schema means no paid bonus.
  const schema=db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('prestige_owned','store_orders','store_products')").get();
  if(schema.n!==3)return {xp:baseXp,base_xp:baseXp,bonus_xp:0,multiplier:1,starts_at:null};
  const orders = db.prepare(`SELECT o.*, po.created_at AS owned_at
    FROM prestige_owned po JOIN store_orders o ON o.id=po.order_id
    JOIN store_products p ON p.id=po.item_id
    WHERE po.user_id=? AND o.user_id=po.user_id AND o.product_id=po.item_id
      AND p.kind='prestige' AND po.revoked_at IS NULL AND o.refunded_at IS NULL
      AND o.usd_cents>=100000 AND o.status='granted' AND o.granted_at IS NOT NULL`).all(userId);
  const qualified = orders.filter(o => o.provider !== 'manual' &&
    Number.isSafeInteger(o.granted_at) && o.granted_at > 0 &&
    Number.isSafeInteger(o.owned_at) && o.owned_at > 0 &&
    verifiedSettlement({ ...o, status: 'paid' }));
  const start = qualified.reduce((n,o) => Math.min(n, Math.max(o.granted_at,o.owned_at)), Infinity);
  const active = start <= until;
  // Add one extra copy of XP earned after delivery, including quest and
  // achievement XP. No retroactive pre-purchase bonus and no item stacking.
  const bonus = active ? xpFor(userId, Math.max(since,start), until) : 0;
  return { xp: baseXp + bonus, base_xp: baseXp, bonus_xp: bonus,
    multiplier: active ? 2 : 1, starts_at: active ? start : null };
}
module.exports = { cosmeticProgress };

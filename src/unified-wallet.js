'use strict';
// One customer-facing currency: Hub Credits. Older Hub Crowns are immutable
// accounting source entries converted at 1 Crown = 10 Credits into the ONE
// spendable points_ledger, whose SQL primary keys remain untouched.
// Historical crown_ledger is retained for payment refunds/audits, never as a
// second spendable balance. Each row migrates once by source ledger ID.
const db=require('./db');
const CREDIT_PER_LEGACY_CROWN=10;
const currency=Object.freeze({name:'Hub Credits',short:'Credits',symbol:'HC',cosmeticOnly:true,
  purchasable:true,earnable:true,transferable:false,redeemableForCash:false,usableForGiveaways:false,
  legacyPointRatio:1,legacyCrownRatio:CREDIT_PER_LEGACY_CROWN});
function hasLegacyTable(){
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='crown_ledger'").get();
}
function migrateLegacyCrowns(userId){
  if(!Number.isSafeInteger(userId)||userId<=0) throw new TypeError('Invalid wallet owner');
  if(!hasLegacyTable())return 0;
  // Inserts are additive only, replay-safe and idempotent by
  // UNIQUE(user_id, reason, ref). Negative refunds and historical spends are
  // imported too. This does NOT modify original monetary audit records.
  return db.prepare(`INSERT OR IGNORE INTO points_ledger(user_id,amount,reason,ref,created_at)
    SELECT user_id,delta*10,'legacy-crown',CAST(id AS TEXT),created_at
      FROM crown_ledger WHERE user_id=?`).run(userId).changes;
}
function balance(userId){
  migrateLegacyCrowns(userId);
  const row=db.prepare('SELECT COALESCE(SUM(amount),0) AS credits FROM points_ledger WHERE user_id=?').get(userId);
  return row.credits;
}
function audit(userId){
  const credits=balance(userId);
  return {currency,credits,legacyCrownEntriesMigrated:
    hasLegacyTable()?db.prepare("SELECT COUNT(*) n FROM points_ledger WHERE user_id=? AND reason='legacy-crown'").get(userId).n:0};
}
module.exports={currency,CREDIT_PER_LEGACY_CROWN,migrateLegacyCrowns,balance,audit};

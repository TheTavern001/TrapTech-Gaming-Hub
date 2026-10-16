'use strict';
// Reconcile only exclusive season-track cosmetics after a paid entitlement
// is reversed. Earned Credits, competition XP and independently bought items
// are unchanged. Run inside the payment reversal's SQLite transaction.
function reconcileCosmeticRewards(userId,t=Date.now()) {
  const db=require('./db'),SE=require('./seasons'),M=require('./monetize');
  const items=db.prepare('SELECT item_id,price FROM user_items WHERE user_id=?').all(userId);
  const seasons=new Set(items.map(row=>/^(?:fx-)?v7[kp](\d{1,9})s/.exec(row.item_id))
    .filter(Boolean).map(m=>Number(m[1])));
  const current=SE.seasonAt(t).number,revoked=[];
  const remove=db.prepare('DELETE FROM user_items WHERE user_id=? AND item_id=? AND price=0');
  const slots=['banner','frame','title','badge','color','effect'];
  function revoke(id) {
    if(!remove.run(userId,id).changes)return;
    revoked.push(id);
    for(const slot of slots)db.prepare(`UPDATE users SET eq_${slot}='' WHERE id=? AND eq_${slot}=?`).run(userId,id);
  }
  for(const n of seasons) {
    if(n<1||n>current)continue;
    const progress=SE.seasonProgress(userId,Math.min(t,SE.info(n).end_at));
    for(const row of progress.track)if(row.item&&!row.unlocked)revoke(row.item.id);
    const pass=M.hasPass(userId,n);
    for(const row of M.premiumTrack(n))if(!pass||progress.cosmetic_level<row.level) {
      if(row.item)revoke(row.item.id);
      db.prepare('DELETE FROM pass_claims WHERE user_id=? AND season=? AND level=?').run(userId,n,row.level);
    }
  }
  return revoked;
}
module.exports={reconcileCosmeticRewards};

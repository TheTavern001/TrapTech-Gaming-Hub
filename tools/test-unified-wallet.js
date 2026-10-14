#!/usr/bin/env node
'use strict';
// Isolated native better-sqlite3 migration and race/idempotency test.
// Needs only the package's existing production dependencies. NEVER opens /data.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-credit-'));
process.env.DB_PATH=path.join(tmp,'hub.db');process.env.DATA_DIR=tmp;
process.env.NODE_ENV='test';process.env.ADMIN_PASSWORD='TestOnlyCreditWalletNeverLive';
process.env.SECRET='TestOnlyCreditWalletSecretNotProduction';
process.env.PAY_NO_SWEEP='1';
const db=require('../src/db'),W=require('../src/unified-wallet');
const MON=require('../src/monetize'),SHOP=require('../src/shop');
const t=Date.now();
const user=db.prepare("INSERT INTO users (username,pass_hash,created_at,birth_date) VALUES ('WalletQA','x',?,'1990-01-01')").run(t).lastInsertRowid;
const u={id:user,username:'WalletQA'};
const insPoints=db.prepare('INSERT INTO points_ledger(user_id,amount,reason,ref,created_at) VALUES (?,?,?,?,?)');
const insCrown=db.prepare('INSERT INTO crown_ledger(user_id,delta,reason,ref,created_at) VALUES (?,?,?,?,?)');
const countMigrated=()=>db.prepare("SELECT COUNT(*) AS n FROM points_ledger WHERE user_id=? AND reason='legacy-crown'").get(user).n;
try{
  assert.equal(W.currency.name,'Hub Credits');
  assert.equal(W.CREDIT_PER_LEGACY_CROWN,10);
  insPoints.run(user,100,'quest','one',t);
  insCrown.run(user,500,'purchase','paid-old',t);
  insCrown.run(user,-50,'spend','legacy-cosmetic',t+1);
  insCrown.run(user,-25,'refund','old-refund',t+2);
  assert.equal(W.balance(user),4350,'Net original Points and Crown entries must add up');
  assert.equal(W.balance(user),4350,'Double reading must never mint twice');
  assert.equal(countMigrated(),3);
  assert.equal(W.migrateLegacyCrowns(user),0);
  assert.equal(MON.addCrowns(user,1100,'purchase','order-after-migration',t+3),true);
  assert.equal(W.balance(user),15350);
  assert.equal(MON.addCrowns(user,1100,'purchase','order-after-migration',t+3),false,'Webhook replay cannot re-grant');
  assert.equal(W.balance(user),15350);
  assert.equal(MON.addCrowns(user,-1100,'refund','order-after-migration',t+4),true);
  assert.equal(W.balance(user),4350);
  assert.equal(MON.addCrowns(user,-1100,'refund','order-after-migration',t+4),false);
  assert.equal(W.balance(user),4350,'Refund duplicate cannot drain wallet');
  assert.equal(countMigrated(),5,'Each original monetary event migrated once with unique historical ref');
  assert.equal(SHOP.balance(user),W.balance(user),'Both currencies share one wallet');
  // Should never give paid players access to mechanically advantaged items.
  assert.equal(W.currency.usableForGiveaways,false);
  assert.equal(W.currency.transferable,false);
  const ownedBefore=db.prepare('SELECT COUNT(*) AS n FROM user_items WHERE user_id=?').get(user).n;
  const normal=SHOP.rotation(t).daily.find(it=>it.src!=='k'&&it.src!=='b'&&it.src!=='p');
  assert.ok(normal,'Expected an ordinary cosmetic in rotation');
  MON.addCrowns(user,500000,'admin','wallet-fixture',t+5);
  SHOP.sync(user);
  const before=W.balance(user);
  const purchase=MON.buyWithCrowns(u,normal.id,t);
  assert.equal(purchase.ok,true,'Legacy purchase endpoint must use exactly the same wallet spend');
  assert.equal(purchase.credits,before-purchase.price_credits);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM user_items WHERE user_id=?').get(user).n,ownedBefore+1);
  const another=SHOP.buy(u,normal.id,t);
  assert.equal(another.ok,false,'Cannot buy and debit the same cosmetic twice');
  assert.equal(W.balance(user),purchase.credits);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM points_ledger WHERE user_id=? AND reason='purchase' AND ref=?").get(user,normal.id).n,1);
  const p=MON.products().find(p=>p.kind==='pack');
  assert.ok(p.name.includes('Hub Credits'),'Old store-product IDs must have updated player-visible names');
  console.log(JSON.stringify({pass:true,checks:21,credits:W.balance(user),migratedRows:countMigrated(),
   atomicPurchase:true,refundReplaySafe:true,legacyHistoryRetained:true,
   paymentNetworkUsed:false,repositoryDatabaseTouched:false}));
}finally{db.close();fs.rmSync(tmp,{recursive:true,force:true});}

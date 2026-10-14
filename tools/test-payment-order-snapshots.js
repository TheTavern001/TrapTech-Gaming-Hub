#!/usr/bin/env node
'use strict';
// Native SQLite, disposable offline financial invariants. No real provider APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-snapshots-'));
process.env.DATA_DIR=dir;process.env.DB_PATH=path.join(dir,'hub.db');
process.env.NODE_ENV='test';process.env.PAY_NO_SWEEP='1';
process.env.SECRET='LocalOnlySnapshotTestSecretDoNotDeploy';
process.env.ADMIN_PASSWORD='LocalOnlySnapshotAdmin123';
const db=require('../src/db'),M=require('../src/monetize'),W=require('../src/unified-wallet');
const t=Date.now(),insert=db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES ('snapqa','x',?,'1990-01-01')");
const user=insert.run(t).lastInsertRowid;
const product='crowns-500';
const original=M.prod(product);assert.equal(original.kind,'pack');
const quote=original.crowns+original.bonus;
const orderSQL="INSERT INTO store_orders (ref,user_id,product_id,usd_cents,provider,status,created_at,expires_at,pack_crowns) VALUES (?,?,?,?,'manual',?,?,?,?)";
const order=id=>db.prepare('SELECT * FROM store_orders WHERE id=?').get(id);
const funds=()=>W.balance(user);
const purchase=(ref,status,quantity)=>db.prepare(orderSQL).run(ref,user,product,original.usd_cents,status,t,t+3600000,quantity).lastInsertRowid;
try {
  const priceChanged=purchase('QUOTE_PINNED','paid',quote);
  assert.equal(order(priceChanged).pack_crowns,quote);
  db.prepare('UPDATE store_products SET crowns=?,bonus=? WHERE id=?').run(80000,8000,product);
  const result=M.grant(order(priceChanged),'isolated QA',t+1);
  assert.equal(result.ok,true,'Pinned order must grant exactly the quoted original amount');
  assert.equal(funds(),quote*10,'After a pack edit, no newly advertised price may inflate prior grants');
  assert.equal(M.grant(order(priceChanged),'replay',t+2).already,true);
  assert.equal(funds(),quote*10,'Duplicate fulfillment must be idempotent');
  const ledger=db.prepare("SELECT delta FROM crown_ledger WHERE user_id=? AND reason='purchase' AND ref='QUOTE_PINN'").get(user);
  assert.equal(ledger.delta,quote,'Immutable payment ledger stores original quantity');
  assert.equal(M.refund('QUOTE_PINN','local QA').ok,true);
  assert.equal(funds(),0,'Refund must reverse original grant, not updated catalog quantity');
  const refund=db.prepare("SELECT delta FROM crown_ledger WHERE user_id=? AND reason='refund' AND ref='QUOTE_PINN'").get(user);
  assert.equal(refund.delta,-quote);
  assert.equal(M.refund('QUOTE_PINN','duplicate QA').ok,false);
  assert.equal(funds(),0,'Duplicate refunds must not subtract twice');
  const noQuote=purchase('LEGACY_NO_QUOTE','paid',null);
  const held=M.grant(order(noQuote),'QA');
  assert.equal(held.ok,false,'Unknown old promised amount must be held for human reconciliation');
  assert.match(held.error,/snapshot|verified locked Credit/i);
  assert.equal(funds(),0);
  const pending=purchase('PENDING_UNPAID','pending',quote);
  assert.equal(M.grant(order(pending),'forged checkout').ok,false,'Unsettled order may not mint Credits');
  assert.equal(funds(),0);
  console.log(JSON.stringify({pass:true,quotedUnits:quote,catalogChanged:true,refundExact:true,
    legacyUnsnappedBlocked:true,unpaidBlocked:true,immutableHistoryRetained:true,physicalDeviceQA:false}));
} finally {
  db.close();fs.rmSync(dir,{recursive:true,force:true});
}

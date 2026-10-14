#!/usr/bin/env node
'use strict';
// Native SQL / business logic regression. Disposable DB only, never /data.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-anticheat-rewards-'));
process.env.DB_PATH=path.join(tmp,'hub.db');process.env.DATA_DIR=tmp;
process.env.NODE_ENV='test';process.env.ADMIN_PASSWORD='TestOnlyNoLiveReward';
process.env.SECRET='TestOnlyAntiCheatRewardsNotProduction';
process.env.PAY_NO_SWEEP='1';
const db=require('../src/db'),SHOP=require('../src/shop'),W=require('../src/unified-wallet');
const t=Date.now(),D=864e5;
const user=db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES('RunIntegrityQA','x',?,'1990-01-01')").run(t-30*D).lastInsertRowid;
const insert=db.prepare('INSERT INTO runs(user_id,game_id,score,created_at,started_at,held) VALUES(?,?,?,?,?,?)');
const heldRun=insert.run(user,'jetpack-dash',50,t-10000,t-12000,1).lastInsertRowid;
const minted=(id)=>db.prepare("SELECT amount FROM points_ledger WHERE user_id=? AND reason='run' AND ref=?").get(user,String(id));
const adjustments=(id)=>db.prepare("SELECT amount FROM points_ledger WHERE user_id=? AND reason='run-integrity' AND ref LIKE ? ORDER BY id").all(user,String(id)+':%').map(x=>x.amount);
try{
  const baseline=SHOP.sync(user);
  assert.equal(minted(heldRun),undefined);
  db.prepare('UPDATE runs SET held=0 WHERE id=?').run(heldRun);
  const validBalance=SHOP.sync(user);
  assert.ok(validBalance>=baseline+5,'Approved run must receive credits');
  const originalRunCredits=minted(heldRun).amount;
  assert.ok(validBalance-baseline>=originalRunCredits,'Approved run reward may also advance an independent season track');
  assert.equal(SHOP.sync(user),validBalance,'Run replay must not award twice');
  db.prepare('UPDATE runs SET held=2 WHERE id=?').run(heldRun);
  const revokedBalance=SHOP.sync(user);
  assert.equal(revokedBalance,validBalance-originalRunCredits,'Disqualification must claw back exactly its run award, regardless of previously unlocked season items');
  assert.deepEqual(adjustments(heldRun),[-minted(heldRun).amount]);
  assert.equal(SHOP.sync(user),revokedBalance,'Duplicate disqualification cannot claw back twice');
  db.prepare('UPDATE runs SET held=0 WHERE id=?').run(heldRun);
  assert.equal(SHOP.sync(user),revokedBalance+originalRunCredits,'Admin clear must restore exactly the original run amount');
  assert.deepEqual(adjustments(heldRun),[-minted(heldRun).amount,minted(heldRun).amount]);
  db.prepare('UPDATE runs SET held=1 WHERE id=?').run(heldRun);
  assert.equal(SHOP.sync(user),revokedBalance,'A second hold must revoke again');
  db.prepare('UPDATE runs SET held=0 WHERE id=?').run(heldRun);
  assert.equal(SHOP.sync(user),validBalance,'Repeated review toggles preserve exact net value');
  assert.deepEqual(adjustments(heldRun),[-minted(heldRun).amount,minted(heldRun).amount,-minted(heldRun).amount,minted(heldRun).amount]);
  // Late-clear after NEWER scores: no lost reward due to MAX(id) cursor.
  const late=insert.run(user,'jetpack-dash',60,t-9000,t-11000,1).lastInsertRowid;
  const newer=insert.run(user,'jetpack-dash',100,t-8000,t-10000,0).lastInsertRowid;
  SHOP.sync(user);assert.equal(minted(late),undefined);assert.ok(minted(newer));
  db.prepare('UPDATE runs SET held=0 WHERE id=?').run(late);
  const before=W.balance(user);SHOP.sync(user);
  assert.ok(minted(late),'Later clearance cannot disappear after a newer accepted run');
  assert.ok(W.balance(user)-before>=minted(late).amount,'Late clearance may also unlock legitimate seasonal progression');
  const lateBalance=W.balance(user);SHOP.sync(user);assert.equal(W.balance(user),lateBalance,'Late clearance may not mint credits on repeated sync');
  // No negative wallet spend allowed after clawback.
  db.prepare('UPDATE runs SET held=2 WHERE id=?').run(heldRun);
  SHOP.sync(user);assert.ok(W.balance(user)>=0,'Other legit runs remain separately funded');
  assert.equal(W.currency.usableForGiveaways,false);
  console.log(JSON.stringify({pass:true,reviewTransitions:4,lateReviewRestored:true,
    duplicateEarnings:0,heldCanMint:false,source:'native disposable better-sqlite3',
    hostTouched:false,paymentsTouched:false}));
}finally{db.close();fs.rmSync(tmp,{recursive:true,force:true});}

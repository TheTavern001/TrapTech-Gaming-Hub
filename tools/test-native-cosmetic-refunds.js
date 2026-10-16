#!/usr/bin/env node
'use strict';
// Real better-sqlite3 and production modules; all payment records are local fixtures.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-cosmetic-refund-'));
process.env.DATA_DIR=dir;process.env.DB_PATH=path.join(dir,'hub.db');process.env.NODE_ENV='test';process.env.PAY_NO_SWEEP='1';
process.env.SECRET=crypto.randomBytes(32).toString('hex');process.env.ADMIN_PASSWORD=crypto.randomBytes(20).toString('hex');
process.env.STRIPE_WEBHOOK_SECRET='whsec_local_fixture_only';
const db=require('../src/db'),M=require('../src/monetize'),PR=require('../src/progress'),SE=require('../src/seasons'),CXP=require('../src/cosmetic-xp');
const t=Date.now()-10000,uid=db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES ('fixture','x',?,'1990-01-01')").run(t).lastInsertRowid;
const user=db.prepare('SELECT * FROM users WHERE id=?').get(uid);
let serial=0;
function purchase(product,at){
 const p=M.prod(product),ref='FIXTURE_'+(++serial),pi='pi_fixture_'+serial;
 const id=db.prepare("INSERT INTO store_orders(ref,user_id,product_id,usd_cents,provider,status,created_at,expires_at,paid_at,provider_ref,provider_payment_id,season,pack_crowns) VALUES (?,?,?,?,'stripe','paid',?,?,?,?,?,?,?)").run(ref,uid,product,p.usd_cents,at,at+100000,at,'cs_test_fixture_'+serial,pi,SE.seasonAt(at).number,p.kind==='pack'?p.crowns+p.bonus:null).lastInsertRowid;
 assert.equal(M.grant(db.prepare('SELECT * FROM store_orders WHERE id=?').get(id),'local fixture',at).ok,true);
 return db.prepare('SELECT * FROM store_orders WHERE id=?').get(id);
}
const hooks=new Map(),app={get(){},post(url,...f){hooks.set(url,f.at(-1));}},admin={get(){},put(){},post(){}};
M.routes(app,admin,{requireUser(){},currentUser(){return null},bad(){},limiter(){return ()=>{}}});
function webhook(order){
 const body={type:'charge.refunded',data:{object:{payment_intent:order.provider_payment_id,currency:'usd',amount:order.usd_cents,amount_refunded:order.usd_cents,refunded:true}}};
 const rawBody=Buffer.from(JSON.stringify(body)),ts=Math.floor(Date.now()/1000),sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(ts+'.').update(rawBody).digest('hex');
 const res={code:200,status(n){this.code=n;return this},json(x){this.body=x;return this}};
 hooks.get('/api/store/webhook/stripe')({body,rawBody,headers:{'stripe-signature':`t=${ts},v1=${sig}`}},res);return res;
}
try{
 const prestige=purchase('prestige-original-cane',t+1000);
 db.prepare('INSERT INTO quest_claims(user_id,day,idx,xp,created_at) VALUES (?,?,?,?,?)').run(uid,1,0,60,t+2000);
 db.prepare('INSERT INTO user_achievements(user_id,ach_id,unlocked_at) VALUES (?,?,?)').run(uid,'first-run',t+3000);
 db.prepare('INSERT INTO checkins(user_id,day,xp,created_at) VALUES (?,?,?,?)').run(uid,1,20,t+500);
 const raw=PR.xpFor(uid,t,t+5000),cos=CXP.cosmeticProgress(uid,t,t+5000,raw,PR.xpFor);
 assert.equal(raw,105);assert.equal(cos.bonus_xp,85);assert.equal(cos.xp,190);assert.equal(cos.multiplier,2);
 const pass=purchase('season-pass',t+1500),state=M.passState(user,t+5000),reward=state.track.find(x=>x.item);
 assert.equal(state.cosmetic_xp.multiplier,2);
 db.prepare('INSERT INTO pass_claims(user_id,season,level,created_at) VALUES (?,?,?,?)').run(uid,pass.season,reward.level,t+4000);
 db.prepare('INSERT INTO user_items(user_id,item_id,price,acquired_at) VALUES (?,?,0,?)').run(uid,reward.item.id,t+4000);
 const key='shop:'+reward.item.id;
 db.prepare('UPDATE users SET eq_banner=?,eq_frame=?,eq_title=?,eq_badge=?,eq_color=?,eq_effect=? WHERE id=?').run(key,key,key,key,key,key,uid);
 assert.equal(webhook(pass).code,200);
 assert.equal(db.prepare('SELECT 1 FROM user_items WHERE user_id=? AND item_id=?').get(uid,reward.item.id),undefined);
 const after=db.prepare('SELECT * FROM users WHERE id=?').get(uid);
 for(const col of ['eq_banner','eq_frame','eq_title','eq_badge','eq_color','eq_effect'])assert.equal(after[col],'');
 assert.equal(webhook(prestige).code,200);assert.equal(CXP.cosmeticProgress(uid,t,t+5000,raw,PR.xpFor).multiplier,1);
 const pack=purchase('crowns-500',t+1000),entry=db.prepare("SELECT * FROM crown_ledger WHERE user_id=? AND reason='purchase' AND ref=?").get(uid,pack.ref);
 db.prepare('DELETE FROM crown_ledger WHERE id=?').run(entry.id);
 assert.equal(webhook(pack).code,503,'Do not acknowledge unreconciled financial reversal');
 assert.equal(db.prepare('SELECT refunded_at FROM store_orders WHERE id=?').get(pack.id).refunded_at,null);
 db.prepare('INSERT INTO crown_ledger(id,user_id,delta,reason,ref,created_at) VALUES (?,?,?,?,?,?)').run(entry.id,uid,entry.delta,entry.reason,entry.ref,entry.created_at);
 assert.equal(webhook(pack).code,200);assert.equal(webhook(pack).code,200,'Replay is idempotent');
 assert.equal(db.prepare("SELECT COUNT(*) n FROM crown_ledger WHERE reason='refund' AND ref=?").get(pack.ref).n,1);
 console.log(JSON.stringify({pass:true,nativeSQLite:true,questAndAchievementBonus:true,prestigeRefundRevokes:true,passEquipmentCleared:true,failedRefundReturns503:true,refundReplaySafe:true,realProviderTransactions:false}));
}finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}

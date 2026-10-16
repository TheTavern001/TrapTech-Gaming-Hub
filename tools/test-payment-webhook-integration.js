#!/usr/bin/env node
'use strict';
// Real native SQLite and localhost HTTP; signed synthetic Stripe events only.
// No provider requests, live orders, or production credentials are used.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-payment-http-'));
Object.assign(process.env,{DATA_DIR:dir,DB_PATH:path.join(dir,'hub.db'),NODE_ENV:'test',
 PAY_NO_SWEEP:'1',SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_PASSWORD:crypto.randomBytes(24).toString('hex'),
 STRIPE_WEBHOOK_SECRET:'whsec_'+crypto.randomBytes(32).toString('hex')});
const db=require('../src/db'),M=require('../src/monetize'),W=require('../src/unified-wallet'),SE=require('../src/seasons');
const express=require('express'),app=express();
app.use(express.json({verify:(req,res,body)=>{req.rawBody=Buffer.from(body)}}));
M.routes(app,express.Router(),{currentUser:()=>null,requireUser:(req,res)=>res.sendStatus(401),
 bad:(res,status,error)=>res.status(status).json({ok:false,error}),limiter:()=>((req,res,next)=>next())});
let base,server,seq=0,checks=0;
const check=(ok,message)=>{assert.ok(ok,message);checks++};
const mkUser=()=>db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES (?,'test-only',?,'1990-01-01')").run('payhttp'+(++seq),Date.now()).lastInsertRowid;
function order(user,product='crowns-500') {
 const p=M.prod(product),ref='HTTP_'+(++seq),session='cs_test_local_'+seq;
 const id=db.prepare(`INSERT INTO store_orders(ref,user_id,product_id,usd_cents,provider,provider_ref,
 status,created_at,expires_at,pack_crowns,season) VALUES (?,?,?,?,'stripe',?,'pending',?,?,?,?)`)
 .run(ref,user,product,p.usd_cents,session,Date.now(),Date.now()+3600000,p.kind==='pack'?p.crowns+p.bonus:null,SE.seasonAt().number).lastInsertRowid;
 return db.prepare('SELECT * FROM store_orders WHERE id=?').get(id);
}
const fresh=o=>db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id);
const paid=(o,extra={})=>({type:'checkout.session.completed',data:{object:{id:o.provider_ref,mode:'payment',payment_status:'paid',
 payment_intent:'pi_local_'+o.id,amount_total:o.usd_cents,currency:'usd',metadata:{order_ref:o.ref,user_id:String(o.user_id)},...extra}}});
const refund=(o,amount=o.usd_cents)=>({type:'charge.refunded',data:{object:{payment_intent:'pi_local_'+o.id,amount:o.usd_cents,amount_refunded:amount,currency:'usd',refunded:amount===o.usd_cents}}});
async function send(event,{valid=true,timestamp=Math.floor(Date.now()/1000)}={}) {
 const raw=JSON.stringify({id:'evt_local_'+(++seq),livemode:false,...event});
 const sig=crypto.createHmac('sha256',process.env.STRIPE_WEBHOOK_SECRET).update(timestamp+'.'+raw).digest('hex');
 return fetch(base+'/api/store/webhook/stripe',{method:'POST',headers:{'Content-Type':'application/json',
  'Stripe-Signature':`t=${timestamp},v1=${valid?sig:'0'.repeat(64)}`},body:raw});
}
(async()=>{
 server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 base='http://127.0.0.1:'+server.address().port;
 const user=mkUser(),o=order(user),units=M.prod(o.product_id).crowns+M.prod(o.product_id).bonus;
 check((await send(paid(o),{valid:false})).status===400,'Forged signature rejected');
 check((await send(paid(o),{timestamp:1})).status===400,'Expired signature rejected');
 await send(paid(o,{payment_status:'unpaid'}));check(W.balance(user)===0,'Unpaid session grants nothing');
 check((await send(paid(o,{payment_intent:null}))).status===503,'Missing intent asks provider to retry');
 await send(paid(o));await send(paid(o));
 check(W.balance(user)===units*10,'Duplicate settlement grants one immutable Credit pack');
 await send(refund(o,100));check(W.balance(user)===units*10,'Partial refund is held for review');
 await send(refund(o));await send(refund(o));
 check(W.balance(user)===0&&!!fresh(o).refunded_at,'Full refund reverses exactly once');
 await send(paid(o));check(W.balance(user)===0&&fresh(o).status==='refunded','Late completion cannot resurrect refunded order');
 const early=order(user);await send(refund(early));await send(paid(early));
 check(fresh(early).status==='refunded'&&!fresh(early).granted_at&&W.balance(user)===0,'Refund before completion cannot mint Credits');
 const mismatch=order(user);await send(paid(mismatch,{metadata:{order_ref:mismatch.ref,user_id:'999999'}}));
 check(!fresh(mismatch).granted_at&&W.balance(user)===0,'Signed wrong-owner payment is not fulfilled');
 const retry=order(user);await send(paid(retry));
 const row=db.prepare("SELECT * FROM crown_ledger WHERE user_id=? AND reason='purchase' AND ref=?").get(user,retry.ref);
 db.prepare('DELETE FROM crown_ledger WHERE id=?').run(row.id);
 check((await send(refund(retry))).status===503&&!fresh(retry).refunded_at,'Failed financial reconciliation requests retry');
 db.prepare('INSERT INTO crown_ledger(id,user_id,delta,reason,ref,created_at) VALUES (?,?,?,?,?,?)').run(row.id,row.user_id,row.delta,row.reason,row.ref,row.created_at);
 check((await send(refund(retry))).status===200&&W.balance(user)===0,'Retry succeeds after ledger repair');

 const owner=mkUser(),season=SE.seasonAt().number;
 db.prepare('INSERT INTO checkins(user_id,day,xp,created_at) VALUES (?,?,900,?)').run(owner,1,Date.now()-1000);
 const pass=M.manualGrant(owner,'season-pass','local fixture');check(pass.ok,'Independent pass granted');
 const prestige=order(owner,'prestige-original-cane');await send(paid(prestige));
 await new Promise(resolve=>setTimeout(resolve,5));
 db.prepare('INSERT INTO checkins(user_id,day,xp,created_at) VALUES (?,?,900,?)').run(owner,2,Date.now());
 const progress=SE.seasonProgress(owner);check(progress.xp===1800&&progress.cosmetic_xp.xp===2700,'Native Prestige doubles post-delivery cosmetic XP only');
 SE.claimTrack(owner);M.claimPass({id:owner});
 const boostedFree=SE.trackItem(season,2),earnedFree=SE.trackItem(season,0),boostedPremium=M.premiumTrack(season).find(r=>r.level===9).item;
 const owns=id=>!!db.prepare('SELECT 1 FROM user_items WHERE user_id=? AND item_id=?').get(owner,id);
 check(owns(boostedFree.id)&&owns(boostedPremium.id),'Accelerated free and premium cosmetics can be claimed');
 db.prepare('UPDATE users SET eq_banner=? WHERE id=?').run(boostedFree.id,owner);
 await send(refund(prestige));
 check(!owns(boostedFree.id)&&!owns(boostedPremium.id),'Prestige refund revokes only rewards beyond earned progress');
 check(owns(earnedFree.id)&&M.hasPass(owner,season),'Earned rewards and independent pass survive refund');
 check(db.prepare('SELECT eq_banner FROM users WHERE id=?').get(owner).eq_banner==='','Revoked equipped reward is cleared');
 check(SE.seasonProgress(owner).cosmetic_xp.multiplier===1&&SE.seasonProgress(owner).xp===1800,'Refund disables 2x while preserving raw XP');
 db.prepare('INSERT INTO checkins(user_id,day,xp,created_at) VALUES (?,?,900,?)').run(owner,3,Date.now());
 SE.claimTrack(owner);M.claimPass({id:owner});
 check(owns(boostedFree.id)&&owns(boostedPremium.id),'Revoked cosmetics unlock again through continued free play');
 const duplicatePass=order(owner,'season-pass');await send(paid(duplicatePass));await send(refund(duplicatePass));
 check(M.hasPass(owner,season)&&owns(boostedPremium.id),'Refund of duplicate purchase cannot revoke independently owned pass');
 const creditOwner=mkUser(),paidPass=order(creditOwner,'season-pass');await send(paid(paidPass));
 const xpItem=order(creditOwner,'prestige-original-throne');await send(paid(xpItem));
 await new Promise(resolve=>setTimeout(resolve,5));
 db.prepare('INSERT INTO checkins(user_id,day,xp,created_at) VALUES (?,?,6000,?)').run(creditOwner,1,Date.now());
 M.claimPass({id:creditOwner});
 const passCredit=()=>db.prepare("SELECT delta FROM crown_ledger WHERE user_id=? AND reason='pass' AND ref=?").get(creditOwner,`S${season}L30`);
 check(!passCredit(),'2x cosmetic levels cannot accelerate premium Credits');
 db.prepare('INSERT INTO checkins(user_id,day,xp,created_at) VALUES (?,?,5000,?)').run(creditOwner,2,Date.now());
 M.claimPass({id:creditOwner});M.claimPass({id:creditOwner});
 check(passCredit()?.delta===100,'Raw earned XP later grants premium Credits exactly once');
 await send(refund(paidPass));
 check(!M.hasPass(creditOwner,season)&&W.balance(creditOwner)===0,'Pass refund reverses actually awarded premium Credits');
 check(db.prepare('PRAGMA integrity_check').get().integrity_check==='ok','SQLite remains intact');
 console.log(JSON.stringify({pass:true,checks,nativeSQLite:true,localhostHTTP:true,signedSyntheticWebhooks:true,
  retrySafe:true,outOfOrderRefundSafe:true,prestige2xPreserved:true,earnedRewardsPreserved:true,realProviderTransactions:false}));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
 if(server)await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(dir,{recursive:true,force:true});
});

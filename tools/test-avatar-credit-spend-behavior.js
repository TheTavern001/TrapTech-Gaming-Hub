#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../src/avatars.js'),'utf8');
const start=src.indexOf('  const buyAvatarWithCredits = '),end=src.indexOf("  app.post('/api/avatar/buy-credits'",start);
assert.ok(start>=0&&end>start,'Canonical Credits handler missing');
const hood={kind:'outfit',id:'hoodie',unlock:{crowns:300}};
const prestige={kind:'outfit',id:'prestige',unlock:{prestige:'p-one'}};
const free={kind:'outfit',id:'base',unlock:'free'};
let creditBalance=750;const owned=new Set();let debits=0;
const db={transaction:fn=>fn,prepare:sql=>({run:(_user,value,...rest)=>{
 if(sql.includes('avatar_parts_owned')){if(owned.has(value))return{changes:0};owned.add(value);return{changes:1};}
 if(sql.includes('points_ledger')){creditBalance+=value;debits++;return{changes:1};}
 throw new Error('Unexpected SQL '+sql);
 }})};
const shop={sync:()=>creditBalance,balance:()=>creditBalance};
const ctx={BYK:{outfit:{hoodie:hood,prestige,base:free}},db,
 owns:(_uid,p)=>owned.has(p.kind+':'+p.id),pointsPrice:p=>p===hood?450:300,
 key:p=>p.kind+':'+p.id,require:n=>{assert.equal(n,'./shop');return shop;},bad:(res,code,error)=>res.json({ok:false,status:code,error}),Date};
vm.runInNewContext(src.slice(start,end)+'this.handler=buyAvatarWithCredits;',ctx,{timeout:2000});
const call=part=>{const response={data:null,json(d){this.data=d;return this}};ctx.handler({user:{id:42},body:{part}},response);return response.data};
assert.equal(call('outfit:hoodie').ok,true);
assert.equal(creditBalance,300);
assert.equal(debits,1);
assert.equal(call('outfit:hoodie').status,400,'Duplicate purchase rejected');
assert.equal(creditBalance,300);
assert.equal(debits,1);
assert.equal(call('outfit:prestige').status,400,'Uncertified prestige cannot be bought');
assert.equal(call('outfit:base').status,400,'Free starter is never sold');
assert.equal(call('outfit:missing').status,400);
assert.equal(debits,1);
console.log(JSON.stringify({pass:true,creditsAfterOnePurchase:creditBalance,ledgerDebits:debits,prestigeSold:false,nativeSqliteTest:false}));

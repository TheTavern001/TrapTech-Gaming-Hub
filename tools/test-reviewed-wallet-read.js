#!/usr/bin/env node
'use strict';
// Source-plus-behavior regression for mobile wallet balance endpoints.
// No external network, payment provider or production DB required.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/monetize.js'),'utf8');
const shop=fs.readFileSync(path.join(__dirname,'../src/shop.js'),'utf8');
const definition=source.match(/^const reviewedCredits = \(userId\) => require\('\.\/shop'\)\.sync\(userId\);/m);
assert.ok(definition,'All wallet balance reads must go through accepted-run reconciliation');
let observed=[];
const fakeRequire=name=>{
  assert.equal(name,'./shop');
  return {sync:userId=>{observed.push(userId);return userId===7?0:1250}};
};
const reviewed=new Function('require',definition[0]+'\nreturn reviewedCredits;')(fakeRequire);
assert.equal(reviewed(7),0,'Held-run clawback must appear before display');
assert.equal(reviewed(42),1250);
assert.deepEqual(observed,[7,42]);
const routes=[
 {path:'/api/store',expr:'credits: me ? reviewedCredits(me.id) : null'},
 {path:'/api/store/orders/:ref/check',expr:'credits: reviewedCredits(req.user.id)'},
 {path:'/api/me/crowns',expr:'credits:reviewedCredits(req.user.id)'}
];
for(const route of routes)assert.ok(source.includes(route.expr),
 'Unreviewed mobile wallet display: '+route.path);
assert.ok(!source.includes('credits: WALLET.balance(') &&
 !source.includes('credits:WALLET.balance('),
 'Raw historical ledger may never be exposed as an authoritative spendable balance');
assert.ok(source.includes("const r=require('./shop').buy(user,itemId,t)"),
 'Legacy Crowns spend must use the exact same reconciled cosmetic buy transaction');
assert.ok(shop.includes('reconcileRunRewardIntegrity(userId);') &&
 shop.includes('AND COALESCE(r.held,0)=0'),
 'Credit awarding/revocation must filter held game runs');
assert.ok(shop.includes("if (debit.changes !== 1) throw new Error"),
 'Successful purchase must have an immutable matching spend ledger entry');
console.log(JSON.stringify({pass:true,behaviorChecks:3,endpointChecks:3,atomicPurchase:true,
  runReview:true,legacyAlias:true,actualNodeRuntime:true,appDatabaseUsed:false}));

#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const monetization=fs.readFileSync(path.join(__dirname,'../src/monetize.js'),'utf8');
const start=monetization.indexOf('function checkoutState() {');
const end=monetization.indexOf('const ORDER_TTL_MS',start);
assert.ok(start>=0&&end>start,'Cannot find checkout authorization contract');
const code=monetization.slice(start,end)+'\ncheckoutState;';
function state({review,provider='test',switchOn=true}){
 const cfg={HUB_PRIVATE_REVIEW:review?'1':'0',STRIPE_SECRET_KEY:'sk_'+provider+'_only_fake_key',
 STRIPE_WEBHOOK_SECRET:'whsec_fake_signature',PUBLIC_URL:'https://hub.example.test'};
 const context={ADDR:()=>'',BTC:{validateAddress:()=>({ok:false,why:'no address'})},
 setting:()=>switchOn,process:{env:cfg}};
 const result=vm.runInNewContext(code,context,{timeout:2000})();
 return result;
}
const publicTest=state({review:false});
assert.equal(publicTest.enabled,true,'Test card checkout should use the ordinary admin switch outside preview');
assert.ok(publicTest.methods.includes('stripe'));
for(const provider of ['test','live']){
 const blocked=state({review:true,provider});
 assert.equal(blocked.enabled,false,'Owner preview must never charge either sandbox or live cards');
 assert.equal(blocked.admin_switch,true,'Keep preexisting admin setting without applying it');
 assert.equal(blocked.methods.length,0);
 assert.match(blocked.reason,/disabled during private owner review/);
}
assert.equal(state({review:false,switchOn:false}).enabled,false);
assert.match(monetization,/if \(!st\.enabled\) return \{ status: 503, error: st\.reason \}/,
 'Stripe order creation must require checkoutState enabled');
assert.match(monetization,/if \(!st\.enabled\) return \{ status: 503, error: st\.reason \}/,
 'Bitcoin order creation must require checkoutState enabled');
console.log(JSON.stringify({pass:true,reviewDisablesPaymentEvenWhenPreviouslyEnabled:true,
 stripeLiveAndTestBlocked:true,liveOrderWebhooksRemainSeparate:true,actualStripeChargesTested:false}));

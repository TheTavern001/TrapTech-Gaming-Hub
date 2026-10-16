#!/usr/bin/env node
'use strict';
// Use the production verifier itself. Two Stripe webhook endpoints have
// different signing secrets; a store signature cannot pay a sponsor booking.
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),
 path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/monetize.js'),'utf8');
const start=source.indexOf('function stripeSignatureOk(req, signingSecret = process.env.STRIPE_WEBHOOK_SECRET) {');
const end=source.indexOf('\nfunction routes(',start);
assert.ok(start>=0&&end>start,'Cannot locate production Stripe signature verifier');
const verify=vm.runInNewContext(source.slice(start,end)+'\nstripeSignatureOk;',
 {crypto,Buffer,Date,process:{env:{STRIPE_WEBHOOK_SECRET:'whsec_store_fixture'}}},{timeout:2000});
const raw=Buffer.from('{"id":"evt_fixture","type":"checkout.session.completed"}');
const t=Math.floor(Date.now()/1000),signature=(secret,ts=t,body=raw)=>
 crypto.createHmac('sha256',secret).update(String(ts)+'.').update(body).digest('hex');
const valid={rawBody:raw,headers:{'stripe-signature':`t=${t},v1=${signature('whsec_booking_fixture')}`}};
assert.equal(verify(valid,'whsec_booking_fixture'),true,'Booking endpoint accepts its exact signature');
assert.equal(verify(valid),false,'Store secret must never authenticate vendor payments');
assert.equal(verify(valid,'whsec_another_booking'),false,'Mismatched booking signing secret refused');
assert.equal(verify({...valid,rawBody:Buffer.from('{}')},'whsec_booking_fixture'),false,'Altered body refused');
assert.equal(verify({...valid,rawBody:undefined},'whsec_booking_fixture'),false,'Missing raw body refused');
const old=t-601;
assert.equal(verify({rawBody:raw,headers:{'stripe-signature':`t=${old},v1=${signature('whsec_booking_fixture',old)}`}},
 'whsec_booking_fixture'),false,'Outdated webhook timestamp refused');
const guard=fs.readFileSync(path.join(root,'src/booking-fee-guard.js'),'utf8');
const sponsor=fs.readFileSync(path.join(root,'src/booking-stripe.js'),'utf8');
assert.match(guard,/STRIPE_BOOKING_WEBHOOK_SECRET/,'Checkout requires separate webhook config');
assert.match(sponsor,/_stripeSignatureOk\(req,process\.env\.STRIPE_BOOKING_WEBHOOK_SECRET\)/,
 'Vendor webhook must verify the correct signing secret');
console.log(JSON.stringify({pass:true,bookingSignedAccepted:true,storeSignatureRejected:true,
 mismatchedSignatureRejected:true,tamperedBodyRejected:true,missingRawBodyRejected:true,
 staleTimestampRejected:true,liveProviderTested:false}));

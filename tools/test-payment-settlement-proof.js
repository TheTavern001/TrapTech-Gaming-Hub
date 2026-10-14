#!/usr/bin/env node
'use strict';
// Provider guard unit test: no network/DB, verifies that forged paid status,
// underpaid Bitcoin and missing signed Stripe intent cannot mint entitlements.
// Full end-to-end Stripe/BTC mocked tests remain separate and required.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const { verifiedSettlement }=require('../src/payment-settlement-proof');
const base={ref:'O123456789ABC',user_id:42,product_id:'crowns-500',
  usd_cents:499,provider:'bitcoin',status:'paid',paid_at:Date.now(),
  sats:100000,received_sats:100000,need_confs:1,confs:1,
  txid:'e'.repeat(64),address:'32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB',refunded_at:null};
const check=(patch,expected,message)=>assert.equal(verifiedSettlement({...base,...patch}),expected,message);
check({},true,'Confirmed BTC payment can settle');
check({status:'pending'},false,'Pending order cannot settle');
check({status:'seen',confs:0},false,'Seen 0 confirmations is unpaid');
check({status:'underpaid',received_sats:99999},false,'Underpayment cannot settle');
check({confs:0},false,'Forged paid status with zero confirmations rejected');
check({received_sats:99999},false,'Forged paid status with insufficient sats rejected');
check({need_confs:6,confs:5},false,'High-value 6 confirmation policy enforced');
check({txid:'bogus'},false,'Missing transaction evidence rejected');
check({paid_at:null},false,'Missing provider settlement timestamp rejected');
check({refunded_at:Date.now()},false,'Refunded transactions cannot regrant');
check({address:''},false,'Missing original payment address rejected');
check({usd_cents:0},false,'Real BTC checkout must have an amount');
check({provider:'stripe',provider_ref:'cs_test_abc',provider_payment_id:'pi_123'},true,'Signed Stripe webhook with recorded intent eligible');
check({provider:'stripe',provider_ref:'cs_test_abc',provider_payment_id:null},false,'Missing Stripe payment intent cannot settle');
check({provider:'stripe',provider_ref:null,provider_payment_id:'pi_123'},false,'Missing matching Stripe checkout session cannot settle');
check({provider:'random-provider'},false,'Unknown provider fails closed');
const manual={...base,provider:'manual',ref:'MABCDEF123456',usd_cents:0,
  note:'manual grant by owner: giveaway promo',paid_at:null};
assert.equal(verifiedSettlement(manual),true,'Audited $0 admin gift allowed');
assert.equal(verifiedSettlement({...manual,usd_cents:499}),false,'Manual orders may not collect money');
assert.equal(verifiedSettlement({...manual,note:'signed? no proof'}),false,'No disguised manually paid order');
assert.equal(verifiedSettlement({...manual,ref:'OABCDEF123456'}),false,'Admin gift must use M-prefixed audit reference');
assert.equal(verifiedSettlement({...manual,status:'granted'}),false,'Do not settle a second time');
const src=fs.readFileSync(path.join(__dirname,'../src/monetize.js'),'utf8');
assert.ok(src.includes("const { verifiedSettlement } = require('./payment-settlement-proof')"),
  'Payment fulfillment must import provider guard');
assert.ok(src.includes("if (!verifiedSettlement(fresh))"),
  'Every grant path must check the fresh persisted provider evidence');
assert.ok(!src.includes("db.prepare(\"UPDATE store_orders SET status='paid', paid_at=COALESCE(paid_at, ?) WHERE id=?\").run(Date.now(), o.id)"),
  'Admin grant must never mark a payment as paid');
assert.ok(src.includes("if (p.kind === 'prestige' && !prestigeSalesEnabled())"),
  'Unreleased 1-of-1 prestige cosmetics must never be granted, even manually');
assert.ok(src.includes("Prestige cosmetics are preview-only until approved for release."),
  'Manual preview-only entitlement must fail closed');
assert.ok(src.includes("return bad(res, 409, 'Payment has not been verified and settled."),
  'Admin grant needs fail-closed pending-order rejection');
const e2e=fs.readFileSync(path.join(__dirname,'e2e-payments.js'),'utf8');
for(const phrase of ['admin grant cannot turn a pending unpaid order into paid Credits',
 'admin cannot override blockchain underpayment','admin duplicate grant did not mint extra Credits'])
 assert.ok(e2e.includes(phrase),'Missing API security negative test: '+phrase);
console.log(JSON.stringify({pass:true,assertions:30,financialProviders:['bitcoin','stripe','manual gift'],
  unpaidAndUnderpaidDenied:true,fullHttpTestsStillRequired:true}));

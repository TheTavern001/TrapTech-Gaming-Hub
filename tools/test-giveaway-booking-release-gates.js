#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../src');
const events=fs.readFileSync(path.join(root,'events.js'),'utf8');
const sponsor=fs.readFileSync(path.join(root,'sponsor.js'),'utf8');
new vm.Script(events);new vm.Script(sponsor);
const a=events.indexOf('function status(g, t = Date.now()) {');
const z=events.indexOf('\nconst label =',a);
assert.ok(a>=0&&z>a);
let payment='accepted',certified=false,totalCents=4900,paidAt=1234;
const stripeProof={provider:'stripe',provider_ref:'cs_test_abc123',provider_payment_id:'pi_abc123',settled_cents:4900,refunded_at:null};
const bookingFee=require('../src/booking-fee-guard');
const database={prepare:()=>({get:()=>({status:payment,total_cents:totalCents,paid_at:paidAt,...stripeProof})})};
const status=vm.runInNewContext(events.slice(a,z)+'\nstatus;',{
 db:database,gamesOf:()=>['stack'],require:x=>{
 if(x==='./booking-fee-guard')return bookingFee;
 assert.equal(x,'./prize-score-proof');return {isCertified:()=>certified};
 },Date
},{timeout:2000});
const g={id:7,active:1,archived:0,booking_id:99,payment_status:'paid',start_at:1000,end_at:5000,state:'active'};
assert.equal(status(g,2000),'payment-pending','Accepted but unpaid quote cannot activate event');
payment='paid';g.payment_status='unpaid';
assert.equal(status(g,2000),'payment-pending','Payment metadata alone cannot activate event');
g.payment_status='paid';totalCents=0;
assert.equal(status(g,2000),'payment-pending','Zero-dollar paid label cannot authorize a vendor event');
totalCents=-100;
assert.equal(status(g,2000),'payment-pending','Negative amount must never count as booking payment');
totalCents=4900;paidAt=null;
assert.equal(status(g,2000),'payment-pending','Missing payment timestamp cannot authorize giveaway');
paidAt=1234;
stripeProof.provider='manual';
assert.equal(status(g,2000),'payment-pending','Manual paid label must not satisfy Stripe settlement');
stripeProof.provider='stripe';
stripeProof.refunded_at=1234;
assert.equal(status(g,2000),'payment-pending','A refunded booking must not activate an event');
stripeProof.refunded_at=null;
assert.equal(status(g,2000),'quality-pending','Paid event with uncertified game cannot activate');
certified=true;
assert.equal(status(g,2000),'active','Approved paid booking and certified gameplay can activate');
assert.equal(status(g,500),'scheduled');
assert.equal(status(g,6000),'ended');
g.active=0;assert.equal(status(g,2000),'draft','Event must still be explicitly activated by owner');
assert.match(sponsor,/if \(!BOOKING_FEE\.paidFeeRecorded\(q\)\)/,'Event creation requires a positive-fee paid booking');
assert.match(sponsor,/if \(status === 'paid'\) return/,'Admin cannot mark ANY unverified quote as paid');
assert.match(sponsor,/q\.status === 'accepted' && status !== 'accepted'/,
 'An accepted sponsor quote cannot be canceled or reset while Stripe Checkout may be open');
// Run the actual status handler with the quote already accepted. No write may occur.
const statusStart=sponsor.indexOf('function setStatus(id, status, by) {');
const statusEnd=sponsor.indexOf('\n// what the sponsor sees',statusStart);
assert.ok(statusStart>0 && statusEnd>statusStart,'Actual booking transition handler exists');
const acceptedQuote={status:'accepted',total_cents:4900};
let writes=0;
const sponsorStatus=vm.runInNewContext(sponsor.slice(statusStart,statusEnd)+'\nsetStatus;',{
 db:{prepare:()=>({get:()=>({id:99}),run:()=>{writes++;return {changes:1};}})},
 quoteRow:()=>acceptedQuote,saveQuote:()=>{throw Error('Accepted quote cannot be recreated');},
 BOOKING_FEE:bookingFee,Date,
},{timeout:2000});
for(const action of ['draft','sent','declined','paid']){
 const result=sponsorStatus(99,action,'test');
 assert.equal(result.ok,false,'Accepted booking must reject admin action '+action);
}
assert.equal(writes,0,'Accepted quote transitions must perform no status writes');

assert.match(sponsor,/BOOKING_STRIPE\.register\(app,db,h,\{byToken,quoteRow,sponsorView\}\)/,'Stripe checkout and webhook must be mounted');
assert.match(sponsor,/VALUES \(\?,\?,\?,\?,\?,\?,'play',\?,\?,0,/,'Created event must start inactive');
assert.match(sponsor,/share_ready: false, active: false/,'No unapproved share URL on prepare');
assert.match(events,/g\.booking_id \? g\.payment_status : pick\(b\.payment_status/,'Meta route must not bypass booked payment state');
assert.match(events,/not authorized for sharing until booking payment and game scoring certification/);
assert.match(events,/That is not an authorized, publicly shareable Gaming Hub event/);
console.log(JSON.stringify({pass:true,unpaidBlocked:true,uncertifiedBlocked:true,draftRequired:true,unapprovedEventCodesHidden:true,zeroFeeBlocked:true,missingPaidAtBlocked:true,manualPaidBlocked:true,acceptedQuoteImmutable:true,refundBlocked:true,realPaymentIntegrationTested:false}));

#!/usr/bin/env node
'use strict';
// Local mock of Stripe REST responses; invokes the actual booking route
// handlers from source, NEVER hits Stripe and NEVER writes production data.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const env={STRIPE_SECRET_KEY:'sk_test_synthetictest123',STRIPE_WEBHOOK_SECRET:'whsec_synthetictest123',
 PUBLIC_URL:'https://hub.example.test',HUB_PRIVATE_REVIEW:'0',PAYMENTS_LIVE_APPROVED:'0'};
const load=(src,context)=>{const module={exports:{}};vm.runInNewContext(src,
 {...context,module,URL,Date,URLSearchParams},{timeout:2000});return module.exports;};
const FEE=load(read('src/booking-fee-guard.js'),{process:{env}});
assert.equal(FEE.stripeBookingConfigured(env),true);
for(const config of [{...env,HUB_PRIVATE_REVIEW:'1'},{...env,STRIPE_SECRET_KEY:''},
 {...env,STRIPE_SECRET_KEY:'sk_live_synthetictest123'},
 {...env,PUBLIC_URL:'http://hub.example.test'}])
 assert.equal(FEE.stripeBookingConfigured(config),false,'No payment without credentials, HTTPS, or live approval');
assert.equal(FEE.paidFeeRecorded({status:'paid',total_cents:4900,paid_at:123}),false,
 'A legacy manually marked paid booking must never enable prize events');
assert.equal(FEE.validCheckoutUrl('https://checkout.stripe.com/c/pay/cs_test_x'),true);
for(const bad of ['https://checkout.stripe.com.attacker.invalid/pay','http://checkout.stripe.com',
 'https://checkout.stripe.com@attacker.invalid/','javascript:alert(1)'])
 assert.equal(FEE.validCheckoutUrl(bad),false);
const q={booking_id:7,status:'accepted',total_cents:4900,valid_until:Date.now()+86400000,
 checkout_state:null,refunded_at:null};
const b={id:7,public_token:'test-private-booking-token'};
const handlers={},activity=[],statements=[],payments=[];
const db={
 exec(sql){statements.push(sql);},
 transaction(fn){return fn;},
 prepare(sql){
  return {
   all(){if(sql.startsWith('PRAGMA table_info'))return [];throw Error('Unknown all: '+sql);},
   get(...v){if(sql.includes('SELECT booking_id FROM sponsor_quotes'))
     return q.status==='paid'&&q.provider_payment_id===v[0]?{booking_id:7}:null;
    throw Error('Unknown get: '+sql);},
   run(...v){
    if(sql.includes("checkout_state='creating'")){
     if(q.status!=='accepted'||q.checkout_state==='creating')return {changes:0};
     [q.checkout_ref,q.checkout_created_at,q.checkout_expires_at]=v.slice(0,3);
     q.checkout_state='creating';q.provider='stripe';q.provider_ref=null;return {changes:1};
    }
    if(sql.includes("checkout_state='open'")){
     assert.equal(q.checkout_ref,v[4]);assert.equal(q.checkout_state,'creating');
     [q.provider_ref,q.checkout_url,q.checkout_expires_at]=v.slice(0,3);
     q.checkout_state='open';return {changes:1};
    }
    if(sql.includes("checkout_state='failed'")){
     q.checkout_state='failed';q.checkout_url=null;q.provider_ref=null;return {changes:1};
    }
    if(sql.includes("SET status='paid'")){
     if(q.status!=='accepted'||q.provider_ref!==v[7]||q.checkout_ref!==v[6])return {changes:0};
     q.status='paid';q.paid_at=v[0];q.settled_cents=v[1];
     q.provider_payment_id=v[2];q.checkout_state='paid';return {changes:1};
    }
    if(sql.includes("SET status='refunded'")){
     q.status='refunded';q.refunded_at=v[0];q.checkout_state='refunded';return {changes:1};
    }
    if(sql.includes("UPDATE bookings SET status='paid'")){b.status='paid';return {changes:1};}
    if(sql.includes("UPDATE bookings SET status='refunded'")){b.status='refunded';return {changes:1};}
    if(sql.includes("UPDATE giveaways SET payment_status='refunded'")){b.eventRevoked=true;return {changes:1};}
    throw Error('Unexpected SQL: '+sql);
   }
  };
 }
};
let stripeRequests=0;
const mockedFetch=async (url,options)=>{
 stripeRequests++;
 assert.equal(url,'https://api.stripe.com/v1/checkout/sessions');
 const amount=options.body.get('line_items[0][price_data][unit_amount]');
 assert.equal(amount,'4900','API charge must use the saved quote amount');
 assert.equal(options.body.get('metadata[booking_id]'),'7');
 assert.ok(options.headers['Idempotency-Key'].startsWith('hub-booking-B'));
 payments.push(options);
 return {ok:true,json:async()=>({id:'cs_test_ABC123',
  url:'https://checkout.stripe.com/c/pay/cs_test_ABC123',
  expires_at:Math.floor(Date.now()/1000)+3600})};
};
const STRIPE=load(read('src/booking-stripe.js'),{
 require:name=>name==='node:crypto'?crypto:name==='./booking-fee-guard'?FEE:
  name==='./monetize'?{_stripeSignatureOk:r=>r.signed===true}:(()=>{throw Error(name)})(),
 process:{env},fetch:mockedFetch,crypto,console:{error(){},warn(){}}
});
STRIPE.ensureSchema(db);
assert.ok(statements.some(x=>x.includes('idx_sponsor_stripe_session')));
STRIPE.register({post:(route,...args)=>{handlers[route]=args.at(-1);}},db,
 {limiter:()=>()=>{},bad:(res,status,error)=>res.status(status).json({ok:false,error}),
 logActivity:(...items)=>activity.push(items)},
 {byToken:token=>token===b.public_token?b:null,quoteRow:id=>id===7?q:null,sponsorView:()=>({})});
const response=()=>({statusCode:200,status(code){this.statusCode=code;return this;},
 json(payload){this.body=payload;return this;}});
async function call(route,body={},signed=false,token=b.public_token){
 const res=response();await handlers[route]({params:{token},body,signed},res);return res;
}
(async()=>{
 const pay='/api/sponsor/requests/:token/checkout';
 let r=await call(pay,{},false,'wrong-token');
 assert.equal(r.statusCode,404);
 env.HUB_PRIVATE_REVIEW='1';
 r=await call(pay);assert.equal(r.statusCode,503);
 env.HUB_PRIVATE_REVIEW='0';
 r=await call(pay);assert.equal(r.body.ok,true);assert.equal(stripeRequests,1);
 assert.equal(q.provider_ref,'cs_test_ABC123');
 r=await call(pay);assert.equal(r.body.reused,true);assert.equal(stripeRequests,1,'Retry must reuse open checkout');
 const url='/api/sponsor/webhook/stripe';
 const session={id:q.provider_ref,mode:'payment',payment_status:'paid',currency:'usd',
  amount_total:q.total_cents,payment_intent:'pi_ABC123',
  metadata:{booking_id:'7',booking_checkout_ref:q.checkout_ref}};
 const event=object=>({type:'checkout.session.completed',data:{object}});
 r=await call(url,event(session));assert.equal(r.statusCode,400,'Unsigned callback must be rejected');
 assert.equal(q.status,'accepted');
 r=await call(url,event({...session,amount_total:1}),true);
 assert.equal(q.status,'accepted','Underpayment is not settlement');
 r=await call(url,event({...session,currency:'eur'}),true);
 assert.equal(q.status,'accepted','Wrong currency is not settlement');
 r=await call(url,event({...session,metadata:{booking_id:'7',booking_checkout_ref:'B000000000000000000000000'}}),true);
 assert.equal(q.status,'accepted','Mismatched provider reference is not settlement');
 r=await call(url,event(session),true);
 assert.equal(q.status,'paid');
 assert.equal(b.status,'paid');
 assert.equal(FEE.paidFeeRecorded(q),true);
 const original=activity.length;
 r=await call(url,event(session),true);
 assert.equal(activity.length,original,'Signed webhook retries must be idempotent');
 r=await call(url,{type:'charge.refunded',data:{object:{payment_intent:'pi_ABC123',amount_refunded:1}}},true);
 assert.equal(q.status,'refunded');assert.equal(b.eventRevoked,true);
 assert.equal(FEE.paidFeeRecorded(q),false,'Any refund must lock event out');
 r=await call(url,event(session),true);
 assert.equal(q.status,'refunded','Late replay cannot resurrect refunded event');
 assert.equal(stripeRequests,1,'No external provider calls in regression fixtures');
 console.log(JSON.stringify({pass:true,sourceRouteHandlersExecuted:true,
  invalidTokenBlocked:true,privateReviewBlocked:true,duplicateCheckoutReused:true,
  unsignedWebhookRejected:true,wrongAmountCurrencyAndReferenceRejected:true,
  signedPaymentMatched:true,webhookIdempotent:true,refundRevokesEvent:true,
  replayCannotRestoreRefundedBooking:true,realStripeCalled:false,fullDockerTested:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});

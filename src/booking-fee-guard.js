'use strict';
// External vendor booking fees must be settled with independently verified
// Stripe checkout records. Admin "paid" flags and old manual bookkeeping are
// never sufficient to publish a paid vendor event.
function positiveFee(q) {
 return !!q && Number.isSafeInteger(q.total_cents) && q.total_cents>=100;
}
function paidFeeRecorded(q) {
 return positiveFee(q) && q.status==='paid' &&
   q.provider==='stripe' &&
   typeof q.provider_ref==='string' && /^cs_(?:test|live)_[A-Za-z0-9]+$/.test(q.provider_ref) &&
   typeof q.provider_payment_id==='string' && /^pi_[A-Za-z0-9]+$/.test(q.provider_payment_id) &&
   Number.isSafeInteger(q.settled_cents) && q.settled_cents===q.total_cents &&
   Number.isSafeInteger(q.paid_at) && q.paid_at>0 &&
   q.refunded_at==null;
}
function stripeBookingConfigured(env=process.env) {
 const secret=String(env.STRIPE_SECRET_KEY||''),webhook=String(env.STRIPE_BOOKING_WEBHOOK_SECRET||'');
 let origin=null;
 try {const u=new URL(String(env.PUBLIC_URL||''));if(u.protocol==='https:'&&!u.username&&!u.password)origin=u.origin;} catch {}
 return !!origin && /^sk_(?:test|live)_[A-Za-z0-9]+$/.test(secret) &&
   /^whsec_[A-Za-z0-9]+$/.test(webhook) &&
   env.HUB_PRIVATE_REVIEW!=='1' &&
   (!secret.startsWith('sk_live_') || env.PAYMENTS_LIVE_APPROVED==='1');
}
function validCheckoutUrl(url) {
 try {const u=new URL(String(url));return u.protocol==='https:'&&
   u.hostname==='checkout.stripe.com'&&!u.username&&!u.password;}
 catch{return false;}
}
module.exports={positiveFee,paidFeeRecorded,stripeBookingConfigured,validCheckoutUrl};

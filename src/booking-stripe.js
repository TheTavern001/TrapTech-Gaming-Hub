'use strict';
// Paid vendor giveaways: Stripe-hosted Checkout + independently signed
// provider webhooks. No browser response or admin status toggle can settle a
// quote. Tokens authorize viewing one's quote, NEVER a payment assertion.
const crypto=require('node:crypto');
const FEE=require('./booking-fee-guard');
const CHECKOUT_MS=45*60*1000;
function ensureSchema(db){
 const columns=new Set(db.prepare('PRAGMA table_info(sponsor_quotes)').all().map(r=>r.name));
 const add=(name,type)=>{if(!columns.has(name))db.exec('ALTER TABLE sponsor_quotes ADD COLUMN '+name+' '+type);};
 add('provider','TEXT');
 add('provider_ref','TEXT');
 add('provider_payment_id','TEXT');
 add('settled_cents','INTEGER');
 add('refunded_at','INTEGER');
 add('checkout_url','TEXT');
 add('checkout_state','TEXT');
 add('checkout_ref','TEXT');
 add('checkout_created_at','INTEGER');
 add('checkout_expires_at','INTEGER');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_stripe_session ON sponsor_quotes(provider_ref) WHERE provider_ref IS NOT NULL');
 db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_sponsor_stripe_intent ON sponsor_quotes(provider_payment_id) WHERE provider_payment_id IS NOT NULL');
 db.exec(`CREATE TABLE IF NOT EXISTS sponsor_payment_revocations(
  payment_intent TEXT PRIMARY KEY, observed_at INTEGER NOT NULL, event_type TEXT NOT NULL)`);
}
function checkoutFields(q){
 return {available:FEE.stripeBookingConfigured(),state:q?.checkout_state||'not_started',
  url:q?.status==='accepted' && q.checkout_state==='open' &&
    Number(q.checkout_expires_at)>Date.now() && FEE.validCheckoutUrl(q.checkout_url)
      ?q.checkout_url:null};
}
function register(app,db,h,{byToken,quoteRow,sponsorView}){
 const {bad,limiter,logActivity}=h;
 app.post('/api/sponsor/requests/:token/checkout',limiter('booking-checkout',8,3600e3),async(req,res)=>{
  const b=byToken(req.params.token);
  if(!b)return bad(res,404,'Unknown booking request.');
  if(!FEE.stripeBookingConfigured())return bad(res,503,'Card checkout is unavailable. No payment has been taken.');
  const q=quoteRow(b.id),t=Date.now();
  if(!q||q.status!=='accepted')return bad(res,409,'Accept a valid quote before checkout.');
  if(!FEE.positiveFee(q))return bad(res,409,'The booking requires a positive payable quote.');
  if(q.valid_until && q.valid_until<t)return bad(res,409,'This quote has expired; request a fresh quote.');
  if(q.checkout_state==='open' && Number(q.checkout_expires_at)>t && FEE.validCheckoutUrl(q.checkout_url))
    return res.json({ok:true,checkout_url:q.checkout_url,reused:true});
  // Atomically reserve this booking's checkout to avoid concurrent sessions.
  const ref=q.checkout_state==='creating' && /^B[0-9A-F]{24}$/.test(String(q.checkout_ref||''))
    ?q.checkout_ref:'B'+crypto.randomBytes(12).toString('hex').toUpperCase();
  const reservation=db.prepare(`UPDATE sponsor_quotes SET provider='stripe',checkout_ref=?,checkout_state='creating',
   checkout_created_at=?,checkout_expires_at=?,checkout_url=NULL,provider_ref=NULL
   WHERE booking_id=? AND status='accepted' AND refunded_at IS NULL
    AND (checkout_state IS NULL OR checkout_state IN ('not_started','failed')
         OR (checkout_state='open' AND checkout_expires_at<=?)
         OR (checkout_state='creating' AND checkout_created_at<?))`)
    .run(ref,t,t+CHECKOUT_MS,b.id,t,t-2*60e3);
  if(reservation.changes!==1)return bad(res,409,'Secure checkout is being prepared. Refresh the booking page.');
  let definiteRejection=false;
  try{
   const expires=t+CHECKOUT_MS;
   const form=new URLSearchParams();
   form.set('mode','payment');
   form.set('success_url',String(process.env.PUBLIC_URL).replace(/\/$/,'')+'/sponsor/status/'+encodeURIComponent(b.public_token)+'?payment=success');
   form.set('cancel_url',String(process.env.PUBLIC_URL).replace(/\/$/,'')+'/sponsor/status/'+encodeURIComponent(b.public_token)+'?payment=cancelled');
   form.set('client_reference_id',ref);
   form.set('metadata[booking_id]',String(b.id));
   form.set('metadata[booking_checkout_ref]',ref);
   form.set('line_items[0][quantity]','1');
   form.set('line_items[0][price_data][currency]','usd');
   form.set('line_items[0][price_data][unit_amount]',String(q.total_cents));
   form.set('line_items[0][price_data][product_data][name]','Trap Tech Gaming Hub — Book a Giveaway');
   form.set('payment_method_types[0]','card');
   form.set('expires_at',String(Math.floor(expires/1000)));
   const response=await fetch('https://api.stripe.com/v1/checkout/sessions',{
    method:'POST',headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY,
     'Content-Type':'application/x-www-form-urlencoded','Idempotency-Key':'hub-booking-'+ref},body:form
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok){definiteRejection=true;throw Error('Stripe checkout rejected');}
   if(!/^cs_(?:test|live)_[A-Za-z0-9]+$/.test(String(data.id||''))||
      !FEE.validCheckoutUrl(data.url))throw Error('Stripe checkout unavailable');
   const expiry=Number(data.expires_at)*1000;
   const actualExpiry=Number.isFinite(expiry)&&expiry>t?Math.min(expires,expiry):expires;
   const updated=db.prepare(`UPDATE sponsor_quotes SET provider_ref=?,checkout_url=?,checkout_state='open',
     checkout_expires_at=? WHERE booking_id=? AND checkout_ref=? AND status='accepted' AND checkout_state='creating'`)
     .run(data.id,data.url,actualExpiry,b.id,ref);
   if(updated.changes!==1)throw Error('Booking checkout reservation changed before commit');
   return res.json({ok:true,checkout_url:data.url,reused:false});
  }catch(e){
   // A network timeout is ambiguous: Stripe may have accepted the session.
   // Retain the checkout reference so the next attempt uses the SAME Stripe
   // idempotency key. Only a definitive non-2xx response can reset it.
   if(definiteRejection)db.prepare(`UPDATE sponsor_quotes SET checkout_state='failed',checkout_url=NULL,
     provider_ref=NULL WHERE booking_id=? AND checkout_ref=? AND status='accepted' AND checkout_state='creating'`)
     .run(b.id,ref);
   console.error('[booking] Stripe checkout initialization failed for booking:',b.id,String(e.message||e));
   return bad(res,503,'Secure checkout could not be started. No payment has been recorded.');
  }
 });
 app.post('/api/sponsor/webhook/stripe',async(req,res)=>{
  // Same raw-body HMAC verification as the existing store Stripe webhook.
  if(!require('./monetize')._stripeSignatureOk(req,process.env.STRIPE_BOOKING_WEBHOOK_SECRET))
   return res.status(400).json({ok:false,error:'Invalid payment signature.'});
  const event=req.body||{},obj=event.data?.object||{},t=Date.now();
  if(['checkout.session.completed','checkout.session.async_payment_succeeded'].includes(event.type)){
   if(obj.mode!=='payment'||obj.payment_status!=='paid')return res.json({received:true});
   const id=Number(obj.metadata?.booking_id),ref=String(obj.metadata?.booking_checkout_ref||'');
   const intent=typeof obj.payment_intent==='string'?obj.payment_intent:'';
   if(!Number.isSafeInteger(id)||id<1||!/^B[0-9A-F]{24}$/.test(ref)||
      !/^pi_[A-Za-z0-9]+$/.test(intent))return res.json({received:true});
   const q=quoteRow(id);
   // A signed Stripe webhook is necessary but not sufficient: match the
   // *saved* checkout session and reference, exact USD and full amount.
   if(!q||q.provider!=='stripe'||q.checkout_ref!==ref||q.provider_ref!==obj.id||
      obj.currency!=='usd'||!Number.isSafeInteger(obj.amount_total)||
      obj.amount_total!==q.total_cents||!FEE.positiveFee(q)||q.refunded_at!=null){
    console.warn('[booking] Stripe event did not match saved booking payment:',id);
    return res.json({received:true});
   }
   // Provider event delivery is not ordered. A refund or dispute may have
   // arrived before checkout.session.completed. Never resurrect that payment.
   if(db.prepare('SELECT 1 FROM sponsor_payment_revocations WHERE payment_intent=?').get(intent)){
    db.transaction(()=>{
     const u=db.prepare(`UPDATE sponsor_quotes SET status='refunded',refunded_at=?,
      provider_payment_id=?,checkout_state='refunded',updated_at=?
      WHERE booking_id=? AND provider_ref=? AND status IN ('accepted','paid')`)
      .run(t,intent,t,id,obj.id);
     if(u.changes){
      db.prepare("UPDATE bookings SET status='refunded' WHERE id=?").run(id);
      db.prepare("UPDATE giveaways SET payment_status='refunded',active=0,updated_at=? WHERE booking_id=?").run(t,id);
     }
    })();
    return res.json({received:true});
   }
   const change=db.transaction(()=>{
    const u=db.prepare(`UPDATE sponsor_quotes SET status='paid',paid_at=?,settled_cents=?,
     provider_payment_id=?,checkout_state='paid',updated_at=?
     WHERE booking_id=? AND status='accepted' AND provider='stripe'
       AND checkout_ref=? AND provider_ref=? AND total_cents=? AND refunded_at IS NULL`)
     .run(t,obj.amount_total,intent,t,id,ref,obj.id,obj.amount_total);
    if(u.changes)db.prepare("UPDATE bookings SET status='paid' WHERE id=?").run(id);
    return u.changes;
   })();
   if(change)logActivity('booking','Stripe payment verified for sponsor booking #'+id,null,id);
  }else if(event.type==='checkout.session.expired'||event.type==='checkout.session.async_payment_failed'){
   db.prepare(`UPDATE sponsor_quotes SET checkout_state='failed',checkout_url=NULL,provider_ref=NULL
    WHERE provider='stripe' AND provider_ref=? AND status='accepted'`)
    .run(String(obj.id||''));
  }else if(event.type==='charge.refunded'||event.type==='charge.dispute.created'){
   let intent=typeof obj.payment_intent==='string'?obj.payment_intent:'';
   const refund=event.type==='charge.dispute.created'||Number(obj.amount_refunded)>0;
   if(!refund)return res.json({received:true});
   // Stripe's dispute object may omit payment_intent even when charge is set.
   // Retrieve the signed event's charge from Stripe rather than ignoring a
   // disputed booked event. A transient lookup error must request retry.
   if(!intent && event.type==='charge.dispute.created'){
    const charge=typeof obj.charge==='string'?obj.charge:'';
    if(!/^ch_[A-Za-z0-9]+$/.test(charge))
     return res.status(503).json({received:false,error:'Dispute charge could not be verified.'});
    try{
     const result=await fetch('https://api.stripe.com/v1/charges/'+encodeURIComponent(charge),{
      headers:{Authorization:'Bearer '+process.env.STRIPE_SECRET_KEY}
     });
     const details=await result.json().catch(()=>({}));
     if(!result.ok||details.id!==charge)throw Error('Stripe charge lookup failed');
     intent=typeof details.payment_intent==='string'?details.payment_intent:'';
     if(!/^pi_[A-Za-z0-9]+$/.test(intent))throw Error('Charge has no verifiable payment intent');
    }catch{
     return res.status(503).json({received:false,error:'Stripe dispute verification temporarily unavailable.'});
    }
   }
   if(!intent)return res.json({received:true});
   // Revocation must be durable even if Checkout's success event has not
   // delivered provider_payment_id to sponsor_quotes yet.
   db.prepare('INSERT OR IGNORE INTO sponsor_payment_revocations(payment_intent,observed_at,event_type) VALUES (?,?,?)')
     .run(intent,t,event.type);
   const q=db.prepare("SELECT booking_id FROM sponsor_quotes WHERE provider='stripe' AND provider_payment_id=? AND status='paid'").get(intent);
   if(q){
    db.transaction(()=>{
     db.prepare(`UPDATE sponsor_quotes SET status='refunded',refunded_at=?,checkout_state='refunded',updated_at=?
      WHERE booking_id=? AND provider_payment_id=? AND status='paid'`).run(t,t,q.booking_id,intent);
     db.prepare("UPDATE bookings SET status='refunded' WHERE id=?").run(q.booking_id);
     // Preserve evidence but immediately revoke event visibility and play.
     db.prepare("UPDATE giveaways SET payment_status='refunded',active=0,updated_at=? WHERE booking_id=?").run(t,q.booking_id);
    })();
    logActivity('booking','Stripe refund/dispute froze sponsor booking #'+q.booking_id,null,q.booking_id);
   }
  }
  res.json({received:true});
 });
}
module.exports={ensureSchema,register,checkoutFields};

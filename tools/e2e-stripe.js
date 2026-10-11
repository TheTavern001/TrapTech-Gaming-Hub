'use strict';
// Isolated Stripe Checkout/webhook contract test. Uses a local SQLite DB and a mocked Stripe API;
// no real provider account, real card, or real payment is involved.
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'gaming-hub-stripe-e2e-'));
process.env.ADMIN_PASSWORD = 'stripe-e2e-password-only';
process.env.SECRET = 'stripe-e2e-secret-only-not-for-production';
process.env.DATA_DIR = DATA;
process.env.DB_PATH = path.join(DATA, 'hub.db');
process.env.PUBLIC_URL = 'https://hub.example.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_e2e_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_e2e_webhook_signing_secret';
process.env.STRIPE_CHECKOUT_ENABLED = '1';
delete process.env.STRIPE_LIVE_CHECKOUT_ENABLED;
process.env.PAY_NO_SWEEP = '1';
process.env.BTC_ADDRESS = '';

const db = require('../src/db');
const M = require('../src/monetize');
const nativeFetch = global.fetch;
let pass = 0, fail = 0;
const ok = (condition, message, extra) => {
  if (condition) { pass++; console.log('  PASS', message); }
  else { fail++; console.error('  FAIL', message, extra === undefined ? '' : JSON.stringify(extra).slice(0, 450)); }
};

let checkoutCounter = 0;
let lastCheckoutForm = null;
let nextStripeSessionOverride = null;
global.fetch = async (url, options = {}) => {
  if (String(url) === 'https://api.stripe.com/v1/checkout/sessions') {
    lastCheckoutForm = new URLSearchParams(options.body);
    checkoutCounter++;
    const id = 'cs_test_e2e_' + checkoutCounter;
    const override = nextStripeSessionOverride || {};
    nextStripeSessionOverride = null;
    return {
      ok: true, status: 200,
      json: async () => ({
        id,
        url: 'https://checkout.stripe.com/c/pay/' + id,
        expires_at: Number(lastCheckoutForm.get('expires_at')),
        livemode: false,
        ...override
      })
    };
  }
  return nativeFetch(url, options);
};

const app = express();
app.use(express.json({
  limit: '32kb',
  verify(req, res, buf) {
    if (String(req.originalUrl || '').split('?')[0] === '/api/store/webhook/stripe') req.rawBody = Buffer.from(buf);
  }
}));
const A = express.Router();
const H = {
  requireUser(req, res, next) { next(); },
  currentUser() { return null; },
  bad(res, status, error, extra = {}) { return res.status(status).json({ ok: false, error, ...extra }); },
  limiter() { return (req, res, next) => next(); }
};
M.routes(app, A, H);

function makeEvent(type, object, live = false) {
  return { id: 'evt_e2e_' + crypto.randomBytes(6).toString('hex'), object: 'event', type, livemode: live, data: { object } };
}
function signature(raw, timestamp = Math.floor(Date.now() / 1000), secret = process.env.STRIPE_WEBHOOK_SECRET) {
  const digest = crypto.createHmac('sha256', secret).update(String(timestamp) + '.').update(raw).digest('hex');
  return 't=' + timestamp + ',v1=' + digest;
}
async function sendEvent(base, event, sigOverride) {
  const raw = Buffer.from(JSON.stringify(event));
  const response = await nativeFetch(base + '/api/store/webhook/stripe', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': sigOverride === undefined ? signature(raw) : sigOverride
    },
    body: raw
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, body: payload };
}

(async () => {
  let server;
  try {
    const userId = Number(db.prepare('INSERT INTO users (username, pass_hash, created_at) VALUES (?,?,?)')
      .run('stripe_e2e_user', 'not-used-in-this-test', Date.now()).lastInsertRowid);
    const product = db.prepare('SELECT * FROM store_products WHERE id=?').get('crowns-1100');
    ok(!!product && product.usd_cents >= 99, 'test cosmetic product exists with a server-owned price', product && product.usd_cents);

    let state = M.checkoutState();
    ok(!state.enabled, 'checkout remains off until the owner enables the master switch', state);
    M.setSetting('checkout_enabled', true);
    state = M.checkoutState();
    ok(state.providers.stripe.configured, 'test Stripe readiness requires keys, webhook secret, HTTPS origin and explicit env opt-in', state.providers.stripe);

    delete process.env.STRIPE_CHECKOUT_ENABLED;
    ok(!M.checkoutState().providers.stripe.configured, 'Stripe is disabled when STRIPE_CHECKOUT_ENABLED is absent');
    process.env.STRIPE_CHECKOUT_ENABLED = '1';

    process.env.STRIPE_SECRET_KEY = 'sk_live_e2e_placeholder';
    delete process.env.STRIPE_LIVE_CHECKOUT_ENABLED;
    ok(!M.checkoutState().providers.stripe.configured, 'live Stripe key is blocked unless the separate live-enable gate is set');
    process.env.STRIPE_LIVE_CHECKOUT_ENABLED = '1';
    ok(M.checkoutState().providers.stripe.configured, 'live key needs both the general Stripe gate and explicit live gate');
    process.env.STRIPE_SECRET_KEY = 'sk_test_e2e_placeholder';
    delete process.env.STRIPE_LIVE_CHECKOUT_ENABLED;

    process.env.PUBLIC_URL = 'https://hub.example.test/a/path';
    ok(!M.checkoutState().providers.stripe.configured, 'PUBLIC_URL with a path is rejected; checkout return URLs must use the exact origin');
    process.env.PUBLIC_URL = 'https://hub.example.test';

    // A successful HTTP response from the API is not sufficient if its session URL or mode is unexpected.
    nextStripeSessionOverride = { url: 'https://checkout-lookalike.example.test/pay' };
    const invalidUrl = await M.createStripeOrder({ id: userId }, product.id);
    const failedUrlRow = db.prepare("SELECT status, checkout_url FROM store_orders WHERE provider='stripe' ORDER BY id DESC LIMIT 1").get();
    ok(invalidUrl.status === 503 && failedUrlRow.status === 'failed' && !failedUrlRow.checkout_url,
      'unexpected external checkout host fails closed and leaves an unfulfillable failed order');
    nextStripeSessionOverride = { livemode: true };
    const invalidMode = await M.createStripeOrder({ id: userId }, product.id);
    const failedModeRow = db.prepare("SELECT status, checkout_url FROM store_orders WHERE provider='stripe' ORDER BY id DESC LIMIT 1").get();
    ok(invalidMode.status === 503 && failedModeRow.status === 'failed' && !failedModeRow.checkout_url,
      'test-key request rejects a live-mode Checkout Session response');

    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
      s.once('error', reject);
    });
    const base = 'http://127.0.0.1:' + server.address().port;

    const created = await M.createStripeOrder({ id: userId }, product.id);
    ok(created.ok === true && created.order.provider === 'stripe' && created.order.checkout_url.startsWith('https://checkout.stripe.com/'),
      'Stripe checkout creates a hosted session and stores its verified HTTPS URL', created);
    const order = db.prepare('SELECT * FROM store_orders WHERE ref=?').get(created.order.ref);
    ok(!!order && /^cs_test_e2e_\d+$/.test(order.provider_ref), 'Stripe session id is linked to its server-created order');
    ok(lastCheckoutForm.get('client_reference_id') === order.ref &&
      lastCheckoutForm.get('metadata[order_ref]') === order.ref &&
      lastCheckoutForm.get('metadata[user_id]') === String(userId),
      'session includes the exact order and account reconciliation metadata');
    ok(lastCheckoutForm.get('line_items[0][price_data][unit_amount]') === String(product.usd_cents) &&
      lastCheckoutForm.get('line_items[0][price_data][currency]') === 'usd',
      'checkout amount/currency come from server-side catalogue, not browser input');

    const successEvent = makeEvent('checkout.session.completed', {
      id: order.provider_ref, object: 'checkout.session', client_reference_id: order.ref,
      metadata: { order_ref: order.ref, user_id: String(userId) },
      payment_status: 'paid', mode: 'payment', amount_total: order.usd_cents,
      currency: 'usd', payment_intent: 'pi_e2e_full_refund'
    });
    const badSig = await sendEvent(base, successEvent, 't=1,v1=not-a-real-signature');
    ok(badSig.status === 400, 'invalid webhook signature is rejected');
    ok(db.prepare('SELECT status FROM store_orders WHERE id=?').get(order.id).status === 'pending',
      'invalid webhook cannot fulfil an order');

    let response = await sendEvent(base, successEvent);
    ok(response.status === 200, 'valid signed Stripe payment event is accepted', response.body);
    let paidOrder = db.prepare('SELECT * FROM store_orders WHERE id=?').get(order.id);
    const grantedCrowns = M.crowns(userId);
    ok(paidOrder.status === 'granted' && !!paidOrder.granted_at && grantedCrowns === product.crowns + product.bonus,
      'exact paid order is fulfilled once with cosmetic Crowns only', { status: paidOrder.status, grantedCrowns });

    response = await sendEvent(base, successEvent);
    ok(response.status === 200 && M.crowns(userId) === grantedCrowns,
      'replayed successful webhook is idempotent and never double-grants');
    ok(M.crowns(userId) === product.crowns + product.bonus, 'purchase does not grant gameplay-score advantage');

    const refundEvent = makeEvent('charge.refunded', {
      object: 'charge', payment_intent: 'pi_e2e_full_refund',
      amount: order.usd_cents, amount_refunded: order.usd_cents,
      refunded: true, currency: 'usd'
    });
    response = await sendEvent(base, refundEvent);
    const refunded = db.prepare('SELECT * FROM store_orders WHERE id=?').get(order.id);
    ok(response.status === 200 && refunded.status === 'refunded' && M.crowns(userId) === 0,
      'signed full-refund event reverses the granted cosmetic entitlement', { status: refunded.status, crowns: M.crowns(userId) });
    const firstRefundAt = refunded.refunded_at;
    response = await sendEvent(base, refundEvent);
    const refundedAgain = db.prepare('SELECT * FROM store_orders WHERE id=?').get(order.id);
    ok(response.status === 200 && refundedAgain.refunded_at === firstRefundAt && M.crowns(userId) === 0,
      'replayed full-refund webhook is idempotent and does not repeat entitlement reversal');

    const second = await M.createStripeOrder({ id: userId }, product.id);
    const secondRow = db.prepare('SELECT * FROM store_orders WHERE ref=?').get(second.order.ref);
    const wrongAmountEvent = makeEvent('checkout.session.completed', {
      id: secondRow.provider_ref, object: 'checkout.session', client_reference_id: secondRow.ref,
      metadata: { order_ref: secondRow.ref, user_id: String(userId) },
      payment_status: 'paid', mode: 'payment', amount_total: secondRow.usd_cents + 1,
      currency: 'usd', payment_intent: 'pi_e2e_amount_mismatch'
    });
    response = await sendEvent(base, wrongAmountEvent);
    const mismatch = db.prepare('SELECT * FROM store_orders WHERE id=?').get(secondRow.id);
    ok(response.status === 200 && mismatch.status === 'underpaid' && !mismatch.granted_at && M.crowns(userId) === 0,
      'amount mismatch is flagged for manual review and grants nothing', { status: mismatch.status });

    const third = await M.createStripeOrder({ id: userId }, product.id);
    const thirdRow = db.prepare('SELECT * FROM store_orders WHERE ref=?').get(third.order.ref);
    const wrongModeEvent = makeEvent('checkout.session.completed', {
      id: thirdRow.provider_ref, object: 'checkout.session', client_reference_id: thirdRow.ref,
      metadata: { order_ref: thirdRow.ref, user_id: String(userId) },
      payment_status: 'paid', mode: 'payment', amount_total: thirdRow.usd_cents,
      currency: 'usd', payment_intent: 'pi_e2e_wrong_mode'
    }, true);
    response = await sendEvent(base, wrongModeEvent);
    ok(response.status === 400 && db.prepare('SELECT status FROM store_orders WHERE id=?').get(thirdRow.id).status === 'pending',
      'live-mode webhook cannot fulfil an order configured for test mode');

    const expiryEvent = makeEvent('checkout.session.expired', { object: 'checkout.session', id: thirdRow.provider_ref });
    response = await sendEvent(base, expiryEvent);
    ok(response.status === 200 && db.prepare('SELECT status FROM store_orders WHERE id=?').get(thirdRow.id).status === 'expired',
      'signed checkout-expired event closes an unpaid order');

    console.log('\nStripe integration checks: ' + pass + ' passed, ' + fail + ' failed.');
    if (fail) process.exitCode = 1;
  } catch (error) {
    console.error('Stripe integration test crashed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    global.fetch = nativeFetch;
    if (server) await new Promise(resolve => server.close(resolve));
    try { db.close(); } catch {}
    try { fs.rmSync(DATA, { recursive: true, force: true }); } catch {}
  }
})();

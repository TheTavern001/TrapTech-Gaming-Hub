// Stripe checkout against a MOCKED Stripe API (no network, no real card). Test card 4242 4242 4242 4242 is simulated by the
// mock: "paying" = delivering the same signed webhook Stripe sends after a successful hosted checkout.
// Run: STRIPE_API_BASE=http://127.0.0.1:8798 STRIPE_SECRET_KEY=sk_test_x STRIPE_WEBHOOK_SECRET=whsec_x PUBLIC_URL=https://example.test tools/fresh-api.sh tools/e2e-stripe.js
const http = require('http'); const crypto = require('crypto');
const BASE = process.env.BASE || 'http://localhost:8787'; const WH = 'whsec_testsecret';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const sessions = []; let sid = 0;
const mock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
  if (req.url === '/v1/checkout/sessions' && req.method === 'POST') { const f = new URLSearchParams(b); const s = { id: 'cs_test_' + (++sid) + crypto.randomBytes(4).toString('hex'), url: 'https://checkout.stripe.test/c/' + sid, ref: f.get('metadata[order_ref]'), user: f.get('metadata[user_id]'), amount: Number(f.get('line_items[0][price_data][unit_amount]')), auth: req.headers.authorization, pi: 'pi_' + crypto.randomBytes(8).toString('hex') }; sessions.push(s); res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ id: s.id, url: s.url })); }
  res.writeHead(404); res.end(); }); });
function client() { const jar = {}; return async (p, o = {}) => { const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
async function hook(evt, secret = WH, ts = Math.floor(Date.now() / 1000)) { const raw = JSON.stringify(evt); const sig = crypto.createHmac('sha256', secret).update(ts + '.' + raw).digest('hex');
  const r = await fetch(BASE + '/api/store/webhook/stripe', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${ts},v1=${sig}` }, body: raw }); return r.status; }
const paid = (s, o = {}) => ({ type: 'checkout.session.completed', data: { object: { id: s.id, mode: 'payment', payment_status: 'paid', client_reference_id: s.ref, metadata: { order_ref: s.ref, user_id: s.user }, amount_total: s.amount, currency: 'usd', payment_intent: s.pi, ...o } } });
(async () => {
  await new Promise(r => mock.listen(8798, '127.0.0.1', r));
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  await ADM('/api/admin/store/checkout', { method: 'PUT', body: { enabled: true } });
  const mk = async () => { const c = client(); c.u = 'st_' + Math.random().toString(36).slice(2, 8); await c('/api/auth/signup', { body: { username: c.u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); return c; };
  const U = await mk(); const bal = async (c) => (await c('/api/me/crowns')).body.credits;
  let r = await client()('/api/store'); ok(r.body.checkout.enabled && r.body.checkout.methods.length === 1 && r.body.checkout.methods[0] === 'stripe', 'Stripe is the only checkout method (Bitcoin hidden unless BTC_CHECKOUT_ENABLED=1)', r.body.checkout);
  const b0 = await bal(U);
  r = await U('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const o = r.body.order; const s = sessions[0];
  ok(r.body.ok && o.checkout_url === s.url && /^Bearer sk_test_/.test(s.auth) && s.amount === 999, 'order creates a hosted Stripe Checkout session for the exact price', r.body);
  ok(await hook(paid(s), 'whsec_wrong') === 400 && await hook(paid(s), WH, Math.floor(Date.now() / 1000) - 4000) === 400, 'bad signature and stale timestamp are rejected');
  ok((await bal(U)) === b0, 'nothing granted before a verified webhook');
  ok(await hook(paid(s, { amount_total: 100 })) === 200 && (await bal(U)) === b0, 'wrong amount never grants');
  r = await U('/api/store/orders/' + o.ref); ok(r.body.order.status === 'underpaid', 'amount mismatch flagged for manual review');
  r = await U('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const s2 = sessions[1]; const o2 = r.body.order;
  ok(await hook(paid(s2)) === 200, 'valid checkout.session.completed accepted'); const b1 = await bal(U); ok(b1 > b0, 'Credits granted after verified payment', [b0, b1]);
  ok(await hook(paid(s2)) === 200 && await hook(paid(s2)) === 200 && (await bal(U)) === b1, 'duplicate webhook deliveries are idempotent (no double grant)');
  r = await U('/api/store/orders/' + o2.ref); ok(r.body.order.status === 'paid' || r.body.order.status === 'granted' || r.body.order.granted_at, 'order marked fulfilled', r.body.order);
  ok(await hook({ type: 'charge.refunded', data: { object: { payment_intent: s2.pi, amount: s2.amount, amount_refunded: s2.amount, currency: 'usd' } } }) === 200, 'full refund webhook accepted');
  const b2 = await bal(U); ok(b2 === b0, 'full refund reverses the Credits granted', [b0, b1, b2]);
  ok(await hook({ type: 'charge.refunded', data: { object: { payment_intent: s2.pi, amount: s2.amount, amount_refunded: s2.amount, currency: 'usd' } } }) === 200 && (await bal(U)) === b2, 'duplicate refund webhook is idempotent');
  r = await U('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const s3 = sessions[2];
  ok(await hook({ type: 'checkout.session.async_payment_failed', data: { object: { id: s3.id } } }) === 200, 'failed payment webhook accepted'); r = await U('/api/store/orders/' + r.body.order.ref); ok(r.body.order.status === 'failed', 'failed payment marks order failed', r.body.order.status);
  r = await U('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const s4 = sessions[3];
  ok(await hook({ type: 'charge.refunded', data: { object: { payment_intent: s4.pi, amount: s4.amount, amount_refunded: s4.amount, currency: 'usd' } } }) === 200 && await hook(paid(s4)) === 200 && (await bal(U)) === b0, 'refund arriving BEFORE completion never grants');
  r = await U('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const s5 = sessions[4];
  ok(await hook({ type: 'checkout.session.expired', data: { object: { id: s5.id } } }) === 200, 'expired session handled'); r = await U('/api/store/orders/' + r.body.order.ref); ok(r.body.order.status === 'expired', 'expired session marks order expired');
  console.log(`\n${pass} passed, ${fail} failed`); mock.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

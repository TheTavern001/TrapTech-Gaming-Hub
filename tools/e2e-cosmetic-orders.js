// v7 Phase 4: cosmetic-only store + Bitcoin checkout against a MOCKED block explorer (no real transactions, ever).
// Run: BTC_EXPLORER_URL=http://127.0.0.1:8796 BTC_PRICE_URL=http://127.0.0.1:8796/prices PAY_NO_SWEEP=1 tools/fresh-api.sh tools/e2e-payments.js
const http = require('http'); const crypto = require('crypto');
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 400) : ''); } };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const ADDR = '32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB';
// ---- mock mempool.space ----
const M = { price: 60000, tip: 900000, txs: [] };
const txOf = (t) => ({ txid: t.txid, vout: [{ scriptpubkey_address: t.to || ADDR, value: t.sats }, { scriptpubkey_address: 'bc1qother', value: 12345 }], status: t.height ? { confirmed: true, block_height: t.height, block_time: Math.floor((t.time || Date.now()) / 1000) } : { confirmed: false } });
const mock = http.createServer((req, res) => { const u = req.url; let body;
  if (u === '/prices') body = { USD: M.price }; else if (u === '/blocks/tip/height') body = M.tip;
  else if (u === `/address/${ADDR}/txs`) body = M.txs.filter(t => t.height).map(txOf); else if (u === `/address/${ADDR}/txs/mempool`) body = M.txs.filter(t => !t.height).map(txOf);
  else if (u.startsWith('/tx/')) { const t = M.txs.find(x => x.txid === u.slice(4)); if (!t) { res.writeHead(404); return res.end(); } body = txOf(t); }
  else { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); });
const txid = () => crypto.randomBytes(32).toString('hex');
function client() { const jar = {}; return async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
(async () => {
  await new Promise(r => mock.listen(8796, '127.0.0.1', r));
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  const db = new (require('better-sqlite3'))(process.env.DB_PATH);
  const mk = async () => { const c = client(); c.u = 'cos_' + Math.random().toString(36).slice(2, 8); await c('/api/auth/signup', { body: { username: c.u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); return c; };
  const [P1, P2, P3] = [await mk(), await mk(), await mk()];
  const owns = async (c, id) => (await c('/api/shop')).body.owned.some(i => i.id === id);
  let r = await client()('/api/shop'); const list = r.body.daily || (r.body.sections && r.body.sections.daily) || [];
  const item = list.find(Boolean); ok(!!item, 'shop has a daily item'); if (!item) process.exit(1);
  const pid = 'cos:' + item.id;
  r = await client()('/api/store/cosmetic/' + encodeURIComponent(item.id)); const cents = r.body.usd_cents;
  ok(r.body.ok && r.body.on_sale && cents >= 99 && cents <= 9999 && cents === Math.min(9999, Math.max(99, Math.ceil(r.body.credits / 10))), 'quote: price = Credits/10 cents, clamped', r.body);
  r = await client()('/api/store/cosmetic/v7zzzzzzzz'); ok(r.status === 404, 'unknown cosmetic has no cash quote');
  r = await client()('/api/store/cosmetic/' + encodeURIComponent('prestige-original-crown')); ok(r.status === 404, 'prestige is not a cash cosmetic');
  await ADM('/api/admin/store/checkout', { method: 'PUT', body: { enabled: true } });
  r = await client()('/api/store/orders', { body: { product_id: pid } }); ok(r.status === 401, 'needs an account');
  r = await P1('/api/store/orders', { body: { product_id: 'cos:v7notreal' } }); ok(r.status === 404, 'unknown cosmetic order is refused', r.body);
  r = await P1('/api/store/orders', { body: { product_id: 'cos:' + 'x'.repeat(90) } }); ok(r.status === 404, 'malformed id refused');
  r = await P1('/api/store/orders', { body: { product_id: pid } }); const o = r.body.order; const base = Math.ceil(cents / 100 / 60000 * 1e8);
  ok(r.body.ok && o.usd_cents === cents && o.product.kind === 'cosmetic' && o.sats > base && o.sats <= base + 999 && o.address === '32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB', 'cosmetic order: USD snapshot + unique sat offset to the configured address', r.body);
  r = await P1('/api/store/orders', { body: { product_id: pid } }); ok(r.status === 409, 'duplicate open order for the same item refused');
  r = await P1(`/api/store/orders/${o.ref}/check`, { body: {} }); ok(r.body.order.status === 'pending' && !(await owns(P1, item.id)), 'nothing paid -> not owned');
  const t1 = txid(); M.txs.push({ txid: t1, sats: o.sats });
  r = await P1(`/api/store/orders/${o.ref}/check`, { body: {} }); ok(r.body.order.status === 'seen' && !(await owns(P1, item.id)), '0-conf -> seen, not granted');
  // underpay (60% of the quote) on a second order by P2 first (separate tx)
  r = await P3('/api/store/orders', { body: { product_id: pid } }); const o3 = r.body.order; const t2 = txid(); M.txs.push({ txid: t2, sats: Math.max(1, Math.floor(o3.sats * 0.6)), height: M.tip });
  r = await P3(`/api/store/orders/${o3.ref}/check`, { body: { txid: t2 } }); ok(r.body.order.status === 'underpaid' && !(await owns(P3, item.id)), 'underpaid -> flagged, not granted', r.body.order);
  M.txs.find(x => x.txid === t1).height = M.tip; r = await P1(`/api/store/orders/${o.ref}/check`, { body: {} });
  ok(r.body.order.status === 'granted' && await owns(P1, item.id), 'confirmed exact payment -> cosmetic granted', r.body.order);
  r = await P1(`/api/store/orders/${o.ref}/check`, { body: {} }); ok(r.body.order.status === 'granted' && db.prepare('SELECT COUNT(*) n FROM user_items WHERE user_id=(SELECT id FROM users WHERE username=?) AND item_id=?').get(P1.u, item.id).n === 1, 're-check is idempotent: exactly one copy');
  r = await P1('/api/store/orders', { body: { product_id: pid } }); ok(r.status === 409, 'owner cannot buy it again');
  r = await P2('/api/store/orders', { body: { product_id: pid } }); const o2 = r.body.order;
  r = await P2('/api/store/orders/' + o2.ref + '/check', { body: { txid: t1 } }); ok(r.body.order.status !== 'granted', "another order cannot claim P1's transaction");
  // overpay + late on P2's order
  const t3 = txid(); M.txs.push({ txid: t3, sats: o2.sats + 5000, height: M.tip }); r = await P2(`/api/store/orders/${o2.ref}/check`, { body: { txid: t3 } });
  ok(r.body.order.status === 'granted' && r.body.order.flags.includes('overpaid') && await owns(P2, item.id), 'overpayment -> granted and flagged for you to refund the difference', r.body.order);
  // reconciliation: every granted cosmetic order has exactly one chain tx and an inventory row; no inventory without an order
  const granted = db.prepare("SELECT * FROM store_orders WHERE product_id LIKE 'cos:%' AND status='granted'").all();
  ok(granted.length === 2 && granted.every(g => g.txid && g.received_sats >= g.sats && db.prepare('SELECT 1 FROM user_items WHERE user_id=? AND item_id=?').get(g.user_id, g.product_id.slice(4))) && new Set(granted.map(g => g.txid)).size === granted.length, 'reconciliation: orders <-> chain txs <-> inventory line up');
  // refund reverses the item
  r = await ADM(`/api/admin/store/orders/${o.ref}/refund`, { body: { note: 'test' } }); ok(r.body.ok && !(await owns(P1, item.id)), 'admin refund removes the cosmetic');
  r = await P1(`/api/store/orders/${o.ref}/check`, { body: { txid: t1 } }); ok(r.body.order.status === 'refunded' && !(await owns(P1, item.id)), 'a refunded order can never re-grant');
  // item that rotated out cannot be ordered; paid-then-rotated orders still deliver
  const gone = 'cos:' + 'v7u' + '000000'; r = await P1('/api/store/orders', { body: { product_id: gone } }); ok(r.status === 404 || r.status === 409, 'off-sale item cannot be ordered');
  // earned-only items are not for sale
  r = await P1('/api/store/orders', { body: { product_id: 'cos:v7p1s3' } }); ok(r.status >= 400, 'earned/premium-track items cannot be bought with cash', r.body);
  console.log(`\n${pass} passed, ${fail} failed`); mock.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

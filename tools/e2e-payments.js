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
  const BTC = require('../src/btc');
  ok(BTC.validateAddress(ADDR).ok && BTC.validateAddress(ADDR).type === 'p2sh', "configured test receiving address passes the base58check checksum (P2SH mainnet)");
  ok(!BTC.validateAddress(ADDR.slice(0, -1) + 'C').ok && !BTC.validateAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdx').ok, 'a one-character typo fails the checksum (base58 and bech32)');
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  const mk = async () => { const c = client(); c.u = 'pay_' + Math.random().toString(36).slice(2, 8); await c('/api/auth/signup', { body: { username: c.u, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } }); return c; };
  const [P1, P2, F] = [await mk(), await mk(), await mk()];
  let r = await client()('/api/store'); ok(r.body.ok && r.body.checkout.enabled && r.body.packs.length === 4 && r.body.prestige.length === 3 && r.body.pass.usd_cents > 0 && /never change scores/.test(r.body.non_advantage), 'store: packs, pass, 3 prestige items, non-advantage statement, checkout on (BTC_ADDRESS set)', r.body.checkout);
  r = await ADM('/api/admin/store/checkout', { method: 'PUT', body: { enabled: false } }); r = await P1('/api/store/orders', { body: { product_id: 'crowns-1100' } }); ok(r.status === 503, 'admin switch off -> checkout refused');
  await ADM('/api/admin/store/checkout', { method: 'PUT', body: { enabled: true } });
  r = await client()('/api/store/orders', { body: { product_id: 'crowns-1100' } }); ok(r.status === 401, 'checkout needs an account');
  // exact-amount auto match
  r = await P1('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const o1 = r.body.order;
  const base = Math.ceil(9.99 / 60000 * 1e8);
  ok(r.body.ok && o1.address === ADDR && o1.sats > base && o1.sats <= base + 999 && o1.uri === `bitcoin:${ADDR}?amount=${(o1.sats / 1e8).toFixed(8)}` && o1.expires_at - o1.created_at === 45 * 60e3, 'order: unique sat offset (1-999), bitcoin: URI, 45-minute quote', o1);
  r = await P2('/api/store/orders', { body: { product_id: 'crowns-1100' } }); const o2 = r.body.order; ok(o2.sats !== o1.sats, 'two open orders for the same product never share an amount');
  r = await P1(`/api/store/orders/${o1.ref}/check`, { body: {} }); ok(r.body.order.status === 'pending', 'nothing on chain yet -> pending');
  const t1 = txid(); M.txs.push({ txid: t1, sats: o1.sats });
  r = await P1(`/api/store/orders/${o1.ref}/check`, { body: {} }); ok(r.body.order.status === 'seen' && r.body.order.txid === t1 && r.body.crowns === 0, 'exact amount in the mempool -> seen, not granted yet (0 conf)', r.body.order);
  M.txs.find(x => x.txid === t1).height = M.tip; r = await P1(`/api/store/orders/${o1.ref}/check`, { body: {} });
  ok(r.body.order.status === 'granted' && r.body.crowns === 1100, '1 confirmation on a small order -> granted 1,100 Crowns automatically', r.body);
  r = await P2(`/api/store/orders/${o2.ref}/check`, { body: {} }); ok(r.body.order.status === 'pending' && !r.body.order.txid, "another order cannot claim P1's transaction");
  // txid paste for a non-exact (overpaid) amount
  const t2 = txid(); M.txs.push({ txid: t2, sats: o2.sats + 5000, height: M.tip });
  r = await P2(`/api/store/orders/${o2.ref}/check`, { body: { txid: t1 } }); ok(r.body.order.status === 'pending', 'pasting an already-claimed txid does nothing');
  r = await P2(`/api/store/orders/${o2.ref}/check`, { body: { txid: t2 } }); ok(r.body.order.status === 'granted' && r.body.order.flags.includes('overpaid'), 'pasted txid with an overpayment -> granted and flagged "overpaid" for a manual refund of the difference', r.body.order);
  // underpayment
  r = await F('/api/store/orders', { body: { product_id: 'crowns-500' } }); const o3 = r.body.order; const t3 = txid(); M.txs.push({ txid: t3, sats: o3.sats - 2000, height: M.tip });
  r = await F(`/api/store/orders/${o3.ref}/check`, { body: { txid: t3 } }); ok(r.body.order.status === 'underpaid' && r.body.crowns === 0, 'underpayment -> "underpaid", nothing granted', r.body.order);
  r = await ADM(`/api/admin/store/orders/${o3.ref}/grant`, { body: {} }); ok(r.body.ok && r.body.order.status === 'granted', 'admin manual verify/grant fallback');
  r = await ADM(`/api/admin/store/orders/${o3.ref}/refund`, { body: { note: 'test' } }); r = await F('/api/me/crowns'); ok(r.body.crowns === 0, 'admin refund reverses the Crowns');
  // expiry
  const db = new (require('better-sqlite3'))(process.env.DB_PATH);
  r = await F('/api/store/orders', { body: { product_id: 'crowns-500' } }); const o4 = r.body.order; db.prepare('UPDATE store_orders SET created_at=created_at-3600e3, expires_at=expires_at-3600e3 WHERE ref=?').run(o4.ref);
  r = await F(`/api/store/orders/${o4.ref}/check`, { body: {} }); ok(r.body.order.status === 'expired', 'unpaid quote expires after 45 minutes');
  const t4 = txid(); M.txs.push({ txid: t4, sats: o4.sats, height: M.tip }); r = await F(`/api/store/orders/${o4.ref}/check`, { body: {} });
  ok(r.body.order.status === 'granted' && r.body.order.flags.includes('late'), 'exact payment after expiry (within 24 h) is still matched, flagged "late"', r.body.order);
  // prestige: 6 confirmations
  r = await P1('/api/store/orders', { body: { product_id: 'prestige-crown' } }); const o5 = r.body.order; ok(o5.need_confs === 6 && o5.sats > 8e6, 'prestige order needs 6 confirmations ($5,000 at $60k = 8.3M sats)', o5);
  const t5 = txid(); M.txs.push({ txid: t5, sats: o5.sats, height: M.tip - 2 }); r = await P1(`/api/store/orders/${o5.ref}/check`, { body: {} }); ok(r.body.order.status === 'confirming' && r.body.order.confs === 3, '3 of 6 confirmations -> confirming');
  M.tip += 3; r = await P1(`/api/store/orders/${o5.ref}/check`, { body: {} }); ok(r.body.order.status === 'granted', '6 confirmations -> granted');
  r = await client()('/api/store/prestige'); const pc = r.body.items.find(i => i.id === 'prestige-crown'); ok(pc.owners.length === 1 && pc.owners[0].serial === 1 && pc.owners[0].username === P1.u && pc.supply === 5, 'prestige: serial #1 of 5 on the global "owned by" wall');
  // pass + crowns spend
  r = await ADM('/api/admin/store/grant', { body: { username: P1.u, product_id: 'season-pass' } }); ok(r.ok !== false && r.body.ok, 'admin can grant a Season Pass manually');
  r = await P1('/api/pass'); ok(r.body.owned && r.body.track.length === 20 && r.body.xp_boost_pct === 15, 'premium track: 20 reward steps, 15% premium-track XP boost');
  r = await P1('/api/pass/quests'); ok(r.body.total === 48 && r.body.done < 48 && r.body.reward_season === r.body.season + 1, '48-quest chain toward next season\'s free pass');
  r = await client()('/api/shop'); const any = r.body && (r.body.daily || (r.body.sections && r.body.sections.daily) || []).find(Boolean);
  if (any) { r = await P1('/api/crowns/buy', { body: { item_id: any.id } }); ok(r.body.ok && r.body.price_crowns >= 50, 'Crowns buy a cosmetic from the current shop', r.body); }
  r = await P1('/api/crowns/buy', { body: { item_id: 'v7p1s3' } }); ok(r.status === 400, 'premium-track items cannot be bought with Crowns');
  // NO ADVANTAGE: paid (P1: crowns, pass, prestige) vs free (F) on identical runs
  console.log('# paid vs free: identical treatment');
  const t0 = Date.now(); r = await ADM('/api/admin/giveaways', { body: { title: 'Pay-to-win check', host: 'T', start_at: t0 - 60e3, end_at: t0 + 3600e3, game_id: 'jetpack-dash', active: true } }); const gid = r.body.id;
  const [eP, eF] = await Promise.all([P1(`/api/giveaways/${gid}/eligibility`), F(`/api/giveaways/${gid}/eligibility`)]);
  ok(JSON.stringify(eP.body.checks.map(c => [c.id, c.ok])) === JSON.stringify(eF.body.checks.map(c => [c.id, c.ok])), 'eligibility checks are identical for paid and free players');
  const play = async (c, score) => { const s = await c('/api/run/start', { body: { game_id: 'jetpack-dash', event: gid } }); await sleep(2300); return c('/api/score', { body: { token: s.body.token, score, coins: 0, duration_ms: 2300 } }); };
  const [sp, sf] = await Promise.all([play(P1, 40), play(F, 40)]);
  ok(sp.body.ok && sf.body.ok && sp.body.held === sf.body.held && sp.body.verified === sf.body.verified, 'same run -> same anti-cheat result');
  r = await client()(`/api/leaderboard?giveaway=${gid}`); const rows = r.body.rows; ok(rows.length === 2 && rows.every(x => x.score === 40), 'both on the event board with the same score');
  const [hp, hf] = await Promise.all([play(P1, 99999), play(F, 99999)]); ok(hp.status === 422 && hf.status === 422, 'impossible score rejected for paid and free alike');
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'server.js'), 'utf8').split("app.post('/api/score'")[1].split('\napp.')[0];
  ok(!/monetize|crown|prestige|pass_owned|store_/.test(src) && !/monetize|crown|pass_owned/i.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'src', 'results.js'), 'utf8')), 'score submission and results code never read store data');
  await ADM('/api/admin/giveaways/' + gid, { method: 'DELETE' });
  console.log(`\n${pass} passed, ${fail} failed`); mock.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

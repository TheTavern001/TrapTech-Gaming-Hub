'use strict';
// v7 Phase 4: PLAYER MONETISATION - COSMETIC ONLY. Nothing here can change a score, an attempt, a giveaway entry, an
// eligibility check or a tie-break: those code paths (src/server.js /api/score, src/events.js, src/results.js,
// src/eligibility.js, src/anticheat.js) never read anything from this module. tools/e2e-payments.js proves it.
//  (a) Hub Crowns: hub currency bought in packs with real money, spendable ONLY on cosmetics / avatar items.
//  (b) Season Pass: premium track on top of the free track (premium cosmetics, bonus Crowns, and a premium-track XP boost
//      that only speeds up the premium track itself; never the season board, scores, attempts or eligibility).
//  (c) "Earn next season's pass free": a hard 48-quest chain (src/pass-quests.js, docs/PASS-QUESTS.md).
//  (d) Prestige showcase items: three numbered, limited, very expensive cosmetics with an "owned by" wall.
// PAYMENTS are provider-agnostic (PROVIDERS below). Default: BITCOIN to one fixed watch-only address (BTC_ADDRESS):
// every order gets a unique exact satoshi amount (+1..999 sat offset, unique among open orders) and a 45-minute
// quote; src/btc.js matches incoming transactions on the public chain (mempool.space). No private keys on the server.
// Whop (hosted checkout + webhook) and Stripe are documented alternatives (HANDOFF.md). Checkout stays DISABLED until
// BTC_ADDRESS is set (and valid) AND the admin switches it on.
const crypto = require('crypto');
const db = require('./db');
const BTC = require('./btc');
const G = require('./shop-gen');

db.exec(`
CREATE TABLE IF NOT EXISTS crown_ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, ref TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS crown_ledger_u ON crown_ledger(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS crown_ledger_once ON crown_ledger(user_id, reason, ref) WHERE ref <> '';
CREATE TABLE IF NOT EXISTS store_products (id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, usd_cents INTEGER NOT NULL, crowns INTEGER NOT NULL DEFAULT 0,
  bonus INTEGER NOT NULL DEFAULT 0, supply INTEGER, data TEXT NOT NULL DEFAULT '{}', active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS store_orders (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, product_id TEXT NOT NULL, usd_cents INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'bitcoin', btc_usd REAL, sats INTEGER, address TEXT, status TEXT NOT NULL DEFAULT 'pending', txid TEXT, received_sats INTEGER, confs INTEGER NOT NULL DEFAULT 0,
  need_confs INTEGER NOT NULL DEFAULT 1, txid_hint TEXT, flags TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, paid_at INTEGER, granted_at INTEGER,
  refunded_at INTEGER, note TEXT NOT NULL DEFAULT '', season INTEGER);
CREATE UNIQUE INDEX IF NOT EXISTS store_orders_txid ON store_orders(txid) WHERE txid IS NOT NULL;
CREATE INDEX IF NOT EXISTS store_orders_status ON store_orders(status);
CREATE TABLE IF NOT EXISTS pass_owned (user_id INTEGER NOT NULL, season INTEGER NOT NULL, source TEXT NOT NULL, order_id INTEGER, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, season));
CREATE TABLE IF NOT EXISTS pass_claims (user_id INTEGER NOT NULL, season INTEGER NOT NULL, level INTEGER NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (user_id, season, level));
CREATE TABLE IF NOT EXISTS prestige_owned (item_id TEXT NOT NULL, serial INTEGER NOT NULL, user_id INTEGER, order_id INTEGER, created_at INTEGER NOT NULL, revoked_at INTEGER, PRIMARY KEY (item_id, serial));
`);
for (const [name, type] of [['provider_ref','TEXT'], ['checkout_url','TEXT'], ['provider_payment_id','TEXT']]) {
  if (!db.prepare('PRAGMA table_info(store_orders)').all().some(c => c.name === name)) db.exec(`ALTER TABLE store_orders ADD COLUMN ${name} ${type}`);
}
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS store_orders_provider_ref ON store_orders(provider, provider_ref) WHERE provider_ref IS NOT NULL');

// ---------- catalog (prices are PUBLIC for player items; booking prices are not) ----------
const PRESTIGE = {
  'prestige-cane': { name: 'Diamond Don Cane', blurb: 'Hand-set diamond pave on a solid-gold shaft, topped with a cut-crystal crown. Sparkle trail and a slow gold shimmer.', fx: 'sparkle', supply: 25, usd: 250000, confs: 6 },
  'prestige-throne': { name: 'Stack Throne Aura', blurb: 'A towering throne of banded cash stacks with a drifting bill rain and a green-gold aura behind your avatar.', fx: 'cashrain', supply: 10, usd: 350000, confs: 6 },
  'prestige-crown': { name: 'Solid Gold Crown & Chain', blurb: 'A heavy solid-gold crown with an emerald inlay and a matching link chain. Animated light sweep and a crown-glow halo.', fx: 'goldsweep', supply: 5, usd: 500000, confs: 6 },
};
const SEED = [
  { id: 'crowns-500', kind: 'pack', name: '500 Hub Crowns', usd_cents: 499, crowns: 500, bonus: 0, sort: 1 },
  { id: 'crowns-1100', kind: 'pack', name: '1,100 Hub Crowns', usd_cents: 999, crowns: 1000, bonus: 100, sort: 2 },
  { id: 'crowns-2400', kind: 'pack', name: '2,400 Hub Crowns', usd_cents: 1999, crowns: 2000, bonus: 400, sort: 3 },
  { id: 'crowns-6500', kind: 'pack', name: '6,500 Hub Crowns', usd_cents: 4999, crowns: 5000, bonus: 1500, sort: 4 },
  { id: 'season-pass', kind: 'pass', name: 'Season Pass (premium track)', usd_cents: 999, crowns: 0, bonus: 0, sort: 10, data: { bonus_crowns_total: 600, xp_boost_pct: 15 } },
  ...Object.entries(PRESTIGE).map(([id, p], i) => ({ id, kind: 'prestige', name: p.name, usd_cents: p.usd, crowns: 0, bonus: 0, supply: p.supply, sort: 20 + i, data: { blurb: p.blurb, fx: p.fx, confs: p.confs } })),
];
{ const ins = db.prepare('INSERT OR IGNORE INTO store_products (id, kind, name, usd_cents, crowns, bonus, supply, data, active, sort, updated_at) VALUES (?,?,?,?,?,?,?,?,1,?,?)');
  for (const p of SEED) ins.run(p.id, p.kind, p.name, p.usd_cents, p.crowns, p.bonus, p.supply ?? null, JSON.stringify(p.data || {}), p.sort, Date.now()); }
const prod = (id) => { const p = db.prepare('SELECT * FROM store_products WHERE id=?').get(id); if (p) p.data = JSON.parse(p.data || '{}'); return p; };
const products = (all = false) => db.prepare(`SELECT * FROM store_products ${all ? '' : 'WHERE active=1'} ORDER BY sort, id`).all().map(p => ({ ...p, data: JSON.parse(p.data || '{}') }));
const issued = (id) => db.prepare('SELECT COUNT(*) c FROM prestige_owned WHERE item_id=? AND revoked_at IS NULL').get(id).c;
const reserved = (id) => db.prepare("SELECT COUNT(*) c FROM store_orders WHERE product_id=? AND status IN ('pending','seen','confirming')").get(id).c;

// ---------- settings / provider ----------
const setting = (k, d) => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); try { return r ? JSON.parse(r.value) : d; } catch { return d; } };
const setSetting = (k, v) => db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at').run(k, JSON.stringify(v), Date.now());
const ADDR = () => String(process.env.BTC_ADDRESS || '').trim();
function checkoutState() {
  const a = ADDR(); const v = a ? BTC.validateAddress(a) : { ok: false, why: 'BTC_ADDRESS is not set' };
  const on = !!setting('checkout_enabled', true);
  const btc = { configured: !!a && v.ok, address: v.ok ? a : null, type: v.ok ? v.type : null, why: v.ok ? null : v.why };
  const publicUrl = String(process.env.PUBLIC_URL || '').trim();
  const stripe = { configured: /^sk_(?:test|live)_/.test(String(process.env.STRIPE_SECRET_KEY || '')) && /^whsec_/.test(String(process.env.STRIPE_WEBHOOK_SECRET || '')) && /^https:\/\//i.test(publicUrl),
    mode: 'hosted Stripe Checkout for credit/debit cards' };
  const enabled = on && (btc.configured || stripe.configured);
  return { enabled, admin_switch: on, methods: enabled ? [...(btc.configured ? ['bitcoin'] : []), ...(stripe.configured ? ['stripe'] : [])] : [],
    providers: { bitcoin: btc, stripe, whop: { configured: false, mode: 'not integrated' } },
    reason: !on ? 'Checkout is switched off by the admin.' : !btc.configured && !stripe.configured ? 'Configure a valid BTC_ADDRESS or Stripe keys plus an HTTPS PUBLIC_URL to enable checkout.' : null };
}
const ORDER_TTL_MS = 45 * 60e3, LATE_MS = 24 * 3600e3;
const needConfs = (p, usd) => p.kind === 'prestige' ? Math.max(6, (p.data && p.data.confs) || 6) : usd >= 20000 ? 3 : 1;
const BTCfmt = (sats) => (sats / 1e8).toFixed(8);
function pubOrder(o) { const p = prod(o.product_id) || { name: o.product_id, kind: '?' };
  return { ref: o.ref, product: { id: o.product_id, name: p.name, kind: p.kind }, usd_cents: o.usd_cents, provider: o.provider, status: o.status, sats: o.sats, btc: o.sats ? BTCfmt(o.sats) : null, address: o.address,
    uri: o.address && o.sats ? `bitcoin:${o.address}?amount=${BTCfmt(o.sats)}` : null, txid: o.txid, received_sats: o.received_sats, confs: o.confs, need_confs: o.need_confs, created_at: o.created_at,
    expires_at: o.expires_at, paid_at: o.paid_at, granted_at: o.granted_at, refunded_at: o.refunded_at, flags: o.flags ? o.flags.split(',') : [], note: o.note, checkout_url: o.checkout_url || null }; }

// ---------- create / match / grant ----------
async function createOrder(user, productId, t = Date.now()) {
  const st = checkoutState(); if (!st.enabled) return { status: 503, error: st.reason };
  if (!st.providers.bitcoin.configured) return { status: 503, error: 'Bitcoin checkout is not configured.' };
  const p = prod(productId); if (!p || !p.active) return { status: 404, error: 'That item is not for sale.' };
  if (p.kind === 'prestige' && issued(p.id) + reserved(p.id) >= p.supply) return { status: 409, error: 'Sold out (or the last ones are reserved by open orders).' };
  if (p.kind === 'pass' && db.prepare('SELECT 1 FROM pass_owned WHERE user_id=? AND season=?').get(user.id, curSeason(t))) return { status: 409, error: 'You already have this season\'s pass.' };
  const open = db.prepare("SELECT COUNT(*) c FROM store_orders WHERE user_id=? AND status='pending' AND expires_at > ?").get(user.id, t).c; if (open >= 3) return { status: 429, error: 'Finish or let your open orders expire first (max 3).' };
  let usd; try { usd = await BTC.usdPrice(); } catch (e) { return { status: 503, error: 'Could not get the Bitcoin price right now. Try again in a minute.' }; }
  const base = Math.ceil(p.usd_cents / 100 / usd * 1e8);
  const taken = new Set(db.prepare("SELECT sats FROM store_orders WHERE status IN ('pending','seen','confirming') OR (status='expired' AND expires_at > ?)").all(t - LATE_MS).map(r => r.sats));
  let sats = 0; for (let i = 0; i < 2000; i++) { const s = base + 1 + crypto.randomInt(999); if (!taken.has(s)) { sats = s; break; } } if (!sats) return { status: 503, error: 'Too many open orders right now, try again shortly.' };
  const ref = 'O' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const id = db.prepare('INSERT INTO store_orders (ref, user_id, product_id, usd_cents, provider, btc_usd, sats, address, need_confs, created_at, expires_at, season) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(ref, user.id, p.id, p.usd_cents, 'bitcoin', usd, sats, ADDR(), needConfs(p, p.usd_cents), t, t + ORDER_TTL_MS, p.kind === 'pass' ? curSeason(t) : null).lastInsertRowid;
  return { ok: true, order: pubOrder(db.prepare('SELECT * FROM store_orders WHERE id=?').get(id)) };
}
const curSeason = (t = Date.now()) => require('./seasons').seasonAt(t).number;
async function createStripeOrder(user, productId, t = Date.now()) {
  const st = checkoutState();
  if (!st.enabled) return { status: 503, error: st.reason };
  if (!st.providers.stripe.configured) return { status: 503, error: 'Credit/debit card checkout is not configured.' };
  const p = prod(productId); if (!p || !p.active) return { status: 404, error: 'That item is not for sale.' };
  if (p.kind === 'prestige' && issued(p.id) + reserved(p.id) >= p.supply) return { status: 409, error: 'Sold out (or the last ones are reserved by open orders).' };
  if (p.kind === 'pass' && db.prepare('SELECT 1 FROM pass_owned WHERE user_id=? AND season=?').get(user.id, curSeason(t))) return { status: 409, error: "You already have this season's pass." };
  const open = db.prepare("SELECT COUNT(*) c FROM store_orders WHERE user_id=? AND status IN ('pending','seen','confirming') AND expires_at > ?").get(user.id, t).c;
  if (open >= 3) return { status: 429, error: 'Finish or let your open orders expire first (max 3).' };
  const ref = 'O' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const expires = t + ORDER_TTL_MS;
  const id = db.prepare("INSERT INTO store_orders (ref,user_id,product_id,usd_cents,provider,status,created_at,expires_at,season) VALUES (?,?,?,?,'stripe','pending',?,?,?)")
    .run(ref, user.id, p.id, p.usd_cents, t, expires, p.kind === 'pass' ? curSeason(t) : null).lastInsertRowid;
  try {
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', process.env.PUBLIC_URL.replace(/\/$/, '') + '/store/order/' + ref + '?payment=success');
    form.set('cancel_url', process.env.PUBLIC_URL.replace(/\/$/, '') + '/store/order/' + ref + '?payment=cancelled');
    form.set('client_reference_id', ref);
    form.set('metadata[order_ref]', ref);
    form.set('metadata[user_id]', String(user.id));
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', 'usd');
    form.set('line_items[0][price_data][unit_amount]', String(p.usd_cents));
    form.set('line_items[0][price_data][product_data][name]', p.name);
    form.set('expires_at', String(Math.floor(expires / 1000)));
    form.set('payment_method_types[0]', 'card');
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': 'hub-order-' + ref }, body: form
    });
    const session = await response.json().catch(() => ({}));
    if (!response.ok || !session.id || !session.url) throw new Error('Stripe rejected checkout session');
    db.prepare('UPDATE store_orders SET provider_ref=?, checkout_url=?, expires_at=? WHERE id=?').run(session.id, session.url, Math.min(expires, Number(session.expires_at || Math.floor(expires / 1000)) * 1000), id);
    return { ok: true, order: pubOrder(db.prepare('SELECT * FROM store_orders WHERE id=?').get(id)) };
  } catch (err) {
    db.prepare("UPDATE store_orders SET status='failed', note='Stripe checkout session could not be created' WHERE id=?").run(id);
    console.error('[payments] Stripe Checkout session creation failed:', err.message);
    return { status: 503, error: 'Could not start secure card checkout. Please try again later.' };
  }
}

function grant(o, how = 'auto', t = Date.now()) {
  const p = prod(o.product_id); if (!p) return { ok: false, error: 'unknown product' };
  return db.transaction(() => {
    const fresh = db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id); if (fresh.granted_at) return { ok: true, already: true };
    if (p.kind === 'pack') addCrowns(o.user_id, p.crowns + p.bonus, 'purchase', o.ref, t);
    else if (p.kind === 'pass') db.prepare('INSERT OR IGNORE INTO pass_owned (user_id, season, source, order_id, created_at) VALUES (?,?,?,?,?)').run(o.user_id, o.season || curSeason(t), 'purchase', o.id, t);
    else if (p.kind === 'prestige') {
      const n = db.prepare('SELECT COUNT(*) c FROM prestige_owned WHERE item_id=?').get(p.id).c; if (n >= p.supply) { db.prepare("UPDATE store_orders SET status='sold_out_refund', note=? WHERE id=?").run('Sold out at confirmation: refund manually', o.id); return { ok: false, error: 'sold out' }; }
      db.prepare('INSERT INTO prestige_owned (item_id, serial, user_id, order_id, created_at) VALUES (?,?,?,?,?)').run(p.id, n + 1, o.user_id, o.id, t);
    }
    db.prepare("UPDATE store_orders SET status='granted', granted_at=?, note=CASE WHEN note='' THEN ? ELSE note END WHERE id=?").run(t, how === 'auto' ? '' : 'granted by ' + how, o.id);
    return { ok: true };
  })();
}
function addCrowns(userId, delta, reason, ref = '', t = Date.now()) { db.prepare('INSERT OR IGNORE INTO crown_ledger (user_id, delta, reason, ref, created_at) VALUES (?,?,?,?,?)').run(userId, delta, reason, ref, t); }
const crowns = (userId) => db.prepare('SELECT COALESCE(SUM(delta),0) s FROM crown_ledger WHERE user_id=?').get(userId).s;
function flag(o, f) { const s = new Set((o.flags || '').split(',').filter(Boolean)); s.add(f); db.prepare('UPDATE store_orders SET flags=? WHERE id=?').run([...s].join(','), o.id); }

// one pass over open orders against the chain. txsFor/tip injectable for tests.
async function check(orders, t = Date.now()) {
  if (!orders.length || !ADDR()) return [];
  const txs = await BTC.addressTxs(ADDR()); const tip = await BTC.tipHeight();
  const claimed = new Set(db.prepare('SELECT txid FROM store_orders WHERE txid IS NOT NULL').all().map(r => r.txid));
  const out = [];
  for (let o of orders) {
    o = db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id); if (!o || o.granted_at || o.refunded_at) continue;
    let m = o.txid ? (txs.find(x => x.txid === o.txid) || await BTC.tx(o.txid, ADDR())) : null;
    if (!m && o.txid_hint) { const h = txs.find(x => x.txid === o.txid_hint) || await BTC.tx(o.txid_hint, ADDR()); if (h && h.sats > 0 && !claimed.has(h.txid) && (!h.time || h.time >= o.created_at - 120e3)) m = h; }
    if (!m) m = txs.find(x => x.sats === o.sats && !claimed.has(x.txid) && (!x.time || x.time >= o.created_at - 120e3));
    if (!m) { if (o.status === 'pending' && t > o.expires_at) { db.prepare("UPDATE store_orders SET status='expired' WHERE id=?").run(o.id); out.push([o.ref, 'expired']); } continue; }
    if (!o.txid) { try { db.prepare('UPDATE store_orders SET txid=?, received_sats=? WHERE id=?').run(m.txid, m.sats, o.id); claimed.add(m.txid); } catch { continue; } }
    const confs = m.confirmed && m.height ? tip - m.height + 1 : 0;
    const late = t > o.expires_at; if (late) flag(o, 'late');
    let status = confs >= o.need_confs ? 'paid' : confs > 0 ? 'confirming' : 'seen';
    if (m.sats < o.sats) { status = 'underpaid'; flag(o, 'underpaid'); }
    else if (m.sats > o.sats + 1000) flag(o, 'overpaid');
    db.prepare('UPDATE store_orders SET status=?, confs=?, received_sats=?, paid_at=CASE WHEN ?=\'paid\' THEN COALESCE(paid_at, ?) ELSE paid_at END WHERE id=?').run(status, confs, m.sats, status, t, o.id);
    if (status === 'paid') { const g = grant(db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id)); out.push([o.ref, g.ok ? 'granted' : g.error]); } else out.push([o.ref, status]);
  }
  return out;
}
const openOrders = (t = Date.now()) => db.prepare("SELECT * FROM store_orders WHERE status IN ('pending','seen','confirming') OR (status='expired' AND granted_at IS NULL AND expires_at > ?)").all(t - LATE_MS);
let busy = false;
async function sweep(t = Date.now()) { if (busy) return []; busy = true; try { return await check(openOrders(t), t); } catch (e) { console.error('[pay] sweep', e.message); return []; } finally { busy = false; } }
if (!process.env.PAY_NO_SWEEP) setInterval(() => { if (ADDR() && openOrders().length) sweep(); }, 60e3).unref();

function reverseEntitlements(o, actor, note = '', t = Date.now()) {
  const p = prod(o.product_id); if (!p) return { ok: false, error: 'Unknown product.' };
  db.transaction(() => {
    if (o.granted_at) {
      if (p.kind === 'pack') addCrowns(o.user_id, -(p.crowns + p.bonus), 'refund', o.ref, t);
      if (p.kind === 'pass') {
        const season = o.season || curSeason(t);
        const claimed = new Set(db.prepare('SELECT level FROM pass_claims WHERE user_id=? AND season=?').all(o.user_id, season).map(x => x.level));
        let earnedCrowns = 0;
        for (const reward of premiumTrack(season)) if (claimed.has(reward.level)) {
          if (reward.item) db.prepare('DELETE FROM user_items WHERE user_id=? AND item_id=?').run(o.user_id, reward.item.id);
          earnedCrowns += reward.crowns || 0;
        }
        if (earnedCrowns) addCrowns(o.user_id, -earnedCrowns, 'refund', o.ref, t);
        db.prepare('DELETE FROM pass_claims WHERE user_id=? AND season=?').run(o.user_id, season);
        db.prepare('DELETE FROM pass_owned WHERE user_id=? AND order_id=?').run(o.user_id, o.id);
      }
      if (p.kind === 'prestige') db.prepare('UPDATE prestige_owned SET revoked_at=? WHERE order_id=?').run(t, o.id);
    }
    db.prepare("UPDATE store_orders SET status='refunded', refunded_at=?, note=? WHERE id=?")
      .run(t, `refunded by ${actor}${note ? ': ' + note : ''}`, o.id);
  })();
  return { ok: true };
}
function refund(orderRef, actor, note = '') {
  const o = db.prepare('SELECT * FROM store_orders WHERE ref=?').get(orderRef);
  if (!o) return { ok: false, error: 'Unknown order.' };
  if (o.refunded_at) return { ok: false, error: 'Already refunded.' };
  if (o.provider === 'stripe') return { ok: false, error: 'Issue the refund in Stripe Dashboard; Hub entitlements are reversed automatically after Stripe confirms a full refund.' };
  return reverseEntitlements(o, actor, (note ? note + '; ' : '') + 'send the BTC back manually from the configured wallet');
}
function manualGrant(userId, productId, actor, note = '') {
  const p = prod(productId); if (!p) return { ok: false, error: 'Unknown product.' }; const t = Date.now(); const ref = 'M' + crypto.randomBytes(6).toString('hex').toUpperCase();
  const id = db.prepare("INSERT INTO store_orders (ref, user_id, product_id, usd_cents, provider, status, created_at, expires_at, note, season) VALUES (?,?,?,?, 'manual', 'paid', ?, ?, ?, ?)").run(ref, userId, p.id, 0, t, t, `manual grant by ${actor}${note ? ': ' + note : ''}`, p.kind === 'pass' ? curSeason(t) : null).lastInsertRowid;
  const g = grant(db.prepare('SELECT * FROM store_orders WHERE id=?').get(id), actor); return { ...g, ref };
}

// ---------- premium track (season pass) ----------
const PASS_LEVELS = 60;
G.parse.contexts.p = (n, slot) => (n >= 1 && slot >= 1 && slot <= PASS_LEVELS ? { label: `Season ${n} Premium`, type: ['banner', 'frame', 'effect', 'color', 'badge', 'title'][slot % 6] } : null);
function premiumTrack(n) { return Array.from({ length: PASS_LEVELS / 3 }, (_, i) => { const L = (i + 1) * 3; const it = G.parse(G.make('p', n, L, G.parse.contexts.p(n, L)).id);
  return { level: L, item: it && { id: it.id, type: it.type, name: it.name, rarity: it.rarity }, crowns: L % 10 === 0 ? 100 : 0 }; }); }
const hasPass = (userId, n) => !!db.prepare('SELECT 1 FROM pass_owned WHERE user_id=? AND season=?').get(userId, n);
// premium XP boost: ONLY the premium-track level (own progress). The public season board and every score are untouched.
function passState(user, t = Date.now()) {
  const SE = require('./seasons'); const sp = user ? SE.seasonProgress(user.id, t) : null; const n = SE.seasonAt(t).number; const P = prod('season-pass');
  const owned = user ? hasPass(user.id, n) : false; const boost = (P && P.data.xp_boost_pct) || 15;
  const pxp = sp ? Math.floor(sp.xp * (owned ? 1 + boost / 100 : 1)) : 0; const plevel = SE.levelOf(pxp).level;
  const claimed = new Set(user ? db.prepare('SELECT level FROM pass_claims WHERE user_id=? AND season=?').all(user.id, n).map(r => r.level) : []);
  return { season: n, price_usd_cents: P ? P.usd_cents : null, owned, xp_boost_pct: boost, premium_xp: pxp, premium_level: plevel, free_level: sp ? sp.level : 0,
    track: premiumTrack(n).map(r => ({ ...r, unlocked: owned && plevel >= r.level, claimed: claimed.has(r.level) })), next_free: user ? require('./pass-quests').status(user.id, t) : null };
}
function claimPass(user, t = Date.now()) {
  const st = passState(user, t); if (!st.owned) return { ok: false, error: 'Get the Season Pass to claim premium rewards.' };
  const got = []; db.transaction(() => { for (const r of st.track) if (r.unlocked && !r.claimed) {
    db.prepare('INSERT OR IGNORE INTO pass_claims (user_id, season, level, created_at) VALUES (?,?,?,?)').run(user.id, st.season, r.level, t);
    if (r.item) db.prepare('INSERT OR IGNORE INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)').run(user.id, r.item.id, t);
    if (r.crowns) addCrowns(user.id, r.crowns, 'pass', `S${st.season}L${r.level}`, t); got.push(r); } })();
  return { ok: true, claimed: got };
}

// ---------- spend Crowns: cosmetics only ----------
function crownPrice(it) { return Math.max(50, Math.round(((it && it.price) || 500) / 10 / 5) * 5); }
function buyWithCrowns(user, itemId, t = Date.now()) {
  const SH = require('./shop'); const it = SH.BY_ID[itemId]; if (!it) return { ok: false, error: 'Unknown item.' };
  if (it.src === 'k' || it.src === 'b' || it.src === 'p') return { ok: false, error: 'Track and earned items cannot be bought.' };
  const on = SH.inRotation(SH.rotation(t), it);
  if (!on) return { ok: false, error: 'That item is not in the shop right now.' };
  const price = crownPrice(it); return db.transaction(() => {
    if (db.prepare('SELECT 1 FROM user_items WHERE user_id=? AND item_id=?').get(user.id, it.id)) return { ok: false, error: 'You already own it.' };
    if (crowns(user.id) < price) return { ok: false, error: `You need ${price - crowns(user.id)} more Hub Crowns.` };
    addCrowns(user.id, -price, 'spend', it.id + ':' + t, t); db.prepare('INSERT INTO user_items (user_id, item_id, price, acquired_at) VALUES (?,?,0,?)').run(user.id, it.id, t);
    return { ok: true, item: it.id, price_crowns: price, crowns: crowns(user.id) }; })();
}

const NON_ADVANTAGE = 'Everything sold in the Hub Store is cosmetic. Hub Crowns, the Season Pass and Prestige items never change scores, attempts, anti-cheat checks, giveaway entries, eligibility, tie-breaks or winners. Paid and free players are ranked by exactly the same rules.';
const TERMS = '[DRAFT - FOR LAWYER REVIEW] Digital items are a limited licence to use cosmetic content in The Gaming Hub, have no cash value and cannot be exchanged for money or prizes. All sales are final once an item is delivered, except where the law requires a refund or an order was charged in error; contact Trap Tech Solutions within 14 days. Bitcoin payments are final on-chain; refunds, when granted, are sent back in BTC at the USD value of the order. You must be 21+. Prestige items are numbered and limited; their serial number is a display feature, not an investment. Trap Tech Solutions may change or retire items.';

function prestigeWall() { return Object.entries(PRESTIGE).map(([id, d]) => { const p = prod(id);
  return { id, name: p ? p.name : d.name, blurb: d.blurb, fx: d.fx, usd_cents: p ? p.usd_cents : d.usd, supply: p ? p.supply : d.supply, issued: issued(id), active: p ? !!p.active : false,
    owners: db.prepare('SELECT o.serial, u.username, o.created_at FROM prestige_owned o JOIN users u ON u.id=o.user_id WHERE o.item_id=? AND o.revoked_at IS NULL ORDER BY o.serial').all(id) }; }); }
const prestigeOf = (userId) => db.prepare('SELECT item_id, serial, created_at FROM prestige_owned WHERE user_id=? AND revoked_at IS NULL ORDER BY created_at').all(userId).map(r => ({ ...r, name: (PRESTIGE[r.item_id] || {}).name, fx: (PRESTIGE[r.item_id] || {}).fx, supply: (prod(r.item_id) || {}).supply }));

function stripeSignatureOk(req) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || '');
  const raw = req.rawBody;
  if (!secret || !Buffer.isBuffer(raw)) return false;
  const parts = String(req.headers['stripe-signature'] || '').split(',').map(x => x.split('='));
  const ts = Number((parts.find(x => x[0] === 't') || [])[1]);
  const signatures = parts.filter(x => x[0] === 'v1').map(x => x[1]).filter(Boolean);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300 || !signatures.length) return false;
  const expected = crypto.createHmac('sha256', secret).update(String(ts) + '.').update(raw).digest();
  return signatures.some(sig => { try { const got = Buffer.from(sig, 'hex'); return got.length === expected.length && crypto.timingSafeEqual(got, expected); } catch { return false; } });
}
function routes(app, A, H) {
  const { requireUser, currentUser, bad, limiter } = H;
  // Stripe sends signed, raw-body webhooks. Never grant based on a browser redirect or query parameter.
  app.post('/api/store/webhook/stripe', (req, res) => {
    if (!stripeSignatureOk(req)) return res.status(400).json({ ok: false, error: 'Invalid payment signature.' });
    const event = req.body || {}; const obj = event.data && event.data.object || {};
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      if (obj.payment_status !== 'paid' || obj.mode !== 'payment') return res.json({ received: true });
      const ref = String((obj.metadata && obj.metadata.order_ref) || obj.client_reference_id || '');
      const order = db.prepare("SELECT * FROM store_orders WHERE ref=? AND provider='stripe'").get(ref);
      if (!order || order.provider_ref !== obj.id || String(obj.metadata && obj.metadata.user_id || '') !== String(order.user_id) || Number(obj.amount_total) !== Number(order.usd_cents) || String(obj.currency || '').toLowerCase() !== 'usd') { console.warn('[payments] Signed Stripe event failed order, owner, amount, or currency matching.'); return res.json({ received: true }); }
      db.prepare("UPDATE store_orders SET status='paid', paid_at=COALESCE(paid_at,?), provider_payment_id=COALESCE(?,provider_payment_id) WHERE id=? AND granted_at IS NULL")
        .run(Date.now(), typeof obj.payment_intent === 'string' ? obj.payment_intent : null, order.id);
      const fresh = db.prepare('SELECT * FROM store_orders WHERE id=?').get(order.id);
      const result = grant(fresh, 'Stripe webhook');
      if (!result.ok) console.error('[payments] Stripe payment received but fulfillment needs review:', ref, result.error);
    } else if (event.type === 'checkout.session.expired') {
      db.prepare("UPDATE store_orders SET status='expired' WHERE provider='stripe' AND provider_ref=? AND granted_at IS NULL AND status='pending'").run(obj.id);
    } else if (event.type === 'checkout.session.async_payment_failed') {
      db.prepare("UPDATE store_orders SET status='failed', note='Stripe payment failed' WHERE provider='stripe' AND provider_ref=? AND granted_at IS NULL AND status='pending'").run(obj.id);
    } else if (event.type === 'charge.refunded') {
      const paymentId = typeof obj.payment_intent === 'string' ? obj.payment_intent : (obj.payment_intent && obj.payment_intent.id) || '';
      const order = paymentId ? db.prepare("SELECT * FROM store_orders WHERE provider='stripe' AND provider_payment_id=?").get(paymentId) : null;
      if (order && String(obj.currency || '').toLowerCase() === 'usd' && Number(obj.amount) === Number(order.usd_cents) && (obj.refunded === true || Number(obj.amount_refunded) >= Number(obj.amount))) {
        reverseEntitlements(order, 'Stripe webhook', 'full refund confirmed by Stripe');
      } else if (order) {
        db.prepare("UPDATE store_orders SET note='Partial Stripe refund received; review required' WHERE id=?").run(order.id);
      }
    }
    res.json({ received: true });
  });
  app.get('/api/store', (req, res) => { const me = currentUser(req); const st = checkoutState();
    res.json({ ok: true, currency: { name: 'Hub Crowns', short: 'Crowns' }, checkout: { enabled: st.enabled, reason: st.reason, methods: st.methods || [] },
      packs: products().filter(p => p.kind === 'pack').map(p => ({ id: p.id, name: p.name, usd_cents: p.usd_cents, crowns: p.crowns, bonus: p.bonus })),
      pass: (() => { const p = prod('season-pass'); return p && p.active ? { id: p.id, name: p.name, usd_cents: p.usd_cents, ...p.data } : null; })(),
      prestige: prestigeWall().filter(p => p.active).map(p => ({ ...p, owners: undefined, owners_count: p.owners.length })),
      crowns: me ? crowns(me.id) : null, non_advantage: NON_ADVANTAGE, terms: TERMS }); });
  app.get('/api/store/prestige', (req, res) => res.json({ ok: true, items: prestigeWall() }));
  app.get('/api/users/:u/prestige', (req, res) => { const u = db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').get(req.params.u); res.json({ ok: true, items: u ? prestigeOf(u.id) : [] }); });
  app.post('/api/store/orders', requireUser, limiter('store-order', 20, 3600e3), async (req, res) => { const b = req.body || {}; const st = checkoutState(); const provider = String(b.provider || (st.providers.bitcoin.configured ? 'bitcoin' : 'stripe')); const r = provider === 'stripe' ? await createStripeOrder(req.user, String(b.product_id || '')) : provider === 'bitcoin' ? await createOrder(req.user, String(b.product_id || '')) : { status: 400, error: 'Unsupported payment method.' }; if (!r.ok) return bad(res, r.status, r.error); if (r.order.uri) r.order.qr_svg = require('./events').qrSvg(r.order.uri); res.json(r); });
  app.get('/api/store/orders', requireUser, (req, res) => res.json({ ok: true, orders: db.prepare('SELECT * FROM store_orders WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id).map(pubOrder) }));
  const mine = (req) => db.prepare('SELECT * FROM store_orders WHERE ref=? AND user_id=?').get(String(req.params.ref), req.user.id);
  app.get('/api/store/orders/:ref', requireUser, (req, res) => { const o = mine(req); if (!o) return bad(res, 404, 'Order not found.'); const po = pubOrder(o); if (po.uri) po.qr_svg = require('./events').qrSvg(po.uri); res.json({ ok: true, order: po }); });
  app.post('/api/store/orders/:ref/check', requireUser, limiter('store-check', 30, 600e3), async (req, res) => { const o = mine(req); if (!o) return bad(res, 404, 'Order not found.');
    if (o.provider === 'stripe') return res.json({ ok: true, order: pubOrder(o), crowns: crowns(req.user.id) });
    const txid = String((req.body || {}).txid || '').trim().toLowerCase(); if (txid) { if (!/^[0-9a-f]{64}$/.test(txid)) return bad(res, 400, 'That does not look like a transaction id.'); db.prepare('UPDATE store_orders SET txid_hint=? WHERE id=?').run(txid, o.id); }
    try { await check([o]); } catch (e) { return bad(res, 503, 'Could not reach the blockchain explorer, try again shortly.'); }
    res.json({ ok: true, order: pubOrder(db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id)), crowns: crowns(req.user.id) }); });
  app.get('/api/me/crowns', requireUser, (req, res) => res.json({ ok: true, crowns: crowns(req.user.id), history: db.prepare('SELECT delta, reason, ref, created_at FROM crown_ledger WHERE user_id=? ORDER BY id DESC LIMIT 50').all(req.user.id) }));
  app.post('/api/crowns/buy', requireUser, (req, res) => { const r = buyWithCrowns(req.user, String((req.body || {}).item_id || '')); if (!r.ok) return bad(res, 400, r.error); res.json(r); });
  app.get('/api/pass', (req, res) => res.json({ ok: true, ...passState(currentUser(req)) }));
  app.get('/api/pass/quests', requireUser, (req, res) => res.json({ ok: true, ...require('./pass-quests').status(req.user.id) }));
  app.post('/api/pass/quests/claim', requireUser, (req, res) => { const r = require('./pass-quests').claim(req.user.id); if (!r.ok) return bad(res, 400, r.error); res.json(r); });
  app.post('/api/pass/claim', requireUser, (req, res) => { const r = claimPass(req.user); if (!r.ok) return bad(res, 400, r.error); res.json(r); });
  // Whop: hosted checkout + webhook (OFF until WHOP_WEBHOOK_SECRET is set; documented in HANDOFF.md)
  app.post('/api/pay/whop/webhook', (req, res) => { const sec = process.env.WHOP_WEBHOOK_SECRET; if (!sec) return res.status(404).json({ ok: false });
    const sig = String(req.headers['x-whop-signature'] || ''); const mac = crypto.createHmac('sha256', sec).update(JSON.stringify(req.body || {})).digest('hex');
    if (sig.length !== mac.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(mac))) return res.status(401).json({ ok: false });
    const ref = req.body && req.body.data && req.body.data.metadata && req.body.data.metadata.order_ref; const o = ref && db.prepare('SELECT * FROM store_orders WHERE ref=?').get(ref);
    if (o && req.body.action === 'payment.succeeded') { db.prepare("UPDATE store_orders SET provider='whop', status='paid', paid_at=? WHERE id=?").run(Date.now(), o.id); grant(o, 'whop'); }
    res.json({ ok: true }); });
  // ---- admin ----
  A.get('/store', (req, res) => res.json({ ok: true, checkout: checkoutState(), products: products(true), prestige: prestigeWall(), non_advantage: NON_ADVANTAGE, terms: TERMS,
    totals: db.prepare("SELECT product_id, COUNT(*) n, SUM(usd_cents) usd FROM store_orders WHERE status='granted' AND provider<>'manual' GROUP BY product_id").all() }));
  A.put('/store/checkout', (req, res) => { setSetting('checkout_enabled', !!(req.body && req.body.enabled)); res.json({ ok: true, checkout: checkoutState() }); });
  A.put('/store/products/:id', (req, res) => { const p = prod(req.params.id); const b = req.body || {}; const t = Date.now();
    if (!p && !['pack', 'prestige'].includes(b.kind)) return bad(res, 400, 'New products must be kind pack or prestige.');
    const name = String(b.name ?? (p && p.name) ?? '').slice(0, 80); const usd = Math.round(Number(b.usd_cents ?? (p && p.usd_cents))); if (!name || !(usd >= 99 && usd <= 2000000)) return bad(res, 400, 'Name and a price between $0.99 and $20,000 are required.');
    const data = { ...((p && p.data) || {}), ...(b.data && typeof b.data === 'object' ? b.data : {}) };
    db.prepare(`INSERT INTO store_products (id, kind, name, usd_cents, crowns, bonus, supply, data, active, sort, updated_at) VALUES (@id,@kind,@name,@usd,@crowns,@bonus,@supply,@data,@active,@sort,@t)
      ON CONFLICT(id) DO UPDATE SET name=@name, usd_cents=@usd, crowns=@crowns, bonus=@bonus, supply=@supply, data=@data, active=@active, sort=@sort, updated_at=@t`).run({ id: String(req.params.id).slice(0, 40), kind: p ? p.kind : b.kind, name, usd,
      crowns: Math.max(0, parseInt(b.crowns ?? (p && p.crowns) ?? 0, 10) || 0), bonus: Math.max(0, parseInt(b.bonus ?? (p && p.bonus) ?? 0, 10) || 0), supply: (p ? p.kind : b.kind) === 'prestige' ? Math.max(issued(req.params.id), parseInt(b.supply ?? (p && p.supply) ?? 1, 10) || 1) : null,
      data: JSON.stringify(data), active: b.active === undefined ? (p ? p.active : 1) : (b.active ? 1 : 0), sort: parseInt(b.sort ?? (p && p.sort) ?? 50, 10) || 0, t });
    res.json({ ok: true, product: prod(req.params.id) }); });
  A.get('/store/orders', (req, res) => { const st = String(req.query.status || ''); res.json({ ok: true, orders: db.prepare(`SELECT o.*, u.username FROM store_orders o LEFT JOIN users u ON u.id=o.user_id ${st ? 'WHERE o.status=?' : ''} ORDER BY o.id DESC LIMIT 500`).all(...(st ? [st] : [])).map(o => ({ ...pubOrder(o), username: o.username })) }); });
  A.post('/store/orders/:ref/verify', async (req, res) => { const o = db.prepare('SELECT * FROM store_orders WHERE ref=?').get(req.params.ref); if (!o) return bad(res, 404, 'Unknown order.');
    if (req.body && req.body.txid) db.prepare('UPDATE store_orders SET txid_hint=? WHERE id=?').run(String(req.body.txid).toLowerCase(), o.id);
    try { await check([o]); } catch (e) { return bad(res, 503, e.message); } res.json({ ok: true, order: pubOrder(db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id)) }); });
  A.post('/store/orders/:ref/grant', (req, res) => { const o = db.prepare('SELECT * FROM store_orders WHERE ref=?').get(req.params.ref); if (!o) return bad(res, 404, 'Unknown order.');
    db.prepare("UPDATE store_orders SET status='paid', paid_at=COALESCE(paid_at, ?) WHERE id=?").run(Date.now(), o.id); const g = grant(o, 'admin ' + ((req.admin && req.admin.username) || '')); res.json({ ...g, order: pubOrder(db.prepare('SELECT * FROM store_orders WHERE id=?').get(o.id)) }); });
  A.post('/store/orders/:ref/refund', (req, res) => res.json(refund(req.params.ref, (req.admin && req.admin.username) || 'admin', String((req.body || {}).note || '').slice(0, 200))));
  A.post('/store/grant', (req, res) => { const b = req.body || {}; const u = db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE').get(String(b.username || '')); if (!u) return bad(res, 404, 'No such player.');
    if (b.crowns) { addCrowns(u.id, Math.trunc(Number(b.crowns)), 'admin', 'A' + Date.now(), Date.now()); return res.json({ ok: true, crowns: crowns(u.id) }); }
    res.json(manualGrant(u.id, String(b.product_id || ''), (req.admin && req.admin.username) || 'admin', String(b.note || ''))); });
}
module.exports = { routes, checkoutState, createOrder, check, sweep, grant, refund, manualGrant, crowns, addCrowns, buyWithCrowns, passState, claimPass, hasPass, prestigeWall, prestigeOf, products, prod, NON_ADVANTAGE, TERMS, PRESTIGE, ORDER_TTL_MS, crownPrice, setSetting };

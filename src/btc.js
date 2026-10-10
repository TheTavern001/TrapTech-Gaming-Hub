'use strict';
// Bitcoin helpers for the watch-only checkout (src/monetize.js). NO private keys, ever: the server only knows the public
// receiving address BTC_ADDRESS and reads the public blockchain through a block-explorer API (mempool.space by default).
const crypto = require('crypto');
const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const sha256 = (b) => crypto.createHash('sha256').update(b).digest();
function b58decode(s) {
  let n = 0n; for (const c of s) { const i = B58.indexOf(c); if (i < 0) return null; n = n * 58n + BigInt(i); }
  let hex = n.toString(16); if (hex.length % 2) hex = '0' + hex; let bytes = n === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let lead = 0; while (lead < s.length && s[lead] === '1') lead++; return Buffer.concat([Buffer.alloc(lead), bytes]);
}
// bech32 / bech32m (BIP-173 / BIP-350)
const CH = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
function polymod(v) { const G = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]; let c = 1; for (const x of v) { const b = c >>> 25; c = ((c & 0x1ffffff) << 5) ^ x; for (let i = 0; i < 5; i++) if ((b >>> i) & 1) c ^= G[i]; } return c >>> 0; }
function hrpExpand(h) { return [...[...h].map(c => c.charCodeAt(0) >> 5), 0, ...[...h].map(c => c.charCodeAt(0) & 31)]; }
// returns { ok, type, network } or { ok:false, why }
function validateAddress(addr) {
  addr = String(addr || '').trim(); if (!addr) return { ok: false, why: 'empty' };
  if (/^(bc1|tb1|bcrt1)/i.test(addr)) {
    if (addr !== addr.toLowerCase() && addr !== addr.toUpperCase()) return { ok: false, why: 'mixed case' };
    const a = addr.toLowerCase(); const pos = a.lastIndexOf('1'); const hrp = a.slice(0, pos); const data = [...a.slice(pos + 1)].map(c => CH.indexOf(c));
    if (data.some(x => x < 0) || data.length < 6 || a.length > 90) return { ok: false, why: 'bad characters' };
    const pm = polymod([...hrpExpand(hrp), ...data]); const ver = data[0];
    if (!((ver === 0 && pm === 1) || (ver > 0 && pm === 0x2bc830a3))) return { ok: false, why: 'bad checksum' };
    return { ok: true, type: ver === 0 ? 'segwit-v0' : 'taproot', network: hrp === 'bc' ? 'mainnet' : 'testnet' };
  }
  const raw = b58decode(addr); if (!raw || raw.length !== 25) return { ok: false, why: 'bad length' };
  const body = raw.subarray(0, 21), chk = raw.subarray(21); if (!sha256(sha256(body)).subarray(0, 4).equals(chk)) return { ok: false, why: 'bad checksum' };
  const v = raw[0]; const T = { 0x00: ['p2pkh', 'mainnet'], 0x05: ['p2sh', 'mainnet'], 0x6f: ['p2pkh', 'testnet'], 0xc4: ['p2sh', 'testnet'] }[v];
  return T ? { ok: true, type: T[0], network: T[1] } : { ok: false, why: 'unknown version byte' };
}
const EXPLORER = () => (process.env.BTC_EXPLORER_URL || 'https://mempool.space/api').replace(/\/$/, '');
const PRICE_URL = () => process.env.BTC_PRICE_URL || 'https://mempool.space/api/v1/prices';
async function getJson(url, ms = 8000) { const c = new AbortController(); const t = setTimeout(() => c.abort(), ms); try { const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'GamingHub/7' } }); if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`); const ct = r.headers.get('content-type') || ''; return ct.includes('json') ? r.json() : JSON.parse(await r.text()); } finally { clearTimeout(t); } }
let priceCache = null;
async function usdPrice() { if (priceCache && Date.now() - priceCache.at < 60e3) return priceCache.usd; const j = await getJson(PRICE_URL()); const usd = Number(j.USD || (j.bitcoin && j.bitcoin.usd)); if (!(usd > 1000)) throw new Error('bad BTC price'); priceCache = { usd, at: Date.now() }; return usd; }
// incoming payments to addr: [{ txid, sats (sum of outputs to addr), confirmed, height, time }]
const incoming = (tx, addr) => ({ txid: tx.txid, sats: (tx.vout || []).filter(o => o.scriptpubkey_address === addr).reduce((s, o) => s + Number(o.value || 0), 0),
  confirmed: !!(tx.status && tx.status.confirmed), height: tx.status && tx.status.block_height || null, time: tx.status && tx.status.block_time ? tx.status.block_time * 1000 : null });
async function addressTxs(addr) { const [a, m] = await Promise.all([getJson(`${EXPLORER()}/address/${addr}/txs`), getJson(`${EXPLORER()}/address/${addr}/txs/mempool`).catch(() => [])]);
  const seen = new Map(); for (const tx of [...m, ...a]) if (!seen.has(tx.txid)) seen.set(tx.txid, incoming(tx, addr)); return [...seen.values()].filter(x => x.sats > 0); }
async function tx(txid, addr) { if (!/^[0-9a-f]{64}$/.test(txid)) return null; try { return incoming(await getJson(`${EXPLORER()}/tx/${txid}`), addr); } catch { return null; } }
async function tipHeight() { return Number(await getJson(`${EXPLORER()}/blocks/tip/height`)); }
module.exports = { validateAddress, usdPrice, addressTxs, tx, tipHeight, b58decode, EXPLORER, _resetPrice: () => { priceCache = null; } };

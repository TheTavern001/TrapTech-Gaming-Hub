'use strict';
// Password hashing that works on the 128 MB host.
// bcryptjs is pure JS: under the production `--no-opt` flag one hash takes ~1.1 s of BLOCKED event loop (vs ~70 ms with the JIT),
// which froze every other request during signups. scrypt runs natively in the libuv threadpool (async, ~30 ms, 8 MB each,
// UV_THREADPOOL_SIZE=2 caps memory at ~16 MB). Legacy bcrypt hashes still verify and are upgraded to scrypt on the next sign-in.
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const N = 8192, R = 8, P = 1, KEYLEN = 32;
const MAX_PENDING = Number(process.env.PW_MAX_PENDING || 200);
let pending = 0;
const scrypt = (pw, salt, n) => new Promise((res, rej) => crypto.scrypt(pw, salt, KEYLEN, { N: n, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? rej(e) : res(k)));
function busy() { return pending >= MAX_PENDING; }
async function hash(pw) {
  pending++;
  try { const salt = crypto.randomBytes(16); const k = await scrypt(String(pw), salt, N); return `scrypt$${N}$${salt.toString('base64')}$${k.toString('base64')}`; }
  finally { pending--; }
}
async function verify(pw, stored) {
  stored = String(stored || '');
  if (stored.startsWith('scrypt$')) {
    const [, n, s, h] = stored.split('$');
    pending++;
    try { const k = await scrypt(String(pw), Buffer.from(s, 'base64'), Number(n)); const want = Buffer.from(h, 'base64'); return want.length === k.length && crypto.timingSafeEqual(k, want); }
    catch { return false; } finally { pending--; }
  }
  if (/^\$2[aby]\$/.test(stored)) return bcrypt.compare(String(pw), stored); // legacy; chunked async, upgraded below
  return false;
}
const isLegacy = (stored) => !String(stored || '').startsWith('scrypt$');
module.exports = { hash, verify, isLegacy, busy };

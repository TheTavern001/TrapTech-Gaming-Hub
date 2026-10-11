'use strict';
// R2 contract test with a mocked S3-compatible endpoint. No Cloudflare account or real credentials required.
const crypto = require('crypto');
const nativeFetch = global.fetch;
const vars = [
  'CLOUDFLARE_R2_ACCOUNT_ID',
  'CLOUDFLARE_R2_ACCESS_KEY_ID',
  'CLOUDFLARE_R2_SECRET_ACCESS_KEY',
  'CLOUDFLARE_R2_BUCKET',
  'CLOUDFLARE_R2_PUBLIC_URL'
];
const saved = Object.fromEntries(vars.map(key => [key, process.env[key]]));
for (const key of vars) delete process.env[key];
const R2 = require('../src/r2');
let pass = 0, fail = 0;
const ok = (condition, message, extra) => {
  if (condition) { pass++; console.log('  PASS', message); }
  else { fail++; console.error('  FAIL', message, extra === undefined ? '' : String(extra).slice(0, 450)); }
};
function configure() {
  process.env.CLOUDFLARE_R2_ACCOUNT_ID = '0123456789abcdef0123456789abcdef';
  process.env.CLOUDFLARE_R2_ACCESS_KEY_ID = 'E2eAccessKey12345';
  process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY = 'test-secret-only-not-a-real-cloudflare-key-987654321';
  process.env.CLOUDFLARE_R2_BUCKET = 'hub-media-e2e';
  process.env.CLOUDFLARE_R2_PUBLIC_URL = 'https://media.example.test';
}

(async () => {
  try {
    ok(!R2.configured(), 'R2 stays disabled when credentials are absent');
    process.env.CLOUDFLARE_R2_ACCOUNT_ID = 'not-an-account-id';
    configure();
    ok(R2.configured(), 'R2 accepts complete account-scoped test configuration');
    const bytes = Buffer.from('mocked-artwork-content');
    const signed = R2._sign('PUT', 'media/art-test-123.png', bytes, 'image/png');
    ok(signed.url === 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com/hub-media-e2e/media/art-test-123.png',
      'signature builder uses the expected account endpoint and bucket key', signed.url);
    ok(/^AWS4-HMAC-SHA256 Credential=E2eAccessKey12345\//.test(signed.headers.Authorization) &&
      signed.headers.Authorization.includes('SignedHeaders=') &&
      signed.headers['x-amz-content-sha256'] === crypto.createHash('sha256').update(bytes).digest('hex'),
      'PUT authorization includes SigV4 metadata and exact payload digest');
    ok(!signed.headers.Authorization.includes(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY),
      'R2 secret key is never embedded in the authorization header');

    const calls = [];
    const objectBytes = Buffer.from('persisted-r2-object');
    global.fetch = async (url, init = {}) => {
      calls.push({ url: String(url), method: init.method, headers: init.headers, body: init.body });
      if (init.method === 'PUT') return { ok: true, status: 200 };
      if (init.method === 'GET') return {
        ok: true, status: 200,
        headers: { get: name => name.toLowerCase() === 'content-type' ? 'image/png' : null },
        arrayBuffer: async () => objectBytes.buffer.slice(objectBytes.byteOffset, objectBytes.byteOffset + objectBytes.byteLength)
      };
      return { ok: false, status: 405 };
    };

    const uploaded = await R2.put('media/art-test-123.png', bytes, 'image/png');
    ok(uploaded.ok === true && uploaded.url === 'https://media.example.test/media/art-test-123.png',
      'upload returns configured public media URL', uploaded);
    ok(calls[0] && calls[0].method === 'PUT' && Buffer.from(calls[0].body).equals(bytes),
      'upload sends the exact image bytes to R2');
    const fetched = await R2.get('media/art-test-123.png');
    ok(!!fetched && fetched.contentType === 'image/png' && fetched.body.equals(objectBytes),
      'read path retrieves the object body and content type');
    ok(calls.length === 2 && calls[1].method === 'GET' &&
      calls.every(call => call.headers && /^AWS4-HMAC-SHA256 /.test(call.headers.Authorization || '')),
      'both write and read requests carry per-request SigV4 authorization');

    delete process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    ok(!R2.configured(), 'incomplete R2 credentials fail closed');
    console.log('\nCloudflare R2 integration checks: ' + pass + ' passed, ' + fail + ' failed.');
    if (fail) process.exitCode = 1;
  } catch (error) {
    console.error('Cloudflare R2 integration test crashed:', error && error.stack || error);
    process.exitCode = 1;
  } finally {
    global.fetch = nativeFetch;
    for (const key of vars) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
})();

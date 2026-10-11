'use strict';
// Optional Cloudflare R2 object storage for uploaded Hub media. Uses S3-compatible SigV4 with Node crypto/fetch;
// no R2 secret is exposed to the browser. Without complete R2 environment values, media continues using DATA_DIR/media.
const crypto = require('crypto');

const config = () => {
  const account = String(process.env.CLOUDFLARE_R2_ACCOUNT_ID || '').trim();
  const access = String(process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '').trim();
  const secret = String(process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '');
  const bucket = String(process.env.CLOUDFLARE_R2_BUCKET || '').trim();
  const publicBase = String(process.env.CLOUDFLARE_R2_PUBLIC_URL || '').trim().replace(/\/$/, '');
  const ok = /^[a-f0-9]{32}$/i.test(account) && /^[A-Za-z0-9]{8,128}$/.test(access) && secret.length >= 32 && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket);
  return { ok, account, access, secret, bucket, publicBase: /^https:\/\//i.test(publicBase) ? publicBase : '' };
};
const configured = () => config().ok;
const sha256 = (v) => crypto.createHash('sha256').update(v).digest('hex');
const hmac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();
function uriFor(bucket, key) {
  return '/' + bucket + '/' + String(key).split('/').map(part => encodeURIComponent(part)).join('/');
}
function sign(method, key, body = Buffer.alloc(0), contentType = 'application/octet-stream') {
  const c = config(); if (!c.ok) throw new Error('R2 is not configured');
  const host = c.account + '.r2.cloudflarestorage.com';
  const uri = uriFor(c.bucket, key);
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const day = date.slice(0, 8);
  const payloadHash = sha256(body);
  const headers = { 'content-type': contentType, host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': date };
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders = 'content-type:' + contentType + '\nhost:' + host + '\nx-amz-content-sha256:' + payloadHash + '\nx-amz-date:' + date + '\n';
  const canonical = [method, uri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = day + '/auto/s3/aws4_request';
  const toSign = 'AWS4-HMAC-SHA256\n' + date + '\n' + scope + '\n' + sha256(canonical);
  const kDate = hmac('AWS4' + c.secret, day);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  headers.Authorization = 'AWS4-HMAC-SHA256 Credential=' + c.access + '/' + scope + ', SignedHeaders=' + signedHeaders + ', Signature=' + hmac(kSigning, toSign).toString('hex');
  return { url: 'https://' + host + uri, headers, publicUrl: c.publicBase ? c.publicBase + '/' + String(key).split('/').map(encodeURIComponent).join('/') : '' };
}
async function put(key, body, contentType = 'application/octet-stream') {
  const req = sign('PUT', key, body, contentType);
  const response = await fetch(req.url, { method: 'PUT', headers: req.headers, body });
  if (!response.ok) throw new Error('R2 upload failed with HTTP ' + response.status);
  return { ok: true, url: req.publicUrl || null };
}
async function get(key) {
  const req = sign('GET', key, Buffer.alloc(0), 'application/octet-stream');
  const response = await fetch(req.url, { method: 'GET', headers: req.headers });
  if (!response.ok) return null;
  return { body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get('content-type') || 'application/octet-stream' };
}
function publicUrl(key) {
  const c = config();
  return c.ok && c.publicBase ? c.publicBase + '/' + String(key).split('/').map(encodeURIComponent).join('/') : '';
}
module.exports = { configured, put, get, publicUrl, _sign: sign };

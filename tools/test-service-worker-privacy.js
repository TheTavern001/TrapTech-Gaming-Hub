#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
const origin = 'https://hub.example.test';
const listeners = {}, stored = new Map(), deleted = [];
let network;
const caches = {
  open: async () => ({addAll: async paths => {
    assert.ok(paths.every(p => p !== '/'), 'Never precache HTML with addAll');
  }, put: async (key, value) => stored.set(key.url || key, value)}),
  match: async key => stored.get(key.url || key),
  keys: async () => ['gh-shell-v9-tt-crown-20261014'],
  delete: async key => {deleted.push(key);return true;}
};
vm.runInNewContext(code, {self: {
  addEventListener: (name, fn) => listeners[name] = fn,
  skipWaiting: async () => {}, clients: {claim: async () => {}}
}, location: {origin}, URL, Response, caches, fetch: req => network(req)});
async function lifecycle(name) {
  const pending = [];listeners[name]({waitUntil: p => pending.push(p)});await Promise.all(pending);
}
async function request(route, mode = 'cors', method = 'GET') {
  let response;const pending = [];
  listeners.fetch({request: {url: new URL(route, origin).href, mode, method},
    respondWith: p => {response = p;}, waitUntil: p => pending.push(p)});
  const result = await response;await Promise.all(pending);return result;
}
(async () => {
  await lifecycle('install');await lifecycle('activate');
  assert.deepEqual(deleted, ['gh-shell-v9-tt-crown-20261014']);
  for (const route of ['/', '/games', '/me', '/signin', '/store']) {
    network = async () => new Response('private ' + route);
    assert.equal(await (await request(route, 'navigate')).text(), 'private ' + route);
    assert.equal(stored.size, 0, 'HTML must never enter persistent cache');
  }
  network = async () => {throw Error('offline');};
  const offline = await request('/me', 'navigate');
  assert.equal(offline.status, 503);
  assert.equal(offline.headers.get('cache-control'), 'no-store');
  assert.doesNotMatch(await offline.text(), /private/);
  assert.equal(await request('/api/me'), undefined);
  assert.equal(await request('/og/profile.svg'), undefined);
  assert.equal(await request('/js/app.js', 'cors', 'POST'), undefined);
  network = async () => new Response('asset');
  await request('/js/app.js');
  assert.equal(stored.size, 1);
  network = async () => {throw Error('offline');};
  assert.equal(await (await request('/js/app.js')).text(), 'asset');
  for (const directive of ['no-store', 'private']) {
    network = async () => new Response('secret', {headers: {'cache-control': directive}});
    await request('/js/secret.js');
    assert.equal(stored.size, 1);
  }
  network = async () => ({ok:true,redirected:true,headers:new Headers(),clone(){throw Error('Redirect cached');}});
  await request('/js/redirect.js');
  assert.equal(stored.size, 1);
  console.log(JSON.stringify({ok:true,noHtmlPersistence:true,oldCachePurged:true,offlineAssets:true,privateAssetsExcluded:true}));
})().catch(e => {console.error(e);process.exitCode = 1;});

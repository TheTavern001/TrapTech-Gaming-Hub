#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/monetize.js'), 'utf8');
const slice = (from, to) => {
  const a = source.indexOf(from), b = source.indexOf(to, a);
  assert.ok(a >= 0 && b > a, 'Expected production function boundaries');
  return source.slice(a, b);
};
const normalize = vm.runInNewContext(slice('function productData(p)', 'const prod =') + '\nproductData;');
for (const boost of [0, 15, 100, -10]) {
  const row = { kind: 'pass', data: JSON.stringify({ xp_boost_pct: boost, bonus_crowns_total: 600 }) };
  const original = row.data;
  assert.equal(normalize(row).xp_boost_pct, 0);
  assert.equal(normalize(row).bonus_crowns_total, 600);
  assert.equal(row.data, original, 'Do not mutate historical rows');
}
assert.equal(normalize({kind:'pack',data:'{"quantity":50}'}).quantity, 50);
const production = slice('function passState(user', 'function claimPass(') + '\npassState;';
const evaluate = (owned, xp, level, user = {id: 7}) => vm.runInNewContext(production, {
  require(name) {
    if (name === './seasons') return {
      seasonProgress: () => ({xp, level}), seasonAt: () => ({number: 1})
    };
    if (name === './pass-quests') return {status: () => ({})};
    throw Error('Unexpected dependency: ' + name);
  },
  hasPass: () => owned,
  prod: () => ({usd_cents: 999, data: {xp_boost_pct: 100}}),
  db: {prepare: () => ({all: () => []})},
  premiumTrack: () => [3, 6, 9].map(level => ({level}))
})(user);
for (const [xp, level] of [[0,0],[299,2],[300,3],[1234,8],[100000,60]]) {
  const free = evaluate(false, xp, level), paid = evaluate(true, xp, level);
  assert.equal(paid.premium_xp, free.premium_xp);
  assert.equal(paid.premium_xp, xp);
  assert.equal(paid.premium_level, free.free_level);
  assert.equal(paid.xp_boost_pct, 0);
  assert.ok(free.track.every(r => !r.unlocked));
  assert.ok(paid.track.every(r => r.unlocked === (level >= r.level)));
}
assert.equal(evaluate(false, 900, 9, null).premium_xp, 0);
console.log(JSON.stringify({ok:true,legacyBoostIgnored:true,equalProgression:true,cosmeticClaimsStillRequirePass:true}));

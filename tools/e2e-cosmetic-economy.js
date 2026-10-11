'use strict';
// Small isolated regression for the no-pay-to-win economy. No server, real payment, or external account is used.
const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hub-cosmetic-economy-'));
process.env.DB_PATH = path.join(dir, 'hub.db');
process.env.DATA_DIR = dir;
process.env.SECRET = 'test-only-secret-for-cosmetic-economy';
process.env.PAY_NO_SWEEP = '1';
try {
  const M = require('../src/monetize');
  const prices = [150, 400, 900, 2000].map(price => M.crownPrice({ price }));
  assert.deepStrictEqual(prices, [50, 100, 225, 500], 'Crown prices must follow the published cosmetic tiers');
  assert.strictEqual(M.prod('season-pass').data.xp_boost_pct, 0, 'Season Pass must not grant an XP boost');
  assert.strictEqual(M.passState(null).xp_boost_pct, 0, 'public pass state must never advertise a paid XP boost');
  assert.match(M.NON_ADVANTAGE, /does not boost XP/, 'store disclosure must explicitly rule out a paid XP boost');
  console.log('PASS cosmetic Crown price anchors: 50 / 100 / 225 / 500');
  console.log('PASS Season Pass has no XP or progression boost');
  console.log('PASS public no-advantage disclosure');
} finally {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

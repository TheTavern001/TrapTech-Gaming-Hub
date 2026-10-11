'use strict';
const assert = require('node:assert/strict');
process.env.ADMIN_PASSWORD ||= 'v1-check-password-123';
process.env.SECRET ||= 'v1-check-secret-for-tests-only';
process.env.DATA_DIR ||= '/tmp/gaming-hub-v1-checklist-test';
const G = require('../src/admin-giveaways');

const cfg = G.normalize({
  v: 7,
  entry: {
    checklist: [
      { id: 'step1', label: 'Join the official channel', url: 'https://t.me/example', required: true },
      { id: 'step2', label: 'Follow the announcement thread', url: 'javascript:alert(1)', required: false },
      ...Array.from({ length: 10 }, (_, i) => ({ id: 'extra' + i, label: 'Extra ' + i, required: true }))
    ]
  }
});
assert.equal(cfg.entry.checklist.length, 8, 'checklist must be capped at eight steps');
assert.equal(cfg.entry.checklist[0].label, 'Join the official channel');
assert.equal(cfg.entry.checklist[0].url, 'https://t.me/example');
assert.equal(cfg.entry.checklist[0].required, true);
assert.equal(cfg.entry.checklist[0].attestation, true, 'external action is explicitly self-attested');
assert.equal(cfg.entry.checklist[1].url, '', 'unsafe destinations must be removed');
assert.equal(cfg.entry.checklist[1].required, false);
console.log('V1 checklist normalization checks passed.');

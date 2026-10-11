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
assert.equal(cfg.entry.checklist[0].verify, 'external', 'external action defaults to external verification');
assert.equal(cfg.entry.checklist[1].url, '', 'unsafe destinations must be removed');
assert.equal(cfg.entry.checklist[1].required, false);
const derived = G.derive({ ...cfg, basics: { ...cfg.basics, channel_id: null, hub_wide: true }, entry: { ...cfg.entry, age21: false, require_join: false, regions_mode: 'all', max_entrants: 0 } });
assert.equal(derived.require_join, 1, 'required checklist steps must force explicit entry so server eligibility is enforced');
const fs = require('node:fs');
const read = (p) => fs.readFileSync(require('node:path').join(__dirname, '..', p), 'utf8');
const eligibilitySource = read('src/eligibility.js');
const routeSource = read('src/v5.js');
const builderSource = read('src/admin-ui/admin-builder.js');
const playerSource = read('public/js/gw-v7.js');
const avatarSource = read('public/js/avatar-3d.js');
const avatarEditor = read('public/js/avatar-editor.js');
const serverSource = read('src/server.js');
const paymentSource = read('src/monetize.js');
const storeSource = read('public/js/hub-store.js');
const mediaSource = read('src/admin-media.js');
const r2Source = read('src/r2.js');
assert.match(eligibilitySource, /function setChecklist\(/, 'server checklist persistence function must exist');
assert.match(eligibilitySource, /Required external steps cannot be self-confirmed/, 'required external actions must reject player attestation');
assert.match(eligibilitySource, /const eligible = checks\.every\(c => c\.ok\)/, 'checklist checks must participate in eligibility');
assert.match(routeSource, /\/api\/giveaways\/:id\/checklist/, 'authenticated checklist endpoint must exist');
assert.match(builderSource, /checklist-add/, 'admin builder must expose checklist controls');
assert.match(playerSource, /data-gw7-check/, 'player UI must expose interactive checklist controls');
assert.match(eligibilitySource, /verified = !!db\.prepare\('SELECT 1 FROM runs/, 'required hub-run steps must use server-recorded activity');
assert.match(eligibilitySource, /Required external steps cannot be self-confirmed/, 'required external actions must reject player attestation');
assert.match(avatarEditor, /data-gender/, 'avatar editor must expose male/female/other presentation');
assert.match(avatarSource, /presentation === 'female'/, '3D avatar geometry must respond to presentation choice');
assert.match(avatarSource, /cfg\.outfit === 'scrubs'/, '3D avatar must include career outfit details');
assert.match(serverSource, /X-Content-Type-Options/, 'security headers must be set');
assert.doesNotMatch(serverSource, /deployment_commit: process\.env\.DEPLOY_COMMIT/, 'public build endpoint must not expose deployment metadata');
assert.match(paymentSource, /function stripeSignatureOk/, 'card fulfillment must verify Stripe webhook signatures');
assert.match(paymentSource, /crypto\.timingSafeEqual/, 'webhook signature comparison must be timing-safe');
assert.match(paymentSource, /checkout\.session\.completed/, 'successful Stripe sessions must be handled server-side');
assert.match(paymentSource, /order\.provider_ref !== obj\.id/, 'Stripe event must match the stored checkout session');
assert.match(paymentSource, /Number\(obj\.amount_total\) !== Number\(order\.usd_cents\)/, 'Stripe fulfillment must confirm exact server-priced amount');
assert.match(paymentSource, /Number\(obj\.amount\) === Number\(order\.usd_cents\)/, 'Stripe refunds must match the original amount');
assert.match(storeSource, /data-provider-choice/, 'store UI must offer configured payment methods');
assert.doesNotMatch(serverSource, /identity_badge|isFounder|HUB_OWNER_USER_ID/, 'public server responses must not publish founder identity markers');
assert.match(mediaSource, /R2\.put\('media\//, 'admin media uploads must use R2 when configured');
assert.match(mediaSource, /if \(!R2\.configured\(\)\)/, 'media must retain disk fallback when R2 is not configured');
assert.match(r2Source, /AWS4-HMAC-SHA256/, 'R2 requests must use authenticated S3-compatible signatures');
assert.doesNotMatch(r2Source, /console\.log\(.*secret/i, 'R2 secrets must not be logged');
console.log('V1 checklist normalization and wiring checks passed.');

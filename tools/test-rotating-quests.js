'use strict';
// Config validates runtime secrets on import; isolated unit tests use throwaway values only.
process.env.ADMIN_PASSWORD ||= 'unit-test-admin-password-not-for-deployment';
process.env.SECRET ||= 'unit-test-secret-not-for-deployment-at-least-32-characters';
process.env.NODE_ENV = 'test';
const assert = require('node:assert/strict');
const Q = require('../src/rotating-quests');

assert.ok(Q.TEMPLATES.length >= 3000, 'quest template library contains several thousand entries');
assert.equal(new Set(Q.TEMPLATES.map(q => q.id)).size, Q.TEMPLATES.length, 'all template IDs are unique');
assert.ok(Q.TEMPLATES.every(q => Q.BY_ID.get(q.id) === q), 'every template is addressable by stable ID');
for (const q of Q.TEMPLATES.filter(x => x.objective === 'play-days')) {
  const cap = q.period === 'daily' ? 1 : q.period === 'weekly' ? 7 : 28;
  assert.ok(q.target >= 1 && q.target <= cap, q.period + ' distinct-day target is achievable within its period');
}
for (const period of Q.PERIODS) {
  const a = Q.rotation({ userId: 42, period, now: Date.UTC(2026, 9, 12, 12), count: 5, secret: 'test-only-secret-which-is-longer-than-32-characters' });
  const b = Q.rotation({ userId: 42, period, now: Date.UTC(2026, 9, 12, 12), count: 5, secret: 'test-only-secret-which-is-longer-than-32-characters' });
  assert.deepEqual(a, b, period + ' rotation remains deterministic');
  assert.equal(a.length, 5, period + ' rotation returns requested count');
  assert.ok(Q.validateRotation(a), period + ' rotation passes schema validation');
  assert.equal(new Set(a.map(q => q.id)).size, a.length, period + ' rotation has no duplicate template IDs');
}
const daily = Q.rotation({ userId: 42, period: 'daily', now: Date.UTC(2026, 9, 12, 12), count: 5, secret: 'test-only-secret-which-is-longer-than-32-characters' });
const nextDay = Q.rotation({ userId: 42, period: 'daily', now: Date.UTC(2026, 9, 13, 12), count: 5, secret: 'test-only-secret-which-is-longer-than-32-characters' });
assert.notDeepEqual(daily.map(q => q.assignment_id), nextDay.map(q => q.assignment_id), 'new period creates new assignment IDs');
assert.throws(() => Q.rotation({ userId: 1, period: 'daily', count: 5, secret: 'short' }), /secret/, 'weak secrets are rejected');
assert.throws(() => Q.rotation({ userId: 1, period: 'daily', count: 101, secret: 'test-only-secret-which-is-longer-than-32-characters' }), /size/, 'oversized rotations are rejected');
assert.equal(Q.validateRotation([{ ...daily[0], id: 'forged-id' }]), false, 'unknown template IDs are rejected');
assert.equal(Q.validateRotation([{ ...daily[0], xp: daily[0].xp + 999 }]), false, 'altered XP reward is rejected');
assert.equal(Q.validateRotation([{ ...daily[0], target: daily[0].target + 1 }]), false, 'altered target is rejected');
assert.equal(Q.validateRotation([{ ...daily[0], reward: 'premium-currency' }]), false, 'altered reward track is rejected');
assert.equal(Q.validateRotation([{ ...daily[0], assignment_id: 'a'.repeat(32) }]), false, 'fabricated assignment IDs are rejected');
assert.equal(Q.validateRotation([{ ...daily[0], period_key: '2099-99-99' }]), false, 'invalid calendar period keys are rejected');
assert.equal(Q.validateRotation([{ ...daily[0], slot: 1 }]), false, 'forged rotation slot is rejected');
assert.equal(Q.validateRotation([daily[0], { ...daily[1], user_id: 'another-user' }]), false, 'mixed-user assignments are rejected');
assert.equal(Q.validateRotation([daily[0], { ...daily[1], period_key: '2099-01-01' }]), false, 'mixed-period assignments are rejected');
console.log('Rotating quest engine checks passed:', Q.TEMPLATES.length, 'templates');

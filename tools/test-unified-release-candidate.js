#!/usr/bin/env node
'use strict';
// Cross-feature integration contract for the exact combined R2 candidate.
// This catches accidentally deploying a later feature branch that lacks the
// failed-build repair or reverting paywall/quality checks during a merge.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const docker=read('Dockerfile'),ignore=read('.dockerignore'),offline=read('tools/offline-release-rehearsal.js'),shell=read('scripts/offline-release-gate.sh');
const build=docker.split('# ---------- runtime stage ----------')[0];
const positive=require('../src/booking-fee-guard');
function before(a,b){assert.ok(build.indexOf(a)>=0&&build.indexOf(b)>build.indexOf(a),
  'Build-stage input must be available before audit: '+a+' -> '+b);}
before('COPY scripts/offline-release-gate.sh ./scripts/offline-release-gate.sh','node tools/test-r1-incident-gates.js');
before('COPY Dockerfile .dockerignore ./','node tools/test-docker-audit-context.js');
before('node tools/test-docker-audit-context.js','node tools/test-r1-incident-gates.js');
const excluded=new Set(ignore.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')));
for(const p of ['Dockerfile','.dockerignore'])assert.ok(!excluded.has(p),'Reintroduced build-context exclusion: '+p);
for(const t of ['tools/test-docker-audit-context.js','tools/test-r1-incident-gates.js',
 'tools/test-qa-frame-pacing.js','tools/test-giveaway-booking-release-gates.js',
 'tools/test-unified-release-candidate.js']){
 assert.ok(fs.statSync(path.join(root,t)).isFile(),'Missing cross-feature guard: '+t);
 assert.ok(build.includes('node '+t),'Docker stage skips '+t);
 assert.ok(offline.includes("'"+t+"'"),'Offline Node runner skips '+t);
 assert.ok(shell.includes('node '+t),'Offline shell runner skips '+t);
}
const event=read('src/events.js'),sponsor=read('src/sponsor.js');
assert.ok(event.includes("require('./booking-fee-guard').paidFeeRecorded(q)"),'Event release must check paid booking fee');
assert.ok(sponsor.includes('BOOKING_FEE.positiveFee(q)'),'Admin mark-paid must reject zero-dollar booking');
assert.ok(sponsor.includes('BOOKING_FEE.paidFeeRecorded(q)'),'Event creation must check recorded paid fee');
assert.ok(!positive.positiveFee({total_cents:0}), 'Free bookings cannot count');
assert.ok(!positive.paidFeeRecorded({status:'paid',total_cents:5000}), 'Missing payment timestamp cannot count');
assert.ok(positive.paidFeeRecorded({status:'paid',total_cents:5000,paid_at:1}),
 'Valid positive paid event must still be representable');
const qa=read('tools/qa-87-browser.js');
for(const x of ['summarizeFramePacing','QA_REQUIRE_PACING','browserFrameP95Ms',
 'browserPacingStatus','emulatedFramePacingNotHardwareCertification']){
 assert.ok(qa.includes(x),'QA runner missing mobile frame pacing contract: '+x);
}
const quality=JSON.parse(read('docs/audit/GAME-QUALITY-ACCEPTANCE.json'));
assert.equal(quality.goal,500,'Do not quietly lower 500-game public acceptance target');
assert.ok(read('docs/launch/TRAP-TECH-500-GAME-AAA-PUBLIC-ACCEPTANCE-2026-10-15.md')
 .includes('500 fully playable'),'Owner launch contract must follow the combined candidate');
console.log(JSON.stringify({pass:true,regressedDockerContext:false,bookingsRequirePositivePaidRecord:true,
  gameFramePacingWired:true,publicLaunchQualityGoal:500,fullDockerTested:false,physicalPhonesCertified:false}));

#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {summarizeFramePacing}=require('./qa-frame-pacing');
const get=a=>summarizeFramePacing(a);
let out=get(Array(120).fill(16.67));
assert.equal(out.status,'TARGET_PACING');
assert.equal(out.passed,true);assert.equal(out.samples,120);
assert.equal(out.p95Ms,16.67);
out=get(Array(120).fill(32));
assert.equal(out.status,'BASELINE_PACING');
assert.equal(out.passed,true);
out=get(Array(120).fill(40));
assert.equal(out.status,'SLOW_PACING');
assert.equal(out.passed,false);
out=get(Array(120).fill(16.67).map((n,i)=>i<12?80:n));
assert.ok(out.p95Ms>=80,'Long-tail jank must affect the p95 classification');
assert.equal(out.passed,false);
out=get(Array(24).fill(16.67));
assert.equal(out.status,'INSUFFICIENT_SAMPLES');
assert.equal(out.measured,false);assert.equal(out.passed,false);
assert.equal(out.p95Ms,null);
out=get([NaN,Infinity,-1,0,undefined,...Array(80).fill(16.67)]);
assert.equal(out.samples,80,'Invalid timestamps must not count as samples');
const runner=fs.readFileSync(path.join(__dirname,'qa-87-browser.js'),'utf8');
for(const marker of ['summarizeFramePacing','QA_REQUIRE_PACING','browserFrameP95Ms',
 'browserPacingStatus','requestAnimationFrame','STRICT_PACING && !pacing.passed',
 'emulatedFramePacingNotHardwareCertification']){
 assert.ok(runner.includes(marker),'Runner missing frame-pacing integration: '+marker);
}
const docker=fs.readFileSync(path.join(__dirname,'../Dockerfile'),'utf8');
assert.ok(docker.includes('node tools/test-qa-frame-pacing.js'),
 'Build-stage must execute the frame-pacing regression test');
const shell=fs.readFileSync(path.join(__dirname,'../scripts/offline-release-gate.sh'),'utf8');
assert.ok(shell.includes('node tools/test-qa-frame-pacing.js'));
const offline=fs.readFileSync(path.join(__dirname,'offline-release-rehearsal.js'),'utf8');
assert.ok(offline.includes("'tools/test-qa-frame-pacing.js'"));
console.log(JSON.stringify({pass:true,good60fps:true,good30fps:true,slowFramesRejected:true,
 insufficientFramesRejected:true,invalidSamplesRejected:true,allGamesInstrumented:true,
 physicalDeviceCertified:false}));

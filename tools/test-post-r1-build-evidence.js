#!/usr/bin/env node
'use strict';
// Release integrity: no FAILED or non-current READY candidates can be promoted
// by assumption. An unresolved build stays unresolved until log+regression proof.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const state=read('docs/audit/DEPLEXO-AUTO-DEPLOY-STATE-20261015.json');
const evidence=read('docs/audit/POST-R1-FAILED-DEPLOYMENTS-20261015.json');
const fullSha=s=>typeof s==='string'&&/^[a-f0-9]{40}$/i.test(s);
assert.equal(state.ownerCurrentReportedState,'OFF','Do not confuse prior ON with owner-confirmed OFF');
assert.equal(state.priorOwnerReportedState,'ON','Do not erase historical host configuration');
assert.ok(fullSha(evidence.readyObserved.commit));
assert.equal(evidence.readyObserved.status,'READY');
assert.equal(evidence.readyObserved.currentBadgeVisible,false,'Do not invent CURRENT from READY');
assert.ok(evidence.failed.length>=6,'All six owner-observed failed builds must be recorded');
const seen=new Set();
for(const failure of evidence.failed){
 assert.ok(fullSha(failure.commit),'All failed deployments require full commit SHA');
 assert.ok(!seen.has(failure.commit),'Duplicate failure '+failure.commit);
 seen.add(failure.commit);
 assert.equal(failure.status,'FAILED');
 assert.notEqual(failure.commit,evidence.readyObserved.commit);
 if(failure.verifiedFixed){
  assert.ok(failure.confirmedRootCause?.length>=30,'Root cause required before FIXED');
  assert.ok(fullSha(failure.fixCommit),'Source fix commit required before FIXED');
  assert.ok(failure.nativeTestPassed===true && failure.dockerTestPassed===true,
   'Native and Docker proof required before FIXED');
 }else{
  assert.equal(failure.releaseEligible,false,'Unrepaired deployment cannot be eligible');
 }
}
assert.equal(evidence.correctiveState,'RELEASE_FROZEN_OFFLINE_REPAIR');
console.log(JSON.stringify({pass:true,knownPostR1Failures:evidence.failed.length,
 knownFixed:evidence.failed.filter(x=>x.verifiedFixed).length,
 ownerReportedAutoDeploy:'OFF',fullDockerVerified:false,hostCurrentVerified:false}));

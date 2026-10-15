#!/usr/bin/env node
'use strict';
// Keep all previously observed R1 Docker failures fixed, not merely logged.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const contract=JSON.parse(read('docs/audit/R1-INCIDENT-REGRESSION-CONTRACT.json'));
const journal=JSON.parse(read('docs/audit/DEPLOYMENT-JOURNAL.json'));
const docker=read('Dockerfile'),offline=read('tools/offline-release-rehearsal.js'),shell=read('scripts/offline-release-gate.sh');
const requiredShas=['570a9feba0f17aa1de120c67b57f3a8a6c0f5930','656074076ea4240e450452aa658ccf2697a54a58','d455ac26395904cdc1cd9f388a86c4db929cb6a4','a6afa9cff3190399c939bbaee054267b7068a9f4','53efd4b15c9cd61dbe583637b9a00dd9ea34f2cc','c587456628e34b89aa65e83a44be66d5b9f09adf','61fec41636ea418c71765a21f7f6d3dd224bd22a'];
assert.ok(contract.incidents.length>=7,'Historical incidents cannot disappear');
const found=new Set(contract.incidents.map(x=>x.failedSha));
for(const sha of requiredShas)assert.ok(found.has(sha),'Lost known R1 failed build '+sha);
const tests=new Set();
for(const issue of [...contract.incidents,...contract.additionalRegressions]){
 assert.ok(issue.rootCause.length>=30,'Root cause missing for '+issue.id);
 assert.ok(issue.requiredTests.length>0,'Unfixed issue without regression: '+issue.id);
 for(const f of issue.requiredTests){
  assert.ok(f.startsWith('tools/')&&f.endsWith('.js'),'Bad test path '+f);
  assert.ok(fs.statSync(path.join(root,f)).isFile(),'Regression test missing '+f);
  assert.ok(docker.includes('node '+f),'Docker skipped '+f);
  assert.ok(offline.includes("'"+f+"'"),'Node offline skipped '+f);
  assert.ok(shell.includes('node '+f),'Shell offline skipped '+f);
  tests.add(f);
 }
}
assert.ok(docker.includes('node tools/test-r1-incident-gates.js'));
assert.ok(offline.includes("'tools/test-r1-incident-gates.js'"));
assert.ok(shell.includes('node tools/test-r1-incident-gates.js'));
// Historic R1 READY never disappears, but a verified later deployment may become CURRENT.
function validateCurrentHost(evidence){
 const historic=evidence.releaseHistory.find(x=>x.commit===contract.r1HostReadyFromOwnerScreenshot);
 assert.ok(historic&&historic.status==='READY','Historic R1 READY evidence must remain intact');
 const selected=evidence.releaseHistory.filter(x=>x.observedAsCurrent);
 assert.equal(selected.length,1,'Exactly one host deployment may be CURRENT');
 assert.equal(selected[0].status,'READY','FAILED builds cannot be CURRENT');
 assert.equal(selected[0].commit,evidence.latestOwnerObservedHost.currentReadySha,
  'CURRENT must match owner-observed host evidence, not a static historical SHA');
 return selected[0];
}
const hostCurrent=validateCurrentHost(journal);
const futureSha='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
// Executed positive/negative fixture: a future READY may supersede R1, but
// failed or mismatched host claims must never pass.
const transition={
 ...journal,
 latestOwnerObservedHost:{...journal.latestOwnerObservedHost,currentReadySha:futureSha},
 releaseHistory:[...journal.releaseHistory.map(x=>({...x,observedAsCurrent:false})),
  {commit:futureSha,status:'READY',observedAsCurrent:true}]
};
assert.equal(validateCurrentHost(transition).commit,futureSha,
 'Future READY transition must work, not require hardcoded 5fb461c forever');
assert.throws(()=>validateCurrentHost({...transition,releaseHistory:transition.releaseHistory.map(x=>
 x.commit===futureSha?{...x,status:'FAILED'}:x)}),/FAILED builds cannot be CURRENT/);
assert.throws(()=>validateCurrentHost({...transition,
 latestOwnerObservedHost:{...transition.latestOwnerObservedHost,currentReadySha:contract.r1HostReadyFromOwnerScreenshot}}),
 /CURRENT must match/);
const evidenceForSource=journal.releaseHistory.some(x=>x.observedAsCurrent &&
 x.status==='READY' && x.commit===journal.currentWorkingSource.headAtReconciliation);
const expectedSourceStatus=evidenceForSource
 ? 'HOST_READY_OWNER_SCREENSHOT_CONFIRMED':'SOURCE_ONLY_NOT_DEPLOYED';
assert.equal(journal.currentWorkingSource.sourceStatus,expectedSourceStatus,
 'Derive source status from host evidence so future genuine READY releases can pass');
if(!evidenceForSource)assert.ok(!journal.releaseHistory.some(
 x=>x.commit===journal.currentWorkingSource.headAtReconciliation),
 'Unreleased staging work may not be reported as deployed');
assert.equal(hostCurrent.commit,journal.latestOwnerObservedHost.currentReadySha);
assert.equal(journal.publicLaunchApproved,false);
console.log(JSON.stringify({pass:true,knownFailedBuilds:contract.incidents.length,additionalRegressionFamilies:2,protectedExecutableTests:tests.size,
  historicR1ReadyRetained:true,currentHostSha:hostCurrent.commit,futureReadyTransitionValidated:true,
  fullStagedDockerTested:false,physicalPhoneAAAApproved:false}));

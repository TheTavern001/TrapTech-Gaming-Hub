#!/usr/bin/env node
'use strict';
// Host evidence is recorded ONLY when the owner supplies a Deplexo screenshot,
// log or verified live response. GitHub commits must not be promoted to READY.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/DEPLOYMENT-JOURNAL.json'),'utf8'));
const hist=ledger.releaseHistory;
const screenshots=JSON.parse(fs.readFileSync(path.join(root,
 'docs/audit/DEPLEXO-OWNER-SCREENSHOT-EVIDENCE-2026-10-14.json'),'utf8'));
const lastScreenshot=screenshots.screenshots.at(-1);
assert.equal(screenshots.lastKnownHostCurrent,ledger.latestOwnerObservedHost.currentReadySha);
assert.match(lastScreenshot.sha256,/^[a-f0-9]{64}$/i);
assert.equal(lastScreenshot.binaryCopiedToGitHub,false,'Only metadata is stored, not falsely claim screenshot bytes');
assert.equal(lastScreenshot.observedClaims.filter(x=>x.current).length,1);

const sha=s=>/^[a-f0-9]{40}$/i.test(s||'');
const ids=new Set();
for(const x of hist){
  assert.ok(sha(x.commit),'Deployment evidence must use full Git commit SHA: '+x.commit);
  assert.ok(!ids.has(x.commit),'Duplicate host deployment record: '+x.commit);
  ids.add(x.commit);
  assert.ok(['READY','FAILED','BUILDING_OBSERVED','UNKNOWN'].includes(x.status));
  assert.ok(typeof x.evidence==='string'&&x.evidence.length>20,'Host evidence missing: '+x.commit);
}
const current=hist.filter(x=>x.observedAsCurrent);
assert.equal(current.length,1,'Only one latest screenshot-confirmed CURRENT Deplexo deployment');
assert.equal(current[0].status,'READY');
assert.equal(current[0].commit,ledger.latestOwnerObservedHost.currentReadySha);
assert.ok(current[0].evidence.includes('screenshot'));
assert.ok(sha(ledger.currentWorkingSource.headAtReconciliation));
assert.equal(ledger.currentWorkingSource.sourceStatus,'SOURCE_ONLY_NOT_DEPLOYED');
assert.ok(!ids.has(ledger.currentWorkingSource.headAtReconciliation),
 'GitHub source-only SHA must never be misreported as a Deplexo host deployment');
const run=cp.spawnSync(process.execPath,[path.join(root,'tools/release-status.js')],{cwd:root,encoding:'utf8',timeout:15000});
assert.equal(run.status,0,'Release status validator failed: '+run.stderr+'\n'+run.stdout);
const report=JSON.parse(run.stdout);
assert.equal(report.hostCurrent.sha,current[0].commit);
assert.equal(report.ownerScreenshotEvidence.screenshotSHA256,lastScreenshot.sha256);
assert.equal(report.ownerScreenshotEvidence.binaryRetainedInGitHub,false);
for(const screenshotCard of lastScreenshot.observedClaims) {
 const record=hist.find(x=>x.commit===screenshotCard.gitCommit);
 assert.ok(record,'Missing screenshot-confirmed deployment '+screenshotCard.short);
 assert.equal(record.status,screenshotCard.hostStatus);
 assert.equal(record.buildDurationSeconds,screenshotCard.durationSeconds);
 assert.equal(record.observedAsCurrent===true,screenshotCard.current);
}
assert.equal(report.hostCurrent.status,'READY');
assert.equal(report.workingSource.status,'SOURCE_ONLY_NOT_DEPLOYED');
// Latest failed R1 candidate is NOT the last screenshot-confirmed CURRENT host.
const failures=ledger.reportedFailedDeployments20261015||[];
assert.ok(failures.length,'Owner-supplied R1 failure evidence must be retained');
for(const failed of failures){
 assert.ok(sha(failed.commit),'Build failures need exact Git SHA');
 assert.equal(failed.status,'FAILED','Failed candidates cannot be treated as READY');
 assert.notEqual(failed.commit,current[0].commit,'Cannot mark failed candidate as screenshot-current host');
}
assert.equal(report.latestR1Build.sha,ledger.lastReportedFailedDeployment20261015.commit);
assert.equal(report.latestR1Build.status,'FAILED');
assert.equal(report.automaticDeploymentOwnerConfirmedOn,ledger.autoDeployOwnerConfirmedOn===true);
assert.equal(report.automaticDeploymentOwnerConfirmedOff,ledger.ownerConfirmedAutoDeployOff===true);
assert.ok(!(report.automaticDeploymentOwnerConfirmedOn&&report.automaticDeploymentOwnerConfirmedOff),'Current auto-deploy state cannot be both ON and OFF');
assert.equal(report.workingSource.shaFromLastReconciliation,ledger.currentWorkingSource.headAtReconciliation);
assert.equal(report.historicalRegisteredGames,report.activeCoreGames+report.registeredLibraryGames);
assert.equal(report.totalPlayableGames,report.activeCoreGames+report.playableLibraryGames);
assert.equal(report.archivedLibraryGames,report.registeredLibraryGames-report.playableLibraryGames);
assert.equal(report.remainingTo500,Math.max(0,500-report.totalPlayableGames));
assert.equal(report.publicLaunchApproved,false);
console.log(JSON.stringify({pass:true,hostCurrent:current[0].commit,sourceOnly:ledger.currentWorkingSource.headAtReconciliation,
  historicalRegistered:report.historicalRegisteredGames,playable:report.totalPlayableGames,
  releaseHistoryRows:hist.length,validation:'Owner host evidence vs GitHub source separated; no Deplexo API call'}));

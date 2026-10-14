#!/usr/bin/env node
'use strict';
// Read-only owner release scorecard. Code and a READY host are NOT approvals.
// Returns status 0 for reporting; --require-ready fails closed for release.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const board=read('docs/audit/FIVE-RELEASE-FULL-HUB-WORKBOARD.json');
const quality=read('docs/audit/GAME-QUALITY-ACCEPTANCE.json');
const security=read('docs/audit/SECURITY-MOBILE-CREDITS-RELEASE-GATES-2026-10-14.json');
const catalog=read('docs/audit/ALL-93-OWNER-GAMEPLAY-DISTINCTNESS-2026-10-14.json');
const history=read('docs/audit/DEPLOYMENT-JOURNAL.json');
const order=['R1','R2','R3','R4','R5'];
const descriptions={
 R1:'Retest and consolidate existing gameplay; fix scoring and reference fidelity',
 R2:'Integrate real licensed art/models/audio into actual games with mobile performance',
 R3:'Polish the Hub, shared avatar, one Credits wallet, shop, cosmetics, quests and achievements',
 R4:'Independently test phone performance, server trust boundaries, anti-cheat, payment/refunds and data protection',
 R5:'End-to-end private test, owner approval and one controlled production deployment'
};
const approved=w=>w.status==='OWNER_APPROVED'&&w.ownerApproved===true&&
  Array.isArray(w.evidence)&&w.evidence.length>=2;
const verified=g=>g.status==='VERIFIED'&&g.ownerApproved===true&&g.preDeploymentVerified===true;
const releases=order.map(id=>{
 const stream=board.workstreams.filter(w=>w.release===id);
 const sec=security.gates.filter(g=>g.release===id);
 return {id,objective:descriptions[id],streams:stream.length,approvedStreams:stream.filter(approved).length,
   pending:stream.filter(w=>!approved(w)).map(w=>({id:w.id,status:w.status})),
   requiredSecurityGates:sec.length,verifiedSecurityGates:sec.filter(verified).length,
   readiness:stream.every(approved)&&sec.every(verified)?'SOURCE_WORKSTREAM_EVIDENCE_COMPLETE':'BLOCKED'};
});
const measuredApprovals=(quality.records||[]).filter(g=>g.status==='APPROVED'&&g.ownerApproved===true).length;
const historical=catalog.allCurrentRegistrations,proposed=catalog.activeProposed,archived=catalog.archiveHistoryPreserved;
const accepted500=Math.min(500,measuredApprovals);
if(proposed+archived!==historical)throw Error('Game inventory mismatch');
if(board.currentHistoricalRegistered!==historical || board.proposedActivePlayable!==proposed)
  throw Error('Board and canonical owner QA game count drift');
if(security.totalGates!==security.gates.length)throw Error('Security gate list drift');
if(catalog.qualityCertified!==0&&catalog.qualityCertified!==measuredApprovals)
  throw Error('Game QA owner acceptance ledger drift');
const problems=[];
if(!releases.every(r=>r.readiness!=='BLOCKED'))problems.push('R1–R5 workstream or security gates incomplete');
if(measuredApprovals!==proposed)problems.push('Every existing active game requires individual signed-off phone+visual+score QA');
if(accepted500<500)problems.push('Only accepted distinct certified titles count toward 500');
if(board.productionUntouched!==true||board.ownerConfirmedAutoDeployOff!==true)
  problems.push('Operator must reconfirm staging/automatic deployment state');
const result={
 status:problems.length?'BLOCKED':'REQUIRES_FINAL_HUMAN_CONFIRMATION',
 observedAtUTC:new Date().toISOString(),measurement:'EVIDENCE_ACCEPTANCE_NOT_CODE_COMPLETENESS',
 lastOwnerScreenshotCurrent:history.latestOwnerObservedHost?.currentReadySha||null,
 developmentBranch:board.sourceQaBranch,sourceIsConfirmedLive:board.currentDevelopmentIsLive===true,
 autoDeployOwnerPreviouslyConfirmedOff:board.ownerConfirmedAutoDeployOff===true,
 historicalRegistered:historical,proposedPlayable:proposed,archived,
 approvedOnSourceLedger:catalog.qualityCertified,
 individuallyOwnerApprovedMeasured:measuredApprovals,
 gapTo500DistinctApproved:500-accepted500,
 existingGamesUnapproved:Math.max(0,proposed-measuredApprovals),
 workstreams:{total:board.workstreams.length,approved:board.workstreams.filter(approved).length},
 securityGates:{total:security.gates.length,verified:security.gates.filter(verified).length},
 releaseStages:releases,problems,
 recommendation:problems.length?
  'KEEP AUTO DEPLOY OFF. Finish staged R1–R5, run full native build/STEP12 and real Android+iPhone QA before private acceptance; only then intake new games in owner-approved batches and publicly release once 500 qualify.':
  'Manual owner release decision; no automatic production promotion.'
};
console.log(JSON.stringify(result,null,2));
if(process.argv.includes('--require-ready')&&problems.length)process.exitCode=1;

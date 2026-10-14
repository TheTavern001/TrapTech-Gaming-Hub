#!/usr/bin/env node
'use strict';
// Read-only operator gate: do NOT turn Deplexo auto deploy back on while this
// says BLOCKED. Checks evidence, not GitHub commits or host image READY alone.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const j=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const board=j('docs/audit/FIVE-RELEASE-FULL-HUB-WORKBOARD.json');
const quality=j('docs/audit/GAME-QUALITY-ACCEPTANCE.json');
const queue=j('docs/audit/POST-OVERHAUL-GAME-CANDIDATES-2026-10-13.json');
const requirements=['R1','R2','R3','R4','R5'];
const release=String(process.argv.find(a=>a.startsWith('--release='))||'--release=R1').split('=')[1].toUpperCase();
const publicIntent=process.argv.includes('--public');
if(!requirements.includes(release)){console.error('Unknown release gate '+release);process.exit(2);}
function inspect({workstreams,baselineCertified,publicQualified}){
 const stages=requirements.slice(0,requirements.indexOf(release)+1),blockers=[];
 for(const w of workstreams){
  if(!stages.includes(w.release))continue;
  if(w.status!=='OWNER_APPROVED'||w.ownerApproved!==true||!Array.isArray(w.evidence)||w.evidence.length<2)
   blockers.push(w.id+': '+w.status+'; missing device/source/owner acceptance');
 }
 if(release==='R5'&&baselineCertified!==87)
  blockers.push('Existing 87 playable games must be independently approved before the private final candidate (now '+baselineCertified+')');
 if(publicIntent){
  if(release!=='R5')blockers.push('Public release is permitted only after R5');
  if(!publicQualified)blockers.push('500-game quality intake and public security checks are not verified');
 }
 return blockers;
}
const baselineCertified=(quality.records||[]).filter(r=>r.status==='APPROVED').length; // provisional only; actual checked below
const blockers=inspect({workstreams:board.workstreams,baselineCertified,publicQualified:false});
// We require the dedicated exact source + metadata quality-readiness gate on
// release; this reporter intentionally fails closed instead of counting mere
// APPROVED strings as independently certified.
if(release==='R5'||publicIntent){
 blockers.push('Required: node tools/quality-readiness.js '+(publicIntent?'--require-500':'--require-baseline')+
   ' and full signed owner UAT. Manual execution needed; no implicit approval');
}
const output={result:blockers.length?'BLOCKED':'ELIGIBLE_FOR_MANUAL_REVIEW',
 release,publicIntent,automaticDeploymentMustRemainOff:true,
 currentRegistered:board.currentHistoricalRegistered,proposedPlayable:board.proposedActivePlayable,
 approvedFromBoard:board.individuallyQualityApproved,gameCandidatesUnapproved:queue.candidates.length,
 blockers};
console.log(JSON.stringify(output,null,2));
if(process.argv.includes('--require-ready')&&blockers.length)process.exitCode=1;

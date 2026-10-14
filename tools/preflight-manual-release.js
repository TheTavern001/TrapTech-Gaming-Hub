#!/usr/bin/env node
'use strict';
// Read-only operator gate: do NOT turn Deplexo auto deploy back on while this
// says BLOCKED. Checks evidence, not GitHub commits or host image READY alone.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
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
 if(release==='R5'&&baselineCertified!==board.proposedActivePlayable)
  blockers.push('Existing '+board.proposedActivePlayable+' playable games must be independently approved before the private final candidate (now '+baselineCertified+')');
 if(publicIntent){
  if(release!=='R5')blockers.push('Public release is permitted only after R5');
  if(!publicQualified)blockers.push('500-game quality intake and public security checks are not verified');
 }
 return blockers;
}
// Source and evidence quality-readiness must really execute; a text status
// alone cannot qualify a game. This check does NOT access Deplexo or deploy.
const qualityResult=(release==='R5'||publicIntent)
 ? cp.spawnSync(process.execPath,[path.join(root,'tools/quality-readiness.js'),
     publicIntent?'--require-500':'--require-baseline'],{cwd:root,encoding:'utf8',timeout:30000})
 : null;
let certified=0;
if(qualityResult){try{certified=JSON.parse(qualityResult.stdout).qualityApproved||0}catch{}}
const baselineCertified=qualityResult?certified:(quality.records||[]).filter(r=>r.status==='APPROVED').length;
const blockers=inspect({workstreams:board.workstreams,baselineCertified,
 publicQualified:!!qualityResult&&qualityResult.status===0});
if(qualityResult&&qualityResult.status!==0)
 blockers.push('Source evidence quality-readiness '+(publicIntent?'--require-500':'--require-baseline')+
   ' failed (exit '+qualityResult.status+'); verify all per-title source/device/score/licensing approvals');
const output={result:blockers.length?'BLOCKED':'ELIGIBLE_FOR_MANUAL_REVIEW',
 release,publicIntent,automaticDeploymentMustRemainOff:true,
 currentRegistered:board.currentHistoricalRegistered,proposedPlayable:board.proposedActivePlayable,
 approvedFromBoard:board.individuallyQualityApproved,gameCandidatesUnapproved:queue.candidates.length,
 blockers};
console.log(JSON.stringify(output,null,2));
if(process.argv.includes('--require-ready')&&blockers.length)process.exitCode=1;

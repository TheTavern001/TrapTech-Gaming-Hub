#!/usr/bin/env node
'use strict';
// Read-only blocking public release certificate. Private testing builds
// remain possible; no live accounts or remote host are modified.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');
const file=path.join(root,'docs/audit/PUBLIC-LAUNCH-SIGNOFF.json');
const signoff=JSON.parse(fs.readFileSync(file,'utf8'));
const checks=signoff.required||{},errors=[];
for(const [name,check] of Object.entries(checks)){
  if(!check||check.pass!==true||typeof check.evidence!=='string'||check.evidence.length<10){
    errors.push(name+': missing documented PASS'); continue;
  }
  const evidence=check.evidence.trim();
  if(evidence.startsWith('docs/audit/')&&!evidence.includes('..')){
    if(!fs.existsSync(path.join(root,evidence)))errors.push(name+': evidence file missing');
  }else if(!/^https:\/\//.test(evidence))errors.push(name+': unsupported evidence reference');
}
const approvals=cp.spawnSync(process.execPath,[path.join(root,'tools/quality-readiness.js'),'--require-baseline','--require-500'],{encoding:'utf8',timeout:45000});
if(approvals.status!==0)errors.push('Game quality certification: 500 individual passes not verified');
if(signoff.publicLaunchApproved!==true)errors.push('Public launch has no final owner release approval');
console.log(JSON.stringify({stage:'PUBLIC_LAUNCH',approved:errors.length===0,registeredChecks:Object.keys(checks).length,blockers:errors},null,2));
if(errors.length)process.exitCode=1;

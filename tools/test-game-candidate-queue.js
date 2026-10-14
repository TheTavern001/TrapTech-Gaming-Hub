#!/usr/bin/env node
'use strict';
// Candidate research is not part of the playable/quality-approved total.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const queue=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/POST-OVERHAUL-GAME-CANDIDATES-2026-10-13.json'),'utf8'));
const {games}=require('../src/games-lib');
const core=fs.readFileSync(path.join(root,'src/config.js'),'utf8');
assert.equal(queue.status,'RESEARCH_ONLY_NO_REPO_IMPORTS');
assert.equal(queue.approvedForAdmission,0);
assert.equal(queue.addedToCatalog,0);
assert.ok(queue.candidates.length>=5);
const currentIds=new Set([...games.map(g=>g.id), ...[...core.matchAll(/\{\s*id:\s*'([^']+)'/g)].map(m=>m[1])]);
const ids=new Set(),families=new Set();
for(const c of queue.candidates){
  assert.equal(c.decision,'RESEARCH_ONLY','Do not count unreviewed game candidates');
  assert.equal(c.ownerApproved,false);
  assert.equal(c.offlinePackaged,false);
  assert.equal(c.serverScoreReplayQA,false);
  assert.equal(c.androidPerformanceQA,false);
  assert.equal(c.assetsDownloaded,false);
  assert.equal(c.licenseVerifiedForAllMedia,false);
  assert.ok(!currentIds.has(c.id),'Duplicate registered ID '+c.id);
  assert.ok(!ids.has(c.id),'Duplicate candidate ID '+c.id);ids.add(c.id);
  assert.ok(!families.has(c.mechanicsFamily),'Candidate mechanic repeated '+c.mechanicsFamily);families.add(c.mechanicsFamily);
  assert.match(c.upstream,/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/);
  assert.ok(['MIT','Apache-2.0','BSD-3-Clause','CC0-1.0'].includes(c.license));
  assert.equal(c.endlessMode,'NOT_YET','Do not pretend a finite game is giveaway-ready');
  assert.equal(c.mobileQa,'NOT_RUN');
  assert.ok(c.needed.length>=3 && c.qualityRisk.length>=25);
}
console.log(JSON.stringify({pass:true,candidates:queue.candidates.length,admitted:0,uniqueMechanics:families.size,
 source:'research only; no imports, gameplay, rights-media or anti-cheat certification'}));

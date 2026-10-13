#!/usr/bin/env node
'use strict';
// Fail closed if an HTML-linked JS dependency vanishes from the build context.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),current=path.join(ROOT,'docs/audit/game-source-mechanics.json');
const baseline=JSON.parse(fs.readFileSync(current,'utf8'));
// The immutable 93-title baseline is the minimum, never a maximum. New
// registered games must immediately appear in the report and retain the
// exact same missing-script negative test.
const frozen=require('../docs/audit/GAME-INTAKE-BASELINE.json');
const registered=require('../src/games-lib').games;
const slugs=new Set(registered.map(g=>g.slug));
assert.equal(slugs.size,registered.length,'Duplicate registered library slugs');
for(const slug of frozen.baselineLibrarySlugs)
 assert.ok(slugs.has(slug),'Frozen baseline title silently disappeared: '+slug);
assert.equal(baseline.core,frozen.activeCoreIds.length,'Core baseline drift');
assert.equal(baseline.library,registered.length,'Scanner must include every registered library game');
assert.equal(baseline.registered,baseline.core+baseline.library,'Missing or extra scan records');
assert.ok(baseline.registered>=frozen.activeCoreIds.length+frozen.baselineLibrarySlugs.length,
  'Catalog must not shrink the 93-title baseline');
assert.equal(baseline.games.length,baseline.registered,'Each registered title needs a source record');
const auditedIds=new Set(baseline.games.map(g=>g.id));
assert.equal(auditedIds.size,baseline.registered,'Duplicate scan IDs');
for(const id of frozen.activeCoreIds)assert.ok(auditedIds.has('core:'+id),'Core scan missing '+id);
for(const game of registered)assert.ok(auditedIds.has('library:'+game.slug),
  'New library game lacks a source-audit record: '+game.slug);
assert.equal(baseline.qualityApproved,0,'Static audits do not certify games');
assert.deepEqual(baseline.errors,[],'No executable source may be missing');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'hub-audit-negative-'));
try {
 const target='public/games-lib/bud-merge/js/game_manager.js';
 const report=path.join(tmp,'missing.json');
 const child=cp.spawnSync(process.execPath,[path.join(__dirname,'game-source-mechanics.js')],{
   cwd:ROOT,encoding:'utf8',timeout:20000,
   env:{...process.env,GAME_SOURCE_AUDIT_SIMULATE_MISSING:target,GAME_SOURCE_AUDIT_REPORT:report}
 });
 assert.equal(child.status,1,'Missing HTML dependency must fail the scanner');
 const simulated=JSON.parse(fs.readFileSync(report,'utf8'));
 assert.ok(simulated.errors.some(e=>e.includes('missing HTML script')&&e.includes(target)),
   'Exact missing dependency must be reported, not dropped silently');
 console.log(JSON.stringify({ok:true,registered:baseline.registered,negativeTest:target,
   missingDependencyRejected:true,artDefects:baseline.missingArtwork?.length||0}));
} finally {fs.rmSync(tmp,{recursive:true,force:true});}

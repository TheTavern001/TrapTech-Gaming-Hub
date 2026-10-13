#!/usr/bin/env node
'use strict';
// Fail closed if an HTML-linked JS dependency vanishes from the build context.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const ROOT=path.resolve(__dirname,'..'),current=path.join(ROOT,'docs/audit/game-source-mechanics.json');
const baseline=JSON.parse(fs.readFileSync(current,'utf8'));
assert.equal(baseline.registered,93,'Expected the frozen 93-title baseline');
assert.equal(baseline.core,13);assert.equal(baseline.library,80);
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

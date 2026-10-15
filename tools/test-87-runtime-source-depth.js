#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const report=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/ALL-GAME-MECHANICS-SOURCE-LEDGER.json'),'utf8'));
const owner=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/ALL-93-OWNER-GAMEPLAY-DISTINCTNESS-2026-10-14.json'),'utf8'));
assert.equal(report.historicalRegistered,93);
assert.equal(report.proposedPlayable,87);
assert.equal(report.ownerArchivedDuplicates,6);
assert.equal(report.games.length,93);
assert.equal(new Set(report.games.map(g=>g.id)).size,93);
assert.deepEqual(new Set(report.games.map(g=>g.id)),new Set(owner.gameRecords.map(g=>g.id)));
const active=report.games.filter(g=>g.playable);
assert.equal(active.length,87);
for(const g of active){
 assert.ok(g.actualRuntimeSourceCount>0,'Game has no JS runtime graph: '+g.id);
 assert.ok(g.actualRuntimeSourceFiles?.length===g.actualRuntimeSourceCount);
 assert.ok(!g.missingBrowserScriptDependencies?.length,'Missing local JS for '+g.id+': '+g.missingBrowserScriptDependencies);
 assert.equal(g.aaaCertified,false,'No automatic AAA approval: '+g.id);
 assert.equal(g.realAndroidQa,'NOT_RUN','Physical phone review required: '+g.id);
 assert.equal(g.scoreForgeryQa,'NOT_RUN','Prize score replay required: '+g.id);
}
const rail=report.games.find(x=>x.id==='gl-rail-rush');
assert.ok(rail.actualRuntimeSourceFiles.includes('public/games-lib/runner3x.js'),
 'Rail Rush must audit the shared 3D train runner, not just its tiny wrapper');
const td=report.games.find(x=>x.id==='gl-pop-defense');
assert.ok(td.actualRuntimeSourceFiles.includes('public/games-lib/td.js'),
 'Pop Defense must audit tower defense shared engine');
const car=report.games.find(x=>x.id==='gl-cab-rush');
assert.ok(car.actualRuntimeSourceCount>1,
 'Cab Rush small wrapper must resolve its shared gameplay engine');
for(const id of ['gl-bud-merge','gl-hex-stack','gl-dino-dash']){
 const g=report.games.find(x=>x.id===id);
 assert.ok(g.actualRuntimeSourceCount>=3,'Vendored multi-script game not deeply tracked: '+id);
}
assert.equal(report.activeDependencyGraphComplete,true);
assert.equal(report.activeDependencyErrors.length,0);
console.log(JSON.stringify({passed:true,registered:93,active:87,archived:6,
 shared3dAndTDEnginesTracked:true,openSourceMultifileTracked:true,certifiedAAA:0}));

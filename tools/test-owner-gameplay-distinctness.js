#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=JSON.parse(read('docs/audit/ALL-93-OWNER-GAMEPLAY-DISTINCTNESS-2026-10-14.json'));
const {games}=require('../src/games-lib');
const cfg=read('src/config.js');
const block=(cfg.match(/const GAMES = \[([\s\S]*?)\n\];/)||[])[1]||'';
const core=[...block.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
 .map(m=>m[1]).filter(id=>!['plinko','spin-to-win','blazed-roulette'].includes(id));
assert.equal(core.length,13);
assert.equal(games.length,80);
assert.equal(data.allCurrentRegistrations,core.length+games.length);
assert.equal(data.gameRecords.length,93);
const unique=new Set(data.gameRecords.map(g=>g.id));
assert.equal(unique.size,93,'No missing/duplicate source ID in audit');
for(const id of [...core,...games.map(g=>g.id)])
 assert.ok(unique.has(id),'Untracked game '+id);
assert.equal(data.activeProposed,data.gameRecords.filter(g=>g.playable).length);
assert.equal(data.archiveHistoryPreserved,data.gameRecords.filter(g=>g.archived).length);
assert.equal(data.qualityCertified,0,'Source-only audit must not count as AAA approval');
assert.ok(data.gameRecords.every(g=>!g.ownerAAASignoff),'Source-only inventory cannot sign off games');
assert.ok(data.gameRecords.every(g=>g.playerPhoneTouch==='NOT_DEVICE_TESTED'));
assert.equal(data.cannabisLibraryGames,games.filter(g=>g.category==='Cannabis').length);
for(const g of data.gameRecords){
 const actual=games.find(x=>x.id===g.id);
 if(actual) {
  assert.equal(g.playable,actual.playable!==false&&!actual.retired,g.id+' playable registry state drift');
  assert.equal(g.archived,!!actual.retired,g.id+' archival drift');
  assert.equal(g.reference,actual.ref_internal,g.id+' reference gameplay drift');
 }
 if(g.archived)assert.ok(g.replacedBy,'Archived historical game must have successor');
}
assert.equal(data.clusters.length,13,'Manual duplicate families must remain covered');
assert.ok(data.clusters.every(x=>x.allMembersPresent && x.ownerQualityApproved!==true));
const layers=data.clusters.find(x=>x.id==='layered-path-tower-defense');
assert.ok(layers);
assert.ok(layers.members.includes('haze-defense')&&layers.members.includes('gl-pop-defense'));
assert.equal(layers.review,'HIGH_RISK_DUPLICATE');
const trim=read('public/games-lib/trim-rush/game.js');
assert.ok(trim.includes('g.done = 0; g.next = 0; nextBud(g);'),
 'Trim Rush first round must generate actual leaves');
assert.ok(!trim.includes("if (g.kd(' ')) { const L = g.leaves.find"),
 'No keyboard auto-trim credit farming');
const bar=read('public/games-lib/bud-bar/game.js');
assert.ok(bar.includes('g.lane = i; fire = true;'),
 'A phone tap on any lane must serve without requiring an extra tap');
const strain=read('public/games-lib/strain-crush/game.js');
assert.ok(strain.includes('function hasLegalSwap(g)')&&strain.includes('rebuildPlayableBoard(g)'));
assert.ok(strain.includes("NO MOVES - SHUFFLED"));
const dunk=read('public/games-lib/dunk-flick/game.js');
assert.ok(!dunk.includes('const T = 0.9; b.vx = dx / T;'),
 'Never auto-aim keyboard shot from hoop target coordinates');
// Competitive physics/AI random draws must consume the signed game's seeded RNG.
const goo=read('public/games-lib/goo-tower/game.js');
assert.ok(goo.includes('g.windT = g.R(4, 8);'));
assert.ok(goo.includes("g.windTgt = (g.rnd() < 0.5 ? -1 : 1)"));
assert.ok(goo.includes('g.kCursor.x + kx * dt * 230') &&
 goo.includes('const tx = g.kCursor.x, ty = g.kCursor.y'),
 'Goo Tower must require manual keyboard placement');
assert.ok(!goo.includes('srt.slice(1).find('),'No keyboard auto-solver');
const lightCycle=read('public/games-lib/light-cycle/game.js');
assert.ok(lightCycle.includes('aggr: g.R(0.3, 0.8)'),
 'Light Cycle AI aggression must use seeded RNG');
assert.ok(!lightCycle.includes('aggr: 0.3 + Math.random()'));
console.log(JSON.stringify({pass:true,gameIds:unique.size,archived:data.archiveHistoryPreserved,
 playable:data.activeProposed,manualMechanicClusters:layers?data.clusters.length:0,
 highRiskDuplication:['haze-defense','gl-pop-defense'],qualityCertified:0,
 tests:'full metadata/known source checks; AAA and physical iPhone/Android remain blocked'}));

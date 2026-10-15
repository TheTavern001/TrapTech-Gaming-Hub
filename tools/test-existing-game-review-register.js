#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('public/games-lib/catalog.json');
const source=read('docs/audit/ALL-93-OWNER-GAMEPLAY-DISTINCTNESS-2026-10-14.json');
const quality=read('docs/audit/GAME-QUALITY-ACCEPTANCE.json');
const audit=read('docs/audit/EXISTING-GAME-REVIEW-REGISTER-2026-10-14.json');
const registered=new Map(source.gameRecords.map(x=>[x.id,x]));
const library=new Map(catalog.games.map(x=>[x.id,x]));
const seen=new Set();
assert.equal(audit.records.length,registered.size,'Every current source ID needs a review record');
assert.equal(library.size,catalog.games.length,'Library IDs must be distinct');
for(const row of audit.records){
 assert.ok(!seen.has(row.id),'Duplicate QA inventory record: '+row.id);
 seen.add(row.id);
 assert.ok(registered.has(row.id),'Unknown game in QA inventory: '+row.id);
 const src=registered.get(row.id),lib=library.get(row.id);
 assert.equal(row.playable,!row.retired,'Retired game cannot remain playable');
 assert.equal(row.retired,Boolean(src.archived||src.historicalOnly||lib?.retired||lib?.playable===false));
 if(row.group==='library')assert.ok(lib,'Library record has no catalog entry: '+row.id);
 assert.equal(row.qa.ownerSignoff,false,'Static census must not award owner approval');
 assert.equal(row.qa.scoreProof,'NOT_TITLE_CERTIFIED','Static census cannot certify prize scoring');
 assert.equal(row.qa.android,'NOT_DEVICE_TESTED');
 assert.equal(row.qa.ios,'NOT_DEVICE_TESTED');
 assert.equal(row.qa.graphics,'NOT_ART_APPROVED');
}
for(const member of source.gameRecords)assert.ok(seen.has(member.id),'Missing game record '+member.id);
for(const family of source.clusters){
 for(const id of family.members)assert.ok(seen.has(id),'Missing duplicate-family member '+id);
}
assert.equal(audit.summary.overlapClusters,source.clusters.length);
assert.equal(audit.summary.proposedPlayable,audit.records.filter(x=>x.playable).length);
assert.equal(audit.summary.archived,audit.records.filter(x=>x.retired).length);
assert.equal(audit.summary.qualityApproved,quality.records.filter(x=>x.status==='APPROVED').length);
console.log(JSON.stringify({pass:true,registered:audit.records.length,playable:audit.summary.proposedPlayable,retired:audit.summary.archived,overlapClusters:audit.summary.overlapClusters,deviceApproved:audit.summary.qualityApproved,scope:'source inventory, not full gameplay review'}));

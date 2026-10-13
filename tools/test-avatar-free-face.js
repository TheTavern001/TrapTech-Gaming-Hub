#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'src/avatars.js'),'utf8');
const db={exec(){},prepare(){return {get(){return {found:1}},all(){return []},run(){return {changes:1}}}},transaction(fn){return fn}};
const mod={exports:{}};
vm.runInNewContext(src,{module:mod,require:n=>n==='./db'?db:n==='crypto'?require('node:crypto'):(()=>{throw Error('Unexpected dependency '+n)})(),console,Date,process:{env:{}}},{filename:'src/avatars.js',timeout:3500});
const A=mod.exports,P=A.partsFor(null),kinds=['skin','face','eyes','mouth','beard'];
for(const kind of kinds){
 const parts=P.filter(p=>p.kind===kind);
 assert.ok(parts.length>=4,'Missing '+kind);
 for(const p of parts){
  assert.equal(p.unlock,'free',kind+':'+p.id+' must never be purchase gated');
  assert.equal(p.owned,true,kind+':'+p.id+' must be free for all');
  assert.equal(p.crowns,0,kind+':'+p.id+' has Crown price');
  assert.equal(p.points,0,kind+':'+p.id+' has Points price');
 }
}
assert.equal(P.filter(p=>p.kind==='hair'&&p.owned).length,7,'7 standard haircuts free');
assert.equal(P.filter(p=>p.kind==='emote'&&!p.owned).length,5,'5 advanced emotes unlockable');
assert.equal(P.filter(p=>['outfit','hat','acc','held'].includes(p.kind)&&p.owned&&!['none','base'].includes(p.id)).length,0,'No free collectible gear');
assert.equal(A.defaultFor().outfit,'base','neutral starter');
console.log(JSON.stringify({passed:true,freeFaceParts:P.filter(p=>kinds.includes(p.kind)).length,freeHair:7,lockedEmotes:5}));

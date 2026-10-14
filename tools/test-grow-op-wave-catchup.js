#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8'),
 {Kit:{run:g=>game=g,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))},console},{timeout:2000});
function sample(timer){
 const g={t:0,ptr:{pressed:false},btnP:{},kd:()=>false,add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},pick:a=>a[0],R:(a,b)=>a,end:()=>{}};
 game.init(g);g.time=10000;g.pestTimer=timer;game.update(g,0);
 return {pests:g.pests.length,timer:g.pestTimer};
}
assert.equal(sample(.1).pests,0,'No early unearned pest spawn');
assert.equal(sample(-2).pests,3,'Account for three owed late-game waves');
const stalled=sample(-99);
assert.equal(stalled.pests,4,'Catch-up must be capped on huge lag/resume');
assert.equal(stalled.timer,.75,'Backlog must reset safely');
console.log(JSON.stringify({pass:true,normal:sample(.1),owed:sample(-2),suspended:stalled,physicalPhoneQA:false}));

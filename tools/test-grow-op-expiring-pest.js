#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8'),{Kit:{run:g=>game=g,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},console},{timeout:2000});
function healthAfter(t,life){
 const g={t:0,ptr:{pressed:false},btnP:{},kd:()=>false,add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},pick:v=>v[0],R:(a,b)=>a,end:()=>{}};
 game.init(g);g.pestTimer=999;g.plants[0].pests=1;g.pests=[{x:70,y:150,p:0,t,life}];
 const h=g.plants[0].health;game.update(g,.1);
 return {healthDelta:g.plants[0].health-h,pestCount:g.plants[0].pests};
}
const expired=healthAfter(11.95,12),active=healthAfter(11,12);
assert.equal(expired.pestCount,0,'Expired pest removed before plant health applies');
assert.equal(active.pestCount,1,'Active pest still causes plant pressure');
assert.ok(expired.healthDelta>active.healthDelta,'Expired pest cannot deal stale damage');
console.log(JSON.stringify({pass:true,expired,active,physicalPhoneQA:false}));

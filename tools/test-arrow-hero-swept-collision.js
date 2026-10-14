#!/usr/bin/env node
'use strict';
// Real Arrow Hero gameplay hooks in a deterministic VM, not a phone FPS claim.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/arrow-hero/game.js'),'utf8');
let game;
vm.runInNewContext(source,{Kit:{run:g=>{game=g;}},console},{timeout:2000});
assert.ok(game&&typeof game.update==='function'&&typeof game.init==='function');
function runAt(y,dt=0.1){
 let score=0,kills=0;
 let state=1;
 const g={
  W:400,H:720,score:0,t:0,ptr:{pressed:false},keys:{},btnP:{},
  kd:()=>false,ax:()=>0,ay:()=>0,
  R:(a,b)=>a+(b-a)*.5,RI:(a,b)=>a,pick:v=>v[0],
  mark:(name)=>{if(name==='k')kills++;},
  add:(n)=>{score+=n;},sfx:()=>{},burst:()=>{},float:()=>{},shake:()=>{},end:()=>{},
  stick:{on:false,x:0,y:0}
 };
 game.init(g);g.obs=[];g.cd=100;g.p.inv=100;g.en=[
  {t:'mage',x:130,y:200,r:14,hp:1,max:1,cd:100,ph:0,vx:0,vy:0}
 ];
 g.eb=[];g.ar=[{x:100,y,vx:620,vy:0,d:0,rico:0,pierce:0,hit:new Set()}];
 game.update(g,dt);
 return {score,kills,remaining:g.en.length,gate:g.gate};
}
const hit=runAt(200);
assert.equal(hit.kills,1,'Fast arrow segment crossing enemy must hit');
assert.equal(hit.score,25,'One earned kill yields one award');
assert.equal(hit.remaining,0);
const edge=runAt(217);
assert.equal(edge.kills,1,'Arrow hitbox radius must include tangential sweep');
const miss=runAt(225);
assert.equal(miss.kills,0,'Arrow near-miss must not award a kill');
assert.equal(miss.score,0);
const short=runAt(200,1/60);
assert.equal(short.kills,0,'Short travel must not reach enemy before contact');
console.log(JSON.stringify({pass:true,checks:4,testType:'deterministic real update callback',physicalPhoneQA:false}));

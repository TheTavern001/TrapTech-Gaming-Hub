#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8'),{
 Kit:{run:c=>game=c,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},console},{timeout:2000});
function run(dt){
 const g={t:0,ptr:{pressed:false},btnP:{},kd:()=>false,add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},pick:v=>v[0],R:(a,b)=>a,end:()=>{throw Error('A suspended tab killed a run')}};
 game.init(g);g.pestTimer=999;
 for(const p of g.plants){p.health=.51;p.water=.4;p.food=.4;}
 game.update(g,dt);
 return {health:g.plants[0].health,water:g.plants[0].water,deaths:g.deaths,time:g.time};
}
const steady=run(.25),suspended=run(600);
assert.equal(suspended.deaths,0);
assert.equal(suspended.health,steady.health,'Tab suspension cannot drain health across 10 unattended minutes');
assert.equal(suspended.water,steady.water,'Tab suspension cannot empty water');
assert.equal(suspended.time,600,'Survival clock still records actual elapsed time');
console.log(JSON.stringify({pass:true,steady,suspended,physicalDeviceQA:false}));

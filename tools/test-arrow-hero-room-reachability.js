#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/arrow-hero/game.js'),'utf8');
let game;
vm.runInNewContext(source,{Kit:{run:g=>game=g},console},{timeout:2000});
assert.ok(game&&game.init&&game.update);
let rng=17;
const g={
 W:400,H:720,score:0,t:0,
 R(a,b){rng=(Math.imul(rng,1664525)+1013904223)>>>0;return a+(b-a)*(rng/4294967296);},
 RI(a,b){return Math.floor(g.R(a,b+1));},
 pick(v){return v[g.RI(0,v.length-1)];},
 ax:()=>0,ay:()=>0,kd:()=>false,ptr:{pressed:false},
 sfx:()=>{},mark:()=>{},add:()=>{},float:()=>{},stick:{on:false,x:0,y:0}
};
game.init(g);
let count=0,minClearance=Infinity;
for(let room=2;room<=1001;room++){
 // Complete an existing room and cross its open gate: real game.update
 // transitions into the next room and invokes production obstacle generation.
 g.en=[];g.gate=true;g.p.x=200;g.p.y=100;g.cd=10;g.ar=[];g.eb=[];
 game.update(g,0);
 assert.equal(g.room,room,'Room transition failed');
 assert.ok(g.obs.length<=5);
 for(const o of g.obs){
  const clearance=o.x>=200?o.x-200:200-(o.x+o.w);
  minClearance=Math.min(minClearance,clearance);
  assert.ok(clearance>=24,'Obstacle blocks central 24px player-radius path in room '+room);
  assert.ok(o.y>=200&&o.y+o.h<=640,'Obstacle outside inner play space in room '+room);
  count++;
 }
}
console.log(JSON.stringify({pass:true,rooms:1000,obstaclesChecked:count,minClearancePx:minClearance,physicalDeviceQA:false}));

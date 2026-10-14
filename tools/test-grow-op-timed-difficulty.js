#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8');
vm.runInNewContext(source,{Kit:{run:x=>game=x,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},console},{timeout:2000});
function measure(elapsed){
 const g={t:0,ptr:{pressed:false},btnP:{},kd:()=>false,add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},pick:a=>a[0],R:(a,b)=>a};
 game.init(g);g.time=elapsed;g.pestTimer=.1;game.update(g,.1);
 return {pestTimer:g.pestTimer,pests:g.pests.length};
}
const early=measure(0),late=measure(300),veryLate=measure(10000);
assert.equal(early.pests,1);assert.equal(late.pests,1);assert.equal(veryLate.pests,1);
assert.ok(early.pestTimer>late.pestTimer,'Pest waves must accelerate with game elapsed time even if engine time is static');
assert.ok(late.pestTimer>veryLate.pestTimer,'Long-run pace should intensify further');
assert.ok(veryLate.pestTimer>=.75,'Difficulty cannot exceed minimum spawn interval');
console.log(JSON.stringify({pass:true,early,late,veryLate,deviceQA:false}));

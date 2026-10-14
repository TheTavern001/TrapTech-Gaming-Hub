#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8'),{Kit:{
 run:x=>game=x,clamp:(v,a,b)=>Math.max(a,Math.min(b,v))},console},{timeout:2000});
const g={t:0,ptr:{pressed:false},btnP:{},kd:()=>false,add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},pick:a=>a[0],R:(a,b)=>a,end:()=>{throw Error('Unexpected end')}};
game.init(g);
for(const p of g.plants){p.health=1;p.water=1.2;p.food=1.2;}
g.pestTimer=.1;
game.update(g,10);
assert.equal(g.pests.length,3,'Overdue waves must survive a slow update');
assert.ok(g.pests.every(p=>p.t===0),'New pests must not inherit the elapsed frame time');
assert.equal(g.plants[0].pests,3,'New wave actors must count toward plant pest pressure');
console.log(JSON.stringify({pass:true,stalledFrameSeconds:10,newbornPests:g.pests.length,ages:g.pests.map(x=>x.t),deviceQA:false}));

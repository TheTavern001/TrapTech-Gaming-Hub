#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8'),{Kit:{
 run:c=>game=c,clamp:(v,a,b)=>Math.min(b,Math.max(a,v))},console},{timeout:2000});
function sample(touch) {
 let earned=0;const g={t:0,ptr:{pressed:touch,x:70,y:150},btnP:{},kd:()=>false,add:v=>earned+=v,sfx:()=>{},burst:()=>{},float:()=>{},pick:a=>a[0],R:(a,b)=>a,end:()=>{}};
 game.init(g);g.plants[0].pests=1;g.pests=[{x:70,y:150,p:0,t:0,life:12}];g.pestTimer=999;
 const initialHealth=g.plants[0].health;game.update(g,.1);
 return {earned,healthGain:g.plants[0].health-initialHealth,pests:g.pests.length};
}
const swatted=sample(true),unswatted=sample(false);
assert.equal(swatted.earned,5);
assert.equal(swatted.pests,0);
assert.equal(unswatted.earned,0);
assert.equal(unswatted.pests,1);
assert.ok(swatted.healthGain>unswatted.healthGain,'Swatted pest must not inflict another tick of damage');
console.log(JSON.stringify({pass:true,swatted,unswatted,physicalPhoneQA:false}));

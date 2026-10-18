#!/usr/bin/env node
'use strict';
// Real game update callback in a Node VM. Phone pointer input only;
// proves no double scoring or unintended selection, NOT iPhone graphics QA.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/grow-op/game.js'),'utf8');
let spec;
const Kit={run:x=>spec=x,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
  circ:()=>{}};
vm.runInNewContext(source,{Kit,Math}, {filename:'grow-op/game.js',timeout:1500});
assert.ok(spec&&typeof spec.init==='function'&&typeof spec.update==='function');
const g={time:0,t:0,sel:1,deaths:0,ptr:{pressed:false,x:0,y:0},btnP:{},
  kd:()=>false,pick:a=>a[0],R:(a,b)=>(a+b)/2,
  score:0, add(v){this.score+=v;},sfx:()=>{},burst:()=>{},float:()=>{},end:()=>{throw Error('Unexpected death')}};
spec.init(g); g.sel=1;
const selectBefore=g.sel;
g.pests=[{x:g.plants[3].x-5,y:g.plants[3].y,p:3,t:0,life:12,dead:false},
 {x:g.plants[3].x+5,y:g.plants[3].y,p:3,t:0,life:12,dead:false}];
g.ptr={pressed:true,x:g.plants[3].x-5,y:g.plants[3].y};
spec.update(g,1/60);
assert.equal(g.score,5,'One tap cannot get double 5-point rewards from overlapping pests');
assert.equal(g.sel,selectBefore,'A pest swat cannot switch the selected plant');
assert.equal(g.pests.length,1,'Only one live pest should remain after a single swat');
assert.equal(g.pests[0].dead,false);
g.ptr={pressed:true,x:g.plants[3].x,y:g.plants[3].y};
spec.update(g,1/60);
assert.equal(g.score,10,'Second intentional swat can reward the second pest');
assert.equal(g.sel,selectBefore,'Repeated swat cannot silently select the plant below');
g.ptr={pressed:true,x:g.plants[3].x,y:g.plants[3].y};
spec.update(g,1/60);
assert.equal(g.sel,3,'Tap after pest removal must still select plant');
assert.equal(g.score,10,'Plant selection must not mint pest score');
g.ptr={pressed:true,x:g.plants[1].x,y:g.plants[1].y};
spec.update(g,1/60);
assert.equal(g.sel,1,'Tap another plant selects the intended plant');
assert.equal(g.score,10,'Plant selection does not grant free points');
console.log(JSON.stringify({pass:true,assertions:10,game:'gl-grow-op',
 controls:'one phone touch = one live pest or one plant selection',device:'not measured'}));

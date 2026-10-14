#!/usr/bin/env node
'use strict';
// Tests actual game init and update callbacks in an isolated fake canvas host.
// No server/game-score mocking is claimed to be a physical Android playtest.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const get=slug=>{
  const file=path.join(root,'public/games-lib',slug,'game.js'),code=fs.readFileSync(file,'utf8');
  let game;
  const Kit={run:config=>{game=config;},clamp:(v,min,max)=>Math.min(max,Math.max(min,v))};
  vm.runInNewContext(code,{Kit,console},{filename:file,timeout:1000});
  assert.ok(game&&game.init&&game.update,'Game hooks not registered: '+slug);
  return {game,code};
};
const makeG=(seed=12)=>{
 let state=seed>>>0, g={
  W:400,H:720,t:0,state:'play',score:0,ptr:{pressed:false,released:false,down:false,x:200,y:400,sx:200,sy:400},
  keys:{},btnP:{},kd:()=>false,ax:()=>0,
  R(a,b){state=(Math.imul(state,1664525)+1013904223)>>>0;return a+(b-a)*(state/4294967296);},
  rnd(){return g.R(0,1);},RI(a,b){return Math.floor(g.R(a,b+1));},
  pick(v){return v[g.RI(0,v.length-1)];},
  add(v){g.score+=v;},mark(){},sfx(){},burst(){},float(){},shake(){},flash(){},txt(){},
  end(reason){g.state='end';g.reason=reason}
 };return g;
};
const trim=get('trim-rush'),bud=get('bud-bar'),grow=get('grow-op'),match=get('strain-crush'),dunk=get('dunk-flick');
const tr=makeG();trim.game.init(tr);
assert.equal(tr.done,0,'First bud cannot inherit undefined completed-count');
assert.ok(tr.leaves.length>=4,'First round must show leaves, not an empty auto-clear');
assert.equal(tr.score,0);
tr.kd=k=>k===' ';trim.game.update(tr,1/60);
assert.equal(tr.score,0,'Keyboard Space must not auto-trim hidden targeted leaves');
assert.equal(tr.leaves.filter(x=>x.cut).length,0);
const leaf=tr.leaves[0],angle=leaf.a+tr.rot;
const mx=200+Math.cos(angle)*leaf.len*.45,my=330+Math.sin(angle)*leaf.len*.45;
tr.kd=()=>false;tr.ptr.down=true;
tr.prev={x:mx-Math.sin(angle)*18,y:my+Math.cos(angle)*18};
tr.ptr.x=mx+Math.sin(angle)*18;tr.ptr.y=my-Math.cos(angle)*18;
trim.game.update(tr,1/60);
assert.ok(tr.score>0,'A real drag across the leaf must award score');
assert.equal(tr.leaves.filter(x=>x.cut).length,1,'Specific touched leaf must be cut');
assert.match(trim.game.help,/30s/i);
assert.doesNotMatch(trim.game.help,/60 seconds/i);
const bg=makeG();bud.game.init(bg);
bg.ptr={pressed:true,released:false,down:false,x:120,y:365,sx:120,sy:365};
bud.game.update(bg,0);
assert.equal(bg.lane,2,'First tap selects touched counter lane');
assert.equal(bg.bags.length,1,'First tap on a different counter also serves an order');
assert.equal(bg.bags[0].lane,2);
assert.equal(bg.score,0,'Firing a bag alone cannot mint serving score');
const gg=makeG();grow.game.init(gg);grow.game.update(gg,1);
assert.equal(gg.state,'play');
assert.ok(gg.time>0,'Grow room uses elapsed survival time, not a false 3-minute ending');
assert.match(grow.game.help,/3 dead plants/i);
assert.doesNotMatch(grow.game.help,/3 minutes/i);
// Twelve-minute synthetic phone-session sampling (not measured device FPS):
// stage repeated plant care only to keep the simulation alive, never score it.
function pestTrace(seed) {
 const g=makeG(seed);grow.game.init(g);
 let max=0,arrivals=0,expired=false,prev=0;
 for(let frame=0;frame<4320;frame++){
   for(const p of g.plants){ p.water=.65;p.food=.65;p.health=1; }
   grow.game.update(g,1/6);
   if(g.pests.length>prev)arrivals++;
   if(frame>100&&g.pests.length<prev)expired=true;
   prev=g.pests.length;
   if(g.pests.length>max)max=g.pests.length;
   if(max>18)throw Error('Grow Op over-retains active pests');
 }
 return {max,arrivals,expired,totalScore:g.score,active:g.pests.length};
}
const pests1=pestTrace(77),pests2=pestTrace(77);
assert.ok(pests1.arrivals>8,'Pests must actually spawn in long sessions');
assert.ok(pests1.expired,'Pests must expire instead of accumulating forever');
assert.ok(pests1.max<=18,'Persisted actor count must be bounded');
assert.deepEqual(pests1,pests2,'Same seeded input/session must spawn identical pests');
function anyMatch(g){
 for(let y=0;y<8;y++)for(let x=0;x<8;x++){
  const v=g.b[y][x].v;
  if(x<6&&g.b[y][x+1].v===v&&g.b[y][x+2].v===v)return true;
  if(y<6&&g.b[y+1][x].v===v&&g.b[y+2][x].v===v)return true;
 }return false;
}
function legalMove(g){
 for(let y=0;y<8;y++)for(let x=0;x<8;x++)for(const [dy,dx] of [[0,1],[1,0]]){
  const yy=y+dy,xx=x+dx;
  if(xx>=8||yy>=8||g.b[y][x].v===g.b[yy][xx].v)continue;
  let a=g.b[y][x].v,b=g.b[yy][xx].v;g.b[y][x].v=b;g.b[yy][xx].v=a;
  const valid=anyMatch(g);g.b[y][x].v=a;g.b[yy][xx].v=b;
  if(valid)return true;
 }return false;
}
for(let seed=1;seed<=40;seed++){
 const sg=makeG(seed);match.game.init(sg);
 assert.equal(sg.time,60);
 assert.equal(sg.b.length,8);assert.ok(sg.b.every(x=>x.length===8));
 assert.equal(anyMatch(sg),false,'Seed '+seed+' starts with free unearned matches');
 assert.equal(legalMove(sg),true,'Seed '+seed+' starts with no legal match-three swap');
}
const dead=makeG(343);match.game.init(dead);
dead.b=Array.from({length:8},(_,row)=>Array.from({length:8},(_,col)=>({v:(row+col)%6,y:row,sp:0})));
assert.equal(anyMatch(dead),false);
assert.equal(legalMove(dead),false,'Constructed Latin board must be an actual no-swap deadlock');
const scoreBefore=dead.score;dead.pending=true;dead.swap=null;
match.game.update(dead,1/60);
assert.equal(anyMatch(dead),false,'Reshuffle must not give free score matches');
assert.equal(legalMove(dead),true,'Stalled board must be playable after seeded reshuffle');
assert.equal(dead.score,scoreBefore,'Seeded no-moves reshuffle cannot award unearned points');
assert.match(match.game.help,/60s/i);
// Keyboard must never auto-shoot at a hoop target using its coordinates.
const ho=makeG();dunk.game.init(ho);
ho.kd=k=>k===' ';dunk.game.update(ho,0);
assert.equal(ho.ball.held,true,'Space alone must not auto-aim and score');
ho.kd=k=>k==='ArrowRight';dunk.game.update(ho,0);
assert.equal(ho.aim.dx,12);
ho.kd=k=>k===' ';dunk.game.update(ho,0);
assert.equal(ho.ball.held,false,'Space may only release a shot after manually aiming');
assert.equal(ho.ball.vx,12*4.2,'Keyboard shot must use the same touch launch physics');
const ho2=makeG();dunk.game.init(ho2);
ho2.hoops[1].x=4000; // target coordinate must NOT change launch velocity
ho2.kd=k=>k==='ArrowRight';dunk.game.update(ho2,0);
ho2.kd=k=>k===' ';dunk.game.update(ho2,0);
assert.equal(ho2.ball.vx,ho.ball.vx,'No basketball auto-targeting from next hoop coordinates');
assert.ok(!dunk.code.includes('const T = 0.9; b.vx = dx / T;'),'Old keyboard auto-basket cheat remains');
console.log(JSON.stringify({pass:true,tested:['Trim Rush init/fair drag','Bud Bar one-tap lanes',
  'Grow Op honest endless rules + 12-minute bounded pest sim','Strain Crush 40 seeds + deadlock reshuffle','Dunk Flick manual keyboard/touch launch parity'],
  simulatedFramesOnly:true,AAAApproved:false,realDeviceTested:false}));

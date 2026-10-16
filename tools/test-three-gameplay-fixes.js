#!/usr/bin/env node
'use strict';
// Tests the REAL three distinct games' update loops with deterministic
// keyboard/touch inputs. Source-level gameplay regression, NOT device/AAA QA.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../public/games-lib');
function load(slug){
 let game;
 const Kit={run:def=>{game=def;},clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
   lerp:(a,b,t)=>a+(b-a)*t,tone(){}};
 class Image{constructor(){this.width=32;this.height=32;}set src(v){}}
 const script=fs.readFileSync(path.join(root,slug,'game.js'),'utf8');
 vm.runInNewContext(script,{Kit,Image,window:{},Math,console,
   document:{createElement:()=>({getContext:()=>({})})}},
   {filename:slug+'/game.js',timeout:2500});
 assert.ok(game&&typeof game.update==='function',slug+' must have live gameplay');
 return game;
}
function world(){
 const actions={sounds:[],scores:[],ends:[]};
 const g={W:400,H:700,state:'play',rnd:()=>0.8,RI:a=>a,R:a=>a,
  ptr:{pressed:false,down:false,x:200,y:150},keys:{},btnP:{},kd:()=>false,
  ax:()=>0,tap:()=>false,score:0,t:0,
  mark(){},add(n,kind){this.score+=n;actions.scores.push({n,kind});},
  end(reason){actions.ends.push(reason);this.state='over';return reason;},
  sfx:k=>actions.sounds.push(k),float(){},burst(){},shake(){},flash(){},pick:a=>a[0]};
 return {g,actions};
}
const rhythm=load('beat-tiles');
const freshBeat=()=>{const x=world();rhythm.init(x.g);
 x.g.tiles=[{ln:1,y:480,h:340,long:true,hit:false,n:0}];
 x.g.go=false;x.g.made=13;x.g.ptr={pressed:true,down:true,x:140,y:600};return x;};
let {g,actions}=freshBeat();
rhythm.update(g,0);
assert.ok(g.hold,'Tapping a long note must begin held state');
g.ptr.pressed=false;g.ptr.down=false;
rhythm.update(g,0.016);
assert.equal(g.state,'over','Premature release must fail the run');
assert.equal(actions.ends.at(-1),'Hold note released too early');
({g,actions}=freshBeat());
rhythm.update(g,0);
g.ptr.pressed=false;g.tiles[0].y=580;
rhythm.update(g,0);
assert.equal(g.state,'play','Valid uninterrupted hold must stay in play');
assert.equal(g.hold,null,'Completed hold must clear active state');
assert.ok(actions.scores.some(p=>p.kind==='long'),'Completed hold must award skill bonus');
const hopper=load('cloud-hopper');
({g,actions}=world());
g.p={x:200,y:590,vx:0,vy:200};
g.pl=[{x:160,y:620,w:80,t:0},{x:170,y:620,w:80,t:0}];
g.cam=0;g.top=0;g.hi=-900;g.en=[];
hopper.update(g,0.1);
assert.equal(g.p.vy,-640,'Platform landing must bounce');
assert.equal(actions.sounds.filter(x=>x==='jump').length,1,'One platform landing per frame');
({g,actions}=world());
g.p={x:20,y:550,vx:0,vy:-80};
g.pl=[{x:390,y:640,w:70,t:1,d:1}];
g.cam=0;g.top=0;g.hi=-900;g.en=[];
hopper.update(g,0.05);
assert.ok(g.pl[0].x>=0&&g.pl[0].x+g.pl[0].w<=g.W,'Moving platform cannot exit playfield');
assert.equal(g.pl[0].d,-1,'Moving platform must reverse at edge');
const aliens=load('alien-rows');
({g,actions}=world());aliens.init(g);
g.ptr.down=true;g.ptr.x=90000;
g.wave=99;g.mt=100;
g.bombs=Array.from({length:24},()=>({x:5,y:120,v:0}));
g.rnd=()=>0.5;
aliens.update(g,0.016);
assert.ok(g.p.x<=g.W-20,'Mobile drag clamps within screen');
assert.ok(g.bombs.length<=24,'High-wave projectile count stays bounded');
console.log(JSON.stringify({pass:true,distinctGames:3,
 earlyHoldRejected:true,completedHoldRewarded:true,oneBouncePerLanding:true,
 movingPlatformContained:true,touchDragContained:true,projectileBudgetBounded:true,
 realDeviceCertified:false,visualAAACertified:false}));

#!/usr/bin/env node
'use strict';
// Execute the actual Goo Tower touch-gesture handlers in isolation.
// Detect phantom pickup and scoring from pointercancel/blur/pagehide.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/goo-tower/game.js'),'utf8');
const lines=source.split(/\r?\n/);
const handlers=lines.filter(line=>line.includes('if (g.ptr.pressed && !g.drag)')||
 line.includes('if (g.drag) { g.drag.x = px; g.drag.y = py;')).join('\n');
assert.equal(handlers.split('\n').length,2,'Gesture implementation changed: re-audit real handlers');
const gesture=new Function('g','px','py','cands','addBall','link',handlers);
function scenario(x,y,release){
 const events=[],state={ptr:{pressed:true,down:true,released:false},
  free:[{x:20,y:20}],nodes:[],placed:0,sfx:x=>events.push(x)};
 const neighbors=()=>[[{position:{x:30,y:30}}],[{position:{x:35,y:35}}]];
 const ball=(_,x,y)=>({position:{x,y}});
 gesture(state,x,y,neighbors,ball,()=>{});
 const picked=!!state.drag;
 state.ptr.pressed=false;state.ptr.down=false;state.ptr.released=release;
 gesture(state,38,35,neighbors,ball,()=>{});
 return {picked,placed:state.placed,available:state.free.length,events};
}
const offBall=scenario(210,210,true),cancel=scenario(20,20,false),real=scenario(20,20,true);
assert.equal(offBall.picked,false,'Tap away from available goo must not grab the first ball');
assert.equal(offBall.placed,0);
assert.equal(cancel.picked,true);
assert.equal(cancel.placed,0,'Canceled/blurred pointer must not place a scoring ball');
assert.equal(cancel.available,1);
assert.equal(real.picked,true);
assert.equal(real.placed,1,'Legitimate pickup+release must place exactly one ball');
assert.equal(real.available,0);
assert.ok(source.includes('g.kCursor && g.kCursor.used'),
 'Keyboard cursor must not cover the mobile screen before keyboard use');
console.log(JSON.stringify({pass:true,phantomPickupRejected:true,
 pointerCancelCannotScore:true,realTouchWorks:true,mobileReticleHidden:true}));

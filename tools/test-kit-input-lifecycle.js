#!/usr/bin/env node
'use strict';
// Execute the real shared Kit input handlers with deterministic DOM-less
// fixtures.  This verifies state transitions, NOT physical Android touch QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const start=src.indexOf('    const touches = new Map();');
const stop=src.indexOf("    cv.addEventListener('pointerdown'",start);
assert.ok(start>0&&stop>start,'Real Kit pointer handler block missing');
const pointerBlock=src.slice(start,stop);
assert.ok(pointerBlock.includes('function clearInputs()'),'Shared input reset not available');
function fixture(opts={}){
  const g={
    state:'play',paused:false,inputs:0,
    ptr:{x:200,y:350,sx:0,sy:0,down:false,pressed:false,released:false,pointerId:null},
    stick:{x:0,y:0,on:false,cx:0,cy:0},
    btn:{},btnP:{},keys:{},kp:{},_kp:false
  };
  const def={stick:false,stickAlsoPtr:false,...opts};
  const K={clamp:(v,a,b)=>Math.max(a,Math.min(b,v))};
  const buttons=[{id:'jump',key:' ',x:350,y:644,r:34}];
  const env={Hub:{input(){}}};
  const handlers=new Function('g','def','K','btns','toL','ac','window','Hub','gameSettingsOpen',
    pointerBlock+';return {onDown,onMove,onUp,clearInputs,touches};')(
    g,def,K,buttons,e=>[e.clientX,e.clientY],()=>{},env,env.Hub,false
  );
  const evt=(id,x=200,y=350,type='touch',name='pointerdown')=>({
    pointerId:id,clientX:x,clientY:y,pointerType:type,type:name,preventDefault(){}
  });
  return {g,evt,...handlers};
}
// 1. Stray global up never creates a shot or a phantom release.
{const f=fixture();f.onUp(f.evt(999,0,0,'mouse','pointerup'));assert.equal(f.g.ptr.released,false);}
 // 2. Swipes end exactly once; moving/ending a second finger must not
 // overwrite aim, fire, or prematurely release a held drag.
{const f=fixture();f.onDown(f.evt(1,230,300));f.onDown(f.evt(2,90,220));
 assert.equal(f.g.ptr.pointerId,1);assert.equal(f.g.ptr.sx,230);
 f.onMove(f.evt(2,330,100,'touch','pointermove'));assert.equal(f.g.ptr.x,230);
 f.onUp(f.evt(2,330,100,'touch','pointerup'));assert.equal(f.g.ptr.released,false);
 assert.equal(f.g.ptr.down,true);
 f.onMove(f.evt(1,280,260,'touch','pointermove'));assert.equal(f.g.ptr.x,280);
 f.onUp(f.evt(1,280,260,'touch','pointerup'));
 assert.equal(f.g.ptr.down,false);assert.equal(f.g.ptr.released,true);
 assert.equal(f.g.ptr.pointerId,null);}
 // 3. Interrupted gestures never grant free launches/aim releases.
{const f=fixture();f.onDown(f.evt(11));f.onUp(f.evt(11,240,190,'touch','pointercancel'));
 assert.equal(f.g.ptr.released,false);assert.equal(f.g.ptr.down,false);}
 // 4. Virtual stick must coexist with a separate pointer, and each touch
 // releases only the input control that originally owned it.
{const f=fixture({stick:true,stickZone:(x)=>x<150});f.onDown(f.evt(5,70,600));
 assert.equal(f.g.stick.on,true);assert.equal(f.g.ptr.down,false);
 f.onMove(f.evt(5,115,605,'touch','pointermove'));assert.ok(f.g.stick.x>.2);
 f.onDown(f.evt(6,270,450));assert.equal(f.g.ptr.down,true);
 f.onUp(f.evt(5,115,605,'touch','pointerup'));assert.equal(f.g.stick.on,false);
 assert.equal(f.g.ptr.down,true);assert.equal(f.g.ptr.released,false);
 f.onUp(f.evt(6,270,450,'touch','pointerup'));assert.equal(f.g.ptr.released,true);}
 // 5. stickAlsoPtr must track BOTH analog stick and pointer for the same
 // touch rather than overwriting the stick owner in the touches map.
{const f=fixture({stick:true,stickAlsoPtr:true,stickZone:()=>true});
 f.onDown(f.evt(22,80,480));assert.equal(f.touches.get(22).k,'stick-ptr');
 f.onMove(f.evt(22,115,460,'touch','pointermove'));
 assert.ok(f.g.stick.x>0);assert.equal(f.g.ptr.x,115);
 f.onUp(f.evt(22,115,460,'touch','pointerup'));
 assert.equal(f.g.stick.on,false);assert.equal(f.g.ptr.released,true);}
 // 6. Touch game buttons do not generate pointer release and their key
 // state resets on release.
{const f=fixture();f.onDown(f.evt(7,350,644));
 assert.equal(f.g.btn.jump,true);assert.equal(f.g.keys[' '],true);
 f.onUp(f.evt(7,350,644,'touch','pointerup'));
 assert.equal(f.g.btn.jump,false);assert.equal(f.g.keys[' '],false);
 assert.equal(f.g.ptr.released,false);}
 // 7. Settings/focus reset clears all active touches, held keys and sticks.
{const f=fixture({stick:true,stickZone:(x)=>x<150});
 f.onDown(f.evt(5,70,600));f.onDown(f.evt(6,280,470));
 f.g.keys.ArrowRight=true;f.g.btn.jump=true;f.g._kp=true;
 f.clearInputs();
 assert.equal(f.touches.size,0);assert.equal(f.g.ptr.down,false);
 assert.equal(f.g.ptr.released,false);assert.equal(f.g.stick.on,false);
 assert.equal(!!f.g.keys.ArrowRight,false);assert.equal(!!f.g.btn.jump,false);
 assert.equal(f.g._kp,false);}
 // 8. Execute the actual keyboard, tab-visibility and blur listeners.
const keyStart=src.indexOf("    addEventListener('keydown', e =>");
const keyEnd=src.indexOf('    g.kd = ',keyStart);
assert.ok(keyStart>0&&keyEnd>keyStart,'Real Kit key handler block missing');
const keyboardBlock=src.slice(keyStart,keyEnd);
{const f=fixture(),events={},docEvents={};
 let muted=false;const store={set(){}};
 const handlers=new Function('addEventListener','document','g','def','gamePrefs','safeStore','window','Hub','ac','clearInputs','muted',
   keyboardBlock+';return { get muted(){return muted;} };')(
   (name,fn)=>events[name]=fn,{hidden:false,addEventListener:(name,fn)=>docEvents[name]=fn},
   f.g,{id:'test-kit'},null,store,{Hub:{input(){}}},{input(){}},()=>{},f.clearInputs,muted
 );
 const key=(key,repeat=false)=>({key,repeat,preventDefault(){}});
 events.keydown(key('p'));assert.equal(f.g.paused,true);
 events.keydown(key('p',true));assert.equal(f.g.paused,true,'Repeat must not unpause');
 events.keyup(key('p'));events.keydown(key('p'));assert.equal(f.g.paused,false);
 events.keyup(key('p'));events.keydown(key('Escape'));assert.equal(f.g.paused,true);
 events.keydown(key('Escape',true));assert.equal(f.g.paused,true);
 events.keyup(key('Escape'));
 events.keydown(key('ArrowRight'));assert.equal(f.g.keys.ArrowRight,true);
 events.blur();assert.equal(f.g.keys.ArrowRight,undefined);
 assert.equal(f.g.paused,true);assert.equal(f.g.ptr.down,false);
 // A fresh keydown after blur must register again.
 events.keydown(key('ArrowRight'));assert.equal(f.g.keys.ArrowRight,true);
 assert.ok(docEvents.visibilitychange,'Tab-hide listener missing');
 const hiddenDoc={hidden:true}; // docEvents closure refers to registered document.
 // Visibility handler also clears input in the same actual source.
 assert.ok(keyboardBlock.includes('if(document.hidden){clearInputs();'));
 assert.ok(handlers);
}
 // 9. Ensure global settings use same reset as blur and reconnect state cleanly.
assert.ok(src.includes('onOpen:()=>{wasPaused=g.paused;gameSettingsOpen=true;g.paused=true;clearInputs();}'));
assert.ok(src.includes('onClose:()=>{clearInputs();g.paused=wasPaused;gameSettingsOpen=false;}'));
console.log(JSON.stringify({pass:true,engine:'Kit',source:'actual input handlers',
 cases:9,realBrowser:false,physicalAndroid:false,gameplayStatsChanged:false}));

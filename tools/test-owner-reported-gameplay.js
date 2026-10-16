#!/usr/bin/env node
'use strict';
// Owner-reported gameplay regressions. Source-backed deterministic simulations,
// NOT a 60 FPS, Android rendering, AAA art or prize-score certification.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const wanted=read('public/games-lib/wanted-run/game.js'),rail=read('public/games-lib/runner3x.js'),
  arrow=read('public/games-lib/arrow-hero/game.js'),kit=read('public/games-lib/kit.js');
for(const [file,src,module] of [
 ['public/games-lib/wanted-run/game.js',wanted,true],
 ['public/games-lib/runner3x.js',rail,true],
 ['public/games-lib/arrow-hero/game.js',arrow,false]
]){
 const args=module?['--input-type=module','--check','-']:['--check','-'];
 const out=cp.spawnSync(process.execPath,args,{input:src,encoding:'utf8',timeout:15000});
 assert.equal(out.status,0,file+' syntax: '+(out.stderr||out.stdout));
}
// The train's existing roof/landing calculation is preserved, but below-roof
// train contact must be fatal before side-impact stumble recovery can run.
const trainHit=rail.split('\n').find(l=>l.includes("if (it.kind === 'train' && iz + it.len / 2"));
const trainFatal=rail.split('\n').find(l=>l.includes("if (hit && it.kind === 'train') return die("));
const sideStumble=rail.indexOf("if (hit === 'side'");
assert.ok(trainHit&&trainFatal&&rail.indexOf(trainFatal)<sideStumble,'Train must take precedence over side stumble');
const trainCase=new Function('it','iz','pl','g','die','let hit=false;'+trainHit+'\n'+trainFatal+'\nreturn null;');
const train={kind:'train',lane:0,len:12,h:3,moving:false};
assert.equal(trainCase(train,0,{y:0},{},(_g,reason)=>reason),'Hit a train','Side train impact must kill run');
assert.equal(trainCase(train,0,{y:3.1},{},(_g,reason)=>reason),null,'Valid roof ride must survive');
assert.equal(trainCase({...train,lane:1},0,{y:0},{},(_g,reason)=>reason),'Hit a train','Collision handler sees valid train when chosen lane');

// Source-extracted Most Wanted frame method exercises the actual registered
// Kit descriptor without booting WebGL. Avoid shadow game logic in tests.
const updateMatch=wanted.match(/  update\(g, dt\) \{([\s\S]*?)\n  \},\n  draw\(g, c\)/);
assert.ok(updateMatch,'Most Wanted game update method was not found');
const update=new Function('Kit','toScreen','return function update(g,dt){'+updateMatch[1]+'\n};')(
 {lerp:(a,b,t)=>a+(b-a)*t,clamp:(x,a,b)=>Math.max(a,Math.min(b,x))},()=>({x:200,y:350}));
function game(obstacles){
 const g={W:400,H:700,t:0,frames:0,ptr:{down:false},car:{x:0,y:0,a:-Math.PI/2,sp:260},
   steer:0,heat:1,ht:0,next:999,sec:0,ls:0,parts:[],cops:[],obj:obstacles,
   blockedFor:0,bustTime:0,bumpCooldown:0,ended:[],
   ax:()=>0,R:(a)=>a,RI:()=>0,rnd:()=>0.5,
   sfx(){},shake(){},burst(){},float(){},mark(){},add(){},
   end(reason){this.ended.push(reason);return reason;}};
 return g;
}
{
 const g=game([{x:0,y:-35,r:10,k:'r'}]);
 for(let i=0;i<12;i++){g.t+=.05;g.frames++;update(g,.05);}
 assert.equal(g.ended.length,0,'Scenery must stop/bump car, never instantly end the game');
 assert.ok(g.car.y>-21,'Car must not phase through obstacle');
 assert.ok(g.blockedFor>.25,'Sustained scenery blockage should be tracked');
 // Cop approaches the pinned vehicle without crossing the obstacle itself.
 g.cops.push({x:0,y:9,a:0,sp:0,tank:false});
 for(let i=0;i<36&&!g.ended.length;i++){g.t+=.05;g.frames++;update(g,.05);}
 assert.ok(g.ended[0]&&g.ended[0].includes('BUSTED'),
   'A police car must eventually arrest a trapped player');
}
{
 const g=game([]);
 g.cops.push({x:0,y:0,a:0,sp:0,tank:false});
 for(let i=0;i<5;i++){g.t+=.05;g.frames++;update(g,.05);}
 assert.equal(g.ended.length,0,'A glancing police contact while mobile must not instantly end the run');
 assert.ok(g.car.y<0,'Chase driver must still move');
}
assert.ok(!wanted.includes("g.end('Wrecked on a"),'No crash-to-gameover scenery rule may return');
assert.ok(wanted.includes("new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)"),'Most Wanted must use local licensed source vehicles');
assert.ok(wanted.includes("sourceVehicle('kc-sedan-sports')"),'Every player must get the same default vehicle');
assert.ok(wanted.includes("replaceChaserPrototype(copP, 'kc-police', true)"),
  'Police chase must show licensed source police model');
assert.ok(wanted.includes("replaceChaserPrototype(tankP, 'kc-suv-luxury', false)"),
  'High-heat chase must display separately sourced silhouette');
const worldStart=wanted.indexOf('function render3d(g)');
const worldEnd=wanted.indexOf('window.__GL3',worldStart);
assert.ok(worldStart>0&&worldEnd>worldStart,'3D game frame render must be present');
const worldRender=wanted.slice(worldStart,worldEnd);
assert.ok(wanted.includes('const instanceWorld = new THREE.Matrix4(), instanceFinal = new THREE.Matrix4();'),
  'World instance matrices must be reusable global scratch objects');
assert.ok(worldRender.includes('instanceFinal.multiplyMatrices(instanceWorld, local)'),
  'Reuse matrix multiplication while preserving scenery transforms');
assert.ok(!worldRender.includes('new THREE.Matrix4()') &&
  !worldRender.includes('MM.clone().multiply(local)'),
  'Rendering 900 instanced props must not allocate a new matrix per prop per frame');
assert.ok(wanted.includes("get('vehicleQA')==='1'"),'Additional vehicle selection is QA-only before server unlocks');
for(const name of ["kc-police","kc-race-future","kc-suv-luxury","kc-ambulance","kc-firetruck","kc-taxi","kc-sedan-sports","kc-truck","kc-garbage-truck","kc-delivery"]){
 const file=path.join(root,'public/games-lib/assets3d',name+'.glb');
 const buf=fs.readFileSync(file);
 assert.ok(buf.length>30000&&buf.toString('ascii',0,4)==='glTF'&&buf.readUInt32LE(8)===buf.length,
   'Local source asset not a complete glTF 2.0 binary: '+name);
}
assert.ok(read('public/games-lib/assets3d/LICENSE-Kenney-CC0.txt').includes('CC0'),
  'Source licensing notice for real car models missing');
// Actual Kit's touch stick normally consumes pointerdown. Pointer mirroring is
// required so Arrow Hero can detect a touch on a skill card.
// Exercise Kit's actual input handlers instead of searching for a stale
// source-code literal. Arrow Hero needs touch to move its stick AND tap cards.
const pointerStart=kit.indexOf('    function onDown(e) {');
const pointerEnd=kit.indexOf("    cv.addEventListener('pointerdown', onDown)",pointerStart);
assert.ok(pointerStart>=0&&pointerEnd>pointerStart,'Kit pointer handlers missing');
const pointerHandler=new Function('g','def','btns','toL','touches','K','ac','window','Hub','gameSettingsOpen',
 kit.slice(pointerStart,pointerEnd)+String.fromCharCode(10)+'return {onDown,onMove,onUp};');
function pointerSample(mirror,endType='pointerup') {
 const g={state:'play',ptr:{x:0,y:0,down:false,pressed:false,released:false},
  stick:{x:0,y:0,on:false},btn:{},keys:{},inputs:0};
 const touches=new Map(),Hub={input(){}};
 const {onDown,onMove,onUp}=pointerHandler(g,{stick:true,stickAlsoPtr:mirror},[],
  e=>[e.clientX,e.clientY],touches,{clamp:(n,a,b)=>Math.max(a,Math.min(b,n))},
  ()=>{},{Hub},Hub,false);
 const ev=(type,x,y)=>({type,pointerType:'touch',pointerId:21,
  clientX:x,clientY:y,preventDefault(){}});
 onDown(ev('pointerdown',100,140));
 const start={kind:touches.get(21)?.k,pressed:g.ptr.pressed,down:g.ptr.down,stick:g.stick.on};
 onMove(ev('pointermove',125,140));
 const move={stickX:g.stick.x,ptrX:g.ptr.x};
 onUp(ev(endType,125,140));
 return {start,move,released:g.ptr.released,pressed:g.ptr.pressed,stickOn:g.stick.on};
}
const mirrored=pointerSample(true),exclusive=pointerSample(false),
 canceledTouch=pointerSample(true,'pointercancel');
assert.equal(mirrored.start.kind,'stick-ptr','Mirrored touch feeds the stick and pointer');
assert.equal(mirrored.start.pressed,true,'Skill card must receive mirrored down');
assert.equal(mirrored.move.stickX,0.5,'Mirror must still steer normally');
assert.equal(mirrored.move.ptrX,125,'Mirrored pointer must track finger movement');
assert.equal(mirrored.released,true,'Real finger-up must release skill-card tap');
assert.equal(exclusive.start.kind,'stick','Default virtual stick must stay exclusive');
assert.equal(exclusive.start.pressed,false,'Exclusive stick must not tap card');
assert.equal(exclusive.released,false,'Exclusive stick cannot click card on lift');
assert.equal(canceledTouch.released,false,'Canceled gesture must not click card');
assert.equal(canceledTouch.pressed,false,'Canceled pointer must clear pending press');

const inputCheck=cp.spawnSync(process.execPath,[path.join(root,'tools/test-kit-input-lifecycle.js')],{encoding:'utf8',timeout:15000});
assert.equal(inputCheck.status,0,'Complete Kit input lifecycle: '+inputCheck.stderr+inputCheck.stdout);
assert.ok(arrow.includes("stickAlsoPtr: true"),'Arrow Hero skill cards must receive touch taps');
assert.ok(arrow.includes('g.ptr.x >= 40 && g.ptr.x <= 360'),'Skills need explicit x hitboxes');
assert.ok(arrow.includes('g.ptr.y < 250 + i * 90 + 76'),'Only visible cards are selectable');
console.log(JSON.stringify({ok:true,tests:['train side hit is fatal','train roof landing safe',
 'scenery stops car without ending run','police arrest only when immobilized',
 'single rolling police contact survives','six local licensed vehicle assets',
 'same default car with QA-only preview','touch power-up selection receives pointer'] ,
 scope:'source+simulated physics/input only; no AAA or physical Android certificate'}));

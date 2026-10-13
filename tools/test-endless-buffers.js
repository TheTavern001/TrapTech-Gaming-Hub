#!/usr/bin/env node
'use strict';
// Isolated, deterministic source-physics regression for two endless games.
// This does not certify graphical quality, device FPS, scoring security, or AAA readiness.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ROOT = path.join(__dirname, '..');
function load(slug) {
  let definition;
  const Kit = {
    run(game) { definition = game; },
    lerp(a,b,t) { return a+(b-a)*Math.max(0,Math.min(1,t)); },
    clamp(x,min,max) { return Math.max(min,Math.min(max,x)); },
    rr() {}
  };
  const gameFile = path.join(ROOT,'public','games-lib',slug,'game.js');
  vm.runInNewContext(fs.readFileSync(gameFile,'utf8'), { Kit }, { filename: gameFile, timeout: 1500 });
  assert.ok(definition && typeof definition.init === 'function' && typeof definition.update === 'function', slug + ' game entry');
  return { definition, Kit };
}
function tunnel() {
  const { definition } = load('tunnel-hop');
  const g = {
    W:400,H:700,t:0,frames:0,ptr:{down:false,x:0},tap:()=>false,kd:()=>false,ax:()=>0,
    rnd:()=>0.9,RI:(a)=>a,sfx(){},add(){},end(){},hud:''
  };
  definition.init(g);
  let maxRows = 0;
  for (let i = 0; i < 14400; i++) {
    g.t += 0.5; g.frames++;
    definition.update(g,0.5);
    maxRows = Math.max(maxRows,g.rows.length);
    const tileIndex = Math.floor(g.z) + 1 - g.rowBase;
    assert.ok(Array.isArray(g.rows[tileIndex]), 'collision row missing at frame '+i);
  }
  assert.ok(g.z > 100000, 'two-hour run advances');
  assert.ok(g.rowBase > 100000, 'row base rolls forward');
  assert.ok(maxRows <= 80, 'tunnel buffer exceeded 80 rows: '+maxRows);
  return {seconds:7200,maxRetainedRows:maxRows,meters:Math.floor(g.z)};
}
function drift() {
  const { definition, Kit } = load('drift-king');
  let seed = 1234;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const g = {
    W:400,H:700,t:0,frames:0,pts:[],parts:[],car:{},points:0,ended:0,
    held:()=>false,R:(a,b)=>a+(b-a)*rand(),sfx(){},burst(){},
    end(){this.ended++;},add(n){this.points+=n;}
  };
  definition.init(g);
  let maxPoints = 0;
  for (let i = 0; i < 4000; i++) {
    const next = g.pts[Math.min(g.pts.length-1,g.last+1)];
    assert.ok(next,'road has forward segment');
    g.car.x = next[0]; g.car.y = next[1];
    g.t = i/6; g.frames++; g.parts.length = 0; // Particles are separately owned by the engine.
    definition.update(g,1e-9);
    assert.ok(g.last >= 0 && g.last < g.pts.length,'road index valid');
    maxPoints = Math.max(maxPoints,g.pts.length);
  }
  assert.equal(g.ended,0,'in-sample steered run never collides');
  assert.equal(g.points,13659,'road-scoring behavior must remain unchanged');
  assert.equal(seed,982989590,'seeded road generation must remain unchanged');
  assert.ok(maxPoints <= 64,'road geometry exceeded 64 points: '+maxPoints);
  const canvas = {
    lines:0,beginPath(){},lineTo(){this.lines++},moveTo(){this.lines++},
    stroke(){},save(){},translate(){},rotate(){},fillRect(){},fill(){},restore(){}
  };
  definition.draw(g,canvas);
  assert.ok(canvas.lines<=128,'Canvas road redraw grew unbounded: '+canvas.lines);
  return {steps:4000,maxRoadPoints:maxPoints,drawNodes:canvas.lines,score:g.points};
}

function dirtEndurance(){
 const {definition}=load('dirt-dash'),g={W:400,H:700,t:0,frames:0,keys:{ArrowRight:true},btnP:{},btn:{},ptr:{down:false},rnd:()=>.73,R:(a,b)=>a+(b-a)*.43,RI:()=>2,kd:()=>false,add(){},sfx(){},float(){},burst(){},shake(){},end(){}};
 definition.init(g);g.lane=-1;let max=0;
 for(let i=0;i<14400;i++){g.frames++;g.t+=.5;definition.update(g,.5);max=Math.max(max,g.obs.length);assert.ok(g.obs.length<=40&&g.obs.some(o=>o.x>g.x+1000),'Dirt Dash ongoing hazards '+i);}
 assert.ok(g.x>200000&&g.nextHazardX>g.x,'Dirt Dash crosses original horizon');
 return {distance:Math.floor(g.x),maxBuffered:max};
}
function hillEndurance(){
 const src=fs.readFileSync(path.join(ROOT,'public/games-lib/hill-hauler/game.js'),'utf8');
 const m=src.match(/  function refillItems\(g,cx\)\{[\s\S]*?\n  \}/);assert.ok(m,'Missing Hill Hauler refill generator');
 const fn=vm.runInNewContext('('+m[0].trim()+')',{},{timeout:1500});
 const g={items:[],nextItemX:600,rnd:()=>.4,R:(a,b)=>a+(b-a)*.43};let max=0,fuel=0;
 for(let x=160;x<360000;x+=150){fn(g,x);max=Math.max(max,g.items.length);fuel+=g.items.filter(v=>v.x>60000&&v.x>x+1000&&v.k==='f').length;assert.ok(g.items.length<=35,'Unbounded Hill Hauler pickups');}
 assert.ok(g.nextItemX>360000&&fuel>0,'Fuel stops after 60000');
 return {spawnThrough:Math.floor(g.nextItemX),maxBuffered:max,fuelPast60000:fuel};
}
const a=tunnel(),b=drift(),c=dirtEndurance(),d=hillEndurance();
console.log(JSON.stringify({test:'source physics/memory regression only',tunnel:a,drift:b,dirt:c,hill:d,passed:true},null,2));

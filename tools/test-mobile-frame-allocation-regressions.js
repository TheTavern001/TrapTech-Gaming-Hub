#!/usr/bin/env node
'use strict';
// Repeatable source-only mobile frame-allocation regressions.
// Does not replace measured p50/p95 FPS, device heat or screenshot QA.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const cases=[
 ['public/games-lib/cup-toss/game.js',false],
 ['public/games-lib/wanted-run/game.js',true]
];
for(const [file,esm] of cases){
  const source=read(file);
  const args=esm?['--input-type=module','--check','-']:['--check','-'];
  const result=cp.spawnSync(process.execPath,args,{encoding:'utf8',input:source,timeout:15000});
  assert.equal(result.status,0,'Game syntax check '+file+': '+(result.stderr||result.stdout));
  assert.ok(!/setTimeout\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*,\s*0\s*\)/.test(source),
    'Do not queue no-op timers inside a game frame: '+file);
}
const cup=read('public/games-lib/cup-toss/game.js');
assert.ok(cup.includes('newBall(g);'),'Cup Toss must still provide replacement balls');
assert.ok(cup.includes("g.end('Out of balls')"),'Cup Toss failure rule must remain intact');
assert.ok(cup.includes("g.add(500 * g.racks, 'rack')"),'Cup Toss rerack scoring must remain intact');
const chase=read('public/games-lib/wanted-run/game.js');
const start=chase.indexOf('function render3d(g)'),end=chase.indexOf('window.__GL3',start);
assert.ok(start>0&&end>start,'Chase renderer boundary missing');
const frame=chase.slice(start,end);
assert.ok(chase.includes('const instanceWorld = new THREE.Matrix4(), instanceFinal = new THREE.Matrix4()'),
 'Instancing transform objects must be created once outside the render loop');
assert.ok(frame.includes('instanceFinal.multiplyMatrices(instanceWorld, local)') &&
 frame.includes('im.setMatrixAt(n, instanceFinal)'),
 'Rendered placement still uses the exact composed instance transform');
assert.ok(!/new THREE\.(?:Matrix4|Quaternion|Vector3)\s*\(/.test(frame) &&
 !frame.includes('.clone().multiply(local)'),
 'Scenery transforms must not allocate per rendered prop');
assert.ok(chase.includes("replaceChaserPrototype(copP, 'kc-police', true)"));
assert.ok(chase.includes("replaceChaserPrototype(tankP, 'kc-suv-luxury', false)"));
console.log(JSON.stringify({pass:true,gamePaths:cases.map(x=>x[0]),checks:11,
 impact:'removed no-op Cup Toss scheduling and chase frame transform allocations',
 scope:'source only; full Docker and physical 60fps hardware QA pending'}));

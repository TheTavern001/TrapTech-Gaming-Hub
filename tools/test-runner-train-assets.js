#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'public/games-lib/runner3x.js'),'utf8');
const assets=[{"id":"tr-train-diesel-b","sha":"f518929cf8961f42dd0aeda8ead9a569560ad290","bytes":19480},{"id":"tr-train-carriage-container-blue","sha":"f5f38eb8b8dcda5c9431cdbac33afe4093e1a3f7","bytes":19916},{"id":"tr-train-carriage-tank-large","sha":"42b2826e4502a8406810475ffc60cb1330bbf18a","bytes":18360},{"id":"tr-train-tram-classic","sha":"6f8099d1875ee4f010cfbe5fac56230b9067eaff","bytes":24184},{"id":"tr-train-electric-city-b","sha":"d87ddc67dd7920bd55d108e74f9643a1ce70424b","bytes":22200}];
for(const a of assets){
 const b=fs.readFileSync(path.join(root,'public/games-lib/assets3d/'+a.id+'.glb'));
 assert.equal(b.length,a.bytes);assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
 // GLB magic alone is insufficient: require a real JSON mesh description.
 assert.equal(b.toString('ascii',16,20),'JSON','Expected JSON chunk '+a.id);
 const jsonBytes=b.readUInt32LE(12);
 assert.ok(jsonBytes>16&&jsonBytes<b.length-20,'Invalid GLB JSON length '+a.id);
 const scene=JSON.parse(b.subarray(20,20+jsonBytes).toString('utf8').trim());
 assert.ok(Array.isArray(scene.meshes)&&scene.meshes.length>=1,'No source mesh '+a.id);
 assert.ok(scene.meshes.some(m=>m.primitives?.length>=1),'No real triangles '+a.id);

 const sha=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(sha,a.sha,'Original train art drift '+a.id);
 assert.ok(src.includes('originalTrain(id)'),'Train source never used');
}
const def=src.match(/export function railTrainVisualFit\([\s\S]*?\n\}/);
assert.ok(def);const fit=new Function(def[0].replace('export ','')+'return railTrainVisualFit;')();
for(const [v,rot] of [[[2.3,3,9.5,2.2,2.9,9.3],false],[[9.5,3,2.3,2.2,2.9,9.3],true]]){
 const r=fit(...v);assert.equal(r.rotate,rot);
 const w=rot?v[2]:v[0],len=rot?v[0]:v[2];
 assert.ok(r.scale*w<=v[3]+1e-6&&r.scale*v[1]<=v[4]+1e-6&&r.scale*len<=v[5]+1e-6);
}
assert.equal(fit(0,1,1,1,1,1),null);
assert.ok(src.includes("Math.floor(g.score).toLocaleString('en-US')"));
assert.ok(src.includes("const portrait=cam.aspect<0.72"));
assert.ok(src.includes("g.mult = (1 + Math.min(4, Math.floor(g.coins / 50)))"));
assert.ok(src.includes("if (it.kind === 'train' && iz + it.len / 2"));

assert.ok(src.includes("function saloon(g,x,z,s)"),'Source-built saloon facade missing');
for(const mesh of ['ot-wall-door','ot-wall-wood-window-glass','ot-wall-wood-window-small','ot-roof-flat','ot-lantern']){
 assert.ok(src.includes("place('"+mesh+"'")||src.includes("'"+mesh+"'"),'Original licensed storefront mesh not used '+mesh);
}
assert.ok(src.includes("new THREE.TubeGeometry(c, 20, 0.018, 8)"),'Thin smooth overhead wires missing');
assert.ok(src.includes("s < 0 && j === 2"),'Near-camera overhead clutter not removed');

 // Keep mechanics identical to the exact source last known to have worked.
 // These are intentionally non-cryptographic FNV fingerprints of code sections
 // to detect accidental physics/seed/score drift during this VISUAL patch.
function fnv1a(s){let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619)>>>0;}return n.toString(16).padStart(8,'0');}
const segments=[
 ['update(g, dt) {','    draw(g, c) {','3308fca7','physics + collisions + scores'],
 ['function pattern(','  let setTheme =','f566e9d2','obstacle spawn and RNG'],
 ['function play(n, fade) {','  // ---- per-theme scenery rows','a2fe9e32','runner animation state machine']
];
for(const [begin,end,expected,label] of segments){
 const from=src.indexOf(begin),to=src.indexOf(end,from);
 assert.ok(from>=0&&to>from,'Missing '+label);
 assert.equal(fnv1a(src.slice(from,to)),expected,'Changed '+label+' during visual-only patch');
}
console.log(JSON.stringify({passed:true,trainModels:assets.length,visualOnly:true,AAAApproved:false}));

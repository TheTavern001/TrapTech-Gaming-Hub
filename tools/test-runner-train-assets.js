#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),src=fs.readFileSync(path.join(root,'public/games-lib/runner3x.js'),'utf8');
const assets=[{"id":"tr-train-diesel-b","sha":"f518929cf8961f42dd0aeda8ead9a569560ad290","bytes":19480},{"id":"tr-train-carriage-container-blue","sha":"f5f38eb8b8dcda5c9431cdbac33afe4093e1a3f7","bytes":19916},{"id":"tr-train-carriage-tank-large","sha":"42b2826e4502a8406810475ffc60cb1330bbf18a","bytes":18360},{"id":"tr-train-tram-classic","sha":"6f8099d1875ee4f010cfbe5fac56230b9067eaff","bytes":24184},{"id":"tr-train-electric-city-b","sha":"d87ddc67dd7920bd55d108e74f9643a1ce70424b","bytes":22200}];
for(const a of assets){
 const b=fs.readFileSync(path.join(root,'public/games-lib/assets3d/'+a.id+'.glb'));
 assert.equal(b.length,a.bytes);assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);assert.equal(b.readUInt32LE(8),b.length);
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
console.log(JSON.stringify({passed:true,trainModels:assets.length,visualOnly:true,AAAApproved:false}));

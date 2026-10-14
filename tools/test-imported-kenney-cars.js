#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p));
const manifest=JSON.parse(read('docs/audit/KENNEY-CAR-KIT-IMPORTED-2026-10-13.json').toString());
assert.equal(manifest.license,'CC0-1.0');
assert.equal(manifest.assetQualityApproved,false,'Cannot pre-certify unreviewed 3D');
assert.equal(manifest.scoreEffects,false);
assert.equal(manifest.objects.length,10);
const seen=new Set();
for(const entry of manifest.objects){
 assert.match(entry.id,/^kc-[a-z-]+$/);
 assert.ok(!seen.has(entry.id));seen.add(entry.id);
 const resolved=path.resolve(root,entry.relativePath);
 assert.ok(resolved.startsWith(path.resolve(root,'public/games-lib/assets3d')+path.sep));
 const b=fs.readFileSync(resolved);
 assert.equal(b.length,entry.bytes,'Asset size drift: '+entry.id);
 assert.equal(b.toString('ascii',0,4),'glTF','Not a GLB: '+entry.id);
 assert.equal(b.readUInt32LE(4),2,'Only glTF v2 accepted');
 assert.equal(b.readUInt32LE(8),b.length,'Truncated GLB: '+entry.id);
 const h=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(h,entry.gitBlobSha,'Source Git blob differs: '+entry.id);
 const jsonSize=b.readUInt32LE(12);
 const kind=b.toString('ascii',16,20);
 assert.equal(kind,'JSON');
 assert.ok(jsonSize>0&&jsonSize<b.length);
 const gltf=JSON.parse(b.subarray(20,20+jsonSize).toString('utf8'));
 assert.equal(gltf.asset.version,'2.0');
 assert.ok((gltf.meshes||[]).length>0,'No mesh in '+entry.id);
 assert.ok((gltf.images||[]).every(im=>Number.isInteger(im.bufferView)||String(im.uri||'').startsWith('data:')),
  'Car depends on missing external texture '+entry.id);
}
const game=read('public/games-lib/wanted-run/game.js').toString();
assert.ok(game.includes("sourceVehicle('kc-sedan-sports')"),'All players must start with same car');
assert.ok(game.includes("replaceChaserPrototype(copP, 'kc-police', true)"),
  'Pursuing police must use licensed Kenney cruiser rather than only a box car');
assert.ok(game.includes("replaceChaserPrototype(tankP, 'kc-suv-luxury', false)"),
  'High-heat pursuer must use a distinct licensed Kenney SUV silhouette');
assert.ok(game.includes('const beacons = hasBeacons && Array.isArray(template.userData.lights)'),
  'Red/blue original police beacons must be preserved on model swap');
assert.ok(game.includes('template.add(model, ...beacons);'),
  'Police light children must remain direct children for the existing render loop');
assert.ok(game.includes('Keeping procedural chase-car fallback after GLB load failure'),
  'Asset loading failure must preserve gameplay even on weak mobile networks');
// The in-game list is emitted as JSON text (double quotes); read its actual
// model identifiers, do not search for a fragile quote style.
const listSource=game.match(/const VEHICLES = (\[[^\n]+\]);/);
assert.ok(listSource,'In-game vehicle selector data missing');
const selectable=JSON.parse(listSource[1]);
assert.equal(selectable.length,manifest.objects.length,'Some source models are missing from in-game preview');
const inGameIds=new Set(selectable.map(v=>v[0]));
for(const entry of manifest.objects)assert.ok(inGameIds.has(entry.id),'Imported model not available in in-game preview '+entry.id);
assert.ok(game.includes("get('vehicleQA')==='1'"),'Do not sell unapproved variants');
assert.ok(read(manifest.licenseRecord).toString().includes('CC0'),'CC0 grant missing');
console.log(JSON.stringify({pass:true,kenneyModels:manifest.objects.length,license:'CC0',scoreEffects:false,qualityApproved:false}));

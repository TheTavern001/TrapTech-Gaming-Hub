#!/usr/bin/env node
'use strict';
// Source-only Quaternius rig QA. An intact humanoid GLB is NOT a finished
// modular outfit system or an Android frame-rate/owner approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'docs/audit/QUATERNIUS-NEUTRAL-STARTER-QA-2026-10-14.json'),'utf8'));
const file=path.resolve(root,meta.path);
assert.ok(file.startsWith(path.resolve(root,'public/assets/avatars/rigged')+path.sep));
const buf=fs.readFileSync(file);
assert.equal(buf.length,meta.bytes,'Starter source binary truncated');
assert.equal(buf.toString('ascii',0,4),'glTF');
assert.equal(buf.readUInt32LE(4),meta.glbVersion);
assert.equal(buf.readUInt32LE(8),buf.length);
assert.equal(buf.toString('ascii',16,20),'JSON');
const gitHash=crypto.createHash('sha1').update(Buffer.from('blob '+buf.length+'\0')).update(buf).digest('hex');
assert.equal(gitHash,meta.gitBlobSha,'Exact upstream source blob not preserved');
const size=buf.readUInt32LE(12);
assert.ok(size>1000&&size<buf.length);
const json=JSON.parse(buf.subarray(20,20+size).toString('utf8'));
assert.equal(json.asset.version,'2.0');
assert.equal(json.skins.length,1);
assert.equal(json.skins[0].joints.length,meta.skinJoints);
assert.equal(json.meshes.length,meta.meshCount);
assert.equal((json.images||[]).length,meta.images);
assert.equal((json.animations||[]).length,meta.animations);
assert.ok((json.buffers||[]).every(b=>!b.uri||b.uri.startsWith('data:')),
 'A standalone GLB must not load cross-origin resources');
const nodeNames=new Set(json.skins[0].joints.map(index=>json.nodes[index]?.name));
for(const joint of ['root','pelvis','spine_01','Head','hand_l','hand_r'])
 assert.ok(nodeNames.has(joint),'Missing required Quaternius human bone '+joint);
assert.equal(meta.status,'QA_IMPORT_ONLY_NOT_DEFAULT');
for(const field of ['sceneRenderVerified','animRetargetVerified','modularSlotsVerified',
 'skinFaceMakeupVerified','androidP95Verified','entitlementVerified',
 'ownerApproved','defaultEnabled']) assert.equal(meta[field],false,
  'Do not certify unreviewed rig capability: '+field);
assert.equal(meta.license,'CC0-1.0');
// A QA query flag may display this source rig in the existing avatar editor,
// but the current live/published starter must remain the owner-approved look.
const renderer=fs.readFileSync(path.join(root,'public/js/avatar-rig.js'),'utf8');
const dispatcher=fs.readFileSync(path.join(root,'public/js/avatar-3d.js'),'utf8');
assert.ok(renderer.includes("neutralQa:'/assets/avatars/rigged/quaternius-neutral-starter-qa.glb'"));
assert.ok(renderer.includes("new URLSearchParams(location.search).get('avatarRigQA')==='1'"));
assert.ok(dispatcher.includes("new URLSearchParams(location.search).get('avatarRigQA')==='1'"));
assert.ok(dispatcher.includes("if(neutralQa)return true"));
assert.ok(dispatcher.includes("return cfg.outfit === 'adventurer'"),'Keep existing publicly supported rig behavior');
console.log(JSON.stringify({pass:true,source:'Quaternius Universal Base Characters CC0',
 bytes:buf.length,joints:nodeNames.size,meshes:json.meshes.length,
 qaOnly:true,completedModularAvatar:false,deviceTested:false}));

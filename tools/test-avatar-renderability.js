#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const r=JSON.parse(fs.readFileSync(path.join(__dirname,'../docs/audit/avatar-renderability.json')));
assert.equal(r.schemaVersion,1);
assert.equal(r.neutralStarterConfigured,true);
assert.equal(r.neutralStarterCanUseLicensedRig,false);
assert.equal(r.authoredNeutralModularRigCertified,false);
assert.equal(r.onCharacter3DWearablesCertified,0);
assert.equal(r.visualAAAApproved,false);
assert.equal(r.includedLicense,true);
assert.equal(r.existingRigFiles.length,2);
assert.ok(r.existingRigFiles.every(x=>x.bytes>100000));
assert.deepEqual(r.generatedShopItemTypes,['banner','frame','color','title','badge','effect']);
assert.deepEqual(r.missingFiles,[]);
console.log('PASS avatar source renderability report: 2 clothed rigs; 0 approved neutral rigs/3D wearables');

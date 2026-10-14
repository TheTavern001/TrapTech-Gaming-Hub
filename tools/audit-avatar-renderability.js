#!/usr/bin/env node
'use strict';
// Source inventory, NOT a visual certification. No network or player DB.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const rd=p=>fs.readFileSync(path.join(root,p),'utf8');
const avatar=rd('src/avatars.js');
const preview=rd('public/js/avatar-3d.js');
const rig=rd('public/js/avatar-rig.js');
const shop=rd('src/shop-gen.js');
const rigFiles=['male-adventurer.gltf','female-adventurer.gltf']
 .map(name=>'public/assets/avatars/rigged/'+name);
const missing=rigFiles.filter(p=>!fs.existsSync(path.join(root,p)));
const license='public/assets/avatars/rigged/LICENSE-Quaternius-CC0.txt';
if(!fs.existsSync(path.join(root,license)))missing.push(license);
const types=shop.match(/const TYPES = \[([^\]]+)\]/);
if(!types)throw Error('Shop type declaration missing');
const profileTypes=types[1].match(/[a-z]+/g);
const starterIsNeutral=avatar.includes("outfit: 'base'");
const licensedRigRequiresClothes=preview.includes("cfg.outfit === 'adventurer'");
if(!rig.includes('male-adventurer.gltf')||!rig.includes('female-adventurer.gltf'))missing.push('rig source mapping');
const report={
 schemaVersion:1,scope:'Static asset source audit; no owner visual signoff',
 existingRigFiles:rigFiles.map(p=>({path:p,bytes:fs.existsSync(path.join(root,p))?fs.statSync(path.join(root,p)).size:0})),
 includedLicense:fs.existsSync(path.join(root,license)),
 neutralStarterConfigured:starterIsNeutral,
 neutralStarterCanUseLicensedRig:!(starterIsNeutral&&licensedRigRequiresClothes),
 neutralSourceRigQaCandidate:fs.existsSync(path.join(root,'public/assets/avatars/rigged/quaternius-neutral-starter-qa.glb')),
 neutralSourceRigQaOnly:true,
 authoredNeutralModularRigCertified:false,
 onCharacter3DWearablesCertified:0,
 generatedShopItemTypes:profileTypes,
 generatedShopIsProfileDecorationOnly:true,
 missingFiles:missing,
 visualAAAApproved:false,
 required:['official modular neutral body import','free real facial shaping','compatible clothing and hair meshes','skeletal emotes','PBR/LOD and Android GPU test','preview/ownership/purchase verification','owner image signoff']
};
const dst=path.join(root,'docs/audit/avatar-renderability.json');
fs.mkdirSync(path.dirname(dst),{recursive:true});
fs.writeFileSync(dst,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({rigs:rigFiles.length,profileTypes,neutralReady:report.neutralStarterCanUseLicensedRig,certified3DWearables:0,missing:missing.length}));
if(missing.length)process.exitCode=1;

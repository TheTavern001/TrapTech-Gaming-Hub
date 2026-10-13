#!/usr/bin/env node
'use strict';
// Read-only cosmetic renderability admission; does not touch real user DB,
// mint cosmetics or certify placeholder previews as premium 3D wardrobe.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),text=p=>fs.readFileSync(path.join(root,p),'utf8');
const get=p=>fs.existsSync(path.join(root,p));
const shop=(()=>{const m={exports:{}};vm.runInNewContext(text('src/shop-gen.js'),{module:m,console},{timeout:4000});return m.exports;})();
const db={exec(){},prepare(){return {get(){return {found:1}},all(){return []},run(){return {changes:1}}}},transaction:fn=>fn};
const avatar=(()=>{const m={exports:{}};vm.runInNewContext(text('src/avatars.js'),{module:m,console,Date,process:{env:{}},require:n=>n==='./db'?db:n==='crypto'?require('node:crypto'):null},{timeout:5000});return m.exports;})();
const parts=avatar.P,byKind={};
for(const p of parts)byKind[p.kind]=(byKind[p.kind]||0)+1;
const sourceCode=text('public/js/avatar-3d.js'),rigCode=text('public/js/avatar-rig.js');
const neutralRigDefined=/sources\s*=\s*\{[^}]*base-(?:male|female|other)/.test(rigCode);
const procedural=sourceCode.includes('function ball(')||sourceCode.includes('new THREE.SphereGeometry');
const onlyAdventurerRig=/cfg\.outfit\s*===\s*'adventurer'/.test(sourceCode);
const rigSource=['male-adventurer.gltf','female-adventurer.gltf'].map(name=>({
 name,exists:get('public/assets/avatars/rigged/'+name)}));
const generatedTypes=shop.TYPES;
const profileKinds=['banner','frame','color','title','badge','effect'];
if(generatedTypes.some(x=>!profileKinds.includes(x)))throw Error('New generated wearable kind needs renderability classifier');
const defaultAvatar=avatar.defaultFor();
const baseNeutralReady=neutralRigDefined&&!onlyAdventurerRig;
const sample=shop.make('d',25000,0),sampleThumb=typeof shop.itemThumbSvg==='function' ? shop.itemThumbSvg(sample):'';
const report={schemaVersion:1,category:'source/asset admission ONLY, not AAA certification',
 avatarPartCount:parts.length,avatarPartKinds:byKind,
 starter:{outfit:defaultAvatar.outfit,neutralRigVerified:baseNeutralReady,thirdPresentationRigVerified:false},
 rigSource,proceduralFallbackPresent:procedural,adventurerOutfitOnlyRig:onlyAdventurerRig,
 generatedShop:{types:generatedTypes,surface:'SVG/CSS profile assets, not 3D wearable GLB',sampleId:sample.id,
 sampleIsSvg:typeof sampleThumb==='string'&&sampleThumb.includes('<svg')},
 wearable3dAssetsIndividuallyCertified:0,shop3dAssetsIndividuallyCertified:0,
 blockers:[
 'No neutral modular male/female/other compatible glTF body source shipped',
 'Current neutral starter selects procedural fallback rather than rigged character',
 'No wearable-SKU-to-source-mesh attachment and clipping/LOD/license manifest',
 'Generated SVG/CSS profiles cannot be presented as 3D wardrobe items',
 'No physical Samsung/WebGL preview and owner 2026 art acceptance'
 ],
 preserved:['Existing purchased profile cosmetics remain valid 2D profile assets',
 'Shop profile catalog and ownership are unchanged','Live user database untouched']
};
const out=path.join(root,'docs/audit/wardrobe-renderability.json');
fs.mkdirSync(path.dirname(out),{recursive:true});
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:true,avatarParts:parts.length,types:generatedTypes,
 neutralRigVerified:baseNeutralReady,realWearablesCertified:0,report:'docs/audit/wardrobe-renderability.json'}));

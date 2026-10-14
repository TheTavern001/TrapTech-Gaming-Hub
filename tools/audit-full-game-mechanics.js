#!/usr/bin/env node
'use strict';
// Whole-catalog source-only mechanics/asset audit. It is NOT a claim that a
// syntax-valid title has been playtested or has AAA-quality artwork.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..'),lib=require('../src/games-lib').games;
const read=p=>{try{return fs.readFileSync(p,'utf8')}catch{return ''}};
const base=path.join(ROOT,'public','games-lib'),cfg=read(path.join(ROOT,'src/config.js'));
const coreBlock=(cfg.match(/const GAMES = \[([\s\S]*?)\n\];/)||[])[1]||'';
const core=[...coreBlock.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
 .map(m=>({id:m[1],title:m[2],module:m[3]}))
 .filter(g=>!['plinko','spin-to-win','blazed-roulette'].includes(g.id));
function collectJs(dir,max=28){
 if(!fs.existsSync(dir))return [];
 let out=[],queue=[dir];
 while(queue.length&&out.length<max){
  const here=queue.shift();
  for(const f of fs.readdirSync(here,{withFileTypes:true})){
   if(f.name==='node_modules'||f.name==='vendor'||f.name==='assets'||f.name==='img')continue;
   const p=path.join(here,f.name);
   if(f.isDirectory()&&queue.length<10)queue.push(p);
   else if(f.isFile()&&/\.m?js$/.test(f.name))out.push(p);
  }
 }
 return out.slice(0,max);
}
const same=(a,b)=>a&&b&&a===b;
const OWNER={
 'gl-wreck-ride':['hill-physics','gl-hill-hauler','ARCHIVED_OVERLAP'],
 'gl-egg-roll':['hill-physics','gl-hill-hauler','ARCHIVED_OVERLAP'],
 'gl-monster-crush':['hill-physics','gl-hill-hauler','ARCHIVED_OVERLAP'],
 'gl-rig-rally':['hill-physics','gl-hill-hauler','ARCHIVED_OVERLAP'],
 'gl-dune-glide':['hill-physics','gl-hill-hauler','ARCHIVED_OVERLAP'],
 'gl-hill-hauler':['hill-physics',null,'ACTIVE_REFERENCE_NEEDS_DEVICE'],
 'gl-drift-king':['drift-racing','drift-rush','ARCHIVED_OVERLAP'],
 'drift-rush':['drift-racing',null,'ACTIVE_REFERENCE_NEEDS_DEVICE']
};
const REPORTED={
 'gl-wanted-run':'Scenery impacts must not immediately end; police must immobilize for bust; integrate licensed diverse car models',
 'gl-rail-rush':'Trains must have solid collision geometry; roof/ramp excepted',
 'gl-arrow-hero':'Touch selection of level-up options interferes with virtual stick',
 'gl-hill-hauler':'Consolidate all lookalike hill game variants into one strong representative',
 'drift-rush':'Drift King and Drift Rush must not be interchangeable'
};
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function mapGame(g,type){
 const dir=type==='library'?path.join(base,g.slug):path.join(ROOT,'public/js',path.dirname(g.module));
 const primary=type==='library'?path.join(dir,'game.js'):path.join(ROOT,'public/js',g.module);
 const jsPaths=type==='library'?collectJs(dir):[primary];
 const parts=jsPaths.map(p=>({file:path.relative(ROOT,p),src:read(p)}));
 const source=parts.map(x=>x.src).join('\n'),authorFiles=parts.filter(x=>x.src);
 const cue=s=>source.includes(s);
 const engine=cue('HillCar(')?'hillcar':cue('TopCar(')?'topcar':cue('Runner3D(')?'runner3d':
   cue('Kit.run(')?'kit':cue('THREE.WebGLRenderer')?'threejs-custom':cue('Arena(')?'arena':
   type==='core'?'core-html5':'custom-or-multifile';
 const pair=OWNER[g.id]||[];
 const detect=engine==='hillcar'?'hillcar-other-candidates':engine==='topcar'?'topcar-other-candidates':
   engine==='runner3d'?'runner3d-other-candidates':null;
 const assetFiles=type==='library'?fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^(CREDITS|LICENSE)/i.test(x)):[]:[];
 return {
  id:g.id,title:g.title,slug:g.slug||g.id,kind:type,registered:true,playable:g.playable!==false&&!g.retired,
  retired:!!g.retired,replacedBy:g.replacedBy||null,mechanicsFamily:pair[0]||detect||'UNCLASSIFIED',
  ownerDistinctnessVerdict:pair[2]||'REQUIRES_MANUAL_GAMEPLAY_COMPARISON',
  engineSignature:engine,referenceLoop:type==='library'?g.ref_internal:null,
  scannedCodePaths:authorFiles.map(x=>x.file),scannedBytes:authorFiles.reduce((sum,x)=>sum+x.src.length,0),
  sourceSha256:source?hash(source):null,missingReadableJs:!authorFiles.length,
  assetProvenanceFiles:assetFiles,assetLicenseVerifiedForActualGame:false,
  gameplayComparedToInspiration:false,duplicateVerdictApproved:false,
  keyboardQa:'NOT_RUN',touchQa:'NOT_RUN',gamepadQa:'NOT_RUN',
  collisionPhysicsQa:'NOT_RUN',endlessScoreQa:'NOT_RUN',scoreForgeryQa:'NOT_RUN',
  avatarInGameQa:'NOT_RUN',audioQa:'NOT_RUN',pbrVisualQa:'NOT_RUN',
  realAndroidQa:'NOT_RUN',desktopQa:'NOT_RUN',mobileP95FrameMs:null,
  ownerIssue:REPORTED[g.id]||null,aaaCertified:false
 };
}
const entries=[...core.map(g=>mapGame(g,'core')),...lib.map(g=>mapGame(g,'library'))];
if(core.length!==13||lib.length<80||entries.length!==core.length+lib.length)
 throw Error('Known baseline source inventory changed: core='+core.length+' library='+lib.length);
if(new Set(entries.map(g=>g.id)).size!==entries.length)throw Error('Duplicate game ID in audit');
const familyGroups={};
for(const g of entries)if(g.mechanicsFamily!=='UNCLASSIFIED')(familyGroups[g.mechanicsFamily]??=[]).push(g.id);
const out={
 version:1,createdAtUTC:new Date().toISOString(),auditType:'SOURCE_ONLY_NOT_AAA',
 coreRegistered:core.length,libraryRegistered:lib.length,historicalRegistered:entries.length,
 proposedPlayable:entries.filter(g=>g.playable).length,ownerArchivedDuplicates:entries.filter(g=>g.retired).length,
 sourceFilesScanned:entries.reduce((x,g)=>x+g.scannedCodePaths.length,0),
 sourceUnresolved:entries.filter(g=>g.missingReadableJs).map(g=>g.id),familyGroups,
 caution:'Engine signature or different source SHA is not proof of unique gameplay. All devices, art and scoring evidence remain NOT_RUN until actually tested.',
 games:entries
};
const dest=path.join(ROOT,'docs','audit','ALL-GAME-MECHANICS-SOURCE-LEDGER.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({audit:out.auditType,core:core.length,library:lib.length,historical:entries.length,
 playable:out.proposedPlayable,archived:out.ownerArchivedDuplicates,sourceFiles:out.sourceFilesScanned,
 unresolved:out.sourceUnresolved.length,report:path.relative(ROOT,dest)}));

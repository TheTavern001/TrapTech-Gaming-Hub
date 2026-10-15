#!/usr/bin/env node
'use strict';
// Whole-catalog source-only mechanics/asset audit. It is NOT a claim that a
// syntax-valid title has been playtested or has AAA-quality artwork.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {importSpecs}=require('./local-imports');
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
// Walk the actual browser-local script graph, not merely the tiny title wrapper.
// Many competition mechanics are implemented in ../runner3x.js, ../td.js, arena.js,
// imported open-source js/*, or a core game's ./games/engine.js.
function runtimeScripts(type,g,primary,localPaths){
 const publicRoot=path.join(ROOT,'public')+path.sep;
 const seen=new Set(),queue=[...localPaths],missing=[],external=[];
 const html=type==='library'?read(path.join(base,g.slug,'index.html')):'';
 const htmlPath=path.join(base,g.slug,'index.html');
 function add(spec,from){
  const raw=String(spec||'').split(/[?#]/)[0];
  if(!raw || /^(?:https?:|data:|\/\/)/i.test(raw)){if(raw)external.push(raw);return;}
  // Bare ESM import names are resolved by the document import map.
  if(!raw.startsWith('/')&&!raw.startsWith('.')){external.push(raw);return;}
  if(!/\.m?js$/i.test(raw))return;
  const abs=raw.startsWith('/')?path.resolve(ROOT,'public',raw.slice(1)):path.resolve(path.dirname(from),raw);
  if(!abs.startsWith(publicRoot)){missing.push('unsafe path '+raw);return;}
  if(!seen.has(abs))queue.push(abs);
 }
 if(type==='library')for(const m of html.matchAll(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi)) {
  const link=m[1];
  // HTML src="game.js" and src="js/main.js" are relative filenames,
  // unlike bare ESM package specifiers such as import 'three'.
  add(link.startsWith('/')||link.startsWith('.')||/^(?:https?:|data:|\/\/)/i.test(link)?link:'./'+link,htmlPath);
 }
 else for(const spec of importSpecs(read(primary)))add(spec,primary);
 const paths=[];
 while(queue.length&&paths.length<140){
  const p=queue.shift();if(seen.has(p))continue;seen.add(p);
  if(!fs.existsSync(p)){missing.push(path.relative(ROOT,p).split(path.sep).join('/'));continue;}
  paths.push(p);
  // Traverse imported local gameplay engines but skip opaque minified vendor
  // dependencies; the general prelaunch tool still verifies their file paths.
  if(/[/\\]vendor[/\\]/.test(p))continue;
  for(const spec of importSpecs(read(p)))add(spec,p);
 }
 if(queue.length)missing.push('dependency traversal exceeded 140 local scripts');
 return {sourceFiles:paths.map(p=>path.relative(ROOT,p).split(path.sep).join('/')),
  missing,externalImports:[...new Set(external)].slice(0,40),
  runtimeScriptBytes:paths.reduce((n,p)=>n+Buffer.byteLength(read(p)),0)};
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

const REVIEW_FAMILIES=[
 {name:'hill-physics-driving',ids:['gl-hill-hauler','gl-wreck-ride','gl-rig-rally','gl-egg-roll','gl-monster-crush','gl-dune-glide'],status:'SIX_RETIRED_EXCEPT_HILL_HAULER',reason:'Owner tested near-identical acceleration, rollovers and obstacle physics. Archived variants cannot launch new competitions.'},
 {name:'drift-car',ids:['drift-rush','gl-drift-king','gl-neon-circuit'],status:'PARTIAL_ARCHIVE_REVIEW_ACTIVE_PAIR',reason:'Drift King archived; Drift Rush versus Neon Circuit still needs actual steering, timing, hazards and end-rule differentiation.'},
 {name:'delivery-driving',ids:['gl-cab-rush','gl-green-dash','gl-throttle-rider'],status:'OWNER_REVIEW',reason:'Check deliveries/time bonuses versus lane-riding/traffic; common vehicle presentation is not sufficient distinction.'},
 {name:'basketball-throw',ids:['gl-hoop-streak','gl-dunk-flick'],status:'OWNER_REVIEW',reason:'Flick projectile baskets; confirm shifting-shot timer versus hoop-to-hoop platform chain is genuinely different.'},
 {name:'projectile-throw',ids:['gl-cup-toss','gl-paper-toss'],status:'OWNER_REVIEW',reason:'Swipe projectile physics overlaps; test rack/ball economy versus wind/three-misses target.'},
 {name:'reaction-targets',ids:['gl-mole-whack','gl-pest-patrol'],status:'OWNER_REVIEW',reason:'Both tap targets; moving bugs, plant health and beneficial insects may be distinct from fixed timed grid.'},
 {name:'lane-survival-runner',ids:['gl-rail-rush','gl-roof-runner','gl-tunnel-hop','gl-dino-dash'],status:'OWNER_REVIEW',reason:'Compare actual movement/camera/hazard-failure families rather than title or graphics.'},
 {name:'survival-arena',ids:['gl-arrow-hero','gl-moon-swarm','gl-rift-survival','void-swarm'],status:'OWNER_REVIEW',reason:'Verify distinct enemy AI, combat loops, skill effects, survival objectives and mobile control.'},
 {name:'tower-defense',ids:['gl-pop-defense','gl-keep-guard','gl-node-siege'],status:'OWNER_REVIEW',reason:'Validate tower pathing, building, upgrade balance and endless highscore, not just different art.'},
 {name:'tile-puzzle',ids:['gl-bud-merge','gl-strain-crush','gl-tile-twin'],status:'DIFFERENT_RULES_SOURCE_REVIEW',reason:'2048 merging, match-three swapping and Mahjong pairs appear rule-distinct but still need device/asset QA.'},
 {name:'cannabis-precision',ids:['gl-trim-rush','gl-roll-up','gl-bud-sort','gl-bud-bar'],status:'DIFFERENT_RULES_SOURCE_REVIEW',reason:'Trim drawing, timing stages, belt sorting, multi-lane service; verify actual touch satisfaction and game title fidelity.'}
];
const REPAIRED_IN_SOURCE={
 'gl-trim-rush':['init-leaves-before-counter-free-score','keyboard-space-auto-trim','misstated-60-second-limit'],
 'gl-bud-bar':['different-lane-first-tap-only-selected','empty-tray-catch-intent-needs-phone-QA'],
 'gl-strain-crush':['misstated-three-minute-round','seeded-unplayable-match3-board'],
 'gl-grow-op':['misstated-three-minute-end','tap-water-feed-harvest-discoverability-needs-QA'],
 'gl-mole-whack':['keyboard-space-auto-whack','misstated-60-second-round'],
 'gl-dunk-flick':['keyboard-goal-coordinates-auto-basket'],
 'gl-wanted-run':['scenery-impact-instant-death','visual-police-sourced-mesh-QA'],
 'gl-rail-rush':['train-side-hit-missing-collision'],
 'gl-arrow-hero':['touch-skill-selection-overlaps-movement'],
 'gl-cup-toss':['empty-timer-allocation-removed']
};
function mapGame(g,type){
 const dir=type==='library'?path.join(base,g.slug):path.join(ROOT,'public/js',path.dirname(g.module));
 const primary=type==='library'?path.join(dir,'game.js'):path.join(ROOT,'public/js',g.module);
 const jsPaths=type==='library'?collectJs(dir):[primary];
 const parts=jsPaths.map(p=>({file:path.relative(ROOT,p),src:read(p)}));
 const source=parts.map(x=>x.src).join('\n'),authorFiles=parts.filter(x=>x.src);
 const dependencyGraph=runtimeScripts(type,g,primary,jsPaths);
 const cue=s=>source.includes(s);
 const engine=cue('HillCar(')?'hillcar':cue('TopCar(')?'topcar':cue('Runner3D(')?'runner3d':
   cue('Kit.run(')?'kit':cue('THREE.WebGLRenderer')?'threejs-custom':cue('Arena(')?'arena':
   type==='core'?'core-html5':'custom-or-multifile';
 const pair=OWNER[g.id]||[];
 const detect=engine==='hillcar'?'hillcar-other-candidates':engine==='topcar'?'topcar-other-candidates':
   engine==='runner3d'?'runner3d-other-candidates':null;
 const assetFiles=type==='library'?fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^(CREDITS|LICENSE)/i.test(x)):[]:[];
 // These are triage signals, not per-title verified gameplay failures.
 const helpMatch=source.match(/help:\s*'((?:\\.|[^'])*)'/);
 const instructions=helpMatch?helpMatch[1].replace(/\\n/g,' ').slice(0,260):null;
 const startClock=source.match(/init\s*\(\s*g\s*\)\s*\{[\s\S]{0,450}?g\.time\s*=\s*(\d+(?:\.\d+)?)/);
 const sourceStartTime=startClock?Number(startClock[1]):null;
 const helpTime=instructions&&instructions.match(/\b(\d+)\s*(?:minutes?|seconds?|mins?|secs?)\b/i);
 const claimedHelpTime=helpTime?Number(helpTime[1])*(/^m/i.test(helpTime[0].split(/\s+/).at(-1))?60:1):null;
 const keyboardSpaceActions=(source.match(/g\.kd\s*\(\s*['"] ['"]\s*\)/g)||[]).length;
 const targetAssistPattern=/g\.kd\s*\(\s*['"] ['"]\s*\)[\s\S]{0,160}(?:\.find\s*\(|H1\.[xy]|goal|target|const\s+T\s*=)/i;
 const declaredUnseededRandomCalls=(source.match(/Math\.random\s*\(/g)||[]).length;
 const usesExternallySourcedModel=/GLTFLoader|\.glb['"\x60]|loadAsync\(/.test(source);
 const canvasDrawPrimitives=/Kit\.(?:rr|circ)|\.fillRect\s*\(|\.beginPath\s*\(|\.ellipse\s*\(/.test(source);
 const possibleClockMismatch=claimedHelpTime!==null&&sourceStartTime!==null&&
   claimedHelpTime!==sourceStartTime;
 const triageFlags=[
   ...(possibleClockMismatch?['HELP_CLOCK_MISMATCH_POTENTIAL']:[]),
   ...(targetAssistPattern.test(source)?['INPUT_AUTO_TARGET_POTENTIAL']:[]),
   ...(declaredUnseededRandomCalls?['MATH_RANDOM_REVIEW']:[]),
   ...(!usesExternallySourcedModel&&canvasDrawPrimitives?['ART_PROCEDURAL_VECTOR_QA_REQUIRED']:[])
 ];
 return {
  id:g.id,title:g.title,slug:g.slug||g.id,kind:type,registered:true,playable:g.playable!==false&&!g.retired,
  retired:!!g.retired,replacedBy:g.replacedBy||null,mechanicsFamily:pair[0]||detect||'UNCLASSIFIED',
  ownerDistinctnessVerdict:pair[2]||'REQUIRES_MANUAL_GAMEPLAY_COMPARISON',
  engineSignature:engine,referenceLoop:type==='library'?g.ref_internal:null,
  scannedCodePaths:authorFiles.map(x=>x.file),scannedBytes:authorFiles.reduce((sum,x)=>sum+x.src.length,0),
  actualRuntimeSourceFiles:dependencyGraph.sourceFiles,
  actualRuntimeSourceCount:dependencyGraph.sourceFiles.length,
  actualRuntimeSourceBytes:dependencyGraph.runtimeScriptBytes,
  missingBrowserScriptDependencies:dependencyGraph.missing,
  resolvedExternalBareImports:dependencyGraph.externalImports,
  sourceSha256:source?hash(source):null,missingReadableJs:!authorFiles.length,
  playableInstructionPreview:instructions,sourceStartingClockSeconds:sourceStartTime,
  advertisedClockSeconds:claimedHelpTime,keyboardSpaceActionCount:keyboardSpaceActions,
  explicitUnseededMathRandomCalls:declaredUnseededRandomCalls,
  sourced3DModelLoaderDetected:usesExternallySourcedModel,
  proceduralCanvasPrimitivesDetected:canvasDrawPrimitives,sourceTriageFlags:triageFlags,
  knownCodeIssuesRepairedAwaitingDeviceQA:REPAIRED_IN_SOURCE[g.id]||[],
  relatedMechanicFamilies:REVIEW_FAMILIES.filter(f=>f.ids.includes(g.id)).map(f=>f.name),
  ownerQualityVerdict:'BLOCKED_NEEDS_PLAYTEST_GRAPHICS_SCORE_DEVICE_AND_TITLE_MATCH',
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
if(entries.filter(x=>x.playable).length!==87||entries.filter(x=>x.retired).length!==6)
 throw Error('87 active / 6 archived baseline drift requires explicit rebaseline before adding games');
const familyGroups={};
for(const g of entries)if(g.mechanicsFamily!=='UNCLASSIFIED')(familyGroups[g.mechanicsFamily]??=[]).push(g.id);
const out={
 version:1,createdAtUTC:new Date().toISOString(),auditType:'SOURCE_ONLY_NOT_AAA',
 coreRegistered:core.length,libraryRegistered:lib.length,historicalRegistered:entries.length,
 proposedPlayable:entries.filter(g=>g.playable).length,ownerArchivedDuplicates:entries.filter(g=>g.retired).length,
 sourceFilesScanned:entries.reduce((x,g)=>x+g.scannedCodePaths.length,0),
 sourceGraphFilesAudited:[...new Set(entries.flatMap(g=>g.actualRuntimeSourceFiles))].length,
 activeDependencyGraphComplete:entries.filter(g=>g.playable).every(g=>g.actualRuntimeSourceCount>0&&g.missingBrowserScriptDependencies.length===0),
 activeDependencyErrors:entries.filter(g=>g.playable&&g.missingBrowserScriptDependencies.length).map(g=>({id:g.id,missing:g.missingBrowserScriptDependencies})),
 sourceUnresolved:entries.filter(g=>g.missingReadableJs).map(g=>g.id),familyGroups,
 sourceTriageCounts:{possibleClockMismatch:entries.filter(g=>g.sourceTriageFlags.includes('HELP_CLOCK_MISMATCH_POTENTIAL')).length,
   possibleAutoTarget:entries.filter(g=>g.sourceTriageFlags.includes('INPUT_AUTO_TARGET_POTENTIAL')).length,
   unseededRandom:entries.filter(g=>g.explicitUnseededMathRandomCalls>0).length,
   canvasProceduralSource:entries.filter(g=>g.sourceTriageFlags.includes('ART_PROCEDURAL_VECTOR_QA_REQUIRED')).length},
 crossGameFamilyReviews:REVIEW_FAMILIES.map(group=>({...group,allIdsPresent:group.ids.every(id=>entries.some(e=>e.id===id)),
  activeMembers:group.ids.filter(id=>entries.some(e=>e.id===id&&e.playable)),
  ownerQualityApproved:false})),
 allGamesRequireMobilePlaybackAndLicensedArtApproval:true,
 caution:'Engine signature or different source SHA is not proof of unique gameplay. All devices, art and scoring evidence remain NOT_RUN until actually tested.',
 games:entries
};
const dest=path.join(ROOT,'docs','audit','ALL-GAME-MECHANICS-SOURCE-LEDGER.json');
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({audit:out.auditType,core:core.length,library:lib.length,historical:entries.length,
 playable:out.proposedPlayable,archived:out.ownerArchivedDuplicates,sourceFiles:out.sourceFilesScanned,
 unresolved:out.sourceUnresolved.length,runtimeSourceFiles:out.sourceGraphFilesAudited,
 runtimeGraphComplete:out.activeDependencyGraphComplete,
 dependencyErrors:out.activeDependencyErrors.length,report:path.relative(ROOT,dest)}));

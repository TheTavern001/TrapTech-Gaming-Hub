#!/usr/bin/env node
'use strict';
// SOURCE-ONLY technical inventory: passing this is NOT gameplay or AAA approval.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..');
const exists=p=>fs.existsSync(path.join(ROOT,p));
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const catalog=JSON.parse(read('public/games-lib/catalog.json')).games;
const baseline=JSON.parse(read('docs/audit/GAME-INTAKE-BASELINE.json'));
const config=read('src/config.js');
const core=[...config.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
 .map(m=>{const a=config.slice(m.index,m.index+700).match(/\bart:\s*'([^']+)'/);return {id:m[1],title:m[2],module:m[3],art:a?a[1]:null};})
 .filter(g=>baseline.activeCoreIds.includes(g.id));
const errors=[],artDefects=[],rows=[],same=new Map(),ids=new Set();
function filesFor(g){
 const main='public/games-lib/'+g.slug+'/game.js';
 if(exists(main))return [main];
 const html='public/games-lib/'+g.slug+'/index.html';
 if(!exists(html))return [];
 const sources=[...read(html).matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)]
   .map(m=>m[1].split('?')[0])
   .filter(p=>p.endsWith('.js')&&!p.includes('/vendor/')&&!p.includes('kit.js')&&!p.includes('adapter.js')&&!p.startsWith('http'))
   .map(p=>p.startsWith('/')?'public'+p:path.posix.normalize('public/games-lib/'+g.slug+'/'+p));
 return [...new Set(sources)].filter(p=>p.startsWith('public/')&&!p.includes('..')&&exists(p));
}
function hash(s){return crypto.createHash('sha256').update(s).digest('hex');}
function inspect(id,title,type,sources,entry,image){
 if(ids.has(id))errors.push('Duplicate identifier '+id);
 ids.add(id);
 if(!entry||!exists(entry))errors.push(id+' missing HTML entry');
 if(!image||!exists(image))artDefects.push({game:id,missing:image||'(unregistered)'});
 if(!sources.length||sources.some(s=>!exists(s)))errors.push(id+' missing executable source');
 const js=sources.filter(exists).map(read).join('\n');
 const exact=hash(js),normalized=hash(js.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').replace(/\s+/g,''));
 if(!same.has(normalized))same.set(normalized,[]);
 same.get(normalized).push(id);
 const checks={inputHint:/(keydown|pointer|touch|mouse|kit\.run|addEventListener|gamepad|keyPressed)/i.test(js),
   difficultyHint:/(level|wave|tier|difficulty|score|spawn|Math\.min|Math\.max)/i.test(js),
   completionHint:/(restart|reset|gameover|\.end\(|finish|won|lose|death)/i.test(js)};
 rows.push({id,title,type,files:sources,sourceSha256:exact,
   staticChecks:checks,requiresHumanGameplay:true,
   referencedArt:image,artExists:!!image&&exists(image),certifiedVisuals:false,certifiedAndroid:false,certifiedControls:false,
   certifiedLicense:false,certifiedServerScoreReplay:false,certifiedAAA:false,
   comment:'Static heuristic only; sources and metadata are not visual/playtesting evidence.'});
}
for(const g of core)inspect('core:'+g.id,g.title,'core',
 ['public/js/'+g.module],'public/index.html',g.art&&'public'+g.art);
for(const g of catalog)inspect('library:'+g.slug,g.title,'library',filesFor(g),'public'+g.url,'public'+g.art);
for(const id of baseline.activeCoreIds)if(!core.some(g=>g.id===id))errors.push('Missing active core '+id);
for(const slug of baseline.baselineLibrarySlugs)if(!catalog.some(g=>g.slug===slug))errors.push('Missing baseline library '+slug);
const duplicates=[...same.values()].filter(a=>a.length>1);
const report={schemaVersion:1,audit:'static source inventory, not AAA certification',
 registered:rows.length,core:core.length,library:catalog.length,qualityApproved:0,
 errors,missingArtwork:artDefects,possibleIdenticalGameSources:duplicates,
 criteriaNotTested:['Mobile/desktop gameplay','Distinct core game loops','Graphic quality',
   'Gameplay latency and frame time','Real assets and rights','Score replay security','Owner art approval'],games:rows};
const file=path.join(ROOT,'docs/audit/game-source-mechanics.json');
fs.mkdirSync(path.dirname(file),{recursive:true});
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({audit:'game-source-mechanics',registered:rows.length,
 core:core.length,library:catalog.length,errors:errors.length,missingArtwork:artDefects.length,
 identicalSourceCandidates:duplicates.length,AAAApproved:0}));
if(errors.length)process.exitCode=1;

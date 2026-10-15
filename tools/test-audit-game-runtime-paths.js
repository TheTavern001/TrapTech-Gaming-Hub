#!/usr/bin/env node
'use strict';
// Execute the actual source-auditor function in a strict synthetic filesystem.
// A source-only core title has no slug; library titles require one.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'tools/audit-full-game-mechanics.js'),'utf8');
const start=src.indexOf('function runtimeScripts(type,g,primary,localPaths){');
const finish=src.indexOf('\nconst same=',start);
assert.ok(start>=0&&finish>start,'Source auditor runtimeScripts function missing');
const reads=[];
const scan=new Function('fs','path','Buffer','ROOT','base','read','importSpecs',
 src.slice(start,finish)+'\nreturn runtimeScripts;')(
 {existsSync:()=>true},path,Buffer,root,path.join(root,'public','games-lib'),
 p=>{reads.push(p);return '';},()=>[]);
const coreFile=path.join(root,'public','js','games','drift-rush.js');
const core=scan('core',{id:'drift-rush',module:'games/drift-rush.js'},coreFile,[coreFile]);
assert.equal(core.sourceFiles.length,1,'Core game script must be scanned without a slug');
assert.equal(core.missing.length,0);
assert.equal(reads.filter(p=>p.endsWith('/index.html')).length,0,
 'Core titles must never look up library index.html');
const libraryFile=path.join(root,'public','games-lib','rail-rush','game.js');
const lib=scan('library',{id:'gl-rail-rush',slug:'rail-rush'},libraryFile,[libraryFile]);
assert.equal(lib.sourceFiles.length,1,'Library game script must be scanned');
assert.ok(reads.includes(path.join(root,'public','games-lib','rail-rush','index.html')),
 'Library HTML must resolve from the actual slug');
assert.throws(()=>scan('library',{id:'bad'},libraryFile,[]),
 /Invalid library game slug/,'Missing library slug must fail clearly');
assert.throws(()=>scan('library',{id:'bad',slug:'../escape'},libraryFile,[]),
 /Invalid library game slug/,'Unsafe library slug must fail closed');
console.log(JSON.stringify({pass:true,cases:4,coreWithoutSlug:true,libraryWithSlug:true,
 invalidLibrarySlugRejected:true,traversalRejected:true,scope:'actual auditor function; mocked filesystem'}));

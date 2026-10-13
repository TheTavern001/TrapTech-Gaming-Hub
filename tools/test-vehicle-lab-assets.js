#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'public/games-lib/labs/garage');
const obj=JSON.parse(fs.readFileSync(path.join(dir,'vehicles.json'),'utf8'));
assert.equal(obj.schema,1);assert.equal(obj.previewOnly,true);assert.equal(obj.scoreEffects,false);
assert.equal(obj.models.length,6);
const ids=new Set(['rc-sedan','rc-hatch','rc-suv','rc-van','rc-pickup','rc-boxtruck']);
for(const v of obj.models){
 assert.ok(ids.delete(v.id),'unknown vehicle '+v.id);
 const f=path.resolve(dir,v.path);
 assert.ok(f.startsWith(path.join(root,'public/games-lib/assets3d')+path.sep));
 const b=fs.readFileSync(f);
 assert.equal(b.length,v.bytes);
 assert.equal(b.toString('ascii',0,4),'glTF');
 assert.equal(b.readUInt32LE(4),2);
 assert.equal(b.readUInt32LE(8),b.length);
 const hash=crypto.createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
 assert.equal(hash,v.sha,'Git blob identity drift');
 assert.equal(v.license,'CC0');
}
assert.equal(ids.size,0);
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert.ok(html.includes('PRIVATE QA'));
console.log(JSON.stringify({ok:true,vehicles:6,gameplayModified:false}));

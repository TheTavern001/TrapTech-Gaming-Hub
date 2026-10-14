#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../src/avatars.js'),'utf8');
const a=src.indexOf('function configOf(user)'),b=src.indexOf('// ownership',a);
assert.ok(a>=0&&b>a,'Avatar config read function missing');
const cfg=src.slice(a,b);
assert.match(src,/SELECT id, username, avatar FROM users WHERE username=\? COLLATE NOCASE/);
const ctx={Number,JSON,KINDS:['outfit','acc'],BYK:{outfit:{base:{id:'base'},crown:{id:'crown'}},acc:{none:{id:'none'},wings:{id:'wings'}}},
  defaultFor:()=>({outfit:'base',acc:'none'}),clean:(c,d)=>({...d,...c}),
  owns:(_id,p)=>p.id!=='crown'&&p.id!=='wings'};
vm.runInNewContext(cfg+'this.configOf=configOf;',ctx,{timeout:2000});
const tested=ctx.configOf({id:42,avatar:JSON.stringify({outfit:'crown',acc:'wings'})});
assert.equal(tested.outfit,'base');
assert.equal(tested.acc,'none');
const retained=ctx.configOf({id:42,avatar:JSON.stringify({outfit:'base',acc:'none'})});
assert.equal(retained.outfit,'base');
assert.equal(retained.acc,'none');
console.log(JSON.stringify({pass:true,revokedEquipmentReplaced:true,validBaseRetained:true,fullIntegrationVerified:false}));

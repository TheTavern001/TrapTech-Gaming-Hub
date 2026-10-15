#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/config.js'),'utf8');
const start=source.indexOf('const derive = '),end=source.indexOf('// SQLite location:');
assert.ok(start>=0&&end>start,'Secret initialization missing');
const code=source.slice(start,end)+'\n({SESSION_SECRET,RUN_SECRET,IP_SALT});';
function run(env){
 const errors=[],context={crypto,process:{env:{...env},
  exit(n){throw Object.assign(Error('CONFIG_EXIT_'+n),{exitCode:n})}},
  console:{error:m=>errors.push(String(m)),warn:()=>{}}};
 try{return{value:vm.runInNewContext(code,context,{timeout:2000}),errors};}
 catch(error){return{error,errors};}
}
for(const env of [{},{ADMIN_PASSWORD:'LongTestPassword123'},
 {ADMIN_PASSWORD:'LongTestPassword123',SESSION_SECRET:'session-only'},
 {ADMIN_PASSWORD:'LongTestPassword123',RUN_SECRET:'run-only'}]){
 const r=run(env);
 assert.equal(r.error?.exitCode,1,'Missing secret must deliberately exit');
 assert.ok(r.errors.some(x=>x.includes('Missing required environment variable')),
   'Provide actionable missing-secret message');
}
for(const env of [
 {ADMIN_PASSWORD:'LongTestPassword123',SECRET:'TestMasterSecretNotForProduction'},
 {ADMIN_PASSWORD:'LongTestPassword123',SESSION_SECRET:'test-session',RUN_SECRET:'test-run'},
 {ADMIN_PASSWORD:'LongTestPassword123',SESSION_SECRET:'test-session',RUN_SECRET:'test-run',IP_SALT:'custom-test-salt'}
]){
 const r=run(env);assert.ok(!r.error,String(r.error));
 assert.ok(r.value.SESSION_SECRET&&r.value.RUN_SECRET&&r.value.IP_SALT);
 if(env.IP_SALT)assert.equal(r.value.IP_SALT,env.IP_SALT);
}
console.log(JSON.stringify({passed:true,missingSecretsFailExplicitly:true,
 independentRuntimeSecretsSupported:true,dockerAndHostNotTested:true}));

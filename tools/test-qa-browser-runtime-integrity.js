'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loopbackOrigin,qaRequestAllowed,inspectGameRuntime}=require('./qa-game-runtime');
for(const u of ['http://localhost:8787','http://127.0.0.1:8787','http://[::1]:8787'])assert.equal(loopbackOrigin(u),true);
for(const u of ['https://glassy-drifter-9532.de.deplexo.com','https://localhost.attacker.test'])assert.equal(loopbackOrigin(u),false);
for(const p of ['/api/score','/api/admin/change','/api/store/buy','/api/giveaways/award','/api/run/start']){
 for(const m of ['POST','PUT','DELETE','PATCH']){
  assert.equal(qaRequestAllowed(m,p,false),false);
  assert.equal(qaRequestAllowed(m,p,true),m==='POST'&&p==='/api/run/start');
 }
}
const g={id:'gl-rail-rush',kind:'library',build:'built'};
const ok={hubGameId:g.id,kitGameId:g.id,runAuthorized:true,kitState:'play'};
assert.equal(inspectGameRuntime(g,ok).verified,true);
assert.equal(inspectGameRuntime(g,{...ok,kitState:'over'}).verified,true);
for(const bad of [{hubGameId:'wrong'},{kitGameId:'wrong'},{runAuthorized:false},{kitState:'title'},{kitState:'starting'}])
 assert.equal(inspectGameRuntime(g,{...ok,...bad}).verified,false,JSON.stringify(bad));
assert.equal(inspectGameRuntime({id:'gl-bud-merge',kind:'library',build:'vendored'},
 {hubGameId:'gl-bud-merge',runAuthorized:true,kitState:'play'}).verified,true);
assert.equal(inspectGameRuntime({id:'jetpack-dash',kind:'core'},ok).verified,false);
const script=fs.readFileSync(path.join(__dirname,'qa-87-browser.js'),'utf8');
for(const s of ['inspectGameRuntime(g,metrics)','qaRequestAllowed(request.method(),new URL(request.url()).pathname,allowRunStart)','runtimeIdentityVerified','QA_ALLOW_RUN_START','runAuthorized:'])
 assert.ok(script.includes(s),'Missing QA gate '+s);
assert.ok(!script.includes("page.route('**/api/score'"));
console.log(JSON.stringify({pass:true,unstartedLibraryRejected:true,writeEndpointsDenied:true,realBrowserRun:false}));

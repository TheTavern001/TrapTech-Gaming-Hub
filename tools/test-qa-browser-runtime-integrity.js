'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {loopbackOrigin,qaRequestAllowed,inspectGameRuntime}=require('./qa-game-runtime');
const host='https://glassy-drifter-9532.de.deplexo.com';
for(const u of ['http://localhost:8787','http://127.0.0.1:8787','http://[::1]:8787'])assert.equal(loopbackOrigin(u),true);
for(const u of [host,'https://localhost.attacker.test'])assert.equal(loopbackOrigin(u),false);
for(const url of ['/api/score?nonce=1','/api/admin/change','/api/store/buy','/api/giveaways/award','/api/run/start','/checkout']) {
 for(const method of ['POST','PUT','PATCH','DELETE']) {
  const allowed=method==='POST'&&url==='/api/run/start';
  assert.equal(qaRequestAllowed(method,host+url,true,host),allowed);
  assert.equal(qaRequestAllowed(method,host+url,false,host),false);
  assert.equal(qaRequestAllowed(method,'https://other.invalid'+url,true,host),false);
 }
}
assert.equal(qaRequestAllowed('GET',host+'/api/me',false,host),true);
const lib={id:'gl-rail-rush',kind:'library',build:'built'};
const proof={gameId:lib.id,authorized:true};
const metrics={hubGameId:lib.id,kitGameId:lib.id,kitState:'play'};
assert.equal(inspectGameRuntime(lib,metrics,proof).verified,true);
assert.equal(inspectGameRuntime(lib,{...metrics,kitState:'over'},proof).verified,true);
for(const x of [{hubGameId:'other'},{kitGameId:'other'},{kitState:'title'},{kitState:'starting'}])
 assert.equal(inspectGameRuntime(lib,{...metrics,...x},proof).verified,false);
for(const failed of [null,{...proof,authorized:false},{...proof,gameId:'other'}])
 assert.equal(inspectGameRuntime(lib,metrics,failed).verified,false);
const core={id:'jetpack-dash',kind:'core'};
const coreMetrics={coreGameId:'jetpack-dash',coreState:'play'};
assert.equal(inspectGameRuntime(core,coreMetrics,{gameId:core.id,authorized:true}).verified,true);
for(const x of [{coreGameId:'other'},{coreState:'ready'},{coreState:'paused'}])
 assert.equal(inspectGameRuntime(core,{...coreMetrics,...x},{gameId:core.id,authorized:true}).verified,false);
assert.equal(inspectGameRuntime(core,coreMetrics,null).verified,false);
const source=fs.readFileSync(path.join(__dirname,'qa-87-browser.js'),'utf8');
for(const marker of ['inspectGameRuntime(g,metrics,signedRun)',
 'qaRequestAllowed(request.method(),request.url(),allowRunStart,BASE)',
 'page.locator("canvas#gl")','page.locator("canvas#game")',
 'signedRunAuthorizations','QA_ALLOW_RUN_START','coreGameId:',"await page.route('**/*'"])
 assert.ok(source.includes(marker),'Missing browser runtime safety rule '+marker);
assert.ok(!source.includes("page.locator('canvas').first()"),'Noninteractive 3D canvas is not the touch target');
console.log(JSON.stringify({pass:true,coreAndLibrarySignedProof:true,
 direct3dInputCanvas:true,allUnexpectedWritesBlocked:true,realDeviceQA:false}));

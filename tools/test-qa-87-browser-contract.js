#!/usr/bin/env node
'use strict';
// Build-time contract: executable 87-title browser QA is optional and cannot
// silently write scores, payments or award AAA approvals from page-load results.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('tools/qa-87-browser.js'),pkg=JSON.parse(read('package.json'));
const games=require('../src/games-lib').games,config=read('src/config.js');
const block=(config.match(/const GAMES = \[([\s\S]*?)\n\];/)||[])[1]||'';
const core=[...block.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
 .map(m=>m[1]).filter(id=>!['plinko','spin-to-win','blazed-roulette'].includes(id));
assert.equal(core.length,13);
assert.ok(games.filter(g=>g.playable!==false&&!g.retired).length>=74);
assert.equal(pkg.scripts['qa:87:browser'],'node tools/qa-87-browser.js');
for(const marker of ['QA_REQUIRE_LOGIN','QA_STORAGE_STATE','QA_INTERACTIVE_AUTH',
 'window.__GL','frameMsP95','badAssets','jsExceptions','scoreReplayCertified:false',
 'visualAAAApproved:false','physicalAndroidApproved:0','physicalIphoneApproved:0',
 'fullCoverage:batch.fullCoverage','qaRequestAllowed(request.method()',
 'runtimeSurfaceDetected:runtimeSurface','consoleErrors.length>0',
 'QA_START_INDEX','QA_MAX_GAMES','planGameBatch(games','QA_REQUIRE_FULL_COVERAGE',
 'runtimeIdentityVerified','signedRunObserved:','QA_ALLOW_RUN_START',
 'coreGameId:','coreState:','signedRunAuthorizations',
 'page.locator("canvas#gl")','page.locator("canvas#game")']){
 assert.ok(src.includes(marker),'Missing browser safety/evidence invariant: '+marker);
}
assert.ok(!src.includes("page.route('**/api/score'"),
 'A narrow endpoint glob would fail to block future score URL query variants');
assert.ok(!src.includes('context.storageState({path:'),
 'Interactive authenticated reviewer cookies must not be written to disk by default');
const ts=src.replace(/^#![^\n]*\n/,'');
new Function('require','module','exports','process',ts);
console.log(JSON.stringify({passed:true,core:13,library:games.filter(g=>g.playable!==false&&!g.retired).length,
 tests:'source-level guardrails and expandable mobile batches',physicalPhonesTested:false,gameplayCertified:0}));

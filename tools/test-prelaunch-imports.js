#!/usr/bin/env node
'use strict';
// Reproduce 5932ba6: text-inspection string must not become a phantom import.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {importSpecs}=require('./local-imports');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const live=read('tools/verify-live-deployment.js'),app=read('public/js/app.js');
assert.ok(live.includes("import * as GP from './player-prefs.js'"),
  'Keep the actual HTTP smoke assertion while fixing parser');
assert.ok(!importSpecs(live).includes('./player-prefs.js'),
  'Build verifier must not treat text-inspection string as executable import');
assert.ok(importSpecs(app).includes('./player-prefs.js'),
  'Real app import must remain checked by build');
assert.ok(fs.existsSync(path.join(root,'public/js/player-prefs.js')),'App import target missing');
// Deplexo STEP 11 regression: build-stage source audits have no runtime secrets.
// Old main 570a9fe imported src/config.js to compute GAMES, then HMAC threw.
const prelaunch=read('tools/verify-prelaunch.js');
assert.ok(prelaunch.includes('const runtimeCore = [...ids].filter(id => !retiredIds.has(id));'),
  'Prelaunch core game list must come from parsed source, never secret-dependent config');
assert.ok(!prelaunch.includes("const runtimeCore = require('../src/config').GAMES"),
  'Secretless Docker build cannot import runtime config to enumerate games');
const fakes=[
  "const check = page.includes(\"import * as GP from './nonexistent.js'\");",
  "// import './fake-comment.js'\n/* export { x } from './fake-block.js' */",
  "const label = `plain text import './fake-template.js'`;"
];
for(const text of fakes)assert.deepEqual(importSpecs(text),[]);
const real="import x from './missing-static.js';\nexport { y } from './missing-export.js';\nimport './missing-side-effect.js';\nconst z=import('./missing-dynamic.js');";
assert.deepEqual(importSpecs(real),['./missing-static.js','./missing-export.js','./missing-side-effect.js','./missing-dynamic.js']);
assert.ok(importSpecs("const x=`text ${import('./missing-in-template.js')}`;").includes('./missing-in-template.js'),
  'Template-expression imports must still be checked');
for(const spec of importSpecs(real)){
  assert.ok(!fs.existsSync(path.resolve(root,'public/js',spec)),
    'Negative fixture target unexpectedly exists: '+spec);
}
console.log(JSON.stringify({pass:true,issue:'5932ba6',actualAppImportValidated:true,
 phantomVerifierImportRejected:true,missingStaticAndDynamicImportRejected:true,
 runtimeSmokeChecksPreserved:true}));

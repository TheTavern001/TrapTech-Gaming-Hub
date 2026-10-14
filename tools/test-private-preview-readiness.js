#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.join(__dirname,'preflight-manual-release.js');
const source=fs.readFileSync(file,'utf8');
new vm.Script(source,{filename:file});
assert.match(source,/privatePreview=process\.argv\.includes\('--private-preview'\)/);
assert.match(source,/privatePreview&&publicIntent/);
assert.match(source,/result:'PRIVATE_PREVIEW_PREPARATION'/);
assert.match(source,/sourceReadyForPrivateDeployment:false/);
assert.match(source,/if\(process\.argv\.includes\('--require-ready'\)\)process\.exitCode=1/);
assert.match(source,/if\(process\.argv\.includes\('--require-ready'\)&&blockers\.length\)process\.exitCode=1/);
assert.match(source,/Payments, prize giveaways and prestige sales must remain disabled/);
console.log(JSON.stringify({pass:true,privatePreviewCannotApproveDeployment:true,strictPublicGatePreserved:true,sourceContractOnly:true}));

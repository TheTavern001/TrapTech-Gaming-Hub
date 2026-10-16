#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('tools/offline-release-rehearsal.js');
new vm.Script(src);
assert.match(src,/privatePreview=args\.includes\('--private-preview'\)/);
assert.match(src,/\['tools\/preflight-manual-release\.js','--release='\+stage,'--private-preview'\]/,
 'Private-image preflight must be preparation, not a public release check');
assert.match(src,/\['tools\/preflight-manual-release\.js','--release='\+stage,'--require-ready'\]/,
 'Public release mode must still require complete release acceptance');
assert.match(src,/const ready=!privatePreview&&gateChecked;/,
 'Private-image preparation must NOT grant public release eligibility');
for(const marker of ['automaticDeploymentAllowed:false','ownerDeploymentAuthorization:false',
 'publicLaunchApproved:false','privatePreviewPhoneAndHostApproved:false',
 'full-Dockerfile-STEP11-STEP12','reproducible-clean-checkout',
 'PRIVATE_IMAGE_BUILT_NOT_DEPLOYMENT_APPROVED','PRIVATE_IMAGE_NOT_VERIFIED'])
 assert.ok(src.includes(marker),'Never conflate image success with deployment authorization: '+marker);
const match=src.match(/const imageEvidenceEligible=([^;]+);/);
assert.ok(match,'Missing private Docker evidence calculation');
const formula=match[1].trim();
const candidate=(values)=>vm.runInNewContext(formula,values,{timeout:1000});
const full={privatePreview:true,full:true,dockerPassed:true,cleanSource:true,failed:[]};
assert.equal(candidate(full),true,'Exact clean private Docker pass qualifies for image evidence only');
for(const update of [{privatePreview:false},{full:false},{dockerPassed:false},
 {cleanSource:false},{failed:['test failure']}])
 assert.equal(candidate({...full,...update}),false,'Never credit incomplete private image evidence: '+JSON.stringify(update));
const privateGate=read('tools/preflight-manual-release.js');
assert.match(privateGate,/sourceReadyForPrivateDeployment:false/,
 'Human review and live host approval stay blocked even after private image proof');
const pkg=JSON.parse(read('package.json'));
assert.ok(String(pkg.scripts['verify:offline:private']||'').includes('--full --private-preview'),
 'Expose exact private-image verification command without hidden deployment');
const docker=read('Dockerfile'),shell=read('scripts/offline-release-gate.sh');
assert.ok(docker.includes('node tools/test-private-preview-rehearsal-mode.js'),
 'Docker must run preflight separation regression');
assert.ok(shell.includes('node tools/test-private-preview-rehearsal-mode.js'),
 'Offline shell must run preflight separation regression');
assert.ok(src.includes("'tools/test-private-preview-rehearsal-mode.js'"),
 'Offline Node runner must run its own preflight separation regression');
console.log(JSON.stringify({pass:true,privateImageRequiresFullDocker:true,
 unchangedStrictPublicGate:true,neverTurnsOnAutoDeploy:true,neverClaimsPhoneApproval:true}));

#!/usr/bin/env node
'use strict';
// Catch audit-source files missing from the Docker build stage before the
// large prelaunch test chain starts. This test runs on host AND in Docker.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const required=[
 'Dockerfile',
 '.dockerignore',
 'scripts/offline-release-gate.sh',
 'tools/offline-release-rehearsal.js',
 'tools/test-r1-incident-gates.js',
 'docs/audit/R1-INCIDENT-REGRESSION-CONTRACT.json',
 'docs/audit/DEPLOYMENT-JOURNAL.json',
 'docs/audit/POST-R1-FAILED-DEPLOYMENTS-20261015.json'
];
for(const name of required){
 const target=path.join(root,name);
 assert.ok(fs.existsSync(target), 'Build-stage audit input missing: '+name);
 assert.ok(fs.statSync(target).isFile(), 'Build-stage audit input not a file: '+name);
 assert.ok(fs.statSync(target).size>0, 'Build-stage audit input empty: '+name);
}
const docker=read('Dockerfile');
const ignored=new Set(read('.dockerignore').split(/\r?\n/)
 .map(line=>line.trim()).filter(line=>line&&!line.startsWith('#')));
for(const filename of ['Dockerfile','.dockerignore']){
 assert.ok(!ignored.has(filename), 'Required audit input excluded by .dockerignore: '+filename);
}
assert.ok(docker.includes('COPY Dockerfile .dockerignore ./'),
 'Dockerfile and .dockerignore must be copied before build-stage audits');
assert.ok(docker.includes('COPY scripts/offline-release-gate.sh ./scripts/offline-release-gate.sh'),
 'R1 source gate must be present in the build-stage filesystem');
assert.ok(docker.includes('node tools/test-docker-audit-context.js'),
 'Docker must execute this audit-input regression guard');
assert.ok(docker.includes('node tools/test-r1-incident-gates.js'),
 'R1 failure regressions must not be skipped');
const copyPosition=docker.indexOf('COPY Dockerfile .dockerignore ./');
const auditPosition=docker.indexOf('node tools/test-docker-audit-context.js');
assert.ok(copyPosition>=0&&copyPosition<auditPosition,
 'COPY of audit inputs must happen before first audit check');
const stage2=docker.indexOf('# ---------- runtime stage ----------');
assert.ok(stage2>auditPosition,'Audit must run only in builder stage, not production image');
console.log(JSON.stringify({pass:true,stage:'build',inputsPresent:required.length,
 dockerfileCopied:true,ignoreRulesValidated:true,r1GateRetained:true,productionImageUnchanged:true}));

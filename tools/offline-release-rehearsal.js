#!/usr/bin/env node
'use strict';
// ZERO Github Actions usage; ZERO Deplexo deployments. Requires checked-out
// repository and Node 20 + production dependencies (for --full, Docker).
// Writes evidence outside the repo in OS tmp; never certifies the R1-R5 gate
// without matching successful tests, release acceptance and a host fingerprint.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const cp=require('node:child_process');
const ROOT=path.resolve(__dirname,'..'),args=process.argv.slice(2);
const full=args.includes('--full'),stage=(args.find(a=>a.startsWith('--release='))||'--release=R1').slice(10);
if(!/^R[1-5]$/.test(stage)){console.error('Expected --release=R1..R5');process.exit(2);}
const startedAt=new Date().toISOString();
const SHA=()=>{
 const git=cp.spawnSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',timeout:5000});
 return git.status===0&&/^[a-f0-9]{40}$/.test(git.stdout.trim())?git.stdout.trim():null;
};
const sha=SHA();
const tests=[
 'tools/test-reviewed-wallet-read.js',
 'tools/test-unified-wallet.js',
 'tools/test-reward-integrity.js',
 'tools/test-session-revocation.js',
 'tools/test-payment-settlement-proof.js',
 'tools/test-prize-score-proof.js',
 'tools/test-owner-reported-gameplay.js',
 'tools/test-arrow-hero-swept-collision.js',
 'tools/test-arrow-hero-hostile-projectiles.js',
 'tools/test-arrow-hero-contact-after-move.js',
 'tools/test-arrow-hero-room-reachability.js',
 'tools/test-grow-op-timed-difficulty.js',
 'tools/test-grow-op-wave-catchup.js',
 'tools/test-owner-gameplay-distinctness.js',
 'tools/test-cannabis-gameplay-qa.js',
 'tools/test-mobile-frame-allocation-regressions.js',
 'tools/test-player-game-settings.js',
 'tools/test-neutral-avatar-source.js',
 'tools/test-vehicle-lab-assets.js',
 'tools/test-imported-kenney-cars.js',
 'tools/test-full-hub-meta-contract.js',
 'tools/test-game-candidate-queue.js',
 'tools/test-owner-duplicate-retirements.js',
 'tools/test-game-source-mechanics.js',
 'tools/verify-game-syntax.js',
 'tools/games-lib-static-check.js',
 'tools/audit-full-game-mechanics.js',
 'tools/verify-prelaunch.js',
 'tools/prelaunch-deep-audit.js'
];
const records=[];
const status=cp.spawnSync('git',['status','--porcelain','--untracked-files=normal'],{cwd:ROOT,encoding:'utf8',timeout:5000});
if(!sha || status.status!==0 || !!status.stdout?.trim()){
 records.push({label:'reproducible-clean-checkout',status:'FAIL',
  error:!sha?'Git HEAD missing; cannot attribute tested source to a commit':
    status.status!==0?'Cannot verify working-tree cleanliness':'Local checkout has uncommitted/untracked changes; evidence would not match the Git SHA'});
} else records.push({label:'reproducible-clean-checkout',status:'PASS',sha});
function run(label,command,commandArgs,timeout=120000){
 const at=Date.now();
 try {
  const r=cp.spawnSync(command,commandArgs,{cwd:ROOT,encoding:'utf8',timeout,
   maxBuffer:2*1024*1024,env:{...process.env,PAY_NO_SWEEP:'1',CI:'false'}});
  const passed=r.status===0&&!r.error;
  const out=(r.stdout||'')+(r.stderr||'');
  const lines=out.trim().split('\n');
  const record={label,status:passed?'PASS':'FAIL',exitCode:r.status,
   ms:Date.now()-at,error:r.error?String(r.error):null,
   tail:lines.slice(-12).join('\n').slice(-2400)};
  records.push(record);
  process.stdout.write((passed?'PASS ':'FAIL ')+label+' ('+record.ms+' ms)\n');
  return passed;
 } catch(e) {
  records.push({label,status:'FAIL',exitCode:null,ms:Date.now()-at,error:String(e)});
  process.stdout.write('FAIL '+label+': '+String(e)+'\n');
  return false;
 }
}
for(const file of tests){
 if(!fs.existsSync(path.join(ROOT,file))){
  records.push({label:file,status:'FAIL',error:'Required prelaunch source missing'});
  continue;
 }
 run(file,process.execPath,[file],file.includes('prelaunch')?240000:120000);
}
// Preflight gate remains independent of these test results. It can be blocked
// after all source checks PASS, because human mobile/rights/security evidence
// is still missing and must NEVER be auto-approved from a Docker exit status.
const ready=run('manual-release-'+stage,process.execPath,
 ['tools/preflight-manual-release.js','--release='+stage,'--require-ready'],30000);
if(full) {
 const docker=cp.spawnSync('docker',['info','--format','{{.ServerVersion}}'],{encoding:'utf8',timeout:8000});
 if(docker.error||docker.status!==0) {
  records.push({label:'full-Dockerfile-STEP11-STEP12',status:'FAIL',
   error:'Docker daemon unavailable: full release rehearsal requires a working Docker engine and exact Dockerfile build'});
 } else {
  const tag='traptech-rehearsal:'+((sha||'unverified').slice(0,12));
  run('full-Dockerfile-STEP11-STEP12','docker',
   ['build','--file','Dockerfile','--tag',tag,'.'],20*60*1000);
 }
}
if(!full) records.push({label:'full-Dockerfile-STEP11-STEP12',status:'NOT_RUN',error:'Source-only rehearsal cannot be used as deploy-ready evidence; rerun with --full'});
const failed=records.filter(x=>x.status!=='PASS');
const report={schema:1,createdAtUTC:startedAt,finishedAtUTC:new Date().toISOString(),
 sourceSha:sha,release:stage,level:full?'FULL_LOCAL_DOCKER':'LOCAL_NODE_TESTS',
 hostDeploymentAttempted:false,githubActionsUsed:false,
 nodeTestsPassed:records.filter(x=>x.status==='PASS'&&x.label.startsWith('tools/')).length,
 nodeTestsTotal:tests.length,releaseGatePassed:ready,
 dockerVerified:full&&records.some(x=>x.label==='full-Dockerfile-STEP11-STEP12'&&x.status==='PASS'),
 allChecksPassed:failed.length===0,failures:failed.map(x=>x.label),
 warning:'Local success is not live READY or real Android/iPhone device certification.',
 records};
const destDir=process.env.TRAPTECH_TEST_REPORT_DIR||path.join(os.tmpdir(),'traptech-release-rehearsal');
fs.mkdirSync(destDir,{recursive:true});
const dest=path.join(destDir,'rehearsal-'+stage+'-'+(sha||'unknown').slice(0,12)+'.json');
fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n',{mode:0o600});
console.log(JSON.stringify({sourceSha:sha,release:stage,nodeTestsPassed:report.nodeTestsPassed,
 nodeTestsTotal:tests.length,gate:ready?'ELIGIBLE_FOR_HUMAN_REVIEW':'BLOCKED',
 fullDocker:full,failed:failed.map(x=>x.label),reportPath:dest,noDeployment:true}));
if(failed.length)process.exitCode=1;

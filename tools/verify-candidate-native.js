#!/usr/bin/env node
'use strict';
// Execute Docker's actual build checks with the matching native Node LTS, then boot the real
// memory-limited server and run isolated HTTP smoke. Does not build an image,
// deploy, contact payment providers, or approve public/game/device quality.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),cp=require('node:child_process'),crypto=require('node:crypto'),net=require('node:net');
const ROOT=path.resolve(__dirname,'..');
const dockerMajor=Number((fs.readFileSync(path.join(ROOT,'Dockerfile'),'utf8').match(/^FROM node:(\d+)-/m)||[])[1]);
if(!dockerMajor||Number(process.versions.node.split('.')[0])!==dockerMajor){console.error('Use Node '+dockerMajor+' to match the Docker runtime.');process.exit(2);}
const outputArg=process.argv.find(x=>x.startsWith('--report-dir='));
const OUT=outputArg?path.resolve(outputArg.slice(13)):fs.mkdtempSync(path.join(os.tmpdir(),'hub-native-candidate-'));
fs.mkdirSync(OUT,{recursive:true});
const build=path.join(OUT,'build'),data=path.join(OUT,'http-db');fs.mkdirSync(data,{recursive:true});
const env={...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH};
for(const key of ['SECRET','SESSION_SECRET','RUN_SECRET','ADMIN_PASSWORD','ADMIN_PATH','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','BTC_ADDRESS','HUB_PRIVATE_REVIEW','HUB_PREVIEW_USERNAMES','NODE_OPTIONS'])delete env[key];
Object.assign(env,{BUILD_DIR:build,DATA_DIR:path.join(OUT,'isolated-build-db'),DB_PATH:path.join(OUT,'isolated-build-db','hub.db'),PAY_NO_SWEEP:'1'});
const records=[];let server,serverLog;
function run(label,command,args=[],extra={}){
 const file=path.join(OUT,label+'.log'),fd=fs.openSync(file,'w'),at=Date.now();
 let result;
 try{result=cp.spawnSync(command,args,{cwd:ROOT,env:{...env,...extra},stdio:['ignore',fd,fd],timeout:240000});}
 finally{fs.closeSync(fd)}
 const row={label,passed:result.status===0,durationMs:Date.now()-at,log:path.basename(file)};records.push(row);
 console.log((row.passed?'PASS ':'FAIL ')+label);
 if(!row.passed)throw Error(label+' failed; inspect '+file);
}
const node=(label,file,extra)=>run(label,process.execPath,[file],extra);
const shellQuote=s=>"'"+s.replace(/'/g,"'\\''")+"'";
async function freePort(){return new Promise(resolve=>{const listener=net.createServer();listener.listen(0,'127.0.0.1',()=>{const n=listener.address().port;listener.close(()=>resolve(n))})})}
async function main(){
 node('install-icons','tools/build-traptech-pwa-icons.js');
 node('install-covers','tools/build-core-game-cards.js');
 node('installed-icons','tools/test-traptech-pwa-icons.js');
 node('runtime-public-copy','tools/test-built-public-assets.js');
 const docker=fs.readFileSync(path.join(ROOT,'Dockerfile'),'utf8');
 const from=docker.indexOf('RUN test -s tools/'),to=docker.indexOf('\n\n# Exercise consistent',from);
 if(from<0||to<from)throw Error('Docker build audit block cannot be resolved');
 const block=docker.slice(from+4,to).replace(/\/app\/build/g,shellQuote(build));
 run('docker-build-checks-native','sh',['-ec',block]);
 node('consistent-sqlite-backup','tools/test-prestart-db-snapshot.js');
 node('private-review-http','tools/test-private-review-http.js');
 const port=await freePort(),BASE='http://127.0.0.1:'+port;
 const runtimeEnv={...env,NODE_ENV:'production',DATA_DIR:data,DB_PATH:path.join(data,'hub.db'),PORT:String(port),
  ADMIN_PASSWORD:crypto.randomBytes(30).toString('hex'),SECRET:crypto.randomBytes(40).toString('hex')};
 serverLog=fs.openSync(path.join(OUT,'server.log'),'w');
 server=cp.spawn(process.execPath,['--max-old-space-size=64','--max-semi-space-size=1','src/server.js'],{cwd:ROOT,env:runtimeEnv,stdio:['ignore',serverLog,serverLog]});
 let healthy=false;
 for(let i=0;i<150;i++){
  try{healthy=(await fetch(BASE+'/healthz',{signal:AbortSignal.timeout(1000)})).status===200;if(healthy)break}catch{}
  if(server.exitCode!==null)throw Error('Production server exited before readiness');
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 if(!healthy)throw Error('Production server did not become healthy');
 const fingerprint=await fetch(BASE+'/api/build').then(r=>r.json());
 node('localhost-deployment-assets','tools/verify-live-deployment.js',{...runtimeEnv,BASE,BUILD_SMOKE:'1'});
 node('localhost-auth-sessions','tools/test-auth-session-live.js',{...runtimeEnv,BASE,BUILD_SMOKE:'1'});
 return {runtimeFingerprint:fingerprint.build_fingerprint,
  sourceChecksInDockerBlock:[...new Set([...block.matchAll(/node (tools\/[\w-]+\.js)/g)].map(m=>m[1]))].length,
  runtimeHeapLimitMb:64,nativeModules:true,localhostHTTP:true};
}
(async()=>{
 let details={},error=null;
 try{details=await main()}catch(e){error=e.message;console.error(error);process.exitCode=1}
 finally{
  if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>{server.once('exit',resolve);setTimeout(()=>{server.kill('SIGKILL');resolve()},3000).unref()})}
  if(serverLog!==undefined)fs.closeSync(serverLog);
  const report={schema:1,testedAtUTC:new Date().toISOString(),node:process.version,passed:!error,
   ...details,records,error,dockerImageBuilt:false,deployed:false,physicalPhoneCertified:false,publicLaunchApproved:false};
  const target=path.join(OUT,'native-candidate.json');fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,report:target,records:records.map(r=>({label:r.label,passed:r.passed}))}));
 }
})();

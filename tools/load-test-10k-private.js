#!/usr/bin/env node
'use strict';
// Read-only stage-one performance exercise. 10,000 distinct simulated visits,
// NOT 10,000 authenticated users or 10,000 simultaneous connections.
// Runs exclusively against an owner's isolated local Hub instance.
// No external origins, purchases, account creation, score submission or giveaways.
const {performance}=require('node:perf_hooks');
const crypto=require('node:crypto');
const allowed=new Set(['127.0.0.1','localhost','::1','[::1]']);
function number(name,def,max){
 const arg=process.argv.find(x=>x.startsWith('--'+name+'='));
 const n=arg?Number(arg.split('=').slice(1).join('=')):def;
 if(!Number.isSafeInteger(n)||n<1||n>max)throw Error('Invalid --'+name+' (1 to '+max+')');
 return n;
}
function stageUrl(){
 const arg=process.argv.find(x=>x.startsWith('--base='));
 const raw=arg?arg.slice('--base='.length):'http://127.0.0.1:8787';
 const u=new URL(raw);
 if(u.protocol!=='http:'||!allowed.has(u.hostname)||u.username||u.password||u.pathname!=='/'||u.search||u.hash)
   throw Error('Only a loopback HTTP staging Hub is permitted; never stress Deplexo or another public server');
 return u.origin;
}
function percentile(sorted,f){return sorted.length?sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*f)-1)]:null;}
async function exercise({base=stageUrl(),visitors=number('visitors',10000,50000),concurrency=number('concurrency',24,128),timeoutMs=number('timeout-ms',10000,60000)}={}){
 if(process.env.HUB_ISOLATED_LOAD_APPROVED!=='YES')throw Error('Set HUB_ISOLATED_LOAD_APPROVED=YES only for an isolated, backed-up local test environment');
 if(!allowed.has(new URL(base).hostname))throw Error('Public endpoint is forbidden');
 const paths=['/healthz','/api/build','/api/games','/api/games-lib',
   '/api/shop/catalog?limit=12','/api/shop/rules','/api/leaderboard?game=jetpack-dash',
   '/manifest.webmanifest','/games','/'];
 const errors=[],samples=[],routes=new Map(paths.map(x=>[x,{requests:0,errors:0,serverErrors:0}]));
 let next=0,total=0,failed=0,serverErrors=0;
 const started=performance.now();
 async function single(path,user){
   const rec=routes.get(path);rec.requests++;total++;
   const t=performance.now();
   try{
     const res=await fetch(base+path,{method:'GET',redirect:'manual',
       headers:{'Accept':'application/json,text/html,*/*','X-Load-Test-Visitor':String(user),'Cache-Control':'no-cache'},
       signal:AbortSignal.timeout(timeoutMs)});
     await res.arrayBuffer();
     const ms=performance.now()-t;samples.push(ms);
     if(![200,204,302,304,401,403].includes(res.status)){
       failed++;rec.errors++;
       if(res.status>=500){serverErrors++;rec.serverErrors++;}
       if(errors.length<30)errors.push({path,status:res.status,user,ms:Math.round(ms)});
     }
   }catch(e){
     failed++;rec.errors++;if(errors.length<30)errors.push({path,status:'NETWORK',user,error:e.name});
   }
 }
 async function worker(){
   while(next<visitors){
     const user=next++;
     // A unique anonymous visitor reads two separate surfaces; no user or
     // account is created, preventing synthetic account pollution.
     await single(paths[user%paths.length],user);
     await single(paths[(user*7+3)%paths.length],user);
   }
 }
 await Promise.all(Array.from({length:Math.min(concurrency,visitors)},worker));
 const durationMs=performance.now()-started;samples.sort((a,b)=>a-b);
 const output={test:'isolated-read-only-10k-visitor',target:'loopback-only',simulatedAnonymousVisitors:visitors,
  peakWorkers:Math.min(concurrency,visitors),notAuthenticatedUsers:true,
  notSimultaneous10kConnections:true,writeEndpointsExercised:false,requests:total,failed,serverErrors,
  failureRate:total?failed/total:0,requestsPerSecond:Math.round(1000*total/durationMs*100)/100,
  durationMs:Math.round(durationMs),latencyMs:{p50:Math.round(percentile(samples,.5)||0),p95:Math.round(percentile(samples,.95)||0),p99:Math.round(percentile(samples,.99)||0)},
  routes:Object.fromEntries(routes),sampleErrors:errors,
  pass:failed===0&&serverErrors===0,requires:'separate 10k authenticated/concurrent DB, score replay, checkout and prize tests'};
 console.log(JSON.stringify(output,null,2));
 if(!output.pass)process.exitCode=1;
 return output;
}
if(require.main===module)exercise().catch(e=>{console.error(e.message);process.exitCode=2;});
module.exports={number,stageUrl,exercise};

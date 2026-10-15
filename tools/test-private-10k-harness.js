#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),cp=require('node:child_process'),path=require('node:path');
const exe=path.join(__dirname,'load-test-10k-private.js');
const remote=cp.spawnSync(process.execPath,[exe,'--base=https://glassy-drifter-9532.de.deplexo.com','--visitors=10000'],
 {encoding:'utf8',timeout:5000,env:{...process.env,HUB_ISOLATED_LOAD_APPROVED:'YES'}});
assert.equal(remote.status,2,'Remote public host must be refused before any test traffic');
assert.match(remote.stderr,/loopback HTTP staging Hub/);
const {exercise}=require('./load-test-10k-private');
(async()=>{
 let requests=0, writes=0;
 const server=http.createServer((req,res)=>{
   requests++;if(req.method!=='GET')writes++;
   res.writeHead(200,{'Content-Type':'application/json'});res.end('{"ok":true}');
 });
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 try{
   process.env.HUB_ISOLATED_LOAD_APPROVED='YES';
   const address='http://127.0.0.1:'+server.address().port;
   const result=await exercise({base:address,visitors:100,concurrency:8,timeoutMs:1500});
   assert.equal(result.simulatedAnonymousVisitors,100);
   assert.equal(result.requests,200);
   assert.equal(requests,200);
   assert.equal(writes,0,'Load harness must not submit payment/account/score writes');
   assert.equal(result.failed,0);
   assert.equal(result.pass,true);
   console.log(JSON.stringify({pass:true,remoteHostRejected:true,localMockVisitors:100,localMockRequests:200,writes:0,actualHubCapacityTested:false}));
 } finally {await new Promise(done=>server.close(done));}
})().catch(e=>{console.error(e);process.exitCode=1});

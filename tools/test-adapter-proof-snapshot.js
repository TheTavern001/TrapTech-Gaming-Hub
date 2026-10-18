#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/games-lib/adapter.js'),'utf8');
 let resolveScore,scorePayload;
 const win={},clock={now:()=>100};
 const fetch=(url,opts)=>{
   if(url==='/api/me')return Promise.resolve({status:200,json:async()=>({ok:true,user:{username:'t'}})});
   if(url==='/api/run/start')return Promise.resolve({status:200,json:async()=>({ok:true,token:'run-A',seed:'abc123'})});
   scorePayload=JSON.parse(opts.body);
   return new Promise(resolve=>{resolveScore=resolve;});
 };
 vm.runInNewContext(src,{window:win,fetch,performance:clock,
   URLSearchParams:class{get(){return null}},location:{search:''}},{timeout:2000});
 await win.Hub.start('gl-test');
 win.Hub.event('h',25);win.Hub.input();
 const result=win.Hub.submit(25);
 // Submit has already created immutable request content, before network resolves.
 await win.Hub.start('gl-test');
 win.Hub.event('h',999);
 assert.equal(scorePayload.token,'run-A');
 assert.equal(scorePayload.score,25);
 assert.equal(scorePayload.ev.e[2],25);
 assert.equal(scorePayload.ev.e.length,3);
 assert.equal(scorePayload.tel.n,1);
 resolveScore({status:200,json:async()=>({ok:true})});
 assert.equal((await result).ok,true);
 console.log(JSON.stringify({pass:true,proofIsolated:true,newRunCannotMutateOldSubmission:true,hostVerified:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});

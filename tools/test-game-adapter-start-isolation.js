#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{
 const code=fs.readFileSync(path.join(__dirname,'../public/games-lib/adapter.js'),'utf8');
 const callbacks=[],win={},context={window:win,URLSearchParams:class{get(){return null}},
   location:{search:''},performance:{now:()=>100},fetch:(url)=>url==='/api/me'?Promise.resolve({status:200,json:async()=>({ok:true,user:{username:'t'}})}):new Promise(resolve=>callbacks.push(resolve))};
 vm.runInNewContext(code,context,{timeout:2000});
 const old=win.Hub.start('old'),fresh=win.Hub.start('new');
 await new Promise(r=>setTimeout(r,20));
 // v8: a superseded start is dropped before it ever posts, so only the newest start reaches /api/run/start.
 assert.equal(callbacks.length,1);
 callbacks[0]({status:200,json:async()=>({ok:true,token:'new-token',seed:'22222222'})});
 await fresh;
 assert.equal(await old,null);
 assert.equal(win.Hub.token,'new-token');
 assert.equal(win.Hub.seed,'22222222');
 assert.equal(win.Hub.id,'new');
 console.log(JSON.stringify({pass:true,outOfOrderResponsesRejected:true,fullHTTPQA:false}));
})().catch(e=>{console.error(e);process.exitCode=1;});

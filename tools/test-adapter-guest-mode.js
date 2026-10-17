#!/usr/bin/env node
'use strict';
// v8: signed-out visitors get a playable practice run - no /api/run/start POST (so no 401 in the console), a local seed,
// a friendly non-error submit result, and no raw API strings.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/games-lib/adapter.js'),'utf8');
 const calls=[],win={};
 const fetch=(url,opt)=>{calls.push(url);
   if(url==='/api/me')return Promise.resolve({status:200,json:async()=>({ok:true,user:null})});
   return Promise.resolve({status:401,json:async()=>({ok:false,error:'Please sign in first.'})});};
 vm.runInNewContext(src,{window:win,fetch,performance:{now:()=>100},URLSearchParams:class{get(){return null}},location:{search:'',pathname:'/games-lib/x/'}},{timeout:2000});
 const seed=await win.Hub.start('gl-x');
 assert.match(String(seed),/^[0-9a-f]{8}$/);
 assert.deepEqual(calls,['/api/me'],'guests must not hit /api/run/start');
 assert.equal(win.Hub.guest,true);
 const r=await win.Hub.submit(120);
 assert.equal(r.ok,false);assert.equal(r.practice,true);
 assert.ok(!/Please sign in first/i.test(JSON.stringify(r)),'raw API text must never surface');
 assert.ok(!calls.includes('/api/score'));
 // signed-in but run/start fails with a raw server string: still a practice run, string hidden
 const calls2=[];const win2={};
 const fetch2=(url)=>{calls2.push(url);return Promise.resolve(url==='/api/me'?{status:200,json:async()=>({ok:true,user:{username:'t'}})}:{status:500,json:async()=>({ok:false,error:'SQLITE_BUSY boom'})});};
 vm.runInNewContext(src,{window:win2,fetch:fetch2,performance:{now:()=>100},URLSearchParams:class{get(){return null}},location:{search:''}},{timeout:2000});
 await win2.Hub.start('gl-x');
 const r2=await win2.Hub.submit(5);
 assert.ok(!/SQLITE/.test(JSON.stringify(r2))&&!win2.Hub.err);
 console.log(JSON.stringify({pass:true,guestPracticeNoAuthErrors:true,rawErrorsHidden:true}));
})().catch(e=>{console.error(e);process.exitCode=1});

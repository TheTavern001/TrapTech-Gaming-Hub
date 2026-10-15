#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
(async()=>{
 const src=fs.readFileSync(path.join(__dirname,'../public/games-lib/adapter.js'),'utf8');
 const sent=[],win={};const fetch=(url,opt)=>{sent.push({url,body:JSON.parse(opt.body)});return Promise.resolve({status:200,json:async()=>url==='/api/run/start'?{ok:true,token:'secure-token',seed:'2'}:{ok:true}});};
 vm.runInNewContext(src,{window:win,fetch,performance:{now:()=>100},URLSearchParams:class{get(){return null}},location:{search:''}},{timeout:2000});
 await win.Hub.start('test');
 for(const value of [NaN,Infinity,-Infinity,-1,Number.MAX_VALUE,'99',null]){
  const r=await win.Hub.submit(value);assert.equal(r.ok,false,String(value));
  assert.equal(win.Hub.token,'secure-token','Invalid score must not consume token');
 }
 assert.equal(sent.filter(r=>r.url==='/api/score').length,0,'Invalid values must not be transmitted');
 assert.equal((await win.Hub.submit(99)).ok,true);
 assert.equal(sent.filter(r=>r.url==='/api/score').length,1);
 console.log(JSON.stringify({pass:true,invalidScoresRejected:7,validScoreSubmitted:true,serverQA:false}));
})().catch(e=>{console.error(e);process.exitCode=1});

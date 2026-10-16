#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const start=file.indexOf('async function begin() {'),stop=file.indexOf('\n    g.rnd = mulberry();',start);
assert.ok(start>0&&stop>start,'Cannot locate the actual shared Kit run-start function');
const actual=file.slice(start,stop);
assert.match(actual,/\['event','event_code','giveaway_id','giveaway','playoff'\]/);
assert.match(actual,/signed && !validSeed/);
assert.match(file,/PRACTICE · NOT RANKED/,'Guest gameplay must communicate unranked status');
async function test(search,token,seed,expectRun,label){
 let initCalls=0;
 const g={state:'title',runSerial:0,parts:[],texts:[],score:0};
 const H={token:null,start:async()=>{H.token=token;return seed;}};
 const context={
  g,window:{Hub:H},Hub:H,def:{id:'game-test',init:()=>{initCalls++;}},
  gameSettingsOpen:false,document:{hidden:false},location:{search},
  URLSearchParams,K:{sfx:()=>{}},mulberry:()=>()=>0.5,
 };
 const begin=vm.runInNewContext(actual+'\nbegin;',context,{timeout:2000});
 await begin();
 assert.equal(g.state,expectRun?'play':'title',label);
 assert.equal(initCalls,expectRun?1:0,'No game world may start without valid official token: '+label);
 if(!expectRun)assert.ok(g.startError,'Blocked run explains failure: '+label);
 if(expectRun)assert.equal(g.practice,!token,'Live game must identify unsigned runs as practice: '+label);
}
(async()=>{
 await test('?event=OFFICIAL',null,null,false,'Rejected giveaway run');
 await test('?giveaway=123',null,null,false,'Rejected giveaway query alias');
 await test('?playoff=abc',null,null,false,'Rejected playoff run');
 await test('?event_code=123',null,null,false,'Rejected event-code query alias');
 await test('?giveaway_id=123',null,null,false,'Rejected giveaway-id query alias');
 await test('?event=OFFICIAL','signed-run','not-hex',false,'Malformed signed official seed');
 await test('','signed-run',null,false,'Malformed standard signed seed');
 await test('?event=OFFICIAL','signed-run','0000000000000000',true,'Valid zero-prefixed official seed');
 await test('?playoff=abc','signed-run','abcdef0123456789',true,'Valid playoff seed');
 await test('',null,null,true,'Unsigned free practice remains available');
 console.log(JSON.stringify({pass:true,actualKitStartExecuted:true,
  blockedUnscoredCompetitionStarts:7,validSignedStarts:2,guestPracticePreserved:true,guestModeLabeled:true,
  mobilePhoneVerified:false}));
})().catch(error=>{console.error(error);process.exitCode=1;});

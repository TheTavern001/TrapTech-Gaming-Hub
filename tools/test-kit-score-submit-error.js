#!/usr/bin/env node
'use strict';
// Execute the shared Kit end-of-run handler against isolated test fixtures.
// This verifies async boundaries and error state, not browser/server replay.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const start=source.indexOf('g.end = (why) =>');
const stop=source.indexOf('g.held = () =>',start);
assert.ok(start>=0&&stop>start,'Shared Kit end handler missing');
const segment=source.slice(start,stop);
assert.match(segment,/const finishedRun = g\.runSerial/,'Run identity must be captured');
assert.match(segment,/const finalScore = g\.score/,'Score must be snapshotted on game end');
assert.match(segment,/Promise\.resolve\(\)\.then\(\(\) => Hub\.submit\(finalScore\)\)/,
 'Synchronous Hub.submit throws must reject asynchronously using snapshotted score');
assert.match(segment,/\.catch\(\(\) =>/,'Submit errors must be handled');
const makeEnd=new Function('g','K','safeStore','def','window','Hub',
 segment+String.fromCharCode(10)+'return g.end;');
function fixture(submit) {
 const g={state:'play',score:42,best:0,runSerial:7,shake(){},sub:null};
 const window={Hub:{},__GL:{}},written=[];
 makeEnd(g,{sfx(){}},{set:(key,value)=>written.push([key,value])},
  {id:'submit-qa'},window,{submit});
 return {g,window,written};
}
async function main(){
 let calls=0;
 const failed=fixture(()=>{calls++;throw Error('synchronous offline failure');});
 failed.g.end('collision');
 assert.deepEqual(failed.g.sub,{pending:true},'Handler must never throw synchronously');
 failed.g.score=9999;
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls,1,'Single server submission attempt');
 assert.equal(failed.g.sub.ok,false,'Synchronous rejection clears pending result');
 assert.equal(failed.g.sub.pending,undefined);
 assert.equal(failed.window.__GL.lastSubmit,failed.g.sub,'Error visible to results');
 assert.deepEqual(failed.written,[['gl_best_submit-qa',42]],
  'Highest score stored from completed run');
 const rejected=fixture(()=>Promise.reject(Error('offline')));rejected.g.end();
 await new Promise(resolve=>setImmediate(resolve));assert.equal(rejected.g.sub.ok,false,'Async rejection clears pending state');
 const completed=fixture(score=>Promise.resolve({ok:true,score}));
 completed.g.end();
 completed.g.score=9999;
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(completed.g.sub,{ok:true,score:42},
  'Submitting the frozen final score, not subsequently mutable g.score');
 const stale=fixture(score=>Promise.resolve({ok:true,score}));
 stale.g.end();stale.g.runSerial=8;stale.g.sub={pending:true};
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(stale.g.sub,{pending:true},'Late response cannot clobber a newer run');
 console.log(JSON.stringify({pass:true,checks:4,
  contract:'executed Kit score submission: sync rejection, final-score snapshot, stale-run isolation',
  browserHTTPVerified:false,prizeCertified:false}));
}
main().catch(error=>{console.error(error);process.exitCode=1;});

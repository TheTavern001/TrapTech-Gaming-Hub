#!/usr/bin/env node
'use strict';
// Execute the production end handler with controlled submission results.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const code=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const start=code.indexOf('g.end = (why) =>'),stop=code.indexOf('g.held = () =>',start);
assert.ok(start>=0&&stop>start,'Shared game end handler missing');
function setup(submit){
 const g={state:'play',score:123,best:0,runSerial:4,shake(){}};
 const win={Hub:{submit},__GL:{}};
 vm.runInNewContext(code.slice(start,stop),{g,window:win,Hub:win.Hub,K:{sfx(){}},safeStore:{set(){}},def:{id:'qa'},Promise});
 return {g,win};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 const failed=setup(()=>{throw Error('sync failure');});
 failed.g.end('done');assert.equal(failed.g.sub.pending,true);await flush();
 assert.equal(failed.g.sub.ok,false);assert.match(failed.g.sub.error,/submission failed/i);
 assert.equal(failed.win.__GL.lastSubmit,failed.g.sub);
 const rejected=setup(()=>Promise.reject(Error('offline')));
 rejected.g.end();await flush();assert.equal(rejected.g.sub.ok,false);
 let captured;
 const success=setup(score=>{captured=score;return Promise.resolve({ok:true});});
 success.g.end();success.g.score=999;await flush();
 assert.equal(captured,123,'Submit finished score, never a new run score');
 assert.equal(success.g.sub.ok,true);
 let finish;
 const stale=setup(()=>new Promise(resolve=>finish=resolve));
 stale.g.end();await flush();stale.g.runSerial++;
 const next={pending:true};stale.g.sub=next;finish({ok:true});await flush();
 assert.equal(stale.g.sub,next,'Old response cannot overwrite a new run');
 console.log(JSON.stringify({pass:true,syncAndAsyncErrorsHandled:true,finishedScorePinned:true,restartIsolated:true,browserHTTPVerified:false}));
})().catch(e=>{console.error(e);process.exitCode=1});

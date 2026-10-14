#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const end=src.slice(src.indexOf('g.end = (why) =>'),src.indexOf('g.held = () =>'));
const start=src.slice(src.indexOf('async function begin()'),src.indexOf('g.rnd = mulberry(); def.init(g);'));
assert.match(start,/g\.runSerial = \(g\.runSerial \|\| 0\) \+ 1/);
assert.match(end,/const finishedRun = g\.runSerial/);
assert.match(end,/const finalScore = g\.score/);
assert.match(end,/Hub\.submit\(finalScore\)/);
assert.equal((end.match(/if \(g\.runSerial !== finishedRun\) return;/g)||[]).length,2,'Success and failure both reject stale callbacks');
// Model the same equality predicate used by production to validate ordering.
let runSerial=1,sub={pending:true};
const finishOld=()=>{if(runSerial!==1)return;sub={ok:true,score:100}};
runSerial=2;sub={pending:true};finishOld();
assert.deepEqual(sub,{pending:true},'Old completion must not alter new active run');
console.log(JSON.stringify({pass:true,contract:'run-isolated score callbacks',fullBrowserQA:false}));

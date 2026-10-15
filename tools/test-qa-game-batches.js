#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {planGameBatch}=require('./qa-game-batches');
const make=n=>Array.from({length:n},(_,i)=>({id:'game-'+i,route:'/game/'+i}));
for(const n of [87,100,500]){
 const a=planGameBatch(make(n));assert.equal(a.targets.length,n);assert.equal(a.fullCoverage,true);
}
const batch=planGameBatch(make(500),{start:'100',limit:'100'});
assert.equal(batch.targets.length,100);assert.equal(batch.targets[0].id,'game-100');assert.equal(batch.fullCoverage,false);
const end=planGameBatch(make(500),{start:'487',limit:'100'});
assert.equal(end.endExclusive,500);assert.equal(end.targets.length,13);
assert.throws(()=>planGameBatch(make(86)),/Catalog smaller/);
assert.throws(()=>planGameBatch(make(500),{start:500}),/past final/);
assert.throws(()=>planGameBatch(make(500),{start:-1}),/integer/);
assert.throws(()=>planGameBatch(make(500),{limit:0}),/range/);
assert.throws(()=>planGameBatch(make(500),{limit:'NaN'}),/integer/);
const sameId=make(100);sameId[99].id=sameId[98].id;
assert.throws(()=>planGameBatch(sameId),/Duplicate QA game ID/);
const sameRoute=make(100);sameRoute[99].route=sameRoute[98].route;
assert.throws(()=>planGameBatch(sameRoute),/Duplicate QA route/);
console.log(JSON.stringify({pass:true,verifiedCatalogSizes:[87,100,500],
 partialBatchCannotClaimFullCoverage:true,realBrowserRun:false}));

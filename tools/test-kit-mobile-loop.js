#!/usr/bin/env node
'use strict';
// Core mobile gameplay regression. Uses the real shared Kit PRNG function
// from source, not a rewritten approximation. No phone performance claim.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const line=source.split(/\r?\n/).find(s=>s.trim().startsWith('function mulberry(seedHex) {'));
assert.ok(line,'Shared seeded PRNG function must exist');
const forbidden={...Math,random:()=>{throw Error('Random fallback used for valid official seed');}};
Object.setPrototypeOf(forbidden,Math);
const seeded=vm.runInNewContext(line+'\n mulberry;',{
 Math:forbidden,parseInt,String,Number},{timeout:1500});
const seq=hex=>{const rng=seeded(hex);return Array.from({length:8},()=>rng());};
assert.deepEqual(seq('0000000000000000'),seq('00000000ffffffff'),
 'Valid zero-prefix seeds must be deterministic independent of suffix');
assert.deepEqual(seq('0000000000000000'),seq('0000000000000000'),
 'A score replay with the same valid seed must generate identical games');
assert.notDeepEqual(seq('0000000000000000'),seq('0000000100000000'),
 'Different first 8 seed digits must alter generated gameplay');
assert.ok(seq('0000000000000000').every(x=>Number.isFinite(x)&&x>=0&&x<1));
assert.ok(seq('ABCDEF1234567890').every(x=>Number.isFinite(x)&&x>=0&&x<1));
const noSeed=vm.runInNewContext(line+'\n mulberry;',{
 Math:Object.assign(Object.create(Math),{random:()=>0.5}),parseInt,String,Number},{timeout:1500});
assert.equal(typeof noSeed(null)(),'number','Offline non-ranking guest preview can seed locally');
assert.match(source,/let vignetteGradient = null/);
assert.match(source,/if \(!vignetteGradient\) \{/);
assert.match(source,/const edge=vignetteGradient;/);
assert.equal((source.match(/c\.createRadialGradient\(W\/2,Hh\/2/g)||[]).length,1,
 'Static HUD vignette must not be constructed twice');
assert.ok(source.indexOf('if (!vignetteGradient) {')<source.indexOf('const edge=vignetteGradient;'),
 'Gradient must be lazy-cached before use');
console.log(JSON.stringify({pass:true,zeroSeedReplayDeterministic:true,
 inputSeedChangesSequence:true,invalidOfflineSeedFallsBack:true,
 perFrameVignetteAllocationRemoved:true,realPhonePerformanceTested:false}));

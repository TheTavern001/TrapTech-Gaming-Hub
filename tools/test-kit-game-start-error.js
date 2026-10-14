#!/usr/bin/env node
'use strict';
// Source contract; only real browser HTTP tests can certify visible UX.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const a=src.indexOf('async function begin()'),b=src.indexOf('g.rnd = mulberry(); def.init(g);',a);
assert.ok(a>=0&&b>a);
const begin=src.slice(a,b);
assert.match(begin,/try \{ seed = window\.Hub \? await Hub\.start\(def\.id\) : null; \}/);
assert.match(begin,/catch \(_\) \{ g\.state = 'title'; g\.startError = /);
assert.match(begin,/return; \}/,'Rejected start cannot initialize an unverified run');
assert.match(src,/label\(g\.startError \|\| \(g\.best/,'Failure should be displayed on title screen');
console.log(JSON.stringify({pass:true,contract:'start rejection recovery',browserHTTPVerified:false}));

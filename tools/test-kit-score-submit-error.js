#!/usr/bin/env node
'use strict';
// Source contract for the shared Kit end-of-run submission path. The full
// browser/HTTP rehearsal is separately required; this is not a prize certification.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const start=code.indexOf('g.end = (why) =>');
const stop=code.indexOf('g.held = () =>',start);
assert.ok(start>=0&&stop>start,'Shared game end submission handler missing');
const segment=code.slice(start,stop);
assert.match(segment,/Promise\.resolve\(\)\.then\(\(\) => Hub\.submit\(g\.score\)\)/,'Capture synchronous submission failures as rejected promises');
assert.match(segment,/\.catch\(\(\) =>/,'Score submission must handle rejected promises');
assert.match(segment,/g\.sub = \{ ok: false, error:/,'Submission error must clear pending state');
assert.match(segment,/window\.__GL\.lastSubmit = g\.sub/,'Expose failure for game results and tests');
console.log(JSON.stringify({pass:true,contract:'score submission error handling',browserHTTPVerified:false}));

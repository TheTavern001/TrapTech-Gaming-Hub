#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
const a=source.indexOf('async function begin()'),b=source.indexOf('g.rnd = mulberry(); def.init(g);',a);
assert.ok(a>=0&&b>a);
const begin=source.slice(a,b);
assert.match(begin,/g\.paused = document\.hidden \|\| gameSettingsOpen/,'A late start response must not unpause a hidden game');
assert.match(begin,/if \(!g\.paused\) K\.sfx\('power'\)/,'Hidden startup must not play start SFX');
assert.match(source,/document\.addEventListener\('visibilitychange',[\s\S]*?g\.paused=true/);
console.log(JSON.stringify({pass:true,contract:'async start obeys background pause',deviceQA:false}));

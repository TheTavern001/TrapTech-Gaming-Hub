#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../public/js/avatar-3d.js'),'utf8');
new vm.Script(src.replace(/^import .*$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b)/g,''));
assert.match(src,/new IntersectionObserver\(entries=>/);
assert.match(src,/visibilityObserver\.observe\(stage\)/);
assert.match(src,/if\(document\.hidden \|\| !stageVisible\)/);
assert.match(src,/visibilityObserver\.disconnect\(\)/);
console.log(JSON.stringify({pass:true,contract:'fallback 3D offscreen renderer suspend',deviceTested:false}));

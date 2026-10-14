#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../public/js/avatar-rig.js'),'utf8');
new vm.Script(src.replace(/^import .*$/gm,'').replace(/\bexport\s+(?=async\s+function\b)/g,''));
assert.match(src,/powerPreference:'low-power'/,'Preview should prefer energy-conscious rendering on phones');
assert.match(src,/renderer\.shadowMap\.enabled=!isPortrait/,'Small profile avatar previews do not need full shadow map');
assert.match(src,/isPortrait\?1\.25:1\.5/,'Limit GPU backing pixels on profile');
assert.match(src,/new IntersectionObserver\(entries=>/,'Track stage visibility');
assert.match(src,/visibilityObserver\.disconnect\(\)/,'Release observer on cleanup');
assert.match(src,/document\.hidden\|\|!stageVisible/,'Do not render hidden/offscreen avatars');
console.log(JSON.stringify({pass:true,contract:'mobile rig GPU resource budget',realDeviceP95Measured:false}));

#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/kit.js'),'utf8');
for(const event of ['blur','pagehide','freeze']){
 const statement="addEventListener('"+event+"',()=>{clearInputs();if(g.state==='play')g.paused=true;});";
 assert.ok(source.includes(statement),event+' must release held controls and pause active run');
}
assert.match(source,/document\.addEventListener\('visibilitychange',[\s\S]*?clearInputs\(\);if\(g\.state==='play'\)g\.paused=true;/);
assert.ok(!source.includes("addEventListener('pageshow',()=>{g.paused=false"),'Returning to foreground may not auto-resume prize game');
console.log(JSON.stringify({pass:true,events:['blur','pagehide','freeze','visibilitychange'],scope:'static lifecycle contract',physicalPhoneQA:false}));

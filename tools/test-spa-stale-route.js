#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'../public/js/app.js'),'utf8');
new vm.Script(src.replace(/^import .*$/gm,''));
const a=src.indexOf('function shell(path, inner,'),b=src.indexOf('// loading skeleton',a);
assert.ok(a>=0&&b>a);
const chunk=src.slice(a,b);
const output={innerHTML:'not-replaced'};
const loc={pathname:'/shop'};
const ctx={$app:output,location:loc,topbar:()=>'',footer:()=>'',bottomnav:()=>'',setTitle:()=>{},updateBell:()=>{},TITLES:{}};
vm.runInNewContext(chunk+'this.testShell=shell;',ctx);
ctx.testShell('/profile/old','stale');
assert.equal(output.innerHTML,'not-replaced','Old async result must not overwrite a newly selected route');
ctx.testShell('/shop','correct');
assert.match(output.innerHTML,/correct/,'Active path must render');
console.log(JSON.stringify({pass:true,stalePageBlocked:true,currentPageRenders:true,liveBrowserVerified:false}));

#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../public/js/app.js'),'utf8');
new vm.Script(src.replace(/^import .*$/gm,''));
const hydrate=src.slice(src.indexOf('async function hydrateProfileAvatar('),src.indexOf('// Official Trap Tech Solutions',src.indexOf('async function hydrateProfileAvatar(')));
const render=src.slice(src.indexOf('async function render()'),src.indexOf('async function render()')+650);
assert.match(hydrate,/const requestedNavigation = navCount/);
assert.match(hydrate,/navCount !== requestedNavigation/g);
assert.match(hydrate,/if \(!stage\.isConnected \|\| navCount !== requestedNavigation\) cleanup\(\)/);
assert.match(render,/priorAvatar\._avatar3dCleanup\(\)/);
assert.ok(render.indexOf('priorAvatar._avatar3dCleanup()')<render.indexOf('if (S.game)'), 'Cleanup must precede route replacement');
console.log(JSON.stringify({pass:true,profileNavigationCleanup:true,staleRequestGuard:true,realBrowserTested:false}));

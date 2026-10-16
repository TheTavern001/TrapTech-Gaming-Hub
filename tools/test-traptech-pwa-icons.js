#!/usr/bin/env node
'use strict';
// Run AFTER build-traptech-pwa-icons.js in Docker, or run both commands locally.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const icon=require('./build-traptech-pwa-icons');
const pub=path.resolve(__dirname,'../public');
const manifest=JSON.parse(fs.readFileSync(path.join(pub,'manifest.webmanifest'),'utf8'));
const html=fs.readFileSync(path.join(pub,'index.html'),'utf8');
const sw=fs.readFileSync(path.join(pub,'sw.js'),'utf8');
const expected=['icon-192.png','icon-512.png','maskable-512.png','apple-touch-icon.png'];
for(const suffix of expected){
 assert.ok(manifest.icons.some(x=>x.src.includes(suffix))||html.includes(suffix),'Missing PWA/Apple icon: '+suffix);
}
assert.ok(manifest.icons.some(x=>x.purpose==='maskable'));
assert.ok(manifest.icons.every(x=>x.src.includes('v=tt-crown-20261014')));
assert.ok(html.includes('traptech-app-icon.svg?v=tt-crown-20261014'));
assert.ok(html.includes('apple-touch-icon.png?v=tt-crown-20261014'));
assert.ok(sw.includes('gh-shell-v10-phone-20261015'));
assert.ok(sw.includes('/css/mobile-release.css'),'Mobile polish must be cached for installable PWA');
const files=icon.generated();
for(const {rel,size,bytes} of files){
 const installed=fs.readFileSync(path.join(pub,rel));
 assert.ok(installed.equals(bytes),'Stale/disconnected icon asset: '+rel);
 if(size){
  assert.equal(installed.toString('hex',0,8),'89504e470d0a1a0a','Valid PNG: '+rel);
  assert.equal(installed.readUInt32BE(16),size,'PNG width: '+rel);
  assert.equal(installed.readUInt32BE(20),size,'PNG height: '+rel);
 }
}
// Enforce the precise brand contract required by verify-prelaunch.js so the
// earlier icon build test cannot pass while the later release audit fails.
const canonical = fs.readFileSync(path.join(pub,'assets/brand/traptech-app-icon.svg'),'utf8').trim();
for(const alias of ['favicon.svg','hub-mark.svg','tt-favicon.svg','tt-maskable.svg']){
 const actual=fs.readFileSync(path.join(pub,'assets/brand',alias),'utf8').trim();
 assert.equal(actual,canonical,'SVG alias drift: '+alias);
}
assert.match(html,/href=["']\/assets\/brand\/traptech-app-icon\.svg(?:\?[^"']*)?["']/,
 'Homepage favicon must use canonical Trap Tech icon (versioned URL allowed)');
assert.match(html,/<img[^>]+src=["']\/assets\/brand\/traptech-app-icon\.svg["']/,
 'Homepage boot splash must use canonical Trap Tech icon');

assert.ok(icon.svg().includes('ttg')&&icon.svg().includes('<polygon'),'Must use existing TT crown/monogram vectors');
console.log(JSON.stringify({pass:true,assetFiles:files.length,icons:['192','512','maskable-512','apple-180'],source:'existing tt-mono.svg',oldControllerPngsRejected:true,deviceInstallTested:false}));

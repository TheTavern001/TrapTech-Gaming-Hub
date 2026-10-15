#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const dino=read('public/games-lib/dino-dash/bridge.js');
const runner=read('public/games-lib/dino-dash/index.js');
const bud=read('public/games-lib/bud-merge/js/hub-bridge.js');
const hex=read('public/games-lib/hex-stack/hub-bridge.js');
for(const [name,source] of [['dino bridge',dino],['Chromium runner',runner],['bud bridge',bud],['hex bridge',hex]])
 new vm.Script(source,{filename:name});
assert.ok(dino.includes("if (!seed || !Hub.token)")&&dino.includes("state = 'starting'"));
assert.ok(dino.includes('startPending = Promise.resolve()')&&dino.includes('ready()'));
assert.ok(runner.includes('HubTrex.start().then(allowed => { if (allowed) this.playIntro(); })'));
assert.ok(runner.includes('HubTrex.start().then(allowed => { if (allowed) this.restart(); })'));
assert.ok(!runner.includes('window.HubTrex && HubTrex.start(); // [Gaming Hub hook]'));
assert.ok(bud.includes("if (!seed || !Hub.token)")&&bud.includes("state = 'starting'"));
assert.ok(hex.includes("if (!seed || !Hub.token) return fail()"));
assert.ok(!hex.includes('go(null)'), 'Missing server seed may never launch an unsigned Hex Stack game');
assert.ok(hex.includes('Hub.start(\'gl-hex-stack\').then(go, fail)'));
console.log(JSON.stringify({passed:true,vendorGames:3,serverSignedStartRequired:true,
 gameplayClockGatedForDesertDash:true,offlineGuestScoredRunCannotStart:true,
 browserDeviceBehaviorNotYetTested:true}));

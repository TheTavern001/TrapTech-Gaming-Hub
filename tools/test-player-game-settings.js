#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const prefs=read('public/js/player-prefs.js').replace(/export /g,'');
const app=read('public/js/app.js'),kit=read('public/games-lib/kit.js');
new Function(prefs);
new Function(kit);
new Function(app.replace(/^import .*$/gm,''));
const store=new Map(),localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v))};
const p=new Function('localStorage','document',prefs+';return {globalPrefs,saveGlobal,effective,saveGame,gameOverrides,qualityCap};')(localStorage,undefined);
assert.equal(p.globalPrefs().quality,'auto');
assert.equal(p.qualityCap('battery',3),1);
assert.equal(p.qualityCap('sharp',3),2.5);
p.saveGlobal({sound:false,quality:'sharp',showFps:true,reducedMotion:true,highContrast:true});
assert.equal(store.get('gl_mute'),'1');assert.equal(store.get('jd_muted'),'1');
assert.equal(store.get('gh_reduce_motion'),'1');
p.saveGame('rail-rush',{sound:true,quality:'battery',showFps:false});
assert.equal(p.effective('rail-rush').quality,'battery');
assert.equal(p.effective('other').quality,'sharp');
p.saveGame('rail-rush',{sound:null,quality:null,showFps:null});
assert.equal(p.effective('rail-rush').quality,'sharp');
p.saveGlobal({quality:'invalid-pay-to-win'});
assert.equal(p.globalPrefs().quality,'sharp');
assert.ok(app.includes('GP.openGameSettings('));
assert.ok(app.includes('id="game-settings"'));
assert.ok(kit.includes("import('/js/player-prefs.js')"));
assert.ok(kit.includes('wasPaused=g.paused;g.paused=true'));
for(const key of ['gp-sound','gp-contrast','gp-quality','gp-fps'])assert.ok(app.includes(key));
assert.ok(fs.existsSync(path.join(__dirname,'../public/css/player-prefs.css')));
assert.ok(!prefs.includes('/api/score'));
// Verify every registry entry has a supported settings implementation, including
// licensed engines that bypass Kit. Fail for newly added unintegrated engines.
const catalog=require('../src/games-lib').games;
assert.equal(catalog.length,80,'Existing library inventory should remain intact');
const vendored=new Set(['bud-merge','hex-stack','dino-dash']);
assert.equal(catalog.filter(g=>g.build==='built').length,77);
assert.equal(catalog.filter(g=>g.build==='vendored').length,3);
for(const item of catalog){
 const html=read('public/games-lib/'+item.slug+'/index.html');
 if(item.build==='vendored'){
   assert.ok(vendored.has(item.slug),'New independent game engine has no settings adapter: '+item.slug);
   assert.ok(html.includes('../vendor-settings.mjs'),'Vendored game missing settings UI: '+item.slug);
 }else{
   assert.ok(html.includes('../kit.js'),'Built game lost Kit settings bridge: '+item.slug);
 }
}
const independent=read('public/games-lib/vendor-settings.mjs');
new Function(independent.replace(/^import .*$/gm,''));
for(const id of ['gl-bud-merge','gl-hex-stack','gl-dino-dash'])assert.ok(independent.includes(id));
assert.ok(independent.includes('r.stop()')&&independent.includes('r.play()'),'Runner pause/resume required');
assert.ok(independent.includes('window.__GL.g.paused'),'Hextris native pause required');
assert.ok(read('public/games-lib/bud-merge/js/hub-bridge.js').includes('window.__ttVendorSettingsPaused'),'2048 movement must freeze while menu open');
assert.ok(prefs.includes("modal.addEventListener('keydown',e=>e.stopPropagation())"),'Settings must not report gameplay keyboard events');
assert.ok(read('public/index.html').includes('/css/player-prefs.css'),'App needs live high-contrast theme');
console.log(JSON.stringify({passed:true,globalOptions:5,gameOverrides:3,scope:'visual and sound only'}));

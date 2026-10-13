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

/* Native Hextris pause lasts 400ms and title has a capture-phase starter.
 * Reproduce actual game bridge/keyboard source with stubbed DOM + native clock.
 * This tests source behavior, NOT FPS, Android rendering or score security. */
const vm=require('node:vm'),hexBridge=read('public/games-lib/hex-stack/hub-bridge.js'),
  hexInput=read('public/games-lib/hex-stack/js/input.js');
function hexFixture(){
  let now=0;const timers=[],listeners={};
  const c={gameState:1,pausable:true,started:0,score:0,inputs:0,
    performance:{now:()=>0},requestAnimationFrame(){},
    document:{hidden:false,addEventListener(){}},
    Hub:{input(){c.inputs++},start(){return Promise.resolve(null)},submit(){return Promise.resolve({ok:true})}},
    init(){},hubSeed(){},startBtnHandler(){c.started++},
    setTimeout(fn,delay){const id=timers.length+1;timers.push({id,at:now+delay,active:true,fn});return id;},
    clearTimeout(id){const t=timers.find(t=>t.id===id);if(t)t.active=false;},
    addEventListener(k,fn,capture){(listeners[k]??=[]).push({fn,capture})}
  };c.window=c;
  // Model view.js native pause debounce and delayed resume.
  c.pause=()=>{if(c.pausable===false||c.gameState===0||c.gameState===2)return;
    c.pausable=false;
    if(c.gameState===1){c.gameState=-1;c.setTimeout(()=>{c.pausable=true},400)}
    else if(c.gameState===-1)c.setTimeout(()=>{c.gameState=1;c.pausable=true},400);
  };
  vm.runInNewContext(hexBridge,c,{filename:'hex-stack/hub-bridge.js',timeout:2000});
  return {c,listeners,flush(){
    for(let i=0;timers.some(t=>t.active);i++){
      assert.ok(i<80,'Hextris scheduled timers must terminate');
      const t=timers.filter(t=>t.active).sort((a,b)=>a.at-b.at)[0];
      t.active=false;now=t.at;t.fn();
    }
  }};
}
{
  const {c,flush}=hexFixture();c.__GL.g.paused=true;c.__GL.g.paused=false;
  assert.equal(c.__GL.g.resumePending,true,'Fast close should queue resume');
  flush();assert.equal(c.gameState,1,'Fast close should not strand game paused');
}
{
  const {c,flush}=hexFixture();c.__GL.g.paused=true;c.__GL.g.paused=false;
  c.__GL.g.paused=true;assert.equal(c.__GL.g.resumePending,false);
  flush();assert.equal(c.gameState,-1,'Reopen must cancel pending resume');
}
{
  const {c,listeners}=hexFixture();c.gameState=0;
  const fire=listeners.mouseup.find(x=>x.capture===true).fn;
  const hit=cls=>({closest:q=>q.includes(cls)?{}:null});
  fire({type:'mouseup',target:hit('.ttgs-root')});
  fire({type:'mouseup',target:hit('.glback')});
  assert.equal(c.started,0,'Settings/Back taps must never start Hex Stack');
  fire({type:'mouseup',target:{closest:()=>null}});
  assert.equal(c.started,1,'Tapping the game must still start Hex Stack');
}
{
  const keys={};let rotated=0;
  const c={gameState:-1,rush:1,settings:{speedModifier:1,speedUpKeyHeld:false},
    MainHex:{rotate(){rotated++}},navigator:{userAgent:'desktop'},
    keypress:{register_combo:o=>{keys[o.keys]=o}},$:()=>({on(){return this}})};
  c.window=c;
  vm.runInNewContext(hexInput+'\naddKeyListeners();',c,{filename:'hex-stack/js/input.js',timeout:2000});
  keys.left.on_keydown();keys.down.on_keydown();
  assert.equal(rotated,0,'Rotation must be blocked when paused');
  assert.equal(c.rush,1,'Speed boost must be blocked when paused');
  c.gameState=1;keys.left.on_keydown();keys.down.on_keydown();
  assert.equal(rotated,1);assert.equal(c.rush,4,'Playing controls must still work');
  c.gameState=-1;keys.down.on_keyup();
  assert.equal(c.rush,1,'Releasing fast-drop while paused must reset speed');
  assert.equal(c.settings.speedUpKeyHeld,false);
}
assert.ok(independent.includes('!g?.resumePending'),'Rapid menu reopen must retain original running state');
assert.ok(independent.includes('window.settings?.speedUpKeyHeld'),'Settings open must clear fast-drop');

console.log(JSON.stringify({passed:true,globalOptions:5,gameOverrides:3,scope:'visual and sound only'}));

#!/usr/bin/env node
'use strict';
// Strict mobile-ONLY HTML entry contract. Not device attestation: UA may be
// spoofed, and authorization / score validation must stay server-side.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const gate=require('../src/mobile-entry');
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const android='Mozilla/5.0 (Linux; Android 16; SM-G990U) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const desktop='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const mac='Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7) AppleWebKit/605.1.15 Safari/605.1.15';
const tablet='Mozilla/5.0 (Linux; Android 16; Pixel Tablet) AppleWebKit/537.36 Chrome/130 Safari/537.36';
const ipad='Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1';
const req=(ua,route='/',opts={})=>({method:opts.method||'GET',path:route,
 headers:{'user-agent':ua,accept:opts.accept||'text/html'}});
for(const agent of [iphone,android]){
 assert.equal(gate.isPhone(agent),true);
 for(const route of ['/', '/games', '/giveaways', '/sponsor','/avatar','/games-lib/beat-tiles/index.html'])
  assert.equal(gate.shouldShowMobilePage(req(agent,route)),false,'Phones must access '+route);
}
for(const agent of [desktop,mac,tablet,ipad]){
 for(const route of ['/', '/games','/giveaways','/games-lib/alien-rows/index.html'])
  assert.equal(gate.shouldShowMobilePage(req(agent,route)),true,'Non-phone page must be held: '+route);
 for(const route of ['/api/score','/healthz','/api/build','/css/app.css','/mobile-only.html','/sw.js','/manifest.webmanifest'])
  assert.equal(gate.shouldShowMobilePage(req(agent,route)),false,'Keep technical/static routes reachable: '+route);
}
assert.equal(gate.shouldShowMobilePage(req('facebookexternalhit/1.1')) ,false,'Sharing crawler needs OG metadata');
assert.equal(gate.shouldShowMobilePage(req(desktop,'/games',{accept:'application/json'})),false,
 'JSON/API requests are not page navigations');
assert.equal(gate.shouldShowMobilePage(req(desktop,'/games',{method:'POST'})),false,
 'Do not interfere with business API methods');
let shown=false,proceeded=false;
gate.gate(req(desktop,'/games-lib/alien-rows/index.html'),{
 setHeader(k,v){if(k==='Cache-Control')assert.match(v,/no-store/);},
 status(n){assert.equal(n,200);return this;},
 sendFile(p){assert.equal(p,path.join(root,'public/mobile-only.html'));shown=true;}
},()=>{proceeded=true;});
assert.equal(shown,true);assert.equal(proceeded,false);
shown=false;proceeded=false;
gate.gate(req(android,'/games'),{sendFile(){shown=true;}},()=>{proceeded=true;});
assert.equal(shown,false);assert.equal(proceeded,true);
const html=fs.readFileSync(path.join(root,'public/mobile-only.html'),'utf8');
assert.match(html,/Android phone or iPhone/);
assert.match(html,/Copy link for your phone/);
assert.match(html,/traptech-app-icon\.svg/);
const server=fs.readFileSync(path.join(root,'src/server.js'),'utf8');
assert.ok(server.indexOf("app.use(require('./mobile-entry').gate)")<server.indexOf("app.use(require('./static-gz')"),
 'Mobile HTML gate must execute BEFORE compressed static response');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/manifest.webmanifest'),'utf8'));
assert.equal(manifest.display,'standalone');
assert.equal(manifest.orientation,'any','Both portrait and landscape phone games must work in installed PWA');
assert.equal(manifest.scope,'/');
assert.ok(fs.readFileSync(path.join(root,'public/index.html'),'utf8').includes('rel="manifest"'));
const mobileCss=fs.readFileSync(path.join(root,'public/css/mobile-release.css'),'utf8');
const htmlShell=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
const worker=fs.readFileSync(path.join(root,'public/sw.js'),'utf8');
for(const key of ['safe-area-inset-bottom','min-height:44px','orientation:landscape',
 'prefers-reduced-motion','avatar-stage','home-intro-actions'])
 assert.ok(mobileCss.includes(key),'Missing mobile visual/touch QA contract: '+key);
assert.ok(htmlShell.includes('/css/mobile-release.css'),'Phone styling must load LAST in SPA shell');
assert.ok(worker.includes('/css/mobile-release.css'),'Phone styling must be cached by installable PWA');
const app=fs.readFileSync(path.join(root,'public/js/app.js'),'utf8');
assert.ok(!app.includes('Built for mobile and desktop.'),'Live Hub copy may not advertise desktop support');
const docker=fs.readFileSync(path.join(root,'Dockerfile'),'utf8');
const shell=fs.readFileSync(path.join(root,'scripts/offline-release-gate.sh'),'utf8');
const offline=fs.readFileSync(path.join(root,'tools/offline-release-rehearsal.js'),'utf8');
assert.ok(docker.includes('node tools/test-mobile-only-entry.js'));
assert.ok(shell.includes('node tools/test-mobile-only-entry.js'));
assert.ok(offline.includes("'tools/test-mobile-only-entry.js'"));
console.log(JSON.stringify({pass:true,phoneAccess:true,desktopPagesHeld:true,
 shareCrawlerMetadataRetained:true,pwaPortraitAndLandscape:true,
 paymentApisUnchanged:true,userAgentNotSecurityAttestation:true,
 desktopAppSeparate:true,physicalPhoneQa:false}));

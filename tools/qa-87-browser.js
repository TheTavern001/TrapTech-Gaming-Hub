#!/usr/bin/env node
'use strict';
// Non-destructive mobile-emulation smoke for every currently active Hub title.
// NOT an AAA or device signoff. Screenshot reviews, legitimate score replay,
// physical Android/iOS tests and asset rights remain separate release gates.
// Examples:
// BASE=http://127.0.0.1:8787 node tools/qa-87-browser.js
// QA_START_INDEX=100 QA_MAX_GAMES=100 BASE=http://127.0.0.1:8787 node tools/qa-87-browser.js
// BASE=https://existing-app.example QA_INTERACTIVE_AUTH=1 QA_HEADLESS=0 node tools/qa-87-browser.js
// QA_STORAGE_STATE=/tmp/reviewer.json BROWSER_ENGINE=webkit node tools/qa-87-browser.js
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),readline=require('node:readline');
const {planGameBatch}=require('./qa-game-batches');
const {loopbackOrigin,qaRequestAllowed,inspectGameRuntime}=require('./qa-game-runtime');
const {summarizeFramePacing}=require('./qa-frame-pacing');
const ROOT=path.resolve(__dirname,'..');
const BASE=String(process.env.BASE||'http://127.0.0.1:8787').replace(/\/$/,'');
const RUNS=Math.max(1,Math.min(30,Number(process.env.QA_SECONDS)||5));
const ENGINE=process.env.BROWSER_ENGINE||'chromium';
const OUT=path.resolve(process.env.QA_REPORT_DIR||path.join(os.tmpdir(),'traptech-qa-87'));
const SCREENSHOTS=path.join(OUT,'screenshots');
const stateFile=process.env.QA_STORAGE_STATE||'';
const INTERACTIVE=process.env.QA_INTERACTIVE_AUTH==='1';
const allowRunStart=loopbackOrigin(BASE)||process.env.QA_ALLOW_RUN_START==='1';
const TAKE_ALL=process.env.QA_ALL_SCREENSHOTS==='1';
const STRICT_PACING=process.env.QA_REQUIRE_PACING==='1';
const HEADLESS=process.env.QA_HEADLESS!=='0'&&!INTERACTIVE;
if(!/^https?:\/\/[^/?#]+$/i.test(BASE)){console.error('BASE must be an HTTP(S) origin');process.exit(2);}
if(!['chromium','webkit'].includes(ENGINE)){console.error('BROWSER_ENGINE must be chromium or webkit');process.exit(2);}
if(INTERACTIVE&&HEADLESS){console.error('Interactive sign-in needs a headed browser');process.exit(2);}
let pw;
try{pw=require('playwright');}
catch{try{pw=require('playwright-core');}catch{
 console.error('Playwright unavailable. Install for your local QA machine: npm install --no-save --no-package-lock playwright');
 process.exit(2);
}}
const {games:catalog}=require('../src/games-lib');
const cfg=fs.readFileSync(path.join(ROOT,'src/config.js'),'utf8');
const body=(cfg.match(/const GAMES = \[([\s\S]*?)\n\];/)||[])[1]||'';
const core=[...body.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
 .filter(m=>!new Set(['plinko','spin-to-win','blazed-roulette']).has(m[1]))
 .map(m=>({id:m[1],title:m[2],route:'/play/'+encodeURIComponent(m[1]),kind:'core'}));
const library=catalog.filter(g=>g.playable!==false&&!g.retired)
 .map(g=>({id:g.id,title:g.title,route:g.url,kind:'library',build:g.build}));
const games=[...core,...library];
if(core.length<13||library.length<74||games.length<87){
 console.error('Missing baseline active games',core.length,library.length);process.exit(2);
}
const batch=planGameBatch(games,{start:process.env.QA_START_INDEX??0,
 limit:process.env.QA_MAX_GAMES??games.length,minimumActive:87});
const targets=batch.targets,results=[];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function filename(name){return name.replace(/[^a-z0-9._-]/gi,'_');}
async function interactiveSignIn(browserOptions){
 const context=await browserOptions.browser.newContext(browserOptions.context);
 const page=await context.newPage();
 console.log('Sign in through the browser window. Do not paste account credentials into a terminal or repo.');
 await page.goto(BASE+'/signin',{waitUntil:'domcontentloaded',timeout:25000});
 await new Promise(resolve=>readline.createInterface({input:process.stdin,output:process.stdout})
   .question('Press Enter after you are signed in to continue QA: ',()=>resolve()));
 const me=await page.evaluate(async()=>{try{const r=await fetch('/api/me');return r.ok?await r.json():null}catch{return null}});
 if(!me?.user){await context.close();throw Error('Signed-in reviewer not established; refusing to test anonymous/private pages');}
 // Keep storage state in temp, not repository, screenshots or build logs.
 // The user stays authenticated in this in-memory browser context.
 // Do not write reviewer session cookies to disk, even in a tmp directory.
 await page.close();
 return context;
}
async function main(){
 if(!allowRunStart)throw Error('Remote QA needs QA_ALLOW_RUN_START=1 to create temporary signed run-start records');
 fs.mkdirSync(SCREENSHOTS,{recursive:true});
 const executablePath=process.env.CHROME_BIN||
  ['/usr/bin/chromium','/usr/bin/google-chrome','/usr/bin/chromium-browser'].find(x=>fs.existsSync(x));
 const browser=await pw[ENGINE].launch({
  headless:HEADLESS,
  ...(ENGINE==='chromium'&&executablePath?{executablePath}:{}),
  args:ENGINE==='chromium'?['--no-sandbox','--disable-dev-shm-usage']:[]
 });
 const contextOptions={viewport:{width:390,height:844},deviceScaleFactor:2,
  isMobile:true,hasTouch:true,locale:'en-US'};
 try{
  const context=INTERACTIVE
   ? await interactiveSignIn({browser,context:contextOptions})
   : await browser.newContext({...contextOptions,...(stateFile?{storageState:stateFile}:{})});
  await context.addInitScript(()=>{
    // Only age gate for a local, isolated smoke; do not override owner auth.
    try{if(!localStorage.getItem('gh_age_ok'))localStorage.setItem('gh_age_ok',String(Date.now()));}catch{}
  });
  const available=await context.request.get(BASE+'/healthz',{timeout:15000}).catch(()=>null);
  if(!available||available.status()!==200)throw Error('Host not healthy /healthz; no catalog pass can be issued');
  const build=await context.request.get(BASE+'/api/build',{timeout:15000}).catch(()=>null);
  if(!build||build.status()!==200)throw Error('Build fingerprint endpoint unavailable');
  const buildInfo=await build.json();const fingerprint=buildInfo.build_fingerprint||null;
  const me=await context.request.get(BASE+'/api/me',{timeout:15000}).then(r=>r.json()).catch(()=>null);
  const signedIn=!!me?.user;
  if(!signedIn&&process.env.QA_REQUIRE_LOGIN!=='0')
   throw Error('Not signed in: configure QA_STORAGE_STATE or QA_INTERACTIVE_AUTH=1; no private-review bypass');
  const monitor=async(g)=>{
   const page=await context.newPage();
   const failures=[],consoleErrors=[],badHttp=[],started=Date.now();let status=null,hasCanvas=false;
   let pacingSamples=[];
   const signedRunAuthorizations=[],pendingRunProofs=[];
   page.on('pageerror',error=>failures.push(String(error.message).slice(0,360)));
   page.on('console',msg=>{if(msg.type()==='error')consoleErrors.push(msg.text().slice(0,360));});
   page.on('response',res=>{try{
     const url=new URL(res.url()),request=res.request();
     if(url.origin===BASE&&url.pathname==='/api/run/start'&&request.method()==='POST') {
       const promise=(async()=>{
         let body=null,reply=null;
         try{body=request.postDataJSON();reply=await res.json();}catch{}
         // Never save bearer tokens or seeds to reports.
         signedRunAuthorizations.push({gameId:body?.game_id||null,
           authorized:res.status()>=200&&res.status()<300&&reply?.ok===true&&
             typeof reply.token==='string'&&reply.token.length>0&&reply.seed!=null});
       })();
       pendingRunProofs.push(promise);
     }
     if(url.origin===BASE&&res.status()>=400&&
       /\.(?:js|mjs|css|png|svg|jpg|jpeg|webp|glb|wasm)(?:\?|$)/i.test(url.pathname))
       badHttp.push({url:url.pathname,status:res.status()});
   }catch{}});
   // Deny every HTTP mutation except same-origin signed run start.
   // Routes must cover future score/admin/payment URLs and cross-origin writes.
   await page.route('**/*',route=>{
     const request=route.request();
     if(qaRequestAllowed(request.method(),request.url(),allowRunStart,BASE))
       return route.continue();
     return route.fulfill({status:403,contentType:'application/json',
       body:JSON.stringify({ok:false,error:'QA mutation blocked'})});
   });
   try{
    const response=await page.goto(BASE+g.route,{waitUntil:'domcontentloaded',timeout:25000});
    status=response?.status()||null;
    if(status===200){
     // Wait for the actual engine, not merely a static canvas.
     if(g.kind==='core')
       await page.waitForFunction(()=>window.__game?.running===true,null,{timeout:12000});
     else if(g.build==='built')
       await page.waitForFunction(()=>!!window.__GL?.g?.def,null,{timeout:12000});
     await page.waitForTimeout(250);
     hasCanvas=await page.locator('canvas').count()>0;
     // Runner's first canvas (#gl3d) is a noninteractive renderer; #gl handles touch.
     const touchCanvas=g.kind==='core'?page.locator("canvas#game"):
       g.build==='built'?page.locator("canvas#gl"):page.locator('canvas:visible').last();
     if(await touchCanvas.count()&&await touchCanvas.isVisible().catch(()=>false))
       await touchCanvas.tap({force:true,timeout:3000});
     // rAF intervals are an app-independent browser pacing proxy, NOT drawn-frame proof.
     // Measure after touch/game start, not while the page is merely loading.
     pacingSamples=await page.evaluate(durationMs=>new Promise(resolve=>{
       const intervals=[];let last=null,done=false;
       const finish=()=>{if(!done){done=true;resolve(intervals);}};
       const timeout=setTimeout(finish,durationMs+1500);
       const started=performance.now();
       const frame=t=>{
         if(done)return;
         if(last!==null&&intervals.length<2400)intervals.push(t-last);
         last=t;
         if(t-started>=durationMs){clearTimeout(timeout);finish();}
         else requestAnimationFrame(frame);
       };
       requestAnimationFrame(frame);
     }),RUNS*1000);
    }
   }catch(e){failures.push('Navigation/interaction: '+String(e.message).slice(0,350));}
   await Promise.all(pendingRunProofs);
   const pacing=summarizeFramePacing(pacingSamples);
   const signedRun=signedRunAuthorizations.find(x=>x.gameId===g.id&&x.authorized)||null;
   const metrics=await page.evaluate(()=>{
    const gl=window.__GL||null;
    const cv=document.querySelector('canvas'),bounds=cv?.getBoundingClientRect();
    const grid=document.querySelector('.grid-container');
    const core=window.__game||null;
    return {domPuzzleDetected:!!grid,kitState:gl?.state||null,
      hubGameId:window.Hub?.id||null,kitGameId:gl?.g?.def?.id||null,
      coreGameId:document.querySelector('canvas#game')?.dataset?.game||null,
      coreState:core?.state||null,
      frameP95Ms:typeof gl?.frameMsP95==='number'?gl.frameMsP95:
        typeof core?.frameMsP95==='number'?core.frameMsP95:null,
      fps:typeof gl?.fps==='number'?gl.fps:typeof core?.fps==='number'?core.fps:null,
      viewportWidth:innerWidth,
      viewportHeight:innerHeight,canvasSize:bounds?{width:Math.round(bounds.width),height:Math.round(bounds.height)}:null,
      horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3};
   }).catch(()=>null);
   const title=(await page.title().catch(()=>''))||'';
   const runtimeSurface=hasCanvas||metrics?.domPuzzleDetected===true;
   const runtimeProof=inspectGameRuntime(g,metrics,signedRun);
   const stuckInStartup=metrics?.kitState==='starting';
   const failed=status!==200||failures.length>0||consoleErrors.length>0||badHttp.length>0||
     !runtimeSurface||stuckInStartup||!runtimeProof.verified||
     metrics?.horizontalOverflow===true||
     (Number.isFinite(metrics?.frameP95Ms)&&metrics.frameP95Ms>33.4&&
       (metrics?.kitState==='play'||metrics?.coreState==='play'))||
     (STRICT_PACING && !pacing.passed);
   if(TAKE_ALL||failed)try{await page.screenshot({path:path.join(SCREENSHOTS,filename(g.id)+'.png'),timeout:4500});}catch{}
   await page.close();
   return {id:g.id,title:g.title,kind:g.kind,route:g.route,status,titleLoaded:!!title,canvasDetected:hasCanvas,
    ...metrics,runtimeSurfaceDetected:runtimeSurface,
    browserFrameP50Ms:pacing.p50Ms,browserFrameP95Ms:pacing.p95Ms,
    browserPacingSamples:pacing.samples,browserPacingStatus:pacing.status,
    browserLongFrames:pacing.longFrames,browserPacingPassed:pacing.passed,
    runtimeIdentityVerified:runtimeProof.verified,runtimeProofNote:runtimeProof.reason,
    signedRunObserved:!!signedRun,
    jsExceptions:failures,consoleErrors,badAssets:badHttp,
    durationMs:Date.now()-started,smokePassed:!failed,
    androidPhysical:'NOT_TESTED',iosSafariPhysical:'NOT_TESTED',
    scoreReplayCertified:false,visualAAAApproved:false};
  };
  for(let i=0;i<targets.length;i++){
   const row=await monitor(targets[i]);results.push(row);
   console.log((row.smokePassed?'PASS ':'FAIL ')+(i+1)+'/'+targets.length+' '+row.id+
     ' HTTP:'+row.status+' p95:'+row.frameP95Ms+'ms errors:'+row.jsExceptions.length+
     ' assetErrors:'+row.badAssets.length);
  }
  const failed=results.filter(r=>!r.smokePassed),report={schema:1,
   testedAtUTC:new Date().toISOString(),engine:ENGINE,emulationOnly:true,host:BASE,
   fingerprint,authenticatedReviewer:signedIn,serverSignedRunStartsAllowed:allowRunStart,
   submittedRealScores:false,processedPayments:false,
   expectedActiveTitles:batch.total,attempted:results.length,passed:results.length-failed.length,
   failed:failed.map(x=>x.id),batchStartIndex:batch.start,batchEndExclusive:batch.endExclusive,
   fullCoverage:batch.fullCoverage,requestedBatchPassed:failed.length===0,
   strictPacingRequired:STRICT_PACING,emulatedFramePacingNotHardwareCertification:true,
   pacingMeasuredGames:results.filter(x=>x.browserPacingStatus!=='INSUFFICIENT_SAMPLES').length,
   pacingFailedGames:results.filter(x=>!x.browserPacingPassed).map(x=>x.id),
   certifiedAAA:0,physicalAndroidApproved:0,physicalIphoneApproved:0,
   note:'Signed run-start/game-engine/browser-rAF pacing smoke; rAF timing is not engine drawn-frame timing. No score or commerce writes. Not full gameplay, physical phones, replay integrity or AAA certification.',
   games:results};
  const target=path.join(OUT,'87-game-browser-smoke.json');
  fs.writeFileSync(target,JSON.stringify(report,null,2)+'\n');
  console.log('REPORT '+target);
  // Requested batches are independently checked; optional full-coverage strict mode is explicit.
  if(failed.length||(process.env.QA_REQUIRE_FULL_COVERAGE==='1'&&!batch.fullCoverage))process.exitCode=1;
  await context.close();
 }finally{await browser.close();}
}
main().catch(error=>{console.error('QA aborted:',String(error.message));process.exitCode=2;});

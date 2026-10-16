#!/usr/bin/env node
'use strict';
// Read-only phone viewport checks. Uses an existing reviewer session and does
// not purchase, book, save equipment, submit scores, or approve device quality.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const pw=require('playwright');
const BASE=String(process.env.BASE||'http://127.0.0.1:8787').replace(/\/$/,'');
const OUT=path.resolve(process.env.QA_HUB_REPORT_DIR||path.join(os.tmpdir(),'hub-mobile-pages'));
const routes=['/','/games','/shop','/store','/avatar','/season','/quests','/achievements','/sponsor','/leaderboard'];
(async()=>{
 fs.mkdirSync(OUT,{recursive:true});
 const browser=await pw.chromium.launch({headless:true,...(process.env.CHROME_BIN?{executablePath:process.env.CHROME_BIN}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const rows=[];let fingerprint=null;
 try{
   const context=await browser.newContext({viewport:{width:360,height:860},isMobile:true,hasTouch:true,deviceScaleFactor:1,
    ...(process.env.QA_STORAGE_STATE?{storageState:process.env.QA_STORAGE_STATE}:{})});
   await context.addInitScript(()=>{try{localStorage.setItem('gh_age_ok',String(Date.now()))}catch{}});
   const me=await context.request.get(BASE+'/api/me').then(r=>r.json());
   if(!me?.user)throw Error('Authenticated reviewer required');
   fingerprint=(await context.request.get(BASE+'/api/build').then(r=>r.json())).build_fingerprint;
  for(const width of [360,430]){
   for(const route of routes){
    const page=await context.newPage(),errors=[],badAssets=[];
    await page.setViewportSize({width,height:860});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.url().startsWith(BASE)&&r.status()>=400&&/\.(?:svg|webp|jpg|png|js|css|glb)(?:\?|$)/.test(r.url()))badAssets.push({url:r.url().slice(BASE.length),status:r.status()})});
    const response=await page.goto(BASE+route,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(()=>document.querySelector('#app')?.textContent.trim().length>40,null,{timeout:15000});
    await page.waitForTimeout(1200);
    const layout=await page.evaluate(()=>({
     horizontalOverflow:document.documentElement.scrollWidth>innerWidth+2,
     loadedText:document.querySelector('#app')?.textContent.trim().length||0,
     brokenImages:[...document.images].filter(i=>i.complete&&i.currentSrc&&i.naturalWidth===0).map(i=>new URL(i.currentSrc).pathname)
    }));
    const row={width,route,status:response.status(),...layout,errors,badAssets};
    row.passed=row.status===200&&!row.horizontalOverflow&&!errors.length&&!badAssets.length&&!row.brokenImages.length;
    rows.push(row);console.log((row.passed?'PASS ':'FAIL ')+width+' '+route);
    if(!row.passed)console.log('DETAIL '+JSON.stringify(row));
    if(!row.passed||['/','/shop','/avatar'].includes(route))await page.screenshot({path:path.join(OUT,width+'-'+(route.slice(1)||'home')+'.png')});
    await page.close();
   }
  }
   await context.close();
 }finally{await browser.close()}
 const report={testedAtUTC:new Date().toISOString(),fingerprint,engine:'Chromium',emulated:true,
  attempted:rows.length,passed:rows.filter(r=>r.passed).length,physicalAndroid:false,physicalIphone:false,rows};
 fs.writeFileSync(path.join(OUT,'mobile-hub-pages.json'),JSON.stringify(report,null,2)+'\n');
 if(rows.some(r=>!r.passed))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=2});

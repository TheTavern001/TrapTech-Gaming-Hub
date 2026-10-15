#!/usr/bin/env node
'use strict';
// Remote, anonymous, non-mutating verification for HUB_PRIVATE_REVIEW=1.
// No owner credentials, sessions, scored runs, real checkout or personal data.
const BASE=String(process.env.BASE||'https://glassy-drifter-9532.de.deplexo.com').replace(/\/$/,'');
if(!/^https:\/\/[^/?#]+$/i.test(BASE)&&!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)){
 console.error('BASE must be an HTTPS origin or loopback HTTP');process.exit(2);
}
const results=[];
async function probe(path,method='GET') {
 const response=await fetch(BASE+path,{method,redirect:'manual',signal:AbortSignal.timeout(12000),
   headers:{'cache-control':'no-store',...(method==='POST'?{'content-type':'application/json'}:{})},
   ...(method==='POST'?{body:'{}'}:{})});
 const text=await response.text();
 let json=null;try{json=JSON.parse(text)}catch{}
 return {status:response.status,type:response.headers.get('content-type')||'',
  cache:response.headers.get('cache-control')||'',text,json};
}
async function test(label,path,method,verify){
 try{const r=await probe(path,method);
  const ok=!!verify(r);
  results.push({label,ok,status:r.status});
  console.log((ok?'PASS ':'FAIL ')+label+' ('+r.status+')');
 }catch(error){results.push({label,ok:false,error:String(error)});
  console.log('FAIL '+label+' — '+String(error));}
}
(async()=>{
 await test('Health works','/healthz','GET',r=>r.status===200&&r.json?.ok===true);
 await test('Build fingerprint readable','/api/build','GET',r=>r.status===200&&r.json?.ok===true&&!!r.json.build_fingerprint);
 await test('Sign-in page available','/signin','GET',r=>r.status===200&&r.type.includes('text/html'));
 await test('PWA manifest available','/manifest.webmanifest','GET',r=>r.status===200);
 await test('Browser JavaScript available','/js/app.js','GET',r=>r.status===200);
 await test('Guest account is anonymous','/api/me','GET',r=>r.status===200&&r.json?.ok===true&&!r.json?.user);
 for(const [url,method,label] of [
  ['/','GET','Homepage gated'],
  ['/games','GET','Games page gated'],
  ['/shop','GET','Shop page gated'],
  ['/games-lib/rail-rush/index.html','GET','Embedded game gated'],
  ['/api/games-lib','GET','Game list API gated'],
  ['/api/store','GET','Store API gated'],
  ['/api/shop/catalog','GET','Cosmetics API gated'],
  ['/api/score','POST','Score submission gated'],
  ['/api/auth/signup','POST','New account signup gated'],
  ['/api/store/checkout','POST','Checkout gated']
 ]){
  await test(label,url,method,r=>r.status===503&&r.cache.includes('no-store')&&
   (url.startsWith('/api/')?r.json?.private_review===true:r.text.includes('Private Review')));
 }
 const errors=results.filter(r=>!r.ok);
 console.log(JSON.stringify({mode:'private-preview-unauthenticated',base:BASE,
  checked:results.length,passed:results.length-errors.length,failed:errors.map(r=>r.label),
  signedInOwnerAndPhysicalDeviceQA:'NOT TESTED',stripeAndPrizes:'NOT TESTED'},null,2));
 if(errors.length)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});

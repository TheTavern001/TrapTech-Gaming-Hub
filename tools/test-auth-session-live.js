#!/usr/bin/env node
'use strict';
// MUTATES ONLY an isolated Docker build-smoke database. Never run against a
// live Deplexo site or production data. Exercises real HTTP authentication.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const BASE=String(process.env.BASE||'').replace(/\/$/,'');
if(process.env.BUILD_SMOKE!=='1'||!/^http:\/\/127\.0\.0\.1:\d+$/.test(BASE)){
  console.error('Refusing auth integration on nonlocal host or outside BUILD_SMOKE=1');
  process.exit(2);
}
async function main(){
const username='AuthQA'+crypto.randomBytes(5).toString('hex');
const oldPw='TestOnlySession-'+crypto.randomBytes(6).toString('hex');
const newPw='ChangedSession-'+crypto.randomBytes(6).toString('hex');
async function api(path,body,session,method='POST'){
 const r=await fetch(BASE+path,{
  method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),
    ...(session?{'X-Session':session}:{})},
  body:body!==undefined?JSON.stringify(body):undefined,
  signal:AbortSignal.timeout(10000)
 });
 return {status:r.status,body:await r.json()};
}
const signup=await api('/api/auth/signup',{username,password:oldPw,dob:'1990-01-01',agree:true});
assert.equal(signup.status,200,'Signup: '+JSON.stringify(signup.body));
const token0=signup.body.session;
assert.ok(token0&&token0.includes('.'),'Signup must return cookie-independent session for mobile clients');
const me0=await api('/api/me',undefined,token0,'GET');
assert.equal(me0.body.user?.username,username,'Valid mobile header must authenticate');
const tamper=await api('/api/me',undefined,token0+'x','GET');
assert.equal(tamper.body.user,null,'Tampered session must be rejected');
const out=await api('/api/auth/signout',{},token0);
assert.equal(out.status,200);assert.equal(out.body.all_devices_signed_out,true);
assert.equal((await api('/api/me',undefined,token0,'GET')).body.user,null,
 'Captured mobile header must be revoked on logout');
const signin=await api('/api/auth/signin',{username,password:oldPw});
assert.equal(signin.status,200);
const token1=signin.body.session;
assert.ok(token1&&token1!==token0,'New sign-in must advance server-side version');
assert.equal((await api('/api/me',undefined,token1,'GET')).body.user?.username,username);
const staleSignout=await api('/api/auth/signout',{},token0);
assert.equal(staleSignout.body.all_devices_signed_out,false,'Stale token cannot revoke new session');
assert.equal((await api('/api/me',undefined,token1,'GET')).body.user?.username,username,
 'Sign-out using stolen old token cannot kick out legitimate player');
const changed=await api('/api/auth/password',{current:oldPw,password:newPw},token1);
assert.equal(changed.status,200,'Password change: '+JSON.stringify(changed.body));
assert.equal((await api('/api/me',undefined,token1,'GET')).body.user,null,
 'Password change must revoke old mobile token');
assert.equal((await api('/api/auth/signin',{username,password:oldPw})).status,401,
 'Old password must no longer authenticate');
const signinNew=await api('/api/auth/signin',{username,password:newPw});
assert.equal(signinNew.status,200);
assert.equal((await api('/api/me',undefined,signinNew.body.session,'GET')).body.user?.username,username);
const whop=await api('/api/pay/whop/webhook',{action:'payment.succeeded',
 data:{metadata:{order_ref:'FAKE'}}});
assert.equal(whop.status,404,'Unsigned/unverified Whop should not accept fake grants');
console.log(JSON.stringify({pass:true,tests:17,scope:'real localhost HTTP, disposable Docker smoke DB',
 cookieIndependentMobileLogin:true,copiedTokenRevoked:true,passwordRotation:true,
 unsupportedWebhookRejected:true,productionAccountsTouched:false}));
}
main().catch(e=>{console.error('Auth session HTTP smoke failed:',e.message);process.exitCode=1});

#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const {makeGate}=require('../src/private-review');
function send(gate,route,{method='GET',user=null,admin=false,header=null}={}){
 const req={path:route,method,headers:{'x-preview-role':header||''},testUser:user,testAdmin:admin};
 const res={code:200,headers:{},data:null,setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.code=n;return this},json(x){this.data=x;return this},type(t){this.mime=t;return this},
 send(s){this.data=s;return this}};
 let nexts=0;
 gate(req,res,()=>{nexts++});
 return {next:nexts===1,code:res.code,data:res.data,headers:res.headers,mime:res.mime};
}
const build=(on,users='ReviewOwner')=>makeGate({enabled:on,users,
 reviewerExists:name=>name==='reviewowner',currentUser:r=>r.testUser,
 isOwnerAdmin:r=>r.testAdmin,adminBase:()=>'/randomized-secure-admin-path-12345'});
assert.throws(()=>makeGate({enabled:true,users:'',adminBase:()=>null}),/requires at least one valid HUB_PREVIEW_USERNAMES/,'Missing owner access must stop startup');
assert.throws(()=>makeGate({enabled:true,users:'',adminBase:()=>'/configured-admin-secret'}),/requires at least one valid HUB_PREVIEW_USERNAMES/,'Scoped admin cookies alone cannot enter main Hub after login');
assert.throws(()=>makeGate({enabled:true,users:'ValidButMissing',reviewerExists:()=>false}),
 /requires at least one existing active/,'Nonexistent reviewer must block startup');
assert.throws(()=>makeGate({enabled:true,users:'BannedPlayer',reviewerExists:()=>false}),
 /requires at least one existing active/,'Suspended reviewer must not satisfy the allowlist');
assert.doesNotThrow(()=>makeGate({enabled:true,users:'Missing,ReviewOwner',
 reviewerExists:name=>name==='reviewowner'}),'At least one active existing reviewer is sufficient');
const off=build(false);
assert.equal(send(off,'/api/score',{method:'POST'}).next,true,'Disabled mode must leave production unchanged');
const gate=build(true);
for(const route of ['/healthz','/api/build','/assets/brand/traptech-app-icon.svg','/css/app.css',
 '/js/app.js','/fonts/font.woff2','/manifest.webmanifest','/sw.js','/signin']){
 assert.equal(send(gate,route).next,true,'Login/asset/health GET must work: '+route);
}
for(const route of ['/api/auth/signin','/api/auth/signout']){
 assert.equal(send(gate,route,{method:'POST'}).next,true,'Signin/session bootstrap: '+route);
}
assert.equal(send(gate,'/api/me').next,true,'Read-only sign-in state must remain available');
assert.equal(send(gate,'/api/me',{method:'POST'}).next,false,'Do not expose future unauthenticated profile mutation routes');
assert.equal(send(gate,'/api/store/webhook/stripe',{method:'POST'}).next,true,'Signature-verified Stripe webhook handler must remain reachable for existing orders');
for(const route of ['/','/games','/sponsor','/store','/giveaways','/api/score','/api/auth/signup','/api/store/checkout','/api/sponsor/requests']){
 const denied=send(gate,route,{method:route.startsWith('/api/')?'POST':'GET'});
 assert.equal(denied.next,false,'Guests should not enter preview: '+route);
 assert.equal(denied.code,503,'Review must be a temporary 503 response');
 assert.equal(denied.headers['Cache-Control'],'no-store');
}
assert.equal(send(gate,'/games',{user:{username:'ReviewOwner'}}).next,true,'Named owner account is allowed');
assert.equal(send(gate,'/games',{user:{username:'reviewowner'}}).next,true,'Username matching case-insensitive');
assert.equal(send(gate,'/games',{user:{username:'otherPlayer'}}).next,false,'Other users denied');
assert.equal(send(gate,'/api/score',{user:{username:'otherPlayer'},method:'POST'}).next,false,'Existing users cannot earn during private preview');
assert.equal(send(gate,'/api/score',{header:'owner',method:'POST'}).next,false,'Client role header grants nothing');
assert.equal(send(gate,'/shop',{admin:true}).next,true,'Fully authenticated admin owner can review');
assert.equal(send(gate,'/randomized-secure-admin-path-12345/').next,true,'Admin sign-in path must remain reachable');
assert.equal(send(gate,'/randomized-secure-admin-path-12345/api').next,true,'Admin router enforces its own 2FA');
assert.equal(send(gate,'/randomized-secure-admin-path-12345-imitator').next,false,'Do not accept prefix collisions');
assert.equal(send(gate,'/api/score',{user:{username:'ReviewOwner'},method:'POST'}).next,true,'Approved reviewer may test server-scored practice games');
console.log(JSON.stringify({pass:true,productionDefaultUnchanged:true,ownerOnly:true,admin2FAIntegration:true,noClientRoleOverride:true,publicPaymentScoreWritesBlocked:true,reviewerGameScoresAllowed:true,scopeBootstrapMethods:true,adminCookieCannotReplacePlayerAccount:true,existingAccountValidation:true,realDeplexoEnvironmentTested:false}));

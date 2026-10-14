#!/usr/bin/env node
'use strict';
// Exact-source security contract, no app server/network, no live DB.
// Exercises the same currentUser/startSession and signout handler that the
// Express server executes. An in-memory fake DB records revocation effects.
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../src/server.js'),'utf8');
const dbSource=fs.readFileSync(path.join(__dirname,'../src/db.js'),'utf8');
const select=(regex,label)=>{
  const m=src.match(regex);
  assert.ok(m,'Missing '+label+' from actual server source');
  return m[0];
};
const userSource=select(/function currentUser\(req\) \{[\s\S]*?\n\}/,'currentUser');
const startSource=select(/function startSession\(req, res, user\) \{[\s\S]*?\n\}/,'startSession');
const logoutSource=select(/app\.post\('\/api\/auth\/signout',[\s\S]*?\n\}\);/,'signout handler');
assert.ok(dbSource.includes("addCol('users', 'session_version', 'INTEGER NOT NULL DEFAULT 0')"),
  'Persist revocation epoch without deleting player records');
assert.ok(src.includes("UPDATE users SET pass_hash=?, session_version=session_version+1 WHERE id=?"),
  'Password change and admin reset must revoke existing sessions');
const users=new Map([[1,{id:1,username:'FixturePlayer',created_at:1,banned:0,is_demo:0,
  session_version:0,pass_hash:'old'}]]);
let lastSeen=0,versionMutations=0;
const db={prepare(sql){
 if(sql.startsWith('SELECT id, username, created_at, banned, is_demo, session_version'))
  return {get:(id)=>users.has(id)?{...users.get(id)}:undefined};
 if(sql.startsWith('SELECT session_version,banned FROM users'))
  return {get:(id)=>users.has(id)?{...users.get(id)}:undefined};
 if(sql.startsWith('UPDATE users SET last_seen='))
  return {run:(at,id)=>{lastSeen=at;return{changes:users.has(id)?1:0}}};
 if(sql==='UPDATE users SET session_version=session_version+1 WHERE id=?')
  return {run:(id)=>{const u=users.get(id);if(u){u.session_version++;versionMutations++;}return{changes:u?1:0}}};
 if(sql==='UPDATE users SET pass_hash=?, session_version=session_version+1 WHERE id=?')
  return {run:(hash,id)=>{const u=users.get(id);if(u){u.pass_hash=hash;u.session_version++;versionMutations++;}return{changes:u?1:0}}};
 throw new Error('Unexpected SQL during session test: '+sql);
}};
const cfg={SESSION_SECRET:'isolated-test-session-secret',SESSION_TTL_MS:7*864e5};
let nowMs=1_000_000;
const now=()=>nowMs;
function sign(secret,payload){
 const part=Buffer.from(JSON.stringify(payload)).toString('base64url');
 return part+'.'+crypto.createHmac('sha256',secret).update(part).digest('base64url');
}
function verify(secret,raw){
 try{
  const [part,mac,extra]=String(raw||'').split('.');
  if(extra||!part||!mac)return null;
  const good=crypto.createHmac('sha256',secret).update(part).digest('base64url');
  if(mac.length!==good.length||!crypto.timingSafeEqual(Buffer.from(mac),Buffer.from(good)))return null;
  return JSON.parse(Buffer.from(part,'base64url').toString());
 }catch{return null}
}
const parseCookies=req=>({gh_sess:req.cookieToken||''});
const setCookie=(req,res,name,value,ttl)=>{res.cookies??={};res.cookies[name]={value,ttl}};
const fn=new Function('db','cfg','now','sign','verify','parseCookies','setCookie',
 userSource+'\n'+startSource+'\nreturn {currentUser,startSession}');
const auth=fn(db,cfg,now,sign,verify,parseCookies,setCookie);
const res=()=>({cookies:{},json(v){this.output=v;return this}});
function sess(){
 const response=res(),token=auth.startSession({},response,users.get(1));
 assert.equal(response.cookies.gh_sess.value,token);
 return token;
}
const v0=sess();
assert.equal(auth.currentUser({cookieToken:v0}).id,1);
assert.equal(auth.currentUser({headers:{'x-session':v0}}).id,1,'Mobile header works when cookies unavailable');
assert.equal(auth.currentUser({headers:{'x-session':v0+'X'}}),null,'Tampered token rejected');
assert.equal(auth.currentUser({headers:{'x-session':sign(cfg.SESSION_SECRET,{u:1,e:now()+1e6})}}),null,
 'Legacy unversioned session must be rejected after hardening');
assert.equal(auth.currentUser({headers:{'x-session':sign(cfg.SESSION_SECRET,{u:1,v:99,e:now()+1e6})}}),null,
 'Signed-but-revoked epoch must be rejected');
const app={routes:{},post(path,handler){this.routes[path]=handler}};
new Function('app','currentUser','db','setCookie',logoutSource)(app,auth.currentUser,db,setCookie);
const out=res();app.routes['/api/auth/signout']({headers:{'x-session':v0}},out);
assert.equal(out.output.ok,true);
assert.equal(out.output.all_devices_signed_out,true);
assert.equal(out.cookies.gh_sess.ttl,0);
assert.equal(users.get(1).session_version,1);
assert.equal(auth.currentUser({headers:{'x-session':v0}}),null,'Signout revokes copied mobile header');
assert.equal(auth.currentUser({cookieToken:v0}),null,'Signout revokes old browser cookie');
const v1=sess();assert.equal(auth.currentUser({headers:{'x-session':v1}}).id,1);
app.routes['/api/auth/signout']({headers:{'x-session':v0}},res());
assert.equal(users.get(1).session_version,1,'Old stolen token cannot revoke a newer legitimate session');
assert.equal(auth.currentUser({headers:{'x-session':v1}}).id,1);
db.prepare('UPDATE users SET pass_hash=?, session_version=session_version+1 WHERE id=?').run('new',1);
assert.equal(auth.currentUser({headers:{'x-session':v1}}),null,'Password change revokes copied tokens');
const v2=sess();
db.prepare('UPDATE users SET pass_hash=?, session_version=session_version+1 WHERE id=?').run('admin reset',1);
assert.equal(auth.currentUser({headers:{'x-session':v2}}),null,'Admin reset revokes copied tokens');
const v3=sess();
nowMs+=cfg.SESSION_TTL_MS+1;
assert.equal(auth.currentUser({headers:{'x-session':v3}}),null,'Server expiry still enforced');
nowMs=1_000_000;const v4=sess();
users.get(1).banned=1;
assert.equal(auth.currentUser({headers:{'x-session':v4}}),null,'Banned users rejected');
assert.equal(lastSeen,nowMs);
assert.equal(versionMutations,3);
console.log(JSON.stringify({pass:true,scope:'actual server session and signout code + in-memory DB',
 scenarios:14,source: 'Node isolated auth contract, not full HTTP/mobile pentest',
 serverSideRevocation:true,oldSessionsForceRelogin:true}));

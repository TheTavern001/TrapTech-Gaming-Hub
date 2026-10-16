#!/usr/bin/env node
'use strict';
// Isolated native HTTP gate checks; no deployed accounts or payments.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),{spawn}=require('node:child_process'),net=require('node:net');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-private-http-'));
const password=crypto.randomBytes(20).toString('hex');
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,DB_PATH:path.join(dir,'hub.db'),SECRET:crypto.randomBytes(32).toString('hex'),ADMIN_PASSWORD:crypto.randomBytes(20).toString('hex'),PAY_NO_SWEEP:'1',NODE_USE_ENV_PROXY:'0'});
const db=require('../src/db'),bcrypt=require('bcryptjs');
for(const name of ['allowedreviewer','otherreviewer'])db.prepare('INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES (?,?,?,?)').run(name,bcrypt.hashSync(password,4),Date.now(),'1990-01-01');
db.close();
const pause=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const server=spawn(process.execPath,['src/server.js'],{cwd:root,env:{...process.env,PORT:String(port),HUB_PRIVATE_REVIEW:'1',HUB_PREVIEW_USERNAMES:'allowedreviewer'},stdio:['ignore','pipe','pipe']});let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
 const base='http://127.0.0.1:'+port;
 async function req(route,method='GET',body,session){return fetch(base+route,{method,headers:{...(body?{'content-type':'application/json'}:{}),...(session?{'X-Session':session}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)})}
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await req('/healthz')).ok){ready=true;break}}catch{}await pause(50)}assert.ok(ready,'Private server startup failed: '+log.slice(-500));
  for(const route of ['/','/games','/index.html','/store','/api/shop','/games-lib/block-drop/index.html'])assert.equal((await req(route)).status,503,'Guest denied '+route);
  assert.equal((await req('/signin')).status,200);
  assert.equal((await req('/api/auth/signup','POST',{username:'uninvited',password,dob:'1990-01-01',agree:true})).status,503);
  const login=await req('/api/auth/signin','POST',{username:'allowedreviewer',password}),yes=await login.json();assert.equal(login.status,200);assert.ok(yes.session);
  assert.equal((await req('/games','GET',undefined,yes.session)).status,200);
  const checkout=await req('/api/store/orders','POST',{product_id:'crowns-500',provider:'stripe'},yes.session);assert.equal(checkout.status,503);
  const other=await req('/api/auth/signin','POST',{username:'otherreviewer',password}),no=await other.json();assert.ok(no.session);assert.equal((await req('/games','GET',undefined,no.session)).status,503);
  assert.equal((await fetch(base+'/games',{headers:{'X-Preview-User':'allowedreviewer'}})).status,503);
  assert.equal((await req('/api/store/webhook/stripe','POST',{})).status,400,'Webhook reachable but invalid signature denied');
  console.log(JSON.stringify({pass:true,nativeSQLiteAndHTTP:true,guestDenied:true,reviewerAllowed:true,otherAccountDenied:true,spoofDenied:true,checkoutClosed:true,unsignedWebhookDenied:true,productionUntouched:true}));
 }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

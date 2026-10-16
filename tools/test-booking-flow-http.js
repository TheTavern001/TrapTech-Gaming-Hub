#!/usr/bin/env node
'use strict';
// Disposable native server: quote/payment/quality gates, never production bookings.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),net=require('node:net'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-booking-http-'));
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,DB_PATH:path.join(dir,'hub.db'),SECRET:crypto.randomBytes(32).toString('hex'),ADMIN_PASSWORD:crypto.randomBytes(24).toString('hex'),ADMIN_PATH:'fixture-admin-'+crypto.randomBytes(12).toString('hex'),PAY_NO_SWEEP:'1',NODE_USE_ENV_PROXY:'0'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const port=await new Promise(resolve=>{const s=net.createServer().listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const server=spawn(process.execPath,['src/server.js'],{cwd:root,env:{...process.env,PORT:String(port)},stdio:['ignore','pipe','pipe']});let log='';server.stdout.on('data',x=>log+=x);server.stderr.on('data',x=>log+=x);
 const base='http://127.0.0.1:'+port;
 async function api(url,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(5000)});return {status:r.status,body:await r.json()};}
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await api('/healthz')).status===200){ready=true;break}}catch{}await sleep(50)}assert.ok(ready,log.slice(-600));
  const ADM=require('./admin-auth').adminClient(base);assert.equal((await ADM.login()).body.ok,true);
  const catalog=await api('/api/sponsor/catalog');assert.equal(catalog.body.ok,true);
  const body={brand:'Isolated Booking QA',email:'fixture@example.com',business_type:catalog.body.business_types.find(x=>x!==catalog.body.cannabis),features:[{id:'weeks',qty:2}],games:['stack'],competition:'best',prize:'Fixture prize',length_days:7};
  assert.equal((await api('/api/sponsor/requests',{...body,games:['unknown']})).status,400);
  assert.equal((await api('/api/sponsor/requests',{...body,competition:'random'})).status,400);
  assert.equal((await api('/api/sponsor/requests',{...body,linked_requirements:[{kind:'goal',target:1000,url:'https://example.com/channel'}]})).status,400);
  const created=await api('/api/sponsor/requests',body);assert.equal(created.body.ok,true);assert.ok(created.body.token);const {id,token}=created.body;
  const status='/api/sponsor/requests/'+token;
  let result=await api(status);assert.equal(result.body.request.status,'pending');assert.equal(result.body.request.quote,null);
  assert.equal((await ADM('/api/admin/sponsor/requests/'+id+'/create-event',{body:{}})).status,409);
  assert.equal((await api(status+'/accept',{})).status,409);
  result=await ADM('/api/admin/sponsor/requests/'+id+'/status',{body:{status:'sent'}});assert.equal(result.body.ok,true);
  result=await api(status);assert.equal(result.body.request.quote.status,'sent');assert.ok(result.body.request.quote.total_cents>0);
  assert.equal((await api(status+'/accept',{})).body.ok,true);
  assert.equal((await ADM('/api/admin/sponsor/requests/'+id+'/create-event',{body:{}})).status,409,'Accepted but unpaid never creates an event');
  assert.equal((await ADM('/api/admin/sponsor/requests/'+id+'/status',{body:{status:'paid'}})).body.ok,true);
  const prepared=await ADM('/api/admin/sponsor/requests/'+id+'/create-event',{body:{}});assert.equal(prepared.body.ok,true);assert.equal(prepared.body.prepared,true);assert.equal(prepared.body.active,false);assert.equal(prepared.body.share_ready,false);assert.equal(prepared.body.code,undefined);
  const replay=await ADM('/api/admin/sponsor/requests/'+id+'/create-event',{body:{}});assert.equal(replay.body.existing,true);assert.equal(replay.body.id,prepared.body.id);
  const share=await ADM('/api/admin/events/'+prepared.body.id+'/share');assert.ok(share.status>=400,'Uncertified draft must never get a share kit');
  result=await api(status);assert.ok(!result.body.request.event?.code&&!result.body.request.event?.qr_svg);
  assert.equal((await api('/api/event/TT-INVALID')).status,404);
  console.log(JSON.stringify({pass:true,nativeSQLiteAndHTTP:true,adminPasswordTotpCsrf:true,quoteSentAcceptedPaid:true,unpaidEventDenied:true,paidUncertifiedDraftOnly:true,shareKitBlocked:true,idempotentPreparation:true,subscriberGoalsRejected:true,externalPaymentVerified:false}));
 }finally{server.kill();await new Promise(resolve=>server.once('exit',resolve));fs.rmSync(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

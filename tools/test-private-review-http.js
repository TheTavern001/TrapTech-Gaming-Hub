#!/usr/bin/env node
'use strict';
// Boots the actual server against a disposable DB. No production host access.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),cp=require('node:child_process'),net=require('node:net');
const root=path.resolve(__dirname,'..'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'hub-private-http-'));
Object.assign(process.env,{NODE_ENV:'test',DATA_DIR:dir,DB_PATH:path.join(dir,'hub.db'),
 SECRET:crypto.randomBytes(40).toString('hex'),ADMIN_PASSWORD:crypto.randomBytes(24).toString('hex'),
 ADMIN_PATH:'test-admin-'+crypto.randomBytes(16).toString('hex'),PAY_NO_SWEEP:'1'});
const db=require('../src/db'),bcrypt=require('bcryptjs');
const password=crypto.randomBytes(24).toString('hex');
const insert=db.prepare("INSERT INTO users(username,pass_hash,created_at,birth_date) VALUES (?,?,?,'1990-01-01')");
for(const name of ['ownerpreview','otherpreview'])insert.run(name,bcrypt.hashSync(password,4),Date.now());
require('../src/monetize').setSetting('checkout_enabled',true);
db.close();
let server;const errors=[];let checks=0;
const check=(ok,label)=>{assert.ok(ok,label);checks++};
async function freePort(){return new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})})}
(async()=>{
 const port=await freePort(),base='http://127.0.0.1:'+port;
 server=cp.spawn(process.execPath,['--max-old-space-size=64','src/server.js'],{cwd:root,
  env:{...process.env,PORT:String(port),HUB_PRIVATE_REVIEW:'1',HUB_PREVIEW_USERNAMES:'ownerpreview',
    BUILD_DIR:path.join(dir,'unused-build'),STRIPE_SECRET_KEY:'',BTC_ADDRESS:''},stdio:['ignore','ignore','pipe']});
 server.stderr.on('data',data=>errors.push(data.toString()));
 const get=(url,token,opts={})=>fetch(base+url,{...opts,headers:{...(token?{'X-Session':token}:{}),...opts.headers},signal:AbortSignal.timeout(5000)});
 for(let i=0;i<150;i++){try{if((await get('/healthz')).status===200)break}catch{}
  if(server.exitCode!==null)throw Error('Server exited: '+errors.join(''));await new Promise(r=>setTimeout(r,100));}
 check((await get('/healthz')).status===200,'Production server starts in private review');
 for(const route of ['/','/index.html','/games','/store','/api/games','/api/score'])
  check((await get(route)).status===503,'Guest denied '+route);
 check((await get('/games',null,{headers:{'X-Preview-User':'ownerpreview'}})).status===503,'Claimed reviewer header is not authentication');
 check((await get('/api/auth/signup',null,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===503,'Public signup is disabled');
 check((await get('/signin')).status===200,'Login page remains accessible');
 check((await get('/js/app.js')).status===200,'Login assets remain accessible');
 check((await get('/api/store/webhook/stripe',null,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===400,'Existing webhook reaches signature check');
 const signin=async username=>{
  const r=await get('/api/auth/signin',null,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password})});
  assert.equal(r.status,200);return (await r.json()).session;
 };
 const owner=await signin('ownerpreview'),other=await signin('otherpreview');
 check(!!owner&&!!other,'Only existing accounts can sign in');
 check((await get('/games',other)).status===503,'Authenticated unapproved account is denied');
 const page=await get('/games',owner);
 check(page.status===200&&/no-store/.test(page.headers.get('cache-control')),'Owner can review uncached Hub pages');
 check((await get('/api/games',owner)).status===200,'Owner can load catalog');
 const store=await get('/api/store',owner).then(r=>r.json());
 check(store.checkout.enabled===false&&store.checkout.methods.length===0,'Prior admin checkout switch cannot enable payment in review');
 check((await get('/api/store/orders',owner,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({product_id:'crowns-500'})})).status===503,'Reviewer cannot place real money order');
 check((await get('/api/score',other,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status===503,'Nonreviewer cannot submit scores');
 check((await get('/api/score',owner,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status!==503,'Reviewer reaches normal score validation without bypass');
 await get('/api/auth/signout',owner,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
 check((await get('/games',owner)).status===503,'Signout revokes copied reviewer token');
 console.log(JSON.stringify({pass:true,checks,actualServer:true,nativeSQLite:true,localhostHTTP:true,
  guestDenied:true,reviewerAuthenticated:true,checkoutLocked:true,productionSettingsChanged:false}));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{
 if(server&&server.exitCode===null){server.kill('SIGTERM');await new Promise(r=>{server.once('exit',r);setTimeout(()=>{server.kill('SIGKILL');r()},3000).unref()})}
 fs.rmSync(dir,{recursive:true,force:true});
});

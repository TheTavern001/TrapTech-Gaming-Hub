'use strict';
// External giveaway promotion links + subscriber-goal milestones.
// Never count an external follow, join, visit or subscriber total from client
// self-attestation. Required external tasks are verified by admins only.
const TYPES=new Set(['follow','join','visit','goal']);
const PLATFORMS=new Set(['potato','telegram','youtube','tiktok','instagram','discord','website','other']);
function safeLink(raw) {
  try {
    const u=new URL(String(raw||'').trim());
    if(u.protocol!=='https:'||u.username||u.password||!u.hostname.includes('.')||u.href.length>400) return null;
    if(/^(localhost|127\.\d|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))return null;
    return u.href;
  } catch {return null;}
}
function normalize(input) {
  if(input==null)return [];
  if(!Array.isArray(input)||input.length>5)throw Error('Select up to five linked giveaway requirements.');
  return input.map((v,i)=>{
    if(!v||typeof v!=='object'||!TYPES.has(v.kind))throw Error('Unknown linked giveaway requirement.');
    const label=String(v.label||'').trim().slice(0,90),url=safeLink(v.url);
    if(!label||!url)throw Error('Each linked requirement needs a title and a valid public https:// URL.');
    const kind=v.kind,platform=PLATFORMS.has(v.platform)?v.platform:'other';
    const target=kind==='goal'?Number(v.target):0;
    if(kind==='goal'&&(!Number.isSafeInteger(target)||target<1||target>100000000))throw Error('Subscriber goals must be between 1 and 100,000,000.');
    return {id:'link-'+(i+1),kind,label,url,platform,
      required:kind!=='goal'&&v.required===true,
      target,baseline:0,current:0,updated_at:0,
      verification:'manual_admin'};
  });
}
function parse(value) {
  try {
    const arr=typeof value==='string'?JSON.parse(value||'[]'):value;
    return Array.isArray(arr)?arr.filter(r=>r&&TYPES.has(r.kind)&&/^link-[1-5]$/.test(r.id)&&safeLink(r.url)).slice(0,5):[];
  }catch{return [];}
}
function publicView(value){
  return parse(value).map(({id,kind,label,url,platform,required,target,current,updated_at})=>({
    id,kind,label,url,platform,required:!!required,
    goal:kind==='goal'?{target,current:Math.max(0,Number(current)||0),updated_at:updated_at||null,source:'admin-reported (not platform-verified)'}:null,
    verification:required?'manual_admin_required':'informational_only'
  }));
}
function ensureSchema(db){
  function col(table,col,def){
    const found=db.prepare('PRAGMA table_info('+table+')').all().some(x=>x.name===col);
    if(!found)db.exec('ALTER TABLE '+table+' ADD COLUMN '+col+' '+def);
  }
  col('bookings','linked_requirements',"TEXT NOT NULL DEFAULT '[]'");
  col('giveaways','linked_requirements',"TEXT NOT NULL DEFAULT '[]'");
  db.exec(`CREATE TABLE IF NOT EXISTS linked_requirement_claims (
    giveaway_id INTEGER NOT NULL, user_id INTEGER NOT NULL, requirement_id TEXT NOT NULL,
    account_handle TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
    submitted_at INTEGER NOT NULL, reviewed_at INTEGER, reviewed_by TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (giveaway_id,user_id,requirement_id)
  );
  CREATE INDEX IF NOT EXISTS idx_linked_requirement_review ON linked_requirement_claims(giveaway_id,status);`);
}
function checksFor(user,g,db){
  const required=parse(g.linked_requirements).filter(x=>x.required);
  return required.map(r=>{
    let verified=false;
    try {
      const row=db.prepare("SELECT 1 FROM linked_requirement_claims WHERE giveaway_id=? AND user_id=? AND requirement_id=? AND status='verified'").get(g.id,user.id,r.id);
      verified=!!row;
    }catch{verified=false;} // Fail closed on schema/storage failures.
    return {id:'external:'+r.id,label:r.label,required:true,verified,ok:verified,url:r.url,
      hint:verified?'Verified by Trap Tech':'Open the linked channel, submit your membership claim, and wait for Trap Tech verification before entry.'};
  });
}
function routes(app,A,H,db){
  const EV=require('./events');
  app.post('/api/event/:code/linked/:rid/claim',H.requireUser,H.limiter('external-claim',8,3600e3),(req,res)=>{
    const g=EV.find(req.params.code);
    if(!g||!['active','scheduled'].includes(EV.status(g))||/^\d+$/.test(req.params.code))return H.bad(res,404,'Official giveaway not available.');
    const task=parse(g.linked_requirements).find(x=>x.id===req.params.rid&&x.required);
    if(!task)return H.bad(res,400,'No verified linked requirement exists for that ID.');
    const handle=String((req.body||{}).account_handle||'').trim();
    if(handle.length<2||handle.length>80||/[<>\x00-\x1f]/.test(handle))return H.bad(res,400,'Enter your account/channel handle (2–80 characters) for manual verification.');
    const t=Date.now();
    const existing=db.prepare('SELECT status FROM linked_requirement_claims WHERE giveaway_id=? AND user_id=? AND requirement_id=?').get(g.id,req.user.id,task.id);
    if(existing?.status==='verified')return res.json({ok:true,status:'verified',already:true});
    db.prepare(`INSERT INTO linked_requirement_claims(giveaway_id,user_id,requirement_id,account_handle,status,submitted_at)
      VALUES(?,?,?,?,'pending',?) ON CONFLICT(giveaway_id,user_id,requirement_id)
      DO UPDATE SET account_handle=excluded.account_handle,status='pending',submitted_at=excluded.submitted_at,reviewed_at=NULL,reviewed_by=''`)
      .run(g.id,req.user.id,task.id,handle,t);
    res.json({ok:true,status:'pending',message:'Verification requested. This does not yet qualify you for the giveaway.'});
  });
  A.get('/events/:id/linked-requirements',(req,res)=>{
    const g=EV.find(req.params.id);if(!g)return H.bad(res,404,'Unknown event.');
    const claims=db.prepare('SELECT c.*,u.username FROM linked_requirement_claims c JOIN users u ON u.id=c.user_id WHERE c.giveaway_id=? ORDER BY c.submitted_at DESC LIMIT 500').all(g.id);
    res.json({ok:true,requirements:publicView(g.linked_requirements),claims});
  });
  A.post('/events/:id/linked-requirements/:rid/review',(req,res)=>{
    const g=EV.find(req.params.id);if(!g)return H.bad(res,404,'Unknown event.');
    const task=parse(g.linked_requirements).find(x=>x.id===req.params.rid&&x.required);
    if(!task)return H.bad(res,400,'No required action matches.');
    const uid=Number(req.body?.user_id),decision=req.body?.decision;
    if(!Number.isSafeInteger(uid)||uid<1||!['verified','rejected'].includes(decision))return H.bad(res,400,'Supply user_id and verified/rejected decision.');
    const row=db.prepare('SELECT 1 FROM linked_requirement_claims WHERE giveaway_id=? AND user_id=? AND requirement_id=?').get(g.id,uid,task.id);
    if(!row)return H.bad(res,404,'User has not requested verification.');
    const reviewer=String(req.admin?.username||'admin').slice(0,80),t=Date.now();
    db.prepare('UPDATE linked_requirement_claims SET status=?,reviewed_at=?,reviewed_by=? WHERE giveaway_id=? AND user_id=? AND requirement_id=?').run(decision,t,reviewer,g.id,uid,task.id);
    if(H.logActivity)H.logActivity('giveaway',`Linked requirement ${task.id} ${decision} for user ${uid} in event ${g.id}`,null,g.id);
    res.json({ok:true,status:decision});
  });
  A.put('/events/:id/linked-goal/:rid',(req,res)=>{
    const g=EV.find(req.params.id);if(!g)return H.bad(res,404,'Unknown event.');
    const list=parse(g.linked_requirements),item=list.find(x=>x.id===req.params.rid&&x.kind==='goal');
    if(!item)return H.bad(res,404,'Unknown subscriber goal.');
    const current=Number(req.body?.current);
    if(!Number.isSafeInteger(current)||current<0||current>100000000)return H.bad(res,400,'Invalid subscriber count.');
    item.current=current;item.updated_at=Date.now();
    db.prepare('UPDATE giveaways SET linked_requirements=?,updated_at=? WHERE id=?').run(JSON.stringify(list),Date.now(),g.id);
    if(H.logActivity)H.logActivity('giveaway',`Subscriber goal for event ${g.id} updated to ${current} by ${req.admin?.username||'admin'}`,null,g.id);
    res.json({ok:true,requirements:publicView(list)});
  });
}
module.exports={normalize,parse,publicView,safeLink,ensureSchema,checksFor,routes};

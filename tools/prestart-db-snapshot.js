#!/usr/bin/env node
'use strict';
// Fail-closed pre-migration SQLite snapshot for the existing single-app Deplexo volume.
// This process runs BEFORE src/server.js imports src/db.js and runs schema migrations.
// Never use fs.copyFile on a live WAL database: better-sqlite3.backup() captures a
// transactionally consistent snapshot, including committed changes in the WAL.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const Database=require('better-sqlite3');

const root=path.resolve(__dirname,'..');
const DB=process.env.DB_PATH || path.join(process.env.DATA_DIR||path.join(root,'data'),'hub.db');
const PREVIOUS_FILES=[
  'src/db.js','src/server.js','src/admin-giveaways.js','src/admin-v7.js',
  'src/sponsor.js','src/events.js','src/eligibility.js',
  'src/giveaway-linked.js','src/avatars.js','src/shop.js',
  'src/results.js','src/admin-scoring.js','src/config.js'
];
function releaseKey(base=root){
  const h=crypto.createHash('sha256');
  for(const name of PREVIOUS_FILES){
    const full=path.join(base,name);
    h.update(name).update('\0');
    h.update(fs.existsSync(full)?fs.readFileSync(full):Buffer.from('MISSING'));
  }
  return h.digest('hex').slice(0,20);
}
function checkDb(file){
  const d=new Database(file,{readonly:true,fileMustExist:true});
  try {
    d.pragma('busy_timeout = 10000');
    const outcome=d.pragma('quick_check',{simple:true});
    if(outcome!=='ok')throw Error('SQLite integrity check rejected '+path.basename(file));
    return d;
  }catch(err){d.close();throw err}
}
function spaceForSnapshot(dbPath,destDir){
  if(typeof fs.statfsSync!=='function')return;
  const {bavail,bsize}=fs.statfsSync(destDir);
  const available=Number(bavail)*Number(bsize);
  const stat=fs.statSync(dbPath);
  const wal=dbPath+'-wal';
  const walSize=fs.existsSync(wal)?fs.statSync(wal).size:0;
  const needed=Math.max(16*1048576,Math.ceil((stat.size+walSize)*1.25));
  if(available<needed)throw Error('Insufficient free persistent disk for a safe pre-release snapshot; deployment stopped.');
}
async function snapshot({dbPath=DB,dir=path.join(path.dirname(dbPath),'pre-release-backups'),key=releaseKey()}={}){
  if(!/^[a-f0-9]{12,64}$/.test(key))throw Error('Invalid release fingerprint');
  if(!fs.existsSync(dbPath))return {ok:true,status:'fresh-install-no-existing-db'};
  if(fs.statSync(dbPath).size===0)throw Error('Existing SQLite file is empty; refusing to assume a new install.');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  fs.chmodSync(dir,0o700); // Persistent snapshots contain user/account data.
  const target=path.join(dir,'hub-preupgrade-'+key+'.db');
  const marker=path.join(dir,'hub-preupgrade-'+key+'.json');
  if(fs.existsSync(marker)){
    const previous=JSON.parse(fs.readFileSync(marker,'utf8'));
    if(previous.key!==key||!fs.existsSync(target)||fs.statSync(target).size===0)
      throw Error('The recorded pre-release snapshot is missing or mismatched. Deployment stopped.');
    const checked=checkDb(target);checked.close();
    fs.chmodSync(target,0o600);
    return {ok:true,status:'snapshot-already-present',file:target};
  }
  // If interrupted after rename but before the marker write, retain the
  // original snapshot rather than overwrite it with a possibly migrated DB.
  if(fs.existsSync(target)){
    const verified=checkDb(target);verified.close();
    fs.chmodSync(target,0o600);
  }else{
    spaceForSnapshot(dbPath,dir);
    const tmp=target+'.tmp-'+process.pid;
    const source=checkDb(dbPath);
    try{
      await source.backup(tmp);
      const verified=checkDb(tmp);verified.close();
      fs.chmodSync(tmp,0o600);
      fs.renameSync(tmp,target);
    }finally{
      source.close();
      if(fs.existsSync(tmp))fs.rmSync(tmp,{force:true});
    }
  }
  const data={key,file:path.basename(target),created_at:new Date().toISOString(),reason:'snapshot-before-server-schema-migrations'};
  const tempMarker=marker+'.tmp-'+process.pid;
  try{
    fs.writeFileSync(tempMarker,JSON.stringify(data,null,2)+'\n',{mode:0o600});
    fs.renameSync(tempMarker,marker);
  }finally{if(fs.existsSync(tempMarker))fs.rmSync(tempMarker,{force:true})}
  // Retain the two latest pre-upgrade snapshots. Normal daily compressed
  // backups are managed separately by src/backup.js.
  const older=fs.readdirSync(dir).filter(f=>/^hub-preupgrade-[a-f0-9]{12,64}\.json$/.test(f))
    .map(f=>({name:f,mtime:fs.statSync(path.join(dir,f)).mtimeMs}))
    .sort((a,b)=>b.mtime-a.mtime).slice(2);
  for(const item of older){
    const file=path.join(dir,item.name);
    const dbFile=file.slice(0,-5)+'.db';
    try{fs.rmSync(file,{force:true});fs.rmSync(dbFile,{force:true})}
    catch(err){console.error('[pre-release-backup] could not remove old snapshot:',err.message)}
  }
  return {ok:true,status:'snapshot-created',file:target};
}
if(require.main===module){
  snapshot().then(info=>console.log('[pre-release-backup]',JSON.stringify(info)))
    .catch(err=>{console.error('[pre-release-backup] FATAL:',err.message);process.exitCode=1});
}
module.exports={snapshot,releaseKey,checkDb};

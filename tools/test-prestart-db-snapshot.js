#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const Database=require('better-sqlite3');
const {snapshot,releaseKey}=require('./prestart-db-snapshot');
(async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'tt-pre-release-'));
  const dbPath=path.join(root,'hub.db'),dir=path.join(root,'backups');
  const keyA='aaaaaaaaaaaa11111111',keyB='bbbbbbbbbbbb22222222';
  try{
    const fresh=await snapshot({dbPath,dir,key:keyA});
    assert.equal(fresh.status,'fresh-install-no-existing-db');
    const db=new Database(dbPath);
    db.exec('CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT); INSERT INTO accounts(id,name) VALUES(1,\'owner\')');
    db.close();
    const original=await snapshot({dbPath,dir,key:keyA});
    assert.equal(original.status,'snapshot-created');
    assert.equal(fs.statSync(dir).mode & 0o777,0o700,'Private backup directory is owner-only');
    assert.equal(fs.statSync(original.file).mode & 0o777,0o600,'Backup file must not expose account data');
    assert.equal(fs.statSync(path.join(dir,'hub-preupgrade-'+keyA+'.json')).mode & 0o777,0o600,'Snapshot marker is private');
    const saved=new Database(original.file,{readonly:true,fileMustExist:true});
    assert.equal(saved.prepare('SELECT name FROM accounts WHERE id=1').get().name,'owner');
    saved.close();
    const live=new Database(dbPath);
    live.exec("INSERT INTO accounts(id,name) VALUES(2,'after-release')");
    live.close();
    const repeat=await snapshot({dbPath,dir,key:keyA});
    assert.equal(repeat.status,'snapshot-already-present','Never overwrite the pre-migration snapshot after startup.');
    const previous=new Database(repeat.file,{readonly:true});
    assert.equal(previous.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,1);
    previous.close();
    const second=await snapshot({dbPath,dir,key:keyB});
    const newDb=new Database(second.file,{readonly:true});
    assert.equal(newDb.prepare('SELECT COUNT(*) AS n FROM accounts').get().n,2);
    newDb.close();
    // Do not trust a marker if the previously saved snapshot was corrupted.
    fs.writeFileSync(second.file,'corrupt snapshot bytes');
    await assert.rejects(snapshot({dbPath,dir,key:keyB}),
      'An existing marker must not bypass integrity validation');
    const damagedPath=path.join(root,'corrupted.db');
    fs.writeFileSync(damagedPath,'not a valid sqlite database');
    await assert.rejects(snapshot({dbPath:damagedPath,dir,key:'cccccccccccc33333333'}));
    assert.match(releaseKey(),/^[a-f0-9]{20}$/);
    console.log(JSON.stringify({pass:true,newInstallSkips:true,originalOwnerPreserved:true,existingReleaseBackupNeverOverwritten:true,subsequentReleaseBackedUp:true,corruptDbFailsClosed:true,corruptPreviousBackupRejected:true,privatePermissions:true,realDeplexoVolumeNotTested:true}));
  }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});

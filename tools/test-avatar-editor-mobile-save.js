#!/usr/bin/env node
'use strict';
// Execute the actual avatar editor's async save handlers without Three.js.
// Verifies mobile double-tap protection and offline failure recovery.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let source=fs.readFileSync(path.join(__dirname,'../public/js/avatar-editor.js'),'utf8');
source=source.replace(/^import .*;\s*$/gm,'').replace('export function install(ctx)','function install(ctx)');
assert.ok(!source.includes('export function install(ctx)'),'Avatar editor source transform failed');
const button={disabled:false,isConnected:true,onclick:null};
const toasts=[],renders=[],errors=[];
let putCount=0,mode='offline',releaseSave=null;
const avatar={gender:'other',bg:'night',skin:'s2',face:'oval',hair:'waves',
 hairc:'c1',eyes:'wide',mouth:'smile',beard:'none',build:'average',
 outfit:'base',hat:'none',acc:'none',held:'none',emote:'none'};
const data={ok:true,avatar:{...avatar},starter:{...avatar},credits:100,parts:[],kinds:[]};
let route;
const C={
 S:{me:{username:'TestUser'}},
 route:(re,handler)=>{if(re.test('/avatar'))route=handler;},
 api:async(url,options)=>{
  if(url==='/api/avatar'&&!options)return data;
  if(url==='/api/avatar'&&options?.method==='PUT'){
   putCount++;
   if(mode==='offline')throw Error('synthetic connection loss');
   if(mode==='held')return new Promise(resolve=>{releaseSave=resolve;});
   return {ok:true,avatar:{...options.body.avatar}};
  }
  throw Error('Unexpected API call '+url);
 },
 shell:(route,html)=>renders.push({route,html}),
 pageHead:(a,b)=>a,emptyState:()=>'',toast:s=>toasts.push(s),
 icon:()=>'',esc:s=>String(s),fmt:n=>String(n),bumpAvatar:()=>{C.bumped=(C.bumped||0)+1;},
 go:()=>{throw Error('Should remain in avatar editor');}
};
const dom={
 getElementById:id=>id==='av-save'?button:null,
 querySelectorAll:()=>[]
};
const fixture=vm.runInNewContext(source+'\ninstall;',{
 document:dom,window:{},confirm:()=>true,
 mountAvatar3D:async()=>()=>{},
 supportsRiggedAvatar:()=>false,URLSearchParams,
 console,Number,String,Object,JSON,Promise,
},{timeout:2000});
fixture(C);
assert.equal(typeof route,'function','Avatar SPA route must be registered');
(async()=>{
 await route();
 assert.equal(typeof button.onclick,'function','Save action must be interactive');
 await button.onclick();
 assert.ok(toasts.some(s=>/connection/i.test(s)),'Offline save must show actionable message');
 assert.equal(button.disabled,false,'Failed save must restore button interaction');
 mode='held';
 const first=button.onclick(),second=button.onclick();
 assert.equal(button.disabled,true,'First tap must lock Save immediately');
 await second;
 assert.equal(putCount,2,'Second tap must not issue another credit/wardrobe request');
 releaseSave({ok:true,avatar:{...avatar}});
 await first;
 assert.equal(button.disabled,false,'Successful save must release button lock');
 assert.equal(C.bumped,1,'Successful save must refresh public avatar once');
 assert.ok(renders.some(x=>x.html.includes('Saved. Your avatar now updates')),'Successful save shows confirmation');
 console.log(JSON.stringify({pass:true,actualAvatarSaveHandler:true,
 offlineFeedback:true,doubleTapDeduplicated:true,
 successUpdatesProfile:true,liveWebGLNotTested:true}));
})().catch(e=>{errors.push(e);console.error(e);process.exitCode=1;});

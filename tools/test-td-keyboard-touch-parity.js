#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const td=fs.readFileSync(path.join(__dirname,'../public/games-lib/td.js'),'utf8');
const browser={},Kit={run:d=>{Kit.def=d}};
vm.runInNewContext(td,{window:browser,Kit},{timeout:2000});
browser.TD({id:'td-parity',title:'Defense',path:[[0,1],[12,1]],
 towers:[{n:'Turret',cost:50,range:2,rate:1,dmg:1,c:'#f1f5f9'}],
 enemy:()=>({hp:20,sp:10,v:10,c:'#fff'}),perWave:()=>1});
let keys=new Set(),g={W:800,H:450,kd:k=>keys.has(k),ptr:{pressed:false,x:0,y:0},
 sfx:()=>{},float:()=>{},burst:()=>{},shake:()=>{},flash:()=>{},add:()=>{},mark:()=>{},RI:()=>1,frames:1};
Kit.def.init(g);
g.wt=500;g.queue=1;g.qt=100;
assert.equal(g.cursor.c,2);assert.equal(g.cursor.r,4);
keys=new Set(['ArrowRight']);Kit.def.update(g,.016);
assert.equal(g.cursor.c,3,'Keyboard navigates a physical tile without placing automatically');
assert.equal(g.tw.length,0);
keys=new Set([' ']);Kit.def.update(g,.016);
assert.equal(g.tw.length,1);
assert.equal(g.tw[0].c,3,'Keyboard builds exactly at selected tile');
assert.equal(g.tw[0].r,4);
g.cursor={c:5,r:1};Kit.def.update(g,.016);
assert.equal(g.tw.length,1,'Keyboard cannot auto-pick a better tile when chosen tile is on the road');
keys=new Set();g.ptr={pressed:true,x:6*40+20,y:50+8*40+20};
Kit.def.update(g,.016);
assert.equal(g.tw.length,2,'Touch placement still works');
assert.equal(g.tw[1].c,6);assert.equal(g.tw[1].r,8);
console.log(JSON.stringify({pass:true,keyboardsManuallyPlace:true,autoPlacementRemoved:true,touchPlacementPreserved:true,realTouchDeviceQA:false}));

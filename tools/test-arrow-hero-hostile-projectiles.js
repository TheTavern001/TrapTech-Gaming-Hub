#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
let game;
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/arrow-hero/game.js'),'utf8');
vm.runInNewContext(source,{Kit:{run:g=>game=g},console},{timeout:2000});
function simulate(y,dt=.2,inv=0){
 const g={W:400,H:720,t:0,score:0,ptr:{pressed:false},R:(a,b)=>(a+b)/2,RI:(a,b)=>a,pick:a=>a[0],ax:()=>0,ay:()=>0,kd:()=>false,mark:()=>{},add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},shake:()=>{},end:()=>{},stick:{on:false,x:0,y:0}};
 game.init(g);g.p.x=200;g.p.y=400;g.p.inv=inv;g.obs=[];g.en=[{t:'mage',x:100,y:150,r:14,hp:5,max:5,cd:100,ph:0,vx:0,vy:0}];
 g.eb=[{x:120,y,vx:600,vy:0,r:6,c:'#fff'}];g.ar=[];g.cd=100;
 const hp=g.hp;game.update(g,dt);return {damage:hp-g.hp,remaining:g.eb.length};
}
assert.deepEqual(simulate(400),{damage:7.5,remaining:0},'Hostile bolt crossing player hits on a slow frame');
assert.deepEqual(simulate(425),{damage:0,remaining:1},'Near miss cannot damage player');
assert.deepEqual(simulate(400,.2,1),{damage:0,remaining:1},'Invincibility still blocks damage');
assert.deepEqual(simulate(400,.05),{damage:0,remaining:1},'Short flight should not make early contact');
console.log(JSON.stringify({pass:true,cases:4,realGameplayCallback:true,physicalPhoneQA:false}));

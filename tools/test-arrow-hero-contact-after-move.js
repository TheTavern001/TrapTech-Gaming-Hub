#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../public/games-lib/arrow-hero/game.js'),'utf8');
let game;vm.runInNewContext(source,{Kit:{run:cfg=>game=cfg},console},{timeout:2000});
function contact(y){
 const g={W:400,H:720,t:0,ptr:{pressed:false},R:(a,b)=>(a+b)/2,RI:(a,b)=>a,pick:v=>v[0],ax:()=>0,ay:()=>0,kd:()=>false,mark:()=>{},add:()=>{},sfx:()=>{},burst:()=>{},float:()=>{},shake:()=>{},end:()=>{},stick:{on:false,x:0,y:0}};
 game.init(g);g.obs=[];g.p.x=200;g.p.y=400;g.p.inv=0;g.cd=10;g.ar=[];g.en=[{t:'slime',x:200,y,r:14,hp:100,max:100,cd:1,ph:0,vx:0,vy:0}];g.eb=[];
 const before=g.hp;game.update(g,.1);return {damage:before-g.hp,finalY:g.en[0].y};
}
const near=contact(428),far=contact(460);
assert.equal(near.damage,9,'Enemy stepping within hit radius must damage in same tick');
assert.ok(near.finalY<428);
assert.equal(far.damage,0,'No contact damage before enemy reaches player');
console.log(JSON.stringify({pass:true,contactAfterEnemyMove:true,near,far,physicalPhoneQA:false}));

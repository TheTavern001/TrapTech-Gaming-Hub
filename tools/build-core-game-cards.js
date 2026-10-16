#!/usr/bin/env node
'use strict';
// Self-contained vector cards using the game's shipped original sprite atlas.
// No external downloads, invented asset packs, or image-generation dependency.
const fs=require('node:fs'),path=require('node:path');
const pub=path.resolve(__dirname,'../public'),out=path.join(pub,'assets/cards/v7');
const games=[
 ['void-swarm','VOID SWARM','SURVIVE THE SWARM','ships','player','#6d28d9'],
 ['stack','GLASS STACK','ONE PERFECT DROP',null,null,'#0284c7'],
 ['grow-guard','GROW GUARD','DEFEND YOUR GARDEN','grow','plant','#15803d'],
 ['sling-smash','SLING SMASH','AIM. RELEASE. DEMOLISH.','sling','bot','#c2410c'],
 ['haze-defense','HAZE DEFENSE','BUILD YOUR DEFENSE','haze','turret','#7c3aed']
];
function card(row,tall){
 const [id,title,tag,atlas,preferred,color]=row,W=tall?480:720,H=tall?700:420;
 let artwork='';
 if(atlas){
  const frames=JSON.parse(fs.readFileSync(path.join(pub,'assets/v7',atlas+'.json'),'utf8')).frames;
  const frame=frames[preferred]||frames[Object.keys(frames)[0]],uri='data:image/webp;base64,'+fs.readFileSync(path.join(pub,'assets/v7',atlas+'.webp')).toString('base64');
  const [x,y,w,h]=frame,size=tall?270:240;
  // These shipped atlases use the original 1024px packing canvas, including
  // transparent right padding. Frame extents alone would distort cropping.
  const iw=1024,ih=Math.max(...Object.values(frames).map(f=>f[1]+f[3]));
  artwork=`<svg x="${W/2-size/2}" y="${tall?115:24}" width="${size}" height="${size}" viewBox="${x} ${y} ${w} ${h}" overflow="hidden"><image href="${uri}" width="${iw}" height="${ih}"/></svg>`;
 }else{
  artwork=Array.from({length:6},(_,i)=>{const x=W/2-100+i*4,y=(tall?330:235)-i*29;return `<path d="M${x} ${y}l95 -38 105 38 -100 38z" fill="${i%2?'#38bdf8':'#a5f3fc'}" fill-opacity=".85" stroke="#e0f2fe" stroke-width="2"/><path d="M${x} ${y}v16l100 38v-16m0 16 100-38v-16" fill="#0369a1" stroke="#7dd3fc"/>`}).join('');
 }
 const titleY=tall?H-160:H-96;
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${title}">
 <defs><radialGradient id="glow"><stop stop-color="${color}"/><stop offset="1" stop-color="#060b1d"/></radialGradient></defs>
 <rect width="${W}" height="${H}" rx="24" fill="#060b1d"/><rect width="${W}" height="${H}" rx="24" fill="url(#glow)"/>
 <path d="M24 ${H-30}H${W-24}M24 30H${W-24}" stroke="#fff" stroke-opacity=".15"/>
 <circle cx="${W/2}" cy="${tall?245:148}" r="${tall?160:134}" fill="#050918" fill-opacity=".35" stroke="#fff" stroke-opacity=".14"/>
 ${artwork}<rect y="${titleY-34}" width="${W}" height="${H-titleY+34}" fill="#050918" fill-opacity=".82"/>
 <text x="${W/2}" y="${titleY}" fill="#fff" font-family="sans-serif" font-size="${tall?34:40}" font-weight="900" text-anchor="middle" letter-spacing="2">${title}</text>
 <text x="${W/2}" y="${titleY+35}" fill="#a5f3fc" font-family="sans-serif" font-size="${tall?14:16}" font-weight="700" text-anchor="middle" letter-spacing="3">${tag}</text>
 <text x="${W/2}" y="${H-18}" fill="#94a3b8" font-family="sans-serif" font-size="10" text-anchor="middle" letter-spacing="2">TRAP TECH SOLUTIONS</text></svg>\n`;
}
fs.mkdirSync(out,{recursive:true});
for(const row of games)for(const tall of [false,true])fs.writeFileSync(path.join(out,row[0]+(tall?'-tall':'')+'.svg'),card(row,tall));
console.log(JSON.stringify({pass:true,gameCards:games.length,files:games.length*2,source:'existing original game art',externalAssets:false}));

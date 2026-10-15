#!/usr/bin/env node
'use strict';
// Rebuild every install icon from the SAME vector mark used by the header.
// The repository's older PNGs contained an unrelated purple controller.
// This runs on Docker image build, after npm ci, before static precompression.
const fs=require('node:fs');
const path=require('node:path');
const {Resvg}=require('@resvg/resvg-js');
const root=path.resolve(__dirname,'../public');
const mono=fs.readFileSync(path.join(root,'assets/brand/tt-mono.svg'),'utf8');
const match=mono.match(/^<svg\b[^>]*>([\s\S]*?)<\/svg>\s*$/);
if(!match||!match[1].includes('<polygon')||!match[1].includes('ttg'))
  throw new Error('Trap Tech original vector mark is absent or changed; refusing unrelated icon art');
const originalMark=match[1];
function svg(maskable=false){
  // A full navy canvas avoids white triangles around Chrome's link-preview icon.
  // Maskable graphics fit wholly within Android adaptive-icon safe bounds.
  const width=maskable?264:322,height=maskable?301:367;
  const x=(512-width)/2,y=(512-height)/2+9;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Trap Tech Solutions crown and TT icon">
  <title>Gaming Hub — Trap Tech Solutions</title>
  <defs>
    <radialGradient id="navyGlow" cx="50%" cy="18%" r="90%">
      <stop stop-color="#101d47"/><stop offset=".62" stop-color="#050c2a"/><stop offset="1" stop-color="#030718"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="#030718"/>
  <rect width="512" height="512" fill="url(#navyGlow)"/>
  <svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 100 114">${originalMark}</svg>
</svg>\n`;
}
const expected=[
  ['assets/brand/traptech-app-icon.svg',svg(false),false],
  ['assets/brand/favicon.svg',svg(false),false],
  ['assets/icons/icon-192.png',svg(false),192],
  ['assets/icons/icon-512.png',svg(false),512],
  ['assets/icons/maskable-512.png',svg(true),512],
  ['assets/icons/apple-touch-icon.png',svg(false),180],
  ['assets/brand/favicon.png',svg(false),192]
];
function generated(){
  return expected.map(([rel,source,size])=>{
    const bytes=size?new Resvg(source,{fitTo:{mode:'width',value:size}}).render().asPng():Buffer.from(source);
    return {rel,bytes,size};
  });
}
function build(){
  const out=generated();
  for(const {rel,bytes} of out) {
    const file=path.join(root,rel);
    fs.mkdirSync(path.dirname(file),{recursive:true});
    if(!fs.existsSync(file)||!fs.readFileSync(file).equals(bytes))fs.writeFileSync(file,bytes);
  }
  return out.map(({rel,size,bytes})=>({path:rel,px:size||null,bytes:bytes.length}));
}
if(require.main===module)console.log(JSON.stringify({brand:'Trap Tech TT crown',files:build()}));
module.exports={svg,generated,build};

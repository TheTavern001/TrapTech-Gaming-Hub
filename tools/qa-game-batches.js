#!/usr/bin/env node
'use strict';
// Select every registered active game by default; explicit safe 100-game batches for future 500.
function planGameBatch(games,{start=0,limit=null,minimumActive=87}={}){
 if(!Array.isArray(games)||games.length<minimumActive)
   throw new Error('Catalog smaller than approved minimum baseline: '+minimumActive);
 const seen=new Set(),routes=new Set();
 for(const g of games){
   if(!g||typeof g.id!=='string'||!g.id||typeof g.route!=='string'||!g.route.startsWith('/'))
     throw new Error('Invalid game ID or route in QA selection');
   if(seen.has(g.id))throw new Error('Duplicate QA game ID: '+g.id);
   if(routes.has(g.route))throw new Error('Duplicate QA route: '+g.route);
   seen.add(g.id); routes.add(g.route);
 }
 const positiveInt=(v,label,allowZero)=>{
   if(!/^(?:0|[1-9][0-9]*)$/.test(String(v)))throw new Error(label+' must be an integer');
   const n=Number(v);
   if(!Number.isSafeInteger(n)||(!allowZero&&n===0))throw new Error(label+' is out of range');
   return n;
 };
 const first=positiveInt(start,'QA_START_INDEX',true);
 const take=limit===null?games.length:positiveInt(limit,'QA_MAX_GAMES',false);
 if(first>=games.length)throw new Error('QA_START_INDEX is past final registered game');
 const targets=games.slice(first,first+take),endExclusive=first+targets.length;
 return {total:games.length,start:first,endExclusive,targets,
  fullCoverage:first===0&&targets.length===games.length};
}
module.exports={planGameBatch};

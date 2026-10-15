'use strict';
function loopbackOrigin(origin){return ['localhost','127.0.0.1','[::1]','::1'].includes(new URL(origin).hostname.toLowerCase());}
function qaRequestAllowed(method,p,allowStart){
 const m=String(method).toUpperCase();
 return !p.startsWith('/api/')||['GET','HEAD','OPTIONS'].includes(m)||
  (!!allowStart&&m==='POST'&&p==='/api/run/start');
}
function inspectGameRuntime(game,metrics){
 if(game.kind!=='library')return {verified:false,reason:'Core SPA: surface-only'};
 if(!metrics)return {verified:false,reason:'No engine evidence'};
 if(metrics.hubGameId!==game.id)return {verified:false,reason:'Game ID mismatch'};
 if(game.build==='built'&&metrics.kitGameId!==game.id)return {verified:false,reason:'Kit engine mismatch'};
 if(!metrics.runAuthorized)return {verified:false,reason:'No signed run authorization'};
 if(!['play','over'].includes(metrics.kitState))return {verified:false,reason:'Game not started'};
 return {verified:true,reason:'Signed game entered play'};
}
module.exports={loopbackOrigin,qaRequestAllowed,inspectGameRuntime};

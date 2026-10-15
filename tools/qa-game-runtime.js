'use strict';
// Pure QA helpers: permit only signed run starts on the exact target origin.
function loopbackOrigin(origin) {
 const host=new URL(origin).hostname.toLowerCase();
 return ['localhost','127.0.0.1','[::1]','::1'].includes(host);
}
function qaRequestAllowed(method,requestUrl,allowStart,baseOrigin) {
 const m=String(method).toUpperCase();
 if(['GET','HEAD','OPTIONS'].includes(m))return true;
 const url=new URL(requestUrl),base=new URL(baseOrigin);
 return !!allowStart&&url.origin===base.origin&&m==='POST'&&url.pathname==='/api/run/start';
}
function inspectGameRuntime(game,metrics,signedRun) {
 if(!metrics)return {verified:false,reason:'No engine metrics'};
 if(!signedRun?.authorized||signedRun.gameId!==game.id)
  return {verified:false,reason:'No successful signed HTTP run for this game'};
 if(game.kind==='core') {
  if(metrics.coreGameId!==game.id)return {verified:false,reason:'Wrong core identity'};
  if(!['play','over'].includes(metrics.coreState))return {verified:false,reason:'Core engine never played'};
  return {verified:true,reason:'Core engine ran after signed start'};
 }
 if(game.kind==='library') {
  if(metrics.hubGameId!==game.id)return {verified:false,reason:'Wrong library identity'};
  if(game.build==='built'&&metrics.kitGameId!==game.id)return {verified:false,reason:'Wrong Kit identity'};
  if(!['play','over'].includes(metrics.kitState))return {verified:false,reason:'Library engine never played'};
  return {verified:true,reason:'Library engine ran after signed start'};
 }
 return {verified:false,reason:'Unknown game type'};
}
module.exports={loopbackOrigin,qaRequestAllowed,inspectGameRuntime};

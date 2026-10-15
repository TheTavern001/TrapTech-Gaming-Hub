'use strict';
// Browser rAF pacing is a non-certifying proxy for UI stalls. It does NOT
// prove the game engine drew every frame or establish real-device AAA quality.
function summarizeFramePacing(raw,opts={}) {
 const minimumSamples=Number.isInteger(opts.minimumSamples)&&opts.minimumSamples>0?opts.minimumSamples:45;
 const baselineP95Ms=Number.isFinite(opts.baselineP95Ms)&&opts.baselineP95Ms>0?opts.baselineP95Ms:33.4;
 const targetP95Ms=Number.isFinite(opts.targetP95Ms)&&opts.targetP95Ms>0?opts.targetP95Ms:20;
 const samples=Array.isArray(raw)?raw.filter(n=>Number.isFinite(n)&&n>0&&n<10000):[];
 if(samples.length<minimumSamples) return {status:'INSUFFICIENT_SAMPLES',passed:false,measured:false,
   samples:samples.length,p50Ms:null,p95Ms:null,longFrames:null,proxy:'browser-requestAnimationFrame'};
 const sorted=samples.slice().sort((a,b)=>a-b);
 const percentile=p=>Math.round(sorted[Math.ceil(sorted.length*p)-1]*100)/100;
 const p50Ms=percentile(0.5),p95Ms=percentile(0.95);
 const status=p95Ms<=targetP95Ms?'TARGET_PACING':p95Ms<=baselineP95Ms?'BASELINE_PACING':'SLOW_PACING';
 return {status,passed:p95Ms<=baselineP95Ms,measured:true,samples:samples.length,
   p50Ms,p95Ms,longFrames:samples.filter(n=>n>=50).length,
   proxy:'browser-requestAnimationFrame'};
}
module.exports={summarizeFramePacing};

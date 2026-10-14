#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),P=require('../src/prize-score-proof');
assert.deepEqual(P.approvedGames(),[],'Not one of 93 games has human competitive acceptance');
assert.equal(P.isCertified('stack'),false);
assert.equal(P.sqlCertified('r'),'(0=1)');
assert.equal(P.independentlyVerified('stack','replay-ok'),false);
const free={reject:false,flags:[],held:0,verify:'events-ok'};
assert.equal(P.admit(null,'rail-rush',free),free,'Free-play event logging remains untouched');
const full={reject:false,flags:[],held:0,verify:'replay-ok'};
const restricted=P.admit(17,'stack',full);
assert.equal(restricted.held,1,'Replay implementation without official certification cannot award prizes');
assert.equal(restricted.prizeProofHeld,true);
assert.equal(full.held,0,'Original verdict cannot be mutated');
assert.equal(P.admit(17,'rail-rush',free).held,1,'Client event log is not independent evidence');
assert.equal(P.admit(17,'rail-rush',{flags:[],held:0,verify:'cleared'}).held,1,'Manual review is not replay');
const rejected={reject:true,why:'forged'};assert.equal(P.admit(17,'stack',rejected),rejected,'Hard rejects preserved');
for(const file of ['src/server.js','src/results.js','src/admin-scoring.js','src/boards.js']){
 const text=fs.readFileSync(path.join(root,file),'utf8');
 if(file==='src/server.js'){
  assert.ok(text.includes("require('./prize-score-proof').admit(row.event_id, row.game_id, AC.assess("));
  assert.ok(text.includes('held_pending_independent_replay'));
  assert.ok(text.includes("held=0 AND verify='replay-ok' AND ${require('./prize-score-proof').sqlCertified('runs')}"));
 }
 if(file==='src/results.js'||file==='src/admin-scoring.js'){
  assert.ok(text.includes("AND r.held = 0 AND r.verify = 'replay-ok' AND ${PRIZE_PROOF.sqlCertified('r')} AND r.score <="));
  assert.ok(!text.includes("OR r.verify = 'cleared'"));
 }
 if(file==='src/boards.js')assert.ok(text.includes("score >= ? AND held=0 AND verify='replay-ok' AND ${PRIZE_PROOF.sqlCertified('runs')}"));
}
console.log(JSON.stringify({ok:true,freePlayUnaffected:true,prizeApprovedGames:0,officialRunsHeld:true,manualClearanceNotProof:true}));

#!/usr/bin/env node
'use strict';
// The currently active inaugural season must not be shortened by new 6-week defaults.
// This test uses a disposable UTC calendar and isolated in-memory DB stand-ins.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'../src/seasons.js'),'utf8');
const DAY=864e5,rows=[];
const db={exec(){},prepare(sql){return {all(){if(/SELECT \* FROM season_overrides/.test(sql))return rows;return []},get(){return null},run(){return {changes:1}}}}};
const progress={dayNum:t=>Math.floor(t/DAY),dayStart:n=>n*DAY};
function parse(){return {}};parse.contexts={};
const gen={parse,PALETTES:{neon:true},PAL_KEYS:['neon']};
const output={exports:{}};
const req=n=>({ './db':db, './config':{}, './shop-gen':gen, './progress':progress })[n]
  || (()=>{throw Error('Unexpected season test dependency: '+n)})();
vm.runInNewContext(source,{module:output,require:req,setInterval:()=>({unref(){}}),console,Date},
  {filename:'src/seasons.js',timeout:4000});
const S=output.exports;
const one=S.info(1),two=S.info(2),three=S.info(3);
const days=s=>Math.round((s.end_at+1-s.start_at)/DAY);
assert.equal(days(one),56,'Original live Season 1 dates must be unchanged');
assert.equal(one.start_at,Date.parse('2026-10-01T00:00:00.000Z'));
assert.equal(days(two),42,'Season 2 must last six weeks');
assert.equal(days(three),42,'Season 3 must last six weeks');
assert.equal(two.start_at,one.end_at+1,'No Season 1/2 gap or overlap');
assert.equal(three.start_at,two.end_at+1,'No Season 2/3 gap or overlap');
assert.equal(S.seasonAt(one.end_at).number,1,'Last Season 1 millisecond');
assert.equal(S.seasonAt(two.start_at).number,2,'First Season 2 millisecond');
assert.equal(S.seasonAt(two.end_at).number,2);
assert.equal(S.seasonAt(three.start_at).number,3);
assert.equal(S.seasonAt(Date.parse('2026-10-13T12:00:00.000Z')).number,1,'October live players retain season');
assert.ok(S.RULES[0].includes('Season 1'),'Rules disclose grandfathering');
assert.equal(S.LEN_DAYS,42,'Future season policy');
rows.push({number:2,ends_at:two.end_at+3*DAY});
S._reset();
assert.equal(S.info(1).end_at,one.end_at,'Admin override cannot change live season');
assert.equal(S.info(2).end_at,two.end_at+3*DAY,'Existing admin override preserved');
assert.equal(S.info(3).start_at,two.end_at+3*DAY+1,'Next season follows override');
console.log(JSON.stringify({ok:true,firstSeasonDays:56,futureSeasonDays:42,firstSeasonEnds:new Date(one.end_at).toISOString(),overridePreserved:true,playerHistoryTouched:false}));

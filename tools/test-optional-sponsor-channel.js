#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/giveaway-linked.js'),'utf8');
const mod={exports:{}};
vm.runInNewContext(source,{module:mod,URL},{timeout:2000});
const link=mod.exports;
const valid={kind:'visit',label:'Visit the brand channel',url:'https://example.com/club',platform:'potato',required:false};
const normalized=link.normalize([valid]);
assert.equal(normalized.length,1);
assert.equal(normalized[0].kind,'visit');
assert.equal(normalized[0].required,false);
assert.equal(link.publicView(JSON.stringify(normalized))[0].verification,'not_required');
assert.equal(link.publicView(JSON.stringify(normalized))[0].notice.includes('not required'),true);
for(const val of [
 [{kind:'goal',label:'Hit 10K',url:'https://example.com',target:10000}],
 [{...valid,required:true}],
 [{...valid,target:500}],
 [{...valid,url:'http://example.com'}],
 [{...valid,url:'https://localhost/private'}],
 [valid,valid]
])assert.throws(()=>link.normalize(val),'Must reject subscriber goals, mandatory follows and unsafe links');
assert.equal(link.parse(JSON.stringify([{kind:'goal',url:'https://example.com',target:500}] )).length,0);
assert.equal(typeof link.routes,'undefined','No external verification API exists');
assert.equal(typeof link.checksFor,'undefined','External channel cannot gate eligibility');
const app=fs.readFileSync(path.join(root,'public/js/app.js'),'utf8');
const events=fs.readFileSync(path.join(root,'src/events.js'),'utf8');
const eligibility=fs.readFileSync(path.join(root,'src/eligibility.js'),'utf8');
const booking=fs.readFileSync(path.join(root,'public/js/v7.js'),'utf8');
const sponsor=fs.readFileSync(path.join(root,'src/sponsor.js'),'utf8');
const server=fs.readFileSync(path.join(root,'src/server.js'),'utf8');
new vm.Script(app.replace(/^import .*$/gm,''));
new vm.Script(booking.replace(/^import .*$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b)/g,''));
assert.match(sponsor,/linked\.normalize\(b\.linked_requirements\)/);
assert.match(sponsor,/UPDATE giveaways SET linked_requirements=/);
assert.match(events,/linked\.publicView\(g\.linked_requirements\)/);
assert.doesNotMatch(events,/linked\.checksFor|linked\.routes/);
assert.doesNotMatch(eligibility,/giveaway-linked/);
assert.match(app,/Following is not required for giveaway entry or prizes/);
assert.match(app,/Following is not required to enter or win/,'Normal giveaway page must feature optional brand channel');
assert.match(server,/linked_requirements: require\('\.\/giveaway-linked'\)\.publicView\(g\.linked_requirements\)/);
assert.match(server,/all\.filter\(g => !g\.booking_id \|\| \['active','scheduled'\]\.includes\(EV\.status\(g\)\)\)/);
assert.match(server,/g\.booking_id && !\['active','scheduled'\]\.includes\(EV\.status\(g\)\)/);
assert.match(booking,/Optional brand\/channel link/);
assert.doesNotMatch(booking,/data-link-kind=|data-link-field="target"|Require verified completion before giveaway entry/);
console.log(JSON.stringify({pass:true,optionalChannelOnly:true,goalTrackingRemoved:true,unverifiedFollowsNotRequired:true,realBrowserTested:false}));

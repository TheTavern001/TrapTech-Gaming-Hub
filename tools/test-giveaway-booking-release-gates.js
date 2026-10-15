#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../src');
const events=fs.readFileSync(path.join(root,'events.js'),'utf8');
const sponsor=fs.readFileSync(path.join(root,'sponsor.js'),'utf8');
new vm.Script(events);new vm.Script(sponsor);
const a=events.indexOf('function status(g, t = Date.now()) {');
const z=events.indexOf('\nconst label =',a);
assert.ok(a>=0&&z>a);
let payment='accepted',certified=false;
const database={prepare:()=>({get:()=>({status:payment})})};
const status=vm.runInNewContext(events.slice(a,z)+'\nstatus;',{
 db:database,gamesOf:()=>['stack'],require:x=>{assert.equal(x,'./prize-score-proof');return {isCertified:()=>certified};},Date
},{timeout:2000});
const g={id:7,active:1,archived:0,booking_id:99,payment_status:'paid',start_at:1000,end_at:5000,state:'active'};
assert.equal(status(g,2000),'payment-pending','Accepted but unpaid quote cannot activate event');
payment='paid';g.payment_status='unpaid';
assert.equal(status(g,2000),'payment-pending','Payment metadata alone cannot activate event');
g.payment_status='paid';
assert.equal(status(g,2000),'quality-pending','Paid event with uncertified game cannot activate');
certified=true;
assert.equal(status(g,2000),'active','Approved paid booking and certified gameplay can activate');
assert.equal(status(g,500),'scheduled');
assert.equal(status(g,6000),'ended');
g.active=0;assert.equal(status(g,2000),'draft','Event must still be explicitly activated by owner');
assert.match(sponsor,/if \(!q \|\| q\.status !== 'paid'\)/,'Admin cannot create event on merely accepted quote');
assert.match(sponsor,/VALUES \(\?,\?,\?,\?,\?,\?,'play',\?,\?,0,/,'Created event must start inactive');
assert.match(sponsor,/share_ready: false, active: false/,'No unapproved share URL on prepare');
assert.match(events,/g\.booking_id \? g\.payment_status : pick\(b\.payment_status/,'Meta route must not bypass booked payment state');
assert.match(events,/not authorized for sharing until booking payment and game scoring certification/);
assert.match(events,/That is not an authorized, publicly shareable Gaming Hub event/);
console.log(JSON.stringify({pass:true,unpaidBlocked:true,uncertifiedBlocked:true,draftRequired:true,unapprovedEventCodesHidden:true,realPaymentIntegrationTested:false}));

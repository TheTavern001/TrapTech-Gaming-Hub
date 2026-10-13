#!/usr/bin/env node
'use strict';
// Read-only 500-game intake audit. Does not modify catalog, scores, releases or credits.
// This distinguishes an integrated registry entry from a fully reviewed launch title.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const {games} = require('../src/games-lib');
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT,'docs/audit/GAME-INTAKE-BASELINE.json'),'utf8'));
const admissions = JSON.parse(fs.readFileSync(path.join(ROOT,'docs/audit/GAME-INTAKE-ACCEPTANCE.json'),'utf8'));
const read=(p)=>{try{return fs.readFileSync(p,'utf8')}catch{return ''}};
const exists=p=>fs.existsSync(p);
const keys=new Set(baseline.baselineLibrarySlugs);
const candidates=games.filter(g=>!keys.has(g.slug));
const accepted=new Map(admissions.gameRecords.map(r=>[r.slug,r]));
const findings=[],items=[];
if(baseline.baselineLibrarySlugs.length!==80)findings.push('Baseline catalog not 80 entries');
if(new Set(baseline.baselineLibrarySlugs).size!==80)findings.push('Baseline contains duplicate slugs');
if(new Set(games.map(g=>g.slug)).size!==games.length)findings.push('Active game registry contains duplicate slugs');
if(games.length<80)findings.push('Original curated game count fell below 80; explicit retirement approval needed');
const unknownRecords=admissions.gameRecords.filter(r=>!games.some(g=>g.slug===r.slug));
for (const rec of unknownRecords) findings.push('Admission record exists for unregistered game: '+rec.slug);
for (const g of candidates) {
  const base=path.join(ROOT,'public','games-lib',g.slug), rec=accepted.get(g.slug);
  const sourceText=read(path.join(base,'CREDITS.md'));
  const checks={
    page:exists(path.join(base,'index.html')),
    gameplay: g.build!=='built'||exists(path.join(base,'game.js')),
    credits: sourceText.length>80 && !/No third-party assets\./.test(sourceText),
    license: Boolean(g.licence) && Boolean(rec?.sourceUrl) && Boolean(rec?.assetRightsReviewed),
    uniqueMechanics: Boolean(rec?.mechanicsDiffersFromExisting && rec.mechanicsReviewNotes),
    honestScoreSecurity: Boolean(rec?.scoreValidation?.legitimateAccepted && rec.scoreValidation?.forgedRejected),
    mobileDesktop: Boolean(rec?.mobileQa?.androidPhysical && rec.mobileQa?.desktop),
    performance: Boolean(rec?.mobileQa?.p95FrameMs!==undefined && rec.mobileQa.p95FrameMs<=25),
    ownerApproved: rec?.status==='APPROVED'
  };
  const ready=Object.values(checks).every(Boolean);
  items.push({slug:g.slug,title:g.title,admission:rec?.status||'NOT_RECORDED',checks,ready});
}
const approvedCount=items.filter(x=>x.ready).length;
const currentActive=baseline.activeCoreIds.length+games.length;
const out={reportType:'read-only admission inventory',registeredLibrary:games.length,baselineLibrary:keys.size,
  activeCore:baseline.activeCoreIds.length,totalRegistered:currentActive,registeredNewGames:candidates.length,
  acceptedNewGames:approvedCount,remainingRegisteredToTarget:Math.max(0,baseline.targetActiveGames-currentActive),
  baselineTitlesStillNeedDeviceReview:true,newGameIntake:items,structuralFindings:findings,
  caution:'Registered does not mean verified or AAA; only per-game accepted entries have the evidence listed above.'};
console.log(JSON.stringify(out,null,2));
if(findings.length)process.exitCode=1;
if(process.argv.includes('--require-approved') && items.some(i=>!i.ready))process.exitCode=1;

#!/usr/bin/env node
'use strict';
// Evidence-based AAA-style quality admission. This is a read-only reporter, NOT a game generator.
// A source registry entry, screenshot, or passing Docker build never approves a game.
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const readJson = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const baseline = readJson('docs/audit/GAME-INTAKE-BASELINE.json');
const quality = readJson('docs/audit/GAME-QUALITY-ACCEPTANCE.json');
const admissions = readJson('docs/audit/GAME-INTAKE-ACCEPTANCE.json');
const { games } = require('../src/games-lib');
const required = quality.requiredChecks;
const map = new Map();
for (const id of baseline.activeCoreIds) map.set('core:' + id, {type:'core', baseline:true});
const old = new Set(baseline.baselineLibrarySlugs);
for (const g of games) map.set('library:' + g.slug, {type:'library', baseline:old.has(g.slug)});
const errors = [], passed = [], pending = [];
const seen = new Set();
const intakeMap = new Map(admissions.gameRecords.map(x=>[x.slug,x]));
if (!Array.isArray(quality.records) || !Array.isArray(required) || !required.length) {
  console.error('Invalid quality admission ledger'); process.exit(1);
}
const approvedCheck = check => check && check.passed === true &&
  typeof check.evidence === 'string' && check.evidence.trim().length >= 8;
for (const record of quality.records) {
  if (!record || typeof record.id !== 'string' || !map.has(record.id)) {
    errors.push('Quality approval for unknown game ' + String(record && record.id)); continue;
  }
  if (seen.has(record.id)) { errors.push('Duplicate quality record ' + record.id); continue; }
  seen.add(record.id);
  const entry = map.get(record.id);
  const checks = required.every(k=>approvedCheck(record.checks && record.checks[k]));
  const android = record.metrics && Number.isFinite(record.metrics.androidP95FrameMs) &&
    record.metrics.androidP95FrameMs > 0 && record.metrics.androidP95FrameMs <= 16.7 &&
    Number.isFinite(record.metrics.minimumVerifiedRenderHeightPx) &&
    record.metrics.minimumVerifiedRenderHeightPx >= 720;
  const owner = typeof record.reviewer === 'string' && record.reviewer.trim().length >= 2 &&
    typeof record.reviewedAtUTC === 'string' && !Number.isNaN(Date.parse(record.reviewedAtUTC));
  const intake = entry.baseline || (record.id.startsWith('library:') &&
    intakeMap.get(record.id.slice(8))?.status === 'APPROVED' &&
    intakeMap.get(record.id.slice(8))?.assetRightsReviewed === true &&
    intakeMap.get(record.id.slice(8))?.mobileQa?.androidPhysical === true);
  const ok = record.status === 'APPROVED' && checks && android && owner && intake;
  if (record.status === 'APPROVED' && !ok)
    errors.push('Approval without complete evidence or performance/intake gates: ' + record.id);
  if (ok) passed.push(record.id);
}
for (const id of map.keys()) if (!passed.includes(id)) pending.push(id);
const approvedSet = new Set(passed);
const baselineIds = [...baseline.activeCoreIds.map(id=>'core:'+id),
  ...baseline.baselineLibrarySlugs.map(slug=>'library:'+slug)];
const baselinePending = baselineIds.filter(id=>!approvedSet.has(id));
const goal = quality.goal;
const result = {
  report:'evidence-based quality certifications, not registered game count',
  totalRegistered:map.size, registeredCore:baseline.activeCoreIds.length,
  registeredLibrary:games.length, qualityApproved:passed.length,
  baselineQualityApproved:baselineIds.length-baselinePending.length,
  baselinePending:baselinePending.length, expansionGateOpen:baselinePending.length===0 && !errors.length,
  qualityRemainingTo500:Math.max(0,goal-passed.length), goal, unapprovedRegistered:pending.length,
  approvedIds:passed, errors,
  note:'No score/asset/gameplay/Android/owner signoff is inferred from a registered title. This reporter does not run gameplay tests.'
};
console.log(JSON.stringify(result,null,2));
if (errors.length || (process.argv.includes('--require-baseline') && baselinePending.length) ||
    (process.argv.includes('--require-500') && passed.length < goal)) process.exitCode=1;

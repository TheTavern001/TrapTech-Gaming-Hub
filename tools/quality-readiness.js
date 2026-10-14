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
for (const g of games.filter(g=>g.playable!==false&&!g.retired)) map.set('library:' + g.slug, {type:'library', baseline:old.has(g.slug)});
const errors = [], passed = [], pending = [];
// Do not silently keep a retired/replaced baseline game in the quality denominator.
const configSource = fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8');
const coreIds = [...configSource.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)]
  .map(m=>m[1]).filter(id=>!['plinko','spin-to-win','blazed-roulette'].includes(id));
if (coreIds.length !== baseline.activeCoreIds.length ||
    coreIds.some(id=>!baseline.activeCoreIds.includes(id)))
  errors.push('Core registry drift: update/approve retired and new baseline IDs before quality certification');
if (new Set(games.map(g=>g.slug)).size !== games.length)
  errors.push('Duplicate active Games Library slugs');
if (old.size !== baseline.baselineLibrarySlugs.length || old.size !== 80)
  errors.push('Frozen Games Library baseline is corrupt');
for (const slug of old) if (!games.some(g=>g.slug===slug))
  errors.push('Baseline title removed without approved replacement: ' + slug);
const seen = new Set();
const intakeMap = new Map(admissions.gameRecords.map(x=>[x.slug,x]));
if (!Array.isArray(quality.records) || !Array.isArray(required) || !required.length) {
  console.error('Invalid quality admission ledger'); process.exit(1);
}
const approvedCheck = check => {
  if (!check || check.passed !== true || typeof check.evidence !== 'string') return false;
  const ref = check.evidence.trim();
  // Documented evidence must be an existing repository audit artifact or an HTTPS review URL.
  if (ref.startsWith('https://') && ref.length > 16 && !ref.includes(' ')) return true;
  if (!/^docs\/audit\/[a-z0-9_./-]+$/i.test(ref) || ref.includes('..')) return false;
  return fs.existsSync(path.join(ROOT, ref));
};
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
  const reviewTime = Date.parse(record.reviewedAtUTC);
  const owner = typeof record.reviewer === 'string' && record.reviewer.trim().length >= 2 &&
    typeof record.reviewedAtUTC === 'string' && !Number.isNaN(reviewTime) &&
    reviewTime > 0 && reviewTime <= Date.now();
  const rec = record.id.startsWith('library:') ? intakeMap.get(record.id.slice(8)) : null;
  const intake = entry.baseline || (rec?.status === 'APPROVED' &&
    typeof rec.sourceUrl === 'string' && /^https:\/\//.test(rec.sourceUrl) &&
    rec.assetRightsReviewed === true &&
    rec.mechanicsDiffersFromExisting === true &&
    typeof rec.mechanicsReviewNotes === 'string' && rec.mechanicsReviewNotes.length > 12 &&
    rec.scoreValidation?.legitimateAccepted === true &&
    rec.scoreValidation?.forgedRejected === true &&
    rec.mobileQa?.androidPhysical === true && rec.mobileQa?.desktop === true);
  const ok = record.status === 'APPROVED' && checks && android && owner && intake;
  if (record.status === 'APPROVED' && !ok)
    errors.push('Approval without complete evidence or performance/intake gates: ' + record.id);
  if (ok) passed.push(record.id);
}
for (const id of map.keys()) if (!passed.includes(id)) pending.push(id);
const approvedSet = new Set(passed);
const baselineIds = [...baseline.activeCoreIds.map(id=>'core:'+id),
  ...games.filter(g=>g.playable!==false&&!g.retired&&old.has(g.slug)).map(g=>'library:'+g.slug)];
const baselinePending = baselineIds.filter(id=>!approvedSet.has(id));
const goal = quality.goal;
const result = {
  report:'evidence-based quality certifications, not registered game count',
  totalRegistered:baseline.activeCoreIds.length+games.length, totalPlayable:map.size, archivedLibrary:games.filter(g=>g.retired).length,
  registeredCore:baseline.activeCoreIds.length, registeredLibrary:games.length, qualityApproved:passed.length,
  baselineQualityApproved:baselineIds.length-baselinePending.length,
  baselinePending:baselinePending.length, expansionGateOpen:baselinePending.length===0 && !errors.length,
  qualityRemainingTo500:Math.max(0,goal-passed.length), goal, unapprovedRegistered:pending.length,
  approvedIds:passed, errors,
  note:'No score/asset/gameplay/Android/owner signoff is inferred from a registered title. This reporter does not run gameplay tests.'
};
console.log(JSON.stringify(result,null,2));
if (errors.length || (process.argv.includes('--require-baseline') && baselinePending.length) ||
    (process.argv.includes('--require-500') && passed.length < goal)) process.exitCode=1;

#!/usr/bin/env node
'use strict';
// Read-only local release snapshot; never calls Deplexo or changes production data.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/audit/DEPLOYMENT-JOURNAL.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/games-lib/catalog.json'), 'utf8'));
const config = fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8');
const history = ledger.releaseHistory || [], statuses = new Set(['FAILED','READY','BUILDING_OBSERVED','UNKNOWN']);
const errs = [];
const isSha = s => typeof s === 'string' && /^[a-f0-9]{40}$/i.test(s);
const shaSet = new Set();
for (const entry of history) {
  if (!isSha(entry.commit)) errs.push('Invalid deployment SHA: ' + String(entry.commit));
  if (shaSet.has(entry.commit)) errs.push('Duplicate deployment record: ' + entry.commit);
  shaSet.add(entry.commit);
  if (!statuses.has(entry.status)) errs.push('Invalid deployment status for ' + entry.commit);
  if (!entry.evidence) errs.push('Missing evidence source for ' + entry.commit);
  if (entry.fixCommit && !isSha(entry.fixCommit)) errs.push('Invalid fix SHA for ' + entry.commit);
}
if (ledger.publicLaunchApproved === true) errs.push('Public launch status requires fresh manual signoff; tracker may not auto-certify it.');
const ids = [...config.matchAll(/\{\s*id:\s*'([^']+)',\s*title:\s*'([^']+)'[\s\S]*?module:\s*'([^']+)'/g)].map(x=>x[1]);
const retired = new Set(['plinko','spin-to-win','blazed-roulette']);
const activeCore = ids.filter(x=>!retired.has(x));
if (!Array.isArray(catalog.games)) errs.push('Missing catalog games array');
const library = Array.isArray(catalog.games) ? catalog.games.length : 0;
if (new Set(catalog.games?.map(x=>x.slug)).size !== library) errs.push('Duplicate library slugs');
const playableLibrary = catalog.games?.filter(g=>g.playable!==false&&!g.retired).length || 0;
const archivedLibrary = library-playableLibrary;
const historicalTotal = activeCore.length+library;
const total = activeCore.length+playableLibrary, goal=500;
// Only host evidence (e.g. owner screenshot) can mark a deployment CURRENT.
// GitHub source commits are never treated as Deplexo deployments by inference.
const currentReady = history.filter(x=>x.observedAsCurrent === true);
if (currentReady.length > 1) errs.push('More than one host-current deployment record');
if (currentReady.some(x=>x.status!=='READY')) errs.push('Host-current deployment must be READY');
if (ledger.latestOwnerObservedHost?.currentReadySha &&
    ledger.latestOwnerObservedHost.currentReadySha !== currentReady[0]?.commit)
  errs.push('Host-current SHA disagrees with last owner screenshot');
const lastObserved = history.at(-1);
const lastReady = currentReady[0] || [...history].reverse().find(x=>x.status==='READY');
const source = ledger.currentWorkingSource || null;
if (source?.sourceStatus === 'SOURCE_ONLY_NOT_DEPLOYED' &&
    history.some(x=>x.commit === source.headAtReconciliation))
  errs.push('Source-only development commit incorrectly listed as a host deployment');
if (source?.headAtReconciliation&&!isSha(source.headAtReconciliation))
  errs.push('Working source SHA must be full SHA');
let head = null;
try { head = cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
const output = { checkedAtUTC:new Date().toISOString(), gitHead:head||'not available (Docker image may omit .git)',
  hostCurrent:{sha:currentReady[0]?.commit||null,
    status:currentReady[0]?.status||'UNCONFIRMED',
    confirmation:'owner screenshot only; no independent HTTP readback',
    branch:currentReady[0]?.branchReportedByHost||null,
    evidence:currentReady[0]?.evidence||null},
  lastObservedDeployment:{sha:lastObserved?.commit,status:lastObserved?.status,evidence:lastObserved?.evidence},
  lastObservedReady:{sha:lastReady?.commit,evidence:lastReady?.evidence},
  workingSource:{branch:source?.branch||null,shaFromLastReconciliation:source?.headAtReconciliation||null,
    gitCheckoutHead:head||null,status:source?.sourceStatus||'UNKNOWN',
    warning:'GitHub source does NOT imply deployed to Deplexo'},
  automaticDeploymentOwnerConfirmedOff:ledger.ownerConfirmedAutoDeployOff===true,
  activeCoreGames:activeCore.length,registeredLibraryGames:library,playableLibraryGames:playableLibrary,
  archivedLibraryGames:archivedLibrary,historicalRegisteredGames:historicalTotal,
  totalPlayableGames:total,totalGames:total,remainingPlayableGamesTo500:Math.max(0,goal-total),
  remainingTo500:Math.max(0,goal-total),
  candidatePipeline:'research and intake available, NOT counted as playable or AAA approved',
  publicLaunchApproved:false,unverifiedGates:ledger.pendingEvidence,ledgerErrors:errs };
console.log(JSON.stringify(output,null,2));
if (errs.length) process.exitCode=1;

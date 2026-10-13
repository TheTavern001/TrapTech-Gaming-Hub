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
const ids = [...config.matchAll(/\\{\\s*id:\\s*'([^']+)',\\s*title:\\s*'([^']+)'[\\s\\S]*?module:\\s*'([^']+)'/g)].map(x=>x[1]);
const retired = new Set(['plinko','spin-to-win','blazed-roulette']);
const activeCore = ids.filter(x=>!retired.has(x));
if (!Array.isArray(catalog.games)) errs.push('Missing catalog games array');
const library = Array.isArray(catalog.games) ? catalog.games.length : 0;
if (new Set(catalog.games?.map(x=>x.slug)).size !== library) errs.push('Duplicate library slugs');
const total = activeCore.length+library, goal=500;
const lastObserved = history.at(-1), lastReady=[...history].reverse().find(x=>x.status==='READY');
let head = null;
try { head = cp.execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim(); } catch {}
const output = { checkedAtUTC:new Date().toISOString(), gitHead:head||'not available (Docker image may omit .git)',
  lastObservedDeployment:{sha:lastObserved?.commit,status:lastObserved?.status,evidence:lastObserved?.evidence},
  lastObservedReady:{sha:lastReady?.commit,evidence:lastReady?.evidence},
  activeCoreGames:activeCore.length,libraryGames:library,totalGames:total,remainingTo500:Math.max(0,goal-total),
  candidatePipeline:'research and intake available, not approved for bulk importing',
  publicLaunchApproved:false,unverifiedGates:ledger.pendingEvidence,ledgerErrors:errs };
console.log(JSON.stringify(output,null,2));
if (errs.length) process.exitCode=1;

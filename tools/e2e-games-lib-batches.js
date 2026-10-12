#!/usr/bin/env node
'use strict';

// Run the complete Games Library E2E suite in ten-title batches, continuing after a
// failed batch so one broken title does not hide the rest of the catalog's failures.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { games } = require('../src/games-lib');

const BATCH_SIZE = Math.max(1, Math.min(10, Number(process.env.BATCH_SIZE) || 10));
const script = path.join(__dirname, 'e2e-games-lib.js');
const groups = [];
for (let i = 0; i < games.length; i += BATCH_SIZE) groups.push(games.slice(i, i + BATCH_SIZE));
const results = [];

console.log(`Running ${games.length} Games Library titles in ${groups.length} sequential batches of up to ${BATCH_SIZE}.`);
for (let i = 0; i < groups.length; i++) {
  const slugs = groups[i].map(g => g.slug);
  console.log(`\n=== Batch ${i + 1}/${groups.length}: ${slugs.join(', ')} ===`);
  const result = spawnSync(process.execPath, [script, slugs.join(',')], {
    cwd: path.join(__dirname, '..'),
    env: process.env,
    stdio: 'inherit',
    timeout: 1000 * 60 * 20
  });
  results.push({
    batch: i + 1,
    slugs,
    exitCode: result.status,
    signal: result.signal || null,
    error: result.error ? result.error.message : null
  });
  if (result.error) console.error('Batch process error:', result.error.message);
}
const failed = results.filter(r => r.exitCode !== 0);
console.log('\nBATCH SUMMARY');
console.log(JSON.stringify({
  totalGames: games.length,
  batchSize: BATCH_SIZE,
  batches: results.length,
  passedBatches: results.length - failed.length,
  failedBatches: failed
}, null, 2));
if (failed.length) process.exitCode = 1;

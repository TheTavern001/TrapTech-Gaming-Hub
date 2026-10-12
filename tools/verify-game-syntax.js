#!/usr/bin/env node
'use strict';

// Syntax-only gate for every shipped gameplay entrypoint and both shared engines.
// This reports failures; it never skips or rewrites a broken game to make a build pass.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const coreRoot = path.join(ROOT, 'public', 'js', 'games');
const libraryRoot = path.join(ROOT, 'public', 'games-lib');
const targets = [];
function walk(dir, accept) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, accept);
    else if (ent.isFile() && accept(full)) targets.push(full);
  }
}
walk(coreRoot, f => f.endsWith('.js'));
walk(libraryRoot, f => f.endsWith(path.sep + 'game.js') || ['kit.js', 'adapter.js'].includes(path.basename(f)));
const unique = [...new Set(targets)].sort();
const failures = [];
for (const file of unique) {
  const source = fs.readFileSync(file, 'utf8');
  const isCoreModule = file.startsWith(coreRoot + path.sep);
  const args = isCoreModule ? ['--input-type=module', '--check'] : ['--check'];
  const result = spawnSync(process.execPath, args, { input: isCoreModule ? source : undefined, encoding: 'utf8', timeout: 15000 });
  // For classic scripts, node --check needs the filename. For modules, stdin lets Node parse
  // ES module syntax without changing package.json or requiring a browser runtime.
  const checked = isCoreModule ? result : spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', timeout: 15000 });
  if (checked.error || checked.status !== 0) {
    const detail = checked.error ? checked.error.message : (checked.stderr || checked.stdout || 'unknown syntax-check failure');
    failures.push({ file: path.relative(ROOT, file).split(path.sep).join('/'), detail: String(detail).slice(0, 1200) });
    console.error('FAIL', path.relative(ROOT, file), detail);
  } else {
    console.log('PASS', path.relative(ROOT, file));
  }
}
console.log(JSON.stringify({ checked: unique.length, failures: failures.length, details: failures }, null, 2));
if (failures.length) process.exitCode = 1;

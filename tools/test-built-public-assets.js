#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const docker=read('Dockerfile'),runtime=docker.slice(docker.indexOf('# ---------- runtime stage'));
assert.ok(runtime.includes('COPY --from=build --chown=root:root /app/public ./public'),
 'Runtime image must use generated icons and covers that passed build checks');
assert.ok(!/COPY --chown=root:root public \.\/public/.test(runtime),'Source copy must not replace generated runtime assets');
const block=read('src/config.js').match(/const GAMES = \[([\s\S]*?)\n\];/)[1];
const cards=[...block.matchAll(/\bart(?:Tall)?:\s*'([^']+)'/g)].map(m=>m[1]);
for(const file of cards)assert.ok(fs.statSync(path.join(root,'public',file)).size>100,'Missing game card '+file);
const hex=read('public/games-lib/hex-stack/js/initialization.js');
assert.doesNotMatch(hex,/google-analytics|GoogleAnalyticsObject|UA-\d+/,'Imported game cannot leak player visits to third-party trackers');
assert.ok(hex.includes("matchMedia('(pointer: coarse)')"),'Phone controls must not depend on a desktop-style user agent');
console.log(JSON.stringify({pass:true,registeredGameCovers:cards.length,runtimeUsesBuiltAssets:true,hexTrackingRemoved:true}));

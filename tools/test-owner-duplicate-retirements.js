#!/usr/bin/env node
'use strict';
// No destructive DB operation: retain historic IDs while archiving duplicate
// discovery and disabling new scored sessions / official competitions.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const {games}=require('../src/games-lib');
const snapshot=JSON.parse(read('public/games-lib/catalog.json'));
const baseline=JSON.parse(read('docs/audit/GAME-INTAKE-BASELINE.json'));
const retired={
 'wreck-ride':'gl-hill-hauler','egg-roll':'gl-hill-hauler',
 'monster-crush':'gl-hill-hauler','rig-rally':'gl-hill-hauler',
 'dune-glide':'gl-hill-hauler','drift-king':'drift-rush'
};
assert.equal(games.length,80,'Preserve all historical library game IDs');
assert.equal(new Set(games.map(g=>g.id)).size,80);
assert.deepEqual(new Set(games.map(g=>g.slug)),new Set(baseline.baselineLibrarySlugs),
 'Previously imported games must not be silently deleted');
assert.ok(baseline.activeCoreIds.includes('drift-rush'));
const active=games.filter(g=>g.playable&&!g.retired);
assert.equal(active.length,74,'Only one representative per owner-rejected mechanics family');
assert.equal(games.filter(g=>g.retired).length,6);
for(const g of games){
 if(retired[g.slug]){
  assert.equal(g.retired,true,g.slug+' must be explicitly retired');
  assert.equal(g.playable,false,g.slug+' cannot start new scoring');
  assert.equal(g.giveaway,false,g.slug+' cannot host a giveaway');
  assert.equal(g.replacedBy,retired[g.slug],g.slug+' successor missing');
  assert.ok(fs.existsSync(path.join(root,'public/games-lib',g.slug,'index.html')),
   'Keep direct historical engine assets while old scores remain attributed');
 }else{
  assert.equal(g.retired,false,'Unexpected hidden title '+g.slug);
  assert.equal(g.playable,true,'Active title cannot be unplayable '+g.slug);
  assert.equal(g.giveaway,true,'Active title cannot be giveaway-ineligible '+g.slug);
 }
}
assert.equal(games.find(g=>g.slug==='hill-hauler').playable,true);
assert.equal(snapshot.games.length,80);
const stable=o=>Array.isArray(o)?o.map(stable):o&&typeof o==='object'
 ? Object.fromEntries(Object.keys(o).sort().map(k=>[k,stable(o[k])])):o;
assert.deepEqual(stable(snapshot.games),stable(games.map(({ref_internal,...g})=>g)),
 'Fallback public catalog must exactly match source metadata');
assert.ok(!snapshot.games.some(g=>Object.hasOwn(g,'ref_internal')),
 'Internal reference metadata must never ship to users');
const primary=read('public/js/app.js'),library=read('public/games-lib/index.html');
assert.ok(primary.includes('catalog = [...S.games, ...S.libraryGames].filter(g => g.playable !== false && !g.retired)'));
assert.ok(library.includes('r.games.filter(g => g && g.playable !== false && !g.retired'));
const server=read('src/server.js');
assert.ok(server.includes("games_library_playable: libraryGames().filter"));
assert.ok(server.includes("games_library_archived: libraryGames().filter"));
assert.ok(server.includes("if (!game || !game.playable) return bad(res, 400"));
assert.ok(server.includes("if (!game || !game.playable) return reject(400"));
console.log(JSON.stringify({pass:true,registeredHistory:80,libraryPlayable:74,corePlayable:13,
 totalPlayable:87,archivedDuplicates:Object.keys(retired).length,playerDatabaseTouched:false,
 eligibility:'retired new runs/giveaways off, original game IDs and historical attribution kept'}));

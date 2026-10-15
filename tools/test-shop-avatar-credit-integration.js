#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'../public/js');
const files=['avatar-editor.js','economy.js','hub-store.js'];
const source=Object.fromEntries(files.map(n=>[n,fs.readFileSync(path.join(base,n),'utf8')]));
for(const [name,code] of Object.entries(source)){
 const noImports=code.replace(/^import .*$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b)/g,'').replace(/^export \{[^}]*\};?\s*$/gm,'');
 new vm.Script(noImports,{filename:name});
}
assert.match(source['avatar-editor.js'],/let credits = r\.credits \?\? r\.points \?\? 0/);
assert.match(source['avatar-editor.js'],/api\('\/api\/avatar\/buy-credits'/);
assert.match(source['avatar-editor.js'],/href="\/store"/);
assert.doesNotMatch(source['avatar-editor.js'],/Hub Crowns|Earned Hub Points/);
assert.match(source['economy.js'],/href="\/avatar"[^>]*>\$\{icon\('user-round'\)\} Avatar wardrobe/);
assert.match(source['economy.js'],/href="\/store"[^>]*>\$\{icon\('wallet'\)\} Get Credits/);
assert.match(source['hub-store.js'],/href="\/shop"[^>]*>\$\{icon\('palette'\)\} Profile cosmetics/);
assert.match(source['hub-store.js'],/href="\/avatar"[^>]*>\$\{icon\('user-round'\)\} Avatar wardrobe/);
console.log(JSON.stringify({pass:true,profileShopAvatarLinked:true,oneWalletInWardrobe:true,realBrowserVerified:false}));

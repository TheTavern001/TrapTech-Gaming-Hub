#!/usr/bin/env node
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const base=fs.readFileSync(path.join(__dirname,'../public/js/avatar-3d.js'),'utf8');
const rig=fs.readFileSync(path.join(__dirname,'../public/js/avatar-rig.js'),'utf8');
new vm.Script(base.replace(/^import .*$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b)/g,''));
new vm.Script(rig.replace(/^import .*$/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b)/g,''));
assert.match(base,/stage\.__hubAvatarRenderGeneration = generation/);
assert.match(base,/stage\.__hubAvatarRenderGeneration !== generation/);
assert.match(base,/mountRiggedAvatar\(stage, cfg, generation\)/);
assert.match(rig,/stage\.__hubAvatarRenderGeneration !== generation/);
console.log(JSON.stringify({pass:true,contract:'latest-wardrobe-request-wins',deviceQA:false}));

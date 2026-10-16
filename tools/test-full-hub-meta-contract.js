#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const FAIR=require('../src/meta-fairness-contract');
const board=JSON.parse(read('docs/audit/FIVE-RELEASE-FULL-HUB-WORKBOARD.json'));
const assets=JSON.parse(read('docs/audit/EXTERNAL-ASSET-PIPELINE-2026-10-13.json'));
const ids=new Set(),allowedReleases=new Set(['R1','R2','R3','R4','R5','POST-R5']);
assert.equal(board.plannedManualReleaseMilestones,5);
assert.equal(board.autoDeploy,false);
assert.equal(board.currentHistoricalRegistered,93);
assert.equal(board.proposedActivePlayable,87);
assert.equal(board.individuallyQualityApproved,0);
assert.equal(board.prestigeSalesEnabledForRelease,false);
assert.ok(board.workstreams.length>=25);
for(const row of board.workstreams){
 assert.ok(!ids.has(row.id),'Duplicate workstream '+row.id);ids.add(row.id);
 assert.ok(allowedReleases.has(row.release));
 assert.ok(['SOURCE_ONLY','BLOCKED','NOT_STARTED','DEVICE_TESTED','OWNER_APPROVED'].includes(row.status));
 if(row.status==='OWNER_APPROVED'){
  assert.equal(row.ownerApproved,true);
  assert.ok(Array.isArray(row.evidence)&&row.evidence.length>=2,'Approval without device+code evidence: '+row.id);
 }else assert.equal(row.ownerApproved,false,'False approval flag: '+row.id);
}
assert.ok(assets.sourcePacks.length>=10);
for(const pack of assets.sourcePacks){
 assert.match(pack.sourceUrl,/^https:\/\//);
 assert.match(pack.licenseUrl,/^https:\/\//);
 assert.equal(pack.declaredLicense,'CC0-1.0');
 assert.ok(['CANDIDATE','PARTIALLY_IMPORTED','INTEGRATED'].includes(pack.status));
 if(pack.status==='INTEGRATED'){
  assert.match(pack.downloadSha256,/^[a-f0-9]{64}$/);
  assert.equal(pack.geometryCertification,'APPROVED');
  assert.equal(pack.mobileArtCertification,'APPROVED');
 }
 if(pack.status==='CANDIDATE')
  assert.equal(pack.localFiles.length,0,'Do not invent local imports: '+pack.id);
 for(const f of pack.localFiles)
  assert.ok(fs.existsSync(path.join(ROOT,f)),'Missing imported source model '+f);
}
const defaultAvatar=FAIR.avatarAppearance();
assert.deepEqual(defaultAvatar,FAIR.DEFAULT_AVATAR,'Identical account starting avatar is required');
const altered=FAIR.avatarAppearance({speed:999,damage:999,hitbox:'tiny',skin:'s3',jacket:'coat'});
assert.equal(altered.speed,undefined);
assert.equal(altered.damage,undefined);
assert.equal(altered.hitbox,undefined);
assert.equal(altered.skin,'s3');
assert.equal(altered.jacket,'coat');
assert.equal(altered.rig,FAIR.AVATAR_RIG_ID);
assert.ok(Object.isFrozen(defaultAvatar)&&Object.isFrozen(altered));
assert.equal(FAIR.assertVisualOnlyItem({id:'base_skin',slot:'vehicle',assetId:'cv-sedan'}),true);
const white=FAIR.visualProjection({id:'preview',slot:'vehicle',assetId:'cv-sedan',materialId:'gold',priceUSD:2500});
assert.deepEqual(Object.keys(white),['id','slot','assetId','variantId','materialId','animationId']);
assert.equal(white.priceUSD,undefined);
for(const field of ['speed','hitbox','damage','bonus_score','luck','enemySpawn','gameplayPower']){
 assert.throws(()=>FAIR.assertVisualOnlyItem({id:'p2w',slot:'hat',[field]:100}),/Prohibited gameplay/);
}
assert.throws(()=>FAIR.assertVisualOnlyItem({id:'p2w',slot:'back',effect:{physics:{maxSpeed:999}}}),/Prohibited gameplay/);
assert.throws(()=>FAIR.validateCosmeticTrackBoost({scope:'gameplay',percent:15}),/only to cosmetic/);
assert.throws(()=>FAIR.validateCosmeticTrackBoost({scope:'season_cosmetic_track',percent:15,scoreMultiplier:2}),/Invalid XP boost property/);
assert.deepEqual(FAIR.validateCosmeticTrackBoost({scope:'season_cosmetic_track',percent:15,sourceCosmeticId:'prestige-original-cane'}),
 {scope:'season_cosmetic_track',percent:15,sourceCosmeticId:'prestige-original-cane'});
// Competitive scoring and giveaway eligibility MUST NOT import cosmetic/pay
// modules. Premium XP must remain a distinct track, never a board multiplier.
for(const f of ['src/anticheat.js','src/ac-levels.js','src/eligibility.js','src/config.js']){
 const src=read(f);
 assert.ok(!/require\s*\(\s*['"]\.\/(?:monetize|shop|avatars|shop-gen)['"]\s*\)/.test(src),
  'Scoring/eligibility imports purchases or avatar equipment: '+f);
}
const pay=read('src/monetize.js');
assert.ok(pay.includes('const cosmetic = sp ? sp.cosmetic_xp'));
const cosmetic=read('src/cosmetic-xp.js');
assert.ok(cosmetic.includes('o.usd_cents>=100000'));
assert.ok(cosmetic.includes('verifiedSettlement'));
assert.ok(cosmetic.includes("o.provider !== 'manual'"));
assert.ok(pay.includes('const pxp = cosmetic.xp'));
assert.ok(!pay.includes('Math.floor(sp.xp * (owned ? 1 + boost / 100 : 1))'));
assert.ok(read('src/shop.js').includes('Hub Credits are COSMETIC ONLY'));
assert.ok(read('src/shop.js').includes("WALLET.balance(userId)"),'Points Shop must use one Credits balance');
assert.ok(pay.includes("const WALLET = require('./unified-wallet')"),'Paid packs must credit same wallet');
assert.ok(pay.includes("return r.ok?{ok:true,item:r.item.id,price_credits:r.price,credits:r.balance}:r"),
  'Deprecated Crowns endpoint must delegate to the one cosmetic purchase implementation');
assert.ok(!pay.includes("if (crowns(user.id) < price)"),'No separately spendable paid Crown wallet');
assert.ok(pay.includes("Payment provider not supported"),'Unverified Whop webhook must remain disabled');
assert.ok(pay.includes("['pack_crowns','INTEGER']"),'Store orders must have a snapshot Credit-quantity column');
assert.ok((pay.match(/p\.kind === 'pack' \? p\.crowns\+p\.bonus : null/g)||[]).length>=3,
 'Bitcoin, Stripe and manual orders must pin Credit-pack quantities at creation');
assert.ok(pay.includes('fresh.pack_crowns') && !pay.includes("if (p.kind === 'pack') addCrowns(o.user_id, p.crowns + p.bonus"),
 'Fulfillment must use the pinned order quantity, not a mutable product');
assert.ok(pay.includes("SELECT delta FROM crown_ledger WHERE user_id=? AND reason='purchase' AND ref=?"),
 'Refund must reverse exactly the original payment ledger grant');
assert.ok(pay.includes("if (!verifiedSettlement(fresh))"),
 'Every order fulfillment must validate its fresh persisted provider settlement');
assert.ok(pay.includes("const { verifiedSettlement } = require('./payment-settlement-proof')"),
 'Monetization must use the fail-closed provider proof module');
assert.ok(!pay.includes("db.prepare(\"UPDATE store_orders SET status='paid', paid_at=COALESCE(paid_at, ?) WHERE id=?\").run(Date.now(), o.id)"),
 'Admin may not force-unverified paid status before granting');
assert.ok(read('tools/test-payment-settlement-proof.js').includes('admin grant cannot turn a pending unpaid order'),
 'Source fallback must keep negative admin-settlement regression');
assert.ok(pay.includes("if (o.refunded_at) return { ok:true, already:true };"),
 'Duplicate signed refund events must remain idempotent');
assert.ok(read('src/unified-wallet.js').includes("CREDIT_PER_LEGACY_CROWN=10"),
 'Legacy Crown-to-credit migration ratio must remain pinned');
assert.ok(read('tools/test-payment-order-snapshots.js').includes("LEGACY_NO_QUOTE"),
 'Unquoted historical orders must fail closed in regression');
assert.ok(read('src/rotating-quests.js').includes('does not award XP or trust client completion claims'));
console.log(JSON.stringify({pass:true,workstreams:board.workstreams.length,
  externalPackSources:assets.sourcePacks.length,defaultAvatarIdentical:true,
  forbiddenCosmeticStatsRejected:true,cosmeticTrackOnlyBoost:true,
  competitiveServicesIndependentOfPayModules:true,level:'source architecture contract, not integrated gameplay QA'}));

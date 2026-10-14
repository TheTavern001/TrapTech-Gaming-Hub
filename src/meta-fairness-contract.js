'use strict';
// Pure contracts for cosmetic-only metadata; safe to require without DB,
// payment credentials, network, or mutable gameplay state.
// NOTE: existing game engines must be migrated to consume their own validated
// run config only. This module is a fail-closed NEW foundation, not proof that
// legacy engines already satisfy it.
const AVATAR_RIG_ID='traptech-universal-humanoid-v1';
const DEFAULT_AVATAR=Object.freeze({
  rig:AVATAR_RIG_ID,body:'neutral',skin:'neutral-default',face:'neutral-default',
  hair:'none',hat:'none',eyes:'standard',makeup:'none',shirt:'starter',
  jacket:'none',pants:'starter',shoes:'starter',glasses:'none',
  back:'none',prop:'none',aura:'none',trail:'none',
  animation:'idle-default',vehicle:'starter'
});
const COSMETIC_SLOTS=Object.freeze([
  'skin','face','hair','hat','eyes','makeup','shirt','jacket','pants',
  'shoes','glasses','back','prop','aura','trail','animation','vehicle'
]);
const GAMEPLAY_KEYS=new Set([
  'damage','attack','defense','speed','velocity','acceleration','power','heal',
  'health','hp','shield','stamina','hitbox','collision','score','points',
  'chance','probability','luck','seed','rng','random','multiplier',
  'spawn','spawnrate','cooldown','weaponpower','weapon_damage','shotrate',
  'range','enemyai','difficulty','lives','ammo','cashreward','prizeodds',
  'extratime','bonusattempts','xp'
]);
function assertVisualOnlyItem(item) {
  if(!item||typeof item!=='object'||Array.isArray(item))throw Error('Cosmetic definition must be an object');
  if(!/^[a-z0-9][a-z0-9_-]{0,95}$/i.test(String(item.id||'')))throw Error('Invalid cosmetic ID');
  if(!COSMETIC_SLOTS.includes(item.slot)&&!['banner','title','badge','frame','effect','sticker','spray','calling-card'].includes(item.slot))
    throw Error('Unknown cosmetic slot: '+item.slot);
  const walk=(value,depth=0)=>{
    if(depth>12)throw Error('Cosmetic definition nesting too deep');
    if(Array.isArray(value)){for(const x of value)walk(x,depth+1);return;}
    if(value&&typeof value==='object')for(const [key,v] of Object.entries(value)){
      const norm=key.toLowerCase().replace(/[-_ ]/g,'');
      if(GAMEPLAY_KEYS.has(norm)||/(?:damage|attack|hitbox|score|cooldown|speed|power|spawn|probability|luck|seed|difficulty|ammo|stamina|heal|strength|accuracy)/.test(norm))
        throw Error('Prohibited gameplay advantage field: '+key);
      walk(v,depth+1);
    }
  };
  walk(item);
  return true;
}
function visualProjection(item){
  assertVisualOnlyItem(item);
  const {id,slot,assetId=null,variantId=null,materialId=null,animationId=null}=item;
  return Object.freeze({id,slot,assetId,variantId,materialId,animationId});
}
function avatarAppearance(raw={}){
  const result={...DEFAULT_AVATAR};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return Object.freeze(result);
  // Any account can choose appearance, but entitlement checks and ownership
  // are applied by server before an equip is persisted.
  for(const slot of COSMETIC_SLOTS){
    const v=raw[slot];
    if(typeof v==='string'&&/^[a-z0-9][a-z0-9_-]{0,95}$/i.test(v))
      result[slot]=v;
  }
  return Object.freeze(result);
}
function validateCosmeticTrackBoost(entry){
  if(!entry||entry.scope!=='season_cosmetic_track'||
     !Number.isInteger(entry.percent)||entry.percent<0||entry.percent>100)
    throw Error('XP boosts may apply only to cosmetic Season Pass track');
  for(const k of Object.keys(entry))
    if(!['scope','percent','sourceCosmeticId'].includes(k))
      throw Error('Invalid XP boost property: '+k);
  return Object.freeze({scope:entry.scope,percent:entry.percent,
    sourceCosmeticId:String(entry.sourceCosmeticId||'')});
}
module.exports={AVATAR_RIG_ID,DEFAULT_AVATAR,COSMETIC_SLOTS,
  assertVisualOnlyItem,visualProjection,avatarAppearance,validateCosmeticTrackBoost};

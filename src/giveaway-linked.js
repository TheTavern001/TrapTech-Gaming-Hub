'use strict';
// Optional brand/channel promotion for a normal giveaway.
// No subscriber targets, claims, subscription verification or growth promises.
const PLATFORMS=new Set(['potato','telegram','youtube','tiktok','instagram','discord','website','other']);
function safeLink(raw){
  try{
    const u=new URL(String(raw||'').trim());
    if(u.protocol!=='https:'||u.username||u.password||u.href.length>400||!u.hostname.includes('.'))return null;
    if(/^(localhost|127\.\d|0\.0\.0\.0|169\.254\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(u.hostname))return null;
    return u.href;
  }catch{return null;}
}
function normalize(value){
  if(value==null)return [];
  if(!Array.isArray(value)||value.length>1)throw Error('One optional brand channel link may be attached to a giveaway.');
  return value.map(item=>{
    if(!item||typeof item!=='object'||item.kind!=='visit'||item.required===true||item.target!==undefined)
      throw Error('A brand channel link is informational only; subscriber goals and follow requirements are not offered.');
    const label=String(item.label||'').trim().slice(0,90),url=safeLink(item.url);
    if(!label||!url)throw Error('Add a public https:// channel URL and a clear label.');
    return {id:'brand-link',kind:'visit',label,url,platform:PLATFORMS.has(item.platform)?item.platform:'other',required:false};
  });
}
function parse(value){
  try{
    const rows=typeof value==='string'?JSON.parse(value||'[]'):value;
    return Array.isArray(rows)?rows.filter(v=>v&&v.kind==='visit'&&!v.required&&v.target===undefined&&safeLink(v.url))
      .slice(0,1).map(v=>({id:'brand-link',kind:'visit',label:String(v.label||'Brand channel').slice(0,90),url:safeLink(v.url),platform:PLATFORMS.has(v.platform)?v.platform:'other',required:false})):[];
  }catch{return [];}
}
function publicView(value){
  return parse(value).map(({id,label,url,platform})=>({id,kind:'visit',label,url,platform,required:false,verification:'not_required',notice:'Optional brand promotion; subscription is not required to participate.'}));
}
function ensureSchema(db){
  for(const table of ['bookings','giveaways']){
    if(!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name==='linked_requirements'))
      db.exec('ALTER TABLE '+table+" ADD COLUMN linked_requirements TEXT NOT NULL DEFAULT '[]'");
  }
}
module.exports={normalize,parse,publicView,safeLink,ensureSchema};

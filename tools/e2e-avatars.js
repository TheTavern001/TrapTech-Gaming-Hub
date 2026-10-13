// v7 Phase 5 avatars: run on a fresh DB with tools/fresh-api.sh tools/e2e-avatars.js
const BASE = process.env.BASE || 'http://localhost:8787';
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x !== undefined ? JSON.stringify(x).slice(0, 300) : ''); } };
function client() { const jar = {}; return async (p, o = {}) => {
  const res = await fetch(BASE + p, { method: o.method || (o.body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k, v]) => `${k}=${v}`).join('; ') }, body: o.body ? JSON.stringify(o.body) : undefined });
  for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar[kv.slice(0, i)] = kv.slice(i + 1); }
  const ct = res.headers.get('content-type') || ''; return { status: res.status, ct, body: ct.includes('json') ? await res.json() : await res.text() }; }; }
(async () => {
  const ADM = require('./admin-auth').adminClient(BASE); await ADM.login();
  const A = client(); const ua = 'av_' + Math.random().toString(36).slice(2, 8); await A('/api/auth/signup', { body: { username: ua, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } });
  let r = await client()(`/avatar/${ua}.svg`); ok(r.status === 200 && r.ct.includes('image/svg+xml') && r.body.startsWith('<svg') && r.body.length < 8000, 'every player has a default avatar SVG (< 8 KB)', r.body.length);
  const def = r.body; r = await client()('/avatar/nobody_here.svg'); ok(r.status === 200, 'unknown names still get a generated avatar (no broken images)');
  r = await A('/api/avatar'); ok(r.body.ok && r.body.kinds.length === 14 && r.body.parts.length > 75, 'editor lists 14 part kinds including emotes and body build', r.body.parts && r.body.parts.length);
  const P = r.body.parts;
  const starter = r.body.avatar;
  const starterKinds = r.body.kinds.map(kind => P.find(p => p.kind === kind && p.id === starter[kind]));
  ok(starter.gender === 'other' && starter.outfit === 'base' && starter.emote === 'none' && starter.hair === 'waves' && starterKinds.every(p => p && p.owned),
    'unified starter appearance consists entirely of unlocked cosmetic parts', starter);
  const fresh = client(); const ub = 'av2_' + Math.random().toString(36).slice(2, 8);
  await fresh('/api/auth/signup', { body: { username: ub, password: 'hunter2hunter2', agree: true, dob: '1990-05-05' } });
  const second = await fresh('/api/avatar');
  ok(second.body.ok && JSON.stringify(starter) === JSON.stringify(second.body.avatar), 'separate new accounts receive identical starter appearance');
  ok(!P.find(p=>p.kind==='outfit'&&p.id==='adventurer')?.owned
     && P.filter(p=>p.kind==='hair'&&p.owned).length===7
     && P.filter(p=>p.kind==='emote'&&!p.owned).length===5
     && P.filter(p=>['outfit','hat','acc','held'].includes(p.kind)&&p.owned&&!['none','base'].includes(p.id)).length===0,
     'seven free hairstyles, five locked emotes, no free collectible starter outfit or gear');
  const cfg = { ...r.body.avatar, face: 'round', hair: 'curly', hairc: 'c3', skin: 's4' };
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: cfg } }); ok(r.body.ok && r.body.avatar.hair === 'curly', 'free face/skin/hair customization saves');
  r = await client()(`/avatar/${ua}.svg`); ok(r.body !== def, 'the public avatar changes after saving');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, outfit: 'fur' } } }); ok(r.status === 403, 'a Crowns part cannot be worn before it is bought');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, hat: 'crown' } } }); ok(r.status === 403, 'the gold crown is Prestige-only');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, face: 'heart' } } });
  ok(r.status === 403, 'locked premium face cannot be equipped without entitlement');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, emote: 'wave' } } });
  ok(r.status === 403, 'locked emote cannot be equipped without entitlement');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, eyes: 'star' } } }); ok(r.status === 403, 'star eyes need 15 achievements');
  r = await A('/api/avatar/buy', { body: { part: 'outfit:fur' } }); ok(r.status === 400 && /more Hub Crowns/.test(r.body.error), 'buying without Crowns is refused');
  r = await A('/api/avatar/buy-points', { body: { part: 'outfit:fur' } }); ok(r.status === 400 && /Earn .*more Hub Points/.test(r.body.error), 'cannot buy with insufficient gameplay Points');
  r = await A('/api/avatar/buy-points', { body: { part: 'hat:crown' } }); ok(r.status === 400, 'one-of-one Prestige cannot be purchased with farmed Points');
  r = await A('/api/avatar/buy-points', { body: { part: 'hair:waves' } }); ok(r.status === 400, 'already-free starter item is not chargeable');
  ok(P.find(p => p.kind === 'outfit' && p.id === 'fur').points > 0, 'every Crown outfit has an earnable Points price');
  await ADM('/api/admin/store/grant', { body: { username: ua, crowns: 1000 } });
  r = await A('/api/avatar/buy', { body: { part: 'outfit:fur' } }); ok(r.body.ok && r.body.crowns === 100, 'buy the fur coat for 900 Crowns');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, outfit: 'fur' } } }); ok(r.body.ok, 'bought part can be worn');
  r = await A('/api/avatar/buy', { body: { part: 'emote:wave' } });
  ok(r.body.ok, 'emote can be unlocked with Crowns; owned persistently');
  r = await A('/api/avatar', { method: 'PUT', body: { avatar: { ...cfg, outfit: 'fur', emote: 'wave' } } });
  ok(r.body.ok && r.body.avatar.emote==='wave', 'unlocked emote can be saved on profile');
  const emotePreview = await client()('/avatar-preview.svg?c='+encodeURIComponent(JSON.stringify({emote:'wave'})));
  ok(emotePreview.body.includes('animateTransform'), 'wave emote produces animated cosmetic SVG profile motif');
  r = await A('/api/avatar/buy', { body: { part: 'hat:crown' } }); ok(r.status === 400, 'Prestige parts are never sold for Crowns');
  r = await client()('/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify({ hat: 'crown', held: 'cane' }))); ok(r.body.includes('<svg'), 'preview renders any combination (editor only; saving still checks ownership)');
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

// v7 avatar studio: collectible player-card presentation, rarity lighting, presets, and owned-part editor.
let C = null;
const KL = { bg: 'World / aura', skin: 'Skin tone', face: 'Face shape', hair: 'Hair style', hairc: 'Hair color', brow: 'Eyebrows', eyes: 'Eye style', eyec: 'Eye color', mouth: 'Expression', mark: 'Face details', beard: 'Facial hair', piercing: 'Piercings', outfit: 'Outfit / armor', neck: 'Jewelry', hat: 'Headwear', acc: 'Accessories', held: 'Held item' };
const lockText = (p) => p.owned ? 'Owned' : p.unlock.crowns ? `${p.unlock.crowns} Crowns` : p.unlock.ach ? `${p.unlock.ach} achievements` : p.unlock.prestige ? 'Prestige exclusive' : 'Locked';
const PRESETS = [
  { id:'neon-runner', name:'Neon Runner', rarity:'RARE', cfg:{bg:'violet',face:'oval',hair:'spiky',hairc:'c7',outfit:'jersey',hat:'snapback',acc:'shades',held:'controller'} },
  { id:'night-ops', name:'Night Ops', rarity:'EPIC', cfg:{bg:'night',face:'square',hair:'buzz',hairc:'c1',outfit:'hoodie',hat:'beanie',acc:'glasses',held:'controller'} },
  { id:'ocean-ace', name:'Ocean Ace', rarity:'RARE', cfg:{bg:'ocean',face:'round',hair:'waves',hairc:'c5',outfit:'tracksuit',hat:'none',acc:'none',held:'controller'} },
  { id:'gold-legend', name:'Gold Legend', rarity:'LEGENDARY', cfg:{bg:'gold-rays',face:'oval',hair:'mohawk',hairc:'c4',outfit:'fur',hat:'crown',acc:'shades',held:'cane'} }
];
const FREE_FALLBACK = { bg:'violet',face:'round',hair:'waves',hairc:'c0',outfit:'hoodie',hat:'none',acc:'none',held:'none' };

// The primary studio preview is a real, animated 3D character. The existing SVG remains a graceful fallback.
let avatarViewer = null;
let avatarModelPromise = null;
const AV_SKIN = ['#f9d7b9','#f1c19b','#e0a679','#c98a5b','#a8693f','#8a5232','#6b3d22','#4a2915'];
const AV_HAIR = ['#1b1b1f','#4a2f1d','#7b4a24','#c58b3c','#e8c46a','#d9d4cc','#c2410c','#7c3aed','#22d3ee','#16a34a'];
const AV_OUTFIT = {
  tee:'#3b82f6', hoodie:'#334155', jersey:'#dc2626', tracksuit:'#111827', 'chain-tee':'#f8fafc',
  fur:'#a16207', armor:'#475569', techwear:'#111827', varsity:'#7c2d12'
};
function avDisposeModel(model) {
  if (!model) return;
  model.traverse(o => { if (o.isMesh) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m && m.dispose && m.dispose()); } });
}
function avBuildCharacter(viewer, gltf, cfg, T, SkeletonUtils, Runner) {
  const model = SkeletonUtils.clone(gltf.scene);
  Runner.pbrChar(model);
  const outfit = AV_OUTFIT[cfg.outfit] || AV_OUTFIT.hoodie;
  const hair = AV_HAIR[Number(String(cfg.hairc || 'c0').slice(1))] || AV_HAIR[0];
  Runner.outfit(model, { top: outfit, top2: cfg.outfit === 'armor' ? '#22d3ee' : outfit, pants:'#182037', shoes:'#101522', sole:'#dbe5f7', hair, sleeve:0.72 });
  const skin = AV_SKIN[Number(String(cfg.skin || 's2').slice(1))] || AV_SKIN[2];
  model.traverse(o => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) {
      if (!mat) continue;
      const name = (o.name + ' ' + (mat.name || '')).toLowerCase();
      if (/skin|face|body_skin/.test(name) && mat.color) mat.color.set(skin);
      if (/hair|brow/.test(name) && mat.color) mat.color.set(hair);
      if (/chain|metal|accessory/.test(name) && mat.metalness !== undefined) mat.metalness = 0.72;
    }
  });
  const bounds = new T.Box3().setFromObject(model);
  const height = Math.max(0.1, bounds.getSize(new T.Vector3()).y);
  model.scale.setScalar(2.12 / height);
  const fitBounds = new T.Box3().setFromObject(model);
  model.position.y -= fitBounds.min.y;
  viewer.scene.add(model);
  if (viewer.model) { viewer.scene.remove(viewer.model); avDisposeModel(viewer.model); }
  viewer.model = model;
  viewer.mixer = gltf.animations && gltf.animations.length ? new T.AnimationMixer(model) : null;
  if (viewer.mixer) viewer.mixer.clipAction(gltf.animations[0]).play();
  viewer.cfg = { ...cfg };
}
async function mountAvatarPreview(cfg) {
  let canvas = document.getElementById('avatar-3d-preview');
  if (!canvas) return;
  const fallback = document.getElementById('av-prev');
  if (avatarViewer) {
    if (avatarViewer.canvas !== canvas) canvas.replaceWith(avatarViewer.canvas);
    avatarViewer.cfg = { ...cfg };
    if (avatarViewer.failed) { avatarViewer.canvas.style.display='none'; const img=document.getElementById('av-prev'); if(img) img.style.display='block'; }
    else { avatarViewer.canvas.style.display='block'; const img=document.getElementById('av-prev'); if(img) img.style.display='none'; }
    if (avatarViewer.model && avatarViewer.modules && avatarViewer.gltf) avBuildCharacter(avatarViewer, avatarViewer.gltf, avatarViewer.cfg, avatarViewer.modules.T, avatarViewer.modules.SkeletonUtils, avatarViewer.modules.Runner);
    if (avatarViewer.startLoop) avatarViewer.startLoop();
    return;
  }
  const viewer = avatarViewer = { canvas, cfg:{...cfg}, model:null, mixer:null, raf:0, failed:false, modules:null, gltf:null };
  try {
    const [T, GLTFMod, MeshoptMod, RoomMod, SkeletonMod, Runner] = await Promise.all([
      import('three'),
      import('three/addons/loaders/GLTFLoader.js'),
      import('three/addons/libs/meshopt_decoder.module.js'),
      import('three/addons/environments/RoomEnvironment.js'),
      import('three/addons/utils/SkeletonUtils.js'),
      import('../games-lib/runner3x.js')
    ]);
    if (avatarViewer !== viewer) return;
    const GLTFLoader = GLTFMod.GLTFLoader, MeshoptDecoder = MeshoptMod.MeshoptDecoder;
    const renderer = new T.WebGLRenderer({ canvas:viewer.canvas, alpha:true, antialias:true, powerPreference:'high-performance' });
    renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    const pmrem = new T.PMREMGenerator(renderer);
    const room = new RoomMod.RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    pmrem.dispose();
    const hemi = new T.HemisphereLight('#f5f7ff','#252b4a',1.65); scene.add(hemi);
    const key = new T.DirectionalLight('#fff0d9',3.1); key.position.set(-3.2,5,4); key.castShadow=true; key.shadow.mapSize.set(1024,1024); scene.add(key);
    const rim = new T.PointLight('#8b5cf6',36,9); rim.position.set(2.2,2.4,-1.4); scene.add(rim);
    const fill = new T.PointLight('#22d3ee',18,8); fill.position.set(-2,1.4,2); scene.add(fill);
    const camera = new T.PerspectiveCamera(34,1,0.1,50); camera.position.set(0,1.18,4.6); camera.lookAt(0,1.02,0);
    const ring = new T.Mesh(new T.TorusGeometry(0.92,0.014,8,88),new T.MeshStandardMaterial({color:'#8b5cf6',metalness:0.72,roughness:0.25,emissive:'#4c1d95',emissiveIntensity:0.55}));
    ring.rotation.x=Math.PI/2; ring.position.y=0.035; scene.add(ring);
    const disc = new T.Mesh(new T.CircleGeometry(0.91,64),new T.MeshStandardMaterial({color:'#111832',metalness:0.18,roughness:0.62,transparent:true,opacity:0.82}));
    disc.rotation.x=-Math.PI/2; disc.position.y=0.025; scene.add(disc);
    const resize = () => { const box=viewer.canvas.getBoundingClientRect(); const w=Math.max(1,Math.floor(box.width)),h=Math.max(1,Math.floor(box.height)); if(renderer.domElement.width!==Math.floor(w*renderer.getPixelRatio())||renderer.domElement.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();} };
    viewer.modules={T,SkeletonUtils:SkeletonMod,Runner}; viewer.renderer=renderer; viewer.scene=scene; viewer.camera=camera; viewer.resize=resize; viewer.ring=ring;
    if (!avatarModelPromise) { const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); avatarModelPromise=loader.loadAsync('/games-lib/assets3d/hero.glb'); }
    const gltf=await avatarModelPromise;
    if (avatarViewer !== viewer) return;
    viewer.gltf=gltf; avBuildCharacter(viewer,gltf,viewer.cfg,T,SkeletonMod,Runner);
    const clock=new T.Clock();
    const loop=()=>{ if(avatarViewer!==viewer)return; if(!viewer.canvas.isConnected){viewer.raf=0;return;} viewer.raf=requestAnimationFrame(loop); const dt=Math.min(0.04,clock.getDelta()); if(viewer.mixer)viewer.mixer.update(dt); if(viewer.model&&!viewer.mixer)viewer.model.rotation.y=Math.sin(performance.now()*0.00035)*0.16; viewer.ring.rotation.z+=dt*0.12; resize(); renderer.render(scene,camera); };
    viewer.startLoop=()=>{ if(!viewer.raf) viewer.raf=requestAnimationFrame(loop); }; viewer.startLoop();
    const img=document.getElementById('av-prev'); if(img)img.style.display='none';
  } catch (err) {
    console.error('3D avatar preview unavailable',err);
    if (avatarViewer===viewer) { viewer.failed=true; viewer.canvas.style.display='none'; const img=document.getElementById('av-prev'); if(img)img.style.display='block'; }
  }
}
async function editor() {
  const { icon, esc, api, S } = C; if (!S.me) return C.go('/signin?next=/avatar', true);
  const r = await api('/api/avatar'); if (!r.ok) return C.shell('/settings', C.emptyState('user', 'Avatar studio unavailable', 'Please sign in again and retry.'));
  const profileResponse = await api('/api/profile/' + encodeURIComponent(S.me.username));
  const profile = profileResponse.ok ? profileResponse.profile : null;
  const cfg = { ...r.avatar }; let tab = 'hair'; let crowns = r.crowns; let activePreset = '';
  const partOwned = (kind,id) => r.parts.some(p=>p.kind===kind&&p.id===id&&p.owned);
  const applyPreset = (preset) => { const next={...cfg}; for(const [k,id] of Object.entries(preset.cfg)) if(partOwned(k,id)) next[k]=id; Object.assign(cfg,next); activePreset=preset.id; };
  const prev = (c) => '/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify(c));
  const cardMarkup = () => {
    const rarity = cfg.bg === 'gold-rays' || cfg.hat === 'crown' ? 'legendary' : cfg.acc === 'grill' || cfg.outfit === 'fur' ? 'epic' : cfg.outfit === 'jersey' || cfg.held === 'controller' ? 'rare' : 'common';
    return `<div class="avatar-collect-card rarity-${rarity}">
      <div class="avatar-card-top"><span class="avatar-rarity">${rarity.toUpperCase()} PLAYER CARD</span><span class="avatar-live-dot">● ONLINE PROFILE</span></div>
      <div class="avatar-card-art"><div class="avatar-orbit orbit-one"></div><div class="avatar-orbit orbit-two"></div><canvas id="avatar-3d-preview" class="avatar-3d-canvas" aria-label="Animated 3D player character"></canvas><img id="av-prev" src="${prev(cfg)}" alt="Avatar preview fallback" style="display:none"><span class="avatar-card-id">${esc(S.me.user_id || 'TH-PLAYER')}</span></div>
      <div class="avatar-card-info"><div><span class="avatar-card-kicker">THE GAMING HUB</span><h2>${esc(S.me.username || 'Player')}</h2><p>${S.me.founder ? '<span class="avatar-founder">♛ FOUNDER</span>' : '<span class="avatar-member">✦ PLAYER</span>'} <span class="avatar-equipped">${esc(cfg.outfit || 'custom')} loadout</span></p></div><div class="avatar-mini-emblem">${S.me.founder ? '♛' : '✦'}</div></div>
      <div class="avatar-card-progress">
        <div class="avatar-level-line"><span>LEVEL ${profile ? profile.level.level : 1}</span><span>${profile ? C.fmt(profile.level.into) + ' / ' + C.fmt(profile.level.need) + ' XP' : 'PLAYER PROGRESSION'}</span></div>
        <div class="avatar-xp-track"><i style="width:${profile ? Math.max(0,Math.min(100,Math.round(profile.level.into/profile.level.need*100))) : 0}%"></i></div>
      </div>
      <div class="avatar-card-stats">
        <div><b>${profile ? C.fmt(profile.total_score) : '—'}</b><span>TOTAL SCORE</span></div>
        <div><b>${profile ? C.fmt(profile.games_played) : '—'}</b><span>GAMES PLAYED</span></div>
        <div><b>${profile ? C.fmt(profile.giveaways_won) : '—'}</b><span>GIVEAWAYS WON</span></div>
        <div><b>${profile ? profile.achievements.length + '/' + profile.achievements_total : '—'}</b><span>ACHIEVEMENTS</span></div>
      </div>
      <div class="avatar-card-record">
        <div><span>GIVEAWAYS ENTERED</span><b>${profile ? C.fmt(profile.giveaways_entered || 0) : '—'}</b></div>
        <div><span>FOLLOWERS</span><b>${profile ? C.fmt(profile.followers || 0) : '—'}</b></div>
        <div><span>BEST GAME</span><b>${profile && profile.best_by_game && profile.best_by_game.length ? esc(profile.best_by_game[0].game_title) : 'Not set'}</b></div>
        <div><span>DAILY STREAK</span><b>${profile ? C.fmt(profile.streak.current || 0) + ' days' : '—'}</b></div>
      </div>
      <div class="avatar-card-footer"><span>COLLECT • CUSTOMIZE • COMPETE</span><span>${profile && profile.global_rank ? 'GLOBAL RANK #' + profile.global_rank : 'PROFILE COSMETICS'}</span></div>
    </div>`;
  };
  const draw = (msg = '') => {
    const parts = r.parts.filter(p => p.kind === tab);
    C.shell('/settings', `<div class="narrow avatar-ed avatar-studio">
      ${C.pageHead('Avatar Studio', 'Build a collectible player identity. Your avatar, profile card and cosmetic loadout travel with you across the Hub.')}
      <div class="avatar-studio-grid">
        <section class="avatar-preview-column">
          ${cardMarkup()}
          <div class="avatar-preview-actions"><div class="avatar-wallet"><span class="avatar-wallet-icon">✦</span><div><small>HUB CROWNS</small><b>${C.fmt(crowns)}</b></div><a href="/shop">Earn / browse cosmetics ↗</a></div><button class="btn avatar-save" id="av-save">${icon('check')} Save player identity</button><div id="av-msg" aria-live="polite">${msg}</div></div>
          <div class="avatar-presets card pad"><div class="avatar-section-head"><div><span class="avatar-card-kicker">QUICK LOADOUTS</span><h3>Character presets</h3></div><span class="tiny muted">${r.parts.filter(p=>p.owned).length} owned · ${r.parts.length} total collectibles</span></div><div class="avatar-preset-grid">${PRESETS.map(p=>`<button type="button" class="avatar-preset ${activePreset===p.id?'on':''} preset-${p.rarity.toLowerCase()}" data-preset="${p.id}"><img src="${prev({...cfg,...Object.fromEntries(Object.entries(p.cfg).filter(([k,id])=>partOwned(k,id)))})}" alt="" loading="lazy"><span class="preset-rarity">${p.rarity}</span><b>${p.name}</b><small>Apply owned pieces</small></button>`).join('')}</div></div>
        </section>
        <section class="avatar-inventory card pad"><div class="avatar-section-head"><div><span class="avatar-card-kicker">COSMETIC INVENTORY</span><h3>Customize each detail</h3><p class="small muted">Build a signature character from facial features, hair, skin tone, outfits, accessories, headwear, held items and card effects. Every locked item shows its exact requirement or Crown price before you unlock it.</p></div></div>
          <div class="tabs av-tabs" role="tablist" aria-label="Avatar customization categories">${r.kinds.map(k=>`<button class="tab ${k===tab?'on':''}" data-tab="${k}" role="tab" aria-selected="${k===tab}">${esc(KL[k]||k)}</button>`).join('')}</div>
          <div class="avatar-inventory-summary"><span>${parts.filter(p=>p.owned).length} owned in this category</span><span>${parts.length} total parts</span></div>
          <div class="av-grid">${parts.map(p=>{const c2={...cfg,[p.kind]:p.id};return `<button type="button" class="av-opt ${cfg[p.kind]===p.id?'on':''} ${p.owned?'':'locked'} ${p.unlock.prestige?'prestige':''}" data-k="${p.kind}" data-id="${esc(p.id)}" title="${esc(p.label)}"><img src="${prev(c2)}" alt="" loading="lazy" width="76" height="76"><span class="small">${esc(p.label)}</span><span class="avatar-part-status ${p.owned?'owned':'locked'}">${p.owned?'✓ OWNED':icon('lock')+' '+esc(lockText(p))}</span></button>`;}).join('')}</div>
        </section>
      </div>
    </div>`, { title: 'Avatar Studio' });
    mountAvatarPreview(cfg);
    document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;draw();});
    document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{const p=PRESETS.find(x=>x.id===b.dataset.preset);if(p)applyPreset(p);draw();});
    document.querySelectorAll('.av-opt').forEach(b=>b.onclick=async()=>{const p=r.parts.find(x=>x.kind===b.dataset.k&&x.id===b.dataset.id);if(!p)return;
      if(!p.owned){if(!p.unlock.crowns)return C.toast(`Unlock requirement: ${lockText(p)}`);if(!confirm(`Unlock "${p.label}" for ${p.unlock.crowns} Hub Crowns?`))return;const x=await api('/api/avatar/buy',{method:'POST',body:{part:p.kind+':'+p.id}});if(!x.ok)return C.toast(x.error);p.owned=true;crowns=x.crowns;}
      cfg[p.kind]=p.id;activePreset='';draw();
    });
    document.getElementById('av-save').onclick=async()=>{const x=await api('/api/avatar',{method:'PUT',body:{avatar:cfg}});if(!x.ok)return draw(`<div class="err">${esc(x.error)}</div>`);C.bumpAvatar(S.me.username);draw('<div class="ok-msg">Saved. Your player card and avatar are updated across the Hub.</div>');};
  };
  draw();
}
export function install(ctx) { C = ctx; ctx.route(/^\/avatar$/, editor); }

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
      <div class="avatar-card-art"><div class="avatar-orbit orbit-one"></div><div class="avatar-orbit orbit-two"></div><img id="av-prev" src="${prev(cfg)}" alt="Live avatar preview"><span class="avatar-card-id">${esc(S.me.user_id || 'TH-PLAYER')}</span></div>
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
          <div class="avatar-presets card pad"><div class="avatar-section-head"><div><span class="avatar-card-kicker">QUICK LOADOUTS</span><h3>Character presets</h3></div><span class="tiny muted">Owned items only</span></div><div class="avatar-preset-grid">${PRESETS.map(p=>`<button type="button" class="avatar-preset ${activePreset===p.id?'on':''} preset-${p.rarity.toLowerCase()}" data-preset="${p.id}"><img src="${prev({...cfg,...Object.fromEntries(Object.entries(p.cfg).filter(([k,id])=>partOwned(k,id)))})}" alt="" loading="lazy"><span class="preset-rarity">${p.rarity}</span><b>${p.name}</b><small>Apply owned pieces</small></button>`).join('')}</div></div>
        </section>
        <section class="avatar-inventory card pad"><div class="avatar-section-head"><div><span class="avatar-card-kicker">COSMETIC INVENTORY</span><h3>Customize each detail</h3><p class="small muted">Choose a part to preview it live. Locked items show the exact unlock condition.</p></div></div>
          <div class="tabs av-tabs" role="tablist" aria-label="Avatar customization categories">${r.kinds.map(k=>`<button class="tab ${k===tab?'on':''}" data-tab="${k}" role="tab" aria-selected="${k===tab}">${esc(KL[k]||k)}</button>`).join('')}</div>
          <div class="avatar-inventory-summary"><span>${parts.filter(p=>p.owned).length} owned in this category</span><span>${parts.length} total parts</span></div>
          <div class="av-grid">${parts.map(p=>{const c2={...cfg,[p.kind]:p.id};return `<button type="button" class="av-opt ${cfg[p.kind]===p.id?'on':''} ${p.owned?'':'locked'} ${p.unlock.prestige?'prestige':''}" data-k="${p.kind}" data-id="${esc(p.id)}" title="${esc(p.label)}"><img src="${prev(c2)}" alt="" loading="lazy" width="76" height="76"><span class="small">${esc(p.label)}</span><span class="avatar-part-status ${p.owned?'owned':'locked'}">${p.owned?'✓ OWNED':icon('lock')+' '+esc(lockText(p))}</span></button>`;}).join('')}</div>
        </section>
      </div>
    </div>`, { title: 'Avatar Studio' });
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

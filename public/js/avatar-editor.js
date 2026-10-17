// V1 avatar editor: interactive WebGL preview with the existing SVG renderer as a compatibility fallback.
import { mountAvatar3D, supportsRiggedAvatar } from './avatar-3d.js';
let avatarCleanup = null;
let C = null;
const KL = { bg: 'Background', skin: 'Skin · free', face: 'Face · free', hair: 'Hair', hairc: 'Hair color', eyes: 'Eyes · free', mouth: 'Mouth · free', beard: 'Facial hair · free', build: 'Body build', outfit: 'Outfit', hat: 'Hat', acc: 'Accessory', held: 'Held item', emote: 'Emotes' };
const lockText = (p) => p.owned ? '' : p.unlock.prestige ? 'Prestige: not available until certified' : p.unlock.ach ? `${p.unlock.ach} achievements or ${p.credits} Credits` : `Unlock for ${p.credits} Hub Credits (earn or buy optional Credits)`;
// The selection grid must spotlight the ITEM, not reproduce an almost-identical smiley
// head 150 times. Reuse licensed first-party game artwork for suitable props, then
// show a clearly labeled slot icon/material; the live 3D stage remains the actual preview.
const ITEM_ART = {
  // Only exact object matches from the Hub's existing approved game art library.
  'held:controller': '/assets/v5/mm-controller.webp',
  'held:headphones': '/assets/v5/mm-headphones.webp'
};
const SLOT_ICONS = { emote:'smile', bg:'image',skin:'palette',face:'user',hair:'sparkles',hairc:'palette',
  eyes:'eye',mouth:'user',beard:'user',build:'users',outfit:'user',hat:'crown',acc:'gem',held:'package' };
const PROP_ICONS = { none:'circle-slash',controller:'gamepad-2',cane:'wand-sparkles',cash:'banknote',
 microphone:'music',wrench:'cog',sprout:'leaf',stethoscope:'heart-pulse',pitchfork:'leaf',
 syringe:'heart-pulse',headphones:'music',toolbox:'briefcase',laptop:'monitor-smartphone',
 briefcase:'briefcase',camera:'image',paintbrush:'paintbrush','spray-can':'paintbrush',
 'cash-bag':'wallet',flower:'leaf' };
const itemArt = (p, cfg, palette, icon) => {
  const art = ITEM_ART[p.kind+':'+p.id];
  const accent = p.kind === 'skin' ? palette.skin?.[Number(p.id.slice(1))] : p.kind === 'hairc' ? palette.hair_colors?.[Number(p.id.slice(1))] : null;
  const bg = p.kind === 'bg' && palette.bg?.[p.id];
  if (bg) return `<span class="av-item-visual av-item-bg" style="background:linear-gradient(135deg,${bg[0]},${bg[1]})">${icon('sparkles')}</span>`;
  if (accent) return `<span class="av-item-visual av-item-swatch" style="--sample:${accent}"><i></i>${icon(p.kind==='skin'?'user':'palette')}</span>`;
  if (art && p.id !== 'none') return `<span class="av-item-visual av-item-asset"><img src="${art}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>`;
  const kindIcon = p.kind === 'held' ? (PROP_ICONS[p.id] || 'package') : SLOT_ICONS[p.kind] || 'gem';
  return `<span class="av-item-visual av-item-symbol">${icon(kindIcon)}<small>${String(p.id).replace(/-/g,' ').slice(0,22)}</small></span>`;
};
async function editor() {
  const { icon, esc, api, S } = C; if (!S.me) return C.go('/signin?next=/avatar', true);
  const r = await api('/api/avatar'); if (!r.ok) return C.shell('/settings', C.emptyState('user', 'Avatar unavailable', ''));
  const cfg = { ...r.avatar }; let tab = 'skin'; let credits = r.credits ?? r.points ?? 0;
  const selectedPart = () => r.parts.find(p => p.kind === tab && p.id === cfg[tab]);
  const pendingUnlocks = () => r.parts.filter(p => cfg[p.kind] === p.id && !p.owned);
  const prev = (c) => '/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify(c));
  const draw = (msg = '') => {
    if (avatarCleanup) { avatarCleanup(); avatarCleanup = null; }
    const parts = r.parts.filter(p => p.kind === tab);
    const selected = selectedPart(), locked = pendingUnlocks();
    const details = selected ? (selected.owned ? 'Ready to equip' : lockText(selected)) : 'Select an item to preview';
    const rigAvailable = supportsRiggedAvatar(cfg);
    const modelStatus = rigAvailable
      ? '<span class="av-model-status source">Licensed rigged 3D model · animated source art</span>'
      : '';
    const showStarter = JSON.stringify(cfg) !== JSON.stringify(r.starter);
    C.shell('/settings', `<div class="narrow avatar-ed">${C.pageHead('Your avatar', 'Shown on boards, profiles and winner lists. Cosmetic only.')}
      <div class="av-ed"><div class="av-prev card pad"><div id="avatar-stage" class="avatar-stage" aria-label="Interactive 3D avatar preview"></div><img id="av-prev" src="${prev(cfg)}" alt="Avatar preview" width="220" height="220" style="display:none"><p class="tiny muted">Drag the 3D character to rotate it. Cosmetic only.</p>${modelStatus}<div class="av-selection"><b>${esc(selected?.label || 'Starter option')}</b><span class="tiny ${selected?.owned ? 'ok' : 'lock'}">${esc(details)}</span></div>${showStarter ? '<button class="btn sm ghost" type="button" id="av-reset-starter">Preview shared starter avatar</button>' : ''}<div class="av-balances"><span>Hub Credits <b>${C.fmt(credits)}</b></span><a href="/store" class="small">Get Credits</a></div>${selected && !selected.owned && Number.isFinite(selected.credits) && selected.credits > 0 ? `<button class="btn av-buy-credits" id="av-buy-credits" type="button">${icon('gamepad-2')} Unlock for ${C.fmt(selected.credits)} Credits</button>` : ''}<button class="btn" id="av-save" type="button" ${locked.length ? 'disabled aria-disabled="true"' : ''}>${icon('check')} Save avatar</button>${locked.length ? '<p class="tiny muted">Save is available after you equip only unlocked items.</p>' : ''}<div id="av-msg">${msg}</div></div>
      <div class="card pad"><div class="avatar-gender" role="group" aria-label="Avatar presentation"><span class="small muted">Presentation</span>${[["male","Male"],["female","Female"],["other","Other"]].map(([id,label]) => `<button type="button" class="btn ${cfg.gender === id ? "on" : ""}" data-gender="${id}" aria-pressed="${cfg.gender === id}">${label}</button>`).join("")}</div><div class="tabs av-tabs" role="tablist">${r.kinds.map(k => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${esc(KL[k] || k)}</button>`).join('')}</div>
        <div class="av-grid">${parts.map(p => { const c2 = { ...cfg, [p.kind]: p.id }; return `<button type="button" class="av-opt ${cfg[p.kind] === p.id ? 'on' : ''} ${p.owned ? '' : 'locked'}" data-k="${p.kind}" data-id="${esc(p.id)}" aria-pressed="${cfg[p.kind] === p.id}" title="Preview ${esc(p.label)}">${itemArt(p, c2, r, icon)}<span class="small">${esc(p.label)}</span><span class="tiny ${p.owned ? 'muted' : 'lock'}">${p.owned ? 'Owned / unlocked' : `${icon('lock')} ${esc(lockText(p))}`}</span></button>`; }).join('')}</div></div></div></div>`, { title: 'Avatar' });
    const stage = document.getElementById('avatar-stage'); const fallback = document.getElementById('av-prev');
    if (stage) mountAvatar3D(stage, cfg).then(cleanup => { if (stage.isConnected) avatarCleanup = cleanup; else cleanup(); }).catch(() => { if (stage.isConnected) { stage.style.display = 'none'; if (fallback) fallback.style.display = 'block'; } });
    document.querySelectorAll('[data-gender]').forEach(b => b.onclick = () => { cfg.gender = b.dataset.gender; draw(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    document.querySelectorAll('.av-opt').forEach(b => b.onclick = () => {
      // A preview never purchases, unlocks or equips on the server.
      cfg[b.dataset.k] = b.dataset.id; draw();
    });
    const reset = document.getElementById('av-reset-starter');
    if (reset) reset.onclick = () => { Object.assign(cfg, r.starter); tab = 'skin'; draw('<div class="ok-msg">Previewing the new starter. Tap Save to equip it.</div>'); };
    const buyCredits = document.getElementById('av-buy-credits');
    if (buyCredits) buyCredits.onclick = async () => {
      const p = selectedPart();
      if (!p || p.owned || !Number.isSafeInteger(p.credits) || p.credits <= 0) return;
      if (!confirm(`Unlock "${p.label}" for ${p.credits} Hub Credits? Cosmetic only; no gameplay advantage.`)) return;
      buyCredits.disabled = true;
      try {
        const x = await api('/api/avatar/buy-credits', { method: 'POST', body: { part: p.kind + ':' + p.id } });
        if (!x.ok) return C.toast(x.error || 'Unable to unlock item');
        p.owned = true; credits = x.credits;
        draw('<div class="ok-msg">Unlocked with Hub Credits. Save to equip on your profile.</div>');
      } finally { if (buyCredits.isConnected) buyCredits.disabled = false; }
    };
    document.getElementById('av-save').onclick = async () => {
      if (pendingUnlocks().length) return C.toast('Choose unlocked items or buy them before saving.');
      const x = await api('/api/avatar', { method: 'PUT', body: { avatar: cfg } });
      if (!x.ok) return draw(`<div class="err">${esc(x.error)}</div>`);
      C.bumpAvatar(S.me.username); draw('<div class="ok-msg">Saved. Your avatar now updates across the Hub.</div>');
    };
  };
  draw();
}
export function install(ctx) { C = ctx; ctx.route(/^\/avatar$/, editor); }

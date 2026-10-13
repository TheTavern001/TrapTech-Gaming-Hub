// V1 avatar editor: interactive WebGL preview with the existing SVG renderer as a compatibility fallback.
import { mountAvatar3D } from './avatar-3d.js';
let avatarCleanup = null;
let C = null;
const KL = { bg: 'Background', skin: 'Skin', face: 'Face', hair: 'Hair', hairc: 'Hair color', eyes: 'Eyes', mouth: 'Mouth', beard: 'Facial hair', build: 'Body build', outfit: 'Outfit', hat: 'Hat', acc: 'Accessory', held: 'Held item' };
const lockText = (p) => p.owned ? '' : p.unlock.crowns ? `${p.unlock.crowns} Crowns` : p.unlock.ach ? `${p.unlock.ach} achievements` : p.unlock.prestige ? 'Prestige owners' : 'Locked';
async function editor() {
  const { icon, esc, api, S } = C; if (!S.me) return C.go('/signin?next=/avatar', true);
  const r = await api('/api/avatar'); if (!r.ok) return C.shell('/settings', C.emptyState('user', 'Avatar unavailable', ''));
  const cfg = { ...r.avatar }; let tab = 'outfit'; let crowns = r.crowns;
  const selectedPart = () => r.parts.find(p => p.kind === tab && p.id === cfg[tab]);
  const pendingUnlocks = () => r.parts.filter(p => cfg[p.kind] === p.id && !p.owned);
  const prev = (c) => '/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify(c));
  const draw = (msg = '') => {
    if (avatarCleanup) { avatarCleanup(); avatarCleanup = null; }
    const parts = r.parts.filter(p => p.kind === tab);
    const selected = selectedPart(), locked = pendingUnlocks();
    const details = selected ? (selected.owned ? 'Ready to equip' : lockText(selected)) : 'Select an item to preview';
    C.shell('/settings', `<div class="narrow avatar-ed">${C.pageHead('Your avatar', 'Shown on boards, profiles and winner lists. Cosmetic only.')}
      <div class="av-ed"><div class="av-prev card pad"><div id="avatar-stage" class="avatar-stage" aria-label="Interactive 3D avatar preview"></div><img id="av-prev" src="${prev(cfg)}" alt="Avatar preview" width="220" height="220" style="display:none"><p class="tiny muted">Drag to rotate. Preview items before spending any Crowns.</p><div class="av-selection"><b>${esc(selected?.label || 'Starter outfit')}</b><span class="tiny ${selected?.owned ? 'ok' : 'lock'}">${esc(details)}</span></div><div class="small muted">Hub Crowns: <b>${C.fmt(crowns)}</b></div>${selected && !selected.owned && selected.unlock.crowns ? `<button class="btn av-buy" id="av-buy" type="button">${icon('shopping-bag')} Buy ${esc(selected.label)} · ${C.fmt(selected.unlock.crowns)} Crowns</button>` : ''}<button class="btn" id="av-save" type="button" ${locked.length ? 'disabled aria-disabled="true"' : ''}>${icon('check')} Save avatar</button>${locked.length ? '<p class="tiny muted">Save is available after you equip only unlocked items.</p>' : ''}<div id="av-msg">${msg}</div></div>
      <div class="card pad"><div class="avatar-gender" role="group" aria-label="Avatar presentation"><span class="small muted">Presentation</span>${[["male","Male"],["female","Female"],["other","Other"]].map(([id,label]) => `<button type="button" class="btn ${cfg.gender === id ? "on" : ""}" data-gender="${id}" aria-pressed="${cfg.gender === id}">${label}</button>`).join("")}</div><div class="tabs av-tabs" role="tablist">${r.kinds.map(k => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${esc(KL[k] || k)}</button>`).join('')}</div>
        <div class="av-grid">${parts.map(p => { const c2 = { ...cfg, [p.kind]: p.id }; return `<button type="button" class="av-opt ${cfg[p.kind] === p.id ? 'on' : ''} ${p.owned ? '' : 'locked'}" data-k="${p.kind}" data-id="${esc(p.id)}" aria-pressed="${cfg[p.kind] === p.id}" title="Preview ${esc(p.label)}"><img src="${prev(c2)}" alt="" loading="lazy" width="72" height="72"><span class="small">${esc(p.label)}</span><span class="tiny ${p.owned ? 'muted' : 'lock'}">${p.owned ? 'Owned / unlocked' : `${icon('lock')} ${esc(lockText(p))}`}</span></button>`; }).join('')}</div></div></div></div>`, { title: 'Avatar' });
    const stage = document.getElementById('avatar-stage'); const fallback = document.getElementById('av-prev');
    if (stage) mountAvatar3D(stage, cfg).then(cleanup => { if (stage.isConnected) avatarCleanup = cleanup; else cleanup(); }).catch(() => { if (stage.isConnected) { stage.style.display = 'none'; if (fallback) fallback.style.display = 'block'; } });
    document.querySelectorAll('[data-gender]').forEach(b => b.onclick = () => { cfg.gender = b.dataset.gender; draw(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    document.querySelectorAll('.av-opt').forEach(b => b.onclick = () => {
      // A preview never purchases, unlocks or equips on the server.
      cfg[b.dataset.k] = b.dataset.id; draw();
    });
    const buy = document.getElementById('av-buy');
    if (buy) buy.onclick = async () => {
      const p = selectedPart();
      if (!p || p.owned || !p.unlock.crowns) return;
      if (!confirm(`Buy "${p.label}" for ${p.unlock.crowns} Hub Crowns? This only changes your appearance.`)) return;
      buy.disabled = true;
      try {
        const x = await api('/api/avatar/buy', { method: 'POST', body: { part: p.kind + ':' + p.id } });
        if (!x.ok) { C.toast(x.error || 'Could not complete purchase'); return; }
        p.owned = true; crowns = x.crowns;
        draw('<div class="ok-msg">Unlocked. Save to equip on your profile.</div>');
      } finally { if (buy.isConnected) buy.disabled = false; }
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

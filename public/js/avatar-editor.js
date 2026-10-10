// v7 Phase 5: avatar editor (/avatar). Live preview through /avatar-preview.svg; the server checks ownership on save.
let C = null;
const KL = { bg: 'Background', skin: 'Skin', face: 'Face', hair: 'Hair', hairc: 'Hair color', eyes: 'Eyes', mouth: 'Mouth', beard: 'Facial hair', outfit: 'Outfit', hat: 'Hat', acc: 'Accessory', held: 'Held item' };
const lockText = (p) => p.owned ? '' : p.unlock.crowns ? `${p.unlock.crowns} Crowns` : p.unlock.ach ? `${p.unlock.ach} achievements` : p.unlock.prestige ? 'Prestige owners' : 'Locked';
async function editor() {
  const { icon, esc, api, S } = C; if (!S.me) return C.go('/signin?next=/avatar', true);
  const r = await api('/api/avatar'); if (!r.ok) return C.shell('/settings', C.emptyState('user', 'Avatar unavailable', ''));
  const cfg = { ...r.avatar }; let tab = 'hair'; let crowns = r.crowns;
  const prev = (c) => '/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify(c));
  const draw = (msg = '') => {
    const parts = r.parts.filter(p => p.kind === tab);
    C.shell('/settings', `<div class="narrow avatar-ed">${C.pageHead('Your avatar', 'Shown on boards, profiles and winner lists. Cosmetic only.')}
      <div class="av-ed"><div class="av-prev card pad"><img id="av-prev" src="${prev(cfg)}" alt="Avatar preview" width="220" height="220"><div class="small muted">Hub Crowns: <b>${C.fmt(crowns)}</b></div><button class="btn" id="av-save">${icon('check')} Save avatar</button><div id="av-msg">${msg}</div></div>
      <div class="card pad"><div class="tabs av-tabs" role="tablist">${r.kinds.map(k => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${esc(KL[k] || k)}</button>`).join('')}</div>
        <div class="av-grid">${parts.map(p => { const c2 = { ...cfg, [p.kind]: p.id }; return `<button class="av-opt ${cfg[p.kind] === p.id ? 'on' : ''} ${p.owned ? '' : 'locked'}" data-k="${p.kind}" data-id="${esc(p.id)}" title="${esc(p.label)}"><img src="${prev(c2)}" alt="" loading="lazy" width="72" height="72"><span class="small">${esc(p.label)}</span>${p.owned ? '' : `<span class="tiny lock">${icon('lock')} ${esc(lockText(p))}</span>`}</button>`; }).join('')}</div></div></div></div>`, { title: 'Avatar' });
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    document.querySelectorAll('.av-opt').forEach(b => b.onclick = async () => { const p = r.parts.find(x => x.kind === b.dataset.k && x.id === b.dataset.id);
      if (!p.owned) { if (!p.unlock.crowns) return C.toast(`Unlock: ${lockText(p)}`); if (!confirm(`Buy "${p.label}" for ${p.unlock.crowns} Hub Crowns?`)) return; const x = await api('/api/avatar/buy', { method: 'POST', body: { part: p.kind + ':' + p.id } }); if (!x.ok) return C.toast(x.error); p.owned = true; crowns = x.crowns; }
      cfg[p.kind] = p.id; draw(); });
    document.getElementById('av-save').onclick = async () => { const x = await api('/api/avatar', { method: 'PUT', body: { avatar: cfg } }); if (!x.ok) return draw(`<div class="err">${esc(x.error)}</div>`); C.bumpAvatar(S.me.username); draw('<div class="ok-msg">Saved. Your new avatar shows everywhere.</div>'); };
  };
  draw();
}
export function install(ctx) { C = ctx; ctx.route(/^\/avatar$/, editor); }

// V1 avatar editor: interactive WebGL preview with the existing SVG renderer as a compatibility fallback.
import { mountAvatar3D } from './avatar-3d.js';
let avatarCleanup = null;
let C = null;
const KL = { bg: 'Background', skin: 'Skin', face: 'Face', hair: 'Hair', hairc: 'Hair color', eyes: 'Eyes', mouth: 'Mouth', beard: 'Facial hair', outfit: 'Outfit', hat: 'Hat', acc: 'Accessory', held: 'Held item' };
const lockText = (p) => p.owned ? '' : p.unlock.crowns ? `${p.unlock.crowns} Crowns` : p.unlock.ach ? `${p.unlock.ach} achievements` : p.unlock.prestige ? 'Prestige owners' : 'Locked';
async function editor() {
  const { icon, esc, api, S } = C; if (!S.me) return C.go('/signin?next=/avatar', true);
  const r = await api('/api/avatar'); if (!r.ok) return C.shell('/settings', C.emptyState('user', 'Avatar unavailable', ''));
  const cfg = { ...r.avatar }; let tab = 'hair'; let crowns = r.crowns;
  const prev = (c) => '/avatar-preview.svg?c=' + encodeURIComponent(JSON.stringify(c));
  const draw = (msg = '') => {
    if (avatarCleanup) { avatarCleanup(); avatarCleanup = null; }
    const parts = r.parts.filter(p => p.kind === tab);
    C.shell('/settings', `<div class="narrow avatar-ed">${C.pageHead('Your avatar', 'Shown on boards, profiles and winner lists. Cosmetic only.')}
      <div class="av-ed"><div class="av-prev card pad"><div id="avatar-stage" class="avatar-stage" aria-label="Interactive 3D avatar preview"></div><img id="av-prev" src="${prev(cfg)}" alt="Avatar preview" width="220" height="220" style="display:none"><p class="tiny muted">Drag the avatar to rotate it.</p><div class="small muted">Hub Crowns: <b>${C.fmt(crowns)}</b></div><button class="btn" id="av-save">${icon('check')} Save avatar</button><div id="av-msg">${msg}</div></div>
      <div class="card pad"><div class="avatar-gender" role="group" aria-label="Avatar presentation"><span class="small muted">Presentation</span>${[["male","Male"],["female","Female"],["other","Other"]].map(([id,label]) => `<button type="button" class="btn ${cfg.gender === id ? "on" : ""}" data-gender="${id}" aria-pressed="${cfg.gender === id}">${label}</button>`).join("")}</div><div class="tabs av-tabs" role="tablist">${r.kinds.map(k => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}" role="tab" aria-selected="${k === tab}">${esc(KL[k] || k)}</button>`).join('')}</div>
        <div class="av-grid">${parts.map(p => { const c2 = { ...cfg, [p.kind]: p.id }; return `<button class="av-opt ${cfg[p.kind] === p.id ? 'on' : ''} ${p.owned ? '' : 'locked'}" data-k="${p.kind}" data-id="${esc(p.id)}" title="${esc(p.label)}"><img src="${prev(c2)}" alt="" loading="lazy" width="72" height="72"><span class="small">${esc(p.label)}</span>${p.owned ? '' : `<span class="tiny lock">${icon('lock')} ${esc(lockText(p))}</span>`}</button>`; }).join('')}</div></div></div></div>`, { title: 'Avatar' });
    const stage = document.getElementById('avatar-stage'); const fallback = document.getElementById('av-prev');
    if (stage) mountAvatar3D(stage, cfg).then(cleanup => { if (stage.isConnected) avatarCleanup = cleanup; else cleanup(); }).catch(() => { if (stage.isConnected) { stage.style.display = 'none'; if (fallback) fallback.style.display = 'block'; } });
    document.querySelectorAll('[data-gender]').forEach(b => b.onclick = () => { cfg.gender = b.dataset.gender; draw(); });
    document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
    document.querySelectorAll('.av-opt').forEach(b => b.onclick = async () => { const p = r.parts.find(x => x.kind === b.dataset.k && x.id === b.dataset.id);
      if (!p.owned) { if (!p.unlock.crowns) return C.toast(`Unlock: ${lockText(p)}`); if (!confirm(`Buy "${p.label}" for ${p.unlock.crowns} Hub Crowns?`)) return; const x = await api('/api/avatar/buy', { method: 'POST', body: { part: p.kind + ':' + p.id } }); if (!x.ok) return C.toast(x.error); p.owned = true; crowns = x.crowns; }
      cfg[p.kind] = p.id; draw(); });
    document.getElementById('av-save').onclick = async () => { const x = await api('/api/avatar', { method: 'PUT', body: { avatar: cfg } }); if (!x.ok) return draw(`<div class="err">${esc(x.error)}</div>`); C.bumpAvatar(S.me.username); draw('<div class="ok-msg">Saved. Your new avatar shows everywhere.</div>'); };
  };
  draw();
}
export function install(ctx) { C = ctx; ctx.route(/^\/avatar$/, editor); }

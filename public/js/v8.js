// v8 UI: skill quests (daily / weekly / seasonal) and the 12,000+ skill achievements browser.
// Everything is rendered from /api/skill/*; definitions are generated on the server on demand.
let C = null;
export function install(ctx) {
  C = ctx;
  // per-player wardrobe CSS (the global sheet only covers what is on sale / worn right now)
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.id = 'v8-mine'; document.head.appendChild(link);
  let last = '', t = 0; const refresh = () => { const me = C.S && C.S.me; const k = me ? me.id || me.username : ''; if (!k) { link.removeAttribute('href'); last = ''; return; } if (k !== last || Date.now() - t > 45000) { last = k; t = Date.now(); link.href = '/cosmetics-mine.css?u=' + encodeURIComponent(k) + '&t=' + t; } };
  const push = history.pushState; history.pushState = function () { const r = push.apply(this, arguments); setTimeout(refresh, 400); return r; };
  window.addEventListener('popstate', () => setTimeout(refresh, 400)); setTimeout(refresh, 1200);
  // fill the Featured Brands strip wherever a page leaves a #v8-fb placeholder
  let pend = 0; new MutationObserver(() => { if (pend) return; pend = setTimeout(() => { pend = 0; const el = document.getElementById('v8-fb'); if (el && !el.dataset.done) { el.dataset.done = '1'; featuredBrands(el); } }, 60); }).observe(document.body, { childList: true, subtree: true });
}
const brandDot = (b) => `<span class="v8-bl" style="--bc:${/^#[0-9a-f]{3,8}$/i.test(b.color || '') ? b.color : '#7c3aed'}">${b.logo && /^(\/|https:\/\/)/.test(b.logo) ? `<img src="${C.esc(b.logo)}" alt="" loading="lazy" width="44" height="44">` : C.esc((b.name || '?').slice(0, 1).toUpperCase())}</span>`;
export async function featuredBrands(el) {
  const { api, esc, icon } = C; const r = await api('/api/brands/featured'); if (!r.ok || !r.brands.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="section-h"><h2>${icon('store')} Featured Brands</h2></div><div class="hscroll v8-fbs">${r.brands.map(b => `<a class="v8-fb" href="/brand/${esc(b.slug)}">${brandDot(b)}<span><b>${esc(b.name)}</b><small>${b.live ? `${b.live} live giveaway${b.live === 1 ? '' : 's'}` : esc(b.tagline || 'Brand on the Hub')}</small></span></a>`).join('')}</div>`;
}
export async function brandPage(slug) {
  const { api, esc, icon, shell, emptyState, pageHead } = C;
  shell('/giveaways', '<div class="narrow"><div class="skeleton"></div></div>');
  const r = await api('/api/brand/' + encodeURIComponent(slug));
  if (!r.ok) return shell('/giveaways', `<div class="narrow">${emptyState('store', 'Brand not found', 'This brand page is not available.', '<a class="btn sm" href="/giveaways">Giveaways</a>')}</div>`);
  const b = r.brand; const row = (g) => `<a class="mini-row" href="/giveaways/${g.id}"><b>${esc(g.title)}</b><span class="small muted">${g.audience === 'invite' ? 'Invite only' : g.audience === 'affiliated' ? 'Brand members' : 'Open to all'} · ${new Date(g.end_at).toLocaleDateString()}</span></a>`;
  const sec = (t, l) => l.length ? `<div class="card pad"><h2>${t}</h2>${l.map(row).join('')}</div>` : '';
  shell('/giveaways', `<div class="narrow v8-bp">${pageHead(esc(b.name), esc(b.tagline || ''))}
    <div class="card pad v8-bp-h">${brandDot(b)}<div style="flex:1"><div class="small muted">${b.members} player${b.members === 1 ? '' : 's'} affiliated · ${r.giveaways_hosted} giveaway${r.giveaways_hosted === 1 ? '' : 's'} hosted</div>${b.about ? `<p>${esc(b.about)}</p>` : ''}
    ${b.link ? `<a class="btn sm ghost" rel="noopener nofollow" target="_blank" href="${esc(b.link.url)}">${icon('external-link')} ${esc(b.link.label)}</a>` : ''}
    ${r.affiliated ? `<span class="pill green">${icon('check')} Your giveaway affiliation</span>` : `<a class="btn sm" href="/settings#v7-brand">${icon('store')} Set as my giveaway affiliation</a>`}</div></div>
    ${sec('Live giveaways', r.live)}${sec('Upcoming', r.upcoming)}${sec('Past giveaways', r.past)}
    ${r.live.length + r.upcoming.length + r.past.length ? '' : emptyState('gift', 'No giveaways yet', 'Giveaways from this brand will appear here.')}
    <p class="tiny dim">${esc(r.facts_note)}</p></div>`);
}
const TIER_IC = { bronze: 'medal', silver: 'medal', gold: 'trophy', epic: 'gem', legendary: 'crown' };
const PERIOD = { daily: ['Daily', 'sun', 'Resets at midnight ET'], weekly: ['Weekly', 'calendar-range', 'Resets Monday'], seasonal: ['Season', 'flag', 'Lasts the whole season'] };
const left = (t) => { const s = Math.max(0, Math.floor((t - Date.now()) / 1000)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`; };
function questCard(q) {
  const { esc, icon, fmt } = C; const pct = Math.min(100, Math.round(q.progress / q.target * 100));
  return `<div class="v8-q ${q.done ? 'done' : ''} ${q.claimed ? 'claimed' : ''} t-${esc(q.tier)}">
    <div class="v8-q-h"><span class="v8-tier t-${esc(q.tier)}">${esc(q.tier)}</span><b>${esc(q.title)}</b></div>
    <p class="small muted">${esc(q.desc)}</p>
    <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="${q.target}" aria-valuenow="${q.progress}"><i style="width:${pct}%"></i></div>
    <div class="v8-q-f"><span class="tiny muted">${fmt(q.progress)} / ${fmt(q.target)} ${esc(q.unit)}</span>
      <span class="v8-rw">${icon('coins')} ${fmt(q.reward.credits)}${q.reward.item ? ` ${icon('gem')} design` : ''}</span>
      ${q.claimed ? `<span class="pill green">${icon('check')} Claimed</span>` : q.done ? `<button class="btn sm" data-v8claim="${esc(q.id)}">Claim</button>` : ''}</div></div>`;
}
export async function fillQuests(el) {
  if (!el || !C) return; const { api, icon, esc, toast } = C;
  el.innerHTML = '<div class="skeleton"></div>';
  const r = await api('/api/skill/quests'); if (!r.ok) { el.innerHTML = ''; return; }
  const draw = (b) => {
    el.innerHTML = `<div class="section-h"><h2>${icon('swords')} Skill quests</h2><span class="small muted">${C.fmt(b.space.definitions)}+ quest variants</span></div>
      <p class="small muted v8-note">Quests are scored from your own accepted runs: reaching score targets, beating your best, staying alive and playing well across games. Rewards are Hub Credits and cosmetic designs only.</p>
      ${['daily', 'weekly', 'seasonal'].map(p => `<div class="card pad v8-qs"><div class="v8-qs-h"><b>${icon(PERIOD[p][1])} ${PERIOD[p][0]} quests</b><span class="tiny muted">Ends in ${left(b[p].ends_at)}</span></div>${b[p].quests.map(questCard).join('')}</div>`).join('')}`;
    el.querySelectorAll('[data-v8claim]').forEach(btn => btn.addEventListener('click', async () => {
      btn.disabled = true; const x = await api('/api/skill/quests/claim', { method: 'POST', body: { id: btn.dataset.v8claim } });
      if (!x.ok) { toast(x.error || 'Could not claim'); btn.disabled = false; return; }
      toast(`+${x.credits} Hub Credits${x.item ? ' and a new design: ' + x.item.name : ''}`); if (C.S.me && x.board) draw(x.board);
    }));
  };
  draw(r);
}
export async function fillAchievements(el) {
  if (!el || !C) return; const { api, icon, esc, fmt } = C;
  el.innerHTML = '<div class="skeleton"></div>'; const r = await api('/api/skill/achievements'); if (!r.ok) { el.innerHTML = ''; return; }
  const pct = r.total ? Math.round(r.unlocked / r.total * 1000) / 10 : 0;
  el.innerHTML = `<div class="section-h"><h2>${icon('award')} Skill achievements</h2><span class="small muted">${fmt(r.total)} total</span></div>
    <div class="card pad v8-ach-sum"><div><b class="orb">${fmt(r.unlocked)}</b> <span class="muted">of ${fmt(r.total)} unlocked (${pct}%)</span><div class="tiny muted">${r.per_game} ladders-steps per game (score, runs, playtime, survival, play days, personal bests, consistency) plus ${r.global} hub-wide. Every unlock pays Hub Credits; milestone steps award an earn-only cosmetic design.</div></div>
      <input class="input" id="v8-gsearch" placeholder="Find a game" aria-label="Find a game"></div>
    <div class="v8-games" id="v8-games">${[{ id: '*', title: 'Hub-wide', total: r.global, unlocked: r.hub.unlocked }, ...r.games].map(g => `<button class="v8-game" data-g="${esc(g.id)}"><b>${esc(g.title)}</b><span class="tiny muted">${g.unlocked} / ${g.total}</span><span class="xpbar"><i style="width:${Math.round(g.unlocked / g.total * 100)}%"></i></span></button>`).join('')}</div>
    <div id="v8-ach-detail" class="card pad" hidden></div>`;
  const detail = el.querySelector('#v8-ach-detail');
  el.querySelector('#v8-gsearch').addEventListener('input', (e) => { const q = e.target.value.trim().toLowerCase(); el.querySelectorAll('.v8-game').forEach(b => { b.hidden = q && !b.textContent.toLowerCase().includes(q); }); });
  const open = async (id) => {
    detail.hidden = false; detail.innerHTML = '<div class="skeleton"></div>'; detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    const g = await api('/api/skill/achievements/' + encodeURIComponent(id)); if (!g.ok) { detail.innerHTML = esc(g.error || 'Could not load'); return; }
    let fam = g.families[0].id;
    const draw = () => { const items = g.items.filter(i => i.family === fam); const done = items.filter(i => i.unlocked).length;
      detail.innerHTML = `<h3>${esc(g.game.title)}</h3><div class="v8-fams">${g.families.map(f => `<button class="chip ${f.id === fam ? 'on' : ''}" data-f="${f.id}">${esc(f.noun)} (${g.items.filter(i => i.family === f.id && i.unlocked).length}/${f.tiers})</button>`).join('')}</div>
        <div class="v8-steps">${items.map(i => `<div class="v8-step ${i.unlocked ? 'on' : ''} t-${esc(i.tier)}"><span class="v8-ic">${icon(i.unlocked ? (TIER_IC[i.tier] || 'award') : 'lock')}</span><div><b>${esc(i.name)}</b><div class="tiny muted">${esc(i.desc)}</div></div><span class="tiny v8-rw">${icon('coins')} ${i.credits}${i.item ? ' ' + icon('gem') : ''}</span></div>`).join('')}</div>`;
      detail.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { fam = b.dataset.f; draw(); })); };
    draw();
  };
  el.querySelectorAll('.v8-game').forEach(b => b.addEventListener('click', () => open(b.dataset.g)));
}

// Your data: download everything we hold, or delete the account (password + typed username confirm).
export function fillData(el) {
  if (!el || !C || !C.S.me) return; const { api, icon, esc, toast } = C; const name = C.S.me.username;
  el.innerHTML = `<h2 style="margin-bottom:6px">${icon('shield')} Your data</h2>
    <p class="small muted">We only keep what the Hub needs: your username, a salted password hash, your date of birth (21+ check), gameplay and purchases. <a href="/privacy">Privacy policy</a></p>
    <div class="set-row"><div><b>${icon('download')} Download my data</b><div class="small muted">A JSON file with your account, runs, items, orders and sign-in history.</div></div><button class="btn sm ghost" id="v8-export">Download</button></div>
    <details class="v8-del"><summary class="small"><b>${icon('trash-2')} Delete my account</b></summary>
      <p class="small muted">This permanently removes your profile, runs, items, Credits and follows. Locked giveaway results keep only your username as a public record. It cannot be undone.</p>
      <form id="v8-delf"><div id="v8-delmsg"></div><div class="field"><input class="input" id="v8-delname" placeholder="Type your username (${esc(name)})" autocomplete="off" aria-label="Type your username to confirm"></div>
      <div class="field"><input class="input" id="v8-delpw" type="password" placeholder="Password" autocomplete="current-password" aria-label="Password"></div>
      <button class="btn danger block" type="submit">Delete my account for good</button></form></details>`;
  el.querySelector('#v8-export').onclick = async () => {
    const res = await fetch('/api/me/export', { credentials: 'same-origin' }); if (!res.ok) return toast('Could not export right now. Try again in a minute.');
    const blob = await res.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gaming-hub-data.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  el.querySelector('#v8-delf').onsubmit = async (e) => {
    e.preventDefault(); const out = el.querySelector('#v8-delmsg');
    const r = await api('/api/me/delete', { method: 'POST', body: { confirm: el.querySelector('#v8-delname').value, password: el.querySelector('#v8-delpw').value } });
    if (!r.ok) { out.innerHTML = `<div class="notice err">${esc(r.error || 'Could not delete')}</div>`; return; }
    toast('Your account was deleted.'); setTimeout(() => { location.href = '/'; }, 800);
  };
}

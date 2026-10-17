// v8 UI: skill quests (daily / weekly / seasonal) and the 12,000+ skill achievements browser.
// Everything is rendered from /api/skill/*; definitions are generated on the server on demand.
let C = null;
export function install(ctx) { C = ctx; }
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

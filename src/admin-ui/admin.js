import { icon } from '/js/icons.js';
import '/api/admin/ui/admin-icons.js';
// v7: served only from the secret admin path (src/admin-sec.js rewrites '/admin' + '/api/admin' to it at serve time).
const AP = '/admin';
const CSRF = (document.querySelector('meta[name=csrf]') || {}).content || '';
const ME_EL = document.querySelector('meta[name=admin-user]'); const ME = { username: ME_EL ? ME_EL.content : '', role: ME_EL ? ME_EL.dataset.role : '', name: ME_EL ? ME_EL.dataset.name : '' };
const $ = (s, r = document) => r.querySelector(s);
const root = document.getElementById('admin');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
let offset = 0; const nowS = () => Date.now() + offset;
async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', ...opts, headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), 'X-CSRF-Token': CSRF }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let d; try { d = await res.json(); } catch { d = { ok: false, error: 'HTTP ' + res.status }; }
  if (d.now) offset = d.now - Date.now();
  if (res.status === 401 && !path.includes('/security/')) { loginView(); throw new Error('auth'); }
  return d;
}
const ago = (ms) => { const s = Math.max(0, (nowS() - ms) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };
const dt = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const toLocalInput = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const statusPill = (s) => `<span class="pill ${s === 'active' ? 'green' : s === 'upcoming' ? '' : 'red'}">${s}</span>`;
const demoTag = (d) => d ? '<span class="demo-tag">DEMO</span>' : '';
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
let GAMES = [];

// v7 items 22-23: grouped navigation filtered by the signed-in role's permissions (owner / admin / moderator)
const NAV_G = [
  ['', [['', 'layout-dashboard', 'Dashboard', 'dashboard.view'], ['analytics', 'chart-line', 'Analytics', 'analytics.view']]],
  ['Giveaways', [['giveaways', 'gift', 'Giveaways', 'giveaways.view', 'drafts'], ['game-rules', 'list-checks', 'Game rules', 'giveaways.view'], ['games', 'gamepad-2', 'Games', 'giveaways.view'], ['tournaments', 'swords', 'Tournaments', 'giveaways.edit'], ['leaderboards', 'trophy', 'Leaderboards', 'giveaways.view']]],
  ['Players', [['players', 'users', 'Players', 'users.view'], ['moderation', 'scan-eye', 'Moderation', 'moderation.queue', 'mod'], ['reports', 'file-text', 'Exports', 'giveaways.view']]],
  ['Live ops', [['events', 'party-popper', 'Specials & events', 'events.manage'], ['seasons', 'calendar-range', 'Seasons', 'seasons.manage'], ['shop', 'shopping-bag', 'Shop', 'shop.manage'], ['badges', 'badge-check', 'Badges', 'badges.award'], ['announcements', 'megaphone', 'Announcements', 'announcements.post']]],
  ['Business', [['sponsor', 'briefcase', 'Sponsor requests', 'billing.view'], ['official', 'badge-check', 'Official events', 'giveaways.view'], ['store', 'wallet', 'Store & orders', 'billing.view'], ['channels', 'store', 'Brands', 'settings.manage']]],
  ['Admin', [['team', 'shield-half', 'Team & roles', 'dashboard.view'], ['log', 'history', 'Action log', 'actionlog.view'], ['security', 'shield-check', 'Security', 'dashboard.view'], ['settings', 'settings', 'Settings', 'settings.manage'], ['system', 'server-cog', 'System', 'settings.manage']]],
];
let V7 = null, V7ME = null, V7AT = 0;
const canV7 = (k) => !V7ME || !k || !!(V7ME.perms || {})[k];
function navHTML(section) {
  const cnt = (c) => { if (!V7ME || !c) return ''; const n = c === 'mod' ? (V7ME.counts.flags || 0) + (V7ME.counts.reports || 0) : V7ME.counts[c] || 0; return n ? `<b class="cnt">${n > 99 ? '99+' : n}</b>` : ''; };
  return NAV_G.map(([g, items]) => { const vis = items.filter(x => canV7(x[3])); if (!vis.length) return '';
    return `${g ? `<div class="grp">${g}</div>` : ''}${vis.map(([k, i, l, , c]) => `<a href="/admin${k ? '/' + k : ''}" class="${section === k ? 'on' : ''}">${icon(i)}${l}${cnt(c)}</a>`).join('')}`; }).join('');
}
function whoHTML() {
  const m = V7ME ? V7ME.admin : { display_name: ME.name || ME.username, role: ME.role || 'admin' }; const role = m.role || 'admin';
  const badge = role === 'owner' ? `<span class="role-badge owner">${icon('crown')}Owner</span><span class="org">Owner • Trap Tech Solutions</span>` : role === 'admin' ? `<span class="role-badge admin">${icon('shield-check')}Admin</span>` : `<span class="role-badge mod">${icon('shield')}Moderator</span>`;
  return `<a class="who mini-row" href="/admin/team" style="margin:0;color:inherit;text-decoration:none"><span class="av" style="background:${role === 'owner' ? 'linear-gradient(135deg,#f59e0b,#fde68a)' : 'linear-gradient(135deg,#7c3aed,#22d3ee)'}">${esc((m.display_name || m.username || 'TT').slice(0, 2).toUpperCase())}</span><div class="who-role"><b>${esc(m.display_name || m.username)}</b>${badge}</div></a>`;
}
async function loadV7(force) {
  if (!V7ME || force || Date.now() - V7AT > 30000) { try { const r = await api('/api/admin/v7/me'); if (r.ok) { V7ME = r; V7AT = Date.now(); } } catch (e) { if (e.message === 'auth') throw e; } }
  if (!V7) {
    if (!document.querySelector('link[data-v7css]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/api/admin/ui/admin-v7.css'; l.dataset.v7css = '1'; document.head.appendChild(l); }
    V7 = await import('/api/admin/ui/admin-v7.js');
  }
  V7.init({ api, frame, icon, toast, nav, perms: V7ME ? V7ME.perms : {}, counts: V7ME ? V7ME.counts : {}, GAMES, ME: V7ME ? V7ME.admin : ME });
  return V7;
}
function frame(section, title, inner, actions = '') {
  document.title = `${title.replace(/<[^>]+>/g, '')} - Admin - The Gaming Hub by Trap Tech Solutions`;
  root.innerHTML = `<div class="adm">
    <aside class="side" aria-label="Admin navigation"><div class="brand"><img src="/assets/brand/hub-logo.svg" alt="The Gaming Hub"><b>Trap Tech Admin</b></div>
      <button class="mnav-btn" type="button" data-mnav aria-expanded="false">${icon('menu')}<span>Menu</span></button>${navHTML(section)}
      <span class="sp" style="flex:1"></span><a href="/" target="_blank">${icon('external-link')}View site</a><a href="#" data-logout>${icon('log-out')}Log out</a>
      <div class="side-tt"><span>Powered by</span><picture><img src="/assets/brand/tt-horizontal.svg" alt="Trap Tech Solutions" width="147" height="40" decoding="async"></picture></div></aside>
    <main class="amain"><div class="tt-bar"><picture><img src="/assets/brand/tt-mono.svg" alt="" width="21" height="24" decoding="async"></picture> Powered by Trap Tech Solutions <span class="muted">• The Gaming Hub v7</span></div><div class="ahead"><h1>${title}</h1>${actions}${whoHTML()}</div>${inner}</main></div>`;
}
document.addEventListener('click', async (e) => {
  const mb = e.target.closest('[data-mnav]'); if (mb) { const sd = mb.closest('.side'); sd.classList.toggle('open'); mb.setAttribute('aria-expanded', sd.classList.contains('open')); return; }
  if (e.target.closest('[data-logout]')) { e.preventDefault(); await fetch('/api/admin/logout', { method: 'POST', headers: { 'X-CSRF-Token': CSRF } }); return loginView(); }
  const a = e.target.closest('a[href^="/admin"]'); if (!a || a.target) return;
  e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); render();
});
window.addEventListener('popstate', render);
const nav = (p) => { history.pushState({}, '', p); render(); };

function loginView() { location.href = AP + '/'; }

async function render() {
  const me = await (await fetch('/api/admin/me')).json(); if (!me.admin) return loginView();
  if (!GAMES.length) GAMES = (await (await fetch('/api/games')).json()).games;
  const parts = location.pathname.slice(AP.length).split('/').filter(Boolean);
  try {
    const [s, id, sub] = parts;
    const v7 = await loadV7();
    if (s && (await v7.route(s, id, sub)) !== false) return;
    if (!s) return dashboard();
    if (s === 'system') return settings();
    if (s === 'games') return games();
    if (s === 'giveaways' && !id) return giveaways();
    if (s === 'giveaways') return manageGiveaway(id);
    if (s === 'bookings') return nav(AP + '/sponsor');
    if (s === 'sponsor' && id === 'prices') return sponsorPrices();
    if (s === 'sponsor') return sponsorAdmin(id);
    if (s === 'store') return storeAdmin();
    if (s === 'official') return eventsAdmin(id);
    if (s === 'channels') return channels(id);
    if (s === 'badges') return badges();
    if (s === 'fairplay') return fairplay(new URLSearchParams(location.search).get('status') || 'open');
    if (s === 'players') return players();
    if (s === 'leaderboards') return leaderboards();
    if (s === 'announcements') return announcements();
    if (s === 'tournaments') return tournaments(id);
    if (s === 'reports') return reports();
    if (s === 'settings') return settings();
    if (s === 'security') return security();
    frame('', 'Not found', '<div class="empty">Unknown admin page.</div>');
  } catch (err) { if (err.message !== 'auth') { console.error(err); frame('', 'Error', `<div class="err">${esc(err.message)}</div>`); } }
}

// ---------- dashboard ----------
const ACT = { player: ['user-plus', '#10b981'], entry: ['gift', '#8b5cf6'], booking: ['calendar-check', '#f59e0b'], highscore: ['zap', '#22d3ee'], winner: ['crown', '#fbbf24'], giveaway: ['gift', '#ec4899'], announcement: ['megaphone', '#6366f1'] };
async function dashboard() {
  const s = await api('/api/admin/stats');
  frame('', 'Admin Dashboard', `
    <div class="stats">
      ${[['users', 'Total Players', fmt(s.players), `+${s.players_7d} this week`, '#10b981'], ['gamepad-2', 'Games Played', fmt(s.runs), `+${s.runs_24h} today`, '#6366f1'], ['gift', 'Active Giveaways', s.active_giveaways, '', '#ec4899'], ['briefcase', 'Bookings', s.bookings_total, `${s.bookings_pending} pending`, '#f59e0b']]
        .map(([i, l, v, d, c]) => `<div class="card stat"><div class="ic" style="background:${c}22;color:${c};box-shadow:0 0 18px ${c}44">${icon(i)}</div><div><span>${l}</span><b>${v}</b><div class="delta">${d}</div></div></div>`).join('')}
    </div>
    ${s.demo.players || s.demo.giveaways ? `<div class="card pad" style="margin-top:14px;border-color:rgba(251,191,36,.5)"><b style="color:#fcd34d">Demo data present</b> <span class="muted small">(${s.demo.players} demo players, ${s.demo.giveaways} demo giveaways). Remove it any time in <a href="/admin/settings">Settings</a>.</span></div>` : ''}
    <div class="cols">
      <div class="card"><div class="panel-h"><h2>Recent Activity</h2></div>
        ${s.activity.length ? s.activity.map(a => { const [i, c] = ACT[a.type] || ['activity', '#64748b']; return `<div class="act"><span class="dot" style="background:${c}33;color:${c}">${icon(i)}</span><span>${esc(a.message)}</span><span class="t">${ago(a.created_at)}</span></div>`; }).join('') : '<div class="empty">No activity yet.</div>'}
      </div>
      <div class="card"><div class="panel-h"><h2>Upcoming & Live Giveaways</h2><a class="small" href="/admin/giveaways">View All</a></div>
        ${s.upcoming.length ? s.upcoming.map(g => `<a class="act" href="/admin/giveaways/${g.id}" style="color:var(--text)"><span class="dot" style="background:#f59e0b33;color:#f59e0b">${icon('gift')}</span><span><b>${esc(g.title)}</b>${demoTag(g.demo)}<div class="small muted">${statusPill(g.status)} ${fmt(g.entrants)} entrants</div></span><span class="t">${g.status === 'upcoming' ? 'starts ' + dt(g.start_at) : 'ends ' + dt(g.end_at)}</span></a>`).join('') : '<div class="empty">None scheduled.</div>'}
        <div style="padding:12px"><a class="btn block" href="/admin/giveaways/new">${icon('plus')} New Giveaway</a></div>
        <div class="small muted" style="padding:0 14px 12px">Anti-cheat: ${fmt(s.rejected_runs)} rejected run submission${s.rejected_runs === 1 ? '' : 's'}. ${s.games_live}/${s.games_total} games live.</div>
      </div>
    </div>`);
}

// ---------- games (one-click giveaway linking) ----------
async function games() {
  const r = await api('/api/admin/games');
  const unit = (g) => g.unit === 'm' ? 'm' : ' ' + g.unit;
  frame('games', 'Games', `<p class="muted small" style="margin-top:0">All ${r.games.length} games are live. Use <b>Create giveaway</b> for a prefilled giveaway on that game, or flip a toggle to make a live / upcoming giveaway count that game. A giveaway can count several games.</p>
    <div class="ggrid">${r.games.map(g => `<div class="card agame" data-game="${g.id}">
      <div class="agh"><img src="${g.art}" alt=""><div><b>${esc(g.title)}</b><div class="small muted">${esc(g.category)} • <span class="pill green">LIVE</span></div></div></div>
      <div class="agstats"><div><b>${fmt(g.runs)}</b><span>runs</span></div><div><b>${fmt(g.players)}</b><span>players</span></div><div><b>${fmt(g.best)}${unit(g)}</b><span>best</span></div></div>
      <div class="small muted agac">Anti-cheat: max ${fmt(g.ac.perSec)}${unit(g)}/s${g.ac.max < 1e7 ? `, cap ${fmt(g.ac.max)}` : ''}</div>
      ${g.giveaway === false ? `<div class="small muted agfun" data-fun="${g.id}">${icon('dices')} <b>Just for fun.</b> This is a chance game, so it can't be linked to giveaways. Giveaways only use skill-based, endless games.</div>` : `<a class="btn block sm" href="/admin/giveaways/new?game=${g.id}" data-create="${g.id}">${icon('plus')} Create giveaway for this game</a>
      <div class="aglinks"><div class="small muted" style="margin:10px 0 4px">${icon('link')} Linked giveaways</div>
        ${g.giveaways.length ? g.giveaways.map(x => `<label class="glink ${x.linked ? 'on' : ''}" data-gw="${x.id}"><span class="toggle"><input type="checkbox" data-link="${x.id}" data-game="${g.id}" ${x.linked ? 'checked' : ''}><span></span></span>
          <span class="gl-t"><b>${esc(x.title)}</b>${demoTag(x.demo)}<span class="small muted">${statusPill(x.status)} ${x.games} game${x.games === 1 ? '' : 's'}${x.active ? '' : ' • hidden'}</span></span></label>`).join('')
          : '<div class="small muted">No live or upcoming giveaways.</div>'}</div>`}
    </div>`).join('')}</div>`, `<a class="btn sm" href="/admin/giveaways/new">${icon('plus')} New Giveaway</a>`);
  root.querySelector('.ggrid').addEventListener('change', async (e) => {
    const cb = e.target.closest('[data-link]'); if (!cb) return;
    const x = await api(`/api/admin/giveaways/${cb.dataset.link}/games`, { method: 'POST', body: { game_id: cb.dataset.game, linked: cb.checked } });
    if (!x.ok) { cb.checked = !cb.checked; return toast(x.error); }
    toast(cb.checked ? 'Linked - runs of this game now count' : 'Unlinked'); games();
  });
}

// ---------- giveaways ----------
async function giveaways() {
  const r = await api('/api/admin/giveaways');
  frame('giveaways', 'Giveaways', `<div class="card wrap-x"><table class="tbl"><thead><tr><th>Title</th><th>Host</th><th>Status</th><th>Window</th><th class="num">Entrants</th><th>Winners</th><th>Visible</th><th></th></tr></thead><tbody>
    ${r.giveaways.length ? r.giveaways.map(g => `<tr><td><b>${esc(g.title)}</b>${demoTag(g.demo)}${g.tier ? ` <span class="pill ${g.tier === 'elite' ? 'gold' : ''}">${esc(g.tier)}</span>` : ''}${g.featured ? ' <span class="pill green">featured</span>' : ''}<div class="small muted">${esc(g.game_title)}</div></td><td>${esc(g.host)}</td><td>${statusPill(g.status)}</td><td class="small">${dt(g.start_at)}<br>→ ${dt(g.end_at)}</td><td class="num">${fmt(g.entrants)}</td><td class="small">${g.winners.map(w => esc(w.username)).join(', ') || '-'}</td><td>${g.active ? '<span class="pill green">on</span>' : '<span class="pill red">off</span>'}</td>
      <td><a class="btn sm" href="/admin/giveaways/${g.id}">Manage</a></td></tr>`).join('') : '<tr><td colspan="8" class="empty">No giveaways yet.</td></tr>'}
  </tbody></table></div>`, `<a class="btn sm" href="/admin/giveaways/new">${icon('plus')} New Giveaway</a>`);
}
const IMAGES = ['/assets/giveaways/store-credit-art.webp', '/assets/giveaways/ps5-bundle-art.webp', '/assets/brand/hero-banner.webp', '/assets/cards/v5/jetpack-dash.webp', '/assets/cards/v5/drift-rush.webp', '/assets/cards/v5/plinko.webp', '/assets/cards/v5/spin-to-win.webp', '/assets/cards/v5/memory-match.webp', '/assets/cards/v5/blazed-roulette.webp', '/assets/cards/v5/terp-tapper.webp'];
async function manageGiveaway(id) {
  const isNew = id === 'new';
  const pre = new URLSearchParams(location.search).get('game'); const preG = GAMES.find(x => x.id === pre && x.giveaway !== false);
  let g = { title: preG ? `${preG.title} Giveaway` : '', host: '', prize: '', image: preG ? preG.art : IMAGES[0], start_at: nowS(), end_at: nowS() + 7 * 864e5, game_ids: [preG ? preG.id : 'jetpack-dash'], rules: 'Must be 18+ (21+ where required). No purchase necessary. One account per person. Winners are contacted by Trap Tech on Potato.', active: true,
    placements: [], open_to_all: true, brand_color: '', brand_logo: '', featured: false, min_score: 0, prize_tiers_raw: '' };
  let entrants = [], stats = null;
  const [chs, ed] = await Promise.all([api('/api/admin/brands'), api('/api/admin/eligibility-defaults')]);
  const CH = chs.ok ? chs.brands : []; const DEF = ed.ok ? ed.defaults : {};
  if (isNew) Object.assign(g, DEF, { channel_id: null, link_url: '', link_label: '' });
  if (!isNew) { const r = await api('/api/admin/giveaways/' + id); if (!r.ok) return frame('giveaways', 'Not found', `<div class="err">${esc(r.error)}</div>`); g = r.giveaway; entrants = r.entrants; stats = r.stats; }
  const sel = new Set(g.game_ids && g.game_ids.length ? g.game_ids : [g.game_id]);
  const lockA = g.finalized_at ? 'disabled' : '';
  frame('giveaways', isNew ? 'New Giveaway' : 'Manage Giveaway', `
    <div class="cols" style="margin-top:0;grid-template-columns:1.1fr 1fr">
      <form class="card pad" id="gf">
        <div id="gm"></div>
        <div class="preview" id="pv" style="background-image:url('${esc(g.image)}')"><div class="cap" id="pvt">${esc(g.title || 'Giveaway title')}</div></div>
        <div class="field" style="margin-top:10px"><label class="lbl">Image</label><div class="img-pick" id="imgs">${IMAGES.map(u => `<button type="button" data-u="${u}" class="${u === g.image ? 'on' : ''}" style="background-image:url('${u}')" aria-label="Use image"></button>`).join('')}</div>
          <input class="input" id="img" style="margin-top:8px" placeholder="...or an image URL (https://...) or /assets/... path" value="${esc(g.image)}"></div>
        <div class="form-grid">
          <div class="field full"><label class="lbl">Title</label><input class="input" id="title" value="${esc(g.title)}" maxlength="120" required></div>
          <div class="field"><label class="lbl">Host</label><input class="input" id="host" value="${esc(g.host)}" placeholder="e.g. Canopy Club" maxlength="80"></div>
          <div class="field"><label class="lbl">Prize</label><input class="input" id="prize" value="${esc(g.prize)}" placeholder="$250 store credit" maxlength="200"></div>
          <div class="field"><label class="lbl">Start Date & Time</label><input class="input" type="datetime-local" id="start" value="${toLocalInput(g.start_at)}" ${lockA}></div>
          <div class="field"><label class="lbl">End Date & Time</label><input class="input" type="datetime-local" id="end" value="${toLocalInput(g.end_at)}" ${lockA}></div>
          ${g.finalized_at ? `<div class="field full"><div class="hint lockhint">${icon('lock')} Final standings were locked ${dt(g.finalized_at)}. Dates, games, minimum score and winner rules can no longer change.</div></div>` : ''}
          <div class="field full"><label class="lbl">Games that count <span class="muted small" id="gpn"></span></label><div class="gpicker" id="gpk">${GAMES.filter(x => x.giveaway !== false).map(x => `<button type="button" class="gp ${sel.has(x.id) ? 'on' : ''}" data-g="${x.id}" aria-pressed="${sel.has(x.id)}"><span class="ck">${icon('check')}</span><img src="${x.art}" alt=""><b>${esc(x.title)}</b></button>`).join('')}</div>
            <div class="hint" style="margin:6px 0 0">Tap to select one or more games. With several games, a player's giveaway score is the sum of their best score in each.</div></div>
          <fieldset class="field full plc-fs"><legend class="lbl">Sponsor placements <span class="muted small">(what the sponsor's accepted quote includes)</span></legend><div class="plc">${PLACE_L.map(([k, l]) => `<label class="check"><input type="checkbox" data-plc="${k}" ${(g.placements || []).includes(k) ? 'checked' : ''}> ${l}</label>`).join('')}</div></fieldset>
          <div class="field"><label class="lbl">Minimum score to qualify</label><input class="input" type="number" min="0" id="minscore" value="${g.min_score || 0}" ${lockA}></div>
          <div class="field"><label class="lbl">Winner selection</label><select class="input" id="wmethod" ${lockA}><option value="score" ${g.win_method !== 'random' ? 'selected' : ''}>Top score (skill)</option><option value="random" ${g.win_method === 'random' ? 'selected' : ''}>Verifiable random draw</option></select></div>
          <div class="field"><label class="lbl">Number of winners <span class="muted small">(0 = one per prize tier)</span></label><input class="input" type="number" min="0" max="100" id="wcount" value="${g.winner_count_raw ?? 0}" ${lockA}></div>
          <div class="field"><label class="lbl">Brand color</label><div style="display:flex;gap:8px"><input type="color" id="bcolor" value="${esc(g.brand_color || '#7c3aed')}" style="width:56px;height:48px;border:0;background:none"><label class="check" style="margin:0"><input type="checkbox" id="usecolor" ${g.brand_color ? 'checked' : ''}> Use brand color</label></div></div>
          <div class="field"><label class="lbl">Brand logo URL</label><input class="input" id="blogo" value="${esc(g.brand_logo)}" placeholder="/assets/... or https://..." maxlength="300"></div>
          <div class="field"><label class="lbl">Brand</label><select class="input" id="chan"><option value="">No brand (hub-wide)</option>${CH.map(c => `<option value="${c.id}" ${+g.channel_id === c.id ? 'selected' : ''}>${esc(c.name)} (${fmt(c.members)} members)</option>`).join('')}</select>
            <label class="check" style="margin:8px 0 0"><input type="checkbox" id="opentoall" ${g.open_to_all !== false ? 'checked' : ''}> Open to everyone <span class="muted small">(off = only this brand's members can enter)</span></label><div class="hint"><a href="/admin/channels">Manage brands &amp; invite links</a></div></div>
          <div class="field"><label class="lbl">Sponsor link <span class="muted small">(shown where the placements allow - tracked)</span></label><input class="input" id="glink" value="${esc(g.link_url || '')}" placeholder="https://brand.example/..." maxlength="300"><input class="input" id="glinkl" value="${esc(g.link_label || '')}" placeholder="Button label, e.g. Visit Canopy Club" maxlength="40" style="margin-top:6px"></div>
          <fieldset class="field full elig-fs" id="elig-fs"><legend class="lbl">${icon('shield-check')} Eligibility rules (anti-camping)</legend>
            <label class="check"><input type="checkbox" id="e-join" ${g.require_join ? 'checked' : ''}> Players must tap "Enter giveaway" (only joined players are ranked/drawn)</label>
            <div class="form-grid">
              <div class="field"><label class="lbl">Min runs in last 7 days</label><input class="input" type="number" min="0" max="100" id="e-runs" value="${g.elig_min_runs7 ?? 0}"></div>
              <div class="field"><label class="lbl">Account age (days)</label><input class="input" type="number" min="0" max="365" id="e-age" value="${g.elig_account_age_days ?? 0}"></div>
              <div class="field"><label class="lbl">Max live entries per player</label><input class="input" type="number" min="0" max="50" id="e-max" value="${g.elig_max_active ?? 0}"></div>
              <div class="field"><label class="lbl">Win cooldown (days)</label><input class="input" type="number" min="0" max="365" id="e-cool" value="${g.elig_win_cooldown_days ?? 0}"></div>
              <div class="field"><label class="lbl">Min XP in last 7 days <span class="muted small">(alternative to runs)</span></label><input class="input" type="number" min="0" id="e-xp" value="${g.elig_min_xp7 ?? 0}"></div>
            </div>
            <label class="check"><input type="checkbox" id="e-brand" ${g.elig_brand_month ? 'checked' : ''}> One win per player per brand per 30 days</label>
            <label class="check"><input type="checkbox" id="e-w" ${g.weight_mode === 'activity' ? 'checked' : ''}> Random draws: activity entries (1 + 1 per 5 runs, max 5)</label>
            <div class="hint">0 = off. Defaults: join required, 3 runs/7 days, 2-day account age, max 3 live entries, 30-day win cooldown, one win per brand per month. Rules show on the giveaway page and in its Official Rules.</div>
          </fieldset>
          <div class="field full"><label class="lbl">Prize tiers <span class="muted small">(one per line, e.g. "1st - PS5 bundle")</span></label><textarea class="input" id="ptiers" maxlength="1000" style="min-height:70px" placeholder="1st - ...&#10;2nd - ...&#10;3rd - ...&#10;Random draw - ...">${esc(g.prize_tiers_raw || '')}</textarea></div>
          <div class="field full"><label class="lbl">Rules</label><textarea class="input" id="rules" maxlength="4000">${esc(g.rules)}</textarea></div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin:4px 0 10px"><label class="toggle"><input type="checkbox" id="active" ${g.active ? 'checked' : ''}><span></span></label><b>Active</b><span class="small muted">(visible on the public site)</span></div>
        <div style="display:flex;align-items:center;gap:12px;margin:0 0 16px"><label class="toggle"><input type="checkbox" id="featured" ${g.featured ? 'checked' : ''}><span></span></label><b>Featured</b><span class="small muted">(home page Featured row; the hero takeover is the "Home hero" placement)</span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit" style="flex:1">${icon('check')} Save Changes</button>${isNew ? '' : `<button class="btn danger" type="button" id="del">${icon('trash-2')} Delete</button>`}</div>
        <p class="small muted">Times are in your browser's time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}). Runs started before the start time or submitted after the end time do not count.</p>
      </form>
      ${isNew ? '<div class="card pad"><h2>Entrants & winners</h2><p class="muted">Save the giveaway first. Entrants are players who finish a run of any linked game during the window.</p></div>' : `
      <div>
        ${stats ? `<div class="card pad" style="margin-bottom:14px"><h2 style="margin-bottom:10px">${icon('chart-column')} Live campaign stats</h2>
          <div class="agstats"><div><b>${fmt(stats.plays)}</b><span>plays</span></div><div><b>${fmt(stats.players)}</b><span>unique players</span></div><div><b>${fmt(g.entrants)}</b><span>entrants</span></div></div>
          ${(stats.per_game || []).length ? `<table class="tbl" style="margin-top:8px"><tbody>${stats.per_game.map(p => `<tr><td>${esc(GAMES.find(x => x.id === p.game_id)?.title || p.game_id)}</td><td class="num">${fmt(p.plays)} plays</td><td class="num">${fmt(p.players)} players</td></tr>`).join('')}</tbody></table>` : ''}</div>` : ''}
        <div class="card pad" style="margin-bottom:14px" id="wcard">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h2>${icon('trophy')} Winners</h2>${statusPill(g.status)}</div>
          <p class="small muted" style="margin:6px 0">${g.win_method === 'random' ? `Verifiable random draw • ${g.winner_count} winner${g.winner_count > 1 ? 's' : ''}` : `Top ${g.winner_count} by best qualifying score`}. Ties: higher score, then shorter server-timed run, then the game's skill metric, then a sudden-death playoff.</p>
          ${g.finalized_at ? `<div class="lockbox">${icon('lock')} Final standings locked ${dt(g.finalized_at)} • ${fmt(g.entrants)} entrants<div class="tiny muted">Entrant list SHA-256 <code>${esc((g.entrants_hash || '').slice(0, 24))}...</code></div></div>
              <div id="wb">${g.winners.length ? g.winners.map(w => `<div class="wrow ${w.state}"><b>#${w.place}</b> ${esc(w.username)} <span class="muted small">${fmt(w.score)}</span> ${w.state === 'confirmed' ? `<span class="pill green">${icon('badge-check')} Confirmed</span>` : `<span class="pill amber">${icon('hourglass')} Pending verification</span>`}</div>`).join('') : '<div class="empty" style="padding:10px">No eligible entrants.</div>'}</div>`
            : `<p class="small">Final standings lock automatically at the end time (${dt(g.end_at)}). Late scores never change them.</p>
              ${g.win_method === 'random' ? `<div class="tiny muted">Published draw commitment: <code>${esc((g.draw_commit || '').slice(0, 32))}...</code></div>` : ''}
              ${g.status === 'active' ? `<button class="btn danger sm" id="endnow" style="margin-top:8px">${icon('lock')} End now & lock results</button>` : ''}`}
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
            <a class="btn ghost sm" id="exp-runs" href="/api/admin/export/giveaway/${g.id}/runs.csv" target="_blank">${icon('download')} All entrants + runs CSV</a>
            ${g.finalized_at ? `<a class="btn ghost sm" id="exp-final" href="/api/admin/export/giveaway/${g.id}/final.csv" target="_blank">${icon('download')} Final standings CSV</a>` : ''}
            <a class="btn ghost sm" href="/api/admin/export/leaderboard.csv?giveaway=${g.id}" target="_blank">${icon('download')} Entrants CSV</a>
            <a class="btn ghost sm" href="/giveaways/${g.id}/${g.finalized_at ? 'results' : 'live'}" target="_blank">${icon('printer')} ${g.finalized_at ? 'Printable results' : 'Live standings'}</a>
            <a class="btn ghost sm" href="/giveaways/${g.id}" target="_blank">${icon('external-link')} Public page</a>
          </div>
        </div>
        <div class="card"><div class="panel-h"><h2>Entrants - Top N view</h2><input class="input" id="viewn" type="number" min="1" value="${Math.min(10, Math.max(entrants.length, 1))}" style="width:80px;height:36px"></div><div id="ent"></div></div>
      </div>`}
    </div>
    ${isNew ? '' : `<div class="card rq-card" id="rq-card" style="margin-top:16px"><div class="panel-h"><h2>${icon('shield-check')} Winner review queue</h2><label class="small muted">Top <input class="input" id="rqn" type="number" min="1" max="100" value="10" style="width:70px;height:34px;display:inline-block"></label></div><div id="rq"><div class="empty">Loading review queue...</div></div></div>
    <div class="card" id="audit-card" style="margin-top:16px"><div class="panel-h"><h2>${icon('scroll-text')} Audit log</h2></div><div id="audit"></div></div>`}`, `<a class="btn ghost sm" href="/admin/giveaways">${icon('chevron-left')} All giveaways</a>`);
  const setImg = (u) => { $('#img').value = u; $('#pv').style.backgroundImage = `url('${u}')`; document.querySelectorAll('#imgs button').forEach(b => b.classList.toggle('on', b.dataset.u === u)); };
  $('#imgs').onclick = (e) => { const b = e.target.closest('[data-u]'); if (b) setImg(b.dataset.u); };
  $('#img').oninput = (e) => setImg(e.target.value.trim());
  $('#title').oninput = (e) => { $('#pvt').textContent = e.target.value || 'Giveaway title'; };
  const paintGp = () => { document.querySelectorAll('#gpk .gp').forEach(b => { const on = sel.has(b.dataset.g); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); $('#gpn').textContent = `(${sel.size} selected)`; };
  $('#gpk').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; if (g.finalized_at) return toast('Results are locked: linked games cannot change.'); const k = b.dataset.g; if (sel.has(k)) { if (sel.size === 1) return toast('Pick at least one game'); sel.delete(k); } else sel.add(k); paintGp(); };
  paintGp();
  $('#gf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { title: $('#title').value, host: $('#host').value, prize: $('#prize').value, image: $('#img').value.trim(), start_at: new Date($('#start').value).getTime(), end_at: new Date($('#end').value).getTime(), entry_method: 'play', game_ids: GAMES.filter(x => x.giveaway !== false).map(x => x.id).filter(k => sel.has(k)), rules: $('#rules').value, active: $('#active').checked,
      placements: [...document.querySelectorAll('[data-plc]')].filter(x => x.checked).map(x => x.dataset.plc), open_to_all: !$('#chan').value || $('#opentoall').checked, min_score: +$('#minscore').value || 0, brand_color: $('#usecolor').checked ? $('#bcolor').value : '', brand_logo: $('#blogo').value.trim(), featured: $('#featured').checked, prize_tiers: $('#ptiers').value, win_method: $('#wmethod').value, winner_count: +$('#wcount').value || 0,
      channel_id: $('#chan').value || null, link_url: $('#glink').value.trim(), link_label: $('#glinkl').value.trim(), require_join: $('#e-join').checked, elig_min_runs7: +$('#e-runs').value || 0, elig_account_age_days: +$('#e-age').value || 0,
      elig_max_active: +$('#e-max').value || 0, elig_win_cooldown_days: +$('#e-cool').value || 0, elig_min_xp7: +$('#e-xp').value || 0, elig_brand_month: $('#e-brand').checked, elig_followers_only: false, weight_mode: $('#e-w').checked ? 'activity' : '' };
    if (g.finalized_at) Object.assign(body, { start_at: g.start_at, end_at: g.end_at });
    const r = await api(isNew ? '/api/admin/giveaways' : '/api/admin/giveaways/' + id, { method: isNew ? 'POST' : 'PUT', body });
    if (!r.ok) { $('#gm').innerHTML = `<div class="err">${esc(r.error)}</div>`; window.scrollTo(0, 0); return; }
    toast('Saved'); if (isNew) nav('/admin/giveaways/' + r.id); else manageGiveaway(id);
  });
  if (isNew) return;
  $('#del').onclick = async () => { if (!confirm('Delete this giveaway and its winners? This cannot be undone.')) return; await api('/api/admin/giveaways/' + id, { method: 'DELETE' }); toast('Deleted'); nav('/admin/giveaways'); };
  const en = $('#endnow'); if (en) en.onclick = async () => {
    if (!confirm('End this giveaway now and lock the final standings? Scores after this moment will not count. This cannot be undone.')) return;
    const r = await api(`/api/admin/giveaways/${id}/finalize`, { method: 'POST' }); if (!r.ok) return toast(r.error);
    toast('Final standings locked'); manageGiveaway(id);
  };
  const drawEnt = () => { const n = Math.max(1, +$('#viewn').value || 10); $('#ent').innerHTML = entrants.length ? `<table class="tbl"><thead><tr><th>#</th><th>Player</th><th class="num">Best</th><th class="num">Runs</th></tr></thead><tbody>${entrants.slice(0, n).map(x => `<tr><td>${x.rank}</td><td>${esc(x.username)}${demoTag(x.demo)}${g.finalized_at && g.winners.some(w => w.username === x.username) ? ` <span class="pill gold">${icon('crown')} winner</span>` : ''}</td><td class="num">${fmt(x.score)}</td><td class="num">${fmt(x.runs)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">No entrants yet.</div>'; };
  $('#viewn').oninput = drawEnt; drawEnt();
  loadReview(id, g);
}
const AUDIT_L = { created: 'Giveaway created', seed_committed: 'Draw seed committed', finalized: 'Final standings locked', ended_early: 'Ended early by admin', provisional_winner: 'Provisional winner', confirmed: 'Winner confirmed', disqualified: 'Disqualified', promoted: 'Promoted to a winning place', reinstated: 'Reinstated' };
const flagChip = (f) => `<span class="flag f-${f.level}" title="${esc(f.text)}">${icon(f.level === 'high' ? 'shield-alert' : f.level === 'med' ? 'triangle-alert' : 'info')}${esc(f.text)}</span>`;
const secs = (ms) => ms == null ? '' : `${(ms / 1000).toFixed(1)}s`;
async function loadReview(id, g) {
  const n = Math.max(1, +($('#rqn') || {}).value || 10);
  const r = await api(`/api/admin/giveaways/${id}/review?n=${n}`); const box = $('#rq'); if (!box) return;
  if (!r.ok) { box.innerHTML = `<div class="err">${esc(r.error)}</div>`; return; }
  const runsTbl = (e) => `<details class="rq-runs"><summary>${fmt(e.runs.length)} run${e.runs.length === 1 ? '' : 's'} in the window • IPs ${esc(e.ip_hashes.join(', ') || '-')}</summary><div class="wrap-x"><table class="tbl sm"><thead><tr><th>Run</th><th>Game</th><th class="num">Score</th><th class="num">Client time</th><th class="num">Server time</th><th class="num">Rate / s</th><th class="num">Cap / s</th><th class="num">% of cap</th><th>IP</th><th>Device</th><th>When</th></tr></thead><tbody>
    ${e.runs.map(x => `<tr class="${x.over_cap ? 'bad' : x.best ? 'best' : ''}"><td>#${x.id}${x.best ? ' <span class="pill green">counted</span>' : ''}${x.over_cap ? ' <span class="pill red">over cap</span>' : ''}</td><td>${esc(GAMES.find(y => y.id === x.game_id)?.title || x.game_id)}</td><td class="num">${fmt(x.score)}</td><td class="num">${secs(x.duration_ms)}</td><td class="num">${secs(x.elapsed_ms)}</td><td class="num">${x.rate ?? ''}</td><td class="num">${x.per_sec_cap}</td><td class="num ${x.pct_cap >= 90 ? 'warn' : ''}">${x.pct_cap ?? ''}%</td><td><code>${esc(x.ip)}</code></td><td><code>${esc(x.device)}</code></td><td class="small">${dt(x.created_at)}</td></tr>`).join('')}</tbody></table></div></details>`;
  const item = (e, dq) => `<div class="rq-item ${e.winner ? 'is-win' : ''} ${dq ? 'is-dq' : ''}" data-u="${e.user_id}" data-name="${esc(e.username)}">
    <div class="rq-top"><span class="rq-pos">${dq ? 'DQ' : `#${e.place ?? e.rank}`}</span><div class="rq-who"><b>${esc(e.username)}</b>${e.banned ? ' <span class="pill red">banned</span>' : ''}<div class="tiny muted">Joined ${e.joined_at ? dt(e.joined_at) : '?'} • rank #${e.final_rank ?? e.rank}${e.draw_pos ? ` • draw #${e.draw_pos}` : ''}${e.tiebreak ? ` • tiebreak: ${esc({ time: 'faster run', skill: 'skill metric', playoff: 'playoff', exact: 'EXACT TIE - start a playoff' }[e.tiebreak])}` : ''}</div></div>
      <div class="rq-nums"><div><b>${fmt(e.score)}</b><span>best</span></div><div><b>${fmt(e.attempts)}</b><span>attempts</span></div><div><b>${e.reached_at ? new Date(e.reached_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '-'}</b><span>reached</span></div></div>
      <div class="rq-state">${dq ? `<span class="pill red">${icon('user-x')} Disqualified</span><div class="tiny muted">${esc(e.dq_reason || '')}</div>` : e.state === 'confirmed' ? `<span class="pill green">${icon('badge-check')} Confirmed winner</span>` : e.state === 'pending' ? `<span class="pill amber">${icon('hourglass')} Pending verification</span>` : e.winner ? '<span class="pill">Winning place (live)</span>' : ''}</div></div>
    <div class="rq-flags">${e.flags.length ? e.flags.map(flagChip).join('') : `<span class="flag f-ok">${icon('circle-check')}No flags</span>`}</div>
    ${runsTbl(e)}
    <div class="rq-act">${dq ? `<button class="btn ghost sm" data-reinstate>${icon('rotate-ccw')} Reinstate</button>`
      : `${e.winner || e.state ? (e.potato ? `<span class="potato-contact"><a class="btn sm ghost" data-potato href="${esc(e.potato_url)}" target="_blank" rel="noopener">${icon('message-circle')} Contact on Potato</a><code>@${esc(e.potato)}</code><button class="btn sm ghost" data-copy="@${esc(e.potato)}" aria-label="Copy Potato username">${icon('copy')}</button></span>` : `<span class="pill amber" data-nopotato>${icon('triangle-alert')} No Potato username on file</span>`) : ''}${r.finalized && e.state === 'pending' ? `<button class="btn sm" data-confirm>${icon('badge-check')} Confirm winner</button>` : ''}<button class="btn danger sm" data-dq-open>${icon('user-x')} Disqualify</button>
         <div class="dq-form hidden"><input class="input" data-reason maxlength="300" placeholder="Reason (shown to the player and logged)"><button class="btn danger sm" data-dq-go>Confirm disqualification</button></div>`}</div>
  </div>`;
  box.innerHTML = `<div class="rq-head small muted">${r.finalized ? `Final standings locked ${dt(r.giveaway.finalized_at)}. Confirm each winner after checking their runs. Disqualifying a winner promotes the next place automatically.` : 'Live preview: the giveaway has not ended yet. Confirmation opens once the final standings are locked.'} ${fmt(r.total)} ranked • ${r.ms}ms</div>
    ${r.queue.length ? r.queue.map(e => item(e, false)).join('') : '<div class="empty">No entrants yet.</div>'}
    ${r.disqualified.length ? `<h3 class="rq-sub">Disqualified (${r.disqualified.length})</h3>${r.disqualified.map(e => item(e, true)).join('')}` : ''}
    ${r.excluded_runs.length ? `<h3 class="rq-sub">${icon('shield-alert')} Runs excluded for breaking the score cap (${r.excluded_runs.length})</h3><div class="wrap-x"><table class="tbl sm"><thead><tr><th>Run</th><th>Player</th><th class="num">Score</th><th class="num">Cap</th><th class="num">Server time</th><th class="num">% of cap</th><th>IP</th><th>When</th></tr></thead><tbody>${r.excluded_runs.map(x => `<tr class="bad"><td>#${x.id}</td><td>${esc(x.username)}</td><td class="num">${fmt(x.score)}</td><td class="num">${fmt(x.cap)}</td><td class="num">${secs(x.elapsed_ms)}</td><td class="num warn">${x.pct_cap}%</td><td><code>${esc(x.ip)}</code></td><td class="small">${dt(x.created_at)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  $('#audit').innerHTML = r.audit.length ? `<div class="wrap-x"><table class="tbl sm"><thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Player</th><th>Detail</th></tr></thead><tbody>${r.audit.map(a => { let d = a.detail; try { const o = JSON.parse(d); d = Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'string' && v.length > 24 ? v.slice(0, 24) + '...' : v}`).join(' • '); } catch {} return `<tr data-action="${esc(a.action)}"><td class="small">${dt(a.created_at)}</td><td>${esc(a.actor)}</td><td><b>${esc(AUDIT_L[a.action] || a.action)}</b></td><td>${esc(a.username || '')}</td><td class="small muted">${esc(d)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">No events yet.</div>';
  $('#rqn').onchange = () => loadReview(id, g);
  box.onclick = async (e) => {
    const cp = e.target.closest('[data-copy]'); if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copy); toast('Copied ' + cp.dataset.copy); } catch { prompt('Copy:', cp.dataset.copy); } return; }
    const it = e.target.closest('.rq-item'); if (!it) return; const uid = +it.dataset.u; const name = it.dataset.name;
    if (e.target.closest('[data-dq-open]')) { $('.dq-form', it).classList.toggle('hidden'); const inp = $('[data-reason]', it); if (inp) inp.focus(); return; }
    if (e.target.closest('[data-confirm]')) { const x = await api(`/api/admin/giveaways/${id}/confirm`, { method: 'POST', body: { user_id: uid } }); if (!x.ok) return toast(x.error); toast(`${name} confirmed as winner #${x.winner.place}. Notified in-app + Giveaway Winner badge granted. Message them on Potato to arrange the prize.`); return manageGiveaway(id); }
    if (e.target.closest('[data-dq-go]')) {
      const reason = $('[data-reason]', it).value.trim(); if (!reason) { toast('Enter a reason first'); $('[data-reason]', it).focus(); return; }
      const x = await api(`/api/admin/giveaways/${id}/disqualify`, { method: 'POST', body: { user_id: uid, reason } }); if (!x.ok) return toast(x.error);
      toast(`${name} disqualified.${x.promoted && x.promoted.length ? ` ${x.promoted.map(p => `${p.username} promoted to #${p.place}`).join(', ')}.` : ''}`); return manageGiveaway(id);
    }
    if (e.target.closest('[data-reinstate]')) { const x = await api(`/api/admin/giveaways/${id}/reinstate`, { method: 'POST', body: { user_id: uid } }); if (!x.ok) return toast(x.error); toast(`${name} reinstated`); return manageGiveaway(id); }
  };
}

// v7: bookings -> sponsor requests + quote builder (see sponsorAdmin below)

// ---------- players ----------
async function players(q = '') {
  const r = await api('/api/admin/players?q=' + encodeURIComponent(q));
  frame('players', 'Players', `<div class="toolbar"><input class="input" id="q" placeholder="Search username" value="${esc(q)}"><span class="muted small">${r.players.length} shown</span></div>
    <div class="card wrap-x"><table class="tbl"><thead><tr><th>Player</th><th>Joined</th><th>Last seen</th><th class="num">Runs</th><th class="num">Best</th><th class="num">Wins</th><th>Status</th><th></th></tr></thead><tbody>
    ${r.players.map(p => `<tr data-id="${p.id}" data-name="${esc(p.username)}"><td><a href="/u/${encodeURIComponent(p.username)}" target="_blank"><b>${esc(p.username)}</b></a>${demoTag(p.is_demo)}</td><td class="small">${dt(p.created_at)}</td><td class="small">${p.last_seen ? ago(p.last_seen) : '-'}</td><td class="num">${fmt(p.runs)}</td><td class="num">${fmt(p.best)}</td><td class="num">${p.wins}</td><td>${p.banned ? '<span class="pill red">banned</span>' : '<span class="pill green">ok</span>'}</td>
      <td style="white-space:nowrap"><button class="btn ghost sm" data-ban="${p.banned ? 0 : 1}">${p.banned ? 'Unban' : 'Ban'}</button> <button class="btn ghost sm" data-reset>Reset PW</button> <button class="iconbtn" data-del aria-label="Delete">${icon('trash-2')}</button></td></tr>`).join('') || '<tr><td colspan="8" class="empty">No players.</td></tr>'}
    </tbody></table></div>`, `<a class="btn ghost sm" href="/api/admin/export/players.csv" target="_blank">${icon('download')} CSV</a>`);
  let t; $('#q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => players(e.target.value).then(() => { const i = $('#q'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }), 300); };
  root.querySelector('.tbl').addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return; const id = tr.dataset.id, name = tr.dataset.name;
    const ban = e.target.closest('[data-ban]');
    if (ban) { await api(`/api/admin/players/${id}/ban`, { method: 'POST', body: { banned: ban.dataset.ban === '1' } }); toast(ban.dataset.ban === '1' ? `${name} banned` : `${name} unbanned`); players(q); }
    if (e.target.closest('[data-reset]') && confirm(`Reset password for ${name}?`)) { const r = await api(`/api/admin/players/${id}/reset-password`, { method: 'POST' }); if (r.ok) prompt(`Temporary password for ${name} (send it to them privately):`, r.temp_password); }
    if (e.target.closest('[data-del]') && confirm(`Delete ${name} and all their runs? This cannot be undone.`)) { await api('/api/admin/players/' + id, { method: 'DELETE' }); players(q); }
  });
}

// ---------- leaderboards ----------
async function leaderboards(game = 'global', period = 'all') {
  const r = await api(`/api/leaderboard?game=${game}&period=${period}&limit=500`);
  frame('leaderboards', 'Leaderboards', `<div class="toolbar">
      <select class="input" id="g">${[['global', 'Global (sum of bests)'], ...GAMES.filter(x => x.playable).map(x => [x.id, x.title])].map(([k, l]) => `<option value="${k}" ${k === game ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
      <select class="input" id="p">${[['all', 'All time'], ['weekly', 'Last 7 days'], ['monthly', 'Last 30 days']].map(([k, l]) => `<option value="${k}" ${k === period ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span class="muted small">${fmt(r.total)} players</span><span style="flex:1"></span>
      <a class="btn ghost sm" href="/api/admin/export/leaderboard.csv?game=${game}&period=${period}" target="_blank">${icon('download')} Export CSV</a></div>
    <div class="card wrap-x"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th class="num">Score</th><th class="num">Runs</th><th>Last played</th></tr></thead><tbody>
      ${r.rows.map(x => `<tr><td>${x.rank}</td><td>${esc(x.username)}${demoTag(x.demo)}</td><td class="num">${fmt(x.score)}</td><td class="num">${x.runs}</td><td class="small">${ago(x.last_at)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No scores.</td></tr>'}
    </tbody></table></div>`);
  $('#g').onchange = () => leaderboards($('#g').value, $('#p').value); $('#p').onchange = () => leaderboards($('#g').value, $('#p').value);
}

// ---------- announcements ----------
async function announcements() {
  const r = await api('/api/admin/announcements');
  frame('announcements', 'Announcements', `<div class="cols" style="margin-top:0">
    <div class="card">${r.announcements.map(a => `<div class="act"><span class="dot" style="background:#6366f133;color:#818cf8">${icon('megaphone')}</span><span><b>${esc(a.title)}</b>${demoTag(a.is_demo)}<div class="small muted">${esc(a.body)}</div></span><span class="t">${ago(a.created_at)} <button class="iconbtn" data-del="${a.id}">${icon('trash-2')}</button></span></div>`).join('') || '<div class="empty">No announcements yet.</div>'}</div>
    <form class="card pad" id="af"><h2 style="margin-bottom:10px">Post to Community</h2><div class="field"><input class="input" id="at" placeholder="Title" maxlength="140"></div><div class="field"><textarea class="input" id="ab" placeholder="Message"></textarea></div><button class="btn block">${icon('megaphone')} Post</button></form></div>`);
  $('#af').addEventListener('submit', async (e) => { e.preventDefault(); const x = await api('/api/admin/announcements', { method: 'POST', body: { title: $('#at').value, body: $('#ab').value } }); if (!x.ok) return toast(x.error); toast('Posted'); announcements(); });
  root.addEventListener('click', async function h(e) { const b = e.target.closest('[data-del]'); if (!b || !location.pathname.endsWith('announcements')) return; if (!confirm('Delete announcement?')) return; await api('/api/admin/announcements/' + b.dataset.del, { method: 'DELETE' }); root.removeEventListener('click', h); announcements(); });
}


// ---------- tournaments (v3) ----------
const T_ST = { upcoming: '', live: 'green', qualifying: 'green', quarterfinals: 'green', semifinals: 'green', final: 'green', ended: 'red' };
async function tournaments(editId) {
  const r = await api('/api/admin/tournaments'); const list = r.tournaments;
  const t = editId && editId !== 'new' ? list.find(x => String(x.id) === String(editId)) : null;
  const H = 3600e3; const n = nowS();
  const v = t || { title: '', game_id: GAMES[0]?.id, format: 'timed', description: '', prize: 'Cosmetic title + bragging rights', start_at: n + H, end_at: n + 72 * H, qual_end_at: n + 48 * H, round_ms: 24 * H, active: true };
  frame('tournaments', 'Tournaments', `<div class="cols" style="margin-top:0">
    <div class="card wrap-x"><table class="tbl"><thead><tr><th>Tournament</th><th>Format</th><th>Status</th><th>Window</th><th class="num">Players</th><th></th></tr></thead><tbody>
      ${list.map(x => `<tr><td><b>${esc(x.title)}</b>${demoTag(x.demo)}<div class="small muted">${esc(x.game)}${x.active ? '' : ' • hidden'}</div></td><td>${x.format}</td><td><span class="pill ${T_ST[x.status] || ''}">${x.status}</span></td>
        <td class="small">${dt(x.start_at)}<br>→ ${dt(x.end_at)}</td><td class="num">${fmt(x.players)}</td>
        <td style="white-space:nowrap"><a class="btn sm ghost" href="/admin/tournaments/${x.id}">Edit</a> <a class="btn sm ghost" href="/tournaments/${x.id}" target="_blank">View</a> <button class="iconbtn" data-tdel="${x.id}" aria-label="Delete ${esc(x.title)}">${icon('trash-2')}</button></td></tr>`).join('')
        || '<tr><td colspan="6"><div class="empty">No tournaments yet. Create one to drive engagement around a game.</div></td></tr>'}
    </tbody></table></div>
    <form class="card pad" id="tf"><h2 style="margin-bottom:10px">${t ? 'Edit tournament' : 'New tournament'}</h2><div id="tm"></div>
      <div class="field"><label class="lbl" for="tt">Title</label><input class="input" id="tt" maxlength="100" value="${esc(v.title)}" required></div>
      <div class="field"><label class="lbl" for="tg">Game</label><select class="input" id="tg">${GAMES.filter(g => g.playable).map(g => `<option value="${g.id}" ${g.id === v.game_id ? 'selected' : ''}>${esc(g.title)}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl" for="tfm">Format</label><select class="input" id="tfm"><option value="timed" ${v.format === 'timed' ? 'selected' : ''}>Timed event (best score in window)</option><option value="bracket" ${v.format === 'bracket' ? 'selected' : ''}>Bracket (qualify, then top 8 knockout)</option></select></div>
      <div class="field"><label class="lbl" for="ts">Start</label><input class="input" type="datetime-local" id="ts" value="${toLocalInput(v.start_at)}"></div>
      <div class="field f-timed"><label class="lbl" for="te">End</label><input class="input" type="datetime-local" id="te" value="${toLocalInput(v.end_at)}"></div>
      <div class="field f-br"><label class="lbl" for="tq">Qualifying ends</label><input class="input" type="datetime-local" id="tq" value="${toLocalInput(v.qual_end_at || v.start_at + 48 * H)}"></div>
      <div class="field f-br"><label class="lbl" for="tr">Hours per knockout round (3 rounds)</label><input class="input" type="number" id="tr" min="1" max="168" value="${Math.round((v.round_ms || 24 * H) / H)}"></div>
      <div class="field"><label class="lbl" for="tp">Prize (cosmetic / bragging rights)</label><input class="input" id="tp" maxlength="200" value="${esc(v.prize || '')}"></div>
      <div class="field"><label class="lbl" for="td">Description</label><textarea class="input" id="td" maxlength="2000">${esc(v.description || '')}</textarea></div>
      <label class="check"><input type="checkbox" id="ta" ${v.active ? 'checked' : ''}> Visible to players</label>
      <p class="small muted">Free entry, no purchase necessary. Keep prizes cosmetic, or link a giveaway with official rules for real prizes.</p>
      <button class="btn block" type="submit">${icon('check')} ${t ? 'Save changes' : 'Create & notify players'}</button>
      ${t ? '<a class="btn ghost block" style="margin-top:8px" href="/admin/tournaments/new">New tournament</a>' : ''}
    </form></div>`, '<a class="btn sm" href="/admin/tournaments/new">' + icon('plus') + ' New</a>');
  const sync = () => { const br = $('#tfm').value === 'bracket'; root.querySelectorAll('.f-br').forEach(e => e.classList.toggle('hidden', !br)); root.querySelectorAll('.f-timed').forEach(e => e.classList.toggle('hidden', br)); };
  $('#tfm').onchange = sync; sync();
  $('#tf').addEventListener('submit', async (e) => {
    e.preventDefault(); const ms = (id) => new Date($(id).value).getTime();
    const body = { title: $('#tt').value, game_id: $('#tg').value, format: $('#tfm').value, start_at: ms('#ts'), end_at: ms('#te'), qual_end_at: ms('#tq'), round_ms: (+$('#tr').value || 24) * H, prize: $('#tp').value, description: $('#td').value, active: $('#ta').checked };
    const x = await api(t ? '/api/admin/tournaments/' + t.id : '/api/admin/tournaments', { method: t ? 'PUT' : 'POST', body });
    if (!x.ok) { $('#tm').innerHTML = `<div class="err">${esc(x.error)}</div>`; return; }
    toast(t ? 'Saved' : 'Tournament created - players notified'); nav('/admin/tournaments');
  });
  root.querySelectorAll('[data-tdel]').forEach(b => b.onclick = async () => { if (!confirm('Delete this tournament?')) return; await api('/api/admin/tournaments/' + b.dataset.tdel, { method: 'DELETE' }); toast('Deleted'); nav('/admin/tournaments'); });
}

// ---------- reports ----------
async function reports() {
  const r = await api('/api/admin/runs');
  frame('reports', 'Reports & Exports', `<div class="stats" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
    ${[['Leaderboard (global, all time)', '/api/admin/export/leaderboard.csv?game=global'], ['Jetpack Dash leaderboard', '/api/admin/export/leaderboard.csv?game=jetpack-dash'], ['All runs', '/api/admin/export/runs.csv'], ['Players', '/api/admin/export/players.csv'], ['Bookings', '/api/admin/export/bookings.csv']]
      .map(([l, u]) => `<a class="card stat" href="${u}" target="_blank" style="color:var(--text)"><div class="ic" style="background:#22d3ee22;color:#22d3ee">${icon('download')}</div><div><b style="font-size:.95rem">${l}</b><span>CSV download</span></div></a>`).join('')}</div>
    <div class="card" style="margin-top:16px"><div class="panel-h"><h2>Rejected score submissions (anti-cheat)</h2></div>
    <div class="wrap-x"><table class="tbl"><thead><tr><th>When</th><th>Player</th><th>Game</th><th>Reason</th></tr></thead><tbody>${r.rejected.map(x => `<tr><td class="small">${dt(x.used_at)}</td><td>${esc(x.username)}</td><td>${esc(x.game_id)}</td><td class="small">${esc(x.reason)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">None - nice.</td></tr>'}</tbody></table></div></div>
    <p class="small muted">Per-giveaway entrant CSVs are on each giveaway's Manage page.</p>`);
}

// ---------- settings ----------
async function settings() {
  const [s, ac, bk] = await Promise.all([api('/api/admin/stats'), api('/api/admin/achievements'), api('/api/admin/backups')]);
  const kb = (n) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const bst = bk.status || {}; const gh = bst.last_github;
  frame('settings', 'Settings', `
    <div class="card pad" id="pkg-editor"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="flex:1">${icon('briefcase')} Sponsor prices</h2><a class="btn sm" href="/admin/sponsor/prices">${icon('pencil')} Edit the price sheet</a></div>
      <p class="muted small" style="margin:6px 0 0">Prices are admin-only: sponsors pick features on <a href="/sponsor" target="_blank">/sponsor</a> and get a quote built from this sheet.</p></div>
    <div class="cols">
    <div class="card pad"><h2 style="margin-bottom:8px">Demo data</h2><p class="muted">Sample players, giveaways, bookings and announcements used for previews are tagged <span class="demo-tag">DEMO</span>. Currently: ${s.demo.players} demo players, ${s.demo.giveaways} demo giveaways.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn danger" id="wipe">${icon('trash-2')} Wipe demo data</button><button class="btn ghost" id="seed">${icon('sparkles')} Load demo data</button></div>
      <h2 style="margin:16px 0 8px">Achievements</h2><p class="muted small">${ac.achievements.length} achievements, ${fmt(ac.unlocks)} unlocks across ${fmt(ac.players)} players. Rewards are cosmetic only (no cash value) and are evaluated on the server.</p></div>
    <div class="card pad"><h2 style="margin-bottom:8px">Admin password</h2><p class="muted">The admin password lives in the server's <code>.env</code> file (<code>ADMIN_PASSWORD</code>). Edit it there and restart the server to change it.</p>
    <h2 style="margin:16px 0 8px">Anti-cheat</h2><p class="muted small">Runs need a signed single-use token from /api/run/start. Each game has its own plausibility caps against server-measured run time (see Games); starts and submissions are rate limited per player and per IP.</p></div></div>
    <div class="card pad" id="backups" style="margin-top:16px"><h2 style="margin-bottom:8px">${icon('download')} Database backups</h2>
      <p class="muted small">A consistent snapshot of the SQLite database (gzip) is made automatically every ${bk.interval_hours} h and whenever you press the button. Up to the newest ${bk.keep} (max ${bk.max_mb} MB in total) stay on the server's data disk.
        Off-site copy: ${bk.github.enabled ? `pushed to the private GitHub repo <b>${esc(bk.github.repo)}</b>, branch <b>${esc(bk.github.branch)}</b> (newest ${bk.github.keep} kept)` : 'not configured - set <code>BACKUP_GITHUB_TOKEN</code> (see DEPLOY-DEPLEXO.md), or download a copy regularly'}.</p>
      <p class="small">Last backup: ${bst.last_local ? `${dt(bst.last_local.at)} (${kb(bst.last_local.size)})` : 'none yet'}${gh ? ` • Last GitHub push: ${gh.ok ? `<span class="pill green">ok</span> ${dt(gh.at)}` : `<span class="pill red">failed</span> ${esc(gh.error)}`}` : ''}${bst.last_error ? ` • <span class="pill red">last error</span> ${esc(bst.last_error.error)}` : ''}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px"><button class="btn" id="bk-now">${icon('refresh-cw')} Back up now</button><a class="btn ghost" id="bk-dl" href="/api/admin/backups/download">${icon('download')} Download backup</a></div>
      <div class="wrap-x"><table class="tbl"><thead><tr><th>Backup file</th><th>Created</th><th>Size</th><th></th></tr></thead><tbody>${(bk.backups || []).map(b => `<tr><td class="small">${esc(b.name)}</td><td class="small">${dt(b.created_at)}</td><td class="small">${kb(b.size)}</td><td><a class="btn ghost sm" href="/api/admin/backups/download?name=${encodeURIComponent(b.name)}">${icon('download')} Download</a></td></tr>`).join('') || '<tr><td colspan="4" class="empty">No backups yet.</td></tr>'}</tbody></table></div></div>`);
  $('#bk-now').onclick = async (e) => { e.target.disabled = true; const r = await api('/api/admin/backups', { method: 'POST' }); toast(r.ok ? `Backup saved${r.push ? (r.push.ok ? ' and pushed to GitHub' : ' (GitHub push failed: ' + r.push.error + ')') : ''}` : 'Backup failed: ' + r.error); settings(); };
  $('#wipe').onclick = async () => { if (!confirm('Delete all demo data? Real players and giveaways are not touched.')) return; const r = await api('/api/admin/demo/wipe', { method: 'POST' }); toast(`Removed ${r.players} demo players, ${r.giveaways} giveaways`); settings(); };
  $('#seed').onclick = async () => { const r = await api('/api/admin/demo/seed', { method: 'POST' }); toast(r.seeded ? 'Demo data loaded' : r.note); settings(); };
}

render();

// ---------- brands (v5 channels table) ----------
async function channels(editId) {
  const r = await api('/api/admin/channels');
  const c = editId && editId !== 'new' ? r.channels.find(x => String(x.id) === String(editId)) : null;
  const f = c || { name: '', slug: '', tagline: '', logo: '', color: '#7c3aed', tier: 'basic', link_url: '', link_label: '', business_type: '', active: 1 };
  const br = await api('/api/admin/brands'); const BI = Object.fromEntries((br.brands || []).map(b => [b.id, b]));
  frame('channels', 'Brands', `<p class="muted small" style="margin-top:0">Players belong to one brand at a time. They join with the brand's invite link or code (or pick a brand at signup) and can switch every ${br.cooldown_days || 30} days. A brand's giveaways are for its members unless the giveaway is marked "Open to everyone".</p>
    <div class="cols" style="margin-top:0;grid-template-columns:1.2fr 1fr">
      <div class="card wrap-x"><table class="tbl" id="ch-tbl"><thead><tr><th>Brand</th><th>Invite link</th><th class="num">Members</th><th class="num">Link clicks</th><th>Visible</th><th></th></tr></thead><tbody>
        ${r.channels.length ? r.channels.map(x => `<tr data-ch="${x.id}"><td><b>${esc(x.name)}</b>${demoTag(x.is_demo)}<div class="small muted">${esc(x.slug)}</div></td><td>${BI[x.id] ? `<code class="inv" data-inv="${esc(location.origin + BI[x.id].invite_path)}" title="Click to copy">/join/${esc(BI[x.id].invite_code)}</code> <button type="button" class="btn ghost sm" data-newcode="${x.id}" title="New code (old link stops working)">${icon('refresh-cw')}</button>` : ''}</td><td class="num">${fmt(BI[x.id] ? BI[x.id].members : 0)}</td><td class="num">${fmt(x.clicks)}</td><td>${x.active ? '<span class="pill green">on</span>' : '<span class="pill red">off</span>'}</td><td><a class="btn sm" href="/admin/channels/${x.id}">Edit</a></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No brands yet.</td></tr>'}
      </tbody></table></div>
      <form class="card pad" id="chf"><h2 style="margin-bottom:10px">${c ? 'Edit brand' : 'New brand'}</h2><div id="chm"></div>
        <div class="field"><label class="lbl">Brand name</label><input class="input" id="c-name" value="${esc(f.name)}" maxlength="60" required></div>
        <div class="field"><label class="lbl">Slug <span class="muted small">(players can also type it as the brand code)</span></label><input class="input" id="c-slug" value="${esc(f.slug)}" maxlength="40" placeholder="auto from name"></div>
        <div class="field"><label class="lbl">Tagline</label><input class="input" id="c-tag" value="${esc(f.tagline)}" maxlength="160"></div>
        <div class="field"><label class="lbl">Logo</label><input class="input" id="c-logo" value="${esc(f.logo)}" placeholder="/assets/... or https://..." maxlength="300"></div>
        <div class="form-grid"><div class="field"><label class="lbl">Color</label><input type="color" id="c-color" value="${esc(f.color || '#7c3aed')}" style="width:56px;height:44px;border:0;background:none"></div></div>
        <div class="field"><label class="lbl">Brand link <span class="muted small">(fallback for giveaways with a link placement)</span></label><input class="input" id="c-link" value="${esc(f.link_url)}" placeholder="https://..." maxlength="300"><input class="input" id="c-linkl" value="${esc(f.link_label)}" placeholder="Button label" maxlength="40" style="margin-top:6px"></div>
        <div class="field"><label class="lbl">Business type</label><input class="input" id="c-bt" value="${esc(f.business_type)}" maxlength="80"></div>
        <label class="check"><input type="checkbox" id="c-active" ${f.active ? 'checked' : ''}> Visible</label>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" style="flex:1">${icon('check')} ${c ? 'Save' : 'Create brand'}</button>${c ? `<button class="btn danger" type="button" id="c-del">${icon('trash-2')}</button>` : ''}</div>
      </form></div>`, `<a class="btn sm" href="/admin/channels/new">${icon('plus')} New brand</a>`);
  $('#ch-tbl').onclick = async (e) => {
    const inv = e.target.closest('[data-inv]'); if (inv) { try { await navigator.clipboard.writeText(inv.dataset.inv); toast('Invite link copied'); } catch { toast(inv.dataset.inv); } return; }
    const nc = e.target.closest('[data-newcode]'); if (nc && confirm('Make a new invite code? The old link stops working.')) { const x = await api(`/api/admin/brands/${nc.dataset.newcode}/new-code`, { method: 'POST' }); toast(x.ok ? 'New code: ' + x.invite_code : x.error); channels(editId); }
  };
  $('#chf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: $('#c-name').value, slug: $('#c-slug').value, tagline: $('#c-tag').value, logo: $('#c-logo').value.trim(), color: $('#c-color').value, link_url: $('#c-link').value.trim(), link_label: $('#c-linkl').value, business_type: $('#c-bt').value, active: $('#c-active').checked };
    const x = await api(c ? '/api/admin/channels/' + c.id : '/api/admin/channels', { method: c ? 'PUT' : 'POST', body });
    if (!x.ok) { $('#chm').innerHTML = `<div class="err">${esc(x.error)}</div>`; return; }
    toast('Saved'); nav('/admin/channels');
  });
  const d = $('#c-del'); if (d) d.onclick = async () => { if (!confirm('Delete this brand? Its giveaways stay (as hub-wide) and its members become brand-less.')) return; await api('/api/admin/channels/' + c.id, { method: 'DELETE' }); toast('Deleted'); nav('/admin/channels'); };
}

// ---------- v5: admin-only badges ----------
async function badges() {
  const r = await api('/api/admin/badges');
  frame('badges', 'Special Badges', `<p class="muted small" style="margin-top:0">Special badges can't be unlocked by playing. Grant them to staff, the Trap Tech team, verified hosts/sponsors, beta testers, founders and community MVPs. "Giveaway Winner" is granted automatically when you confirm a winner. Every grant and revoke is logged.</p>
    <div class="badge-defs">${r.badges.map(b => `<div class="card bdef" data-badge="${esc(b.id)}"><img src="${esc(b.art)}" alt="" width="52" height="52"><div><b>${esc(b.name)}</b><div class="tiny muted">${esc(b.desc)}</div><div class="tiny">${fmt(b.holders)} holder${b.holders === 1 ? '' : 's'}</div></div></div>`).join('')}</div>
    <form class="card pad" id="bgf" style="margin-top:14px"><h2 style="margin-bottom:10px">${icon('badge-plus')} Grant or revoke</h2><div id="bgm"></div>
      <div class="form-grid"><div class="field"><label class="lbl">Player username</label><input class="input" id="bg-user" placeholder="username" autocapitalize="none" required></div>
        <div class="field"><label class="lbl">Badge</label><select class="input" id="bg-badge">${r.badges.map(b => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></div>
        <div class="field full"><label class="lbl">Note <span class="muted small">(logged)</span></label><input class="input" id="bg-note" maxlength="200" placeholder="Why?"></div></div>
      <div style="display:flex;gap:8px"><button class="btn" id="bg-grant" style="flex:1">${icon('badge-plus')} Grant badge</button><button class="btn danger" type="button" id="bg-revoke">${icon('badge-minus')} Revoke</button></div></form>
    <div class="cols"><div class="card"><div class="panel-h"><h2>Current holders</h2></div><div class="wrap-x"><table class="tbl sm" id="bg-holders"><thead><tr><th>Player</th><th>Badge</th><th>By</th><th>Note</th><th>When</th></tr></thead><tbody>${r.grants.map(g => `<tr><td>${esc(g.username)}</td><td>${esc((r.badges.find(b => b.id === g.badge_id) || {}).name || g.badge_id)}</td><td>${esc(g.granted_by)}</td><td class="small muted">${esc(g.note)}</td><td class="small">${dt(g.created_at)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Nobody yet.</td></tr>'}</tbody></table></div></div>
      <div class="card"><div class="panel-h"><h2>${icon('scroll-text')} Audit log</h2></div><div class="wrap-x"><table class="tbl sm" id="bg-audit"><thead><tr><th>When</th><th>Action</th><th>Player</th><th>Badge</th><th>Actor</th><th>Note</th></tr></thead><tbody>${r.audit.map(a => `<tr><td class="small">${dt(a.created_at)}</td><td><b>${esc(a.action)}</b></td><td>${esc(a.username)}</td><td>${esc(a.badge_id)}</td><td>${esc(a.actor)}</td><td class="small muted">${esc(a.note)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No events yet.</td></tr>'}</tbody></table></div></div></div>`);
  const send = async (act) => { const x = await api('/api/admin/badges/' + act, { method: 'POST', body: { username: $('#bg-user').value.trim(), badge: $('#bg-badge').value, note: $('#bg-note').value } });
    if (!x.ok) { $('#bgm').innerHTML = `<div class="err">${esc(x.error)}</div>`; return; } toast(act === 'grant' ? 'Badge granted - player notified' : 'Badge revoked'); badges(); };
  $('#bgf').addEventListener('submit', (e) => { e.preventDefault(); send('grant'); });
  $('#bg-revoke').onclick = () => { if ($('#bg-user').value.trim()) send('revoke'); };
}

// ---------- v5: fair-play review (anti-cheat) ----------
async function fairplay(status) {
  const r = await api('/api/admin/flags?status=' + status);
  const L = { open: 'Held for review', note: 'Notes (counted)', cleared: 'Cleared', confirmed: 'Confirmed cheating' };
  frame('fairplay', 'Fair Play Review', `<p class="muted small" style="margin-top:0">Only physically impossible scores are rejected. Everything else is saved. <b>Held</b> runs are hidden from leaderboards and giveaways until you clear them; <b>notes</b> count normally and are just for your awareness. Memory Match runs are replayed on the server from the run seed. Nobody is ever banned automatically.</p>
    <div class="tabs" id="fp-tabs">${Object.entries(L).map(([k, l]) => `<a href="/admin/fairplay?status=${k}" class="${k === status ? 'on' : ''}" style="padding:8px 12px">${l} <span class="pill">${fmt(r.counts[k] || 0)}</span></a>`).join('')}</div>
    <div id="fp-list">${r.flags.length ? r.flags.map(f => `<div class="card pad fp-item" data-run="${f.run_id}"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><b>${esc(f.username)}</b><span class="muted small">${esc(GAMES.find(g => g.id === f.game_id)?.title || f.game_id)} • run #${f.run_id}</span><b class="orb">${fmt(f.score)}</b><span class="small muted">${(f.elapsed_ms / 1000).toFixed(1)}s server time • ${dt(f.created_at)}</span>${f.verify ? `<span class="pill green">${esc(f.verify)}</span>` : ''}</div>
      <div class="rq-flags" style="margin:8px 0">${f.reasons.map(x => `<span class="flag f-${x.sev >= 2 ? 'high' : 'low'}">${icon(x.sev >= 2 ? 'shield-alert' : 'info')}${esc(x.text)}</span>`).join('')}</div>
      <div class="small muted">Previous runs: ${f.history.map(h => fmt(h.score)).join(', ') || 'none'}</div>
      ${status === 'open' || status === 'note' ? `<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><input class="input" data-note placeholder="Note (optional)" style="flex:1;min-width:160px;height:38px"><button class="btn sm" data-clear>${icon('circle-check')} Clear - score counts</button><button class="btn danger sm" data-confirm-cheat>${icon('ban')} Confirm cheating - keep excluded</button></div>` : `<div class="tiny muted" style="margin-top:6px">${esc(f.reviewed_by || '')} ${f.reviewed_at ? dt(f.reviewed_at) : ''} ${esc(f.note || '')}</div>`}</div>`).join('') : '<div class="empty card">Nothing here. </div>'}</div>`);
  $('#fp-list').onclick = async (e) => { const it = e.target.closest('.fp-item'); if (!it) return; const act = e.target.closest('[data-clear]') ? 'clear' : e.target.closest('[data-confirm-cheat]') ? 'confirm' : null; if (!act) return;
    const x = await api(`/api/admin/flags/${it.dataset.run}/${act}`, { method: 'POST', body: { note: ($('[data-note]', it) || {}).value || '' } }); if (!x.ok) return toast(x.error); toast(act === 'clear' ? 'Cleared - the run now counts' : 'Kept excluded'); fairplay(status); };
}

// ---------- v7: security (2FA, password, sessions, sign-in audit log) ----------
async function security() {
  const r = await api('/api/admin/security');
  const EV = { 'login-ok': ['log-in', 'green', 'Signed in'], 'password-ok': ['fingerprint', '', 'Password OK, waiting for code'], 'login-fail': ['circle-x', 'red', 'Wrong password'], 'totp-fail': ['circle-x', 'red', 'Wrong authenticator code'],
    'locked-out': ['lock', 'red', 'Blocked (locked out)'], 'rate-limited': ['timer', 'red', 'Rate limited'], 'reset-ok': ['shield-plus', 'green', 'Reset with ADMIN_RESET_TOKEN'], 'reset-fail': ['circle-x', 'red', 'Wrong reset token'],
    'logout': ['log-out', '', 'Signed out'], 'logout-all': ['log-out', '', 'Signed out everywhere'], 'password-changed': ['fingerprint', 'green', 'Password changed'], 'password-change-fail': ['circle-x', 'red', 'Password change refused'], 'backup-codes-regenerated': ['refresh-cw', '', 'New backup codes'], 'account-created': ['user-plus', 'green', 'Admin account created'], 'account-updated': ['user-check', '', 'Admin account changed'], 'account-reset': ['shield-plus', '', 'Admin sign-in reset by owner'], 'account-removed': ['user-x', 'red', 'Admin account removed'] };
  frame('security', 'Security', `
    <div class="grid2" style="display:grid;gap:14px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
      <div class="card pad"><h2 style="margin-top:0">${icon('shield-check')} Sign-in protection</h2>
        <ul class="small" style="margin:0;padding-left:18px;line-height:1.7">
          <li>Secret admin address (ADMIN_PATH). Old /admin links return 404.</li>
          <li>Signed in as <b>${esc(r.account.username)}</b> (${esc(r.account.role)})</li>
          ${r.account.must_change ? '<li style="color:#fcd34d"><b>You are using a temporary password. Choose your own below.</b></li>' : ''}
          <li>Password: <b>${esc(r.password_source)}</b>${r.password_set_at ? ' (changed ' + ago(r.password_set_at) + ')' : ''}</li>
          <li>Authenticator app: <b>${r.totp_enrolled_at ? 'on since ' + dt(r.totp_enrolled_at) : 'not set up'}</b></li>
          <li>Backup codes left: <b>${r.backup_codes_left}</b></li>
          <li>Failed attempts in the last 24 h: <b>${r.failed_24h}</b></li>
          <li>Client IP source: <b>${r.trust_cf ? 'Cloudflare (CF-Connecting-IP)' : 'direct connection'}</b></li>
          ${r.reset_token_active ? '<li style="color:#fca5a5"><b>ADMIN_RESET_TOKEN is set.</b> Remove it from the host settings and restart.</li>' : ''}
        </ul></div>
      <div class="card pad"><h2 style="margin-top:0">${icon('fingerprint')} Change password</h2>
        <form id="pwf" style="display:grid;gap:8px"><div id="pwm"></div>
          <input class="input" type="password" id="pw-cur" placeholder="Current password" autocomplete="current-password" required>
          <input class="input" type="password" id="pw-new" placeholder="New password (12+ characters)" autocomplete="new-password" minlength="12" required>
          <input class="input" id="pw-code" placeholder="Authenticator code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required>
          <button class="btn">Change password and sign out everywhere</button></form>
        <p class="tiny muted">Stored as a bcrypt hash in the database; it replaces the ADMIN_PASSWORD env var from now on.</p></div>
      <div class="card pad"><h2 style="margin-top:0">${icon('refresh-cw')} Backup codes &amp; sessions</h2>
        <form id="bcf" style="display:grid;gap:8px"><input class="input" id="bc-code" placeholder="Authenticator code" inputmode="numeric" maxlength="6" required><button class="btn ghost">Make 10 new backup codes</button></form><pre id="bc-out" class="small" style="white-space:pre-wrap"></pre>
        <p class="small" style="margin:10px 0 6px">${r.sessions.length} active session${r.sessions.length === 1 ? '' : 's'} on your account</p>
        <button class="btn ghost sm" id="lo-all">${icon('log-out')} Sign out all sessions</button></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="panel-h"><h2>${icon('scroll-text')} Sign-in audit log</h2><span class="small muted">last 200 events</span></div>
      <div class="wrap-x"><table class="tbl" id="sec-log"><thead><tr><th>When</th><th>Account</th><th>Event</th><th>Network</th><th>Device</th></tr></thead><tbody>
      ${r.log.map(l => { const e = EV[l.event] || ['circle-dot', '', l.event]; return `<tr data-ev="${esc(l.event)}"><td class="small" style="white-space:nowrap">${dt(l.at)}</td><td class="small">${esc(l.username || '-')}</td><td><span class="pill ${e[1]}">${icon(e[0])} ${esc(e[2])}</span>${l.detail ? `<div class="tiny muted">${esc(l.detail)}</div>` : ''}</td><td class="small">${esc(l.ip_hint)}</td><td class="tiny muted">${esc((l.ua || '').slice(0, 70))}</td></tr>`; }).join('') || '<tr><td colspan="5" class="empty">No events yet.</td></tr>'}
      </tbody></table></div></div>`);
  $('#pwf').onsubmit = async (e) => {
    e.preventDefault(); const x = await api('/api/admin/security/password', { method: 'POST', body: { current: $('#pw-cur').value, new_password: $('#pw-new').value, code: $('#pw-code').value } });
    if (!x.ok) { $('#pwm').innerHTML = `<div class="err">${esc(x.error)}</div>`; return; }
    alert(x.note); location.href = AP + '/';
  };
  $('#bcf').onsubmit = async (e) => { e.preventDefault(); const x = await api('/api/admin/security/backup-codes', { method: 'POST', body: { code: $('#bc-code').value } }); $('#bc-out').textContent = x.ok ? 'Save these now (old codes no longer work):\n' + x.backup_codes.join('\n') : x.error; };
  $('#lo-all').onclick = async () => { if (!confirm('Sign out every admin session, including this one?')) return; await api('/api/admin/security/logout-all', { method: 'POST' }); location.href = AP + '/'; };
}

// ---------- v7: Sponsor a Host - requests, quote builder, price sheet (admin-only prices) ----------
const PLACE_L = [['giveaway', 'Link on the giveaway page'], ['game', 'Link on the game page'], ['announcement', 'Link in the launch announcement'], ['featured', 'Home Featured row'], ['hero', 'Home hero takeover'], ['skin', 'Branded game skin / theme'], ['open', 'Open to every hub player']];
const usd = (c) => '$' + ((Math.round(c) || 0) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const QS_PILL = { draft: ['', 'Draft'], sent: ['amber', 'Sent'], accepted: ['green', 'Accepted'], declined: ['red', 'Declined'], paid: ['green', 'Paid'] };
const qPill = (st) => { const [c, l] = QS_PILL[st] || QS_PILL.draft; return `<span class="pill ${c}">${l}</span>`; };
async function sponsorAdmin(id) {
  const r = await api('/api/admin/sponsor/requests'); const list = r.requests || [];
  const cur = id ? (await api('/api/admin/sponsor/requests/' + id)) : null; const q = cur && cur.ok ? cur.request : null;
  const tabs = `<div class="tabs" style="margin:0 0 12px"><a class="on" href="/admin/sponsor">${icon('inbox')} Requests</a><a href="/admin/sponsor/prices">${icon('banknote')} Price sheet</a></div>`;
  const row = (b) => `<tr data-id="${b.id}" class="${q && q.id === b.id ? 'sel' : ''}"><td>${b.id}</td><td><a href="/admin/sponsor/${b.id}"><b>${esc(b.brand)}</b></a>${demoTag(b.is_demo)}<div class="small muted">${ago(b.created_at)} • ${esc(b.business_type || '')}${b.licensed_confirmed ? ' • licensed' : ''}</div></td><td class="num">${b.features.length}</td><td>${qPill(b.quote.status)}</td><td class="num">${usd(b.quote.total_cents)}</td></tr>`;
  let editor = `<div class="card pad"><p class="muted">Pick a request to build its quote. The draft is totalled automatically from the <a href="/admin/sponsor/prices">price sheet</a>; adjust lines, add custom items or a discount, then send it to the sponsor's private status page.</p></div>`;
  if (q) {
    const Q = q.quote; const locked = ['accepted', 'paid'].includes(Q.status); const L = Q.lines.map(l => ({ ...l }));
    const statusUrl = location.origin + '/sponsor/status/' + q.public_token;
    editor = `<div class="card pad" id="qb"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="flex:1">#${q.id} ${esc(q.brand)}</h2>${qPill(Q.status)}</div>
      <div class="small muted" style="margin:4px 0 10px">${esc(q.contact || '')}${q.contact_name ? ' • ' + esc(q.contact_name) : ''} • dates ${esc(q.start_date || 'flexible')} → ${esc(q.end_date || 'flexible')}${q.username ? ' • player @' + esc(q.username) : ''}</div>
      <details ${Q.saved ? '' : 'open'}><summary class="lbl">${icon('list-checks')} Asked for (${q.features.length})</summary><ul class="small" style="margin:6px 0 10px;padding-left:18px">${q.features.map(f => `<li>${esc(f.name)}${f.unit !== 'flat' ? ` - ${f.qty}${f.unit === 'week' ? ' wk' : ''}` : ''}${f.note ? ` <span class="muted">(${esc(f.note)})</span>` : ''}</li>`).join('')}</ul>
        ${q.details ? `<p class="small"><b>Details:</b> ${esc(q.details)}</p>` : ''}${q.notes ? `<p class="small"><b>Notes:</b> ${esc(q.notes)}</p>` : ''}
        ${cur.placements.length ? `<p class="small"><b>Giveaway placements to tick:</b> ${cur.placements.map(k => esc((PLACE_L.find(x => x[0] === k) || [k, k])[1])).join(', ')}</p>` : ''}</details>
      <div id="qm"></div>
      <div class="wrap-x"><table class="tbl qtbl"><thead><tr><th>Line</th><th class="num">Qty</th><th class="num">Unit $</th><th class="num">Amount</th><th></th></tr></thead><tbody id="ql"></tbody></table></div>
      ${locked ? '' : `<button class="btn ghost sm" id="q-add" type="button">${icon('plus')} Custom line</button> <button class="btn ghost sm" id="q-auto" type="button" title="Rebuild from the price sheet">${icon('rotate-ccw')} Re-total from price sheet (${usd(Q.auto_total_cents)})</button>`}
      <div class="form-grid" style="margin-top:10px"><div class="field"><label class="lbl" for="q-pct">Discount %</label><input class="input" id="q-pct" type="number" min="0" max="100" step="1" value="${Q.discount_pct || 0}" ${locked ? 'disabled' : ''}></div>
        <div class="field"><label class="lbl" for="q-off">Discount $</label><input class="input" id="q-off" type="number" min="0" step="0.01" value="${(Q.discount_cents || 0) / 100}" ${locked ? 'disabled' : ''}></div>
        <div class="field"><label class="lbl" for="q-days">Valid for (days)</label><input class="input" id="q-days" type="number" min="1" max="90" value="${Q.valid_until ? Math.max(1, Math.round((Q.valid_until - Date.now()) / 864e5)) : 14}" ${locked ? 'disabled' : ''}></div>
        <div class="field full"><label class="lbl" for="q-note">Note to the sponsor</label><textarea class="input" id="q-note" maxlength="2000" ${locked ? 'disabled' : ''}>${esc(Q.note || '')}</textarea></div></div>
      <div class="qsum"><span>Subtotal <b id="q-sub"></b></span><span>Total <b id="q-tot"></b></span></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        ${locked ? '' : `<button class="btn ghost" id="q-save">${icon('check')} Save draft</button><button class="btn" id="q-send">${icon('mail')} ${Q.status === 'sent' ? 'Re-send' : 'Send to sponsor'}</button>`}
        ${Q.status === 'accepted' ? `<button class="btn" id="q-paid">${icon('banknote')} Mark paid</button>` : ''}
        ${['accepted', 'paid'].includes(Q.status) ? (q.event_id ? `<a class="btn ghost" href="${AP}/official/${q.event_id}">${icon('settings')} Manage event</a> <a class="btn ghost" href="/event/${esc(q.event_code || '')}" target="_blank">${icon('badge-check')} Event ${esc(q.event_code || '')}</a>` : `<button class="btn" id="q-event">${icon('badge-check')} Create official event</button>`) : ''}
        ${['draft', 'sent'].includes(Q.status) ? `<button class="btn danger sm" id="q-dec">Mark declined</button>` : ''}
        <button class="btn ghost sm" id="q-link" title="${esc(statusUrl)}">${icon('copy')} Copy sponsor status link</button>
        <button class="btn danger sm" id="q-del">${icon('trash-2')}</button></div>
      <p class="tiny muted">${Q.sent_at ? `Sent ${dt(Q.sent_at)}. ` : ''}${Q.responded_at ? `Answered ${dt(Q.responded_at)}. ` : ''}${Q.paid_at ? `Paid ${dt(Q.paid_at)}. ` : ''}Saving a draft after sending takes the quote back to draft until you send again. Accepted quotes are locked.</p></div>`;
    frame('sponsor', 'Sponsor requests', `${tabs}<div class="cols" style="margin-top:0;grid-template-columns:1fr 1.3fr"><div class="card wrap-x"><table class="tbl"><thead><tr><th>#</th><th>Brand</th><th class="num">Features</th><th>Quote</th><th class="num">Total</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>${editor}</div>`,
      `<a class="btn ghost sm" href="/api/admin/export/bookings.csv" target="_blank">${icon('download')} CSV</a>`);
    const P = (await api('/api/admin/sponsor/prices')).prices || {};
    const total = () => { const sub = L.reduce((t, l) => t + (Number(l.amount_cents) || 0), 0); const pct = +$('#q-pct').value || 0; const off = Math.round((+$('#q-off').value || 0) * 100); return [sub, Math.max(0, Math.round(sub * (1 - Math.min(100, pct) / 100)) - off)]; };
    const paint = () => {
      $('#ql').innerHTML = L.map((l, i) => `<tr data-i="${i}"><td><input class="input sm" data-k="label" value="${esc(l.label)}" ${locked ? 'disabled' : ''} aria-label="Line label"></td><td class="num"><input class="input sm num" type="number" min="0" data-k="qty" value="${l.qty}" ${locked || l.custom ? 'disabled' : ''} aria-label="Quantity"></td><td class="num"><input class="input sm num" type="number" step="0.01" data-k="unit" value="${(l.unit_cents || 0) / 100}" ${locked || l.custom ? 'disabled' : ''} aria-label="Unit price"></td><td class="num">${l.custom && !locked ? `<input class="input sm num" type="number" step="0.01" data-k="amount" value="${(l.amount_cents || 0) / 100}" aria-label="Amount">` : usd(l.amount_cents)}</td><td>${locked ? '' : `<button type="button" class="btn ghost sm" data-rm="${i}" aria-label="Remove line">${icon('x')}</button>`}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No lines.</td></tr>';
      const [sub, tot] = total(); $('#q-sub').textContent = usd(sub); $('#q-tot').textContent = usd(tot);
    };
    paint();
    $('#ql').oninput = (e) => { const tr = e.target.closest('[data-i]'); if (!tr) return; const l = L[+tr.dataset.i]; const k = e.target.dataset.k; const v = e.target.value;
      if (k === 'label') l.label = v; else if (k === 'qty') l.qty = +v || 0; else if (k === 'unit') l.unit_cents = Math.round((+v || 0) * 100); else if (k === 'amount') l.amount_cents = Math.round((+v || 0) * 100);
      if (!l.custom) l.amount_cents = Math.round(l.qty * l.unit_cents); if (k !== 'label') { const c = tr.children[3]; if (!l.custom) c.textContent = usd(l.amount_cents); } const [sub, tot] = total(); $('#q-sub').textContent = usd(sub); $('#q-tot').textContent = usd(tot); };
    $('#ql').onclick = (e) => { const b = e.target.closest('[data-rm]'); if (b) { L.splice(+b.dataset.rm, 1); paint(); } };
    ['#q-pct', '#q-off'].forEach(s => { const el = $(s); if (el) el.oninput = () => { const [sub, tot] = total(); $('#q-sub').textContent = usd(sub); $('#q-tot').textContent = usd(tot); }; });
    const body = () => ({ lines: L, discount_pct: +$('#q-pct').value || 0, discount_cents: Math.round((+$('#q-off').value || 0) * 100), valid_days: +$('#q-days').value || 14, note: $('#q-note').value });
    const msg = (t, ok) => { $('#qm').innerHTML = `<div class="${ok ? 'ok-msg' : 'err'}">${esc(t)}</div>`; };
    const save = async () => { const x = await api(`/api/admin/sponsor/requests/${q.id}/quote`, { method: 'PUT', body: body() }); if (!x.ok) msg(x.error); return x.ok; };
    const status = async (st, text) => { const x = await api(`/api/admin/sponsor/requests/${q.id}/status`, { method: 'POST', body: { status: st } }); if (!x.ok) return msg(x.error); toast(text); sponsorAdmin(q.id); };
    const on = (s, f) => { const el = $(s); if (el) el.onclick = f; };
    on('#q-add', () => { L.push({ label: 'Custom item', qty: 1, unit_cents: 0, amount_cents: 0, custom: true }); paint(); });
    on('#q-auto', () => { if (!confirm('Replace the lines with a fresh total from the price sheet?')) return; L.length = 0; for (const f of q.features) { const fe = f; const billable = fe.unit === 'flat' ? 1 : fe.qty - (fe.id === 'weeks' ? 1 : 0); if (billable <= 0 && fe.id !== 'winner-contact') continue; L.push({ feature_id: fe.id, label: fe.name + (fe.unit !== 'flat' ? ` (${fe.qty}${fe.unit === 'week' ? ' weeks' : ''})` : ''), qty: Math.max(billable, 1), unit_cents: P[fe.id] || 0, amount_cents: fe.id === 'winner-contact' ? 0 : Math.max(billable, 1) * (P[fe.id] || 0) }); } paint(); });
    on('#q-event', async () => { const x = await api(`/api/admin/sponsor/requests/${q.id}/create-event`, { method: 'POST', body: {} }); if (!x.ok) return msg(x.error); toast('Official event ' + x.code + ' created'); sponsorAdmin(q.id); });
    on('#q-save', async () => { if (await save()) { toast('Draft saved'); sponsorAdmin(q.id); } });
    on('#q-send', async () => { if (!confirm(`Send this ${$('#q-tot').textContent} quote to ${q.brand}? They see it on their private status page.`)) return; if (await save()) status('sent', 'Quote sent'); });
    on('#q-paid', () => { if (confirm('Mark this accepted quote as paid?')) status('paid', 'Marked paid'); });
    on('#q-dec', () => { if (confirm('Mark this request declined?')) status('declined', 'Marked declined'); });
    on('#q-link', async () => { try { await navigator.clipboard.writeText(statusUrl); toast('Status link copied'); } catch { prompt('Sponsor status link', statusUrl); } });
    on('#q-del', async () => { if (!confirm(`Delete request #${q.id}? This cannot be undone.`)) return; await api('/api/admin/bookings/' + q.id, { method: 'DELETE' }); toast('Deleted'); nav(AP + '/sponsor'); });
    return;
  }
  frame('sponsor', 'Sponsor requests', `${tabs}<div class="cols" style="margin-top:0;grid-template-columns:1fr 1.3fr"><div class="card wrap-x"><table class="tbl"><thead><tr><th>#</th><th>Brand</th><th class="num">Features</th><th>Quote</th><th class="num">Total</th></tr></thead><tbody>${list.map(row).join('') || '<tr><td colspan="5" class="empty">No sponsor requests yet.</td></tr>'}</tbody></table></div>${editor}</div>`,
    `<a class="btn ghost sm" href="/api/admin/export/bookings.csv" target="_blank">${icon('download')} CSV</a>`);
}
async function sponsorPrices() {
  const [r, st] = await Promise.all([api('/api/admin/sponsor/prices'), api('/api/admin/sponsor/settings')]);
  const U = { flat: 'once', week: 'per week', each: 'each' };
  frame('sponsor', 'Sponsor price sheet', `<div class="tabs" style="margin:0 0 12px"><a href="/admin/sponsor">${icon('inbox')} Requests</a><a class="on" href="/admin/sponsor/prices">${icon('banknote')} Price sheet</a></div>
    <p class="muted small" style="margin-top:0">Admin-only. Sponsors never see these prices: they pick features and get a quote built from this sheet, which you can still adjust per request. Seed prices come from the old Basic/Premium/Elite + add-on prices.</p><div id="pm"></div>
    <form id="pf">${r.groups.map(gr => `<div class="card pad" style="margin-bottom:12px"><h2 style="margin-bottom:8px">${esc(gr)}</h2><table class="tbl"><thead><tr><th>Feature</th><th>Unit</th><th class="num">Seed</th><th class="num">Price $</th></tr></thead><tbody>
      ${r.features.filter(f => f.group === gr).map(f => `<tr><td><b>${esc(f.name)}</b><div class="tiny muted">${esc(f.desc)}${f.free ? ` (${f.free} included free)` : ''}</div></td><td class="small">${U[f.unit]}</td><td class="num small muted">${usd(f.seed)}</td><td class="num"><input class="input sm num" type="number" min="0" step="0.01" data-p="${f.id}" value="${(r.prices[f.id] || 0) / 100}" ${f.included ? 'disabled' : ''} aria-label="${esc(f.name)} price" style="width:110px"></td></tr>`).join('')}</tbody></table></div>`).join('')}
      <div class="card pad" style="margin-bottom:12px"><h2 style="margin-bottom:8px">${icon('message-circle')} Contact &amp; FAQ</h2>
        <div class="field"><label class="lbl" for="ph">Trap Tech Potato handle <span class="muted small">(shown to sponsors)</span></label><input class="input" id="ph" value="${esc(st.potato_handle || '')}" placeholder="TrapTechSolutions"></div>
        <div class="field"><label class="lbl" for="faq">Sponsor FAQ <span class="muted small">(one per line: Question | Answer; questions about price/pay/cost are hidden from sponsors)</span></label><textarea class="input" id="faq" style="min-height:160px;font-size:.8rem">${esc((st.faq || []).map(x => x.join(' | ')).join('\n'))}</textarea></div></div>
      <button class="btn">${icon('check')} Save prices &amp; settings</button></form>`);
  $('#pf').onsubmit = async (e) => {
    e.preventDefault(); const prices = {}; document.querySelectorAll('[data-p]').forEach(i => { if (!i.disabled) prices[i.dataset.p] = Math.round((+i.value || 0) * 100); });
    const faq = $('#faq').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
    const [a, b] = await Promise.all([api('/api/admin/sponsor/prices', { method: 'PUT', body: { prices } }), api('/api/admin/sponsor/settings', { method: 'PUT', body: { potato_handle: $('#ph').value.trim(), faq } })]);
    $('#pm').innerHTML = a.ok && b.ok ? '<div class="ok-msg">Saved. New drafts use these prices.</div>' : `<div class="err">${esc(a.error || b.error)}</div>`; if (a.ok && b.ok) toast('Prices saved');
  };
}

// ---------------- v7: official events (code, vendor, booking/payment status, share kit, skill tie-breaks + playoffs) ----------------
async function eventsAdmin(id) {
  const list = (await api('/api/admin/giveaways')).giveaways || [];
  const ev = id ? list.find(g => String(g.id) === String(id)) : null;
  let detail = '';
  if (ev) {
    const [sh, ties] = await Promise.all([api(`/api/admin/events/${ev.id}/share`), api(`/api/admin/events/${ev.id}/ties`)]);
    detail = `<div class="card pad"><h2>${esc(ev.title)} <span class="pill">${esc(sh.code || '')}</span></h2>
      <p class="small">Vendor: <b>${esc(sh.vendor || ev.host || '')}</b> - booking <b>${esc(sh.booking_status || '-')}</b>, payment <b>${esc(sh.payment_status || '-')}</b></p>
      <p><a class="btn sm ghost" href="${esc(sh.url || '')}" target="_blank">${icon('external-link')} ${esc(sh.url || '')}</a> <button class="btn sm ghost" id="ev-regen">${icon('refresh-cw')} New code</button></p>
      <div style="max-width:200px;background:#fff;border-radius:10px;padding:6px">${sh.qr_svg || ''}</div>
      <h3 style="margin-top:14px">Skill tie-breaks</h3><p class="small muted">Ties are decided only by skill: the shorter server-timed run, then the game's skill metric, then a sudden-death playoff.</p>
      ${ties.playoff_needed ? `<div class="err">Exact tie on a winning place: ${ties.playoff_needed.map(t => esc(t.username)).join(', ')}. <button class="btn sm" id="po-start">Start sudden-death playoff</button></div>` : `<p class="small">${ties.finalized ? 'No exact tie on a winning place.' : `Live exact ties: ${(ties.live_exact_ties || []).length}`}</p>`}
      ${(ties.playoffs || []).map(p => `<div class="card pad" style="margin-top:8px"><b>Playoff #${p.id}</b> round ${p.round} - ${esc(p.status)} - closes ${dt(p.closes_at)}<div class="small">${p.entries.map(e => `user ${e.user_id}: ${e.score ?? 'no run yet'}`).join(' | ')}</div>
        ${p.status === 'open' ? `<button class="btn sm" data-po-res="${p.id}">Resolve now</button>` : ''} ${p.status !== 'open' ? `<button class="btn sm" data-po-apply="${p.id}">Apply to final standings</button>` : ''}</div>`).join('')}
      <p class="small"><a href="/games-lib/admin-playoffs.html" target="_blank">Games Library playoff console</a></p></div>`;
  }
  frame('official', 'Official events', `<div class="cols" style="grid-template-columns:1fr 1.3fr;margin-top:0"><div class="card wrap-x"><table class="tbl"><thead><tr><th>Event</th><th>Status</th></tr></thead><tbody>
    ${list.map(g => `<tr class="${String(g.id) === String(id) ? 'on' : ''}"><td><a href="${AP}/official/${g.id}">${esc(g.title)}</a></td><td>${esc(g.status || '')}</td></tr>`).join('')}</tbody></table></div><div>${detail || '<div class="card pad muted">Pick an event.</div>'}</div></div>`);
  const on = (sel, f) => { const el = $(sel); if (el) el.onclick = f; };
  on('#ev-regen', async () => { if (!confirm('Issue a new event code? The old link and QR stop working.')) return; await api(`/api/admin/events/${ev.id}/regen-code`, { method: 'POST', body: {} }); eventsAdmin(id); });
  on('#po-start', async () => { const x = await api(`/api/admin/events/${ev.id}/playoff`, { method: 'POST', body: { window_min: 60 } }); toast(x.ok ? 'Playoff started; tied players were notified' : x.error); eventsAdmin(id); });
  document.querySelectorAll('[data-po-res]').forEach(b => b.onclick = async () => { const x = await api(`/api/admin/events/${ev.id}/playoff/${b.dataset.poRes}/resolve`, { method: 'POST', body: {} }); toast(x.ok ? 'Playoff ' + x.playoff.status : x.error); eventsAdmin(id); });
  document.querySelectorAll('[data-po-apply]').forEach(b => b.onclick = async () => { const x = await api(`/api/admin/events/${ev.id}/playoff/${b.dataset.poApply}/apply`, { method: 'POST', body: {} }); toast(x.ok ? 'Standings updated' : x.error); eventsAdmin(id); });
}
// ---------------- v7 Phase 4: store, orders (Bitcoin), manual verify / grant / refund ----------------
async function storeAdmin() {
  const [r, o] = await Promise.all([api('/api/admin/store'), api('/api/admin/store/orders')]); const co = r.checkout; const btc = co.providers.bitcoin;
  frame('store', 'Store & orders', `<div class="card pad"><h2>${icon('wallet')} Checkout</h2>
      <p>Bitcoin address: ${btc.configured ? `<code>${esc(btc.address)}</code> <span class="pill green">${esc(btc.type)} checksum OK</span>` : `<span class="pill red">not set</span> <span class="small">${esc(btc.why || '')} - set BTC_ADDRESS on the host</span>`}</p>
      <label class="check"><input type="checkbox" id="co-on" ${co.admin_switch ? 'checked' : ''}> Checkout switched on</label> <span class="small muted">${co.enabled ? 'Players can buy now.' : esc(co.reason || '')}</span>
      <p class="small muted">${esc(r.non_advantage)}</p></div>
    <div class="card wrap-x" style="margin-top:12px"><table class="tbl"><thead><tr><th>Product</th><th>Kind</th><th class="num">Price (USD)</th><th class="num">Crowns+bonus / supply</th><th>Active</th><th></th></tr></thead><tbody>
      ${r.products.map(p => `<tr data-p="${esc(p.id)}"><td><input class="input sm" data-k="name" value="${esc(p.name)}"></td><td>${esc(p.kind)}</td><td class="num"><input class="input sm num" type="number" step="0.01" data-k="usd" value="${(p.usd_cents / 100).toFixed(2)}"></td>
        <td class="num">${p.kind === 'pack' ? `<input class="input sm num" type="number" data-k="crowns" value="${p.crowns}"> + <input class="input sm num" type="number" data-k="bonus" value="${p.bonus}">` : p.kind === 'prestige' ? '<span class="muted">unlimited</span>' : ''}</td>
        <td><input type="checkbox" data-k="active" ${p.active ? 'checked' : ''}></td><td><button class="btn sm" data-save="${esc(p.id)}">Save</button></td></tr>`).join('')}</tbody></table></div>
    <div class="card pad" style="margin-top:12px"><h2>Manual grant</h2><div style="display:flex;gap:8px;flex-wrap:wrap"><input class="input sm" id="mg-user" placeholder="username"><select class="input sm" id="mg-prod">${r.products.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select><input class="input sm" id="mg-crowns" type="number" placeholder="or Crowns (+/-)"><button class="btn sm" id="mg-go">Grant</button></div></div>
    <div class="card wrap-x" style="margin-top:12px"><table class="tbl"><thead><tr><th>Order</th><th>Player</th><th>Product</th><th class="num">USD</th><th class="num">Sats / received</th><th>Status</th><th>Tx</th><th></th></tr></thead><tbody>
      ${(o.orders || []).map(x => `<tr><td>${esc(x.ref)}<div class="tiny muted">${dt(x.created_at)}</div></td><td>${esc(x.username || '')}</td><td>${esc(x.product.name)}</td><td class="num">${usd(x.usd_cents)}</td><td class="num">${x.sats || '-'} / ${x.received_sats ?? '-'}</td>
        <td>${esc(x.status)}${x.flags.length ? ` <span class="pill">${esc(x.flags.join(', '))}</span>` : ''}${x.confs ? ` <span class="tiny">${x.confs}/${x.need_confs}</span>` : ''}</td><td class="tiny">${x.txid ? `<a href="https://mempool.space/tx/${esc(x.txid)}" target="_blank" rel="noopener">${esc(x.txid.slice(0, 10))}...</a>` : ''}</td>
        <td>${x.granted_at || x.refunded_at ? '' : `<button class="btn sm ghost" data-ver="${esc(x.ref)}">Verify</button><button class="btn sm" data-grant="${esc(x.ref)}">Grant</button>`}${x.refunded_at ? '' : `<button class="btn sm danger" data-ref="${esc(x.ref)}">Refund</button>`}</td></tr>`).join('') || '<tr><td colspan="8" class="muted">No orders yet.</td></tr>'}</tbody></table></div>`);
  $('#co-on').onchange = async (e) => { await api('/api/admin/store/checkout', { method: 'PUT', body: { enabled: e.target.checked } }); storeAdmin(); };
  document.querySelectorAll('[data-save]').forEach(b => b.onclick = async () => { const tr = b.closest('tr'); const v = (k) => { const el = tr.querySelector(`[data-k=${k}]`); return el ? (el.type === 'checkbox' ? el.checked : el.value) : undefined; };
    const x = await api('/api/admin/store/products/' + b.dataset.save, { method: 'PUT', body: { name: v('name'), usd_cents: Math.round(+v('usd') * 100), crowns: v('crowns'), bonus: v('bonus'), supply: v('supply'), active: v('active') } }); toast(x.ok ? 'Saved' : x.error); });
  $('#mg-go').onclick = async () => { const c = +$('#mg-crowns').value; const x = await api('/api/admin/store/grant', { method: 'POST', body: c ? { username: $('#mg-user').value, crowns: c } : { username: $('#mg-user').value, product_id: $('#mg-prod').value } }); toast(x.ok ? 'Granted' : x.error); storeAdmin(); };
  document.querySelectorAll('[data-ver]').forEach(b => b.onclick = async () => { const txid = prompt('Optional: transaction id to match (leave empty to search by exact amount)') || undefined; const x = await api(`/api/admin/store/orders/${b.dataset.ver}/verify`, { method: 'POST', body: { txid } }); toast(x.ok ? 'Status: ' + x.order.status : x.error); storeAdmin(); });
  document.querySelectorAll('[data-grant]').forEach(b => b.onclick = async () => { if (!confirm('Grant this order without an on-chain match?')) return; const x = await api(`/api/admin/store/orders/${b.dataset.grant}/grant`, { method: 'POST', body: {} }); toast(x.ok ? 'Granted' : x.error); storeAdmin(); });
  document.querySelectorAll('[data-ref]').forEach(b => b.onclick = async () => { const note = prompt('Refund note (send the BTC back yourself from your wallet):'); if (note === null) return; const x = await api(`/api/admin/store/orders/${b.dataset.ref}/refund`, { method: 'POST', body: { note } }); toast(x.ok ? 'Refunded' : x.error); storeAdmin(); });
}

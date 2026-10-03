import { icon } from './icons.js';
const $ = (s, r = document) => r.querySelector(s);
const root = document.getElementById('admin');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
let offset = 0; const nowS = () => Date.now() + offset;
async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let d; try { d = await res.json(); } catch { d = { ok: false, error: 'HTTP ' + res.status }; }
  if (d.now) offset = d.now - Date.now();
  if (res.status === 401 && !path.endsWith('/login')) { loginView(); throw new Error('auth'); }
  return d;
}
const ago = (ms) => { const s = Math.max(0, (nowS() - ms) / 1000); return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)}m ago` : s < 86400 ? `${Math.floor(s / 3600)}h ago` : `${Math.floor(s / 86400)}d ago`; };
const dt = (ms) => new Date(ms).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
const toLocalInput = (ms) => { const d = new Date(ms); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const statusPill = (s) => `<span class="pill ${s === 'active' ? 'green' : s === 'upcoming' ? '' : 'red'}">${s}</span>`;
const demoTag = (d) => d ? '<span class="demo-tag">DEMO</span>' : '';
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
let GAMES = [];

const NAV = [['', 'layout-dashboard', 'Dashboard'], ['games', 'gamepad-2', 'Games'], ['giveaways', 'gift', 'Giveaways'], ['bookings', 'calendar-check', 'Bookings'], ['players', 'users', 'Players'], ['leaderboards', 'trophy', 'Leaderboards'], ['announcements', 'megaphone', 'Announcements'], ['reports', 'file-text', 'Reports'], ['settings', 'settings', 'Settings']];
function frame(section, title, inner, actions = '') {
  root.innerHTML = `<div class="adm">
    <aside class="side"><div class="brand"><img src="/assets/brand/logo-horizontal.webp" alt="The Gaming Hub"><b>Admin Dashboard</b></div>
      ${NAV.map(([k, i, l]) => `<a href="/admin${k ? '/' + k : ''}" class="${section === k ? 'on' : ''}">${icon(i)}${l}</a>`).join('')}
      <span class="sp" style="flex:1"></span><a href="/" target="_blank">${icon('external-link')}View site</a><a href="#" data-logout>${icon('log-out')}Log out</a></aside>
    <main class="amain"><div class="ahead"><h1>${title}</h1>${actions}<div class="who mini-row" style="margin:0"><span class="av" style="background:linear-gradient(135deg,#7c3aed,#22d3ee)">TT</span><div><b>TrapTech Admin</b><div class="small muted">Admin</div></div></div></div>${inner}</main></div>`;
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) { e.preventDefault(); await fetch('/api/admin/logout', { method: 'POST' }); return loginView(); }
  const a = e.target.closest('a[href^="/admin"]'); if (!a || a.target) return;
  e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); render();
});
window.addEventListener('popstate', render);
const nav = (p) => { history.pushState({}, '', p); render(); };

function loginView() {
  root.innerHTML = `<div class="card login glow-purple"><img src="/assets/brand/logo-horizontal.webp" alt="" style="width:220px;margin:0 auto 10px"><h1 class="center">Admin Login</h1>
    <form id="lf"><div id="m"></div><div class="field ic">${icon('lock')}<input class="input" type="password" id="pw" placeholder="Admin password" autocomplete="current-password" autofocus></div><button class="btn block">Log in</button></form></div>`;
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault(); const r = await api('/api/admin/login', { method: 'POST', body: { password: $('#pw').value } });
    if (!r.ok) { $('#m').innerHTML = `<div class="err">${esc(r.error)}</div>`; return; } render();
  });
}

async function render() {
  const me = await (await fetch('/api/admin/me')).json(); if (!me.admin) return loginView();
  if (!GAMES.length) GAMES = (await (await fetch('/api/games')).json()).games;
  const parts = location.pathname.replace(/^\/admin\/?/, '').split('/').filter(Boolean);
  try {
    const [s, id] = parts;
    if (!s) return dashboard();
    if (s === 'games') return games();
    if (s === 'giveaways' && !id) return giveaways();
    if (s === 'giveaways') return manageGiveaway(id);
    if (s === 'bookings') return bookings();
    if (s === 'players') return players();
    if (s === 'leaderboards') return leaderboards();
    if (s === 'announcements') return announcements();
    if (s === 'reports') return reports();
    if (s === 'settings') return settings();
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
      <a class="btn block sm" href="/admin/giveaways/new?game=${g.id}" data-create="${g.id}">${icon('plus')} Create giveaway for this game</a>
      <div class="aglinks"><div class="small muted" style="margin:10px 0 4px">${icon('link')} Linked giveaways</div>
        ${g.giveaways.length ? g.giveaways.map(x => `<label class="glink ${x.linked ? 'on' : ''}" data-gw="${x.id}"><span class="toggle"><input type="checkbox" data-link="${x.id}" data-game="${g.id}" ${x.linked ? 'checked' : ''}><span></span></span>
          <span class="gl-t"><b>${esc(x.title)}</b>${demoTag(x.demo)}<span class="small muted">${statusPill(x.status)} ${x.games} game${x.games === 1 ? '' : 's'}${x.active ? '' : ' • hidden'}</span></span></label>`).join('')
          : '<div class="small muted">No live or upcoming giveaways.</div>'}</div>
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
const IMAGES = ['/assets/giveaways/store-credit-art.webp', '/assets/giveaways/ps5-bundle-art.webp', '/assets/brand/hero-banner.webp', '/assets/cards/jetpack-dash.webp', '/assets/cards/drift-rush.webp', '/assets/cards/plinko.webp', '/assets/cards/spin-to-win.webp', '/assets/cards/memory-match.webp', '/assets/cards/blazed-roulette.webp', '/assets/cards/terp-tapper.webp'];
async function manageGiveaway(id) {
  const isNew = id === 'new';
  const pre = new URLSearchParams(location.search).get('game'); const preG = GAMES.find(x => x.id === pre);
  let g = { title: preG ? `${preG.title} Giveaway` : '', host: '', prize: '', image: preG ? preG.art : IMAGES[0], start_at: nowS(), end_at: nowS() + 7 * 864e5, game_ids: [preG ? preG.id : 'jetpack-dash'], rules: 'Must be 18+ (21+ where required). No purchase necessary. One account per person. Winner will be contacted via their Potato username.', active: true,
    tier: 'basic', brand_color: '', brand_logo: '', featured: false, min_score: 0, prize_tiers_raw: '' };
  let entrants = [], stats = null;
  if (!isNew) { const r = await api('/api/admin/giveaways/' + id); if (!r.ok) return frame('giveaways', 'Not found', `<div class="err">${esc(r.error)}</div>`); g = r.giveaway; entrants = r.entrants; stats = r.stats; }
  const sel = new Set(g.game_ids && g.game_ids.length ? g.game_ids : [g.game_id]);
  frame('giveaways', isNew ? 'New Giveaway' : 'Manage Giveaway', `
    <div class="cols" style="margin-top:0;grid-template-columns:1.1fr 1fr">
      <form class="card pad" id="gf">
        <div id="gm"></div>
        <div class="preview" id="pv" style="background-image:url('${esc(g.image)}')"><div class="cap" id="pvt">${esc(g.title || 'Giveaway title')}</div></div>
        <div class="field" style="margin-top:10px"><label class="lbl">Image</label><div class="img-pick" id="imgs">${IMAGES.map(u => `<button type="button" data-u="${u}" class="${u === g.image ? 'on' : ''}" style="background-image:url('${u}')" aria-label="Use image"></button>`).join('')}</div>
          <input class="input" id="img" style="margin-top:8px" placeholder="...or an image URL (https://...) or /assets/... path" value="${esc(g.image)}"></div>
        <div class="form-grid">
          <div class="field full"><label class="lbl">Title</label><input class="input" id="title" value="${esc(g.title)}" maxlength="120" required></div>
          <div class="field"><label class="lbl">Host</label><input class="input" id="host" value="${esc(g.host)}" placeholder="e.g. HighTimes" maxlength="80"></div>
          <div class="field"><label class="lbl">Prize</label><input class="input" id="prize" value="${esc(g.prize)}" placeholder="$250 store credit" maxlength="200"></div>
          <div class="field"><label class="lbl">Start Date & Time</label><input class="input" type="datetime-local" id="start" value="${toLocalInput(g.start_at)}"></div>
          <div class="field"><label class="lbl">End Date & Time</label><input class="input" type="datetime-local" id="end" value="${toLocalInput(g.end_at)}"></div>
          <div class="field full"><label class="lbl">Games that count <span class="muted small" id="gpn"></span></label><div class="gpicker" id="gpk">${GAMES.map(x => `<button type="button" class="gp ${sel.has(x.id) ? 'on' : ''}" data-g="${x.id}" aria-pressed="${sel.has(x.id)}"><span class="ck">${icon('check')}</span><img src="${x.art}" alt=""><b>${esc(x.title)}</b></button>`).join('')}</div>
            <div class="hint" style="margin:6px 0 0">Tap to select one or more games. With several games, a player's giveaway score is the sum of their best score in each.</div></div>
          <div class="field"><label class="lbl">Package tier</label><select class="input" id="tier">${[['', 'None'], ['basic', 'Basic'], ['premium', 'Premium'], ['elite', 'Elite']].map(([k, l]) => `<option value="${k}" ${g.tier === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl">Minimum score to qualify</label><input class="input" type="number" min="0" id="minscore" value="${g.min_score || 0}"></div>
          <div class="field"><label class="lbl">Brand color</label><div style="display:flex;gap:8px"><input type="color" id="bcolor" value="${esc(g.brand_color || '#7c3aed')}" style="width:56px;height:48px;border:0;background:none"><label class="check" style="margin:0"><input type="checkbox" id="usecolor" ${g.brand_color ? 'checked' : ''}> Use brand color</label></div></div>
          <div class="field"><label class="lbl">Brand logo URL</label><input class="input" id="blogo" value="${esc(g.brand_logo)}" placeholder="/assets/... or https://..." maxlength="300"></div>
          <div class="field full"><label class="lbl">Prize tiers <span class="muted small">(one per line, e.g. "1st - PS5 bundle")</span></label><textarea class="input" id="ptiers" maxlength="1000" style="min-height:70px" placeholder="1st - ...&#10;2nd - ...&#10;3rd - ...&#10;Random draw - ...">${esc(g.prize_tiers_raw || '')}</textarea></div>
          <div class="field full"><label class="lbl">Rules</label><textarea class="input" id="rules" maxlength="4000">${esc(g.rules)}</textarea></div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin:4px 0 10px"><label class="toggle"><input type="checkbox" id="active" ${g.active ? 'checked' : ''}><span></span></label><b>Active</b><span class="small muted">(visible on the public site)</span></div>
        <div style="display:flex;align-items:center;gap:12px;margin:0 0 16px"><label class="toggle"><input type="checkbox" id="featured" ${g.featured ? 'checked' : ''}><span></span></label><b>Featured</b><span class="small muted">(home page slot; Elite + featured = hero takeover)</span></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="submit" style="flex:1">${icon('check')} Save Changes</button>${isNew ? '' : `<button class="btn danger" type="button" id="del">${icon('trash-2')} Delete</button>`}</div>
        <p class="small muted">Times are in your browser's time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}). Runs started before the start time or submitted after the end time do not count.</p>
      </form>
      ${isNew ? '<div class="card pad"><h2>Entrants & winners</h2><p class="muted">Save the giveaway first. Entrants are players who finish a run of any linked game during the window.</p></div>' : `
      <div>
        ${stats ? `<div class="card pad" style="margin-bottom:14px"><h2 style="margin-bottom:10px">${icon('chart-column')} Live campaign stats</h2>
          <div class="agstats"><div><b>${fmt(stats.plays)}</b><span>plays</span></div><div><b>${fmt(stats.players)}</b><span>unique players</span></div><div><b>${fmt(g.entrants)}</b><span>entrants</span></div></div>
          ${(stats.per_game || []).length ? `<table class="tbl" style="margin-top:8px"><tbody>${stats.per_game.map(p => `<tr><td>${esc(GAMES.find(x => x.id === p.game_id)?.title || p.game_id)}</td><td class="num">${fmt(p.plays)} plays</td><td class="num">${fmt(p.players)} players</td></tr>`).join('')}</tbody></table>` : ''}</div>` : ''}
        <div class="card pad" style="margin-bottom:14px">
          <div style="display:flex;align-items:center;justify-content:space-between"><h2>Winners</h2>${statusPill(g.status)}</div>
          <p class="small muted">${fmt(g.entrants)} entrant${g.entrants === 1 ? '' : 's'}. Random draw is uniform among entrants who haven't already won this giveaway.</p>
          <div id="wb">${g.winners.length ? g.winners.map(w => `<div class="winner-box"><div class="small muted">${w.method === 'top' ? 'Top score' : 'Random draw'} • ${dt(w.drawn_at)}</div><div class="nm">${esc(w.username)}</div></div>`).join('') : '<div class="empty" style="padding:10px">No winners drawn yet.</div>'}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn" id="draw">${icon('shuffle')} Draw Random Winner</button>
            <input class="input" id="topn" type="number" min="1" max="100" value="3" style="width:80px;height:46px">
            <button class="btn ghost" id="top">${icon('list-ordered')} Pick Top N</button>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
            <a class="btn ghost sm" href="/api/admin/export/leaderboard.csv?giveaway=${g.id}" target="_blank">${icon('download')} Export CSV</a>
            ${g.winners.length ? `<button class="btn ghost sm" id="clearw">${icon('rotate-ccw')} Clear winners</button>` : ''}
            <a class="btn ghost sm" href="/giveaways/${g.id}" target="_blank">${icon('external-link')} Public page</a>
          </div>
        </div>
        <div class="card"><div class="panel-h"><h2>Entrants - Top N view</h2><input class="input" id="viewn" type="number" min="1" value="${Math.min(10, Math.max(entrants.length, 1))}" style="width:80px;height:36px"></div><div id="ent"></div></div>
      </div>`}
    </div>`, `<a class="btn ghost sm" href="/admin/giveaways">${icon('chevron-left')} All giveaways</a>`);
  const setImg = (u) => { $('#img').value = u; $('#pv').style.backgroundImage = `url('${u}')`; document.querySelectorAll('#imgs button').forEach(b => b.classList.toggle('on', b.dataset.u === u)); };
  $('#imgs').onclick = (e) => { const b = e.target.closest('[data-u]'); if (b) setImg(b.dataset.u); };
  $('#img').oninput = (e) => setImg(e.target.value.trim());
  $('#title').oninput = (e) => { $('#pvt').textContent = e.target.value || 'Giveaway title'; };
  const paintGp = () => { document.querySelectorAll('#gpk .gp').forEach(b => { const on = sel.has(b.dataset.g); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); }); $('#gpn').textContent = `(${sel.size} selected)`; };
  $('#gpk').onclick = (e) => { const b = e.target.closest('[data-g]'); if (!b) return; const k = b.dataset.g; if (sel.has(k)) { if (sel.size === 1) return toast('Pick at least one game'); sel.delete(k); } else sel.add(k); paintGp(); };
  paintGp();
  $('#gf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { title: $('#title').value, host: $('#host').value, prize: $('#prize').value, image: $('#img').value.trim(), start_at: new Date($('#start').value).getTime(), end_at: new Date($('#end').value).getTime(), entry_method: 'play', game_ids: GAMES.map(x => x.id).filter(k => sel.has(k)), rules: $('#rules').value, active: $('#active').checked,
      tier: $('#tier').value, min_score: +$('#minscore').value || 0, brand_color: $('#usecolor').checked ? $('#bcolor').value : '', brand_logo: $('#blogo').value.trim(), featured: $('#featured').checked, prize_tiers: $('#ptiers').value };
    const r = await api(isNew ? '/api/admin/giveaways' : '/api/admin/giveaways/' + id, { method: isNew ? 'POST' : 'PUT', body });
    if (!r.ok) { $('#gm').innerHTML = `<div class="err">${esc(r.error)}</div>`; window.scrollTo(0, 0); return; }
    toast('Saved'); if (isNew) nav('/admin/giveaways/' + r.id); else manageGiveaway(id);
  });
  if (isNew) return;
  $('#del').onclick = async () => { if (!confirm('Delete this giveaway and its winners? This cannot be undone.')) return; await api('/api/admin/giveaways/' + id, { method: 'DELETE' }); toast('Deleted'); nav('/admin/giveaways'); };
  const draw = async (method) => {
    const r = await api(`/api/admin/giveaways/${id}/draw`, { method: 'POST', body: { method, count: method === 'top' ? +$('#topn').value : 1 } });
    if (!r.ok) return toast(r.error);
    toast(`${r.winners.map(w => w.username).join(', ')} ${r.winners.length > 1 ? 'are' : 'is'} the winner${r.winners.length > 1 ? 's' : ''}!`); manageGiveaway(id);
  };
  $('#draw').onclick = () => draw('random'); $('#top').onclick = () => draw('top');
  const cw = $('#clearw'); if (cw) cw.onclick = async () => { if (!confirm('Clear all drawn winners for this giveaway?')) return; await api(`/api/admin/giveaways/${id}/winners`, { method: 'DELETE' }); manageGiveaway(id); };
  const winners = new Set(g.winners.map(w => w.username));
  const drawEnt = () => { const n = Math.max(1, +$('#viewn').value || 10); $('#ent').innerHTML = entrants.length ? `<table class="tbl"><thead><tr><th>#</th><th>Player</th><th class="num">Best</th><th class="num">Runs</th></tr></thead><tbody>${entrants.slice(0, n).map(x => `<tr><td>${x.rank}</td><td>${esc(x.username)}${demoTag(x.demo)} ${winners.has(x.username) ? `<span class="pill gold">${icon('crown')} winner</span>` : ''}</td><td class="num">${fmt(x.score)}</td><td class="num">${x.runs}</td></tr>`).join('')}</tbody></table><div class="small muted" style="padding:10px">Showing top ${Math.min(n, entrants.length)} of ${entrants.length}</div>` : '<div class="empty">No entrants yet.</div>'; };
  $('#viewn').oninput = drawEnt; drawEnt();
}

// ---------- bookings ----------
async function bookings() {
  const r = await api('/api/admin/bookings');
  frame('bookings', 'Bookings', `<div class="card wrap-x"><table class="tbl"><thead><tr><th>#</th><th>Brand</th><th>Contact</th><th>Type / Package</th><th>Dates</th><th>Details</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>
    ${r.bookings.length ? r.bookings.map(b => `<tr data-id="${b.id}"><td>${b.id}</td><td><b>${esc(b.brand)}</b>${demoTag(b.is_demo)}<div class="small muted">${ago(b.created_at)}${b.username ? ' • ' + esc(b.username) : ''}</div></td><td class="small">${esc(b.contact_name)}<br>${esc(b.contact)}</td><td class="small">${esc(b.event_type || '-')}<br><span class="pill ${b.package === 'elite' ? 'gold' : ''}">${esc(b.package)}</span>${b.package_snapshot ? `<div class="small muted" data-snap>${esc(b.package_snapshot)}</div>` : ''}</td><td class="small">${esc(b.start_date || '?')}<br>→ ${esc(b.end_date || '?')}</td><td class="small" style="max-width:260px;white-space:pre-wrap">${esc(b.details)}</td>
      <td><select class="input" data-st style="height:36px;width:120px">${['pending', 'approved', 'declined', 'done'].map(s => `<option ${s === b.status ? 'selected' : ''}>${s}</option>`).join('')}</select></td>
      <td><input class="input" data-note value="${esc(b.admin_note)}" placeholder="Internal note" style="height:36px;min-width:140px"></td>
      <td style="white-space:nowrap"><button class="btn sm" data-save>Save</button> <button class="iconbtn" data-del aria-label="Delete">${icon('trash-2')}</button></td></tr>`).join('') : '<tr><td colspan="9" class="empty">No booking requests yet.</td></tr>'}
  </tbody></table></div>`, `<a class="btn ghost sm" href="/api/admin/export/bookings.csv" target="_blank">${icon('download')} CSV</a>`);
  root.querySelector('.tbl').addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]'); if (!tr) return; const id = tr.dataset.id;
    if (e.target.closest('[data-save]')) { await api('/api/admin/bookings/' + id, { method: 'PUT', body: { status: $('[data-st]', tr).value, admin_note: $('[data-note]', tr).value } }); toast('Booking updated'); }
    if (e.target.closest('[data-del]') && confirm('Delete booking #' + id + '?')) { await api('/api/admin/bookings/' + id, { method: 'DELETE' }); bookings(); }
  });
}

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
  const [s, pk, ac] = await Promise.all([api('/api/admin/stats'), api('/api/admin/packages'), api('/api/admin/achievements')]);
  frame('settings', 'Settings', `
    <div class="card pad" id="pkg-editor"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="flex:1">${icon('briefcase')} Hosting packages <span class="muted small">(shown on /host)</span></h2><a class="btn ghost sm" href="/host" target="_blank">${icon('external-link')} View page</a></div>
      <p class="muted small">Edit prices, names and features for each tier. Prices are placeholders - set your real prices here. Changes are live as soon as you save.</p>
      <div id="pkm"></div>
      <div class="pk-ed">${pk.tiers.map((t, i) => `<div class="card pad pk-t" data-i="${i}"><h3 class="orb" style="margin:0 0 10px;text-transform:uppercase">${esc(t.id)}</h3>
        <div class="form-grid"><div class="field"><label class="lbl">Name</label><input class="input" data-f="name" value="${esc(t.name)}"></div><div class="field"><label class="lbl">Price</label><input class="input" data-f="price" value="${esc(t.price)}" placeholder="$49"></div>
        <div class="field"><label class="lbl">Price note</label><input class="input" data-f="price_note" value="${esc(t.price_note)}" placeholder="per giveaway"></div><div class="field"><label class="lbl">Badge</label><input class="input" data-f="badge" value="${esc(t.badge)}" placeholder="Most popular"></div>
        <div class="field full"><label class="lbl">Tagline</label><input class="input" data-f="tagline" value="${esc(t.tagline)}"></div>
        <div class="field full"><label class="lbl">Who it's for</label><input class="input" data-f="who" value="${esc(t.who)}"></div>
        <div class="field full"><label class="lbl">Features (one per line)</label><textarea class="input" data-f="features" style="min-height:150px">${esc(t.features.join('\n'))}</textarea></div></div></div>`).join('')}</div>
      <div class="field"><label class="lbl">Comparison table <span class="muted small">(one row per line: Label | Basic | Premium | Elite; use "yes" or "-" for check / cross)</span></label><textarea class="input" id="pk-cmp" style="min-height:220px;font-family:monospace;font-size:.8rem">${esc(pk.compare.map(r => r.join(' | ')).join('\n'))}</textarea></div>
      <div class="field"><label class="lbl">FAQ <span class="muted small">(one per line: Question | Answer)</span></label><textarea class="input" id="pk-faq" style="min-height:180px;font-size:.8rem">${esc(pk.faq.map(r => r.join(' | ')).join('\n'))}</textarea></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="pk-save">${icon('check')} Save packages</button><button class="btn ghost" id="pk-reset">${icon('rotate-ccw')} Reset to defaults</button></div></div>
    <div class="cols">
    <div class="card pad"><h2 style="margin-bottom:8px">Demo data</h2><p class="muted">Sample players, giveaways, bookings and announcements used for previews are tagged <span class="demo-tag">DEMO</span>. Currently: ${s.demo.players} demo players, ${s.demo.giveaways} demo giveaways.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn danger" id="wipe">${icon('trash-2')} Wipe demo data</button><button class="btn ghost" id="seed">${icon('sparkles')} Load demo data</button></div>
      <h2 style="margin:16px 0 8px">Achievements</h2><p class="muted small">${ac.achievements.length} achievements, ${fmt(ac.unlocks)} unlocks across ${fmt(ac.players)} players. Rewards are cosmetic only (no cash value) and are evaluated on the server.</p></div>
    <div class="card pad"><h2 style="margin-bottom:8px">Admin password</h2><p class="muted">The admin password lives in the server's <code>.env</code> file (<code>ADMIN_PASSWORD</code>). Edit it there and restart the server to change it.</p>
    <h2 style="margin:16px 0 8px">Anti-cheat</h2><p class="muted small">Runs need a signed single-use token from /api/run/start. Each game has its own plausibility caps against server-measured run time (see Games); starts and submissions are rate limited per player and per IP.</p></div></div>`);
  $('#wipe').onclick = async () => { if (!confirm('Delete all demo data? Real players and giveaways are not touched.')) return; const r = await api('/api/admin/demo/wipe', { method: 'POST' }); toast(`Removed ${r.players} demo players, ${r.giveaways} giveaways`); settings(); };
  $('#seed').onclick = async () => { const r = await api('/api/admin/demo/seed', { method: 'POST' }); toast(r.seeded ? 'Demo data loaded' : r.note); settings(); };
  $('#pk-save').onclick = async () => {
    const tiers = [...document.querySelectorAll('.pk-t')].map(el => { const o = {}; el.querySelectorAll('[data-f]').forEach(i => { o[i.dataset.f] = i.dataset.f === 'features' ? i.value.split('\n').map(x => x.trim()).filter(Boolean) : i.value; }); return o; });
    const split = (v) => v.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(x => x.trim()));
    const faq = $('#pk-faq').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
    const r = await api('/api/admin/packages', { method: 'PUT', body: { tiers, compare: split($('#pk-cmp').value), faq } });
    $('#pkm').innerHTML = r.ok ? '<div class="ok-msg">Packages saved - live on /host.</div>' : `<div class="err">${esc(r.error)}</div>`; if (r.ok) toast('Packages saved');
  };
  $('#pk-reset').onclick = async () => { if (!confirm('Reset all package names, prices, features, comparison and FAQ to the defaults?')) return; await api('/api/admin/packages/reset', { method: 'POST' }); toast('Packages reset'); settings(); };
}

render();

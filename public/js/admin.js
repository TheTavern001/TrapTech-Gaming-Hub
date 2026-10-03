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

const NAV = [['', 'layout-dashboard', 'Dashboard'], ['games', 'gamepad-2', 'Games'], ['giveaways', 'gift', 'Giveaways'], ['channels', 'store', 'Brand Channels'], ['bookings', 'calendar-check', 'Bookings'], ['players', 'users', 'Players'], ['leaderboards', 'trophy', 'Leaderboards'], ['tournaments', 'swords', 'Tournaments'], ['announcements', 'megaphone', 'Announcements'], ['badges', 'badge-check', 'Badges'], ['fairplay', 'scan-eye', 'Fair Play'], ['reports', 'file-text', 'Reports'], ['settings', 'settings', 'Settings']];
function frame(section, title, inner, actions = '') {
  document.title = `${title.replace(/<[^>]+>/g, '')} - Admin - The Gaming Hub by Trap Tech Solutions`;
  root.innerHTML = `<div class="adm">
    <aside class="side" aria-label="Admin navigation"><div class="brand"><img src="/assets/brand/hub-logo.svg" alt="The Gaming Hub"><b>Admin Dashboard</b></div>
      ${NAV.map(([k, i, l]) => `<a href="/admin${k ? '/' + k : ''}" class="${section === k ? 'on' : ''}">${icon(i)}${l}</a>`).join('')}
      <span class="sp" style="flex:1"></span><a href="/" target="_blank">${icon('external-link')}View site</a><a href="#" data-logout>${icon('log-out')}Log out</a>
      <div class="side-tt"><span>Powered by</span><img src="/assets/brand/traptech-wordmark.svg" alt="Trap Tech Solutions"></div></aside>
    <main class="amain"><div class="tt-bar">${icon('zap')} Powered by Trap Tech Solutions <span class="muted">• The Gaming Hub v5</span></div><div class="ahead"><h1>${title}</h1>${actions}<div class="who mini-row" style="margin:0"><span class="av" style="background:linear-gradient(135deg,#7c3aed,#22d3ee)">TT</span><div><b>TrapTech Admin</b><div class="small muted">Admin</div></div></div></div>${inner}</main></div>`;
}
document.addEventListener('click', async (e) => {
  if (e.target.closest('[data-logout]')) { e.preventDefault(); await fetch('/api/admin/logout', { method: 'POST' }); return loginView(); }
  const a = e.target.closest('a[href^="/admin"]'); if (!a || a.target) return;
  e.preventDefault(); history.pushState({}, '', a.getAttribute('href')); render();
});
window.addEventListener('popstate', render);
const nav = (p) => { history.pushState({}, '', p); render(); };

function loginView() {
  root.innerHTML = `<div class="card login glow-purple"><img src="/assets/brand/hub-logo.svg" alt="" style="width:220px;margin:0 auto 10px"><h1 class="center">Admin Login</h1><p class="center small muted" style="margin:-4px 0 14px">Powered by Trap Tech Solutions</p>
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
    if (s === 'channels') return channels(id);
    if (s === 'badges') return badges();
    if (s === 'fairplay') return fairplay(new URLSearchParams(location.search).get('status') || 'open');
    if (s === 'players') return players();
    if (s === 'leaderboards') return leaderboards();
    if (s === 'announcements') return announcements();
    if (s === 'tournaments') return tournaments(id);
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
const IMAGES = ['/assets/giveaways/store-credit-art.webp', '/assets/giveaways/ps5-bundle-art.webp', '/assets/brand/hero-banner.webp', '/assets/cards/v5/jetpack-dash.webp', '/assets/cards/v5/drift-rush.webp', '/assets/cards/v5/plinko.webp', '/assets/cards/v5/spin-to-win.webp', '/assets/cards/v5/memory-match.webp', '/assets/cards/v5/blazed-roulette.webp', '/assets/cards/v5/terp-tapper.webp'];
async function manageGiveaway(id) {
  const isNew = id === 'new';
  const pre = new URLSearchParams(location.search).get('game'); const preG = GAMES.find(x => x.id === pre);
  let g = { title: preG ? `${preG.title} Giveaway` : '', host: '', prize: '', image: preG ? preG.art : IMAGES[0], start_at: nowS(), end_at: nowS() + 7 * 864e5, game_ids: [preG ? preG.id : 'jetpack-dash'], rules: 'Must be 18+ (21+ where required). No purchase necessary. One account per person. Winners are contacted by Trap Tech on Potato.', active: true,
    tier: 'basic', brand_color: '', brand_logo: '', featured: false, min_score: 0, prize_tiers_raw: '' };
  let entrants = [], stats = null;
  const [chs, ed] = await Promise.all([api('/api/admin/channels'), api('/api/admin/eligibility-defaults')]);
  const CH = chs.ok ? chs.channels : []; const DEF = ed.ok ? ed.defaults : {};
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
          <div class="field full"><label class="lbl">Games that count <span class="muted small" id="gpn"></span></label><div class="gpicker" id="gpk">${GAMES.map(x => `<button type="button" class="gp ${sel.has(x.id) ? 'on' : ''}" data-g="${x.id}" aria-pressed="${sel.has(x.id)}"><span class="ck">${icon('check')}</span><img src="${x.art}" alt=""><b>${esc(x.title)}</b></button>`).join('')}</div>
            <div class="hint" style="margin:6px 0 0">Tap to select one or more games. With several games, a player's giveaway score is the sum of their best score in each.</div></div>
          <div class="field"><label class="lbl">Package tier</label><select class="input" id="tier">${[['', 'None'], ['basic', 'Basic'], ['premium', 'Premium'], ['elite', 'Elite']].map(([k, l]) => `<option value="${k}" ${g.tier === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl">Minimum score to qualify</label><input class="input" type="number" min="0" id="minscore" value="${g.min_score || 0}" ${lockA}></div>
          <div class="field"><label class="lbl">Winner selection</label><select class="input" id="wmethod" ${lockA}><option value="score" ${g.win_method !== 'random' ? 'selected' : ''}>Top score (skill)</option><option value="random" ${g.win_method === 'random' ? 'selected' : ''}>Verifiable random draw</option></select></div>
          <div class="field"><label class="lbl">Number of winners <span class="muted small">(0 = one per prize tier)</span></label><input class="input" type="number" min="0" max="100" id="wcount" value="${g.winner_count_raw ?? 0}" ${lockA}></div>
          <div class="field"><label class="lbl">Brand color</label><div style="display:flex;gap:8px"><input type="color" id="bcolor" value="${esc(g.brand_color || '#7c3aed')}" style="width:56px;height:48px;border:0;background:none"><label class="check" style="margin:0"><input type="checkbox" id="usecolor" ${g.brand_color ? 'checked' : ''}> Use brand color</label></div></div>
          <div class="field"><label class="lbl">Brand logo URL</label><input class="input" id="blogo" value="${esc(g.brand_logo)}" placeholder="/assets/... or https://..." maxlength="300"></div>
          <div class="field"><label class="lbl">Brand channel</label><select class="input" id="chan"><option value="">No channel</option>${CH.map(c => `<option value="${c.id}" ${+g.channel_id === c.id ? 'selected' : ''}>${esc(c.name)} (${esc(c.tier)})</option>`).join('')}</select><div class="hint">Giveaways are grouped on the brand's channel page. <a href="/admin/channels">Manage channels</a></div></div>
          <div class="field"><label class="lbl">Sponsor link <span class="muted small">(Premium/Elite - tracked)</span></label><input class="input" id="glink" value="${esc(g.link_url || '')}" placeholder="https://brand.example/..." maxlength="300"><input class="input" id="glinkl" value="${esc(g.link_label || '')}" placeholder="Button label, e.g. Visit Canopy Club" maxlength="40" style="margin-top:6px"></div>
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
            <label class="check"><input type="checkbox" id="e-fol" ${g.elig_followers_only ? 'checked' : ''}> Followers of the brand channel only</label>
            <label class="check"><input type="checkbox" id="e-w" ${g.weight_mode === 'activity' ? 'checked' : ''}> Random draws: activity entries (1 + 1 per 5 runs, max 5)</label>
            <div class="hint">0 = off. Defaults: join required, 3 runs/7 days, 2-day account age, max 3 live entries, 30-day win cooldown, one win per brand per month. Rules show on the giveaway page and in its Official Rules.</div>
          </fieldset>
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
        <div class="card pad" style="margin-bottom:14px" id="wcard">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><h2>${icon('trophy')} Winners</h2>${statusPill(g.status)}</div>
          <p class="small muted" style="margin:6px 0">${g.win_method === 'random' ? `Verifiable random draw • ${g.winner_count} winner${g.winner_count > 1 ? 's' : ''}` : `Top ${g.winner_count} by best qualifying score`}. Ties: higher score, then reached first, then fewer attempts.</p>
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
    const body = { title: $('#title').value, host: $('#host').value, prize: $('#prize').value, image: $('#img').value.trim(), start_at: new Date($('#start').value).getTime(), end_at: new Date($('#end').value).getTime(), entry_method: 'play', game_ids: GAMES.map(x => x.id).filter(k => sel.has(k)), rules: $('#rules').value, active: $('#active').checked,
      tier: $('#tier').value, min_score: +$('#minscore').value || 0, brand_color: $('#usecolor').checked ? $('#bcolor').value : '', brand_logo: $('#blogo').value.trim(), featured: $('#featured').checked, prize_tiers: $('#ptiers').value, win_method: $('#wmethod').value, winner_count: +$('#wcount').value || 0,
      channel_id: $('#chan').value || null, link_url: $('#glink').value.trim(), link_label: $('#glinkl').value.trim(), require_join: $('#e-join').checked, elig_min_runs7: +$('#e-runs').value || 0, elig_account_age_days: +$('#e-age').value || 0,
      elig_max_active: +$('#e-max').value || 0, elig_win_cooldown_days: +$('#e-cool').value || 0, elig_min_xp7: +$('#e-xp').value || 0, elig_brand_month: $('#e-brand').checked, elig_followers_only: $('#e-fol').checked, weight_mode: $('#e-w').checked ? 'activity' : '' };
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
    <div class="rq-top"><span class="rq-pos">${dq ? 'DQ' : `#${e.place ?? e.rank}`}</span><div class="rq-who"><b>${esc(e.username)}</b>${e.banned ? ' <span class="pill red">banned</span>' : ''}<div class="tiny muted">Joined ${e.joined_at ? dt(e.joined_at) : '?'} • rank #${e.final_rank ?? e.rank}${e.draw_pos ? ` • draw #${e.draw_pos}` : ''}${e.tiebreak ? ` • tiebreak: ${esc({ time: 'reached first', attempts: 'fewer attempts', run: 'earlier run' }[e.tiebreak])}` : ''}</div></div>
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

// ---------- bookings ----------
async function bookings() {
  const r = await api('/api/admin/bookings');
  frame('bookings', 'Bookings', `<div class="card wrap-x"><table class="tbl"><thead><tr><th>#</th><th>Brand</th><th>Contact</th><th>Type / Package</th><th>Dates</th><th>Details</th><th>Status</th><th>Note</th><th></th></tr></thead><tbody>
    ${r.bookings.length ? r.bookings.map(b => `<tr data-id="${b.id}"><td>${b.id}</td><td><b>${esc(b.brand)}</b>${demoTag(b.is_demo)}<div class="small muted">${ago(b.created_at)}${b.username ? ' • ' + esc(b.username) : ''}</div></td><td class="small">${esc(b.contact_name)}<br>${esc(b.contact)}${b.business_type ? `<div class="tiny muted">${esc(b.business_type)}${b.licensed_confirmed ? ' • licensed ✓' : ''}</div>` : ''}${b.email ? `<div><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div>` : ''}${b.potato ? `<div><a class="btn sm ghost" href="https://potato.im/${esc(b.potato)}" target="_blank" rel="noopener">${icon('message-circle')} @${esc(b.potato)} on Potato</a></div>` : ''}</td><td class="small">${esc(b.event_type || '-')}<br><span class="pill ${b.package === 'elite' ? 'gold' : ''}">${esc(b.package)}</span>${b.package_snapshot ? `<div class="small muted" data-snap>${esc(b.package_snapshot)}</div>` : ''}</td><td class="small">${esc(b.start_date || '?')}<br>→ ${esc(b.end_date || '?')}</td><td class="small" style="max-width:260px;white-space:pre-wrap">${esc(b.details)}</td>
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
  const [s, pk, ac] = await Promise.all([api('/api/admin/stats'), api('/api/admin/packages'), api('/api/admin/achievements')]);
  frame('settings', 'Settings', `
    <div class="card pad" id="pkg-editor"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="flex:1">${icon('briefcase')} Sponsor packages <span class="muted small">(shown on /host)</span></h2><a class="btn ghost sm" href="/host" target="_blank">${icon('external-link')} View page</a></div>
      <p class="muted small">Edit prices, names and features for each tier. Prices are placeholders - set your real prices here. Changes are live as soon as you save.</p>
      <div id="pkm"></div>
      <div class="pk-ed">${pk.tiers.map((t, i) => `<div class="card pad pk-t" data-i="${i}"><h3 class="orb" style="margin:0 0 10px;text-transform:uppercase">${esc(t.id)}</h3>
        <div class="form-grid"><div class="field"><label class="lbl">Name</label><input class="input" data-f="name" value="${esc(t.name)}"></div><div class="field"><label class="lbl">Launch price</label><input class="input" data-f="price" value="${esc(t.price)}" placeholder="$49"></div><div class="field"><label class="lbl">Regular price <span class="muted small">(shown struck through)</span></label><input class="input" data-f="regular_price" value="${esc(t.regular_price || '')}" placeholder="$79"></div><div class="field"><label class="lbl">Duration</label><input class="input" data-f="duration" value="${esc(t.duration || '')}" placeholder="7 days"></div>
        <div class="field"><label class="lbl">Price note</label><input class="input" data-f="price_note" value="${esc(t.price_note)}" placeholder="per giveaway"></div><div class="field"><label class="lbl">Badge</label><input class="input" data-f="badge" value="${esc(t.badge)}" placeholder="Most popular"></div>
        <div class="field full"><label class="lbl">Tagline</label><input class="input" data-f="tagline" value="${esc(t.tagline)}"></div>
        <div class="field full"><label class="lbl">Who it's for</label><input class="input" data-f="who" value="${esc(t.who)}"></div>
        ${['exposure', 'reach', 'duration', 'branding', 'links', 'winners', 'analytics', 'winner_contact'].map(k => `<div class="field full"><label class="lbl">${k.replace('_', ' ')}</label><input class="input" data-dim="${k}" value="${esc((t.dims || {})[k] || '')}"></div>`).join('')}
        <div class="field full"><label class="lbl">Features (one per line)</label><textarea class="input" data-f="features" style="min-height:150px">${esc(t.features.join('\n'))}</textarea></div></div></div>`).join('')}</div>
      <div class="form-grid"><div class="field"><label class="lbl">Launch label</label><input class="input" id="pk-ll" value="${esc(pk.launch_label || '')}" placeholder="Launch pricing"></div><div class="field"><label class="lbl">Admin Potato handle <span class="muted small">(booking confirmation: "Message us on Potato at @...")</span></label><input class="input" id="pk-ph" value="${esc(pk.potato_handle || '')}" placeholder="TrapTechSolutions"></div>
        <div class="field full"><label class="lbl">Launch note</label><input class="input" id="pk-ln" value="${esc(pk.launch_note || '')}"></div>
        <div class="field full"><label class="lbl">Why links are paid</label><textarea class="input" id="pk-wl">${esc(pk.why_links || '')}</textarea></div></div>
      <div class="field"><label class="lbl">Add-ons <span class="muted small">(one per line: id | Name | Price | Description)</span></label><textarea class="input" id="pk-ad" style="min-height:140px;font-size:.8rem">${esc((pk.addons || []).map(a => [a.id, a.name, a.price, a.desc].join(' | ')).join('\n'))}</textarea></div>
      <div class="field"><label class="lbl">Many brands at once <span class="muted small">(one per line: Title | Text)</span></label><textarea class="input" id="pk-mb" style="min-height:120px;font-size:.8rem">${esc((pk.multi_brand || []).map(r => r.join(' | ')).join('\n'))}</textarea></div>
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
    const tiers = [...document.querySelectorAll('.pk-t')].map(el => { const o = { dims: {} }; el.querySelectorAll('[data-f]').forEach(i => { o[i.dataset.f] = i.dataset.f === 'features' ? i.value.split('\n').map(x => x.trim()).filter(Boolean) : i.value; }); el.querySelectorAll('[data-dim]').forEach(i => { o.dims[i.dataset.dim] = i.value; }); return o; });
    const split = (v) => v.split('\n').map(l => l.trim()).filter(Boolean).map(l => l.split('|').map(x => x.trim()));
    const faq = $('#pk-faq').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
    const addons = split($('#pk-ad').value).map(([id, name, price, desc]) => ({ id, name, price, desc }));
    const multi_brand = $('#pk-mb').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const i = l.indexOf('|'); return i < 0 ? [l, ''] : [l.slice(0, i).trim(), l.slice(i + 1).trim()]; });
    const r = await api('/api/admin/packages', { method: 'PUT', body: { tiers, compare: split($('#pk-cmp').value), faq, addons, multi_brand, launch_label: $('#pk-ll').value, launch_note: $('#pk-ln').value, potato_handle: $('#pk-ph').value, why_links: $('#pk-wl').value } });
    $('#pkm').innerHTML = r.ok ? '<div class="ok-msg">Packages saved - live on /host.</div>' : `<div class="err">${esc(r.error)}</div>`; if (r.ok) toast('Packages saved');
  };
  $('#pk-reset').onclick = async () => { if (!confirm('Reset all package names, prices, features, comparison and FAQ to the defaults?')) return; await api('/api/admin/packages/reset', { method: 'POST' }); toast('Packages reset'); settings(); };
}

render();

// ---------- v5: brand channels ----------
async function channels(editId) {
  const r = await api('/api/admin/channels');
  const c = editId && editId !== 'new' ? r.channels.find(x => String(x.id) === String(editId)) : null;
  const f = c || { name: '', slug: '', tagline: '', logo: '', color: '#7c3aed', tier: 'basic', link_url: '', link_label: '', business_type: '', active: 1 };
  frame('channels', 'Brand Channels', `<p class="muted small" style="margin-top:0">Each sponsor gets its own channel: its giveaways, followers and (Premium/Elite) a tracked link. Players follow the brands they like, so giveaways stay separated by brand and campers can be limited per brand.</p>
    <div class="cols" style="margin-top:0;grid-template-columns:1.2fr 1fr">
      <div class="card wrap-x"><table class="tbl" id="ch-tbl"><thead><tr><th>Channel</th><th>Tier</th><th class="num">Followers</th><th class="num">Link clicks</th><th>Visible</th><th></th></tr></thead><tbody>
        ${r.channels.length ? r.channels.map(x => `<tr data-ch="${x.id}"><td><b>${esc(x.name)}</b>${demoTag(x.is_demo)}<div class="small muted">/c/${esc(x.slug)}</div></td><td><span class="pill ${x.tier === 'elite' ? 'gold' : ''}">${esc(x.tier)}</span></td><td class="num">${fmt(x.followers)}</td><td class="num">${fmt(x.clicks)}</td><td>${x.active ? '<span class="pill green">on</span>' : '<span class="pill red">off</span>'}</td><td><a class="btn sm" href="/admin/channels/${x.id}">Edit</a></td></tr>`).join('') : '<tr><td colspan="6" class="empty">No channels yet.</td></tr>'}
      </tbody></table></div>
      <form class="card pad" id="chf"><h2 style="margin-bottom:10px">${c ? 'Edit channel' : 'New channel'}</h2><div id="chm"></div>
        <div class="field"><label class="lbl">Brand name</label><input class="input" id="c-name" value="${esc(f.name)}" maxlength="60" required></div>
        <div class="field"><label class="lbl">Slug <span class="muted small">(URL: /c/slug)</span></label><input class="input" id="c-slug" value="${esc(f.slug)}" maxlength="40" placeholder="auto from name"></div>
        <div class="field"><label class="lbl">Tagline</label><input class="input" id="c-tag" value="${esc(f.tagline)}" maxlength="160"></div>
        <div class="field"><label class="lbl">Logo</label><input class="input" id="c-logo" value="${esc(f.logo)}" placeholder="/assets/... or https://..." maxlength="300"></div>
        <div class="form-grid"><div class="field"><label class="lbl">Tier</label><select class="input" id="c-tier">${['basic', 'premium', 'elite'].map(t => `<option ${f.tier === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <div class="field"><label class="lbl">Color</label><input type="color" id="c-color" value="${esc(f.color || '#7c3aed')}" style="width:56px;height:44px;border:0;background:none"></div></div>
        <div class="field"><label class="lbl">Channel link <span class="muted small">(shown for Premium/Elite only)</span></label><input class="input" id="c-link" value="${esc(f.link_url)}" placeholder="https://..." maxlength="300"><input class="input" id="c-linkl" value="${esc(f.link_label)}" placeholder="Button label" maxlength="40" style="margin-top:6px"></div>
        <div class="field"><label class="lbl">Business type</label><input class="input" id="c-bt" value="${esc(f.business_type)}" maxlength="80"></div>
        <label class="check"><input type="checkbox" id="c-active" ${f.active ? 'checked' : ''}> Visible</label>
        <div style="display:flex;gap:8px;margin-top:8px"><button class="btn" style="flex:1">${icon('check')} ${c ? 'Save' : 'Create channel'}</button>${c ? `<button class="btn danger" type="button" id="c-del">${icon('trash-2')}</button>` : ''}</div>
      </form></div>`, `<a class="btn sm" href="/admin/channels/new">${icon('plus')} New channel</a>`);
  $('#chf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = { name: $('#c-name').value, slug: $('#c-slug').value, tagline: $('#c-tag').value, logo: $('#c-logo').value.trim(), tier: $('#c-tier').value, color: $('#c-color').value, link_url: $('#c-link').value.trim(), link_label: $('#c-linkl').value, business_type: $('#c-bt').value, active: $('#c-active').checked };
    const x = await api(c ? '/api/admin/channels/' + c.id : '/api/admin/channels', { method: c ? 'PUT' : 'POST', body });
    if (!x.ok) { $('#chm').innerHTML = `<div class="err">${esc(x.error)}</div>`; return; }
    toast('Saved'); nav('/admin/channels');
  });
  const d = $('#c-del'); if (d) d.onclick = async () => { if (!confirm('Delete this channel? Its giveaways stay but lose the channel.')) return; await api('/api/admin/channels/' + c.id, { method: 'DELETE' }); toast('Deleted'); nav('/admin/channels'); };
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

import { icon } from './icons.js';

// ---------------- core ----------------
const $app = document.getElementById('app');
const S = { me: null, games: [], serverOffset: 0, guest: localStorage.getItem('gh_guest') === '1', game: null };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const nowS = () => Date.now() + S.serverOffset;
async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: 'same-origin', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data; try { data = await res.json(); } catch { data = { ok: false, error: `HTTP ${res.status}` }; }
  if (data && data.now) S.serverOffset = data.now - Date.now();
  data.status = res.status; return data;
}
function ago(ms) {
  const s = Math.max(0, (nowS() - ms) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`; return new Date(ms).toLocaleDateString();
}
function toast(msg, ms = 2600) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
const DEMO_AV = { BlazedKing: '/assets/avatars/hooded.webp', TerpQueen: '/assets/avatars/act-1.webp', HighVibes: '/assets/avatars/act-2.webp', SmokeSignals: '/assets/avatars/act-3.webp' };
function avatar(name, demo, cls = '') {
  const img = demo && DEMO_AV[name];
  if (img) return `<span class="av ${cls}" style="background-image:url(${img})"></span>`;
  let h = 0; for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const a = h % 360, b = (a + 60) % 360;
  return `<span class="av ${cls}" style="background:linear-gradient(135deg,hsl(${a} 80% 55%),hsl(${b} 80% 40%))">${esc(String(name).slice(0, 2).toUpperCase())}</span>`;
}
// equipped cosmetics (banner / frame / title / badge) - cosmetic only, no cash value
function framed(name, demo, cos, cls = '') { const f = (cos && cos.frame) || 'none'; return `<span class="frame fr-${esc(f)} ${cls ? 'f-' + cls : ''}">${avatar(name, demo, cls)}</span>`; }
const badgeIcon = (b) => b ? `<span class="eqbadge t-${esc(b.tier)}" title="${esc(b.name)}">${icon(b.icon)}</span>` : '';
function pname(name, demo, cos, extra = '') { return `<span class="pname"><span class="nm">${esc(name)}${extra}${demoTag(demo)}${badgeIcon(cos && cos.badge)}</span>${cos && cos.title ? `<span class="ptitle">${esc(cos.title)}</span>` : ''}</span>`; }
function whoHTML(u, { href = true, extra = '', strip = true } = {}) {
  const inner = `${strip && u.cos ? `<span class="bn-strip bn-${esc(u.cos.banner)}"></span>` : ''}${framed(u.username, u.demo, u.cos)}${pname(u.username, u.demo, u.cos, extra)}`;
  return href ? `<a class="who" href="/u/${encodeURIComponent(u.username)}">${inner}</a>` : `<span class="who">${inner}</span>`;
}
const unitOf = (gid) => (gameById(gid) || {}).unit || 'pts';
const fmtScore = (n, gid) => { const u = unitOf(gid); return u === 'm' ? `${fmt(n)}m` : `${fmt(n)} ${u}`; };
let achQ = [];
function achToast(list) {
  if (!list || !list.length) return;
  let st = document.querySelector('.ach-stack'); if (!st) { st = document.createElement('div'); st.className = 'ach-stack'; document.body.appendChild(st); }
  const show = list.slice(0, 3);
  show.forEach((a, i) => setTimeout(() => {
    const t = document.createElement('a'); t.className = `ach-toast t-${a.tier}`; t.href = '/achievements';
    t.innerHTML = `<span class="ai">${icon(a.icon)}</span><span><small>ACHIEVEMENT UNLOCKED</small><b>${esc(a.name)}</b><em>${(a.rewards || []).map(r => `${r.type === 'banner' ? 'Banner' : r.type === 'frame' ? 'Frame' : 'Title'}: ${esc(r.name)}`).join(' • ') || esc(a.desc)}</em></span>`;
    st.appendChild(t); setTimeout(() => t.classList.add('out'), 5200); setTimeout(() => t.remove(), 5800);
  }, i * 450));
  if (list.length > 3) setTimeout(() => toast(`+${list.length - 3} more achievements unlocked!`, 3500), 1500);
}
window.__achToast = achToast;
const demoTag = (d) => d ? '<span class="demo-tag" title="Sample data for preview">DEMO</span>' : '';
function brandBlock(host) {
  const h = String(host || ''); const cls = /tavern/i.test(h) ? 'alt' : /trap|gaming hub/i.test(h) ? 'tt' : '';
  return `<span class="brandblock ${cls}">${esc(h || 'The Gaming Hub')}</span>`;
}
function cdHTML(target, label = '') {
  return `<div class="cd" data-cd="${target}">${['Days', 'Hrs', 'Min', 'Sec'].map(u => `<div><b>--</b><span>${u}</span></div>`).join('')}</div>${label ? `<div class="small muted center" style="margin:-6px 0 10px">${label}</div>` : ''}`;
}
function tickCountdowns() {
  document.querySelectorAll('[data-cd]').forEach(el => {
    let s = Math.max(0, Math.floor((+el.dataset.cd - nowS()) / 1000));
    const v = [Math.floor(s / 86400), Math.floor(s % 86400 / 3600), Math.floor(s % 3600 / 60), s % 60];
    el.querySelectorAll('b').forEach((b, i) => { b.textContent = String(v[i]).padStart(2, '0'); });
    if (s === 0 && !el.dataset.done) { el.dataset.done = '1'; el.classList.add('ended'); }
  });
}
setInterval(tickCountdowns, 1000);

// ---------------- layout ----------------
const NAV = [['/', 'house', 'Home'], ['/games', 'gamepad-2', 'Games'], ['/leaderboard', 'trophy', 'Leaderboard'], ['/giveaways', 'gift', 'Giveaways'], ['/community', 'users', 'Community']];
function navActive(path) {
  if (path === '/' || path === '/home') return '/';
  const hit = NAV.slice(1).find(([p]) => path.startsWith(p)); if (hit) return hit[0];
  if (path.startsWith('/play')) return '/games';
  return '';
}
function topbar(path) {
  const act = navActive(path);
  return `<header class="topbar">
    <button class="iconbtn menu-btn" data-act="menu" aria-label="Menu">${icon('menu')}</button>
    <a href="/" aria-label="The Gaming Hub home"><img class="logo" src="/assets/brand/logo-horizontal.webp" alt="The Gaming Hub by Trap Tech Solutions" width="150" height="38"></a>
    <nav class="desk-nav">${NAV.map(([p, i, l]) => `<a href="${p}" class="${act === p ? 'on' : ''}">${icon(i)}${l}</a>`).join('')}<a href="/host" class="${path.startsWith('/host') || path.startsWith('/book') ? 'on' : ''}">${icon('briefcase')}Host</a></nav>
    <span class="spacer"></span>
    <a class="iconbtn" href="/giveaways" aria-label="Live giveaways">${icon('bell')}<span class="badge-dot hidden" id="bell-n"></span></a>
    <a class="iconbtn" href="${S.me ? '/u/' + encodeURIComponent(S.me.username) : '/signin'}" aria-label="Profile">${icon('circle-user')}</a>
    <button class="iconbtn" data-act="menu" aria-label="More">${icon('ellipsis-vertical')}</button>
  </header>`;
}
function bottomnav(path) {
  const act = navActive(path);
  return `<nav class="bottomnav">${NAV.map(([p, i, l]) => `<a href="${p}" class="${act === p ? 'on' : ''}">${icon(i)}<span>${l}</span></a>`).join('')}</nav>`;
}
function shell(path, inner, { cls = '' } = {}) {
  $app.innerHTML = `${topbar(path)}<main class="page ${cls}">${inner}</main>${bottomnav(path)}`;
  updateBell();
}
let bellCount = null;
async function updateBell() {
  if (bellCount === null) { const r = await api('/api/giveaways?status=active'); bellCount = r.ok ? r.giveaways.length : 0; }
  const el = document.getElementById('bell-n'); if (el && bellCount) { el.textContent = bellCount; el.classList.remove('hidden'); }
}
function openMenu() {
  const d = document.createElement('div'); d.className = 'drawer';
  d.innerHTML = `<div class="in">
    <img src="/assets/brand/logo-horizontal.webp" alt="" style="width:180px;margin:0 0 12px">
    ${S.me ? `<div class="mini-row" style="margin:0 0 10px">${framed(S.me.username, false, S.me.cos)}${pname(S.me.username, false, S.me.cos)}</div>` : ''}
    ${NAV.map(([p, i, l]) => `<a href="${p}">${icon(i)}${l}</a>`).join('')}
    <a href="/achievements">${icon('medal')}Achievements &amp; Rewards</a>
    <a href="/host">${icon('briefcase')}Host a Game / Giveaway</a>
    ${S.me ? `<a href="/u/${encodeURIComponent(S.me.username)}">${icon('user')}My Profile</a><button class="link" data-act="signout">${icon('log-out')}Sign out</button>`
           : `<a href="/signin">${icon('log-in')}Sign in</a><a href="/signup">${icon('user-plus')}Create account</a>`}
    <span style="flex:1"></span>
    <a href="/admin">${icon('layout-dashboard')}Admin</a>
    <a href="/terms">${icon('file-text')}Terms & Privacy</a>
  </div><div style="flex:1" data-close></div>`;
  d.addEventListener('click', (e) => { if (e.target.closest('a, button') || e.target.hasAttribute('data-close')) setTimeout(() => d.remove(), 0); });
  document.body.appendChild(d);
}
async function signout() { await api('/api/auth/signout', { method: 'POST' }); S.me = null; toast('Signed out'); go('/signin'); }

// ---------------- router ----------------
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
function go(path, replace = false) { if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path); render(); }
document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]');
  if (act) { const a = act.dataset.act; if (a === 'menu') { e.preventDefault(); return openMenu(); } if (a === 'signout') { e.preventDefault(); return signout(); } if (a === 'back') { e.preventDefault(); return history.length > 1 ? history.back() : go('/'); } }
  const a = e.target.closest('a[href]');
  if (!a || a.target || e.metaKey || e.ctrlKey || e.shiftKey) return;
  const href = a.getAttribute('href');
  if (!href.startsWith('/') || href.startsWith('/admin') || href.startsWith('/api') || /\.\w+$/.test(href.split('?')[0])) return;
  e.preventDefault(); go(href);
});
window.addEventListener('popstate', render);
async function render() {
  if (S.game) { S.game.destroy(); S.game = null; }
  document.body.style.overflow = '';
  document.querySelectorAll('.drawer').forEach(x => x.remove());
  const url = new URL(location.href); const path = url.pathname.replace(/\/+$/, '') || '/';
  for (const [re, fn] of routes) { const m = path.match(re); if (m) { window.scrollTo(0, 0); try { await fn(m, url); } catch (err) { console.error(err); shell(path, `<div class="empty">Something went wrong. <a href="/">Go home</a></div>`); } return; } }
  shell(path, `<div class="empty"><h1>404</h1>Page not found. <a href="/">Go home</a></div>`);
}
const gameById = (id) => S.games.find(g => g.id === id);

// ---------------- splash & auth ----------------
route(/^\/welcome$/, () => splash());
function splash() {
  $app.innerHTML = `<div class="splash">
    <div>
      <img class="logo-stack" src="/assets/brand/logo-stacked.webp" alt="The Gaming Hub by Trap Tech Solutions" width="330" height="326">
      <div class="tagline">PLAY <b>•</b> COMPETE <b>•</b> WIN <b>•</b> CONNECT</div>
    </div>
    <div class="cta">
      <a class="btn block" href="/signup">Get Started</a>
      <p class="small muted" style="margin:16px 0 4px">Already have an account?</p>
      <a href="/signin" class="orb" style="font-weight:700;font-size:.85rem;background:var(--grad-v);-webkit-background-clip:text;background-clip:text;color:transparent">SIGN IN</a>
      <p style="margin:10px 0 0"><a href="/" data-guest class="small muted">Just browsing? Continue as Guest</a></p>
      <img class="traptech" src="/assets/brand/traptech-stacked.webp" alt="Trap Tech Solutions" style="height:40px;margin-top:22px">
    </div></div>`;
  localStorage.setItem('gh_seen_splash', '1');
  $app.querySelector('[data-guest]').addEventListener('click', () => { S.guest = true; localStorage.setItem('gh_guest', '1'); });
}
function pwField(id, ph, autocomplete) {
  return `<div class="field ic">${icon('lock')}<input class="input" id="${id}" type="password" placeholder="${ph}" autocomplete="${autocomplete}" required minlength="8">
    <button type="button" class="iconbtn eye" data-eye="${id}" aria-label="Show password">${icon('eye')}</button></div>`;
}
function wireEyes(root) {
  root.querySelectorAll('[data-eye]').forEach(b => b.addEventListener('click', () => { const i = root.querySelector('#' + b.dataset.eye); i.type = i.type === 'password' ? 'text' : 'password'; b.innerHTML = icon(i.type === 'password' ? 'eye' : 'eye-off'); }));
}
route(/^\/signin$/, (m, url) => {
  if (S.me) return go('/', true);
  const remembered = localStorage.getItem('gh_username') || '';
  $app.innerHTML = `<div class="auth">
    <div class="back-row"><button class="iconbtn" data-act="back" aria-label="Back">${icon('chevron-left')}</button></div>
    <img class="logo-h" src="/assets/brand/logo-horizontal.webp" alt="The Gaming Hub" width="220" height="56">
    <div class="card glow-purple" style="margin-top:14px">
      <h1>Welcome Back</h1><p class="sub">Sign in with your Potato username and password.</p>
      <form id="f" novalidate>
        <div id="msg"></div>
        <div class="field ic">${icon('user')}<input class="input" id="u" placeholder="Potato username" autocomplete="username" value="${esc(remembered)}" required></div>
        ${pwField('p', 'Password', 'current-password')}
        <label class="check"><input type="checkbox" id="rem" ${remembered ? 'checked' : ''}> Remember me</label>
        <button class="btn block" type="submit">Sign In</button>
      </form>
      <p class="center small" style="margin:14px 0 4px"><a href="/forgot">Forgot your password?</a></p>
      <p class="center small muted">Don't have an account? <a href="/signup">Create Account</a></p>
      <div class="or">OR</div>
      <p class="center small muted" style="margin:0">Just here to browse? <a href="${esc(url.searchParams.get('next') || '/')}" id="guest">Continue as Guest</a></p>
    </div>
    <img src="/assets/brand/traptech-stacked.webp" alt="Trap Tech Solutions" style="height:38px;margin:26px auto 0">
  </div>`;
  wireEyes($app);
  $app.querySelector('#guest').addEventListener('click', () => { S.guest = true; localStorage.setItem('gh_guest', '1'); });
  $app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault(); const u = $app.querySelector('#u').value.trim(), p = $app.querySelector('#p').value;
    const msg = $app.querySelector('#msg'); if (!u || !p) { msg.innerHTML = `<div class="err">Enter your username and password.</div>`; return; }
    const r = await api('/api/auth/signin', { method: 'POST', body: { username: u, password: p } });
    if (!r.ok) { msg.innerHTML = `<div class="err">${esc(r.error)}</div>`; return; }
    if ($app.querySelector('#rem').checked) localStorage.setItem('gh_username', r.user.username); else localStorage.removeItem('gh_username');
    S.me = r.user; S.guest = false; localStorage.removeItem('gh_guest'); toast(`Welcome back, ${r.user.username}!`);
    go(url.searchParams.get('next') || '/', true);
  });
});
route(/^\/signup$/, (m, url) => {
  if (S.me) return go('/', true);
  $app.innerHTML = `<div class="auth">
    <div class="back-row"><button class="iconbtn" data-act="back" aria-label="Back">${icon('chevron-left')}</button></div>
    <img class="logo-h" src="/assets/brand/logo-horizontal.webp" alt="The Gaming Hub" width="220" height="56">
    <div class="card glow-purple" style="margin-top:14px">
      <h1 style="text-align:left">Create Your Account</h1><p class="sub" style="text-align:left">Choose a unique Potato username and set your password.</p>
      <form id="f" novalidate>
        <div id="msg"></div>
        <div class="field ic">${icon('user')}<input class="input" id="u" placeholder="Choose your Potato username" autocomplete="username" maxlength="20" required></div>
        <div class="hint">Must be unique (no spaces). 3-20 letters, numbers, _ . -</div>
        ${pwField('p', 'Password', 'new-password')}
        <div class="hint">Minimum 8 characters</div>
        ${pwField('p2', 'Confirm Password', 'new-password')}
        <label class="check"><input type="checkbox" id="agree"> <span>I agree to the <a href="/terms" target="_blank">Terms of Service</a> &amp; <a href="/terms#privacy" target="_blank">Privacy Policy</a></span></label>
        <button class="btn block" type="submit">Create Account</button>
      </form>
      <p class="center small muted" style="margin:16px 0 0">Already have an account? <a href="/signin">Sign In</a></p>
    </div>
    <img src="/assets/brand/traptech-stacked.webp" alt="Trap Tech Solutions" style="height:38px;margin:26px auto 0">
  </div>`;
  wireEyes($app);
  $app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = $app.querySelector('#msg');
    const u = $app.querySelector('#u').value.trim(), p = $app.querySelector('#p').value, p2 = $app.querySelector('#p2').value, agree = $app.querySelector('#agree').checked;
    const fail = (t) => { msg.innerHTML = `<div class="err">${esc(t)}</div>`; };
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) return fail('Username must be 3-20 characters: letters, numbers, _ . - (no spaces).');
    if (p.length < 8) return fail('Password must be at least 8 characters.');
    if (p !== p2) return fail('Passwords do not match.');
    if (!agree) return fail('Please agree to the Terms of Service and Privacy Policy.');
    const r = await api('/api/auth/signup', { method: 'POST', body: { username: u, password: p, agree } });
    if (!r.ok) return fail(r.error);
    S.me = r.user; S.guest = false; localStorage.removeItem('gh_guest'); localStorage.setItem('gh_username', r.user.username);
    toast(`Account created. Welcome, ${r.user.username}!`); achToast(r.unlocked); go(url.searchParams.get('next') || '/games/jetpack-dash', true);
  });
});
route(/^\/forgot$/, () => shell('/forgot', `<div class="narrow"><div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Forgot password</h1></div>
  <div class="card pad"><p>Password resets are handled by the hub admins. Message Trap Tech Solutions with your Potato username and an admin will give you a temporary password, which you can change from your profile settings.</p>
  <a class="btn block" href="/signin">Back to sign in</a></div></div>`));
route(/^\/terms$/, () => shell('/terms', `<div class="narrow"><div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Terms &amp; Privacy</h1></div>
  <div class="card pad"><h2>Terms of Service</h2><p class="muted">Play fair: one account per person. Automated play, score tampering or multiple accounts lead to disqualification and removal. Giveaway eligibility, prizes and rules are set per giveaway by the host brand and shown on each giveaway page. No purchase necessary.</p>
  <h2 id="privacy" style="margin-top:16px">Privacy Policy</h2><p class="muted">We store your Potato username, a salted password hash, your game runs (score, coins, time) and a one-way hash of your IP address for anti-cheat and rate limiting. Booking requests store the contact details you enter. We do not sell your data. Ask an admin to delete your account at any time.</p></div></div>`));


// ---------------- home ----------------
route(/^\/(home)?$/, async () => {
  if (!S.me && !S.guest && !localStorage.getItem('gh_seen_splash')) return splash();
  shell('/', `<div class="skeleton"></div>`);
  const [gw, lb] = await Promise.all([api('/api/giveaways?status=active'), api('/api/leaderboard?game=global&limit=3')]);
  const live = gw.ok ? gw.giveaways : [];
  const takeover = live.find(x => x.tier === 'elite' && x.featured);
  const featuredGw = live.filter(x => x.featured && x !== takeover);
  const g0 = live.find(x => x !== takeover) || null;
  const featured = S.games.slice(0, 4);
  shell('/', `
    ${takeover ? heroTakeover(takeover) : `<div class="hero"><img src="/assets/brand/hero-banner.webp" alt="The Gaming Hub - Play, Compete, Win, Connect" width="1336" height="400"></div>`}
    ${!S.me ? `<div class="card pad" style="margin-top:12px;display:flex;align-items:center;gap:12px"><div style="flex:1"><b>Play to enter giveaways</b><div class="small muted">Create a free account so your scores count and you unlock rewards.</div></div><a class="btn sm" href="/signup">Sign up</a></div>` : ''}
    ${featuredGw.length ? `<div class="section-h"><h2>${icon('sparkles')} Featured Giveaways</h2><a href="/giveaways">View All</a></div><div class="feat-gw">${featuredGw.map(featCard).join('')}</div>` : ''}
    <div class="section-h"><h2>Featured Games</h2><a href="/games">View All</a></div>
    <div class="hscroll">${featured.map(g => gameCard(g, true)).join('')}</div>
    <div class="home-split">
      <div class="card">
        <div class="panel-h"><h2>Live Giveaways</h2><a href="/giveaways" class="small">View All</a></div>
        ${g0 ? `<div class="card branded" style="margin:8px 12px 14px;padding:12px;${brandStyle(g0)}">
            <div style="display:grid;grid-template-columns:1fr 38%;gap:10px;align-items:center">
              <div><div class="orb" style="font-weight:800;font-size:1rem">${esc(g0.title)}${demoTag(g0.demo)}</div><div class="small muted">Hosted by ${esc(g0.host)}</div>${tierPill(g0)}</div>
              ${g0.image ? `<div class="gw art" style="padding:0;margin:0;border-radius:10px;aspect-ratio:1.3/1;background:center/cover url('${esc(g0.image)}')"></div>` : '<div></div>'}
            </div>
            ${cdHTML(g0.end_at)}
            <a class="btn block" href="/giveaways/${g0.id}">Enter Now</a>
            <div class="small muted center" style="margin-top:8px">${fmt(g0.entrants)} entrant${g0.entrants === 1 ? '' : 's'} • play ${esc(g0.game_title)} to enter</div>
          </div>` : `<div class="empty">No live giveaways right now. <a href="/giveaways">See upcoming</a></div>`}
      </div>
      <div class="card">
        <div class="panel-h"><h2><span class="crown">${icon('crown')}</span>Global Leaderboard</h2></div>
        <div class="mini-row" style="background:transparent;border:0;padding:4px 12px;margin:4px 10px 0"><span class="small muted">Top Players</span><a class="small" style="margin-left:auto" href="/leaderboard">View All</a></div>
        ${(lb.rows || []).length ? lb.rows.map(r => `<div class="mini-row"><span class="n">${r.rank}</span>${whoHTML(r)}<span class="s">${fmt(r.score)}</span></div>`).join('')
          : `<div class="empty">No scores yet - be the first!</div>`}
        <div style="height:10px"></div>
      </div>
    </div>
    <a class="card pad ach-promo" href="/achievements"><span class="ai">${icon('medal')}</span><div><b>Achievements &amp; Rewards</b><div class="small muted">Unlock 80+ achievements to earn profile banners, avatar frames and titles. Cosmetic only, no cash value.</div></div>${icon('chevron-right')}</a>
    <div class="section-h"><h2>Host a Game</h2><a href="/host">Learn more</a></div>
    <a class="banner" href="/host" style="display:block;color:var(--text)"><h2>Get Your Brand in the Game</h2><div class="small" style="color:#d9dcff">Basic, Premium and Elite giveaway packages - from a simple prize drop to a full 30-day brand takeover.</div></a>
    <div class="footer-note"><img src="/assets/brand/traptech.webp" alt="Trap Tech Solutions">Powering the next generation of online gaming</div>`);
  tickCountdowns();
});
const brandStyle = (g) => g.brand_color && /^#[0-9a-f]{3,8}$/i.test(g.brand_color) ? `--brand:${g.brand_color};` : '';
const TIER_L = { basic: 'Basic', premium: 'Premium', elite: 'Elite' };
const tierPill = (g) => g.tier && TIER_L[g.tier] ? `<span class="tier-pill ${g.tier}">${g.tier === 'elite' ? icon('gem') : g.tier === 'premium' ? icon('star') : ''}${TIER_L[g.tier]}</span>` : '';
const brandMark = (g) => g.brand_logo ? `<img class="brand-logo" src="${esc(g.brand_logo)}" alt="${esc(g.host)}">` : brandBlock(g.host);
function heroTakeover(g) {
  return `<a class="hero-take" href="/giveaways/${g.id}" style="${brandStyle(g)}${g.image ? `--img:url('${esc(g.image)}')` : ''}">
    <div class="ht-in"><span class="ht-kicker">${icon('gem')} PRESENTED BY ${esc(g.host || 'OUR PARTNER')}</span>
      <div class="ht-title">${esc(g.title)}${demoTag(g.demo)}</div>
      <div class="ht-sub">Play ${esc(g.game_title)} to enter • ${fmt(g.entrants)} entrant${g.entrants === 1 ? '' : 's'}${g.prize_tiers.length ? ` • ${g.prize_tiers.length} prize tiers` : ''}</div>
      ${cdHTML(g.end_at)}<span class="btn sm">Enter Now ${icon('chevron-right')}</span></div>
    ${g.image ? `<div class="ht-art"></div>` : ''}</a>`;
}
function featCard(g) {
  return `<a class="card fgw branded" href="/giveaways/${g.id}" style="${brandStyle(g)}">${g.image ? `<div class="art" style="background-image:url('${esc(g.image)}')"></div>` : ''}
    <div class="m">${tierPill(g)}<b>${esc(g.title)}</b><span class="small muted">${esc(g.host)} • ${esc(g.game_title)}</span><span class="small" style="color:var(--green)">${fmt(g.entrants)} entrants</span></div></a>`;
}
function gameCard(g, tall = false) {
  const art = (tall && g.artTall) || g.art;
  return `<a class="gcard ${tall ? '' : 'wide'}" href="/games/${g.id}" data-game="${g.id}">
    <div class="art" style="background-image:url('${art}')"><span class="live">PLAY NOW</span>${g.id !== 'jetpack-dash' ? '<span class="new">NEW</span>' : ''}</div>
    <div class="meta"><div class="t">${esc(g.title)}</div><div class="c">${icon('gamepad-2')} ${esc(g.category)}</div></div></a>`;
}

// ---------------- games ----------------
route(/^\/games$/, (m, url) => {
  let cat = url.searchParams.get('cat') || 'All'; let q = '';
  const cats = ['All', 'Arcade', 'Racing', 'Casual', 'Casino', 'Puzzle'];
  shell('/games', `<h1>Games <span class="pill green" style="vertical-align:middle">${S.games.length} playable</span></h1>
    <div class="field ic">${icon('search')}<input class="input" id="q" placeholder="Search games..." autocomplete="off"></div>
    <div class="chips" id="chips">${cats.map(c => `<button class="chip ${c === cat ? 'on' : ''}" data-c="${c}">${c}</button>`).join('')}</div>
    <div class="grid2 games-grid" id="grid"></div>
    <div class="section-h"><h2>Featured Games</h2><a href="/achievements">${icon('medal')} Achievements</a></div>
    <div class="grid2 games-grid">${S.games.filter(g => g.featured).map(g => gameCard(g)).join('')}</div>
    <p class="small dim center" style="margin-top:14px">All games are free to play. Casino-style games use points only: no real money, no purchases.</p>`);
  const draw = () => {
    const list = S.games.filter(g => !g.featured && (cat === 'All' || g.category === cat) && g.title.toLowerCase().includes(q));
    const feat = (cat !== 'All' || q) ? S.games.filter(g => g.featured && (cat === 'All' || g.category === cat) && g.title.toLowerCase().includes(q)) : [];
    document.getElementById('grid').innerHTML = [...list, ...feat].map(g => gameCard(g)).join('') || `<div class="empty" style="grid-column:1/-1">No games match.</div>`;
  };
  draw();
  document.getElementById('q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  document.getElementById('chips').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; document.querySelectorAll('#chips .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
});
route(/^\/games\/([\w-]+)$/, async (m) => {
  const g = gameById(m[1]); if (!g) return shell('/games', `<div class="empty">Game not found. <a href="/games">All games</a></div>`);
  const fav = () => JSON.parse(localStorage.getItem('gh_favs') || '[]');
  const [lb, gw] = await Promise.all([api(`/api/leaderboard?game=${g.id}&limit=5`), api('/api/giveaways?status=active')]);
  const linked = (gw.giveaways || []).filter(x => (x.game_ids || []).includes(g.id));
  const sponsor = linked.find(x => (x.tier === 'premium' || x.tier === 'elite') && (x.brand_color || x.brand_logo));
  const T = ['Bronze', 'Silver', 'Gold'];
  shell('/games', `<div class="two-col" style="${sponsor ? brandStyle(sponsor) : ''}">
    <div class="gd-hero" style="background-image:url('${(g.artTall || g.art)}')">
      <button class="iconbtn" data-act="back" style="left:10px" aria-label="Back">${icon('chevron-left')}</button>
      <button class="iconbtn" id="fav" style="right:10px" aria-label="Favorite">${icon('heart')}</button>
    </div>
    <div>
      ${sponsor ? `<a class="sponsor-bar" href="/giveaways/${sponsor.id}">${brandMark(sponsor)}<span><small>GIVEAWAY LIVE ON THIS GAME</small><b>${esc(sponsor.title)}</b></span>${icon('chevron-right')}</a>` : ''}
      <h1 style="margin-top:14px;text-transform:uppercase">${esc(g.title)}</h1>
      <div class="tags">${g.tags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
      <p class="muted" style="margin:0 0 14px">${esc(g.desc)}</p>
      <a class="btn block" href="/play/${g.id}" style="margin:0 0 10px;height:54px;font-size:1rem">${icon('play')} Play Now</a>
      ${!S.me ? `<p class="small muted center">Playing as guest: scores won't be saved. <a href="/signin?next=/play/${g.id}">Sign in</a> to compete.</p>` : ''}
      ${linked.length ? `<div class="card pad" style="margin:12px 0"><h2 style="font-size:.8rem;margin-bottom:8px">${icon('gift')} Your runs count for</h2>${linked.map(x => `<a class="mini-row" style="margin:6px 0;color:var(--text)" href="/giveaways/${x.id}">${tierPill(x)}<span>${esc(x.title)}</span><span class="s small">${fmt(x.entrants)} entrants</span></a>`).join('')}</div>` : ''}
      <div class="card"><div class="panel-h"><h2 style="text-transform:none">Top Scores <i class="muted" style="font-weight:500">(This Game)</i></h2><a class="small" href="/leaderboard?game=${g.id}">View All</a></div>
        ${lb.rows.length ? lb.rows.map(r => `<div class="mini-row"><span class="n">${r.rank}</span>${whoHTML(r)}<span class="s">${fmtScore(r.score, g.id)}</span></div>`).join('') : `<div class="empty">No scores yet - be the first!</div>`}
        ${lb.me ? `<div class="mini-row" style="border-color:rgba(168,85,247,.6)"><span class="n">${lb.me.rank}</span>${whoHTML(lb.me, { extra: ' (you)' })}<span class="s">${fmtScore(lb.me.score, g.id)}</span></div>` : ''}
        <div style="height:10px"></div></div>
      <div class="card pad" style="margin-top:14px"><h2 style="font-size:.8rem;margin-bottom:6px">How to play</h2><p class="small muted" style="margin:0">${esc(g.howto)}</p>
        <h2 style="font-size:.8rem;margin:12px 0 6px">Scoring</h2><p class="small muted" style="margin:0">${esc(g.scoring)}</p>
        <div class="tier-row">${g.tiers.map((t, i) => `<span class="tt t-${T[i].toLowerCase()}">${icon('medal')} ${T[i]} <b>${fmtScore(t, g.id)}</b></span>`).join('')}</div></div>
    </div></div>`);
  const favBtn = document.getElementById('fav');
  const paint = () => { favBtn.style.color = fav().includes(g.id) ? '#f472b6' : ''; };
  paint(); favBtn.addEventListener('click', () => { const f = fav(); const i = f.indexOf(g.id); i >= 0 ? f.splice(i, 1) : f.push(g.id); localStorage.setItem('gh_favs', JSON.stringify(f)); paint(); toast(i >= 0 ? 'Removed from favorites' : 'Added to favorites'); });
});

// ---------------- play ----------------
route(/^\/play\/([\w-]+)$/, async (m, url) => {
  const g = gameById(m[1]); if (!g || !g.playable) return go('/games/' + m[1], true);
  const giveawayId = url.searchParams.get('giveaway');
  document.body.style.overflow = 'hidden';
  $app.innerHTML = `<div class="play-wrap">
    <div class="play-top">
      <button class="iconbtn" id="exit" aria-label="Exit">${icon('chevron-left')}</button>
      <span class="title">${esc(g.title.toUpperCase())}</span>
      <span class="who-chip">${S.me ? `Playing as <b style="color:var(--text)">${esc(S.me.username)}</b>` : 'Guest (practice)'}</span>
      <button class="iconbtn" id="mute" aria-label="Sound"></button>
      <button class="iconbtn" id="pause" aria-label="Pause">${icon('pause')}</button>
    </div>
    <div style="position:relative;flex:1;display:flex;min-height:0">
      <canvas id="game" data-game="${g.id}"></canvas>
      <div class="rotate-tip hidden" id="rot">Tip: rotate your phone for a bigger view</div>
      <div class="overlay hidden" id="ov"></div>
    </div></div>`;
  const mod = await import('./' + g.module); const Cls = mod[g.cls];
  const bestKey = g.id === 'jetpack-dash' ? 'jd_best' : 'gh_best_' + g.id;
  let best = +localStorage.getItem(bestKey) || 0;
  if (S.me) { const p = await api('/api/profile/' + encodeURIComponent(S.me.username)); const b = p.ok && p.profile.best_by_game.find(x => x.game_id === g.id); if (b) best = Math.max(best, b.best); }
  if (!document.getElementById('game')) return; // navigated away while loading
  let token = null; let tokenErr = null;
  const getToken = async () => { token = null; tokenErr = null; if (!S.me) return; const r = await api('/api/run/start', { method: 'POST', body: { game_id: g.id } }); if (r.ok) token = r.token; else tokenErr = r.error; };
  const ov = document.getElementById('ov');
  const canvas = document.getElementById('game');
  const game = new Cls(canvas, { best, onEnd: (res) => finish(res), onState: (s) => { const pb = document.getElementById('pause'); if (pb) pb.innerHTML = icon(s === 'paused' ? 'play' : 'pause'); if (s === 'paused') showPause(); else if (s === 'play') ov.classList.add('hidden'); } });
  S.game = game; window.__game = game; window.__lastResult = null;
  const setMute = () => { document.getElementById('mute').innerHTML = icon(game.sfx.muted ? 'volume-x' : 'volume-2'); };
  setMute();
  document.getElementById('mute').onclick = () => { game.sfx.toggle(); setMute(); };
  document.getElementById('pause').onclick = () => game.togglePause();
  document.getElementById('exit').onclick = () => go('/games/' + g.id);
  if (g.id === 'jetpack-dash') { const rot = document.getElementById('rot'); const checkRot = () => rot.classList.toggle('hidden', !(innerHeight > innerWidth && innerWidth < 700)); checkRot(); addEventListener('resize', checkRot); }
  function showPause() {
    ov.innerHTML = `<div class="card over-card"><h2>Paused</h2><div class="btns"><button class="btn block" id="res">${icon('play')} Resume</button><button class="btn ghost block" id="endrun">${icon('flag')} End run &amp; save score</button><button class="btn ghost block" id="quit">Quit without saving</button></div></div>`;
    ov.classList.remove('hidden');
    ov.querySelector('#res').onclick = () => game.pause(false); ov.querySelector('#quit').onclick = () => go('/games/' + g.id);
    ov.querySelector('#endrun').onclick = () => game.endNow();
  }
  async function finish(res) {
    if (res.score > (+localStorage.getItem(bestKey) || 0)) localStorage.setItem(bestKey, res.score);
    ov.innerHTML = `<div class="card over-card glow-purple"><div class="small muted orb">RUN OVER</div><div class="big">${fmtScore(res.score, g.id)}</div>${res.coins ? `<div class="muted">${icon('coins')} ${res.coins} ${g.id === 'jetpack-dash' ? 'coins' : 'bonus'}</div>` : ''}<div id="sv" style="margin-top:12px"><div class="small muted">Saving score...</div></div>
      <div class="btns"><button class="btn block" id="again">${icon('rotate-ccw')} Play Again</button><a class="btn ghost block" href="/leaderboard?game=${g.id}">${icon('trophy')} Leaderboard</a><a class="btn ghost block" href="/games/${g.id}">Back</a></div></div>`;
    ov.classList.remove('hidden');
    ov.querySelector('#again').onclick = async () => { ov.classList.add('hidden'); await getToken(); game.restart(); };
    const sv = ov.querySelector('#sv');
    if (!S.me) { sv.innerHTML = `<div class="err" style="margin:0">Guest run - not saved. <a href="/signup?next=/play/${g.id}">Create an account</a> or <a href="/signin?next=/play/${g.id}">sign in</a> to save scores and enter giveaways.</div>`; return; }
    if (!token) { sv.innerHTML = `<div class="err" style="margin:0">Score not saved: ${esc(tokenErr || 'no run token')}</div>`; return; }
    const r = await api('/api/score', { method: 'POST', body: { token, score: res.score, coins: res.coins, duration_ms: res.duration_ms, giveaway_id: giveawayId || undefined } });
    token = null; window.__lastResult = r;
    if (!r.ok) { sv.innerHTML = `<div class="err" style="margin:0">Score not saved: ${esc(r.error)}</div>`; return; }
    const gw = (r.giveaways || []).map(x => `<div class="small" style="margin-top:4px">${icon('gift')} ${x.qualified ? `Counted for <b>${esc(x.title)}</b> - rank #${x.rank} of ${x.entrants}` : `<b>${esc(x.title)}</b> needs ${fmt(x.min_score)}+ to qualify`}</div>`).join('');
    const st = r.giveaway_status;
    const stMsg = st && st !== 'counted' ? `<div class="small" style="color:#fcd34d;margin-top:4px">${st === 'game_not_linked' ? 'This game is not part of that giveaway - run not counted for it.' : st === 'below_min_score' ? 'Below the minimum score for that giveaway - run not counted for it.' : `This giveaway is ${st.includes('ended') ? 'over' : 'not open'} - run not counted for it.`}</div>` : '';
    sv.innerHTML = `<div class="ok-msg" style="margin:0">${r.personal_best ? '<b>New personal best!</b> ' : ''}Saved. You're <b>#${r.rank}</b> of ${r.players} on the ${esc(g.title)} board (best ${fmtScore(r.best, g.id)}).${gw}${stMsg}</div>
      ${r.unlocked && r.unlocked.length ? `<div class="unl-list">${r.unlocked.slice(0, 4).map(a => `<a href="/achievements" class="unl t-${a.tier}">${icon(a.icon)} ${esc(a.name)}</a>`).join('')}${r.unlocked.length > 4 ? `<span class="small muted">+${r.unlocked.length - 4} more</span>` : ''}</div>` : ''}`;
    achToast(r.unlocked);
  }
  await getToken();
  if (tokenErr) toast('Score saving unavailable: ' + tokenErr, 4000);
  await game.ready; game.start();
});

// ---------------- leaderboard ----------------
route(/^\/leaderboard$/, async (m, url) => {
  let period = url.searchParams.get('period') || 'all'; let game = url.searchParams.get('game') || 'global';
  let showMine = false;
  shell('/leaderboard', `<div class="narrow"><h1>${game === 'global' ? 'Global' : esc(gameById(game)?.title || '')} Leaderboard</h1>
    <div class="tabs" id="per">${[['all', 'All Time'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) => `<button data-p="${k}" class="${k === period ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div class="chips" id="gsel" style="padding:0;flex:1">${[['global', 'Global'], ...S.games.filter(x => x.playable).map(x => [x.id, x.title])].map(([k, l]) => `<button class="chip ${k === game ? 'on' : ''}" data-g="${k}">${esc(l)}</button>`).join('')}</div>
      <label class="check small" style="margin:0;white-space:nowrap">View My Rank <input type="checkbox" id="mine"></label>
    </div>
    <div class="card" id="tbl"><div class="skeleton" style="margin:12px"></div></div>
    <p class="small dim center">${'Weekly = last 7 days, Monthly = last 30 days. Global score = sum of each player\'s best score per game. Banners, frames and titles are earned from achievements.'}</p></div>`);
  async function load() {
    history.replaceState({}, '', `/leaderboard?game=${game}&period=${period}`);
    document.querySelector('main h1').textContent = `${game === 'global' ? 'Global' : gameById(game)?.title} Leaderboard`;
    const r = await api(`/api/leaderboard?game=${game}&period=${period}&limit=100`);
    const el = document.getElementById('tbl'); if (!el) return;
    if (!r.ok) { el.innerHTML = `<div class="empty">${esc(r.error)}</div>`; return; }
    if (!r.rows.length) { el.innerHTML = `<div class="empty">No scores in this period yet. <a href="/play/${game === 'global' ? 'jetpack-dash' : game}">Play now</a></div>`; return; }
    const myName = S.me && S.me.username.toLowerCase();
    const u = game === 'global' ? null : game;
    const meRow = r.me && !r.rows.some(x => x.rank === r.me.rank) ? r.me : null;
    el.innerHTML = `<table class="lb"><thead><tr><th>#</th><th>Player</th><th>Score</th></tr></thead><tbody>
      ${r.rows.map(x => `<tr class="${myName && x.username.toLowerCase() === myName ? 'me' : ''}"><td class="rk">${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</td><td>${whoHTML(x)}</td><td class="sc ${x.rank <= 3 ? 'hi' : ''}">${u ? fmtScore(x.score, u) : fmt(x.score)}</td></tr>`).join('')}
      ${meRow ? `<tr class="me"><td class="rk">${meRow.rank}</td><td>${whoHTML(meRow, { extra: ' (you)' })}</td><td class="sc">${u ? fmtScore(meRow.score, u) : fmt(meRow.score)}</td></tr>` : ''}
    </tbody></table><div class="small muted center" style="padding:10px">${fmt(r.total)} player${r.total === 1 ? '' : 's'} ranked</div>`;
    if (showMine) jumpMine(r);
  }
  function jumpMine(r) {
    if (!S.me) { toast('Sign in to see your rank'); return; }
    if (!r || !r.me) { toast('You have no score in this period yet'); return; }
    const tr = document.querySelector('.lb tr.me'); if (tr) tr.scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(`Your rank: #${r.me.rank} (${fmt(r.me.score)})`);
  }
  document.getElementById('per').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; period = b.dataset.p; document.querySelectorAll('#per button').forEach(x => x.classList.toggle('on', x === b)); load(); });
  document.getElementById('gsel').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (!b) return; game = b.dataset.g; document.querySelectorAll('#gsel .chip').forEach(x => x.classList.toggle('on', x === b)); load(); });
  document.getElementById('mine').addEventListener('change', async (e) => { showMine = e.target.checked; if (showMine) { const r = await api(`/api/leaderboard?game=${game}&period=${period}&limit=1`); jumpMine(r); } });
  load();
});

// ---------------- giveaways ----------------
function giveawayCard(g) {
  const target = g.status === 'upcoming' ? g.start_at : g.end_at;
  return `<div class="card gw branded ${g.featured ? 'feat' : ''}" style="${brandStyle(g)}">
    <div class="row"><div>
      ${tierPill(g)}${g.featured ? `<span class="tier-pill feat">${icon('sparkles')}Featured</span>` : ''}
      <h3>${esc(g.title)}${demoTag(g.demo)}</h3><div class="host">Hosted by ${esc(g.host || 'The Gaming Hub')}</div>
      ${brandMark(g)}
    </div>${g.image ? `<div class="art" style="background-image:url('${esc(g.image)}')"></div>` : '<div></div>'}</div>
    <div class="gw-games">${(g.game_ids || []).map(id => { const x = gameById(id); return x ? `<span class="gchip"><img src="${x.art}" alt="">${esc(x.title)}</span>` : ''; }).join('')}${g.min_score ? `<span class="gchip rule">${icon('target')} Min ${fmt(g.min_score)}</span>` : ''}${g.prize_tiers && g.prize_tiers.length ? `<span class="gchip rule">${icon('trophy')} ${g.prize_tiers.length} prize tiers</span>` : ''}</div>
    ${g.status === 'past' ? `<div class="small muted" style="margin:10px 0">Ended ${new Date(g.end_at).toLocaleDateString()} • ${fmt(g.entrants)} entrants</div>
        ${g.winners.length ? `<div style="margin-bottom:10px">${g.winners.map(w => `<span class="pill gold" style="margin:0 6px 6px 0">${icon('crown')} ${esc(w.username)}</span>`).join('')}</div>` : '<div class="small muted" style="margin-bottom:10px">Winner to be announced</div>'}`
      : cdHTML(target, g.status === 'upcoming' ? 'Starts in' : `${fmt(g.entrants)} entrant${g.entrants === 1 ? '' : 's'} • Play ${esc(g.game_title)}`)}
    <a class="btn block ${g.status !== 'active' ? 'ghost' : ''}" href="/giveaways/${g.id}">${g.status === 'active' ? 'Enter Now' : g.status === 'upcoming' ? 'View Details' : 'View Results'}</a>
  </div>`;
}
route(/^\/giveaways$/, async (m, url) => {
  let tab = url.searchParams.get('tab') || 'active';
  shell('/giveaways', `<h1>Giveaways</h1><div class="tabs" id="t">${['active', 'upcoming', 'past'].map(k => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div><div id="list" class="gw-list"><div class="skeleton"></div></div>
    <p class="small dim center">No purchase necessary. Play any linked game while a giveaway is live to enter. <a href="/host#faq">How giveaways work</a></p>`);
  async function load() {
    history.replaceState({}, '', `/giveaways?tab=${tab}`);
    const r = await api('/api/giveaways?status=' + tab); const el = document.getElementById('list'); if (!el) return;
    el.innerHTML = r.ok && r.giveaways.length ? r.giveaways.map(giveawayCard).join('') : `<div class="empty card" style="grid-column:1/-1">No ${tab} giveaways right now.</div>`;
    tickCountdowns();
  }
  document.getElementById('t').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; tab = b.dataset.k; document.querySelectorAll('#t button').forEach(x => x.classList.toggle('on', x === b)); load(); });
  load();
});
route(/^\/giveaways\/(\d+)$/, async (m) => {
  const r = await api('/api/giveaways/' + m[1]);
  if (!r.ok) return shell('/giveaways', `<div class="empty">Giveaway not found. <a href="/giveaways">All giveaways</a></div>`);
  const g = r.giveaway; const multi = g.game_ids.length > 1;
  const sc = (n) => multi ? `${fmt(n)} pts` : fmtScore(n, g.game_id);
  const playBtns = g.game_ids.map(id => { const x = gameById(id); const href = `/play/${id}?giveaway=${g.id}`; return x ? `<a class="gpick" href="${S.me ? href : `/signin?next=${encodeURIComponent(href)}`}"><img src="${x.art}" alt=""><span>${esc(x.title)}</span>${icon('play')}</a>` : ''; }).join('');
  shell('/giveaways', `<div class="narrow">
    <div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>${esc(g.title)}${demoTag(g.demo)}</h1></div>
    <div class="card gw branded" style="${brandStyle(g)}">
      <div class="row"><div><div class="host">Hosted by ${esc(g.host)}</div>${brandMark(g)}<div style="margin-top:10px"><span class="pill ${g.status === 'active' ? 'green' : g.status === 'upcoming' ? '' : 'red'}">${g.status.toUpperCase()}</span> ${tierPill(g)}</div></div>
      ${g.image ? `<div class="art" style="background-image:url('${esc(g.image)}')"></div>` : '<div></div>'}</div>
      <p style="margin:12px 0 4px"><b>Prize:</b> ${esc(g.prize || g.title)}</p>
      ${g.prize_tiers.length ? `<div class="ptiers">${g.prize_tiers.map((p, i) => `<div><span>${icon(/random/i.test(p) ? 'shuffle' : i === 0 ? 'crown' : 'trophy')}</span>${esc(p)}</div>`).join('')}</div>` : ''}
      <p class="small muted" style="margin:6px 0 6px">Entry: play ${multi ? `any of <b>${esc(g.game_title)}</b>` : `<b>${esc(g.game_title)}</b>`} between ${new Date(g.start_at).toLocaleString()} and ${new Date(g.end_at).toLocaleString()}.${g.min_score ? ` Runs need at least <b>${fmt(g.min_score)}</b> points to qualify.` : ''} ${multi ? 'Your giveaway score is the sum of your best score in each linked game.' : 'Higher scores rank higher.'} No purchase necessary.</p>
      ${g.status === 'past' ? '' : cdHTML(g.status === 'upcoming' ? g.start_at : g.end_at, g.status === 'upcoming' ? 'Starts in' : 'Ends in')}
      ${g.status === 'active' ? `<div class="small muted" style="margin:0 0 6px">${S.me ? (r.me ? 'Play again to improve:' : 'Enter now - pick a game:') : 'Sign in to enter - pick a game:'}</div><div class="gpicks">${playBtns}</div>${!S.me ? `<p class="small muted center">Guests can browse but only signed-in players are entered.</p>` : ''}` : ''}
      ${r.me ? `<div class="ok-msg" style="margin:12px 0 0">You're entered! Current rank #${r.me.rank} with ${sc(r.me.score)}.</div>` : ''}
    </div>
    ${g.winners.length ? `<div class="card pad" style="margin-bottom:14px"><h2 style="margin-bottom:8px"><span class="crown">${icon('crown')}</span> Winners</h2>${g.winners.map(w => `<div class="mini-row" style="margin:6px 0">${avatar(w.username)}<b>${esc(w.username)}</b><span class="s small" style="color:var(--gold)">${w.method === 'top' ? 'Top score' : 'Random draw'}</span></div>`).join('')}</div>` : ''}
    <div class="card"><div class="panel-h"><h2>Entrants (${fmt(g.entrants)})</h2></div>
      ${r.leaderboard.length ? `<table class="lb"><tbody>${r.leaderboard.map(x => `<tr><td class="rk">${x.rank}</td><td>${whoHTML(x)}</td><td class="sc">${sc(x.score)}</td></tr>`).join('')}</tbody></table>` : `<div class="empty">No entrants yet.</div>`}</div>
    ${g.rules ? `<div class="card pad" style="margin-top:14px"><h2 style="margin-bottom:6px">Rules</h2><p class="small muted" style="white-space:pre-wrap;margin:0">${esc(g.rules)}</p></div>` : ''}
  </div>`);
  tickCountdowns();
});

// ---------------- profile ----------------
const TYPE_L = { banner: 'Banner', frame: 'Frame', title: 'Title', badge: 'Badge' };
route(/^\/profile$/, () => S.me ? go('/u/' + encodeURIComponent(S.me.username), true) : go('/signin?next=/profile', true));
route(/^\/u\/([^/]+)$/, async (m, url) => {
  const r = await api('/api/profile/' + m[1]);
  if (!r.ok) return shell('/profile', `<div class="empty">Player not found.</div>`);
  const p = r.profile; const cos = p.cos;
  let cz = null, czTab = url.searchParams.get('tab') || 'banner';
  if (r.is_me) { cz = await api('/api/cosmetics'); S.me.cos = cos; }
  const badgeGrid = p.achievements.length ? p.achievements.slice(0, 12).map(a => `<div class="b t-${a.tier}" title="${esc(a.desc)}"><span class="bi">${icon(a.icon)}</span>${esc(a.name)}</div>`).join('') : `<div class="empty" style="grid-column:1/-1">No achievements yet. ${r.is_me ? '<a href="/games">Play a game</a> to unlock your first.' : ''}</div>`;
  shell('/profile', `<div class="narrow">
    <div class="back-row" style="justify-content:space-between"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button>${r.is_me ? `<button class="iconbtn" id="gear" aria-label="Settings">${icon('settings')}</button>` : ''}</div>
    <div class="prof-banner bn-${esc(cos.banner)}" id="pbanner">
      <div class="prof-head">${framed(p.username, p.demo, cos, 'lg')}
        <div><div class="name">${esc(p.username)}${demoTag(p.demo)}${badgeIcon(cos.badge)}</div>
        <div class="ptitle big">${esc(cos.title)}</div>
        <div class="small pmeta">Level ${p.level} <span style="color:var(--cyan)">•</span> Member Since ${new Date(p.member_since).getFullYear()}</div>
        ${p.global_rank ? `<div class="small" style="margin-top:4px"><span class="pill">${icon('trophy')} Global #${p.global_rank}</span></div>` : ''}</div></div>
    </div>
    <div class="stat3"><div class="card"><b>${fmt(p.total_score)}</b><span>Total Score</span></div><div class="card"><b>${fmt(p.games_played)}</b><span>Games Played</span></div><div class="card"><b>${fmt(p.giveaways_won)}</b><span>Giveaways Won</span></div></div>
    <div class="section-h"><h2 style="text-transform:none;font-size:1rem">Achievements <span class="muted small">${p.achievements.length} / ${p.achievements_total}</span></h2><a href="/achievements${r.is_me ? '' : '?user=' + encodeURIComponent(p.username)}">View all</a></div>
    <div class="card badges2">${badgeGrid}</div>
    ${r.is_me && cz && cz.ok ? `<div class="section-h" id="customize"><h2 style="text-transform:none;font-size:1rem">${icon('palette')} Customize</h2><span class="small muted">${fmt(cz.owned_count)} rewards owned</span></div>
      <div class="card pad cz"><div class="tabs" id="czt">${['banner', 'frame', 'title', 'badge'].map(k => `<button data-k="${k}" class="${k === czTab ? 'on' : ''}">${TYPE_L[k]}s</button>`).join('')}</div><div id="czl"></div>
      <p class="small dim center" style="margin:10px 0 0">${icon('info')} Cosmetic only, no cash value. Unlock more from <a href="/achievements">achievements</a>.</p></div>` : ''}
    ${p.best_by_game.length ? `<div class="section-h"><h2 style="text-transform:none;font-size:1rem">Best Scores</h2></div><div class="card">${p.best_by_game.map(b => `<a class="act-row" href="/games/${b.game_id}" style="color:var(--text)"><img src="${gameById(b.game_id)?.art || ''}" alt="" class="gthumb"><span class="g">${esc(b.game_title)}</span><span class="s">${fmtScore(b.best, b.game_id)}</span><span class="t">${b.plays} run${b.plays === 1 ? '' : 's'}</span></a>`).join('')}</div>` : ''}
    <div class="section-h"><h2 style="text-transform:none;font-size:1rem">Recent Activity</h2><span class="small muted">${fmt(p.giveaways_entered)} giveaway${p.giveaways_entered === 1 ? '' : 's'} entered</span></div>
    <div class="card">${p.recent.length ? p.recent.map(x => `<div class="act-row"><img src="${gameById(x.game_id)?.art || ''}" alt="" class="gthumb"><span class="g">${esc(x.game_title)}</span><span class="s">${fmtScore(x.score, x.game_id)}</span><span class="t">${ago(x.created_at)}</span></div>`).join('') : `<div class="empty">No runs yet. ${r.is_me ? '<a href="/games">Pick a game</a>' : ''}</div>`}</div>
    ${r.is_me ? `<div id="settings" class="card pad hidden" style="margin-top:14px"><h2 style="margin-bottom:10px">Settings</h2>
      <form id="pwf"><div id="pwmsg"></div><div class="field"><input class="input" type="password" id="cur" placeholder="Current password" autocomplete="current-password"></div>
      <div class="field"><input class="input" type="password" id="np" placeholder="New password (min 8)" autocomplete="new-password"></div>
      <button class="btn ghost block" type="submit">Change password</button></form>
      <button class="btn danger block" data-act="signout" style="margin-top:10px">${icon('log-out')} Sign out</button></div>` : ''}
  </div>`);
  achToast(r.unlocked);
  if (!r.is_me) return;
  document.getElementById('gear').onclick = () => { const s = document.getElementById('settings'); s.classList.toggle('hidden'); s.scrollIntoView({ behavior: 'smooth' }); };
  document.getElementById('pwf').addEventListener('submit', async (e) => {
    e.preventDefault(); const out = document.getElementById('pwmsg');
    const x = await api('/api/auth/password', { method: 'POST', body: { current: document.getElementById('cur').value, password: document.getElementById('np').value } });
    out.innerHTML = x.ok ? `<div class="ok-msg">Password changed.</div>` : `<div class="err">${esc(x.error)}</div>`;
  });
  if (!cz || !cz.ok) return;
  const list = { banner: cz.banners, frame: cz.frames, title: cz.titles, badge: [{ id: '', name: 'No badge', owned: true }, ...cz.badges] };
  const eq = { ...cz.equipped };
  function drawCz() {
    const items = [...list[czTab]].sort((a, b) => (b.owned - a.owned));
    const card = (it) => {
      const on = (eq[czTab] || '') === it.id; const lock = !it.owned;
      const prev = czTab === 'banner' ? `<span class="czp bn-${esc(it.id)}"></span>` : czTab === 'frame' ? `<span class="czp czf">${framed(S.me.username, false, { frame: it.id })}</span>` : czTab === 'title' ? `<span class="czp czt"><span class="ptitle">${esc(it.name)}</span></span>` : `<span class="czp czb">${it.id ? `<span class="eqbadge t-${esc(it.tier)}">${icon(it.icon)}</span>` : icon('x')}</span>`;
      return `<button class="czi ${on ? 'on' : ''} ${lock ? 'locked' : ''}" data-id="${esc(it.id)}" data-type="${czTab}" ${lock ? 'disabled' : ''} title="${lock ? 'Unlock: ' + esc(it.from) : esc(it.name)}">${prev}<b>${esc(it.name)}</b><small>${on ? `${icon('check')} Equipped` : lock ? `${icon('lock')} ${esc(it.from)}` : 'Tap to equip'}</small></button>`;
    };
    document.getElementById('czl').innerHTML = `<div class="czg ${czTab}">${items.map(card).join('')}</div>`;
  }
  drawCz();
  document.getElementById('czt').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; czTab = b.dataset.k; document.querySelectorAll('#czt button').forEach(x => x.classList.toggle('on', x === b)); drawCz(); });
  document.getElementById('czl').addEventListener('click', async (e) => {
    const b = e.target.closest('.czi'); if (!b || b.disabled) return;
    const type = b.dataset.type, id = b.dataset.id;
    const x = await api('/api/me/cosmetics', { method: 'POST', body: { [type]: id } });
    if (!x.ok) return toast(x.error);
    eq[type] = id; S.me.cos = x.cos; drawCz();
    const pb = document.getElementById('pbanner'); pb.className = `prof-banner bn-${x.cos.banner}`;
    pb.querySelector('.frame').className = `frame fr-${x.cos.frame} f-lg`; pb.querySelector('.ptitle').textContent = x.cos.title;
    const nm = pb.querySelector('.name'); nm.querySelector('.eqbadge')?.remove(); if (x.cos.badge) nm.insertAdjacentHTML('beforeend', badgeIcon(x.cos.badge));
    toast(`${TYPE_L[type]} equipped`); achToast(x.unlocked);
  });
});

// ---------------- achievements ----------------
const TIER_ORDER = ['bronze', 'silver', 'gold', 'epic', 'legendary'];
route(/^\/achievements$/, async (m, url) => {
  const who = url.searchParams.get('user');
  shell('/achievements', `<div class="skeleton"></div>`);
  const r = await api('/api/achievements' + (who ? '?user=' + encodeURIComponent(who) : ''));
  if (!r.ok) return shell('/achievements', `<div class="empty">${esc(r.error)}</div>`);
  let cat = url.searchParams.get('cat') || 'all', filt = 'all';
  const A = r.achievements; const done = A.filter(a => a.unlocked).length;
  const rewardsTotal = A.reduce((s, a) => s + a.rewards.length, 0) + A.length;
  shell('/achievements', `<div class="narrow">
    <div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>${who && !r.is_me ? esc(r.user) + "'s " : ''}Achievements</h1></div>
    <div class="card pad ach-sum">
      <div class="ring" style="--p:${Math.round(done / A.length * 100)}"><b>${done}</b><span>/ ${A.length}</span></div>
      <div><b class="orb">${Math.round(done / A.length * 100)}% complete</b><div class="small muted">${A.length} achievements across ${r.cats.length} categories. Each unlock awards a badge plus a banner, avatar frame or title for your profile.</div>
      ${r.user && r.is_me !== false ? `<a class="btn sm" href="/u/${encodeURIComponent(r.user)}#customize" style="margin-top:8px">${icon('palette')} Equip rewards</a>` : !S.me ? `<a class="btn sm" href="/signup" style="margin-top:8px">Sign up to start unlocking</a>` : ''}</div>
    </div>
    <div class="nocash">${icon('shield')} <span><b>Cosmetic only, no cash value.</b> Rewards are profile decorations and can't be bought, sold, traded or exchanged for money or prizes.</span></div>
    <div class="chips" id="cats"><button class="chip on" data-c="all">All</button>${r.cats.map(([k, l]) => `<button class="chip" data-c="${k}">${esc(l)} <span class="cnt">${A.filter(a => a.cat === k && a.unlocked).length}/${A.filter(a => a.cat === k).length}</span></button>`).join('')}</div>
    <div class="tabs" id="flt" style="margin-top:2px"><button data-f="all" class="on">All</button><button data-f="unlocked">Unlocked</button><button data-f="locked">Locked</button></div>
    <div id="alist" class="alist"></div>
    <p class="small dim center">Rarity = % of all players who have unlocked it (${fmt(r.players)} players). Achievements are checked on the server from your saved runs - they can't be unlocked from the browser.</p>
  </div>`);
  function draw() {
    const list = A.filter(a => (cat === 'all' || a.cat === cat) && (filt === 'all' || (filt === 'unlocked') === a.unlocked));
    document.getElementById('alist').innerHTML = list.map(a => {
      const pct = a.progress == null ? (a.unlocked ? 100 : 0) : Math.min(100, Math.round(a.progress / a.target * 100));
      const g = a.game && gameById(a.game);
      return `<div class="ach ${a.unlocked ? 'on' : 'off'} t-${a.tier}" data-ach="${a.id}">
        <span class="ai">${icon(a.unlocked ? a.icon : a.hidden ? 'circle-help' : a.icon)}</span>
        <div class="ab"><div class="at"><b>${esc(a.name)}</b><span class="tier ${a.tier}">${a.tier}</span>${a.hidden ? `<span class="tier secret">secret</span>` : ''}</div>
          <div class="small muted">${esc(a.desc)}${g ? ` <a href="/games/${g.id}">${esc(g.title)}</a>` : ''}</div>
          ${a.progress != null && !a.unlocked ? `<div class="bar"><i style="width:${pct}%"></i></div><div class="small dim">${fmt(a.progress)} / ${fmt(a.target)}</div>` : ''}
          ${a.unlocked ? `<div class="small" style="color:var(--green)">${icon('circle-check')} Unlocked ${a.unlocked_at ? ago(a.unlocked_at) : ''}</div>` : ''}
          <div class="rw">${a.rewards.map(x => `<span class="rwi ${x.type}">${x.type === 'banner' ? `<i class="sw bn-${x.id}"></i>` : x.type === 'frame' ? `<i class="sw frame fr-${x.id}"><i></i></i>` : icon('award')}${TYPE_L[x.type]}: ${esc(x.name)}</span>`).join('')}<span class="rwi">${icon('badge-check')}Badge</span></div>
        </div>
        <div class="rar"><b>${a.rarity_pct}%</b><span>${a.rarity}</span></div></div>`;
    }).join('') || `<div class="empty card">Nothing here.</div>`;
  }
  draw();
  document.getElementById('cats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; document.querySelectorAll('#cats .chip').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  document.getElementById('flt').addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; filt = b.dataset.f; document.querySelectorAll('#flt button').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  achToast(r.unlocked);
});

// ---------------- host / booking ----------------
const PKG_IMG = { basic: '/assets/packages/basic.webp', premium: '/assets/packages/premium.webp', elite: '/assets/packages/elite.webp' };
let PK = null;
async function loadPackages() { if (!PK) { const r = await api('/api/packages'); if (r.ok) PK = r; } return PK; }
route(/^\/host$/, async (m, url) => {
  let tab = url.searchParams.get('tab') === 'custom' ? 'custom' : 'packages';
  const pk = await loadPackages(); if (!pk) return shell('/host', `<div class="empty">Could not load packages.</div>`);
  const T = pk.tiers;
  const draw = () => shell('/host', `<div class="narrow host">
    <div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Host a Giveaway</h1></div>
    <div class="banner"><h2>Get Your <span class="grad-text">Brand in the Game</span></h2><div style="color:#d9dcff">Put your prize in front of players who are already competing. Pick a package, send a free request, and we build and launch it with you.</div></div>
    <div class="tabs" id="ht" style="margin-top:14px"><button data-k="packages" class="${tab === 'packages' ? 'on' : ''}">Giveaway Packages</button><button data-k="custom" class="${tab === 'custom' ? 'on' : ''}">Custom Event</button></div>
    ${tab === 'packages' ? `
      <div class="pk3">${T.map(t => `<div class="card pk ${t.id}" data-tier="${t.id}">
        ${t.badge ? `<span class="pk-badge">${esc(t.badge)}</span>` : ''}
        <div class="pk-h"><img src="${PKG_IMG[t.id] || PKG_IMG.basic}" alt=""><div><h3>${esc(t.name)}</h3><div class="pk-tag">${esc(t.tagline)}</div></div></div>
        <div class="pk-price"><b>${esc(t.price)}</b><span>${esc(t.price_note)}</span></div>
        <div class="pk-who"><span>${icon('users')} Who it's for</span>${esc(t.who)}</div>
        <ul class="pk-f">${t.features.map(f => `<li>${icon(/^everything in/i.test(f) ? 'layers' : 'check')}<span>${esc(f)}</span></li>`).join('')}</ul>
        <a class="btn block ${t.id === 'premium' ? '' : 'ghost'}" href="/book?package=${t.id}" data-pick="${t.id}">Choose ${esc(t.name)}</a>
      </div>`).join('')}</div>
      <p class="small dim center" style="margin:10px 0 0">Prices are starting prices; the final quote is confirmed with you before anything goes live. No payment is taken online.</p>
      <div class="section-h"><h2>${icon('chart-column')} Compare packages</h2></div>
      <div class="card cmp-wrap"><table class="cmp"><thead><tr><th></th>${T.map(t => `<th class="${t.id}">${esc(t.name)}<small>${esc(t.price)}</small></th>`).join('')}</tr></thead>
        <tbody>${(pk.compare || []).map(row => `<tr><td>${esc(row[0])}</td>${[1, 2, 3].map(i => `<td>${cmpCell(row[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : `<div class="card pad"><h2 style="margin-bottom:8px">Custom Event</h2><p class="muted">Tournaments, stream events, sponsored leaderboards, brand activations, or a brand-new custom game - tell us what you have in mind and we'll put together a plan and quote.</p><a class="btn block" href="/book?package=custom">Request a Custom Event</a></div>`}
    <div class="section-h"><h2>How it works</h2></div>
    <div class="howto">${[['Pick a package', 'Choose Basic, Premium, Elite or a custom event.'], ['Send your request', 'Tell us your brand, prize, dates and goals. No payment needed now.'], ['We build & launch', 'We confirm the details and quote, set up your giveaway and games, and go live.'], ['Draw & deliver', 'Winners are drawn on the admin side; you get the entrant CSV (and the campaign report on Elite) and deliver the prize.']].map(([t, d], i) => `<div class="card"><span class="num">${i + 1}</span><div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join('')}</div>
    <div class="section-h" id="faq"><h2>${icon('circle-help')} Giveaway FAQ</h2></div>
    <div class="faq">${(pk.faq || []).map(([q, a], i) => `<details class="card" ${i === 0 ? 'open' : ''}><summary>${esc(q)}${icon('chevron-down')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
  </div>`);
  const draw2 = () => { draw(); document.getElementById('ht').onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; tab = b.dataset.k; draw2(); }; if (location.hash === '#faq') document.getElementById('faq')?.scrollIntoView(); };
  draw2();
});
function cmpCell(v) {
  const s = String(v || '').trim();
  if (!s || s === '-' || /^no$/i.test(s)) return `<span class="no">${icon('x')}</span>`;
  if (/^(yes|✓)$/i.test(s)) return `<span class="yes">${icon('check')}</span>`;
  return esc(s);
}
route(/^\/book$/, async (m, url) => {
  const pk = await loadPackages(); const T = pk ? pk.tiers : [];
  const B = { step: 1, package: url.searchParams.get('package') || 'basic', brand: '', event_type: '', contact_name: S.me ? S.me.username : '', contact: '', start_date: '', end_date: '', details: '' };
  if (B.package !== 'custom' && !T.some(t => t.id === B.package)) B.package = 'basic';
  const EV = ['Giveaway', 'Multi-game Giveaway', 'Brand Takeover', 'Tournament', 'Sponsored Leaderboard', 'Stream Event', 'Custom Game', 'Other'];
  const save = () => document.querySelectorAll('[data-b]').forEach(i => { B[i.dataset.b] = i.value.trim(); });
  const tierOf = () => T.find(t => t.id === B.package);
  const summary = () => { const t = tierOf(); return t ? `<div class="pk-sel ${t.id}" id="pksel"><img src="${PKG_IMG[t.id]}" alt=""><div><small>SELECTED PACKAGE</small><b>${esc(t.name)}</b><span>${esc(t.tagline)}</span></div><div class="pr"><b>${esc(t.price)}</b><span>${esc(t.price_note)}</span></div></div>` : `<div class="pk-sel custom" id="pksel"><div><small>SELECTED</small><b>Custom Event</b><span>Quote on request</span></div></div>`; };
  function draw(err = '') {
    const st = (n, l) => `<div class="st ${B.step >= n ? 'on' : ''}"><i>${n}</i>${l}</div>`;
    let body = '';
    if (B.step === 1) body = `
      <div class="field"><label class="lbl">Package</label><div class="tierpick" id="tp">${[...T.map(t => [t.id, t.name, t.price]), ['custom', 'Custom', 'Quote']].map(([k, l, p]) => `<button type="button" data-t="${k}" class="${B.package === k ? 'on' : ''} ${k}"><b>${esc(l)}</b><span>${esc(p)}</span></button>`).join('')}</div></div>
      <div class="field"><label class="lbl">Channel / Brand Name</label><input class="input" data-b="brand" value="${esc(B.brand)}" placeholder="Your channel or brand name" maxlength="120"></div>
      <div class="field"><label class="lbl">Event Type</label><select class="input" data-b="event_type"><option value="">Select an option</option>${EV.map(e => `<option ${B.event_type === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
      <div class="field"><label class="lbl">Your Name</label><input class="input" data-b="contact_name" value="${esc(B.contact_name)}" placeholder="Who should we talk to?" maxlength="120"></div>
      <div class="field"><label class="lbl">Email or Discord</label><input class="input" data-b="contact" value="${esc(B.contact)}" placeholder="you@brand.com or discord handle" maxlength="160"></div>`;
    else if (B.step === 2) body = `
      <label class="lbl" style="font-weight:600;font-size:.85rem">Preferred Dates</label>
      <div class="grid2" style="margin-top:6px"><div class="field"><label class="lbl small">Start Date</label><input class="input" type="date" data-b="start_date" value="${esc(B.start_date)}"></div><div class="field"><label class="lbl small">End Date</label><input class="input" type="date" data-b="end_date" value="${esc(B.end_date)}"></div></div>
      <div class="field"><label class="lbl">Prize, games &amp; details</label><textarea class="input" data-b="details" maxlength="4000" placeholder="Prize, which games you'd like, brand colors / logo link, rules (age, region) or any special requests...">${esc(B.details)}</textarea></div>`;
    else { const t = tierOf(); body = `<div class="card pad" style="background:rgba(5,8,26,.7)">${[['Package', t ? `${t.name} - ${t.price} ${t.price_note}` : 'Custom event - quote on request'], ['Brand', B.brand], ['Event type', B.event_type || '-'], ['Contact', `${B.contact_name} (${B.contact})`], ['Dates', `${B.start_date || 'flexible'} → ${B.end_date || 'flexible'}`], ['Details', B.details || '-']].map(([k, v]) => `<div class="rv-row" data-rv="${k.toLowerCase()}"><span class="muted">${k}</span><span>${esc(v)}</span></div>`).join('')}</div>
      <p class="small muted">No payment is taken. Our team reviews every request, confirms the quote and replies via your contact.</p>`; }
    shell('/book', `<div class="narrow"><div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Submit a Booking Request</h1></div>
      ${summary()}
      <div class="steps">${st(1, 'Details')}<span class="bar"></span>${st(2, 'Dates')}<span class="bar"></span>${st(3, 'Review')}</div>
      <div class="card pad">${err ? `<div class="err">${esc(err)}</div>` : ''}${body}
      <div style="display:flex;gap:10px;margin-top:6px">${B.step > 1 ? `<button class="btn ghost" id="prev" style="flex:1">Back</button>` : ''}<button class="btn" id="next" style="flex:2">${B.step < 3 ? 'Next Step' : 'Submit Request'}</button></div></div>
      <p class="small dim center"><a href="/host">Compare packages</a> • <a href="/host#faq">Giveaway FAQ</a></p></div>`);
    const tp = document.getElementById('tp'); if (tp) tp.onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; save(); B.package = b.dataset.t; draw(); };
    document.getElementById('next').onclick = async () => {
      save();
      if (B.step === 1) { if (!B.brand) return draw('Channel / brand name is required.'); if (!B.contact) return draw('Add an email or Discord handle so we can reply.'); }
      if (B.step === 2 && B.start_date && B.end_date && B.end_date < B.start_date) return draw('End date must be after the start date.');
      if (B.step < 3) { B.step++; return draw(); }
      const btn = document.getElementById('next'); btn.disabled = true;
      const r = await api('/api/bookings', { method: 'POST', body: B });
      if (!r.ok) { btn.disabled = false; return draw(r.error); }
      shell('/book', `<div class="narrow"><div class="card pad center glow-purple" style="margin-top:30px"><div style="font-size:3rem;color:var(--green)">${icon('calendar-check')}</div><h1>Request Sent!</h1><p class="muted">Booking reference <b>#${r.id}</b> for <b id="booked-pkg">${esc(r.package_snapshot)}</b>. The Trap Tech team will review it and reach out at <b>${esc(B.contact)}</b>.</p><a class="btn block" href="/">Back to Home</a></div></div>`);
    };
    const prev = document.getElementById('prev'); if (prev) prev.onclick = () => { save(); B.step--; draw(); };
  }
  draw();
});

// ---------------- community ----------------
route(/^\/community$/, async () => {
  let tab = 'all';
  shell('/community', `<div class="narrow"><h1>Community</h1><div class="tabs" id="ct"><button data-k="all" class="on">All</button><button data-k="announcements">Announcements</button><button data-k="winners">Winners</button></div><div id="feed"><div class="skeleton"></div></div></div>`);
  async function load() {
    const r = await api('/api/community?tab=' + tab); const el = document.getElementById('feed'); if (!el) return;
    el.innerHTML = r.items.length ? r.items.map(it => {
      const u = it.user;
      const head = it.kind === 'announcement' ? `<img src="/assets/brand/logo-mark.webp" alt="" style="width:38px;height:38px;object-fit:contain"><div><b>TrapTech Admin${demoTag(it.is_demo)}</b><span>${ago(it.created_at)}</span></div>`
        : u ? `${framed(u.username, u.demo, u.cos)}<div>${pname(u.username, u.demo, u.cos)}<span>${it.kind === 'winner' ? 'Giveaway Winner' : 'Hub Activity'} • ${ago(it.created_at)}</span></div>`
        : `<span class="av" style="background:linear-gradient(135deg,#7c3aed,#22d3ee)">${icon('zap')}</span><div><b>Hub Activity${demoTag(it.is_demo)}</b><span>${ago(it.created_at)}</span></div>`;
      return `<div class="card post ${it.kind} ${u ? 'has-bn' : ''}">${u ? `<span class="post-bn bn-${esc(u.cos.banner)}"></span>` : ''}
      <div class="ph">${head}</div>
      <p>${it.kind === 'winner' ? `<span class="crown">${icon('crown')}</span> ` : ''}<b>${esc(it.title)}</b>${it.body ? `<br>${esc(it.body)}` : ''}</p>
      <div class="post-f"><button class="hype ${it.mine ? 'on' : ''}" data-key="${esc(it.key)}">${icon('flame')} <span>${it.hype || ''}</span> Hype</button></div></div>`;
    }).join('') : `<div class="empty card">Nothing here yet.</div>`;
  }
  document.getElementById('ct').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; tab = b.dataset.k; document.querySelectorAll('#ct button').forEach(x => x.classList.toggle('on', x === b)); load(); });
  document.getElementById('feed').addEventListener('click', async (e) => {
    const b = e.target.closest('.hype'); if (!b) return;
    if (!S.me) return toast('Sign in to hype posts');
    const r = await api('/api/community/react', { method: 'POST', body: { key: b.dataset.key } });
    if (!r.ok) return toast(r.error);
    b.classList.toggle('on', r.mine); b.querySelector('span').textContent = r.hype || ''; achToast(r.unlocked);
  });
  load();
});

// ---------------- boot ----------------
(async function boot() {
  const [me, games] = await Promise.all([api('/api/me'), api('/api/games')]);
  S.me = me.user; S.games = games.games || [];
  render();
})();

import { icon } from './icons.js';
import { ls, ss, copyText } from './store.js';

// ---------------- core ----------------
const $app = document.getElementById('app');
const S = { me: null, games: [], serverOffset: 0, guest: ls.getItem('gh_guest') === '1', game: null };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const nowS = () => Date.now() + S.serverOffset;
// In-app browsers can block cookies. After sign-in we check whether the cookie stuck; if not, the session token
// is kept in memory (and in storage when available) and sent as an X-Session header instead.
let TOKEN = ls.getItem('gh_tok') || null;
async function api(path, opts = {}) {
  const headers = { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(TOKEN ? { 'X-Session': TOKEN } : {}) };
  const res = await fetch(path, { credentials: 'same-origin', ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data; try { data = await res.json(); } catch { data = { ok: false, error: `HTTP ${res.status}` }; }
  if (data && data.now) S.serverOffset = data.now - Date.now();
  data.status = res.status; return data;
}
function ago(ms) {
  const s = Math.max(0, (nowS() - ms) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m ago`; if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`; return new Date(ms).toLocaleDateString();
}
function toast(msg, ms = 2600) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
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
    <button class="iconbtn menu-btn" data-act="menu" aria-label="Open menu">${icon('menu')}</button>
    <a href="/" aria-label="The Gaming Hub home"><img class="logo" src="/assets/brand/hub-logo.svg" alt="The Gaming Hub by Trap Tech Solutions" width="150" height="35"></a>
    <nav class="desk-nav" aria-label="Main">${NAV.map(([p, i, l]) => `<a href="${p}" class="${act === p ? 'on' : ''}" ${act === p ? 'aria-current="page"' : ''}>${icon(i)}${l}</a>`).join('')}<a href="/tournaments" class="${path.startsWith('/tournaments') ? 'on' : ''}">${icon('swords')}Tournaments</a><a href="/host" class="${path.startsWith('/host') || path.startsWith('/book') ? 'on' : ''}">${icon('briefcase')}Host</a></nav>
    <span class="spacer"></span>
    ${S.me && S.me.streak && S.me.streak.current ? `<a class="streak-chip" href="/quests" aria-label="${S.me.streak.current}-day streak - daily quests">${icon('flame')}<b>${S.me.streak.current}</b></a>` : ''}
    <a class="iconbtn" href="/search" aria-label="Search">${icon('search')}</a>
    <a class="iconbtn" href="${S.me ? '/notifications' : '/giveaways'}" aria-label="${S.me ? 'Notifications' : 'Live giveaways'}">${icon('bell')}<span class="badge-dot hidden" id="bell-n"></span></a>
    <a class="iconbtn" href="${S.me ? '/u/' + encodeURIComponent(S.me.username) : '/signin'}" aria-label="${S.me ? 'My profile' : 'Sign in'}">${S.me ? framed(S.me.username, false, S.me.cos, 'xs') : icon('circle-user')}</a>
    <button class="iconbtn more-btn" data-act="menu" aria-label="More options">${icon('ellipsis-vertical')}</button>
  </header>`;
}
const FOOT_LINKS = [['/about', 'About Trap Tech'], ['/host', 'Host a giveaway'], ['/rules', 'Official Rules'], ['/terms', 'Terms'], ['/privacy', 'Privacy'], ['/responsible-play', 'Responsible play'], ['/settings', 'Settings']];
function footer() {
  return `<footer class="site-foot" role="contentinfo">
    <div class="sf-in">
      <a class="sf-brand" href="/about" aria-label="About Trap Tech Solutions"><img src="/assets/brand/traptech-wordmark.svg" alt="Trap Tech Solutions" width="200" height="22"><span>Built by Trap Tech Solutions</span></a>
      <nav class="sf-links" aria-label="Footer">${FOOT_LINKS.map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</nav>
      <p class="sf-note">21+ only. No purchase necessary to enter or win. Points, XP and cosmetics have no cash value. © ${new Date().getFullYear()} Trap Tech Solutions. The Gaming Hub is powered by Trap Tech.</p>
    </div></footer>`;
}
function bottomnav(path) {
  const act = navActive(path);
  return `<nav class="bottomnav" aria-label="Main">${NAV.map(([p, i, l]) => `<a href="${p}" class="${act === p ? 'on' : ''}" ${act === p ? 'aria-current="page"' : ''}>${icon(i)}<span>${l}</span></a>`).join('')}</nav>`;
}
const TITLES = { '/': 'Home', '/games': 'Games', '/leaderboard': 'Leaderboards', '/giveaways': 'Giveaways', '/community': 'Community', '/achievements': 'Achievements & Rewards', '/host': 'Sponsor the Hub',
  '/book': 'Book a Branded Game', '/quests': 'Daily Quests', '/season': 'Season Pass', '/tournaments': 'Tournaments', '/notifications': 'Notifications', '/search': 'Search', '/invite': 'Invite Friends',
  '/about': 'About Trap Tech Solutions', '/terms': 'Terms of Service', '/privacy': 'Privacy Policy', '/rules': 'Official Giveaway Rules', '/responsible-play': 'Responsible Play', '/settings': 'Settings' };
function setTitle(t) { document.title = t ? `${t} | The Gaming Hub by Trap Tech Solutions` : 'The Gaming Hub by Trap Tech Solutions'; }
function shell(path, inner, { cls = '', title } = {}) {
  $app.innerHTML = `${topbar(path)}<main class="page ${cls}" id="main" tabindex="-1">${inner}</main>${footer()}${bottomnav(path)}`;
  setTitle(title || TITLES[path] || null);
  updateBell();
}
// loading skeleton shown instantly while a page's data loads (replaced by the real page)
function skeleton(kind = 'list') {
  const line = (w) => `<div class="sk sk-line" style="width:${w}%"></div>`;
  if (kind === 'grid') return `<div class="sk-wrap" aria-busy="true" aria-label="Loading">${line(40)}<div class="sk-grid">${'<div class="sk sk-card"></div>'.repeat(6)}</div></div>`;
  return `<div class="sk-wrap" aria-busy="true" aria-label="Loading">${line(45)}<div class="sk sk-hero"></div>${line(90)}${line(70)}${'<div class="sk sk-row"></div>'.repeat(4)}</div>`;
}
function emptyState(ic, title, body = '', cta = '') { return `<div class="empty-state"><span class="es-ic">${icon(ic)}</span><b>${title}</b>${body ? `<p>${body}</p>` : ''}${cta}</div>`; }
async function updateBell() {
  const el = document.getElementById('bell-n'); if (!el) return;
  let n = 0;
  if (S.me) n = S.me.unread || 0;
  else { if (S.liveCount === undefined) { const r = await api('/api/giveaways?status=active'); S.liveCount = r.ok ? r.giveaways.length : 0; } n = S.liveCount; }
  const el2 = document.getElementById('bell-n'); if (!el2) return;
  el2.textContent = n > 9 ? '9+' : n; el2.classList.toggle('hidden', !n);
}
async function refreshMe() { const r = await api('/api/me'); if (r.ok) S.me = r.user; updateBell(); return S.me; }
function openMenu() {
  const d = document.createElement('div'); d.className = 'drawer';
  d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', 'Menu');
  const lv = S.me && S.me.level;
  d.innerHTML = `<div class="in">
    <img src="/assets/brand/hub-logo.svg" alt="The Gaming Hub" style="width:180px;margin:0 0 12px">
    ${S.me ? `<a class="mini-row drawer-me" href="/u/${encodeURIComponent(S.me.username)}">${framed(S.me.username, false, S.me.cos)}<span style="flex:1;min-width:0">${pname(S.me.username, false, S.me.cos)}${lv ? `<span class="xpbar sm" aria-label="Level ${lv.level}"><i style="width:${Math.round(lv.into / lv.need * 100)}%"></i></span><span class="tiny muted">Level ${lv.level} • ${fmt(lv.into)}/${fmt(lv.need)} XP</span>` : ''}</span></a>` : ''}
    <div class="dr-sec">Play</div>
    ${NAV.map(([p, i, l]) => `<a href="${p}">${icon(i)}${l}</a>`).join('')}
    <a href="/tournaments">${icon('swords')}Tournaments</a>
    <div class="dr-sec">Progress</div>
    <a href="/quests">${icon('scroll-text')}Daily Quests${S.me && S.me.streak && S.me.streak.current ? `<span class="pill-mini">${icon('flame')}${S.me.streak.current}</span>` : ''}</a>
    <a href="/season">${icon('calendar-range')}Season Pass</a>
    <a href="/achievements">${icon('medal')}Achievements &amp; Rewards</a>
    <a href="/invite">${icon('gift')}Invite Friends</a>
    <div class="dr-sec">More</div>
    <a href="/host">${icon('briefcase')}Host a Game / Giveaway</a>
    ${S.me ? `<a href="/notifications">${icon('bell')}Notifications${S.me.unread ? `<span class="pill-mini">${S.me.unread}</span>` : ''}</a><a href="/settings">${icon('settings')}Settings</a><button class="link" data-act="signout">${icon('log-out')}Sign out</button>`
           : `<a href="/signin">${icon('log-in')}Sign in</a><a href="/signup">${icon('user-plus')}Create account</a><a href="/settings">${icon('settings')}Settings</a>`}
    <a href="/about">${icon('building-2')}About Trap Tech</a>
    <a href="/admin">${icon('layout-dashboard')}Admin</a>
    <div class="dr-legal"><a href="/terms">Terms</a> • <a href="/privacy">Privacy</a> • <a href="/rules">Rules</a> • <a href="/responsible-play">Responsible play</a></div>
    <a class="dr-tt" href="/about"><span>Built by</span><img src="/assets/brand/traptech-wordmark.svg" alt="Trap Tech Solutions" width="150" height="16"></a>
  </div><div style="flex:1" data-close></div>`;
  d.addEventListener('click', (e) => { if (e.target.closest('a, button') || e.target.hasAttribute('data-close')) setTimeout(() => d.remove(), 0); });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.remove(); });
  document.body.appendChild(d); const f = d.querySelector('a, button'); if (f) f.focus({ preventScroll: true });
}
async function adoptSession(r) {
  if (!r || !r.session) return;
  const probe = await fetch('/api/me', { credentials: 'same-origin' }).then(x => x.json()).catch(() => ({}));
  if (!(probe && probe.user)) { TOKEN = r.session; ls.setItem('gh_tok', r.session); } else if (TOKEN) { TOKEN = null; ls.removeItem('gh_tok'); }
}
async function signout() { await api('/api/auth/signout', { method: 'POST' }); TOKEN = null; ls.removeItem('gh_tok'); S.me = null; toast('Signed out'); go('/signin'); }

// ---------------- router ----------------
const routes = [];
const route = (re, fn) => routes.push([re, fn]);
function go(path, replace = false) { if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path); render(); }
window.__go = go; // used by the in-app browser test to navigate without a reload (fully locked webviews keep state only in memory)
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
const NO_SKEL = /^\/(play|signin|signup|welcome|forgot)\b/;
const AGE_FREE = /^\/(terms|privacy|rules|responsible-play|about)$/;
let navCount = 0;
async function render() {
  if (S.game) { S.game.destroy(); S.game = null; }
  if (S.poll) { clearInterval(S.poll); S.poll = null; }
  document.body.style.overflow = '';
  document.querySelectorAll('.drawer, .sheet').forEach(x => x.remove());
  const url = new URL(location.href); const path = url.pathname.replace(/\/+$/, '') || '/';
  if (url.searchParams.get('ref')) ls.setItem('gh_ref', url.searchParams.get('ref').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12));
  if (!ageOk() && !AGE_FREE.test(path)) return ageGate();
  const first = navCount++ === 0;
  for (const [re, fn] of routes) { const m = path.match(re); if (m) {
    window.scrollTo(0, 0);
    if (!NO_SKEL.test(path) && !first) shell(path, skeleton(/^\/(games|achievements|tournaments)$/.test(path) ? 'grid' : 'list'));
    try { await fn(m, url); } catch (err) { console.error(err); shell(path, emptyState('triangle-alert', 'Something went wrong', 'Please try again in a moment.', '<a class="btn sm" href="/">Go home</a>')); }
    if (!first) { const mm = document.getElementById('main'); if (mm) mm.focus({ preventScroll: true }); }
    return; } }
  shell(path, emptyState('circle-help', 'Page not found', "We couldn't find that page.", '<a class="btn sm" href="/">Go home</a>'), { title: 'Page not found' });
}
// ---------------- 21+ age gate (neutral date-of-birth screen; cannabis-brand content) ----------------
function ageOk() { const v = +ls.getItem('gh_age_ok') || 0; return v && Date.now() - v < 30 * 864e5; }
function ageFrom(y, m, d) { const t = new Date(); return t.getFullYear() - y - ((t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) ? 1 : 0); }
function dobFields(prefix, val = '') {
  const [y, m, d] = (val || '').split('-');
  return `<fieldset class="dob" aria-describedby="${prefix}-hint"><legend class="sr-only">Date of birth</legend>
    <label><span>Month</span><input class="input" id="${prefix}-m" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="MM" autocomplete="bday-month" value="${esc(m || '')}"></label>
    <label><span>Day</span><input class="input" id="${prefix}-d" inputmode="numeric" pattern="[0-9]*" maxlength="2" placeholder="DD" autocomplete="bday-day" value="${esc(d || '')}"></label>
    <label class="yy"><span>Year</span><input class="input" id="${prefix}-y" inputmode="numeric" pattern="[0-9]*" maxlength="4" placeholder="YYYY" autocomplete="bday-year" value="${esc(y || '')}"></label></fieldset>`;
}
function readDob(root, prefix) {
  const m = +root.querySelector(`#${prefix}-m`).value, d = +root.querySelector(`#${prefix}-d`).value, y = +root.querySelector(`#${prefix}-y`).value;
  const dt = new Date(y, m - 1, d);
  if (!y || !m || !d || y < 1900 || dt.getMonth() !== m - 1 || dt > new Date()) return null;
  return { iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, age: ageFrom(y, m, d) };
}
function ageGate() {
  setTitle('Age check');
  const blocked = ss.getItem('gh_age_block') === '1';
  $app.innerHTML = `<div class="gate" role="dialog" aria-labelledby="gate-h">
    <img class="logo-stack" src="/assets/brand/hub-stacked.svg" alt="The Gaming Hub by Trap Tech Solutions" width="220" height="144">
    ${blocked ? `<div class="card pad gate-card"><h1 id="gate-h">Sorry</h1><p class="muted">The Gaming Hub features cannabis-brand sponsors and is only available to adults 21 and older.</p><p class="small"><a href="/responsible-play">Responsible play</a> • <a href="/about">About Trap Tech</a></p></div>`
    : `<form class="card pad gate-card" id="gate" novalidate><h1 id="gate-h">Welcome</h1><p class="muted">Please enter your date of birth to continue.</p>
      ${dobFields('gate')}<div class="hint" id="gate-hint">You must be 21 or older. We don't store this unless you create an account.</div><div id="gmsg"></div>
      <button class="btn block" type="submit">Enter</button>
      <p class="tiny muted" style="margin:12px 0 0">By entering you agree to our <a href="/terms">Terms</a> and <a href="/privacy">Privacy Policy</a>. Free to play. No purchase necessary.</p></form>`}
    <a class="gate-tt" href="/about"><span>Built by</span><img src="/assets/brand/traptech-wordmark.svg" alt="Trap Tech Solutions" width="170" height="19"></a>
  </div>`;
  const f = $app.querySelector('#gate'); if (!f) return;
  $app.querySelector('#gate-m').focus();
  // auto-advance between the date parts
  [['gate-m', 2, 'gate-d'], ['gate-d', 2, 'gate-y']].forEach(([a, n, b]) => $app.querySelector('#' + a).addEventListener('input', (e) => { if (e.target.value.length >= n) $app.querySelector('#' + b).focus(); }));
  f.addEventListener('submit', (e) => {
    e.preventDefault(); const r = readDob($app, 'gate');
    if (!r) { $app.querySelector('#gmsg').innerHTML = '<div class="err" role="alert">Please enter a valid date of birth.</div>'; return; }
    if (r.age < 21) { ss.setItem('gh_age_block', '1'); return ageGate(); }
    ls.setItem('gh_age_ok', String(Date.now())); ss.setItem('gh_dob', r.iso); render();
  });
}
const gameById = (id) => S.games.find(g => g.id === id);

// ---------------- splash & auth ----------------
route(/^\/welcome$/, () => splash());
function splash() {
  $app.innerHTML = `<div class="splash">
    <div>
      <img class="logo-stack" src="/assets/brand/hub-stacked.svg" alt="The Gaming Hub by Trap Tech Solutions" width="330" height="215">
      <div class="tagline">PLAY <b>•</b> COMPETE <b>•</b> WIN <b>•</b> CONNECT</div>
      <p class="splash-sub">Free arcade games, tournaments and brand giveaways.<br>No purchase necessary. 21+.</p>
    </div>
    <div class="cta">
      <a class="btn block" href="/signup">Get Started</a>
      <p class="small muted" style="margin:16px 0 4px">Already have an account?</p>
      <a href="/signin" class="orb" style="font-weight:700;font-size:.85rem;background:var(--grad-v);-webkit-background-clip:text;background-clip:text;color:transparent">SIGN IN</a>
      <p style="margin:10px 0 0"><a href="/" data-guest class="small muted">Just browsing? Continue as Guest</a></p>
      <a class="tt-sig" href="/about"><span>Built by</span><img class="traptech" src="/assets/brand/traptech-stacked.svg" alt="Trap Tech Solutions" style="height:40px"></a>
    </div></div>`;
  setTitle('Welcome');
  ls.setItem('gh_seen_splash', '1');
  $app.querySelector('[data-guest]').addEventListener('click', () => { S.guest = true; ls.setItem('gh_guest', '1'); });
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
  const remembered = ls.getItem('gh_username') || '';
  $app.innerHTML = `<div class="auth">
    <div class="back-row"><button class="iconbtn" data-act="back" aria-label="Back">${icon('chevron-left')}</button></div>
    <img class="logo-h" src="/assets/brand/hub-logo.svg" alt="The Gaming Hub" width="220" height="52">
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
    <a class="tt-sig" href="/about"><span>Powered by Trap Tech</span><img src="/assets/brand/traptech-stacked.svg" alt="Trap Tech Solutions" style="height:38px"></a>
  </div>`;
  setTitle('Sign in');
  wireEyes($app);
  $app.querySelector('#guest').addEventListener('click', () => { S.guest = true; ls.setItem('gh_guest', '1'); });
  $app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault(); const u = $app.querySelector('#u').value.trim(), p = $app.querySelector('#p').value;
    const msg = $app.querySelector('#msg'); if (!u || !p) { msg.innerHTML = `<div class="err">Enter your username and password.</div>`; return; }
    const r = await api('/api/auth/signin', { method: 'POST', body: { username: u, password: p } }); await adoptSession(r);
    if (!r.ok) { msg.innerHTML = `<div class="err">${esc(r.error)}</div>`; return; }
    if ($app.querySelector('#rem').checked) ls.setItem('gh_username', r.user.username); else ls.removeItem('gh_username');
    S.guest = false; ls.removeItem('gh_guest'); await refreshMe(); toast(`Welcome back, ${r.user.username}!`);
    go(url.searchParams.get('next') || '/', true);
  });
});
route(/^\/signup$/, (m, url) => {
  if (S.me) return go('/', true);
  $app.innerHTML = `<div class="auth">
    <div class="back-row"><button class="iconbtn" data-act="back" aria-label="Back">${icon('chevron-left')}</button></div>
    <img class="logo-h" src="/assets/brand/hub-logo.svg" alt="The Gaming Hub" width="220" height="52">
    <div class="card glow-purple" style="margin-top:14px">
      <h1 style="text-align:left">Create Your Account</h1><p class="sub" style="text-align:left">Choose a unique Potato username and set your password.</p>
      <form id="f" novalidate>
        <div id="msg"></div>
        <div class="field ic">${icon('user')}<input class="input" id="u" placeholder="Choose your Potato username" autocomplete="username" maxlength="20" required></div>
        <div class="hint">Must be unique (no spaces). 3-20 letters, numbers, _ . -</div>
        ${pwField('p', 'Password', 'new-password')}
        <div class="hint">Minimum 8 characters</div>
        ${pwField('p2', 'Confirm Password', 'new-password')}
        <div class="lbl">Date of birth <span class="muted tiny">(21+ only)</span></div>
        ${dobFields('dob', ss.getItem('gh_dob') || '')}
        <div class="hint" id="dob-hint">The Gaming Hub features cannabis-brand sponsors, so every player must be 21+. Prize winners are verified.</div>
        <div class="field ic">${icon('gift')}<input class="input" id="ref" placeholder="Invite code (optional)" maxlength="12" autocapitalize="characters" value="${esc(url.searchParams.get('ref') || ls.getItem('gh_ref') || '')}"></div>
        <label class="check"><input type="checkbox" id="agree"> <span>I'm 21+ and agree to the <a href="/terms">Terms of Service</a>, <a href="/privacy">Privacy Policy</a> &amp; <a href="/rules">Official Rules</a></span></label>
        <button class="btn block" type="submit">Create Account</button>
      </form>
      <p class="center small muted" style="margin:16px 0 0">Already have an account? <a href="/signin">Sign In</a></p>
    </div>
    <a class="tt-sig" href="/about"><span>Powered by Trap Tech</span><img src="/assets/brand/traptech-stacked.svg" alt="Trap Tech Solutions" style="height:38px"></a>
  </div>`;
  setTitle('Create account');
  wireEyes($app);
  $app.querySelector('#f').addEventListener('submit', async (e) => {
    e.preventDefault(); const msg = $app.querySelector('#msg');
    const u = $app.querySelector('#u').value.trim(), p = $app.querySelector('#p').value, p2 = $app.querySelector('#p2').value, agree = $app.querySelector('#agree').checked;
    const fail = (t) => { msg.innerHTML = `<div class="err">${esc(t)}</div>`; };
    if (!/^[A-Za-z0-9_.-]{3,20}$/.test(u)) return fail('Username must be 3-20 characters: letters, numbers, _ . - (no spaces).');
    if (p.length < 8) return fail('Password must be at least 8 characters.');
    if (p !== p2) return fail('Passwords do not match.');
    const dob = readDob($app, 'dob'); if (!dob) return fail('Please enter your date of birth.');
    if (dob.age < 21) return fail('You must be 21 or older to join The Gaming Hub.');
    if (!agree) return fail('Please agree to the Terms of Service and Privacy Policy.');
    const ref = $app.querySelector('#ref').value.trim();
    const r = await api('/api/auth/signup', { method: 'POST', body: { username: u, password: p, agree, dob: dob.iso, ref: ref || undefined } }); await adoptSession(r);
    if (!r.ok) return fail(r.error);
    ls.removeItem('gh_ref');
    S.guest = false; ls.removeItem('gh_guest'); ls.setItem('gh_username', r.user.username); await refreshMe();
    toast(`Account created. Welcome, ${r.user.username}!`); achToast(r.unlocked); go(url.searchParams.get('next') || '/games/jetpack-dash', true);
  });
});
route(/^\/forgot$/, () => shell('/forgot', `<div class="narrow"><div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Forgot password</h1></div>
  <div class="card pad"><p>Password resets are handled by the hub admins. Message Trap Tech Solutions with your Potato username and an admin will give you a temporary password, which you can change from your profile settings.</p>
  <a class="btn block" href="/signin">Back to sign in</a></div></div>`));



// ---------------- home ----------------
route(/^\/(home)?$/, async () => {
  if (!S.me && !S.guest && !ls.getItem('gh_seen_splash')) return splash();
  const [gw, lb, tn, q] = await Promise.all([api('/api/giveaways?status=active'), api('/api/leaderboard?game=global&limit=5'), api('/api/tournaments'), S.me ? api('/api/quests') : Promise.resolve(null)]);
  const live = gw.ok ? gw.giveaways : [];
  const takeover = live.find(x => x.tier === 'elite' && x.featured);
  const featuredGw = live.filter(x => x.featured && x !== takeover);
  const g0 = live.find(x => x !== takeover) || null;
  const featured = S.games.slice(0, 4);
  const tours = (tn.ok ? tn.tournaments : []).filter(t => t.status !== 'ended').slice(0, 3);
  shell('/', `
    ${takeover ? heroTakeover(takeover) : `<div class="hero"><img src="/assets/brand/hero-banner.webp" alt="The Gaming Hub - Play, Compete, Win, Connect" width="1336" height="400"></div>`}
    ${S.me && q && q.ok ? dailyPanel(q) : !S.me ? `<div class="card pad cta-card"><span class="es-ic">${icon('sparkles')}</span><div style="flex:1"><b>Play free. Win real prizes.</b><div class="small muted">Create a free account so your scores count for giveaways, tournaments and daily quests.</div></div><a class="btn sm" href="/signup">Sign up</a></div>` : ''}
    ${featuredGw.length ? `<div class="section-h"><h2>${icon('sparkles')} Featured Giveaways</h2><a href="/giveaways">View All</a></div><div class="feat-gw">${featuredGw.map(featCard).join('')}</div>` : ''}
    <div class="section-h"><h2>Featured Games</h2><a href="/games">View All</a></div>
    <div class="hscroll">${featured.map(g => gameCard(g, true)).join('')}</div>
    ${tours.length ? `<div class="section-h"><h2>${icon('swords')} Tournaments</h2><a href="/tournaments">View All</a></div><div class="t-strip">${tours.map(tCard).join('')}</div>` : ''}
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
            <div class="small muted center" style="margin-top:8px">${fmt(g0.entrants)} entrant${g0.entrants === 1 ? '' : 's'} • play ${esc(g0.game_title)} to enter • no purchase necessary</div>
          </div>` : emptyState('gift', 'No live giveaways right now', 'New brand giveaways drop every week.', '<a class="btn sm ghost" href="/giveaways?tab=upcoming">See upcoming</a>')}
      </div>
      <div class="card">
        <div class="panel-h"><h2><span class="crown">${icon('crown')}</span>Global Leaderboard</h2><a class="small" href="/leaderboard">View All</a></div>
        ${(lb.rows || []).length ? lb.rows.map(r => `<div class="mini-row"><span class="n">${r.rank}</span>${whoHTML(r)}<span class="s">${fmt(r.score)}</span></div>`).join('')
          : emptyState('trophy', 'No scores yet', 'Be the first on the board!', '<a class="btn sm" href="/games">Play now</a>')}
        <div style="height:10px"></div>
      </div>
    </div>
    <div class="promo-grid">
      <a class="card pad ach-promo" href="/season"><span class="ai">${icon('calendar-range')}</span><div><b>Season Pass - free</b><div class="small muted">20 tiers of cosmetic rewards. Earn XP from runs, quests and check-ins.</div></div>${icon('chevron-right')}</a>
      <a class="card pad ach-promo" href="/achievements"><span class="ai">${icon('medal')}</span><div><b>Achievements &amp; Rewards</b><div class="small muted">100+ achievements unlock banners, frames and titles. Cosmetic only, no cash value.</div></div>${icon('chevron-right')}</a>
      <a class="card pad ach-promo" href="/invite"><span class="ai">${icon('gift')}</span><div><b>Invite friends</b><div class="small muted">Share your code - earn exclusive Recruiter cosmetics when friends play.</div></div>${icon('chevron-right')}</a>
    </div>
    <div class="section-h"><h2>Host a Game</h2><a href="/host">Learn more</a></div>
    <a class="banner" href="/host" style="display:block;color:var(--text)"><h2>Get Your Brand in the Game</h2><div class="small" style="color:#d9dcff">Trap Tech Solutions builds your branded giveaway or custom game - from a simple prize drop to a full 30-day takeover.</div></a>
    <div class="footer-note"><img src="/assets/brand/traptech-wordmark.svg" alt="Trap Tech Solutions">Powering the next generation of online gaming</div>`);
  tickCountdowns(); wireDaily();
  if (S.me && q && q.ok && !q.streak.checked_today) doCheckin();
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
  const fav = () => JSON.parse(ls.getItem('gh_favs') || '[]');
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
  paint(); favBtn.addEventListener('click', () => { const f = fav(); const i = f.indexOf(g.id); i >= 0 ? f.splice(i, 1) : f.push(g.id); ls.setItem('gh_favs', JSON.stringify(f)); paint(); toast(i >= 0 ? 'Removed from favorites' : 'Added to favorites'); });
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
      <div class="boot-ov" id="boot" role="status" aria-live="polite"><img src="${esc(g.art)}" alt="" class="boot-art"><div class="boot-t">${esc(g.title)}</div><div class="boot-tt">${icon('zap')} A Trap Tech game</div><div class="boot-bar"><i></i></div></div>
    </div></div>`;
  setTitle(`Play ${g.title}`);
  const bootAt = Date.now();
  const mod = await import('./' + g.module); const Cls = mod[g.cls];
  const bestKey = g.id === 'jetpack-dash' ? 'jd_best' : 'gh_best_' + g.id;
  let best = +ls.getItem(bestKey) || 0;
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
  if (g.id === 'jetpack-dash') { const rot = document.getElementById('rot'); let shown = 0; const checkRot = () => { if (!document.body.contains(rot)) return removeEventListener('resize', checkRot); const p = innerHeight > innerWidth && innerWidth < 700 && shown < 1; rot.classList.toggle('hidden', !p); if (p) { shown++; setTimeout(() => rot.classList.add('hidden'), 5000); } }; checkRot(); addEventListener('resize', checkRot); }
  function showPause() {
    ov.innerHTML = `<div class="card over-card"><h2>Paused</h2><div class="btns"><button class="btn block" id="res">${icon('play')} Resume</button><button class="btn ghost block" id="endrun">${icon('flag')} End run &amp; save score</button><button class="btn ghost block" id="quit">Quit without saving</button></div></div>`;
    ov.classList.remove('hidden');
    ov.querySelector('#res').onclick = () => game.pause(false); ov.querySelector('#quit').onclick = () => go('/games/' + g.id);
    ov.querySelector('#endrun').onclick = () => game.endNow();
  }
  async function finish(res) {
    if (res.score > (+ls.getItem(bestKey) || 0)) ls.setItem(bestKey, res.score);
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
      ${r.level ? `<div class="xp-line">${icon('chevrons-up')} +${fmt(r.xp_gained)} XP • Level ${r.level.level}<span class="xpbar sm"><i style="width:${Math.round(r.level.into / r.level.need * 100)}%"></i></span></div>` : ''}
      <div class="share-row"><button class="btn sm ghost" id="share-run" data-run="${r.run_id}">${icon('share-2')} Share score</button><a class="btn sm ghost" href="/s/${r.run_id}">${icon('image')} Score card</a></div>
      ${r.unlocked && r.unlocked.length ? `<div class="unl-list">${r.unlocked.slice(0, 4).map(a => `<a href="/achievements" class="unl t-${a.tier}">${icon(a.icon)} ${esc(a.name)}</a>`).join('')}${r.unlocked.length > 4 ? `<span class="small muted">+${r.unlocked.length - 4} more</span>` : ''}</div>` : ''}`;
    achToast(r.unlocked);
    if (r.level_up) toast(`Level up! You're now level ${r.level_up}`, 3500);
    if (S.me && r.level) { S.me.level = r.level; }
    const sb = ov.querySelector('#share-run'); if (sb) sb.onclick = () => shareLink({ kind: 'run', ref: String(r.run_id), url: `/s/${r.run_id}`, title: `I scored ${fmtScore(r.score, g.id)} in ${g.title}`, text: `Can you beat my ${g.title} score on The Gaming Hub?` });
  }
  await getToken();
  if (tokenErr) toast('Score saving unavailable: ' + tokenErr, 4000);
  await game.ready;
  await new Promise(r => setTimeout(r, Math.max(0, 650 - (Date.now() - bootAt))));
  const bo = document.getElementById('boot'); if (bo) { bo.classList.add('out'); setTimeout(() => bo.remove(), 350); }
  game.start();
});

// ---------------- leaderboard ----------------
route(/^\/leaderboard$/, async (m, url) => {
  let period = url.searchParams.get('period') || 'all'; let game = url.searchParams.get('game') || 'global';
  let showMine = false;
  shell('/leaderboard', `<div class="narrow"><h1>${game === 'global' ? 'Global' : esc(gameById(game)?.title || '')} Leaderboard</h1>
    <div class="tabs" id="per">${[['all', 'All Time'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([k, l]) => `<button data-p="${k}" class="${k === period ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <div class="chips" id="gsel" style="padding:0;flex:1">${[['global', 'Global'], ...S.games.filter(x => x.playable).map(x => [x.id, x.title])].map(([k, l]) => `<button class="chip ${k === game ? 'on' : ''}" data-g="${k}">${esc(l)}</button>`).join('')}</div>
      ${S.me ? `<label class="check small" style="margin:0;white-space:nowrap">Friends <input type="checkbox" id="friends" ${url.searchParams.get('friends') === '1' ? 'checked' : ''}></label>` : ''}
      <label class="check small" style="margin:0;white-space:nowrap">My Rank <input type="checkbox" id="mine"></label>
    </div>
    <div class="card" id="tbl"><div class="skeleton" style="margin:12px"></div></div>
    <p class="small dim center">${'Weekly = last 7 days, Monthly = last 30 days. Global score = sum of each player\'s best score per game. Banners, frames and titles are earned from achievements.'}</p></div>`);
  async function load() {
    const fr = !!(document.getElementById('friends') && document.getElementById('friends').checked);
    history.replaceState({}, '', `/leaderboard?game=${game}&period=${period}${fr ? '&friends=1' : ''}`);
    document.querySelector('main h1').textContent = `${fr ? 'Friends' : game === 'global' ? 'Global' : gameById(game)?.title} Leaderboard${fr && game !== 'global' ? ' - ' + gameById(game)?.title : ''}`;
    const r = await api(`/api/leaderboard?game=${game}&period=${period}&limit=100${fr ? '&friends=1' : ''}`);
    if (fr && r.ok && r.rows.length <= 1) { const el0 = document.getElementById('tbl'); if (el0 && !r.rows.length) { el0.innerHTML = emptyState('users', 'No friends on this board yet', 'Follow players from their profile to compare scores here.', '<a class="btn sm" href="/search">Find players</a>'); return; } }
    const el = document.getElementById('tbl'); if (!el) return;
    if (!r.ok) { el.innerHTML = `<div class="empty">${esc(r.error)}</div>`; return; }
    if (!r.rows.length) { el.innerHTML = emptyState('trophy', 'No scores in this period yet', 'Set the first score and claim #1.', `<a class="btn sm" href="/play/${game === 'global' ? 'jetpack-dash' : game}">Play now</a>`); return; }
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
  const frEl = document.getElementById('friends'); if (frEl) frEl.addEventListener('change', load);
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
        ${g.winners.length ? `<div style="margin-bottom:10px">${g.winners.map(w => `<span class="pill gold" style="margin:0 6px 6px 0">${icon('crown')} ${w.place ? `#${w.place} ` : ''}${esc(w.username)}</span>`).join('')}${g.winners_state === 'pending' ? `<span class="pill wpend">${icon('hourglass')} Winner pending verification</span>` : ''}</div>` : '<div class="small muted" style="margin-bottom:10px">Winner to be announced</div>'}`
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
      ${r.me ? `<div class="ok-msg" style="margin:12px 0 0">${g.finalized_at ? 'Final result:' : "You're entered!"} You are <b>#${r.me.rank} of ${fmt(g.entrants)}</b> with ${sc(r.me.score)}. <a href="/giveaways/${g.id}/live">${g.finalized_at ? 'See final standings' : 'Track live'}</a></div>` : ''}
    </div>
    ${g.finalized_at ? finalResultsCard(g, sc) : ''}
    ${winRulesCard(g)}
    ${!g.finalized_at && g.winners.length ? `<div class="card pad" style="margin-bottom:14px"><h2 style="margin-bottom:8px"><span class="crown">${icon('crown')}</span> Winners</h2>${g.winners.map(w => `<div class="mini-row" style="margin:6px 0">${avatar(w.username)}<b>${esc(w.username)}</b><span class="s small" style="color:var(--gold)">${w.method === 'top' ? 'Top score' : 'Random draw'}</span></div>`).join('')}</div>` : ''}
    <div class="card"><div class="panel-h"><h2>${g.finalized_at ? 'Final standings' : 'Entrants'} (${fmt(g.entrants)})</h2><a class="btn sm ghost" id="live-link" href="/giveaways/${g.id}/${g.finalized_at ? 'results' : 'live'}">${icon(g.finalized_at ? 'list-ordered' : 'radio')} ${g.finalized_at ? 'All results' : 'Live standings'}</a></div>
      ${r.leaderboard.length ? `<table class="lb"><tbody>${r.leaderboard.map(x => { const w = (g.finalized_at ? g.winners : []).find(y => y.username === x.username); return `<tr class="${w ? 'win' : ''} ${r.me && r.me.username === x.username ? 'me' : ''}"><td class="rk">${x.rank}</td><td>${whoHTML(x, { extra: w ? ` <span class="crown">${icon('crown')}</span>` : '' })}</td><td class="sc">${sc(x.score)}</td></tr>`; }).join('')}</tbody></table>${g.entrants > r.leaderboard.length ? `<div class="center" style="padding:10px"><a class="btn sm ghost" href="/giveaways/${g.id}/live">See all ${fmt(g.entrants)} entrants</a></div>` : ''}` : `<div class="empty">No entrants yet.</div>`}</div>
    <div class="gw-actions"><button class="btn ghost" id="share-gw">${icon('share-2')} Share giveaway</button><a class="btn ghost" href="/giveaways/${g.id}/rules">${icon('scale')} Official rules</a>${g.finalized_at ? `<a class="btn ghost" href="/giveaways/${g.id}/results">${icon('printer')} Printable results</a>` : ''}</div>
    ${g.rules ? `<div class="card pad" style="margin-top:14px"><h2 style="margin-bottom:6px">Host rules</h2><p class="small muted" style="white-space:pre-wrap;margin:0">${esc(g.rules)}</p></div>` : ''}
    <p class="tiny muted center" style="margin-top:12px">NO PURCHASE NECESSARY. 21+. Void where prohibited. Operated by Trap Tech Solutions. See <a href="/giveaways/${g.id}/rules">Official Rules</a>.</p>
  </div>`, { title: g.title });
  document.getElementById('share-gw').onclick = () => shareLink({ kind: 'giveaway', ref: String(g.id), url: `/giveaways/${g.id}`, title: g.title, text: `Play free to win: ${g.prize || g.title} (hosted by ${g.host})`, withRef: true });
  tickCountdowns();
});

// ---------------- v4: winner rules, live standings, final results ----------------
// Same text as src/results.js TIEBREAK_RULES (the API also sends it as tiebreak_rules).
const TB_RULES = ['Higher score wins.', 'If scores are tied, whoever reached that score first wins (server timestamp of the run that set it).', 'If still tied, the player with fewer attempts (runs in the giveaway window) wins.', 'If still tied, the earlier-submitted run (lower run ID) wins.'];
const TB_TAG = { time: 'Tie: reached first', attempts: 'Tie: fewer attempts', run: 'Tie: earlier run' };
const tbList = (g) => `<ol class="tb-rules">${((g && g.tiebreak_rules) || TB_RULES).map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;
const stamp = (ms) => ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' }) : '';
const placeIc = (p) => p === 1 ? 'crown' : p <= 3 ? 'medal' : 'trophy';
const stateBadge = (st) => st === 'confirmed' ? `<span class="pill green wstate">${icon('badge-check')} Confirmed winner</span>` : st === 'pending' ? `<span class="pill wpend wstate">${icon('hourglass')} Winner pending verification</span>` : '';
function winRulesCard(g) {
  const n = g.winner_count || 1; const rnd = g.win_method === 'random';
  return `<div class="card pad gw-how" id="gw-how"><h2 style="margin-bottom:6px">${icon('scale')} How the winner is decided</h2>
    <p class="small" style="margin:0 0 8px">${rnd ? `<b>Verifiable random draw:</b> ${n} winner${n > 1 ? 's' : ''} drawn from all eligible entrants (one entry each, nobody can be picked twice).` : `<b>Top ${n} by best qualifying score win.</b> Your best valid run counts${g.game_ids && g.game_ids.length > 1 ? ' (sum of your best in each linked game)' : ''}, not your total plays.`}</p>
    <div class="small"><b>${rnd ? 'Leaderboard tiebreakers' : 'Tiebreakers, in order'}:</b></div>${tbList(g)}
    ${rnd ? `<p class="tiny muted" style="margin:6px 0 0">Draw commitment (SHA-256 of the secret seed, published before the end): <code class="hash">${esc(g.draw_commit || 'pending')}</code>. The seed is revealed with the results so anyone can check the draw.</p>` : ''}
    <p class="tiny muted" style="margin:6px 0 0">${icon('lock')} Final standings lock automatically at the end time. Scores submitted after that never change them. Runs that are impossible for their server-measured length are excluded.</p></div>`;
}
function finalResultsCard(g, sc) {
  const ws = g.winners || [];
  return `<div class="card pad final-res" id="final-results"><h2 style="margin-bottom:4px"><span class="crown">${icon('trophy')}</span> Final results</h2>
    <div class="tiny muted" style="margin-bottom:8px">${icon('lock')} Locked ${stamp(g.finalized_at)} • ${fmt(g.entrants)} entrants</div>
    ${ws.length ? ws.map(w => `<div class="win-row ${w.state}"><span class="wp">${icon(placeIc(w.place))}#${w.place}</span>${avatar(w.username)}<b class="wn">${esc(w.username)}</b><span class="ws">${sc(w.score)}</span>${stateBadge(w.state)}</div>`).join('')
      : '<div class="small muted">No eligible entrants.</div>'}
    ${g.winners_state === 'pending' ? `<p class="tiny muted" style="margin:8px 0 0">Winner pending verification: an admin is reviewing the top runs for fair play and eligibility (21+). If a winner is disqualified, the next place moves up.</p>` : ''}
    <div class="row-btns"><a class="btn sm" href="/giveaways/${g.id}/results">${icon('list-ordered')} Full final standings</a>${g.win_method === 'random' ? `<a class="btn sm ghost" href="/giveaways/${g.id}/results#verify">${icon('shield-check')} Verify the draw</a>` : ''}</div></div>`;
}
route(/^\/giveaways\/(\d+)\/live$/, async (m, url) => {
  const id = m[1]; let page = 1, q = url.searchParams.get('q') || '', first = true, busy = false, follow = true; // follow = keep my row in view until the player pages/searches
  const r0 = await api(`/api/giveaways/${id}/standings?per=25&around=me`);
  if (!r0.ok) return shell('/giveaways', emptyState('gift', 'Giveaway not found', '', '<a class="btn sm" href="/giveaways">All giveaways</a>'));
  const g = r0.giveaway; const multi = g.game_ids.length > 1;
  const sc = (n) => multi ? `${fmt(n)} pts` : fmtScore(n, g.game_ids[0]);
  shell('/giveaways', `<div class="narrow live-lb">
    <div class="back-row"><a class="iconbtn" href="/giveaways/${id}" aria-label="Back to giveaway">${icon('chevron-left')}</a><h1>${r0.finalized ? 'Final standings' : 'Live standings'}</h1></div>
    <div class="small muted" style="margin:-6px 0 10px"><a href="/giveaways/${id}">${esc(g.title)}</a>${demoTag(g.demo)} • ${esc(g.game_title)}</div>
    <div id="lv-status"></div>
    <div id="lv-me"></div>
    <div class="card"><div class="panel-h lv-tools"><h2 id="lv-count">Entrants</h2>
      <input class="input" id="lv-q" type="search" placeholder="Search username" aria-label="Search by username" value="${esc(q)}" autocomplete="off"></div>
      <div id="lv-table"><div class="skeleton"></div></div>
      <div class="lv-pager" id="lv-pager"></div></div>
    <div class="card pad" style="margin-top:14px"><h2 style="margin-bottom:6px">Tiebreakers, in order</h2>${tbList(r0)}<p class="tiny muted" id="lv-upd" style="margin:6px 0 0"></p></div>
  </div>`, { title: `Live standings: ${g.title}` });
  function draw(r) {
    const g = r.giveaway;
    document.getElementById('lv-status').innerHTML = r.finalized
      ? `<div class="final-banner ${r.winners_state}">${icon('lock')} <b>Final results locked</b> ${stamp(g.finalized_at)}${r.winners.length ? ` • Winner${r.winners.length > 1 ? 's' : ''}: ${r.winners.map(w => `<b>#${w.place} ${esc(w.username)}</b>`).join(', ')}` : ''} ${stateBadge(r.winners_state === 'confirmed' ? 'confirmed' : r.winners_state === 'pending' ? 'pending' : '')} <a href="/giveaways/${g.id}/results">Results page</a></div>`
      : g.status === 'upcoming' ? `<div class="final-banner">Starts ${stamp(g.start_at)}</div>`
      : `<div class="live-pill"><span class="dot"></span>LIVE • updates every 10s • ends ${stamp(g.end_at)}</div>${cdHTML(g.end_at, '')}`;
    const me = r.me; const el = document.getElementById('lv-me');
    if (!S.me) el.innerHTML = `<div class="card pad lv-mecard guest"><b>Sign in to see your rank.</b> <a class="btn sm" href="/signin?next=${encodeURIComponent(location.pathname)}">Sign in</a></div>`;
    else if (!me || !me.rank) el.innerHTML = `<div class="card pad lv-mecard"><b>${me && me.disqualified ? 'Your entry was disqualified from this giveaway.' : r.finalized ? "You didn't enter this giveaway." : "You're not on the board yet."}</b> ${!r.finalized && !(me && me.disqualified) && g.status === 'active' ? `<a class="btn sm" href="/giveaways/${g.id}">${icon('play')} Play to enter</a>` : ''}<div class="tiny muted">${fmt(r.total)} players ranked</div></div>`;
    else el.innerHTML = `<div class="card pad lv-mecard ${me.winner ? 'is-win' : ''}" id="lv-mecard">
      <div class="lv-rank"><span>You are</span><b id="lv-rank">#${me.rank}</b><span>of ${fmt(me.of)}</span></div>
      <div class="lv-stats"><div><small>Best score</small><b>${sc(me.score)}</b></div><div><small>Attempts</small><b>${fmt(me.attempts)}</b></div>
        <div><small>Gap to next place</small><b>${me.rank === 1 ? 'You lead!' : me.gap_to_next === 0 ? 'Tied' : '+' + (multi ? fmt(me.gap_to_next) : fmtScore(me.gap_to_next, g.game_ids[0]))}</b>${me.next_username ? `<em>to pass ${esc(me.next_username)}${me.gap_to_next === 0 ? ' (tiebreak: they got there first)' : ''}</em>` : ''}</div>
        ${me.gap_to_win ? `<div><small>To reach a winning place</small><b>+${multi ? fmt(me.gap_to_win) : fmtScore(me.gap_to_win, g.game_ids[0])}</b></div>` : ''}</div>
      ${me.state ? stateBadge(me.state) : me.winner ? '' : ''}${!r.finalized && g.status === 'active' ? `<a class="btn sm" style="margin-top:8px" href="/giveaways/${g.id}">${icon('play')} Play again to improve</a>` : ''}</div>`;
    document.getElementById('lv-count').textContent = r.q ? `${fmt(r.matched)} of ${fmt(r.total)} entrants match` : `${fmt(r.total)} entrants`;
    const myName = S.me && S.me.username;
    document.getElementById('lv-table').innerHTML = r.rows.length ? `<table class="lb lv"><thead><tr><th>#</th><th>Player</th><th class="hide-sm">Reached</th><th class="hide-sm">Tries</th><th>Best</th></tr></thead><tbody>${r.rows.map(x => `<tr class="${x.username === myName ? 'me' : ''} ${x.winner ? 'win' : ''} ${!r.finalized && g.win_method !== 'random' && x.rank <= g.winner_count ? 'zone' : ''}" data-rank="${x.rank}"><td class="rk">${x.rank}</td><td>${whoHTML(x, { extra: x.winner ? ` <span class="crown">${icon('crown')}</span>` : '' })}${x.tiebreak ? `<span class="tb-tag">${TB_TAG[x.tiebreak]}</span>` : ''}</td><td class="hide-sm tiny muted">${stamp(x.reached_at)}</td><td class="hide-sm">${fmt(x.attempts)}</td><td class="sc">${sc(x.score)}</td></tr>`).join('')}</tbody></table>`
      : `<div class="empty">${r.q ? 'No players match that search.' : 'No entrants yet. Be the first!'}</div>`;
    document.getElementById('lv-pager').innerHTML = r.pages > 1 ? `<button class="btn sm ghost" data-pg="${r.page - 1}" ${r.page <= 1 ? 'disabled' : ''} aria-label="Previous page">${icon('chevron-left')}</button><span class="small">Page ${r.page} of ${r.pages}</span><button class="btn sm ghost" data-pg="${r.page + 1}" ${r.page >= r.pages ? 'disabled' : ''} aria-label="Next page">${icon('chevron-right')}</button>${me && me.rank && !r.q ? `<button class="btn sm ghost" data-pg="me" id="lv-jump">Jump to me</button>` : ''}` : '';
    document.getElementById('lv-upd').textContent = `Updated ${new Date().toLocaleTimeString()}${r.finalized ? ' • final' : ' • refreshes every 10 seconds'}`;
    tickCountdowns();
  }
  async function load(opts = {}) {
    if (busy) return; busy = true;
    try {
      const qs = new URLSearchParams({ per: '25', page: String(page) }); if (q) qs.set('q', q); if (opts.me || (follow && !q)) qs.set('around', 'me');
      const r = first ? r0 : await api(`/api/giveaways/${id}/standings?${qs}`); first = false;
      if (!r.ok || !document.getElementById('lv-table')) return;
      page = r.page; draw(r);
      if (r.finalized && S.poll) { clearInterval(S.poll); S.poll = null; }
    } finally { busy = false; }
  }
  let t = null;
  document.getElementById('lv-q').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); page = 1; follow = !q; history.replaceState({}, '', `/giveaways/${id}/live${q ? '?q=' + encodeURIComponent(q) : ''}`); load(); }, 250); });
  document.getElementById('lv-pager').addEventListener('click', (e) => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; if (b.dataset.pg === 'me') { follow = true; load({ me: true }); } else { follow = false; page = +b.dataset.pg; load(); } });
  if (q) { first = false; await load(); } else await load();
  if (!r0.finalized) S.poll = setInterval(() => { if (document.visibilityState === 'visible') load(); }, r0.refresh_ms || 10000);
});
async function sha256hex(str) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
async function hmachex(key, msg) { const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); const b = await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
route(/^\/giveaways\/(\d+)\/results$/, async (m) => {
  const id = m[1];
  const r = await api(`/api/giveaways/${id}/standings?per=1000`);
  if (!r.ok) return shell('/giveaways', emptyState('gift', 'Giveaway not found', '', '<a class="btn sm" href="/giveaways">All giveaways</a>'));
  const g = r.giveaway; let rows = r.rows;
  for (let p = 2; p <= r.pages; p++) { const x = await api(`/api/giveaways/${id}/standings?per=1000&page=${p}`); if (x.ok) rows = rows.concat(x.rows); }
  const multi = g.game_ids.length > 1; const gid = g.game_ids[0];
  const sc = (n) => multi ? `${fmt(n)} pts` : fmtScore(n, gid);
  const when = (ms) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'medium' }) + ' ET';
  if (!r.finalized) return shell('/giveaways', `<div class="narrow"><div class="back-row"><a class="iconbtn" href="/giveaways/${id}" aria-label="Back">${icon('chevron-left')}</a><h1>Final results</h1></div>
    ${emptyState('hourglass', 'Results are not final yet', `Final standings for "${esc(g.title)}" lock automatically when it ends (${when(g.end_at)}).`, `<a class="btn sm" href="/giveaways/${id}/live">${icon('radio')} Live standings</a>`)}</div>`, { title: `Final results: ${g.title}` });
  shell('/giveaways', `<div class="narrow results-page" id="results-page">
    <div class="back-row no-print"><a class="iconbtn" href="/giveaways/${id}" aria-label="Back">${icon('chevron-left')}</a><h1>Final results</h1><span class="spacer"></span><button class="btn sm" id="print-btn">${icon('printer')} Print / save PDF</button></div>
    <div class="card pad res-head"><img class="print-only" src="/assets/brand/hub-logo.svg" alt="The Gaming Hub" width="150" height="35">
      <h2>${esc(g.title)}${demoTag(g.demo)}</h2>
      <div class="res-meta"><div><small>Hosted by</small>${esc(g.host || 'The Gaming Hub')}</div><div><small>Prize</small>${esc(g.prize || g.title)}</div><div><small>Game</small>${esc(g.game_title)}</div>
        <div><small>Giveaway period</small>${when(g.start_at)} to ${when(g.end_at)}</div><div><small>Standings locked</small>${when(g.finalized_at)}</div><div><small>Eligible entrants</small>${fmt(r.total)}</div>
        <div><small>Winner selection</small>${g.win_method === 'random' ? `Verifiable random draw, ${g.winner_count} winner${g.winner_count > 1 ? 's' : ''}` : `Top ${g.winner_count} by best qualifying score`}</div></div>
      ${g.prize_tiers.length ? `<div class="ptiers">${g.prize_tiers.map((p, i) => `<div><span>${icon(/random/i.test(p) ? 'shuffle' : i === 0 ? 'crown' : 'trophy')}</span>${esc(p)}</div>`).join('')}</div>` : ''}
    </div>
    <div class="card pad final-res" id="final-results"><h2 style="margin-bottom:8px"><span class="crown">${icon('trophy')}</span> Winner${r.winners.length === 1 ? '' : 's'}</h2>
      ${r.winners.length ? r.winners.map(w => `<div class="win-row ${w.state}"><span class="wp">${icon(placeIc(w.place))}#${w.place}</span>${avatar(w.username)}<b class="wn">${esc(w.username)}</b><span class="ws">${sc(w.score)}</span>${stateBadge(w.state)}</div>`).join('') : '<div class="small muted">No eligible entrants.</div>'}
      ${r.winners_state === 'pending' ? '<p class="tiny muted" style="margin:8px 0 0">Winner pending verification. Results become official once an admin confirms them. If a winner is disqualified, the next place moves up.</p>' : ''}</div>
    <div class="card"><div class="panel-h"><h2>Final standings (${fmt(rows.length)})</h2></div>
      <table class="lb res-table"><thead><tr><th>Place</th><th>Player</th><th>Best score</th><th>Reached at</th><th>Attempts</th><th>Tiebreak</th></tr></thead><tbody>
      ${rows.map(x => `<tr class="${x.winner ? 'win' : ''}"><td class="rk">${x.rank}</td><td><b>${esc(x.username)}</b>${x.winner ? ` <span class="crown">${icon('crown')}</span>` : ''}${x.draw_pos ? `<span class="tiny muted"> draw #${x.draw_pos}</span>` : ''}</td><td class="sc">${sc(x.score)}</td><td class="tiny">${stamp(x.reached_at)}</td><td>${fmt(x.attempts)}</td><td class="tiny muted">${x.tiebreak ? TB_TAG[x.tiebreak] : ''}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="card pad"><h2 style="margin-bottom:6px">Tiebreakers, in order</h2>${tbList(r)}<p class="tiny muted" style="margin:6px 0 0">${esc(r.score_rule)}</p></div>
    <div class="card pad" id="verify"><h2 style="margin-bottom:6px">${icon('shield-check')} Verification</h2><div id="vf-body" class="small muted">Checking...</div></div>
    <p class="tiny muted center">NO PURCHASE NECESSARY. 21+. Operated by Trap Tech Solutions. <a href="/giveaways/${id}/rules">Official Rules</a> • Printed ${when(Date.now())}</p>
  </div>`, { title: `Final results: ${g.title}` });
  document.getElementById('print-btn').onclick = () => window.print();
  // independent, in-browser check of the published hashes and (for random draws) the draw order
  const v = await api(`/api/giveaways/${id}/verify`); const vb = document.getElementById('vf-body'); if (!vb) return;
  if (!v.ok || !v.finalized) { vb.textContent = 'Not available.'; return; }
  let html = `<div>Entrant list SHA-256: <code class="hash">${esc(v.entrants_hash)}</code></div>`;
  try {
    const h = await sha256hex(v.entrant_lines.join('\n')); const okH = h === v.entrants_hash;
    html += `<div class="${okH ? 'vf-ok' : 'vf-bad'}">${icon(okH ? 'circle-check' : 'circle-x')} Recomputed in your browser from ${fmt(v.entrant_lines.length)} locked entries: ${okH ? 'match' : 'MISMATCH'}</div>`;
    if (v.method === 'random') {
      const okS = (await sha256hex(v.seed)) === v.draw_commit;
      const keys = await Promise.all(v.entrant_lines.map(l => hmachex(v.seed, `${v.entrants_hash}:${l.split('|')[1]}`)));
      const order = v.entrant_lines.map((l, i) => [keys[i], l.split('|')[1]]).sort((a, b) => a[0] < b[0] ? -1 : 1).map(x => x[1]);
      const okD = order.join() === v.draw_order.map(x => x.username).join();
      html += `<div>Commitment (published before the end): <code class="hash">${esc(v.draw_commit)}</code></div><div>Revealed seed: <code class="hash">${esc(v.seed)}</code></div>
        <div class="${okS ? 'vf-ok' : 'vf-bad'}">${icon(okS ? 'circle-check' : 'circle-x')} SHA-256(seed) equals the commitment: ${okS ? 'yes' : 'NO'}</div>
        <div class="${okD ? 'vf-ok' : 'vf-bad'}">${icon(okD ? 'circle-check' : 'circle-x')} Draw order recomputed with HMAC-SHA256(seed, entrants_hash + ":" + username): ${okD ? 'match' : 'MISMATCH'}</div>
        <p class="tiny">${esc(r.random_rule)}</p>`;
    }
  } catch (e) { html += '<div>Your browser cannot run the check here (needs HTTPS). The hashes above can be checked with any SHA-256 tool.</div>'; }
  vb.innerHTML = html;
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
        <div class="small pmeta">Level ${p.level.level} <span style="color:var(--cyan)">•</span> Member Since ${new Date(p.member_since).getFullYear()}</div>
        <div class="xpbar" title="${fmt(p.level.into)} / ${fmt(p.level.need)} XP to level ${p.level.level + 1}" aria-label="Level progress"><i style="width:${Math.round(p.level.into / p.level.need * 100)}%"></i></div>
        <div class="pchips">${p.global_rank ? `<span class="pill">${icon('trophy')} Global #${p.global_rank}</span>` : ''}${p.streak.current ? `<span class="pill fire">${icon('flame')} ${p.streak.current}-day streak</span>` : ''}<span class="pill">${icon('calendar-range')} S${p.season.number} tier ${p.season.tier}</span></div></div></div>
    </div>
    <div class="prof-actions">
      <button class="fcount" data-fl="followers"><b id="nfollowers">${fmt(p.followers)}</b> followers</button><button class="fcount" data-fl="following"><b>${fmt(p.following)}</b> following</button>
      <span style="flex:1"></span>
      ${r.is_me ? `<a class="btn sm ghost" href="/invite">${icon('gift')} Invite</a>` : S.me ? `<button class="btn sm ${p.i_follow ? 'ghost' : ''}" id="follow" aria-pressed="${p.i_follow}">${icon(p.i_follow ? 'user-check' : 'user-plus')} <span>${p.i_follow ? 'Following' : p.follows_me ? 'Follow back' : 'Follow'}</span></button>` : `<a class="btn sm" href="/signin?next=/u/${encodeURIComponent(p.username)}">${icon('user-plus')} Follow</a>`}
      <button class="iconbtn" id="share-prof" aria-label="Share profile">${icon('share-2')}</button>
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
  setTitle(`${p.username}'s profile`);
  document.getElementById('share-prof').onclick = () => shareLink({ kind: 'profile', ref: p.username, url: `/u/${encodeURIComponent(p.username)}`, title: `${p.username} on The Gaming Hub`, text: `Level ${p.level.level} on The Gaming Hub - come play!` });
  document.querySelectorAll('[data-fl]').forEach(b => b.onclick = () => followSheet(p.username, b.dataset.fl));
  const fb = document.getElementById('follow');
  if (fb) fb.onclick = async () => {
    const on = fb.getAttribute('aria-pressed') === 'true';
    const res = await api('/api/follow/' + encodeURIComponent(p.username), { method: on ? 'DELETE' : 'POST' });
    if (!res.ok) return toast(res.error);
    fb.setAttribute('aria-pressed', String(res.following)); fb.classList.toggle('ghost', res.following);
    fb.innerHTML = `${icon(res.following ? 'user-check' : 'user-plus')} <span>${res.following ? 'Following' : 'Follow'}</span>`;
    document.getElementById('nfollowers').textContent = fmt(res.followers); toast(res.following ? `Following ${p.username}` : `Unfollowed ${p.username}`); achToast(res.unlocked);
  };
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
    <div class="ach-links"><a class="chip" href="/season">${icon('calendar-range')} Season Pass</a><a class="chip" href="/quests">${icon('scroll-text')} Daily Quests</a><a class="chip" href="/invite">${icon('gift')} Invite friends</a><span class="tiny muted tt-inline">Achievement system by Trap Tech</span></div>
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
const DIM_ROWS = [['exposure', 'monitor-smartphone', 'Where you are shown'], ['reach', 'users', 'How players find you'], ['duration', 'calendar-range', 'Duration'], ['branding', 'palette', 'Branding'], ['links', 'link', 'Links to your site / Potato channel'], ['winners', 'trophy', 'Winners'], ['analytics', 'chart-column', 'Analytics'], ['winner_contact', 'message-circle', 'Winner contact']];
const priceBlock = (pk, t) => `<div class="pk-price">${t.regular_price && t.regular_price !== t.price ? `<span class="launch-pill">${icon('sparkles')} ${esc(pk.launch_label || 'Launch pricing')}</span>` : ''}<b>${esc(t.price)}</b>${t.regular_price && t.regular_price !== t.price ? `<s class="reg" aria-label="Regular price">${esc(t.regular_price)}</s>` : ''}<span>${esc(t.price_note)}</span></div>`;
route(/^\/host$/, async (m, url) => {
  const pk = await loadPackages(); if (!pk) return shell('/host', `<div class="empty">Could not load packages.</div>`);
  const T = pk.tiers;
  shell('/host', `<div class="narrow host">
    <div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Sponsor the Hub</h1></div>
    <div class="banner"><h2>Launch your brand <span class="grad-text">in the game</span></h2><div style="color:#d9dcff">Built for upcoming and independent brands: put your prize in front of players who are already competing. Start small with Basic, grow into Premium or Elite. Booking is free - we confirm everything with you on Potato.</div></div>
    <div class="who-chips" aria-label="Who sponsors">${['Licensed cannabis brands', 'Dispensaries & delivery', 'Streamers & creators', 'Gaming channels', 'Apparel & streetwear', 'Glass & smoke-gear shops', 'Artists & musicians', 'Shops & local business'].map(x => `<span class="chip">${esc(x)}</span>`).join('')}</div>
    <div class="pk3" id="tiers">${T.map(t => `<div class="card pk ${t.id}" data-tier="${t.id}">
      ${t.badge ? `<span class="pk-badge">${esc(t.badge)}</span>` : ''}
      <div class="pk-h"><img src="${PKG_IMG[t.id] || PKG_IMG.basic}" alt="" width="48" height="48" loading="lazy"><div><h3>${esc(t.name)}</h3><div class="pk-tag">${esc(t.tagline)}</div></div></div>
      ${priceBlock(pk, t)}
      <div class="pk-who"><span>${icon('users')} Who it's for</span>${esc(t.who)}</div>
      <dl class="pk-dims">${DIM_ROWS.map(([k, ic, l]) => t.dims && t.dims[k] ? `<div class="dim d-${k}"><dt>${icon(ic)} ${l}</dt><dd>${esc(t.dims[k])}</dd></div>` : '').join('')}</dl>
      <details class="pk-more"><summary>Everything included ${icon('chevron-down')}</summary><ul class="pk-f">${t.features.map(f => `<li>${icon(/^everything in/i.test(f) ? 'layers' : 'check')}<span>${esc(f)}</span></li>`).join('')}</ul></details>
      <a class="btn block ${t.id === 'premium' ? '' : 'ghost'}" href="/book?package=${t.id}" data-pick="${t.id}">Book ${esc(t.name)}</a>
    </div>`).join('')}</div>
    ${pk.launch_note ? `<p class="small dim center launch-note">${icon('sparkles')} ${esc(pk.launch_note)}</p>` : ''}
    <div class="section-h"><h2>${icon('chart-column')} Compare side by side</h2></div>
    <div class="card cmp-wrap"><table class="cmp"><thead><tr><th></th>${T.map(t => `<th class="${t.id}">${esc(t.name)}<small>${esc(t.price)}${t.regular_price && t.regular_price !== t.price ? ` <s>${esc(t.regular_price)}</s>` : ''}</small></th>`).join('')}</tr></thead>
      <tbody>${(pk.compare || []).map(row => `<tr><td>${esc(row[0])}</td>${[1, 2, 3].map(i => `<td>${cmpCell(row[i])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
    ${pk.why_links ? `<div class="card pad why-links"><h3>${icon('link')} Why links are a paid feature</h3><p class="muted">${esc(pk.why_links)}</p></div>` : ''}
    <div class="section-h" id="addons"><h2>${icon('puzzle')} Custom &amp; add-ons</h2></div>
    <div class="addons">${(pk.addons || []).map(a => `<div class="card addon" data-addon="${esc(a.id)}"><div><b>${esc(a.name)}</b><div class="small muted">${esc(a.desc)}</div></div><span class="ap">${esc(a.price)}</span></div>`).join('')}
      <div class="card addon custom"><div><b>Fully custom</b><div class="small muted">Tournaments, stream events, sponsored leaderboards or a brand-new custom game. Tell us the idea; we quote it.</div></div><a class="btn sm" href="/book?package=custom">Request</a></div></div>
    <div class="section-h" id="multi"><h2>${icon('layers')} Many brands at once - how it stays fair</h2></div>
    <div class="howto">${(pk.multi_brand || []).map(([t, d], i) => `<div class="card"><span class="num">${i + 1}</span><div><b>${esc(t)}</b><div class="small muted">${esc(d)}</div></div></div>`).join('')}</div>
    <div class="card tt-build">
      <div class="ttb-head"><img src="/assets/brand/traptech-wordmark.svg" alt="Trap Tech Solutions" width="190" height="48"><span class="pill">${icon('code-xml')} Built in-house</span></div>
      <h2>Trap Tech Solutions builds your brand's game</h2>
      <p class="muted">The Gaming Hub is designed, built and operated by Trap Tech Solutions. Every package is set up by our own team: giveaway card, channel page and brand theme, plus game skins, prize tiers and reports on Elite.</p>
      <ul class="ttb-list"><li>${icon('gamepad-2')} Branded HTML5 games that work on any phone and inside Potato</li><li>${icon('shield-check')} Server-side anti-cheat and verifiable winner draws</li><li>${icon('scale')} Official rules with "no purchase necessary", run by Trap Tech as operator</li><li>${icon('message-circle')} Winners contacted on Potato by our team</li></ul>
      <a class="btn sm ghost" href="/about">${icon('building-2')} About Trap Tech</a>
    </div>
    <div class="section-h"><h2>How booking works</h2></div>
    <div class="howto">${[['Pick a tier', 'Basic, Premium, Elite or custom, plus any add-ons.'], ['Send a free request', 'Your brand, prize, dates and an email and/or Potato username. No payment now.'], ['Confirm on Potato', `Message us on Potato at @${esc(pk.potato_handle || 'TrapTechSolutions')} - we confirm details and the quote.`], ['We build & launch', 'We set up your channel, giveaway and games, contact winners on Potato and send your stats.']].map(([t, d], i) => `<div class="card"><span class="num">${i + 1}</span><div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join('')}</div>
    <div class="section-h" id="faq"><h2>${icon('circle-help')} Sponsor FAQ</h2></div>
    <div class="faq">${(pk.faq || []).map(([q, a], i) => `<details class="card" ${i === 0 ? 'open' : ''}><summary>${esc(q)}${icon('chevron-down')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
    <p class="small dim center">Sponsors must comply with all laws that apply to their business, products and advertising. See the <a href="/terms">Terms</a> and <a href="/rules">Official Rules</a>.</p>
  </div>`);
  const h = location.hash.slice(1); if (h) document.getElementById(h)?.scrollIntoView();
});
function cmpCell(v) {
  const s = String(v || '').trim();
  if (!s || s === '-' || /^no$/i.test(s)) return `<span class="no">${icon('x')}</span>`;
  if (/^(yes|✓)$/i.test(s)) return `<span class="yes">${icon('check')}</span>`;
  return esc(s);
}
route(/^\/book$/, async (m, url) => {
  const pk = await loadPackages(); const T = pk ? pk.tiers : []; const AD = (pk && pk.addons) || [];
  const BT = await api('/api/business-types'); const TYPES = BT.types || []; const CANN = BT.cannabis;
  const B = { step: 1, package: url.searchParams.get('package') || 'basic', business_type: '', brand: '', event_type: '', contact_name: '', email: '', potato: S.me ? S.me.username : '', licensed: false, addons: [], start_date: '', end_date: '', details: '' };
  if (B.package !== 'custom' && !T.some(t => t.id === B.package)) B.package = 'basic';
  const EV = ['Giveaway', 'Multi-game Giveaway', 'Brand Takeover', 'Tournament', 'Sponsored Leaderboard', 'Stream Event', 'Custom Game', 'Other'];
  const save = () => { document.querySelectorAll('[data-b]').forEach(i => { B[i.dataset.b] = i.value.trim(); }); const lc = document.getElementById('licensed'); if (lc) B.licensed = lc.checked; const ad = document.querySelectorAll('[data-ad]'); if (ad.length) B.addons = [...ad].filter(x => x.checked).map(x => x.dataset.ad); };
  const tierOf = () => T.find(t => t.id === B.package);
  const summary = () => { const t = tierOf(); return t ? `<div class="pk-sel ${t.id}" id="pksel"><img src="${PKG_IMG[t.id]}" alt=""><div><small>SELECTED PACKAGE</small><b>${esc(t.name)}</b><span>${esc(t.tagline)}</span></div><div class="pr"><b>${esc(t.price)}</b><span>${t.regular_price && t.regular_price !== t.price ? `<s>${esc(t.regular_price)}</s> ` : ''}${esc(t.price_note)}</span></div></div>` : `<div class="pk-sel custom" id="pksel"><div><small>SELECTED</small><b>Custom</b><span>Quote on request</span></div></div>`; };
  function draw(err = '') {
    const st = (n, l) => `<div class="st ${B.step >= n ? 'on' : ''}"><i>${n}</i>${l}</div>`;
    let body = '';
    if (B.step === 1) body = `
      <div class="field"><label class="lbl">Package</label><div class="tierpick" id="tp">${[...T.map(t => [t.id, t.name, t.price]), ['custom', 'Custom', 'Quote']].map(([k, l, p]) => `<button type="button" data-t="${k}" class="${B.package === k ? 'on' : ''} ${k}"><b>${esc(l)}</b><span>${esc(p)}</span></button>`).join('')}</div></div>
      <div class="field"><label class="lbl" for="bt">Business type</label><select class="input" id="bt" data-b="business_type"><option value="">Select your business type</option>${TYPES.map(e => `<option ${B.business_type === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></div>
      <div id="lic-wrap">${B.business_type === CANN ? `<label class="check lic"><input type="checkbox" id="licensed" ${B.licensed ? 'checked' : ''}> <span>I confirm my business is licensed and legally permitted to operate and advertise in my jurisdiction <b class="req">(required)</b></span></label>` : ''}</div>
      <div class="field"><label class="lbl">Channel / Brand Name</label><input class="input" data-b="brand" value="${esc(B.brand)}" placeholder="Your channel or brand name" maxlength="120"></div>
      <div class="field"><label class="lbl">Your Name <span class="muted small">(optional)</span></label><input class="input" data-b="contact_name" value="${esc(B.contact_name)}" placeholder="Who should we talk to?" maxlength="120"></div>
      <div class="lbl" style="margin-top:4px">How can we reach you? <span class="muted small">(at least one)</span></div>
      <div class="field ic">${icon('message-circle')}<input class="input" id="b-potato" data-b="potato" value="${esc(B.potato)}" placeholder="Potato username, e.g. @yourbrand" maxlength="40" autocapitalize="none"></div>
      <div class="field ic">${icon('mail')}<input class="input" id="b-email" type="email" data-b="email" value="${esc(B.email)}" placeholder="Email (optional if Potato given)" maxlength="160" autocapitalize="none"></div>`;
    else if (B.step === 2) body = `
      <div class="field"><label class="lbl">Event Type</label><select class="input" data-b="event_type"><option value="">Select an option</option>${EV.map(e => `<option ${B.event_type === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
      <label class="lbl" style="font-weight:600;font-size:.85rem">Preferred Dates</label>
      <div class="grid2" style="margin-top:6px"><div class="field"><label class="lbl small">Start Date</label><input class="input" type="date" data-b="start_date" value="${esc(B.start_date)}"></div><div class="field"><label class="lbl small">End Date</label><input class="input" type="date" data-b="end_date" value="${esc(B.end_date)}"></div></div>
      ${AD.length ? `<div class="lbl">Add-ons <span class="muted small">(optional)</span></div><div class="ad-pick">${AD.map(a => `<label class="check"><input type="checkbox" data-ad="${esc(a.id)}" ${B.addons.includes(a.id) ? 'checked' : ''}> <span><b>${esc(a.name)}</b> <span class="muted small">${esc(a.price)}</span></span></label>`).join('')}</div>` : ''}
      <div class="field"><label class="lbl">Prize, games &amp; details</label><textarea class="input" data-b="details" maxlength="4000" placeholder="Prize, which games you'd like, brand colors / logo link, rules (age, region) or any special requests...">${esc(B.details)}</textarea></div>`;
    else { const t = tierOf(); body = `<div class="card pad" style="background:rgba(5,8,26,.7)">${[['Package', t ? `${t.name} - ${t.price} ${t.price_note}` : 'Custom - quote on request'], ['Add-ons', B.addons.map(id => (AD.find(a => a.id === id) || {}).name).filter(Boolean).join(', ') || '-'], ['Business type', B.business_type], ...(B.business_type === CANN ? [['License', 'Confirmed licensed & legally permitted to advertise']] : []), ['Brand', B.brand], ['Event type', B.event_type || '-'], ['Contact', [B.contact_name, B.potato ? '@' + B.potato.replace(/^@/, '') + ' on Potato' : '', B.email].filter(Boolean).join(' • ')], ['Dates', `${B.start_date || 'flexible'} → ${B.end_date || 'flexible'}`], ['Details', B.details || '-']].map(([k, v]) => `<div class="rv-row" data-rv="${k.toLowerCase()}"><span class="muted">${k}</span><span>${esc(v)}</span></div>`).join('')}</div>
      <p class="small muted">No payment is taken. After you send this, message us on Potato to confirm.</p>`; }
    shell('/book', `<div class="narrow"><div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Book a Sponsorship</h1></div>
      ${summary()}
      <div class="steps">${st(1, 'Details')}<span class="bar"></span>${st(2, 'Dates & add-ons')}<span class="bar"></span>${st(3, 'Review')}</div>
      <div class="card pad">${err ? `<div class="err">${esc(err)}</div>` : ''}${body}
      <div style="display:flex;gap:10px;margin-top:6px">${B.step > 1 ? `<button class="btn ghost" id="prev" style="flex:1">Back</button>` : ''}<button class="btn" id="next" style="flex:2">${B.step < 3 ? 'Next Step' : 'Submit Request'}</button></div></div>
      <p class="small dim center"><a href="/host">Compare packages</a> • <a href="/host#faq">Sponsor FAQ</a></p></div>`);
    const tp = document.getElementById('tp'); if (tp) tp.onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b) return; save(); B.package = b.dataset.t; draw(); };
    const bt = document.getElementById('bt'); if (bt) bt.onchange = () => { save(); B.licensed = false; draw(); };
    document.getElementById('next').onclick = async () => {
      save(); B.potato = B.potato.replace(/^@/, '');
      if (B.step === 1) {
        if (!B.business_type) return draw('Please choose your business type.');
        if (B.business_type === CANN && !B.licensed) return draw('Please confirm your business is licensed and legally permitted to operate and advertise in your jurisdiction.');
        if (!B.brand) return draw('Channel / brand name is required.');
        if (!B.email && !B.potato) return draw('Add a Potato username or an email (at least one) so we can reach you.');
        if (B.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(B.email)) return draw('That email address does not look right.');
      }
      if (B.step === 2 && B.start_date && B.end_date && B.end_date < B.start_date) return draw('End date must be after the start date.');
      if (B.step < 3) { B.step++; return draw(); }
      const btn = document.getElementById('next'); btn.disabled = true;
      const r = await api('/api/bookings', { method: 'POST', body: B });
      if (!r.ok) { btn.disabled = false; return draw(r.error); }
      const hd = r.potato_handle || 'TrapTechSolutions';
      shell('/book', `<div class="narrow"><div class="card pad center glow-purple book-done" style="margin-top:30px"><div style="font-size:3rem;color:var(--green)">${icon('calendar-check')}</div><h1>Request Sent!</h1>
        <p class="muted">Booking reference <b>#${r.id}</b> for <b id="booked-pkg">${esc(r.package_snapshot)}</b>.</p>
        <div class="potato-confirm" id="potato-confirm"><div class="pc-ic">${icon('message-circle')}</div><div><b>Message us on Potato at <span class="handle">@${esc(hd)}</span> to confirm your booking.</b><div class="small muted">Send your reference <b>#${r.id}</b>. We reply there with your quote and launch date${B.email ? ` (we may also email ${esc(B.email)})` : ''}.</div></div></div>
        <div class="btn-row center-row"><button class="btn" id="copy-handle">${icon('copy')} Copy @${esc(hd)}</button><a class="btn ghost" href="https://potato.im/${encodeURIComponent(hd)}" rel="noopener">${icon('external-link')} Open in Potato</a></div>
        <a class="btn block ghost" href="/" style="margin-top:10px">Back to Home</a><p class="tiny muted" style="margin:12px 0 0">Your branded game and giveaway will be built by Trap Tech Solutions.</p></div></div>`);
      document.getElementById('copy-handle').onclick = async () => { if (await copyText('@' + hd, 'Copy our Potato username')) toast('Copied @' + hd); };
    };
    const prev = document.getElementById('prev'); if (prev) prev.onclick = () => { save(); B.step--; draw(); };
  }
  draw();
});

// ---------------- community ----------------
route(/^\/community$/, async () => {
  let tab = 'all';
  shell('/community', `<div class="narrow"><h1>Community</h1><div class="tabs" id="ct" role="tablist"><button data-k="all" class="on" role="tab" aria-selected="true">All</button>${S.me ? '<button data-k="following" role="tab">Following</button>' : ''}<button data-k="announcements" role="tab">News</button><button data-k="winners" role="tab">Winners</button></div><div id="feed"><div class="skeleton"></div></div></div>`);
  async function load() {
    const el0 = document.getElementById('feed'); if (el0) el0.innerHTML = '<div class="sk sk-row"></div><div class="sk sk-row"></div><div class="sk sk-row"></div>';
    const r = await api('/api/community?tab=' + tab); const el = document.getElementById('feed'); if (!el) return;
    if (!r.ok) { el.innerHTML = emptyState('users', 'Sign in to see this feed', r.error, '<a class="btn sm" href="/signin?next=/community">Sign in</a>'); return; }
    el.innerHTML = r.items.length ? r.items.map(it => {
      const u = it.user;
      const head = it.kind === 'announcement' ? `<img src="/assets/brand/hub-mark.svg" alt="" style="width:38px;height:38px;object-fit:contain"><div><b>TrapTech Admin${demoTag(it.is_demo)}</b><span>${ago(it.created_at)}</span></div>`
        : u ? `<a href="/u/${encodeURIComponent(u.username)}" class="ph-av">${framed(u.username, u.demo, u.cos)}</a><div>${pname(u.username, u.demo, u.cos)}<span>${it.kind === 'winner' ? 'Giveaway Winner' : ({ levelup: 'Level up', streak: 'Streak', tournament: 'Tournament', achievement: 'Achievement', highscore: 'High score' }[it.type] || 'Hub Activity')} • ${ago(it.created_at)}</span></div>`
        : `<span class="av" style="background:linear-gradient(135deg,#7c3aed,#22d3ee)">${icon('zap')}</span><div><b>Hub Activity${demoTag(it.is_demo)}</b><span>${ago(it.created_at)}</span></div>`;
      return `<div class="card post ${it.kind} ${u ? 'has-bn' : ''}">${u ? `<span class="post-bn bn-${esc(u.cos.banner)}"></span>` : ''}
      <div class="ph">${head}</div>
      <p>${it.kind === 'winner' ? `<span class="crown">${icon('crown')}</span> ` : ''}<b>${esc(it.title)}</b>${it.body ? `<br>${esc(it.body)}` : ''}</p>
      <div class="post-f"><button class="hype ${it.mine ? 'on' : ''}" data-key="${esc(it.key)}">${icon('flame')} <span>${it.hype || ''}</span> Hype</button></div></div>`;
    }).join('') : `<div class="card">${tab === 'following' ? emptyState('user-plus', 'Nothing from people you follow yet', 'Follow players from the leaderboard or their profile to see their wins, high scores and level-ups here.', '<a class="btn sm" href="/leaderboard">Find players</a>') : emptyState('inbox', 'Nothing here yet', 'Check back soon.')}</div>`;
  }
  document.getElementById('ct').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (!b) return; tab = b.dataset.k; document.querySelectorAll('#ct button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); }); load(); });
  document.getElementById('feed').addEventListener('click', async (e) => {
    const b = e.target.closest('.hype'); if (!b) return;
    if (!S.me) return toast('Sign in to hype posts');
    const r = await api('/api/community/react', { method: 'POST', body: { key: b.dataset.key } });
    if (!r.ok) return toast(r.error);
    b.classList.toggle('on', r.mine); b.querySelector('span').textContent = r.hype || ''; achToast(r.unlocked);
  });
  load();
});


// =====================================================================================
// v3: daily quests + streaks, seasons, tournaments, notifications, search, invites, share
// pages, legal pages, About Trap Tech, settings. Points / cosmetics only, no cash value.
// =====================================================================================
const xpBar = (lv, cls = '') => `<span class="xpbar ${cls}" role="progressbar" aria-valuemin="0" aria-valuemax="${lv.need}" aria-valuenow="${lv.into}" aria-label="Level ${lv.level} progress"><i style="width:${Math.min(100, Math.round(lv.into / lv.need * 100))}%"></i></span>`;
function questRow(q) {
  const pct = Math.min(100, Math.round(q.value / q.n * 100));
  return `<div class="quest ${q.claimed ? 'claimed' : q.done ? 'ready' : ''}" data-q="${q.idx}">
    <span class="q-ic">${icon(q.claimed ? 'check' : q.icon || 'target')}</span>
    <div class="q-body"><b>${esc(q.text)}</b><div class="bar"><i style="width:${pct}%"></i></div><span class="tiny muted">${fmt(q.value)} / ${fmt(q.n)}</span></div>
    ${q.claimed ? `<span class="q-xp done">+${q.xp} XP</span>` : q.done ? `<button class="btn sm q-claim" data-claim="${q.idx}">Claim +${q.xp}</button>` : `<span class="q-xp">+${q.xp} XP</span>`}
  </div>`;
}
function dailyPanel(q) {
  const lv = q.level, st = q.streak; const done = q.quests.filter(x => x.claimed).length;
  return `<div class="card daily" id="daily">
    <div class="daily-top">
      <a class="streak-big ${st.checked_today ? 'on' : ''}" href="/quests" aria-label="${st.current}-day streak">${icon('flame')}<b>${st.current}</b><span>day streak</span></a>
      <div class="lvl"><div class="lvl-h"><b>Level ${lv.level}</b><span class="tiny muted">${fmt(lv.into)} / ${fmt(lv.need)} XP</span></div>${xpBar(lv)}</div>
    </div>
    <div class="panel-h" style="padding:6px 2px 0"><h2 style="font-size:.9rem">${icon('scroll-text')} Daily quests <span class="muted tiny">${done}/3</span></h2><a class="small" href="/quests">All quests</a></div>
    <div class="quests">${q.quests.map(questRow).join('')}</div>
  </div>`;
}
function wireDaily(root = document) {
  root.querySelectorAll('[data-claim]').forEach(b => b.onclick = async () => {
    b.disabled = true; const r = await api(`/api/quests/${b.dataset.claim}/claim`, { method: 'POST' });
    if (!r.ok) { b.disabled = false; return toast(r.error); }
    toast(`+${r.xp} XP claimed!`); achToast(r.unlocked); S.me.level = r.level;
    const row = b.closest('.quest'); if (row) { row.classList.remove('ready'); row.classList.add('claimed', 'pop'); row.querySelector('.q-ic').innerHTML = icon('check'); b.outerHTML = `<span class="q-xp done">+${r.xp} XP</span>`; }
    if (r.bonus && r.bonus.ready && !r.bonus.claimed) { const bb = document.getElementById('bonus'); if (bb) bb.outerHTML = bonusRow(r.bonus); wireDaily(); }
  });
}
const bonusRow = (b) => `<div class="quest bonus ${b.claimed ? 'claimed' : b.ready ? 'ready' : ''}" id="bonus"><span class="q-ic">${icon(b.claimed ? 'check' : 'sparkles')}</span><div class="q-body"><b>${esc(b.text)}</b><span class="tiny muted">Daily bonus</span></div>${b.claimed ? `<span class="q-xp done">+${b.xp} XP</span>` : b.ready ? `<button class="btn sm q-claim" data-claim="3">Claim +${b.xp}</button>` : `<span class="q-xp">+${b.xp} XP</span>`}</div>`;
async function doCheckin() {
  const r = await api('/api/checkin', { method: 'POST' }); if (!r.ok || !r.streak.fresh) return;
  S.me.streak = r.streak; S.me.level = r.level;
  toast(`Daily check-in: +${r.xp} XP • ${r.streak.current}-day streak ${r.streak.current >= 3 ? '🔥' : ''}`, 3200); achToast(r.unlocked);
  const sb = document.querySelector('.streak-big'); if (sb) { sb.classList.add('on', 'pop'); sb.querySelector('b').textContent = r.streak.current; }
}
async function shareLink({ kind, ref, url, title, text, withRef }) {
  let full = location.origin + url;
  if (S.me) { const r = await api('/api/share', { method: 'POST', body: { kind, ref } }); if (r.ok) { achToast(r.unlocked); if (withRef && r.ref_code) full += (full.includes('?') ? '&' : '?') + 'ref=' + r.ref_code; } }
  try { if (navigator.share) { await navigator.share({ title, text, url: full }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  if (await copyText(full)) toast('Link copied - share it anywhere!');
}
async function followSheet(username, type) {
  const r = await api(`/api/follows/${encodeURIComponent(username)}?type=${type}`);
  const d = document.createElement('div'); d.className = 'sheet'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', type);
  d.innerHTML = `<div class="sheet-in card"><div class="panel-h"><h2>${type === 'following' ? 'Following' : 'Followers'}</h2><button class="iconbtn" data-x aria-label="Close">${icon('x')}</button></div>
    <div class="sheet-list">${r.ok && r.users.length ? r.users.map(u => `<div class="mini-row">${whoHTML(u)}</div>`).join('') : emptyState('users', type === 'following' ? 'Not following anyone yet' : 'No followers yet')}</div></div>`;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-x]') || e.target.closest('a')) d.remove(); });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.remove(); });
  document.body.appendChild(d); d.querySelector('[data-x]').focus();
}
const T_STATUS = { upcoming: ['Upcoming', ''], live: ['Live', 'green'], qualifying: ['Qualifying', 'green'], quarterfinals: ['Quarterfinals', 'green'], semifinals: ['Semifinals', 'green'], final: ['Final', 'green'], ended: ['Ended', 'red'] };
function tCard(t) {
  const [lbl, cls] = T_STATUS[t.status] || ['', ''];
  const target = t.status === 'upcoming' ? t.start_at : t.format === 'bracket' && t.status === 'qualifying' ? t.qual_end_at : t.end_at;
  return `<a class="card t-card" href="/tournaments/${t.id}">
    <div class="t-art" style="background-image:url('${esc(t.art)}')"><span class="pill ${cls}">${t.status !== 'upcoming' && t.status !== 'ended' ? '<i class="live-dot"></i>' : ''}${lbl}</span></div>
    <div class="t-body"><div class="tiny muted orb">${t.format === 'bracket' ? 'BRACKET' : 'TIMED'} • ${esc(t.game)}</div><b>${esc(t.title)}${demoTag(t.demo)}</b>
    <div class="small muted">${t.status === 'ended' ? `Ended ${ago(t.end_at)}` : `${t.status === 'upcoming' ? 'Starts' : t.status === 'qualifying' ? 'Qualifying ends' : 'Ends'} in <span class="cd-inline" data-cdi="${target}">--</span>`}</div>
    <div class="t-meta">${t.leader ? `<span>${icon('crown')} ${esc(t.leader.username)}</span>` : '<span class="muted">No scores yet</span>'}<span>${icon('users')} ${fmt(t.players)}</span></div></div></a>`;
}
function tickInline() { document.querySelectorAll('[data-cdi]').forEach(el => { let s = Math.max(0, Math.floor((+el.dataset.cdi - nowS()) / 1000)); const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60); el.textContent = d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m ${s % 60}s`; }); }
setInterval(tickInline, 1000);
const needSignIn = (path, what) => shell(path, `<div class="narrow">${emptyState('log-in', `Sign in to see ${what}`, 'Create a free account to track your progress. 21+.', `<div class="btn-row"><a class="btn sm" href="/signin?next=${encodeURIComponent(path)}">Sign in</a><a class="btn sm ghost" href="/signup?next=${encodeURIComponent(path)}">Create account</a></div>`)}</div>`);
const pageHead = (title, sub = '', back = true) => `<div class="page-head">${back ? `<button class="iconbtn" data-act="back" aria-label="Back">${icon('chevron-left')}</button>` : ''}<div><h1>${title}</h1>${sub ? `<p class="muted small">${sub}</p>` : ''}</div></div>`;

// ---------------- daily quests + streak ----------------
route(/^\/quests$/, async () => {
  if (!S.me) return needSignIn('/quests', 'your daily quests');
  const q = await api('/api/quests'); if (!q.ok) return shell('/quests', emptyState('triangle-alert', 'Could not load quests', q.error));
  const st = q.streak, lv = q.level;
  const week = Array.from({ length: 7 }, (_, i) => i < Math.min(7, st.current) ? 'on' : '');
  shell('/quests', `<div class="narrow">${pageHead('Daily Quests', 'New quests every day at midnight ET. Points and XP only - no cash value.')}
    <div class="card pad streak-card">
      <div class="sc-top"><div class="streak-big ${st.checked_today ? 'on' : ''}">${icon('flame')}<b>${st.current}</b><span>day streak</span></div>
        <div style="flex:1"><b>${st.checked_today ? "You're checked in today" : 'Check in to keep your streak'}</b><div class="small muted">Best streak: ${st.best} days • check-ins earn 20-50 XP</div>
        <div class="week">${week.map((w, i) => `<span class="${w}" aria-label="Day ${i + 1}">${icon(w ? 'flame' : 'circle-dot')}</span>`).join('')}</div></div></div>
      ${st.checked_today ? '' : `<button class="btn block" id="ci">${icon('calendar-check')} Check in</button>`}
    </div>
    <div class="card pad"><div class="lvl-h"><b>Level ${lv.level}</b><span class="small muted">${fmt(lv.into)} / ${fmt(lv.need)} XP to level ${lv.level + 1}</span></div>${xpBar(lv)}
      <div class="tiny muted" style="margin-top:8px">XP sources: every run (+10, +10 per Bronze/Silver/Gold tier reached), quests, daily check-ins and achievements.</div></div>
    <div class="section-h"><h2>${icon('scroll-text')} Today's quests</h2><span class="small muted">Resets in <span data-cdi="${q.resets_at}">--</span></span></div>
    <div class="card pad quests">${q.quests.map(questRow).join('')}${bonusRow(q.bonus)}</div>
    <div class="streak-rewards card pad"><h2>${icon('award')} Streak & quest rewards</h2>
      <div class="rw-grid">${[['Early Bird', '3-day streak', 'calendar-check'], ['Habit Former', '7-day streak + Daily Sunrise banner', 'sunrise'], ['Eternal Flame', '30-day streak frame + banner', 'flame'], ['Questor', 'Claim 1 quest', 'scroll-text'], ['Quest Legend', '25 quests + Quest Map banner', 'map']].map(([n, d, ic]) => `<div class="rw">${icon(ic)}<b>${n}</b><span>${d}</span></div>`).join('')}</div>
      <p class="tiny muted" style="margin:10px 0 0">${icon('shield')} Cosmetic only, no cash value.</p></div>
  </div>`);
  wireDaily(); tickInline();
  const ci = document.getElementById('ci'); if (ci) ci.onclick = async () => { ci.disabled = true; await doCheckin(); go('/quests', true); };
});

// ---------------- season pass ----------------
route(/^\/season$/, async () => {
  const r = await api('/api/season'); const s = r.season;
  const days = Math.max(0, Math.ceil((s.end_at - nowS()) / 864e5));
  shell('/season', `<div class="narrow wide">
    <div class="season-hero card">
      <div class="sh-bg bn-season-one"></div>
      <div class="sh-in"><div class="tiny orb" style="color:var(--gold)">SEASON ${s.number}</div><h1>${esc(s.name)}</h1>
        <p class="small">${new Date(s.start_at).toLocaleDateString()} - ${new Date(s.end_at).toLocaleDateString()} • ${days} days left</p>
        ${r.signed_in ? `<div class="sh-tier"><b>Tier ${s.tier}</b><span>/ ${s.tiers}</span></div><div class="xpbar lg"><i style="width:${s.tier >= s.tiers ? 100 : Math.round(s.into / s.tier_xp * 100)}%"></i></div><div class="tiny">${fmt(s.xp)} season XP • ${s.tier >= s.tiers ? 'Track complete!' : `${fmt(s.tier_xp - s.into)} XP to tier ${s.tier + 1}`}</div>`
          : `<a class="btn sm" href="/signup?next=/season">Sign up to start earning</a>`}
      </div></div>
    <div class="nocash">${icon('shield')} <span><b>Free track only.</b> There is no paid pass. Every tier is earned by playing, and rewards are cosmetic with no cash value.</span></div>
    <div class="section-h"><h2>${icon('list-checks')} Reward track</h2><span class="small muted">${s.tier_xp} XP per tier</span></div>
    <div class="track" role="list">${s.track.map(t => `<div class="tier ${t.unlocked ? 'on' : ''} ${t.reward ? 'rw' : ''}" role="listitem"><span class="tn">${t.tier}</span>${t.reward ? `<span class="tr">${icon(t.reward.startsWith('Banner') ? 'image' : t.reward.startsWith('Frame') ? 'circle-dot' : 'award')}<em>${esc(t.reward)}</em></span>` : `<span class="tr dim">${icon(t.unlocked ? 'check' : 'lock')}</span>`}</div>`).join('')}</div>
    <div class="season-grid">
      <div class="card pad"><h2 style="margin-bottom:8px">How to earn season XP</h2>
        <ul class="ttb-list"><li>${icon('gamepad-2')} Finish any run: +10 XP, +10 per tier reached</li><li>${icon('scroll-text')} Claim daily quests: +40-120 XP, +100 bonus</li><li>${icon('flame')} Daily check-in: +20-50 XP</li><li>${icon('medal')} Unlock achievements: +25-400 XP</li></ul>
        <div class="btn-row"><a class="btn sm" href="/quests">Daily quests</a><a class="btn sm ghost" href="/games">Play</a></div></div>
      <div class="card"><div class="panel-h"><h2>${icon('trophy')} Season leaderboard</h2></div>
        ${r.board.length ? `<table class="lb"><tbody>${r.board.slice(0, 15).map(x => `<tr class="${S.me && x.username === S.me.username ? 'me' : ''}"><td class="rk">${x.rank}</td><td>${whoHTML(x)}</td><td class="sc">${fmt(x.score)} XP<div class="tiny muted">Tier ${x.tier}</div></td></tr>`).join('')}</tbody></table>` : emptyState('trophy', 'No season XP yet', 'Play a run to get on the board.')}</div>
    </div></div>`);
});

// ---------------- tournaments ----------------
route(/^\/tournaments$/, async () => {
  const r = await api('/api/tournaments'); const list = r.ok ? r.tournaments : [];
  const live = list.filter(t => !['upcoming', 'ended'].includes(t.status)), up = list.filter(t => t.status === 'upcoming'), past = list.filter(t => t.status === 'ended');
  const sec = (title, arr, ic) => arr.length ? `<div class="section-h"><h2>${icon(ic)} ${title}</h2></div><div class="t-grid">${arr.map(tCard).join('')}</div>` : '';
  shell('/tournaments', `<div class="narrow wide">${pageHead('Tournaments', 'Free to enter. Play during the window - your best run counts. Cosmetic prizes only.', false)}
    <div class="t-explain"><div class="card pad"><b>${icon('clock')} Timed events</b><p class="small muted">Best single score between the start and end wins. Top 3 earn the Finalist title.</p></div>
      <div class="card pad"><b>${icon('network')} Brackets</b><p class="small muted">Qualify with your best run, then the top 8 go head-to-head in async knockout rounds.</p></div></div>
    ${sec('Live now', live, 'zap')}${sec('Upcoming', up, 'calendar-days')}${sec('Finished', past, 'flag')}
    ${!list.length ? emptyState('swords', 'No tournaments scheduled', 'Check back soon - new events drop regularly.', '<a class="btn sm" href="/games">Practice now</a>') : ''}
  </div>`);
  tickInline();
});
route(/^\/tournaments\/(\d+)$/, async (m) => {
  const r = await api('/api/tournaments/' + m[1]); if (!r.ok) return shell('/tournaments', emptyState('swords', 'Tournament not found', '', '<a class="btn sm" href="/tournaments">All tournaments</a>'));
  const t = r.tournament; const [lbl, cls] = T_STATUS[t.status] || ['', ''];
  const sc = (n) => n === null || n === undefined ? '-' : fmtScore(n, t.game_id);
  const open = !['upcoming', 'ended'].includes(t.status);
  const target = t.status === 'upcoming' ? t.start_at : t.format === 'bracket' && t.status === 'qualifying' ? t.qual_end_at : t.end_at;
  const side = (p, w, tbd) => p ? `<div class="bk-p ${w ? 'win' : ''}"><span class="seed">${p.seed}</span>${framed(p.username, p.demo, p.cos, 'xs')}<span class="bk-n" title="${esc(p.username)}">${esc(p.username)}</span><span class="bk-s">${p.score === null || p.score === undefined ? '-' : fmt(p.score)}</span></div>` : `<div class="bk-p bye"><span class="seed">-</span><span class="bk-n muted">${tbd ? 'TBD' : 'Bye'}</span></div>`;
  const bracket = t.bracket ? (t.bracket.rounds.length ? `<div class="bracket">${t.bracket.rounds.map(rd => `<div class="bk-round"><div class="bk-h">${rd.name}<span class="pill ${rd.state === 'live' ? 'green' : ''}">${rd.state === 'live' ? 'LIVE' : rd.state === 'done' ? 'DONE' : 'SOON'}</span></div>${rd.matches.map(mt => `<div class="bk-m ${mt.tbd ? 'tbd' : ''}">${side(mt.a, mt.winner === 'a', mt.tbd)}${side(mt.b, mt.winner === 'b', mt.tbd)}</div>`).join('')}</div>`).join('')}${t.bracket.champion ? `<div class="bk-round champ"><div class="bk-h">Champion</div><div class="bk-m">${whoHTML(t.bracket.champion)}</div></div>` : ''}</div>`
    : emptyState('network', 'Bracket starts after qualifying', 'The top 8 qualifiers are seeded into the bracket.')) : '';
  const board = (rows, title) => `<div class="card"><div class="panel-h"><h2>${title}</h2><span class="small muted">${fmt(rows.length)} players</span></div>${rows.length ? `<table class="lb"><tbody>${rows.map(x => `<tr class="${S.me && x.username === S.me.username ? 'me' : ''}"><td class="rk">${x.rank <= 3 ? ['🥇', '🥈', '🥉'][x.rank - 1] : x.rank}</td><td>${whoHTML(x)}</td><td class="sc">${sc(x.score)}</td></tr>`).join('')}</tbody></table>` : emptyState('trophy', 'No scores yet', 'Be the first to post a score.')}</div>`;
  shell('/tournaments', `<div class="narrow wide">
    <div class="t-hero card" style="--art:url('${esc(t.art)}')">
      <div class="t-hero-in">${pageHead(esc(t.title) + demoTag(t.demo), `${t.format === 'bracket' ? 'Bracket' : 'Timed'} tournament • ${esc(t.game)}`)}
        <div class="t-hero-row"><span class="pill ${cls}">${open ? '<i class="live-dot"></i>' : ''}${lbl}</span><span class="small">${icon('users')} ${fmt(t.players)} players</span>${t.prize ? `<span class="small">${icon('award')} ${esc(t.prize)}</span>` : ''}</div>
        ${t.status !== 'ended' ? `<div class="small muted" style="margin:6px 0 4px">${t.status === 'upcoming' ? 'Starts in' : t.status === 'qualifying' ? 'Qualifying ends in' : 'Ends in'}</div>${cdHTML(target)}` : ''}
        <div class="btn-row">${open && (t.format !== 'bracket' || t.status === 'qualifying' || (t.me && t.bracket && t.bracket.seeds.some(s0 => s0.username === S.me.username))) ? `<a class="btn" href="${S.me ? `/play/${t.game_id}` : `/signin?next=/play/${t.game_id}`}">${icon('play')} Play ${esc(t.game)}</a>` : ''}<button class="btn ghost" id="share-t">${icon('share-2')} Share</button></div>
        ${t.me ? `<div class="ok-msg" style="margin-top:10px">You're in! ${t.format === 'bracket' ? 'Qualifying' : 'Current'} rank #${t.me.rank} with ${sc(t.me.score)}.</div>` : ''}
      </div></div>
    ${t.description ? `<p class="muted">${esc(t.description)}</p>` : ''}
    ${t.format === 'bracket' ? `<div class="section-h"><h2>${icon('network')} Bracket</h2></div>${bracket}<div class="section-h"><h2>Qualifying</h2></div>${board(t.qualifying, 'Qualifying board')}` : board(t.board, 'Leaderboard')}
    <p class="tiny muted center" style="margin-top:12px">Only runs started and finished inside the window count. Ties go to the earlier score (brackets: higher seed). Prizes are cosmetic and have no cash value. Operated by Trap Tech Solutions.</p>
  </div>`, { title: t.title });
  tickCountdowns();
  document.getElementById('share-t').onclick = () => shareLink({ kind: 'tournament', ref: String(t.id), url: `/tournaments/${t.id}`, title: t.title, text: `Join the ${t.title} on The Gaming Hub - free entry!`, withRef: true });
});

// ---------------- notifications ----------------
route(/^\/notifications$/, async () => {
  if (!S.me) return needSignIn('/notifications', 'your notifications');
  const r = await api('/api/notifications');
  shell('/notifications', `<div class="narrow">${pageHead('Notifications', '', true)}
    <div class="row-between"><span class="small muted">${fmt(r.unread)} unread</span>${r.items.length ? '<button class="btn sm ghost" id="readall">Mark all read</button>' : ''}</div>
    <div class="card notif-list" id="nl">${r.items.length ? r.items.map(n => `<a class="notif ${n.unread ? 'unread' : ''}" href="${esc(n.link || '#')}" data-n="${n.id}" data-b="${n.broadcast ? 1 : 0}"><span class="n-ic t-${esc(n.type)}">${icon(n.icon || 'bell')}</span><span class="n-b"><b>${esc(n.title)}</b>${n.body ? `<span>${esc(n.body)}</span>` : ''}<em>${ago(n.created_at)}${n.broadcast ? ' • Everyone' : ''}</em></span>${n.unread ? '<i class="udot" aria-label="Unread"></i>' : ''}</a>`).join('')
      : emptyState('bell-off', "You're all caught up", 'Follows, achievements, level-ups, giveaway wins and new tournaments show up here.')}</div></div>`);
  const ra = document.getElementById('readall');
  if (ra) ra.onclick = async () => { const x = await api('/api/notifications/read', { method: 'POST', body: {} }); S.me.unread = x.unread; document.querySelectorAll('.notif.unread').forEach(n => { n.classList.remove('unread'); const d = n.querySelector('.udot'); if (d) d.remove(); }); updateBell(); toast('All caught up'); };
  document.getElementById('nl').addEventListener('click', (e) => { const a = e.target.closest('.notif'); if (a && a.dataset.b === '0' && a.classList.contains('unread')) { api('/api/notifications/read', { method: 'POST', body: { id: +a.dataset.n } }); S.me.unread = Math.max(0, (S.me.unread || 1) - 1); } });
});

// ---------------- search ----------------
route(/^\/search$/, (m, url) => {
  const q0 = url.searchParams.get('q') || '';
  shell('/search', `<div class="narrow">${pageHead('Search', 'Games, players, giveaways and tournaments')}
    <form id="sf" role="search" class="field ic search-big">${icon('search')}<input class="input" id="sq" type="search" placeholder="Search The Gaming Hub" value="${esc(q0)}" aria-label="Search" autocomplete="off"></form>
    <div id="sr" aria-live="polite"></div></div>`);
  const inp = document.getElementById('sq'); const out = document.getElementById('sr'); let tmr = null, seq = 0;
  async function run() {
    const q = inp.value.trim(); history.replaceState({}, '', q ? `/search?q=${encodeURIComponent(q)}` : '/search');
    if (!q) { out.innerHTML = `<div class="chips" style="padding:6px 0">${['Drift', 'Plinko', 'Giveaway', 'Cup', 'Terp'].map(x => `<button class="chip" data-s="${x}">${x}</button>`).join('')}</div>`; return; }
    const my = ++seq; const r = await api('/api/search?q=' + encodeURIComponent(q)); if (my !== seq) return;
    const grp = (title, items, fn) => items.length ? `<div class="section-h"><h2>${title}</h2><span class="small muted">${items.length}</span></div><div class="card sr-list">${items.map(fn).join('')}</div>` : '';
    const html = grp('Games', r.games, g => `<a class="sr-row" href="/games/${g.id}"><img src="${esc(g.art)}" alt="" class="gthumb"><b>${esc(g.title)}</b><span class="muted small">${esc(g.category)}</span></a>`)
      + grp('Players', r.players, u => `<div class="sr-row">${whoHTML(u)}</div>`)
      + grp('Giveaways', r.giveaways, g => `<a class="sr-row" href="/giveaways/${g.id}">${icon('gift')}<b>${esc(g.title)}</b><span class="muted small">by ${esc(g.host)}</span></a>`)
      + grp('Tournaments', r.tournaments, t => `<a class="sr-row" href="/tournaments/${t.id}">${icon('swords')}<b>${esc(t.title)}</b><span class="muted small">${esc(gameById(t.game_id)?.title || '')}</span></a>`);
    out.innerHTML = html || emptyState('search', `No results for "${esc(q)}"`, 'Try a game name, a player or a brand.');
  }
  inp.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(run, 180); });
  document.getElementById('sf').addEventListener('submit', (e) => { e.preventDefault(); run(); });
  out.addEventListener('click', (e) => { const c = e.target.closest('[data-s]'); if (c) { inp.value = c.dataset.s; run(); } });
  run(); inp.focus();
});

// ---------------- invite friends (referrals) ----------------
route(/^\/invite$/, async () => {
  if (!S.me) return needSignIn('/invite', 'your invite code');
  const r = await api('/api/referral'); const link = location.origin + r.link;
  shell('/invite', `<div class="narrow">${pageHead('Invite Friends', 'Bring your crew - earn exclusive cosmetics.')}
    <div class="card pad invite-card glow-purple">
      <div class="tiny muted orb">YOUR INVITE CODE</div><div class="ref-code" id="refcode">${esc(r.code)}</div>
      <div class="field ic copy-field">${icon('link')}<input class="input" id="reflink" value="${esc(link)}" readonly aria-label="Invite link"><button class="btn sm" id="copy">${icon('copy')} Copy</button></div>
      <button class="btn block" id="share-inv">${icon('share-2')} Share invite</button>
      <div class="inv-stats"><div><b>${fmt(r.joined)}</b><span>joined</span></div><div><b>${fmt(r.counted)}</b><span>counted</span></div></div>
    </div>
    <div class="card pad"><h2 style="margin-bottom:8px">How it works</h2>
      <ol class="steps"><li>Share your link or code with friends (21+).</li><li>They sign up with your code.</li><li>It counts once they finish their first scored run.</li></ol>
      <div class="rw-grid">${[['Newcomer', 'Your friend gets a title', 'handshake'], ['Recruiter', '1 friend: title + Recruiter Beacon banner', 'gift'], ['Ambassador', '5 friends: title + Crew Colors banner', 'megaphone']].map(([n, d, ic]) => `<div class="rw">${icon(ic)}<b>${n}</b><span>${d}</span></div>`).join('')}</div>
      <p class="tiny muted" style="margin:10px 0 0">${icon('shield')} Cosmetic only, no cash value. Self-referrals, duplicate or fake accounts are removed.</p></div>
    ${r.friends.length ? `<div class="section-h"><h2>Your invites</h2></div><div class="card">${r.friends.map(f => `<div class="mini-row"><a href="/u/${encodeURIComponent(f.username)}"><b>${esc(f.username)}</b></a><span class="s small ${f.counted ? '' : 'muted'}">${f.counted ? icon('check') + ' Counted' : 'Waiting for first run'}</span></div>`).join('')}</div>` : ''}
  </div>`);
  document.getElementById('copy').onclick = async () => { if (await copyText(link, 'Copy your invite link')) toast('Invite link copied'); };
  document.getElementById('share-inv').onclick = () => shareLink({ kind: 'invite', ref: r.code, url: r.link, title: 'Join me on The Gaming Hub', text: `Play free games and win brand giveaways with me. Use my code ${r.code}!` });
});

// ---------------- share page for a run (/s/:id) ----------------
route(/^\/s\/(\d+)$/, async (m) => {
  const r = await api('/api/runs/' + m[1]); if (!r.ok) return shell('/s', emptyState('image', 'Score not found', '', '<a class="btn sm" href="/games">Play games</a>'));
  const x = r.run; const p = x.player;
  shell('/s', `<div class="narrow">
    <div class="share-card card bn-${esc(p.cos.banner)}">
      <div class="shc-in"><img src="/assets/brand/hub-logo.svg" alt="The Gaming Hub" width="170" height="40">
        <div class="tiny orb" style="color:var(--cyan);margin-top:14px">${esc(x.game.toUpperCase())}</div>
        <div class="shc-score">${esc(x.score_text)}</div>
        <div class="shc-who">${framed(p.username, p.demo, p.cos)}${pname(p.username, p.demo, p.cos)}</div>
        <div class="shc-rank">${x.rank ? `#${x.rank} of ${fmt(x.players)} players` : ''}${x.personal_best ? ' • personal best' : ''}</div>
        <div class="tiny muted">${new Date(x.created_at).toLocaleString()}</div>
        <img class="shc-art" src="${esc(x.art)}" alt="">
      </div></div>
    <div class="btn-row center-row"><a class="btn" href="/play/${x.game_id}">${icon('play')} Beat this score</a><button class="btn ghost" id="share-s">${icon('share-2')} Share</button><a class="btn ghost" href="/og/run/${x.id}.png" target="_blank" rel="noopener">${icon('download')} Image</a></div>
    ${!S.me ? `<div class="card pad cta-card" style="margin-top:14px"><div style="flex:1"><b>New here?</b><div class="small muted">Free to play, 21+. Sign up and your scores count for giveaways.</div></div><a class="btn sm" href="/signup">Sign up</a></div>` : ''}
  </div>`, { title: `${p.username}: ${x.score_text} in ${x.game}` });
  document.getElementById('share-s').onclick = () => shareLink({ kind: 'run', ref: String(x.id), url: `/s/${x.id}`, title: `${p.username} scored ${x.score_text} in ${x.game}`, text: 'Can you beat it?' });
});

// ---------------- legal ----------------
const legal = (path, title, updated, body, docTitle) => shell(path, `<div class="narrow legal">${pageHead(title, `Last updated ${updated}`)}<article class="card pad prose">${body}</article>
  <p class="tiny muted center">The Gaming Hub is designed, built and operated by Trap Tech Solutions. <a href="/about">About Trap Tech</a></p></div>`, { title: docTitle || title });
const OP = 'Trap Tech Solutions';
route(/^\/terms$/, () => legal('/terms', 'Terms of Service', 'October 3, 2026', `
  <p>These Terms govern your use of The Gaming Hub (the "Hub"), operated by <b>${OP}</b> ("we", "us"). By creating an account or using the Hub you agree to these Terms, our <a href="/privacy">Privacy Policy</a> and the <a href="/rules">Official Giveaway Rules</a>.</p>
  <h2>1. Eligibility (21+)</h2><p>You must be at least <b>21 years old</b> to use the Hub. The Hub features sponsors from the cannabis industry. We may ask winners to verify their age and identity before a prize is awarded.</p>
  <h2>2. Your account</h2><p>One account per person. Keep your password private; you are responsible for activity on your account. Usernames must not impersonate others or be offensive.</p>
  <h2>3. Free to play, points only</h2><p>The Hub is free. Scores, points, XP, levels, streaks, season tiers, badges, banners, frames and titles are <b>for entertainment only, have no cash value</b>, and cannot be bought, sold, traded or redeemed for money. Casino-style games (Plinko, Spin to Win, Blazed Roulette) use free points only. No real-money wagering takes place on the Hub.</p>
  <h2>4. Giveaways & tournaments</h2><p>Giveaways are free to enter. <b>No purchase necessary.</b> Each giveaway is subject to the <a href="/rules">Official Rules</a> and any extra rules shown on its page. Tournament prizes are cosmetic unless a giveaway page says otherwise.</p>
  <h2>5. Fair play</h2><p>No cheating, bots, scripts, exploits, score tampering, multiple accounts or self-referrals. We use server-side checks and may remove scores, entries, rewards or accounts that break these rules.</p>
  <h2>6. Community</h2><p>Be respectful. We may remove content or suspend accounts that harass others, share illegal content or promote sales of regulated products.</p>
  <h2>7. Sponsors</h2><p>Sponsors can be any legitimate business or creator. Every sponsor must comply with all laws and regulations that apply to its business, products and advertising, and is responsible for its prizes as described on the giveaway page. Sponsors that sell cannabis products must be licensed and legally permitted to operate and advertise in their jurisdiction; Trap Tech does not accept unlicensed sellers. Sponsor content is for adults 21+ in locations where such content is legal.</p>
  <h2>8. Disclaimers & liability</h2><p>The Hub is provided "as is". To the extent allowed by law, ${OP} is not liable for indirect or consequential damages, lost data or service interruptions.</p>
  <h2>9. Changes</h2><p>We may update these Terms. We will post the new date above; continued use means you accept the update.</p>
  <h2>10. Contact</h2><p>Questions? Contact ${OP} via the <a href="/book">contact form</a>.</p>
  <p class="tiny muted">Template provided by ${OP}. Have counsel review before relying on it.</p>`));
route(/^\/privacy$/, () => legal('/privacy', 'Privacy Policy', 'October 3, 2026', `
  <p>${OP} operates The Gaming Hub. This policy explains what we collect and why.</p>
  <h2>What we collect</h2><ul><li><b>Account:</b> username, salted password hash, date of birth (to confirm you are 21+), the invite code you used (if any).</li><li><b>Gameplay:</b> runs (game, score, coins, duration, time), achievements, quests, check-ins, follows, reactions and share events.</li><li><b>Security:</b> a one-way salted hash of your IP address for anti-cheat and rate limiting. We do not store your raw IP.</li><li><b>Bookings:</b> the contact details a brand enters in a booking request.</li><li><b>On your device:</b> local storage for preferences (e.g. remembered username, age check, sound). No advertising trackers.</li></ul>
  <h2>How we use it</h2><p>To run the Hub, show leaderboards and profiles, evaluate achievements, prevent cheating, verify giveaway winners and contact winners and brand clients.</p>
  <h2>What is public</h2><p>Your username, equipped cosmetics, scores, level, achievements, followers/following counts and activity (high scores, wins, level-ups) are visible to others. Your date of birth is never shown.</p>
  <h2>Sharing</h2><p>We do not sell your data. When you win a giveaway we may share the details needed to deliver the prize with the sponsor brand.</p>
  <h2>Retention & deletion</h2><p>We keep data while your account is active. Ask us to delete your account at any time and we remove your profile, runs and related data.</p>
  <h2>Age</h2><p>The Hub is for adults 21+. We do not knowingly collect data from anyone under 21.</p>
  <h2>Contact</h2><p>${OP} - via the <a href="/book">contact form</a>.</p>
  <p class="tiny muted">Template provided by ${OP}. Have counsel review before relying on it.</p>`));
function rulesHTML(g) {
  const name = g ? `"${esc(g.title)}"` : '[GIVEAWAY NAME]';
  const sponsor = g ? esc(g.host) : '[SPONSOR BRAND]';
  const when = (ms) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'long', timeStyle: 'short' }) + ' ET';
  const period = g ? `${when(g.start_at)} through ${when(g.end_at)}` : '[START DATE/TIME ET] through [END DATE/TIME ET]';
  const games = g ? esc(g.game_title) : '[LINKED GAME(S)]';
  const nW = g ? (g.winner_count || 1) : 0;
  const method = !g ? '[top score ranking / verifiable random draw among eligible entrants], as announced on the giveaway page' : g.win_method === 'random' ? `a verifiable random draw of ${nW} winner${nW > 1 ? 's' : ''} among all eligible entrants (one entry each)` : `final score ranking: the top ${nW} eligible entrant${nW > 1 ? 's' : ''} by best qualifying score win${g.prize_tiers && g.prize_tiers.length ? ', following the prize tiers listed in Section 6' : ''}`;
  const tb = ((g && g.tiebreak_rules) || TB_RULES).map((x, i) => `<li><b>(${'abcd'[i]})</b> ${esc(x)}</li>`).join('');
  return `<p class="npn">NO PURCHASE NECESSARY TO ENTER OR WIN. A PURCHASE WILL NOT IMPROVE YOUR CHANCES OF WINNING. OPEN ONLY TO LEGAL RESIDENTS OF THE 50 UNITED STATES AND D.C. WHO ARE 21 YEARS OF AGE OR OLDER. VOID WHERE PROHIBITED.</p>
  <h2>1. Giveaway, Sponsor and Operator</h2><p>The ${name} giveaway (the "Giveaway") is sponsored by <b>${sponsor}</b> ("Sponsor") and operated and administered by <b>${OP}</b> ("Operator") on The Gaming Hub. Sponsor must comply with all laws and regulations that apply to its business, products, advertising and this Giveaway; sponsors that sell cannabis products must be licensed and legally permitted to operate and advertise in their jurisdiction.</p>
  <h2>2. Eligibility</h2><p>Open to legal residents of the 50 United States and the District of Columbia who are <b>21 or older</b> at the time of entry and have a Gaming Hub account in good standing. Employees of Sponsor and Operator, and their immediate families and household members, are not eligible. Void where prohibited or restricted by law.</p>
  <h2>3. Giveaway Period</h2><p>${period} (the "Giveaway Period"). Operator's server clock is the official timekeeper.</p>
  <h2>4. How to Enter (free)</h2><p>Sign in to a free Gaming Hub account, then start and finish at least one scored run of ${games} during the Giveaway Period${g && g.min_score ? ` with a score of at least ${fmt(g.min_score)}` : ''}. Every game on the Hub is free; there is nothing to buy. Limit: one entry per person/account. Playing more runs can improve your score ranking, but does not create extra entries for random draws. Entries made with scripts, bots, multiple accounts or tampered scores are void.</p>
  <h2>5. Winner Selection and Tiebreakers</h2><p>Winners are determined by ${method}. Each entrant's ranking score is their best qualifying score: runs must start and finish inside the Giveaway Period and meet any minimum score. When several games are linked, it is the sum of the best score in each game. Runs whose score is impossible for their server-measured duration are excluded. Score-based placements depend on the skill shown in valid runs.</p>
  <p id="rules-tiebreak"><b>Tiebreakers, applied in this order:</b></p><ol class="tb-rules plain">${tb}</ol>
  <p><b>Final standings lock:</b> at the end of the Giveaway Period the server automatically saves the final standings (rank, username, best score, run ID, the time that score was reached, and attempts) to a locked record. Scores submitted after the end never change it.</p>
  <p id="rules-random"><b>Random draws:</b> they use a verifiable commit-reveal method. Before the Giveaway Period ends, Operator publishes on the giveaway page the SHA-256 hash ("commitment") of a secret random seed. At the end, the locked entrant list is hashed with SHA-256 and the seed is revealed. Each entrant's draw key is HMAC-SHA256(seed, entrant-list hash + ":" + username), and entrants are drawn in ascending key order. Each eligible entrant appears exactly once, so nobody can be drawn twice. Anyone can recompute the result on the giveaway's results page. Odds of winning a random draw depend on the number of eligible entrants.</p>
  <h2>6. Prizes</h2><p>${g ? `<b>${esc(g.prize || g.title)}</b>${g.prize_tiers && g.prize_tiers.length ? '<br>' + g.prize_tiers.map(esc).join('<br>') : ''}` : '[PRIZE DESCRIPTION]'}. Approximate retail value: [ARV - provided by Sponsor]. No cash alternative or substitution except by Sponsor, which may substitute a prize of equal or greater value. <b>No cannabis, THC, nicotine or alcohol products are awarded as prizes.</b> Winners are responsible for any taxes.</p>
  <h2>7. Winner Notification & Verification</h2><p>Potential winners are notified through their Gaming Hub notifications and must respond within 7 days. They may be required to verify age (21+), identity and eligibility, and to sign an affidavit of eligibility and release where permitted by law. Results show as "Winner pending verification" until Operator confirms them. If a winner can't be reached, doesn't respond, is ineligible, or is disqualified (for example for cheating, multiple accounts or tampered scores), the next eligible entrant in the locked final standings (or the next position in the draw order) moves up. Every confirmation and disqualification is recorded in an audit log.</p>
  <h2>8. General Conditions</h2><p>Operator may disqualify anyone who tampers with the Giveaway or breaks these rules or the <a href="/terms">Terms of Service</a>. If the Giveaway can't run as planned because of fraud, technical failures or other causes beyond Operator's control, Operator may modify, suspend or cancel it and select winners from valid entries received before that point.</p>
  <h2>9. Publicity & Privacy</h2><p>Except where prohibited, winners agree that their username may be shown as a winner on the Hub. Personal data is handled under the <a href="/privacy">Privacy Policy</a> and shared with Sponsor only as needed to deliver prizes.</p>
  <h2>10. Limitation of Liability</h2><p>Sponsor and Operator are not responsible for lost, late or incomplete entries, technical malfunctions, or any injury or damage arising from participation or from accepting or using a prize.</p>
  <h2>11. Winners List</h2><p>Winners and the full final standings are shown on the giveaway's results page after the Giveaway Period ends. For a written winners list, contact ${OP} within 60 days after the Giveaway Period ends.</p>
  <p class="tiny muted">${g ? '' : 'This is the standard template. Each giveaway page links to a version filled in with its sponsor, dates, games and prizes. '}Template provided by ${OP}. Not legal advice. Have counsel review it for each promotion.</p>`;
}
route(/^\/rules$/, () => legal('/rules', 'Official Giveaway Rules', 'October 3, 2026', rulesHTML(null)));
route(/^\/giveaways\/(\d+)\/rules$/, async (m) => {
  const r = await api('/api/giveaways/' + m[1]); if (!r.ok) return shell('/giveaways', emptyState('gift', 'Giveaway not found', '', '<a class="btn sm" href="/giveaways">All giveaways</a>'));
  legal('/giveaways', `Official Rules: ${esc(r.giveaway.title)}`, 'October 3, 2026', rulesHTML(r.giveaway) + `<p><a class="btn sm ghost" href="/giveaways/${r.giveaway.id}">${icon('chevron-left')} Back to giveaway</a></p>`, 'Official Rules: ' + r.giveaway.title);
});
route(/^\/responsible-play$/, () => legal('/responsible-play', 'Responsible Play', 'October 3, 2026', `
  <p>The Gaming Hub is meant to be fun. Here's how we keep it that way:</p>
  <ul><li><b>No real money.</b> There is no wagering on the Hub. Plinko, Spin to Win and Blazed Roulette give you a fixed number of free drops, spins or chips in each run, and you score points only. Points have no cash value and can't be bought.</li>
  <li><b>21+ only.</b> Sponsor content comes from adult brands, including cannabis brands. Please keep the Hub away from minors.</li>
  <li><b>Take breaks.</b> Streaks are a bonus and not a chore. Missing a day only resets the streak counter, and you never lose rewards you've already unlocked.</li>
  <li><b>Consume responsibly.</b> If you use cannabis, follow your local laws. Never drive impaired.</li>
  <li><b>Need help?</b> If gaming or gambling-style games stop being fun, call or text the US National Problem Gambling Helpline at <b>1-800-GAMBLER</b>. For substance-use support, call the SAMHSA National Helpline at <b>1-800-662-4357</b> (free and confidential, 24/7).</li></ul>`));

// ---------------- About Trap Tech Solutions ----------------
route(/^\/about$/, () => shell('/about', `<div class="narrow">
  <div class="about-hero card"><img src="/assets/brand/traptech-stacked.svg" alt="Trap Tech Solutions" width="260" height="78"><h1>We build the games your brand plays.</h1>
    <p class="muted">Trap Tech Solutions is the studio behind The Gaming Hub. We design, build and run every part of it: the games, leaderboards, tournaments, giveaways, achievements and the admin tools brands use.</p>
    <div class="btn-row center-row"><a class="btn" href="/host">${icon('briefcase')} Work with us</a><a class="btn ghost" href="/games">${icon('gamepad-2')} Play our games</a></div></div>
  <div class="about-grid">${[['gamepad-2', 'Original games', '8 original HTML5 games so far, made to play great on phones, with skill-based scoring and server-side anti-cheat.'], ['gift', 'Brand giveaways', 'Basic, Premium and Elite packages, from a simple prize drop to a full 30-day branded takeover.'], ['swords', 'Tournaments & seasons', 'Timed events, async brackets, daily quests and a free season track that keep players coming back.'], ['shield-check', 'Fair & compliant', 'Points only, no purchase necessary, 21+ age gate and official rules for every giveaway, with Trap Tech as operator.']].map(([ic, t, d]) => `<div class="card pad"><span class="es-ic">${icon(ic)}</span><b>${t}</b><p class="small muted">${d}</p></div>`).join('')}</div>
  <div class="card pad"><h2 style="margin-bottom:6px">The Gaming Hub by Trap Tech Solutions</h2><p class="small muted">Version 3 • Built by Trap Tech Solutions. Every game, banner and badge is original work. See <a href="/terms">Terms</a>, <a href="/privacy">Privacy</a>, <a href="/rules">Official Rules</a> and <a href="/responsible-play">Responsible play</a>.</p></div>
</div>`));

// ---------------- settings (mobile "about" lives here too) ----------------
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; const b = document.getElementById('install'); if (b) b.disabled = false; });
route(/^\/settings$/, () => {
  const standalone = matchMedia('(display-mode: standalone)').matches;
  const rm = ls.getItem('gh_reduce_motion') === '1';
  shell('/settings', `<div class="narrow">${pageHead('Settings')}
    ${S.me ? `<div class="card pad"><h2 style="margin-bottom:10px">Account</h2><div class="mini-row" style="margin:0 0 10px">${framed(S.me.username, false, S.me.cos)}${pname(S.me.username, false, S.me.cos)}</div>
      <form id="pwf2"><div id="pwmsg2"></div><div class="field"><input class="input" type="password" id="cur2" placeholder="Current password" autocomplete="current-password" aria-label="Current password"></div>
      <div class="field"><input class="input" type="password" id="np2" placeholder="New password (min 8)" autocomplete="new-password" aria-label="New password"></div>
      <button class="btn ghost block" type="submit">Change password</button></form>
      <button class="btn danger block" data-act="signout" style="margin-top:10px">${icon('log-out')} Sign out</button></div>` : `<div class="card pad cta-card"><div style="flex:1"><b>Not signed in</b><div class="small muted">Sign in to manage your account.</div></div><a class="btn sm" href="/signin?next=/settings">Sign in</a></div>`}
    <div class="card pad"><h2 style="margin-bottom:10px">App</h2>
      <div class="set-row"><div><b>${icon('smartphone')} Install the app</b><div class="small muted">${standalone ? 'Installed - you are using the app.' : 'Add The Gaming Hub to your home screen. Works offline for the app shell.'}</div></div><button class="btn sm" id="install" ${installEvt ? '' : 'disabled'}>${standalone ? 'Installed' : 'Install'}</button></div>
      ${!standalone ? '<p class="tiny muted" style="margin:0 0 8px">On iPhone: tap Share, then "Add to Home Screen".</p>' : ''}
      <div class="set-row"><div><b>${icon('accessibility')} Reduce motion</b><div class="small muted">Turns off decorative animations.</div></div><label class="toggle"><input type="checkbox" id="rm" ${rm ? 'checked' : ''}><span></span></label></div>
    </div>
    <div class="card pad about-mini"><img src="/assets/brand/traptech-stacked.svg" alt="Trap Tech Solutions" width="170" height="51"><div><b>The Gaming Hub v3</b><div class="small muted">Built by Trap Tech Solutions</div></div><a class="btn sm ghost" href="/about">About</a></div>
    <div class="card legal-links">${[['/terms', 'file-text', 'Terms of Service'], ['/privacy', 'shield', 'Privacy Policy'], ['/rules', 'scale', 'Official Giveaway Rules'], ['/responsible-play', 'heart-pulse', 'Responsible play']].map(([h, ic, l]) => `<a class="act-row" href="${h}">${icon(ic)}<span class="g">${l}</span>${icon('chevron-right')}</a>`).join('')}</div>
  </div>`);
  document.getElementById('rm').onchange = (e) => { ls.setItem('gh_reduce_motion', e.target.checked ? '1' : '0'); document.documentElement.classList.toggle('reduce-motion', e.target.checked); };
  const ib = document.getElementById('install'); ib.onclick = async () => { if (!installEvt) return toast('Use your browser menu: "Install app" / "Add to Home Screen"'); installEvt.prompt(); await installEvt.userChoice; installEvt = null; ib.disabled = true; };
  const pf = document.getElementById('pwf2');
  if (pf) pf.addEventListener('submit', async (e) => { e.preventDefault(); const out = document.getElementById('pwmsg2'); const r = await api('/api/auth/password', { method: 'POST', body: { current: document.getElementById('cur2').value, password: document.getElementById('np2').value } }); out.innerHTML = r.ok ? '<div class="ok-msg">Password changed.</div>' : `<div class="err">${esc(r.error)}</div>`; });
});
document.documentElement.classList.toggle('reduce-motion', ls.getItem('gh_reduce_motion') === '1');
// offline banner + service worker (PWA)
function netBanner() { let b = document.getElementById('offline'); if (navigator.onLine) { if (b) b.remove(); return; } if (!b) { b = document.createElement('div'); b.id = 'offline'; b.className = 'offline-bar'; b.setAttribute('role', 'status'); b.innerHTML = `${icon('wifi-off')} You're offline. Scores will save when you reconnect.`; document.body.appendChild(b); } }
addEventListener('online', netBanner); addEventListener('offline', netBanner);
const unlockAudio = () => { try { const AC = window.AudioContext || window.webkitAudioContext; if (AC) { const ac = window.__ghAC || (window.__ghAC = new AC()); if (ac.state === 'suspended') ac.resume(); const b = ac.createBuffer(1, 1, 22050); const src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(0); } } catch {} removeEventListener('pointerdown', unlockAudio, true); removeEventListener('touchend', unlockAudio, true); };
addEventListener('pointerdown', unlockAudio, true); addEventListener('touchend', unlockAudio, true);
if ('serviceWorker' in navigator) addEventListener('load', () => { try { navigator.serviceWorker.register('/sw.js').catch(() => {}); } catch {} });
setInterval(() => { if (S.me && document.visibilityState === 'visible') refreshMe(); }, 60000);

// ---------------- boot ----------------
(async function boot() {
  const [me, games] = await Promise.all([api('/api/me'), api('/api/games')]);
  S.me = me.user; S.games = games.games || [];
  render();
})();

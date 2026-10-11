// v7 admin overhaul, player side: what the giveaway builder adds to a giveaway page (subtitle, banner, rich description,
// prize cards, competition format + attempts + run cap + anti-cheat level, paused / hidden-board notices, US-state picker for
// region-limited giveaways, builder Official Rules), plus site settings from the admin (banner, maintenance notice, age-gate
// text, legal page overrides, site name) and a Report player button on profiles. app.js calls detail()/elig()/rules();
// everything else runs from a DOM observer so the rest of app.js stays untouched.
import { icon } from './icons.js';
import { ls, ss } from './store.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
async function api(path, opts = {}) {
  const tok = ls.getItem('gh_tok');
  const res = await fetch(path, { credentials: 'same-origin', ...opts, headers: { ...(opts.body ? { 'Content-Type': 'application/json' } : {}), ...(tok ? { 'X-Session': tok } : {}) }, body: opts.body ? JSON.stringify(opts.body) : undefined });
  try { return await res.json(); } catch { return { ok: false, error: `HTTP ${res.status}` }; }
}
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), 2600); }
(function css() { if (document.getElementById('gw7css')) return; const l = document.createElement('link'); l.id = 'gw7css'; l.rel = 'stylesheet'; l.href = '/css/gw-v7.css'; document.head.appendChild(l); })();

const AC_TXT = { L1: 'L1 basic: score range + rate checks', L2: 'L2 session: server-timed run tokens, max-rate + progression checks', L3: 'L3 event log: the run\'s key events are re-checked on the server', L4: 'L4 replay: the server replays your inputs to confirm the score' };
const durTxt = (s) => s >= 3600 ? `${+(s / 3600).toFixed(1)} h` : s >= 60 ? `${Math.round(s / 60)} min` : `${s} s`;
export function compHTML(g) {
  const c = g.competition; if (!c) return '';
  const levels = c.type === 'campaign' && c.level_from && c.level_to ? ` • levels ${c.level_from}-${c.level_to}` : '';
  const att = c.attempts ? `${fmt(c.attempts)} attempt${c.attempts === 1 ? '' : 's'} per game (your first ${fmt(c.attempts)} runs count)` : 'Unlimited attempts';
  const acs = [...new Set(Object.values(c.anticheat || {}))].sort();
  return `<div class="card pad gw7-comp" id="gw7-comp"><h2>${icon('trophy')} How this competition works</h2>
    <div class="gw7-chips"><span class="gw7-chip">${icon('gamepad-2')} ${esc(c.label || c.type)}</span><span class="gw7-chip">${icon('target')} ${esc(c.metric_label || '')}${levels}</span>
      <span class="gw7-chip">${icon('repeat')} ${esc(att)}</span>${c.run_cap_sec ? `<span class="gw7-chip">${icon('timer')} Runs capped at ${durTxt(c.run_cap_sec)}</span>` : ''}</div>
    ${g.score_rule_text ? `<p class="small muted">${esc(g.score_rule_text)}</p>` : ''}
    <p class="small"><b>Winner rule:</b> ${esc(c.winner_rule || 'Highest verified score at close')}. Only runs that pass server validation count${c.run_cap_sec ? `; a run longer than ${durTxt(c.run_cap_sec)} (server-measured) does not count` : ''}.</p>
    ${acs.length ? `<p class="tiny muted">${icon('shield-check')} Anti-cheat: ${acs.map(l => esc(AC_TXT[l] || l)).join(' • ')}</p>` : ''}</div>`;
}
function prizesHTML(g) {
  if (!g.prizes || !g.prizes.length) return '';
  return `<div class="card pad gw7-prizes"><h2>${icon('gift')} Prizes${g.total_value ? ` <span class="small muted">• about $${fmt(g.total_value)} total</span>` : ''}</h2><div class="gw7-plist">${g.prizes.map(p => `<div class="gw7-prize">
    ${p.image ? `<img src="${esc(p.image)}" alt="" loading="lazy">` : `<span class="gw7-pic">${icon('gift')}</span>`}<div><b>${esc(p.name)}</b>${p.qty > 1 ? ` <span class="small muted">x${fmt(p.qty)}</span>` : ''}
    <div class="small muted">${esc(p.places || '')}${p.type_label ? ` • ${esc(p.type_label)}` : ''}${p.value ? ` • ~$${fmt(p.value)}` : ''}</div>${p.desc ? `<div class="small">${esc(p.desc)}</div>` : ''}</div></div>`).join('')}</div></div>`;
}
// giveaway page: called by app.js right after the page renders
export function detail(g, r) {
  if (!g || !g.v7) return;
  const main = document.querySelector('#main .narrow'); if (!main) return;
  const card = main.querySelector('.card.gw');
  if (g.accent && card) { card.style.setProperty('--accent', g.accent); if (g.accent2) card.style.setProperty('--accent2', g.accent2); card.classList.add('gw7-accent'); }
  const h1 = main.querySelector('.back-row h1');
  if (g.subtitle && h1) h1.insertAdjacentHTML('afterend', `<p class="gw7-sub">${esc(g.subtitle)}</p>`);
  if (g.banner && card) card.insertAdjacentHTML('beforebegin', `<div class="gw7-banner"><img src="${esc(g.banner)}" alt=""></div>`);
  const notes = [];
  if (g.paused) notes.push(`<div class="gw7-note warn">${icon('pause')} This giveaway is paused. Runs during the pause don't count. Check back soon.</div>`);
  if (g.board_hidden) notes.push(`<div class="gw7-note">${icon('eye-off')} The leaderboard is hidden until this giveaway ends. Final standings are published when it locks.</div>`);
  if (g.regions) notes.push(`<div class="gw7-note">${icon('map')} ${g.regions.mode === 'allow' ? `Open to residents of: ${esc(g.regions.list.join(', '))}` : `Not open in: ${esc(g.regions.list.join(', '))}`}</div>`);
  if (card) card.insertAdjacentHTML('afterend', notes.join('') + (g.description_html ? `<div class="card pad gw7-desc prose">${g.description_html}</div>` : '') + prizesHTML(g) + compHTML(g));
  if (g.board_hidden) { const lb = [...main.querySelectorAll('.card')].find(c => c.querySelector('#live-link')); if (lb) { const e = lb.querySelector('.empty'); if (e) e.textContent = 'Hidden until the giveaway ends.'; } }
  if (g.claim_hours) { const f = main.querySelector('p.tiny.muted.center'); if (f) f.insertAdjacentHTML('beforebegin', `<p class="tiny muted center">Winners have ${g.claim_hours} hours to claim their prize after they are notified.</p>`); }
}
// eligibility card: US-state picker when the giveaway is limited to some states
export function elig(el, e, g, refresh) {
  const checks = (e && e.checks) || [];
  const region = checks.find(x => x.id === 'region');
  if (region && !(region.ok && region.have) && !el.querySelector('#gw7-region')) {
    const opts = (region.options || []).map(s => `<option ${s === region.have ? 'selected' : ''}>${esc(s)}</option>`).join('');
    el.querySelector('.elig-checks')?.insertAdjacentHTML('afterend', `<form class="gw7-region" id="gw7-region"><label class="small" for="gw7-st">${icon('map')} The US state you live in</label><select class="input" id="gw7-st"><option value="">Pick your state</option>${opts}</select><button class="btn sm">Save</button></form>`);
    const form = el.querySelector('#gw7-region');
    if (form) form.onsubmit = async (ev) => { ev.preventDefault(); const v = el.querySelector('#gw7-st').value; if (!v) return toast('Pick your state'); const x = await api('/api/me/region', { method: 'POST', body: { region: v } }); toast(x.ok ? 'State saved' : x.error); if (x.ok) refresh(); };
  }
  const steps = checks.filter(x => x.checklist && x.checklist_step_id);
  if (!steps.length || el.querySelector('.gw7-checklist')) return;
  const html = `<section class="gw7-checklist card pad"><h3>${icon('list-check')} Entry checklist</h3><p class="small muted">Confirm each required step. External channel actions are self-attested and are not independently verified by the hub.</p>
    ${steps.map(s => `<label class="gw7-checkrow"><input type="checkbox" data-gw7-check="${esc(s.checklist_step_id)}" ${s.checked ? 'checked' : ''} ${s.required && !e.signed_in ? 'disabled' : ''}><span><b>${esc(s.label)}</b>${s.required ? ' <span class="tiny muted">Required</span>' : ' <span class="tiny muted">Optional</span>'}<small class="muted">${esc(s.hint || '')}${s.url ? ` • <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">Open step</a>` : ''}</small></span></label>`).join('')}
  </section>`;
  el.querySelector('.elig-checks')?.insertAdjacentHTML('afterend', html);
  const box = el.querySelector('.gw7-checklist');
  if (box) box.addEventListener('change', async (ev) => {
    const input = ev.target.closest('[data-gw7-check]'); if (!input) return;
    input.disabled = true;
    const x = await api(`/api/giveaways/${encodeURIComponent(g.id)}/checklist`, { method: 'POST', body: { step_id: input.dataset.gw7Check, checked: input.checked } });
    if (!x.ok) { input.checked = !input.checked; toast(x.error || 'Could not save checklist step'); input.disabled = false; return; }
    toast('Checklist updated'); refresh();
  });
}
// Official Rules: builder giveaways carry their own (generated or admin-edited, sanitized on the server)
export const rules = (g) => (g && g.official_rules_html) || null;

// ---------- site settings from the admin ----------
let SC = null;
const LEGAL = { '/terms': 'terms', '/privacy': 'privacy', '/rules': 'rules', '/responsible-play': 'responsible' };
function applySite() {
  if (!SC) return; const path = location.pathname;
  if (SC.banner && !document.getElementById('gw7-site-banner') && ss.getItem('gh_banner_x') !== String(SC.banner.id || SC.banner.text)) {
    const main = document.getElementById('main');
    if (main) { main.insertAdjacentHTML('afterbegin', `<div class="gw7-site-banner tone-${esc(SC.banner.tone || 'info')}" id="gw7-site-banner" role="status">${icon('megaphone')}<span>${esc(SC.banner.text)}${SC.banner.link ? ` <a href="${esc(SC.banner.link)}">${esc(SC.banner.link_label || 'Learn more')}</a>` : ''}</span>${SC.banner.dismissible !== false ? `<button class="iconbtn" aria-label="Dismiss" id="gw7-bx">${icon('x')}</button>` : ''}</div>`);
      const x = document.getElementById('gw7-bx'); if (x) x.onclick = () => { ss.setItem('gh_banner_x', String(SC.banner.id || SC.banner.text)); document.getElementById('gw7-site-banner').remove(); }; }
  }
  if (SC.maintenance && !document.getElementById('gw7-maint')) document.body.insertAdjacentHTML('beforeend', `<div class="gw7-maint" id="gw7-maint" role="alert">${icon('settings')}<span><b>Maintenance:</b> ${esc(SC.maintenance.message || 'The hub is getting an upgrade. Playing and entering are paused for a moment.')}${SC.maintenance.until ? ` Back around ${new Date(SC.maintenance.until).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.` : ''}</span></div>`);
  const gate = document.querySelector('.gate-card#gate'); if (gate && SC.age_gate && !gate.dataset.v7) { gate.dataset.v7 = '1'; if (SC.age_gate.title) gate.querySelector('h1').textContent = SC.age_gate.title; if (SC.age_gate.text) gate.querySelector('p.muted').textContent = SC.age_gate.text; }
  const k = LEGAL[path]; const art = k && SC.legal && SC.legal[k] && document.querySelector('.legal article.prose');
  if (art && !art.dataset.v7) { art.dataset.v7 = '1'; art.innerHTML = SC.legal[k]; }
  if (SC.name && SC.name !== 'The Gaming Hub' && document.title.includes('The Gaming Hub')) document.title = document.title.replace('The Gaming Hub', SC.name);
  const m = /^\/u\/([^/]+)$/.exec(path); if (m) reportBtn(decodeURIComponent(m[1]));
}
let ME; // signed-in username ('' = guest; guests see the button and are asked to sign in)
function reportBtn(username) {
  const head = document.querySelector('#main .prof-head'); if (!head || document.getElementById('gw7-report')) return;
  if (ME === undefined) { ME = null; api('/api/me').then(x => { ME = (x && x.user && x.user.username) || ''; applySite(); }); return; }
  if (ME === null || (ME && ME.toLowerCase() === username.toLowerCase())) return; // loading, or my own profile
  head.insertAdjacentHTML('beforeend', `<button class="btn sm ghost gw7-report" id="gw7-report" title="Report this player">${icon('flag')} Report</button>`);
  document.getElementById('gw7-report').onclick = async () => {
    const rs = await api('/api/report/reasons'); const reasons = rs.reasons || ['cheating', 'other'];
    const d = document.createElement('dialog'); d.className = 'gw7-dlg';
    d.innerHTML = `<form method="dialog"><h2>Report ${esc(username)}</h2><label class="small">Reason<select class="input" name="reason">${reasons.map(r => `<option value="${esc(r)}">${esc(r[0].toUpperCase() + r.slice(1))}</option>`).join('')}</select></label>
      <label class="small">Details (optional)<textarea class="input" name="details" maxlength="500" rows="3"></textarea></label><p class="tiny muted">Reports go to the moderators. False reports can lead to action on your account.</p>
      <div class="btn-row"><button class="btn ghost sm" value="cancel">Cancel</button><button class="btn sm" value="send">Send report</button></div></form>`;
    document.body.appendChild(d); d.showModal();
    d.addEventListener('close', async () => { const f = d.querySelector('form'); const v = d.returnValue; const body = { kind: 'user', username, reason: f.reason.value, details: f.details.value }; d.remove();
      if (v !== 'send') return; const x = await api('/api/report', { method: 'POST', body }); toast(x.ok ? (x.duplicate ? 'You already reported this player. Moderators will look at it.' : 'Thanks. Moderators will review this report.') : (x.error || 'Sign in to report a player.')); });
  };
}
api('/api/site-config').then(c => { if (c && c.ok) { SC = c; applySite(); const app = document.getElementById('app'); if (app) new MutationObserver(() => applySite()).observe(app, { childList: true }); } }).catch(() => {});

// v7 item 22: multi-step giveaway builder (phone first). Every part is customisable; drafts autosave; live preview of the
// public card + page while editing. Data model = the server's v7 cfg document (src/admin-giveaways.js normalize()).
import { C, esc, fmt, money, api, toast, dialog, icon, dtz, dshort, toTzInput, tzLabel, dur, toggle, field, setPath, getPath, readInput, can, pill, statePill } from './admin-shared.js';
import { cropUpload } from './admin-crop.js';

const STEPS = [['basics', 'Basics', 'type'], ['media', 'Media', 'image'], ['schedule', 'Schedule', 'calendar-clock'], ['games', 'Games', 'gamepad-2'], ['prizes', 'Prizes', 'gift'],
  ['entry', 'Entry rules', 'shield-check'], ['features', 'Features', 'sparkles'], ['winners', 'Winners', 'crown'], ['rules', 'Official rules', 'scale'], ['review', 'Review', 'rocket']];
const TIEBREAKS = ['Higher score ranks higher.', 'Same score: the shorter server-timed run wins.', 'Still tied: the game\'s skill metric from the validated event log wins.', 'Still exactly tied: sudden-death playoff (same seed, one run each), started from the event admin.'];
const QUICK = [['15 min', 15 * 60e3], ['37 min', 37 * 60e3], ['1 hour', 3600e3], ['6 hours', 6 * 3600e3], ['1 day', 864e5], ['3 days', 3 * 864e5], ['1 week', 7 * 864e5], ['2 weeks', 14 * 864e5], ['1 month', 30 * 864e5], ['3 months', 91 * 864e5]];
let M = null; const S = { id: 0, d: null, v: null, step: 'basics', saved_at: 0, base: 0, timer: null, saving: false, pending: false, draft: null, view: 'card', device: 'phone' };
const ord = (n) => n + (['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th');
function plan(d) {
  const rank = d.prizes.filter(p => p.award !== 'random'), rnd = d.prizes.filter(p => p.award === 'random');
  const k = rank.reduce((s, p) => s + (+p.qty || 1), 0), m = rnd.reduce((s, p) => s + (+p.qty || 1), 0); let pl = 1; const places = [];
  for (const p of [...rank, ...rnd]) { const q = +p.qty || 1; places.push({ p, from: pl, to: pl + q - 1, label: p.award === 'random' ? `Random draw${q > 1 ? ` x${q}` : ''}` : q === 1 ? ord(pl) : pl === 1 ? `Top ${q}` : `${ord(pl)}-${ord(pl + q - 1)}` }); pl += q; }
  return { method: m === 0 ? 'score' : k === 0 ? 'random' : 'hybrid', winners: k + m, split: k, places, arv: d.prizes.reduce((s, p) => s + (+p.qty || 1) * (+p.value || 0), 0) };
}
const METHOD = { score: 'Ranked by score', random: 'Random draw among qualifiers', hybrid: 'Top ranks by score + random draw for the rest' };
const RULE_HINT = { best: 'Highest single run across the linked games.', sum_best: 'Best run in each linked game, added up.', total: 'Every qualifying run adds up (rewards playing more).', avg_top: 'Average of the top N runs; missing runs count as 0.', improved: 'Best in the window minus the best before it started.', campaign: 'Cumulative score across the campaign\'s level set.', fastest: 'Best single run; equal scores go to the faster completion.' };
// Reese's example formats (Game Rules Profiles brief); game falls back to the current pick when it isn't available
const FORMATS = [
  { label: '7-day campaign, levels 1-30', icon: 'map', hint: 'Cumulative score across levels 1-30 for 7 days', game: 'sling-smash', comp: { type: 'campaign', metric: 'cumulative', level_from: 1, level_to: 30 }, rule: 'campaign', attempts: 0, cap: 0, hours: 168 },
  { label: '72-hour endless chase', icon: 'infinity', hint: 'Endless, scored on survival + distance, 72 hours', game: 'drift-rush', comp: { type: 'endless', metric: 'survival_distance' }, rule: 'best', attempts: 0, cap: 0, hours: 72 },
  { label: '5-day tower defense', icon: 'castle', hint: 'Strategy, highest round, 5 days', game: 'haze-defense', comp: { type: 'strategy', metric: 'wave' }, rule: 'best', attempts: 0, cap: 0, hours: 120 },
  { label: '24-hour marathon', icon: 'timer', hint: 'Every run adds up for 24 hours', game: null, comp: { type: 'endless', metric: 'marathon' }, rule: 'total', attempts: 0, cap: 0, hours: 24 },
  { label: '48 h, 30-min run cap', icon: 'crosshair', hint: 'Kills + score, each run capped at 30 minutes, 48 hours', game: 'void-swarm', comp: { type: 'endless', metric: 'kills_score' }, rule: 'best', attempts: 0, cap: 1800, hours: 48 },
  { label: '60-s score attack, best of 3', icon: 'zap', hint: 'Short session: 60-second runs, first 3 count', game: null, comp: { type: 'short_session', metric: 'attack_60' }, rule: 'best', attempts: 3, cap: 60, hours: 24 },
];
function applyDefaults(d, id, { schedule = true } = {}) {
  const x = (M.defaults || {})[id]; if (!x) return false;
  Object.assign(d.games, { competition: { level_from: 0, level_to: 0, ...x.competition }, score_rule: x.score_rule, attempts: x.attempts, run_cap_sec: x.run_cap_sec, profile_from: id });
  if (schedule && x.recommended_hours) d.schedule.end_at = (d.schedule.start_at || Date.now()) + x.recommended_hours * 3600e3;
  toast(`${gameOf(id).title} profile applied: ${(M.comp[x.competition.type] || {}).label}${x.recommended_hours ? `, ${dur(x.recommended_hours * 3600e3)}` : ''}`); return true;
}
const compLine = (d) => { const c = d.games.competition || {}; const t = M.comp[c.type] || M.comp.endless; return esc(`${t.label}: ${(t.metrics[c.metric] || [''])[0]}${c.type === 'campaign' ? ` (levels ${c.level_from}-${c.level_to})` : ''} • ${d.games.attempts ? 'best of ' + d.games.attempts : 'unlimited attempts'}${d.games.run_cap_sec ? ` • ${dur(d.games.run_cap_sec * 1000)} run cap` : ''}`); };
const gameOf = (id) => M.games.find(g => g.id === id) || { id, title: id, art: '' };

export async function newGiveaway(opts = {}) {
  const r = await api('/api/admin/v7/gw/drafts', { method: 'POST', body: opts }); if (!r.ok) { toast(r.error || 'Could not start a draft'); return C.nav('/admin/giveaways'); }
  history.replaceState({}, '', `/admin/giveaways/draft/${r.id}?step=basics`); return builder(r.id);
}
export async function builder(id) {
  if (!M) { M = await api('/api/admin/v7/gw/meta'); if (!M.ok) { M = null; return C.frame('giveaways', 'Giveaway builder', `<div class="err">${esc('Could not load the builder.')}</div>`); } }
  const r = await api(`/api/admin/v7/gw/drafts/${id}`); if (!r.ok) return C.frame('giveaways', 'Draft not found', `<div class="empty">This draft no longer exists (it may have been published). <a href="/admin/giveaways">Back to giveaways</a></div>`);
  Object.assign(S, { id: +id, d: r.data, v: r.validation, draft: r.draft, base: r.draft.updated_at, saved_at: r.draft.updated_at, step: new URLSearchParams(location.search).get('step') || 'basics' });
  try { const bk = JSON.parse(localStorage.getItem('gwdraft:' + id) || 'null'); if (bk && bk.at > r.draft.updated_at + 1000) { if (await dialog({ title: 'Restore unsaved changes?', body: `<p>This phone has edits from ${dshort(bk.at)} that did not reach the server.</p>`, confirm: 'Restore', cancel: 'Discard' })) { S.d = bk.d; queueSave(0); } else localStorage.removeItem('gwdraft:' + id); } } catch {}
  shell();
}
function shell() {
  const title = S.draft.giveaway_id ? `Edit giveaway #${S.draft.giveaway_id}` : 'New giveaway';
  C.frame('giveaways', `${icon('wand-sparkles')} ${esc(title)}`, `<div class="bld">
    <ol class="stepper" id="stp" aria-label="Builder steps"></ol>
    ${S.draft.locked ? `<div class="warn-box">${icon('lock')} Final results are locked. Title, art, prize text and rules can change; dates, games, scoring and winners can't.</div>` : ''}
    <div class="bld-grid"><section class="bld-form card pad" id="bf" aria-live="polite"></section>
      <aside class="bld-prev" id="bp" aria-label="Live preview"><div class="prev-tabs"><button data-view="card">Card</button><button data-view="page">Page</button><span class="sp"></span><button data-dev="phone" title="Phone width">${icon('smartphone')}</button><button data-dev="desk" title="Desktop width">${icon('monitor')}</button></div><div id="pv"></div></aside></div>
    <div class="bld-bar"><button class="btn ghost" id="bk">${icon('chevron-left')}<span>Back</span></button><span class="save-st" id="sst" role="status"></span><button class="btn ghost only-m" id="pvb">${icon('eye')}<span>Preview</span></button><button class="btn" id="nx"><span>Next</span>${icon('chevron-right')}</button></div>
  </div>`, `<div class="bld-acts"><button class="btn sm ghost" id="b-save">${icon('save')} Save draft</button><button class="btn sm ghost" id="b-more" aria-haspopup="true">${icon('ellipsis')}</button></div>`);
  document.getElementById('bf').addEventListener('input', onInput); document.getElementById('bf').addEventListener('change', onInput); document.getElementById('bf').addEventListener('click', onClick);
  document.getElementById('stp').addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) go(b.dataset.step); });
  document.getElementById('bk').onclick = () => { const i = STEPS.findIndex(s => s[0] === S.step); if (i > 0) go(STEPS[i - 1][0]); else C.nav('/admin/giveaways'); };
  document.getElementById('nx').onclick = () => { const i = STEPS.findIndex(s => s[0] === S.step); if (i < STEPS.length - 1) go(STEPS[i + 1][0]); else publish(); };
  document.getElementById('b-save').onclick = () => queueSave(0, true);
  document.getElementById('b-more').onclick = moreMenu;
  document.getElementById('pvb').onclick = () => document.getElementById('bp').classList.toggle('open');
  document.getElementById('bp').addEventListener('click', (e) => { const v = e.target.closest('[data-view]'); const dv = e.target.closest('[data-dev]'); if (v) { S.view = v.dataset.view; preview(); } if (dv) { S.device = dv.dataset.dev; preview(); } if (e.target.id === 'bp') e.target.classList.remove('open'); });
  window.onbeforeunload = () => (S.pending || S.saving) ? 'Changes are still saving' : undefined;
  go(S.step, true);
}
function go(step, first = false) {
  if (!STEPS.some(s => s[0] === step)) step = 'basics'; S.step = step;
  if (!first) history.replaceState({}, '', `/admin/giveaways/draft/${S.id}?step=${step}`);
  stepper(); form(); preview(); saveState();
  const i = STEPS.findIndex(s => s[0] === step); const nx = document.getElementById('nx');
  nx.innerHTML = i === STEPS.length - 1 ? `${icon('rocket')}<span>${S.d.schedule.publish_mode === 'schedule' ? 'Schedule' : S.draft.giveaway_id ? 'Apply changes' : 'Publish'}</span>` : `<span>Next: ${STEPS[i + 1][1]}</span>${icon('chevron-right')}`;
  nx.disabled = i === STEPS.length - 1 && !can('giveaways.publish');
  if (!first) document.getElementById('bf').scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function stepper() {
  const errs = {}; for (const e of (S.v && S.v.errors) || []) errs[e.step] = (errs[e.step] || 0) + 1;
  document.getElementById('stp').innerHTML = STEPS.map(([k, l, ic], i) => `<li><button data-step="${k}" class="${k === S.step ? 'on' : ''} ${errs[k] ? 'bad' : ''}" aria-current="${k === S.step ? 'step' : 'false'}">${icon(ic)}<span>${i + 1}. ${l}</span>${errs[k] ? `<b class="cnt">${errs[k]}</b>` : ''}</button></li>`).join('');
  const on = document.querySelector('#stp .on'); if (on) on.scrollIntoView({ inline: 'center', block: 'nearest' });
}
const errsFor = (step) => ((S.v && S.v.errors) || []).filter(e => e.step === step);
const warnsFor = (step) => ((S.v && S.v.warnings) || []).filter(e => e.step === step);
const errBox = (step) => { const e = errsFor(step), w = warnsFor(step); return (e.length ? `<div class="err-box">${e.map(x => `<div>${icon('circle-alert')} ${esc(x.msg)}</div>`).join('')}</div>` : '') + (w.length ? `<div class="warn-box">${w.map(x => `<div>${icon('triangle-alert')} ${esc(x.msg)}</div>`).join('')}</div>` : ''); };
const inp = (k, attrs = '', type = 'text') => `<input class="input" type="${type}" data-k="${k}" value="${esc(getPath(S.d, k) ?? '')}" ${attrs}>`;
const num = (k, min, max, step = 1, attrs = '') => `<input class="input" type="number" inputmode="decimal" data-k="${k}" data-type="num" min="${min}" max="${max}" step="${step}" value="${esc(getPath(S.d, k) ?? 0)}" ${attrs}>`;

// ---------- step forms ----------
const FORMS = {
  basics() {
    const b = S.d.basics; const brands = M.brands;
    return `<h2>${icon('type')} Basics</h2>${errBox('basics')}
      ${field('Title', inp('basics.title', 'maxlength="120" required placeholder="e.g. Friday Night High Score Showdown"'))}
      ${field('Subtitle', inp('basics.subtitle', 'maxlength="160" placeholder="One line under the title"'))}
      <div class="fld"><span class="fl">Description</span><div class="rte-bar" role="toolbar" aria-label="Formatting">${[['bold', 'bold', 'Bold'], ['italic', 'italic', 'Italic'], ['underline', 'underline', 'Underline'], ['insertUnorderedList', 'list', 'Bullets'], ['insertOrderedList', 'list-ordered', 'Numbered'], ['h3', 'heading', 'Heading'], ['createLink', 'link', 'Link'], ['removeFormat', 'eraser', 'Clear']].map(([c, i, l]) => `<button type="button" data-rte="${c}" title="${l}" aria-label="${l}">${icon(i)}</button>`).join('')}</div>
        <div class="rte input" contenteditable="true" id="rte" data-k="basics.description" data-type="html" role="textbox" aria-multiline="true" aria-label="Description">${b.description || ''}</div><small class="muted">Bold, lists, headings and links. Scripts and styles are removed when saved.</small></div>
      <div class="form-grid">${field('Short link', `<div class="input-pre"><span>/g/</span>${inp('basics.slug', 'maxlength="60" placeholder="friday-showdown" pattern="[a-z0-9-]*"')}<button type="button" class="btn sm ghost" data-act="slug">Auto</button></div>`, 'Optional pretty link players can share.')}
        ${field('Sponsor / host name', inp('basics.sponsor', 'maxlength="80"'))}</div>
      <div class="fld"><span class="fl">Sponsor logo</span><div class="img-row">${b.sponsor_logo ? `<img src="${esc(b.sponsor_logo)}" alt="" class="logo-prev">` : '<span class="muted small">No logo (text name is used)</span>'}<button type="button" class="btn sm ghost" data-act="up-logo">${icon('upload')} Upload</button>${b.sponsor_logo ? '<button type="button" class="btn sm ghost" data-act="rm-logo">Remove</button>' : ''}</div></div>
      ${field('Brand', `<select class="input" data-k="basics.channel_id" data-type="num" data-rerender="1"><option value="0">None (Trap Tech, hub-wide)</option>${brands.map(c => `<option value="${c.id}" ${+b.channel_id === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>`, 'Brands come from Brand affiliation (one brand per player).')}
      <fieldset class="seg"><legend>Who can enter</legend>
        <label class="seg-opt ${b.hub_wide ? 'on' : ''}"><input type="radio" name="aud" data-act="aud" value="all" ${b.hub_wide ? 'checked' : ''}>${icon('globe')}<span><b>Open to everyone</b><small>Every eligible hub player, whatever brand they are in.</small></span></label>
        <label class="seg-opt ${!b.hub_wide ? 'on' : ''} ${!b.channel_id ? 'dis' : ''}"><input type="radio" name="aud" data-act="aud" value="brand" ${!b.hub_wide ? 'checked' : ''} ${!b.channel_id ? 'disabled' : ''}>${icon('store')}<span><b>Brand members only</b><small>${b.channel_id ? `Only players in ${esc((brands.find(x => x.id === +b.channel_id) || {}).name || 'this brand')}.` : 'Pick a brand first.'}</small></span></label></fieldset>`;
  },
  media() {
    const m = S.d.media;
    return `<h2>${icon('image')} Media</h2>${errBox('media')}
      <div class="media-now">${m.image ? `<div class="mn-main" style="background-image:url('${esc(m.image)}')"><span>Card image</span></div>` : '<div class="mn-main empty">No image yet</div>'}${m.image_tall ? `<div class="mn-tall" style="background-image:url('${esc(m.image_tall)}')"><span>Tall</span></div>` : ''}${m.image_square ? `<div class="mn-sq" style="background-image:url('${esc(m.image_square)}')"><span>Square</span></div>` : ''}</div>
      <div class="src-tabs">${[['upload', 'upload', 'Upload'], ['preset', 'images', 'Presets'], ['game', 'gamepad-2', 'Game art'], ['url', 'link', 'Link']].map(([k, i, l]) => `<button type="button" data-act="src" data-src="${k}" class="${m.source === k ? 'on' : ''}">${icon(i)} ${l}</button>`).join('')}</div>
      <div class="src-body">${m.source === 'upload' ? `<button type="button" class="btn" data-act="up-main">${icon('upload')} Upload &amp; crop image</button><p class="small muted">You frame it for the card (16:9), the tall card and a square. The server resizes and stores PNGs on the data disk.</p>`
        : m.source === 'preset' ? `<div class="img-pick">${M.presets.map(u => `<button type="button" data-act="pick" data-url="${esc(u)}" class="${m.image === u ? 'on' : ''}" style="background-image:url('${esc(u)}')" aria-label="Preset image"></button>`).join('')}</div>`
        : m.source === 'game' ? `<div class="img-pick">${M.games.map(g => `<button type="button" data-act="pick-game" data-id="${g.id}" class="${m.game_thumb === g.id ? 'on' : ''}" style="background-image:url('${esc(g.art)}')" title="${esc(g.title)}" aria-label="${esc(g.title)}"></button>`).join('')}</div>`
        : `${field('Image link (https:// or /assets/...)', inp('media.image', 'placeholder="https://..."'), 'Outside images show on the site; the admin preview only shows uploaded / hub images.')}`}</div>
      <h3>Banner</h3><div class="img-row">${m.banner ? `<div class="ban-prev" style="background-image:url('${esc(m.banner)}')"></div><button type="button" class="btn sm ghost" data-act="rm-banner">Remove</button>` : '<span class="muted small">Optional wide banner (4:1) at the top of the giveaway page.</span>'}<button type="button" class="btn sm ghost" data-act="up-banner">${icon('upload')} ${m.banner ? 'Replace' : 'Upload banner'}</button></div>
      <h3>Colours</h3><div class="themes">${Object.entries(M.themes).map(([k, [a, b2]]) => `<button type="button" data-act="theme" data-theme="${k}" class="${m.theme === k ? 'on' : ''}" style="background:linear-gradient(135deg,${a},${b2})"><span>${k}</span></button>`).join('')}</div>
      <div class="form-grid">${field('Accent', `<input type="color" class="input color" data-k="media.accent" value="${esc(m.accent)}">`)}${field('Second accent', `<input type="color" class="input color" data-k="media.accent2" value="${esc(m.accent2)}">`)}</div>
      ${toggle('features.branding', S.d.features.branding, 'Show brand colours + logo on the card', 'Was a Premium add-on.')}`;
  },
  schedule() {
    const s = S.d.schedule; const d0 = s.end_at - s.start_at; const r = s.recur;
    const occ = []; if (r.freq && s.start_at) { let t = s.start_at; for (let i = 0; i < 4; i++) { occ.push(t); const x = new Date(t); if (r.freq === 'daily') x.setDate(x.getDate() + r.every); else if (r.freq === 'weekly') x.setDate(x.getDate() + 7 * r.every); else x.setMonth(x.getMonth() + r.every); t = x.getTime(); } }
    return `<h2>${icon('calendar-clock')} Schedule</h2>${errBox('schedule')}<p class="small muted">${icon('globe')} Times are in the hub's time zone: <b>Eastern (${tzLabel(s.start_at || Date.now())})</b>. Any length from 1 minute to 366 days.</p>
      <div class="form-grid">${field('Starts', `<input class="input" type="datetime-local" data-k="schedule.start_at" data-type="tz" value="${toTzInput(s.start_at)}" data-rerender="1">`, `<button type="button" class="linkish" data-act="start-now">Start now</button>`)}
        ${field('Ends', `<input class="input" type="datetime-local" data-k="schedule.end_at" data-type="tz" value="${toTzInput(s.end_at)}" data-rerender="1">`)}</div>
      <div class="dur-now">${icon('timer')} Length: <b>${dur(d0)}</b></div>
      <div class="chips">${QUICK.map(([l, ms]) => `<button type="button" class="chip ${Math.abs(d0 - ms) < 1000 ? 'on' : ''}" data-act="dur" data-ms="${ms}">${l}</button>`).join('')}</div>
      <div class="dur-custom"><span class="small">Custom length</span><input class="input" type="number" min="0" max="366" id="cd-d" value="${Math.floor(d0 / 864e5) || 0}" aria-label="Days"> d <input class="input" type="number" min="0" max="23" id="cd-h" value="${Math.floor((d0 % 864e5) / 3600e3) || 0}" aria-label="Hours"> h <input class="input" type="number" min="0" max="59" id="cd-m" value="${Math.round((d0 % 3600e3) / 60e3) || 0}" aria-label="Minutes"> min <button type="button" class="btn sm ghost" data-act="dur-custom">Apply</button></div>
      <h3>Publishing</h3><fieldset class="seg"><legend class="sr">Publishing</legend>
        <label class="seg-opt ${s.publish_mode === 'now' ? 'on' : ''}"><input type="radio" name="pub" data-k="schedule.publish_mode" value="now" data-rerender="1" ${s.publish_mode === 'now' ? 'checked' : ''}>${icon('rocket')}<span><b>Publish when I click Publish</b><small>Shows as upcoming until it starts.</small></span></label>
        <label class="seg-opt ${s.publish_mode === 'schedule' ? 'on' : ''}"><input type="radio" name="pub" data-k="schedule.publish_mode" value="schedule" data-rerender="1" ${s.publish_mode === 'schedule' ? 'checked' : ''}>${icon('calendar-plus')}<span><b>Schedule publishing</b><small>Stays hidden until the time below.</small></span></label></fieldset>
      ${s.publish_mode === 'schedule' ? field('Publish at', `<input class="input" type="datetime-local" data-k="schedule.publish_at" data-type="tz" value="${toTzInput(s.publish_at)}">`) : ''}
      <h3>Repeat</h3><div class="form-grid">${field('Repeats', `<select class="input" data-k="schedule.recur.freq" data-rerender="1">${[['', 'Does not repeat'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([v, l]) => `<option value="${v}" ${r.freq === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${r.freq ? field(`Every N ${r.freq === 'daily' ? 'days' : r.freq === 'weekly' ? 'weeks' : 'months'}`, num('schedule.recur.every', 1, 12)) + field('Stop after (0 = keep going)', num('schedule.recur.count', 0, 520), 'Number of giveaways in the series') + field('Or stop on', `<input class="input" type="date" data-k="schedule.recur.until" data-type="date" value="${r.until ? new Date(r.until).toISOString().slice(0, 10) : ''}">`) : ''}</div>
      ${r.freq ? `<div class="small muted">Next occurrences: ${occ.map(t => dshort(t)).join(' • ')} … Each one is a separate giveaway with its own winners, created automatically when the previous one ends.</div>` : ''}`;
  },
  games() {
    const g = S.d.games; const sel = new Set(g.ids); const cp = g.competition || { type: 'endless', metric: 'score' }; const CT = M.comp[cp.type] || M.comp.endless;
    const prof = (id) => (M.profiles || {})[id] || null;
    const acs = [...new Set(g.ids.map(id => (prof(id) || {}).anticheat_level || 'L2'))].sort();
    const capMin = g.run_cap_sec ? +(g.run_cap_sec / 60).toFixed(2) : 0;
    return `<h2>${icon('gamepad-2')} Games & competition</h2>${errBox('games')}<p class="small muted">Link one or many games. Picking a game fills in its <b>Game Rules Profile</b> defaults (format, attempts, run cap, suggested length); change anything after. Chance games are "just for fun" and can't be used.</p>
      <h3>Quick formats</h3><div class="chips fmt-chips">${FORMATS.map((f, i) => `<button type="button" class="chip" data-act="fmt" data-i="${i}" title="${esc(f.hint)}">${icon(f.icon)} ${esc(f.label)}</button>`).join('')}</div>
      <div class="gsel">${M.games.map(x => { const p = prof(x.id); return `<label class="gs ${sel.has(x.id) ? 'on' : ''} ${!x.eligible ? 'dis' : ''}"><input type="checkbox" data-act="game" value="${x.id}" ${sel.has(x.id) ? 'checked' : ''} ${!x.eligible ? 'disabled' : ''}><img src="${esc(x.art)}" alt=""><span>${esc(x.title)}${!x.eligible ? '<small>Just for fun</small>' : p ? `<small>${esc((M.comp[p.competition_type] || {}).label || '')} • ${esc(p.anticheat_level)}</small>` : ''}</span></label>`; }).join('')}</div>
      ${g.ids.length ? `<div class="prof-cards">${g.ids.map(id => { const p = prof(id); if (!p) return ''; return `<div class="prof-card card"><div class="pc-h"><img src="${esc(gameOf(id).art)}" alt=""><b>${esc(p.hub_version)}</b><span class="pill">${esc(p.recognition_tier)}</span><span class="pill ac ac-${esc(p.anticheat_level)}" title="${esc(M.ac_levels[p.anticheat_level])}">${icon('shield-check')} ${esc(p.anticheat_level)}</span></div>
          <dl class="pc-dl"><dt>Like</dt><dd>${esc(p.game)}</dd><dt>Category</dt><dd>${esc(p.category)}</dd><dt>Format</dt><dd>${esc((M.comp[p.competition_type] || {}).label)}: ${esc(p.metric_label)}</dd><dt>Endless</dt><dd>${p.endless ? 'Yes' : 'No'}</dd><dt>Attempts</dt><dd>${p.attempts ? 'Best of ' + p.attempts : 'Unlimited'}</dd><dt>Suggested length</dt><dd>${esc(p.recommended_length || '-')}</dd><dt>Scoring</dt><dd>${esc(p.scoring)}</dd></dl>
          <button type="button" class="btn sm ghost" data-act="use-prof" data-id="${id}">${icon('wand-2')} Use this profile's defaults</button></div>`; }).join('')}</div>` : ''}
      <h3>Competition format</h3><div class="rules-pick">${Object.entries(M.comp).map(([k, v]) => `<label class="seg-opt ${cp.type === k ? 'on' : ''}"><input type="radio" name="ct" data-act="ctype" value="${k}" ${cp.type === k ? 'checked' : ''}><span><b>${esc(v.label)}</b><small>${esc(v.desc)}</small></span></label>`).join('')}</div>
      <div class="form-grid">${field('Scored on', `<select class="input" data-act="metric">${Object.entries(CT.metrics).map(([k, v]) => `<option value="${k}" ${cp.metric === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('')}</select>`, 'What the game\'s verified score measures for this event.')}
        ${cp.type === 'campaign' ? field('Levels from', num('games.competition.level_from', 1, 999)) + field('Levels to', num('games.competition.level_to', 1, 999), 'Defined level set, e.g. 1-30') : ''}
        ${field('Attempts', `<select class="input" data-act="att-mode"><option value="0" ${!g.attempts ? 'selected' : ''}>Unlimited</option><option value="n" ${g.attempts ? 'selected' : ''}>Limited to N runs</option></select>`)}
        ${g.attempts ? field('Runs that count (per game)', num('games.attempts', 1, 100, 1, 'data-rerender="1"'), 'Only each player\'s first N counted runs count (best of N).') : ''}
        ${field('Run cap (minutes, 0 = none)', `<input class="input" type="number" min="0" max="1440" step="0.5" data-act="cap" value="${capMin}" aria-label="Run cap in minutes">`, 'A run longer than this (server-measured) does not count.')}</div>
      <div class="note-box win-rule">${icon('shield-check')} <b>Winner rule:</b> ${esc(M.winner_rule)}. Only runs that pass server validation count. Anti-cheat ${acs.length ? acs.map(a => `<b title="${esc(M.ac_levels[a])}">${esc(a)}</b>`).join(', ') : '-'}${acs.length ? ` <small>(${acs.map(a => esc(M.ac_levels[a])).join('; ')})</small>` : ''}</div>
      ${g.ids.length > 1 ? `<h3>Weighting</h3><p class="small muted">Multiply a game's scores so different games compare fairly (1 = as is).</p>${g.ids.map(id => `<div class="wrow"><img src="${esc(gameOf(id).art)}" alt=""><span>${esc(gameOf(id).title)}</span><input type="range" min="0.1" max="5" step="0.1" data-k="games.weights.${id}" data-type="num" value="${g.weights[id] || 1}" aria-label="Weight for ${esc(gameOf(id).title)}"><b>x${(+g.weights[id] || 1).toFixed(1)}</b></div>`).join('')}` : ''}
      <h3>Score rule</h3><div class="rules-pick">${Object.entries(M.score_rules).map(([k, l]) => `<label class="seg-opt ${g.score_rule === k ? 'on' : ''}"><input type="radio" name="sr" data-k="games.score_rule" value="${k}" data-rerender="1" ${g.score_rule === k ? 'checked' : ''}><span><b>${esc(l)}</b><small>${esc(RULE_HINT[k] || '')}</small></span></label>`).join('')}</div>
      <div class="form-grid">${g.score_rule === 'avg_top' ? field('Top N runs', num('games.top_n', 1, 50)) : ''}${field('Minimum score to qualify', num('games.min_score', 0, 100000000), 'Runs below this don\'t count.')}${field('Minimum runs to be ranked', num('games.min_runs', 0, 1000), '0 = no minimum')}</div>`;
  },
  prizes() {
    const p = plan(S.d);
    return `<h2>${icon('gift')} Prizes</h2>${errBox('prizes')}<p class="small muted">Any number of prizes. Ranked prizes go to places in order (top to bottom); random-draw prizes go to qualifiers drawn with the verifiable draw.</p>
      <div class="prizes">${S.d.prizes.map((x, i) => `<div class="prize card" data-i="${i}"><div class="pz-head"><b>Prize ${i + 1}</b><span class="pill ${x.award === 'random' ? 'cyan' : 'gold'}">${esc((p.places.find(q => q.p === x) || {}).label || '')}</span><span class="sp"></span>
          <button type="button" class="iconbtn" data-act="pz-up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('arrow-up')}</button><button type="button" class="iconbtn" data-act="pz-down" ${i === S.d.prizes.length - 1 ? 'disabled' : ''} aria-label="Move down">${icon('arrow-down')}</button><button type="button" class="iconbtn" data-act="pz-dup" aria-label="Duplicate">${icon('copy')}</button><button type="button" class="iconbtn" data-act="pz-rm" aria-label="Remove">${icon('trash-2')}</button></div>
        <div class="pz-body"><button type="button" class="pz-img" data-act="pz-img" style="${x.image ? `background-image:url('${esc(x.image)}')` : ''}" aria-label="Prize image">${x.image ? '' : icon('image-plus')}</button>
          <div class="form-grid">${field('Name', inp(`prizes.${i}.name`, 'maxlength="120" placeholder="e.g. PS5 Slim bundle"'), '', 'full')}${field('Description', `<textarea class="input" rows="2" data-k="prizes.${i}.desc" maxlength="400">${esc(x.desc)}</textarea>`, '', 'full')}
            ${field('Type', `<select class="input" data-k="prizes.${i}.type">${Object.entries(M.prize_types).map(([k, l]) => `<option value="${k}" ${x.type === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
            ${field('Awarded by', `<select class="input" data-k="prizes.${i}.award" data-rerender="1"><option value="rank" ${x.award !== 'random' ? 'selected' : ''}>Rank (score)</option><option value="random" ${x.award === 'random' ? 'selected' : ''}>Random draw</option></select>`)}
            ${field('Quantity (winners)', num(`prizes.${i}.qty`, 1, 1000, 1, 'data-rerender="1"'))}${field('Retail value (USD)', num(`prizes.${i}.value`, 0, 10000000, 0.01))}</div></div></div>`).join('')}</div>
      <button type="button" class="btn ghost block" data-act="pz-add">${icon('plus')} Add prize</button>
      <div class="plan card"><h3>Who wins what</h3><div class="pl-sum"><span>${icon('users')} <b>${p.winners}</b> winner${p.winners === 1 ? '' : 's'}</span><span>${icon('scale')} ${METHOD[p.method]}</span><span>${icon('badge-dollar-sign')} Total value <b>${money(p.arv)}</b></span></div>
        <table class="tbl"><tbody>${p.places.map(x => `<tr><td><b>${esc(x.label)}</b></td><td>${esc(x.p.name || 'Unnamed prize')}</td><td class="num">${x.p.value ? money(x.p.value) : ''}</td></tr>`).join('')}</tbody></table></div>`;
  },
  entry() {
    const e = S.d.entry;
    return `<h2>${icon('shield-check')} Entry rules</h2>${errBox('entry')}
      <div class="note-box">${icon('info')} Free to enter, always. Hub Points can never buy entries; bonus entries only come from free activity (quests, invites) and only change random draws.</div>
      ${toggle('entry.age21', e.age21, '21+ only', 'Players must have a date of birth showing 21+ (the hub is 21+).')}
      ${toggle('entry.require_join', !!e.require_join, 'Players tap "Enter giveaway"', 'Needed for entry requirements to be checked before a player counts. Turned on automatically for 21+, regions, brand-only, entry caps, and required checklist steps.', 'data-type="int01"')}
      <h3>Anti-camping</h3><div class="form-grid">
        ${field('Account at least (days old)', num('entry.elig_account_age_days', 0, 365))}${field('Runs in the last 7 days', num('entry.elig_min_runs7', 0, 100), 'Recent activity needed to enter')}
        ${field('XP in the last 7 days', num('entry.elig_min_xp7', 0, 100000))}${field('Max live giveaways per player', num('entry.elig_max_active', 0, 50), '0 = no limit')}
        ${field('Win cooldown (days)', num('entry.elig_win_cooldown_days', 0, 365), 'No new wins this long after a win')}${field('Max entrants', num('entry.max_entrants', 0, 1000000), '0 = unlimited')}</div>
      ${toggle('entry.elig_brand_month', !!e.elig_brand_month, 'One win per brand per 30 days', '', 'data-type="int01"')}
      <h3>Regions</h3><div class="seg-row">${[['all', 'All US states'], ['allow', 'Only these states'], ['exclude', 'All except these']].map(([k, l]) => `<label class="chip ${e.regions_mode === k ? 'on' : ''}"><input type="radio" name="rm" data-k="entry.regions_mode" value="${k}" data-rerender="1" ${e.regions_mode === k ? 'checked' : ''} hidden>${l}</label>`).join('')}</div>
      ${e.regions_mode !== 'all' ? `<div class="states">${M.regions.map(r => `<label class="st ${e.regions.includes(r) ? 'on' : ''}"><input type="checkbox" data-act="region" value="${r}" ${e.regions.includes(r) ? 'checked' : ''}>${r}</label>`).join('')}</div><small class="muted">Players confirm their state when they enter.</small>` : ''}
      <h3>Entry checklist</h3>
      <p class="small muted">Required steps must be verified by the server. A player checkbox is never proof. Use automatic game-run verification for the built-in option; external membership/actions remain blocked until a trusted platform integration can verify them.</p>
      \${(e.checklist || []).map((step, i) => \`<div class="card pad sub"><div class="form-grid">
        \${field('Step ' + (i + 1), inp('entry.checklist.' + i + '.label', 'maxlength="120" placeholder="e.g. Join the linked channel"'))}
        \${field('Destination URL (optional)', inp('entry.checklist.' + i + '.url', 'maxlength="300" placeholder="https://..."'))}
        <label class="field"><span>Verification method</span><select data-k="entry.checklist.\${i}.verify"><option value="external" \${step.verify !== 'hub_run' ? 'selected' : ''}>External action (blocked until trusted integration)</option><option value="hub_run" \${step.verify === 'hub_run' ? 'selected' : ''}>Automatic: valid game run during this giveaway</option></select></label>
      </div><div class="btn-row"><label class="small"><input type="checkbox" data-k="entry.checklist.\${i}.required" data-type="bool" \${step.required !== false ? 'checked' : ''}> Required</label>
      <button type="button" class="btn sm danger" data-act="checklist-rm" data-index="\${i}">Remove step</button></div></div>\`).join('')}
      <button type="button" class="btn sm" data-act="checklist-add" \${(e.checklist || []).length >= 8 ? 'disabled' : ''}>+ Add checklist step</button>
      <div class="note-box">Security rule: required external steps do not pass on player confirmation. Connect an authenticated platform API/bot integration before making external membership a required condition.</div>
      <h3>Brand + sponsor</h3>${toggle('entry.brand_only', e.brand_only, 'Brand members only', S.d.basics.channel_id ? 'Same as "Who can enter" on Basics.' : 'Pick a brand on Basics first.', `data-rerender="1" ${S.d.basics.channel_id ? '' : 'disabled'}`)}
      ${toggle('entry.follow_sponsor', e.follow_sponsor, 'Require following the sponsor', 'This requires the player to be a member of the selected brand. It does not connect or transfer ownership of their personal channel.', `data-rerender="1" ${S.d.basics.channel_id ? '' : 'disabled'}`)}
      <h3>Bonus entries (random draws only)</h3>${toggle('entry.activity_weight', e.activity_weight, 'Activity entries', '1 entry + 1 more per 5 runs in the window (max 5).')}
      ${toggle('entry.quest_bonus.on', e.quest_bonus.on, 'Bonus entries for daily quests', '', 'data-rerender="1"')}${e.quest_bonus.on ? `<div class="form-grid sub">${field('Quests per bonus entry', num('entry.quest_bonus.per', 1, 10))}${field('Max quest bonus entries', num('entry.quest_bonus.max', 1, 20))}</div>` : ''}
      ${toggle('entry.referral_bonus.on', e.referral_bonus.on, 'Referral bonus entries', 'One per invited friend who plays in the window.', 'data-rerender="1"')}${e.referral_bonus.on ? `<div class="form-grid sub">${field('Max referral bonus entries', num('entry.referral_bonus.max', 1, 20))}</div>` : ''}
      ${plan(S.d).method === 'score' && (e.quest_bonus.on || e.referral_bonus.on || e.activity_weight) ? `<div class="warn-box">${icon('info')} Bonus entries only change random draws; this giveaway is ranked by score, so they have no effect.</div>` : ''}`;
  },
  features() {
    const groups = {}; for (const [k, l, g, h] of M.features) (groups[g] = groups[g] || []).push([k, l, h]);
    const f = S.d.features; const anyLink = f.link_giveaway || f.link_channel || f.link_game || f.link_announcement;
    return `<h2>${icon('sparkles')} Features</h2>${errBox('features')}<p class="small muted">Every feature the old Basic / Premium / Elite packages and add-ons had, as separate switches.</p>
      ${Object.entries(groups).map(([g, list]) => `<div class="fgroup"><h3>${esc(g)}</h3>${list.map(([k, l, h]) => toggle('features.' + k, f[k], esc(l), esc(h || ''), k === 'hidden_board' || k.startsWith('link_') ? 'data-rerender="1"' : '')).join('')}</div>`).join('')}
      ${anyLink ? `<div class="form-grid">${field('Sponsor link (https://)', inp('features.link_url', 'placeholder="https://"'))}${field('Link label', inp('features.link_label', 'maxlength="40" placeholder="Visit the sponsor"'))}</div>` : ''}`;
  },
  winners() {
    const w = S.d.winners; const p = plan(S.d);
    return `<h2>${icon('crown')} Winner handling</h2>${errBox('winners')}
      <div class="card pad sub"><h3>${icon('list-ordered')} Deterministic tiebreakers</h3><ol class="tb">${TIEBREAKS.map(t => `<li>${t}</li>`).join('')}</ol><p class="small muted">Final standings lock at the end time and are published with a SHA-256 hash of every entrant line.</p>
        ${p.method !== 'score' ? `<h3>${icon('shuffle')} Verifiable draw</h3><p class="small muted">A SHA-256 commitment of the secret seed is published before it starts; the seed is revealed at the end, so anyone can re-run the draw from the published entrant list.</p>` : ''}</div>
      ${toggle('winners.review', w.review, 'Review queue before winners are confirmed', 'Winners stay "pending verification" until an admin confirms them (21+, fair play).')}
      ${toggle('features.potato_contact', S.d.features.potato_contact, 'Contact winners on Potato', 'Trap Tech messages each winner using the Potato username on their account.')}
      <div class="form-grid">${field('Claim deadline (hours)', num('winners.claim_hours', 1, 2160), `${dur(w.claim_hours * 3600e3)} after results lock`)}${field('Alternate winners', num('winners.alternates', 0, 50), 'Next in line if a winner is disqualified or doesn\'t claim')}</div>
      ${toggle('winners.auto_forfeit', w.auto_forfeit, 'Auto-forfeit unclaimed prizes', 'After the deadline the next alternate is promoted automatically.')}
      ${toggle('winners.announce', w.announce, 'Public winners announcement', 'Post the winners to Community + notify players (you press "Announce" after confirming).')}`;
  },
  rules() {
    const r = S.d.rules;
    return `<h2>${icon('scale')} Official rules</h2>${errBox('rules')}
      ${field('Additional house rules (plain text)', `<textarea class="input" rows="3" data-k="rules.house" maxlength="2000">${esc(r.house)}</textarea>`, 'Added as the last section of the Official Rules.')}
      <div class="row-btns"><button type="button" class="btn" data-act="gen-rules">${icon('wand-sparkles')} ${r.official ? 'Regenerate from settings' : 'Generate Official Rules'}</button>${r.edited ? pill('edited by hand', 'gold') : r.official ? pill('generated', 'green') : ''}</div>
      <p class="small muted">Built from the hub's rules template with this giveaway's dates, games, scoring, prizes, entry rules and winner handling. Edit below before publishing; regenerating replaces your edits. If you never edit them, they regenerate automatically on publish.</p>
      <div class="rules-ed input" contenteditable="true" id="rules-ed" data-k="rules.official" data-type="html-rules" aria-label="Official rules editor">${r.official || '<p class="muted">Not generated yet.</p>'}</div>`;
  },
  review() {
    const v = S.v || { errors: [], warnings: [] }; const p = plan(S.d); const s = S.d.schedule;
    const rows = [['Title', esc(S.d.basics.title || '-')], ['Audience', S.d.basics.hub_wide ? 'Open to everyone' : 'Brand members only'], ['When', `${dtz(s.start_at)} → ${dtz(s.end_at)} (${dur(s.end_at - s.start_at)})`],
      ['Publishing', s.publish_mode === 'schedule' ? `Scheduled for ${dtz(s.publish_at)}` : 'On publish'], ['Repeats', s.recur.freq ? `${s.recur.freq}, every ${s.recur.every}${s.recur.count ? `, ${s.recur.count} times` : ''}` : 'No'],
      ['Games', S.d.games.ids.map(id => `${esc(gameOf(id).title)}${S.d.games.weights[id] !== 1 ? ` x${S.d.games.weights[id]}` : ''}`).join(', ') || '-'], ['Score rule', esc(M.score_rules[S.d.games.score_rule])], ['Format', compLine(S.d)], ['Anti-cheat', esc([...new Set(S.d.games.ids.map(id => ((M.profiles || {})[id] || {}).anticheat_level || 'L2'))].join(', ')) + ` • ${esc(M.winner_rule)}`],
      ['Prizes', `${S.d.prizes.length} prizes, ${p.winners} winners, ${money(p.arv)} total`], ['Winners', METHOD[p.method]], ['Features', M.features.filter(([k]) => S.d.features[k]).map(([, l]) => esc(l)).join(', ') || 'None']];
    return `<h2>${icon('rocket')} Review &amp; publish</h2>
      ${v.errors.length ? `<div class="err-box"><b>Fix these before publishing:</b>${v.errors.map(e => `<div><a href="#" data-goto="${e.step}">${esc(STEPS.find(x => x[0] === e.step)[1])}</a>: ${esc(e.msg)}</div>`).join('')}</div>` : `<div class="ok-box">${icon('circle-check')} Ready to ${s.publish_mode === 'schedule' ? 'schedule' : 'publish'}.</div>`}
      ${v.warnings.length ? `<div class="warn-box">${v.warnings.map(w => `<div>${icon('triangle-alert')} ${esc(w.msg)}</div>`).join('')}</div>` : ''}
      <table class="tbl kv"><tbody>${rows.map(([k, val]) => `<tr><th>${k}</th><td>${val}</td></tr>`).join('')}</tbody></table>
      <div class="row-btns"><button type="button" class="btn" data-act="publish" ${v.errors.length || !can('giveaways.publish') ? 'disabled' : ''}>${icon('rocket')} ${s.publish_mode === 'schedule' ? 'Schedule' : S.draft.giveaway_id ? 'Apply changes' : 'Publish now'}</button>
        <button type="button" class="btn ghost" data-act="template">${icon('bookmark-plus')} Save as template</button><button type="button" class="btn ghost" data-act="full-prev">${icon('eye')} Full preview</button></div>
      ${!can('giveaways.publish') ? '<p class="small muted">Your role can build drafts; an admin publishes them.</p>' : ''}`;
  },
};
function form() { const el = document.getElementById('bf'); el.innerHTML = FORMS[S.step](); }

// ---------- input + actions ----------
function onInput(e) {
  const ax = e.target.closest('[data-act]'); if (ax && (ax.tagName === 'SELECT' || ax.type === 'number')) { if (e.type === 'change') onClick(e); return; }
  const el = e.target.closest('[data-k]'); if (!el) return;
  if (e.type === 'input' && (el.type === 'radio' || el.tagName === 'SELECT' || el.type === 'checkbox')) return;
  if (e.type === 'change' && ['text', 'number', 'textarea', 'url'].includes(el.type || el.tagName.toLowerCase()) && !el.dataset.rerender) return;
  const k = el.dataset.k; let v;
  if (el.dataset.type === 'html') v = el.innerHTML; else if (el.dataset.type === 'bool') v = !!el.checked; else if (el.dataset.type === 'html-rules') { v = el.innerHTML; S.d.rules.edited = true; }
  else if (el.dataset.type === 'date') v = el.value ? Date.parse(el.value + 'T23:59:00') : null;
  else v = readInput(el);
  if (k === 'basics.channel_id') { v = +v || null; if (!v) { S.d.basics.hub_wide = true; S.d.entry.brand_only = false; S.d.entry.follow_sponsor = false; } }
  if (k === 'entry.brand_only' || k === 'entry.follow_sponsor') { if (v) S.d.basics.hub_wide = false; else if (k === 'entry.brand_only') { S.d.basics.hub_wide = true; S.d.entry.follow_sponsor = false; } }
  if (k === 'basics.slug') v = String(v).toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 60);
  if (k === 'schedule.start_at' && Number.isFinite(v) && S.d.schedule.start_at && S.d.schedule.end_at) { const d = S.d.schedule.end_at - S.d.schedule.start_at; setPath(S.d, k, v); S.d.schedule.end_at = v + d; } // keep the length
  else setPath(S.d, k, v);
  if (k.startsWith('games.weights.')) { const b = el.parentElement.querySelector('b'); if (b) b.textContent = 'x' + (+v).toFixed(1); }
  if (k === 'features.hidden_board' && v) S.d.features.live_standings = false;
  queueSave(); preview();
  if (el.dataset.rerender) { form(); stepper(); }
}
async function onClick(e) {
  const g = e.target.closest('[data-goto]'); if (g) { e.preventDefault(); return go(g.dataset.goto); }
  const rte = e.target.closest('[data-rte]'); if (rte) { e.preventDefault(); const c = rte.dataset.rte; document.getElementById('rte').focus();
    if (c === 'createLink') { const u = await dialog({ title: 'Add link', input: { label: 'https:// link', value: 'https://' }, confirm: 'Add' }); if (u && /^https:\/\//.test(u)) { document.getElementById('rte').focus(); document.execCommand('createLink', false, u); } }
    else if (c === 'h3') document.execCommand('formatBlock', false, 'h3'); else document.execCommand(c, false, null);
    S.d.basics.description = document.getElementById('rte').innerHTML; queueSave(); preview(); return; }
  const a = e.target.closest('[data-act]'); if (!a) return; if (e.type === 'click' && (a.tagName === 'SELECT' || a.type === 'number')) return; const act = a.dataset.act; const d = S.d;
  const prizeI = () => +a.closest('[data-i]').dataset.i; let rerender = true;
  switch (act) {
    case 'slug': d.basics.slug = (d.basics.title || 'giveaway').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50); break;
    case 'aud': d.basics.hub_wide = a.value === 'all'; d.entry.brand_only = !d.basics.hub_wide; if (d.basics.hub_wide) d.entry.follow_sponsor = false; break;
    case 'up-logo': { const u = await cropUpload({ kinds: ['square'], kind: 'logo', title: 'Sponsor logo' }); if (!u) return; d.basics.sponsor_logo = u.square; break; }
    case 'rm-logo': d.basics.sponsor_logo = ''; break;
    case 'src': d.media.source = a.dataset.src; break;
    case 'up-main': { const u = await cropUpload({ kinds: ['card', 'tall', 'square'], kind: 'giveaway', title: 'Giveaway image' }); if (!u) return; Object.assign(d.media, { source: 'upload', image: u.card, image_tall: u.tall || '', image_square: u.square || '', game_thumb: '' }); break; }
    case 'pick': Object.assign(d.media, { image: a.dataset.url, image_tall: '', image_square: '', game_thumb: '' }); break;
    case 'pick-game': Object.assign(d.media, { game_thumb: a.dataset.id, image: gameOf(a.dataset.id).art, image_tall: '', image_square: '' }); break;
    case 'up-banner': { const u = await cropUpload({ kinds: ['banner'], kind: 'banner', title: 'Giveaway banner' }); if (!u) return; d.media.banner = u.banner; break; }
    case 'rm-banner': d.media.banner = ''; break;
    case 'theme': { d.media.theme = a.dataset.theme; [d.media.accent, d.media.accent2] = M.themes[a.dataset.theme]; break; }
    case 'start-now': { const len = (d.schedule.end_at - d.schedule.start_at) || 7 * 864e5; d.schedule.start_at = Math.ceil(Date.now() / 60e3) * 60e3; d.schedule.end_at = d.schedule.start_at + len; break; }
    case 'dur': d.schedule.end_at = (d.schedule.start_at || Date.now()) + +a.dataset.ms; break;
    case 'dur-custom': { const ms = ((+document.getElementById('cd-d').value || 0) * 864e5) + ((+document.getElementById('cd-h').value || 0) * 3600e3) + ((+document.getElementById('cd-m').value || 0) * 60e3); if (ms < 60e3) { toast('At least 1 minute'); return; } d.schedule.end_at = (d.schedule.start_at || Date.now()) + ms; break; }
    case 'game': { const was = d.games.ids.length; const ids = new Set(d.games.ids); a.checked ? ids.add(a.value) : ids.delete(a.value); d.games.ids = [...ids]; for (const id of d.games.ids) d.games.weights[id] = d.games.weights[id] || 1;
      if (a.checked && (was === 0 || (was === 1 && d.games.profile_from && !ids.has(d.games.profile_from)) || (!d.games.profile_from && was <= 1))) applyDefaults(d, a.value, { schedule: true });
      else if (!a.checked && d.games.ids.length === 1 && d.games.profile_from === a.value) applyDefaults(d, d.games.ids[0], { schedule: false });
      break; }
    case 'use-prof': applyDefaults(d, a.dataset.id, { schedule: true }); break;
    case 'fmt': { const f = FORMATS[+a.dataset.i]; const gm = M.games.find(x => x.id === f.game && x.eligible); if (gm) { d.games.ids = [gm.id]; d.games.weights = { [gm.id]: 1 }; } else if (!d.games.ids.length) { const g0 = M.games.find(x => x.eligible); if (g0) d.games.ids = [g0.id]; }
      Object.assign(d.games, { competition: { level_from: 0, level_to: 0, ...f.comp }, score_rule: f.rule, attempts: f.attempts, run_cap_sec: f.cap, profile_from: gm ? gm.id : d.games.profile_from });
      d.schedule.end_at = (d.schedule.start_at || Date.now()) + f.hours * 3600e3; toast(`Format applied: ${f.label} (${dur(f.hours * 3600e3)})`); break; }
    case 'ctype': { const ms = Object.keys(M.comp[a.value].metrics); d.games.competition = { ...d.games.competition, type: a.value, metric: ms[0], ...(a.value === 'campaign' ? { level_from: d.games.competition.level_from || 1, level_to: d.games.competition.level_to || 30 } : {}) };
      const m = M.comp[a.value].metrics[ms[0]]; if (m) { d.games.score_rule = m[1]; if (m[2]) { if (m[2].cap) d.games.run_cap_sec = m[2].cap; if (m[2].attempts) d.games.attempts = m[2].attempts; } } break; }
    case 'metric': { d.games.competition.metric = a.value; const m = M.comp[d.games.competition.type].metrics[a.value]; if (m) { d.games.score_rule = m[1]; if (m[2] && m[2].cap) d.games.run_cap_sec = m[2].cap; if (m[2] && m[2].attempts) d.games.attempts = m[2].attempts; } break; }
    case 'att-mode': d.games.attempts = a.value === 'n' ? (d.games.attempts || 3) : 0; break;
    case 'cap': d.games.run_cap_sec = Math.max(0, Math.round((+a.value || 0) * 60)); rerender = false; break;
    case 'checklist-add': if (d.entry.checklist.length < 8) d.entry.checklist.push({ id: 'step' + Date.now().toString(36), label: '', url: '', required: true, attestation: true }); break;
    case 'checklist-rm': d.entry.checklist.splice(+a.dataset.index, 1); break;
    case 'region': { const s = new Set(d.entry.regions); a.checked ? s.add(a.value) : s.delete(a.value); d.entry.regions = [...s].sort(); rerender = false; a.parentElement.classList.toggle('on', a.checked); break; }
    case 'pz-add': d.prizes.push({ id: 'p' + Date.now().toString(36), name: '', desc: '', image: '', qty: 1, value: 0, type: 'physical', award: 'rank' }); break;
    case 'pz-rm': { const i = prizeI(); if (d.prizes.length > 1 || await dialog({ title: 'Remove the only prize?', confirm: 'Remove', danger: true })) d.prizes.splice(i, 1); break; }
    case 'pz-dup': { const i = prizeI(); d.prizes.splice(i + 1, 0, { ...d.prizes[i], id: 'p' + Date.now().toString(36) }); break; }
    case 'pz-up': case 'pz-down': { const i = prizeI(); const j = act === 'pz-up' ? i - 1 : i + 1; [d.prizes[i], d.prizes[j]] = [d.prizes[j], d.prizes[i]]; break; }
    case 'pz-img': { const i = prizeI(); const u = await cropUpload({ kinds: ['square'], kind: 'prize', title: 'Prize image' }); if (!u) return; d.prizes[i].image = u.square; break; }
    case 'gen-rules': { if (d.rules.edited && !(await dialog({ title: 'Replace your edits?', body: '<p>Regenerating replaces the hand-edited rules.</p>', confirm: 'Regenerate', danger: true }))) return; await saveNow(); const r = await api(`/api/admin/v7/gw/drafts/${S.id}/rules`, { method: 'POST', body: { apply: true } }); if (!r.ok) return toast(r.error); d.rules.official = r.html; d.rules.edited = false; S.base = Date.now(); toast('Official Rules generated'); break; }
    case 'publish': return publish();
    case 'template': { const n = await dialog({ title: 'Save as template', input: { label: 'Template name', value: d.basics.title || 'My template' }, confirm: 'Save' }); if (!n) return; await saveNow(); if (S.draft.giveaway_id) { const r = await api(`/api/admin/v7/gw/${S.draft.giveaway_id}/act/template`, { method: 'POST', body: { name: n } }); toast(r.ok ? 'Template saved' : r.error); } else { toast('Publish once to save it as a template, or duplicate it later.'); } return; }
    case 'full-prev': return fullPreview();
    default: return;
  }
  queueSave(); if (rerender) { form(); stepper(); } preview();
}
async function moreMenu() {
  const r = await dialog({ title: 'Draft actions', body: `<div class="menu-list"><button class="btn ghost block" data-m="dup">${icon('copy')} Duplicate this draft</button><button class="btn ghost block" data-m="prev">${icon('eye')} Full preview</button><button class="btn ghost block danger-t" data-m="del">${icon('trash-2')} Delete draft</button></div>`, confirm: 'Close', cancel: 'Cancel' });
  void r;
}
document.addEventListener('click', async (e) => {
  const m = e.target.closest('[data-m]'); if (!m || !S.id) return; const wrap = m.closest('.v7dlg-wrap'); if (wrap) wrap.remove();
  if (m.dataset.m === 'prev') return fullPreview();
  if (m.dataset.m === 'dup') { await saveNow(); const r = await api('/api/admin/v7/gw/drafts', { method: 'POST', body: { data: S.d } }); if (r.ok) { toast('Duplicated'); C.nav(`/admin/giveaways/draft/${r.id}?step=basics`); } return; }
  if (m.dataset.m === 'del') { if (!(await dialog({ title: 'Delete this draft?', body: '<p>The draft is removed. Published giveaways are not affected.</p>', confirm: 'Delete', danger: true }))) return; clearTimeout(S.timer); S.pending = false; await api(`/api/admin/v7/gw/drafts/${S.id}`, { method: 'DELETE' }); localStorage.removeItem('gwdraft:' + S.id); toast('Draft deleted'); S.id = 0; C.nav('/admin/giveaways'); }
});

// ---------- autosave ----------
function queueSave(ms = 1200, manual = false) {
  S.pending = true; try { localStorage.setItem('gwdraft:' + S.id, JSON.stringify({ at: Date.now(), d: S.d })); } catch {}
  saveState(); clearTimeout(S.timer); S.timer = setTimeout(() => saveNow(manual), ms);
}
async function saveNow(manual = false, force = false) {
  clearTimeout(S.timer); if (!S.pending && !manual) return; if (S.saving) { S.timer = setTimeout(() => saveNow(manual), 400); return; }
  S.saving = true; S.pending = false; saveState(); const id = S.id;
  try {
    const r = await api(`/api/admin/v7/gw/drafts/${id}`, { method: 'PUT', body: { data: S.d, base: S.base, force } });
    if (id !== S.id) return;
    if (r.conflict) { S.saving = false; if (await dialog({ title: 'Draft changed elsewhere', body: `<p>${esc(r.error)}</p>`, confirm: 'Overwrite with mine', cancel: 'Reload theirs' })) return saveNow(true, true); return builder(id); }
    if (!r.ok) { S.pending = true; toast(r.error || 'Save failed'); }
    else { S.saved_at = r.saved_at; S.base = r.saved_at; S.v = r.validation; localStorage.removeItem('gwdraft:' + id); if (manual) toast('Draft saved');
      if (!S.pending) S.d = r.data; // server-normalised copy (only when nothing new was typed meanwhile)
      stepper(); if (S.step === 'review') form(); }
  } catch (e) { S.pending = true; } finally { S.saving = false; saveState(); }
}
function saveState() { const el = document.getElementById('sst'); if (!el) return; el.textContent = S.saving ? 'Saving…' : S.pending ? 'Unsaved changes' : S.saved_at ? `Saved ${new Date(S.saved_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''; el.className = 'save-st ' + (S.pending ? 'pend' : 'ok'); }

async function publish() {
  await saveNow(true); if (S.v && S.v.errors.length) { toast(S.v.errors[0].msg); return go('review'); }
  const sch = S.d.schedule.publish_mode === 'schedule';
  if (!(await dialog({ title: S.draft.giveaway_id ? 'Apply changes to the live giveaway?' : sch ? 'Schedule this giveaway?' : 'Publish this giveaway?', body: `<p><b>${esc(S.d.basics.title)}</b><br>${dtz(S.d.schedule.start_at)} → ${dtz(S.d.schedule.end_at)}${S.d.schedule.recur.freq ? `<br>Repeats ${S.d.schedule.recur.freq}` : ''}</p>${S.d.features.notify_announce && !S.draft.giveaway_id ? '<p class="small muted">Players get a "New giveaway" notification.</p>' : ''}`, confirm: S.draft.giveaway_id ? 'Apply' : sch ? 'Schedule' : 'Publish' }))) return;
  const r = await api(`/api/admin/v7/gw/drafts/${S.id}/publish`, { method: 'POST' });
  if (!r.ok) { if (r.errors) { S.v = { errors: r.errors, warnings: r.warnings || [] }; go('review'); } return toast(r.error || 'Could not publish'); }
  localStorage.removeItem('gwdraft:' + S.id); S.pending = false; S.id = 0; window.onbeforeunload = null;
  toast(r.state === 'scheduled' ? 'Scheduled' : 'Published'); C.nav(`/admin/giveaways/${r.id}`);
}

// ---------- live preview (same markup + classes as the public site) ----------
function cardHTML(d) {
  const p = plan(d); const img = d.media.image; const st = d.schedule.start_at > Date.now() ? 'upcoming' : 'active';
  const brand = M.brands.find(b => b.id === +d.basics.channel_id);
  return `<div class="card gw branded ${d.features.featured ? 'feat' : ''}" style="${d.features.branding ? `--brand:${d.media.accent};` : ''}">
    <div class="row"><div>${d.basics.hub_wide ? `<span class="tier-pill">${icon('globe')}Open to everyone</span>` : `<span class="tier-pill">${icon('store')}${esc(brand ? brand.name : 'Brand')} members</span>`}${d.features.featured ? `<span class="tier-pill feat">${icon('sparkles')}Featured</span>` : ''}
      <h3>${esc(d.basics.title || 'Untitled giveaway')}</h3><div class="host">Hosted by ${esc(d.basics.sponsor || 'Trap Tech Solutions')}</div>${d.basics.subtitle ? `<div class="small muted">${esc(d.basics.subtitle)}</div>` : ''}
      ${d.features.branding && d.basics.sponsor_logo ? `<img class="brand-logo" src="${esc(d.basics.sponsor_logo)}" alt="">` : ''}</div>${img ? `<div class="art" style="background-image:url('${esc(img)}')"></div>` : '<div></div>'}</div>
    <div class="gw-games">${d.games.ids.map(id => `<span class="gchip"><img src="${esc(gameOf(id).art)}" alt="">${esc(gameOf(id).title)}</span>`).join('')}${d.games.min_score ? `<span class="gchip rule">${icon('target')} Min ${fmt(d.games.min_score)}</span>` : ''}${p.places.length > 1 ? `<span class="gchip rule">${icon('trophy')} ${p.places.length} prize tiers</span>` : ''}</div>
    <div class="cd-fake"><b>${dur(st === 'upcoming' ? d.schedule.start_at - Date.now() : d.schedule.end_at - Math.max(Date.now(), d.schedule.start_at))}</b><span>${st === 'upcoming' ? 'until it starts' : 'left'}</span></div>
    <span class="btn block">${st === 'active' ? 'Enter Now' : 'View Details'}</span></div>`;
}
function pageHTML(d) {
  const p = plan(d);
  return `<div class="pv-page" style="--brand:${d.media.accent};--brand2:${d.media.accent2}">${d.media.banner ? `<div class="pv-ban" style="background-image:url('${esc(d.media.banner)}')"></div>` : ''}
    <h1 class="pv-t">${esc(d.basics.title || 'Untitled giveaway')}</h1>${d.basics.subtitle ? `<p class="muted">${esc(d.basics.subtitle)}</p>` : ''}${cardHTML(d)}
    ${d.basics.description ? `<div class="card pad pv-desc">${d.basics.description}</div>` : ''}
    <div class="card pad"><h2>${icon('gift')} Prizes</h2>${p.places.map(x => `<div class="pv-prize">${x.p.image ? `<img src="${esc(x.p.image)}" alt="">` : `<span class="pz-ic">${icon(x.p.award === 'random' ? 'shuffle' : x.from === 1 ? 'crown' : 'trophy')}</span>`}<div><b>${esc(x.label)}: ${esc(x.p.name || 'Prize')}</b>${x.p.desc ? `<div class="small muted">${esc(x.p.desc)}</div>` : ''}<div class="tiny muted">${esc(M.prize_types[x.p.type] || '')}${x.p.value ? ` • ${money(x.p.value)}${x.p.qty > 1 ? ' each' : ''}` : ''}</div></div></div>`).join('')}<div class="small muted">Total value ${money(p.arv)} • ${METHOD[p.method]}</div></div>
    <div class="card pad"><h2>${icon('shield-check')} Who can enter</h2><ul class="pv-rules">${[d.entry.age21 ? '21 or older' : '', d.basics.hub_wide ? 'Open to every eligible player' : 'Brand members only', d.entry.elig_account_age_days ? `Account ${d.entry.elig_account_age_days}+ days old` : '', d.entry.elig_min_runs7 ? `${d.entry.elig_min_runs7}+ runs in the last 7 days` : '', d.entry.regions_mode === 'allow' ? `Only: ${d.entry.regions.join(', ')}` : d.entry.regions_mode === 'exclude' ? `Not in: ${d.entry.regions.join(', ')}` : '', d.games.min_runs ? `At least ${d.games.min_runs} runs to be ranked` : '', d.entry.max_entrants ? `First ${fmt(d.entry.max_entrants)} entrants` : ''].filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="small muted">${compLine(d)} • ${esc(M.score_rules[d.games.score_rule])}${d.features.hidden_board ? ' • Leaderboard hidden until the end' : ''}</p></div>
    ${d.entry.checklist && d.entry.checklist.length ? `<div class="card pad"><h2>Entry checklist</h2><ul class="pv-rules">${d.entry.checklist.map(x => `<li>${esc(x.label || 'Untitled step')}${x.required === false ? ' (optional)' : ' (required)'}${x.url ? ' • destination link included' : ''}</li>`).join('')}</ul><p class="tiny muted">External actions are self-attested unless a verified integration is connected.</p></div>` : ''}
    <p class="tiny muted center">NO PURCHASE NECESSARY. 21+. Void where prohibited. Operated by Trap Tech Solutions. See Official Rules.</p></div>`;
}
let pvT = null;
function preview() { clearTimeout(pvT); pvT = setTimeout(() => { const el = document.getElementById('pv'); if (!el || !S.d) return; document.querySelectorAll('#bp [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === S.view)); document.querySelectorAll('#bp [data-dev]').forEach(b => b.classList.toggle('on', b.dataset.dev === S.device));
  el.className = 'pv ' + (S.device === 'phone' ? 'pv-phone' : 'pv-desk'); el.innerHTML = S.view === 'card' ? `<div class="pv-label">Giveaways list card</div>${cardHTML(S.d)}` : pageHTML(S.d); }, 120); }
async function fullPreview() {
  await dialog({ title: 'Preview', body: `<div class="pv pv-phone pv-full">${pageHTML(S.d)}</div>${S.d.rules.official ? `<details class="card pad"><summary>Official Rules</summary><div class="rules-pv">${S.d.rules.official}</div></details>` : ''}`, confirm: 'Close', cancel: 'Back' });
}

// v7 item 22b: Game Rules Profiles - one metadata card per game (Reese's master catalog brief) + editor + catalog importer.
import { C, esc, fmt, api, toast, dialog, icon, dday, can, pill, qs, tabs } from './admin-shared.js';
const val = (d, s) => { const e = d.querySelector(s); return e ? e.value : ''; };
const acCls = { L1: '', L2: 'blue', L3: 'violet', L4: 'green' };

export async function profiles() {
  const r = await api('/api/admin/v7/profiles'); const tab = qs('tab') || 'hub'; const q = (qs('q') || '').toLowerCase();
  const hub = r.profiles.filter(p => p.linked), refs = r.profiles.filter(p => !p.linked);
  const card = (p) => `<div class="card pad prof-card ${p.giveaway_compatible ? '' : 'dim'}" data-p="${esc(p.game_id)}"><div class="pc-h"><b>${esc(p.hub_version || p.game)}</b>${p.linked ? '' : pill('not in hub yet')}<span class="pill">${esc(p.recognition_tier)}</span><span class="pill ${acCls[p.anticheat_level] || ''}" title="${esc(r.ac_levels[p.anticheat_level])}">${icon('shield-check')} ${esc(p.anticheat_level)}</span>${p.source !== 'default' ? pill(p.source, 'gold') : ''}</div>
    <dl class="pc-dl"><dt>Game</dt><dd>${esc(p.game)}</dd><dt>Category</dt><dd>${esc(p.category)}</dd><dt>Competition</dt><dd>${esc((r.comp[p.competition_type] || {}).label)}: ${esc(p.metric_label)}${p.competition_type === 'campaign' ? ` (levels ${p.level_from}-${p.level_to})` : ''}</dd>
      <dt>Endless</dt><dd>${p.endless ? 'Y' : 'N'}</dd><dt>Giveaway compatible</dt><dd>${p.giveaway_compatible ? `<span class="pos">Yes</span>` : `<span class="neg">No</span>${p.chance_locked ? ' (chance game)' : ''}`}</dd><dt>Scoring</dt><dd>${esc(p.scoring || '-')}</dd>
      <dt>Attempts</dt><dd>${p.attempts ? 'Best of ' + p.attempts : 'Unlimited'}</dd><dt>Run cap</dt><dd>${p.run_cap_sec ? Math.round(p.run_cap_sec / 60 * 10) / 10 + ' min' : 'None'}</dd><dt>Recommended length</dt><dd>${esc(p.recommended_length || '-')}</dd>
      <dt>Anti-cheat</dt><dd>${esc(r.ac_levels[p.anticheat_level])}</dd><dt>Leaderboard</dt><dd>${esc(p.leaderboard || '-')}</dd><dt>Winner rule</dt><dd>${esc(p.winner_rule)}</dd><dt>Source</dt><dd>${esc(r.sources[p.source_tier] || p.source_tier)}${p.licence ? ' • ' + esc(p.licence) : ''}</dd>${p.notes ? `<dt>Notes</dt><dd>${esc(p.notes)}</dd>` : ''}</dl>
    <div class="row-btns">${can('games.profiles') ? `<button class="btn sm ghost" data-x="edit">${icon('pencil')} Edit</button>${p.linked && p.source !== 'default' ? `<button class="btn sm ghost" data-x="reset">Reset to default</button>` : ''}${!p.linked ? `<button class="btn sm ghost danger-t" data-x="del">${icon('trash-2')}</button>` : ''}` : ''}${p.linked && p.giveaway_compatible && can('giveaways.edit') ? `<a class="btn sm" href="/admin/giveaways/new?game=${esc(p.game_id)}">${icon('gift')} Giveaway with these defaults</a>` : ''}</div>${p.updated_at ? `<div class="tiny muted">Edited ${dday(p.updated_at)} by ${esc(p.updated_by || '')}</div>` : ''}</div>`;
  const filt = (l) => q ? l.filter(p => `${p.game} ${p.hub_version} ${p.category}`.toLowerCase().includes(q)) : l;
  const counts = Object.keys(r.comp).map(k => `${r.comp[k].label} ${hub.filter(p => p.competition_type === k).length}`).join(' • ');
  C.frame('game-rules', 'Game Rules Profiles', `<p class="small muted">Each game's competition metadata: format, attempts, suggested event length, anti-cheat level and winner rule. The giveaway builder pre-fills from these. The winner rule is always the highest <b>verified</b> score at close.</p>
    <div class="toolbar"><form id="gq" class="grow"><input class="input" name="q" value="${esc(qs('q') || '')}" placeholder="Search games or categories" aria-label="Search profiles"></form>${can('games.profiles') ? `<button class="btn sm" id="g-imp">${icon('upload')} Import catalog JSON</button>${r.hunt_file ? `<button class="btn sm ghost" id="g-hunt">${icon('file-json')} Import docs/exact-game-hunt.json</button>` : ''}<button class="btn sm ghost" id="g-new">${icon('plus')} Add reference game</button>` : ''}<a class="btn sm ghost" href="/api/admin/v7/profiles/export" download>${icon('download')} Export</a></div>
    <div class="small muted">${counts}</div>
    ${tabs([['hub', 'Hub games', hub.length], ['refs', 'Catalog references', refs.length], ['levels', 'Anti-cheat levels']], tab, '/admin/game-rules')}
    ${tab === 'levels' ? `<div class="card pad">${Object.entries(r.ac_levels).map(([k, v]) => `<p>${pill(k, acCls[k])} ${esc(v)}</p>`).join('')}<p class="small muted">Every giveaway run passes the server checks for its level: rate ceilings (score per second of server-measured play), input telemetry, history checks and, for L4 games, a full server-side replay. Runs held for review only count once a moderator clears them.</p></div>`
      : `<div class="prof-grid">${filt(tab === 'refs' ? refs : hub).map(card).join('') || `<div class="empty card">${tab === 'refs' ? 'No catalog references yet. Import the research worker\'s docs/exact-game-hunt.json or add one.' : 'No games match.'}</div>`}</div>`}`);
  const byId = Object.fromEntries(r.profiles.map(p => [p.game_id, p]));
  document.getElementById('gq').onsubmit = (e) => { e.preventDefault(); C.nav(`/admin/game-rules?tab=${tab}&q=${encodeURIComponent(new FormData(e.target).get('q'))}`); };
  document.querySelectorAll('[data-p] [data-x]').forEach(b => b.onclick = async () => {
    const p = byId[b.closest('[data-p]').dataset.p];
    if (b.dataset.x === 'edit') return editProfile(r, p);
    if (b.dataset.x === 'reset' && await dialog({ title: `Reset ${p.hub_version} to the built-in profile?`, confirm: 'Reset' })) { const x = await api(`/api/admin/v7/profiles/${encodeURIComponent(p.game_id)}`, { method: 'DELETE' }); toast(x.ok ? 'Reset' : x.error); profiles(); }
    if (b.dataset.x === 'del' && await dialog({ title: `Delete the ${p.game} reference?`, confirm: 'Delete', danger: true })) { const x = await api(`/api/admin/v7/profiles/${encodeURIComponent(p.game_id)}`, { method: 'DELETE' }); toast(x.ok ? 'Deleted' : x.error); profiles(); }
  });
  const nb = document.getElementById('g-new'); if (nb) nb.onclick = async () => { const n = await dialog({ title: 'Add a catalog reference', body: '<p class="small muted">A game from the master catalog that is not in the hub yet.</p>', input: { label: 'Game name (e.g. Tetris)' }, confirm: 'Next' }); if (!n) return;
    editProfile(r, { game_id: 'ref:' + n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 56), game: n, hub_version: '', linked: false, category: r.categories[0], recognition_tier: 'A', competition_type: 'endless', metric: 'score', endless: true, giveaway_compatible: true, attempts: 0, recommended_hours: 72, anticheat_level: 'L2', winner_rule: r.winner_rule, source_tier: 'build' }); };
  const ib = document.getElementById('g-imp'); if (ib) ib.onclick = () => importFlow(r, null);
  const hb = document.getElementById('g-hunt'); if (hb) hb.onclick = () => importFlow(r, 'file');
}

function editProfile(r, p) {
  const metrics = (t) => Object.entries(r.comp[t].metrics).map(([k, v]) => `<option value="${k}" ${p.metric === k ? 'selected' : ''}>${esc(v[0])}</option>`).join('');
  setTimeout(() => { const d = document.querySelector('.v7dlg'); if (!d) return; const sync = () => { const t = val(d, '#pf-t'); d.querySelectorAll('.k-camp').forEach(x => x.hidden = t !== 'campaign'); };
    d.querySelector('#pf-t').addEventListener('change', (e) => { d.querySelector('#pf-m').innerHTML = metrics(e.target.value); sync(); }); sync(); }, 30);
  return dialog({ title: `Rules profile: ${p.hub_version || p.game}`, wide: true, confirm: 'Save profile', body: `<div class="form-grid">
    <label class="fld"><span class="fl">Game (reference)</span><input class="input" id="pf-g" maxlength="80" value="${esc(p.game || '')}"></label><label class="fld"><span class="fl">Hub version</span><input class="input" id="pf-h" maxlength="80" value="${esc(p.hub_version || '')}" ${p.linked ? 'readonly' : ''}></label>
    <label class="fld"><span class="fl">Category</span><input class="input" id="pf-c" list="pf-cats" maxlength="60" value="${esc(p.category || '')}"><datalist id="pf-cats">${r.categories.map(c => `<option value="${esc(c)}">`).join('')}</datalist></label>
    <label class="fld"><span class="fl">Recognition tier</span><select class="input" id="pf-r">${r.tiers.map(t => `<option ${t === p.recognition_tier ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="fld"><span class="fl">Competition type</span><select class="input" id="pf-t">${Object.entries(r.comp).map(([k, v]) => `<option value="${k}" ${k === p.competition_type ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select></label>
    <label class="fld"><span class="fl">Scored on</span><select class="input" id="pf-m">${metrics(r.comp[p.competition_type] ? p.competition_type : 'endless')}</select></label>
    <label class="fld k-camp"><span class="fl">Levels from</span><input class="input" type="number" min="1" max="999" id="pf-lf" value="${p.level_from || 1}"></label><label class="fld k-camp"><span class="fl">Levels to</span><input class="input" type="number" min="1" max="999" id="pf-lt" value="${p.level_to || 30}"></label>
    <label class="fld"><span class="fl">Attempts (0 = unlimited)</span><input class="input" type="number" min="0" max="100" id="pf-a" value="${p.attempts || 0}"></label><label class="fld"><span class="fl">Run cap (minutes, 0 = none)</span><input class="input" type="number" min="0" max="1440" step="0.5" id="pf-cap" value="${p.run_cap_sec ? p.run_cap_sec / 60 : 0}"></label>
    <label class="fld"><span class="fl">Recommended event length (hours)</span><input class="input" type="number" min="0" max="8784" step="0.25" id="pf-len" value="${p.recommended_hours || 0}"></label>
    <label class="fld"><span class="fl">Anti-cheat level</span><select class="input" id="pf-ac">${Object.entries(r.ac_levels).map(([k, v]) => `<option value="${k}" ${k === p.anticheat_level ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
    <label class="fld full"><span class="fl">Scoring</span><textarea class="input" id="pf-s" rows="2" maxlength="400">${esc(p.scoring || '')}</textarea></label>
    <label class="fld"><span class="fl">Leaderboard</span><input class="input" id="pf-lb" maxlength="120" value="${esc(p.leaderboard || '')}"></label><label class="fld"><span class="fl">Winner rule</span><input class="input" id="pf-w" maxlength="160" value="${esc(p.winner_rule || r.winner_rule)}"></label>
    <label class="fld"><span class="fl">Source</span><select class="input" id="pf-src">${Object.entries(r.sources).map(([k, v]) => `<option value="${k}" ${k === p.source_tier ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label><label class="fld"><span class="fl">Licence</span><input class="input" id="pf-lic" maxlength="120" value="${esc(p.licence || '')}"></label>
    <label class="fld full"><span class="fl">Notes</span><textarea class="input" id="pf-n" rows="2" maxlength="1000">${esc(p.notes || '')}</textarea></label>
    <label class="ck"><input type="checkbox" id="pf-e" ${p.endless ? 'checked' : ''}> Endless</label><label class="ck"><input type="checkbox" id="pf-gc" ${p.giveaway_compatible ? 'checked' : ''} ${p.chance_locked ? 'disabled' : ''}> Giveaway compatible${p.chance_locked ? ' (locked off: chance game)' : ''}</label></div>`,
    collect: (d) => ({ game: val(d, '#pf-g').trim(), hub_version: val(d, '#pf-h').trim(), category: val(d, '#pf-c'), recognition_tier: val(d, '#pf-r'), competition_type: val(d, '#pf-t'), metric: val(d, '#pf-m'), level_from: +val(d, '#pf-lf'), level_to: +val(d, '#pf-lt'),
      attempts: +val(d, '#pf-a'), run_cap_sec: Math.round(+val(d, '#pf-cap') * 60), recommended_hours: +val(d, '#pf-len'), anticheat_level: val(d, '#pf-ac'), scoring: val(d, '#pf-s'), leaderboard: val(d, '#pf-lb'), winner_rule: val(d, '#pf-w'),
      source_tier: val(d, '#pf-src'), licence: val(d, '#pf-lic'), notes: val(d, '#pf-n'), endless: d.querySelector('#pf-e').checked, giveaway_compatible: d.querySelector('#pf-gc').checked }) })
    .then(async (v) => { if (!v) return; const x = await api(`/api/admin/v7/profiles/${encodeURIComponent(p.game_id)}`, { method: 'PUT', body: v }); toast(x.ok ? 'Profile saved' : x.error); if (x.ok) profiles(); });
}

async function importFlow(r, mode) {
  let data = null;
  if (mode !== 'file') {
    const txt = await dialog({ title: 'Import catalog JSON', wide: true, body: `<p class="small muted">Paste the research worker's <code>exact-game-hunt.json</code> (an array of game cards, <code>{"games": [...]}</code>, or an object keyed by game name). Keys can be snake_case or the card labels ("Recognition tier", "Anti-cheat level", ...). You get a preview first.</p>
      <label class="drop small">${icon('upload')} <span>Choose a .json file</span><input type="file" accept="application/json,.json" id="imp-f" hidden></label><textarea class="input mono" id="imp-t" rows="10" placeholder='[{"game":"Tetris","category":"Puzzle and brain","competition_type":"Short session","attempts":"Best of 3","anti_cheat_level":"L3"}]'></textarea>`,
      confirm: 'Preview', collect: (d) => val(d, '#imp-t').trim() || undefined });
    setTimeout(() => {}, 0); if (!txt) return; data = txt;
  }
  const body = mode === 'file' ? { from_file: true } : { data };
  const pv = await api('/api/admin/v7/profiles/import', { method: 'POST', body }); if (!pv.ok) return toast(pv.error);
  const row = (x) => `<tr><td>${esc(x.game || '')}</td><td class="small">${esc(x.id)}</td><td class="small">${esc(x.competition || '')}</td><td>${esc(x.ac || '')}</td><td>${x.giveaway ? 'Y' : 'N'}</td></tr>`;
  const v = await dialog({ title: `Import preview: ${pv.total} entries`, wide: true, confirm: 'Import now', body: `<p><b>${pv.linked.length}</b> match hub games, <b>${pv.refs.length}</b> become catalog references, <b>${pv.skipped.length}</b> skipped, <b>${pv.errors.length}</b> errors.</p>
    <div class="wrap-x" style="max-height:40vh;overflow:auto"><table class="tbl"><thead><tr><th>Game</th><th>Profile</th><th>Competition</th><th>AC</th><th>Giveaway</th></tr></thead><tbody>${[...pv.linked, ...pv.refs].map(row).join('')}</tbody></table></div>
    ${pv.skipped.length ? `<p class="small">Skipped: ${pv.skipped.map(x => `${esc(x.game || x.id)} (${esc(x.why)})`).join('; ')}</p>` : ''}${pv.errors.length ? `<p class="small neg">Errors: ${pv.errors.map(x => `#${x.i + 1} ${esc(x.error)}`).join('; ')}</p>` : ''}
    <label class="ck"><input type="checkbox" id="imp-ow"> Overwrite profiles an admin edited by hand</label>`, collect: (d) => ({ ow: d.querySelector('#imp-ow').checked }) });
  if (!v) return; const x = await api('/api/admin/v7/profiles/import', { method: 'POST', body: { ...body, apply: true, overwrite_admin: v.ow } });
  toast(x.ok ? `Imported ${x.linked.length + x.refs.length} profiles` : x.error); if (x.ok) profiles();
}
// file picker -> textarea (delegated so it works inside the dialog)
document.addEventListener('change', (e) => { if (e.target.id !== 'imp-f' || !e.target.files[0]) return; const f = e.target.files[0]; if (f.size > 1e6) return toast('File is over 1 MB'); f.text().then(t => { const ta = document.getElementById('imp-t'); if (ta) ta.value = t; }); });
void fmt;

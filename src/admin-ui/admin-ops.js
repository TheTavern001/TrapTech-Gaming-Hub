// v7 item 23: live-ops screens - events/specials, seasons, shop, badges, analytics, announcements, site settings.
import { C, esc, fmt, api, toast, dialog, icon, dtz, dshort, dday, dur, can, pill, qs, tabs, toTzInput, fromTzInput, tzLabel, lineChart, bars, funnel, csvDownload } from './admin-shared.js';
import { cropUpload } from './admin-crop.js';
const H = 3600e3, D = 864e5;
const stateCls = { live: 'green', scheduled: 'blue', ended: '', cancelled: 'red', upcoming: 'blue' };
const sp = (s) => pill(s, stateCls[s] || '');
const val = (root, sel) => { const e = root.querySelector(sel); return e ? e.value : ''; };

// ================= events / specials =================
export async function events(id) {
  const r = await api('/api/admin/v7/events'); const tab = qs('tab') || 'upcoming';
  const groups = { upcoming: r.events.filter(e => e.state === 'live' || e.state === 'scheduled'), past: r.events.filter(e => e.state === 'ended' || e.state === 'cancelled') };
  const fx = r.effects || {};
  const live = [fx.points_mult > 1 ? `${fx.points_mult}x Hub Points` : '', fx.xp_mult > 1 ? `${fx.xp_mult}x XP` : '', fx.quest_mult > 1 ? `${fx.quest_mult}x quest points` : '', fx.sale ? `${fx.sale.pct}% shop sale` : '', ...(fx.themes || []).map(t => `Theme: ${t}`)].filter(Boolean);
  const card = (e) => `<div class="card pad ev" data-ev="${e.id}"><div class="ev-h">${icon((r.kinds[e.kind] || {}).icon || 'sparkles')}<b>${esc(e.name)}</b>${sp(e.state)}${e.recur !== 'none' ? pill('repeats ' + e.recur, 'violet') : ''}</div>
    <div class="small muted">${esc(e.kind_label || e.kind)}${e.kind === 'shop_sale' ? ` • ${e.sale_pct}% off ${e.items.length ? e.items.length + ' items' : 'everything'}` : ['double_points', 'xp_boost', 'bonus_quests'].includes(e.kind) ? ` • ${e.multiplier}x` : ''}</div>
    <div class="small">${dtz(e.starts_at)} → ${dtz(e.ends_at)} <span class="muted">(${dur(e.ends_at - e.starts_at)})</span></div>${e.description ? `<p class="small">${esc(e.description)}</p>` : ''}
    <div class="row-btns"><button class="btn sm ghost" data-e="edit">${icon('pencil')} Edit</button>${e.state === 'live' ? `<button class="btn sm ghost" data-e="end">${icon('square')} End now</button>` : ''}${e.state === 'scheduled' || e.state === 'live' ? `<button class="btn sm ghost danger-t" data-e="cancel">Cancel</button>` : ''}${e.state === 'cancelled' ? `<button class="btn sm ghost" data-e="restore">Restore</button>` : ''}<button class="btn sm ghost" data-e="dup">${icon('copy')} Duplicate</button><button class="btn sm ghost danger-t" data-e="del">${icon('trash-2')}</button></div></div>`;
  C.frame('events', 'Specials & events', `<div class="note-box">${icon('zap')} <b>Live now:</b> ${live.length ? live.map(esc).join(' • ') : 'nothing running'}</div>
    <div class="toolbar"><button class="btn" id="ev-new">${icon('plus')} New event</button><div class="chips">${Object.entries(r.kinds).map(([k, v]) => `<button class="chip" data-quick="${k}">${icon(v.icon)} ${esc(v.label)}</button>`).join('')}</div></div>
    ${tabs([['upcoming', 'Live & scheduled', groups.upcoming.length], ['past', 'Past', groups.past.length]], tab, '/admin/events')}<div class="grid2">${(groups[tab] || []).map(card).join('') || '<div class="empty card">No events here. Make one - a themed weekend or double points night keeps players coming back.</div>'}</div>`);
  const byId = Object.fromEntries(r.events.map(e => [e.id, e]));
  document.getElementById('ev-new').onclick = () => evForm(r, {});
  document.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => evForm(r, { kind: b.dataset.quick }));
  document.querySelectorAll('[data-ev] [data-e]').forEach(b => b.onclick = async () => {
    const e = byId[b.closest('[data-ev]').dataset.ev]; const k = b.dataset.e; const go = async (method, body, path = `/api/admin/v7/events/${e.id}`) => { const x = await api(path, { method, body }); toast(x.ok ? 'Saved' : x.error); if (x.ok) events(); };
    if (k === 'edit') return evForm(r, e);
    if (k === 'dup') { const len = e.ends_at - e.starts_at; return evForm(r, { ...e, id: null, name: e.name + ' (copy)', starts_at: Date.now() + D, ends_at: Date.now() + D + len }); }
    if (k === 'end' && await dialog({ title: `End "${e.name}" now?`, confirm: 'End now' })) return go('PUT', { end_now: true });
    if (k === 'cancel' && await dialog({ title: `Cancel "${e.name}"?`, confirm: 'Cancel event', danger: true, cancel: 'Keep' })) return go('PUT', { status: 'cancelled' });
    if (k === 'restore') return go('PUT', { status: 'scheduled' });
    if (k === 'del' && await dialog({ title: `Delete "${e.name}"?`, body: '<p>It disappears from the history too.</p>', confirm: 'Delete', danger: true })) return go('DELETE');
  });
  if (id === 'new') evForm(r, { kind: qs('kind') || 'double_points' });
}
function evForm(r, e) {
  const t0 = Math.ceil(Date.now() / H) * H; const kind = e.kind || 'double_points';
  const presets = [['Tonight 7-11 PM', () => { const d = new Date(fromTzInput(toTzInput(Date.now()).slice(0, 10) + 'T19:00')); return [+d, +d + 4 * H]; }], ['This weekend', () => { const now = new Date(); const day = new Date(toTzInput(Date.now()).slice(0, 10) + 'T12:00Z').getUTCDay(); const toFri = (5 - day + 7) % 7; const fri = fromTzInput(toTzInput(Date.now() + toFri * D).slice(0, 10) + 'T17:00'); void now; return [fri, fri + 2 * D + 7 * H]; }], ['24 hours', () => [t0, t0 + D]], ['1 week', () => [t0, t0 + 7 * D]]];
  return dialog({ title: e.id ? `Edit ${e.name}` : 'New event', wide: true, confirm: e.id ? 'Save event' : 'Create event', body: `<div class="form-grid">
    <label class="fld"><span class="fl">Type</span><select class="input" id="ev-kind">${Object.entries(r.kinds).map(([k, v]) => `<option value="${k}" ${k === kind ? 'selected' : ''}>${esc(v.label)}</option>`).join('')}</select><small class="muted" id="ev-kd">${esc(r.kinds[kind].desc)}</small></label>
    <label class="fld"><span class="fl">Name</span><input class="input" id="ev-name" maxlength="80" value="${esc(e.name || '')}" placeholder="Double Points Friday"></label>
    <label class="fld full"><span class="fl">Description (shown to players)</span><textarea class="input" id="ev-desc" rows="2" maxlength="600">${esc(e.description || '')}</textarea></label>
    <label class="fld"><span class="fl">Starts (${tzLabel()})</span><input class="input" type="datetime-local" id="ev-s" value="${toTzInput(e.starts_at || t0)}"></label>
    <label class="fld"><span class="fl">Ends (${tzLabel()})</span><input class="input" type="datetime-local" id="ev-e" value="${toTzInput(e.ends_at || t0 + D)}"></label>
    <div class="fld full"><span class="fl">Quick schedule</span><div class="chips">${presets.map(([l], i) => `<button type="button" class="chip" data-pre="${i}">${l}</button>`).join('')}</div><small class="muted" id="ev-len"></small></div>
    <label class="fld"><span class="fl">Repeats</span><select class="input" id="ev-rec">${r.recur.map(x => `<option ${x === (e.recur || 'none') ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    <label class="fld k-mult"><span class="fl">Multiplier</span><select class="input" id="ev-mult">${[1.5, 2, 3, 4, 5].map(m => `<option value="${m}" ${+m === +(e.multiplier || 2) ? 'selected' : ''}>${m}x</option>`).join('')}</select></label>
    <label class="fld k-sale"><span class="fl">Sale percent off</span><input class="input" type="number" min="1" max="90" id="ev-pct" value="${e.sale_pct || 25}"></label>
    <div class="fld full k-sale"><span class="fl">Items on sale (none picked = whole shop)</span><div class="chips pick" id="ev-items">${r.items.map(i => `<label class="chip"><input type="checkbox" value="${esc(i.id)}" ${(e.items || []).includes(i.id) ? 'checked' : ''}> ${esc(i.name)}</label>`).join('')}</div></div>
    <label class="fld k-theme"><span class="fl">Theme</span><input class="input" id="ev-theme" maxlength="40" value="${esc(e.theme || '')}" placeholder="Neon Halloween"></label>
    <div class="fld full k-theme"><span class="fl">Featured games</span><div class="chips pick" id="ev-games">${r.games.map(g => `<label class="chip"><input type="checkbox" value="${esc(g.id)}" ${(e.games || []).includes(g.id) ? 'checked' : ''}> ${esc(g.title)}</label>`).join('')}</div></div>
    <label class="ck"><input type="checkbox" id="ev-ban" ${e.banner !== 0 ? 'checked' : ''}> Show a banner on the home page while it is live</label>
    <label class="ck"><input type="checkbox" id="ev-not" ${e.notify !== 0 ? 'checked' : ''}> Notify all players when it starts</label></div>`,
    collect: (d) => {
      const s = fromTzInput(val(d, '#ev-s')), en = fromTzInput(val(d, '#ev-e')); const k = val(d, '#ev-kind');
      return { kind: k, name: val(d, '#ev-name').trim(), description: val(d, '#ev-desc'), starts_at: s, ends_at: en, recur: val(d, '#ev-rec'), multiplier: +val(d, '#ev-mult'), sale_pct: +val(d, '#ev-pct'),
        items: [...d.querySelectorAll('#ev-items input:checked')].map(x => x.value), games: [...d.querySelectorAll('#ev-games input:checked')].map(x => x.value), theme: val(d, '#ev-theme'), banner: d.querySelector('#ev-ban').checked ? 1 : 0, notify: d.querySelector('#ev-not').checked ? 1 : 0 };
    } }).then(async (v) => { if (!v) return; const x = await api(e.id ? `/api/admin/v7/events/${e.id}` : '/api/admin/v7/events', { method: e.id ? 'PUT' : 'POST', body: v }); toast(x.ok ? (e.id ? 'Event saved' : 'Event created') : x.error); if (x.ok) C.nav('/admin/events'); else evForm(r, { ...e, ...v }); })
    .finally(() => {}), setTimeout(() => {
    const d = document.querySelector('.v7dlg'); if (!d) return; const sync = () => { const k = val(d, '#ev-kind'); d.querySelector('#ev-kd').textContent = r.kinds[k].desc;
      d.querySelectorAll('.k-mult').forEach(x => x.hidden = !['double_points', 'xp_boost', 'bonus_quests'].includes(k)); d.querySelectorAll('.k-sale').forEach(x => x.hidden = k !== 'shop_sale'); d.querySelectorAll('.k-theme').forEach(x => x.hidden = !['themed_weekend', 'custom'].includes(k));
      const s = fromTzInput(val(d, '#ev-s')), en = fromTzInput(val(d, '#ev-e')); d.querySelector('#ev-len').textContent = s && en ? (en > s ? `Runs for ${dur(en - s)}` : 'End must be after the start') : ''; };
    d.addEventListener('input', sync); d.addEventListener('change', sync); sync();
    d.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => { const [s, en] = presets[+b.dataset.pre][1](); d.querySelector('#ev-s').value = toTzInput(s); d.querySelector('#ev-e').value = toTzInput(en); sync(); });
  }, 30);
}

// ================= seasons =================
export async function seasons() {
  const r = await api('/api/admin/v7/seasons'); const c = r.current; const tab = qs('tab') || 'current'; const eng = !!r.palettes; // src/seasons.js engine (generated tracks, palettes)
  const xpOf = (p) => p.xp ?? p.score ?? 0;
  const trackRows = (s) => { const tr = s.track || {}; const keys = eng ? Object.keys(tr).map(Number).sort((a, b) => a - b) : Array.from({ length: s.tiers || 20 }, (_, i) => i + 1);
    return keys.map(t => `<tr><td>${eng ? 'Level' : 'Tier'} ${t}</td>${eng ? '' : `<td class="small muted">${fmt(t * (s.tier_xp || 0))} XP</td>`}<td>${eng || s.state === 'ended' ? esc(tr[t] || '') : `<input class="input sm" data-tier="${t}" value="${esc(tr[t] || '')}" placeholder="No reward" list="rw-types" aria-label="Tier ${t} reward">`}</td></tr>`).join('') || '<tr><td class="empty">No track rewards.</td></tr>'; };
  const themeField = (s) => eng ? `<label class="fld"><span class="fl">Palette</span><select class="input" data-f="theme">${r.palettes.map(p => `<option ${p === s.palette ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>` : `<label class="fld"><span class="fl">Theme</span><input class="input" data-f="theme" value="${esc(s.theme || '')}" maxlength="40"></label>`;
  const sCard = (s) => `<div class="card pad season" data-n="${s.number}"><div class="ev-h"><b>Season ${s.number}: ${esc(s.name)}</b>${sp(s.state)}${s.ended_early_at || s.ended_early ? pill('ended early', 'gold') : ''}${eng ? pill(s.palette || '', 'violet') : ''}</div>
    <div class="small">${dtz(s.start_at)} → ${dtz(s.end_at)} <span class="muted">(${dur(s.end_at - s.start_at)})</span></div>
    ${s.state !== 'ended' ? `<div class="form-grid"><label class="fld"><span class="fl">Name</span><input class="input" data-f="name" value="${esc(s.name)}" maxlength="40"></label>${themeField(s)}
      ${s.state === 'upcoming' ? `<label class="fld"><span class="fl">Starts (${tzLabel()})</span><input class="input" type="datetime-local" data-f="starts_at" data-orig="${s.start_at}" value="${toTzInput(s.start_at)}"></label>` : ''}<label class="fld"><span class="fl">Ends (${tzLabel()})</span><input class="input" type="datetime-local" data-f="ends_at" data-orig="${s.end_at}" value="${toTzInput(s.end_at)}"></label>
      <label class="fld full"><span class="fl">Notes for the team</span><input class="input" data-f="notes" value="${esc(s.notes || '')}" maxlength="400"></label></div>` : ''}
    <details ${s.state === 'live' ? 'open' : ''}><summary>Reward track (${Object.keys(s.track || {}).length} rewards${eng ? ', generated by the season engine' : ''})</summary><div class="wrap-x"><table class="tbl"><tbody>${trackRows(s)}</tbody></table></div></details>
    ${s.state !== 'ended' ? `<div class="row-btns"><button class="btn sm" data-s="save">${icon('save')} Save season ${s.number}</button>${s.state === 'live' ? `<button class="btn sm ghost danger-t" data-s="end">${icon('flag')} End season now & roll</button>` : ''}</div>` : ''}</div>`;
  const body = {
    current: `<div class="stats-row"><div class="stat card"><span>Live season</span><b>${c.number}: ${esc(c.name)}</b></div><div class="stat card"><span>Ends</span><b>${dshort(c.end_at)}</b><small>${dur(c.end_at - Date.now())} left</small></div><div class="stat card"><span>Players with XP</span><b>${fmt(c.players)}</b></div><div class="stat card"><span>Track</span><b>${eng ? `${r.levels} levels` : `${c.tiers} × ${fmt(c.tier_xp)} XP`}</b>${eng ? `<small>${r.length_days}-day seasons, free track</small>` : ''}</div></div>
      <div class="grid2"><div class="card pad"><h2>${icon('trophy')} Top 10 right now</h2><table class="tbl"><tbody>${(c.top || []).map((p, i) => `<tr><td>#${i + 1}</td><td><a href="/admin/players/${p.user_id || p.id}">${esc(p.username)}</a></td><td class="num">${fmt(xpOf(p))} XP</td>${p.level != null ? `<td class="num small">Lv ${p.level}</td>` : ''}</tr>`).join('') || '<tr><td class="empty">No XP yet this season.</td></tr>'}</tbody></table></div>${sCard({ ...(r.seasons.find(x => x.number === c.number) || c), state: 'live' })}</div>
      ${r.rules ? `<details class="card pad"><summary>Season rules players see</summary><ul class="small">${r.rules.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}`,
    upcoming: `<p class="small muted">Upcoming seasons start automatically. Change names, ${eng ? 'palettes' : 'themes'}, dates${eng ? '' : ' and rewards'} any time before they start.${eng ? ' Moving a start date moves the end of the season before it.' : ''}</p><div class="grid2">${r.seasons.filter(s => s.state === 'upcoming').map(sCard).join('')}</div>`,
    hof: (r.hall_of_fame || []).map(h => `<div class="card pad"><h2>${icon('crown')} Season ${h.number}: ${esc(h.name)}</h2>${h.players ? `<p class="small muted">${fmt(h.players)} players</p>` : ''}<table class="tbl"><tbody>${h.top.slice(0, 10).map(p => `<tr><td>#${p.rank}</td><td>${esc(p.username)}</td><td class="num">${fmt(p.xp)} XP</td></tr>`).join('')}</tbody></table></div>`).join('') || '<div class="empty card">The hall of fame fills in when a season ends.</div>',
    past: `<div class="grid2">${r.seasons.filter(s => s.state === 'ended').map(sCard).join('') || '<div class="empty card">No past seasons yet.</div>'}</div>`,
  };
  C.frame('seasons', 'Seasons', `<datalist id="rw-types">${(r.reward_types || []).map(t => `<option value="${t}: ">`).join('')}</datalist>${tabs([['current', 'Current'], ['upcoming', 'Upcoming'], ['past', 'Past'], ['hof', 'Hall of fame']], tab, '/admin/seasons')}${body[tab] || body.current}
    <p class="tiny muted">Season engine: ${esc(r.engine || '')}</p>`);
  document.querySelectorAll('.season').forEach(el => el.querySelectorAll('[data-s]').forEach(b => b.onclick = async () => {
    const n = +el.dataset.n;
    if (b.dataset.s === 'end') { const t = await dialog({ title: `End Season ${n} now?`, body: '<p>Standings are frozen into the hall of fame, rewards stay with the players who earned them, and the next season starts right away. Everyone gets a notification.</p>', typed: c.name, confirm: 'End & roll', danger: true }); if (!t) return;
      const x = await api('/api/admin/v7/seasons/end', { method: 'POST', body: { confirm: t } }); toast(x.ok ? `Season ended. ${x.archived} players archived.` : x.error); if (x.ok) seasons(); return; }
    const body = {}; el.querySelectorAll('[data-f]').forEach(i => { if (i.type === 'datetime-local') { const v = fromTzInput(i.value); if (v && Math.abs(v - +i.dataset.orig) > 60e3) body[i.dataset.f] = v; } else body[i.dataset.f] = i.value; });
    if (!eng) { body.track = {}; el.querySelectorAll('[data-tier]').forEach(i => { if (i.value.trim()) body.track[i.dataset.tier] = i.value.trim(); }); }
    const x = await api(`/api/admin/v7/seasons/${n}`, { method: 'PUT', body }); toast(x.ok ? `Season saved${x.ignored && x.ignored.length ? ' (ignored: ' + x.ignored.join(', ') + ')' : ''}` : x.error); if (x.ok) seasons();
  }));
}

// ================= shop =================
export async function shop() {
  const r = await api('/api/admin/v7/shop'); const tab = qs('tab') || 'now';
  const it = (i, acts = true) => `<div class="shop-it card ${i.retired ? 'dim' : ''}" data-item="${esc(i.id)}"><span class="rar r-${esc(i.rarity)}">${esc(i.rarity)}</span><b>${esc(i.name)}</b><span class="small muted">${esc(i.type)} • ${i.sale_price ? `<s>${fmt(i.price)}</s> <b class="pos">${fmt(i.sale_price)}</b>` : fmt(i.price)} pts • sold ${fmt(i.sold)}</span>
    <span class="chips">${i.pin ? pill('pinned' + (i.pin.until ? ' to ' + dday(i.pin.until) : ''), 'violet') : ''}${i.featured ? pill('featured', 'gold') : ''}${i.retired ? pill('retired', 'red') : ''}</span>
    ${acts ? `<span class="row-btns">${i.pin ? '<button class="btn sm ghost" data-a="unpin">Unpin</button>' : '<button class="btn sm ghost" data-a="pin">Pin</button>'}${i.featured ? '<button class="btn sm ghost" data-a="unfeature">Unfeature</button>' : '<button class="btn sm ghost" data-a="feature">Feature</button>'}${i.retired ? '<button class="btn sm ghost" data-a="unretire">Bring back</button>' : '<button class="btn sm ghost danger-t" data-a="retire">Retire</button>'}</span>` : ''}</div>`;
  const by = Object.fromEntries(r.items.map(i => [i.id, i]));
  const body = {
    now: `<div class="grid2"><div class="card pad"><h2>Daily <small class="muted">changes ${dshort(r.now.daily_ends)}</small></h2><div class="shop-grid">${r.now.daily.map(i => it(i)).join('')}</div></div><div class="card pad"><h2>Weekly <small class="muted">changes ${dshort(r.now.weekly_ends)}</small></h2><div class="shop-grid">${r.now.weekly.map(i => it(i)).join('')}</div></div></div>`,
    future: `<p class="small muted">Next 7 days (includes your pins and retirements; sales are applied on the day).</p><div class="wrap-x"><table class="tbl"><thead><tr><th>Day</th><th>Daily</th><th>Weekly</th></tr></thead><tbody>${r.future.map(f => `<tr><td class="small">${dday(f.day)}${f.week_changes ? ' ' + pill('new week', 'blue') : ''}</td><td class="small">${f.daily.map(i => esc((by[i] || {}).name || i)).join(', ')}</td><td class="small">${f.weekly.map(i => esc((by[i] || {}).name || i)).join(', ')}</td></tr>`).join('')}</tbody></table></div>`,
    all: `<input class="input" id="sh-q" placeholder="Filter items" aria-label="Filter items"><div class="shop-grid" id="sh-all">${r.items.map(i => it(i)).join('')}</div>`,
    sales: `<div class="note-box">${r.sale ? `${icon('tag')} <b>${r.sale.pct}% off</b> ${r.sale.items.length ? r.sale.items.length + ' items' : 'the whole shop'} right now.` : 'No sale running.'}</div><button class="btn" id="sh-sale">${icon('tag')} Run a sale</button>
      <table class="tbl"><tbody>${r.sales.map(e => `<tr><td><b>${esc(e.name)}</b></td><td>${e.sale_pct}%</td><td class="small">${dshort(e.starts_at)} → ${dshort(e.ends_at)}</td><td>${sp(e.state)}</td></tr>`).join('') || '<tr><td class="empty">No sales yet.</td></tr>'}</tbody></table>`,
  };
  C.frame('shop', 'Shop', `<div class="stats-row"><div class="stat card"><span>Items</span><b>${r.items.length}</b></div><div class="stat card"><span>Pinned</span><b>${r.cfg.pins.length}</b></div><div class="stat card"><span>Featured</span><b>${r.cfg.featured.length}</b></div><div class="stat card"><span>Retired</span><b>${r.cfg.retired.length}</b></div></div>
    ${tabs([['now', 'Current rotation'], ['future', 'Next 7 days'], ['all', 'All items'], ['sales', 'Sales']], tab, '/admin/shop')}${body[tab] || body.now}<p class="tiny muted">Hub Points are cosmetic only: they can't be bought with money and can never buy giveaway entries.</p>`);
  document.querySelectorAll('[data-item] [data-a]').forEach(b => b.onclick = async () => {
    const id = b.closest('[data-item]').dataset.item; const a = b.dataset.a; let until = null;
    if (a === 'pin') { const v = await dialog({ title: `Pin ${by[id].name}`, body: '<p>Pinned items stay in the daily shop until you unpin them (or until the date).</p>', input: { label: 'Pin until (optional)', type: 'date' }, confirm: 'Pin' }); if (v === false) return; until = v ? fromTzInput(v + 'T23:59') : null; }
    if (a === 'retire' && !(await dialog({ title: `Retire ${by[id].name}?`, body: '<p>It leaves the rotation. Players who own it keep it.</p>', confirm: 'Retire', danger: true }))) return;
    const x = await api('/api/admin/v7/shop', { method: 'POST', body: { item: id, action: a, until } }); toast(x.ok ? 'Shop updated' : x.error); if (x.ok) shop();
  });
  const q = document.getElementById('sh-q'); if (q) q.oninput = () => document.querySelectorAll('#sh-all .shop-it').forEach(el => el.hidden = !el.textContent.toLowerCase().includes(q.value.toLowerCase()));
  const sb = document.getElementById('sh-sale'); if (sb) sb.onclick = () => C.nav('/admin/events/new?kind=shop_sale');
}

// ================= badges & achievements =================
export async function badges() {
  const r = await api('/api/admin/v7/badges'); const tab = qs('tab') || 'admin';
  const body = {
    admin: `${can('badges.manage') ? `<button class="btn" id="bd-new">${icon('plus')} New badge</button>` : ''}<div class="badge-grid">${r.admin.map(b => `<div class="card pad bdg ${b.retired ? 'dim' : ''}" data-b="${esc(b.id)}"><img src="${esc(b.art_url)}" alt="" width="56" height="56"><b>${esc(b.name)}</b><span class="small muted">${esc(b.desc || '')}</span>
      <span class="chips">${b.builtin ? pill('built-in') : pill('custom', 'violet')}${b.admin_only !== false ? pill('admin-only', 'gold') : ''}${b.retired ? pill('retired', 'red') : ''}</span><span class="small">${fmt(b.holders)} holders</span>
      <span class="row-btns">${!b.retired ? `<button class="btn sm" data-x="award">${icon('award')} Award</button>` : ''}${!b.builtin && can('badges.manage') ? `<button class="btn sm ghost" data-x="edit">${icon('pencil')} Edit</button>` : ''}</span></div>`).join('')}</div>`,
    achievements: `<p class="small muted">Achievements unlock automatically from play. % = share of real players who have it.</p><div class="wrap-x"><table class="tbl"><thead><tr><th></th><th>Achievement</th><th>Tier</th><th class="num">Players</th><th class="num">%</th></tr></thead><tbody>${r.achievements.map(a => `<tr><td><img src="${esc(a.art_url)}" alt="" width="28" height="28"></td><td><b>${esc(a.name)}</b><div class="tiny muted">${esc(a.desc)}</div></td><td>${esc(a.tier || '')}</td><td class="num">${fmt(a.unlocked)}</td><td class="num">${a.pct}%</td></tr>`).join('')}</tbody></table></div>`,
    grants: `<table class="tbl"><tbody>${r.grants.map(g => `<tr><td class="small">${dshort(g.created_at)}</td><td>${esc(g.username)}</td><td>${esc(g.badge_id)}</td><td class="small muted">by ${esc(g.granted_by)}${g.note ? ' • ' + esc(g.note) : ''}</td></tr>`).join('') || '<tr><td class="empty">No badges awarded yet.</td></tr>'}</tbody></table>`,
  };
  C.frame('badges', 'Badges & achievements', `${tabs([['admin', 'Special badges', r.admin.length], ['achievements', 'Achievements', r.achievements.length], ['grants', 'Recent awards']], tab, '/admin/badges')}${body[tab] || body.admin}`);
  const by = Object.fromEntries(r.admin.map(b => [b.id, b]));
  const nb = document.getElementById('bd-new'); if (nb) nb.onclick = () => badgeForm(r, {});
  document.querySelectorAll('[data-b] [data-x]').forEach(b => b.onclick = async () => {
    const bd = by[b.closest('[data-b]').dataset.b];
    if (b.dataset.x === 'edit') return badgeForm(r, bd);
    const v = await dialog({ title: `Award ${bd.name}`, body: `<input class="input" id="aw-u" placeholder="Player username" aria-label="Player username" autocomplete="off"><input class="input" id="aw-n" placeholder="Note (optional, e.g. why)" aria-label="Note">`, confirm: 'Award', collect: (d) => { const u = val(d, '#aw-u').trim(); if (!u) { toast('Enter a username'); return undefined; } return { username: u, note: val(d, '#aw-n') }; } });
    if (!v) return; const x = await api('/api/admin/v7/badges/award', { method: 'POST', body: { ...v, badge: bd.id } }); toast(x.ok ? `Awarded to ${v.username}` : x.error); if (x.ok) badges();
  });
}
function badgeForm(r, b) {
  let art = b.art || '';
  const prev = (d) => { const c = val(d, '#bf-c') || '#a78bfa'; const ic = val(d, '#bf-i'); d.querySelector('#bf-prev').innerHTML = art ? `<img src="${esc(art)}" alt="" width="96" height="96">` : `<span class="gen-badge" style="--bc:${esc(c)}">${icon(ic)}</span>`; };
  setTimeout(() => { const d = document.querySelector('.v7dlg'); if (!d) return; d.addEventListener('input', () => prev(d)); prev(d);
    d.querySelector('#bf-up').onclick = async () => { const u = await cropUpload({ kinds: ['badge'], kind: 'badge', title: 'Badge art' }); if (u && u.badge) { art = u.badge; prev(d); } };
    d.querySelector('#bf-gen').onclick = () => { art = ''; prev(d); }; }, 30);
  return dialog({ title: b.id ? `Edit ${b.name}` : 'New badge', wide: true, confirm: 'Save badge', body: `<div class="bf"><div id="bf-prev" class="bf-prev"></div><div class="form-grid">
    <label class="fld"><span class="fl">Name</span><input class="input" id="bf-n" maxlength="40" value="${esc(b.name || '')}"></label>
    <label class="fld"><span class="fl">Colour</span><input class="input" type="color" id="bf-c" value="${esc(b.color || '#a78bfa')}"></label>
    <label class="fld full"><span class="fl">Description</span><input class="input" id="bf-d" maxlength="160" value="${esc(b.desc || '')}"></label>
    <label class="fld"><span class="fl">Icon (for generated art)</span><select class="input" id="bf-i">${r.icons.map(i => `<option ${i === (b.icon || 'star') ? 'selected' : ''}>${i}</option>`).join('')}</select></label>
    <div class="fld"><span class="fl">Art</span><div class="row-btns"><button type="button" class="btn sm" id="bf-up">${icon('upload')} Upload art</button><button type="button" class="btn sm ghost" id="bf-gen">${icon('wand-2')} Use generated</button></div></div>
    <label class="ck"><input type="checkbox" id="bf-a" ${b.admin_only !== false ? 'checked' : ''}> Admin-only (can only be awarded by staff)</label>${b.id ? `<label class="ck"><input type="checkbox" id="bf-r" ${b.retired ? 'checked' : ''}> Retired (hidden from the award list; holders keep it)</label>` : ''}</div></div>`,
    collect: (d) => ({ name: val(d, '#bf-n').trim(), description: val(d, '#bf-d'), color: val(d, '#bf-c'), icon: val(d, '#bf-i'), art, admin_only: d.querySelector('#bf-a').checked, retired: !!(d.querySelector('#bf-r') || {}).checked }) })
    .then(async (v) => { if (!v) return; const x = await api(b.id ? `/api/admin/v7/badges/${b.id}` : '/api/admin/v7/badges', { method: b.id ? 'PUT' : 'POST', body: v }); toast(x.ok ? 'Badge saved' : x.error); if (x.ok) badges(); });
}

// ================= analytics =================
export async function analytics() {
  const days = +qs('days') || 30; const r = await api(`/api/admin/v7/analytics?days=${days}`); const t = r.totals;
  const st = (l, v, s = '') => `<div class="stat card"><span>${l}</span><b>${v}</b>${s ? `<small>${s}</small>` : ''}</div>`;
  const rp = (v) => v == null ? '-' : v + '%';
  C.frame('analytics', 'Analytics', `<div class="toolbar"><div class="chips">${[7, 30, 90].map(d => `<a class="chip ${d === r.days ? 'on' : ''}" href="/admin/analytics?days=${d}">${d} days</a>`).join('')}</div><button class="btn sm ghost" id="an-csv">${icon('download')} CSV</button><span class="tiny muted">Updated ${dshort(r.generated_at)} • demo players excluded</span></div>
    <div class="stats-row">${st('Online (15 min)', fmt(t.online_15m))}${st('Active today', fmt(t.dau_today))}${st('Weekly active', fmt(t.wau))}${st('Monthly active', fmt(t.mau))}${st('New players', fmt(t.signups_period), `last ${r.days} days`)}${st('Runs', fmt(t.runs_period), `last ${r.days} days`)}${st('Total players', fmt(t.players))}${st('Points issued', fmt(t.points_issued), `${fmt(t.items_bought)} items bought`)}</div>
    <div class="grid2"><div class="card pad"><h2>Daily active players</h2>${lineChart(r.dau, { label: 'Daily active players' })}</div><div class="card pad"><h2>New signups</h2>${lineChart(r.signups, { color: '#a78bfa', label: 'New signups' })}</div>
      <div class="card pad"><h2>Runs per day</h2>${lineChart(r.runs, { color: '#fbbf24', label: 'Runs per day' })}</div><div class="card pad"><h2>Retention</h2><div class="stats-row tight">${st('Day 1', rp(r.retention.d1), `${r.retention.cohort.d1} players`)}${st('Day 7', rp(r.retention.d7), `${r.retention.cohort.d7} players`)}${st('Day 30', rp(r.retention.d30), `${r.retention.cohort.d30} players`)}</div><p class="tiny muted">Share of new players (last 90 days) who played again 1, 7 and 30 days after joining.</p></div>
      <div class="card pad"><h2>Runs per game</h2>${bars(r.games.slice(0, 12).map(g => ({ label: g.title, v: g.runs })))}</div><div class="card pad"><h2>Top games by players</h2>${bars([...r.games].sort((a, b) => b.players - a.players).slice(0, 8).map(g => ({ label: g.title, v: g.players })), { color: '#22d3ee' })}</div>
      <div class="card pad"><h2>Giveaway entries</h2>${bars(r.giveaways.map(g => ({ label: g.title, v: g.entrants })), { color: '#34d399' })}</div><div class="card pad"><h2>Referral funnel</h2>${funnel([{ label: 'Invited & signed up', v: r.referrals.invited }, { label: 'Played a run', v: r.referrals.played }, { label: 'Played 5+ runs', v: r.referrals.engaged }, { label: 'Entered a giveaway', v: r.referrals.entered }])}
        ${r.referrals.top.length ? `<p class="small">Top inviters: ${r.referrals.top.map(x => `${esc(x.username)} (${x.n})`).join(', ')}</p>` : ''}</div></div>`);
  document.getElementById('an-csv').onclick = () => csvDownload(`analytics-${r.days}d.csv`, [['day', 'active', 'signups', 'runs'], ...r.dau.map((d, i) => [d.label, d.v, r.signups[i].v, r.runs[i].v])]);
}

// ================= announcements =================
export async function announcements() {
  const r = await api('/api/admin/v7/announce'); const b = r.banner || { on: false, tone: 'info' };
  C.frame('announcements', 'Announcements', `<div class="grid2"><form class="card pad" id="bn-f"><h2>${icon('flag')} Site-wide banner</h2><p class="small muted">Shows at the top of every player page. Players can dismiss it if you allow.</p>
      <label class="tg-row"><span class="toggle"><input type="checkbox" name="on" ${b.on ? 'checked' : ''}><span></span></span><span><b>Banner on</b></span></label>
      <label class="fld"><span class="fl">Text</span><input class="input" name="text" maxlength="200" value="${esc(b.text || '')}" placeholder="New giveaway: win a PS5 this weekend!"></label>
      <div class="form-grid"><label class="fld"><span class="fl">Link (optional)</span><input class="input" name="link" value="${esc(b.link || '')}" placeholder="/giveaways"></label><label class="fld"><span class="fl">Button text</span><input class="input" name="link_label" maxlength="30" value="${esc(b.link_label || '')}" placeholder="See it"></label>
      <label class="fld"><span class="fl">Style</span><select class="input" name="tone">${r.tones.map(t => `<option ${t === b.tone ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label class="ck"><input type="checkbox" name="dismissible" ${b.dismissible !== false ? 'checked' : ''}> Players can close it</label>
      <label class="fld"><span class="fl">Show from (${tzLabel()}, optional)</span><input class="input" type="datetime-local" name="starts_at" value="${toTzInput(b.starts_at)}"></label><label class="fld"><span class="fl">Until (optional)</span><input class="input" type="datetime-local" name="ends_at" value="${toTzInput(b.ends_at)}"></label></div>
      <div class="bn-prev" id="bn-prev"></div><button class="btn">${icon('save')} Save banner</button></form>
    <form class="card pad" id="bc-f"><h2>${icon('megaphone')} Broadcast notification</h2><p class="small muted">Goes to every player's notification bell (and push, if they turned it on). Max 5 per day.</p>
      <label class="fld"><span class="fl">Title</span><input class="input" name="title" maxlength="140" required></label><label class="fld"><span class="fl">Message</span><textarea class="input" name="body" rows="3" maxlength="400"></textarea></label>
      <label class="fld"><span class="fl">Link (optional, on this site)</span><input class="input" name="link" placeholder="/giveaways"></label><label class="ck"><input type="checkbox" name="post" checked> Also post it on the News page</label>
      <button class="btn">${icon('send')} Send to everyone</button>
      <h3>Recent broadcasts</h3>${r.broadcasts.map(x => `<div class="small"><span class="muted">${dshort(x.at)}</span> ${esc(x.actor)}: ${esc(x.detail)}</div>`).join('') || '<div class="small muted">None yet.</div>'}</form></div>
    <div class="card pad"><h2>News posts</h2>${r.announcements.map(a => `<div class="small"><b>${esc(a.title)}</b> <span class="muted">${dshort(a.created_at)}</span></div>`).join('') || '<div class="small muted">No posts.</div>'}<p class="small"><a href="/admin/system">Edit or delete posts on the System page</a></p></div>`);
  const f = document.getElementById('bn-f'); const prev = () => { const v = new FormData(f); document.getElementById('bn-prev').innerHTML = v.get('text') ? `<div class="site-banner tone-${esc(v.get('tone'))}"><span>${esc(v.get('text'))}</span>${v.get('link') ? `<a class="btn sm">${esc(v.get('link_label') || 'Open')}</a>` : ''}</div>` : ''; };
  f.oninput = prev; prev();
  f.onsubmit = async (e) => { e.preventDefault(); const v = new FormData(f); const x = await api('/api/admin/v7/banner', { method: 'POST', body: { on: !!v.get('on'), text: v.get('text'), link: v.get('link'), link_label: v.get('link_label'), tone: v.get('tone'), dismissible: !!v.get('dismissible'), starts_at: fromTzInput(v.get('starts_at')), ends_at: fromTzInput(v.get('ends_at')) } }); toast(x.ok ? (x.banner.on ? 'Banner is live' : 'Banner off') : x.error); };
  const g = document.getElementById('bc-f'); g.onsubmit = async (e) => { e.preventDefault(); const v = new FormData(g); if (!(await dialog({ title: 'Send to every player?', body: `<p><b>${esc(v.get('title'))}</b></p><p>${esc(v.get('body'))}</p>`, confirm: 'Send now' }))) return;
    const x = await api('/api/admin/v7/broadcast', { method: 'POST', body: { title: v.get('title'), body: v.get('body'), link: v.get('link'), post: !!v.get('post') } }); toast(x.ok ? 'Sent' : x.error); if (x.ok) announcements(); };
}

// ================= settings =================
export async function settings() {
  const r = await api('/api/admin/v7/settings'); const s = r.site; const tab = qs('tab') || 'brand';
  const LG = { terms: 'Terms of Service', privacy: 'Privacy Policy', rules: 'Official Rules (site-wide)', responsible: 'Responsible play' };
  const body = {
    brand: `<div class="form-grid"><label class="fld"><span class="fl">Site name</span><input class="input" data-s="name" maxlength="40" value="${esc(s.name)}"></label><label class="fld"><span class="fl">Tagline</span><input class="input" data-s="tagline" maxlength="60" value="${esc(s.tagline)}"></label>
      <label class="fld"><span class="fl">Accent colour (blank = default)</span><span class="row-btns"><input class="input" type="color" data-s="accent" value="${esc(s.accent || '#a78bfa')}"><label class="ck"><input type="checkbox" id="acc-def" ${s.accent ? '' : 'checked'}> default</label></span></label>
      <label class="fld"><span class="fl">Support Potato username</span><input class="input" data-s="support_potato" value="${esc(s.support_potato)}" placeholder="traptech"></label>
      ${Object.keys(s.socials).map(k => `<label class="fld"><span class="fl">${esc(k)} link</span><input class="input" data-soc="${k}" value="${esc(s.socials[k])}" placeholder="https://"></label>`).join('')}</div>`,
    maintenance: `<div class="${s.maintenance.on ? 'warn-box' : 'note-box'}">${icon('wrench')} Maintenance mode is <b>${s.maintenance.on ? 'ON' : 'off'}</b>. While on, players see a notice and can't submit runs, sign up or enter; browsing still works and the admin is unaffected.</div>
      <label class="tg-row"><span class="toggle"><input type="checkbox" id="mt-on" ${s.maintenance.on ? 'checked' : ''}><span></span></span><span><b>Maintenance mode</b></span></label>
      <label class="fld"><span class="fl">Message</span><textarea class="input" id="mt-msg" rows="2" maxlength="300">${esc(s.maintenance.message)}</textarea></label><label class="fld"><span class="fl">Expected back (${tzLabel()}, optional)</span><input class="input" type="datetime-local" id="mt-until" value="${toTzInput(s.maintenance.until)}"></label>`,
    agegate: `<p class="small muted">The 21+ gate players see before signing up. Leave blank for the default text.</p><label class="fld"><span class="fl">Title</span><input class="input" id="ag-t" maxlength="80" value="${esc(s.age_gate.title)}" placeholder="Are you 21 or older?"></label><label class="fld"><span class="fl">Text</span><textarea class="input" id="ag-x" rows="4" maxlength="600">${esc(s.age_gate.text)}</textarea></label>`,
    legal: `<p class="small muted">Edit the legal pages. Leave a page empty to use the built-in version. Scripts and styles are removed when saved.</p><select class="input" id="lg-k">${r.legal_keys.map(k => `<option value="${k}">${LG[k] || k}${s.legal[k] ? ' (edited ' + dday(s.legal[k].updated_at) + ')' : ''}</option>`).join('')}</select>
      <div class="rte-bar">${[['bold', 'B'], ['italic', 'I'], ['insertUnorderedList', '• List'], ['formatBlock:h3', 'Heading']].map(([c, l]) => `<button type="button" class="btn sm ghost" data-cmd="${c}">${l}</button>`).join('')}<button type="button" class="btn sm ghost" id="lg-reset">Use built-in</button></div><div class="rte input" contenteditable="true" id="lg-ed" role="textbox" aria-multiline="true" aria-label="Legal page editor"></div>`,
  };
  C.frame('settings', 'Settings', `${tabs([['brand', 'Site & branding'], ['maintenance', 'Maintenance'], ['agegate', 'Age gate'], ['legal', 'Legal pages']], tab, '/admin/settings')}<div class="card pad">${body[tab] || body.brand}<div class="row-btns"><button class="btn" id="st-save">${icon('save')} Save</button></div></div>
    <p class="small"><a href="/admin/system">More system tools (backups, news posts, demo data)</a></p>`);
  const legal = Object.fromEntries(r.legal_keys.map(k => [k, s.legal[k] ? s.legal[k].html : ''])); let cur = r.legal_keys[0];
  const ed = document.getElementById('lg-ed'); if (ed) { const load = () => { ed.innerHTML = legal[cur] || ''; }; load();
    document.getElementById('lg-k').onchange = (e) => { legal[cur] = ed.innerHTML; cur = e.target.value; load(); };
    document.querySelectorAll('[data-cmd]').forEach(b => b.onclick = () => { const [c, a] = b.dataset.cmd.split(':'); document.execCommand(c, false, a); ed.focus(); });
    document.getElementById('lg-reset').onclick = () => { ed.innerHTML = ''; }; }
  document.getElementById('st-save').onclick = async () => {
    let b = {};
    if (tab === 'brand') { document.querySelectorAll('[data-s]').forEach(i => { b[i.dataset.s] = i.value; }); if (document.getElementById('acc-def').checked) b.accent = ''; b.socials = {}; document.querySelectorAll('[data-soc]').forEach(i => { b.socials[i.dataset.soc] = i.value.trim(); }); }
    if (tab === 'maintenance') { const on = document.getElementById('mt-on').checked; if (on && !s.maintenance.on && !(await dialog({ title: 'Turn on maintenance mode?', body: '<p>Players can\'t play or enter until you turn it off.</p>', confirm: 'Turn on', danger: true }))) return; b.maintenance = { on, message: document.getElementById('mt-msg').value, until: fromTzInput(document.getElementById('mt-until').value) }; }
    if (tab === 'agegate') b.age_gate = { title: document.getElementById('ag-t').value, text: document.getElementById('ag-x').value };
    if (tab === 'legal') { legal[cur] = ed.innerHTML; b.legal = legal; }
    const x = await api('/api/admin/v7/settings', { method: 'PUT', body: b }); toast(x.ok ? 'Settings saved' : x.error); if (x.ok) settings();
  };
}

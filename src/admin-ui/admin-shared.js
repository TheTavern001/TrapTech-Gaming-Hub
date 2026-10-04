// v7 admin: shared helpers for the new admin modules (giveaway builder, players, live ops, team).
// admin.js calls init(ctx) with its helpers (api, frame, icon, toast, nav, ...) so every module renders the same way.
import './admin-icons.js';
export const C = {};
export function init(ctx) { Object.assign(C, ctx); }
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (n) => Number(n || 0).toLocaleString('en-US');
export const money = (n) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
export const TZ = 'America/New_York';
export const tzLabel = (ms = Date.now()) => new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'short' }).formatToParts(new Date(ms)).find(p => p.type === 'timeZoneName').value;
export const dtz = (ms) => ms ? `${new Date(ms).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })} ${tzLabel(ms)}` : '-';
export const dshort = (ms) => ms ? new Date(ms).toLocaleString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '-';
export const dday = (ms) => ms ? new Date(ms).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric', year: 'numeric' }) : '-';
// datetime-local in the hub timezone (America/New_York), whatever the admin's phone is set to
const offMin = (ms) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(new Date(ms)).find(x => x.type === 'timeZoneName').value; const m = p.match(/GMT([+-])(\d\d):?(\d\d)?/); return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] || 0)) : 0; };
export const toTzInput = (ms) => { if (!ms) return ''; const d = new Date(ms + offMin(ms) * 60e3); return d.toISOString().slice(0, 16); };
export const fromTzInput = (v) => { if (!v) return null; const guess = Date.parse(v + ':00Z'); if (!Number.isFinite(guess)) return null; let t = guess - offMin(guess) * 60e3; t = guess - offMin(t) * 60e3; return t; };
export const dur = (ms) => { if (!Number.isFinite(ms) || ms <= 0) return '-'; const m = Math.round(ms / 60e3); if (m < 60) return `${m} min`; const h = m / 60; if (h < 48) return `${Math.floor(h)} h${m % 60 ? ` ${m % 60} min` : ''}`; const d = h / 24; return d < 60 ? `${Math.floor(d)} days${Math.round(h % 24) ? ` ${Math.round(h % 24)} h` : ''}` : `${(d / 30.4).toFixed(1)} months`; };
export const icon = (n) => C.icon ? C.icon(n) : '';
export const pill = (txt, cls = '') => `<span class="pill ${cls}">${esc(txt)}</span>`;
const STATE_CLS = { live: 'green', upcoming: '', scheduled: 'cyan', paused: 'gold', ended: 'red', cancelled: 'red', archived: '', hidden: '', draft: 'violet' };
export const statePill = (s) => `<span class="pill st-${esc(s)} ${STATE_CLS[s] || ''}">${esc(s)}</span>`;
export const roleBadge = (role) => role === 'owner' ? `<span class="role-badge owner">${icon('crown')}Owner</span>` : role === 'admin' ? `<span class="role-badge admin">${icon('shield-check')}Admin</span>` : `<span class="role-badge mod">${icon('shield')}Moderator</span>`;
export async function api(path, opts) { return C.api(path, opts); }
export function toast(m) { C.toast(m); }
export const can = (k) => !!(C.perms && C.perms[k]);
export function tabs(list, cur, base) { return `<nav class="v7tabs" role="tablist">${list.map(([k, l, n]) => `<a role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}" href="${base}${k ? (base.includes('?') ? '&' : '?') + 'tab=' + k : ''}">${esc(l)}${n ? ` <b class="cnt">${n}</b>` : ''}</a>`).join('')}</nav>`; }
export const qs = (k) => new URLSearchParams(location.search).get(k);
// accessible dialog; typed = the exact text the admin must type to confirm destructive actions
export function dialog({ title, body = '', confirm = 'Confirm', danger = false, typed = '', input = null, cancel = 'Cancel', collect = null, wide = false }) {
  return new Promise((resolve) => {
    const d = document.createElement('div'); d.className = 'v7dlg-wrap';
    d.innerHTML = `<div class="v7dlg card${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="v7dt"><h2 id="v7dt">${esc(title)}</h2><div class="v7dlg-b">${body}</div>
      ${input ? `<label class="lbl">${esc(input.label)}<input class="input" id="v7di" type="${input.type || 'text'}" value="${esc(input.value || '')}" ${input.attrs || ''}></label>` : ''}
      ${typed ? `<label class="lbl">Type <b>${esc(typed)}</b> to confirm<input class="input" id="v7dt2" autocomplete="off"></label>` : ''}
      <div class="row-end"><button class="btn ghost" data-x>${esc(cancel)}</button><button class="btn ${danger ? 'danger' : ''}" data-ok ${typed ? 'disabled' : ''}>${esc(confirm)}</button></div></div>`;
    document.body.appendChild(d); const ok = d.querySelector('[data-ok]'); const t2 = d.querySelector('#v7dt2'); const inp = d.querySelector('#v7di');
    if (t2) t2.addEventListener('input', () => { ok.disabled = t2.value.trim() !== typed; });
    const close = (v) => { d.remove(); resolve(v); };
    d.querySelector('[data-x]').onclick = () => close(false); d.addEventListener('click', (e) => { if (e.target === d) close(false); });
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(false); });
    ok.onclick = () => { if (collect) { const v = collect(d); if (v === undefined) return; return close(v); } close(inp ? inp.value : (t2 ? t2.value.trim() : true)); };
    setTimeout(() => (t2 || inp || ok).focus(), 30);
  });
}
// tiny SVG charts (no library)
export function lineChart(series, { h = 120, color = '#22d3ee', label = '' } = {}) {
  const w = 320; const max = Math.max(1, ...series.map(s => s.v)); const n = series.length;
  const pts = series.map((s, i) => [n === 1 ? w / 2 : (i * (w - 8)) / (n - 1) + 4, h - 18 - (s.v / max) * (h - 30)]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}: max ${max}"><path d="${d} L${pts[n - 1][0]} ${h - 18} L${pts[0][0]} ${h - 18} Z" fill="${color}" fill-opacity=".14"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>
    ${[0, Math.floor(n / 2), n - 1].map(i => `<text x="${Math.min(w - 30, Math.max(0, pts[i][0] - 14))}" y="${h - 4}" class="ax">${esc(series[i].label || '')}</text>`).join('')}<text x="4" y="12" class="ax">${max}</text></svg>`;
}
export function bars(rows, { color = '#a78bfa', fmtV = fmt } = {}) {
  const max = Math.max(1, ...rows.map(r => r.v));
  return `<div class="hbars">${rows.map(r => `<div class="hb"><span class="hb-l">${esc(r.label)}</span><span class="hb-bar"><i style="width:${Math.max(2, (100 * r.v) / max).toFixed(1)}%;background:${color}"></i></span><b>${fmtV(r.v)}</b></div>`).join('') || '<div class="empty">No data yet.</div>'}</div>`;
}
export function funnel(steps) {
  const top = Math.max(1, steps[0] ? steps[0].v : 1);
  return `<div class="funnel">${steps.map((s, i) => `<div class="fn"><div class="fn-bar" style="width:${Math.max(6, (100 * s.v) / top).toFixed(1)}%"><b>${fmt(s.v)}</b></div><span>${esc(s.label)}${i ? ` <em>${top ? Math.round((100 * s.v) / top) : 0}%</em>` : ''}</span></div>`).join('')}</div>`;
}
// bind data-k="a.b.c" inputs to an object (used by the builder and settings forms)
export const getPath = (o, p) => p.split('.').reduce((x, k) => (x == null ? x : x[k]), o);
export function setPath(o, p, v) { const ks = p.split('.'); let x = o; for (const k of ks.slice(0, -1)) { if (x[k] == null || typeof x[k] !== 'object') x[k] = {}; x = x[k]; } x[ks[ks.length - 1]] = v; }
export function readInput(el) {
  const t = el.dataset.type || el.type;
  if (t === 'checkbox' || t === 'bool') return el.checked;
  if (t === 'number' || t === 'num') return el.value === '' ? 0 : Number(el.value);
  if (t === 'tz') return fromTzInput(el.value);
  if (t === 'int01') return el.checked ? 1 : 0;
  return el.value;
}
export const toggle = (k, on, label, hint = '', attrs = '') => `<label class="tg-row"><span class="toggle"><input type="checkbox" data-k="${k}" ${on ? 'checked' : ''} ${attrs}><span></span></span><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span></label>`;
export const field = (label, inner, hint = '', cls = '') => `<label class="fld ${cls}"><span class="fl">${label}</span>${inner}${hint ? `<small class="muted">${hint}</small>` : ''}</label>`;
export const csvDownload = (name, rows) => { const s = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([s], { type: 'text/csv' })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
export const copy = async (txt) => { try { await navigator.clipboard.writeText(txt); toast('Copied'); } catch { await dialog({ title: 'Copy this', body: `<textarea class="input" rows="4" readonly>${esc(txt)}</textarea>`, confirm: 'Done' }); } };

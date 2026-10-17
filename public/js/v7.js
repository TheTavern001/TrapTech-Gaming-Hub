// v7 front-end pages: Book a Giveaway (feature picker + private quote status page), brand affiliation (invite links,
// signup brand pick, "Your brand" card in Settings). Shop & seasons pages are added below by the economy section.
// install(ctx) is called once from app.js with its helpers.
import * as ECON from './economy.js';
import * as STORE from './hub-store.js';
import * as AVED from './avatar-editor.js';
let C = null; // { route, shell, api, icon, esc, fmt, toast, go, S, TT, copyText, ls, emptyState, pageHead }
const money = (c) => '$' + (Math.round(c) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const day = (t) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const brandLogo = (b, s = 44) => b && b.logo ? `<img class="br-logo" src="${C.esc(b.logo)}" alt="" width="${s}" height="${s}" loading="lazy">` : `<span class="br-logo br-ph" style="width:${s}px;height:${s}px;--bc:${C.esc((b && b.color) || '#8b5cf6')}">${C.esc(((b && b.name) || '?').slice(0, 1))}</span>`;

// ---------------- Book a Giveaway ----------------
let CAT = null;
async function catalog() { if (!CAT) { const r = await C.api('/api/sponsor/catalog'); if (r.ok) CAT = r; } return CAT; }
const unitText = (f, q) => f.unit === 'week' ? `${q} week${q === 1 ? '' : 's'}` : f.unit === 'each' ? `x ${q}` : '';
const GROUP_IC = { 'Giveaway basics': 'gift', 'Winners & rules': 'trophy', 'Placement & reach': 'megaphone', Branding: 'palette', 'Links to your site': 'link', 'Reports & winner help': 'chart-column' };
const SP_KEY = 'gh_sponsor_draft';
function sponsorPage(url) {
  const { icon, esc } = C;
  return catalog().then((cat) => {
    if (!cat) return C.shell('/sponsor', C.emptyState('triangle-alert', 'Could not load the sponsor form', 'Please try again in a moment.'));
    let saved = {}; try { saved = JSON.parse(C.ls.getItem(SP_KEY) || '{}'); } catch {}
    const B = { picked: saved.picked || { base: 1, weeks: 1 }, business_type: saved.business_type || '', licensed: false, brand: saved.brand || '', contact_name: saved.contact_name || '', potato: saved.potato || (C.S.me ? (C.S.me.potato || '') : ''), email: saved.email || '', start_date: saved.start_date || '', end_date: saved.end_date || '', details: saved.details || '', notes: saved.notes || '', prize: saved.prize || '', brand_color: saved.brand_color || '#22d3ee', games: saved.games || [], linked_requirements: Array.isArray(saved.linked_requirements) ? saved.linked_requirements.filter(x=>x && x.kind==='visit' && !x.required && x.target===undefined).slice(0,1) : [], competition: ['best','total'].includes(saved.competition) ? saved.competition : 'best', length_days: saved.length_days || '7', step: 1 };
    const COMP = { best: 'Highest verified score (one game)', total: 'Combined verified high scores (2–13 games)' };
    // Library titles are quote candidates, never automatically certified event games.
    const bookingGames = [...new Map([...(C.S.games || []), ...(C.S.libraryGames || [])]
      .filter(g => g && g.playable && !g.retired && g.giveaway !== false)
      .map(g => [g.id, g])).values()];
    const pre = url.searchParams.get('feature'); if (pre && cat.features.some(f => f.id === pre)) B.picked[pre] = B.picked[pre] || 1;
    const F = Object.fromEntries(cat.features.map(f => [f.id, f]));
    const persist = () => { const { licensed, step, ...rest } = B; C.ls.setItem(SP_KEY, JSON.stringify(rest)); };
    const readForm = () => { document.querySelectorAll('[data-b]').forEach(i => { B[i.dataset.b] = i.value.trim(); }); if (document.getElementById('sb-games')) B.games = [...document.querySelectorAll('#sb-games input:checked')].map(i => i.value); if(document.getElementById('sb-linked'))readLinked(); const lc = document.getElementById('licensed'); if (lc) B.licensed = lc.checked; persist(); };
    const linkedRow = v => `<div class="card pad" style="margin:10px 0">
      <div class="set-row"><b>Optional channel link</b><button class="btn sm ghost" type="button" id="sb-remove-link">Remove</button></div>
      <label class="field"><span class="lbl">Channel or brand name</span><input class="input" data-link-field="label" maxlength="90" value="${esc(v.label||'')}" placeholder="Visit our official channel"></label>
      <label class="field"><span class="lbl">Public channel link</span><input class="input" data-link-field="url" type="url" maxlength="400" value="${esc(v.url||'')}" placeholder="https://…"></label>
      <label class="field"><span class="lbl">Platform</span><select class="input" data-link-field="platform">${['potato','telegram','youtube','tiktok','instagram','discord','website','other'].map(x=>`<option value="${x}" ${v.platform===x?'selected':''}>${x[0].toUpperCase()+x.slice(1)}</option>`).join('')}</select></label>
      <p class="small muted">A promotional link only. No subscriber targets, guaranteed growth, mandatory follows or external verification.</p>
    </div>`;
    const readLinked = () => {
      const row=B.linked_requirements[0];
      if(!row)return;
      document.querySelectorAll('[data-link-field]').forEach(el=>{row[el.dataset.linkField]=el.value;});
    };
    const pickedList = () => cat.features.filter(f => B.picked[f.id] || f.required || f.included).map(f => ({ id: f.id, qty: f.unit === 'flat' ? 1 : (B.picked[f.id] || f.dflt || 1) }));
    const featRow = (f) => {
      const on = !!(B.picked[f.id] || f.required || f.included); const q = B.picked[f.id] || f.dflt || 1;
      return `<div class="sp-f ${on ? 'on' : ''} ${f.required || f.included ? 'fixed' : ''}" data-f="${f.id}">
        <label class="sp-chk"><input type="checkbox" data-pick="${f.id}" ${on ? 'checked' : ''} ${f.required || f.included ? 'disabled' : ''} aria-describedby="fd-${f.id}"><span class="box">${icon('check')}</span></label>
        <div class="sp-ft"><b>${esc(f.name)}</b>${f.included ? ' <span class="pill green">Included</span>' : ''}<div class="small muted" id="fd-${f.id}">${esc(f.desc)}</div>
        ${f.unit !== 'flat' && on ? `<div class="sp-qty" role="group" aria-label="${esc(f.name)} amount"><button type="button" class="iconbtn sm" data-q="${f.id}" data-d="-1" aria-label="Less" ${q <= f.min ? 'disabled' : ''}>−</button><b>${unitText(f, q)}</b><button type="button" class="iconbtn sm" data-q="${f.id}" data-d="1" aria-label="More" ${q >= f.max ? 'disabled' : ''}>+</button>${f.free ? `<span class="tiny muted">${f.free} included</span>` : ''}</div>` : ''}</div></div>`;
    };
    function draw(err = '') {
      const st = (n, l) => `<div class="st ${B.step >= n ? 'on' : ''}"><i>${n}</i>${l}</div>`;
      const sel = pickedList();
      let body = '';
      if (B.step === 1) body = `<p class="muted small" style="margin-top:0">Tick everything you want. You can change it later; Trap Tech will send you a quote for exactly what you picked.</p>
        ${cat.groups.map(g => `<section class="sp-g"><h3>${icon(GROUP_IC[g] || 'sparkles')} ${esc(g)}</h3>${cat.features.filter(f => f.group === g).map(featRow).join('')}</section>`).join('')}`;
      else if (B.step === 2) body = `
        <div class="field"><label class="lbl" for="bt">Business type</label><select class="input" id="bt" data-b="business_type"><option value="">Select your business type</option>${(cat.business_types || []).map(e => `<option ${B.business_type === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></div>
        <div id="lic-wrap">${B.business_type === cat.cannabis ? `<label class="check lic"><input type="checkbox" id="licensed" ${B.licensed ? 'checked' : ''}> <span>I confirm my business is licensed and legally permitted to operate and advertise in my jurisdiction <b class="req">(required)</b></span></label>` : ''}</div>
        <div class="field"><label class="lbl" for="sb-brand">Brand / channel name</label><input class="input" id="sb-brand" data-b="brand" value="${esc(B.brand)}" placeholder="Your brand or channel" maxlength="120"></div>
        <div class="field"><label class="lbl" for="sb-name">Your name <span class="muted small">(optional)</span></label><input class="input" id="sb-name" data-b="contact_name" value="${esc(B.contact_name)}" maxlength="120"></div>
        <div class="lbl">How can we reach you? <span class="muted small">(at least one)</span></div>
        <div class="field ic">${icon('message-circle')}<input class="input" id="sb-potato" data-b="potato" value="${esc(B.potato)}" placeholder="Potato username" maxlength="40" autocapitalize="none" aria-label="Potato username"></div>
        <div class="field ic">${icon('mail')}<input class="input" id="sb-email" type="email" data-b="email" value="${esc(B.email)}" placeholder="Email (optional if Potato given)" maxlength="160" autocapitalize="none" aria-label="Email"></div>
        <div class="grid2"><div class="field"><label class="lbl small" for="sb-s">Preferred start</label><input class="input" id="sb-s" type="date" data-b="start_date" value="${esc(B.start_date)}"></div><div class="field"><label class="lbl small" for="sb-e">Preferred end</label><input class="input" id="sb-e" type="date" data-b="end_date" value="${esc(B.end_date)}"></div></div>
        <div class="field"><label class="lbl" for="sb-prize">Prize</label><input class="input" id="sb-prize" data-b="prize" value="${esc(B.prize)}" maxlength="200" placeholder="What the winner gets"></div>
        <div class="grid2"><div class="field"><label class="lbl small" for="sb-col">Brand color</label><input class="input" id="sb-col" type="color" data-b="brand_color" value="${esc(B.brand_color)}"></div><div class="field"><label class="lbl small" for="sb-len">Length (days)</label><input class="input" id="sb-len" type="number" min="1" max="90" data-b="length_days" value="${esc(B.length_days)}"></div></div>
        <div class="field"><label class="lbl" for="sb-comp">Competition type</label><select class="input" id="sb-comp" data-b="competition">${Object.entries(COMP).map(([k, l]) => `<option value="${k}" ${B.competition === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div><p class="small muted" style="margin-top:2px">Winner: highest server-verified score at the published deadline. If tied, shortest server-measured qualifying run, then a verified skill metric; an exact tie gets a fair seeded skill playoff. A separate fastest-completion mode requires an independently certified finish timer, so it is not available for unapproved games.</p>
        <div class="field"><div class="lbl">Requested games <span class="muted small">(up to 13, subject to certification)</span></div><details class="card pad" id="sb-game-picker" ${B.games.length ? 'open' : ''}><summary>${B.games.length ? B.games.length + ' selected' : 'Browse ' + bookingGames.length + ' proposed games'}</summary><p class="small muted">Your choices are part of the quote, not an active competition. Trap Tech confirms approved games and scoring before any official share link is issued.</p><input class="input" type="search" id="sb-game-search" placeholder="Find a game by name" aria-label="Search proposed games" autocomplete="off"><div class="chip-row" id="sb-games" style="max-height:260px;overflow:auto">${bookingGames.map(g => `<label class="chip" data-game-title="${esc(g.title.toLowerCase())}"><input type="checkbox" value="${esc(g.id)}" ${B.games.includes(g.id) ? 'checked' : ''}> ${esc(g.title)}</label>`).join('')}</div></details></div>
        <div class="field"><h3>Optional brand/channel link</h3><p class="small muted">We can feature a link to your channel alongside a normal game giveaway. We do not promise subscribers or make following a requirement to win.</p>
          <div id="sb-linked">${B.linked_requirements.map(linkedRow).join('')}</div>
          ${!B.linked_requirements.length ? `<button class="btn sm ghost" id="sb-add-link" type="button">${icon('plus')} Add channel link</button>` : ''}
        </div>
        <div class="field"><label class="lbl" for="sb-d">More giveaway details</label><textarea class="input" id="sb-d" data-b="details" maxlength="4000" placeholder="Prize, which games, brand colors / logo link, age or region rules...">${esc(B.details)}</textarea></div>
        <div class="field"><label class="lbl" for="sb-n">Notes for Trap Tech <span class="muted small">(optional)</span></label><textarea class="input" id="sb-n" data-b="notes" maxlength="2000" placeholder="Budget, timing, anything else we should know">${esc(B.notes)}</textarea></div>`;
      else body = `<div class="card pad rv">${[['Features', sel.map(x => F[x.id].name + (F[x.id].unit !== 'flat' ? ` (${unitText(F[x.id], x.qty)})` : '')).join(', ')], ['Business type', B.business_type], ...(B.business_type === cat.cannabis ? [['License', 'Confirmed licensed and legally permitted to advertise']] : []), ['Brand', B.brand], ['Prize', B.prize], ['Brand color', B.brand_color], ['Games', B.games.map(id => (bookingGames.find(g => g.id === id) || {}).title || id).join(', ') || 'Trap Tech picks'], ['Optional brand channel', B.linked_requirements.map(x=>x.label+' ('+x.url+')').join('; ') || 'None'], ['Competition', COMP[B.competition]], ['Winner rule', B.competition==='best'?'Highest valid single run; then faster server-timed run, skill metric and seeded playoff':'Highest combined best runs; different game scoring scales must be approved before the event goes live'], ['Length', B.length_days + ' days'], ['Contact', [B.contact_name, B.potato ? '@' + B.potato.replace(/^@/, '') + ' on Potato' : '', B.email].filter(Boolean).join(' • ')], ['Dates', `${B.start_date || 'flexible'} → ${B.end_date || 'flexible'}`], ['Details', B.details || '-'], ['Notes', B.notes || '-']].map(([k, v]) => `<div class="rv-row"><span class="muted">${k}</span><span>${esc(v)}</span></div>`).join('')}</div>
        <p class="small muted">Sending a request is free and commits you to nothing. You'll get a private link to see your quote, then accept or decline it.</p>`;
      C.shell('/sponsor', `<div class="narrow sponsor">
        ${C.pageHead('Book a Giveaway', 'Put your brand and prize in front of players who are already competing.')}
        ${B.step === 1 ? `<div class="banner sp-hero"><div class="sp-hero-t"><h2>Pick what you want. <span class="grad-text">Get a quote.</span></h2><div style="color:#d9dcff">No packages to squeeze into: choose any mix of features below. Trap Tech Solutions builds and runs it, contacts your winners on Potato and sends you the stats.</div></div>${C.TT('mono', 72)}</div>
          <div class="howto sp-how">${[['Pick features', 'Tick what you want from one list.'], ['Send a free request', 'Your brand, prize and how to reach you.'], ['Get your quote', 'We price it and send it to your private status page.'], ['Accept & launch', 'Accept online, settle on Potato, we build and launch.']].map(([t, d], i) => `<div class="card"><span class="num">${i + 1}</span><div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join('')}</div>` : ''}
        <div class="steps">${st(1, 'Features')}<span class="bar"></span>${st(2, 'Details')}<span class="bar"></span>${st(3, 'Review')}</div>
        <div class="card pad">${err ? `<div class="err" role="alert">${esc(err)}</div>` : ''}${body}
          <div class="sp-nav">${B.step > 1 ? `<button class="btn ghost" id="prev">Back</button>` : ''}<button class="btn" id="next">${B.step === 1 ? `Next: your details <span class="sp-count">${sel.length} picked</span>` : B.step === 2 ? 'Review' : 'Send quote request'}</button></div></div>
        ${B.step === 1 ? `<div class="section-h" id="faq"><h2>${icon('circle-help')} Sponsor FAQ</h2></div><div class="faq">${(cat.faq || []).map(([q, a], i) => `<details class="card" ${i === 0 ? 'open' : ''}><summary>${esc(q)}${icon('chevron-down')}</summary><p>${esc(a)}</p></details>`).join('')}</div>
        <div class="card tt-build" style="margin-top:14px"><div class="ttb-head">${C.TT('horizontal', 50)}<span class="pill">${icon('code-xml')} Built in-house</span></div><p class="muted" style="margin:8px 0">Every sponsorship is set up by Trap Tech Solutions: giveaway, brand theme, branded games, verified high-score leaderboards, published skill-based tiebreakers and official rules with "no purchase necessary".</p><a class="btn sm ghost" href="/about">${icon('building-2')} About Trap Tech</a></div>` : ''}
        <p class="small dim center">Sponsors must comply with all laws that apply to their business, products and advertising. See the <a href="/terms">Terms</a> and <a href="/rules">Official Rules</a>.</p></div>`, { title: 'Book a Giveaway' });
      const root = document.getElementById('main');
      root.querySelectorAll('[data-pick]').forEach(cb => cb.onchange = () => { if (cb.checked) B.picked[cb.dataset.pick] = F[cb.dataset.pick].dflt || 1; else delete B.picked[cb.dataset.pick]; persist(); const y = scrollY; draw(); scrollTo(0, y); });
      root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { const f = F[b.dataset.q]; B.picked[f.id] = Math.max(f.min, Math.min(f.max, (B.picked[f.id] || f.dflt || 1) + +b.dataset.d)); persist(); const y = scrollY; draw(); scrollTo(0, y); });
      const gameSearch=document.getElementById('sb-game-search');
      if (gameSearch) gameSearch.addEventListener('input', () => {
        const query=gameSearch.value.trim().toLowerCase();
        root.querySelectorAll('#sb-games [data-game-title]').forEach(el => { const show=el.dataset.gameTitle.includes(query); el.hidden=!show; el.style.display=show?'':'none'; });
      });
      const gamePicker=document.getElementById('sb-games');
      if (gamePicker) gamePicker.addEventListener('change', e => {
        const check=e.target;
        if (!check || check.type!=='checkbox') return;
        const selected=gamePicker.querySelectorAll('input:checked');
        if (selected.length>13) { check.checked=false; C.toast('Select up to 13 games per giveaway request.'); return; }
        B.games=[...selected].map(x=>x.value);persist();
      });
      const addLink = document.getElementById('sb-add-link');
      if(addLink)addLink.onclick=()=>{ readForm(); B.linked_requirements=[{kind:'visit',label:'',url:'',platform:'potato',required:false}];persist();draw(); };
      const removeLink=document.getElementById('sb-remove-link');
      if(removeLink)removeLink.onclick=()=>{ B.linked_requirements=[];persist();draw(); };
      const bt = document.getElementById('bt'); if (bt) bt.onchange = () => { readForm(); B.licensed = false; draw(); };
      const pv = document.getElementById('prev'); if (pv) pv.onclick = () => { if (B.step === 2) readForm(); B.step--; draw(); scrollTo(0, 0); };
      document.getElementById('next').onclick = async () => {
        if (B.step === 2) {
          readForm(); B.potato = B.potato.replace(/^@/, '');
          if (!B.business_type) return draw('Please choose your business type.');
          if (B.business_type === cat.cannabis && !B.licensed) return draw('Please confirm your business is licensed and legally permitted to operate and advertise in your jurisdiction.');
          if (!B.brand) return draw('Brand / channel name is required.');
          if (!B.email && !B.potato) return draw('Add a Potato username or an email (at least one) so we can reach you.');
          if (B.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(B.email)) return draw('That email address does not look right.');
          if (B.start_date && B.end_date && B.end_date < B.start_date) return draw('End date must be after the start date.');
          if(B.competition==='best'&&B.games.length!==1)return draw('Highest verified score requires exactly one selected game.');
          if(B.competition==='total'&&(B.games.length<2||B.games.length>13))return draw('Combined high scores require 2–13 distinct games.');
          if(new Set(B.games).size!==B.games.length)return draw('You cannot request the same game twice.');
        }
        if (B.step < 3) { B.step++; draw(); return scrollTo(0, 0); }
        const btn = document.getElementById('next'); btn.disabled = true;
        const r = await C.api('/api/sponsor/requests', { method: 'POST', body: { ...B, features: pickedList(), picked: undefined } });
        if (!r.ok) { btn.disabled = false; return draw(r.error); }
        C.ls.removeItem(SP_KEY); const mine = JSON.parse(C.ls.getItem('gh_sponsor_requests') || '[]'); mine.unshift({ token: r.token, brand: B.brand, at: Date.now() }); C.ls.setItem('gh_sponsor_requests', JSON.stringify(mine.slice(0, 10)));
        C.go(r.status_url + '?new=1', true);
      };
    }
    draw();
  });
}
const SP_STATE = { pending: ['hourglass', 'Request received', 'Trap Tech is preparing your quote. You can close this page; bookmark it to come back.'], sent: ['file-text', 'Your quote is ready', 'Review it below and accept or decline.'], accepted: ['handshake', 'Quote accepted', 'Thank you! Message us on Potato to settle the amount; we start building your giveaway.'], declined: ['circle-x', 'Quote declined', 'No problem. You can send a new request any time.'], paid: ['badge-check', 'Payment recorded — launch review pending', 'Trap Tech is preparing the event and verifying game quality. Your official share link appears here only after final approval.'] };
async function sponsorStatus(m, url) {
  setTimeout(() => { const b = document.getElementById('ev-copy'); if (b) b.onclick = () => navigator.clipboard && navigator.clipboard.writeText(location.origin + document.querySelector('#ev-share a').getAttribute('href')); }, 50);
  const { icon, esc } = C;
  const tok = m[1]; const r = await C.api('/api/sponsor/requests/' + encodeURIComponent(tok));
  if (!r.ok) return C.shell('/sponsor', C.emptyState('file-text', 'Request not found', 'Check that you opened the full link we gave you.', '<a class="btn sm" href="/sponsor">Book a Giveaway</a>'), { title: 'Sponsor request' });
  const q = r.request; const s = SP_STATE[q.status] || SP_STATE.pending; const hd = q.potato_handle || 'TrapTechSolutions';
  const qt = q.quote; const steps = ['pending', 'sent', 'accepted', 'paid']; const at = q.status === 'declined' ? 1 : steps.indexOf(q.status);
  C.shell('/sponsor', `<div class="narrow sponsor">
    ${q.event ? `<div class="card pad ev-share" id="ev-share"><h2>${icon('badge-check')} Your official giveaway is booked</h2><p class="small muted">Share this private event link (or the QR code) with your audience. Only runs started from this link count.</p><p><a class="btn sm" href="${esc(q.event.url)}">${esc(location.origin + q.event.url)}</a> <button class="btn sm ghost" id="ev-copy">${icon('copy')} Copy</button></p><div class="ev-qr" style="max-width:220px;background:#fff;border-radius:12px;padding:8px">${q.event.qr_svg}</div></div>` : ''}
    ${q.linked_requirements?.length? `<div class="card pad"><h3>${icon('link')} Optional brand channel</h3>${q.linked_requirements.map(x=>`<p class="small"><b>${esc(x.label)}</b> — optional promotional link, never an entry condition. <a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Open channel</a></p>`).join('')}</div>`:''}
        ${C.pageHead('Your sponsor request', esc(q.brand) + ' • sent ' + day(q.created_at), false)}
    ${url.searchParams.get('new') ? `<div class="card pad sp-saved" role="status">${icon('circle-check')}<div><b>Request sent.</b><div class="small muted">Bookmark this page: it's your private link to see and answer the quote. Anyone with the link can see it, so keep it to yourself.</div><button class="btn sm ghost" id="cp-link" style="margin-top:8px">${icon('copy')} Copy my private link</button></div></div>` : ''}
    <div class="card pad sp-state st-${q.status}"><span class="es-ic">${icon(s[0])}</span><div><h2>${s[1]}</h2><p class="muted small" style="margin:4px 0 0">${s[2]}</p></div></div>
    ${q.status === 'paid' && !q.event ? `<div class="card pad" role="status"><b>${icon('shield-check')} Official event not yet published</b><p class="small muted" style="margin:8px 0 0">Payment has been recorded, but a private draft is not a playable giveaway. No share link or qualifying competition is active until Trap Tech certifies the selected game and publishes the official event.</p></div>` : ''}
    <ol class="sp-track" aria-label="Progress">${['Requested', 'Quote sent', 'Accepted', 'Paid', 'Event approved'].map((l, i) => `<li class="${i < 4 ? (i <= at ? 'on' : '') : (q.event ? 'on' : '')} ${q.status === 'declined' && i === 2 ? 'x' : ''}">${l}</li>`).join('')}</ol>
    ${qt ? `<div class="card pad sp-quote"><h3>${icon('file-text')} Quote</h3>
      <table class="sp-lines"><tbody>${qt.lines.map(l => `<tr><td>${esc(l.label)}${l.note ? `<div class="tiny muted">${esc(l.note)}</div>` : ''}</td><td class="amt">${l.amount_cents ? money(l.amount_cents) : '<span class="muted">included</span>'}</td></tr>`).join('')}
      ${qt.discount_pct ? `<tr class="disc"><td>Discount ${qt.discount_pct}%</td><td class="amt">−${money(Math.round(qt.lines.reduce((t, l) => t + (l.amount_cents || 0), 0) * qt.discount_pct / 100))}</td></tr>` : ''}${qt.discount_cents ? `<tr class="disc"><td>Discount</td><td class="amt">−${money(qt.discount_cents)}</td></tr>` : ''}
      <tr class="tot"><td>Total</td><td class="amt" id="sp-total">${money(qt.total_cents)}</td></tr></tbody></table>
      ${qt.note ? `<p class="small"><b>From Trap Tech:</b> ${esc(qt.note)}</p>` : ''}
      ${qt.status === 'sent' ? (qt.expired ? `<div class="err">This quote expired on ${day(qt.valid_until)}. Message us on Potato for a fresh one.</div>` : `<p class="small muted">Valid until ${day(qt.valid_until)}. Payment is settled with Trap Tech Solutions on Potato after you accept.</p><div class="btn-row"><button class="btn" id="sp-acc">${icon('check')} Accept quote</button><button class="btn ghost" id="sp-dec">Decline</button></div>`) : ''}
    </div>` : ''}
    <div class="card pad"><h3>${icon('list-checks')} What you asked for</h3><ul class="sp-asked">${q.features.map(f => `<li>${icon('check')}<span>${esc(f.label)}</span></li>`).join('')}</ul>
      ${q.start_date || q.end_date ? `<p class="small muted">Dates: ${esc(q.start_date || 'flexible')} → ${esc(q.end_date || 'flexible')}</p>` : ''}${q.details ? `<p class="small"><b>Details:</b> ${esc(q.details)}</p>` : ''}${q.notes ? `<p class="small"><b>Notes:</b> ${esc(q.notes)}</p>` : ''}</div>
    <div class="potato-confirm"><div class="pc-ic">${icon('message-circle')}</div><div><b>Questions? Message <span class="handle">@${esc(hd)}</span> on Potato.</b><div class="small muted">Mention request #${q.id}.</div></div></div>
    <div class="btn-row center-row"><button class="btn ghost sm" id="copy-handle">${icon('copy')} Copy @${esc(hd)}</button><a class="btn ghost sm" href="/sponsor">${icon('plus')} New request</a></div></div>`, { title: 'Your sponsor request' });
  const cp = document.getElementById('cp-link'); if (cp) cp.onclick = async () => { if (await C.copyText(((document.querySelector('meta[name="public-url"]') || {}).content || location.origin) + location.pathname, 'Copy your private link')) C.toast('Link copied'); };
  document.getElementById('copy-handle').onclick = async () => { if (await C.copyText('@' + hd, 'Copy our Potato username')) C.toast('Copied @' + hd); };
  const act = (a) => async () => { if (a === 'decline' && !confirm('Decline this quote?')) return; const x = await C.api(`/api/sponsor/requests/${encodeURIComponent(tok)}/${a}`, { method: 'POST', body: {} }); if (!x.ok) return C.toast(x.error || 'Could not save'); C.toast(a === 'accept' ? 'Quote accepted' : 'Quote declined'); sponsorStatus(m, new URL(location.href)); };
  const ac = document.getElementById('sp-acc'); if (ac) ac.onclick = act('accept');
  const dc = document.getElementById('sp-dec'); if (dc) dc.onclick = act('decline');
}

// ---------------- brands ----------------
const BR_KEY = 'gh_brand_code';
async function joinPage(m) {
  const { icon, esc } = C;
  const code = m[1].toUpperCase(); const r = await C.api('/api/brands/invite/' + encodeURIComponent(code));
  if (!r.ok) return C.shell('/giveaways', C.emptyState('link', 'Invite link not valid', 'Ask the brand for a fresh link, or pick a brand when you create your account.', '<a class="btn sm" href="/giveaways">See giveaways</a>'), { title: 'Brand invite' });
  const b = r.brand; const me = r.me; const mine = me && me.brand && me.brand.id === b.id;
  if (!C.S.me) C.ls.setItem(BR_KEY, code);
  C.shell('/giveaways', `<div class="narrow br-join" style="--bc:${esc(b.color || '#8b5cf6')}">
    <div class="card pad br-card center">${brandLogo(b, 84)}<h1>${esc(b.name)}</h1><p class="muted">${esc(b.tagline || '')}</p>
      <div class="br-stats"><span>${icon('users')} ${C.fmt(b.members)} member${b.members === 1 ? '' : 's'}</span><span>${icon('gift')} ${b.live} live giveaway${b.live === 1 ? '' : 's'}</span></div>
      ${mine ? `<div class="pill green">${icon('check')} You're in ${esc(b.name)}</div><a class="btn block" href="/giveaways" style="margin-top:12px">See giveaways</a>`
      : !C.S.me ? `<a class="btn block" href="/signup?brand=${encodeURIComponent(code)}">${icon('user-plus')} Create account &amp; join</a><a class="btn block ghost" href="/signin?next=${encodeURIComponent('/join/' + code)}" style="margin-top:8px">I have an account</a>`
      : me.brand && !me.can_switch ? `<div class="err">You're in ${esc(me.brand.name)}. You can switch brands from ${day(me.can_switch_at)} (once every ${r.cooldown_days} days).</div>`
      : `<button class="btn block" id="br-go">${icon('user-check')} ${me.brand ? `Switch from ${esc(me.brand.name)} to ${esc(b.name)}` : `Join ${esc(b.name)}`}</button>${me.brand ? `<p class="tiny muted">Switching leaves your entries in ${esc(me.brand.name)}-only giveaways that are still live.</p>` : ''}`}
    </div>
    <div class="card pad"><h3>${icon('info')} How brands work</h3><ul class="br-how"><li>You belong to <b>one brand</b> at a time.</li><li>Brand giveaways are for that brand's members. Some are <b>open to everyone</b>.</li><li>You can switch brands once every <b>${r.cooldown_days} days</b>.</li><li>Joining is free. Nothing to buy, ever.</li></ul></div></div>`, { title: `Join ${b.name}` });
  const g = document.getElementById('br-go'); if (g) g.onclick = async () => { g.disabled = true; const x = await C.api('/api/me/brand', { method: 'POST', body: { code, via: 'link' } }); if (!x.ok) { g.disabled = false; return C.toast(x.error); } C.toast(`You're in ${b.name}`); if (x.left_giveaways && x.left_giveaways.length) C.toast(`Left: ${x.left_giveaways.join(', ')}`, 4000); joinPage(m); };
}
// signup: brand picker (prefilled from /join/<code> or ?brand=)
export function signupBrandField(url) {
  const pre = (url.searchParams.get('brand') || C.ls.getItem(BR_KEY) || '').toUpperCase();
  setTimeout(async () => {
    const el = document.getElementById('su-brand'); if (!el) return; const r = await C.api('/api/brands'); if (!r.ok || !r.brands.length) return el.remove();
    let preB = null; if (pre) { const x = await C.api('/api/brands/invite/' + encodeURIComponent(pre)); if (x.ok) preB = x.brand; }
    el.innerHTML = `<label class="lbl" for="su-br">Brand <span class="muted tiny">(optional - one brand at a time, switch every ${r.cooldown_days} days)</span></label>
      <div class="field ic">${C.icon('store')}<select class="input" id="su-br"><option value="">No brand for now</option>${r.brands.map(b => `<option value="${C.esc(b.slug)}" ${preB && preB.id === b.id ? 'selected' : ''}>${C.esc(b.name)}</option>`).join('')}</select></div>
      ${preB ? `<input type="hidden" id="su-brcode" value="${C.esc(pre)}" data-slug="${C.esc(preB.slug)}">` : ''}`;
  }, 0);
  return `<div id="su-brand" class="su-brand"></div>`;
}
export async function afterSignup() {
  const sel = document.getElementById('su-br'); if (!sel || !sel.value) return;
  const code = document.getElementById('su-brcode'); const viaLink = !!(code && code.dataset.slug === sel.value);
  const x = await C.api('/api/me/brand', { method: 'POST', body: { code: viaLink ? code.value : sel.value, via: viaLink ? 'link' : 'signup' } });
  if (x.ok) { C.ls.removeItem(BR_KEY); C.toast(`You're in ${x.brand.name}`); }
}
// Settings: brand affiliation controls giveaway eligibility, not an external channel connection.
export function brandCard() { setTimeout(mountBrand, 0); return `<div class="card pad" id="v7-brand"><h2 style="margin-bottom:6px">${C.icon('store')} My giveaway affiliation</h2><div class="small muted">Loading membership…</div></div>`; }
async function mountBrand() {
  const el = document.getElementById('v7-brand'); if (!el || !C.S.me) return;
  const [st, all] = await Promise.all([C.api('/api/me/brand'), C.api('/api/brands')]); if (!st.ok) return;
  const { icon, esc } = C;
  const explanation = 'This is your Gaming Hub giveaway affiliation only. It determines eligibility for brand-member giveaways; it does not connect Telegram, manage an external channel, grant channel ownership/admin rights, or create/book a giveaway.';
  const lockExplanation = !st.can_switch
    ? ' Brand switching is locked until ' + day(st.can_switch_at) + '. Leaving does not reset or bypass the 30-day cooldown.'
    : ' You may switch brands once every ' + st.cooldown_days + ' days; leaving or switching ends entries in active member-only giveaways for the previous brand.';
  el.innerHTML = `<h2 style="margin-bottom:6px">${icon('store')} My giveaway affiliation</h2>
    ${st.brand ? `<div class="br-mine">${brandLogo(st.brand, 40)}<div><b>${esc(st.brand.name)}</b><div class="tiny muted">Hub affiliation since ${day(st.joined_at)}${st.can_switch ? ' • switching available' : ` • switching locked until ${day(st.can_switch_at)} (30-day cooldown)`}</div></div><button class="btn sm ghost" id="br-leave">Leave</button></div>`
      : `<p class="small muted" style="margin:0 0 8px">No brand selected. Joining is optional; choose one only if you want to enter giveaways restricted to its Hub members.</p>`}
    <p class="small muted" style="margin:8px 0">${esc(explanation + lockExplanation)}</p>
    ${st.can_switch ? `<form id="br-f" class="br-form"><div class="field ic">${icon('link')}<input class="input" id="br-code" placeholder="Brand invite code" maxlength="40" autocapitalize="characters" aria-label="Brand invite code"></div><select class="input" id="br-pick" aria-label="Or pick a brand"><option value="">…or pick a brand</option>${(all.brands || []).filter(b => !st.brand || b.id !== st.brand.id).map(b => `<option value="${esc(b.slug)}">${esc(b.name)} (${C.fmt(b.members)})</option>`).join('')}</select><button class="btn sm">${st.brand ? 'Switch' : 'Join'}</button></form>` : ''}`;
  if (location.hash === '#v7-brand') el.scrollIntoView({ block: 'start' });
  const f = document.getElementById('br-f'); if (f) f.onsubmit = async (e) => { e.preventDefault(); const code = document.getElementById('br-code').value.trim() || document.getElementById('br-pick').value; if (!code) return C.toast('Enter a code or pick a brand'); if (st.brand && !confirm(`Switch brand? You will leave entries in active member-only giveaways for ${st.brand.name}, and cannot switch again for ${st.cooldown_days} days.`)) return; const x = await C.api('/api/me/brand', { method: 'POST', body: { code } }); C.toast(x.ok ? `You're in ${x.brand.name}` : x.error); if (x.ok) mountBrand(); };
  const lv = document.getElementById('br-leave'); if (lv) lv.onclick = async () => { if (!confirm('Leave this Hub brand? You will lose entries in its active member-only giveaways. Leaving does not reset or bypass the 30-day switching cooldown.')) return; const x = await C.api('/api/me/brand/leave', { method: 'POST', body: {} }); C.toast(x.ok ? 'You left the brand' : x.error); mountBrand(); };
}
// giveaway pages: the brand/audience pill
export function audiencePill(g) {
  if (!g || g.open_to_all !== false || !g.brand) return g && g.brand ? `<span class="tier-pill aud open">${C.icon('globe')}Open to everyone</span>` : '';
  return `<span class="tier-pill aud brand" style="--bc:${C.esc(g.brand.color || '#8b5cf6')}">${C.icon('store')}${C.esc(g.brand.name)} members</span>`;
}

export function install(ctx) {
  C = ctx; const { route, go } = ctx;
  route(/^\/sponsor$/, (m, url) => sponsorPage(url));
  route(/^\/sponsor\/status\/([A-Za-z0-9_-]{20,40})$/, sponsorStatus);
  route(/^\/(host|book)$/, (m, url) => go('/sponsor' + (url.searchParams.get('feature') ? '?feature=' + encodeURIComponent(url.searchParams.get('feature')) : ''), true));
  route(/^\/join\/([A-Za-z0-9-]{3,40})$/, joinPage);
  route(/^\/channels$/, () => go('/settings#v7-brand', true));
  route(/^\/c\/[\w-]+$/, () => go('/giveaways', true));
  ECON.install(ctx); // shop + seasons pages (public/js/economy.js)
  AVED.install(ctx); // v7 Phase 5 avatar editor (public/js/avatar-editor.js)
  STORE.install(ctx); // v7 Phase 4 Hub Store (public/js/hub-store.js)
}

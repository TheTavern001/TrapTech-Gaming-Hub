// v7 shop + seasons pages (docs/ECONOMY.md): Points Shop with daily / weekly featured / season / event sections,
// rendered previews, item detail sheet with "preview on my profile", earned items, season pass (60 levels, perks,
// hall of fame) and the "How Seasons & Shop work" explainer. Installed from v7.js; routes run before app.js's.
let C = null;
const TYPE = { banner: 'Banner', frame: 'Avatar frame', title: 'Title', color: 'Name color', effect: 'Profile effect', badge: 'Badge' };
const TYPE_IC = { banner: 'image', frame: 'circle-dot', title: 'type', color: 'palette', effect: 'sparkles', badge: 'award' };
const localAt = (t, o = { weekday: 'short', hour: 'numeric', minute: '2-digit' }) => new Date(t).toLocaleString([], o);
const dateOf = (t) => new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
const cdi = (t) => `<span data-cdi="${t}">--</span>`;
let ME_COS = null;
async function myCos() { if (!C.S.me) return null; if (ME_COS && ME_COS.u === C.S.me.username) return ME_COS.cos; const r = await C.api('/api/profile/' + encodeURIComponent(C.S.me.username)); ME_COS = { u: C.S.me.username, cos: r.ok ? (r.profile || r).cos || null : null, level: r.ok ? (r.profile || r).level : null }; return ME_COS.cos; }

// ---------- rendered previews ----------
function preview(it, size = '') {
  const { esc, framed, icon } = C; const me = (C.S.me && C.S.me.username) || 'Player';
  const cls = `ec-prev ${size} r-${esc(it.rarity)}`;
  if (it.type === 'banner') return `<span class="${cls} bn-${esc(it.id)}"><span class="ec-mini">${framed(me, false, { frame: 'none' })}<b>${esc(me)}</b></span></span>`;
  if (it.type === 'effect') return `<span class="${cls} bn-midnight fx ${esc(it.id)}"><span class="ec-mini">${framed(me, false, { frame: 'none' })}<b>${esc(me)}</b></span></span>`;
  if (it.type === 'frame') return `<span class="${cls} ec-stage">${framed(me, false, { frame: it.id }, 'lg')}</span>`;
  if (it.type === 'color') return `<span class="${cls} ec-stage"><span class="pname nc-${esc(it.id)}"><span class="nm"><span class="nt ec-big">${esc(me)}</span></span></span></span>`;
  if (it.type === 'title') return `<span class="${cls} ec-stage ec-col"><span class="ec-nm">${esc(me)}</span><span class="ptitle big">${esc(it.name)}</span></span>`;
  return `<span class="${cls} ec-stage">${it.art ? `<img class="ec-medal" src="${esc(it.art)}" alt="" width="84" height="84" loading="lazy">` : `<span class="eqbadge big t-${esc(it.rarity)}">${icon(it.icon || 'award')}</span>`}</span>`;
}
// a profile header with this item swapped into the player's own look
function profilePreview(it, cos) {
  const { esc, framed, badgeIcon } = C; const me = (C.S.me && C.S.me.username) || 'Player';
  const c = { banner: 'midnight', frame: 'none', title: 'Rookie', ...(cos || {}) };
  if (it.type === 'banner') c.banner = it.id; if (it.type === 'frame') c.frame = it.id; if (it.type === 'color') c.color = it.id; if (it.type === 'effect') c.effect = it.id;
  if (it.type === 'title') c.title = it.name; if (it.type === 'badge') c.badge = { id: it.id, name: it.name, icon: it.icon || 'award', tier: it.rarity };
  return `<div class="prof-banner ec-pp bn-${esc(c.banner)}${c.effect ? ' fx ' + esc(c.effect) : ''}"><div class="prof-head">${framed(me, false, c, 'lg')}
    <div><div class="name${c.color ? ' nc-' + esc(c.color) : ''}"><span class="nt">${esc(me)}</span>${badgeIcon(c.badge)}</div><div class="ptitle big">${esc(c.title)}</div><div class="small pmeta">Preview only - nothing is bought until you tap Buy</div></div></div></div>`;
}
function card(it, balance) {
  const { esc, icon, fmt } = C; const signed = !!C.S.me; const price = it.your_price ?? it.price; const short = signed && balance < price;
  return `<div class="card shop-item ec-card r-${esc(it.rarity)} ${it.owned ? 'owned' : ''}" data-item="${esc(it.id)}" tabindex="0" role="button" aria-label="${esc(it.name)} details">
    ${it.tag_label ? `<span class="ec-tag t-${esc(it.tag)}">${esc(it.tag_label)}</span>` : ''}${preview(it)}
    <div class="si-body"><div class="si-top"><b>${esc(it.name)}</b><span class="rar-chip r-${esc(it.rarity)}">${esc(it.rarity_label)}</span></div>
      <div class="tiny muted">${icon(TYPE_IC[it.type])} ${esc(TYPE[it.type])}${it.theme ? ' • ' + esc(it.theme) : ''}</div>
      ${it.owned ? `<span class="btn sm ghost block ec-owned">${icon('check')} Owned</span>` : `<span class="btn sm block ec-price ${short ? 'ghost' : ''}">${icon('coins')} ${it.your_price != null && it.your_price !== it.price ? `<s>${fmt(it.price)}</s> ` : ''}${fmt(price)}</span>`}</div></div>`;
}
const grid = (id, items, bal) => `<div class="shop-grid ec-grid" id="${id}">${items.map(i => card(i, bal)).join('')}</div>`;

// ---------- detail sheet ----------
async function detailSheet(id, onBought) {
  const { esc, icon, fmt, api, toast } = C;
  const [r, cos] = await Promise.all([api('/api/shop/item/' + encodeURIComponent(id)), myCos()]);
  if (!r.ok) return toast(r.error || 'Could not load that item.');
  const it = r.item; const p = r.price; const h = r.history || {}; let tab = 'item';
  const d = document.createElement('div'); d.className = 'sheet ec-sheet'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-label', it.name);
  const why = p ? `<table class="ec-why"><tbody>
      <tr><td>Starting price (${esc(it.rarity_label)} ${esc(TYPE[it.type].toLowerCase())})</td><td>${fmt(p.base)}</td></tr>
      <tr><td>Demand (${p.recent_buys} bought in 14 days)</td><td>x${p.demand}</td></tr>
      <tr><td>Scarcity (${p.owners} of ~${fmt(p.active_players)} active players own it)</td><td>x${p.scarcity}</td></tr>
      <tr><td>${p.tag === 'vault' ? 'Back from the Vault' : p.appearances === 0 ? 'Debut day' : `Seen ${p.appearances} time${p.appearances === 1 ? '' : 's'} before`}</td><td>x${p.appear_mult}</td></tr>
      ${p.section_mult !== 1 ? `<tr><td>Limited (season / event only)</td><td>x${p.section_mult}</td></tr>` : ''}
      <tr class="tot"><td>Today's price</td><td>${icon('coins')} ${fmt(p.price)}</td></tr>${r.your_price != null && r.your_price !== p.price ? `<tr class="tot"><td>Your price (season perk)</td><td>${icon('coins')} ${fmt(r.your_price)}</td></tr>` : ''}</tbody></table>` : '';
  const draw = () => {
    d.innerHTML = `<div class="sheet-in card ec-detail"><div class="panel-h"><h2>${esc(it.name)}</h2><button class="iconbtn" data-x aria-label="Close">${icon('x')}</button></div>
      <div class="tabs ec-tabs"><button data-t="item" class="${tab === 'item' ? 'on' : ''}">Item</button><button data-t="me" class="${tab === 'me' ? 'on' : ''}" id="ec-on-me">${icon('eye')} On my profile</button></div>
      <div class="ec-big">${tab === 'item' ? preview(it, 'lg') : profilePreview(it, cos)}</div>
      <div class="ec-facts"><span class="rar-chip r-${esc(it.rarity)}">${esc(it.rarity_label)}</span><span class="pill">${icon(TYPE_IC[it.type])} ${esc(TYPE[it.type])}</span>${it.tag_label ? `<span class="pill">${esc(it.tag_label)}</span>` : ''}<span class="pill">${icon('users')} ${fmt(r.owners)} own it</span></div>
      <p class="small muted">${esc(r.source)}${r.where ? ` • on sale in the ${r.where.section === 'event' ? esc(r.where.event) : r.where.section} shop for ${cdi(r.where.ends_at)} (until ${localAt(r.where.ends_at)})` : r.sold ? ' • not in the shop right now' : ''}</p>
      ${r.requirement ? `<div class="nocash">${icon('target')} <span><b>Earned, not bought.</b> ${esc(r.requirement)}.</span></div>` : ''}
      ${why ? `<h3 class="ec-h">Why this price</h3>${why}` : ''}
      ${r.sold ? `<h3 class="ec-h">History</h3><ul class="ec-hist small"><li>${h.first_seen ? `First in the shop ${dateOf(h.first_seen)}` : 'Not in the shop yet'}</li><li>${h.appearances} appearance${h.appearances === 1 ? '' : 's'} so far • retires to the Vault after ${h.retire_after}</li>${h.vaulted ? `<li>In the Vault since ${dateOf(h.vaulted_at)}: it can return after 90 days for 25% more</li>` : ''}</ul>` : ''}
      <div class="btn-row">${it.owned ? `<a class="btn" href="/u/${encodeURIComponent((C.S.me || {}).username || '')}?tab=${it.type}#customize">${icon('check')} Owned - equip it</a>`
        : r.on_sale ? (C.S.me ? `<button class="btn" id="ec-buy">${icon('coins')} Buy for ${fmt(r.your_price ?? p.price)}</button>` : `<a class="btn" href="/signup?next=/shop">Sign up to buy</a>`) : ''}
        <button class="btn ghost" data-x>Close</button></div></div>`;
    C.tickInline && C.tickInline();
    d.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; draw(); });
    const buy = d.querySelector('#ec-buy'); if (buy) buy.onclick = async () => {
      buy.disabled = true; const x = await api('/api/shop/buy', { method: 'POST', body: { item: it.id } });
      if (!x.ok) { buy.disabled = false; return toast(x.error); }
      toast(`${x.item.name} added to your collection`); d.remove(); onBought && onBought();
    };
  };
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-x]')) d.remove(); });
  d.addEventListener('keydown', (e) => { if (e.key === 'Escape') d.remove(); });
  draw(); document.body.appendChild(d); d.querySelector('[data-x]').focus();
}

// ---------- /shop ----------
async function shopPage() {
  const { shell, api, icon, esc, fmt } = C;
  let catalogOffset = 0, catalogType = '', catalogQuery = '', catalogResults = [];
  const draw = async () => {
    const r = await api('/api/shop'); if (!r.ok) return shell('/shop', C.emptyState('triangle-alert', 'The shop is unavailable', esc(r.error || '')));
    const bal = r.balance; const ev = r.events || [];
    const catUrl = '/api/shop/catalog?limit=24&offset=' + catalogOffset + '&type=' + encodeURIComponent(catalogType) + '&q=' + encodeURIComponent(catalogQuery);
    const cat = await api(catUrl);
    if (cat.ok) {
      const page = cat.items || [];
      if (catalogOffset === 0) catalogResults = page;
      else { const byId = new Map(catalogResults.map(x => [x.id, x])); page.forEach(x => byId.set(x.id, x)); catalogResults = [...byId.values()]; }
      let style = document.getElementById('shop-catalog-css');
      if (!style) { style = document.createElement('style'); style.id = 'shop-catalog-css'; document.head.appendChild(style); }
      style.textContent = cat.css || '';
    }
    shell('/shop', `<div class="narrow wide ec">
      <div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>Points Shop</h1><a class="ec-how small" href="/shop/how-it-works">${icon('circle-help')} How it works</a></div>
      ${r.signed_in ? `<div class="card pad shop-bal"><div class="sb-ic">${icon('coins')}</div><div><div class="tiny muted orb">HUB POINTS</div><b class="sb-n" id="pts-bal">${fmt(bal)}</b><div class="tiny muted">${fmt(r.earned)} earned all-time${r.perks && r.perks.discount ? ` • ${r.perks.discount}% season discount` : ''}</div></div><a class="btn sm ghost" href="#earn">How to earn</a></div>`
        : `<div class="card pad shop-bal"><div class="sb-ic">${icon('coins')}</div><div><b>Earn Hub Points by playing</b><div class="tiny muted">Every run, quest, streak and season level pays points.</div></div><a class="btn sm" href="/signup?next=/shop">Sign up free</a></div>`}
      <div class="nocash">${icon('shield')} <span><b>Cosmetic only.</b> ${esc(r.disclaimer)}</span></div>
      ${ev.map(e => `<div class="ec-event card"><div class="ec-ev-h">${icon(e.icon || 'party-popper')}<div><b>${esc(e.name)}</b><div class="tiny muted">Event items for ${cdi(e.ends_at)} • ends ${localAt(e.ends_at)}</div></div></div>${grid('shop-event-' + esc(e.key), e.items, bal)}</div>`).join('')}
      <div class="section-h"><h2>${icon('sparkles')} Weekly featured</h2><span class="small muted">New in ${cdi(r.weekly_ends)} <span class="ec-at">(${localAt(r.weekly_ends)})</span></span></div>
      ${grid('shop-weekly', r.weekly, bal)}
      <div class="section-h"><h2>${icon('flame')} Weekly cosmetic spotlight</h2><span class="small muted">20 featured from the 1,000+ collection · rotates Monday</span></div>
      ${grid('shop-catalog-weekly-spotlight', r.spotlight_weekly || [], bal)}
      <div class="section-h"><h2>${icon('clock')} Daily picks</h2><span class="small muted">New in ${cdi(r.daily_ends)} <span class="ec-at">(${localAt(r.daily_ends, { hour: 'numeric', minute: '2-digit' })} your time)</span></span></div>
      ${grid('shop-daily', r.daily, bal)}
      <div class="section-h"><h2>${icon('zap')} Daily cosmetic spotlight</h2><span class="small muted">12 more items from the collection · rotates at midnight ET</span></div>
      ${grid('shop-catalog-daily-spotlight', r.spotlight_daily || [], bal)}
      <div class="section-h"><h2>${icon('calendar-range')} Season ${r.season.number} shop: ${esc(r.season.name)}</h2><span class="small muted">Leaves in ${cdi(r.season_ends)}</span></div>
      ${grid('shop-season', r.season.items, bal)}
      ${r.peek ? `<div class="section-h"><h2>${icon('eye')} Tomorrow's daily picks</h2><span class="small muted">Season perk: early peek</span></div><div class="ec-peek">${r.peek.map(i => `<button class="ec-peek-i" data-item="${esc(i.id)}">${preview(i, 'sm')}<span>${esc(i.name)}</span></button>`).join('')}</div>` : ''}
      ${r.vault_radar ? `<div class="section-h"><h2>${icon('history')} Vault radar</h2><span class="small muted">Season perk</span></div>${r.vault_radar.length ? `<div class="card pad ec-radar">${r.vault_radar.map(v => `<div class="mini-row" data-item="${esc(v.item.id)}"><b>${esc(v.item.name)}</b><span class="small muted">${dateOf(v.at)}</span></div>`).join('')}</div>` : `<p class="small muted">No Vault returns in the next 7 days.</p>`}` : ''}
      <section class="shop-catalog-section" id="catalogue">
        <div class="section-h"><h2>${icon('shopping-bag')} Full Cosmetic Catalogue</h2><span class="small muted">${cat.ok ? fmt(cat.total) + ' items' : '1,000+ items'}</span></div>
        <p class="small muted">Browse 1,000+ original cosmetics plus daily and weekly spotlights: banners, frames, nameplates, titles, badges and animated profile effects. All items are cosmetic only—no score, XP leaderboard or giveaway advantage.</p>
        <form class="catalog-filter card pad" id="catalog-filter">
          <label for="catalog-search">Search cosmetics</label><input id="catalog-search" name="q" type="search" maxlength="80" value="${esc(catalogQuery)}" placeholder="Search names, styles, colors…">
          <label for="catalog-type">Category</label><select id="catalog-type" name="type">
            <option value="" ${!catalogType ? 'selected' : ''}>All cosmetics</option><option value="banner" ${catalogType === 'banner' ? 'selected' : ''}>Banners</option>
            <option value="frame" ${catalogType === 'frame' ? 'selected' : ''}>Avatar frames</option><option value="color" ${catalogType === 'color' ? 'selected' : ''}>Nameplates &amp; colors</option>
            <option value="title" ${catalogType === 'title' ? 'selected' : ''}>Titles</option><option value="badge" ${catalogType === 'badge' ? 'selected' : ''}>Badges &amp; accessories</option>
            <option value="effect" ${catalogType === 'effect' ? 'selected' : ''}>Animated effects</option>
          </select><button class="btn sm" type="submit">${icon('search')} Search</button><button class="btn sm ghost" type="button" id="catalog-clear">Clear</button>
        </form>
        <p class="tiny muted" id="catalog-count">${cat.ok ? 'Showing ' + fmt(catalogResults.length) + ' of ' + fmt(cat.total) + ' items' : 'Catalogue temporarily unavailable.'}</p>
        ${catalogResults.length ? grid('shop-catalog', catalogResults, bal) : '<div class="card pad">No cosmetics match this search. Try another name or category.</div>'}
        ${cat.ok && cat.has_more ? '<div class="catalog-more"><button class="btn" id="catalog-more">' + icon('chevrons-down') + ' Load more cosmetics</button></div>' : ''}
      </section>
      <div class="section-h" id="earned"><h2>${icon('target')} Earned, not bought</h2><span class="small muted">Unlock by score or weekly rank</span></div>
      <div class="ec-earned">${r.earned_items.map(i => { const pct = i.need ? Math.min(100, Math.round((i.best || 0) / i.need * 100)) : 0;
        return `<div class="card ec-earn ${i.owned ? 'owned' : ''}" data-item="${esc(i.id)}" tabindex="0" role="button">${preview(i, 'sm')}<div class="ec-earn-b"><b>${esc(i.name)}</b><div class="tiny muted">${esc(i.requirement)}</div>
          ${i.owned ? `<span class="pill green">${icon('check')} Unlocked</span>` : i.need ? `<div class="xpbar"><i style="width:${pct}%"></i></div><div class="tiny muted">Your best: ${fmt(i.best || 0)} / ${fmt(i.need)}</div>` : `<div class="tiny muted">Checked every Monday</div>`}</div></div>`; }).join('')}</div>
      ${r.owned.length ? `<div class="section-h"><h2>${icon('package')} Your collection</h2><span class="small muted">${r.owned.length} items</span></div><div class="shop-owned">${r.owned.slice(0, 60).map(it => `<button class="chip" data-item="${esc(it.id)}">${esc(it.name)}</button>`).join('')}</div>` : ''}
      <div class="card pad" id="earn"><h2 style="font-size:1rem;margin-bottom:8px">${icon('trending-up')} How to earn Hub Points</h2>
        <ul class="earn-list"><li><b>+${r.earn.run}</b> per finished run (first ${r.earn.runDailyCap} runs each day)</li><li><b>+${r.earn.skill.good} / +${r.earn.skill.top1}</b> more for a strong / top-1% score in that game</li><li><b>+${r.earn.pb}</b> bonus for a new personal best</li>
        <li><b>+${r.earn.quest}</b> per daily quest claimed</li><li><b>+${r.earn.checkinPerDay}</b> per streak day on check-in (up to +${r.earn.checkinMax})</li><li><b>+40 to +140</b> per season level, +100 per Overdrive star (<a href="/season">season pass</a>)</li>
        <li><b>+${r.earn.ach.bronze} to +${r.earn.ach.legendary}</b> per achievement</li><li><b>+${r.earn.challenge}</b> per friend challenge won • <b>+${r.earn.referral}</b> when an invited friend plays</li></ul>
        <p class="tiny muted">Prices move with demand, scarcity and appearances, so there are no fixed price tiers. <a href="/shop/how-it-works">How prices and rotations work</a>. Points can't be bought and are never used for giveaway entries.</p></div>
    </div>`);
    C.tickInline && C.tickInline();
    document.querySelectorAll('main [data-item]').forEach(el => { const open = (e) => { e.preventDefault(); detailSheet(el.dataset.item, draw); }; el.addEventListener('click', open); el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }); });
    const filter = document.getElementById('catalog-filter');
    if (filter) filter.onsubmit = (e) => { e.preventDefault(); const fd = new FormData(filter); catalogQuery = String(fd.get('q') || '').trim(); catalogType = String(fd.get('type') || ''); catalogOffset = 0; catalogResults = []; draw(); };
    const clear = document.getElementById('catalog-clear');
    if (clear) clear.onclick = () => { catalogQuery = ''; catalogType = ''; catalogOffset = 0; catalogResults = []; draw(); };
    const more = document.getElementById('catalog-more');
    if (more) more.onclick = () => { catalogOffset += 24; draw(); };

  };
  await draw();
}

// ---------- /season ----------
async function seasonPage() {
  const { shell, api, icon, esc, fmt } = C;
  const [r, all] = await Promise.all([api('/api/season'), api('/api/seasons')]); const s = r.season;
  const lvl = s.level || 0; const pct = s.need ? Math.round(s.into / s.need * 100) : 100;
  const rewardChip = (t) => t.item ? `<span class="tr ec-tr" data-item="${esc(t.item.id)}">${icon(TYPE_IC[t.item.type])}<em>${esc(t.item.name)}</em></span>` : `<span class="tr dim">${icon('coins')}<em>${fmt(t.points)} pts</em></span>`;
  shell('/season', `<div class="narrow wide ec">
    <div class="season-hero card ec-sh"><div class="sh-bg bn-${esc((s.track.find(t => t.item && t.item.type === 'banner') || {}).item?.id || 'season-one')}"></div>
      <div class="sh-in"><div class="tiny orb" style="color:var(--gold)">SEASON ${s.number}</div><h1>${esc(s.name)}</h1>
        <p class="small">${dateOf(s.start_at)} - ${dateOf(s.end_at)} • ends in ${cdi(s.end_at + 1)} (${localAt(s.end_at + 1)})</p>
        ${r.signed_in ? `<div class="sh-tier"><b>Level ${lvl}</b><span>/ ${s.levels}</span>${s.overdrive ? `<span class="pill">${icon('star')} Overdrive x${s.overdrive}</span>` : ''}</div><div class="xpbar lg"><i style="width:${pct}%"></i></div>
          <div class="tiny">${fmt(s.xp)} season XP${s.head_start ? ` (incl. ${fmt(s.head_start)} head start)` : ''} • ${fmt(s.need - s.into)} XP to ${lvl >= s.levels ? 'the next Overdrive star' : 'level ' + (lvl + 1)}</div>`
          : `<a class="btn sm" href="/signup?next=/season">Sign up to start earning</a>`}
      </div></div>
    <div class="nocash">${icon('shield')} <span><b>Free track for everyone.</b> All players earn raw season XP at the same rate and share the same public leaderboard. An optional pass adds a 10% boost only to premium cosmetic-track unlocks; it never changes game score or giveaway results.</span></div>
    <div class="section-h"><h2>${icon('zap')} Season perks</h2><a class="small" href="/shop/how-it-works#seasons">How seasons work</a></div>
    <div class="ec-perks">${s.perks.map(p => `<div class="card ec-perk ${p.active ? 'on' : ''}"><span class="ec-pl">Lv ${p.level}</span><b>${esc(p.name)}</b><span class="tiny muted">${esc(p.desc)}</span>${p.active ? `<span class="pill green">${icon('check')} Active</span>` : ''}</div>`).join('')}</div>
    <div class="section-h"><h2>${icon('list-checks')} Reward track</h2><span class="small muted">${s.levels} levels • ${fmt(s.max_xp)} XP</span></div>
    <div class="track ec-track" role="list">${s.track.map(t => `<div class="tier ${t.unlocked ? 'on' : ''} ${t.item ? 'rw' : ''} ${t.level === lvl + 1 ? 'next' : ''}" role="listitem"><span class="tn">${t.level}</span>${rewardChip(t)}${t.perk ? `<span class="ec-perk-mini">${icon('zap')}${esc(t.perk.name)}</span>` : ''}</div>`).join('')}
      <div class="tier ec-od"><span class="tn">${icon('star')}</span><span class="tr"><em>Overdrive: +100 pts every 2,000 XP</em></span></div></div>
    <div class="season-grid">
      <div class="card pad"><h2 style="margin-bottom:8px">How to earn season XP</h2>
        <ul class="ttb-list"><li>${icon('gamepad-2')} Finish any run: +10 XP, +10 per score tier reached</li><li>${icon('scroll-text')} Claim daily quests: +40-120 XP, +100 bonus</li><li>${icon('flame')} Daily check-in: +20-50 XP</li><li>${icon('medal')} Unlock achievements: +25-400 XP</li></ul>
        <div class="btn-row"><a class="btn sm" href="/quests">Daily quests</a><a class="btn sm ghost" href="/games">Play</a></div></div>
      <div class="card"><div class="panel-h"><h2>${icon('trophy')} Season leaderboard</h2></div>
        ${r.board.length ? `<table class="lb"><tbody>${r.board.slice(0, 15).map(x => `<tr class="${C.S.me && x.username === C.S.me.username ? 'me' : ''}"><td class="rk">${x.rank}</td><td>${C.whoHTML(x)}</td><td class="sc">${fmt(x.score)} XP<div class="tiny muted">Level ${x.tier}</div></td></tr>`).join('')}</tbody></table>` : C.emptyState('trophy', 'No season XP yet', 'Play a run to get on the board.')}</div>
    </div>
    <div class="section-h"><h2>${icon('crown')} Hall of fame</h2></div>
    ${all.ok && all.hall_of_fame.length ? `<div class="ec-hof">${all.hall_of_fame.map(h => `<div class="card pad"><b>Season ${h.number}: ${esc(h.name)}</b><div class="tiny muted">${dateOf(h.start_at)} - ${dateOf(h.end_at)} • ${fmt(h.players)} players</div><ol class="ec-hof-l">${h.top.slice(0, 10).map(x => `<li><a href="/u/${encodeURIComponent(x.username)}">${esc(x.username)}</a> <span class="tiny muted">Lv ${x.level} • ${fmt(x.xp)} XP</span></li>`).join('')}</ol></div>`).join('')}</div>`
      : `<p class="small muted">The first hall of fame entry is written when Season ${s.number} ends on ${dateOf(s.end_at)}. The top 10 get a Top 10 title and #1 gets the Champion title.</p>`}
    ${all.ok && all.mine && all.mine.length ? `<div class="section-h"><h2>${icon('history')} Your past seasons</h2></div><div class="card pad">${all.mine.map(m => `<div class="mini-row"><b>S${m.number} ${esc(m.name)}</b><span class="small muted">Level ${m.level} • #${m.rank} of ${fmt(m.players || 0)}</span></div>`).join('')}</div>` : ''}
    ${all.ok ? `<p class="small muted center">Next: Season ${all.upcoming[0].number} "${esc(all.upcoming[0].name)}" starts ${dateOf(all.upcoming[0].start_at)}.</p>` : ''}
  </div>`);
  C.tickInline && C.tickInline();
  document.querySelectorAll('main [data-item]').forEach(el => el.addEventListener('click', () => detailSheet(el.dataset.item)));
}

// ---------- /shop/how-it-works ----------
async function howPage() {
  const { shell, api, icon, esc, fmt } = C;
  const [r, up] = await Promise.all([api('/api/shop/rules'), api('/api/shop/upcoming')]);
  if (!r.ok) return shell('/shop', C.emptyState('triangle-alert', 'Could not load', ''));
  const ex = Math.round(400 * 1.1); const exHi = Math.round(ex * 1.2 / 5) * 5, exLo = Math.round(ex * 0.9 / 5) * 5;
  shell('/shop', `<div class="narrow ec prose-ish">
    <div class="back-row"><button class="iconbtn" data-act="back">${icon('chevron-left')}</button><h1>How Seasons &amp; Shop work</h1></div>
    <div class="nocash">${icon('shield')} <span>${esc(r.disclaimer)}</span></div>
    <div class="card pad"><h2>${icon('clock')} When the shop changes</h2>
      <ul class="ec-list"><li><b>Daily picks</b>: every day at midnight hub time (US Eastern). The shop page shows each reset in your own time zone.</li><li><b>Weekly featured</b>: every Monday at midnight.</li><li><b>Season shop</b>: the whole 8-week season.</li><li><b>Events</b>: while the event runs (dates below).</li></ul>
      <p class="small muted">The shop is the same for everyone: it comes from a fixed schedule, not from what you look at.</p></div>
    <div class="card pad"><h2>${icon('shuffle')} What's in it</h2><ul class="ec-list">${r.rules.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <div class="card pad"><h2>${icon('coins')} How prices work, in plain words</h2>
      <p>Every item starts from its rarity (Common ${fmt(r.rarity.common.price)}, Rare ${fmt(r.rarity.rare.price)}, Epic ${fmt(r.rarity.epic.price)}, Legendary ${fmt(r.rarity.legendary.price)}) and its type (titles are cheaper, effects cost more). Then it moves:</p>
      <ul class="ec-list"><li><b>Demand</b>: bought a lot in the last 14 days? Up to 35% more. Nobody wants it? Up to 15% less.</li><li><b>Scarcity</b>: owned by under 1% of active players? About 10% more. Already owned by a quarter of players? 12% less.</li>
        <li><b>Appearances</b>: 8% more on its debut day, then cheaper the more often it comes back. Vault returns cost 25% more.</li><li><b>Limited</b>: season and event items cost 15% more.</li></ul>
      <p class="small muted">Example: a Rare frame starts at ${fmt(ex)}. Popular and rare to own, it might be ${fmt(exHi)}; on its fifth showing with low demand, about ${fmt(exLo)}. Prices are set at midnight and hold all day. Season perks take 5-15% off.</p></div>
    <div class="card pad" id="seasons"><h2>${icon('calendar-range')} Seasons</h2><ul class="ec-list">${r.seasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <h3 class="ec-h">Perks</h3><ul class="ec-list">${r.perks.map(p => `<li><b>Level ${p.level}: ${esc(p.name)}</b> - ${esc(p.desc)}</li>`).join('')}</ul>
      <p class="small">${up.ok ? `Now: Season ${up.season.number} "${esc(up.season.name)}", ends in ${cdi(up.season.ends_at)}.` : ''} <a href="/season">Open the season pass</a></p></div>
    <div class="card pad"><h2>${icon('party-popper')} Events</h2>${up.ok && up.events.length ? `<ul class="ec-list">${up.events.map(e => `<li><b>${esc(e.name)}</b>: ${e.live ? `on now, ends in ${cdi(e.ends_at)}` : `${dateOf(e.starts_at)} - ${dateOf(e.ends_at - 1)}`}</li>`).join('')}</ul>` : '<p class="small muted">No events scheduled.</p>'}
      <p class="small muted">Each event brings 4 themed items (2 return the next year). Admins can also run themed weekends with their own picks.</p></div>
    <div class="card pad"><h2>${icon('target')} Earned items</h2><p>Some items can't be bought. Score at a strong player's level in a game for its <b>Pro</b> banner, reach the top-1% score for its <b>Elite</b> frame (targets come from our score research), or finish top 3 / top 10 on any game's weekly leaderboard.</p><a class="btn sm" href="/shop#earned">See earned items</a></div>
  </div>`);
  C.tickInline && C.tickInline();
}

export function install(ctx) {
  C = ctx; const first = (re, fn) => ctx.routes.unshift([re, fn]);
  first(/^\/shop\/how-it-works$/, howPage);
  first(/^\/(seasons-and-shop|economy)$/, () => ctx.go('/shop/how-it-works', true));
  first(/^\/shop$/, shopPage);
  first(/^\/season$/, seasonPage);
}
export { preview, detailSheet };

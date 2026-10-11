// public/js/hub-store.js - v7 Phase 4: Hub Store (cosmetic only). Hub Crowns packs, Season Pass premium track + the 48-quest free-pass chain,
// Prestige showcase items with the global "owned by" wall, and the Bitcoin checkout (QR + exact amount + copy + txid).
// The server decides everything (prices, amounts, matching, grants); this file only shows it.
let C = null;
const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const FX_CLASS = { sparkle: 'px-sparkle', cashrain: 'px-cash', goldsweep: 'px-gold' };
const PX_ICON = { 'prestige-cane': 'wand-sparkles', 'prestige-throne': 'armchair', 'prestige-crown': 'crown' };
export function prestigeArt(id, fx, size = 120) { return `<div class="px-art ${FX_CLASS[fx] || ''}" style="--s:${size}px" aria-hidden="true"><span class="px-glow"></span>${C.icon(PX_ICON[id] || 'gem')}<i></i><i></i><i></i></div>`; }
async function storePage() {
  const { icon, esc, api, S } = C; const r = await api('/api/store'); if (!r.ok) return C.shell('/shop', C.emptyState('store', 'Store unavailable', 'Try again in a moment.'));
  const co = r.checkout; const pass = S.me ? await api('/api/pass') : null; let paymentProvider = (co.methods || []).includes('bitcoin') ? 'bitcoin' : 'stripe';
  const buy = (id, label) => co.enabled ? (S.me ? `<button class="btn sm" data-buy="${esc(id)}" data-provider="${paymentProvider}">${icon('wallet')} ${label}</button>` : `<a class="btn sm" href="/signin?next=/store">Sign in to buy</a>`) : `<button class="btn sm" disabled title="${esc(co.reason || '')}">${label}</button>`;
  C.shell('/shop', `<div class="narrow store">
    ${C.pageHead('Hub Store', 'Cosmetics only. Never a score, an entry or an edge.')}
    <div class="card pad na-note" id="non-advantage">${icon('shield-check')} <b>Cosmetic only.</b> ${esc(r.non_advantage)}</div>
    ${co.enabled ? '' : `<div class="card pad muted small" id="checkout-off">${icon('lock')} ${esc(co.reason || 'Checkout is not available right now.')}</div>`}
    ${co.enabled ? `<div class="card pad payment-methods"><b>Payment method</b><div class="btn-row" role="group" aria-label="Payment method">${(co.methods || []).map(method => `<button type="button" class="btn sm ${method === paymentProvider ? 'on' : ''}" data-provider-choice="${method}" aria-pressed="${method === paymentProvider}">${method === 'bitcoin' ? icon('bitcoin') + ' Bitcoin (crypto)' : icon('credit-card') + ' Credit / debit card'}</button>`).join('')}</div><p class="tiny muted">Card details are handled by Stripe-hosted checkout. Bitcoin is paid directly to the configured receiving address.</p></div>` : ''}
    ${S.me ? `<p class="small">Your balance: <b id="crowns-bal">${C.fmt(r.crowns || 0)} Hub Crowns</b> <a href="/shop">Spend in the shop</a></p>` : ''}
    <div class="section-h"><h2>${icon('coins')} Hub Crowns</h2><span class="small muted">Spend on cosmetics and avatar items only</span></div>
    <div class="store-grid">${r.packs.map(p => `<div class="card pad st-pack"><b>${C.fmt(p.crowns + p.bonus)}</b><span class="small muted">Hub Crowns${p.bonus ? ` (incl. ${C.fmt(p.bonus)} bonus)` : ''}</span><div class="st-price">${usd(p.usd_cents)}</div>${buy(p.id, 'Buy')}</div>`).join('')}</div>
    ${r.pass ? `<div class="section-h"><h2>${icon('ticket')} Season Pass</h2></div><div class="card pad" id="pass-card"><p style="margin-top:0"><b>${esc(r.pass.name)}</b> - ${usd(r.pass.usd_cents)}. A premium track of 20 extra cosmetic rewards and ${C.fmt(r.pass.bonus_crowns_total || 600)} bonus Crowns, plus a ${r.pass.xp_boost_pct}% boost that only speeds up the premium track (never scores, boards or giveaways).</p>
      ${pass && pass.owned ? `<p class="ok-msg">You own this season's pass. Premium level ${pass.premium_level}. <button class="btn sm" id="pass-claim">Claim unlocked rewards</button></p>` : buy('season-pass', `Get the pass ${usd(r.pass.usd_cents)}`)}
      ${pass && pass.next_free ? `<details class="pq" id="pass-quests"><summary>${icon('flame')} Earn next season's pass free: ${pass.next_free.done}/${pass.next_free.total} quests</summary><p class="small muted">Very hard on purpose: about ${Math.round(pass.next_free.est_completion * 100)}% of active players finish all 48.</p><ol class="pq-list">${pass.next_free.quests.map(q => `<li class="${q.done ? 'done' : ''}"><b>${esc(q.title)}</b> <span class="small muted">${esc(q.desc)} (${C.fmt(q.progress)}/${C.fmt(q.target)})</span></li>`).join('')}</ol>${pass.next_free.complete && !pass.next_free.granted ? '<button class="btn sm" id="pq-claim">Claim next season\'s pass</button>' : ''}</details>` : ''}</div>` : ''}
    <div class="section-h"><h2>${icon('gem')} Prestige</h2><a class="small" href="/prestige">Owned-by wall</a></div>
    <div class="store-grid px-grid">${r.prestige.map(p => `<div class="card pad px-card">${prestigeArt(p.id, p.fx)}<b>${esc(p.name)}</b><p class="small muted">${esc(p.blurb)}</p><div class="small">Numbered: ${p.issued} of ${p.supply} issued</div><div class="st-price">${usd(p.usd_cents)}</div>${p.issued >= p.supply ? '<span class="pill">Sold out</span>' : buy(p.id, 'Buy')}</div>`).join('')}</div>
    <details class="card pad small muted" style="margin-top:14px"><summary>Terms (draft)</summary><p>${esc(r.terms)}</p></details>
  </div>`, { title: 'Hub Store' });
  document.querySelectorAll('[data-provider-choice]').forEach(b => b.onclick = () => { paymentProvider = b.dataset.providerChoice; document.querySelectorAll('[data-provider-choice]').forEach(x => { const on = x.dataset.providerChoice === paymentProvider; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); }); document.querySelectorAll('[data-buy]').forEach(x => x.dataset.provider = paymentProvider); });
  document.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => { b.disabled = true; const x = await api('/api/store/orders', { method: 'POST', body: { product_id: b.dataset.buy, provider: b.dataset.provider } }); b.disabled = false; if (!x.ok) return C.toast(x.error); if (x.order.checkout_url) { window.location.assign(x.order.checkout_url); return; } C.go('/store/order/' + x.order.ref); });
  const pc = document.getElementById('pass-claim'); if (pc) pc.onclick = async () => { const x = await api('/api/pass/claim', { method: 'POST', body: {} }); C.toast(x.ok ? `Claimed ${x.claimed.length} reward${x.claimed.length === 1 ? '' : 's'}` : x.error); };
  const qc = document.getElementById('pq-claim'); if (qc) qc.onclick = async () => { const x = await api('/api/pass/quests/claim', { method: 'POST', body: {} }); C.toast(x.ok ? `Season ${x.season} pass unlocked!` : x.error); storePage(); };
}
const ST = { pending: 'Waiting for your payment', failed: 'Payment could not be completed', seen: 'Payment seen, waiting for a confirmation', confirming: 'Confirming on the blockchain', paid: 'Paid', granted: 'Delivered to your account', underpaid: 'Underpaid: we contacted the admin', expired: 'Quote expired', refunded: 'Refunded', sold_out_refund: 'Sold out: refund pending' };
async function orderPage(m) {
  const { icon, esc, api } = C; let poll = null;
  const draw = async (o) => {
    const left = Math.max(0, o.expires_at - Date.now()); const open = ['pending', 'seen', 'confirming'].includes(o.status);
    C.shell('/shop', `<div class="narrow order" id="order">
      ${C.pageHead('Checkout', esc(o.product.name) + ' - ' + usd(o.usd_cents))}
      <div class="card pad"><div class="ord-st st-${esc(o.status)}" id="ord-status">${icon(o.status === 'granted' ? 'circle-check' : open ? 'clock' : 'circle-alert')} <b>${esc(ST[o.status] || o.status)}</b>${o.confs ? ` <span class="small muted">(${o.confs}/${o.need_confs} confirmations)</span>` : ''}</div>
      ${o.status === 'pending' && o.provider === 'stripe' ? `<p>Payment is processed on Stripe's secure hosted checkout. If you have not completed payment, continue below.</p><a class="btn" href="${esc(o.checkout_url || '')}">${icon('credit-card')} Continue to secure card checkout</a>` : ''}
      ${o.status === 'pending' && o.provider !== 'stripe' ? `<p>Send <b>exactly</b> this amount of Bitcoin to this address. The exact amount is how we recognise your payment, so do not round it.</p>
        <div class="ord-qr">${o.qr_svg || ''}</div>
        <div class="field"><div class="lbl">Amount (BTC)</div><div class="copyrow"><code id="ord-amt">${esc(o.btc)}</code><button class="btn sm ghost" data-copy="${esc(o.btc)}">${icon('copy')} Copy</button></div></div>
        <div class="field"><div class="lbl">Address</div><div class="copyrow"><code id="ord-addr">${esc(o.address)}</code><button class="btn sm ghost" data-copy="${esc(o.address)}">${icon('copy')} Copy</button></div></div>
        <p class="small muted">Quote valid for <b id="ord-left">${Math.ceil(left / 60000)} min</b>. Small orders are delivered after 1 confirmation, larger ones after 3, Prestige after 6.</p>
        <a class="btn" href="${esc(o.uri)}">${icon('wallet')} Open in my wallet</a>` : ''}
      ${open ? `<details class="small" style="margin-top:12px"><summary>Already paid? Paste your transaction id to speed things up</summary><div class="copyrow"><input class="input" id="txid" placeholder="64-character transaction id" maxlength="64" autocapitalize="none"><button class="btn sm" id="txid-go">Check</button></div></details>` : ''}
      ${o.txid ? `<p class="small muted">Transaction: <code>${esc(o.txid)}</code></p>` : ''}
      ${o.flags.includes('overpaid') ? '<p class="small">You sent more than the quote. The admin will refund the difference.</p>' : ''}
      ${o.status === 'granted' ? `<a class="btn" href="/store">${icon('store')} Back to the store</a>` : ''}
      <p class="tiny muted">Order ${esc(o.ref)}. ${o.provider === 'stripe' ? 'Card details are entered on Stripe-hosted checkout; the Hub never stores card numbers.' : 'Bitcoin is sent to the configured receiving wallet; the Hub never holds private keys.'}</p></div></div>`, { title: 'Checkout' });
    document.querySelectorAll('[data-copy]').forEach(b => b.onclick = () => { navigator.clipboard && navigator.clipboard.writeText(b.dataset.copy); C.toast('Copied'); });
    const tg = document.getElementById('txid-go'); if (tg) tg.onclick = async () => { const x = await api(`/api/store/orders/${o.ref}/check`, { method: 'POST', body: { txid: document.getElementById('txid').value.trim() } }); if (!x.ok) return C.toast(x.error); draw(x.order); };
  };
  const r = await api('/api/store/orders/' + encodeURIComponent(m[1])); if (!r.ok) return C.shell('/shop', C.emptyState('file-text', 'Order not found', ''));
  await draw(r.order);
  poll = setInterval(async () => { if (!document.getElementById('order')) return clearInterval(poll); const x = await api(`/api/store/orders/${m[1]}/check`, { method: 'POST', body: {} }); if (x.ok && x.order.status !== r.order.status) { r.order = x.order; draw(x.order); } if (x.ok && !['pending', 'seen', 'confirming'].includes(x.order.status)) clearInterval(poll); }, 30000);
}
async function prestigeWall() {
  const { esc } = C; const r = await C.api('/api/store/prestige');
  C.shell('/shop', `<div class="narrow">${C.pageHead('Prestige: owned by', 'Every numbered Prestige item and who holds it.')}
    ${(r.items || []).map(p => `<div class="card pad px-wall">${prestigeArt(p.id, p.fx, 90)}<div><b>${esc(p.name)}</b> <span class="small muted">${p.issued}/${p.supply}</span>
      <ol class="px-owners">${p.owners.map(o => `<li><b>#${o.serial}</b> <a href="/u/${encodeURIComponent(o.username)}">${esc(o.username)}</a></li>`).join('') || '<li class="muted small">Unclaimed</li>'}</ol></div></div>`).join('')}</div>`, { title: 'Prestige' });
}
export function install(ctx) { C = ctx; ctx.route(/^\/store$/, storePage); ctx.route(/^\/store\/order\/([A-Z0-9]{8,20})$/, orderPage); ctx.route(/^\/prestige$/, prestigeWall); }

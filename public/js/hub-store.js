// public/js/hub-store.js - Hub Store (cosmetic only). One Hub Credits balance, optional credit packs, Season Pass premium track + the 48-quest free-pass chain,
// Prestige showcase items with the global "owned by" wall, and the Bitcoin checkout (QR + exact amount + copy + txid).
// The server decides everything (prices, amounts, matching, grants); this file only shows it.
let C = null;
const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
const FX_CLASS = {
  sparkle: 'px-sparkle', cashrain: 'px-cash', goldsweep: 'px-gold',
  'prism-cane': 'px-fx-prism', 'stack-throne': 'px-fx-stack', 'royal-crown': 'px-fx-royal',
  'phoenix-mantle': 'px-fx-phoenix', 'singularity-orbit': 'px-fx-singularity', 'void-dragon': 'px-fx-void',
  'nebula-wings': 'px-fx-nebula', 'titan-exoframe': 'px-fx-titan', 'holo-decree': 'px-fx-holo',
  'storm-halo': 'px-fx-storm', 'chronos-mantle': 'px-fx-chronos', 'aurora-crown': 'px-fx-aurora'
};
const PX_ART = {
  'prestige-original-cane': 'px-art-prism-cane',
  'prestige-original-throne': 'px-art-stack-throne',
  'prestige-original-crown': 'px-art-royal-crown',
  'prestige-original-phoenix': 'px-art-phoenix-mantle',
  'prestige-original-singularity': 'px-art-singularity',
  'prestige-original-dragon': 'px-art-void-dragon',
  'prestige-original-nebula': 'px-art-nebula-wings',
  'prestige-original-mech': 'px-art-titan-exoframe',
  'prestige-original-holo': 'px-art-holo-decree',
  'prestige-original-storm': 'px-art-storm-halo',
  'prestige-original-chronos': 'px-art-chronos-mantle',
  'prestige-original-aurora': 'px-art-aurora-crown',
  'prestige-cane': 'px-art-prism-cane', 'prestige-throne': 'px-art-stack-throne', 'prestige-crown': 'px-art-royal-crown'
};
const PX_ICON = {
  'prestige-original-cane': 'gem', 'prestige-original-throne': 'armchair', 'prestige-original-crown': 'crown',
  'prestige-original-phoenix': 'flame', 'prestige-original-singularity': 'orbit', 'prestige-original-dragon': 'swords',
  'prestige-original-nebula': 'wind', 'prestige-original-mech': 'shield', 'prestige-original-holo': 'scroll-text',
  'prestige-original-storm': 'zap', 'prestige-original-chronos': 'clock', 'prestige-original-aurora': 'sunrise',
  'prestige-cane': 'wand-sparkles', 'prestige-throne': 'armchair', 'prestige-crown': 'crown'
};
const PX_ASSET = {
  'prestige-original-cane': 'cane', 'prestige-original-throne': 'throne', 'prestige-original-crown': 'crown',
  'prestige-original-phoenix': 'phoenix', 'prestige-original-singularity': 'singularity', 'prestige-original-dragon': 'dragon',
  'prestige-original-nebula': 'nebula', 'prestige-original-mech': 'mech', 'prestige-original-holo': 'holo',
  'prestige-original-storm': 'storm', 'prestige-original-chronos': 'chronos', 'prestige-original-aurora': 'aurora',
  'prestige-cane': 'cane', 'prestige-throne': 'throne', 'prestige-crown': 'crown'
};
export function prestigeArt(id, fx, size = 120) {
  const art = PX_ART[id] || 'px-art-generic';
  const effect = FX_CLASS[fx] || '';
  const asset = PX_ASSET[id];
  const illustration = asset ? `<img class="px-artwork" src="/assets/prestige/${asset}.svg" alt="" loading="lazy" decoding="async">` : C.icon(PX_ICON[id] || 'gem');
  return `<div class="px-art ${art} ${effect}" style="--s:${size}px" aria-hidden="true"><span class="px-glow"></span>${illustration}<i></i><i></i><i></i></div>`;
}
async function storePage() {
  const { icon, esc, api, S } = C; const r = await api('/api/store'); if (!r.ok) return C.shell('/shop', C.emptyState('store', 'Store unavailable', 'Try again in a moment.'));
  const co = r.checkout; const pass = S.me ? await api('/api/pass') : null; let paymentProvider = (co.methods || []).includes('bitcoin') ? 'bitcoin' : 'stripe';
  const buy = (id, label) => {
    if (id.startsWith('prestige-original-') && !r.prestige_sales_enabled) return `<button class="btn sm" disabled title="Wearable variations and compatibility review are not approved yet.">Preview only</button>`;
    return co.enabled ? (S.me ? `<button class="btn sm" data-buy="${esc(id)}" data-provider="${paymentProvider}">${icon('wallet')} ${label}</button>` : `<a class="btn sm" href="/signin?next=/store">Sign in to buy</a>`) : `<button class="btn sm" disabled title="${esc(co.reason || '')}">${label}</button>`;
  };
  C.shell('/shop', `<div class="narrow store">
    ${C.pageHead('Hub Store', 'Cosmetics only. Never a score, an entry or an edge.')}
    <div class="card pad"><b>One wallet, two customization areas</b><p class="small muted">Hub Credits can unlock rotating profile designs or avatar clothing and accessories. Profile artwork is not automatically a wearable 3D model.</p><div class="btn-row"><a class="btn sm" href="/shop">${icon('palette')} Profile cosmetics</a><a class="btn sm ghost" href="/avatar">${icon('user-round')} Avatar wardrobe</a></div></div>
    <div class="card pad na-note" id="non-advantage">${icon('shield-check')} <b>Cosmetic only.</b> ${esc(r.non_advantage)}</div>
    ${co.enabled ? '' : `<div class="card pad muted small" id="checkout-off">${icon('lock')} ${esc(co.reason || 'Checkout is not available right now.')}</div>`}
    ${co.enabled ? `<div class="card pad payment-methods"><b>Payment method</b><div class="btn-row" role="group" aria-label="Payment method">${(co.methods || []).map(method => `<button type="button" class="btn sm ${method === paymentProvider ? 'on' : ''}" data-provider-choice="${method}" aria-pressed="${method === paymentProvider}">${method === 'bitcoin' ? icon('bitcoin') + ' Bitcoin (crypto)' : icon('credit-card') + ' Credit / debit card'}</button>`).join('')}</div><p class="tiny muted">Card details are handled by Stripe-hosted checkout. Bitcoin is paid directly to the configured receiving address.</p></div>` : ''}
    ${S.me ? `<div class="card pad shop-bal store-wallet" aria-label="Your Hub Credits wallet"><div class="sb-ic">${icon('wallet')}</div><div><div class="tiny muted orb">ONE COSMETIC WALLET</div><b class="sb-n" id="credits-bal">${C.fmt(r.credits || 0)} Hub Credits</b><p class="tiny muted">Earn by playing or optionally buy. Same balance, same cosmetics, no gameplay advantage.</p></div><a class="btn sm ghost" href="/shop">Spend Credits</a></div>` : ''}
    <div class="section-h"><h2>${icon('coins')} Hub Credits</h2><span class="small muted">Earn by playing or buy optional Credits. One balance, cosmetics only.</span></div>
    <div class="store-grid">${r.packs.map(p => `<div class="card pad st-pack"><b>${C.fmt(p.credits)}</b><span class="small muted">Hub Credits</span><div class="st-price">${usd(p.usd_cents)}</div>${buy(p.id, 'Buy')}</div>`).join('')}</div>
    ${r.pass ? `<div class="section-h"><h2>${icon('ticket')} Season Pass</h2></div><div class="card pad" id="pass-card"><p style="margin-top:0"><b>${esc(r.pass.name)}</b> - ${usd(r.pass.usd_cents)}. A premium track of 20 extra cosmetic rewards and ${C.fmt((r.pass.bonus_crowns_total || 600)*10)} bonus Hub Credits, plus a ${r.pass.xp_boost_pct}% boost that only speeds up the premium track (never scores, boards or giveaways).</p>
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
      ${open && o.provider !== 'stripe' ? `<details class="small" style="margin-top:12px"><summary>Already paid? Paste your transaction id to speed things up</summary><div class="copyrow"><input class="input" id="txid" placeholder="64-character transaction id" maxlength="64" autocapitalize="none"><button class="btn sm" id="txid-go">Check</button></div></details>` : ''}
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

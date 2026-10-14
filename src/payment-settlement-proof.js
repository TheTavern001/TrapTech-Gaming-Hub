'use strict';
// Pure settlement guard shared by every financial grant path. Provider API
// verification occurs BEFORE writing store_orders.status='paid' (Stripe signed
// webhook or BTC on-chain confirmation); this independently checks that the
// stored immutable order fields still justify fulfillment. Never infer
// settlement from an admin button or from browser-supplied status.
function verifiedSettlement(order) {
  if (!order || order.refunded_at || order.status!=='paid') return false;
  if (order.provider==='manual') {
    // Manually gifted products are visibly distinct zero-dollar audited orders.
    return order.usd_cents===0 && typeof order.ref==='string' &&
      /^M[0-9A-F]{12}$/.test(order.ref) &&
      typeof order.note==='string' && order.note.startsWith('manual grant by ');
  }
  if (!Number.isSafeInteger(order.paid_at)||order.paid_at<=0) return false;
  if (!Number.isSafeInteger(order.usd_cents)||order.usd_cents<99) return false;
  if (order.provider==='bitcoin') {
    return /^[0-9a-f]{64}$/i.test(String(order.txid||'')) &&
      Number.isSafeInteger(order.sats) && order.sats>0 &&
      Number.isSafeInteger(order.received_sats) && order.received_sats>=order.sats &&
      Number.isSafeInteger(order.need_confs) && order.need_confs>=1 &&
      Number.isSafeInteger(order.confs) && order.confs>=order.need_confs &&
      typeof order.address==='string' && order.address.length>=26;
  }
  if (order.provider==='stripe') {
    return /^cs_(?:test|live)_/.test(String(order.provider_ref||'')) &&
      /^pi_/.test(String(order.provider_payment_id||''));
  }
  return false;
}
module.exports={verifiedSettlement};

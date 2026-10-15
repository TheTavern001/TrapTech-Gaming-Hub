'use strict';
// Fail-closed booking-fee contract: a zero-dollar quote is NOT a paid booking.
// Provider-side settlement remains a separate, required launch gate.
function positiveFee(q){
 return !!q && Number.isSafeInteger(q.total_cents) && q.total_cents>0;
}
function paidFeeRecorded(q){
 return positiveFee(q) && q.status==='paid' &&
   Number.isSafeInteger(q.paid_at) && q.paid_at>0;
}
module.exports={positiveFee,paidFeeRecorded};

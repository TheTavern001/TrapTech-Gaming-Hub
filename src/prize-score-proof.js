'use strict';
// Fail-closed official-prize admission. Signed runs are not authoritative
// proof of gameplay. Per-title approval requires owner-reviewed server replay,
// adversarial abuse tests, normal-player acceptance and documented gameplay QA.
// 2026-10-13: ZERO GAMES HAVE THIS APPROVAL. Do not auto-certify via Docker.
const APPROVED=Object.freeze([]);
const certified=new Set(APPROVED);
const isCertified=id=>certified.has(String(id));
// A second barrier at winner-query time prevents manual unholding
// from making scores from unapproved games eligible.
function sqlCertified(alias='r'){
  if(APPROVED.length===0)return '(0=1)';
  const safePrefix=/^[a-z][a-z0-9_]*$/i.test(alias)?alias+'.':'';
  const values=APPROVED.map(id=>"'"+String(id).replaceAll("'","''")+"'").join(',');
  return '('+safePrefix+'game_id IN ('+values+'))';
}
const independentlyVerified=(id,verify)=>isCertified(id)&&verify==='replay-ok';
function admit(eventId,gameId,verdict){
  if(!eventId||!verdict||verdict.reject)return verdict;
  if(!verdict.held&&independentlyVerified(gameId,verdict.verify))return verdict;
  const flags=Array.isArray(verdict.flags)?[...verdict.flags]:[];
  if(!flags.some(x=>x.code==='prize_proof_missing'))
    flags.push({sev:2,code:'prize_proof_missing',
      text:'No approved independent gameplay replay: saved run cannot qualify for an official prize.'});
  return {...verdict,flags,held:1,prizeProofHeld:true};
}
module.exports={admit,isCertified,independentlyVerified,approvedGames:()=>[...APPROVED],sqlCertified};

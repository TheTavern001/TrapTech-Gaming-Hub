'use strict';
// New vendor-sponsored competitions are skill-based only. A time-trial may
// be offered later ONLY when a game's completed objective and elapsed time
// are replay-verified; ordinary survival runs must not be called a "win" by
// simply quitting fastest.
const MODES=Object.freeze({
  best:Object.freeze({scoreRule:'best',label:'Highest verified score',minimumGames:1,maximumGames:1,
    description:'The single highest replay-verified score in the selected game wins. Equal scores are separated by shortest server-measured run, then the game skill metric; an exact tie requires an equal-seed skill playoff.'}),
  total:Object.freeze({scoreRule:'sum_best',label:'Combined verified scores',minimumGames:2,maximumGames:13,
    description:'The sum of each player\'s highest replay-verified score in every selected game wins. Different game score scales must be approved and normalized before a combined competition is released. Equal totals use server-measured run times, then the skill metric, then an equal-seed playoff.'})
});
function validate(mode,ids){
  if(!Object.prototype.hasOwnProperty.call(MODES,mode)) return {ok:false,error:'Choose a skill-based scoring format. Random draws and subscriber-count goals are not supported for new bookings.'};
  if(!Array.isArray(ids)||ids.length<MODES[mode].minimumGames||ids.length>MODES[mode].maximumGames)
    return {ok:false,error:mode==='best'?'Choose exactly one game for highest verified score.':'Choose 2–13 games for a combined high-score event.'};
  if(new Set(ids).size!==ids.length)return {ok:false,error:'Games must not be repeated in the same competition.'};
  return {ok:true,mode,scoreRule:MODES[mode].scoreRule,label:MODES[mode].label,description:MODES[mode].description};
}
function publicRule(g){
  if(!g||!g.booking_id)return null;
  if(g.score_rule==='best')return MODES.best.description;
  if(g.score_rule==='sum_best')return MODES.total.description;
  return 'The official game scoring format must be approved before this event can become public.';
}
module.exports={MODES,validate,publicRule};

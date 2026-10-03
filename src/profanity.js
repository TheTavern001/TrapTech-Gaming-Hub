'use strict';
// Username filter: blocks slurs, hate terms and strong profanity, including l33t-speak and separator tricks
// (e.g. "f.u_c-k", "sh1t", "n1gg"). Cannabis-culture words (blazed, dank, kush, 420, terp...) are allowed.
// Lists are intentionally kept short and severe-first; extend SUBSTR/WORDS as needed.
const LEET = { '0': 'o', '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', '5': 's', '$': 's', '7': 't', '8': 'b', '9': 'g', '+': 't' };
// matched anywhere in the normalized name (severe; essentially never inside innocent words)
const SUBSTR = ['nigg', 'nigga', 'niger', 'faggot', 'fagot', 'kike', 'chink', 'spic', 'wetback', 'tranny', 'retard', 'beaner', 'gook', 'coon', 'raghead', 'towelhead', 'kyke',
  'fuck', 'fuk', 'fck', 'phuck', 'fvck', 'fvk', 'motherf', 'cunt', 'twat', 'whore', 'slut', 'bitch', 'shit', 'dick', 'cock', 'pussy', 'penis', 'vagina', 'porn', 'rape', 'rapist', 'pedo', 'molest', 'nazi', 'hitler', 'cum'];
// allowed words that contain a blocked substring (Scunthorpe problem)
const ALLOW = ['cocktail', 'peacock', 'hancock', 'scunthorpe', 'dickens', 'shitake', 'shiitake', 'cumin', 'cucumber', 'cumulus', 'circumstance', 'document', 'accumulate', 'spice', 'spicy', 'specs', 'raccoon', 'cocoon', 'tycoon', 'grape', 'drape', 'scrape', 'therapist', 'skunk', 'pedometer', 'pedal', 'speed', 'torpedo', 'escape', 'cockpit'];
// matched as the whole name or a whole token
const WORDS = ['fag', 'ass', 'arse', 'hoe', 'nig', 'jap', 'dyke', 'homo', 'tits', 'boob', 'boobs', 'anal', 'sex', 'jizz', 'wank', 'kkk', 'admin', 'moderator', 'staff', 'traptech', 'official'];

function norm(s) { return String(s || '').toLowerCase().split('').map(c => LEET[c] || c).join(''); }
function squash(s) { return norm(s).replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1'); }
function check(name) {
  const raw = String(name || '');
  const sq = squash(raw); const sq1 = sq.replace(/(.)\1+/g, '$1');
  let cleaned = sq; for (const a of ALLOW) cleaned = cleaned.split(a).join('');
  let cleaned1 = sq1; for (const a of ALLOW) cleaned1 = cleaned1.split(a.replace(/(.)\1+/g, '$1')).join('');
  for (const w of SUBSTR) { const c = w.replace(/(.)\1+/g, '$1'); if (cleaned.includes(w) || (c.length >= 4 && cleaned1.includes(c))) return { ok: false, reason: 'That username is not allowed. Please choose another.' }; }
  const tokens = norm(raw).split(/[^a-z]+/).filter(Boolean);
  for (const w of WORDS) if (sq === w || sq1 === w || tokens.includes(w)) return { ok: false, reason: ['admin', 'moderator', 'staff', 'traptech', 'official'].includes(w) ? 'Usernames can\'t look like staff or official accounts.' : 'That username is not allowed. Please choose another.' };
  return { ok: true };
}
module.exports = { check };

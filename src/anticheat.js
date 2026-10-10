'use strict';
// v5 anti-cheat: keep great legit scores, catch cheaters.
//  * Every run gets a server seed (run/start). Memory Match is fully replayed on the server from that seed + the tap log,
//    so its score is verified exactly ("replay-verified"). Other games are checked statistically.
//  * Only physically impossible results are rejected outright (more than 2x the game's per-second ceiling measured with
//    SERVER time). Everything else is accepted. Suspicious runs get soft flags in run_flags:
//      severity 1 = note for admins (run counts normally - a big legit jump never hides your score)
//      severity 2 = held: run is kept but hidden from boards/giveaways until an admin clears it (player is told why)
//  * Never auto-bans. Admins review /admin -> Fair play and clear (run counts) or confirm (run stays excluded).
const crypto = require('crypto');
const db = require('./db');
const cfg = require('./config');
const L = require('./ac-levels'); // v7 tiered levels L1-L4 (see docs/ANTI-CHEAT.md)

const newSeed = () => crypto.randomBytes(8).toString('hex');
// mulberry32 - identical in public/js/games/engine.js
function rng(seedHex) { let a = parseInt(String(seedHex).slice(0, 8) || '0', 16) >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, r) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }

// ---- Memory Match exact replay (mirrors public/js/games/memory-match.js) ----
const MM_LEVELS = [[4, 3], [4, 4], [5, 4], [6, 4], [6, 5]]; const MM_GLYPHS = 15;
function mmLevel(level, r) {
  const [c, rows] = MM_LEVELS[Math.min(level, MM_LEVELS.length - 1)]; const n = c * rows / 2;
  const pool = shuffle([...Array(MM_GLYPHS).keys()], r).slice(0, n); const ids = []; for (const i of pool) ids.push(i, i); return shuffle(ids, r);
}
// log: [[gameTimeMs, cardIndex], ...] where gameTimeMs = seconds of the in-game clock consumed (excludes memorize + clear pauses)
// v7 endless rules (mirror of public/js/games/memory-match.js): every board has its own clock of
// pairs x max(1.3, 4.2 x 0.95^board) seconds on the in-game clock; clear bonus = 10/s left + 50 x board number.
const boardTime = (level, pairs) => +(pairs * Math.max(1.3, 4.2 * Math.pow(0.95, level))).toFixed(2);
function replayMemory(seed, log) {
  const r = rng(seed); let level = 0; let cards = mmLevel(0, r); let done = new Set(); let sel = []; let score = 0, combo = 0, used = 0, clears = 0;
  let start = 0, limit = boardTime(0, cards.length / 2);
  for (const ev of log) {
    if (!Array.isArray(ev) || ev.length < 2) return { ok: false, why: 'bad event' };
    const [tm, k] = ev; if (!(tm >= used - 1)) return { ok: false, why: 'time went backwards' }; used = Math.max(used, tm);
    if (used / 1000 > start + limit + 0.75) return { ok: false, why: 'tap after the board clock ran out' };
    if (!Number.isInteger(k) || k < 0 || k >= cards.length || done.has(k) || sel.includes(k)) return { ok: false, why: 'invalid card' };
    sel.push(k);
    if (sel.length === 2) {
      const [a, b] = sel; sel = [];
      if (cards[a] === cards[b]) { done.add(a); done.add(b); combo = Math.min(5, combo + 1); score += 100 * combo;
        if (done.size === cards.length) { score += Math.round(Math.max(0, start + limit - used / 1000)) * 10 + 50 * (level + 1); clears++; level++; cards = mmLevel(level, r); done = new Set(); start = used / 1000; limit = boardTime(level, cards.length / 2); }
      } else combo = 0;
    }
  }
  return { ok: true, score, clears };
}

const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
// tel = { n: inputs, mean, sd, min } (inter-input intervals in ms, collected by the game engine)
function assess({ userId, game, score, elapsedS, durationMs, tel, seed, log, ev, recent = 0 }) {
  const ac = game.ac; const flags = []; let verify = '';
  // v7: rate limits, not fixed caps (endless games): ceiling = perSec*t + ramp*t^2/2 + grace, hard reject above 2x that
  const cap = cfg.capOf(ac, elapsedS);
  const hard = cfg.hardCapOf(ac, elapsedS);
  if (score > hard) return { reject: true, cap: hard }; // L1: obvious maximum for the run length
  const level = game.acLevel || 2;
  // L4: Stack is re-simulated on the server from the drop-time log (exact; any mismatch is a forged run)
  if (game.id === 'stack' && score > 0) {
    if (!Array.isArray(log) || !log.length) flags.push({ sev: 2, code: 'no_log', text: 'No drop log was sent with this Stack run (modified client?)' });
    else { const rp = L.replayStack(log, score, elapsedS); if (rp.ok) verify = 'replay-ok'; else if (!rp.retry) return { reject: true, why: `Replay rejected this run: ${rp.why}.` }; }
  }
  // L3: event log consistency (sum = score, legal values for the wave/row/multiplier, counts and timing)
  if (level >= 3) {
    const r = L.checkEvents(game.id, ev, score, elapsedS);
    if (r.missing) { if (score >= (game.tiers ? game.tiers[0] : 100)) flags.push({ sev: 2, code: 'no_events', text: 'No event log was sent with this run (old app version or modified client)' }); else if (score > 0) flags.push({ sev: 1, code: 'no_events', text: 'No event log (low score, kept)' }); }
    else if (!r.ok) return { reject: true, why: `Event log rejected: ${r.why}.` };
    else if (!verify) verify = 'events-ok';
  }
  if (score > cap) flags.push({ sev: 2, code: 'over_rate', text: `Score ${score} is above the normal per-second ceiling (${cap}) for ${elapsedS.toFixed(1)}s of play` });
  // exact replay
  if (game.id === 'memory-match' && seed && Array.isArray(log) && log.length) {
    const rp = replayMemory(seed, log.slice(0, 5000));
    if (!rp.ok) flags.push({ sev: 2, code: 'replay_fail', text: `Replay rejected the tap log: ${rp.why}` });
    else if (Math.abs(rp.score - score) > 10 * rp.clears + 10) flags.push({ sev: 2, code: 'replay_mismatch', text: `Replay scored ${rp.score} but the client sent ${score}` });
    else verify = 'replay-ok';
  } else if (game.id === 'memory-match' && score > 0) flags.push({ sev: 1, code: 'no_log', text: 'No tap log was sent with this run (old app version?)' });
  // input telemetry
  const needsInput = score >= (game.tiers ? game.tiers[0] : 100);
  if (tel && typeof tel === 'object') {
    const n = +tel.n || 0, mean = +tel.mean || 0, sd = +tel.sd || 0, mn = +tel.min || 0;
    if (needsInput && n === 0 && game.id !== 'spin-to-win') flags.push({ sev: 2, code: 'no_input', text: 'High score with zero recorded inputs' });
    if (n >= 40 && mean > 0 && sd / mean < 0.03) flags.push({ sev: 2, code: 'robotic_timing', text: `Input rhythm too perfect for a human (${n} inputs, spread ${(sd / mean * 100).toFixed(1)}%)` });
    else if (n >= 40 && mn > 0 && mn < 20) flags.push({ sev: 1, code: 'fast_inputs', text: `Inputs as close as ${mn}ms apart` });
  } else if (needsInput) flags.push({ sev: 1, code: 'no_telemetry', text: 'No input telemetry (old app version or modified client)' });
  // L2: suspicious submit frequency (many finished runs per minute = scripted client)
  if (recent >= 12) flags.push({ sev: 1, code: 'submit_burst', text: `${recent + 1} runs submitted within one minute` });
  if (durationMs > elapsedS * 1000 + 5000) flags.push({ sev: 1, code: 'clock_skew', text: 'Client clock ran faster than the server clock' });
  // history-aware: a big jump is only a NOTE (legit players improve), never a hold
  const prev = db.prepare('SELECT score FROM runs WHERE user_id=? AND game_id=? AND held=0 ORDER BY id DESC LIMIT 50').all(userId, game.id).map(r => r.score);
  const best = prev.length ? Math.max(...prev) : 0;
  if (prev.length >= 5 && score > Math.max(best * 4, median(prev) * 10) && score > (game.tiers ? game.tiers[1] : 0)) flags.push({ sev: 1, code: 'big_jump', text: `Score is ${(score / Math.max(1, best)).toFixed(1)}x the player's previous best (${best})` });
  const top = db.prepare('SELECT MAX(score) AS m, COUNT(DISTINCT user_id) AS n FROM runs WHERE game_id=? AND held=0').get(game.id);
  if (top.n >= 20 && score > top.m * 1.5 && flags.some(f => f.sev >= 1)) flags.push({ sev: 1, code: 'record_smash', text: `Beats the all-time #1 (${top.m}) by ${Math.round((score / top.m - 1) * 100)}%` });
  // escalate: two different notes together = hold for review
  const sev1 = flags.filter(f => f.sev === 1 && f.code !== 'no_telemetry' && f.code !== 'no_log').length;
  const held = flags.some(f => f.sev >= 2) || sev1 >= 2 ? 1 : 0;
  if (verify === 'replay-ok' && !flags.some(f => f.sev >= 2)) return { flags, held: 0, verify, cap };
  return { flags, held, verify, cap };
}
function record(runId, userId, gameId, score, res, t) {
  if (!res.flags.length) return;
  db.prepare('INSERT OR REPLACE INTO run_flags (run_id, user_id, game_id, score, reasons, severity, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(runId, userId, gameId, score, JSON.stringify(res.flags), res.held ? 2 : 1, res.held ? 'open' : 'note', t);
}
function review(runId, action, actor = 'admin', note = '') {
  const f = db.prepare('SELECT * FROM run_flags WHERE run_id=?').get(runId); if (!f) return { ok: false, error: 'No flag for that run.' };
  if (action === 'clear') { db.prepare("UPDATE runs SET held=0, verify='cleared' WHERE id=?").run(runId); db.prepare("UPDATE run_flags SET status='cleared', reviewed_by=?, reviewed_at=?, note=? WHERE run_id=?").run(actor, Date.now(), String(note).slice(0, 300), runId); }
  else if (action === 'confirm') { db.prepare('UPDATE runs SET held=2 WHERE id=?').run(runId); db.prepare("UPDATE run_flags SET status='confirmed', reviewed_by=?, reviewed_at=?, note=? WHERE run_id=?").run(actor, Date.now(), String(note).slice(0, 300), runId); }
  else return { ok: false, error: 'Unknown action.' };
  return { ok: true };
}
module.exports = { newSeed, rng, replayMemory, mmLevel, assess, record, review };

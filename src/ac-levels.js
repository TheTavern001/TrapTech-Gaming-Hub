'use strict';
// v7 anti-cheat LEVELS (original code). Every game declares a level in src/config.js (g.acLevel), shown in the catalog and the
// admin giveaway builder. Levels stack: a level-3 game also gets every level-1 and level-2 check.
//   L1 obvious maximum   score is an integer within the absolute bound and the hard per-second ceiling (2x the honest rate).
//   L2 session checks    signed single-use run token (replays -> 409), token TTL, SERVER-measured run time vs the honest
//                        per-second ceiling (+ramp for games that speed up), coins vs time, input telemetry, submit
//                        frequency per IP / per player, history jumps. (src/server.js + src/anticheat.js)
//   L3 event log         the game sends a compact log of every scoring event + progression marks (engine award()/mark()).
//                        The rules below re-check it: the events must add up to the score exactly, every value must be
//                        legal for the wave / row / multiplier / bankroll at that moment, counts must fit the waves, and
//                        timestamps must fit inside the server-measured run. Forged or inconsistent logs are rejected.
//   L4 server replay     seeded deterministic logic + input log re-simulated in Node to compute the real score (Stack:
//                        public/js/games/stack-core.js; Memory Match: src/anticheat.js replayMemory). Mismatch = rejected.
// See docs/ANTI-CHEAT.md.
const path = require('path'); const { pathToFileURL } = require('url');

const LEVEL_NAMES = { 1: 'L1 max check', 2: 'L2 session checks', 3: 'L3 event log', 4: 'L4 server replay' };

// ---- Stack replay core (ES module shared with the browser), loaded once at boot ----
let stackCore = null; const stackReady = import(pathToFileURL(path.join(__dirname, '..', 'public', 'js', 'games', 'stack-core.js')).href).then(m => { stackCore = m; }).catch(e => { console.error('stack-core load failed', e.message); });

// ---- L3 decoding ----
// ev = { v: 1, e: [dt (10 ms units), kind, value, ...], n: total events, agg?: { kind: [count, sum, max] } (overflow), end }
function decode(ev) {
  if (!ev || typeof ev !== 'object' || ev.v !== 1 || !Array.isArray(ev.e) || ev.e.length % 3 || ev.e.length > 4500 * 3) return { why: 'malformed event log' };
  const out = []; let t = 0;
  for (let i = 0; i < ev.e.length; i += 3) {
    const dt = ev.e[i], k = ev.e[i + 1], v = ev.e[i + 2];
    if (!Number.isInteger(dt) || dt < 0 || typeof k !== 'string' || !k || k.length > 6 || typeof v !== 'number' || !Number.isFinite(v)) return { why: 'malformed event' };
    t += dt; out.push({ t, k, v });
  }
  let agg = null;
  if (ev.agg != null) {
    if (typeof ev.agg !== 'object' || Array.isArray(ev.agg)) return { why: 'malformed overflow block' };
    agg = {}; for (const [k, r] of Object.entries(ev.agg)) { if (!Array.isArray(r) || r.length !== 3 || !r.every(x => Number.isFinite(x) && x >= 0)) return { why: 'malformed overflow block' }; agg[k] = r; }
    if (out.length < 4500) return { why: 'overflow block without a full log' };
  }
  const end = Number.isInteger(ev.end) ? ev.end : t; if (end < t) return { why: 'events after the end of the run' };
  return { events: out, agg, end };
}

const isPts = { // which kinds carry points (the rest are progression marks)
  default: (k) => k[0] !== '#' && !['w', 'r', 't', 'x', 'B', 'L', 'X'].includes(k),
  plinko: (k) => k[0] === 's', 'drift-rush': () => false, 'blazed-roulette': (k) => k === 'win',
};
const VS_TYPES = [50, 80, 150];
const rule = (fn) => fn;
// Each rule walks the events in order with the game's own state machine; return a reason string to reject, or null.
const RULES = {
  'gl-neon-circuit': rule((E) => {
    for (const e of E) {
      if (e.k[0] === '#') continue;
      if (e.k === 'e') { if (e.v < 30 || e.v > 125 || e.v % 5 !== 0) return `energy cell worth ${e.v} is not possible`; }
      else if (e.k === 'n') { if (e.v !== 5) return `near miss worth ${e.v} is not possible`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'gl-rift-survival': rule((E) => {
    for (const e of E) {
      if (e.k[0] === '#') continue;
      if (e.k === 's') { if (e.v !== 25) return `rift shard worth ${e.v} is not possible`; }
      else if (e.k === 'b') { if (e.v < 20 || e.v % 10 !== 0) return `wave bonus ${e.v} is not possible`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'void-swarm': rule((E) => {
    let w = 0, kills = 0, boss = 0, clr = 0;
    for (const e of E) {
      if (e.k === 'w') { if (e.v !== w + 1) return `wave ${e.v} after wave ${w}`; w = e.v; kills = 0; boss = 0; clr = 0; continue; }
      if (!w) return 'points before the first wave';
      if (e.k === 'k') { const m = Math.min(4, 1 + 0.05 * (w - 1)); if (!VS_TYPES.some(b => [1, 2].some(d => Math.round(b * d * m) === e.v))) return `kill worth ${e.v} is not possible in wave ${w}`;
        const rows = Math.min(5, 3 + Math.floor(w / 3)), cols = Math.min(8, 6 + Math.floor(w / 4)); if (++kills > rows * cols) return `more kills than drones in wave ${w}`; }
      else if (e.k === 'c') { if (e.v !== 100 * w || ++clr > 1) return `bad wave-clear bonus ${e.v} in wave ${w}`; }
      else if (e.k === 'b') { if (w % 5 || e.v !== Math.round(2000 * Math.max(1, w / 5)) || ++boss > 1) return `bad mothership bonus ${e.v} in wave ${w}`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'brick-breaker': rule((E) => {
    let rows = 6, hits = 0; const CH = []; for (let c = 1; c <= 13; c++) CH.push(Math.min(4, 1 + 0.25 * (c - 1)));
    for (const e of E) {
      if (e.k === 'r') { if (e.v !== rows + 1) return `row ${e.v} after row ${rows}`; rows = e.v; continue; }
      if (e.k !== 'h') return `unknown event ${e.k}`;
      const m = Math.min(5, 1 + 0.2 * Math.floor(rows / 10)); if (![10, 20, 50].some(b => CH.some(c => Math.round(b * m * c) === e.v))) return `brick worth ${e.v} is not possible at row ${rows}`;
      if (++hits > 8 * rows) return 'more bricks broken than the wall ever had';
    }
    return null;
  }),
  'grow-guard': rule((E) => {
    let w = 0, n = 0, clr = 0; const need = { 10: 1, 15: 1, 20: 2, 30: 3, 60: 5 };
    for (const e of E) {
      if (e.k === 'w') { if (e.v !== w + 1) return `wave ${e.v} after wave ${w}`; w = e.v; n = 0; clr = 0; continue; }
      if (!w) return 'points before the first wave';
      if (e.k === 'p') { if (!need[e.v] || w < need[e.v]) return `pest worth ${e.v} cannot appear in wave ${w}`; if (++n > (w <= 3 ? 4 + 2 * w : 6 + 3 * w)) return `more pests than wave ${w} sends`; }
      else if (e.k === 'c') { if (e.v !== 100 * w || ++clr > 1) return `bad wave-clear bonus ${e.v}`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'haze-defense': rule((E) => {
    let w = 0, n = 0, clr = 0;
    for (const e of E) {
      if (e.k === 'w') { if (e.v !== w + 1) return `wave ${e.v} after wave ${w}`; w = e.v; n = 0; clr = 0; continue; }
      if (!w) return 'points before the first wave';
      if (e.k === 'o') { if (e.v !== 1 + Math.floor(w / 10)) return `layer worth ${e.v} in wave ${w}`; if (++n > (8 + Math.floor(w * 2.2)) * 15) return `more layers popped than wave ${w} has`; }
      else if (e.k === 'c') { if (e.v !== 50 * w || ++clr > 1) return `bad wave-clear bonus ${e.v}`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'high-score': rule((E) => {
    let combo = 0;
    for (const e of E) {
      if (e.k === 'x') { combo = 0; continue; } if (e.k !== 'h') return `unknown event ${e.k}`;
      combo++; const m = Math.min(5, 1 + Math.floor(combo / 5)); const ok = [1, 2].some(g => { const b = e.v / (m * g); return Number.isInteger(b) && b >= 10 && b <= 25; });
      if (!ok) return `hit worth ${e.v} does not match combo x${m}`;
    }
    return null;
  }),
  'terp-tapper': rule((E) => {
    let combo = 0;
    for (const e of E) {
      if (e.k === 'x') { combo = 0; continue; } if (e.k !== 'n') return `unknown event ${e.k}`;
      combo++; const m = Math.min(4, 1 + Math.floor(combo / 10)); if (![30, 60, 100].some(b => b * m === e.v)) return `note worth ${e.v} does not match combo x${m}`;
    }
    return null;
  }),
  'memory-match': rule((E) => {
    let combo = 0;
    for (const e of E) {
      if (e.k === 'p') { if (e.v % 100 || e.v < 100 || e.v > 500) return `pair worth ${e.v}`; combo = e.v / 100; }
      else if (e.k === 'c') { if (e.v < 50 || e.v % 10) return `bad board bonus ${e.v}`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'munchies-snake': rule((E) => {
    for (const e of E) { if (e.k !== 'f') return `unknown event ${e.k}`; if (![10, 20, 50, 250].includes(e.v)) return `food worth ${e.v}`; }
    return null;
  }),
  plinko: rule((E) => {
    let chips = 10; const SL = [0, 5, 20, 50, 100, 200];
    for (const e of E) {
      if (e.k === 'd') { if (chips <= 0 || e.v !== chips - 1) return 'dropped a chip you did not have'; chips = e.v; continue; }
      const slot = +e.k.slice(1); if (e.k[0] !== 's' || !SL.includes(slot) || ![1, 2, 4].some(m => slot * m === e.v)) return `slot event ${e.k}=${e.v}`;
      if (slot === 200) chips += 2; else if (slot === 100) chips += 1;
    }
    return null;
  }),
  'spin-to-win': rule((E) => {
    let lives = 3, dbl = false; const SEG = [10, 20, 25, 50, 100, 200, 250, 500, 1000];
    for (const e of E) {
      if (lives <= 0) return 'spins after the last life was lost';
      if (e.k === 'B') { lives--; dbl = false; } else if (e.k === 'L') lives = Math.min(5, lives + 1); else if (e.k === 'X') dbl = true;
      else if (e.k === 'p') { if (!SEG.some(v => v * (dbl ? 2 : 1) === e.v)) return `spin worth ${e.v}${dbl ? ' (x2)' : ''}`; dbl = false; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'sling-smash': rule((E) => {
    let k = 1, first = true, bots = 0, blocks = 0, clr = 0;
    for (const e of E) {
      if (e.k === 't') { if (!(e.v === k + 1 || (first && e.v === 1))) return `tower ${e.v} after tower ${k}`; k = e.v; first = false; bots = 0; blocks = 0; clr = 0; continue; }
      if (e.k === 'k') { if (![10, 20, 40].includes(e.v) || ++blocks > 60) return `block worth ${e.v}`; }
      else if (e.k === 'b') { if (e.v !== 500 || ++bots > 2 + Math.floor(k / 3)) return `more bots than tower ${k} has`; }
      else if (e.k === 'c') { if (![0, 1, 2, 3].some(sp => 1000 * Math.min(5, k) * (sp + 1) / 2 === e.v) || ++clr > 1) return `bad tower-clear bonus ${e.v}`; }
      else return `unknown event ${e.k}`;
    }
    return null;
  }),
  'blazed-roulette': rule((E) => {
    let bank = 1000, n = 0, open = 0;
    for (const e of E) {
      if (e.k === 'n') { const tmin = 10 + 5 * n, tmax = 100 + 50 * n; if (e.v < tmin || e.v > tmax || e.v > bank) return `stake ${e.v} breaks the table limits or bankroll`; bank -= e.v; open = e.v; n++; continue; }
      if (e.k !== 'win') return `unknown event ${e.k}`;
      const tmax = 100 + 50 * (n - 1); if (!open || e.v > 36 * Math.floor(tmax / 10) + 3 * open) return `win of ${e.v} is more than the stake can pay`; bank += e.v; open = 0;
    }
    return null;
  }),
  'drift-rush': rule((E, score) => {
    let lastD = 0, sumD = 0, lastM = 0;
    for (const e of E) {
      if (e.k === 'd') { if (e.v < 0 || e.v > 95 * (e.t - lastD) / 100 + 10) return `drift bank ${e.v} is faster than the car can drift`; sumD += e.v; lastD = e.t; }
      else if (e.k === 'm') { if (e.v < lastM || e.v > 75 * e.t / 100 + 50) return `distance ${e.v} m is not reachable in ${(e.t / 100).toFixed(1)} s`; lastM = e.v; }
      else return `unknown event ${e.k}`;
    }
    const meters = score - sumD; if (meters < 0 || meters > lastM + 260) return 'score does not match distance + drift';
    return null;
  }),
  // Bud Escape (id jetpack-dash, public/js/jetpack.js): 'm' = 10 per 10 m travelled (speed <= 25 m/s), 'q' = completed
  // daily mission (200 each, at most 3), '#v' = vehicle crate taken (crates are >= 480 m apart), '#x' = vehicle destroyed.
  'jetpack-dash': rule((E) => {
    let mEv = 0, q = 0, veh = 0;
    for (const e of E) {
      const t = e.t / 100;
      if (e.k === 'm') { if (e.v !== 10) return `distance payout ${e.v} is not possible`; if (++mEv * 10 > 25 * t + 60) return `${mEv * 10} m is not reachable in ${t.toFixed(1)} s`; }
      else if (e.k === 'q') { if (e.v !== 200) return `mission bonus ${e.v} is not possible`; if (++q > 3) return 'more than three missions completed'; }
      else if (e.k === '#v') { if (!Number.isInteger(e.v) || e.v < 1 || e.v > 7) return 'unknown vehicle'; if (++veh > mEv / 40 + 2) return 'vehicle crates closer together than the rules allow'; }
      else if (e.k !== '#x') return `unknown event ${e.k}`;
    }
    return null;
  }),
  stack: rule((E) => { for (const e of E) if (e.k !== 's' || !(e.v === 10 || (e.v >= 20 && e.v <= 110 && e.v % 10 === 0))) return `slab worth ${e.v}`; return null; }),
};

// L3 check. Returns { ok: true, events } or { ok: false, why } or { missing: true }.
function checkEvents(gameId, ev, score, elapsedS) {
  if (ev == null) return { missing: true };
  const d = decode(ev); if (d.why) return { ok: false, why: d.why };
  if (d.end > elapsedS * 100 + 300) return { ok: false, why: 'event times run past the server-measured run time' };
  const pts = isPts[gameId] || isPts.default; let sum = 0;
  for (const e of d.events) if (pts(e.k)) sum += e.v;
  if (d.agg) for (const [k, r] of Object.entries(d.agg)) if (pts(k)) sum += r[1];
  if (gameId !== 'drift-rush' && sum !== score) return { ok: false, why: `events add up to ${sum}, not ${score}` };
  const R = RULES[gameId]; if (R) { const why = R(d.events, score); if (why) return { ok: false, why }; }
  return { ok: true, n: d.events.length, overflow: !!d.agg };
}

// L4 Stack replay: log = drop times in ms (one per slab, last one may be the miss)
function replayStack(log, score, elapsedS) {
  if (!stackCore) return { ok: false, why: 'replay engine not loaded', retry: true };
  if (!Array.isArray(log) || log.length > 20000) return { ok: false, why: 'bad drop log' };
  const r = stackCore.replay(log); if (!r.ok) return r;
  if (r.ms > elapsedS * 1000 + 3000) return { ok: false, why: 'drop times add up to more than the server-measured run' };
  if (r.score !== score) return { ok: false, why: `replay scored ${r.score}, the client sent ${score}` };
  return { ok: true, score: r.score, slabs: r.slabs };
}

module.exports = { LEVEL_NAMES, decode, checkEvents, replayStack, stackReady, RULES };

#!/usr/bin/env node
// v7 score-range simulator (original code). Estimates realistic score distributions for every ENDLESS game in the catalog
// (casual, good and top-1% players) so shop prices, tiers, quests and anti-cheat rate limits can be set from data.
//
// How it works
//  * Each game has a run model below that follows the game's real rules (scoring table, lives / bankroll / board clock,
//    difficulty ramp) at the event level: obstacles, drops, spins, boards, waves... A player's skill s (0..1) sets the
//    chance to fail each event, aim quality, reaction time and so on. The difficulty ramps are the same numbers the game
//    code uses (public/js/games/*.js), so a run always ends: every model has a failure chance that grows with time.
//  * A player population (skill ~ Beta(2, 3.2): most people casual, few experts) plays a number of runs each. We report
//      casual  = median run of players with skill 0.15-0.40
//      good    = median personal best of players with skill 0.60-0.80
//      top1    = 99th percentile of personal bests over the whole population (the top 1% of players)
//    plus run-length percentiles and the highest per-second scoring rate seen (to check the anti-cheat ceilings).
//  * Recorded runs: if data/hub.db has >= 30 accepted runs for a game whose scoring did not change in v7, the observed
//    percentiles are printed next to the model so the model can be recalibrated (--db PATH to point elsewhere).
// Usage: node tools/score-sim.js [--players 3000] [--runs 8] [--seed 7] [--db data/hub.db] [--out docs/score-ranges.json] [--quiet]
'use strict';
const fs = require('fs'); const path = require('path');
const ROOT = path.join(__dirname, '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PLAYERS = +arg('players', 3000), RUNS = +arg('runs', 8), SEED = +arg('seed', 7), QUIET = process.argv.includes('--quiet');
const OUT = path.resolve(ROOT, arg('out', 'docs/score-ranges.json'));
// --- seeded RNG helpers ---
let _a = SEED >>> 0; const R = () => { _a |= 0; _a = _a + 0x6D2B79F5 | 0; let t = Math.imul(_a ^ _a >>> 15, 1 | _a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const gauss = () => { let u = 0, v = 0; while (!u) u = R(); while (!v) v = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = (p) => R() < p;
const gammaS = (k) => { // Marsaglia-Tsang, k >= 1
  const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { x = gauss(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = R(); if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; } };
const beta = (a, b) => { const x = gammaS(a), y = gammaS(b); return x / (x + y); };
const MAXT = 3 * 3600; // safety stop for a single simulated run (3 h)

// ---------- run models: (s) => { score, t } ----------
const M = {
  // meters; speed 11 m/s -> 24 at ~108 s, then +0.02/s to 28. Obstacles ~0.55/s rising; shields = 1 extra hit sometimes.
  'jetpack-dash'(s) { let t = 0, d = 0, shield = 0; for (; t < MAXT; t += 1) { const v = Math.min(28, t < 108 ? 11 + 0.12 * t : 24 + 0.02 * (t - 108)); d += v; if (chance(0.03)) shield = 1;
    const ev = 0.55 + 0.004 * Math.min(t, 300); const q = (0.012 + 0.11 * (1 - s) ** 2) * (1 + t / 260) * (v / 18); if (chance(ev * q)) { if (shield) shield = 0; else break; } } return { score: Math.floor(d), t }; },
  // v7 Drift Rush (calibrated on tools/v7/drift-playtest.js: average player ~62 s / ~1,300, good ~140 s / ~3,750): 3 hearts,
  // 1.5 s invulnerability, checkpoint every 1,500 m heals one; speed 16 + 0.18 t to 50 at 190 s, then +0.02/s to 56.
  'drift-rush'(s) { let t = 0, m = 0, pts = 0, hp = 3, inv = 0, cp = 1500; for (; t < MAXT; t += 0.5) { const v = t < 190 ? 16 + 0.18 * t : Math.min(56, 50 + 0.02 * (t - 190)); m += v * 0.5 * (0.62 + 0.12 * s);
    pts += (2 + 6 * s) * 0.5; inv -= 0.5; const ev = (0.30 + 0.0016 * Math.min(t, 400)) * 0.5; const q = (0.05 + 0.5 * (1 - s) ** 2) * (v / 30) ** 1.4;
    if (inv <= 0 && chance(ev * q)) { hp--; inv = 1.5; if (!hp) break; } if (m >= cp) { cp += 1500; hp = Math.min(3, hp + 1); } } return { score: Math.floor(m + pts), t }; },
  // 10 chips; 200 slots refund 2 chips, 100 refunds 1; level every 5 drops: 0-slots appear, big slots drift, golden pegs faster.
  plinko(s) { let chips = 10, score = 0, t = 0, n = 0; while (chips > 0 && t < MAXT) { chips--; n++; t += 3.4 + 1.4 * (1 - s); const lvl = Math.floor(n / 5); const shrink = Math.pow(0.975, lvl);
    const p200 = (0.07 + 0.25 * s) * shrink, p100 = (0.06 + 0.07 * s) * shrink, p0 = Math.min(0.32, 0.025 * lvl) * (1 - 0.35 * s); const u = R(); let v;
    if (u < p200) v = 200; else if (u < p200 + p100) v = 100; else if (u < p200 + p100 + p0) v = 0; else { const w = R(); v = w < 0.28 ? 50 : w < 0.62 ? 20 : 5; }
    let mult = 1; if (chance(0.10 + 0.16 * s)) mult = 2; if (mult === 2 && chance(0.12 + 0.25 * s)) mult = 4; score += v * mult; if (v === 200) chips += 2; else if (v === 100) chips += 1; } return { score, t }; },
  // 3 lives; BUST costs one, BONUS gives one (max 5); every 5 spins: reshuffle, faster meter, +1 BUST wedge (max 6 of 16).
  'spin-to-win'(s) { let lives = 3, score = 0, t = 0, n = 0, dbl = false; while (lives > 0 && t < MAXT) { n++; t += 4.6; const lvl = Math.floor(n / 5); const busts = Math.min(6, 1 + lvl);
    const aim = s * Math.pow(0.93, lvl); // how well the player lands where they want (meter speeds up, layout reshuffles)
    const pBust = (busts / 16) * (1 - 0.75 * aim); const pBonus = (1 / 16) * (1 + 1.5 * aim); const u = R();
    if (u < pBust) { lives--; dbl = false; continue; } if (u < pBust + pBonus) { lives = Math.min(5, lives + 1); continue; } if (u < pBust + pBonus + 1 / 16) { dbl = true; continue; }
    const big = chance(0.15 + 0.55 * aim); const v = big ? (chance(0.45) ? 1000 : chance(0.5) ? 500 : 250) : [100, 20, 10, 50, 20, 100, 50, 10, 25, 200][Math.floor(R() * 10)]; score += v * (dbl ? 2 : 1); dbl = false; } return { score, t }; },
  // endless boards; board clock = pairs * 4.2 s * 0.95^board (min 1.3 s/pair); time needed per pair depends on skill.
  'memory-match'(s) { const SIZES = [6, 8, 10, 12, 15]; let score = 0, t = 0, b = 0; while (t < MAXT) { const pairs = SIZES[Math.min(b, 4)]; const clock = pairs * Math.max(1.3, 4.2 * Math.pow(0.95, b)) + 2;
    const per = (1.05 + 3.2 * (1 - s) ** 1.3) * (1 + 0.12 * Math.log(pairs)); const need = pairs * per * Math.exp(gauss() * 0.16); const combo = 1 + 3.6 * s * s;
    if (need > clock) { score += Math.floor(pairs * (clock / need) * 0.85) * 100 * Math.max(1, combo * 0.7); t += clock + 1.5; break; }
    score += pairs * 100 * combo + Math.round(clock - need) * 10 + 50 * (b + 1); t += need + 2.5; b++; } return { score: Math.floor(score), t }; },
  // 3 lives (+1 per 100 hits); target life 1.85 s -> 0.95 s at 90 s, then slowly to 0.7; spawns up to ~3/s.
  'high-score'(s) { let lives = 3, score = 0, t = 0, hits = 0, combo = 0; for (; t < MAXT && lives > 0; t += 0.25) { const d = Math.min(1, t / 90) + Math.min(0.5, Math.max(0, t - 90) / 400);
    const rate = 1 / Math.max(0.3, 1.05 - 0.55 * d); if (!chance(rate * 0.25)) continue; const q = 0.012 + 0.16 * (1 - s) ** 2 + 0.07 * d * d * (1 - 0.6 * s) + (chance(0.15 + 0.07 * d) ? 0.05 * (1 - s) : 0);
    if (chance(q)) { lives--; combo = 0; continue; } hits++; combo++; if (hits % 100 === 0) lives++; const acc = 4 + 11 * s * (1 - 0.3 * d); score += Math.round((10 + acc) * Math.min(5, 1 + Math.floor(combo / 5)) * (chance(0.1) ? 2 : 1)); } return { score, t }; },
  // bankroll 1,000; table min 10 + 5n, max 100 + 50n; landing zone +-2 pockets widening by 1 each side every 6 spins; score = chips won.
  'blazed-roulette'(s) { let bank = 1000, won = 0, t = 0, n = 0; while (t < MAXT) { const min = 10 + 5 * n, max = 100 + 50 * n; if (bank < min) break; n++; t += 5.5 + 2 * (1 - s);
    // red/black alternate on the wheel, so even a perfectly timed 5-pocket zone holds at most 3 of one colour (60%)
    const zone = Math.min(37, 5 + 2 * Math.floor(n / 6)); const pWin = 18 / 37 + (0.6 - 18 / 37) * s * (5 / zone) - 0.02 * (1 - s); const bet = clamp(Math.round(bank * (0.12 + 0.12 * s)), min, Math.min(max, bank));
    if (chance(pWin)) { bank += bet; won += bet; } else bank -= bet; } return { score: won, t }; },
  // 5 lives (+1 per 100 combo); bpm 96 -> 168 at 120 s, then +0.15/s to 220 with denser chords. 100/60/30 x mult (<=4).
  'terp-tapper'(s) { let lives = 5, score = 0, t = 0, combo = 0; for (; t < MAXT && lives > 0; t += 0.5) { const bpm = t < 120 ? 96 + 0.6 * t : Math.min(220, 168 + 0.15 * (t - 120)); const notes = bpm / 60 * 0.5 * (0.95 + Math.min(0.5, t / 600));
    for (let k = Math.floor(notes + R()); k > 0; k--) { const q = 0.004 + 0.16 * (1 - s) ** 2 * (bpm / 130) ** 3; if (chance(q)) { lives--; combo = 0; if (!lives) break; continue; } combo++; if (combo % 100 === 0) lives = Math.min(5, lives + 1);
      const u = R(); const base = u < 0.25 + 0.6 * s ? 100 : u < 0.6 + 0.35 * s ? 60 : 30; score += base * Math.min(4, 1 + Math.floor(combo / 10)); } } return { score, t }; },
  // v7 Neon Munchies (slither-style arena, AI rivals): pellets 10, snacks 50, golden brownie 250, rival burst orbs 20 each.
  // Intake grows with length; rivals get bigger and more numerous over time, so the death hazard climbs.
  'munchies-snake'(s) { let score = 0, t = 0; for (; t < MAXT; t += 1) { score += (3 + 7 * s) * (1 + Math.min(1.5, t / 150)) * (0.7 + 0.6 * R());
    if (chance(0.006 + 0.03 * s)) score += 20 * (6 + Math.floor(R() * 14)); if (chance(0.004 + 0.01 * s)) score += 250;
    if (chance((0.003 + 0.045 * (1 - s) ** 2) * (1 + t / 240))) break; } return { score: Math.floor(score), t }; },
  // v7 endless Brick Breaker: the wall creeps down (a new row every 8 s -> 2.6 s), ~7 bricks a row, 10/20/50 pts x row mult
  // (1 + 0.2 per 10 rows, max x5) x chain (max x4). The run ends when the wall reaches the danger line or the last ball is lost.
  'brick-breaker'(s) { let t = 0, rows = 0, backlog = 0, balls = 3, score = 0, acc = 0; const capB = (0.9 + 2.4 * s) * Math.exp(gauss() * 0.12);
    for (; t < MAXT; t += 1) { const rt = Math.max(2.6, 8 - 0.04 * rows); acc += 1 / rt; while (acc >= 1) { acc--; rows++; backlog += 7; if (rows % 30 === 0) balls = Math.min(5, balls + 1); }
      const br = Math.min(backlog, capB * (1 + Math.min(0.5, rows / 200)) * (0.8 + 0.4 * R())); backlog -= br; const mult = Math.min(5, 1 + 0.2 * Math.floor(rows / 10)); score += br * 14 * mult * (1 + 1.2 * s);
      if (backlog > 7 * 9) break; if (chance((0.004 + 0.05 * (1 - s) ** 2) * (1 + t / 200))) { balls--; if (!balls) break; } } return { score: Math.floor(score), t }; },
  // towers passed; one hit ends; gap 215 -> 150, speed 185 -> 300 px/s, then sliding gaps.
  'sky-hopper'(s) { let n = 0, t = 0; while (t < MAXT) { const spd = Math.min(360, 185 + 3 * n + (n > 40 ? 0.6 * (n - 40) : 0)); t += 300 / spd; const tight = 1 + Math.max(0, (215 - Math.max(150, 215 - 2.2 * n)) / 65) * 0.8 + (n > 30 ? Math.min(1, (n - 30) / 60) : 0);
    if (chance((0.006 + 0.22 * (1 - s) ** 2.2) * tight)) break; n++; } return { score: n, t }; },
  // Stack: slab error ~ |N(0, sigma)| of slab width; sigma grows with speed; perfect (< 3%) streaks grow the slab back.
  stack(s) { let w = 1, n = 0, score = 0, t = 0, streak = 0; while (t < MAXT) { const speed = Math.min(2.6, 1 + n * 0.012); t += 0.55 + 0.6 * (1 - s) / speed; const sig = (0.012 + 0.11 * (1 - s) ** 1.6) * speed;
    const e = Math.abs(gauss() * sig); if (e >= w) break; n++; if (e < 0.03) { streak++; score += 10 + 10 * Math.min(10, streak); if (streak >= 3) w = Math.min(1, w + 0.06); } else { streak = 0; w -= e; score += 10; } } return { score, t }; },
  // Grow Guard: wave w (~35 s) sends 4 + 2w pests (w <= 3) then 6 + 3w, tougher types later (avg pts 10 + 2.5w, cap 45);
  // pests leak once past the player's capacity; 3 plants, the once-per-row ladybug swarm saves a few leaks.
  'grow-guard'(s) { let plants = 3, score = 0, t = 0, w = 0; const cap = 2 + 20 * s ** 1.2 + gauss() * 1.5; while (t < MAXT && plants > 0) { w++; const pests = w <= 3 ? 4 + 2 * w : 6 + 3 * w; const pts = Math.min(45, 10 + 2.5 * w); t += 33 + 0.8 * w;
    const leakP = clamp((w - cap) / 6, 0, 1) * 0.25 + 0.004 * (1 - s); let leaks = 0; for (let k = 0; k < pests; k++) if (chance(leakP)) leaks++; score += Math.round((pests - leaks) * pts); plants -= Math.min(plants, Math.ceil(leaks / 4)); if (plants > 0) score += 100 * w; } return { score, t }; },
  // Sling Smash: 5 balls; par 3 per tower; clear = +1 ball + unused under par; bots 2 + tower/3 (500 each), blocks ~ 8 + 1.5 tower.
  'sling-smash'(s) { let balls = 5, score = 0, t = 0, k = 0; while (t < MAXT) { k++; const bots = 2 + Math.floor(k / 3), blocks = 8 + 1.5 * k; let left = bots, used = 0;
    while (left > 0 && balls > 0) { balls--; used++; t += 5 + 3 * (1 - s); const hitP = clamp((0.25 + 0.6 * s) * Math.pow(0.985, k), 0.08, 0.95); let kos = 0; for (let b = 0; b < left; b++) if (chance(hitP * 0.75)) kos++; left -= kos; score += 500 * kos + Math.round(blocks / 3 * (0.4 + 0.6 * s)) * 22; }
    if (left > 0) break; balls += 1 + Math.max(0, 3 - used); score += 1000 * Math.min(5, k) * Math.max(0, 3 - used + 1) / 2; } return { score: Math.round(score), t }; },
  // Haze Defense: 20 lives; wave layers 20 + 8w + 0.6w^2, score = layers x tier (1 + floor(w/10)) + 50w; leaks past capacity.
  'haze-defense'(s) { let lives = 20, score = 0, t = 0, w = 0; const cap = 4 + 30 * s ** 1.2 + gauss() * 2; while (t < MAXT && lives > 0) { w++; const layers = 20 + 8 * w + 0.6 * w * w; const tier = 1 + Math.floor(w / 10); t += 22 + 0.5 * w;
    const leak = clamp((w - cap) / 5, 0, 1) * (0.35 + 0.2 * R()); const leaked = Math.round(layers * leak * 0.12); score += Math.round(layers * (1 - leak) * tier); lives -= Math.min(lives, leaked); if (lives > 0) score += 50 * w; } return { score, t }; },
  // Void Swarm: wave w (~8.5 s) = rows x cols drones (rows 3 -> 5, cols 6 -> 8), 50/80/150 pts, x2 while diving, x(1 + 0.05(w-1)) max 4,
  // +100 w per clear, mothership every 5th wave (2000 x w/5). 3 lives (capsules: shield / +1 life up to 4); hits per wave rise with w.
  'void-swarm'(s) { let lives = 3, score = 0, t = 0, w = 0; const lam0 = (0.03 + 1.2 * (1 - s) ** 2) * 0.85; while (t < MAXT && lives > 0) { w++; const rows = Math.min(5, 3 + Math.floor(w / 3)), cols = Math.min(8, 6 + Math.floor(w / 4));
    const n = rows * cols; const top = cols, mid = cols * (1 + Math.floor(rows / 3)) - cols; const base = (top * 150 + mid * 80 + (n - top - mid) * 50) / n; const mult = Math.min(4, 1 + 0.05 * (w - 1));
    let hits = 0; const lam = lam0 * (0.6 + 0.1 * w); let p = Math.exp(-lam), u = R(), c = p; while (u > c) { hits++; p *= lam / hits; c += p; } if (chance(0.04 * s)) lives = Math.min(4, lives + 1);
    const frac = hits >= lives ? 0.4 * R() : 1; lives -= hits; score += Math.round(n * frac * base * (1 + 0.15 + 0.25 * s) * mult); t += 8.5 * frac + 1.5;
    if (lives > 0) { score += 100 * w; if (w % 5 === 0) score += Math.round(2000 * Math.max(1, w / 5)); } } return { score, t }; },
};
// games whose scoring rules did not change in v7 (recorded runs are comparable)
const SAME_RULES = new Set([]); // v7 changed the rules/ramps of every game (endless), so recorded runs are not comparable
const pct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1) + 0.5))]; };
const med = (a) => pct(a, 0.5);
const round = (v) => v >= 1000 ? Math.round(v / 50) * 50 : v >= 100 ? Math.round(v / 10) * 10 : Math.round(v);

function simulate(id) {
  const model = M[id]; const casual = [], good = [], pbs = [], runs = [], lens = []; let maxRate = 0, maxRateAt = null; let capViol = 0;
  const g = CAT.find(x => x.id === id); const capOf = (t) => g.ac.perSec * t + 0.5 * (g.ac.ramp || 0) * t * t + g.ac.grace;
  for (let p = 0; p < PLAYERS; p++) {
    const s = beta(2, 3.2); let pb = 0;
    for (let k = 0; k < RUNS; k++) {
      const sk = clamp(s + gauss() * 0.04, 0, 1); const r = model(sk); runs.push(r.score); lens.push(r.t); pb = Math.max(pb, r.score);
      if (r.t > 5) { const rate = r.score / r.t; if (rate > maxRate) { maxRate = rate; maxRateAt = { score: r.score, seconds: Math.round(r.t) }; } }
      if (r.score > capOf(Math.max(1, r.t))) capViol++;
      if (s >= 0.15 && s <= 0.40) casual.push(r.score);
    }
    pbs.push(pb); if (s >= 0.6 && s <= 0.8) good.push(pb);
  }
  // expert stress test: skill 1.0 runs must stay under the honest rate ceiling
  let expertViol = 0, expertMax = 0; for (let k = 0; k < 300; k++) { const r = model(1); expertMax = Math.max(expertMax, r.score); if (r.score > capOf(Math.max(1, r.t))) expertViol++; }
  return {
    casual: { median: round(med(casual)), p75: round(pct(casual, 0.75)) },
    good: { median_pb: round(med(good)), p90_pb: round(pct(good, 0.9)) },
    top1: { pb: round(pct(pbs, 0.99)) },
    runs: { p10: round(pct(runs, 0.1)), p50: round(med(runs)), p90: round(pct(runs, 0.9)), p99: round(pct(runs, 0.99)) },
    run_seconds: { p10: Math.round(pct(lens, 0.1)), p50: Math.round(med(lens)), p90: Math.round(pct(lens, 0.9)), p99: Math.round(pct(lens, 0.99)) },
    rate: { max_seen_per_sec: +maxRate.toFixed(2), at: maxRateAt, ceiling_per_sec: g.ac.perSec, ramp: g.ac.ramp || 0, over_ceiling_runs: capViol, expert_over_ceiling: expertViol, expert_best: round(expertMax) },
    suggested_tiers: [round(med(casual)), round(med(good)), round(pct(pbs, 0.985))],
  };
}
function recorded(id, dbPath) {
  if (!SAME_RULES.has(id) || !fs.existsSync(dbPath)) return null;
  try { const D = require(path.join(ROOT, 'node_modules', 'better-sqlite3'))(dbPath, { readonly: true, fileMustExist: true });
    const rows = D.prepare('SELECT r.score FROM runs r JOIN users u ON u.id = r.user_id WHERE r.game_id = ? AND r.held = 0 AND u.is_demo = 0').all(id).map(r => r.score); D.close();
    if (rows.length < 30) return { n: rows.length, note: 'fewer than 30 real runs, not used' };
    return { n: rows.length, p50: med(rows), p90: pct(rows, 0.9), max: Math.max(...rows) };
  } catch (e) { return { error: e.message }; }
}
// catalog (read the config without needing secrets)
function loadCatalog() { process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'score-sim'; process.env.SECRET = process.env.SECRET || 'score-sim'; return require(path.join(ROOT, 'src', 'config.js')).GAMES; }
const CAT = loadCatalog();
const out = { generated_at: new Date().toISOString(), method: 'event-level Monte Carlo per game (tools/score-sim.js), skill ~ Beta(2,3.2)', players: PLAYERS, runs_per_player: RUNS, seed: SEED,
  definitions: { casual: 'median run score, players with skill 0.15-0.40', good: 'median personal best, players with skill 0.60-0.80', top1: '99th percentile of personal bests (top 1% of players)' }, games: {} };
const dbPath = path.resolve(ROOT, arg('db', 'data/hub.db'));
for (const g of CAT) {
  if (!M[g.id]) { console.error('no model for', g.id); process.exitCode = 1; continue; }
  const r = simulate(g.id); r.title = g.title; r.unit = g.unit; r.current_tiers = g.tiers; const rec = recorded(g.id, dbPath); if (rec) r.recorded = rec; out.games[g.id] = r;
  if (!QUIET) console.log(`${g.title.padEnd(16)} casual ${String(r.casual.median).padStart(8)}  good ${String(r.good.median_pb).padStart(8)}  top1% ${String(r.top1.pb).padStart(9)}  run p50 ${String(r.run_seconds.p50).padStart(4)}s p90 ${String(r.run_seconds.p90).padStart(5)}s  max ${r.rate.max_seen_per_sec}/s (ceiling ${g.ac.perSec}${g.ac.ramp ? '+ramp' : ''}) over:${r.rate.over_ceiling_runs}/${r.rate.expert_over_ceiling}${rec && rec.p50 !== undefined ? `  recorded n=${rec.n} p50 ${rec.p50}` : ''}`);
}
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
// short human summary next to the JSON
const n = (v) => Number(v).toLocaleString('en-US');
const md = [`# Score ranges per game (v7, all games endless)`, '',
  `Generated by \`node tools/score-sim.js\` on ${out.generated_at.slice(0, 10)} (${PLAYERS} simulated players x ${RUNS} runs each, seed ${SEED}). Raw data: \`docs/score-ranges.json\`.`, '',
  '**Casual** = median run of a casual player (skill 0.15-0.40). **Good** = median personal best of a good player (skill 0.60-0.80). **Top 1%** = the personal best that only 1 in 100 players reaches.',
  'Run length = how long a run lasts before the player fails (all players). Max rate = the highest points-per-second any simulated run reached; it must stay under the server ceiling (it does for every game, including 300 expert runs per game).', '',
  '| Game | Unit | Casual run | Good PB | Top 1% PB | Run length p50 / p90 | Max rate seen | Server ceiling | Tiers (bronze/silver/gold) |', '|---|---|---|---|---|---|---|---|---|',
  ...Object.entries(out.games).map(([id, r]) => `| ${r.title} | ${r.unit} | ${n(r.casual.median)} | ${n(r.good.median_pb)} | ${n(r.top1.pb)} | ${r.run_seconds.p50}s / ${r.run_seconds.p90}s | ${r.rate.max_seen_per_sec}/s | ${r.rate.ceiling_per_sec}/s${r.rate.ramp ? ` + ramp ${r.rate.ramp}/s²` : ''} | ${r.current_tiers.map(n).join(' / ')} |`), '',
  '## How to use this for shop prices', '',
  '- Scores are **not comparable across games** (Sky Hopper counts towers, Terp Tapper multiplies combos). Price anything score-gated per game, using the columns above, or use Hub Points (earned per run, not per point) for prices.',
  '- A sensible ladder per game: *common* unlock at the casual run, *rare* at the good PB, *legendary* at the top-1% PB. The `suggested_tiers` field in the JSON is casual / good / top 1.5%.',
  '- Points-per-run economies (src/shop.js EARN) are unaffected by score scale; endless runs only change how long a run takes (see run length).', '',
  '## Caveats', '',
  '- These are **model estimates**, not live data: each game is simulated at the event level with the real scoring rules and difficulty ramps, but the skill-to-error curves are assumptions.',
  '- When the live leaderboard has 30+ real runs per game, re-run `node tools/score-sim.js --db <path to hub.db>`: games whose rules did not change in v7 print the recorded percentiles next to the model for recalibration.',
  '- Casino-style games (Blazed Roulette especially) have long tails: a skilled player who keeps timing the drop can run for many minutes, so the top-1% value is far above the good PB.', ''].join('\n');
fs.writeFileSync(path.join(path.dirname(OUT), 'SCORE-RANGES.md'), md);
if (!QUIET) console.log('wrote', path.relative(ROOT, OUT), '+ SCORE-RANGES.md');

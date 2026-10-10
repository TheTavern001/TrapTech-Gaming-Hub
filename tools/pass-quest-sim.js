// Tunes the "earn next season's pass free" quest chain so that roughly 5% of ACTIVE players finish all 48 quests.
// Model (same skill model as tools/score-sim.js): skill s ~ Beta(2, 3.2). Per-game personal-best percentile comes from
// z = rho*Zs + sqrt(1-rho^2)*e (rho 0.8: skill transfers between arcade games). Activity (days played in the 56-day
// season) ~ engagement that rises with skill. Score thresholds are read off docs/score-ranges.json by log-linear
// interpolation between anchor percentiles of personal bests: good.median_pb ~ p70, good.p90_pb ~ p88, top1.pb ~ p99.
// Usage: node tools/pass-quest-sim.js  -> writes docs/pass-quests.json and prints the completion rate.
const fs = require('fs'); const path = require('path');
const R = require('../docs/score-ranges.json'); const cfg = require('../src/config');
let seed = 11; const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed / 4294967296; };
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
const gamma = (k) => { if (k < 1) return gamma(k + 1) * Math.pow(rnd(), 1 / k); const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d); for (;;) { let x, v; do { x = gauss(); v = 1 + c * x; } while (v <= 0); v = v * v * v; const u = rnd(); if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v; } };
const beta = (a, b) => { const x = gamma(a); return x / (x + gamma(b)); };
const Phi = (z) => 0.5 * (1 + Math.tanh(0.7978845608 * (z + 0.044715 * z ** 3)));
const games = cfg.GAMES.map(g => g.id);
const anchors = (id) => { const g = R.games[id]; return [[0.40, g.runs.p90], [0.70, g.good.median_pb], [0.88, g.good.p90_pb], [0.99, g.top1.pb]]; };
const scoreAt = (id, q) => { const A = anchors(id); const k = Math.max(1, A.findIndex(x => q <= x[0])); const [a, b] = k > 0 ? [A[k - 1], A[k]] : [A[2], A[3]]; const f = (q - a[0]) / (b[0] - a[0]); const v = Math.exp(Math.log(a[1]) + f * (Math.log(b[1]) - Math.log(a[1]))); const m = v > 1000 ? 50 : v > 100 ? 5 : 1; return Math.round(v / m) * m; };
const ACT = { days: 28, runs: 250 };
function simulate(qT3, N = 40000) {
  let done = 0; const rho = 0.8;
  for (let i = 0; i < N; i++) {
    const s = beta(2, 3.2); const zs = (s - 0.385) / 0.2; // standardised skill
    const days = Math.min(56, Math.round(56 * Math.min(1, beta(1.2 + 3 * s, 2.2)))); const runs = days * (4 + 10 * s * rnd());
    if (days < ACT.days || runs < ACT.runs) continue; // quests 40/41
    let ok = true, gold = 0; for (const id of games) { const z = rho * zs + Math.sqrt(1 - rho * rho) * gauss(); const q = Phi(z) ; if (q < qT3) { ok = false; break; } gold++; }
    if (ok) done++;
  }
  return done / N;
}
let lo = 0.40, hi = 0.99; for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (simulate(mid, 12000) > 0.05) lo = mid; else hi = mid; }
const q = Math.round(((lo + hi) / 2) * 1000) / 1000; const rate = simulate(q);
const out = { generated_at: new Date().toISOString(), target_completion: 0.05, simulated_completion: Math.round(rate * 1000) / 1000, t3_percentile: q,
  note: 'Tiers per game: T3 = personal-best score at the tuned percentile (all 13 games needed), T2 = 7 percentile points lower, T1 = 14 lower (floor p40). Run once per balance change.',
  activity: ACT, games: Object.fromEntries(games.map(id => [id, { t1: scoreAt(id, Math.max(0.40, q - 0.14)), t2: scoreAt(id, Math.max(0.41, q - 0.07)), t3: scoreAt(id, q) }])) };
fs.writeFileSync(path.join(__dirname, '..', 'docs', 'pass-quests.json'), JSON.stringify(out, null, 1));
console.log(`T3 percentile ${q}; simulated completion ${(rate * 100).toFixed(2)}% of active players`);

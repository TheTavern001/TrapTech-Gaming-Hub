// The Gaming Hub - Games Library adapter (original code, MIT). One thin bridge between a library game and the hub:
// starts a signed server run (/api/run/start), records scoring events (L3-style log, same format as src/ac-levels.js),
// input telemetry (same shape as public/js/games/engine.js Telemetry), and submits at game over (/api/score).
(function () {
  const H = window.Hub = { token: null, seed: null, t0: 0, ev: [], last: 0, n: 0, tel: { n: 0, last: 0, sum: 0, sq: 0, k: 0, min: 0 }, guest: false, id: null };
  async function post(p, b) { const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(b) }); let j = {}; try { j = await r.json(); } catch (e) {} j.status = r.status; return j; }
  let startSerial = 0;
  H.start = async function (id) {
    const currentStart = ++startSerial;
    H.id = id; H.ev = []; H.last = 0; H.n = 0; H.tel = { n: 0, last: 0, sum: 0, sq: 0, k: 0, min: 0 }; H.token = null; H.seed = null; H.t0 = performance.now();
    try { const qs = new URLSearchParams(location.search); const po = qs.get('playoff'); const event = qs.get('event') || qs.get('event_code') || qs.get('giveaway_id') || qs.get('giveaway'); const body = { game_id: id }; if (po) body.playoff = po; if (event) body.event = event; const r = await post('/api/run/start', body); if (currentStart !== startSerial) return null;
      if (r.ok) { H.token = r.token; H.seed = r.seed; H.guest = false; H.err = null; } else { H.guest = r.status === 401; H.err = r.error; } } catch (e) { if (currentStart !== startSerial) return null; H.guest = true; H.err = 'Network unavailable'; }
    H.t0 = performance.now(); return H.seed;
  };
  // kind: short string (<=6 chars); value: points for scoring kinds, progression value for marks (w/r/t/x)
  H.event = function (k, v) { const t = Math.round((performance.now() - H.t0) / 10); if (H.ev.length < 4500 * 3) { H.ev.push(t - H.last, String(k).slice(0, 6), v); H.last = t; } H.n++; };
  H.input = function () { const T = H.tel, t = performance.now(); if (T.last) { const d = t - T.last; T.sum += d; T.sq += d * d; T.k++; T.min = T.min ? Math.min(T.min, d) : d; } T.last = t; T.n++; };
  H.telOut = function () { const T = H.tel, m = T.k ? T.sum / T.k : 0; return { n: T.n, mean: Math.round(m), sd: Math.round(Math.sqrt(Math.max(0, T.k ? T.sq / T.k - m * m : 0))), min: Math.round(T.min) }; };
  H.submit = async function (score) {
    const dur = Math.round(performance.now() - H.t0);
    if (!H.token) return { ok: false, guest: H.guest, error: H.guest ? 'Sign in to save scores to the leaderboard.' : (H.err || 'Score not saved (no run session).') };
    const tok = H.token; H.token = null;
    try { return await post('/api/score', { token: tok, score: Math.max(0, Math.floor(score)), coins: 0, duration_ms: dur, tel: H.telOut(), ev: { v: 1, e: H.ev, end: Math.round(dur / 10) } }); }
    catch (e) { return { ok: false, error: 'Network error, score not saved.' }; }
  };
})();

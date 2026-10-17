// The Gaming Hub - Games Library adapter (original code, MIT). One thin bridge between a library game and the hub:
// starts a signed server run (/api/run/start), records scoring events (L3-style log, same format as src/ac-levels.js),
// input telemetry (same shape as public/js/games/engine.js Telemetry), and submits at game over (/api/score).
(function () {
  const H = window.Hub = { token: null, seed: null, t0: 0, ev: [], last: 0, n: 0, tel: { n: 0, last: 0, sum: 0, sq: 0, k: 0, min: 0 }, guest: false, id: null };
  async function post(p, b) { const r = await fetch(p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(b) }); let j = {}; try { j = await r.json(); } catch (e) {} j.status = r.status; return j; }
  // ---- v8 guest practice mode ----
  // Signed-out visitors play every game normally; scores just are not saved. We ask /api/me first (it answers 200 with
  // user:null for guests) so no 401 is ever logged, and raw API error strings are never shown to the player.
  const FRIENDLY = 'Practice run - sign in to save scores.';
  let meP = null;
  function whoami() {
    if (!meP) meP = Promise.resolve().then(() => fetch('/api/me', { credentials: 'same-origin' })).then(r => r.json()).then(j => !!(j && j.user)).catch(() => null);
    return meP;
  }
  function randSeed() { let s = ''; for (let i = 0; i < 8; i++) s += Math.floor(Math.random() * 16).toString(16); return s; }
  let toastEl = null, toastT = 0;
  H.toast = function (msg, ms) {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      if (!toastEl) {
        const st = document.createElement('style');
        st.textContent = '.hub-toast{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translate(-50%,24px);opacity:0;max-width:min(92vw,360px);padding:10px 14px;border-radius:14px;background:rgba(12,14,38,.94);border:1px solid rgba(154,126,255,.55);color:#e9e6ff;font:600 13px/1.35 system-ui,sans-serif;text-align:center;box-shadow:0 8px 28px rgba(0,0,0,.45);z-index:99999;transition:opacity .25s,transform .25s;pointer-events:none}.hub-toast.on{opacity:1;transform:translate(-50%,0);pointer-events:auto}.hub-toast a{color:#8feaff;font-weight:800;text-decoration:underline}';
        document.head.appendChild(st);
        toastEl = document.createElement('div'); toastEl.className = 'hub-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl);
      }
      toastEl.innerHTML = ''; toastEl.appendChild(document.createTextNode(msg + ' '));
      const a = document.createElement('a'); a.textContent = 'Sign in'; a.target = '_top';
      a.href = '/signin?next=' + encodeURIComponent((location.pathname || '/') ); toastEl.appendChild(a);
      toastEl.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => toastEl && toastEl.classList.remove('on'), ms || 5200);
    } catch (e) {}
  };
  let startSerial = 0, hintShown = false;
  H.start = async function (id) {
    const currentStart = ++startSerial;
    H.id = id; H.ev = []; H.last = 0; H.n = 0; H.tel = { n: 0, last: 0, sum: 0, sq: 0, k: 0, min: 0 }; H.token = null; H.seed = null; H.t0 = performance.now();
    try {
      const signedIn = await whoami(); if (currentStart !== startSerial) return null;
      if (signedIn === false) { H.guest = true; H.err = null; H.seed = randSeed(); if (!hintShown) { hintShown = true; H.toast('Practice mode: scores are not saved.', 3800); } }
      else {
        const qs = new URLSearchParams(location.search); const po = qs.get('playoff'); const event = qs.get('event') || qs.get('event_code') || qs.get('giveaway_id') || qs.get('giveaway'); const body = { game_id: id }; if (po) body.playoff = po; if (event) body.event = event; const r = await post('/api/run/start', body); if (currentStart !== startSerial) return null;
        if (r.ok) { H.token = r.token; H.seed = r.seed; H.guest = false; H.err = null; }
        else { H.guest = r.status === 401; H.err = null; H.rawErr = r.error; H.seed = randSeed(); if (!H.guest) H.softFail = true; }
      }
    } catch (e) { if (currentStart !== startSerial) return null; H.guest = true; H.err = null; H.seed = randSeed(); }
    H.t0 = performance.now(); return H.seed;
  };
  // kind: short string (<=6 chars); value: points for scoring kinds, progression value for marks (w/r/t/x)
  H.event = function (k, v) { const t = Math.round((performance.now() - H.t0) / 10); if (H.ev.length < 4500 * 3) { H.ev.push(t - H.last, String(k).slice(0, 6), v); H.last = t; } H.n++; };
  H.input = function () { const T = H.tel, t = performance.now(); if (T.last) { const d = t - T.last; T.sum += d; T.sq += d * d; T.k++; T.min = T.min ? Math.min(T.min, d) : d; } T.last = t; T.n++; };
  H.telOut = function () { const T = H.tel, m = T.k ? T.sum / T.k : 0; return { n: T.n, mean: Math.round(m), sd: Math.round(Math.sqrt(Math.max(0, T.k ? T.sq / T.k - m * m : 0))), min: Math.round(T.min) }; };
  H.submit = async function (score) {
    // Invalid scoring data must never be serialized as JSON null or accepted as zero.
    // Preserve the active token so an invalid caller cannot consume a valid run.
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || !Number.isSafeInteger(Math.floor(score)))
      return { ok: false, error: 'Invalid game score; the run was not submitted.' };
    const dur = Math.round(performance.now() - H.t0);
    if (!Number.isSafeInteger(dur) || dur < 0)
      return { ok: false, error: 'Invalid game duration; the run was not submitted.' };
    if (!H.token) { H.toast(H.guest ? 'Nice run! Sign in to save your score.' : 'Score not saved this time.', 6500); return { ok: false, guest: true, practice: true, error: H.guest ? FRIENDLY : 'Practice run - score not saved.' }; }
    const tok = H.token; H.token = null;
    // Freeze the completed run's evidence before a new start resets telemetry.
    // Neither async response order nor a subsequent run may mutate this proof.
    const payload = { token: tok, score: Math.max(0, Math.floor(score)), coins: 0,
      duration_ms: dur, tel: H.telOut(), ev: { v: 1, e: H.ev.slice(), end: Math.round(dur / 10) } };
    try { const r = await post('/api/score', payload); if (!r.ok) { r.rawError = r.error; r.error = 'Score not saved. Try again soon.'; } return r; }
    catch (e) { return { ok: false, error: 'Network error, score not saved.' }; }
  };
})();

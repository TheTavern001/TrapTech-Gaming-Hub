// The Gaming Hub bridge for the vendored Chromium runner (original code, MIT). Starts a signed run when a run begins
// and submits the Chromium distance meter value at game over. Exposes window.__GL for tools/e2e-games-lib.js.
(function () {
  let state = 'title', score = 0, t0 = 0, frames = 0, fps = 60, fT = performance.now(), inputs = 0;
  const GL = window.__GL = { get state() { return state; }, get score() { return state === 'play' && window.Runner && Runner.instance_ ? Runner.instance_.distanceMeter.getActualDistance(Math.ceil(Runner.instance_.distanceRan)) : score; }, get fps() { return fps; }, lastSubmit: null, errors: [],
    g: { get inputs() { return inputs; }, end: () => { const r = window.Runner && Runner.instance_; if (r && state === 'play') r.gameOver(); }, get paused() { return false; }, set paused(v) {} } };
  (function loop(now) { frames++; if (now - fT >= 1000) { fps = Math.round(frames * 1000 / (now - fT)); frames = 0; fT = now; } requestAnimationFrame(loop); })(performance.now());
  ['keydown', 'touchstart', 'pointerdown'].forEach(ev => addEventListener(ev, () => { inputs++; Hub.input(); }, { passive: true }));
  const msg = (s) => { const el = document.getElementById('hubmsg'); if (el) el.textContent = s; };
  window.HubTrex = {
    start() { if (state === 'play') return; state = 'play'; score = 0; GL.lastSubmit = null; Hub.start('gl-dino-dash'); msg('Run on! Space / Up / tap to jump, Down to duck'); },
    over(dist) { if (state !== 'play') return; state = 'over'; score = dist; Hub.event('m', dist); msg('Saving ' + dist + '...'); Hub.submit(dist).then(r => { GL.lastSubmit = r; msg(r.ok ? 'Saved ' + dist + (r.rank ? ' - rank #' + r.rank : '') + '. Jump to run again' : (r.error || 'Score not saved') + ' - jump to run again'); }); },
  };
  // phones: a tap anywhere on the page jumps (the Chromium build only listens on its small container)
  const fwd = (type) => (e) => { const r = window.Runner && Runner.instance_; if (!r || e.target.closest('.glback') || r.containerEl.contains(e.target)) return; e.preventDefault(); r.handleEvent({ type, target: r.containerEl, keyCode: 0, preventDefault() {}, changedTouches: e.changedTouches }); };
  addEventListener('touchstart', fwd('touchstart'), { passive: false }); addEventListener('touchend', fwd('touchend'), { passive: false });
  addEventListener('error', e => GL.errors.push(String(e.message)));
})();

// The Gaming Hub bridge for the vendored MIT 2048-style engine (original code, MIT). Seeds tile spawns from the signed
// run (identical boards in playoffs), logs every merge as a scoring event (events sum to the score -> L3 validation),
// submits at game over. Endless: no win stop - play continues past every tile. Exposes window.__GL for e2e.
(function () {
  let state = 'title', gm = null, frames = 0, fps = 60, fT = performance.now(), inputs = 0, merges = 0;
  function rng(seed) { let h = 2166136261; for (const c of String(seed || Date.now())) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return function () { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const GL = window.__GL = { errors: [], get state() { return state; }, get score() { return gm ? gm.score : 0; }, get fps() { return fps; }, lastSubmit: null,
    g: { get inputs() { return inputs; }, end: () => { if (gm && state === 'play') { gm.over = true; gm.actuate(); finish(); } }, get paused() { return false; }, set paused(v) {} } };
  (function loop(now) { frames++; if (now - fT >= 1000) { fps = Math.round(frames * 1000 / (now - fT)); frames = 0; fT = now; } requestAnimationFrame(loop); })(performance.now());
  ['keydown', 'touchstart', 'pointerdown'].forEach(ev => addEventListener(ev, () => { inputs++; Hub.input(); }, { passive: true }));
  addEventListener('error', e => GL.errors.push(String(e.message)));
  const msg = (s) => { const el = document.getElementById('hubmsg'); if (el) el.textContent = s; };
  // storage: never resume a half-played board (each run must be a fresh signed run)
  LocalStorageManager.prototype.getGameState = function () { return null; }; LocalStorageManager.prototype.setGameState = function () {};
  GameManager.prototype.isGameTerminated = function () { return this.over; }; // endless: winning never stops play
  const _setup = GameManager.prototype.setup;
  GameManager.prototype.setup = function () { gm = this; state = 'starting'; merges = 0; const self = this; this.inputManager.events = this.inputManager.events || {};
    _setup.call(this); this.grid = new Grid(this.size); this.score = 0; this.over = false; this.won = false; this.keepPlaying = true;
    Hub.start('gl-bud-merge').then((seed) => { Math.random = rng(seed); self.grid = new Grid(self.size); self.score = 0; self.addStartTiles(); self.actuate(); state = 'play'; msg('Merge buds - how far can you grow?'); }); };
  const _move = GameManager.prototype.move;
  GameManager.prototype.move = function (dir) { if (state !== 'play') return; const before = this.score; _move.call(this, dir); const d = this.score - before;
    if (d > 0) { merges++; Hub.event('m', d); }
    if (this.over) finish(); };
  function finish() { if (state !== 'play') return; state = 'over'; const s = gm.score; msg('Saving ' + s + '...'); Hub.submit(s).then(r => { GL.lastSubmit = r; msg(r.ok ? 'Saved ' + s + '!' : (r.error || 'Not saved')); }); }
  window.requestAnimationFrame(function () { new GameManager(4, KeyboardInputManager, HTMLActuator, LocalStorageManager); });
})();

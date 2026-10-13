// Hub bridge for the vendored GPL-3.0 hex puzzle (original code, GPL-3.0). Every new game = a signed run seeded by the
// server; each clear is logged (events sum to the score); game over submits. Endless by design. window.__GL for e2e.
(function () { let st = 'title', frames = 0, fps = 60, fT = performance.now(), inputs = 0, resumeTimer = null;
  const GL = window.__GL = { errors: [], lastSubmit: null, get state() { return st; }, get score() { return window.score || 0; }, get fps() { return fps; },
    g: { get inputs() { return inputs; }, end: () => { if (st === 'play') { window.gameState = 2; hubOver(); } }, get paused() { return window.gameState === -1; }, get resumePending() { return resumeTimer !== null; }, set paused(v) {
      // Hextris rejects native pause() toggles during its 400ms UI transition.
      // Queue a quick settings close until the transition completes.
      if (v) {
        if (resumeTimer !== null) { clearTimeout(resumeTimer); resumeTimer = null; }
        if (window.gameState === 1) pause();
        return;
      }
      if (window.gameState !== -1) return;
      const resume = () => { resumeTimer = null; if (window.gameState === -1 && window.pausable !== false) pause(); };
      if (window.pausable === false) {
        if (resumeTimer !== null) clearTimeout(resumeTimer);
        resumeTimer = setTimeout(resume, 450);
      } else resume();
    } } };
  (function loop(n) { frames++; if (n - fT >= 1000) { fps = Math.round(frames * 1000 / (n - fT)); frames = 0; fT = n; } requestAnimationFrame(loop); })(performance.now());
  ['keydown', 'touchstart', 'pointerdown'].forEach(e => addEventListener(e, () => { inputs++; Hub.input(); }, { passive: true }));
  addEventListener('error', e => GL.errors.push(String(e.message)));
  document.addEventListener('visibilitychange', () => { if (document.hidden && window.gameState === 1) pause(); });
  const _init = window.init; let pending = false;
  window.init = function (b) { if (!b && st !== 'over') return _init(b); if (pending) return; pending = true; st = 'starting';
    const go = (seed) => { hubSeed(seed); pending = false; _init(b); st = 'play'; }; Hub.start('gl-hex-stack').then(go, () => go(null)); setTimeout(() => { if (pending) go(null); }, 4000); };
  window.hubOver = function () { if (st !== 'play') return; st = 'over'; const s = window.score || 0; Hub.submit(s).then(r => { GL.lastSubmit = r; }); };
})();
// Hub: on the title screen any tap / click / Space / Enter starts (upstream only accepted taps on the small play icon on some layouts)
(function () { let fired = false; const go = (e) => { if (fired || window.gameState !== 0 || __GL.state !== 'title') return; if (e.target?.closest?.('.glback, .ttgs-root, .ttgs-modal')) return; /* Never start on settings controls. */ if (e.type === 'keydown' && !/^( |Spacebar|Enter)$/.test(e.key)) return; fired = true; setTimeout(() => { fired = false; }, 1500); try { startBtnHandler(); } catch (err) {} };
  addEventListener('touchend', go, true); addEventListener('mouseup', go, true); addEventListener('keydown', go, true); })();

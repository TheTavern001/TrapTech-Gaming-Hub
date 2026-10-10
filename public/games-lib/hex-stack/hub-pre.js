// Hub pre-load shim for the vendored GPL-3.0 hex puzzle (original code, GPL-3.0-compatible). No resumable boards:
// every run is a fresh signed run, so the engine's localStorage save-state is disabled. Seeded RNG for playoffs.
(function () { const gi = Storage.prototype.getItem, si = Storage.prototype.setItem;
  Storage.prototype.getItem = function (k) { return k === 'saveState' ? null : gi.call(this, k); };
  Storage.prototype.setItem = function (k, v) { if (k === 'saveState') return; return si.call(this, k, v); };
  window.hubSeed = function (seed) { let h = 2166136261; for (const c of String(seed || Date.now())) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
    Math.random = function () { h += 0x6D2B79F5; let t = h; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
})();

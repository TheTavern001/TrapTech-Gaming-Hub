// Stack rules core (original code, v7). Shared by the game (public/js/games/stack.js) and the server-side anti-cheat
// level 4 replay (src/ac-levels.js): the server re-runs the logged drop times through exactly this code and recomputes the
// score, so a run cannot claim more than the drops it really made. Pure arithmetic only (no Math.random, no trig), so the
// browser and Node give bit-identical results.
export const H0 = 0.17, BASE = 1.0, PERFECT = 0.035, RANGE = 1.45, GROW = 0.07;
export const speedAt = (n) => Math.min(3.4, Math.min(2.6, 1 + n * 0.014) + Math.max(0, n - 115) * 0.003);
// slab position on its axis after `ms` milliseconds: starts at center - range and ping-pongs between center +- range
export function posAt(center, range, v, ms) {
  const span = 2 * range; const d = v * ms / 1000; const m = d % (2 * span); return center - range + (m <= span ? m : 2 * span - m);
}
export function newState() { return { n: 0, streak: 0, score: 0, over: false, top: { x: 0, z: 0, w: BASE, d: BASE } }; }
// resolve one drop made `ms` after the slab spawned. Mutates st; returns what happened (for the game's visuals).
export function drop(st, ms) {
  const p = st.top; const axis = st.n % 2 === 0 ? 'x' : 'z'; const v = speedAt(st.n);
  const center = axis === 'x' ? p.x : p.z; const size = axis === 'x' ? p.w : p.d; const pos = posAt(center, RANGE, v, ms); const delta = pos - center;
  const c = { x: p.x, z: p.z, w: p.w, d: p.d }; c[axis] = pos;
  if (Math.abs(delta) >= size) { st.over = true; return { miss: true, axis, delta, slab: c, pts: 0 }; }
  st.n++; let pts, perfect = false, cut = 0;
  if (Math.abs(delta) < PERFECT) {
    perfect = true; c[axis] = center; st.streak++;
    if (st.streak >= 3) { if (axis === 'x') c.w = Math.min(BASE, c.w + GROW); else c.d = Math.min(BASE, c.d + GROW); }
    pts = 10 + 10 * Math.min(10, st.streak);
  } else {
    st.streak = 0; cut = Math.abs(delta); const keep = size - cut; c[axis] = center + delta / 2; if (axis === 'x') c.w = keep; else c.d = keep; pts = 10;
  }
  st.score += pts; st.top = c; return { miss: false, perfect, axis, delta, cut, slab: c, pts, streak: st.streak };
}
// full replay of a drop-time log (ms per slab). Returns the recomputed score and run facts.
export function replay(log) {
  const st = newState(); let total = 0;
  for (const ms of log) { if (!Number.isInteger(ms) || ms < 0 || ms > 600000) return { ok: false, why: 'bad drop time' }; if (st.over) return { ok: false, why: 'drops after the tower fell' }; total += ms; drop(st, ms); }
  return { ok: true, score: st.score, slabs: st.n, over: st.over, ms: total };
}

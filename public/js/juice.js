// Shared juice helpers — visual feedback only. Never affects score formulas or hitboxes.
// Opt-in from games. Respects reduced-motion preference.

export function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      localStorage.getItem('hub-reduce-motion') === '1';
  } catch (_) { return false; }
}

export function flash(el, color = '#ffd700', duration = 120) {
  if (!el || prefersReducedMotion()) return;
  const orig = el.style.boxShadow;
  el.style.boxShadow = `0 0 18px 4px ${color}`;
  setTimeout(() => { el.style.boxShadow = orig; }, duration);
}

export function scorePop(container, text, x, y, color = '#fff') {
  if (!container || prefersReducedMotion()) return;
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `position:absolute;left:${x}px;top:${y}px;color:${color};font:700 18px 'Exo 2',sans-serif;pointer-events:none;text-shadow:0 0 6px #000;transition:transform .5s,opacity .5s;z-index:9`;
  container.appendChild(el);
  requestAnimationFrame(() => {
    el.style.transform = 'translateY(-40px)';
    el.style.opacity = '0';
  });
  setTimeout(() => el.remove(), 600);
}

export function lightShake(el, intensity = 4, duration = 180) {
  if (!el || prefersReducedMotion()) return;
  const orig = el.style.transform;
  const start = performance.now();
  function tick(now) {
    const t = now - start;
    if (t > duration) { el.style.transform = orig; return; }
    const dx = (Math.random() - 0.5) * intensity;
    const dy = (Math.random() - 0.5) * intensity;
    el.style.transform = `translate(${dx}px,${dy}px)`;
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

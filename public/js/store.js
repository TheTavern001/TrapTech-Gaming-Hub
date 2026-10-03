// Safe storage for in-app browsers (Potato, Android WebView, iOS WKWebView). DOM storage can be disabled
// (Android WebView defaults domStorageEnabled=false) or throw (private mode / blocked storage), so every access
// is wrapped and falls back to an in-memory map for the session.
function make(kind) {
  const mem = new Map(); let s = null;
  try { s = window[kind]; const k = '__gh_t'; s.setItem(k, '1'); s.removeItem(k); } catch { s = null; }
  return {
    available: !!s,
    getItem(k) { try { if (s) return s.getItem(k); } catch {} return mem.has(k) ? mem.get(k) : null; },
    setItem(k, v) { v = String(v); mem.set(k, v); try { if (s) s.setItem(k, v); } catch {} },
    removeItem(k) { mem.delete(k); try { if (s) s.removeItem(k); } catch {} },
  };
}
export const ls = make('localStorage');
export const ss = make('sessionStorage');
// copy to clipboard without popups/prompt(): clipboard API -> execCommand -> on-page sheet with a selectable field
export async function copyText(text, label = 'Copy this link') {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch {}
  try {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, text.length); const ok = document.execCommand('copy'); ta.remove(); if (ok) return true;
  } catch {}
  const d = document.createElement('div'); d.className = 'sheet copy-sheet'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-label', label);
  d.innerHTML = `<div class="sheet-in card pad"><h3 style="margin:0 0 8px">${label}</h3><input class="input" readonly id="copy-field"><p class="small muted">Press and hold the link to copy it.</p><button class="btn block" data-close>Done</button></div>`;
  d.querySelector('#copy-field').value = text;
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-close]')) d.remove(); });
  document.body.appendChild(d); const f = d.querySelector('#copy-field'); f.focus(); f.select();
  return false;
}

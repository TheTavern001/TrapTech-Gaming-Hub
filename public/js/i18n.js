// v7 i18n: lightweight, no build step. English is the source; public/i18n/<lang>.json maps English UI strings (and a few
// "@named" keys) to a language. After every render, exact-match text nodes and a few attributes are swapped, so existing
// templates stay plain English. User content never matches whole-string keys by accident in practice, and anything inside
// [data-noi18n] is skipped. Legal pages stay English-authoritative: a translated summary + note is added on top.
export const LANGS = [['en', 'English'], ['es', 'Español'], ['pt', 'Português'], ['fr', 'Français'], ['de', 'Deutsch'], ['it', 'Italiano'], ['nl', 'Nederlands'],
  ['ru', 'Русский'], ['uk', 'Українська'], ['pl', 'Polski'], ['tr', 'Türkçe'], ['ar', 'العربية'], ['he', 'עברית'], ['hi', 'हिन्दी'], ['zh-CN', '简体中文'],
  ['zh-TW', '繁體中文'], ['ja', '日本語'], ['ko', '한국어'], ['vi', 'Tiếng Việt'], ['th', 'ไทย'], ['id', 'Bahasa Indonesia'], ['fil', 'Filipino']];
const RTL = new Set(['ar', 'he']); const CODES = new Set(LANGS.map(l => l[0]));
const store = (() => { try { return window.localStorage; } catch { return null; } })();
export function pick(list) {
  for (const raw of list || []) { const l = String(raw || '').trim(); if (!l) continue; const base = l.split(/[-_]/)[0].toLowerCase();
    if (base === 'zh') return /TW|HK|MO|HANT/.test(l.toUpperCase()) ? 'zh-TW' : 'zh-CN';
    const alias = { tl: 'fil', iw: 'he', in: 'id' }[base]; if (alias) return alias;
    if (CODES.has(base)) return base; }
  return 'en';
}
let lang = 'en', dict = {};
export const current = () => lang; export const isRTL = () => RTL.has(lang);
export const t = (s) => (dict[s] ?? s);
const ATTRS = ['placeholder', 'aria-label', 'title'];
function swap(root) {
  if (lang === 'en' || !root) return;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: n => { const p = n.parentElement; return !p || p.closest('[data-noi18n],script,style,textarea,code,pre') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; } });
  for (let n; (n = w.nextNode());) { const v = n.nodeValue, k = v.trim(); if (k && dict[k] !== undefined) n.nodeValue = v.replace(k, dict[k]); }
  root.querySelectorAll && root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => { if (el.closest('[data-noi18n]')) return; for (const a of ATTRS) { const v = el.getAttribute(a); if (v && dict[v] !== undefined) el.setAttribute(a, dict[v]); } });
}
const LEGAL = { '/rules': '@rules_summary', '/terms': '@legal_summary', '/privacy': '@legal_summary', '/responsible-play': '@legal_summary' };
function legalBanner() {
  const key = LEGAL[location.pathname]; const old = document.getElementById('i18n-legal');
  if (!key || lang === 'en') { if (old) old.remove(); return; } if (old) return;
  const art = document.querySelector('#app .legal article, #app article.prose'); if (!art) return;
  art.setAttribute('dir', 'ltr'); art.setAttribute('lang', 'en'); // the authoritative English text keeps its own direction
  const d = document.createElement('div'); d.id = 'i18n-legal'; d.className = 'card pad i18n-legal'; d.dataset.noi18n = '';
  d.innerHTML = `<b></b><p></p><p class="small muted"></p>`; d.children[0].textContent = dict['@summary_title'] || 'Summary'; d.children[1].textContent = dict[key] || ''; d.children[2].textContent = dict['@legal_note'] || '';
  art.before(d);
}
function langPicker() {
  const foot = document.querySelector('.site-foot .sf-in, .splash .cta, #set-lang'); if (!foot || foot.querySelector('#lang-pick')) return;
  const l = document.createElement('label'); l.className = 'lang-pick'; l.dataset.noi18n = ''; l.innerHTML = '<span></span> <select id="lang-pick"></select>';
  l.firstChild.textContent = '🌐 ' + (dict.Language || 'Language');
  const s = l.querySelector('select'); s.setAttribute('aria-label', dict.Language || 'Language');
  for (const [c, n] of LANGS) { const o = document.createElement('option'); o.value = c; o.textContent = n; o.lang = c; if (c === lang) o.selected = true; s.append(o); }
  s.onchange = () => setLang(s.value); foot.append(l);
}
let raf = 0; const pass = () => { raf = 0; swap(document.body); legalBanner(); langPicker(); };
const schedule = () => { if (!raf) raf = requestAnimationFrame(pass); };
export async function setLang(code, save = true) {
  code = CODES.has(code) ? code : 'en';
  if (save && store) store.setItem('gh_lang', code);
  if (code !== lang && lang !== 'en') { lang = code; location.reload(); return; } // swapped text can't be un-swapped; reload is simplest
  lang = code; dict = {};
  if (code !== 'en') { try { dict = await (await fetch(`/i18n/${code}.json`)).json(); } catch { dict = {}; } }
  document.documentElement.lang = code; document.documentElement.dir = RTL.has(code) ? 'rtl' : 'ltr';
  document.querySelectorAll('#lang-pick').forEach(x => x.parentElement.remove()); schedule();
}
export function init() {
  const saved = store && store.getItem('gh_lang');
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true, characterData: false });
  window.HubI18n = { t, lang: current, set: setLang, rtl: isRTL }; // game HUDs: window.HubI18n?.t('Score')
  return setLang(saved || pick(navigator.languages || [navigator.language]), false);
}

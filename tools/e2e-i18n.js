// v7 i18n: language files, auto-detect, picker, persistence, RTL, legal summaries, HUD hook. cd tools && node e2e-i18n.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://localhost:8787'; const fs = require('fs'); const path = require('path');
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x || ''); } };
(async () => {
  const dir = path.join(__dirname, '..', 'public', 'i18n'); const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  ok(files.length === 21, `21 translation files + English source (${files.length})`);
  for (const f of files) { const d = JSON.parse(fs.readFileSync(path.join(dir, f))); ok(Object.keys(d).length >= 55 && d['@legal_note'] && d['@rules_summary'] && d['@legal_summary'], `${f}: ${Object.keys(d).length} strings incl. legal summary + note`); }
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const page = async (locale) => { const c = await b.newContext({ locale, viewport: { width: 1280, height: 900 } }); await c.addInitScript(() => { try { localStorage.setItem('gh_age_ok', String(Date.now())); } catch {} }); const p = await c.newPage(); p.errs = []; p.on('pageerror', e => p.errs.push(e.message)); return p; };
  const attr = (p, a) => p.getAttribute('html', a);
  let p = await page('es-MX'); await p.goto(BASE + '/'); await p.waitForTimeout(1500);
  ok((await p.textContent('body')).includes('Empezar') && await attr(p, 'lang') === 'es', 'browser es-MX -> Spanish splash, <html lang="es">');
  await p.goto(BASE + '/about'); await p.waitForTimeout(1300); ok((await p.textContent('.site-foot')).includes('Reglas oficiales'), 'footer links translated');
  await p.selectOption('#lang-pick', 'ar'); await p.waitForTimeout(2200);
  ok(await attr(p, 'dir') === 'rtl' && await attr(p, 'lang') === 'ar', 'picker -> Arabic, <html dir="rtl">');
  ok(await p.evaluate(() => getComputedStyle(document.body).direction) === 'rtl', 'layout direction is rtl');
  await p.goto(BASE + '/rules'); await p.waitForTimeout(1500); ok(await attr(p, 'lang') === 'ar', 'choice persists across page loads');
  const lg = await p.textContent('#i18n-legal').catch(() => ''); ok(lg.includes('الإنجليزية') && /Official Giveaway Rules|Eligibility|eligible/i.test(await p.textContent('#app')), 'rules: Arabic summary + English-authoritative note; English rules stay');
  await p.screenshot({ path: path.join(__dirname, '..', 'docs', 'i18n-ar-rules.png') });
  await p.selectOption('#lang-pick', 'en'); await p.waitForTimeout(2200); ok(await attr(p, 'dir') === 'ltr' && !(await p.$('#i18n-legal')), 'back to English: ltr, no summary');
  ok(!p.errs.length, 'no JS errors while switching', p.errs.join(' | '));
  for (const [loc, want, m] of [['zh-TW', 'zh-TW', 'zh-TW -> Traditional Chinese'], ['zh-CN', 'zh-CN', 'zh-CN -> Simplified'], ['he-IL', 'he', 'Hebrew detected'], ['tl-PH', 'fil', 'Tagalog -> Filipino'], ['sv-SE', 'en', 'unsupported language falls back to English']]) {
    p = await page(loc); await p.goto(BASE + '/'); await p.waitForTimeout(1300); ok(await attr(p, 'lang') === want, m); if (want === 'he') ok(await attr(p, 'dir') === 'rtl', 'Hebrew -> rtl'); }
  p = await page('ja-JP'); await p.goto(BASE + '/'); await p.waitForTimeout(1300); ok(await p.evaluate(() => window.HubI18n && window.HubI18n.t('Score') === 'スコア'), 'game HUDs can use window.HubI18n.t()');
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

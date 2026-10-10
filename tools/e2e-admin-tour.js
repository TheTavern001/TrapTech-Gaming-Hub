// v7 Phase 8: open every admin section, assert it renders a heading and throws no JS errors. node tools/e2e-admin-tour.js
const { chromium } = require('playwright-core'); const BASE = process.env.BASE || 'http://localhost:8787';
const AU = require('./admin-auth'); const AP = '/' + AU.loadEnv().ADMIN_PATH;
let pass = 0, fail = 0; const ok = (c, m, x) => { if (c) { pass++; console.log('  PASS', m); } else { fail++; console.log('  FAIL', m, x || ''); } };
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/usr/bin/google-chrome', args: ['--no-sandbox'] }); const a = await b.newPage({ viewport: { width: 1366, height: 900 } });
  const errs = []; a.on('pageerror', e => errs.push(e.message)); a.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await a.goto(BASE + AP + '/'); await a.waitForSelector('#un'); ok(await AU.browserLogin(a, BASE), 'admin signs in'); await a.waitForSelector('.stats');
  const links = (await a.$$eval('.side a[href]', xs => [...new Set(xs.map(x => x.getAttribute('href')))])).filter(h => h.startsWith(AP)); ok(links.length >= 20, `sidebar has ${links.length} sections`);
  const keys = links.map(h => h.split('/').pop()); ok(new Set(keys).size === keys.length, 'no two sidebar entries share a route', keys.join(','));
  for (const h of links) { errs.length = 0; await a.goto(BASE + h); await a.waitForTimeout(900);
    const t = await a.$eval('.ahead h1', x => x.textContent).catch(() => ''); ok(t && !errs.length, `${h.replace(AP, '')} -> "${t}"`, errs.join(' | ')); }
  errs.length = 0; await a.goto(BASE + AP + '/official'); await a.waitForTimeout(900); ok((await a.textContent('.amain')).includes('Official events'), 'official events page lists events');
  await b.close(); console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });

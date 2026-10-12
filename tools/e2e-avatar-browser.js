// Avatar editor browser acceptance: mobile viewport, WebGL controls/fallback, and saved looks.
// Requires the isolated test Hub and Playwright/Chrome. No external paid services are used.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const username = 'avatar_ui_' + Date.now().toString(36);
  const signup = await fetch(BASE + '/api/auth/signup', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'test-avatar-password-123', agree: true, dob: '1990-05-05' })
  });
  assert.equal(signup.status, 200, 'test player account should be created');
  const cookies = signup.headers.getSetCookie().map(raw => {
    const pair = raw.split(';', 1)[0]; const i = pair.indexOf('=');
    return { name: pair.slice(0, i), value: pair.slice(i + 1), url: BASE, sameSite: 'Lax' };
  });
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-webgl'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addCookies(cookies);
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*4\d\d|cdn\.jsdelivr\.net|dynamically imported module/i.test(m.text())) errors.push(m.text()); });
  try {
    await page.goto(BASE + '/avatar', { waitUntil: 'networkidle' });
    await page.locator('#av-look-name').waitFor({ timeout: 15000 });
    assert.ok(await page.isVisible('#av-randomize'), 'randomize-owned-parts control is visible');
    await page.click('#av-randomize');
    await page.click('#av-reset-base');
    if (await page.isVisible('#av-zoom-in')) {
      await page.click('#av-zoom-in'); await page.click('#av-zoom-out'); await page.click('#av-view-reset');
      await page.locator('#avatar-stage canvas').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('0');
    } else {
      assert.ok(await page.isVisible('#av-prev'), 'SVG fallback is visible when WebGL/CDN is unavailable');
    }
    await page.fill('#av-look-name', 'Mobile Test Look');
    await page.click('#av-look-save');
    await page.locator('#av-look-select option:has-text("Mobile Test Look")').waitFor({ timeout: 10000 });
    await page.locator('#av-look-select').selectOption({ label: 'Mobile Test Look' });
    await page.click('#av-look-apply');
    await page.waitForFunction(() => (document.querySelector('#av-msg')?.textContent || '').includes('Saved look applied'));
    await page.locator('#av-look-select').selectOption({ label: 'Mobile Test Look' });
    await page.click('#av-look-delete');
    await page.waitForFunction(() => document.querySelectorAll('#av-look-select option').length === 1);
    assert.deepEqual(errors, [], 'avatar editor should not produce browser errors');
    console.log(JSON.stringify({ ok: true, viewport: '390x844', randomize: true, resetBase: true, savedLooks: true, webgl: await page.isVisible('#avatar-stage canvas'), consoleErrors: errors }, null, 2));
  } finally {
    await context.close(); await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

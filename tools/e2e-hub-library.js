// Hub + Games Library navigation regression. Requires a running test Hub and Google Chrome.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    try { localStorage.setItem('gh_age_ok', String(Date.now())); sessionStorage.setItem('gh_age_ok', '1'); } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*4\d\d/.test(m.text())) errors.push(m.text()); });
  try {
    await page.goto(BASE + '/games', { waitUntil: 'networkidle' });
    await page.locator('a[href="/games-lib/index.html"]').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => {
      const el = document.getElementById('lib-count');
      return el && /\d+ library games/.test(el.textContent || '');
    }, null, { timeout: 15000 });
    const count = await page.locator('#lib-count').textContent();
    assert.match(count, /100 library games/, 'main Hub live library count should be 100');
    await page.locator('a[href="/games-lib/index.html"]').click();
    await page.locator('#lib-title').waitFor({ timeout: 10000 });
    await page.waitForFunction(() => Number(document.getElementById('total')?.textContent || 0) >= 100, null, { timeout: 15000 });
    const combinedTotal = Number(await page.locator('#total').textContent());
    assert.ok(combinedTotal >= 100, `combined library + core catalog should include at least 100 games; got ${combinedTotal}`);
    assert.equal(await page.locator('#new-grid .new-card').count(), 2, 'both new originals should be spotlighted');
    await page.locator('#q').fill('Neon Circuit');
    assert.equal(await page.locator('#list .card').count(), 1, 'search should filter to Neon Circuit');
    assert.match(await page.locator('#list').innerText(), /Neon Circuit/);
    await page.locator('#q').fill('');
    await page.locator('#eligibility').selectOption('giveaway');
    assert.ok(Number((await page.locator('#result-count').innerText()).match(/Showing (\d+)/)?.[1]) > 0, 'giveaway filter should render results');
    await page.locator('#eligibility').selectOption('all');
    await page.locator('.new-card[href="/games-lib/neon-circuit/index.html"]').click();
    await page.waitForFunction(() => window.__GL && window.__GL.g, null, { timeout: 15000 });
    let forwardedEvent = null;
    await page.route('**/api/run/start', async route => {
      const body = route.request().postDataJSON();
      forwardedEvent = body && body.event;
      await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'synthetic invalid-event check' }) });
    });
    await page.goto(BASE + '/games-lib/neon-circuit/index.html?event=TT-ABCDE', { waitUntil: 'load' });
    await page.waitForFunction(() => window.__GL && window.__GL.g, null, { timeout: 10000 });
    await page.evaluate(() => { const canvas = document.querySelector('canvas'); const r = canvas.getBoundingClientRect(); const init = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, pointerId: 1, pointerType: 'mouse', isPrimary: true }; canvas.dispatchEvent(new PointerEvent('pointerdown', init)); canvas.dispatchEvent(new PointerEvent('pointerup', init)); });
    await page.waitForFunction(() => window.__GL.state === 'play', null, { timeout: 10000 });
    await page.waitForFunction(() => window.__GL.g && window.Hub && window.Hub.id === 'gl-neon-circuit' && window.Hub.err, null, { timeout: 5000 }).catch(() => {});
    assert.equal(forwardedEvent, 'TT-ABCDE', 'library adapter should forward the event reference for server-side validation');
    assert.deepEqual(errors, [], 'no browser console/page errors during Hub -> library -> game navigation');
    // Authenticated mobile avatar editor acceptance: keep this in the same Chrome job as Hub navigation.
    const avatarUser = 'avatar_browser_' + Date.now().toString(36);
    const signup = await fetch(BASE + '/api/auth/signup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: avatarUser, password: 'test-avatar-password-123', agree: true, dob: '1990-05-05' }) });
    assert.equal(signup.status, 200, 'avatar browser test account should be created');
    await context.addCookies(signup.headers.getSetCookie().map(raw => { const pair = raw.split(';', 1)[0]; const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: BASE, sameSite: 'Lax' }; }));
    const avatarPage = await context.newPage(); const avatarErrors = [];
    avatarPage.on('pageerror', e => avatarErrors.push(e.message));
    avatarPage.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*4\d\d|cdn\.jsdelivr\.net|dynamically imported module/i.test(m.text())) avatarErrors.push(m.text()); });
    await avatarPage.goto(BASE + '/avatar', { waitUntil: 'networkidle' });
    await avatarPage.locator('#av-look-name').waitFor({ timeout: 15000 });
    assert.ok(await avatarPage.isVisible('#av-randomize'), 'avatar randomize control is visible on mobile');
    await avatarPage.click('#av-randomize'); await avatarPage.click('#av-reset-base');
    if (await avatarPage.isVisible('#av-zoom-in')) {
      await avatarPage.click('#av-zoom-in'); await avatarPage.click('#av-zoom-out'); await avatarPage.click('#av-view-reset');
      await avatarPage.locator('#avatar-stage canvas').focus(); await avatarPage.keyboard.press('ArrowRight'); await avatarPage.keyboard.press('0');
    } else assert.ok(await avatarPage.isVisible('#av-prev'), 'SVG fallback is visible when WebGL is unavailable');
    await avatarPage.fill('#av-look-name', 'Mobile Test Look'); await avatarPage.click('#av-look-save');
    await avatarPage.locator('#av-look-select option:has-text("Mobile Test Look")').waitFor({ timeout: 10000 });
    await avatarPage.locator('#av-look-select').selectOption({ label: 'Mobile Test Look' }); await avatarPage.click('#av-look-apply');
    await avatarPage.waitForFunction(() => (document.querySelector('#av-msg')?.textContent || '').includes('Saved look applied'));
    await avatarPage.locator('#av-look-select').selectOption({ label: 'Mobile Test Look' }); await avatarPage.click('#av-look-delete');
    await avatarPage.waitForFunction(() => document.querySelectorAll('#av-look-select option').length === 1);
    assert.deepEqual(avatarErrors, [], 'avatar editor has no unexpected browser errors');
    await avatarPage.close();
    console.log(JSON.stringify({ ok: true, libraryCount: count, spotlightCards: 2, search: 'passed', statusFilter: 'passed', launch: 'Neon Circuit runtime initialized', consoleErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

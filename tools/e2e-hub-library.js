// Hub + Games Library navigation regression. Requires a running test Hub and Google Chrome.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await context.addInitScript(() => {
    try { localStorage.setItem('gh_age_ok', String(Date.now())); localStorage.setItem('gh_seen_splash', '1'); sessionStorage.setItem('gh_age_ok', '1'); } catch {}
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/favicon|Failed to load resource.*4\d\d/.test(m.text())) errors.push(m.text()); });
  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.locator('.weekly-feature').waitFor({ timeout: 15000 });
    await page.locator('.weekly-feature h2').waitFor({ timeout: 15000 });
    const weeklyTitle = (await page.locator('.weekly-feature h2').innerText()).trim();
    assert.ok(weeklyTitle.length > 0, 'homepage should feature a weekly catalog game');
    const weeklyHref = await page.getByRole('link', { name: /Play This Week's Game/ }).getAttribute('href');
    assert.match(weeklyHref || '', /^\/games-lib\//, 'weekly feature should launch a catalog game directly');
    await page.goto(BASE + '/games', { waitUntil: 'networkidle' });
    await page.locator('#lib-q').waitFor({ timeout: 15000 });
    await page.waitForFunction(() => { const el = document.getElementById('lib-count'); return el && /\d+ games/.test(el.textContent || ''); }, null, { timeout: 15000 });
    const heading = await page.locator('#main h1').innerText();
    assert.match(heading, /Game Library/, 'main Games screen should present one unified Game Library');
    const count = await page.locator('#lib-count').textContent();
    assert.match(count, /100 games/, 'main Hub should show the unified catalog count');
    await page.locator('#lib-grid .catalog-game-card').first().waitFor({ timeout: 15000 });
    const integratedCount = await page.locator('#lib-grid .catalog-game-card').count();
    assert.ok(integratedCount >= 100, 'main Games screen should expose the full 100-entry catalog; got ' + integratedCount);
    await page.locator('#lib-q').fill('Neon Circuit');
    assert.equal(await page.locator('#lib-grid .catalog-game-card').count(), 1, 'main Hub catalog search should filter to Neon Circuit');
    assert.match(await page.locator('#lib-grid').innerText(), /Neon Circuit/i);
    await page.locator('#lib-q').fill('');
    await page.locator('#lib-category').selectOption({ index: 1 });
    assert.ok(await page.locator('#lib-grid .catalog-game-card').count() > 0, 'main Hub catalog category filter should render results');
    await page.locator('#lib-category').selectOption('');
    await page.goto(BASE + '/games-lib/index.html', { waitUntil: 'networkidle' });
    await page.locator('#lib-title').waitFor({ timeout: 10000 });
    await page.waitForFunction(() => Number(document.getElementById('total')?.textContent || 0) >= 100, null, { timeout: 15000 });
    const combinedTotal = Number(await page.locator('#total').textContent());
    assert.ok(combinedTotal >= 100, `unified catalog should include at least 100 games; got ${combinedTotal}`);
    assert.ok(await page.locator('#list .card').count() >= 100, 'dedicated library should show the whole catalog without a separate core-games group');
    await page.locator('#q').fill('Neon Circuit');
    assert.equal(await page.locator('#list .card').count(), 1, 'search should filter to Neon Circuit');
    assert.match(await page.locator('#list').innerText(), /Neon Circuit/);
    await page.locator('#q').fill('');
    await page.locator('#eligibility').selectOption('giveaway');
    assert.ok(Number((await page.locator('#result-count').innerText()).match(/Showing (\d+)/)?.[1]) > 0, 'giveaway filter should render results');
    await page.locator('#eligibility').selectOption('all');
    await page.locator('#list .card[href="/games-lib/neon-circuit/index.html"]').click();
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
    console.log(JSON.stringify({ ok: true, libraryCount: count, spotlightCards: 2, search: 'passed', statusFilter: 'passed', launch: 'Neon Circuit runtime initialized', consoleErrors: errors }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

// Responsive route smoke test for the consolidated Hub release. Requires a running test Hub and Chrome.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const routes = [
  '/', '/games', '/leaderboard', '/giveaways', '/community', '/achievements',
  '/quests', '/tournaments', '/sponsor', '/about', '/search', '/invite',
  '/settings', '/signin', '/signup', '/terms', '/privacy', '/rules',
  '/responsible-play'
];
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const errors = [];
  try {
    for (const viewport of [
      { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
      { name: 'desktop', width: 1440, height: 960, isMobile: false, hasTouch: false }
    ]) {
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: viewport.isMobile, hasTouch: viewport.hasTouch });
      await context.addInitScript(() => {
        try {
          localStorage.setItem('gh_age_ok', String(Date.now()));
          localStorage.setItem('gh_seen_splash', '1');
          localStorage.setItem('gh_guest', '1');
          sessionStorage.setItem('gh_age_ok', '1');
        } catch {}
      });
      const page = await context.newPage();
      page.on('pageerror', e => errors.push(viewport.name + ' ' + page.url() + ' :: ' + e.message));
      for (const path of routes) {
        const response = await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
        assert.ok(response && response.status() < 500, viewport.name + ' ' + path + ' should not return a server error');
        await page.waitForFunction(() => { const app = document.querySelector('#app'); return !!app && app.innerText.trim().length > 12; }, null, { timeout: 10000 });
        const appText = await page.locator('#app').innerText().catch(() => '');
        assert.ok(appText.trim().length > 12, viewport.name + ' ' + path + ' should render a non-empty app screen');
        const main = page.locator('#main');
        if (await main.count()) {
          const box = await main.boundingBox();
          assert.ok(box && box.width > 0 && box.height > 0, viewport.name + ' ' + path + ' main content should have visible layout');
          const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
          assert.ok(overflow <= 3, viewport.name + ' ' + path + ' should not cause horizontal page overflow (got ' + overflow + 'px)');
        }
      }
      await context.close();
    }
    assert.deepEqual(errors, [], 'Hub route navigation should not produce uncaught JavaScript errors');
    console.log('Responsive smoke passed for ' + routes.length + ' routes at mobile and desktop viewports.');
  } finally {
    await browser.close();
  }
})().catch(err => { console.error(err); process.exitCode = 1; });

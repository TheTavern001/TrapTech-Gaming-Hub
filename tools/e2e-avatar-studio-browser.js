// Browser regression for the actual 3D Avatar Studio. Requires a running test Hub and Playwright Chrome.
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  try {
    await context.addInitScript(() => {
      localStorage.setItem('gh_age_ok', String(Date.now()));
      localStorage.setItem('gh_seen_splash', '1');
    });
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#app');
    const signup = await page.evaluate(async () => {
      const stamp = Math.random().toString(36).slice(2, 9);
      const res = await fetch('/api/auth/signup', { method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:'av3d_'+stamp,password:'avatar-test-password',agree:true,dob:'1990-05-05'}) });
      return { status:res.status, body:await res.json() };
    });
    assert.ok(signup.status === 200 && signup.body.ok, 'test player signup should create a session');
    await page.goto(BASE + '/avatar', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.avatar-collect-card', { timeout: 15000 });
    await page.waitForFunction(() => {
      const c = document.querySelector('#avatar-3d-preview');
      return !!c && c.dataset.ready === 'true';
    }, null, { timeout: 30000 });
    const result = await page.evaluate(() => {
      const c = document.querySelector('#avatar-3d-preview');
      const card = document.querySelector('.avatar-collect-card');
      return { width:c.width,height:c.height,ready:c.dataset.ready,cardText:card.innerText,canvasData:c.toDataURL().length };
    });
    assert.ok(result.width > 100 && result.height > 100, '3D avatar canvas should render at real resolution');
    assert.ok(result.canvasData > 1000, '3D avatar canvas should contain rendered pixels');
    assert.match(result.cardText, /PLAYER CARD/);
    assert.deepEqual(errors, [], 'Avatar Studio should not produce uncaught JavaScript errors');
    console.log('3D Avatar Studio browser regression passed:', JSON.stringify({ width:result.width,height:result.height,canvasData:result.canvasData }));
  } finally { await context.close(); await browser.close(); }
})().catch(err => { console.error(err); process.exitCode = 1; });

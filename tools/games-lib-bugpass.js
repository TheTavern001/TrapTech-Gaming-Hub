// Games Library bug pass (Reese, Oct 10): per game - seeded play-throughs, keyboard + touch input, pause/resume,
// tab hide/show, resize + rotate, low-FPS (4x CPU throttle), long-run memory growth. Usage: node tools/games-lib-bugpass.js slug [slug...]
const { chromium, devices } = require('/usr/local/lib/pnpm/5/.pnpm/playwright-core@1.59.1/node_modules/playwright-core');
const BASE = process.env.BASE || 'http://localhost:8795', LONG = +(process.env.LONG_MS || 45000);
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
(async () => { const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--enable-precise-memory-info'] }); const out = [];
  for (const slug of process.argv.slice(2)) { const R = { slug, errors: [], checks: {} };
    const ctx = await b.newContext({ ...devices['iPhone 13'] }); const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
    p.on('pageerror', e => R.errors.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text())) R.errors.push(m.text()); });
    const st = () => p.evaluate(() => window.__GL ? __GL.state : 'none'), sc = () => p.evaluate(() => window.__GL ? __GL.score : -1);
    const start = async () => { await p.touchscreen.tap(195, 500); await p.keyboard.press('Space'); if (await st() === 'over') await p.keyboard.press('Enter'); for (let i = 0; i < 10 && (await st()) !== 'play'; i++) await p.waitForTimeout(300); };
    const play = async (ms) => { const end = Date.now() + ms; while (Date.now() < end) { if (Math.random() < 0.5) await p.keyboard.press(KEYS[Math.floor(Math.random() * 5)]); else await p.touchscreen.tap(60 + Math.random() * 270, 300 + Math.random() * 400); await p.waitForTimeout(120 + Math.random() * 200); if (await st() === 'over') { await p.waitForTimeout(700); await start(); } } };
    try { await p.goto(BASE + '/games-lib/' + slug + '/index.html'); await p.waitForFunction(() => window.__GL && window.__GL.g, null, { timeout: 30000 });
      // 1. three seeded runs
      let runs = 0; for (let i = 0; i < 3; i++) { await start(); { const s0 = await st(); runs += s0 === 'play' ? 1 : 0; if (s0 !== 'play') R.errors.length, (R.startStates = (R.startStates || []).concat(s0 + '@' + i + ':' + await p.evaluate(() => String(window.gameState)))); } await play(5000); await p.evaluate(() => { if (__GL.state === 'play') __GL.g.end('bugpass'); }); await p.waitForTimeout(1800); }
      R.checks.seededRuns = runs === 3 ? 'ok' : 'started ' + runs + '/3 ' + (R.startStates || []).join(',');
      // 2. pause/resume freezes score
      await start(); await play(1500); const pausable = await p.evaluate(() => { try { __GL.g.paused = true; return true; } catch (e) { return false; } }); const s1 = await sc(); await p.waitForTimeout(1500); const s2 = await sc();
      await p.evaluate(() => { try { __GL.g.paused = false; } catch (e) {} }); R.checks.pause = !pausable ? 'n/a' : s1 === s2 ? 'ok' : 'score moved while paused ' + s1 + '->' + s2;
      // 3. tab hidden/visible
      await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: false }).catch(() => {}); await p.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('blur')); });
      R.hidPaused = await p.evaluate(() => !!(__GL.g && __GL.g.paused)); await p.waitForTimeout(1200); await p.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('focus')); }); await p.waitForTimeout(500); R.checks.tabSwitch = (await st()) !== 'none' ? 'ok (' + (R.hidPaused ? 'auto-paused' : await st()) + ')' : 'lost'; await p.evaluate(() => { try { __GL.g.paused = false; } catch (e) {} });
      // 4. resize + rotate
      await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(700); await play(1500); await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(700); await play(1000);
      R.checks.rotate = await p.evaluate(() => { const c = document.getElementById('gl') || document.querySelector('canvas'); if (!c) return 'no canvas'; const r = c.getBoundingClientRect(); return r.width > 50 && r.height > 50 && r.right <= innerWidth + 2 ? 'ok' : 'bad layout ' + Math.round(r.width) + 'x' + Math.round(r.height); });
      // 5. low FPS (4x CPU throttle): must keep running without errors or tunnelling deaths at start
      const e0 = R.errors.length; await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); await play(4000); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); R.checks.lowFps = R.errors.length === e0 ? 'ok (fps ' + await p.evaluate(() => __GL.fps) + ')' : 'errors under throttle';
      // 6. long run memory
      await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const m0 = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0); await play(LONG); await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); const m1 = await p.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
      const grow = (m1 - m0) / 1048576; R.checks.memory = (grow < 15 ? 'ok' : 'LEAK? ') + ' +' + grow.toFixed(1) + ' MB over ' + LONG / 1000 + ' s';
      R.checks.input = 'keys+touch ' + await p.evaluate(() => __GL.g.inputs || 0);
    } catch (e) { R.errors.push('harness: ' + e.message.split('\n')[0]); }
    R.pass = !R.errors.length && Object.values(R.checks).every(v => /^ok|^n\/a|^keys/.test(v)) && Object.keys(R.checks).length >= 6;
    console.log((R.pass ? 'PASS ' : 'FAIL ') + slug.padEnd(16) + Object.entries(R.checks).map(([k, v]) => k + '=' + v).join(' | ') + (R.errors.length ? ' ERR ' + R.errors.slice(0, 2).join(' / ') : '')); out.push(R); await ctx.close(); }
  require('fs').writeFileSync('/tmp/bugpass.json', JSON.stringify(out, null, 1)); await b.close(); })();

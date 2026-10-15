# 87-game browser smoke — evidence gathering, never automatic AAA certification

This is an optional, zero-GitHub-Actions QA tool. It visits all 87 current playable games: 13 core Hub routes (`/play/<id>`) and 74 library routes. The other six titles are archived duplicates. The runner detects HTML failures, JavaScript exceptions, local asset HTTP errors, horizontal overflow and Kit engine p95 frame time when available, then generates screenshots for failed titles (or all with `QA_ALL_SCREENSHOTS=1`).

**Run on a machine with Node.js 20+, Chrome/Chromium and Playwright.** The production Docker container intentionally does not include Chromium. A local smoke against an isolated, disposable Hub server is preferred. Do not point these tests at public/paid prize events.

```bash
npm install --no-save --no-package-lock playwright
npx playwright install chromium
BASE=http://127.0.0.1:8787 QA_REQUIRE_LOGIN=0 npm run qa:87:browser
```

To test against owner-only private review with existing reviewer authorization, **do not store your real credentials in GitHub or chat**. Choose the existing login interactively with a headed browser:

```bash
BASE=https://glassy-drifter-9532.de.deplexo.com QA_INTERACTIVE_AUTH=1 QA_HEADLESS=0 npm run qa:87:browser
```

Or supply `QA_STORAGE_STATE=/path/outside/repository/reviewer-state.json`. The runner blocks `/api/score` writes and common checkout/order endpoints. Starting a signed game may still create a server-side test-run record; for a zero-mutation check, use an isolated local server. Screenshots and session state are placed in an OS temp directory by default (override `QA_REPORT_DIR` to another **private** directory). Do not commit reviewer session state or account screenshots.

To sample simulated WebKit in a separate smoke run:

```bash
npx playwright install webkit
BROWSER_ENGINE=webkit BASE=http://127.0.0.1:8787 QA_REQUIRE_LOGIN=0 npm run qa:87:browser
```

**Limitations:** Chromium Pixel viewport and Playwright WebKit emulation are **not physical Android Chrome/WebView or physical iPhone Safari/WKWebView**. Page load plus five seconds of frames does not certify whole-run scoring, collisions, visuals, license rights, 60fps on midrange hardware or server replay. A run with missing `window.__GL` FPS data must be reviewed on a device, not marked as performant. A green report is a source/browser smoke result, **AAA certified remains zero** until documented device, appearance, physics and anti-cheat reviews per title in `docs/audit/GAME-QUALITY-ACCEPTANCE.json`.

Do not turn this smoke test into a production image build command; Chromium would exceed the existing Deplexo free-container memory budget. Run it against a staging/private instance or the existing password-protected preview.


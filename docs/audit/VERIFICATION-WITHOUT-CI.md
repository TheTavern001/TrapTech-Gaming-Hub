# Verification without hosted CI status

This workflow verifies the checked-out code directly. It does not require a hosted CI status badge.

## 1. Static repository checks

Run from the repository root with Node.js 20+ installed:

```sh
npm ci
npm run verify:prelaunch
```

The command syntax-checks JavaScript across server, tools, core games, and Games Library files; validates package/manifest JSON; verifies that all core game registrations point to files; checks every library entry and its referenced local assets; and validates the Trap Tech app-icon route and manifest declarations. It then writes `docs/audit/prelaunch-structural-audit.json`.

The Docker build also starts the actual server with disposable test-only credentials and a temporary database, then runs the read-only HTTP verifier against it before the image can finish building. This catches startup, health, build-fingerprint, icon route, stylesheet, core-module and all 100 library-page failures inside the build itself.

A structural/runtime HTTP pass is not a visual/gameplay pass.

## 2. Server/API checks

Configure a local test `.env` using `.env.example` and test-only credentials. Do not copy production secrets into a test environment.

```sh
npm test
```

## 3. Core games on desktop and mobile

With the local server running and Chrome available:

```sh
npm run test:mobile
```

The regression list includes all 16 registered core games at a desktop-sized viewport using mouse input and across the supported emulated phone/in-app-browser profiles. Inspect the generated screenshots and JSON evidence; fix any failing game before marking it passed.

## 4. All 100 Games Library titles

With the local test server running and Chrome/Playwright available:

```sh
npm run test:games-lib-batches
```

This runs sequential batches of ten, continues after a failed batch, and returns a final list of batch exit codes. To change batch size for diagnosis, set `BATCH_SIZE=5`. Each game's E2E test checks runtime initialization, browser errors, input/play behavior, score submission, forged-score rejection, and desktop/mobile rendering. Review each per-game report and screenshot rather than relying only on the batch exit code.

## 5. Live deployment checks

The read-only live verifier compares the deployed fingerprint with the checkout, checks health/build metadata, confirms the icon artwork and PNG dimensions, and requests all core modules and all 100 library entry pages:

```sh
BASE=https://your-deployment.example npm run verify:live
```

The `/api/build` response includes `build_fingerprint`, computed from every shipped file under `src/` and `public/`, including all game code, textures, sounds, avatars, shop assets, stylesheets and icon artwork. A mismatch means the live deployment does not match this checkout.

After deployment, verify the deployed build—not just the GitHub source:

- `/healthz` responds successfully.
- `/api/build` identifies the expected commit.
- `/games` and `/games-lib/index.html` load.
- The canonical SVG icon and each manifest PNG route return image content with the correct content type and dimensions.
- Start one core game and one library game; pause/resume, restart, end a run, and return to the Hub.
- Check browser console/network failures and confirm score acceptance plus forged-score rejection.

If the hosting dashboard does not expose shell access, use a local browser test against the deployed `BASE` URL. A blocked external inspection is **unknown**, not proof of success or failure.

## Release policy

Every game remains **BLOCKED** until its own runtime evidence, visual review, mobile interaction, scoring integrity, and fixes are recorded. Do not label a game AAA-ready solely because static checks pass.

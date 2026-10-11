# The Gaming Hub v7: handoff

The Gaming Hub by Trap Tech Solutions, v7. This covers what changed, how to set it up on Deplexo, and how to check it.
Deploy steps are in **FINALIZE.md**. Host details and backups are in **DEPLOY-DEPLEXO.md**. Phase-by-phase proof is in **PROGRESS-V7.md**.

## What v7 adds
- **Games:** 13 skill games, all of them giveaway-eligible. The chance games (Plinko, Spin to Win, Blazed Roulette) are retired. Their old URLs now point to Stack. The Games Library (`/games-lib/`) is a separate workstream.
- **Anti-cheat levels 1-4** (`docs/ANTI-CHEAT.md`): obvious-max caps; session/rate checks; validation of the event log; deterministic server replay.
- **Official events vs free play:** an admin creates an official event with a private code, the vendor/prize and the booking/payment status. A run only counts for the event when it is started with a short-lived signed event-run token. Event boards are separate from the free-play boards. A run submitted after the event ends goes to free play, so the score is kept.
- **Skill-only tie-breaks** for every game: (1) the shorter server-timed run to the same score, (2) the game's skill metric from the validated event log (`src/games-lib-playoff.js`), (3) a sudden-death seeded playoff that the admin runs from *Admin > Official events*. A place still tied exactly cannot be confirmed until the playoff is resolved. First-to-score, fewest attempts and submission time are no longer used anywhere.
- **Booking flow:** the sponsor form takes the prize, brand colour, length, games, competition type, dates and notes. The admin builds a quote from the price sheet. An accepted quote becomes an official event in one click. The vendor's quote page then shows the event code and a QR code.
- **Hub Store (cosmetic only), with Bitcoin plus a gated Stripe Checkout candidate:** Crown packs, the Season Pass and three limited, serial-numbered Prestige items. Nothing in the store affects scores or giveaways (`tools/e2e-payments.js` checks this). Stripe mode must pass its own integration tests; sponsor booking invoices are not yet charged through Stripe. Players can also earn next season's pass for free with a 48-quest chain (`docs/PASS-QUESTS.md`).
- **Avatars:** server-rendered SVG avatars built from 12 part kinds and 70+ parts (free, Crowns, earned through achievements, Prestige-only). The editor is at `/avatar`. Avatars appear on every board, profile and winner list.
- **Shop rotation and timers:** daily, weekly and event sections with ET midnight resets. The DST bug is fixed: the Nov 1 reset used to fire at 01:00 ET.
- **Brand (final, Reese Oct 10):** the Trap Tech logo is a white angular double-T with a gold metallic crown (source: `brand-src/traptech-v7/logo-final.jpg`). It is rebuilt as vector SVG by `tools/build-brand-tt.py` (mark, horizontal and stacked lockups with TRAP TECH / gold SOLUTIONS in the site's Orbitron font, badge). `tools/build-brand-tt.js` exports PNG/WebP at several sizes, plus favicons (32/48/180/192/512) and maskable PWA icons (`tt-maskable-*.png`). It is used in the header, About, footer, splash, age gate, boot screen, admin (sidebar, sign-in, favicon), OG images and default brand logos. The earlier flyer crown-shield art and the v3 mark are kept only in `brand-src/` and git history. The public site's favicon and PWA icon are still The Gaming Hub's own controller mark (the hub is the product; Trap Tech is the maker). To switch them to the TT icons, point `public/index.html` and `manifest.webmanifest` at `tt-favicon.svg` / `tt-favicon-192.png` / `tt-maskable-512.png`.
- **Languages:** English plus 21 machine-translated languages, with a picker, browser auto-detection and RTL for Arabic and Hebrew. Only the shared interface strings are translated so far (~65: navigation, splash, footer, common buttons, store/avatar labels, game HUD words via `window.HubI18n.t`). Page-specific body copy is still English. Add strings to `tools/i18n/strings.tsv` and run `python3 tools/i18n/build.py`. Legal pages stay English-authoritative, with a translated summary and a note.
- **Admin:** Store & orders, Official events (share kit, tie report, playoffs), "Create official event" on quotes. Every section is checked by `tools/e2e-admin-tour.js`.

## Bitcoin checkout: how it works and setup
- Payments go to **one fixed address** (`BTC_ADDRESS`). The server holds no private keys and no xpub.
- Each order gets a unique exact amount: the USD price converted at checkout, plus a random offset of 1-999 sats that no other open order is using. The quote expires after 45 minutes.
- The server checks `mempool.space` (`BTC_EXPLORER_URL` can override it). A payment matches an order when an incoming transaction pays exactly that amount, arrives after the order was created and has not already been claimed. The txid is stored so it can't be claimed twice. Buyers see a QR code (`bitcoin:ADDRESS?amount=X`) and copy buttons, and can paste their txid to speed up matching.
- **Confirmations:** orders under $200 are granted at 1 confirmation, orders of $200 or more at 3, and Prestige items at 6. Underpayment, overpayment and expiry are flagged for the admin. In *Admin > Store & orders* the admin can verify, grant or refund an order, grant Crowns, edit prices and turn checkout on or off.
- **Checkout stays disabled until `BTC_ADDRESS` is set.** The address is validated (base58check / bech32 checksum) at boot.
- **Value to set on Deplexo:** `BTC_ADDRESS=32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB` (Reese's P2SH receiving address. It is public, not a secret.)
- **Test it live** with the cheapest Crown pack. Pay the exact amount shown, watch the order go from *seen* to *paid* to *granted*, and check that the order's txid matches your wallet.
- Refunds are manual. Send the BTC back from your wallet, then mark the order *refunded* in admin. This takes back the granted item.
- Tests use a mocked explorer only. No real transactions were made.
- **Stripe status / policy gate:** hosted Checkout and signed webhooks are present for cosmetic store products, with an isolated `tools/e2e-stripe.js` harness. Test-mode technical integration is not processor approval. Stripe's current restricted-business policy lists skill-game competitions with material prizes, sweepstakes/contests, and certain marijuana-related businesses; those overlap with the Hub's giveaway and intended brand model. Do not process live payments unless Stripe confirms in writing that it approves this exact business model. See [Stripe restricted businesses](https://stripe.com/legal/restricted-businesses) and [the Stripe FAQ](https://support.stripe.com/questions/prohibited-and-restricted-business-list-faqs). Live mode is additionally locked behind `STRIPE_LIVE_CHECKOUT_ENABLED=1`; Stripe itself remains off unless `STRIPE_CHECKOUT_ENABLED=1` and the separate admin checkout switch is enabled.
- **Android payment policy:** before selling digital items inside a Play Store version, review the current Play billing rules. Web Stripe checkout should not be assumed valid for digital purchases inside an Android app.

## Environment variables (Deplexo)
| Var | Required | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | yes | first owner sign-in; then set up the authenticator |
| `SECRET` | yes | 32+ random chars (or `SESSION_SECRET` + `RUN_SECRET`) |
| `ADMIN_PATH` | yes | the secret admin URL path (`/admin` is a 404) |
| `PUBLIC_URL` | recommended | e.g. `https://your-domain`; used for every absolute link, QR codes and OG tags |
| `BTC_ADDRESS` | optional | Only if owner deliberately enables Bitcoin checkout; never use an unverified address. |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | test-only first | Hosted card checkout API and signed webhook secret; never commit these values. |
| `STRIPE_CHECKOUT_ENABLED` | default off | Set to `1` in a private test environment only after Stripe keys and webhook are configured. |
| `STRIPE_LIVE_CHECKOUT_ENABLED` | default off | Must remain `0` until Stripe grants written approval for this exact business model and test-mode QA passes. |
| `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, `CLOUDFLARE_R2_BUCKET` | optional | Bucket-scoped R2 media storage credentials; use Object Read & Write on the single Hub media bucket, not a global Cloudflare token. |
| `CLOUDFLARE_R2_PUBLIC_URL` | optional | Custom HTTPS media domain; omit it to serve media via the Hub `/media` route. |
| `CANONICAL_REDIRECT` | optional | `1` sends other hostnames to `PUBLIC_URL` with a 301 |
| `BACKUP_GITHUB_REPO` / `BACKUP_GITHUB_TOKEN` | optional | off-site backups (see DEPLOY-DEPLEXO.md §5) |
| `ADMIN_RESET_TOKEN` | optional | one-time owner recovery |

## Tests
| Suite | How |
|---|---|
| Stripe | `node tools/e2e-stripe.js` (isolated local database and mocked Stripe API/webhooks; no real charges) |
| API | `tools/fresh-api.sh tools/e2e-api.js` (fresh isolated DB) and the same for `e2e-anticheat`, `e2e-events`, `e2e-tiebreak`, `e2e-avatars`; payments needs its mock explorer: `BTC_EXPLORER_URL=http://127.0.0.1:8796 BTC_PRICE_URL=http://127.0.0.1:8796/prices PAY_NO_SWEEP=1 tools/fresh-api.sh tools/e2e-payments.js`; `SEED=1 tools/fresh-api.sh tools/e2e-sponsor-brands.js` |
| Unit | `node tools/e2e-timers.js`, `node tools/e2e-economy.js` |
| Admin | `cd tools && node e2e-admin.js && node e2e-admin-sec.js && node e2e-admin-tour.js` |
| Browser | `SEED=1 tools/fresh-api.sh tools/e2e-browser.js && (cd tools && node e2e-mobile.js)` (screenshots in `docs/screens-v7/`) |
| i18n | `cd tools && node e2e-i18n.js` |
| Games Library | `cd tools && BASE=http://localhost:8787 node e2e-games-lib.js` (owned by the games-library workstream) |
| Migration / memory | `node tools/v6-migrate-check.js <db>`, `tools/mem-check.sh <db>` |

The historical candidate results are in PROGRESS-V7.md (phase 9). They are not a test report for this integration branch; rerun the relevant suites and inspect current GitHub Actions results before any release.

## Known limits / follow-ups
- **All core suites green** (Oct 10, `tools/run-all.sh`): e2e-api 374/0, anticheat 12/0, events 29/0, tiebreak 18/0, sponsor-brands 63/0, payments 32/0, avatars 13/0, timers 27/0, economy 49/0, admin 150/0, admin-sec 66/0, admin-tour 28/0, i18n 39/0, browser 202/0, mobile 176/0 (1,278 checks, 0 failures). `e2e-admin` uses `E2E_FAST=1`, `e2e-browser` runs on a fresh seeded DB (`SEED=1 tools/fresh-api.sh`).
- The checkout sweep polls mempool.space about once a minute while orders are open. If mempool.space is down, orders wait. Nothing is lost, and the admin can verify by hand.
- The BTC/USD price comes from a free API at checkout. If it's unreachable, checkout shows "try again" and never guesses a price.
- Idle RSS is ~75 MB and the measured peak is 87 MB, against the ~100 MB budget on the 128 MB plan.
- `scripts/build-assets.js` is still untracked on purpose.
- Games-library suite (other worker's): 61/62; only cloud-hopper failed, and the failure was in the test harness (its random signup username was rejected by the username filter), not in the game.


## Final consolidated release handoff — 2026-10-11

**Source of truth for this release:** the latest commit on `main`, not the older branch directions below. The current `main` history includes the v7 Hub, Games Library integrity-audit changes, Deplexo configuration fix, and the consolidated responsive homepage redesign. The current homepage redesign commit is `c98dc18935232b8c71e6cc0fce1a6512d22608b9`; any documentation-only release-finalization commit after it must also be included in the final deployment.

### Scope intended for the single final deployment
- **Full Hub, not a standalone game portal:** retain accounts, 21+ gate, profiles/avatars, leaderboards, quests/XP, achievements, tournaments, official giveaways/events, bookings/quotes, vendor/brand tools, admin controls, store/cosmetics, language picker, PWA, and the existing data migration path.
- **Games:** the 13 core skill games plus the dedicated Games Library. The current registry and public catalog reconcile at **100 library entries**. The long-term target remains **150+**. Do not represent all 100 as individually quality-certified: the library handoff records outstanding visual, physical-device performance, asset-license, and full score-integrity reviews. Only Neon Circuit and Rift Survival are added by the current integration to the new library-game giveaway picker; they still need the official event path verified on the release candidate.
- **Visual experience:** responsive homepage redesign, prominent Explore Games and Official Giveaways actions, the Trap Tech Solutions identity, improved discovery/category/search controls, game spotlights and card layouts, and mobile touch usability. Keep the established app flows; do not replace the Hub with a game-only page.
- **Giveaway controls:** a casual public game link must not itself create an official event, entrant list, booking, or prize. Hub-managed official events require authorized operator/admin setup, valid booking/approval state, and server-validated event-run tokens and scores. Vendors must not be able to create/activate official Hub competitions or administer winner selection without authorization. Software cannot stop a vendor from sharing a public link or claiming to run an off-platform contest; the enforceable boundary is official Hub records, scoring, entrants, and winner selection.
- **Brand/channel and conversion:** include the Trap Tech Solutions channel link `https://dympt.org/TrapTechSolutions` in the vendor handoff/marketing materials, alongside the deployed Hub link; keep the two distinct CTAs **PLAY THE HUB** and **BOOK A GIVEAWAY**. The live Hub should make the official booking route discoverable and direct players to the official event listings.
- **Asset rights:** do not use ripped commercial assets, logos, characters, or pirated game ports. Use original or commercially cleared alternatives; a game’s presence in the catalog is not proof of legal clearance or giveaway readiness.

### Known release gates — not to be silently marked complete
The repository's release checklist still identifies these as outstanding: full library E2E and forged/replayed-score rejection for the release candidate; full official-event path for a library game; booking-status and vendor/admin permission regression; full browser checks of auth/navigation/leaderboards/profiles/bookings/giveaways/admin; fresh mobile smoke and physical-device profiling for known performance-risk games; asset/license review; and visual inspection at desktop and phone widths. The latest homepage commit's GitHub Actions browser-smoke workflow was running when this handoff was updated. Check the exact workflow result for the final commit before launch.

### One-deployment rule
1. Finish code and documentation changes on `main` first.
2. Require the release candidate's static checks and blocking browser smoke tests to pass; separately record any non-blocking diagnostics and unresolved gates honestly.
3. Back up the production database before deployment. Preserve the existing persistent `/data` volume and secrets if retaining current accounts/data. Confirm Deplexo's `deplexo.yaml` schema and runtime environment against `DEPLOY-DEPLEXO.md`; do not copy stale config examples that use unsupported fields.
4. Deploy the **final `main` SHA once**, then verify `/healthz`, the visible homepage, game library entry/launch, auth, official event links, admin route, and persistence. Do not call the release fully live until these checks are observed.
5. Keep the rollback image and database backup available. Never put secrets, the private admin path, or authenticator recovery codes in this document.

Current deployment URL: https://glassy-drifter-9532.de.deplexo.com

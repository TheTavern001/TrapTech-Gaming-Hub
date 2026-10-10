# The Gaming Hub v7: handoff

The Gaming Hub by Trap Tech Solutions, v7. This covers what changed, how to set it up on Deplexo, and how to check it.
Deploy steps are in **FINALIZE.md**. Host details and backups are in **DEPLOY-DEPLEXO.md**. Phase-by-phase proof is in **PROGRESS-V7.md**.

## What v7 adds
- **Games:** 13 skill games, all of them giveaway-eligible. The chance games (Plinko, Spin to Win, Blazed Roulette) are retired. Their old URLs now point to Stack. The Games Library (`/games-lib/`) is a separate workstream.
- **Anti-cheat levels 1-4** (`docs/ANTI-CHEAT.md`): obvious-max caps; session/rate checks; validation of the event log; deterministic server replay.
- **Official events vs free play:** an admin creates an official event with a private code, the vendor/prize and the booking/payment status. A run only counts for the event when it is started with a short-lived signed event-run token. Event boards are separate from the free-play boards. A run submitted after the event ends goes to free play, so the score is kept.
- **Skill-only tie-breaks** for every game: (1) the shorter server-timed run to the same score, (2) the game's skill metric from the validated event log (`src/games-lib-playoff.js`), (3) a sudden-death seeded playoff that the admin runs from *Admin > Official events*. A place still tied exactly cannot be confirmed until the playoff is resolved. First-to-score, fewest attempts and submission time are no longer used anywhere.
- **Booking flow:** the sponsor form takes the prize, brand colour, length, games, competition type, dates and notes. The admin builds a quote from the price sheet. An accepted quote becomes an official event in one click. The vendor's quote page then shows the event code and a QR code.
- **Hub Store (cosmetic only), paid in Bitcoin:** Crown packs, the Season Pass and three limited, serial-numbered Prestige items. Nothing in the store affects scores or giveaways (`tools/e2e-payments.js` checks this). Players can also earn next season's pass for free with a 48-quest chain, tuned so about 5% of active players finish it (`docs/PASS-QUESTS.md`).
- **Avatars:** server-rendered SVG avatars built from 12 part kinds and 70+ parts (free, Crowns, earned through achievements, Prestige-only). The editor is at `/avatar`. Avatars appear on every board, profile and winner list.
- **Shop rotation and timers:** daily, weekly and event sections with ET midnight resets. The DST bug is fixed: the Nov 1 reset used to fire at 01:00 ET.
- **Brand:** the clean v3 Trap Tech mark (geometric double-T, TRAP TECH, spaced cyan SOLUTIONS) now has a minimal line-art crown on top. It is rebuilt as vector SVG (`tools/build-brand-tt.py`, PNG/WebP copies from `tools/build-brand-tt.js`) and used everywhere: header, About, footer, splash, admin and OG images. The flyer art stays in `brand-src/` only. The About page and landing page are refreshed.
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
- **Later:** the APIs are provider-agnostic (`store_orders.provider`), so Whop or Stripe can be added (`WHOP_WEBHOOK_SECRET` is reserved). If the site ever becomes a mobile app, Apple and Google have their own rules on crypto and in-app purchases for digital goods. Keep the store web-only, or use their billing, at that point.

## Environment variables (Deplexo)
| Var | Required | Notes |
|---|---|---|
| `ADMIN_PASSWORD` | yes | first owner sign-in; then set up the authenticator |
| `SECRET` | yes | 32+ random chars (or `SESSION_SECRET` + `RUN_SECRET`) |
| `ADMIN_PATH` | yes | the secret admin URL path (`/admin` is a 404) |
| `PUBLIC_URL` | recommended | e.g. `https://your-domain`; used for every absolute link, QR codes and OG tags |
| `BTC_ADDRESS` | for the store | `32Y22JCbcemRzTV661yqYzG1PU6tnoE2rB` |
| `CANONICAL_REDIRECT` | optional | `1` sends other hostnames to `PUBLIC_URL` with a 301 |
| `BACKUP_GITHUB_REPO` / `BACKUP_GITHUB_TOKEN` | optional | off-site backups (see DEPLOY-DEPLEXO.md §5) |
| `ADMIN_RESET_TOKEN` | optional | one-time owner recovery |

## Tests
| Suite | How |
|---|---|
| API | `tools/fresh-api.sh tools/e2e-api.js` (fresh isolated DB) and the same for `e2e-anticheat`, `e2e-events`, `e2e-tiebreak`, `e2e-avatars`; payments needs its mock explorer: `BTC_EXPLORER_URL=http://127.0.0.1:8796 BTC_PRICE_URL=http://127.0.0.1:8796/prices PAY_NO_SWEEP=1 tools/fresh-api.sh tools/e2e-payments.js`; `SEED=1 tools/fresh-api.sh tools/e2e-sponsor-brands.js` |
| Unit | `node tools/e2e-timers.js`, `node tools/e2e-economy.js` |
| Admin | `cd tools && node e2e-admin.js && node e2e-admin-sec.js && node e2e-admin-tour.js` |
| Browser | `cd tools && node e2e-browser.js && node e2e-mobile.js` (screenshots in `docs/screens-v7/`) |
| Games Library | `cd tools && BASE=http://localhost:8787 node e2e-games-lib.js` (owned by the games-library workstream) |
| Migration / memory | `node tools/v6-migrate-check.js <db>`, `tools/mem-check.sh <db>` |

The latest results are in PROGRESS-V7.md (phase 9).

## Known limits / follow-ups
- The checkout sweep polls mempool.space about once a minute while orders are open. If mempool.space is down, orders wait. Nothing is lost, and the admin can verify by hand.
- The BTC/USD price comes from a free API at checkout. If it's unreachable, checkout shows "try again" and never guesses a price.
- Idle RSS is ~75 MB and the measured peak is 87 MB, against the ~100 MB budget on the 128 MB plan.
- `scripts/build-assets.js` is still untracked on purpose.

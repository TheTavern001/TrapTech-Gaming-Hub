# Trap Tech: One Hub Credits Wallet — Migration, Payment & Security Contract

**2026-10-14 · Isolated GitHub source branch only. Deplexo auto-deployment OFF.**
Owner's last host screenshot: **278af07 CURRENT/READY**, not this working branch. This document is not evidence of a successful deployment, native receipt processing, replay-safe prize events, or public launch readiness.

## Player model (one virtual currency, not three)

**Hub Credits (HC)** are the *only* spendable currency. Players **earn them for verified play or buy optional packs**. One price/one balance/one wallet; no paid-only performance items, no item/giveaway/score boost. Credits cannot be sold, withdrawn, traded, sent to friends, gambled, or redeemed for prizes. A game may still have collectible in-level `coins`, `distance`, or `score`, but these are *statistics*, not spendable HC.

**Prestige collectibles are direct-dollar SKUs**, never an additional currency. These preview-only one-of-one $1,000–$5,000 appearances remain disabled for sale until actual model/source, mobile fit, rarity/ownership and payment-review gates pass. The Season Pass may be offered for a direct payment or earned through its quest chain; it is a cosmetic progression entitlement, not a currency.

### Legacy balances

The pre-release project previously had **Hub Points** for earning and **Hub Crowns** for optional paid packs. Keep the immutable monetary audit rows and normalize to Credits:

- 1 old Point → 1 Hub Credit.
- 1 old Crown → 10 Hub Credits.
- Prior Crown **purchases, earned pass rewards, historic cosmetic spends and refunds** are each represented by a *signed* Credits entry keyed by original `crown_ledger.id`. The mapping is idempotent by SQLite `UNIQUE(user_id,reason,ref)`, using reason `legacy-crown`. Never assume the player has no prior orders.
- **Old pack product IDs stay unchanged** for payment/order references, but their *visible names* are now 5,000 / 11,000 / 24,000 / 65,000 Credits at existing $4.99/$9.99/$19.99/$49.99 price points. They deliver precisely what those old Crown quantities represented at this conversion ratio. Do not silently increase the real-money charge.
- The old `crown_ledger` remains audit-only and is never a second spendable wallet. All new in-game cosmetic purchases (including the old `/api/crowns/buy` compatibility endpoint) use `src/shop.js:buy`, the `points_ledger` balance, an atomic inventory insert and exactly one debit.
- An eligible score earns Credits only after the server has accepted it and `held=0`. Later disqualification posts an immutable negative run-integrity adjustment; administrative clearance restores the approved amount, and repeated reviews use monotonic event references. Referrals, quests, XP and achievements no longer accept *new* held runs.
- Historical already-unlocked rewards and refunded Credits **spent on a cosmetic** still need full entitlement/debt remediation and owner policy review. **Do not call refunds, revenue reconciliation or anti-cheat fully certified.** Negative balances block new credit purchases, but must be stress-tested with charged-back entitlements and restores.

### Store and season offer

- Same rotating cosmetic item can be obtained with Credits earned **or** purchased, subject to normal item rotation/unlock restrictions.
- A fully owned cosmetic never debits twice. Buy path does not read credit origin; **paid and earned players share identical scoring RNG, geometry, hitboxes, tie-breaks and prize eligibility**.
- Season track XP is separate from Hub Credits; any prestige/paid boost may apply only to cosmetic-track XP, never gameplay XP, competition ranking, run limits, player damage or movement.
- No clan/guild currency wallets, peer-to-peer trades or unaudited referral payouts.
- Players see *Hub Credits* everywhere in shop/store/score confirmation; fallback compatibility URLs are internal only.

## Why this model

Based on vendor docs current October 2026:
- **Fortnite**: V-Bucks can be bought or earned via eligible Free/Battle Pass tracks; cosmetic-first, one understandable player balance. https://www.epicgames.com/help/c-34254770/c-39884448/hvordan-far-jeg-v-bucks-i-battle-royale-a21722612
- **Rocket League**: Credits are bought and earnable on the premium Rocket Pass; item shop and premium pass use the same recognizable balance. https://www.epicgames.com/help/c-37599050/c-Trending_0/a17019170
- **Call of Duty: Mobile**: bought CP and earned Credits exist separately; user explicitly prefers to avoid this confusion. https://support.activision.com/content/atvi/support/web/en/cod-mobile/articles/cod-points-and-loot-in-call-of-duty-mobile.html
- **Roblox**: Robux is the one recognizable purchase currency, but creator resale/withdrawal/economy features are **not** part of Trap Tech. https://en.help.roblox.com/hc/en-us/articles/203313200-Ways-to-Get-Robux

## Future Android/iOS app billing, privacy and security

**Web/PWA today:** Stripe hosted checkout and correctly confirmed Bitcoin order matching can be investigated behind admin and environment guards. Unsigned, underpaid or expired orders must not receive Credits, nor may webhook replays create duplicate entries. The old *unused Whop webhook* has been fail-closed (HTTP 404): signing a payload with a claimed order reference alone is not valid independent amount/currency settlement verification.

**Google Play later:** For in-app digital Credit sales, Google Play Billing is generally required unless a permitted regional/program exception applies. Mobile client headers/user agents are **not** trusted as proof of eligible alternative billing. https://support.google.com/googleplay/android-developer/answer/9858738

**App Store later:** In-app virtual currencies/digital cosmetics normally require StoreKit IAP, with storefront/region/entitlement exceptions. Purchased IAP Credits may not expire. Validate signed platform receipts **server-side**, bind order → authenticated account → product → amount → unique provider transaction → fulfillment, and independently reconcile refunds/chargebacks. https://developer.apple.com/app-store/review/guidelines/

**Never trust the client:** The future native wrapper must not embed database or payment signing secrets or manufacture score receipts. Use HTTPS, secure platform token storage, CSRF defenses for browser cookies, forced server-side session revocation, admin TOTP+recovery, rate limits, strict upload paths, hardened CSP, signed privacy-preserving audit logs, row-level ownership, backup restore drills and aggressive PII minimization. The current `X-Session` WebView compatibility behavior and long-lived sessions need explicit theft/signout/revocation tests.

**Official giveaways:** Do not certify any game as prize-eligible until the server can independently replay or otherwise authoritatively establish score/game state from signed, one-use inputs, valid event entitlement and consistent seed/timing; heuristic rate caps alone do not prove a reported score. Hold or disqualify unverifiable event runs, do not compensate weak replay coverage with paid player privileges.

**98% phone traffic:** Real Android Chrome/WebView + iPhone Safari/WKWebView UAT, safe areas, pausing, orientation, API auth and recorded P95 frame time are mandatory. Chromium emulation with an iPhone user agent is not real iOS WebKit proof.

## Release gates and regression execution

Run **on a disposable test DB and local server**, NEVER against live account balances:
```sh
node tools/test-unified-wallet.js
node tools/test-reward-integrity.js
node tools/test-full-hub-meta-contract.js
# mocked payment explorer against fresh throwaway API only
# ... then entire Docker STEP11/STEP12 and owner phone UAT
node tools/preflight-manual-release.js --release=R3 --require-ready
node tools/preflight-manual-release.js --release=R4 --require-ready
```

The new native better-sqlite3 wallet and anti-cheat tests are wired into the fail-closed Docker prelaunch. **Full Node 20 project/Docker/native iPhone testing has not yet run in this source session**. A separate local SQLite SQL-equivalence smoke passed for legacy row-id idempotence, signed refunds and repeated hold/release corrections; that is narrower than the full backend test. Every other public security gate remains blocked until its actual evidence exists.

**Do not turn Deplexo auto-deployment back on or enable real money/prestige purchases based on this document.** Preserve screenshot-confirmed READY 278af07 and first finish the R1–R5 accepted release milestones.

# Owner handoff — final connection and release tasks

**Working branch:** `games/deep-distinctness-audit`  
**Pull request:** https://github.com/TheTavern001/gaming-hub-2/pull/6  
**Production status:** no merge or deployment performed from this branch.

This checklist defines the four owner-side tasks to perform only after the code and release blockers listed below are cleared. It is not a claim that the Hub is launch-ready.

## Four owner-side tasks

### 1. Connect Cloudflare R2 (optional media storage)
- Create a dedicated R2 bucket for Hub media.
- Create an S3-compatible token restricted to that bucket with Object Read and Object Write only.
- Add `CLOUDFLARE_R2_ACCOUNT_ID`, `CLOUDFLARE_R2_ACCESS_KEY_ID`, `CLOUDFLARE_R2_SECRET_ACCESS_KEY`, and `CLOUDFLARE_R2_BUCKET` as private hosting environment variables.
- Optionally configure `CLOUDFLARE_R2_PUBLIC_URL` for a dedicated HTTPS media domain.
- Test upload, reload, and persistence after app restart. Keep a backup of existing media until confirmed.
- Instructions: [Cloudflare and Payments Setup](CLOUDFLARE-AND-PAYMENTS-SETUP.md).

### 2. Connect Stripe in test mode — only if Stripe approves the model
- Obtain written Stripe confirmation for the exact business model and goods being sold. The Hub's skill-game prizes/giveaways and intended audience may trigger restricted-business rules; test mode does not establish approval.
- On a private test deployment, set `STRIPE_SECRET_KEY` (test key), `STRIPE_WEBHOOK_SECRET`, and the exact HTTPS `PUBLIC_URL`.
- Register `/api/store/webhook/stripe` with the event list in the setup guide.
- Enable `STRIPE_CHECKOUT_ENABLED=1` only in test; run test purchase, cancellation, failure, expiry and refund flows.
- Do not enter live credentials or set `STRIPE_LIVE_CHECKOUT_ENABLED=1` until written approval and release signoff.
- If Stripe declines or does not approve the model, leave Stripe disabled and choose a provider that explicitly supports the activity.

### 3. Configure hosting, domain and security
- In the hosting dashboard, set private production secrets (`ADMIN_PASSWORD`, `SECRET`, and a random `ADMIN_PATH`) and the persistent data directory appropriate to the host.
- Verify HTTPS, health check, persistent database/media strategy, scheduled backups and a tested restore.
- Configure custom domain/DNS only if the owner controls the domain. Cloudflare DNS/proxy is separate from R2. Use the host's exact DNS targets; do not guess records.
- Keep API, authenticated pages, admin paths and payment webhooks out of public edge cache. Only trust proxy/client-IP headers when the real proxy path is configured and origin access is protected.
- Never put credentials in Git, source code, screenshots or chat.

### 4. Owner-led release acceptance and public launch
- Review the release candidate on desktop and a real Android phone, including account creation/sign-in, avatar editing, every game, scoring, leaderboards, giveaways/booking flow, store/wallet, profile, and admin security.
- Confirm data persistence, backup restore, rate limits, privacy/terms, age and geographic eligibility, rights to game code/art/audio, payment/refund handling and a rollback procedure.
- If distributing through Google Play, complete the Android packaging, signing, store listing, privacy/data-safety declarations, target-API requirements and Play testing/review separately; a working web app is not a Play Store release.
- Launch only after the technical and business approval gates below are documented for the exact build.

## Blockers that must be resolved before those four tasks count as final

1. **CI is currently failing on this branch.** The latest checked commit had failures for Games Library static checks, Games Library browser smoke tests, and V1 launch syntax checks. The connector could not retrieve step logs (the jobs response had no steps), so causes are unknown. Do not guess a fix; restore usable CI logs or reproduce each workflow in a real checkout and fix the demonstrated failures.
2. **Game audit is not complete.** The catalogue has 100 entries (4,950 unordered game pairs); only a portion has been source-audited. Several duplicate/high-overlap candidates have been identified, but no games have been removed on this branch. Check stable IDs, score/event history, deep links and migration compatibility before any retirement.
3. **AAA+/avatar signoff is not complete.** A Three.js avatar preview prototype exists, but premium art quality, all base presentations and customization depth, touch/keyboard usability, CDN fallback, mobile performance, asset rights and persistence still require testing. Each game and Hub subsystem needs evidence on the actual release build.
4. **No end-to-end owner account tests have been performed.** No Stripe/R2 account has been connected or tested against real services. No separate preview has been deployed from this branch, and no production deployment or Play Store submission has occurred.

## Safe operating rules
- This branch/PR is a review candidate, not production.
- Do not merge or deploy automatically.
- Keep live checkout off unless approved in writing by the payment provider and release signoff is complete.
- Preserve existing user accounts, scores, event history and stable IDs.
- Never represent an untested game or feature as AAA+ or launch-ready.

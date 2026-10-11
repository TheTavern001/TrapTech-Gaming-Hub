# Gaming Hub external-service readiness

Status date: 11 October 2026. This file tracks what is implemented in the repository versus what still requires access to external accounts or real-device testing. It is not a launch approval.

## Current status

| Area | Code/repository status | External verification still required |
|---|---|---|
| Cloudflare R2 media | Optional S3-compatible storage client is wired into admin image uploads. Without the four R2 settings, uploads fall back to app storage. Mock signing/upload/download tests pass in CI. | Create an R2 bucket and bucket-scoped Object Read & Write token; add settings privately in hosting; upload/reload/restart on a preview deployment. No Cloudflare credentials are connected here. |
| Cloudflare DNS, proxy and WAF | Setup procedure documented. The server already supports trusted proxy settings, but those must not be enabled blindly. | Domain must be owned/controlled; connect it in Deplexo first, copy its exact TXT/CNAME instructions into Cloudflare DNS, confirm HTTPS, then configure WAF and cache rules. No DNS or WAF settings have been changed. |
| Stripe checkout | Hosted Checkout for cosmetic Hub Store products; signed webhooks; payment/refund/mode validation; fail-closed provider toggles. 21 mocked integration checks pass in CI. | No Stripe account/key/webhook endpoint is connected. Test-mode account validation remains external work. **Do not use live mode unless Stripe confirms in writing that it approves this exact business model**; its policy lists skill-game competitions with material prizes, sweepstakes/contests, and certain marijuana-related businesses. Live gate must stay off until approval. |
| Sponsor giveaway booking payments | Booking/quote/event flow exists; checkout code currently applies to cosmetic store purchases only. | Sponsor booking invoices are not processed by Stripe. Select a provider that explicitly approves the competition/prize and brand model before adding live booking payment collection. |
| Bitcoin checkout | Existing direct-to-wallet cosmetic store flow with order matching, confirmation rules and manual refund workflow. It remains separate from Stripe. | Owner must validate the receiving wallet and turn the master checkout switch on deliberately. Use the mocked payment suite for software QA; do not use real money as the first test. |
| Deplexo deployment | Dockerfile configuration is present in the release-candidate branch; the integration changes are on PR #5 targeting the candidate branch. | This assistant does not have an authorized Deplexo account tool. No production environment variables, custom domain or live deployment has been changed or verified. |
| Domain | Site already runs under its current Deplexo URL; setup guide explains custom-domain attachment. | No TrapTechGamingHub domain purchase/availability has been verified. A domain under the owner's control is required before DNS can be finalized. |
| Database/backups | SQLite persistence and backup tooling exist in the app. | Confirm persistent volume and a fresh downloadable/off-site backup from the live Deplexo instance before any production release. Do not replace or wipe the production volume. |
| Android / Play Store | Manifest, service worker and PWA-first release plan exist. | Install and test from HTTPS on the owner's Samsung Galaxy S21 FE; verify login/session persistence, Back navigation, offline/recovery, game touch controls and payment behavior. Play Store packaging and billing-policy review come after the website is stable. |
| Game quality | The candidate has a 100-game QA tracker. | No game is release-approved until desktop + Android touch play, physics, audio/visual quality and score integrity have been personally checked and defects fixed/retested. A browser smoke pass alone is not an AAA-quality sign-off. |

## Integration guardrails added in this branch

- New databases default the global store checkout switch to off. The operator must explicitly enable it.
- Stripe also requires STRIPE_CHECKOUT_ENABLED=1; live keys additionally require STRIPE_LIVE_CHECKOUT_ENABLED=1. These are operational gates, not proof of processor approval.
- HTTPS return URLs must be the exact origin. Checkout sessions must return the expected Stripe hosted URL and matching test/live mode.
- Signed webhook events must match the mode of the configured Stripe key. Bad signatures, mismatched amounts/currency/account metadata and cross-mode events cannot fulfil orders; duplicate success webhooks are idempotent.
- Cloudflare R2 signing and storage paths are tested against a mock endpoint without real credentials.
- The integration draft is PR #5 and targets v1-launch-finalization, not main. It has not been merged or deployed.

## Mock test commands

- npm run test:stripe — isolated local SQLite database + mocked Stripe API and webhook events.
- npm run test:r2 — mocked R2 S3-compatible signing, upload and download.
- bash -n tools/run-all.sh — validate the all-suite runner syntax.

Do not put API keys, webhook secrets, R2 secret keys, admin passwords or recovery codes in this repository, issue comments, screenshots or chat messages. Provider secrets belong only in the hosting provider's private environment settings.

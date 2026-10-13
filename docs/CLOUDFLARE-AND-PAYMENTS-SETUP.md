# Cloudflare and payment connection — V1

This document separates code that is prepared from external accounts that must be configured. Never paste secret keys into chat, issue trackers, screenshots, or public files.

## Card and debit payments

The Hub now has a server-side Stripe Checkout integration. It creates orders from server-priced products, redirects customers to Stripe-hosted checkout, and grants the product only after a valid signed Stripe webhook confirms payment. Full refunds initiated in Stripe trigger entitlement reversal; partial refunds are flagged for review.

1. In Stripe, start in test mode and copy the secret test API key. Store it as STRIPE_SECRET_KEY in the deployment environment.
2. Set PUBLIC_URL to the exact HTTPS origin of the live Hub.
3. Create a webhook endpoint at https://YOUR-DOMAIN/api/store/webhook/stripe.
4. Subscribe to checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, and charge.refunded.
5. Copy the endpoint's signing secret into STRIPE_WEBHOOK_SECRET.
6. Deploy, then verify a test purchase, a cancelled checkout, a failed payment, and a full refund in Stripe test mode before enabling live keys.
7. Only after test mode passes should live Stripe keys and the live webhook signing secret be added to the production environment.

The app accepts card payments through Stripe Checkout. Stripe may present credit and debit cards according to the account's payment-method settings. Bitcoin remains a separate direct-to-wallet flow using BTC_ADDRESS; the Hub never receives wallet private keys. Other cryptocurrencies are not yet integrated.

Do not enable live checkout until the operator has completed the business, tax, consumer terms, refund, and digital-goods compliance requirements applicable to the business.

## Cloudflare R2 media storage

The admin media uploader supports optional R2 storage. When all R2 credentials are configured, new admin-uploaded artwork is written to R2 instead of the application's local media directory. If R2 is not configured, local disk storage remains the fallback.

1. In Cloudflare, create an R2 bucket dedicated to Hub media.
2. Create an R2 S3 API token scoped to that bucket with Object Read and Object Write only. Do not use a global Cloudflare API token.
3. In the deployment environment, set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, and CLOUDFLARE_R2_BUCKET.
4. Optional: connect a dedicated HTTPS custom domain to the bucket and set CLOUDFLARE_R2_PUBLIC_URL to its origin, for example https://media.example.com. If omitted, media is served through the Hub's /media route.
5. Deploy and test an upload, reload the resulting image, restart the app, and confirm the image still loads. Keep a backup of existing DATA_DIR/media until this passes.

R2 does not automatically move the site's source code, SQLite database, backups, or every static asset. It moves admin-uploaded media only. Database persistence and backups must remain configured separately.

## Cloudflare DNS and proxy

Cloudflare DNS is separate from R2 storage. Connect the domain in the hosting provider first, then use the exact DNS target the hosting provider gives you. Do not guess an IP address or turn on proxying before confirming the host supports it. Set PUBLIC_URL to the final HTTPS origin. Set TRUST_PROXY_HOPS only to the actual trusted reverse-proxy hop count, and set TRUST_CF_IP=1 only when Cloudflare is the trusted front proxy and direct access to the origin is blocked. Otherwise, clients can spoof forwarding headers and defeat IP-based rate limits/anti-cheat signals.

## Security and privacy notes

- Front-end HTML, JavaScript, CSS, and WebGL assets can always be inspected or modified by a visitor. That cannot be prevented on a public website.
- The Hub must never trust client-submitted prices, scores, winner claims, card payment status, or required giveaway confirmations. Those are validated on the server or through signed provider events.
- The admin application is served only at the private ADMIN_PATH and still requires server-side authentication, 2FA, CSRF protection, and role permissions. The secret path is an additional layer, not the only lock.
- Never put API keys, database files, personal contact details, personal social handles, or account identifiers in public HTML, API responses, source comments, Open Graph metadata, or logs.


## Latest reconciliation, 2026-10-13 — not payment-live approved
Read-only Stripe sandbox inspection found **zero configured webhook endpoints** and **zero Checkout Sessions**. This is not evidence of passing payments or an activated live account. The project has source-level Stripe Checkout handling and signature verification, but needs a deployed Stripe TEST key, exact `STRIPE_WEBHOOK_SECRET`, PUBLIC_URL, registered test webhook events, and a full test purchase/refund/entitlement reversal. Never send keys in chat or commit them. Default new-install checkout admin setting is now disabled; existing explicit persisted admin choices remain unchanged. When ultimately using `sk_live_`, `PAYMENTS_LIVE_APPROVED=1` is an additional intentional operator setting. This env flag alone **does not** override admin-disabled checkout or supply valid webhook signing. The owner must review actual Terms and taxes before charging real customers; current terms are marked `[DRAFT - FOR LAWYER REVIEW]` in source.


### Required payment go-live flags (added 2026-10-13)
For new/previous checkout settings, there are **two independent authorizations**: the admin checkout toggle plus `PAYMENTS_LIVE_APPROVED=1` for **all actual-money methods** (Bitcoin and live Stripe). Stripe test-mode checkout may be exercised with test keys and explicit admin enablement; it does not process real funds. Bitcoin requires a validated mainnet address, a working observer, confirmation requirements and the same explicit live-approval flag even for old persisted admin settings. **Never set this flag for a real site** until end-to-end grant/reversal, backups, legal terms and fraud protection have been tested. The test command uses an isolated mocked Bitcoin explorer and throwaway DB, not live transactions.

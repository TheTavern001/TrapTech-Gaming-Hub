# Cloudflare and payment connection — V1

**Beginner note:** You do not need to edit the source code for these integrations. The remaining work is account setup, adding the values privately in your hosting dashboard, and testing the connection. Never put private credentials into GitHub or public website files. If your host has no private environment-variable settings, stop and contact its support rather than placing credentials in code.

This document separates code that is prepared from external accounts that must be configured. Never paste secret keys into chat, issue trackers, screenshots, or public files.

> **Important Stripe eligibility gate — do not switch on live payments yet.** Stripe's published restricted-business policy lists games of skill, including video-game tournaments, with a monetary or material prize; sweepstakes and contests; and certain marijuana-related businesses. Those categories overlap with the Hub's current giveaway/sponsor model and intended brand audience. Obtain written confirmation from Stripe that it approves this exact business model and the actual products being charged for before processing any live payments. A successful test-mode payment does not establish eligibility. See [Stripe's restricted-business list](https://stripe.com/legal/restricted-businesses) and [Stripe's FAQ](https://support.stripe.com/questions/prohibited-and-restricted-business-list-faqs).

## Card and debit payments

The candidate contains server-side Stripe Checkout for the **cosmetic-only Hub Store**. It creates orders using server-owned catalogue prices, redirects buyers to Stripe-hosted checkout, and grants items only after a signed webhook confirms a paid session and validates the stored order, customer, currency and exact amount. Full refunds from Stripe reverse granted entitlements; partial refunds require manual review. This integration does **not** currently collect payment for sponsor giveaway bookings.

1. Configure this on a private preview/test deployment, not production. In Stripe test mode, copy the secret test API key to `STRIPE_SECRET_KEY`.
2. Set `PUBLIC_URL` to the exact HTTPS origin only, such as `https://hub.example.com` (no path, query string or fragment).
3. Set `STRIPE_WEBHOOK_SECRET` to the signing secret for the endpoint `https://YOUR-DOMAIN/api/store/webhook/stripe`.
4. Subscribe that endpoint to `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `charge.refunded`.
5. Set `STRIPE_CHECKOUT_ENABLED=1` only in that test environment, then enable the separate Admin > Store & orders checkout switch. Both gates must be enabled.
6. Run `node tools/e2e-stripe.js` and perform test-mode purchase, cancel, failed-payment and full-refund checks. Do not use real payment details in these tests.
7. Do **not** add live credentials or switch on `STRIPE_LIVE_CHECKOUT_ENABLED=1` until Stripe has approved the business model in writing and all applicable legal, tax, consumer-terms, refund and digital-goods obligations have been reviewed.

Live Stripe checkout requires all three controls: valid live API/webhook credentials and HTTPS origin, `STRIPE_CHECKOUT_ENABLED=1`, `STRIPE_LIVE_CHECKOUT_ENABLED=1`, plus the Hub's separate Admin > Store & orders switch. The extra environment switch is a safeguard, not proof of Stripe approval.

Bitcoin remains a separate direct-to-wallet provider using `BTC_ADDRESS`; the Hub never receives wallet private keys. Other cryptocurrencies are not integrated. Stripe checkout is presently for cosmetic store items, not sponsor booking invoices.

## Cloudflare R2 media storage

The admin media uploader supports optional R2 storage. When all R2 credentials are configured, new admin-uploaded artwork is written to R2 instead of the application's local media directory. If R2 is not configured, local disk storage remains the fallback.

1. In Cloudflare, create an R2 bucket dedicated to Hub media.
2. Create an R2 S3 API token scoped to that bucket with Object Read and Object Write only. Do not use a global Cloudflare API token.
3. In the deployment environment, set CLOUDFLARE_R2_ACCOUNT_ID, CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, and CLOUDFLARE_R2_BUCKET.
4. Optional: connect a dedicated HTTPS custom domain to the bucket and set CLOUDFLARE_R2_PUBLIC_URL to its origin, for example https://media.example.com. If omitted, media is served through the Hub's /media route.
5. Deploy and test an upload, reload the resulting image, restart the app, and confirm the image still loads. Keep a backup of existing DATA_DIR/media until this passes.

R2 does not automatically move the site's source code, SQLite database, backups, or every static asset. It moves admin-uploaded media only. Database persistence and backups must remain configured separately. Run `npm run test:r2` to exercise the signing and storage client against a mock endpoint before entering any real R2 credentials. The test does not upload to Cloudflare.

## Cloudflare DNS, security and proxy

Cloudflare DNS, HTTP proxy/security and R2 storage are separate configuration tasks. None can be attached to the owner’s account from GitHub alone.

1. Add/verify the domain in Deplexo first. Use the **exact** TXT verification and CNAME target that Deplexo displays; do not guess an origin IP or reuse another app's target. If Cloudflare is the DNS provider, add the records in the right zone. A custom domain still requires a domain the owner controls.
2. Start with DNS-only if Deplexo tells you proxying is unsupported; otherwise use Cloudflare proxy only after verifying the hostname works through it. Configure SSL/TLS to Full (strict) when the origin certificate is valid, and always redirect HTTP to HTTPS. Never use Flexible SSL for an HTTPS origin.
3. Enable Cloudflare's managed WAF rules suitable for the plan. Add carefully tested rate limits for login/signup and abusive API traffic only after checking false positives. Do not challenge or cache the Stripe webhook as if it were a browser; the Hub verifies its cryptographic signature server-side.
4. Bypass edge caching for `/api/*`, the private admin path, user/order pages and webhook endpoints. Cache static images, CSS, JavaScript and other versioned static assets, not authenticated/session-bound responses.
5. Set `PUBLIC_URL` to the final exact HTTPS origin. Set `TRUST_PROXY_HOPS` only to the actual trusted reverse-proxy hop count. Set `TRUST_CF_IP=1` only after Cloudflare is the trusted front proxy **and direct access to the origin is blocked**. Otherwise clients may spoof forwarding headers and defeat IP-based rate limits or anti-cheat signals.

Cloudflare's official R2 setup supports scoped S3 API tokens with Object Read & Write permissions restricted to selected buckets. See the [R2 token guide](https://developers.cloudflare.com/r2/api/tokens/) and [S3-compatible API guide](https://developers.cloudflare.com/r2/get-started/s3/).

## Security and privacy notes

- Front-end HTML, JavaScript, CSS, and WebGL assets can always be inspected or modified by a visitor. That cannot be prevented on a public website.
- The Hub must never trust client-submitted prices, scores, winner claims, card payment status, or required giveaway confirmations. Those are validated on the server or through signed provider events.
- The admin application is served only at the private ADMIN_PATH and still requires server-side authentication, 2FA, CSRF protection, and role permissions. The secret path is an additional layer, not the only lock.
- Never put API keys, database files, personal contact details, personal social handles, or account identifiers in public HTML, API responses, source comments, Open Graph metadata, or logs.

# Trap Tech Gaming Hub — verified vendor booking payment setup

**Status:** Feature code integrated into the controlled R2 candidate, **not live or financially certified**.

## Required Stripe account configuration

- Use `STRIPE_SECRET_KEY` for Stripe Checkout API requests (test key during sandbox QA; live secret only after legal and payment approval).
- Use a **dedicated** `STRIPE_BOOKING_WEBHOOK_SECRET` for the booking-specific Stripe webhook endpoint. Stripe gives each endpoint its own `whsec_...` signing secret. The Store webhook uses `STRIPE_WEBHOOK_SECRET` and is **separate**.
- Set `PUBLIC_URL` to the actual HTTPS origin and `HUB_PRIVATE_REVIEW=0` only when the owner authorizes payment testing.
- To use `sk_live_...`, require `PAYMENTS_LIVE_APPROVED=1`. Keep off during private review and unpaid testing. Never commit or publish keys.
- In the Stripe Dashboard, create an endpoint with the **exact** production/test domain:
  `https://<your-deployed-domain>/api/sponsor/webhook/stripe`
- Subscribe to: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, and `charge.dispute.created`. Paste its **own** signing secret into Deplexo's private env vars, not into repo files.
- Confirm the endpoint receives Stripe's unmodified raw JSON bytes, valid `Stripe-Signature` and matching webhook signing secret. Do NOT proceed merely because Stripe test keys exist.

## Flow

1. Vendor requests a giveaway; Trap Tech sends quote. Vendor accepts.
2. Vendor's private status page displays a Stripe-hosted **Pay securely by card** action only if all payment prerequisites pass and the Hub is not in private-review mode. A quote under $1 or an expired/unaccepted quote cannot be paid.
3. The server locks the quote price, stores a random checkout reference, creates a Stripe Checkout Session with an idempotency key, and returns only an approved Stripe checkout domain. Reuse existing open session; network-ambiguous retries retain the same idempotency key.
4. Stripe sends a webhook to the booking endpoint. The server checks the raw-body Stripe signature and exact saved booking ID, Checkout Session ID, immutable reference, USD currency, positive amount and PaymentIntent ID **before** writing a paid record. An admin's manual `paid` button is blocked.
5. Booking events remain draft and nonshareable until separate game-score certification and owner activation. Refunds and disputes permanently revoke event eligibility; a revocation tombstone prevents late payment-success webhooks from reversing that outcome.
6. Admin must investigate failed/mismatched events, canceled checkouts, unexpected provider API errors, and any refund/chargeback; do not publish events until reconciled.

## Test and release gates

Run locally from a complete clean repo and verified Node install:

```bash
node tools/test-booking-stripe-settlement.js
node tools/test-sponsor-webhook-signature.js
node tools/test-giveaway-booking-release-gates.js
node tools/test-unified-release-candidate.js
node tools/offline-release-rehearsal.js --release=R2 --full
```

- Run Stripe sandbox test cards and actual signed webhook deliveries to the isolated running test image. Verify provider event idempotency, wrong amount/currency/signatures, partial refunds and disputes, quote persistence across restart and backup/restore.
- Do not claim live settlement certification from mocked routes or source/syntax tests.
- Real vendor prize hosting also requires owner event authorization, replay-resistant score integrity, a published game-level proof, real Android+iPhone gameplay QA and jurisdictional legal/prize review.
- Keep Deplexo auto-deploy OFF and production payment secrets out of screenshots, logs and GitHub.

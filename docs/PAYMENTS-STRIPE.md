# Payments: Stripe-only (default)

Stripe Checkout (hosted card page) is the only live payment method. Bitcoin code is kept but is **off unless `BTC_CHECKOUT_ENABLED=1`** (it is then also gated by `BTC_ADDRESS` + `PAYMENTS_LIVE_APPROVED=1`).

## Environment variables (Deplexo → Environment)
| Name | Value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_...` (sandbox) or `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` of the webhook endpoint below |
| `PUBLIC_URL` | `https://glassy-drifter-9532.de.deplexo.com` (must be https; used for success/cancel URLs) |
| `PAYMENTS_LIVE_APPROVED` | `1` — **required only for `sk_live_` keys** (sandbox keys work without it) |
| `BTC_CHECKOUT_ENABLED` | leave unset (Bitcoin hidden) |

Also switch checkout ON in Admin → Store (the admin switch). Secrets are never logged or returned by any API.

## Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://glassy-drifter-9532.de.deplexo.com/api/store/webhook/stripe`
- Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`
- Copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

## Behaviour (proved by `tools/e2e-stripe.js`, 18 checks, mocked Stripe API, simulated 4242 card)
- Order → Checkout Session for the exact price; grant happens ONLY on a signed webhook (HMAC-SHA256, 5-minute tolerance, raw body), never on the browser redirect.
- Amount, currency, owner and session id must match the stored order; mismatch → `underpaid`, manual review, nothing granted.
- Idempotent: duplicate deliveries never double-grant. Full refund (`charge.refunded`) reverses the Credits/items; duplicates are no-ops; a refund that arrives before completion is remembered so a later completion never grants.
- Failed / expired sessions mark the order `failed` / `expired`. Partial refunds are flagged for review (not auto-reversed).
- Test with a real sandbox: use card `4242 4242 4242 4242`, any future date/CVC; "Stripe CLI `stripe trigger`" also works against the endpoint.

## Anonymous crypto without BTCPay — research
1. **xpub-derived per-order addresses + mempool.space watcher (best fit).** Operator keeps the seed offline and puts only the account xpub (zpub/vpub) in an env var; the server derives `m/0/<orderIndex>` addresses (needs BIP32 + bech32 code: ~120 lines with `@noble/secp256k1`/hash, or `bitcoinjs-lib` ≈ 3–5 MB RSS), polls `mempool.space/api/address/<addr>/txs` for pending orders only (the existing `src/btc.js` watcher already does this for one address using unique sat amounts). Pros: non-custodial, no accounts, exact attribution without amount tricks, no KYC. Cons: address-per-order privacy depends on xpub secrecy; needs gap handling + sweeping with a wallet; free API rate limits (poll only open orders, 30–60 s); underpay/overpay logic stays ours; fits 128 MB (no new daemon). Not implemented now: it touches money paths and Stripe is the sanctioned method — recommended as a follow-up after sandbox sign-off.
2. **Hosted non-custodial processors** (e.g. self-serve BTCPay hosted by a third party, Coinbase Commerce, NOWPayments/Plisio-type): zero server memory, webhook model identical to Stripe, but they are custodial or take KYC/fees (0.5–1%+), and "anonymous" is limited by the operator's account KYC.
3. **Self-hosted BTCPay Server**: best privacy and features, but needs ~2 GB RAM + node/indexer — does not fit the 128 MB host.
4. **Current single-address + unique-amount scheme (kept, opt-in):** zero dependencies, but amounts collide under load and the single address links all payments.
Recommendation: Stripe now; add option 1 later, behind `BTC_CHECKOUT_ENABLED`.

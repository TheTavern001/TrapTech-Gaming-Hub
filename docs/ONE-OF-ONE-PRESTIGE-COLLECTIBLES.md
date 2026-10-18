# Prestige Designs — Product and Engineering Specification

Updated October 18, 2026 (ET). This filename is retained for existing links. The former one-of-one ownership rules are superseded by `docs/HANDOFF.md` and `docs/spec/03-platform-spec.md`: unlimited copies of each design, one active entitlement per player.

Status: **partially implemented; not launch-approved**.

Implemented in the repository:
- 12 catalog entries priced from $1,000 to $5,000, with unlimited supply in the product API (`supply: null`).
- The `prestige_one_per_user` partial unique index limits active ownership by `(item_id, user_id)`. Different players may own the same design; fulfillment rejects duplicate active entitlements for one player.
- Twelve separate, original SVG showcase illustrations and item-specific art/effect classes are wired into the Prestige storefront and owner wall.
- Twelve separate art/effect identities exist. Legacy `supply: 1` metadata in the authored definition is not the current product supply rule: products and the prestige wall expose `supply: null`. Tests and future work must enforce per-player ownership, never global scarcity.

Still required before any prestige item can be represented as a complete, launch-ready wearable:
- Bespoke 3D/2D wearable geometry or item-specific avatar integration, where supported.
- Owner-only included variations and an explicit supported-game compatibility manifest.
- Visual review at actual player-card and avatar scale, plus browser/device evidence.
- A payment/refund/recovery review using the persistent production database and the final checkout configuration.

Keep `PRESTIGE_SALES_ENABLED` unset until those release gates pass. The storefront and API now treat the 12 originals as preview-only by default, even if another payment method is configured.

## Core promise
The $1,000+ prestige tier consists of individually authored premium designs with unlimited copies. A prestige collectible is not just a recolor, material swap, glow change, renamed template, or inflated price. Each piece must have a distinct silhouette and authored design language, with bespoke geometry/artwork, signature animation/VFX, and an unmistakable identity.

Target launch quantity: 10–20 individually authored prestige collectibles. The exact count is a catalog decision; do not generate duplicate entries to inflate it.

## Unlimited designs, one copy per player
- Each design keeps its stable `prestige_id` and catalog identity. Do not display numbered editions, global sell-out claims or exclusivity to one collector.
- Enforce uniqueness per active `(item_id, user_id)` entitlement. Purchases by different players can both succeed; repeated fulfillment for the same player must not grant twice.
- One player's purchase never retires the design or removes availability for other players. Normal shop cooldown rules remain separate from inventory ownership.
- Ownership and fulfillment remain server-authoritative, transactional and idempotent. Clients cannot grant, replay or invent entitlements.
- Keep an audit trail for purchases, grants, refunds, disputes, recovery and administrative actions. Refund/recovery operations affect the relevant player's entitlement and must not revoke other owners.
- Do not imply transfers or resale until those features and policies exist. Administrative recovery must not create a second active copy for the same player.

## Variations included with each original
Each prestige purchase includes a curated set of variations belonging to that design. Examples:
- Alternate color/material presentation authored specifically for the item.
- Alternate aura, trail, particle signature, idle animation, entrance animation, or equip/unequip presentation.
- Matching profile frame, profile background/card treatment, nameplate/title treatment, and shop showcase treatment.
- A subdued version for readability/accessibility and a high-impact showcase version.
- Item-specific variants that fit the design; not every item needs every category.

These are included variants of the same owned collectible, not separately sold copies. Each player who owns the design can equip its included variants. Variants must preserve the item's unique signature; do not release another item that is materially indistinguishable from the original or its variants.

## What counts as unique
Before approval, each design must pass a human-reviewed similarity check against the complete catalog:
1. Distinct primary silhouette and construction—not only a color or texture change.
2. Bespoke signature motif, material treatment, animation/VFX, and profile presentation.
3. No existing catalog item with the same overall visual read at gameplay scale.
4. Variations are exclusive to that original and are included in its manifest.
5. Capture front/side/back and in-context screenshots, plus a written design rationale, in the asset review record.

Do not promise “nothing else alike” merely because IDs differ. It is a visual-design and catalog-governance rule, reviewed before sale and rechecked as the catalog expands.

## Gameplay fairness and cross-game support
- Prestige cosmetics are cosmetic only: no speed, hitbox, collision, score, physics, access, or competitive advantage.
- Where a game supports the shared avatar/item type, the prestige design should appear in-game. Where it does not, its included profile treatments still work; clearly disclose compatibility before purchase.
- Use a canonical shared cosmetic definition and game-specific adapters rather than independent game copies that drift.
- Fallbacks must be intentional and must not falsely show a unique item as a different design.

## Price and presentation
- Keep the tier small: target 10–20 individually authored $1,000+ designs.
- Show price, the player's ownership state, supported games, included variants and accurate previews before checkout.
- State unlimited availability and one copy per player. Other players' ownership does not prevent purchase.
- Do not use numbered labels, fake scarcity, fabricated bids or sell-out pressure.
- Price does not prove quality: bespoke art, reliable ownership, transparent terms and accurate compatibility remain mandatory.

## Implementation and release gates
1. Design a schema and server-side service for designs, variants, inventory, purchase reservations, and audit events.
2. Add database uniqueness constraints and atomic purchase finalization; test simultaneous purchases by different players, duplicate purchases by one player and replayed webhooks/requests.
3. Build an admin authoring/review flow with duplicate prevention and an audited per-player grant operation.
4. Create original art assets and preview scenes; do not ship placeholder assets as final prestige designs.
5. Add the store listing, owner-only variant selector, equip/save flow, and compatibility labels.
6. Test: different players can acquire the same design; no second active entitlement per player; variant ownership; refunds/disputes; admin audit; cross-game appearance; mobile performance; keyboard/accessibility; API tampering.
7. Do not accept $1,000+ payments until the backend enforcement, legal terms, and operational recovery path have passed review.

## Explicit non-goals
- No generic recolors passed off as new originals.
- No one-of-one or numbered-edition claims anywhere in product copy.
- No promise of resale value, investment return, or guaranteed future appreciation.
- No claim that these requirements are already implemented merely because this document exists.

## Current payment release policy
Stripe is the default checkout. Leave `PRESTIGE_SALES_ENABLED` and `PRESTIGE_COMPATIBILITY_APPROVED` unset until wearable, compatibility and payment/refund gates pass. Live Stripe keys additionally require `PAYMENTS_LIVE_APPROVED=1`. Bitcoin remains disabled unless separately enabled under the documented policy. This documentation update does not enable checkout or certify assets.

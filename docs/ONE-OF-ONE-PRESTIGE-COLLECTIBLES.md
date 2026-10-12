# One-of-One Prestige Collectibles — Product and Engineering Specification

Status: **partially implemented; not launch-approved**.

Implemented in the repository:
- 12 catalog entries priced from $1,000 to $5,000, each with supply 1.
- A SQLite partial unique index prevents more than one active owner for each `prestige-original-*` item, alongside the existing server-side transactional issuance checks.
- Twelve separate, original SVG showcase illustrations and item-specific art/effect classes are wired into the Prestige storefront and owner wall.
- Build-time verification checks that all 12 items have distinct art classes, matching SVG assets, effect styles, and one-of-one supply.

Still required before any prestige item can be represented as a complete, launch-ready wearable:
- Bespoke 3D/2D wearable geometry or item-specific avatar integration, where supported.
- Owner-only included variations and an explicit supported-game compatibility manifest.
- Visual review at actual player-card and avatar scale, plus browser/device evidence.
- A payment/refund/recovery review using the persistent production database and the final checkout configuration.

## Core promise
The $1,000+ prestige tier consists of genuinely unique, one-of-one collectibles. A prestige collectible is not just a recolor, material swap, glow change, renamed template, or inflated price. Each piece must have a distinct silhouette and authored design language, with bespoke geometry/artwork, signature animation/VFX, and an unmistakable identity.

Target launch quantity: 10–20 individually authored prestige collectibles. The exact count is a catalog decision; do not generate duplicate entries to inflate it.

## One owner, one original
- Every prestige original has a stable unique `prestige_id`, a public edition label `1/1`, and a permanent catalog identity.
- The database must enforce uniqueness on both `prestige_id` and the owning inventory's prestige-item reference. A purchase/award must be an atomic transaction so simultaneous buyers cannot both acquire the same original.
- Once claimed, the original is marked owned/retired from sale. It must never return to the rotating shop, be reissued as a reward, or be cloned by an admin action without an explicit audited recovery process.
- Use a server-authoritative purchase/award flow. The client cannot set ownership, invent an item ID, replay a purchase, or grant itself an item by editing requests.
- Keep an immutable audit trail for mint/creation, listing, purchase, transfer (if transfers are ever allowed), refund, recovery, and administrative changes. No transfers or resale marketplace should be implied until those systems and rules exist.
- On payment dispute, refund, fraud, or account deletion, follow a documented policy that preserves the 1/1 promise. Do not silently remint a second copy. Any reversal must be audited and the original identity reconciled.
- Admin tooling must not expose an ordinary “duplicate” or “mint again” control for prestige originals.

## Variations included with each original
Each prestige purchase includes a curated set of variations belonging to that one original. Examples:
- Alternate color/material presentation authored specifically for the item.
- Alternate aura, trail, particle signature, idle animation, entrance animation, or equip/unequip presentation.
- Matching profile frame, profile background/card treatment, nameplate/title treatment, and shop showcase treatment.
- A subdued version for readability/accessibility and a high-impact showcase version.
- Item-specific variants that fit the design; not every item needs every category.

These are included variants of the same owned collectible, not separately sold copies. Only the owner can equip its included variants. Variants must preserve the item's unique signature; do not release another item that is materially indistinguishable from the original or its variants.

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
- Fallbacks must be intentional and must not falsely show a unique item as another owner's item.

## Price, presentation and scarcity
- Keep the prestige tier small: target 10–20 $1,000+ originals, not thousands of prestige listings.
- Price and included variations are visible before checkout. Each listing shows “1 of 1,” ownership/availability state, supported games, included variants, and preview media.
- Once sold, show the item as “Claimed” or “Owned by its collector” without exposing private account details.
- No countdowns, fake scarcity, fabricated bids, or misleading claims. Scarcity is real because the original is issued once.
- The high price alone is not evidence of value; bespoke quality, transparent terms, reliable ownership, and accurate previews are mandatory.

## Implementation and release gates
1. Design a schema and server-side service for unique originals, variants, inventory, purchase reservations, and audit events.
2. Add database uniqueness constraints and atomic purchase finalization; test two simultaneous purchase attempts and replayed webhook/request cases.
3. Build an admin authoring/review flow with duplicate prevention and a non-duplicable issue operation.
4. Create original art assets and preview scenes; do not ship placeholder assets as final prestige designs.
5. Add the store listing, owner-only variant selector, equip/save flow, and compatibility labels.
6. Test: one winner under concurrent claims; no second issue; variant ownership; refunds/disputes; admin audit; cross-game appearance; mobile performance; keyboard/accessibility; API tampering.
7. Do not advertise the uniqueness guarantee or accept $1,000+ payments until the backend enforcement, legal terms, and operational recovery path have passed review.

## Explicit non-goals
- No generic recolors passed off as new originals.
- No “one-of-one” label enforced only by the frontend.
- No promise of resale value, investment return, or guaranteed future appreciation.
- No claim that these requirements are already implemented merely because this document exists.

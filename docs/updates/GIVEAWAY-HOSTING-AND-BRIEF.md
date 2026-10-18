# Giveaway Hosting — Standardized Brand Brief & Process

**Updated:** October 18, 2026  
**Status:** Specification for implementation (fills gaps from HANDOFF.md + user feedback)

## Goal
Prefer the phrasing **“Host a Giveaway”**. Every brand must submit a complete **Giveaway Brief** before any campaign can go live. This prevents missing information and lets the Hub coordinate while brands keep working.

## Required Giveaway Brief Fields

| Field | Description / Format | Why It Matters |
|-------|----------------------|----------------|
| Brand / Sponsor Name | Official display name | Used on campaign cards & winner messages |
| Prize Name & Specs | Exact title, model/tier, quantity (e.g. 1× Custom Glass Piece, 5× $50 USDT) | Clear expectations |
| Total Retail Value (USD) | Estimated total value | Legal disclosures & compliance |
| Eligibility & Geo-Restrictions | Age limits (21+), eligible countries/states | Prevents illegal shipping/claims |
| Entry Requirements | Hub Brand Membership duration, achievement/level, min runs, etc. | Automated verification |
| Fulfillment Contact | Name, email, **Potato Chat link** | Direct winner connection |
| Shipping & Liability Waiver | Checkbox: brand handles delivery, taxes, shipping | Protects Hub from liability |

**Process:**
1. Brand submits brief via “Host a Giveaway” page (or admin form).
2. Hub admin reviews & approves (or requests changes).
3. Campaign goes live only after all fields are complete and waiver is accepted.
4. Automated random winner selection (verifiable seed).
5. Winner receives in-Hub notification + direct Potato Chat link.
6. Brand fulfills prize. Hub only coordinates.

## Winner Notification & Liability

**Direct messaging:** On win, Hub sends the winner a private notification containing the brand’s Potato Chat link (and any additional claim instructions from the brief).

**Disclaimer (must appear in rules and winner message):**
> The Gaming Hub acts solely as a promotional host and event coordinator. All physical and digital rewards are provided and fulfilled directly by the sponsoring Brand. The Hub does not store, ship, or guarantee giveaway items. Winners must communicate directly with the sponsoring brand via the provided Potato Chat link to claim prizes.  
> Sponsoring brands that fail to fulfill verified prizes will be permanently blacklisted from all present and future Hub operations.

## Brand Affiliation (Simplified Copy)

**User-facing:**
> **Choose Your Affiliation (Optional)**  
> Joining a brand is 100% optional. Select one brand only if you want to enter its exclusive member giveaways.  
> - One brand at a time. You may switch once every 30 days.  
> - Switching or leaving cancels your active entries in that brand’s member-only giveaways.  
> - This only affects giveaway eligibility inside the Hub. It does **not** connect Telegram, manage any external channel, grant admin rights, or book a giveaway.

## Industry Best Practices Incorporated
- Provably fair / verifiable RNG draws (anti-rig).
- Account age + activity filters to reduce bots/sybils.
- Free-to-enter (no purchase required for entries).
- Platform is venue only — not responsible for fulfillment (matches Winify, Winhub, etc.).
- Clear claim window + blacklist for non-compliant sponsors.
- Skill-based game entries preferred over pure random wheels.

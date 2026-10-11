# Cosmetic pricing and player-fairness benchmark — V1

Research checked 11 October 2026. Prices in live games rotate and may vary by region/platform; use these as positioning references, not promises of exact conversion.

## Market reference points

- Fortnite Item Shop: current official shop listings show many emotes and smaller accessories around 300–800 V-Bucks, outfits around 1,200–1,500 V-Bucks, and larger vehicle cosmetics around 2,000 V-Bucks. Source: https://www.fortnite.com/item-shop
- Apex Legends: EA's official FAQ lists cosmetic rarity reference prices of 500 AC (Rare), 1,000 AC (Epic), and 1,800 AC (Legendary). Source: https://www.ea.com/games/apex-legends/about/frequently-asked-questions
- Roblox Marketplace: user-created accessories span free and low-cost items through much higher limited collectibles, so it is a broad marketplace rather than a single consistent price benchmark. Sources: https://www.roblox.com/catalog?Category=11 and https://create.roblox.com/docs/marketplace

These are different currencies and economies, so a direct exchange-rate comparison is misleading. The useful lesson is the tier structure: free rewards, inexpensive accessories, mid-tier cosmetics, premium bundles, and very rare collector cosmetics.

## Recommended Hub pricing

The Hub should feel generous because users are here to play games first. Every game stays free, and no purchase can improve score, controls, attempts, XP earning rate, achievements, quest requirements, giveaway eligibility, matchmaking, or winner selection.

### Earned currency: Hub Points

Hub Points are earned through play, quests, streaks, achievements, and other published activities. Keep the existing rarity baseline and dynamic price logic; use the ranges below as a sanity check rather than a promise that every item has a fixed price.

| Cosmetic type / rarity | Suggested earned Hub Points | Player-facing intent |
|---|---:|---|
| Common name colour, simple badge | 100–200 | Frequent free unlock |
| Rare frame, banner, accessory | 250–500 | Short-term goal |
| Epic animated effect or detailed banner | 600–1,200 | Medium-term goal |
| Legendary profile effect / detailed cosmetic set | 1,500–2,500 | Long-term cosmetic goal |
| Achievement, quest, seasonal and skill rewards | Free to claim | Never require payment |

### Optional paid currency: Hub Crowns

Use Hub Crowns only for cosmetic purchases. At current pack pricing, the approximate value is 100 Crowns per US dollar before pack bonuses. Recommended cosmetic price anchors:

| Paid cosmetic | Hub Crowns | Approx. value |
|---|---:|---:|
| Simple colour / badge | 50 | $0.50 |
| Rare frame / banner | 100 | $1.00 |
| Epic animated effect | 225 | $2.25 |
| Legendary cosmetic | 500 | $5.00 |
| Themed multi-item cosmetic bundle | 700–1,000 | $7–$10 |

The implementation maps a listed Hub Points price to a starting Crown price using round-to-5(max(50, points price / 4)); item availability and the final amount are decided server-side. Recheck the final prices against the current item rotation and displayed Crown balance before enabling sales.

### Season Pass

- Keep the free track and all games fully playable without payment.
- Suggested starting price: $9.99 per season, with a clear list of extra cosmetic rewards before purchase.
- Paid track uses exactly the same earned XP as the free track. No XP multiplier, levels bought with money, score boost, extra attempts, exclusive game mechanics, or giveaway advantage.
- Bonus Crowns are allowed only because they can buy cosmetics. Clearly label the pass as optional.
- Do not use countdowns that misrepresent an item's availability or imply financial value.

### Collector / prestige cosmetics

A small collector shelf can contain up to ten numbered vanity cosmetics priced in the low thousands of dollars, but these should be an exceptional, optional display feature—not a core revenue assumption. Before publishing any four-figure item, require legal/accounting review, explicit buyer confirmation, a clearly stated limited quantity, documented fulfillment/refund handling, and payment-provider approval for the exact product and price. Do not imply resale value, investment return, ownership rights in real-world precious metals, or a higher user role. A serial number is cosmetic only. Consider leaving these listings disabled until written provider approval and a tested refund process exist.

## Hard rules

1. No paid item changes game logic, gameplay visibility, hitboxes, speed, physics, score validation, attempts, anti-cheat, XP earned, achievements, quests, leaderboard ranking, official giveaway entry, eligibility, or winner selection.
2. No paid or earned badge, title, frame, animation, outfit, avatar accessory, or prestige item may say or imply Founder, Creator, Owner, Staff, Admin, Moderator, Official, or Guardian. Those labels are reserved for server-authorized staff UI and cannot be purchased or equipped as player cosmetics.
3. Free rewards must remain meaningful; do not make users pay to hide ads, bypass a wait, access the core game library, or submit an eligible score.
4. All purchases use server-side prices and ownership checks. The browser is never authoritative for currency, item ownership, payment status, score, or eligibility.
5. Publish the actual price in dollars and the Crown amount together; do not rely on users to calculate an exchange rate.

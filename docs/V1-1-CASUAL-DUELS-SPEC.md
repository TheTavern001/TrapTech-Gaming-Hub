# Casual random duels — proposed V1.1 feature

This is separate from official giveaways and tournaments. A player can opt into a quick, casual duel against one randomly matched Hub player for fun.

## Player flow
1. Player chooses a game that explicitly supports duel mode and taps Find a Duel.
2. Server puts the player into a short-lived matchmaking queue; cancel is always available.
3. Server pairs two eligible players, issues a shared game/version/seed and signed run tokens, and starts a countdown.
4. Both players complete the run in a bounded time window. Scores are submitted through the same server-validated run pipeline used elsewhere.
5. The server compares verified results and publishes the result only after both submissions or a timeout. Disconnects/timeouts use a clear, published rule.
6. Each player receives normal XP and cosmetic progress only. No paid entry, no cash prize, no bonus score, no better attempts, no paid matchmaking priority, and no duel result can create or qualify for an unbooked giveaway.

## Anti-abuse requirements
- Never trust a client-reported opponent, score, winner, timer, game version, seed, or completion status.
- One active queue ticket per account; expire tickets and matches; use server-side locks to prevent duplicate pairings.
- Match only compatible game versions and identical rules/seeds. Revalidate both run tokens and score submissions.
- Add account/device/IP rate limits, suspicious repeated-opponent checks, and anti-farming caps for XP.
- Never use casual duels as giveaway evidence unless an official giveaway explicitly includes that duel mode and the server validates it.
- Do not expose private contact handles or internal user IDs in match history.
- Include a report/block option and a cooldown for repeatedly leaving matches.

## Scope decision
This is a casual matchmaking feature, not a tournament bracket. Official tournaments and giveaways remain separate, booked/authorized events. Implement after V1 deployment, persistence, payment verification, and core anti-cheat tests are green.

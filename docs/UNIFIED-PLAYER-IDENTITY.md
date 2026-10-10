# Unified Hub Identity, Achievements, and Progression

## Product rule
One Hub account is the player's canonical identity across the main Hub, all integrated games, external providers that support identity linking, and official events. A game provider's local guest profile must not become a separate Hub identity. Where provider account linking is unavailable, the game can still launch but cross-provider achievements and verified stats are limited to evidence the Hub can legitimately receive.

## Profile data
- Identity: stable Hub user ID, username, avatar, profile cosmetics and privacy settings.
- Progression: total XP, player level, account-wide milestones, streaks if explicitly defined, and unlocked titles/banners/frames/badges.
- Achievements: global achievements and game-specific achievements, each with stable ID, description, rarity/tier, unlock criteria, earned timestamp, evidence/run reference and source game/version.
- Game stats: games launched and completed, verified playtime where measurable, total accepted runs, personal bests, game-specific metrics and recent activity.
- Competitive record: current and historical rankings, #1 finishes, official giveaway/event entries, placements, wins, playoff results and disqualifications with reasons where disclosure is appropriate.
- Collections: earned and equipped cosmetics, showcase slots, profile title, favorite games and shareable achievement cards.

## Trusted unlock pipeline
1. A run or provider result enters through the approved game integration class (H1/H2/H3/H4).
2. The Hub validates the result and stores it against the authenticated Hub user ID.
3. An idempotent server-side achievement evaluator checks eligible rules. The client never submits an authoritative 'unlock this achievement' command.
4. Award records are unique by user + achievement ID; retries must not duplicate XP, cosmetics or notifications.
5. The Hub records evidence and the rule/version used for the award, then updates profile, XP and public showcase data.
6. The client refreshes the profile and shows an unlock animation/notification only after the server confirms the award.

## Achievement design
- Keep achievements meaningful and game-specific where possible, plus platform-wide milestones that reward exploration, consistency, skill, social participation and official competition.
- Use explicit, testable criteria. Do not award achievements from client-reported time, score or progress without validation.
- Make thresholds versioned. If a game's scoring changes, document migration/legacy behavior rather than silently invalidating earned achievements.
- Separate verified competitive achievements from casual participation achievements. An H4 casual-only game may award a clearly labeled participation achievement only when the event is genuinely observable and the rule does not imply a verified score.
- Do not grant achievements for merely opening a game unless intentionally designed as an onboarding milestone; prevent rapid refresh/relaunch farming.
- Avoid pay-to-win progression. Cosmetics and prestige should not affect competitive scoring or winner selection.

## Cross-provider identity
- Use the Hub's internal user ID as the canonical primary key; never key player history solely by mutable username or email.
- For providers with supported OAuth/account linking, store provider + provider subject ID in a unique mapping and require explicit user consent.
- For iframe-only games without identity APIs, do not claim that the provider recognizes the Hub user. Keep the Hub session in the parent app and collect only permitted game evidence.
- Keep private account data private. Public profiles should expose only the fields the user has chosen to share.

## Consistent profile and leaderboards
- Use the same accepted-run source for profile stats, achievement progress, personal bests, leaderboards and official event results.
- Clearly distinguish submitted, pending, verified, rejected and casual-only scores.
- Personal bests should be computed server-side from accepted scores. Global player level should use a documented XP formula and a server-side ledger to prevent duplicate grants.
- Use stable achievement IDs across UI, APIs and database; adding a new game must not require inventing a separate identity system.
- Final event standings remain separate from lifetime profile stats, but completed placements and wins can update the player's historical record after event finalization.

## Acceptance tests
- Same Hub account retains identity and achievements when switching among multiple integrated games.
- Two accounts cannot write to or unlock progress for one another by changing client parameters.
- Duplicate score posts, retries and webhook re-deliveries do not duplicate XP, achievements or event wins.
- Unverified/casual-only scores cannot unlock verified-skill achievements or affect prize results.
- Username changes preserve all history because records are keyed to stable user ID.
- Profile privacy settings are enforced by API responses, not only by hiding elements in the browser.
- Provider outage, revoked link and game version change do not erase earned Hub achievements.

## Current-code caution
The repository already has a server-side achievement system driven by validated runs and a cosmetics inventory. The main catalog is separate from the newer 100-entry Games Library. Before claiming a truly unified identity across all library and external-provider games, implementation work must connect the library's accepted score records to achievement/stat processing and extend the schema for provider identity and integration status where needed. This document is the acceptance target, not a claim that every cross-game path already works.

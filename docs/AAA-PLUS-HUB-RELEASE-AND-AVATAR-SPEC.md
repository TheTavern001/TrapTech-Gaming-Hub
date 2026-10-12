# AAA+ Hub-Wide Audit and Avatar Customization Product Specification

**Branch:** `games/deep-distinctness-audit`  
**Purpose:** owner-approved target specification and release gate. This document does not claim the work is implemented or that the live Hub has changed.

## Product direction

The Hub should feel like a premium game platform, not a directory of lightly reskinned mini-games. Use the supplied 3D avatar screenshot as a visual-direction reference: stylized high-quality 3D character art, cinematic lighting, material definition, a premium framed presentation, strong profile identity, and a clear customization/purchase surface. Do not copy its specific character, UI, brand, or protected assets.

The intended quality target is **AAA-style presentation and cohesive product polish**. The label **AAA+** must remain a target, not a user-facing quality claim, until evidence gates below are passed.

## Avatar system: blank base to fully customized identity

### Starting choice
On first profile creation, offer three equal-status base choices:
- Masculine
- Feminine
- Androgynous / neutral

These are presentation presets, not identity restrictions. Every body type must be available with the same customization categories and gameplay access. Users may change the base presentation later without losing unlocked items.

### Customization categories
1. **Body and face:** body proportions within supported rig limits, face shape, skin tone, eye shape/colour, brows, nose, mouth, facial hair, makeup, and age-neutral stylization options.
2. **Hair:** styles, length, texture, colour, highlights and facial hair styles.
3. **Clothing:** tops, bottoms, outerwear, shoes, gloves, hats and layered outfits.
4. **Accessories:** glasses, earrings, necklaces, masks, backpacks, pets/companions and hand-held cosmetic props.
5. **Style effects:** colour accents, aura, emotes, idle poses, victory poses, trails and profile-card background.
6. **Identity display:** display name, profile frame, level/XP, selected title, badges and favourite game.
7. **Saved looks:** multiple named loadouts, preview before applying, reset-to-base and randomize options.

### Asset and technical requirements
- Use a consistent rig/skeleton and scale so clothing, hair and accessories attach correctly across all three base presets.
- Prefer modular meshes/materials and shared animation sets over a separate bespoke character per cosmetic.
- Target a stylized, polished 3D art direction with PBR-compatible materials, readable silhouettes, high-quality face/hair shading, key/fill/rim lighting, soft contact shadows, and tasteful post-processing.
- Provide LODs or simplified preview assets for lower-powered phones; lazy-load cosmetics and cache owned assets.
- The avatar preview must support rotate, zoom, neutral pose, animation preview and before/after comparison; touch controls must not conflict with page scrolling.
- Support safe-area insets, portrait and landscape, keyboard navigation, reduced motion, readable labels and clear focus states.
- Save only validated cosmetic IDs and parameters on the server. Never trust client-reported ownership, purchase state, level, currency or unlock status.
- Keep gameplay score and competitive performance independent of cosmetic choices. No paid stat boosts or competitive advantages.
- Cosmetic purchases require server-side price/ownership validation, receipt/webhook validation and replay protection. Purchases stay disabled until the payment provider has approved the actual business model and live tests pass.
- Include preview, owned/locked status, price, unlock requirements, confirmation, restore/entitlement sync and refund/support policy. Do not use deceptive countdowns or fake scarcity.
- Never create a blank mannequin that is visually broken: ship a complete polished base model for each starting presentation.

### Proposed avatar navigation
Profile > Avatar > Customize:
- Center: interactive 3D avatar.
- Left/upper panel: base/body, face, hair, skin.
- Right/lower panel: category tabs and item grid.
- Bottom: rotate, zoom, randomize, reset, saved looks, apply/save.
- Separate shop state for locked cosmetics; never confuse preview with ownership.
- Profile summary: avatar, display name, level/XP progress, title/badges and account settings.
- On small screens, category and item panels become compact bottom sheets while the avatar remains visible.

## Hub-wide audit scope

Every surface must be reviewed—not only the game canvas.

| Area | Required audit and acceptance evidence |
|---|---|
| Navigation and visual system | Consistent design tokens, spacing, typography, iconography, responsive layouts, loading/empty/error states, accessible contrast and no dead links. |
| Account and profile | Sign-up/login/logout, recovery, session expiration, profile editing, privacy, avatar persistence, safe name handling, mobile usability. |
| Avatar/customization | All three starting presentations, modular compatibility, save/load, ownership enforcement, preview performance, accessibility, no broken combinations. |
| Game catalog/search | Stable IDs, accurate metadata, working launch links, no duplicate identities, filters/search/favourites, responsive cards and thumbnails. |
| Every game | Independent gameplay loop, reliable input, collision/physics fairness, meaningful progression, readable feedback, audio, pause/restart/exit, mobile touch and performance. |
| Scores/leaderboards | Server-authoritative validation, replay resistance, rate limits, event/game/build binding, tie rules, invalid-score handling, history preservation. |
| Giveaways/events | Eligibility, schedule/time zones, entry rules, score cutoffs, anti-abuse, transparent winner rules, event closure, audit logs and safe admin overrides. |
| Wallet/rewards | Server-side ledger, idempotency, no negative balances, transaction history, clear reward source, no client-trusted currency. |
| Payments/shop | Test/live separation, approved provider use, signed webhooks, replay/idempotency, refunds/chargebacks, receipt reconciliation, disabled by default until approved. |
| Channel/vendor/brand features | Clear permission boundaries, ownership/authorization checks, correct booking/giveaway language, no unintended channel lockouts, vendor isolation. |
| Admin/security | Role permissions, MFA, CSRF, secure password storage, session controls, audit logs, secret handling, input validation, abuse throttling and recovery. |
| API/database | Schema constraints, migrations/rollback, referential integrity, transactions, safe errors, input validation, backup/restore and data retention. |
| Performance/reliability | Load time, memory, CPU/GPU/frame pacing, asset sizes, mobile network behaviour, crash-free runs, accessibility and graceful failure. |
| Legal/rights/privacy | Asset/code/font/audio licenses, attribution, third-party terms, privacy/data deletion, age/region restrictions, payment/giveaway rules. |
| Release/operations | Clean production build, environment config, HTTPS/domain, logs/alerts, backups, rollback, Android browser test, installable PWA/app strategy, store policy review. |

## Game distinctness standard

For each pair, compare player verbs, core decision loop, objective/failure, spatial/camera model, enemy/hazard behaviour, scoring/mastery, progression, encounter grammar, visual/audio language, and implementation/assets. Theme, colour, character, speed tweaks, or a different title do not qualify as distinct gameplay by themselves.

Allowed decisions:
- **KEEP — DISTINCT:** evidence supports a separate core loop.
- **REBUILD — DISTINCT IDENTITY:** preserve stable ID only if compatibility requires it, while building a genuinely different loop.
- **CONSOLIDATE/RETIRE:** only after score/event/deep-link dependencies are mapped and migration tests pass.
- **RIGHTS HOLD:** remove from public access until provenance/permissions are verified.
- **BLOCKED:** known defect prevents sign-off.

Do not pad the catalog to reach a number. A smaller set of excellent games is preferable to a large set of clones.

## AAA+ evidence gate

A title or hub subsystem is not approved until evidence is recorded against the exact build:
1. Before/after screenshots or video at desktop and target Android resolutions.
2. Human play session covering first-use onboarding and later-stage gameplay.
3. Controls, collision, physics, scoring and restart/pause/exit regression.
4. Mobile performance evidence: frame pacing, load time, memory, thermal/battery observations and asset loading.
5. Visual review: silhouette, materials, lighting, animation anticipation/response, VFX restraint, camera, typography, HUD, transitions and readability.
6. Audio review: mix, feedback, mute/volume persistence, interruption/resume.
7. Accessibility: touch target sizes, contrast, reduced motion, text scaling where supported, keyboard and focus.
8. Security and score integrity tests where competitive play is involved.
9. Rights/provenance record for all source, meshes, textures, animations, fonts, audio and logos.
10. Reviewer, date, build hash, defects, retest evidence and signed decision.

Do not label a title AAA+ solely because it uses 3D assets, passes CI, has a high catalog tier, or looks good in a single screenshot.

## Release execution gates

### Gate 0 — baseline and ownership
- Confirm target branch, current production commit, hosting configuration, environment variables and rollback path.
- Keep payment, live giveaways and public deployment unchanged until authorized and tested.
- Build a route/API/schema/permission inventory for the whole Hub.

### Gate 1 — source and security audit
- Run existing automated suites and inspect coverage gaps.
- Map routes to handlers, tables to migrations, roles to permissions, game IDs to events/scores and payments to ledger records.
- Resolve all high-severity vulnerabilities and data integrity issues before public launch.

### Gate 2 — game catalog and quality
- Complete all 4,950 unordered comparisons for 100 titles or explicitly revise the catalog size.
- Fix/remove duplicate experiences only after dependency and regression gates.
- Human-test every retained game on desktop and a real Android device.
- Add visual/quality evidence per game; no blanket sign-off.

### Gate 3 — profile/avatar
- Implement modular 3D avatar data model, viewer, customization, save/load and ownership enforcement.
- Test all three starting presets, item combinations, saved looks, account sync and lower-performance fallback.
- Verify the art pipeline and commercial redistribution rights before bundling assets.

### Gate 4 — product systems
- Audit catalog, wallet/rewards, leaderboards, giveaways, channel/vendor integrations, admin, settings, notifications and sharing end to end.
- Complete security, accessibility, privacy and abuse tests.

### Gate 5 — release candidate
- Clean reproducible build, full test suite, manual acceptance, backup/restore rehearsal, monitoring, support/incident process and rollback drill.
- Test the public URL on real mobile data and Wi-Fi; separately test installable PWA and Android wrapper/store packaging.
- Use internal/closed testing first. Public launch only after owner acceptance and platform/payment/legal review.

## Current known status at creation
- Catalog: 100 entries; all catalog entry and thumbnail paths were found in the repository tree.
- Selected duplicate clusters have source-level findings, but all 4,950 pairs have not been fully reviewed.
- Existing QA tracker explicitly leaves games not signed off until human acceptance evidence exists.
- No 3D avatar customization implementation, whole-Hub AAA sign-off, public-release approval or device acceptance is established by this document.
- This specification does not change production and does not itself implement the features above.
